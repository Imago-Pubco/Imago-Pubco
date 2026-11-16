import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { PageHeader } from '@/components/ui';
import { HEALTH_COLOR, isBlocked, isOverdue, planOrDefault, quarterLabel, quarterOf, quarterRange, shiftQuarter, todayIso } from '../lib';
import type { AlignPriority } from '../schemas';
import { HoverList, PriorityListModal, prioItems } from '../components/Insight';
import { alignPriorities, rocks, strategy } from '../stores';
import { Hierarchy } from '../dashboard/Hierarchy';
import { MyPriorities } from '../dashboard/MyPriorities';
import { PlanSummary } from '../dashboard/PlanSummary';
import { PrioritiesProgress } from '../dashboard/PrioritiesProgress';
import { RocksProgress } from '../dashboard/RocksProgress';
import { buildQuarter, myOpenPriorities } from '../dashboard/model';

/** Align dashboard: the quarter at a glance — Rocks, priorities, my priorities, and the plan hierarchy. */
export function Dashboard() {
  const { t, fmtDate } = useI18n();
  const { user } = useAuth();
  const { rows: allRocks } = useCollection(rocks);
  const { rows: allPriorities } = useCollection(alignPriorities);
  const { rows: strategyRows } = useCollection(strategy);
  const { rows: allUsers } = useCollection(users);

  const currentQuarter = quarterOf();
  const [quarter, setQuarter] = useState(currentQuarter);
  // Computed on each render (local date), so the overdue state follows midnight.
  const today = todayIso();

  const nameById = useMemo(() => new Map(allUsers.map((u): [string, string] => [u.id, u.displayName])), [allUsers]);
  const nameOf = (id?: string | null) => (id ? (nameById.get(id) ?? id) : '—');
  const rockById = useMemo(() => new Map(allRocks.map((r) => [r.id, r] as const)), [allRocks]);
  const prioById = useMemo(() => new Map(allPriorities.map((p) => [p.id, p] as const)), [allPriorities]);

  const model = useMemo(() => buildQuarter(quarter, allRocks, allPriorities, today), [quarter, allRocks, allPriorities, today]);
  const plan = useMemo(() => planOrDefault(strategyRows.find((r) => r.id === 'plan')), [strategyRows]);
  const mine = useMemo(() => myOpenPriorities(allPriorities, user?.id), [allPriorities, user?.id]);

  // Details window: the priorities behind a figure.
  const [drill, setDrill] = useState<{ title: string; subtitle?: string; items: AlignPriority[] } | null>(null);
  const open = (title: string, items: AlignPriority[], subtitle?: string) => setDrill({ title, items, subtitle });
  const blockedList = useMemo(() => model.priorities.filter((p) => isBlocked(p, prioById)), [model.priorities, prioById]);
  const overdueList = useMemo(() => model.priorities.filter((p) => isOverdue(p, today)), [model.priorities, today]);
  const rockPrios = useMemo(() => model.rockRows.flatMap((r) => r.priorities), [model.rockRows]);
  const dot = (p: AlignPriority) => HEALTH_COLOR[p.health];
  const ql = quarterLabel(quarter);

  const range = quarterRange(quarter);
  const k = model.kpi;

  return (
    <Page wide>
      <PageHeader
        eyebrow="Align"
        title={t('Tableau de bord', 'Dashboard')}
        subtitle={`${fmtDate(range.start)} – ${fmtDate(range.end)}`}
        actions={
          <>
            <button className="btn btn-ghost btn-icon btn-sm" aria-label={t('Trimestre précédent', 'Previous quarter')} title={t('Trimestre précédent', 'Previous quarter')} onClick={() => setQuarter((q) => shiftQuarter(q, -1))}>
              <ChevronLeft size={16} />
            </button>
            <strong className="align-dash-quarter">{quarterLabel(quarter)}</strong>
            <button className="btn btn-ghost btn-icon btn-sm" aria-label={t('Trimestre suivant', 'Next quarter')} title={t('Trimestre suivant', 'Next quarter')} onClick={() => setQuarter((q) => shiftQuarter(q, 1))}>
              <ChevronRight size={16} />
            </button>
            {quarter !== currentQuarter && (
              <button className="btn btn-sm" onClick={() => setQuarter(currentQuarter)}>
                {t('Trimestre actuel', 'Current quarter')}
              </button>
            )}
          </>
        }
      />

      <KpiGrid>
        <HoverList
          className="align-kpi-hover"
          title={t('Rocks du trimestre', 'Rocks of the quarter')}
          items={model.rockRows.map((r) => ({ key: r.rock.id, label: r.rock.title, meta: `${r.pct} % · ${r.done}/${r.total}` }))}
          onOpen={() => open(t(`Priorités des Rocks · ${ql}`, `Rocks' priorities · ${ql}`), rockPrios, t('Moyenne de progression des Rocks : priorités terminées ÷ priorités de chaque Rock.', 'Average Rock progress: completed priorities ÷ each Rock’s priorities.'))}
        >
          <Kpi
            label={t('Progression des Rocks', 'Rocks progress')}
            value={`${k.rockAvg}%`}
            hint={t(`${k.rocksDone} / ${k.rocksTotal} Rocks terminés`, `${k.rocksDone} / ${k.rocksTotal} Rocks completed`)}
            tone="accent"
          />
        </HoverList>
        <HoverList
          className="align-kpi-hover"
          title={t('Priorités terminées', 'Completed priorities')}
          items={prioItems(model.priorities.filter((p) => p.status === 'completed'), nameOf, dot)}
          onOpen={() => open(t(`Priorités du trimestre · ${ql}`, `Priorities of the quarter · ${ql}`), model.priorities)}
        >
          <Kpi
            label={t('Progression des priorités', 'Priorities progress')}
            value={`${k.prioPct}%`}
            hint={t(`${k.prioDone} / ${k.prioTotal} priorités terminées`, `${k.prioDone} / ${k.prioTotal} priorities completed`)}
            tone="ok"
          />
        </HoverList>
        <HoverList
          className="align-kpi-hover"
          title={t('Priorités bloquées', 'Blocked priorities')}
          items={blockedList.map((p) => ({ key: p.id, label: p.title, meta: `${t('attend', 'waits for')} : ${(p.blockedById && prioById.get(p.blockedById)?.title) || '—'}`, dot: 'var(--warn)' }))}
          onOpen={() => open(t('Priorités bloquées', 'Blocked priorities'), blockedList, t('En attente d’une autre priorité qui n’est pas terminée.', 'Waiting on another priority that is not completed.'))}
        >
          <Kpi
            label={t('Priorités bloquées', 'Blocked priorities')}
            value={k.blocked}
            hint={t('En attente d’une autre priorité', 'Waiting on another priority')}
            tone={k.blocked > 0 ? 'warn' : undefined}
          />
        </HoverList>
        <HoverList
          className="align-kpi-hover"
          title={t('Priorités en retard', 'Overdue priorities')}
          items={prioItems(overdueList, nameOf, () => 'var(--err)')}
          onOpen={() => open(t('Priorités en retard', 'Overdue priorities'), overdueList, t('Échéance dépassée et non terminées.', 'Past due and not completed.'))}
        >
          <Kpi
            label={t('Priorités en retard', 'Overdue priorities')}
            value={k.overdue}
            hint={t('Échéance dépassée, non terminées', 'Past due, not completed')}
            tone={k.overdue > 0 ? 'err' : undefined}
          />
        </HoverList>
        <HoverList
          className="align-kpi-hover"
          title={t('Mes priorités', 'My priorities')}
          items={mine.map((p) => ({ key: p.id, label: p.title, meta: p.rockId ? rockById.get(p.rockId)?.title : undefined, dot: dot(p) }))}
          onOpen={() => open(t('Mes priorités', 'My priorities'), mine, t('Non terminées, toutes périodes.', 'Not completed, all periods.'))}
        >
          <Kpi label={t('Mes priorités', 'My priorities')} value={mine.length} hint={t('Non terminées, toutes périodes', 'Not completed, all periods')} tone="accent" />
        </HoverList>
      </KpiGrid>

      <div className="grid-2 align-dash-row">
        <RocksProgress rows={model.rockRows} nameOf={nameOf} onOpen={open} />
        <PrioritiesProgress priorities={model.priorities} status={model.status} health={model.health} nameOf={nameOf} onOpen={open} />
      </div>

      <div className="grid-2 align-dash-row">
        <MyPriorities items={mine} rockById={rockById} prioById={prioById} today={today} />
        <PlanSummary plan={plan} />
      </div>

      <div className="align-dash-row">
        <Hierarchy plan={plan} model={model} nameOf={nameOf} prioById={prioById} />
      </div>

      {drill && (
        <PriorityListModal title={drill.title} subtitle={drill.subtitle} items={drill.items} rockById={rockById} prioById={prioById} nameOf={nameOf} onClose={() => setDrill(null)} />
      )}
    </Page>
  );
}
