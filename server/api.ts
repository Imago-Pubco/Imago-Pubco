/**
 * REST API. `/api/c/:collection` mirrors the front end's Collection<T> contract; each
 * collection has read/write permission rules enforced here, on the server.
 */
import { randomBytes } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Group, User } from '../src/data/types.ts';
import type { Invoice } from '../src/modules/accounting/types.ts';
import {
  clearLoginFailures,
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
};

/** Fields the generic API never accepts from the browser on users. */
const PROTECTED_USER_FIELDS = ['passwordHash', 'salt', 'lastLoginAt', 'createdAt'] as const;

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
    if (loginBlocked(key)) return res.status(429).json({ error: 'too_many_attempts' });
    const user = (await db.listDocs<User>('users')).find((u) => u.username.toLowerCase() === username);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      recordLoginFailure(key);
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

  r.get('/auth/me', (req, res) => {
    if (!req.auth) return res.status(401).json({ error: 'unauthenticated' });
    res.json({ user: publicUser(req.auth.user) });
  });

  /* Everything below needs a signed-in user. */
  r.use(requireAuth);
  const me = (req: Request) => req.auth!;

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
      },
    });
  });

  /* ---------- users (hashes never leave the server) ---------- */

  r.get('/c/users', wrap(async (_req, res) => {
    res.json((await db.listDocs<User>('users')).map(publicUser));
  }));
  r.get('/c/users/:id', wrap(async (req, res) => {
    const u = await db.getDoc<User>('users', String(req.params.id));
    if (!u) return res.status(404).json({ error: 'not_found' });
    res.json(publicUser(u));
  }));

  r.post('/c/users', wrap(async (req, res) => {
    if (!me(req).can('admin.users.manage')) return forbid(res);
    const body = { ...(req.body ?? {}) } as Partial<User> & { password?: string };
    const password = String(body.password ?? '');
    const username = String(body.username ?? '').trim().toLowerCase();
    if (!username) return res.status(400).json({ error: 'username required' });
    if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
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
    const password = body.password;
    delete body.password;
    if (body.username) {
      const username = String(body.username).trim().toLowerCase();
      if ((await db.listDocs<User>('users')).some((u) => u.username.toLowerCase() === username && u.id !== id)) {
        return res.status(409).json({ error: 'username exists' });
      }
      body.username = username;
    }
    const patch: Partial<User> = { ...body };
    if (password !== undefined && password !== '') {
      if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
      patch.passwordHash = await hashPassword(password);
      patch.salt = '';
    }
    const updated = await db.updateDoc<User>('users', id, patch);
    if (!updated) return res.status(404).json({ error: 'not_found' });
    // A password reset or deactivation signs the user out everywhere else.
    if (patch.passwordHash || updated.active === false) await destroyUserSessions(id, id === a.user.id ? a.sessionId : undefined);
    broadcast('users');
    res.json(publicUser(updated));
  }));

  r.delete('/c/users/:id', wrap(async (req, res) => {
    const id = String(req.params.id);
    if (!me(req).can('admin.users.manage')) return forbid(res);
    if (id === me(req).user.id) return res.status(400).json({ error: 'cannot delete yourself' });
    await db.removeDoc('users', id);
    await destroyUserSessions(id);
    broadcast('users');
    res.status(204).end();
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
      action: String(req.body?.action ?? '').slice(0, 100),
      detail: String(req.body?.detail ?? '').slice(0, 2000),
      ip: req.ip ?? '',
    };
    await db.insertDoc('audit', entry);
    broadcast('audit');
    res.status(201).json(entry);
  }));

  /* ---------- groups: system groups cannot be deleted ---------- */

  r.delete('/c/groups/:id', wrap(async (req, res) => {
    if (!me(req).can('admin.groups.manage')) return forbid(res);
    const g = await db.getDoc<Group>('groups', String(req.params.id));
    if (g?.system) return res.status(400).json({ error: 'system group' });
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
    const v = await bc.findVendor(req.query.email ? String(req.query.email) : undefined, String(req.query.name ?? ''));
    res.json(v ?? null);
  }));
  r.get('/bc/purchase-orders/:no', wrap(async (req, res) => {
    if (!bcRead(me(req))) return forbid(res);
    const po = await bc.getPurchaseOrder(String(req.params.no));
    res.json(po ?? null);
  }));
  r.post('/bc/purchase-invoices', wrap(async (req, res) => {
    if (!me(req).can('accounting.invoices.post')) return forbid(res);
    const inv = await db.getDoc<Invoice & { id: string }>('acc.invoices', String(req.body?.invoiceId ?? ''));
    if (!inv) return res.status(404).json({ error: 'invoice not found' });
    if (inv.stage === 'posted') return res.status(409).json({ error: 'already posted' });
    const result = await bc.createPurchaseInvoice(inv);
    res.json(result);
  }));
  r.post('/bc/test', wrap(async (req, res) => {
    if (!me(req).canAny('admin.system', 'accounting.settings')) return forbid(res);
    bc.assertBc();
    res.json(await bc.testConnection());
  }));

  /* ---------- mailbox ---------- */

  r.post('/mailbox/sync', wrap(async (req, res) => {
    if (!me(req).canAny('accounting.inbox.view', 'accounting.invoices.import')) return forbid(res);
    const added = await syncMailbox();
    if (added) broadcast('acc.mailbox');
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
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
    return o365.resetPassword(t, p(req, 'id'), password, req.body?.forceChange !== false);
  }));
  r.post('/o365/:tid/users/:id/licenses', o365Route('o365.users.manage', (t, req) =>
    o365.setLicenses(t, p(req, 'id'), (req.body?.add ?? []).map(String), (req.body?.remove ?? []).map(String)),
  ));
  r.get('/o365/:tid/contacts', o365Route('o365.access', (t) => o365.listContacts(t)));
  r.post('/o365/:tid/contacts', o365Route('o365.contacts.manage', (t, req) => o365.createContact(t, req.body ?? {})));
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
    const doc = { ...(req.body ?? {}), id: req.body?.id ?? uid('') } as db.Doc;
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
    const doc = await db.updateDoc(String(req.params.c), String(req.params.id), req.body ?? {});
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

