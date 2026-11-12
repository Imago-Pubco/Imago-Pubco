import { useMemo, useState } from 'react';
import { Clock, Download } from 'lucide-react';
import { Empty } from '@/components/ui';
import { useI18n } from '@/i18n';
import { downloadText, fmtHours, sum, toCsv } from './lib';
import type { PmTask, Project, TimeEntry } from './schemas';
import { Badge } from './ProjectDetail.ui';
import { ENTRY_STATUS_BADGE, ENTRY_STATUS_LABEL, bi } from './ProjectDetail.labels';

/** Time booked on the project, filtered by person and date range, with totals and CSV export. */
export function TimeTab({ project, entries, tasks, nameOf }: { project: Project; entries: TimeEntry[]; tasks: PmTask[]; nameOf: (id?: string) => string }) {
  const { t, lang } = useI18n();
  const [person, setPerson] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const taskName = useMemo(() => new Map(tasks.map((x): [string, string] => [x.id, x.name])), [tasks]);
  const people = useMemo(
    () => Array.from(new Set(entries.map((e) => e.userId))).sort((a, b) => nameOf(a).localeCompare(nameOf(b), lang)),
    [entries, nameOf, lang],
  );

  const rows = useMemo(
    () =>
      entries
        .filter((e) => (!person || e.userId === person) && (!from || e.date >= from) && (!to || e.date <= to))
        .sort((a, b) => b.date.localeCompare(a.date) || nameOf(a.userId).localeCompare(nameOf(b.userId), lang)),
    [entries, person, from, to, nameOf, lang],
  );
  const total = sum(rows.map((e) => e.hours));
  const billable = sum(rows.filter((e) => e.billable).map((e) => e.hours));

  const exportCsv = () => {
    const head = [t('Date', 'Date'), t('Personne', 'Person'), t('Tâche', 'Task'), t('Heures', 'Hours'), t('Facturable', 'Billable'), t('Statut', 'Status'), t('Note', 'Note')];
    const body = rows.map((e) => [
      e.date,
      nameOf(e.userId),
      e.taskId ? (taskName.get(e.taskId) ?? '') : '',
      e.hours.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 2 }),
      e.billable ? t('Oui', 'Yes') : t('Non', 'No'),
      bi(ENTRY_STATUS_LABEL[e.status], lang),
      e.note,
    ]);
    downloadText(`${project.code}-temps.csv`, toCsv([head, ...body]));
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card card-pad row row-wrap" style={{ alignItems: 'flex-end', gap: 12 }}>
        <label className="field" style={{ minWidth: 180 }}>
          <span>{t('Personne', 'Person')}</span>
          <select className="select" value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">{t('Toutes', 'All')}</option>
            {people.map((id) => (
              <option key={id} value={id}>
                {nameOf(id)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Du', 'From')}</span>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('Au', 'To')}</span>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="spacer" />
        <button className="btn" onClick={exportCsv} disabled={rows.length === 0}>
          <Download size={16} /> {t('Exporter CSV', 'Export CSV')}
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="card">
          <Empty icon={<Clock size={40} />} title={t('Aucun temps saisi sur ce projet', 'No time booked on this project')} />
        </div>
      ) : rows.length === 0 ? (
        <p className="muted">{t('Aucune entrée pour ces filtres.', 'No entry for these filters.')}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Date', 'Date')}</th>
                <th>{t('Personne', 'Person')}</th>
                <th>{t('Tâche', 'Task')}</th>
                <th className="num">{t('Heures', 'Hours')}</th>
                <th>{t('Facturable', 'Billable')}</th>
                <th>{t('Statut', 'Status')}</th>
                <th>{t('Note', 'Note')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{e.date}</td>
                  <td>{nameOf(e.userId)}</td>
                  <td className="small">{e.taskId ? (taskName.get(e.taskId) ?? '—') : '—'}</td>
                  <td className="num">{fmtHours(e.hours)}</td>
                  <td>
                    <Badge className={e.billable ? 'badge-ok' : ''}>{e.billable ? t('Oui', 'Yes') : t('Non', 'No')}</Badge>
                  </td>
                  <td>
                    <Badge className={ENTRY_STATUS_BADGE[e.status]}>{bi(ENTRY_STATUS_LABEL[e.status], lang)}</Badge>
                  </td>
                  <td className="small" style={{ whiteSpace: 'pre-wrap', maxWidth: 320 }}>
                    {e.note}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 600 }}>
                <td colSpan={3}>{t('Total', 'Total')}</td>
                <td className="num">{fmtHours(total)}</td>
                <td colSpan={3} className="small muted" style={{ fontWeight: 400 }}>
                  {t('dont facturables', 'of which billable')} : {fmtHours(billable)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
