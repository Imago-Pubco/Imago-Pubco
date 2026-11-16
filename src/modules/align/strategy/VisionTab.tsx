import { errorText } from '../components/RockShared';
import { useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/components/ui';
import { quarterLabel } from '../lib';
import type { Rock, Strategy } from '../schemas';
import { LineInput, ListEditor } from './ListEditor';
import { planFields, savePlan, type PlanFields } from './planData';

type VisionFields = Pick<PlanFields, 'coreValues' | 'purpose' | 'bhag' | 'brandPromise'>;

interface Props {
  saved?: Strategy;
  plan: Strategy;
  canManage: boolean;
  /** Non-archived Rocks of the current quarter. */
  quarterRocks: Rock[];
  quarter: string;
}

/** Vision 4D: core values, purpose, BHAG and brand promise as large cards, then the strategic priorities (thrusts, initiatives, quarter Rocks). */
export function VisionTab({ saved, plan, canManage, quarterRocks, quarter }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<VisionFields | null>(null);
  const [busy, setBusy] = useState(false);
  const v = draft ?? plan;

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await savePlan(saved, { ...planFields(plan), ...draft });
      setDraft(null);
      toast(t('Vision enregistrée', 'Vision saved'));
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const update = (patch: Partial<VisionFields>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const empty = <span className="muted">—</span>;

  return (
    <>
      <div className="row row-wrap align-no-print align-toolbar">
        <span className="spacer" />
        {draft ? (
          <>
            <button className="btn btn-ghost" disabled={busy} onClick={() => setDraft(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              {t('Enregistrer', 'Save')}
            </button>
          </>
        ) : (
          canManage && (
            <button
              className="btn"
              onClick={() => setDraft({ coreValues: plan.coreValues, purpose: plan.purpose, bhag: plan.bhag, brandPromise: plan.brandPromise })}
            >
              <Pencil size={15} /> {t('Modifier', 'Edit')}
            </button>
          )
        )}
      </div>

      <div className="align-vision-grid">
        <VisionCard title={t('Valeurs fondamentales', 'Core values')}>
          {draft ? (
            <ListEditor
              items={v.coreValues}
              max={10}
              addLabel={t('Ajouter une valeur', 'Add a value')}
              makeItem={() => ''}
              onChange={(coreValues) => update({ coreValues })}
              renderItem={(item, set) => <LineInput value={item} onChange={set} label={t('Valeur', 'Value')} rows={1} />}
            />
          ) : v.coreValues.length ? (
            <ul className="align-vision-values">
              {v.coreValues.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            empty
          )}
        </VisionCard>

        <VisionCard title={t('Raison d’être', 'Purpose')}>
          {draft ? (
            <LineInput value={v.purpose} max={2000} rows={6} label={t('Raison d’être', 'Purpose')} onChange={(purpose) => update({ purpose })} />
          ) : (
            <p className="align-vision-text">{v.purpose || empty}</p>
          )}
        </VisionCard>

        <VisionCard title="BHAG®">
          {draft ? (
            <LineInput value={v.bhag} max={2000} rows={6} label="BHAG" onChange={(bhag) => update({ bhag })} />
          ) : (
            <p className="align-vision-text">{v.bhag || empty}</p>
          )}
        </VisionCard>

        <VisionCard title={t('Promesse de marque', 'Brand promise')}>
          {draft ? (
            <LineInput
              value={v.brandPromise}
              max={2000}
              rows={6}
              label={t('Promesse de marque', 'Brand promise')}
              onChange={(brandPromise) => update({ brandPromise })}
            />
          ) : (
            <p className="align-vision-text">{v.brandPromise || empty}</p>
          )}
        </VisionCard>
      </div>

      <section className="align-vision-priorities">
        <h2 className="align-section-title">{t('Priorités stratégiques', 'Strategic priorities')}</h2>
        <div className="align-vision-cols">
          <VisionCard title={t('Grands axes', 'Key thrusts')} small>
            {plan.keyThrusts.length ? (
              <ol className="align-vision-list">
                {plan.keyThrusts.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            ) : (
              empty
            )}
          </VisionCard>
          <VisionCard title={t('Initiatives clés', 'Key initiatives')} small>
            {plan.keyInitiatives.length ? (
              <ol className="align-vision-list">
                {plan.keyInitiatives.map((item, i) => (
                  <li key={i}>{item.text}</li>
                ))}
              </ol>
            ) : (
              empty
            )}
          </VisionCard>
          <VisionCard title={`${t('Trimestre', 'Quarter')} · ${quarterLabel(quarter)}`} small>
            {quarterRocks.length ? (
              <ul className="align-vision-list">
                {quarterRocks.map((r) => (
                  <li key={r.id}>{r.title}</li>
                ))}
              </ul>
            ) : (
              <span className="muted small">{t('Aucun Rock pour ce trimestre.', 'No Rock for this quarter.')}</span>
            )}
          </VisionCard>
        </div>
      </section>
    </>
  );
}

function VisionCard({ title, children, small }: { title: string; children: ReactNode; small?: boolean }) {
  return (
    <section className={`card align-vision-card${small ? ' is-small' : ''}`}>
      <h2 className="align-vision-title">{title}</h2>
      {children}
    </section>
  );
}
