import { useMemo, useState } from 'react';
import { FileStack, Search } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import { bcInvoices } from '../stores';
import { BcSyncButton } from './PoWorkspace';

/** BC statuses worth a filter: Draft, In Review, Open (posted, unpaid), Paid. */
const STATUSES = ['all', 'Draft', 'Open', 'Paid'] as const;

/** Invoices created in Business Central, kept in sync here. `kind` picks customers' (sales) or vendors' (purchase). */
export function BcInvoicesTable({ kind }: { kind: 'sales' | 'purchase' }) {
  const { t, fmtDate, fmtMoney } = useI18n();
  const { rows } = useCollection(bcInvoices);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const sales = kind === 'sales';

  const mine = useMemo(() => rows.filter((r) => r.kind === kind), [rows, kind]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return mine
      .filter((r) => status === 'all' || r.status === status || (status === 'Draft' && r.status === 'In Review'))
      .filter((r) => !s || [r.no, r.externalDocNo, r.partyName, r.partyNo].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  }, [mine, q, status]);

  const badge = (st: string) => (st === 'Paid' ? 'badge-ok' : st === 'Open' ? 'badge-info' : st === 'Canceled' ? 'badge-err' : 'badge-warn');

  return (
    <>
      <div className="row row-wrap" style={{ margin: '12px 16px', gap: 10 }}>
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          {STATUSES.map((s) => (
            <button key={s} className={`tab ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
              {s === 'all' ? t('Toutes', 'All') : s === 'Draft' ? t('Brouillons', 'Drafts') : s === 'Open' ? t('Ouvertes', 'Open') : t('Payées', 'Paid')}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingLeft: 34 }} placeholder={t('Rechercher…', 'Search…')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {filtered.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Facture BC', 'BC invoice')}</th>
                <th>{sales ? t('N° du client (PO)', 'Customer PO no.') : t('N° du fournisseur', 'Vendor invoice no.')}</th>
                <th>{sales ? t('Client', 'Customer') : t('Fournisseur', 'Vendor')}</th>
                <th>{t('Date', 'Date')}</th>
                <th>{t('Échéance', 'Due')}</th>
                <th>{t('Statut BC', 'BC status')}</th>
                <th className="num">Total</th>
                <th className="num">{sales ? t('À recevoir', 'To collect') : t('À payer', 'To pay')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.no}</td>
                  <td className="mono">{r.externalDocNo || <span className="faint">—</span>}</td>
                  <td>{r.partyName}</td>
                  <td className="muted">{fmtDate(r.invoiceDate)}</td>
                  <td className="muted">{fmtDate(r.dueDate)}</td>
                  <td>
                    <span className={`badge ${badge(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="num">{fmtMoney(r.total, r.currency)}</td>
                  <td className="num">{r.remaining != null ? fmtMoney(r.remaining, r.currency) : <span className="faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon={<FileStack size={36} />} title={t('Aucune facture synchronisée', 'No invoices synced')}>
          {t('Cliquez sur « Synchroniser BC » pour les récupérer.', 'Click “Sync BC” to fetch them.')}
        </Empty>
      )}
    </>
  );
}

/** Customers' invoices (sales) created in Business Central, including those created from received POs. */
export function CustomerInvoicesPage() {
  const { t } = useI18n();
  return (
    <Page wide>
      <PageHeader
        eyebrow={t('Entrant — Clients', 'Incoming — Customers')}
        title={t('Factures clients', 'Customer invoices')}
        subtitle={t('Factures de vente créées dans Business Central, synchronisées ici.', 'Sales invoices created in Business Central, synced here.')}
        actions={<BcSyncButton />}
      />
      <div className="card">
        <BcInvoicesTable kind="sales" />
      </div>
    </Page>
  );
}
