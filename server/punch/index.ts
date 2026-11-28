/**
 * Punch card server (Système 1, step 2): a small HTTPS server, separate from the Imago server.
 *  - Serves the tablet kiosk (built into dist-pointage/) to the iPad over HTTPS, so the camera works.
 *  - Kiosk API (any device on the network): identify by the last 4 phone digits, punch, answer the 30 h question.
 *  - Admin API (this computer only, through the Imago page): employees, punches, e-mails, settings.
 *  - Sends the e-mails through Gmail (.env.punch) and keeps everything in data/punch.sqlite.
 * Run with `npm run pointage` (builds the kiosk, then starts this file).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import nodemailer from 'nodemailer';
import { generate } from 'selfsigned';
import { computeWeek, dateKey, weekStartOf } from '../../src/modules/dev/punch/engine.ts';
import { planMails, type NewMail } from '../../src/modules/dev/punch/notify.ts';
import { ANSWER_LINK, type PunchEmployee, type PunchKind, type WeekSchedule, type WeekSummary } from '../../src/modules/dev/punch/types.ts';
import * as store from './store.ts';
import { digestMail, facesMail, followUpPage, page, type EmployeeLine } from './adminViews.ts';

const PORT = Number(process.env.PUNCH_PORT) || 8443;
const KIOSK_DIR = path.resolve(import.meta.dirname, '../../dist-pointage');
const FACE_MATCH_DISTANCE = 0.5;
const KINDS: PunchKind[] = ['in', 'pause_start', 'pause_end', 'out'];

/* ---------- configuration ---------- */

const smtp = {
  host: process.env.PUNCH_SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.PUNCH_SMTP_PORT) || 465,
  user: (process.env.PUNCH_SMTP_USER || '').trim(),
  password: (process.env.PUNCH_SMTP_PASSWORD || '').replace(/\s+/g, ''),
  fromName: process.env.PUNCH_FROM_NAME || 'Pubco – Pointage',
};
const mailEnabled = !!(smtp.user && smtp.password);
const transport = mailEnabled
  ? nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.port === 465, auth: { user: smtp.user, pass: smtp.password } })
  : null;

/** Real network addresses (Wi-Fi / Ethernet), without the virtual adapters of WSL, Docker or Hyper-V. */
function lanAddresses(): string[] {
  return Object.entries(os.networkInterfaces())
    .filter(([name]) => !/vEthernet|WSL|Docker|VirtualBox|VMware|Hyper-V|Loopback/i.test(name))
    .flatMap(([, list]) => list ?? [])
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

/**
 * Stable name of this computer on the local network (mDNS / Bonjour): stays the same when the router gives
 * a new IP address. The iPad and Macs resolve *.local natively, Windows 10/11 too.
 */
const LOCAL_NAME = `${os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, '-')}.local`;

/** localhost (this computer), the stable .local name, then the current IP addresses. */
const kioskUrls = () => ['localhost', LOCAL_NAME, ...lanAddresses()].map((h) => `https://${h}:${PORT}/`);
/** Address put in e-mail links: the stable .local name unless PUNCH_PUBLIC_URL says otherwise. */
const publicUrl = () => (process.env.PUNCH_PUBLIC_URL || `https://${LOCAL_NAME}:${PORT}`).replace(/\/+$/, '');

/** Protected links for the administrator: they carry the access key (renewable from the Imago page). */
const followUpLink = () => `${publicUrl()}/suivi?k=${store.accessKey()}`;
const faceLink = (employeeId: string) => `${publicUrl()}/visage?k=${store.accessKey()}&e=${employeeId}`;
function keyOk(k: unknown): boolean {
  const a = Buffer.from(String(k ?? ''));
  const b = Buffer.from(store.accessKey());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const settings = () => store.getSettings(smtp.user);
/** Server time (one place, so every rule uses the same clock). */
const now = () => Date.now();

/* ---------- week + e-mails ---------- */

function weekOf(employeeId: string, schedule: WeekSchedule, at: number): { summary: WeekSummary; weekStart: string } {
  const start = weekStartOf(at);
  const events = store.listEvents(new Date(start).toISOString(), new Date(start + 8 * 86_400_000).toISOString(), employeeId);
  const summary = computeWeek({ schedule, weekStart: start, events: events.map((e) => ({ kind: e.kind, at: Date.parse(e.at) })), now: at });
  return { summary, weekStart: dateKey(start) };
}

async function sendPending(mailId: string) {
  const mail = store.mailById(mailId);
  if (!mail || mail.status === 'sent') return;
  if (!transport) return store.setMailStatus(mail.id, 'disabled', 'Aucun compte Gmail configuré (.env.punch)');
  if (!mail.to) return store.setMailStatus(mail.id, 'failed', 'Aucune adresse de destinataire');
  try {
    await transport.sendMail({ from: { name: smtp.fromName, address: smtp.user }, to: mail.to, subject: mail.subject, text: mail.body });
    store.setMailStatus(mail.id, 'sent', null);
  } catch (e) {
    store.setMailStatus(mail.id, 'failed', e instanceof Error ? e.message : String(e));
  }
}

let notifying = Promise.resolve();
/** Applies the e-mail rules to every active employee; runs after each change and every 30 s. Serialised. */
function runNotifier() {
  notifying = notifying.then(notifyOnce).catch((e) => console.error('[pointage] notifier', e));
  return notifying;
}

async function notifyOnce() {
  const at = now();
  const s = settings();
  const existingKeys = new Set(store.listMails().map((m) => m.key));
  const alerts35: { employee: PunchEmployee; mail: NewMail }[] = [];
  for (const employee of store.listEmployees().filter((e) => e.active)) {
    const { summary, weekStart } = weekOf(employee.id, employee.schedule, at);
    const q30 = store.mailByKey(`${employee.id}|${weekStart}|hours_30`);
    const mails = planMails({
      employee,
      summary,
      weekStart,
      settings: s,
      existingKeys,
      answer30: q30?.answer ?? null,
      justification30: q30?.justification ?? null,
      now: at,
    });
    for (const m of mails) {
      if (m.kind === 'director_35') {
        alerts35.push({ employee, mail: m });
        existingKeys.add(m.key);
        continue;
      }
      const token = crypto.randomBytes(18).toString('base64url');
      const body = m.body.replaceAll(ANSWER_LINK, `${publicUrl()}/reponse?t=${token}`);
      const stored = store.insertMail({ ...m, body }, token);
      existingKeys.add(m.key);
      if (stored) await sendPending(stored.id);
    }
  }
  // 35 h alerts: one e-mail when one employee crosses 35 h, a single grouped e-mail when several cross together.
  if (alerts35.length === 1) {
    const stored = store.insertMail(alerts35[0].mail, crypto.randomBytes(18).toString('base64url'));
    if (stored) await sendPending(stored.id);
  } else if (alerts35.length > 1) {
    for (const a of alerts35) store.insertMail({ ...a.mail, status: 'grouped' }, crypto.randomBytes(18).toString('base64url'));
    await sendAdminMail(
      'director_35',
      `admin|35|${new Date(at).toISOString()}`,
      {
        subject: `Heures : ${alerts35.length} employés ont franchi 35 h`,
        body: [
          'Bonjour,',
          '',
          `${alerts35.length} employés viennent de franchir 35 h cette semaine :`,
          '',
          ...alerts35.map((a) => a.mail.body.replace(/^Bonjour,\n\n/, '').replace(/\n\nMerci\.$/, '')).map((b) => '■ ' + b.replaceAll('\n', '\n   ') + '\n'),
          '',
          `Suivi en direct : ${followUpLink()}`,
          '',
          'Merci.',
        ].join('\n'),
      },
      at,
    );
  }

  if (!s.directorEmail) return; // nowhere to send the administrator's e-mails yet

  // Faces to set up: one e-mail listing every employee not yet announced.
  const notified = store.faceNotified();
  const missing = store.listEmployees().filter((e) => e.active && !e.hasFace && !notified.includes(e.id));
  if (missing.length && s.photoCheck) {
    const m = facesMail({ lines: missing.map((employee) => ({ employee, link: faceLink(employee.id) })) });
    await sendAdminMail('admin_faces', `admin|faces|${new Date(at).toISOString()}`, m, at);
    store.setFaceNotified([...notified, ...missing.map((e) => e.id)]);
  }

  // Grouped summary every digestHours.
  const last = s.lastDigestAt ? Date.parse(s.lastDigestAt) : null;
  if (last === null || last > at || at - last >= s.digestHours * 3_600_000) await sendDigest(at);
}

function employeeLines(at: number): EmployeeLine[] {
  const start = weekStartOf(at);
  return store
    .listEmployees()
    .filter((e) => e.active)
    .map((employee) => {
      const { summary, weekStart } = weekOf(employee.id, employee.schedule, at);
      const evs = store.listEvents(new Date(start).toISOString(), new Date(at + 1).toISOString(), employee.id);
      return {
        employee,
        summary,
        question: store.mailByKey(`${employee.id}|${weekStart}|hours_30`) ?? null,
        lastEvent: evs[evs.length - 1] ?? null,
        faceLink: employee.hasFace || !settings().photoCheck ? null : faceLink(employee.id),
      };
    });
}

async function sendAdminMail(kind: 'admin_digest' | 'admin_faces' | 'director_35' | 'admin_new', key: string, m: { subject: string; body: string }, at: number) {
  const s = settings();
  const stored = store.insertMail(
    {
      key,
      kind,
      employeeId: '',
      weekStart: dateKey(weekStartOf(at)),
      from: s.senderEmail,
      to: s.directorEmail,
      subject: m.subject,
      body: m.body,
      asksYesNo: false,
      answer: null,
      justification: null,
      answeredAt: null,
      createdAt: new Date(at).toISOString(),
      status: 'pending',
      sentAt: null,
      error: null,
    },
    crypto.randomBytes(18).toString('base64url'),
  );
  if (stored) await sendPending(stored.id);
}

/** Summary of every active employee, grouped by hour bracket; sent to the administrator. */
async function sendDigest(at: number) {
  const s = settings();
  const lines = employeeLines(at);
  if (!s.directorEmail || !lines.length) return false;
  const nowIso = new Date(at).toISOString();
  const m = digestMail({ lines, sinceIso: s.lastDigestAt, nowIso, followUpLink: followUpLink() });
  await sendAdminMail('admin_digest', `admin|digest|${nowIso}`, m, at);
  store.setSetting('lastDigestAt', nowIso);
  return true;
}

/* ---------- HTTP ---------- */

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
  next();
});

const wrap = (fn: (req: Request, res: Response) => unknown) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res)).catch(next);
};
const bad = (res: Response, status: number, error: string) => res.status(status).json({ error });

/* Kiosk API: open to the network. Wrong codes are rate limited per address. */
const attempts = new Map<string, { count: number; reset: number }>();
function tooManyAttempts(ip: string): boolean {
  const t = Date.now();
  const a = attempts.get(ip);
  if (!a || a.reset < t) return false;
  return a.count >= 15;
}
function failAttempt(ip: string) {
  const t = Date.now();
  const a = attempts.get(ip);
  if (!a || a.reset < t) attempts.set(ip, { count: 1, reset: t + 5 * 60_000 });
  else a.count++;
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

function employeeByCode(req: Request, res: Response) {
  const ip = req.socket.remoteAddress ?? '';
  const code = String(req.body?.code ?? '');
  if (tooManyAttempts(ip)) return void bad(res, 429, 'Trop d’essais, attendez quelques minutes');
  const employee = /^\d{4}$/.test(code) ? store.findActiveByCode(code) : undefined;
  if (!employee) {
    failAttempt(ip);
    return void bad(res, 404, 'Code inconnu');
  }
  return employee;
}

function kioskView(employeeId: string) {
  const employee = store.getEmployee(employeeId)!;
  const { summary, weekStart } = weekOf(employee.id, employee.schedule, now());
  const q30 = store.mailByKey(`${employee.id}|${weekStart}|hours_30`);
  return {
    employee: { id: employee.id, firstName: firstName(employee.name) },
    summary,
    question: q30 ? { mailId: q30.id, answer: q30.answer, justification: q30.justification } : null,
    needsReference: settings().photoCheck && !employee.hasFace,
  };
}

app.get('/punch-api/kiosk/now', (_req, res) => {
  res.json({ now: new Date(now()).toISOString(), photoCheck: settings().photoCheck });
});

app.post(
  '/punch-api/kiosk/identify',
  wrap(async (req, res) => {
    const employee = employeeByCode(req, res);
    if (!employee) return;
    await runNotifier(); // a 30 h reached a minute ago must already show its question
    // No photo step when checks are off or when the admin has not taken the reference face yet.
    const reference = settings().photoCheck ? store.getFace(employee.id) : null;
    res.json({ ...kioskView(employee.id), photoCheck: !!reference, reference });
  }),
);

/**
 * A new employee signs up alone on the tablet: name, last 4 phone digits, e-mail (optional), reference face.
 * Created active (they can punch right away) but marked « à valider »; the administrator gets an e-mail at once.
 */
const signups = new Map<string, number[]>();
const DEFAULT_SHIFT = { start: '08:00', end: '16:30', pauses: [{ at: '12:00', minutes: 30 }] };
app.post(
  '/punch-api/kiosk/register',
  wrap(async (req, res) => {
    const ip = req.socket.remoteAddress ?? '';
    const recent = (signups.get(ip) ?? []).filter((t) => t > Date.now() - 3_600_000);
    if (recent.length >= 10) return bad(res, 429, 'Trop d’inscriptions, demandez à l’administrateur');
    const b = req.body ?? {};
    const name = String(b.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const code = String(b.phoneLast4 ?? '').trim();
    const email = String(b.email ?? '').trim().slice(0, 120);
    if (name.split(' ').length < 2 || name.length < 4) return bad(res, 400, 'Écrivez votre prénom et votre nom');
    if (!/^\d{4}$/.test(code)) return bad(res, 400, 'Le code doit avoir 4 chiffres');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(res, 400, email ? 'Courriel invalide' : 'Écrivez votre courriel');
    if (store.codeTaken(code)) return bad(res, 409, 'Ce code est déjà utilisé : demandez à l’administrateur');
    const d = b.descriptor;
    const descriptor = Array.isArray(d) && d.length === 128 && d.every((v: unknown) => typeof v === 'number' && Number.isFinite(v)) ? (d as number[]) : null;
    const photo = typeof b.photo === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(b.photo) && b.photo.length < 400_000 ? (b.photo as string) : null;
    if (settings().photoCheck && !descriptor) return bad(res, 400, 'La photo d’identité est obligatoire');
    signups.set(ip, [...recent, Date.now()]);

    const employee = store.createEmployee({
      name,
      phoneLast4: code,
      email,
      role: '',
      schedule: [null, DEFAULT_SHIFT, DEFAULT_SHIFT, DEFAULT_SHIFT, DEFAULT_SHIFT, DEFAULT_SHIFT, null],
      active: true,
      toApprove: true,
    });
    if (descriptor) store.setFace(employee.id, descriptor, photo);
    store.setFaceNotified([...store.faceNotified(), employee.id]);

    const at = now();
    if (settings().directorEmail) {
      await sendAdminMail(
        'admin_new',
        `admin|new|${employee.id}`,
        {
          subject: `Pointage : nouvel employé inscrit sur la tablette, ${name}`,
          body: [
            'Bonjour,',
            '',
            `${name} s'est inscrit sur la tablette de pointage le ${new Date(at).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' })}.`,
            `Code de pointage : ${code}`,
            `Courriel : ${email || 'aucun'}`,
            `Photo d'identité : ${descriptor ? 'prise' : 'non prise'}`,
            '',
            'Cette personne peut déjà pointer. Dans Imago → Punch card, vérifiez son identité, complétez son horaire (par défaut lundi au vendredi, 08:00 à 16:30) et cliquez « Valider ».',
            'Si vous ne la connaissez pas, supprimez-la.',
            '',
            `Suivi en direct : ${followUpLink()}`,
            '',
            'Pointage Pubco',
          ].join('\n'),
        },
        at,
      );
    }
    res.json({ ...kioskView(employee.id), photoCheck: !!descriptor, reference: descriptor });
  }),
);

app.post(
  '/punch-api/kiosk/punch',
  wrap(async (req, res) => {
    const employee = employeeByCode(req, res);
    if (!employee) return;
    const kind = req.body?.kind as PunchKind;
    if (!KINDS.includes(kind)) return bad(res, 400, 'Pointage inconnu');
    const at = now();
    const { summary, weekStart } = weekOf(employee.id, employee.schedule, at);
    if (!summary.nextAllowed.includes(kind)) return bad(res, 409, 'Ce pointage n’est pas possible maintenant');
    // The overtime question must be answered before any punch (also checked here, not only on the tablet).
    const q30 = store.mailByKey(`${employee.id}|${weekStart}|hours_30`);
    if (q30 && !q30.answer) return bad(res, 409, 'Répondez d’abord à la question du temps supplémentaire');

    // Identity is decided here, not trusted from the tablet: the descriptor is compared with the stored one.
    const descriptor = Array.isArray(req.body?.descriptor) && req.body.descriptor.length === 128 ? (req.body.descriptor as unknown[]).map(Number) : null;
    let identity: 'verified' | 'mismatch' | 'no_camera' | 'no_reference' | 'off' = 'off';
    let faceDistance: number | undefined;
    if (settings().photoCheck) {
      const reference = store.getFace(employee.id);
      // The reference face is only taken by the admin (Imago page); the tablet never creates one.
      if (!reference) {
        identity = 'no_reference';
      } else if (descriptor) {
        faceDistance = Math.round(Math.hypot(...reference.map((v, i) => v - descriptor[i])) * 1000) / 1000;
        identity = faceDistance < FACE_MATCH_DISTANCE ? 'verified' : 'mismatch';
      } else {
        identity = req.body?.faceStatus === 'mismatch' ? 'mismatch' : 'no_camera';
      }
    }
    const event = store.insertEvent({ employeeId: employee.id, at: new Date(at).toISOString(), kind, identity, faceDistance, source: 'kiosk' });
    await runNotifier();
    res.json({ event, ...kioskView(employee.id) });
  }),
);

function saveAnswer(mailId: string, employeeId: string | null, answer: unknown, justification: unknown): string | null {
  const mail = store.mailById(mailId);
  if (!mail || !mail.asksYesNo || (employeeId && mail.employeeId !== employeeId)) return 'Question introuvable';
  if (answer !== 'yes' && answer !== 'no') return 'Répondez Oui ou Non';
  const why = typeof justification === 'string' ? justification.trim().slice(0, 1000) : '';
  if (answer === 'yes' && why.length < 3) return 'Expliquez pourquoi vous voulez faire plus de 40 h';
  store.answerMail(mail.id, answer, answer === 'yes' ? why : null, new Date(now()).toISOString());
  return null;
}

app.post(
  '/punch-api/kiosk/answer',
  wrap(async (req, res) => {
    const employee = employeeByCode(req, res);
    if (!employee) return;
    const error = saveAnswer(String(req.body?.mailId ?? ''), employee.id, req.body?.answer, req.body?.justification);
    if (error) return bad(res, 400, error);
    res.json(kioskView(employee.id));
  }),
);

/* Answer page reached from the link of the 30 h e-mail. */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
function answerPage(body: string) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pointage Pubco</title><style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#fff;display:flex;justify-content:center;padding:32px 16px;margin:0}
main{max-width:520px;width:100%}label{display:block;margin:10px 0;font-size:18px}textarea{width:100%;box-sizing:border-box;min-height:110px;border-radius:12px;padding:12px;font:inherit}
button{margin-top:16px;width:100%;min-height:56px;border:0;border-radius:14px;background:#16a34a;color:#fff;font-size:20px;font-weight:700}.err{color:#fca5a5}</style></head><body><main>${body}</main></body></html>`;
}

/* Protected pages for the administrator (links from the e-mails, no Imago account needed). */
const denied = (res: Response) =>
  res.status(403).send(page('Lien invalide', '<h1>Lien invalide ou expiré</h1><p class="muted">Demandez un nouveau lien à la personne qui gère le pointage.</p>'));

app.get('/suivi', (req, res) => {
  if (!keyOk(req.query.k)) return denied(res);
  const at = now();
  const dayStart = new Date(at);
  dayStart.setHours(0, 0, 0, 0);
  const employees = store.listEmployees();
  res.setHeader('Cache-Control', 'no-store');
  res.send(
    followUpPage({
      lines: employeeLines(at),
      nowIso: new Date(at).toISOString(),
      today: store.listEvents(dayStart.toISOString(), new Date(at + 1).toISOString()),
      names: new Map(employees.map((e) => [e.id, e.name])),
    }),
  );
});

/** Face setup page: the kiosk bundle shows the camera when the path is /visage. */
app.get('/visage', (req, res) => {
  if (!keyOk(req.query.k) || !store.getEmployee(String(req.query.e ?? ''))) return denied(res);
  const html = path.join(KIOSK_DIR, 'pointage.html');
  if (!fs.existsSync(html)) return res.status(503).send('Borne non construite : lancez « npm run pointage ».');
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(html);
});

app.get('/punch-api/enroll/info', (req, res) => {
  if (!keyOk(req.query.k)) return bad(res, 403, 'Lien invalide');
  const e = store.getEmployee(String(req.query.e ?? ''));
  if (!e) return bad(res, 404, 'Employé introuvable');
  res.json({ name: e.name, firstName: firstName(e.name), hasFace: e.hasFace, photo: e.photo });
});

app.post('/punch-api/enroll', (req, res) => {
  if (!keyOk(req.body?.k)) return bad(res, 403, 'Lien invalide');
  const id = String(req.body?.e ?? '');
  if (!store.getEmployee(id)) return bad(res, 404, 'Employé introuvable');
  const d = req.body?.descriptor;
  const photo = req.body?.photo;
  if (!Array.isArray(d) || d.length !== 128 || !d.every((v: unknown) => typeof v === 'number' && Number.isFinite(v))) return bad(res, 400, 'Visage invalide');
  if (typeof photo !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo) || photo.length > 400_000) return bad(res, 400, 'Photo invalide');
  store.setFace(id, d as number[], photo);
  res.json({ ok: true });
});

app.get('/reponse', (req, res) => {
  const mail = store.mailByToken(String(req.query.t ?? ''));
  if (!mail) return res.status(404).send(answerPage('<h1>Lien invalide</h1>'));
  const employee = store.getEmployee(mail.employeeId);
  if (mail.answer) return res.send(answerPage(`<h1>Merci ${esc(firstName(employee?.name ?? ''))}</h1><p>Votre réponse est déjà enregistrée : <b>${mail.answer === 'yes' ? 'Oui' : 'Non'}</b>.</p>`));
  res.send(
    answerPage(`<h1>Bonjour ${esc(firstName(employee?.name ?? ''))}</h1><p>Allez-vous dépasser 40 h cette semaine ?</p>
<form method="post"><input type="hidden" name="t" value="${esc(String(req.query.t))}">
<label><input type="radio" name="answer" value="no" required> Non</label>
<label><input type="radio" name="answer" value="yes"> Oui, je veux faire plus de 40 h</label>
<label>Si oui, pourquoi ?<textarea name="justification" maxlength="1000"></textarea></label>
<button type="submit">Envoyer ma réponse</button></form>`),
  );
});

app.post(
  '/reponse',
  wrap(async (req, res) => {
    const mail = store.mailByToken(String(req.body?.t ?? ''));
    if (!mail) return res.status(404).send(answerPage('<h1>Lien invalide</h1>'));
    if (mail.answer) return res.redirect(303, `/reponse?t=${encodeURIComponent(String(req.body.t))}`);
    const error = saveAnswer(mail.id, null, req.body?.answer, req.body?.justification);
    if (error) return res.status(400).send(answerPage(`<p class="err">${esc(error)}</p><p><a style="color:#fff" href="/reponse?t=${encodeURIComponent(String(req.body.t))}">Revenir</a></p>`));
    await runNotifier();
    res.send(answerPage('<h1>Merci !</h1><p>Votre réponse est enregistrée. Vous pouvez fermer cette page.</p>'));
  }),
);

/* Admin API: only from this computer (the Imago page reaches it through the Vite proxy). Real sign-in comes in step 4. */
const admin = express.Router();
admin.use((req, res, next) => {
  const ip = req.socket.remoteAddress ?? '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
  bad(res, 403, 'Administration réservée à l’ordinateur du serveur');
});

function parseEmployee(body: unknown, exceptId?: string): store.EmployeeInput | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = String(b.name ?? '').trim();
  const phoneLast4 = String(b.phoneLast4 ?? '').trim();
  const email = String(b.email ?? '').trim();
  if (!name) return 'Nom requis';
  if (!/^\d{4}$/.test(phoneLast4)) return 'Le code doit avoir 4 chiffres';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Courriel invalide';
  const active = b.active !== false;
  if (active && store.codeTaken(phoneLast4, exceptId)) return 'Ce code est déjà utilisé par un autre employé actif';
  const schedule = b.schedule;
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  const valid =
    Array.isArray(schedule) &&
    schedule.length === 7 &&
    schedule.every(
      (d) =>
        d === null ||
        (typeof d === 'object' &&
          hhmm.test(d.start) &&
          hhmm.test(d.end) &&
          d.start < d.end &&
          Array.isArray(d.pauses) &&
          d.pauses.every((p: { at: unknown; minutes: unknown }) => typeof p.at === 'string' && hhmm.test(p.at) && Number(p.minutes) > 0 && Number(p.minutes) <= 120)),
    );
  if (!valid) return 'Horaire invalide';
  return { name, phoneLast4, email, role: String(b.role ?? '').trim(), schedule: schedule as WeekSchedule, active };
}

admin.get('/state', (req, res) => {
  const at = now();
  const weekOffset = Math.trunc(Number(req.query.week) || 0);
  const start = weekStartOf(at + weekOffset * 7 * 86_400_000);
  const viewNow = weekOffset === 0 ? at : Math.min(at, start + 7 * 86_400_000 - 1);
  const employees = store.listEmployees();
  const summaries = Object.fromEntries(employees.map((e) => [e.id, weekOf(e.id, e.schedule, viewNow).summary]));
  const s = settings();
  res.json({
    now: new Date(at).toISOString(),
    weekStart: dateKey(start),
    settings: s,
    mail: { enabled: mailEnabled, user: smtp.user },
    kioskUrls: kioskUrls(),
    employees,
    summaries,
    events: store.listEvents(new Date(start).toISOString(), new Date(start + 8 * 86_400_000).toISOString()),
    mails: store.listMails().map(({ token: _t, ...m }) => m),
    followUpLink: followUpLink(),
  });
});

admin.post(
  '/employees',
  wrap(async (req, res) => {
    const input = parseEmployee(req.body);
    if (typeof input === 'string') return bad(res, 400, input);
    const e = store.createEmployee(input);
    await runNotifier();
    res.json(e);
  }),
);

admin.put(
  '/employees/:id',
  wrap(async (req, res) => {
    const id = String(req.params.id);
    if (!store.getEmployee(id)) return bad(res, 404, 'Employé introuvable');
    const input = parseEmployee(req.body, id);
    if (typeof input === 'string') return bad(res, 400, input);
    store.updateEmployee(id, input);
    await runNotifier();
    res.json(store.getEmployee(id));
  }),
);

admin.delete('/employees/:id', (req, res) => {
  store.deleteEmployee(String(req.params.id));
  res.json({ ok: true });
});

/** Reference face taken by the admin with the computer's webcam: 128-number descriptor + small ID photo. */
admin.post('/employees/:id/face', (req, res) => {
  const id = String(req.params.id);
  if (!store.getEmployee(id)) return bad(res, 404, 'Employé introuvable');
  const d = req.body?.descriptor;
  const photo = req.body?.photo;
  if (!Array.isArray(d) || d.length !== 128 || !d.every((v: unknown) => typeof v === 'number' && Number.isFinite(v))) return bad(res, 400, 'Visage invalide');
  if (typeof photo !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo) || photo.length > 400_000) return bad(res, 400, 'Photo invalide');
  store.setFace(id, d as number[], photo);
  res.json({ ok: true });
});

admin.post('/employees/:id/approve', (req, res) => {
  store.approveEmployee(String(req.params.id));
  res.json({ ok: true });
});

admin.post('/employees/:id/reset-face', (req, res) => {
  store.setFace(String(req.params.id), null, null);
  res.json({ ok: true });
});

function parseEvent(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const at = new Date(String(b.at ?? ''));
  const kind = b.kind as PunchKind;
  if (Number.isNaN(at.getTime())) return 'Heure invalide';
  if (!KINDS.includes(kind)) return 'Type de pointage invalide';
  return { at: at.toISOString(), kind, note: String(b.note ?? '').trim().slice(0, 300) };
}

admin.post(
  '/events',
  wrap(async (req, res) => {
    const e = parseEvent(req.body);
    if (typeof e === 'string') return bad(res, 400, e);
    const employeeId = String(req.body?.employeeId ?? '');
    if (!store.getEmployee(employeeId)) return bad(res, 404, 'Employé introuvable');
    const event = store.insertEvent({ employeeId, at: e.at, kind: e.kind, identity: 'off', source: 'admin', note: e.note || undefined });
    await runNotifier();
    res.json(event);
  }),
);

admin.put(
  '/events/:id',
  wrap(async (req, res) => {
    const e = parseEvent(req.body);
    if (typeof e === 'string') return bad(res, 400, e);
    store.updateEvent(String(req.params.id), e);
    await runNotifier();
    res.json({ ok: true });
  }),
);

admin.delete('/events/:id', (req, res) => {
  store.deleteEvent(String(req.params.id));
  res.json({ ok: true });
});

admin.put(
  '/settings',
  wrap(async (req, res) => {
    const b = req.body ?? {};
    if (b.directorEmail !== undefined) {
      const v = String(b.directorEmail).trim();
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return bad(res, 400, 'Courriel du directeur invalide');
      store.setSetting('directorEmail', v);
    }
    if (b.photoCheck !== undefined) store.setSetting('photoCheck', !!b.photoCheck);
    if (b.digestHours !== undefined) {
      const h = Math.trunc(Number(b.digestHours));
      if (!(h >= 1 && h <= 24 * 14)) return bad(res, 400, 'Intervalle invalide');
      store.setSetting('digestHours', h);
    }
    await runNotifier();
    res.json(settings());
  }),
);

admin.post(
  '/digest',
  wrap(async (_req, res) => {
    if (!settings().directorEmail) return bad(res, 400, 'Ajoutez d’abord le courriel de l’administrateur');
    if (!(await sendDigest(now()))) return bad(res, 400, 'Aucun employé actif');
    res.json({ ok: true });
  }),
);

/** New access key: the follow-up and face links sent before stop working. */
admin.post('/renew-key', (_req, res) => {
  store.renewAccessKey();
  store.setFaceNotified([]);
  res.json({ followUpLink: followUpLink() });
});

admin.post(
  '/mails/:id/resend',
  wrap(async (req, res) => {
    const mail = store.mailById(String(req.params.id));
    if (!mail) return bad(res, 404, 'Courriel introuvable');
    store.setMailStatus(mail.id, 'pending', null);
    await sendPending(mail.id);
    res.json(store.mailById(mail.id));
  }),
);

app.use('/punch-api/admin', admin);

/* Kiosk page (built by `vite build --config vite.pointage.config.ts`). */
const PUBLIC_DIR = path.resolve(import.meta.dirname, '../../public');
app.use('/models', express.static(path.join(PUBLIC_DIR, 'models'), { maxAge: '7d', fallthrough: false }));
app.get(['/favicon.svg', '/pointage.webmanifest'], (req, res) => res.sendFile(path.join(PUBLIC_DIR, req.path)));
if (fs.existsSync(KIOSK_DIR)) {
  app.use(express.static(KIOSK_DIR, { index: 'pointage.html', maxAge: 0 }));
} else {
  app.get('/', (_req, res) => res.status(503).send('Borne non construite : lancez « npm run pointage ».'));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[pointage]', err);
  bad(res, 500, 'Erreur du serveur');
});

/* ---------- start ---------- */

/**
 * Self-signed certificate for localhost, the .local name and every network address seen so far.
 * Addresses of earlier Wi-Fi networks are kept, so going back to a known network needs no new certificate.
 */
async function certificate() {
  const file = path.join(store.DATA_DIR, 'punch-cert.json');
  let hosts = ['localhost', '127.0.0.1', LOCAL_NAME, ...lanAddresses()];
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as { key: string; cert: string; hosts: string[]; until: string };
    if (hosts.every((h) => saved.hosts.includes(h)) && Date.parse(saved.until) > Date.now() + 7 * 86_400_000) return saved;
    hosts = [...new Set([...hosts, ...saved.hosts])];
  } catch {
    /* none yet */
  }
  const until = new Date(Date.now() + 365 * 86_400_000);
  const pems = await generate([{ name: 'commonName', value: 'Pointage Pubco' }], {
    keySize: 2048,
    algorithm: 'sha256',
    notAfterDate: until,
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames: hosts.map((h) => (/^\d/.test(h) ? { type: 7, ip: h } : { type: 2, value: h })) },
    ],
  });
  const saved = { key: pems.private, cert: pems.cert, hosts, until: until.toISOString() };
  fs.writeFileSync(file, JSON.stringify(saved));
  return saved;
}

let cert = await certificate();
const server = https.createServer({ key: cert.key, cert: cert.cert }, app).listen(PORT, () => {
  console.log(`[pointage] Borne et API sur ${kioskUrls().join('  ')}`);
  console.log(mailEnabled ? `[pointage] Courriels envoyés depuis ${smtp.user}` : '[pointage] Courriels désactivés : ajoutez PUNCH_SMTP_USER et PUNCH_SMTP_PASSWORD dans .env.punch');
});
/**
 * Another Wi-Fi (new address): the certificate is re-made with it and swapped in without stopping the server,
 * so the iPad links keep working on any network. The links shown in Imago are always the current ones.
 */
let lastAddresses = lanAddresses().join(',');
setInterval(() => {
  const now = lanAddresses().join(',');
  if (now === lastAddresses) return;
  lastAddresses = now;
  void certificate()
    .then((c) => {
      if (c.cert !== cert.cert) server.setSecureContext({ key: c.key, cert: c.cert });
      cert = c;
      console.log(`[pointage] Nouveau réseau : borne sur ${kioskUrls().join('  ')}`);
    })
    .catch((e: unknown) => console.error('[pointage] Certificat non refait :', e));
}, 10_000);
setInterval(() => void runNotifier(), 30_000);
void runNotifier();
