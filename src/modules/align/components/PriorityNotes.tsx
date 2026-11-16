import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { useUserName } from '@/data/hooks';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { useToast } from '@/components/ui';
import { notes as alignNotes } from '../stores';
import type { AlignNote, AlignPriority } from '../schemas';
import { errorText, userOptions } from './RockShared';
import { todayIso } from '../lib';

/** Notes and follow-ups of one priority, newest first. Each one is saved on submit. */
export function PriorityNotes({ priority, people }: { priority: AlignPriority; people: User[] }) {
  const { t, fmtDate } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const userName = useUserName();
  const { rows } = useCollection(alignNotes);
  const me = user!.id;
  const manage = can('align.priorities.manage');
  const today = todayIso();

  const list = useMemo(
    () =>
      rows
        .filter((n) => n.priorityId === priority.id)
        .reverse() // insertion order is oldest first; the stable sort below keeps it for notes without createdAt
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [rows, priority.id],
  );

  const [kind, setKind] = useState<AlignNote['kind']>('note');
  const [text, setText] = useState('');
  const [assigneeId, setAssigneeId] = useState(me); // the person writing it, by default
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const assignees = userOptions(people, assigneeId);

  const add = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const isFollowup = kind === 'followup';
      await alignNotes.insert({
        id: uid('nt_'),
        priorityId: priority.id,
        kind,
        text: body,
        assigneeId: isFollowup ? assigneeId || null : null,
        dueDate: isFollowup && dueDate ? dueDate : null,
        done: false,
        huddleId: null,
        sourceId: null,
      });
      setText('');
      setDueDate('');
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const toggleDone = async (n: AlignNote, done: boolean) => {
    try {
      await alignNotes.update(n.id, { done });
    } catch (e) {
      toast(errorText(e), 'err');
    }
  };

  const remove = async (n: AlignNote) => {
    if (!window.confirm(t('Supprimer cette entrée ? Action irréversible.', 'Delete this entry? This cannot be undone.'))) return;
    try {
      await alignNotes.remove(n.id);
    } catch (e) {
      toast(errorText(e), 'err');
    }
  };

  return (
    <section className="stack" style={{ gap: 12 }}>
      <h4 className="rock-section-title">{t('Notes et suivis', 'Notes and follow-ups')}</h4>

      <div className="card-pad rock-note-form stack" style={{ gap: 10 }}>
        <div className="row row-wrap" style={{ gap: 6 }} role="group" aria-label={t('Type', 'Type')}>
          <button type="button" className={`btn btn-sm${kind === 'note' ? ' btn-primary' : ''}`} aria-pressed={kind === 'note'} onClick={() => setKind('note')}>
            {t('Note', 'Note')}
          </button>
          <button type="button" className={`btn btn-sm${kind === 'followup' ? ' btn-primary' : ''}`} aria-pressed={kind === 'followup'} onClick={() => setKind('followup')}>
            {t('Suivi (action)', 'Follow-up (action)')}
          </button>
        </div>
        <label className="field">
          <span>{kind === 'note' ? t('Note', 'Note') : t('Action à faire', 'Action to do')}</span>
          <textarea className="textarea" rows={2} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        {kind === 'followup' && (
          <div className="form-grid">
            <label className="field">
              <span>{t('Assignée à', 'Assigned to')}</span>
              <select className="select" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">{t('— Personne —', '— Nobody —')}</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('Échéance', 'Due date')}</span>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={busy || !text.trim()}>
            {kind === 'note' ? t('Ajouter la note', 'Add note') : t('Ajouter le suivi', 'Add follow-up')}
          </button>
        </div>
      </div>

      {!list.length ? (
        <p className="small muted">{t('Aucune note pour le moment.', 'No notes yet.')}</p>
      ) : (
        <div className="stack" style={{ gap: 0 }}>
          {list.map((n) => {
            const isAuthor = n.createdBy === me;
            const canTick = isAuthor || n.assigneeId === me || manage;
            const canDelete = isAuthor || manage;
            const late = n.kind === 'followup' && !n.done && !!n.dueDate && n.dueDate < today;
            return (
              <div key={n.id} className="rock-note">
                <div className="row row-wrap" style={{ gap: 8, justifyContent: 'space-between' }}>
                  <div className="row row-wrap" style={{ gap: 10 }}>
                    <span className={`badge${n.kind === 'followup' ? ' badge-accent' : ''}`}>
                      {n.kind === 'followup' ? t('Suivi', 'Follow-up') : t('Note', 'Note')}
                    </span>
                    {n.kind === 'followup' && (
                      <label className="check small">
                        <input type="checkbox" checked={n.done} disabled={!canTick} onChange={(e) => toggleDone(n, e.target.checked)} />
                        {n.done ? t('Fait', 'Done') : t('À faire', 'To do')}
                      </label>
                    )}
                    {n.kind === 'followup' && n.assigneeId && <span className="small">→ {userName(n.assigneeId)}</span>}
                    {n.kind === 'followup' && n.dueDate && (
                      <span className={`small${late ? ' rock-late' : ' muted'}`}>
                        {t('Échéance', 'Due')} {fmtDate(n.dueDate)}
                      </span>
                    )}
                  </div>
                  {canDelete && (
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t('Supprimer', 'Delete')} title={t('Supprimer', 'Delete')} onClick={() => remove(n)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="rock-note-text">{n.text}</p>
                <div className="small faint">
                  {userName(n.createdBy)}
                  {n.createdAt ? ` · ${fmtDate(n.createdAt, true)}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
