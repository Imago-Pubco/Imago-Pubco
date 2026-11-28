/**
 * What the administrator receives outside Imago: the grouped summary e-mail, the "faces to set up" e-mail,
 * and the protected live follow-up page. Plain functions: they get the data, they return text or HTML.
 */
import { formatDuration } from '../../src/modules/dev/punch/engine.ts';
import type { OutboxMessage, PunchEmployee, PunchEvent, WeekSummary } from '../../src/modules/dev/punch/types.ts';

export interface EmployeeLine {
  employee: PunchEmployee;
  summary: WeekSummary;
  /** This week's 30 h question, if it was sent. */
  question: OutboxMessage | null;
  lastEvent: PunchEvent | null;
  /** Protected link to set up the reference face (only when missing). */
  faceLink: string | null;
}

/** Hour brackets of the summary, highest first, so the people close to 40 h are read first. */
const BRACKETS: { min: number; label: string }[] = [
  { min: 40, label: '40 h et plus (heures supplémentaires)' },
  { min: 35, label: '35 à 40 h' },
  { min: 30, label: '30 à 35 h' },
  { min: 20, label: '20 à 30 h' },
  { min: 10, label: '10 à 20 h' },
  { min: 0, label: 'Moins de 10 h' },
];

const STATUS = { off: 'absent', working: 'au travail', pause: 'en pause' } as const;
const IDENTITY = {
  verified: 'visage confirmé',
  enrolled: 'photo prise',
  mismatch: 'VISAGE NON RECONNU',
  no_camera: 'sans photo',
  no_reference: 'pas de visage de référence',
  off: 'sans vérification',
} as const;

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;
const when = (iso: string) => new Date(iso).toLocaleString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function answerText(q: OutboxMessage | null): string {
  if (!q) return 'question des 30 h pas encore posée';
  if (q.answer === 'yes') return `veut dépasser 40 h : OUI — « ${q.justification ?? ''} »`;
  if (q.answer === 'no') return 'ne dépassera pas 40 h : NON';
  return 'question des 30 h sans réponse';
}

export function bracketOf(minutes: number) {
  return BRACKETS.find((b) => minutes >= b.min * 60)!;
}

/** Grouped summary for the administrator: one e-mail for everybody, by hour bracket. */
export function digestMail(args: { lines: EmployeeLine[]; sinceIso: string | null; nowIso: string; followUpLink: string }) {
  const { lines, sinceIso, nowIso, followUpLink } = args;
  const out: string[] = ['Bonjour,', '', `Voici le suivi du pointage au ${when(nowIso)}.`, ''];

  for (const b of BRACKETS) {
    const group = lines.filter((l) => bracketOf(l.summary.workedMinutes) === b).sort((x, y) => y.summary.workedMinutes - x.summary.workedMinutes);
    if (!group.length) continue;
    out.push(`■ ${b.label} — ${group.length} employé${group.length > 1 ? 's' : ''}`);
    for (const l of group) {
      const s = l.summary;
      out.push(`- ${l.employee.name}${l.employee.role ? ` (${l.employee.role})` : ''} : ${formatDuration(s.workedMinutes)} faites, ${formatDuration(s.projectedMinutes)} prévues, ${STATUS[s.status]}${s.inPostShift ? ' après son quart' : ''}`);
      out.push(`    ${answerText(l.question)}`);
      if (l.lastEvent && (l.lastEvent.identity === 'mismatch' || l.lastEvent.identity === 'no_camera' || l.lastEvent.identity === 'no_reference')) {
        out.push(`    dernier pointage : ${IDENTITY[l.lastEvent.identity]} (${when(l.lastEvent.at)})`);
      }
      if (l.faceLink) out.push(`    visage de référence à configurer : ${l.faceLink}`);
    }
    out.push('');
  }

  // 30 h questions: everybody who reached 30 h this week, with the question's state.
  const at30 = lines.filter((l) => l.summary.workedMinutes >= 30 * 60).sort((x, y) => y.summary.workedMinutes - x.summary.workedMinutes);
  out.push('Questions des 30 h (« Voulez-vous faire du temps supplémentaire, plus de 40 h, cette semaine ? ») :');
  if (!at30.length) out.push('- personne n’a encore atteint 30 h cette semaine');
  for (const l of at30) {
    const q = l.question;
    const state = !q
      ? 'question pas encore envoyée'
      : q.answer === 'yes'
        ? `OUI — justification : « ${q.justification ?? ''} » (répondu ${when(q.answeredAt!)})`
        : q.answer === 'no'
          ? `NON (répondu ${when(q.answeredAt!)})`
          : `pas encore de réponse (question envoyée ${when(q.createdAt)})`;
    out.push(`- ${l.employee.name}, ${formatDuration(l.summary.workedMinutes)} : ${state}`);
  }
  out.push('');

  const answered = lines.filter((l) => l.question?.answeredAt && (!sinceIso || l.question.answeredAt > sinceIso));
  out.push(sinceIso ? `Réponses reçues depuis le dernier résumé (${when(sinceIso)}) :` : 'Réponses reçues :');
  if (!answered.length) out.push('- aucune');
  for (const l of answered) out.push(`- ${l.employee.name} : ${l.question!.answer === 'yes' ? `OUI — « ${l.question!.justification ?? ''} »` : 'NON'} (${when(l.question!.answeredAt!)})`);
  out.push('', 'Suivi en direct de tous les employés :', followUpLink, '', 'Ce lien est personnel : ne le transférez pas.', '', 'Pointage Pubco');

  const over = lines.filter((l) => l.summary.workedMinutes >= 35 * 60).length;
  return {
    subject: `Suivi du pointage : ${lines.length} employé${lines.length > 1 ? 's' : ''}${over ? `, ${over} à 35 h ou plus` : ''}`,
    body: out.join('\n'),
  };
}

/** One e-mail listing every employee whose reference face is missing, each with their protected setup link. */
export function facesMail(args: { lines: { employee: PunchEmployee; link: string }[] }) {
  const { lines } = args;
  const body = [
    'Bonjour,',
    '',
    lines.length > 1
      ? `${lines.length} employés n'ont pas encore de visage de référence. Sans lui, la tablette ne peut pas confirmer leur identité quand ils pointent.`
      : `${lines[0].employee.name} n'a pas encore de visage de référence. Sans lui, la tablette ne peut pas confirmer son identité quand il ou elle pointe.`,
    '',
    'Ouvrez le lien de chaque personne sur un appareil avec caméra (ordinateur, iPad, téléphone), placez la personne devant la caméra : le visage est enregistré en quelques secondes.',
    '',
    ...lines.map((l) => `- ${l.employee.name}${l.employee.role ? ` (${l.employee.role})` : ''} :\n  ${l.link}`),
    '',
    'Seuls 128 nombres qui décrivent le visage et une petite photo d’identité sont gardés. Les photos prises à chaque pointage sont effacées tout de suite.',
    'Ces liens sont personnels : ne les transférez pas.',
    '',
    'Pointage Pubco',
  ].join('\n');
  return {
    subject: lines.length > 1 ? `Pointage : ${lines.length} visages de référence à configurer` : `Pointage : visage de référence à configurer pour ${firstName(lines[0].employee.name)}`,
    body,
  };
}

/* ---------- protected HTML pages ---------- */

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function page(title: string, body: string, refreshSeconds?: number) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${refreshSeconds ? `<meta http-equiv="refresh" content="${refreshSeconds}">` : ''}<meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:20px 16px}
main{max-width:1200px;margin:0 auto}h1{margin:0 0 4px;font-size:24px}.muted{color:#64748b;font-size:14px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-top:16px;overflow:hidden}
.card h2{font-size:16px;margin:0;padding:12px 14px;border-bottom:1px solid #e2e8f0;background:#f1f5f9}
.wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:left;vertical-align:middle}
th{font-size:12px;text-transform:uppercase;color:#64748b;letter-spacing:.04em}
img.av,span.av{width:44px;height:44px;border-radius:50%;object-fit:cover;display:inline-block;background:#e2e8f0}
.tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;background:#dcfce7;color:#15803d}
.warn{background:#fef3c7;color:#b45309}.red{background:#fee2e2;color:#b91c1c}.grey{background:#f1f5f9;color:#64748b}
.bar{position:relative;height:8px;min-width:140px;border-radius:999px;background:#e2e8f0}.bar i{position:absolute;inset:0 auto 0 0;border-radius:999px;background:#22c55e}
.bar i.over{background:#f59e0b}a.btn{display:inline-block;padding:4px 10px;border-radius:8px;background:#7c3aed;color:#fff;text-decoration:none;font-size:13px}
.mono{font-family:ui-monospace,monospace}
</style></head><body><main>${body}</main></body></html>`;
}

export function followUpPage(args: { lines: EmployeeLine[]; nowIso: string; today: PunchEvent[]; names: Map<string, string> }) {
  const { lines, nowIso, today, names } = args;
  const kind = { in: 'Entrée', pause_start: 'Pause', pause_end: 'Fin de pause', out: 'Sortie' } as const;
  const rows = BRACKETS.flatMap((b) => {
    const group = lines.filter((l) => bracketOf(l.summary.workedMinutes) === b).sort((x, y) => y.summary.workedMinutes - x.summary.workedMinutes);
    if (!group.length) return [];
    return [
      `<tr><th colspan="8" style="background:#f8fafc">${esc(b.label)} · ${group.length}</th></tr>`,
      ...group.map((l) => {
        const s = l.summary;
        const pct = Math.min(s.workedMinutes / (45 * 60), 1) * 100;
        const q = l.question;
        const ans = !q
          ? '<span class="tag grey">pas encore posée</span>'
          : q.answer === 'yes'
            ? `<span class="tag warn">Oui</span> ${esc(q.justification ?? '')}`
            : q.answer === 'no'
              ? '<span class="tag">Non</span>'
              : '<span class="tag grey">sans réponse</span>';
        const id = l.lastEvent
          ? `<span class="tag ${['mismatch', 'no_camera', 'no_reference'].includes(l.lastEvent.identity) ? 'red' : ''}">${IDENTITY[l.lastEvent.identity]}</span> <span class="muted">${esc(when(l.lastEvent.at))}</span>`
          : '<span class="muted">—</span>';
        const face = l.faceLink ? `<a class="btn" href="${esc(l.faceLink)}">Configurer le visage</a>` : '';
        return `<tr>
<td>${l.employee.photo ? `<img class="av" src="${l.employee.photo}" alt="">` : '<span class="av"></span>'}</td>
<td><b>${esc(l.employee.name)}</b><div class="muted">${esc(l.employee.role ?? '')}</div>${face}</td>
<td>${s.status === 'working' ? '<span class="tag">Au travail</span>' : s.status === 'pause' ? '<span class="tag warn">En pause</span>' : '<span class="tag grey">Absent</span>'}${s.inPostShift ? ' <span class="tag warn">après son quart</span>' : ''}</td>
<td class="mono">${formatDuration(s.todayMinutes)}</td>
<td class="mono"><b>${formatDuration(s.workedMinutes)}</b><div class="bar"><i class="${s.workedMinutes >= 2400 ? 'over' : ''}" style="width:${pct}%"></i></div></td>
<td class="mono">${formatDuration(s.projectedMinutes)}</td>
<td>${ans}</td>
<td>${id}</td></tr>`;
      }),
    ];
  });
  const todayRows = today
    .slice()
    .reverse()
    .map(
      (e) =>
        `<tr><td class="mono">${esc(when(e.at))}</td><td>${esc(names.get(e.employeeId) ?? '—')}</td><td>${kind[e.kind]}</td><td><span class="tag ${['mismatch', 'no_camera', 'no_reference'].includes(e.identity) ? 'red' : e.identity === 'off' ? 'grey' : ''}">${IDENTITY[e.identity]}</span>${e.source === 'admin' ? ' <span class="tag grey">corrigé</span>' : ''}</td></tr>`,
    )
    .join('');
  return page(
    'Suivi du pointage',
    `<h1>Suivi du pointage</h1><div class="muted">Mis à jour ${esc(when(nowIso))} · la page se rafraîchit toute seule toutes les 30 secondes</div>
<div class="card"><h2>Employés de la semaine, par tranche d'heures</h2><div class="wrap"><table>
<tr><th></th><th>Employé</th><th>Statut</th><th>Aujourd'hui</th><th>Semaine</th><th>Prévu</th><th>Dépasser 40 h ?</th><th>Dernier pointage</th></tr>
${rows.join('') || '<tr><td colspan="8" class="muted">Aucun employé actif.</td></tr>'}</table></div></div>
<div class="card"><h2>Pointages d'aujourd'hui</h2><div class="wrap"><table><tr><th>Heure</th><th>Employé</th><th>Pointage</th><th>Identité</th></tr>
${todayRows || '<tr><td colspan="4" class="muted">Aucun pointage aujourd’hui.</td></tr>'}</table></div></div>`,
    30,
  );
}
