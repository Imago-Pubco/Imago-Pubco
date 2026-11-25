/**
 * The Sandbox agent's file scope, decided for every tool call (runner.ts wires it into a PreToolUse hook):
 *   - only the file tools are available (no shell, no web, no sub-agents);
 *   - reading and searching stay inside the private copy of the app, never in protected files;
 *   - writing only inside the folders the request allows.
 * Pure: no I/O, so it can be tested on its own (scope.test.ts).
 */
import path from 'node:path';

/** Never readable or writable by the agent, whatever the request. */
const PROTECTED = [/(^|\/)\.env(\.|$)/i, /(^|\/)\.git(\/|$)/, /(^|\/)node_modules(\/|$)/, /\.(pem|key|p12|pfx|crt)$/i, /(^|\/)id_(rsa|ed25519)/i];

export const READ_TOOLS = new Set(['Read', 'Glob', 'Grep']);
export const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);

/** A path inside the copy, relative with forward slashes; null when it leaves the copy. */
export function relInTree(root: string, p: unknown): string | null {
  if (typeof p !== 'string' || !p) return null;
  const abs = path.resolve(root, p);
  const rel = path.relative(root, abs);
  if (rel === '..' || rel.startsWith('..' + path.sep) || rel.startsWith('../') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

export const isProtected = (rel: string) => PROTECTED.some((r) => r.test(rel));
export const isAllowed = (allowed: string[], rel: string) => allowed.some((a) => rel === a || rel.startsWith(a.replace(/\/?$/, '/')));

/** A search pattern may not point outside the copy (absolute, ~ or ..). */
const badPattern = (v: unknown) => typeof v === 'string' && (path.isAbsolute(v) || /^[A-Za-z]:/.test(v) || v.startsWith('~') || /(^|[\\/])\.\.([\\/]|$)/.test(v));

export type Decision = { allow: true } | { allow: false; reason: string };

export function decide(root: string, allowed: string[], tool: string, input: Record<string, unknown>): Decision {
  const no = (reason: string): Decision => ({ allow: false, reason });
  if (tool === 'TodoWrite') return { allow: true };
  if (READ_TOOLS.has(tool)) {
    if (badPattern(input.pattern) || badPattern(input.glob)) return no('search patterns must stay inside the copy of the app');
    const rel = relInTree(root, input.file_path ?? input.path ?? '.');
    if (rel === null) return no('reading outside the copy of the app is not allowed');
    if (isProtected(rel)) return no(`${rel} is protected`);
    return { allow: true };
  }
  if (WRITE_TOOLS.has(tool)) {
    const rel = relInTree(root, input.file_path);
    if (rel === null) return no('writing outside the copy of the app is not allowed');
    if (isProtected(rel)) return no(`${rel} is protected`);
    if (!isAllowed(allowed, rel)) return no(`${rel} is outside the folders this request may change (${allowed.join(', ')})`);
    return { allow: true };
  }
  return no(`the tool ${tool} is not available in the Sandbox`);
}
