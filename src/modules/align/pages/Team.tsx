import { hasRichContent } from '@/components/richtext/sanitize';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Search, Users } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { users } from '@/data/stores';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import { isBlocked, isOverdue, priorityInQuarter } from '../lib';
import { MemberAvatar, WeekPicker, useWeekParam } from '../components/WeekKit';
import { alignPriorities, checkins, rocks, tasks } from '../stores';
import type { AlignPriority, Rock } from '../schemas';
import { groupBy } from '../huddles/huddleLib';
import { quarterOfWeek, thisWeek } from '../week';

/** Lower case, accents removed, for name search. */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Every active member, with what they have on the selected week. Clicking one opens their member page. */
export function Team() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [week, setWeek] = useWeekParam();
  const quarter = quarterOfWeek(week);
  const [query, setQuery] = useState('');
  const me = user!.id;

  const { rows: allUsers, loading } = useCollection(users);
  const { rows: allRocks } = useCollection(rocks);
  const { rows: allPriorities } = useCollection(alignPriorities);
  const { rows: allTasks } = useCollection(tasks);
  const { rows: allCheckins } = useCollection(checkins);

  const rockById = useMemo(() => new Map(allRocks.map((r): [string, Rock] => [r.id, r])), [allRocks]);
  const prioById = useMemo(() => new Map(allPriorities.map((p): [string, AlignPriority] => [p.id, p])), [allPriorities]);

  // Me first, then by name.
  const people: User[] = useMemo(
    () =>
      allUsers
        .filter((u) => u.active)
        .sort((a, b) => Number(b.id === me) - Number(a.id === me) || a.displayName.localeCompare(b.displayName, lang)),
    [allUsers, me, lang],
  );
  const shown = useMemo(() => {
    const q = fold(query.trim());
    return q ? people.filter((u) => fold(u.displayName).includes(q)) : people;
  }, [people, query]);

  const tasksByOwner = useMemo(
    () => groupBy(allTasks.filter((x) => x.weekStart === week), (x) => x.ownerId),
    [allTasks, week],
  );
  const openPrioByOwner = useMemo(
    () =>
      groupBy(
        allPriorities.filter((p) => p.status !== 'completed' && priorityInQuarter(p, quarter, rockById)),
        (p) => p.ownerId,
      ),
    [allPriorities, quarter, rockById],
  );
  const wroteThisWeek = useMemo(
    () => new Set(allCheckins.filter((c) => c.weekStart === week && hasRichContent(c.whatsUp)).map((c) => c.userId)),
    [allCheckins, week],
  );

  const current = week === thisWeek();
  const qs = current ? '' : `?week=${week}`;

  return (
    <Page>
      <PageHeader
        eyebrow={t('Align · Équipe', 'Align · Team')}
        title={t('Équipe', 'Team')}
        subtitle={t('Les membres, leurs tâches et leurs priorités de la semaine', 'Members, and their tasks and priorities for the week')}
      />

      <div className="row row-wrap align-team-toolbar">
        <WeekPicker week={week} onChange={setWeek} />
        <label className="align-team-search">
          <Search size={16} aria-hidden="true" />
          <input
            className="input"
            type="search"
            placeholder={t('Rechercher un membre…', 'Search a member…')}
            aria-label={t('Rechercher un membre', 'Search a member')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {loading ? null : !shown.length ? (
        <div className="card">
          <Empty icon={<Users size={36} />} title={t('Aucun membre trouvé', 'No member found')} />
        </div>
      ) : (
        <div className="align-team-grid">
          {shown.map((u) => {
            const ts = tasksByOwner.get(u.id) ?? [];
            const done = ts.filter((x) => x.done).length;
            const ps = openPrioByOwner.get(u.id) ?? [];
            const blocked = ps.filter((p) => isBlocked(p, prioById)).length;
            const overdue = ps.filter((p) => isOverdue(p)).length;
            const wrote = wroteThisWeek.has(u.id);
            return (
              <Link key={u.id} to={`/align/team/${u.id}${qs}`} className="card card-pad align-team-card">
                <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                  <MemberAvatar user={u} size={56} />
                  <div className="stack" style={{ gap: 4, minWidth: 0, flex: 1 }}>
                    <strong className="align-team-name">{u.displayName}</strong>
                    {u.id === me && <span className="badge badge-info">{t('Moi', 'Me')}</span>}
                  </div>
                  {wrote && (
                    <CheckCircle2 size={18} color="var(--ok)" aria-label={t('Quoi de neuf écrit cette semaine', 'What’s up written this week')} />
                  )}
                </div>
                <div className="row row-wrap" style={{ gap: 6, marginTop: 12 }}>
                  <span className="badge" title={t('Tâches faites / total', 'Tasks done / total')}>
                    {done}/{ts.length} {t('tâches', 'tasks')}
                  </span>
                  <span className="badge">{t(`${ps.length} priorité(s) ouverte(s)`, `${ps.length} open priorit${ps.length === 1 ? 'y' : 'ies'}`)}</span>
                  {blocked > 0 && <span className="badge badge-warn">{t(`${blocked} bloquée(s)`, `${blocked} blocked`)}</span>}
                  {overdue > 0 && <span className="badge badge-err">{t(`${overdue} en retard`, `${overdue} overdue`)}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Page>
  );
}
