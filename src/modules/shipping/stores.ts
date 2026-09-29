import { collection } from '@/data/db';
import type { SavedAddress, ShipFrom, ShippingLabel } from './types';

export const labels = collection<ShippingLabel>('ship.labels');
export const addressBook = collection<SavedAddress>('ship.addresses');
export const shipFroms = collection<ShipFrom>('ship.origins');

export async function nextLabelNo() {
  const all = await labels.list();
  const max = all.reduce((m, l) => Math.max(m, parseInt(l.no.replace(/\D/g, ''), 10) || 0), 0);
  return `SHP-${String(max + 1).padStart(6, '0')}`;
}
