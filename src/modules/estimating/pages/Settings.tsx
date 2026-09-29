import { useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { logAudit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader, useToast } from '@/components/ui';
import { DEFAULT_EST_SETTINGS, estSettings, getEstSettings } from '../stores';
import type { EstimatingSettings } from '../types';

const FIELDS: { key: keyof Omit<EstimatingSettings, 'id'>; fr: string; en: string; step?: number }[] = [
  { key: 'defaultMarginPct', fr: 'Marge par défaut (%)', en: 'Default margin (%)' },
  { key: 'wastePct', fr: 'Gâche matériau (%)', en: 'Material waste (%)' },
  { key: 'printSetupPerColor', fr: 'Mise en train impression / couleur ($)', en: 'Print make-ready / colour ($)' },
  { key: 'printRunPerColorUnit', fr: 'Impression / couleur / unité ($)', en: 'Print / colour / unit ($)', step: 0.001 },
  { key: 'dieCost', fr: 'Forme de découpe neuve ($)', en: 'New cutting die ($)' },
  { key: 'finishSetup', fr: 'Mise en train finition ($)', en: 'Finishing make-ready ($)' },
  { key: 'finishRunUnit', fr: 'Finition / unité ($)', en: 'Finishing / unit ($)', step: 0.001 },
  { key: 'laborPerUnit', fr: 'Main-d’œuvre / unité ($)', en: 'Labour / unit ($)', step: 0.001 },
  { key: 'freightPct', fr: 'Transport (% du coût)', en: 'Freight (% of cost)' },
];

export function EstSettingsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [s, setS] = useState<EstimatingSettings>(DEFAULT_EST_SETTINGS);
  useEffect(() => {
    getEstSettings().then(setS);
  }, []);

  const save = async () => {
    if (await estSettings.get('settings')) await estSettings.update('settings', s);
    else await estSettings.insert(s);
    await logAudit(user!.id, 'estimating.settings', JSON.stringify(s));
    toast(t('Paramètres enregistrés', 'Settings saved'));
  };

  return (
    <Page>
      <PageHeader
        eyebrow={t('Estimation', 'Estimating')}
        title={t('Paramètres de chiffrage', 'Costing settings')}
        actions={
          <button className="btn btn-primary" onClick={save}>
            <Save size={16} /> {t('Enregistrer', 'Save')}
          </button>
        }
      />
      <div className="alert alert-warn" style={{ marginBottom: 16 }}>
        <Info size={16} />
        {t(
          'Taux provisoires pour la mise en page. Les règles de prix réelles (par style, presse, courbes de gâche…) seront définies avec l’équipe d’estimation.',
          'Provisional rates for the layout. Real pricing rules (per style, press, waste curves…) will be defined with the estimating team.',
        )}
      </div>
      <div className="card card-pad form-grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="field">
            <span>{t(f.fr, f.en)}</span>
            <input className="input num" type="number" step={f.step ?? 1} value={s[f.key]} onChange={(e) => setS({ ...s, [f.key]: +e.target.value })} />
          </label>
        ))}
      </div>
    </Page>
  );
}
