/**
 * Imago Sandbox runner — a small internal service, reached only by the Imago server (shared secret, private network).
 *
 * For each Sandbox request:
 *   1. a git worktree of the Imago repository on its own branch (sandbox/<id>), node_modules shared with the main copy;
 *   2. the agent (Claude through the Claude Agent SDK, or OpenAI through openaiAgent.ts) edits that worktree from the
 *      person's prompts — file tools only, and only
 *      inside the folders the request allows (checked on every tool call by a PreToolUse hook);
 *   3. after each turn, a preview build of the app on demo data (browser backend), served to the Imago server;
 *   4. on submit: scope check, typecheck, build, commit, push, GitHub pull request.
 *
 * The agent never gets a shell, the network (other than the model), the GitHub token or any Imago secret.
 *
 * Environment:
 *   RUNNER_SECRET     shared secret, required (the Imago server sends it as x-runner-secret)
 *   RUNNER_PORT       default 8095
 *   REPO_DIR          the main clone (default /data/repo); cloned from GITHUB_REPO on first start if missing
 *   WORK_DIR          sessions live here (default /data/sessions)
 *   GITHUB_REPO       owner/name of the Imago repository
 *   GITHUB_TOKEN      token able to push branches and open pull requests on that repository only
 *   GITHUB_BASE       base branch (default main)
 *   SANDBOX_PROVIDER  anthropic | openai (default: anthropic when ANTHROPIC_API_KEY is set, otherwise openai)
 *   ANTHROPIC_API_KEY Anthropic API key (passed to the agent process only)
 *   OPENAI_API_KEY    OpenAI API key; OPENAI_BASE_URL optional
 *   SANDBOX_MODEL     model id (default claude-opus-5-5, or gpt-4.1 with OpenAI)
 *   SANDBOX_OPENAI_PRICE_IN / _OUT  USD per million tokens, for the monthly budget (default 2 / 8, the gpt-4.1 prices)
 *   SANDBOX_OPENAI_REASONING=1  for reasoning models (gpt-5, o-series)
 *   SANDBOX_MAX_TURNS agent turns per prompt (default 40)
 *   RUNNER_FAKE=1     test mode: no model call; a fixed small edit is made instead (to test the pipeline at no cost)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { HookCallback, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { openAiAgentTurn } from './openaiAgent.ts';
import { READ_TOOLS, WRITE_TOOLS, decide, isAllowed as allowedIn, isProtected, relInTree as relIn } from './scope.ts';

const SECRET = process.env.RUNNER_SECRET ?? '';
const PORT = Number(process.env.RUNNER_PORT ?? 8095);
const REPO = path.resolve(process.env.REPO_DIR ?? '/data/repo');
const WORK = path.resolve(process.env.WORK_DIR ?? '/data/sessions');
const GH_REPO = process.env.GITHUB_REPO ?? '';
const GH_TOKEN = process.env.GITHUB_TOKEN ?? '';
const BASE = process.env.GITHUB_BASE ?? 'main';
const PROVIDER: 'anthropic' | 'openai' = ((process.env.SANDBOX_PROVIDER ?? '').toLowerCase() as 'anthropic' | 'openai' | '') || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.OPENAI_API_KEY ? 'openai' : 'anthropic');
const MODEL = process.env.SANDBOX_MODEL || (PROVIDER === 'openai' ? 'gpt-4.1' : 'claude-opus-5-5');
const AGENT_NAME = PROVIDER === 'openai' ? 'OpenAI' : 'Claude';
const MAX_TURNS = Number(process.env.SANDBOX_MAX_TURNS ?? 40);
const FAKE = process.env.RUNNER_FAKE === '1';

if (SECRET.length < 24) {
  console.error('[runner] RUNNER_SECRET must be set (24+ characters).');
  process.exit(1);
}

/* ---------------- sessions ---------------- */

type Status = 'preparing' | 'ready' | 'working' | 'building' | 'submitting' | 'submitted' | 'error' | 'closed';

interface Event {
  at: string;
  kind: 'user' | 'agent' | 'tool' | 'info' | 'error';
  text: string;
}

interface Session {
  id: string;
  title: string;
  /** Folders (repository-relative, forward slashes) the agent may change. */
  allowed: string[];
  userName: string;
  /** The requester's own rights (Imago permission keys): the preview shows only what they may open. */
  permissions: string[];
  /** Path the preview is served at by Imago (its private link). */
  previewBase: string;
  status: Status;
  events: Event[];
  costUsd: number;
  agentSessionId: string | null;
  previewReady: boolean;
  prUrl: string | null;
  error: string | null;
  createdAt: string;
}

const sessions = new Map<string, Session>();
const running = new Map<string, AbortController>();

const sdir = (id: string) => path.join(WORK, id);
const tree = (id: string) => path.join(sdir(id), 'repo');
const previewDir = (id: string) => path.join(sdir(id), 'preview');
const now = () => new Date().toISOString();

function save(s: Session) {
  fs.mkdirSync(sdir(s.id), { recursive: true });
  fs.writeFileSync(path.join(sdir(s.id), 'session.json'), JSON.stringify(s));
}
function load() {
  if (!fs.existsSync(WORK)) return;
  for (const id of fs.readdirSync(WORK)) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(WORK, id, 'session.json'), 'utf8')) as Session;
      // A turn interrupted by a restart is not running any more.
      if (s.status === 'working' || s.status === 'building' || s.status === 'preparing' || s.status === 'submitting') s.status = 'ready';
      sessions.set(s.id, s);
    } catch {
      /* not a session */
    }
  }
}
function log(s: Session, kind: Event['kind'], text: string) {
  s.events.push({ at: now(), kind, text: text.slice(0, 4000) });
  if (s.events.length > 2000) s.events.splice(0, s.events.length - 2000);
  save(s);
}

/* ---------------- processes ---------------- */

function run(cmd: string, args: string[], cwd: string, env: Record<string, string | undefined> = {}, timeoutMs = 300_000): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    // A minimal environment: no secrets reach build tools or git (the token is passed in the URL only when needed).
    const base = { PATH: process.env.PATH, HOME: process.env.HOME, TEMP: process.env.TEMP, TMP: process.env.TMP, SystemRoot: process.env.SystemRoot, USERPROFILE: process.env.USERPROFILE };
    const p = spawn(cmd, args, { cwd, env: { ...base, ...env }, shell: false });
    let out = '';
    const take = (b: Buffer) => {
      out += b.toString();
      if (out.length > 200_000) out = out.slice(-200_000);
    };
    p.stdout.on('data', take);
    p.stderr.on('data', take);
    const timer = setTimeout(() => p.kill('SIGKILL'), timeoutMs);
    p.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, out });
    });
    p.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: 1, out: String(e) });
    });
  });
}

/** Build tools are run through Node itself (no shell wrapper): the same on Linux and Windows. */
const VITE = () => [process.execPath, path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js')] as const;
const TSC = () => [process.execPath, path.join(REPO, 'node_modules', 'typescript', 'bin', 'tsc')] as const;

const authedRemote = () => `https://x-access-token:${GH_TOKEN}@github.com/${GH_REPO}.git`;

async function ensureRepo() {
  if (fs.existsSync(path.join(REPO, '.git'))) return;
  if (!GH_REPO || !GH_TOKEN) throw new Error('REPO_DIR has no clone and GITHUB_REPO / GITHUB_TOKEN are not set.');
  fs.mkdirSync(path.dirname(REPO), { recursive: true });
  const c = await run('git', ['clone', '--branch', BASE, authedRemote(), REPO], path.dirname(REPO), {}, 600_000);
  if (c.code) throw new Error(`git clone failed: ${c.out.replace(GH_TOKEN, '***')}`);
  // The token is not kept in the clone's config.
  await run('git', ['remote', 'set-url', 'origin', `https://github.com/${GH_REPO}.git`], REPO);
  const i = await run('npm', ['ci', '--no-audit', '--no-fund'], REPO, {}, 900_000);
  if (i.code) throw new Error(`npm ci failed: ${i.out.slice(-2000)}`);
}

async function refreshRepo() {
  if (GH_TOKEN && GH_REPO) await run('git', ['fetch', authedRemote(), `${BASE}:refs/remotes/origin/${BASE}`], REPO, {}, 120_000);
  // Dependencies follow the base branch.
  const lockChanged = await run('git', ['diff', '--quiet', 'HEAD', `origin/${BASE}`, '--', 'package-lock.json'], REPO);
  if (lockChanged.code) {
    await run('git', ['checkout', '-q', `origin/${BASE}`, '--', 'package.json', 'package-lock.json'], REPO);
    await run('npm', ['ci', '--no-audit', '--no-fund'], REPO, {}, 900_000);
  }
}

/* ---------------- scope (scope.ts) ---------------- */

const isSecret = isProtected;

/** Every tool call goes through here: only file tools, reads inside the copy, writes inside the allowed folders. */
function scopeHook(s: Session): HookCallback {
  return async (input) => {
    if (input.hook_event_name !== 'PreToolUse') return {};
    const d = decide(tree(s.id), s.allowed, input.tool_name, (input.tool_input ?? {}) as Record<string, unknown>);
    if (d.allow) return {};
    log(s, 'info', `Refusé : ${d.reason}`);
    return { hookSpecificOutput: { hookEventName: 'PreToolUse' as const, permissionDecision: 'deny' as const, permissionDecisionReason: d.reason } };
  };
}

/* ---------------- the agent ---------------- */

const SYSTEM_APPEND = (s: Session) => `
You are working in the Imago Sandbox: a private copy of the Imago web app (React 19 + TypeScript + Vite) used by Pubco,
a company in Québec. A person asked for a change; a reviewer will approve it before it reaches the real app.

Rules:
- Change files ONLY inside: ${s.allowed.join(', ')}. Everything else is read-only (you may read it to follow conventions).
- No shell, no network, no new npm packages. Use only what the project already has.
- Follow the existing code: bilingual UI text with t('Français', 'English') from '@/i18n' (French first), existing
  components and CSS classes, CSS variables for colours (light and dark themes).
- Data is demo data in the browser; never add secrets, credentials or calls to outside services.
- Keep the change small and focused on what was asked. If the request is unclear, ask one short question instead.
- When done, explain in 2–4 short sentences, in the person's language (usually French), what you changed and where to see it.
`.trim();

/** The OpenAI agent has no built-in coding prompt, so it gets its tool list and working method here. */
const OPENAI_SYSTEM = (s: Session) => `You are a careful coding agent. You change a React 19 + TypeScript + Vite web app by calling tools:
read_file, list_files, search_text (to explore and read), edit_file and write_file (to change files). You have no shell and no network.
Method: look at similar existing files first, make the smallest change that does what was asked, then re-read what you changed. Prefer edit_file over rewriting a whole file.
${SYSTEM_APPEND(s)}`;

async function agentTurn(s: Session, prompt: string) {
  const ac = new AbortController();
  running.set(s.id, ac);
  s.status = 'working';
  s.error = null;
  log(s, 'user', prompt);
  try {
    if (FAKE) {
      await fakeTurn(s, prompt);
    } else if (PROVIDER === 'openai') {
      if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY n’est pas configurée sur le runner.');
      await openAiAgentTurn({
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, ''),
        model: MODEL,
        maxTurns: MAX_TURNS,
        root: tree(s.id),
        allowed: s.allowed,
        system: OPENAI_SYSTEM(s),
        prompt,
        historyFile: path.join(sdir(s.id), 'openai-history.json'),
        signal: ac.signal,
        priceIn: Number(process.env.SANDBOX_OPENAI_PRICE_IN ?? 2),
        priceOut: Number(process.env.SANDBOX_OPENAI_PRICE_OUT ?? 8),
        reasoning: process.env.SANDBOX_OPENAI_REASONING === '1',
        log: (kind, text) => log(s, kind, text),
        addCost: (usd) => {
          s.costUsd += usd;
          save(s);
        },
      });
    } else {
      const q = query({
        prompt,
        options: {
          cwd: tree(s.id),
          model: MODEL,
          maxTurns: MAX_TURNS,
          resume: s.agentSessionId ?? undefined,
          systemPrompt: { type: 'preset', preset: 'claude_code', append: SYSTEM_APPEND(s) },
          permissionMode: 'dontAsk',
          allowedTools: ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'MultiEdit', 'TodoWrite'],
          disallowedTools: ['Bash', 'WebFetch', 'WebSearch', 'Task', 'NotebookEdit', 'KillShell', 'BashOutput'],
          settingSources: [],
          hooks: { PreToolUse: [{ hooks: [scopeHook(s)] }] },
          // Only what the agent needs: never the GitHub token or the runner secret.
          env: { PATH: process.env.PATH, HOME: process.env.HOME, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY },
          abortController: ac,
        },
      });
      for await (const m of q as AsyncIterable<SDKMessage>) onMessage(s, m);
    }
    await buildPreview(s);
    s.status = 'ready';
  } catch (e) {
    s.status = 'ready';
    s.error = ac.signal.aborted ? null : String(e instanceof Error ? e.message : e);
    log(s, ac.signal.aborted ? 'info' : 'error', ac.signal.aborted ? 'Arrêté.' : `Erreur : ${s.error}`);
  } finally {
    running.delete(s.id);
    save(s);
  }
}

function onMessage(s: Session, m: SDKMessage) {
  if (m.type === 'system' && m.subtype === 'init') {
    s.agentSessionId = m.session_id;
    save(s);
  } else if (m.type === 'assistant') {
    for (const b of m.message.content) {
      if (b.type === 'text' && b.text.trim()) log(s, 'agent', b.text.trim());
      else if (b.type === 'tool_use') {
        const i = b.input as Record<string, unknown>;
        const target = relIn(tree(s.id), i.file_path ?? i.path ?? '') ?? '';
        const verb = WRITE_TOOLS.has(b.name) ? 'Modifie' : READ_TOOLS.has(b.name) ? 'Lit' : b.name;
        if (b.name !== 'TodoWrite') log(s, 'tool', `${verb} ${target || String(i.pattern ?? '')}`.trim());
      }
    }
  } else if (m.type === 'result') {
    s.costUsd += m.total_cost_usd ?? 0;
    if (m.subtype !== 'success') log(s, 'error', `Arrêt de l’agent (${m.subtype}).`);
    save(s);
  }
}

/** Test mode: a fixed, harmless edit inside the first allowed folder, no model call, no cost. */
async function fakeTurn(s: Session, prompt: string) {
  const dir = path.join(tree(s.id), s.allowed[0]);
  const file = path.join(dir, 'SANDBOX_TEST.md');
  log(s, 'tool', `Modifie ${path.relative(tree(s.id), file).split(path.sep).join('/')}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(file, `- ${now()} : ${prompt.replace(/\s+/g, ' ').slice(0, 200)}\n`);
  log(s, 'agent', 'Mode test : aucun appel au modèle. Une note a été ajoutée dans SANDBOX_TEST.md pour vérifier le parcours complet.');
}

/* ---------------- preview, scope check, submit ---------------- */

async function buildPreview(s: Session) {
  s.status = 'building';
  save(s);
  const b = await run(
    VITE()[0],
    [VITE()[1], 'build', '--base', s.previewBase, '--outDir', previewDir(s.id), '--emptyOutDir', '--logLevel', 'error'],
    tree(s.id),
    { VITE_BACKEND: 'browser', VITE_SANDBOX_PREVIEW: '1', VITE_SANDBOX_PERMS: JSON.stringify(s.permissions ?? []), VITE_SANDBOX_USER: s.userName, NODE_ENV: 'production' },
  );
  s.previewReady = b.code === 0;
  if (b.code) log(s, 'error', `L’aperçu ne compile pas :\n${b.out.slice(-1500)}`);
  else injectStorageShim(path.join(previewDir(s.id), 'index.html'));
}

/**
 * The preview is served isolated (CSP sandbox, no same-origin: it can never use anyone's Imago session), where the
 * browser refuses localStorage. The demo backend keeps its data there, so an in-memory store stands in for it: the
 * preview starts from the demo data on every load.
 */
const STORAGE_SHIM = `<script>(function(){function m(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}['localStorage','sessionStorage'].forEach(function(n){try{window[n].getItem('x')}catch(e){try{Object.defineProperty(window,n,{value:m(),configurable:true})}catch(_){}}})})();</script>`;

function injectStorageShim(file: string) {
  try {
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('Object.defineProperty(window,n')) fs.writeFileSync(file, html.replace(/<head>/i, `<head>${STORAGE_SHIM}`));
  } catch {
    /* no preview */
  }
}

async function changedFiles(id: string): Promise<string[]> {
  const t = tree(id);
  const tracked = await run('git', ['diff', '--name-only', `origin/${BASE}`], t);
  const untracked = await run('git', ['ls-files', '--others', '--exclude-standard'], t);
  return [...new Set([...tracked.out.split('\n'), ...untracked.out.split('\n')].map((x) => x.trim()).filter(Boolean))];
}

async function submit(s: Session, summary: string, author: string): Promise<string> {
  const files = await changedFiles(s.id);
  if (!files.length) throw new Error('Aucun changement à soumettre.');
  const outside = files.filter((f) => isSecret(f) || !allowedIn(s.allowed, f));
  if (outside.length) throw new Error(`Changements hors du périmètre permis, refusés : ${outside.join(', ')}`);
  s.status = 'submitting';
  log(s, 'info', 'Vérifications : typage et compilation…');
  const tsc = await run(TSC()[0], [TSC()[1], '--noEmit', '-p', '.'], tree(s.id), {}, 600_000);
  if (tsc.code) throw new Error(`Le typage échoue :\n${tsc.out.slice(-2500)}`);
  const build = await run(VITE()[0], [VITE()[1], 'build', '--outDir', path.join(sdir(s.id), 'check'), '--emptyOutDir', '--logLevel', 'error'], tree(s.id));
  if (build.code) throw new Error(`La compilation échoue :\n${build.out.slice(-2500)}`);
  if (!GH_TOKEN || !GH_REPO) throw new Error('GITHUB_REPO / GITHUB_TOKEN ne sont pas configurés sur le runner.');

  const t = tree(s.id);
  const ident = { GIT_AUTHOR_NAME: `${author} (Sandbox)`, GIT_AUTHOR_EMAIL: 'sandbox@imago.local', GIT_COMMITTER_NAME: 'Imago Sandbox', GIT_COMMITTER_EMAIL: 'sandbox@imago.local' };
  await run('git', ['add', '--', ...files], t);
  const msg = `Sandbox: ${s.title}\n\n${summary}\n\nRequested by ${author} in the Imago Sandbox (request ${s.id}).`;
  const c = await run('git', ['commit', '-m', msg], t, ident);
  if (c.code && !/nothing to commit/.test(c.out)) throw new Error(`git commit : ${c.out.slice(-800)}`);
  const branch = `sandbox/${s.id}`;
  const p = await run('git', ['push', '--force', authedRemote(), `HEAD:refs/heads/${branch}`], t, {}, 180_000);
  if (p.code) throw new Error(`git push : ${p.out.replace(GH_TOKEN, '***').slice(-800)}`);

  const conversation = s.events.filter((e) => e.kind === 'user' || e.kind === 'agent').map((e) => `**${e.kind === 'user' ? author : AGENT_NAME}** : ${e.text}`).join('\n\n');
  const body = `${summary}\n\n**Demandé par :** ${author} · **Coût :** ${s.costUsd.toFixed(2)} $ US · **Fichiers :** ${files.length}\n\n${files.map((f) => `- \`${f}\``).join('\n')}\n\n<details><summary>Conversation</summary>\n\n${conversation.slice(0, 50_000)}\n\n</details>\n\n_Ouverte automatiquement par l’Imago Sandbox. Vérifications passées : périmètre, typage, compilation._`;
  const res = await fetch(`https://api.github.com/repos/${GH_REPO}/pulls`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `Sandbox : ${s.title}`.slice(0, 250), head: branch, base: BASE, body, draft: false }),
  });
  const j = (await res.json()) as { html_url?: string; message?: string; errors?: { message?: string }[] };
  if (res.status === 422 && /already exists/i.test(JSON.stringify(j))) {
    const list = (await (await fetch(`https://api.github.com/repos/${GH_REPO}/pulls?head=${GH_REPO.split('/')[0]}:${branch}&state=open`, { headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' } })).json()) as { html_url: string }[];
    if (list[0]) return list[0].html_url;
  }
  if (!res.ok || !j.html_url) throw new Error(`GitHub : ${j.message ?? res.status}`);
  return j.html_url;
}

async function create(id: string, title: string, allowed: string[], userName: string, permissions: string[], previewBase: string): Promise<Session> {
  const s: Session = { id, title, allowed, userName, permissions, previewBase, status: 'preparing', events: [], costUsd: 0, agentSessionId: null, previewReady: false, prUrl: null, error: null, createdAt: now() };
  sessions.set(id, s);
  save(s);
  void (async () => {
    try {
      await ensureRepo();
      await refreshRepo();
      const w = await run('git', ['worktree', 'add', '-f', '-B', `sandbox/${id}`, tree(id), `origin/${BASE}`], REPO);
      if (w.code) throw new Error(`git worktree : ${w.out.slice(-800)}`);
      fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(tree(id), 'node_modules'), 'junction');
      log(s, 'info', `Copie privée de l’application prête. Dossiers modifiables : ${allowed.join(', ')}.`);
      await buildPreview(s);
      s.status = 'ready';
    } catch (e) {
      s.status = 'error';
      s.error = String(e instanceof Error ? e.message : e);
      log(s, 'error', s.error);
    }
    save(s);
  })();
  return s;
}

async function remove(s: Session) {
  running.get(s.id)?.abort();
  await run('git', ['worktree', 'remove', '--force', tree(s.id)], REPO);
  await run('git', ['branch', '-D', `sandbox/${s.id}`], REPO);
  fs.rmSync(sdir(s.id), { recursive: true, force: true });
  sessions.delete(s.id);
}

/* ---------------- HTTP ---------------- */

const ID_RE = /^[a-z0-9_-]{6,64}$/i;
const FOLDER_RE = /^(src|server)\/[A-Za-z0-9_./-]+$/;
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon' };

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}
async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const c of req) {
    raw += c;
    if (raw.length > 200_000) throw new Error('body too large');
  }
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}
const view = (s: Session, since = 0) => ({ ...s, events: s.events.slice(since), eventCount: s.events.length, agentSessionId: undefined, running: running.has(s.id) });

const server = http.createServer(async (req, res) => {
  try {
    if (req.headers['x-runner-secret'] !== SECRET) return send(res, 401, { error: 'unauthorized' });
    const url = new URL(req.url ?? '/', 'http://runner');
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'health') return send(res, 200, { ok: true, fake: FAKE, provider: PROVIDER, model: MODEL, repo: fs.existsSync(path.join(REPO, '.git')), github: !!(GH_TOKEN && GH_REPO), ai: FAKE || (PROVIDER === 'openai' ? !!process.env.OPENAI_API_KEY : !!process.env.ANTHROPIC_API_KEY), anthropic: FAKE || !!process.env.ANTHROPIC_API_KEY });
    if (parts[0] !== 'sessions') return send(res, 404, { error: 'not_found' });
    const id = parts[1];
    if (req.method === 'POST' && !id) {
      const b = await readBody(req);
      const sid = String(b.id ?? '');
      const allowed = Array.isArray(b.allowed) ? b.allowed.map(String) : [];
      if (!ID_RE.test(sid) || sessions.has(sid)) return send(res, 400, { error: 'invalid id' });
      if (!allowed.length || allowed.some((a) => !FOLDER_RE.test(a) || a.includes('..'))) return send(res, 400, { error: 'invalid folders' });
      const previewBase = String(b.previewBase ?? '');
      if (!/^\/api\/sandbox-preview\/[a-z0-9_]+\/[a-f0-9]{48}\/$/.test(previewBase)) return send(res, 400, { error: 'invalid preview base' });
      const permissions = Array.isArray(b.permissions) ? b.permissions.map(String).filter((p) => /^[A-Za-z0-9_.*:-]{1,80}$/.test(p)).slice(0, 600) : [];
      const s = await create(sid, String(b.title ?? '').slice(0, 200), allowed, String(b.userName ?? '').slice(0, 120), permissions, previewBase);
      return send(res, 201, view(s));
    }
    const s = id && ID_RE.test(id) ? sessions.get(id) : undefined;
    if (!s) return send(res, 404, { error: 'not_found' });

    if (parts[2] === 'preview' && req.method === 'GET') {
      const base = previewDir(s.id);
      const rel = decodeURIComponent(parts.slice(3).join('/')) || 'index.html';
      let file = path.resolve(base, rel);
      if (!file.startsWith(base + path.sep) && file !== base) return send(res, 400, { error: 'bad path' });
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(base, 'index.html'); // single-page app
      if (!fs.existsSync(file)) return send(res, 404, { error: 'no preview yet' });
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      return void fs.createReadStream(file).pipe(res);
    }
    if (req.method === 'GET' && !parts[2]) return send(res, 200, view(s, Number(url.searchParams.get('since') ?? 0) || 0));
    if (req.method === 'POST' && parts[2] === 'prompt') {
      if (running.has(s.id) || !['ready', 'error'].includes(s.status)) return send(res, 409, { error: 'busy' });
      const text = String((await readBody(req)).text ?? '').trim().slice(0, 8000);
      if (!text) return send(res, 400, { error: 'text required' });
      void agentTurn(s, text);
      return send(res, 202, view(s));
    }
    if (req.method === 'POST' && parts[2] === 'stop') {
      running.get(s.id)?.abort();
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && parts[2] === 'submit') {
      if (running.has(s.id) || s.status !== 'ready') return send(res, 409, { error: 'busy' });
      const b = await readBody(req);
      try {
        s.prUrl = await submit(s, String(b.summary ?? '').slice(0, 4000), String(b.author ?? s.userName).slice(0, 120));
        s.status = 'submitted';
        log(s, 'info', `Demande soumise : ${s.prUrl}`);
        return send(res, 200, view(s));
      } catch (e) {
        s.status = 'ready';
        const msg = String(e instanceof Error ? e.message : e);
        log(s, 'error', msg);
        return send(res, 422, { error: msg });
      }
    }
    if (req.method === 'GET' && parts[2] === 'files') return send(res, 200, { files: await changedFiles(s.id) });
    if (req.method === 'DELETE' && !parts[2]) {
      await remove(s);
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'not_found' });
  } catch (e) {
    console.error('[runner]', e);
    send(res, 500, { error: 'runner error' });
  }
});

fs.mkdirSync(WORK, { recursive: true });
load();
server.listen(PORT, () => console.log(`[runner] listening on :${PORT} · model ${MODEL}${FAKE ? ' · TEST MODE (no model calls)' : ''}`));
