export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Stacked bar with a legend; segments are sized by their share of the total. */
export function SegmentBar({ segments, label }: { segments: Segment[]; label: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <>
      <div className="align-dash-seg" role="img" aria-label={label}>
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => <span key={s.key} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label} : ${s.value}`} />)}
      </div>
      <ul className="align-dash-legend">
        {segments.map((s) => (
          <li key={s.key}>
            <span className="align-dash-dot" style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong className="mono">{s.value}</strong>
          </li>
        ))}
      </ul>
    </>
  );
}
