import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, Search } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import { useUsers, Avatar, DueDate, ProgressBar, WoStatusBadge } from '../ui';
import { workOrders } from '../stores';
import { WO_STATUSES, WO_STATUS_LABEL, isOverdue, isOpen, type WorkOrder, type WorkOrderStatus } from '../types';

type Filter = WorkOrderStatus | 'all' | 'open' | 'late';
const FILTERS: Filter[] = ['all', 'open', 'late', ...WO_STATUSES];

const isFilter = (v: string | null): v is Filter => !!v && (FILTERS as string[]).includes(v);

const matchesFilter = (wo: WorkOrder, f: Filter) => {
  if (f === 'all') return true;
  if (f === 'open') return isOpen(wo);
  if (f === 'late') return isOverdue(wo);
  return wo.status === f;
};

export function WorkOrderList() {
  const { t, fmtMoney, fmtNum } = useI18n();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const param = params.get('status');
  const filter: Filter = isFilter(param) ? param : 'all';
  const [q, setQ] = useState('');
  const { rows, loading } = useCollection(workOrders);
  const { byId } = useUsers();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((wo) => matchesFilter(wo, filter))
      .filter((wo) => !s || [wo.no, wo.customer, wo.project, wo.contact].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  }, [rows, filter, q]);

  const filterLabel = (f: Filter) =>
    f === 'all' ? t('Toutes', 'All') : f === 'open' ? t('Ouvertes', 'Open') : f === 'late' ? t('En retard', 'Late') : t(WO_STATUS_LABEL[f]);

  return (
    <Page>
      <PageHeader eyebrow={t('Production', 'Production')} title={t('Ordres de travail', 'Work orders')} />
      <div className="row row-wrap" style={{ marginBottom: 16 }}>
        <div className="tabs wo-tabs" role="tablist" aria-label={t('Filtrer par statut', 'Filter by status')} style={{ marginBottom: 0, borderBottom: 'none' }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={`tab ${filter === f ? 'active' : ''}`}
              onClick={() => setParams(f === 'all' ? {} : { status: f })}
            >
              {filterLabel(f)}
              <span className="faint small" style={{ marginLeft: 6 }}>
                {rows.filter((wo) => matchesFilter(wo, f)).length}
              </span>
            </button>
          ))}
        </div>
        <span className="spacer" />
        <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
          <Search size={16} aria-hidden style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            type="search"
            aria-label={t('Rechercher', 'Search')}
            placeholder={t('No, client, projet…', 'No., customer, project…')}
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
                  <th scope="col">No</th>
                  <th scope="col">{t('Client / projet', 'Customer / project')}</th>
                  <th scope="col" className="num">{t('Quantité', 'Qty')}</th>
                  <th scope="col">{t('Échéance', 'Due')}</th>
                  <th scope="col">{t('Tâches', 'Tasks')}</th>
                  <th scope="col">{t('Responsable', 'Manager')}</th>
                  <th scope="col">{t('Statut', 'Status')}</th>
                  <th scope="col" className="num">{t('Total', 'Total')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((wo) => {
                  const manager = wo.managerId ? byId.get(wo.managerId) : undefined;
                  return (
                    <tr key={wo.id} className="clickable" onClick={() => nav(`/workorders/${wo.id}`)}>
                      <td className="mono">
                        <Link to={`/workorders/${wo.id}`} style={{ color: 'inherit' }}>
                          {wo.no}
                        </Link>
                      </td>
                      <td>
                        {wo.customer}
                        <div className="faint small">{wo.project}</div>
                      </td>
                      <td className="num">{fmtNum(wo.quantity)}</td>
                      <td>
                        <DueDate wo={wo} />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <ProgressBar tasks={wo.tasks} compact />
                      </td>
                      <td>
                        <span className="row small" style={{ gap: 6 }}>
                          <Avatar user={manager} size={22} />
                          {manager?.displayName ?? <span className="faint">{t('Non assigné', 'Unassigned')}</span>}
                        </span>
                      </td>
                      <td>
                        <WoStatusBadge status={wo.status} />
                      </td>
                      <td className="num">{fmtMoney(wo.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<ClipboardList size={36} />} title={loading ? t('Chargement…', 'Loading…') : t('Aucun ordre de travail', 'No work orders')} />
        )}
      </div>
    </Page>
  );
}
