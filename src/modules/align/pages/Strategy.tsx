import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/ui';
import { planOrDefault, quarterOf } from '../lib';
import { alignPriorities, checklist, notes, rocks, strategy } from '../stores';
import { PlanTab } from '../strategy/PlanTab';
import { ChecklistTab } from '../strategy/ChecklistTab';
import { VisionTab } from '../strategy/VisionTab';
import { currentRocks } from '../strategy/planStats';

const TAB_IDS = ['plan', 'checklist', 'vision'] as const;
type Tab = (typeof TAB_IDS)[number];

/** Strategy: one-page plan, alignment checklist and 4D Vision. The tab is kept in the URL (?tab=plan|checklist|vision). */
export function Strategy() {
  const { t } = useI18n();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const userName = useUserName();
  const { rows: planRows } = useCollection(strategy);
  const { rows: rockRows } = useCollection(rocks);
  const { rows: priorityRows } = useCollection(alignPriorities);
  const { rows: noteRows } = useCollection(notes);
  const { rows: checkRows } = useCollection(checklist);

  const canManage = can('align.strategy.manage');
  const saved = planRows.find((r) => r.id === 'plan');
  const plan = useMemo(() => planOrDefault(saved), [saved]);
  const quarter = quarterOf();
  const quarterRocks = useMemo(() => currentRocks(rockRows, quarter), [rockRows, quarter]);

  const raw = params.get('tab') ?? '';
  const tab: Tab = (TAB_IDS as readonly string[]).includes(raw) ? (raw as Tab) : 'plan';
  const labels: Record<Tab, string> = {
    plan: t('Plan stratégique sur une page', 'Strategic plan on a page'),
    checklist: t('Liste de vérification d’alignement', 'Alignment checklist'),
    vision: t('Vision 4D', '4D Vision'),
  };

  return (
    <Page wide>
      <div className="align-no-print">
        <PageHeader
          eyebrow="Align"
          title={t('Stratégie', 'Strategy')}
          subtitle={t('Le plan sur une page, la vision 4D et la liste de vérification.', 'The one-page plan, the 4D Vision and the checklist.')}
        />
        <div className="tabs" role="tablist">
          {TAB_IDS.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`tab${tab === id ? ' active' : ''}`}
              onClick={() => setParams({ tab: id }, { replace: true })}
            >
              {labels[id]}
            </button>
          ))}
        </div>
      </div>

      <div className={tab === 'plan' ? undefined : 'align-no-print'}>
        {tab === 'plan' && (
          <PlanTab saved={saved} plan={plan} canManage={canManage} rocks={rockRows} priorities={priorityRows} userName={userName} />
        )}
        {tab === 'checklist' && (
          <ChecklistTab
            canManage={canManage}
            rocks={rockRows}
            priorities={priorityRows}
            notes={noteRows}
            thrusts={plan.keyThrusts}
            items={checkRows}
          />
        )}
        {tab === 'vision' && <VisionTab saved={saved} plan={plan} canManage={canManage} quarterRocks={quarterRocks} quarter={quarter} />}
      </div>
    </Page>
  );
}
