import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ClipboardList, Hammer } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { workOrders } from './stores';
import { isOpen, isOverdue, type WorkOrder } from './types';

export function WorkOrderKpis() {
  const { t } = useI18n();
  const { rows } = useCollection(workOrders);
  const open = rows.filter(isOpen);
  const late = rows.filter((wo) => isOverdue(wo));
  const inProgress = rows.filter((wo) => wo.status === 'in_progress');
  return (
    <KpiGrid>
      <Kpi to="/workorders/list?status=open" label={t('Ordres ouverts', 'Open orders')} value={open.length} icon={<ClipboardList size={17} />} tone="accent" />
      <Kpi to="/workorders/list?status=late" label={t('En retard', 'Overdue')} value={late.length} icon={<AlertTriangle size={17} />} tone={late.length ? 'err' : 'ok'} />
      <Kpi to="/workorders/list?status=in_progress" label={t('En production', 'In progress')} value={inProgress.length} icon={<Hammer size={17} />} tone="warn" />
    </KpiGrid>
  );
}

/** Open tasks assigned to the signed-in person, earliest due first. */
export function MyTasks() {
  const { t, fmtDate } = useI18n();
  const { user } = useAuth();
  const { rows } = useCollection(workOrders);
  const mine = useMemo(() => {
    const out: { wo: WorkOrder; task: WorkOrder['tasks'][number] }[] = [];
    if (user) {
      rows.forEach((wo) => {
        if (!isOpen(wo)) return;
        wo.tasks.forEach((task) => {
          if (task.assigneeId === user.id && task.status !== 'done') out.push({ wo, task });
        });
      });
    }
    return out.sort((a, b) => (a.task.dueAt || '9999').localeCompare(b.task.dueAt || '9999')).slice(0, 6);
  }, [rows, user]);

  if (!mine.length) return <div className="widget-empty">{t('Aucune tâche assignée.', 'No tasks assigned to you.')}</div>;
  return (
    <ul className="widget-list">
      {mine.map(({ wo, task }) => (
        <li key={task.id}>
          <Link to={`/workorders/${wo.id}`} className="widget-list-main">
            <strong>{task.title || t('Sans titre', 'Untitled')}</strong> <span className="faint">— {wo.no} · {wo.customer}</span>
          </Link>
          <span className="faint small">{task.dueAt ? fmtDate(task.dueAt) : ''}</span>
        </li>
      ))}
    </ul>
  );
}
