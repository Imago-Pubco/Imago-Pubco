/**
 * Modules a Sandbox request can change, the folders the agent may write in for each, and the right a person needs to
 * open that module (no right = no request on it). Shared by the server (which enforces it) and the Sandbox screens.
 * Kept free of imports: the server reads this file directly.
 */
export interface SandboxModule {
  id: string;
  name: { fr: string; en: string };
  /** The module's access right. */
  permission: string;
  /** Repository folders the agent may change (everything else is read-only). */
  folders: string[];
}

export const SANDBOX_MODULES: SandboxModule[] = [
  { id: 'align', name: { fr: 'Align', en: 'Align' }, permission: 'align.access', folders: ['src/modules/align'] },
  { id: 'o365', name: { fr: 'Gestion O365', en: 'O365 management' }, permission: 'o365.access', folders: ['src/modules/o365'] },
  { id: 'rh', name: { fr: 'RH', en: 'HR' }, permission: 'rh.access', folders: ['src/modules/rh', 'src/modules/compliance'] },
  { id: 'accounting', name: { fr: 'Comptabilité', en: 'Accounting' }, permission: 'accounting.access', folders: ['src/modules/accounting'] },
  { id: 'estimating', name: { fr: 'Estimation', en: 'Estimating' }, permission: 'estimating.access', folders: ['src/modules/estimating'] },
  { id: 'shipping', name: { fr: 'Expédition', en: 'Shipping' }, permission: 'shipping.access', folders: ['src/modules/shipping'] },
  { id: 'tools.pm', name: { fr: 'Function Fox', en: 'Function Fox' }, permission: 'tools.pm.access', folders: ['src/modules/tools/pm'] },
  { id: 'it', name: { fr: 'Support TI', en: 'IT support' }, permission: 'it.access', folders: ['src/modules/it'] },
];

export const sandboxModule = (id: string) => SANDBOX_MODULES.find((m) => m.id === id);

export type SandboxStatus = 'preparing' | 'ready' | 'working' | 'building' | 'submitting' | 'submitted' | 'approved' | 'rejected' | 'error' | 'closed';

/** A Sandbox request as stored by Imago (the runner holds the working copy and the conversation). */
export interface SandboxRequest {
  id: string;
  title: string;
  moduleId: string;
  ownerId: string;
  status: SandboxStatus;
  costUsd: number;
  prUrl: string | null;
  /** Private part of the preview link (see server/sandbox.ts). */
  previewToken?: string;
  reviewNote: string;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SandboxEvent {
  at: string;
  kind: 'user' | 'agent' | 'tool' | 'info' | 'error';
  text: string;
}
