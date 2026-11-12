/**
 * Data model of Tools → Gestion de projet (project management, time tracking and job costing, modelled on what
 * FunctionFox offers: client > project > task, time booked on tasks, budgets vs actuals, availability, reports).
 * Zod schemas: the server validates every write against them (strict: unknown fields are refused) and stamps
 * createdBy/createdAt/updatedBy/updatedAt itself. The screens' types are derived from them.
 */
import { z } from 'zod';

const id = z.string().min(1).max(100);
const ref = id.nullable();
/** A real calendar date (2026-02-31 is refused). */
const realDate = (v: string) => {
  const [y, m, d] = v.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 && y <= 2100 && x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(realDate, 'invalid date');
/** A date or empty (= not set). */
const optDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).refine((v) => v === '' || realDate(v), 'invalid date');
const unique = <T>(xs: T[]) => new Set(xs).size === xs.length;
const txt = (max: number) => z.string().max(max);
const money = z.number().finite().min(0).max(100_000_000);
const hours = z.number().finite().min(0).max(100_000);

const stamps = {
  createdBy: z.string().max(100).optional(),
  createdAt: z.string().max(40).optional(),
  updatedBy: z.string().max(100).optional(),
  updatedAt: z.string().max(40).optional(),
};

export const PROJECT_STATUS = ['planning', 'active', 'onhold', 'completed', 'archived'] as const;
export const BILLING_TYPES = ['hourly', 'fixed', 'retainer', 'internal'] as const;
export const TASK_STATUS = ['todo', 'doing', 'review', 'done'] as const;
export const TASK_PRIORITY = ['low', 'normal', 'high', 'urgent'] as const;
export const ENTRY_STATUS = ['draft', 'submitted', 'approved', 'rejected'] as const;
export const TIME_OFF_TYPES = ['vacation', 'sick', 'holiday', 'other'] as const;

/** A customer (or an internal department). */
export const ClientSchema = z.strictObject({
  id,
  name: z.string().min(1).max(120),
  contact: txt(120),
  email: txt(200),
  phone: txt(40),
  notes: txt(4000),
  archived: z.boolean(),
  ...stamps,
});

/** A project (a job): belongs to a client, has a manager, a budget and members. */
export const ProjectSchema = z.strictObject({
  id,
  /** Short job number shown everywhere, e.g. "P-2026-014". */
  code: z.string().min(1).max(30),
  name: z.string().min(1).max(160),
  clientId: ref,
  managerId: ref,
  status: z.enum(PROJECT_STATUS),
  billing: z.enum(BILLING_TYPES),
  /** Budgets: hours and/or money (null = none). For `fixed` billing budgetAmount is the fee. */
  budgetHours: hours.nullable(),
  budgetAmount: money.nullable(),
  /** Alert when this share (%) of a budget is used. */
  alertPct: z.number().int().min(1).max(200),
  startDate: optDate,
  endDate: optDate,
  description: txt(4000),
  /** A hex colour only: it ends up in CSS. */
  color: z.string().regex(/^(#[0-9a-fA-F]{3,8})?$/),
  /** People who can book time on it (the manager and managers of the module always can). */
  memberIds: z.array(id).max(300).refine(unique, 'duplicates'),
  /** Nobody can book time while it is closed to time. */
  closedToTime: z.boolean(),
  ...stamps,
});

/** A task (work item and service): time is booked on it. rate = billing rate per hour, 0 = non-billable. */
export const PmTaskSchema = z.strictObject({
  id,
  projectId: id,
  name: z.string().min(1).max(200),
  description: txt(4000),
  assigneeIds: z.array(id).max(50).refine(unique, 'duplicates'),
  status: z.enum(TASK_STATUS),
  priority: z.enum(TASK_PRIORITY),
  startDate: optDate,
  dueDate: optDate,
  estimateHours: hours.nullable(),
  rate: money,
  /** Gantt: this task starts after that one (same project). */
  dependsOnId: ref,
  order: z.number().int().min(0).max(100000),
  ...stamps,
});

/**
 * Time booked by one person on one project (and optionally a task) for a day. billable and rate are set by the
 * server from the task's rate when the entry is created or its task changes; status moves draft -> submitted ->
 * approved/rejected (only approvers approve or reject; approved entries are locked).
 */
export const TimeEntrySchema = z.strictObject({
  id,
  userId: id,
  projectId: id,
  taskId: ref,
  date,
  hours: z.number().finite().gt(0).max(24),
  note: txt(1000),
  billable: z.boolean(),
  rate: money,
  status: z.enum(ENTRY_STATUS),
  /** Why it was rejected (written by the approver). */
  reviewNote: txt(500),
  reviewedBy: z.string().max(100).optional(),
  reviewedAt: z.string().max(40).optional(),
  ...stamps,
});

/** An external cost on a project: cost = what we pay, fee = cost + markup = what we bill. */
export const ExpenseSchema = z.strictObject({
  id,
  projectId: id,
  date,
  description: z.string().min(1).max(300),
  vendor: txt(120),
  cost: money,
  markupPct: z.number().finite().min(0).max(1000),
  billable: z.boolean(),
  ...stamps,
});

/** Weekly capacity of a person (shown in the availability view). Not confidential. */
export const StaffSchema = z.strictObject({
  /** = the user's id */
  id,
  title: txt(120),
  weeklyHours: z.number().finite().min(0).max(100),
  /** Weekdays worked, 1 = Monday .. 7 = Sunday. */
  workDays: z.array(z.number().int().min(1).max(7)).max(7).refine(unique, 'duplicates'),
  ...stamps,
});

/** What a person costs per hour: confidential, readable only with the reports permission. id = the user's id. */
export const RateSchema = z.strictObject({
  id,
  costRate: money,
  ...stamps,
});

/** Time off (shrinks availability). Anyone writes their own; managers write anyone's. */
export const TimeOffSchema = z.strictObject({
  id,
  userId: id,
  startDate: date,
  endDate: date,
  type: z.enum(TIME_OFF_TYPES),
  note: txt(300),
  ...stamps,
});

export const PM_SCHEMAS = {
  'pm.clients': ClientSchema,
  'pm.projects': ProjectSchema,
  'pm.tasks': PmTaskSchema,
  'pm.timeEntries': TimeEntrySchema,
  'pm.expenses': ExpenseSchema,
  'pm.staff': StaffSchema,
  'pm.rates': RateSchema,
  'pm.timeOff': TimeOffSchema,
} as const;

export type Client = z.infer<typeof ClientSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type PmTask = z.infer<typeof PmTaskSchema>;
export type TimeEntry = z.infer<typeof TimeEntrySchema>;
export type Expense = z.infer<typeof ExpenseSchema>;
export type Staff = z.infer<typeof StaffSchema>;
export type Rate = z.infer<typeof RateSchema>;
export type TimeOff = z.infer<typeof TimeOffSchema>;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];
export type BillingType = (typeof BILLING_TYPES)[number];
export type TaskStatus = (typeof TASK_STATUS)[number];
export type EntryStatus = (typeof ENTRY_STATUS)[number];
