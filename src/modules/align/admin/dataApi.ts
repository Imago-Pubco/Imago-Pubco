/**
 * Align data management client. The API backend (API_MODE) talks to the server routes '/align/*'; the browser dev
 * backend (localData.ts) does the same work locally. Both implement AlignDataClient.
 */
import { API_MODE, api } from '@/data/db';
import { localData } from './localData';
import type { AlignCounts, AlignDataClient, AlignDataStatus, ArchiveParts, ArchiveResult, RestoreSource } from './types';

export const apiData: AlignDataClient = {
  status: () => api<AlignDataStatus>('/align/data'),
  // Without overwrite the server answers 409 when the 3 slots are used; the screen then asks and retries with true.
  snapshot: (overwrite) =>
    api<{ slot: number; name: string; counts: AlignCounts }>('/align/snapshot', { method: 'POST', body: overwrite ? { overwrite: true } : {} }),
  restore: (source: RestoreSource) => api<{ counts: AlignCounts }>('/align/restore', { method: 'POST', body: { ...source, confirm: 'REMPLACER' } }),
  archive: (parts: ArchiveParts) => api<ArchiveResult>('/align/archive', { method: 'POST', body: parts }),
  erase: () => api<{ ok: true }>('/align/erase', { method: 'POST', body: { confirm: 'EFFACER' } }),
};

/** The client the screen uses: the server in API mode, the browser dev backend otherwise. */
export const alignData: AlignDataClient = API_MODE ? apiData : localData;
