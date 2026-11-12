import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Gauge, LayoutDashboard, ListChecks, Target, Users, Wrench, Presentation } from 'lucide-react';
import { RequirePermission } from '@/components/ui';
import type { ModuleDef } from '../types';
import { Dashboard } from './pages/Dashboard';
import { Kpis } from './pages/Kpis';
import { Priorities } from './pages/Priorities';
import { Huddles } from './pages/Huddles';
import { HuddleMeeting } from './pages/HuddleMeeting';
import { Teams } from './pages/Teams';

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

/** Tools: small internal tools that do not belong to a department module. The first one is "KPI" (working name). */
export const toolsModule: ModuleDef = {
  id: 'tools',
  path: '/tools',
  name: { fr: 'Outils', en: 'Tools' },
  tagline: { fr: 'Indicateurs, priorités et huddles', en: 'KPIs, priorities and huddles' },
  icon: Wrench,
  accent: '#0d9488',
  entryPermission: 'tools.access',
  permissions: [
    { key: 'tools.access', label: { fr: 'Outils : accéder au module', en: 'Tools: access the module' } },
    { key: 'tools.kpi.access', label: { fr: 'Outils : utiliser l’outil KPI (indicateurs, priorités, huddles)', en: 'Tools: use the KPI tool (indicators, priorities, huddles)' } },
  ],
  nav: [
    {
      path: 'kpi',
      label: { fr: 'KPI', en: 'KPI' },
      icon: Gauge,
      permission: 'tools.kpi.access',
      children: [
        { path: 'kpi', label: { fr: 'Tableau de bord', en: 'Dashboard' }, icon: LayoutDashboard },
        { path: 'kpi/indicators', label: { fr: 'Indicateurs', en: 'Indicators' }, icon: Target },
        { path: 'kpi/priorities', label: { fr: 'Priorités', en: 'Priorities' }, icon: ListChecks },
        { path: 'kpi/huddles', label: { fr: 'Huddles', en: 'Huddles' }, icon: Presentation },
        { path: 'kpi/teams', label: { fr: 'Équipes', en: 'Teams' }, icon: Users },
      ],
    },
  ],
  component: ToolsRoutes,
};
