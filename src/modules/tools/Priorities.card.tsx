import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown, Pencil, Plus } from 'lucide-react';
import { uid } from '@/data/db';
import type { User } from '@/data/types';
import { useToast } from '@/components/ui';
import { useI18n } from '@/i18n';
import { Avatar } from '@/modules/admin/pages/Users';
import { STATUS_COLOR, iso, shortPeriod } from './lib';
import type { Priority, PriorityUpdate, Status, Task, Team } from './schemas';
import { tasks } from './stores';

type NameOf = (id?: string) => string;

interface CardProps {
  priority: Priority;
  team: Team | undefined;
  /** Visible sub-priorities of this priority. */
  subs: Priority[];
  tasksBy: Map<string, Task[]>;
  updatesBy: Map<string, PriorityUpdate[]>;
  people: User[];
  userName: NameOf;
  currentUserId: string;
  onEdit: (p: Priority) => void;
  onAddSub: (p: Priority) => void;
}

/** One top-level priority: a summary line that expands to its details, sub-priorities, tasks and weekly history. */
export function PriorityCard(props: CardProps) {
  const { priority: p, team, subs, tasksBy, updatesBy, people, userName, currentUserId, onEdit, onAddSub } = props;
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const own = tasksBy.get(p.id) ?? [];
  const doneCount = own.filter((x) => x.done).length;
  const toggle = () => setOpen((o) => !o);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div className="card" style={{ display: 'flex', opacity: p.archived ? 0.6 : 1 }}>
      <div style={{ width: 5, flexShrink: 0, background: STATUS_COLOR[p.status], borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div
            role="button"
            tabIndex={0}
            aria-expanded={open}
            onClick={toggle}
            onKeyDown={onKey}
            style={{ flex: 1, minWidth: 0, padding: '14px 0 14px 16px', cursor: 'pointer' }}
          >
            <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <ChevronDown size={18} color="var(--text-3)" style={{ flexShrink: 0, marginTop: 2, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div className="row row-wrap" style={{ gap: 8 }}>
                  <strong style={{ fontSize: 15 }}>{p.title}</strong>
                  <TeamBadge team={team} company={p.company} />
                  {p.archived && <span className="badge">{t('Archivée', 'Archived')}</span>}
                </div>
                <div className="row row-wrap small muted" style={{ gap: 14, marginTop: 6 }}>
                  {p.ownerId && (
                    <span className="row" style={{ gap: 6 }}>
                      <Avatar name={userName(p.ownerId)} size={22} />
                      {userName(p.ownerId)}
                    </span>
                  )}
                  <span>{t(`${doneCount}/${own.length} tâche(s)`, `${doneCount}/${own.length} task(s)`)}</span>
                </div>
              </div>
              <div style={{ flex: '0 1 170px', minWidth: 140, marginTop: 4 }}>
                <ProgressBar value={p.progress} status={p.status} />
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            style={{ margin: '10px 10px 0 0', flexShrink: 0 }}
            onClick={() => onEdit(p)}
            aria-label={t('Modifier', 'Edit')}
            title={t('Modifier', 'Edit')}
          >
            <Pencil size={15} />
          </button>
        </div>

        {open && (
          <div className="stack" style={{ gap: 18, padding: '16px 20px 20px', borderTop: '1px solid var(--border)' }}>
            {p.description && <p className="muted small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{p.description}</p>}

            <Section
              title={t('Sous-priorités', 'Sub-priorities')}
              action={
                <button type="button" className="btn btn-sm" onClick={() => onAddSub(p)}>
                  <Plus size={14} /> {t('Sous-priorité', 'Sub-priority')}
                </button>
              }
            >
              {subs.length ? (
                <div className="stack" style={{ gap: 6 }}>
                  {subs.map((s) => (
                    <SubRow key={s.id} sub={s} tasks={tasksBy.get(s.id) ?? []} userName={userName} onEdit={onEdit} />
                  ))}
                </div>
              ) : (
                <p className="faint small" style={{ margin: 0 }}>{t('Aucune sous-priorité.', 'No sub-priority.')}</p>
              )}
            </Section>

            <Section title={t('Tâches', 'Tasks')}>
              <TaskList tasks={own} userName={userName} />
              <AddTaskRow priorityId={p.id} people={people} currentUserId={currentUserId} />
            </Section>

            <Section title={t('Progression hebdomadaire', 'Weekly progress')}>
              <WeeklyGrid updates={updatesBy.get(p.id) ?? []} />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProgressBar({ value, status }: { value: number; status: Status }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-sunken)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: STATUS_COLOR[status] }} />
      </div>
      <span className="small mono" style={{ width: 40, textAlign: 'right' }}>{value}%</span>
    </div>
  );
}

function TeamBadge({ team, company }: { team: Team | undefined; company: boolean }) {
  const { t } = useI18n();
  if (company) return <span className="badge badge-accent">{t('Entreprise', 'Company')}</span>;
  if (!team) return null;
  return (
    <span className="badge" style={{ background: `color-mix(in srgb, ${team.color} 16%, transparent)`, color: team.color }}>
      {team.name}
    </span>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="stack" style={{ gap: 8 }}>
      <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
        <span className="label">{title}</span>
        {action}
      </div>
      {children}
    </section>
  );
}

function SubRow({ sub, tasks: own, userName, onEdit }: { sub: Priority; tasks: Task[]; userName: NameOf; onEdit: (p: Priority) => void }) {
  const { t } = useI18n();
  const done = own.filter((x) => x.done).length;
  const edit = () => onEdit(sub);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={edit}
      onKeyDown={(e) => e.key === 'Enter' && edit()}
      className="row row-wrap"
      style={{
        gap: 12,
        padding: '8px 12px',
        borderLeft: `3px solid ${STATUS_COLOR[sub.status]}`,
        background: 'var(--bg-sunken)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        opacity: sub.archived ? 0.6 : 1,
      }}
    >
      <span style={{ flex: '1 1 200px', minWidth: 0 }}>{sub.title}</span>
      <span className="small muted">{userName(sub.ownerId ?? undefined)}</span>
      <span style={{ width: 160 }}>
        <ProgressBar value={sub.progress} status={sub.status} />
      </span>
      <span className="small faint">{t(`${done}/${own.length} tâche(s)`, `${done}/${own.length} task(s)`)}</span>
    </div>
  );
}

function TaskList({ tasks: list, userName }: { tasks: Task[]; userName: NameOf }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const today = iso(new Date());
  const sorted = [...list].sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));

  const toggle = async (task: Task) => {
    try {
      await tasks.update(task.id, task.done ? { done: false, doneAt: null } : { done: true, doneAt: new Date().toISOString() });
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    }
  };

  if (!sorted.length) return <p className="faint small" style={{ margin: 0 }}>{t('Aucune tâche.', 'No task.')}</p>;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {sorted.map((task) => {
        const late = !task.done && !!task.dueDate && task.dueDate < today;
        return (
          <li key={task.id} className="row" style={{ alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <input
              type="checkbox"
              checked={task.done}
              aria-label={task.title}
              onChange={() => void toggle(task)}
              style={{ accentColor: 'var(--accent)', width: 16, height: 16, marginTop: 3, flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ textDecoration: task.done ? 'line-through' : undefined, color: task.done ? 'var(--text-3)' : undefined }}>{task.title}</div>
              <div className="faint small">{userName(task.ownerId ?? undefined)}</div>
            </div>
            {task.dueDate && (
              <span className={`badge ${late ? 'badge-err' : ''}`}>
                {t('Échéance', 'Due')} {shortPeriod(task.dueDate, lang)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AddTaskRow({ priorityId, people, currentUserId }: { priorityId: string; people: User[]; currentUserId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const name = title.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await tasks.insert({ id: uid('tk_'), title: name, ownerId, dueDate: due || null, done: false, doneAt: null, priorityId, huddleId: null, week: null });
      setTitle('');
      setDue('');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="row row-wrap"
      style={{ gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <input
        className="input input-sm"
        style={{ flex: '1 1 220px', width: 'auto' }}
        placeholder={t('Nouvelle tâche…', 'New task…')}
        maxLength={300}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <select className="select input-sm" style={{ width: 170 }} aria-label={t('Responsable', 'Owner')} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
        {people.map((u) => (
          <option key={u.id} value={u.id}>{u.displayName}</option>
        ))}
      </select>
      <input type="date" className="input input-sm" style={{ width: 150 }} aria-label={t('Échéance', 'Due date')} value={due} onChange={(e) => setDue(e.target.value)} />
      <button type="submit" className="btn btn-sm" disabled={!title.trim() || busy}>
        <Plus size={14} /> {t('Ajouter', 'Add')}
      </button>
    </form>
  );
}

function WeeklyGrid({ updates }: { updates: PriorityUpdate[] }) {
  const { t, lang } = useI18n();
  if (!updates.length) {
    return <p className="faint small" style={{ margin: 0 }}>{t('Aucune mise à jour hebdomadaire pour l’instant.', 'No weekly update yet.')}</p>;
  }
  const cols = [...updates].sort((a, b) => a.week.localeCompare(b.week)).slice(-14);
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
      {cols.map((u) => {
        const color = STATUS_COLOR[u.status];
        return (
          <div key={u.id} title={`${shortPeriod(u.week, lang)} · ${u.progress} %${u.note ? ` — ${u.note}` : ''}`} style={{ minWidth: 60, textAlign: 'center' }}>
            <div className="faint small" style={{ whiteSpace: 'nowrap' }}>{shortPeriod(u.week, lang)}</div>
            <div
              style={{
                marginTop: 4,
                height: 36,
                borderRadius: 'var(--radius-sm)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 600,
                fontSize: 13,
                color,
                background: `color-mix(in srgb, ${color} 18%, transparent)`,
              }}
            >
              {u.progress}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
