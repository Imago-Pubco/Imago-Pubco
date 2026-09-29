/** Packaging estimate — structure is a first draft; business rules will be supplied later. */

export type PackagingType = 'folding' | 'corrugated' | 'rigid' | 'display' | 'copacking';

export type EstimateStatus = 'draft' | 'costing' | 'sent' | 'won' | 'lost';

export interface PackagingSpec {
  type: PackagingType;
  /** Industry style code, e.g. ECMA A20.20.03.01 (reverse tuck end) or FEFCO 0201 (RSC). */
  style: string;
  /** Interior dimensions, millimetres. */
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  materialId: string;
  printProcess: 'offset' | 'flexo' | 'digital' | 'none';
  colorsOutside: number;
  colorsInside: number;
  finishes: string[];
  options: string[];
  /** New cutting die needed (tooling cost). */
  newDie: boolean;
  notes: string;
}

export interface PhotoAnalysis {
  fileName: string;
  /** Filled by the future AI analysis. */
  status: 'pending' | 'done';
  suggested?: Partial<PackagingSpec>;
}

export interface EstimateHistory {
  at: string;
  userId: string;
  action: string;
  note?: string;
}

export interface Estimate {
  id: string;
  no: string;
  status: EstimateStatus;
  customer: string;
  contact: string;
  email: string;
  project: string;
  dueDate: string;
  ownerId: string;
  spec: PackagingSpec;
  quantities: number[];
  marginPct: number;
  photo?: PhotoAnalysis;
  internalNotes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  history: EstimateHistory[];
}

export interface Material {
  id: string;
  code: string;
  name: string;
  category: 'carton' | 'corrugated' | 'rigid' | 'plastic';
  caliper: string;
  costPerM2: number;
}

export interface EstimatingSettings {
  id: 'settings';
  defaultMarginPct: number;
  wastePct: number;
  printSetupPerColor: number;
  printRunPerColorUnit: number;
  dieCost: number;
  finishSetup: number;
  finishRunUnit: number;
  laborPerUnit: number;
  freightPct: number;
}
