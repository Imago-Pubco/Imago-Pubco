import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { ProgressBar } from '../components/RockShared';
import { quarterLabel } from '../lib';
import { type PlanFields } from './planData';
import { Dash, Panel, PlanTable, SectionHead, StringList, SubList, TextBlock } from './planParts';
import type { RockRow } from './planStats';

interface Props {
  plan: PlanFields;
  editing: boolean;
  onChange: (patch: Partial<PlanFields>) => void;
  quarter: string;
  rocks: RockRow[];
}

/** The quarter: actions of the quarter, critical numbers, the company's Rocks and the quarter's theme. */
export function PlanSheetQuarter({ plan, editing, onChange, quarter, rocks }: Props) {
  const { t } = useI18n();
  const labels = {
    projected: t('Projeté', 'Projected'),
    actual: t('Réel', 'Actual'),
    owner: t('Responsable', 'Owner'),
  };

  return (
    <>
      <SectionHead title={t('Trimestre', 'Quarter')} />
      <div className="align-plan-row align-plan-row--2">
        <Panel title={t('Actions du trimestre', 'Quarter actions')}>
          <PlanTable
            editing={editing}
            rows={plan.actionsQtr}
            firstLabel={t('Action', 'Action')}
            labels={labels}
            onChange={(actionsQtr) => onChange({ actionsQtr })}
          />
        </Panel>
        <Panel title={t('Nombres critiques', 'Critical numbers')}>
          <SubList title={t('Bilan', 'Balance sheet')}>
            <StringList
              editing={editing}
              items={plan.criticalNumbersBS}
              max={10}
              label={t('Nombre critique (bilan)', 'Critical number (balance sheet)')}
              addLabel={t('Ajouter', 'Add')}
              onChange={(criticalNumbersBS) => onChange({ criticalNumbersBS })}
            />
          </SubList>
          <SubList title={t('Résultats', 'Income')}>
            <StringList
              editing={editing}
              items={plan.criticalNumbersPL}
              max={10}
              label={t('Nombre critique (résultats)', 'Critical number (income)')}
              addLabel={t('Ajouter', 'Add')}
              onChange={(criticalNumbersPL) => onChange({ criticalNumbersPL })}
            />
          </SubList>
        </Panel>
      </div>

      <div className="align-plan-row align-plan-row--2">
        <Panel title={`${t('Priorités de l’entreprise (Rocks)', 'Company priorities (Rocks)')} · ${quarterLabel(quarter)}`}>
          {rocks.length ? (
            <ul className="align-plan-rocks">
              {rocks.map(({ rock, pct, owner }) => (
                <li key={rock.id}>
                  <Link to={`/align/rocks/${rock.id}`} className="align-rock-link">
                    {rock.title}
                  </Link>
                  <div className="row" style={{ gap: 8 }}>
                    <ProgressBar pct={pct} />
                    <span className="small mono">{pct} %</span>
                  </div>
                  <span className="faint small">{owner}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">{t('Aucun Rock pour ce trimestre.', 'No Rock for this quarter.')}</p>
          )}
          {editing && <p className="faint small align-plan-hint">{t('Les Rocks se gèrent dans l’onglet Rocks.', 'Rocks are managed in the Rocks page.')}</p>}
        </Panel>

        <Panel title={t('Thème du trimestre', 'Quarter theme')}>
          <ThemeBlock plan={plan} editing={editing} onChange={onChange} />
        </Panel>
      </div>
    </>
  );
}

/** Quarter theme: name, deadline, measurable target, celebration and reward. */
function ThemeBlock({ plan, editing, onChange }: Pick<Props, 'plan' | 'editing' | 'onChange'>) {
  const { t, fmtDate } = useI18n();
  const th = plan.theme;
  const set = (patch: Partial<PlanFields['theme']>) => onChange({ theme: { ...th, ...patch } });

  if (editing) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <label className="field">
          <span>{t('Nom du thème', 'Theme name')}</span>
          <TextBlock editing value={th.name} max={500} rows={1} label={t('Nom du thème', 'Theme name')} onChange={(name) => set({ name })} />
        </label>
        <label className="field">
          <span>{t('Échéance', 'Deadline')}</span>
          <input type="date" className="input" value={th.deadline ?? ''} onChange={(e) => set({ deadline: e.target.value || null })} />
        </label>
        <label className="field">
          <span>{t('Cible mesurable', 'Measurable target')}</span>
          <TextBlock editing value={th.target} max={500} rows={1} label={t('Cible mesurable', 'Measurable target')} onChange={(target) => set({ target })} />
        </label>
        <label className="field">
          <span>{t('Célébration', 'Celebration')}</span>
          <TextBlock editing value={th.celebration} max={500} rows={1} label={t('Célébration', 'Celebration')} onChange={(celebration) => set({ celebration })} />
        </label>
        <label className="field">
          <span>{t('Récompense', 'Reward')}</span>
          <TextBlock editing value={th.reward} max={500} rows={1} label={t('Récompense', 'Reward')} onChange={(reward) => set({ reward })} />
        </label>
      </div>
    );
  }

  const field = (label: string, value: string) => (
    <div className="align-theme-field">
      <span className="small muted">{label}</span>
      <div>{value || <Dash />}</div>
    </div>
  );
  return (
    <div className="align-theme">
      <div className="align-theme-name">{th.name || <Dash />}</div>
      {field(t('Échéance', 'Deadline'), th.deadline ? fmtDate(th.deadline) : '')}
      {field(t('Cible mesurable', 'Measurable target'), th.target)}
      {field(t('Célébration', 'Celebration'), th.celebration)}
      {field(t('Récompense', 'Reward'), th.reward)}
    </div>
  );
}
