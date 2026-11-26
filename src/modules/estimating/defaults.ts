/**
 * Provisional defaults for the costing model. Nothing here is a real company rate:
 * each group is marked 'estimate' until the owner confirms it in the setup wizard.
 * PURE module (no React, no browser APIs): pricing.ts and the Node server import it.
 */
import type { EstimatingSettings } from './types';

export interface SettingGroup {
  id: string;
  fr: string;
  en: string;
}

/** The questions of the setup wizard, one group per step. Each group can be confirmed or left as an estimate. */
export const SETTING_GROUPS: SettingGroup[] = [
  { id: 'company', fr: 'Entreprise et devise', en: 'Company and currency' },
  { id: 'materials', fr: 'Cartons, feuilles et gâche', en: 'Boards, sheets and waste' },
  { id: 'printing', fr: 'Impression', en: 'Printing' },
  { id: 'tooling', fr: 'Découpe et outillage', en: 'Die-cutting and tooling' },
  { id: 'finishing', fr: 'Finitions', en: 'Finishing' },
  { id: 'labour', fr: 'Collage, assemblage et emballage', en: 'Gluing, assembly and packing' },
  { id: 'overhead', fr: 'Frais généraux et transport', en: 'Overhead and freight' },
  { id: 'margin', fr: 'Politique de marge', en: 'Margin policy' },
];

/** Which group a setting belongs to (drives the provisional flag on every calculation step). */
export const GROUP_OF: Record<string, string> = {
  companyName: 'company',
  currency: 'company',
  sheetWidthMm: 'materials',
  sheetHeightMm: 'materials',
  gripperMarginMm: 'materials',
  gutterMm: 'materials',
  wasteCurve: 'materials',
  wastePct: 'materials',
  pressRates: 'printing',
  printSetupPerColor: 'printing',
  printRunPerColorUnit: 'printing',
  dieCostByType: 'tooling',
  dieCutSheetsPerHour: 'tooling',
  dieCutHourlyRate: 'tooling',
  dieCost: 'tooling',
  finishRates: 'finishing',
  finishSetup: 'finishing',
  finishRunUnit: 'finishing',
  assemblyRatePerHour: 'labour',
  machineHourlyRate: 'labour',
  gluerUnitsPerHour: 'labour',
  packingSecondsPerUnit: 'labour',
  secondsPerExtraPart: 'labour',
  styleAssemblySeconds: 'labour',
  optionSeconds: 'labour',
  laborPerUnit: 'labour',
  overheadPct: 'overhead',
  freightPct: 'overhead',
  defaultMarginPct: 'margin',
  marginTiers: 'margin',
  marginByType: 'margin',
};

export const DEFAULT_EST_SETTINGS: EstimatingSettings = {
  id: 'settings',
  /* legacy */
  defaultMarginPct: 30,
  wastePct: 12,
  printSetupPerColor: 350,
  printRunPerColorUnit: 0.012,
  dieCost: 450,
  finishSetup: 150,
  finishRunUnit: 0.015,
  laborPerUnit: 0.03,
  freightPct: 3,

  companyName: 'Pubco',
  currency: 'CAD',

  sheetWidthMm: 720,
  sheetHeightMm: 1020,
  gripperMarginMm: 12,
  gutterMm: 5,
  wasteCurve: [
    { upToQty: 1000, pct: 15 },
    { upToQty: 5000, pct: 10 },
    { upToQty: 20000, pct: 6 },
    { upToQty: 1e9, pct: 4 },
  ],

  pressRates: {
    offset: { hourlyRate: 185, sheetsPerHour: 6000, units: 4, makeReadyMinPerColor: 12, makeReadySheetsPerColor: 25, platePerColor: 55, inkPerSheetPerColor: 0.02 },
    flexo: { hourlyRate: 150, sheetsPerHour: 5000, units: 6, makeReadyMinPerColor: 18, makeReadySheetsPerColor: 20, platePerColor: 95, inkPerSheetPerColor: 0.03 },
    digital: { hourlyRate: 240, sheetsPerHour: 1500, units: 4, makeReadyMinPerColor: 0, makeReadySheetsPerColor: 0, platePerColor: 0, inkPerSheetPerColor: 0.06 },
  },

  dieCostByType: { folding: 450, corrugated: 650, rigid: 250, display: 900, copacking: 0 },
  dieCutSheetsPerHour: { folding: 4000, corrugated: 2500, rigid: 0, display: 1200, copacking: 0 },
  dieCutHourlyRate: 120,

  finishRates: {
    aqueous: { setup: 40, perThousand: 5 },
    uv: { setup: 90, perThousand: 9 },
    spotuv: { setup: 160, perThousand: 10 },
    matte: { setup: 60, perThousand: 15 },
    gloss: { setup: 60, perThousand: 15 },
    foil: { setup: 220, perThousand: 25 },
    emboss: { setup: 260, perThousand: 12 },
  },

  assemblyRatePerHour: 42,
  machineHourlyRate: 95,
  gluerUnitsPerHour: 3000,
  packingSecondsPerUnit: 3,
  secondsPerExtraPart: 25,
  styleAssemblySeconds: {
    'ECMA A20.20.03.01': 0,
    'ECMA A20.20.01.01': 0,
    'ECMA A60.20.00.01': 0,
    'ECMA F42': 20,
    'ECMA C10': 0,
    'FEFCO 0201': 0,
    'FEFCO 0427': 0,
    'FEFCO 0300': 10,
    'FEFCO 0711': 0,
    'RIG-LID': 120,
    'RIG-MAG': 150,
    'RIG-DRAW': 180,
    'DSP-CTR': 240,
    'DSP-FLR': 420,
    'DSP-PDQ': 150,
    'CPK-KIT': 45,
    'CPK-SHR': 20,
    'CPK-FIL': 30,
  },
  optionSeconds: { window: 6, insert: 12, handle: 15, glue: 20, assembly: 30, tape: 5 },

  overheadPct: 18,
  marginTiers: [
    { minQty: 0, marginPct: 30 },
    { minQty: 5000, marginPct: 28 },
    { minQty: 20000, marginPct: 25 },
  ],
  marginByType: {},

  validated: Object.fromEntries(SETTING_GROUPS.map((g) => [g.id, 'estimate'])),
};

function isPlain(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep merge: stored values win, missing keys fall back to the defaults, arrays are replaced. */
function merge<T>(base: T, over: unknown): T {
  if (over === undefined || over === null) return base;
  if (isPlain(base) && isPlain(over)) {
    const out: Record<string, unknown> = { ...base };
    for (const k of Object.keys(over)) out[k] = merge((base as Record<string, unknown>)[k], over[k]);
    return out as T;
  }
  return over as T;
}

/** Stored settings merged over the defaults, so documents saved before a field existed keep working. */
export function resolveSettings(s: Partial<EstimatingSettings> | null | undefined): EstimatingSettings {
  return merge(DEFAULT_EST_SETTINGS, s ?? {});
}
