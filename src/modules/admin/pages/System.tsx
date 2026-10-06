import { useEffect, useState } from 'react';
import { CheckCircle2, Database, Download, PlugZap, RotateCcw, Server, XCircle } from 'lucide-react';
import { API_MODE, api, resetBrowserData } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Modal, PageHeader } from '@/components/ui';

interface ServerConfig {
  integrations: {
    businessCentral: { environment: string; postMode: 'draft' | 'post' } | null;
    mailbox: { address: string } | null;
    extraction: { model: string } | null;
  };
}

type TestState = { status: 'idle' | 'busy' | 'ok' | 'err'; detail?: string };

/** Production (API server): integration status and connection tests. Keys live in the server's .env. */
function ServerSystem() {
  const { t } = useI18n();
  const [cfg, setCfg] = useState<ServerConfig | null>(null);
  const [bcTest, setBcTest] = useState<TestState>({ status: 'idle' });
  const [mailTest, setMailTest] = useState<TestState>({ status: 'idle' });

  useEffect(() => {
    api<ServerConfig>('/config').then(setCfg, () => setCfg(null));
  }, []);

  const runBc = async () => {
    setBcTest({ status: 'busy' });
    try {
      const r = await api<{ environment: string; companies: { id: string; name: string }[]; companyFound: boolean; company?: string }>('/bc/test', { method: 'POST' });
      setBcTest(
        r.companyFound
          ? { status: 'ok', detail: `${r.environment} · ${r.company}` }
          : {
              status: 'err',
              detail: t(
                `Connexion OK, mais BC_COMPANY_ID est introuvable. Sociétés : ${r.companies.map((c) => `${c.name} (${c.id})`).join(', ')}`,
                `Signed in, but BC_COMPANY_ID was not found. Companies: ${r.companies.map((c) => `${c.name} (${c.id})`).join(', ')}`,
              ),
            },
      );
    } catch (e) {
      setBcTest({ status: 'err', detail: e instanceof Error ? e.message : String(e) });
    }
  };

  const runMail = async () => {
    setMailTest({ status: 'busy' });
    try {
      const r = await api<{ mailbox: string; folder: string; total: number; unread: number }>('/mailbox/test', { method: 'POST' });
      setMailTest({ status: 'ok', detail: `${r.mailbox} · ${r.folder} · ${r.unread}/${r.total} ${t('non lus', 'unread')}` });
    } catch (e) {
      setMailTest({ status: 'err', detail: e instanceof Error ? e.message : String(e) });
    }
  };

  const status = (on: boolean) =>
    on ? <span className="badge badge-ok">{t('Configuré', 'Configured')}</span> : <span className="badge badge-warn">{t('Non configuré', 'Not configured')}</span>;

  const result = (s: TestState) =>
    s.status === 'ok' ? (
      <span className="badge badge-ok">
        <CheckCircle2 size={13} /> {s.detail}
      </span>
    ) : s.status === 'err' ? (
      <span className="badge badge-err" style={{ whiteSpace: 'normal' }}>
        <XCircle size={13} /> {s.detail}
      </span>
    ) : null;

  const i = cfg?.integrations;

  return (
    <Page>
      <PageHeader eyebrow={t('Administration', 'Administration')} title={t('Système', 'System')} />
      <div className="grid-2">
        <div className="card card-pad stack">
          <div className="row">
            <Database size={20} color="var(--accent)" />
            <h3>{t('Stockage des données', 'Data storage')}</h3>
            <span className="spacer" />
            <span className="badge badge-ok">PostgreSQL</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {t(
              'Les données sont conservées sur le serveur Imago et partagées par tous les utilisateurs. Sauvegardez la base de données régulièrement.',
              'Data is stored on the Imago server and shared by all users. Back up the database regularly.',
            )}
          </p>
          <div className="row row-wrap">
            <a className="btn" href="/api/admin/export">
              <Download size={16} /> {t('Exporter (JSON)', 'Export (JSON)')}
            </a>
          </div>
        </div>

        <div className="card card-pad stack">
          <div className="row">
            <Server size={20} color="var(--accent)" />
            <h3>{t('Intégrations', 'Integrations')}</h3>
          </div>
          <p className="faint small" style={{ margin: 0 }}>
            {t('Les clés et paramètres sont définis dans le fichier .env du serveur.', 'Keys and settings are defined in the server .env file.')}
          </p>

          <div className="stack" style={{ gap: 6 }}>
            <div className="row">
              <strong>Business Central</strong>
              <span className="spacer" />
              {status(!!i?.businessCentral)}
            </div>
            {i?.businessCentral && (
              <div className="faint small">
                {i.businessCentral.environment} ·{' '}
                {i.businessCentral.postMode === 'post'
                  ? t('les factures sont comptabilisées', 'invoices are posted')
                  : t('les factures sont créées en brouillon', 'invoices are created as drafts')}
              </div>
            )}
            <div className="row row-wrap">
              <button className="btn btn-sm" onClick={runBc} disabled={!i?.businessCentral || bcTest.status === 'busy'}>
                <PlugZap size={14} /> {t('Tester la connexion', 'Test connection')}
              </button>
              {result(bcTest)}
            </div>
          </div>

          <div className="stack" style={{ gap: 6 }}>
            <div className="row">
              <strong>{t('Boîte de factures (Microsoft Graph)', 'Invoice mailbox (Microsoft Graph)')}</strong>
              <span className="spacer" />
              {status(!!i?.mailbox)}
            </div>
            {i?.mailbox && <div className="faint small">{i.mailbox.address}</div>}
            <div className="row row-wrap">
              <button className="btn btn-sm" onClick={runMail} disabled={!i?.mailbox || mailTest.status === 'busy'}>
                <PlugZap size={14} /> {t('Tester la connexion', 'Test connection')}
              </button>
              {result(mailTest)}
            </div>
          </div>

          <div className="row">
            <strong>{t('Lecture automatique des PDF (IA)', 'Automatic PDF reading (AI)')}</strong>
            <span className="spacer" />
            {status(!!i?.extraction)}
          </div>
          {i?.extraction && <div className="faint small">{i.extraction.model}</div>}
        </div>
      </div>
    </Page>
  );
}

export function System() {
  return API_MODE ? <ServerSystem /> : <BrowserSystem />;
}

/** Development (browser backend): local storage, export and demo reset. */
function BrowserSystem() {
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
