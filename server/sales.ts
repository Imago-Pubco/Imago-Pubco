/**
 * Sales: customer request -> estimate -> quote -> customer's answer -> work order.
 * Staff routes live inside the signed-in API (registerSalesRoutes). The customer pages (form, quote link) are
 * public and mounted with salesPublicRouter at /api/public.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { FINISHES, OPTIONS, PACKAGING_TYPES, STYLES } from '../src/modules/estimating/catalog.ts';
import { DEFAULT_EST_SETTINGS } from '../src/modules/estimating/defaults.ts';
import { priceBreaks } from '../src/modules/estimating/pricing.ts';
import type { Estimate, EstimateStatus, EstimatingSettings, Material, PackagingSpec, PackagingType } from '../src/modules/estimating/types.ts';
import type { User } from '../src/data/types.ts';
import type { FormField, Quote, QuoteLine, QuoteResponse, RequestAnalysis, RequestSource, SalesNote, SalesRequest, SalesStage, StageEvent, StudioStatus } from '../src/modules/sales/types.ts';
import { DEFAULT_REQUEST_FORM, answersToRequestFields, parseQuantities } from '../src/modules/sales/formFields.ts';
import { buildEstimateDraft } from '../src/modules/sales/autoEstimate.ts';
import type { AuthInfo } from './auth.ts';
import { getBranding } from './branding.ts';
import { config } from './config.ts';
import * as db from './db.ts';
import { broadcast } from './events.ts';
import { renderLayout, sendMail, type Rendered } from './mail.ts';
import { HttpError, msFetch } from './ms.ts';
import { AiQuotaError } from './aiUsage.ts';
import { analyzeRequest, type AiAttachment, type AiRequestReading } from './salesAi.ts';

/* ---------- shared helpers ---------- */

const MB = 1024 * 1024;
const uid = (prefix: string) => prefix + randomBytes(8).toString('hex');
const now = () => new Date().toISOString();
const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : '');
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const validEmail = (v: string) => v.length <= 254 && EMAIL_RE.test(v);
const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const money = (n: number) => n.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
const TYPES = PACKAGING_TYPES.map((t) => t.key);
const PRINT = ['offset', 'flexo', 'digital', 'none'];
const STUDIO: StudioStatus[] = ['none', 'requested', 'in_progress', 'done'];
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_AI_IMAGE = 5 * MB;
const MAX_AI_PDF = 8 * MB;

/** Lets a null value clear a key in the shallow JSON merge (undefined would be dropped). */
const CLEAR = null as unknown as undefined;

/** Allocation of numbers and creation of documents run one at a time, so two requests never get the same number. */
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

/** "26-0004" for the next document of a collection (the NNNN part of REQ-, EST-, Q-, WO- numbers). */
async function nextSeq(collection: string): Promise<string> {
  const docs = await db.listDocs<{ no?: string }>(collection);
  const max = docs.reduce((m, d) => Math.max(m, parseInt(String(d.no ?? '').split('-')[2] ?? '', 10) || 0), 0);
  return `${String(new Date().getFullYear()).slice(2)}-${String(max + 1).padStart(4, '0')}`;
}

async function audit(userId: string, action: string, detail = '', ip = '') {
  await db.insertDoc('audit', { id: uid('a_'), at: now(), userId, action, detail, ip });
  broadcast('audit');
}

/** Per-IP rate limit: at most `max` hits in the last hour. */
const hits = new Map<string, number[]>();
function overLimit(key: string, max: number): boolean {
  const t = Date.now();
  const list = (hits.get(key) ?? []).filter((x) => t - x < 3600_000);
  const full = list.length >= max;
  if (!full) list.push(t);
  hits.set(key, list);
  return full;
}
setInterval(() => {
  const t = Date.now();
  for (const [k, list] of hits) {
    const kept = list.filter((x) => t - x < 3600_000);
    if (kept.length) hits.set(k, kept);
    else hits.delete(k);
  }
  for (const [id, at] of publicUploads) if (t - at > 24 * 3600_000) publicUploads.delete(id);
}, 600_000).unref();

/** Files sent through the public form: id -> time of upload. Only these may be attached to a public request. */
const publicUploads = new Map<string, number>();

async function estSettings(): Promise<EstimatingSettings> {
  const s = await db.getDoc<EstimatingSettings>('est.settings', 'settings');
  return { ...DEFAULT_EST_SETTINGS, ...(s ?? {}) };
}

const getRequest = (id: string) => db.getDoc<SalesRequest>('sales.requests', id);

/* ---------- validation of incoming fields ---------- */

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  'image/png': (b) => b.subarray(0, 8).equals(PNG_SIG),
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  'image/gif': (b) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1')),
  'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
};

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

const numOrUndef = (x: unknown) => (x === null || x === undefined || x === '' ? NaN : Number(x));

/** Keeps only valid spec values. From the AI, 0 means "not stated" for colours too. */
function cleanSpec(v: unknown, materials: Material[], fromAi: boolean): Partial<PackagingSpec> {
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
  if (materialId && materials.some((m) => m.id === materialId)) out.materialId = materialId;
  if (PRINT.includes(p.printProcess as string)) out.printProcess = p.printProcess as PackagingSpec['printProcess'];
  const count = (x: unknown) => {
    const n = Math.round(numOrUndef(x));
    return Number.isFinite(n) && n >= 0 && n <= 12 ? n : undefined;
  };
  const co = count(p.colorsOutside);
  const ci = count(p.colorsInside);
  if (co !== undefined && !(fromAi && co === 0)) out.colorsOutside = co;
  if (ci !== undefined && !(fromAi && ci === 0)) out.colorsInside = ci;
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

interface MergedFields {
  customer: string;
  contact: string;
  email: string;
  phone: string;
  project: string;
  dueDate: string;
  quantities: number[];
  spec: Partial<PackagingSpec>;
  description: string;
}

/** Values typed or answered explicitly win; what is empty is filled from the AI reading. */
function mergeFields(explicit: RequestFieldsInput, reading: AiRequestReading | undefined, materials: Material[], fallbackEmail = ''): MergedFields {
  const pick = (a: unknown, b: unknown) => str(a, 300) || str(b, 300);
  const rawEmail = pick(explicit.email, reading?.email);
  const email = validEmail(rawEmail) ? rawEmail : validEmail(fallbackEmail) ? fallbackEmail : '';
  const explicitQuantities = cleanQuantities(explicit.quantities);
  return {
    customer: pick(explicit.customer, reading?.customer),
    contact: pick(explicit.contact, reading?.contact),
    email,
    phone: pick(explicit.phone, reading?.phone),
    project: pick(explicit.project, reading?.project),
    dueDate: isoDate(explicit.dueDate) || isoDate(reading?.dueDate),
    quantities: explicitQuantities.length ? explicitQuantities : cleanQuantities(reading?.quantities),
    spec: { ...cleanSpec(reading?.spec, materials, true), ...cleanSpec(explicit.spec, materials, false) },
    description: str(explicit.description, 20000),
  };
}

/** Reads the fields sent by staff (POST /sales/requests). */
async function readFieldsInput(v: unknown): Promise<RequestFieldsInput> {
  const p = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const materials = await db.listDocs<Material>('est.materials');
  return {
    customer: str(p.customer, 300),
    contact: str(p.contact, 300),
    email: str(p.email, 254),
    phone: str(p.phone, 60),
    project: str(p.project, 300),
    dueDate: isoDate(p.dueDate),
    quantities: cleanQuantities(p.quantities),
    spec: cleanSpec(p.spec, materials, false),
    description: str(p.description, 20000),
  };
}

/** Only ids of files that exist are kept. */
async function existingFileIds(v: unknown): Promise<string[]> {
  if (!Array.isArray(v)) return [];
  const ids = [...new Set(v.map(String))].filter((id) => /^[A-Za-z0-9_-]{4,80}$/.test(id)).slice(0, 40);
  if (!ids.length) return [];
  const r = await db.pool.query('select id from files where id = any($1::text[])', [ids]);
  const ok = new Set(r.rows.map((x) => x.id as string));
  return ids.filter((id) => ok.has(id));
}

/** Images and PDFs of a request, base64-encoded for the AI (other files are skipped). */
async function readAttachments(fileIds: string[]): Promise<{ images: AiAttachment[]; pdfs: AiAttachment[] }> {
  const images: AiAttachment[] = [];
  const pdfs: AiAttachment[] = [];
  for (const id of fileIds.slice(0, 8)) {
    const f = await db.getFile(id);
    if (!f) continue;
    if (f.contentType === 'application/pdf') {
      if (f.data.length <= MAX_AI_PDF) pdfs.push({ mediaType: 'application/pdf', base64: f.data.toString('base64') });
    } else if (IMAGE_TYPES.includes(f.contentType) && f.data.length <= MAX_AI_IMAGE) {
      images.push({ mediaType: f.contentType as AiAttachment['mediaType'], base64: f.data.toString('base64') });
    }
  }
  return { images, pdfs };
}

function analysisFrom(reading: AiRequestReading, fallback: RequestAnalysis): RequestAnalysis {
  return {
    status: 'done',
    summary: str(reading.summary, 2000),
    assumptions: reading.assumptions.map((a) => str(a, 300)).filter(Boolean).slice(0, 30),
    questions: reading.questions.map((q) => str(q, 300)).filter(Boolean).slice(0, 30),
    confidence: reading.confidence,
    error: fallback.error,
  };
}

/** Stores an uploaded image or PDF after checking its type and its first bytes. */
async function storeUpload(body: unknown, maxBytes: number): Promise<{ id: string } | { status: number; error: string }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const contentType = str(b.contentType, 40).toLowerCase();
  const magic = MAGIC[contentType];
  if (!magic) return { status: 415, error: 'unsupported_type' };
  const data = typeof b.dataBase64 === 'string' ? b.dataBase64 : '';
  if (!data || data.length > Math.ceil(maxBytes / 3) * 4 + 8) return { status: 413, error: 'too_large' };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return { status: 400, error: 'invalid_data' };
  const buf = Buffer.from(data, 'base64');
  if (buf.length === 0 || buf.length > maxBytes) return { status: 413, error: 'too_large' };
  if (!magic(buf)) return { status: 415, error: 'content_mismatch' };
  const name = str(b.name, 200).replace(/[\\/\x00-\x1f]/g, '_').slice(0, 120) || 'fichier';
  const id = 'f_' + randomBytes(12).toString('hex');
  await db.saveFile(id, name, contentType, buf);
  return { id };
}

/* ---------- ingestion: request -> AI reading -> request document -> estimate draft ---------- */

export interface IngestInput {
  source: RequestSource;
  fields: RequestFieldsInput;
  text: string;
  fileIds: string[];
  /** Public form: answers by question label (French). */
  formAnswers?: Record<string, string>;
  emailRef?: SalesRequest['emailRef'];
  ownerId: string;
  createdBy: string;
}

/**
 * Creates a sales request and its estimate draft. Returns null when an e-mail is not a request.
 * The AI reading never blocks the request: if it fails, the request is kept with analysis.status 'failed'.
 */
export async function ingestRequest(input: IngestInput): Promise<SalesRequest | null> {
  const materials = await db.listDocs<Material>('est.materials');
  const text = str(input.text, 20000);
  const fileIds = input.fileIds.slice(0, 40);

  let reading: AiRequestReading | undefined;
  let quotaError = '';
  let analysis: RequestAnalysis = { status: 'none', summary: '', assumptions: [], questions: [], confidence: 'low' };
  const files = config.ai.enabled && (text || fileIds.length) ? await readAttachments(fileIds) : { images: [], pdfs: [] };
  const hasInput = !!text || files.images.length > 0 || files.pdfs.length > 0;
  if (hasInput && config.ai.enabled) {
    try {
      reading = await analyzeRequest({ text, images: files.images, pdfs: files.pdfs, materials });
    } catch (e) {
      console.error('[sales] AI reading failed:', e instanceof Error ? e.message : e);
      quotaError = e instanceof AiQuotaError ? e.message : '';
    }
    analysis = reading ? analysisFrom(reading, analysis) : { ...analysis, status: 'failed', error: quotaError || 'Lecture automatique indisponible' };
  }
  if (input.source === 'email' && reading && !reading.isRequest) return null;

  const merged = mergeFields(input.fields, reading, materials, input.emailRef?.from ?? '');

  return serial(async () => {
    const at = now();
    const id = uid('r_');
    const no = `REQ-${await nextSeq('sales.requests')}`;
    const request: SalesRequest = {
      id,
      no,
      source: input.source,
      stage: 'received',
      revision: 1,
      history: [{ at, by: input.source === 'form' ? 'client' : input.createdBy || 'system', from: null, to: 'received' }],
      customer: merged.customer,
      contact: merged.contact,
      email: merged.email,
      phone: merged.phone,
      project: merged.project,
      dueDate: merged.dueDate,
      ownerId: input.ownerId,
      description: merged.description || text,
      formAnswers: input.formAnswers,
      spec: merged.spec,
      quantities: merged.quantities,
      fileIds,
      emailRef: input.emailRef,
      analysis,
      studio: { status: 'none', brief: '', fileIds: [] },
      notes: [],
      createdAt: at,
      updatedAt: at,
      createdBy: input.createdBy || 'system',
    };
    await db.insertDoc('sales.requests', request);
    broadcast('sales.requests');

    try {
      const settings = await estSettings();
      const est = buildEstimateDraft({
        request,
        materials,
        settings,
        no: `EST-${await nextSeq('est.estimates')}`,
        ownerId: input.ownerId,
        now: at,
        id: uid('e_'),
      });
      await db.insertDoc('est.estimates', est);
      const to: SalesStage = est.status === 'review' ? 'review' : 'estimating';
      const ev: StageEvent = { at, by: 'system', from: 'received', to };
      const patch: Partial<SalesRequest> = { stage: to, estimateId: est.id, history: [...request.history, ev], updatedAt: at };
      await db.updateDoc<SalesRequest>('sales.requests', id, patch);
      broadcast('est.estimates');
      broadcast('sales.requests');
      return { ...request, ...patch } as SalesRequest;
    } catch (e) {
      console.error('[sales] estimate draft failed for', no, e);
      return request;
    }
  });
}

/* ---------- stage moves ---------- */

interface MoveRule {
  perm: string;
  note: boolean;
  estimate?: { status: EstimateStatus; action: string };
}

/** Who may move a request from one stage to another, and what happens to its estimate. */
function moveRule(from: SalesStage, to: SalesStage): MoveRule | undefined {
  if (from === to) return undefined;
  if (to === 'declined') return { perm: 'sales.edit', note: true };
  if (from === 'declined') return to === 'estimating' ? { perm: 'sales.edit', note: false } : undefined;
  if ((from === 'received' || from === 'estimating') && to === 'review') {
    return { perm: 'estimating.edit', note: false, estimate: { status: 'review', action: 'Estimation soumise à la révision' } };
  }
  if (from === 'review' && to === 'quote_ready') {
    return { perm: 'estimating.approve', note: false, estimate: { status: 'approved', action: 'Estimation approuvée' } };
  }
  if (from === 'review' && to === 'estimating') {
    return { perm: 'estimating.approve', note: true, estimate: { status: 'costing', action: 'Renvoyée en estimation' } };
  }
  if (from === 'with_client' && (to === 'accepted' || to === 'estimating')) return { perm: 'sales.edit', note: true };
  if (from === 'accepted' && to === 'production') return { perm: 'sales.send', note: false };
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
  const updated = (await db.updateDoc<SalesRequest>('sales.requests', request.id, patch)) ?? ({ ...request, ...patch } as SalesRequest);
  broadcast('sales.requests');
  if (request.estimateId && est && (est.status || est.action || est.extra)) {
    const e = await db.getDoc<Estimate>('est.estimates', request.estimateId);
    if (e) {
      const ePatch: Partial<Estimate> = {
        ...(est.extra ?? {}),
        ...(est.status ? { status: est.status } : {}),
        updatedAt: at,
        history: [
          ...e.history,
          { at, userId: by, action: est.action ?? `Statut : ${est.status}`, ...(est.note ? { note: est.note } : {}) },
        ],
      };
      await db.updateDoc<Estimate>('est.estimates', e.id, ePatch);
      broadcast('est.estimates');
    }
  }
  return updated;
}

async function createWorkOrder(request: SalesRequest, by: string) {
  const quote = request.quoteId ? await db.getDoc<Quote>('sales.quotes', request.quoteId) : undefined;
  const estimate = request.estimateId ? await db.getDoc<Estimate>('est.estimates', request.estimateId) : undefined;
  const quantity = quote?.response?.quantity ?? quote?.lines[0]?.quantity ?? estimate?.quantities[0] ?? 0;
  const line = quote?.lines.find((l) => l.quantity === quantity) ?? quote?.lines[0];
  return serial(async () => {
    const at = now();
    const wo = {
      id: uid('wo_'),
      no: `WO-${await nextSeq('wo.orders')}`,
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
    await db.insertDoc('wo.orders', wo);
    broadcast('wo.orders');
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

function quoteMail(q: Quote, url: string, message: string): Rendered {
  const date = (iso: string) => new Date(iso).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const cell = 'style="padding:6px 10px;border-bottom:1px solid #e5e5e5;font-size:14px;"';
  const table = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 16px 0;">
<tr><th align="left" style="padding:6px 10px;font-size:13px;">Quantité · Quantity</th><th align="right" style="padding:6px 10px;font-size:13px;">Prix unitaire · Unit price</th><th align="right" style="padding:6px 10px;font-size:13px;">Total</th></tr>
${q.lines.map((l) => `<tr><td ${cell}>${l.quantity.toLocaleString('fr-CA')}</td><td align="right" ${cell}>${money(l.unitPrice)}</td><td align="right" ${cell}>${money(l.total)}</td></tr>`).join('')}
</table>`;
  const msg = message ? `<p>${esc(message).replace(/\n/g, '<br>')}</p>` : '';
  const fr = `<p>Bonjour ${esc(q.contact || q.customer)},</p>
<p>Veuillez trouver la soumission <b>${esc(q.no)}</b>${q.project ? ` pour le projet <b>${esc(q.project)}</b>` : ''}.</p>${msg}
<p>${esc(q.specSummary)}</p>${table}
<p>Valide jusqu’au <b>${esc(date(q.validUntil))}</b>. Vous pouvez la consulter, la signer ou demander des modifications en ligne.</p>`;
  const en = `<p>Hello ${esc(q.contact || q.customer)},</p>
<p>Please find quote <b>${esc(q.no)}</b>${q.project ? ` for the project <b>${esc(q.project)}</b>` : ''}.</p>
<p>${esc(q.specSummary)}</p>${table}
<p>Valid until <b>${esc(new Date(q.validUntil).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }))}</b>. You can review it, sign it or ask for changes online.</p>`;
  const lines = q.lines.map((l) => `${l.quantity} : ${money(l.unitPrice)} / u, ${money(l.total)}`).join('\n');
  return {
    subject: `Soumission ${q.no} · Pubco`,
    html: renderLayout({
      heading: `Soumission ${q.no}`,
      bodyHtml: `${fr}<hr style="border:0;border-top:1px solid #dddddd;margin:18px 0;">${en}`,
      buttonLabel: 'Consulter la soumission · View the quote',
      buttonUrl: url,
    }),
    text: `Soumission ${q.no}\n\n${q.specSummary}\n${lines}\n\n${message}\n\n${url}`,
  };
}

/* ---------- staff routes ---------- */

export interface SalesHelpers {
  wrap: (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
  me: (req: Request) => AuthInfo;
  forbid: (res: Response) => unknown;
  baseUrl: (req: Request) => string;
}

export function registerSalesRoutes(r: express.Router, h: SalesHelpers) {
  const { wrap, me, forbid } = h;

  r.post('/sales/requests', wrap(async (req, res) => {
    const a = me(req);
    if (!a.can('sales.edit')) return forbid(res);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const source: RequestSource = body.source === 'email' ? 'email' : 'manual';
    const request = await ingestRequest({
      source,
      fields: await readFieldsInput(body.fields),
      text: str(body.text, 20000),
      fileIds: await existingFileIds(body.fileIds),
      ownerId: a.user.id,
      createdBy: a.user.id,
    });
    if (!request) return res.status(422).json({ error: 'not_a_request' });
    await audit(a.user.id, 'sales.request.create', `${request.no} (${source})`, req.ip ?? '');
    res.status(201).json(request);
  }));

  r.post('/sales/requests/:id/reanalyze', wrap(async (req, res) => {
    const a = me(req);
    if (!a.can('sales.edit')) return forbid(res);
    const request = await getRequest(String(req.params.id));
    if (!request) return res.status(404).json({ error: 'not_found' });
    if (!config.ai.enabled) return res.status(503).json({ error: 'ai_off' });
    const materials = await db.listDocs<Material>('est.materials');
    const files = await readAttachments(request.fileIds);
    let reading: AiRequestReading | undefined;
    try {
      reading = await analyzeRequest({ text: request.description, images: files.images, pdfs: files.pdfs, materials });
    } catch (e) {
      if (e instanceof AiQuotaError) return res.status(429).json({ error: e.message });
      console.error('[sales] reanalysis failed:', e instanceof Error ? e.message : e);
    }
    if (!reading) return res.status(502).json({ error: 'ai_failed' });
    const analysis = analysisFrom(reading, request.analysis);
    const filled = mergeFields(
      {
        customer: request.customer,
        contact: request.contact,
        email: request.email,
        phone: request.phone,
        project: request.project,
        dueDate: request.dueDate,
        quantities: request.quantities,
        spec: request.spec,
        description: request.description,
      },
      reading,
      materials,
    );
    const at = now();
    const patch: Partial<SalesRequest> = { analysis, ...filled, updatedAt: at };
    await db.updateDoc<SalesRequest>('sales.requests', request.id, patch);
    broadcast('sales.requests');
    await audit(a.user.id, 'sales.request.reanalyze', request.no, req.ip ?? '');
    res.json({ analysis });
  }));

  r.post('/sales/requests/:id/transition', wrap(async (req, res) => {
    const a = me(req);
    const request = await getRequest(String(req.params.id));
    if (!request) return res.status(404).json({ error: 'not_found' });
    const to = String(req.body?.to ?? '') as SalesStage;
    const note = str(req.body?.note, 2000);
    const rule = moveRule(request.stage, to);
    if (!rule) return res.status(400).json({ error: 'invalid_move', from: request.stage, to });
    if (!a.can(rule.perm)) return forbid(res);
    if (rule.note && !note) return res.status(400).json({ error: 'note_required' });
    if (to === 'production' && request.workOrderId) return res.status(409).json({ error: 'already_in_production' });

    let workOrderId: string | undefined;
    if (to === 'production') workOrderId = (await createWorkOrder(request, a.user.id)).id;
    const updated = await moveRequest(
      request,
      to,
      a.user.id,
      note || undefined,
      workOrderId ? { workOrderId } : {},
      rule.estimate ? { status: rule.estimate.status, action: rule.estimate.action, note: note || undefined } : undefined,
    );
    await audit(a.user.id, 'sales.request.move', `${request.no}: ${request.stage} -> ${to}${note ? ' · ' + note : ''}`, req.ip ?? '');
    res.json(updated);
  }));

  r.post('/sales/requests/:id/studio', wrap(async (req, res) => {
    const a = me(req);
    if (!a.canAny('sales.edit', 'sales.studio')) return forbid(res);
    const request = await getRequest(String(req.params.id));
    if (!request) return res.status(404).json({ error: 'not_found' });
    const status = req.body?.status as StudioStatus;
    if (!STUDIO.includes(status)) return res.status(400).json({ error: 'invalid_status' });
    const brief = str(req.body?.brief, 4000);
    const fileIds = await existingFileIds(req.body?.fileIds);
    const at = now();
    const studio = { status, brief, fileIds, updatedAt: at };
    const clearBlocker = request.blocker?.kind === 'studio';

    if (status === 'done' && request.stage === 'estimating') {
      const updated = await moveRequest(
        request,
        'review',
        a.user.id,
        'Studio terminé',
        { studio, ...(clearBlocker ? { blocker: CLEAR } : {}) },
        {
          status: 'review',
          action: 'Croquis et découpes du studio reçus',
          extra: { dielineFileIds: fileIds, studioNotes: brief },
        },
      );
      await audit(a.user.id, 'sales.studio.done', request.no, req.ip ?? '');
      return res.json(updated);
    }
    if (status === 'done' && request.estimateId) {
      const e = await db.getDoc<Estimate>('est.estimates', request.estimateId);
      if (e) {
        await db.updateDoc<Estimate>('est.estimates', e.id, { dielineFileIds: fileIds, studioNotes: brief, updatedAt: at });
        broadcast('est.estimates');
      }
    }
    const updated = await db.updateDoc<SalesRequest>('sales.requests', request.id, {
      studio,
      updatedAt: at,
      ...(clearBlocker ? { blocker: CLEAR } : {}),
    });
    broadcast('sales.requests');
    res.json(updated);
  }));

  r.post('/sales/requests/:id/send-quote', wrap(async (req, res) => {
    const a = me(req);
    if (!a.can('sales.send')) return forbid(res);
    const request = await getRequest(String(req.params.id));
    if (!request) return res.status(404).json({ error: 'not_found' });
    if (request.stage !== 'quote_ready') return res.status(409).json({ error: 'not_quote_ready' });
    const estimate = request.estimateId ? await db.getDoc<Estimate>('est.estimates', request.estimateId) : undefined;
    if (!estimate || estimate.status !== 'approved') return res.status(409).json({ error: 'estimate_not_approved' });

    const validDays = Math.min(180, Math.max(1, Math.round(Number(req.body?.validDays ?? 30)) || 30));
    const terms = str(req.body?.terms, 4000);
    const notes = str(req.body?.notes, 4000);
    const message = str(req.body?.message, 4000);
    const materials = await db.listDocs<Material>('est.materials');
    const material = materials.find((m) => m.id === estimate.spec.materialId);
    const settings = await estSettings();
    const prices = priceBreaks(estimate.spec, estimate.quantities, estimate.marginPct, material, settings);
    // The customer sees prices only: never costs or margins.
    const lines: QuoteLine[] = prices.map((p) => ({ quantity: p.quantity, unitPrice: round(p.unitPrice, 4), total: round(p.price, 2) }));
    if (!lines.length) return res.status(409).json({ error: 'no_quantities' });

    const at = now();
    const token = randomBytes(32).toString('base64url');
    const quote = await serial(async () => {
      const seq = await nextSeq('sales.quotes');
      const previous = (await db.listDocs<Quote>('sales.quotes')).filter(
        (q) => q.requestId === request.id && q.status !== 'accepted' && q.status !== 'superseded',
      );
      for (const q of previous) await db.updateDoc<Quote>('sales.quotes', q.id, { status: 'superseded' });
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
        sentBy: a.user.id,
      };
      await db.insertDoc('sales.quotes', created);
      broadcast('sales.quotes');
      return created;
    });

    const url = `${h.baseUrl(req)}/q/${token}`;
    let emailed = false;
    if (config.smtp.enabled && quote.email) {
      try {
        await sendMail(quote.email, quoteMail(quote, url, message));
        emailed = true;
      } catch (e) {
        console.error('[sales] quote e-mail failed:', e instanceof Error ? e.message : e);
      }
    }
    await moveRequest(
      request,
      'with_client',
      a.user.id,
      `Soumission ${quote.no} ${emailed ? 'envoyée à ' + quote.email : 'prête (courriel non envoyé)'}`,
      { quoteId: quote.id },
      { status: 'sent', action: `Soumission ${quote.no} envoyée` },
    );
    await audit(a.user.id, 'sales.quote.send', `${quote.no} -> ${quote.email || 'sans courriel'}`, req.ip ?? '');
    res.json({ id: quote.id, no: quote.no, url, emailed });
  }));

  /** Estimate editor: reads a photo / drawing and suggests packaging spec values (nothing is saved here). */
  r.post('/estimating/analyze-image', wrap(async (req, res) => {
    if (!me(req).can('estimating.edit')) return forbid(res);
    if (!config.ai.enabled) return res.status(503).json({ error: 'ai_off' });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const estimate = await db.getDoc<Estimate>('est.estimates', String(body.estimateId ?? ''));
    if (!estimate) return res.status(404).json({ error: 'not_found' });
    const files = await readAttachments([String(body.fileId ?? '')]);
    if (!files.images.length && !files.pdfs.length) return res.status(400).json({ error: 'unreadable_file' });
    const materials = await db.listDocs<Material>('est.materials');
    let reading: AiRequestReading | undefined;
    try {
      reading = await analyzeRequest({ text: estimate.spec.notes || estimate.project || '', images: files.images, pdfs: files.pdfs, materials, feature: 'sales.image' });
    } catch (e) {
      if (e instanceof AiQuotaError) return res.status(429).json({ error: e.message });
      console.error('[sales] image analysis failed:', e instanceof Error ? e.message : e);
    }
    if (!reading) return res.status(502).json({ error: 'ai_failed' });
    const s = reading.spec;
    const suggested: Partial<PackagingSpec> = {};
    if (s.type) suggested.type = s.type;
    if (s.style) suggested.style = s.style;
    if (s.lengthMm > 0) suggested.lengthMm = s.lengthMm;
    if (s.widthMm > 0) suggested.widthMm = s.widthMm;
    if (s.heightMm > 0) suggested.heightMm = s.heightMm;
    if (s.materialId && materials.some((m) => m.id === s.materialId)) suggested.materialId = s.materialId;
    if (s.printProcess) suggested.printProcess = s.printProcess;
    if (s.colorsOutside > 0) suggested.colorsOutside = s.colorsOutside;
    if (s.colorsInside > 0) suggested.colorsInside = s.colorsInside;
    if (s.finishes.length) suggested.finishes = s.finishes;
    if (s.options.length) suggested.options = s.options;
    res.json({ suggested, summary: str(reading.summary, 2000), assumptions: reading.assumptions.map((x) => str(x, 300)).filter(Boolean).slice(0, 30) });
  }));

  r.post('/sales/upload', wrap(async (req, res) => {
    if (!me(req).canAny('sales.edit', 'sales.studio')) return forbid(res);
    const out = await storeUpload(req.body, 8 * MB);
    if ('error' in out) return res.status(out.status).json({ error: out.error });
    res.json({ fileId: out.id });
  }));

  r.post('/sales/mailbox/sync', wrap(async (req, res) => {
    if (!me(req).can('sales.edit')) return forbid(res);
    const added = await syncSalesMailbox();
    res.json({ added });
  }));

  r.get('/sales/mailbox/status', wrap(async (req, res) => {
    if (!me(req).can('sales.edit')) return forbid(res);
    res.json({ enabled: config.graph.salesEnabled, mailbox: config.graph.salesEnabled ? config.graph.salesMailbox : '' });
  }));
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

/** The form stored in app.settings 'sales.form' (value = list of fields), when it is valid; otherwise the default. */
async function loadForm(): Promise<FormField[]> {
  const doc = await db.getDoc<{ value?: unknown }>('app.settings', 'sales.form');
  const parsed = FormFieldsSchema.safeParse(doc?.value);
  return parsed.success ? (parsed.data as FormField[]) : DEFAULT_REQUEST_FORM;
}

const wrapPublic =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Looks the quote up by its token (indexed JSON field on the docs table). */
async function findQuote(token: string): Promise<Quote | undefined> {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return undefined;
  const r = await db.pool.query("select data from docs where collection = $1 and data->>'token' = $2 limit 1", ['sales.quotes', token]);
  const q = r.rows[0]?.data as Quote | undefined;
  return q && safeEqual(q.token, token) ? q : undefined;
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

const PNG_SIG_RE = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;
function validSignature(v: string): boolean {
  if (v.length > 300_000) return false;
  const m = PNG_SIG_RE.exec(v);
  return !!m && Buffer.from(m[1], 'base64').subarray(0, 8).equals(PNG_SIG);
}

async function notifyOwner(ownerId: string, subject: string, heading: string, bodyHtml: string, text: string) {
  if (!config.smtp.enabled || !ownerId) return;
  try {
    const owner = await db.getDoc<User>('users', ownerId);
    if (!owner?.email) return;
    await sendMail(owner.email, { subject, html: renderLayout({ heading, bodyHtml }), text });
  } catch (e) {
    console.error('[sales] owner notification failed:', e instanceof Error ? e.message : e);
  }
}

const locks = new Set<string>();

export function salesPublicRouter(): express.Router {
  const r = express.Router();
  r.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    next();
  });
  r.use(express.json({ limit: '6mb' }));

  r.get('/request-form', wrapPublic(async (_req, res) => {
    const fields = await loadForm();
    const company = await getBranding().then((b) => b.appName).catch(() => '');
    res.json({ fields, company });
  }));

  r.post('/upload', wrapPublic(async (req, res) => {
    if (overLimit(`up|${req.ip}`, 10)) return res.status(429).json({ error: 'too_many_requests' });
    const out = await storeUpload(req.body, 4 * MB);
    if ('error' in out) return res.status(out.status).json({ error: out.error });
    publicUploads.set(out.id, Date.now());
    res.json({ fileId: out.id });
  }));

  r.post('/request', wrapPublic(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    // Honeypot: a filled hidden field means a robot. It gets the same answer as a success, and nothing is kept.
    if (typeof body.website === 'string' && body.website.trim()) return res.json({ ok: true, reference: '' });
    if (overLimit(`req|${req.ip}`, 5)) return res.status(429).json({ error: 'too_many_requests' });

    const raw = body.answers;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return res.status(400).json({ error: 'invalid_answers' });
    const entries = Object.entries(raw as Record<string, unknown>);
    if (entries.length > 40) return res.status(400).json({ error: 'too_many_answers' });
    const answers: Record<string, string> = {};
    for (const [k, v] of entries) {
      if (!/^[\w-]{1,40}$/.test(k)) return res.status(400).json({ error: 'invalid_answers' });
      if (typeof v !== 'string' || v.length > 4000) return res.status(400).json({ error: 'answer_too_long' });
      answers[k] = v.trim();
    }

    const form = await loadForm();
    for (const f of form) {
      if (f.required && !answers[f.id]) return res.status(400).json({ error: 'missing_field', field: f.id });
    }
    const email = answers[form.find((f) => f.maps === 'email')?.id ?? 'email'] ?? '';
    if (!validEmail(email)) return res.status(400).json({ error: 'invalid_email', field: 'email' });

    const fileIds = Array.isArray(body.fileIds) ? body.fileIds.map(String) : [];
    if (fileIds.length > 5) return res.status(400).json({ error: 'too_many_files' });
    const t = Date.now();
    for (const id of fileIds) {
      const at = publicUploads.get(id);
      if (!at || t - at > 24 * 3600_000) return res.status(400).json({ error: 'invalid_file', fileId: id });
    }

    const answered = form.filter((f) => answers[f.id]);
    const fields = answersToRequestFields(answers, form);
    const request = await ingestRequest({
      source: 'form',
      fields,
      text: answered.map((f) => `${f.label.fr} : ${answers[f.id]}`).join('\n'),
      fileIds,
      formAnswers: Object.fromEntries(answered.map((f) => [f.label.fr, answers[f.id]])),
      ownerId: '',
      createdBy: 'public',
    });
    await audit('', 'sales.request.public', request?.no ?? '', req.ip ?? '');
    res.json({ ok: true, reference: request?.no ?? '' });
  }));

  r.get('/quote/:token', wrapPublic(async (req, res) => {
    if (overLimit(`quote|${req.ip}`, 120)) return res.status(429).json({ error: 'too_many_requests' });
    const quote = await findQuote(String(req.params.token));
    if (!quote) return res.status(404).json({ error: 'not_found' });
    if (!quote.viewedAt) {
      await db.updateDoc<Quote>('sales.quotes', quote.id, { viewedAt: now() });
      broadcast('sales.quotes');
    }
    const company = await getBranding().then((b) => b.appName).catch(() => '');
    res.json(publicQuote(quote, company));
  }));

  r.post('/quote/:token/respond', wrapPublic(async (req, res) => {
    const token = String(req.params.token);
    const ip = req.ip ?? '';
    if (overLimit(`resp|${ip}`, 30)) return res.status(429).json({ error: 'too_many_requests' });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const decision = body.decision;
    if (decision !== 'accept' && decision !== 'decline' && decision !== 'changes') return res.status(400).json({ error: 'invalid_decision' });
    if (typeof body.comments === 'string' && body.comments.length > 4000) return res.status(400).json({ error: 'comments_too_long' });
    if (locks.has(token)) return res.status(409).json({ error: 'busy' });
    locks.add(token);
    try {
      const quote = await findQuote(token);
      if (!quote) return res.status(404).json({ error: 'not_found' });
      if (quote.status !== 'sent' || Date.parse(quote.validUntil) < Date.now()) return res.status(409).json({ error: 'closed' });
      const at = now();
      const comments = str(body.comments, 4000);
      let response: QuoteResponse;
      let note: string;
      if (decision === 'accept') {
        const quantity = Number(body.quantity);
        if (!quote.lines.some((l) => l.quantity === quantity)) return res.status(400).json({ error: 'invalid_quantity' });
        const signedName = str(body.signedName, 120);
        if (signedName.length < 2) return res.status(400).json({ error: 'invalid_name' });
        const signature = typeof body.signature === 'string' ? body.signature : '';
        if (!validSignature(signature)) return res.status(400).json({ error: 'invalid_signature' });
        response = { decision, at, quantity, signedName, signature, comments: comments || undefined, ip };
        note = `Accepté par ${signedName}`;
      } else if (decision === 'decline') {
        const reason = str(body.reason, 500);
        if (reason.length < 3) return res.status(400).json({ error: 'reason_required' });
        response = { decision, at, reason, comments: comments || undefined, ip };
        note = reason;
      } else {
        if (comments.length < 3) return res.status(400).json({ error: 'comments_required' });
        response = { decision, at, comments, ip };
        note = comments;
      }
      const quoteStatus: Quote['status'] = decision === 'accept' ? 'accepted' : decision === 'decline' ? 'declined' : 'changes';
      await db.updateDoc<Quote>('sales.quotes', quote.id, { status: quoteStatus, response });
      broadcast('sales.quotes');
      await audit('client', `sales.quote.${decision}`, `${quote.no}`, ip);

      const request = await getRequest(quote.requestId);
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
        const heading = decision === 'accept' ? 'Soumission acceptée' : decision === 'decline' ? 'Soumission refusée' : 'Modifications demandées';
        await notifyOwner(
          request.ownerId,
          `${heading} · ${quote.no}`,
          heading,
          `<p>${esc(request.no)} — ${esc(quote.customer)}${quote.project ? ' · ' + esc(quote.project) : ''}</p><p>${esc(note)}</p>`,
          `${heading} : ${request.no} — ${note}`,
        );
      }
      res.json({ ok: true, status: quoteStatus });
    } finally {
      locks.delete(token);
    }
  }));

  return r;
}

/* ---------- mailbox intake (Microsoft Graph) ---------- */

const SCOPE = 'https://graph.microsoft.com/.default';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SEEN_CAP = 2000;

interface GraphMessage {
  id: string;
  subject: string;
  receivedDateTime: string;
  hasAttachments?: boolean;
  from?: { emailAddress?: { name?: string; address?: string } };
  body?: { content?: string };
}
interface GraphAttachment {
  '@odata.type': string;
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentBytes?: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Plain text of an HTML e-mail body: no tags, no entities, collapsed blank lines. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n');
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\r\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

let running: Promise<number> | undefined;

/** Reads new messages of the sales mailbox into requests. Concurrent calls share one run. */
export function syncSalesMailbox(): Promise<number> {
  running ??= doSalesSync().finally(() => (running = undefined));
  return running;
}

async function doSalesSync(): Promise<number> {
  if (!config.graph.salesEnabled) throw new HttpError(503, 'Sales mailbox is not configured on the server (GRAPH_SALES_MAILBOX).');
  if (!config.ai.enabled) throw new HttpError(503, 'E-mail intake needs AI reading (OPENAI_API_KEY or ANTHROPIC_API_KEY) to tell requests from other mail.');
  const mailbox = config.graph.salesMailbox;
  const base = `${GRAPH}/users/${encodeURIComponent(mailbox)}`;
  const startedAt = now();
  const seen = (await db.getMeta<string[]>('sales.mailSeen')) ?? [];
  const seenSet = new Set(seen);
  const last = await db.getMeta<string>('sales.lastSync');
  const since = new Date(last ? Date.parse(last) - 3600_000 : Date.now() - config.graph.lookbackDays * 86400_000).toISOString();

  const markSeen = async (id: string) => {
    seen.push(id);
    seenSet.add(id);
    const kept = seen.slice(-SEEN_CAP);
    await db.setMeta('sales.mailSeen', kept);
  };

  let url: string | undefined =
    `${base}/mailFolders/${encodeURIComponent(config.graph.salesFolder)}/messages` +
    `?$filter=${encodeURIComponent(`receivedDateTime ge ${since}`)}&$orderby=receivedDateTime asc&$top=25` +
    `&$select=id,subject,receivedDateTime,from,body,hasAttachments`;

  let added = 0;
  while (url) {
    const page = (await (await msFetch(SCOPE, url, { headers: { Prefer: 'outlook.body-content-type="text"' } }, undefined)).json()) as {
      value: GraphMessage[];
      '@odata.nextLink'?: string;
    };
    for (const m of page.value) {
      if (seenSet.has(m.id)) continue;
      const fromEmail = (m.from?.emailAddress?.address ?? '').toLowerCase();
      if (!fromEmail || fromEmail === mailbox.toLowerCase() || /(no-?reply|do-?not-?reply|mailer-daemon|postmaster)/.test(fromEmail)) {
        await markSeen(m.id);
        continue;
      }
      try {
        const fileIds = m.hasAttachments ? await loadSalesAttachments(base, m.id) : [];
        const text = htmlToText(m.body?.content ?? '').slice(0, 20_000);
        const created = await ingestRequest({
          source: 'email',
          fields: {},
          text: `Objet : ${m.subject ?? ''}\n\n${text}`,
          fileIds,
          emailRef: {
            messageId: m.id,
            subject: m.subject ?? '',
            from: fromEmail,
            receivedAt: m.receivedDateTime,
          },
          ownerId: '',
          createdBy: 'system',
        });
        if (created) added++;
        await markSeen(m.id);
      } catch (e) {
        console.error('[sales-mailbox] message not processed:', e instanceof Error ? e.message : e);
      }
    }
    url = page['@odata.nextLink'];
  }
  await db.setMeta('sales.lastSync', startedAt);
  if (added) broadcast('sales.requests');
  return added;
}

/** Saves the images and PDFs of one message (ids derived from the message and attachment ids). */
async function loadSalesAttachments(base: string, messageId: string): Promise<string[]> {
  const r = await msFetch(SCOPE, `${base}/messages/${encodeURIComponent(messageId)}/attachments`);
  const list = ((await r.json()) as { value: GraphAttachment[] }).value;
  const ids: string[] = [];
  for (const a of list) {
    if (a['@odata.type'] !== '#microsoft.graph.fileAttachment' || a.isInline || !a.contentBytes) continue;
    if (a.size > 8 * MB) continue;
    const data = Buffer.from(a.contentBytes, 'base64');
    const type = a.contentType.toLowerCase();
    const contentType = IMAGE_TYPES.includes(type) || type === 'application/pdf' ? type : /\.pdf$/i.test(a.name) ? 'application/pdf' : '';
    if (!contentType || data.length > 8 * MB || !MAGIC[contentType]?.(data)) continue;
    const id = 'f_' + createHash('sha256').update(messageId + a.id).digest('hex').slice(0, 24);
    await db.saveFile(id, a.name.replace(/[\\/\x00-\x1f]/g, '_').slice(0, 120) || 'fichier', contentType, data);
    ids.push(id);
  }
  return ids;
}

/** Automatic sales mailbox sync, when GRAPH_SALES_SYNC_MINUTES is set. */
export function startSalesMailboxTimer() {
  if (!config.graph.salesEnabled || config.graph.salesSyncMinutes <= 0) return;
  setInterval(() => {
    syncSalesMailbox().catch((e) => console.error('[sales-mailbox] sync failed:', e instanceof Error ? e.message : e));
  }, config.graph.salesSyncMinutes * 60_000);
}
