/** Helpers of the Timesheet and Approvals pages (no React here). Server rules: see server/pmGuard.ts. */
import type { EntryStatus, Project, TimeEntry } from './schemas';
import { parseDate, round2 } from './lib';

export const MAX_HOURS_PER_DAY = 24;
/** One timer per signed-in person (a shared browser must not hand A's timer to B). */
export const timerKey = (userId: string) => `imago.pm.timer.${userId}`;

/** One line of the timesheet: a project, and optionally one of its tasks. */
export interface RowRef {
  projectId: string;
  taskId: string | null;
}
export const rowKeyOf = (r: RowRef) => `${r.projectId}|${r.taskId ?? ''}`;

/** Submitted and approved time is read-only until an approver takes it back. */
export const isLocked = (e: Pick<TimeEntry, 'status'>) => e.status === 'submitted' || e.status === 'approved';

/** Open to time: not archived, not completed, not closed to time. */
export const isOpenToTime = (p: Pick<Project, 'status' | 'closedToTime'>) => p.status !== 'archived' && p.status !== 'completed' && !p.closedToTime;
/** May this person book time on the project: open to time, and the person is its manager or a member. */
export const canBook = (p: Project, userId: string) => isOpenToTime(p) && (p.managerId === userId || p.memberIds.includes(userId));

export const entryTotal = (es: Pick<TimeEntry, 'hours'>[]) => round2(es.reduce((a, e) => a + e.hours, 0));
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type ParsedHours = { kind: 'empty' } | { kind: 'value'; value: number } | { kind: 'invalid' } | { kind: 'max' };

/** Accepts "1,5", "1.5", "1:30" (and ".5"). Empty or zero means "no entry". */
export function parseHours(raw: string): ParsedHours {
  const s = raw.trim().replace(',', '.');
  if (!s) return { kind: 'empty' };
  let v: number;
  const hm = /^(\d{1,2}):([0-5]\d)$/.exec(s);
  if (hm) v = Number(hm[1]) + Number(hm[2]) / 60;
  else if (/^(\d+\.?\d*|\.\d+)$/.test(s)) v = Number(s);
  else return { kind: 'invalid' };
  v = round2(v);
  if (v > MAX_HOURS_PER_DAY) return { kind: 'max' };
  if (v === 0) return { kind: 'empty' };
  return { kind: 'value', value: v };
}

/** 1.5 -> "1,5" (French decimal comma, what the inputs show). */
export const hoursText = (h: number) => round2(h).toLocaleString('fr-CA', { maximumFractionDigits: 2 });

const STATUS_TEXT: Record<EntryStatus, [string, string]> = {
  draft: ['Brouillon', 'Draft'],
  submitted: ['Soumis', 'Submitted'],
  approved: ['Approuvé', 'Approved'],
  rejected: ['Rejeté', 'Rejected'],
};
export const statusText = (s: EntryStatus, lang: string) => (lang === 'fr' ? STATUS_TEXT[s][0] : STATUS_TEXT[s][1]);
export const ENTRY_STATUS_COLOR: Record<EntryStatus, string> = {
  draft: 'var(--text-3)',
  submitted: 'var(--warn)',
  approved: 'var(--ok)',
  rejected: 'var(--err)',
};

/** "lun. 9" style label of a day. */
export const dayLabel = (date: string, lang: string) => parseDate(date).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'short', day: 'numeric' });
/** "9 nov. 2026" style label of a day. */
export const dateLabel = (date: string, lang: string) => parseDate(date).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { day: 'numeric', month: 'short', year: 'numeric' });

/** Runs writes in parallel and reports how many worked and the first error message. */
export async function settleAll(ops: Array<() => Promise<unknown>>): Promise<{ ok: number; error: string | null }> {
  const results = await Promise.allSettled(ops.map((op) => op()));
  let ok = 0;
  let error: string | null = null;
  for (const r of results) {
    if (r.status === 'fulfilled') ok++;
    else if (!error) error = errMsg(r.reason);
  }
  return { ok, error };
}

/* ---------- running timer (localStorage, guarded: storage can be blocked) ---------- */

export interface RunningTimer {
  projectId: string;
  taskId: string | null;
  startedAt: number;
}

export function readTimer(userId: string): RunningTimer | null {
  try {
    const raw = window.localStorage.getItem(timerKey(userId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<RunningTimer>;
    if (typeof v.projectId !== 'string' || typeof v.startedAt !== 'number') return null;
    if (v.taskId !== null && typeof v.taskId !== 'string') return null;
    return { projectId: v.projectId, taskId: v.taskId ?? null, startedAt: v.startedAt };
  } catch {
    return null;
  }
}

export function writeTimer(userId: string, timer: RunningTimer | null): void {
  try {
    if (timer) window.localStorage.setItem(timerKey(userId), JSON.stringify(timer));
    else window.localStorage.removeItem(timerKey(userId));
  } catch {
    // Storage unavailable: the timer then only lives while this page is open.
  }
}

/** Elapsed time rounded UP to the quarter hour, at least 0.25 h, at most 24 h (the entry limit). */
export function roundUpQuarter(ms: number): number {
  const quarters = Math.ceil(Number(((ms / 3_600_000) * 4).toFixed(6)));
  return Math.min(MAX_HOURS_PER_DAY, Math.max(1, quarters) / 4);
}

/** hh:mm:ss */
export function formatElapsed(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
