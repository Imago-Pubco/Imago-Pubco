import { groups } from '@/data/stores';

const KEY = 'imago:migrate:rh-access';

/** One-time (browser dev backend): Conformité moved into RH — groups with compliance access also get `rh.access`. */
export async function ensureRhAccess() {
  if (localStorage.getItem(KEY) === '1') return;
  for (const g of await groups.list()) {
    const p = g.permissions;
    if (!p.includes('*') && !p.includes('rh.access') && !p.includes('rh.*') && p.some((x) => x.startsWith('compliance.'))) {
      await groups.update(g.id, { permissions: [...p, 'rh.access'].sort() });
    }
  }
  localStorage.setItem(KEY, '1');
}
