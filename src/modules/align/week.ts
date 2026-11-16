/**
 * Work weeks (Monday to Friday) for huddles, check-ins and weekly tasks. A week is identified by its Monday, as a
 * local YYYY-MM-DD day (never through toISOString(), which is UTC).
 */
import type { Lang } from '@/data/types';
import { quarterOf, todayIso } from './lib';

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** The Monday of the week containing `d` (Saturday and Sunday belong to the week that just ended). */
export function mondayOf(d: Date = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay(); // 0 = Sunday
  x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1));
  return todayIso(x);
}

/** The current week's Monday. */
export const thisWeek = () => mondayOf();

/** Move a week by `by` weeks. */
export function shiftWeek(week: string, by: number): string {
  const x = parse(week);
  x.setDate(x.getDate() + by * 7);
  return todayIso(x);
}

/** The Friday of a week. */
export const fridayOf = (week: string) => {
  const x = parse(week);
  x.setDate(x.getDate() + 4);
  return todayIso(x);
};

/** A valid Monday from a URL parameter, or the current week. */
export function weekFromParam(v: string | null | undefined): string {
  if (!v || !WEEK_RE.test(v)) return thisWeek();
  const x = parse(v);
  if (Number.isNaN(x.getTime()) || todayIso(x) !== v) return thisWeek();
  return mondayOf(x);
}

/** "16 – 20 nov. 2026" / "Nov 16 – 20, 2026" (Monday to Friday). */
export function weekLabel(week: string, lang: Lang): string {
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
  const a = parse(week);
  const b = parse(fridayOf(week));
  const sameMonth = a.getMonth() === b.getMonth();
  const day = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric' });
  const full = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const dm = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  if (lang === 'fr') return sameMonth ? `${day(a)} – ${full(b)}` : `${dm(a)} – ${full(b)}`;
  return sameMonth
    ? `${a.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} – ${day(b)}, ${b.getFullYear()}`
    : `${a.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} – ${b.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}, ${b.getFullYear()}`;
}

/** The quarter a week belongs to (by its Monday). */
export const quarterOfWeek = (week: string) => quarterOf(parse(week));

/** Ids of the per-week documents. */
export const checkinId = (userId: string, week: string) => `${userId}_${week}`;
export const huddleWeekId = (huddleId: string, week: string) => `${huddleId}_${week}`;
