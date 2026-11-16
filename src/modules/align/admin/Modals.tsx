import { useState } from 'react';
import { Modal } from '@/components/ui';
import { useI18n } from '@/i18n';
import { ALIGN_COUNT_ITEMS, isFilled, type AlignBackup, type AlignCounts, type AlignSlot, type ArchiveParts, type RestoreSource } from './types';

/* ---------------- Archive reload ---------------- */

interface ArchiveModalProps {
  parts: ArchiveParts;
  checklistCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

/** Explains exactly what the reload replaces and what it only adds. */
export function ArchiveModal({ parts, checklistCount, onClose, onConfirm }: ArchiveModalProps) {
  const { t } = useI18n();
  const replaces = !!(parts.strategy || parts.checklist);
  return (
    <Modal
      open
      onClose={onClose}
      title={t('Recharger l’archive Align ?', 'Reload the Align archive?')}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t('Annuler', 'Cancel')}
          </button>
          <button className={replaces ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>
            {t('Recharger', 'Reload')}
          </button>
        </>
      }
    >
      <div className="stack">
        {parts.strategy && (
          <p style={{ margin: 0 }}>
            <strong>{t('Plan stratégique : REMPLACÉ.', 'Strategic plan: REPLACED.')}</strong>{' '}
            {t('Le plan actuel est remplacé par le plan complet de l’archive.', 'The current plan is replaced by the full plan from the archive.')}
          </p>
        )}
        {parts.checklist && (
          <p style={{ margin: 0 }}>
            <strong>{t('Liste de vérification : REMPLACÉE.', 'Checklist: REPLACED.')}</strong>{' '}
            {t(
              `Les points cochés et les notes actuels sont perdus. Les ${checklistCount} points de l’archive remplacent la liste.`,
              `Current ticks and notes are lost. The ${checklistCount} points of the archive replace the list.`,
            )}
          </p>
        )}
        {parts.rocks && (
          <p style={{ margin: 0 }}>
            <strong>{t('Rocks du trimestre : AJOUTÉS seulement s’ils manquent.', 'Rocks of the quarter: ADDED only when missing.')}</strong>{' '}
            {t(
              'Un Rock dont le titre existe déjà n’est ni modifié ni doublé. Les autres Rocks et leurs priorités sont gardés.',
              'A Rock whose title already exists is neither changed nor duplicated. Other Rocks and their priorities are kept.',
            )}
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- Snapshot overwrite ---------------- */

interface SnapshotWarningModalProps {
  oldest: AlignSlot | undefined;
  onClose: () => void;
  onConfirm: () => void;
}

/** All 3 slots are used: says which snapshot the new one will overwrite. */
export function SnapshotWarningModal({ oldest, onClose, onConfirm }: SnapshotWarningModalProps) {
  const { t, fmtDate } = useI18n();
  const name = oldest && isFilled(oldest) ? `« ${oldest.name} » (${fmtDate(oldest.at, true)})` : '';
  return (
    <Modal
      open
      onClose={onClose}
      title={t('Remplacer un instantané ?', 'Overwrite a snapshot?')}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t('Annuler', 'Cancel')}
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            {t('Écraser et prendre l’instantané', 'Overwrite and take the snapshot')}
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>
        {t(
          `Les 3 emplacements sont utilisés. Le nouvel instantané écrasera le plus ancien : ${name}. Continuer ?`,
          `All 3 slots are used. The new snapshot will overwrite the oldest one: ${name}. Continue?`,
        )}
      </p>
    </Modal>
  );
}

/* ---------------- Restore ---------------- */

interface RestoreModalProps {
  snapshots: AlignSlot[];
  backup: AlignBackup | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (source: RestoreSource) => void;
}

/** Choose a source, then type REMPLACER. The current Align data is replaced. */
export function RestoreModal({ snapshots, backup, busy, onClose, onConfirm }: RestoreModalProps) {
  const { t, fmtDate } = useI18n();
  const filled = snapshots.filter(isFilled);
  const [choice, setChoice] = useState<string>(filled[0] ? `snap:${filled[0].slot}` : 'backup');
  const [typed, setTyped] = useState('');
  const ok = typed.trim().toUpperCase() === 'REMPLACER' && (choice !== 'backup' || !!backup);
  const source = (): RestoreSource => (choice === 'backup' ? { source: 'backup' } : { source: 'snapshot', slot: Number(choice.slice(5)) });

  const radio = (value: string, label: string, hint: string) => (
    <label key={value} className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
      <input type="radio" name="align-restore-source" checked={choice === value} onChange={() => setChoice(value)} style={{ marginTop: 3 }} />
      <span className="stack" style={{ gap: 2 }}>
        <span>{label}</span>
        <span className="faint small">{hint}</span>
      </span>
    </label>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={t('Restaurer des données Align', 'Restore Align data')}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t('Annuler', 'Cancel')}
          </button>
          <button className="btn btn-danger" onClick={() => onConfirm(source())} disabled={busy || !ok}>
            {t('Restaurer', 'Restore')}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="alert alert-err">
          {t(
            'Les données Align actuelles seront REMPLACÉES par la source choisie. Pensez à prendre un instantané avant.',
            'The current Align data will be REPLACED by the chosen source. Take a snapshot first.',
          )}
        </div>
        {filled.length === 0 && !backup && (
          <p className="muted" style={{ margin: 0 }}>
            {t('Aucun instantané ni sauvegarde à restaurer.', 'No snapshot or backup to restore.')}
          </p>
        )}
        <div className="stack" style={{ gap: 10 }}>
          {filled.map((s) => radio(`snap:${s.slot}`, s.name, t(`Instantané ${s.slot} · pris le ${fmtDate(s.at, true)}`, `Snapshot ${s.slot} · taken on ${fmtDate(s.at, true)}`)))}
          {backup &&
            radio(
              'backup',
              t('Sauvegarde avant le dernier import KPI', 'Backup before the last KPI import'),
              t(
                `Prise le ${fmtDate(backup.at, true)}. Restaure seulement les Rocks, priorités, notes et huddles.`,
                `Taken on ${fmtDate(backup.at, true)}. Restores only Rocks, priorities, notes and huddles.`,
              ),
            )}
        </div>
        <label className="field">
          <span>{t('Tapez REMPLACER pour confirmer', 'Type REMPLACER to confirm')}</span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </label>
      </div>
    </Modal>
  );
}

/* ---------------- Erase ---------------- */

interface EraseModalProps {
  counts: AlignCounts;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Shows what will be erased; the button stays off until EFFACER is typed. */
export function EraseModal({ counts, busy, onClose, onConfirm }: EraseModalProps) {
  const { t, fmtNum } = useI18n();
  const [typed, setTyped] = useState('');
  const total = ALIGN_COUNT_ITEMS.reduce((n, i) => n + (counts[i.key] ?? 0), 0);
  const detail = ALIGN_COUNT_ITEMS.map((i) => `${t(i.label)} ${fmtNum(counts[i.key] ?? 0)}`).join(', ');
  return (
    <Modal
      open
      onClose={onClose}
      title={t('Effacer toutes les données Align ?', 'Erase all Align data?')}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t('Annuler', 'Cancel')}
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy || typed.trim().toUpperCase() !== 'EFFACER'}>
            {t('Effacer', 'Erase')}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="alert alert-err">
          {t(
            `Cette opération efface ${fmtNum(total)} éléments d’Align : ${detail}. Elle ne peut pas être annulée.`,
            `This erases ${fmtNum(total)} Align items: ${detail}. It cannot be undone.`,
          )}
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          {t('Les instantanés et la sauvegarde sont conservés.', 'Snapshots and the backup are kept.')}
        </p>
        <label className="field">
          <span>{t('Tapez EFFACER pour confirmer', 'Type EFFACER to confirm')}</span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </label>
      </div>
    </Modal>
  );
}
