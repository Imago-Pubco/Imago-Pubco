import { useState, type DragEvent } from 'react';
import { Avatar } from '@/modules/admin/pages/Users';
import { useI18n } from '@/i18n';
import { isLate } from './lib';
import type { PmTask, Project, TaskStatus } from './schemas';
import { fmtDay, PRIORITY_BADGE, PRIORITY_LABEL, STATUS_LABEL, STATUS_ORDER } from './Tasks.util';

export interface TaskBoardProps {
  /** Tasks already filtered by the page. */
  tasks: PmTask[];
  /** Columns to show (the status filter decides which ones). */
  statuses: readonly TaskStatus[];
  projectsById: Map<string, Project>;
  nameOf: (id: string) => string;
  canEdit: (task: PmTask) => boolean;
  onOpen: (task: PmTask) => void;
  /** Called when a card is dropped on a column or its status select changes. */
  onMove: (task: PmTask, status: TaskStatus) => void;
}

/** Kanban board: one column per status. Cards move by drag and drop, or with the status select (keyboard, touch). */
export function TaskBoard({ tasks, statuses, projectsById, nameOf, canEdit, onOpen, onMove }: TaskBoardProps) {
  const { t } = useI18n();
  const [over, setOver] = useState<TaskStatus | null>(null);
  const columns = STATUS_ORDER.filter((s) => statuses.includes(s));

  const drop = (e: DragEvent<HTMLDivElement>, status: TaskStatus) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('text/plain');
    const task = tasks.find((x) => x.id === id);
    if (task && task.status !== status && canEdit(task)) onMove(task, status);
  };

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6, alignItems: 'flex-start' }}>
      {columns.map((status) => {
        const colTasks = tasks.filter((x) => x.status === status).sort((a, b) => a.order - b.order || (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
        const isOver = over === status;
        return (
          <div
            key={status}
            className="card"
            aria-label={t(STATUS_LABEL[status])}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (over !== status) setOver(status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
            }}
            onDrop={(e) => drop(e, status)}
            style={{
              flex: '1 0 250px',
              minWidth: 250,
              maxWidth: 360,
              minHeight: 160,
              padding: 10,
              background: isOver ? 'var(--accent-soft)' : 'var(--bg-sunken)',
              borderColor: isOver ? 'var(--accent)' : undefined,
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            <div className="row" style={{ justifyContent: 'space-between', padding: '4px 4px 10px' }}>
              <strong style={{ fontSize: 14 }}>{t(STATUS_LABEL[status])}</strong>
              <span className="badge">{colTasks.length}</span>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {colTasks.map((task) => (
                <TaskCard key={task.id} task={task} project={projectsById.get(task.projectId)} nameOf={nameOf} editable={canEdit(task)} onOpen={onOpen} onMove={onMove} />
              ))}
              {!colTasks.length && (
                <div className="small faint" style={{ padding: '18px 6px', textAlign: 'center' }}>
                  {t('Aucune tâche', 'No tasks')}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({
  task,
  project,
  nameOf,
  editable,
  onOpen,
  onMove,
}: {
  task: PmTask;
  project: Project | undefined;
  nameOf: (id: string) => string;
  editable: boolean;
  onOpen: (task: PmTask) => void;
  onMove: (task: PmTask, status: TaskStatus) => void;
}) {
  const { t, lang } = useI18n();
  const late = isLate(task);

  const onDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className="card"
      draggable={editable}
      onDragStart={onDragStart}
      style={{ padding: 10, cursor: editable ? 'grab' : 'default', background: 'var(--bg-elev)' }}
    >
      <button
        type="button"
        onClick={() => onOpen(task)}
        style={{ all: 'unset', cursor: 'pointer', display: 'block', fontWeight: 600, fontSize: 14, lineHeight: 1.3, marginBottom: 6, color: 'var(--text-1)' }}
      >
        {task.name}
      </button>
      <div className="row row-wrap" style={{ gap: 6, marginBottom: 8 }}>
        {project && <span className="mono small faint">{project.code}</span>}
        <span className={`badge ${PRIORITY_BADGE[task.priority]}`}>{t(PRIORITY_LABEL[task.priority])}</span>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <span className="small" style={{ color: late ? 'var(--err)' : 'var(--text-2)', fontWeight: late ? 600 : undefined }}>
          {task.dueDate ? `${late ? t('En retard · ', 'Late · ') : ''}${fmtDay(task.dueDate, lang)}` : t('Sans échéance', 'No due date')}
        </span>
        <span className="row">
          {task.assigneeIds.slice(0, 3).map((id) => (
            <span key={id} title={nameOf(id)} style={{ marginLeft: -6 }}>
              <Avatar name={nameOf(id)} size={22} />
            </span>
          ))}
        </span>
      </div>
      <label className="small faint" style={{ display: 'block', marginTop: 8 }}>
        <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {t('Statut', 'Status')}
        </span>
        <select
          className="select"
          style={{ height: 30, fontSize: 13, marginTop: 4 }}
          value={task.status}
          disabled={!editable}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => onMove(task, e.target.value as TaskStatus)}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {t(STATUS_LABEL[s])}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
