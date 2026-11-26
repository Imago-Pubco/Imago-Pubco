/**
 * Packaging costing model.
 *
 * Every rate comes from EstimatingSettings (defaults in defaults.ts). Each settings group is flagged
 * 'estimate' until the owner confirms it in the setup wizard, and every calculation step that uses a
 * non-confirmed group is marked `provisional`.
 *
 * PURE module: no React, no browser APIs, no '@/' imports. The Node server imports it too.
 */
import { resolveSettings } from './defaults.ts';
import type { EstimatingSettings, Material, PackagingSpec, PackagingType, PressType, TraceInput, TraceStep } from './types';

/** Fully resolved settings (every optional field has its default). */
type S = Required<EstimatingSettings>;

export type CostKey = 'material' | 'print' | 'tooling' | 'finishing' | 'labor' | 'assembly' | 'overhead' | 'freight';
export interface CostLine {
  key: CostKey;
  amount: number;
}

export interface QuantityPrice {
  quantity: number;
  /** Always one line per CostKey, in the order of the array. */
  lines: CostLine[];
  /** Direct costs + overhead + freight. */
  cost: number;
  price: number;
  unitPrice: number;
  margin: number;
  /** Margin actually applied (clamped to 0–90 %). */
  marginPct: number;
  /** Every calculation step, from the blank to the unit price. */
  trace: TraceStep[];
}

/* ---------------------------------------------------------------- helpers */

type Bi = { fr: string; en: string };

/** Keeps every result finite: a zero or invalid input gives 0, never NaN or Infinity. */
const fin = (n: number) => (Number.isFinite(n) ? n : 0);
const div = (a: number, b: number) => (b > 0 ? fin(a / b) : 0);

const inp = (label: Bi, value: number | string, unit: string | undefined, source: TraceInput['source']): TraceInput => ({
  label: label.fr,
  labelEn: label.en,
  value: typeof value === 'number' ? fin(value) : value,
  unit,
  source,
});

function mk(
  key: string,
  title: Bi,
  formula: Bi,
  inputs: TraceInput[],
  result: number,
  unit: string | undefined,
  provisional: boolean,
  note?: Bi,
): TraceStep {
  return {
    key,
    title: title.fr,
    formula: formula.fr,
    inputs,
    result: fin(result),
    unit,
    note: note?.fr,
    en: { title: title.en, formula: formula.en, note: note?.en },
    provisional,
  };
}

const FINISH_NAMES: Record<string, Bi> = {
  aqueous: { fr: 'Vernis aqueux', en: 'Aqueous coating' },
  uv: { fr: 'Vernis UV', en: 'UV coating' },
  spotuv: { fr: 'UV sélectif', en: 'Spot UV' },
  matte: { fr: 'Laminage mat', en: 'Matte lamination' },
  gloss: { fr: 'Laminage lustré', en: 'Gloss lamination' },
  foil: { fr: 'Dorure à chaud', en: 'Hot foil' },
  emboss: { fr: 'Gaufrage', en: 'Embossing' },
};

const LINE_LABEL: Record<CostKey, Bi> = {
  material: { fr: 'Matériaux', en: 'Material' },
  print: { fr: 'Impression', en: 'Printing' },
  tooling: { fr: 'Outillage', en: 'Tooling' },
  finishing: { fr: 'Finition', en: 'Finishing' },
  labor: { fr: 'Transformation', en: 'Converting' },
  assembly: { fr: 'Assemblage manuel', en: 'Hand assembly' },
  overhead: { fr: 'Frais généraux', en: 'Overhead' },
  freight: { fr: 'Transport', en: 'Freight' },
};

/* ---------------------------------------------------------------- geometry */

/** Geometry assumptions in mm (code constants, flagged provisional in the trace). */
const GLUE = 15; // glue flap on a tuck or sleeve
const TUCK = 30; // tuck / lock flaps
const RSC_GLUE = 35; // glue flap on corrugated
const BOARD = 2; // rigid board thickness
const WRAP = 25; // rigid wrap allowance on each side

interface PieceGeom {
  name: Bi;
  wF: Bi;
  hF: Bi;
  w: number;
  h: number;
  perUnit: number;
}

const GLUE_FR = 'colle';
const GLUE_EN = 'glue';

/** Flat blanks per style family (mm). Empty for co-packing or zero dimensions. */
function geometry(sp: PackagingSpec): PieceGeom[] {
  const L = sp.lengthMm;
  const W = sp.widthMm;
  const H = sp.heightMm;
  if (sp.type === 'copacking' || !(L > 0 && W > 0 && H > 0)) return [];
  const t = BOARD;
  const wr = 2 * WRAP;
  const p = (name: Bi, wF: Bi, hF: Bi, w: number, h: number, perUnit = 1): PieceGeom => ({ name, wF, hF, w, h, perUnit });
  const tuckW: Bi = { fr: `2 × L + 2 × W + ${GLUE} ${GLUE_FR}`, en: `2 × L + 2 × W + ${GLUE} ${GLUE_EN}` };
  const rscW: Bi = { fr: `2 × L + 2 × W + ${RSC_GLUE} ${GLUE_FR}`, en: `2 × L + 2 × W + ${RSC_GLUE} ${GLUE_EN}` };
  const rscH: Bi = { fr: 'H + W (rabats)', en: 'H + W (flaps)' };
  const trayW: Bi = { fr: `L + 2 × H + ${GLUE} ${GLUE_FR}`, en: `L + 2 × H + ${GLUE} ${GLUE_EN}` };
  const trayH: Bi = { fr: `W + 2 × H + ${GLUE} ${GLUE_FR}`, en: `W + 2 × H + ${GLUE} ${GLUE_EN}` };
  const TRAY: Bi = { fr: 'Plateau', en: 'Tray' };
  const BODY: Bi = { fr: 'Corps', en: 'Body' };
  const HEADER: Bi = { fr: 'Bandeau d’en-tête', en: 'Header card' };
  const BASE: Bi = { fr: 'Socle', en: 'Base' };
  const LID: Bi = { fr: 'Couvercle', en: 'Lid' };
  const BOARD_W = (n: string): Bi => ({ fr: `${n} + 2 × épaisseur + 2 × recouvrement`, en: `${n} + 2 × thickness + 2 × wrap` });

  switch (sp.type) {
    case 'folding':
      if (sp.style === 'ECMA F42') return [p(TRAY, trayW, trayH, L + 2 * H + GLUE, W + 2 * H + GLUE)];
      if (sp.style === 'ECMA C10')
        return [p({ fr: 'Manchon', en: 'Sleeve' }, tuckW, { fr: 'H', en: 'H' }, 2 * L + 2 * W + GLUE, H)];
      if (sp.style === 'ECMA A60.20.00.01')
        return [
          p({ fr: 'Fond automatique', en: 'Auto-lock bottom' }, tuckW,
            { fr: `H + 2 × W + 40 (fond)`, en: `H + 2 × W + 40 (bottom)` }, 2 * L + 2 * W + GLUE, H + 2 * W + 40),
        ];
      return [
        p({ fr: 'Boîte pliante', en: 'Folding carton' }, tuckW,
          { fr: `H + 2 × W + ${TUCK} (rabats)`, en: `H + 2 × W + ${TUCK} (tuck flaps)` }, 2 * L + 2 * W + GLUE, H + 2 * W + TUCK),
      ];

    case 'corrugated':
      if (sp.style === 'FEFCO 0427')
        return [
          p({ fr: 'Boîte postale', en: 'Mailer' },
            { fr: `2 × L + 2 × W + 20 ${GLUE_FR}`, en: `2 × L + 2 × W + 20 ${GLUE_EN}` },
            { fr: `H + W + ${TUCK} (rabats)`, en: `H + W + ${TUCK} (tuck flaps)` }, 2 * L + 2 * W + 20, H + W + TUCK),
        ];
      if (sp.style === 'FEFCO 0300') {
        const lidD = Math.max(30, Math.round(H * 0.4));
        return [
          p(TRAY, rscW, rscH, 2 * L + 2 * W + RSC_GLUE, H + W),
          p(LID, { fr: `2 × (L + 4) + 2 × (W + 4) + ${RSC_GLUE} ${GLUE_FR}`, en: `2 × (L + 4) + 2 × (W + 4) + ${RSC_GLUE} ${GLUE_EN}` },
            { fr: `max(30 ; 0,4 × H) + W + 4`, en: `max(30 ; 0.4 × H) + W + 4` },
            2 * (L + 4) + 2 * (W + 4) + RSC_GLUE, lidD + W + 4),
        ];
      }
      if (sp.style === 'FEFCO 0711')
        return [p({ fr: 'Fond crash-lock', en: 'Crash-lock bottom' }, rscW, { fr: 'H + W + 20 (fond)', en: 'H + W + 20 (bottom)' }, 2 * L + 2 * W + RSC_GLUE, H + W + 20)];
      return [p({ fr: 'Caisse américaine', en: 'Regular slotted container' }, rscW, rscH, 2 * L + 2 * W + RSC_GLUE, H + W)];

    case 'rigid': {
      if (sp.style === 'RIG-MAG')
        return [
          p({ fr: 'Couvertures (2)', en: 'Covers (2)' }, BOARD_W('L'), BOARD_W('W'), L + 2 * t + wr, W + 2 * t + wr, 2),
          p({ fr: 'Dos', en: 'Spine' }, BOARD_W('H'), BOARD_W('W'), H + 2 * t + wr, W + 2 * t + wr),
        ];
      if (sp.style === 'RIG-DRAW')
        return [
          p(TRAY, { fr: `L + 2 × épaisseur + 2 × H + 50`, en: `L + 2 × thickness + 2 × H + 50` },
            { fr: `W + 2 × épaisseur + 2 × H + 50`, en: `W + 2 × thickness + 2 × H + 50` }, L + 2 * t + 2 * H + wr, W + 2 * t + 2 * H + wr),
          p({ fr: 'Tiroir (fourreau)', en: 'Drawer sleeve' }, { fr: '2 × (L + 2 × épaisseur) + 2 × (W + 2 × épaisseur) + 50', en: '2 × (L + 2 × thickness) + 2 × (W + 2 × thickness) + 50' },
            { fr: 'H + 2 × épaisseur + 50', en: 'H + 2 × thickness + 50' }, 2 * (L + 2 * t) + 2 * (W + 2 * t) + wr, H + 2 * t + wr),
        ];
      // RIG-LID (default): base + lid, the lid is a tray that slides over the base.
      const D = H + 2 * t;
      return [
        p(BASE, { fr: `L + 2 × épaisseur + 2 × H + 50`, en: `L + 2 × thickness + 2 × H + 50` },
          { fr: `W + 2 × épaisseur + 2 × H + 50`, en: `W + 2 × thickness + 2 × H + 50` }, L + 2 * t + 2 * H + wr, W + 2 * t + 2 * H + wr),
        p(LID, { fr: `L + 2 × épaisseur + 2 × (H + 2 × épaisseur) + 50`, en: `L + 2 × thickness + 2 × (H + 2 × thickness) + 50` },
          { fr: `W + 2 × épaisseur + 2 × (H + 2 × épaisseur) + 50`, en: `W + 2 × thickness + 2 × (H + 2 × thickness) + 50` },
          L + 2 * t + 2 * D + wr, W + 2 * t + 2 * D + wr),
      ];
    }

    case 'display': {
      const hdr = p(HEADER, { fr: 'L + 20', en: 'L + 20' }, { fr: '0,5 × H + 30', en: '0.5 × H + 30' }, L + 20, 0.5 * H + 30);
      if (sp.style === 'DSP-PDQ') return [p(TRAY, trayW, trayH, L + 2 * H + GLUE, W + 2 * H + GLUE)];
      if (sp.style === 'DSP-FLR')
        return [
          p(BODY, rscW, rscH, 2 * L + 2 * W + RSC_GLUE, H + W),
          hdr,
          p(BASE, { fr: 'L + 20', en: 'L + 20' }, { fr: 'W + 20', en: 'W + 20' }, L + 20, W + 20),
        ];
      // DSP-CTR (counter) and default
      return [p(BODY, rscW, rscH, 2 * L + 2 * W + RSC_GLUE, H + W), hdr];
    }

    default:
      return [];
  }
}

/** Flat area in m² of one unit, all pieces included (kept for existing callers). */
export function blankAreaM2(spec: PackagingSpec): number {
  return geometry(spec).reduce((a, g) => a + (g.w * g.h * g.perUnit) / 1e6, 0);
}

/* ---------------------------------------------------------------- layout */

export interface PieceLayout {
  name: Bi;
  w: number;
  h: number;
  perUnit: number;
  /** Pieces of this blank per sheet (at least 1). */
  ups: number;
  /** False when the blank does not fit the sheet (then one piece per sheet is assumed). */
  fits: boolean;
}

interface Layout {
  pieces: PieceLayout[];
  sheetW: number;
  sheetH: number;
  sheetAreaM2: number;
}

/** Pieces per sheet, trying both orientations. */
function nUp(pw: number, ph: number, uw: number, uh: number, gap: number): number {
  const fit = (a: number, b: number) => Math.max(0, Math.floor((uw + gap) / (a + gap))) * Math.max(0, Math.floor((uh + gap) / (b + gap)));
  return Math.max(fit(pw, ph), fit(ph, pw));
}

function build(sp: PackagingSpec, s: S, material?: Material): { layout: Layout; steps: TraceStep[] } {
  const pv = (g: string) => s.validated[g] !== 'confirmed';
  const matSheetW = material?.sheetWidthMm && material.sheetWidthMm > 0 ? material.sheetWidthMm : undefined;
  const matSheetH = material?.sheetHeightMm && material.sheetHeightMm > 0 ? material.sheetHeightMm : undefined;
  const sheetW = matSheetW ?? s.sheetWidthMm;
  const sheetH = matSheetH ?? s.sheetHeightMm;
  const grip = s.gripperMarginMm;
  const gap = s.gutterMm;
  const uw = Math.max(0, sheetW - 2 * grip);
  const uh = Math.max(0, sheetH - 2 * grip);
  const geoms = geometry(sp);
  const steps: TraceStep[] = [];
  const sheetSource: TraceInput['source'] = matSheetW || matSheetH ? 'material' : 'setting';
  const sheetLabel = matSheetW || matSheetH ? { fr: ' (matériau)', en: ' (material)' } : { fr: ' (réglage)', en: ' (setting)' };

  if (!geoms.length) {
    steps.push(
      mk('blank', { fr: 'Flan', en: 'Blank' }, { fr: 'Pas de flan à découper', en: 'No blank to cut' },
        [inp({ fr: 'Longueur', en: 'Length' }, sp.lengthMm, 'mm', 'spec'), inp({ fr: 'Largeur', en: 'Width' }, sp.widthMm, 'mm', 'spec'), inp({ fr: 'Hauteur', en: 'Height' }, sp.heightMm, 'mm', 'spec')],
        0, 'm²', false, { fr: 'Co-packing ou dimensions nulles : pas de matière calculée.', en: 'Co-packing or zero dimensions: no material calculated.' }),
    );
  }

  const pieces: PieceLayout[] = geoms.map((g) => {
    const n = nUp(g.w, g.h, uw, uh, gap);
    return { name: g.name, w: g.w, h: g.h, perUnit: g.perUnit, ups: Math.max(1, n), fits: n > 0 };
  });

  geoms.forEach((g, i) => {
    const pc = pieces[i];
    const common = [
      inp({ fr: 'Longueur', en: 'Length' }, sp.lengthMm, 'mm', 'spec'),
      inp({ fr: 'Largeur', en: 'Width' }, sp.widthMm, 'mm', 'spec'),
      inp({ fr: 'Hauteur', en: 'Height' }, sp.heightMm, 'mm', 'spec'),
    ];
    steps.push(
      mk(
        `blank-${i}`,
        { fr: `Flan à plat : ${g.name.fr}`, en: `Flat blank: ${g.name.en}` },
        { fr: `Surface = (${g.wF.fr}) × (${g.hF.fr})`, en: `Area = (${g.wF.en}) × (${g.hF.en})` },
        [
          ...common,
          inp({ fr: 'Largeur à plat', en: 'Flat width' }, pc.w, 'mm', 'derived'),
          inp({ fr: 'Hauteur à plat', en: 'Flat height' }, pc.h, 'mm', 'derived'),
          inp({ fr: 'Pièces de ce flan par unité', en: 'Pieces of this blank per unit' }, pc.perUnit, '', 'derived'),
        ],
        (pc.w * pc.h * pc.perUnit) / 1e6,
        'm²',
        true,
        { fr: 'Marges de collage, rabats et recouvrement : hypothèses de forme standard, à valider avec le studio.', en: 'Glue, flap and wrap allowances: standard shape assumptions, to validate with the studio.' },
      ),
    );
    steps.push(
      mk(
        `layout-${i}`,
        { fr: `Pièces par feuille : ${g.name.fr}`, en: `Pieces per sheet: ${g.name.en}` },
        {
          fr: `Pièces = ⌊(feuille L − 2 × pince + intervalle) ÷ (flan L + intervalle)⌋ × ⌊(feuille H − 2 × pince + intervalle) ÷ (flan H + intervalle)⌋, le plus grand entre les deux sens`,
          en: `Pieces = ⌊(sheet W − 2 × gripper + gap) ÷ (blank W + gap)⌋ × ⌊(sheet H − 2 × gripper + gap) ÷ (blank H + gap)⌋, best of both orientations`,
        },
        [
          inp({ fr: 'Feuille, largeur', en: 'Sheet width' }, sheetW, 'mm', sheetSource),
          inp({ fr: 'Feuille, hauteur', en: 'Sheet height' }, sheetH, 'mm', sheetSource),
          inp({ fr: 'Pince (marge de prise)', en: 'Gripper margin' }, grip, 'mm', 'setting'),
          inp({ fr: 'Intervalle entre pièces', en: 'Gap between pieces' }, gap, 'mm', 'setting'),
          inp({ fr: 'Flan, largeur', en: 'Blank width' }, pc.w, 'mm', 'derived'),
          inp({ fr: 'Flan, hauteur', en: 'Blank height' }, pc.h, 'mm', 'derived'),
          inp({ fr: 'Feuille utilisable', en: 'Usable sheet area' }, (uw * uh) / 1e6, 'm²', 'derived'),
        ],
        pc.ups,
        'pièces/feuille',
        pv('materials'),
        pc.fits
          ? { fr: `Format de feuille${sheetLabel.fr}.`, en: `Sheet size${sheetLabel.en}.` }
          : { fr: 'Le flan ne rentre pas sur la feuille : une feuille par pièce, à vérifier.', en: 'The blank does not fit the sheet: one piece per sheet, to check.' },
      ),
    );
  });

  return {
    layout: { pieces, sheetW, sheetH, sheetAreaM2: fin((sheetW * sheetH) / 1e6) },
    steps,
  };
}

/** Geometry and layout steps for a spec (blank size, pieces per sheet). Shared by every quantity. */
export function explainBlank(spec: PackagingSpec, settings: Partial<EstimatingSettings> | null | undefined, material?: Material): TraceStep[] {
  return build(spec, resolveSettings(settings) as S, material).steps;
}

/* ---------------------------------------------------------------- margin */

/**
 * Suggested margin for a product type and quantity (margin by type first, then the highest quantity tier reached,
 * then the default). The estimate keeps its own margin; this helps the estimator choose it.
 */
export function suggestedMarginPct(settings: Partial<EstimatingSettings> | null | undefined, type: PackagingType, quantity: number): number {
  const s = resolveSettings(settings) as S;
  const byType = s.marginByType[type];
  if (typeof byType === 'number') return byType;
  const tier = [...s.marginTiers].filter((t) => quantity >= t.minQty).sort((a, b) => a.minQty - b.minQty).pop();
  return tier ? tier.marginPct : s.defaultMarginPct;
}

/* ---------------------------------------------------------------- pricing */

/** Waste (%) for a quantity: the first curve step that covers it (the last step applies above all of them). */
function wasteStep(curve: S['wasteCurve'], q: number) {
  const sorted = [...curve].sort((a, b) => a.upToQty - b.upToQty);
  return sorted.find((w) => q <= w.upToQty) ?? sorted[sorted.length - 1];
}

export function priceBreaks(
  spec: PackagingSpec,
  quantities: number[],
  marginPct: number,
  material: Material | undefined,
  settings: EstimatingSettings,
): QuantityPrice[] {
  const s = resolveSettings(settings) as S;
  const pv = (g: string) => s.validated[g] !== 'confirmed';
  const { layout, steps: shared } = build(spec, s, material);
  const pieces = layout.pieces;
  const procKey: PressType = spec.printProcess === 'none' ? 'offset' : spec.printProcess;
  const pr = s.pressRates[procKey];
  const units = Math.max(1, pr.units);
  const cOut = spec.printProcess === 'none' ? 0 : Math.max(0, Math.round(spec.colorsOutside) || 0);
  const cIn = spec.printProcess === 'none' ? 0 : Math.max(0, Math.round(spec.colorsInside) || 0);
  const colors = cOut + cIn;
  const passes = (cOut ? Math.ceil(cOut / units) : 0) + (cIn ? Math.ceil(cIn / units) : 0);
  const m = Math.min(90, Math.max(0, Number.isFinite(marginPct) ? marginPct : 0));
  const matCost = material?.costPerM2 ?? 0;
  const sheetCost = layout.sheetAreaM2 * matCost;
  const type = spec.type;
  const isDieCut = type === 'folding' || type === 'corrugated' || type === 'display';
  const isGlued = isDieCut;
  const hasNoPrint = spec.printProcess === 'none';
  const finishKeys = spec.finishes;
  const optSec = spec.options.reduce((a, o) => a + (s.optionSeconds[o] ?? 0), 0);
  const styleSec = s.styleAssemblySeconds[spec.style] ?? 0;
  const extraParts = Math.max(0, pieces.length - 1);
  const noDims = spec.type !== 'copacking' && !(spec.lengthMm > 0 && spec.widthMm > 0 && spec.heightMm > 0);
  const ALL_KEYS: CostKey[] = ['material', 'print', 'tooling', 'finishing', 'labor', 'assembly', 'overhead', 'freight'];

  return quantities
    .filter((q) => Number.isFinite(q) && q > 0)
    .map((q) => {
      if (noDims) {
        // No usable size: nothing to price. Return zeros rather than labour on an unknown product.
        const zeroLines = ALL_KEYS.map((key) => ({ key, amount: 0 }));
        return {
          quantity: q,
          lines: zeroLines,
          cost: 0,
          price: 0,
          unitPrice: 0,
          margin: 0,
          marginPct: m,
          trace: [
            ...shared,
            mk('dims', { fr: 'Dimensions manquantes', en: 'Missing dimensions' }, { fr: 'Aucun calcul : longueur, largeur et hauteur doivent être supérieures à 0', en: 'Nothing calculated: length, width and height must be greater than 0' }, [
              inp({ fr: 'Longueur', en: 'Length' }, spec.lengthMm, 'mm', 'spec'),
              inp({ fr: 'Largeur', en: 'Width' }, spec.widthMm, 'mm', 'spec'),
              inp({ fr: 'Hauteur', en: 'Height' }, spec.heightMm, 'mm', 'spec'),
            ], 0, '$', false),
          ],
        };
      }
      const trace: TraceStep[] = [...shared];

      /* 1. Waste and sheets */
      const ws = wasteStep(s.wasteCurve, q);
      const wastePct = ws ? ws.pct : 0;
      trace.push(
        mk(
          'waste',
          { fr: 'Gâche selon la quantité', en: 'Waste for this quantity' },
          { fr: 'Gâche = pourcentage du palier de quantité qui couvre la commande', en: 'Waste = percentage of the quantity step that covers the order' },
          [
            inp({ fr: 'Quantité', en: 'Quantity' }, q, 'unités', 'spec'),
            inp({ fr: 'Palier jusqu’à', en: 'Step up to' }, ws ? ws.upToQty : 0, 'unités', 'setting'),
            inp({ fr: 'Gâche du palier', en: 'Waste of the step' }, wastePct, '%', 'setting'),
          ],
          wastePct,
          '%',
          pv('materials'),
        ),
      );

      const sheets = pieces.map((pc) => (pc.ups > 0 ? Math.ceil((q * pc.perUnit * (1 + wastePct / 100)) / pc.ups) : 0));
      pieces.forEach((pc, i) => {
        trace.push(
          mk(
            `sheets-${i}`,
            { fr: `Feuilles à imprimer : ${pc.name.fr}`, en: `Sheets to run: ${pc.name.en}` },
            { fr: 'Feuilles = ⌈ quantité × pièces par unité × (1 + gâche) ÷ pièces par feuille ⌉', en: 'Sheets = ⌈ quantity × pieces per unit × (1 + waste) ÷ pieces per sheet ⌉' },
            [
              inp({ fr: 'Quantité', en: 'Quantity' }, q, 'unités', 'spec'),
              inp({ fr: 'Pièces par unité', en: 'Pieces per unit' }, pc.perUnit, '', 'derived'),
              inp({ fr: 'Gâche', en: 'Waste' }, wastePct, '%', 'setting'),
              inp({ fr: 'Pièces par feuille', en: 'Pieces per sheet' }, pc.ups, '', 'derived'),
            ],
            sheets[i],
            'feuilles',
            pv('materials'),
          ),
        );
      });
      const printedSheets = sheets.reduce((a, b) => a + b, 0);
      const mrSheets = hasNoPrint ? 0 : colors * pr.makeReadySheetsPerColor * pieces.length;
      const totalSheets = printedSheets + mrSheets;

      trace.push(
        mk(
          'makeready-sheets',
          { fr: 'Feuilles de mise en train', en: 'Make-ready sheets' },
          { fr: 'Feuilles perdues = couleurs × feuilles par couleur × nombre de pièces', en: 'Lost sheets = colours × sheets per colour × number of pieces' },
          [
            inp({ fr: 'Couleurs', en: 'Colours' }, colors, '', 'spec'),
            inp({ fr: 'Feuilles par couleur', en: 'Sheets per colour' }, pr.makeReadySheetsPerColor, 'feuilles', 'setting'),
            inp({ fr: 'Pièces', en: 'Pieces' }, pieces.length, '', 'derived'),
          ],
          mrSheets,
          'feuilles',
          pv('printing'),
        ),
      );

      /* 2. Material */
      const material$ = totalSheets * sheetCost;
      trace.push(
        mk(
          'material',
          { fr: 'Coût matière', en: 'Material cost' },
          { fr: 'Matière = (feuilles imprimées + feuilles de mise en train) × (L × H de la feuille ÷ 1 000 000) × prix au m²', en: 'Material = (printed sheets + make-ready sheets) × (sheet W × H ÷ 1,000,000) × price per m²' },
          [
            inp({ fr: 'Feuilles au total', en: 'Total sheets' }, totalSheets, 'feuilles', 'derived'),
            inp({ fr: 'Surface de la feuille', en: 'Sheet area' }, layout.sheetAreaM2, 'm²', 'derived'),
            inp({ fr: 'Prix du matériau', en: 'Material price' }, matCost, '$/m²', material ? 'material' : 'default'),
          ],
          material$,
          '$',
          pv('materials') || !material,
          material
            ? undefined
            : { fr: 'Aucun matériau choisi : coût matière à 0.', en: 'No material selected: material cost is 0.' },
        ),
      );

      /* 3. Print */
      const runH = div(printedSheets * passes, pr.sheetsPerHour);
      const mrH = (colors * pr.makeReadyMinPerColor) / 60;
      const press$ = (runH + mrH) * pr.hourlyRate;
      trace.push(
        mk(
          'press',
          { fr: 'Presse : mise en train et passages', en: 'Press: make-ready and runs' },
          { fr: 'Coût presse = (heures de passage + heures de mise en train) × taux horaire ; passages = ⌈couleurs ÷ unités⌉ par face', en: 'Press cost = (run hours + make-ready hours) × hourly rate ; passes = ⌈colours ÷ units⌉ per side' },
          [
            inp({ fr: 'Procédé', en: 'Process' }, procKey === 'offset' ? 'Offset' : procKey === 'flexo' ? 'Flexo' : 'Numérique', '', 'spec'),
            inp({ fr: 'Feuilles imprimées', en: 'Printed sheets' }, printedSheets, 'feuilles', 'derived'),
            inp({ fr: 'Passages', en: 'Passes' }, passes, '', 'derived'),
            inp({ fr: 'Vitesse de la presse', en: 'Press speed' }, pr.sheetsPerHour, 'feuilles/h', 'setting'),
            inp({ fr: 'Heures de passage', en: 'Run hours' }, runH, 'h', 'derived'),
            inp({ fr: 'Mise en train par couleur', en: 'Make-ready per colour' }, pr.makeReadyMinPerColor, 'min', 'setting'),
            inp({ fr: 'Heures de mise en train', en: 'Make-ready hours' }, mrH, 'h', 'derived'),
            inp({ fr: 'Taux horaire presse', en: 'Press hourly rate' }, pr.hourlyRate, '$/h', 'setting'),
          ],
          press$,
          '$',
          pv('printing'),
          hasNoPrint ? { fr: 'Sans impression : aucun coût de presse.', en: 'No print: no press cost.' } : undefined,
        ),
      );
      const plates$ = colors * pieces.length * pr.platePerColor;
      trace.push(
        mk(
          'plates',
          { fr: 'Plaques', en: 'Plates' },
          { fr: 'Plaques = couleurs × pièces × prix de plaque', en: 'Plates = colours × pieces × plate price' },
          [
            inp({ fr: 'Couleurs', en: 'Colours' }, colors, '', 'spec'),
            inp({ fr: 'Pièces', en: 'Pieces' }, pieces.length, '', 'derived'),
            inp({ fr: 'Prix par plaque', en: 'Price per plate' }, pr.platePerColor, '$', 'setting'),
          ],
          plates$,
          '$',
          pv('printing'),
        ),
      );
      const ink$ = printedSheets * colors * pr.inkPerSheetPerColor;
      trace.push(
        mk(
          'ink',
          { fr: 'Encres et toner', en: 'Ink and toner' },
          { fr: 'Encre = feuilles imprimées × couleurs × coût par feuille et par couleur', en: 'Ink = printed sheets × colours × cost per sheet and colour' },
          [
            inp({ fr: 'Feuilles imprimées', en: 'Printed sheets' }, printedSheets, 'feuilles', 'derived'),
            inp({ fr: 'Couleurs', en: 'Colours' }, colors, '', 'spec'),
            inp({ fr: 'Coût par feuille et couleur', en: 'Cost per sheet and colour' }, pr.inkPerSheetPerColor, '$', 'setting'),
          ],
          ink$,
          '$',
          pv('printing'),
        ),
      );
      const print$ = press$ + plates$ + ink$;

      /* 4. Tooling (one-time) */
      const dieMult = type === 'rigid' ? 1 : pieces.length;
      const tooling$ = spec.newDie && type !== 'copacking' ? (s.dieCostByType[type] ?? 0) * dieMult : 0;
      trace.push(
        mk(
          'tooling',
          { fr: 'Outillage (forme de découpe)', en: 'Tooling (cutting die)' },
          { fr: 'Outillage = coût de forme × nombre de formes, une seule fois (non lié à la quantité)', en: 'Tooling = die cost × number of dies, once (not per unit)' },
          [
            inp({ fr: 'Nouvelle forme', en: 'New die' }, spec.newDie ? 'Oui' : 'Non', '', 'spec'),
            inp({ fr: 'Coût de forme', en: 'Die cost' }, s.dieCostByType[type] ?? 0, '$', 'setting'),
            inp({ fr: 'Nombre de formes', en: 'Number of dies' }, dieMult, '', 'derived'),
          ],
          tooling$,
          '$',
          pv('tooling'),
          spec.newDie ? undefined : { fr: 'Forme existante : aucun outillage facturé.', en: 'Existing die: no tooling charged.' },
        ),
      );

      /* 5. Finishing */
      const finishing$ = finishKeys.reduce((a, k) => {
        const r = s.finishRates[k] ?? { setup: s.finishSetup, perThousand: s.finishRunUnit * 1000 };
        return a + r.setup + (r.perThousand * q) / 1000;
      }, 0);
      trace.push(
        mk(
          'finishing',
          { fr: 'Finitions', en: 'Finishing' },
          { fr: 'Finition = Σ (mise en train + coût par 1 000 × quantité ÷ 1 000)', en: 'Finishing = Σ (set-up + cost per 1,000 × quantity ÷ 1,000)' },
          finishKeys.length
            ? finishKeys.flatMap((k) => {
                const r = s.finishRates[k] ?? { setup: s.finishSetup, perThousand: s.finishRunUnit * 1000 };
                const nm = FINISH_NAMES[k] ?? { fr: k, en: k };
                return [
                  inp({ fr: `${nm.fr} : mise en train`, en: `${nm.en}: set-up` }, r.setup, '$', 'setting'),
                  inp({ fr: `${nm.fr} : par 1 000`, en: `${nm.en}: per 1,000` }, r.perThousand, '$', 'setting'),
                ];
              })
            : [inp({ fr: 'Finitions choisies', en: 'Finishes chosen' }, 0, '', 'spec')],
          finishing$,
          '$',
          pv('finishing'),
          finishKeys.length ? undefined : { fr: 'Aucune finition.', en: 'No finishing.' },
        ),
      );

      /* 6. Converting (die-cut run, gluing, packing) */
      const dieCut$ = isDieCut ? div(printedSheets, s.dieCutSheetsPerHour[type]) * s.dieCutHourlyRate : 0;
      trace.push(
        mk(
          'diecut',
          { fr: 'Découpe à la presse à découper', en: 'Die-cutting run' },
          { fr: 'Découpe = feuilles ÷ cadence × taux horaire de découpe', en: 'Die-cut = sheets ÷ speed × hourly rate' },
          [
            inp({ fr: 'Feuilles découpées', en: 'Sheets die-cut' }, printedSheets, 'feuilles', 'derived'),
            inp({ fr: 'Cadence de découpe', en: 'Die-cutter speed' }, s.dieCutSheetsPerHour[type] ?? 0, 'feuilles/h', 'setting'),
            inp({ fr: 'Taux horaire de découpe', en: 'Die-cutter hourly rate' }, s.dieCutHourlyRate, '$/h', 'setting'),
          ],
          dieCut$,
          '$',
          pv('tooling'),
          isDieCut ? undefined : { fr: 'Pas de découpe à la presse pour ce type (rigide ou co-packing).', en: 'No die-cut run for this type (rigid or co-packing).' },
        ),
      );
      const gluing$ = isGlued ? div(q, s.gluerUnitsPerHour) * s.machineHourlyRate : 0;
      trace.push(
        mk(
          'gluing',
          { fr: 'Collage à la colleuse', en: 'Gluing on the gluer' },
          { fr: 'Collage = quantité ÷ cadence de la colleuse × taux machine', en: 'Gluing = quantity ÷ gluer output × machine rate' },
          [
            inp({ fr: 'Quantité', en: 'Quantity' }, q, 'unités', 'spec'),
            inp({ fr: 'Cadence de la colleuse', en: 'Gluer output' }, s.gluerUnitsPerHour, 'unités/h', 'setting'),
            inp({ fr: 'Taux machine', en: 'Machine rate' }, s.machineHourlyRate, '$/h', 'setting'),
          ],
          gluing$,
          '$',
          pv('labour'),
          isGlued ? undefined : { fr: 'Pas de collage machine pour ce type.', en: 'No machine gluing for this type.' },
        ),
      );
      const packing$ = q * (s.packingSecondsPerUnit / 3600) * s.assemblyRatePerHour;
      trace.push(
        mk(
          'packing',
          { fr: 'Emballage et comptage', en: 'Packing and counting' },
          { fr: 'Emballage = quantité × secondes par unité ÷ 3 600 × taux opérateur', en: 'Packing = quantity × seconds per unit ÷ 3,600 × operator rate' },
          [
            inp({ fr: 'Quantité', en: 'Quantity' }, q, 'unités', 'spec'),
            inp({ fr: 'Secondes par unité', en: 'Seconds per unit' }, s.packingSecondsPerUnit, 's', 'setting'),
            inp({ fr: 'Taux opérateur', en: 'Operator rate' }, s.assemblyRatePerHour, '$/h', 'setting'),
          ],
          packing$,
          '$',
          pv('labour'),
        ),
      );
      const labor$ = dieCut$ + gluing$ + packing$;

      /* 7. Hand assembly */
      const secsPerUnit = styleSec + extraParts * s.secondsPerExtraPart + optSec;
      const assembly$ = q * (secsPerUnit / 3600) * s.assemblyRatePerHour;
      trace.push(
        mk(
          'assembly',
          { fr: 'Assemblage manuel (présentoir, kit, options)', en: 'Hand assembly (display, kit, options)' },
          { fr: 'Assemblage = quantité × (temps de base + pièces en plus × temps + temps des options) ÷ 3 600 × taux opérateur', en: 'Assembly = quantity × (base time + extra parts × time + option time) ÷ 3,600 × operator rate' },
          [
            inp({ fr: 'Quantité', en: 'Quantity' }, q, 'unités', 'spec'),
            inp({ fr: 'Temps de base du style', en: 'Base time for the style' }, styleSec, 's/unité', 'setting'),
            inp({ fr: 'Pièces en plus', en: 'Extra parts' }, extraParts, '', 'derived'),
            inp({ fr: 'Temps par pièce en plus', en: 'Time per extra part' }, s.secondsPerExtraPart, 's', 'setting'),
            inp({ fr: 'Temps des options', en: 'Option time' }, optSec, 's/unité', 'setting'),
            inp({ fr: 'Temps total', en: 'Total time' }, secsPerUnit, 's/unité', 'derived'),
            inp({ fr: 'Taux opérateur', en: 'Operator rate' }, s.assemblyRatePerHour, '$/h', 'setting'),
          ],
          assembly$,
          '$',
          pv('labour'),
          secsPerUnit > 0 ? undefined : { fr: 'Pas d’assemblage manuel pour ce style.', en: 'No hand assembly for this style.' },
        ),
      );

      /* 8. Overhead, freight, cost, margin, unit price */
      const direct = material$ + print$ + tooling$ + finishing$ + labor$ + assembly$;
      const overhead$ = (direct * s.overheadPct) / 100;
      trace.push(
        mk(
          'overhead',
          { fr: 'Frais généraux', en: 'Overhead' },
          { fr: 'Frais généraux = coûts directs × pourcentage de frais généraux', en: 'Overhead = direct costs × overhead %' },
          [
            inp({ fr: 'Coûts directs', en: 'Direct costs' }, direct, '$', 'derived'),
            inp({ fr: 'Frais généraux', en: 'Overhead' }, s.overheadPct, '%', 'setting'),
          ],
          overhead$,
          '$',
          pv('overhead'),
        ),
      );
      const freight$ = ((direct + overhead$) * s.freightPct) / 100;
      trace.push(
        mk(
          'freight',
          { fr: 'Transport', en: 'Freight' },
          { fr: 'Transport = (coûts directs + frais généraux) × pourcentage de transport', en: 'Freight = (direct costs + overhead) × freight %' },
          [
            inp({ fr: 'Coûts directs + frais généraux', en: 'Direct costs + overhead' }, direct + overhead$, '$', 'derived'),
            inp({ fr: 'Transport', en: 'Freight' }, s.freightPct, '%', 'setting'),
          ],
          freight$,
          '$',
          pv('overhead'),
        ),
      );

      const lines: CostLine[] = [
        { key: 'material', amount: fin(material$) },
        { key: 'print', amount: fin(print$) },
        { key: 'tooling', amount: fin(tooling$) },
        { key: 'finishing', amount: fin(finishing$) },
        { key: 'labor', amount: fin(labor$) },
        { key: 'assembly', amount: fin(assembly$) },
        { key: 'overhead', amount: fin(overhead$) },
        { key: 'freight', amount: fin(freight$) },
      ];
      const cost = lines.reduce((a, l) => a + l.amount, 0);
      trace.push(
        mk(
          'cost',
          { fr: 'Coût total (somme de toutes les lignes)', en: 'Total cost (sum of all lines)' },
          { fr: 'Coût total = matériaux + impression + outillage + finition + transformation + assemblage + frais généraux + transport', en: 'Total cost = material + printing + tooling + finishing + converting + assembly + overhead + freight' },
          lines.map((l) => inp(LINE_LABEL[l.key], l.amount, '$', 'derived')),
          cost,
          '$',
          false,
        ),
      );

      const price = m >= 90 ? cost : cost / (1 - m / 100);
      const margin = price - cost;
      trace.push(
        mk(
          'margin',
          { fr: 'Marge et prix de vente', en: 'Margin and selling price' },
          { fr: 'Prix = coût total ÷ (1 − marge %) ; marge $ = prix − coût', en: 'Price = total cost ÷ (1 − margin %) ; margin $ = price − cost' },
          [
            inp({ fr: 'Coût total', en: 'Total cost' }, cost, '$', 'derived'),
            inp({ fr: 'Marge appliquée', en: 'Margin applied' }, m, '%', 'spec'),
            inp({ fr: 'Marge en $', en: 'Margin in $' }, margin, '$', 'derived'),
          ],
          price,
          '$',
          false,
          m >= 90 ? { fr: 'Marge plafonnée à 90 % : prix = coût.', en: 'Margin capped at 90%: price = cost.' } : undefined,
        ),
      );
      const unitPrice = q > 0 ? price / q : 0;
      trace.push(
        mk(
          'unit',
          { fr: 'Prix unitaire', en: 'Unit price' },
          { fr: 'Prix unitaire = prix de vente ÷ quantité', en: 'Unit price = selling price ÷ quantity' },
          [
            inp({ fr: 'Prix de vente', en: 'Selling price' }, price, '$', 'derived'),
            inp({ fr: 'Quantité', en: 'Quantity' }, q, 'unités', 'spec'),
          ],
          unitPrice,
          '$/unité',
          false,
        ),
      );

      return {
        quantity: q,
        lines,
        cost: fin(cost),
        price: fin(price),
        unitPrice: fin(unitPrice),
        margin: fin(margin),
        marginPct: m,
        trace,
      };
    });
}
