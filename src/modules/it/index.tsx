import { useEffect, useRef, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Headset, LifeBuoy, ExternalLink, RotateCw, Settings2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { appSettings, logAudit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Can, Modal, useToast } from '@/components/ui';
import { Butterfly } from '@/components/Butterfly';
import type { ModuleDef } from '../types';
import './it.css';

const URL_KEY = 'it.supportUrl';
const EV_RELOAD = 'imago:it-reload';
const EV_SETTINGS = 'imago:it-settings';
export const DEFAULT_SUPPORT_URL = 'https://akab.ca';

function useSupportUrl() {
  const [url, setUrl] = useState(DEFAULT_SUPPORT_URL);
  useEffect(() => {
    const load = () => appSettings.get(URL_KEY).then((d) => setUrl((d?.value as string | undefined) ?? DEFAULT_SUPPORT_URL));
    load();
    return appSettings.subscribe(load);
  }, []);
  return url;
}

/** Embeds the IT support provider's site (AKAB) inside Imago. */
function SupportPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const url = useSupportUrl();
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [edit, setEdit] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => setLoaded(false), [url, nonce]);

  // Actions live in the app top bar (SupportActions) and reach the page through window events.
  useEffect(() => {
    const reload = () => setNonce((n) => n + 1);
    const settings = () => setEdit(url);
    window.addEventListener(EV_RELOAD, reload);
    window.addEventListener(EV_SETTINGS, settings);
    return () => {
      window.removeEventListener(EV_RELOAD, reload);
      window.removeEventListener(EV_SETTINGS, settings);
    };
  }, [url]);

  const saveUrl = async () => {
    const v = edit?.trim() ?? '';
    if (!/^https:\/\//i.test(v)) return toast(t('L’adresse doit commencer par https://', 'The address must start with https://'), 'err');
    if (await appSettings.get(URL_KEY)) await appSettings.update(URL_KEY, { value: v });
    else await appSettings.insert({ id: URL_KEY, value: v });
    await logAudit(user!.id, 'it.settings', v);
    setEdit(null);
    toast(t('Adresse du support enregistrée', 'Support address saved'));
  };

  return (
    <div className="it-page">
      <div className="it-frame-wrap">
        {!loaded && (
          <div className="it-loading">
            <Butterfly size={48} color="var(--accent)" flutter />
            <span className="faint small">{t('Chargement du support…', 'Loading support…')}</span>
          </div>
        )}
        <iframe
          key={`${url}#${nonce}`}
          ref={frame}
          src={url}
          title={t('Support informatique', 'IT support')}
          className="it-frame"
          onLoad={() => setLoaded(true)}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="clipboard-write; fullscreen"
        />
      </div>

      <Modal
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={t('Adresse du support', 'Support address')}
        footer={
          <>
            <button className="btn" onClick={() => setEdit(DEFAULT_SUPPORT_URL)}>
              {t('Par défaut', 'Default')}
            </button>
            <span className="spacer" />
            <button className="btn" onClick={() => setEdit(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary" onClick={saveUrl}>
              {t('Enregistrer', 'Save')}
            </button>
          </>
        }
      >
        <label className="field">
          <span>{t('Page affichée dans le module (https://…)', 'Page shown in the module (https://…)')}</span>
          <input className="input" value={edit ?? ''} onChange={(e) => setEdit(e.target.value)} autoFocus />
        </label>
        <p className="faint small" style={{ marginBottom: 0 }}>
          {t(
            'Par exemple le portail de billets de votre fournisseur. Le site doit autoriser l’affichage intégré.',
            'For example your provider’s ticket portal. The site must allow embedding.',
          )}
        </p>
      </Modal>
    </div>
  );
}

/** Compact actions shown in the app top bar while the IT module is open. */
function SupportActions() {
  const { t } = useI18n();
  const url = useSupportUrl();
  return (
    <div className="row" style={{ gap: 2 }}>
      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => window.dispatchEvent(new Event(EV_RELOAD))} title={t('Recharger', 'Reload')} aria-label={t('Recharger', 'Reload')}>
        <RotateCw size={16} />
      </button>
      <a className="btn btn-ghost btn-icon btn-sm" href={url} target="_blank" rel="noopener noreferrer" title={t('Ouvrir dans un nouvel onglet', 'Open in a new tab')} aria-label={t('Ouvrir dans un nouvel onglet', 'Open in a new tab')}>
        <ExternalLink size={16} />
      </a>
      <Can permission="it.settings">
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => window.dispatchEvent(new Event(EV_SETTINGS))} title={t('Adresse du support', 'Support address')} aria-label={t('Adresse du support', 'Support address')}>
          <Settings2 size={16} />
        </button>
      </Can>
      <span className="topbar-sep" />
    </div>
  );
}

function ItRoutes() {
  return (
    <Routes>
      <Route index element={<SupportPage />} />
    </Routes>
  );
}

export const itModule: ModuleDef = {
  id: 'it',
  path: '/it',
  name: { fr: 'Support TI', en: 'IT Support' },
  tagline: { fr: 'Équipe de support AKAB', en: 'AKAB support team' },
  icon: LifeBuoy,
  accent: '#0ea5c6',
  entryPermission: 'it.access',
  compactSidebar: true,
  topbarActions: SupportActions,
  permissions: [
    { key: 'it.access', label: { fr: 'Accéder au support TI', en: 'Access IT support' } },
    { key: 'it.settings', label: { fr: 'Changer l’adresse du support', en: 'Change support address' } },
  ],
  nav: [{ path: '', label: { fr: 'Support AKAB', en: 'AKAB support' }, icon: Headset }],
  component: ItRoutes,
};
