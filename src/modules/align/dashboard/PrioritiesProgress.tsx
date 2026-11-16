import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Empty } from '@/components/ui';
import { HEALTH_COLOR, HEALTH_LABEL, STATUS_LABEL } from '../lib';
import type { AlignPriority, Health, PriorityStatus } from '../schemas';
import { InfoTip, prioItems } from '../components/Insight';
import { SegmentBar, type Segment } from './shared';

const STATUS_COLOR: Record<PriorityStatus, string> = {
  not_started: 'var(--text-3)',
  in_progress: 'var(--info)',
  completed: 'var(--ok)',
};
const HEALTHS: Health[] = ['green', 'yellow', 'red'];
const STATUSES: PriorityStatus[] = ['not_started', 'in_progress', 'completed'];

/** Priorities of the quarter, by status and by health. Hover a part to see which ones; click it for the details. */
export function PrioritiesProgress({
  priorities,
  status,
  health,
  nameOf,
  onOpen,
}: {
  priorities: AlignPriority[];
  status: Record<PriorityStatus, number>;
  health: Record<Health, number>;
  nameOf: (id?: string | null) => string;
  /** Opens the details window for a list of priorities. */
  onOpen: (title: string, items: AlignPriority[]) => void;
}) {
  const { t } = useI18n();
  const total = priorities.length;
  const byStatus = (s: PriorityStatus) => priorities.filter((p) => p.status === s);
  const byHealth = (h: Health) => priorities.filter((p) => p.health === h);
  const statusSegments: Segment[] = STATUSES.map((s) => ({
    key: s,
    label: t(STATUS_LABEL[s]),
    value: status[s],
    color: STATUS_COLOR[s],
    items: prioItems(byStatus(s), nameOf, (p) => HEALTH_COLOR[p.health]),
  }));
  const healthSegments: Segment[] = HEALTHS.map((h) => ({
    key: h,
    label: t(HEALTH_LABEL[h]),
    value: health[h],
    color: HEALTH_COLOR[h],
    items: prioItems(byHealth(h), nameOf),
  }));

  return (
    <section className="card align-dash-card">
      <div className="card-head">
        <h3 className="align-dash-h">
          {t('Progression des priorités', 'Priorities progress')}
          <InfoTip
            what={t('Les priorités du trimestre réparties par statut et par santé. Survolez une couleur pour voir lesquelles ; cliquez pour le détail.', 'The quarter’s priorities by status and by health. Hover a colour to see which ones; click for details.')}
            source={t('Align › Rocks : priorités liées à un Rock du trimestre ou à échéance dans le trimestre.', 'Align › Rocks: priorities linked to a Rock of the quarter or due in the quarter.')}
          />
        </h3>
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
            <SegmentBar
              segments={statusSegments}
              label={t('Priorités par statut', 'Priorities by status')}
              onOpen={(k) => onOpen(`${t('Priorités', 'Priorities')} · ${t(STATUS_LABEL[k as PriorityStatus])}`, byStatus(k as PriorityStatus))}
            />
          </div>
          <div>
            <div className="align-dash-subhead">{t('Par santé', 'By health')}</div>
            <SegmentBar
              segments={healthSegments}
              label={t('Priorités par santé', 'Priorities by health')}
              onOpen={(k) => onOpen(`${t('Priorités', 'Priorities')} · ${t(HEALTH_LABEL[k as Health])}`, byHealth(k as Health))}
            />
          </div>
        </div>
      )}
    </section>
  );
}
