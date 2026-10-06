/**
 * Module registry — the single place where modules are plugged into Imago.
 * To add a module: create src/modules/<name>/index.tsx exporting a ModuleDef, then add it here.
 */
import type { ModuleDef, NavItem } from './types';
import { accountingModule } from './accounting';
import { shippingModule } from './shipping';
import { estimatingModule } from './estimating';
import { itModule } from './it';
import { rhModule } from './rh';
import { productionModule } from './production';
import { o365Module } from './o365';
import { adminModule } from './admin';

export const modules: ModuleDef[] = [accountingModule, shippingModule, estimatingModule, productionModule, rhModule, o365Module, itModule, adminModule];

/** Nav items with nested sections expanded (parents first). */
export function flatNav(nav: NavItem[]): NavItem[] {
  return nav.flatMap((n) => [n, ...flatNav(n.children ?? [])]);
}

export const HOME_ACCENT = '#da291c';

export function moduleForPath(pathname: string): ModuleDef | undefined {
  return modules.find((m) => pathname === m.path || pathname.startsWith(m.path + '/'));
}

/** Sort modules by a user's saved order; unknown modules keep registry order at the end. */
export function orderModules(list: ModuleDef[], order: string[] = []): ModuleDef[] {
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length + modules.findIndex((m) => m.id === id));
  return [...list].sort((a, b) => rank(a.id) - rank(b.id));
}
