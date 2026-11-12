import { useState } from 'react';
import { Plus, Trash } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import type { TimeEntry } from './schemas';
import { ENTRY_STATUS_COLOR, MAX_HOURS_PER_DAY, dateLabel, hoursText, isLocked, parseHours, statusText } from './Timesheet.helpers';

interface DetailProps {
  open: boolean;
  onClose: () => void;
  /** "P-2026-014 · Nom du projet · Tâche" */
  title: string;
  date: string;
  /** Entries of this cell (one line, one day). */
  entries: TimeEntry[];
  /** Hours of the same day on the other lines. */
  dayOthers: number;
  canAdd: boolean;
  onSave: (e: TimeEntry, hours: number, note: string) => Promise<boolean>;
  onDelete: (e: TimeEntry) => Promise<boolean>;
  onAdd: (hours: number, note: string) => Promise<boolean>;
}

/** Day detail of one cell: each entry with its hours and note, plus a form to add another entry. */
export function CellDetailModal({ open, onClose, title, date, entries, dayOthers, canAdd, onSave, onDelete, onAdd }: DetailProps) {
  const { t, lang } = useI18n();
  const cellTotal = entries.reduce((a, e) => a + e.hours, 0);
  return (
    <Modal open={open} onClose={onClose} title={t('Détail de la journée', 'Day detail')} large>
      <p className="small muted" style={{ margin: '0 0 4px' }}>
        {dateLabel(date, lang)} · {title}
      </p>
      <p className="small" style={{ margin: '0 0 12px' }}>
        {t('Total de la case', 'Cell total')} : <strong>{hoursText(cellTotal)} h</strong>
      </p>
      {entries.length === 0 && <p className="faint">{t('Aucune entrée : saisissez des heures ci-dessous.', 'No entry yet: enter hours below.')}</p>}
      {entries.map((e) => (
        <EntryEditor
          key={`${e.id}:${e.hours}:${e.note}:${e.status}`}
          entry={e}
          dayOthers={dayOthers}
          siblingsTotal={cellTotal - e.hours}
          onSave={onSave}
          onDelete={onDelete}
        />
      ))}
      {canAdd && <AddEntry dayOthers={dayOthers} cellTotal={cellTotal} onAdd={onAdd} />}
    </Modal>
  );
}

function EntryEditor({
  entry,
  dayOthers,
  siblingsTotal,
  onSave,
  onDelete,
}: {
  entry: TimeEntry;
  dayOthers: number;
  siblingsTotal: number;
  onSave: DetailProps['onSave'];
  onDelete: DetailProps['onDelete'];
}) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const locked = isLocked(entry);
  const [hours, setHours] = useState(hoursText(entry.hours));
  const [note, setNote] = useState(entry.note);
  const [busy, setBusy] = useState(false);
  const dirty = hours !== hoursText(entry.hours) || note !== entry.note;

  const save = async () => {
    const parsed = parseHours(hours);
    if (parsed.kind === 'max') return toast(t('Maximum 24 h par entrée', 'Maximum 24 h per entry'), 'err');
    if (parsed.kind !== 'value') return toast(t('Saisissez des heures (1,5 ou 1:30). Utilisez la corbeille pour supprimer.', 'Enter hours (1.5 or 1:30). Use the bin to delete.'), 'err');
    if (dayOthers + siblingsTotal + parsed.value > MAX_HOURS_PER_DAY) return toast(t('Une journée ne peut pas dépasser 24 h', 'A day cannot exceed 24 h'), 'err');
    setBusy(true);
    await onSave(entry, parsed.value, note.trim());
    setBusy(false);
  };

  const remove = async () => {
    if (!window.confirm(t('Supprimer cette entrée ?', 'Delete this entry?'))) return;
    setBusy(true);
    await onDelete(entry);
    setBusy(false);
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 0' }}>
      <div className="row row-wrap" style={{ alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span className="badge" style={{ color: ENTRY_STATUS_COLOR[entry.status], borderColor: ENTRY_STATUS_COLOR[entry.status] }}>
          {statusText(entry.status, lang)}
        </span>
        {entry.billable && <span className="badge badge-ok">{t('Facturable', 'Billable')}</span>}
        <div className="spacer" />
        {locked ? (
          <span className="mono">{hoursText(entry.hours)} h</span>
        ) : (
          <>
            <input
              className="input input-sm"
              style={{ width: 90, textAlign: 'right' }}
              inputMode="decimal"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              aria-label={t('Heures', 'Hours')}
              disabled={busy}
            />
            <button className="btn btn-ghost btn-icon btn-sm" onClick={remove} disabled={busy} title={t('Supprimer', 'Delete')} aria-label={t('Supprimer', 'Delete')}>
              <Trash size={16} />
            </button>
          </>
        )}
      </div>
      {entry.status === 'rejected' && entry.reviewNote && (
        <div className="alert alert-err small" style={{ marginBottom: 8 }}>
          {t('Motif du rejet', 'Rejection reason')} : {entry.reviewNote}
        </div>
      )}
      {locked ? (
        entry.note && <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{entry.note}</p>
      ) : (
        <>
          <textarea
            className="textarea"
            style={{ minHeight: 56 }}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('Note (facultative)', 'Note (optional)')}
            aria-label={t('Note', 'Note')}
            disabled={busy}
          />
          {dirty && (
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
                {t('Enregistrer', 'Save')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AddEntry({ dayOthers, cellTotal, onAdd }: { dayOthers: number; cellTotal: number; onAdd: DetailProps['onAdd'] }) {
  const { t } = useI18n();
  const toast = useToast();
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const parsed = parseHours(hours);
    if (parsed.kind === 'max') return toast(t('Maximum 24 h par entrée', 'Maximum 24 h per entry'), 'err');
    if (parsed.kind !== 'value') return toast(t('Saisissez des heures (1,5 ou 1:30)', 'Enter hours (1.5 or 1:30)'), 'err');
    if (dayOthers + cellTotal + parsed.value > MAX_HOURS_PER_DAY) return toast(t('Une journée ne peut pas dépasser 24 h', 'A day cannot exceed 24 h'), 'err');
    setBusy(true);
    const ok = await onAdd(parsed.value, note.trim());
    setBusy(false);
    if (ok) {
      setHours('');
      setNote('');
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <div className="row row-wrap" style={{ alignItems: 'center', gap: 10 }}>
        <input
          className="input input-sm"
          style={{ width: 90, textAlign: 'right' }}
          inputMode="decimal"
          placeholder="0,0"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          aria-label={t('Heures', 'Hours')}
          disabled={busy}
        />
        <input
          className="input input-sm"
          style={{ flex: '1 1 200px' }}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('Note (facultative)', 'Note (optional)')}
          aria-label={t('Note', 'Note')}
          disabled={busy}
        />
        <button className="btn btn-sm" onClick={add} disabled={busy || !hours.trim()}>
          <Plus size={14} /> {t('Ajouter une entrée', 'Add an entry')}
        </button>
      </div>
    </div>
  );
}
