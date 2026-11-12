/** Who - What - When: this week's tasks of the huddle, plus the open ones carried over from earlier weeks. */
import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { uid } from '@/data/db';
import { useI18n } from '@/i18n';
import { shortPeriod } from './lib';
import { tasks } from './stores';
import type { Task } from './schemas';
import { huddleTasks, todayIso, type MeetingData } from './HuddleMeeting.data';
import { SectionCard, useRun } from './HuddleMeeting.ui';

export function TasksSection({ data }: { data: MeetingData }) {
  const { t, lang } = useI18n();
  const run = useRun();
  const { current, carried } = huddleTasks(data);
  const today = todayIso();

  // The member list is the choice of owners; the current user is preselected when they belong to it.
  const defaultOwner = data.members.some((m) => m.id === data.me) ? data.me : (data.members[0]?.id ?? '');
  const [what, setWhat] = useState('');
  const [who, setWho] = useState('');
  const [when, setWhen] = useState('');
  const owner = who || defaultOwner;

  const add = (e: FormEvent) => {
    e.preventDefault();
    const title = what.trim();
    if (!title) return;
    run(async () => {
      await tasks.insert({
        id: uid('t_'),
        title,
        ownerId: owner || null,
        dueDate: when || null,
        done: false,
        doneAt: null,
        priorityId: null,
        huddleId: data.huddle.id,
        week: data.week,
      });
      setWhat('');
      setWhen('');
    });
  };

  const toggle = (task: Task) => run(() => tasks.update(task.id, { done: !task.done, doneAt: task.done ? null : new Date().toISOString() }));

  const remove = (task: Task) => {
    if (window.confirm(t('Supprimer cette tâche ?', 'Delete this task?'))) run(() => tasks.remove(task.id));
  };

  const rows = [...carried.map((task) => ({ task, carry: true })), ...current.map((task) => ({ task, carry: false }))];

  return (
    <SectionCard title={t('Qui – Quoi – Quand', 'Who – What – When')} flush>
      <form onSubmit={add} className="row row-wrap" style={{ gap: 8, padding: '16px 20px' }}>
        <input
          className="input"
          style={{ flex: 2, minWidth: 200 }}
          value={what}
          maxLength={300}
          placeholder={t('Quoi ?', 'What?')}
          aria-label={t('Quoi', 'What')}
          onChange={(e) => setWhat(e.target.value)}
        />
        <select className="select" style={{ flex: 1, minWidth: 160 }} value={owner} aria-label={t('Qui', 'Who')} onChange={(e) => setWho(e.target.value)}>
          {data.members.length === 0 && <option value="">{t('Personne', 'Nobody')}</option>}
          {data.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
        <input type="date" className="input" style={{ minWidth: 150 }} value={when} aria-label={t('Quand', 'When')} onChange={(e) => setWhen(e.target.value)} />
        <button className="btn btn-sm" type="submit" disabled={!what.trim()}>
          <Plus size={15} />
          {t('Ajouter', 'Add')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="faint small" style={{ margin: 0, padding: '0 20px 16px' }}>
          {t('Aucune tâche pour cette semaine.', 'No tasks for this week.')}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }} aria-label={t('Fait', 'Done')} />
                <th>{t('Quoi', 'What')}</th>
                <th>{t('Qui', 'Who')}</th>
                <th>{t('Quand', 'When')}</th>
                <th style={{ width: 40 }} aria-label={t('Supprimer', 'Delete')} />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ task, carry }) => {
                const late = !!task.dueDate && !task.done && task.dueDate < today;
                return (
                  <tr key={task.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => toggle(task)}
                        aria-label={t('Terminé', 'Done')}
                        style={{ accentColor: 'var(--accent)', width: 18, height: 18 }}
                      />
                    </td>
                    <td style={{ opacity: task.done ? 0.6 : 1 }}>
                      <div className="row row-wrap" style={{ gap: 8 }}>
                        <span style={{ textDecoration: task.done ? 'line-through' : undefined, overflowWrap: 'anywhere' }}>{task.title}</span>
                        {carry && <span className="badge badge-warn">{t('Reporté', 'Carried over')}</span>}
                      </div>
                    </td>
                    <td>{data.nameOf(task.ownerId)}</td>
                    <td style={{ color: late ? 'var(--err)' : undefined, fontWeight: late ? 600 : undefined, whiteSpace: 'nowrap' }}>
                      {task.dueDate ? shortPeriod(task.dueDate, lang) : '—'}
                    </td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(task)} aria-label={t('Supprimer', 'Delete')}>
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
