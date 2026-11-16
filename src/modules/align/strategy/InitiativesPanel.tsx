import { useI18n } from '@/i18n';
import { HealthDot } from '../components/RockShared';
import { quarterLabel } from '../lib';
import type { Health } from '../schemas';
import { LineInput, ListEditor } from './ListEditor';
import { quarterChoices, type PlanFields } from './planData';
import { Dash } from './planParts';
import type { InitiativeStat } from './planStats';

type Initiative = PlanFields['keyInitiatives'][number];
const HEALTHS: Health[] = ['green', 'yellow', 'red'];

interface Props {
  items: Initiative[];
  editing: boolean;
  quarter: string;
  /** One summary per initiative, same order as `items`. */
  stats: InitiativeStat[];
  onChange: (items: Initiative[]) => void;
}

/** Key initiatives of the year: an editor (text and quarter), or each initiative with its Rocks and the quarter's health. */
export function InitiativesPanel({ items, editing, quarter, stats, onChange }: Props) {
  const { t } = useI18n();

  if (editing) {
    return (
      <ListEditor<Initiative>
        items={items}
        max={20}
        addLabel={t('Ajouter une initiative', 'Add an initiative')}
        makeItem={() => ({ text: '', quarter: null })}
        onChange={onChange}
        renderItem={(item, set) => (
          <div className="align-pair">
            <LineInput value={item.text} label={t('Initiative', 'Initiative')} onChange={(text) => set({ ...item, text })} />
            <select
              className="select"
              aria-label={t('Trimestre', 'Quarter')}
              value={item.quarter ?? ''}
              onChange={(e) => set({ ...item, quarter: e.target.value || null })}
            >
              <option value="">{t('Aucun trimestre', 'No quarter')}</option>
              {quarterChoices(quarter, item.quarter).map((q) => (
                <option key={q} value={q}>
                  {quarterLabel(q)}
                </option>
              ))}
            </select>
          </div>
        )}
      />
    );
  }

  if (!items.length) return <Dash />;
  return (
    <ol className="align-plan-list align-plan-inits">
      {items.map((item, i) => {
        const s = stats[i];
        return (
          <li key={i}>
            <span>{item.text}</span>
            {item.quarter && <span className="badge badge-accent align-plan-badge">{quarterLabel(item.quarter)}</span>}
            <div className="align-init-stats small">
              <span>
                {t('Rocks liés', 'Linked Rocks')} : {s?.rocks ?? 0}
              </span>
              <span>
                {quarterLabel(quarter)} · {s?.priorities ?? 0} {t('priorités', 'priorities')}
              </span>
              {HEALTHS.map((h) => (
                <span key={h} className="align-init-health">
                  <HealthDot health={h} /> {s?.health[h] ?? 0}
                </span>
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
