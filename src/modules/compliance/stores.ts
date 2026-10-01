import { collection } from '@/data/db';
import type { Audit, Framework, PolicyDoc, Requirement } from './types';
import { seedAudits, seedDocs, seedFrameworks, seedRequirements } from './seed';

export const frameworks = collection<Framework>('cmp.frameworks');
export const requirements = collection<Requirement>('cmp.requirements');
export const audits = collection<Audit>('cmp.audits');
export const policyDocs = collection<PolicyDoc>('cmp.documents');

/** Module-level seed so existing browsers get demo data without a full reset. */
const SEED_KEY = 'imago:seed:compliance';
export async function ensureComplianceSeeded(force = false) {
  if (!force && localStorage.getItem(SEED_KEY) === '1') return;
  await frameworks.replaceAll(seedFrameworks);
  await requirements.replaceAll(seedRequirements);
  await audits.replaceAll(seedAudits);
  await policyDocs.replaceAll(seedDocs);
  localStorage.setItem(SEED_KEY, '1');
}
