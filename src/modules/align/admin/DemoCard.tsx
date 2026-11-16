import { useState } from 'react';
import { FlaskConical, Trash2, Zap } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { useToast } from '@/components/ui';
import { todayIso } from '../lib';
import { tasks } from '../stores';
import { endOrder } from '../tasks/taskDnd';
import { thisWeek } from '../week';
import { errorText } from './types';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayIso(d);
};

/**
 * Demo actions, to see the staleness warnings in production: two actions in my plan of this week, started 15 and
 * 22 days ago (orange, then red with lightning). They are marked "demo": shown, but never counted in any figure.
 */
export function DemoCard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const { rows: allTasks } = useCollection(tasks);
  const [busy, setBusy] = useState(false);
  const me = user!.id;
  const demos = allTasks.filter((x) => x.demo);

  async function create() {
    setBusy(true);
    try {
      const week = thisWeek();
      const mine = allTasks.filter((x) => x.ownerId === me && x.weekStart === week);
      let order = endOrder(mine);
      const base = { ownerId: me, weekStart: week, kind: 'weekly' as const, rockId: null, priorityId: null, done: false, huddleId: null, demo: true };
      await tasks.insert({ ...base, id: uid('t_'), title: t('Démo — action reportée depuis 2 semaines', 'Demo — action postponed for 2 weeks'), order, since: daysAgo(15), postponed: 2 });
      order = Math.min(100000, order + 1000);
      await tasks.insert({ ...base, id: uid('t_'), title: t('Démo — action reportée depuis 3 semaines', 'Demo — action postponed for 3 weeks'), order, since: daysAgo(22), postponed: 3 });
      toast(t('2 actions de démo ajoutées à votre plan d’action de la semaine', '2 demo actions added to your action plan of the week'));
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setBusy(false);
    }
  }

  async function removeAll() {
    if (!window.confirm(t(`Supprimer les ${demos.length} action(s) de démo ?`, `Delete the ${demos.length} demo action(s)?`))) return;
    setBusy(true);
    try {
      for (const x of demos) await tasks.remove(x.id);
      toast(t('Actions de démo supprimées', 'Demo actions deleted'));
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-pad stack">
      <div className="row">
        <FlaskConical size={20} color="var(--accent)" />
        <h3>{t('Démo : actions en retard', 'Demo: overdue actions')}</h3>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {t(
          'Crée 2 actions dans votre plan d’action de la semaine : une commencée il y a 2 semaines (orange) et une il y a 3 semaines (rouge, effet éclair). Elles portent l’étiquette « Démo » et ne comptent dans aucun résultat, terminées ou non.',
          'Creates 2 actions in your action plan of the week: one started 2 weeks ago (orange) and one 3 weeks ago (red, lightning effect). They carry a "Demo" label and never count in any result, done or not.',
        )}
      </p>
      <div className="row row-wrap" style={{ gap: 8, alignItems: 'center' }}>
        <button className="btn btn-primary" disabled={busy} onClick={() => void create()}>
          <Zap size={15} /> {t('Créer 2 actions de démo', 'Create 2 demo actions')}
        </button>
        <button className="btn" disabled={busy || demos.length === 0} onClick={() => void removeAll()}>
          <Trash2 size={15} /> {t('Retirer les actions de démo', 'Remove the demo actions')} {demos.length > 0 && <span className="badge">{demos.length}</span>}
        </button>
      </div>
    </div>
  );
}
