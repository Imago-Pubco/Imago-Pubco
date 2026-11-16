import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import { ProgressBar } from '../components/RockShared';
import { quarterLabel, quarterOf, shiftQuarter } from '../lib';
import type { AlignNote, AlignPriority, ChecklistItem, Rock } from '../schemas';
import { computeAutoChecks, type AutoCheck } from './AutoChecks';
import { ManualChecklist } from './ManualChecklist';

interface Props {
  canManage: boolean;
  rocks: Rock[];
  priorities: AlignPriority[];
  notes: AlignNote[];
  thrusts: string[];
  items: ChecklistItem[];
}

/** Alignment checklist: automatic checks for a quarter (part A) and the manual list (part B). */
export function ChecklistTab({ canManage, rocks, priorities, notes, thrusts, items }: Props) {
  const [quarter, setQuarter] = useState(() => quarterOf());
  const checks = useMemo(
    () => computeAutoChecks({ quarter, rocks, priorities, notes, thrusts }),
    [quarter, rocks, priorities, notes, thrusts],
  );
  return (
    <>
      <AutoChecksPanel checks={checks} quarter={quarter} onShift={(by) => setQuarter((q) => shiftQuarter(q, by))} />
      <ManualChecklist items={items} canManage={canManage} />
    </>
  );
}

/** Part A: the automatic checks with their score and the items that fail each one. */
export function AutoChecksPanel({ checks, quarter, onShift }: { checks: AutoCheck[]; quarter: string; onShift: (by: number) => void }) {
  const { t } = useI18n();
  const passed = checks.filter((c) => c.offenders.length === 0).length;
  const pct = checks.length ? Math.round((passed / checks.length) * 100) : 0;
  return (
    <section className="card card-pad align-checks-card">
      <div className="row row-wrap" style={{ gap: 10, marginBottom: 12 }}>
        <h2 className="align-section-title" style={{ margin: 0 }}>
          {t('Vérifications automatiques', 'Automatic checks')}
        </h2>
        <span className="spacer" />
        <button className="btn btn-ghost btn-icon btn-sm" aria-label={t('Trimestre précédent', 'Previous quarter')} onClick={() => onShift(-1)}>
          <ChevronLeft size={16} />
        </button>
        <strong>{quarterLabel(quarter)}</strong>
        <button className="btn btn-ghost btn-icon btn-sm" aria-label={t('Trimestre suivant', 'Next quarter')} onClick={() => onShift(1)}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="row" style={{ gap: 12, marginBottom: 16 }}>
        <strong className="align-score">
          {passed} / {checks.length} {t('vérifications réussies', 'checks passed')}
        </strong>
        <div style={{ flex: 1, minWidth: 80 }}>
          <ProgressBar pct={pct} large />
        </div>
      </div>

      <ul className="align-auto-list">
        {checks.map((c) => (
          <AutoRow key={c.id} check={c} />
        ))}
      </ul>
    </section>
  );
}

const MAX_SHOWN = 8;

function AutoRow({ check }: { check: AutoCheck }) {
  const { t } = useI18n();
  const ok = check.offenders.length === 0;
  const shown = check.offenders.slice(0, MAX_SHOWN);
  return (
    <li className="align-auto-check">
      {ok ? <CheckCircle2 size={18} color="var(--ok)" aria-hidden /> : <AlertTriangle size={18} color="var(--warn)" aria-hidden />}
      <div style={{ minWidth: 0 }}>
        <div>{t(check.label)}</div>
        {!ok && (
          <ul className="align-auto-offenders">
            {shown.map((o, i) => (
              <li key={i}>
                {o.to ? (
                  <Link to={o.to} className="align-rock-link">
                    {o.label}
                  </Link>
                ) : (
                  o.label
                )}
              </li>
            ))}
            {check.offenders.length > MAX_SHOWN && <li className="faint">{t(`+ ${check.offenders.length - MAX_SHOWN} autres`, `+ ${check.offenders.length - MAX_SHOWN} more`)}</li>}
          </ul>
        )}
      </div>
      <span className={`badge ${ok ? 'badge-ok' : 'badge-warn'}`}>{ok ? t('OK', 'OK') : check.offenders.length}</span>
    </li>
  );
}
