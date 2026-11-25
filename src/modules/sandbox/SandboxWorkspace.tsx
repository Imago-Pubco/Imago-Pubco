import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bot, CheckCircle2, ExternalLink, Eye, FileCode2, RefreshCw, Send, Square, Trash2, User as UserIcon, XCircle } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Modal, useToast } from '@/components/ui';
import { sandboxModule, type SandboxEvent, type SandboxRequest } from './sandboxModules';
import { STATUS_LABEL, sandboxApi } from './api';

const err = (e: unknown) => (e instanceof Error ? e.message : String(e));
const BUSY = ['preparing', 'working', 'building', 'submitting'];
const CLOSED = ['submitted', 'approved', 'rejected', 'closed'];

/** One request: the conversation with Claude, the live preview, submit / abandon, and the approver's decision. */
export function SandboxWorkspace() {
  const { id = '' } = useParams();
  const { t, fmtDate } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [req, setReq] = useState<SandboxRequest | null>(null);
  const [events, setEvents] = useState<SandboxEvent[]>([]);
  const [liveStatus, setLiveStatus] = useState('');
  const [previewReady, setPreviewReady] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const count = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const lastStatus = useRef('');
  // One send at a time (a key repeat or a double click must not send the message twice).
  const sendingRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const r = await sandboxApi.get(id, count.current);
      setReq(r.request);
      if (r.live) {
        if (r.live.events.length) {
          setEvents((cur) => [...cur, ...r.live!.events]);
          count.current = r.live.eventCount;
        }
        setLiveStatus(r.live.status);
        setPreviewReady(r.live.previewReady);
        // A finished turn rebuilt the preview: reload it.
        if (BUSY.includes(lastStatus.current) && !BUSY.includes(r.live.status)) setPreviewKey((k) => k + 1);
        lastStatus.current = r.live.status;
      }
    } catch (e) {
      if (/not_found|404/.test(err(e))) setNotFound(true);
    }
  }, [id]);

  const status = liveStatus || req?.status || '';
  const busy = BUSY.includes(status);
  useEffect(() => {
    void poll();
    const timer = setInterval(() => void poll(), busy ? 1500 : 5000);
    return () => clearInterval(timer);
  }, [poll, busy]);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [events.length]);

  if (notFound) {
    return (
      <Page>
        <div className="alert alert-warn">
          {t('Demande introuvable.', 'Request not found.')} <Link to="/sandbox">{t('Retour au Sandbox', 'Back to the Sandbox')}</Link>
        </div>
      </Page>
    );
  }
  if (!req) return null;

  const mine = req.ownerId === user!.id;
  const closed = CLOSED.includes(req.status);
  const mod = sandboxModule(req.moduleId);
  const st = STATUS_LABEL[status] ?? { fr: status, en: status, tone: '' };
  const previewSrc = req.previewToken ? `/api/sandbox-preview/${req.id}/${req.previewToken}/${req.moduleId.replace('.', '/')}` : '';

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || sendingRef.current || busy) return;
    sendingRef.current = true;
    setSending(true);
    try {
      await sandboxApi.prompt(id, text.trim());
      setText('');
      setLiveStatus('working');
      void poll();
    } catch (e2) {
      toast(err(e2), 'err');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function abandon() {
    if (!window.confirm(t('Abandonner cette demande ? La copie privée et ses changements seront effacés.', 'Abandon this request? The private copy and its changes will be deleted.'))) return;
    try {
      await sandboxApi.close(id);
      navigate('/sandbox');
    } catch (e) {
      toast(err(e), 'err');
    }
  }

  async function decide(decision: 'approved' | 'rejected') {
    const note = window.prompt(decision === 'approved' ? t('Note (facultative) :', 'Note (optional):') : t('Raison du refus :', 'Reason for rejecting:')) ?? null;
    if (note === null) return;
    try {
      await sandboxApi.review(id, decision, note);
      void poll();
    } catch (e) {
      toast(err(e), 'err');
    }
  }

  return (
    <Page wide>
      <div className="sbx-top">
        <Link to="/sandbox" className="sbx-back">
          <ArrowLeft size={16} /> {t('Sandbox', 'Sandbox')}
        </Link>
        <div className="sbx-title">
          <h1>{req.title}</h1>
          <span className="small muted">
            {mod ? t(mod.name) : req.moduleId} · {req.costUsd.toFixed(2)} $ US · {fmtDate(req.createdAt, true)}
          </span>
        </div>
        <span className={`badge ${st.tone ? `badge-${st.tone}` : ''}`}>{t(st.fr, st.en)}</span>
        <span className="spacer" />
        {req.prUrl && (
          <a className="btn btn-sm" href={req.prUrl} target="_blank" rel="noopener noreferrer">
            <FileCode2 size={14} /> {t('Demande de fusion', 'Pull request')} <ExternalLink size={12} />
          </a>
        )}
        {mine && !closed && (
          <>
            <button className="btn btn-sm" onClick={() => void abandon()}>
              <Trash2 size={14} /> {t('Abandonner', 'Abandon')}
            </button>
            <button className="btn btn-primary btn-sm" disabled={busy || events.every((e) => e.kind !== 'agent')} onClick={() => setSubmitOpen(true)}>
              <Send size={14} /> {t('Soumettre', 'Submit')}
            </button>
          </>
        )}
        {can('sandbox.review') && req.status === 'submitted' && (
          <>
            <button className="btn btn-sm" onClick={() => void decide('rejected')}>
              <XCircle size={14} /> {t('Refuser', 'Reject')}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => void decide('approved')}>
              <CheckCircle2 size={14} /> {t('Approuver', 'Approve')}
            </button>
          </>
        )}
      </div>
      {req.reviewNote && <div className={`alert ${req.status === 'rejected' ? 'alert-err' : 'alert-info'}`} style={{ marginBottom: 12 }}>{req.reviewNote}</div>}

      <div className="sbx-grid">
        <section className="card sbx-chat">
          <div className="sbx-log" ref={logRef}>
            {events.length === 0 && <div className="small muted sbx-hint">{t('Décrivez le changement souhaité ci-dessous. Soyez précis : où, quoi, pour qui.', 'Describe the change below. Be precise: where, what, for whom.')}</div>}
            {events.map((e, i) => (
              <div key={i} className={`sbx-ev sbx-ev-${e.kind}`}>
                {e.kind === 'user' && <UserIcon size={14} />}
                {e.kind === 'agent' && <Bot size={14} />}
                <span>{e.text}</span>
              </div>
            ))}
            {busy && <div className="sbx-ev sbx-ev-info sbx-working">{t(st.fr, st.en)}</div>}
          </div>
          {mine && !closed && (
            <form className="sbx-prompt" onSubmit={send}>
              <textarea
                className="input"
                rows={3}
                maxLength={8000}
                value={text}
                disabled={busy}
                placeholder={busy ? t('Claude travaille…', 'Claude is working…') : t('Ex. : Dans le plan d’action, ajoute une colonne « Client »…', 'E.g.: In the action plan, add a "Client" column…')}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.repeat) void send(e);
                }}
              />
              <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                {busy && status === 'working' && (
                  <button type="button" className="btn btn-sm" onClick={() => void sandboxApi.stop(id)}>
                    <Square size={13} /> {t('Arrêter', 'Stop')}
                  </button>
                )}
                <button className="btn btn-primary btn-sm" disabled={busy || sending || !text.trim()}>
                  <Send size={13} /> {t('Envoyer', 'Send')} <span className="faint">Ctrl+↵</span>
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="card sbx-preview">
          <div className="sbx-preview-bar">
            <Eye size={15} />
            <strong>{t('Aperçu', 'Preview')}</strong>
            <span className="small muted">{t('copie privée · données de démonstration', 'private copy · demo data')}</span>
            <span className="spacer" />
            <button className="btn btn-ghost btn-icon btn-sm" title={t('Recharger', 'Reload')} onClick={() => setPreviewKey((k) => k + 1)}>
              <RefreshCw size={14} />
            </button>
            {previewSrc && previewReady && (
              <a className="btn btn-ghost btn-icon btn-sm" href={previewSrc} target="_blank" rel="noopener noreferrer" title={t('Ouvrir dans un onglet', 'Open in a tab')}>
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          {previewSrc && previewReady && !closed ? (
            <iframe key={previewKey} className="sbx-frame" src={previewSrc} title={t('Aperçu', 'Preview')} sandbox="allow-scripts allow-forms allow-popups allow-modals" referrerPolicy="no-referrer" />
          ) : (
            <div className="sbx-frame-empty small muted">{closed ? t('Demande terminée.', 'Request finished.') : t('L’aperçu apparaît ici dès qu’il est prêt.', 'The preview shows here as soon as it is ready.')}</div>
          )}
        </section>
      </div>

      {submitOpen && <SubmitModal id={id} title={req.title} onClose={() => setSubmitOpen(false)} onDone={() => void poll()} />}
    </Page>
  );
}

function SubmitModal({ id, title, onClose, onDone }: { id: string; title: string; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [summary, setSummary] = useState(title);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await sandboxApi.submit(id, summary.trim());
      toast(t('Demande soumise pour approbation', 'Request submitted for approval'));
      onDone();
      onClose();
      if (r.prUrl) window.open(r.prUrl, '_blank', 'noopener');
    } catch (e) {
      toast(err(e), 'err');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={t('Soumettre pour approbation', 'Submit for approval')}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            {t('Annuler', 'Cancel')}
          </button>
          <button className="btn btn-primary" onClick={() => void go()} disabled={busy || !summary.trim()}>
            <Send size={14} /> {busy ? t('Vérifications…', 'Checking…') : t('Soumettre', 'Submit')}
          </button>
        </>
      }
    >
      <p className="small muted" style={{ marginTop: 0 }}>
        {t('Avant l’envoi : vérification du périmètre, du typage et de la compilation. Ensuite, une demande de fusion est ouverte pour l’approbateur.', 'Before sending: scope, type and build checks. Then a pull request is opened for the approver.')}
      </p>
      <label className="field">
        <span>{t('Résumé pour l’approbateur', 'Summary for the approver')}</span>
        <textarea className="input" rows={5} maxLength={4000} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </label>
    </Modal>
  );
}
