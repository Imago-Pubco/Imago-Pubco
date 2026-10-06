import { collection } from '@/data/db';
import type { Estimate, EstimatingSettings, Material } from './types';
import { DEFAULT_EST_SETTINGS } from './defaults';
import { seedEstimates, seedMaterials } from './seed';

export { DEFAULT_EST_SETTINGS };

export const estimates = collection<Estimate>('est.estimates');
export const materials = collection<Material>('est.materials');
export const estSettings = collection<EstimatingSettings>('est.settings');

export async function getEstSettings() {
  return (await estSettings.get('settings')) ?? DEFAULT_EST_SETTINGS;
}

export async function nextEstimateNo() {
  const yy = String(new Date().getFullYear()).slice(2);
  const all = await estimates.list();
  const max = all.reduce((m, e) => Math.max(m, parseInt(e.no.split('-').pop() ?? '0', 10) || 0), 0);
  return `EST-${yy}-${String(max + 1).padStart(4, '0')}`;
}

/** Module-level seed so existing browsers get the new module's demo data without a full reset. */
const SEED_KEY = 'imago:seed:estimating';
export async function ensureEstimatingSeeded(force = false) {
  if (!force && localStorage.getItem(SEED_KEY) === '1') return;
  await materials.replaceAll(seedMaterials);
  await estimates.replaceAll(seedEstimates);
  await estSettings.replaceAll([DEFAULT_EST_SETTINGS]);
  localStorage.setItem(SEED_KEY, '1');
}
