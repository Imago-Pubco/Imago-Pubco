import { Navigate, Route, Routes } from 'react-router-dom';
import { Clock, Code2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader, RequirePermission } from '@/components/ui';
import type { ModuleDef } from '../types';

/** Punch card: placeholder until its features are specified. */
function PunchCardPage() {
  const { t } = useI18n();
  return (
    <Page>
      <PageHeader eyebrow={t('Développement', 'Development')} title={t('Punch card', 'Punch card')} />
      <div className="card">
        <p style={{ margin: 0 }}>Hello world</p>
      </div>
    </Page>
  );
}

function DevRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="punch-card" replace />} />
      <Route
        path="punch-card"
        element={
          <RequirePermission permission="dev.punchcard">
            <PunchCardPage />
          </RequirePermission>
        }
      />
    </Routes>
  );
}

export const devModule: ModuleDef = {
  id: 'dev',
  path: '/dev',
  name: { fr: 'Développement', en: 'Development' },
  tagline: { fr: 'Nouveaux outils en cours de développement', en: 'New tools under development' },
  icon: Code2,
  accent: '#7c3aed',
  entryPermission: 'dev.access',
  permissions: [
    { key: 'dev.access', label: { fr: 'Accéder au module', en: 'Access module' } },
    { key: 'dev.punchcard', label: { fr: 'Punch card', en: 'Punch card' } },
  ],
  nav: [{ path: 'punch-card', label: { fr: 'Punch card', en: 'Punch card' }, icon: Clock, permission: 'dev.punchcard' }],
  component: DevRoutes,
};
