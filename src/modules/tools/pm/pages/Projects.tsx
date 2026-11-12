import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, FolderKanban, Plus, Search, FolderOpen } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { Empty, PageHeader, useToast } from '@/components/ui';
import { monthStart } from '@/modules/tools/lib';
import { budgetUse, counted, fmtHours, projectActuals, sum, type Actuals } from '../lib';
import { clients, expenses, projects, timeEntries } from '../stores';
import { PROJECT_STATUS, type Project, type ProjectStatus } from '../schemas';
import { OPEN_STATUSES, STATUS_LABEL } from '../Projects.shared';
import { ProjectForm } from '../Projects.form';
import { ProjectRow } from '../Projects.table';

type StatusFilter = 'open' | 'all' | ProjectStatus;
type SortKey = 'code' | 'name' | 'end';

const inputStyle = { width: 'auto', minWidth: 160, height: 34 } as const;
/** Actuals of a project with no time or expenses yet. */
const NO_ACTUALS: Actuals = projectActuals('', [], []);

export function Projects() {
  const { t } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const userName = useUserName();
  const manage = can('tools.pm.manage');

  const { rows: projectRows, loading } = useCollection(projects);
  const { rows: clientRows } = useCollection(clients);
  const { rows: entryRows } = useCollection(timeEntries);
  const { rows: expenseRows } = useCollection(expenses);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('open');
  const [clientId, setClientId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [mine, setMine] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'code', dir: 1 });
  /** null = closed, 'new' = create, or the project being edited. */
  const [editing, setEditing] = useState<Project | 'new' | null>(null);

  const clientName = useMemo(() => new Map(clientRows.map((c) => [c.id, c.name])), [clientRows]);
  const actuals = useMemo(() => {
    const m = new Map<string, Actuals>();
    for (const p of projectRows) m.set(p.id, projectActuals(p.id, entryRows, expenseRows));
    return m;
  }, [projectRows, entryRows, expenseRows]);

  const levelOf = (p: Project) => budgetUse(p, actuals.get(p.id) ?? NO_ACTUALS).level;
  const openRows = projectRows.filter((p) => OPEN_STATUSES.includes(p.status));
  const kpi = {
    active: projectRows.filter((p) => p.status === 'active').length,
    over: openRows.filter((p) => levelOf(p) === 'over').length,
    warn: openRows.filter((p) => levelOf(p) === 'warn').length,
    hoursMonth: sum(entryRows.filter((e) => counted(e) && e.date >= monthStart()).map((e) => e.hours)),
  };

  // Managers listed in the manager filter: those of any project.
  const managerIds = useMemo(
    () => [...new Set(projectRows.map((p) => p.managerId).filter((x): x is string => !!x))],
    [projectRows],
  );

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = projectRows.filter((p) => {
      if (status === 'open' ? !OPEN_STATUSES.includes(p.status) : status !== 'all' && p.status !== status) return false;
      if (clientId && p.clientId !== clientId) return false;
      if (managerId && p.managerId !== managerId) return false;
      if (mine && p.managerId !== user?.id && !(user && p.memberIds.includes(user.id))) return false;
      if (s && ![p.code, p.name, clientName.get(p.clientId ?? '') ?? ''].some((v) => v.toLowerCase().includes(s))) return false;
      return true;
    });
    const value = (p: Project): string | number => {
      if (sort.key === 'code') return p.code;
      if (sort.key === 'name') return p.name;
      return p.endDate || '9999-12-31';
    };
    return filtered.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return cmp * sort.dir;
    });
  }, [projectRows, status, clientId, managerId, mine, q, sort, user, clientName]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  async function setArchived(p: Project) {
    const archive = p.status !== 'archived';
    try {
      await projects.update(p.id, { status: archive ? 'archived' : 'active' });
      toast(archive ? t('Projet archivé', 'Project archived') : t('Projet désarchivé', 'Project unarchived'));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('Action impossible', 'Action failed'), 'err');
    }
  }

  async function remove(p: Project) {
    const ok = window.confirm(
      t(`Supprimer le projet « ${p.name} » ? Cette action est irréversible.`, `Delete project "${p.name}"? This cannot be undone.`),
    );
    if (!ok) return;
    try {
      await projects.remove(p.id);
      toast(t('Projet supprimé', 'Project deleted'));
    } catch (e) {
      // The server refuses when the project has history: the message says to archive it instead.
      const msg = e instanceof Error ? e.message : '';
      toast(`${t('Suppression refusée', 'Delete refused')} — ${msg || t('Archivez-le plutôt.', 'Archive it instead.')}`, 'err');
    }
  }

  const sortHead = (key: SortKey, label: string) => (
    <th aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ padding: 0, height: 'auto', font: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', color: 'inherit' }}
        onClick={() => toggleSort(key)}
      >
        {label}
        {sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );

  const hasFilters = !!(q || status !== 'open' || clientId || managerId || mine);
  const hasAnything = projectRows.length > 0;

  return (
    <Page wide>
      <PageHeader
        eyebrow={t('Outils · Gestion de projet', 'Tools · Project management')}
        title={t('Projets', 'Projects')}
        subtitle={t(
          'Budgets, heures et montants facturables par projet. Cliquez un projet pour voir le détail.',
          'Budgets, hours and billable amounts per project. Click a project to see its details.',
        )}
        actions={
          manage ? (
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              <Plus size={16} /> {t('Nouveau projet', 'New project')}
            </button>
          ) : undefined
        }
      />

      <KpiGrid>
        <Kpi
          label={t('Projets actifs', 'Active projects')}
          value={kpi.active}
          hint={t(`${openRows.length} ouverts au total`, `${openRows.length} open in total`)}
          tone="accent"
          icon={<FolderKanban size={18} />}
        />
        <Kpi
          label={t('Hors budget ou à l’alerte', 'Over budget or at alert')}
          value={kpi.over + kpi.warn}
          hint={t(`${kpi.over} hors budget · ${kpi.warn} à surveiller`, `${kpi.over} over budget · ${kpi.warn} to watch`)}
          tone={kpi.over > 0 ? 'err' : kpi.warn > 0 ? 'warn' : undefined}
          icon={<AlertTriangle size={18} />}
        />
        <Kpi
          label={t('Heures ce mois-ci', 'Hours this month')}
          value={fmtHours(kpi.hoursMonth)}
          hint={t('Toutes les saisies non rejetées', 'All entries not rejected')}
          icon={<Clock size={18} />}
        />
      </KpiGrid>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-pad row row-wrap" style={{ gap: 10 }}>
          <label className="row" style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--text-3)' }} aria-hidden="true" />
            <input
              className="input"
              style={{ paddingLeft: 32, height: 34 }}
              placeholder={t('Rechercher un code, un projet, un client…', 'Search a code, project or client…')}
              aria-label={t('Rechercher', 'Search')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select className="select" style={inputStyle} aria-label={t('Statut', 'Status')} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="open">{t('Actifs (planif., actifs, en pause)', 'Open (planning, active, on hold)')}</option>
            <option value="all">{t('Tous les statuts', 'All statuses')}</option>
            {PROJECT_STATUS.map((s) => (
              <option key={s} value={s}>
                {t(STATUS_LABEL[s])}
              </option>
            ))}
          </select>
          <select className="select" style={inputStyle} aria-label={t('Client', 'Client')} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">{t('Tous les clients', 'All clients')}</option>
            {[...clientRows]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <select className="select" style={inputStyle} aria-label={t('Responsable', 'Manager')} value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">{t('Tous les responsables', 'All managers')}</option>
            {managerIds.map((id) => (
              <option key={id} value={id}>
                {userName(id)}
              </option>
            ))}
          </select>
          <label className="check">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            <span>{t('Mes projets', 'My projects')}</span>
          </label>
        </div>

        {loading && !hasAnything ? (
          <div className="card-pad muted">{t('Chargement…', 'Loading…')}</div>
        ) : !hasAnything ? (
          <Empty icon={<FolderOpen size={40} />} title={t('Aucun projet pour le moment', 'No projects yet')}>
            {manage
              ? t('Créez le premier projet avec le bouton « Nouveau projet ».', 'Create the first project with “New project”.')
              : t('Les projets apparaîtront ici lorsqu’ils seront créés.', 'Projects will appear here once created.')}
          </Empty>
        ) : list.length === 0 ? (
          <Empty icon={<Search size={40} />} title={t('Aucun projet ne correspond aux filtres', 'No project matches the filters')}>
            {hasFilters && (
              <button
                className="btn btn-sm"
                onClick={() => {
                  setQ('');
                  setStatus('open');
                  setClientId('');
                  setManagerId('');
                  setMine(false);
                }}
              >
                {t('Réinitialiser les filtres', 'Reset filters')}
              </button>
            )}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {sortHead('code', t('Code', 'Code'))}
                  {sortHead('name', t('Projet', 'Project'))}
                  <th>{t('Client', 'Client')}</th>
                  <th>{t('Responsable', 'Manager')}</th>
                  <th>{t('Statut', 'Status')}</th>
                  <th>{t('Facturation', 'Billing')}</th>
                  <th>{t('Heures', 'Hours')}</th>
                  <th>{t('Montant', 'Amount')}</th>
                  {sortHead('end', t('Fin', 'End'))}
                  {manage && <th aria-label={t('Actions', 'Actions')} />}
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    actuals={actuals.get(p.id) ?? NO_ACTUALS}
                    clientName={clientName.get(p.clientId ?? '') ?? ''}
                    managerName={p.managerId ? userName(p.managerId) : ''}
                    manage={manage}
                    onOpen={(id) => navigate(`/tools/pm/projects/${id}`)}
                    onEdit={(x) => setEditing(x)}
                    onArchive={setArchived}
                    onDelete={remove}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing !== null && (
        <ProjectForm project={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </Page>
  );
}
