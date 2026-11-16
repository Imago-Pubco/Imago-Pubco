/** Pure helpers of the weekly tasks (no React, no storage). */
import type { L } from '@/i18n';
import type { AlignTask, TaskKind } from '../schemas';

/** The owner, the creator, or a manager may edit (and delete) a task. */
export const canEditTask = (t: AlignTask, userId: string, canManage: boolean) =>
  canManage || t.ownerId === userId || t.createdBy === userId;

/** The order people chose (drag and drop), then by title. Done actions stay where they are, struck through. */
export const sortTasks = (a: AlignTask, b: AlignTask) => a.order - b.order || a.title.localeCompare(b.title);

export const TASK_KIND_LABEL: Record<TaskKind, L> = {
  weekly: { fr: 'Action hebdo', en: 'Weekly action' },
  rock: { fr: 'Action Rock', en: 'Rock action' },
};

/** The day an action started: its first creation day (kept across postponements), else when it was stored, else its week. */
export const taskSince = (t: AlignTask): string => t.since ?? t.createdAt?.slice(0, 10) ?? t.weekStart;

/** Whole days since the action started. */
export function taskAgeDays(t: AlignTask, today = new Date()): number {
  const [y, m, d] = taskSince(t).split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000));
}

export type Staleness = 'none' | 'warn' | 'alert';

/** Not done after 2 weeks: warn (orange). After 3 weeks: alert (red). */
export function taskStaleness(t: AlignTask, today = new Date()): Staleness {
  if (t.done) return 'none';
  const days = taskAgeDays(t, today);
  return days >= 21 ? 'alert' : days >= 14 ? 'warn' : 'none';
}

/** The fields a copy (or a move) to a later week carries over: same start day, one more postponement. */
export const postponeFields = (t: AlignTask) => ({ since: taskSince(t), postponed: (t.postponed ?? 0) + 1 });
