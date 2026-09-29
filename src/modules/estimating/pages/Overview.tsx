import { Link, useNavigate } from 'react-router-dom';
import { Plus, FilePen, Send, Trophy, Percent } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Can, PageHeader } from '@/components/ui';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { Butterfly } from '@/components/Butterfly';
import { estimates, materials } from '../stores';
import { EST_STAGES, EstStatusBadge, useEstSettings } from '../ui';
import { priceBreaks } from '../pricing';
import { PACKAGING_TYPES } from '../catalog';
import type { Estimate } from '../types';

/** Headline value of an estimate = price at its first quantity break (provisional model). */
export function useEstimateValue() {
  const { rows: mats } = useCollection(materials);
  const settings = useEstSettings();
  return (e: Estimate) =>
    priceBreaks(e.spec, e.quantities.slice(0, 1), e.marginPct, mats.find((m) => m.id === e.spec.materialId), settings)[0]?.price ?? 0;
}

export function EstimatingKpis() {
  const { t, fmtMoney } = useI18n();
  const { rows } = useCollection(estimates);
  const value = useEstimateValue();
  const open = rows.filter((r) => r.status === 'draft' || r.status === 'costing');
  const sent = rows.filter((r) => r.status === 'sent');
  const decided = rows.filter((r) => r.status === 'won' || r.status === 'lost');
  const winRate = decided.length ? Math.round((rows.filter((r) => r.status === 'won').length / decided.length) * 100) : 0;
  return (
    <KpiGrid>
      <Kpi to="/estimating/list?status=open" label={t('À chiffrer', 'To estimate')} value={open.length} icon={<FilePen size={17} />} tone="accent" />
      <Kpi to="/estimating/list?status=sent" label={t('Soumises en attente', 'Awaiting customer')} value={sent.length} hint={fmtMoney(sent.reduce((s, e) => s + value(e), 0))} icon={<Send size={17} />} tone="warn" />
      <Kpi label={t('Acceptées', 'Won')} value={rows.filter((r) => r.status === 'won').length} icon={<Trophy size={17} />} tone="ok" />
      <Kpi label={t('Taux de succès', 'Win rate')} value={`${winRate} %`} icon={<Percent size={17} />} />
    </KpiGrid>
  );
}

export function EstimatesTodo() {
  const { t, fmtDate } = useI18n();
  const { rows } = useCollection(estimates);
  const todo = rows
    .filter((r) => r.status === 'draft' || r.status === 'costing')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);
  if (!todo.length) return <div className="widget-empty">{t('Aucune estimation en attente.', 'No estimates waiting.')}</div>;
  return (
    <ul className="widget-list">
      {todo.map((e) => (
        <li key={e.id}>
          <Link to={`/estimating/${e.id}`} className="widget-list-main">
            <strong>{e.customer}</strong> <span className="faint">— {e.project}</span>
          </Link>
          <span className="faint small">{fmtDate(e.dueDate)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Overview() {
  const { t, fmtDate, fmtMoney } = useI18n();
  const nav = useNavigate();
  const { rows } = useCollection(estimates);
  const value = useEstimateValue();
  const recent = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const counts = EST_STAGES.map((s) => rows.filter((r) => r.status === s.key).length);

  return (
    <Page>
      <PageHeader
        eyebrow={t('Estimation', 'Estimating')}
        title={t('Estimations d’emballage', 'Packaging estimates')}
        subtitle={t('Du besoin du client jusqu’au prix soumis : boîtes pliantes, ondulé, rigide, présentoirs et co-packing.', 'From customer need to quoted price: folding cartons, corrugated, rigid, displays and co-packing.')}
        actions={
          <Can permission="estimating.edit">
            <Link to="/estimating/new" className="btn btn-primary">
              <Plus size={16} /> {t('Nouvelle estimation', 'New estimate')}
            </Link>
          </Can>
        }
      />
      <EstimatingKpis />

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>{t('Métamorphose des estimations', 'Estimate metamorphosis')}</h3>
        <div className="pipeline">
          {EST_STAGES.map((s, i) => {
            const Icon = s.icon;
            return (
              <Link key={s.key} to={`/estimating/list?status=${s.key}`} className="pipeline-step" style={{ ['--i' as string]: i }}>
                <div className="pipeline-icon">{Icon === 'butterfly' ? <Butterfly size={26} color="currentColor" /> : Icon ? <Icon size={22} /> : null}</div>
                <div className="pipeline-count">{counts[i]}</div>
                <div className="pipeline-label">{t(s.label)}</div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>{t('Récemment modifiées', 'Recently updated')}</h3>
          <Link to="/estimating/list" className="btn btn-ghost btn-sm">
            {t('Tout voir', 'View all')}
          </Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>No</th>
                <th>{t('Client', 'Customer')}</th>
                <th>{t('Projet', 'Project')}</th>
                <th>{t('Type', 'Type')}</th>
                <th>{t('Échéance', 'Due')}</th>
                <th>{t('Statut', 'Status')}</th>
                <th className="num">{t('Valeur', 'Value')}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((e) => (
                <tr key={e.id} className="clickable" onClick={() => nav(`/estimating/${e.id}`)}>
                  <td className="mono">{e.no}</td>
                  <td>{e.customer}</td>
                  <td className="muted">{e.project}</td>
                  <td>{t(PACKAGING_TYPES.find((p) => p.key === e.spec.type)!.label)}</td>
                  <td className="muted">{fmtDate(e.dueDate)}</td>
                  <td>
                    <EstStatusBadge status={e.status} />
                  </td>
                  <td className="num">{fmtMoney(value(e))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  );
}
