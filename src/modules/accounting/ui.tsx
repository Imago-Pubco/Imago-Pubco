import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { METAMORPHOSIS, type StageDef } from '@/components/Stages';
import { useI18n, type L } from '@/i18n';
import type { CheckLevel, InvoiceStage } from './types';

export const INVOICE_STAGES: StageDef[] = [
  { ...METAMORPHOSIS[0], key: 'received', label: { fr: 'Reçue', en: 'Received' } },
  { ...METAMORPHOSIS[1], key: 'extracted', label: { fr: 'Extraite', en: 'Extracted' } },
  { ...METAMORPHOSIS[2], key: 'validated', label: { fr: 'Validée BC', en: 'BC validated' } },
  { ...METAMORPHOSIS[3], key: 'posted', label: { fr: 'Comptabilisée', en: 'Posted' } },
];

export const stageIndex = (s: InvoiceStage) =>
  ({ received: 0, extracted: 1, validated: 2, posted: 3, rejected: 1 })[s];

export const STAGE_LABEL: Record<InvoiceStage, L> = {
  received: { fr: 'Reçue', en: 'Received' },
  extracted: { fr: 'À valider', en: 'To validate' },
  validated: { fr: 'Prête à comptabiliser', en: 'Ready to post' },
  posted: { fr: 'Comptabilisée', en: 'Posted' },
  rejected: { fr: 'Rejetée', en: 'Rejected' },
};

const STAGE_BADGE: Record<InvoiceStage, string> = {
  received: '',
  extracted: 'badge-warn',
  validated: 'badge-info',
  posted: 'badge-ok',
  rejected: 'badge-err',
};

export function StageBadge({ stage }: { stage: InvoiceStage }) {
  const { t } = useI18n();
  return <span className={`badge ${STAGE_BADGE[stage]}`}>{t(STAGE_LABEL[stage])}</span>;
}

export function LevelIcon({ level, size = 16 }: { level: CheckLevel; size?: number }) {
  if (level === 'ok') return <CheckCircle2 size={size} color="var(--ok)" />;
  if (level === 'warn') return <AlertTriangle size={size} color="var(--warn)" />;
  return <XCircle size={size} color="var(--err)" />;
}

export function LevelBadge({ level }: { level: CheckLevel }) {
  const { t } = useI18n();
  const map = {
    ok: ['badge-ok', t('Conforme', 'Match')],
    warn: ['badge-warn', t('Écart mineur', 'Minor variance')],
    fail: ['badge-err', t('Exception', 'Exception')],
  } as const;
  return (
    <span className={`badge ${map[level][0]}`}>
      <LevelIcon level={level} size={13} />
      {map[level][1]}
    </span>
  );
}
