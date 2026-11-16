import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ListTodo } from 'lucide-react';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Empty, useToast } from '@/components/ui';
import { Collapsible, MemberAvatar } from '../components/WeekKit';
import { errorText } from '../components/RockShared';
import type { AlignPriority, AlignTask, Rock } from '../schemas';
import { tasks } from '../stores';
import { TaskList } from '../tasks/TaskList';
import { TaskComposer } from '../tasks/TaskComposer';
import { dragging, endOrder, moveTask } from '../tasks/taskDnd';
import { canEditTask, postponeFields } from '../tasks/taskLib';
import { useAuth } from '@/auth/AuthContext';
import { groupBy } from './huddleLib';
import { memberPath } from './HuddleMembers';
import { PastActions } from './PastActions';

const FOLDED_KEY = 'imago:align:huddle-folded-owners';

/** The members' weekly tasks, grouped by person, with my own composer on top and the unfinished actions of past weeks. */
export function HuddleTasks({
  huddleId,
  week,
  me,
  canCompose,
  memberSet,
  weekTasks,
  pastTasks,
  rocks,
  rockById,
  prioById,
  myPriorities,
  userById,
  userName,
}: {
  huddleId: string;
  week: string;
  me: string;
  /** I am a member, or I manage priorities (may add tasks). */
  canCompose: boolean;
  memberSet: Set<string>;
  /** Tasks of the selected week (all people). */
  weekTasks: AlignTask[];
  /** Open tasks of earlier weeks (members only). */
  pastTasks: AlignTask[];
  /** Non-archived Rocks of the week's quarter. */
  rocks: Rock[];
  rockById: Map<string, Rock>;
  prioById: Map<string, AlignPriority>;
  /** My non-archived priorities. */
  myPriorities: AlignPriority[];
  userById: Map<string, User>;
  userName: (id?: string | null) => string;
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [hideDone, setHideDone] = useState(false);
  const [dragged, setDragged] = useState<AlignTask | null>(null);
  const [overOwner, setOverOwner] = useState<string | null>(null);
  // An action of this week being dragged (reorder / reassign, see tasks/taskDnd.ts).
  const [moving, setMoving] = useState<AlignTask | null>(null);
  useEffect(() => dragging.subscribe((x) => { setMoving(x); if (!x) setOverOwner(null); }), []);
  const { can } = useAuth();
  const canManage = can('align.priorities.manage');
  const active = dragged ?? moving;
  const [folded, setFolded] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(FOLDED_KEY) ?? '[]');
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const toggleFold = (ownerId: string) =>
    setFolded((cur) => {
      const next = cur.includes(ownerId) ? cur.filter((x) => x !== ownerId) : [...cur, ownerId];
      try {
        localStorage.setItem(FOLDED_KEY, JSON.stringify(next));
      } catch {
        /* this session only */
      }
      return next;
    });

  const memberTasks = useMemo(() => weekTasks.filter((x) => memberSet.has(x.ownerId)), [weekTasks, memberSet]);
  const openCount = useMemo(() => memberTasks.filter((x) => !x.done).length, [memberTasks]);
  const groups = useMemo(() => {
    const byOwner = groupBy(memberTasks.filter((x) => !hideDone || !x.done), (x) => x.ownerId);
    // While an action is dragged, every member is a target, even without an action yet.
    if (active) for (const m of memberSet) if (!byOwner.has(m)) byOwner.set(m, []);
    return [...byOwner.entries()].sort(([a], [b]) => userName(a).localeCompare(userName(b), lang));
  }, [memberTasks, hideDone, active, memberSet, userName, lang]);
  const nextOrder = useMemo(() => endOrder(weekTasks.filter((x) => x.ownerId === me)), [weekTasks, me]);

  /** Bring an earlier open action into the selected week, for its owner or for the person it is dropped on. */
  async function bringHere(task: AlignTask, ownerId: string = task.ownerId) {
    const order = endOrder(weekTasks.filter((x) => x.ownerId === ownerId));
    try {
      // Moving an unfinished action to a later week is a postponement: its start day is kept, the count goes up.
      await tasks.update(task.id, { weekStart: week, ownerId, order, ...(task.weekStart < week ? postponeFields(task) : {}) });
      toast(t('Action ajoutée à cette semaine', 'Action moved to this week'));
    } catch (err) {
      toast(errorText(err), 'err');
    }
  }

  return (
    <Collapsible
      id="huddle.tasks" info={{ what: t("Les actions de la semaine (lundi au vendredi) des membres : actions hebdo et actions qui font avancer un Rock. Ajoutez-en une et assignez-la à un membre. Les actions non terminées des semaines passées sont dans la section repliable : glissez-les sur une personne ou reportez-les à cette semaine.", "The members' actions for the week (Monday to Friday): weekly actions and actions that move a Rock forward. Add one and assign it to a member. Unfinished actions of past weeks are in the collapsible section: drag them onto a person or move them to this week."), source: t("Align › Tâches hebdo (plans d'action de la semaine choisie).", "Align › Weekly tasks (action plans of the selected week).") }}
      title={t('Plan d’action de la semaine', 'Action plan for the week')}
      icon={<ListTodo size={18} />}
      count={openCount}
      actions={
        <label className="check small">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          {t('Masquer les terminées', 'Hide done')}
        </label>
      }
    >
      {canCompose && (
        <div style={{ marginBottom: 12 }}>
          <TaskComposer ownerId={me} week={week} huddleId={huddleId} rocks={rocks} priorities={myPriorities} nextOrder={nextOrder} preferredIds={[...memberSet]} />
        </div>
      )}

      <PastActions
        tasks={pastTasks}
        week={week}
        userById={userById}
        onReschedule={(task) => void bringHere(task)}
        onDragStart={setDragged}
        onDragEnd={() => {
          setDragged(null);
          setOverOwner(null);
        }}
      />

      {!groups.length ? (
        <Empty icon={<ListTodo size={32} />} title={t('Aucune tâche cette semaine', 'No task this week')} />
      ) : (
        groups.map(([ownerId, list]) => {
          const open = list.filter((x) => !x.done).length;
          const isFolded = folded.includes(ownerId);
          return (
            <div
              key={ownerId}
              className={`align-task-group${active ? ' is-target' : ''}${active && overOwner === ownerId ? ' is-drop' : ''}`}
              onDragOver={(e) => {
                if (!active) return;
                e.preventDefault();
                setOverOwner(ownerId);
              }}
              onDragLeave={() => setOverOwner((cur) => (cur === ownerId ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                const task = dragged;
                setDragged(null);
                setOverOwner(null);
                if (task) return void bringHere(task, ownerId);
                // An action of this week dropped on the person (header, folded or empty group): to the end of their list.
                const cur = dragging.get();
                dragging.set(null);
                if (cur && cur.ownerId !== ownerId) {
                  const target = weekTasks.filter((x) => x.ownerId === ownerId);
                  moveTask(cur, ownerId, null, target, (x) => canEditTask(x, me, canManage))
                    .then(() => toast(t('Action réassignée', 'Action reassigned')))
                    .catch((err) => toast(errorText(err), 'err'));
                }
              }}
            >
              <div className="align-task-group-head">
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => toggleFold(ownerId)}
                  aria-expanded={!isFolded}
                  aria-label={isFolded ? t('Afficher le plan d’action', 'Show the action plan') : t('Masquer le plan d’action', 'Hide the action plan')}
                  title={isFolded ? t('Afficher', 'Show') : t('Masquer', 'Hide')}
                >
                  <ChevronDown size={16} className={`align-past-chevron${isFolded ? '' : ' open'}`} />
                </button>
                <Link to={memberPath(huddleId, ownerId, week)} className="align-member-link">
                  <MemberAvatar user={userById.get(ownerId)} name={userName(ownerId)} size={24} />
                  <strong>{userName(ownerId)}</strong>
                </Link>
                <span className="small muted">{t(`${open} ouverte(s)`, `${open} open`)}</span>
              </div>
              {!isFolded && (
                <TaskList
                  tasks={list}
                  rockById={rockById}
                  priorityById={prioById}
                  showOwner={false}
                  emptyText={active ? t('Déposez l’action ici', 'Drop the action here') : t('Aucune tâche', 'No task')}
                  dropOwnerId={ownerId}
                />
              )}
            </div>
          );
        })
      )}
    </Collapsible>
  );
}
