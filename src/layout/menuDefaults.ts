/**
 * The default sidebar menu (sections and the module ids each holds, in order). An administrator can change it in
 * Administration → Menu. Kept free of module imports: the registry, the shell and the menu editor all read it, and
 * importing the registry from here would create an import cycle (registry → admin module → menu editor → here).
 */
import type { L } from '@/i18n';

/** Support TI ('it') is not here: it is pinned at the bottom of the sidebar, like "Tableau de bord" at the top. */
export const DEFAULT_SECTIONS: { id: string; label: L | null; moduleIds: string[] }[] = [
  { id: 'admin', label: { fr: 'Outils administratifs', en: 'Administrative tools' }, moduleIds: ['align', 'o365', 'rh'] },
  { id: 'accounting', label: { fr: 'Comptabilité', en: 'Accounting' }, moduleIds: ['accounting'] },
  { id: 'production', label: { fr: 'Outils de production', en: 'Production tools' }, moduleIds: ['estimating', 'shipping'] },
  { id: 'studio', label: { fr: 'Outils studio', en: 'Studio tools' }, moduleIds: ['tools.pm'] },
  { id: 'dev', label: { fr: 'Développement', en: 'Development' }, moduleIds: ['dev'] },
  { id: 'archive', label: { fr: 'Archive temporaire', en: 'Archive (temporary)' }, moduleIds: ['tools'] },
];
