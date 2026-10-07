/**
 * Accounting pipeline (server side): received purchase orders are matched to Business Central and,
 * once approved, turned into the invoice that goes with them. The same functions serve the buttons in
 * the screens and (later) the automation, so a person and the automation always follow the same rules.
 */
import { randomBytes } from 'node:crypto';
import { classifyAttachment } from '../src/modules/accounting/classify.ts';
import { DEFAULT_SETTINGS } from '../src/modules/accounting/defaults.ts';
import { fromPurchaseOrder, fromSalesOrder, matchPo, type BcInvoiceRow, type BcSalesOrder, type OrderLike, type PoRecord } from '../src/modules/accounting/orders.ts';
import type { AccountingSettings, BcPurchaseOrder, HistoryEntry, InvoiceLine, MailMessage } from '../src/modules/accounting/types.ts';
import * as bc from './bc.ts';
import { config } from './config.ts';
import * as db from './db.ts';
import { broadcast } from './events.ts';
import { HttpError } from './ms.ts';

const now = () => new Date().toISOString();
const uid = (p: string) => p + randomBytes(8).toString('hex');
const hist = (userId: string, action: string, note?: string): HistoryEntry => ({ at: now(), userId, action, note });

async function audit(userId: string, action: string, detail: string) {
  await db.insertDoc('audit', { id: uid('a_'), at: now(), userId, action, detail, ip: '' });
  broadcast('audit');
}

export async function getSettings(): Promise<AccountingSettings> {
  return (await db.getDoc<AccountingSettings & { id: string }>('acc.settings', 'settings')) ?? DEFAULT_SETTINGS;
}

/* ---------- Business Central sync ---------- */

let syncing: Promise<{ salesOrders: number; invoices: number }> | undefined;

/** Refreshes the local copy of BC sales orders and of sales/purchase invoices. Concurrent calls share one run. */
export function syncBc() {
  syncing ??= doSync().finally(() => (syncing = undefined));
  return syncing;
}

async function doSync() {
  bc.assertBc();
  const [orders, invoices] = await Promise.all([bc.listSalesOrders(), bc.listBcInvoices()]);
  await db.replaceAll('bc.salesOrders', orders);
  await db.replaceAll('bc.invoices', invoices);
  await db.setMeta('bc.lastSync', now());
  broadcast('bc.salesOrders');
  broadcast('bc.invoices');
  return { salesOrders: orders.length, invoices: invoices.length };
}

/* ---------- order lookup ---------- */

/** Live from BC when it is configured (and cached); otherwise from the local copy. */
async function findOrder(direction: PoRecord['direction'], poNo: string): Promise<{ order?: OrderLike; sales?: BcSalesOrder }> {
  const no = poNo.trim().toLowerCase();
  if (direction === 'customer') {
    const sales = config.bc.enabled
      ? await bc.findSalesOrderByCustomerPo(poNo)
      : (await db.listDocs<BcSalesOrder>('bc.salesOrders')).find((o) => no && (o.externalDocNo.toLowerCase() === no || o.no.toLowerCase() === no));
    return { sales, order: sales ? fromSalesOrder(sales) : undefined };
  }
  const po: BcPurchaseOrder | undefined = config.bc.enabled ? await bc.getPurchaseOrder(poNo) : undefined;
  return { order: po ? fromPurchaseOrder(po) : undefined };
}

/* ---------- PO records ---------- */

async function save(rec: PoRecord): Promise<PoRecord> {
  const out = (await db.updateDoc<PoRecord>('acc.pos', rec.id, rec)) ?? rec;
  broadcast('acc.pos');
  return out;
}

/** Creates the Imago record for a PO attachment (once) and matches it with Business Central. */
export async function processPo(mailId: string, attIndex: number, userId: string, automated = false): Promise<PoRecord> {
  const existing = (await db.listDocs<PoRecord>('acc.pos')).find((p) => p.mailId === mailId && p.attIndex === attIndex);
  if (existing) return existing;

  const msg = await db.getDoc<MailMessage & { id: string }>('acc.mailbox', mailId);
  const att = msg?.attachments[attIndex];
  if (!msg || !att) throw new HttpError(404, 'Document not found');
  const c = classifyAttachment(att, msg);
  if (c.docType !== 'po') throw new HttpError(400, 'This document is not classified as a purchase order.');

  const ex = att.extracted;
  const lines: InvoiceLine[] = (ex?.lines ?? []).map((l) => ({ ...l, id: uid('l_') }));
  const rec: PoRecord = {
    id: uid('po_'),
    mailId,
    attIndex,
    fileId: att.fileId,
    fileName: att.name,
    direction: c.poDirection ?? 'customer',
    poNo: ex?.poNo ?? '',
    partyName: ex?.vendorName || msg.fromName,
    poDate: ex?.invoiceDate || msg.receivedAt.slice(0, 10),
    currency: ex?.currency ?? '',
    lines,
    total: ex?.total || lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    stage: 'received',
    automated,
    history: [hist(userId, 'received', `${msg.fromName} - ${msg.subject}`)],
    createdAt: now(),
  };
  await db.insertDoc('acc.pos', rec);
  await audit(userId, 'accounting.po.process', `${rec.direction === 'customer' ? 'Customer' : 'Vendor'} PO ${rec.poNo || rec.fileName}`);
  return rematchPo(rec.id, userId);
}

/** Matches (or re-matches, after an edit) a PO record against Business Central. */
export async function rematchPo(id: string, userId: string): Promise<PoRecord> {
  const rec = await db.getDoc<PoRecord>('acc.pos', id);
  if (!rec) throw new HttpError(404, 'PO not found');
  if (rec.stage === 'invoiced' || rec.stage === 'confirmed') return rec;
  const settings = await getSettings();
  const { order } = await findOrder(rec.direction, rec.poNo);
  const match = matchPo(rec, order, settings);
  return save({
    ...rec,
    partyNo: order?.partyNo ?? rec.partyNo,
    bcOrderNo: order?.no,
    match,
    stage: match.level === 'fail' ? 'mismatch' : 'matched',
    history: [...rec.history, hist(userId, 'matched', match.level.toUpperCase())],
  });
}

/**
 * Approves a matched PO. Customer PO: creates the sales invoice in BC. Vendor PO: records the confirmation.
 * A failed match needs an override note (the route checks the override permission).
 */
export async function approvePo(id: string, userId: string, overrideNote?: string, automated = false): Promise<PoRecord> {
  let rec = await db.getDoc<PoRecord>('acc.pos', id);
  if (!rec) throw new HttpError(404, 'PO not found');
  if (rec.stage === 'invoiced' || rec.stage === 'confirmed') throw new HttpError(409, 'Already processed');
  if (rec.stage === 'rejected') throw new HttpError(409, 'This PO was rejected: reopen it first.');
  if (!rec.match) rec = await rematchPo(id, userId);
  if (rec.match?.level === 'fail' && !overrideNote?.trim()) throw new HttpError(400, 'The match failed: a written justification is required to approve.');

  if (rec.direction === 'vendor') {
    await audit(userId, 'accounting.po.confirm', `Vendor PO ${rec.poNo} confirmed`);
    return save({ ...rec, stage: 'confirmed', approvedBy: userId, approvedAt: now(), overrideNote, automated, history: [...rec.history, hist(userId, 'approved', overrideNote), hist(userId, 'confirmed', rec.bcOrderNo)] });
  }

  const { sales } = await findOrder('customer', rec.poNo);
  if (!sales) throw new HttpError(409, `No BC sales order found for PO ${rec.poNo}.`);
  const invoice = await bc.createSalesInvoice(rec, sales);
  await audit(userId, 'accounting.po.invoice', `PO ${rec.poNo} -> sales invoice ${invoice.no}`);
  return save({
    ...rec,
    stage: 'invoiced',
    bcOrderId: sales.id,
    bcOrderNo: sales.no,
    bcInvoiceId: invoice.id,
    bcInvoiceNo: invoice.no,
    approvedBy: userId,
    approvedAt: now(),
    overrideNote,
    automated,
    history: [...rec.history, hist(userId, 'approved', overrideNote), hist(userId, 'invoiced', invoice.no)],
  });
}

export async function rejectPo(id: string, userId: string, reason: string): Promise<PoRecord> {
  const rec = await db.getDoc<PoRecord>('acc.pos', id);
  if (!rec) throw new HttpError(404, 'PO not found');
  if (rec.stage === 'invoiced' || rec.stage === 'confirmed') throw new HttpError(409, 'Already processed');
  await audit(userId, 'accounting.po.reject', `PO ${rec.poNo}: ${reason}`);
  return save({ ...rec, stage: 'rejected', history: [...rec.history, hist(userId, 'rejected', reason)] });
}

export async function reopenPo(id: string, userId: string): Promise<PoRecord> {
  const rec = await db.getDoc<PoRecord>('acc.pos', id);
  if (!rec) throw new HttpError(404, 'PO not found');
  if (rec.stage !== 'rejected') return rec;
  await save({ ...rec, stage: 'received', history: [...rec.history, hist(userId, 'reopened')] });
  return rematchPo(id, userId);
}

export type { BcInvoiceRow };
