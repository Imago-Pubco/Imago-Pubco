import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { Strategy } from '../schemas';
import { InfoTip } from '../components/Insight';

/** Reference card of the strategic plan on one page (BHAG, purpose, core values, key thrusts). */
export function PlanSummary({ plan }: { plan: Strategy }) {
  const { t } = useI18n();
  return (
    <section className="card align-dash-card">
      <div className="card-head">
        <h3 className="row" style={{ gap: 8 }}>
          <Compass size={15} />
          {t('Plan stratégique sur une page', 'Strategic plan on one page')}
          <InfoTip what={t("Le résumé du plan stratégique : raison d'être, BHAG, promesse de marque, axes stratégiques et thème de l'année.", "Summary of the strategic plan: purpose, BHAG, brand promise, key thrusts and the year's theme.")} source={t("Align › Stratégie (plan stratégique d'une page).", "Align › Strategy (one-page strategic plan).")} />
        </h3>
      </div>
      <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {plan.bhag && (
          <div>
            <div className="eyebrow">BHAG</div>
            <p className="align-dash-strong">{plan.bhag}</p>
          </div>
        )}
        {plan.purpose && (
          <div>
            <div className="eyebrow">{t('Raison d’être', 'Purpose')}</div>
            <p className="small align-dash-clamp" style={{ margin: '4px 0 0' }}>
              {plan.purpose}
            </p>
          </div>
        )}
        {plan.coreValues.length > 0 && (
          <div>
            <div className="eyebrow">{t('Valeurs', 'Core values')}</div>
            <div className="row row-wrap" style={{ marginTop: 6, gap: 6 }}>
              {plan.coreValues.map((v) => (
                <span key={v} className="align-dash-chip">
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}
        {plan.keyThrusts.length > 0 && (
          <div>
            <div className="eyebrow">{t('Axes clés', 'Key thrusts')}</div>
            <ol className="align-dash-thrusts">
              {plan.keyThrusts.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ol>
          </div>
        )}
        <div>
          <Link to="/align/strategy" className="btn btn-sm">
            {t('Voir le plan stratégique', 'View the strategic plan')}
          </Link>
        </div>
      </div>
    </section>
  );
}
