import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Gauge, ListChecks, Presentation, Target } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useUserName } from '@/data/hooks';
import { useToast, Empty } from '@/components/ui';
import { KpiGrid } from '@/components/Kpi';
import { formatValue, kpiStatus, parseDate, periodLabel, recentPeriods, STATUS_COLOR } from './lib';
import type { Huddle, Kpi, Priority, Task } from './schemas';
import { dayDiff, latestTwo, localeOf, previousPeriod, valuesFor, type ValueIndex } from './Dashboard.logic';
import { Sparkline } from './Dashboard.Sparkline';
import { tasks } from './stores';

const rowStyle = { padding: '10px 0', borderBottom: '1px solid var(--border)' } as const;
const barStyle = { flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-sunken)', overflow: 'hidden' } as const;
const LIMIT = 8;

/** Titled card used for the lists. */
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>{title}</h3>
      </div>
      <div className="card-pad">{children}</div>
    </div>
  );
}

/** Section heading for the top block of the page. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>{title}</h2>
      {children}
    </section>
  );
}

/* ---------------- Critical numbers ---------------- */

function CriticalCard({ kpi, byPeriod }: { kpi: Kpi; byPeriod: Map<string, number | null> | undefined }) {
  const { t, lang } = useI18n();
  const [latest, previous] = latestTwo(byPeriod);
  const status = kpiStatus(kpi, latest?.value);
  const change = latest && previous ? latest.value - previous.value : null;
  const improved = change !== null && (kpi.direction === 'up' ? change > 0 : change < 0);
  const series = valuesFor(byPeriod, recentPeriods(kpi.frequency, 8));
  const arrow = kpi.direction === 'up' ? '↑' : '↓';
  const statusText = {
    green: t('Atteint', 'On target'),
    yellow: t('Proche de la cible', 'Close to target'),
    red: t('Loin de la cible', 'Off target'),
    none: t('Pas de cible', 'No target'),
  }[status];

  return (
    <Link to="/tools/kpi/indicators" className="kpi card">
      <div className="kpi-top">
        <span className="kpi-label">{kpi.name}</span>
        <span
          role="img"
          aria-label={statusText}
          title={statusText}
          style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[status], flexShrink: 0, marginTop: 4 }}
        />
      </div>
      <div className="kpi-value">{formatValue(latest?.value, kpi.unit, lang)}</div>
      <div className="kpi-hint">{kpi.target === null ? `${t('Cible', 'Target')} : —` : `${t('Cible', 'Target')} : ${formatValue(kpi.target, kpi.unit, lang)} ${arrow}`}</div>
      {change !== null && (
        <div className="small" style={{ marginTop: 4, color: change === 0 ? 'var(--text-3)' : improved ? 'var(--ok)' : 'var(--err)' }}>
          {change > 0 ? '▲' : change < 0 ? '▼' : '='} {formatValue(Math.abs(change), kpi.unit, lang)} {t('vs précédente', 'vs previous')}
        </div>
      )}
      <Sparkline values={series} />
      <div className="small faint" style={{ marginTop: 4 }}>
        {latest ? periodLabel(latest.period, kpi.frequency, lang) : t('Aucune valeur', 'No value yet')}
      </div>
    </Link>
  );
}

export function CriticalNumbers({ kpis, index }: { kpis: Kpi[]; index: ValueIndex }) {
  const { t } = useI18n();
  return (
    <Section title={t('Nombres critiques', 'Critical numbers')}>
      {kpis.length > 0 ? (
        <KpiGrid>
          {kpis.map((k) => (
            <CriticalCard key={k.id} kpi={k} byPeriod={index.get(k.id)} />
          ))}
        </KpiGrid>
      ) : (
        <div className="card">
          <Empty icon={<Gauge size={36} />} title={t('Aucun nombre critique', 'No critical numbers')}>
            {t('Choisissez les nombres critiques dans ', 'Pick the critical numbers in ')}
            <Link to="/tools/kpi/indicators">{t('Indicateurs', 'Indicators')}</Link>
            {t(' (drapeau « critique »).', ' (flag “critical”).')}
          </Empty>
        </div>
      )}
    </Section>
  );
}

/* ---------------- Missing entries ---------------- */

export function MissingEntries({ kpis, index }: { kpis: Kpi[]; index: ValueIndex }) {
  const { t, lang } = useI18n();
  const userName = useUserName();
  const missing = kpis.flatMap((k) => {
    const period = previousPeriod(k.frequency);
    return (index.get(k.id)?.get(period) ?? null) === null ? [{ kpi: k, period }] : [];
  });

  return (
    <Panel title={t('Saisies en retard', 'Missing entries')}>
      {missing.length === 0 ? (
        <div className="row" style={{ color: 'var(--ok)' }}>
          <CheckCircle2 size={18} />
          {t('Tout est à jour', 'All up to date')}
        </div>
      ) : (
        <>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {missing.slice(0, LIMIT).map(({ kpi, period }) => (
              <li key={kpi.id} className="row row-wrap" style={{ ...rowStyle, justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <strong>{kpi.name}</strong>
                  <div className="small faint">
                    {userName(kpi.ownerId ?? undefined)} · {periodLabel(period, kpi.frequency, lang)}
                  </div>
                </div>
                <Link className="btn btn-sm" to="/tools/kpi/indicators">
                  {t('Saisir', 'Enter')}
                </Link>
              </li>
            ))}
          </ul>
          {missing.length > LIMIT && <div className="small faint" style={{ marginTop: 8 }}>{t(`+${missing.length - LIMIT} autres`, `+${missing.length - LIMIT} more`)}</div>}
        </>
      )}
    </Panel>
  );
}

/* ---------------- My priorities ---------------- */

export function MyPriorities({ items }: { items: Priority[] }) {
  const { t, lang } = useI18n();
  const statusText = { green: t('Vert', 'Green'), yellow: t('Jaune', 'Yellow'), red: t('Rouge', 'Red') };
  return (
    <Panel title={t('Mes priorités', 'My priorities')}>
      {items.length === 0 ? (
        <Empty icon={<Target size={32} />} title={t('Aucune priorité pour cette période', 'No priority for this period')} />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((p) => (
            <li key={p.id} style={rowStyle}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                <Link to="/tools/kpi/priorities" style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
                  {p.title}
                </Link>
                <span className="badge" style={{ color: STATUS_COLOR[p.status], whiteSpace: 'nowrap' }}>
                  {statusText[p.status]}
                </span>
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <div style={barStyle}>
                  <div style={{ width: `${p.progress}%`, height: '100%', background: 'var(--accent)' }} />
                </div>
                <span className="small mono" style={{ whiteSpace: 'nowrap' }}>
                  {formatValue(p.progress, '%', lang)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------- My tasks ---------------- */

export function MyTasks({ items, today }: { items: Task[]; today: string }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const locale = localeOf(lang);

  /** Marks a task done (with its timestamp) or open again. */
  const setDone = async (task: Task, done: boolean) => {
    try {
      await tasks.update(task.id, done ? { done: true, doneAt: new Date().toISOString() } : { done: false, doneAt: null });
    } catch {
      toast(t('Enregistrement impossible', 'Could not save'), 'err');
    }
  };

  return (
    <Panel title={t('Mes actions', 'My tasks')}>
      {items.length === 0 ? (
        <Empty icon={<ListChecks size={32} />} title={t('Aucune action en cours', 'No open task')} />
      ) : (
        <>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.slice(0, LIMIT).map((task) => {
              const overdue = task.dueDate !== null && task.dueDate < today;
              return (
                <li key={task.id} className="row" style={{ ...rowStyle, alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={(e) => void setDone(task, e.target.checked)}
                    aria-label={t('Marquer comme fait', 'Mark as done')}
                    style={{ marginTop: 4 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div>{task.title}</div>
                    <div className="small" style={{ color: overdue ? 'var(--err)' : 'var(--text-3)' }}>
                      {task.dueDate ? parseDate(task.dueDate).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : t('Sans échéance', 'No due date')}
                      {overdue && <strong> · {t('En retard', 'Overdue')}</strong>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {items.length > LIMIT && <div className="small faint" style={{ marginTop: 8 }}>{t(`+${items.length - LIMIT} autres`, `+${items.length - LIMIT} more`)}</div>}
        </>
      )}
    </Panel>
  );
}

/* ---------------- Next huddles ---------------- */

export function NextHuddles({ items, now }: { items: { huddle: Huddle; at: Date }[]; now: Date }) {
  const { t, lang } = useI18n();
  const locale = localeOf(lang);
  const cadenceText = { daily: t('Quotidien', 'Daily'), weekly: t('Hebdo', 'Weekly'), monthly: t('Mensuel', 'Monthly') };

  return (
    <Panel title={t('Prochain huddle', 'Next huddles')}>
      {items.length === 0 ? (
        <Empty icon={<Presentation size={32} />} title={t('Aucun huddle prévu', 'No huddle scheduled')} />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map(({ huddle: h, at }) => {
            const diff = dayDiff(at, now);
            const when =
              h.cadence === 'monthly'
                ? at.toLocaleDateString(locale, { weekday: 'long' })
                : diff === 0
                  ? t('Aujourd’hui', 'Today')
                  : diff === 1
                    ? t('Demain', 'Tomorrow')
                    : at.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
            const time = [h.startTime, h.endTime].filter(Boolean).join(' – ');
            return (
              <li key={h.id} className="row row-wrap" style={{ ...rowStyle, justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <strong>{h.name}</strong>
                  <div className="small faint">
                    {cadenceText[h.cadence]} · {when}
                    {time && ` · ${time}`}
                  </div>
                </div>
                <Link className="btn btn-sm" to={`/tools/kpi/huddles/${h.id}`}>
                  {t('Ouvrir', 'Open')}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
