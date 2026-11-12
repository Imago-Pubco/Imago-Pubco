/**
 * Data model of the Tools → KPI module, as zod schemas. The server validates every write against these
 * (strict: unknown fields are refused) and stamps createdBy/createdAt/updatedBy/updatedAt itself, so the
 * browser can neither store junk nor claim to be someone else. The screens' types are derived from them.
 */
import { z } from 'zod';

const id = z.string().min(1).max(100);
const ref = id.nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^(\d{2}:\d{2})?$/);
const txt = (max: number) => z.string().max(max);

/** Written by the server only; whatever the browser sends is overwritten. */
const stamps = {
  createdBy: z.string().max(100).optional(),
  createdAt: z.string().max(40).optional(),
  updatedBy: z.string().max(100).optional(),
  updatedAt: z.string().max(40).optional(),
};

export const STATUS = z.enum(['green', 'yellow', 'red']);

/** A group of people that works together (a department, a crew). Not the same thing as an access group. */
export const TeamSchema = z.strictObject({
  id,
  name: z.string().min(1).max(80),
  description: txt(500),
  color: txt(20),
  ownerId: id,
  memberIds: z.array(id).max(300),
  archived: z.boolean(),
  ...stamps,
});

/** An indicator followed every week (or month): its definition, target and owner. */
export const KpiSchema = z.strictObject({
  id,
  name: z.string().min(1).max(120),
  /** How it is measured and where the data comes from. */
  description: txt(4000),
  /** Shown after the value: $, %, h, #, ... */
  unit: txt(12),
  frequency: z.enum(['weekly', 'monthly']),
  /** up = a higher value is better, down = a lower value is better. */
  direction: z.enum(['up', 'down']),
  target: z.number().finite().nullable(),
  ownerId: ref,
  teamId: ref,
  status: z.enum(['active', 'draft', 'archived']),
  /** One of the few "critical numbers" shown first on the dashboard. */
  critical: z.boolean(),
  order: z.number().int().min(0).max(100000),
  ...stamps,
});

/** One value of an indicator for one period. id = `${kpiId}_${period}` (one value per period). */
export const KpiValueSchema = z.strictObject({
  id,
  kpiId: id,
  /** Monday of the week (weekly) or first day of the month (monthly), YYYY-MM-DD. */
  period: date,
  value: z.number().finite().nullable(),
  note: txt(2000),
  ...stamps,
});

/** A priority for a period (a quarter): owned by a person, for the company or a team, with sub-priorities. */
export const PrioritySchema = z.strictObject({
  id,
  title: z.string().min(1).max(200),
  description: txt(4000),
  ownerId: ref,
  teamId: ref,
  /** A company-wide priority (shown to everyone). */
  company: z.boolean(),
  periodStart: date,
  periodEnd: date,
  parentId: ref,
  status: STATUS,
  /** Latest progress, 0-100 (the weekly history is in priorityUpdates). */
  progress: z.number().min(0).max(100),
  order: z.number().int().min(0).max(100000),
  archived: z.boolean(),
  ...stamps,
});

/** Weekly progress of a priority. id = `${priorityId}_${week}`. */
export const PriorityUpdateSchema = z.strictObject({
  id,
  priorityId: id,
  week: date,
  progress: z.number().min(0).max(100),
  status: STATUS,
  note: txt(2000),
  ...stamps,
});

/** An action ("Who - What - When"), possibly tied to a priority or to a huddle week. */
export const TaskSchema = z.strictObject({
  id,
  title: z.string().min(1).max(300),
  ownerId: ref,
  dueDate: date.nullable(),
  done: z.boolean(),
  doneAt: z.string().max(40).nullable(),
  priorityId: ref,
  huddleId: ref,
  week: date.nullable(),
  ...stamps,
});

export const TEAM_SECTIONS = ['agenda', 'criticalNumbers', 'kpis', 'priorities', 'tasks', 'parking', 'issues'] as const;
export const PERSONAL_SECTIONS = ['whatsUp', 'feedback', 'priorityProgress', 'help', 'stucks'] as const;

/** A recurring meeting of a team: when, who, and which sections it runs. */
export const HuddleSchema = z.strictObject({
  id,
  name: z.string().min(1).max(120),
  teamId: ref,
  ownerId: ref,
  cadence: z.enum(['daily', 'weekly', 'monthly']),
  /** 0 = Sunday ... 6 = Saturday (weekly huddles). */
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: time,
  endTime: time,
  videoUrl: z.string().max(300).regex(/^(https?:\/\/\S+)?$/i),
  /** Purpose, preparation and agenda, in plain text. */
  description: txt(8000),
  memberIds: z.array(id).max(300),
  teamSections: z.array(z.enum(TEAM_SECTIONS)).max(20),
  personalSections: z.array(z.enum(PERSONAL_SECTIONS)).max(20),
  active: z.boolean(),
  ...stamps,
});

/** One person's check-in for one huddle week. id = `${huddleId}_${week}_${userId}`. */
export const HuddleEntrySchema = z.strictObject({
  id,
  huddleId: id,
  week: date,
  userId: id,
  whatsUp: txt(4000),
  feedback: txt(4000),
  help: txt(4000),
  stucks: txt(4000),
  ...stamps,
});

/** An agenda item, a parking-lot item or an issue of one huddle week. */
export const HuddleItemSchema = z.strictObject({
  id,
  huddleId: id,
  week: date,
  type: z.enum(['agenda', 'parking', 'issue']),
  text: z.string().min(1).max(1000),
  status: z.enum(['open', 'discussed', 'resolved']),
  order: z.number().int().min(0).max(100000),
  ...stamps,
});

/** Collection name -> schema: what the server validates. */
export const TOOLS_SCHEMAS = {
  'tools.teams': TeamSchema,
  'tools.kpis': KpiSchema,
  'tools.kpiValues': KpiValueSchema,
  'tools.priorities': PrioritySchema,
  'tools.priorityUpdates': PriorityUpdateSchema,
  'tools.tasks': TaskSchema,
  'tools.huddles': HuddleSchema,
  'tools.huddleEntries': HuddleEntrySchema,
  'tools.huddleItems': HuddleItemSchema,
} as const;

export type Team = z.infer<typeof TeamSchema>;
export type Kpi = z.infer<typeof KpiSchema>;
export type KpiValue = z.infer<typeof KpiValueSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type PriorityUpdate = z.infer<typeof PriorityUpdateSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Huddle = z.infer<typeof HuddleSchema>;
export type HuddleEntry = z.infer<typeof HuddleEntrySchema>;
export type HuddleItem = z.infer<typeof HuddleItemSchema>;
export type Status = z.infer<typeof STATUS>;
export type TeamSection = (typeof TEAM_SECTIONS)[number];
export type PersonalSection = (typeof PERSONAL_SECTIONS)[number];
