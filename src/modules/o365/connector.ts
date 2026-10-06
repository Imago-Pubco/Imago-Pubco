/**
 * Microsoft 365 connector used by the screens.
 *
 * Browser dev backend: demo tenants backed by browser storage (below).
 * API backend: the Imago server calls Microsoft Graph (users, licenses) and the
 * Exchange Online admin API (mail contacts, distribution groups) — see server/o365.ts.
 */
import { API_MODE, api, collection, uid } from '@/data/db';
import type {
  LicenseHolder,
  O365Contact,
  O365ContactInput,
  O365Group,
  O365License,
  O365Member,
  O365User,
  O365UserInput,
  TenantOverview,
} from './types';

export interface O365Connector {
  overview(tenant: string): Promise<TenantOverview>;
  listUsers(tenant: string): Promise<O365User[]>;
  createUser(tenant: string, input: O365UserInput & { userPrincipalName: string; password: string }): Promise<O365User>;
  updateUser(tenant: string, id: string, input: Partial<O365UserInput>): Promise<void>;
  resetPassword(tenant: string, id: string, password: string, forceChange: boolean): Promise<void>;
  deleteUser(tenant: string, id: string): Promise<void>;
  setLicenses(tenant: string, id: string, add: string[], remove: string[]): Promise<void>;
  listContacts(tenant: string): Promise<O365Contact[]>;
  createContact(tenant: string, input: O365ContactInput): Promise<void>;
  deleteContact(tenant: string, id: string): Promise<void>;
  listGroups(tenant: string): Promise<O365Group[]>;
  listMembers(tenant: string, groupId: string): Promise<O365Member[]>;
  addMember(tenant: string, groupId: string, email: string): Promise<void>;
  removeMember(tenant: string, groupId: string, memberId: string): Promise<void>;
  /** `paidOnly` hides free / trial-pool licenses (used by the Licenses page). */
  listLicenses(tenant: string, paidOnly?: boolean): Promise<O365License[]>;
  licenseHolders(tenant: string, skuId: string): Promise<LicenseHolder[]>;
}

/* ---------- API server ---------- */

const t = (tenant: string, path = '') => `/o365/${encodeURIComponent(tenant)}${path}`;
const e = encodeURIComponent;

const apiConnector: O365Connector = {
  overview: (tenant) => api(t(tenant, '/overview')),
  listUsers: (tenant) => api(t(tenant, '/users')),
  createUser: (tenant, input) => api(t(tenant, '/users'), { method: 'POST', body: input }),
  updateUser: (tenant, id, input) => api(t(tenant, `/users/${e(id)}`), { method: 'PATCH', body: input }),
  resetPassword: (tenant, id, password, forceChange) =>
    api(t(tenant, `/users/${e(id)}/password`), { method: 'POST', body: { password, forceChange } }),
  deleteUser: (tenant, id) => api(t(tenant, `/users/${e(id)}`), { method: 'DELETE' }),
  setLicenses: (tenant, id, add, remove) => api(t(tenant, `/users/${e(id)}/licenses`), { method: 'POST', body: { add, remove } }),
  listContacts: (tenant) => api(t(tenant, '/contacts')),
  createContact: (tenant, input) => api(t(tenant, '/contacts'), { method: 'POST', body: input }),
  deleteContact: (tenant, id) => api(t(tenant, `/contacts/${e(id)}`), { method: 'DELETE' }),
  listGroups: (tenant) => api(t(tenant, '/groups')),
  listMembers: (tenant, groupId) => api(t(tenant, `/groups/${e(groupId)}/members`)),
  addMember: (tenant, groupId, email) => api(t(tenant, `/groups/${e(groupId)}/members`), { method: 'POST', body: { email } }),
  removeMember: (tenant, groupId, memberId) => api(t(tenant, `/groups/${e(groupId)}/members/${e(memberId)}`), { method: 'DELETE' }),
  listLicenses: (tenant, paidOnly) => api(t(tenant, `/licenses${paidOnly ? '?paid=1' : ''}`)),
  licenseHolders: (tenant, skuId) => api(t(tenant, `/licenses/${e(skuId)}/users`)),
};

/* ---------- Browser dev backend: demo data ---------- */

type Scoped<T> = T & { tenant: string };
type MockGroup = Scoped<O365Group> & { members: O365Member[] };
type MockLicense = Scoped<O365License> & { id: string };

const mockUsers = collection<Scoped<O365User>>('mock.o365.users');
const mockContacts = collection<Scoped<O365Contact>>('mock.o365.contacts');
const mockGroups = collection<MockGroup>('mock.o365.groups');
const mockLicenses = collection<MockLicense>('mock.o365.licenses');

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const strip = <T extends { tenant: string }>({ tenant: _t, ...rest }: T) => rest;
const of = async <T extends { tenant: string }>(c: { list(): Promise<T[]> }, tenant: string) =>
  (await c.list()).filter((r) => r.tenant === tenant);

async function syncConsumed(tenant: string) {
  const users = await of(mockUsers, tenant);
  for (const l of await of(mockLicenses, tenant)) {
    await mockLicenses.update(l.id, { consumed: users.filter((u) => u.licenses.includes(l.skuId)).length });
  }
}

const mockConnector: O365Connector = {
  async overview(tenant) {
    await delay();
    const [users, lic] = [await of(mockUsers, tenant), await of(mockLicenses, tenant)];
    const domain = DEMO_DOMAINS[tenant] ?? 'demo.example';
    return {
      displayName: DEMO_NAMES[tenant] ?? tenant,
      defaultDomain: domain,
      initialDomain: domain.split('.')[0] + '.onmicrosoft.com',
      domains: [domain, domain.split('.')[0] + '.onmicrosoft.com'],
      country: 'CA',
      createdAt: '2019-03-14T00:00:00Z',
      userCount: users.length,
      licensesTotal: lic.reduce((s, l) => s + l.total, 0),
      licensesUsed: lic.reduce((s, l) => s + l.consumed, 0),
    };
  },
  async listUsers(tenant) {
    await delay();
    return (await of(mockUsers, tenant)).map(strip);
  },
  async createUser(tenant, input) {
    await delay(500);
    const { password: _p, ...fields } = input;
    const u = await mockUsers.insert({
      ...fields,
      id: uid('ou_'),
      tenant,
      mail: input.userPrincipalName,
      licenses: [],
      createdAt: new Date().toISOString(),
    });
    return strip(u);
  },
  async updateUser(_tenant, id, input) {
    await delay();
    const { password: _p, userPrincipalName: _u, ...fields } = input;
    await mockUsers.update(id, fields);
  },
  async resetPassword() {
    await delay(400);
  },
  async deleteUser(tenant, id) {
    await delay();
    await mockUsers.remove(id);
    await syncConsumed(tenant);
  },
  async setLicenses(tenant, id, add, remove) {
    await delay(400);
    const u = await mockUsers.get(id);
    if (!u) throw new Error('User not found');
    if (add.length && !u.usageLocation) throw new Error('Set the usage location before assigning licenses.');
    const lic = await of(mockLicenses, tenant);
    for (const skuId of add) {
      const l = lic.find((x) => x.skuId === skuId);
      if (l && l.consumed >= l.total) throw new Error(`No ${l.skuPartNumber} license available.`);
    }
    await mockUsers.update(id, { licenses: [...u.licenses.filter((s) => !remove.includes(s)), ...add.filter((s) => !u.licenses.includes(s))] });
    await syncConsumed(tenant);
  },
  async listContacts(tenant) {
    await delay();
    return (await of(mockContacts, tenant)).map(strip);
  },
  async createContact(tenant, input) {
    await delay(400);
    await mockContacts.insert({ ...input, id: uid('oc_'), tenant });
  },
  async deleteContact(_tenant, id) {
    await delay();
    await mockContacts.remove(id);
  },
  async listGroups(tenant) {
    await delay();
    return (await of(mockGroups, tenant)).map(({ members: _m, ...g }) => strip(g));
  },
  async listMembers(_tenant, groupId) {
    await delay();
    return (await mockGroups.get(groupId))?.members ?? [];
  },
  async addMember(tenant, groupId, email) {
    await delay(400);
    const g = await mockGroups.get(groupId);
    if (!g) throw new Error('Group not found');
    const lower = email.toLowerCase();
    if (g.members.some((m) => m.email.toLowerCase() === lower)) throw new Error(`${email} is already a member.`);
    const user = (await of(mockUsers, tenant)).find((u) => u.userPrincipalName.toLowerCase() === lower || u.mail.toLowerCase() === lower);
    const contact = (await of(mockContacts, tenant)).find((c) => c.email.toLowerCase() === lower);
    const member: O365Member | undefined = user
      ? { id: user.id, displayName: user.displayName, email: user.mail, type: 'user' }
      : contact
        ? { id: contact.id, displayName: contact.displayName, email: contact.email, type: 'contact' }
        : undefined;
    if (!member) throw new Error(`No user or contact with the address ${email}.`);
    await mockGroups.update(groupId, { members: [...g.members, member] });
  },
  async removeMember(_tenant, groupId, memberId) {
    await delay();
    const g = await mockGroups.get(groupId);
    if (g) await mockGroups.update(groupId, { members: g.members.filter((m) => m.id !== memberId) });
  },
  async listLicenses(tenant) {
    await delay();
    return (await of(mockLicenses, tenant)).map(({ id: _id, ...l }) => strip(l));
  },
  async licenseHolders(tenant, skuId) {
    await delay();
    return (await of(mockUsers, tenant))
      .filter((u) => u.licenses.includes(skuId))
      .map((u) => ({ id: u.id, displayName: u.displayName, userPrincipalName: u.userPrincipalName, accountEnabled: u.accountEnabled }));
  },
};

export const o365: O365Connector = API_MODE ? apiConnector : mockConnector;

/* ---------- demo seed (browser dev backend only) ---------- */

const DEMO_NAMES: Record<string, string> = { t_demo_pubco: 'Pubco (démo)', t_demo_client: 'Client Démo inc.' };
const DEMO_DOMAINS: Record<string, string> = { t_demo_pubco: 'pubco-demo.example', t_demo_client: 'clientdemo.example' };

const SKU = {
  bp: { skuId: 'cbdc14ab-d96c-4c30-b9f4-6ada7cdc1d46', skuPartNumber: 'SPB' },
  bb: { skuId: '3b555118-da6a-4418-894f-7df1e2096870', skuPartNumber: 'O365_BUSINESS_ESSENTIALS' },
  ex: { skuId: '4b9405b0-7788-4568-add1-99614e613b69', skuPartNumber: 'EXCHANGESTANDARD' },
  pbi: { skuId: 'f8a1db68-be16-40ed-86d5-cb42ce701560', skuPartNumber: 'POWER_BI_PRO' },
};

export async function ensureO365Seeded(force = false) {
  const KEY = 'imago:seed:o365';
  if (!force && localStorage.getItem(KEY) === '1') return;
  const { o365Tenants } = await import('./stores');
  const now = new Date().toISOString();
  await o365Tenants.replaceAll([
    { id: 't_demo_pubco', name: 'Pubco (démo)', tenantId: 'pubco-demo.onmicrosoft.com', notes: 'Locataire de démonstration', addedAt: now },
    { id: 't_demo_client', name: 'Client Démo inc.', tenantId: 'clientdemo.onmicrosoft.com', notes: '', addedAt: now },
  ]);

  const people: [string, string, string, string, string, boolean, string[]][] = [
    ['t_demo_pubco', 'Marie', 'Tremblay', 'Directrice générale', 'Direction', true, [SKU.bp.skuId, SKU.pbi.skuId]],
    ['t_demo_pubco', 'Luc', 'Gagnon', 'Contrôleur', 'Comptabilité', true, [SKU.bp.skuId, SKU.pbi.skuId]],
    ['t_demo_pubco', 'Sophie', 'Roy', 'Technicienne comptable', 'Comptabilité', true, [SKU.bp.skuId]],
    ['t_demo_pubco', 'Jean', 'Côté', 'Chef de production', 'Production', true, [SKU.bb.skuId]],
    ['t_demo_pubco', 'Nadia', 'Bouchard', 'Estimatrice', 'Ventes', true, [SKU.bp.skuId]],
    ['t_demo_pubco', 'Éric', 'Lavoie', 'Expéditeur', 'Production', true, [SKU.ex.skuId]],
    ['t_demo_pubco', 'Ancien', 'Employé', 'Opérateur', 'Production', false, [SKU.bb.skuId]],
    ['t_demo_client', 'Paul', 'Bergeron', 'Président', 'Direction', true, [SKU.bp.skuId]],
    ['t_demo_client', 'Julie', 'Morin', 'Adjointe administrative', 'Administration', true, [SKU.bb.skuId]],
    ['t_demo_client', 'Kevin', 'Pelletier', 'Représentant', 'Ventes', true, [SKU.bb.skuId]],
  ];
  const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const users: Scoped<O365User>[] = people.map(([tenant, first, last, job, dept, enabled, licenses], i) => {
    const upn = `${slug(first)}.${slug(last)}@${DEMO_DOMAINS[tenant]}`;
    return {
      id: `ou_demo${i}`,
      tenant,
      displayName: `${first} ${last}`,
      givenName: first,
      surname: last,
      userPrincipalName: upn,
      mail: upn,
      jobTitle: job,
      department: dept,
      officeLocation: tenant === 't_demo_pubco' ? 'Québec' : 'Lévis',
      mobilePhone: '',
      usageLocation: 'CA',
      accountEnabled: enabled,
      licenses,
      createdAt: '2023-05-01T12:00:00Z',
    };
  });
  await mockUsers.replaceAll(users);

  await mockContacts.replaceAll([
    { id: 'oc_demo1', tenant: 't_demo_pubco', displayName: 'Cartonnerie Laurentide — Facturation', email: 'factures@cartonnerie-laurentide.example', firstName: '', lastName: '', company: 'Cartonnerie Laurentide inc.' },
    { id: 'oc_demo2', tenant: 't_demo_pubco', displayName: 'Martin Fortin (comptable externe)', email: 'mfortin@cabinet-fortin.example', firstName: 'Martin', lastName: 'Fortin', company: 'Cabinet Fortin CPA' },
    { id: 'oc_demo3', tenant: 't_demo_client', displayName: 'Support AKAB', email: 'support@akab.example', firstName: '', lastName: '', company: 'AKAB' },
  ]);

  const member = (u: Scoped<O365User>): O365Member => ({ id: u.id, displayName: u.displayName, email: u.mail, type: 'user' });
  const byDept = (tenant: string, dept: string) => users.filter((u) => u.tenant === tenant && u.department === dept && u.accountEnabled).map(member);
  await mockGroups.replaceAll([
    { id: 'og_demo1', tenant: 't_demo_pubco', displayName: 'Comptabilité', email: 'comptabilite@pubco-demo.example', description: 'Équipe comptable', members: byDept('t_demo_pubco', 'Comptabilité') },
    { id: 'og_demo2', tenant: 't_demo_pubco', displayName: 'Production', email: 'production@pubco-demo.example', description: 'Équipe de production', members: byDept('t_demo_pubco', 'Production') },
    {
      id: 'og_demo3',
      tenant: 't_demo_pubco',
      displayName: 'Factures fournisseurs',
      email: 'factures@pubco-demo.example',
      description: 'Réception des factures',
      members: [...byDept('t_demo_pubco', 'Comptabilité'), { id: 'oc_demo2', displayName: 'Martin Fortin (comptable externe)', email: 'mfortin@cabinet-fortin.example', type: 'contact' }],
    },
    { id: 'og_demo4', tenant: 't_demo_client', displayName: 'Tous', email: 'tous@clientdemo.example', description: 'Tous les employés', members: users.filter((u) => u.tenant === 't_demo_client').map(member) },
  ]);

  const licenses: MockLicense[] = [
    { id: 'ol1', tenant: 't_demo_pubco', ...SKU.bp, total: 6, consumed: 0, suspended: 0, warning: 0 },
    { id: 'ol2', tenant: 't_demo_pubco', ...SKU.bb, total: 5, consumed: 0, suspended: 0, warning: 0 },
    { id: 'ol3', tenant: 't_demo_pubco', ...SKU.ex, total: 2, consumed: 0, suspended: 0, warning: 0 },
    { id: 'ol4', tenant: 't_demo_pubco', ...SKU.pbi, total: 2, consumed: 0, suspended: 0, warning: 0 },
    { id: 'ol5', tenant: 't_demo_client', ...SKU.bp, total: 1, consumed: 0, suspended: 0, warning: 0 },
    { id: 'ol6', tenant: 't_demo_client', ...SKU.bb, total: 3, consumed: 0, suspended: 0, warning: 0 },
  ];
  await mockLicenses.replaceAll(licenses);
  for (const tenant of Object.keys(DEMO_NAMES)) await syncConsumed(tenant);
  localStorage.setItem(KEY, '1');
}
