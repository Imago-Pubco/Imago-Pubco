import { useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { uid } from '@/data/db';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { useToast } from '@/components/ui';
import { notes } from '../stores';
import type { AlignNote, AlignPriority } from '../schemas';
import { errorText } from '../components/RockShared';
import { todayIso } from '../lib';
import { canTickNote, fmtDay } from './huddleLib';


/** Inline form under a priority: add a follow-up (action with assignee and due date) or a plain note. */
export function FollowUpForm({
  priority,
  huddleId,
  people,
  userName,
  onDone,
}: {
  priority: AlignPriority;
  huddleId: string;
  people: User[];
  userName: (id?: string) => string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [kind, setKind] = useState<'followup' | 'note'>('followup');
  const [text, setText] = useState('');
  const [assigneeId, setAssigneeId] = useState(priority.ownerId ?? user!.id);
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  // Assignee choices: active users, plus the priority owner even when inactive.
  const choices = useMemo(() => {
    const list = [...people];
    if (priority.ownerId && !list.some((p) => p.id === priority.ownerId)) list.push({ id: priority.ownerId, displayName: userName(priority.ownerId) } as User);
    return list;
  }, [people, priority.ownerId, userName]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    try {
      const isFollowup = kind === 'followup';
      await notes.insert({
        id: uid('note_'),
        priorityId: priority.id,
        kind,
        text: value,
        assigneeId: isFollowup ? assigneeId || null : null,
        dueDate: isFollowup && due ? due : null,
        done: false,
        huddleId,
        sourceId: null,
      });
      toast(isFollowup ? t('Suivi ajouté', 'Follow-up added') : t('Note ajoutée', 'Note added'));
      onDone();
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="align-followup-form" onSubmit={submit}>
      <div className="row row-wrap" style={{ gap: 8 }}>
        <select className="select" style={{ width: 170 }} aria-label={t('Type', 'Type')} value={kind} onChange={(e) => setKind(e.target.value as 'followup' | 'note')}>
          <option value="followup">{t('Suivi (action)', 'Follow-up (action)')}</option>
          <option value="note">{t('Note', 'Note')}</option>
        </select>
        {kind === 'followup' && (
          <>
            <select className="select" style={{ width: 200 }} aria-label={t('Responsable du suivi', 'Assignee')} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              {choices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
            <input className="input" type="date" style={{ width: 170 }} aria-label={t('Échéance', 'Due date')} min={todayIso()} value={due} onChange={(e) => setDue(e.target.value)} />
          </>
        )}
      </div>
      <textarea
        className="input"
        rows={2}
        required
        maxLength={4000}
        style={{ marginTop: 8 }}
        placeholder={kind === 'followup' ? t('Action à faire…', 'Action to take…') : t('Note…', 'Note…')}
        aria-label={t('Texte', 'Text')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn btn-sm" onClick={onDone}>
          {t('Annuler', 'Cancel')}
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>
          {t('Ajouter', 'Add')}
        </button>
      </div>
    </form>
  );
}

/** One follow-up or note with its done checkbox (enabled for its author, its assignee and priority managers). */
export function FollowUpItem({
  note,
  userName,
  priorityTitle,
  showDue = true,
}: {
  note: AlignNote;
  userName: (id?: string) => string;
  priorityTitle?: string;
  showDue?: boolean;
}) {
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const canTick = canTickNote(note, user!.id, can('align.priorities.manage'));
  const overdue = !note.done && !!note.dueDate && note.dueDate < todayIso();

  async function toggle(done: boolean) {
    setBusy(true);
    try {
      await notes.update(note.id, { done });
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className={`align-followup-item${note.done ? ' is-done' : ''}`}>
      <input type="checkbox" checked={note.done} disabled={!canTick || busy} onChange={(e) => void toggle(e.target.checked)} aria-label={t('Fait', 'Done')} />
      <span className="stack" style={{ gap: 2, minWidth: 0 }}>
        <span className="align-followup-text">{note.text}</span>
        <span className="small muted">
          {priorityTitle && <>{priorityTitle} · </>}
          {note.assigneeId ? userName(note.assigneeId) : t('Sans responsable', 'No assignee')}
          {showDue && note.dueDate && (
            <>
              {' · '}
              <span style={overdue ? { color: 'var(--err)', fontWeight: 600 } : undefined}>
                {t('échéance', 'due')} {fmtDay(note.dueDate, lang)}
              </span>
            </>
          )}
          {note.kind === 'note' && <> · {t('note', 'note')}</>}
        </span>
      </span>
    </label>
  );
}
