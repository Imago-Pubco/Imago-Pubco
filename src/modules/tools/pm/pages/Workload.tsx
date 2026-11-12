import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { shortPeriod } from '../../lib';
import { addDays, iso, mondayOf, parseDate, sum } from '../lib';
import { Absences, useTypeLabel } from '../Workload.absences';
import { cellOf, isPastOrCurrent, levelOf, offsIn, plannedTasksOf, weekList, WEEKS, type Cell } from '../Workload.model';
import { CellDetail, LoadGrid, type PersonRow } from '../Workload.view';
import { pmTasks, projects, staff, timeEntries, timeOff } from '../stores';

const EMPTY_CELL: Cell = { capacity: 0, planned: 0, worked: 0, pct: null, level: 'none' };

export function Workload() {
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  const { rows: userRows } = useCollection(users);
  const { rows: staffRows } = useCollection(staff);
  const { rows: offRows } = useCollection(timeOff);
  const { rows: taskRows } = useCollection(pmTasks);
  const { rows: entryRows } = useCollection(timeEntries);
  const { rows: projectRows } = useCollection(projects);
  const typeLabel = useTypeLabel();

  const today = iso(new Date());
  const thisWeek = mondayOf(today);
  const me = user?.id ?? '';
  const canManage = can('tools.pm.manage');
  const [start, setStart] = useState(thisWeek);
  const [tab, setTab] = useState<'load' | 'absences'>('load');
  const [personFilter, setPersonFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [detail, setDetail] = useState<{ userId: string; week: string } | null>(null);

  const staffMap = useMemo(() => new Map(staffRows.map((s) => [s.id, s])), [staffRows]);
  const staffOf = useCallback((id: string) => staffMap.get(id), [staffMap]);
  const nameMap = useMemo(() => new Map(userRows.map((u) => [u.id, u.displayName])), [userRows]);
  const nameOf = (id: string) => nameMap.get(id) ?? id;
  const people = useMemo(() => userRows.filter((u) => u.active).sort((a, b) => a.displayName.localeCompare(b.displayName)), [userRows]);
  const weeks = useMemo(() => weekList(start), [start]);
  const pastWeeks = useMemo(() => new Set(weeks.filter((w) => isPastOrCurrent(w, thisWeek))), [weeks, thisWeek]);

  // Project filter: capacity stays the person's own, planned and worked hours count only that project.
  const project = projectRows.find((p) => p.id === projectFilter);
  const scopeTasks = useMemo(() => (projectFilter ? taskRows.filter((x) => x.projectId === projectFilter) : taskRows), [taskRows, projectFilter]);
  const scopeEntries = useMemo(() => (projectFilter ? entryRows.filter((x) => x.projectId === projectFilter) : entryRows), [entryRows, projectFilter]);
  const onProject = (uid: string) => !!project && (project.managerId === uid || project.memberIds.includes(uid) || scopeTasks.some((x) => x.assigneeIds.includes(uid)));
  const shown = people.filter((u) => (!personFilter || u.id === personFilter) && (!project || onProject(u.id)));

  const rows: PersonRow[] = shown.map((u) => ({
    user: u,
    cells: weeks.map((w) => cellOf(u.id, w, staffOf(u.id), offRows, scopeTasks, scopeEntries, staffOf)),
  }));
  const totals: Cell[] = weeks.map((_, i) => {
    const capacity = sum(rows.map((r) => r.cells[i].capacity));
    const planned = sum(rows.map((r) => r.cells[i].planned));
    const worked = sum(rows.map((r) => r.cells[i].worked));
    const pct = capacity > 0 ? (planned / capacity) * 100 : null;
    return { capacity, planned, worked, pct, level: levelOf(pct) };
  });

  const projectName = useMemo(() => new Map(projectRows.map((p) => [p.id, p])), [projectRows]);
  const detailWeek = detail?.week ?? weeks[0];
  const detailUser = detail?.userId ?? '';
  const detailCell = detail ? cellOf(detailUser, detailWeek, staffOf(detailUser), offRows, scopeTasks, scopeEntries, staffOf) : EMPTY_CELL;
  const detailLines = detail
    ? plannedTasksOf(detailUser, detailWeek, scopeTasks, staffOf).map((l) => ({
        ...l,
        projectCode: projectName.get(l.task.projectId)?.code ?? '',
        projectName: projectName.get(l.task.projectId)?.name ?? '',
      }))
    : [];
  const detailOffs = detail ? offsIn(detailWeek, offRows, detailUser) : [];

  const lastDay = addDays(weeks[WEEKS - 1], 6);
  const rangeLabel = `${shortPeriod(weeks[0], lang)} – ${shortPeriod(lastDay, lang)} ${parseDate(lastDay).getFullYear()}`;
  const projectOptions = projectRows.filter((p) => p.status !== 'archived').sort((a, b) => a.code.localeCompare(b.code));

  return (
    <Page wide>
      <PageHeader
        eyebrow={t('Outils · Gestion de projet', 'Tools · Project management')}
        title={t('Charge', 'Workload')}
        subtitle={t('Heures planifiées contre capacité, sur 8 semaines. Les absences réduisent la capacité.', 'Planned hours against capacity over 8 weeks. Time off reduces capacity.')}
      />

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'load'} className={`tab ${tab === 'load' ? 'active' : ''}`} onClick={() => setTab('load')}>
          {t('Charge', 'Load')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'absences'} className={`tab ${tab === 'absences' ? 'active' : ''}`} onClick={() => setTab('absences')}>
          {t('Absences', 'Time off')}
        </button>
      </div>

      {tab === 'load' ? (
        <>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <div className="row row-wrap" style={{ alignItems: 'center', gap: 10 }}>
              <button type="button" className="btn btn-sm" aria-label={t('Semaine précédente', 'Previous week')} onClick={() => setStart(addDays(start, -7))}>
                <ChevronLeft size={16} />
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setStart(thisWeek)}>
                {t("Aujourd'hui", 'Today')}
              </button>
              <button type="button" className="btn btn-sm" aria-label={t('Semaine suivante', 'Next week')} onClick={() => setStart(addDays(start, 7))}>
                <ChevronRight size={16} />
              </button>
              <strong style={{ marginLeft: 4 }}>{rangeLabel}</strong>
            </div>
            <div className="form-grid" style={{ marginTop: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <label className="field">
                <span>{t('Membre', 'Team member')}</span>
                <select className="select" value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}>
                  <option value="">{t('Toute l’équipe', 'Whole team')}</option>
                  {people.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t('Projet', 'Project')}</span>
                <select className="select" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                  <option value="">{t('Tous les projets', 'All projects')}</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <LoadGrid weeks={weeks} rows={rows} totals={totals} pastWeeks={pastWeeks} staffOf={staffOf} onOpen={(userId, week) => setDetail({ userId, week })} />

          <CellDetail
            open={!!detail}
            onClose={() => setDetail(null)}
            name={detail ? nameOf(detail.userId) : ''}
            week={detailWeek}
            cell={detailCell}
            past={pastWeeks.has(detailWeek)}
            lines={detailLines}
            offs={detailOffs}
            typeLabel={typeLabel}
          />
        </>
      ) : (
        <Absences off={offRows} people={people} me={me} canManage={canManage} nameOf={nameOf} />
      )}
    </Page>
  );
}
