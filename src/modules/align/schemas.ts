/**
 * Data model of the Align module (company goals), as zod schemas. The server validates every write against these
 * (strict: unknown fields are refused) and stamps createdBy/createdAt/updatedBy/updatedAt itself (server/alignGuard.ts).
 * The screens' types are derived from them.
 *
 *   Strategy (one document) ── key thrusts ──< Rock (company goal, one quarter) ──< Priority (assigned to a person)
 *                                                                                     ├──< Note / follow-up
 *                                                                                     └── blocked by another Priority
 *   Huddle (team meeting) — reviews rocks and the members' priorities.
 */
import { z } from 'zod';

const id = z.string().min(1).max(100);
const ref = id.nullable();
/** A real calendar day (2026-02-31 is refused). */
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => {
    const x = new Date(`${d}T00:00:00Z`);
    return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === d;
  }, 'invalid date');
/** HH:MM, 00:00 to 23:59. */
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const txt = (max: number) => z.string().max(max);
/** A quarter, e.g. 2026-Q4. */
export const quarter = z.string().regex(/^\d{4}-Q[1-4]$/);

/** Written by the server only; whatever the browser sends is overwritten. */
const stamps = {
  createdBy: z.string().max(100).optional(),
  createdAt: z.string().max(40).optional(),
  updatedBy: z.string().max(100).optional(),
  updatedAt: z.string().max(40).optional(),
};

export const HEALTH = z.enum(['green', 'yellow', 'red']);
export const PRIORITY_STATUS = z.enum(['not_started', 'in_progress', 'completed']);

/** A company goal ("Rock") for one quarter. Its progress is computed from its priorities (completed / total). */
export const RockSchema = z.strictObject({
  id,
  title: z.string().min(1).max(200),
  description: txt(4000),
  ownerId: ref,
  quarter,
  /** Index of the strategy key thrust it serves (0-based), or null. */
  thrust: z.number().int().min(0).max(19).nullable(),
  /** Index of the one-year key initiative it serves (0-based), or null. Optional for documents saved before it existed. */
  initiative: z.number().int().min(0).max(19).nullable().optional(),
  order: z.number().int().min(0).max(100000),
  archived: z.boolean(),
  /** Id of the KPI-tool priority it was imported from (for re-imports). */
  sourceId: ref,
  ...stamps,
});

/** A priority under a rock (or not linked yet), assigned to one person. */
export const PrioritySchema = z.strictObject({
  id,
  rockId: ref,
  title: z.string().min(1).max(200),
  description: txt(4000),
  ownerId: ref,
  dueDate: date.nullable(),
  status: PRIORITY_STATUS,
  health: HEALTH,
  /** Advancement, entered by the owner (0–100). A completed priority counts as 100 for its rock. */
  progress: z.number().int().min(0).max(100),
  /** Blocked while waiting for another priority to be finished. */
  blockedById: ref,
  blockedNote: txt(500),
  order: z.number().int().min(0).max(100000),
  archived: z.boolean(),
  sourceId: ref,
  ...stamps,
});

/** A note or a follow-up (action to do) inside a priority. The author is createdBy. */
export const NoteSchema = z.strictObject({
  id,
  priorityId: id,
  kind: z.enum(['note', 'followup']),
  text: z.string().min(1).max(4000),
  /** Follow-ups only: who does it, by when, and whether it is done. */
  assigneeId: ref,
  dueDate: date.nullable(),
  done: z.boolean(),
  /** The huddle where it was written, if any. */
  huddleId: ref,
  sourceId: ref,
  ...stamps,
});

export const CADENCE = z.enum(['daily', 'weekly', 'monthly']);

/** A recurring team meeting that follows up on rocks and the members' priorities. */
export const HuddleSchema = z.strictObject({
  id,
  name: z.string().min(1).max(120),
  description: txt(4000),
  ownerId: ref,
  memberIds: z.array(id).max(300),
  cadence: CADENCE,
  /** 0 = Sunday … 6 = Saturday (same as the KPI tool). */
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: time,
  endTime: time,
  videoUrl: txt(500).refine((v) => !v || /^https?:\/\//i.test(v), 'must start with http:// or https://'),
  active: z.boolean(),
  sourceId: ref,
  ...stamps,
});

const line = txt(500);
const list = (max: number) => z.array(line).max(max);

/** A measurable line of the plan (targets, goals, quarterly actions): what, projected, actual, who. Owner is free text. */
const PlanRowSchema = z.strictObject({ category: line, projected: txt(100), actual: txt(100), owner: txt(120) });
const DatedRows = z.strictObject({ date: date.nullable(), rows: z.array(PlanRowSchema).max(20) });

/**
 * The strategy: the one-page strategic plan (OPSP, as in Align) and the 4D Vision. A single document with id "plan".
 * Sections follow Align: Foundation · 3–5 years · 1 year · Quarter · SWOT · Theme · Supporting drivers.
 */
export const StrategySchema = z.strictObject({
  id: z.literal('plan'),
  /* Foundation (4D Vision) */
  coreValues: list(10),
  /** Values in practice ("YES / NO" behaviours) and key messages. */
  messages: txt(8000),
  purpose: txt(2000),
  bhag: txt(2000),
  brandPromise: txt(2000),
  /* 3–5 years */
  targets: DatedRows,
  keyThrusts: list(10),
  /** Profit per X: the one economic driver (X factor). */
  profitX: txt(4000),
  /* 1 year */
  goals: DatedRows,
  keyInitiatives: z.array(z.strictObject({ text: line, quarter: quarter.nullable() })).max(20),
  /** Actions that support the values, purpose and BHAG. */
  actions: list(30),
  /* Quarter */
  actionsQtr: z.array(PlanRowSchema).max(20),
  criticalNumbersBS: list(10),
  criticalNumbersPL: list(10),
  theme: z.strictObject({ name: line, deadline: date.nullable(), target: line, celebration: line, reward: line }),
  /* SWOT */
  swot: z.strictObject({ strengths: list(20), weaknesses: list(20), opportunities: list(20), trends: list(20) }),
  /* Supporting drivers */
  people: z.strictObject({ employees: list(10), customers: list(10), shareholders: list(10) }),
  process: z.strictObject({ operations: list(10), sales: list(10), finance: list(10) }),
  /** Sandbox / ideal client. */
  sandbox: txt(4000),
  ...stamps,
});

export type PlanRow = z.infer<typeof PlanRowSchema>;

/** One line of the alignment checklist (manual check, on top of the automatic checks computed from the data). */
export const ChecklistItemSchema = z.strictObject({
  id,
  category: txt(200),
  text: z.string().min(1).max(500),
  done: z.boolean(),
  note: txt(1000),
  order: z.number().int().min(0).max(100000),
  ...stamps,
});

/** A Monday (YYYY-MM-DD): the start of a work week (Monday to Friday). */
export const weekStart = date.refine((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 1, 'must be a Monday');

export const TASK_KIND = z.enum(['weekly', 'rock']);

/**
 * An action of someone's weekly action plan ("Plan d'action"): a plain weekly action, or an action that moves a Rock
 * forward (rockId set). Owners manage their own; align.priorities.manage manages everyone's.
 */
export const TaskSchema = z.strictObject({
  id,
  title: z.string().min(1).max(300),
  ownerId: id,
  weekStart,
  kind: TASK_KIND,
  /** Rock actions only (null for a weekly action). */
  rockId: ref,
  /** Optional: the priority it advances. */
  priorityId: ref,
  done: z.boolean(),
  /** The huddle where it was added, if any. */
  huddleId: ref,
  order: z.number().int().min(0).max(100000),
  /** The day the action was first created; kept when it is carried over to another week (staleness warning). */
  since: date.optional(),
  /** How many times it was carried over to a later week. */
  postponed: z.number().int().min(0).max(1000).optional(),
  ...stamps,
});

/** A member's weekly check-in ("Quoi de neuf"). One per person and week; id = `${userId}_${weekStart}`. */
export const CheckinSchema = z.strictObject({
  id,
  userId: id,
  weekStart,
  /** Rich text (HTML from the editor, cleaned by the server). */
  whatsUp: txt(100000),
  ...stamps,
});

/** A huddle's description for one week (each week can have its own). id = `${huddleId}_${weekStart}`. */
export const HuddleWeekSchema = z.strictObject({
  id,
  huddleId: id,
  weekStart,
  description: txt(100000), // rich text (HTML, cleaned by the server)
  ...stamps,
});

export const ALIGN_SCHEMAS = {
  'align.rocks': RockSchema,
  'align.priorities': PrioritySchema,
  'align.notes': NoteSchema,
  'align.huddles': HuddleSchema,
  'align.strategy': StrategySchema,
  'align.checklist': ChecklistItemSchema,
  'align.tasks': TaskSchema,
  'align.checkins': CheckinSchema,
  'align.huddleWeeks': HuddleWeekSchema,
} as const;

export type Rock = z.infer<typeof RockSchema>;
export type AlignPriority = z.infer<typeof PrioritySchema>;
export type AlignNote = z.infer<typeof NoteSchema>;
export type AlignHuddle = z.infer<typeof HuddleSchema>;
export type Strategy = z.infer<typeof StrategySchema>;
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
export type Health = z.infer<typeof HEALTH>;
export type PriorityStatus = z.infer<typeof PRIORITY_STATUS>;
export type Cadence = z.infer<typeof CADENCE>;
export type AlignTask = z.infer<typeof TaskSchema>;
export type TaskKind = z.infer<typeof TASK_KIND>;
export type Checkin = z.infer<typeof CheckinSchema>;
export type HuddleWeek = z.infer<typeof HuddleWeekSchema>;
