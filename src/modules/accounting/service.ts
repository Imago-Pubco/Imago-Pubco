import { uid } from '@/data/db';
import { logAudit } from '@/data/stores';
import { businessCentral, mailboxConnector } from './integrations';
import { matchInvoice } from './matching';
import { getSettings, invoices, mailbox } from './stores';
import type { HistoryEntry, Invoice, InvoiceStage } from './types';

const now = () => new Date().toISOString();
const hist = (userId: string, action: string, note?: string): HistoryEntry => ({ at: now(), userId, action, note });

/** Create an Imago invoice from a mailbox message's first extracted attachment. */
export async function importFromMail(mailId: string, userId: string): Promise<Invoice> {
  const msg = await mailbox.get(mailId);
  if (!msg) throw new Error('Message not found');
  if (msg.invoiceId) {
    const existing = await invoices.get(msg.invoiceId);
    if (existing) return existing;
  }
  const att = msg.attachments.find((a) => a.extracted);
  if (!att?.extracted) throw new Error('No invoice attachment found');
  const ex = att.extracted;
  const vendor = await businessCentral.findVendorByEmailOrName(msg.from, ex.vendorName);

  const inv = await invoices.insert({
    id: uid('inv_'),
    mailId: msg.id,
    sourceFile: att.name,
    vendorNo: vendor?.no,
    vendorName: vendor?.name ?? ex.vendorName,
    vendorEmail: msg.from,
    invoiceNo: ex.invoiceNo,
    invoiceDate: ex.invoiceDate,
    dueDate: ex.dueDate,
    poNo: ex.poNo,
    currency: ex.currency,
    lines: ex.lines.map((l) => ({ ...l, id: uid('l_') })),
    subtotal: ex.subtotal,
    tax: ex.tax,
    total: ex.total,
    stage: 'extracted',
    history: [
      hist(userId, 'received', `${msg.fromName} — ${msg.subject}`),
      hist(userId, 'extracted', att.name),
    ],
    createdAt: now(),
  });
  await mailboxConnector.linkInvoice(msg.id, inv.id);
  await logAudit(userId, 'accounting.invoice.import', `${inv.vendorName} #${inv.invoiceNo}`);
  // Validate immediately so the team lands on a ready result.
  return runMatching(inv.id, userId);
}

export async function runMatching(invoiceId: string, userId: string): Promise<Invoice> {
  const inv = await invoices.get(invoiceId);
  if (!inv) throw new Error('Invoice not found');
  if (inv.stage === 'posted') return inv;
  const [po, settings] = await Promise.all([businessCentral.getPurchaseOrder(inv.poNo), getSettings()]);
  const vendorNo = inv.vendorNo ?? po?.vendorNo;
  const match = matchInvoice({ ...inv, vendorNo }, po, settings);
  const stage: InvoiceStage = match.level === 'fail' ? 'extracted' : 'validated';
  return invoices.update(inv.id, {
    vendorNo,
    match,
    stage,
    history: [
      ...inv.history,
      hist(userId, 'matched', match.level === 'ok' ? 'OK' : match.level === 'warn' ? 'WARN' : 'FAIL'),
    ],
  });
}

export async function saveInvoice(inv: Invoice, userId: string) {
  const subtotal = Math.round(inv.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * 100) / 100;
  await invoices.update(inv.id, {
    ...inv,
    subtotal,
    total: Math.round((subtotal + inv.tax) * 100) / 100,
    match: undefined,
    stage: inv.stage === 'validated' ? 'extracted' : inv.stage,
    history: [...inv.history, hist(userId, 'edited')],
  });
  return runMatching(inv.id, userId);
}

export async function approveAndPost(invoiceId: string, userId: string, overrideNote?: string) {
  const inv = await invoices.get(invoiceId);
  if (!inv) throw new Error('Invoice not found');
  const bc = await businessCentral.postPurchaseInvoice(inv);
  await logAudit(userId, 'accounting.invoice.post', `${inv.vendorName} #${inv.invoiceNo} → ${bc.no}`);
  return invoices.update(inv.id, {
    stage: 'posted',
    approvedBy: userId,
    approvedAt: now(),
    overrideNote,
    bcInvoiceNo: bc.no,
    postedAt: now(),
    history: [
      ...inv.history,
      hist(userId, 'approved', overrideNote),
      hist(userId, 'posted', bc.no),
    ],
  });
}

export async function rejectInvoice(invoiceId: string, userId: string, reason: string) {
  const inv = await invoices.get(invoiceId);
  if (!inv) throw new Error('Invoice not found');
  await logAudit(userId, 'accounting.invoice.reject', `${inv.vendorName} #${inv.invoiceNo}: ${reason}`);
  return invoices.update(inv.id, { stage: 'rejected', history: [...inv.history, hist(userId, 'rejected', reason)] });
}

export async function reopenInvoice(invoiceId: string, userId: string) {
  const inv = await invoices.get(invoiceId);
  if (!inv) throw new Error('Invoice not found');
  await invoices.update(inv.id, { stage: 'extracted', history: [...inv.history, hist(userId, 'reopened')] });
  return runMatching(inv.id, userId);
}
