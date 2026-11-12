import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '@/data/db';
import { useI18n, type L } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader, useToast } from '@/components/ui';
import { ArchiveCard, CurrentCard, DangerCard, RestoreCard, ResultPanel, SnapshotsCard } from '../Settings.cards';
import { EraseModal, ImportModal, RestoreModal, SnapshotWarningModal } from '../Settings.modals';
import {
  errorText,
  sumOf,
  type EraseResponse,
  type ImportResponse,
  type KpiDataStatus,
  type ModalKind,
  type RestoreResponse,
  type RestoreSource,
  type ResultData,
  type SnapshotMeta,
} from '../Settings.types';

const BASE = '/tools/kpi/data';

type Busy = '' | 'import' | 'snapshot' | 'restore' | 'erase';

const BUSY_TEXT: Record<Exclude<Busy, ''>, L> = {
  import: { fr: 'Importation en cours…', en: 'Importing…' },
  snapshot: { fr: 'Instantané en cours…', en: 'Taking snapshot…' },
  restore: { fr: 'Restauration en cours…', en: 'Restoring…' },
  erase: { fr: 'Effacement en cours…', en: 'Erasing…' },
};

/** Outils → KPI → Paramètres: import of the archived old data, snapshots, restore, erase. Requires tools.kpi.data. */
export function Settings() {
  const { t } = useI18n();
  const toast = useToast();
  const [status, setStatus] = useState<KpiDataStatus | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<Busy>('');
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);

  const load = useCallback(async (): Promise<KpiDataStatus | null> => {
    try {
      const s = await api<KpiDataStatus>(`${BASE}/status`);
      setStatus(s);
      setLoadError('');
      return s;
    } catch (e) {
      setLoadError(errorText(e));
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const importArchive = async () => {
    setModal(null);
    setBusy('import');
    try {
      const r = await api<ImportResponse>(`${BASE}/import`, { method: 'POST' });
      setResult({ title: t('Résultat de l’importation', 'Import result'), counts: r.report.counts, skipped: r.skipped, report: r.report });
      toast(t('Anciennes données importées', 'Old data imported'));
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setBusy('');
      await load();
    }
  };

  /** Takes a snapshot; overwriteSlot confirms the overwrite of the oldest one when all slots are used. */
  const takeSnapshot = async (overwriteSlot?: number) => {
    setModal(null);
    setBusy('snapshot');
    try {
      const s = await api<SnapshotMeta>(`${BASE}/snapshot`, {
        method: 'POST',
        body: overwriteSlot === undefined ? {} : { overwriteSlot },
      });
      toast(t(`Instantané pris : ${s.name}`, `Snapshot taken: ${s.name}`));
    } catch (e) {
      toast(errorText(e), 'err');
      // 409: all slots are used and the oldest changed or was not confirmed. Ask again with the fresh status.
      if (e instanceof ApiError && e.status === 409) setModal('snapshotWarn');
    } finally {
      setBusy('');
      await load();
    }
  };

  const onTakeSnapshot = () => {
    if (status && status.snapshots.length >= status.maxSnapshots) setModal('snapshotWarn');
    else void takeSnapshot();
  };

  const restore = async (source: RestoreSource) => {
    setModal(null);
    setBusy('restore');
    try {
      const r = await api<RestoreResponse>(`${BASE}/restore`, { method: 'POST', body: source });
      setResult({
        title: t('Résultat de la restauration', 'Restore result'),
        counts: r.counts,
        skipped: r.skipped,
        report: r.report,
      });
      toast(t('Données KPI restaurées', 'KPI data restored'));
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setBusy('');
      await load();
    }
  };

  const erase = async () => {
    setModal(null);
    setBusy('erase');
    try {
      const r = await api<EraseResponse>(`${BASE}/erase`, { method: 'POST', body: { confirm: 'EFFACER' } });
      setResult({ title: t('Données KPI effacées', 'KPI data erased'), counts: r.erased, skipped: 0 });
      toast(t('Données KPI effacées', 'KPI data erased'));
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setBusy('');
      await load();
    }
  };

  if (!status) {
    return (
      <Page>
        <PageHeader eyebrow={t('Outils · KPI', 'Tools · KPI')} title={t('Paramètres — données KPI', 'Settings — KPI data')} />
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

  return (
    <Page>
      <PageHeader eyebrow={t('Outils · KPI', 'Tools · KPI')} title={t('Paramètres — données KPI', 'Settings — KPI data')} />

      {loadError && <div className="alert alert-err" style={{ marginBottom: 16 }}>{loadError}</div>}
      {busy && <div className="alert alert-info" style={{ marginBottom: 16 }}>{t(BUSY_TEXT[busy])}</div>}
      {result && (
        <div style={{ marginBottom: 20 }}>
          <ResultPanel result={result} onClose={() => setResult(null)} />
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <CurrentCard current={status.current} />
        <ArchiveCard archive={status.archive} disabled={locked} onImport={() => setModal('import')} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <SnapshotsCard snapshots={status.snapshots} maxSnapshots={status.maxSnapshots} disabled={locked} onTake={onTakeSnapshot} />
      </div>

      <div className="grid-2">
        <RestoreCard disabled={locked} onOpen={() => setModal('restore')} />
        <DangerCard disabled={locked} onOpen={() => setModal('erase')} />
      </div>

      <ImportModal
        open={modal === 'import'}
        currentTotal={sumOf(status.current)}
        onClose={() => setModal(null)}
        onConfirm={() => void importArchive()}
      />
      <SnapshotWarningModal
        open={modal === 'snapshotWarn'}
        next={status.nextOverwrite}
        maxSnapshots={status.maxSnapshots}
        onClose={() => setModal(null)}
        onConfirm={() => void takeSnapshot(status.nextOverwrite?.slot)}
      />
      <RestoreModal
        open={modal === 'restore'}
        archive={status.archive}
        snapshots={status.snapshots}
        onClose={() => setModal(null)}
        onConfirm={(source) => void restore(source)}
      />
      <EraseModal
        open={modal === 'erase'}
        current={status.current}
        onClose={() => setModal(null)}
        onConfirm={() => void erase()}
      />
    </Page>
  );
}
