import { useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Empty } from '@/components/ui';
import { HEALTH_LABEL, isBlocked, isOverdue, priorityPct, STATUS_LABEL } from '../lib';
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
      id="huddle.priorities" info={{ what: t("Les priorités des membres pour le trimestre de la semaine choisie : statut, santé, avancement et échéance. Cliquer sur une ligne ouvre la page de la personne.", "Members' priorities for the selected week's quarter: status, health, progress and due date. Click a row to open the person's page."), source: t("Align › Rocks (priorités assignées aux membres, liées à un Rock du trimestre ou à échéance dans le trimestre).", "Align › Rocks (priorities assigned to members, linked to a Rock of the quarter or due in the quarter).") }}
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
                    <td className="align-prio-who">
                      <MemberAvatar user={userById.get(owner)} name={userName(owner)} size={22} />
                      <span>{userName(owner)}</span>
                    </td>
                    <td className="align-prio-title" title={p.title}>
                      {blocked && (
                        <span className="badge badge-warn" title={[blocker, p.blockedNote].filter(Boolean).join(' — ') || undefined}>
                          {t('Bloquée', 'Blocked')}
                        </span>
                      )}
                      {p.title}
                    </td>
                    <td className="align-prio-rock small muted" title={rockTitle}>{rockTitle ?? t('Sans Rock', 'No Rock')}</td>
                    <td className="align-prio-status small" title={t(HEALTH_LABEL[p.health])}>
                      <HealthDot health={p.health} /> {t(STATUS_LABEL[p.status])}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                        <ProgressBar pct={pct} style={{ width: 56 }} />
                        <span className="small mono">{pct} %</span>
                      </div>
                    </td>
                    <td className="small align-nowrap" title={overdue ? t('En retard', 'Overdue') : undefined} style={overdue ? { color: 'var(--err)', fontWeight: 600 } : undefined}>
                      {p.dueDate ? fmtDay(p.dueDate, lang) : '—'}
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
