/**
 * Work orders: created by the server when a customer-accepted quote goes to production.
 * The production manager plans the order and delegates tasks to the team.
 * Collection `wo.orders` (the server creates rows; the browser edits them).
 */
import type { L } from '@/i18n';

export type WorkOrderStatus = 'new' | 'planned' | 'in_progress' | 'hold' | 'done' | 'shipped';

export const WO_STATUSES: WorkOrderStatus[] = ['new', 'planned', 'in_progress', 'hold', 'done', 'shipped'];

export const WO_STATUS_LABEL: Record<WorkOrderStatus, L> = {
  new: { fr: 'Nouveau', en: 'New' },
  planned: { fr: 'Planifié', en: 'Planned' },
  in_progress: { fr: 'En production', en: 'In production' },
  hold: { fr: 'En pause', en: 'On hold' },
  done: { fr: 'Terminé', en: 'Done' },
  shipped: { fr: 'Expédié', en: 'Shipped' },
};

export type Department = 'prepress' | 'printing' | 'diecutting' | 'finishing' | 'assembly' | 'shipping' | 'other';

export const DEPARTMENTS: Department[] = ['prepress', 'printing', 'diecutting', 'finishing', 'assembly', 'shipping', 'other'];

export const DEPARTMENT_LABEL: Record<Department, L> = {
  prepress: { fr: 'Prépresse', en: 'Prepress' },
  printing: { fr: 'Impression', en: 'Printing' },
  diecutting: { fr: 'Découpe', en: 'Die-cutting' },
  finishing: { fr: 'Finition', en: 'Finishing' },
  assembly: { fr: 'Assemblage', en: 'Assembly' },
  shipping: { fr: 'Expédition', en: 'Shipping' },
  other: { fr: 'Autre', en: 'Other' },
};

export type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked';

export const TASK_STATUSES: TaskStatus[] = ['todo', 'doing', 'done', 'blocked'];

export const TASK_STATUS_LABEL: Record<TaskStatus, L> = {
  todo: { fr: 'À faire', en: 'To do' },
  doing: { fr: 'En cours', en: 'Doing' },
  done: { fr: 'Fait', en: 'Done' },
  blocked: { fr: 'Bloqué', en: 'Blocked' },
};

export interface WorkOrderTask {
  id: string;
  title: string;
  department: Department;
  /** User id; '' = nobody yet. */
  assigneeId: string;
  status: TaskStatus;
  /** Calendar day, YYYY-MM-DD. */
  dueAt?: string;
  notes?: string;
}

export interface WorkOrderHistoryEntry {
  at: string;
  /** User id or 'system'. */
  by: string;
  text: string;
}

export interface WorkOrder {
  id: string;
  /** WO-YY-NNNN */
  no: string;
  requestId: string;
  quoteId: string;
  estimateId: string;
  customer: string;
  contact: string;
  project: string;
  /** Plain-language summary of what is produced. */
  specSummary: string;
  quantity: number;
  unitPrice: number;
  total: number;
  /** YYYY-MM-DD */
  dueDate: string;
  status: WorkOrderStatus;
  /** Production manager user id; '' = unassigned. */
  managerId: string;
  tasks: WorkOrderTask[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  history: WorkOrderHistoryEntry[];
}

/** Standard production steps the manager can add with one click. */
export const STANDARD_TASKS: { title: L; department: Department }[] = [
  { title: { fr: 'Approbation de la prépresse', en: 'Prepress approval' }, department: 'prepress' },
  { title: { fr: 'Plaques', en: 'Plates' }, department: 'prepress' },
  { title: { fr: 'Impression', en: 'Printing' }, department: 'printing' },
  { title: { fr: 'Découpe à l’emporte-pièce', en: 'Die-cutting' }, department: 'diecutting' },
  { title: { fr: 'Finition', en: 'Finishing' }, department: 'finishing' },
  { title: { fr: 'Collage et assemblage', en: 'Gluing and assembly' }, department: 'assembly' },
  { title: { fr: 'Contrôle qualité', en: 'Quality control' }, department: 'finishing' },
  { title: { fr: 'Emballage', en: 'Packing' }, department: 'shipping' },
  { title: { fr: 'Expédition', en: 'Shipping' }, department: 'shipping' },
];

/** Today as a calendar day (local time), YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Still in the shop: neither done nor shipped. */
export function isOpen(wo: Pick<WorkOrder, 'status'>): boolean {
  return wo.status !== 'done' && wo.status !== 'shipped';
}

export function isOverdue(wo: WorkOrder, today = todayIso()): boolean {
  return isOpen(wo) && !!wo.dueDate && wo.dueDate < today;
}

/** Whole days from today to the due date (negative when late). */
export function daysUntilDue(wo: WorkOrder, today = todayIso()): number {
  return Math.round((Date.parse(wo.dueDate) - Date.parse(today)) / 86_400_000);
}

export function taskProgress(tasks: WorkOrderTask[]) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
