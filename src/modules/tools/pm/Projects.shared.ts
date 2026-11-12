import type { L } from '@/i18n';
import type { BillingType, ProjectStatus } from './schemas';

export const STATUS_LABEL: Record<ProjectStatus, L> = {
  planning: { fr: 'Planification', en: 'Planning' },
  active: { fr: 'Actif', en: 'Active' },
  onhold: { fr: 'En pause', en: 'On hold' },
  completed: { fr: 'Terminé', en: 'Completed' },
  archived: { fr: 'Archivé', en: 'Archived' },
};

export const BILLING_LABEL: Record<BillingType, L> = {
  hourly: { fr: 'Horaire', en: 'Hourly' },
  fixed: { fr: 'Forfait', en: 'Fixed fee' },
  retainer: { fr: 'Récurrent', en: 'Retainer' },
  internal: { fr: 'Interne', en: 'Internal' },
};

export const STATUS_BADGE: Record<ProjectStatus, string> = {
  planning: 'badge badge-info',
  active: 'badge badge-ok',
  onhold: 'badge badge-warn',
  completed: 'badge badge-accent',
  archived: 'badge',
};

/** "Actifs": projects still open to work (not completed nor archived). */
export const OPEN_STATUSES: ProjectStatus[] = ['planning', 'active', 'onhold'];

/** Next job number of the year, e.g. P-2026-015 after P-2026-014 (ignores other formats). */
export function nextProjectCode(codes: string[], year: number): string {
  const re = new RegExp(`^P-${year}-(\d+)$`);
  let max = 0;
  for (const c of codes) {
    const m = re.exec(c.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `P-${year}-${String(max + 1).padStart(3, '0')}`;
}
