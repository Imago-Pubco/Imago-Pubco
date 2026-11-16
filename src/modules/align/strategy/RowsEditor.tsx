import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { PlanRow } from '../schemas';
import { LineInput } from './ListEditor';

export const PLAN_ROWS_MAX = 20;

/** Editor of a plan table (what, projected, actual, owner): add, remove, reorder up to 20 rows. */
export function RowsEditor({ rows, firstLabel, onChange, addLabel }: { rows: PlanRow[]; firstLabel: string; onChange: (rows: PlanRow[]) => void; addLabel?: string }) {
  const { t } = useI18n();
  const full = rows.length >= PLAN_ROWS_MAX;
  const set = (i: number, patch: Partial<PlanRow>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const swap = (i: number, j: number) => {
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const blank: PlanRow = { category: '', projected: '', actual: '', owner: '' };

  return (
    <div className="align-list-editor">
      {rows.map((r, i) => (
        <div className="align-list-item align-row-edit" key={i}>
          <div className="align-list-body align-row-fields">
            <LineInput value={r.category} label={firstLabel} rows={2} max={500} onChange={(category) => set(i, { category })} />
            <input
              className="input"
              value={r.projected}
              maxLength={100}
              placeholder={t('Projeté', 'Projected')}
              aria-label={t('Projeté', 'Projected')}
              onChange={(e) => set(i, { projected: e.target.value })}
            />
            <input
              className="input"
              value={r.actual}
              maxLength={100}
              placeholder={t('Réel', 'Actual')}
              aria-label={t('Réel', 'Actual')}
              onChange={(e) => set(i, { actual: e.target.value })}
            />
            <input
              className="input"
              value={r.owner}
              maxLength={120}
              placeholder={t('Responsable', 'Owner')}
              aria-label={t('Responsable', 'Owner')}
              onChange={(e) => set(i, { owner: e.target.value })}
            />
          </div>
          <div className="align-list-tools">
            <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onClick={() => swap(i, i - 1)} aria-label={t('Monter', 'Move up')} title={t('Monter', 'Move up')}>
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              disabled={i === rows.length - 1}
              onClick={() => swap(i, i + 1)}
              aria-label={t('Descendre', 'Move down')}
              title={t('Descendre', 'Move down')}
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => onChange(rows.filter((_, k) => k !== i))}
              aria-label={t('Supprimer', 'Delete')}
              title={t('Supprimer', 'Delete')}
            >
              <Trash2 size={14} color="var(--err)" />
            </button>
          </div>
        </div>
      ))}
      <div className="row row-wrap" style={{ gap: 8 }}>
        <button type="button" className="btn btn-sm" disabled={full} onClick={() => onChange([...rows, blank])}>
          <Plus size={14} /> {addLabel ?? t('Ajouter une ligne', 'Add a row')}
        </button>
        {full && <span className="faint small">{t(`Maximum de ${PLAN_ROWS_MAX} atteint`, `Maximum of ${PLAN_ROWS_MAX} reached`)}</span>}
      </div>
    </div>
  );
}
