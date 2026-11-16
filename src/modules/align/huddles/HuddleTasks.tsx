import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListTodo } from 'lucide-react';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Empty } from '@/components/ui';
import { Collapsible, MemberAvatar } from '../components/WeekKit';
import type { AlignPriority, AlignTask, Rock } from '../schemas';
import { TaskList } from '../tasks/TaskList';
import { TaskComposer } from '../tasks/TaskComposer';
import { groupBy } from './huddleLib';
import { memberPath } from './HuddleMembers';

/** The members' weekly tasks, grouped by person, with my own composer on top. */
export function HuddleTasks({
  huddleId,
  week,
  me,
  canCompose,
  memberSet,
  weekTasks,
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
  const [hideDone, setHideDone] = useState(false);

  const memberTasks = useMemo(() => weekTasks.filter((x) => memberSet.has(x.ownerId)), [weekTasks, memberSet]);
  const openCount = useMemo(() => memberTasks.filter((x) => !x.done).length, [memberTasks]);
  const groups = useMemo(() => {
    const byOwner = groupBy(memberTasks.filter((x) => !hideDone || !x.done), (x) => x.ownerId);
    return [...byOwner.entries()].sort(([a], [b]) => userName(a).localeCompare(userName(b), lang));
  }, [memberTasks, hideDone, userName, lang]);
  const nextOrder = useMemo(
    () => weekTasks.filter((x) => x.ownerId === me).reduce((max, x) => Math.max(max, x.order + 1), 0),
    [weekTasks, me],
  );

  return (
    <Collapsible
      id="huddle.tasks" info={{ what: t("Les actions de la semaine (lundi au vendredi) des membres : actions hebdo et actions qui font avancer un Rock. Ajoutez-en une et assignez-la à un membre.", "The members' actions for the week (Monday to Friday): weekly actions and actions that move a Rock forward. Add one and assign it to a member."), source: t("Align › Tâches hebdo (plans d'action de la semaine choisie).", "Align › Weekly tasks (action plans of the selected week).") }}
      title={t('Plan d’action', 'Action plan')}
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

      {!groups.length ? (
        <Empty icon={<ListTodo size={32} />} title={t('Aucune tâche cette semaine', 'No task this week')} />
      ) : (
        groups.map(([ownerId, list]) => {
          const open = list.filter((x) => !x.done).length;
          return (
            <div key={ownerId} className="align-task-group">
              <div className="align-task-group-head">
                <Link to={memberPath(huddleId, ownerId, week)} className="align-member-link">
                  <MemberAvatar user={userById.get(ownerId)} name={userName(ownerId)} size={24} />
                  <strong>{userName(ownerId)}</strong>
                </Link>
                <span className="small muted">
                  {t(`${open} ouverte(s)`, `${open} open`)}
                </span>
              </div>
              <TaskList
                tasks={list}
                rockById={rockById}
                priorityById={prioById}
                showOwner={false}
                emptyText={t('Aucune tâche', 'No task')}
              />
            </div>
          );
        })
      )}
    </Collapsible>
  );
}
