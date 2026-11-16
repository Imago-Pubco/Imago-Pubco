import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Mountain, Plus } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import { isBlocked, isOverdue, priorityInQuarter, quarterLabel, quarterOf, rockPriorities, rockProgress, shiftQuarter } from '../lib';
import { alignPriorities, rocks, strategy } from '../stores';
import type { AlignPriority, Rock } from '../schemas';
import { RockCard, RockUnlinkedCard, type RockStats } from '../components/RockCard';
import { RockFormModal } from '../components/RockFormModal';
import { RockUnlinkedModal } from '../components/RockUnlinkedModal';
import { PriorityPanel } from '../components/PriorityPanel';
import { planFrom, sortPriorities } from '../components/RockShared';

/** Company Rocks of a quarter, as a board of cards. */
export function Rocks() {
  const { t } = useI18n();
  const { user, can } = useAuth();
  const userName = useUserName();
  const { rows: allRocks } = useCollection(rocks);
  const { rows: allPriorities } = useCollection(alignPriorities);
  const { rows: strategyRows } = useCollection(strategy);
  const { rows: people } = useCollection(users);
  const [quarter, setQuarter] = useState(() => quarterOf());
  const [mineOnly, setMineOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [unlinkedOpen, setUnlinkedOpen] = useState(false);
  const [openPriorityId, setOpenPriorityId] = useState<string | null>(null);

  const me = user!.id;
  const current = quarterOf();
  const canManage = can('align.rocks.manage');
  const canPriorities = can('align.priorities.manage');
  const thrusts = useMemo(() => planFrom(strategyRows).keyThrusts, [strategyRows]);

  const quarterRocks = useMemo(
    () => allRocks.filter((r) => r.quarter === quarter && (showArchived || !r.archived)).sort((a, b) => a.order - b.order),
    [allRocks, quarter, showArchived],
  );

  const rockById = useMemo(() => new Map<string, Rock>(allRocks.map((r) => [r.id, r] as const)), [allRocks]);
  const prioById = useMemo(() => new Map<string, AlignPriority>(allPriorities.map((p) => [p.id, p] as const)), [allPriorities]);

  const statsById = useMemo(() => {
    const map = new Map<string, RockStats>();
    for (const r of allRocks) {
      if (r.quarter !== quarter) continue;
      const list = rockPriorities(r, allPriorities);
      const { done, total, pct } = rockProgress(r, allPriorities);
      map.set(r.id, {
        done,
        total,
        pct,
        blocked: list.filter((p) => isBlocked(p, prioById)).length,
        overdue: list.filter((p) => isOverdue(p)).length,
        red: list.filter((p) => p.health === 'red' && p.status !== 'completed').length,
      });
    }
    return map;
  }, [allRocks, allPriorities, prioById, quarter]);

  const visible = useMemo(
    () =>
      mineOnly
        ? quarterRocks.filter((r) => r.ownerId === me || rockPriorities(r, allPriorities).some((p) => p.ownerId === me))
        : quarterRocks,
    [mineOnly, quarterRocks, allPriorities, me],
  );

  // Priorities of the quarter that belong to no Rock (same quarter rule as the dashboard and the huddles).
  const unlinked = useMemo(
    () => allPriorities.filter((p) => !p.rockId && priorityInQuarter(p, quarter, rockById)).sort(sortPriorities),
    [allPriorities, quarter, rockById],
  );

  const openRocks = useMemo(() => allRocks.filter((r) => !r.archived).sort((a, b) => a.order - b.order), [allRocks]);
  const nextOrder = allRocks.length;

  return (
    <Page wide>
      <PageHeader
        eyebrow="Align"
        title="Rocks"
        subtitle={t('Les objectifs de l’entreprise pour le trimestre.', 'The company goals for the quarter.')}
        actions={
          canManage ? (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={16} /> Rock
            </button>
          ) : undefined
        }
      />

      <div className="row row-wrap" style={{ gap: 10, marginBottom: 16 }}>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          aria-label={t('Trimestre précédent', 'Previous quarter')}
          onClick={() => setQuarter((q) => shiftQuarter(q, -1))}
        >
          <ChevronLeft size={16} />
        </button>
        <strong>{quarterLabel(quarter)}</strong>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          aria-label={t('Trimestre suivant', 'Next quarter')}
          onClick={() => setQuarter((q) => shiftQuarter(q, 1))}
        >
          <ChevronRight size={16} />
        </button>
        {quarter !== current && (
          <button className="btn btn-sm" onClick={() => setQuarter(current)}>
            {t('Ce trimestre', 'This quarter')}
          </button>
        )}
        <span className="spacer" />
        <label className="check">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
          {t('Mes Rocks', 'My Rocks')}
        </label>
        <label className="check">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          {t('Afficher les archivés', 'Show archived')}
        </label>
      </div>

      <div className="rock-board">
        {!visible.length && (
          <div className="card rock-empty">
            <Empty icon={<Mountain size={36} />} title={t('Aucun Rock pour ce trimestre', 'No Rock for this quarter')}>
              {canManage && (
                <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
                  <Plus size={14} /> Rock
                </button>
              )}
            </Empty>
          </div>
        )}
        {visible.map((r) => (
          <RockCard
            key={r.id}
            rock={r}
            stats={statsById.get(r.id) ?? { done: 0, total: 0, pct: 0, blocked: 0, overdue: 0, red: 0 }}
            ownerName={userName(r.ownerId ?? undefined)}
          />
        ))}
        <RockUnlinkedCard count={unlinked.length} onOpen={() => setUnlinkedOpen(true)} />
      </div>

      {creating && (
        <RockFormModal
          defaultQuarter={quarter}
          nextOrder={nextOrder}
          thrusts={thrusts}
          people={people}
          onClose={() => setCreating(false)}
        />
      )}
      {unlinkedOpen && (
        <RockUnlinkedModal
          priorities={unlinked}
          rocks={openRocks}
          canLink={canPriorities}
          onOpen={(id) => {
            setUnlinkedOpen(false);
            setOpenPriorityId(id);
          }}
          onClose={() => setUnlinkedOpen(false)}
        />
      )}
      {openPriorityId && <PriorityPanel priorityId={openPriorityId} onClose={() => setOpenPriorityId(null)} />}
    </Page>
  );
}
