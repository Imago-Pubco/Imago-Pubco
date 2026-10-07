/**
 * E-mail: SMTP sending (settings in .env), editable templates stored in the database, and the branded layout.
 * Templates are plain text with {{placeholders}}; the layout (dark header, red accent, button) is applied
 * around them, so people edit the words and never the HTML.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from './config.ts';
import * as db from './db.ts';
import { HttpError } from './ms.ts';

/* ---------- templates ---------- */

export interface MailTemplate {
  id: string;
  name: string;
  /** When it is sent, shown in the editor. */
  description: string;
  enabled: boolean;
  subject: string;
  /** Large title at the top of the message. */
  heading: string;
  /** Plain text: blank line = new paragraph, **bold**, lines starting with "- " are a list. */
  body: string;
  /** Empty = no button. */
  buttonLabel: string;
  buttonUrl: string;
  /** Placeholders available to this template. */
  placeholders: { key: string; label: string; sample: string }[];
  updatedAt?: string;
  updatedBy?: string;
}

const COMMON = [
  { key: 'nom', label: 'Nom complet du destinataire', sample: 'Marie Tremblay' },
  { key: 'identifiant', label: 'Identifiant de connexion', sample: 'mtremblay' },
  { key: 'portail', label: 'Adresse du portail', sample: 'https://hub.pubco.ca' },
];

export const DEFAULT_TEMPLATES: MailTemplate[] = [
  {
    id: 'welcome',
    name: 'Nouvel utilisateur — bienvenue',
    description: 'Envoyé quand un compte est créé (ou quand un administrateur renvoie le courriel de bienvenue).',
    enabled: true,
    subject: 'Bienvenue dans Pubco Hub 2.0 – Imago',
    heading: 'Bienvenue, {{nom}}',
    body:
      'Votre compte **Pubco Hub 2.0 – Imago** est prêt. Ce portail regroupe les outils de Pubco et vous donne accès aux modules qui vous concernent.\n\n' +
      '**Votre identifiant :** {{identifiant}}\n**Votre accès :** {{groupes}}\n\n' +
      'Pour commencer, choisissez votre mot de passe avec le bouton ci-dessous. Ce lien est valide {{expiration}}.\n\n' +
      'Le projet est en développement : si quelque chose ne fonctionne pas ou si vous avez une idée pour l’améliorer, dites-le-nous.',
    buttonLabel: 'Choisir mon mot de passe',
    buttonUrl: '{{lien}}',
    placeholders: [
      ...COMMON,
      { key: 'courriel', label: 'Courriel du destinataire', sample: 'marie.tremblay@pubco.ca' },
      { key: 'groupes', label: 'Groupes d’accès attribués', sample: 'Comptabilité, Lecture seule' },
      { key: 'lien', label: 'Lien pour choisir le mot de passe', sample: 'https://hub.pubco.ca/reset-password?token=…' },
      { key: 'expiration', label: 'Durée de validité du lien', sample: '3 jours' },
    ],
  },
  {
    id: 'password_reset',
    name: 'Mot de passe oublié',
    description: 'Envoyé quand une personne demande la réinitialisation de son mot de passe depuis la page de connexion.',
    enabled: true,
    subject: 'Réinitialisation de votre mot de passe – Pubco Hub',
    heading: 'Réinitialiser votre mot de passe',
    body:
      'Bonjour {{nom}},\n\n' +
      'Nous avons reçu une demande de réinitialisation du mot de passe de votre compte **{{identifiant}}**. Utilisez le bouton ci-dessous pour en choisir un nouveau. Ce lien est valide {{expiration}} et ne peut servir qu’une fois.\n\n' +
      'Si vous n’êtes pas à l’origine de cette demande, ignorez ce courriel : votre mot de passe actuel reste en vigueur.',
    buttonLabel: 'Choisir un nouveau mot de passe',
    buttonUrl: '{{lien}}',
    placeholders: [
      ...COMMON,
      { key: 'lien', label: 'Lien de réinitialisation', sample: 'https://hub.pubco.ca/reset-password?token=…' },
      { key: 'expiration', label: 'Durée de validité du lien', sample: '1 heure' },
    ],
  },
  {
    id: 'password_changed',
    name: 'Mot de passe modifié',
    description: 'Confirmation envoyée après un changement de mot de passe réussi.',
    enabled: true,
    subject: 'Votre mot de passe a été modifié – Pubco Hub',
    heading: 'Mot de passe modifié',
    body:
      'Bonjour {{nom}},\n\n' +
      'Le mot de passe de votre compte **{{identifiant}}** vient d’être modifié.\n\n' +
      'Si vous n’avez pas fait ce changement, avertissez immédiatement le support TI.',
    buttonLabel: 'Ouvrir le portail',
    buttonUrl: '{{portail}}',
    placeholders: COMMON,
  },
];

/** Inserts the default templates that are missing (existing, edited ones are never touched). */
export async function ensureMailTemplates() {
  for (const t of DEFAULT_TEMPLATES) {
    if (!(await db.getDoc('mail.templates', t.id))) await db.insertDoc('mail.templates', t);
  }
}

export const defaultTemplate = (id: string) => DEFAULT_TEMPLATES.find((t) => t.id === id);

export async function getTemplate(id: string): Promise<MailTemplate> {
  const stored = await db.getDoc<MailTemplate>('mail.templates', id);
  const def = defaultTemplate(id);
  if (!stored && !def) throw new HttpError(404, 'Unknown template');
  // The placeholder list comes from the code (it is what the program can fill in), the words from the database.
  return { ...(def as MailTemplate), ...(stored ?? {}), placeholders: def?.placeholders ?? stored!.placeholders };
}

/* ---------- rendering ---------- */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (text: string, vars: Record<string, string>) => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => vars[k] ?? '');

/** Text with **bold**, bullet lines and paragraphs to inline-styled HTML (placeholders already filled). */
function bodyToHtml(text: string): string {
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => /^\s*-\s+/.test(l))) {
        return `<ul style="margin:0 0 16px 0;padding-left:22px;">${lines.map((l) => `<li style="margin-bottom:4px;">${inline(l.replace(/^\s*-\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p style="margin:0 0 16px 0;">${inline(block)}</p>`;
    })
    .join('');
}

/** The branded message: dark header with the Pubco wordmark, red accent, content card, optional button. */
export function renderLayout(opts: { heading: string; bodyHtml: string; buttonLabel?: string; buttonUrl?: string; footer?: string }): string {
  const btn =
    opts.buttonLabel && opts.buttonUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px 0;"><tr><td style="background-color:#da291c;border-radius:6px;"><a href="${esc(opts.buttonUrl)}" style="display:inline-block;padding:13px 26px;font-family:Calibri,Arial,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">${esc(opts.buttonLabel)}</a></td></tr></table>` +
        `<p style="margin:0 0 4px 0;font-size:12px;line-height:18px;color:#777777;">Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br><a href="${esc(opts.buttonUrl)}" style="color:#777777;word-break:break-all;">${esc(opts.buttonUrl)}</a></p>`
      : '';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background-color:#f1f1f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f1f2;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;font-family:Calibri,Arial,sans-serif;">
<tr><td style="background-color:#0a0a0a;padding:26px 32px;border-radius:8px 8px 0 0;">
<span style="font-family:Calibri,Arial,sans-serif;font-size:24px;font-weight:bold;letter-spacing:6px;color:#f1f1f1;">PUBCO</span><br>
<span style="font-family:Calibri,Arial,sans-serif;font-size:12px;letter-spacing:2px;color:#9a9a9a;">IMAGO · HUB 2.0</span>
</td></tr>
<tr><td style="background-color:#da291c;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="background-color:#ffffff;padding:32px 32px 24px 32px;font-family:Calibri,Arial,sans-serif;font-size:16px;line-height:24px;color:#222222;">
<h1 style="margin:0 0 20px 0;font-size:26px;line-height:32px;font-weight:bold;color:#111111;">${esc(opts.heading)}</h1>
${opts.bodyHtml}${btn}
</td></tr>
<tr><td style="background-color:#ffffff;padding:0 32px;"><div style="border-top:1px solid #e4e4e6;"></div></td></tr>
<tr><td style="background-color:#ffffff;padding:16px 32px 24px 32px;border-radius:0 0 8px 8px;font-family:Calibri,Arial,sans-serif;font-size:12px;line-height:18px;color:#888888;">${esc(opts.footer ?? 'Ceci est un message automatique de Pubco Hub 2.0 – Imago. Merci de ne pas y répondre.')}</td></tr>
</table></td></tr></table></body></html>`;
}

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

export function renderTemplate(t: Pick<MailTemplate, 'subject' | 'heading' | 'body' | 'buttonLabel' | 'buttonUrl'>, vars: Record<string, string>): Rendered {
  const subject = fill(t.subject, vars);
  const heading = fill(t.heading, vars);
  const body = fill(t.body, vars);
  const buttonLabel = fill(t.buttonLabel, vars);
  const buttonUrl = fill(t.buttonUrl, vars);
  return {
    subject,
    html: renderLayout({ heading, bodyHtml: bodyToHtml(body), buttonLabel, buttonUrl }),
    text: `${heading}\n\n${body.replace(/\*\*/g, '')}${buttonLabel && buttonUrl ? `\n\n${buttonLabel} : ${buttonUrl}` : ''}`,
  };
}

/** Sample values, for the preview and the test message. */
export function sampleVars(t: MailTemplate): Record<string, string> {
  return Object.fromEntries(t.placeholders.map((p) => [p.key, p.sample]));
}

/* ---------- sending ---------- */

let transport: Transporter | undefined;

function transporter() {
  const s = config.smtp;
  transport ??= nodemailer.createTransport({
    host: s.host,
    port: s.port,
    // true = TLS from the start (usually port 465); false = STARTTLS when offered (usually port 587).
    secure: s.secure,
    auth: s.user ? { user: s.user, pass: s.password } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return transport;
}

export function assertMail() {
  if (!config.smtp.enabled) throw new HttpError(503, 'E-mail is not configured on the server (SMTP_* in .env).');
}

export async function sendMail(to: string, r: Rendered): Promise<void> {
  assertMail();
  try {
    await transporter().sendMail({
      from: config.smtp.fromName ? { name: config.smtp.fromName, address: config.smtp.from } : config.smtp.from,
      to,
      subject: r.subject,
      html: r.html,
      text: r.text,
    });
  } catch (e) {
    // Surface the SMTP server's own message (authentication refused, relay denied, ...).
    throw new HttpError(502, `SMTP: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Renders a stored template and sends it. A disabled template is skipped (returns false). */
export async function sendTemplate(id: string, to: string, vars: Record<string, string>): Promise<boolean> {
  const t = await getTemplate(id);
  if (!t.enabled) return false;
  await sendMail(to, renderTemplate(t, vars));
  return true;
}

/** Checks the SMTP connection and login without sending anything. */
export async function verifySmtp(): Promise<void> {
  assertMail();
  try {
    await transporter().verify();
  } catch (e) {
    throw new HttpError(502, `SMTP: ${e instanceof Error ? e.message : String(e)}`);
  }
}
