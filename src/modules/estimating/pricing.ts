/**
 * ⚠ PROVISIONAL COST MODEL — placeholder so the layout shows realistic numbers.
 * The real pricing rules (per style, press, make-ready, waste curves, labour rates…)
 * will be supplied by the estimating team and replace this file.
 */
import type { EstimatingSettings, Material, PackagingSpec } from './types';

export interface CostLine {
  key: 'material' | 'print' | 'tooling' | 'finishing' | 'labor' | 'freight';
  amount: number;
}

export interface QuantityPrice {
  quantity: number;
  lines: CostLine[];
  cost: number;
  price: number;
  unitPrice: number;
  margin: number;
}

/** Approximate flat blank (sheet) area in m² for one unit. */
export function blankAreaM2(s: PackagingSpec): number {
  const { lengthMm: L, widthMm: W, heightMm: H } = s;
  let wMm: number, hMm: number;
  switch (s.type) {
    case 'corrugated':
      wMm = 2 * L + 2 * W + 35; // glue flap
      hMm = H + W; // top + bottom flaps
      break;
    case 'rigid':
      wMm = L + 2 * H + 40;
      hMm = W + 2 * H + 40;
      return ((wMm * hMm) / 1e6) * 2.2; // lid + base + wrap
    case 'display':
      wMm = 2 * L + 2 * W;
      hMm = H * 1.8;
      break;
    case 'copacking':
      return 0;
    default: // folding carton
      wMm = 2 * L + 2 * W + 15;
      hMm = H + 2 * W + 30; // tuck flaps
  }
  return (wMm * hMm) / 1e6;
}

export function priceBreaks(
  spec: PackagingSpec,
  quantities: number[],
  marginPct: number,
  material: Material | undefined,
  s: EstimatingSettings,
): QuantityPrice[] {
  const area = blankAreaM2(spec);
  const colors = spec.printProcess === 'none' ? 0 : spec.colorsOutside + spec.colorsInside;
  return quantities
    .filter((q) => q > 0)
    .map((q) => {
      const material$ = area * (material?.costPerM2 ?? 0) * q * (1 + s.wastePct / 100);
      const print$ =
        spec.printProcess === 'digital'
          ? q * area * 1.6 * Math.max(1, colors / 4)
          : colors * s.printSetupPerColor + colors * s.printRunPerColorUnit * q;
      const tooling$ = spec.newDie && spec.type !== 'copacking' ? s.dieCost : 0;
      const finishing$ = spec.finishes.length * (s.finishSetup + s.finishRunUnit * q);
      const labor$ = q * (s.laborPerUnit + spec.options.length * 0.02 + (spec.type === 'copacking' ? 0.25 : 0));
      const sub = material$ + print$ + tooling$ + finishing$ + labor$;
      const freight$ = (sub * s.freightPct) / 100;
      const cost = sub + freight$;
      const price = cost / (1 - marginPct / 100);
      return {
        quantity: q,
        lines: [
          { key: 'material', amount: material$ },
          { key: 'print', amount: print$ },
          { key: 'tooling', amount: tooling$ },
          { key: 'finishing', amount: finishing$ },
          { key: 'labor', amount: labor$ },
          { key: 'freight', amount: freight$ },
        ],
        cost,
        price,
        unitPrice: price / q,
        margin: price - cost,
      };
    });
}
