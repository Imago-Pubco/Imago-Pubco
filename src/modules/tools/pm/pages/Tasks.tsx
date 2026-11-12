import { useMemo, useState, type ReactNode } from 'react';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Page } from '@/components/Page';
import { Empty, PageHeader, useToast } from '@/components/ui';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Avatar } from '@/modules/admin/pages/Users';
import { fmtHours, isLate, iso } from '../lib';
import { projects, pmTasks, timeEntries } from '../stores';
import type { PmTask, TaskStatus } from '../schemas';
import { TaskBoard } from '../Tasks.board';
import { TaskModal } from '../Tasks.modal';
import {
  bookedByTask,
  byDue,
  currentWeekRange,
  fmtDay,
  inRange,
  isOnProject,
  localDay,
  PRIORITY_BADGE,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUS_BADGE,
  STATUS_LABEL,
  STATUS_ORDER,
  type TaskPriority,
} from '../Tasks.util';

type View = 'list' | 'board';
/** 'open' hides the done tasks (default); 'all' shows every status. */
type StatusFilter = 'open' | 'all' | TaskStatus;

const OPEN_STATUSES: TaskStatus[] = ['todo', 'doing', 'review'];

export function PmTasks() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user, can } = useAuth();
  const manage = can('tools.pm.manage');
  const me = user?.id ?? '';
  const userName = useUserName();
  const { rows: allTasks, loading } = useCollection(pmTasks);
  const { rows: allProjects } = useCollection(projects);
  const { rows: entries } = useCollection(timeEntries);
  const { rows: allUsers } = useCollection(users);

  const [view, setView] = useState<View>('list');
  const [q, setQ] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assignee, setAssignee] = useState('');
  // Non-managers start with their own tasks; managers with everything.
  const [mineOnly, setMineOnly] = useState(!manage);
  const [status, setStatus] = useState<StatusFilter>('open');
  const [priority, setPriority] = useState<'' | TaskPriority>('');
  const [lateOnly, setLateOnly] = useState(false);
  /** The id of the task being edited, 'new' for a new one, null when closed. */
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);

  const projectsById = useMemo(() => new Map(allProjects.map((p) => [p.id, p])), [allProjects]);
  const booked = useMemo(() => bookedByTask(entries), [entries]);
  const canEdit = (task: PmTask) => {
    const p = projectsById.get(task.projectId);
    return p ? isOnProject(p, me, manage) : manage;
  };
  const creatable = allProjects.some((p) => p.status !== 'archived' && isOnProject(p, me, manage));

  const today = iso(new Date());
  const week = currentWeekRange();
  const openTasks = allTasks.filter((x) => x.status !== 'done');
  const lateCount = allTasks.filter((x) => isLate(x, today)).length;
  const dueThisWeek = openTasks.filter((x) => inRange(x.dueDate, week.from, week.to)).length;
  // Done this week uses updatedAt (the last write), so it is only shown when the server provides it.
  const hasUpdatedAt = allTasks.some((x) => !!x.updatedAt);
  const doneThisWeek = allTasks.filter((x) => x.status === 'done' && !!x.updatedAt && inRange(localDay(x.updatedAt), week.from, week.to)).length;

  const q2 = q.trim().toLowerCase();
  const visible = allTasks.filter((task) => {
    if (mineOnly && !task.assigneeIds.includes(me)) return false;
    if (!mineOnly && assignee && !task.assigneeIds.includes(assignee)) return false;
    if (projectId && task.projectId !== projectId) return false;
    if (status === 'open' ? task.status === 'done' : status !== 'all' && task.status !== status) return false;
    if (priority && task.priority !== priority) return false;
    if (lateOnly && !isLate(task, today)) return false;
    if (q2) {
      const p = projectsById.get(task.projectId);
      const hay = [task.name, task.description, p?.code ?? '', p?.name ?? ''].join(' ').toLowerCase();
      if (!hay.includes(q2)) return false;
    }
    return true;
  });
  const sorted = [...visible].sort(byDue);

  const referenced = new Set(allTasks.flatMap((task) => task.assigneeIds));
  const assigneeOptions = allUsers.filter((u) => u.active || referenced.has(u.id)).sort((a, b) => a.displayName.localeCompare(b.displayName));
  const projectOptions = [...allProjects].sort((a, b) => a.code.localeCompare(b.code));
  const boardStatuses = status === 'open' ? OPEN_STATUSES : status === 'all' ? STATUS_ORDER : [status];
  const filtersActive = !!q2 || !!projectId || !!assignee || status !== 'open' || !!priority || lateOnly || !mineOnly;

  const resetFilters = () => {
    setQ('');
    setProjectId('');
    setAssignee('');
    setMineOnly(false);
    setStatus('open');
    setPriority('');
    setLateOnly(false);
  };

  // Board: a status change (drop or select). Only the status is written.
  const move = async (task: PmTask, next: TaskStatus) => {
    try {
      await pmTasks.update(task.id, { status: next });
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    }
  };

  const editing = editingId === null ? null : editingId === 'new' ? undefined : allTasks.find((x) => x.id === editingId);

  return (
    <Page>
      <PageHeader
        eyebrow={t('Outils · Gestion de projet', 'Tools · Project management')}
        title={t('Tâches', 'Tasks')}
        subtitle={t('Toutes les tâches de vos projets, en liste ou en tableau Kanban.', 'All tasks of your projects, as a list or a Kanban board.')}
        actions={
          creatable && (
            <button className="btn btn-primary" onClick={() => setEditingId('new')}>
              <Plus size={16} /> {t('Nouvelle tâche', 'New task')}
            </button>
          )
        }
      />

      <KpiGrid>
        <Kpi label={t('Tâches ouvertes', 'Open tasks')} value={openTasks.length} />
        <Kpi label={t('En retard', 'Late')} value={lateCount} tone={lateCount ? 'err' : undefined} />
        <Kpi label={t('Échéance cette semaine', 'Due this week')} value={dueThisWeek} tone="warn" />
        {hasUpdatedAt && <Kpi label={t('Terminées cette semaine', 'Done this week')} value={doneThisWeek} tone="ok" />}
      </KpiGrid>

      <div className="row row-wrap" style={{ gap: 8, marginBottom: 12 }}>
        <input
          className="input"
          type="search"
          placeholder={t('Rechercher une tâche ou un projet…', 'Search a task or a project…')}
          aria-label={t('Rechercher', 'Search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 260 }}
        />
        <select className="select" style={{ width: 'auto' }} aria-label={t('Projet', 'Project')} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">{t('Tous les projets', 'All projects')}</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} – {p.name}
            </option>
          ))}
        </select>
        {!mineOnly && (
          <select className="select" style={{ width: 'auto' }} aria-label={t('Personne', 'Person')} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">{t('Toutes les personnes', 'Everyone')}</option>
            {assigneeOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        )}
        <select className="select" style={{ width: 'auto' }} aria-label={t('Statut', 'Status')} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="open">{t('Ouvertes (sans les terminées)', 'Open (without done)')}</option>
          <option value="all">{t('Tous les statuts', 'All statuses')}</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {t(STATUS_LABEL[s])}
            </option>
          ))}
        </select>
        <select className="select" style={{ width: 'auto' }} aria-label={t('Priorité', 'Priority')} value={priority} onChange={(e) => setPriority(e.target.value as '' | TaskPriority)}>
          <option value="">{t('Toutes priorités', 'All priorities')}</option>
          {PRIORITY_ORDER.map((p) => (
            <option key={p} value={p}>
              {t(PRIORITY_LABEL[p])}
            </option>
          ))}
        </select>
        <ToggleChip on={mineOnly} onClick={() => setMineOnly((v) => !v)}>
          {t('Mes tâches', 'My tasks')}
        </ToggleChip>
        <ToggleChip on={lateOnly} onClick={() => setLateOnly((v) => !v)}>
          {t('En retard', 'Late')}
        </ToggleChip>
        {filtersActive && (
          <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
            {t('Réinitialiser', 'Reset')}
          </button>
        )}
      </div>

      <div className="tabs" role="tablist" aria-label={t('Affichage', 'View')}>
        <button role="tab" aria-selected={view === 'list'} className={`tab ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>
          <List size={15} /> {t('Liste', 'List')}
        </button>
        <button role="tab" aria-selected={view === 'board'} className={`tab ${view === 'board' ? 'active' : ''}`} onClick={() => setView('board')}>
          <LayoutGrid size={15} /> {t('Tableau', 'Board')}
        </button>
      </div>

      {loading && !allTasks.length ? (
        <div className="small faint">{t('Chargement…', 'Loading…')}</div>
      ) : !allTasks.length ? (
        <div className="card">
          <Empty icon={<List size={36} />} title={t('Aucune tâche', 'No tasks yet')}>
            {creatable
              ? t('Créez la première tâche d’un projet.', 'Create the first task of a project.')
              : t('Vous n’êtes sur aucun projet pour le moment.', 'You are not on any project yet.')}
          </Empty>
        </div>
      ) : !visible.length ? (
        <div className="card">
          <Empty icon={<List size={36} />} title={t('Aucune tâche ne correspond', 'No task matches')}>
            <button className="btn btn-sm" onClick={resetFilters}>
              {t('Réinitialiser les filtres', 'Reset filters')}
            </button>
          </Empty>
        </div>
      ) : view === 'board' ? (
        <TaskBoard
          tasks={visible}
          statuses={boardStatuses}
          projectsById={projectsById}
          nameOf={userName}
          canEdit={canEdit}
          onOpen={(task) => setEditingId(task.id)}
          onMove={move}
        />
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Tâche', 'Task')}</th>
                  <th>{t('Projet', 'Project')}</th>
                  <th>{t('Assignés', 'Assignees')}</th>
                  <th>{t('Priorité', 'Priority')}</th>
                  <th>{t('Statut', 'Status')}</th>
                  <th>{t('Échéance', 'Due')}</th>
                  <th className="num">{t('Estimé / pointé', 'Estimated / booked')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((task) => {
                  const p = projectsById.get(task.projectId);
                  const late = isLate(task, today);
                  const est = task.estimateHours;
                  const bk = booked.get(task.id) ?? 0;
                  const over = est !== null && bk > est;
                  return (
                    <tr key={task.id} className="clickable" onClick={() => setEditingId(task.id)}>
                      <td>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(task.id);
                          }}
                          style={{ all: 'unset', cursor: 'pointer', fontWeight: 600, color: 'var(--text-1)' }}
                        >
                          {task.name}
                        </button>
                      </td>
                      <td>
                        {p ? (
                          <>
                            <span className="mono small">{p.code}</span>
                            <div className="small faint">{p.name}</div>
                          </>
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </td>
                      <td>
                        {task.assigneeIds.length ? (
                          <div className="row" style={{ gap: 4 }}>
                            {task.assigneeIds.slice(0, 4).map((id) => (
                              <span key={id} title={userName(id)} style={{ display: 'inline-flex' }}>
                                <Avatar name={userName(id)} size={26} />
                              </span>
                            ))}
                            {task.assigneeIds.length > 4 && <span className="small faint">+{task.assigneeIds.length - 4}</span>}
                          </div>
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${PRIORITY_BADGE[task.priority]}`}>{t(PRIORITY_LABEL[task.priority])}</span>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[task.status]}`}>{t(STATUS_LABEL[task.status])}</span>
                      </td>
                      <td style={{ color: late ? 'var(--err)' : undefined, fontWeight: late ? 600 : undefined, whiteSpace: 'nowrap' }}>
                        {task.dueDate ? fmtDay(task.dueDate, lang) : <span className="faint">—</span>}
                        {late && <div className="small">{t('En retard', 'Late')}</div>}
                      </td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        <span className="faint">{est === null ? '—' : fmtHours(est)}</span>
                        {' / '}
                        <span style={{ color: over ? 'var(--err)' : undefined, fontWeight: over ? 600 : undefined }}>{fmtHours(bk)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingId !== null && (editingId === 'new' || editing) && (
        <TaskModal key={editingId} task={editing ?? undefined} onClose={() => setEditingId(null)} />
      )}
    </Page>
  );
}

/** A toggle chip (filter on/off). */
function ToggleChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={on}
      onClick={onClick}
      style={{
        height: 38,
        padding: '0 14px',
        borderColor: on ? 'var(--accent)' : undefined,
        background: on ? 'var(--accent-soft)' : undefined,
        color: on ? 'var(--accent)' : undefined,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
