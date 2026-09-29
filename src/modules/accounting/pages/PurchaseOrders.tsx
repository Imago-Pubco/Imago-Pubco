import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Database } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/ui';
import { bcPurchaseOrders } from '../stores';

export function PurchaseOrders() {
  const { t, fmtDate, fmtMoney, fmtNum } = useI18n();
  const { rows } = useCollection(bcPurchaseOrders);
  const [open, setOpen] = useState<string | null>(null);
  const sorted = useMemo(() => [...rows].sort((a, b) => b.no.localeCompare(a.no)), [rows]);

  return (
    <Page>
      <PageHeader
        eyebrow="Business Central"
        title={t('Bons de commande', 'Purchase orders')}
        subtitle={t('Commandé, reçu et facturé par ligne.', 'Ordered, received and invoiced per line.')}
        actions={
          <span className="badge badge-warn">
            <Database size={13} /> {t('Données simulées (dev)', 'Simulated data (dev)')}
          </span>
        }
      />
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>No</th>
                <th>{t('Fournisseur', 'Vendor')}</th>
                <th>{t('Date', 'Date')}</th>
                <th>{t('Statut', 'Status')}</th>
                <th>{t('Réception', 'Receipt')}</th>
                <th>{t('Facturation', 'Invoicing')}</th>
                <th className="num">{t('Montant', 'Amount')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((po) => {
                const ord = po.lines.reduce((s, l) => s + l.quantity, 0);
                const rec = po.lines.reduce((s, l) => s + l.quantityReceived, 0);
                const inv = po.lines.reduce((s, l) => s + l.quantityInvoiced, 0);
                const amount = po.lines.reduce((s, l) => s + l.quantity * l.directUnitCost, 0);
                const isOpen = open === po.id;
                return (
                  <Fragment key={po.id}>
                    <tr className="clickable" onClick={() => setOpen(isOpen ? null : po.id)}>
                      <td>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                      <td className="mono">{po.no}</td>
                      <td>
                        {po.vendorName}
                        <div className="faint small mono">{po.vendorNo}</div>
                      </td>
                      <td className="muted">{fmtDate(po.orderDate)}</td>
                      <td>
                        <span className="badge badge-info">{po.status}</span>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <Bar value={rec} max={ord} />
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <Bar value={inv} max={ord} />
                      </td>
                      <td className="num">{fmtMoney(amount, po.currency)}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td></td>
                        <td colSpan={7} style={{ background: 'var(--bg-sunken)' }}>
                          <table className="table">
                            <thead>
                              <tr>
                                <th>{t('Ligne', 'Line')}</th>
                                <th>{t('Article', 'Item')}</th>
                                <th>Description</th>
                                <th>UM</th>
                                <th className="num">{t('Commandé', 'Ordered')}</th>
                                <th className="num">{t('Reçu', 'Received')}</th>
                                <th className="num">{t('Facturé', 'Invoiced')}</th>
                                <th className="num">{t('Coût unitaire', 'Unit cost')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {po.lines.map((l) => (
                                <tr key={l.lineNo}>
                                  <td className="mono faint">{l.lineNo}</td>
                                  <td className="mono">{l.itemNo}</td>
                                  <td>{l.description}</td>
                                  <td>{l.uom}</td>
                                  <td className="num">{fmtNum(l.quantity)}</td>
                                  <td className="num">{fmtNum(l.quantityReceived)}</td>
                                  <td className="num">{fmtNum(l.quantityInvoiced)}</td>
                                  <td className="num">{fmtMoney(l.directUnitCost, po.currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="row" style={{ gap: 8 }}>
      <div className="bar">
        <div style={{ width: `${pct}%` }} />
      </div>
      <span className="small faint" style={{ minWidth: 36 }}>
        {Math.round(pct)} %
      </span>
    </div>
  );
}
