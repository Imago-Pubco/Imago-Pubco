/** Pure helpers of the availability view (Tools → Gestion de projet → Charge). Every number comes from ./lib. */
import { addWeeks, parseDate } from '../lib';
import { availability, plannedOn, sum, weekDays } from './lib';
import type { PmTask, Staff, TimeEntry, TimeOff } from './schemas';

export const WEEKS = 8;
export const weekList = (start: string) => Array.from({ length: WEEKS }, (_, i) => addWeeks(start, i));

/** Load colour: under 70 % light, 70 to 100 % on target, over 100 % overbooked. */
export type Level = 'none' | 'low' | 'ok' | 'over';
export function levelOf(pct: number | null): Level {
  if (pct === null) return 'none';
  if (pct > 100) return 'over';
  if (pct >= 70) return 'ok';
  return 'low';
}

export interface Cell {
  capacity: number;
  planned: number;
  worked: number;
  /** planned / capacity in %, null when the person has no capacity that week. */
  pct: number | null;
  level: Level;
}

export function cellOf(
  userId: string,
  week: string,
  s: Staff | undefined,
  off: TimeOff[],
  tasks: PmTask[],
  entries: TimeEntry[],
  staffOf: (id: string) => Staff | undefined,
): Cell {
  const a = availability(userId, weekDays(week), s, off, tasks, entries, staffOf);
  const pct = a.capacity > 0 ? (a.planned / a.capacity) * 100 : null;
  return { capacity: a.capacity, planned: a.planned, worked: a.worked, pct, level: levelOf(pct) };
}

/** Week (Monday) that is the current one or in the past: worked hours are shown only then. */
export const isPastOrCurrent = (week: string, thisWeekStart: string) => week <= thisWeekStart;

export interface PlannedLine {
  task: PmTask;
  /** Hours of this task planned for the person that week (their share of the estimate). */
  hours: number;
}

/** The open tasks a person has planned work on during a week, with their share of hours. */
export function plannedTasksOf(userId: string, week: string, tasks: PmTask[], staffOf: (id: string) => Staff | undefined): PlannedLine[] {
  const days = weekDays(week);
  return tasks
    .filter((t) => t.assigneeIds.includes(userId))
    .map((task) => ({ task, hours: sum(days.map((d) => plannedOn(d, userId, [task], staffOf))) }))
    .filter((l) => l.hours > 0)
    .sort((a, b) => (a.task.dueDate ?? '9999').localeCompare(b.task.dueDate ?? '9999'));
}

/** Time off that overlaps a week. */
export const offsIn = (week: string, off: TimeOff[], userId: string) => {
  const end = weekDays(week)[6];
  return off.filter((o) => o.userId === userId && o.startDate <= end && o.endDate >= week).sort((a, b) => a.startDate.localeCompare(b.startDate));
};

/** Short label of a week: "9 nov." style, locale-aware. */
export const weekLabel = (week: string, lang: string) => parseDate(week).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { day: 'numeric', month: 'short' });

export const LEVEL_STYLE: Record<Level, { background: string; border: string; color: string }> = {
  none: { background: 'var(--bg-sunken)', border: 'transparent', color: 'var(--text-3)' },
  low: { background: 'transparent', border: 'var(--border)', color: 'var(--text-2)' },
  ok: { background: 'color-mix(in srgb, var(--ok) 16%, transparent)', border: 'transparent', color: 'var(--ok)' },
  over: { background: 'var(--err-bg)', border: 'transparent', color: 'var(--err)' },
};
