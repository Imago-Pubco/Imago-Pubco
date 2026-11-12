/** Team sections of the huddle: critical numbers, team scorecard, priorities, and the dispatcher in the huddle's order. */
import { useState, type ComponentType } from 'react';
import { ChevronRight, Gauge } from 'lucide-react';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { Empty, useToast } from '@/components/ui';
import { useI18n } from '@/i18n';
import { kpiStatus, kpiValueId, formatValue, parseDate, recentPeriods, shortPeriod, STATUS_COLOR } from './lib';
import { kpiValues } from './stores';
import type { Kpi as KpiRow, KpiValue, TeamSection } from './schemas';
import { criticalKpis, latestValue, parseNumber, periodPriorities, priorityTree, teamKpis, statusLabel, type MeetingData } from './HuddleMeeting.data';
import { ItemsSection } from './HuddleMeeting.items';
import { TasksSection } from './HuddleMeeting.tasks';
import { ProgressBar, SectionCard, StatusDot, StatusPill, useRun } from './HuddleMeeting.ui';

/** Renders one team section, in the order the huddle defines them. */
export function TeamSectionView({ section, data }: { section: TeamSection; data: MeetingData }) {
  const View = VIEWS[section];
  return <View data={data} />;
}

const VIEWS: Record<TeamSection, ComponentType<{ data: MeetingData }>> = {
  agenda: (p) => <ItemsSection data={p.data} type="agenda" />,
  parking: (p) => <ItemsSection data={p.data} type="parking" />,
  issues: (p) => <ItemsSection data={p.data} type="issue" />,
  criticalNumbers: CriticalNumbers,
  kpis: KpiScorecard,
  priorities: PrioritiesSection,
  tasks: TasksSection,
};

function CriticalNumbers({ data }: { data: MeetingData }) {
  const { t, lang } = useI18n();
  const list = criticalKpis(data);
  return (
    <SectionCard title={t('Nombres critiques', 'Critical numbers')}>
      {list.length === 0 ? (
        <Empty icon={<Gauge size={32} />} title={t('Aucun nombre critique', 'No critical numbers')} />
      ) : (
        <KpiGrid>
          {list.map((k) => {
            const v = latestValue(data, k);
            const s = kpiStatus(k, v?.value);
            return (
              <Kpi
                key={k.id}
                label={k.name}
                icon={<StatusDot status={s} label={s === 'none' ? t('Pas de valeur', 'No value') : statusLabel(s, lang)} />}
                value={formatValue(v?.value, k.unit, lang)}
                hint={`${t('Cible', 'Target')} : ${formatValue(k.target, k.unit, lang)}`}
              />
            );
          })}
        </KpiGrid>
      )}
    </SectionCard>
  );
}

function KpiScorecard({ data }: { data: MeetingData }) {
  const { t } = useI18n();
  const list = teamKpis(data);
  return (
    <SectionCard title={t('Performance de l’équipe', 'Team performance')} flush>
      {list.length === 0 ? (
        <p className="faint small" style={{ margin: 0, padding: '0 20px 16px' }}>
          {t('Aucun indicateur pour cette équipe.', 'No indicators for this team.')}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Indicateur', 'Indicator')}</th>
                <th className="num">{t('Cible', 'Target')}</th>
                <th className="num">−3</th>
                <th className="num">−2</th>
                <th className="num">−1</th>
                <th className="num">{t('Période en cours', 'Current period')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((k) => (
                <KpiRowView key={k.id} data={data} kpi={k} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

/** One indicator: the last three periods coloured by status, and the current period as an input. */
function KpiRowView({ data, kpi }: { data: MeetingData; kpi: KpiRow }) {
  const { t, lang } = useI18n();
  const periods = recentPeriods(kpi.frequency, 4, parseDate(data.week));
  const valueAt = (period: string): KpiValue | undefined => data.kpiValues.find((v) => v.id === kpiValueId(kpi.id, period));
  const current = periods[periods.length - 1];
  const currentValue = valueAt(current);
  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>{kpi.name}</div>
        <div className="faint small">{kpi.frequency === 'weekly' ? t('Hebdomadaire', 'Weekly') : t('Mensuel', 'Monthly')}</div>
      </td>
      <td className="num">{formatValue(kpi.target, kpi.unit, lang)}</td>
      {periods.slice(0, -1).map((p) => {
        const v = valueAt(p)?.value;
        const color = STATUS_COLOR[kpiStatus(kpi, v)];
        return (
          <td key={p} className="num" title={shortPeriod(p, lang)} style={{ color, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {formatValue(v, kpi.unit, lang)}
          </td>
        );
      })}
      <td className="num">
        <CurrentValueInput key={`${kpi.id}-${currentValue?.value ?? 'empty'}`} kpi={kpi} period={current} value={currentValue} />
      </td>
    </tr>
  );
}

/** Numeric input for the current period. Saves on blur or Enter; a new value is an upsert of the period's document. */
function CurrentValueInput({ kpi, period, value }: { kpi: KpiRow; period: string; value: KpiValue | undefined }) {
  const { t, lang } = useI18n();
  const run = useRun();
  const toast = useToast();
  const initial = value?.value === null || value?.value === undefined ? '' : value.value.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { useGrouping: false, maximumFractionDigits: 6 });
  const [text, setText] = useState(initial);

  const commit = () => {
    const n = parseNumber(text);
    if (n === undefined) {
      toast(t('Valeur invalide', 'Invalid value'), 'err');
      setText(initial);
      return;
    }
    if (n === (value?.value ?? null)) return;
    run(async () => {
      const id = kpiValueId(kpi.id, period);
      const row = await kpiValues.get(id);
      if (row) await kpiValues.update(id, { value: n });
      else await kpiValues.insert({ id, kpiId: kpi.id, period, value: n, note: '' });
    });
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className="input input-sm"
      style={{ width: 120, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
      value={text}
      placeholder="—"
      aria-label={`${kpi.name} — ${shortPeriod(period, lang)}`}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function PrioritiesSection({ data }: { data: MeetingData }) {
  const { t, lang } = useI18n();
  const rows = priorityTree(periodPriorities(data));
  return (
    <SectionCard title={t('Priorités', 'Priorities')} flush>
      {rows.length === 0 ? (
        <p className="faint small" style={{ margin: 0, padding: '0 20px 16px' }}>
          {t('Aucune priorité pour cette période.', 'No priorities for this period.')}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Priorité', 'Priority')}</th>
                <th>{t('Responsable', 'Owner')}</th>
                <th>{t('Statut', 'Status')}</th>
                <th style={{ width: 240 }}>{t('Progrès', 'Progress')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ priority: p, depth }) => (
                <tr key={p.id}>
                  <td>
                    <div className="row row-wrap" style={{ gap: 6, paddingLeft: depth * 24, fontWeight: depth === 0 ? 600 : 400 }}>
                      {depth > 0 && <ChevronRight size={14} aria-hidden className="faint" />}
                      <span style={{ overflowWrap: 'anywhere' }}>{p.title}</span>
                      {p.company && <span className="badge">{t('Entreprise', 'Company')}</span>}
                    </div>
                  </td>
                  <td>{data.nameOf(p.ownerId)}</td>
                  <td>
                    <StatusPill status={p.status} label={statusLabel(p.status, lang)} />
                  </td>
                  <td>
                    <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                      <ProgressBar value={p.progress} color={STATUS_COLOR[p.status]} />
                      <span className="small" style={{ minWidth: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatValue(p.progress, '%', lang)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
