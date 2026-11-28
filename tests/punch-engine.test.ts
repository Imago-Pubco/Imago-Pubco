import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWeek,
  dateKey,
  formatDuration,
  frenchDayLabel,
  hhmmToMinute,
  minuteToHhmm,
  weekStartOf,
} from '../src/modules/dev/punch/engine.ts';
import { planMails } from '../src/modules/dev/punch/notify.ts';
import { ANSWER_LINK } from '../src/modules/dev/punch/types.ts';
import type {
  DayShift,
  EngineEvent,
  PunchEmployee,
  PunchSettings,
  WeekSchedule,
} from '../src/modules/dev/punch/types.ts';

/* ---------- Fixtures: week of Sunday 2026-11-22 (Mon = day 1, Fri = day 5) ---------- */

const WEEK_START = new Date(2026, 10, 22).getTime();
/** Local time on day `day` of the week (day 0 = Sunday 22 November, may overflow). */
const at = (day: number, hh: number, mm = 0): number => new Date(2026, 10, 22 + day, hh, mm).getTime();
const ev = (kind: EngineEvent['kind'], ms: number): EngineEvent => ({ kind, at: ms });

const MON_FRI: DayShift = { start: '08:00', end: '16:30', pauses: [{ at: '10:00', minutes: 15 }] };
const SCHEDULE: WeekSchedule = [null, MON_FRI, MON_FRI, MON_FRI, MON_FRI, MON_FRI, null];

const week = (events: EngineEvent[], now: number, schedule: WeekSchedule = SCHEDULE) =>
  computeWeek({ schedule, weekStart: WEEK_START, events, now });

/** A plain 08:00 → 16:30 day (510 min) on the given day of the week. */
const fullDay = (day: number): EngineEvent[] => [ev('in', at(day, 8)), ev('out', at(day, 16, 30))];

const EMP: PunchEmployee = {
  id: 'emp_julie',
  name: 'Julie Tremblay',
  phoneLast4: '1234',
  email: 'julie@example.com',
  role: 'Régie',
  schedule: SCHEDULE,
  active: true,
  photo: null,
  hasFace: false,
};
const SETTINGS: PunchSettings = {
  id: 'settings',
  senderEmail: 'punch@example.com',
  directorEmail: 'director@example.com',
  photoCheck: false,
};

const mailArgs = (
  summary: ReturnType<typeof week>,
  now: number,
  extra: {
    existingKeys?: string[];
    answer30?: 'yes' | 'no' | null;
    justification30?: string | null;
  } = {},
) => ({
  employee: EMP,
  summary,
  weekStart: '2026-11-22',
  settings: SETTINGS,
  existingKeys: new Set(extra.existingKeys ?? []),
  answer30: extra.answer30 ?? null,
  justification30: extra.justification30 ?? null,
  now,
});

/* ---------- Engine: helpers ---------- */

test('formatDuration: minutes under an hour, then hours and zero-padded minutes', () => {
  assert.equal(formatDuration(45), '45 min');
  assert.equal(formatDuration(0), '0 min');
  assert.equal(formatDuration(59.9), '59 min');
  assert.equal(formatDuration(485), '8 h 05');
  assert.equal(formatDuration(2400), '40 h 00');
  assert.equal(formatDuration(2559.9), '42 h 39');
});

test('hhmmToMinute and minuteToHhmm are inverse, minutes round down', () => {
  assert.equal(hhmmToMinute('08:30'), 510);
  assert.equal(minuteToHhmm(510), '08:30');
  assert.equal(minuteToHhmm(1439.9), '23:59');
});

test('weekStartOf: a Wednesday gives the previous Sunday midnight, a Sunday gives itself', () => {
  assert.equal(weekStartOf(at(3, 10, 15)), new Date(2026, 10, 22, 0, 0).getTime());
  assert.equal(weekStartOf(at(0, 15)), new Date(2026, 10, 22, 0, 0).getTime());
  assert.equal(weekStartOf(at(6, 23, 59)), WEEK_START);
});

test('dateKey and frenchDayLabel', () => {
  assert.equal(dateKey(at(3, 9)), '2026-11-25');
  assert.equal(frenchDayLabel(at(1, 12)), 'Lundi 23 novembre');
  assert.equal(frenchDayLabel(new Date(2026, 10, 30).getTime()), 'Lundi 30 novembre');
});

/* ---------- Engine: week computation ---------- */

test('simple in/out day counts the time punched in', () => {
  const s = week([ev('in', at(1, 8)), ev('out', at(1, 12))], at(1, 18));
  assert.equal(s.status, 'off');
  assert.equal(s.workedMinutes, 240);
  assert.equal(s.todayMinutes, 240);
  assert.equal(s.days[1].workedMinutes, 240);
  assert.deepEqual(s.nextAllowed, ['in']);
});

test('pauses are subtracted from worked time and counted as pause minutes', () => {
  const s = week(
    [ev('in', at(1, 8)), ev('pause_start', at(1, 10)), ev('pause_end', at(1, 10, 15)), ev('out', at(1, 16, 30))],
    at(1, 18),
  );
  assert.equal(s.workedMinutes, 495);
  assert.equal(s.days[1].pauseMinutes, 15);
});

test('open work segment counts up to now', () => {
  const s = week([ev('in', at(1, 8))], at(1, 11));
  assert.equal(s.status, 'working');
  assert.equal(s.workedMinutes, 180);
  assert.equal(s.todayMinutes, 180);
  assert.deepEqual(s.nextAllowed, ['pause_start', 'out']);
});

test('open pause counts until now and status is pause', () => {
  const s = week([ev('in', at(1, 8)), ev('pause_start', at(1, 10))], at(1, 10, 20));
  assert.equal(s.status, 'pause');
  assert.equal(s.workedMinutes, 120);
  assert.equal(s.days[1].pauseMinutes, 20);
  assert.deepEqual(s.nextAllowed, ['pause_end', 'out']);
});

test('out during a pause ends the pause and the segment', () => {
  const s = week([ev('in', at(1, 8)), ev('pause_start', at(1, 10)), ev('out', at(1, 10, 30))], at(1, 11));
  assert.equal(s.status, 'off');
  assert.equal(s.workedMinutes, 120);
  assert.equal(s.days[1].pauseMinutes, 30);
  assert.deepEqual(s.nextAllowed, ['in']);
});

test('invalid sequences are ignored', () => {
  const s = week(
    [
      ev('in', at(1, 8)),
      ev('in', at(1, 8, 5)), // double in
      ev('pause_end', at(1, 9)), // no pause
      ev('out', at(1, 12)),
      ev('pause_start', at(1, 13)), // off: ignored
      ev('out', at(1, 13, 30)), // off: ignored
    ],
    at(1, 14),
  );
  assert.equal(s.status, 'off');
  assert.equal(s.workedMinutes, 240);
});

test('events outside the week are ignored', () => {
  const s = week(
    [
      ev('in', at(-1, 20)), // Saturday before the week
      ev('out', at(-1, 23)),
      ev('in', at(7, 8)), // Sunday after the week
      ev('out', at(7, 12)),
    ],
    at(3, 12),
  );
  assert.equal(s.workedMinutes, 0);
  assert.equal(s.status, 'off');
  assert.ok(s.days.every((d) => d.workedMinutes === 0));
});

test('an open segment stops at the end of the week', () => {
  const s = week([ev('in', at(6, 20))], at(8, 10));
  assert.equal(s.status, 'working');
  assert.equal(s.workedMinutes, 240);
  assert.equal(s.days[6].workedMinutes, 240);
  assert.equal(s.todayMinutes, 0);
});

test('reachedHours lists the thresholds passed', () => {
  const s = week([...fullDay(1), ...fullDay(2), ...fullDay(3)], at(3, 17));
  assert.equal(s.workedMinutes, 1530);
  assert.deepEqual(s.reachedHours, [10, 20]);
});

test('days: 7 entries Sunday first with the scheduled shifts', () => {
  const s = week([ev('in', at(1, 8))], at(1, 9));
  assert.equal(s.days.length, 7);
  assert.equal(s.days[0].date, '2026-11-22');
  assert.equal(s.days[6].date, '2026-11-28');
  assert.equal(s.days[0].shift, null);
  assert.equal(s.days[1].shift?.start, '08:00');
  assert.equal(s.todayMinutes, 60);
});

test('upcoming and remaining minutes mid-shift with a pause still ahead', () => {
  // Monday 09:00, working since 08:00: the 10:00 pause (15 min) is still ahead.
  const s = week([ev('in', at(1, 8))], at(1, 9));
  assert.equal(s.upcoming.length, 5);
  assert.equal(s.upcoming[0].label, 'Lundi 23 novembre');
  assert.equal(s.upcoming[0].minutes, 495);
  assert.equal(s.upcoming[4].label, 'Vendredi 27 novembre');
  // Today: 09:00 → 16:30 = 450, minus the 15 min pause = 435. Tue → Fri: 4 × 495.
  assert.equal(s.remainingScheduledMinutes, 435 + 4 * 495);
  assert.equal(s.projectedMinutes, 60 + 435 + 4 * 495);
});

test('upcoming drops today once its shift has ended', () => {
  const s = week(fullDay(1), at(1, 17));
  assert.equal(s.upcoming.length, 4);
  assert.equal(s.upcoming[0].label, 'Mardi 24 novembre');
  assert.equal(s.remainingScheduledMinutes, 4 * 495);
});

test('inPostShift: after the shift end while working, false when off or before the end, true on a day off', () => {
  assert.equal(week([ev('in', at(1, 8))], at(1, 17)).inPostShift, true);
  assert.equal(week(fullDay(1), at(1, 17)).inPostShift, false);
  assert.equal(week([ev('in', at(1, 8))], at(1, 9)).inPostShift, false);
  assert.equal(week([ev('in', at(0, 12))], at(0, 13)).inPostShift, true);
});

/* ---------- E-mails ---------- */

test('hours mail at 20 h: thank-you text, once, no answer link', () => {
  const now = at(3, 17);
  const s = week([...fullDay(1), ...fullDay(2), ...fullDay(3)], now); // 25 h 30: reached 10 and 20
  const mails = planMails(mailArgs(s, now));
  assert.equal(mails.length, 1);
  const m = mails[0];
  assert.equal(m.kind, 'hours_20');
  assert.equal(m.key, 'emp_julie|2026-11-22|hours_20');
  assert.equal(m.to, 'julie@example.com');
  assert.equal(m.subject, 'Merci ! 20 h de travail cette semaine chez Pubco');
  assert.equal(m.asksYesNo, false);
  assert.match(m.body, /^Bonjour Julie,/);
  assert.match(m.body, /Lundi 23 novembre : 8 h 30/);
  assert.match(m.body, /Merci pour votre travail chez Pubco !/);
  assert.match(m.body, /L'équipe Pubco/);
  assert.ok(!m.body.includes(ANSWER_LINK));
});

test('hours mail at 10 h: thank-you text with the 10 h subject', () => {
  const now = at(2, 17);
  const s = week([...fullDay(1), ...fullDay(2)], now); // 17 h: reached 10 only
  const mails = planMails(mailArgs(s, now));
  assert.equal(mails.length, 1);
  assert.equal(mails[0].kind, 'hours_10');
  assert.equal(mails[0].subject, 'Merci ! 10 h de travail cette semaine chez Pubco');
  assert.match(mails[0].body, /Vous avez travaillé 17 h 00 cette semaine\./);
  assert.ok(!mails[0].body.includes(ANSWER_LINK));
});

test('hours mail is not sent again when its key already exists', () => {
  const now = at(3, 17);
  const s = week([...fullDay(1), ...fullDay(2), ...fullDay(3)], now);
  const mails = planMails(mailArgs(s, now, { existingKeys: ['emp_julie|2026-11-22|hours_20'] }));
  assert.equal(mails.length, 0);
});

test('30 h mail asks yes/no with the answer link and lists upcoming shifts and the projected total', () => {
  const now = at(4, 17); // Thursday 17:00, 34 h worked
  const s = week([...fullDay(1), ...fullDay(2), ...fullDay(3), ...fullDay(4)], now);
  const mails = planMails(mailArgs(s, now));
  assert.equal(mails.length, 1);
  const m = mails[0];
  assert.equal(m.kind, 'hours_30');
  assert.equal(m.subject, 'Pointage : 30 h cette semaine, allez-vous dépasser 40 h ?');
  assert.equal(m.asksYesNo, true);
  assert.match(m.body, /Vendredi 27 novembre : entrée 08:00, sortie 16:30, pauses 10:00 \(15 min\)/);
  assert.match(m.body, /Total prévu si vous suivez l'horaire : 42 h 15/);
  assert.match(m.body, /Allez-vous dépasser 40 h cette semaine \?/);
  assert.match(m.body, /Répondez Oui ou Non ici \(si oui, dites-nous pourquoi\) :/);
  assert.match(m.body, /tablette de pointage/);
  assert.ok(m.body.includes(ANSWER_LINK));
});

test('40 h mail says the hours beyond 40 h are overtime to approve, no answer link', () => {
  const now = at(5, 17); // Friday 17:00, 42 h 30 worked
  const s = week([...fullDay(1), ...fullDay(2), ...fullDay(3), ...fullDay(4), ...fullDay(5)], now);
  const mails = planMails(mailArgs(s, now)).filter((m) => m.kind !== 'director_35');
  assert.equal(mails.length, 1);
  assert.equal(mails[0].kind, 'hours_40');
  assert.equal(mails[0].subject, 'Pointage : 40 h atteintes cette semaine');
  assert.equal(mails[0].asksYesNo, false);
  assert.match(mails[0].body, /heures supplémentaires/);
  assert.match(mails[0].body, /approuvées par le directeur de production/);
  assert.ok(!mails[0].body.includes(ANSWER_LINK));
});

test('director mail as soon as 35 h are crossed, during or after the shift', () => {
  // 34 h, off: no director mail
  const now1 = at(4, 17);
  const s1 = week([...fullDay(1), ...fullDay(2), ...fullDay(3), ...fullDay(4)], now1);
  assert.ok(planMails(mailArgs(s1, now1)).every((m) => m.kind !== 'director_35'));

  // 43 h, working after the shift: director mail, sent after the hours mail
  const now2 = at(5, 17);
  const s2 = week([...fullDay(1), ...fullDay(2), ...fullDay(3), ...fullDay(4), ev('in', at(5, 8))], now2);
  const mails2 = planMails(mailArgs(s2, now2));
  const director = mails2.find((m) => m.kind === 'director_35');
  assert.ok(director);
  assert.equal(mails2[mails2.length - 1].kind, 'director_35');
  assert.equal(director.to, 'director@example.com');
  assert.equal(director.key, 'emp_julie|2026-11-22|director_35');
  assert.equal(director.subject, 'Heures : Julie Tremblay a franchi 35 h (43 h 00), encore au travail après son quart');
  assert.match(director.body, /a franchi 35 h cette semaine et est encore au travail après son quart/);
  assert.match(director.body, /Fin du quart prévu aujourd'hui : 16:30/);
  assert.match(director.body, /n'a pas encore répondu/);
  assert.ok(!director.body.includes('Justification'));

  // 42 h 30, already left: still a director mail (35 h crossed this week)
  const now3 = at(5, 17);
  const s3 = week([...fullDay(1), ...fullDay(2), ...fullDay(3), ...fullDay(4), ...fullDay(5)], now3);
  const d3 = planMails(mailArgs(s3, now3)).find((m) => m.kind === 'director_35');
  assert.ok(d3);
  assert.match(d3.body, /a franchi 35 h cette semaine./);

  // 36 h during the shift (10:00): director mail, says the employee is at work
  const now4 = at(5, 10);
  const s4 = week([...fullDay(1), ...fullDay(2), ...fullDay(3), ...fullDay(4), ev('in', at(5, 8))], now4);
  assert.ok(s4.workedMinutes >= 35 * 60);
  const d4 = planMails(mailArgs(s4, now4)).find((m) => m.kind === 'director_35');
  assert.ok(d4);
  assert.match(d4.body, /en ce moment au travail/);
  assert.ok(!d4.subject.includes('après son quart'));
});

test('director mail prints the justification only when the 30 h answer is yes', () => {
  const now = at(5, 17);
  const s = week([...fullDay(1), ...fullDay(2), ...fullDay(3), ...fullDay(4), ev('in', at(5, 8))], now);

  const yes = planMails(mailArgs(s, now, { answer30: 'yes', justification30: 'Inventaire de fin d\'année' }));
  const dYes = yes.find((m) => m.kind === 'director_35');
  assert.ok(dYes);
  assert.match(dYes.body, /a répondu Oui/);
  assert.match(dYes.body, /Justification : Inventaire de fin d'année/);

  const yesNoText = planMails(mailArgs(s, now, { answer30: 'yes', justification30: null }));
  assert.ok(!yesNoText.find((m) => m.kind === 'director_35')?.body.includes('Justification'));

  const no = planMails(mailArgs(s, now, { answer30: 'no', justification30: 'texte' }));
  const dNo = no.find((m) => m.kind === 'director_35');
  assert.ok(dNo);
  assert.match(dNo.body, /a répondu Non/);
  assert.ok(!dNo.body.includes('Justification'));
});

test('director mail is sent once per week', () => {
  const now = at(5, 17);
  const s = week([...fullDay(1), ...fullDay(2), ...fullDay(3), ...fullDay(4), ev('in', at(5, 8))], now);
  const first = planMails(mailArgs(s, now));
  assert.ok(first.some((m) => m.kind === 'director_35'));
  const second = planMails(mailArgs(s, now, { existingKeys: first.map((m) => m.key) }));
  assert.equal(second.length, 0);
});

test('every new mail is pending with null answer, justification, answeredAt, sentAt and error', () => {
  const now = at(4, 17);
  const s = week([...fullDay(1), ...fullDay(2), ...fullDay(3), ...fullDay(4)], now);
  const [m] = planMails(mailArgs(s, now, { answer30: 'yes', justification30: 'x' }));
  assert.equal(m.from, 'punch@example.com');
  assert.equal(m.weekStart, '2026-11-22');
  assert.equal(m.employeeId, 'emp_julie');
  assert.equal(m.answer, null);
  assert.equal(m.justification, null);
  assert.equal(m.answeredAt, null);
  assert.equal(m.status, 'pending');
  assert.equal(m.sentAt, null);
  assert.equal(m.error, null);
  assert.equal(m.createdAt, new Date(now).toISOString());
});

test('30 h question sent early during a pause when finishing the shift will cross 30 h', () => {
  // Mon–Wed 8 h 30 each = 25 h 30; Thursday in 08:00, pause 12:00, now 12:30 → 29 h 30 worked, on pause.
  const now = at(4, 12, 30);
  const s = week([...fullDay(1), ...fullDay(2), ...fullDay(3), ev('in', at(4, 8)), ev('pause_start', at(4, 12))], now);
  assert.equal(s.status, 'pause');
  assert.ok(s.workedMinutes < 30 * 60);
  const mails = planMails(mailArgs(s, now));
  const q = mails.find((m) => m.kind === 'hours_30');
  assert.ok(q);
  assert.equal(q.asksYesNo, true);
  assert.match(q.subject, /vous allez franchir 30 h aujourd'hui/);
  assert.match(q.body, /Vous êtes en pause avec 29 h 30 cette semaine/);
  assert.match(q.body, /sortie prévue à 16:30/);
  assert.ok(q.body.includes(ANSWER_LINK));
  // Same key as the normal 30 h mail: never sent twice.
  assert.equal(q.key, 'emp_julie|2026-11-22|hours_30');
  assert.equal(planMails(mailArgs(s, now, { existingKeys: [q.key] })).filter((m) => m.kind === 'hours_30').length, 0);
});

test('no early 30 h question when the rest of the shift stays under 30 h, or when not on a pause', () => {
  // Monday 8 h 30 + Tuesday 08:00–12:00 then pause: about 16 h 30 at the end of the shift.
  const now = at(2, 12, 30);
  const s = week([...fullDay(1), ev('in', at(2, 8)), ev('pause_start', at(2, 12))], now);
  assert.ok(planMails(mailArgs(s, now)).every((m) => m.kind !== 'hours_30'));
  // Same 29 h 30 as above but working, not on a pause: the question waits for 30 h.
  const now2 = at(4, 12, 30);
  const s2 = week([...fullDay(1), ...fullDay(2), ...fullDay(3), ev('in', at(4, 8, 30))], now2);
  assert.ok(s2.workedMinutes < 30 * 60);
  assert.ok(planMails(mailArgs(s2, now2)).every((m) => m.kind !== 'hours_30'));
});
