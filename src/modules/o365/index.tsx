import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Building2, Cloud, Contact, KeyRound, Users, UsersRound } from 'lucide-react';
import type { ModuleDef } from '../types';
import { Tenants } from './pages/Tenants';
import { Users as UsersPage } from './pages/Users';
import { Contacts } from './pages/Contacts';
import { Groups } from './pages/Groups';
import { Licenses } from './pages/Licenses';
import { TenantPicker } from './ui';
import './o365.css';

/** The tenants section is restricted: users without access land on the Users page. */
function TenantsGate() {
  const { can } = useAuth();
  return can('o365.tenants.view') || can('o365.tenants.manage') ? <Tenants /> : <Navigate to="users" replace />;
}

function O365Routes() {
  return (
    <Routes>
      <Route index element={<TenantsGate />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="contacts" element={<Contacts />} />
      <Route path="groups" element={<Groups />} />
      <Route path="licenses" element={<Licenses />} />
    </Routes>
  );
}

export const o365Module: ModuleDef = {
  id: 'o365',
  path: '/o365',
  name: { fr: 'Gestion O365', en: 'O365 management' },
  tagline: { fr: 'Locataires, utilisateurs, groupes et licences Microsoft 365', en: 'Microsoft 365 tenants, users, groups and licenses' },
  icon: Cloud,
  accent: '#0f6cbd',
  entryPermission: 'o365.access',
  permissions: [
    { key: 'o365.access', label: { fr: 'Accéder au module (lecture)', en: 'Access module (read)' } },
    { key: 'o365.tenants.view', label: { fr: 'Voir la section Locataires', en: 'See the Tenants section' } },
    { key: 'o365.tenants.manage', label: { fr: 'Ajouter / retirer des locataires', en: 'Add / remove tenants' } },
    { key: 'o365.users.manage', label: { fr: 'Gérer les utilisateurs et leurs licences', en: 'Manage users and their licenses' } },
    { key: 'o365.contacts.manage', label: { fr: 'Ajouter / supprimer des contacts', en: 'Add / delete contacts' } },
    { key: 'o365.groups.manage', label: { fr: 'Gérer les membres des groupes de distribution', en: 'Manage distribution group members' } },
  ],
  nav: [
    { path: '', label: { fr: 'Locataires', en: 'Tenants' }, icon: Building2, permission: 'o365.tenants.view' },
    { path: 'users', label: { fr: 'Utilisateurs', en: 'Users' }, icon: Users },
    { path: 'contacts', label: { fr: 'Contacts', en: 'Contacts' }, icon: Contact },
    { path: 'groups', label: { fr: 'Groupes de distribution', en: 'Distribution groups' }, icon: UsersRound },
    { path: 'licenses', label: { fr: 'Licences', en: 'Licenses' }, icon: KeyRound },
  ],
  topbarActions: TenantPicker,
  component: O365Routes,
};
