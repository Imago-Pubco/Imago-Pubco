// Tests of the OpenAI agent's tools and loop (openaiAgent.ts), with a fake OpenAI endpoint. Run: node openaiAgent.test.ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { globToRegex, openAiAgentTurn, runTool } from './openaiAgent.ts';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, extra = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + extra}`);
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-agent-'));
const root = path.join(tmp, 'repo');
const outside = path.join(tmp, 'outside');
const write = (rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};
write('src/modules/align/a.tsx', 'const a = 1;\nconst b = 2;\nexport const x = a + b;\n');
write('src/modules/accounting/secret.ts', 'export const other = true;\n');
write('.env', 'KEY=top-secret\n');
write('node_modules/lib/index.js', 'module.exports = 1;\n');
fs.mkdirSync(outside, { recursive: true });
fs.writeFileSync(path.join(outside, 'host-file.txt'), 'host secret');
const allowed = ['src/modules/align'];

// globs
check('glob **/*.tsx matches nested', globToRegex('src/**/*.tsx').test('src/modules/align/a.tsx'));
check('glob * does not cross folders', !globToRegex('src/*.tsx').test('src/modules/align/a.tsx'));
check('glob {a,b}', globToRegex('*.{ts,tsx}').test('x.tsx') && !globToRegex('*.{ts,tsx}').test('x.js'));

// reads
let r = runTool(root, allowed, 'read_file', { path: 'src/modules/align/a.tsx' });
check('read allowed file (numbered)', r.text.startsWith('1\tconst a = 1;'), r.text);
r = runTool(root, allowed, 'read_file', { path: 'src/modules/accounting/secret.ts' });
check('read other module is fine (read-only)', r.text.includes('other'), r.text);
for (const bad of ['.env', '../outside/host-file.txt', '/etc/passwd', 'node_modules/lib/index.js']) {
  r = runTool(root, allowed, 'read_file', { path: bad });
  check(`read ${bad} refused`, !!r.refused, r.text);
}

// listing and search skip protected files and node_modules
r = runTool(root, allowed, 'list_files', { pattern: '**/*' });
check('list hides .env and node_modules', !r.text.includes('.env') && !r.text.includes('node_modules') && r.text.includes('a.tsx'), r.text);
r = runTool(root, allowed, 'list_files', { pattern: '../**/*' });
check('list with .. refused', !!r.refused, r.text);
r = runTool(root, allowed, 'search_text', { pattern: 'top-secret' });
check('search never finds .env content', r.text === '(no match)', r.text);
r = runTool(root, allowed, 'search_text', { pattern: 'a \\+ b', glob: '*.tsx' });
check('search finds code', r.text.includes('a.tsx:3'), r.text);

// writes
r = runTool(root, allowed, 'edit_file', { path: 'src/modules/align/a.tsx', old_string: 'const b = 2;', new_string: 'const b = 3;' });
check('edit allowed file', !r.refused && fs.readFileSync(path.join(root, 'src/modules/align/a.tsx'), 'utf8').includes('const b = 3;'), r.text);
r = runTool(root, allowed, 'edit_file', { path: 'src/modules/align/a.tsx', old_string: 'const', new_string: 'let' });
check('ambiguous edit is rejected (not applied)', r.text.includes('appears') && !fs.readFileSync(path.join(root, 'src/modules/align/a.tsx'), 'utf8').includes('let a'), r.text);
r = runTool(root, allowed, 'write_file', { path: 'src/modules/align/new/Thing.tsx', content: 'export {};\n' });
check('write new file in allowed folder', fs.existsSync(path.join(root, 'src/modules/align/new/Thing.tsx')), r.text);
for (const bad of ['src/modules/accounting/secret.ts', 'server/api.ts', 'src/modules/align-evil/x.ts', 'src/modules/align/.env', '../outside/pwned.txt', 'src/modules/align/../../../server/x.ts']) {
  r = runTool(root, allowed, 'write_file', { path: bad, content: 'x' });
  check(`write ${bad} refused`, !!r.refused, r.text);
}
check('nothing was written outside', !fs.existsSync(path.join(outside, 'pwned.txt')) && !fs.existsSync(path.join(root, 'server')));
for (const tool of ['bash', 'run_shell', 'fetch_url']) {
  r = runTool(root, allowed, tool, { command: 'ls' });
  check(`${tool} refused`, !!r.refused, r.text);
}

// symlink out of the copy (skipped when the OS does not allow creating one)
try {
  fs.symlinkSync(outside, path.join(root, 'src/modules/align/link'), process.platform === 'win32' ? 'junction' : 'dir');
  r = runTool(root, allowed, 'read_file', { path: 'src/modules/align/link/host-file.txt' });
  check('read through a symlink out of the copy refused', !!r.refused || r.text.startsWith('Error'), r.text);
  r = runTool(root, allowed, 'write_file', { path: 'src/modules/align/link/pwned.txt', content: 'x' });
  check('write through a symlink out of the copy refused', !!r.refused && !fs.existsSync(path.join(outside, 'pwned.txt')), r.text);
  r = runTool(root, allowed, 'list_files', { pattern: '**/*' });
  check('listing does not follow symlinks', !r.text.includes('host-file'), r.text);
} catch (e) {
  console.log('SKIP  symlink tests (cannot create symlinks here):', (e as Error).message);
}

// the loop against a fake OpenAI endpoint: the "model" tries to read .env, then edits an allowed file, then answers
let calls = 0;
const bodies: Record<string, unknown>[] = [];
const server = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => {
    bodies.push(JSON.parse(b));
    calls++;
    const out =
      calls === 1
        ? [
            { type: 'function_call', call_id: 'c1', name: 'read_file', arguments: JSON.stringify({ path: '.env' }) },
            { type: 'function_call', call_id: 'c2', name: 'edit_file', arguments: JSON.stringify({ path: 'src/modules/align/a.tsx', old_string: 'export const x = a + b;', new_string: 'export const x = a * b;' }) },
          ]
        : [{ type: 'message', content: [{ type: 'output_text', text: 'Termine : x multiplie maintenant a et b.' }] }];
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ output: out, usage: { input_tokens: 1000, output_tokens: 200 } }));
  });
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as { port: number }).port;
const events: string[] = [];
let cost = 0;
const historyFile = path.join(tmp, 'history.json');
await openAiAgentTurn({
  apiKey: 'test-key', baseUrl: `http://127.0.0.1:${port}`, model: 'gpt-4.1', maxTurns: 5, root, allowed, system: 'sys', prompt: 'multiplie',
  historyFile, priceIn: 2, priceOut: 8, reasoning: false,
  log: (k, t) => events.push(`${k}: ${t}`), addCost: (u) => (cost += u),
});
check('loop: two model calls', calls === 2, String(calls));
check('loop: .env read was refused and logged', events.some((e) => e.startsWith('info: Refus')), events.join(' | '));
check('loop: allowed edit applied', fs.readFileSync(path.join(root, 'src/modules/align/a.tsx'), 'utf8').includes('a * b'));
check('loop: final answer logged', events.some((e) => e.startsWith('agent: Termine')), events.join(' | '));
check('loop: cost = tokens x price', Math.abs(cost - (2 * (1000 * 2 + 200 * 8)) / 1e6) < 1e-9, String(cost));
const second = bodies[1] as { input: Record<string, unknown>[]; store: boolean };
check('loop: tool outputs sent back, store off', second.store === false && second.input.some((i) => i.type === 'function_call_output' && String(i.output).startsWith('Refused')), JSON.stringify(second.input).slice(0, 300));
check('loop: .env content never sent to the model', !JSON.stringify(bodies).includes('top-secret'));
check('loop: history saved for the next prompt', fs.existsSync(historyFile));
calls = 5; // next turn: the model just answers
await openAiAgentTurn({ apiKey: 'k', baseUrl: `http://127.0.0.1:${port}`, model: 'gpt-4.1', maxTurns: 3, root, allowed, system: 's', prompt: 'merci', historyFile, priceIn: 2, priceOut: 8, reasoning: false, log: () => {}, addCost: () => {} });
const third = bodies[bodies.length - 1] as { input: Record<string, unknown>[] };
check('next prompt continues the same conversation', third.input.some((i) => i.content === 'multiplie') && third.input.some((i) => i.content === 'merci'), JSON.stringify(third.input).slice(0, 200));
server.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
