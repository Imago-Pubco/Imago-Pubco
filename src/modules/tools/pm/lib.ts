/**
 * Calculations shared by every Project management screen, so a number is computed in one place only.
 * Dates are local calendar dates (YYYY-MM-DD); use the helpers of ../lib for date arithmetic.
 */
import { addDays, iso, mondayOf, parseDate } from '../lib';
import type { Expense, PmTask, Project, Rate, Staff, TimeEntry, TimeOff } from './schemas';

export { addDays, iso, mondayOf, parseDate };

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** "12,5 h" style (no unit translation needed: h is h in French and English). */
export const fmtHours = (h: number) => `${round2(h).toLocaleString('fr-CA', { maximumFractionDigits: 2 })} h`;
export const fmtMoney = (n: number, lang = 'fr') => n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
export const pct = (n: number) => `${Math.round(n)} %`;

/** Money of one time entry: hours x the rate frozen on the entry (0 when non-billable). */
export const entryFee = (e: Pick<TimeEntry, 'hours' | 'rate' | 'billable'>) => (e.billable ? e.hours * e.rate : 0);
/** What an expense is billed at: cost plus markup. */
export const expenseFee = (x: Pick<Expense, 'cost' | 'markupPct' | 'billable'>) => (x.billable ? x.cost * (1 + x.markupPct / 100) : 0);

/** Entries that count as "actual": anything not rejected (draft time is still work done). */
export const counted = (e: Pick<TimeEntry, 'status'>) => e.status !== 'rejected';

export interface Actuals {
  hours: number;
  billableHours: number;
  /** hours x billing rate of the billable entries */
  timeFees: number;
  expenseCost: number;
  expenseFees: number;
  /** timeFees + expenseFees: what is billable so far at standard rates */
  fees: number;
}

export function projectActuals(projectId: string, entries: TimeEntry[], exps: Expense[]): Actuals {
  const es = entries.filter((e) => e.projectId === projectId && counted(e));
  const xs = exps.filter((x) => x.projectId === projectId);
  const timeFees = sum(es.map(entryFee));
  const expenseFees = sum(xs.map(expenseFee));
  return {
    hours: sum(es.map((e) => e.hours)),
    billableHours: sum(es.filter((e) => e.billable).map((e) => e.hours)),
    timeFees,
    expenseCost: sum(xs.map((x) => x.cost)),
    expenseFees,
    fees: timeFees + expenseFees,
  };
}

export type BudgetLevel = 'none' | 'ok' | 'warn' | 'over';
export interface BudgetUse {
  hoursPct: number | null;
  amountPct: number | null;
  level: BudgetLevel;
}

/** Budget vs actual: share of each budget used, and the alert level (warn from the project's alertPct, over at 100 %). */
export function budgetUse(p: Pick<Project, 'budgetHours' | 'budgetAmount' | 'alertPct'>, a: Actuals): BudgetUse {
  const hoursPct = p.budgetHours ? (a.hours / p.budgetHours) * 100 : null;
  const amountPct = p.budgetAmount ? (a.fees / p.budgetAmount) * 100 : null;
  const worst = Math.max(hoursPct ?? -1, amountPct ?? -1);
  const level: BudgetLevel = worst < 0 ? 'none' : worst >= 100 ? 'over' : worst >= p.alertPct ? 'warn' : 'ok';
  return { hoursPct, amountPct, level };
}
export const BUDGET_COLOR: Record<BudgetLevel, string> = { none: 'var(--text-3)', ok: 'var(--ok)', warn: 'var(--warn)', over: 'var(--err)' };

/** Profitability: revenue (fixed = the fee; hourly/retainer = billable fees; internal = none) against cost (people + expenses). */
export function profitability(p: Pick<Project, 'billing' | 'budgetAmount'>, a: Actuals, entries: TimeEntry[], costRates: Rate[]): { revenue: number; cost: number; margin: number; marginPct: number | null } {
  const byUser = new Map(costRates.map((r) => [r.id, r.costRate]));
  const peopleCost = sum(entries.filter(counted).map((e) => e.hours * (byUser.get(e.userId) ?? 0)));
  const revenue = p.billing === 'internal' ? 0 : p.billing === 'fixed' ? (p.budgetAmount ?? 0) + a.expenseFees : a.fees;
  const cost = peopleCost + a.expenseCost;
  const margin = revenue - cost;
  return { revenue, cost, margin, marginPct: revenue > 0 ? (margin / revenue) * 100 : null };
}

/* ---------- availability (workload) ---------- */

/** Days (YYYY-MM-DD) from `from` to `to` inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 800; d = addDays(d, 1)) out.push(d);
  return out;
}
/** 1 = Monday .. 7 = Sunday. */
export const isoWeekday = (date: string) => ((parseDate(date).getDay() + 6) % 7) + 1;

const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];
const workDaysOf = (s?: Pick<Staff, 'workDays'>) => (s && s.workDays.length ? s.workDays : DEFAULT_WORK_DAYS);
export const weeklyHoursOf = (s?: Pick<Staff, 'weeklyHours'>) => (s ? s.weeklyHours : 40);
const dailyHours = (s?: Pick<Staff, 'weeklyHours' | 'workDays'>) => weeklyHoursOf(s) / workDaysOf(s).length;

/** Hours a person can work on a day: 0 on non-work days and on time off. */
export function capacityOn(date: string, s: Staff | undefined, off: TimeOff[], userId: string): number {
  if (!workDaysOf(s).includes(isoWeekday(date))) return 0;
  if (off.some((o) => o.userId === userId && o.startDate <= date && date <= o.endDate)) return 0;
  return dailyHours(s);
}

/**
 * Hours of work planned on a day for a person: each open task they are assigned to spreads its estimate evenly over
 * its working days (start..due), shared between its assignees. Tasks without both dates or an estimate plan nothing.
 */
export function plannedOn(date: string, userId: string, tasks: PmTask[], staffOf: (id: string) => Staff | undefined): number {
  let h = 0;
  for (const t of tasks) {
    if (t.status === 'done' || !t.estimateHours || !t.startDate || !t.dueDate || !t.assigneeIds.includes(userId)) continue;
    if (date < t.startDate || date > t.dueDate) continue;
    const days = daysBetween(t.startDate, t.dueDate).filter((d) => workDaysOf(staffOf(userId)).includes(isoWeekday(d)));
    if (!days.length || !days.includes(date)) continue;
    h += t.estimateHours / t.assigneeIds.length / days.length;
  }
  return h;
}

/** Capacity, planned and worked hours of one person over a range of days. */
export function availability(
  userId: string,
  days: string[],
  s: Staff | undefined,
  off: TimeOff[],
  tasks: PmTask[],
  entries: TimeEntry[],
  staffOf: (id: string) => Staff | undefined,
) {
  const capacity = sum(days.map((d) => capacityOn(d, s, off, userId)));
  const planned = sum(days.map((d) => plannedOn(d, userId, tasks, staffOf)));
  const set = new Set(days);
  const worked = sum(entries.filter((e) => e.userId === userId && counted(e) && set.has(e.date)).map((e) => e.hours));
  return { capacity, planned, worked, remaining: capacity - planned };
}

/** Utilisation = billable hours / capacity (null when there is no capacity). */
export const utilisation = (billableHours: number, capacity: number) => (capacity > 0 ? (billableHours / capacity) * 100 : null);

/* ---------- misc ---------- */

export const weekDays = (week: string) => Array.from({ length: 7 }, (_, i) => addDays(week, i));

/** A task is late when it is not done and its due date is before today. */
export const isLate = (t: Pick<PmTask, 'status' | 'dueDate'>, today = iso(new Date())) => t.status !== 'done' && !!t.dueDate && t.dueDate < today;

/**
 * CSV text (semicolon-separated + BOM so Excel opens accents in French locales). Cells starting with = + - @ are
 * prefixed with an apostrophe so a spreadsheet never runs them as a formula.
 */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

/** Downloads text as a file in the browser. */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[^\w.\-]+/g, '_');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The Monday-based week of today. */
export const thisWeek = () => mondayOf(new Date());

export const PROJECT_STATUS_COLOR: Record<string, string> = {
  planning: 'var(--text-3)',
  active: 'var(--ok)',
  onhold: 'var(--warn)',
  completed: 'var(--accent)',
  archived: 'var(--text-3)',
};
