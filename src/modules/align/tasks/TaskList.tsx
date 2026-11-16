import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { Clock, GripVertical, Mountain, Pencil, Target, Trash2, Zap } from 'lucide-react';
import { useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useAuth } from '@/auth/AuthContext';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import { MemberAvatar } from '../components/WeekKit';
import { errorText } from '../components/RockShared';
import type { AlignPriority, AlignTask, Rock, TaskKind } from '../schemas';
import { tasks } from '../stores';
import { TASK_KIND_LABEL, canEditTask, sortTasks, taskAgeDays, taskSince, taskStaleness } from './taskLib';
import { dragging, moveTask } from './taskDnd';

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
  /** Enables drag and drop: whose list this is (dropping here assigns the action to this person). */
  dropOwnerId?: string;
}

/** The weekly actions as compact rows: done box, title, kind, linked priority, edit and delete. */
export function TaskList({ tasks: rows, rockById, priorityById, showOwner = false, userById, emptyText, dropOwnerId }: TaskListProps) {
  const { t } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState<AlignTask | null>(null);
  const canManage = can('align.priorities.manage');
  const sorted = useMemo(() => [...rows].sort(sortTasks), [rows]);
  const me = user!.id;
  const editable = (x: AlignTask) => canEditTask(x, me, canManage);

  // Drag and drop: where the dragged action would land (before this row id, or 'end').
  const dnd = !!dropOwnerId;
  const [over, setOver] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  useEffect(() => (dnd ? dragging.subscribe((x) => { setIsDragging(!!x); if (!x) setOver(null); }) : undefined), [dnd]);

  const overRow = (e: DragEvent<HTMLLIElement>, idx: number) => {
    if (!dnd || !dragging.get()) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const r = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    setOver(after ? (sorted[idx + 1]?.id ?? 'end') : sorted[idx].id);
  };
  const overEnd = (e: DragEvent<HTMLElement>) => {
    if (!dnd || !dragging.get()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOver('end');
  };
  async function drop(e: DragEvent<HTMLElement>) {
    const task = dragging.get();
    if (!dnd || !task) return;
    e.preventDefault();
    e.stopPropagation();
    const before = over === 'end' || over === null ? null : over;
    setOver(null);
    dragging.set(null);
    if (before === task.id) return;
    try {
      await moveTask(task, dropOwnerId!, before, sorted, editable);
      if (task.ownerId !== dropOwnerId) toast(t('Action réassignée', 'Action reassigned'));
    } catch (err) {
      toast(errorText(err), 'err');
    }
  }

  if (sorted.length === 0) {
    if (dnd && isDragging) {
      return (
        <div className={`align-task-dropzone${over === 'end' ? ' is-over' : ''}`} onDragOver={overEnd} onDragLeave={() => setOver(null)} onDrop={(e) => void drop(e)}>
          {t('Déposer ici', 'Drop here')}
        </div>
      );
    }
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
      <ul
        className={`align-task-list${dnd && isDragging ? ' is-dropping' : ''}${over === 'end' ? ' is-over-end' : ''}`}
        onDragOver={overEnd}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
        }}
        onDrop={(e) => void drop(e)}
      >
        {sorted.map((task, idx) => {
          const canEdit = editable(task);
          const rock = task.rockId ? rockById.get(task.rockId) : undefined;
          const priority = task.priorityId ? priorityById?.get(task.priorityId) : undefined;
          const owner = userById?.get(task.ownerId);
          const stale = taskStaleness(task);
          return (
            <li
              key={task.id}
              className={`align-task-row${task.done ? ' is-done' : ''}${over === task.id ? ' is-over' : ''}${stale !== 'none' ? ` is-stale-${stale}` : ''}`}
              draggable={dnd && canEdit}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', task.title);
                dragging.set(task);
              }}
              onDragEnd={() => dragging.set(null)}
              onDragOver={(e) => overRow(e, idx)}
              onDrop={(e) => void drop(e)}
            >
              {dnd && (
                <span className={`align-task-grip${canEdit ? '' : ' is-off'}`} title={canEdit ? t('Glisser pour déplacer ou réassigner', 'Drag to move or reassign') : undefined} aria-hidden="true">
                  <GripVertical size={14} />
                </span>
              )}
              <input
                type="checkbox"
                checked={task.done}
                disabled={!canEdit}
                onChange={(e) => void toggle(task, e.target.checked)}
                aria-label={t('Fait', 'Done')}
              />
              <span className="align-task-title" title={task.title}>
                {task.title}
              </span>
              {stale === 'alert' && <ElectricFx />}
              {stale !== 'none' && <StaleBadge task={task} level={stale} />}
              {task.kind === 'rock' && (
                <span className="align-chip is-rock" title={`Rock · ${rock?.title ?? ''}`}>
                  <Mountain size={12} /> <span>{rock?.title ?? t('Rock introuvable', 'Rock not found')}</span>
                </span>
              )}
              {priority && (
                <span className="align-chip" title={`${t('Priorité', 'Priority')} · ${priority.title}`}>
                  <Target size={12} /> <span>{priority.title}</span>
                </span>
              )}
              {showOwner && (
                <span className="align-task-owner" title={owner?.displayName ?? task.ownerId}>
                  <MemberAvatar user={owner} name={task.ownerId} size={20} />
                </span>
              )}
              {canEdit && (
                <span className="align-task-actions">
                  <button className="btn btn-ghost btn-icon btn-sm" title={t('Modifier', 'Edit')} aria-label={t('Modifier', 'Edit')} onClick={() => setEditing(task)}>
                    <Pencil size={13} />
                  </button>
                  <button className="btn btn-ghost btn-icon btn-sm" title={t('Supprimer', 'Delete')} aria-label={t('Supprimer', 'Delete')} onClick={() => void remove(task)}>
                    <Trash2 size={13} />
                  </button>
                </span>
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

/** Electric arcs running across a row (actions 3+ weeks old). Decorative only. */
export function ElectricFx() {
  return (
    <span className="align-electric" aria-hidden="true">
      <svg viewBox="0 0 400 40" preserveAspectRatio="none">
        <polyline className="arc arc-1" points="0,22 18,12 34,26 52,8 70,24 88,14 104,30 124,10 140,22 160,6 178,26 196,14 214,28 232,10 250,24 268,12 286,30 304,8 322,22 340,14 358,28 376,10 400,20" />
        <polyline className="arc arc-2" points="0,16 22,28 40,10 60,24 76,6 96,20 116,32 132,14 152,26 170,8 190,22 208,30 226,12 246,26 262,6 282,20 300,32 318,14 338,26 356,8 374,22 400,14" />
        <polyline className="arc arc-3" points="0,30 30,18 52,32 80,12 104,26 130,16 156,34 182,10 206,24 236,8 262,30 290,16 316,28 344,10 372,24 400,26" />
      </svg>
    </span>
  );
}

/** "2 sem." (orange) or ⚡ "3 sem." (red): an action still not done 2 / 3+ weeks after it was first created. */
export function StaleBadge({ task, level }: { task: AlignTask; level: 'warn' | 'alert' }) {
  const { t, fmtDate } = useI18n();
  const days = taskAgeDays(task);
  const weeks = Math.floor(days / 7);
  const n = task.postponed ?? 0;
  const tip = [
    t(`Créée le ${fmtDate(taskSince(task))} (il y a ${days} jours), toujours pas terminée.`, `Created on ${fmtDate(taskSince(task))} (${days} days ago), still not done.`),
    n ? t(`Reportée ${n} fois.`, `Postponed ${n} time(s).`) : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={`align-stale is-${level}`} title={tip} aria-label={tip}>
      {level === 'alert' ? <Zap size={12} /> : <Clock size={12} />}
      {t(`${weeks} sem.`, `${weeks} wk`)}
      {n > 0 && <span className="align-stale-n">×{n}</span>}
    </span>
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
  const [ownerId, setOwnerId] = useState(task.ownerId);
  const [busy, setBusy] = useState(false);
  const { rows: allUsers } = useCollection(users);
  const people = useMemo(() => allUsers.filter((u) => u.active || u.id === task.ownerId).sort((a, b) => a.displayName.localeCompare(b.displayName)), [allUsers, task.ownerId]);

  // Active Rocks, plus the current one even when archived.
  const rockOptions = useMemo(
    () => [...rockById.values()].filter((r) => !r.archived || r.id === task.rockId).sort((a, b) => a.title.localeCompare(b.title)),
    [rockById, task.rockId],
  );
  // The owner's active priorities, plus the current one even when archived.
  const priorityOptions = useMemo(
    () =>
      [...priorityById.values()]
        .filter((p) => p.ownerId === ownerId && (!p.archived || p.id === task.priorityId))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [priorityById, ownerId, task.priorityId],
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
        priorityId: priorityId && priorityOptions.some((p) => p.id === priorityId) ? priorityId : null,
        ...(ownerId !== task.ownerId ? { ownerId } : {}),
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
        <label className="field">
          <span>{t('Assigné à', 'Assigned to')}</span>
          <select className="select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {people.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
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
