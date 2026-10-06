/**
 * Conformité — a section of the RH module (mounted at /rh/conformite).
 * Exports its routes, nav, permissions and widgets; the RH module (src/modules/rh) composes them.
 */
import { Route, Routes } from 'react-router-dom';
import { BadgeCheck, LayoutDashboard, Library, ClipboardCheck, FileText } from 'lucide-react';
import type { NavItem, PermissionDef, WidgetDef } from '../types';
import { ComplianceKpis, DeadlineList, Overview } from './pages/Overview';
import { Frameworks } from './pages/Frameworks';
import { FrameworkDetail } from './pages/FrameworkDetail';
import { Audits } from './pages/Audits';
import { Documents } from './pages/Documents';
import './compliance.css';

/** Path of the section inside the RH module. */
export const COMPLIANCE_SEGMENT = 'conformite';

export function ComplianceRoutes() {
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

const s = (p: string) => (p ? `${COMPLIANCE_SEGMENT}/${p}` : COMPLIANCE_SEGMENT);

export const complianceNav: NavItem = {
  path: COMPLIANCE_SEGMENT,
  label: { fr: 'Conformité', en: 'Compliance' },
  icon: BadgeCheck,
  permission: 'compliance.access',
  children: [
    { path: s(''), label: { fr: 'Aperçu', en: 'Overview' }, icon: LayoutDashboard },
    { path: s('frameworks'), label: { fr: 'Référentiels', en: 'Frameworks' }, icon: Library },
    { path: s('audits'), label: { fr: 'Audits et NC', en: 'Audits & NC' }, icon: ClipboardCheck },
    { path: s('documents'), label: { fr: 'Politiques et procédures', en: 'Policies & procedures' }, icon: FileText },
  ],
};

export const compliancePermissions: PermissionDef[] = [
  { key: 'compliance.access', label: { fr: 'Conformité : accéder', en: 'Compliance: access' } },
  { key: 'compliance.edit', label: { fr: 'Conformité : gérer les exigences et preuves', en: 'Compliance: manage requirements & evidence' } },
  { key: 'compliance.frameworks', label: { fr: 'Conformité : créer / modifier les référentiels', en: 'Compliance: create / edit frameworks' } },
  { key: 'compliance.audits', label: { fr: 'Conformité : gérer les audits et non-conformités', en: 'Compliance: manage audits & non-conformities' } },
  { key: 'compliance.documents', label: { fr: 'Conformité : gérer les politiques et procédures', en: 'Compliance: manage policies & procedures' } },
];

export const complianceWidgets: WidgetDef[] = [
  { id: 'compliance.kpis', title: { fr: 'Conformité', en: 'Compliance' }, permission: 'compliance.access', size: 2, component: ComplianceKpis },
  { id: 'compliance.deadlines', title: { fr: 'Échéances de conformité', en: 'Compliance deadlines' }, permission: 'compliance.access', size: 1, component: () => <DeadlineList limit={5} /> },
];
