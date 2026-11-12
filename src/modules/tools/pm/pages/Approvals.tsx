import { useMemo, useState } from 'react';
import { CheckCheck, Clock, Users } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, Modal, PageHeader, useToast } from '@/components/ui';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { addWeeks } from '../../lib';
import { fmtHours, thisWeek } from '../lib';
import { projects, pmTasks, timeEntries } from '../stores';
import type { TimeEntry } from '../schemas';
import { entryTotal, settleAll } from '../Timesheet.helpers';
import { groupByPersonWeek } from '../Approvals.helpers';
import { PersonWeekCard } from '../Approvals.card';

/** Approvers review the time submitted by the team, week by week; the approved weeks can be unlocked again. */
export function Approvals() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const userName = useUserName();
  const meId = user?.id ?? '';
  const { rows: entries, loading } = useCollection(timeEntries);
  const { rows: projectRows } = useCollection(projects);
  const { rows: taskRows } = useCollection(pmTasks);

  const [tab, setTab] = useState<'waiting' | 'approved'>('waiting');
  const [busy, setBusy] = useState(false);
  const [reject, setReject] = useState<{ entries: TimeEntry[]; label: string } | null>(null);
  const [reason, setReason] = useState('');
  // Approved tab filters: the last eight weeks by default.
  const [person, setPerson] = useState('');
  const [from, setFrom] = useState(() => addWeeks(thisWeek(), -8));
  const [to, setTo] = useState('');

  const projectById = useMemo(() => new Map(projectRows.map((p) => [p.id, p])), [projectRows]);
  const taskById = useMemo(() => new Map(taskRows.map((x) => [x.id, x])), [taskRows]);
  const waiting = useMemo(() => entries.filter((e) => e.status === 'submitted'), [entries]);
  const approved = useMemo(() => entries.filter((e) => e.status === 'approved'), [entries]);
  const waitingGroups = useMemo(
    () => groupByPersonWeek(waiting).sort((a, b) => a.week.localeCompare(b.week) || userName(a.userId).localeCompare(userName(b.userId))),
    [waiting, userName],
  );
  const waitingPeople = new Set(waiting.map((e) => e.userId)).size;
  const waitingHours = entryTotal(waiting);

  const approvedUsers = useMemo(
    () => [...new Set(approved.map((e) => e.userId))].sort((a, b) => userName(a).localeCompare(userName(b))),
    [approved, userName],
  );
  const approvedFiltered = approved.filter((e) => (!person || e.userId === person) && (!from || e.date >= from) && (!to || e.date <= to));
  const approvedGroups = groupByPersonWeek(approvedFiltered).sort((a, b) => b.week.localeCompare(a.week) || userName(a.userId).localeCompare(userName(b.userId)));

  /** Runs one status change per entry in parallel and toasts the outcome. */
  const apply = async (list: TimeEntry[], change: (e: TimeEntry) => Promise<unknown>, okMsg: (n: number) => string) => {
    if (!list.length) return;
    setBusy(true);
    const res = await settleAll(list.map((e) => () => change(e)));
    setBusy(false);
    if (res.ok) toast(okMsg(res.ok), 'ok');
    if (res.error) toast(res.error, 'err');
  };

  const approve = (list: TimeEntry[]) =>
    apply(
      list.filter((e) => e.status === 'submitted' && e.userId !== meId),
      (e) => timeEntries.update(e.id, { status: 'approved' }),
      (n) => t(`${n} entrée(s) approuvée(s)`, `${n} entries approved`),
    );

  const unlock = (list: TimeEntry[]) =>
    apply(
      list.filter((e) => e.status === 'approved' && e.userId !== meId),
      (e) => timeEntries.update(e.id, { status: 'submitted' }),
      (n) => t(`Approbation annulée pour ${n} entrée(s)`, `Approval cancelled for ${n} entries`),
    );

  const closeReject = () => {
    setReject(null);
    setReason('');
  };

  const confirmReject = async () => {
    if (!reject) return;
    const text = reason.trim();
    if (!text) {
      toast(t('Indiquez le motif du rejet.', 'Give a reason for the rejection.'), 'err');
      return;
    }
    const list = reject.entries.filter((e) => e.status === 'submitted' && e.userId !== meId);
    closeReject();
    await apply(
      list,
      (e) => timeEntries.update(e.id, { status: 'rejected', reviewNote: text }),
      (n) => t(`${n} entrée(s) rejetée(s), la personne est avisée du motif`, `${n} entries rejected, the person sees the reason`),
    );
  };

  const cardProps = (mode: 'waiting' | 'approved') => ({
    meId,
    projectById,
    taskById,
    busy,
    mode,
    onApprove: (list: TimeEntry[]) => void approve(list),
    onUnlock: (list: TimeEntry[]) => void unlock(list),
    onReject: (list: TimeEntry[], label: string) => {
      setReason('');
      setReject({ entries: list, label });
    },
  });

  return (
    <Page>
      <PageHeader
        eyebrow={t('Outils · Gestion de projet', 'Tools · Project management')}
        title={t('Approbations', 'Approvals')}
        subtitle={t('Feuilles de temps soumises par l’équipe, semaine par semaine.', 'Timesheets submitted by the team, week by week.')}
      />

      <KpiGrid>
        <Kpi label={t('Entrées en attente', 'Entries waiting')} value={waiting.length} tone="warn" icon={<Clock size={18} />} />
        <Kpi label={t('Heures en attente', 'Hours waiting')} value={fmtHours(waitingHours)} tone="accent" icon={<CheckCheck size={18} />} />
        <Kpi label={t('Personnes en attente', 'People waiting')} value={waitingPeople} tone="accent" icon={<Users size={18} />} />
      </KpiGrid>

      <div className="tabs" style={{ marginTop: 20 }}>
        <button className={`tab ${tab === 'waiting' ? 'active' : ''}`} onClick={() => setTab('waiting')}>
          {t('À approuver', 'To approve')} ({waitingGroups.length})
        </button>
        <button className={`tab ${tab === 'approved' ? 'active' : ''}`} onClick={() => setTab('approved')}>
          {t('Approuvés', 'Approved')}
        </button>
      </div>

      {loading && entries.length === 0 && <p className="faint small">{t('Chargement…', 'Loading…')}</p>}

      {tab === 'waiting' &&
        (waitingGroups.length === 0 ? (
          <Empty icon={<CheckCheck size={40} />} title={t('Rien à approuver', 'Nothing to approve')}>
            {t('Les feuilles soumises par l’équipe apparaîtront ici.', 'Timesheets submitted by the team will appear here.')}
          </Empty>
        ) : (
          waitingGroups.map((g) => (
            <PersonWeekCard
              key={g.key}
              group={g}
              name={userName(g.userId)}
              {...cardProps('waiting')}
            />
          ))
        ))}

      {tab === 'approved' && (
        <>
          <div className="row row-wrap" style={{ gap: 12, alignItems: 'flex-end', margin: '4px 0 16px' }}>
            <label className="field" style={{ minWidth: 220 }}>
              <span>{t('Personne', 'Person')}</span>
              <select className="select" value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value="">{t('Toutes', 'Everyone')}</option>
                {approvedUsers.map((id) => (
                  <option key={id} value={id}>
                    {userName(id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('Du', 'From')}</span>
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field">
              <span>{t('Au', 'To')}</span>
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setPerson('');
                setFrom('');
                setTo('');
              }}
            >
              {t('Toute la période', 'All dates')}
            </button>
          </div>
          {approvedGroups.length === 0 ? (
            <Empty icon={<CheckCheck size={40} />} title={t('Aucune semaine approuvée', 'No approved week')}>
              {t('Aucune semaine approuvée sur cette période.', 'No approved week in this period.')}
            </Empty>
          ) : (
            approvedGroups.map((g) => (
              <PersonWeekCard key={g.key} group={g} name={userName(g.userId)} {...cardProps('approved')} />
            ))
          )}
        </>
      )}

      <Modal
        open={!!reject}
        onClose={closeReject}
        title={t('Rejeter le temps', 'Reject time')}
        footer={
          <>
            <button className="btn" onClick={closeReject}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-danger" onClick={() => void confirmReject()} disabled={busy || !reason.trim()}>
              {t('Rejeter', 'Reject')}
            </button>
          </>
        }
      >
        <p className="small muted" style={{ margin: '0 0 12px' }}>
          {reject?.label}
          {reject && ` · ${t(`${reject.entries.length} entrée(s)`, `${reject.entries.length} entries`)}`}
        </p>
        <label className="field">
          <span>{t('Motif (visible par la personne)', 'Reason (visible to the person)')}</span>
          <textarea className="textarea" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </label>
        <p className="small faint" style={{ margin: '8px 0 0' }}>
          {t('Les entrées reviennent en « rejeté » : la personne peut les corriger puis les soumettre à nouveau.', 'The entries go back as rejected: the person can correct them and submit again.')}
        </p>
      </Modal>
    </Page>
  );
}
