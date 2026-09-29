import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { ShieldCheck, LayoutDashboard, Users as UsersIcon, KeyRound, ScrollText, Server } from 'lucide-react';
import { useCollection } from '@/data/db';
import { groups, users } from '@/data/stores';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader, RequirePermission } from '@/components/ui';
import { Kpi, KpiGrid } from '@/components/Kpi';
import type { ModuleDef } from '../types';
import { Users } from './pages/Users';
import { Groups } from './pages/Groups';
import { Audit, AuditTable } from './pages/Audit';
import { System } from './pages/System';
import './admin.css';

function AdminKpis() {
  const { t } = useI18n();
  const { rows: u } = useCollection(users);
  const { rows: g } = useCollection(groups);
  const week = Date.now() - 7 * 864e5;
  return (
    <KpiGrid>
      <Kpi to="/admin/users" label={t('Utilisateurs actifs', 'Active users')} value={u.filter((x) => x.active).length} hint={t(`${u.length} au total`, `${u.length} total`)} icon={<UsersIcon size={17} />} tone="accent" />
      <Kpi to="/admin/groups" label={t('Groupes d’accès', 'Access groups')} value={g.length} icon={<KeyRound size={17} />} />
      <Kpi label={t('Connectés cette semaine', 'Signed in this week')} value={u.filter((x) => x.lastLoginAt && Date.parse(x.lastLoginAt) > week).length} icon={<ShieldCheck size={17} />} tone="ok" />
    </KpiGrid>
  );
}

function Overview() {
  const { t } = useI18n();
  return (
    <Page>
      <PageHeader eyebrow={t('Administration', 'Administration')} title={t('Portail administratif', 'Admin portal')} subtitle={t('Utilisateurs, groupes d’accès et traçabilité.', 'Users, access groups and traceability.')} />
      <AdminKpis />
      <div className="card">
        <div className="card-head">
          <h3>{t('Activité récente', 'Recent activity')}</h3>
          <Link to="/admin/audit" className="btn btn-ghost btn-sm">
            {t('Journal complet', 'Full log')}
          </Link>
        </div>
        <AuditTable limit={10} />
      </div>
    </Page>
  );
}

/** Admin is reached from the user menu, so it carries its own tab bar. */
function AdminTabs() {
  const { t } = useI18n();
  const { can } = useAuth();
  return (
    <nav className="module-tabs">
      {adminModule.nav
        .filter((n) => !n.permission || can(n.permission))
        .map((n) => {
          const Icon = n.icon;
          return (
            <NavLink key={n.path} to={`/admin${n.path ? '/' + n.path : ''}`} end={!n.path} className="module-tab">
              <Icon size={15} /> {t(n.label)}
            </NavLink>
          );
        })}
    </nav>
  );
}

function AdminRoutes() {
  return (
    <>
    <AdminTabs />
    <Routes>
      <Route index element={<Overview />} />
      <Route path="users" element={<RequirePermission permission="admin.users.manage"><Users /></RequirePermission>} />
      <Route path="groups" element={<RequirePermission permission="admin.groups.manage"><Groups /></RequirePermission>} />
      <Route path="audit" element={<RequirePermission permission="admin.audit.view"><Audit /></RequirePermission>} />
      <Route path="system" element={<RequirePermission permission="admin.system"><System /></RequirePermission>} />
    </Routes>
    </>
  );
}

/** Purple emperor — the admin module's butterfly. */
export const adminModule: ModuleDef = {
  id: 'admin',
  path: '/admin',
  name: { fr: 'Administration', en: 'Administration' },
  tagline: { fr: 'Utilisateurs et accès', en: 'Users and access' },
  icon: ShieldCheck,
  accent: '#7b4fd6',
  entryPermission: 'admin.access',
  placement: 'userMenu',
  permissions: [
    { key: 'admin.access', label: { fr: 'Accéder au portail', en: 'Access portal' } },
    { key: 'admin.users.manage', label: { fr: 'Gérer les utilisateurs', en: 'Manage users' } },
    { key: 'admin.groups.manage', label: { fr: 'Gérer les groupes et permissions', en: 'Manage groups & permissions' } },
    { key: 'admin.audit.view', label: { fr: 'Consulter le journal d’audit', en: 'View audit log' } },
    { key: 'admin.system', label: { fr: 'Paramètres système', en: 'System settings' } },
  ],
  nav: [
    { path: '', label: { fr: 'Aperçu', en: 'Overview' }, icon: LayoutDashboard },
    { path: 'users', label: { fr: 'Utilisateurs', en: 'Users' }, icon: UsersIcon, permission: 'admin.users.manage' },
    { path: 'groups', label: { fr: 'Groupes d’accès', en: 'Access groups' }, icon: KeyRound, permission: 'admin.groups.manage' },
    { path: 'audit', label: { fr: 'Journal d’audit', en: 'Audit log' }, icon: ScrollText, permission: 'admin.audit.view' },
    { path: 'system', label: { fr: 'Système', en: 'System' }, icon: Server, permission: 'admin.system' },
  ],
  component: AdminRoutes,
  widgets: [{ id: 'admin.kpis', title: { fr: 'Administration', en: 'Administration' }, permission: 'admin.access', size: 2, component: AdminKpis }],
};
