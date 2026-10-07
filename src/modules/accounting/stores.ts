import { API_MODE, collection } from '@/data/db';
import type {
  AccountingSettings,
  BcPurchaseInvoice,
  BcPurchaseOrder,
  BcVendor,
  Invoice,
  MailMessage,
} from './types';
import { DEFAULT_SETTINGS } from './defaults';
import type { BcInvoiceRow, BcSalesOrder, PoRecord } from './orders';

export { DEFAULT_SETTINGS };

export const invoices = collection<Invoice>('acc.invoices');
export const accSettings = collection<AccountingSettings>('acc.settings');

/*
 * External systems. In the browser dev backend these are mocks; on the API server the
 * mailbox is filled from Microsoft Graph and `bc.*` are read live from Business Central.
 */
export const mailbox = collection<MailMessage>(API_MODE ? 'acc.mailbox' : 'mock.mailbox');
export const bcVendors = collection<BcVendor>(API_MODE ? 'bc.vendors' : 'mock.bc.vendors');
export const bcPurchaseOrders = collection<BcPurchaseOrder>(API_MODE ? 'bc.purchaseOrders' : 'mock.bc.purchaseOrders');
export const bcPurchaseInvoices = collection<BcPurchaseInvoice>(API_MODE ? 'bc.purchaseInvoices' : 'mock.bc.purchaseInvoices');

export async function getSettings(): Promise<AccountingSettings> {
  return { ...DEFAULT_SETTINGS, ...(await accSettings.get('settings')) };
}

/** Purchase orders received by e-mail (customer POs and vendor confirmations) and their BC match. */
export const poRecords = collection<PoRecord>(API_MODE ? 'acc.pos' : 'mock.pos');
/** Local copy of Business Central sales orders and of sales/purchase invoices (refreshed by "Sync BC"). */
export const bcSalesOrders = collection<BcSalesOrder>(API_MODE ? 'bc.salesOrders' : 'mock.bc.salesOrders');
export const bcInvoices = collection<BcInvoiceRow>(API_MODE ? 'bc.invoices' : 'mock.bc.invoices');
