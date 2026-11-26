/**
 * Sales: where every customer request begins and is followed until it is in production.
 * Shared by the browser (src/modules/sales), the server (server/sales.ts) and the public pages.
 * Pure types and constants only: no browser or Node APIs.
 */
import type { PackagingSpec } from '../estimating/types';

/** The circuit a request travels. Order matters (the dashboard draws it left to right). */
export const SALES_STAGES = ['received', 'estimating', 'review', 'quote_ready', 'with_client', 'accepted', 'production'] as const;
export type SalesStage = (typeof SALES_STAGES)[number] | 'declined';

export const STAGE_LABEL: Record<SalesStage, { fr: string; en: string }> = {
  received: { fr: 'Demande reçue', en: 'Request received' },
  estimating: { fr: 'Estimation / studio', en: 'Estimating / studio' },
  review: { fr: 'Révision de l’estimation', en: 'Estimate review' },
  quote_ready: { fr: 'Soumission prête', en: 'Quote ready' },
  with_client: { fr: 'Chez le client', en: 'With customer' },
  accepted: { fr: 'Accepté', en: 'Accepted' },
  production: { fr: 'En production', en: 'In production' },
  declined: { fr: 'Refusé', en: 'Declined' },
};

export type RequestSource = 'form' | 'email' | 'manual';

/** Why a request is stuck. Shown on the circuit and in the "blocked" list. */
export type BlockerKind = 'customer' | 'studio' | 'estimation' | 'info' | 'internal' | 'other';
export const BLOCKER_LABEL: Record<BlockerKind, { fr: string; en: string }> = {
  customer: { fr: 'En attente du client', en: 'Waiting for customer' },
  studio: { fr: 'Studio : en attente d’information', en: 'Studio waiting for information' },
  estimation: { fr: 'Estimation : en attente d’information', en: 'Estimating waiting for information' },
  info: { fr: 'Information manquante', en: 'Missing information' },
  internal: { fr: 'Décision interne', en: 'Internal decision' },
  other: { fr: 'Autre', en: 'Other' },
};

export interface Blocker {
  kind: BlockerKind;
  note: string;
  since: string;
  /** ISO date the salesperson wants to follow up. */
  followUpAt?: string;
  userId: string;
}

export interface SalesNote {
  id: string;
  at: string;
  userId: string;
  kind: 'note' | 'followup' | 'system';
  text: string;
  /** For follow-ups: when it is due, and whether it was done. */
  dueAt?: string;
  done?: boolean;
}

/** One move along the circuit. Written only by the server. */
export interface StageEvent {
  at: string;
  /** User id, 'client' (answered on the public page), or 'system'. */
  by: string;
  from: SalesStage | null;
  to: SalesStage;
  note?: string;
}

export type StudioStatus = 'none' | 'requested' | 'in_progress' | 'done';

export interface StudioInfo {
  status: StudioStatus;
  /** What the studio is asked to do (sketch, dielines...). */
  brief: string;
  fileIds: string[];
  updatedAt?: string;
}

/** What the AI (or the person) understood from the request, with what remains unclear. */
export interface RequestAnalysis {
  status: 'none' | 'pending' | 'done' | 'failed';
  summary: string;
  /** Things the AI had to assume to build the spec. Shown to the estimator. */
  assumptions: string[];
  /** Questions to ask the customer before quoting. */
  questions: string[];
  confidence: 'low' | 'medium' | 'high';
  error?: string;
}

export interface SalesRequest {
  id: string;
  /** REQ-YY-NNNN */
  no: string;
  source: RequestSource;
  /** Server-owned: change it through POST /api/sales/requests/:id/transition. */
  stage: SalesStage;
  /** Server-owned. Starts at 1; +1 each time the customer asks for changes. */
  revision: number;
  /** Server-owned. */
  history: StageEvent[];
  customer: string;
  contact: string;
  email: string;
  phone: string;
  project: string;
  /** Date the customer needs the goods / the quote. */
  dueDate: string;
  /** The salesperson who owns it. */
  ownerId: string;
  /** What was asked, in the customer's words (form answers, e-mail body, or typed by the salesperson). */
  description: string;
  /** Structured answers from the request form (question label -> answer). */
  formAnswers?: Record<string, string>;
  /** Partial: only what was given or understood. */
  spec: Partial<PackagingSpec>;
  quantities: number[];
  /** Uploaded images / PDFs (ids in the `files` table). */
  fileIds: string[];
  /** For source 'email': the message this came from. */
  emailRef?: { messageId: string; subject: string; from: string; receivedAt: string };
  analysis: RequestAnalysis;
  studio: StudioInfo;
  /** Server-owned links. */
  estimateId?: string;
  quoteId?: string;
  workOrderId?: string;
  blocker?: Blocker;
  notes: SalesNote[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** What the customer sees. Never contains costs or margins. */
export interface QuoteLine {
  quantity: number;
  unitPrice: number;
  total: number;
}

export type QuoteStatus = 'sent' | 'accepted' | 'declined' | 'changes' | 'superseded' | 'expired';
export type QuoteDecision = 'accept' | 'decline' | 'changes';

export interface QuoteResponse {
  decision: QuoteDecision;
  at: string;
  /** accept: the quantity chosen. */
  quantity?: number;
  /** accept: typed full name + drawn signature (PNG data URL). */
  signedName?: string;
  signature?: string;
  /** decline: why. changes: what to change. */
  reason?: string;
  comments?: string;
  ip?: string;
}

/** Collection `sales.quotes`. The browser may read it; only the server writes it. */
export interface Quote {
  id: string;
  /** Q-YY-NNNN-R<revision> */
  no: string;
  requestId: string;
  estimateId: string;
  revision: number;
  status: QuoteStatus;
  /** Unguessable (32+ random bytes, base64url). The public link is `${APP_URL}/q/${token}`. */
  token: string;
  customer: string;
  contact: string;
  email: string;
  project: string;
  /** Plain-language summary of what is quoted. */
  specSummary: string;
  lines: QuoteLine[];
  currency: string;
  terms: string;
  notes: string;
  validUntil: string;
  sentAt: string;
  sentBy: string;
  /** First time the customer opened the public link. */
  viewedAt?: string;
  response?: QuoteResponse;
}

/** Public form (hosted). Questions are data so they can be changed later without code. */
export interface FormField {
  id: string;
  label: { fr: string; en: string };
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'file';
  options?: { value: string; label: { fr: string; en: string } }[];
  required?: boolean;
  /** Which part of the request this answer fills, so it can be turned into an estimate. */
  maps?: 'customer' | 'contact' | 'email' | 'phone' | 'project' | 'dueDate' | 'quantities' | 'type' | 'style' | 'lengthMm' | 'widthMm' | 'heightMm' | 'material' | 'printProcess' | 'colorsOutside' | 'colorsInside' | 'finishes' | 'options' | 'notes';
  help?: { fr: string; en: string };
}
