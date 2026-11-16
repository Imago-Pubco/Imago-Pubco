import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';

/** Editable list: add, remove and reorder items up to `max`. Each item is rendered by `renderItem`. */
export function ListEditor<T>({
  items,
  max,
  onChange,
  makeItem,
  renderItem,
  addLabel,
}: {
  items: T[];
  max: number;
  onChange: (items: T[]) => void;
  makeItem: () => T;
  renderItem: (item: T, update: (next: T) => void) => ReactNode;
  addLabel: string;
}) {
  const { t } = useI18n();
  const swap = (i: number, j: number) => {
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const full = items.length >= max;
  return (
    <div className="align-list-editor">
      {items.map((item, i) => (
        <div className="align-list-item" key={i}>
          <div className="align-list-body">{renderItem(item, (next) => onChange(items.map((x, k) => (k === i ? next : x))))}</div>
          <div className="align-list-tools">
            <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onClick={() => swap(i, i - 1)} aria-label={t('Monter', 'Move up')} title={t('Monter', 'Move up')}>
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              disabled={i === items.length - 1}
              onClick={() => swap(i, i + 1)}
              aria-label={t('Descendre', 'Move down')}
              title={t('Descendre', 'Move down')}
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => onChange(items.filter((_, k) => k !== i))}
              aria-label={t('Supprimer', 'Delete')}
              title={t('Supprimer', 'Delete')}
            >
              <Trash2 size={14} color="var(--err)" />
            </button>
          </div>
        </div>
      ))}
      <div className="row row-wrap" style={{ gap: 8 }}>
        <button type="button" className="btn btn-sm" disabled={full} onClick={() => onChange([...items, makeItem()])}>
          <Plus size={14} /> {addLabel}
        </button>
        {full && <span className="faint small">{t(`Maximum de ${max} atteint`, `Maximum of ${max} reached`)}</span>}
      </div>
    </div>
  );
}

/** Multi-line text input for one line of a list or a text field, with the schema's length limit. */
export function LineInput({
  value,
  onChange,
  label,
  max = 500,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  max?: number;
  rows?: number;
}) {
  return (
    <textarea className="textarea align-line-input" rows={rows} value={value} maxLength={max} aria-label={label} onChange={(e) => onChange(e.target.value)} />
  );
}
