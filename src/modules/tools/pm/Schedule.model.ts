/** Pure helpers of the Gantt timeline (Tools → Gestion de projet → Planification). No React here. */
import { addDays, addMonths, mondayOf, monthStart, parseDate, quarterOf } from '../lib';
import { isLate } from './lib';
import type { Client, PmTask, Project } from './schemas';

export type Zoom = 'week' | 'month' | 'quarter';
export const ZOOMS: Zoom[] = ['week', 'month', 'quarter'];
/** Width of one day column per zoom level. */
const DAY_W: Record<Zoom, number> = { week: 56, month: 24, quarter: 8 };

export interface Range {
  zoom: Zoom;
  /** First and last visible day (YYYY-MM-DD). */
  start: string;
  end: string;
  days: number;
  dayW: number;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). Robust to DST shifts. */
export const diffDays = (from: string, to: string) => Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);

/** The visible window around an anchor date: 2 weeks, one month, or one quarter. */
export function rangeOf(zoom: Zoom, anchor: string): Range {
  let start: string;
  let days: number;
  if (zoom === 'week') {
    start = mondayOf(anchor);
    days = 14;
  } else if (zoom === 'month') {
    start = monthStart(anchor);
    const d = parseDate(start);
    days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  } else {
    const q = quarterOf(parseDate(anchor));
    start = q.start;
    days = diffDays(q.start, q.end) + 1;
  }
  return { zoom, start, end: addDays(start, days - 1), days, dayW: DAY_W[zoom] };
}

/** Anchor date of the window one step before (-1) or after (+1) the current one. */
export function stepAnchor(r: Range, dir: -1 | 1): string {
  if (r.zoom === 'week') return addDays(r.start, 7 * dir);
  if (r.zoom === 'month') return addMonths(r.start, dir);
  return addMonths(r.start, 3 * dir);
}

/** Anchor kept when switching zoom: the middle day of the current window. */
export const centreAnchor = (r: Range) => addDays(r.start, Math.floor(r.days / 2));

/** Left and width (px) of a date span inside the window, or null when it does not overlap it. */
export function barGeom(r: Range, start: string, end: string): { left: number; width: number } | null {
  if (end < r.start || start > r.end) return null;
  const s = start < r.start ? r.start : start;
  const e = end > r.end ? r.end : end;
  return { left: diffDays(r.start, s) * r.dayW, width: (diffDays(s, e) + 1) * r.dayW };
}

export interface Filters {
  clientId: string;
  projectId: string;
  /** Person: keeps projects they are on and only their tasks. */
  userId: string;
  /** Only projects I manage or am a member of. */
  mine: boolean;
}

export interface ProjectRow {
  project: Project;
  clientName: string;
  /** Tasks shown under the project (filtered by person), by order then start date. */
  tasks: PmTask[];
  /** Share of done tasks over all the project's tasks. */
  total: number;
  done: number;
  /** The project has both dates: its bar is drawn. */
  hasBar: boolean;
}

export interface UnplannedItem {
  project: Project;
  /** Undated task; absent when the whole project is unplanned. */
  task?: PmTask;
}

export const STATUS_BAR: Record<PmTask['status'], string> = {
  todo: 'var(--text-3)',
  doing: 'var(--accent)',
  review: 'var(--warn)',
  done: 'var(--ok)',
};

/** Accepts only plain colour values; anything else falls back to the accent colour. */
export const safeColor = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c.trim()) ? c.trim() : 'var(--accent)');

/** Bar colour of a task: late tasks are red, otherwise by status. */
export const taskColor = (t: PmTask, today: string) => (isLate(t, today) ? 'var(--err)' : STATUS_BAR[t.status]);

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** Projects and tasks as the timeline shows them, after the filters. */
export function buildSchedule(input: {
  projects: Project[];
  tasks: PmTask[];
  clients: Client[];
  filters: Filters;
  me: string;
}): { rows: ProjectRow[]; unplanned: UnplannedItem[] } {
  const { projects, tasks, clients, filters, me } = input;
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const byProject = new Map<string, PmTask[]>();
  for (const t of tasks) byProject.set(t.projectId, [...(byProject.get(t.projectId) ?? []), t]);
  for (const list of byProject.values()) list.sort((a, b) => a.order - b.order);

  const rows: ProjectRow[] = [];
  const unplanned: UnplannedItem[] = [];
  for (const p of projects) {
    if (p.status === 'archived') continue;
    if (filters.clientId && p.clientId !== filters.clientId) continue;
    if (filters.projectId && p.id !== filters.projectId) continue;
    const all = byProject.get(p.id) ?? [];
    const involved = (uid: string) => p.managerId === uid || p.memberIds.includes(uid) || all.some((t) => t.assigneeIds.includes(uid));
    if (filters.mine && !involved(me)) continue;
    if (filters.userId && !involved(filters.userId)) continue;

    const shown = filters.userId ? all.filter((t) => t.assigneeIds.includes(filters.userId)) : all;
    const dated = shown.filter((t) => t.startDate || t.dueDate);
    const hasBar = !!(p.startDate && p.endDate);
    if (!hasBar && !dated.length) {
      unplanned.push({ project: p });
      continue;
    }
    for (const t of shown) if (!t.startDate && !t.dueDate) unplanned.push({ project: p, task: t });
    rows.push({
      project: p,
      clientName: clientName.get(p.clientId ?? '') ?? '',
      tasks: dated,
      total: all.length,
      done: all.filter((t) => t.status === 'done').length,
      hasBar,
    });
  }
  rows.sort((a, b) => (a.project.startDate || '9999').localeCompare(b.project.startDate || '9999') || a.project.code.localeCompare(b.project.code));
  return { rows, unplanned };
}

/** Span of a task on the timeline: a single date is a milestone (start = end). */
export const taskSpan = (t: PmTask): { start: string; end: string } | null => {
  const a = t.startDate ?? t.dueDate;
  const b = t.dueDate ?? t.startDate;
  if (!a || !b) return null;
  // Dates are not ordered by the server: draw the span between the two.
  return a <= b ? { start: a, end: b } : { start: b, end: a };
};
