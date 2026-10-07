/**
 * Business Central connector (API v2.0), mapped to the shapes the front end already uses
 * (`BcVendor`, `BcPurchaseOrder`, `BcPurchaseInvoice`).
 */
import type { BcInvoiceRow, BcSalesOrder, PoRecord } from '../src/modules/accounting/orders.ts';
import type { BcPurchaseInvoice, BcPurchaseOrder, BcVendor, Invoice } from '../src/modules/accounting/types.ts';
import { config } from './config.ts';
import { HttpError, msFetch } from './ms.ts';

const SCOPE = 'https://api.businesscentral.dynamics.com/.default';

function root() {
  const { tenantId } = config.ms;
  return `https://api.businesscentral.dynamics.com/v2.0/${encodeURIComponent(tenantId)}/${encodeURIComponent(config.bc.environment)}/api/v2.0`;
}
function company() {
  return `${root()}/companies(${config.bc.companyId})`;
}
/** OData string literal. */
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function get<T>(url: string): Promise<T> {
  return (await msFetch(SCOPE, url)).json() as Promise<T>;
}

export function assertBc() {
  if (!config.bc.enabled) throw new HttpError(503, 'Business Central is not configured on the server (.env).');
}

/* ---------- raw BC shapes (subset) ---------- */
interface RawVendor {
  id: string;
  number: string;
  displayName: string;
  email: string;
  currencyCode: string;
}
interface RawPoLine {
  sequence: number;
  lineType: string;
  lineObjectNumber: string;
  description: string;
  unitOfMeasureCode: string;
  quantity: number;
  receivedQuantity: number;
  invoicedQuantity: number;
  directUnitCost: number;
}
interface RawPo {
  id: string;
  number: string;
  vendorNumber: string;
  vendorName: string;
  orderDate: string;
  status: string;
  currencyCode: string;
  purchaseOrderLines?: RawPoLine[];
}

const currency = (code: string) => code || config.bc.localCurrency;

const mapVendor = (v: RawVendor): BcVendor => ({
  id: v.id,
  no: v.number,
  name: v.displayName,
  email: v.email ?? '',
  currency: currency(v.currencyCode),
});

const mapPo = (p: RawPo): BcPurchaseOrder => ({
  id: p.id,
  no: p.number,
  vendorNo: p.vendorNumber,
  vendorName: p.vendorName,
  orderDate: p.orderDate,
  status: /releas/i.test(p.status) ? 'Released' : /clos/i.test(p.status) ? 'Closed' : 'Open',
  currency: currency(p.currencyCode),
  lines: (p.purchaseOrderLines ?? [])
    .filter((l) => l.lineType === 'Item' || l.lineType === 'Account')
    .map((l) => ({
      lineNo: l.sequence,
      itemNo: l.lineObjectNumber,
      description: l.description,
      uom: l.unitOfMeasureCode,
      quantity: l.quantity,
      quantityReceived: l.receivedQuantity,
      quantityInvoiced: l.invoicedQuantity,
      directUnitCost: l.directUnitCost,
    })),
});

/* ---------- public API ---------- */

/** Connection test: signs in and lists companies, confirming BC_COMPANY_ID exists. */
export async function testConnection() {
  const r = await get<{ value: { id: string; name: string; displayName: string }[] }>(`${root()}/companies`);
  const companies = r.value.map((c) => ({ id: c.id, name: c.displayName || c.name }));
  const match = companies.find((c) => c.id.toLowerCase() === config.bc.companyId.toLowerCase());
  return { environment: config.bc.environment, companies, companyFound: !!match, company: match?.name };
}

export async function listVendors(): Promise<BcVendor[]> {
  assertBc();
  const r = await get<{ value: RawVendor[] }>(`${company()}/vendors?$top=1000`);
  return r.value.map(mapVendor);
}

export async function findVendor(email: string | undefined, name: string): Promise<BcVendor | undefined> {
  assertBc();
  const tryFilter = async (filter: string) =>
    (await get<{ value: RawVendor[] }>(`${company()}/vendors?$top=1&$filter=${encodeURIComponent(filter)}`)).value[0];
  const domain = email?.split('@')[1]?.toLowerCase();
  const v =
    (email && (await tryFilter(`email eq ${lit(email)}`))) ||
    (domain && (await tryFilter(`contains(email,${lit('@' + domain)})`))) ||
    (name && (await tryFilter(`displayName eq ${lit(name)}`))) ||
    undefined;
  return v ? mapVendor(v) : undefined;
}

export async function listPurchaseOrders(): Promise<BcPurchaseOrder[]> {
  assertBc();
  const r = await get<{ value: RawPo[] }>(`${company()}/purchaseOrders?$top=250&$orderby=orderDate desc&$expand=purchaseOrderLines`);
  return r.value.map(mapPo);
}

export async function getPurchaseOrder(no: string): Promise<BcPurchaseOrder | undefined> {
  assertBc();
  const filter = encodeURIComponent(`number eq ${lit(no.trim())}`);
  const r = await get<{ value: RawPo[] }>(`${company()}/purchaseOrders?$filter=${filter}&$expand=purchaseOrderLines`);
  return r.value[0] ? mapPo(r.value[0]) : undefined;
}

/**
 * Creates a purchase invoice in BC from an Imago invoice (header + item lines) and,
 * when BC_POST_MODE=post, posts it.
 */
export async function createPurchaseInvoice(inv: Invoice): Promise<BcPurchaseInvoice> {
  assertBc();
  const po = await getPurchaseOrder(inv.poNo);
  const vendorNo = inv.vendorNo ?? po?.vendorNo;
  if (!vendorNo) throw new HttpError(400, 'Vendor number unknown: link the invoice to a BC vendor first.');

  const header = {
    vendorNumber: vendorNo,
    vendorInvoiceNumber: inv.invoiceNo,
    invoiceDate: inv.invoiceDate,
    ...(inv.dueDate ? { dueDate: inv.dueDate } : {}),
    ...(inv.currency && inv.currency !== config.bc.localCurrency ? { currencyCode: inv.currency } : {}),
  };
  const created = (await (
    await msFetch(SCOPE, `${company()}/purchaseInvoices`, { method: 'POST', body: JSON.stringify(header) })
  ).json()) as { id: string; number: string };

  for (const l of inv.lines) {
    await msFetch(SCOPE, `${company()}/purchaseInvoices(${created.id})/purchaseInvoiceLines`, {
      method: 'POST',
      body: JSON.stringify({
        lineType: 'Item',
        lineObjectNumber: l.itemNo,
        description: l.description,
        quantity: l.quantity,
        directUnitCost: l.unitPrice,
        ...(l.uom ? { unitOfMeasureCode: l.uom } : {}),
      }),
    });
  }

  let number = created.number;
  if (config.bc.postMode === 'post') {
    await msFetch(SCOPE, `${company()}/purchaseInvoices(${created.id})/Microsoft.NAV.post`, { method: 'POST' });
    const posted = await get<{ value: { number: string }[] }>(
      `${company()}/purchaseInvoices?$top=1&$filter=${encodeURIComponent(`vendorInvoiceNumber eq ${lit(inv.invoiceNo)} and vendorNumber eq ${lit(vendorNo)}`)}`,
    );
    number = posted.value[0]?.number ?? number;
  }

  return {
    id: created.id,
    no: number,
    vendorInvoiceNo: inv.invoiceNo,
    vendorNo,
    poNo: inv.poNo,
    postingDate: new Date().toISOString(),
    amount: inv.total,
    imagoInvoiceId: inv.id,
  };
}

/* ---------- sales side: customer orders and invoices ---------- */

interface RawSalesLine {
  sequence: number;
  lineType: string;
  lineObjectNumber: string;
  description: string;
  unitOfMeasureCode: string;
  quantity: number;
  shippedQuantity: number;
  invoicedQuantity: number;
  unitPrice: number;
}
interface RawSalesOrder {
  id: string;
  number: string;
  externalDocumentNumber: string;
  customerNumber: string;
  customerName: string;
  orderDate: string;
  status: string;
  currencyCode: string;
  salesOrderLines?: RawSalesLine[];
}

const mapSalesOrder = (o: RawSalesOrder): BcSalesOrder => ({
  id: o.id,
  no: o.number,
  externalDocNo: o.externalDocumentNumber ?? '',
  customerNo: o.customerNumber,
  customerName: o.customerName,
  orderDate: o.orderDate,
  status: o.status,
  currency: currency(o.currencyCode),
  lines: (o.salesOrderLines ?? [])
    .filter((l) => l.lineType === 'Item' || l.lineType === 'Resource' || l.lineType === 'Charge (Item)')
    .map((l) => ({
      lineNo: l.sequence,
      itemNo: l.lineObjectNumber,
      description: l.description,
      uom: l.unitOfMeasureCode,
      quantity: l.quantity,
      quantityShipped: l.shippedQuantity,
      quantityInvoiced: l.invoicedQuantity,
      unitPrice: l.unitPrice,
    })),
});

/** Follows OData paging so large lists are complete. */
async function getAll<T>(url: string, max = 5000): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = url;
  while (next && out.length < max) {
    const page: { value: T[]; '@odata.nextLink'?: string } = await get(next);
    out.push(...page.value);
    next = page['@odata.nextLink'];
  }
  return out;
}

export async function listSalesOrders(): Promise<BcSalesOrder[]> {
  assertBc();
  const rows = await getAll<RawSalesOrder>(`${company()}/salesOrders?$orderby=orderDate desc&$expand=salesOrderLines`, 1000);
  return rows.map(mapSalesOrder);
}

/** The BC sales order whose "External Document No." is the customer's PO number (or whose own number matches). */
export async function findSalesOrderByCustomerPo(poNo: string): Promise<BcSalesOrder | undefined> {
  assertBc();
  const no = poNo.trim();
  if (!no) return undefined;
  for (const field of ['externalDocumentNumber', 'number']) {
    const r = await get<{ value: RawSalesOrder[] }>(`${company()}/salesOrders?$filter=${encodeURIComponent(`${field} eq ${lit(no)}`)}&$expand=salesOrderLines`);
    if (r.value[0]) return mapSalesOrder(r.value[0]);
  }
  return undefined;
}

/** Customer PO to sales invoice: creates the invoice (and its lines) in BC; posts it when BC_POST_MODE=post. */
export async function createSalesInvoice(po: PoRecord, order: BcSalesOrder): Promise<{ id: string; no: string }> {
  assertBc();
  const header = {
    customerNumber: order.customerNo,
    externalDocumentNumber: po.poNo,
    invoiceDate: new Date().toISOString().slice(0, 10),
    ...(order.currency && order.currency !== config.bc.localCurrency ? { currencyCode: order.currency } : {}),
  };
  const created = (await (await msFetch(SCOPE, `${company()}/salesInvoices`, { method: 'POST', body: JSON.stringify(header) })).json()) as { id: string; number: string };
  for (const l of po.lines) {
    await msFetch(SCOPE, `${company()}/salesInvoices(${created.id})/salesInvoiceLines`, {
      method: 'POST',
      body: JSON.stringify({
        lineType: 'Item',
        lineObjectNumber: l.itemNo,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        ...(l.uom ? { unitOfMeasureCode: l.uom } : {}),
      }),
    });
  }
  let number = created.number;
  if (config.bc.postMode === 'post') {
    await msFetch(SCOPE, `${company()}/salesInvoices(${created.id})/Microsoft.NAV.post`, { method: 'POST' });
    const posted = await get<{ value: { number: string }[] }>(
      `${company()}/salesInvoices?$top=1&$filter=${encodeURIComponent(`externalDocumentNumber eq ${lit(po.poNo)} and customerNumber eq ${lit(order.customerNo)}`)}&$orderby=invoiceDate desc`,
    );
    number = posted.value[0]?.number ?? number;
  }
  return { id: created.id, no: number };
}

/* ---------- invoices kept in sync (sales and purchase) ---------- */

interface RawInvoice {
  id: string;
  number: string;
  externalDocumentNumber?: string;
  vendorInvoiceNumber?: string;
  customerNumber?: string;
  customerName?: string;
  vendorNumber?: string;
  vendorName?: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  currencyCode: string;
  totalAmountIncludingTax: number;
  remainingAmount?: number;
}

export async function listBcInvoices(): Promise<BcInvoiceRow[]> {
  assertBc();
  const at = new Date().toISOString();
  const [sales, purchase] = await Promise.all([
    getAll<RawInvoice>(`${company()}/salesInvoices?$orderby=invoiceDate desc`, 2000),
    getAll<RawInvoice>(`${company()}/purchaseInvoices?$orderby=invoiceDate desc`, 2000),
  ]);
  return [
    ...sales.map((i): BcInvoiceRow => ({
      id: i.id,
      kind: 'sales',
      no: i.number,
      externalDocNo: i.externalDocumentNumber ?? '',
      partyNo: i.customerNumber ?? '',
      partyName: i.customerName ?? '',
      invoiceDate: i.invoiceDate,
      dueDate: i.dueDate,
      status: i.status,
      currency: currency(i.currencyCode),
      total: i.totalAmountIncludingTax,
      remaining: i.remainingAmount,
      syncedAt: at,
    })),
    ...purchase.map((i): BcInvoiceRow => ({
      id: i.id,
      kind: 'purchase',
      no: i.number,
      externalDocNo: i.vendorInvoiceNumber ?? '',
      partyNo: i.vendorNumber ?? '',
      partyName: i.vendorName ?? '',
      invoiceDate: i.invoiceDate,
      dueDate: i.dueDate,
      status: i.status,
      currency: currency(i.currencyCode),
      total: i.totalAmountIncludingTax,
      remaining: i.remainingAmount,
      syncedAt: at,
    })),
  ];
}
