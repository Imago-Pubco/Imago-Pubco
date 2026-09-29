import { Link, useNavigate } from 'react-router-dom';
import { Inbox, AlertOctagon, CheckCheck, Timer } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/ui';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { Butterfly } from '@/components/Butterfly';
import { invoices, mailbox } from '../stores';
import { INVOICE_STAGES, LevelBadge, StageBadge } from '../ui';

export function useAccountingStats() {
  const { rows: inv } = useCollection(invoices);
  const { rows: mail } = useCollection(mailbox);
  const unprocessed = mail.filter((m) => !m.invoiceId && !m.archived && m.attachments.length).length;
  const exceptions = inv.filter((i) => i.stage === 'extracted' && i.match?.level === 'fail').length;
  const ready = inv.filter((i) => i.stage === 'validated').length;
  const month = new Date().toISOString().slice(0, 7);
  const postedMonth = inv.filter((i) => i.stage === 'posted' && i.postedAt?.startsWith(month));
  return {
    inv,
    unprocessed,
    exceptions,
    ready,
    postedCount: postedMonth.length,
    postedAmount: postedMonth.reduce((s, i) => s + i.total, 0),
    counts: [
      unprocessed,
      inv.filter((i) => i.stage === 'extracted').length,
      ready,
      inv.filter((i) => i.stage === 'posted').length,
    ],
  };
}

/** Metamorphosis pipeline: how many invoices sit at each life stage. */
export function InvoicePipeline() {
  const { t } = useI18n();
  const { counts } = useAccountingStats();
  const targets = ['inbox', 'invoices?stage=extracted', 'invoices?stage=validated', 'invoices?stage=posted'];
  return (
    <div className="pipeline">
      {INVOICE_STAGES.map((s, i) => {
        const Icon = s.icon;
        return (
          <Link key={s.key} to={`/accounting/${targets[i]}`} className="pipeline-step" style={{ ['--i' as string]: i }}>
            <div className="pipeline-icon">
              {Icon === 'butterfly' ? <Butterfly size={26} color="currentColor" /> : Icon ? <Icon size={22} /> : null}
            </div>
            <div className="pipeline-count">{counts[i]}</div>
            <div className="pipeline-label">{t(s.label)}</div>
          </Link>
        );
      })}
    </div>
  );
}

export function AccountingKpis() {
  const { t, fmtMoney } = useI18n();
  const s = useAccountingStats();
  return (
    <KpiGrid>
      <Kpi to="/accounting/inbox" label={t('Courriels à traiter', 'E-mails to process')} value={s.unprocessed} icon={<Inbox size={17} />} tone="accent" />
      <Kpi to="/accounting/invoices?stage=extracted" label={t('Exceptions', 'Exceptions')} value={s.exceptions} icon={<AlertOctagon size={17} />} tone={s.exceptions ? 'err' : undefined} hint={t('Écarts avec BC', 'Mismatches with BC')} />
      <Kpi to="/accounting/invoices?stage=validated" label={t('Prêtes à comptabiliser', 'Ready to post')} value={s.ready} icon={<Timer size={17} />} tone="warn" />
      <Kpi label={t('Comptabilisées ce mois', 'Posted this month')} value={s.postedCount} hint={fmtMoney(s.postedAmount)} icon={<CheckCheck size={17} />} tone="ok" />
    </KpiGrid>
  );
}

export function Overview() {
  const { t, fmtMoney, fmtDate } = useI18n();
  const nav = useNavigate();
  const { inv } = useAccountingStats();
  const recent = [...inv].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  return (
    <Page>
      <PageHeader
        eyebrow={t('Comptabilité', 'Accounting')}
        title={t('Comptes fournisseurs', 'Accounts payable')}
        subtitle={t(
          'Des factures reçues par courriel jusqu’à leur comptabilisation dans Business Central.',
          'From invoices received by e-mail all the way to posting in Business Central.',
        )}
        actions={
          <Link to="/accounting/inbox" className="btn btn-primary">
            <Inbox size={16} /> {t('Ouvrir la boîte de réception', 'Open inbox')}
          </Link>
        }
      />
      <AccountingKpis />
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>{t('Métamorphose des factures', 'Invoice metamorphosis')}</h3>
        <InvoicePipeline />
      </div>
      <div className="card">
        <div className="card-head">
          <h3>{t('Activité récente', 'Recent activity')}</h3>
          <Link to="/accounting/invoices" className="btn btn-ghost btn-sm">
            {t('Tout voir', 'View all')}
          </Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Fournisseur', 'Vendor')}</th>
                <th>{t('Facture', 'Invoice')}</th>
                <th>PO</th>
                <th>{t('Reçue', 'Received')}</th>
                <th>{t('Validation', 'Validation')}</th>
                <th>{t('Étape', 'Stage')}</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((i) => (
                <tr key={i.id} className="clickable" onClick={() => nav(`/accounting/invoices/${i.id}`)}>
                  <td>{i.vendorName}</td>
                  <td className="mono">{i.invoiceNo}</td>
                  <td className="mono">{i.poNo}</td>
                  <td className="muted">{fmtDate(i.createdAt)}</td>
                  <td>{i.match ? <LevelBadge level={i.match.level} /> : '—'}</td>
                  <td>
                    <StageBadge stage={i.stage} />
                  </td>
                  <td className="num">{fmtMoney(i.total, i.currency)}</td>
                </tr>
              ))}
              {!recent.length && (
                <tr>
                  <td colSpan={7} className="faint" style={{ textAlign: 'center', padding: 32 }}>
                    {t(
                      'Aucune facture importée. Commencez par la boîte de réception.',
                      'No invoices imported yet. Start from the inbox.',
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  );
}

/** Dashboard widget: invoices waiting for action. */
export function InvoicesTodo() {
  const { t, fmtMoney } = useI18n();
  const { inv } = useAccountingStats();
  const todo = inv
    .filter((i) => i.stage === 'extracted' || i.stage === 'validated')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);
  if (!todo.length)
    return <div className="widget-empty">{t('Aucune facture en attente.', 'No invoices waiting.')}</div>;
  return (
    <ul className="widget-list">
      {todo.map((i) => (
        <li key={i.id}>
          <Link to={`/accounting/invoices/${i.id}`} className="widget-list-main">
            <strong>{i.vendorName}</strong> <span className="mono faint">#{i.invoiceNo}</span>
          </Link>
          {i.match ? <LevelBadge level={i.match.level} /> : <StageBadge stage={i.stage} />}
          <span className="small num">{fmtMoney(i.total, i.currency)}</span>
        </li>
      ))}
    </ul>
  );
}
