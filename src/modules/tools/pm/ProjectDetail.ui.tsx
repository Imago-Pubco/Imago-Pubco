import type { CSSProperties, ReactNode } from 'react';
import { Avatar } from '@/modules/admin/pages/Users';
import { parseDate } from './lib';

/** A small pill; `className` is a global badge modifier (badge-ok, badge-err...). */
export function Badge({ children, className = '', color }: { children: ReactNode; className?: string; color?: string }) {
  return (
    <span className={`badge ${className}`} style={color ? { color } : undefined}>
      {children}
    </span>
  );
}

/** Horizontal bar, `value` in percent (clamped to 0..100 for display). */
export function ProgressBar({ value, color }: { value: number; color: string }) {
  const w = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(w)}
      style={{ height: 8, borderRadius: 999, background: 'var(--bg-sunken)', overflow: 'hidden' }}
    >
      <div style={{ width: `${w}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
    </div>
  );
}

/** Avatar and name of a person. */
export function Person({ name }: { name: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Avatar name={name} size={24} />
      <span>{name}</span>
    </span>
  );
}

/** A calendar date (YYYY-MM-DD) in the user's language; "—" when not set. */
export function dateLabel(s: string | null | undefined, lang: string): string {
  if (!s) return '—';
  return parseDate(s).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** 95.5 -> "95,5 $/h". */
export const rateLabel = (r: number, lang: string) => `${r.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 2 })} $/h`;

/** Responsive grid of cards. */
export const CARD_GRID: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 };
