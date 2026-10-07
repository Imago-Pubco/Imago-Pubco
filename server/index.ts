/**
 * Imago production server: serves the built front end (dist/) and the /api routes,
 * backed by PostgreSQL. Run with `node server/index.ts` (Node 24 runs TypeScript directly).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { apiRouter } from './api.ts';
import { loadSession, purgeExpiredSessions } from './auth.ts';
import { syncBc } from './pipeline.ts';
import { runAutomation } from './automation.ts';
import { ensureMailTemplates } from './mail.ts';
import { config } from './config.ts';
import { migrate, pool } from './db.ts';
import { broadcast } from './events.ts';
import { syncMailbox } from './mailbox.ts';
import { initialise } from './seed.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (config.cookieSecure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});

app.use(loadSession);
app.use('/api', apiRouter());

// Hashed build assets can be cached for a year; index.html must always be revalidated.
app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
app.use(express.static(dist, { index: false, maxAge: '1h' }));
app.get('/{*path}', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(dist, 'index.html'));
});

async function start() {
  await migrate();
  await initialise();
  await ensureMailTemplates();
  await purgeExpiredSessions();
  setInterval(() => purgeExpiredSessions().catch((e) => console.error('[sessions]', e)), 3600_000);

  if (config.bc.enabled && config.bc.syncMinutes > 0) {
    setInterval(() => {
      syncBc()
        .then(() => runAutomation())
        .catch((e) => console.error('[bc] sync failed:', e.message));
    }, config.bc.syncMinutes * 60_000);
  }

  if (config.graph.enabled && config.graph.syncMinutes > 0) {
    setInterval(() => {
      syncMailbox()
        .then((n) => n && broadcast('acc.mailbox'))
        .then(() => runAutomation())
        .catch((e) => console.error('[mailbox] sync failed:', e.message));
    }, config.graph.syncMinutes * 60_000);
  }

  const server = app.listen(config.port, () => {
    console.log(`[imago] listening on :${config.port}`);
    console.log(
      `[imago] Business Central: ${config.bc.enabled ? config.bc.environment + ' (' + config.bc.postMode + ')' : 'not configured'}` +
        ` · Mailbox: ${config.graph.enabled ? config.graph.mailbox : 'not configured'}` +
        ` · AI extraction: ${config.ai.enabled ? config.ai.model : 'off'}` +
        ` · E-mail: ${config.smtp.enabled ? config.smtp.host : 'not configured'}`,
    );
  });

  const shutdown = () => {
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((e) => {
  console.error('[imago] failed to start:', e instanceof Error ? e.message : e);
  process.exit(1);
});
