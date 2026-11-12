import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Plus, Send } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCollection, uid } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader, useToast } from '@/components/ui';
import { addWeeks, periodLabel } from '../../lib';
import { addDays, fmtHours, iso, mondayOf, parseDate, round2, thisWeek, weekDays, weeklyHoursOf } from '../lib';
import { projects, pmTasks, staff, timeEntries } from '../stores';
import type { EntryStatus, PmTask, Project, TimeEntry } from '../schemas';
import { TimerBar } from '../Timesheet.timer';
import { CellDetailModal } from '../Timesheet.detail';
import { TimesheetGrid, type GridRow } from '../Timesheet.grid';
import {
  ENTRY_STATUS_COLOR,
  MAX_HOURS_PER_DAY,
  canBook,
  dateLabel,
  entryTotal,
  errMsg,
  hoursText,
  isLocked,
  parseHours,
  rowKeyOf,
  settleAll,
  statusText,
  type RowRef,
} from '../Timesheet.helpers';

const NO_ROWS: RowRef[] = [];
const STATUSES: EntryStatus[] = ['draft', 'submitted', 'approved', 'rejected'];
const DAY_MS = 86_400_000;
const byCode = (a: Project, b: Project) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name);
const byName = (a: PmTask, b: PmTask) => a.name.localeCompare(b.name);

/** Creates one draft entry (server: billable and rate come from the task). */
const insertEntry = (userId: string, ref: RowRef, date: string, hours: number, note = '') =>
  timeEntries.insert({
    id: uid('te_'),
    userId,
    projectId: ref.projectId,
    taskId: ref.taskId,
    date,
    hours,
    note,
    billable: false,
    rate: 0,
    status: 'draft',
    reviewNote: '',
  });

/** The signed-in person's week: enter hours per project/task and day, submit the week, timer, copy last week. */
export function Timesheet() {
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const meId = user?.id ?? '';
  const canManage = can('tools.pm.manage');
  const { rows: entries, loading } = useCollection(timeEntries);
  const { rows: projectRows } = useCollection(projects);
  const { rows: taskRows } = useCollection(pmTasks);
  const { rows: staffRows } = useCollection(staff);
  const { rows: userRows } = useCollection(users);

  const [week, setWeek] = useState(thisWeek);
  const [picked, setPicked] = useState('');
  const target = canManage && picked ? picked : meId;
  // Lines added by hand live for one week and one person; they are dropped when either changes.
  const scope = `${week}|${target}`;
  const [extra, setExtra] = useState<{ scope: string; rows: RowRef[] }>({ scope: '', rows: NO_ROWS });
  const extraRows = extra.scope === scope ? extra.rows : NO_ROWS;
  const [detail, setDetail] = useState<{ rowKey: string; date: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [addProject, setAddProject] = useState('');
  const [addTask, setAddTask] = useState('');

  const dates = useMemo(() => weekDays(week), [week]);
  const dateSet = useMemo(() => new Set(dates), [dates]);
  const projectById = useMemo(() => new Map(projectRows.map((p) => [p.id, p])), [projectRows]);
  const taskById = useMemo(() => new Map(taskRows.map((x) => [x.id, x])), [taskRows]);
  const weekEntries = useMemo(() => entries.filter((e) => e.userId === target && dateSet.has(e.date)), [entries, target, dateSet]);
  const choices = useMemo(() => projectRows.filter((p) => canBook(p, target)).sort(byCode), [projectRows, target]);
  const myChoices = useMemo(() => projectRows.filter((p) => canBook(p, meId)).sort(byCode), [projectRows, meId]);
  const people = useMemo(() => userRows.filter((u) => u.active).sort((a, b) => a.displayName.localeCompare(b.displayName)), [userRows]);
  const nameOf = (id: string) => userRows.find((u) => u.id === id)?.displayName ?? id;
  const capacity = weeklyHoursOf(staffRows.find((s) => s.id === target));
  const weekTotal = entryTotal(weekEntries);
  const toSubmit = weekEntries.filter((e) => e.status === 'draft' || e.status === 'rejected');

  const dayTotalOf = (userId: string, date: string) => entryTotal(entries.filter((e) => e.userId === userId && e.date === date));
  const byStatus = (s: EntryStatus) => entryTotal(weekEntries.filter((e) => e.status === s));
  const overDays = dates.filter((d) => dayTotalOf(target, d) > MAX_HOURS_PER_DAY);

  const rows = useMemo<GridRow[]>(() => {
    const map = new Map<string, GridRow>();
    const ensure = (ref: RowRef): GridRow => {
      const key = rowKeyOf(ref);
      let row = map.get(key);
      if (!row) {
        const p = projectById.get(ref.projectId);
        const task = ref.taskId ? taskById.get(ref.taskId) : undefined;
        row = {
          key,
          ref,
          code: p?.code ?? '',
          projectName: p?.name ?? t('Projet introuvable', 'Project not found'),
          color: p?.color ?? '',
          taskName: ref.taskId ? (task?.name ?? t('Tâche introuvable', 'Task not found')) : null,
          entries: [],
          bookable: !!p && canBook(p, target),
        };
        map.set(key, row);
      }
      return row;
    };
    for (const e of weekEntries) ensure({ projectId: e.projectId, taskId: e.taskId }).entries.push(e);
    for (const r of extraRows) ensure(r);
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code) || a.projectName.localeCompare(b.projectName) || (a.taskName ?? '').localeCompare(b.taskName ?? ''));
    // t changes identity on each provider render: recomputing is cheap.
  }, [weekEntries, extraRows, projectById, taskById, target, t]);

  // Add-a-line form: the selected project and task, falling back to the first choice.
  const addPid = choices.some((p) => p.id === addProject) ? addProject : (choices[0]?.id ?? '');
  const addTasks = taskRows.filter((x) => x.projectId === addPid).sort(byName);
  const addTid = addTasks.some((x) => x.id === addTask) ? addTask : '';

  const fail = (msg: string) => {
    toast(msg, 'err');
    return false;
  };

  /** Upserts the single entry of a cell: a value creates or updates it, 0 or empty deletes it. */
  const saveCell = async (row: GridRow, date: string, raw: string): Promise<boolean> => {
    const parsed = parseHours(raw);
    if (parsed.kind === 'invalid') return fail(t('Saisissez des heures : 1,5 ou 1:30', 'Enter hours: 1.5 or 1:30'));
    if (parsed.kind === 'max') return fail(t('Maximum 24 h par entrée', 'Maximum 24 h per entry'));
    const value = parsed.kind === 'value' ? parsed.value : 0;
    const cell = row.entries.filter((e) => e.date === date);
    const others = dayTotalOf(target, date) - entryTotal(cell);
    if (value > 0 && others + value > MAX_HOURS_PER_DAY) return fail(t('Une journée ne peut pas dépasser 24 h', 'A day cannot exceed 24 h'));
    const existing = cell[0];
    try {
      if (value === 0) {
        if (existing) await timeEntries.remove(existing.id);
      } else if (existing) {
        if (existing.hours !== value) await timeEntries.update(existing.id, { hours: value });
      } else {
        await insertEntry(target, row.ref, date, value);
      }
      return true;
    } catch (e) {
      return fail(errMsg(e));
    }
  };

  const saveEntry = async (e: TimeEntry, hours: number, note: string): Promise<boolean> => {
    const patch: Partial<TimeEntry> = {};
    if (hours !== e.hours) patch.hours = hours;
    if (note !== e.note) patch.note = note;
    if (!Object.keys(patch).length) return true;
    try {
      await timeEntries.update(e.id, patch);
      return true;
    } catch (err) {
      return fail(errMsg(err));
    }
  };

  const deleteEntry = async (e: TimeEntry): Promise<boolean> => {
    try {
      await timeEntries.remove(e.id);
      return true;
    } catch (err) {
      return fail(errMsg(err));
    }
  };

  const addEntryTo = async (ref: RowRef, date: string, hours: number, note: string): Promise<boolean> => {
    try {
      await insertEntry(target, ref, date, hours, note);
      return true;
    } catch (err) {
      return fail(errMsg(err));
    }
  };

  /** Runs the writes in parallel, toasts the result and returns the count of successes. */
  const runAll = async (ops: Array<() => Promise<unknown>>, okMsg: (n: number) => string) => {
    setBusy(true);
    const res = await settleAll(ops);
    setBusy(false);
    if (res.ok) toast(okMsg(res.ok), 'ok');
    if (res.error) toast(res.error, 'err');
    return res;
  };

  const submitWeek = () => {
    if (!toSubmit.length) return;
    const n = toSubmit.length;
    if (
      !window.confirm(
        t(
          `Soumettre ${n} entrée(s), soit ${hoursText(entryTotal(toSubmit))} h ? Elles seront verrouillées jusqu'à leur approbation ou leur reprise.`,
          `Submit ${n} entries (${hoursText(entryTotal(toSubmit))} h)? They will be locked until approved or taken back.`,
        ),
      )
    )
      return;
    void runAll(
      toSubmit.map((e) => () => timeEntries.update(e.id, { status: 'submitted' })),
      (k) => t(`${k} entrée(s) soumise(s)`, `${k} entries submitted`),
    );
  };

  const resumeRow = (row: GridRow) => {
    const subs = row.entries.filter((e) => e.status === 'submitted');
    if (!subs.length) return;
    void runAll(
      subs.map((e) => () => timeEntries.update(e.id, { status: 'draft' })),
      (k) => t(`${k} entrée(s) repassée(s) en brouillon`, `${k} entries back to draft`),
    );
  };

  const removeEmptyRow = (row: GridRow) => setExtra({ scope, rows: extraRows.filter((r) => rowKeyOf(r) !== row.key) });

  const addLine = () => {
    if (!addPid) return;
    const ref: RowRef = { projectId: addPid, taskId: addTid || null };
    if (rows.some((r) => r.key === rowKeyOf(ref))) {
      toast(t('Cette ligne est déjà dans la semaine', 'This line is already in the week'), 'err');
      return;
    }
    setExtra({ scope, rows: [...extraRows, ref] });
  };

  /** Draft entries for last week's lines and days, skipping cells that already hold time. */
  const copyPrevious = async () => {
    const prevStart = addWeeks(week, -1);
    const prevEnd = addDays(prevStart, 6);
    const prev = entries.filter((e) => e.userId === target && e.date >= prevStart && e.date <= prevEnd && e.status !== 'rejected');
    if (!prev.length) {
      toast(t('Aucune saisie la semaine précédente.', 'No time last week.'), 'err');
      return;
    }
    const plan = new Map<string, { ref: RowRef; date: string; hours: number }>();
    for (const e of prev) {
      const date = addDays(week, Math.round((parseDate(e.date).getTime() - parseDate(prevStart).getTime()) / DAY_MS));
      const ref: RowRef = { projectId: e.projectId, taskId: e.taskId };
      const key = `${rowKeyOf(ref)}|${date}`;
      plan.set(key, { ref, date, hours: (plan.get(key)?.hours ?? 0) + e.hours });
    }
    const occupied = new Set(weekEntries.map((e) => `${rowKeyOf({ projectId: e.projectId, taskId: e.taskId })}|${e.date}`));
    const running = new Map(dates.map((d) => [d, dayTotalOf(target, d)]));
    let created = 0;
    let skipped = 0;
    setBusy(true);
    try {
      for (const [key, item] of plan) {
        const p = projectById.get(item.ref.projectId);
        const dayNow = running.get(item.date) ?? 0;
        const allowed = !!p && canBook(p, target) && (!item.ref.taskId || taskById.has(item.ref.taskId));
        if (!allowed || occupied.has(key) || dayNow + item.hours > MAX_HOURS_PER_DAY) {
          skipped++;
          continue;
        }
        await insertEntry(target, item.ref, item.date, round2(item.hours));
        running.set(item.date, dayNow + item.hours);
        created++;
      }
      if (created) toast(t(`${created} entrée(s) copiée(s)`, `${created} entries copied`), 'ok');
      if (skipped) toast(t(`${skipped} ligne(s) ignorée(s) : déjà saisie, projet fermé ou journée pleine`, `${skipped} line(s) skipped: already filled, closed project or full day`), 'err');
      if (!created && !skipped) toast(t('Rien à copier', 'Nothing to copy'), 'err');
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  /** Timer stop: adds the rounded hours to today, merging into today's single draft entry on that line. */
  const stopTimer = async (projectId: string, taskId: string | null, hours: number): Promise<boolean> => {
    const today = iso(new Date());
    if (dayTotalOf(meId, today) + hours > MAX_HOURS_PER_DAY) return fail(t('Cette saisie dépasserait 24 h pour aujourd’hui', 'This would take today over 24 h'));
    const same = entries.filter((e) => e.userId === meId && e.date === today && e.projectId === projectId && e.taskId === taskId);
    try {
      if (same.length === 1 && !isLocked(same[0])) await timeEntries.update(same[0].id, { hours: round2(same[0].hours + hours) });
      else await insertEntry(meId, { projectId, taskId }, today, hours);
      toast(t(`${hoursText(hours)} h ajoutées à aujourd’hui`, `${hoursText(hours)} h added to today`), 'ok');
      return true;
    } catch (e) {
      return fail(errMsg(e));
    }
  };

  const detailRow = detail ? rows.find((r) => r.key === detail.rowKey) : undefined;
  const detailCell = detailRow && detail ? detailRow.entries.filter((e) => e.date === detail.date) : [];

  return (
    <Page>
      <PageHeader
        eyebrow={t('Outils · Gestion de projet', 'Tools · Project management')}
        title={t('Feuille de temps', 'Timesheet')}
        subtitle={target === meId ? t('Votre semaine', 'Your week') : t(`Semaine de ${nameOf(target)}`, `${nameOf(target)}’s week`)}
      />

      <div className="row row-wrap" style={{ gap: 8, alignItems: 'center', marginBottom: 16, justifyContent: 'space-between' }}>
        <div className="row row-wrap" style={{ gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setWeek((w) => addWeeks(w, -1))} aria-label={t('Semaine précédente', 'Previous week')}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ minWidth: 190, textAlign: 'center', fontWeight: 600 }}>{periodLabel(week, 'weekly', lang)}</div>
          <button className="btn btn-ghost btn-icon" onClick={() => setWeek((w) => addWeeks(w, 1))} aria-label={t('Semaine suivante', 'Next week')}>
            <ChevronRight size={18} />
          </button>
          <button className="btn btn-sm" onClick={() => setWeek(thisWeek())}>
            {t('Cette semaine', 'This week')}
          </button>
          <input
            type="date"
            className="input input-sm"
            style={{ width: 160 }}
            value={week}
            onChange={(e) => e.target.value && setWeek(mondayOf(e.target.value))}
            aria-label={t('Aller à la semaine du', 'Go to the week of')}
          />
        </div>
        {canManage && (
          <label className="field" style={{ minWidth: 240 }}>
            <span>{t('Personne', 'Person')}</span>
            <select className="select" value={target} onChange={(e) => setPicked(e.target.value === meId ? '' : e.target.value)}>
              {people.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
              {!people.some((u) => u.id === target) && <option value={target}>{nameOf(target)}</option>}
            </select>
          </label>
        )}
      </div>

      {target === meId && <TimerBar choices={myChoices} tasks={taskRows} projectById={projectById} onStop={stopTimer} />}

      {overDays.length > 0 && (
        <div className="alert alert-err" style={{ marginBottom: 16 }}>
          {t(
            `Plus de 24 h saisies le : ${overDays.map((d) => dateLabel(d, lang)).join(', ')}. Une journée ne peut pas dépasser 24 h.`,
            `More than 24 h entered on: ${overDays.map((d) => dateLabel(d, lang)).join(', ')}. A day cannot exceed 24 h.`,
          )}
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row row-wrap" style={{ alignItems: 'center', gap: 16, justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 280px', minWidth: 240 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small muted">{t('Semaine', 'Week')}</span>
              <strong>
                {fmtHours(weekTotal)} / {fmtHours(capacity)}
              </strong>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-sunken)', overflow: 'hidden', marginTop: 6 }} role="progressbar" aria-valuenow={Math.round(weekTotal)} aria-valuemin={0} aria-valuemax={capacity}>
              <div
                style={{
                  width: `${capacity > 0 ? Math.min(100, (weekTotal / capacity) * 100) : 0}%`,
                  height: '100%',
                  background: weekTotal > capacity ? 'var(--warn)' : 'var(--accent)',
                }}
              />
            </div>
            <div className="small faint" style={{ marginTop: 4 }}>
              {t(`Capacité hebdomadaire : ${fmtHours(capacity)}`, `Weekly capacity: ${fmtHours(capacity)}`)}
            </div>
          </div>
          <div className="row row-wrap" style={{ gap: 8 }}>
            {STATUSES.map((s) => (
              <span key={s} className="badge" style={{ color: ENTRY_STATUS_COLOR[s], borderColor: ENTRY_STATUS_COLOR[s] }}>
                {statusText(s, lang)} · {fmtHours(byStatus(s))}
              </span>
            ))}
          </div>
        </div>
      </div>

      {loading && <p className="faint small">{t('Chargement…', 'Loading…')}</p>}
      <TimesheetGrid
        dates={dates}
        rows={rows}
        onSave={saveCell}
        onOpen={(row, date) => setDetail({ rowKey: row.key, date })}
        onResume={resumeRow}
        onRemoveEmpty={removeEmptyRow}
      />

      <div className="row row-wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16, gap: 12 }}>
        <form
          className="row row-wrap"
          style={{ gap: 8, alignItems: 'flex-end' }}
          onSubmit={(e) => {
            e.preventDefault();
            addLine();
          }}
        >
          <label className="field" style={{ minWidth: 240 }}>
            <span>{t('Projet', 'Project')}</span>
            <select className="select" value={addPid} onChange={(e) => setAddProject(e.target.value)} disabled={choices.length === 0}>
              {choices.length === 0 && <option value="">{t('Aucun projet ouvert', 'No open project')}</option>}
              {choices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ minWidth: 180 }}>
            <span>{t('Tâche', 'Task')}</span>
            <select className="select" value={addTid} onChange={(e) => setAddTask(e.target.value)} disabled={!addPid}>
              <option value="">{t('Sans tâche', 'No task')}</option>
              {addTasks.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit" disabled={!addPid || busy}>
            <Plus size={14} /> {t('Ajouter une ligne', 'Add a line')}
          </button>
        </form>
        <div className="row row-wrap" style={{ gap: 8 }}>
          <button className="btn" onClick={() => void copyPrevious()} disabled={busy}>
            <Copy size={14} /> {t('Copier la semaine précédente', 'Copy last week')}
          </button>
          <button className="btn btn-primary" onClick={submitWeek} disabled={busy || toSubmit.length === 0}>
            <Send size={14} /> {t('Soumettre la semaine', 'Submit week')}
            {toSubmit.length > 0 && ` (${hoursText(entryTotal(toSubmit))} h)`}
          </button>
        </div>
      </div>
      <p className="small faint" style={{ marginTop: 12 }}>
        {t(
          'Une case vide ou à 0 supprime l’entrée. Le temps soumis ou approuvé est verrouillé. Le temps rejeté se corrige puis se soumet à nouveau.',
          'An empty or zero cell deletes the entry. Submitted or approved time is locked. Rejected time can be corrected and submitted again.',
        )}
      </p>

      {detailRow && detail && (
        <CellDetailModal
          open
          onClose={() => setDetail(null)}
          title={`${detailRow.code ? `${detailRow.code} · ` : ''}${detailRow.projectName} · ${detailRow.taskName ?? t('Sans tâche', 'No task')}`}
          date={detail.date}
          entries={detailCell}
          dayOthers={dayTotalOf(target, detail.date) - entryTotal(detailCell)}
          canAdd={detailRow.bookable}
          onSave={saveEntry}
          onDelete={deleteEntry}
          onAdd={(hours, note) => addEntryTo(detailRow.ref, detail.date, hours, note)}
        />
      )}
    </Page>
  );
}
