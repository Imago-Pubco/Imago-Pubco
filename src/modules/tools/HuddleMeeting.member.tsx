/** Round table: one collapsible card per member with their check-in fields and priority progress. */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import type { User } from '@/data/types';
import { Avatar } from '@/modules/admin/pages/Users';
import { useI18n } from '@/i18n';
import { useToast } from '@/components/ui';
import { addWeeks, formatValue, huddleEntryId, priorityUpdateId, shortPeriod, STATUS_COLOR } from './lib';
import { huddleEntries, priorities, priorityUpdates } from './stores';
import type { HuddleEntry, Priority, Status } from './schemas';
import { entryOf, memberPriorities, parseProgress, statusLabel, type MeetingData } from './HuddleMeeting.data';
import { useRun } from './HuddleMeeting.ui';

type TextField = 'whatsUp' | 'feedback' | 'help' | 'stucks';

export function MemberCard({ data, member, open, onToggle }: { data: MeetingData; member: User; open: boolean; onToggle: () => void }) {
  const { t, lang } = useI18n();
  const mine = member.id === data.me;
  const editable = mine || data.huddle.ownerId === data.me;
  const prios = memberPriorities(data, member.id);
  const avg = prios.length ? prios.reduce((s, p) => s + p.progress, 0) / prios.length : null;
  const openTasks = data.tasks.filter((task) => task.ownerId === member.id && !task.done).length;

  const toggleByKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <section className="card" style={{ marginBottom: 16, borderColor: mine ? 'var(--accent)' : undefined, boxShadow: mine ? '0 0 0 1px var(--accent)' : undefined }}>
      <div
        className="card-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={toggleByKey}
        style={{ cursor: 'pointer', borderBottom: open ? undefined : 'none' }}
      >
        <div className="row row-wrap" style={{ gap: 12, alignItems: 'center', minWidth: 0 }}>
          <Avatar name={member.displayName} size={36} />
          <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
            {member.displayName}
            {mine && <span className="badge badge-accent" style={{ marginLeft: 8 }}>{t('Vous', 'You')}</span>}
          </div>
          {avg !== null && (
            <span className="badge">
              {t('Progrès moyen', 'Average progress')} : {formatValue(Math.round(avg), '%', lang)}
            </span>
          )}
          <span className="badge">{t(`${openTasks} tâche(s) ouverte(s)`, `${openTasks} open task(s)`)}</span>
        </div>
        <ChevronDown size={18} aria-hidden style={{ flex: 'none', transform: open ? undefined : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
      </div>
      {open && (
        <div className="card-pad" style={{ display: 'grid', gap: 18 }}>
          {data.huddle.personalSections.length === 0 && (
            <p className="faint small" style={{ margin: 0 }}>
              {t('Aucune section personnelle.', 'No personal sections.')}
            </p>
          )}
          {data.huddle.personalSections.map((section) =>
            section === 'priorityProgress' ? (
              <PriorityProgress key={section} data={data} member={member} mine={mine} />
            ) : (
              <EntryField key={section} data={data} userId={member.id} field={section} editable={editable} />
            ),
          )}
        </div>
      )}
    </section>
  );
}

/** Creates or updates one check-in document. The server keys it by huddle, week and person. */
async function saveEntryField(data: MeetingData, userId: string, field: TextField, text: string) {
  const id = huddleEntryId(data.huddle.id, data.week, userId);
  const existing = await huddleEntries.get(id);
  if (existing) {
    const patch: Partial<HuddleEntry> = {};
    patch[field] = text;
    await huddleEntries.update(id, patch);
    return;
  }
  const values = { whatsUp: '', feedback: '', help: '', stucks: '' };
  values[field] = text;
  try {
    await huddleEntries.insert({ id, huddleId: data.huddle.id, week: data.week, userId, ...values });
  } catch {
    // Another field of the same check-in was created meanwhile: update it instead.
    const patch: Partial<HuddleEntry> = {};
    patch[field] = text;
    await huddleEntries.update(id, patch);
  }
}

/** A labelled text field of one check-in. Editable by the person and the huddle owner, saved after a pause or on blur. */
function EntryField({ data, userId, field, editable }: { data: MeetingData; userId: string; field: TextField; editable: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const id = useId();
  const remote = entryOf(data, userId)?.[field] ?? '';
  const [draft, setDraft] = useState(remote);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const latest = useRef(remote);
  const lastSaved = useRef(remote);
  const dirty = useRef(false);
  const pending = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const labels: Record<TextField, string> = {
    whatsUp: t('Quoi de neuf', "What's up"),
    feedback: t('Rétroaction', 'Feedback'),
    help: t("Besoin d'aide", 'Help needed'),
    stucks: t('Blocages', 'Stuck'),
  };

  // Take the saved text unless the person is typing in this field.
  useEffect(() => {
    lastSaved.current = remote;
    if (!dirty.current) {
      setDraft(remote);
      latest.current = remote;
    }
  }, [remote]);

  const commit = async (text: string) => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    pending.current = false;
    if (text === lastSaved.current) {
      if (text === latest.current) dirty.current = false;
      return;
    }
    setStatus('saving');
    try {
      await saveEntryField(data, userId, field, text);
      lastSaved.current = text;
      if (latest.current === text) dirty.current = false;
      setStatus('saved');
    } catch (e) {
      toast(e instanceof Error ? e.message : t('Erreur', 'Error'), 'err');
      setStatus('idle');
    }
  };

  // The timer and the unmount flush call the latest commit, so the closure is never stale.
  const commitRef = useRef(commit);
  commitRef.current = commit;

  // Flush a pending save when the card is closed or the screen changes.
  useEffect(
    () => () => {
      if (pending.current) void commitRef.current(latest.current);
    },
    [],
  );

  const onChange = (value: string) => {
    setDraft(value);
    latest.current = value;
    dirty.current = true;
    pending.current = true;
    setStatus('idle');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void commitRef.current(latest.current), 700);
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <label htmlFor={id} className="small" style={{ fontWeight: 600, color: 'var(--text-2)' }}>
          {labels[field]}
        </label>
        {editable && (
          <span className="faint small" aria-live="polite">
            {status === 'saving' ? t('Enregistrement…', 'Saving…') : status === 'saved' ? t('Enregistré', 'Saved') : ''}
          </span>
        )}
      </div>
      {editable ? (
        <textarea
          id={id}
          className="textarea"
          rows={2}
          maxLength={4000}
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (pending.current) void commitRef.current(latest.current);
          }}
          style={{ marginTop: 6, width: '100%' }}
        />
      ) : remote ? (
        <div id={id} style={{ whiteSpace: 'pre-wrap', marginTop: 6, overflowWrap: 'anywhere' }}>
          {remote}
        </div>
      ) : (
        <div id={id} className="faint" style={{ marginTop: 6 }}>
          —
        </div>
      )}
    </div>
  );
}

/** The member's priorities with the last six weeks of progress, and for oneself a box to record this week. */
function PriorityProgress({ data, member, mine }: { data: MeetingData; member: User; mine: boolean }) {
  const { t, lang } = useI18n();
  const prios = memberPriorities(data, member.id);
  const weeks = Array.from({ length: 6 }, (_, i) => addWeeks(data.week, i - 5));
  const byId = new Map(data.priorityUpdates.map((u) => [u.id, u]));

  return (
    <div>
      <div className="small" style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
        {t('Progression des priorités', 'Priority progress')}
      </div>
      {prios.length === 0 ? (
        <p className="faint small" style={{ margin: 0 }}>
          {t('Aucune priorité pour cette période.', 'No priorities for this period.')}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Priorité', 'Priority')}</th>
                {weeks.map((w) => (
                  <th key={w} className="num" style={{ whiteSpace: 'nowrap' }}>
                    {shortPeriod(w, lang)}
                  </th>
                ))}
                {mine && <th>{t('Cette semaine', 'This week')}</th>}
              </tr>
            </thead>
            <tbody>
              {prios.map((p) => (
                <tr key={p.id}>
                  <td style={{ minWidth: 180, overflowWrap: 'anywhere' }}>{p.title}</td>
                  {weeks.map((w) => {
                    const u = byId.get(priorityUpdateId(p.id, w));
                    return (
                      <td key={w} className="num" style={{ whiteSpace: 'nowrap' }}>
                        {u ? <span style={{ color: STATUS_COLOR[u.status], fontWeight: 600 }}>{formatValue(u.progress, '%', lang)}</span> : <span className="faint">—</span>}
                      </td>
                    );
                  })}
                  {mine && (
                    <td>
                      <PriorityWeekInput key={p.id} data={data} priority={p} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Progress and status of one priority for the viewed week. Upserts the weekly update and the priority's own values. */
function PriorityWeekInput({ data, priority }: { data: MeetingData; priority: Priority }) {
  const { t, lang } = useI18n();
  const run = useRun();
  const toast = useToast();
  const update = data.priorityUpdates.find((u) => u.id === priorityUpdateId(priority.id, data.week));
  const current = update?.progress ?? priority.progress;
  const currentStatus: Status = update?.status ?? priority.status;
  const [progress, setProgress] = useState(String(current));
  const [status, setStatus] = useState<Status>(currentStatus);

  const commit = (raw: string, next: Status) => {
    const n = parseProgress(raw);
    if (n === undefined) {
      toast(t('Progrès entre 0 et 100', 'Progress between 0 and 100'), 'err');
      setProgress(String(current));
      return;
    }
    if (n === null) {
      setProgress(String(current));
      return;
    }
    if (n === current && next === currentStatus) return;
    run(async () => {
      const id = priorityUpdateId(priority.id, data.week);
      const row = await priorityUpdates.get(id);
      if (row) await priorityUpdates.update(id, { progress: n, status: next });
      else await priorityUpdates.insert({ id, priorityId: priority.id, week: data.week, progress: n, status: next, note: '' });
      await priorities.update(priority.id, { progress: n, status: next });
    });
  };

  return (
    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        className="input input-sm"
        style={{ width: 80, textAlign: 'right' }}
        value={progress}
        aria-label={t('Progrès (%)', 'Progress (%)')}
        onChange={(e) => setProgress(e.target.value)}
        onBlur={() => commit(progress, status)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <select
        className="select"
        style={{ width: 110 }}
        value={status}
        aria-label={t('Statut', 'Status')}
        onChange={(e) => {
          const next = e.target.value as Status;
          setStatus(next);
          commit(progress, next);
        }}
      >
        {(['green', 'yellow', 'red'] as const).map((s) => (
          <option key={s} value={s}>
            {statusLabel(s, lang)}
          </option>
        ))}
      </select>
    </div>
  );
}
