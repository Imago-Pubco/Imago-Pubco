import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { periodLabel, parseDate, quarterOf, shortPeriod } from '../../lib';
import { iso } from '../lib';
import { buildSchedule, centreAnchor, rangeOf, stepAnchor, STATUS_BAR, ZOOMS, type Filters, type Range, type Zoom } from '../Schedule.model';
import { Gantt } from '../Schedule.view';
import { TaskModal } from '../Tasks.modal';
import type { PmTask } from '../schemas';
import { clients, pmTasks, projects } from '../stores';

/** "9 nov. – 22 nov. 2026", "novembre 2026" or "2026-Q4", depending on the zoom. */
function periodTitle(r: Range, lang: string): string {
  if (r.zoom === 'month') return periodLabel(r.start, 'monthly', lang);
  if (r.zoom === 'quarter') return quarterOf(parseDate(r.start)).key;
  return `${shortPeriod(r.start, lang)} – ${shortPeriod(r.end, lang)} ${parseDate(r.end).getFullYear()}`;
}

const NO_FILTERS: Filters = { clientId: '', projectId: '', userId: '', mine: false };

export function Schedule() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { rows: projectRows, loading } = useCollection(projects);
  const { rows: taskRows } = useCollection(pmTasks);
  const { rows: clientRows } = useCollection(clients);
  const { rows: userRows } = useCollection(users);

  const today = iso(new Date());
  const [zoom, setZoom] = useState<Zoom>('week');
  const [anchor, setAnchor] = useState(today);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<PmTask | null>(null);

  const range = useMemo(() => rangeOf(zoom, anchor), [zoom, anchor]);
  const me = user?.id ?? '';
  const { rows, unplanned } = useMemo(
    () => buildSchedule({ projects: projectRows, tasks: taskRows, clients: clientRows, filters, me }),
    [projectRows, taskRows, clientRows, filters, me],
  );

  const taskById = useMemo(() => new Map(taskRows.map((x) => [x.id, x])), [taskRows]);
  const people = useMemo(() => new Map(userRows.map((u) => [u.id, u.displayName])), [userRows]);
  const nameOf = (id: string) => people.get(id) ?? id;
  const activeUsers = userRows.filter((u) => u.active).sort((a, b) => a.displayName.localeCompare(b.displayName));
  const clientOptions = clientRows.filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name));
  const projectOptions = projectRows
    .filter((p) => p.status !== 'archived' && (!filters.clientId || p.clientId === filters.clientId))
    .sort((a, b) => a.code.localeCompare(b.code));

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const zoomLabel: Record<Zoom, string> = { week: t('Semaine', 'Week'), month: t('Mois', 'Month'), quarter: t('Trimestre', 'Quarter') };
  const changeZoom = (z: Zoom) => {
    setAnchor(centreAnchor(range));
    setZoom(z);
  };
  const statusLabel: Record<PmTask['status'], string> = { todo: t('À faire', 'To do'), doing: t('En cours', 'Doing'), review: t('Revue', 'Review'), done: t('Terminé', 'Done') };

  return (
    <Page wide>
      <PageHeader
        eyebrow={t('Outils · Gestion de projet', 'Tools · Project management')}
        title={t('Planification', 'Schedule')}
        subtitle={t('Projets et tâches sur une frise. Cliquez une tâche pour la modifier, un projet pour l’ouvrir.', 'Projects and tasks on a timeline. Click a task to edit it, a project to open it.')}
      />

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="row row-wrap" style={{ alignItems: 'center', gap: 10 }}>
          <button type="button" className="btn btn-sm" onClick={() => setAnchor(stepAnchor(range, -1))} aria-label={t('Précédent', 'Previous')}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setAnchor(today)}>
            {t("Aujourd'hui", 'Today')}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setAnchor(stepAnchor(range, 1))} aria-label={t('Suivant', 'Next')}>
            <ChevronRight size={16} />
          </button>
          <strong style={{ marginLeft: 4 }}>{periodTitle(range, lang)}</strong>
          <span className="spacer" />
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }} role="tablist">
            {ZOOMS.map((z) => (
              <button key={z} type="button" role="tab" aria-selected={zoom === z} className={`tab ${zoom === z ? 'active' : ''}`} onClick={() => changeZoom(z)}>
                {zoomLabel[z]}
              </button>
            ))}
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          <label className="field">
            <span>{t('Client', 'Client')}</span>
            <select className="select" value={filters.clientId} onChange={(e) => set({ clientId: e.target.value, projectId: '' })}>
              <option value="">{t('Tous les clients', 'All clients')}</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('Projet', 'Project')}</span>
            <select className="select" value={filters.projectId} onChange={(e) => set({ projectId: e.target.value })}>
              <option value="">{t('Tous les projets', 'All projects')}</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('Personne', 'Person')}</span>
            <select className="select" value={filters.userId} onChange={(e) => set({ userId: e.target.value })}>
              <option value="">{t('Toutes les personnes', 'Everyone')}</option>
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </label>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <label className="check">
              <input type="checkbox" checked={filters.mine} onChange={(e) => set({ mine: e.target.checked })} />
              {t('Seulement mes projets', 'Only my projects')}
            </label>
          </div>
        </div>

        <div className="row row-wrap small" style={{ marginTop: 12, gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded(new Set(rows.map((r) => r.project.id)))}>
            {t('Tout déplier', 'Expand all')}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded(new Set())}>
            {t('Tout replier', 'Collapse all')}
          </button>
          <span className="spacer" />
          {(Object.keys(STATUS_BAR) as PmTask['status'][]).map((s) => (
            <span key={s} className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_BAR[s] }} />
              {statusLabel[s]}
            </span>
          ))}
          <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--err)' }} />
            {t('En retard', 'Late')}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="muted">{t('Chargement…', 'Loading…')}</p>
      ) : (
        <Gantt
          range={range}
          rows={rows}
          unplanned={unplanned}
          today={today}
          expanded={expanded}
          taskById={taskById}
          nameOf={nameOf}
          onToggle={toggle}
          onOpenTask={setEditing}
          onOpenProject={(id) => navigate(`/tools/pm/projects/${id}`)}
        />
      )}

      <p className="faint small" style={{ marginTop: 10 }}>
        {t('Sur les barres de tâches, les initiales sont celles des personnes assignées.', 'On task bars, the initials are those of the assigned people.')}
      </p>

      {editing && <TaskModal task={editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}
