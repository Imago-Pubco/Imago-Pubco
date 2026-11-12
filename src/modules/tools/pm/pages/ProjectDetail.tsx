import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FolderKanban, Pencil } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty } from '@/components/ui';
import { PROJECT_STATUS_COLOR, projectActuals } from '../lib';
import { ProjectForm } from '../Projects.form';
import { clients, expenses, pmTasks, projects, timeEntries } from '../stores';
import { OverviewTab } from '../ProjectDetail.overview';
import { TasksTab } from '../ProjectDetail.tasks';
import { TimeTab } from '../ProjectDetail.time';
import { ExpensesTab } from '../ProjectDetail.expenses';
import { TeamTab } from '../ProjectDetail.team';
import { Badge, dateLabel } from '../ProjectDetail.ui';
import { BILLING_LABEL, PROJECT_STATUS_LABEL, bi } from '../ProjectDetail.labels';

type TabKey = 'overview' | 'tasks' | 'time' | 'expenses' | 'team';

/** One project: header, budget vs actuals, tasks, time, expenses and team. */
export function ProjectDetail() {
  const { t, lang } = useI18n();
  const { id = '' } = useParams();
  const { can, user } = useAuth();
  const { rows: projectRows, loading } = useCollection(projects);
  const { rows: clientRows } = useCollection(clients);
  const { rows: taskRows } = useCollection(pmTasks);
  const { rows: entryRows } = useCollection(timeEntries);
  const { rows: expenseRows } = useCollection(expenses);
  const nameOf = useUserName();
  const [tab, setTab] = useState<TabKey>('overview');
  const [editing, setEditing] = useState(false);

  const project = projectRows.find((p) => p.id === id);
  const projectId = project?.id ?? id;
  const me = user?.id ?? '';
  const canManage = can('tools.pm.manage');
  const canReports = can('tools.pm.reports');
  const canWriteTasks = !!project && (canManage || project.managerId === me || project.memberIds.includes(me));

  const entries = useMemo(() => entryRows.filter((e) => e.projectId === projectId), [entryRows, projectId]);
  const tasks = useMemo(() => taskRows.filter((x) => x.projectId === projectId), [taskRows, projectId]);
  const projectExpenses = useMemo(
    () => expenseRows.filter((x) => x.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date)),
    [expenseRows, projectId],
  );
  const actuals = useMemo(() => projectActuals(projectId, entries, projectExpenses), [projectId, entries, projectExpenses]);

  const backLink = (
    <Link to="/tools/pm/projects" className="btn btn-ghost btn-sm" style={{ marginBottom: 12, marginLeft: -10 }}>
      <ArrowLeft size={16} /> {t('Projets', 'Projects')}
    </Link>
  );

  if (!project) {
    return (
      <Page>
        {backLink}
        {loading ? (
          <p className="muted">{t('Chargement…', 'Loading…')}</p>
        ) : (
          <div className="card">
            <Empty icon={<FolderKanban size={40} />} title={t('Projet introuvable', 'Project not found')}>
              {t('Ce projet n’existe pas ou a été supprimé.', 'This project does not exist or was deleted.')}
            </Empty>
          </div>
        )}
      </Page>
    );
  }

  const client = project.clientId ? clientRows.find((c) => c.id === project.clientId) : undefined;
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: t("Vue d'ensemble", 'Overview') },
    { key: 'tasks', label: t('Tâches', 'Tasks') },
    { key: 'time', label: t('Temps', 'Time') },
    { key: 'expenses', label: t('Dépenses', 'Expenses') },
    { key: 'team', label: t('Équipe', 'Team') },
  ];

  return (
    <Page>
      {backLink}

      <div className="page-head">
        <div>
          <div className="eyebrow">{t('Outils · Gestion de projet', 'Tools · Project management')}</div>
          <h1>
            <span className="mono">{project.code}</span> {project.name}
          </h1>
          <div className="row row-wrap" style={{ marginTop: 8, gap: 8 }}>
            <Badge color={PROJECT_STATUS_COLOR[project.status]}>{bi(PROJECT_STATUS_LABEL[project.status], lang)}</Badge>
            <Badge>{bi(BILLING_LABEL[project.billing], lang)}</Badge>
          </div>
          <div className="small muted" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
            <span>
              {t('Client', 'Client')} : {client ? client.name : '—'}
            </span>
            <span>
              {t('Responsable', 'Manager')} : {project.managerId ? nameOf(project.managerId) : '—'}
            </span>
            <span>
              {t('Dates', 'Dates')} : {dateLabel(project.startDate, lang)} – {dateLabel(project.endDate, lang)}
            </span>
          </div>
        </div>
        {canManage && (
          <div className="row row-wrap">
            <button className="btn" onClick={() => setEditing(true)}>
              <Pencil size={16} /> {t('Modifier', 'Edit')}
            </button>
          </div>
        )}
      </div>

      <div className="tabs">
        {tabs.map((x) => (
          <button key={x.key} className={`tab ${tab === x.key ? 'active' : ''}`} onClick={() => setTab(x.key)}>
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab project={project} actuals={actuals} entries={entries} canReports={canReports} />}
      {tab === 'tasks' && (
        <TasksTab project={project} tasks={tasks} entries={entries} canWrite={canWriteTasks} canRates={canManage} nameOf={nameOf} />
      )}
      {tab === 'time' && <TimeTab project={project} entries={entries} tasks={tasks} nameOf={nameOf} />}
      {tab === 'expenses' && <ExpensesTab project={project} items={projectExpenses} canManage={canManage} />}
      {tab === 'team' && <TeamTab project={project} entries={entries} tasks={tasks} nameOf={nameOf} />}

      {editing && <ProjectForm project={project} onClose={() => setEditing(false)} />}
    </Page>
  );
}
