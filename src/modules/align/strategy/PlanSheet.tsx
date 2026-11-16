import { useI18n } from '@/i18n';
import { quarterLabel } from '../lib';
import type { PlanRow } from '../schemas';
import { InitiativesPanel } from './InitiativesPanel';
import { PlanSheetBottom } from './PlanSheetBottom';
import { PlanSheetQuarter } from './PlanSheetQuarter';
import { type PlanFields } from './planData';
import { Panel, PlanTable, SectionHead, StringList, TextBlock } from './planParts';
import type { InitiativeStat, RockRow } from './planStats';

export interface PlanSheetProps {
  plan: PlanFields;
  editing: boolean;
  onChange: (patch: Partial<PlanFields>) => void;
  quarter: string;
  rocks: RockRow[];
  initiativeStats: InitiativeStat[];
}

/** The one-page strategic plan, in the order of Align's One Page Plan: foundation, 3–5 years, 1 year, quarter, SWOT, drivers. */
export function PlanSheet(props: PlanSheetProps) {
  const { plan, editing, onChange, quarter } = props;
  const { t } = useI18n();
  const planLabels = {
    projected: t('Projeté', 'Projected'),
    actual: t('Réel', 'Actual'),
    owner: t('Responsable', 'Owner'),
  };

  return (
    <div className="align-plan-sheet">
      <div className="align-plan-head">
        <div>
          <div className="eyebrow">Pubco · Align</div>
          <h2>{t('Plan stratégique sur une page', 'Strategic plan on a page')}</h2>
        </div>
        <strong>{quarterLabel(quarter)}</strong>
      </div>

      <SectionHead title={t('Fondation', 'Foundation')} />
      <div className="align-plan-row align-plan-row--4">
        <Panel title={t('Valeurs fondamentales', 'Core values')}>
          <StringList
            editing={editing}
            items={plan.coreValues}
            max={10}
            label={t('Valeur', 'Value')}
            addLabel={t('Ajouter une valeur', 'Add a value')}
            onChange={(coreValues) => onChange({ coreValues })}
          />
        </Panel>
        <Panel title={t('Raison d’être', 'Purpose')}>
          <TextBlock editing={editing} value={plan.purpose} max={2000} label={t('Raison d’être', 'Purpose')} onChange={(purpose) => onChange({ purpose })} />
        </Panel>
        <Panel title="BHAG®">
          <TextBlock editing={editing} value={plan.bhag} max={2000} label="BHAG" onChange={(bhag) => onChange({ bhag })} />
        </Panel>
        <Panel title={t('Promesses de marque', 'Brand promises')}>
          <TextBlock
            editing={editing}
            value={plan.brandPromise}
            max={2000}
            label={t('Promesse de marque', 'Brand promise')}
            onChange={(brandPromise) => onChange({ brandPromise })}
          />
        </Panel>
      </div>
      <div className="align-plan-row">
        <Panel title="Messages">
          <TextBlock
            editing={editing}
            value={plan.messages}
            max={8000}
            rows={8}
            label="Messages"
            onChange={(messages) => onChange({ messages })}
          />
        </Panel>
      </div>

      <SectionHead title={t('3 à 5 ans', '3 to 5 years')} />
      <div className="align-plan-row align-plan-row--3">
        <DatedTable
          editing={editing}
          title={t('Cibles', 'Targets')}
          value={plan.targets}
          onChange={(targets) => onChange({ targets })}
          firstLabel={t('Catégorie', 'Category')}
          labels={planLabels}
        />
        <Panel title={t('Grands axes stratégiques', 'Key thrusts')}>
          <StringList
            editing={editing}
            items={plan.keyThrusts}
            max={10}
            numbered
            label={t('Grand axe', 'Key thrust')}
            addLabel={t('Ajouter un axe', 'Add a thrust')}
            onChange={(keyThrusts) => onChange({ keyThrusts })}
          />
        </Panel>
        <Panel title={t('Profit/X (facteur X)', 'Profit/X (X factor)')}>
          <TextBlock editing={editing} value={plan.profitX} max={4000} rows={8} label="Profit/X" onChange={(profitX) => onChange({ profitX })} />
        </Panel>
      </div>

      <SectionHead title={t('1 an', '1 year')} />
      <div className="align-plan-row align-plan-row--3">
        <DatedTable
          editing={editing}
          title={t('Objectifs', 'Goals')}
          value={plan.goals}
          onChange={(goals) => onChange({ goals })}
          firstLabel={t('Catégorie', 'Category')}
          labels={planLabels}
        />
        <Panel title={t('Initiatives clés', 'Key initiatives')}>
          <InitiativesPanel
            items={plan.keyInitiatives}
            editing={editing}
            quarter={quarter}
            stats={props.initiativeStats}
            onChange={(keyInitiatives) => onChange({ keyInitiatives })}
          />
        </Panel>
        <Panel title={t('Actions (soutiennent les valeurs, la raison d’être et le BHAG)', 'Actions (support the values, purpose and BHAG)')}>
          <StringList
            editing={editing}
            items={plan.actions}
            max={30}
            label={t('Action', 'Action')}
            addLabel={t('Ajouter une action', 'Add an action')}
            onChange={(actions) => onChange({ actions })}
          />
        </Panel>
      </div>

      <PlanSheetQuarter plan={plan} editing={editing} onChange={onChange} quarter={quarter} rocks={props.rocks} />
      <PlanSheetBottom plan={plan} editing={editing} onChange={onChange} />
    </div>
  );
}

type PlanLabels = { projected: string; actual: string; owner: string };

/** A plan table with its date (the title shows it); the date is an input in edit mode. */
function DatedTable({
  editing,
  title,
  value,
  onChange,
  firstLabel,
  labels: l,
}: {
  editing: boolean;
  title: string;
  value: { date: string | null; rows: PlanRow[] };
  onChange: (v: { date: string | null; rows: PlanRow[] }) => void;
  firstLabel: string;
  labels: PlanLabels;
}) {
  const { t, fmtDate } = useI18n();
  const heading = value.date ? `${title} — ${fmtDate(value.date)}` : title;
  return (
    <Panel title={heading}>
      {editing && (
        <label className="field align-date-field">
          <span>{t('Date cible', 'Target date')}</span>
          <input type="date" className="input" value={value.date ?? ''} onChange={(e) => onChange({ ...value, date: e.target.value || null })} />
        </label>
      )}
      <PlanTable editing={editing} rows={value.rows} firstLabel={firstLabel} labels={l} onChange={(rows) => onChange({ ...value, rows })} />
    </Panel>
  );
}
