import { Link } from 'react-router-dom';
import { AlarmClock, BadgeCheck, Clock, Handshake, Inbox, TriangleAlert } from 'lucide-react';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import type { SalesRequest } from '../types';
import { BLOCKER_LABEL } from '../types';
import { BLOCKER_SHORT, isClosed, salesRequests, salesStats } from '../stores';

/** Headline numbers. Pass `rows` to reuse a list the page already loads. */
export function SalesKpis({ rows: given }: { rows?: SalesRequest[] }) {
  const { t, fmtNum } = useI18n();
  const { rows: all } = useCollection(salesRequests);
  const rows = given ?? all;
  const s = salesStats(rows);
  const followUps = s.due + s.overdue;
  return (
    <KpiGrid>
      <Kpi to="/sales/requests" label={t('Demandes ouvertes', 'Open requests')} value={s.open} icon={<Inbox size={17} />} tone="accent" />
      <Kpi
        to="/sales/requests?blocked=1"
        label={t('Bloquées', 'Blocked')}
        value={s.blocked}
        icon={<TriangleAlert size={17} />}
        tone={s.blocked ? 'warn' : undefined}
      />
      <Kpi
        label={t('Suivis dus ou en retard', 'Follow-ups due or overdue')}
        value={followUps}
        hint={s.overdue ? t(`${s.overdue} en retard`, `${s.overdue} overdue`) : t('Aucun en retard', 'None overdue')}
        icon={<AlarmClock size={17} />}
        tone={s.overdue ? 'err' : undefined}
      />
      <Kpi
        label={t('Jours moyens avant soumission', 'Average days to quote')}
        value={s.avgDaysToQuote === null ? '—' : fmtNum(s.avgDaysToQuote, 1)}
        icon={<Clock size={17} />}
      />
      <Kpi
        label={t('Taux de succès', 'Win rate')}
        value={s.winRate === null ? '—' : `${s.winRate} %`}
        icon={<Handshake size={17} />}
        tone="ok"
      />
      <Kpi label={t('Gagnées', 'Won')} value={rows.filter((r) => r.stage === 'accepted' || r.stage === 'production').length} icon={<BadgeCheck size={17} />} />
    </KpiGrid>
  );
}

/** Open requests that are waiting on something, earliest follow-up first. */
export function blockedRequests(rows: SalesRequest[]): SalesRequest[] {
  return rows
    .filter((r) => !isClosed(r) && r.blocker)
    .sort((a, b) => (a.blocker?.followUpAt ?? '9999').localeCompare(b.blocker?.followUpAt ?? '9999'));
}

export function SalesBlockedWidget({ rows: given }: { rows?: SalesRequest[] }) {
  const { t, fmtDate } = useI18n();
  const { rows: all } = useCollection(salesRequests);
  const list = blockedRequests(given ?? all).slice(0, 8);
  if (!list.length) return <div className="sl-widget-empty">{t('Aucune demande bloquée.', 'No blocked requests.')}</div>;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <ul className="widget-list">
      {list.map((r) => {
        const b = r.blocker!;
        const late = !!b.followUpAt && b.followUpAt.slice(0, 10) < today;
        return (
          <li key={r.id}>
            <Link to={`/sales?r=${encodeURIComponent(r.id)}`} className="widget-list-main">
              <strong className="mono">{r.no}</strong> <span className="faint">{r.customer}</span>
              <div className="faint small" title={b.note}>
                {t(BLOCKER_LABEL[b.kind])}
                {b.note ? ` — ${b.note}` : ''}
              </div>
            </Link>
            <span className="badge badge-warn" title={t(BLOCKER_LABEL[b.kind])}>
              {t(BLOCKER_SHORT[b.kind])}
            </span>
            {b.followUpAt && <span className={`small ${late ? 'sl-overdue' : 'faint'}`}>{fmtDate(b.followUpAt)}</span>}
          </li>
        );
      })}
    </ul>
  );
}
