/**
 * Imago Sandbox (opened from the user menu): a person describes a change, the Claude agent makes it in a private copy
 * of the app (the sandbox runner, sandbox-runner/runner.ts), the person sees it in a preview, then submits it as a
 * GitHub pull request that an approver reviews. Nothing reaches the real app without that review.
 *
 * Rights: sandbox.use (make requests, on modules the person can open) · sandbox.review (see every request, approve).
 * Every call to the runner goes through here: the browser never reaches it. Budget: SANDBOX_USER_MONTHLY_USD per person.
 *
 * Environment: SANDBOX_RUNNER_SECRET (required to enable), SANDBOX_RUNNER_URL (default http://sandbox-runner:8095),
 * SANDBOX_USER_MONTHLY_USD (default 25), SANDBOX_MAX_OPEN (open requests per person, default 5).
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Request, Response, Router } from 'express';
import { sandboxModule, type SandboxRequest, type SandboxStatus } from '../src/modules/sandbox/sandboxModules.ts';
import type { AuthInfo } from './auth.ts';
import * as db from './db.ts';

const COL = 'sandbox.requests';
const SECRET = process.env.SANDBOX_RUNNER_SECRET ?? '';
const RUNNER = (process.env.SANDBOX_RUNNER_URL ?? 'http://sandbox-runner:8095').replace(/\/$/, '');
const MONTHLY = Number(process.env.SANDBOX_USER_MONTHLY_USD ?? 25);
const MAX_OPEN = Number(process.env.SANDBOX_MAX_OPEN ?? 5);
export const sandboxConfigured = () => SECRET.length >= 24;

const FINAL: SandboxStatus[] = ['approved', 'rejected', 'closed'];
const ID_RE = /^sbx_[a-f0-9]{16}$/;

async function runner(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}) {
  const res = await fetch(RUNNER + path, {
    method: init.method ?? 'GET',
    headers: { 'x-runner-secret': SECRET, ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

interface Deps {
  me: (req: Request) => AuthInfo;
  audit: (userId: string, action: string, detail?: string, ip?: string) => Promise<void>;
  wrap: (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: (e?: unknown) => void) => void;
  forbid: (res: Response) => unknown;
  broadcast: (c: string) => void;
}

export function sandboxRoutes(r: Router, { me, audit, wrap, forbid, broadcast }: Deps) {
  const canUse = (a: AuthInfo) => a.can('sandbox.use');
  const canReview = (a: AuthInfo) => a.can('sandbox.review');
  const notReady = (res: Response) => res.status(503).json({ error: 'Le Sandbox n’est pas configuré sur ce serveur. / The Sandbox is not configured on this server.' });

  /** The request, if this person may see it (its owner, or an approver). */
  async function visible(req: Request, res: Response): Promise<SandboxRequest | undefined> {
    const a = me(req);
    const id = String(req.params.id);
    const doc = ID_RE.test(id) ? await db.getDoc<SandboxRequest & db.Doc>(COL, id) : undefined;
    if (!doc || (doc.ownerId !== a.user.id && !canReview(a))) {
      res.status(404).json({ error: 'not_found' });
      return undefined;
    }
    return doc;
  }
  const owned = async (req: Request, res: Response) => {
    const doc = await visible(req, res);
    if (doc && doc.ownerId !== me(req).user.id) {
      forbid(res);
      return undefined;
    }
    return doc;
  };
  const patch = async (id: string, p: Partial<SandboxRequest>) => {
    await db.updateDoc<SandboxRequest>(COL, id, { ...p, updatedAt: new Date().toISOString() });
    broadcast(COL);
  };

  /** Spend of this person this calendar month (requests started this month). */
  async function monthSpend(userId: string): Promise<number> {
    const month = new Date().toISOString().slice(0, 7);
    const all = await db.listDocs<SandboxRequest & db.Doc>(COL);
    return all.filter((d) => d.ownerId === userId && d.createdAt.startsWith(month)).reduce((n, d) => n + (d.costUsd || 0), 0);
  }

  r.get('/sandbox/status', wrap(async (req, res) => {
    const a = me(req);
    if (!canUse(a) && !canReview(a)) return forbid(res);
    let health: Record<string, unknown> | null = null;
    if (sandboxConfigured()) {
      try {
        health = (await runner('/health', { timeoutMs: 4000 })).json;
      } catch {
        health = null;
      }
    }
    res.json({ configured: sandboxConfigured(), runner: health, budget: { used: await monthSpend(a.user.id), cap: MONTHLY } });
  }));

  r.get('/sandbox/requests', wrap(async (req, res) => {
    const a = me(req);
    if (!canUse(a) && !canReview(a)) return forbid(res);
    const all = await db.listDocs<SandboxRequest & db.Doc>(COL);
    const list = canReview(a) ? all : all.filter((d) => d.ownerId === a.user.id);
    res.json(list.sort((x, y) => y.updatedAt.localeCompare(x.updatedAt)));
  }));

  r.post('/sandbox/requests', wrap(async (req, res) => {
    const a = me(req);
    if (!canUse(a)) return forbid(res);
    if (!sandboxConfigured()) return notReady(res);
    const body = (req.body ?? {}) as { title?: unknown; moduleId?: unknown };
    const title = String(body.title ?? '').trim().slice(0, 200);
    const mod = sandboxModule(String(body.moduleId ?? ''));
    if (!title) return res.status(400).json({ error: 'title required' });
    // Only on a module the person can open: no accounting right, no accounting change.
    if (!mod || !a.can(mod.permission)) return res.status(403).json({ error: 'Module non permis / Module not allowed' });
    const all = await db.listDocs<SandboxRequest & db.Doc>(COL);
    const open = all.filter((d) => d.ownerId === a.user.id && !FINAL.includes(d.status) && d.status !== 'submitted').length;
    if (open >= MAX_OPEN) return res.status(429).json({ error: `Maximum ${MAX_OPEN} demandes en cours. Terminez ou abandonnez-en une. / At most ${MAX_OPEN} open requests.` });
    if ((await monthSpend(a.user.id)) >= MONTHLY) return res.status(402).json({ error: 'Budget mensuel atteint. / Monthly budget reached.' });

    const id = 'sbx_' + randomBytes(8).toString('hex');
    const previewToken = randomBytes(24).toString('hex');
    const rr = await runner('/sessions', { method: 'POST', body: { id, title, allowed: mod.folders, userName: a.user.displayName, previewBase: `/api/sandbox-preview/${id}/${previewToken}/` } });
    if (rr.status >= 300) return res.status(502).json({ error: `Sandbox : ${String(rr.json.error ?? rr.status)}` });
    const stamp = new Date().toISOString();
    const doc: SandboxRequest = { id, title, moduleId: mod.id, ownerId: a.user.id, status: 'preparing', costUsd: 0, prUrl: null, previewToken, reviewNote: '', reviewedBy: null, createdAt: stamp, updatedAt: stamp };
    await db.insertDoc(COL, doc as unknown as db.Doc);
    broadcast(COL);
    await audit(a.user.id, 'sandbox.create', `${id} ${mod.id} ${title}`, req.ip ?? '');
    res.status(201).json(doc);
  }));

  /** The request with the runner's live state (conversation since `since`, status, cost). */
  r.get('/sandbox/requests/:id', wrap(async (req, res) => {
    const doc = await visible(req, res);
    if (!doc) return;
    let live: Record<string, unknown> | null = null;
    if (sandboxConfigured() && doc.status !== 'closed') {
      try {
        const rr = await runner(`/sessions/${doc.id}?since=${Number(req.query.since ?? 0) || 0}`);
        if (rr.status === 200) live = rr.json;
      } catch {
        live = null;
      }
    }
    if (live) {
      const runnerStatus = String(live.status) as SandboxStatus;
      const p: Partial<SandboxRequest> = {};
      if (!FINAL.includes(doc.status) && doc.status !== 'submitted' && runnerStatus !== doc.status) p.status = runnerStatus === 'closed' ? 'ready' : runnerStatus;
      if (typeof live.costUsd === 'number' && live.costUsd !== doc.costUsd) p.costUsd = live.costUsd;
      if (Object.keys(p).length) {
        await patch(doc.id, p);
        Object.assign(doc, p);
      }
    }
    res.json({ request: doc, live: live ? { status: live.status, events: live.events, eventCount: live.eventCount, previewReady: live.previewReady, running: live.running, error: live.error } : null });
  }));

  r.post('/sandbox/requests/:id/prompt', wrap(async (req, res) => {
    const doc = await owned(req, res);
    if (!doc) return;
    if (FINAL.includes(doc.status) || doc.status === 'submitted') return res.status(409).json({ error: 'Demande terminée / Request closed' });
    const text = String((req.body as { text?: unknown })?.text ?? '').trim().slice(0, 8000);
    if (!text) return res.status(400).json({ error: 'text required' });
    if ((await monthSpend(doc.ownerId)) >= MONTHLY) return res.status(402).json({ error: 'Budget mensuel atteint. / Monthly budget reached.' });
    const rr = await runner(`/sessions/${doc.id}/prompt`, { method: 'POST', body: { text } });
    if (rr.status === 409) return res.status(409).json({ error: 'L’agent travaille déjà. / The agent is already working.' });
    if (rr.status >= 300) return res.status(502).json({ error: `Sandbox : ${String(rr.json.error ?? rr.status)}` });
    await patch(doc.id, { status: 'working' });
    await audit(me(req).user.id, 'sandbox.prompt', `${doc.id} ${text.slice(0, 300)}`, req.ip ?? '');
    res.status(202).json({ ok: true });
  }));

  r.post('/sandbox/requests/:id/stop', wrap(async (req, res) => {
    const doc = await owned(req, res);
    if (!doc) return;
    await runner(`/sessions/${doc.id}/stop`, { method: 'POST' });
    res.json({ ok: true });
  }));

  r.post('/sandbox/requests/:id/submit', wrap(async (req, res) => {
    const doc = await owned(req, res);
    if (!doc) return;
    if (FINAL.includes(doc.status) || doc.status === 'submitted') return res.status(409).json({ error: 'Déjà soumise / Already submitted' });
    const summary = String((req.body as { summary?: unknown })?.summary ?? '').trim().slice(0, 4000) || doc.title;
    const rr = await runner(`/sessions/${doc.id}/submit`, { method: 'POST', body: { summary, author: me(req).user.displayName }, timeoutMs: 900_000 });
    if (rr.status >= 300) return res.status(rr.status === 422 ? 422 : 502).json({ error: String(rr.json.error ?? rr.status) });
    const prUrl = typeof rr.json.prUrl === 'string' ? rr.json.prUrl : null;
    await patch(doc.id, { status: 'submitted', prUrl });
    await audit(me(req).user.id, 'sandbox.submit', `${doc.id} ${prUrl ?? ''}`, req.ip ?? '');
    res.json({ ok: true, prUrl });
  }));

  r.post('/sandbox/requests/:id/review', wrap(async (req, res) => {
    const a = me(req);
    if (!canReview(a)) return forbid(res);
    const doc = await visible(req, res);
    if (!doc) return;
    const b = (req.body ?? {}) as { decision?: unknown; note?: unknown };
    const decision = b.decision === 'approved' || b.decision === 'rejected' ? b.decision : null;
    if (!decision) return res.status(400).json({ error: 'decision must be approved or rejected' });
    if (doc.status !== 'submitted') return res.status(409).json({ error: 'Seule une demande soumise se révise. / Only a submitted request can be reviewed.' });
    await patch(doc.id, { status: decision, reviewNote: String(b.note ?? '').slice(0, 2000), reviewedBy: a.user.id });
    await audit(a.user.id, `sandbox.${decision}`, doc.id, req.ip ?? '');
    res.json({ ok: true });
  }));

  r.post('/sandbox/requests/:id/close', wrap(async (req, res) => {
    const doc = await visible(req, res);
    if (!doc) return;
    if (doc.ownerId !== me(req).user.id && !canReview(me(req))) return forbid(res);
    try {
      await runner(`/sessions/${doc.id}`, { method: 'DELETE', timeoutMs: 60_000 });
    } catch {
      /* the runner may be down: the request is closed here anyway */
    }
    await patch(doc.id, { status: doc.status === 'submitted' || doc.status === 'approved' || doc.status === 'rejected' ? doc.status : 'closed' });
    await audit(me(req).user.id, 'sandbox.close', doc.id, req.ip ?? '');
    res.json({ ok: true });
  }));

}

/**
 * The preview (registered BEFORE sign-in is required): the app copy built on demo data, proxied from the runner, at a
 * private link /api/sandbox-preview/<request>/<token>/ known only to the request's owner and approvers. It is served
 * as an isolated document (CSP sandbox without allow-same-origin, no network): its code can never use the viewer's
 * Imago session, even when an approver opens it. Being isolated, its own files are fetched without cookies, hence the
 * token instead of the session.
 */
export function sandboxPreviewRoute(r: Router, wrap: Deps['wrap']) {
  r.get('/sandbox-preview/:id/:token{/*rest}', wrap(async (req, res) => {
    const id = String(req.params.id);
    const token = String(req.params.token);
    const doc = ID_RE.test(id) && /^[a-f0-9]{48}$/.test(token) ? await db.getDoc<SandboxRequest & db.Doc>(COL, id) : undefined;
    const ok = !!doc?.previewToken && doc.status !== 'closed' && timingSafeEqual(Buffer.from(doc.previewToken), Buffer.from(token));
    if (!ok || !sandboxConfigured()) return res.status(404).end();
    const rest = (req.params as { rest?: string[] }).rest ?? [];
    const sub = rest.map((p) => encodeURIComponent(p)).join('/');
    // The timer covers the wait for the runner's answer only; it is cleared before the body is streamed.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30_000);
    let up: globalThis.Response;
    try {
      up = await fetch(`${RUNNER}/sessions/${id}/preview/${sub}`, { headers: { 'x-runner-secret': SECRET }, signal: ac.signal });
    } catch {
      clearTimeout(timer);
      return res.status(502).end();
    }
    clearTimeout(timer);
    res.status(up.status);
    res.setHeader('Content-Type', up.headers.get('content-type') ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex');
    // In an isolated (sandboxed) document 'self' matches nothing, so this site's address is named explicitly; files
    // may come only from this preview's own folder.
    const own = `${req.protocol}://${req.get('host')}/api/sandbox-preview/${id}/${token}/`;
    res.setHeader('Content-Security-Policy', `sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads; default-src ${own} 'unsafe-inline' data: blob:; style-src ${own} 'unsafe-inline' https://fonts.googleapis.com; font-src ${own} data: https://fonts.gstatic.com; connect-src 'none'; frame-ancestors 'self'`);
    if (!up.body) return res.end();
    // A stream error (viewer gone, runner restarted) ends this response only, never the server.
    await pipeline(Readable.fromWeb(up.body as import('node:stream/web').ReadableStream), res).catch(() => res.destroy());
  }));
}
