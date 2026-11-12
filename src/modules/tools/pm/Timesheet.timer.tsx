import { useEffect, useState } from 'react';
import { Play, Square, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import type { PmTask, Project } from './schemas';
import { useAuth } from '@/auth/AuthContext';
import { formatElapsed, hoursText, readTimer, roundUpQuarter, writeTimer, type RunningTimer } from './Timesheet.helpers';

interface TimerProps {
  /** Projects the signed-in person can book time on. */
  choices: Project[];
  tasks: PmTask[];
  projectById: Map<string, Project>;
  /** Adds the rounded hours to today; resolves true when saved (the timer then stops). */
  onStop: (projectId: string, taskId: string | null, hours: number) => Promise<boolean>;
}

/** Start / stop timer. The running timer survives navigation (localStorage), so it is read back on mount. */
export function TimerBar({ choices, tasks, projectById, onStop }: TimerProps) {
  const { t } = useI18n();
  const userId = useAuth().user?.id ?? '';
  const [timer, setTimer] = useState<RunningTimer | null>(() => readTimer(userId));
  const [now, setNow] = useState(() => Date.now());
  const [pickedProject, setPickedProject] = useState('');
  const [pickedTask, setPickedTask] = useState('');
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  const projectId = choices.some((p) => p.id === pickedProject) ? pickedProject : (choices[0]?.id ?? '');
  const projectTasks = tasks.filter((x) => x.projectId === projectId).sort((a, b) => a.name.localeCompare(b.name));
  const taskId = projectTasks.some((x) => x.id === pickedTask) ? pickedTask : '';

  const start = () => {
    if (!projectId) return;
    const next: RunningTimer = { projectId, taskId: taskId || null, startedAt: Date.now() };
    writeTimer(userId, next);
    setNow(next.startedAt);
    setTimer(next);
  };

  const stop = async () => {
    if (!timer) return;
    setStopping(true);
    const hours = roundUpQuarter(Date.now() - timer.startedAt);
    const saved = await onStop(timer.projectId, timer.taskId, hours);
    setStopping(false);
    // On failure the timer keeps running so no time is lost; the person can retry or cancel.
    if (saved) {
      writeTimer(userId, null);
      setTimer(null);
    }
  };

  const discard = () => {
    if (!timer || !window.confirm(t('Annuler le chronomètre sans enregistrer de temps ?', 'Cancel the timer without saving time?'))) return;
    writeTimer(userId, null);
    setTimer(null);
  };

  const label = (projectIdOf: string, taskIdOf: string | null) => {
    const p = projectById.get(projectIdOf);
    const task = taskIdOf ? tasks.find((x) => x.id === taskIdOf) : undefined;
    const pl = p ? `${p.code} · ${p.name}` : t('Projet introuvable', 'Project not found');
    return { pl, tl: task ? task.name : t('Sans tâche', 'No task') };
  };

  if (timer) {
    const elapsed = now - timer.startedAt;
    const { pl, tl } = label(timer.projectId, timer.taskId);
    return (
      <div className="card card-pad" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
        <div className="row row-wrap" style={{ alignItems: 'center', gap: 16 }}>
          <span className="badge badge-accent">{t('Chronomètre en cours', 'Timer running')}</span>
          <div style={{ minWidth: 0, flex: '1 1 220px' }}>
            <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{pl}</div>
            <div className="small muted">{tl}</div>
          </div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 600 }} aria-live="off">
            {formatElapsed(elapsed)}
          </div>
          <div className="row row-wrap">
            <button className="btn btn-primary" onClick={stop} disabled={stopping}>
              <Square size={14} /> {t(`Arrêter et saisir ${hoursText(roundUpQuarter(elapsed))} h`, `Stop and log ${hoursText(roundUpQuarter(elapsed))} h`)}
            </button>
            <button className="btn btn-ghost" onClick={discard} disabled={stopping}>
              <X size={14} /> {t('Annuler', 'Cancel')}
            </button>
          </div>
        </div>
        <p className="small faint" style={{ margin: '8px 0 0' }}>
          {t('Le temps est arrondi au quart d’heure supérieur et ajouté à la case d’aujourd’hui.', 'Time is rounded up to the quarter hour and added to today’s cell.')}
        </p>
      </div>
    );
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="row row-wrap" style={{ alignItems: 'flex-end', gap: 12 }}>
        <label className="field" style={{ flex: '2 1 240px' }}>
          <span>{t('Chronomètre : projet', 'Timer: project')}</span>
          <select className="select" value={projectId} onChange={(e) => setPickedProject(e.target.value)} disabled={choices.length === 0}>
            {choices.length === 0 && <option value="">{t('Aucun projet ouvert', 'No open project')}</option>}
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: '1 1 180px' }}>
          <span>{t('Tâche', 'Task')}</span>
          <select className="select" value={taskId} onChange={(e) => setPickedTask(e.target.value)} disabled={!projectId}>
            <option value="">{t('Sans tâche', 'No task')}</option>
            {projectTasks.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" onClick={start} disabled={!projectId}>
          <Play size={14} /> {t('Démarrer', 'Start')}
        </button>
      </div>
    </div>
  );
}
