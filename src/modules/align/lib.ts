/** Pure helpers shared by the Align screens (no React, no storage). */
import type { L } from '@/i18n';
import type { AlignPriority, Health, PriorityStatus, Rock, Strategy } from './schemas';
import { ARCHIVE_STRATEGY } from './archive';

/* ---------- quarters ---------- */

export function quarterOf(d: Date = new Date()): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export function shiftQuarter(q: string, by: number): string {
  const [y, n] = q.split('-Q').map(Number);
  const i = y * 4 + (n - 1) + by;
  return `${Math.floor(i / 4)}-Q${(i % 4) + 1}`;
}

/** First and last day (YYYY-MM-DD) of a quarter. */
export function quarterRange(q: string): { start: string; end: string } {
  const [y, n] = q.split('-Q').map(Number);
  const m = (n - 1) * 3;
  const pad = (x: number) => String(x).padStart(2, '0');
  const last = new Date(y, m + 3, 0).getDate();
  return { start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 3)}-${pad(last)}` };
}

export const quarterLabel = (q: string) => q.replace('-Q', ' · T');

/** Today as YYYY-MM-DD in the local time zone (toISOString() is UTC: after ~19:00 in Québec it is already tomorrow). */
export function todayIso(d: Date = new Date()): string {
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Does a priority belong to quarter `q`? Its rock decides when it has one (archived rocks count for nothing);
 * otherwise its due date does; an undated priority without a rock shows in the current quarter only.
 * The one rule used by the dashboard, the Rocks board, the huddles and the checklist.
 */
export function priorityInQuarter(p: AlignPriority, q: string, rockById: Map<string, Rock>): boolean {
  if (p.archived) return false;
  const rock = p.rockId ? rockById.get(p.rockId) : undefined;
  if (rock) return rock.quarter === q && !rock.archived;
  if (p.rockId) return false; // points at a rock that no longer exists
  if (!p.dueDate) return q === quarterOf();
  const { start, end } = quarterRange(q);
  return p.dueDate >= start && p.dueDate <= end;
}

/** A completed priority is at 100 %; any other status keeps the entered progress (0–100). */
export function normalizeProgress(status: PriorityStatus, progress: number): number {
  const v = Math.round(Math.min(100, Math.max(0, progress)));
  return status === 'completed' ? 100 : v;
}

/* ---------- progress ---------- */

/** Priorities that count for a rock: linked to it and not archived. */
export const rockPriorities = (rock: Rock, all: AlignPriority[]) => all.filter((p) => p.rockId === rock.id && !p.archived);

/**
 * Rock progress = share of its priorities that are completed (4 priorities → 25 % each; adding one re-balances).
 * A rock without priorities is at 0 %.
 */
export function rockProgress(rock: Rock, all: AlignPriority[]): { done: number; total: number; pct: number } {
  const list = rockPriorities(rock, all);
  const done = list.filter((p) => p.status === 'completed').length;
  return { done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
}

/** Advancement of a priority, as shown in bars: completed counts as 100. */
export const priorityPct = (p: AlignPriority) => (p.status === 'completed' ? 100 : p.progress);

type PriorityLookup = AlignPriority[] | Map<string, AlignPriority>;
/** Lookup by id; pass a Map (built once with useMemo) when calling this in a loop. */
const lookup = (all: PriorityLookup, id: string) => (all instanceof Map ? all.get(id) : all.find((x) => x.id === id));

/** A priority is blocked when it waits for another priority that is not completed yet. */
export function isBlocked(p: AlignPriority, all: PriorityLookup): boolean {
  if (!p.blockedById || p.status === 'completed') return false;
  const by = lookup(all, p.blockedById);
  return !!by && by.status !== 'completed';
}

/** Would setting `p` as blocked by `byId` create a loop (A waits for B waits for A)? */
export function wouldCycle(pId: string, byId: string, all: PriorityLookup): boolean {
  const seen = new Set<string>([pId]);
  let cur: string | null = byId;
  while (cur) {
    if (seen.has(cur)) return true;
    seen.add(cur);
    cur = lookup(all, cur)?.blockedById ?? null;
  }
  return false;
}

export const isOverdue = (p: AlignPriority, today = todayIso()) =>
  !!p.dueDate && p.status !== 'completed' && p.dueDate < today;

/* ---------- labels ---------- */

export const STATUS_LABEL: Record<PriorityStatus, L> = {
  not_started: { fr: 'Non commencée', en: 'Not started' },
  in_progress: { fr: 'En cours', en: 'In progress' },
  completed: { fr: 'Terminée', en: 'Completed' },
};

export const HEALTH_LABEL: Record<Health, L> = {
  green: { fr: 'En bonne voie', en: 'On track' },
  yellow: { fr: 'À risque', en: 'At risk' },
  red: { fr: 'En retard', en: 'Off track' },
};

/** CSS colour token per health. */
export const HEALTH_COLOR: Record<Health, string> = { green: 'var(--ok)', yellow: 'var(--warn)', red: 'var(--err)' };

/* ---------- strategy ---------- */

/** Pubco's plan as captured from Align (archive.ts). Used until the plan is saved. */
export const DEFAULT_STRATEGY: Strategy = ARCHIVE_STRATEGY;

/** The saved plan, or the default one; missing fields of an older document are filled from the default. */
export const planOrDefault = (saved?: Strategy | null): Strategy => ({ ...DEFAULT_STRATEGY, ...(saved ?? {}) });
