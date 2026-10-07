/* ---------- Business Central (mirrors BC API v2.0 shapes, simplified) ---------- */
export interface BcVendor {
  id: string;
  no: string;
  name: string;
  email: string;
  currency: string;
}

export interface BcPoLine {
  lineNo: number;
  itemNo: string;
  description: string;
  uom: string;
  quantity: number;
  quantityReceived: number;
  quantityInvoiced: number;
  directUnitCost: number;
}

export interface BcPurchaseOrder {
  id: string;
  no: string;
  vendorNo: string;
  vendorName: string;
  orderDate: string;
  status: 'Open' | 'Released' | 'Closed';
  currency: string;
  lines: BcPoLine[];
}

export interface BcPurchaseInvoice {
  id: string;
  no: string;
  vendorInvoiceNo: string;
  vendorNo: string;
  poNo: string;
  postingDate: string;
  amount: number;
  imagoInvoiceId: string;
}

/* ---------- Mailbox ---------- */
/** What a received PDF is: a vendor invoice, a purchase order (bon de commande) or something else. */
export type DocType = 'invoice' | 'po' | 'other';
/** customer = a customer ordering from Pubco (sales side); vendor = a PO of ours confirmed by a vendor. */
export type PoDirection = 'customer' | 'vendor';

export interface ExtractedInvoice {
  /** Set by the AI when it classified the document. */
  docType?: DocType;
  poDirection?: PoDirection | '';
  vendorName: string;
  vendorEmail: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  poNo: string;
  currency: string;
  lines: { itemNo: string; description: string; uom: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface MailAttachment {
  name: string;
  sizeKb: number;
  /** Stored file on the API server (`/api/files/:id`). Absent in the browser dev backend. */
  fileId?: string;
  /** Extraction result (dev: canned; server: AI extraction of the PDF, when configured). */
  extracted?: ExtractedInvoice;
  /** Classification: AI or rules at sync time, or a person's correction (`classifiedBy: 'user'`). */
  docType?: DocType;
  poDirection?: PoDirection;
  classifiedBy?: 'ai' | 'rules' | 'user';
}

export interface MailMessage {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  receivedAt: string;
  body: string;
  attachments: MailAttachment[];
  read: boolean;
  /** Microsoft Graph message id (API server only). */
  graphId?: string;
  /** Imago invoice created from this message. */
  invoiceId?: string;
  archived?: boolean;
}

/* ---------- Imago invoice ---------- */
export type InvoiceStage = 'received' | 'extracted' | 'validated' | 'posted' | 'rejected';

export interface InvoiceLine {
  id: string;
  itemNo: string;
  description: string;
  uom: string;
  quantity: number;
  unitPrice: number;
}

export type CheckLevel = 'ok' | 'warn' | 'fail';

export interface Check {
  code: string;
  level: CheckLevel;
  message: { fr: string; en: string };
}

export interface LineMatch {
  invoiceLineId: string;
  poLineNo?: number;
  level: CheckLevel;
  orderedQty?: number;
  receivedQty?: number;
  alreadyInvoicedQty?: number;
  availableQty?: number;
  poUnitCost?: number;
  priceVariancePct?: number;
  checks: Check[];
}

export interface MatchResult {
  at: string;
  level: CheckLevel;
  poFound: boolean;
  header: Check[];
  lines: LineMatch[];
}

export interface HistoryEntry {
  at: string;
  userId: string;
  action: string;
  note?: string;
}

export interface Invoice {
  id: string;
  mailId?: string;
  sourceFile?: string;
  vendorNo?: string;
  vendorName: string;
  vendorEmail?: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  poNo: string;
  currency: string;
  lines: InvoiceLine[];
  subtotal: number;
  tax: number;
  total: number;
  stage: InvoiceStage;
  match?: MatchResult;
  approvedBy?: string;
  approvedAt?: string;
  overrideNote?: string;
  bcInvoiceNo?: string;
  postedAt?: string;
  history: HistoryEntry[];
  createdAt: string;
}

export interface AccountingSettings {
  id: 'settings';
  mailbox: string;
  qtyTolerance: number;
  priceTolerancePct: number;
  totalTolerance: number;
  requireApprovalAbove: number;
}
