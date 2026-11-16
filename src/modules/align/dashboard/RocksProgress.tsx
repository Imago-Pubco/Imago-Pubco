import { Link } from 'react-router-dom';
import { Mountain } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Empty } from '@/components/ui';
import type { RockRow } from './model';
import { HealthDot, ProgressBar } from '../components/RockShared';

/** One row per Rock of the quarter: progress (completed priorities / total) and the health of its priorities. */
export function RocksProgress({ rows, nameOf }: { rows: RockRow[]; nameOf: (id?: string | null) => string }) {
  const { t } = useI18n();
  return (
    <section className="card align-dash-card">
      <div className="card-head">
        <h3>{t('Progression des Rocks', 'Rocks progress')}</h3>
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
              <div className="row">
                <ProgressBar pct={pct} className="align-dash-bar" />
                <span className="mono small" style={{ minWidth: 40, textAlign: 'right' }}>
                  {pct}%
                </span>
                <span className="small muted" style={{ minWidth: 64, textAlign: 'right' }}>
                  {done} / {total}
                </span>
              </div>
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
