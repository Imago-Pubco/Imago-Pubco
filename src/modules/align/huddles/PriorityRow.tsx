import { useState } from 'react';
import { ListChecks, MessageSquarePlus } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { useToast } from '@/components/ui';
import { HEALTH_LABEL, STATUS_LABEL, normalizeProgress, priorityPct } from '../lib';
import { alignPriorities } from '../stores';
import type { AlignNote, AlignPriority, Health, PriorityStatus } from '../schemas';
import { HealthDot, ProgressBar, errorText } from '../components/RockShared';
import { fmtDay } from './huddleLib';

/** Fields a huddle may change on a priority. Status and progress always travel together (see normalizeProgress). */
type PriorityPatch = Partial<Pick<AlignPriority, 'status' | 'health' | 'progress'>>;
import { FollowUpForm, FollowUpItem } from './FollowUps';

export interface PriorityRowProps {
  priority: AlignPriority;
  rockTitle?: string;
  blockerTitle?: string;
  blocked: boolean;
  overdue: boolean;
  /** All follow-ups of this priority (open and done). */
  followups: AlignNote[];
  huddleId: string | null;
  people: User[];
  userName: (id?: string) => string;
}

/** A priority line in the huddle: status, health, progress, blocked/overdue flags, and quick follow-up. */
export function PriorityRow({ priority: p, rockTitle, blockerTitle, blocked, overdue, followups, huddleId, people, userName }: PriorityRowProps) {
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<'none' | 'add' | 'list'>('none');
  const [busy, setBusy] = useState(false);

  const canEdit = p.ownerId === user!.id || can('align.priorities.manage');
  const openCount = followups.filter((n) => !n.done).length;
  const pct = priorityPct(p);

  async function patch(fields: PriorityPatch) {
    setBusy(true);
    try {
      await alignPriorities.update(p.id, fields);
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="align-prow">
      <div className="align-prow-line">
        <HealthDot health={p.health} className="align-dot" />
        <span className="align-prow-title" title={p.title}>
          {p.title}
        </span>
        {blocked && (
          <span className="badge badge-warn" title={[blockerTitle, p.blockedNote].filter(Boolean).join(' — ') || undefined}>
            {t('Bloquée', 'Blocked')}
          </span>
        )}
        {overdue && <span className="badge badge-err">{t('En retard', 'Overdue')}</span>}
        <span className="align-prow-ctrls">
          {canEdit ? (
            <>
              <select className="select align-mini" title={t('Santé', 'Health')} aria-label={t('Santé', 'Health')} disabled={busy} value={p.health} onChange={(e) => void patch({ health: e.target.value as Health })}>
                {(Object.keys(HEALTH_LABEL) as Health[]).map((h) => (
                  <option key={h} value={h}>
                    {HEALTH_LABEL[h][lang]}
                  </option>
                ))}
              </select>
              <select
                className="select align-mini"
                title={t('Statut', 'Status')}
                aria-label={t('Statut', 'Status')}
                disabled={busy}
                value={p.status}
                onChange={(e) => {
                  const status = e.target.value as PriorityStatus;
                  // Completed means 100 %: the stored progress agrees with the status.
                  void patch(status === 'completed' ? { status, progress: 100 } : { status });
                }}
              >
                {(Object.keys(STATUS_LABEL) as PriorityStatus[]).map((st) => (
                  <option key={st} value={st}>
                    {STATUS_LABEL[st][lang]}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className="badge">{STATUS_LABEL[p.status][lang]}</span>
          )}
          <ProgressBar pct={pct} style={{ width: 64 }} />
          {canEdit ? (
            <span className="align-pct">
              <input
                key={p.progress}
                className="input align-mini-num"
                type="number"
                min={0}
                max={100}
                step={5}
                disabled={busy}
                defaultValue={pct}
                aria-label={t('Avancement (%)', 'Progress (%)')}
                onBlur={(e) => {
                  const v = normalizeProgress(p.status, Number(e.target.value) || 0);
                  e.target.value = String(v);
                  if (v !== p.progress) void patch({ progress: v });
                }}
              />
              %
            </span>
          ) : (
            <span className="small mono">{pct} %</span>
          )}
          <button
            className={`btn btn-ghost btn-sm align-prow-fu${mode !== 'none' ? ' on' : ''}`}
            onClick={() => setMode(mode === 'none' ? (followups.length ? 'list' : 'add') : 'none')}
            aria-expanded={mode !== 'none'}
            title={t('Suivis', 'Follow-ups')}
          >
            <ListChecks size={14} /> {openCount}
          </button>
        </span>
      </div>
      <div className="align-prow-meta small muted">
        {rockTitle ?? t('Sans Rock', 'No Rock')} · {t('échéance', 'due')} {p.dueDate ? fmtDay(p.dueDate, lang) : t('aucune', 'none')}
        {blocked && p.blockedNote ? ` · ${p.blockedNote}` : ''}
      </div>

      {mode === 'list' && (
        <div className="align-followup-list">
          {followups.map((n) => (
            <FollowUpItem key={n.id} note={n} userName={userName} />
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => setMode('add')}>
            <MessageSquarePlus size={14} /> {t('Ajouter un suivi', 'Add a follow-up')}
          </button>
        </div>
      )}

      {mode === 'add' && (
        <FollowUpForm priority={p} huddleId={huddleId} people={people} userName={userName} onDone={() => setMode('none')} />
      )}

    </div>
  );
}
