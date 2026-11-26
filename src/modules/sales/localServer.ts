/**
 * Browser stand-in for the sales routes of server/sales.ts, used when API_MODE is false (npm run dev, no server).
 * It follows the server's rules: the same stage circuit, validation, estimate and work order effects, quote tokens
 * and customer answers. Data lives in this browser's collections. server/sales.ts stays the source of truth:
 * change both together. Permission checks are not repeated here: the screens only offer what the user may do.
 * AI reading and e-mail are off, as on a server without AI or SMTP settings.
 */
import { z } from 'zod';
import { ApiError, collection, uid } from '@/data/db';
import { logAudit } from '@/data/stores';
import { BrandingSchema } from '@/branding/brandingSchema';
import type { WorkOrder } from '@/modules/workorders/types';
import { FINISHES, OPTIONS, PACKAGING_TYPES, STYLES } from '../estimating/catalog';
import { DEFAULT_EST_SETTINGS } from '../estimating/defaults';
import { priceBreaks } from '../estimating/pricing';
import type { Estimate, EstimateStatus, EstimatingSettings, Material, PackagingSpec, PackagingType } from '../estimating/types';
import type { FormField, Quote, QuoteLine, QuoteResponse, RequestSource, SalesNote, SalesRequest, SalesStage, StageEvent, StudioStatus } from './types';
import { DEFAULT_REQUEST_FORM, answersToRequestFields, parseQuantities } from './formFields';
import { buildEstimateDraft } from './autoEstimate';
import type { CreateRequestBody } from './stores';

const MB = 1024 * 1024;
/** Same key as AuthContext uses for the browser backend's session. */
const SESSION_KEY = 'imago:session';
const BRANDING_KEY = 'imago:branding';
/** Storage key of the 'local.files' collection (read synchronously by localFileUrl). */
const FILES_KEY = 'imago:db:local.files';
const TYPES = PACKAGING_TYPES.map((t) => t.key);
const PRINT = ['offset', 'flexo', 'digital', 'none'];
const STUDIO: StudioStatus[] = ['none', 'requested', 'in_progress', 'done'];
const UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];

/** Lets a null value clear a key in the shallow merge of a collection update (undefined would be dropped). */
const CLEAR = null as unknown as undefined;

/** Collections: the same names the server uses for its tables. */
const requests = collection<SalesRequest>('sales.requests');
const quotes = collection<Quote>('sales.quotes');
const estimates = collection<Estimate>('est.estimates');
const materials = collection<Material>('est.materials');
const estSettingsRows = collection<EstimatingSettings>('est.settings');
const workOrders = collection<WorkOrder>('wo.orders');
const appSettings = collection<{ id: string; value: unknown }>('app.settings');

/** Uploaded image or PDF. `public` marks files sent through the public form (only those may be attached to a public request). */
interface LocalFile {
  id: string;
  name: string;
  contentType: string;
  dataUrl: string;
  public: boolean;
  uploadedAt: string;
}
const files = collection<LocalFile>('local.files');

const fail = (status: number, error: string): never => {
  throw new ApiError(status, error);
};
const now = () => new Date().toISOString();
const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : '');
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const validEmail = (v: string) => v.length <= 254 && EMAIL_RE.test(v);
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const numOrUndef = (x: unknown) => (x === null || x === undefined || x === '' ? NaN : Number(x));

/** Allocation of numbers and creation of documents run one at a time, so two requests never get the same number. */
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

/** "26-0004" after the highest NNNN of the given documents (the NNNN part of REQ-, EST-, Q-, WO- numbers). */
function nextSeq(docs: { no?: string }[]): string {
  const max = docs.reduce((m, d) => Math.max(m, parseInt(String(d.no ?? '').split('-')[2] ?? '', 10) || 0), 0);
  return `${String(new Date().getFullYear()).slice(2)}-${String(max + 1).padStart(4, '0')}`;
}

/** The signed-in user id (the browser backend keeps the session in localStorage). Empty when nobody is signed in. */
export function localUserId(): string {
  try {
    return localStorage.getItem(SESSION_KEY) ?? '';
  } catch {
    return '';
  }
}

async function estSettings(): Promise<EstimatingSettings> {
  const s = await estSettingsRows.get('settings');
  return { ...DEFAULT_EST_SETTINGS, ...(s ?? {}) };
}

/* ---------- validation of incoming fields ---------- */

function cleanQuantities(v: unknown): number[] {
  const list: unknown[] = typeof v === 'string' ? parseQuantities(v) : Array.isArray(v) ? v : [];
  const out: number[] = [];
  for (const x of list) {
    const n = Math.round(Number(x));
    if (Number.isFinite(n) && n > 0 && n <= 10_000_000 && !out.includes(n)) out.push(n);
    if (out.length >= 12) break;
  }
  return out;
}

/** Keeps only valid spec values. */
function cleanSpec(v: unknown, mats: Material[]): Partial<PackagingSpec> {
  if (!v || typeof v !== 'object') return {};
  const p = v as Record<string, unknown>;
  const out: Partial<PackagingSpec> = {};
  if (TYPES.includes(p.type as PackagingType)) out.type = p.type as PackagingType;
  const style = str(p.style, 40);
  if (style) out.style = style;
  const dim = (x: unknown) => {
    const n = Math.round(numOrUndef(x));
    return Number.isFinite(n) && n > 0 && n <= 5000 ? n : undefined;
  };
  const L = dim(p.lengthMm);
  const W = dim(p.widthMm);
  const H = dim(p.heightMm);
  if (L) out.lengthMm = L;
  if (W) out.widthMm = W;
  if (H) out.heightMm = H;
  const materialId = str(p.materialId, 80);
  if (materialId && mats.some((m) => m.id === materialId)) out.materialId = materialId;
  if (PRINT.includes(p.printProcess as string)) out.printProcess = p.printProcess as PackagingSpec['printProcess'];
  const count = (x: unknown) => {
    const n = Math.round(numOrUndef(x));
    return Number.isFinite(n) && n >= 0 && n <= 12 ? n : undefined;
  };
  const co = count(p.colorsOutside);
  const ci = count(p.colorsInside);
  if (co !== undefined) out.colorsOutside = co;
  if (ci !== undefined) out.colorsInside = ci;
  const finishes = Array.isArray(p.finishes) ? p.finishes.map(String).filter((k) => FINISHES.some((f) => f.key === k)) : [];
  if (finishes.length) out.finishes = finishes;
  const options = Array.isArray(p.options) ? p.options.map(String).filter((k) => OPTIONS.some((o) => o.key === k)) : [];
  if (options.length) out.options = options;
  if (typeof p.newDie === 'boolean') out.newDie = p.newDie;
  const notes = str(p.notes, 4000);
  if (notes) out.notes = notes;
  return out;
}

type RequestFieldsInput = Partial<Pick<SalesRequest, 'customer' | 'contact' | 'email' | 'phone' | 'project' | 'dueDate' | 'quantities' | 'spec' | 'description'>>;

/** Reads the fields sent by staff (POST /sales/requests). */
function readFields(v: unknown, mats: Material[]): RequestFieldsInput {
  const p = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    customer: str(p.customer, 300),
    contact: str(p.contact, 300),
    email: str(p.email, 254),
    phone: str(p.phone, 60),
    project: str(p.project, 300),
    dueDate: isoDate(p.dueDate),
    quantities: cleanQuantities(p.quantities),
    spec: cleanSpec(p.spec, mats),
    description: str(p.description, 20000),
  };
}

/** Only ids of files that exist are kept. */
async function existingFileIds(v: unknown): Promise<string[]> {
  if (!Array.isArray(v)) return [];
  const ids = [...new Set(v.map(String))].filter((id) => /^[A-Za-z0-9_-]{4,80}$/.test(id)).slice(0, 40);
  const out: string[] = [];
  for (const id of ids) if (await files.get(id)) out.push(id);
  return out;
}

/* ---------- ingestion: request -> request document -> estimate draft ---------- */

interface IngestInput {
  source: RequestSource;
  fields: RequestFieldsInput;
  text: string;
  fileIds: string[];
  /** Public form: answers by question label (French). */
  formAnswers?: Record<string, string>;
  ownerId: string;
  createdBy: string;
}

/** Creates a sales request and its estimate draft. No AI reading here: analysis stays 'none'. */
async function ingest(input: IngestInput): Promise<SalesRequest> {
  const mats = await materials.list();
  const text = str(input.text, 20000);
  const fileIds = input.fileIds.slice(0, 40);
  const f = input.fields;
  const emailIn = str(f.email, 254);

  return serial(async () => {
    const at = now();
    const id = uid('r_');
    const request: SalesRequest = {
      id,
      no: `REQ-${nextSeq(await requests.list())}`,
      source: input.source,
      stage: 'received',
      revision: 1,
      history: [{ at, by: input.source === 'form' ? 'client' : input.createdBy || 'system', from: null, to: 'received' }],
      customer: str(f.customer, 300),
      contact: str(f.contact, 300),
      email: validEmail(emailIn) ? emailIn : '',
      phone: str(f.phone, 300),
      project: str(f.project, 300),
      dueDate: isoDate(f.dueDate),
      ownerId: input.ownerId,
      description: str(f.description, 20000) || text,
      formAnswers: input.formAnswers,
      spec: cleanSpec(f.spec, mats),
      quantities: cleanQuantities(f.quantities),
      fileIds,
      analysis: { status: 'none', summary: '', assumptions: [], questions: [], confidence: 'low' },
      studio: { status: 'none', brief: '', fileIds: [] },
      notes: [],
      createdAt: at,
      updatedAt: at,
      createdBy: input.createdBy || 'system',
    };
    await requests.insert(request);

    try {
      const est = buildEstimateDraft({
        request,
        materials: mats,
        settings: await estSettings(),
        no: `EST-${nextSeq(await estimates.list())}`,
        ownerId: input.ownerId,
        now: at,
        id: uid('e_'),
      });
      await estimates.insert(est);
      const to: SalesStage = est.status === 'review' ? 'review' : 'estimating';
      const ev: StageEvent = { at, by: 'system', from: 'received', to };
      const patch: Partial<SalesRequest> = { stage: to, estimateId: est.id, history: [...request.history, ev], updatedAt: at };
      await requests.update(id, patch);
      return { ...request, ...patch } as SalesRequest;
    } catch (e) {
      console.error('[sales] estimate draft failed for', request.no, e);
      return request;
    }
  });
}

/* ---------- stage moves ---------- */

interface MoveRule {
  note: boolean;
  estimate?: { status: EstimateStatus; action: string };
}

/** Which stage moves are allowed, whether a note is required, and what happens to the estimate. */
function moveRule(from: SalesStage, to: SalesStage): MoveRule | undefined {
  if (from === to) return undefined;
  if (to === 'declined') return { note: true };
  if (from === 'declined') return to === 'estimating' ? { note: false } : undefined;
  if ((from === 'received' || from === 'estimating') && to === 'review') {
    return { note: false, estimate: { status: 'review', action: 'Estimation soumise à la révision' } };
  }
  if (from === 'review' && to === 'quote_ready') {
    return { note: false, estimate: { status: 'approved', action: 'Estimation approuvée' } };
  }
  if (from === 'review' && to === 'estimating') {
    return { note: true, estimate: { status: 'costing', action: 'Renvoyée en estimation' } };
  }
  if (from === 'with_client' && (to === 'accepted' || to === 'estimating')) return { note: true };
  if (from === 'accepted' && to === 'production') return { note: false };
  return undefined;
}

/** Writes the stage change (with its StageEvent) and the matching estimate change. */
async function moveRequest(
  request: SalesRequest,
  to: SalesStage,
  by: string,
  note: string | undefined,
  extra: Partial<SalesRequest> = {},
  est?: { status?: EstimateStatus; action?: string; note?: string; extra?: Partial<Estimate> },
): Promise<SalesRequest> {
  const at = now();
  const ev: StageEvent = { at, by, from: request.stage, to, ...(note ? { note } : {}) };
  const patch: Partial<SalesRequest> = { ...extra, stage: to, history: [...request.history, ev], updatedAt: at };
  const updated = await requests.update(request.id, patch);
  if (request.estimateId && est && (est.status || est.action || est.extra)) {
    const e = await estimates.get(request.estimateId);
    if (e) {
      const ePatch: Partial<Estimate> = {
        ...(est.extra ?? {}),
        ...(est.status ? { status: est.status } : {}),
        updatedAt: at,
        history: [...e.history, { at, userId: by, action: est.action ?? `Statut : ${est.status}`, ...(est.note ? { note: est.note } : {}) }],
      };
      await estimates.update(e.id, ePatch);
    }
  }
  return updated;
}

async function createWorkOrder(request: SalesRequest, by: string): Promise<WorkOrder> {
  const quote = request.quoteId ? await quotes.get(request.quoteId) : undefined;
  const estimate = request.estimateId ? await estimates.get(request.estimateId) : undefined;
  const quantity = quote?.response?.quantity ?? quote?.lines[0]?.quantity ?? estimate?.quantities[0] ?? 0;
  const line = quote?.lines.find((l) => l.quantity === quantity) ?? quote?.lines[0];
  return serial(async () => {
    const at = now();
    const wo: WorkOrder = {
      id: uid('wo_'),
      no: `WO-${nextSeq(await workOrders.list())}`,
      requestId: request.id,
      quoteId: request.quoteId ?? '',
      estimateId: request.estimateId ?? '',
      customer: request.customer,
      contact: request.contact,
      project: request.project,
      specSummary: quote?.specSummary ?? '',
      quantity,
      unitPrice: line?.unitPrice ?? 0,
      total: line?.total ?? 0,
      dueDate: request.dueDate,
      status: 'new',
      managerId: '',
      tasks: [],
      notes: '',
      createdAt: at,
      updatedAt: at,
      history: [{ at, by, text: `Créé à partir de ${request.no} (${quote?.no ?? 'sans soumission'})` }],
    };
    await workOrders.insert(wo);
    return wo;
  });
}

/* ---------- quote text ---------- */

function specSummary(spec: PackagingSpec, material: Material | undefined): string {
  const type = PACKAGING_TYPES.find((t) => t.key === spec.type)?.label.fr ?? spec.type;
  const style = STYLES[spec.type]?.find((x) => x.code === spec.style)?.label.fr ?? spec.style;
  const dims = spec.lengthMm && spec.widthMm && spec.heightMm ? `${spec.lengthMm} × ${spec.widthMm} × ${spec.heightMm} mm (intérieur)` : 'dimensions à confirmer';
  const print = spec.printProcess === 'none' ? 'sans impression' : `impression ${spec.printProcess}, ${spec.colorsOutside} couleur(s) extérieur / ${spec.colorsInside} intérieur`;
  const finishes = spec.finishes.map((k) => FINISHES.find((f) => f.key === k)?.label.fr ?? k);
  const options = spec.options.map((k) => OPTIONS.find((o) => o.key === k)?.label.fr ?? k);
  return [
    `${type} — ${style}`,
    dims,
    material ? `Matériau : ${material.name}` : '',
    print,
    finishes.length ? `Finitions : ${finishes.join(', ')}` : '',
    options.length ? `Options : ${options.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** 32 random bytes as base64url (43 characters), the same shape as the server's quote token. */
function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ---------- staff routes ---------- */

/** POST /sales/requests (staff). */
export async function localCreateRequest(body: CreateRequestBody, userId: string): Promise<SalesRequest> {
  const source: RequestSource = body.source === 'email' ? 'email' : 'manual';
  const request = await ingest({
    source,
    fields: readFields(body.fields, await materials.list()),
    text: str(body.text, 20000),
    fileIds: await existingFileIds(body.fileIds),
    ownerId: userId,
    createdBy: userId,
  });
  await logAudit(userId, 'sales.request.create', `${request.no} (${source})`);
  return request;
}

/** POST /sales/requests/:id/transition. Same table, notes and side effects as the server. */
export async function localTransition(id: string, to: SalesStage, note: string | undefined, userId: string): Promise<SalesRequest> {
  const request = await requests.get(id);
  if (!request) return fail(404, 'not_found');
  const text = str(note, 2000);
  const rule = moveRule(request.stage, to);
  if (!rule) return fail(400, 'invalid_move');
  if (rule.note && !text) return fail(400, 'note_required');
  if (to === 'production' && request.workOrderId) return fail(409, 'already_in_production');

  let workOrderId: string | undefined;
  if (to === 'production') workOrderId = (await createWorkOrder(request, userId)).id;
  const updated = await moveRequest(
    request,
    to,
    userId,
    text || undefined,
    workOrderId ? { workOrderId } : {},
    rule.estimate ? { status: rule.estimate.status, action: rule.estimate.action, note: text || undefined } : undefined,
  );
  await logAudit(userId, 'sales.request.move', `${request.no}: ${request.stage} -> ${to}${text ? ' · ' + text : ''}`);
  return updated;
}

/** POST /sales/requests/:id/studio. */
export async function localStudio(
  id: string,
  body: { status: StudioStatus; brief: string; fileIds: string[] },
  userId: string,
): Promise<SalesRequest> {
  const request = await requests.get(id);
  if (!request) return fail(404, 'not_found');
  const status = body.status;
  if (!STUDIO.includes(status)) return fail(400, 'invalid_status');
  const brief = str(body.brief, 4000);
  const fileIds = await existingFileIds(body.fileIds);
  const at = now();
  const studio = { status, brief, fileIds, updatedAt: at };
  const clearBlocker = request.blocker?.kind === 'studio';

  if (status === 'done' && request.stage === 'estimating') {
    const updated = await moveRequest(
      request,
      'review',
      userId,
      'Studio terminé',
      { studio, ...(clearBlocker ? { blocker: CLEAR } : {}) },
      { status: 'review', action: 'Croquis et découpes du studio reçus', extra: { dielineFileIds: fileIds, studioNotes: brief } },
    );
    await logAudit(userId, 'sales.studio.done', request.no);
    return updated;
  }
  if (status === 'done' && request.estimateId) {
    const e = await estimates.get(request.estimateId);
    if (e) await estimates.update(e.id, { dielineFileIds: fileIds, studioNotes: brief, updatedAt: at });
  }
  return requests.update(request.id, { studio, updatedAt: at, ...(clearBlocker ? { blocker: CLEAR } : {}) });
}

/** POST /sales/requests/:id/send-quote. No e-mail in dev mode: the link is shown to the user instead. */
export async function localSendQuote(
  id: string,
  body: { validDays?: number; terms?: string; notes?: string },
  userId: string,
): Promise<{ id: string; no: string; url: string; emailed: boolean }> {
  const request = await requests.get(id);
  if (!request) return fail(404, 'not_found');
  if (request.stage !== 'quote_ready') return fail(409, 'not_quote_ready');
  const estimate = request.estimateId ? await estimates.get(request.estimateId) : undefined;
  if (!estimate || estimate.status !== 'approved') return fail(409, 'estimate_not_approved');

  const validDays = Math.min(180, Math.max(1, Math.round(Number(body.validDays ?? 30)) || 30));
  const terms = str(body.terms, 4000);
  const notes = str(body.notes, 4000);
  const material = (await materials.list()).find((m) => m.id === estimate.spec.materialId);
  const prices = priceBreaks(estimate.spec, estimate.quantities, estimate.marginPct, material, await estSettings());
  // The customer sees prices only: never costs or margins.
  const lines: QuoteLine[] = prices.map((p) => ({ quantity: p.quantity, unitPrice: round(p.unitPrice, 4), total: round(p.price, 2) }));
  if (!lines.length) return fail(409, 'no_quantities');

  const at = now();
  const token = randomToken();
  const quote = await serial(async () => {
    const seq = nextSeq(await quotes.list());
    const previous = (await quotes.list()).filter((q) => q.requestId === request.id && q.status !== 'accepted' && q.status !== 'superseded');
    for (const q of previous) await quotes.update(q.id, { status: 'superseded' });
    const created: Quote = {
      id: uid('q_'),
      no: `Q-${seq}-R${request.revision}`,
      requestId: request.id,
      estimateId: estimate.id,
      revision: request.revision,
      status: 'sent',
      token,
      customer: request.customer,
      contact: request.contact,
      email: request.email,
      project: request.project,
      specSummary: specSummary(estimate.spec, material),
      lines,
      currency: 'CAD',
      terms,
      notes,
      validUntil: new Date(Date.now() + validDays * 86400_000).toISOString(),
      sentAt: at,
      sentBy: userId,
    };
    await quotes.insert(created);
    return created;
  });

  await moveRequest(
    request,
    'with_client',
    userId,
    `Soumission ${quote.no} prête (courriel non envoyé)`,
    { quoteId: quote.id },
    { status: 'sent', action: `Soumission ${quote.no} envoyée` },
  );
  await logAudit(userId, 'sales.quote.send', `${quote.no} -> ${quote.email || 'sans courriel'}`);
  return { id: quote.id, no: quote.no, url: `${window.location.origin}/q/${token}`, emailed: false };
}

/** Reads a file as base64 (without the data URL prefix). */
export function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = String(fr.result);
      resolve(s.slice(s.indexOf(',') + 1));
    };
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

/** True when the first bytes of the file match its type (same test as the server's MAGIC table). `head` is the decoded start. */
function looksLike(contentType: string, head: string): boolean {
  if (contentType === 'image/png') return head.slice(0, 8) === '\x89PNG\r\n\x1a\n';
  if (contentType === 'image/jpeg') return head.charCodeAt(0) === 0xff && head.charCodeAt(1) === 0xd8 && head.charCodeAt(2) === 0xff;
  if (contentType === 'image/webp') return head.slice(0, 4) === 'RIFF' && head.slice(8, 12) === 'WEBP';
  if (contentType === 'image/gif') return head.startsWith('GIF87a') || head.startsWith('GIF89a');
  if (contentType === 'application/pdf') return head.startsWith('%PDF-');
  return false;
}

/** Stores an uploaded image or PDF after the server's checks (type, size, first bytes). Returns the file id. */
async function storeLocalFile(body: { name?: unknown; contentType?: unknown; dataBase64?: unknown }, maxBytes: number, isPublic: boolean): Promise<string> {
  const contentType = str(body.contentType, 40).toLowerCase();
  if (!UPLOAD_TYPES.includes(contentType)) return fail(415, 'unsupported_type');
  const data = typeof body.dataBase64 === 'string' ? body.dataBase64 : '';
  if (!data || data.length > Math.ceil(maxBytes / 3) * 4 + 8) return fail(413, 'too_large');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return fail(400, 'invalid_data');
  const size = (data.length / 4) * 3 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
  if (size <= 0 || size > maxBytes) return fail(413, 'too_large');
  let head: string;
  try {
    head = atob(data.slice(0, 16));
  } catch {
    return fail(400, 'invalid_data');
  }
  if (!looksLike(contentType, head)) return fail(415, 'content_mismatch');

  const name = str(body.name, 200).replace(/[\\/\x00-\x1f]/g, '_').slice(0, 120) || 'fichier';
  const id = uid('f_');
  try {
    await files.insert({ id, name, contentType, dataUrl: `data:${contentType};base64,${data}`, public: isPublic, uploadedAt: now() });
  } catch {
    return fail(413, 'Stockage du navigateur plein : fichier trop volumineux pour le mode démo');
  }
  return id;
}

/** POST /sales/upload (staff): an image or PDF of up to 8 MB. Returns the file id. */
export async function localUpload(file: File): Promise<string> {
  const dataBase64 = await readFileBase64(file);
  return storeLocalFile({ name: file.name, contentType: file.type || 'application/octet-stream', dataBase64 }, 8 * MB, false);
}

/** Data URL of a stored file, for <img src> and links (dev mode has no /api/files route). Empty when unknown. */
export function localFileUrl(id: string): string {
  try {
    const rows = JSON.parse(localStorage.getItem(FILES_KEY) ?? '[]') as LocalFile[];
    return rows.find((f) => f.id === id)?.dataUrl ?? '';
  } catch {
    return '';
  }
}

/* ---------- public routes (no sign-in) ---------- */

const FormFieldsSchema = z
  .array(
    z.object({
      id: z.string().regex(/^[a-zA-Z][\w-]{0,39}$/),
      label: z.object({ fr: z.string().max(300), en: z.string().max(300) }),
      type: z.enum(['text', 'textarea', 'number', 'select', 'multiselect', 'file']),
      options: z.array(z.object({ value: z.string().max(60), label: z.object({ fr: z.string().max(300), en: z.string().max(300) }) })).max(50).optional(),
      required: z.boolean().optional(),
      maps: z
        .enum(['customer', 'contact', 'email', 'phone', 'project', 'dueDate', 'quantities', 'type', 'style', 'lengthMm', 'widthMm', 'heightMm', 'material', 'printProcess', 'colorsOutside', 'colorsInside', 'finishes', 'options', 'notes'])
        .optional(),
      help: z.object({ fr: z.string().max(500), en: z.string().max(500) }).optional(),
    }),
  )
  .min(1)
  .max(40);

/** Company name shown to customers: the browser's branding (what the server reads from the branding settings). */
function companyName(): string {
  try {
    const parsed = BrandingSchema.safeParse(JSON.parse(localStorage.getItem(BRANDING_KEY) ?? 'null'));
    return parsed.success ? parsed.data.appName : '';
  } catch {
    return '';
  }
}

/** GET /request-form. */
export async function localPublicForm(): Promise<{ fields: FormField[]; company: string }> {
  const doc = await appSettings.get('sales.form');
  const parsed = FormFieldsSchema.safeParse(doc?.value);
  return { fields: parsed.success ? (parsed.data as FormField[]) : DEFAULT_REQUEST_FORM, company: companyName() };
}

/** POST /upload (public form): an image or PDF of up to 4 MB. */
export async function localPublicUpload(body: Record<string, unknown>): Promise<{ fileId: string }> {
  return { fileId: await storeLocalFile(body, 4 * MB, true) };
}

/** POST /request (public form). Creates the request like the server does, with no owner. */
export async function localPublicRequest(body: Record<string, unknown>): Promise<{ ok: boolean; reference: string }> {
  // Honeypot: a filled hidden field means a robot. It gets the same answer as a success, and nothing is kept.
  if (typeof body.website === 'string' && body.website.trim()) return { ok: true, reference: '' };

  const raw = body.answers;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail(400, 'invalid_answers');
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > 40) return fail(400, 'too_many_answers');
  const answers: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (!/^[\w-]{1,40}$/.test(k)) return fail(400, 'invalid_answers');
    if (typeof v !== 'string' || v.length > 4000) return fail(400, 'answer_too_long');
    answers[k] = v.trim();
  }

  const form = (await localPublicForm()).fields;
  for (const f of form) {
    if (f.required && !answers[f.id]) return fail(400, 'missing_field');
  }
  const email = answers[form.find((f) => f.maps === 'email')?.id ?? 'email'] ?? '';
  if (!validEmail(email)) return fail(400, 'invalid_email');

  const fileIds = Array.isArray(body.fileIds) ? body.fileIds.map(String) : [];
  if (fileIds.length > 5) return fail(400, 'too_many_files');
  for (const id of fileIds) {
    const f = await files.get(id);
    const recent = !!f && Date.parse(f.uploadedAt) > Date.now() - 24 * 3600_000;
    if (!f?.public || !recent) return fail(400, 'invalid_file');
  }

  const answered = form.filter((f) => answers[f.id]);
  const request = await ingest({
    source: 'form',
    fields: answersToRequestFields(answers, form),
    text: answered.map((f) => `${f.label.fr} : ${answers[f.id]}`).join('\n'),
    fileIds,
    formAnswers: Object.fromEntries(answered.map((f) => [f.label.fr, answers[f.id]])),
    ownerId: '',
    createdBy: 'public',
  });
  await logAudit('', 'sales.request.public', request.no);
  return { ok: true, reference: request.no };
}

async function findQuote(token: string): Promise<Quote | undefined> {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return undefined;
  return (await quotes.list()).find((q) => q.token === token);
}

/** What the customer may see of a quote: no ids of other records, no estimate, no costs. */
function publicQuote(q: Quote, company: string) {
  const expired = q.status === 'sent' && Date.parse(q.validUntil) < Date.now();
  return {
    no: q.no,
    customer: q.customer,
    contact: q.contact,
    project: q.project,
    specSummary: q.specSummary,
    lines: q.lines,
    currency: q.currency,
    terms: q.terms,
    notes: q.notes,
    validUntil: q.validUntil,
    status: expired ? 'expired' : q.status,
    sentAt: q.sentAt,
    revision: q.revision,
    response: q.response ? { decision: q.response.decision, at: q.response.at, quantity: q.response.quantity } : undefined,
    company,
  };
}

const PNG_DATA_RE = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;
function validSignature(v: string): boolean {
  if (v.length > 300_000) return false;
  const m = PNG_DATA_RE.exec(v);
  if (!m) return false;
  try {
    return atob(m[1].slice(0, 12)).startsWith('\x89PNG\r\n\x1a\n');
  } catch {
    return false;
  }
}

/** GET /quote/:token. Marks the quote as viewed the first time. */
export async function localPublicQuote(token: string) {
  const quote = await findQuote(token);
  if (!quote) return fail(404, 'not_found');
  if (!quote.viewedAt) await quotes.update(quote.id, { viewedAt: now() });
  return publicQuote(quote, companyName());
}

const locks = new Set<string>();

/** POST /quote/:token/respond: accept (with quantity, typed name and signature), decline or ask for changes. */
export async function localPublicRespond(token: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: Quote['status'] }> {
  const decision = body.decision;
  if (decision !== 'accept' && decision !== 'decline' && decision !== 'changes') return fail(400, 'invalid_decision');
  if (typeof body.comments === 'string' && body.comments.length > 4000) return fail(400, 'comments_too_long');
  if (locks.has(token)) return fail(409, 'busy');
  locks.add(token);
  try {
    const quote = await findQuote(token);
    if (!quote) return fail(404, 'not_found');
    if (quote.status !== 'sent' || Date.parse(quote.validUntil) < Date.now()) return fail(409, 'closed');
    const at = now();
    const comments = str(body.comments, 4000);
    let response: QuoteResponse;
    let note: string;
    if (decision === 'accept') {
      const quantity = Number(body.quantity);
      if (!quote.lines.some((l) => l.quantity === quantity)) return fail(400, 'invalid_quantity');
      const signedName = str(body.signedName, 120);
      if (signedName.length < 2) return fail(400, 'invalid_name');
      const signature = typeof body.signature === 'string' ? body.signature : '';
      if (!validSignature(signature)) return fail(400, 'invalid_signature');
      response = { decision, at, quantity, signedName, signature, comments: comments || undefined };
      note = `Accepté par ${signedName}`;
    } else if (decision === 'decline') {
      const reason = str(body.reason, 500);
      if (reason.length < 3) return fail(400, 'reason_required');
      response = { decision, at, reason, comments: comments || undefined };
      note = reason;
    } else {
      if (comments.length < 3) return fail(400, 'comments_required');
      response = { decision, at, comments };
      note = comments;
    }
    const quoteStatus: Quote['status'] = decision === 'accept' ? 'accepted' : decision === 'decline' ? 'declined' : 'changes';
    await quotes.update(quote.id, { status: quoteStatus, response });
    await logAudit('client', `sales.quote.${decision}`, quote.no);

    const request = await requests.get(quote.requestId);
    if (request) {
      const systemNote: SalesNote = { id: uid('n_'), at, userId: 'client', kind: 'system', text: `${quote.no} : ${note}` };
      const notes = [...request.notes, systemNote];
      if (decision === 'accept') {
        await moveRequest(request, 'accepted', 'client', note, { notes });
      } else if (decision === 'decline') {
        await moveRequest(request, 'declined', 'client', note, { notes });
      } else {
        await moveRequest(
          request,
          'estimating',
          'client',
          comments,
          { notes, revision: request.revision + 1 },
          { status: 'costing', action: 'Modifications demandées par le client', note: comments },
        );
      }
    }
    return { ok: true, status: quoteStatus };
  } finally {
    locks.delete(token);
  }
}
