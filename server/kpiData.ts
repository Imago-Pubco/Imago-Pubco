/**
 * KPI data management (Tools -> KPI -> Settings): import the archived Align data, take snapshots, restore, erase.
 *
 * Two stores are kept OUT of the app on purpose and are never touched by "erase":
 *   - the archive of the old (Align) data   -> meta key `kpi.archive`
 *   - up to three snapshots (round robin)   -> meta keys `kpi.snapshot.1|2|3`
 * They live in the `meta` table, which the generic collection API does not expose and the admin export does not include.
 * The live KPI data is the nine `tools.*` collections; every operation here replaces it inside ONE database transaction,
 * so a failure leaves the previous data exactly as it was.
 */
import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AlignArchiveSchema, type AlignArchive } from '../src/modules/tools/archive.ts';
import { TOOLS_SCHEMAS } from '../src/modules/tools/schemas.ts';
import type { User } from '../src/data/types.ts';
import * as db from './db.ts';
import { broadcast } from './events.ts';
import { buildKpiData, emptyData, KPI_COLLECTIONS, type ImportReport, type KpiData } from './kpiImport.ts';
import { HttpError } from './ms.ts';
import { withLock } from './pipeline.ts';

const ARCHIVE_KEY = 'kpi.archive';
const SLOTS = [1, 2, 3] as const;
const snapKey = (slot: number) => `kpi.snapshot.${slot}`;

interface ArchiveRecord {
  archive: AlignArchive;
  loadedAt: string;
}
interface Snapshot {
  slot: number;
  name: string;
  takenAt: string;
  takenBy: string;
  counts: Record<string, number>;
  data: KpiData;
}

const countsOf = (data: KpiData) => Object.fromEntries(KPI_COLLECTIONS.map((c) => [c, data[c].length]));
const total = (counts: Record<string, number>) => Object.values(counts).reduce((s, n) => s + n, 0);
const uid = (p: string) => p + randomBytes(8).toString('hex');

async function audit(userId: string, action: string, detail: string) {
  await db.insertDoc('audit', { id: uid('a_'), at: new Date().toISOString(), userId, action, detail, ip: '' });
  broadcast('audit');
}

/* ---------- current data ---------- */

export async function readCurrent(): Promise<KpiData> {
  const data = emptyData();
  for (const c of KPI_COLLECTIONS) data[c] = await db.listDocs<Record<string, unknown> & db.Doc>(c);
  return data;
}

/** Replaces the nine KPI collections with `data`, atomically. Documents that do not fit the schemas are skipped (counted). */
async function replaceCurrent(data: KpiData): Promise<{ written: Record<string, number>; skipped: number }> {
  const client: PoolClient = await db.pool.connect();
  const written: Record<string, number> = {};
  let skipped = 0;
  try {
    await client.query('begin');
    for (const c of KPI_COLLECTIONS) {
      await client.query('delete from docs where collection = $1', [c]);
      const schema = TOOLS_SCHEMAS[c];
      let n = 0;
      for (const doc of data[c]) {
        // Stamps are re-written by the operation; everything else must still satisfy the schema.
        if (!schema.safeParse(doc).success || typeof doc.id !== 'string') {
          skipped++;
          continue;
        }
        await client.query('insert into docs (collection, id, data) values ($1, $2, $3) on conflict (collection, id) do nothing', [c, doc.id, doc]);
        n++;
      }
      written[c] = n;
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
  for (const c of KPI_COLLECTIONS) broadcast(c);
  return { written, skipped };
}

/* ---------- archive ---------- */

export async function loadArchive(raw: unknown): Promise<AlignArchive> {
  const archive = AlignArchiveSchema.parse(raw);
  await db.setMeta(ARCHIVE_KEY, { archive, loadedAt: new Date().toISOString() } satisfies ArchiveRecord);
  return archive;
}

const getArchive = () => db.getMeta<ArchiveRecord>(ARCHIVE_KEY);

/* ---------- snapshots ---------- */

async function readSnapshots(): Promise<Snapshot[]> {
  const out: Snapshot[] = [];
  for (const s of SLOTS) {
    const v = await db.getMeta<Snapshot>(snapKey(s));
    if (v) out.push(v);
  }
  return out;
}
const oldest = (snaps: Snapshot[]) => [...snaps].sort((a, b) => a.takenAt.localeCompare(b.takenAt))[0];
/** Snapshot names carry the date and time in the company's time zone (seconds included, so two never share a name). */
const TZ = process.env.APP_TIMEZONE || 'America/Toronto';
const stamp = (d: Date) => d.toLocaleString('sv-SE', { timeZone: TZ });
const meta = (s: Snapshot) => ({ slot: s.slot, name: s.name, takenAt: s.takenAt, takenBy: s.takenBy, counts: s.counts });

/* ---------- operations ---------- */

export async function status() {
  const [current, archive, snaps] = await Promise.all([readCurrent(), getArchive(), readSnapshots()]);
  const arch = archive?.archive;
  return {
    current: countsOf(current),
    archive: arch
      ? {
          company: arch.company,
          exportedAt: arch.exportedAt,
          loadedAt: archive!.loadedAt,
          counts: { metrics: arch.metrics.length, priorities: arch.priorities.length, huddles: arch.huddles.length, people: arch.people.length, teams: arch.teams.length },
        }
      : null,
    snapshots: snaps.map(meta).sort((a, b) => a.slot - b.slot),
    maxSnapshots: SLOTS.length,
    /** The snapshot the next one would overwrite when all slots are used (the oldest). */
    nextOverwrite: snaps.length >= SLOTS.length ? meta(oldest(snaps)) : null,
  };
}

export function importArchive(actorId: string): Promise<{ report: ImportReport; skipped: number }> {
  return withLock('kpi-data', async () => {
    const rec = await getArchive();
    if (!rec) throw new HttpError(404, 'There is no archived data to import.');
    const users = await db.listDocs<User>('users');
    const { data, report } = buildKpiData(rec.archive, users, actorId);
    const { skipped } = await replaceCurrent(data);
    await audit(actorId, 'tools.kpi.data.import', `Imported the archived ${rec.archive.source} data: ${total(report.counts)} documents (${report.unmatchedPeople.length} unmatched people)`);
    return { report, skipped };
  });
}

/** Takes a snapshot. When the three slots are used it overwrites the oldest one, but only if the caller confirmed that slot. */
export function takeSnapshot(actorId: string, confirmOverwriteSlot?: number) {
  return withLock('kpi-data', async () => {
    const snaps = await readSnapshots();
    let slot: number;
    if (snaps.length < SLOTS.length) {
      slot = SLOTS.find((s) => !snaps.some((x) => x.slot === s))!;
    } else {
      const target = oldest(snaps);
      if (confirmOverwriteSlot !== target.slot) {
        throw Object.assign(new HttpError(409, `All ${SLOTS.length} snapshots are used: taking another overwrites the oldest, “${target.name}”.`), { overwrite: meta(target) });
      }
      slot = target.slot;
    }
    const data = await readCurrent();
    const now = new Date();
    const snap: Snapshot = { slot, name: `Snapshot ${stamp(now)}`, takenAt: now.toISOString(), takenBy: actorId, counts: countsOf(data), data };
    await db.setMeta(snapKey(slot), snap);
    await audit(actorId, 'tools.kpi.data.snapshot', `${snap.name} (slot ${slot}, ${total(snap.counts)} documents)${snaps.length >= SLOTS.length ? ' - overwrote the oldest snapshot' : ''}`);
    return meta(snap);
  });
}

export type RestoreSource = { source: 'archive' } | { source: 'snapshot'; slot: number };

export function restore(actorId: string, from: RestoreSource) {
  return withLock('kpi-data', async () => {
    let data: KpiData;
    let label: string;
    let report: ImportReport | undefined;
    if (from.source === 'archive') {
      const rec = await getArchive();
      if (!rec) throw new HttpError(404, 'There is no archived data to restore.');
      const built = buildKpiData(rec.archive, await db.listDocs<User>('users'), actorId);
      data = built.data;
      report = built.report;
      label = `the archived ${rec.archive.source} data`;
    } else {
      const snap = SLOTS.includes(from.slot as 1) ? await db.getMeta<Snapshot>(snapKey(from.slot)) : undefined;
      if (!snap) throw new HttpError(404, 'This snapshot does not exist.');
      data = snap.data;
      label = `snapshot “${snap.name}”`;
    }
    const { written, skipped } = await replaceCurrent(data);
    await audit(actorId, 'tools.kpi.data.restore', `Restored from ${label}: ${total(written)} documents`);
    return { counts: written, skipped, report };
  });
}

/** Erases the live KPI data. The archive and the snapshots are untouched, by construction (only the nine tools.* collections are listed). */
export function eraseAll(actorId: string) {
  return withLock('kpi-data', async () => {
    const before = countsOf(await readCurrent());
    await replaceCurrent(emptyData());
    await audit(actorId, 'tools.kpi.data.erase', `Erased all KPI data: ${total(before)} documents (the archive and the snapshots were kept)`);
    return { erased: before };
  });
}
