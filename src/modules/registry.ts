/**
 * Module registry — the single place where modules are plugged into Imago.
 * To add a module: create src/modules/<name>/index.tsx exporting a ModuleDef, then add it here.
 */
import type { ModuleDef } from './types';
import { accountingModule } from './accounting';
import { shippingModule } from './shipping';
import { adminModule } from './admin';

export const modules: ModuleDef[] = [accountingModule, shippingModule, adminModule];

export const HOME_ACCENT = '#da291c';

export function moduleForPath(pathname: string): ModuleDef | undefined {
  return modules.find((m) => pathname === m.path || pathname.startsWith(m.path + '/'));
}
