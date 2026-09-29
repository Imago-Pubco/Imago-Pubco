import { useEffect, useMemo, useState } from 'react';
import { METAMORPHOSIS, type StageDef } from '@/components/Stages';
import { useCollection } from '@/data/db';
import { useI18n, type L } from '@/i18n';
import { estSettings, DEFAULT_EST_SETTINGS, materials } from './stores';
import { priceBreaks } from './pricing';
import type { Estimate, EstimateStatus, EstimatingSettings } from './types';

export const EST_STAGES: StageDef[] = [
  { ...METAMORPHOSIS[0], key: 'draft', label: { fr: 'Demande', en: 'Request' } },
  { ...METAMORPHOSIS[1], key: 'costing', label: { fr: 'Chiffrage', en: 'Costing' } },
  { ...METAMORPHOSIS[2], key: 'sent', label: { fr: 'Soumise', en: 'Sent' } },
  { ...METAMORPHOSIS[3], key: 'won', label: { fr: 'Acceptée', en: 'Won' } },
];
export const estStageIndex = (s: EstimateStatus) => ({ draft: 0, costing: 1, sent: 2, won: 3, lost: 2 })[s];

export const EST_STATUS: Record<EstimateStatus, [L, string]> = {
  draft: [{ fr: 'Demande', en: 'Request' }, ''],
  costing: [{ fr: 'En chiffrage', en: 'Costing' }, 'badge-warn'],
  sent: [{ fr: 'Soumise au client', en: 'Sent to customer' }, 'badge-info'],
  won: [{ fr: 'Acceptée', en: 'Won' }, 'badge-ok'],
  lost: [{ fr: 'Refusée', en: 'Lost' }, 'badge-err'],
};

export function EstStatusBadge({ status }: { status: EstimateStatus }) {
  const { t } = useI18n();
  const [l, cls] = EST_STATUS[status];
  return <span className={`badge ${cls}`}>{t(l)}</span>;
}

export function useEstSettings(): EstimatingSettings {
  const [s, setS] = useState(DEFAULT_EST_SETTINGS);
  useEffect(() => {
    const load = () => estSettings.get('settings').then((x) => setS(x ?? DEFAULT_EST_SETTINGS));
    load();
    return estSettings.subscribe(load);
  }, []);
  return s;
}

/** Live price breaks for an estimate (provisional model). */
export function usePricing(e: Estimate | null) {
  const { rows: mats } = useCollection(materials);
  const settings = useEstSettings();
  return useMemo(() => {
    if (!e) return [];
    return priceBreaks(e.spec, e.quantities, e.marginPct, mats.find((m) => m.id === e.spec.materialId), settings);
  }, [e, mats, settings]);
}

/** Isometric preview of the box proportions (L × W × H). */
export function BoxPreview({ l, w, h, size = 240 }: { l: number; w: number; h: number; size?: number }) {
  const c = Math.cos(Math.PI / 6);
  const s = 0.5;
  const max = Math.max(l, w, h, 1);
  const k = 100 / max;
  const L = l * k,
    W = w * k,
    H = h * k;
  // Project a 3D point (x along L, y along W, z up) into 2D.
  const p = (x: number, y: number, z: number) => [(x - y) * c, (x + y) * s - z];
  const pts = {
    a: p(0, 0, H), b: p(L, 0, H), cc: p(L, W, H), d: p(0, W, H),
    e: p(L, 0, 0), f: p(L, W, 0), g: p(0, W, 0),
  };
  const all = Object.values(pts);
  const minX = Math.min(...all.map((q) => q[0])) - 24,
    maxX = Math.max(...all.map((q) => q[0])) + 24,
    minY = Math.min(...all.map((q) => q[1])) - 16,
    maxY = Math.max(...all.map((q) => q[1])) + 24;
  const poly = (...q: number[][]) => q.map((v) => v.join(',')).join(' ');
  const mid = (u: number[], v: number[]) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
  const mL = mid(pts.g, pts.f), mW = mid(pts.e, pts.f), mH = mid(pts.g, pts.d);
  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} width={size} height={size * 0.8} className="box-preview" aria-hidden="true">
      <polygon points={poly(pts.a, pts.b, pts.cc, pts.d)} className="bx-top" />
      <polygon points={poly(pts.b, pts.e, pts.f, pts.cc)} className="bx-right" />
      <polygon points={poly(pts.d, pts.cc, pts.f, pts.g)} className="bx-left" />
      <text x={mL[0] - 6} y={mL[1] + 18} className="bx-dim" textAnchor="middle">{`L ${l}`}</text>
      <text x={mW[0] + 10} y={mW[1] + 14} className="bx-dim">{`l ${w}`}</text>
      <text x={mH[0] - 10} y={mH[1]} className="bx-dim" textAnchor="end">{`H ${h}`}</text>
    </svg>
  );
}
