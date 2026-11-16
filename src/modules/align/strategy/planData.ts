/** Data helpers of the strategy plan: editable fields, date checks, save (insert or update of the single "plan" document), quarter choices. */
import type { L } from '@/i18n';
import type { Strategy } from '../schemas';
import { strategy } from '../stores';

/** The editable content of the plan: everything except the id and the server stamps. */
export type PlanFields = Omit<Strategy, 'id' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'>;

export function planFields(p: Strategy): PlanFields {
  const {
    coreValues,
    messages,
    purpose,
    bhag,
    brandPromise,
    targets,
    keyThrusts,
    profitX,
    goals,
    keyInitiatives,
    actions,
    actionsQtr,
    criticalNumbersBS,
    criticalNumbersPL,
    theme,
    swot,
    people,
    process,
    sandbox,
  } = p;
  return {
    coreValues,
    messages,
    purpose,
    bhag,
    brandPromise,
    targets,
    keyThrusts,
    profitX,
    goals,
    keyInitiatives,
    actions,
    actionsQtr,
    criticalNumbersBS,
    criticalNumbersPL,
    theme,
    swot,
    people,
    process,
    sandbox,
  };
}

/** A real calendar day written YYYY-MM-DD (2026-02-31 is refused). */
export function isIsoDay(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const x = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === d;
}

/** The first invalid date of the plan, if any (empty dates are allowed: they mean "not set"). */
export function checkPlanDates(f: PlanFields): L | null {
  const dates: [L, string | null][] = [
    [{ fr: 'Cibles (3 à 5 ans)', en: 'Targets (3–5 years)' }, f.targets.date],
    [{ fr: 'Objectifs (1 an)', en: 'Goals (1 year)' }, f.goals.date],
    [{ fr: 'Thème du trimestre', en: 'Quarter theme' }, f.theme.deadline],
  ];
  for (const [label, d] of dates) {
    if (d && !isIsoDay(d)) {
      return { fr: `${label.fr} : date invalide (AAAA-MM-JJ)`, en: `${label.en}: invalid date (YYYY-MM-DD)` };
    }
  }
  return null;
}

/** Writes the plan: updates the existing "plan" document, or inserts it the first time. Refuses invalid dates. */
export async function savePlan(saved: Strategy | undefined, fields: PlanFields): Promise<void> {
  const bad = checkPlanDates(fields);
  if (bad) throw new Error(bad.fr);
  if (saved) await strategy.update('plan', fields);
  else await strategy.insert({ ...fields, id: 'plan' });
}

/** Quarters offered for a key initiative: the year before, the current year and the year after. */
export function quarterChoices(current: string, extra?: string | null): string[] {
  const year = Number(current.slice(0, 4));
  const set = new Set<string>();
  for (let y = year - 1; y <= year + 1; y++) for (let n = 1; n <= 4; n++) set.add(`${y}-Q${n}`);
  if (extra) set.add(extra);
  return [...set].sort();
}
