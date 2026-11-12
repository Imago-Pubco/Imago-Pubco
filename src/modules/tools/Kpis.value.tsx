import { useState } from 'react';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import { kpiValues } from './stores';
import type { Kpi, KpiValue } from './schemas';
import { formatValue, kpiValueId, periodLabel } from './lib';
import { parseNumber } from './Kpis.shared';

interface Props {
  kpi: Kpi;
  period: string;
  /** Existing value of this period, if any (decides insert or update). */
  existing: KpiValue | undefined;
  onClose: () => void;
}

/** Enter or correct the value and note of one indicator for one period. */
export function ValueModal({ kpi, period, existing, onClose }: Props) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [text, setText] = useState(() => (typeof existing?.value === 'number' ? String(existing.value) : ''));
  const [note, setNote] = useState(() => existing?.note ?? '');
  const [busy, setBusy] = useState(false);
  const id = kpiValueId(kpi.id, period);

  async function save() {
    const value = parseNumber(text);
    if (value === undefined) {
      toast(t('Entrez un nombre, ou laissez vide si non applicable.', 'Enter a number, or leave empty if not applicable.'), 'err');
      return;
    }
    setBusy(true);
    try {
      // Upsert: the key fields are never sent on update.
      const row = await kpiValues.get(id);
      if (row) await kpiValues.update(id, { value, note });
      else await kpiValues.insert({ id, kpiId: kpi.id, period, value, note });
      toast(t('Valeur enregistrée', 'Value saved'));
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('Enregistrement impossible', 'Could not save'), 'err');
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('Saisir la valeur', 'Enter value')}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('Annuler', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{t('Enregistrer', 'Save')}</button>
        </>
      }
    >
      <p style={{ margin: '0 0 2px', fontWeight: 600 }}>{kpi.name}</p>
      <p className="muted small" style={{ marginTop: 0 }}>
        {periodLabel(period, kpi.frequency, lang)}
        {kpi.target !== null && ` · ${t('Cible', 'Target')} : ${formatValue(kpi.target, kpi.unit, lang)}`}
      </p>
      <div className="form-grid">
        <label className="field span-2">
          <span>
            {t('Valeur', 'Value')}
            {kpi.unit ? ` (${kpi.unit})` : ''}
          </span>
          <input
            className="input"
            type="number"
            step="any"
            inputMode="decimal"
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void save();
              }
            }}
          />
        </label>
        <div className="row span-2" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setText('')}>
            {t('Vider', 'Clear')}
          </button>
          <span className="faint small">{t('Vide = non applicable (aucune couleur).', 'Empty = not applicable (no colour).')}</span>
        </div>
        <label className="field span-2">
          <span>{t('Note', 'Note')}</span>
          <textarea className="textarea" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
