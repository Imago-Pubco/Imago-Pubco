/**
 * External system connectors for Accounting.
 *
 * DEV:  mock implementations backed by browser storage (below).
 * PROD: the API server implements the same contracts:
 *   - MailboxConnector      → Microsoft Graph (/users/{mailbox}/messages, attachments)
 *   - InvoiceExtractor      → PDF text + AI extraction (e.g. Claude) on the server
 *   - BusinessCentral       → BC API v2.0 (purchaseOrders, purchaseReceipts, purchaseInvoices)
 */
import { uid } from '@/data/db';
import type { BcPurchaseOrder, BcPurchaseInvoice, BcVendor, Invoice, MailMessage } from './types';
import { bcPurchaseInvoices, bcPurchaseOrders, bcVendors, mailbox } from './stores';
import { mailTemplates } from './seed';

export interface MailboxConnector {
  list(): Promise<MailMessage[]>;
  /** Pull new mail from the server. Returns number of new messages. */
  sync(): Promise<number>;
  markRead(id: string, read?: boolean): Promise<void>;
  linkInvoice(id: string, invoiceId: string): Promise<void>;
}

export interface BusinessCentral {
  findVendorByEmailOrName(email: string | undefined, name: string): Promise<BcVendor | undefined>;
  getPurchaseOrder(no: string): Promise<BcPurchaseOrder | undefined>;
  listPurchaseOrders(): Promise<BcPurchaseOrder[]>;
  /** Create + post a purchase invoice against the PO; updates PO invoiced quantities. */
  postPurchaseInvoice(inv: Invoice): Promise<BcPurchaseInvoice>;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mailboxConnector: MailboxConnector = {
  list: () => mailbox.list(),
  async sync() {
    await delay(900);
    // Simulate one new vendor e-mail arriving each sync (until templates run out).
    const existing = await mailbox.list();
    const next = mailTemplates.find((m) => !existing.some((e) => e.id === m.id));
    if (!next) return 0;
    await mailbox.insert({ ...next, receivedAt: new Date().toISOString() });
    return 1;
  },
  async markRead(id, read = true) {
    await mailbox.update(id, { read });
  },
  async linkInvoice(id, invoiceId) {
    await mailbox.update(id, { invoiceId, read: true });
  },
};

export const businessCentral: BusinessCentral = {
  async findVendorByEmailOrName(email, name) {
    const all = await bcVendors.list();
    const domain = email?.split('@')[1]?.toLowerCase();
    return (
      all.find((v) => email && v.email.toLowerCase() === email.toLowerCase()) ??
      all.find((v) => domain && v.email.toLowerCase().endsWith('@' + domain)) ??
      all.find((v) => v.name.toLowerCase() === name.toLowerCase())
    );
  },
  async getPurchaseOrder(no) {
    await delay(250);
    const all = await bcPurchaseOrders.list();
    return all.find((p) => p.no.toLowerCase() === no.trim().toLowerCase());
  },
  listPurchaseOrders: () => bcPurchaseOrders.list(),
  async postPurchaseInvoice(inv) {
    await delay(700);
    const po = await businessCentral.getPurchaseOrder(inv.poNo);
    if (!po) throw new Error(`PO ${inv.poNo} not found in Business Central`);
    const lines = po.lines.map((l) => {
      const invLine = inv.lines.find((x) => x.itemNo === l.itemNo);
      return invLine ? { ...l, quantityInvoiced: l.quantityInvoiced + invLine.quantity } : l;
    });
    await bcPurchaseOrders.update(po.id, { lines });
    const count = (await bcPurchaseInvoices.list()).length;
    return bcPurchaseInvoices.insert({
      id: uid('bcpi_'),
      no: `PPI-${String(108200 + count + 1)}`,
      vendorInvoiceNo: inv.invoiceNo,
      vendorNo: inv.vendorNo ?? po.vendorNo,
      poNo: po.no,
      postingDate: new Date().toISOString(),
      amount: inv.total,
      imagoInvoiceId: inv.id,
    });
  },
};
