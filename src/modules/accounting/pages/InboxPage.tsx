import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw, Paperclip, FileText, ArrowRight, MailOpen, Wand2 } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Can, Empty, PageHeader, useToast } from '@/components/ui';
import { Butterfly } from '@/components/Butterfly';
import { getSettings, mailbox } from '../stores';
import { mailboxConnector } from '../integrations';
import { importFromMail } from '../service';

export function InboxPage() {
  const { t, fmtDate, fmtMoney } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { rows } = useCollection(mailbox);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [address, setAddress] = useState('');

  useEffect(() => {
    getSettings().then((s) => setAddress(s.mailbox));
  }, []);

  const messages = useMemo(() => [...rows].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)), [rows]);
  const selected = messages.find((m) => m.id === selectedId) ?? messages[0];

  useEffect(() => {
    if (selected && !selected.read) mailboxConnector.markRead(selected.id);
  }, [selected]);

  const sync = async () => {
    setSyncing(true);
    const n = await mailboxConnector.sync();
    setSyncing(false);
    toast(n ? t(`${n} nouveau courriel`, `${n} new e-mail`) : t('Aucun nouveau courriel', 'No new e-mail'));
  };

  const doImport = async () => {
    if (!selected || !user) return;
    setImporting(true);
    try {
      const inv = await importFromMail(selected.id, user.id);
      toast(t('Facture extraite et validée avec Business Central', 'Invoice extracted and validated against Business Central'));
      nav(`/accounting/invoices/${inv.id}`);
    } catch (e) {
      toast(String(e), 'err');
    } finally {
      setImporting(false);
    }
  };

  const ex = selected?.attachments.find((a) => a.extracted)?.extracted;

  return (
    <Page wide>
      <PageHeader
        eyebrow={t('Comptabilité', 'Accounting')}
        title={t('Boîte de réception des factures', 'Invoice inbox')}
        subtitle={address}
        actions={
          <button className="btn" onClick={sync} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'spin' : ''} />
            {t('Synchroniser', 'Sync mailbox')}
          </button>
        }
      />
      <div className="mail-layout card">
        <div className="mail-list">
          {messages.map((m) => (
            <button
              key={m.id}
              className={`mail-item ${selected?.id === m.id ? 'active' : ''} ${m.read ? '' : 'unread'}`}
              onClick={() => setSelectedId(m.id)}
            >
              <div className="row">
                <strong className="mail-from">{m.fromName}</strong>
                <span className="spacer" />
                <span className="faint small">{fmtDate(m.receivedAt, true)}</span>
              </div>
              <div className="mail-subject">{m.subject}</div>
              <div className="row small">
                {m.attachments.length > 0 && (
                  <span className="faint row" style={{ gap: 4 }}>
                    <Paperclip size={13} /> {m.attachments[0].name}
                  </span>
                )}
                <span className="spacer" />
                {m.invoiceId ? (
                  <span className="badge badge-ok">{t('Importée', 'Imported')}</span>
                ) : (
                  <span className="badge badge-accent">{t('Nouvelle', 'New')}</span>
                )}
              </div>
            </button>
          ))}
          {!messages.length && <Empty icon={<MailOpen size={36} />} title={t('Boîte vide', 'Inbox empty')} />}
        </div>

        <div className="mail-read">
          {selected ? (
            <>
              <div className="mail-read-head">
                <h2>{selected.subject}</h2>
                <div className="muted small">
                  {selected.fromName} &lt;{selected.from}&gt; · {fmtDate(selected.receivedAt, true)}
                </div>
              </div>
              <pre className="mail-body">{selected.body}</pre>

              {selected.attachments.map((a) => (
                <div key={a.name} className="attachment">
                  <div className="attachment-file">
                    <FileText size={28} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{a.name}</div>
                      <div className="faint small">PDF · {a.sizeKb} Ko</div>
                    </div>
                  </div>
                  {a.extracted && (
                    <div className="extract-preview">
                      <div className="row small" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        <Wand2 size={14} /> {t('Données détectées', 'Detected data')}
                      </div>
                      <dl>
                        <dt>{t('Facture', 'Invoice')}</dt>
                        <dd className="mono">{a.extracted.invoiceNo}</dd>
                        <dt>PO</dt>
                        <dd className="mono">{a.extracted.poNo}</dd>
                        <dt>{t('Lignes', 'Lines')}</dt>
                        <dd>{a.extracted.lines.length}</dd>
                        <dt>Total</dt>
                        <dd>{fmtMoney(a.extracted.total, a.extracted.currency)}</dd>
                      </dl>
                    </div>
                  )}
                </div>
              ))}

              <div className="mail-actions">
                {selected.invoiceId ? (
                  <Link to={`/accounting/invoices/${selected.invoiceId}`} className="btn btn-primary">
                    {t('Voir la facture', 'Open invoice')} <ArrowRight size={16} />
                  </Link>
                ) : ex ? (
                  <Can
                    permission="accounting.invoices.import"
                    fallback={<span className="faint small">{t('Permission requise pour importer.', 'Import permission required.')}</span>}
                  >
                    <button className="btn btn-primary" onClick={doImport} disabled={importing}>
                      {importing ? <Butterfly size={18} color="currentColor" flutter /> : <Wand2 size={16} />}
                      {importing
                        ? t('Métamorphose en cours…', 'Transforming…')
                        : t('Extraire et valider avec BC', 'Extract & validate with BC')}
                    </button>
                  </Can>
                ) : (
                  <span className="faint small">{t('Aucune facture détectée.', 'No invoice detected.')}</span>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
