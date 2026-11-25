/**
 * Application updates (Administration › Système › Mise à jour), admin.system only.
 *
 * The app never updates itself: it writes a request file in the folder shared with the server
 * (/app/update ↔ /opt/imago-pubco/.update); the server's updater (deploy/imago-update.sh, run by systemd as root)
 * does the work — fetch GitHub, back up the database, build, restart, health check, roll back on failure — and
 * writes its progress to status.json and update.log, which these routes read back.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Request, Response, Router } from 'express';
import type { AuthInfo } from './auth.ts';

const DIR = process.env.UPDATE_DIR ?? '/app/update';
const STATUS = path.join(DIR, 'status.json');
const LOG = path.join(DIR, 'update.log');
const REQ = path.join(DIR, 'request.json');

/** Is the shared folder there and writable (the updater is installed)? */
function available(): boolean {
  try {
    fs.accessSync(DIR, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function readStatus(): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(STATUS, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function logTail(lines = 80): string[] {
  try {
    const text = fs.readFileSync(LOG, 'utf8');
    return text.split('\n').filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}

/** A request the updater has not picked up yet. */
const pending = () => fs.existsSync(REQ);

function request(kind: 'check' | 'apply', by: string) {
  const body = JSON.stringify({ id: randomBytes(6).toString('hex'), kind, by: by.replace(/[^A-Za-z0-9 ._@-]/g, '').slice(0, 80), at: new Date().toISOString() });
  const tmp = REQ + '.tmp';
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, REQ); // atomic: the updater never sees a half-written file
}

interface Deps {
  me: (req: Request) => AuthInfo;
  audit: (userId: string, action: string, detail?: string, ip?: string) => Promise<void>;
  wrap: (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: (e?: unknown) => void) => void;
  forbid: (res: Response) => unknown;
}

export function updateRoutes(r: Router, { me, audit, wrap, forbid }: Deps) {
  const guard = (req: Request, res: Response) => {
    if (!me(req).can('admin.system')) {
      forbid(res);
      return false;
    }
    return true;
  };

  r.get('/system/update', wrap(async (req, res) => {
    if (!guard(req, res)) return;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ available: available(), pending: pending(), status: readStatus(), log: logTail() });
  }));

  r.post('/system/update/check', wrap(async (req, res) => {
    if (!guard(req, res)) return;
    if (!available()) return res.status(503).json({ error: 'Le service de mise à jour n’est pas installé sur le serveur (deploy/UPDATES.md).' });
    if (pending() || readStatus()?.state === 'working') return res.status(409).json({ error: 'Une opération est déjà en cours.' });
    request('check', me(req).user.displayName);
    await audit(me(req).user.id, 'system.update.check', '', req.ip ?? '');
    res.status(202).json({ ok: true });
  }));

  r.post('/system/update/apply', wrap(async (req, res) => {
    if (!guard(req, res)) return;
    if (!available()) return res.status(503).json({ error: 'Le service de mise à jour n’est pas installé sur le serveur (deploy/UPDATES.md).' });
    if (String((req.body as { confirm?: unknown })?.confirm ?? '') !== 'METTRE À JOUR') return res.status(400).json({ error: 'Confirmation requise : METTRE À JOUR' });
    if (pending() || readStatus()?.state === 'working') return res.status(409).json({ error: 'Une opération est déjà en cours.' });
    request('apply', me(req).user.displayName);
    const latest = (readStatus()?.latest as { sha?: string } | null)?.sha ?? '?';
    await audit(me(req).user.id, 'system.update.apply', `vers ${latest}`, req.ip ?? '');
    res.status(202).json({ ok: true });
  }));
}
