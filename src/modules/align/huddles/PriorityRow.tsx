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
  huddleId: string;
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
    <div className="align-prio-row">
      <div className="align-prio-main">
        <div className="row row-wrap" style={{ gap: 8 }}>
          <HealthDot health={p.health} className="align-dot" />
          <strong>{p.title}</strong>
          <span className="badge">{STATUS_LABEL[p.status][lang]}</span>
          {blocked && (
            <span className="badge badge-warn" title={p.blockedNote || undefined}>
              {t('Bloquée', 'Blocked')}
              {blockerTitle ? ` · ${t('par', 'by')} ${blockerTitle}` : ''}
            </span>
          )}
          {overdue && <span className="badge badge-err">{t('En retard', 'Overdue')}</span>}
        </div>

        <div className="small muted" style={{ marginTop: 2 }}>
          {rockTitle ?? t('Sans Rock', 'No Rock')} · {t('échéance', 'due')} {p.dueDate ? fmtDay(p.dueDate, lang) : t('aucune', 'none')}
          {blocked && p.blockedNote ? ` · ${p.blockedNote}` : ''}
        </div>

        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <ProgressBar pct={pct} style={{ flex: 1 }} />
          <span className="small mono" style={{ minWidth: 40, textAlign: 'right' }}>
            {pct} %
          </span>
        </div>

        {canEdit && (
          <div className="row row-wrap" style={{ gap: 8, marginTop: 8 }}>
            <label className="small row" style={{ gap: 4 }}>
              {t('Santé', 'Health')}
              <select className="select" style={{ width: 150 }} disabled={busy} value={p.health} onChange={(e) => void patch({ health: e.target.value as Health })}>
                {(Object.keys(HEALTH_LABEL) as Health[]).map((h) => (
                  <option key={h} value={h}>
                    {HEALTH_LABEL[h][lang]}
                  </option>
                ))}
              </select>
            </label>
            <label className="small row" style={{ gap: 4 }}>
              {t('Statut', 'Status')}
              <select
                className="select"
                style={{ width: 150 }}
                disabled={busy}
                value={p.status}
                onChange={(e) => {
                  const status = e.target.value as PriorityStatus;
                  // Completed means 100 %: the stored progress agrees with the status.
                  void patch(status === 'completed' ? { status, progress: 100 } : { status });
                }}
              >
                {(Object.keys(STATUS_LABEL) as PriorityStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s][lang]}
                  </option>
                ))}
              </select>
            </label>
            <label className="small row" style={{ gap: 4 }}>
              {t('Avancement', 'Progress')}
              <input
                key={p.progress}
                className="input"
                type="number"
                min={0}
                max={100}
                step={5}
                style={{ width: 84 }}
                disabled={busy}
                defaultValue={p.progress}
                aria-label={t('Avancement (%)', 'Progress (%)')}
                onBlur={(e) => {
                  const v = normalizeProgress(p.status, Number(e.target.value) || 0);
                  e.target.value = String(v);
                  if (v !== p.progress) void patch({ progress: v });
                }}
              />
              %
            </label>
          </div>
        )}
      </div>

      <div className="align-prio-side">
        <button
          className="btn btn-sm"
          onClick={() => setMode(mode === 'add' ? 'none' : 'add')}
          aria-expanded={mode === 'add'}
        >
          <MessageSquarePlus size={14} /> {t('Suivi', 'Follow-up')}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setMode(mode === 'list' ? 'none' : 'list')}
          aria-expanded={mode === 'list'}
          title={t('Voir les suivis', 'Show follow-ups')}
        >
          <ListChecks size={14} /> {openCount} {t('ouvert(s)', 'open')}
        </button>
      </div>

      {mode === 'add' && (
        <FollowUpForm priority={p} huddleId={huddleId} people={people} userName={userName} onDone={() => setMode('none')} />
      )}

      {mode === 'list' && (
        <div className="align-followup-list">
          {followups.length === 0 && <div className="small muted">{t('Aucun suivi pour cette priorité.', 'No follow-up for this priority.')}</div>}
          {followups.map((n) => (
            <FollowUpItem key={n.id} note={n} userName={userName} />
          ))}
        </div>
      )}
    </div>
  );
}
