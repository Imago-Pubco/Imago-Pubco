import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Compass, ListChecks, Settings, Users, Video } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import { isBlocked, isOverdue, priorityInQuarter, quarterLabel, quarterOf, rockPriorities, rockProgress, shiftQuarter } from '../lib';
import { ProgressBar } from '../components/RockShared';
import { alignHuddles, alignPriorities, notes, rocks } from '../stores';
import type { AlignNote, AlignPriority, Rock } from '../schemas';
import { HuddleForm } from '../huddles/HuddleForm';
import { FollowUpItem } from '../huddles/FollowUps';
import { PriorityRow } from '../huddles/PriorityRow';
import { byDue, canEditHuddle, groupBy, scheduleLabel } from '../huddles/huddleLib';

interface RockStats {
  done: number;
  total: number;
  pct: number;
  blocked: number;
  red: number;
}

export function HuddleMeeting() {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  const userName = useUserName();
  const { rows: allRocks } = useCollection(rocks);
  const { rows: allPriorities, loading: loadingPriorities } = useCollection(alignPriorities);
  const { rows: allNotes } = useCollection(notes);
  const { rows: huddles, loading: loadingHuddles } = useCollection(alignHuddles);
  const { rows: allUsers } = useCollection(users);
  const [quarter, setQuarter] = useState(() => quarterOf());
  const [mineOnly, setMineOnly] = useState(false);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const me = user!.id;
  const canManage = can('align.huddles.manage');
  const huddle = useMemo(() => huddles.find((h) => h.id === id), [huddles, id]);
  const canSettings = !!huddle && canEditHuddle(huddle, me, canManage);
  const isCurrent = quarterOf() === quarter;

  const people = useMemo(
    () => allUsers.filter((u) => u.active).sort((a, b) => a.displayName.localeCompare(b.displayName, lang)),
    [allUsers, lang],
  );
  const members = useMemo(() => {
    if (!huddle) return [] as string[];
    return [...new Set([...huddle.memberIds, ...(huddle.ownerId ? [huddle.ownerId] : [])])];
  }, [huddle]);
  const memberSet = useMemo(() => new Set(members), [members]);

  const rockById = useMemo(() => new Map(allRocks.map((r): [string, Rock] => [r.id, r])), [allRocks]);
  const prioById = useMemo(() => new Map(allPriorities.map((p): [string, AlignPriority] => [p.id, p])), [allPriorities]);

  // Same quarter rule as the dashboard and the Rocks page (lib.ts priorityInQuarter).
  const quarterPriorities = useMemo(
    () => allPriorities.filter((p) => priorityInQuarter(p, quarter, rockById)),
    [allPriorities, rockById, quarter],
  );

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

  // Members' priorities of the quarter after the two filters, grouped by person (one card each).
  const memberPriorities = useMemo(
    () => quarterPriorities.filter((p) => p.ownerId && memberSet.has(p.ownerId)),
    [quarterPriorities, memberSet],
  );
  const visible = useMemo(
    () =>
      memberPriorities.filter(
        (p) => (!mineOnly || p.ownerId === me) && (!problemsOnly || isBlocked(p, prioById) || isOverdue(p)),
      ),
    [memberPriorities, mineOnly, problemsOnly, me, prioById],
  );
  const groups = useMemo(() => {
    const byOwner = groupBy(visible, (p) => p.ownerId);
    return [...byOwner.entries()]
      .map(([ownerId, items]) => ({ ownerId, items: [...items].sort((a, b) => byDue(a, b) || a.order - b.order) }))
      .sort((a, b) => userName(a.ownerId).localeCompare(userName(b.ownerId), lang));
  }, [visible, userName, lang]);

  // Follow-ups per priority: open first, then by due date.
  const followupsBy = useMemo(() => {
    const m = groupBy(
      allNotes.filter((n) => n.kind === 'followup'),
      (n) => n.priorityId,
    );
    for (const list of m.values()) list.sort((a, b) => Number(a.done) - Number(b.done) || byDue(a, b));
    return m;
  }, [allNotes]);

  // Open follow-ups written during this huddle.
  const huddleOpen = useMemo(
    () =>
      huddle ? allNotes.filter((n: AlignNote) => n.kind === 'followup' && !n.done && n.huddleId === huddle.id).sort(byDue) : [],
    [allNotes, huddle],
  );

  if (!huddle) {
    if (loadingHuddles || loadingPriorities) return null;
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

      {huddle.description && <p className="muted" style={{ margin: '0 0 16px', whiteSpace: 'pre-line' }}>{huddle.description}</p>}

      <div className="row row-wrap" style={{ gap: 10, marginBottom: 16 }}>
        <button className="btn btn-ghost btn-icon btn-sm" aria-label={t('Trimestre précédent', 'Previous quarter')} onClick={() => setQuarter((q) => shiftQuarter(q, -1))}>
          <ChevronLeft size={16} />
        </button>
        <strong>{quarterLabel(quarter)}</strong>
        <button className="btn btn-ghost btn-icon btn-sm" aria-label={t('Trimestre suivant', 'Next quarter')} onClick={() => setQuarter((q) => shiftQuarter(q, 1))}>
          <ChevronRight size={16} />
        </button>
        {!isCurrent && (
          <button className="btn btn-sm" onClick={() => setQuarter(quarterOf())}>
            {t('Trimestre actuel', 'Current quarter')}
          </button>
        )}
      </div>

      {/* Rocks overview (company-wide) */}
      <section className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 className="align-section-title">
          <Compass size={18} /> {t('Vue d’ensemble des Rocks', 'Rocks overview')}
        </h2>
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
                    <Link to={`/align/rocks/${r.id}`} className="align-rock-link">
                      {r.title}
                    </Link>
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
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Members' priorities */}
      <section className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row row-wrap" style={{ justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <h2 className="align-section-title" style={{ margin: 0 }}>
            <ListChecks size={18} /> {t('Priorités de l’équipe', 'Team priorities')}
          </h2>
          <div className="row row-wrap" style={{ gap: 14 }}>
            <label className="check">
              <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
              {t('Mes priorités seulement', 'My priorities only')}
            </label>
            <label className="check">
              <input type="checkbox" checked={problemsOnly} onChange={(e) => setProblemsOnly(e.target.checked)} />
              {t('Bloquées / en retard seulement', 'Blocked / overdue only')}
            </label>
          </div>
        </div>

        {!members.length ? (
          <Empty icon={<Users size={32} />} title={t('Aucun membre dans ce huddle', 'No member in this huddle')}>
            {canSettings ? t('Ajoutez des membres dans les paramètres.', 'Add members in the settings.') : null}
          </Empty>
        ) : !memberPriorities.length ? (
          <Empty icon={<ListChecks size={32} />} title={t('Aucune priorité pour ce trimestre', 'No priorities for this quarter')} />
        ) : !visible.length ? (
          <Empty icon={<ListChecks size={32} />} title={t('Aucun résultat pour ces filtres', 'No result for these filters')} />
        ) : (
          <div className="align-people-grid">
            {groups.map((g) => (
              <div key={g.ownerId} className="align-person card">
                <div className="card-head">
                  <h3>{userName(g.ownerId)}</h3>
                  <span className="badge">{g.items.length}</span>
                </div>
                <div className="align-person-body">
                  {g.items.map((p) => {
                    const fups = followupsBy.get(p.id) ?? [];
                    return (
                      <PriorityRow
                        key={p.id}
                        priority={p}
                        rockTitle={p.rockId ? rockById.get(p.rockId)?.title : undefined}
                        blockerTitle={p.blockedById ? prioById.get(p.blockedById)?.title : undefined}
                        blocked={isBlocked(p, prioById)}
                        overdue={isOverdue(p)}
                        followups={fups}
                        huddleId={huddle.id}
                        people={people}
                        userName={userName}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Open follow-ups of this meeting */}
      <section className="card card-pad">
        <h2 className="align-section-title">
          <ListChecks size={18} /> {t('Suivis ouverts de cette réunion', 'Open follow-ups from this meeting')}{' '}
          <span className="badge">{huddleOpen.length}</span>
        </h2>
        {!huddleOpen.length ? (
          <div className="small muted">{t('Aucun suivi ouvert pour cette réunion.', 'No open follow-up from this meeting.')}</div>
        ) : (
          <div className="align-followup-list">
            {huddleOpen.map((n) => (
              <FollowUpItem key={n.id} note={n} userName={userName} priorityTitle={prioById.get(n.priorityId)?.title} />
            ))}
          </div>
        )}
      </section>

      {formOpen && huddle && <HuddleForm huddle={huddle} people={people} onClose={() => setFormOpen(false)} />}
    </Page>
  );
}
