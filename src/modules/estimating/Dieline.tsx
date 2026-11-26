/**
 * Parametric flat blank (dieline) and box views, drawn as SVG from the packaging spec.
 * Geometry is a first approximation for the estimator: cut lines are solid, creases dashed.
 * All dimensions are millimetres; L = length, W = width, H = height (interior).
 */
import { useId, useRef } from 'react';
import { Download } from 'lucide-react';
import { useI18n } from '@/i18n';
import { blankAreaM2 } from './pricing';
import { styleFamily } from './catalog';
import type { PackagingSpec } from './types';

type Pt = [number, number];
type Seg = [Pt, Pt];
interface Geo {
  w: number;
  h: number;
  cuts: Pt[][];
  folds: Seg[];
  labels: { x: number; y: number; text: string }[];
}

const GLUE = 15;
const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** Folding carton: four panels (front, side, back, side) with a glue flap, tuck flap and bottom dust flaps.
 *  Same overall size as blankAreaM2 for folding cartons: (2L + 2W + 15) × (H + 2W + 30). */
function tuckGeo(L: number, W: number, H: number, lock: boolean): Geo {
  const t = W + GLUE;
  const f = [GLUE, GLUE + L, GLUE + L + W, GLUE + 2 * L + W, GLUE + 2 * L + 2 * W];
  const w = f[4];
  const h = H + 2 * t;
  const cuts: Pt[][] = [rect(0, t, GLUE, H)];
  for (let i = 0; i < 4; i++) cuts.push(rect(f[i], t, f[i + 1] - f[i], H));
  for (const i of [0, 1, 3]) cuts.push(rect(f[i], 0, f[i + 1] - f[i], t));
  for (let i = 0; i < 4; i++) cuts.push(rect(f[i], t + H, f[i + 1] - f[i], t));
  // Tuck flap: narrower at its free edge.
  cuts.push([
    [f[2] + 0.15 * L, 0],
    [f[3] - 0.15 * L, 0],
    [f[3], t],
    [f[2], t],
  ]);
  const folds: Seg[] = [
    [[GLUE, t], [w, t]],
    [[GLUE, t + H], [w, t + H]],
    [[GLUE, t], [GLUE, t + H]],
    ...[f[1], f[2], f[3]].map((x): Seg => [[x, t], [x, t + H]]),
  ];
  if (lock) {
    // Crash-lock tab on the front bottom panel.
    folds.push([[f[0] + 0.2 * L, t + H], [f[0] + 0.1 * L, h]], [[f[1] - 0.2 * L, t + H], [f[1] - 0.1 * L, h]], [[f[0] + 0.1 * L, h], [f[1] - 0.1 * L, h]]);
  }
  return {
    w,
    h,
    cuts,
    folds,
    labels: [
      { x: (f[2] + f[3]) / 2, y: t / 2, text: 'Rabat' },
      ...(lock ? [{ x: (f[0] + f[1]) / 2, y: t + H + t / 2, text: 'Fond automatique' }] : []),
    ],
  };
}

/** Tray: base with four walls folded up. Size L + 2H by W + 2H. */
function trayGeo(L: number, W: number, H: number): Geo {
  return {
    w: L + 2 * H,
    h: W + 2 * H,
    cuts: [rect(H, H, L, W), rect(H, 0, L, H), rect(H, H + W, L, H), rect(0, H, H, W), rect(H + L, H, H, W)],
    folds: [
      [[H, H], [H + L, H]],
      [[H, H + W], [H + L, H + W]],
      [[H, H], [H, H + W]],
      [[H + L, H], [H + L, H + W]],
    ],
    labels: [{ x: H + L / 2, y: H + W / 2, text: 'Fond' }],
  };
}

/** Sleeve: one wrap around the four sides, open at both ends. */
function sleeveGeo(L: number, W: number, H: number): Geo {
  const w = 2 * L + 2 * W + GLUE;
  return {
    w,
    h: H,
    cuts: [rect(0, 0, GLUE, H), rect(GLUE, 0, 2 * L + 2 * W, H)],
    folds: [GLUE + L, GLUE + L + W, GLUE + 2 * L + W].map((x): Seg => [[x, 0], [x, H]]),
    labels: [{ x: GLUE + L + W, y: H / 2, text: 'Manchon ouvert aux deux bouts' }],
  };
}

/** Corrugated RSC-type box: (2L + 2W + 35) × (H + W), half-depth flaps top and bottom. */
function rscGeo(L: number, W: number, H: number, caption: string): Geo {
  const g = 35;
  const y0 = W / 2;
  const f = [g, g + L, g + L + W, g + 2 * L + W, g + 2 * L + 2 * W];
  const cuts: Pt[][] = [rect(0, y0, g, H)];
  for (let i = 0; i < 4; i++) {
    const fw = f[i + 1] - f[i];
    cuts.push(rect(f[i], y0, fw, H), rect(f[i], 0, fw, y0), rect(f[i], y0 + H, fw, y0));
  }
  const folds: Seg[] = [
    [[g, y0], [f[4], y0]],
    [[g, y0 + H], [f[4], y0 + H]],
    [[g, y0], [g, y0 + H]],
    ...[f[1], f[2], f[3]].map((x): Seg => [[x, y0], [x, y0 + H]]),
  ];
  return {
    w: f[4],
    h: H + W,
    cuts,
    folds,
    labels: [{ x: (f[0] + f[1]) / 2, y: y0 + H / 2, text: caption }],
  };
}

/** Telescope: tray and lid, laid out one above the other. */
function telescopeGeo(L: number, W: number, H: number): Geo {
  const body = rscGeo(L, W, H, 'Plateau');
  const lid = rscGeo(L + 6, W + 6, 40, 'Couvercle');
  const gap = 30;
  const w = Math.max(body.w, lid.w);
  return merge(w, body.h + gap + lid.h, place(body, (w - body.w) / 2, 0), place(lid, (w - lid.w) / 2, body.h + gap));
}

/** Rigid box: the wrap is the outer rectangle, the base footprint is creased inside it. */
function rigidGeo(L: number, W: number, H: number): Geo {
  const w = L + 2 * H + 40;
  const h = W + 2 * H + 40;
  const x0 = H + 20;
  const y0 = H + 20;
  return {
    w,
    h,
    cuts: [rect(0, 0, w, h)],
    folds: [
      [[x0, y0], [x0 + L, y0]],
      [[x0, y0 + W], [x0 + L, y0 + W]],
      [[x0, y0], [x0, y0 + W]],
      [[x0 + L, y0], [x0 + L, y0 + W]],
    ],
    labels: [
      { x: x0 + L / 2, y: y0 + W / 2, text: 'Fond' },
      { x: w / 2, y: H / 2 + 10, text: 'Couvercle / habillage' },
    ],
  };
}

/** Counter / floor display: a tray with a header panel above the back wall. */
function displayGeo(L: number, W: number, H: number): Geo {
  const hh = Math.max(40, H * 0.4);
  const tray = place(trayGeo(L, W, H), 0, hh);
  const header: Geo = {
    w: L + 2 * H,
    h: hh,
    cuts: [rect(H, 0, L, hh)],
    folds: [[[H, hh], [H + L, hh]]],
    labels: [{ x: H + L / 2, y: hh / 2, text: 'Entête' }],
  };
  return merge(L + 2 * H, W + 2 * H + hh, tray, header);
}

/** Unknown style: the flat blank of the cost model (same size), with the usual panel creases. */
function genericGeo(L: number, W: number, H: number): Geo {
  const t = W + GLUE;
  const f = [GLUE, GLUE + L, GLUE + L + W, GLUE + 2 * L + W, GLUE + 2 * L + 2 * W];
  const w = f[4];
  const h = H + 2 * t;
  return {
    w,
    h,
    cuts: [rect(0, 0, w, h)],
    folds: [
      [[0, t], [w, t]],
      [[0, t + H], [w, t + H]],
      ...[GLUE, f[1], f[2], f[3]].map((x): Seg => [[x, 0], [x, h]]),
    ],
    labels: [{ x: w / 2, y: h / 2, text: 'Gabarit générique' }],
  };
}

function place(g: Geo, dx: number, dy: number): Geo {
  const sh = (p: Pt): Pt => [p[0] + dx, p[1] + dy];
  return {
    ...g,
    cuts: g.cuts.map((poly) => poly.map(sh)),
    folds: g.folds.map(([a, b]) => [sh(a), sh(b)] as Seg),
    labels: g.labels.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy })),
  };
}

function merge(w: number, h: number, ...parts: Geo[]): Geo {
  return {
    w,
    h,
    cuts: parts.flatMap((p) => p.cuts),
    folds: parts.flatMap((p) => p.folds),
    labels: parts.flatMap((p) => p.labels),
  };
}

export function buildGeometry(s: PackagingSpec): Geo | null {
  const { lengthMm: L, widthMm: W, heightMm: H } = s;
  if (!(L > 0 && W > 0 && H > 0) || s.type === 'copacking') return null;
  switch (styleFamily(s.style)) {
    case 'tuck':
      return tuckGeo(L, W, H, s.style === 'ECMA A60.20.00.01');
    case 'tray':
      return trayGeo(L, W, H);
    case 'sleeve':
      return sleeveGeo(L, W, H);
    case 'rsc':
      return rscGeo(L, W, H, s.style === 'FEFCO 0427' ? 'Boîte postale' : s.style === 'FEFCO 0711' ? 'Fond automatique' : 'Caisse américaine');
    case 'telescope':
      return telescopeGeo(L, W, H);
    case 'rigid':
      return rigidGeo(L, W, H);
    case 'display':
      return displayGeo(L, W, H);
    default:
      return genericGeo(L, W, H);
  }
}

/** Styles used when the SVG is downloaded (the file has no app stylesheet). */
const PRINT_CSS = `
.dl-cut{fill:none;stroke:#000;stroke-width:1.2}
.dl-fold{stroke:#000;stroke-width:0.8;stroke-dasharray:6 4}
.dl-dim,.dl-ext,.dl-grain{stroke:#000;stroke-width:0.6;fill:none}
.dl-arrowhead{fill:#000}
.dl-label,.dl-dims text,.dl-grain-txt{fill:#000;font-family:Arial,sans-serif}
.dl-label{font-style:italic}
`;

interface DielineProps {
  spec: PackagingSpec;
  showDims?: boolean;
  className?: string;
}

export function Dieline({ spec, showDims = true, className }: DielineProps) {
  const { t, fmtNum } = useI18n();
  const svgRef = useRef<SVGSVGElement>(null);
  const markerId = `dl-arrow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const geo = buildGeometry(spec);

  if (!geo) {
    return (
      <div className={`dl-empty ${className ?? ''}`}>
        {t('Pas de gabarit pour ce type de service (co-packing).', 'No blank for this type of service (co-packing).')}
      </div>
    );
  }

  const pad = 50;
  const fs = Math.max(9, Math.max(geo.w, geo.h) * 0.03);
  const n = (v: number) => String(Math.round(v));
  const pathOf = (pts: Pt[]) => `M${pts.map((p) => p.join(' ')).join(' L')} Z`;
  const area = blankAreaM2(spec);
  const family = styleFamily(spec.style);

  const download = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', n(geo.w + 2 * pad));
    clone.setAttribute('height', n(geo.h + 2 * pad));
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = PRINT_CSS;
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', String(-pad));
    bg.setAttribute('y', String(-pad));
    bg.setAttribute('width', String(geo.w + 2 * pad));
    bg.setAttribute('height', String(geo.h + 2 * pad));
    bg.setAttribute('fill', '#fff');
    clone.insertBefore(style, clone.firstChild);
    clone.insertBefore(bg, style.nextSibling);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `gabarit-${spec.style.replace(/[^A-Za-z0-9]+/g, '-')}-${n(spec.lengthMm)}x${n(spec.widthMm)}x${n(spec.heightMm)}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <figure className={`dl ${className ?? ''}`}>
      <svg
        ref={svgRef}
        viewBox={`${-pad} ${-pad} ${geo.w + 2 * pad} ${geo.h + 2 * pad}`}
        className="dl-svg"
        role="img"
        aria-label={`${t(FAMILY_NAME_FR[family], FAMILY_NAME_EN[family])} ${n(geo.w)} × ${n(geo.h)} mm`}
      >
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="dl-arrowhead" />
          </marker>
        </defs>
        {geo.cuts.map((poly, i) => (
          <path key={`c${i}`} d={pathOf(poly)} className="dl-cut" />
        ))}
        {geo.folds.map(([a, b], i) => (
          <line key={`f${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="dl-fold" />
        ))}
        {geo.labels.map((l, i) => (
          <text key={`l${i}`} x={l.x} y={l.y} className="dl-label" style={{ fontSize: fs * 0.8 }} textAnchor="middle" dominantBaseline="middle">
            {l.text}
          </text>
        ))}
        {showDims && (
          <g className="dl-dims" style={{ fontSize: fs }}>
            <line x1={0} y1={-22} x2={geo.w} y2={-22} className="dl-dim" markerStart={`url(#${markerId})`} markerEnd={`url(#${markerId})`} />
            <line x1={0} y1={-6} x2={0} y2={-28} className="dl-ext" />
            <line x1={geo.w} y1={-6} x2={geo.w} y2={-28} className="dl-ext" />
            <text x={geo.w / 2} y={-28} textAnchor="middle">{`${n(geo.w)} mm`}</text>
            <line x1={-22} y1={0} x2={-22} y2={geo.h} className="dl-dim" markerStart={`url(#${markerId})`} markerEnd={`url(#${markerId})`} />
            <line x1={-6} y1={0} x2={-28} y2={0} className="dl-ext" />
            <line x1={-6} y1={geo.h} x2={-28} y2={geo.h} className="dl-ext" />
            <text transform={`translate(-34 ${geo.h / 2}) rotate(-90)`} textAnchor="middle">{`${n(geo.h)} mm`}</text>
            <line x1={0} y1={geo.h + 24} x2={geo.w * 0.35} y2={geo.h + 24} className="dl-grain" markerEnd={`url(#${markerId})`} />
            <text x={0} y={geo.h + 40} className="dl-grain-txt">
              {t('Sens du fil (à confirmer)', 'Grain (to confirm)')}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="dl-caption">
        <span className="dl-legend">
          <i className="dl-key cut" /> {t('Coupe', 'Cut')}
          <i className="dl-key fold" /> {t('Pli', 'Fold')}
        </span>
        <span className="small faint">
          {t('À plat', 'Flat')} {n(geo.w)} × {n(geo.h)} mm · {t('surface brute', 'blank area')} {fmtNum(area, 3)} m²
          {family === 'rigid' && t(' (lid, base and wrap)', ' (lid, base and wrap)')}
        </span>
        <button className="btn btn-sm" type="button" onClick={download}>
          <Download size={14} /> {t('Télécharger le SVG', 'Download SVG')}
        </button>
      </figcaption>
    </figure>
  );
}

const FAMILY_NAME_FR: Record<string, string> = { tuck: 'Boîte à rabat', tray: 'Plateau', sleeve: 'Manchon', rsc: 'Caisse ondulée', telescope: 'Boîte à couvercle', rigid: 'Boîte rigide', display: 'Présentoir', generic: 'Gabarit générique' };
const FAMILY_NAME_EN: Record<string, string> = { tuck: 'Tuck-end carton', tray: 'Tray', sleeve: 'Sleeve', rsc: 'Corrugated box', telescope: 'Telescope box', rigid: 'Rigid box', display: 'Display', generic: 'Generic blank' };

/** The three orthogonal views (top, front, side) at the same scale as each other's proportions. */
export function BoxViews({ spec }: { spec: PackagingSpec }) {
  const { t } = useI18n();
  const { lengthMm: L, widthMm: W, heightMm: H } = spec;
  return (
    <div className="bv-row">
      <FaceView a={L} b={W} label={t('Dessus', 'Top')} />
      <FaceView a={L} b={H} label={t('Face', 'Front')} />
      <FaceView a={W} b={H} label={t('Côté', 'Side')} />
    </div>
  );
}

function FaceView({ a, b, label }: { a: number; b: number; label: string }) {
  const k = 100 / Math.max(a, b, 1);
  const w = a * k;
  const h = b * k;
  return (
    <figure className="bv">
      <svg viewBox={`-6 -6 ${w + 34} ${h + 24}`} role="img" aria-label={`${label} ${a} × ${b} mm`}>
        <rect x={0} y={0} width={w} height={h} className="bv-face" />
        <text x={w / 2} y={h + 15} textAnchor="middle" className="bx-dim">
          {Math.round(a)}
        </text>
        <text x={w + 5} y={h / 2} dominantBaseline="middle" className="bx-dim">
          {Math.round(b)}
        </text>
      </svg>
      <figcaption className="small faint">{label}</figcaption>
    </figure>
  );
}
