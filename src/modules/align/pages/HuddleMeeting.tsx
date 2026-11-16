import { counted } from '../tasks/taskLib';
import { hasRichContent } from '@/components/richtext/sanitize';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronDown, Compass, Settings, Users, Video } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { users } from '@/data/stores';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import { isBlocked, priorityInQuarter, quarterLabel, rockPriorities, rockProgress } from '../lib';
import { ProgressBar } from '../components/RockShared';
import { Collapsible, WeekPicker, useWeekParam } from '../components/WeekKit';
import { alignHuddles, alignPriorities, checkins, huddleWeeks, rocks, tasks } from '../stores';
import { checkinId, quarterOfWeek } from '../week';
import type { AlignPriority, Checkin, Rock } from '../schemas';
import { HuddleForm } from '../huddles/HuddleForm';
import { HuddleDescription } from '../huddles/HuddleDescription';
import { HuddleTasks } from '../huddles/HuddleTasks';
import { RockPriorities } from '../huddles/RockPriorities';
import { HuddleMembers, type MemberStat } from '../huddles/HuddleMembers';
import { canEditHuddle, groupBy, scheduleLabel } from '../huddles/huddleLib';

interface RockStats {
  done: number;
  total: number;
  pct: number;
  blocked: number;
  red: number;
}

/** The small arrow of a Rock that shows or hides its priorities. */
function PrioToggle({ open, count, onClick }: { open: boolean; count: number; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      className="btn btn-ghost btn-icon btn-sm align-rockprio-toggle"
      onClick={onClick}
      aria-expanded={open}
      aria-label={open ? t('Masquer les priorités', 'Hide the priorities') : t('Afficher les priorités', 'Show the priorities')}
      title={open ? t(`Masquer les priorités (${count})`, `Hide the priorities (${count})`) : t(`Afficher les priorités (${count})`, `Show the priorities (${count})`)}
    >
      <ChevronDown size={16} className={`align-past-chevron${open ? ' open' : ''}`} />
    </button>
  );
}

/** A weekly huddle: the week's description, Rocks, the members' tasks and priorities, the members, open follow-ups. */
export function HuddleMeeting() {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  const [week, setWeek] = useWeekParam();
  const quarter = quarterOfWeek(week);

  // One subscription per collection, at page level; the sections receive what they need.
  const { rows: allRocks, loading: loadingRocks } = useCollection(rocks);
  const { rows: allPriorities, loading: loadingPriorities } = useCollection(alignPriorities);
  const { rows: huddles, loading: loadingHuddles } = useCollection(alignHuddles);
  const { rows: allUsers } = useCollection(users);
  const { rows: allTasks } = useCollection(tasks);
  const { rows: allCheckins } = useCollection(checkins);
  const { rows: allWeeks } = useCollection(huddleWeeks);

  const [formOpen, setFormOpen] = useState(false);
  // Rocks whose priorities are shown (the key "none" is the priorities without a Rock); remembered in this browser.
  const [shownRocks, setShownRocks] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem('imago:align:huddle-rock-prios') ?? '[]');
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const toggleRock = (key: string) =>
    setShownRocks((cur) => {
      const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key];
      try {
        localStorage.setItem('imago:align:huddle-rock-prios', JSON.stringify(next));
      } catch {
        /* this session only */
      }
      return next;
    });

  const me = user!.id;
  const canManage = can('align.huddles.manage');
  const canPrio = can('align.priorities.manage');
  const huddle = useMemo(() => huddles.find((h) => h.id === id), [huddles, id]);
  const canSettings = !!huddle && canEditHuddle(huddle, me, canManage);

  const people = useMemo(
    () => allUsers.filter((u) => u.active).sort((a, b) => a.displayName.localeCompare(b.displayName, lang)),
    [allUsers, lang],
  );
  const userById = useMemo(() => new Map(allUsers.map((u): [string, User] => [u.id, u])), [allUsers]);
  const userName = useMemo(
    () => (uid?: string | null) => (uid === 'system' ? 'Automatisation' : (userById.get(uid ?? '')?.displayName ?? uid ?? '—')),
    [userById],
  );

  const members = useMemo(() => {
    if (!huddle) return [] as string[];
    return [...new Set([...huddle.memberIds, ...(huddle.ownerId ? [huddle.ownerId] : [])])].sort((a, b) =>
      userName(a).localeCompare(userName(b), lang),
    );
  }, [huddle, userName, lang]);
  const memberSet = useMemo(() => new Set(members), [members]);
  const canCompose = memberSet.has(me) || canPrio;

  const rockById = useMemo(() => new Map(allRocks.map((r): [string, Rock] => [r.id, r])), [allRocks]);
  const prioById = useMemo(() => new Map(allPriorities.map((p): [string, AlignPriority] => [p.id, p])), [allPriorities]);

  // Same quarter rule as the dashboard and the Rocks page (lib.ts priorityInQuarter).
  const quarterPriorities = useMemo(
    () => allPriorities.filter((p) => priorityInQuarter(p, quarter, rockById)),
    [allPriorities, rockById, quarter],
  );
  const memberPriorities = useMemo(
    () => quarterPriorities.filter((p) => p.ownerId && memberSet.has(p.ownerId)),
    [quarterPriorities, memberSet],
  );
  // Every active priority (the composer keeps the assignee's ones).
  const myPriorities = useMemo(() => allPriorities.filter((p) => !p.archived), [allPriorities]);

  const rockRows = useMemo(
    () => allRocks.filter((r) => r.quarter === quarter && !r.archived).sort((a, b) => a.order - b.order),
    [allRocks, quarter],
  );
  const rockStats = useMemo(
    () =>
      new Map(
        rockRows.map((r): [string, RockStats] => {
          const prog = rockProgress(r, allPriorities);
          const list = rockPriorities(r, allPriorities);
          return [
            r.id,
            {
              ...prog,
              blocked: list.filter((p) => isBlocked(p, prioById)).length,
              red: list.filter((p) => p.health === 'red' && p.status !== 'completed').length,
            },
          ];
        }),
      ),
    [rockRows, allPriorities, prioById],
  );

  const weekTasks = useMemo(() => allTasks.filter((x) => x.weekStart === week), [allTasks, week]);
  // Actions of earlier weeks that were never completed (most recent week first), to bring into this week.
  const pastTasks = useMemo(
    () =>
      allTasks
        .filter((x) => x.weekStart < week && !x.done && memberSet.has(x.ownerId))
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.order - b.order),
    [allTasks, week, memberSet],
  );
  // The members' priorities of the quarter, under their Rock (or apart when they have none).
  const prioritiesByRock = useMemo(() => groupBy(memberPriorities, (p) => p.rockId ?? 'none'), [memberPriorities]);

  // Per-member figures for the tiles: open tasks and priorities of the week, blocked, and the "what's up" check-in.
  const memberStats = useMemo(() => {
    const openTasks = groupBy(
      weekTasks.filter((x) => counted(x) && !x.done),
      (x) => x.ownerId,
    );
    const openPrio = groupBy(
      memberPriorities.filter((p) => p.status !== 'completed'),
      (p) => p.ownerId,
    );
    const blocked = groupBy(
      memberPriorities.filter((p) => isBlocked(p, prioById)),
      (p) => p.ownerId,
    );
    const checkinById = new Map(allCheckins.map((c): [string, Checkin] => [c.id, c]));
    return new Map(
      members.map((m): [string, MemberStat] => [
        m,
        {
          openTasks: openTasks.get(m)?.length ?? 0,
          openPrio: openPrio.get(m)?.length ?? 0,
          blocked: blocked.get(m)?.length ?? 0,
          whatsUp: hasRichContent(checkinById.get(checkinId(m, week))?.whatsUp),
        },
      ]),
    );
  }, [weekTasks, memberPriorities, prioById, allCheckins, members, week]);

  if (!huddle) {
    if (loadingHuddles || loadingPriorities || loadingRocks) return null;
    return (
      <Page>
        <div className="card">
          <Empty icon={<Users size={36} />} title={t('Huddle introuvable', 'Huddle not found')}>
            <Link to="/align/huddles">{t('Retour aux huddles', 'Back to huddles')}</Link>
          </Empty>
        </div>
      </Page>
    );
  }

  const schedule = scheduleLabel(huddle, lang);

  return (
    <Page>
      <div className="small" style={{ marginBottom: 6 }}>
        <Link to="/align/huddles">‹ {t('Huddles', 'Huddles')}</Link>
      </div>
      <PageHeader
        eyebrow={t('Align · Huddle', 'Align · Huddle')}
        title={huddle.name}
        subtitle={schedule}
        actions={
          <>
            {huddle.videoUrl && (
              <a className="btn" href={huddle.videoUrl} target="_blank" rel="noreferrer">
                <Video size={16} /> {t('Visioconférence', 'Video call')}
              </a>
            )}
            {canSettings && (
              <button className="btn" onClick={() => setFormOpen(true)}>
                <Settings size={16} /> {t('Paramètres', 'Settings')}
              </button>
            )}
          </>
        }
      />

      <div className="row row-wrap" style={{ gap: 10, marginBottom: 16 }}>
        <WeekPicker week={week} onChange={setWeek} />
        <span className="badge" title={t('Trimestre des Rocks et priorités', 'Quarter of the Rocks and priorities')}>
          {quarterLabel(quarter)}
        </span>
      </div>

      <HuddleDescription huddle={huddle} week={week} weeks={allWeeks} canEdit={canSettings} />

      {/* Rocks overview (company-wide, for the quarter of the week) */}
      <Collapsible id="huddle.rocks" info={{ what: t("Les Rocks (objectifs de l'entreprise) du trimestre et leur progression : priorités terminées ÷ priorités totales.", "The quarter's Rocks (company goals) and their progress: completed priorities ÷ total priorities."), source: t("Align › Rocks, trimestre de la semaine choisie.", "Align › Rocks, quarter of the selected week.") }} title={t('Rocks', 'Rocks')} icon={<Compass size={18} />} count={rockRows.length}>
        {!rockRows.length ? (
          <Empty icon={<Compass size={32} />} title={t('Aucun Rock pour ce trimestre', 'No Rock for this quarter')}>
            <Link to="/align/rocks">{t('Voir les Rocks', 'View Rocks')}</Link>
          </Empty>
        ) : (
          <ul className="align-rock-list">
            {rockRows.map((r) => {
              const s = rockStats.get(r.id)!;
              return (
                <li key={r.id} className="align-rock-row">
                  <div className="row row-wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
                    <span className="row align-rock-head">
                      <PrioToggle open={shownRocks.includes(r.id)} count={prioritiesByRock.get(r.id)?.length ?? 0} onClick={() => toggleRock(r.id)} />
                      <Link to={`/align/rocks/${r.id}`} className="align-rock-link">
                        {r.title}
                      </Link>
                    </span>
                    <span className="small muted">{r.ownerId ? userName(r.ownerId) : t('Sans responsable', 'No owner')}</span>
                  </div>
                  <div className="row row-wrap" style={{ gap: 8, marginTop: 6 }}>
                    <ProgressBar pct={s.pct} style={{ flex: 1, minWidth: 140 }} />
                    <span className="small mono">
                      {s.pct} % · {s.done}/{s.total}
                    </span>
                    {s.blocked > 0 && <span className="badge badge-warn">{t(`${s.blocked} bloquée(s)`, `${s.blocked} blocked`)}</span>}
                    {s.red > 0 && <span className="badge badge-err">{t(`${s.red} rouge(s)`, `${s.red} red`)}</span>}
                  </div>
                  {shownRocks.includes(r.id) && (
                    <RockPriorities huddleId={huddle.id} week={week} priorities={prioritiesByRock.get(r.id) ?? []} prioById={prioById} userById={userById} userName={userName} />
                  )}
                </li>
              );
            })}
            {(prioritiesByRock.get('none')?.length ?? 0) > 0 && (
              <li className="align-rock-row">
                <span className="row align-rock-head">
                  <PrioToggle open={shownRocks.includes('none')} count={prioritiesByRock.get('none')!.length} onClick={() => toggleRock('none')} />
                  <strong>{t('Sans Rock', 'No Rock')}</strong>
                </span>
                {shownRocks.includes('none') && (
                  <RockPriorities huddleId={huddle.id} week={week} priorities={prioritiesByRock.get('none')!} prioById={prioById} userById={userById} userName={userName} />
                )}
              </li>
            )}
          </ul>
        )}
      </Collapsible>

      <HuddleTasks
        huddleId={huddle.id}
        week={week}
        me={me}
        canCompose={canCompose}
        memberSet={memberSet}
        weekTasks={weekTasks}
        pastTasks={pastTasks}
        rocks={rockRows}
        rockById={rockById}
        prioById={prioById}
        myPriorities={myPriorities}
        userById={userById}
        userName={userName}
      />

      <HuddleMembers
        huddleId={huddle.id}
        ownerId={huddle.ownerId}
        week={week}
        members={members}
        userById={userById}
        userName={userName}
        stats={memberStats}
        canSettings={canSettings}
      />

      {formOpen && <HuddleForm huddle={huddle} people={people} onClose={() => setFormOpen(false)} />}
    </Page>
  );
}
