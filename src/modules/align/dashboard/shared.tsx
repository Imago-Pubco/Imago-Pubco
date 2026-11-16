import { HoverList, type HoverItem } from '../components/Insight';

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
  /** What is behind the segment (shown on hover). */
  items?: HoverItem[];
}

/**
 * Stacked bar with a legend; segments are sized by their share of the total. Hovering a segment (or its legend line)
 * lists what is behind it; clicking opens the details (onOpen).
 */
export function SegmentBar({ segments, label, onOpen }: { segments: Segment[]; label: string; onOpen?: (key: string) => void }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <>
      <div className="align-dash-seg" role="img" aria-label={label}>
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <HoverList
                key={s.key}
                className="align-dash-seg-part"
                style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
                title={`${s.label} : ${s.value}`}
                items={s.items ?? []}
                onOpen={onOpen ? () => onOpen(s.key) : undefined}
              >
                <span />
              </HoverList>
            ))}
      </div>
      <ul className="align-dash-legend">
        {segments.map((s) => (
          <li key={s.key}>
            <HoverList
              className="align-dash-legend-item"
              title={`${s.label} : ${s.value}`}
              items={s.items ?? []}
              onOpen={onOpen && s.value > 0 ? () => onOpen(s.key) : undefined}
            >
              <span className="align-dash-dot" style={{ background: s.color }} />
              <span>{s.label}</span>
              <strong className="mono">{s.value}</strong>
            </HoverList>
          </li>
        ))}
      </ul>
    </>
  );
}
