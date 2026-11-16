import type { ReactNode } from 'react';
import type { PlanRow } from '../schemas';
import { LineInput, ListEditor } from './ListEditor';
import { RowsEditor } from './RowsEditor';

/** Dash shown for an empty field. */
export const Dash = () => <span className="faint">—</span>;

/** A titled panel of the plan sheet. */
export function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`align-plan-panel${className ? ` ${className}` : ''}`}>
      <h3 className="align-plan-title">{title}</h3>
      {children}
    </section>
  );
}

/** Section heading of the sheet (Fondation, 3 à 5 ans, …). */
export function SectionHead({ title }: { title: string }) {
  return <h2 className="align-plan-section">{title}</h2>;
}

/** A small titled list inside a panel (for example Bilan / Résultats). */
export function SubList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="align-plan-sub">
      <h4 className="align-plan-subtitle">{title}</h4>
      {children}
    </div>
  );
}

/** Multi-line text (line breaks kept), or an input in edit mode. */
export function TextBlock({
  editing,
  value,
  max,
  rows = 5,
  label,
  onChange,
}: {
  editing: boolean;
  value: string;
  max: number;
  rows?: number;
  label: string;
  onChange: (v: string) => void;
}) {
  if (editing) return <LineInput value={value} max={max} rows={rows} label={label} onChange={onChange} />;
  return value.trim() ? <p className="align-plan-text align-prewrap">{value}</p> : <Dash />;
}

/** A list of short lines: bullets, numbered when `numbered`, or an editor in edit mode. */
export function StringList({
  editing,
  items,
  max,
  label,
  addLabel,
  numbered,
  onChange,
}: {
  editing: boolean;
  items: string[];
  max: number;
  label: string;
  addLabel: string;
  numbered?: boolean;
  onChange: (items: string[]) => void;
}) {
  if (editing) {
    return (
      <ListEditor
        items={items}
        max={max}
        addLabel={addLabel}
        makeItem={() => ''}
        onChange={onChange}
        renderItem={(v, set) => <LineInput value={v} onChange={set} label={label} rows={1} />}
      />
    );
  }
  if (!items.length) return <Dash />;
  const Tag = numbered ? 'ol' : 'ul';
  return (
    <Tag className="align-plan-list">
      {items.map((v, i) => (
        <li key={i}>{v}</li>
      ))}
    </Tag>
  );
}

/** A plan table (what, projected, actual, owner). */
export function RowsTable({ rows, firstLabel, ownerLabel, projectedLabel, actualLabel }: { rows: PlanRow[]; firstLabel: string; ownerLabel: string; projectedLabel: string; actualLabel: string }) {
  if (!rows.length) return <Dash />;
  return (
    <div className="table-wrap align-rows-wrap">
      <table className="table align-rows-table">
        <thead>
          <tr>
            <th>{firstLabel}</th>
            <th>{projectedLabel}</th>
            <th>{actualLabel}</th>
            <th>{ownerLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.category}</td>
              <td className="mono">{r.projected || '—'}</td>
              <td className="mono">{r.actual || '—'}</td>
              <td>{r.owner || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A plan table: the rows editor in edit mode, the table otherwise. */
export function PlanTable({
  editing,
  rows,
  onChange,
  firstLabel,
  labels,
}: {
  editing: boolean;
  rows: PlanRow[];
  onChange: (rows: PlanRow[]) => void;
  firstLabel: string;
  labels: { projected: string; actual: string; owner: string };
}) {
  if (editing) return <RowsEditor rows={rows} firstLabel={firstLabel} onChange={onChange} />;
  return <RowsTable rows={rows} firstLabel={firstLabel} ownerLabel={labels.owner} projectedLabel={labels.projected} actualLabel={labels.actual} />;
}
