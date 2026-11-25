// Tests of the agent's file scope (scope.ts). Run: node scope.test.ts
import path from 'node:path';
import { decide } from './scope.ts';

const root = path.resolve('/data/sessions/sbx_test/repo');
const allowed = ['src/modules/align'];
let pass = 0;
let fail = 0;
const expect = (name: string, tool: string, input: Record<string, unknown>, allow: boolean) => {
  const d = decide(root, allowed, tool, input);
  if (d.allow === allow) pass++;
  else fail++;
  console.log(`${d.allow === allow ? 'PASS' : 'FAIL'}  ${name}${d.allow === allow ? '' : `  → ${JSON.stringify(d)}`}`);
};
const at = (rel: string) => path.join(root, rel);

expect('read a file of the app', 'Read', { file_path: at('src/modules/accounting/index.tsx') }, true);
expect('read server code (read-only is fine)', 'Read', { file_path: at('server/api.ts') }, true);
expect('read outside the copy', 'Read', { file_path: '/etc/passwd' }, false);
expect('read with ..', 'Read', { file_path: at('../../other/repo/file') }, false);
expect('read .env', 'Read', { file_path: at('.env') }, false);
expect('read .env.production', 'Read', { file_path: at('.env.production') }, false);
expect('read inside .git', 'Read', { file_path: at('.git/config') }, false);
expect('read node_modules', 'Read', { file_path: at('node_modules/x/index.js') }, false);
expect('read a key file', 'Read', { file_path: at('certs/server.pem') }, false);
expect('glob in the copy', 'Glob', { pattern: 'src/**/*.tsx' }, true);
expect('glob with absolute pattern', 'Glob', { pattern: '/etc/*' }, false);
expect('glob with ..', 'Glob', { pattern: '../**/*' }, false);
expect('glob with a Windows drive', 'Glob', { pattern: 'C:/Users/*' }, false);
expect('glob in a path outside', 'Glob', { pattern: '*', path: '/home' }, false);
expect('grep in the copy', 'Grep', { pattern: 'useI18n', path: at('src') }, true);
expect('grep with outside glob', 'Grep', { pattern: 'x', glob: '../../*' }, false);
expect('edit an allowed file', 'Edit', { file_path: at('src/modules/align/pages/Dashboard.tsx') }, true);
expect('write a new allowed file', 'Write', { file_path: at('src/modules/align/new/Thing.tsx') }, true);
expect('edit another module', 'Edit', { file_path: at('src/modules/accounting/index.tsx') }, false);
expect('edit server rules', 'Edit', { file_path: at('server/alignGuard.ts') }, false);
expect('edit a look-alike folder', 'Write', { file_path: at('src/modules/align-evil/x.ts') }, false);
expect('edit escaping with ..', 'Edit', { file_path: at('src/modules/align/../../../server/api.ts') }, false);
expect('write .env inside allowed folder', 'Write', { file_path: at('src/modules/align/.env') }, false);
expect('multiedit allowed', 'MultiEdit', { file_path: at('src/modules/align/lib.ts') }, true);
expect('bash refused', 'Bash', { command: 'ls' }, false);
expect('web fetch refused', 'WebFetch', { url: 'https://example.com' }, false);
expect('sub-agent refused', 'Task', {}, false);
expect('unknown tool refused', 'SomethingNew', {}, false);
expect('todo list allowed', 'TodoWrite', {}, true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
