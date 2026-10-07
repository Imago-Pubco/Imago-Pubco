/**
 * Purchase orders received by e-mail ("bons de commande") and their match against Business Central.
 *
 *  - customer PO: a customer orders from Pubco  -> matched to a BC SALES order -> a sales invoice is created.
 *  - vendor PO:   a vendor confirms our own PO  -> matched to a BC PURCHASE order (nothing to invoice here;
 *                 the vendor's invoice follows through the vendor-invoice flow).
 *
 * Pure types and functions: shared by the server (pipeline) and the screens.
 */
import type { AccountingSettings, BcPurchaseOrder, Check, CheckLevel, HistoryEntry, InvoiceLine, LineMatch, MatchResult, PoDirection } from './types';

/* ---------- Business Central shapes (subset, API v2.0) ---------- */

export interface BcSalesOrderLine {
  lineNo: number;
  itemNo: string;
  description: string;
  uom: string;
  quantity: number;
  quantityShipped: number;
  quantityInvoiced: number;
  unitPrice: number;
}

export interface BcSalesOrder {
  id: string;
  no: string;
  /** The customer's own PO number (BC "External Document No."). */
  externalDocNo: string;
  customerNo: string;
  customerName: string;
  orderDate: string;
  status: string;
  currency: string;
  lines: BcSalesOrderLine[];
}

/** A BC invoice kept in sync here, sales (customers) or purchase (vendors). */
export interface BcInvoiceRow {
  id: string;
  kind: 'sales' | 'purchase';
  no: string;
  /** Customer's PO no. (sales) or vendor's invoice no. (purchase). */
  externalDocNo: string;
  partyNo: string;
  partyName: string;
  invoiceDate: string;
  dueDate: string;
  /** BC status: Draft, In Review, Open (posted, unpaid), Paid, Canceled, Corrective. */
  status: string;
  currency: string;
  total: number;
  /** Amount still to pay or to collect, when BC provides it. */
  remaining?: number;
  syncedAt: string;
}

/* ---------- Imago PO record ---------- */

export type PoStage = 'received' | 'matched' | 'mismatch' | 'invoiced' | 'confirmed' | 'rejected';

export interface PoRecord {
  id: string;
  mailId: string;
  attIndex: number;
  fileId?: string;
  fileName: string;
  direction: PoDirection;
  poNo: string;
  partyName: string;
  /** Customer no. (sales) or vendor no. (purchase) in BC, once known. */
  partyNo?: string;
  poDate: string;
  currency: string;
  lines: InvoiceLine[];
  total: number;
  stage: PoStage;
  match?: MatchResult;
  bcOrderId?: string;
  bcOrderNo?: string;
  bcInvoiceId?: string;
  bcInvoiceNo?: string;
  approvedBy?: string;
  approvedAt?: string;
  overrideNote?: string;
  /** How the record was created and approved: by a person or by the automation. */
  automated?: boolean;
  history: HistoryEntry[];
  createdAt: string;
}

/* ---------- matching ---------- */

const worst = (levels: CheckLevel[]): CheckLevel => (levels.includes('fail') ? 'fail' : levels.includes('warn') ? 'warn' : 'ok');
const round2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface OrderLike {
  no: string;
  partyNo: string;
  partyName: string;
  status: string;
  currency: string;
  lines: { lineNo: number; itemNo: string; description: string; uom: string; quantity: number; quantityDone: number; quantityInvoiced: number; price: number }[];
}

export const fromSalesOrder = (o: BcSalesOrder): OrderLike => ({
  no: o.no,
  partyNo: o.customerNo,
  partyName: o.customerName,
  status: o.status,
  currency: o.currency,
  lines: o.lines.map((l) => ({ lineNo: l.lineNo, itemNo: l.itemNo, description: l.description, uom: l.uom, quantity: l.quantity, quantityDone: l.quantityShipped, quantityInvoiced: l.quantityInvoiced, price: l.unitPrice })),
});

export const fromPurchaseOrder = (o: BcPurchaseOrder): OrderLike => ({
  no: o.no,
  partyNo: o.vendorNo,
  partyName: o.vendorName,
  status: o.status,
  currency: o.currency,
  lines: o.lines.map((l) => ({ lineNo: l.lineNo, itemNo: l.itemNo, description: l.description, uom: l.uom, quantity: l.quantity, quantityDone: l.quantityReceived, quantityInvoiced: l.quantityInvoiced, price: l.directUnitCost })),
});

/**
 * Compares a received PO with the BC order it should correspond to. The result uses the same shape as the
 * invoice match (header checks + one result per line) so the screens can show both the same way.
 */
export function matchPo(
  po: Pick<PoRecord, 'direction' | 'poNo' | 'partyName' | 'partyNo' | 'currency' | 'lines'>,
  order: OrderLike | undefined,
  settings: AccountingSettings,
  /** Whether the e-mail's sender address matches the customer / vendor in BC. `false` or unknown blocks automatic approval. */
  senderVerified?: boolean,
): MatchResult {
  const at = new Date().toISOString();
  const header: Check[] = [];
  const customer = po.direction === 'customer';

  if (!order) {
    header.push({
      code: 'order.missing',
      level: 'fail',
      message: customer
        ? { fr: `Aucune commande client avec le n° externe « ${po.poNo || '—'} » dans Business Central.`, en: `No BC sales order with external no. "${po.poNo || '—'}".` }
        : { fr: `Bon de commande « ${po.poNo || '—'} » introuvable dans Business Central.`, en: `Purchase order "${po.poNo || '—'}" not found in Business Central.` },
    });
    return { at, level: 'fail', poFound: false, header, lines: [] };
  }

  header.push({ code: 'order.found', level: 'ok', message: { fr: `Commande ${order.no} trouvée dans Business Central.`, en: `Order ${order.no} found in Business Central.` } });

  if (/^(draft|brouillon|in review)$/i.test(order.status)) {
    header.push({ code: 'order.status', level: 'warn', message: { fr: `Statut de la commande au BC : ${order.status}.`, en: `Order status in BC: ${order.status}.` } });
  } else if (/^(closed|canceled|cancelled)$/i.test(order.status)) {
    header.push({ code: 'order.status', level: 'fail', message: { fr: `La commande est ${order.status} au BC.`, en: `The order is ${order.status} in BC.` } });
  }

  const sameParty = po.partyNo ? po.partyNo === order.partyNo : norm(po.partyName) === norm(order.partyName) || norm(order.partyName).includes(norm(po.partyName)) || norm(po.partyName).includes(norm(order.partyName));
  header.push(
    sameParty
      ? { code: 'party.ok', level: 'ok', message: { fr: `${customer ? 'Client' : 'Fournisseur'} confirmé : ${order.partyName}.`, en: `${customer ? 'Customer' : 'Vendor'} confirmed: ${order.partyName}.` } }
      : { code: 'party.mismatch', level: 'fail', message: { fr: `${customer ? 'Client' : 'Fournisseur'} du document (${po.partyName}) ≠ BC (${order.partyName}).`, en: `${customer ? 'Customer' : 'Vendor'} on the document (${po.partyName}) ≠ BC (${order.partyName}).` } },
  );

  if (senderVerified !== true) {
    header.push({
      code: 'sender.unverified',
      level: 'warn',
      message: {
        fr: `Expéditeur non vérifié : l’adresse du courriel ne correspond pas à celle du ${customer ? 'client' : 'fournisseur'} dans Business Central.`,
        en: `Sender not verified: the e-mail address does not match the ${customer ? 'customer' : 'vendor'} in Business Central.`,
      },
    });
  }

  if (po.currency && po.currency !== order.currency) {
    header.push({ code: 'currency', level: 'fail', message: { fr: `Devise ${po.currency} ≠ devise du BC ${order.currency}.`, en: `Currency ${po.currency} ≠ BC currency ${order.currency}.` } });
  }

  const used = new Set<number>();
  const lines: LineMatch[] = po.lines.map((pl) => {
    const checks: Check[] = [];
    const ol =
      order.lines.find((l) => !used.has(l.lineNo) && l.itemNo && l.itemNo === pl.itemNo) ??
      order.lines.find((l) => !used.has(l.lineNo) && norm(l.description) === norm(pl.description));
    if (!ol) {
      checks.push({ code: 'line.unmatched', level: 'fail', message: { fr: `Article ${pl.itemNo || pl.description} absent de la commande BC.`, en: `Item ${pl.itemNo || pl.description} is not on the BC order.` } });
      return { invoiceLineId: pl.id, level: 'fail', checks };
    }
    used.add(ol.lineNo);

    const open = ol.quantity - ol.quantityInvoiced;
    if (pl.quantity !== ol.quantity) {
      checks.push({
        code: 'line.qty',
        level: pl.quantity > ol.quantity ? 'fail' : 'warn',
        message: { fr: `Quantité ${pl.quantity} ≠ ${ol.quantity} commandée au BC.`, en: `Quantity ${pl.quantity} ≠ ${ol.quantity} ordered in BC.` },
      });
    } else {
      checks.push({ code: 'line.qty.ok', level: 'ok', message: { fr: 'Quantité conforme au BC.', en: 'Quantity matches BC.' } });
    }
    if (customer && open <= 0) {
      checks.push({ code: 'line.invoiced', level: 'fail', message: { fr: 'Cette ligne est déjà entièrement facturée au BC.', en: 'This line is already fully invoiced in BC.' } });
    }
    if (pl.uom && ol.uom && norm(pl.uom) !== norm(ol.uom)) {
      checks.push({ code: 'line.uom', level: 'warn', message: { fr: `Unité ${pl.uom} ≠ ${ol.uom} au BC.`, en: `UoM ${pl.uom} ≠ ${ol.uom} in BC.` } });
    }
    const variance = ol.price && pl.unitPrice ? ((pl.unitPrice - ol.price) / ol.price) * 100 : 0;
    if (pl.unitPrice && Math.abs(variance) > settings.priceTolerancePct) {
      checks.push({
        code: 'line.price',
        level: 'fail',
        message: {
          fr: `Prix ${pl.unitPrice.toFixed(4)} vs ${ol.price.toFixed(4)} au BC (${variance > 0 ? '+' : ''}${variance.toFixed(1)} %, tolérance ${settings.priceTolerancePct} %).`,
          en: `Price ${pl.unitPrice.toFixed(4)} vs ${ol.price.toFixed(4)} in BC (${variance > 0 ? '+' : ''}${variance.toFixed(1)}%, tolerance ${settings.priceTolerancePct}%).`,
        },
      });
    } else if (pl.unitPrice) {
      checks.push({ code: 'line.price.ok', level: 'ok', message: { fr: 'Prix conforme au BC.', en: 'Price matches BC.' } });
    }
    return {
      invoiceLineId: pl.id,
      poLineNo: ol.lineNo,
      level: worst(checks.map((c) => c.level)),
      orderedQty: ol.quantity,
      receivedQty: ol.quantityDone,
      alreadyInvoicedQty: ol.quantityInvoiced,
      availableQty: open,
      poUnitCost: ol.price,
      priceVariancePct: round2(variance),
      checks,
    };
  });

  const extra = order.lines.filter((l) => !used.has(l.lineNo));
  if (extra.length) {
    header.push({
      code: 'order.extraLines',
      level: 'warn',
      message: { fr: `${extra.length} ligne(s) de la commande BC absente(s) du document.`, en: `${extra.length} BC order line(s) missing from the document.` },
    });
  }
  if (!po.lines.length) {
    header.push({ code: 'doc.noLines', level: 'warn', message: { fr: 'Aucune ligne lue dans le document : vérifiez ou saisissez les lignes.', en: 'No lines were read from the document: check or enter them.' } });
  }

  return { at, level: worst([...header.map((h) => h.level), ...lines.map((l) => l.level)]), poFound: true, header, lines };
}
