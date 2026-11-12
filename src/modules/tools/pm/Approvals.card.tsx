import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Info, Undo2, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Avatar } from '@/modules/admin/pages/Users';
import { periodLabel } from '../lib';
import { fmtHours } from './lib';
import type { PmTask, Project, TimeEntry } from './schemas';
import { dayLabel, hoursText } from './Timesheet.helpers';
import type { PersonWeek } from './Approvals.helpers';

interface CardProps {
  group: PersonWeek;
  mode: 'waiting' | 'approved';
  meId: string;
  name: string;
  projectById: Map<string, Project>;
  taskById: Map<string, PmTask>;
  busy: boolean;
  onApprove: (list: TimeEntry[]) => void;
  onReject: (list: TimeEntry[], label: string) => void;
  onUnlock: (list: TimeEntry[]) => void;
}

/** One person's week: totals, the actions for the whole week, and the entries (collapsible). */
export function PersonWeekCard({ group, mode, meId, name, projectById, taskById, busy, onApprove, onReject, onUnlock }: CardProps) {
  const { t, lang, fmtDate } = useI18n();
  const [open, setOpen] = useState(false);
  const own = group.userId === meId;
  const label = `${name} · ${periodLabel(group.week, 'weekly', lang)}`;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <Avatar name={name} size={32} />
          <div style={{ minWidth: 0 }}>
            <h3 style={{ overflowWrap: 'anywhere' }}>{name}</h3>
            <div className="small muted">
              {periodLabel(group.week, 'weekly', lang)}
              {mode === 'approved' && group.reviewedAt && ` · ${t('approuvé le', 'approved on')} ${fmtDate(group.reviewedAt)}`}
            </div>
          </div>
        </div>
        <div className="row row-wrap" style={{ gap: 8 }}>
          <span className="badge">{fmtHours(group.hours)}</span>
          <span className="badge">{t(`${group.entries.length} entrée(s)`, `${group.entries.length} entries`)}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? t('Masquer', 'Hide') : t('Détail', 'Details')}
          </button>
        </div>
      </div>
      <div className="card-pad">
        <div className="row row-wrap" style={{ gap: 8, alignItems: 'center' }}>
          {own ? (
            <p className="small" style={{ margin: 0, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={14} />
              {mode === 'waiting'
                ? t('Vous ne pouvez pas approuver votre propre temps.', 'You cannot approve your own time.')
                : t('Vous ne pouvez pas annuler l’approbation de votre propre temps.', 'You cannot cancel the approval of your own time.')}
            </p>
          ) : mode === 'waiting' ? (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => onApprove(group.entries)} disabled={busy}>
                <Check size={14} /> {t('Approuver tout', 'Approve all')}
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => onReject(group.entries, label)} disabled={busy}>
                <X size={14} /> {t('Rejeter', 'Reject')}
              </button>
            </>
          ) : (
            <button className="btn btn-sm" onClick={() => onUnlock(group.entries)} disabled={busy}>
              <Undo2 size={14} /> {t('Annuler l’approbation', 'Cancel approval')}
            </button>
          )}
        </div>

        {open && (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Date', 'Date')}</th>
                  <th>{t('Projet', 'Project')}</th>
                  <th>{t('Tâche', 'Task')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Heures', 'Hours')}</th>
                  <th>{t('Facturation', 'Billing')}</th>
                  <th>{t('Note', 'Note')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {group.entries.map((e) => {
                  const p = projectById.get(e.projectId);
                  const task = e.taskId ? taskById.get(e.taskId) : undefined;
                  return (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{dayLabel(e.date, lang)}</td>
                      <td style={{ overflowWrap: 'anywhere' }}>{p ? `${p.code} · ${p.name}` : '—'}</td>
                      <td style={{ overflowWrap: 'anywhere' }}>{task?.name ?? t('Sans tâche', 'No task')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{hoursText(e.hours)}</td>
                      <td>{e.billable ? <span className="badge badge-ok">{t('Facturable', 'Billable')}</span> : <span className="badge">{t('Non facturable', 'Non-billable')}</span>}</td>
                      <td style={{ maxWidth: 260, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.note}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {!own && mode === 'waiting' && (
                          <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                            <button className="btn btn-sm" onClick={() => onApprove([e])} disabled={busy}>
                              <Check size={14} /> {t('Approuver', 'Approve')}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => onReject([e], `${label} · ${dayLabel(e.date, lang)}`)} disabled={busy}>
                              <X size={14} /> {t('Rejeter', 'Reject')}
                            </button>
                          </div>
                        )}
                        {!own && mode === 'approved' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => onUnlock([e])} disabled={busy}>
                            <Undo2 size={14} /> {t('Annuler', 'Cancel')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
