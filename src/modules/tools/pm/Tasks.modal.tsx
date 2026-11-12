import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import { Avatar } from '@/modules/admin/pages/Users';
import type { PmTask, TaskStatus } from './schemas';
import {
  dependencyCandidates,
  isOnProject,
  nextOrder,
  type TaskPriority,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  projectPeople,
  STATUS_LABEL,
  STATUS_ORDER,
} from './Tasks.util';
import { pmTasks, projects } from './stores';

export interface TaskModalProps {
  /** Edit this task; omit to create one. */
  task?: PmTask;
  /** Create a task in this project (the project is then fixed). */
  projectId?: string;
  onClose: () => void;
}

/** Form state: numbers are kept as text while typing and parsed on save. */
interface Draft {
  projectId: string;
  name: string;
  description: string;
  assigneeIds: string[];
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string;
  dueDate: string;
  estimate: string;
  rate: string;
  dependsOnId: string;
  order: string;
}

function draftOf(task: PmTask | undefined, projectId: string): Draft {
  if (!task) {
    return { projectId, name: '', description: '', assigneeIds: [], status: 'todo', priority: 'normal', startDate: '', dueDate: '', estimate: '', rate: '0', dependsOnId: '', order: '' };
  }
  return {
    projectId: task.projectId,
    name: task.name,
    description: task.description,
    assigneeIds: [...task.assigneeIds],
    status: task.status,
    priority: task.priority,
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimate: task.estimateHours === null ? '' : String(task.estimateHours),
    rate: String(task.rate),
    dependsOnId: task.dependsOnId ?? '',
    order: String(task.order),
  };
}

/** Create or edit a task. The server checks every write; this form only shows what the person can do. */
export function TaskModal({ task, projectId, onClose }: TaskModalProps) {
  const { t } = useI18n();
  const toast = useToast();
  const { user, can } = useAuth();
  const manage = can('tools.pm.manage');
  const me = user?.id ?? '';
  const { rows: allProjects } = useCollection(projects);
  const { rows: allTasks } = useCollection(pmTasks);
  const { rows: allUsers } = useCollection(users);
  const [draft, setDraft] = useState<Draft>(() => draftOf(task, task ? task.projectId : (projectId ?? '')));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fixedProject = !!task || !!projectId;
  const currentProject = allProjects.find((p) => p.id === draft.projectId);
  // Writable: a new task (the list only offers the person's projects) or a task on a project the person is on.
  const writable = task ? (currentProject ? manage || isOnProject(currentProject, me, manage) : manage) : true;

  const selectableProjects = allProjects
    .filter((p) => p.id === draft.projectId || (p.status !== 'archived' && isOnProject(p, me, manage)))
    .sort((a, b) => a.code.localeCompare(b.code));

  const nameOf = useMemo(() => new Map(allUsers.map((u) => [u.id, u.displayName])), [allUsers]);
  const nameFor = (id: string) => nameOf.get(id) ?? id;
  // Project members and manager, plus anyone already assigned so nothing selected is hidden.
  const people = [...new Set([...projectPeople(currentProject), ...draft.assigneeIds])].sort((a, b) => nameFor(a).localeCompare(nameFor(b)));
  const candidates = dependencyCandidates(allTasks, task, draft.projectId);
  const shownOrder = draft.order !== '' ? draft.order : String(nextOrder(allTasks, draft.projectId));

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const changeProject = (id: string) => {
    const p = allProjects.find((x) => x.id === id);
    const allowed = new Set(projectPeople(p));
    setDraft((d) => ({
      ...d,
      projectId: id,
      assigneeIds: d.assigneeIds.filter((a) => allowed.has(a)),
      dependsOnId: '',
      order: '',
    }));
  };

  const toggleAssignee = (id: string) =>
    setDraft((d) => ({ ...d, assigneeIds: d.assigneeIds.includes(id) ? d.assigneeIds.filter((x) => x !== id) : [...d.assigneeIds, id] }));

  const estimate = draft.estimate.trim() === '' ? null : Number(draft.estimate);
  const rate = Number(draft.rate || 0);
  const order = draft.order === '' ? null : Number(draft.order);

  const problems: string[] = [];
  if (!draft.projectId) problems.push(t('Choisissez un projet.', 'Choose a project.'));
  if (!draft.name.trim()) problems.push(t('Le nom est requis.', 'The name is required.'));
  if (draft.startDate && draft.dueDate && draft.dueDate < draft.startDate) problems.push(t("L'échéance doit être après le début.", 'The due date must be after the start date.'));
  if (estimate !== null && !(Number.isFinite(estimate) && estimate >= 0 && estimate <= 100000)) problems.push(t('Heures estimées invalides.', 'Invalid estimated hours.'));
  if (manage && !(Number.isFinite(rate) && rate >= 0 && rate <= 100000000)) problems.push(t('Taux horaire invalide.', 'Invalid hourly rate.'));
  if (order !== null && !(Number.isInteger(order) && order >= 0 && order <= 100000)) problems.push(t("Ordre invalide.", 'Invalid order.'));
  const canSave = writable && problems.length === 0 && !busy && allProjects.length > 0;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      // Common fields. `rate` is only ever sent by a manager, and never on update by anyone else.
      const common = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        assigneeIds: draft.assigneeIds,
        status: draft.status,
        priority: draft.priority,
        startDate: draft.startDate,
        dueDate: draft.dueDate,
        estimateHours: estimate,
        dependsOnId: draft.dependsOnId || null,
      };
      if (task) {
        // The project of a task never changes (fixed by the server too): no projectId, no stamps.
        const patch = manage ? { ...common, order: order ?? task.order, rate } : { ...common, order: order ?? task.order };
        await pmTasks.update(task.id, patch);
      } else {
        const fresh = order === null ? nextOrder(await pmTasks.list(), draft.projectId) : order;
        await pmTasks.insert({
          id: uid('t_'),
          projectId: draft.projectId,
          ...common,
          order: fresh,
          rate: manage ? rate : 0,
        });
      }
      toast(t('Tâche enregistrée', 'Task saved'));
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!task) return;
    if (!window.confirm(t(`Supprimer la tâche « ${task.name} » ?`, `Delete the task "${task.name}"?`))) return;
    setBusy(true);
    setError(null);
    try {
      await pmTasks.remove(task.id);
      toast(t('Tâche supprimée', 'Task deleted'));
      onClose();
    } catch (e) {
      // The server refuses when time was booked on the task: its message is shown with the advice to close it.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      large
      onClose={onClose}
      title={task ? t('Modifier la tâche', 'Edit task') : t('Nouvelle tâche', 'New task')}
      footer={
        <>
          {task && writable && (
            <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove} disabled={busy}>
              <Trash2 size={15} /> {t('Supprimer', 'Delete')}
            </button>
          )}
          <button className="btn" onClick={onClose}>
            {writable ? t('Annuler', 'Cancel') : t('Fermer', 'Close')}
          </button>
          {writable && (
            <button className="btn btn-primary" onClick={save} disabled={!canSave}>
              {t('Enregistrer', 'Save')}
            </button>
          )}
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        {!writable && (
          <div className="alert alert-info">{t('Lecture seule : vous n’êtes pas sur ce projet.', 'Read only: you are not on this project.')}</div>
        )}
        {!allProjects.length && (
          <div className="alert alert-warn">{t('Aucun projet où vous pouvez créer une tâche.', 'No project where you can create a task.')}</div>
        )}
        {error && (
          <div className="alert alert-err">
            <div>{error}</div>
            <div className="small" style={{ marginTop: 6 }}>
              {t('Vous pouvez plutôt marquer la tâche comme terminée.', 'You can mark the task as done instead.')}{' '}
              <button type="button" className="btn btn-sm" onClick={() => set('status', 'done')} disabled={busy || !writable}>
                {t('Marquer terminée', 'Mark as done')}
              </button>
            </div>
          </div>
        )}

        <div className="form-grid">
          <label className="field span-2">
            <span>{t('Projet', 'Project')}</span>
            <select className="select" value={draft.projectId} disabled={fixedProject || !writable} onChange={(e) => changeProject(e.target.value)}>
              {!draft.projectId && <option value="">{t('— Choisir —', '— Choose —')}</option>}
              {selectableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} – {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field span-2">
            <span>{t('Nom', 'Name')}</span>
            <input className="input" maxLength={200} value={draft.name} disabled={!writable} onChange={(e) => set('name', e.target.value)} />
          </label>

          <label className="field span-2">
            <span>{t('Description', 'Description')}</span>
            <textarea className="textarea" rows={3} maxLength={4000} value={draft.description} disabled={!writable} onChange={(e) => set('description', e.target.value)} />
          </label>

          <div className="field span-2">
            <span>{t('Personnes assignées', 'Assignees')}</span>
            {!draft.projectId ? (
              <span className="small faint">{t('Choisissez d’abord un projet.', 'Choose a project first.')}</span>
            ) : !people.length ? (
              <span className="small faint">{t('Aucun membre sur ce projet : ajoutez-en dans le projet.', 'No member on this project: add some in the project.')}</span>
            ) : (
              <div className="row row-wrap" style={{ gap: 6 }}>
                {people.map((id) => {
                  const on = draft.assigneeIds.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className="chip"
                      aria-pressed={on}
                      disabled={!writable}
                      onClick={() => toggleAssignee(id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px 4px 4px',
                        borderColor: on ? 'var(--accent)' : undefined,
                        background: on ? 'var(--accent-soft)' : undefined,
                        color: on ? 'var(--accent)' : undefined,
                      }}
                    >
                      <Avatar name={nameFor(id)} size={22} />
                      {nameFor(id)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <label className="field">
            <span>{t('Statut', 'Status')}</span>
            <select className="select" value={draft.status} disabled={!writable} onChange={(e) => set('status', e.target.value as TaskStatus)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {t(STATUS_LABEL[s])}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>{t('Priorité', 'Priority')}</span>
            <select className="select" value={draft.priority} disabled={!writable} onChange={(e) => set('priority', e.target.value as TaskPriority)}>
              {PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {t(PRIORITY_LABEL[p])}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>{t('Début', 'Start')}</span>
            <input className="input" type="date" value={draft.startDate} disabled={!writable} onChange={(e) => set('startDate', e.target.value)} />
          </label>

          <label className="field">
            <span>{t('Échéance', 'Due date')}</span>
            <input className="input" type="date" value={draft.dueDate} min={draft.startDate || undefined} disabled={!writable} onChange={(e) => set('dueDate', e.target.value)} />
          </label>

          <label className="field">
            <span>{t('Heures estimées', 'Estimated hours')}</span>
            <input className="input" type="number" min={0} step="0.25" value={draft.estimate} disabled={!writable} onChange={(e) => set('estimate', e.target.value)} />
          </label>

          <label className="field">
            <span>{t('Taux horaire ($/h)', 'Hourly rate ($/h)')}</span>
            <input
              className="input"
              type="number"
              min={0}
              step="1"
              value={draft.rate}
              disabled={!manage || !writable}
              onChange={(e) => set('rate', e.target.value)}
            />
            {!manage && <span className="small faint">{t('Taux fixé par un gestionnaire', 'Rate set by a manager')}</span>}
            {manage && <span className="small faint">{t('0 = non facturable', '0 = non-billable')}</span>}
          </label>

          <label className="field">
            <span>{t('Dépend de', 'Depends on')}</span>
            <select className="select" value={draft.dependsOnId} disabled={!writable || !draft.projectId} onChange={(e) => set('dependsOnId', e.target.value)}>
              <option value="">{t('— Aucune —', '— None —')}</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>{t('Ordre', 'Order')}</span>
            <input
              className="input"
              type="number"
              min={0}
              step={1}
              value={shownOrder}
              disabled={!writable}
              onChange={(e) => set('order', e.target.value)}
            />
          </label>
        </div>
      </div>
    </Modal>
  );
}
