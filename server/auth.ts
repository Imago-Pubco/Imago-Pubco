/**
 * Server-side authentication: scrypt password hashes, opaque session ids in an
 * HttpOnly cookie, and the same permission rules as the front end.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { effectivePermissions, hasPermission } from '../src/auth/permissions.ts';
import type { Group, User } from '../src/data/types.ts';
import { config } from './config.ts';
import { getDoc, listDocs, pool } from './db.ts';

const COOKIE = 'imago_sid';
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function scrypt(password: string, salt: Buffer, len: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, len, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Returns `scrypt$N$r$p$salt$hash` (salt and hash base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  const parts = stored?.split('$');
  if (!parts || parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(password, Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return timingSafeEqual(key, expected);
}

/** Never send hashes to the browser. */
export function publicUser(u: User): Omit<User, 'passwordHash' | 'salt'> & { passwordHash: ''; salt: '' } {
  return { ...u, passwordHash: '', salt: '' };
}

export interface AuthInfo {
  user: User;
  sessionId: string;
  /** Set when an administrator is viewing the portal as this user (read-only). */
  impersonatorId?: string;
  parentSid?: string;
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthInfo;
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

function cookieAttrs(maxAgeSeconds: number) {
  return [`Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=${maxAgeSeconds}`, config.cookieSecure ? 'Secure' : '']
    .filter(Boolean)
    .join('; ');
}

export async function createSession(res: Response, req: Request, userId: string, opts: { ttlSeconds?: number; impersonatorId?: string; parentSid?: string } = {}) {
  const id = randomBytes(32).toString('base64url');
  const ttl = opts.ttlSeconds ?? config.sessionHours * 3600;
  await pool.query(
    `insert into sessions (id, user_id, expires_at, ip, user_agent, impersonator_id, parent_sid)
     values ($1, $2, now() + make_interval(secs => $3), $4, $5, $6, $7)`,
    [id, userId, ttl, req.ip ?? null, (req.headers['user-agent'] ?? '').slice(0, 300), opts.impersonatorId ?? null, opts.parentSid ?? null],
  );
  res.setHeader('Set-Cookie', `${COOKIE}=${id}; ${cookieAttrs(ttl)}`);
}

/** Gives the browser back the administrator's own session after "view as" (if it is still valid; otherwise they sign in again). */
export async function restoreParentSession(res: Response, parentSid: string | undefined, impersonatorId: string | undefined) {
  const r = parentSid
    ? await pool.query('select extract(epoch from (expires_at - now()))::int as left from sessions where id = $1 and user_id = $2 and impersonator_id is null and expires_at > now()', [parentSid, impersonatorId])
    : undefined;
  const left = r?.rows[0]?.left as number | undefined;
  res.setHeader('Set-Cookie', `${COOKIE}=${left ? parentSid : ''}; ${cookieAttrs(left ?? 0)}`);
}

export async function destroySession(res: Response, sessionId?: string) {
  if (sessionId) await pool.query('delete from sessions where id = $1', [sessionId]);
  res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieAttrs(0)}`);
}

export async function destroyUserSessions(userId: string, exceptSessionId?: string) {
  await pool.query('delete from sessions where user_id = $1 and id <> $2', [userId, exceptSessionId ?? '']);
}

export async function purgeExpiredSessions() {
  await pool.query('delete from sessions where expires_at < now()');
}

export async function permissionsFor(user: User) {
  const groups = await listDocs<Group>('groups');
  return effectivePermissions(user, groups);
}

/** Loads the session (if any) and attaches `req.auth`. Sliding expiry: renews once half the TTL has passed. */
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  try {
    const sid = readCookie(req, COOKIE);
    if (!sid) return next();
    const r = await pool.query(
      `select user_id, impersonator_id, parent_sid, expires_at < now() + make_interval(secs => $2) as renew
       from sessions where id = $1 and expires_at > now()`,
      [sid, (config.sessionHours * 3600) / 2],
    );
    const row = r.rows[0];
    if (!row) return next();
    const user = await getDoc<User>('users', row.user_id);
    if (!user || !user.active) return next();
    // "View as" sessions are short and never renewed.
    if (row.renew && !row.impersonator_id) {
      await pool.query('update sessions set expires_at = now() + make_interval(secs => $2) where id = $1', [
        sid,
        config.sessionHours * 3600,
      ]);
    }
    const perms = await permissionsFor(user);
    const can = (p: string) => hasPermission(perms, p);
    req.auth = { user, sessionId: sid, impersonatorId: row.impersonator_id ?? undefined, parentSid: row.parent_sid ?? undefined, can, canAny: (...ps) => ps.some(can) };
    next();
  } catch (e) {
    next(e);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: 'unauthenticated' });
  next();
}

/** Simple in-memory login throttle: 10 failed attempts per IP+username per 15 minutes. */
const failures = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 15 * 60 * 1000;

export function loginBlocked(key: string): boolean {
  const f = failures.get(key);
  if (!f) return false;
  if (Date.now() > f.until) {
    failures.delete(key);
    return false;
  }
  return f.count >= 10;
}
export function recordLoginFailure(key: string) {
  const f = failures.get(key);
  if (!f || Date.now() > f.until) failures.set(key, { count: 1, until: Date.now() + WINDOW_MS });
  else f.count++;
}
export function clearLoginFailures(key: string) {
  failures.delete(key);
}

/** Per-IP throttle on top of the per-account one: 40 failed sign-ins per IP per 15 minutes, whatever the usernames tried. */
const ipFailures = new Map<string, { count: number; until: number }>();
export function ipBlocked(ip: string): boolean {
  const f = ipFailures.get(ip);
  if (!f) return false;
  if (Date.now() > f.until) {
    ipFailures.delete(ip);
    return false;
  }
  return f.count >= 40;
}
export function recordIpFailure(ip: string) {
  const f = ipFailures.get(ip);
  if (!f || Date.now() > f.until) ipFailures.set(ip, { count: 1, until: Date.now() + WINDOW_MS });
  else f.count++;
}

/** A real hash nobody can match: verifying against it makes an unknown username cost the same time as a known one. */
const dummy = hashPassword(randomBytes(16).toString('hex'));
export async function burnPasswordCheck(password: string) {
  await verifyPassword(password, await dummy);
}
