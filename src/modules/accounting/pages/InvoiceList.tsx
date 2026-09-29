import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, FileStack } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import { Stages } from '@/components/Stages';
import { invoices } from '../stores';
import { INVOICE_STAGES, LevelBadge, STAGE_LABEL, StageBadge, stageIndex } from '../ui';
import type { InvoiceStage } from '../types';

const FILTERS: (InvoiceStage | 'all')[] = ['all', 'extracted', 'validated', 'posted', 'rejected'];

export function InvoiceList() {
  const { t, fmtMoney, fmtDate } = useI18n();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const stage = (params.get('stage') as InvoiceStage | null) ?? 'all';
  const [q, setQ] = useState('');
  const { rows } = useCollection(invoices);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((i) => stage === 'all' || i.stage === stage)
      .filter((i) => !s || [i.vendorName, i.invoiceNo, i.poNo].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [rows, stage, q]);

  return (
    <Page>
      <PageHeader eyebrow={t('Comptabilité', 'Accounting')} title={t('Factures fournisseurs', 'Vendor invoices')} />
      <div className="row row-wrap" style={{ marginBottom: 16 }}>
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`tab ${stage === f ? 'active' : ''}`}
              onClick={() => setParams(f === 'all' ? {} : { stage: f })}
            >
              {f === 'all' ? t('Toutes', 'All') : t(STAGE_LABEL[f])}
              <span className="faint small" style={{ marginLeft: 6 }}>
                {f === 'all' ? rows.length : rows.filter((r) => r.stage === f).length}
              </span>
            </button>
          ))}
        </div>
        <span className="spacer" />
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder={t('Fournisseur, facture, PO…', 'Vendor, invoice, PO…')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        {filtered.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Métamorphose', 'Metamorphosis')}</th>
                  <th>{t('Fournisseur', 'Vendor')}</th>
                  <th>{t('Facture', 'Invoice')}</th>
                  <th>PO</th>
                  <th>{t('Date', 'Date')}</th>
                  <th>{t('Échéance', 'Due')}</th>
                  <th>{t('Validation BC', 'BC validation')}</th>
                  <th>{t('Statut', 'Status')}</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className="clickable" onClick={() => nav(`/accounting/invoices/${i.id}`)}>
                    <td>
                      <Stages stages={INVOICE_STAGES} current={stageIndex(i.stage)} complete={i.stage === 'posted'} compact />
                    </td>
                    <td>{i.vendorName}</td>
                    <td className="mono">{i.invoiceNo}</td>
                    <td className="mono">{i.poNo}</td>
                    <td className="muted">{fmtDate(i.invoiceDate)}</td>
                    <td className="muted">{fmtDate(i.dueDate)}</td>
                    <td>{i.match ? <LevelBadge level={i.match.level} /> : '—'}</td>
                    <td>
                      <StageBadge stage={i.stage} />
                    </td>
                    <td className="num">{fmtMoney(i.total, i.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<FileStack size={36} />} title={t('Aucune facture', 'No invoices')}>
            {t('Importez des factures depuis la boîte de réception.', 'Import invoices from the inbox.')}
          </Empty>
        )}
      </div>
    </Page>
  );
}
