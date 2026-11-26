import { collection } from '@/data/db';
import type { WorkOrder } from './types';

export const workOrders = collection<WorkOrder>('wo.orders');

/**
 * Save a change to one work order and, when `text` is given, append a history entry.
 * `wo` is the row the caller last saw; the history is extended from it.
 */
export function changeWorkOrder(wo: WorkOrder, patch: Partial<WorkOrder>, by: string, text?: string) {
  const now = new Date().toISOString();
  const history = text ? [...wo.history, { at: now, by, text }] : wo.history;
  return workOrders.update(wo.id, { ...patch, history, updatedAt: now });
}
