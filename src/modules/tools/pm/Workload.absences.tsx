/** Absences tab of the availability view: list, add and delete time off. */
import { useState, type FormEvent } from 'react';
import { CalendarOff } from 'lucide-react';
import { Empty, useToast } from '@/components/ui';
import { uid } from '@/data/db';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { iso } from '../lib';
import { TIME_OFF_TYPES, type TimeOff } from './schemas';
import { timeOff } from './stores';
import { weekLabel } from './Workload.model';

interface Props {
  off: TimeOff[];
  people: User[];
  me: string;
  canManage: boolean;
  nameOf: (id: string) => string;
}

export function useTypeLabel() {
  const { t } = useI18n();
  const labels: Record<TimeOff['type'], string> = {
    vacation: t('Vacances', 'Vacation'),
    sick: t('Maladie', 'Sick leave'),
    holiday: t('Congé férié', 'Holiday'),
    other: t('Autre', 'Other'),
  };
  return (type: TimeOff['type']) => labels[type];
}

export function Absences({ off, people, me, canManage, nameOf }: Props) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const typeLabel = useTypeLabel();
  const today = iso(new Date());
  const [userId, setUserId] = useState(me);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [type, setType] = useState<TimeOff['type']>('vacation');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Non-managers only ever book their own time off.
  const chosen = canManage ? userId : me;
  const sorted = [...off].sort((a, b) => b.startDate.localeCompare(a.startDate));

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosen || !startDate || !endDate) return;
    if (endDate < startDate) {
      toast(t('La date de fin précède la date de début.', 'The end date is before the start date.'), 'err');
      return;
    }
    setBusy(true);
    try {
      await timeOff.insert({ id: uid('to_'), userId: chosen, startDate, endDate, type, note: note.trim() });
      setNote('');
      toast(t('Absence ajoutée.', 'Time off added.'));
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: TimeOff) => {
    if (!window.confirm(t('Supprimer cette absence ?', 'Delete this time off?'))) return;
    try {
      await timeOff.remove(row.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'err');
    }
  };

  const fmt = (d: string) => weekLabel(d, lang);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <form className="card card-pad" onSubmit={add}>
        <div className="form-grid">
          <label className="field">
            <span>{t('Personne', 'Person')}</span>
            <select className="select" value={chosen} disabled={!canManage} onChange={(e) => setUserId(e.target.value)}>
              {!canManage && <option value={me}>{people.find((p) => p.id === me)?.displayName ?? me}</option>}
              {canManage &&
                people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>{t('Type', 'Type')}</span>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as TimeOff['type'])}>
              {TIME_OFF_TYPES.map((x) => (
                <option key={x} value={x}>
                  {typeLabel(x)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('Du', 'From')}</span>
            <input className="input" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('Au (inclus)', 'To (included)')}</span>
            <input className="input" type="date" required value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className="field span-2">
            <span>{t('Note', 'Note')}</span>
            <input className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="submit" className="btn btn-primary" disabled={busy || !chosen}>
            {t('Ajouter', 'Add')}
          </button>
        </div>
      </form>

      {sorted.length === 0 ? (
        <Empty icon={<CalendarOff size={40} />} title={t('Aucune absence enregistrée', 'No time off recorded')} />
      ) : (
        <div className="table-wrap card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('Personne', 'Person')}</th>
                <th>{t('Période', 'Period')}</th>
                <th>{t('Type', 'Type')}</th>
                <th>{t('Note', 'Note')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.id}>
                  <td>{nameOf(row.userId)}</td>
                  <td className="small">
                    {row.startDate === row.endDate ? fmt(row.startDate) : `${fmt(row.startDate)} → ${fmt(row.endDate)}`}
                    <span className="faint"> · {row.startDate} → {row.endDate}</span>
                  </td>
                  <td>{typeLabel(row.type)}</td>
                  <td className="small muted">{row.note}</td>
                  <td style={{ textAlign: 'right' }}>
                    {(canManage || row.userId === me) && (
                      <button type="button" className="btn btn-ghost btn-danger btn-sm" onClick={() => remove(row)}>
                        {t('Supprimer', 'Delete')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
