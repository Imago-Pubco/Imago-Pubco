import { groups } from '@/data/stores';

const KEY = 'imago:migrate:it-access';

/** One-time: IT support is for everyone by default — grant `it.access` to every existing group. */
export async function ensureItAccess() {
  if (localStorage.getItem(KEY) === '1') return;
  for (const g of await groups.list()) {
    if (!g.permissions.includes('*') && !g.permissions.includes('it.access') && !g.permissions.includes('it.*')) {
      await groups.update(g.id, { permissions: [...g.permissions, 'it.access'].sort() });
    }
  }
  localStorage.setItem(KEY, '1');
}
