/** Pure derivations for the Align dashboard (no React). Everything is computed for one quarter. */
import { isBlocked, isOverdue, priorityInQuarter, rockPriorities, rockProgress } from '../lib';
import type { AlignPriority, Health, PriorityStatus, Rock, Strategy } from '../schemas';

export interface RockRow {
  rock: Rock;
  done: number;
  total: number;
  pct: number;
  /** Non-archived priorities linked to the rock. */
  priorities: AlignPriority[];
}

export interface QuarterModel {
  rockRows: RockRow[];
  /** Non-archived priorities that belong to the quarter. */
  priorities: AlignPriority[];
  /** Quarter priorities that are not attached to a rock of the quarter. */
  unlinked: AlignPriority[];
  status: Record<PriorityStatus, number>;
  health: Record<Health, number>;
  kpi: {
    rockAvg: number;
    rocksDone: number;
    rocksTotal: number;
    prioDone: number;
    prioTotal: number;
    prioPct: number;
    blocked: number;
    overdue: number;
  };
}

/** Quarter membership is decided by `priorityInQuarter` (lib.ts), the one rule shared by all Align screens. */
export function buildQuarter(q: string, allRocks: Rock[], allPriorities: AlignPriority[], today: string): QuarterModel {
  const rocks = allRocks.filter((r) => r.quarter === q && !r.archived).sort((a, b) => a.order - b.order);
  const rockIds = new Set(rocks.map((r) => r.id));
  const rockById = new Map(allRocks.map((r) => [r.id, r] as const));
  const prioById = new Map(allPriorities.map((p) => [p.id, p] as const));

  const priorities = allPriorities.filter((p) => priorityInQuarter(p, q, rockById));
  const unlinked = priorities.filter((p) => !(p.rockId && rockIds.has(p.rockId)));

  const rockRows: RockRow[] = rocks.map((rock) => ({
    rock,
    ...rockProgress(rock, allPriorities),
    priorities: rockPriorities(rock, allPriorities),
  }));

  const status: Record<PriorityStatus, number> = { not_started: 0, in_progress: 0, completed: 0 };
  const health: Record<Health, number> = { green: 0, yellow: 0, red: 0 };
  let blocked = 0;
  let overdue = 0;
  for (const p of priorities) {
    status[p.status] += 1;
    health[p.health] += 1;
    if (isBlocked(p, prioById)) blocked += 1;
    if (isOverdue(p, today)) overdue += 1;
  }

  const prioTotal = priorities.length;
  const prioDone = status.completed;
  const rockAvg = rockRows.length ? Math.round(rockRows.reduce((s, r) => s + r.pct, 0) / rockRows.length) : 0;

  return {
    rockRows,
    priorities,
    unlinked,
    status,
    health,
    kpi: {
      rockAvg,
      rocksDone: rockRows.filter((r) => r.pct === 100).length,
      rocksTotal: rockRows.length,
      prioDone,
      prioTotal,
      prioPct: prioTotal ? Math.round((prioDone / prioTotal) * 100) : 0,
      blocked,
      overdue,
    },
  };
}

/** The user's open priorities (all periods), soonest due date first, undated last. */
export function myOpenPriorities(all: AlignPriority[], userId?: string): AlignPriority[] {
  if (!userId) return [];
  return all
    .filter((p) => !p.archived && p.ownerId === userId && p.status !== 'completed')
    .sort((a, b) => (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31') || a.title.localeCompare(b.title));
}

/** Thrust index of a rock if it points to an existing key thrust of the plan, else null. */
export function thrustOf(rock: Rock, plan: Strategy): number | null {
  return rock.thrust !== null && rock.thrust < plan.keyThrusts.length ? rock.thrust : null;
}
