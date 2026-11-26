/**
 * Sales data: typed collections, the calls to the server routes, and small helpers (stage index, dwell time,
 * follow-ups, statistics, formatting). Writes that the server owns (stage, revision, history, links) go through
 * the routes below, never through the collection.
 */
import { API_MODE, api, collection, uid } from '@/data/db';
import type { Lang } from '@/data/types';
import type { Estimate } from '../estimating/types';
import { SALES_STAGES, type BlockerKind, type FormField, type Quote, type SalesNote, type SalesRequest, type SalesStage, type StudioStatus } from './types';
import type { WorkOrder } from '@/modules/workorders/types';
import { seedSalesQuotes, seedSalesRequests, seedWorkOrders } from './seed';
import { localCreateRequest, localFileUrl, localSendQuote, localStudio, localTransition, localUpload, localUserId, readFileBase64 } from './localServer';

export const salesRequests = collection<SalesRequest>('sales.requests');
export const salesQuotes = collection<Quote>('sales.quotes');
/** Read-only here: the estimates the requests turned into. */
export const salesEstimates = collection<Estimate>('est.estimates');
/** Work orders are created by the server; the demo seed writes them here for browser mode. */
const salesWorkOrders = collection<WorkOrder>('wo.orders');

/** Module-level seed, same pattern as ensureEstimatingSeeded: runs once per browser unless forced. */
const SALES_SEED_KEY = 'imago:seed:sales';
export async function ensureSalesSeeded(force = false) {
  if (!force && localStorage.getItem(SALES_SEED_KEY) === '1') return;
  await salesRequests.replaceAll(seedSalesRequests);
  await salesQuotes.replaceAll(seedSalesQuotes);
  await salesWorkOrders.replaceAll(seedWorkOrders);
  localStorage.setItem(SALES_SEED_KEY, '1');
}

export const DAY_MS = 86_400_000;

/* ---------- Stages ---------- */

const ORDER = SALES_STAGES as readonly string[];

/** Position on the circuit (0 = received ... 6 = production), -1 for declined. */
export const stageIndex = (s: SalesStage): number => ORDER.indexOf(s);

export const isClosed = (r: SalesRequest) => r.stage === 'declined' || r.stage === 'production';
export const isWon = (r: SalesRequest) => r.stage === 'accepted' || r.stage === 'production';
export const isBlocked = (r: SalesRequest) => !!r.blocker;

/** Furthest stage the request has reached (a declined request is drawn up to there). */
export function reachedIndex(r: SalesRequest): number {
  return r.history.reduce((m, e) => Math.max(m, stageIndex(e.to)), Math.max(stageIndex(r.stage), 0));
}

/** Milliseconds spent in each stage, from the history. The current stage runs until `now`. */
export function dwellByStage(r: SalesRequest, now = Date.now()): Partial<Record<SalesStage, number>> {
  const out: Partial<Record<SalesStage, number>> = {};
  const ev = [...r.history].sort((a, b) => a.at.localeCompare(b.at));
  const created = Date.parse(r.createdAt) || now;
  if (ev.length === 0) {
    out[r.stage] = Math.max(0, now - created);
    return out;
  }
  const first = Date.parse(ev[0].at);
  if (first > created) out[ev[0].from ?? 'received'] = first - created;
  ev.forEach((e, i) => {
    const end = i + 1 < ev.length ? Date.parse(ev[i + 1].at) : now;
    out[e.to] = (out[e.to] ?? 0) + Math.max(0, end - Date.parse(e.at));
  });
  return out;
}

/** Time since the request entered its current stage. */
export function msInCurrentStage(r: SalesRequest, now = Date.now()): number {
  const last = r.history[r.history.length - 1];
  return Math.max(0, now - Date.parse(last?.at ?? r.createdAt));
}

/* ---------- Dates and durations ---------- */

export function localDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A calendar day (YYYY-MM-DD) for a plain date or an ISO timestamp. */
export function dayKeyOf(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? '' : localDayKey(ms);
}

/** Days (one decimal under 10) as a short label: "3 j" / "3 d". */
export function dayLabel(ms: number, lang: Lang): string {
  const d = ms / DAY_MS;
  return `${d < 10 ? Number(d.toFixed(1)) : Math.round(d)} ${lang === 'fr' ? 'j' : 'd'}`;
}

/* ---------- Follow-ups ---------- */

export interface FollowUp {
  key: string;
  reqId: string;
  dueAt: string;
  text: string;
}

/** Open follow-ups of a request: the ones in its notes, plus the follow-up date of its blocker. */
export function followUpsOf(r: SalesRequest): FollowUp[] {
  const out: FollowUp[] = [];
  for (const n of r.notes) if (n.kind === 'followup' && !n.done && n.dueAt) out.push({ key: n.id, reqId: r.id, dueAt: n.dueAt, text: n.text });
  if (r.blocker?.followUpAt) out.push({ key: 'blocker', reqId: r.id, dueAt: r.blocker.followUpAt, text: r.blocker.note });
  return out;
}

export function followUpState(dueAt: string, now = Date.now()): 'overdue' | 'today' | 'later' {
  const k = dayKeyOf(dueAt);
  if (!k) return 'later';
  const today = localDayKey(now);
  return k < today ? 'overdue' : k === today ? 'today' : 'later';
}

/* ---------- Statistics ---------- */

export interface SalesStats {
  open: number;
  blocked: number;
  /** Follow-ups due today. */
  due: number;
  /** Follow-ups past their day. */
  overdue: number;
  avgDaysToQuote: number | null;
  winRate: number | null;
}

export function salesStats(rows: SalesRequest[], now = Date.now()): SalesStats {
  let due = 0;
  let overdue = 0;
  let quoteMs = 0;
  let quoteN = 0;
  let won = 0;
  let lost = 0;
  for (const r of rows) {
    if (!isClosed(r))
      for (const f of followUpsOf(r)) {
        const st = followUpState(f.dueAt, now);
        if (st === 'overdue') overdue++;
        else if (st === 'today') due++;
      }
    const q = r.history.find((e) => e.to === 'quote_ready');
    if (q) {
      quoteMs += Math.max(0, Date.parse(q.at) - (Date.parse(r.createdAt) || Date.parse(q.at)));
      quoteN++;
    }
    if (isWon(r)) won++;
    else if (r.stage === 'declined') lost++;
  }
  return {
    open: rows.filter((r) => !isClosed(r)).length,
    blocked: rows.filter((r) => !isClosed(r) && isBlocked(r)).length,
    due,
    overdue,
    avgDaysToQuote: quoteN ? Number((quoteMs / quoteN / DAY_MS).toFixed(1)) : null,
    winRate: won + lost ? Math.round((won / (won + lost)) * 100) : null,
  };
}

/* ---------- Quotes ---------- */

/** The latest quote of a request (highest revision). */
export function latestQuote(quotes: Quote[], requestId: string): Quote | undefined {
  return quotes.filter((q) => q.requestId === requestId).sort((a, b) => b.revision - a.revision)[0];
}

/** Public link the customer receives. */
export const publicQuoteUrl = (token: string) => `${window.location.origin}/q/${token}`;

/* ---------- Files ---------- */

/** Link or image source of a stored file. In dev mode (no server) the file is a data URL kept in this browser. */
export const fileUrl = (id: string) => (API_MODE ? `/api/files/${id}` : localFileUrl(id));

/** Uploads one image or PDF to the server (dev mode: kept in this browser) and returns its file id. */
export async function uploadFile(file: File): Promise<string> {
  if (!API_MODE) return localUpload(file);
  const dataBase64 = await readFileBase64(file);
  const r = await api<{ fileId: string }>('/sales/upload', {
    method: 'POST',
    body: { name: file.name, contentType: file.type || 'application/octet-stream', dataBase64 },
  });
  return r.fileId;
}

export const isImageType = (name: string, type = '') => type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name);

/* ---------- Server routes (dev mode: the browser stand-in in localServer.ts answers them) ---------- */

export interface CreateRequestBody {
  fields: Partial<Pick<SalesRequest, 'customer' | 'contact' | 'email' | 'phone' | 'project' | 'dueDate' | 'description' | 'quantities' | 'spec'>> & {
    formAnswers?: Record<string, string>;
  };
  text: string;
  fileIds: string[];
  source: 'manual' | 'email';
}

/** Server error codes, in words a salesperson can act on. */
const ERROR_TEXT: Record<string, { fr: string; en: string }> = {
  estimate_not_approved: { fr: 'L’estimation doit d’abord être approuvée par le responsable de l’estimation.', en: 'The estimate must be approved by the estimating manager first.' },
  not_quote_ready: { fr: 'La demande n’est pas à l’étape « Soumission prête ».', en: 'The request is not at the "Quote ready" stage.' },
  invalid_move: { fr: 'Ce changement d’étape n’est pas permis depuis l’étape actuelle.', en: 'That stage change is not allowed from the current stage.' },
  note_required: { fr: 'Une note est requise pour cette action.', en: 'A note is required for this action.' },
  no_quantities: { fr: 'Aucune quantité à soumettre : ajoutez au moins une quantité à l’estimation.', en: 'No quantity to quote: add at least one quantity to the estimate.' },
  already_in_production: { fr: 'Cette demande est déjà en production.', en: 'This request is already in production.' },
  ai_off: { fr: 'L’IA n’est pas configurée sur le serveur.', en: 'AI is not configured on the server.' },
  ai_failed: { fr: 'La lecture par l’IA a échoué. Réessayez ou saisissez à la main.', en: 'The AI reading failed. Try again or enter it by hand.' },
  unreadable_file: { fr: 'Ce fichier ne peut pas être lu par l’IA.', en: 'The AI cannot read this file.' },
  too_large: { fr: 'Fichier trop volumineux.', en: 'File too large.' },
  unsupported_type: { fr: 'Type de fichier non pris en charge (images ou PDF).', en: 'Unsupported file type (images or PDF).' },
  too_many_requests: { fr: 'Trop de requêtes, réessayez plus tard.', en: 'Too many requests, try again later.' },
  not_found: { fr: 'Élément introuvable.', en: 'Not found.' },
};

/** Turns a known server error code into a readable message; anything else is passed through unchanged. */
export function friendlyError(e: unknown): Error {
  const raw = e instanceof Error ? e.message : String(e);
  const m = ERROR_TEXT[raw];
  return m ? new Error(document.documentElement.lang === 'en' ? m.en : m.fr) : e instanceof Error ? e : new Error(raw);
}
const friendly = <T>(p: Promise<T>): Promise<T> => p.catch((e) => Promise.reject(friendlyError(e)));

export const createRequest = (body: CreateRequestBody): Promise<SalesRequest> =>
  friendly(API_MODE ? api<SalesRequest>('/sales/requests', { method: 'POST', body }) : localCreateRequest(body, localUserId()));

export const transitionRequest = (id: string, to: SalesStage, note?: string): Promise<SalesRequest | void> =>
  friendly(
    API_MODE
      ? api<SalesRequest | void>(`/sales/requests/${encodeURIComponent(id)}/transition`, { method: 'POST', body: { to, note } })
      : localTransition(id, to, note, localUserId()),
  );

/** Needs the AI reading, which only the server has. */
export const reanalyzeRequest = (id: string): Promise<unknown> =>
  friendly(API_MODE ? api<unknown>(`/sales/requests/${encodeURIComponent(id)}/reanalyze`, { method: 'POST' }) : Promise.reject(new Error('IA non disponible en mode démo')));

export const saveStudio = (id: string, body: { status: StudioStatus; brief: string; fileIds: string[] }): Promise<unknown> =>
  friendly(API_MODE ? api<unknown>(`/sales/requests/${encodeURIComponent(id)}/studio`, { method: 'POST', body }) : localStudio(id, body, localUserId()));

export interface SendQuoteResult {
  id: string;
  url: string;
  emailed: boolean;
}

export const sendQuote = (id: string, body: { validDays?: number; terms?: string; notes?: string }): Promise<SendQuoteResult> =>
  friendly(
    API_MODE
      ? api<SendQuoteResult>(`/sales/requests/${encodeURIComponent(id)}/send-quote`, { method: 'POST', body })
      : localSendQuote(id, body, localUserId()),
  );

/** Dev mode has no mailbox: the sales mailbox is reported as off. */
export const mailboxStatus = (): Promise<{ enabled: boolean; mailbox?: string }> =>
  API_MODE ? api<{ enabled: boolean; mailbox?: string }>('/sales/mailbox/status') : Promise.resolve({ enabled: false });
export const mailboxSync = (): Promise<{ added: number }> =>
  API_MODE ? api<{ added: number }>('/sales/mailbox/sync', { method: 'POST' }) : Promise.resolve({ added: 0 });

/* ---------- Writes allowed from the browser (plain fields, notes, blockers) ---------- */

export const newNoteId = () => uid('n');

export function addNote(r: SalesRequest, note: Omit<SalesNote, 'id' | 'at'> & { at?: string }) {
  const row: SalesNote = { id: newNoteId(), at: note.at ?? new Date().toISOString(), ...note };
  return salesRequests.update(r.id, { notes: [...r.notes, row] });
}

/** Blockers are cleared with null: the server treats it as "no blocker". */
export const clearBlocker = (id: string) => salesRequests.update(id, { blocker: null } as unknown as Partial<SalesRequest>);

export const BLOCKER_SHORT: Record<BlockerKind, { fr: string; en: string }> = {
  customer: { fr: 'Client', en: 'Customer' },
  studio: { fr: 'Studio', en: 'Studio' },
  estimation: { fr: 'Estimation', en: 'Estimating' },
  info: { fr: 'Info', en: 'Info' },
  internal: { fr: 'Interne', en: 'Internal' },
  other: { fr: 'Autre', en: 'Other' },
};

/* ---------- Form ---------- */

export const requiredMissing = (fields: FormField[], answers: Record<string, string>) =>
  fields.filter((f) => f.required && f.type !== 'file' && !String(answers[f.id] ?? '').trim()).map((f) => f.id);

/** Copies text to the clipboard. Resolves false when the browser refuses (no permission, insecure context). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
