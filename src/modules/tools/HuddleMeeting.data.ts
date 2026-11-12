/** Pure helpers of the huddle meeting screen: week handling, filters, ordering, parsing and the copied summary. */
import type { Lang, User } from '@/data/types';
import { addDays, currentWeek, huddleEntryId, iso, mondayOf, monthStart, parseDate, periodLabel, shortPeriod } from './lib';
import type { Huddle, HuddleEntry, HuddleItem, Kpi, KpiValue, Priority, PriorityUpdate, Status, Task, Team } from './schemas';

/** Everything the meeting screen shows for one huddle and one week, resolved once by the page. */
export interface MeetingData {
  huddle: Huddle;
  week: string;
  me: string;
  lang: Lang;
  team: Team | undefined;
  /** Active members in memberIds order, the owner included when not a member. */
  members: User[];
  nameOf: (id: string | null | undefined) => string;
  kpis: Kpi[];
  kpiValues: KpiValue[];
  priorities: Priority[];
  priorityUpdates: PriorityUpdate[];
  tasks: Task[];
  items: HuddleItem[];
  entries: HuddleEntry[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;

/** Monday of the week given in ?week=, or of the current week when it is absent or invalid. */
export function normaliseWeek(raw: string | null): string {
  return raw && DATE_RE.test(raw) && !Number.isNaN(parseDate(raw).getTime()) ? mondayOf(raw) : currentWeek();
}

/** The period of a KPI that is measured during the week: the week itself, or the first day of its month. */
export const periodOfWeek = (frequency: Kpi['frequency'], week: string) => (frequency === 'weekly' ? week : monthStart(week));

export function statusLabel(s: Status, lang: Lang): string {
  return lang === 'fr' ? { green: 'Vert', yellow: 'Jaune', red: 'Rouge' }[s] : { green: 'Green', yellow: 'Yellow', red: 'Red' }[s];
}

export function itemStatusLabel(s: HuddleItem['status'], lang: Lang): string {
  const fr = lang === 'fr';
  if (s === 'discussed') return fr ? 'discuté' : 'discussed';
  if (s === 'resolved') return fr ? 'résolu' : 'resolved';
  return fr ? 'ouvert' : 'open';
}

/** "Lundi 09:00–09:30" for a weekly huddle; the day follows the viewed week. */
export function timeSentence(h: Huddle, week: string, lang: Lang): string {
  const fr = lang === 'fr';
  let day: string;
  if (h.cadence === 'weekly') {
    // Week starts on Monday: dayOfWeek 1 (Monday) is offset 0, Sunday (0) is offset 6.
    const name = parseDate(addDays(week, (h.dayOfWeek + 6) % 7)).toLocaleDateString(fr ? 'fr-CA' : 'en-CA', { weekday: 'long' });
    day = name.charAt(0).toUpperCase() + name.slice(1);
  } else {
    day = h.cadence === 'daily' ? (fr ? 'Chaque jour' : 'Daily') : fr ? 'Mensuel' : 'Monthly';
  }
  const hours = [h.startTime, h.endTime].filter(Boolean).join('–');
  return hours ? `${day} ${hours}` : day;
}

/** Parses a number typed by a user (comma or dot decimal). Empty gives null, invalid gives undefined. */
export function parseNumber(raw: string): number | null | undefined {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** A progress from 0 to 100. Empty gives null, anything out of range or invalid gives undefined. */
export function parseProgress(raw: string): number | null | undefined {
  const n = parseNumber(raw);
  return n === null || n === undefined ? n : n >= 0 && n <= 100 ? n : undefined;
}

/* ---------- Team sections ---------- */

export function huddleItemsOf(d: MeetingData, type: HuddleItem['type']): HuddleItem[] {
  return d.items.filter((i) => i.huddleId === d.huddle.id && i.week === d.week && i.type === type).sort(byOrder);
}

/** Open tasks first, then by due date (no due date last). */
function compareTasks(a: Task, b: Task): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
}

/** Tasks of this huddle: the ones of this week, and the open ones carried over from earlier weeks. */
export function huddleTasks(d: MeetingData): { current: Task[]; carried: Task[] } {
  const mine = d.tasks.filter((t) => t.huddleId === d.huddle.id);
  return {
    current: mine.filter((t) => t.week === d.week).sort(compareTasks),
    carried: mine.filter((t) => t.week !== null && t.week < d.week && !t.done).sort(compareTasks),
  };
}

/** Active KPIs of the huddle's team; without a team, the active non-critical KPIs. */
export function teamKpis(d: MeetingData): Kpi[] {
  const h = d.huddle;
  return d.kpis.filter((k) => k.status === 'active' && (h.teamId ? k.teamId === h.teamId : !k.critical)).sort(byOrder);
}

export function criticalKpis(d: MeetingData): Kpi[] {
  return d.kpis.filter((k) => k.status === 'active' && k.critical).sort(byOrder);
}

/** Latest non-empty value of a KPI up to the end of the viewed week. */
export function latestValue(d: MeetingData, kpi: Kpi): KpiValue | undefined {
  const upTo = addDays(d.week, 6);
  return d.kpiValues
    .filter((v) => v.kpiId === kpi.id && v.value !== null && v.period <= upTo)
    .sort((a, b) => b.period.localeCompare(a.period))[0];
}

/** Priorities of the period containing the week: the team's ones and the company ones, not archived. */
export function periodPriorities(d: MeetingData): Priority[] {
  const h = d.huddle;
  return d.priorities.filter(
    (p) => !p.archived && p.periodStart <= d.week && d.week <= p.periodEnd && (p.company || (h.teamId !== null && p.teamId === h.teamId)),
  );
}

/** Priorities as a tree: each top-level priority followed by its sub-priorities, with their depth. */
export function priorityTree(list: Priority[]): { priority: Priority; depth: number }[] {
  const ids = new Set(list.map((p) => p.id));
  const out: { priority: Priority; depth: number }[] = [];
  const visit = (p: Priority, depth: number) => {
    out.push({ priority: p, depth });
    list
      .filter((c) => c.parentId === p.id)
      .sort(byOrder)
      .forEach((c) => visit(c, depth + 1));
  };
  list
    .filter((p) => !p.parentId || !ids.has(p.parentId))
    .sort(byOrder)
    .forEach((p) => visit(p, 0));
  return out;
}

/* ---------- Members ---------- */

/** Priorities owned by a person for the period containing the week. */
export function memberPriorities(d: MeetingData, userId: string): Priority[] {
  return d.priorities
    .filter((p) => !p.archived && p.ownerId === userId && p.periodStart <= d.week && d.week <= p.periodEnd)
    .sort(byOrder);
}

export function entryOf(d: MeetingData, userId: string): HuddleEntry | undefined {
  const id = huddleEntryId(d.huddle.id, d.week, userId);
  return d.entries.find((e) => e.id === id);
}

/* ---------- Copied summary ---------- */

const indent = (s: string) => s.trim().split('\n').join('\n    ');

/** Plain-text summary of the week for the clipboard: agenda, parking lot, issues, tasks and the round table. */
export function buildSummary(d: MeetingData): string {
  const fr = d.lang === 'fr';
  const L = (a: string, b: string) => (fr ? a : b);
  const out: string[] = [d.huddle.name, periodLabel(d.week, 'weekly', d.lang), ''];
  const block = (title: string, lines: string[]) => {
    out.push(title, ...(lines.length ? lines : [`  ${L('Aucun', 'None')}`]), '');
  };

  const itemLines = (type: HuddleItem['type']) => huddleItemsOf(d, type).map((i) => `- ${i.text} (${itemStatusLabel(i.status, d.lang)})`);
  block(L('Ordre du jour', 'Agenda'), itemLines('agenda'));
  block('Parking lot', itemLines('parking'));
  block(L('Enjeux', 'Issues'), itemLines('issue'));

  const { current, carried } = huddleTasks(d);
  const taskLine = (task: Task, carry: boolean) =>
    `- [${task.done ? 'x' : ' '}] ${task.title} | ${d.nameOf(task.ownerId)}` +
    (task.dueDate ? ` | ${shortPeriod(task.dueDate, d.lang)}` : '') +
    (carry ? ` (${L('reporté', 'carried over')})` : '');
  block(
    L('Qui – Quoi – Quand', 'Who – What – When'),
    [...carried.map((x) => taskLine(x, true)), ...current.map((x) => taskLine(x, false))],
  );

  const personal: string[] = [];
  for (const m of d.members) {
    const e = entryOf(d, m.id);
    if (!e || (!e.whatsUp.trim() && !e.help.trim())) continue;
    personal.push(m.displayName);
    if (e.whatsUp.trim()) personal.push(`  ${L('Quoi de neuf', "What's up")}: ${indent(e.whatsUp)}`);
    if (e.help.trim()) personal.push(`  ${L("Besoin d'aide", 'Help needed')}: ${indent(e.help)}`);
  }
  block(L('Tour de table', 'Round table'), personal);

  return out.join('\n').trimEnd();
}

/** Today as YYYY-MM-DD, used for overdue dates. */
export const todayIso = () => iso(new Date());
