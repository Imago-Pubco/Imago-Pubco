/** Pure helpers of the Tools → KPI dashboard. */
import type { Huddle, KpiValue } from './schemas';
import { addDays, addMonths, currentWeek, iso, monthStart } from './lib';

const DAY = 864e5;

export const todayIso = (): string => iso(new Date());

/** Locale used for dates on the dashboard. */
export const localeOf = (lang: string): string => (lang === 'fr' ? 'fr-CA' : 'en-CA');

/** Last completed period: the Monday before this week, or the 1st of last month. */
export function previousPeriod(frequency: 'weekly' | 'monthly'): string {
  return frequency === 'weekly' ? addDays(currentWeek(), -7) : addMonths(monthStart(), -1);
}

/** kpiId -> period -> value (null = not applicable or missing). */
export type ValueIndex = Map<string, Map<string, number | null>>;

export function indexValues(rows: KpiValue[]): ValueIndex {
  const index: ValueIndex = new Map();
  for (const v of rows) {
    const byPeriod = index.get(v.kpiId) ?? new Map<string, number | null>();
    byPeriod.set(v.period, v.value);
    index.set(v.kpiId, byPeriod);
  }
  return index;
}

/** The latest two non-null values of a KPI, newest first. */
export function latestTwo(byPeriod: Map<string, number | null> | undefined): { period: string; value: number }[] {
  if (!byPeriod) return [];
  return [...byPeriod.entries()]
    .flatMap(([period, value]) => (value === null ? [] : [{ period, value }]))
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 2);
}

/** Values of the given periods in order, null where missing. */
export function valuesFor(byPeriod: Map<string, number | null> | undefined, periods: string[]): (number | null)[] {
  return periods.map((p) => byPeriod?.get(p) ?? null);
}

/** Calendar days from `now` to `at` (0 = same day, negative = past). */
export function dayDiff(at: Date, now: Date): number {
  const a = Date.UTC(at.getFullYear(), at.getMonth(), at.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / DAY);
}

/**
 * Next time a huddle takes place, on or after `now` (local time). Without a start time the whole day
 * counts as still ahead. Monthly huddles use the weekday of the next occurrence.
 */
export function nextOccurrence(h: Pick<Huddle, 'cadence' | 'dayOfWeek' | 'startTime'>, now: Date): Date {
  const [hh = 0, mm = 0] = h.startTime ? h.startTime.split(':').map(Number) : [];
  const onDay = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hh, mm);
  const ahead = (d: Date) => (h.startTime ? d.getTime() >= now.getTime() : d.getTime() + DAY > now.getTime());
  if (h.cadence === 'daily') {
    const today = onDay(0);
    return ahead(today) ? today : onDay(1);
  }
  const diff = (h.dayOfWeek - now.getDay() + 7) % 7;
  const first = onDay(diff);
  return ahead(first) ? first : onDay(diff + 7);
}
