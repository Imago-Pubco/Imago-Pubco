/**
 * Calls to the punch server (server/punch). Same path everywhere: the kiosk is served by that server,
 * and the Imago admin page reaches it through the Vite proxy (/punch-api → https://localhost:8443).
 */
import type { OutboxMessage, PunchEmployee, PunchEvent, PunchKind, PunchSettings, WeekSchedule, WeekSummary } from './types.ts';

export class PunchApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/punch-api' + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new PunchApiError(0, 'Serveur de pointage injoignable');
  }
  if (!res.ok) {
    let msg = res.status === 502 || res.status === 504 ? 'Serveur de pointage arrêté (lancez npm run pointage)' : res.statusText;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {
      /* no JSON body */
    }
    throw new PunchApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

/* ---------- kiosk ---------- */

export interface KioskView {
  employee: { id: string; firstName: string };
  summary: WeekSummary;
  /** This week's 30 h question (sent once 30 h are reached), with the answer if given. */
  question: { mailId: string; answer: 'yes' | 'no' | null; justification: string | null } | null;
  /** Photo checks are on but the admin has not taken this employee's reference face yet. */
  needsReference: boolean;
}

export const kioskApi = {
  now: () => call<{ now: string; photoCheck: boolean }>('/kiosk/now'),
  identify: (code: string) => call<KioskView & { reference: number[] | null; photoCheck: boolean }>('/kiosk/identify', 'POST', { code }),
  punch: (body: { code: string; kind: PunchKind; descriptor?: number[]; photo?: string; faceStatus?: string }) =>
    call<KioskView & { event: PunchEvent }>('/kiosk/punch', 'POST', body),
  answer: (body: { code: string; mailId: string; answer: 'yes' | 'no'; justification: string }) => call<KioskView>('/kiosk/answer', 'POST', body),
  /** New employee signing up alone on the tablet. */
  register: (body: { name: string; phoneLast4: string; email: string; descriptor?: number[]; photo?: string }) =>
    call<KioskView & { reference: number[] | null; photoCheck: boolean }>('/kiosk/register', 'POST', body),
};

/* ---------- admin ---------- */

export interface AdminState {
  now: string;
  weekStart: string;
  settings: PunchSettings;
  mail: { enabled: boolean; user: string };
  kioskUrls: string[];
  /** Protected live follow-up link for the administrator. */
  followUpLink: string;
  employees: PunchEmployee[];
  summaries: Record<string, WeekSummary>;
  events: PunchEvent[];
  mails: OutboxMessage[];
}

export interface EmployeeInput {
  name: string;
  phoneLast4: string;
  email: string;
  role: string;
  schedule: WeekSchedule;
  active: boolean;
}

export const adminApi = {
  state: (week = 0) => call<AdminState>(`/admin/state?week=${week}`),
  createEmployee: (e: EmployeeInput) => call<PunchEmployee>('/admin/employees', 'POST', e),
  updateEmployee: (id: string, e: EmployeeInput) => call<PunchEmployee>(`/admin/employees/${id}`, 'PUT', e),
  deleteEmployee: (id: string) => call<{ ok: true }>(`/admin/employees/${id}`, 'DELETE'),
  approve: (id: string) => call<{ ok: true }>(`/admin/employees/${id}/approve`, 'POST'),
  setFace: (id: string, descriptor: number[], photo: string) => call<{ ok: true }>(`/admin/employees/${id}/face`, 'POST', { descriptor, photo }),
  resetFace: (id: string) => call<{ ok: true }>(`/admin/employees/${id}/reset-face`, 'POST'),
  addEvent: (e: { employeeId: string; at: string; kind: PunchKind; note: string }) => call<PunchEvent>('/admin/events', 'POST', e),
  updateEvent: (id: string, e: { at: string; kind: PunchKind; note: string }) => call<{ ok: true }>(`/admin/events/${id}`, 'PUT', e),
  deleteEvent: (id: string) => call<{ ok: true }>(`/admin/events/${id}`, 'DELETE'),
  saveSettings: (s: Partial<Pick<PunchSettings, 'directorEmail' | 'photoCheck' | 'digestHours'>>) => call<PunchSettings>('/admin/settings', 'PUT', s),
  resendMail: (id: string) => call<OutboxMessage>(`/admin/mails/${id}/resend`, 'POST'),
  sendDigest: () => call<{ ok: true }>('/admin/digest', 'POST'),
  renewKey: () => call<{ followUpLink: string }>('/admin/renew-key', 'POST'),
};

/* ---------- labels ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
export const clockOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const clockSecondsOf = (d: Date) => `${clockOf(d)}:${pad(d.getSeconds())}`;

export const KIND_LABEL: Record<PunchKind, string> = { in: 'Entrée', pause_start: 'Pause', pause_end: 'Fin de pause', out: 'Sortie' };
export const STATUS_LABEL = { off: 'Absent', working: 'Au travail', pause: 'En pause' } as const;
export const IDENTITY_LABEL = {
  verified: 'Visage confirmé',
  enrolled: 'Photo d’identité prise',
  mismatch: 'Visage non reconnu',
  no_camera: 'Sans photo',
  no_reference: 'Pas de visage de référence',
  off: 'Sans vérification',
} as const;
