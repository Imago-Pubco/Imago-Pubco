import { Route, Routes } from 'react-router-dom';
import { Ruler, LayoutDashboard, FileStack, Plus, Layers, Settings as SettingsIcon } from 'lucide-react';
import { RequirePermission } from '@/components/ui';
import type { ModuleDef } from '../types';
import { EstimatesTodo, EstimatingKpis, Overview } from './pages/Overview';
import { EstimateList } from './pages/EstimateList';
import { EstimateEditorRoute } from './pages/EstimateEditor';
import { Materials } from './pages/Materials';
import { EstSettingsPage } from './pages/Settings';
import './estimating.css';

function EstimatingRoutes() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="list" element={<EstimateList />} />
      <Route path="materials" element={<Materials />} />
      <Route path="settings" element={<RequirePermission permission="estimating.settings"><EstSettingsPage /></RequirePermission>} />
      <Route path=":id" element={<EstimateEditorRoute />} />
    </Routes>
  );
}

/** Green hairstreak — the estimating module's butterfly. */
export const estimatingModule: ModuleDef = {
  id: 'estimating',
  path: '/estimating',
  name: { fr: 'Estimation', en: 'Estimating' },
  tagline: { fr: 'Prix des emballages sur mesure', en: 'Custom packaging pricing' },
  icon: Ruler,
  accent: '#2e9e5b',
  entryPermission: 'estimating.access',
  permissions: [
    { key: 'estimating.access', label: { fr: 'Accéder au module', en: 'Access module' } },
    { key: 'estimating.edit', label: { fr: 'Créer / modifier des estimations', en: 'Create / edit estimates' } },
    { key: 'estimating.pricing.view', label: { fr: 'Voir les coûts et marges', en: 'View costs and margins' } },
    { key: 'estimating.approve', label: { fr: 'Soumettre et conclure', en: 'Send and close' } },
    { key: 'estimating.catalog', label: { fr: 'Gérer les matériaux et tarifs', en: 'Manage materials & rates' } },
    { key: 'estimating.settings', label: { fr: 'Gérer les paramètres de chiffrage', en: 'Manage costing settings' } },
  ],
  nav: [
    { path: '', label: { fr: 'Aperçu', en: 'Overview' }, icon: LayoutDashboard },
    { path: 'list', label: { fr: 'Estimations', en: 'Estimates' }, icon: FileStack },
    { path: 'new', label: { fr: 'Nouvelle estimation', en: 'New estimate' }, icon: Plus, permission: 'estimating.edit' },
    { path: 'materials', label: { fr: 'Matériaux et tarifs', en: 'Materials & rates' }, icon: Layers },
    { path: 'settings', label: { fr: 'Paramètres', en: 'Settings' }, icon: SettingsIcon, permission: 'estimating.settings' },
  ],
  component: EstimatingRoutes,
  widgets: [
    { id: 'estimating.kpis', title: { fr: 'Estimation', en: 'Estimating' }, permission: 'estimating.access', size: 2, component: EstimatingKpis },
    { id: 'estimating.todo', title: { fr: 'Estimations à chiffrer', en: 'Estimates to cost' }, permission: 'estimating.access', size: 1, component: EstimatesTodo },
  ],
};
