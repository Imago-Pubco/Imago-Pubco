import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Inbox } from 'lucide-react';
import { Empty } from '@/components/ui';
import { useI18n } from '@/i18n';
import { fmtHours, isLate, parseDate, pct, sum } from './lib';
import type { PmTask, Project, TimeEntry } from './schemas';

export interface TaskItem {
  task: PmTask;
  project: Project | undefined;
}
export interface AttentionReason {
  kind: 'over' | 'warn' | 'late';
  pct: number | null;
}
export interface AttentionItem {
  project: Project;
  reasons: AttentionReason[];
}
export interface DayItem {
  date: string;
  hours: number;
  capacity: number;
}
export interface RejectItem {
  entry: TimeEntry;
  project: Project | undefined;
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>{title}</h3>
        {action}
      </div>
      <div className="card-pad">{children}</div>
    </section>
  );
}

function ProjectLink({ project }: { project: Project | undefined }) {
  if (!project) return <span className="faint">—</span>;
  return <Link to={`/tools/pm/projects/${project.id}`}>{`${project.code} · ${project.name}`}</Link>;
}

/** My open tasks, earliest due first; late ones in red. */
export function UpcomingTasks({ items, today }: { items: TaskItem[]; today: string }) {
  const { t } = useI18n();
  return (
    <Card title={t('Mes tâches à venir', 'My upcoming tasks')} action={<Link className="btn btn-sm btn-ghost" to="/tools/pm/tasks">{t('Toutes les tâches', 'All tasks')}</Link>}>
      {items.length === 0 ? (
        <Empty icon={<CheckSquare size={32} />} title={t('Aucune tâche ouverte', 'No open tasks')}>
          {t('Les tâches qui vous sont assignées apparaîtront ici.', 'Tasks assigned to you will appear here.')}
        </Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Tâche', 'Task')}</th>
                  <th>{t('Projet', 'Project')}</th>
                  <th>{t('Échéance', 'Due')}</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 10).map(({ task, project }) => {
                  const late = isLate(task, today);
                  return (
                    <tr key={task.id}>
                      <td>
                        {task.name}
                        {late && (
                          <span className="badge badge-err" style={{ marginLeft: 8 }}>
                            {t('En retard', 'Late')}
                          </span>
                        )}
                      </td>
                      <td>
                        <ProjectLink project={project} />
                      </td>
                      <td style={late ? { color: 'var(--err)', fontWeight: 600 } : undefined}>{task.dueDate || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {items.length > 10 && (
            <p className="small faint" style={{ margin: '10px 0 0' }}>
              {t(`+ ${items.length - 10} autre(s) tâche(s)`, `+ ${items.length - 10} more task(s)`)}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function Reason({ r }: { r: AttentionReason }) {
  const { t } = useI18n();
  if (r.kind === 'late') return <span className="badge badge-err">{t('Fin prévue dépassée', 'Planned end passed')}</span>;
  const value = r.pct === null ? '' : pct(r.pct);
  if (r.kind === 'over') {
    return (
      <span className="badge badge-err">
        {t('Budget dépassé', 'Over budget')} · {value}
      </span>
    );
  }
  return (
    <span className="badge badge-warn">
      {t('Budget à', 'Budget at')} {value}
    </span>
  );
}

/** Projects over or near budget, or past their planned end date. */
export function AttentionProjects({ items }: { items: AttentionItem[] }) {
  const { t } = useI18n();
  return (
    <Card title={t('Projets nécessitant attention', 'Projects needing attention')}>
      {items.length === 0 ? (
        <Empty icon={<CheckSquare size={32} />} title={t('Rien à signaler', 'Nothing to flag')}>
          {t('Aucun projet n’est près de son budget ni en retard.', 'No project is near its budget or late.')}
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Projet', 'Project')}</th>
                <th>{t('Motif', 'Reason')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ project, reasons }) => (
                <tr key={project.id}>
                  <td>
                    <ProjectLink project={project} />
                  </td>
                  <td>
                    <div className="row row-wrap" style={{ gap: 6 }}>
                      {reasons.map((r) => (
                        <Reason key={r.kind} r={r} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Hours per day of the current week as CSS bars; a dashed line marks the day's capacity. */
export function WeekBars({ days }: { days: DayItem[] }) {
  const { t, lang } = useI18n();
  const loc = lang === 'fr' ? 'fr-CA' : 'en-CA';
  const max = Math.max(1, ...days.map((d) => Math.max(d.hours, d.capacity)));
  const worked = sum(days.map((d) => d.hours));
  const capacity = sum(days.map((d) => d.capacity));
  return (
    <Card title={t('Ma semaine', 'My week')} action={<Link className="btn btn-sm btn-ghost" to="/tools/pm/timesheet">{t('Feuille de temps', 'Timesheet')}</Link>}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180 }}>
        {days.map((d) => {
          const over = d.capacity > 0 && d.hours > d.capacity;
          const name = parseDate(d.date).toLocaleDateString(loc, { weekday: 'short' });
          return (
            <div key={d.date} style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ position: 'relative', flex: 1, width: '100%' }}>
                {d.capacity > 0 && (
                  <div
                    title={t(`Capacité : ${fmtHours(d.capacity)}`, `Capacity: ${fmtHours(d.capacity)}`)}
                    style={{ position: 'absolute', left: 0, right: 0, bottom: `${(d.capacity / max) * 100}%`, borderTop: '2px dashed var(--text-3)' }}
                  />
                )}
                <div
                  title={fmtHours(d.hours)}
                  style={{
                    position: 'absolute',
                    left: '20%',
                    right: '20%',
                    bottom: 0,
                    height: `${(d.hours / max) * 100}%`,
                    minHeight: d.hours > 0 ? 3 : 0,
                    background: over ? 'var(--warn)' : 'var(--accent)',
                    borderRadius: '4px 4px 0 0',
                  }}
                />
              </div>
              <div className="small" style={{ textTransform: 'capitalize' }}>
                {name}
              </div>
              <div className="small faint mono">{d.hours > 0 ? fmtHours(d.hours) : '—'}</div>
            </div>
          );
        })}
      </div>
      <p className="small faint" style={{ margin: '12px 0 0' }}>
        {t(`Total : ${fmtHours(worked)} sur ${fmtHours(capacity)} de capacité`, `Total: ${fmtHours(worked)} of ${fmtHours(capacity)} capacity`)}
      </p>
    </Card>
  );
}

/** My time the approver sent back, with the reason. */
export function Rejections({ items }: { items: RejectItem[] }) {
  const { t } = useI18n();
  return (
    <Card title={t('Rejets à corriger', 'Rejections to fix')} action={<Link className="btn btn-sm btn-ghost" to="/tools/pm/timesheet">{t('Corriger', 'Fix')}</Link>}>
      {items.length === 0 ? (
        <Empty icon={<Inbox size={32} />} title={t('Aucun rejet', 'No rejections')}>
          {t('Le temps rejeté par un approbateur apparaîtra ici avec la raison.', 'Time rejected by an approver will appear here with the reason.')}
        </Empty>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.slice(0, 10).map(({ entry, project }) => (
            <li key={entry.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="row row-wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
                <strong>{`${entry.date} · ${fmtHours(entry.hours)}`}</strong>
                <span className="small">
                  <ProjectLink project={project} />
                </span>
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                <span className="faint">{t('Raison : ', 'Reason: ')}</span>
                {entry.reviewNote || t('aucune raison indiquée', 'no reason given')}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
