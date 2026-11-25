/** Calls to the Sandbox routes of the Imago server (server/sandbox.ts). */
import { api } from '@/data/db';
import type { SandboxEvent, SandboxRequest } from './sandboxModules';

export interface SandboxStatusInfo {
  configured: boolean;
  runner: { ok?: boolean; fake?: boolean; model?: string; repo?: boolean; github?: boolean; anthropic?: boolean } | null;
  budget: { used: number; cap: number };
}

export interface SandboxLive {
  status: string;
  events: SandboxEvent[];
  eventCount: number;
  previewReady: boolean;
  running: boolean;
  error: string | null;
}

export const sandboxApi = {
  status: () => api<SandboxStatusInfo>('/sandbox/status'),
  list: () => api<SandboxRequest[]>('/sandbox/requests'),
  create: (title: string, moduleId: string) => api<SandboxRequest>('/sandbox/requests', { method: 'POST', body: { title, moduleId } }),
  get: (id: string, since: number) => api<{ request: SandboxRequest; live: SandboxLive | null }>(`/sandbox/requests/${id}?since=${since}`),
  prompt: (id: string, text: string) => api<{ ok: true }>(`/sandbox/requests/${id}/prompt`, { method: 'POST', body: { text } }),
  stop: (id: string) => api<{ ok: true }>(`/sandbox/requests/${id}/stop`, { method: 'POST', body: {} }),
  submit: (id: string, summary: string) => api<{ ok: true; prUrl: string | null }>(`/sandbox/requests/${id}/submit`, { method: 'POST', body: { summary } }),
  review: (id: string, decision: 'approved' | 'rejected', note: string) => api<{ ok: true }>(`/sandbox/requests/${id}/review`, { method: 'POST', body: { decision, note } }),
  close: (id: string) => api<{ ok: true }>(`/sandbox/requests/${id}/close`, { method: 'POST', body: {} }),
};

export const STATUS_LABEL: Record<string, { fr: string; en: string; tone: '' | 'ok' | 'warn' | 'err' | 'info' }> = {
  preparing: { fr: 'Préparation…', en: 'Preparing…', tone: 'info' },
  ready: { fr: 'Prête', en: 'Ready', tone: '' },
  working: { fr: 'Claude travaille…', en: 'Claude is working…', tone: 'info' },
  building: { fr: 'Aperçu en cours…', en: 'Building preview…', tone: 'info' },
  submitting: { fr: 'Vérifications…', en: 'Checking…', tone: 'info' },
  submitted: { fr: 'Soumise', en: 'Submitted', tone: 'warn' },
  approved: { fr: 'Approuvée', en: 'Approved', tone: 'ok' },
  rejected: { fr: 'Refusée', en: 'Rejected', tone: 'err' },
  error: { fr: 'Erreur', en: 'Error', tone: 'err' },
  closed: { fr: 'Abandonnée', en: 'Abandoned', tone: '' },
};
