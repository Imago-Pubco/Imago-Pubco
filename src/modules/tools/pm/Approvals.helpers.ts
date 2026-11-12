import type { TimeEntry } from './schemas';
import { mondayOf, round2 } from './lib';

/** The entries of one person for one week (Monday). */
export interface PersonWeek {
  key: string;
  userId: string;
  week: string;
  entries: TimeEntry[];
  hours: number;
  /** Latest review date among the entries ('' when none). */
  reviewedAt: string;
}

/** Groups entries by person and week, entries sorted by date inside each group. */
export function groupByPersonWeek(list: TimeEntry[]): PersonWeek[] {
  const map = new Map<string, PersonWeek>();
  for (const e of list) {
    const week = mondayOf(e.date);
    const key = `${e.userId}|${week}`;
    let g = map.get(key);
    if (!g) {
      g = { key, userId: e.userId, week, entries: [], hours: 0, reviewedAt: '' };
      map.set(key, g);
    }
    g.entries.push(e);
    g.hours = round2(g.hours + e.hours);
    if (e.reviewedAt && e.reviewedAt > g.reviewedAt) g.reviewedAt = e.reviewedAt;
  }
  for (const g of map.values()) g.entries.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return [...map.values()];
}
