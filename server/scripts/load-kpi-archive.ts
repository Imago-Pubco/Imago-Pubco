/**
 * Loads the archived Align export into the server's hidden archive store (meta key `kpi.archive`).
 * The archive is NOT part of the repository and is never served by the app: an administrator copies the JSON file(s) to the
 * server and runs this once. Afterwards "Import old data" in Tools -> KPI -> Settings can populate the KPI section from it.
 *
 *   dev:   node --env-file=.env server/scripts/load-kpi-archive.ts part1.json [part2.json ...] [--save-merged merged.json]
 *   prod:  docker compose cp archive.json app:/tmp/archive.json
 *          docker compose exec app node server/scripts/load-kpi-archive.ts /tmp/archive.json
 *
 * Several part files are merged (people, teams, metrics, priorities and huddles are de-duplicated by name).
 */
import fs from 'node:fs';
import { AlignArchiveSchema, type AlignArchive } from '../../src/modules/tools/archive.ts';
import { pool } from '../db.ts';
import { loadArchive } from '../kpiData.ts';

const args = process.argv.slice(2);
const saveAt = args.indexOf('--save-merged');
const out = saveAt >= 0 ? args.splice(saveAt, 2)[1] : undefined;
if (!args.length) {
  console.error('usage: node --env-file=.env server/scripts/load-kpi-archive.ts <file.json> [more parts...] [--save-merged merged.json]');
  process.exit(2);
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const key = (s: string) => fold(s).split(' ').sort().join(' ');

const parts = args.map((f) => AlignArchiveSchema.parse(JSON.parse(fs.readFileSync(f, 'utf8'))));
const merged: AlignArchive = {
  source: 'Align',
  company: parts.find((p) => p.company)?.company ?? '',
  exportedAt: parts.map((p) => p.exportedAt).sort().at(-1) ?? new Date().toISOString(),
  people: [],
  teams: [],
  criticalNumbers: [],
  metrics: [],
  priorities: [],
  huddles: [],
};
const people = new Map<string, AlignArchive['people'][number]>();
const teams = new Map<string, AlignArchive['teams'][number]>();
const metrics = new Map<string, AlignArchive['metrics'][number]>();
const priorities = new Map<string, AlignArchive['priorities'][number]>();
const huddles = new Map<string, AlignArchive['huddles'][number]>();
for (const p of parts) {
  for (const x of p.people) people.set(key(x.name), { ...people.get(key(x.name)), ...x });
  for (const t of p.teams) {
    const old = teams.get(fold(t.name));
    teams.set(fold(t.name), old ? { ...old, members: [...new Set([...old.members, ...t.members])] } : t);
  }
  for (const n of p.criticalNumbers) if (!merged.criticalNumbers.some((c) => fold(c) === fold(n))) merged.criticalNumbers.push(n);
  for (const m of p.metrics) metrics.set(fold(m.name), m);
  for (const x of p.priorities) priorities.set(fold(x.title) + '|' + (x.periodStart ?? ''), x);
  for (const h of p.huddles) {
    const old = huddles.get(fold(h.name));
    huddles.set(fold(h.name), old ? { ...old, ...h, items: [...old.items, ...h.items], entries: [...old.entries, ...h.entries], tasks: [...old.tasks, ...h.tasks] } : h);
  }
}
merged.people = [...people.values()];
merged.teams = [...teams.values()];
merged.metrics = [...metrics.values()];
merged.priorities = [...priorities.values()];
merged.huddles = [...huddles.values()];

const archive = await loadArchive(merged);
if (out) fs.writeFileSync(out, JSON.stringify(archive, null, 1));
console.log('Archive stored (hidden from the app):', {
  company: archive.company,
  people: archive.people.length,
  teams: archive.teams.length,
  metrics: archive.metrics.length,
  priorities: archive.priorities.length,
  huddles: archive.huddles.length,
});
await pool.end();
