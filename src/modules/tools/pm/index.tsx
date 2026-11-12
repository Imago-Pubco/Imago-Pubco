import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { BadgeCheck, BarChart3, Briefcase, CalendarRange, CheckSquare, Clock, FolderKanban, GanttChart, LayoutDashboard, UserCog, UsersRound } from 'lucide-react';
import { RequirePermission } from '@/components/ui';
import type { ModuleDef } from '../../types';
import { PmDashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { Clients } from './pages/Clients';
import { PmTasks } from './pages/Tasks';
import { Timesheet } from './pages/Timesheet';
import { Approvals } from './pages/Approvals';
import { Schedule } from './pages/Schedule';
import { Workload } from './pages/Workload';
import { Reports } from './pages/Reports';
import { Team } from './pages/Team';

function PmRoutes() {
  const need = (permission: string, el: ReactElement) => <RequirePermission permission={permission}>{el}</RequirePermission>;
  return (
    <Routes>
      <Route index element={<PmDashboard />} />
      <Route path="projects" element={<Projects />} />
      <Route path="projects/:id" element={<ProjectDetail />} />
      <Route path="clients" element={<Clients />} />
      <Route path="tasks" element={<PmTasks />} />
      <Route path="timesheet" element={<Timesheet />} />
      <Route path="approvals" element={need('tools.pm.approve', <Approvals />)} />
      <Route path="schedule" element={<Schedule />} />
      <Route path="workload" element={<Workload />} />
      <Route path="reports" element={need('tools.pm.reports', <Reports />)} />
      <Route path="team" element={need('tools.pm.manage', <Team />)} />
    </Routes>
  );
}

/**
 * Gestion de projet: its own module (sidebar entry and block in the rights screens).
 * The id `tools.pm` keeps the existing permission keys (`tools.pm.*`) and URLs (`/tools/pm/...`), so
 * "Entire module" in the rights screens grants exactly `tools.pm.*` and existing grants keep working.
 */
export const pmModule: ModuleDef = {
  id: 'tools.pm',
  path: '/tools/pm',
  name: { fr: 'Gestion de projet', en: 'Project management' },
  tagline: { fr: 'Projets, tâches, feuilles de temps, budgets et rapports', en: 'Projects, tasks, timesheets, budgets and reports' },
  icon: Briefcase,
  accent: '#2563eb',
  entryPermission: 'tools.pm.access',
  permissions: [
    { key: 'tools.pm.access', label: { fr: 'Utiliser (voir les projets, saisir son temps, ses tâches)', en: 'Use (see projects, enter one’s time and tasks)' } },
    { key: 'tools.pm.manage', label: { fr: 'Gérer (clients, projets, dépenses, taux de facturation, équipe)', en: 'Manage (clients, projects, expenses, billing rates, team)' } },
    { key: 'tools.pm.approve', label: { fr: 'Approuver les feuilles de temps', en: 'Approve timesheets' } },
    { key: 'tools.pm.reports', label: { fr: 'Rapports, rentabilité et coûts', en: 'Reports, profitability and costs' } },
  ],
  nav: [
    { path: '', label: { fr: 'Tableau de bord', en: 'Dashboard' }, icon: LayoutDashboard },
    { path: 'projects', label: { fr: 'Projets', en: 'Projects' }, icon: FolderKanban },
    { path: 'tasks', label: { fr: 'Tâches', en: 'Tasks' }, icon: CheckSquare },
    { path: 'timesheet', label: { fr: 'Feuille de temps', en: 'Timesheet' }, icon: Clock },
    { path: 'approvals', label: { fr: 'Approbations', en: 'Approvals' }, icon: BadgeCheck, permission: 'tools.pm.approve' },
    { path: 'schedule', label: { fr: 'Échéancier', en: 'Schedule' }, icon: GanttChart },
    { path: 'workload', label: { fr: 'Disponibilités', en: 'Availability' }, icon: CalendarRange },
    { path: 'clients', label: { fr: 'Clients', en: 'Clients' }, icon: UsersRound },
    { path: 'reports', label: { fr: 'Rapports', en: 'Reports' }, icon: BarChart3, permission: 'tools.pm.reports' },
    { path: 'team', label: { fr: 'Équipe et taux', en: 'Team and rates' }, icon: UserCog, permission: 'tools.pm.manage' },
  ],
  component: PmRoutes,
};
