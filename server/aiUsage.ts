/**
 * AI usage accounting and monthly quotas (organisation-wide, per user, and a default per user).
 * Every model call is checked before it starts (assertAiQuota) and its tokens are added afterwards (recordAiUsage).
 * Work done by the system (mailbox sync, public request form) counts as user 'system': it only meets the
 * organisation limit. Limits: a field left out inherits, 0 means unlimited. A call that starts just under a
 * limit may end slightly over it (tokens are only known after the answer).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthInfo } from './auth.ts';
import * as db from './db.ts';
import { HttpError } from './ms.ts';

export type AiFeature = 'sales.request' | 'sales.image' | 'accounting.invoice' | 'assistant';

const QUOTAS_KEY = 'ai.quotas';
const COLLECTION = 'ai.usage';

const Limit = z.object({
  maxTokens: z.number().int().min(0).max(1e12).optional(),
  maxCalls: z.number().int().min(0).max(1e9).optional(),
});
const QuotasSchema = z.object({
  org: Limit,
  /** Applies to every user without their own entry. */
  defaultUser: Limit,
  perUser: z.record(z.string().max(60), Limit),
});
export type AiQuotas = z.infer<typeof QuotasSchema>;
const NO_QUOTAS: AiQuotas = { org: {}, defaultUser: {}, perUser: {} };

interface Counter {
  calls: number;
  input: number;
  output: number;
}
interface MonthDoc {
  id: string;
  org: Counter;
  users: Record<string, Counter>;
  features: Record<string, Counter>;
}

const month = () => new Date().toISOString().slice(0, 7);
const empty = (): Counter => ({ calls: 0, input: 0, output: 0 });
const tokens = (c: Counter) => c.input + c.output;

/* ---------- who is calling ---------- */

const als = new AsyncLocalStorage<{ userId: string }>();
/** Runs `fn` so that AI calls made inside it are charged to this user. */
export const runAsUser = <T>(userId: string, fn: () => T): T => als.run({ userId }, fn);
const currentUser = () => als.getStore()?.userId ?? 'system';

export class AiQuotaError extends HttpError {
  constructor(who: 'user' | 'org') {
    super(429, who === 'user' ? 'Votre quota mensuel d’IA est atteint. Contactez un administrateur.' : 'Le quota mensuel d’IA de l’organisation est atteint.');
  }
}

/* ---------- storage ---------- */

let chain: Promise<unknown> = Promise.resolve();
/** Serialises read-modify-write on the month document (one server process). */
const exclusive = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
};

async function loadMonth(id: string): Promise<MonthDoc> {
  const d = await db.getDoc<MonthDoc>(COLLECTION, id);
  return d ?? { id, org: empty(), users: {}, features: {} };
}

async function saveMonth(d: MonthDoc) {
  if (await db.getDoc(COLLECTION, d.id)) await db.updateDoc<MonthDoc>(COLLECTION, d.id, d);
  else await db.insertDoc(COLLECTION, d);
}

export async function getQuotas(): Promise<AiQuotas> {
  const parsed = QuotasSchema.safeParse(await db.getMeta<unknown>(QUOTAS_KEY));
  return parsed.success ? parsed.data : NO_QUOTAS;
}

/** The limit that applies to a user: their own entry, field by field, over the default. 0 / missing = unlimited. */
function userLimit(q: AiQuotas, userId: string) {
  const own = q.perUser[userId] ?? {};
  return { maxTokens: own.maxTokens ?? q.defaultUser.maxTokens ?? 0, maxCalls: own.maxCalls ?? q.defaultUser.maxCalls ?? 0 };
}

const over = (c: Counter, l: { maxTokens?: number; maxCalls?: number }) => (!!l.maxTokens && tokens(c) >= l.maxTokens) || (!!l.maxCalls && c.calls >= l.maxCalls);

/* ---------- used by the AI callers ---------- */

/** Throws AiQuotaError when the user or the organisation has used up this month's allowance. */
export async function assertAiQuota(): Promise<void> {
  const q = await getQuotas();
  const doc = await loadMonth(month());
  if (over(doc.org, q.org)) throw new AiQuotaError('org');
  const userId = currentUser();
  if (userId !== 'system' && over(doc.users[userId] ?? empty(), userLimit(q, userId))) throw new AiQuotaError('user');
}

/** Adds one model call and its tokens to this month's totals. Never throws. */
export function recordAiUsage(feature: AiFeature, input: number | undefined, output: number | undefined): Promise<void> {
  const userId = currentUser();
  return exclusive(async () => {
    const d = await loadMonth(month());
    const add = (c: Counter) => {
      c.calls += 1;
      c.input += Math.max(0, Math.round(input ?? 0));
      c.output += Math.max(0, Math.round(output ?? 0));
    };
    add(d.org);
    add((d.users[userId] ??= empty()));
    add((d.features[feature] ??= empty()));
    await saveMonth(d);
  }).catch((e) => console.error('[ai-usage] could not record usage:', e instanceof Error ? e.message : e));
}

/* ---------- routes (signed-in API) ---------- */

interface Helpers {
  wrap: (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: (e?: unknown) => void) => Promise<unknown>;
  me: (req: Request) => AuthInfo;
  forbid: (res: Response) => unknown;
  audit: (userId: string, action: string, detail?: string, ip?: string) => Promise<void>;
}

export function registerAiUsageRoutes(r: import('express').Router, h: Helpers) {
  const { wrap, me, forbid } = h;

  /** Admin: this month's totals by user and feature, the limits, and the last months for the trend. */
  r.get('/ai/usage', wrap(async (req, res) => {
    if (!me(req).can('admin.ai')) return forbid(res);
    const rows = (await db.listDocs<MonthDoc>(COLLECTION)).sort((a, b) => b.id.localeCompare(a.id));
    const current = rows.find((m) => m.id === month()) ?? (await loadMonth(month()));
    res.json({ month: month(), quotas: await getQuotas(), current, history: rows.slice(0, 12).map((m) => ({ month: m.id, calls: m.org.calls, input: m.org.input, output: m.org.output })) });
  }));

  r.put('/ai/quotas', wrap(async (req, res) => {
    const a = me(req);
    if (!a.can('admin.ai')) return forbid(res);
    const parsed = QuotasSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid quotas' });
    await db.setMeta(QUOTAS_KEY, parsed.data);
    await h.audit(a.user.id, 'admin.ai.quotas', JSON.stringify(parsed.data).slice(0, 500), req.ip ?? '');
    res.json(parsed.data);
  }));

  /** Anyone signed in: their own usage and limit this month (shown next to the AI buttons). */
  r.get('/ai/me', wrap(async (req, res) => {
    const id = me(req).user.id;
    const q = await getQuotas();
    const doc = await loadMonth(month());
    const used = doc.users[id] ?? empty();
    res.json({ month: month(), calls: used.calls, tokens: tokens(used), limit: userLimit(q, id), org: { calls: doc.org.calls, tokens: tokens(doc.org), limit: q.org } });
  }));
}
