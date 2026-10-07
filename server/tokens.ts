/**
 * One-time links: "choose your password" (new accounts) and "reset your password". Only a hash of the
 * token is stored, so a database copy cannot be used to take over an account. Each token works once.
 */
import { createHash, randomBytes } from 'node:crypto';
import * as db from './db.ts';

export type TokenPurpose = 'set_password' | 'reset_password';

interface TokenDoc {
  id: string; // sha256 of the token
  userId: string;
  purpose: TokenPurpose;
  expiresAt: string;
  usedAt?: string;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createToken(userId: string, purpose: TokenPurpose, ttlMs: number): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  // Earlier unused links for the same purpose stop working, and expired ones are cleared.
  for (const t of await db.listDocs<TokenDoc>('auth.tokens')) {
    if (Date.parse(t.expiresAt) < Date.now() || t.usedAt || (t.userId === userId && t.purpose === purpose)) await db.removeDoc('auth.tokens', t.id);
  }
  await db.insertDoc<TokenDoc>('auth.tokens', { id: hash(token), userId, purpose, expiresAt: new Date(Date.now() + ttlMs).toISOString() });
  return token;
}

/** The user a valid token belongs to, without using it up. */
export async function peekToken(token: string): Promise<string | undefined> {
  const t = await db.getDoc<TokenDoc>('auth.tokens', hash(token));
  return t && !t.usedAt && Date.parse(t.expiresAt) > Date.now() ? t.userId : undefined;
}

/** Uses the token up. Returns the user id, or undefined when the token is unknown, used or expired. */
export async function consumeToken(token: string): Promise<string | undefined> {
  const userId = await peekToken(token);
  if (userId) await db.updateDoc<TokenDoc>('auth.tokens', hash(token), { usedAt: new Date().toISOString() });
  return userId;
}

export const humanDuration = (ms: number) => {
  const h = Math.round(ms / 3600_000);
  return h >= 48 ? `${Math.round(h / 24)} jours` : h === 1 ? '1 heure' : `${h} heures`;
};
