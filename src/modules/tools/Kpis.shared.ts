import type { Kpi } from './schemas';

/** The user-editable KPI fields. The server stamps createdBy/createdAt/updatedBy/updatedAt, so they are left out. */
export type KpiFields = Omit<Kpi, 'id' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'>;

/** Copies exactly the editable fields (listing them keeps this in sync with the schema at compile time). */
export function kpiFieldsOf(k: Kpi): KpiFields {
  return {
    name: k.name,
    description: k.description,
    unit: k.unit,
    frequency: k.frequency,
    direction: k.direction,
    target: k.target,
    ownerId: k.ownerId,
    teamId: k.teamId,
    status: k.status,
    critical: k.critical,
    order: k.order,
  };
}

/** Text typed by the user: '' -> null (not applicable), a finite number, or undefined when invalid. */
export function parseNumber(s: string): number | null | undefined {
  const x = s.trim().replace(',', '.');
  if (x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
}

/** Recommended maximum of "critical numbers" on the dashboard. Exceeding it only warns. */
export const MAX_CRITICAL = 5;
