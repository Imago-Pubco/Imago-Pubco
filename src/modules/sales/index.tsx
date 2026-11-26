import { Navigate, Route, Routes } from 'react-router-dom';
import { Handshake, ClipboardList, Globe, Plus, Route as RouteIcon } from 'lucide-react';
import { RequirePermission } from '@/components/ui';
import type { ModuleDef } from '../types';
import { Tracker } from './pages/Tracker';
import { RequestList } from './pages/RequestList';
import { RequestRedirect } from './pages/RequestDetail';
import { NewRequest } from './pages/NewRequest';
import { PublicForm } from './pages/PublicForm';
import { SalesBlockedWidget, SalesKpis } from './components/Widgets';
import './sales.css';

function SalesRoutes() {
  return (
    <div className="sl-root">
      <Routes>
        <Route index element={<Tracker />} />
        <Route path="requests" element={<RequestList />} />
        <Route path="requests/new" element={<RequirePermission permission="sales.edit"><NewRequest /></RequirePermission>} />
        <Route path="requests/:id" element={<RequestRedirect />} />
        <Route path="form" element={<RequirePermission permission="sales.settings"><PublicForm /></RequirePermission>} />
        <Route path="*" element={<Navigate to="/sales" replace />} />
      </Routes>
    </div>
  );
}

/** Sales: the circuit every customer request follows, from the first e-mail to production. Vermilion. */
export const salesModule: ModuleDef = {
  id: 'sales',
  path: '/sales',
  name: { fr: 'Ventes', en: 'Sales' },
  tagline: { fr: 'Du client à la production', en: 'From customer to production' },
  icon: Handshake,
  accent: '#c2410c',
  entryPermission: 'sales.access',
  permissions: [
    { key: 'sales.access', label: { fr: 'Accéder au module', en: 'Access module' } },
    { key: 'sales.edit', label: { fr: 'Créer et modifier les demandes, notes et blocages', en: 'Create and edit requests, notes and blockers' } },
    { key: 'sales.send', label: { fr: 'Envoyer les soumissions et passer en production', en: 'Send quotes and move to production' } },
    { key: 'sales.studio', label: { fr: 'Travail du studio (croquis, découpes)', en: 'Studio work (sketches, dielines)' } },
    { key: 'sales.settings', label: { fr: 'Formulaire public et boîte courriel', en: 'Public form and mailbox' } },
  ],
  nav: [
    { path: '', label: { fr: 'Suivi', en: 'Tracker' }, icon: RouteIcon },
    { path: 'requests', label: { fr: 'Demandes', en: 'Requests' }, icon: ClipboardList },
    { path: 'requests/new', label: { fr: 'Nouvelle demande', en: 'New request' }, icon: Plus, permission: 'sales.edit' },
    { path: 'form', label: { fr: 'Formulaire public', en: 'Public form' }, icon: Globe, permission: 'sales.settings' },
  ],
  component: SalesRoutes,
  widgets: [
    { id: 'sales.kpis', title: { fr: 'Ventes', en: 'Sales' }, permission: 'sales.access', size: 2, component: SalesKpis },
    { id: 'sales.blocked', title: { fr: 'Demandes bloquées', en: 'Blocked requests' }, permission: 'sales.access', size: 1, component: SalesBlockedWidget },
  ],
};
