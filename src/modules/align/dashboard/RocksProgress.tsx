import { Link } from 'react-router-dom';
import { Mountain } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Empty } from '@/components/ui';
import type { RockRow } from './model';
import { HealthDot, ProgressBar } from '../components/RockShared';
import { HoverList, InfoTip } from '../components/Insight';
import { HEALTH_COLOR, STATUS_LABEL } from '../lib';
import type { AlignPriority } from '../schemas';

/** One row per Rock of the quarter: progress (completed priorities / total) and the health of its priorities. */
export function RocksProgress({
  rows,
  nameOf,
  onOpen,
}: {
  rows: RockRow[];
  nameOf: (id?: string | null) => string;
  onOpen: (title: string, items: AlignPriority[], subtitle?: string) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="card align-dash-card">
      <div className="card-head">
        <h3 className="align-dash-h">
          {t('Progression des Rocks', 'Rocks progress')}
          <InfoTip
            what={t('Chaque Rock du trimestre : % = priorités terminées ÷ priorités du Rock. Survolez une barre pour voir ses priorités ; cliquez pour le détail.', 'Each Rock of the quarter: % = completed priorities ÷ the Rock’s priorities. Hover a bar to see its priorities; click for details.')}
            source={t('Align › Rocks (Rocks du trimestre et leurs priorités).', 'Align › Rocks (the quarter’s Rocks and their priorities).')}
          />
        </h3>
        <Link to="/align/rocks" className="small">
          {t('Tous les Rocks', 'All Rocks')}
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="card-pad">
          <Empty icon={<Mountain size={28} />} title={t('Aucun Rock pour ce trimestre', 'No Rocks for this quarter')}>
            <Link to="/align/rocks" className="btn btn-sm btn-primary" style={{ marginTop: 10 }}>
              {t('Gérer les Rocks', 'Manage Rocks')}
            </Link>
          </Empty>
        </div>
      ) : (
        <ul className="align-dash-list">
          {rows.map(({ rock, done, total, pct, priorities }) => (
            <li key={rock.id} className="align-dash-item">
              <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
                <Link to={`/align/rocks/${rock.id}`} className="align-dash-title">
                  {rock.title}
                </Link>
                <span className="small muted">{nameOf(rock.ownerId)}</span>
              </div>
              <HoverList
                className="row align-dash-rockbar"
                title={`${rock.title} · ${done} / ${total}`}
                items={priorities.map((p) => ({ key: p.id, label: p.title, meta: `${t(STATUS_LABEL[p.status])} · ${nameOf(p.ownerId)}`, dot: HEALTH_COLOR[p.health] }))}
                onOpen={() => onOpen(rock.title, priorities, t(`Progression : ${pct} % (${done} / ${total} priorités terminées)`, `Progress: ${pct}% (${done} / ${total} priorities completed)`))}
              >
                <ProgressBar pct={pct} className="align-dash-bar" />
                <span className="mono small" style={{ minWidth: 40, textAlign: 'right' }}>
                  {pct}%
                </span>
                <span className="small muted" style={{ minWidth: 64, textAlign: 'right' }}>
                  {done} / {total}
                </span>
              </HoverList>
              {priorities.length > 0 && (
                <div className="row row-wrap align-dash-dots">
                  {priorities.map((p) => (
                    <HealthDot key={p.id} health={p.health} title={p.title} className="align-dash-dot" />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
