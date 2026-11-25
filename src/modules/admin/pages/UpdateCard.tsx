/**
 * Administration › Système › Mise à jour: the running version, what is new on GitHub, and a button that asks the
 * server's updater (deploy/imago-update.sh) to install it — database backup, build, restart, health check, automatic
 * roll-back. The page follows the progress, survives the app's own restart, and reloads on the new version.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudDownload, GitCommitHorizontal, RefreshCw, RotateCcw, XCircle } from 'lucide-react';
import { api } from '@/data/db';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';

interface Commit {
  sha: string;
  subject: string;
  author: string;
  date: string;
}
interface UpdateStatus {
  state: 'working' | 'done' | 'failed' | 'rolled_back';
  step: string;
  message: string;
  kind: 'check' | 'apply';
  requestedBy: string;
  startedAt: string;
  finishedAt: string | null;
  checkedAt: string;
  branch: string;
  current: (Commit & { full: string }) | null;
  latest: (Commit & { full: string }) | null;
  behind: number;
  commits: Commit[];
  localChanges: boolean;
}
interface UpdateInfo {
  available: boolean;
  pending: boolean;
  status: UpdateStatus | null;
  log: string[];
}

const err = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function UpdateCard() {
  const { t, fmtDate } = useI18n();
  const toast = useToast();
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [offline, setOffline] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState('');
  const [showLog, setShowLog] = useState(false);
  const startSha = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const i = await api<UpdateInfo>('/system/update');
      setInfo(i);
      setOffline(false);
      // The app came back on a new version after an update: reload the page to load the new interface.
      if (startSha.current && i.status?.state === 'done' && i.status.current?.sha && i.status.current.sha !== startSha.current) {
        startSha.current = null;
        toast(t('Mise à jour installée. Rechargement…', 'Update installed. Reloading…'));
        setTimeout(() => location.reload(), 1500);
      }
    } catch {
      // During the update the app restarts: keep trying.
      setOffline(true);
    }
  }, [t, toast]);

  const busy = !!info && (info.pending || info.status?.state === 'working');
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), busy || offline ? 3000 : 30000);
    return () => clearInterval(timer);
  }, [load, busy, offline]);

  async function check() {
    try {
      await api('/system/update/check', { method: 'POST', body: {} });
      void load();
    } catch (e) {
      toast(err(e), 'err');
    }
  }

  async function apply() {
    try {
      startSha.current = info?.status?.current?.sha ?? null;
      await api('/system/update/apply', { method: 'POST', body: { confirm: 'METTRE À JOUR' } });
      setConfirm(false);
      setTyped('');
      setShowLog(true);
      void load();
    } catch (e) {
      toast(err(e), 'err');
    }
  }

  const s = info?.status;
  const stateBadge = !s ? null : s.state === 'working' ? (
    <span className="badge badge-info">
      <RefreshCw size={12} className="upd-spin" /> {s.step || t('En cours…', 'Working…')}
    </span>
  ) : s.state === 'done' ? (
    <span className="badge badge-ok">
      <CheckCircle2 size={12} /> {s.kind === 'apply' ? t('Mise à jour réussie', 'Update succeeded') : t('Vérifié', 'Checked')}
    </span>
  ) : s.state === 'rolled_back' ? (
    <span className="badge badge-warn">
      <RotateCcw size={12} /> {t('Retour à la version précédente', 'Rolled back')}
    </span>
  ) : (
    <span className="badge badge-err">
      <XCircle size={12} /> {t('Échec', 'Failed')}
    </span>
  );

  return (
    <div className="card card-pad stack upd-card">
      <div className="row">
        <CloudDownload size={20} color="var(--accent)" />
        <h3>{t('Mise à jour de l’application', 'Application update')}</h3>
        <span className="spacer" />
        {stateBadge}
      </div>

      {!info ? (
        <p className="muted small" style={{ margin: 0 }}>{t('Chargement…', 'Loading…')}</p>
      ) : !info.available ? (
        <div className="alert alert-warn">
          {t(
            'Le service de mise à jour n’est pas installé sur le serveur. Une seule fois, sur le serveur : « sudo bash deploy/install-updater.sh » (voir deploy/UPDATES.md).',
            'The update service is not installed on the server. Once, on the server: "sudo bash deploy/install-updater.sh" (see deploy/UPDATES.md).',
          )}
        </div>
      ) : (
        <>
          {offline && (
            <div className="alert alert-info">
              <RefreshCw size={14} className="upd-spin" /> {t('L’application redémarre… reconnexion automatique.', 'The app is restarting… reconnecting automatically.')}
            </div>
          )}

          <div className="upd-versions">
            <div>
              <div className="small muted">{t('Version en service', 'Running version')}</div>
              {s?.current ? (
                <div>
                  <span className="mono">{s.current.sha}</span> {s.current.subject}
                  <div className="small muted">{fmtDate(s.current.date, true)}</div>
                </div>
              ) : (
                <span className="muted">—</span>
              )}
            </div>
            <div>
              <div className="small muted">
                {t('Dernière version sur GitHub', 'Latest on GitHub')} ({s?.branch ?? 'main'})
              </div>
              {s?.latest ? (
                <div>
                  <span className="mono">{s.latest.sha}</span> {s.latest.subject}
                  <div className="small muted">
                    {t('Vérifié', 'Checked')} {s.checkedAt ? fmtDate(s.checkedAt, true) : ''}
                  </div>
                </div>
              ) : (
                <span className="muted">—</span>
              )}
            </div>
          </div>

          {s && s.behind > 0 ? (
            <div>
              <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>
                {t(`${s.behind} changement(s) à installer`, `${s.behind} change(s) to install`)}
              </div>
              <ul className="upd-commits">
                {s.commits.slice(0, 15).map((c) => (
                  <li key={c.sha}>
                    <GitCommitHorizontal size={13} />
                    <span className="mono small">{c.sha}</span>
                    <span className="upd-subject">{c.subject}</span>
                    <span className="small muted">{c.author}</span>
                  </li>
                ))}
                {s.commits.length > 15 && <li className="small muted">+ {s.commits.length - 15}</li>}
              </ul>
            </div>
          ) : s?.state !== 'working' && s?.latest ? (
            <div className="small" style={{ color: 'var(--ok)' }}>
              <CheckCircle2 size={14} /> {t('L’application est à jour.', 'The app is up to date.')}
            </div>
          ) : null}

          {s?.localChanges && (
            <div className="alert alert-warn">
              <AlertTriangle size={14} /> {t('Des fichiers ont été modifiés directement sur le serveur : la mise à jour automatique refusera de les écraser.', 'Files were changed directly on the server: the automatic update will refuse to overwrite them.')}
            </div>
          )}
          {s?.message && s.state !== 'working' && (
            <div className={`alert ${s.state === 'done' ? 'alert-info' : s.state === 'rolled_back' ? 'alert-warn' : 'alert-err'}`}>{s.message}</div>
          )}

          <div className="row row-wrap" style={{ gap: 8 }}>
            <button className="btn" disabled={busy || offline} onClick={() => void check()}>
              <RefreshCw size={15} /> {t('Vérifier sur GitHub', 'Check GitHub')}
            </button>
            <button className="btn btn-primary" disabled={busy || offline || !s || s.behind === 0} onClick={() => setConfirm(true)}>
              <CloudDownload size={15} /> {t('Mettre à jour maintenant', 'Update now')}
            </button>
            <span className="spacer" />
            <button className="btn btn-ghost btn-sm" onClick={() => setShowLog((v) => !v)}>
              {showLog ? t('Masquer le journal', 'Hide log') : t('Voir le journal', 'Show log')}
            </button>
          </div>
          {showLog && <pre className="upd-log">{info.log.length ? info.log.join('\n') : t('Journal vide.', 'Empty log.')}</pre>}
        </>
      )}

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('Mettre à jour l’application ?', 'Update the application?')}
        footer={
          <>
            <button className="btn" onClick={() => setConfirm(false)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary" disabled={typed !== 'METTRE À JOUR'} onClick={() => void apply()}>
              <CloudDownload size={15} /> {t('Mettre à jour', 'Update')}
            </button>
          </>
        }
      >
        <ol className="small" style={{ margin: '0 0 12px', paddingLeft: 18 }}>
          <li>{t('Sauvegarde de la base de données sur le serveur', 'Database backup on the server')}</li>
          <li>{t(`Installation de ${s?.behind ?? 0} changement(s) venant de GitHub`, `Install ${s?.behind ?? 0} change(s) from GitHub`)}</li>
          <li>{t('Compilation : en cas d’échec, rien ne change', 'Build: if it fails, nothing changes')}</li>
          <li>{t('Redémarrage (1 à 3 minutes d’interruption pour tous)', 'Restart (1 to 3 minutes of downtime for everyone)')}</li>
          <li>{t('Si la nouvelle version ne démarre pas : retour automatique à l’ancienne', 'If the new version does not start: automatic roll-back')}</li>
        </ol>
        <label className="field">
          <span>{t('Tapez METTRE À JOUR pour confirmer', 'Type METTRE À JOUR to confirm')}</span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
      </Modal>
    </div>
  );
}
