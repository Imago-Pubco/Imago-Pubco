import { Navigate, Route, Routes } from 'react-router-dom';
import { UsersRound } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import type { ModuleDef } from '../types';
import { COMPLIANCE_SEGMENT, ComplianceRoutes, complianceNav, compliancePermissions, complianceWidgets } from '../compliance';

/** Module landing: opens the first section the user can see. */
function RhHome() {
  const { t } = useI18n();
  const { can } = useAuth();
  if (can('compliance.access')) return <Navigate to={COMPLIANCE_SEGMENT} replace />;
  return (
    <Page>
      <PageHeader title={t('Ressources humaines', 'Human resources')} />
      <div className="card">
        <Empty icon={<UsersRound size={36} />} title={t('Aucune section disponible', 'No section available')}>
          {t('Demandez l’accès à une section à un administrateur.', 'Ask an administrator for access to a section.')}
        </Empty>
      </div>
    </Page>
  );
}

function RhRoutes() {
  return (
    <Routes>
      <Route index element={<RhHome />} />
      <Route path={`${COMPLIANCE_SEGMENT}/*`} element={<ComplianceRoutes />} />
    </Routes>
  );
}

export const rhModule: ModuleDef = {
  id: 'rh',
  path: '/rh',
  name: { fr: 'RH', en: 'HR' },
  tagline: { fr: 'Ressources humaines et conformité', en: 'Human resources and compliance' },
  icon: UsersRound,
  accent: '#d6336c',
  entryPermission: 'rh.access',
  permissions: [{ key: 'rh.access', label: { fr: 'Accéder au module', en: 'Access module' } }, ...compliancePermissions],
  nav: [complianceNav],
  component: RhRoutes,
  widgets: complianceWidgets,
};
