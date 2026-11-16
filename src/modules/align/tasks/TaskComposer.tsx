import { useMemo, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { useToast } from '@/components/ui';
import type { AlignPriority, Rock, TaskKind } from '../schemas';
import { tasks } from '../stores';
import { errorText } from '../components/RockShared';

export interface TaskComposerProps {
  /** Who it is assigned to by default (the person creating it, or the member whose plan is open). */
  ownerId: string;
  /** Monday of the week. */
  week: string;
  huddleId?: string | null;
  /** Rocks offered for a Rock action (the week's quarter, not archived). */
  rocks: Rock[];
  /** Priorities offered as an optional link (filtered here to the assignee's). */
  priorities?: AlignPriority[];
  /** Order of the new task. */
  nextOrder: number;
  /** People offered first in the "assigned to" list (e.g. the huddle's members). Everyone active follows. */
  preferredIds?: string[];
}

/** One compact line that adds an action: title · assigned to · weekly / Rock · Rock · linked priority · add. */
export function TaskComposer({ ownerId, week, huddleId, rocks, priorities = [], nextOrder, preferredIds = [] }: TaskComposerProps) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const { rows: allUsers } = useCollection(users);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState(ownerId);
  const [kind, setKind] = useState<TaskKind>('weekly');
  const [rockId, setRockId] = useState('');
  const [priorityId, setPriorityId] = useState('');
  const [busy, setBusy] = useState(false);

  // Preferred people first (e.g. huddle members), then everyone else who is active; the default is always present.
  const people = useMemo(() => {
    const active = allUsers.filter((u) => u.active || u.id === ownerId).sort((a, b) => a.displayName.localeCompare(b.displayName, lang));
    const pref = new Set(preferredIds);
    return [...active.filter((u) => pref.has(u.id)), ...active.filter((u) => !pref.has(u.id))];
  }, [allUsers, preferredIds, ownerId, lang]);
  const ownPriorities = priorities.filter((p) => !p.archived && p.ownerId === assignee);

  const noRock = rocks.length === 0;
  const canAdd = !busy && title.trim().length > 0 && (kind === 'weekly' || rockId !== '');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
    setBusy(true);
    try {
      await tasks.insert({
        id: uid('t_'),
        title: title.trim(),
        ownerId: assignee,
        weekStart: week,
        kind,
        rockId: kind === 'rock' ? rockId : null,
        priorityId: priorityId && ownPriorities.some((p) => p.id === priorityId) ? priorityId : null,
        done: false,
        huddleId: huddleId ?? null,
        order: nextOrder,
      });
      setTitle('');
      setPriorityId('');
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="align-composer" onSubmit={submit}>
      <input
        className="input align-composer-title"
        maxLength={300}
        placeholder={t('Nouvelle action…', 'New action…')}
        aria-label={t('Titre de l’action', 'Action title')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <select className="select align-composer-who" aria-label={t('Assigné à', 'Assigned to')} title={t('Assigné à', 'Assigned to')} value={assignee} onChange={(e) => { setAssignee(e.target.value); setPriorityId(''); }}>
        {people.map((u) => (
          <option key={u.id} value={u.id}>
            {u.id === user!.id ? `${u.displayName} (${t('moi', 'me')})` : u.displayName}
          </option>
        ))}
      </select>
      <div className="align-seg" role="group" aria-label={t('Type d’action', 'Action type')}>
        <button type="button" className={kind === 'weekly' ? 'on' : ''} aria-pressed={kind === 'weekly'} onClick={() => setKind('weekly')}>
          {t('Hebdo', 'Weekly')}
        </button>
        <button
          type="button"
          className={kind === 'rock' ? 'on' : ''}
          aria-pressed={kind === 'rock'}
          disabled={noRock}
          title={noRock ? t('Aucun Rock ce trimestre', 'No Rock this quarter') : t('Action qui fait avancer un Rock', 'Action that moves a Rock forward')}
          onClick={() => setKind('rock')}
        >
          Rock
        </button>
      </div>
      {kind === 'rock' && (
        <select className="select align-composer-rock" required aria-label="Rock" value={rockId} onChange={(e) => setRockId(e.target.value)}>
          <option value="">{t('Choisir un Rock…', 'Choose a Rock…')}</option>
          {rocks.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      )}
      {ownPriorities.length > 0 && (
        <select className="select align-composer-prio" aria-label={t('Priorité liée', 'Linked priority')} title={t('Priorité liée (facultatif)', 'Linked priority (optional)')} value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
          <option value="">{t('Priorité liée…', 'Linked priority…')}</option>
          {ownPriorities.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      )}
      <button type="submit" className="btn btn-primary btn-icon btn-sm" disabled={!canAdd} title={t('Ajouter', 'Add')} aria-label={t('Ajouter', 'Add')}>
        <Plus size={16} />
      </button>
    </form>
  );
}
