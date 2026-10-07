/**
 * Accounting automation. Three modes (Comptabilité → Paramètres):
 *  - manual:   nothing runs by itself; people process every document and approve every step.
 *  - assisted: after each mailbox sync, documents are classified, read and matched with Business Central
 *              automatically; a person approves before anything is created in Business Central.
 *  - auto:     as assisted, and clean matches (no variance at all, within the amount cap) are also approved
 *              and created in Business Central without a person. Variances always wait for a person.
 * Everything the automation does is logged as the "system" user, and records are flagged `automated`.
 */
import { randomBytes } from 'node:crypto';
import { classifyAttachment } from '../src/modules/accounting/classify.ts';
import { matchInvoice } from '../src/modules/accounting/matching.ts';
import type { PoRecord } from '../src/modules/accounting/orders.ts';
import type { ExtractedInvoice, HistoryEntry, Invoice, MailMessage } from '../src/modules/accounting/types.ts';
import * as bc from './bc.ts';
import { config } from './config.ts';
import * as db from './db.ts';
import { broadcast } from './events.ts';
import { HttpError } from './ms.ts';
import { approvePo, getSettings, processPo, rematchPo } from './pipeline.ts';

export const SYSTEM_USER = 'system';

const now = () => new Date().toISOString();
const uid = (p: string) => p + randomBytes(8).toString('hex');
const hist = (userId: string, action: string, note?: string): HistoryEntry => ({ at: now(), userId, action, note });

async function audit(userId: string, action: string, detail: string) {
  await db.insertDoc('audit', { id: uid('a_'), at: now(), userId, action, detail, ip: '' });
  broadcast('audit');
}

/* ---------- vendor invoices ---------- */

/** Creates the Imago invoice for an invoice attachment (once per message) and matches it with Business Central. */
export async function importInvoice(mailId: string, attIndex: number, userId: string, automated = false): Promise<Invoice> {
  const msg = await db.getDoc<MailMessage & { id: string }>('acc.mailbox', mailId);
  if (!msg) throw new HttpError(404, 'Message not found');
  if (msg.invoiceId) {
    const existing = await db.getDoc<Invoice>('acc.invoices', msg.invoiceId);
    if (existing) return existing;
  }
  const att = msg.attachments[attIndex];
  if (!att) throw new HttpError(404, 'Document not found');
  const ex: ExtractedInvoice = att.extracted ?? {
    vendorName: msg.fromName,
    vendorEmail: msg.from,
    invoiceNo: '',
    invoiceDate: msg.receivedAt.slice(0, 10),
    dueDate: msg.receivedAt.slice(0, 10),
    poNo: '',
    currency: '',
    lines: [],
    subtotal: 0,
    tax: 0,
    total: 0,
  };
  const vendor = config.bc.enabled ? await bc.findVendor(msg.from, ex.vendorName).catch(() => undefined) : undefined;
  const inv: Invoice = {
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
    history: [hist(userId, 'received', `${msg.fromName} - ${msg.subject}`), hist(userId, 'extracted', att.name)],
    createdAt: now(),
  };
  await db.insertDoc('acc.invoices', inv);
  await db.updateDoc<MailMessage & { id: string }>('acc.mailbox', msg.id, { invoiceId: inv.id, read: true });
  broadcast('acc.invoices');
  broadcast('acc.mailbox');
  await audit(userId, 'accounting.invoice.import', `${inv.vendorName} #${inv.invoiceNo}${automated ? ' (automatic)' : ''}`);
  return matchInvoiceRecord(inv.id, userId);
}

/** Validates a vendor invoice against its BC purchase order (3-way match). */
export async function matchInvoiceRecord(id: string, userId: string): Promise<Invoice> {
  const inv = await db.getDoc<Invoice>('acc.invoices', id);
  if (!inv) throw new HttpError(404, 'Invoice not found');
  if (inv.stage === 'posted') return inv;
  const [po, settings] = await Promise.all([config.bc.enabled && inv.poNo.trim() ? bc.getPurchaseOrder(inv.poNo) : Promise.resolve(undefined), getSettings()]);
  const vendorNo = inv.vendorNo ?? po?.vendorNo;
  const match = matchInvoice({ ...inv, vendorNo }, po, settings);
  const out = await db.updateDoc<Invoice>('acc.invoices', id, {
    vendorNo,
    match,
    stage: match.level === 'fail' ? 'extracted' : 'validated',
    history: [...inv.history, hist(userId, 'matched', match.level === 'ok' ? 'OK' : match.level === 'warn' ? 'WARN' : 'FAIL')],
  });
  broadcast('acc.invoices');
  return out ?? inv;
}

/** Creates the purchase invoice in Business Central for a validated vendor invoice. */
export async function postInvoice(id: string, userId: string, overrideNote?: string, automated = false): Promise<Invoice> {
  const inv = await db.getDoc<Invoice>('acc.invoices', id);
  if (!inv) throw new HttpError(404, 'Invoice not found');
  if (inv.stage === 'posted') throw new HttpError(409, 'Already posted');
  const created = await bc.createPurchaseInvoice(inv);
  await audit(userId, 'accounting.invoice.post', `${inv.vendorName} #${inv.invoiceNo} -> ${created.no}${automated ? ' (automatic)' : ''}`);
  const out = await db.updateDoc<Invoice>('acc.invoices', id, {
    stage: 'posted',
    approvedBy: userId,
    approvedAt: now(),
    overrideNote,
    bcInvoiceNo: created.no,
    postedAt: now(),
    history: [...inv.history, hist(userId, 'approved', overrideNote), hist(userId, 'posted', created.no)],
  });
  broadcast('acc.invoices');
  return out ?? inv;
}

/* ---------- the automation run ---------- */

export interface AutomationResult {
  mode: string;
  pos: number;
  invoices: number;
  approved: number;
  errors: number;
}

let running: Promise<AutomationResult> | undefined;

/** Runs the automation once. Concurrent calls share one run. Safe to call as often as needed. */
export function runAutomation(): Promise<AutomationResult> {
  running ??= doRun().finally(() => (running = undefined));
  return running;
}

async function doRun(): Promise<AutomationResult> {
  const settings = await getSettings();
  const out: AutomationResult = { mode: settings.mode, pos: 0, invoices: 0, approved: 0, errors: 0 };
  if (settings.mode === 'manual') return out;
  const fail = (what: string, e: unknown) => {
    out.errors++;
    console.warn(`[automation] ${what}: ${e instanceof Error ? e.message : String(e)}`);
  };
  const cap = settings.autoMaxAmount;
  const withinCap = (total: number) => !cap || total <= cap;

  // 1. New documents that were read by the AI: create the records and match them with Business Central.
  const messages = await db.listDocs<MailMessage & { id: string }>('acc.mailbox');
  const known = new Set((await db.listDocs<PoRecord>('acc.pos')).map((p) => `${p.mailId}:${p.attIndex}`));
  for (const msg of messages) {
    for (const [i, att] of msg.attachments.entries()) {
      if (!att.extracted) continue; // nothing was read: a person has to enter it
      const kind = classifyAttachment(att, msg).docType;
      try {
        if (kind === 'po' && !known.has(`${msg.id}:${i}`)) {
          await processPo(msg.id, i, SYSTEM_USER, true);
          out.pos++;
        } else if (kind === 'invoice' && !msg.invoiceId) {
          await importInvoice(msg.id, i, SYSTEM_USER, true);
          msg.invoiceId = 'done'; // one invoice per message
          out.invoices++;
        }
      } catch (e) {
        fail(`${msg.subject}`, e);
      }
    }
  }

  // 2. Orders that were not in Business Central yet may be now: match the open POs again.
  for (const p of await db.listDocs<PoRecord>('acc.pos')) {
    if (p.stage !== 'received' && p.stage !== 'mismatch') continue;
    try {
      await rematchPo(p.id, SYSTEM_USER);
    } catch (e) {
      fail(`PO ${p.poNo}`, e);
    }
  }

  // 3. Fully automatic: clean matches only. Any variance, however small, waits for a person.
  if (settings.mode === 'auto') {
    for (const p of await db.listDocs<PoRecord>('acc.pos')) {
      if (p.stage !== 'matched' || p.match?.level !== 'ok' || !withinCap(p.total)) continue;
      try {
        await approvePo(p.id, SYSTEM_USER, undefined, true);
        out.approved++;
      } catch (e) {
        fail(`approve PO ${p.poNo}`, e);
      }
    }
    for (const inv of await db.listDocs<Invoice>('acc.invoices')) {
      if (inv.stage !== 'validated' || inv.match?.level !== 'ok' || !withinCap(inv.total)) continue;
      try {
        await postInvoice(inv.id, SYSTEM_USER, undefined, true);
        out.approved++;
      } catch (e) {
        fail(`post invoice ${inv.invoiceNo}`, e);
      }
    }
  }
  if (out.pos || out.invoices || out.approved) console.log(`[automation] ${settings.mode}: ${out.pos} PO, ${out.invoices} invoice(s), ${out.approved} approved, ${out.errors} error(s)`);
  return out;
}
