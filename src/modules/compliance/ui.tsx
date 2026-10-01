import { METAMORPHOSIS, type StageDef } from '@/components/Stages';
import { useI18n, type L } from '@/i18n';
import type { FindingSeverity, FrameworkCategory, Requirement, RequirementStatus, RiskLevel } from './types';

export const REQ_STAGES: StageDef[] = [
  { ...METAMORPHOSIS[0], key: 'todo', label: { fr: 'À faire', en: 'To do' } },
  { ...METAMORPHOSIS[1], key: 'progress', label: { fr: 'En cours', en: 'In progress' } },
  { ...METAMORPHOSIS[2], key: 'implemented', label: { fr: 'Mise en place', en: 'Implemented' } },
  { ...METAMORPHOSIS[3], key: 'verified', label: { fr: 'Vérifiée', en: 'Verified' } },
];
export const reqStageIndex = (s: RequirementStatus) => ({ todo: 0, progress: 1, implemented: 2, verified: 3, na: 0 })[s];

export const REQ_STATUS: Record<RequirementStatus, [L, string]> = {
  todo: [{ fr: 'À faire', en: 'To do' }, ''],
  progress: [{ fr: 'En cours', en: 'In progress' }, 'badge-warn'],
  implemented: [{ fr: 'Mise en place', en: 'Implemented' }, 'badge-info'],
  verified: [{ fr: 'Vérifiée', en: 'Verified' }, 'badge-ok'],
  na: [{ fr: 'Non applicable', en: 'Not applicable' }, ''],
};

export const RISK: Record<RiskLevel, [L, string]> = {
  low: [{ fr: 'Faible', en: 'Low' }, ''],
  medium: [{ fr: 'Moyen', en: 'Medium' }, 'badge-warn'],
  high: [{ fr: 'Élevé', en: 'High' }, 'badge-err'],
};

export const SEVERITY: Record<FindingSeverity, [L, string]> = {
  major: [{ fr: 'NC majeure', en: 'Major NC' }, 'badge-err'],
  minor: [{ fr: 'NC mineure', en: 'Minor NC' }, 'badge-warn'],
  observation: [{ fr: 'Observation', en: 'Observation' }, 'badge-info'],
};

export const CATEGORIES: Record<FrameworkCategory, L> = {
  quality: { fr: 'Qualité', en: 'Quality' },
  security: { fr: 'Sécurité de l’information', en: 'Information security' },
  privacy: { fr: 'Vie privée', en: 'Privacy' },
  environment: { fr: 'Environnement', en: 'Environment' },
  health: { fr: 'Santé et sécurité', en: 'Health & safety' },
  customer: { fr: 'Exigences clients', en: 'Customer requirements' },
  other: { fr: 'Autre', en: 'Other' },
};

export function Badge<K extends string>({ map, k }: { map: Record<K, [L, string]>; k: K }) {
  const { t } = useI18n();
  const [l, cls] = map[k];
  return <span className={`badge ${cls}`}>{t(l)}</span>;
}

/** Compliance score: implemented counts half, verified counts fully; N/A excluded. */
export function score(reqs: Requirement[]) {
  const applicable = reqs.filter((r) => r.status !== 'na');
  if (!applicable.length) return 0;
  const pts = applicable.reduce((s, r) => s + (r.status === 'verified' ? 1 : r.status === 'implemented' ? 0.75 : r.status === 'progress' ? 0.3 : 0), 0);
  return Math.round((pts / applicable.length) * 100);
}

export function ScoreRing({ value, size = 64, color = 'var(--accent)' }: { value: number; size?: number; color?: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="score-ring" aria-label={`${value} %`}>
      <circle cx="32" cy="32" r={r} className="score-track" />
      <circle cx="32" cy="32" r={r} stroke={color} className="score-value" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="36" textAnchor="middle" className="score-text">
        {value}%
      </text>
    </svg>
  );
}

export const isOverdue = (d?: string) => !!d && d < new Date().toISOString().slice(0, 10);
export const isSoon = (d?: string, days = 30) => !!d && !isOverdue(d) && d <= new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
