/** Pure helpers of the weekly tasks (no React, no storage). */
import type { L } from '@/i18n';
import type { AlignTask, TaskKind } from '../schemas';

/** The owner, the creator, or a manager may edit (and delete) a task. */
export const canEditTask = (t: AlignTask, userId: string, canManage: boolean) =>
  canManage || t.ownerId === userId || t.createdBy === userId;

/** Open tasks first, then by their order, then by title. */
export const sortTasks = (a: AlignTask, b: AlignTask) =>
  Number(a.done) - Number(b.done) || a.order - b.order || a.title.localeCompare(b.title);

export const TASK_KIND_LABEL: Record<TaskKind, L> = {
  weekly: { fr: 'Action hebdo', en: 'Weekly action' },
  rock: { fr: 'Action Rock', en: 'Rock action' },
};
