import { Camera, RotateCcw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useUserName } from '@/data/hooks';
import { ALIGN_COUNT_ITEMS, isFilled, type AlignBackup, type AlignCounts, type AlignSlot } from './types';

/** "Rocks 4 · Priorités 12 · …" for one set of counts. */
function summary(counts: AlignCounts, t: (l: { fr: string; en: string }) => string): string {
  return ALIGN_COUNT_ITEMS.map((i) => `${t(i.label)} ${counts[i.key] ?? 0}`).join(' · ');
}

interface SnapshotsCardProps {
  snapshots: AlignSlot[];
  backup: AlignBackup | null;
  busy: boolean;
  canTake: boolean;
  canRestore: boolean;
  onTake: () => void;
  onRestore: () => void;
}

/** Three snapshot slots, taking a snapshot and restoring one of them (or the automatic backup). */
export function SnapshotsCard({ snapshots, backup, busy, canTake, canRestore, onTake, onRestore }: SnapshotsCardProps) {
  const { t, fmtDate } = useI18n();
  const userName = useUserName();
  const hasSource = snapshots.some(isFilled) || backup !== null;

  return (
    <div className="card card-pad stack">
      <div className="row">
        <Camera size={20} color="var(--accent)" />
        <h3>{t('Instantanés', 'Snapshots')}</h3>
        <span className="spacer" />
        <span className="faint small">{snapshots.filter(isFilled).length} / {snapshots.length}</span>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {t(
          'Jusqu’à 3 copies complètes des données Align, gardées à part de l’application. Quand les 3 emplacements sont utilisés, le plus ancien est écrasé.',
          'Up to 3 full copies of the Align data, kept apart from the app. When all 3 slots are used, the oldest one is overwritten.',
        )}
      </p>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t('Nom', 'Name')}</th>
              <th>{t('Pris le', 'Taken on')}</th>
              <th>{t('Par', 'By')}</th>
              <th>{t('Contenu', 'Contents')}</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) =>
              isFilled(s) ? (
                <tr key={s.slot}>
                  <td>{s.name}</td>
                  <td className="muted small">{fmtDate(s.at, true)}</td>
                  <td className="muted small">{userName(s.by)}</td>
                  <td className="small">{summary(s.counts, t)}</td>
                </tr>
              ) : (
                <tr key={s.slot}>
                  <td colSpan={4} className="faint small">
                    {t(`Emplacement ${s.slot} libre`, `Slot ${s.slot} free`)}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {!canRestore && (
        <p className="faint small" style={{ margin: 0 }}>
          {t('La restauration est réservée aux personnes qui gèrent les Rocks, les priorités, les huddles et le plan.', 'Restoring is reserved to people who manage Rocks, priorities, huddles and the plan.')}
        </p>
      )}
      <div className="row row-wrap">
        <button className="btn btn-primary" onClick={onTake} disabled={busy || !canTake}>
          <Camera size={16} /> {t('Prendre un instantané', 'Take a snapshot')}
        </button>
        <button className="btn" onClick={onRestore} disabled={busy || !canRestore || !hasSource}>
          <RotateCcw size={16} /> {t('Restaurer…', 'Restore…')}
        </button>
      </div>
      {backup && (
        <p className="faint small" style={{ margin: 0 }}>
          {t(`Sauvegarde automatique prise le ${fmtDate(backup.at, true)} avant le dernier import KPI.`, `Automatic backup taken on ${fmtDate(backup.at, true)} before the last KPI import.`)}
        </p>
      )}
    </div>
  );
}
