import type { BillingType, EntryStatus, ProjectStatus, TaskStatus, TASK_PRIORITY } from './schemas';

/** A bilingual label (French first). */
export interface Bi {
  fr: string;
  en: string;
}
export const bi = (x: Bi, lang: string) => (lang === 'fr' ? x.fr : x.en);

export type TaskPriority = (typeof TASK_PRIORITY)[number];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, Bi> = {
  planning: { fr: 'Planification', en: 'Planning' },
  active: { fr: 'En cours', en: 'Active' },
  onhold: { fr: 'En pause', en: 'On hold' },
  completed: { fr: 'Terminé', en: 'Completed' },
  archived: { fr: 'Archivé', en: 'Archived' },
};

export const BILLING_LABEL: Record<BillingType, Bi> = {
  hourly: { fr: 'Horaire', en: 'Hourly' },
  fixed: { fr: 'Forfait', en: 'Fixed fee' },
  retainer: { fr: 'Mandat récurrent', en: 'Retainer' },
  internal: { fr: 'Interne', en: 'Internal' },
};

export const TASK_STATUS_LABEL: Record<TaskStatus, Bi> = {
  todo: { fr: 'À faire', en: 'To do' },
  doing: { fr: 'En cours', en: 'In progress' },
  review: { fr: 'En révision', en: 'In review' },
  done: { fr: 'Terminée', en: 'Done' },
};

export const TASK_STATUS_BADGE: Record<TaskStatus, string> = {
  todo: '',
  doing: 'badge-info',
  review: 'badge-accent',
  done: 'badge-ok',
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, Bi> = {
  low: { fr: 'Basse', en: 'Low' },
  normal: { fr: 'Normale', en: 'Normal' },
  high: { fr: 'Haute', en: 'High' },
  urgent: { fr: 'Urgente', en: 'Urgent' },
};

export const TASK_PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: '',
  normal: '',
  high: 'badge-warn',
  urgent: 'badge-err',
};

export const ENTRY_STATUS_LABEL: Record<EntryStatus, Bi> = {
  draft: { fr: 'Brouillon', en: 'Draft' },
  submitted: { fr: 'Soumis', en: 'Submitted' },
  approved: { fr: 'Approuvé', en: 'Approved' },
  rejected: { fr: 'Rejeté', en: 'Rejected' },
};

export const ENTRY_STATUS_BADGE: Record<EntryStatus, string> = {
  draft: '',
  submitted: 'badge-info',
  approved: 'badge-ok',
  rejected: 'badge-err',
};
