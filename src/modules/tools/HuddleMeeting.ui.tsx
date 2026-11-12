/** Small shared pieces of the huddle meeting screen: cards, status marks and a helper that reports write errors. */
import { useCallback, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/components/ui';
import { STATUS_COLOR } from './lib';
import type { Status } from './schemas';

/** Button or link look without the browser chrome, for inline controls. */
export const LINK_RESET: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
};

/** A card with a title and optional actions; collapsible when `onToggle` is given. */
export function SectionCard({
  title,
  actions,
  open = true,
  onToggle,
  flush,
  children,
}: {
  title: string;
  actions?: ReactNode;
  open?: boolean;
  onToggle?: () => void;
  /** No padding around the content (tables). */
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="card-head" style={!open ? { borderBottom: 'none' } : undefined}>
        {onToggle ? (
          <h3 style={{ margin: 0, fontSize: 16 }}>
            <button type="button" onClick={onToggle} aria-expanded={open} style={{ ...LINK_RESET, display: 'inline-flex', alignItems: 'center', gap: 8, font: 'inherit', fontWeight: 600 }}>
              <ChevronDown size={18} aria-hidden style={{ transform: open ? undefined : 'rotate(-90deg)', transition: 'transform 0.15s', flex: 'none' }} />
              {title}
            </button>
          </h3>
        ) : (
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        )}
        {actions && <div className="row row-wrap">{actions}</div>}
      </div>
      {open && (flush ? children : <div className="card-pad">{children}</div>)}
    </section>
  );
}

export function StatusDot({ status, label }: { status: Status | 'none'; label?: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[status], flex: 'none' }}
    />
  );
}

/** Coloured pill naming a status (green, yellow or red). */
export function StatusPill({ status, label }: { status: Status; label: string }) {
  const c = STATUS_COLOR[status];
  return (
    <span className="badge" style={{ background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c }}>
      {label}
    </span>
  );
}

export function ProgressBar({ value, color }: { value: number; color: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="bar" style={{ minWidth: 90 }}>
      <div style={{ width: `${v}%`, background: color }} />
    </div>
  );
}

/** Runs a write and reports a failure as an error toast. */
export function useRun() {
  const toast = useToast();
  const { t } = useI18n();
  return useCallback(
    (fn: () => Promise<unknown>) => {
      fn().catch((e: unknown) => toast(e instanceof Error ? e.message : t('Erreur', 'Error'), 'err'));
    },
    [toast, t],
  );
}
