import { Navigate, Route, Routes } from 'react-router-dom';
import { Clock, Code2 } from 'lucide-react';
import { RequirePermission } from '@/components/ui';
import type { ModuleDef } from '../types';
import { FollowUp } from './punch/FollowUp';

function DevRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="punch-card" replace />} />
      <Route
        path="punch-card"
        element={
          <RequirePermission permission="dev.punchcard">
            <FollowUp />
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
