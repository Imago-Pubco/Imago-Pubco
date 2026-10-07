import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Can, Empty, PageHeader, useToast } from '@/components/ui';
import { bcSync } from '../integrations';
import type { PoDirection } from '../types';
import { poRecords } from '../stores';
import { LevelBadge, PoStageBadge } from '../ui';
import { PurchaseOrdersTable, SalesOrdersTable } from './PurchaseOrders';

/** Sync button + "last synced" label, shared by the pages that show Business Central data. */
export function BcSyncButton({ onDone }: { onDone?: () => void }) {
  const { t, fmtDate } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    bcSync.status().then((s) => {
      setLast(s.lastSync);
      setEnabled(s.enabled);
    }, () => {});
  }, []);

  const run = async () => {
    setBusy(true);
    try {
      const r = await bcSync.run();
      setLast(new Date().toISOString());
      toast(t(`Synchronisé : ${r.salesOrders} commande(s) client, ${r.invoices} facture(s)`, `Synced: ${r.salesOrders} sales order(s), ${r.invoices} invoice(s)`));
      onDone?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row" style={{ gap: 10 }}>
      {last && <span className="faint small">{t('Dernière synchro', 'Last sync')} : {fmtDate(last, true)}</span>}
      <Can permission="accounting.access">
        <button className="btn" onClick={run} disabled={busy || !enabled} title={enabled ? undefined : t('Business Central n’est pas configuré sur le serveur.', 'Business Central is not configured on the server.')}>
          <RefreshCw size={16} className={busy ? 'spin' : ''} /> {t('Synchroniser BC', 'Sync BC')}
        </button>
      </Can>
    </div>
  );
}

/** Purchase orders, one side at a time: received by e-mail and matched, then the Business Central orders. */
export function PoWorkspace({ direction }: { direction: PoDirection }) {
  const { t, fmtDate, fmtMoney } = useI18n();
  const nav = useNavigate();
  const { rows } = useCollection(poRecords);
  const customer = direction === 'customer';

  const mine = useMemo(() => rows.filter((r) => r.direction === direction).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [rows, direction]);

  return (
    <Page wide>
      <PageHeader
        eyebrow={customer ? t('Entrant — Clients', 'Incoming — Customers') : t('Sortant — Fournisseurs', 'Outgoing — Vendors')}
        title={customer ? t('Bons de commande clients', 'Customer purchase orders') : t('Bons de commande fournisseurs', 'Vendor purchase orders')}
        subtitle={
          customer
            ? t('Bons de commande reçus par courriel, rapprochés des commandes client de Business Central; la facture client en découle.', 'Purchase orders received by e-mail, matched with Business Central sales orders; the sales invoice follows.')
            : t('Confirmations de nos commandes reçues par courriel, rapprochées des bons de commande de Business Central.', 'Confirmations of our orders received by e-mail, matched with Business Central purchase orders.')
        }
        actions={<BcSyncButton />}
      />

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3>{t('Reçus par courriel', 'Received by e-mail')}</h3>
          <span className="faint small">{t(`${mine.length} document(s)`, `${mine.length} document(s)`)}</span>
        </div>
        {mine.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('N° de BC', 'PO no.')}</th>
                  <th>{customer ? t('Client', 'Customer') : t('Fournisseur', 'Vendor')}</th>
                  <th>{t('Date', 'Date')}</th>
                  <th>{t('Commande BC', 'BC order')}</th>
                  <th>{t('Rapprochement', 'Match')}</th>
                  <th>{t('Statut', 'Status')}</th>
                  <th>{customer ? t('Facture BC', 'BC invoice') : ''}</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => nav(`/accounting/po/${p.id}`)}>
                    <td className="mono">{p.poNo || '—'}</td>
                    <td>{p.partyName}</td>
                    <td className="muted">{fmtDate(p.poDate)}</td>
                    <td className="mono">{p.bcOrderNo ?? '—'}</td>
                    <td>{p.match ? <LevelBadge level={p.match.level} /> : '—'}</td>
                    <td>
                      <PoStageBadge stage={p.stage} />
                    </td>
                    <td className="mono">{customer ? (p.bcInvoiceNo ?? '—') : ''}</td>
                    <td className="num">{p.total ? fmtMoney(p.total, p.currency || 'CAD') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<ClipboardList size={36} />} title={t('Aucun bon de commande reçu', 'No purchase orders received')}>
            {t('Ils apparaissent ici après avoir été traités depuis Boîte de réception → Documents → Bons de commande.', 'They appear here once processed from Inbox → Documents → Purchase orders.')}
          </Empty>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>{customer ? t('Commandes clients dans Business Central', 'Sales orders in Business Central') : t('Bons de commande dans Business Central', 'Purchase orders in Business Central')}</h3>
        </div>
        {customer ? <SalesOrdersTable /> : <PurchaseOrdersTable />}
      </div>
    </Page>
  );
}
