import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckSquare, Clock, FolderKanban, Hourglass } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/ui';
import { useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { periodLabel } from '../../lib';
import {
  AttentionProjects,
  Rejections,
  UpcomingTasks,
  WeekBars,
  type AttentionItem,
  type AttentionReason,
  type DayItem,
  type RejectItem,
  type TaskItem,
} from '../Dashboard.parts';
import { availability, budgetUse, capacityOn, counted, fmtHours, iso, isLate, pct, projectActuals, sum, thisWeek, weekDays } from '../lib';
import type { Expense, Project, TimeEntry } from '../schemas';
import { expenses, pmTasks, projects, staff, timeEntries, timeOff } from '../stores';

const RANK: Record<AttentionReason['kind'], number> = { over: 3, late: 2, warn: 1 };

/** Projects that need a look: over or near budget (warn/over), or past their planned end and not completed. */
function attentionOf(list: Project[], entries: TimeEntry[], exps: Expense[], today: string): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const p of list) {
    if (p.status === 'archived') continue;
    const bu = budgetUse(p, projectActuals(p.id, entries, exps));
    const usedPct = Math.max(bu.hoursPct ?? 0, bu.amountPct ?? 0);
    const reasons: AttentionReason[] = [];
    if (bu.level === 'over' || bu.level === 'warn') reasons.push({ kind: bu.level, pct: usedPct });
    if (p.endDate && p.endDate < today && p.status !== 'completed') reasons.push({ kind: 'late', pct: null });
    if (reasons.length) out.push({ project: p, reasons });
  }
  const top = (i: AttentionItem) => Math.max(...i.reasons.map((r) => RANK[r.kind]));
  return out.sort((a, b) => top(b) - top(a));
}

/** Personal and overview dashboard of Gestion de projet. */
export function PmDashboard() {
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  const { rows: projectRows, loading } = useCollection(projects);
  const { rows: taskRows } = useCollection(pmTasks);
  const { rows: entryRows } = useCollection(timeEntries);
  const { rows: expenseRows } = useCollection(expenses);
  const { rows: staffRows } = useCollection(staff);
  const { rows: offRows } = useCollection(timeOff);

  const me = user?.id ?? '';
  const manager = can('tools.pm.manage');
  const approver = can('tools.pm.approve');
  const today = iso(new Date());
  const week = thisWeek();
  const days = useMemo(() => weekDays(week), [week]);

  const staffMap = useMemo(() => new Map(staffRows.map((s) => [s.id, s])), [staffRows]);
  const staffOf = useCallback((id: string) => staffMap.get(id), [staffMap]);
  const projectById = useMemo(() => new Map(projectRows.map((p) => [p.id, p])), [projectRows]);

  // Managers see every project; others the projects they manage or are members of.
  const visible = useMemo(
    () => projectRows.filter((p) => manager || p.managerId === me || p.memberIds.includes(me)),
    [projectRows, manager, me],
  );
  const myOpenTasks = useMemo(
    () =>
      taskRows
        .filter((x) => x.status !== 'done' && x.assigneeIds.includes(me))
        .sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31')),
    [taskRows, me],
  );
  const myCounted = useMemo(() => entryRows.filter((e) => e.userId === me && counted(e)), [entryRows, me]);
  const myRejected = useMemo(
    () => entryRows.filter((e) => e.userId === me && e.status === 'rejected').sort((a, b) => b.date.localeCompare(a.date)),
    [entryRows, me],
  );
  const weekStats = useMemo(
    () => availability(me, days, staffOf(me), offRows, taskRows, entryRows, staffOf),
    [me, days, staffOf, offRows, taskRows, entryRows],
  );
  const dayItems: DayItem[] = days.map((d) => ({
    date: d,
    hours: sum(myCounted.filter((e) => e.date === d).map((e) => e.hours)),
    capacity: capacityOn(d, staffOf(me), offRows, me),
  }));
  const waiting = approver ? entryRows.filter((e) => e.status === 'submitted' && e.userId !== me) : [];
  const attention = useMemo(() => attentionOf(visible, entryRows, expenseRows, today), [visible, entryRows, expenseRows, today]);

  const taskItems: TaskItem[] = myOpenTasks.map((task) => ({ task, project: projectById.get(task.projectId) }));
  const rejectItems: RejectItem[] = myRejected.map((entry) => ({ entry, project: projectById.get(entry.projectId) }));
  const lateCount = myOpenTasks.filter((x) => isLate(x, today)).length;
  const activeCount = visible.filter((p) => p.status === 'active').length;
  const waitingHours = sum(waiting.map((e) => e.hours));
  const used = weekStats.capacity > 0 ? pct((weekStats.worked / weekStats.capacity) * 100) : null;

  if (loading) {
    return (
      <Page>
        <PageHeader eyebrow={t('Outils · Gestion de projet', 'Tools · Project management')} title={t('Tableau de bord', 'Dashboard')} />
        <p className="muted">{t('Chargement…', 'Loading…')}</p>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        eyebrow={t('Outils · Gestion de projet', 'Tools · Project management')}
        title={t('Tableau de bord', 'Dashboard')}
        subtitle={t(`Semaine en cours : ${periodLabel(week, 'weekly', lang)}`, `Current week: ${periodLabel(week, 'weekly', lang)}`)}
        actions={
          <>
            <Link className="btn btn-sm" to="/tools/pm/projects">
              {t('Projets', 'Projects')}
            </Link>
            <Link className="btn btn-sm" to="/tools/pm/tasks">
              {t('Tâches', 'Tasks')}
            </Link>
            <Link className="btn btn-sm btn-primary" to="/tools/pm/timesheet">
              {t('Feuille de temps', 'Timesheet')}
            </Link>
          </>
        }
      />

      <div className="stack">
        <KpiGrid>
          <Kpi
            label={t('Mes heures cette semaine', 'My hours this week')}
            value={fmtHours(weekStats.worked)}
            hint={
              weekStats.capacity > 0
                ? t(`${used} de ${fmtHours(weekStats.capacity)}`, `${used} of ${fmtHours(weekStats.capacity)}`)
                : t('Aucune capacité prévue', 'No capacity planned')
            }
            tone={weekStats.capacity > 0 && weekStats.worked >= weekStats.capacity ? 'ok' : 'accent'}
            icon={<Clock size={18} />}
            to="/tools/pm/timesheet"
          />
          <Kpi
            label={t('Mes tâches ouvertes', 'My open tasks')}
            value={myOpenTasks.length}
            icon={<CheckSquare size={18} />}
            to="/tools/pm/tasks"
          />
          <Kpi
            label={t('Mes tâches en retard', 'My late tasks')}
            value={lateCount}
            tone={lateCount > 0 ? 'err' : 'ok'}
            icon={<AlertTriangle size={18} />}
            to="/tools/pm/tasks"
          />
          {approver && (
            <Kpi
              label={t('Temps à approuver', 'Time awaiting my approval')}
              value={fmtHours(waitingHours)}
              hint={t(`${waiting.length} entrée(s)`, `${waiting.length} entr${waiting.length === 1 ? 'y' : 'ies'}`)}
              tone={waiting.length > 0 ? 'warn' : undefined}
              icon={<Hourglass size={18} />}
              to="/tools/pm/approvals"
            />
          )}
          <Kpi label={t('Projets actifs', 'Active projects')} value={activeCount} icon={<FolderKanban size={18} />} to="/tools/pm/projects" />
        </KpiGrid>

        <div className="grid-2">
          <UpcomingTasks items={taskItems} today={today} />
          <AttentionProjects items={attention} />
        </div>
        <div className="grid-2">
          <WeekBars days={dayItems} />
          <Rejections items={rejectItems} />
        </div>
      </div>
    </Page>
  );
}
