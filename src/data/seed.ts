/**
 * Development seed. Runs once per browser (or after "Reset demo data").
 *
 * DEV SIGN-IN — all seeded accounts share this test password: Imago-dev-2026
 *   admin   → Administrateurs (everything)
 *   prod    → Production (shipping)
 *   compta  → Comptabilité (accounting)
 *   lecture → Lecture seule (read-only)
 * These accounts exist only in the browser dev store; production users are created in the admin portal.
 */
import { hashPassword, newSalt } from './crypto';
import { audit, groups, users } from './stores';
import type { User } from './types';
import { seedGroups } from './seedGroups';
import { accSettings, bcPurchaseInvoices, bcPurchaseOrders, bcVendors, DEFAULT_SETTINGS, invoices, mailbox } from '@/modules/accounting/stores';
import { seedMail, seedPurchaseOrders, seedVendors } from '@/modules/accounting/seed';
import { addressBook, labels, shipFroms } from '@/modules/shipping/stores';
import { seedAddresses, seedLabels, seedShipFroms } from '@/modules/shipping/seed';
import { ensureEstimatingSeeded } from '@/modules/estimating/stores';
import { ensureComplianceSeeded } from '@/modules/compliance/stores';

const SEED_VERSION = '1';
const SEED_KEY = 'imago:seed';
const DEV_PASSWORD = 'Imago-dev-2026';

const seedUsers: [string, string, string, string, string[]][] = [
  ['u_admin', 'admin', 'Administrateur Imago', 'admin@pubco.ca', ['g_admin']],
  ['u_prod', 'prod', 'Équipe Production', 'production@pubco.ca', ['g_prod']],
  ['u_compta', 'compta', 'Équipe Comptabilité', 'comptabilite@pubco.ca', ['g_compta']],
  ['u_read', 'lecture', 'Consultation', 'lecture@pubco.ca', ['g_read']],
];

export async function ensureSeeded() {
  if (localStorage.getItem(SEED_KEY) === SEED_VERSION) return;

  const now = new Date().toISOString();
  const u: User[] = [];
  for (const [id, username, displayName, email, groupIds] of seedUsers) {
    const salt = newSalt();
    u.push({ id, username, displayName, email, groupIds, active: true, createdAt: now, salt, passwordHash: await hashPassword(DEV_PASSWORD, salt) });
  }
  await users.replaceAll(u);
  await groups.replaceAll(seedGroups);
  await audit.replaceAll([{ id: 'a_seed', at: now, userId: 'u_admin', action: 'system.seed', detail: 'Données de démonstration chargées' }]);

  await bcVendors.replaceAll(seedVendors);
  await bcPurchaseOrders.replaceAll(seedPurchaseOrders);
  await bcPurchaseInvoices.replaceAll([]);
  await mailbox.replaceAll(seedMail);
  await invoices.replaceAll([]);
  await accSettings.replaceAll([DEFAULT_SETTINGS]);

  await shipFroms.replaceAll(seedShipFroms);
  await addressBook.replaceAll(seedAddresses);
  await labels.replaceAll(seedLabels);

  await ensureEstimatingSeeded(true);
  await ensureComplianceSeeded(true);
  localStorage.setItem(SEED_KEY, SEED_VERSION);
}
