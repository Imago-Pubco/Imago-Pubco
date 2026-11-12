/** Quarter, ordering and grouping helpers of the priorities screen. */
import { parseDate, quarterOf } from './lib';
import type { Priority, Status } from './schemas';

export interface Quarter {
  start: string;
  end: string;
  /** e.g. "2026-Q4" */
  key: string;
  year: number;
  /** 1 to 4 */
  q: number;
}

export function quarterFrom(d: Date): Quarter {
  const { start, end, key } = quarterOf(d);
  return { start, end, key, year: Number(key.slice(0, 4)), q: Number(key.slice(6)) };
}

/** The quarter `n` quarters away from `qt` (negative = earlier). */
export function shiftQuarter(qt: Quarter, n: number): Quarter {
  return quarterFrom(new Date(qt.year, (qt.q - 1) * 3 + n * 3, 1));
}

/** "T4 2026" (fr) or "Q4 2026" (en). */
export function quarterTitle(qt: Quarter, lang: string): string {
  return `${lang === 'fr' ? 'T' : 'Q'}${qt.q} ${qt.year}`;
}

/** "1 oct. – 31 déc." */
export function quarterRange(qt: Quarter, lang: string): string {
  const loc = lang === 'fr' ? 'fr-CA' : 'en-CA';
  const fmt = (s: string) => parseDate(s).toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  return `${fmt(qt.start)} – ${fmt(qt.end)}`;
}

export const STATUS_LABEL: Record<Status, [string, string]> = {
  green: ['Vert', 'Green'],
  yellow: ['Jaune', 'Yellow'],
  red: ['Rouge', 'Red'],
};

export const byOrder = (a: Priority, b: Priority) => a.order - b.order || a.title.localeCompare(b.title);

/** Progress as an integer between 0 and 100 (NaN becomes 0). */
export const clamp = (n: number) => (Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0);

/** Rows grouped by key; rows without a key are left out. */
export function groupBy<T>(rows: T[], key: (r: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}
