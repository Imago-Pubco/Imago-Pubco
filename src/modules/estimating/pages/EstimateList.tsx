import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Calculator } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Can, Empty, PageHeader } from '@/components/ui';
import { Stages } from '@/components/Stages';
import { estimates } from '../stores';
import { EST_STAGES, EST_STATUS, EstStatusBadge, estStageIndex } from '../ui';
import { PACKAGING_TYPES } from '../catalog';
import { useEstimateValue } from './Overview';
import type { EstimateStatus } from '../types';

type Filter = EstimateStatus | 'all' | 'open';
const FILTERS: Filter[] = ['all', 'open', 'sent', 'won', 'lost'];

export function EstimateList() {
  const { t, fmtDate, fmtMoney, fmtNum } = useI18n();
  const nav = useNavigate();
  const userName = useUserName();
  const value = useEstimateValue();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('status') as Filter | null) ?? 'all';
  const [q, setQ] = useState('');
  const { rows } = useCollection(estimates);

  const match = (s: EstimateStatus, f: Filter) => f === 'all' || (f === 'open' ? s === 'draft' || s === 'costing' : s === f);
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return rows
      .filter((r) => match(r.status, filter))
      .filter((r) => !s || [r.no, r.customer, r.project, r.contact].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [rows, filter, q]);

  const label = (f: Filter) => (f === 'all' ? t('Toutes', 'All') : f === 'open' ? t('À chiffrer', 'To estimate') : t(EST_STATUS[f][0]));

  return (
    <Page>
      <PageHeader
        eyebrow={t('Estimation', 'Estimating')}
        title={t('Estimations', 'Estimates')}
        actions={
          <Can permission="estimating.edit">
            <Link to="/estimating/new" className="btn btn-primary">
              <Plus size={16} /> {t('Nouvelle estimation', 'New estimate')}
            </Link>
          </Can>
        }
      />
      <div className="row row-wrap" style={{ marginBottom: 16 }}>
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          {FILTERS.map((f) => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setParams(f === 'all' ? {} : { status: f })}>
              {label(f)}
              <span className="faint small" style={{ marginLeft: 6 }}>
                {rows.filter((r) => match(r.status, f)).length}
              </span>
            </button>
          ))}
        </div>
        <span className="spacer" />
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingLeft: 34 }} placeholder={t('No, client, projet…', 'No., customer, project…')} value={q} onChange={(e) => setQ(e.target.value)} />
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
                  <th>{t('Client / projet', 'Customer / project')}</th>
                  <th>{t('Emballage', 'Packaging')}</th>
                  <th>{t('Quantités', 'Quantities')}</th>
                  <th>{t('Échéance', 'Due')}</th>
                  <th>{t('Responsable', 'Owner')}</th>
                  <th>{t('Statut', 'Status')}</th>
                  <th className="num">{t('Valeur', 'Value')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="clickable" onClick={() => nav(`/estimating/${e.id}`)}>
                    <td>
                      <Stages stages={EST_STAGES} current={estStageIndex(e.status)} complete={e.status === 'won'} compact />
                    </td>
                    <td className="mono">{e.no}</td>
                    <td>
                      {e.customer}
                      <div className="faint small">{e.project}</div>
                    </td>
                    <td>
                      {t(PACKAGING_TYPES.find((p) => p.key === e.spec.type)!.label)}
                      <div className="faint small mono">
                        {e.spec.lengthMm}×{e.spec.widthMm}×{e.spec.heightMm} mm
                      </div>
                    </td>
                    <td className="small">{e.quantities.map((n) => fmtNum(n)).join(' · ')}</td>
                    <td className="muted">{fmtDate(e.dueDate)}</td>
                    <td className="muted small">{userName(e.ownerId)}</td>
                    <td>
                      <EstStatusBadge status={e.status} />
                    </td>
                    <td className="num">{fmtMoney(value(e))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<Calculator size={36} />} title={t('Aucune estimation', 'No estimates')} />
        )}
      </div>
    </Page>
  );
}
