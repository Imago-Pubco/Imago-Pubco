import { useEffect, useState } from 'react';
import { Copy, Inbox, RefreshCw } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader, useToast } from '@/components/ui';
import { DEFAULT_REQUEST_FORM } from '../formFields';
import { copyText, mailboxStatus, mailboxSync } from '../stores';

/** The hosted form customers fill in, the mailbox it can read from, and a preview of its questions. */
export function PublicForm() {
  const { t, fmtDate } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const link = `${window.location.origin}/request`;
  const canSettings = can('sales.settings');
  const [mail, setMail] = useState<{ enabled: boolean; mailbox?: string } | null>(null);
  const [mailError, setMailError] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    if (!canSettings) return;
    mailboxStatus()
      .then(setMail)
      .catch(() => setMailError(true));
  }, [canSettings]);

  const copy = async () => {
    const ok = await copyText(link);
    toast(ok ? t('Lien copié', 'Link copied') : link, ok ? 'ok' : 'err');
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await mailboxSync();
      setLastSync(new Date().toISOString());
      toast(t(`${r.added} nouvelle(s) demande(s) ajoutée(s)`, `${r.added} new request(s) added`));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Page>
      <PageHeader
        eyebrow={t('Ventes', 'Sales')}
        title={t('Formulaire public', 'Public form')}
        subtitle={t('Le formulaire que les clients remplissent pour demander un emballage. Chaque envoi crée une demande.', 'The form customers fill in to ask for packaging. Each submission creates a request.')}
      />

      <div className="sl-grid">
        <div className="sl-col">
          <section className="card sl-section">
            <h3 className="sl-card-title">
              <span>{t('Lien à partager', 'Link to share')}</span>
            </h3>
            <div className="sl-link-box">
              <code>{link}</code>
              <button type="button" className="btn btn-sm" onClick={copy}>
                <Copy size={14} /> {t('Copier le lien', 'Copy link')}
              </button>
            </div>
            <p className="sl-help" style={{ marginTop: 10, fontSize: 13 }}>
              {t(
                'Mettez ce lien sur le site, dans les signatures de courriel ou dans les réponses types. Le client n’a pas besoin de compte.',
                'Put this link on the website, in e-mail signatures or in standard replies. Customers do not need an account.',
              )}
            </p>
          </section>

          <section className="card sl-section">
            <h3 className="sl-card-title">
              <span>{t('Questions du formulaire', 'Form questions')}</span>
              <span className="faint small">{t(`${DEFAULT_REQUEST_FORM.length} questions`, `${DEFAULT_REQUEST_FORM.length} questions`)}</span>
            </h3>
            {DEFAULT_REQUEST_FORM.map((f) => (
              <div key={f.id} className="sl-question">
                <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>
                    {t(f.label)}
                    {f.required && <span style={{ color: 'var(--accent)' }}> *</span>}
                  </strong>
                  <span className="sl-preview-tag">{f.type}</span>
                </div>
                {f.help && <div className="sl-help">{t(f.help)}</div>}
                {f.options && (
                  <div className="small muted">{f.options.map((o) => t(o.label)).join(' · ')}</div>
                )}
              </div>
            ))}
          </section>
        </div>

        <div className="sl-col">
          {canSettings && (
            <section className="card sl-section">
              <h3 className="sl-card-title">
                <span>{t('Boîte courriel', 'Mailbox')}</span>
              </h3>
              {mailError ? (
                <div className="alert alert-err small">{t('Statut de la boîte indisponible.', 'Mailbox status unavailable.')}</div>
              ) : !mail ? (
                <p className="faint small" style={{ margin: 0 }}>
                  {t('Chargement…', 'Loading…')}
                </p>
              ) : (
                <dl className="sl-facts">
                  <dt>{t('Lecture', 'Reading')}</dt>
                  <dd>
                    <span className={`badge ${mail.enabled ? 'badge-ok' : ''}`}>{mail.enabled ? t('Activée', 'On') : t('Désactivée', 'Off')}</span>
                  </dd>
                  <dt>{t('Boîte', 'Mailbox')}</dt>
                  <dd className="mono small">{mail.mailbox || '—'}</dd>
                  {lastSync && (
                    <>
                      <dt>{t('Dernière synchro', 'Last sync')}</dt>
                      <dd>{fmtDate(lastSync, true)}</dd>
                    </>
                  )}
                </dl>
              )}
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" className="btn btn-sm" onClick={sync} disabled={syncing || (!!mail && !mail.enabled)}>
                  <RefreshCw size={14} className={syncing ? 'sl-spin' : undefined} /> {t('Synchroniser la boîte courriel', 'Sync mailbox')}
                </button>
              </div>
              <p className="sl-help" style={{ marginTop: 8, fontSize: 13 }}>
                <Inbox size={13} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }} />
                {t('Les courriels reçus à la boîte des ventes deviennent des demandes lues par l’IA.', 'E-mails received in the sales mailbox become requests read by the AI.')}
              </p>
            </section>
          )}
        </div>
      </div>
    </Page>
  );
}
