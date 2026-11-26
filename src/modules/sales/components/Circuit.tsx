/**
 * The sales circuit: every stage of the request, left to right, on one track.
 *  - Overview (`byStage`): each stage shows how many requests are there and chips to open them.
 *  - Track (`stage`): one request. Completed stages are solid, the current one glows, a runner travels the track,
 *    and each stage shows the time spent there.
 * Geometry is fixed in pixels (the circuit scrolls horizontally on narrow screens).
 */
import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Ban, BadgeCheck, Calculator, Check, Eye, Factory, FileText, Inbox, Scissors, Send, type LucideIcon } from 'lucide-react';
import { useI18n, type L } from '@/i18n';
import { BLOCKER_LABEL, SALES_STAGES, STAGE_LABEL, type BlockerKind, type SalesStage, type StudioStatus } from '../types';
import { BLOCKER_SHORT, dayLabel } from '../stores';

export interface CircuitItem {
  id: string;
  no: string;
  customer: string;
  blocked?: BlockerKind;
  overdue?: boolean;
}

const STAGE_ICON: Record<SalesStage, LucideIcon> = {
  received: Inbox,
  estimating: Calculator,
  review: Eye,
  quote_ready: FileText,
  with_client: Send,
  accepted: BadgeCheck,
  production: Factory,
  declined: Ban,
};

const STUDIO_LABEL: Record<StudioStatus, L> = {
  none: { fr: 'Studio : aucune demande', en: 'Studio: no request' },
  requested: { fr: 'Studio : demandé', en: 'Studio: requested' },
  in_progress: { fr: 'Studio : en cours', en: 'Studio: in progress' },
  done: { fr: 'Studio : prêt', en: 'Studio: ready' },
};

/* Geometry (px). Station i is centred on xOf(i). */
const COL = 160;
const X0 = 90;
const W = 1140;
/** Track height (centre of the nodes). */
const TY = 84;
/** Node radius. */
const NR = 24;
/** Centre of the side branches (studio, declined). */
const BY = 200;
const STATION_W = 150;
const CHIP_MAX = 4;

const xOf = (i: number) => X0 + i * COL;
const idxOf = (s: SalesStage) => (SALES_STAGES as readonly string[]).indexOf(s);
const STUDIO_IDX = idxOf('estimating');
const CLIENT_IDX = idxOf('with_client');
const STUDIO_X = xOf(STUDIO_IDX);
const DECL_X = xOf(CLIENT_IDX);

export interface CircuitProps {
  /** Overview: the requests on each stage. Leave out for the track view. */
  byStage?: Partial<Record<SalesStage, CircuitItem[]>>;
  /** Overview: requests with studio work in progress. */
  studioCount?: number;
  /** Overview: highlight the loop-back arrow (some requests came back for changes). */
  loopActive?: boolean;
  /** Track: the request's current stage. */
  stage?: SalesStage;
  /** Track: furthest stage reached (for a declined request). */
  reachedIdx?: number;
  /** Track: milliseconds spent in each stage. */
  dwell?: Partial<Record<SalesStage, number>>;
  /** Track: the blocker kind, shown as a pulsing badge on the current stage. */
  blocked?: BlockerKind;
  /** Track: how many times the customer asked for changes (1 = none). */
  revision?: number;
  /** Track: the studio branch status. */
  studio?: StudioStatus;
  onPick?: (id: string) => void;
}

export function Circuit({ byStage, studioCount, loopActive, stage, reachedIdx, dwell, blocked, revision, studio = 'none', onPick }: CircuitProps) {
  const { t, lang } = useI18n();
  const reduce = useReducedMotion();
  const svgId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const track = stage !== undefined;
  const declined = stage === 'declined';
  const curIdx = track && !declined ? idxOf(stage) : -1;
  /** Stages with index below this are completed. */
  const doneUpTo = !track ? 0 : declined ? (reachedIdx ?? 0) : curIdx;
  const loopOn = track ? (revision ?? 1) > 1 : !!loopActive;
  const H = track ? 300 : 540;

  const stateOf = (i: number): 'done' | 'current' | 'todo' => {
    if (!track) return 'todo';
    if (i < doneUpTo) return 'done';
    if (i === curIdx) return 'current';
    return 'todo';
  };

  // Runner: travels along the track to the current stage (and down to the off-ramp when declined).
  const endIdx = declined ? doneUpTo : curIdx;
  const runX = track && endIdx >= 0 ? Array.from({ length: endIdx + 1 }, (_, i) => xOf(i)) : [];
  const runY = runX.map(() => TY);
  if (declined && runX.length) {
    runX.push(DECL_X);
    runY.push(BY);
  }
  const lastX = runX[runX.length - 1];
  const lastY = runY[runY.length - 1];

  const studioActive = studio !== 'none';
  const loopLabel = t('Changements demandés', 'Changes requested');

  return (
    <section className="sl-scroll" aria-label={t('Circuit de la demande', 'Request circuit')} tabIndex={0}>
      <div className="sl-circuit" style={{ width: W, height: H }}>
        <svg className="sl-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <defs>
            <marker id={`sl-arr-off-${svgId}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--text-3)' }} />
            </marker>
            <marker id={`sl-arr-on-${svgId}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--warn)' }} />
            </marker>
          </defs>

          {/* Track */}
          {SALES_STAGES.slice(0, -1).map((s, i) => (
            <line key={s} className={`sl-seg${track && i < doneUpTo ? ' done' : ''}`} x1={xOf(i) + NR} x2={xOf(i + 1) - NR} y1={TY} y2={TY} />
          ))}

          {/* Side branches */}
          <line className={`sl-branch${studioActive ? ' done' : ''}`} x1={STUDIO_X} x2={STUDIO_X} y1={TY + NR} y2={BY - 18} />
          <line
            className={`sl-branch${declined ? ' done' : ''}`}
            x1={DECL_X}
            x2={DECL_X}
            y1={TY + NR}
            y2={BY - 18}
            style={declined ? { stroke: 'var(--err)' } : undefined}
          />

          {/* Loop-back: changes requested, from "with client" to "estimating" */}
          <path
            className={`sl-loop${loopOn ? ' on' : ''}`}
            d={`M ${DECL_X} ${TY - NR - 2} C ${DECL_X} 8, ${STUDIO_X} 8, ${STUDIO_X} ${TY - NR - 2}`}
            markerEnd={`url(#sl-arr-${loopOn ? 'on' : 'off'}-${svgId})`}
          />
          <text className="sl-loop-label" x={(STUDIO_X + DECL_X) / 2} y={12}>
            {loopLabel}
            {track && loopOn ? ` (v${revision})` : ''}
          </text>

          {/* Runner */}
          {runX.length > 0 && (
            <motion.circle
              key={`${stage}-${revision ?? 1}`}
              className="sl-runner"
              r={7}
              initial={reduce ? false : { cx: runX[0], cy: runY[0] }}
              animate={reduce ? { cx: lastX, cy: lastY } : { cx: runX, cy: runY }}
              transition={reduce ? { duration: 0 } : { duration: 0.3 * runX.length, ease: 'easeInOut' }}
            />
          )}
        </svg>

        <ol className="sl-stations" style={{ margin: 0 }}>
          {SALES_STAGES.map((s, i) => {
            const st = stateOf(i);
            const items = byStage?.[s] ?? [];
            const count = items.length;
            const hasBlocked = items.some((x) => x.blocked);
            const Icon = STAGE_ICON[s];
            const isCurrentBlocked = track && st === 'current' && !!blocked;
            const label = t(STAGE_LABEL[s]);
            const summary = track ? `${label}${dwell?.[s] !== undefined ? ` · ${dayLabel(dwell[s]!, lang)}` : ''}` : `${label} · ${count}`;
            return (
              <li key={s} className={`sl-station ${st}`} style={{ left: xOf(i) - STATION_W / 2, width: STATION_W }} aria-label={summary}>
                <span
                  className={[
                    'sl-node',
                    st === 'done' ? 'done' : '',
                    st === 'current' ? 'current' : '',
                    !track && count > 0 ? 'has' : '',
                    hasBlocked || isCurrentBlocked ? 'blocked' : '',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {track ? (st === 'done' ? <Check size={18} /> : <Icon size={18} />) : count}
                  {(hasBlocked || isCurrentBlocked) && <span className="sl-pulse-dot" />}
                </span>
                <span className="sl-label">{label}</span>
                <span className="sl-sub">{track && dwell?.[s] !== undefined ? dayLabel(dwell[s]!, lang) : ''}</span>

                {!track && count > 0 && (
                  <ul className="sl-chips">
                    {items.slice(0, CHIP_MAX).map((it) => (
                      <li key={it.id}>
                        <button
                          type="button"
                          className={`sl-chip${it.overdue ? ' is-overdue' : ''}`}
                          onClick={() => onPick?.(it.id)}
                          title={`${it.no} · ${it.customer}`}
                          aria-label={`${it.no} ${it.customer}${it.blocked ? ` — ${t(BLOCKER_LABEL[it.blocked])}` : ''}`}
                        >
                          <span className="mono">{it.no}</span>
                          <span className="sl-chip-cust">{it.customer}</span>
                          {it.blocked && <span className="sl-blk" title={t(BLOCKER_LABEL[it.blocked])}>{t(BLOCKER_SHORT[it.blocked])}</span>}
                        </button>
                      </li>
                    ))}
                    {count > CHIP_MAX && <li className="sl-more">+{count - CHIP_MAX}</li>}
                  </ul>
                )}

                {s === 'estimating' && (
                  <>
                    <span className={`sl-branch-node st-${studio}`} style={{ top: BY - 18 }} aria-hidden="true">
                      <Scissors size={16} />
                    </span>
                    <span className="sl-branch-label" style={{ top: BY + 22 }}>
                      {t(STUDIO_LABEL[studio])}
                      {!track && studioCount ? ` · ${studioCount}` : ''}
                    </span>
                  </>
                )}

                {s === 'with_client' && (
                  <>
                    <span className={`sl-branch-node${declined ? ' current' : ''}`} style={{ top: BY - 18 }} aria-hidden="true">
                      {track ? <Ban size={16} /> : <span className="sl-count">{byStage?.declined?.length ?? 0}</span>}
                    </span>
                    <span className="sl-branch-label" style={{ top: BY + 22 }}>
                      {t('Refusée / perdue', 'Declined / lost')}
                    </span>
                    {!track && (byStage?.declined?.length ?? 0) > 0 && (
                      <>
                        <span className="sl-branch-label" style={{ top: 412, fontWeight: 600 }}>
                          {t('Refusées', 'Declined')}
                        </span>
                        <ul className="sl-chips" style={{ top: 432 }}>
                          {(byStage?.declined ?? []).slice(0, 3).map((it) => (
                            <li key={it.id}>
                              <button type="button" className="sl-chip" onClick={() => onPick?.(it.id)} title={`${it.no} · ${it.customer}`}>
                                <span className="mono">{it.no}</span>
                                <span className="sl-chip-cust">{it.customer}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

const STAGE_BADGE: Partial<Record<SalesStage, string>> = {
  estimating: 'badge-warn',
  review: 'badge-warn',
  quote_ready: 'badge-info',
  with_client: 'badge-info',
  accepted: 'badge-ok',
  production: 'badge-ok',
  declined: 'badge-err',
};

/** The stage as a coloured badge (lists and headers). */
export function SalesStageBadge({ stage }: { stage: SalesStage }) {
  const { t } = useI18n();
  return <span className={`badge ${STAGE_BADGE[stage] ?? ''}`}>{t(STAGE_LABEL[stage])}</span>;
}
