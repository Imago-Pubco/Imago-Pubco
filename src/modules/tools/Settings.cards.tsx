import { AlertTriangle, Archive, ArchiveRestore, Camera, CheckCircle2, Database, RotateCcw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useUserName } from '@/data/hooks';
import {
  ARCHIVE_KEYS,
  CURRENT_KEYS,
  countItems,
  countOf,
  labelOf,
  type ArchiveMeta,
  type CountItem,
  type Counts,
  type ImportReport,
  type ResultData,
  type SnapshotMeta,
} from './Settings.types';

/* ---------------- Shared pieces ---------------- */

/** Compact grid of labelled numbers. */
function CountGrid({ items }: { items: CountItem[] }) {
  const { t, fmtNum } = useI18n();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
      {items.map((i) => (
        <div key={i.label.fr} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 10px', background: 'var(--bg-sunken)' }}>
          <div className="faint small">{t(i.label)}</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{fmtNum(i.value)}</div>
        </div>
      ))}
    </div>
  );
}

/** One label / value line of a details block. */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', gap: 16 }}>
      <span className="muted">{label}</span>
      <span className="small" style={{ textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

/* ---------------- Current data ---------------- */

export function CurrentCard({ current }: { current: Counts }) {
  const { t } = useI18n();
  return (
    <div className="card card-pad stack">
      <div className="row">
        <Database size={20} color="var(--accent)" />
        <h3>{t('Données actuelles', 'Current data')}</h3>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {t('Le contenu actuel de la section KPI de l’application.', 'What the KPI section of the app holds today.')}
      </p>
      <CountGrid items={countItems(current, CURRENT_KEYS)} />
    </div>
  );
}

/* ---------------- Old data (archive) ---------------- */

interface ArchiveCardProps {
  archive: ArchiveMeta | null;
  disabled: boolean;
  onImport: () => void;
}

export function ArchiveCard({ archive, disabled, onImport }: ArchiveCardProps) {
  const { t, fmtDate } = useI18n();
  return (
    <div className="card card-pad stack">
      <div className="row">
        <Archive size={20} color="var(--accent)" />
        <h3>{t('Anciennes données (archivées)', 'Old data (archived)')}</h3>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {t(
          'Les données exportées d’Align sont conservées cachées sur le serveur et ne sont jamais affichées dans l’application. Rien sur cette page ne les efface.',
          'Data exported from Align is stored hidden on the server and is never shown in the app. Nothing on this page ever erases it.',
        )}
      </p>

      {archive ? (
        <>
          <div className="stack" style={{ gap: 6 }}>
            <MetaRow label={t('Société', 'Company')} value={archive.company} />
            <MetaRow label={t('Exportées le', 'Exported on')} value={fmtDate(archive.exportedAt, true)} />
            <MetaRow label={t('Chargées le', 'Loaded on')} value={fmtDate(archive.loadedAt, true)} />
          </div>
          <CountGrid items={ARCHIVE_KEYS.map((k) => ({ label: labelOf(k), value: archive.counts[k] }))} />
        </>
      ) : (
        <div className="alert alert-warn">
          {t(
            'Aucune archive n’est chargée sur le serveur. Un administrateur la charge avec le script server/scripts/load-kpi-archive.ts.',
            'No archive is loaded on the server. An administrator loads it with the server script server/scripts/load-kpi-archive.ts.',
          )}
        </div>
      )}

      <div>
        <button className="btn btn-primary" onClick={onImport} disabled={disabled || !archive}>
          <ArchiveRestore size={16} /> {t('Importer les anciennes données', 'Import old data')}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Snapshots ---------------- */

interface SnapshotsCardProps {
  snapshots: SnapshotMeta[];
  maxSnapshots: number;
  disabled: boolean;
  onTake: () => void;
}

export function SnapshotsCard({ snapshots, maxSnapshots, disabled, onTake }: SnapshotsCardProps) {
  const { t, fmtDate, fmtNum } = useI18n();
  const userName = useUserName();
  const sorted = [...snapshots].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  const freeSlots = Math.max(0, maxSnapshots - snapshots.length);

  return (
    <div className="card card-pad stack">
      <div className="row">
        <Camera size={20} color="var(--accent)" />
        <h3>{t('Instantanés', 'Snapshots')}</h3>
        <span className="spacer" />
        <span className="faint small">
          {snapshots.length} / {maxSnapshots}
        </span>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {t(
          `Jusqu’à ${maxSnapshots} instantanés des données KPI, gardés à part de l’application. Rien sur cette page ne les efface. Quand tous les emplacements sont utilisés, le plus ancien est écrasé.`,
          `Up to ${maxSnapshots} snapshots of the KPI data, kept apart from the app. Nothing on this page erases them. When every slot is used, the oldest one is overwritten.`,
        )}
      </p>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t('Nom', 'Name')}</th>
              <th>{t('Pris le', 'Taken on')}</th>
              <th>{t('Par', 'By')}</th>
              <th className="num">{t('Indicateurs', 'Indicators')}</th>
              <th className="num">{t('Valeurs', 'Values')}</th>
              <th className="num">{t('Priorités', 'Priorities')}</th>
              <th className="num">{t('Huddles', 'Huddles')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.slot}>
                <td>{s.name}</td>
                <td className="muted small">{fmtDate(s.takenAt, true)}</td>
                <td className="muted small">{userName(s.takenBy)}</td>
                <td className="num">{fmtNum(countOf(s.counts, 'kpis'))}</td>
                <td className="num">{fmtNum(countOf(s.counts, 'kpiValues'))}</td>
                <td className="num">{fmtNum(countOf(s.counts, 'priorities'))}</td>
                <td className="num">{fmtNum(countOf(s.counts, 'huddles'))}</td>
              </tr>
            ))}
            {Array.from({ length: freeSlots }, (_, i) => (
              <tr key={`free-${i}`}>
                <td colSpan={7} className="faint small">
                  {t('Emplacement libre', 'Free slot')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <button className="btn btn-primary" onClick={onTake} disabled={disabled}>
          <Camera size={16} /> {t('Prendre un instantané', 'Take a snapshot')}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Restore / danger ---------------- */

export function RestoreCard({ disabled, onOpen }: { disabled: boolean; onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <div className="card card-pad stack">
      <div className="row">
        <RotateCcw size={20} color="var(--accent)" />
        <h3>{t('Restaurer', 'Restore')}</h3>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {t(
          'Remplacer les données KPI actuelles par l’archive des anciennes données ou par un instantané.',
          'Replace the current KPI data with the archive of old data or with a snapshot.',
        )}
      </p>
      <div>
        <button className="btn" onClick={onOpen} disabled={disabled}>
          <RotateCcw size={16} /> {t('Restaurer…', 'Restore…')}
        </button>
      </div>
    </div>
  );
}

export function DangerCard({ disabled, onOpen }: { disabled: boolean; onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <div className="card card-pad stack" style={{ border: '1px solid var(--err)' }}>
      <div className="row">
        <AlertTriangle size={20} color="var(--err)" />
        <h3 style={{ color: 'var(--err)' }}>{t('Zone dangereuse', 'Danger zone')}</h3>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {t(
          'Efface toutes les données KPI actuelles de l’application. L’archive et les instantanés sont conservés.',
          'Erases all current KPI data in the app. The archive and the snapshots are kept.',
        )}
      </p>
      <div>
        <button className="btn btn-danger" onClick={onOpen} disabled={disabled}>
          {t('Effacer toutes les données KPI', 'Erase all KPI data')}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Result panel ---------------- */

export function ResultPanel({ result, onClose }: { result: ResultData; onClose: () => void }) {
  const { t, fmtNum } = useI18n();
  const report: ImportReport | undefined = result.report;
  const invalid = report ? Object.entries(report.invalid).filter(([, n]) => n > 0) : [];

  return (
    <div className="card card-pad stack">
      <div className="row">
        <CheckCircle2 size={20} color="var(--ok)" />
        <h3>{result.title}</h3>
        <span className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          {t('Fermer', 'Close')}
        </button>
      </div>

      <CountGrid items={countItems(result.counts, Object.keys(result.counts))} />

      {report && report.unmatchedPeople.length > 0 && (
        <div className="alert alert-warn stack" style={{ gap: 6 }}>
          <strong>
            {t(
              `${report.unmatchedPeople.length} personne(s) sans compte dans Imago`,
              `${report.unmatchedPeople.length} person(s) without an Imago account`,
            )}
          </strong>
          <span>
            {t(
              'Ces personnes n’ont pas encore de compte dans Imago : leurs liens (responsable, membre) sont laissés vides. Créez leur compte puis réimportez.',
              'These people do not have an Imago account yet: their links (owner, member) are left empty. Create their account, then import again.',
            )}
          </span>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {report.unmatchedPeople.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      )}

      {report && report.notes.length > 0 && (
        <div>
          <strong className="small">{t('Remarques', 'Notes')}</strong>
          <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {report.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {result.skipped > 0 && (
        <p className="small" style={{ margin: 0 }}>
          {t('Éléments ignorés', 'Skipped items')} : {fmtNum(result.skipped)}
        </p>
      )}

      {invalid.length > 0 && (
        <p className="small" style={{ margin: 0 }}>
          {t('Éléments invalides', 'Invalid items')} : {invalid.map(([k, n]) => `${t(labelOf(k))} ${fmtNum(n)}`).join(' · ')}
        </p>
      )}
    </div>
  );
}
