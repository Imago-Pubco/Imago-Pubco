/**
 * Punch card week engine. Pure: no React, no DOM, no storage.
 * Schedule times are minutes since local midnight (08:30 = 510). Punch times are epoch ms.
 */
import type {
  DayShift,
  DaySummary,
  EngineEvent,
  PunchKind,
  UpcomingShift,
  WeekInput,
  WeekSummary,
  WorkStatus,
} from './types.ts';

/** Hour thresholds that trigger an e-mail. */
export const HOUR_THRESHOLDS = [10, 20, 30, 40];

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTH_NAMES = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

const pad2 = (n: number): string => String(n).padStart(2, '0');

export function hhmmToMinute(s: string): number {
  const [h, m] = s.trim().split(':');
  return Number(h) * 60 + Number(m);
}

export function minuteToHhmm(m: number): string {
  const total = Math.floor(m);
  const h = Math.floor(total / 60);
  return `${pad2(h)}:${pad2(total - h * 60)}`;
}

/** 485 → '8 h 05', 45 → '45 min', 2400 → '40 h 00'. Rounds down to the minute. */
export function formatDuration(min: number): string {
  const total = Math.max(0, Math.floor(min));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  return `${h} h ${pad2(total - h * 60)}`;
}

/** Local date 'YYYY-MM-DD'. */
export function dateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local midnight of the day `addDays` after the local day of `ms` (DST-safe). */
function startOfDay(ms: number, addDays = 0): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + addDays).getTime();
}

/** Local midnight of the Sunday on or before `ms` (weeks run Sunday → Saturday). */
export function weekStartOf(ms: number): number {
  return startOfDay(ms, -new Date(ms).getDay());
}

/** 'Lundi 30 novembre'. */
export function frenchDayLabel(ms: number): string {
  const d = new Date(ms);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

/** Local minute of day, fractional (seconds included). */
function minuteOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes() + (d.getSeconds() + d.getMilliseconds() / 1000) / 60;
}

function shiftMinutes(shift: DayShift): number {
  const planned = shift.pauses.reduce((sum, p) => sum + p.minutes, 0);
  return hhmmToMinute(shift.end) - hhmmToMinute(shift.start) - planned;
}

interface Pause {
  start: number;
  /** null while the pause is still open. */
  end: number | null;
}

interface Segment {
  start: number;
  /** null while the segment is still open. */
  end: number | null;
  pauses: Pause[];
}

function openPauseOf(seg: Segment): Pause | null {
  const last = seg.pauses[seg.pauses.length - 1];
  return last && last.end === null ? last : null;
}

/** Replays the punches (already sorted and filtered) and returns the work segments and final state. */
function replay(events: EngineEvent[]): { segments: Segment[]; status: WorkStatus } {
  const segments: Segment[] = [];
  let open: Segment | null = null;
  for (const ev of events) {
    if (open === null) {
      if (ev.kind === 'in') {
        open = { start: ev.at, end: null, pauses: [] };
        segments.push(open);
      }
      continue;
    }
    const pause = openPauseOf(open);
    if (pause === null) {
      if (ev.kind === 'pause_start') open.pauses.push({ start: ev.at, end: null });
      else if (ev.kind === 'out') {
        open.end = ev.at;
        open = null;
      }
    } else if (ev.kind === 'pause_end') {
      pause.end = ev.at;
    } else if (ev.kind === 'out') {
      pause.end = ev.at;
      open.end = ev.at;
      open = null;
    }
  }
  let status: WorkStatus = 'off';
  if (open !== null) status = openPauseOf(open) === null ? 'working' : 'pause';
  return { segments, status };
}

function nextAllowedFor(status: WorkStatus): PunchKind[] {
  if (status === 'off') return ['in'];
  if (status === 'working') return ['pause_start', 'out'];
  return ['pause_end', 'out'];
}

export function computeWeek(input: WeekInput): WeekSummary {
  const { schedule, weekStart, now } = input;
  const weekEnd = startOfDay(weekStart, 7);
  // Nothing counts past `now`, nor past the end of the week.
  const limit = Math.min(now, weekEnd);

  const inWeek = input.events
    .filter((e) => e.at >= weekStart && e.at < weekEnd)
    .sort((a, b) => a.at - b.at);
  const { segments, status } = replay(inWeek);

  const days: DaySummary[] = [];
  for (let i = 0; i < 7; i++) {
    days.push({
      date: dateKey(startOfDay(weekStart, i)),
      workedMinutes: 0,
      pauseMinutes: 0,
      shift: schedule[i] ?? null,
    });
  }

  let workedMinutes = 0;
  for (const seg of segments) {
    const dayIndex = days.findIndex((d) => d.date === dateKey(seg.start));
    const start = Math.min(seg.start, limit);
    const end = Math.min(seg.end ?? limit, limit);
    let pauseMs = 0;
    for (const p of seg.pauses) {
      const ps = Math.min(p.start, limit);
      const pe = Math.min(p.end ?? limit, limit);
      pauseMs += Math.max(0, pe - ps);
    }
    const worked = Math.max(0, end - start - pauseMs) / 60000;
    const pause = pauseMs / 60000;
    workedMinutes += worked;
    if (dayIndex >= 0) {
      days[dayIndex].workedMinutes += worked;
      days[dayIndex].pauseMinutes += pause;
    }
  }

  const todayKey = dateKey(now);
  const todayIndex = days.findIndex((d) => d.date === todayKey);
  const todayMinutes = todayIndex >= 0 ? days[todayIndex].workedMinutes : 0;
  const todayShift = todayIndex >= 0 ? days[todayIndex].shift : null;

  // Shifts still ahead: today's (if not ended), then the following days of the week.
  const nowMod = minuteOfDay(now);
  const firstIndex = todayIndex >= 0 ? todayIndex : now < weekStart ? 0 : 7;
  const upcoming: UpcomingShift[] = [];
  let remainingScheduledMinutes = 0;
  for (let i = firstIndex; i < 7; i++) {
    const shift = days[i].shift;
    if (shift === null) continue;
    if (i === todayIndex) {
      const startMin = hhmmToMinute(shift.start);
      const endMin = hhmmToMinute(shift.end);
      if (nowMod >= endMin) continue;
      const windowStart = Math.max(nowMod, startMin);
      let length = endMin - windowStart;
      for (const p of shift.pauses) {
        const pm = hhmmToMinute(p.at);
        if (pm >= windowStart && pm < endMin) length -= p.minutes;
      }
      remainingScheduledMinutes += Math.max(0, length);
    } else {
      remainingScheduledMinutes += shiftMinutes(shift);
    }
    upcoming.push({
      date: days[i].date,
      label: frenchDayLabel(startOfDay(weekStart, i)),
      shift,
      minutes: shiftMinutes(shift),
    });
  }

  const inPostShift =
    status !== 'off' &&
    (todayShift === null || nowMod > hhmmToMinute(todayShift.end));

  return {
    status,
    workedMinutes,
    todayMinutes,
    days,
    reachedHours: HOUR_THRESHOLDS.filter((h) => workedMinutes >= h * 60),
    upcoming,
    remainingScheduledMinutes,
    projectedMinutes: workedMinutes + remainingScheduledMinutes,
    inPostShift,
    nextAllowed: nextAllowedFor(status),
  };
}
