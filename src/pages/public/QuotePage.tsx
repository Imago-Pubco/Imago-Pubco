/**
 * Public quote page (/q/:token). The customer reads the quote and answers it: approve (quantity, name,
 * drawn signature), decline (reason) or request changes. No login: the unguessable link is the access.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Eraser, FileSignature, Pencil, XCircle } from 'lucide-react';
import { Butterfly } from '@/components/Butterfly';
import { useI18n } from '@/i18n';
import type { QuoteDecision, QuoteLine, QuoteStatus } from '@/modules/sales/types';
import { PublicApiError, PublicShell, publicApi } from './publicShared';

type T = ReturnType<typeof useI18n>['t'];

/** What GET /api/public/quote/:token returns (the customer-safe part of a Quote). */
interface PublicQuote {
  no: string;
  customer: string;
  contact?: string;
  project?: string;
  specSummary: string;
  lines: QuoteLine[];
  currency: string;
  terms?: string;
  notes?: string;
  validUntil?: string;
  status: QuoteStatus;
  sentAt?: string;
  revision?: number;
  response?: { decision: QuoteDecision; at: string; quantity?: number };
  company?: string;
}

type RespondBody =
  | { decision: 'accept'; quantity: number; signedName: string; signature: string }
  | { decision: 'decline'; reason: string }
  | { decision: 'changes'; comments: string };

type LoadState = { kind: 'loading' } | { kind: 'notfound' } | { kind: 'error' } | { kind: 'ok'; quote: PublicQuote };

/** Statuses that mean the customer has already answered. */
const STATUS_DECISION: Partial<Record<QuoteStatus, QuoteDecision>> = {
  accepted: 'accept',
  declined: 'decline',
  changes: 'changes',
};

/** Decline reasons. The French label is what gets stored with the customer's comments. */
const DECLINE_REASONS = [
  { value: 'price', fr: 'Prix trop élevé', en: 'Price too high' },
  { value: 'competitor', fr: 'Un autre fournisseur', en: 'Found another supplier' },
  { value: 'cancelled', fr: 'Projet annulé', en: 'Project cancelled' },
  { value: 'timing', fr: 'Calendrier', en: 'Timing' },
  { value: 'other', fr: 'Autre', en: 'Other' },
] as const;

/** A 600x200 PNG signature is far below this; the guard only catches something badly wrong. */
const MAX_SIGNATURE_CHARS = 340_000;

function errorText(err: unknown, t: T): string {
  if (err instanceof PublicApiError && err.status === 409) {
    return t('Cette soumission a déjà reçu une réponse ou n’est plus valide. Rechargez la page.', 'This quote has already been answered or is no longer valid. Reload the page.');
  }
  if (err instanceof PublicApiError && err.status === 400) {
    return t('Certaines informations sont invalides. Vérifiez le formulaire.', 'Some information is invalid. Please check the form.');
  }
  if (err instanceof PublicApiError) {
    return t('Une erreur est survenue. Réessayez.', 'Something went wrong. Please try again.');
  }
  return t('Serveur injoignable. Réessayez.', 'Server unreachable. Please try again.');
}

export function QuotePage({ token }: { token: string }) {
  const { t, fmtNum, fmtMoney, fmtDate } = useI18n();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [panel, setPanel] = useState<QuoteDecision | null>(null);
  const enc = encodeURIComponent(token);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const quote = await publicApi<PublicQuote>(`/quote/${enc}`);
      setState({ kind: 'ok', quote });
    } catch (err) {
      setState(err instanceof PublicApiError && err.status === 404 ? { kind: 'notfound' } : { kind: 'error' });
    }
  }, [enc]);

  useEffect(() => {
    void load();
  }, [load]);

  // A customer quote must not be indexed by search engines.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const respond = async (body: RespondBody) => {
    try {
      await publicApi(`/quote/${enc}/respond`, { method: 'POST', body });
    } catch (err) {
      // 409: already answered, expired or superseded. Reload to show the current state.
      if (err instanceof PublicApiError && err.status === 409) void load();
      throw err;
    }
    const status: QuoteStatus = body.decision === 'accept' ? 'accepted' : body.decision === 'decline' ? 'declined' : 'changes';
    const quantity = body.decision === 'accept' ? body.quantity : undefined;
    const at = new Date().toISOString();
    setState((s) => (s.kind === 'ok' ? { kind: 'ok', quote: { ...s.quote, status, response: { decision: body.decision, at, quantity } } } : s));
    setPanel(null);
  };

  if (state.kind === 'loading') {
    return (
      <PublicShell>
        <section className="pub-card pub-state" role="status">
          <Butterfly size={56} flutter />
          <p>{t('Chargement…', 'Loading…')}</p>
        </section>
      </PublicShell>
    );
  }

  if (state.kind === 'notfound') {
    return (
      <PublicShell>
        <section className="pub-card pub-state">
          <AlertCircle size={40} color="var(--warn)" aria-hidden="true" />
          <h1>{t('Ce lien n’est pas valide', 'This link is not valid')}</h1>
          <p>{t('Vérifiez le lien reçu par courriel ou communiquez avec nous.', 'Check the link you received by e-mail, or contact us.')}</p>
        </section>
      </PublicShell>
    );
  }

  if (state.kind === 'error') {
    return (
      <PublicShell>
        <section className="pub-card pub-state" role="alert">
          <AlertCircle size={40} color="var(--err)" aria-hidden="true" />
          <h1>{t('Une erreur est survenue', 'Something went wrong')}</h1>
          <p>{t('Serveur injoignable. Réessayez.', 'Server unreachable. Please try again.')}</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => void load()}>
            {t('Réessayer', 'Try again')}
          </button>
        </section>
      </PublicShell>
    );
  }

  const { quote } = state;
  const title = `${t('Soumission', 'Quote')} ${quote.no}`;

  if (quote.status === 'superseded') {
    return (
      <PublicShell company={quote.company}>
        <section className="pub-card">
          <h1>{title}</h1>
          <div className="pub-notice" role="status">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{t('Une version plus récente existe, consultez votre courriel.', 'A more recent version exists. Please check your e-mail.')}</span>
          </div>
        </section>
      </PublicShell>
    );
  }

  const decision = quote.response?.decision ?? STATUS_DECISION[quote.status];

  return (
    <PublicShell company={quote.company}>
      <section className="pub-card" aria-labelledby="quote-title">
        <div className="pub-title-row">
          <h1 id="quote-title">{title}</h1>
          {(quote.revision ?? 0) > 1 && <span className="pub-pill">{t(`Révision ${quote.revision}`, `Revision ${quote.revision}`)}</span>}
        </div>
        <dl className="pub-meta">
          <div>
            <dt>{t('Client', 'Customer')}</dt>
            <dd>{quote.customer}</dd>
          </div>
          {quote.contact && (
            <div>
              <dt>{t('Contact', 'Contact')}</dt>
              <dd>{quote.contact}</dd>
            </div>
          )}
          {quote.project && (
            <div>
              <dt>{t('Projet', 'Project')}</dt>
              <dd>{quote.project}</dd>
            </div>
          )}
          <div>
            <dt>{t('Valide jusqu’au', 'Valid until')}</dt>
            <dd>{fmtDate(quote.validUntil)}</dd>
          </div>
          {quote.sentAt && (
            <div>
              <dt>{t('Date', 'Date')}</dt>
              <dd>{fmtDate(quote.sentAt)}</dd>
            </div>
          )}
        </dl>

        <h2 className="pub-section">{t('Spécifications', 'Specifications')}</h2>
        <p className="pub-pre">{quote.specSummary}</p>

        <h2 className="pub-section">{t('Prix', 'Pricing')}</h2>
        <div className="pub-table-wrap">
          <table className="pub-table">
            <caption className="pub-sr-only">{t('Prix par quantité', 'Price by quantity')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('Quantité', 'Quantity')}</th>
                <th scope="col">{t('Prix unitaire', 'Unit price')}</th>
                <th scope="col">{t('Total', 'Total')}</th>
              </tr>
            </thead>
            <tbody>
              {quote.lines.map((l, i) => (
                <tr key={`${l.quantity}-${i}`}>
                  <td>{fmtNum(l.quantity)}</td>
                  <td>{fmtMoney(l.unitPrice, quote.currency)}</td>
                  <td>{fmtMoney(l.total, quote.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pub-muted pub-small">
          {t('Prix en dollars canadiens (CAD). Taxes en sus.', 'Prices in Canadian dollars (CAD). Plus applicable taxes.')}
        </p>
      </section>

      {quote.terms && (
        <section className="pub-card">
          <h2>{t('Conditions', 'Terms')}</h2>
          <div className="pub-pre">{quote.terms}</div>
        </section>
      )}
      {quote.notes && (
        <section className="pub-card">
          <h2>{t('Notes', 'Notes')}</h2>
          <div className="pub-pre">{quote.notes}</div>
        </section>
      )}

      {decision ? (
        <AnsweredCard decision={decision} response={quote.response} />
      ) : quote.status === 'expired' ? (
        <div className="pub-notice" role="status">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{t('Cette soumission a expiré. Communiquez avec nous pour obtenir une nouvelle soumission.', 'This quote has expired. Contact us for an updated quote.')}</span>
        </div>
      ) : (
        <Decide quote={quote} panel={panel} setPanel={setPanel} onRespond={respond} />
      )}
    </PublicShell>
  );
}

/** Confirmation shown once the customer has answered. There is no way to answer again. */
function AnsweredCard({ decision, response }: { decision: QuoteDecision; response?: PublicQuote['response'] }) {
  const { t, fmtNum, fmtDate } = useI18n();
  const qty = response?.quantity;
  const heading =
    decision === 'accept'
      ? t('Merci !', 'Thank you!')
      : decision === 'decline'
        ? t('Réponse enregistrée', 'Response recorded')
        : t('Demande envoyée', 'Request sent');
  const message =
    decision === 'accept'
      ? qty
        ? t(`Votre approbation pour ${fmtNum(qty)} unités a été enregistrée. Nous communiquerons avec vous pour la suite.`, `Your approval for ${fmtNum(qty)} units has been recorded. We will contact you about next steps.`)
        : t('Votre approbation a été enregistrée. Nous communiquerons avec vous pour la suite.', 'Your approval has been recorded. We will contact you about next steps.')
      : decision === 'decline'
        ? t('Nous avons bien noté votre décision. Merci de nous avoir consultés.', 'We have noted your decision. Thank you for considering us.')
        : t('Nous avons bien reçu vos demandes de modifications. Une version révisée vous sera transmise.', 'We have received your change request. A revised quote will be sent to you.');
  return (
    <section className="pub-card pub-answered" role="status">
      {decision === 'decline' ? <XCircle size={48} color="var(--text-2)" aria-hidden="true" /> : <CheckCircle2 size={48} color="var(--ok)" aria-hidden="true" />}
      <h2>{heading}</h2>
      <p>{message}</p>
      {response?.at && (
        <p className="pub-muted pub-small">
          {t('Réponse enregistrée le', 'Response recorded on')} {fmtDate(response.at, true)}
        </p>
      )}
    </section>
  );
}

function Decide({
  quote,
  panel,
  setPanel,
  onRespond,
}: {
  quote: PublicQuote;
  panel: QuoteDecision | null;
  setPanel: (d: QuoteDecision | null) => void;
  onRespond: (b: RespondBody) => Promise<void>;
}) {
  const { t } = useI18n();
  const pick = (d: QuoteDecision) => setPanel(panel === d ? null : d);
  return (
    <section className="pub-noprint pub-section" aria-label={t('Votre décision', 'Your decision')}>
      <div className="pub-choices">
        <Choice
          active={panel === 'accept'}
          onClick={() => pick('accept')}
          icon={<CheckCircle2 size={26} />}
          title={t('Approuver', 'Approve')}
          text={t('Accepter la soumission et signer', 'Accept the quote and sign')}
        />
        <Choice
          active={panel === 'decline'}
          onClick={() => pick('decline')}
          icon={<XCircle size={26} />}
          title={t('Refuser', 'Decline')}
          text={t('Ne pas donner suite', 'Do not proceed')}
        />
        <Choice
          active={panel === 'changes'}
          onClick={() => pick('changes')}
          icon={<Pencil size={26} />}
          title={t('Demander des modifications', 'Request changes')}
          text={t('Nous ajusterons la soumission', 'We will revise the quote')}
        />
      </div>
      {panel && (
        <div className="pub-card pub-panel" id="pub-panel">
          {panel === 'accept' && <AcceptForm quote={quote} onSubmit={onRespond} />}
          {panel === 'decline' && <DeclineForm onSubmit={onRespond} />}
          {panel === 'changes' && <ChangesForm onSubmit={onRespond} />}
        </div>
      )}
    </section>
  );
}

function Choice({ active, onClick, icon, title, text }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; text: string }) {
  return (
    <button type="button" className={`pub-choice${active ? ' on' : ''}`} aria-expanded={active} aria-controls={active ? 'pub-panel' : undefined} onClick={onClick}>
      <span className="pub-choice-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="pub-choice-title">{title}</span>
      <span className="pub-choice-text">{text}</span>
    </button>
  );
}

function AcceptForm({ quote, onSubmit }: { quote: PublicQuote; onSubmit: (b: RespondBody) => Promise<void> }) {
  const { t, fmtNum, fmtMoney } = useI18n();
  const [qty, setQty] = useState<number | null>(quote.lines.length === 1 ? quote.lines[0].quantity : null);
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [ink, setInk] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const resetCanvas = useCallback(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    resetCanvas();
  }, [resetCanvas]);

  /** Pointer position in canvas pixels (works for mouse, pen and touch). */
  const pointAt = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  };

  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointAt(e);
    lastPoint.current = p;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1); // a single tap leaves a dot
    ctx.stroke();
    setInk(true);
  };

  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const last = lastPoint.current;
    const ctx = e.currentTarget.getContext('2d');
    if (!last || !ctx) return;
    const p = pointAt(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
  };

  const onUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    lastPoint.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const clear = () => {
    resetCanvas();
    setInk(false);
  };

  const valid = qty !== null && name.trim().length >= 2 && ink && agree;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busyRef.current || !valid || qty === null) return;
    const signature = canvasRef.current?.toDataURL('image/png') ?? '';
    if (!signature || signature.length > MAX_SIGNATURE_CHARS) {
      setError(t('Signature trop volumineuse. Effacez-la et recommencez.', 'Signature too large. Clear it and try again.'));
      return;
    }
    setError('');
    busyRef.current = true;
    setBusy(true);
    try {
      await onSubmit({ decision: 'accept', quantity: qty, signedName: name.trim(), signature });
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <form className="pub-form" onSubmit={submit} noValidate>
      <h2 className="pub-form-title">{t('Approuver la soumission', 'Approve the quote')}</h2>

      <fieldset className="pub-fieldset">
        <legend className="pub-label">{t('Quantité', 'Quantity')}</legend>
        <div className="pub-qty-list">
          {quote.lines.map((l, i) => (
            <label key={`${l.quantity}-${i}`} className={`pub-qty${qty === l.quantity ? ' on' : ''}`}>
              <input type="radio" name="pub-qty" value={l.quantity} checked={qty === l.quantity} onChange={() => setQty(l.quantity)} />
              <span className="pub-qty-text">
                <strong>
                  {fmtNum(l.quantity)} {t('unités', 'units')}
                </strong>
                <span className="pub-qty-price">
                  {fmtMoney(l.total, quote.currency)} ({fmtMoney(l.unitPrice, quote.currency)} / {t('unité', 'unit')})
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="pub-field">
        <span className="pub-label">{t('Nom complet (signature)', 'Full name (signature)')}</span>
        <input className="pub-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required aria-required="true" />
      </label>

      <div className="pub-field">
        <span className="pub-label" id="pub-sig-label">
          {t('Signature', 'Signature')}
        </span>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="pub-canvas"
          role="img"
          aria-labelledby="pub-sig-label"
          aria-describedby="pub-sig-help"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        <div className="pub-sig-row">
          <small id="pub-sig-help" className="pub-help">
            {t('Signez avec la souris ou le doigt.', 'Sign with your mouse or finger.')}
          </small>
          <button type="button" className="btn btn-ghost btn-sm" onClick={clear} disabled={!ink && !busy}>
            <Eraser size={14} aria-hidden="true" /> {t('Effacer', 'Clear')}
          </button>
        </div>
      </div>

      <label className="pub-check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>{t('J’accepte cette soumission et ses conditions', 'I accept this quote and its terms')}</span>
      </label>

      {error && (
        <div className="alert alert-err" role="alert">
          <AlertCircle size={16} aria-hidden="true" /> {error}
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-lg pub-submit" disabled={!valid || busy}>
        {busy ? <Butterfly size={20} color="currentColor" flutter /> : <FileSignature size={18} aria-hidden="true" />}
        {t('Confirmer mon approbation', 'Confirm my approval')}
      </button>
    </form>
  );
}

function DeclineForm({ onSubmit }: { onSubmit: (b: RespondBody) => Promise<void> }) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    const choice = DECLINE_REASONS.find((r) => r.value === reason);
    if (!choice) {
      setError(t('Choisissez une raison.', 'Choose a reason.'));
      return;
    }
    const note = comments.trim();
    setError('');
    busyRef.current = true;
    setBusy(true);
    try {
      await onSubmit({ decision: 'decline', reason: note ? `${choice.fr}: ${note}` : choice.fr });
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <form className="pub-form" onSubmit={submit} noValidate>
      <h2 className="pub-form-title">{t('Refuser la soumission', 'Decline the quote')}</h2>
      <label className="pub-field">
        <span className="pub-label">
          {t('Raison', 'Reason')} <span className="pub-req" aria-hidden="true">*</span>
        </span>
        <select className="pub-input" value={reason} onChange={(e) => setReason(e.target.value)} required aria-required="true">
          <option value="">{t('Choisir…', 'Choose…')}</option>
          {DECLINE_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {t(r.fr, r.en)}
            </option>
          ))}
        </select>
      </label>
      <label className="pub-field">
        <span className="pub-label">{t('Commentaires (facultatif)', 'Comments (optional)')}</span>
        <textarea className="pub-input" value={comments} onChange={(e) => setComments(e.target.value)} rows={4} />
      </label>
      {error && (
        <div className="alert alert-err" role="alert">
          <AlertCircle size={16} aria-hidden="true" /> {error}
        </div>
      )}
      <button type="submit" className="btn btn-primary btn-lg pub-submit" disabled={busy}>
        {busy && <Butterfly size={20} color="currentColor" flutter />}
        {t('Confirmer le refus', 'Confirm decline')}
      </button>
    </form>
  );
}

function ChangesForm({ onSubmit }: { onSubmit: (b: RespondBody) => Promise<void> }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    const reason = text.trim();
    if (!reason) {
      setError(t('Décrivez les modifications souhaitées.', 'Describe the changes you would like.'));
      return;
    }
    setError('');
    busyRef.current = true;
    setBusy(true);
    try {
      await onSubmit({ decision: 'changes', comments: reason });
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <form className="pub-form" onSubmit={submit} noValidate>
      <h2 className="pub-form-title">{t('Demander des modifications', 'Request changes')}</h2>
      <label className="pub-field">
        <span className="pub-label">
          {t('Que souhaitez-vous modifier ?', 'What would you like to change?')} <span className="pub-req" aria-hidden="true">*</span>
        </span>
        <textarea className="pub-input" value={text} onChange={(e) => setText(e.target.value)} rows={5} required aria-required="true" />
      </label>
      {error && (
        <div className="alert alert-err" role="alert">
          <AlertCircle size={16} aria-hidden="true" /> {error}
        </div>
      )}
      <button type="submit" className="btn btn-primary btn-lg pub-submit" disabled={busy}>
        {busy && <Butterfly size={20} color="currentColor" flutter />}
        {t('Envoyer la demande', 'Send request')}
      </button>
    </form>
  );
}
