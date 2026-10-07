import { useEffect, useState, type ChangeEvent } from 'react';
import { Play, Save } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { API_MODE, api } from '@/data/db';
import { logAudit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader, useToast } from '@/components/ui';
import { accSettings, DEFAULT_SETTINGS, getSettings } from '../stores';
import type { AccountingSettings, AutomationMode } from '../types';

const MODES: { key: AutomationMode; fr: [string, string]; en: [string, string] }[] = [
  {
    key: 'manual',
    fr: ['Manuel', 'Rien ne se fait seul : chaque document est traité et approuvé à la main.'],
    en: ['Manual', 'Nothing runs by itself: every document is processed and approved by a person.'],
  },
  {
    key: 'assisted',
    fr: ['Assisté (recommandé)', 'Les courriels sont classés, lus et rapprochés de Business Central automatiquement. Une personne approuve avant toute création dans Business Central.'],
    en: ['Assisted (recommended)', 'E-mails are classified, read and matched with Business Central automatically. A person approves before anything is created in Business Central.'],
  },
  {
    key: 'auto',
    fr: ['Automatique', 'Comme « Assisté », et les rapprochements parfaits (aucun écart) sont aussi approuvés et créés dans Business Central sans intervention. Tout écart attend une personne.'],
    en: ['Automatic', 'As “Assisted”, and perfect matches (no variance at all) are also approved and created in Business Central without anyone. Any variance waits for a person.'],
  },
];

export function Settings() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [s, setS] = useState<AccountingSettings>(DEFAULT_SETTINGS);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    getSettings().then(setS);
  }, []);

  const save = async () => {
    if (await accSettings.get('settings')) await accSettings.update('settings', s);
    else await accSettings.insert(s);
    await logAudit(user!.id, 'accounting.settings', JSON.stringify(s));
    toast(t('Paramètres enregistrés', 'Settings saved'));
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const r = await api<{ pos: number; invoices: number; approved: number; errors: number }>('/accounting/automation/run', { method: 'POST' });
      toast(t(`Automatisation : ${r.pos} bon(s) de commande, ${r.invoices} facture(s), ${r.approved} approuvé(s), ${r.errors} erreur(s)`, `Automation: ${r.pos} PO, ${r.invoices} invoice(s), ${r.approved} approved, ${r.errors} error(s)`));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setRunning(false);
    }
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
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>{t('Mode d’approbation', 'Approval mode')}</h3>
          {API_MODE && (
            <button className="btn btn-sm" onClick={runNow} disabled={running || s.mode === 'manual'} title={s.mode === 'manual' ? t('Inactif en mode manuel.', 'Inactive in manual mode.') : undefined}>
              <Play size={14} /> {t('Exécuter maintenant', 'Run now')}
            </button>
          )}
        </div>
        <div className="card-pad stack">
          {MODES.map((m) => (
            <label key={m.key} className="check" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input type="radio" name="mode" checked={s.mode === m.key} onChange={() => setS({ ...s, mode: m.key })} style={{ marginTop: 4 }} />
              <span>
                <strong>{t(m.fr[0], m.en[0])}</strong>
                <span className="muted small" style={{ display: 'block' }}>{t(m.fr[1], m.en[1])}</span>
              </span>
            </label>
          ))}
          {s.mode === 'auto' && (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>{t('Montant maximum approuvé automatiquement ($, 0 = sans limite)', 'Maximum amount approved automatically ($, 0 = no limit)')}</span>
              <input className="input" type="number" min={0} value={s.autoMaxAmount} onChange={num('autoMaxAmount')} />
            </label>
          )}
          <p className="faint small" style={{ margin: 0 }}>
            {t(
              'Les actions automatiques sont inscrites au journal d’audit sous « Automatisation ». Les courriels dont le PDF n’a pas pu être lu (sans clé IA) restent à traiter à la main.',
              'Automatic actions are written to the audit log as “Automatisation”. E-mails whose PDF could not be read (no AI key) still need to be processed by hand.',
            )}
          </p>
        </div>
      </div>
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
