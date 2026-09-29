import { collection } from '@/data/db';
import type {
  AccountingSettings,
  BcPurchaseInvoice,
  BcPurchaseOrder,
  BcVendor,
  Invoice,
  MailMessage,
} from './types';

export const invoices = collection<Invoice>('acc.invoices');
export const accSettings = collection<AccountingSettings>('acc.settings');

/* Mock external systems — replaced by real connectors on the server. */
export const mailbox = collection<MailMessage>('mock.mailbox');
export const bcVendors = collection<BcVendor>('mock.bc.vendors');
export const bcPurchaseOrders = collection<BcPurchaseOrder>('mock.bc.purchaseOrders');
export const bcPurchaseInvoices = collection<BcPurchaseInvoice>('mock.bc.purchaseInvoices');

export const DEFAULT_SETTINGS: AccountingSettings = {
  id: 'settings',
  mailbox: 'factures@pubco.ca',
  qtyTolerance: 0,
  priceTolerancePct: 2,
  totalTolerance: 1,
  requireApprovalAbove: 0,
};

export async function getSettings(): Promise<AccountingSettings> {
  return (await accSettings.get('settings')) ?? DEFAULT_SETTINGS;
}
