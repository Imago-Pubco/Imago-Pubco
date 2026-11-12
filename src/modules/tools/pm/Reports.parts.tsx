import { Inbox } from 'lucide-react';
import { Empty } from '@/components/ui';
import { useI18n } from '@/i18n';
import { fmtHours, fmtMoney, pct } from './lib';
import { presetRange, REPORT_KEYS, REPORT_LABEL, type Applies, type Cell, type Filters, type Preset, type ReportKey, type Table } from './Reports.logic';
import type { Client, Project } from './schemas';

export interface UserOption {
  id: string;
  name: string;
}

export function fmtCell(c: Cell, lang: string): string {
  if (c.v === null || c.v === '') return '—';
  if (typeof c.v === 'string') return c.v;
  switch (c.kind) {
    case 'hours':
      return fmtHours(c.v);
    case 'money':
      return fmtMoney(c.v, lang);
    case 'pct':
      return pct(c.v);
    default:
      return c.v.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 2 });
  }
}

const numeric = (k: Cell['kind']) => k === 'hours' || k === 'money' || k === 'pct' || k === 'num';

/** Report picker: one tab per report. */
export function ReportTabs({ value, onChange }: { value: ReportKey; onChange: (k: ReportKey) => void }) {
  const { lang } = useI18n();
  return (
    <div className="tabs" style={{ marginBottom: 16, overflowX: 'auto' }}>
      {REPORT_KEYS.map((k) => (
        <button key={k} className={`tab ${value === k ? 'active' : ''}`} onClick={() => onChange(k)} style={{ whiteSpace: 'nowrap' }}>
          {lang === 'fr' ? REPORT_LABEL[k].fr : REPORT_LABEL[k].en}
        </button>
      ))}
    </div>
  );
}

/** Period, client, project, person and status filters. Filters that do not apply to the report are disabled. */
export function FilterBar({
  value,
  onChange,
  applies,
  clients,
  projects,
  people,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  applies: Applies;
  clients: Client[];
  projects: Project[];
  people: UserOption[];
}) {
  const { t } = useI18n();
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  const presets: [Preset, string][] = [
    ['week', t('Cette semaine', 'This week')],
    ['month', t('Ce mois', 'This month')],
    ['quarter', t('Ce trimestre', 'This quarter')],
    ['year', t('Cette année', 'This year')],
  ];
  const hint = [
    applies.asOf ? t('Date « Au » : état cumulé à cette date', '“To” date: cumulative status as of that date') : null,
    applies.person ? t('Personne', 'Person') : null,
    applies.status ? t('Statut', 'Status') : null,
  ].filter((x): x is string => x !== null);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-pad" style={{ display: 'grid', gap: 14 }}>
        <div className="row row-wrap" style={{ gap: 6 }}>
          {presets.map(([k, label]) => (
            <button key={k} className="btn btn-sm btn-ghost" onClick={() => set({ range: presetRange(k) })}>
              {label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label className="field">
            <span>{t('Du', 'From')}</span>
            <input
              type="date"
              className="input"
              value={value.range.from}
              disabled={applies.asOf}
              onChange={(e) => set({ range: { ...value.range, from: e.target.value } })}
            />
          </label>
          <label className="field">
            <span>{applies.asOf ? t('Cumul au', 'Cumulative as of') : t('Au', 'To')}</span>
            <input type="date" className="input" value={value.range.to} onChange={(e) => set({ range: { ...value.range, to: e.target.value } })} />
          </label>
          <label className="field">
            <span>{t('Client', 'Client')}</span>
            <select className="select" value={value.clientId} onChange={(e) => set({ clientId: e.target.value, projectId: '' })}>
              <option value="">{t('Tous les clients', 'All clients')}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('Projet', 'Project')}</span>
            <select className="select" value={value.projectId} onChange={(e) => set({ projectId: e.target.value })}>
              <option value="">{t('Tous les projets', 'All projects')}</option>
              {projects
                .filter((p) => !value.clientId || p.clientId === value.clientId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {`${p.code} · ${p.name}`}
                  </option>
                ))}
            </select>
          </label>
          <label className="field" style={applies.person ? undefined : { opacity: 0.5 }}>
            <span>{t('Personne', 'Person')}</span>
            <select className="select" value={value.userId} disabled={!applies.person} onChange={(e) => set({ userId: e.target.value })}>
              <option value="">{t('Toutes les personnes', 'Everyone')}</option>
              {people.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={applies.status ? undefined : { opacity: 0.5 }}>
            <span>{t('Statut du temps', 'Time status')}</span>
            <select className="select" value={value.approvedOnly ? 'approved' : 'all'} disabled={!applies.status} onChange={(e) => set({ approvedOnly: e.target.value === 'approved' })}>
              <option value="all">{t('Tout le temps compté (sans rejets)', 'All counted time (no rejections)')}</option>
              <option value="approved">{t('Approuvé seulement', 'Approved only')}</option>
            </select>
          </label>
        </div>
        <p className="small faint" style={{ margin: 0 }}>
          {hint.length
            ? t(`Filtres applicables : ${hint.join(', ')}, période, client, projet.`, `Filters that apply: ${hint.join(', ')}, period, client, project.`)
            : t('Filtres applicables : période, client, projet.', 'Filters that apply: period, client, project.')}
        </p>
      </div>
    </div>
  );
}

/** One report table with its notes and totals row. */
export function ReportTable({ table }: { table: Table }) {
  const { t, lang } = useI18n();
  return (
    <div>
      {table.notes.map((n, i) => (
        <p key={i} className="small faint" style={{ margin: '0 0 10px' }}>
          {n}
        </p>
      ))}
      {table.rows.length === 0 ? (
        <Empty icon={<Inbox size={32} />} title={t('Aucune donnée pour ces filtres', 'No data for these filters')}>
          {t('Élargissez la période ou retirez un filtre.', 'Widen the period or remove a filter.')}
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {table.headers.map((h, i) => (
                  <th key={i} className={numeric(h.kind) ? 'num' : undefined}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className={numeric(c.kind) ? 'num' : undefined} style={c.tone ? { color: c.tone, fontWeight: 600 } : undefined}>
                      {fmtCell(c, lang)}
                    </td>
                  ))}
                </tr>
              ))}
              {table.totals && (
                <tr style={{ fontWeight: 700, background: 'var(--bg-sunken)' }}>
                  {table.totals.map((c, ci) => (
                    <td key={ci} className={numeric(c.kind) ? 'num' : undefined}>
                      {fmtCell(c, lang)}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
