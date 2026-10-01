import { Route, Routes } from 'react-router-dom';
import { BadgeCheck, LayoutDashboard, Library, ClipboardCheck, FileText } from 'lucide-react';
import type { ModuleDef } from '../types';
import { ComplianceKpis, DeadlineList, Overview } from './pages/Overview';
import { Frameworks } from './pages/Frameworks';
import { FrameworkDetail } from './pages/FrameworkDetail';
import { Audits } from './pages/Audits';
import { Documents } from './pages/Documents';
import './compliance.css';

function ComplianceRoutes() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="frameworks" element={<Frameworks />} />
      <Route path="frameworks/:id" element={<FrameworkDetail />} />
      <Route path="audits" element={<Audits />} />
      <Route path="documents" element={<Documents />} />
    </Routes>
  );
}

export const complianceModule: ModuleDef = {
  id: 'compliance',
  path: '/compliance',
  name: { fr: 'Conformité', en: 'Compliance' },
  tagline: { fr: 'ISO, Loi 25, FSC, SST…', en: 'ISO, Law 25, FSC, H&S…' },
  icon: BadgeCheck,
  accent: '#d6336c',
  entryPermission: 'compliance.access',
  permissions: [
    { key: 'compliance.access', label: { fr: 'Accéder au module', en: 'Access module' } },
    { key: 'compliance.edit', label: { fr: 'Gérer les exigences et preuves', en: 'Manage requirements & evidence' } },
    { key: 'compliance.frameworks', label: { fr: 'Créer / modifier les référentiels', en: 'Create / edit frameworks' } },
    { key: 'compliance.audits', label: { fr: 'Gérer les audits et non-conformités', en: 'Manage audits & non-conformities' } },
    { key: 'compliance.documents', label: { fr: 'Gérer les politiques et procédures', en: 'Manage policies & procedures' } },
  ],
  nav: [
    { path: '', label: { fr: 'Aperçu', en: 'Overview' }, icon: LayoutDashboard },
    { path: 'frameworks', label: { fr: 'Référentiels', en: 'Frameworks' }, icon: Library },
    { path: 'audits', label: { fr: 'Audits et NC', en: 'Audits & NC' }, icon: ClipboardCheck },
    { path: 'documents', label: { fr: 'Politiques et procédures', en: 'Policies & procedures' }, icon: FileText },
  ],
  component: ComplianceRoutes,
  widgets: [
    { id: 'compliance.kpis', title: { fr: 'Conformité', en: 'Compliance' }, permission: 'compliance.access', size: 2, component: ComplianceKpis },
    { id: 'compliance.deadlines', title: { fr: 'Échéances de conformité', en: 'Compliance deadlines' }, permission: 'compliance.access', size: 1, component: () => <DeadlineList limit={5} /> },
  ],
};
