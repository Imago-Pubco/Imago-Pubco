/**
 * The Sandbox agent on OpenAI (Responses API, plain fetch, no SDK): a small tool loop over the private copy of the app.
 * Same guarantees as the Claude agent: file tools only (no shell, no network, no sub-agents), and every call is decided
 * by scope.ts — reads stay inside the copy and out of protected files, writes only in the folders the request allows.
 * Symlinks are never followed out of the copy. Pure Node, so it can be tested on its own (openaiAgent.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { decide, isProtected, relInTree } from './scope.ts';

export interface OpenAiAgentOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTurns: number;
  /** The private copy of the app. */
  root: string;
  /** Folders (repository-relative) the agent may change. */
  allowed: string[];
  system: string;
  prompt: string;
  /** Conversation memory of this request, so the next prompt continues the same work. */
  historyFile: string;
  signal?: AbortSignal;
  /** USD per million tokens, for the budget. */
  priceIn: number;
  priceOut: number;
  /** Reasoning models need their encrypted reasoning items passed back (store is off). */
  reasoning: boolean;
  log: (kind: 'agent' | 'tool' | 'info' | 'error', text: string) => void;
  addCost: (usd: number) => void;
}

type Item = Record<string, unknown>;

const MAX_FILE = 400_000;
const MAX_OUT = 20_000;
const HISTORY_CAP = 700_000;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist']);

export const TOOLS = [
  {
    type: 'function',
    name: 'read_file',
    description: 'Read a text file of the app (numbered lines). Use offset/limit for long files.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, offset: { type: 'integer' }, limit: { type: 'integer' } }, required: ['path'], additionalProperties: false },
  },
  {
    type: 'function',
    name: 'list_files',
    description: 'List files matching a glob pattern (supports **, *, ?, {a,b}), e.g. "src/modules/align/**/*.tsx". Returns up to 200 paths.',
    parameters: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string', description: 'Directory to search in (default: the whole app).' } }, required: ['pattern'], additionalProperties: false },
  },
  {
    type: 'function',
    name: 'search_text',
    description: 'Search file contents with a regular expression. Returns up to 100 matching lines as path:line: text.',
    parameters: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' }, glob: { type: 'string', description: 'Only files matching this glob.' } }, required: ['pattern'], additionalProperties: false },
  },
  {
    type: 'function',
    name: 'edit_file',
    description: 'Replace text in a file. old_string must match exactly and be unique unless replace_all is true.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' }, replace_all: { type: 'boolean' } }, required: ['path', 'old_string', 'new_string'], additionalProperties: false },
  },
  {
    type: 'function',
    name: 'write_file',
    description: 'Create a file, or replace it completely.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'], additionalProperties: false },
  },
] as const;

/* ---------------- files ---------------- */

/** True when `abs` (an existing path) really lives inside `root` once symlinks are resolved. */
function realInside(root: string, abs: string): boolean {
  try {
    const r = fs.realpathSync(root);
    const p = fs.realpathSync(abs);
    return p === r || p.startsWith(r + path.sep);
  } catch {
    return false;
  }
}

/** For a file that may not exist yet: its nearest existing parent must be inside the copy. */
function parentInside(root: string, abs: string): boolean {
  let d = path.dirname(abs);
  while (!fs.existsSync(d)) {
    const up = path.dirname(d);
    if (up === d) return false;
    d = up;
  }
  return realInside(root, d);
}

function* walk(root: string, dirAbs: string): Generator<string> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    const abs = path.join(dirAbs, e.name);
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(root, abs);
    } else if (e.isFile() && !isProtected(rel)) yield rel;
  }
}

/** A small glob: ** crosses folders, * and ? stay in one, {a,b} alternatives. */
export function globToRegex(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end > i) {
        re += '(?:' + glob.slice(i + 1, end).split(',').map((x) => x.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|') + ')';
        i = end;
      } else re += '\\{';
    } else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

const cap = (s: string) => (s.length > MAX_OUT ? s.slice(0, MAX_OUT) + '\n… (truncated)' : s);

/* ---------------- tools ---------------- */

export interface ToolResult {
  text: string;
  /** Short line for the activity log, or '' to log nothing. */
  note: string;
  refused?: boolean;
}

/** Runs one tool call. Everything the model asks goes through scope.ts first. */
export function runTool(root: string, allowed: string[], name: string, input: Record<string, unknown>): ToolResult {
  const refuse = (reason: string): ToolResult => ({ text: `Refused: ${reason}`, note: `Refusé : ${reason}`, refused: true });
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  try {
    if (name === 'read_file') {
      const d = decide(root, allowed, 'Read', { file_path: input.path });
      if (!d.allow) return refuse(d.reason);
      const rel = relInTree(root, input.path)!;
      const abs = path.join(root, rel);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return { text: `Error: ${rel} is not a file`, note: '' };
      if (!realInside(root, abs)) return refuse('reading outside the copy of the app is not allowed');
      if (fs.statSync(abs).size > MAX_FILE) return { text: 'Error: file too large to read', note: '' };
      const lines = fs.readFileSync(abs, 'utf8').split('\n');
      const off = Math.max(0, Math.floor(Number(input.offset) || 0));
      const lim = Math.min(800, Math.max(1, Math.floor(Number(input.limit) || 500)));
      const out = lines.slice(off, off + lim).map((l, i) => `${off + i + 1}\t${l}`).join('\n');
      return { text: cap(out || '(empty)'), note: `Lit ${rel}` };
    }

    if (name === 'list_files') {
      const d = decide(root, allowed, 'Glob', { pattern: input.pattern, path: input.path });
      if (!d.allow) return refuse(d.reason);
      const baseRel = relInTree(root, input.path ?? '.') ?? '';
      const base = path.join(root, baseRel);
      if (!fs.existsSync(base) || !realInside(root, base)) return { text: 'Error: directory not found', note: '' };
      const re = globToRegex(str(input.pattern) || '**/*');
      const out: string[] = [];
      for (const rel of walk(root, base)) {
        const sub = baseRel ? rel.slice(baseRel.length + 1) : rel;
        if (re.test(sub) || re.test(rel)) out.push(rel);
        if (out.length >= 200) break;
      }
      return { text: out.join('\n') || '(no files)', note: '' };
    }

    if (name === 'search_text') {
      const d = decide(root, allowed, 'Grep', { path: input.path, glob: input.glob });
      if (!d.allow) return refuse(d.reason);
      let re: RegExp;
      try {
        re = new RegExp(str(input.pattern).slice(0, 300));
      } catch {
        return { text: 'Error: invalid regular expression', note: '' };
      }
      const baseRel = relInTree(root, input.path ?? '.') ?? '';
      const base = path.join(root, baseRel);
      if (!fs.existsSync(base) || !realInside(root, base)) return { text: 'Error: directory not found', note: '' };
      const gre = input.glob ? globToRegex(str(input.glob)) : null;
      const hits: string[] = [];
      outer: for (const rel of walk(root, base)) {
        if (gre && !gre.test(rel) && !gre.test(path.posix.basename(rel))) continue;
        const abs = path.join(root, rel);
        if (fs.statSync(abs).size > MAX_FILE) continue;
        const text = fs.readFileSync(abs, 'utf8');
        if (text.includes('\0')) continue;
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (re.test(lines[i]!)) {
            hits.push(`${rel}:${i + 1}: ${lines[i]!.trim().slice(0, 200)}`);
            if (hits.length >= 100) break outer;
          }
        }
      }
      return { text: hits.join('\n') || '(no match)', note: '' };
    }

    if (name === 'edit_file' || name === 'write_file') {
      const d = decide(root, allowed, name === 'edit_file' ? 'Edit' : 'Write', { file_path: input.path });
      if (!d.allow) return refuse(d.reason);
      const rel = relInTree(root, input.path)!;
      const abs = path.join(root, rel);
      if (!parentInside(root, abs) || (fs.existsSync(abs) && !realInside(root, abs))) return refuse('writing outside the copy of the app is not allowed');
      if (name === 'write_file') {
        const content = str(input.content);
        if (content.length > 300_000) return { text: 'Error: file too large', note: '' };
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
        return { text: `Wrote ${rel} (${content.length} characters)`, note: `Modifie ${rel}` };
      }
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return { text: `Error: ${rel} does not exist`, note: '' };
      const before = fs.readFileSync(abs, 'utf8');
      const oldS = str(input.old_string);
      if (!oldS) return { text: 'Error: old_string is empty', note: '' };
      const count = before.split(oldS).length - 1;
      if (count === 0) return { text: 'Error: old_string was not found (it must match exactly, including whitespace)', note: '' };
      if (count > 1 && input.replace_all !== true) return { text: `Error: old_string appears ${count} times; add more context or set replace_all`, note: '' };
      const after = input.replace_all === true ? before.split(oldS).join(str(input.new_string)) : before.replace(oldS, () => str(input.new_string));
      fs.writeFileSync(abs, after);
      return { text: `Edited ${rel}`, note: `Modifie ${rel}` };
    }

    return refuse(`the tool ${name} is not available in the Sandbox`);
  } catch (e) {
    return { text: `Error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500), note: '' };
  }
}

/* ---------------- history ---------------- */

function loadHistory(file: string): Item[][] {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    return Array.isArray(v) ? (v as Item[][]) : [];
  } catch {
    return [];
  }
}

function saveHistory(file: string, turns: Item[][]) {
  // Drop the oldest whole turns (never half of a call/output pair) once the memory gets too large.
  while (turns.length > 1 && JSON.stringify(turns).length > HISTORY_CAP) turns.shift();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(turns));
}

/* ---------------- the loop ---------------- */

interface ApiResponse {
  output?: Item[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

export async function openAiAgentTurn(o: OpenAiAgentOptions): Promise<void> {
  const history = loadHistory(o.historyFile);
  const turn: Item[] = [{ role: 'user', content: o.prompt }];
  const input = (): Item[] => [...history.flat(), ...turn];

  for (let step = 0; step < o.maxTurns; step++) {
    const res = await fetch(`${o.baseUrl}/responses`, {
      method: 'POST',
      signal: o.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${o.apiKey}` },
      body: JSON.stringify({
        model: o.model,
        store: false,
        instructions: o.system,
        input: input(),
        tools: TOOLS,
        max_output_tokens: 8000,
        ...(o.reasoning ? { include: ['reasoning.encrypted_content'] } : {}),
      }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`);
    const json = JSON.parse(body) as ApiResponse;
    o.addCost(((json.usage?.input_tokens ?? 0) * o.priceIn + (json.usage?.output_tokens ?? 0) * o.priceOut) / 1e6);

    const out = json.output ?? [];
    turn.push(...out);
    const calls = out.filter((x) => x.type === 'function_call');
    for (const m of out.filter((x) => x.type === 'message')) {
      for (const c of (m.content as { type: string; text?: string }[] | undefined) ?? []) {
        if (c.type === 'output_text' && c.text?.trim()) o.log('agent', c.text.trim());
      }
    }
    if (!calls.length) break;

    for (const c of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(String(c.arguments || '{}')) as Record<string, unknown>;
      } catch {
        /* malformed arguments: the tool reports the missing fields */
      }
      const r = runTool(o.root, o.allowed, String(c.name), args);
      if (r.note) o.log(r.refused ? 'info' : 'tool', r.note);
      turn.push({ type: 'function_call_output', call_id: c.call_id, output: r.text });
    }
    if (step === o.maxTurns - 1) o.log('info', `Limite de ${o.maxTurns} étapes atteinte pour cette demande.`);
  }
  saveHistory(o.historyFile, [...history, turn]);
}
