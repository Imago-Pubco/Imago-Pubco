import { useMemo } from 'react';
import { useCollection } from '@/data/db';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/ui';
import { currentWeek, periodLabel } from '../lib';
import { huddles, kpis, kpiValues, priorities, tasks } from '../stores';
import { indexValues, nextOccurrence, todayIso } from '../Dashboard.logic';
import { CriticalNumbers, MissingEntries, MyPriorities, MyTasks, NextHuddles } from '../Dashboard.parts';

/** KPI dashboard: critical numbers, missing entries, my priorities and tasks, next huddles. */
export function Dashboard() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { rows: kpiRows } = useCollection(kpis);
  const { rows: valueRows } = useCollection(kpiValues);
  const { rows: priorityRows } = useCollection(priorities);
  const { rows: taskRows } = useCollection(tasks);
  const { rows: huddleRows } = useCollection(huddles);

  const uid = user?.id ?? '';
  const now = new Date();
  const today = todayIso();
  const index = useMemo(() => indexValues(valueRows), [valueRows]);
  const active = useMemo(() => kpiRows.filter((k) => k.status === 'active').sort((a, b) => a.order - b.order), [kpiRows]);
  const critical = useMemo(() => active.filter((k) => k.critical).slice(0, 5), [active]);

  const myPriorities = priorityRows
    .filter((p) => p.ownerId === uid && !p.archived && p.periodStart <= today && today <= p.periodEnd)
    .sort((a, b) => a.order - b.order);

  const myTasks = taskRows
    .filter((x) => x.ownerId === uid && !x.done)
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));

  const upcoming = huddleRows
    .filter((h) => h.active && (h.ownerId === uid || h.memberIds.includes(uid)))
    .map((h) => ({ huddle: h, at: nextOccurrence(h, now) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <Page>
      <PageHeader
        eyebrow={t('Outils · KPI', 'Tools · KPI')}
        title={t('Tableau de bord', 'Dashboard')}
        subtitle={t(
          `Semaine en cours : ${periodLabel(currentWeek(), 'weekly', lang)}`,
          `Current week: ${periodLabel(currentWeek(), 'weekly', lang)}`,
        )}
      />

      <div className="stack">
        <CriticalNumbers kpis={critical} index={index} />
        <MissingEntries kpis={active} index={index} />
        <div className="grid-2">
          <MyPriorities items={myPriorities} />
          <MyTasks items={myTasks} today={today} />
        </div>
        <NextHuddles items={upcoming} now={now} />
      </div>
    </Page>
  );
}
