/** Person x week grid of planned hours against capacity, and the detail of one cell. */
import { Modal } from '@/components/ui';
import { Avatar } from '@/modules/admin/pages/Users';
import { useI18n } from '@/i18n';
import { addDays, parseDate } from '../lib';
import { fmtHours, pct as fmtPct, weeklyHoursOf } from './lib';
import { LEVEL_STYLE, weekLabel, type Cell, type PlannedLine } from './Workload.model';
import type { Staff, TimeOff } from './schemas';
import type { User } from '@/data/types';

export interface PersonRow {
  user: User;
  cells: Cell[];
}

export const locale = (lang: string) => (lang === 'fr' ? 'fr-CA' : 'en-CA');

/** Week range label for dialogs: "9 nov. – 15 nov. 2026". */
export function weekRangeLabel(week: string, lang: string) {
  const end = parseDate(addDays(week, 6));
  return `${weekLabel(week, lang)} – ${end.toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

interface GridProps {
  weeks: string[];
  rows: PersonRow[];
  totals: Cell[];
  pastWeeks: Set<string>;
  staffOf: (id: string) => Staff | undefined;
  onOpen: (userId: string, week: string) => void;
}

export function LoadGrid({ weeks, rows, totals, pastWeeks, staffOf, onOpen }: GridProps) {
  const { t, lang } = useI18n();
  return (
    <div>
      <div className="table-wrap card" style={{ padding: 0 }}>
        <table className="table" style={{ minWidth: 220 + weeks.length * 118 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: 'var(--bg-elev)', zIndex: 1, minWidth: 220 }}>{t('Personne', 'Person')}</th>
              {weeks.map((w) => (
                <th key={w} style={{ textAlign: 'center' }}>
                  {weekLabel(w, lang)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={weeks.length + 1} className="muted" style={{ textAlign: 'center' }}>
                  {t('Aucune personne active à afficher.', 'No active person to show.')}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const s = staffOf(r.user.id);
              return (
                <tr key={r.user.id}>
                  <td style={{ position: 'sticky', left: 0, background: 'var(--bg-elev)', zIndex: 1 }}>
                    <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                      <Avatar name={r.user.displayName} size={30} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.user.displayName}</div>
                        <div className="faint small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s?.title ? `${s.title} · ` : ''}
                          {fmtHours(weeklyHoursOf(s))} {t('/ sem.', '/ wk')}
                        </div>
                      </div>
                    </div>
                  </td>
                  {weeks.map((w, i) => (
                    <td key={w} style={{ padding: 4 }}>
                      <CellButton cell={r.cells[i]} past={pastWeeks.has(w)} onClick={() => onOpen(r.user.id, w)} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--bg-elev)', zIndex: 1 }}>{t('Équipe', 'Team')}</th>
                {totals.map((c, i) => (
                  <td key={weeks[i]} style={{ padding: 4 }}>
                    <CellBody cell={c} past={pastWeeks.has(weeks[i])} />
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <Legend />
    </div>
  );
}

function CellBody({ cell, past }: { cell: Cell; past: boolean }) {
  const { t } = useI18n();
  const st = LEVEL_STYLE[cell.level];
  return (
    <div style={{ background: st.background, border: `1px solid ${st.border}`, color: st.color, borderRadius: 8, padding: '6px 8px', minWidth: 104, textAlign: 'center' }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>
        {fmtHours(cell.planned)} <span style={{ fontWeight: 400 }}>/ {fmtHours(cell.capacity)}</span>
      </div>
      <div style={{ fontSize: 12 }}>{cell.pct === null ? t('aucune capacité', 'no capacity') : fmtPct(cell.pct)}</div>
      {past && <div className="faint" style={{ fontSize: 11 }}>{t('travaillé', 'worked')} {fmtHours(cell.worked)}</div>}
    </div>
  );
}

function CellButton({ cell, past, onClick }: { cell: Cell; past: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={onClick} aria-label={t('Voir le détail', 'View detail')} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', borderRadius: 8 }}>
      <CellBody cell={cell} past={past} />
    </button>
  );
}

function Legend() {
  const { t } = useI18n();
  const items = [
    { k: 'low', label: t('moins de 70 %', 'under 70 %') },
    { k: 'ok', label: t('70 à 100 %', '70 to 100 %') },
    { k: 'over', label: t('plus de 100 %', 'over 100 %') },
  ] as const;
  return (
    <div className="row row-wrap small muted" style={{ marginTop: 10, gap: 14 }}>
      {items.map((i) => (
        <span key={i.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: LEVEL_STYLE[i.k].background, border: `1px solid ${LEVEL_STYLE[i.k].color}` }} />
          {i.label}
        </span>
      ))}
      <span>{t('Heures planifiées / capacité de la semaine. Heures travaillées affichées pour les semaines passées et en cours.', 'Planned hours / weekly capacity. Worked hours shown for past and current weeks.')}</span>
    </div>
  );
}

interface DetailProps {
  open: boolean;
  onClose: () => void;
  name: string;
  week: string;
  cell?: Cell;
  past: boolean;
  lines: (PlannedLine & { projectCode: string; projectName: string })[];
  offs: TimeOff[];
  typeLabel: (type: TimeOff['type']) => string;
}

/** Side detail of one cell: the tasks planned that week and the time off. */
export function CellDetail({ open, onClose, name, week, cell, past, lines, offs, typeLabel }: DetailProps) {
  const { t, lang } = useI18n();
  return (
    <Modal open={open} onClose={onClose} title={`${name} · ${weekRangeLabel(week, lang)}`} large>
      {cell && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="row row-wrap" style={{ gap: 18 }}>
            <Stat label={t('Capacité', 'Capacity')} value={fmtHours(cell.capacity)} />
            <Stat label={t('Planifié', 'Planned')} value={fmtHours(cell.planned)} />
            <Stat label={t('Charge', 'Load')} value={cell.pct === null ? '—' : fmtPct(cell.pct)} />
            {past && <Stat label={t('Travaillé', 'Worked')} value={fmtHours(cell.worked)} />}
          </div>

          <div>
            <h4 style={{ margin: '0 0 8px' }}>{t('Tâches planifiées', 'Planned tasks')}</h4>
            {lines.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>{t('Aucune tâche planifiée cette semaine.', 'No task planned this week.')}</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('Tâche', 'Task')}</th>
                      <th>{t('Projet', 'Project')}</th>
                      <th className="num">{t('Part de la semaine', 'Share of the week')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.task.id}>
                        <td>{l.task.name}</td>
                        <td className="small">
                          <span className="mono">{l.projectCode}</span> {l.projectName}
                        </td>
                        <td className="num">{fmtHours(l.hours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h4 style={{ margin: '0 0 8px' }}>{t('Absences', 'Time off')}</h4>
            {offs.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>{t('Aucune absence cette semaine.', 'No time off this week.')}</p>
            ) : (
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                {offs.map((o) => (
                  <li key={o.id}>
                    {typeLabel(o.type)} · {o.startDate} → {o.endDate}
                    {o.note ? ` · ${o.note}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="faint small">{label}</div>
      <div style={{ fontWeight: 600, fontSize: 18 }}>{value}</div>
    </div>
  );
}
