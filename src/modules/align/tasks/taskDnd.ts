/**
 * Drag and drop of weekly actions: reorder inside a person's list, or move to another person (reassign).
 * Orders are spaced (STEP) so a move usually changes only the moved action; when there is no room left between
 * two neighbours, the target list is renumbered (only the actions this person may edit are rewritten).
 */
import type { AlignTask } from '../schemas';
import { tasks } from '../stores';

const STEP = 1000;
const MAX = 100000;

let current: AlignTask | null = null;
const listeners = new Set<(t: AlignTask | null) => void>();

/** The action being dragged (shared by every list on the page). */
export const dragging = {
  get: () => current,
  set(t: AlignTask | null) {
    current = t;
    for (const l of listeners) l(t);
  },
  subscribe(l: (t: AlignTask | null) => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};

/**
 * Moves `task` into `ownerId`'s list, just before `beforeId` (or at the end when null).
 * `target` is that list as displayed (sorted); it may contain the task itself.
 */
export async function moveTask(task: AlignTask, ownerId: string, beforeId: string | null, target: AlignTask[], canEdit: (t: AlignTask) => boolean) {
  const list = target.filter((x) => x.id !== task.id);
  const at = beforeId ? Math.max(0, list.findIndex((x) => x.id === beforeId)) : list.length;
  const prev = list[at - 1]?.order;
  const next = list[at]?.order;
  const reassign = ownerId !== task.ownerId ? { ownerId } : {};

  let order: number | null;
  if (prev === undefined && next === undefined) order = STEP;
  else if (prev === undefined) order = next! - STEP >= 0 ? next! - STEP : next! > 0 ? Math.floor(next! / 2) : null;
  else if (next === undefined) order = prev + STEP <= MAX ? prev + STEP : prev < MAX ? prev + 1 : null;
  else order = next - prev > 1 ? Math.floor((prev + next) / 2) : null;

  if (order !== null) {
    if (order === task.order && !reassign.ownerId) return;
    await tasks.update(task.id, { order, ...reassign });
    return;
  }

  // No room: renumber the whole target list in its new order.
  const seq = [...list.slice(0, at), task, ...list.slice(at)];
  const step = Math.max(1, Math.floor(MAX / (seq.length + 1)));
  for (const [i, x] of seq.entries()) {
    const o = (i + 1) * step;
    if (x.id === task.id) await tasks.update(x.id, { order: o, ...reassign });
    else if (x.order !== o && canEdit(x)) await tasks.update(x.id, { order: o });
  }
}

/** Order for a new action at the end of a list. */
export const endOrder = (list: AlignTask[]) => {
  const max = list.reduce((m, x) => Math.max(m, x.order), 0);
  return Math.min(MAX, list.length ? max + STEP : STEP);
};
