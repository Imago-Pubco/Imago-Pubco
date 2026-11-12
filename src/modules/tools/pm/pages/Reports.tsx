import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/ui';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { downloadText, iso } from '../lib';
import { APPLIES, buildReport, presetRange, reportCsv, type Filters, type ReportData, type ReportKey } from '../Reports.logic';
import { FilterBar, ReportTable, ReportTabs, type UserOption } from '../Reports.parts';
import { clients, expenses, pmTasks, projects, rates, staff, timeEntries, timeOff } from '../stores';

/** Reports of Gestion de projet: time, budgets, profitability and expenses, with filters and CSV export. */
export function Reports() {
  const { t } = useI18n();
  const nameOf = useUserName();
  const { rows: projectRows } = useCollection(projects);
  const { rows: clientRows } = useCollection(clients);
  const { rows: taskRows } = useCollection(pmTasks);
  const { rows: entryRows } = useCollection(timeEntries);
  const { rows: expenseRows } = useCollection(expenses);
  const { rows: staffRows } = useCollection(staff);
  const { rows: rateRows } = useCollection(rates);
  const { rows: offRows } = useCollection(timeOff);
  const { rows: userRows } = useCollection(users);

  const [key, setKey] = useState<ReportKey>('projectTime');
  const [filters, setFilters] = useState<Filters>(() => ({
    range: presetRange('month'),
    clientId: '',
    projectId: '',
    userId: '',
    approvedOnly: false,
  }));

  const people: UserOption[] = useMemo(
    () =>
      userRows
        .filter((u) => u.active)
        .map((u) => ({ id: u.id, name: u.displayName || u.username }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [userRows],
  );

  const data: ReportData = useMemo(
    () => ({
      projects: projectRows,
      clients: clientRows,
      tasks: taskRows,
      entries: entryRows,
      expenses: expenseRows,
      staff: staffRows,
      rates: rateRows,
      timeOff: offRows,
      people: people.map((p) => p.id),
    }),
    [projectRows, clientRows, taskRows, entryRows, expenseRows, staffRows, rateRows, offRows, people],
  );

  const tables = useMemo(
    () => buildReport(key, data, filters, { tr: (fr, en) => t(fr, en), nameOf }),
    [key, data, filters, nameOf, t],
  );

  const invalid = filters.range.from > filters.range.to;
  const hasRows = tables.some((tb) => tb.rows.length > 0);

  function exportCsv() {
    const name = `rapport-${key}-${filters.range.from}-${filters.range.to}-${iso(new Date())}.csv`;
    downloadText(name, reportCsv(tables));
  }

  return (
    <Page>
      <PageHeader
        eyebrow={t('Outils · Gestion de projet', 'Tools · Project management')}
        title={t('Rapports', 'Reports')}
        subtitle={t('Temps, budgets et rentabilité. Les coûts sont confidentiels.', 'Time, budgets and profitability. Costs are confidential.')}
      />

      <ReportTabs value={key} onChange={setKey} />
      <FilterBar value={filters} onChange={setFilters} applies={APPLIES[key]} clients={clientRows} projects={projectRows} people={people} />

      {invalid ? (
        <p className="small" style={{ color: 'var(--err)' }}>
          {t('La date de fin précède la date de début.', 'The end date is before the start date.')}
        </p>
      ) : (
        <div className="stack">
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-sm" onClick={exportCsv} disabled={!hasRows}>
              <Download size={14} /> {t('Exporter CSV', 'Export CSV')}
            </button>
          </div>
          {tables.map((tb) => (
            <section key={tb.title} className="card">
              <div className="card-head">
                <h3>{tb.title}</h3>
              </div>
              <div className="card-pad">
                <ReportTable table={tb} />
              </div>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}
