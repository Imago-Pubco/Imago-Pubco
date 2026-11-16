import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { logAudit, users } from '@/data/stores';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import { HEALTH_LABEL, STATUS_LABEL, normalizeProgress, quarterLabel, wouldCycle } from '../lib';
import { alignPriorities, rocks } from '../stores';
import type { AlignPriority, Health, PriorityStatus, Rock } from '../schemas';
import { PriorityNotes } from './PriorityNotes';
import { errorText, userOptions } from './RockShared';

/**
 * Priority detail (large modal), reusable from any page: `<PriorityPanel priorityId={id} onClose={...} />`.
 * Managers (align.priorities.manage) edit every field; the priority's owner edits only its advancement and blocking;
 * others read it. Notes and follow-ups are written here too.
 */
export function PriorityPanel({ priorityId, onClose }: { priorityId: string; onClose: () => void }) {
  const { rows: all } = useCollection(alignPriorities);
  const { rows: allRocks } = useCollection(rocks);
  const { rows: people } = useCollection(users);
  const priority = all.find((x) => x.id === priorityId);
  if (!priority) return null;
  return <PriorityEditor key={priority.id} priority={priority} all={all} allRocks={allRocks} people={people} onClose={onClose} />;
}

interface Draft {
  title: string;
  description: string;
  ownerId: string;
  dueDate: string;
  rockId: string;
  status: PriorityStatus;
  health: Health;
  progress: number;
  blocked: boolean;
  blockedById: string;
  blockedNote: string;
}

const toDraft = (p: AlignPriority): Draft => ({
  title: p.title,
  description: p.description,
  ownerId: p.ownerId ?? '',
  dueDate: p.dueDate ?? '',
  rockId: p.rockId ?? '',
  status: p.status,
  health: p.health,
  progress: p.progress,
  blocked: !!p.blockedById,
  blockedById: p.blockedById ?? '',
  blockedNote: p.blockedNote,
});

/** Fields a manager may change. */
const MANAGER_KEYS = ['title', 'description', 'ownerId', 'dueDate', 'rockId', 'status', 'health', 'progress', 'blockedById', 'blockedNote'] as const;
/** Fields the owner of a priority may change (server rule: align.priorities). */
const OWNER_KEYS = ['status', 'health', 'progress', 'blockedById', 'blockedNote'] as const;

type Key = (typeof MANAGER_KEYS)[number];

function PriorityEditor({
  priority: p,
  all,
  allRocks,
  people,
  onClose,
}: {
  priority: AlignPriority;
  all: AlignPriority[];
  allRocks: Rock[];
  people: User[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const userName = useUserName();
  const [draft, setDraft] = useState<Draft>(() => toDraft(p));
  // What the user saw when the panel opened. Only the fields the user changed are saved, so a change made
  // meanwhile by someone else (status, owner...) is not reverted by an unrelated edit here.
  const [base] = useState<Draft>(() => toDraft(p));
  const [busy, setBusy] = useState(false);

  const manage = can('align.priorities.manage');
  const isOwner = p.ownerId === user!.id;
  const canAdvance = manage || isOwner;
  const canBlock = canAdvance;
  const canEditDetails = manage;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const allById = useMemo(() => new Map<string, AlignPriority>(all.map((x) => [x.id, x] as const)), [all]);
  const rockOptions = useMemo(() => allRocks.filter((r) => !r.archived || r.id === p.rockId), [allRocks, p.rockId]);
  const owners = useMemo(() => userOptions(people, p.ownerId), [people, p.ownerId]);

  // Priorities this one may wait for: not itself, not finished, not archived, and no loop.
  const candidates = useMemo(
    () => all.filter((x) => x.id !== p.id && !x.archived && x.status !== 'completed' && !wouldCycle(p.id, x.id, allById)),
    [all, allById, p.id],
  );
  const blockerOptions = useMemo(() => {
    const cur = draft.blockedById ? allById.get(draft.blockedById) : undefined;
    return cur && !candidates.some((x) => x.id === cur.id) ? [cur, ...candidates] : candidates;
  }, [allById, candidates, draft.blockedById]);

  const save = async () => {
    const title = draft.title.trim();
    if (canEditDetails && !title) {
      toast(t('Le titre est requis.', 'Title is required.'), 'err');
      return;
    }
    if (draft.blocked && !draft.blockedById) {
      toast(t('Choisissez la priorité qui bloque celle-ci.', 'Choose the priority that blocks this one.'), 'err');
      return;
    }
    if (draft.blocked && wouldCycle(p.id, draft.blockedById, allById)) {
      toast(t('Ce blocage créerait une boucle entre priorités.', 'This block would create a loop between priorities.'), 'err');
      return;
    }

    // Same mapping for the draft and for the baseline; only the differences are sent.
    const fieldsOf = (d: Draft): Record<Key, unknown> => ({
      title: d.title.trim(),
      description: d.description.trim(),
      ownerId: d.ownerId || null,
      dueDate: d.dueDate || null,
      rockId: d.rockId || null,
      status: d.status,
      health: d.health,
      progress: normalizeProgress(d.status, d.progress),
      blockedById: d.blocked && d.blockedById ? d.blockedById : null,
      blockedNote: d.blocked && d.blockedById ? d.blockedNote.trim() : '',
    });
    const next = fieldsOf(draft);
    const was = fieldsOf(base);
    const allowed: readonly Key[] = canEditDetails ? MANAGER_KEYS : canAdvance ? OWNER_KEYS : [];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (next[k] !== was[k]) patch[k] = next[k];

    if (!Object.keys(patch).length) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await alignPriorities.update(p.id, patch as Partial<AlignPriority>);
      await logAudit(user!.id, 'align.priority.update', `${p.title}: ${Object.keys(patch).join(', ')}`);
      toast(t('Priorité enregistrée', 'Priority saved'));
      onClose();
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const subject = p.title;
    if (
      !window.confirm(
        t(
          `Supprimer la priorité « ${subject} » ? Ses notes et suivis seront supprimés aussi. Action irréversible.`,
          `Delete the priority "${subject}"? Its notes and follow-ups will be deleted too. This cannot be undone.`,
        ),
      )
    )
      return;
    setBusy(true);
    try {
      await alignPriorities.remove(p.id);
      await logAudit(user!.id, 'align.priority.delete', subject);
      toast(t('Priorité supprimée', 'Priority deleted'));
      onClose();
    } catch (e) {
      toast(errorText(e), 'err');
      setBusy(false);
    }
  };

  const rock = p.rockId ? allRocks.find((r) => r.id === p.rockId) : undefined;
  const editable = canAdvance;

  return (
    <Modal
      open
      large
      onClose={onClose}
      title={p.title}
      footer={
        <>
          {manage && (
            <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove} disabled={busy}>
              <Trash2 size={15} /> {t('Supprimer', 'Delete')}
            </button>
          )}
          <button className="btn" onClick={onClose}>
            {editable ? t('Annuler', 'Cancel') : t('Fermer', 'Close')}
          </button>
          {editable && (
            <button className="btn btn-primary" onClick={save} disabled={busy || (canEditDetails && !draft.title.trim())}>
              {t('Enregistrer', 'Save')}
            </button>
          )}
        </>
      }
    >
      <div className="stack" style={{ gap: 20 }}>
        <div className="row row-wrap small muted" style={{ gap: 14 }}>
          <span>{rock ? `${rock.title} · ${quarterLabel(rock.quarter)}` : t('Non rattachée à un Rock', 'Not linked to a Rock')}</span>
          <span>{t('Responsable', 'Owner')} : {userName(p.ownerId ?? undefined)}</span>
          {!manage && !isOwner && <span className="badge">{t('Lecture seule', 'Read only')}</span>}
        </div>

        <section className="stack" style={{ gap: 12 }}>
          <h4 className="rock-section-title">{t('Détails', 'Details')}</h4>
          <label className="field">
            <span>{t('Titre', 'Title')} *</span>
            <input className="input" value={draft.title} disabled={!canEditDetails} maxLength={200} onChange={(e) => set('title', e.target.value)} />
          </label>
          <label className="field">
            <span>{t('Description', 'Description')}</span>
            <textarea className="textarea" rows={3} maxLength={4000} value={draft.description} disabled={!canEditDetails} onChange={(e) => set('description', e.target.value)} />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>{t('Responsable', 'Owner')}</span>
              <select className="select" value={draft.ownerId} disabled={!canEditDetails} onChange={(e) => set('ownerId', e.target.value)}>
                <option value="">{t('— Non assignée —', '— Unassigned —')}</option>
                {owners.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('Échéance', 'Due date')}</span>
              <input className="input" type="date" value={draft.dueDate} disabled={!canEditDetails} onChange={(e) => set('dueDate', e.target.value)} />
            </label>
            <label className="field">
              <span>Rock</span>
              <select className="select" value={draft.rockId} disabled={!canEditDetails} onChange={(e) => set('rockId', e.target.value)}>
                <option value="">{t('— Aucun (non rattachée) —', '— None (unlinked) —')}</option>
                {rockOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {`${r.title} (${quarterLabel(r.quarter)})`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="stack" style={{ gap: 12 }}>
          <h4 className="rock-section-title">{t('Avancement', 'Progress')}</h4>
          <div className="form-grid">
            <label className="field">
              <span>{t('Statut', 'Status')}</span>
              <select
                className="select"
                value={draft.status}
                disabled={!canAdvance}
                onChange={(e) => {
                  const status = e.target.value as PriorityStatus;
                  setDraft((d) => ({ ...d, status, progress: status === 'completed' ? 100 : d.progress }));
                }}
              >
                {(Object.keys(STATUS_LABEL) as PriorityStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {t(STATUS_LABEL[s])}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('Santé', 'Health')}</span>
              <select className="select" value={draft.health} disabled={!canAdvance} onChange={(e) => set('health', e.target.value as Health)}>
                {(Object.keys(HEALTH_LABEL) as Health[]).map((h) => (
                  <option key={h} value={h}>
                    {t(HEALTH_LABEL[h])}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>{t('Avancement', 'Progress')} : {draft.status === 'completed' ? 100 : draft.progress} %</span>
            <div className="row" style={{ gap: 12 }}>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                style={{ flex: 1 }}
                value={draft.status === 'completed' ? 100 : draft.progress}
                disabled={!canAdvance || draft.status === 'completed'}
                onChange={(e) => set('progress', normalizeProgress(draft.status, Number(e.target.value)))}
              />
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                style={{ width: 90 }}
                aria-label={t('Avancement en %', 'Progress in %')}
                value={draft.status === 'completed' ? 100 : draft.progress}
                disabled={!canAdvance || draft.status === 'completed'}
                onChange={(e) => set('progress', normalizeProgress(draft.status, Number(e.target.value) || 0))}
              />
            </div>
          </label>
        </section>

        <section className="stack" style={{ gap: 12 }}>
          <h4 className="rock-section-title">{t('Blocage', 'Blocking')}</h4>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.blocked}
              disabled={!canBlock}
              onChange={(e) => setDraft((d) => ({ ...d, blocked: e.target.checked, blockedById: e.target.checked ? d.blockedById : '', blockedNote: e.target.checked ? d.blockedNote : '' }))}
            />
            {t('Bloquée — en attente d’une autre priorité', 'Blocked — waiting for another priority')}
          </label>
          {draft.blocked && (
            <div className="form-grid">
              <label className="field">
                <span>{t('Attend la priorité', 'Waiting for priority')}</span>
                <select className="select" value={draft.blockedById} disabled={!canBlock} onChange={(e) => set('blockedById', e.target.value)}>
                  <option value="">{t('— Choisir —', '— Choose —')}</option>
                  {blockerOptions.map((x) => (
                    <option key={x.id} value={x.id}>
                      {`${x.title} (${userName(x.ownerId ?? undefined)})`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t('Précision', 'Note')}</span>
                <input className="input" value={draft.blockedNote} maxLength={500} disabled={!canBlock} onChange={(e) => set('blockedNote', e.target.value)} />
              </label>
            </div>
          )}
        </section>

        <PriorityNotes priority={p} people={people} />
      </div>
    </Modal>
  );
}
