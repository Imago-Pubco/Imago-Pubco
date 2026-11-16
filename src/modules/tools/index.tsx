import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Gauge, LayoutDashboard, ListChecks, Presentation, Target, Users } from 'lucide-react';
import { RequirePermission } from '@/components/ui';
import type { ModuleDef } from '../types';
import { Dashboard } from './pages/Dashboard';
import { Kpis } from './pages/Kpis';
import { Priorities } from './pages/Priorities';
import { Huddles } from './pages/Huddles';
import { HuddleMeeting } from './pages/HuddleMeeting';
import { Teams } from './pages/Teams';
import { Settings } from './pages/Settings';
import { TourButton } from './tour/TourButton';

function ToolsRoutes() {
  const guard = (el: ReactElement) => <RequirePermission permission="tools.kpi.access">{el}</RequirePermission>;
  return (
    <Routes>
      <Route index element={guard(<Dashboard />)} />
      <Route path="kpi" element={guard(<Dashboard />)} />
      <Route path="kpi/indicators" element={guard(<Kpis />)} />
      <Route path="kpi/priorities" element={guard(<Priorities />)} />
      <Route path="kpi/huddles" element={guard(<Huddles />)} />
      <Route path="kpi/huddles/:id" element={guard(<HuddleMeeting />)} />
      <Route path="kpi/teams" element={guard(<Teams />)} />
    </Routes>
  );
}

/**
 * KPI tool (sidebar section "Archive temporaire"): indicators, priorities, huddles, teams. Module id "tools" is kept for its data and rights.
 * Function Fox (project management) lives under /tools/pm but is its own module (src/modules/tools/pm/index.tsx).
 */
export const toolsModule: ModuleDef = {
  id: 'tools',
  path: '/tools',
  name: { fr: 'KPI', en: 'KPI' },
  tagline: { fr: 'Indicateurs, priorités et huddles', en: 'KPIs, priorities and huddles' },
  icon: Gauge,
  accent: '#0d9488',
  entryPermission: 'tools.access',
  permissions: [
    { key: 'tools.access', label: { fr: 'Outils : accéder au module', en: 'Tools: access the module' } },
    { key: 'tools.kpi.access', label: { fr: 'Outils : utiliser l’outil KPI (indicateurs, priorités, huddles)', en: 'Tools: use the KPI tool (indicators, priorities, huddles)' } },
    { key: 'tools.kpi.data', label: { fr: 'Outils : gérer les données KPI (importer, instantanés, restaurer, tout effacer)', en: 'Tools: manage KPI data (import, snapshots, restore, erase all)' } },
  ],
  // The module is the KPI tool itself (sidebar: Archive temporaire): its screens are listed directly.
  nav: [
    { path: 'kpi', label: { fr: 'Tableau de bord', en: 'Dashboard' }, icon: LayoutDashboard, permission: 'tools.kpi.access' },
    { path: 'kpi/indicators', label: { fr: 'Indicateurs', en: 'Indicators' }, icon: Target, permission: 'tools.kpi.access' },
    { path: 'kpi/priorities', label: { fr: 'Priorités', en: 'Priorities' }, icon: ListChecks, permission: 'tools.kpi.access' },
    { path: 'kpi/huddles', label: { fr: 'Huddles', en: 'Huddles' }, icon: Presentation, permission: 'tools.kpi.access' },
    { path: 'kpi/teams', label: { fr: 'Équipes', en: 'Teams' }, icon: Users, permission: 'tools.kpi.access' },
  ],
  // Guided tour button, shown only on the KPI pages.
  topbarActions: TourButton,
  component: ToolsRoutes,
  // Opened from Administration → Modules, not from the KPI section.
  settings: {
    permission: 'tools.kpi.data',
    component: Settings,
    summary: { fr: 'Données KPI : importer, correspondance des personnes, instantanés, restaurer, effacer', en: 'KPI data: import, people matching, snapshots, restore, erase' },
  },
};
