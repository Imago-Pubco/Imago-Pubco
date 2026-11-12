/** Date and status helpers shared by the Tools → KPI screens. All dates are local calendar dates, YYYY-MM-DD. */
import type { Kpi, Status } from './schemas';

const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Parses YYYY-MM-DD as a local date (never through UTC, which can shift the day). */
export const parseDate = (s: string) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));

/** Monday of the week containing `d`. */
export function mondayOf(d: Date | string = new Date()): string {
  const x = typeof d === 'string' ? parseDate(d) : new Date(d);
  const back = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - back);
  return iso(x);
}
export const currentWeek = () => mondayOf(new Date());
export function addDays(date: string, n: number): string {
  const x = parseDate(date);
  x.setDate(x.getDate() + n);
  return iso(x);
}
export const addWeeks = (week: string, n: number) => addDays(week, 7 * n);
export const monthStart = (d: Date | string = new Date()) => {
  const x = typeof d === 'string' ? parseDate(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-01`;
};
export function addMonths(month: string, n: number): string {
  const x = parseDate(month);
  x.setMonth(x.getMonth() + n, 1);
  return iso(x);
}

/** The last `count` periods ending with the current one, oldest first: weeks (Mondays) or months (1st). */
export function recentPeriods(frequency: 'weekly' | 'monthly', count: number, end = new Date()): string[] {
  const last = frequency === 'weekly' ? mondayOf(end) : monthStart(end);
  return Array.from({ length: count }, (_, i) => (frequency === 'weekly' ? addWeeks(last, i - count + 1) : addMonths(last, i - count + 1)));
}

/** "9 nov. – 15 nov. 2026" for a week, "novembre 2026" for a month. */
export function periodLabel(period: string, frequency: 'weekly' | 'monthly', lang: string): string {
  const loc = lang === 'fr' ? 'fr-CA' : 'en-CA';
  const d = parseDate(period);
  if (frequency === 'monthly') return d.toLocaleDateString(loc, { month: 'long', year: 'numeric' });
  const end = parseDate(addDays(period, 6));
  const short = (x: Date) => x.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  return `${short(d)} – ${short(end)} ${end.getFullYear()}`;
}
export const shortPeriod = (period: string, lang: string) => parseDate(period).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { day: 'numeric', month: 'short' });

/** Quarter containing a date: start, end and a key like "2026-Q4". */
export function quarterOf(d: Date = new Date()): { start: string; end: string; key: string } {
  const q = Math.floor(d.getMonth() / 3);
  const start = new Date(d.getFullYear(), q * 3, 1);
  const end = new Date(d.getFullYear(), q * 3 + 3, 0);
  return { start: iso(start), end: iso(end), key: `${d.getFullYear()}-Q${q + 1}` };
}

/** Colour of an indicator value against its target: green = on target, yellow = within 10 %, red = further. */
export function kpiStatus(kpi: Pick<Kpi, 'target' | 'direction'>, value: number | null | undefined): Status | 'none' {
  if (value === null || value === undefined || kpi.target === null) return 'none';
  const t = kpi.target;
  const ok = kpi.direction === 'up' ? value >= t : value <= t;
  if (ok) return 'green';
  const gap = Math.abs(value - t);
  const tol = Math.abs(t) * 0.1 || 0.1;
  return gap <= tol ? 'yellow' : 'red';
}

export const STATUS_COLOR: Record<Status | 'none', string> = {
  green: 'var(--ok)',
  yellow: 'var(--warn)',
  red: 'var(--err)',
  none: 'var(--text-3)',
};

/** 12.5 -> "12,5 %", 1200 -> "1 200 $" using the locale; the unit follows after a space. */
export function formatValue(value: number | null | undefined, unit: string, lang: string): string {
  if (value === null || value === undefined) return '—';
  const n = value.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 2 });
  return unit ? `${n} ${unit}` : n;
}

/** Ids of the documents that exist once per key: re-entering a value replaces the previous one. */
export const kpiValueId = (kpiId: string, period: string) => `${kpiId}_${period}`;
export const priorityUpdateId = (priorityId: string, week: string) => `${priorityId}_${week}`;
export const huddleEntryId = (huddleId: string, week: string, userId: string) => `${huddleId}_${week}_${userId}`;
