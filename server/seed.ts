/**
 * First-start initialisation. Creates the default access groups and the first administrator
 * (from ADMIN_* in .env) when the database has no users, and loads reference data once:
 * compliance frameworks and requirements (status reset to "to do"), estimating materials
 * and default settings. No demo accounts, vendors, mail or labels are created.
 */
import { randomBytes } from 'node:crypto';
import { seedGroups } from '../src/data/seedGroups.ts';
import type { Group, User } from '../src/data/types.ts';
import { DEFAULT_SETTINGS } from '../src/modules/accounting/defaults.ts';
import { seedFrameworks, seedRequirements } from '../src/modules/compliance/seed.ts';
import { DEFAULT_EST_SETTINGS } from '../src/modules/estimating/defaults.ts';
import { seedMaterials } from '../src/modules/estimating/seed.ts';
import { hashPassword } from './auth.ts';
import { config } from './config.ts';
import { countDocs, getMeta, insertDoc, listDocs, replaceAll, setMeta, updateDoc, type Doc } from './db.ts';

export async function initialise() {
  if ((await countDocs('users')) === 0) await createFirstAdmin();
  if (!(await getMeta('seed.reference'))) await loadReferenceData();
  await migrateRhAccess();
}

/** One-time: Conformité moved into the RH module — groups with compliance access also get `rh.access`. */
async function migrateRhAccess() {
  if (await getMeta('migrate.rh-access')) return;
  for (const g of await listDocs<Group>('groups')) {
    const p = g.permissions;
    if (!p.includes('*') && !p.includes('rh.access') && !p.includes('rh.*') && p.some((x) => x.startsWith('compliance.'))) {
      await updateDoc<Group & { id: string }>('groups', g.id, { permissions: [...p, 'rh.access'].sort() });
    }
  }
  await setMeta('migrate.rh-access', new Date().toISOString());
}

async function createFirstAdmin() {
  const { username, password, email, displayName } = config.admin;
  if (password.length < 12) {
    throw new Error('No users exist yet: set ADMIN_PASSWORD (12+ characters) in .env to create the first administrator.');
  }
  if ((await countDocs('groups')) === 0) {
    // IT support is open to everyone by default.
    const groups: Group[] = seedGroups.map((g) =>
      g.permissions.includes('*') || g.permissions.includes('it.access') ? g : { ...g, permissions: [...g.permissions, 'it.access'].sort() },
    );
    await replaceAll('groups', groups as unknown as Doc[]);
  }
  const admin: User = {
    id: 'u_' + randomBytes(8).toString('hex'),
    username,
    displayName,
    email,
    passwordHash: await hashPassword(password),
    salt: '',
    groupIds: ['g_admin'],
    active: true,
    createdAt: new Date().toISOString(),
  };
  await insertDoc('users', admin as unknown as Doc);
  await insertDoc('audit', {
    id: 'a_' + randomBytes(8).toString('hex'),
    at: admin.createdAt,
    userId: admin.id,
    action: 'system.init',
    detail: `First administrator "${username}" created`,
  });
  console.log(`[seed] created administrator "${username}". You can remove ADMIN_PASSWORD from .env now.`);
}

async function loadReferenceData() {
  const owner = (await listDocs<User>('users')).find((u) => u.groupIds.includes('g_admin'))?.id ?? '';
  const now = new Date().toISOString();
  const empty = async (c: string) => (await countDocs(c)) === 0;

  if (await empty('cmp.frameworks')) {
    await replaceAll('cmp.frameworks', seedFrameworks.map((f) => ('ownerId' in f ? { ...f, ownerId: owner } : f)) as unknown as Doc[]);
  }
  if (await empty('cmp.requirements')) {
    await replaceAll(
      'cmp.requirements',
      seedRequirements.map((r) => ({ ...r, status: 'todo', evidence: [], notes: '', ownerId: owner, reviewDue: undefined, updatedAt: now })),
    );
  }
  if (await empty('est.materials')) await replaceAll('est.materials', seedMaterials as unknown as Doc[]);
  if (await empty('est.settings')) await replaceAll('est.settings', [DEFAULT_EST_SETTINGS]);
  if (await empty('acc.settings')) {
    await replaceAll('acc.settings', [{ ...DEFAULT_SETTINGS, mailbox: config.graph.mailbox || DEFAULT_SETTINGS.mailbox }]);
  }
  await setMeta('seed.reference', now);
  console.log('[seed] reference data loaded (compliance frameworks, estimating materials, default settings).');
}
