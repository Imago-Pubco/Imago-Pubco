import { Route, Routes } from 'react-router-dom';
import { Compass, LayoutDashboard, Mountain, Presentation, Target } from 'lucide-react';
import type { ModuleDef } from '../types';
import { Dashboard } from './pages/Dashboard';
import { Strategy } from './pages/Strategy';
import { Rocks } from './pages/Rocks';
import { RockDetail } from './pages/RockDetail';
import { Huddles } from './pages/Huddles';
import { HuddleMeeting } from './pages/HuddleMeeting';
import { Settings } from './pages/Settings';
import './align.css';

function AlignRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="strategy" element={<Strategy />} />
      <Route path="rocks" element={<Rocks />} />
      <Route path="rocks/:id" element={<RockDetail />} />
      <Route path="huddles" element={<Huddles />} />
      <Route path="huddles/:id" element={<HuddleMeeting />} />
    </Routes>
  );
}

/** Align: company goals — strategy (one-page plan, 4D Vision), Rocks and their priorities, team huddles. */
export const alignModule: ModuleDef = {
  id: 'align',
  path: '/align',
  name: { fr: 'Align', en: 'Align' },
  tagline: { fr: 'Stratégie, Rocks et priorités de l’entreprise', en: 'Company strategy, Rocks and priorities' },
  icon: Target,
  accent: '#7c3aed',
  entryPermission: 'align.access',
  permissions: [
    {
      key: 'align.access',
      label: { fr: 'Accéder (tout voir, mettre à jour ses priorités, écrire des notes et des suivis)', en: 'Access (see everything, update one’s priorities, write notes and follow-ups)' },
    },
    { key: 'align.rocks.manage', label: { fr: 'Gérer les Rocks', en: 'Manage Rocks' } },
    { key: 'align.priorities.manage', label: { fr: 'Gérer et assigner toutes les priorités', en: 'Manage and assign all priorities' } },
    { key: 'align.strategy.manage', label: { fr: 'Modifier la stratégie (plan, Vision 4D, liste de vérification)', en: 'Edit the strategy (plan, 4D Vision, checklist)' } },
    { key: 'align.huddles.manage', label: { fr: 'Gérer les huddles', en: 'Manage huddles' } },
    { key: 'align.data', label: { fr: 'Importer les données depuis l’outil KPI', en: 'Import data from the KPI tool' } },
  ],
  nav: [
    { path: '', label: { fr: 'Tableau de bord', en: 'Dashboard' }, icon: LayoutDashboard },
    { path: 'strategy', label: { fr: 'Stratégie', en: 'Strategy' }, icon: Compass },
    { path: 'rocks', label: { fr: 'Rocks', en: 'Rocks' }, icon: Mountain },
    { path: 'huddles', label: { fr: 'Huddles', en: 'Huddles' }, icon: Presentation },
  ],
  component: AlignRoutes,
  settings: {
    permission: 'align.data',
    component: Settings,
    summary: { fr: 'Importer les Rocks, priorités et huddles depuis l’outil KPI', en: 'Import Rocks, priorities and huddles from the KPI tool' },
  },
};
