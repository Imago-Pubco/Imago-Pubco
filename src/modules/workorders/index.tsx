import { Route, Routes } from 'react-router-dom';
import { ClipboardList, Kanban, ListChecks } from 'lucide-react';
import type { ModuleDef } from '../types';
import { Board } from './pages/Board';
import { WorkOrderList } from './pages/WorkOrderList';
import { WorkOrderDetail } from './pages/WorkOrderDetail';
import { MyTasks, WorkOrderKpis } from './widgets';
import './workorders.css';

function WorkOrdersRoutes() {
  return (
    <Routes>
      <Route index element={<Board />} />
      <Route path="list" element={<WorkOrderList />} />
      <Route path=":id" element={<WorkOrderDetail />} />
    </Routes>
  );
}

/** Production work orders: the manager plans them and delegates tasks to the team. */
export const workOrdersModule: ModuleDef = {
  id: 'workorders',
  path: '/workorders',
  name: { fr: 'Ordres de travail', en: 'Work orders' },
  tagline: { fr: 'Suivi de production des commandes acceptées', en: 'Production tracking for accepted orders' },
  icon: ClipboardList,
  accent: '#7c3aed',
  entryPermission: 'workorders.access',
  permissions: [
    { key: 'workorders.access', label: { fr: 'Accéder au module', en: 'Access module' } },
    {
      key: 'workorders.manage',
      label: { fr: 'Gérer les ordres (responsable, tâches, statuts)', en: 'Manage orders (manager, tasks, status)' },
    },
    {
      key: 'workorders.work',
      label: { fr: 'Travailler sur ses tâches (statut, notes)', en: 'Work on own tasks (status, notes)' },
    },
  ],
  nav: [
    { path: '', label: { fr: 'Tableau', en: 'Board' }, icon: Kanban },
    { path: 'list', label: { fr: 'Liste', en: 'List' }, icon: ListChecks },
  ],
  component: WorkOrdersRoutes,
  widgets: [
    {
      id: 'workorders.kpis',
      title: { fr: 'Ordres de travail', en: 'Work orders' },
      permission: 'workorders.access',
      size: 2,
      component: WorkOrderKpis,
    },
    {
      id: 'workorders.mytasks',
      title: { fr: 'Mes tâches', en: 'My tasks' },
      permission: 'workorders.access',
      size: 1,
      component: MyTasks,
    },
  ],
};
