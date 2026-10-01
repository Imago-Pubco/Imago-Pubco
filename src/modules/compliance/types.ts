/**
 * Compliance data model — a first, deliberately generic draft:
 * Framework (ISO 9001, ISO 27001, Loi 25, FSC…) → Requirements → Evidence,
 * plus Audits with Findings (non-conformities) and a Policy/Document register.
 * Everything is editable from the UI so the structure can evolve without code changes.
 */

export type FrameworkCategory = 'quality' | 'security' | 'privacy' | 'environment' | 'health' | 'customer' | 'other';

export interface Framework {
  id: string;
  code: string;
  name: string;
  category: FrameworkCategory;
  description: string;
  ownerId: string;
  color: string;
  /** Certification / target date, if any. */
  targetDate?: string;
  certified?: boolean;
  active: boolean;
}

/** Metamorphosis of a requirement: not started → in progress → implemented → verified. */
export type RequirementStatus = 'todo' | 'progress' | 'implemented' | 'verified' | 'na';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface Evidence {
  id: string;
  label: string;
  at: string;
  by: string;
}

export interface Requirement {
  id: string;
  frameworkId: string;
  ref: string;
  title: string;
  description: string;
  ownerId: string;
  status: RequirementStatus;
  risk: RiskLevel;
  reviewDue?: string;
  evidence: Evidence[];
  notes: string;
  updatedAt: string;
}

export type FindingSeverity = 'minor' | 'major' | 'observation';

export interface Finding {
  id: string;
  title: string;
  severity: FindingSeverity;
  requirementId?: string;
  ownerId: string;
  dueDate?: string;
  closed: boolean;
}

export interface Audit {
  id: string;
  frameworkId: string;
  kind: 'internal' | 'external' | 'certification';
  title: string;
  date: string;
  auditor: string;
  status: 'planned' | 'done';
  findings: Finding[];
  notes: string;
}

export interface PolicyDoc {
  id: string;
  title: string;
  version: string;
  frameworkIds: string[];
  ownerId: string;
  status: 'draft' | 'approved' | 'obsolete';
  approvedAt?: string;
  reviewDue?: string;
  link?: string;
}
