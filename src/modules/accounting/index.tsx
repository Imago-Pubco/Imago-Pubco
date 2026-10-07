import { Navigate, Route, Routes } from 'react-router-dom';
import { Calculator, LayoutDashboard, Inbox, FileStack, ClipboardList, Settings as SettingsIcon, Mail, FolderOpen, Receipt, ShoppingCart, ArrowDownToLine, ArrowUpFromLine, Wallet, HandCoins } from 'lucide-react';
import { RequirePermission } from '@/components/ui';
import type { ModuleDef } from '../types';
import { AccountingKpis, InvoicePipeline, InvoicesTodo, Overview } from './pages/Overview';
import { InboxPage } from './pages/InboxPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { InvoiceList } from './pages/InvoiceList';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { PoWorkspace } from './pages/PoWorkspace';
import { PoDetail } from './pages/PoDetail';
import { CustomerInvoicesPage } from './pages/BcInvoicesPage';
import { OpenItemsPage } from './pages/OpenItemsPage';
import { Settings } from './pages/Settings';
import './accounting.css';

function AccountingRoutes() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="inbox" element={<RequirePermission permission="accounting.inbox.view"><InboxPage /></RequirePermission>} />
      <Route path="inbox/documents" element={<RequirePermission permission="accounting.inbox.view"><DocumentsPage kind="all" /></RequirePermission>} />
      <Route path="inbox/documents/invoices" element={<RequirePermission permission="accounting.inbox.view"><DocumentsPage kind="invoice" /></RequirePermission>} />
      <Route path="inbox/documents/purchase-orders" element={<RequirePermission permission="accounting.inbox.view"><DocumentsPage kind="po" /></RequirePermission>} />
      <Route path="invoices" element={<InvoiceList />} />
      <Route path="invoices/:id" element={<InvoiceDetail />} />
      <Route path="customers" element={<Navigate to="purchase-orders" replace />} />
      <Route path="customers/purchase-orders" element={<RequirePermission permission="accounting.po.view"><PoWorkspace direction="customer" /></RequirePermission>} />
      <Route path="customers/invoices" element={<RequirePermission permission="accounting.po.view"><CustomerInvoicesPage /></RequirePermission>} />
      <Route path="customers/receivables" element={<RequirePermission permission="accounting.payables.view"><OpenItemsPage kind="sales" /></RequirePermission>} />
      <Route path="payables" element={<RequirePermission permission="accounting.payables.view"><OpenItemsPage kind="purchase" /></RequirePermission>} />
      <Route path="vendors" element={<Navigate to="/accounting/invoices" replace />} />
      <Route path="purchase-orders" element={<RequirePermission permission="accounting.po.view"><PoWorkspace direction="vendor" /></RequirePermission>} />
      <Route path="po/:id" element={<RequirePermission permission="accounting.po.view"><PoDetail /></RequirePermission>} />
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
    { key: 'accounting.payables.view', label: { fr: 'Voir À payer / À recevoir', en: 'View to pay / to collect' } },
    { key: 'accounting.po.view', label: { fr: 'Voir les bons de commande', en: 'View purchase orders' } },
    { key: 'accounting.po.process', label: { fr: 'Traiter les bons de commande reçus', en: 'Process received purchase orders' } },
    { key: 'accounting.po.approve', label: { fr: 'Approuver / rejeter les bons de commande', en: 'Approve / reject purchase orders' } },
    { key: 'accounting.settings', label: { fr: 'Gérer les paramètres', en: 'Manage settings' } },
  ],
  nav: [
    { path: '', label: { fr: 'Aperçu', en: 'Overview' }, icon: LayoutDashboard },
    {
      path: 'inbox',
      label: { fr: 'Boîte de réception', en: 'Inbox' },
      icon: Inbox,
      permission: 'accounting.inbox.view',
      children: [
        { path: 'inbox', label: { fr: 'Courriels', en: 'E-mail' }, icon: Mail },
        {
          path: 'inbox/documents',
          label: { fr: 'Documents', en: 'Documents' },
          icon: FolderOpen,
          children: [
            { path: 'inbox/documents/invoices', label: { fr: 'Factures', en: 'Invoices' }, icon: Receipt },
            { path: 'inbox/documents/purchase-orders', label: { fr: 'Bons de commande', en: 'Purchase orders' }, icon: ShoppingCart },
          ],
        },
      ],
    },
    {
      path: 'customers',
      label: { fr: 'Entrant', en: 'Incoming' },
      icon: ArrowDownToLine,
      permission: 'accounting.po.view',
      children: [
        { path: 'customers/purchase-orders', label: { fr: 'BC clients', en: 'Customer POs' }, icon: ClipboardList },
        { path: 'customers/invoices', label: { fr: 'Factures clients', en: 'Customer invoices' }, icon: FileStack },
        { path: 'customers/receivables', label: { fr: 'À recevoir', en: 'To collect' }, icon: HandCoins, permission: 'accounting.payables.view' },
      ],
    },
    {
      path: 'vendors',
      label: { fr: 'Sortant', en: 'Outgoing' },
      icon: ArrowUpFromLine,
      children: [
        { path: 'purchase-orders', label: { fr: 'BC fournisseurs', en: 'Vendor POs' }, icon: ClipboardList, permission: 'accounting.po.view' },
        { path: 'invoices', label: { fr: 'Factures fournisseurs', en: 'Vendor invoices' }, icon: FileStack },
        { path: 'payables', label: { fr: 'À payer', en: 'To pay' }, icon: Wallet, permission: 'accounting.payables.view' },
      ],
    },
    { path: 'settings', label: { fr: 'Paramètres', en: 'Settings' }, icon: SettingsIcon, permission: 'accounting.settings' },
  ],
  component: AccountingRoutes,
  widgets: [
    { id: 'accounting.kpis', title: { fr: 'Comptes fournisseurs', en: 'Accounts payable' }, permission: 'accounting.access', size: 2, component: AccountingKpis },
    { id: 'accounting.pipeline', title: { fr: 'Métamorphose des factures', en: 'Invoice metamorphosis' }, permission: 'accounting.access', size: 2, component: InvoicePipeline },
    { id: 'accounting.todo', title: { fr: 'Factures à traiter', en: 'Invoices to process' }, permission: 'accounting.access', size: 1, component: InvoicesTodo },
  ],
};
