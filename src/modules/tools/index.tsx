import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { BarChart3, Briefcase, CalendarRange, CheckSquare, Clock, FolderKanban, Gauge, GanttChart, LayoutDashboard, ListChecks, Target, UserCog, Users, UsersRound, Wrench, Presentation, BadgeCheck } from 'lucide-react';
import { RequirePermission } from '@/components/ui';
import type { ModuleDef } from '../types';
import { Dashboard } from './pages/Dashboard';
import { Kpis } from './pages/Kpis';
import { Priorities } from './pages/Priorities';
import { Huddles } from './pages/Huddles';
import { HuddleMeeting } from './pages/HuddleMeeting';
import { Teams } from './pages/Teams';
import { Settings } from './pages/Settings';
import { PmDashboard } from './pm/pages/Dashboard';
import { Projects } from './pm/pages/Projects';
import { ProjectDetail } from './pm/pages/ProjectDetail';
import { Clients } from './pm/pages/Clients';
import { PmTasks } from './pm/pages/Tasks';
import { Timesheet } from './pm/pages/Timesheet';
import { Approvals } from './pm/pages/Approvals';
import { Schedule } from './pm/pages/Schedule';
import { Workload } from './pm/pages/Workload';
import { Reports } from './pm/pages/Reports';
import { Team } from './pm/pages/Team';

function ToolsRoutes() {
  const guard = (el: ReactElement) => <RequirePermission permission="tools.kpi.access">{el}</RequirePermission>;
  const pm = (el: ReactElement) => <RequirePermission permission="tools.pm.access">{el}</RequirePermission>;
  return (
    <Routes>
      <Route index element={guard(<Dashboard />)} />
      <Route path="kpi" element={guard(<Dashboard />)} />
      <Route path="kpi/indicators" element={guard(<Kpis />)} />
      <Route path="kpi/priorities" element={guard(<Priorities />)} />
      <Route path="kpi/huddles" element={guard(<Huddles />)} />
      <Route path="kpi/huddles/:id" element={guard(<HuddleMeeting />)} />
      <Route path="kpi/teams" element={guard(<Teams />)} />
      <Route path="pm" element={pm(<PmDashboard />)} />
      <Route path="pm/projects" element={pm(<Projects />)} />
      <Route path="pm/projects/:id" element={pm(<ProjectDetail />)} />
      <Route path="pm/clients" element={pm(<Clients />)} />
      <Route path="pm/tasks" element={pm(<PmTasks />)} />
      <Route path="pm/timesheet" element={pm(<Timesheet />)} />
      <Route path="pm/approvals" element={<RequirePermission permission="tools.pm.approve">{<Approvals />}</RequirePermission>} />
      <Route path="pm/schedule" element={pm(<Schedule />)} />
      <Route path="pm/workload" element={pm(<Workload />)} />
      <Route path="pm/reports" element={<RequirePermission permission="tools.pm.reports">{<Reports />}</RequirePermission>} />
      <Route path="pm/team" element={<RequirePermission permission="tools.pm.manage">{<Team />}</RequirePermission>} />
    </Routes>
  );
}

/** Tools: small internal tools that do not belong to a department module. The first one is "KPI" (working name). */
export const toolsModule: ModuleDef = {
  id: 'tools',
  path: '/tools',
  name: { fr: 'Outils', en: 'Tools' },
  tagline: { fr: 'Indicateurs, priorités, huddles et gestion de projet', en: 'KPIs, priorities, huddles and project management' },
  icon: Wrench,
  accent: '#0d9488',
  entryPermission: 'tools.access',
  permissions: [
    { key: 'tools.access', label: { fr: 'Outils : accéder au module', en: 'Tools: access the module' } },
    { key: 'tools.kpi.data', label: { fr: 'Outils : gérer les données KPI (importer, instantanés, restaurer, tout effacer)', en: 'Tools: manage KPI data (import, snapshots, restore, erase all)' } },
    { key: 'tools.pm.access', label: { fr: 'Gestion de projet : utiliser (voir les projets, saisir son temps, ses tâches)', en: 'Project management: use (see projects, enter one’s time and tasks)' } },
    { key: 'tools.pm.manage', label: { fr: 'Gestion de projet : gérer (clients, projets, dépenses, taux de facturation, équipe)', en: 'Project management: manage (clients, projects, expenses, billing rates, team)' } },
    { key: 'tools.pm.approve', label: { fr: 'Gestion de projet : approuver les feuilles de temps', en: 'Project management: approve timesheets' } },
    { key: 'tools.pm.reports', label: { fr: 'Gestion de projet : rapports, rentabilité et coûts', en: 'Project management: reports, profitability and costs' } },
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
    {
      path: 'pm',
      label: { fr: 'Gestion de projet', en: 'Project management' },
      icon: Briefcase,
      permission: 'tools.pm.access',
      children: [
        { path: 'pm', label: { fr: 'Tableau de bord', en: 'Dashboard' }, icon: LayoutDashboard },
        { path: 'pm/projects', label: { fr: 'Projets', en: 'Projects' }, icon: FolderKanban },
        { path: 'pm/tasks', label: { fr: 'Tâches', en: 'Tasks' }, icon: CheckSquare },
        { path: 'pm/timesheet', label: { fr: 'Feuille de temps', en: 'Timesheet' }, icon: Clock },
        { path: 'pm/approvals', label: { fr: 'Approbations', en: 'Approvals' }, icon: BadgeCheck, permission: 'tools.pm.approve' },
        { path: 'pm/schedule', label: { fr: 'Échéancier', en: 'Schedule' }, icon: GanttChart },
        { path: 'pm/workload', label: { fr: 'Disponibilités', en: 'Availability' }, icon: CalendarRange },
        { path: 'pm/clients', label: { fr: 'Clients', en: 'Clients' }, icon: UsersRound },
        { path: 'pm/reports', label: { fr: 'Rapports', en: 'Reports' }, icon: BarChart3, permission: 'tools.pm.reports' },
        { path: 'pm/team', label: { fr: 'Équipe et taux', en: 'Team and rates' }, icon: UserCog, permission: 'tools.pm.manage' },
      ],
    },
  ],
  component: ToolsRoutes,
  // Opened from Administration → Modules, not from the KPI section.
  settings: {
    permission: 'tools.kpi.data',
    component: Settings,
    summary: { fr: 'Données KPI : importer, correspondance des personnes, instantanés, restaurer, effacer', en: 'KPI data: import, people matching, snapshots, restore, erase' },
  },
};
