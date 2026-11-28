/**
 * E-mail rules of the punch card. Pure: builds the outbox messages to add, the caller stores them.
 * Texts are French, plain text, short. Deduplication is done with the `key` of each message.
 * Also run by the punch server (Node), hence the explicit .ts extensions.
 */
import { ANSWER_LINK } from './types.ts';
import type {
  DayShift,
  MailKind,
  OutboxMessage,
  PunchEmployee,
  PunchSettings,
  UpcomingShift,
  WeekSummary,
} from './types.ts';
import { dateKey, formatDuration, frenchDayLabel, hhmmToMinute } from './engine.ts';

export type NewMail = Omit<OutboxMessage, 'id'>;

const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name.trim();

/** 'YYYY-MM-DD' → 'Lundi 23 novembre'. */
function labelOfDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return frenchDayLabel(new Date(y, m - 1, d).getTime());
}

function shiftLine(u: UpcomingShift): string {
  const pauses = u.shift.pauses.length
    ? u.shift.pauses.map((p) => `${p.at} (${p.minutes} min)`).join(', ')
    : 'aucune pause';
  return `- ${u.label} : entrée ${u.shift.start}, sortie ${u.shift.end}, pauses ${pauses}`;
}

/**
 * Hours this week at the end of today's shift if the employee works until the scheduled exit
 * (planned pauses still ahead are taken off). null when there is no shift left today or the employee is off.
 */
export function estimateAtShiftEnd(summary: WeekSummary, now: number): { minutes: number; shiftEnd: string } | null {
  if (summary.status === 'off') return null;
  const today = summary.days.find((d) => d.date === dateKey(now));
  const shift = today?.shift;
  if (!shift) return null;
  const d = new Date(now);
  const nowMin = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  const end = hhmmToMinute(shift.end);
  if (nowMin >= end) return null;
  const from = Math.max(nowMin, hhmmToMinute(shift.start));
  const pausesAhead = shift.pauses.filter((p) => hhmmToMinute(p.at) >= from && hhmmToMinute(p.at) < end).reduce((t, p) => t + p.minutes, 0);
  return { minutes: summary.workedMinutes + Math.max(0, end - from - pausesAhead), shiftEnd: shift.end };
}

function hoursBody(args: {
  first: string;
  summary: WeekSummary;
  top: number;
  /** Sent during a pause, before 30 h, because the rest of today's shift will cross 30 h. */
  early?: { minutes: number; shiftEnd: string };
}): string {
  const { first, summary, top, early } = args;
  const lines: string[] = [
    `Bonjour ${first},`,
    '',
    early
      ? `Vous êtes en pause avec ${formatDuration(summary.workedMinutes)} cette semaine. Si vous finissez votre quart d'aujourd'hui (sortie prévue à ${early.shiftEnd}), vous aurez environ ${formatDuration(early.minutes)} : vous allez franchir 30 h aujourd'hui.`
      : `Vous avez travaillé ${formatDuration(summary.workedMinutes)} cette semaine.`,
    '',
    'Détail par jour :',
  ];
  for (const day of summary.days) {
    if (day.workedMinutes > 0) {
      lines.push(`- ${labelOfDate(day.date)} : ${formatDuration(day.workedMinutes)}`);
    }
  }
  if (top === 30) {
    lines.push('', 'Quarts à venir cette semaine :');
    if (summary.upcoming.length === 0) lines.push('- aucun quart à venir');
    for (const u of summary.upcoming) lines.push(shiftLine(u));
    lines.push(
      '',
      `Total prévu si vous suivez l'horaire : ${formatDuration(summary.projectedMinutes)}`,
      '',
      'Allez-vous dépasser 40 h cette semaine ?',
      'Répondez Oui ou Non ici (si oui, dites-nous pourquoi) :',
      ANSWER_LINK,
      'Vous pouvez aussi répondre sur la tablette de pointage à votre prochain pointage.',
    );
  }
  if (top === 40) {
    lines.push(
      '',
      'Les heures au-delà de 40 h sont des heures supplémentaires et doivent être approuvées par le directeur de production.',
    );
  }
  if (top === 10 || top === 20) {
    lines.push('', 'Merci pour votre travail chez Pubco !', '', "L'équipe Pubco");
  } else {
    lines.push('', 'Merci.');
  }
  return lines.join('\n');
}

function directorBody(args: {
  employee: PunchEmployee;
  summary: WeekSummary;
  todayShift: DayShift | null;
  answer30: 'yes' | 'no' | null;
  justification30: string | null;
}): string {
  const { employee, summary, todayShift, answer30, justification30 } = args;
  const answerPhrase =
    answer30 === 'yes' ? 'a répondu Oui' : answer30 === 'no' ? 'a répondu Non' : "n'a pas encore répondu";
  const lines = [
    'Bonjour,',
    '',
    summary.inPostShift
      ? `${employee.name} a franchi 35 h cette semaine et est encore au travail après son quart.`
      : summary.status === 'off'
        ? `${employee.name} a franchi 35 h cette semaine.`
        : `${employee.name} a franchi 35 h cette semaine et est en ce moment au travail.`,
  ];
  if (employee.role) lines.push(`Poste : ${employee.role}`);
  lines.push(
    `Heures travaillées cette semaine : ${formatDuration(summary.workedMinutes)}`,
    todayShift
      ? `Fin du quart prévu aujourd'hui : ${todayShift.end}`
      : "Quart prévu aujourd'hui : aucun",
    `Total prévu si l'horaire est suivi : ${formatDuration(summary.projectedMinutes)}`,
    `Question des 30 h : ${employee.name} ${answerPhrase}.`,
  );
  const justification = justification30?.trim() ?? '';
  if (answer30 === 'yes' && justification) {
    lines.push(`Justification : ${justification}`);
  }
  lines.push('', 'Merci.');
  return lines.join('\n');
}

export function planMails(args: {
  employee: PunchEmployee;
  summary: WeekSummary;
  weekStart: string;
  settings: PunchSettings;
  existingKeys: Set<string>;
  answer30: 'yes' | 'no' | null;
  justification30: string | null;
  now: number;
}): NewMail[] {
  const { employee, summary, weekStart, settings, existingKeys, answer30, justification30, now } = args;
  const createdAt = new Date(now).toISOString();
  const mails: NewMail[] = [];
  const worked = formatDuration(summary.workedMinutes);

  // 30 h question sent early: on a pause, before 30 h, when finishing today's shift will cross 30 h.
  // (Already past 30 h: the question was sent when 30 h was crossed, nothing more here.)
  const key30 = `${employee.id}|${weekStart}|hours_30`;
  const early = summary.status === 'pause' && summary.workedMinutes < 30 * 60 ? estimateAtShiftEnd(summary, now) : null;
  if (early && early.minutes >= 30 * 60 && !existingKeys.has(key30)) {
    mails.push({
      key: key30,
      kind: 'hours_30',
      employeeId: employee.id,
      weekStart,
      from: settings.senderEmail,
      to: employee.email,
      subject: "Pointage : vous allez franchir 30 h aujourd'hui, allez-vous dépasser 40 h ?",
      body: hoursBody({ first: firstName(employee.name), summary, top: 30, early }),
      asksYesNo: true,
      answer: null,
      justification: null,
      answeredAt: null,
      createdAt,
      status: 'pending',
      sentAt: null,
      error: null,
    });
  }

  // Hours mail: only the highest threshold reached, so a catch-up never sends several at once.
  if (summary.reachedHours.length > 0) {
    const top = Math.max(...summary.reachedHours);
    const kind = `hours_${top}` as MailKind;
    const key = `${employee.id}|${weekStart}|${kind}`;
    if (!existingKeys.has(key)) {
      const subject =
        top === 30
          ? 'Pointage : 30 h cette semaine, allez-vous dépasser 40 h ?'
          : top === 40
            ? 'Pointage : 40 h atteintes cette semaine'
            : `Merci ! ${top} h de travail cette semaine chez Pubco`;
      mails.push({
        key,
        kind,
        employeeId: employee.id,
        weekStart,
        from: settings.senderEmail,
        to: employee.email,
        subject,
        body: hoursBody({ first: firstName(employee.name), summary, top }),
        asksYesNo: top === 30,
        answer: null,
        justification: null,
        answeredAt: null,
        createdAt,
        status: 'pending',
        sentAt: null,
        error: null,
      });
    }
  }

  // Director mail: as soon as 35 h are crossed (during or after the shift), once per week.
  if (summary.workedMinutes >= 35 * 60) {
    const todayKey = dateKey(now);
    const key = `${employee.id}|${weekStart}|director_35`;
    if (!existingKeys.has(key)) {
      const today = summary.days.find((d) => d.date === todayKey);
      mails.push({
        key,
        kind: 'director_35',
        employeeId: employee.id,
        weekStart,
        from: settings.senderEmail,
        to: settings.directorEmail,
        subject: `Heures : ${employee.name} a franchi 35 h (${worked})${summary.inPostShift ? ', encore au travail après son quart' : ''}`,
        body: directorBody({
          employee,
          summary,
          todayShift: today?.shift ?? null,
          answer30,
          justification30,
        }),
        asksYesNo: false,
        answer: null,
        justification: null,
        answeredAt: null,
        createdAt,
        status: 'pending',
        sentAt: null,
        error: null,
      });
    }
  }

  return mails;
}
