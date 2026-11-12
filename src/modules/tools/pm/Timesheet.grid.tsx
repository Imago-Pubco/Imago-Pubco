import { useRef, useState } from 'react';
import { Lock, StickyNote, TriangleAlert, Undo2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { TimeEntry } from './schemas';
import { fmtHours } from './lib';
import { dayLabel, entryTotal, hoursText, isLocked, type RowRef } from './Timesheet.helpers';

/** One line of the grid, built by the page from the week's entries and the lines added by hand. */
export interface GridRow {
  key: string;
  ref: RowRef;
  code: string;
  projectName: string;
  color: string;
  taskName: string | null;
  entries: TimeEntry[];
  /** The person may book new time on this line's project. */
  bookable: boolean;
}

interface GridProps {
  dates: string[];
  rows: GridRow[];
  onSave: (row: GridRow, date: string, raw: string) => Promise<boolean>;
  onOpen: (row: GridRow, date: string) => void;
  onResume: (row: GridRow) => void;
  onRemoveEmpty: (row: GridRow) => void;
}

/** Only real colours (#hex) are used on the line swatch: project colours are free text. */
const swatchColor = (c: string) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : 'var(--accent)');

export function TimesheetGrid({ dates, rows, onSave, onOpen, onResume, onRemoveEmpty }: GridProps) {
  const { t, lang } = useI18n();
  const dayTotals = dates.map((d) => entryTotal(rows.flatMap((r) => r.entries.filter((e) => e.date === d))));
  const weekTotal = entryTotal(rows.flatMap((r) => r.entries));

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 250 }}>{t('Projet · tâche', 'Project · task')}</th>
              {dates.map((d) => (
                <th key={d} style={{ textAlign: 'center', minWidth: 100 }}>
                  {dayLabel(d, lang)}
                </th>
              ))}
              <th style={{ textAlign: 'center', minWidth: 90 }}>{t('Total', 'Total')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={dates.length + 2} className="faint" style={{ textAlign: 'center', padding: 28 }}>
                  {t(
                    'Aucune ligne cette semaine. Ajoutez un projet ci-dessous ou démarrez le chronomètre.',
                    'No line this week. Add a project below or start the timer.',
                  )}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <GridRowView key={row.key} row={row} dates={dates} onSave={onSave} onOpen={onOpen} onResume={onResume} onRemoveEmpty={onRemoveEmpty} />
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <th style={{ textAlign: 'left' }}>{t('Total du jour', 'Day total')}</th>
                {dayTotals.map((h, i) => (
                  <td key={dates[i]} style={{ textAlign: 'center', fontWeight: 600, color: h > 24 ? 'var(--err)' : undefined }}>
                    {h ? hoursText(h) : '—'}
                  </td>
                ))}
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{fmtHours(weekTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function GridRowView({
  row,
  dates,
  onSave,
  onOpen,
  onResume,
  onRemoveEmpty,
}: Pick<GridProps, 'dates' | 'onSave' | 'onOpen' | 'onResume' | 'onRemoveEmpty'> & { row: GridRow }) {
  const { t } = useI18n();
  const rowTotal = entryTotal(row.entries);
  const hasSubmitted = row.entries.some((e) => e.status === 'submitted');
  const rejected = row.entries.find((e) => e.status === 'rejected' && e.reviewNote);
  return (
    <tr>
      <th scope="row" style={{ textAlign: 'left', fontWeight: 400, verticalAlign: 'top' }}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 8, flexWrap: 'nowrap' }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, marginTop: 5, flex: '0 0 auto', background: swatchColor(row.color) }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
              {row.code && `${row.code} · `}
              {row.projectName}
            </div>
            <div className="small muted">{row.taskName ?? t('Sans tâche', 'No task')}</div>
            {rejected && (
              <div className="small" style={{ color: 'var(--err)', overflowWrap: 'anywhere' }}>
                {t('Rejeté', 'Rejected')} : {rejected.reviewNote}
              </div>
            )}
            {(hasSubmitted || row.entries.length === 0) && (
              <div className="row row-wrap" style={{ gap: 6, marginTop: 4 }}>
                {hasSubmitted && (
                  <button className="btn btn-ghost btn-sm" onClick={() => onResume(row)}>
                    <Undo2 size={13} /> {t('Reprendre pour modifier', 'Take back to edit')}
                  </button>
                )}
                {row.entries.length === 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => onRemoveEmpty(row)}>
                    {t('Retirer la ligne', 'Remove line')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </th>
      {dates.map((d) => (
        <GridCellView key={d} row={row} date={d} onSave={onSave} onOpen={onOpen} />
      ))}
      <td style={{ textAlign: 'center', fontWeight: 600, verticalAlign: 'middle' }}>{rowTotal ? fmtHours(rowTotal) : '—'}</td>
    </tr>
  );
}

function GridCellView({ row, date, onSave, onOpen }: { row: GridRow; date: string; onSave: GridProps['onSave']; onOpen: GridProps['onOpen'] }) {
  const { t } = useI18n();
  const cell = row.entries.filter((e) => e.date === date);
  const total = entryTotal(cell);
  const mode: 'edit' | 'locked' | 'multi' | 'off' = cell.length > 1 ? 'multi' : cell.length === 1 ? (isLocked(cell[0]) ? 'locked' : 'edit') : row.bookable ? 'edit' : 'off';
  const only = cell.length === 1 ? cell[0] : undefined;
  const tint = only?.status === 'submitted' ? 'var(--warn)' : only?.status === 'approved' ? 'var(--ok)' : only?.status === 'rejected' ? 'var(--err)' : null;
  const reviewNote = cell.find((e) => e.status === 'rejected')?.reviewNote ?? '';
  const hasNote = cell.some((e) => e.note.trim() !== '');

  return (
    <td style={{ textAlign: 'center', padding: '6px 4px', verticalAlign: 'middle', background: tint ? `color-mix(in srgb, ${tint} 12%, transparent)` : undefined }}>
      <div className="row" style={{ justifyContent: 'center', gap: 2, flexWrap: 'nowrap' }}>
        {mode === 'edit' && (
          <HoursInput value={total} label={`${row.projectName} · ${date}`} onCommit={(raw) => onSave(row, date, raw)} />
        )}
        {mode === 'off' && <span className="faint">·</span>}
        {mode === 'locked' && (
          <span title={t('Verrouillé : soumis ou approuvé', 'Locked: submitted or approved')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className="mono">{hoursText(total)}</span>
            <Lock size={12} color="var(--text-3)" aria-label={t('Verrouillé', 'Locked')} />
          </span>
        )}
        {mode === 'multi' && (
          <span title={t('Plusieurs entrées : la somme est affichée. Ouvrez le détail pour les modifier.', 'Several entries: the sum is shown. Open the detail to edit them.')} className="mono">
            {hoursText(total)}
          </span>
        )}
        {mode === 'multi' && <span className="badge" style={{ height: 18, padding: '0 6px' }}>×{cell.length}</span>}
        {reviewNote && (
          <span title={reviewNote} aria-label={reviewNote} style={{ display: 'inline-flex' }}>
            <TriangleAlert size={13} color="var(--err)" />
          </span>
        )}
        {total > 0 && (
          <button
            className="btn btn-ghost btn-icon btn-sm"
            style={{ color: hasNote ? 'var(--accent)' : 'var(--text-3)' }}
            onClick={() => onOpen(row, date)}
            title={hasNote ? t('Voir la note', 'View note') : t('Ajouter une note', 'Add a note')}
            aria-label={hasNote ? t('Voir la note', 'View note') : t('Ajouter une note', 'Add a note')}
          >
            <StickyNote size={14} />
          </button>
        )}
      </div>
    </td>
  );
}

/** An hours input that commits on blur (Enter) and cancels on Escape. It follows the stored value when it changes. */
function HoursInput({ value, label, onCommit }: { value: number; label: string; onCommit: (raw: string) => Promise<boolean> }) {
  const { t } = useI18n();
  const shown = value ? hoursText(value) : '';
  const [text, setText] = useState(shown);
  const [seen, setSeen] = useState(shown);
  if (seen !== shown) {
    setSeen(shown);
    setText(shown);
  }
  const busy = useRef(false);
  const cancel = useRef(false);

  const commit = async () => {
    if (cancel.current) {
      cancel.current = false;
      setText(shown);
      return;
    }
    if (busy.current || text === shown) return;
    busy.current = true;
    const ok = await onCommit(text);
    busy.current = false;
    if (!ok) setText(shown);
  };

  return (
    <input
      className="input input-sm"
      style={{ width: 66, textAlign: 'center', padding: '0 4px' }}
      inputMode="decimal"
      value={text}
      placeholder="0"
      title={t('Heures (1,5 ou 1:30) · vide = aucune entrée', 'Hours (1.5 or 1:30) · empty = no entry')}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          cancel.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}
