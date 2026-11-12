/** The Gantt timeline of Tools → Gestion de projet → Planification: plain divs, no chart library. */
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { CalendarRange, ChevronDown, ChevronRight } from 'lucide-react';
import { Empty } from '@/components/ui';
import { useI18n } from '@/i18n';
import { addDays, parseDate } from '../lib';
import { barGeom, diffDays, initials, safeColor, taskColor, taskSpan, type ProjectRow, type Range, type UnplannedItem } from './Schedule.model';
import type { PmTask } from './schemas';

const LABEL_W = 290;
const ROW_H = 40;
const HEAD_H = 44;

export interface GanttProps {
  range: Range;
  rows: ProjectRow[];
  unplanned: UnplannedItem[];
  today: string;
  expanded: Set<string>;
  taskById: Map<string, PmTask>;
  nameOf: (id: string) => string;
  onToggle: (projectId: string) => void;
  onOpenTask: (task: PmTask) => void;
  onOpenProject: (projectId: string) => void;
}

const isWeekend = (day: string) => [0, 6].includes(parseDate(day).getDay());
const locale = (lang: string) => (lang === 'fr' ? 'fr-CA' : 'en-CA');

/** Header cells: one per day (week, month zooms) or one per month (quarter zoom). */
function headerCells(range: Range, lang: string): { key: string; label: string; width: number; weekend: boolean }[] {
  const loc = locale(lang);
  if (range.zoom === 'quarter') {
    const out: { key: string; label: string; width: number; weekend: boolean }[] = [];
    for (let i = 0; i < range.days; i++) {
      const day = addDays(range.start, i);
      const key = day.slice(0, 7);
      const last = out[out.length - 1];
      if (last && last.key === key) last.width += range.dayW;
      else out.push({ key, label: parseDate(day).toLocaleDateString(loc, { month: 'short', year: 'numeric' }), width: range.dayW, weekend: false });
    }
    return out;
  }
  return Array.from({ length: range.days }, (_, i) => {
    const day = addDays(range.start, i);
    const d = parseDate(day);
    const label = range.zoom === 'week' ? `${d.toLocaleDateString(loc, { weekday: 'short' })} ${d.getDate()}` : String(d.getDate());
    return { key: day, label, width: range.dayW, weekend: isWeekend(day) };
  });
}

/** One row: a sticky label on the left and a timeline of the window on the right. */
function Row({ range, today, label, children, indent = 0, muted = false }: { range: Range; today: string; label: ReactNode; children?: ReactNode; indent?: number; muted?: boolean }) {
  const width = range.days * range.dayW;
  const todayIdx = diffDays(range.start, today);
  const showToday = todayIdx >= 0 && todayIdx < range.days;
  return (
    <div style={{ display: 'flex', height: ROW_H, borderBottom: '1px solid var(--border)', opacity: muted ? 0.7 : 1 }}>
      <div
        style={{
          position: 'sticky',
          left: 0,
          zIndex: 2,
          width: LABEL_W,
          minWidth: LABEL_W,
          background: 'var(--bg-elev)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: `0 10px 0 ${10 + indent}px`,
          overflow: 'hidden',
        }}
      >
        {label}
      </div>
      <div
        style={{
          position: 'relative',
          width,
          minWidth: width,
          backgroundImage: `repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px ${range.dayW}px)`,
        }}
      >
        {showToday && <div title={today} style={{ position: 'absolute', top: 0, bottom: 0, left: todayIdx * range.dayW + Math.floor(range.dayW / 2), width: 2, background: 'var(--accent)', opacity: 0.55, pointerEvents: 'none' }} />}
        {children}
      </div>
    </div>
  );
}

const barStyle = (left: number, width: number, background: string): CSSProperties => ({
  position: 'absolute',
  top: 9,
  height: ROW_H - 18,
  left: left + 1,
  width: Math.max(width - 2, 6),
  borderRadius: 6,
  border: 'none',
  padding: '0 6px',
  overflow: 'hidden',
  cursor: 'pointer',
  background,
  color: 'var(--on-accent)',
  fontSize: 11,
  fontWeight: 600,
  textAlign: 'left',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
});

const textBtn: CSSProperties = {
  border: 'none',
  background: 'none',
  padding: 0,
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
};

export function Gantt(props: GanttProps) {
  const { t, lang } = useI18n();
  const { range, rows, unplanned, today, expanded, taskById, nameOf, onToggle, onOpenTask, onOpenProject } = props;
  const width = range.days * range.dayW;
  const cells = headerCells(range, lang);

  if (!rows.length && !unplanned.length) {
    return (
      <Empty icon={<CalendarRange size={40} />} title={t('Aucun projet à afficher', 'No project to show')}>
        {t('Changez les filtres ou créez un projet avec des dates.', 'Change the filters or create a project with dates.')}
      </Empty>
    );
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: LABEL_W + width }}>
          {/* Header */}
          <div style={{ display: 'flex', height: HEAD_H, borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)' }}>
            <div style={{ position: 'sticky', left: 0, zIndex: 2, width: LABEL_W, minWidth: LABEL_W, background: 'var(--bg-elev)', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', padding: '0 10px 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('Projet / tâche', 'Project / task')}
            </div>
            <div style={{ display: 'flex', width, minWidth: width }}>
              {cells.map((c) => (
                <div
                  key={c.key}
                  title={c.label}
                  style={{ width: c.width, minWidth: c.width, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 8px', overflow: 'hidden', whiteSpace: 'nowrap', textTransform: range.zoom === 'quarter' ? 'none' : undefined, background: c.weekend ? 'var(--bg-sunken)' : undefined, borderRight: '1px solid var(--border)' }}
                >
                  {c.label}
                </div>
              ))}
            </div>
          </div>

          {/* Projects and their tasks */}
          {rows.map((row) => {
            const p = row.project;
            const open = expanded.has(p.id);
            const pct = row.total ? (row.done / row.total) * 100 : 0;
            const span = p.startDate && p.endDate ? { start: p.startDate, end: p.endDate } : null;
            const geom = span ? barGeom(range, span.start, span.end) : null;
            return (
              <Fragment key={p.id}>
                <Row
                  range={range}
                  today={today}
                  label={
                    <>
                      <button type="button" className="btn btn-ghost btn-icon btn-sm" style={{ width: 22, height: 22, padding: 0, flexShrink: 0 }} aria-expanded={open} aria-label={open ? t('Replier', 'Collapse') : t('Déplier', 'Expand')} onClick={() => onToggle(p.id)}>
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: safeColor(p.color), flexShrink: 0 }} />
                      <span className="mono small" style={{ flexShrink: 0 }}>{p.code}</span>
                      <button type="button" style={{ ...textBtn, fontWeight: 600, flex: 1 }} title={row.clientName || p.name} onClick={() => onOpenProject(p.id)}>
                        {p.name}
                      </button>
                    </>
                  }
                >
                  {geom && (
                    <button type="button" title={`${p.name} · ${p.startDate} → ${p.endDate} · ${row.done}/${row.total}`} onClick={() => onOpenProject(p.id)} style={barStyle(geom.left, geom.width, safeColor(p.color))}>
                      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'rgba(255,255,255,0.35)' }} />
                      <span style={{ position: 'relative' }}>{row.total ? `${row.done}/${row.total}` : ''}</span>
                    </button>
                  )}
                  {!geom && !row.hasBar && <span className="faint small" style={{ position: 'absolute', left: 8, top: 10 }}>{t('Dates du projet non définies', 'Project dates not set')}</span>}
                </Row>

                {open &&
                  row.tasks.map((task) => {
                    const ts = taskSpan(task);
                    const tg = ts ? barGeom(range, ts.start, ts.end) : null;
                    const dep = task.dependsOnId ? taskById.get(task.dependsOnId) : undefined;
                    return (
                      <Row
                        key={task.id}
                        range={range}
                        today={today}
                        indent={22}
                        label={
                          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <button type="button" style={{ ...textBtn, fontSize: 13 }} onClick={() => onOpenTask(task)}>
                              {task.name}
                            </button>
                            {dep && (
                              <span className="faint" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {`↳ ${t('après', 'after')} : ${dep.name}`}
                              </span>
                            )}
                          </div>
                        }
                      >
                        {tg && ts && (
                          <button
                            type="button"
                            title={`${task.name} · ${ts.start} → ${ts.end} · ${task.status}${task.assigneeIds.length ? ` · ${task.assigneeIds.map(nameOf).join(', ')}` : ''}`}
                            onClick={() => onOpenTask(task)}
                            style={{ ...barStyle(tg.left, tg.width, taskColor(task, today)), top: 12, height: ROW_H - 24 }}
                          >
                            {task.assigneeIds.map((id) => initials(nameOf(id))).join(' ')}
                          </button>
                        )}
                        {!tg && <span className="faint small" style={{ position: 'absolute', left: 8, top: 11 }}>{t('Hors période', 'Outside the period')}</span>}
                      </Row>
                    );
                  })}
              </Fragment>
            );
          })}

          {/* Not planned */}
          {unplanned.length > 0 && (
            <>
              <div style={{ padding: '8px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                {t('Non planifiées', 'Unplanned')} ({unplanned.length})
              </div>
              {unplanned.map((u) => (
                <Row key={`${u.project.id}:${u.task?.id ?? ''}`} range={range} today={today} muted label={
                  <button type="button" style={{ ...textBtn, flex: 1 }} onClick={() => (u.task ? onOpenTask(u.task) : onOpenProject(u.project.id))}>
                    <span className="mono small">{u.project.code}</span> {u.task ? u.task.name : u.project.name}
                  </button>
                } />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
