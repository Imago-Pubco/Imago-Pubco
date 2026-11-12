/** Types and helpers of the KPI data screen (server contract of /tools/kpi/data/*). */
import type { L } from '@/i18n';

export type Counts = Record<string, number>;

export type ArchiveCounts = {
  metrics: number;
  priorities: number;
  huddles: number;
  people: number;
  teams: number;
};

export interface ArchiveMeta {
  company: string;
  exportedAt: string;
  loadedAt: string;
  counts: ArchiveCounts;
}

export interface SnapshotMeta {
  slot: number;
  name: string;
  takenAt: string;
  takenBy: string;
  counts: Counts;
}

export interface KpiDataStatus {
  current: Counts;
  archive: ArchiveMeta | null;
  snapshots: SnapshotMeta[];
  maxSnapshots: number;
  nextOverwrite: SnapshotMeta | null;
}

export interface ImportReport {
  counts: Counts;
  unmatchedPeople: string[];
  invalid: Counts;
  notes: string[];
}

export interface ImportResponse {
  report: ImportReport;
  skipped: number;
}

export interface RestoreResponse {
  counts: Counts;
  skipped: number;
  report?: ImportReport;
}

export interface EraseResponse {
  erased: Counts;
}

export type RestoreSource = { source: 'archive' } | { source: 'snapshot'; slot: number };

/** Outcome of the last import, restore or erase, shown in a panel. */
export interface ResultData {
  title: string;
  counts: Counts;
  skipped: number;
  report?: ImportReport;
}

/** Confirmation dialogs of the page. */
export type ModalKind = 'import' | 'snapshotWarn' | 'restore' | 'erase';

export interface CountItem {
  label: L;
  value: number;
}

const LABELS: Record<string, L> = {
  teams: { fr: 'Équipes', en: 'Teams' },
  kpis: { fr: 'Indicateurs', en: 'Indicators' },
  kpiValues: { fr: 'Valeurs d’indicateurs', en: 'Indicator values' },
  priorities: { fr: 'Priorités', en: 'Priorities' },
  priorityUpdates: { fr: 'Mises à jour de priorités', en: 'Priority updates' },
  tasks: { fr: 'Tâches', en: 'Tasks' },
  huddles: { fr: 'Huddles', en: 'Huddles' },
  huddleEntries: { fr: 'Bilans de huddle', en: 'Huddle entries' },
  huddleItems: { fr: 'Points de huddle', en: 'Huddle items' },
  metrics: { fr: 'Indicateurs', en: 'Indicators' },
  people: { fr: 'Personnes', en: 'People' },
};

/** Collection key without the "tools." prefix ("tools.kpis" and "kpis" are the same collection). */
const bare = (key: string): string => key.replace(/^tools\./, '');

export const labelOf = (key: string): L => LABELS[bare(key)] ?? { fr: bare(key), en: bare(key) };

export const countOf = (counts: Counts, key: string): number => counts[bare(key)] ?? counts[`tools.${bare(key)}`] ?? 0;

export const countItems = (counts: Counts, keys: readonly string[]): CountItem[] =>
  keys.map((k) => ({ label: labelOf(k), value: countOf(counts, k) }));

export const sumOf = (counts: Counts): number => Object.values(counts).reduce((s, n) => s + n, 0);

export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The nine kinds of live KPI data, in display order. */
export const CURRENT_KEYS = [
  'teams',
  'kpis',
  'kpiValues',
  'priorities',
  'priorityUpdates',
  'tasks',
  'huddles',
  'huddleEntries',
  'huddleItems',
] as const;

export const ARCHIVE_KEYS: (keyof ArchiveCounts)[] = ['metrics', 'priorities', 'huddles', 'people', 'teams'];

/** Counts shown for each snapshot. */
export const SUMMARY_KEYS = ['kpis', 'kpiValues', 'priorities', 'huddles'] as const;
