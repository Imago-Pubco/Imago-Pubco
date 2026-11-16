/**
 * Align ← KPI tool: rebuilds the Align rocks, priorities, notes and huddles from the KPI tool's data
 * (src/modules/align/fromKpi.ts), atomically. The strategy and the alignment checklist are never touched.
 * Requires align.data (checked by the route).
 */
import type { PoolClient } from 'pg';
import type { ZodObject } from 'zod';
import { buildAlignFromKpi, type KpiSource } from '../src/modules/align/fromKpi.ts';
import { ALIGN_SCHEMAS } from '../src/modules/align/schemas.ts';
import * as db from './db.ts';
import { HttpError } from './ms.ts';
import { broadcast } from './events.ts';

const TARGETS = ['align.rocks', 'align.priorities', 'align.notes', 'align.huddles'] as const;

export async function importAlignFromKpi(userId: string) {
  const src = {
    priorities: await db.listDocs('tools.priorities'),
    priorityUpdates: await db.listDocs('tools.priorityUpdates'),
    tasks: await db.listDocs('tools.tasks'),
    huddles: await db.listDocs('tools.huddles'),
  } as unknown as KpiSource;
  const built = buildAlignFromKpi(src);
  // Never replace Align's data with nothing (e.g. the KPI data was erased or not imported yet).
  if (!built.rocks.length && !built.priorities.length) throw new HttpError(400, 'The KPI tool has no priorities to import: nothing was changed.');
  const rows: Record<(typeof TARGETS)[number], Record<string, unknown>[]> = {
    'align.rocks': built.rocks,
    'align.priorities': built.priorities,
    'align.notes': built.notes,
    'align.huddles': built.huddles,
  };

  // Imported records belong to no user (the person who ran the import is in the audit log): only managers edit them.
  const stamp = new Date().toISOString();
  const by = 'import:kpi';
  const written: Record<string, number> = {};
  const invalid: string[] = [];
  for (const c of TARGETS) {
    const schema = (ALIGN_SCHEMAS as Record<string, ZodObject>)[c];
    for (const raw of rows[c]) if (!schema.safeParse({ ...raw, createdBy: by, createdAt: stamp, updatedBy: by, updatedAt: stamp }).success) invalid.push(`${c}:${String(raw.id)}`);
  }
  // All or nothing: a dropped record would leave notes or priorities pointing at nothing.
  if (invalid.length) return { written, invalid: invalid.length, skipped: built.skipped, refused: invalid.slice(0, 20) };

  const client: PoolClient = await db.pool.connect();
  try {
    await client.query('begin');
    // Backup of the data being replaced (meta key align.backup), so a mistaken import can be undone by an administrator.
    const backup: Record<string, unknown> = { at: stamp, by: userId };
    for (const c of TARGETS) backup[c] = (await client.query('select data from docs where collection = $1', [c])).rows.map((r) => r.data);
    await client.query('insert into meta (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value', ['align.backup', JSON.stringify(backup)]);
    for (const c of TARGETS) {
      await client.query('delete from docs where collection = $1', [c]);
      for (const raw of rows[c]) {
        const doc: Record<string, unknown> = { ...raw, createdBy: by, createdAt: stamp, updatedBy: by, updatedAt: stamp };
        await client.query('insert into docs (collection, id, data) values ($1, $2, $3) on conflict (collection, id) do nothing', [c, doc.id, doc]);
      }
      written[c] = rows[c].length;
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
  for (const c of TARGETS) broadcast(c);
  return { written, invalid: 0, skipped: built.skipped, refused: [] as string[] };
}
