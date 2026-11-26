import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, Search, UserPlus } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader, useToast } from '@/components/ui';
import { SalesStageBadge } from '../components/Circuit';
import { BLOCKER_SHORT, followUpState, isClosed, salesEstimates, salesRequests } from '../stores';
import { BLOCKER_LABEL, SALES_STAGES, STAGE_LABEL, type SalesRequest, type SalesStage } from '../types';

type SortKey = 'no' | 'customer' | 'stage' | 'dueDate' | 'ownerId' | 'updatedAt';
const STAGE_ORDER = [...SALES_STAGES, 'declined'] as SalesStage[];

export function RequestList() {
  const { t, fmtDate } = useI18n();
  const { can, user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const userName = useUserName();
  const [params] = useSearchParams();
  const { rows, loading } = useCollection(salesRequests);
  const { rows: estimates } = useCollection(salesEstimates);

  const [stage, setStage] = useState<'all' | 'open' | SalesStage>('open');
  const [blockedOnly, setBlockedOnly] = useState(params.get('blocked') === '1');
  const [mineOnly, setMineOnly] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updatedAt', dir: -1 });

  const estNo = (id?: string) => estimates.find((e) => e.id === id)?.no;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (stage === 'open' && isClosed(r)) return false;
      if (stage !== 'all' && stage !== 'open' && r.stage !== stage) return false;
      if (blockedOnly && !r.blocker) return false;
      if (mineOnly && r.ownerId !== user?.id) return false;
      if (s && ![r.no, r.customer, r.project, r.contact].some((v) => (v ?? '').toLowerCase().includes(s))) return false;
      return true;
    });
    const val = (r: SalesRequest): string | number => {
      switch (sort.key) {
        case 'stage':
          return STAGE_ORDER.indexOf(r.stage);
        case 'ownerId':
          return userName(r.ownerId);
        default:
          return (r[sort.key] ?? '') as string;
      }
    };
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, stage, blockedOnly, mineOnly, q, sort, user?.id, userName]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'updatedAt' ? -1 : 1 }));
  const sortIcon = (key: SortKey) =>
    sort.key === key ? sort.dir === 1 ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" /> : null;
  const th = (key: SortKey, label: string) => (
    <th aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="sl-sort" onClick={() => toggleSort(key)}>
        {label} {sortIcon(key)}
      </button>
    </th>
  );

  const claim = async (r: SalesRequest) => {
    if (!user) return;
    try {
      await salesRequests.update(r.id, { ownerId: user.id });
      toast(t('Demande prise en charge', 'Request claimed'));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    }
  };

  const stageOptions: (['all' | 'open' | SalesStage, string])[] = [
    ['open', t('Ouvertes', 'Open')],
    ['all', t('Toutes', 'All')],
    ...STAGE_ORDER.map((s) => [s, t(STAGE_LABEL[s])] as ['all' | 'open' | SalesStage, string]),
  ];

  return (
    <Page wide>
      <PageHeader
        eyebrow={t('Ventes', 'Sales')}
        title={t('Demandes', 'Requests')}
        subtitle={t(`${filtered.length} demande(s)`, `${filtered.length} request(s)`)}
        actions={
          can('sales.edit') ? (
            <Link to="/sales/requests/new" className="btn btn-primary">
              <Plus size={16} /> {t('Nouvelle demande', 'New request')}
            </Link>
          ) : undefined
        }
      />

      <div className="sl-toolbar">
        <select className="select" style={{ minWidth: 200 }} value={stage} onChange={(e) => setStage(e.target.value as typeof stage)} aria-label={t('Étape', 'Stage')}>
          {stageOptions.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className="sl-chip-filter" aria-pressed={mineOnly} onClick={() => setMineOnly((v) => !v)}>
          {t('Mes demandes', 'My requests')}
        </button>
        <button type="button" className="sl-chip-filter" aria-pressed={blockedOnly} onClick={() => setBlockedOnly((v) => !v)}>
          {t('Bloquées', 'Blocked')}
        </button>
        <span className="spacer" />
        <div className="sl-search">
          <Search size={16} aria-hidden="true" />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('No, client, projet…', 'No., customer, project…')} aria-label={t('Rechercher', 'Search')} />
        </div>
      </div>

      <div className="card">
        {filtered.length ? (
          <div className="table-wrap">
            <table className="table sl-table">
              <thead>
                <tr>
                  {th('stage', t('Étape', 'Stage'))}
                  {th('no', 'No')}
                  {th('customer', t('Client / projet', 'Customer / project'))}
                  <th>{t('Blocage', 'Blocker')}</th>
                  {th('ownerId', t('Responsable', 'Owner'))}
                  {th('dueDate', t('Échéance', 'Due'))}
                  <th>{t('Estimation', 'Estimate')}</th>
                  {th('updatedAt', t('Mise à jour', 'Updated'))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const fu = r.blocker?.followUpAt ? followUpState(r.blocker.followUpAt) : 'later';
                  return (
                    <tr
                      key={r.id}
                      className={`clickable${r.blocker ? ' is-blocked' : ''}`}
                      onClick={() => nav(`/sales?r=${encodeURIComponent(r.id)}`)}
                    >
                      <td>
                        <SalesStageBadge stage={r.stage} />
                        {r.revision > 1 && <span className="badge badge-warn" style={{ marginLeft: 4 }}>v{r.revision}</span>}
                      </td>
                      <td className="mono">
                        <Link to={`/sales?r=${encodeURIComponent(r.id)}`} onClick={(e) => e.stopPropagation()}>
                          {r.no}
                        </Link>
                      </td>
                      <td>
                        {r.customer || '—'}
                        <div className="faint small">{r.project}</div>
                      </td>
                      <td className="sl-blocked-cell">
                        {r.blocker ? (
                          <>
                            <span className="badge badge-warn" title={t(BLOCKER_LABEL[r.blocker.kind])}>
                              {t(BLOCKER_SHORT[r.blocker.kind])}
                            </span>
                            {r.blocker.followUpAt && (
                              <div className={`small ${fu === 'overdue' ? 'sl-overdue' : 'faint'}`}>
                                {t('Suivi', 'Follow up')} {fmtDate(r.blocker.followUpAt)}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </td>
                      <td className="small">
                        {r.ownerId ? (
                          userName(r.ownerId)
                        ) : can('sales.edit') && user ? (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              void claim(r);
                            }}
                          >
                            <UserPlus size={14} /> {t('Prendre', 'Claim')}
                          </button>
                        ) : (
                          <span className="faint">{t('Non assigné', 'Unassigned')}</span>
                        )}
                      </td>
                      <td className="muted">{r.dueDate ? fmtDate(r.dueDate) : '—'}</td>
                      <td className="small mono">
                        {r.estimateId ? (
                          <Link to={`/estimating/${r.estimateId}`} onClick={(e) => e.stopPropagation()}>
                            {estNo(r.estimateId) ?? r.estimateId}
                          </Link>
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </td>
                      <td className="muted small">{fmtDate(r.updatedAt, true)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<Search size={36} />} title={loading ? t('Chargement…', 'Loading…') : t('Aucune demande', 'No requests')} />
        )}
      </div>
    </Page>
  );
}
