/**
 * Format of the archived "old data" exported from Align (aligntoday.com). The archive is kept on the server only,
 * hidden from the app (never served by the generic API), and can be loaded into the KPI collections by an
 * administrator (Tools -> KPI -> Settings -> "Import old data"). It is deliberately close to what Align shows,
 * with people and teams referenced by NAME: the importer maps names to Imago users.
 *
 * Dates are YYYY-MM-DD (a week = its Monday). Unknown or empty values are null / "".
 */
import { z } from 'zod';

const name = z.string().min(1).max(200);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableDate = date.nullable();
const text = (max: number) => z.string().max(max);
const person = name.nullable();
const RAG = z.enum(['green', 'yellow', 'red']).nullable();

export const AlignPersonSchema = z.object({
  name,
  email: text(200).optional(),
  title: text(200).optional(),
});

export const AlignTaskSchema = z.object({
  title: z.string().min(1).max(300),
  owner: person,
  due: nullableDate,
  done: z.boolean(),
  /** Huddle tasks only: the Monday of the meeting week they were created in. */
  week: nullableDate.optional(),
});

export const AlignMetricValueSchema = z.object({
  /** Monday of the week (weekly metrics) or first day of the month (monthly metrics). */
  period: date,
  value: z.number().finite().nullable(),
  note: text(2000),
});

export const AlignMetricSchema = z.object({
  name,
  /** Full definition text as written in Align (how it is measured, source, owner, etc.). */
  description: text(8000),
  /** "$", "%", "h", "#" ... taken from the metric (often the suffix of its name); "" if none. */
  unit: text(12),
  frequency: z.enum(['weekly', 'monthly', 'daily', 'quarterly', 'other']),
  /** The target as a number when Align has one, else null (put any text version in targetText). */
  target: z.number().finite().nullable(),
  targetText: text(500),
  /** up = higher is better, down = lower is better, null = Align does not say. */
  direction: z.enum(['up', 'down']).nullable(),
  owner: person,
  status: z.enum(['active', 'draft', 'archived']),
  team: person,
  integration: text(100).nullable(),
  values: z.array(AlignMetricValueSchema).max(3000),
});

export const AlignPriorityUpdateSchema = z.object({
  week: date,
  progress: z.number().min(0).max(100),
  status: RAG,
  note: text(2000),
});

export const AlignPrioritySchema = z.object({
  title: z.string().min(1).max(200),
  description: text(4000),
  owner: person,
  team: person,
  /** A company-wide priority. */
  company: z.boolean(),
  /** The priority period (a quarter in Align): start and end dates. */
  periodStart: nullableDate,
  periodEnd: nullableDate,
  /** Title of the parent priority, for a sub-priority. */
  parent: z.string().max(200).nullable(),
  status: RAG,
  progress: z.number().min(0).max(100),
  archived: z.boolean(),
  tasks: z.array(AlignTaskSchema).max(500),
  updates: z.array(AlignPriorityUpdateSchema).max(500),
});

export const AlignTeamSchema = z.object({
  name,
  members: z.array(name).max(500),
  owner: person,
});

export const AlignHuddleItemSchema = z.object({
  week: date,
  type: z.enum(['agenda', 'parking', 'issue']),
  text: z.string().min(1).max(1000),
  status: z.enum(['open', 'discussed', 'resolved']),
});

export const AlignHuddleEntrySchema = z.object({
  week: date,
  person: name,
  whatsUp: text(4000),
  feedback: text(4000),
  help: text(4000),
  stucks: text(4000),
});

export const AlignHuddleSchema = z.object({
  name,
  owner: person,
  team: person,
  cadence: z.enum(['daily', 'weekly', 'monthly']),
  /** 0 = Sunday ... 6 = Saturday; null when unknown. */
  dayOfWeek: z.number().int().min(0).max(6).nullable(),
  startTime: z.string().regex(/^(\d{2}:\d{2})?$/),
  endTime: z.string().regex(/^(\d{2}:\d{2})?$/),
  videoUrl: text(300),
  /** Purpose / preparation / agenda text of the huddle. */
  description: text(8000),
  members: z.array(name).max(500),
  /** The huddle's section labels exactly as Align shows them, in order (team part and per-person part). */
  teamSections: z.array(text(100)).max(40),
  personalSections: z.array(text(100)).max(40),
  active: z.boolean(),
  items: z.array(AlignHuddleItemSchema).max(5000),
  entries: z.array(AlignHuddleEntrySchema).max(5000),
  tasks: z.array(AlignTaskSchema).max(5000),
});

export const AlignArchiveSchema = z.object({
  source: z.literal('Align'),
  company: text(200),
  /** ISO timestamp of the export. */
  exportedAt: z.string().max(40),
  people: z.array(AlignPersonSchema).max(2000).default([]),
  teams: z.array(AlignTeamSchema).max(500).default([]),
  /** Names of the metrics marked as the company's "critical numbers". */
  criticalNumbers: z.array(name).max(50).default([]),
  metrics: z.array(AlignMetricSchema).max(2000).default([]),
  priorities: z.array(AlignPrioritySchema).max(5000).default([]),
  huddles: z.array(AlignHuddleSchema).max(200).default([]),
});

export type AlignArchive = z.infer<typeof AlignArchiveSchema>;
export type AlignMetric = z.infer<typeof AlignMetricSchema>;
export type AlignPriority = z.infer<typeof AlignPrioritySchema>;
export type AlignHuddle = z.infer<typeof AlignHuddleSchema>;
export type AlignTeam = z.infer<typeof AlignTeamSchema>;
export type AlignPerson = z.infer<typeof AlignPersonSchema>;
