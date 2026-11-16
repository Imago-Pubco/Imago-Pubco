/** Helpers of the Huddles screens (pure, no React). */
import type { L } from '@/i18n';
import type { Lang } from '@/data/types';
import type { AlignHuddle, AlignNote, Cadence } from '../schemas';

export const CADENCE_LABEL: Record<Cadence, L> = {
  daily: { fr: 'Quotidienne', en: 'Daily' },
  weekly: { fr: 'Hebdomadaire', en: 'Weekly' },
  monthly: { fr: 'Mensuelle', en: 'Monthly' },
};

/** Index = dayOfWeek (0 = Sunday … 6 = Saturday). */
export const WEEKDAY_LABEL: L[] = [
  { fr: 'Dimanche', en: 'Sunday' },
  { fr: 'Lundi', en: 'Monday' },
  { fr: 'Mardi', en: 'Tuesday' },
  { fr: 'Mercredi', en: 'Wednesday' },
  { fr: 'Jeudi', en: 'Thursday' },
  { fr: 'Vendredi', en: 'Friday' },
  { fr: 'Samedi', en: 'Saturday' },
];

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const VIDEO_RE = /^https?:\/\//i;

/** "Hebdomadaire · Lundi · 09:00–09:30" (the day is left out for daily huddles). */
export function scheduleLabel(h: Pick<AlignHuddle, 'cadence' | 'dayOfWeek' | 'startTime' | 'endTime'>, lang: Lang): string {
  const parts = [CADENCE_LABEL[h.cadence][lang]];
  if (h.cadence !== 'daily') parts.push(WEEKDAY_LABEL[h.dayOfWeek]?.[lang] ?? '');
  if (h.startTime) parts.push(h.endTime ? `${h.startTime}–${h.endTime}` : h.startTime);
  return parts.filter(Boolean).join(' · ');
}

/** Short date from a YYYY-MM-DD value, read as a local day (no timezone shift). */
export function fmtDay(d: string | null | undefined, lang: Lang): string {
  if (!d) return '—';
  return new Date(`${d}T12:00:00`).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'medium' });
}

/** Managers may edit any huddle; the huddle owner may edit (and delete) their own. */
export const canEditHuddle = (h: AlignHuddle, userId: string, canManage: boolean) => canManage || h.ownerId === userId;

/** A follow-up can be ticked by its author, its assignee, or anyone who manages priorities (server rule). */
export const canTickNote = (n: AlignNote, userId: string, canManage: boolean) =>
  canManage || n.createdBy === userId || n.assigneeId === userId;

export function groupBy<T>(rows: T[], key: (r: T) => string | null | undefined): Map<string, T[]> {
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

/** Sort by due date, undated last. */
export const byDue = (a: { dueDate: string | null }, b: { dueDate: string | null }) =>
  (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31');

