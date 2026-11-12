import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardList, ListChecks, Plus, Search } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import { PriorityCard } from '../Priorities.card';
import { PriorityModal, WeeklyUpdateModal, blankPriority } from '../Priorities.form';
import { STATUS_LABEL, byOrder, groupBy, quarterFrom, quarterRange, quarterTitle, shiftQuarter, type Quarter } from '../Priorities.lib';
import type { Priority, Status, Team } from '../schemas';
import { priorities, priorityUpdates, tasks, teams } from '../stores';

export function Priorities() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const userName = useUserName();
  const { rows: allPriorities } = useCollection(priorities);
  const { rows: allTeams } = useCollection(teams);
  const { rows: allUsers } = useCollection(users);
  const { rows: allTasks } = useCollection(tasks);
  const { rows: allUpdates } = useCollection(priorityUpdates);
  const [quarter, setQuarter] = useState<Quarter>(() => quarterFrom(new Date()));
  const [teamF, setTeamF] = useState('');
  const [personF, setPersonF] = useState('');
  const [statusF, setStatusF] = useState<Status | ''>('');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<{ priority: Priority; existing: boolean } | null>(null);
  const [weekly, setWeekly] = useState(false);

  const isCurrent = quarterFrom(new Date()).key === quarter.key;
  const teamById = useMemo(() => new Map(allTeams.map((x): [string, Team] => [x.id, x])), [allTeams]);
  const tasksBy = useMemo(() => groupBy(allTasks, (x) => x.priorityId), [allTasks]);
  const updatesBy = useMemo(() => groupBy(allUpdates, (x) => x.priorityId), [allUpdates]);
  const people = allUsers.filter((u) => u.active).sort((a, b) => a.displayName.localeCompare(b.displayName));
  const teamOptions = allTeams.filter((x) => !x.archived).sort((a, b) => a.name.localeCompare(b.name));

  const periodRows = allPriorities.filter((p) => p.periodStart === quarter.start);
  const subsOf = (id: string) => periodRows.filter((p) => p.parentId === id).sort(byOrder);
  const term = search.trim().toLowerCase();
  const matches = (p: Priority) =>
    (showArchived || !p.archived) &&
    (!teamF || (teamF === 'company' ? p.company : p.teamId === teamF)) &&
    (!personF || p.ownerId === personF) &&
    (!statusF || p.status === statusF) &&
    (!term || p.title.toLowerCase().includes(term));
  // A top-level priority is listed when it matches, or when one of its sub-priorities does.
  const top = periodRows
    .filter((p) => p.parentId === null && (matches(p) || subsOf(p.id).some(matches)))
    .sort(byOrder);

  const openNew = (parent?: Priority) =>
    setEditing({ priority: blankPriority(quarter, user!.id, periodRows.length, parent), existing: false });

  return (
    <Page>
      <PageHeader
        eyebrow={t('Outils · KPI', 'Tools · KPI')}
        title={t('Priorités', 'Priorities')}
        actions={
          <>
            <button className="btn" onClick={() => setWeekly(true)}>
              <ClipboardList size={16} /> {t('Mise à jour de la semaine', 'Weekly update')}
            </button>
            <button className="btn btn-primary" onClick={() => openNew()} data-tour="priorities-new">
              <Plus size={16} /> {t('Priorité', 'Priority')}
            </button>
          </>
        }
      />

      <div className="row row-wrap" style={{ gap: 10, marginBottom: 16 }}>
        <button className="btn btn-ghost btn-icon btn-sm" aria-label={t('Trimestre précédent', 'Previous quarter')} onClick={() => setQuarter((q) => shiftQuarter(q, -1))}>
          <ChevronLeft size={16} />
        </button>
        <strong>
          {quarterTitle(quarter, lang)} <span className="muted small">· {quarterRange(quarter, lang)}</span>
        </strong>
        <button className="btn btn-ghost btn-icon btn-sm" aria-label={t('Trimestre suivant', 'Next quarter')} onClick={() => setQuarter((q) => shiftQuarter(q, 1))}>
          <ChevronRight size={16} />
        </button>
        {!isCurrent && (
          <button className="btn btn-sm" onClick={() => setQuarter(quarterFrom(new Date()))}>
            {t('Trimestre actuel', 'Current quarter')}
          </button>
        )}
      </div>

      <div className="row row-wrap" style={{ gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative', width: 240 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingLeft: 34 }} placeholder={t('Rechercher…', 'Search…')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: 210 }} aria-label={t('Équipe', 'Team')} value={teamF} onChange={(e) => setTeamF(e.target.value)}>
          <option value="">{t('Toutes les équipes', 'All teams')}</option>
          <option value="company">{t('Priorités d’entreprise seulement', 'Company priorities only')}</option>
          {teamOptions.map((tm) => (
            <option key={tm.id} value={tm.id}>{tm.name}</option>
          ))}
        </select>
        <select className="select" style={{ width: 200 }} aria-label={t('Responsable', 'Owner')} value={personF} onChange={(e) => setPersonF(e.target.value)}>
          <option value="">{t('Toutes les personnes', 'Everyone')}</option>
          {people.map((u) => (
            <option key={u.id} value={u.id}>{u.displayName}</option>
          ))}
        </select>
        <select className="select" style={{ width: 170 }} aria-label={t('Statut', 'Status')} value={statusF} onChange={(e) => setStatusF(e.target.value as Status | '')}>
          <option value="">{t('Tous les statuts', 'All statuses')}</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => {
            const [fr, en] = STATUS_LABEL[s];
            return (
              <option key={s} value={s}>{t(fr, en)}</option>
            );
          })}
        </select>
        <label className="check">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          {t('Afficher les archivées', 'Show archived')}
        </label>
      </div>

      <div data-tour="priorities-list">
      {!periodRows.length ? (
        <div className="card">
          <Empty icon={<ListChecks size={36} />} title={t('Aucune priorité pour ce trimestre', 'No priorities for this quarter')}>
            <button className="btn btn-primary btn-sm" onClick={() => openNew()}>
              <Plus size={14} /> {t('Priorité', 'Priority')}
            </button>
          </Empty>
        </div>
      ) : !top.length ? (
        <div className="card">
          <Empty icon={<Search size={36} />} title={t('Aucun résultat pour ces filtres', 'No result for these filters')} />
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {top.map((p) => (
            <PriorityCard
              key={p.id}
              priority={p}
              team={p.teamId ? teamById.get(p.teamId) : undefined}
              subs={subsOf(p.id).filter((s) => showArchived || !s.archived)}
              tasksBy={tasksBy}
              updatesBy={updatesBy}
              people={people}
              userName={userName}
              currentUserId={user!.id}
              onEdit={(x) => setEditing({ priority: x, existing: true })}
              onAddSub={openNew}
            />
          ))}
        </div>
      )}
      </div>

      {editing && (
        <PriorityModal key={editing.priority.id} quarter={quarter} priority={editing.priority} existing={editing.existing} onClose={() => setEditing(null)} />
      )}
      {weekly && <WeeklyUpdateModal quarter={quarter} onClose={() => setWeekly(false)} />}
    </Page>
  );
}
