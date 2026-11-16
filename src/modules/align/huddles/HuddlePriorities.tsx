import { useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Empty } from '@/components/ui';
import { isBlocked, isOverdue, priorityPct, STATUS_LABEL } from '../lib';
import { HealthDot, ProgressBar } from '../components/RockShared';
import { Collapsible, MemberAvatar } from '../components/WeekKit';
import type { AlignPriority, Rock } from '../schemas';
import { byDue, fmtDay } from './huddleLib';
import { memberPath } from './HuddleMembers';

/** The members' priorities of the quarter, as a compact table. A row opens that person's page. */
export function HuddlePriorities({
  huddleId,
  week,
  priorities,
  me,
  rockById,
  prioById,
  userById,
  userName,
}: {
  huddleId: string;
  week: string;
  /** Members' non-archived priorities of the quarter (not yet filtered). */
  priorities: AlignPriority[];
  me: string;
  rockById: Map<string, Rock>;
  prioById: Map<string, AlignPriority>;
  userById: Map<string, User>;
  userName: (id?: string | null) => string;
}) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [mineOnly, setMineOnly] = useState(false);
  const [problemsOnly, setProblemsOnly] = useState(false);

  const rows = useMemo(
    () =>
      priorities
        .filter((p) => (!mineOnly || p.ownerId === me) && (!problemsOnly || isBlocked(p, prioById) || isOverdue(p)))
        .sort((a, b) => userName(a.ownerId).localeCompare(userName(b.ownerId), lang) || byDue(a, b) || a.order - b.order),
    [priorities, mineOnly, problemsOnly, me, prioById, userName, lang],
  );

  const open = (ownerId: string | null) => {
    if (ownerId) navigate(memberPath(huddleId, ownerId, week));
  };

  return (
    <Collapsible
      id="huddle.priorities"
      title={t('Priorités', 'Priorities')}
      icon={<ListChecks size={18} />}
      count={rows.length}
      actions={
        <div className="row row-wrap" style={{ gap: 14 }}>
          <label className="check small">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            {t('Mes priorités seulement', 'My priorities only')}
          </label>
          <label className="check small">
            <input type="checkbox" checked={problemsOnly} onChange={(e) => setProblemsOnly(e.target.checked)} />
            {t('Bloquées / en retard seulement', 'Blocked / overdue only')}
          </label>
        </div>
      }
    >
      {!priorities.length ? (
        <Empty icon={<ListChecks size={32} />} title={t('Aucune priorité pour ce trimestre', 'No priorities for this quarter')} />
      ) : !rows.length ? (
        <Empty icon={<ListChecks size={32} />} title={t('Aucun résultat pour ces filtres', 'No result for these filters')} />
      ) : (
        <div className="table-wrap">
          <table className="table align-prio-table">
            <thead>
              <tr>
                <th>{t('Personne', 'Person')}</th>
                <th>{t('Priorité', 'Priority')}</th>
                <th>Rock</th>
                <th>{t('Statut', 'Status')}</th>
                <th>{t('Santé', 'Health')}</th>
                <th>{t('Avancement', 'Progress')}</th>
                <th>{t('Échéance', 'Due')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const owner = p.ownerId ?? '';
                const pct = priorityPct(p);
                const blocked = isBlocked(p, prioById);
                const blocker = p.blockedById ? prioById.get(p.blockedById)?.title : undefined;
                const overdue = isOverdue(p);
                const rockTitle = p.rockId ? rockById.get(p.rockId)?.title : undefined;
                return (
                  <tr
                    key={p.id}
                    className="clickable"
                    tabIndex={0}
                    title={t('Ouvrir la page de la personne', 'Open the person’s page')}
                    onClick={() => open(p.ownerId)}
                    onKeyDown={(e: KeyboardEvent<HTMLTableRowElement>) => {
                      if (e.key === 'Enter') open(p.ownerId);
                    }}
                  >
                    <td>
                      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                        <MemberAvatar user={userById.get(owner)} name={userName(owner)} size={22} />
                        <span>{userName(owner)}</span>
                      </div>
                    </td>
                    <td>
                      <strong>{p.title}</strong>
                      {blocked && (
                        <div>
                          <span className="badge badge-warn" title={p.blockedNote || undefined}>
                            {t('Bloquée', 'Blocked')}
                            {blocker ? ` · ${t('par', 'by')} ${blocker}` : ''}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="small">{rockTitle ?? t('Sans Rock', 'No Rock')}</td>
                    <td>
                      <span className="badge">{t(STATUS_LABEL[p.status])}</span>
                    </td>
                    <td>
                      <HealthDot health={p.health} withLabel />
                    </td>
                    <td>
                      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                        <ProgressBar pct={pct} style={{ width: 90 }} />
                        <span className="small mono">{pct} %</span>
                      </div>
                    </td>
                    <td className="small" style={overdue ? { color: 'var(--err)', fontWeight: 600 } : undefined}>
                      {p.dueDate ? fmtDay(p.dueDate, lang) : '—'}
                      {overdue && <> · {t('En retard', 'Overdue')}</>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Collapsible>
  );
}
