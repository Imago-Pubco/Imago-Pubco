import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Search, Wallet } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { Empty, PageHeader } from '@/components/ui';
import type { BcInvoiceRow } from '../orders';
import { bcInvoices } from '../stores';
import { BcSyncButton } from './PoWorkspace';

const DAY = 864e5;
/** Whole days from today to the due date: negative = overdue. */
const daysTo = (due: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(due + 'T00:00:00').getTime() - today.getTime()) / DAY);
};
const amountOf = (r: BcInvoiceRow) => r.remaining ?? r.total;

type Bucket = 'all' | 'overdue' | 'week' | 'month' | 'later';
const bucketOf = (r: BcInvoiceRow): Exclude<Bucket, 'all'> => {
  const d = r.dueDate ? daysTo(r.dueDate) : 999;
  return d < 0 ? 'overdue' : d <= 7 ? 'week' : d <= 30 ? 'month' : 'later';
};

/**
 * Invoices still to settle, from the Business Central invoices kept in sync:
 *  - purchase (outgoing money): vendor invoices we must pay;
 *  - sales (incoming money): customer invoices we are waiting to collect.
 * "Open" in BC means posted and not fully paid; a payment recorded in BC removes the line at the next sync.
 */
export function OpenItemsPage({ kind }: { kind: 'purchase' | 'sales' }) {
  const { t, fmtDate, fmtMoney } = useI18n();
  const { rows } = useCollection(bcInvoices);
  const [q, setQ] = useState('');
  const [bucket, setBucket] = useState<Bucket>('all');
  const pay = kind === 'purchase';

  const mine = useMemo(() => rows.filter((r) => r.kind === kind), [rows, kind]);
  const open = useMemo(() => mine.filter((r) => r.status === 'Open' && amountOf(r) > 0), [mine]);
  const drafts = useMemo(() => mine.filter((r) => r.status === 'Draft' || r.status === 'In Review'), [mine]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return open
      .filter((r) => bucket === 'all' || bucketOf(r) === bucket)
      .filter((r) => !s || [r.no, r.externalDocNo, r.partyName, r.partyNo].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  }, [open, q, bucket]);

  /** Sums per currency, shown together when more than one currency is in play. */
  const sum = (items: BcInvoiceRow[]) => {
    const by = new Map<string, number>();
    for (const r of items) by.set(r.currency, (by.get(r.currency) ?? 0) + amountOf(r));
    return [...by].map(([c, v]) => fmtMoney(v, c)).join(' + ') || fmtMoney(0, 'CAD');
  };
  const overdue = open.filter((r) => bucketOf(r) === 'overdue');
  const week = open.filter((r) => bucketOf(r) === 'week');

  const BUCKETS: [Bucket, string, number][] = [
    ['all', t('Toutes', 'All'), open.length],
    ['overdue', t('En retard', 'Overdue'), overdue.length],
    ['week', t('7 jours', '7 days'), week.length],
    ['month', t('30 jours', '30 days'), open.filter((r) => bucketOf(r) === 'month').length],
    ['later', t('Plus tard', 'Later'), open.filter((r) => bucketOf(r) === 'later').length],
  ];

  return (
    <Page wide>
      <PageHeader
        eyebrow={pay ? t('Sortant — Fournisseurs', 'Outgoing — Vendors') : t('Entrant — Clients', 'Incoming — Customers')}
        title={pay ? t('À payer', 'To pay') : t('À recevoir', 'To collect')}
        subtitle={
          pay
            ? t('Factures fournisseurs comptabilisées dans Business Central et non payées. Un paiement saisi dans BC disparaît ici à la prochaine synchronisation.', 'Vendor invoices posted in Business Central and not yet paid. A payment recorded in BC disappears here at the next sync.')
            : t('Factures clients comptabilisées dans Business Central et non encaissées. Un encaissement saisi dans BC disparaît ici à la prochaine synchronisation.', 'Customer invoices posted in Business Central and not yet collected. A receipt recorded in BC disappears here at the next sync.')
        }
        actions={<BcSyncButton />}
      />

      <KpiGrid>
        <Kpi label={pay ? t('Total à payer', 'Total to pay') : t('Total à recevoir', 'Total to collect')} value={sum(open)} hint={t(`${open.length} facture(s)`, `${open.length} invoice(s)`)} icon={<Wallet size={17} />} tone="accent" />
        <Kpi label={t('En retard', 'Overdue')} value={sum(overdue)} hint={t(`${overdue.length} facture(s)`, `${overdue.length} invoice(s)`)} icon={<CalendarClock size={17} />} tone={overdue.length ? 'warn' : undefined} />
        <Kpi label={t('Échéant dans 7 jours', 'Due in 7 days')} value={sum(week)} hint={t(`${week.length} facture(s)`, `${week.length} invoice(s)`)} icon={<CalendarClock size={17} />} />
        <Kpi
          label={pay ? t('À comptabiliser dans BC', 'To post in BC') : t('Brouillons BC', 'BC drafts')}
          value={drafts.length}
          hint={t('Brouillons non comptabilisés', 'Drafts not posted yet')}
          icon={<CheckCircle2 size={17} />}
        />
      </KpiGrid>

      <div className="row row-wrap" style={{ margin: '16px 0', gap: 10 }}>
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          {BUCKETS.map(([k, label, n]) => (
            <button key={k} className={`tab ${bucket === k ? 'active' : ''}`} onClick={() => setBucket(k)}>
              {label}
              <span className="faint small" style={{ marginLeft: 6 }}>{n}</span>
            </button>
          ))}
        </div>
        <span className="spacer" />
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingLeft: 34 }} placeholder={t('Rechercher…', 'Search…')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card">
        {list.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Échéance', 'Due')}</th>
                  <th>{pay ? t('Fournisseur', 'Vendor') : t('Client', 'Customer')}</th>
                  <th>{t('Facture BC', 'BC invoice')}</th>
                  <th>{pay ? t('N° du fournisseur', 'Vendor invoice no.') : t('N° du client (PO)', 'Customer PO no.')}</th>
                  <th>{t('Date', 'Date')}</th>
                  <th className="num">Total</th>
                  <th className="num">{pay ? t('À payer', 'To pay') : t('À recevoir', 'To collect')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const d = r.dueDate ? daysTo(r.dueDate) : null;
                  return (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {r.dueDate ? fmtDate(r.dueDate) : '—'}
                        {d != null && (
                          <div className={`small ${d < 0 ? '' : 'faint'}`} style={d < 0 ? { color: 'var(--err)' } : undefined}>
                            {d < 0 ? t(`${-d} j de retard`, `${-d} d overdue`) : d === 0 ? t('Aujourd’hui', 'Today') : t(`dans ${d} j`, `in ${d} d`)}
                          </div>
                        )}
                      </td>
                      <td>
                        {r.partyName}
                        <div className="faint small mono">{r.partyNo}</div>
                      </td>
                      <td className="mono">{r.no}</td>
                      <td className="mono">{r.externalDocNo || <span className="faint">—</span>}</td>
                      <td className="muted">{fmtDate(r.invoiceDate)}</td>
                      <td className="num muted">{fmtMoney(r.total, r.currency)}</td>
                      <td className="num">
                        <strong>{fmtMoney(amountOf(r), r.currency)}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<CheckCircle2 size={36} />} title={open.length ? t('Aucune facture dans ce filtre', 'No invoices in this filter') : pay ? t('Rien à payer', 'Nothing to pay') : t('Rien à recevoir', 'Nothing to collect')}>
            {!mine.length && t('Cliquez sur « Synchroniser BC » pour récupérer les factures.', 'Click “Sync BC” to fetch the invoices.')}
          </Empty>
        )}
      </div>
    </Page>
  );
}
