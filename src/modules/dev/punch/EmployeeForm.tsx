import { useState } from 'react';
import { Modal } from '@/components/ui';
import type { DayShift, PunchEmployee, WeekSchedule } from './types.ts';
import type { EmployeeInput } from './api.ts';

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DEFAULT_SHIFT: DayShift = { start: '08:00', end: '16:30', pauses: [{ at: '10:00', minutes: 15 }, { at: '12:00', minutes: 30 }] };
const DEFAULT_SCHEDULE: WeekSchedule = [null, DEFAULT_SHIFT, DEFAULT_SHIFT, DEFAULT_SHIFT, DEFAULT_SHIFT, DEFAULT_SHIFT, null];

/** '10:00 15, 12:00 30' ⇄ pauses. */
const pausesToText = (s: DayShift) => s.pauses.map((p) => `${p.at} ${p.minutes}`).join(', ');
function textToPauses(t: string): DayShift['pauses'] | null {
  const parts = t.split(',').map((x) => x.trim()).filter(Boolean);
  const out: DayShift['pauses'] = [];
  for (const p of parts) {
    const m = /^(\d{1,2}):(\d{2})\s+(\d{1,3})$/.exec(p);
    if (!m) return null;
    out.push({ at: `${m[1].padStart(2, '0')}:${m[2]}`, minutes: Number(m[3]) });
  }
  return out;
}

interface Row {
  on: boolean;
  start: string;
  end: string;
  pauses: string;
}

export function EmployeeForm({
  employee,
  onSave,
  onClose,
}: {
  employee: PunchEmployee | null;
  onSave: (e: EmployeeInput) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(employee?.name ?? '');
  const [code, setCode] = useState(employee?.phoneLast4 ?? '');
  const [email, setEmail] = useState(employee?.email ?? '');
  const [role, setRole] = useState(employee?.role ?? '');
  const [active, setActive] = useState(employee?.active ?? true);
  const [rows, setRows] = useState<Row[]>(() =>
    (employee?.schedule ?? DEFAULT_SCHEDULE).map((s) => ({
      on: !!s,
      start: s?.start ?? DEFAULT_SHIFT.start,
      end: s?.end ?? DEFAULT_SHIFT.end,
      pauses: pausesToText(s ?? DEFAULT_SHIFT),
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    const schedule: WeekSchedule = [];
    for (let i = 0; i < 7; i++) {
      const r = rows[i];
      if (!r.on) {
        schedule.push(null);
        continue;
      }
      const pauses = textToPauses(r.pauses);
      if (!pauses) return setError(`${DAYS[i]} : pauses à écrire comme « 10:00 15, 12:00 30 » (heure et minutes)`);
      if (r.start >= r.end) return setError(`${DAYS[i]} : la sortie doit être après l'entrée`);
      schedule.push({ start: r.start, end: r.end, pauses });
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), phoneLast4: code.trim(), email: email.trim(), role: role.trim(), schedule, active });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      large
      onClose={onClose}
      title={employee ? `Modifier ${employee.name}` : 'Ajouter un employé'}
      footer={
        <>
          {error && <span className="pc-form-error">{error}</span>}
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="pc-form">
        <label>
          Nom complet
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label>
          4 derniers chiffres du téléphone (code de pointage)
          <input className="input" inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label>
          Courriel (reçoit les messages des 10, 20 et 30 h)
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Poste
          <input className="input" value={role} onChange={(e) => setRole(e.target.value)} />
        </label>
        <label className="pc-check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Actif (peut pointer)
        </label>
      </div>
      <h4 style={{ margin: '16px 0 8px' }}>Horaire de la semaine</h4>
      <table className="pc-table pc-sched">
        <thead>
          <tr>
            <th>Jour</th>
            <th>Entrée</th>
            <th>Sortie</th>
            <th>Pauses (heure minutes, …)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                <label className="pc-check">
                  <input type="checkbox" checked={r.on} onChange={(e) => setRow(i, { on: e.target.checked })} /> {DAYS[i]}
                </label>
              </td>
              <td>
                <input className="input input-sm" type="time" disabled={!r.on} value={r.start} onChange={(e) => setRow(i, { start: e.target.value })} />
              </td>
              <td>
                <input className="input input-sm" type="time" disabled={!r.on} value={r.end} onChange={(e) => setRow(i, { end: e.target.value })} />
              </td>
              <td>
                <input className="input input-sm" disabled={!r.on} value={r.pauses} placeholder="10:00 15, 12:00 30" onChange={(e) => setRow(i, { pauses: e.target.value })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
