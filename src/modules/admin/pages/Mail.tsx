import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Mail as MailIcon, PlugZap, RotateCcw, Save, Send, XCircle } from 'lucide-react';
import { API_MODE, api, collection, useCollection } from '@/data/db';
import { logAudit } from '@/data/stores';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader, useToast } from '@/components/ui';

interface MailTemplate {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  subject: string;
  heading: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  placeholders: { key: string; label: string; sample: string }[];
  updatedAt?: string;
}

interface SmtpStatus {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  fromName: string;
  appUrl: string;
}

const mailTemplates = collection<MailTemplate>('mail.templates');

type Fields = Pick<MailTemplate, 'enabled' | 'subject' | 'heading' | 'body' | 'buttonLabel' | 'buttonUrl'>;
const fieldsOf = (t: MailTemplate): Fields => ({ enabled: t.enabled, subject: t.subject, heading: t.heading, body: t.body, buttonLabel: t.buttonLabel, buttonUrl: t.buttonUrl });

/** Administration → Courriels: the SMTP settings in use and the editable e-mail templates. */
export function Mail() {
  const { t, fmtDate } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const { rows } = useCollection(mailTemplates);
  const [status, setStatus] = useState<SmtpStatus | null>(null);
  const [smtpTest, setSmtpTest] = useState<{ state: 'idle' | 'busy' | 'ok' | 'err'; detail?: string }>({ state: 'idle' });
  const [selected, setSelected] = useState('');
  const [draft, setDraft] = useState<Fields | null>(null);
  const [preview, setPreview] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (API_MODE) api<SmtpStatus>('/mail/status').then(setStatus, () => setStatus(null));
  }, []);
  useEffect(() => setTo(user?.email ?? ''), [user]);

  // Fixed order: the messages in the order a person meets them.
  const ORDER = ['welcome', 'password_reset', 'password_changed'];
  const list = useMemo(() => [...rows].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id) || a.name.localeCompare(b.name)), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = list.find((x) => x.id === selected) ?? list[0];
  // Load the editor from the stored template whenever another one is chosen (or it is reset).
  useEffect(() => {
    if (current) setDraft(fieldsOf(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.updatedAt]);

  const dirty = !!current && !!draft && JSON.stringify(draft) !== JSON.stringify(fieldsOf(current));

  // Live preview of the unsaved text, with sample values.
  useEffect(() => {
    if (!current || !draft) return;
    const h = setTimeout(() => {
      api<{ html: string }>('/mail/preview', { method: 'POST', body: { id: current.id, draft } }).then((r) => setPreview(r.html), () => setPreview(''));
    }, 350);
    return () => clearTimeout(h);
  }, [current?.id, draft]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!API_MODE)
    return (
      <Page>
        <PageHeader eyebrow={t('Administration', 'Administration')} title={t('Courriels', 'E-mail')} />
        <div className="card">
          <Empty icon={<MailIcon size={36} />} title={t('Disponible avec le serveur Imago', 'Available with the Imago server')} />
        </div>
      </Page>
    );

  const verify = async () => {
    setSmtpTest({ state: 'busy' });
    try {
      await api('/mail/verify', { method: 'POST' });
      setSmtpTest({ state: 'ok', detail: t('Connexion et authentification réussies.', 'Connection and sign-in succeeded.') });
    } catch (e) {
      setSmtpTest({ state: 'err', detail: e instanceof Error ? e.message : String(e) });
    }
  };

  const save = async () => {
    if (!current || !draft) return;
    setBusy('save');
    try {
      await mailTemplates.update(current.id, { ...draft, updatedAt: new Date().toISOString(), updatedBy: user!.id } as Partial<MailTemplate>);
      await logAudit(user!.id, 'mail.template.save', current.id);
      toast(t('Modèle enregistré', 'Template saved'));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy('');
    }
  };

  const reset = async () => {
    if (!current || !window.confirm(t('Rétablir le texte d’origine de ce modèle ? Vos modifications seront perdues.', 'Restore this template’s original text? Your changes will be lost.'))) return;
    setBusy('reset');
    try {
      await api(`/mail/templates/${encodeURIComponent(current.id)}/reset`, { method: 'POST' });
      toast(t('Modèle rétabli', 'Template restored'));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy('');
    }
  };

  const sendTest = async () => {
    if (!current || !draft) return;
    setBusy('test');
    try {
      const r = await api<{ to: string }>('/mail/test', { method: 'POST', body: { id: current.id, draft, to } });
      toast(t(`Courriel test envoyé à ${r.to}`, `Test e-mail sent to ${r.to}`));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy('');
    }
  };

  const insert = (key: string) => {
    if (!draft) return;
    const el = bodyRef.current;
    const tag = `{{${key}}}`;
    const start = el?.selectionStart ?? draft.body.length;
    const end = el?.selectionEnd ?? draft.body.length;
    setDraft({ ...draft, body: draft.body.slice(0, start) + tag + draft.body.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  const row = (label: string, value: string) => (
    <div className="row" style={{ justifyContent: 'space-between', gap: 16 }}>
      <span className="muted">{label}</span>
      <span className="mono small">{value || '—'}</span>
    </div>
  );

  return (
    <Page wide>
      <PageHeader
        eyebrow={t('Administration', 'Administration')}
        title={t('Courriels', 'E-mail')}
        subtitle={t('Serveur d’envoi (SMTP) et modèles des courriels envoyés par le portail.', 'Sending server (SMTP) and the templates of the e-mails the portal sends.')}
      />

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3>{t('Serveur d’envoi (SMTP)', 'Sending server (SMTP)')}</h3>
          {status && (status.enabled ? <span className="badge badge-ok">{t('Configuré', 'Configured')}</span> : <span className="badge badge-warn">{t('Non configuré', 'Not configured')}</span>)}
        </div>
        <div className="card-pad stack" style={{ gap: 8 }}>
          {status?.enabled ? (
            <>
              {row(t('Serveur', 'Server'), `${status.host}:${status.port} · ${status.secure ? 'TLS' : 'STARTTLS'}`)}
              {row(t('Compte', 'Account'), status.user)}
              {row(t('Expéditeur', 'Sender'), `${status.fromName} <${status.from}>`)}
              {row(t('Adresse du portail (liens des courriels)', 'Portal address (e-mail links)'), status.appUrl)}
              <div className="row row-wrap" style={{ marginTop: 6 }}>
                <button className="btn btn-sm" onClick={verify} disabled={smtpTest.state === 'busy'}>
                  <PlugZap size={14} /> {t('Vérifier la connexion', 'Check connection')}
                </button>
                {smtpTest.state === 'ok' && <span className="row small" style={{ color: 'var(--ok)' }}><CheckCircle2 size={14} /> {smtpTest.detail}</span>}
                {smtpTest.state === 'err' && <span className="row small" style={{ color: 'var(--err)' }}><XCircle size={14} /> {smtpTest.detail}</span>}
              </div>
              <p className="faint small" style={{ margin: 0 }}>
                {t('Ces paramètres se modifient dans le fichier .env du serveur (SMTP_HOST, SMTP_USER…), puis un redémarrage.', 'These settings are changed in the server .env file (SMTP_HOST, SMTP_USER…), followed by a restart.')}
              </p>
            </>
          ) : (
            <p style={{ margin: 0 }}>
              {t(
                'L’envoi de courriels n’est pas configuré. Ajoutez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM (et APP_URL) dans le fichier .env du serveur, puis redémarrez. Les modèles ci-dessous peuvent déjà être préparés.',
                'E-mail sending is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM (and APP_URL) to the server .env file, then restart. You can already prepare the templates below.',
              )}
            </p>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '280px 1fr', alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <h3>{t('Modèles', 'Templates')}</h3>
          </div>
          <div className="stack" style={{ gap: 0 }}>
            {list.map((x) => (
              <button
                key={x.id}
                className={`mail-tpl ${current?.id === x.id ? 'active' : ''}`}
                onClick={() => setSelected(x.id)}
                style={{ textAlign: 'left', padding: '12px 16px', border: 0, borderTop: '1px solid var(--border)', background: current?.id === x.id ? 'var(--accent-soft)' : 'transparent', color: 'inherit', cursor: 'pointer' }}
              >
                <strong>{x.name}</strong>
                <div className="faint small">{x.enabled ? t('Actif', 'Active') : t('Désactivé', 'Disabled')}</div>
              </button>
            ))}
          </div>
        </div>

        {current && draft && (
          <div className="stack">
            <div className="card">
              <div className="card-head">
                <h3>{current.name}</h3>
                <label className="check">
                  <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                  {t('Envoyer ce courriel', 'Send this e-mail')}
                </label>
              </div>
              <div className="card-pad stack">
                <p className="muted small" style={{ margin: 0 }}>{current.description}</p>
                <label className="field">
                  <span>{t('Objet', 'Subject')}</span>
                  <input className="input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
                </label>
                <label className="field">
                  <span>{t('Titre dans le courriel', 'Heading in the e-mail')}</span>
                  <input className="input" value={draft.heading} onChange={(e) => setDraft({ ...draft, heading: e.target.value })} />
                </label>
                <label className="field">
                  <span>{t('Texte', 'Text')}</span>
                  <textarea ref={bodyRef} className="textarea" rows={11} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                </label>
                <div>
                  <div className="faint small" style={{ marginBottom: 6 }}>
                    {t('Cliquez pour insérer une valeur dans le texte. Ligne vide = nouveau paragraphe, **gras**, « - » en début de ligne = liste.', 'Click to insert a value in the text. Blank line = new paragraph, **bold**, “- ” at the start of a line = list.')}
                  </div>
                  <div className="row row-wrap" style={{ gap: 6 }}>
                    {current.placeholders.map((p) => (
                      <button key={p.key} type="button" className="chip" title={p.label} onClick={() => insert(p.key)}>
                        {`{{${p.key}}}`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>{t('Texte du bouton (vide = sans bouton)', 'Button text (empty = no button)')}</span>
                    <input className="input" value={draft.buttonLabel} onChange={(e) => setDraft({ ...draft, buttonLabel: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>{t('Adresse du bouton', 'Button address')}</span>
                    <input className="input mono" value={draft.buttonUrl} onChange={(e) => setDraft({ ...draft, buttonUrl: e.target.value })} />
                  </label>
                </div>
                <div className="row row-wrap" style={{ gap: 10 }}>
                  <button className="btn btn-primary" onClick={save} disabled={!dirty || busy === 'save'}>
                    <Save size={16} /> {t('Enregistrer', 'Save')}
                  </button>
                  <button className="btn" onClick={reset} disabled={busy === 'reset'}>
                    <RotateCcw size={16} /> {t('Rétablir le texte d’origine', 'Restore original text')}
                  </button>
                  {dirty && <span className="faint small">{t('Modifications non enregistrées', 'Unsaved changes')}</span>}
                  {current.updatedAt && !dirty && <span className="faint small">{t('Modifié le', 'Edited')} {fmtDate(current.updatedAt, true)}</span>}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>{t('Aperçu', 'Preview')}</h3>
                <span className="faint small">{t('Avec des valeurs d’exemple', 'With sample values')}</span>
              </div>
              <div style={{ background: '#f1f1f2', padding: 8 }}>
                <iframe title="preview" srcDoc={preview} sandbox="" style={{ width: '100%', height: 560, border: 0, background: '#f1f1f2' }} />
              </div>
              <div className="card-pad row row-wrap" style={{ gap: 10 }}>
                <input className="input" style={{ width: 280 }} type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t('Envoyer un test à…', 'Send a test to…')} />
                <button className="btn" onClick={sendTest} disabled={busy === 'test' || !status?.enabled || !to.trim()} title={status?.enabled ? undefined : t('SMTP non configuré.', 'SMTP not configured.')}>
                  <Send size={16} /> {t('Envoyer un courriel test', 'Send a test e-mail')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
