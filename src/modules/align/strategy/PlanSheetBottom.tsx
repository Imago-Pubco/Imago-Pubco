import { useI18n } from '@/i18n';
import { type PlanFields } from './planData';
import { Panel, SectionHead, StringList, SubList, TextBlock } from './planParts';

interface Props {
  plan: PlanFields;
  editing: boolean;
  onChange: (patch: Partial<PlanFields>) => void;
}

/** SWOT, then the supporting drivers: people (reputation), process (productivity) and the sandbox / ideal client. */
export function PlanSheetBottom({ plan, editing, onChange }: Props) {
  const { t } = useI18n();
  const { swot, people, process } = plan;
  const addLabel = t('Ajouter', 'Add');
  const list = (items: string[], onList: (v: string[]) => void, label: string, max = 20) => (
    <StringList editing={editing} items={items} max={max} label={label} addLabel={addLabel} onChange={onList} />
  );

  return (
    <>
      <SectionHead title={t('Analyse FFOM (SWOT)', 'SWOT analysis')} />
      <div className="align-plan-row align-plan-row--4">
        <Panel title={t('Forces', 'Strengths')}>
          {list(swot.strengths, (strengths) => onChange({ swot: { ...swot, strengths } }), t('Force', 'Strength'))}
        </Panel>
        <Panel title={t('Faiblesses', 'Weaknesses')}>
          {list(swot.weaknesses, (weaknesses) => onChange({ swot: { ...swot, weaknesses } }), t('Faiblesse', 'Weakness'))}
        </Panel>
        <Panel title={t('Occasions', 'Opportunities')}>
          {list(swot.opportunities, (opportunities) => onChange({ swot: { ...swot, opportunities } }), t('Occasion', 'Opportunity'))}
        </Panel>
        <Panel title={t('Tendances', 'Trends')}>
          {list(swot.trends, (trends) => onChange({ swot: { ...swot, trends } }), t('Tendance', 'Trend'))}
        </Panel>
      </div>

      <SectionHead title={t('Leviers', 'Levers')} />
      <div className="align-plan-row align-plan-row--3">
        <Panel title={t('Personnes (réputation)', 'People (reputation)')}>
          <SubList title={t('Employés', 'Employees')}>
            {list(people.employees, (employees) => onChange({ people: { ...people, employees } }), t('Employés', 'Employees'), 10)}
          </SubList>
          <SubList title={t('Clients', 'Customers')}>
            {list(people.customers, (customers) => onChange({ people: { ...people, customers } }), t('Clients', 'Customers'), 10)}
          </SubList>
          <SubList title={t('Actionnaires', 'Shareholders')}>
            {list(people.shareholders, (shareholders) => onChange({ people: { ...people, shareholders } }), t('Actionnaires', 'Shareholders'), 10)}
          </SubList>
        </Panel>
        <Panel title={t('Processus (productivité)', 'Processes (productivity)')}>
          <SubList title={t('Opérations-innovation', 'Operations-innovation')}>
            {list(process.operations, (operations) => onChange({ process: { ...process, operations } }), t('Opérations', 'Operations'), 10)}
          </SubList>
          <SubList title={t('Ventes-marketing', 'Sales-marketing')}>
            {list(process.sales, (sales) => onChange({ process: { ...process, sales } }), t('Ventes', 'Sales'), 10)}
          </SubList>
          <SubList title={t('Finance', 'Finance')}>
            {list(process.finance, (finance) => onChange({ process: { ...process, finance } }), t('Finance', 'Finance'), 10)}
          </SubList>
        </Panel>
        <Panel title={t('Bac à sable / client idéal', 'Sandbox / ideal client')}>
          <TextBlock
            editing={editing}
            value={plan.sandbox}
            max={4000}
            rows={10}
            label={t('Bac à sable / client idéal', 'Sandbox / ideal client')}
            onChange={(sandbox) => onChange({ sandbox })}
          />
        </Panel>
      </div>
    </>
  );
}
