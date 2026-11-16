import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/data/db';
import { useI18n, type L } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader, useToast } from '@/components/ui';
import { alignData } from '../admin/dataApi';
import { ArchiveCard, CurrentCard, DangerCard } from '../admin/Cards';
import { ImportCard } from '../admin/ImportCard';
import { ArchiveModal, EraseModal, RestoreModal, SnapshotWarningModal } from '../admin/Modals';
import { SnapshotsCard } from '../admin/SnapshotsCard';
import { DemoCard } from '../admin/DemoCard';
import { errorText, isFilled, REPLACE_RIGHTS, type AlignCounts, type AlignDataStatus, type ArchiveParts, type ArchiveResult, type RestoreSource } from '../admin/types';

type Busy = '' | 'snapshot' | 'archive' | 'restore' | 'erase';

const BUSY_TEXT: Record<Exclude<Busy, ''>, L> = {
  snapshot: { fr: 'Instantané en cours…', en: 'Taking snapshot…' },
  archive: { fr: 'Rechargement de l’archive en cours…', en: 'Reloading the archive…' },
  restore: { fr: 'Restauration en cours…', en: 'Restoring…' },
  erase: { fr: 'Effacement en cours…', en: 'Erasing…' },
};

type ModalState = { kind: 'archive'; parts: ArchiveParts } | { kind: 'snapshotWarn' } | { kind: 'restore' } | { kind: 'erase' } | null;

const sum = (counts: AlignCounts) => Object.values(counts).reduce((n, v) => n + v, 0);

/** Administration → Modules → Align: KPI import, archive reload, snapshots, restore and erase of the Align data. */
export function Settings() {
  const { t } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<AlignDataStatus | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<Busy>('');
  const [modal, setModal] = useState<ModalState>(null);

  const canRead = can('align.data');
  const canReplace = REPLACE_RIGHTS.every((p) => can(p));

  const load = useCallback(async () => {
    try {
      setStatus(await alignData.status());
      setLoadError('');
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, []);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  /** Runs one operation: busy state, toast of the outcome, then a fresh status. */
  const act = async (kind: Exclude<Busy, ''>, job: () => Promise<string>) => {
    setBusy(kind);
    try {
      toast(await job());
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setBusy('');
      await load();
    }
  };

  const onTakeSnapshot = async () => {
    setBusy('snapshot');
    try {
      const s = await alignData.snapshot(false, user!.id);
      toast(t(`Instantané pris : ${s.name}`, `Snapshot taken: ${s.name}`));
    } catch (e) {
      // 409: the 3 slots are used. Ask which snapshot the new one will overwrite, then retry with overwrite.
      if (e instanceof ApiError && e.status === 409) setModal({ kind: 'snapshotWarn' });
      else toast(errorText(e), 'err');
    } finally {
      setBusy('');
      await load();
    }
  };

  const overwriteSnapshot = () => {
    setModal(null);
    void act('snapshot', async () => {
      const s = await alignData.snapshot(true, user!.id);
      return t(`Instantané pris : ${s.name}`, `Snapshot taken: ${s.name}`);
    });
  };

  const reloadArchive = (parts: ArchiveParts) => {
    setModal(null);
    void act('archive', async () => {
      const r: ArchiveResult = await alignData.archive(parts);
      const bits: string[] = [];
      if (r.strategy) bits.push(t('plan stratégique remplacé', 'strategic plan replaced'));
      if (r.checklist !== undefined) bits.push(t(`${r.checklist} points de liste de vérification`, `${r.checklist} checklist points`));
      if (r.rocks !== undefined) bits.push(t(`${r.rocks} Rock(s) ajouté(s)`, `${r.rocks} Rock(s) added`));
      return t(`Archive rechargée : ${bits.join(', ')}`, `Archive reloaded: ${bits.join(', ')}`);
    });
  };

  const restore = (source: RestoreSource) => {
    setModal(null);
    void act('restore', async () => {
      const r = await alignData.restore(source);
      return t(`Données Align restaurées : ${sum(r.counts)} éléments`, `Align data restored: ${sum(r.counts)} items`);
    });
  };

  const erase = () => {
    setModal(null);
    void act('erase', async () => {
      await alignData.erase();
      return t('Données Align effacées', 'Align data erased');
    });
  };

  const header = (
    <PageHeader
      eyebrow={t('Administration · Modules', 'Administration · Modules')}
      title={t('Align — données', 'Align — data')}
      subtitle={t('Importer, archiver, instantanés, restaurer et effacer les données Align.', 'Import, archive, snapshots, restore and erase the Align data.')}
    />
  );

  if (!canRead) {
    return (
      <Page>
        {header}
        <div className="alert alert-warn">{t('Accès réservé aux personnes autorisées à gérer les données Align.', 'Access reserved to people allowed to manage Align data.')}</div>
      </Page>
    );
  }

  if (!status) {
    return (
      <Page>
        {header}
        {loadError ? (
          <div className="alert alert-err row-wrap" style={{ alignItems: 'center' }}>
            <span>{loadError}</span>
            <span className="spacer" />
            <button className="btn btn-sm" onClick={() => void load()}>
              {t('Réessayer', 'Retry')}
            </button>
          </div>
        ) : (
          <p className="muted">{t('Chargement…', 'Loading…')}</p>
        )}
      </Page>
    );
  }

  const locked = busy !== '';
  const oldest = status.snapshots.filter(isFilled).sort((a, b) => a.at.localeCompare(b.at))[0];

  return (
    <Page>
      {header}

      {loadError && <div className="alert alert-err" style={{ marginBottom: 16 }}>{loadError}</div>}
      {busy && <div className="alert alert-info" style={{ marginBottom: 16 }}>{t(BUSY_TEXT[busy])}</div>}

      <div className="stack" style={{ gap: 20 }}>
        <div className="grid-2">
          <CurrentCard counts={status.counts} />
          <ArchiveCard archive={status.archive} canReplace={canReplace} busy={locked} onAsk={(parts) => setModal({ kind: 'archive', parts })} />
        </div>

        <ImportCard />

        <DemoCard />

        <SnapshotsCard
          snapshots={status.snapshots}
          backup={status.backup}
          busy={locked}
          canTake={canRead}
          canRestore={canReplace}
          onTake={() => void onTakeSnapshot()}
          onRestore={() => setModal({ kind: 'restore' })}
        />

        <DangerCard disabled={locked || !canReplace} canReplace={canReplace} onOpen={() => setModal({ kind: 'erase' })} />
      </div>

      {modal?.kind === 'archive' && (
        <ArchiveModal
          parts={modal.parts}
          checklistCount={status.archive.checklist}
          onClose={() => setModal(null)}
          onConfirm={() => reloadArchive(modal.parts)}
        />
      )}
      {modal?.kind === 'snapshotWarn' && <SnapshotWarningModal oldest={oldest} onClose={() => setModal(null)} onConfirm={overwriteSnapshot} />}
      {modal?.kind === 'restore' && (
        <RestoreModal
          snapshots={status.snapshots}
          backup={status.backup}
          busy={locked}
          onClose={() => setModal(null)}
          onConfirm={(source) => restore(source)}
        />
      )}
      {modal?.kind === 'erase' && <EraseModal counts={status.counts} busy={locked} onClose={() => setModal(null)} onConfirm={erase} />}
    </Page>
  );
}
