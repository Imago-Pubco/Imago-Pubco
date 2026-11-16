import { useNavigate } from 'react-router-dom';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { HEALTH_LABEL, isBlocked, isOverdue, priorityPct, STATUS_LABEL } from '../lib';
import { HealthDot, ProgressBar } from '../components/RockShared';
import { MemberAvatar } from '../components/WeekKit';
import type { AlignPriority } from '../schemas';
import { byDue, fmtDay } from './huddleLib';
import { memberPath } from './HuddleMembers';

/** The priorities of one Rock (or of no Rock), as compact lines: person, title, status, progress, due. A line opens the person's page. */
export function RockPriorities({
  huddleId,
  week,
  priorities,
  prioById,
  userById,
  userName,
}: {
  huddleId: string;
  week: string;
  priorities: AlignPriority[];
  prioById: Map<string, AlignPriority>;
  userById: Map<string, User>;
  userName: (id?: string | null) => string;
}) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  if (!priorities.length) return <div className="small muted align-rockprio-empty">{t('Aucune priorité', 'No priorities')}</div>;
  const rows = [...priorities].sort((a, b) => userName(a.ownerId).localeCompare(userName(b.ownerId), lang) || byDue(a, b) || a.order - b.order);
  return (
    <ul className="align-rockprio-list">
      {rows.map((p) => {
        const owner = p.ownerId ?? '';
        const pct = priorityPct(p);
        const blocked = isBlocked(p, prioById);
        const overdue = isOverdue(p);
        const blocker = p.blockedById ? prioById.get(p.blockedById)?.title : undefined;
        return (
          <li
            key={p.id}
            className="align-rockprio-row"
            tabIndex={0}
            title={t('Ouvrir la page de la personne', 'Open the person’s page')}
            onClick={() => owner && navigate(memberPath(huddleId, owner, week))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && owner) navigate(memberPath(huddleId, owner, week));
            }}
          >
            <span className="align-rockprio-who" title={userName(owner)}>
              <MemberAvatar user={userById.get(owner)} name={userName(owner)} size={20} />
            </span>
            <span className="align-rockprio-title" title={p.title}>
              {blocked && (
                <span className="badge badge-warn" title={[blocker, p.blockedNote].filter(Boolean).join(' — ') || undefined}>
                  {t('Bloquée', 'Blocked')}
                </span>
              )}
              {p.title}
            </span>
            <span className="small align-nowrap" title={t(HEALTH_LABEL[p.health])}>
              <HealthDot health={p.health} /> {t(STATUS_LABEL[p.status])}
            </span>
            <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
              <ProgressBar pct={pct} style={{ width: 48 }} />
              <span className="small mono">{pct} %</span>
            </span>
            <span className="small align-nowrap" style={overdue ? { color: 'var(--err)', fontWeight: 600 } : undefined} title={overdue ? t('En retard', 'Overdue') : undefined}>
              {p.dueDate ? fmtDay(p.dueDate, lang) : '—'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
