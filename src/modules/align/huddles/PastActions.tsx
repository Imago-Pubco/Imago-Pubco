import { useState } from 'react';
import { CalendarArrowDown, ChevronDown, GripVertical, History } from 'lucide-react';
import type { User } from '@/data/types';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { MemberAvatar } from '../components/WeekKit';
import type { AlignTask } from '../schemas';
import { canEditTask, taskStaleness } from '../tasks/taskLib';
import { ElectricFx, StaleBadge } from '../tasks/TaskList';
import { weekLabel } from '../week';

const OPEN_KEY = 'imago:align:past-actions-open';

/**
 * Actions of earlier weeks that were never completed. Each one can be dragged onto a person of the selected week
 * (it joins that person's plan) or moved to the selected week with the button, keeping its owner.
 */
export function PastActions({
  tasks,
  week,
  userById,
  onReschedule,
  onDragStart,
  onDragEnd,
}: {
  /** Open tasks of weeks before the selected one, members only. */
  tasks: AlignTask[];
  week: string;
  userById: Map<string, User>;
  onReschedule: (task: AlignTask) => void;
  onDragStart: (task: AlignTask) => void;
  onDragEnd: () => void;
}) {
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  const canManage = can('align.priorities.manage');
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? '1' : '0');
    } catch {
      /* this session only */
    }
  };

  return (
    <div className="align-past">
      <button className="align-past-toggle" onClick={toggle} aria-expanded={open} title={open ? t('Masquer', 'Hide') : t('Afficher', 'Show')}>
        <ChevronDown size={14} className={`align-past-chevron${open ? ' open' : ''}`} />
        <History size={14} />
        <strong>{t('Plans d’action passés non complétés', 'Past action plans not completed')}</strong>
        <span className="badge">{tasks.length}</span>
      </button>
      {open &&
        (tasks.length === 0 ? (
          <div className="small muted align-past-empty">{t('Rien en retard : tout est complété.', 'Nothing left over: all done.')}</div>
        ) : (
          <>
            <div className="small muted align-past-hint">
              {t('Glissez une action sur une personne ci-dessous, ou reportez-la à cette semaine.', 'Drag an action onto a person below, or move it to this week.')}
            </div>
            <ul className="align-task-list">
              {tasks.map((task) => {
                const editable = canEditTask(task, user!.id, canManage);
                const stale = taskStaleness(task);
                return (
                  <li
                    key={task.id}
                    className={`align-task-row align-past-row${stale !== 'none' ? ` is-stale-${stale}` : ''}`}
                    draggable={editable}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', task.id);
                      e.dataTransfer.effectAllowed = 'move';
                      onDragStart(task);
                    }}
                    onDragEnd={onDragEnd}
                  >
                    {editable && <GripVertical size={14} className="muted" aria-hidden />}
                    <span className="align-task-title" title={task.title}>
                      {task.title}
                    </span>
                    {stale === 'alert' && <ElectricFx />}
                    {stale !== 'none' && <StaleBadge task={task} level={stale} />}
                    <span className="small muted align-nowrap">{weekLabel(task.weekStart, lang)}</span>
                    <span className="align-task-owner" title={userById.get(task.ownerId)?.displayName ?? task.ownerId}>
                      <MemberAvatar user={userById.get(task.ownerId)} name={task.ownerId} size={20} />
                    </span>
                    {editable && (
                      <button
                        className="btn btn-sm"
                        title={t(`Reporter à la semaine du ${weekLabel(week, lang)}`, `Move to the week of ${weekLabel(week, lang)}`)}
                        onClick={() => onReschedule(task)}
                      >
                        <CalendarArrowDown size={13} /> {t('Reporter à cette semaine', 'Move to this week')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ))}
    </div>
  );
}
