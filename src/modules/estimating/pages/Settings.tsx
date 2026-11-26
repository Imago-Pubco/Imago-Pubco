import { useEffect, useState } from 'react';
import { Save, Info, Wand2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { logAudit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader, useToast } from '@/components/ui';
import { DEFAULT_EST_SETTINGS, estSettings, getEstSettings } from '../stores';
import { SETTING_GROUPS } from '../defaults';
import { FINISHES, OPTIONS, PACKAGING_TYPES, STYLES } from '../catalog';

import type { EstimatingSettings, PackagingType, PressType, ValidationState } from '../types';
import { SetupWizard, ValidationBanner } from '../setup/SetupWizard';
import { getIn, setIn, validationStatus } from '../setup/validation';

type Path = (string | number)[];

/** Quick fields shown at the top of the page. */
const QUICK: { path: Path; fr: string; en: string; unit?: string }[] = [
  { path: ['companyName'], fr: 'Nom de l’entreprise', en: 'Company name' },
  { path: ['currency'], fr: 'Devise', en: 'Currency' },
  { path: ['defaultMarginPct'], fr: 'Marge par défaut', en: 'Default margin', unit: '%' },
  { path: ['freightPct'], fr: 'Transport', en: 'Freight', unit: '% du coût' },
  { path: ['overheadPct'], fr: 'Frais généraux', en: 'Overhead', unit: '% du coût direct' },
  { path: ['assemblyRatePerHour'], fr: 'Taux opérateur', en: 'Operator rate', unit: '$/h' },
  { path: ['machineHourlyRate'], fr: 'Taux colleuse', en: 'Gluer rate', unit: '$/h' },
  { path: ['dieCutHourlyRate'], fr: 'Taux découpeuse', en: 'Die-cutter rate', unit: '$/h' },
  { path: ['sheetWidthMm'], fr: 'Feuille standard, largeur', en: 'Standard sheet, width', unit: 'mm' },
  { path: ['sheetHeightMm'], fr: 'Feuille standard, hauteur', en: 'Standard sheet, height', unit: 'mm' },
];

const PRESS_FIELDS: { key: string; fr: string; en: string; step?: string }[] = [
  { key: 'hourlyRate', fr: '$/h', en: '$/h' },
  { key: 'sheetsPerHour', fr: 'Feuilles/h', en: 'Sheets/h' },
  { key: 'units', fr: 'Couleurs / passage', en: 'Colours / pass' },
  { key: 'makeReadyMinPerColor', fr: 'Mise en train min/couleur', en: 'Make-ready min/colour' },
  { key: 'makeReadySheetsPerColor', fr: 'Feuilles perdues/couleur', en: 'Lost sheets/colour' },
  { key: 'platePerColor', fr: 'Plaque $', en: 'Plate $' },
  { key: 'inkPerSheetPerColor', fr: 'Encre $/feuille/couleur', en: 'Ink $/sheet/colour', step: 'any' },
];

export function EstSettingsPage() {
  const { t } = useI18n();
  const TYPE_LABEL = (k: PackagingType) => {
    const p = PACKAGING_TYPES.find((x) => x.key === k);
    return p ? t(p.label) : k;
  };
  const { user } = useAuth();
  const toast = useToast();
  const [s, setS] = useState<EstimatingSettings>(DEFAULT_EST_SETTINGS);
  const [wizard, setWizard] = useState(false);
  useEffect(() => {
    getEstSettings().then(setS);
  }, []);

  const set = (path: Path, value: unknown) => setS((prev) => setIn(prev, path, value) as EstimatingSettings);
  const num = (path: Path, step = 'any') => {
    const v = getIn(s, path);
    return (
      <input
        className="input input-sm num"
        type="number"
        step={step}
        value={v === undefined || v === null ? '' : String(v)}
        onChange={(e) => set(path, e.target.value === '' ? undefined : +e.target.value)}
        aria-label={path.join(' ')}
      />
    );
  };

  const status = validationStatus(s);

  const save = async () => {
    if (await estSettings.get('settings')) await estSettings.update('settings', s);
    else await estSettings.insert(s);
    await logAudit(user!.id, 'estimating.settings', JSON.stringify(s));
    toast(t('Paramètres enregistrés', 'Settings saved'));
  };

  const styleCodes = Object.keys(s.styleAssemblySeconds ?? {});
  const optionKeys = Object.keys(s.optionSeconds ?? {});
  const press = (['offset', 'flexo', 'digital'] as PressType[]);
  const pressName: Record<PressType, [string, string]> = {
    offset: ['Offset', 'Offset'],
    flexo: ['Flexo', 'Flexo'],
    digital: ['Numérique', 'Digital'],
  };
  const typeKeys: PackagingType[] = ['folding', 'corrugated', 'rigid', 'display', 'copacking'];

  return (
    <Page>
      <PageHeader
        eyebrow={t('Estimation', 'Estimating')}
        title={t('Paramètres de chiffrage', 'Costing settings')}
        actions={
          <>
            <button className="btn" onClick={() => setWizard(true)}>
              <Wand2 size={16} /> {t('Assistant de configuration', 'Setup assistant')}
            </button>
            <button className="btn btn-primary" onClick={save}>
              <Save size={16} /> {t('Enregistrer', 'Save')}
            </button>
          </>
        }
      />
      <ValidationBanner />
      <div className="alert alert-warn" style={{ marginBottom: 16 }}>
        <Info size={16} />
        {t(
          'Toutes les valeurs sont provisoires tant que le groupe n’est pas confirmé. L’assistant pose les questions une à une ; « Je ne sais pas encore » garde l’estimation.',
          'Every value is provisional until its group is confirmed. The assistant asks one question at a time; “I don’t know yet” keeps the estimate.',
        )}
      </div>

      {/* Status per group */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>{t('État des groupes de coûts', 'Cost group status')}</h3>
        <div className="group-status-list">
          {SETTING_GROUPS.map((g) => (
            <div key={g.id} className="group-status-row">
              <span>{t(g.fr, g.en)}</span>
              <span className={`badge ${status[g.id] === 'confirmed' ? 'badge-ok' : 'badge-warn'}`}>
                {status[g.id] === 'confirmed' ? t('Confirmé', 'Confirmed') : t('Estimation', 'Estimate')}
              </span>
              <select
                className="select input-sm"
                aria-label={t(g.fr, g.en)}
                value={status[g.id]}
                onChange={(e) => set(['validated', g.id], e.target.value as ValidationState)}
              >
                <option value="estimate">{t('À valider', 'To validate')}</option>
                <option value="confirmed">{t('Confirmé', 'Confirmed')}</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Quick fields */}
      <div className="card card-pad form-grid" style={{ marginBottom: 16 }}>
        {QUICK.map((f) => (
          <label key={f.path.join('.')} className="field">
            <span>
              {t(f.fr, f.en)}
              {f.unit ? ` (${f.unit})` : ''}
            </span>
            {f.path[0] === 'currency' ? (
              <select className="select" value={String(getIn(s, f.path) ?? 'CAD')} onChange={(e) => set(f.path, e.target.value)}>
                {['CAD', 'USD', 'EUR'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : f.path[0] === 'companyName' ? (
              <input className="input" value={String(getIn(s, f.path) ?? '')} onChange={(e) => set(f.path, e.target.value)} />
            ) : (
              num(f.path)
            )}
          </label>
        ))}
      </div>

      {/* Advanced */}
      <details className="card card-pad adv-section">
        <summary>{t('Paramètres avancés (tous les champs de calcul)', 'Advanced settings (every calculation field)')}</summary>

        <h4 className="adv-title">{t('Impression', 'Printing')}</h4>
        <div className="table-wrap">
          <table className="table adv-table">
            <thead>
              <tr>
                <th>{t('Procédé', 'Process')}</th>
                {PRESS_FIELDS.map((f) => <th key={f.key} className="num">{t(f.fr, f.en)}</th>)}
              </tr>
            </thead>
            <tbody>
              {press.map((p) => (
                <tr key={p}>
                  <td>{t(pressName[p][0], pressName[p][1])}</td>
                  {PRESS_FIELDS.map((f) => (
                    <td key={f.key} className="num">{num(['pressRates', p, f.key], f.step)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 className="adv-title">{t('Découpe et outillage', 'Die-cutting and tooling')}</h4>
        <div className="table-wrap">
          <table className="table adv-table">
            <thead>
              <tr>
                <th>{t('Type', 'Type')}</th>
                <th className="num">{t('Forme ou gabarit ($)', 'Die or jig ($)')}</th>
                <th className="num">{t('Cadence découpe (feuilles/h)', 'Die-cut speed (sheets/h)')}</th>
              </tr>
            </thead>
            <tbody>
              {typeKeys.map((k) => (
                <tr key={k}>
                  <td>{TYPE_LABEL(k)}</td>
                  <td className="num">{num(['dieCostByType', k])}</td>
                  <td className="num">{num(['dieCutSheetsPerHour', k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 className="adv-title">{t('Finitions (par procédé)', 'Finishing (per finish)')}</h4>
        <div className="table-wrap">
          <table className="table adv-table">
            <thead>
              <tr>
                <th>{t('Finition', 'Finish')}</th>
                <th className="num">{t('Mise en train ($)', 'Set-up ($)')}</th>
                <th className="num">{t('Par 1 000 ($)', 'Per 1,000 ($)')}</th>
              </tr>
            </thead>
            <tbody>
              {FINISHES.map((f) => (
                <tr key={f.key}>
                  <td>{t(f.label.fr, f.label.en)}</td>
                  <td className="num">{num(['finishRates', f.key, 'setup'])}</td>
                  <td className="num">{num(['finishRates', f.key, 'perThousand'])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 className="adv-title">{t('Collage, assemblage, emballage', 'Gluing, assembly, packing')}</h4>
        <div className="form-grid">
          <label className="field"><span>{t('Cadence colleuse (unités/h)', 'Gluer output (units/h)')}</span>{num(['gluerUnitsPerHour'], '1')}</label>
          <label className="field"><span>{t('Emballage (s/unité)', 'Packing (s/unit)')}</span>{num(['packingSecondsPerUnit'], '1')}</label>
          <label className="field"><span>{t('Pièce en plus, présentoir ou kit (s)', 'Extra part, display or kit (s)')}</span>{num(['secondsPerExtraPart'], '1')}</label>
        </div>
        <h4 className="adv-title">{t('Temps d’assemblage de base par style (s/unité)', 'Base assembly time per style (s/unit)')}</h4>
        <div className="table-wrap">
          <table className="table adv-table">
            <tbody>
              {styleCodes.map((code) => {
                const st = Object.values(STYLES).flat().find((x) => x.code === code);
                return (
                  <tr key={code}>
                    <td className="mono">{code}</td>
                    <td>{st ? t(st.label) : ''}</td>
                    <td className="num">{num(['styleAssemblySeconds', code], '1')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <h4 className="adv-title">{t('Options (s/unité)', 'Options (s/unit)')}</h4>
        <div className="form-grid">
          {optionKeys.map((k) => {
            const o = OPTIONS.find((x) => x.key === k);
            return (
              <label key={k} className="field">
                <span>{o ? t(o.label.fr, o.label.en) : k}</span>
                {num(['optionSeconds', k], '1')}
              </label>
            );
          })}
        </div>

        <h4 className="adv-title">{t('Gâche selon la quantité', 'Waste by quantity')}</h4>
        <div className="table-wrap">
          <table className="table adv-table">
            <thead>
              <tr>
                <th>{t('Jusqu’à (unités)', 'Up to (units)')}</th>
                <th className="num">{t('Gâche (%)', 'Waste (%)')}</th>
              </tr>
            </thead>
            <tbody>
              {(s.wasteCurve ?? []).map((_w, i) => (
                <tr key={i}>
                  <td>{num(['wasteCurve', i, 'upToQty'], '1')}</td>
                  <td className="num">{num(['wasteCurve', i, 'pct'])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 className="adv-title">{t('Marge selon la quantité et le type', 'Margin by quantity and type')}</h4>
        <div className="table-wrap">
          <table className="table adv-table">
            <thead>
              <tr>
                <th>{t('À partir de (unités)', 'From (units)')}</th>
                <th className="num">{t('Marge (%)', 'Margin (%)')}</th>
              </tr>
            </thead>
            <tbody>
              {(s.marginTiers ?? []).map((_m, i) => (
                <tr key={i}>
                  <td>{num(['marginTiers', i, 'minQty'], '1')}</td>
                  <td className="num">{num(['marginTiers', i, 'marginPct'])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="table adv-table">
            <thead>
              <tr>
                <th>{t('Type de produit', 'Product type')}</th>
                <th className="num">{t('Marge (%) — vide = paliers', 'Margin (%) — empty = tiers')}</th>
              </tr>
            </thead>
            <tbody>
              {typeKeys.map((k) => (
                <tr key={k}>
                  <td>{TYPE_LABEL(k)}</td>
                  <td className="num">{num(['marginByType', k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 className="adv-title">{t('Valeurs héritées (non utilisées par le modèle actuel)', 'Legacy values (not used by the current model)')}</h4>
        <p className="small muted">
          {t(
            'Anciennes valeurs conservées pour les documents existants. Elles sont remplacées par les champs ci-dessus.',
            'Old values kept for existing documents. They are replaced by the fields above.',
          )}
        </p>
        <div className="form-grid">
          <label className="field"><span>{t('Gâche (ancienne, %)', 'Waste (legacy, %)')}</span>{num(['wastePct'])}</label>
          <label className="field"><span>{t('Mise en train (ancienne, $)', 'Make-ready (legacy, $)')}</span>{num(['printSetupPerColor'])}</label>
          <label className="field"><span>{t('Forme (ancienne, $)', 'Die (legacy, $)')}</span>{num(['dieCost'])}</label>
          <label className="field"><span>{t('Main-d’œuvre (ancienne, $/unité)', 'Labour (legacy, $/unit)')}</span>{num(['laborPerUnit'])}</label>
        </div>
      </details>

      {wizard && <SetupWizard onClose={() => setWizard(false)} />}
    </Page>
  );
}
