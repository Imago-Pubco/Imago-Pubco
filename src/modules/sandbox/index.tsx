import { Route, Routes } from 'react-router-dom';
import { FlaskConical, Inbox, ListChecks } from 'lucide-react';
import type { ModuleDef } from '../types';
import { SandboxHome } from './SandboxHome';
import { SandboxWorkspace } from './SandboxWorkspace';
import './sandbox.css';

function SandboxRoutes() {
  return (
    <Routes>
      <Route index element={<SandboxHome />} />
      <Route path="review" element={<SandboxHome review />} />
      <Route path=":id" element={<SandboxWorkspace />} />
    </Routes>
  );
}

/**
 * Sandbox (opened from the user menu): describe a change, Claude makes it in a private copy of the app, see it in a
 * preview, submit it for approval. Nothing reaches the real app without an approver (server/sandbox.ts).
 */
export const sandboxModule: ModuleDef = {
  id: 'sandbox',
  path: '/sandbox',
  name: { fr: 'Sandbox', en: 'Sandbox' },
  tagline: { fr: 'Proposer des changements à l’application avec Claude', en: 'Propose changes to the app with Claude' },
  icon: FlaskConical,
  accent: '#0e9fbf',
  entryPermission: 'sandbox.use',
  placement: 'userMenu',
  permissions: [
    { key: 'sandbox.use', label: { fr: 'Utiliser le Sandbox (proposer des changements sur les modules permis)', en: 'Use the Sandbox (propose changes on allowed modules)' } },
    { key: 'sandbox.review', label: { fr: 'Réviser et approuver les demandes du Sandbox', en: 'Review and approve Sandbox requests' } },
  ],
  nav: [
    { path: '', label: { fr: 'Mes demandes', en: 'My requests' }, icon: ListChecks },
    { path: 'review', label: { fr: 'À réviser', en: 'To review' }, icon: Inbox, permission: 'sandbox.review' },
  ],
  component: SandboxRoutes,
};
