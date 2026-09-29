import { Fragment } from 'react';
import { Egg, Bug, Hourglass, Check, type LucideIcon } from 'lucide-react';
import { useI18n, type L } from '@/i18n';
import { Butterfly } from './Butterfly';

/**
 * The Imago metamorphosis — egg → caterpillar → chrysalis → imago (adult butterfly).
 * Used as the visual language for any workflow that moves a record towards "done".
 */
export interface StageDef {
  key: string;
  label: L;
  icon?: LucideIcon | 'butterfly';
}

export const METAMORPHOSIS: StageDef[] = [
  { key: 'egg', label: { fr: 'Œuf', en: 'Egg' }, icon: Egg },
  { key: 'larva', label: { fr: 'Chenille', en: 'Caterpillar' }, icon: Bug },
  { key: 'chrysalis', label: { fr: 'Chrysalide', en: 'Chrysalis' }, icon: Hourglass },
  { key: 'imago', label: { fr: 'Imago', en: 'Imago' }, icon: 'butterfly' },
];

interface Props {
  stages: StageDef[];
  /** Index of the current stage. Stages before it are "done". */
  current: number;
  compact?: boolean;
  /** When true, the last stage shows as done (completed workflow). */
  complete?: boolean;
}

export function Stages({ stages, current, compact, complete }: Props) {
  const { t } = useI18n();
  return (
    <div className={`stages ${compact ? 'compact' : ''}`}>
      {stages.map((s, i) => {
        const state = i < current || (complete && i === current) ? 'done' : i === current ? 'current' : '';
        const Icon = s.icon;
        return (
          <Fragment key={s.key}>
            {i > 0 && <div className={`stage-line ${i <= current ? 'done' : ''}`} />}
            <div className={`stage ${state}`} title={t(s.label)}>
              <div className="stage-dot">
                {state === 'done' && Icon !== 'butterfly' ? (
                  <Check size={compact ? 12 : 15} />
                ) : Icon === 'butterfly' ? (
                  <Butterfly size={compact ? 14 : 18} color="currentColor" />
                ) : Icon ? (
                  <Icon size={compact ? 12 : 15} />
                ) : (
                  i + 1
                )}
              </div>
              <span className="stage-label">{t(s.label)}</span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
