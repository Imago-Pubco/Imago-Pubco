import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import { users } from '@/data/stores';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import { currentWeek, priorityUpdateId, shortPeriod, STATUS_COLOR } from './lib';
import { STATUS_LABEL, byOrder, clamp, quarterRange, quarterTitle, type Quarter } from './Priorities.lib';
import type { Priority, Status, Team } from './schemas';
import { priorities, priorityUpdates, tasks, teams } from './stores';

/** A new priority for the quarter, ready for the form. */
export function blankPriority(q: Quarter, ownerId: string, order: number, parent?: Priority): Priority {
  return {
    id: uid('pr_'),
    title: '',
    description: '',
    ownerId,
    teamId: parent?.teamId ?? null,
    company: parent?.company ?? false,
    periodStart: q.start,
    periodEnd: q.end,
    parentId: parent?.id ?? null,
    status: 'green',
    progress: 0,
    order,
    archived: false,
  };
}

/** Schema fields only: the server refuses unknown keys and stamps the audit fields itself. */
function priorityFields(p: Priority) {
  return {
    title: p.title,
    description: p.description,
    ownerId: p.ownerId,
    teamId: p.teamId,
    company: p.company,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    parentId: p.parentId,
    status: p.status,
    progress: clamp(p.progress),
    order: p.order,
    archived: p.archived,
  };
}

/** Deletes a priority with its weekly updates, its tasks and its sub-priorities (with their own updates and tasks). */
export async function removePriorityTree(id: string): Promise<void> {
  const [all, updates, taskRows] = await Promise.all([priorities.list(), priorityUpdates.list(), tasks.list()]);
  const ids = new Set([id, ...all.filter((p) => p.parentId === id).map((p) => p.id)]);
  for (const u of updates.filter((x) => ids.has(x.priorityId))) await priorityUpdates.remove(u.id);
  for (const k of taskRows.filter((x) => x.priorityId !== null && ids.has(x.priorityId))) await tasks.remove(k.id);
  for (const pid of ids) await priorities.remove(pid);
}

const byName = (a: { displayName: string }, b: { displayName: string }) => a.displayName.localeCompare(b.displayName);

export function PriorityModal({ quarter, priority, existing, onClose }: { quarter: Quarter; priority: Priority; existing: boolean; onClose: () => void }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { rows: all } = useCollection(priorities);
  const { rows: allTeams } = useCollection(teams);
  const { rows: allUsers } = useCollection(users);
  const [draft, setDraft] = useState<Priority>(priority);
  const [busy, setBusy] = useState(false);

  const hasSubs = all.some((p) => p.parentId === draft.id);
  // Only top-level priorities of the same quarter can be parents (a sub-priority cannot have sub-priorities).
  const parents = all
    .filter((p) => p.periodStart === quarter.start && p.parentId === null && p.id !== draft.id && (!p.archived || p.id === draft.parentId))
    .sort(byOrder);
  const teamOptions = allTeams.filter((x) => !x.archived || x.id === draft.teamId).sort((a, b) => a.name.localeCompare(b.name));
  const people = allUsers.filter((u) => u.active || u.id === draft.ownerId).sort(byName);

  const save = async () => {
    const title = draft.title.trim();
    if (!title) return;
    const fields = priorityFields({ ...draft, title, description: draft.description.trim() });
    setBusy(true);
    try {
      if (existing) await priorities.update(draft.id, fields);
      else await priorities.insert({ id: draft.id, ...fields });
      toast(t('Priorité enregistrée', 'Priority saved'));
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const subCount = all.filter((p) => p.parentId === draft.id).length;
    const subWarn = subCount
      ? t(` Ses ${subCount} sous-priorité(s) seront aussi supprimées.`, ` Its ${subCount} sub-priority(ies) will be deleted too.`)
      : '';
    const ok = window.confirm(
      t(
        `Supprimer « ${draft.title} » ?${subWarn} Ses tâches et son historique hebdomadaire seront supprimés. Action irréversible.`,
        `Delete "${draft.title}"?${subWarn} Its tasks and weekly history will be deleted too. This cannot be undone.`,
      ),
    );
    if (!ok) return;
    setBusy(true);
    try {
      await removePriorityTree(draft.id);
      toast(t('Priorité supprimée', 'Priority deleted'));
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? t('Modifier la priorité', 'Edit priority') : draft.parentId ? t('Nouvelle sous-priorité', 'New sub-priority') : t('Nouvelle priorité', 'New priority')}
      footer={
        <>
          {existing && (
            <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove} disabled={busy}>
              <Trash2 size={15} /> {t('Supprimer', 'Delete')}
            </button>
          )}
          <button className="btn" onClick={onClose}>{t('Annuler', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !draft.title.trim()}>
            {t('Enregistrer', 'Save')}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="faint small">
          {t('Période', 'Period')} : {quarterTitle(quarter, lang)} · {quarterRange(quarter, lang)}
        </div>
        <PriorityFields value={draft} onChange={setDraft} parents={parents} teamOptions={teamOptions} people={people} lockParent={hasSubs} />
      </div>
    </Modal>
  );
}

function PriorityFields({
  value,
  onChange,
  parents,
  teamOptions,
  people,
  lockParent,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
  parents: Priority[];
  teamOptions: Team[];
  people: User[];
  lockParent: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="form-grid">
      <label className="field span-2">
        <span>{t('Titre', 'Title')}</span>
        <input className="input" value={value.title} maxLength={200} autoFocus onChange={(e) => onChange({ ...value, title: e.target.value })} />
      </label>
      <label className="field span-2">
        <span>Description</span>
        <textarea className="textarea" value={value.description} maxLength={4000} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </label>
      <label className="field">
        <span>{t('Responsable', 'Owner')}</span>
        <select className="select" value={value.ownerId ?? ''} onChange={(e) => onChange({ ...value, ownerId: e.target.value || null })}>
          <option value="">{t('Aucun', 'None')}</option>
          {people.map((u) => (
            <option key={u.id} value={u.id}>{u.displayName}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('Équipe', 'Team')}</span>
        <select className="select" value={value.teamId ?? ''} onChange={(e) => onChange({ ...value, teamId: e.target.value || null })}>
          <option value="">{t('Aucune', 'None')}</option>
          {teamOptions.map((tm) => (
            <option key={tm.id} value={tm.id}>{tm.name}</option>
          ))}
        </select>
      </label>
      <div className="field">
        <span>{t('Portée', 'Scope')}</span>
        <label className="check" style={{ height: 38 }}>
          <input type="checkbox" checked={value.company} onChange={(e) => onChange({ ...value, company: e.target.checked })} />
          {t('Priorité d’entreprise', 'Company priority')}
        </label>
      </div>
      <label className="field">
        <span>{t('Priorité parente', 'Parent priority')}</span>
        <select className="select" value={value.parentId ?? ''} disabled={lockParent} onChange={(e) => onChange({ ...value, parentId: e.target.value || null })}>
          <option value="">{t('Aucune (priorité principale)', 'None (top-level priority)')}</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        {lockParent && (
          <div className="faint small">{t('Elle a des sous-priorités : elle reste principale.', 'It has sub-priorities, so it stays top-level.')}</div>
        )}
      </label>
      <label className="field">
        <span>{t('Statut', 'Status')}</span>
        <select className="select" value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value as Status })}>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => {
            const [fr, en] = STATUS_LABEL[s];
            return (
              <option key={s} value={s}>{t(fr, en)}</option>
            );
          })}
        </select>
      </label>
      <label className="field">
        <span>{t('Progression (%)', 'Progress (%)')}</span>
        <input
          className="input"
          type="number"
          min={0}
          max={100}
          value={value.progress}
          onChange={(e) => onChange({ ...value, progress: clamp(Number(e.target.value)) })}
        />
      </label>
      <div className="field span-2">
        <span>{t('Archivage', 'Archiving')}</span>
        <label className="check" style={{ height: 38 }}>
          <input type="checkbox" checked={value.archived} onChange={(e) => onChange({ ...value, archived: e.target.checked })} />
          {t('Archivée', 'Archived')}
        </label>
      </div>
    </div>
  );
}

interface WeekDraft {
  progress: number;
  status: Status;
  note: string;
}

/** Weekly update: progress, status and note of each priority, saved for the current week. */
export function WeeklyUpdateModal({ quarter, onClose }: { quarter: Quarter; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const userName = useUserName();
  const { rows: all } = useCollection(priorities);
  const { rows: updates } = useCollection(priorityUpdates);
  const week = currentWeek();
  const [everyone, setEveryone] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, WeekDraft>>({});
  const [busy, setBusy] = useState(false);

  const list = all
    .filter((p) => p.periodStart === quarter.start && !p.archived && (everyone || p.ownerId === user!.id))
    .sort(byOrder);

  const saved = (p: Priority): WeekDraft => {
    const u = updates.find((x) => x.id === priorityUpdateId(p.id, week));
    return { progress: u?.progress ?? p.progress, status: u?.status ?? p.status, note: u?.note ?? '' };
  };
  const valueOf = (p: Priority): WeekDraft => drafts[p.id] ?? saved(p);
  const edit = (p: Priority, patch: Partial<WeekDraft>) => setDrafts((d) => ({ ...d, [p.id]: { ...valueOf(p), ...patch } }));

  const save = async () => {
    // Only the rows the user changed are written, so others' fresh values are never overwritten.
    const touched = list.filter((p) => drafts[p.id]);
    setBusy(true);
    try {
      for (const p of touched) {
        const d = valueOf(p);
        const id = priorityUpdateId(p.id, week);
        const note = d.note.trim();
        if (await priorityUpdates.get(id)) await priorityUpdates.update(id, { progress: d.progress, status: d.status, note });
        else await priorityUpdates.insert({ id, priorityId: p.id, week, progress: d.progress, status: d.status, note });
        await priorities.update(p.id, { progress: d.progress, status: d.status });
      }
      toast(t('Mise à jour enregistrée', 'Update saved'));
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      large
      onClose={onClose}
      title={t('Mise à jour de la semaine', 'Weekly update')}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('Annuler', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !Object.keys(drafts).length}>
            {t('Enregistrer', 'Save')}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
          <p className="muted small" style={{ margin: 0 }}>
            {t(`Semaine du ${shortPeriod(week, lang)} · ${quarterTitle(quarter, 'fr')}`, `Week of ${shortPeriod(week, lang)} · ${quarterTitle(quarter, 'en')}`)}
          </p>
          <label className="check">
            <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} />
            {t('Toutes', 'All')}
          </label>
        </div>
        {!list.length && <p className="faint small" style={{ margin: 0 }}>{t('Aucune priorité à mettre à jour.', 'No priority to update.')}</p>}
        {list.map((p) => {
          const d = valueOf(p);
          return (
            <div key={p.id} className="row row-wrap" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{p.title}</div>
                {everyone && <div className="faint small">{userName(p.ownerId ?? undefined)}</div>}
              </div>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                aria-label={t('Progression', 'Progress')}
                style={{ width: 96 }}
                value={d.progress}
                onChange={(e) => edit(p, { progress: clamp(Number(e.target.value)) })}
              />
              <select
                className="select"
                aria-label={t('Statut', 'Status')}
                style={{ width: 140 }}
                value={d.status}
                onChange={(e) => edit(p, { status: e.target.value as Status })}
              >
                {(Object.keys(STATUS_LABEL) as Status[]).map((s) => {
                  const [fr, en] = STATUS_LABEL[s];
                  return (
                    <option key={s} value={s}>{t(fr, en)}</option>
                  );
                })}
              </select>
              <input
                className="input"
                style={{ flex: '1 1 200px', width: 'auto' }}
                placeholder={t('Note de la semaine', 'Weekly note')}
                maxLength={2000}
                value={d.note}
                onChange={(e) => edit(p, { note: e.target.value })}
              />
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[d.status] }} />
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
