import { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Pencil, Save, X, Send, Ban, RotateCcw, Mail, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection, uid } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Can, Modal, useToast } from '@/components/ui';
import { Stages } from '@/components/Stages';
import { Butterfly } from '@/components/Butterfly';
import { invoices } from '../stores';
import { approveAndPost, rejectInvoice, reopenInvoice, runMatching, saveInvoice } from '../service';
import { INVOICE_STAGES, LevelBadge, LevelIcon, StageBadge, stageIndex } from '../ui';
import type { Invoice } from '../types';

const ACTION_LABEL: Record<string, [string, string]> = {
  received: ['Courriel reçu', 'E-mail received'],
  extracted: ['Données extraites', 'Data extracted'],
  matched: ['Validation Business Central', 'Business Central validation'],
  edited: ['Facture modifiée', 'Invoice edited'],
  approved: ['Approuvée', 'Approved'],
  posted: ['Comptabilisée dans BC', 'Posted to BC'],
  rejected: ['Rejetée', 'Rejected'],
  reopened: ['Réouverte', 'Reopened'],
};

export function InvoiceDetail() {
  const { id } = useParams();
  const { t, fmtMoney, fmtDate, fmtNum } = useI18n();
  const { user, can } = useAuth();
  const userName = useUserName();
  const toast = useToast();
  const { rows, loading } = useCollection(invoices);
  const inv = rows.find((r) => r.id === id);

  const [draft, setDraft] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => setDraft(null), [id]);

  if (loading) return null;
  if (!inv)
    return (
      <Page>
        <p>{t('Facture introuvable.', 'Invoice not found.')}</p>
        <Link to="/accounting/invoices">{t('Retour', 'Back')}</Link>
      </Page>
    );

  const editing = !!draft;
  const view = draft ?? inv;
  const match = inv.match;
  const locked = inv.stage === 'posted' || inv.stage === 'rejected';
  const failing = match?.level === 'fail';
  const canOverride = can('accounting.invoices.override');

  const act = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key);
    try {
      await fn();
      toast(okMsg);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(null);
    }
  };

  const setLine = (lineId: string, patch: Partial<Invoice['lines'][number]>) =>
    setDraft((d) => d && { ...d, lines: d.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) });

  return (
    <Page>
      <Link to="/accounting/invoices" className="btn btn-ghost btn-sm" style={{ marginBottom: 12, marginLeft: -10 }}>
        <ArrowLeft size={16} /> {t('Factures', 'Invoices')}
      </Link>

      <div className="page-head">
        <div>
          <div className="eyebrow">{view.vendorName}</div>
          <h1>
            {t('Facture', 'Invoice')} <span className="mono">{view.invoiceNo}</span>
          </h1>
          <div className="row" style={{ marginTop: 8 }}>
            <StageBadge stage={inv.stage} />
            {match && <LevelBadge level={match.level} />}
            {inv.bcInvoiceNo && <span className="badge mono">BC {inv.bcInvoiceNo}</span>}
          </div>
        </div>
        <div className="row row-wrap">
          {editing ? (
            <>
              <button className="btn" onClick={() => setDraft(null)}>
                <X size={16} /> {t('Annuler', 'Cancel')}
              </button>
              <button
                className="btn btn-primary"
                disabled={!!busy}
                onClick={() =>
                  act('save', async () => {
                    await saveInvoice(draft!, user!.id);
                    setDraft(null);
                  }, t('Enregistrée et revalidée', 'Saved and re-validated'))
                }
              >
                <Save size={16} /> {t('Enregistrer et valider', 'Save & validate')}
              </button>
            </>
          ) : (
            <>
              {!locked && (
                <Can permission="accounting.invoices.validate">
                  <button
                    className="btn"
                    disabled={!!busy}
                    onClick={() => act('match', () => runMatching(inv.id, user!.id), t('Validation terminée', 'Validation complete'))}
                  >
                    <RefreshCw size={16} className={busy === 'match' ? 'spin' : ''} /> {t('Revalider avec BC', 'Re-validate with BC')}
                  </button>
                </Can>
              )}
              {!locked && (
                <Can permission="accounting.invoices.edit">
                  <button className="btn" onClick={() => setDraft(structuredClone(inv))}>
                    <Pencil size={16} /> {t('Corriger', 'Correct')}
                  </button>
                </Can>
              )}
              {!locked && (
                <Can permission="accounting.invoices.approve">
                  <button className="btn btn-danger" onClick={() => { setNote(''); setRejectOpen(true); }}>
                    <Ban size={16} /> {t('Rejeter', 'Reject')}
                  </button>
                </Can>
              )}
              {inv.stage === 'rejected' && (
                <Can permission="accounting.invoices.approve">
                  <button className="btn" onClick={() => act('reopen', () => reopenInvoice(inv.id, user!.id), t('Facture réouverte', 'Invoice reopened'))}>
                    <RotateCcw size={16} /> {t('Réouvrir', 'Reopen')}
                  </button>
                </Can>
              )}
              {!locked && (
                <Can permission="accounting.invoices.post">
                  <button
                    className="btn btn-primary"
                    disabled={!match || (failing && !canOverride)}
                    title={failing && !canOverride ? t('Exceptions à résoudre', 'Resolve exceptions first') : ''}
                    onClick={() => { setNote(''); setPostOpen(true); }}
                  >
                    <Send size={16} /> {t('Approuver et comptabiliser', 'Approve & post')}
                  </button>
                </Can>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <Stages stages={INVOICE_STAGES} current={stageIndex(inv.stage)} complete={inv.stage === 'posted'} />
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <h3>{t('En-tête de facture', 'Invoice header')}</h3>
            {inv.mailId && (
              <Link to="/accounting/inbox" className="btn btn-ghost btn-sm">
                <Mail size={14} /> {inv.sourceFile}
              </Link>
            )}
          </div>
          <div className="card-pad form-grid">
            {(
              [
                ['vendorName', t('Fournisseur', 'Vendor')],
                ['invoiceNo', t('No facture', 'Invoice no.')],
                ['poNo', t('No bon de commande', 'PO no.')],
                ['invoiceDate', t('Date', 'Date')],
                ['dueDate', t('Échéance', 'Due date')],
                ['currency', t('Devise', 'Currency')],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="field">
                <span>{label}</span>
                {editing ? (
                  <input
                    className="input"
                    type={k.endsWith('Date') ? 'date' : 'text'}
                    value={draft![k]}
                    onChange={(e) => setDraft({ ...draft!, [k]: e.target.value })}
                  />
                ) : (
                  <div className={k === 'invoiceNo' || k === 'poNo' ? 'mono' : ''} style={{ fontWeight: 500 }}>
                    {k.endsWith('Date') ? fmtDate(view[k]) : view[k] || '—'}
                  </div>
                )}
              </label>
            ))}
            <div className="field">
              <span>{t('No fournisseur BC', 'BC vendor no.')}</span>
              <div className="mono">{view.vendorNo ?? '—'}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>{t('Validation Business Central', 'Business Central validation')}</h3>
            {match && <span className="faint small">{fmtDate(match.at, true)}</span>}
          </div>
          <div className="card-pad stack" style={{ gap: 10 }}>
            {match ? (
              <>
                {match.header.map((c) => (
                  <div key={c.code} className="check-row">
                    <LevelIcon level={c.level} />
                    <span>{t(c.message)}</span>
                  </div>
                ))}
                <div className="check-row">
                  <LevelIcon level={match.lines.every((l) => l.level === 'ok') ? 'ok' : match.lines.some((l) => l.level === 'fail') ? 'fail' : 'warn'} />
                  <span>
                    {t(
                      `${match.lines.filter((l) => l.level === 'ok').length} / ${match.lines.length} lignes conformes (quantités reçues et prix).`,
                      `${match.lines.filter((l) => l.level === 'ok').length} / ${match.lines.length} lines match (received quantities and prices).`,
                    )}
                  </span>
                </div>
              </>
            ) : (
              <span className="faint">{t('Pas encore validée.', 'Not validated yet.')}</span>
            )}
            {inv.overrideNote && (
              <div className="alert alert-warn">
                <span>
                  <strong>{t('Dérogation', 'Override')} :</strong> {inv.overrideNote}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>{t('Lignes — facture vs bon de commande vs réception', 'Lines — invoice vs PO vs receipt')}</h3>
          {editing && (
            <button
              className="btn btn-sm"
              onClick={() =>
                setDraft({
                  ...draft!,
                  lines: [...draft!.lines, { id: uid('l_'), itemNo: '', description: '', uom: 'UN', quantity: 1, unitPrice: 0 }],
                })
              }
            >
              <Plus size={14} /> {t('Ligne', 'Line')}
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table className="table match-table">
            <thead>
              <tr>
                <th></th>
                <th>{t('Article', 'Item')}</th>
                <th>Description</th>
                <th className="num">{t('Qté fact.', 'Inv. qty')}</th>
                <th className="num">{t('Commandé', 'Ordered')}</th>
                <th className="num">{t('Reçu', 'Received')}</th>
                <th className="num">{t('Déjà fact.', 'Prev. inv.')}</th>
                <th className="num">{t('Prix fact.', 'Inv. price')}</th>
                <th className="num">{t('Prix BC', 'PO price')}</th>
                <th className="num">{t('Écart', 'Var.')}</th>
                <th className="num">{t('Montant', 'Amount')}</th>
                {editing && <th></th>}
              </tr>
            </thead>
            <tbody>
              {view.lines.map((l) => {
                const m = match?.lines.find((x) => x.invoiceLineId === l.id);
                const issues = m?.checks.filter((c) => c.level !== 'ok') ?? [];
                return (
                  <Fragment key={l.id}>
                    <tr className={m ? `lvl-${m.level}` : ''}>
                      <td>{m && !editing ? <LevelIcon level={m.level} /> : null}</td>
                      <td className="mono">
                        {editing ? <input className="input input-sm" value={l.itemNo} onChange={(e) => setLine(l.id, { itemNo: e.target.value })} /> : l.itemNo}
                      </td>
                      <td>
                        {editing ? <input className="input input-sm" value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} /> : l.description}
                        {!editing && <div className="faint small">{l.uom}</div>}
                      </td>
                      <td className="num">
                        {editing ? (
                          <input className="input input-sm num" style={{ width: 80 }} type="number" value={l.quantity} onChange={(e) => setLine(l.id, { quantity: +e.target.value })} />
                        ) : (
                          <strong>{fmtNum(l.quantity)}</strong>
                        )}
                      </td>
                      <td className="num muted">{m?.orderedQty != null ? fmtNum(m.orderedQty) : '—'}</td>
                      <td className="num muted">{m?.receivedQty != null ? fmtNum(m.receivedQty) : '—'}</td>
                      <td className="num muted">{m?.alreadyInvoicedQty != null ? fmtNum(m.alreadyInvoicedQty) : '—'}</td>
                      <td className="num">
                        {editing ? (
                          <input className="input input-sm num" style={{ width: 90 }} type="number" step="0.0001" value={l.unitPrice} onChange={(e) => setLine(l.id, { unitPrice: +e.target.value })} />
                        ) : (
                          fmtMoney(l.unitPrice, inv.currency)
                        )}
                      </td>
                      <td className="num muted">{m?.poUnitCost != null ? fmtMoney(m.poUnitCost, inv.currency) : '—'}</td>
                      <td className="num" style={{ color: m?.priceVariancePct ? (Math.abs(m.priceVariancePct) > 0 ? 'var(--warn)' : undefined) : undefined }}>
                        {m?.priceVariancePct != null ? `${m.priceVariancePct > 0 ? '+' : ''}${fmtNum(m.priceVariancePct, 1)} %` : '—'}
                      </td>
                      <td className="num">{fmtMoney(l.quantity * l.unitPrice, inv.currency)}</td>
                      {editing && (
                        <td>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDraft({ ...draft!, lines: draft!.lines.filter((x) => x.id !== l.id) })}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                    {!editing && issues.length > 0 && (
                      <tr className="issue-row">
                        <td></td>
                        <td colSpan={10}>
                          {issues.map((c) => (
                            <div key={c.code} className="check-row small">
                              <LevelIcon level={c.level} size={14} />
                              {t(c.message)}
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="totals">
          <div>
            <span>{t('Sous-total', 'Subtotal')}</span>
            <span>{fmtMoney(editing ? view.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) : view.subtotal, inv.currency)}</span>
          </div>
          <div>
            <span>{t('Taxes', 'Taxes')}</span>
            {editing ? (
              <input className="input input-sm num" style={{ width: 120 }} type="number" step="0.01" value={draft!.tax} onChange={(e) => setDraft({ ...draft!, tax: +e.target.value })} />
            ) : (
              <span>{fmtMoney(view.tax, inv.currency)}</span>
            )}
          </div>
          <div className="grand">
            <span>Total</span>
            <span>{fmtMoney(editing ? view.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) + view.tax : view.total, inv.currency)}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>{t('Historique', 'History')}</h3>
        </div>
        <ol className="timeline">
          {[...inv.history].reverse().map((h, i) => (
            <li key={i}>
              <div className="tl-dot" />
              <div>
                <div style={{ fontWeight: 500 }}>
                  {ACTION_LABEL[h.action] ? t(...ACTION_LABEL[h.action]) : h.action}
                  {h.note && <span className="muted"> — {h.note}</span>}
                </div>
                <div className="faint small">
                  {userName(h.userId)} · {fmtDate(h.at, true)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <Modal
        open={postOpen}
        onClose={() => setPostOpen(false)}
        title={t('Comptabiliser dans Business Central', 'Post to Business Central')}
        footer={
          <>
            <button className="btn" onClick={() => setPostOpen(false)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button
              className="btn btn-primary"
              disabled={!!busy || (failing && note.trim().length < 5)}
              onClick={() =>
                act('post', async () => {
                  await approveAndPost(inv.id, user!.id, failing ? note.trim() : undefined);
                  setPostOpen(false);
                }, t('Facture comptabilisée — imago atteint', 'Invoice posted — imago reached'))
              }
            >
              {busy === 'post' ? <Butterfly size={18} color="currentColor" flutter /> : <Send size={16} />}
              {t('Comptabiliser', 'Post')}
            </button>
          </>
        }
      >
        <div className="stack">
          <p style={{ margin: 0 }}>
            {t(
              `Une facture d'achat sera créée et comptabilisée dans Business Central contre le bon de commande ${inv.poNo}, pour un total de ${fmtMoney(inv.total, inv.currency)}.`,
              `A purchase invoice will be created and posted in Business Central against PO ${inv.poNo}, for a total of ${fmtMoney(inv.total, inv.currency)}.`,
            )}
          </p>
          {failing && (
            <>
              <div className="alert alert-err">
                {t(
                  'Cette facture comporte des exceptions. Une justification de dérogation est obligatoire.',
                  'This invoice has exceptions. An override justification is required.',
                )}
              </div>
              <label className="field">
                <span>{t('Justification', 'Justification')}</span>
                <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={t('Rejeter la facture', 'Reject invoice')}
        footer={
          <>
            <button className="btn" onClick={() => setRejectOpen(false)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button
              className="btn btn-primary"
              disabled={note.trim().length < 3}
              onClick={() =>
                act('reject', async () => {
                  await rejectInvoice(inv.id, user!.id, note.trim());
                  setRejectOpen(false);
                }, t('Facture rejetée', 'Invoice rejected'))
              }
            >
              {t('Rejeter', 'Reject')}
            </button>
          </>
        }
      >
        <label className="field">
          <span>{t('Motif (communiqué au fournisseur)', 'Reason (shared with vendor)')}</span>
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </Modal>
    </Page>
  );
}

