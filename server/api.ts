/**
 * REST API. `/api/c/:collection` mirrors the front end's Collection<T> contract; each
 * collection has read/write permission rules enforced here, on the server.
 */
import { randomBytes } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { effectivePermissions } from '../src/auth/permissions.ts';
import type { Group, User } from '../src/data/types.ts';
import type { Invoice } from '../src/modules/accounting/types.ts';
import {
  burnPasswordCheck,
  clearLoginFailures,
  ipBlocked,
  recordIpFailure,
  restoreParentSession,
  createSession,
  destroySession,
  destroyUserSessions,
  hashPassword,
  loginBlocked,
  publicUser,
  recordLoginFailure,
  requireAuth,
  verifyPassword,
  type AuthInfo,
} from './auth.ts';
import * as bc from './bc.ts';
import * as o365 from './o365.ts';
import type { O365Tenant } from '../src/modules/o365/types.ts';
import { config } from './config.ts';
import * as db from './db.ts';
import { broadcast, eventsHandler } from './events.ts';
import { syncMailbox, testMailbox } from './mailbox.ts';
import * as pipeline from './pipeline.ts';
import { matchInvoiceRecord, runAutomation } from './automation.ts';
import { assertMail, defaultTemplate, getTemplate, renderTemplate, sampleVars, sendMail, sendTemplate, verifySmtp, type MailTemplate } from './mail.ts';
import { consumeToken, createToken, deleteUserTokens, humanDuration, peekToken } from './tokens.ts';
import { HttpError } from './ms.ts';

const uid = (prefix: string) => prefix + randomBytes(8).toString('hex');
const now = () => new Date().toISOString();

type Check = (a: AuthInfo) => boolean;
const any = (...perms: string[]): Check => (a) => a.canAny(...perms);
const authed: Check = () => true;

interface Rule {
  read: Check;
  write: Check;
}

/** Collections the API serves. Anything else is a 404. */
const RULES: Record<string, Rule> = {
  groups: { read: authed, write: any('admin.groups.manage') },
  'app.settings': { read: authed, write: any('admin.access', 'it.settings') },

  'acc.invoices': {
    read: any('accounting.access'),
    write: any('accounting.invoices.import', 'accounting.invoices.edit', 'accounting.invoices.validate', 'accounting.invoices.approve', 'accounting.invoices.post'),
  },
  'acc.pos': { read: any('accounting.access'), write: any('accounting.po.process') },
  /** Local copy of Business Central data, written only by the server's sync. */
  'bc.salesOrders': { read: any('accounting.access'), write: () => false },
  'bc.invoices': { read: any('accounting.access'), write: () => false },
  'acc.settings': { read: any('accounting.access'), write: any('accounting.settings') },
  'acc.mailbox': { read: any('accounting.access'), write: any('accounting.inbox.view', 'accounting.invoices.import') },

  'cmp.frameworks': { read: any('compliance.access'), write: any('compliance.frameworks') },
  'cmp.requirements': { read: any('compliance.access'), write: any('compliance.edit', 'compliance.frameworks') },
  'cmp.audits': { read: any('compliance.access'), write: any('compliance.audits') },
  'cmp.documents': { read: any('compliance.access'), write: any('compliance.documents') },

  'est.estimates': { read: any('estimating.access'), write: any('estimating.edit', 'estimating.approve') },
  'est.materials': { read: any('estimating.access'), write: any('estimating.catalog') },
  'est.settings': { read: any('estimating.access'), write: any('estimating.settings') },

  'ship.labels': { read: any('shipping.access'), write: any('shipping.labels.create', 'shipping.labels.print', 'shipping.labels.void') },
  'ship.addresses': { read: any('shipping.access'), write: any('shipping.addresses.manage', 'shipping.labels.create') },
  'ship.origins': { read: any('shipping.access'), write: any('shipping.settings') },

  'o365.tenants': { read: any('o365.access'), write: any('o365.tenants.manage') },

  'mail.templates': { read: any('admin.mail'), write: any('admin.mail') },
};

/** Fields the generic API never accepts from the browser on users. */
const PROTECTED_USER_FIELDS = ['passwordHash', 'salt', 'lastLoginAt', 'createdAt'] as const;

/** Longest-standing rule of the portal: passwords are at least this long. */
const MIN_PASSWORD = 12;

/** Fields only the server may write, per collection (the generic API drops them from browser requests). */
const SERVER_OWNED: Record<string, string[]> = {
  'acc.pos': ['mailId', 'attIndex', 'fileId', 'direction', 'stage', 'match', 'bcOrderId', 'bcOrderNo', 'bcInvoiceId', 'bcInvoiceNo', 'approvedBy', 'approvedAt', 'overrideNote', 'automated', 'history', 'partyNo', 'createdAt'],
  'acc.invoices': ['approvedBy', 'approvedAt', 'overrideNote', 'bcInvoiceNo', 'postedAt'],
};
/** Ids the system uses for itself (the automation signs its actions as "system"). */
const RESERVED_IDS = new Set(['system']);

/** The permissions a set of groups would give. */
async function groupPerms(groupIds: unknown): Promise<Set<string>> {
  const ids = Array.isArray(groupIds) ? groupIds.map(String) : [];
  return effectivePermissions({ groupIds: ids } as User, await db.listDocs<Group>('groups'));
}

/** Everything one person has: their groups plus the rights given to them directly. */
async function userPerms(u: User): Promise<Set<string>> {
  return effectivePermissions(u, await db.listDocs<Group>('groups'));
}

/** Permission keys: letters, digits, dots and the wildcard. */
const validPerms = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 300 && v.every((p) => typeof p === 'string' && /^[a-z0-9_.*-]{1,100}$/i.test(p));

/** Nobody can hand out, or take over, more than they hold themselves: "manage users" is not "be an administrator". */
const canGrant = (a: AuthInfo, perms: Iterable<string>) => [...perms].every((p) => a.can(p));

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

function forbid(res: Response) {
  return res.status(403).json({ error: 'forbidden' });
}

async function audit(userId: string, action: string, detail = '', ip = '') {
  await db.insertDoc('audit', { id: uid('a_'), at: now(), userId, action, detail, ip });
  broadcast('audit');
}

export function apiRouter() {
  const r = express.Router();
  r.use(express.json({ limit: '5mb' }));

  // CSRF protection: state-changing requests must carry a custom header, which a
  // cross-site form or image cannot send (and CORS is not enabled).
  r.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.get('X-Imago') !== '1') {
      return res.status(403).json({ error: 'missing X-Imago header' });
    }
    next();
  });

  r.get('/health', wrap(async (_req, res) => {
    await db.pool.query('select 1');
    res.json({ ok: true });
  }));

  /* ---------- auth ---------- */

  r.post('/auth/login', wrap(async (req, res) => {
    const username = String(req.body?.username ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const key = `${req.ip}|${username}`;
    if (loginBlocked(key) || ipBlocked(req.ip ?? '')) return res.status(429).json({ error: 'too_many_attempts' });
    const user = (await db.listDocs<User>('users')).find((u) => u.username.toLowerCase() === username);
    let valid = false;
    if (user) valid = await verifyPassword(password, user.passwordHash);
    else await burnPasswordCheck(password); // same cost as a real check, so response time does not reveal which usernames exist
    if (!user || !valid) {
      recordLoginFailure(key);
      recordIpFailure(req.ip ?? '');
      await audit(user?.id ?? '', 'auth.login.failed', username, req.ip ?? '');
      return res.status(401).json({ error: 'invalid' });
    }
    if (!user.active) return res.status(403).json({ error: 'disabled' });
    clearLoginFailures(key);
    await createSession(res, req, user.id);
    await db.updateDoc<User>('users', user.id, { lastLoginAt: now() });
    broadcast('users');
    await audit(user.id, 'auth.login', user.username, req.ip ?? '');
    res.json({ user: publicUser(user) });
  }));

  r.post('/auth/logout', wrap(async (req, res) => {
    if (req.auth) await audit(req.auth.user.id, 'auth.logout', req.auth.user.username, req.ip ?? '');
    await destroySession(res, req.auth?.sessionId);
    res.json({ ok: true });
  }));

  /* ---------- password: forgotten / first choice (public) ---------- */

  /** Address used in e-mail links. The Host header is attacker-controlled: in production only APP_URL is trusted. */
  const baseUrl = (req: Request) => {
    if (config.appUrl) return config.appUrl;
    if (process.env.NODE_ENV === 'production') throw new HttpError(503, 'APP_URL is not set in .env: e-mail links cannot be built safely.');
    return `${req.protocol}://${req.get('host')}`;
  };
  const FORGOT_TTL = 3600_000;
  const WELCOME_TTL = 72 * 3600_000;
  const forgotHits = new Map<string, number[]>();
  const tooManyForgot = (key: string) => {
    const hits = (forgotHits.get(key) ?? []).filter((t) => Date.now() - t < 3600_000);
    hits.push(Date.now());
    forgotHits.set(key, hits);
    return hits.length > 5;
  };

  /** What the login page may offer: "forgot password" only exists when e-mail is configured. */
  r.get('/auth/options', (_req, res) => res.json({ forgotPassword: config.smtp.enabled }));

  r.post('/auth/forgot', wrap(async (req, res) => {
    const id = String(req.body?.identifier ?? '').trim().toLowerCase();
    // The answer never reveals whether the account exists.
    res.json({ ok: true });
    if (!id || !config.smtp.enabled || tooManyForgot(`ip|${req.ip}`) || tooManyForgot(`id|${id}`)) return;
    try {
      const user = (await db.listDocs<User>('users')).find((u) => u.active && (u.username.toLowerCase() === id || (u.email && u.email.toLowerCase() === id)));
      if (!user?.email) return;
      const token = await createToken(user.id, 'reset_password', FORGOT_TTL);
      await sendTemplate('password_reset', user.email, {
        nom: user.displayName,
        identifiant: user.username,
        portail: baseUrl(req),
        lien: `${baseUrl(req)}/reset-password?token=${token}`,
        expiration: humanDuration(FORGOT_TTL),
      });
      await audit(user.id, 'auth.password.forgot', user.username, req.ip ?? '');
    } catch (e) {
      console.error('[mail] password reset e-mail failed:', e instanceof Error ? e.message : e);
    }
  }));

  r.get('/auth/reset/check', wrap(async (req, res) => {
    const userId = await peekToken(String(req.query.token ?? ''));
    const user = userId ? await db.getDoc<User>('users', userId) : undefined;
    if (!user?.active) return res.status(400).json({ error: 'invalid_or_expired' });
    res.json({ ok: true, username: user.username, name: user.displayName });
  }));

  r.post('/auth/reset', wrap(async (req, res) => {
    const password = String(req.body?.password ?? '');
    if (password.length < MIN_PASSWORD) return res.status(400).json({ error: `password must be at least ${MIN_PASSWORD} characters` });
    const userId = await consumeToken(String(req.body?.token ?? ''));
    const user = userId ? await db.getDoc<User>('users', userId) : undefined;
    if (!user?.active) return res.status(400).json({ error: 'invalid_or_expired' });
    await db.updateDoc<User>('users', user.id, { passwordHash: await hashPassword(password), salt: '' });
    await destroyUserSessions(user.id);
    await audit(user.id, 'auth.password.reset', user.username, req.ip ?? '');
    broadcast('users');
    res.json({ ok: true, username: user.username });
    if (config.smtp.enabled && user.email) {
      sendTemplate('password_changed', user.email, { nom: user.displayName, identifiant: user.username, portail: baseUrl(req) }).catch((e) =>
        console.error('[mail] confirmation e-mail failed:', e instanceof Error ? e.message : e),
      );
    }
  }));

  r.get('/auth/me', (req, res) => {
    if (!req.auth) return res.status(401).json({ error: 'unauthenticated' });
    const by = req.auth.impersonatorId;
    res.json({ user: publicUser(req.auth.user), impersonatedBy: by ? { id: by } : undefined });
  });

  /* Everything below needs a signed-in user. */
  r.use(requireAuth);
  const me = (req: Request) => req.auth!;

  /* ---------- "view as": an administrator sees the portal exactly as another user does (read-only) ---------- */

  const IMPERSONATION_MINUTES = 30;

  /** Back to the administrator's own session. */
  r.post('/auth/impersonate/stop', wrap(async (req, res) => {
    const a = me(req);
    if (!a.impersonatorId) return res.status(400).json({ error: 'not viewing as another user' });
    await db.pool.query('delete from sessions where id = $1', [a.sessionId]);
    await restoreParentSession(res, a.parentSid, a.impersonatorId);
    await audit(a.impersonatorId, 'admin.impersonate.stop', a.user.username, req.ip ?? '');
    res.json({ ok: true });
  }));

  // While viewing as someone else nothing can be changed: no actions are ever taken in another person's name.
  r.use((req, res, next) => {
    if (req.auth?.impersonatorId && req.method !== 'GET' && req.method !== 'HEAD') {
      return res.status(403).json({ error: 'read_only_impersonation' });
    }
    next();
  });

  // Automatic audit trail: every state-changing request by a signed-in user is logged
  // (successes as api.<METHOD>, refused attempts as api.denied). Bodies are never stored.
  r.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || req.path === '/c/audit') return next();
    const userId = req.auth!.user.id;
    res.on('finish', () => {
      const ok = res.statusCode < 400;
      if (!ok && res.statusCode !== 403) return;
      audit(userId, ok ? `api.${req.method.toLowerCase()}` : 'api.denied', `${req.method} ${req.path} ${res.statusCode}`, req.ip ?? '').catch((e) =>
        console.error('[audit]', e),
      );
    });
    next();
  });

  r.get('/events', eventsHandler);

  r.get('/config', (_req, res) => {
    res.json({
      integrations: {
        businessCentral: config.bc.enabled ? { environment: config.bc.environment, postMode: config.bc.postMode } : null,
        mailbox: config.graph.enabled ? { address: config.graph.mailbox } : null,
        extraction: config.ai.enabled ? { model: config.ai.model } : null,
        o365: config.o365.enabled ? { clientId: config.o365.clientId } : null,
        smtp: config.smtp.enabled ? { from: config.smtp.from, host: config.smtp.host } : null,
      },
    });
  });

  r.post('/admin/impersonate/:id', wrap(async (req, res) => {
    const a = me(req);
    if (!a.can('admin.impersonate')) return forbid(res);
    const target = await db.getDoc<User>('users', String(req.params.id));
    if (!target) return res.status(404).json({ error: 'not_found' });
    if (target.id === a.user.id) return res.status(400).json({ error: 'That is you.' });
    if (!target.active) return res.status(400).json({ error: 'This account is disabled.' });
    // Seeing someone with more rights than yours would be a way around the rule that you cannot give yourself more.
    if (!canGrant(a, await userPerms(target))) return res.status(403).json({ error: 'This account has more permissions than you.' });
    await createSession(res, req, target.id, { ttlSeconds: IMPERSONATION_MINUTES * 60, impersonatorId: a.user.id, parentSid: a.sessionId });
    await audit(a.user.id, 'admin.impersonate.start', `${target.username} (read-only, ${IMPERSONATION_MINUTES} min)`, req.ip ?? '');
    res.json({ ok: true });
  }));

  /* ---------- users (hashes never leave the server) ---------- */

  /** A person's directly-granted rights are shown to them and to those who manage users or groups, not to everyone. */
  const userView = (u: User, a: AuthInfo) =>
    u.id === a.user.id || a.canAny('admin.groups.manage', 'admin.users.manage') ? publicUser(u) : { ...publicUser(u), permissions: undefined };

  r.get('/c/users', wrap(async (req, res) => {
    res.json((await db.listDocs<User>('users')).map((u) => userView(u, me(req))));
  }));
  r.get('/c/users/:id', wrap(async (req, res) => {
    const u = await db.getDoc<User>('users', String(req.params.id));
    if (!u) return res.status(404).json({ error: 'not_found' });
    res.json(userView(u, me(req)));
  }));

  r.post('/c/users', wrap(async (req, res) => {
    if (!me(req).can('admin.users.manage')) return forbid(res);
    const body = { ...(req.body ?? {}) } as Partial<User> & { password?: string };
    const password = String(body.password ?? '');
    const username = String(body.username ?? '').trim().toLowerCase();
    if (!username) return res.status(400).json({ error: 'username required' });
    if (RESERVED_IDS.has(String(body.id ?? '').toLowerCase()) || RESERVED_IDS.has(username)) return res.status(400).json({ error: 'reserved name' });
    if (!canGrant(me(req), await groupPerms(body.groupIds))) return res.status(403).json({ error: 'You cannot give permissions you do not hold yourself.' });
    if (body.permissions !== undefined) {
      if (!validPerms(body.permissions)) return res.status(400).json({ error: 'invalid permissions' });
      if (body.permissions.length && !me(req).can('admin.groups.manage')) return forbid(res);
      if (!canGrant(me(req), body.permissions)) return res.status(403).json({ error: 'You cannot give permissions you do not hold yourself.' });
      body.permissions = [...new Set(body.permissions)].sort();
    }
    if (password.length < MIN_PASSWORD) return res.status(400).json({ error: `password must be at least ${MIN_PASSWORD} characters` });
    if ((await db.listDocs<User>('users')).some((u) => u.username.toLowerCase() === username)) {
      return res.status(409).json({ error: 'username exists' });
    }
    for (const f of PROTECTED_USER_FIELDS) delete body[f];
    delete body.password;
    const user = {
      ...body,
      id: body.id ?? uid('u_'),
      username,
      groupIds: body.groupIds ?? [],
      active: body.active ?? true,
      passwordHash: await hashPassword(password),
      salt: '',
      createdAt: now(),
    } as User;
    await db.insertDoc('users', user as unknown as db.Doc);
    broadcast('users');
    res.status(201).json(publicUser(user));
  }));

  r.patch('/c/users/:id', wrap(async (req, res) => {
    const id = String(req.params.id);
    const a = me(req);
    const body = { ...(req.body ?? {}) } as Partial<User> & { password?: string };
    const isAdmin = a.can('admin.users.manage');
    if (!isAdmin) {
      // Users may only change their own preferences.
      const keys = Object.keys(body).filter((k) => k !== 'id');
      if (id !== a.user.id || keys.some((k) => k !== 'prefs')) return forbid(res);
    }
    for (const f of PROTECTED_USER_FIELDS) delete body[f];
    delete (body as { id?: string }).id;
    if (isAdmin) {
      // You cannot change someone who holds more than you do (password reset = account takeover), nor give anyone more than you hold.
      const target = await db.getDoc<User>('users', id);
      if (!target) return res.status(404).json({ error: 'not_found' });
      if (id !== a.user.id && !canGrant(a, await userPerms(target))) return res.status(403).json({ error: 'This account has more permissions than you.' });
      if (body.groupIds !== undefined && !canGrant(a, await groupPerms(body.groupIds))) return res.status(403).json({ error: 'You cannot give permissions you do not hold yourself.' });
    }
    const password = body.password;
    delete body.password;
    if (body.username) {
      const username = String(body.username).trim().toLowerCase();
      if ((await db.listDocs<User>('users')).some((u) => u.username.toLowerCase() === username && u.id !== id)) {
        return res.status(409).json({ error: 'username exists' });
      }
      body.username = username;
    }
    let rightsDiff = '';
    if (body.permissions !== undefined) {
      // Giving rights directly is rights management: it needs the groups-management permission, and the same grant rule as groups.
      if (!a.can('admin.groups.manage')) return forbid(res);
      if (!validPerms(body.permissions)) return res.status(400).json({ error: 'invalid permissions' });
      if (!canGrant(a, body.permissions)) return res.status(403).json({ error: 'You cannot give permissions you do not hold yourself.' });
      body.permissions = [...new Set(body.permissions)].sort();
      const before = new Set((await db.getDoc<User>('users', id))?.permissions ?? []);
      const after = new Set(body.permissions);
      rightsDiff = [...[...after].filter((p) => !before.has(p)).map((p) => '+' + p), ...[...before].filter((p) => !after.has(p)).map((p) => '-' + p)].join(' ');
    }
    const patch: Partial<User> = { ...body };
    if (password !== undefined && password !== '') {
      if (password.length < MIN_PASSWORD) return res.status(400).json({ error: `password must be at least ${MIN_PASSWORD} characters` });
      patch.passwordHash = await hashPassword(password);
      patch.salt = '';
    }
    const updated = await db.updateDoc<User>('users', id, patch);
    if (!updated) return res.status(404).json({ error: 'not_found' });
    if (rightsDiff) await audit(a.user.id, 'admin.user.rights', `${updated.username}: ${rightsDiff}`, req.ip ?? '');
    // A password reset or deactivation signs the user out everywhere else.
    if (patch.passwordHash || updated.active === false) await destroyUserSessions(id, id === a.user.id ? a.sessionId : undefined);
    broadcast('users');
    res.json(publicUser(updated));
  }));

  r.delete('/c/users/:id', wrap(async (req, res) => {
    const id = String(req.params.id);
    if (!me(req).can('admin.users.manage')) return forbid(res);
    if (id === me(req).user.id) return res.status(400).json({ error: 'cannot delete yourself' });
    const target = await db.getDoc<User>('users', id);
    if (target && !canGrant(me(req), await userPerms(target))) return res.status(403).json({ error: 'This account has more permissions than you.' });
    // Never delete the last super administrator: nobody could manage the portal afterwards.
    if (target && (await userPerms(target)).has('*')) {
      const others = (await db.listDocs<User>('users')).filter((u) => u.id !== id && u.active);
      let another = false;
      for (const u of others) if ((await userPerms(u)).has('*')) another = true;
      if (!another) return res.status(400).json({ error: 'This is the last administrator account and cannot be deleted.' });
    }
    await db.removeDoc('users', id);
    await destroyUserSessions(id);
    await deleteUserTokens(id);
    broadcast('users');
    res.status(204).end();
  }));

  /* ---------- e-mail: status, templates, test, welcome message ---------- */

  r.get('/mail/status', wrap(async (req, res) => {
    if (!me(req).canAny('admin.mail', 'admin.users.manage')) return forbid(res);
    const s = config.smtp;
    res.json({ enabled: s.enabled, host: s.host, port: s.port, secure: s.secure, user: s.user, from: s.from, fromName: s.fromName, appUrl: config.appUrl });
  }));

  /** Checks the SMTP connection and login, without sending anything. */
  r.post('/mail/verify', wrap(async (req, res) => {
    if (!me(req).can('admin.mail')) return forbid(res);
    await verifySmtp();
    res.json({ ok: true });
  }));

  /** Renders a template (possibly an unsaved draft from the editor) with sample values. */
  r.post('/mail/preview', wrap(async (req, res) => {
    if (!me(req).can('admin.mail')) return forbid(res);
    const base = await getTemplate(String(req.body?.id ?? ''));
    const draft = { ...base, ...(req.body?.draft ?? {}) } as MailTemplate;
    res.json(renderTemplate(draft, sampleVars(base)));
  }));

  /** Sends the template, filled with sample values, to an address (default: the signed-in person's). */
  r.post('/mail/test', wrap(async (req, res) => {
    const a = me(req);
    if (!a.can('admin.mail')) return forbid(res);
    assertMail();
    const base = await getTemplate(String(req.body?.id ?? ''));
    const draft = { ...base, ...(req.body?.draft ?? {}) } as MailTemplate;
    const to = String(req.body?.to ?? a.user.email ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: 'A valid e-mail address is required.' });
    const rendered = renderTemplate(draft, sampleVars(base));
    await sendMail(to, { ...rendered, subject: `[TEST] ${rendered.subject}` });
    await audit(a.user.id, 'mail.test', `${base.id} -> ${to}`, req.ip ?? '');
    res.json({ ok: true, to });
  }));

  r.post('/mail/templates/:id/reset', wrap(async (req, res) => {
    if (!me(req).can('admin.mail')) return forbid(res);
    const def = defaultTemplate(String(req.params.id));
    if (!def) return res.status(404).json({ error: 'not_found' });
    const doc = { ...def, updatedAt: now(), updatedBy: me(req).user.id };
    await db.replaceAll('mail.templates', [...(await db.listDocs<MailTemplate>('mail.templates')).filter((t) => t.id !== def.id), doc]);
    await audit(me(req).user.id, 'mail.template.reset', def.id, req.ip ?? '');
    broadcast('mail.templates');
    res.json(doc);
  }));

  /** Sends (or re-sends) the welcome message: the person's identifier and a link to choose a password. */
  r.post('/users/:id/welcome-email', wrap(async (req, res) => {
    const a = me(req);
    if (!a.can('admin.users.manage')) return forbid(res);
    assertMail();
    const user = await db.getDoc<User>('users', String(req.params.id));
    if (!user) return res.status(404).json({ error: 'not_found' });
    if (!user.email) return res.status(400).json({ error: 'This user has no e-mail address.' });
    const groupNames = (await db.listDocs<Group>('groups')).filter((g) => user.groupIds.includes(g.id)).map((g) => g.name);
    const token = await createToken(user.id, 'set_password', WELCOME_TTL);
    const sent = await sendTemplate('welcome', user.email, {
      nom: user.displayName,
      identifiant: user.username,
      courriel: user.email,
      groupes: groupNames.join(', ') || '—',
      portail: baseUrl(req),
      lien: `${baseUrl(req)}/reset-password?token=${token}`,
      expiration: humanDuration(WELCOME_TTL),
    });
    if (!sent) return res.status(409).json({ error: 'The welcome template is disabled (Administration → Courriels).' });
    await audit(a.user.id, 'mail.welcome', `${user.username} <${user.email}>`, req.ip ?? '');
    res.json({ ok: true, to: user.email });
  }));

  /* ---------- audit log (append-only) ---------- */

  r.get('/c/audit', wrap(async (req, res) => {
    const rows = await db.listDocs<{ id: string; userId: string }>('audit');
    res.json(me(req).can('admin.audit.view') ? rows : rows.filter((x) => x.userId === me(req).user.id));
  }));
  r.post('/c/audit', wrap(async (req, res) => {
    const entry = {
      id: uid('a_'),
      at: now(),
      userId: me(req).user.id,
      // Entries sent by the browser are labelled: only the server's own entries (api.*, auth.*, automation) prove what happened.
      action: String(req.body?.action ?? '').replace(/[^a-z0-9_.:-]/gi, '_').slice(0, 100),
      detail: String(req.body?.detail ?? '').slice(0, 2000),
      ip: req.ip ?? '',
      via: 'ui',
    };
    await db.insertDoc('audit', entry);
    broadcast('audit');
    res.status(201).json(entry);
  }));

  /* ---------- groups: system groups cannot be deleted ---------- */

  r.post('/c/groups', wrap(async (req, res) => {
    const a = me(req);
    if (!a.can('admin.groups.manage')) return forbid(res);
    const body = { ...(req.body ?? {}) } as Partial<Group>;
    if (!validPerms(body.permissions ?? [])) return res.status(400).json({ error: 'invalid permissions' });
    if (!canGrant(a, body.permissions ?? [])) return res.status(403).json({ error: 'You cannot give permissions you do not hold yourself.' });
    delete body.system;
    const doc = { ...body, id: body.id ?? uid('g_'), permissions: body.permissions ?? [] } as unknown as db.Doc;
    try {
      await db.insertDoc('groups', doc);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') return res.status(409).json({ error: 'duplicate id' });
      throw e;
    }
    broadcast('groups');
    res.status(201).json(doc);
  }));

  r.patch('/c/groups/:id', wrap(async (req, res) => {
    const a = me(req);
    if (!a.can('admin.groups.manage')) return forbid(res);
    const g = await db.getDoc<Group>('groups', String(req.params.id));
    if (!g) return res.status(404).json({ error: 'not_found' });
    const body = { ...(req.body ?? {}) } as Partial<Group>;
    delete (body as { id?: string }).id;
    delete body.system;
    if (body.permissions !== undefined && !validPerms(body.permissions)) return res.status(400).json({ error: 'invalid permissions' });
    // A group that holds more than you do cannot be edited by you, and you cannot add to a group what you do not hold.
    if (!canGrant(a, g.permissions) || !canGrant(a, body.permissions ?? [])) return res.status(403).json({ error: 'You cannot give permissions you do not hold yourself.' });
    const updated = await db.updateDoc<Group>('groups', g.id, body);
    broadcast('groups');
    res.json(updated);
  }));

  r.delete('/c/groups/:id', wrap(async (req, res) => {
    if (!me(req).can('admin.groups.manage')) return forbid(res);
    const g = await db.getDoc<Group>('groups', String(req.params.id));
    if (g?.system) return res.status(400).json({ error: 'system group' });
    if (g && !canGrant(me(req), g.permissions)) return res.status(403).json({ error: 'This group has more permissions than you.' });
    await db.removeDoc('groups', String(req.params.id));
    broadcast('groups');
    res.status(204).end();
  }));

  /* ---------- Business Central (live, read-only collections + actions) ---------- */

  const bcRead: Check = any('accounting.access');
  r.get('/c/bc.vendors', wrap(async (req, res) => (bcRead(me(req)) ? res.json(await bc.listVendors()) : forbid(res))));
  r.get('/c/bc.purchaseOrders', wrap(async (req, res) =>
    bcRead(me(req)) ? res.json(await bc.listPurchaseOrders()) : forbid(res),
  ));
  r.get('/c/bc.purchaseInvoices', (req, res) => (bcRead(me(req)) ? res.json([]) : forbid(res)));

  r.get('/bc/vendors/find', wrap(async (req, res) => {
    if (!bcRead(me(req))) return forbid(res);
    const v = await bc.findVendor(req.query.email ? String(req.query.email) : undefined, String(req.query.name ?? ''), true);
    res.json(v ?? null);
  }));
  r.get('/bc/purchase-orders/:no', wrap(async (req, res) => {
    if (!bcRead(me(req))) return forbid(res);
    const po = await bc.getPurchaseOrder(String(req.params.no));
    res.json(po ?? null);
  }));
  r.post('/bc/purchase-invoices', wrap(async (req, res) => {
    const a = me(req);
    if (!a.can('accounting.invoices.post')) return forbid(res);
    const id = String(req.body?.invoiceId ?? '');
    const note = req.body?.overrideNote ? String(req.body.overrideNote).trim() : '';
    await pipeline.withLock(`inv:${id}`, async () => {
      const inv = await db.getDoc<Invoice & { id: string }>('acc.invoices', id);
      if (!inv) return res.status(404).json({ error: 'invoice not found' });
      if (inv.stage === 'posted') return res.status(409).json({ error: 'already posted' });
      // The match shown in the browser is not trusted: it is recomputed here, against Business Central, right now.
      const fresh = await matchInvoiceRecord(id, a.user.id);
      if (fresh.match?.level === 'fail' && (!note || !a.can('accounting.invoices.override'))) {
        return res.status(403).json({ error: 'The match failed: posting needs the override permission and a written justification.' });
      }
      const result = await bc.createPurchaseInvoice(fresh);
      // Approval details are written by the server only (the generic API drops them from browser requests).
      await db.updateDoc('acc.invoices', id, { approvedBy: a.user.id, approvedAt: now(), overrideNote: note || undefined, bcInvoiceNo: result.no, postedAt: now() } as Partial<Invoice>);
      res.json(result);
    });
  }));
  r.post('/bc/test', wrap(async (req, res) => {
    if (!me(req).canAny('admin.system', 'accounting.settings')) return forbid(res);
    bc.assertBc();
    res.json(await bc.testConnection());
  }));

  r.post('/bc/sync', wrap(async (req, res) => {
    if (!bcRead(me(req))) return forbid(res);
    const result = await pipeline.syncBc();
    runAutomation().catch((e) => console.error('[automation]', e.message));
    res.json(result);
  }));
  r.get('/bc/status', wrap(async (req, res) => {
    if (!bcRead(me(req))) return forbid(res);
    res.json({ enabled: config.bc.enabled, lastSync: (await db.getMeta<string>('bc.lastSync')) ?? null });
  }));

  /** Runs the automation now (what happens depends on the mode chosen in Comptabilité → Paramètres). */
  r.post('/accounting/automation/run', wrap(async (req, res) => {
    if (!me(req).can('accounting.settings')) return forbid(res);
    res.json(await runAutomation());
  }));

  /* ---------- purchase orders received by e-mail ---------- */

  r.post('/pos/process', wrap(async (req, res) => {
    if (!me(req).can('accounting.po.process')) return forbid(res);
    res.json(await pipeline.processPo(String(req.body?.mailId ?? ''), Number(req.body?.attIndex ?? 0), me(req).user.id));
  }));
  r.post('/pos/:id/match', wrap(async (req, res) => {
    if (!me(req).can('accounting.po.process')) return forbid(res);
    res.json(await pipeline.rematchPo(String(req.params.id), me(req).user.id));
  }));
  r.post('/pos/:id/approve', wrap(async (req, res) => {
    const a = me(req);
    if (!a.can('accounting.po.approve')) return forbid(res);
    const note = req.body?.overrideNote ? String(req.body.overrideNote) : undefined;
    // Approving despite a failed match is an override.
    if (note && !a.can('accounting.invoices.override')) return forbid(res);
    res.json(await pipeline.approvePo(String(req.params.id), a.user.id, note));
  }));
  r.post('/pos/:id/reject', wrap(async (req, res) => {
    if (!me(req).can('accounting.po.approve')) return forbid(res);
    res.json(await pipeline.rejectPo(String(req.params.id), me(req).user.id, String(req.body?.reason ?? '')));
  }));
  r.post('/pos/:id/reopen', wrap(async (req, res) => {
    if (!me(req).can('accounting.po.approve')) return forbid(res);
    res.json(await pipeline.reopenPo(String(req.params.id), me(req).user.id));
  }));

  /* ---------- mailbox ---------- */

  r.post('/mailbox/sync', wrap(async (req, res) => {
    if (!me(req).canAny('accounting.inbox.view', 'accounting.invoices.import')) return forbid(res);
    const added = await syncMailbox();
    if (added) broadcast('acc.mailbox');
    // New mail may be processed automatically (depending on the mode); never make the person wait for it.
    runAutomation().catch((e) => console.error('[automation]', e.message));
    res.json({ added });
  }));
  r.post('/mailbox/test', wrap(async (req, res) => {
    if (!me(req).canAny('admin.system', 'accounting.settings')) return forbid(res);
    res.json(await testMailbox());
  }));

  r.get('/files/:id', wrap(async (req, res) => {
    if (!me(req).can('accounting.access')) return forbid(res);
    const f = await db.getFile(String(req.params.id));
    if (!f) return res.status(404).end();
    res.setHeader('Content-Type', f.contentType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(f.data);
  }));

  /* ---------- Microsoft 365 management (module "Gestion O365") ---------- */

  /** Resolves :tid (Imago tenant record) to the Entra tenant id, after the permission check. */
  const o365Tenant = async (req: Request, res: Response, perm: string): Promise<string | undefined> => {
    if (!me(req).can(perm)) {
      forbid(res);
      return undefined;
    }
    o365.assertO365();
    const t = await db.getDoc<O365Tenant & { id: string }>('o365.tenants', String(req.params.tid));
    if (!t) {
      res.status(404).json({ error: 'tenant not found' });
      return undefined;
    }
    return t.tenantId;
  };
  const o365Route = (perm: string, fn: (tenantId: string, req: Request) => Promise<unknown>, status = 200) =>
    wrap(async (req, res) => {
      const tenantId = await o365Tenant(req, res, perm);
      if (!tenantId) return;
      const out = await fn(tenantId, req);
      if (out === undefined) res.status(204).end();
      else res.status(status).json(out);
    });
  const p = (req: Request, name: string) => String(req.params[name]);

  r.get('/o365/:tid/overview', o365Route('o365.access', (t) => o365.overview(t)));
  r.get('/o365/:tid/users', o365Route('o365.access', (t) => o365.listUsers(t)));
  r.post('/o365/:tid/users', o365Route('o365.users.manage', (t, req) => o365.createUser(t, req.body), 201));
  r.patch('/o365/:tid/users/:id', o365Route('o365.users.manage', (t, req) => o365.updateUser(t, p(req, 'id'), req.body ?? {})));
  r.delete('/o365/:tid/users/:id', o365Route('o365.users.manage', (t, req) => o365.deleteUser(t, p(req, 'id'))));
  r.post('/o365/:tid/users/:id/password', o365Route('o365.users.manage', (t, req) => {
    const password = String(req.body?.password ?? '');
    if (password.length < MIN_PASSWORD) throw new HttpError(400, 'Password must be at least 8 characters.');
    return o365.resetPassword(t, p(req, 'id'), password, req.body?.forceChange !== false);
  }));
  r.post('/o365/:tid/users/:id/licenses', o365Route('o365.users.manage', (t, req) =>
    o365.setLicenses(t, p(req, 'id'), (req.body?.add ?? []).map(String), (req.body?.remove ?? []).map(String)),
  ));
  r.get('/o365/:tid/contacts', o365Route('o365.access', (t) => o365.listContacts(t)));
  r.post('/o365/:tid/contacts', o365Route('o365.contacts.manage', (t, req) => o365.createContact(t, req.body ?? {})));
  r.patch('/o365/:tid/contacts/:id', o365Route('o365.contacts.manage', (t, req) => o365.updateContact(t, p(req, 'id'), req.body ?? {})));
  r.delete('/o365/:tid/contacts/:id', o365Route('o365.contacts.manage', (t, req) => o365.deleteContact(t, p(req, 'id'))));
  r.get('/o365/:tid/groups', o365Route('o365.access', (t) => o365.listGroups(t)));
  r.get('/o365/:tid/groups/:id/members', o365Route('o365.access', (t, req) => o365.listMembers(t, p(req, 'id'))));
  r.post('/o365/:tid/groups/:id/members', o365Route('o365.groups.manage', (t, req) => o365.addMember(t, p(req, 'id'), String(req.body?.email ?? ''))));
  r.delete('/o365/:tid/groups/:id/members/:member', o365Route('o365.groups.manage', (t, req) =>
    o365.removeMember(t, p(req, 'id'), p(req, 'member')),
  ));
  r.get('/o365/:tid/licenses', o365Route('o365.access', (t, req) => o365.listLicenses(t, req.query.paid === '1')));
  r.get('/o365/:tid/licenses/:sku/users', o365Route('o365.access', (t, req) => o365.licenseHolders(t, p(req, 'sku'))));

  /* ---------- admin export ---------- */

  r.get('/admin/export', wrap(async (req, res) => {
    if (!me(req).can('admin.system')) return forbid(res);
    const out: Record<string, unknown[]> = {};
    for (const name of ['users', 'audit', ...Object.keys(RULES)]) {
      const rows = await db.listDocs<User>(name);
      out[name] = name === 'users' ? rows.map(publicUser) : rows;
    }
    res.setHeader('Content-Disposition', `attachment; filename="imago-export-${now().slice(0, 10)}.json"`);
    res.json(out);
  }));

  /* ---------- generic collections ---------- */

  const rule = (req: Request, res: Response): Rule | undefined => {
    const rl = RULES[String(req.params.c)];
    if (!rl) res.status(404).json({ error: 'unknown collection' });
    return rl;
  };

  r.get('/c/:c', wrap(async (req, res) => {
    const rl = rule(req, res);
    if (!rl) return;
    if (!rl.read(me(req))) return forbid(res);
    res.json(await db.listDocs(String(req.params.c)));
  }));

  r.get('/c/:c/:id', wrap(async (req, res) => {
    const rl = rule(req, res);
    if (!rl) return;
    if (!rl.read(me(req))) return forbid(res);
    const doc = await db.getDoc(String(req.params.c), String(req.params.id));
    if (!doc) return res.status(404).json({ error: 'not_found' });
    res.json(doc);
  }));

  r.post('/c/:c', wrap(async (req, res) => {
    const rl = rule(req, res);
    if (!rl) return;
    if (!rl.write(me(req))) return forbid(res);
    if (String(req.params.c) === 'acc.pos') return forbid(res); // created by the server (/pos/process) from a received document
    const body = { ...(req.body ?? {}) } as Record<string, unknown>;
    for (const f of SERVER_OWNED[String(req.params.c)] ?? []) delete body[f];
    if (RESERVED_IDS.has(String(body.id ?? '').toLowerCase())) return res.status(400).json({ error: 'reserved id' });
    const doc = { ...body, id: body.id ?? uid('') } as db.Doc;
    try {
      await db.insertDoc(String(req.params.c), doc);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') return res.status(409).json({ error: 'duplicate id' });
      throw e;
    }
    broadcast(String(req.params.c));
    res.status(201).json(doc);
  }));

  r.patch('/c/:c/:id', wrap(async (req, res) => {
    const rl = rule(req, res);
    if (!rl) return;
    if (!rl.write(me(req))) return forbid(res);
    const patch = { ...(req.body ?? {}) } as Record<string, unknown>;
    delete patch.id; // the document's identity never changes
    for (const f of SERVER_OWNED[String(req.params.c)] ?? []) delete patch[f];
    const doc = await db.updateDoc(String(req.params.c), String(req.params.id), patch);
    if (!doc) return res.status(404).json({ error: 'not_found' });
    broadcast(String(req.params.c));
    res.json(doc);
  }));

  r.delete('/c/:c/:id', wrap(async (req, res) => {
    const rl = rule(req, res);
    if (!rl) return;
    if (!rl.write(me(req))) return forbid(res);
    await db.removeDoc(String(req.params.c), String(req.params.id));
    broadcast(String(req.params.c));
    res.status(204).end();
  }));

  /** Bulk replace (data import). Super administrators only. */
  r.put('/c/:c', wrap(async (req, res) => {
    const rl = rule(req, res);
    if (!rl) return;
    if (!me(req).can('*') || !Array.isArray(req.body)) return forbid(res);
    await db.replaceAll(String(req.params.c), req.body as db.Doc[]);
    broadcast(String(req.params.c));
    res.status(204).end();
  }));

  /* unknown API route */
  r.use((_req, res) => res.status(404).json({ error: 'not_found' }));

  /* errors */
  r.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      console.warn(`[api] ${err.status} ${err.message}`);
      // Upstream 401/403 (Microsoft) must not look like an expired Imago session.
      const status = err.status === 401 || err.status === 403 || err.status < 400 || err.status >= 600 ? 502 : err.status;
      return res.status(status).json({ error: err.message });
    }
    console.error('[api]', err);
    res.status(500).json({ error: 'server error' });
  });

  return r;
}

