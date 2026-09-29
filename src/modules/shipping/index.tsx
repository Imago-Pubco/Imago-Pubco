import { Route, Routes } from 'react-router-dom';
import { Truck, Tags, Plus, BookUser, Settings as SettingsIcon } from 'lucide-react';
import { RequirePermission } from '@/components/ui';
import type { ModuleDef } from '../types';
import { LabelList, LabelsTodo, ShippingKpis } from './pages/LabelList';
import { LabelEditorRoute } from './pages/LabelEditor';
import { Addresses, ShipSettings } from './pages/Addresses';
import './shipping.css';

function ShippingRoutes() {
  return (
    <Routes>
      <Route index element={<LabelList />} />
      <Route path="addresses" element={<Addresses />} />
      <Route path="settings" element={<RequirePermission permission="shipping.settings"><ShipSettings /></RequirePermission>} />
      <Route path=":id" element={<LabelEditorRoute />} />
    </Routes>
  );
}

/** Blue morpho — the shipping module's butterfly. */
export const shippingModule: ModuleDef = {
  id: 'shipping',
  path: '/shipping',
  name: { fr: 'Expédition', en: 'Shipping' },
  tagline: { fr: 'Étiquettes pour l’équipe de production', en: 'Labels for the production team' },
  icon: Truck,
  accent: '#1e6fd9',
  entryPermission: 'shipping.access',
  permissions: [
    { key: 'shipping.access', label: { fr: 'Accéder au module', en: 'Access module' } },
    { key: 'shipping.labels.create', label: { fr: 'Créer / modifier des étiquettes', en: 'Create / edit labels' } },
    { key: 'shipping.labels.print', label: { fr: 'Imprimer et expédier', en: 'Print and ship' } },
    { key: 'shipping.labels.void', label: { fr: 'Annuler des étiquettes', en: 'Void labels' } },
    { key: 'shipping.addresses.manage', label: { fr: 'Gérer le carnet d’adresses', en: 'Manage address book' } },
    { key: 'shipping.settings', label: { fr: 'Gérer les paramètres', en: 'Manage settings' } },
  ],
  nav: [
    { path: '', label: { fr: 'Étiquettes', en: 'Labels' }, icon: Tags },
    { path: 'new', label: { fr: 'Nouvelle étiquette', en: 'New label' }, icon: Plus, permission: 'shipping.labels.create' },
    { path: 'addresses', label: { fr: 'Carnet d’adresses', en: 'Address book' }, icon: BookUser },
    { path: 'settings', label: { fr: 'Paramètres', en: 'Settings' }, icon: SettingsIcon, permission: 'shipping.settings' },
  ],
  component: ShippingRoutes,
  widgets: [
    { id: 'shipping.kpis', title: { fr: 'Expédition', en: 'Shipping' }, permission: 'shipping.access', size: 2, component: ShippingKpis },
    { id: 'shipping.todo', title: { fr: 'Étiquettes à compléter', en: 'Labels to finish' }, permission: 'shipping.access', size: 1, component: LabelsTodo },
  ],
};
