import type { Group, User } from '@/data/types';

/**
 * Permission keys are dotted: `<module>.<area>.<action>`, e.g. `accounting.invoices.approve`.
 * A group may grant `*` (everything) or a module wildcard like `accounting.*`.
 */
export function effectivePermissions(user: User | null, allGroups: Group[]): Set<string> {
  const set = new Set<string>();
  if (!user) return set;
  for (const g of allGroups) {
    if (user.groupIds.includes(g.id)) g.permissions.forEach((p) => set.add(p));
  }
  return set;
}

export function hasPermission(perms: Set<string>, key: string): boolean {
  if (perms.has('*') || perms.has(key)) return true;
  const parts = key.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    if (perms.has(parts.slice(0, i).join('.') + '.*')) return true;
  }
  return false;
}
