/**
 * Browser dev backend of the Align data screen: the same operations as server/alignData.ts, done on the local
 * collections. Snapshots live in localStorage ('imago:align:snapshots'). There is no automatic backup here.
 */
import { ApiError, uid } from '@/data/db';
import { users } from '@/data/stores';
import { ALIGN_ARCHIVE_DATE, ARCHIVE_CHECKLIST, ARCHIVE_ROCKS, ARCHIVE_STRATEGY } from '../archive';
import { quarterOf } from '../lib';
import type { Rock } from '../schemas';
import { alignHuddles, alignPriorities, checklist, notes, rocks, strategy } from '../stores';
import type { AlignCounts, AlignDataClient, AlignSlot, ArchiveParts, ArchiveResult, RestoreSource } from './types';

const SNAP_KEY = 'imago:align:snapshots';

interface Row {
  id: string;
}
interface DevCollection {
  list(): Promise<Row[]>;
  replaceAll(rows: Row[]): Promise<void>;
}
type Dump = Record<string, Row[]>;
interface StoredSnapshot {
  slot: number;
  name: string;
  at: string;
  by: string;
  counts: AlignCounts;
  data: Dump;
}

/** The six collections, by their server names. */
const COLLECTIONS = [
  ['align.rocks', rocks],
  ['align.priorities', alignPriorities],
  ['align.notes', notes],
  ['align.huddles', alignHuddles],
  ['align.strategy', strategy],
  ['align.checklist', checklist],
] as unknown as [string, DevCollection][];

const SLOTS = [1, 2, 3];

function readSnapshots(): StoredSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    return raw ? (JSON.parse(raw) as StoredSnapshot[]) : [];
  } catch {
    return [];
  }
}

function writeSnapshots(list: StoredSnapshot[]) {
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: the snapshot is simply not kept */
  }
}

async function dump(): Promise<Dump> {
  const data: Dump = {};
  for (const [key, col] of COLLECTIONS) data[key] = await col.list();
  return data;
}

const countsOf = (data: Dump): AlignCounts => Object.fromEntries(COLLECTIONS.map(([key]) => [key, data[key]?.length ?? 0]));

/** Same folding as the server: accents, case and spacing do not matter when comparing rock titles. */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const localData: AlignDataClient = {
  async status() {
    const snaps = readSnapshots();
    const snapshots: AlignSlot[] = SLOTS.map((slot) => {
      const s = snaps.find((x) => x.slot === slot);
      return s ? { slot, name: s.name, at: s.at, by: s.by, counts: s.counts } : { slot, empty: true };
    });
    return {
      counts: countsOf(await dump()),
      snapshots,
      backup: null,
      archive: { date: ALIGN_ARCHIVE_DATE, rocks: ARCHIVE_ROCKS.length, checklist: ARCHIVE_CHECKLIST.length },
    };
  },

  async snapshot(overwrite, userId) {
    const snaps = readSnapshots();
    let slot = SLOTS.find((n) => !snaps.some((s) => s.slot === n));
    if (!slot) {
      const oldest = [...snaps].sort((a, b) => a.at.localeCompare(b.at))[0];
      if (!overwrite) throw new ApiError(409, `All snapshot slots are used: the oldest ("${oldest.name}") would be overwritten.`);
      slot = oldest.slot;
    }
    const at = new Date().toISOString();
    const data = await dump();
    const snap: StoredSnapshot = { slot, name: `Instantané ${at.slice(0, 16).replace('T', ' ')}`, at, by: userId, counts: countsOf(data), data };
    writeSnapshots([...snaps.filter((s) => s.slot !== slot), snap]);
    return { slot, name: snap.name, counts: snap.counts };
  },

  async restore(source: RestoreSource) {
    if (source.source === 'backup') throw new ApiError(404, 'No backup: no KPI import was run yet.');
    const snap = readSnapshots().find((s) => s.slot === source.slot);
    if (!snap) throw new ApiError(404, 'This snapshot slot is empty.');
    for (const [key, col] of COLLECTIONS) await col.replaceAll(snap.data[key] ?? []);
    return { counts: countsOf(snap.data) };
  },

  async archive(parts: ArchiveParts) {
    const result: ArchiveResult = {};
    if (parts.strategy) {
      await strategy.replaceAll([ARCHIVE_STRATEGY]);
      result.strategy = 1;
    }
    if (parts.checklist) {
      await checklist.replaceAll(ARCHIVE_CHECKLIST);
      result.checklist = ARCHIVE_CHECKLIST.length;
    }
    if (parts.rocks) {
      const existing = await rocks.list();
      const known = new Set(existing.map((r) => fold(r.title)));
      const people = (await users.list()).filter((u) => u.active);
      const missing = ARCHIVE_ROCKS.filter((r) => !known.has(fold(r.title)));
      for (const [i, r] of missing.entries()) {
        const owner = people.find((u) => fold(u.displayName) === fold(r.owner));
        const rock: Rock = {
          id: uid('rock_'),
          title: r.title,
          description: owner ? '' : `Responsable (Align) : ${r.owner}`,
          ownerId: owner?.id ?? null,
          quarter: quarterOf(),
          thrust: r.thrust,
          initiative: r.initiative,
          order: existing.length + i,
          archived: false,
          sourceId: null,
        };
        await rocks.insert(rock);
      }
      result.rocks = missing.length;
    }
    return result;
  },

  async erase() {
    for (const [, col] of COLLECTIONS) await col.replaceAll([]);
    return { ok: true };
  },
};
