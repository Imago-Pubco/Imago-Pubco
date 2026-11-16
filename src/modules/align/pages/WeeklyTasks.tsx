import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, ListChecks, ListTodo, Mountain, Percent, UserPlus } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { Collapsible, MemberAvatar, WeekPicker, useWeekParam } from '../components/WeekKit';
import { userOptions } from '../components/RockShared';
import { alignPriorities, rocks, tasks } from '../stores';
import type { AlignPriority, AlignTask, Rock, TaskKind } from '../schemas';
import { quarterOfWeek } from '../week';
import { groupBy } from '../huddles/huddleLib';
import { TaskComposer } from '../tasks/TaskComposer';
import { TaskList } from '../tasks/TaskList';
import { sortTasks } from '../tasks/taskLib';

type View = 'mine' | 'all';
type KindFilter = 'all' | TaskKind;

/** Does a task pass the kind and "hide done" filters? */
const matches = (x: AlignTask, kind: KindFilter, hideDone: boolean) => (kind === 'all' || x.kind === kind) && !(hideDone && x.done);

/** Order for a new task: after the last one of the plan. */
const nextOrderFor = (list: AlignTask[]) => list.reduce((m, x) => Math.max(m, x.order), -1) + 1;

/** Weekly tasks: each person's action plan for the week, with Rock actions and weekly actions. */
export function WeeklyTasks() {
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  const [week, setWeek] = useWeekParam();
  const { rows: allTasks, loading } = useCollection(tasks);
  const { rows: allRocks } = useCollection(rocks);
  const { rows: allPriorities } = useCollection(alignPriorities);
  const { rows: allUsers } = useCollection(users);

  const [view, setView] = useState<View>('mine');
  const [personId, setPersonId] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [hideDone, setHideDone] = useState(false);
  const [addForId, setAddForId] = useState('');

  const me = user!.id;
  const canManage = can('align.priorities.manage');
  const quarter = quarterOfWeek(week);

  const userById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers]);
  const rockById = useMemo(() => new Map(allRocks.map((r): [string, Rock] => [r.id, r])), [allRocks]);
  const priorityById = useMemo(() => new Map(allPriorities.map((p): [string, AlignPriority] => [p.id, p])), [allPriorities]);
  const quarterRocks = useMemo(
    () => allRocks.filter((r) => r.quarter === quarter && !r.archived).sort((a, b) => a.title.localeCompare(b.title, lang)),
    [allRocks, quarter, lang],
  );
  const people = useMemo(() => userOptions(allUsers), [allUsers]);
  const nameOf = (id: string) => userById.get(id)?.displayName ?? id;

  const prioritiesOf = (ownerId: string) => allPriorities.filter((p) => p.ownerId === ownerId && !p.archived);
  const weekTasks = useMemo(() => allTasks.filter((x) => x.weekStart === week), [allTasks, week]);
  const mineAll = useMemo(() => weekTasks.filter((x) => x.ownerId === me).sort(sortTasks), [weekTasks, me]);
  const mineShown = useMemo(() => mineAll.filter((x) => matches(x, kind, hideDone)), [mineAll, kind, hideDone]);

  // Everyone: one group per other person with tasks this week (the filters narrow what is listed, not who is listed).
  const groups = useMemo(() => {
    const byOwner = groupBy(weekTasks.filter((x) => x.ownerId !== me && (!personId || x.ownerId === personId)), (x) => x.ownerId);
    return [...byOwner.entries()]
      .map(([id, list]) => ({
        id,
        open: list.filter((x) => !x.done).length,
        shown: list.filter((x) => matches(x, kind, hideDone)).sort(sortTasks),
      }))
      .sort((a, b) => (userById.get(a.id)?.displayName ?? a.id).localeCompare(userById.get(b.id)?.displayName ?? b.id, lang));
  }, [weekTasks, me, personId, kind, hideDone, userById, lang]);

  // Stats over the scope of the view (my plan, or everyone / one person).
  const scope = view === 'mine' ? mineAll : personId ? weekTasks.filter((x) => x.ownerId === personId) : weekTasks;
  const doneCount = scope.filter((x) => x.done).length;
  const pct = scope.length ? Math.round((doneCount / scope.length) * 100) : 0;
  const rockCount = scope.filter((x) => x.kind === 'rock').length;
  const openMine = mineAll.filter((x) => !x.done).length;

  const addForTasks = addForId ? weekTasks.filter((x) => x.ownerId === addForId) : [];

  return (
    <Page>
      <PageHeader
        eyebrow="Align"
        title={t('Tâches hebdo', 'Weekly tasks')}
        subtitle={t(
          'Le plan d’action de la semaine : des actions hebdomadaires et des actions qui font avancer un Rock.',
          'The week’s action plan: weekly actions and actions that move a Rock forward.',
        )}
      />
      <WeekPicker week={week} onChange={setWeek} />

      <div className="align-task-filters row row-wrap" style={{ margin: '12px 0' }}>
        <div className="align-task-seg" role="group" aria-label={t('Affichage', 'View')}>
          <button className={`btn btn-sm${view === 'mine' ? ' btn-primary' : ''}`} aria-pressed={view === 'mine'} onClick={() => setView('mine')}>
            {t('Mes tâches', 'Mine')}
          </button>
          <button className={`btn btn-sm${view === 'all' ? ' btn-primary' : ''}`} aria-pressed={view === 'all'} onClick={() => setView('all')}>
            {t('Toute l’équipe', 'Everyone')}
          </button>
        </div>
        {view === 'all' && (
          <select className="select" style={{ width: 220 }} aria-label={t('Personne', 'Person')} value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">{t('Toute l’équipe', 'Everyone')}</option>
            {people
              .filter((p) => p.id !== me)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
          </select>
        )}
        <select className="select" style={{ width: 190 }} aria-label={t('Type d’action', 'Action type')} value={kind} onChange={(e) => setKind(e.target.value as KindFilter)}>
          <option value="all">{t('Toutes les actions', 'All actions')}</option>
          <option value="weekly">{t('Actions hebdo', 'Weekly actions')}</option>
          <option value="rock">{t('Actions Rock', 'Rock actions')}</option>
        </select>
        <label className="row small" style={{ gap: 6 }}>
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          {t('Masquer les terminées', 'Hide done')}
        </label>
      </div>

      <KpiGrid>
        <Kpi label={t('Actions', 'Actions')} value={scope.length} icon={<ListChecks size={16} />} />
        <Kpi label={t('Terminées', 'Done')} value={doneCount} tone="ok" icon={<CheckCircle2 size={16} />} />
        <Kpi label={t('Avancement', 'Done %')} value={`${pct} %`} tone="accent" icon={<Percent size={16} />} />
        <Kpi label={t('Actions Rock', 'Rock actions')} value={rockCount} icon={<Mountain size={16} />} />
      </KpiGrid>

      {loading && <div className="small muted" style={{ marginTop: 12 }}>…</div>}

      <div className="stack" style={{ marginTop: 12 }}>
        <Collapsible id="tasks.mine" title={t('Mon plan d’action', 'My action plan')} icon={<ListTodo size={16} />} count={openMine}>
          <TaskComposer key={me} ownerId={me} week={week} rocks={quarterRocks} priorities={prioritiesOf(me)} nextOrder={nextOrderFor(mineAll)} />
          <div style={{ marginTop: 14 }}>
            {mineShown.length === 0 ? (
              <Empty
                icon={<ListTodo size={28} />}
                title={mineAll.length === 0 ? t('Aucune action cette semaine', 'No action this week') : t('Aucune action ne correspond aux filtres', 'No action matches the filters')}
              >
                {mineAll.length === 0 && t('Ajoutez votre première action ci-dessus.', 'Add your first action above.')}
              </Empty>
            ) : (
              <TaskList tasks={mineShown} rockById={rockById} priorityById={priorityById} />
            )}
          </div>
        </Collapsible>

        {view === 'all' && (
          <>
            {canManage && (
              <Collapsible id="tasks.addfor" title={t('Ajouter pour…', 'Add for…')} icon={<UserPlus size={16} />}>
                <label className="field">
                  <span>{t('Personne', 'Person')}</span>
                  <select className="select" value={addForId} onChange={(e) => setAddForId(e.target.value)}>
                    <option value="">{t('Choisir…', 'Choose…')}</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                {addForId && (
                  <div style={{ marginTop: 12 }}>
                    <TaskComposer
                      key={addForId}
                      ownerId={addForId}
                      week={week}
                      rocks={quarterRocks}
                      priorities={prioritiesOf(addForId)}
                      nextOrder={nextOrderFor(addForTasks)}
                    />
                  </div>
                )}
              </Collapsible>
            )}

            {groups.length === 0 ? (
              <Empty icon={<ListTodo size={28} />} title={t('Aucune action pour cette semaine', 'No action this week')}>
                {t('Personne n’a encore de plan d’action cette semaine.', 'Nobody has an action plan this week yet.')}
              </Empty>
            ) : (
              groups.map((g) => (
                <Collapsible
                  key={g.id}
                  id={`tasks.p.${g.id}`}
                  title={
                    <span className="row" style={{ gap: 8, display: 'inline-flex' }}>
                      <MemberAvatar user={userById.get(g.id)} name={g.id} size={24} />
                      {nameOf(g.id)}
                    </span>
                  }
                  count={g.open}
                  actions={
                    <Link className="btn btn-ghost btn-sm" to={`/align/team/${g.id}?week=${week}`}>
                      {t('Ouvrir', 'Open')} <ExternalLink size={14} />
                    </Link>
                  }
                >
                  <TaskList tasks={g.shown} rockById={rockById} priorityById={priorityById} emptyText={t('Aucune action ne correspond aux filtres.', 'No action matches the filters.')} />
                </Collapsible>
              ))
            )}
          </>
        )}
      </div>
    </Page>
  );
}
