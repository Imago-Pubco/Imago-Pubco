/**
 * Align data management (Administration → Modules → Align), like the KPI tool's:
 *   - snapshots: up to 3 full copies of the six align.* collections (meta keys align.snapshot.1..3)
 *   - restore: from a snapshot, or from the automatic backup taken before the last KPI import (meta align.backup)
 *   - archive: reload the strategy, the 40-point checklist and/or the quarter's Rocks captured from Align (archive.ts)
 *   - erase: empty the six collections (snapshots and backup are kept)
 * Every replacement runs in ONE transaction and every document is validated against the schemas first (all or nothing).
 */
import type { PoolClient } from 'pg';
import type { ZodObject } from 'zod';
import { ARCHIVE_CHECKLIST, ARCHIVE_ROCKS, ARCHIVE_STRATEGY, ALIGN_ARCHIVE_DATE } from '../src/modules/align/archive.ts';
import { ALIGN_SCHEMAS } from '../src/modules/align/schemas.ts';
import type { User } from '../src/data/types.ts';
import * as db from './db.ts';
import { broadcast } from './events.ts';
import { HttpError } from './ms.ts';

export const ALIGN_COLLECTIONS = Object.keys(ALIGN_SCHEMAS) as (keyof typeof ALIGN_SCHEMAS)[];
const SLOTS = [1, 2, 3] as const;
type Data = Record<string, Record<string, unknown>[]>;

interface Snapshot {
  slot: number;
  name: string;
  at: string;
  by: string;
  counts: Record<string, number>;
  data: Data;
}

const counts = (data: Data) => Object.fromEntries(ALIGN_COLLECTIONS.map((c) => [c, (data[c] ?? []).length]));

async function readAll(): Promise<Data> {
  const data: Data = {};
  for (const c of ALIGN_COLLECTIONS) data[c] = await db.listDocs<Record<string, unknown> & db.Doc>(c);
  return data;
}

/** Replaces the given collections atomically, after validating every document. */
async function replace(data: Data, only: readonly string[] = ALIGN_COLLECTIONS) {
  const bad: string[] = [];
  for (const c of only) {
    const schema = (ALIGN_SCHEMAS as Record<string, ZodObject>)[c];
    for (const doc of data[c] ?? []) if (typeof doc.id !== 'string' || !schema.safeParse(doc).success) bad.push(`${c}:${String(doc.id)}`);
  }
  if (bad.length) throw new HttpError(400, `Invalid data, nothing was changed (${bad.length}: ${bad.slice(0, 5).join(', ')}).`);
  const client: PoolClient = await db.pool.connect();
  try {
    await client.query('begin');
    for (const c of only) {
      await client.query('delete from docs where collection = $1', [c]);
      for (const doc of data[c] ?? []) {
        await client.query('insert into docs (collection, id, data) values ($1, $2, $3) on conflict (collection, id) do nothing', [c, doc.id, doc]);
      }
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
  for (const c of only) broadcast(c);
}

export async function alignDataStatus() {
  const current = await readAll();
  const snapshots = [];
  for (const slot of SLOTS) {
    const s = await db.getMeta<Snapshot>(`align.snapshot.${slot}`);
    snapshots.push(s ? { slot, name: s.name, at: s.at, by: s.by, counts: s.counts } : { slot, empty: true });
  }
  const backup = await db.getMeta<Record<string, unknown> & { at: string; by: string }>('align.backup');
  return {
    counts: counts(current),
    snapshots,
    backup: backup ? { at: backup.at, by: backup.by, counts: counts(backup as unknown as Data) } : null,
    archive: { date: ALIGN_ARCHIVE_DATE, rocks: ARCHIVE_ROCKS.length, checklist: ARCHIVE_CHECKLIST.length },
  };
}

/** Takes a snapshot in the first free slot; when all are used, `overwrite` must be true and the oldest is replaced. */
export async function takeAlignSnapshot(userId: string, overwrite: boolean) {
  const existing: (Snapshot | undefined)[] = [];
  for (const slot of SLOTS) existing.push(await db.getMeta<Snapshot>(`align.snapshot.${slot}`));
  let slot = SLOTS.find((_, i) => !existing[i]);
  if (!slot) {
    const oldest = existing.map((s, i) => ({ s: s!, slot: SLOTS[i] })).sort((a, b) => a.s.at.localeCompare(b.s.at))[0];
    if (!overwrite) {
      const e = new HttpError(409, `All snapshot slots are used: the oldest ("${oldest.s.name}") would be overwritten.`);
      Object.assign(e, { overwrite: { slot: oldest.slot, name: oldest.s.name, at: oldest.s.at } });
      throw e;
    }
    slot = oldest.slot;
  }
  const data = await readAll();
  const at = new Date().toISOString();
  const snap: Snapshot = { slot, name: `Instantané ${at.slice(0, 16).replace('T', ' ')}`, at, by: userId, counts: counts(data), data };
  await db.setMeta(`align.snapshot.${slot}`, snap);
  return { slot, name: snap.name, counts: snap.counts };
}

export async function restoreAlign(source: { kind: 'snapshot'; slot: number } | { kind: 'backup' }) {
  if (source.kind === 'snapshot') {
    const snap = await db.getMeta<Snapshot>(`align.snapshot.${source.slot}`);
    if (!snap) throw new HttpError(404, 'This snapshot slot is empty.');
    await replace(snap.data);
    return counts(snap.data);
  }
  const backup = await db.getMeta<Data>('align.backup');
  if (!backup) throw new HttpError(404, 'No backup: no KPI import was run yet.');
  // The backup holds what the last import replaced: rocks, priorities, notes and huddles.
  const only = ['align.rocks', 'align.priorities', 'align.notes', 'align.huddles'];
  await replace(backup, only);
  return counts(backup);
}

/** Current quarter, e.g. 2026-Q4 (lib.ts is not imported: it has extension-less imports Node cannot load). */
const quarterOf = (d = new Date()) => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Reloads parts of the Align archive. Rocks are added for the current quarter only when no Rock has the same title. */
export async function reloadAlignArchive(userId: string, parts: { strategy?: boolean; checklist?: boolean; rocks?: boolean }) {
  const stamp = new Date().toISOString();
  const stamped = <T extends object>(d: T) => ({ ...d, createdBy: userId, createdAt: stamp, updatedBy: userId, updatedAt: stamp });
  const data: Data = {};
  const only: string[] = [];
  const result: Record<string, number> = {};
  if (parts.strategy) {
    data['align.strategy'] = [stamped(ARCHIVE_STRATEGY)];
    only.push('align.strategy');
    result.strategy = 1;
  }
  if (parts.checklist) {
    data['align.checklist'] = ARCHIVE_CHECKLIST.map(stamped);
    only.push('align.checklist');
    result.checklist = ARCHIVE_CHECKLIST.length;
  }
  if (parts.rocks) {
    const rocks = await db.listDocs<Record<string, unknown> & db.Doc>('align.rocks');
    const users = (await db.listDocs<User>('users')).filter((u) => u.active);
    const known = new Set(rocks.map((r) => fold(String(r.title))));
    const added = ARCHIVE_ROCKS.filter((r) => !known.has(fold(r.title))).map((r, i) => {
      const owner = users.find((u) => fold(u.displayName) === fold(r.owner));
      return stamped({
        id: `rock_arch_${Date.now().toString(36)}_${i}`,
        title: r.title,
        description: owner ? '' : `Responsable (Align) : ${r.owner}`,
        ownerId: owner?.id ?? null,
        quarter: quarterOf(),
        thrust: r.thrust,
        initiative: r.initiative,
        order: rocks.length + i,
        archived: false,
        sourceId: null,
      });
    });
    data['align.rocks'] = [...rocks, ...added];
    only.push('align.rocks');
    result.rocks = added.length;
  }
  if (!only.length) throw new HttpError(400, 'Nothing selected.');
  await replace(data, only);
  return result;
}

export async function eraseAlign() {
  const empty: Data = Object.fromEntries(ALIGN_COLLECTIONS.map((c) => [c, []]));
  await replace(empty);
}
