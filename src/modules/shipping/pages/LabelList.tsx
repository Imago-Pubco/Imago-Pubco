import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Tags, Package, Truck, Printer } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { useI18n, type L } from '@/i18n';
import { Page } from '@/components/Page';
import { Can, Empty, PageHeader } from '@/components/ui';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { Stages, METAMORPHOSIS, type StageDef } from '@/components/Stages';
import { labels } from '../stores';
import type { LabelStatus } from '../types';

export const LABEL_STAGES: StageDef[] = [
  { ...METAMORPHOSIS[0], key: 'draft', label: { fr: 'Brouillon', en: 'Draft' } },
  { ...METAMORPHOSIS[1], key: 'ready', label: { fr: 'Prête', en: 'Ready' } },
  { ...METAMORPHOSIS[2], key: 'printed', label: { fr: 'Imprimée', en: 'Printed' } },
  { ...METAMORPHOSIS[3], key: 'shipped', label: { fr: 'Expédiée', en: 'Shipped' } },
];
export const labelStageIndex = (s: LabelStatus) => ({ draft: 0, ready: 1, printed: 2, shipped: 3, void: 0 })[s];

export const LABEL_STATUS: Record<LabelStatus, [L, string]> = {
  draft: [{ fr: 'Brouillon', en: 'Draft' }, ''],
  ready: [{ fr: 'Prête', en: 'Ready' }, 'badge-info'],
  printed: [{ fr: 'Imprimée', en: 'Printed' }, 'badge-warn'],
  shipped: [{ fr: 'Expédiée', en: 'Shipped' }, 'badge-ok'],
  void: [{ fr: 'Annulée', en: 'Void' }, 'badge-err'],
};

export function LabelStatusBadge({ status }: { status: LabelStatus }) {
  const { t } = useI18n();
  const [l, cls] = LABEL_STATUS[status];
  return <span className={`badge ${cls}`}>{t(l)}</span>;
}

export function ShippingKpis() {
  const { t } = useI18n();
  const { rows } = useCollection(labels);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <KpiGrid>
      <Kpi to="/shipping" label={t('Brouillons', 'Drafts')} value={rows.filter((r) => r.status === 'draft').length} icon={<Tags size={17} />} tone="accent" />
      <Kpi to="/shipping" label={t('À imprimer', 'To print')} value={rows.filter((r) => r.status === 'ready').length} icon={<Printer size={17} />} tone="warn" />
      <Kpi label={t('Expédiées aujourd’hui', 'Shipped today')} value={rows.filter((r) => r.shippedAt?.startsWith(today)).length} icon={<Truck size={17} />} tone="ok" />
      <Kpi label={t('Colis ce mois', 'Packages this month')} value={rows.filter((r) => r.createdAt.startsWith(today.slice(0, 7)) && r.status !== 'void').reduce((s, r) => s + r.packages.length, 0)} icon={<Package size={17} />} />
    </KpiGrid>
  );
}

export function LabelList() {
  const { t, fmtDate } = useI18n();
  const nav = useNavigate();
  const userName = useUserName();
  const { rows } = useCollection(labels);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<LabelStatus | 'all'>('all');

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return rows
      .filter((r) => status === 'all' || r.status === status)
      .filter((r) => !s || [r.no, r.shipTo.name, r.jobNo, r.customerPo, r.trackingNo ?? ''].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [rows, q, status]);

  return (
    <Page>
      <PageHeader
        eyebrow={t('Production', 'Production')}
        title={t('Étiquettes d’expédition', 'Shipping labels')}
        actions={
          <Can permission="shipping.labels.create">
            <Link to="/shipping/new" className="btn btn-primary">
              <Plus size={16} /> {t('Nouvelle étiquette', 'New label')}
            </Link>
          </Can>
        }
      />
      <ShippingKpis />
      <div className="row row-wrap" style={{ marginBottom: 16 }}>
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          {(['all', 'draft', 'ready', 'printed', 'shipped', 'void'] as const).map((s) => (
            <button key={s} className={`tab ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
              {s === 'all' ? t('Toutes', 'All') : t(LABEL_STATUS[s][0])}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingLeft: 34 }} placeholder={t('No, client, job, suivi…', 'No., customer, job, tracking…')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="card">
        {filtered.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Métamorphose', 'Metamorphosis')}</th>
                  <th>No</th>
                  <th>{t('Destinataire', 'Ship to')}</th>
                  <th>Job</th>
                  <th>{t('Transporteur', 'Carrier')}</th>
                  <th className="num">{t('Colis', 'Pkgs')}</th>
                  <th>{t('Créée', 'Created')}</th>
                  <th>{t('Statut', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => nav(`/shipping/${r.id}`)}>
                    <td>
                      <Stages stages={LABEL_STAGES} current={labelStageIndex(r.status)} complete={r.status === 'shipped'} compact />
                    </td>
                    <td className="mono">{r.no}</td>
                    <td>
                      {r.shipTo.name}
                      <div className="faint small">
                        {r.shipTo.city}, {r.shipTo.province}
                      </div>
                    </td>
                    <td className="mono">{r.jobNo}</td>
                    <td>
                      {r.carrier}
                      <div className="faint small">{r.trackingNo ?? r.service}</div>
                    </td>
                    <td className="num">{r.packages.length}</td>
                    <td className="muted small">
                      {fmtDate(r.createdAt, true)}
                      <div className="faint">{userName(r.createdBy)}</div>
                    </td>
                    <td>
                      <LabelStatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<Tags size={36} />} title={t('Aucune étiquette', 'No labels')} />
        )}
      </div>
    </Page>
  );
}

/** Dashboard widget: labels still to finish (drafts, ready, printed). */
export function LabelsTodo() {
  const { t } = useI18n();
  const { rows } = useCollection(labels);
  const todo = rows
    .filter((r) => r.status === 'draft' || r.status === 'ready' || r.status === 'printed')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  if (!todo.length) return <div className="widget-empty">{t('Rien à expédier.', 'Nothing to ship.')}</div>;
  return (
    <ul className="widget-list">
      {todo.map((r) => (
        <li key={r.id}>
          <Link to={`/shipping/${r.id}`} className="widget-list-main">
            <span className="mono">{r.no}</span> <span className="faint">— {r.shipTo.name}</span>
          </Link>
          <LabelStatusBadge status={r.status} />
        </li>
      ))}
    </ul>
  );
}
