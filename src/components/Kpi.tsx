import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="kpis">{children}</div>;
}

export function Kpi({
  label,
  value,
  hint,
  tone,
  to,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'ok' | 'warn' | 'err' | 'accent';
  to?: string;
  icon?: ReactNode;
}) {
  const body = (
    <>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {icon && <span className={`kpi-icon ${tone ?? ''}`}>{icon}</span>}
      </div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </>
  );
  return to ? (
    <Link to={to} className="kpi card">
      {body}
    </Link>
  ) : (
    <div className="kpi card">{body}</div>
  );
}
