import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import { isBlocked, priorityPct } from '../lib';
import type { AlignPriority, Strategy } from '../schemas';
import type { QuarterModel, RockRow } from './model';
import { thrustOf } from './model';
import { HealthDot, ProgressBar } from '../components/RockShared';

/* ---------- generic collapsible tree (connector lines are drawn in align.css) ---------- */

function TreeNode({
  label,
  meta,
  defaultOpen = true,
  children,
}: {
  label: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  /** Child nodes (<li> elements). Absent = leaf, no toggle. */
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const expandable = children !== undefined && children !== null && children !== false;
  return (
    <li className="align-tree-node">
      <div className="align-tree-row">
        {expandable ? (
          <button
            type="button"
            className="align-tree-toggle"
            aria-expanded={open}
            aria-label={open ? t('Replier', 'Collapse') : t('Déplier', 'Expand')}
            title={open ? t('Replier', 'Collapse') : t('Déplier', 'Expand')}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="align-tree-toggle-spacer" aria-hidden="true" />
        )}
        <div className="align-tree-label">{label}</div>
        {meta && <div className="align-tree-meta">{meta}</div>}
      </div>
      {expandable && open && <ul className="align-tree">{children}</ul>}
    </li>
  );
}

/* ---------- hierarchy ---------- */

interface Common {
  nameOf: (id?: string | null) => string;
  prioById: Map<string, AlignPriority>;
}

function PriorityNode({ p, nameOf, prioById }: { p: AlignPriority; nameOf: Common['nameOf']; prioById: Map<string, AlignPriority> }) {
  const { t } = useI18n();
  const blocked = isBlocked(p, prioById);
  return (
    <TreeNode
      label={
        <>
          <HealthDot health={p.health} className="align-dash-dot" />
          <span>{p.title}</span>
          <span className="small faint">· {nameOf(p.ownerId)}</span>
          {blocked && <span className="badge badge-warn">{t('Bloquée', 'Blocked')}</span>}
        </>
      }
      meta={<span className="mono small">{priorityPct(p)}%</span>}
    />
  );
}

function RockNode({ row, nameOf, prioById }: { row: RockRow } & Common) {
  const { t } = useI18n();
  const { rock, done, total, pct, priorities } = row;
  return (
    <TreeNode
      label={
        <div className="align-tree-main">
          <Link to={`/align/rocks/${rock.id}`} className="align-dash-title">
            {rock.title}
          </Link>
          <span className="small muted">{nameOf(rock.ownerId)}</span>
        </div>
      }
      meta={
        <span className="align-tree-progress">
          <ProgressBar pct={pct} className="align-dash-bar" />
          <span className="mono small">{pct}%</span>
          <span className="small muted">
            {done} / {total}
          </span>
        </span>
      }
    >
      {priorities.length > 0 ? (
        <TreeNode label={<span className="small muted">{`${t('Priorités', 'Priorities')} (${priorities.length})`}</span>} defaultOpen={false}>
          {priorities.map((p) => (
            <PriorityNode key={p.id} p={p} nameOf={nameOf} prioById={prioById} />
          ))}
        </TreeNode>
      ) : (
        <TreeNode label={<span className="small faint">{t('Aucune priorité', 'No priorities')}</span>} />
      )}
    </TreeNode>
  );
}

/**
 * Plan hiérarchique: Purpose / BHAG → key thrusts → Rocks of the quarter → priorities.
 * Rocks without a thrust and priorities without a Rock are grouped at the end.
 */
export function Hierarchy({
  plan,
  model,
  nameOf,
  prioById,
}: {
  plan: Strategy;
  model: QuarterModel;
  nameOf: (id?: string | null) => string;
  prioById: Map<string, AlignPriority>;
}) {
  const { t } = useI18n();
  const common = { nameOf, prioById };
  const thrusts = plan.keyThrusts;
  const byThrust = (i: number) => model.rockRows.filter((r) => thrustOf(r.rock, plan) === i);
  const unattached = model.rockRows.filter((r) => thrustOf(r.rock, plan) === null);

  return (
    <section className="card align-dash-card">
      <div className="card-head">
        <h3>{t('Plan hiérarchique', 'Hierarchical plan')}</h3>
        <span className="small muted">{t('Raison d’être → axes → Rocks → priorités', 'Purpose → thrusts → Rocks → priorities')}</span>
      </div>
      <div className="card-pad align-tree-wrap">
        <ul className="align-tree align-tree-root">
          <TreeNode
            label={
              <div className="align-tree-main">
                <span className="eyebrow">{t('Raison d’être · BHAG', 'Purpose · BHAG')}</span>
                <span className="align-dash-strong" style={{ margin: 0 }}>
                  {plan.bhag || t('BHAG non défini', 'BHAG not set')}
                </span>
                {plan.purpose && <span className="small muted align-dash-clamp">{plan.purpose}</span>}
              </div>
            }
          >
            {thrusts.map((text, i) => {
              const rows = byThrust(i);
              return (
                <TreeNode
                  key={i}
                  label={
                    <>
                      <span className="align-tree-index">{i + 1}</span>
                      <span>{text}</span>
                    </>
                  }
                  meta={<span className="small muted">{`${rows.length} Rock(s)`}</span>}
                >
                  {rows.length > 0 ? (
                    rows.map((r) => <RockNode key={r.rock.id} row={r} {...common} />)
                  ) : (
                    <TreeNode label={<span className="small faint">{t('Aucun Rock rattaché à cet axe', 'No Rock linked to this thrust')}</span>} />
                  )}
                </TreeNode>
              );
            })}

            {unattached.length > 0 && (
              <TreeNode
                label={<span className="align-dash-title">{t('Rocks non rattachés à un axe', 'Rocks not linked to a thrust')}</span>}
                meta={<span className="small muted">{unattached.length}</span>}
              >
                {unattached.map((r) => (
                  <RockNode key={r.rock.id} row={r} {...common} />
                ))}
              </TreeNode>
            )}

            {model.unlinked.length > 0 && (
              <TreeNode
                label={<span className="align-dash-title">{t('Priorités sans Rock', 'Priorities without a Rock')}</span>}
                meta={<span className="small muted">{model.unlinked.length}</span>}
                defaultOpen={false}
              >
                {model.unlinked.map((p) => (
                  <PriorityNode key={p.id} p={p} nameOf={nameOf} prioById={prioById} />
                ))}
              </TreeNode>
            )}
          </TreeNode>
        </ul>

        {model.rockRows.length === 0 && model.unlinked.length === 0 && (
          <div className="small muted" style={{ marginTop: 12 }}>
            {t('Aucun Rock pour ce trimestre.', 'No Rocks for this quarter.')}{' '}
            <Link to="/align/rocks">{t('Ajouter des Rocks', 'Add Rocks')}</Link>
          </div>
        )}
      </div>
    </section>
  );
}
