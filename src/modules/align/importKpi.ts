import { API_MODE, api } from '@/data/db';
import { huddles, priorities, priorityUpdates, tasks } from '@/modules/tools/stores';
import { buildAlignFromKpi } from './fromKpi';
import { alignHuddles, alignPriorities, notes, rocks } from './stores';

export interface AlignImportResult {
  written: Record<string, number>;
  invalid: number;
  skipped: number;
  /** Records that did not fit the schemas: when present, nothing was imported. */
  refused?: string[];
}

/** Replaces Align's rocks, priorities, notes and huddles with the KPI tool's data. The strategy is kept. */
export async function importAlignFromKpi(): Promise<AlignImportResult> {
  if (API_MODE) return api<AlignImportResult>('/align/import-kpi', { method: 'POST', body: { confirm: 'REMPLACER' } });
  // Browser dev backend: same builder, written to the local collections.
  const built = buildAlignFromKpi({
    priorities: await priorities.list(),
    priorityUpdates: await priorityUpdates.list(),
    tasks: await tasks.list(),
    huddles: await huddles.list(),
  });
  if (!built.rocks.length && !built.priorities.length) throw new Error('L’outil KPI n’a aucune priorité à importer : rien n’a été modifié.');
  await rocks.replaceAll(built.rocks);
  await alignPriorities.replaceAll(built.priorities);
  await notes.replaceAll(built.notes);
  await alignHuddles.replaceAll(built.huddles);
  return {
    written: {
      'align.rocks': built.rocks.length,
      'align.priorities': built.priorities.length,
      'align.notes': built.notes.length,
      'align.huddles': built.huddles.length,
    },
    invalid: 0,
    skipped: built.skipped,
  };
}
