import { AlertTriangle } from 'lucide-react';
import { useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { BUDGET_COLOR, budgetUse, fmtHours, fmtMoney, pct, profitability, type Actuals, type BudgetLevel } from './lib';
import type { Project, TimeEntry } from './schemas';
import { rates } from './stores';
import { CARD_GRID, ProgressBar } from './ProjectDetail.ui';

/** Budget vs actual, alerts, and (reports permission only) profitability. */
export function OverviewTab({ project, actuals, entries, canReports }: { project: Project; actuals: Actuals; entries: TimeEntry[]; canReports: boolean }) {
  const { t, lang } = useI18n();
  const overall = budgetUse(project, actuals);
  const hoursUse = budgetUse({ budgetHours: project.budgetHours, budgetAmount: null, alertPct: project.alertPct }, actuals);
  const amountUse = budgetUse({ budgetHours: null, budgetAmount: project.budgetAmount, alertPct: project.alertPct }, actuals);
  const hoursLeft = project.budgetHours === null ? null : project.budgetHours - actuals.hours;
  const amountLeft = project.budgetAmount === null ? null : project.budgetAmount - actuals.fees;
  const nonBillable = Math.max(0, actuals.hours - actuals.billableHours);

  const hoursHint =
    hoursLeft === null
      ? undefined
      : hoursLeft >= 0
        ? t(`reste ${fmtHours(hoursLeft)}`, `${fmtHours(hoursLeft)} left`)
        : t(`dépassement de ${fmtHours(-hoursLeft)}`, `over by ${fmtHours(-hoursLeft)}`);
  const amountHint =
    amountLeft === null
      ? undefined
      : amountLeft >= 0
        ? t(`reste ${fmtMoney(amountLeft, lang)}`, `${fmtMoney(amountLeft, lang)} left`)
        : t(`dépassement de ${fmtMoney(-amountLeft, lang)}`, `over by ${fmtMoney(-amountLeft, lang)}`);

  return (
    <div className="stack" style={{ gap: 16 }}>
      {overall.level === 'over' && (
        <div className="alert alert-err" role="alert">
          <AlertTriangle size={18} />
          <span>{t('Budget dépassé : le travail réalisé dépasse le budget du projet.', 'Budget exceeded: work done is over the project budget.')}</span>
        </div>
      )}
      {overall.level === 'warn' && (
        <div className="alert alert-warn" role="alert">
          <AlertTriangle size={18} />
          <span>
            {t(
              `Alerte : ${pct(project.alertPct)} du budget est atteint.`,
              `Alert: ${pct(project.alertPct)} of the budget is used.`,
            )}
          </span>
        </div>
      )}

      <div style={CARD_GRID}>
        <BudgetCard
          title={t('Heures', 'Hours')}
          used={fmtHours(actuals.hours)}
          budget={project.budgetHours === null ? null : fmtHours(project.budgetHours)}
          share={hoursUse.hoursPct}
          level={hoursUse.level}
          hint={hoursHint}
          noBudget={t('Pas de budget d’heures', 'No hours budget')}
        />
        <BudgetCard
          title={t('Montant', 'Amount')}
          used={fmtMoney(actuals.fees, lang)}
          budget={project.budgetAmount === null ? null : fmtMoney(project.budgetAmount, lang)}
          share={amountUse.amountPct}
          level={amountUse.level}
          hint={amountHint}
          noBudget={t('Pas de budget en argent', 'No amount budget')}
        />
        <StatCard
          title={t('Heures facturables', 'Billable hours')}
          value={fmtHours(actuals.billableHours)}
          sub={`${t('non facturables', 'non-billable')} : ${fmtHours(nonBillable)}`}
        />
        <StatCard
          title={t('Dépenses', 'Expenses')}
          value={fmtMoney(actuals.expenseCost, lang)}
          sub={`${t('facturé', 'billed')} : ${fmtMoney(actuals.expenseFees, lang)}`}
        />
        <StatCard
          title={t('Reste à faire sur le budget', 'Remaining budget')}
          value={hoursLeft === null ? '—' : fmtHours(Math.max(0, hoursLeft))}
          sub={amountLeft === null ? t('Montant : pas de budget', 'Amount: no budget') : `${t('montant', 'amount')} : ${fmtMoney(Math.max(0, amountLeft), lang)}`}
        />
      </div>

      {canReports && <ProfitCard project={project} actuals={actuals} entries={entries} />}

      {project.description && (
        <div className="card card-pad">
          <div className="small faint" style={{ marginBottom: 6 }}>
            {t('Description', 'Description')}
          </div>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{project.description}</p>
        </div>
      )}
    </div>
  );
}

function BudgetCard({
  title,
  used,
  budget,
  share,
  level,
  hint,
  noBudget,
}: {
  title: string;
  used: string;
  budget: string | null;
  share: number | null;
  level: BudgetLevel;
  hint?: string;
  noBudget: string;
}) {
  const color = BUDGET_COLOR[level];
  return (
    <div className="card card-pad stack" style={{ gap: 10 }}>
      <div className="small faint">{title}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>
        {used}
        {budget && <span className="muted small"> / {budget}</span>}
      </div>
      {share === null ? (
        <div className="small faint">{noBudget}</div>
      ) : (
        <>
          <ProgressBar value={share} color={color} />
          <div className="small" style={{ color }}>
            {pct(share)}
            {hint && ` · ${hint}`}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="card card-pad stack" style={{ gap: 10 }}>
      <div className="small faint">{title}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
      {sub && <div className="small muted">{sub}</div>}
    </div>
  );
}

/** Profit = revenue - cost. Cost rates are confidential, so this card only renders with tools.pm.reports. */
function ProfitCard({ project, actuals, entries }: { project: Project; actuals: Actuals; entries: TimeEntry[] }) {
  const { t, lang } = useI18n();
  const { rows: rateRows } = useCollection(rates);
  const p = profitability(project, actuals, entries, rateRows);
  const color = p.margin < 0 ? 'var(--err)' : 'var(--ok)';
  return (
    <div className="card card-pad">
      <div className="small faint" style={{ marginBottom: 12 }}>
        {t('Rentabilité', 'Profitability')}
      </div>
      <div style={CARD_GRID}>
        <Figure label={t('Revenus', 'Revenue')} value={fmtMoney(p.revenue, lang)} />
        <Figure label={t('Coûts (personnes et dépenses)', 'Cost (people and expenses)')} value={fmtMoney(p.cost, lang)} />
        <Figure label={t('Marge', 'Margin')} value={fmtMoney(p.margin, lang)} color={color} />
        <Figure label={t('Marge %', 'Margin %')} value={p.marginPct === null ? '—' : pct(p.marginPct)} color={color} />
      </div>
    </div>
  );
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="small faint">{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}
