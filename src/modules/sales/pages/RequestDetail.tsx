import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Ban, ArrowLeft, AlarmClock, Check, Copy, ExternalLink, FileText, Link2, MessageSquare, Paperclip, Scissors, Sparkles, TriangleAlert, Upload, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { users } from '@/data/stores';
import { useI18n, type L } from '@/i18n';
import { Empty, Modal, useToast } from '@/components/ui';
import { Circuit, SalesStageBadge } from '../components/Circuit';
import { DEFAULT_REQUEST_FORM, parseQuantities } from '../formFields';
import {
  addNote,
  clearBlocker,
  copyText,
  dayKeyOf,
  dwellByStage,
  followUpState,
  fileUrl,
  latestQuote,
  localDayKey,
  msInCurrentStage,
  publicQuoteUrl,
  reachedIndex,
  reanalyzeRequest,
  salesEstimates,
  salesQuotes,
  salesRequests,
  saveStudio,
  sendQuote,
  transitionRequest,
  uploadFile,
  DAY_MS,
  type SendQuoteResult,
} from '../stores';
import { BLOCKER_LABEL, STAGE_LABEL, type Blocker, type BlockerKind, type SalesNote, type SalesRequest, type SalesStage, type StudioInfo, type StudioStatus } from '../types';

const EMPTY_STUDIO: StudioInfo = { status: 'none', brief: '', fileIds: [] };
const SOURCE_LABEL: Record<SalesRequest['source'], L> = {
  form: { fr: 'Formulaire public', en: 'Public form' },
  email: { fr: 'Courriel', en: 'E-mail' },
  manual: { fr: 'Saisie manuelle', en: 'Entered manually' },
};
const STUDIO_STATUS: Record<StudioStatus, L> = {
  none: { fr: 'Aucune demande', en: 'No request' },
  requested: { fr: 'Demandé', en: 'Requested' },
  in_progress: { fr: 'En cours', en: 'In progress' },
  done: { fr: 'Prêt', en: 'Done' },
};
const QUOTE_STATUS: Record<string, { label: L; cls: string }> = {
  sent: { label: { fr: 'Envoyée', en: 'Sent' }, cls: 'badge-info' },
  accepted: { label: { fr: 'Acceptée', en: 'Accepted' }, cls: 'badge-ok' },
  declined: { label: { fr: 'Refusée', en: 'Declined' }, cls: 'badge-err' },
  changes: { label: { fr: 'Changements demandés', en: 'Changes requested' }, cls: 'badge-warn' },
  superseded: { label: { fr: 'Remplacée', en: 'Superseded' }, cls: '' },
  expired: { label: { fr: 'Expirée', en: 'Expired' }, cls: '' },
};
const BLOCKER_KINDS = Object.keys(BLOCKER_LABEL) as BlockerKind[];

/** An action on the stage. `go` moves directly, `note` asks for a note first, `send` opens the quote dialog. */
interface StageAction {
  key: string;
  label: L;
  perm: 'sales.edit' | 'sales.send';
  mode: 'go' | 'note' | 'send';
  to?: SalesStage;
  noteRequired?: boolean;
  primary?: boolean;
  danger?: boolean;
  noteTitle?: L;
}

const STAGE_ACTIONS: Partial<Record<SalesStage, StageAction[]>> = {
  received: [{ key: 'start', label: { fr: 'Lancer l’estimation', en: 'Start estimating' }, perm: 'sales.edit', mode: 'go', to: 'estimating', primary: true }],
  estimating: [{ key: 'ready', label: { fr: 'Marquer prêt pour révision', en: 'Mark ready for review' }, perm: 'sales.edit', mode: 'go', to: 'review', primary: true }],
  review: [
    { key: 'approve', label: { fr: 'Soumission prête', en: 'Quote ready' }, perm: 'sales.edit', mode: 'go', to: 'quote_ready', primary: true },
    { key: 'back', label: { fr: 'Renvoyer à l’estimation', en: 'Send back to estimating' }, perm: 'sales.edit', mode: 'note', to: 'estimating', noteTitle: { fr: 'Pourquoi renvoyer ?', en: 'Why send back?' } },
  ],
  quote_ready: [{ key: 'send', label: { fr: 'Envoyer la soumission', en: 'Send the quote' }, perm: 'sales.send', mode: 'send', primary: true }],
  with_client: [
    { key: 'accepted', label: { fr: 'Marquer acceptée', en: 'Mark accepted' }, perm: 'sales.send', mode: 'go', to: 'accepted', primary: true },
    { key: 'changes', label: { fr: 'Changements demandés', en: 'Changes requested' }, perm: 'sales.edit', mode: 'note', to: 'estimating', noteTitle: { fr: 'Changements demandés par le client', en: 'Changes requested by the customer' } },
  ],
  accepted: [{ key: 'production', label: { fr: 'Envoyer en production', en: 'Send to production' }, perm: 'sales.send', mode: 'go', to: 'production', primary: true }],
};
const DECLINE: StageAction = {
  key: 'decline',
  label: { fr: 'Refuser / perdue', en: 'Decline / lost' },
  perm: 'sales.send',
  mode: 'note',
  to: 'declined',
  noteRequired: true,
  danger: true,
  noteTitle: { fr: 'Raison du refus', en: 'Reason for declining' },
};

const tomorrow = () => localDayKey(Date.now() + DAY_MS);

export function RequestRedirect() {
  const { id } = useParams();
  return <Navigate to={`/sales?r=${encodeURIComponent(id ?? '')}`} replace />;
}

/** The whole life of one request: circuit, actions, notes, follow-ups, blocker, studio, AI analysis, source, quote, links. */
export function RequestDetail({ id }: { id: string }) {
  const { t, fmtDate } = useI18n();
  const { can, user } = useAuth();
  const toast = useToast();
  const userName = useUserName();
  const { rows, loading, reload } = useCollection(salesRequests);
  const { rows: quotes, reload: reloadQuotes } = useCollection(salesQuotes);
  const { rows: estimates } = useCollection(salesEstimates);
  const r = rows.find((x) => x.id === id);
  const [dialog, setDialog] = useState<null | { kind: 'send' } | { kind: 'note'; action: StageAction } | { kind: 'edit' }>(null);
  const [busy, setBusy] = useState(false);

  if (!r) {
    return loading ? (
      <div className="card sl-section">{t('Chargement…', 'Loading…')}</div>
    ) : (
      <div className="card">
        <Empty icon={<FileText size={36} />} title={t('Demande introuvable', 'Request not found')}>
          <Link to="/sales/requests">{t('Voir toutes les demandes', 'See all requests')}</Link>
        </Empty>
      </div>
    );
  }

  const now = Date.now();
  const canEdit = can('sales.edit');
  const canSend = can('sales.send');
  const canStudio = can('sales.studio');
  const refresh = () => {
    reload();
    reloadQuotes();
  };
  const studio = r.studio ?? EMPTY_STUDIO;
  const analysis = r.analysis ?? { status: 'none' as const, summary: '', assumptions: [], questions: [], confidence: 'low' as const };
  const quote = latestQuote(quotes, r.id);
  const estimate = estimates.find((e) => e.id === r.estimateId);
  const reopenTo: SalesStage = [...r.history].reverse().find((e) => e.to === 'declined')?.from ?? 'received';
  const dwell = dwellByStage(r, now);

  const actions: StageAction[] = [];
  if (r.stage === 'declined') {
    if (canEdit) actions.push({ key: 'reopen', label: { fr: 'Réouvrir', en: 'Reopen' }, perm: 'sales.edit', mode: 'go', to: reopenTo, primary: true });
  } else if (r.stage !== 'production') {
    for (const a of STAGE_ACTIONS[r.stage] ?? []) if (can(a.perm)) actions.push(a);
    if (canSend && r.stage !== 'accepted') actions.push(DECLINE);
  }

  const run = async (to: SalesStage, note?: string) => {
    setBusy(true);
    try {
      await transitionRequest(r.id, to, note || undefined);
      toast(t(`Étape : ${t(STAGE_LABEL[to])}`, `Stage: ${t(STAGE_LABEL[to])}`));
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const onAction = (a: StageAction) => {
    if (a.mode === 'send') setDialog({ kind: 'send' });
    else if (a.mode === 'note') setDialog({ kind: 'note', action: a });
    else if (a.to) void run(a.to);
  };

  const blockerLabel = r.blocker ? t(BLOCKER_LABEL[r.blocker.kind]) : '';

  return (
    <>
      <Link to="/sales" className="sl-back">
        <ArrowLeft size={16} /> {t('Retour au suivi', 'Back to tracker')}
      </Link>

      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="eyebrow mono">{r.no}</div>
          <h1 style={{ margin: 0, fontSize: 26 }}>{r.customer || t('Client à identifier', 'Customer to identify')}</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {r.project || '—'} · {t('Responsable', 'Owner')} : {r.ownerId ? userName(r.ownerId) : t('non assigné', 'unassigned')}
          </p>
        </div>
        <div className="row row-wrap" style={{ alignItems: 'center' }}>
          <SalesStageBadge stage={r.stage} />
          {r.revision > 1 && <span className="badge badge-warn">{t(`Révision ${r.revision}`, `Revision ${r.revision}`)}</span>}
          <span className="badge">{t(SOURCE_LABEL[r.source])}</span>
        </div>
      </div>

      {r.stage === 'declined' && (
        <div className="sl-banner is-err" role="status">
          <Ban size={20} className="sl-banner-icon" style={{ color: 'var(--err)' }} />
          <div>
            <strong>{t('Demande refusée ou perdue', 'Request declined or lost')}</strong>
            <div className="sl-meta">{t('Réouvrir pour la reprendre à l’étape précédente.', 'Reopen it to resume at the previous stage.')}</div>
          </div>
        </div>
      )}
      {r.blocker && (
        <div className="sl-banner" role="status">
          <TriangleAlert size={20} className="sl-banner-icon" />
          <div>
            <strong>
              {t('Bloquée', 'Blocked')} : {blockerLabel}
            </strong>
            {r.blocker.note && <div style={{ marginTop: 2 }}>{r.blocker.note}</div>}
            <div className="sl-meta">
              {t('Depuis le', 'Since')} {fmtDate(r.blocker.since, true)}
              {r.blocker.followUpAt && (
                <>
                  {' · '}
                  {t('Suivi le', 'Follow up on')} {fmtDate(r.blocker.followUpAt)}
                </>
              )}
              {' · '}
              {userName(r.blocker.userId)}
            </div>
          </div>
        </div>
      )}

      <section className="card sl-panel" aria-labelledby="sl-circuit-title">
        <div className="sl-panel-head">
          <h2 id="sl-circuit-title" style={{ fontSize: 16, margin: 0 }}>
            {t('Parcours de la demande', 'Request journey')}
          </h2>
          <span className="faint small">
            {t(`${msDays(msInCurrentStage(r, now))} dans l’étape actuelle`, `${msDays(msInCurrentStage(r, now))} in the current stage`)}
          </span>
        </div>
        <Circuit
          stage={r.stage}
          reachedIdx={reachedIndex(r)}
          dwell={dwell}
          blocked={r.blocker?.kind}
          revision={r.revision}
          studio={studio.status}
        />
        <div className="sl-legend" aria-hidden="true">
          <span>
            <i /> {t('Étape franchie', 'Completed stage')}
          </span>
          <span>
            <i className="dashed" /> {t('À venir', 'To come')}
          </span>
          <span>
            <i style={{ borderColor: 'var(--warn)' }} /> {t('Changements demandés', 'Changes requested')}
          </span>
        </div>
      </section>

      {actions.length > 0 && (
        <section className="card sl-section" style={{ marginBottom: 16 }} aria-label={t('Actions', 'Actions')}>
          <div className="sl-actions-row">
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                className={`btn ${a.primary ? 'btn-primary' : ''}`}
                style={a.danger ? { color: 'var(--err)', borderColor: 'var(--err)' } : undefined}
                disabled={busy}
                onClick={() => onAction(a)}
              >
                {t(a.label)}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="sl-grid">
        <div className="sl-col">
          <NotesCard r={r} canEdit={canEdit} userId={user?.id ?? 'unknown'} userName={userName} onDone={reload} />
          <FollowUpsCard r={r} canEdit={canEdit} userId={user?.id ?? 'unknown'} onDone={reload} />
          <BlockerCard r={r} canEdit={canEdit} userId={user?.id ?? 'unknown'} onDone={reload} />
          <StudioCard r={r} studio={studio} canStudio={canStudio} onDone={refresh} />
        </div>

        <div className="sl-col">
          <InfoCard r={r} canEdit={canEdit} onEdit={() => setDialog({ kind: 'edit' })} userName={userName} />
          <AnalysisCard r={r} analysis={analysis} canEdit={canEdit} onDone={refresh} />
          <SourceCard r={r} />
          <QuoteCard quote={quote} />
          <section className="card sl-section" aria-label={t('Liens', 'Links')}>
            <h3 className="sl-card-title">
              <span>{t('Liens', 'Links')}</span>
            </h3>
            <ul className="sl-facts" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 14px' }}>
              <dt>{t('Estimation', 'Estimate')}</dt>
              <dd>
                {r.estimateId ? (
                  <Link to={`/estimating/${r.estimateId}`}>
                    {estimate?.no ?? r.estimateId} <ExternalLink size={12} />
                  </Link>
                ) : (
                  <span className="faint">{t('Pas encore créée', 'Not created yet')}</span>
                )}
              </dd>
              <dt>{t('Soumission', 'Quote')}</dt>
              <dd>
                {quote ? (
                  <a href={publicQuoteUrl(quote.token)} target="_blank" rel="noreferrer">
                    {quote.no} <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="faint">{t('Aucune', 'None')}</span>
                )}
              </dd>
              <dt>{t('Bon de travail', 'Work order')}</dt>
              <dd>
                {r.workOrderId ? (
                  <Link to={`/workorders/${r.workOrderId}`}>
                    {r.workOrderId} <ExternalLink size={12} />
                  </Link>
                ) : (
                  <span className="faint">{t('Aucun', 'None')}</span>
                )}
              </dd>
            </ul>
          </section>
          <HistoryCard r={r} userName={userName} />
        </div>
      </div>

      {dialog?.kind === 'send' && (
        <SendQuoteDialog
          r={r}
          onClose={() => setDialog(null)}
          onSent={() => {
            refresh();
          }}
        />
      )}
      {dialog?.kind === 'note' && (
        <NoteDialog
          title={t(dialog.action.noteTitle ?? dialog.action.label)}
          required={!!dialog.action.noteRequired}
          confirmLabel={t(dialog.action.label)}
          danger={!!dialog.action.danger}
          onClose={() => setDialog(null)}
          onConfirm={(note) => {
            setDialog(null);
            if (dialog.action.to) void run(dialog.action.to, note);
          }}
        />
      )}
      {dialog?.kind === 'edit' && <EditInfoDialog r={r} onClose={() => setDialog(null)} />}
    </>
  );
}

/* ---------- Small pieces ---------- */

function msDays(ms: number) {
  const d = ms / DAY_MS;
  return `${d < 10 ? Number(d.toFixed(1)) : Math.round(d)} j`;
}

function Card({ title, actions, children, label }: { title: string; actions?: ReactNode; children: ReactNode; label?: string }) {
  return (
    <section className="card sl-section" aria-label={label ?? title}>
      <h3 className="sl-card-title">
        <span>{title}</span>
        {actions && <span className="sl-actions">{actions}</span>}
      </h3>
      {children}
    </section>
  );
}

/* ---------- Notes ---------- */

function NotesCard({ r, canEdit, userId, userName, onDone }: { r: SalesRequest; canEdit: boolean; userId: string; userName: (id?: string) => string; onDone: () => void }) {
  const { t, fmtDate } = useI18n();
  const toast = useToast();
  const [text, setText] = useState('');
  const notes = r.notes.filter((n) => n.kind !== 'followup').sort((a, b) => a.at.localeCompare(b.at));
  const submit = async () => {
    if (!text.trim()) return;
    try {
      await addNote(r, { userId, kind: 'note', text: text.trim() });
      setText('');
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    }
  };
  return (
    <Card title={t('Notes', 'Notes')} label={t('Notes', 'Notes')}>
      {notes.length ? (
        <ol className="sl-timeline">
          {notes.map((n: SalesNote) => (
            <li key={n.id} className={`kind-${n.kind}`}>
              <div className="sl-meta">
                {fmtDate(n.at, true)} · {n.kind === 'system' ? t('Système', 'System') : userName(n.userId)}
              </div>
              <div className="sl-note-text">{n.text}</div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="faint small" style={{ margin: 0 }}>
          {t('Aucune note pour le moment.', 'No notes yet.')}
        </p>
      )}
      {canEdit && (
        <div className="sl-inline-form">
          <textarea className="textarea" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Ajouter une note…', 'Add a note…')} aria-label={t('Nouvelle note', 'New note')} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-sm" onClick={submit} disabled={!text.trim()}>
              <MessageSquare size={14} /> {t('Ajouter la note', 'Add note')}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- Follow-ups ---------- */

function FollowUpsCard({ r, canEdit, userId, onDone }: { r: SalesRequest; canEdit: boolean; userId: string; onDone: () => void }) {
  const { t, fmtDate } = useI18n();
  const toast = useToast();
  const [text, setText] = useState('');
  const [due, setDue] = useState(tomorrow);
  const items = r.notes.filter((n) => n.kind === 'followup').sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));
  const open = items.filter((n) => !n.done);
  const closed = items.filter((n) => n.done);

  const toggle = async (n: SalesNote) => {
    try {
      await salesRequests.update(r.id, { notes: r.notes.map((x) => (x.id === n.id ? { ...x, done: !x.done } : x)) });
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    }
  };
  const add = async () => {
    if (!text.trim() || !due) return;
    try {
      await addNote(r, { userId, kind: 'followup', text: text.trim(), dueAt: due, done: false });
      setText('');
      setDue(tomorrow());
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    }
  };

  const row = (n: SalesNote) => {
    const st = n.dueAt ? followUpState(n.dueAt) : 'later';
    const late = !n.done && st === 'overdue';
    return (
      <li key={n.id} className="sl-fu-row">
        {canEdit ? (
          <input type="checkbox" checked={!!n.done} onChange={() => toggle(n)} aria-label={t('Marquer comme fait', 'Mark as done')} />
        ) : (
          <span aria-hidden="true">{n.done ? <Check size={14} /> : <AlarmClock size={14} />}</span>
        )}
        <div className="sl-fu-text">
          <div style={n.done ? { textDecoration: 'line-through', color: 'var(--text-3)' } : undefined}>{n.text}</div>
          <div className={`sl-meta ${late ? 'sl-overdue' : ''}`}>
            {n.dueAt ? fmtDate(n.dueAt) : ''}
            {late ? ` · ${t('En retard', 'Overdue')}` : ''}
            {n.done ? ` · ${t('Fait', 'Done')}` : ''}
          </div>
        </div>
      </li>
    );
  };

  return (
    <Card title={t('Suivis', 'Follow-ups')} label={t('Suivis', 'Follow-ups')}>
      {open.length + closed.length === 0 && !r.blocker?.followUpAt && (
        <p className="faint small" style={{ margin: 0 }}>
          {t('Aucun suivi.', 'No follow-ups.')}
        </p>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {open.map(row)}
        {r.blocker?.followUpAt && (
          <li className="sl-fu-row">
            <AlarmClock size={14} aria-hidden="true" />
            <div className="sl-fu-text">
              <div>{t('Suivi du blocage', 'Blocker follow-up')}{r.blocker.note ? ` : ${r.blocker.note}` : ''}</div>
              <div className={`sl-meta ${followUpState(r.blocker.followUpAt) === 'overdue' ? 'sl-overdue' : ''}`}>{fmtDate(r.blocker.followUpAt)}</div>
            </div>
          </li>
        )}
        {closed.map(row)}
      </ul>
      {canEdit && (
        <div className="sl-inline-form">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Ex. Rappeler pour les dimensions', 'E.g. Call back about dimensions')} aria-label={t('Texte du suivi', 'Follow-up text')} />
          <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
            <label className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="small muted">{t('À faire le', 'Due')}</span>
              <input type="date" className="input input-sm" value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
            <button type="button" className="btn btn-sm" onClick={add} disabled={!text.trim() || !due}>
              <AlarmClock size={14} /> {t('Ajouter le suivi', 'Add follow-up')}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- Blocker ---------- */

function BlockerCard({ r, canEdit, userId, onDone }: { r: SalesRequest; canEdit: boolean; userId: string; onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const key = r.blocker?.since ?? 'none';
  return (
    <Card title={t('Blocage', 'Blocker')} label={t('Blocage', 'Blocker')}>
      <BlockerForm key={key} r={r} canEdit={canEdit} userId={userId} onSaved={() => onDone()} onError={(m) => toast(m, 'err')} />
    </Card>
  );
}

function BlockerForm({ r, canEdit, userId, onSaved, onError }: { r: SalesRequest; canEdit: boolean; userId: string; onSaved: () => void; onError: (m: string) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const b: Blocker | undefined = r.blocker;
  const [kind, setKind] = useState<BlockerKind>(b?.kind ?? 'customer');
  const [note, setNote] = useState(b?.note ?? '');
  const [fu, setFu] = useState(b?.followUpAt ? dayKeyOf(b.followUpAt) : '');
  const save = async () => {
    try {
      const blocker: Blocker = { kind, note: note.trim(), since: b?.since ?? new Date().toISOString(), userId };
      if (fu) blocker.followUpAt = fu;
      await salesRequests.update(r.id, { blocker });
      toast(t('Blocage enregistré', 'Blocker saved'));
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };
  const clear = async () => {
    try {
      await clearBlocker(r.id);
      toast(t('Blocage levé', 'Blocker cleared'));
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };
  if (!canEdit) {
    return b ? (
      <p className="small" style={{ margin: 0 }}>
        {t(BLOCKER_LABEL[b.kind])}
        {b.note ? ` — ${b.note}` : ''}
      </p>
    ) : (
      <p className="faint small" style={{ margin: 0 }}>
        {t('Aucun blocage.', 'No blocker.')}
      </p>
    );
  }
  return (
    <div className="sl-inline-form" style={{ marginTop: 0 }}>
      <div className="form-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <label className="field">
          <span>{t('Raison', 'Reason')}</span>
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value as BlockerKind)}>
            {BLOCKER_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(BLOCKER_LABEL[k])}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Suivi le', 'Follow up on')}</span>
          <input type="date" className="input" value={fu} onChange={(e) => setFu(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>{t('Précisions', 'Details')}</span>
        <textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="row row-wrap" style={{ justifyContent: 'flex-end' }}>
        {b && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
            <X size={14} /> {t('Lever le blocage', 'Clear blocker')}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-primary" onClick={save}>
          <TriangleAlert size={14} /> {b ? t('Mettre à jour', 'Update') : t('Bloquer la demande', 'Block request')}
        </button>
      </div>
    </div>
  );
}

/* ---------- Studio ---------- */

function StudioCard({ r, studio, canStudio, onDone }: { r: SalesRequest; studio: StudioInfo; canStudio: boolean; onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [status, setStatus] = useState<StudioStatus>(studio.status);
  const [brief, setBrief] = useState(studio.brief);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setStatus(studio.status);
      setBrief(studio.brief);
    }
  }, [studio.status, studio.brief, dirty]);

  const save = async (extra: string[] = []) => {
    setBusy(true);
    try {
      await saveStudio(r.id, { status, brief, fileIds: [...studio.fileIds, ...extra] });
      setDirty(false);
      toast(t('Studio mis à jour', 'Studio updated'));
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const ids: string[] = [];
      for (const f of Array.from(files)) ids.push(await uploadFile(f));
      await saveStudio(r.id, { status, brief, fileIds: [...studio.fileIds, ...ids] });
      setDirty(false);
      toast(t(`${ids.length} fichier(s) ajouté(s)`, `${ids.length} file(s) added`));
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t('Studio (croquis et découpes)', 'Studio (sketches and dielines)')} label={t('Studio', 'Studio')} actions={<Scissors size={16} />}>
      <div className="form-grid" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
        <label className="field">
          <span>{t('Statut', 'Status')}</span>
          <select
            className="select"
            value={status}
            disabled={!canStudio}
            onChange={(e) => {
              setDirty(true);
              setStatus(e.target.value as StudioStatus);
            }}
          >
            {(Object.keys(STUDIO_STATUS) as StudioStatus[]).map((s) => (
              <option key={s} value={s}>
                {t(STUDIO_STATUS[s])}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Demande au studio', 'Request to the studio')}</span>
          <textarea
            className="textarea"
            rows={3}
            value={brief}
            disabled={!canStudio}
            onChange={(e) => {
              setDirty(true);
              setBrief(e.target.value);
            }}
            placeholder={t('Ex. Croquis avec dimensions, gabarit de découpe pour une boîte à fenêtre…', 'E.g. Sketch with dimensions, die line for a window box…')}
          />
        </label>
      </div>
      {canStudio && (
        <div className="row row-wrap" style={{ justifyContent: 'space-between', marginTop: 12 }}>
          <label className="btn btn-sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>
            <Upload size={14} /> {t('Ajouter des fichiers', 'Add files')}
            <input type="file" multiple accept="image/*,application/pdf" style={{ display: 'none' }} disabled={busy} onChange={(e) => onFiles(e.target.files)} />
          </label>
          <button type="button" className="btn btn-sm btn-primary" disabled={busy || !dirty} onClick={() => save()}>
            {t('Enregistrer', 'Save')}
          </button>
        </div>
      )}
      {studio.fileIds.length > 0 && (
        <ul className="sl-files" style={{ marginTop: 12 }}>
          {studio.fileIds.map((fid, i) => (
            <li key={fid}>
              <a href={fileUrl(fid)} target="_blank" rel="noreferrer">
                {t(`Fichier studio ${i + 1}`, `Studio file ${i + 1}`)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------- Info ---------- */

function InfoCard({ r, canEdit, onEdit, userName }: { r: SalesRequest; canEdit: boolean; onEdit: () => void; userName: (id?: string) => string }) {
  const { t, fmtDate, fmtNum } = useI18n();
  const { rows: all } = useCollection(users);
  const toast = useToast();
  const sp = r.spec ?? {};
  const dims = sp.lengthMm && sp.widthMm && sp.heightMm ? `${sp.lengthMm} × ${sp.widthMm} × ${sp.heightMm} mm` : '';
  const owner = async (id: string) => {
    try {
      await salesRequests.update(r.id, { ownerId: id });
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    }
  };
  return (
    <Card title={t('Demande', 'Request')} label={t('Demande', 'Request')} actions={canEdit && <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>{t('Modifier', 'Edit')}</button>}>
      <dl className="sl-facts">
        <dt>{t('Client', 'Customer')}</dt>
        <dd>{r.customer || '—'}</dd>
        <dt>{t('Contact', 'Contact')}</dt>
        <dd>
          {r.contact || '—'}
          {r.email && (
            <div className="small">
              <a href={`mailto:${r.email}`}>{r.email}</a>
            </div>
          )}
          {r.phone && <div className="small">{r.phone}</div>}
        </dd>
        <dt>{t('Projet', 'Project')}</dt>
        <dd>{r.project || '—'}</dd>
        <dt>{t('Date requise', 'Date needed')}</dt>
        <dd>{r.dueDate ? fmtDate(r.dueDate) : '—'}</dd>
        <dt>{t('Quantités', 'Quantities')}</dt>
        <dd>{r.quantities?.length ? r.quantities.map((q) => fmtNum(q)).join(' · ') : '—'}</dd>
        <dt>{t('Emballage', 'Packaging')}</dt>
        <dd>
          {[sp.type, sp.style, dims].filter(Boolean).join(' · ') || '—'}
        </dd>
        <dt>{t('Responsable', 'Owner')}</dt>
        <dd>
          {canEdit ? (
            <select className="select input-sm" value={r.ownerId ?? ''} onChange={(e) => owner(e.target.value)} aria-label={t('Responsable', 'Owner')} style={{ height: 30 }}>
              <option value="">{t('Non assigné', 'Unassigned')}</option>
              {all
                .filter((u) => u.active || u.id === r.ownerId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName}
                  </option>
                ))}
            </select>
          ) : (
            userName(r.ownerId) || '—'
          )}
        </dd>
        <dt>{t('Créée le', 'Created')}</dt>
        <dd>{fmtDate(r.createdAt, true)}</dd>
      </dl>
      {r.description && (
        <>
          <h4 className="small" style={{ margin: '14px 0 4px', color: 'var(--text-2)' }}>
            {t('Ce qui est demandé', 'What is asked')}
          </h4>
          <div className="sl-note-text small">{r.description}</div>
        </>
      )}
    </Card>
  );
}

function EditInfoDialog({ r, onClose }: { r: SalesRequest; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [f, setF] = useState({
    customer: r.customer,
    contact: r.contact,
    email: r.email,
    phone: r.phone,
    project: r.project,
    dueDate: r.dueDate,
    quantities: (r.quantities ?? []).join(', '),
    description: r.description,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setSaving(true);
    try {
      await salesRequests.update(r.id, {
        customer: f.customer.trim(),
        contact: f.contact.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        project: f.project.trim(),
        dueDate: f.dueDate,
        quantities: parseQuantities(f.quantities),
        description: f.description,
      });
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={t('Modifier la demande', 'Edit request')}
      large
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            {t('Annuler', 'Cancel')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {t('Enregistrer', 'Save')}
          </button>
        </>
      }
    >
      <div className="sl-form-grid">
        <label className="field">
          <span>{t('Client', 'Customer')}</span>
          <input className="input" value={f.customer} onChange={set('customer')} />
        </label>
        <label className="field">
          <span>{t('Personne-ressource', 'Contact')}</span>
          <input className="input" value={f.contact} onChange={set('contact')} />
        </label>
        <label className="field">
          <span>{t('Courriel', 'E-mail')}</span>
          <input className="input" value={f.email} onChange={set('email')} />
        </label>
        <label className="field">
          <span>{t('Téléphone', 'Phone')}</span>
          <input className="input" value={f.phone} onChange={set('phone')} />
        </label>
        <label className="field">
          <span>{t('Projet', 'Project')}</span>
          <input className="input" value={f.project} onChange={set('project')} />
        </label>
        <label className="field">
          <span>{t('Date requise', 'Date needed')}</span>
          <input type="date" className="input" value={f.dueDate} onChange={set('dueDate')} />
        </label>
        <label className="field span-2">
          <span>{t('Quantités', 'Quantities')}</span>
          <input className="input" value={f.quantities} onChange={set('quantities')} placeholder="1000, 2500, 5000" />
        </label>
        <label className="field span-2">
          <span>{t('Description', 'Description')}</span>
          <textarea className="textarea" rows={4} value={f.description} onChange={set('description')} />
        </label>
      </div>
    </Modal>
  );
}

/* ---------- AI analysis ---------- */

function AnalysisCard({ r, analysis, canEdit, onDone }: { r: SalesRequest; analysis: SalesRequest['analysis']; canEdit: boolean; onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const conf: Record<string, L> = { low: { fr: 'Faible', en: 'Low' }, medium: { fr: 'Moyenne', en: 'Medium' }, high: { fr: 'Élevée', en: 'High' } };
  const rerun = async () => {
    setBusy(true);
    try {
      await reanalyzeRequest(r.id);
      toast(t('Analyse relancée', 'Analysis restarted'));
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card
      title={t('Analyse IA', 'AI analysis')}
      label={t('Analyse IA', 'AI analysis')}
      actions={
        canEdit && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={rerun} disabled={busy || analysis.status === 'pending'}>
            <Sparkles size={14} /> {t('Relancer l’analyse', 'Re-run analysis')}
          </button>
        )
      }
    >
      {analysis.status === 'pending' && (
        <p className="small" style={{ color: 'var(--text-2)', margin: '0 0 8px' }}>
          {t('Lecture par l’IA en cours…', 'AI reading in progress…')}
        </p>
      )}
      {analysis.status === 'failed' && (
        <div className="alert alert-err small" style={{ marginBottom: 8 }}>
          {t('L’analyse a échoué.', 'The analysis failed.')} {analysis.error ?? ''}
        </div>
      )}
      {analysis.status === 'none' && <p className="faint small" style={{ margin: 0 }}>{t('Pas encore analysée.', 'Not analysed yet.')}</p>}
      {analysis.summary && <p className="sl-analysis-summary">{analysis.summary}</p>}
      {analysis.status !== 'none' && (
        <div className="sl-confidence small muted" style={{ marginTop: 6 }}>
          {t('Confiance', 'Confidence')} : {t(conf[analysis.confidence] ?? conf.low)}
        </div>
      )}
      {analysis.assumptions?.length > 0 && (
        <>
          <div className="sl-analysis-sub">{t('Hypothèses retenues', 'Assumptions made')}</div>
          <ul className="sl-ai-list">
            {analysis.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </>
      )}
      {analysis.questions?.length > 0 && (
        <>
          <div className="sl-analysis-sub">{t('Questions au client', 'Questions for the customer')}</div>
          <ul className="sl-ai-list">
            {analysis.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/* ---------- Source ---------- */

function SourceCard({ r }: { r: SalesRequest }) {
  const { t, fmtDate } = useI18n();
  const answers = Object.entries(r.formAnswers ?? {});
  return (
    <Card title={t('Source', 'Source')} label={t('Source', 'Source')}>
      <div className="small muted" style={{ marginBottom: 8 }}>
        {t(SOURCE_LABEL[r.source])}
      </div>
      {r.emailRef && (
        <dl className="sl-facts" style={{ marginBottom: 12 }}>
          <dt>{t('Objet', 'Subject')}</dt>
          <dd>{r.emailRef.subject}</dd>
          <dt>{t('De', 'From')}</dt>
          <dd>{r.emailRef.from}</dd>
          <dt>{t('Reçu le', 'Received')}</dt>
          <dd>{fmtDate(r.emailRef.receivedAt, true)}</dd>
        </dl>
      )}
      {r.description && (
        <div className="sl-note-text small" style={{ marginBottom: 12 }}>
          {r.description}
        </div>
      )}
      {answers.length > 0 && (
        <dl className="sl-facts" style={{ marginBottom: 12 }}>
          {answers.map(([k, v]) => {
            const f = DEFAULT_REQUEST_FORM.find((x) => x.id === k);
            return (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{f ? t(f.label) : k}</dt>
                <dd>{v || '—'}</dd>
              </div>
            );
          })}
        </dl>
      )}
      {r.fileIds?.length > 0 ? (
        <div className="sl-thumbs">
          {r.fileIds.map((fid, i) => (
            <a key={fid} className="sl-thumb" href={fileUrl(fid)} target="_blank" rel="noreferrer" aria-label={t(`Ouvrir le fichier ${i + 1}`, `Open file ${i + 1}`)}>
              <img
                src={fileUrl(fid)}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.removeAttribute('hidden');
                }}
              />
              <span className="sl-thumb-doc" hidden>
                <Paperclip size={18} />
              </span>
              <span>{t(`Fichier ${i + 1}`, `File ${i + 1}`)}</span>
            </a>
          ))}
        </div>
      ) : (
        <p className="faint small" style={{ margin: 0 }}>
          {t('Aucun fichier joint.', 'No attached files.')}
        </p>
      )}
    </Card>
  );
}

/* ---------- Quote ---------- */

function QuoteCard({ quote }: { quote: ReturnType<typeof latestQuote> }) {
  const { t, fmtDate, fmtMoney, fmtNum } = useI18n();
  const toast = useToast();
  const copyLink = async (link: string) => {
    const ok = await copyText(link);
    toast(ok ? t('Lien copié', 'Link copied') : link, ok ? 'ok' : 'err');
  };
  if (!quote) {
    return (
      <Card title={t('Soumission', 'Quote')} label={t('Soumission', 'Quote')}>
        <p className="faint small" style={{ margin: 0 }}>
          {t('Aucune soumission envoyée.', 'No quote sent yet.')}
        </p>
      </Card>
    );
  }
  const link = publicQuoteUrl(quote.token);
  const st = QUOTE_STATUS[quote.status] ?? { label: { fr: quote.status, en: quote.status }, cls: '' };
  const resp = quote.response;
  return (
    <Card
      title={`${t('Soumission', 'Quote')} · ${quote.no}`}
      label={t('Soumission', 'Quote')}
      actions={<span className={`badge ${st.cls}`}>{t(st.label)}</span>}
    >
      <div className="sl-quote-box">
        <div className="small muted">
          {t('Envoyée le', 'Sent on')} {fmtDate(quote.sentAt, true)} · {t('Valide jusqu’au', 'Valid until')} {fmtDate(quote.validUntil)}
          {quote.viewedAt && <> · {t('Consultée le', 'Viewed on')} {fmtDate(quote.viewedAt, true)}</>}
        </div>
        {quote.specSummary && <div>{quote.specSummary}</div>}
        {quote.lines?.length > 0 && (
          <table className="table" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>{t('Quantité', 'Quantity')}</th>
                <th className="num">{t('Prix unitaire', 'Unit price')}</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.lines.map((l, i) => (
                <tr key={i}>
                  <td>{fmtNum(l.quantity)}</td>
                  <td className="num">{fmtMoney(l.unitPrice, quote.currency)}</td>
                  <td className="num">{fmtMoney(l.total, quote.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="sl-link-copy">
          <code title={link}>{link}</code>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => copyLink(link)}
            aria-label={t('Copier le lien', 'Copy link')}
          >
            <Copy size={14} />
          </button>
        </div>
        {resp && (
          <div style={{ display: 'grid', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <div>
              <strong>
                {resp.decision === 'accept'
                  ? t('Acceptée', 'Accepted')
                  : resp.decision === 'decline'
                    ? t('Refusée', 'Declined')
                    : t('Changements demandés', 'Changes requested')}
              </strong>{' '}
              <span className="small muted">{fmtDate(resp.at, true)}</span>
            </div>
            {resp.signedName && (
              <div className="small">
                {t('Signé par', 'Signed by')} {resp.signedName}
                {resp.quantity ? ` · ${fmtNum(resp.quantity)}` : ''}
              </div>
            )}
            {resp.signature && <img className="sl-signature" src={resp.signature} alt={t('Signature du client', 'Customer signature')} />}
            {resp.reason && <div className="small">{resp.reason}</div>}
            {resp.comments && <div className="small sl-note-text">{resp.comments}</div>}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------- History ---------- */

function HistoryCard({ r, userName }: { r: SalesRequest; userName: (id?: string) => string }) {
  const { t, fmtDate } = useI18n();
  const events = [...r.history].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Card title={t('Historique', 'History')} label={t('Historique', 'History')}>
      {events.length ? (
        <ol className="sl-timeline" style={{ maxHeight: 260 }}>
          {events.map((e, i) => (
            <li key={i}>
              <div className="sl-meta">
                {fmtDate(e.at, true)} · {e.by === 'client' ? t('Client', 'Customer') : e.by === 'system' ? t('Système', 'System') : userName(e.by)}
              </div>
              <div>
                {e.from ? `${t(STAGE_LABEL[e.from])} → ` : ''}
                <strong>{t(STAGE_LABEL[e.to])}</strong>
              </div>
              {e.note && <div className="small muted">{e.note}</div>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="faint small" style={{ margin: 0 }}>
          {t('Aucun mouvement.', 'No moves yet.')}
        </p>
      )}
    </Card>
  );
}

/* ---------- Dialogs ---------- */

function NoteDialog({ title, required, confirmLabel, danger, onClose, onConfirm }: { title: string; required: boolean; confirmLabel: string; danger: boolean; onClose: () => void; onConfirm: (note: string) => void }) {
  const { t } = useI18n();
  const [note, setNote] = useState('');
  const ok = !required || note.trim().length > 0;
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            {t('Annuler', 'Cancel')}
          </button>
          <button
            className={`btn ${danger ? '' : 'btn-primary'}`}
            style={danger ? { color: 'var(--err)', borderColor: 'var(--err)' } : undefined}
            disabled={!ok}
            onClick={() => onConfirm(note.trim())}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <label className="field">
        <span>{required ? t('Note (obligatoire)', 'Note (required)') : t('Note (facultatif)', 'Note (optional)')}</span>
        <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
      </label>
    </Modal>
  );
}

function SendQuoteDialog({ r, onClose, onSent }: { r: SalesRequest; onClose: () => void; onSent: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [validDays, setValidDays] = useState(30);
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendQuoteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const res = await sendQuote(r.id, { validDays, terms: terms.trim() || undefined, notes: notes.trim() || undefined });
      setResult(res);
      onSent();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    const ok = await copyText(result.url);
    setCopied(ok);
    toast(ok ? t('Lien copié', 'Link copied') : result.url, ok ? 'ok' : 'err');
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('Envoyer la soumission', 'Send the quote')}
      footer={
        result ? (
          <button className="btn btn-primary" onClick={onClose}>
            {t('Terminé', 'Done')}
          </button>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={onClose}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary" onClick={send} disabled={busy || validDays < 1}>
              <Link2 size={14} /> {t('Envoyer au client', 'Send to customer')}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className={`sl-banner ${result.emailed ? 'is-ok' : ''}`} style={{ margin: 0 }}>
            <Check size={18} className="sl-banner-icon" style={{ color: 'var(--ok)' }} />
            <div>
              <strong>{t('Soumission envoyée', 'Quote sent')}</strong>
              <div className="small">
                {result.emailed
                  ? t(`Courriel envoyé à ${r.email || 'le client'}.`, `E-mail sent to ${r.email || 'the customer'}.`)
                  : t('Courriel non envoyé : copiez le lien et transmettez-le au client.', 'E-mail not sent: copy the link and pass it to the customer.')}
              </div>
            </div>
          </div>
          <div className="sl-link-copy">
            <code>{result.url}</code>
            <button type="button" className="btn btn-sm" onClick={copy} aria-label={t('Copier le lien', 'Copy link')}>
              <Copy size={14} /> {copied ? t('Copié', 'Copied') : t('Copier', 'Copy')}
            </button>
          </div>
        </div>
      ) : (
        <div className="sl-form-grid">
          <label className="field">
            <span>{t('Validité (jours)', 'Valid for (days)')}</span>
            <input type="number" min={1} max={365} className="input" value={validDays} onChange={(e) => setValidDays(Number(e.target.value) || 0)} />
          </label>
          <div className="field">
            <span className="small muted">{t('Le client reçoit un lien pour accepter, refuser ou demander des changements.', 'The customer gets a link to accept, decline or request changes.')}</span>
          </div>
          <label className="field span-2">
            <span>{t('Conditions', 'Terms')}</span>
            <textarea className="textarea" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={t('Ex. Prix FOB Montréal, taxes en sus.', 'E.g. Prices FOB Montreal, taxes extra.')} />
          </label>
          <label className="field span-2">
            <span>{t('Note pour le client', 'Note for the customer')}</span>
            <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
      )}
    </Modal>
  );
}
