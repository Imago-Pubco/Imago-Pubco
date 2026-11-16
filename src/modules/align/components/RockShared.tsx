/** Small pieces and helpers shared by the Rocks pages, the priority panel, the dashboard and the huddles. */
import type { CSSProperties } from 'react';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { HEALTH_COLOR, HEALTH_LABEL, STATUS_LABEL, planOrDefault } from '../lib';
import type { AlignPriority, Health, PriorityStatus, Strategy } from '../schemas';

/** The saved plan (row "plan") or the default one. */
export const planFrom = (rows: Strategy[]) => planOrDefault(rows.find((r) => r.id === 'plan'));

/** Active users, sorted by name; `keepId` is kept even when inactive (e.g. the current owner). */
export function userOptions(all: User[], keepId?: string | null): User[] {
  return all.filter((u) => u.active || u.id === keepId).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Quarters offered in pickers: from 2 quarters back to 6 ahead, plus the given ones. */
export function quarterOptions(base: string, ...extra: string[]): string[] {
  const set = new Set<string>(extra);
  const [y, n] = base.split('-Q').map(Number);
  for (let i = -2; i <= 6; i++) {
    const k = y * 4 + (n - 1) + i;
    set.add(`${Math.floor(k / 4)}-Q${(k % 4) + 1}`);
  }
  return [...set].sort();
}

/** Priorities by due date (none last), then by order. */
export const sortPriorities = (a: AlignPriority, b: AlignPriority) =>
  (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.order - b.order;

export const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** Progress bar of the Align screens; `pct` is clamped to 0–100. */
export function ProgressBar({ pct, large, className, style }: { pct: number; large?: boolean; className?: string; style?: CSSProperties }) {
  const v = Math.max(0, Math.min(100, pct));
  const cls = ['align-bar', large && 'rock-bar-lg', className].filter(Boolean).join(' ');
  return (
    <div className={cls} style={style} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

/** Health dot (green / yellow / red), labelled for screen readers; `withLabel` adds the text next to it. */
export function HealthDot({ health, withLabel, title, className = 'rock-health' }: { health: Health; withLabel?: boolean; title?: string; className?: string }) {
  const { t } = useI18n();
  const label = t(HEALTH_LABEL[health]);
  const dot = <span className={className} style={{ background: HEALTH_COLOR[health] }} role="img" aria-label={label} title={title ?? label} />;
  if (!withLabel) return dot;
  return (
    <span className="row" style={{ gap: 6, display: 'inline-flex', whiteSpace: 'nowrap' }}>
      {dot}
      <span className="small">{label}</span>
    </span>
  );
}

/** Error text for a toast or a message, whatever was thrown. */
export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const STATUS_BADGE: Record<PriorityStatus, string> = {
  not_started: 'badge',
  in_progress: 'badge badge-info',
  completed: 'badge badge-ok',
};

export function StatusBadge({ status }: { status: PriorityStatus }) {
  const { t } = useI18n();
  return <span className={STATUS_BADGE[status]}>{t(STATUS_LABEL[status])}</span>;
}
