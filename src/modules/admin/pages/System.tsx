import { useState } from 'react';
import { Database, Download, RotateCcw, Server } from 'lucide-react';
import { resetBrowserData } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Modal, PageHeader } from '@/components/ui';

export function System() {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState(false);

  const exportData = () => {
    const data: Record<string, unknown> = {};
    Object.keys(localStorage)
      .filter((k) => k.startsWith('imago:db:'))
      .forEach((k) => (data[k.replace('imago:db:', '')] = JSON.parse(localStorage.getItem(k) ?? 'null')));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `imago-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const sizeKb = Math.round(
    Object.keys(localStorage)
      .filter((k) => k.startsWith('imago:'))
      .reduce((s, k) => s + (localStorage.getItem(k)?.length ?? 0), 0) / 1024,
  );

  return (
    <Page>
      <PageHeader eyebrow={t('Administration', 'Administration')} title={t('Système', 'System')} />
      <div className="grid-2">
        <div className="card card-pad stack">
          <div className="row">
            <Database size={20} color="var(--accent)" />
            <h3>{t('Stockage des données', 'Data storage')}</h3>
            <span className="spacer" />
            <span className="badge badge-warn">{t('Développement', 'Development')}</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {t(
              `Les données sont conservées dans ce navigateur (localStorage, ~${sizeKb} Ko). Elles ne sont pas partagées entre les postes.`,
              `Data is kept in this browser (localStorage, ~${sizeKb} KB). It is not shared between computers.`,
            )}
          </p>
          <div className="row row-wrap">
            <button className="btn" onClick={exportData}>
              <Download size={16} /> {t('Exporter (JSON)', 'Export (JSON)')}
            </button>
            <button className="btn btn-danger" onClick={() => setConfirm(true)}>
              <RotateCcw size={16} /> {t('Réinitialiser les données de démo', 'Reset demo data')}
            </button>
          </div>
        </div>
        <div className="card card-pad stack">
          <div className="row">
            <Server size={20} color="var(--accent)" />
            <h3>{t('Production', 'Production')}</h3>
          </div>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
            <li>{t('Serveur Ubuntu interne + PostgreSQL', 'Internal Ubuntu server + PostgreSQL')}</li>
            <li>{t('API Imago (Node) — mêmes contrats que la couche de données', 'Imago API (Node) — same contracts as the data layer')}</li>
            <li>Microsoft Graph → {t('boîte de factures', 'invoice mailbox')}</li>
            <li>Business Central API v2.0</li>
          </ul>
        </div>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('Réinitialiser ?', 'Reset?')}
        footer={
          <>
            <button className="btn" onClick={() => setConfirm(false)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                resetBrowserData();
                location.href = '/';
              }}
            >
              {t('Réinitialiser', 'Reset')}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {t(
            'Toutes les données Imago de ce navigateur seront effacées et les données de démonstration rechargées. Vous serez déconnecté.',
            'All Imago data in this browser will be erased and demo data reloaded. You will be signed out.',
          )}
        </p>
      </Modal>
    </Page>
  );
}
