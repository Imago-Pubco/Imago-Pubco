/** Tiny inline-SVG line of a KPI's recent values. Missing values (null) are skipped. */
export function Sparkline({ values, color = 'var(--accent)' }: { values: (number | null)[]; color?: string }) {
  const W = 120;
  const H = 32;
  const P = 3;
  const points = values.flatMap((v, i) => (v === null ? [] : [{ i, v }]));
  if (points.length === 0) return <div style={{ height: H }} />;

  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => P + (i / Math.max(values.length - 1, 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const line = points.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true" style={{ display: 'block', marginTop: 10 }}>
      {points.length > 1 && <polyline points={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />}
      <circle cx={x(last.i)} cy={y(last.v)} r={2.5} fill={color} />
    </svg>
  );
}
