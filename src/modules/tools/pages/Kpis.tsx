import { useMemo, useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import type { Kpi, KpiValue, Team } from '../schemas';
import { kpiValueId } from '../lib';
import { kpis, kpiValues, teams } from '../stores';
import { KpiFormModal } from '../Kpis.form';
import { ValueModal } from '../Kpis.value';
import { Scorecard } from '../Kpis.table';

type StatusFilter = 'live' | 'archived' | 'all';
/** Team filter value meaning "no team". */
const NO_TEAM = '__none__';

/** Screen: indicators (KPIs) and their weekly or monthly scorecards. */
export function Kpis() {
  const { t, lang } = useI18n();
  const { rows: all, loading } = useCollection(kpis);
  const { rows: valueRows } = useCollection(kpiValues);
  const { rows: teamRows } = useCollection(teams);
  const { rows: userRows } = useCollection(users);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('live');
  const [teamFilter, setTeamFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [kpiModal, setKpiModal] = useState<{ kpi: Kpi | null } | null>(null);
  const [valueTarget, setValueTarget] = useState<{ kpi: Kpi; period: string } | null>(null);

  const teamsById = useMemo(() => new Map<string, Team>(teamRows.map((x): [string, Team] => [x.id, x])), [teamRows]);
  const valueById = useMemo(() => new Map<string, KpiValue>(valueRows.map((v): [string, KpiValue] => [v.id, v])), [valueRows]);
  const valuesByKpi = useMemo(() => {
    const m = new Map<string, KpiValue[]>();
    for (const v of valueRows) {
      const list = m.get(v.kpiId);
      if (list) list.push(v);
      else m.set(v.kpiId, [v]);
    }
    for (const list of m.values()) list.sort((a, b) => b.period.localeCompare(a.period));
    return m;
  }, [valueRows]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all
      .filter((k) => {
        if (statusFilter === 'live' && k.status === 'archived') return false;
        if (statusFilter === 'archived' && k.status !== 'archived') return false;
        if (teamFilter === NO_TEAM ? k.teamId !== null : teamFilter && k.teamId !== teamFilter) return false;
        if (ownerFilter && k.ownerId !== ownerFilter) return false;
        return !s || k.name.toLowerCase().includes(s) || k.description.toLowerCase().includes(s);
      })
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, lang));
  }, [all, q, statusFilter, teamFilter, ownerFilter, lang]);

  const weekly = visible.filter((k) => k.frequency === 'weekly');
  const monthly = visible.filter((k) => k.frequency === 'monthly');
  const archivedCount = all.filter((k) => k.status === 'archived').length;
  const criticalOthers = kpiModal ? all.filter((k) => k.critical && k.id !== kpiModal.kpi?.id).length : 0;
  const owners = userRows.filter((u) => u.active || u.id === ownerFilter).sort((a, b) => a.displayName.localeCompare(b.displayName));
  const teamOptions = teamRows.filter((x) => !x.archived || x.id === teamFilter).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Page>
      <PageHeader
        eyebrow={t('Outils · KPI', 'Tools · KPI')}
        title={t('Indicateurs', 'Indicators')}
        actions={
          <button className="btn btn-primary" onClick={() => setKpiModal({ kpi: null })} data-tour="kpis-new">
            <Plus size={16} /> {t('Indicateur', 'Indicator')}
          </button>
        }
      />

      <div className="card card-pad" style={{ marginBottom: 16 }} data-tour="kpis-filters">
        <div className="row row-wrap" style={{ alignItems: 'flex-end', gap: 12 }}>
          <label className="field" style={{ flex: '1 1 220px' }}>
            <span>{t('Recherche', 'Search')}</span>
            <input
              className="input"
              type="search"
              value={q}
              placeholder={t('Nom ou définition…', 'Name or definition…')}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t('Statut', 'Status')}</span>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="live">
                {t('Actifs + brouillons', 'Active + draft')} ({all.length - archivedCount})
              </option>
              <option value="archived">
                {t('Archivés', 'Archived')} ({archivedCount})
              </option>
              <option value="all">
                {t('Tous', 'All')} ({all.length})
              </option>
            </select>
          </label>
          <label className="field">
            <span>{t('Équipe', 'Team')}</span>
            <select className="select" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="">{t('Toutes les équipes', 'All teams')}</option>
              <option value={NO_TEAM}>{t('Sans équipe', 'No team')}</option>
              {teamOptions.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('Responsable', 'Owner')}</span>
            <select className="select" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
              <option value="">{t('Tous', 'All')}</option>
              {owners.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName}</option>
              ))}
            </select>
          </label>
        </div>
        {all.length > 0 && (
          <div className="small faint" style={{ marginTop: 8 }}>
            {t(`${visible.length} affiché(s) sur ${all.length}`, `${visible.length} shown of ${all.length}`)}
          </div>
        )}
      </div>

      <div data-tour="kpis-table">
      {loading && all.length === 0 && <p className="muted">{t('Chargement…', 'Loading…')}</p>}

      {!loading && all.length === 0 && (
        <Empty icon={<Target size={40} />} title={t('Aucun indicateur pour l’instant', 'No indicators yet')}>
          {t(
            'Créez le premier indicateur avec le bouton ci-dessus. Il sera suivi chaque semaine ou chaque mois.',
            'Create the first indicator with the button above. It will be tracked every week or every month.',
          )}
        </Empty>
      )}

      {all.length > 0 && visible.length === 0 && (
        <Empty icon={<Target size={40} />} title={t('Aucun indicateur ne correspond aux filtres', 'No indicator matches the filters')} />
      )}

      {weekly.length > 0 && (
        <Scorecard
          title={t('Hebdomadaires', 'Weekly')}
          frequency="weekly"
          kpis={weekly}
          valuesByKpi={valuesByKpi}
          valueById={valueById}
          teamsById={teamsById}
          onEditKpi={(kpi) => setKpiModal({ kpi })}
          onEnterValue={(kpi, period) => setValueTarget({ kpi, period })}
        />
      )}
      {monthly.length > 0 && (
        <Scorecard
          title={t('Mensuels', 'Monthly')}
          frequency="monthly"
          kpis={monthly}
          valuesByKpi={valuesByKpi}
          valueById={valueById}
          teamsById={teamsById}
          onEditKpi={(kpi) => setKpiModal({ kpi })}
          onEnterValue={(kpi, period) => setValueTarget({ kpi, period })}
        />
      )}
      </div>

      {kpiModal && (
        <KpiFormModal
          kpi={kpiModal.kpi}
          order={all.length}
          criticalOthers={criticalOthers}
          onClose={() => setKpiModal(null)}
        />
      )}
      {valueTarget && (
        <ValueModal
          kpi={valueTarget.kpi}
          period={valueTarget.period}
          existing={valueById.get(kpiValueId(valueTarget.kpi.id, valueTarget.period))}
          onClose={() => setValueTarget(null)}
        />
      )}
    </Page>
  );
}
