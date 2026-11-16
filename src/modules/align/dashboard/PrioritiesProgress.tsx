import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Empty } from '@/components/ui';
import { HEALTH_COLOR, HEALTH_LABEL, STATUS_LABEL } from '../lib';
import type { Health, PriorityStatus } from '../schemas';
import { SegmentBar, type Segment } from './shared';

const STATUS_COLOR: Record<PriorityStatus, string> = {
  not_started: 'var(--text-3)',
  in_progress: 'var(--info)',
  completed: 'var(--ok)',
};
const HEALTHS: Health[] = ['green', 'yellow', 'red'];
const STATUSES: PriorityStatus[] = ['not_started', 'in_progress', 'completed'];

/** Priorities of the quarter, by status and by health. Kept apart from the Rocks progress on purpose. */
export function PrioritiesProgress({ total, status, health }: { total: number; status: Record<PriorityStatus, number>; health: Record<Health, number> }) {
  const { t } = useI18n();
  const statusSegments: Segment[] = STATUSES.map((s) => ({ key: s, label: t(STATUS_LABEL[s]), value: status[s], color: STATUS_COLOR[s] }));
  const healthSegments: Segment[] = HEALTHS.map((h) => ({ key: h, label: t(HEALTH_LABEL[h]), value: health[h], color: HEALTH_COLOR[h] }));

  return (
    <section className="card align-dash-card">
      <div className="card-head">
        <h3>{t('Progression des priorités', 'Priorities progress')}</h3>
        <span className="small muted">
          {t('Priorités du trimestre', 'Priorities in the quarter')} : {total}
        </span>
      </div>
      {total === 0 ? (
        <div className="card-pad">
          <Empty icon={<ListChecks size={28} />} title={t('Aucune priorité pour ce trimestre', 'No priorities for this quarter')}>
            <Link to="/align/rocks" className="btn btn-sm" style={{ marginTop: 10 }}>
              {t('Voir les Rocks', 'View Rocks')}
            </Link>
          </Empty>
        </div>
      ) : (
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <div className="align-dash-subhead">{t('Par statut', 'By status')}</div>
            <SegmentBar segments={statusSegments} label={t('Priorités par statut', 'Priorities by status')} />
          </div>
          <div>
            <div className="align-dash-subhead">{t('Par santé', 'By health')}</div>
            <SegmentBar segments={healthSegments} label={t('Priorités par santé', 'Priorities by health')} />
          </div>
        </div>
      )}
    </section>
  );
}
