import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Empty } from '@/components/ui';
import { isBlocked, isOverdue, priorityPct } from '../lib';
import type { AlignPriority, Rock } from '../schemas';
import { HealthDot, ProgressBar } from '../components/RockShared';
import { InfoTip } from '../components/Insight';

/** The signed-in user's open priorities; a click opens the Rock of the priority. */
export function MyPriorities({
  items,
  rockById,
  prioById,
  today,
}: {
  items: AlignPriority[];
  rockById: Map<string, Rock>;
  prioById: Map<string, AlignPriority>;
  today: string;
}) {
  const { t, fmtDate } = useI18n();
  return (
    <section className="card align-dash-card">
      <div className="card-head">
        <h3 className="align-dash-h">{t('Mes priorités', 'My priorities')} <InfoTip what={t("Vos priorités non terminées, toutes périodes, la plus urgente en premier.", "Your priorities not completed yet, all periods, most urgent first.")} source={t("Align › Rocks (priorités qui vous sont assignées).", "Align › Rocks (priorities assigned to you).")} /></h3>
        <span className="small muted">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="card-pad">
          <Empty icon={<CheckCircle2 size={28} />} title={t('Aucune priorité ouverte', 'No open priorities')}>
            {t('Vos priorités non terminées apparaîtront ici.', 'Your open priorities will appear here.')}
          </Empty>
        </div>
      ) : (
        <ul className="align-dash-list">
          {items.map((p) => {
            const rock = p.rockId ? rockById.get(p.rockId) : undefined;
            const blocked = isBlocked(p, prioById);
            const overdue = isOverdue(p, today);
            const pct = priorityPct(p);
            return (
              <li key={p.id} className="align-dash-li">
                <Link to={rock ? `/align/rocks/${rock.id}` : '/align/rocks'} className="align-dash-task">
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="align-dash-title">{p.title}</div>
                      <div className="small muted">{rock ? rock.title : t('Sans Rock', 'No Rock')}</div>
                    </div>
                    <HealthDot health={p.health} className="align-dash-dot" />
                  </div>
                  <div className="row row-wrap small" style={{ marginTop: 6 }}>
                    {p.dueDate && (
                      <span className={overdue ? 'badge badge-err' : 'muted'}>
                        {t('Échéance', 'Due')} {fmtDate(p.dueDate)}
                      </span>
                    )}
                    {blocked && (
                      <span className="badge badge-warn" title={p.blockedNote || undefined}>
                        {t('Bloquée', 'Blocked')}
                      </span>
                    )}
                  </div>
                  <div className="row" style={{ marginTop: 6 }}>
                    <ProgressBar pct={pct} className="align-dash-bar" />
                    <span className="mono small" style={{ minWidth: 40, textAlign: 'right' }}>
                      {pct}%
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
