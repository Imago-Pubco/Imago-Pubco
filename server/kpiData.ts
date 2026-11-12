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
import { buildKpiData, emptyData, KPI_COLLECTIONS, makeMatcher, referencedNames, type ImportReport, type KpiData } from './kpiImport.ts';
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

/* ---------- people: archived names <-> Imago users ---------- */

const PEOPLE_MAP_KEY = 'kpi.people-map';
const PEOPLE_SYNCED_KEY = 'kpi.people-synced';
type Choices = Record<string, string | null>;
interface PeopleMapRecord {
  map: Choices;
  savedAt: string;
}
interface SyncedRecord {
  map: Choices;
  at: string;
}
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

const savedChoices = async (): Promise<Choices> => (await db.getMeta<PeopleMapRecord>(PEOPLE_MAP_KEY))?.map ?? {};

/** name -> Imago user id (or null) for every name the archive mentions: explicit choices first, then automatic matching. */
function effectiveMap(archive: AlignArchive, users: User[], choices: Choices): Choices {
  const match = makeMatcher(archive, users);
  return Object.fromEntries(referencedNames(archive).map((n) => [n, has(choices, n) ? choices[n] : match(n)]));
}

/** What the last import / restore / sync applied, so a later sync only has to apply what changed since. */
const rememberSynced = (map: Choices) => db.setMeta(PEOPLE_SYNCED_KEY, { map, at: new Date().toISOString() } satisfies SyncedRecord);

export async function getPeople() {
  const rec = await getArchive();
  if (!rec) return { people: [], lastSyncedAt: null as string | null, pending: 0 };
  const archive = rec.archive;
  const [users, choices, synced] = await Promise.all([db.listDocs<User>('users'), savedChoices(), db.getMeta<SyncedRecord>(PEOPLE_SYNCED_KEY)]);
  const eff = effectiveMap(archive, users, choices);
  const match = makeMatcher(archive, users);
  const who = (id: string | null) => {
    const u = id ? users.find((x) => x.id === id) : undefined;
    return u ? { id: u.id, displayName: u.displayName } : null;
  };
  const info = new Map(archive.people.map((p) => [p.name, p]));
  const count = {
    kpis: (n: string) => archive.metrics.filter((m) => m.owner === n).length,
    priorities: (n: string) => archive.priorities.filter((p) => p.owner === n).length,
    tasks: (n: string) => archive.priorities.reduce((c, p) => c + p.tasks.filter((t) => t.owner === n).length, 0) + archive.huddles.reduce((c, h) => c + h.tasks.filter((t) => t.owner === n).length, 0),
    huddles: (n: string) => archive.huddles.filter((h) => h.owner === n || h.members.includes(n)).length,
    checkins: (n: string) => archive.huddles.reduce((c, h) => c + h.entries.filter((e) => e.person === n).length, 0),
  };
  const people = referencedNames(archive).map((name) => {
    const p = info.get(name);
    return {
      name,
      email: p?.email ?? '',
      title: p?.title ?? '',
      choice: (has(choices, name) ? (choices[name] === null ? 'none' : 'user') : 'auto') as 'auto' | 'none' | 'user',
      userId: has(choices, name) ? choices[name] : null,
      suggested: who(match(name)),
      effective: who(eff[name]),
      counts: { kpis: count.kpis(name), priorities: count.priorities(name), tasks: count.tasks(name), huddles: count.huddles(name), checkins: count.checkins(name) },
      pending: (synced?.map[name] ?? null) !== (eff[name] ?? null),
    };
  });
  return { people, lastSyncedAt: synced?.at ?? null, pending: people.filter((p) => p.pending).length };
}

/** Saves the administrator's explicit choices (absent = automatic, null = no account, string = an active Imago user). */
export function setPeopleChoices(actorId: string, map: unknown) {
  return withLock('kpi-data', async () => {
    const rec = await getArchive();
    if (!rec) throw new HttpError(404, 'There is no archived data.');
    if (!map || typeof map !== 'object' || Array.isArray(map)) throw new HttpError(400, 'Invalid matching.');
    const known = new Set(referencedNames(rec.archive));
    const users = await db.listDocs<User>('users');
    const clean: Choices = {};
    for (const [name, v] of Object.entries(map as Record<string, unknown>)) {
      if (!known.has(name)) throw new HttpError(400, `Unknown person: ${name}`);
      if (v === null) clean[name] = null;
      else if (typeof v === 'string' && users.some((u) => u.id === v && u.active)) clean[name] = v;
      else throw new HttpError(400, `Not an active Imago user: ${name}`);
    }
    await db.setMeta(PEOPLE_MAP_KEY, { map: clean, savedAt: new Date().toISOString() } satisfies PeopleMapRecord);
    await audit(actorId, 'tools.kpi.data.people-map', `${Object.values(clean).filter(Boolean).length} explicit link(s), ${Object.values(clean).filter((v) => v === null).length} marked "no account"`);
  }).then(() => getPeople());
}

/**
 * Applies the links of the people whose association changed since the last import / restore / sync, WITHOUT re-importing.
 * The archive is built twice, with the previous and the current associations: the difference is exactly what the new links
 * change. It is applied to the live documents only where the field still has the value it had before (so nothing edited in
 * the app is overwritten), members are added, and the check-ins of the newly linked people are inserted.
 */
export function syncPeople(actorId: string) {
  return withLock('kpi-data', async () => {
    const rec = await getArchive();
    if (!rec) throw new HttpError(404, 'There is no archived data.');
    const users = await db.listDocs<User>('users');
    const choices = await savedChoices();
    const synced = await db.getMeta<SyncedRecord>(PEOPLE_SYNCED_KEY);
    const now = effectiveMap(rec.archive, users, choices);
    const before = buildKpiData(rec.archive, users, actorId, synced?.map ?? Object.fromEntries(Object.keys(now).map((n) => [n, null]))).data;
    const after = buildKpiData(rec.archive, users, actorId, now).data;

    const updated: Record<string, number> = {};
    const inserted: Record<string, number> = {};
    const client: PoolClient = await db.pool.connect();
    try {
      await client.query('begin');
      for (const c of KPI_COLLECTIONS) {
        const prev = new Map(before[c].map((d) => [String(d.id), d]));
        for (const doc of after[c]) {
          const id = String(doc.id);
          const was = prev.get(id);
          const liveRow = await client.query('select data from docs where collection = $1 and id = $2', [c, id]);
          const live = liveRow.rows[0]?.data as Record<string, unknown> | undefined;
          if (!was) {
            // Only check-ins appear because of a link (their author needs an account); anything else the person deleted stays deleted.
            if (!live && c === 'tools.huddleEntries') {
              await client.query('insert into docs (collection, id, data) values ($1, $2, $3)', [c, id, doc]);
              inserted[c] = (inserted[c] ?? 0) + 1;
            }
            continue;
          }
          if (!live) continue;
          const patch: Record<string, unknown> = {};
          for (const key of Object.keys(doc)) {
            if (JSON.stringify(doc[key]) === JSON.stringify(was[key])) continue;
            if (Array.isArray(doc[key]) && Array.isArray(was[key])) {
              // members: add the newly linked people, never remove anyone
              const added = (doc[key] as unknown[]).filter((x) => !(was[key] as unknown[]).includes(x));
              const merged = [...new Set([...((live[key] as unknown[]) ?? []), ...added])];
              if (merged.length !== ((live[key] as unknown[]) ?? []).length) patch[key] = merged;
            } else if (JSON.stringify(live[key]) === JSON.stringify(was[key])) {
              patch[key] = doc[key]; // still what the import wrote: safe to update
            }
          }
          if (Object.keys(patch).length) {
            patch.updatedBy = actorId;
            patch.updatedAt = new Date().toISOString();
            await client.query('update docs set data = data || $3::jsonb, updated_at = now() where collection = $1 and id = $2', [c, id, JSON.stringify(patch)]);
            updated[c] = (updated[c] ?? 0) + 1;
          }
        }
      }
      await client.query('commit');
    } catch (e) {
      await client.query('rollback').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
    const people = Object.keys(now).filter((n) => (synced?.map[n] ?? null) !== (now[n] ?? null)).length;
    await rememberSynced(now);
    for (const c of KPI_COLLECTIONS) broadcast(c);
    await audit(actorId, 'tools.kpi.data.sync-people', `Applied the links of ${people} person(s): ${total(updated)} document(s) updated, ${total(inserted)} inserted`);
    return { updated, inserted, people };
  });
}

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
    const choices = await savedChoices();
    const { data, report } = buildKpiData(rec.archive, users, actorId, choices);
    const { skipped } = await replaceCurrent(data);
    await rememberSynced(effectiveMap(rec.archive, users, choices));
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
      const users = await db.listDocs<User>('users');
      const choices = await savedChoices();
      const built = buildKpiData(rec.archive, users, actorId, choices);
      await rememberSynced(effectiveMap(rec.archive, users, choices));
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
