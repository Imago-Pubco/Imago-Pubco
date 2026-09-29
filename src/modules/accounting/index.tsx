import { Route, Routes } from 'react-router-dom';
import { Calculator, LayoutDashboard, Inbox, FileStack, ClipboardList, Settings as SettingsIcon } from 'lucide-react';
import { RequirePermission } from '@/components/ui';
import type { ModuleDef } from '../types';
import { AccountingKpis, InvoicePipeline, InvoicesTodo, Overview } from './pages/Overview';
import { InboxPage } from './pages/InboxPage';
import { InvoiceList } from './pages/InvoiceList';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { Settings } from './pages/Settings';
import './accounting.css';

function AccountingRoutes() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="inbox" element={<RequirePermission permission="accounting.inbox.view"><InboxPage /></RequirePermission>} />
      <Route path="invoices" element={<InvoiceList />} />
      <Route path="invoices/:id" element={<InvoiceDetail />} />
      <Route path="purchase-orders" element={<RequirePermission permission="accounting.po.view"><PurchaseOrders /></RequirePermission>} />
      <Route path="settings" element={<RequirePermission permission="accounting.settings"><Settings /></RequirePermission>} />
    </Routes>
  );
}

/** Monarch orange — the accounting module's butterfly. */
export const accountingModule: ModuleDef = {
  id: 'accounting',
  path: '/accounting',
  name: { fr: 'Comptabilité', en: 'Accounting' },
  tagline: { fr: 'Factures fournisseurs ↔ Business Central', en: 'Vendor invoices ↔ Business Central' },
  icon: Calculator,
  accent: '#e07a10',
  entryPermission: 'accounting.access',
  permissions: [
    { key: 'accounting.access', label: { fr: 'Accéder au module', en: 'Access module' } },
    { key: 'accounting.inbox.view', label: { fr: 'Voir la boîte de réception', en: 'View inbox' } },
    { key: 'accounting.invoices.import', label: { fr: 'Importer des factures', en: 'Import invoices' } },
    { key: 'accounting.invoices.edit', label: { fr: 'Corriger les factures', en: 'Correct invoices' } },
    { key: 'accounting.invoices.validate', label: { fr: 'Valider avec Business Central', en: 'Validate with Business Central' } },
    { key: 'accounting.invoices.approve', label: { fr: 'Approuver / rejeter', en: 'Approve / reject' } },
    { key: 'accounting.invoices.post', label: { fr: 'Comptabiliser dans BC', en: 'Post to BC' } },
    {
      key: 'accounting.invoices.override',
      label: { fr: 'Déroger aux exceptions', en: 'Override exceptions' },
      description: { fr: 'Comptabiliser malgré des écarts', en: 'Post despite mismatches' },
    },
    { key: 'accounting.po.view', label: { fr: 'Voir les bons de commande', en: 'View purchase orders' } },
    { key: 'accounting.settings', label: { fr: 'Gérer les paramètres', en: 'Manage settings' } },
  ],
  nav: [
    { path: '', label: { fr: 'Aperçu', en: 'Overview' }, icon: LayoutDashboard },
    { path: 'inbox', label: { fr: 'Boîte de réception', en: 'Inbox' }, icon: Inbox, permission: 'accounting.inbox.view' },
    { path: 'invoices', label: { fr: 'Factures', en: 'Invoices' }, icon: FileStack },
    { path: 'purchase-orders', label: { fr: 'Bons de commande', en: 'Purchase orders' }, icon: ClipboardList, permission: 'accounting.po.view' },
    { path: 'settings', label: { fr: 'Paramètres', en: 'Settings' }, icon: SettingsIcon, permission: 'accounting.settings' },
  ],
  component: AccountingRoutes,
  widgets: [
    { id: 'accounting.kpis', title: { fr: 'Comptes fournisseurs', en: 'Accounts payable' }, permission: 'accounting.access', size: 2, component: AccountingKpis },
    { id: 'accounting.pipeline', title: { fr: 'Métamorphose des factures', en: 'Invoice metamorphosis' }, permission: 'accounting.access', size: 2, component: InvoicePipeline },
    { id: 'accounting.todo', title: { fr: 'Factures à traiter', en: 'Invoices to process' }, permission: 'accounting.access', size: 1, component: InvoicesTodo },
  ],
};
