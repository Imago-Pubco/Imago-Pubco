import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, ExternalLink, FileText, Plus, Trash2, Wand2 } from 'lucide-react';
import { uid, useCollection } from '@/data/db';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader, useToast } from '@/components/ui';
import { useManagers, useUserName, useUsers, Avatar, DueDate, ProgressBar, WoStatusBadge } from '../ui';
import { workOrders, changeWorkOrder } from '../stores';
import {
  DEPARTMENTS,
  DEPARTMENT_LABEL,
  STANDARD_TASKS,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  WO_STATUSES,
  WO_STATUS_LABEL,
  type Department,
  type TaskStatus,
  type WorkOrder,
  type WorkOrderStatus,
  type WorkOrderTask,
} from '../types';

export function WorkOrderDetail() {
  const { id = '' } = useParams();
  const { t, fmtDate, fmtMoney, fmtNum } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const { rows, loading } = useCollection(workOrders);
  const { active } = useUsers();
  const managers = useManagers();
  const userName = useUserName();
  const wo = rows.find((r) => r.id === id);
  const canManage = can('workorders.manage');
  const canWork = canManage || can('workorders.work');
  const me = user?.id ?? '';
  const [focusTask, setFocusTask] = useState<string | null>(null);

  if (!wo) {
    return (
      <Page>
        <BackLink />
        <div className="card">
          <Empty icon={<ClipboardList size={36} />} title={loading ? t('Chargement…', 'Loading…') : t('Ordre de travail introuvable', 'Work order not found')} />
        </div>
      </Page>
    );
  }

  const save = async (patch: Partial<WorkOrder>, text?: string) => {
    try {
      await changeWorkOrder(wo, patch, me || 'system', text);
    } catch {
      toast(t('Enregistrement impossible.', 'Could not save.'), 'err');
    }
  };
  const saveTasks = (tasks: WorkOrderTask[], text?: string) => save({ tasks }, text);
  const patchTask = (taskId: string, patch: Partial<WorkOrderTask>, text?: string) =>
    saveTasks(wo.tasks.map((x) => (x.id === taskId ? { ...x, ...patch } : x)), text);

  const addTask = () => {
    const task: WorkOrderTask = { id: uid('t_'), title: '', department: 'other', assigneeId: '', status: 'todo' };
    setFocusTask(task.id);
    void saveTasks([...wo.tasks, task]);
  };

  const addStandardTasks = () => {
    const have = new Set(wo.tasks.map((x) => x.title.trim().toLowerCase()));
    const missing = STANDARD_TASKS.filter((s) => !have.has(s.title.fr.toLowerCase()) && !have.has(s.title.en.toLowerCase()));
    if (!missing.length) {
      toast(t('Les tâches standard sont déjà ajoutées.', 'Standard tasks are already added.'));
      return;
    }
    const added: WorkOrderTask[] = missing.map((s) => ({ id: uid('t_'), title: t(s.title), department: s.department, assigneeId: '', status: 'todo' }));
    void saveTasks([...wo.tasks, ...added]);
  };

  const removeTask = (task: WorkOrderTask) => {
    if (!window.confirm(t(`Supprimer la tâche « ${task.title || 'sans titre'} » ?`, `Delete the task “${task.title || 'untitled'}”?`))) return;
    void saveTasks(wo.tasks.filter((x) => x.id !== task.id), t(`Tâche supprimée : ${task.title || 'sans titre'}`, `Task deleted: ${task.title || 'untitled'}`));
  };

  const grouped = DEPARTMENTS.map((d) => ({ dept: d, tasks: wo.tasks.filter((x) => x.department === d) })).filter((g) => g.tasks.length);
  const manager = wo.managerId ? active.find((u) => u.id === wo.managerId) ?? managers.find((u) => u.id === wo.managerId) : undefined;
  const managerOptions = [...managers, ...(manager && !managers.includes(manager) ? [manager] : [])];

  return (
    <Page>
      <BackLink />
      <PageHeader
        eyebrow={wo.no}
        title={wo.customer}
        subtitle={wo.project}
        actions={
          <>
            {wo.requestId && (
              <Link to={`/sales?r=${encodeURIComponent(wo.requestId)}`} className="btn">
                <FileText size={16} /> {t('Demande de vente', 'Sales request')}
              </Link>
            )}
            {wo.estimateId && (
              <Link to={`/estimating/${encodeURIComponent(wo.estimateId)}`} className="btn">
                <ExternalLink size={16} /> {t('Estimation', 'Estimate')}
              </Link>
            )}
          </>
        }
      />

      <div className="wo-detail">
        <div className="wo-main">
          {/* Tasks */}
          <section className="card" aria-labelledby="wo-tasks-h">
            <div className="card-head">
              <h2 id="wo-tasks-h" style={{ fontSize: 16, margin: 0 }}>
                {t('Tâches', 'Tasks')}
              </h2>
              {canManage && (
                <div className="row row-wrap" style={{ gap: 8 }}>
                  <button className="btn btn-sm" onClick={addStandardTasks}>
                    <Wand2 size={14} /> {t('Ajouter les tâches standard', 'Add standard tasks')}
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={addTask}>
                    <Plus size={14} /> {t('Ajouter une tâche', 'Add task')}
                  </button>
                </div>
              )}
            </div>
            <div className="card-pad">
              {wo.tasks.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <ProgressBar tasks={wo.tasks} />
                </div>
              )}
              {grouped.length ? (
                grouped.map((g) => (
                  <div key={g.dept} className="wo-dept">
                    <h3 className="wo-dept-h">{t(DEPARTMENT_LABEL[g.dept])}</h3>
                    <ul className="wo-tasks">
                      {g.tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          full={canManage}
                          partial={!canManage && canWork && task.assigneeId === me}
                          members={active}
                          userName={userName}
                          autoFocus={focusTask === task.id}
                          onChange={(patch, text) => patchTask(task.id, patch, text)}
                          onDelete={canManage ? () => removeTask(task) : undefined}
                        />
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  {canManage
                    ? t('Aucune tâche. Ajoutez les tâches standard ou créez-en une.', 'No tasks yet. Add the standard tasks or create one.')
                    : t('Aucune tâche pour le moment.', 'No tasks yet.')}
                </p>
              )}
            </div>
          </section>

          {/* Notes */}
          <section className="card" aria-labelledby="wo-notes-h">
            <div className="card-head">
              <h2 id="wo-notes-h" style={{ fontSize: 16, margin: 0 }}>
                {t('Notes de production', 'Production notes')}
              </h2>
            </div>
            <div className="card-pad">
              <NotesField value={wo.notes} readOnly={!canManage} onSave={(notes) => void save({ notes })} />
            </div>
          </section>

          {/* History */}
          <section className="card" aria-labelledby="wo-hist-h">
            <div className="card-head">
              <h2 id="wo-hist-h" style={{ fontSize: 16, margin: 0 }}>
                {t('Historique', 'History')}
              </h2>
            </div>
            <div className="card-pad">
              {canWork && <NoteComposer onAdd={(text) => void save({}, text)} />}
              {wo.history.length ? (
                <ol className="wo-timeline">
                  {[...wo.history].reverse().map((h, i) => (
                    <li key={`${h.at}-${i}`}>
                      <span className="wo-dot" aria-hidden />
                      <div>
                        <div className="small">
                          <strong>{userName(h.by)}</strong> <span className="faint">· {fmtDate(h.at, true)}</span>
                        </div>
                        <div className="wo-history-text">{h.text}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  {t('Aucun historique.', 'No history yet.')}
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="wo-side" aria-label={t('Résumé', 'Summary')}>
          {/* Spec / quote summary */}
          <section className="card wo-spec" aria-labelledby="wo-spec-h">
            <div className="card-head">
              <h2 id="wo-spec-h" style={{ fontSize: 16, margin: 0 }}>
                {t('Spécifications et soumission', 'Specs and quote')}
              </h2>
              <span className="mono small faint">{wo.quoteId}</span>
            </div>
            <div className="card-pad">
              <p className="wo-spec-text">{wo.specSummary || t('Aucune description.', 'No description.')}</p>
              <dl className="wo-dl">
                <dt>{t('Quantité', 'Quantity')}</dt>
                <dd className="num">{fmtNum(wo.quantity)}</dd>
                <dt>{t('Prix unitaire', 'Unit price')}</dt>
                <dd className="num">{fmtMoney(wo.unitPrice)}</dd>
                <dt>{t('Total', 'Total')}</dt>
                <dd className="num">{fmtMoney(wo.total)}</dd>
                <dt>{t('Contact', 'Contact')}</dt>
                <dd>{wo.contact || '—'}</dd>
              </dl>
            </div>
          </section>

          {/* Status, manager, due */}
          <section className="card" aria-labelledby="wo-state-h">
            <div className="card-head">
              <h2 id="wo-state-h" style={{ fontSize: 16, margin: 0 }}>
                {t('Suivi', 'Tracking')}
              </h2>
            </div>
            <div className="card-pad wo-state">
              <label className="wo-field">
                <span>{t('Statut', 'Status')}</span>
                {canManage ? (
                  <select
                    className="input"
                    value={wo.status}
                    onChange={(e) => {
                      const to = e.target.value as WorkOrderStatus;
                      void save({ status: to }, t(`Statut : ${WO_STATUS_LABEL[to].fr}`, `Status: ${WO_STATUS_LABEL[to].en}`));
                    }}
                  >
                    {WO_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(WO_STATUS_LABEL[s])}
                      </option>
                    ))}
                  </select>
                ) : (
                  <WoStatusBadge status={wo.status} />
                )}
              </label>
              <label className="wo-field">
                <span>{t('Responsable de production', 'Production manager')}</span>
                {canManage ? (
                  <select
                    className="input"
                    value={wo.managerId}
                    onChange={(e) => {
                      const id = e.target.value;
                      void save({ managerId: id }, t(`Responsable : ${id ? userName(id) : 'aucun'}`, `Manager: ${id ? userName(id) : 'none'}`));
                    }}
                  >
                    <option value="">{t('Non assigné', 'Unassigned')}</option>
                    {managerOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="row" style={{ gap: 8 }}>
                    <Avatar user={manager} size={24} />
                    {manager?.displayName ?? t('Non assigné', 'Unassigned')}
                  </span>
                )}
              </label>
              <div className="wo-field">
                <span>{t('Échéance', 'Due date')}</span>
                <DueDate wo={wo} />
              </div>
              <div className="wo-field">
                <span>{t('Avancement', 'Progress')}</span>
                <ProgressBar tasks={wo.tasks} />
              </div>
              {(wo.requestId || wo.estimateId) && (
                <div className="small faint" style={{ display: 'grid', gap: 4 }}>
                  {wo.requestId && (
                    <Link to={`/sales?r=${encodeURIComponent(wo.requestId)}`}>{t('Voir la demande de vente', 'View sales request')}</Link>
                  )}
                  {wo.estimateId && <Link to={`/estimating/${encodeURIComponent(wo.estimateId)}`}>{t('Voir l’estimation', 'View estimate')}</Link>}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </Page>
  );
}

function BackLink() {
  const { t } = useI18n();
  return (
    <Link to="/workorders" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>
      <ArrowLeft size={14} /> {t('Retour au tableau', 'Back to board')}
    </Link>
  );
}

/** Free-text field saved when it loses focus. */
function NotesField({ value, readOnly, onSave }: { value: string; readOnly: boolean; onSave: (v: string) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  if (readOnly) return value ? <p className="wo-spec-text">{value}</p> : <p className="muted" style={{ margin: 0 }}>{t('Aucune note.', 'No notes.')}</p>;
  return (
    <textarea
      className="input"
      rows={3}
      aria-label={t('Notes de production', 'Production notes')}
      placeholder={t('Consignes, particularités, rappels…', 'Instructions, specifics, reminders…')}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      style={{ width: '100%', resize: 'vertical' }}
    />
  );
}

/** Adds a line to the history (any team member who works on the order). */
function NoteComposer({ onAdd }: { onAdd: (text: string) => void }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const submit = () => {
    const v = text.trim();
    if (!v) return;
    onAdd(v);
    setText('');
  };
  return (
    <form
      className="wo-composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="wo-field" style={{ flex: 1 }}>
        <span className="sr-only">{t('Ajouter une note', 'Add a note')}</span>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Ajouter une note…', 'Add a note…')} />
      </label>
      <button className="btn btn-sm" type="submit" disabled={!text.trim()}>
        {t('Ajouter', 'Add')}
      </button>
    </form>
  );
}

function TaskRow({
  task,
  full,
  partial,
  members,
  userName,
  autoFocus,
  onChange,
  onDelete,
}: {
  task: WorkOrderTask;
  /** Managers: every field. */
  full: boolean;
  /** Team members on their own task: status and notes only. */
  partial: boolean;
  members: { id: string; displayName: string }[];
  userName: (id?: string) => string;
  autoFocus?: boolean;
  onChange: (patch: Partial<WorkOrderTask>, text?: string) => void;
  onDelete?: () => void;
}) {
  const { t, fmtDate } = useI18n();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setNotes(task.notes ?? ''), [task.notes]);

  const editable = full || partial;
  const statusField = (
    <Field label={t('Statut', 'Status')}>
      <select
        className="input"
        value={task.status}
        disabled={!editable}
        onChange={(e) => {
          const s = e.target.value as TaskStatus;
          onChange({ status: s }, t(`Tâche « ${task.title || 'sans titre'} » : ${TASK_STATUS_LABEL[s].fr}`, `Task “${task.title || 'untitled'}”: ${TASK_STATUS_LABEL[s].en}`));
        }}
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(TASK_STATUS_LABEL[s])}
          </option>
        ))}
      </select>
    </Field>
  );
  const notesField = (
    <Field label={t('Notes', 'Notes')} wide>
      <input
        className="input"
        value={notes}
        readOnly={!editable}
        placeholder={t('Note de la tâche', 'Task note')}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== (task.notes ?? '') && onChange({ notes: notes.trim() || undefined })}
      />
    </Field>
  );

  return (
    <li className={`wo-task ${task.status === 'done' ? 'is-done' : ''} ${task.status === 'blocked' ? 'is-blocked' : ''}`}>
      {full ? (
        <>
          <Field label={t('Tâche', 'Task')} wide>
            <input
              className="input"
              value={title}
              autoFocus={autoFocus}
              placeholder={t('Nom de la tâche', 'Task name')}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                const v = title.trim();
                if (v !== task.title) onChange({ title: v || task.title });
              }}
            />
          </Field>
          <Field label={t('Département', 'Department')}>
            <select className="input" value={task.department} onChange={(e) => onChange({ department: e.target.value as Department })}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {t(DEPARTMENT_LABEL[d])}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('Assigné à', 'Assignee')}>
            <select className="input" value={task.assigneeId} onChange={(e) => onChange({ assigneeId: e.target.value }, t(`Tâche assignée : ${e.target.value ? userName(e.target.value) : 'personne'}`, `Task assigned: ${e.target.value ? userName(e.target.value) : 'nobody'}`))}>
              <option value="">{t('Personne', 'Nobody')}</option>
              {members.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </Field>
          {statusField}
          <Field label={t('Échéance', 'Due')}>
            <input type="date" className="input" value={task.dueAt ?? ''} onChange={(e) => onChange({ dueAt: e.target.value || undefined })} />
          </Field>
          {notesField}
          <div className="wo-task-actions">
            {onDelete && (
              <button className="btn btn-ghost btn-icon btn-sm" onClick={onDelete} aria-label={t('Supprimer la tâche', 'Delete task')} title={t('Supprimer', 'Delete')}>
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="wo-task-title">
            <strong>{task.title || t('Sans titre', 'Untitled')}</strong>
            <div className="faint small">
              {task.assigneeId ? userName(task.assigneeId) : t('Non assigné', 'Unassigned')}
              {task.dueAt ? ` · ${fmtDate(task.dueAt)}` : ''}
            </div>
          </div>
          {statusField}
          {notesField}
        </>
      )}
    </li>
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`wo-field ${wide ? 'is-wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
