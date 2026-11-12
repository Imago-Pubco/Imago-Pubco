/** Shared helpers of the Tasks page and TaskModal (labels, permissions, dependency and order rules). */
import { addDays, counted, iso, mondayOf, parseDate } from './lib';
import { TASK_PRIORITY, TASK_STATUS, type PmTask, type Project, type TaskStatus, type TimeEntry } from './schemas';

export type TaskPriority = (typeof TASK_PRIORITY)[number];

export const STATUS_ORDER: readonly TaskStatus[] = TASK_STATUS;
export const PRIORITY_ORDER: readonly TaskPriority[] = ['urgent', 'high', 'normal', 'low'];

export const STATUS_LABEL: Record<TaskStatus, { fr: string; en: string }> = {
  todo: { fr: 'À faire', en: 'To do' },
  doing: { fr: 'En cours', en: 'In progress' },
  review: { fr: 'En revue', en: 'In review' },
  done: { fr: 'Terminée', en: 'Done' },
};

export const PRIORITY_LABEL: Record<TaskPriority, { fr: string; en: string }> = {
  urgent: { fr: 'Urgente', en: 'Urgent' },
  high: { fr: 'Haute', en: 'High' },
  normal: { fr: 'Normale', en: 'Normal' },
  low: { fr: 'Basse', en: 'Low' },
};

/** Badge colour per priority (existing global badge classes). */
export const PRIORITY_BADGE: Record<TaskPriority, string> = {
  urgent: 'badge-err',
  high: 'badge-warn',
  normal: 'badge-info',
  low: '',
};

/** Badge colour per status. */
export const STATUS_BADGE: Record<TaskStatus, string> = {
  todo: '',
  doing: 'badge-info',
  review: 'badge-accent',
  done: 'badge-ok',
};

/** Is the person on this project (as manager, member, or a manager of the module)? */
export function isOnProject(p: Pick<Project, 'managerId' | 'memberIds'>, userId: string, manage: boolean): boolean {
  return manage || p.managerId === userId || p.memberIds.includes(userId);
}

/** People who can be assigned to a task of this project: its members and its manager. */
export function projectPeople(p: Pick<Project, 'managerId' | 'memberIds'> | undefined): string[] {
  if (!p) return [];
  return [...new Set([...(p.managerId ? [p.managerId] : []), ...p.memberIds])];
}

/** New task order: the highest order of the project's tasks + 1 (0 when it has none). */
export function nextOrder(tasks: Pick<PmTask, 'projectId' | 'order'>[], projectId: string): number {
  const orders = tasks.filter((t) => t.projectId === projectId).map((t) => t.order);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

/**
 * Tasks of the same project that may be chosen as this task's dependency: not itself, and not a task that already
 * depends (directly or through others) on this one, which would make a cycle the server refuses.
 */
export function dependencyCandidates(all: PmTask[], task: Pick<PmTask, 'id' | 'projectId'> | undefined, projectId: string): PmTask[] {
  const byId = new Map(all.map((t) => [t.id, t]));
  const dependsOnSelf = (cand: PmTask) => {
    if (!task) return false;
    let cur: PmTask | undefined = cand;
    for (let i = 0; cur && i < 200; i++) {
      if (cur.dependsOnId === task.id) return true;
      cur = cur.dependsOnId ? byId.get(cur.dependsOnId) : undefined;
    }
    return false;
  };
  return all
    .filter((t) => t.projectId === projectId && t.id !== task?.id && !dependsOnSelf(t))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** Hours booked per task (time not rejected). */
export function bookedByTask(entries: Pick<TimeEntry, 'taskId' | 'hours' | 'status'>[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    if (!e.taskId || !counted(e)) continue;
    m.set(e.taskId, (m.get(e.taskId) ?? 0) + e.hours);
  }
  return m;
}

/** Monday and Sunday (YYYY-MM-DD) of the current week. */
export function currentWeekRange(): { from: string; to: string } {
  const from = mondayOf(new Date());
  return { from, to: addDays(from, 6) };
}

export const inRange = (d: string | undefined, from: string, to: string) => !!d && d >= from && d <= to;

/** Local calendar date of an ISO timestamp. */
export const localDay = (ts: string) => iso(new Date(ts));

/** "12 nov. 2026" from a YYYY-MM-DD date. */
export const fmtDay = (d: string, lang: string) => parseDate(d).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { day: 'numeric', month: 'short', year: 'numeric' });

/** Sort: due date first (undated last), then name. */
export function byDue(a: Pick<PmTask, 'dueDate' | 'name'>, b: Pick<PmTask, 'dueDate' | 'name'>): number {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
  return a.name.localeCompare(b.name);
}
