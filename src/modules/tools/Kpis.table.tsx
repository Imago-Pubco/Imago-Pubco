import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useUserName } from '@/data/hooks';
import type { Kpi, KpiValue, Team } from './schemas';
import {
  addMonths,
  addWeeks,
  formatValue,
  kpiStatus,
  kpiValueId,
  mondayOf,
  monthStart,
  parseDate,
  periodLabel,
  recentPeriods,
  shortPeriod,
  STATUS_COLOR,
} from './lib';

type Frequency = 'weekly' | 'monthly';
/** Visible periods: 8 weeks or 6 months. */
const PERIOD_COUNT: Record<Frequency, number> = { weekly: 8, monthly: 6 };

const currentPeriod = (f: Frequency) => (f === 'weekly' ? mondayOf() : monthStart());
/** Last visible period: the current one shifted by `offset` periods (0 or negative). */
const windowEnd = (f: Frequency, offset: number) => parseDate(f === 'weekly' ? addWeeks(mondayOf(), offset) : addMonths(monthStart(), offset));

/** Column header: "9 nov." for a week, "nov. 2026" for a month. */
function periodHeader(period: string, f: Frequency, lang: string): string {
  if (f === 'weekly') return shortPeriod(period, lang);
  return parseDate(period).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', year: 'numeric' });
}

/** A value with its status dot, or a dash when there is no value. */
function Reading({ kpi, value, lang }: { kpi: Kpi; value: number | null | undefined; lang: string }) {
  if (value === null || value === undefined) return <span className="faint">–</span>;
  const status = kpiStatus(kpi, value);
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {status !== 'none' && (
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            marginRight: 6,
            verticalAlign: 'middle',
            background: STATUS_COLOR[status],
          }}
        />
      )}
      {formatValue(value, kpi.unit, lang)}
    </span>
  );
}

interface RowProps {
  kpi: Kpi;
  frequency: Frequency;
  periods: string[];
  valuesByKpi: Map<string, KpiValue[]>;
  valueById: Map<string, KpiValue>;
  team: Team | undefined;
  ownerName: (id?: string) => string;
  onEditKpi: (kpi: Kpi) => void;
  onEnterValue: (kpi: Kpi, period: string) => void;
}

function KpiRow({ kpi, frequency, periods, valuesByKpi, valueById, team, ownerName, onEditKpi, onEnterValue }: RowProps) {
  const { t, lang } = useI18n();
  const DirIcon = kpi.direction === 'up' ? ArrowUp : ArrowDown;
  const dirLabel = kpi.direction === 'up' ? t('Plus haut est mieux', 'Higher is better') : t('Plus bas est mieux', 'Lower is better');
  // Lists are sorted newest first: the latest value is the first non-empty one.
  const latest = valuesByKpi.get(kpi.id)?.find((v) => v.value !== null);
  const meta = [kpi.unit || null, kpi.ownerId ? ownerName(kpi.ownerId) : null, team?.name ?? null].filter(Boolean).join(' · ');

  return (
    <tr>
      <td>
        <div className="row row-wrap" style={{ gap: 6 }}>
          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0, fontWeight: 600 }} onClick={() => onEditKpi(kpi)}>
            {kpi.name}
          </button>
          {kpi.critical && <span className="badge badge-accent">{t('Critique', 'Critical')}</span>}
          {kpi.status !== 'active' && (
            <span className="badge">{kpi.status === 'draft' ? t('Brouillon', 'Draft') : t('Archivé', 'Archived')}</span>
          )}
        </div>
        {meta && <div className="small faint">{meta}</div>}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {kpi.target === null ? (
          <span className="faint" title={dirLabel}>
            <DirIcon size={14} aria-hidden /> —
          </span>
        ) : (
          <span title={dirLabel}>
            <DirIcon size={14} aria-hidden /> {formatValue(kpi.target, kpi.unit, lang)}
          </span>
        )}
      </td>
      {periods.map((p) => {
        const value = valueById.get(kpiValueId(kpi.id, p))?.value;
        return (
          <td key={p} style={{ padding: 4 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title={t('Saisir la valeur', 'Enter value')}
              onClick={() => onEnterValue(kpi, p)}
              style={{
                width: '100%',
                minWidth: 84,
                justifyContent: 'center',
                fontVariantNumeric: 'tabular-nums',
                border: value === undefined || value === null ? '1px dashed var(--border)' : '1px solid transparent',
              }}
            >
              <Reading kpi={kpi} value={value} lang={lang} />
            </button>
          </td>
        );
      })}
      <td style={{ whiteSpace: 'nowrap' }}>
        {latest ? (
          <>
            <Reading kpi={kpi} value={latest.value} lang={lang} />
            <div className="faint small">{periodHeader(latest.period, frequency, lang)}</div>
          </>
        ) : (
          <span className="faint">–</span>
        )}
      </td>
    </tr>
  );
}

interface ScorecardProps {
  title: string;
  frequency: Frequency;
  kpis: Kpi[];
  valuesByKpi: Map<string, KpiValue[]>;
  valueById: Map<string, KpiValue>;
  teamsById: Map<string, Team>;
  onEditKpi: (kpi: Kpi) => void;
  onEnterValue: (kpi: Kpi, period: string) => void;
}

/** One scorecard table: a row per indicator, one column per recent period, the latest value at the end. */
export function Scorecard({ title, frequency, kpis, valuesByKpi, valueById, teamsById, onEditKpi, onEnterValue }: ScorecardProps) {
  const { t, lang } = useI18n();
  const ownerName = useUserName();
  const [offset, setOffset] = useState(0);
  const periods = recentPeriods(frequency, PERIOD_COUNT[frequency], windowEnd(frequency, offset));
  const current = currentPeriod(frequency);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <h3>{title}</h3>
        <div className="row row-wrap">
          {offset !== 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOffset(0)}>
              {t('Aujourd’hui', 'Today')}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => setOffset((o) => o - 1)}
            aria-label={t('Périodes précédentes', 'Previous periods')}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            disabled={offset >= 0}
            onClick={() => setOffset((o) => Math.min(0, o + 1))}
            aria-label={t('Périodes suivantes', 'Next periods')}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t('Indicateur', 'Indicator')}</th>
              <th>{t('Cible', 'Target')}</th>
              {periods.map((p) => (
                <th
                  key={p}
                  title={periodLabel(p, frequency, lang)}
                  style={p === current ? { color: 'var(--accent)', fontWeight: 700 } : undefined}
                >
                  {periodHeader(p, frequency, lang)}
                </th>
              ))}
              <th>{t('Actuel', 'Current')}</th>
            </tr>
          </thead>
          <tbody>
            {kpis.map((kpi) => (
              <KpiRow
                key={kpi.id}
                kpi={kpi}
                frequency={frequency}
                periods={periods}
                valuesByKpi={valuesByKpi}
                valueById={valueById}
                team={kpi.teamId ? teamsById.get(kpi.teamId) : undefined}
                ownerName={ownerName}
                onEditKpi={onEditKpi}
                onEnterValue={onEnterValue}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
