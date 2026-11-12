import { useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui';
import { useI18n, type L } from '@/i18n';
import { CURRENT_KEYS, SUMMARY_KEYS, countItems, sumOf, type ArchiveMeta, type CountItem, type Counts, type RestoreSource, type SnapshotMeta } from './Settings.types';

/** "Indicateurs 3 · Valeurs d’indicateurs 40 …" for a set of counts. */
function summaryLine(items: CountItem[], t: (label: L) => string): string {
  return items.map((i) => `${t(i.label)} ${i.value}`).join(' · ');
}

/* ---------------- Import ---------------- */

interface ImportModalProps {
  open: boolean;
  currentTotal: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function ImportModal({ open, currentTotal, onClose, onConfirm }: ImportModalProps) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Importer les anciennes données ?', 'Import old data?')}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t('Annuler', 'Cancel')}
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            {t('Importer', 'Import')}
          </button>
        </>
      }
    >
      {currentTotal > 0 ? (
        <div className="alert alert-err">
          {t(
            `Cette opération REMPLACE toutes les données KPI actuelles (${currentTotal} éléments) par les anciennes données d’Align. Nous vous suggérons de prendre d’abord un instantané.`,
            `This REPLACES all current KPI data (${currentTotal} items) with the old Align data. We suggest taking a snapshot first.`,
          )}
        </div>
      ) : (
        <p style={{ margin: 0 }}>
          {t(
            'Les anciennes données d’Align seront importées dans l’outil KPI. Il n’y a pas de données KPI actuelles.',
            'The old Align data will be imported into the KPI tool. There is no current KPI data.',
          )}
        </p>
      )}
    </Modal>
  );
}

/* ---------------- Snapshot overwrite warning ---------------- */

interface SnapshotWarningModalProps {
  open: boolean;
  next: SnapshotMeta | null;
  maxSnapshots: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function SnapshotWarningModal({ open, next, maxSnapshots, onClose, onConfirm }: SnapshotWarningModalProps) {
  const { t, fmtDate } = useI18n();
  const text = next
    ? t(
        `Les ${maxSnapshots} instantanés sont utilisés. Prendre un nouvel instantané écrasera le plus ancien : « ${next.name} » (${fmtDate(next.takenAt, true)}). Continuer ?`,
        `All ${maxSnapshots} snapshots are used. Taking a new snapshot will overwrite the oldest one: “${next.name}” (${fmtDate(next.takenAt, true)}). Continue?`,
      )
    : t(
        `Les ${maxSnapshots} instantanés sont utilisés. Prendre un nouvel instantané écrasera le plus ancien. Continuer ?`,
        `All ${maxSnapshots} snapshots are used. Taking a new snapshot will overwrite the oldest one. Continue?`,
      );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Écraser un instantané ?', 'Overwrite a snapshot?')}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t('Annuler', 'Cancel')}
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            {t('Écraser et prendre un instantané', 'Overwrite and take a snapshot')}
          </button>
        </>
      }
    >
      <div className="alert alert-warn">{text}</div>
    </Modal>
  );
}

/* ---------------- Restore ---------------- */

interface RestoreOption {
  key: string;
  source: RestoreSource;
  disabled: boolean;
  title: string;
  detail: string;
}

interface RestoreModalProps {
  open: boolean;
  archive: ArchiveMeta | null;
  snapshots: SnapshotMeta[];
  onClose: () => void;
  onConfirm: (source: RestoreSource) => void;
}

/** Step 1: choose the source. Once chosen, a red notice says what will be replaced. */
export function RestoreModal({ open, archive, snapshots, onClose, onConfirm }: RestoreModalProps) {
  const { t, fmtDate } = useI18n();
  const [choice, setChoice] = useState('');

  const close = () => {
    setChoice('');
    onClose();
  };

  const options: RestoreOption[] = [
    {
      key: 'archive',
      source: { source: 'archive' },
      disabled: !archive,
      title: t('L’archive des anciennes données (Align)', 'The archive of old data (Align)'),
      detail: archive
        ? `${archive.company} · ${fmtDate(archive.exportedAt, true)}`
        : t('Aucune archive chargée sur le serveur.', 'No archive loaded on the server.'),
    },
    ...snapshots.map((s) => ({
      key: `slot-${s.slot}`,
      source: { source: 'snapshot', slot: s.slot } as RestoreSource,
      disabled: false,
      title: s.name,
      detail: `${fmtDate(s.takenAt, true)} · ${summaryLine(countItems(s.counts, SUMMARY_KEYS), t)}`,
    })),
  ];
  const picked = options.find((o) => o.key === choice && !o.disabled);
  const nothingToRestore = !archive && snapshots.length === 0;

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('Restaurer les données KPI', 'Restore KPI data')}
      footer={
        <>
          <button className="btn" onClick={close}>
            {t('Annuler', 'Cancel')}
          </button>
          <button
            className="btn btn-primary"
            disabled={!picked}
            onClick={() => {
              if (!picked) return;
              setChoice('');
              onConfirm(picked.source);
            }}
          >
            {t('Restaurer', 'Restore')}
          </button>
        </>
      }
    >
      <div className="stack">
        {nothingToRestore ? (
          <p className="muted" style={{ margin: 0 }}>
            {t('Aucune source de restauration n’est disponible.', 'No restore source is available.')}
          </p>
        ) : (
          <>
            <p className="muted small" style={{ margin: 0 }}>
              {t('Choisissez la source à restaurer :', 'Choose the source to restore from:')}
            </p>
            {options.map((o) => (
              <label key={o.key} className="check" style={{ alignItems: 'flex-start', opacity: o.disabled ? 0.5 : 1 }}>
                <input
                  type="radio"
                  name="restore-source"
                  value={o.key}
                  checked={choice === o.key}
                  disabled={o.disabled}
                  onChange={() => setChoice(o.key)}
                  style={{ marginTop: 4 }}
                />
                <span>
                  <strong>{o.title}</strong>
                  <span className="faint small" style={{ display: 'block' }}>
                    {o.detail}
                  </span>
                </span>
              </label>
            ))}
          </>
        )}

        {picked && (
          <div className="alert alert-err">
            {t(
              `Les données KPI actuelles seront REMPLACÉES par : ${picked.title}. Prenez d’abord un instantané si vous voulez les conserver.`,
              `The current KPI data will be REPLACED by: ${picked.title}. Take a snapshot first if you want to keep it.`,
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- Erase ---------------- */

interface EraseModalProps {
  open: boolean;
  current: Counts;
  onClose: () => void;
  onConfirm: () => void;
}

const CONFIRM_WORD = 'EFFACER';

/** Erase everything live; the archive and snapshots are never touched. Requires typing EFFACER. */
export function EraseModal({ open, current, onClose, onConfirm }: EraseModalProps) {
  const { t, fmtNum } = useI18n();
  const [typed, setTyped] = useState('');
  const ready = typed === CONFIRM_WORD;

  const close = () => {
    setTyped('');
    onClose();
  };

  const list: ReactNode = countItems(current, CURRENT_KEYS).map((i) => (
    <li key={i.label.fr}>
      {t(i.label)} : {fmtNum(i.value)}
    </li>
  ));

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('Effacer toutes les données KPI ?', 'Erase all KPI data?')}
      footer={
        <>
          <button className="btn" onClick={close}>
            {t('Annuler', 'Cancel')}
          </button>
          <button
            className="btn btn-danger"
            disabled={!ready}
            onClick={() => {
              setTyped('');
              onConfirm();
            }}
          >
            {t('Effacer toutes les données KPI', 'Erase all KPI data')}
          </button>
        </>
      }
    >
      <div className="stack">
        <p style={{ margin: 0 }}>
          <strong>
            {t(
              `Cette action efface TOUT ce qui se trouve dans la section KPI de l’application de production (${sumOf(current)} éléments) :`,
              `This erases EVERYTHING in the KPI section of the production app (${sumOf(current)} items):`,
            )}
          </strong>
        </p>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {list}
        </ul>
        <p className="small" style={{ margin: 0 }}>
          {t('L’archive des anciennes données et tous les instantanés sont conservés.', 'The archive of old data and all snapshots are kept.')}
        </p>
        <p className="small" style={{ margin: 0 }}>
          <strong>
            {t(
              'Cette action ne peut pas être annulée, sauf en restaurant les données depuis l’archive ou un instantané.',
              'This cannot be undone, except by restoring the data from the archive or a snapshot.',
            )}
          </strong>
        </p>
        <label className="field">
          <span>{t('Tapez EFFACER pour confirmer', 'Type EFFACER to confirm')}</span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
      </div>
    </Modal>
  );
}
