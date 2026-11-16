import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { uid } from '@/data/db';
import { useI18n } from '@/i18n';
import { useToast } from '@/components/ui';
import type { AlignPriority, Rock, TaskKind } from '../schemas';
import { tasks } from '../stores';
import { errorText } from '../components/RockShared';
import { TASK_KIND_LABEL } from './taskLib';

export interface TaskComposerProps {
  /** Whose plan this task goes into. */
  ownerId: string;
  /** Monday of the week. */
  week: string;
  huddleId?: string | null;
  /** Rocks offered for a Rock action (the week's quarter, not archived). */
  rocks: Rock[];
  /** The owner's priorities, offered as an optional link. */
  priorities?: AlignPriority[];
  /** Order of the new task. */
  nextOrder: number;
}

/** Inline form that adds an action to a weekly plan: title, action type, Rock (for Rock actions), optional priority. */
export function TaskComposer({ ownerId, week, huddleId, rocks, priorities = [], nextOrder }: TaskComposerProps) {
  const { t } = useI18n();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<TaskKind>('weekly');
  const [rockId, setRockId] = useState('');
  const [priorityId, setPriorityId] = useState('');
  const [busy, setBusy] = useState(false);

  const noRock = rocks.length === 0;
  const openPriorities = priorities.filter((p) => !p.archived);
  const canAdd = !busy && title.trim().length > 0 && (kind === 'weekly' || rockId !== '');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
    setBusy(true);
    try {
      await tasks.insert({
        id: uid('t_'),
        title: title.trim(),
        ownerId,
        weekStart: week,
        kind,
        rockId: kind === 'rock' ? rockId : null,
        priorityId: priorityId || null,
        done: false,
        huddleId: huddleId ?? null,
        order: nextOrder,
      });
      setTitle('');
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="align-task-composer" onSubmit={submit}>
      <div className="row row-wrap" style={{ gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 220 }}
          maxLength={300}
          placeholder={t('Ajouter une action pour cette semaine…', 'Add an action for this week…')}
          aria-label={t('Titre de l’action', 'Action title')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="align-task-kind-toggle" role="group" aria-label={t('Type d’action', 'Action type')}>
          <button
            type="button"
            className={`btn btn-sm${kind === 'weekly' ? ' btn-primary' : ''}`}
            aria-pressed={kind === 'weekly'}
            onClick={() => setKind('weekly')}
          >
            {t(TASK_KIND_LABEL.weekly)}
          </button>
          <button
            type="button"
            className={`btn btn-sm${kind === 'rock' ? ' btn-primary' : ''}`}
            aria-pressed={kind === 'rock'}
            disabled={noRock}
            title={noRock ? t('Aucun Rock ce trimestre : impossible de créer une action Rock.', 'No Rock this quarter: a Rock action cannot be created.') : undefined}
            onClick={() => setKind('rock')}
          >
            {t(TASK_KIND_LABEL.rock)}
          </button>
        </div>
      </div>
      <div className="row row-wrap" style={{ gap: 8, marginTop: 8 }}>
        {kind === 'rock' && (
          <select className="select" style={{ width: 280 }} required aria-label={t('Rock', 'Rock')} value={rockId} onChange={(e) => setRockId(e.target.value)}>
            <option value="">{t('Choisir un Rock…', 'Choose a Rock…')}</option>
            {rocks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        )}
        {openPriorities.length > 0 && (
          <select className="select" style={{ width: 240 }} aria-label={t('Priorité liée', 'Linked priority')} value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
            <option value="">{t('Aucune priorité liée', 'No linked priority')}</option>
            {openPriorities.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className="btn btn-primary btn-sm" disabled={!canAdd} style={{ marginLeft: 'auto' }}>
          <Plus size={14} /> {t('Ajouter', 'Add')}
        </button>
      </div>
    </form>
  );
}
