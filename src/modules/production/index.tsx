import { Route, Routes } from 'react-router-dom';
import { Factory, LayoutDashboard } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import type { ModuleDef } from '../types';

/** Placeholder until the first production tools (Microsoft 365 / Dynamics) are added. */
function ProductionHome() {
  const { t } = useI18n();
  return (
    <Page>
      <PageHeader
        eyebrow={t('Production', 'Production')}
        title={t('Outils de production', 'Production tools')}
        subtitle={t('Outils de travail avec Microsoft 365 et Dynamics.', 'Tools for working with Microsoft 365 and Dynamics.')}
      />
      <div className="card">
        <Empty icon={<Factory size={36} />} title={t('Bientôt disponible', 'Coming soon')}>
          {t('Les premiers outils de production seront ajoutés ici.', 'The first production tools will be added here.')}
        </Empty>
      </div>
    </Page>
  );
}

function ProductionRoutes() {
  return (
    <Routes>
      <Route index element={<ProductionHome />} />
    </Routes>
  );
}

export const productionModule: ModuleDef = {
  id: 'production',
  path: '/production',
  name: { fr: 'Production', en: 'Production' },
  tagline: { fr: 'Outils Microsoft 365 et Dynamics', en: 'Microsoft 365 and Dynamics tools' },
  icon: Factory,
  accent: '#7c4dff',
  entryPermission: 'production.access',
  permissions: [{ key: 'production.access', label: { fr: 'Accéder au module', en: 'Access module' } }],
  nav: [{ path: '', label: { fr: 'Aperçu', en: 'Overview' }, icon: LayoutDashboard }],
  component: ProductionRoutes,
};
