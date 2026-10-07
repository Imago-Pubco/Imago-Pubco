import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, FolderOpen, Search, Wand2 } from 'lucide-react';
import { useCollection } from '@/data/db';
import { logAudit } from '@/data/stores';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Can, Empty, PageHeader, useToast } from '@/components/ui';
import { classifyAttachment } from '../classify';
import { importFromMail } from '../service';
import { mailbox } from '../stores';
import type { DocType, MailAttachment, MailMessage, PoDirection } from '../types';

export type DocKind = 'all' | DocType;

interface DocRow {
  key: string;
  msg: MailMessage;
  att: MailAttachment;
  index: number;
  docType: DocType;
  poDirection?: PoDirection;
  by: 'ai' | 'rules' | 'user';
}

/** Value used by the "type" dropdown: a document type plus, for a PO, whose PO it is. */
type TypeChoice = 'invoice' | 'po:customer' | 'po:vendor' | 'other';
const choiceOf = (r: Pick<DocRow, 'docType' | 'poDirection'>): TypeChoice =>
  r.docType === 'po' ? (r.poDirection === 'vendor' ? 'po:vendor' : 'po:customer') : r.docType;

export function DocumentsPage({ kind }: { kind: DocKind }) {
  const { t, fmtDate, fmtMoney } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { rows: messages } = useCollection(mailbox);
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState('');

  const all: DocRow[] = useMemo(
    () =>
      messages
        .flatMap((msg) =>
          msg.attachments.map((att, index) => {
            const c = classifyAttachment(att, msg);
            return { key: `${msg.id}:${index}`, msg, att, index, docType: c.docType, poDirection: c.poDirection, by: c.by };
          }),
        )
        .sort((a, b) => b.msg.receivedAt.localeCompare(a.msg.receivedAt)),
    [messages],
  );

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all
      .filter((r) => kind === 'all' || r.docType === kind)
      .filter((r) => !s || [r.att.name, r.msg.subject, r.msg.fromName, r.msg.from, r.att.extracted?.invoiceNo ?? '', r.att.extracted?.poNo ?? ''].some((v) => v.toLowerCase().includes(s)));
  }, [all, kind, q]);

  const count = (k: DocType) => all.filter((r) => r.docType === k).length;

  const reclassify = async (r: DocRow, choice: TypeChoice) => {
    if (!user) return;
    const [type, dir] = choice.split(':') as [DocType, PoDirection | undefined];
    const attachments = r.msg.attachments.map((a, i) =>
      i === r.index ? { ...a, docType: type, poDirection: type === 'po' ? (dir ?? 'customer') : undefined, classifiedBy: 'user' as const } : a,
    );
    try {
      await mailbox.update(r.msg.id, { attachments });
      await logAudit(user.id, 'accounting.document.classify', `${r.att.name} -> ${choice}`);
      toast(t('Classement mis à jour', 'Classification updated'));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    }
  };

  const doImport = async (r: DocRow) => {
    if (!user) return;
    setImporting(r.key);
    try {
      const inv = await importFromMail(r.msg.id, user.id);
      toast(t('Facture extraite et validée avec Business Central', 'Invoice extracted and validated against Business Central'));
      nav(`/accounting/invoices/${inv.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setImporting('');
    }
  };

  const title =
    kind === 'invoice' ? t('Documents — Factures', 'Documents — Invoices') : kind === 'po' ? t('Documents — Bons de commande', 'Documents — Purchase orders') : t('Documents', 'Documents');
  const subtitle =
    kind === 'invoice'
      ? t('Factures détectées dans les courriels reçus.', 'Invoices detected in received e-mail.')
      : kind === 'po'
        ? t('Bons de commande détectés dans les courriels reçus.', 'Purchase orders detected in received e-mail.')
        : t('Tous les PDF reçus, classés automatiquement. Corrigez le type au besoin.', 'Every PDF received, classified automatically. Correct the type if needed.');

  const typeBadge = (r: DocRow) =>
    r.docType === 'invoice' ? (
      <span className="badge badge-info">{t('Facture', 'Invoice')}</span>
    ) : r.docType === 'po' ? (
      <span className="badge badge-accent">{r.poDirection === 'vendor' ? t('BC fournisseur', 'Vendor PO') : t('BC client', 'Customer PO')}</span>
    ) : (
      <span className="badge">{t('À classer', 'Unclassified')}</span>
    );

  return (
    <Page wide>
      <PageHeader eyebrow={t('Boîte de réception', 'Inbox')} title={title} subtitle={subtitle} />

      <div className="row row-wrap" style={{ marginBottom: 16, gap: 10 }}>
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingLeft: 34 }} placeholder={t('Rechercher…', 'Search…')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Link to="/accounting/inbox/documents" className={`chip ${kind === 'all' ? 'on' : ''}`}>
          {t('Tous', 'All')} ({all.length})
        </Link>
        <Link to="/accounting/inbox/documents/invoices" className={`chip ${kind === 'invoice' ? 'on' : ''}`}>
          {t('Factures', 'Invoices')} ({count('invoice')})
        </Link>
        <Link to="/accounting/inbox/documents/purchase-orders" className={`chip ${kind === 'po' ? 'on' : ''}`}>
          {t('Bons de commande', 'Purchase orders')} ({count('po')})
        </Link>
        {kind === 'all' && <span className="faint small">{t(`${count('other')} à classer`, `${count('other')} unclassified`)}</span>}
      </div>

      <div className="card">
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Reçu', 'Received')}</th>
                  <th>{t('Document', 'Document')}</th>
                  <th>{t('De', 'From')}</th>
                  <th>{t('Type', 'Type')}</th>
                  <th>{t('Détecté', 'Detected')}</th>
                  <th>{t('Statut', 'Status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ex = r.att.extracted;
                  const number = r.docType === 'po' ? ex?.poNo : ex?.invoiceNo;
                  return (
                    <tr key={r.key}>
                      <td className="muted small" style={{ whiteSpace: 'nowrap' }}>
                        {fmtDate(r.msg.receivedAt, true)}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <FileText size={16} className="faint" />
                          {r.att.fileId ? (
                            <a href={`/api/files/${r.att.fileId}`} target="_blank" rel="noreferrer">
                              {r.att.name}
                            </a>
                          ) : (
                            r.att.name
                          )}
                        </div>
                        <div className="faint small" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.msg.subject}
                        </div>
                      </td>
                      <td className="muted small">{r.msg.fromName}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          {typeBadge(r)}
                          {r.by === 'ai' && <Wand2 size={13} className="faint" aria-label={t('Classé par l’IA', 'Classified by AI')} />}
                        </div>
                        <Can permission="accounting.inbox.view">
                          <select
                            className="select"
                            style={{ marginTop: 4, width: 'auto', fontSize: 12, padding: '2px 6px' }}
                            value={choiceOf(r)}
                            onChange={(e) => reclassify(r, e.target.value as TypeChoice)}
                            aria-label={t('Changer le type', 'Change type')}
                          >
                            <option value="invoice">{t('Facture', 'Invoice')}</option>
                            <option value="po:customer">{t('Bon de commande — client', 'Purchase order — customer')}</option>
                            <option value="po:vendor">{t('Bon de commande — fournisseur', 'Purchase order — vendor')}</option>
                            <option value="other">{t('Autre', 'Other')}</option>
                          </select>
                        </Can>
                      </td>
                      <td className="small">
                        {number ? <span className="mono">{number}</span> : <span className="faint">—</span>}
                        {ex && ex.total > 0 && <div className="faint">{fmtMoney(ex.total, ex.currency || 'CAD')}</div>}
                      </td>
                      <td>
                        {r.docType === 'invoice' ? (
                          r.msg.invoiceId ? (
                            <Link to={`/accounting/invoices/${r.msg.invoiceId}`} className="badge badge-ok">
                              {t('Importée', 'Imported')}
                            </Link>
                          ) : (
                            <span className="badge badge-accent">{t('À traiter', 'To process')}</span>
                          )
                        ) : r.docType === 'po' ? (
                          <span className="badge badge-accent">{t('Reçu', 'Received')}</span>
                        ) : (
                          <span className="faint small">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {r.docType === 'invoice' && !r.msg.invoiceId && (
                          <Can permission="accounting.invoices.import">
                            <button className="btn btn-sm btn-primary" disabled={importing === r.key} onClick={() => doImport(r)}>
                              {importing === r.key ? t('Import…', 'Importing…') : t('Importer', 'Import')}
                            </button>
                          </Can>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<FolderOpen size={36} />} title={t('Aucun document', 'No documents')} />
        )}
      </div>
    </Page>
  );
}
