import { useMemo, useState, type FormEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import { MemberAvatar } from '../components/WeekKit';
import { errorText } from '../components/RockShared';
import type { AlignPriority, AlignTask, Rock, TaskKind } from '../schemas';
import { tasks } from '../stores';
import { TASK_KIND_LABEL, canEditTask, sortTasks } from './taskLib';

export interface TaskListProps {
  /** Already filtered by the page; sorted here with sortTasks. */
  tasks: AlignTask[];
  rockById: Map<string, Rock>;
  priorityById?: Map<string, AlignPriority>;
  /** Show the owner's avatar and name on each line. */
  showOwner?: boolean;
  /** Needed when showOwner. */
  userById?: Map<string, User>;
  emptyText?: string;
}

/** The weekly actions as compact rows: done box, title, kind, linked priority, edit and delete. */
export function TaskList({ tasks: rows, rockById, priorityById, showOwner = false, userById, emptyText }: TaskListProps) {
  const { t } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState<AlignTask | null>(null);
  const canManage = can('align.priorities.manage');
  const sorted = useMemo(() => [...rows].sort(sortTasks), [rows]);

  if (sorted.length === 0) {
    return <div className="small muted">{emptyText ?? t('Aucune action pour cette semaine.', 'No action for this week.')}</div>;
  }

  async function toggle(task: AlignTask, done: boolean) {
    try {
      await tasks.update(task.id, { done });
    } catch (err) {
      toast(errorText(err), 'err');
    }
  }

  async function remove(task: AlignTask) {
    if (!window.confirm(t(`Supprimer l’action « ${task.title} » ? Cette action est irréversible.`, `Delete the action "${task.title}"? This cannot be undone.`))) return;
    try {
      await tasks.remove(task.id);
      toast(t('Action supprimée', 'Action deleted'));
    } catch (err) {
      toast(errorText(err), 'err');
    }
  }

  return (
    <>
      <ul className="align-task-list">
        {sorted.map((task) => {
          const canEdit = canEditTask(task, user!.id, canManage);
          const rock = task.rockId ? rockById.get(task.rockId) : undefined;
          const priority = task.priorityId ? priorityById?.get(task.priorityId) : undefined;
          const owner = userById?.get(task.ownerId);
          return (
            <li key={task.id} className={`align-task-row${task.done ? ' is-done' : ''}`}>
              <input
                type="checkbox"
                checked={task.done}
                disabled={!canEdit}
                onChange={(e) => void toggle(task, e.target.checked)}
                aria-label={t('Fait', 'Done')}
              />
              <div className="align-task-main">
                <div className="row row-wrap" style={{ gap: 8 }}>
                  <span className="align-task-title">{task.title}</span>
                  {task.kind === 'rock' ? (
                    <span className="badge align-task-kind is-rock" title={rock?.title}>
                      {t(TASK_KIND_LABEL.rock)} · {rock?.title ?? t('Rock introuvable', 'Rock not found')}
                    </span>
                  ) : (
                    <span className="badge align-task-kind">{t(TASK_KIND_LABEL.weekly)}</span>
                  )}
                </div>
                {priority && (
                  <div className="small muted">
                    {t('Priorité', 'Priority')} : {priority.title}
                  </div>
                )}
              </div>
              {showOwner && (
                <span className="align-task-owner small">
                  <MemberAvatar user={owner} name={task.ownerId} size={24} />
                  {owner?.displayName ?? task.ownerId}
                </span>
              )}
              {canEdit && (
                <div className="align-task-actions">
                  <button className="btn btn-ghost btn-icon btn-sm" title={t('Modifier', 'Edit')} aria-label={t('Modifier', 'Edit')} onClick={() => setEditing(task)}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn btn-ghost btn-icon btn-sm" title={t('Supprimer', 'Delete')} aria-label={t('Supprimer', 'Delete')} onClick={() => void remove(task)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {editing && (
        <TaskEditModal
          key={editing.id}
          task={editing}
          rockById={rockById}
          priorityById={priorityById ?? new Map()}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

/** Edit an action's title, type, Rock and linked priority. */
function TaskEditModal({
  task,
  rockById,
  priorityById,
  onClose,
}: {
  task: AlignTask;
  rockById: Map<string, Rock>;
  priorityById: Map<string, AlignPriority>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [title, setTitle] = useState(task.title);
  const [kind, setKind] = useState<TaskKind>(task.kind);
  const [rockId, setRockId] = useState(task.rockId ?? '');
  const [priorityId, setPriorityId] = useState(task.priorityId ?? '');
  const [busy, setBusy] = useState(false);

  // Active Rocks, plus the current one even when archived.
  const rockOptions = useMemo(
    () => [...rockById.values()].filter((r) => !r.archived || r.id === task.rockId).sort((a, b) => a.title.localeCompare(b.title)),
    [rockById, task.rockId],
  );
  // The owner's active priorities, plus the current one even when archived.
  const priorityOptions = useMemo(
    () =>
      [...priorityById.values()]
        .filter((p) => p.ownerId === task.ownerId && (!p.archived || p.id === task.priorityId))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [priorityById, task.ownerId, task.priorityId],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value || (kind === 'rock' && !rockId)) return;
    setBusy(true);
    try {
      await tasks.update(task.id, {
        title: value,
        kind,
        rockId: kind === 'rock' ? rockId : null,
        priorityId: priorityId || null,
      });
      toast(t('Action modifiée', 'Action updated'));
      onClose();
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  const formId = `task-edit-${task.id}`;
  return (
    <Modal
      open
      onClose={onClose}
      title={t('Modifier l’action', 'Edit action')}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('Annuler', 'Cancel')}
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={busy || !title.trim() || (kind === 'rock' && !rockId)}>
            {t('Enregistrer', 'Save')}
          </button>
        </>
      }
    >
      <form id={formId} className="stack" onSubmit={submit}>
        <label className="field">
          <span>{t('Titre', 'Title')}</span>
          <input className="input" maxLength={300} required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="field">
          <span>{t('Type', 'Type')}</span>
          <div className="align-task-kind-toggle" role="group" aria-label={t('Type d’action', 'Action type')}>
            <button type="button" className={`btn btn-sm${kind === 'weekly' ? ' btn-primary' : ''}`} aria-pressed={kind === 'weekly'} onClick={() => setKind('weekly')}>
              {t(TASK_KIND_LABEL.weekly)}
            </button>
            <button
              type="button"
              className={`btn btn-sm${kind === 'rock' ? ' btn-primary' : ''}`}
              aria-pressed={kind === 'rock'}
              disabled={rockOptions.length === 0}
              onClick={() => setKind('rock')}
            >
              {t(TASK_KIND_LABEL.rock)}
            </button>
          </div>
        </div>
        {kind === 'rock' && (
          <label className="field">
            <span>Rock</span>
            <select className="select" required value={rockId} onChange={(e) => setRockId(e.target.value)}>
              <option value="">{t('Choisir un Rock…', 'Choose a Rock…')}</option>
              {rockOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                  {r.archived ? ` (${t('archivé', 'archived')})` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>{t('Priorité liée', 'Linked priority')}</span>
          <select className="select" value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
            <option value="">{t('Aucune', 'None')}</option>
            {priorityOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {p.archived ? ` (${t('archivée', 'archived')})` : ''}
              </option>
            ))}
          </select>
        </label>
      </form>
    </Modal>
  );
}
