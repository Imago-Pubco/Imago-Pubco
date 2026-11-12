import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { BUDGET_COLOR, budgetUse, fmtHours, fmtMoney, parseDate, type Actuals, type BudgetUse } from './lib';
import type { Project } from './schemas';
import { BILLING_LABEL, STATUS_BADGE, STATUS_LABEL } from './Projects.shared';

/** Used / budget as text and a small progress bar coloured by the budget level. */
export function UsageBar({
  used,
  budget,
  pct,
  level,
  format,
}: {
  used: number;
  budget: number | null;
  pct: number | null;
  level: BudgetUse['level'];
  format: (n: number) => string;
}) {
  if (budget === null || pct === null) return <span className="faint small">{format(used)} / —</span>;
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ minWidth: 120 }}>
      <div className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, whiteSpace: 'nowrap' }}>
        <span>{format(used)}</span>
        <span className="faint">/ {format(budget)}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        style={{ height: 6, borderRadius: 3, background: 'var(--bg-sunken)', overflow: 'hidden', marginTop: 4 }}
      >
        <div style={{ width: `${width}%`, height: '100%', background: BUDGET_COLOR[level] }} />
      </div>
    </div>
  );
}

/** Action buttons of a row (managers only): their clicks never reach the row. */
function ActionButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-icon btn-sm${danger ? ' btn-danger' : ''}`}
      title={label}
      aria-label={label}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

/** One project row. The whole row opens the project. */
export function ProjectRow({
  project: p,
  actuals,
  clientName,
  managerName,
  manage,
  onOpen,
  onEdit,
  onArchive,
  onDelete,
}: {
  project: Project;
  actuals: Actuals;
  clientName: string;
  managerName: string;
  manage: boolean;
  onOpen: (id: string) => void;
  onEdit: (p: Project) => void;
  onArchive: (p: Project) => void;
  onDelete: (p: Project) => void;
}) {
  const { t, lang } = useI18n();
  const use = budgetUse(p, actuals);
  const archived = p.status === 'archived';
  return (
    <tr className="clickable" onClick={() => onOpen(p.id)}>
      <td className="mono small">
        <Link
          to={`/tools/pm/projects/${p.id}`}
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
        >
          <span
            aria-hidden="true"
            style={{ width: 10, height: 10, borderRadius: '50%', background: p.color || 'var(--text-3)', flex: 'none' }}
          />
          {p.code}
        </Link>
      </td>
      <td>
        <strong style={{ fontWeight: 500 }}>{p.name}</strong>
      </td>
      <td className="small">{clientName || <span className="faint">—</span>}</td>
      <td className="small">{managerName || <span className="faint">—</span>}</td>
      <td>
        <span className={STATUS_BADGE[p.status]}>{t(STATUS_LABEL[p.status])}</span>
      </td>
      <td className="small">{t(BILLING_LABEL[p.billing])}</td>
      <td>
        <UsageBar used={actuals.hours} budget={p.budgetHours} pct={use.hoursPct} level={use.level} format={fmtHours} />
      </td>
      <td>
        <UsageBar
          used={actuals.fees}
          budget={p.budgetAmount}
          pct={use.amountPct}
          level={use.level}
          format={(n) => fmtMoney(n, lang)}
        />
      </td>
      <td className="small" style={{ whiteSpace: 'nowrap' }}>
        {p.endDate ? parseDate(p.endDate).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'medium' }) : <span className="faint">—</span>}
      </td>
      {manage && (
        <td>
          <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
            <ActionButton label={t('Modifier', 'Edit')} onClick={() => onEdit(p)}>
              <Pencil size={15} />
            </ActionButton>
            <ActionButton label={archived ? t('Désarchiver', 'Unarchive') : t('Archiver', 'Archive')} onClick={() => onArchive(p)}>
              {archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
            </ActionButton>
            <ActionButton label={t('Supprimer', 'Delete')} onClick={() => onDelete(p)} danger>
              <Trash2 size={15} />
            </ActionButton>
          </div>
        </td>
      )}
    </tr>
  );
}
