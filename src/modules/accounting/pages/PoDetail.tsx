import { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, FileText, Pencil, Plus, RefreshCw, RotateCcw, Save, Send, Trash2, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Can, Modal, useToast } from '@/components/ui';
import { poFlow } from '../integrations';
import type { PoRecord } from '../orders';
import { poRecords } from '../stores';
import { LevelBadge, LevelIcon, PoStageBadge } from '../ui';

const ACTION_LABEL: Record<string, [string, string]> = {
  received: ['Document reçu', 'Document received'],
  matched: ['Rapprochement avec Business Central', 'Matched with Business Central'],
  edited: ['Document modifié', 'Document edited'],
  approved: ['Approuvé', 'Approved'],
  invoiced: ['Facture créée dans BC', 'Invoice created in BC'],
  confirmed: ['Confirmé', 'Confirmed'],
  rejected: ['Rejeté', 'Rejected'],
  reopened: ['Rouvert', 'Reopened'],
};

export function PoDetail() {
  const { id } = useParams();
  const { t, fmtMoney, fmtDate, fmtNum } = useI18n();
  const { can } = useAuth();
  const userName = useUserName();
  const toast = useToast();
  const { rows, loading } = useCollection(poRecords);
  const po = rows.find((r) => r.id === id);

  const [draft, setDraft] = useState<PoRecord | null>(null);
  const [busy, setBusy] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => setDraft(null), [id]);

  const back = po?.direction === 'vendor' ? '/accounting/purchase-orders' : '/accounting/customers/purchase-orders';
  if (loading) return null;
  if (!po)
    return (
      <Page>
        <p>{t('Bon de commande introuvable.', 'Purchase order not found.')}</p>
        <Link to="/accounting/customers/purchase-orders">{t('Retour', 'Back')}</Link>
      </Page>
    );

  const customer = po.direction === 'customer';
  const editing = !!draft;
  const view = draft ?? po;
  const locked = po.stage === 'invoiced' || po.stage === 'confirmed' || po.stage === 'rejected';
  const match = po.match;
  const failing = match?.level === 'fail';

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy('');
    }
  };

  const setLine = (lid: string, patch: Partial<PoRecord['lines'][number]>) =>
    setDraft((d) => (d ? { ...d, lines: d.lines.map((l) => (l.id === lid ? { ...l, ...patch } : l)) } : d));

  const save = () =>
    act(
      'save',
      async () => {
        const d = draft!;
        const total = Math.round(d.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * 100) / 100;
        await poRecords.update(po.id, {
          poNo: d.poNo.trim(),
          partyName: d.partyName.trim(),
          poDate: d.poDate,
          currency: d.currency.trim().toUpperCase(),
          lines: d.lines,
          total,
        });
        setDraft(null);
        await poFlow.rematch(po.id);
      },
      t('Enregistré et rapproché avec Business Central', 'Saved and matched with Business Central'),
    );

  const canApprove = can('accounting.po.approve');
  const canOverride = can('accounting.invoices.override');
  const approveLabel = customer ? t('Approuver et créer la facture', 'Approve & create invoice') : t('Confirmer', 'Confirm');

  return (
    <Page>
      <Link to={back} className="btn btn-ghost btn-sm" style={{ marginBottom: 12, marginLeft: -10 }}>
        <ArrowLeft size={16} /> {t('Bons de commande', 'Purchase orders')}
      </Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">{view.partyName}</div>
          <h1>
            {t('Bon de commande', 'Purchase order')} <span className="mono">{view.poNo || '—'}</span>
          </h1>
          <div className="row" style={{ marginTop: 8 }}>
            <PoStageBadge stage={po.stage} />
            <span className="badge badge-accent">{customer ? t('Client', 'Customer') : t('Fournisseur', 'Vendor')}</span>
            {po.bcOrderNo && <span className="badge mono">BC {po.bcOrderNo}</span>}
            {po.bcInvoiceNo && <span className="badge badge-ok mono">{t('Facture', 'Invoice')} {po.bcInvoiceNo}</span>}
            {match && <LevelBadge level={match.level} />}
            {po.automated && <span className="badge">{t('Automatique', 'Automatic')}</span>}
          </div>
        </div>
        <div className="row row-wrap">
          {editing ? (
            <>
              <button className="btn" onClick={() => setDraft(null)}>
                <X size={16} /> {t('Annuler', 'Cancel')}
              </button>
              <button className="btn btn-primary" disabled={busy === 'save'} onClick={save}>
                <Save size={16} /> {t('Enregistrer', 'Save')}
              </button>
            </>
          ) : (
            <>
              {!locked && (
                <Can permission="accounting.po.process">
                  <button className="btn" onClick={() => setDraft(structuredClone(po))}>
                    <Pencil size={16} /> {t('Corriger', 'Edit')}
                  </button>
                  <button className="btn" disabled={busy === 'match'} onClick={() => act('match', () => poFlow.rematch(po.id), t('Rapprochement terminé', 'Match complete'))}>
                    <RefreshCw size={16} className={busy === 'match' ? 'spin' : ''} /> {t('Rapprocher', 'Match')}
                  </button>
                </Can>
              )}
              {!locked && canApprove && (
                <>
                  <button className="btn btn-danger" onClick={() => { setNote(''); setRejectOpen(true); }}>
                    <Ban size={16} /> {t('Rejeter', 'Reject')}
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={!match || (failing && !canOverride)}
                    title={failing && !canOverride ? t('Exceptions : permission de dérogation requise.', 'Exceptions: override permission required.') : undefined}
                    onClick={() => { setNote(''); setApproveOpen(true); }}
                  >
                    <Send size={16} /> {approveLabel}
                  </button>
                </>
              )}
              {po.stage === 'rejected' && canApprove && (
                <button className="btn" disabled={busy === 'reopen'} onClick={() => act('reopen', () => poFlow.reopen(po.id), t('Bon de commande rouvert', 'Purchase order reopened'))}>
                  <RotateCcw size={16} /> {t('Rouvrir', 'Reopen')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <h3>{t('Document', 'Document')}</h3>
            {po.fileId && (
              <a className="btn btn-ghost btn-sm" href={`/api/files/${po.fileId}`} target="_blank" rel="noreferrer">
                <FileText size={14} /> PDF
              </a>
            )}
            <Link to="/accounting/inbox/documents/purchase-orders" className="btn btn-ghost btn-sm">
              {t('Documents', 'Documents')}
            </Link>
          </div>
          <div className="card-pad form-grid">
            <label className="field">
              <span>{t('N° de bon de commande', 'PO number')}</span>
              {editing ? <input className="input" value={view.poNo} onChange={(e) => setDraft({ ...draft!, poNo: e.target.value })} /> : <div className="mono">{view.poNo || '—'}</div>}
            </label>
            <label className="field">
              <span>{customer ? t('Client', 'Customer') : t('Fournisseur', 'Vendor')}</span>
              {editing ? <input className="input" value={view.partyName} onChange={(e) => setDraft({ ...draft!, partyName: e.target.value })} /> : <div>{view.partyName}</div>}
            </label>
            <label className="field">
              <span>{t('Date', 'Date')}</span>
              {editing ? <input className="input" type="date" value={view.poDate} onChange={(e) => setDraft({ ...draft!, poDate: e.target.value })} /> : <div>{fmtDate(view.poDate)}</div>}
            </label>
            <label className="field">
              <span>{t('Devise', 'Currency')}</span>
              {editing ? <input className="input" value={view.currency} onChange={(e) => setDraft({ ...draft!, currency: e.target.value })} /> : <div>{view.currency || '—'}</div>}
            </label>
            <div className="field">
              <span>{customer ? t('N° de client BC', 'BC customer no.') : t('N° de fournisseur BC', 'BC vendor no.')}</span>
              <div className="mono">{po.partyNo ?? '—'}</div>
            </div>
            <div className="field">
              <span>{t('Commande BC', 'BC order')}</span>
              <div className="mono">{po.bcOrderNo ?? '—'}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>{t('Rapprochement avec Business Central', 'Business Central match')}</h3>
            {match && <span className="faint small">{fmtDate(match.at, true)}</span>}
          </div>
          <div className="card-pad stack" style={{ gap: 10 }}>
            {match ? (
              match.header.map((c) => (
                <div key={c.code} className="check-row">
                  <LevelIcon level={c.level} />
                  <span>{t(c.message)}</span>
                </div>
              ))
            ) : (
              <span className="faint">{t('Pas encore rapproché.', 'Not matched yet.')}</span>
            )}
            {failing && (
              <div className="alert alert-err">
                {t('Des exceptions bloquent l’approbation. Corrigez le document, ou approuvez avec une justification écrite (dérogation).', 'Exceptions block approval. Correct the document, or approve with a written justification (override).')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>{t('Lignes', 'Lines')}</h3>
          {editing && (
            <button className="btn btn-sm" onClick={() => setDraft({ ...draft!, lines: [...draft!.lines, { id: uid('l_'), itemNo: '', description: '', uom: '', quantity: 1, unitPrice: 0 }] })}>
              <Plus size={14} /> {t('Ligne', 'Line')}
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table className="table match-table">
            <thead>
              <tr>
                <th />
                <th>{t('Article', 'Item')}</th>
                <th className="num">{t('Qté', 'Qty')}</th>
                <th className="num">{t('Commandé BC', 'BC ordered')}</th>
                <th className="num">{customer ? t('Expédié', 'Shipped') : t('Reçu', 'Received')}</th>
                <th className="num">{t('Déjà facturé', 'Invoiced')}</th>
                <th className="num">{t('Prix', 'Price')}</th>
                <th className="num">{t('Prix BC', 'BC price')}</th>
                <th className="num">{t('Montant', 'Amount')}</th>
                {editing && <th />}
              </tr>
            </thead>
            <tbody>
              {view.lines.map((l) => {
                const m = match?.lines.find((x) => x.invoiceLineId === l.id);
                const issues = m?.checks.filter((c) => c.level !== 'ok') ?? [];
                return (
                  <Fragment key={l.id}>
                    <tr>
                      <td>{m ? <LevelIcon level={m.level} /> : null}</td>
                      <td>
                        {editing ? (
                          <>
                            <input className="input input-sm" value={l.itemNo} placeholder={t('N° article', 'Item no.')} onChange={(e) => setLine(l.id, { itemNo: e.target.value })} />
                            <input className="input input-sm" style={{ marginTop: 4 }} value={l.description} placeholder="Description" onChange={(e) => setLine(l.id, { description: e.target.value })} />
                          </>
                        ) : (
                          <>
                            <span className="mono">{l.itemNo}</span>
                            <div className="faint small">{l.description}</div>
                          </>
                        )}
                      </td>
                      <td className="num">
                        {editing ? <input className="input input-sm num" style={{ width: 80 }} type="number" value={l.quantity} onChange={(e) => setLine(l.id, { quantity: Number(e.target.value) })} /> : fmtNum(l.quantity)}
                      </td>
                      <td className="num muted">{m?.orderedQty != null ? fmtNum(m.orderedQty) : '—'}</td>
                      <td className="num muted">{m?.receivedQty != null ? fmtNum(m.receivedQty) : '—'}</td>
                      <td className="num muted">{m?.alreadyInvoicedQty != null ? fmtNum(m.alreadyInvoicedQty) : '—'}</td>
                      <td className="num">
                        {editing ? <input className="input input-sm num" style={{ width: 90 }} type="number" step="0.0001" value={l.unitPrice} onChange={(e) => setLine(l.id, { unitPrice: Number(e.target.value) })} /> : fmtMoney(l.unitPrice, view.currency || 'CAD')}
                      </td>
                      <td className="num muted">{m?.poUnitCost != null ? fmtMoney(m.poUnitCost, view.currency || 'CAD') : '—'}</td>
                      <td className="num">{fmtMoney(l.quantity * l.unitPrice, view.currency || 'CAD')}</td>
                      {editing && (
                        <td>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDraft({ ...draft!, lines: draft!.lines.filter((x) => x.id !== l.id) })} aria-label={t('Retirer', 'Remove')}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                    {!editing && issues.length > 0 && (
                      <tr className="issue-row">
                        <td />
                        <td colSpan={8}>
                          {issues.map((c) => (
                            <div key={c.code} className="check-row small">
                              <LevelIcon level={c.level} size={14} />
                              <span>{t(c.message)}</span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!view.lines.length && (
                <tr>
                  <td colSpan={9} className="faint" style={{ textAlign: 'center', padding: 20 }}>
                    {t('Aucune ligne lue. Cliquez sur Corriger pour les saisir.', 'No lines read. Click Edit to enter them.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="totals">
          <div className="grand">
            <span>Total</span>
            <strong>{fmtMoney(view.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), view.currency || 'CAD')}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>{t('Historique', 'History')}</h3>
        </div>
        <ol className="timeline">
          {po.history.map((h, i) => {
            const label = ACTION_LABEL[h.action];
            return (
              <li key={i}>
                <div className="tl-dot" />
                <div>
                  <strong>{label ? t(label[0], label[1]) : h.action}</strong>
                  {h.note && <span className="muted"> — {h.note}</span>}
                  <div className="faint small">
                    {fmtDate(h.at, true)} · {h.userId ? userName(h.userId) : '—'}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title={approveLabel}
        footer={
          <>
            <button className="btn" onClick={() => setApproveOpen(false)}>{t('Annuler', 'Cancel')}</button>
            <button
              className="btn btn-primary"
              disabled={busy === 'approve' || (failing && !note.trim())}
              onClick={() =>
                act('approve', async () => {
                  await poFlow.approve(po.id, failing ? note.trim() : undefined);
                  setApproveOpen(false);
                }, customer ? t('Facture créée dans Business Central', 'Invoice created in Business Central') : t('Bon de commande confirmé', 'Purchase order confirmed'))
              }
            >
              {approveLabel}
            </button>
          </>
        }
      >
        <div className="stack">
          {customer ? (
            <p style={{ margin: 0 }}>{t('Une facture client sera créée dans Business Central à partir de ce bon de commande.', 'A sales invoice will be created in Business Central from this purchase order.')}</p>
          ) : (
            <p style={{ margin: 0 }}>{t('La confirmation du fournisseur sera enregistrée. Sa facture suivra le circuit des factures fournisseurs.', 'The vendor’s confirmation will be recorded. Its invoice follows the vendor-invoice flow.')}</p>
          )}
          {failing && (
            <>
              <div className="alert alert-err">{t('Des exceptions subsistent : une justification écrite est requise.', 'Exceptions remain: a written justification is required.')}</div>
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
        title={t('Rejeter le bon de commande', 'Reject purchase order')}
        footer={
          <>
            <button className="btn" onClick={() => setRejectOpen(false)}>{t('Annuler', 'Cancel')}</button>
            <button
              className="btn btn-primary"
              disabled={!note.trim() || busy === 'reject'}
              onClick={() =>
                act('reject', async () => {
                  await poFlow.reject(po.id, note.trim());
                  setRejectOpen(false);
                }, t('Bon de commande rejeté', 'Purchase order rejected'))
              }
            >
              {t('Rejeter', 'Reject')}
            </button>
          </>
        }
      >
        <label className="field">
          <span>{t('Motif', 'Reason')}</span>
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
        </label>
      </Modal>
    </Page>
  );
}
