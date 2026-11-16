import { useMemo, useState } from 'react';
import { Pencil, Printer } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/components/ui';
import { errorText } from '../components/RockShared';
import { quarterOf } from '../lib';
import type { AlignPriority, Rock, Strategy } from '../schemas';
import { PlanSheet } from './PlanSheet';
import { checkPlanDates, planFields, savePlan, type PlanFields } from './planData';
import { currentRocks, initiativeStats, rockRowsOf } from './planStats';

interface Props {
  saved?: Strategy;
  plan: Strategy;
  canManage: boolean;
  rocks: Rock[];
  priorities: AlignPriority[];
  userName: (id?: string) => string;
}

/** The one-page plan tab: printable sheet, with edit mode for managers. */
export function PlanTab({ saved, plan, canManage, rocks, priorities, userName }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<PlanFields | null>(null);
  const [busy, setBusy] = useState(false);
  const quarter = quarterOf();

  /** Non-archived Rocks of the current quarter, with their progress and owner. */
  const rockRows = useMemo(() => rockRowsOf(currentRocks(rocks, quarter), priorities, userName), [rocks, priorities, quarter, userName]);
  const stats = useMemo(
    () => initiativeStats(plan.keyInitiatives.length, rocks, priorities, quarter),
    [plan.keyInitiatives.length, rocks, priorities, quarter],
  );

  const save = async () => {
    if (!draft) return;
    const bad = checkPlanDates(draft);
    if (bad) {
      toast(t(bad), 'err');
      return;
    }
    setBusy(true);
    try {
      await savePlan(saved, draft);
      setDraft(null);
      toast(t('Plan enregistré', 'Plan saved'));
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="row row-wrap align-no-print align-toolbar">
        <span className="spacer" />
        {draft ? (
          <>
            <button className="btn btn-ghost" disabled={busy} onClick={() => setDraft(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              {t('Enregistrer', 'Save')}
            </button>
          </>
        ) : (
          <>
            {canManage && (
              <button className="btn" onClick={() => setDraft(planFields(plan))}>
                <Pencil size={15} /> {t('Modifier', 'Edit')}
              </button>
            )}
            <button className="btn" onClick={() => window.print()}>
              <Printer size={15} /> {t('Imprimer', 'Print')}
            </button>
          </>
        )}
      </div>
      <PlanSheet
        plan={draft ?? planFields(plan)}
        editing={!!draft}
        onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
        quarter={quarter}
        rocks={rockRows}
        initiativeStats={stats}
      />
    </>
  );
}
