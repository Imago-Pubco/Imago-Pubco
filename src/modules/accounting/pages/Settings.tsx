import { useEffect, useState, type ChangeEvent } from 'react';
import { Save } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { logAudit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader, useToast } from '@/components/ui';
import { accSettings, DEFAULT_SETTINGS, getSettings } from '../stores';
import type { AccountingSettings } from '../types';

export function Settings() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [s, setS] = useState<AccountingSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    getSettings().then(setS);
  }, []);

  const save = async () => {
    if (await accSettings.get('settings')) await accSettings.update('settings', s);
    else await accSettings.insert(s);
    await logAudit(user!.id, 'accounting.settings', JSON.stringify(s));
    toast(t('Paramètres enregistrés', 'Settings saved'));
  };

  const num = (k: keyof AccountingSettings) => (e: ChangeEvent<HTMLInputElement>) =>
    setS({ ...s, [k]: +e.target.value });

  return (
    <Page>
      <PageHeader
        eyebrow={t('Comptabilité', 'Accounting')}
        title={t('Paramètres', 'Settings')}
        actions={
          <button className="btn btn-primary" onClick={save}>
            <Save size={16} /> {t('Enregistrer', 'Save')}
          </button>
        }
      />
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h3>{t('Boîte de réception', 'Mailbox')}</h3>
          </div>
          <div className="card-pad stack">
            <label className="field">
              <span>{t('Adresse surveillée', 'Monitored address')}</span>
              <input className="input" value={s.mailbox} onChange={(e) => setS({ ...s, mailbox: e.target.value })} />
            </label>
            <p className="faint small" style={{ margin: 0 }}>
              {t(
                'En production, le serveur Imago lit cette boîte via Microsoft Graph et extrait les PDF automatiquement.',
                'In production, the Imago server reads this mailbox via Microsoft Graph and extracts PDFs automatically.',
              )}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>{t('Tolérances de rapprochement', 'Matching tolerances')}</h3>
          </div>
          <div className="card-pad form-grid">
            <label className="field">
              <span>{t('Écart de prix toléré (%)', 'Price tolerance (%)')}</span>
              <input className="input" type="number" step="0.1" value={s.priceTolerancePct} onChange={num('priceTolerancePct')} />
            </label>
            <label className="field">
              <span>{t('Écart de quantité toléré', 'Quantity tolerance')}</span>
              <input className="input" type="number" value={s.qtyTolerance} onChange={num('qtyTolerance')} />
            </label>
            <label className="field">
              <span>{t('Écart de total toléré ($)', 'Total tolerance ($)')}</span>
              <input className="input" type="number" step="0.01" value={s.totalTolerance} onChange={num('totalTolerance')} />
            </label>
          </div>
        </div>
      </div>
    </Page>
  );
}
