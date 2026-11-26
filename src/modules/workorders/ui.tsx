import { useMemo } from 'react';
import { useCollection } from '@/data/db';
import { groups, users } from '@/data/stores';
import type { User } from '@/data/types';
import { effectivePermissions, hasPermission } from '@/auth/permissions';
import { useI18n } from '@/i18n';
import { isOverdue, isOpen, daysUntilDue, WO_STATUS_LABEL, taskProgress, type WorkOrder, type WorkOrderStatus, type WorkOrderTask } from './types';

/** All users, with a lookup by id. */
export function useUsers() {
  const { rows } = useCollection(users);
  const byId = useMemo(() => new Map(rows.map((u) => [u.id, u])), [rows]);
  const active = useMemo(() => rows.filter((u) => u.active).sort((a, b) => a.displayName.localeCompare(b.displayName)), [rows]);
  return { all: rows, active, byId };
}

/** Active people who may manage work orders (eligible production managers). */
export function useManagers() {
  const { active } = useUsers();
  const { rows: allGroups } = useCollection(groups);
  return useMemo(
    () => active.filter((u) => hasPermission(effectivePermissions(u, allGroups), 'workorders.manage')),
    [active, allGroups],
  );
}

/** Display name for a user id, with a readable fallback for unknown or 'system' ids. */
export function useUserName() {
  const { byId } = useUsers();
  return (id?: string) => (id === 'system' ? 'Automatisation' : (byId.get(id ?? '')?.displayName ?? (id ? id : '—')));
}

export function Avatar({ user, size = 28 }: { user?: User; size?: number }) {
  const name = user?.displayName ?? '';
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?';
  if (user?.photo) {
    return <img className="wo-avatar" src={user.photo} alt="" style={{ width: size, height: size, objectFit: 'cover' }} />;
  }
  return (
    <span className="wo-avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {initials}
    </span>
  );
}

const STATUS_BADGE: Record<WorkOrderStatus, string> = {
  new: 'badge-info',
  planned: 'badge-accent',
  in_progress: 'badge-warn',
  hold: 'badge-err',
  done: 'badge-ok',
  shipped: 'badge-ok',
};

export function WoStatusBadge({ status }: { status: WorkOrderStatus }) {
  const { t } = useI18n();
  return <span className={`badge ${STATUS_BADGE[status]}`}>{t(WO_STATUS_LABEL[status])}</span>;
}

/** Due date, coloured when late (red) or due within three days (amber). */
export function DueDate({ wo }: { wo: WorkOrder }) {
  const { t, fmtDate } = useI18n();
  if (!wo.dueDate) return <span className="faint small">—</span>;
  const late = isOverdue(wo);
  const soon = !late && isOpen(wo) && daysUntilDue(wo) <= 3;
  const cls = late ? 'wo-due is-late' : soon ? 'wo-due is-soon' : 'wo-due';
  return (
    <span className={cls} title={late ? t('En retard', 'Overdue') : undefined}>
      {late && <span className="sr-only">{t('En retard : ', 'Overdue: ')}</span>}
      {fmtDate(wo.dueDate)}
    </span>
  );
}

export function ProgressBar({ tasks, compact }: { tasks: WorkOrderTask[]; compact?: boolean }) {
  const { t } = useI18n();
  const { done, total, pct } = taskProgress(tasks);
  return (
    <div className={`wo-progress ${compact ? 'is-compact' : ''}`}>
      <div
        className="wo-progress-bar"
        role="progressbar"
        aria-label={t('Tâches terminées', 'Tasks done')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${done} / ${total}`}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="faint small mono">
        {done}/{total}
      </span>
    </div>
  );
}
