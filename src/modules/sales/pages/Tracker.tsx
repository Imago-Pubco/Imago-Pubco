import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Search, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/ui';
import { Circuit, type CircuitItem } from '../components/Circuit';
import { SalesBlockedWidget, SalesKpis } from '../components/Widgets';
import { followUpState, followUpsOf, isBlocked, salesRequests } from '../stores';
import { SALES_STAGES, type SalesRequest, type SalesStage } from '../types';
import { RequestDetail } from './RequestDetail';

const toItem = (r: SalesRequest): CircuitItem => ({
  id: r.id,
  no: r.no,
  customer: r.customer || '—',
  blocked: r.blocker?.kind,
  overdue: followUpsOf(r).some((f) => followUpState(f.dueAt) === 'overdue'),
});

/** Circuit overview, or the full track of one request when `?r=<id>` is in the URL. */
export function Tracker() {
  const { t } = useI18n();
  const { can, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const focusId = params.get('r');
  const { rows, loading } = useCollection(salesRequests);
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [q, setQ] = useState('');
  const [picker, setPicker] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const pickerResults = useMemo(() => {
    const s = picker.trim().toLowerCase();
    if (!s) return [];
    return rows
      .filter((r) => [r.no, r.customer, r.project].some((v) => (v ?? '').toLowerCase().includes(s)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8);
  }, [rows, picker]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (scope === 'all' || r.ownerId === user?.id) &&
        (!blockedOnly || isBlocked(r)) &&
        (!s || [r.no, r.customer, r.project].some((v) => (v ?? '').toLowerCase().includes(s))),
    );
  }, [rows, scope, blockedOnly, q, user?.id]);

  const byStage = useMemo(() => {
    const out: Partial<Record<SalesStage, CircuitItem[]>> = {};
    for (const s of [...SALES_STAGES, 'declined'] as SalesStage[]) {
      out[s] = filtered
        .filter((r) => r.stage === s)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(toItem);
    }
    return out;
  }, [filtered]);

  const studioCount = filtered.filter((r) => r.studio?.status === 'requested' || r.studio?.status === 'in_progress').length;
  const loopActive = filtered.some((r) => r.revision > 1 && r.stage !== 'declined' && r.stage !== 'production');

  const openRequest = (id: string) => {
    setParams({ r: id });
    setPicker('');
    setPickerOpen(false);
  };

  const header = (
    <PageHeader
      eyebrow={t('Ventes', 'Sales')}
      title={t('Suivi des demandes', 'Request tracker')}
      subtitle={t(
        'De la demande du client jusqu’à la production, en un coup d’œil.',
        'From the customer request to production, at a glance.',
      )}
      actions={
        can('sales.edit') ? (
          <Link to="/sales/requests/new" className="btn btn-primary">
            <Plus size={16} /> {t('Nouvelle demande', 'New request')}
          </Link>
        ) : undefined
      }
    />
  );

  const picking = (
    <div className="sl-toolbar" style={{ marginBottom: 14 }}>
      <div className="sl-search" role="search">
        <Search size={16} aria-hidden="true" />
        <input
          className="input"
          value={picker}
          onChange={(e) => {
            setPicker(e.target.value);
            setPickerOpen(true);
          }}
          onFocus={() => setPickerOpen(true)}
          onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pickerResults[0]) openRequest(pickerResults[0].id);
            if (e.key === 'Escape') setPickerOpen(false);
          }}
          placeholder={t('Taper un numéro de demande ou un client', 'Type a request number or customer')}
          aria-label={t('Chercher une demande', 'Find a request')}
          aria-autocomplete="list"
          aria-expanded={pickerOpen && pickerResults.length > 0}
        />
        {pickerOpen && pickerResults.length > 0 && (
          <ul className="sl-results" role="listbox">
            {pickerResults.map((r) => (
              <li key={r.id} role="option" aria-selected={false}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => openRequest(r.id)}>
                  <span className="mono small">{r.no}</span>
                  <span>{r.customer || '—'}</span>
                  <span className="faint small" style={{ marginLeft: 'auto' }}>
                    {r.project}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  if (focusId) {
    return (
      <Page>
        <div className="row row-wrap" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <button type="button" className="sl-back" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => setParams({})}>
            <ArrowLeft size={16} /> {t('Tous les parcours', 'All journeys')}
          </button>
        </div>
        {picking}
        {loading && rows.length === 0 ? null : <RequestDetail key={focusId} id={focusId} />}
      </Page>
    );
  }

  return (
    <Page>
      {header}
      {picking}
      <SalesKpis rows={rows} />

      <div className="sl-toolbar">
        {can('sales.access') && (
          <>
            <button type="button" className="sl-chip-filter" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
              {t('Toutes', 'All')}
            </button>
            <button type="button" className="sl-chip-filter" aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>
              {t('Mes demandes', 'My requests')}
            </button>
          </>
        )}
        <button type="button" className="sl-chip-filter" aria-pressed={blockedOnly} onClick={() => setBlockedOnly((v) => !v)}>
          {t('Bloquées seulement', 'Blocked only')}
        </button>
        <span className="spacer" />
        <div className="sl-search" style={{ width: 280 }}>
          <Search size={16} aria-hidden="true" />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('No, client, projet…', 'No., customer, project…')} aria-label={t('Filtrer', 'Filter')} />
          {q && (
            <button type="button" className="btn btn-ghost btn-icon btn-sm" style={{ position: 'absolute', right: 4, top: 4 }} onClick={() => setQ('')} aria-label={t('Effacer', 'Clear')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <section className="card sl-panel" aria-label={t('Circuit', 'Circuit')}>
        <div className="sl-panel-head">
          <h2 style={{ fontSize: 16, margin: 0 }}>{t('Circuit des demandes', 'Request circuit')}</h2>
          <span className="faint small">
            {t(`${filtered.length} demande(s) affichée(s)`, `${filtered.length} request(s) shown`)}
          </span>
        </div>
        <Circuit byStage={byStage} studioCount={studioCount} loopActive={loopActive} onPick={openRequest} />
        <div className="sl-legend" aria-hidden="true">
          <span>
            <i /> {t('Étape franchie', 'Completed stage')}
          </span>
          <span>
            <i className="dashed" /> {t('À venir', 'To come')}
          </span>
          <span>
            <i style={{ borderColor: 'var(--warn)' }} /> {t('Changements demandés par le client', 'Changes requested by the customer')}
          </span>
        </div>
      </section>

      <section className="card sl-section">
        <h3 className="sl-card-title">
          <span>{t('Demandes bloquées', 'Blocked requests')}</span>
        </h3>
        <SalesBlockedWidget rows={filtered} />
      </section>
    </Page>
  );
}
