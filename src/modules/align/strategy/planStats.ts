/** Derived data of the plan sheet and the 4D Vision: the quarter's Rocks, their progress, and the key initiatives' summaries. Pure functions. */
import { priorityInQuarter, rockProgress } from '../lib';
import type { AlignPriority, Health, Rock } from '../schemas';

/** A Rock of the quarter as shown on the plan: progress and owner's name. */
export interface RockRow {
  rock: Rock;
  pct: number;
  owner: string;
}

/** Non-archived Rocks of a quarter, in their order. */
export function currentRocks(rocks: Rock[], quarter: string): Rock[] {
  return rocks.filter((r) => r.quarter === quarter && !r.archived).sort((a, b) => a.order - b.order);
}

export function rockRowsOf(rocks: Rock[], priorities: AlignPriority[], userName: (id?: string) => string): RockRow[] {
  return rocks.map((rock) => ({ rock, pct: rockProgress(rock, priorities).pct, owner: userName(rock.ownerId ?? undefined) }));
}

export interface InitiativeStat {
  /** Non-archived Rocks linked to the initiative, any quarter. */
  rocks: number;
  /** Priorities of the quarter's Rocks linked to the initiative. */
  priorities: number;
  /** Health of those priorities. */
  health: Record<Health, number>;
}

/** One summary per key initiative (same order as the plan's list). Only the given quarter is counted for priorities. */
export function initiativeStats(count: number, rocks: Rock[], priorities: AlignPriority[], quarter: string): InitiativeStat[] {
  const rockById = new Map(rocks.map((r) => [r.id, r]));
  const stats: InitiativeStat[] = Array.from({ length: count }, () => ({ rocks: 0, priorities: 0, health: { green: 0, yellow: 0, red: 0 } }));
  for (const r of rocks) {
    if (r.archived || r.initiative == null || r.initiative >= count) continue;
    stats[r.initiative].rocks++;
  }
  for (const p of priorities) {
    if (!p.rockId) continue;
    const rock = rockById.get(p.rockId);
    if (!rock || rock.initiative == null || rock.initiative >= count) continue;
    if (!priorityInQuarter(p, quarter, rockById)) continue;
    const s = stats[rock.initiative];
    s.priorities++;
    s.health[p.health]++;
  }
  return stats;
}
