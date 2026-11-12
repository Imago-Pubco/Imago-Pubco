import { useMemo, useState } from 'react';
import { ListChecks, Pencil, Plus } from 'lucide-react';
import { useToast, Empty } from '@/components/ui';
import { useI18n } from '@/i18n';
import { counted, fmtHours, isLate } from './lib';
import { pmTasks } from './stores';
import { TASK_STATUS } from './schemas';
import type { PmTask, Project, TaskStatus, TimeEntry } from './schemas';
import { TaskModal } from './Tasks.modal';
import { Badge, dateLabel, rateLabel } from './ProjectDetail.ui';
import { TASK_PRIORITY_BADGE, TASK_PRIORITY_LABEL, TASK_STATUS_BADGE, TASK_STATUS_LABEL, bi } from './ProjectDetail.labels';

type StatusFilter = 'all' | TaskStatus;

/** Tasks of the project: quick status change, add/edit, estimate vs booked hours. Rates only for managers. */
export function TasksTab({
  project,
  tasks,
  entries,
  canWrite,
  canRates,
  nameOf,
}: {
  project: Project;
  tasks: PmTask[];
  entries: TimeEntry[];
  canWrite: boolean;
  canRates: boolean;
  nameOf: (id?: string) => string;
}) {
  const { t, lang } = useI18n();
  const notify = useToast();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [modal, setModal] = useState<{ task?: PmTask } | null>(null);

  // Hours booked per task (rejected time does not count).
  const booked = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) if (e.taskId && counted(e)) m.set(e.taskId, (m.get(e.taskId) ?? 0) + e.hours);
    return m;
  }, [entries]);

  const visible = useMemo(
    () =>
      tasks
        .filter((x) => filter === 'all' || x.status === filter)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, lang)),
    [tasks, filter, lang],
  );

  const setStatus = async (task: PmTask, status: TaskStatus) => {
    try {
      await pmTasks.update(task.id, { status });
    } catch (e) {
      notify((e as Error).message, 'err');
    }
  };

  const colCount = canRates ? 8 : 7;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row row-wrap" style={{ alignItems: 'center', gap: 12 }}>
        <label className="field" style={{ minWidth: 180 }}>
          <span>{t('Statut', 'Status')}</span>
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as StatusFilter)}>
            <option value="all">{t('Tous les statuts', 'All statuses')}</option>
            {TASK_STATUS.map((s) => (
              <option key={s} value={s}>
                {bi(TASK_STATUS_LABEL[s], lang)}
              </option>
            ))}
          </select>
        </label>
        <div className="spacer" />
        {canWrite && (
          <button className="btn btn-primary" onClick={() => setModal({})}>
            <Plus size={16} /> {t('Tâche', 'Task')}
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="card">
          <Empty icon={<ListChecks size={40} />} title={t('Aucune tâche pour ce projet', 'No tasks on this project')}>
            {canWrite ? t('Ajoutez la première tâche avec le bouton ci-dessus.', 'Add the first task with the button above.') : null}
          </Empty>
        </div>
      ) : visible.length === 0 ? (
        <p className="muted">{t('Aucune tâche avec ce statut.', 'No task with this status.')}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Tâche', 'Task')}</th>
                <th>{t('Assignés', 'Assignees')}</th>
                <th>{t('Statut', 'Status')}</th>
                <th>{t('Priorité', 'Priority')}</th>
                <th>{t('Échéance', 'Due')}</th>
                <th className="num">{t('Estimé / réel', 'Estimate / actual')}</th>
                {canRates && <th className="num">{t('Tarif', 'Rate')}</th>}
                <th aria-label={t('Actions', 'Actions')} />
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => {
                const late = isLate(task);
                const used = booked.get(task.id) ?? 0;
                const over = task.estimateHours !== null && used > task.estimateHours;
                return (
                  <tr key={task.id}>
                    <td>
                      <strong>{task.name}</strong>
                    </td>
                    <td className="small">{task.assigneeIds.length ? task.assigneeIds.map((id) => nameOf(id)).join(', ') : '—'}</td>
                    <td>
                      <select
                        className="select input-sm"
                        value={task.status}
                        disabled={!canWrite}
                        aria-label={t('Statut de la tâche', 'Task status')}
                        onChange={(e) => setStatus(task, e.target.value as TaskStatus)}
                      >
                        {TASK_STATUS.map((s) => (
                          <option key={s} value={s}>
                            {bi(TASK_STATUS_LABEL[s], lang)}
                          </option>
                        ))}
                      </select>
                      <div style={{ marginTop: 4 }}>
                        <Badge className={TASK_STATUS_BADGE[task.status]}>{bi(TASK_STATUS_LABEL[task.status], lang)}</Badge>
                      </div>
                    </td>
                    <td>
                      <Badge className={TASK_PRIORITY_BADGE[task.priority]}>{bi(TASK_PRIORITY_LABEL[task.priority], lang)}</Badge>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {dateLabel(task.dueDate, lang)}
                      {late && (
                        <div>
                          <Badge className="badge-err">{t('En retard', 'Late')}</Badge>
                        </div>
                      )}
                    </td>
                    <td className="num" style={{ whiteSpace: 'nowrap', color: over ? 'var(--err)' : undefined }}>
                      {task.estimateHours === null ? '—' : fmtHours(task.estimateHours)} / {fmtHours(used)}
                    </td>
                    {canRates && (
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        {task.rate > 0 ? rateLabel(task.rate, lang) : t('Non facturable', 'Non-billable')}
                      </td>
                    )}
                    <td className="num">
                      {canWrite && (
                        <button className="btn btn-ghost btn-icon btn-sm" aria-label={t('Modifier la tâche', 'Edit task')} onClick={() => setModal({ task })}>
                          <Pencil size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={colCount} className="small faint">
                  {t(`${visible.length} tâche(s) affichée(s)`, `${visible.length} task(s) shown`)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {modal && <TaskModal task={modal.task} projectId={project.id} onClose={() => setModal(null)} />}
    </div>
  );
}
