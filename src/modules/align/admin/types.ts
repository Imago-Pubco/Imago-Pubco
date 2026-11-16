/** Types of the Align data screen (Administration → Modules → Align). Server contract: server/api.ts '/align/*'. */
import type { L } from '@/i18n';

export type AlignCounts = Record<string, number>;

export interface AlignSnapshot {
  slot: number;
  name: string;
  at: string;
  by: string;
  counts: AlignCounts;
}

export type AlignSlot = AlignSnapshot | { slot: number; empty: true };

export interface AlignBackup {
  at: string;
  by: string;
  counts: AlignCounts;
}

export interface AlignArchiveInfo {
  date: string;
  rocks: number;
  checklist: number;
}

export interface AlignDataStatus {
  counts: AlignCounts;
  snapshots: AlignSlot[];
  backup: AlignBackup | null;
  archive: AlignArchiveInfo;
}

export type RestoreSource = { source: 'snapshot'; slot: number } | { source: 'backup' };

export interface ArchiveParts {
  strategy?: boolean;
  checklist?: boolean;
  rocks?: boolean;
}

export interface ArchiveResult {
  strategy?: number;
  checklist?: number;
  rocks?: number;
}

/** What the API client and the browser dev backend both implement (same signatures). */
export interface AlignDataClient {
  status(): Promise<AlignDataStatus>;
  /** `userId` is only used by the browser backend (the server stamps the snapshot itself). */
  snapshot(overwrite: boolean, userId: string): Promise<{ slot: number; name: string; counts: AlignCounts }>;
  restore(source: RestoreSource): Promise<{ counts: AlignCounts }>;
  archive(parts: ArchiveParts): Promise<ArchiveResult>;
  erase(): Promise<{ ok: true }>;
}

/** Rights needed to replace Align data (restore, archive reload, erase): the server checks all of them. */
export const REPLACE_RIGHTS = ['align.data', 'align.rocks.manage', 'align.priorities.manage', 'align.huddles.manage', 'align.strategy.manage'];

/** The six Align collections, in display order. */
export const ALIGN_COUNT_ITEMS: { key: string; label: L }[] = [
  { key: 'align.rocks', label: { fr: 'Rocks', en: 'Rocks' } },
  { key: 'align.priorities', label: { fr: 'Priorités', en: 'Priorities' } },
  { key: 'align.notes', label: { fr: 'Notes et suivis', en: 'Notes and follow-ups' } },
  { key: 'align.huddles', label: { fr: 'Huddles', en: 'Huddles' } },
  { key: 'align.strategy', label: { fr: 'Plan stratégique', en: 'Strategic plan' } },
  { key: 'align.checklist', label: { fr: 'Liste de vérification', en: 'Checklist' } },
];

export const labelOfKey = (key: string): L => ALIGN_COUNT_ITEMS.find((i) => i.key === key)?.label ?? { fr: key, en: key };

export const isFilled = (s: AlignSlot): s is AlignSnapshot => !('empty' in s);

export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));
