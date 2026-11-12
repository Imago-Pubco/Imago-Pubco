/**
 * Computations of Gestion de projet → Rapports. Every builder returns plain tables whose cells carry a raw value and a
 * kind; the screen formats them and the CSV export writes the raw values. Filters: period, client, project, person
 * (time reports), counted-only or approved-only (time reports), "as of" date (budget).
 */
import { addDays, iso, mondayOf } from './lib';
import { BUDGET_COLOR, budgetUse, capacityOn, counted, daysBetween, entryFee, expenseFee, profitability, projectActuals, round2, sum, toCsv, utilisation } from './lib';
import { quarterOf } from '../lib';
import type { Client, EntryStatus, Expense, PmTask, Project, Rate, Staff, TimeEntry, TimeOff } from './schemas';

export type Tr = (fr: string, en: string) => string;

export interface Range {
  from: string;
  to: string;
}
export type Preset = 'week' | 'month' | 'quarter' | 'year';

export function presetRange(p: Preset, now = new Date()): Range {
  const y = now.getFullYear();
  if (p === 'week') {
    const from = mondayOf(now);
    return { from, to: addDays(from, 6) };
  }
  if (p === 'month') return { from: iso(new Date(y, now.getMonth(), 1)), to: iso(new Date(y, now.getMonth() + 1, 0)) };
  if (p === 'quarter') {
    const q = quarterOf(now);
    return { from: q.start, to: q.end };
  }
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export type ReportKey = 'projectTime' | 'personTime' | 'budget' | 'profit' | 'expenses' | 'detail';
export const REPORT_KEYS: ReportKey[] = ['projectTime', 'personTime', 'budget', 'profit', 'expenses', 'detail'];
export const REPORT_LABEL: Record<ReportKey, { fr: string; en: string }> = {
  projectTime: { fr: 'Temps par projet', en: 'Time by project' },
  personTime: { fr: 'Temps par personne', en: 'Time by person' },
  budget: { fr: 'Budget vs réel', en: 'Budget vs actual' },
  profit: { fr: 'Rentabilité', en: 'Profitability' },
  expenses: { fr: 'Dépenses', en: 'Expenses' },
  detail: { fr: 'Détail du temps', en: 'Time detail' },
};

/** Which filters a report responds to (the screen shows the others as not applicable). */
export interface Applies {
  person: boolean;
  status: boolean;
  asOf: boolean;
}
export const APPLIES: Record<ReportKey, Applies> = {
  projectTime: { person: true, status: true, asOf: false },
  personTime: { person: true, status: true, asOf: false },
  budget: { person: false, status: false, asOf: true },
  profit: { person: false, status: true, asOf: false },
  expenses: { person: false, status: false, asOf: false },
  detail: { person: true, status: true, asOf: false },
};

export interface Filters {
  range: Range;
  clientId: string;
  projectId: string;
  userId: string;
  /** Time reports: approved entries only (default: every counted entry, i.e. not rejected). */
  approvedOnly: boolean;
}

export interface ReportData {
  projects: Project[];
  clients: Client[];
  tasks: PmTask[];
  entries: TimeEntry[];
  expenses: Expense[];
  staff: Staff[];
  rates: Rate[];
  timeOff: TimeOff[];
  /** Ids of the active people. */
  people: string[];
}

export interface Ctx {
  tr: Tr;
  nameOf: (id?: string) => string;
}

export type Kind = 'text' | 'date' | 'hours' | 'money' | 'pct' | 'num';
export interface Cell {
  v: string | number | null;
  kind: Kind;
  tone?: string;
}
export interface Header {
  label: string;
  kind: Kind;
}
export interface Table {
  title: string;
  notes: string[];
  headers: Header[];
  rows: Cell[][];
  totals: Cell[] | null;
}

const cell = (v: string | number | null, kind: Kind, tone?: string): Cell => ({ v, kind, tone });
const text = (v: string | null | undefined) => cell(v ? v : null, 'text');
const yesNo = (b: boolean, tr: Tr) => (b ? tr('Oui', 'Yes') : tr('Non', 'No'));
const inRange = (date: string, r: Range) => date >= r.from && date <= r.to;
const label = (p: Project) => `${p.code} · ${p.name}`;

function scopedProjects(d: ReportData, f: Filters): Project[] {
  return d.projects.filter((p) => (!f.projectId || p.id === f.projectId) && (!f.clientId || p.clientId === f.clientId));
}

/** Counted time entries in the period and filters. */
function timeEntries(d: ReportData, f: Filters, opts: { person: boolean; status: boolean }): TimeEntry[] {
  const ids = new Set(scopedProjects(d, f).map((p) => p.id));
  return d.entries.filter(
    (e) =>
      counted(e) &&
      ids.has(e.projectId) &&
      inRange(e.date, f.range) &&
      (!opts.person || !f.userId || e.userId === f.userId) &&
      (!opts.status || !f.approvedOnly || e.status === 'approved'),
  );
}

/** Totals row: sums the hours, money and number columns; other columns stay empty unless overridden. */
function table(cx: Ctx, title: string, headers: Header[], rows: Cell[][], opts: { notes?: string[]; override?: Record<number, Cell> } = {}): Table {
  const totals = rows.length
    ? headers.map((h, i): Cell => {
        const o = opts.override?.[i];
        if (o) return o;
        if (i === 0) return text(cx.tr('Total', 'Total'));
        if (h.kind !== 'hours' && h.kind !== 'money' && h.kind !== 'num') return cell(null, h.kind);
        const nums = rows.map((r) => r[i]?.v).filter((v): v is number => typeof v === 'number');
        return cell(nums.length ? round2(sum(nums)) : null, h.kind);
      })
    : null;
  return { title, notes: opts.notes ?? [], headers, rows, totals };
}

const clientNames = (d: ReportData) => new Map(d.clients.map((c) => [c.id, c.name]));

function projectTime(d: ReportData, f: Filters, cx: Ctx): Table[] {
  const es = timeEntries(d, f, { person: true, status: true });
  const cn = clientNames(d);
  const rows: Cell[][] = [];
  for (const p of scopedProjects(d, f)) {
    const pe = es.filter((e) => e.projectId === p.id);
    if (!pe.length) continue;
    const hours = sum(pe.map((e) => e.hours));
    const billable = sum(pe.filter((e) => e.billable).map((e) => e.hours));
    const act = projectActuals(p.id, d.entries, d.expenses);
    const bu = budgetUse(p, act);
    const usedPct = p.budgetHours ? (act.hours / p.budgetHours) * 100 : null;
    rows.push([
      text(label(p)),
      text(cn.get(p.clientId ?? '')),
      cell(round2(hours), 'hours'),
      cell(round2(billable), 'hours'),
      cell(round2(hours - billable), 'hours'),
      cell(round2(sum(pe.map(entryFee))), 'money'),
      cell(p.budgetHours, 'hours'),
      cell(usedPct === null ? null : round2(usedPct), 'pct', usedPct === null ? undefined : BUDGET_COLOR[bu.level]),
    ]);
  }
  const headers: Header[] = [
    { label: cx.tr('Projet', 'Project'), kind: 'text' },
    { label: cx.tr('Client', 'Client'), kind: 'text' },
    { label: cx.tr('Heures', 'Hours'), kind: 'hours' },
    { label: cx.tr('Heures facturables', 'Billable hours'), kind: 'hours' },
    { label: cx.tr('Heures non facturables', 'Non-billable hours'), kind: 'hours' },
    { label: cx.tr('Honoraires', 'Fees'), kind: 'money' },
    { label: cx.tr('Budget (h)', 'Budget (h)'), kind: 'hours' },
    { label: cx.tr('% du budget utilisé', '% of budget used'), kind: 'pct' },
  ];
  return [
    table(cx, cx.tr('Temps par projet', 'Time by project'), headers, rows, {
      notes: [
        cx.tr(
          'Honoraires = heures facturables x taux de la tâche. % utilisé = cumul de tout le temps compté du projet, quelle que soit la période.',
          'Fees = billable hours x task rate. % used = cumulative counted time of the project, whatever the period.',
        ),
      ],
    }),
  ];
}

function personTime(d: ReportData, f: Filters, cx: Ctx): Table[] {
  const es = timeEntries(d, f, { person: true, status: true });
  const days = daysBetween(f.range.from, f.range.to);
  const staffMap = new Map(d.staff.map((s) => [s.id, s]));
  const ids = f.userId ? [f.userId] : Array.from(new Set([...d.people, ...es.map((e) => e.userId)]));
  const rows: { id: string; hours: number; billable: number; capacity: number }[] = [];
  for (const id of ids) {
    const pe = es.filter((e) => e.userId === id);
    const capacity = sum(days.map((day) => capacityOn(day, staffMap.get(id), d.timeOff, id)));
    const hours = sum(pe.map((e) => e.hours));
    if (hours === 0 && capacity === 0) continue;
    rows.push({ id, hours, billable: sum(pe.filter((e) => e.billable).map((e) => e.hours)), capacity });
  }
  rows.sort((a, b) => cx.nameOf(a.id).localeCompare(cx.nameOf(b.id)));
  const body = rows.map((r) => [
    text(cx.nameOf(r.id)),
    cell(round2(r.hours), 'hours'),
    cell(round2(r.billable), 'hours'),
    cell(round2(r.hours - r.billable), 'hours'),
    cell(round2(r.capacity), 'hours'),
    cell(utilisation(r.billable, r.capacity), 'pct'),
  ]);
  const billableSum = sum(rows.map((r) => r.billable));
  const capacitySum = sum(rows.map((r) => r.capacity));
  const headers: Header[] = [
    { label: cx.tr('Personne', 'Person'), kind: 'text' },
    { label: cx.tr('Heures', 'Hours'), kind: 'hours' },
    { label: cx.tr('Heures facturables', 'Billable hours'), kind: 'hours' },
    { label: cx.tr('Heures non facturables', 'Non-billable hours'), kind: 'hours' },
    { label: cx.tr('Capacité de la période', 'Capacity in period'), kind: 'hours' },
    { label: cx.tr('Utilisation', 'Utilisation'), kind: 'pct' },
  ];
  const util = utilisation(billableSum, capacitySum);
  return [
    table(cx, cx.tr('Temps par personne', 'Time by person'), headers, body, {
      notes: [
        cx.tr(
          'Utilisation = heures facturables / capacité de la période (jours travaillés, congés déduits).',
          'Utilisation = billable hours / capacity in the period (work days, time off deducted).',
        ),
      ],
      override: { 5: cell(util === null ? null : round2(util), 'pct') },
    }),
  ];
}

function levelLabel(level: string, tr: Tr): string {
  switch (level) {
    case 'ok':
      return 'OK';
    case 'warn':
      return tr('Alerte', 'Warning');
    case 'over':
      return tr('Dépassé', 'Over');
    default:
      return '—';
  }
}

function budget(d: ReportData, f: Filters, cx: Ctx): Table[] {
  const asOf = f.range.to;
  const cn = clientNames(d);
  const rows: Cell[][] = [];
  for (const p of scopedProjects(d, f)) {
    if (p.budgetHours === null && p.budgetAmount === null) continue;
    const es = d.entries.filter((e) => counted(e) && e.projectId === p.id && e.date <= asOf);
    const xs = d.expenses.filter((x) => x.projectId === p.id && x.date <= asOf);
    const a = projectActuals(p.id, es, xs);
    const bu = budgetUse(p, a);
    const tone = BUDGET_COLOR[bu.level];
    rows.push([
      text(label(p)),
      text(cn.get(p.clientId ?? '')),
      cell(p.budgetHours, 'hours'),
      cell(round2(a.hours), 'hours'),
      cell(bu.hoursPct === null ? null : round2(bu.hoursPct), 'pct', bu.hoursPct === null ? undefined : tone),
      cell(p.budgetAmount, 'money'),
      cell(round2(a.fees), 'money'),
      cell(bu.amountPct === null ? null : round2(bu.amountPct), 'pct', bu.amountPct === null ? undefined : tone),
      cell(levelLabel(bu.level, cx.tr), 'text', tone),
      cell(p.budgetHours === null ? null : round2(p.budgetHours - a.hours), 'hours'),
      cell(p.budgetAmount === null ? null : round2(p.budgetAmount - a.fees), 'money'),
    ]);
  }
  const headers: Header[] = [
    { label: cx.tr('Projet', 'Project'), kind: 'text' },
    { label: cx.tr('Client', 'Client'), kind: 'text' },
    { label: cx.tr('Budget (h)', 'Budget (h)'), kind: 'hours' },
    { label: cx.tr('Réel (h)', 'Actual (h)'), kind: 'hours' },
    { label: cx.tr('% h utilisées', '% h used'), kind: 'pct' },
    { label: cx.tr('Budget ($)', 'Budget ($)'), kind: 'money' },
    { label: cx.tr('Réel ($)', 'Actual ($)'), kind: 'money' },
    { label: cx.tr('% $ utilisés', '% $ used'), kind: 'pct' },
    { label: cx.tr('Niveau', 'Level'), kind: 'text' },
    { label: cx.tr('Reste (h)', 'Remaining (h)'), kind: 'hours' },
    { label: cx.tr('Reste ($)', 'Remaining ($)'), kind: 'money' },
  ];
  return [
    table(cx, cx.tr('Budget vs réel', 'Budget vs actual'), headers, rows, {
      notes: [
        cx.tr(
          `Réel cumulé jusqu'au ${asOf} (temps compté et dépenses). Alerte au seuil du projet, dépassé à 100 %. Les filtres de personne et de statut ne s'appliquent pas.`,
          `Cumulative actual up to ${asOf} (counted time and expenses). Warning at the project's threshold, over at 100 %. Person and status filters do not apply.`,
        ),
      ],
    }),
  ];
}

function profit(d: ReportData, f: Filters, cx: Ctx): Table[] {
  const es = timeEntries(d, f, { person: false, status: true });
  const ids = new Set(scopedProjects(d, f).map((p) => p.id));
  const xs = d.expenses.filter((x) => ids.has(x.projectId) && inRange(x.date, f.range));
  const cn = clientNames(d);
  const rateIds = new Set(d.rates.map((r) => r.id));
  const byClient = new Map<string, { revenue: number; cost: number }>();
  const rows: Cell[][] = [];
  for (const p of scopedProjects(d, f)) {
    const pe = es.filter((e) => e.projectId === p.id);
    const px = xs.filter((x) => x.projectId === p.id);
    if (!pe.length && !px.length) continue;
    const pr = profitability(p, projectActuals(p.id, pe, px), pe, d.rates);
    rows.push([
      text(label(p)),
      text(cn.get(p.clientId ?? '')),
      cell(round2(pr.revenue), 'money'),
      cell(round2(pr.cost), 'money'),
      cell(round2(pr.margin), 'money', pr.margin < 0 ? 'var(--err)' : undefined),
      cell(pr.marginPct === null ? null : round2(pr.marginPct), 'pct', pr.marginPct !== null && pr.marginPct < 0 ? 'var(--err)' : undefined),
    ]);
    const key = p.clientId ?? '';
    const acc = byClient.get(key) ?? { revenue: 0, cost: 0 };
    acc.revenue += pr.revenue;
    acc.cost += pr.cost;
    byClient.set(key, acc);
  }
  const missing = Array.from(new Set(es.map((e) => e.userId).filter((u) => !rateIds.has(u))));
  const notes = [
    cx.tr(
      'Revenu : honoraires facturables (forfait : montant du budget) + dépenses refacturées. Coût : taux de coût des personnes x heures, + dépenses.',
      'Revenue: billable fees (fixed fee: budget amount) + re-billed expenses. Cost: people cost rate x hours, + expenses.',
    ),
  ];
  if (missing.length) {
    notes.push(
      cx.tr(
        `Taux de coût manquant (coût compté à 0 $) : ${missing.map((u) => cx.nameOf(u)).join(', ')}`,
        `Missing cost rate (cost counted as $0): ${missing.map((u) => cx.nameOf(u)).join(', ')}`,
      ),
    );
  }
  const headers: Header[] = [
    { label: cx.tr('Projet', 'Project'), kind: 'text' },
    { label: cx.tr('Client', 'Client'), kind: 'text' },
    { label: cx.tr('Revenu', 'Revenue'), kind: 'money' },
    { label: cx.tr('Coût', 'Cost'), kind: 'money' },
    { label: cx.tr('Marge', 'Margin'), kind: 'money' },
    { label: cx.tr('Marge %', 'Margin %'), kind: 'pct' },
  ];
  const clientRows: Cell[][] = Array.from(byClient.entries()).map(([key, v]) => {
    const margin = v.revenue - v.cost;
    const mp = v.revenue > 0 ? (margin / v.revenue) * 100 : null;
    return [
      text(cn.get(key) ?? '—'),
      cell(round2(v.revenue), 'money'),
      cell(round2(v.cost), 'money'),
      cell(round2(margin), 'money', margin < 0 ? 'var(--err)' : undefined),
      cell(mp === null ? null : round2(mp), 'pct', mp !== null && mp < 0 ? 'var(--err)' : undefined),
    ];
  });
  const clientHeaders: Header[] = [
    { label: cx.tr('Client', 'Client'), kind: 'text' },
    { label: cx.tr('Revenu', 'Revenue'), kind: 'money' },
    { label: cx.tr('Coût', 'Cost'), kind: 'money' },
    { label: cx.tr('Marge', 'Margin'), kind: 'money' },
    { label: cx.tr('Marge %', 'Margin %'), kind: 'pct' },
  ];
  return [
    table(cx, cx.tr('Rentabilité par projet', 'Profitability by project'), headers, rows, { notes }),
    table(cx, cx.tr('Rentabilité par client', 'Profitability by client'), clientHeaders, clientRows),
  ];
}

function expenseReport(d: ReportData, f: Filters, cx: Ctx): Table[] {
  const ids = new Set(scopedProjects(d, f).map((p) => p.id));
  const pm = new Map(d.projects.map((p) => [p.id, p]));
  const xs = d.expenses.filter((x) => ids.has(x.projectId) && inRange(x.date, f.range)).sort((a, b) => a.date.localeCompare(b.date));
  const rows: Cell[][] = xs.map((x) => {
    const p = pm.get(x.projectId);
    return [
      cell(x.date, 'date'),
      text(p ? label(p) : null),
      text(x.vendor),
      text(x.description),
      cell(round2(x.cost), 'money'),
      cell(round2(x.markupPct), 'pct'),
      cell(round2(expenseFee(x)), 'money'),
      text(yesNo(x.billable, cx.tr)),
    ];
  });
  const headers: Header[] = [
    { label: cx.tr('Date', 'Date'), kind: 'date' },
    { label: cx.tr('Projet', 'Project'), kind: 'text' },
    { label: cx.tr('Fournisseur', 'Vendor'), kind: 'text' },
    { label: cx.tr('Description', 'Description'), kind: 'text' },
    { label: cx.tr('Coût', 'Cost'), kind: 'money' },
    { label: cx.tr('Marge %', 'Markup %'), kind: 'pct' },
    { label: cx.tr('Honoraires', 'Fees'), kind: 'money' },
    { label: cx.tr('Facturable', 'Billable'), kind: 'text' },
  ];
  return [table(cx, cx.tr('Dépenses', 'Expenses'), headers, rows)];
}

const statusLabel = (s: EntryStatus, tr: Tr) =>
  ({ draft: tr('Brouillon', 'Draft'), submitted: tr('Soumis', 'Submitted'), approved: tr('Approuvé', 'Approved'), rejected: tr('Rejeté', 'Rejected') })[s];

function detail(d: ReportData, f: Filters, cx: Ctx): Table[] {
  const es = timeEntries(d, f, { person: true, status: true }).sort(
    (a, b) => a.date.localeCompare(b.date) || cx.nameOf(a.userId).localeCompare(cx.nameOf(b.userId)),
  );
  const pm = new Map(d.projects.map((p) => [p.id, p]));
  const tasks = new Map(d.tasks.map((x) => [x.id, x.name]));
  const rows: Cell[][] = es.map((e) => {
    const p = pm.get(e.projectId);
    return [
      cell(e.date, 'date'),
      text(cx.nameOf(e.userId)),
      text(p ? label(p) : null),
      text(e.taskId ? (tasks.get(e.taskId) ?? null) : null),
      cell(round2(e.hours), 'hours'),
      text(yesNo(e.billable, cx.tr)),
      cell(e.billable ? round2(e.rate) : null, 'money'),
      cell(round2(entryFee(e)), 'money'),
      text(statusLabel(e.status, cx.tr)),
      text(e.note),
    ];
  });
  const headers: Header[] = [
    { label: cx.tr('Date', 'Date'), kind: 'date' },
    { label: cx.tr('Personne', 'Person'), kind: 'text' },
    { label: cx.tr('Projet', 'Project'), kind: 'text' },
    { label: cx.tr('Tâche', 'Task'), kind: 'text' },
    { label: cx.tr('Heures', 'Hours'), kind: 'hours' },
    { label: cx.tr('Facturable', 'Billable'), kind: 'text' },
    { label: cx.tr('Taux ($/h)', 'Rate ($/h)'), kind: 'money' },
    { label: cx.tr('Honoraires', 'Fees'), kind: 'money' },
    { label: cx.tr('Statut', 'Status'), kind: 'text' },
    { label: cx.tr('Note', 'Note'), kind: 'text' },
  ];
  return [table(cx, cx.tr('Détail du temps', 'Time detail'), headers, rows)];
}

export function buildReport(key: ReportKey, d: ReportData, f: Filters, cx: Ctx): Table[] {
  switch (key) {
    case 'projectTime':
      return projectTime(d, f, cx);
    case 'personTime':
      return personTime(d, f, cx);
    case 'budget':
      return budget(d, f, cx);
    case 'profit':
      return profit(d, f, cx);
    case 'expenses':
      return expenseReport(d, f, cx);
    case 'detail':
      return detail(d, f, cx);
  }
}

/** One CSV: each table with its title, notes, header, rows and totals, separated by a blank line. */
export function reportCsv(tables: Table[]): string {
  const out: (string | number | null)[][] = [];
  for (const tb of tables) {
    out.push([tb.title]);
    for (const n of tb.notes) out.push([n]);
    out.push(tb.headers.map((h) => h.label));
    for (const r of tb.rows) out.push(r.map((c) => c.v));
    if (tb.totals) out.push(tb.totals.map((c) => c.v));
    out.push([]);
  }
  return toCsv(out);
}
