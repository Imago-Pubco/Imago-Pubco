import { useEffect, useRef, useState } from 'react';
import type { IdentityCheck } from './types.ts';
import { describeFace, faceDistance, FACE_MATCH_DISTANCE, loadFaceModels } from './faceApi';
import './faceCheck.css';

export interface FaceCheckResult {
  identity: IdentityCheck;
  descriptor?: number[];
  distance?: number;
  /** Enrollment only: small ID photo (JPEG data URL) kept as the employee's reference picture for the admin. */
  photo?: string;
}

/** Small JPEG of the current frame, taken only at enrollment (first punch). */
function idPhoto(video: HTMLVideoElement): string | undefined {
  const c = document.createElement('canvas');
  const w = 240;
  c.width = w;
  c.height = Math.round((video.videoHeight / video.videoWidth) * w) || 180;
  const ctx = c.getContext('2d');
  if (!ctx) return undefined;
  ctx.translate(w, 0);
  ctx.scale(-1, 1); // same mirror as the preview
  ctx.drawImage(video, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.8);
  c.width = 0;
  return url;
}

interface FaceCheckProps {
  firstName: string;
  /** null = first time: enrollment. */
  reference: number[] | null;
  onResult: (r: FaceCheckResult) => void;
  onCancel: () => void;
}

type Phase = 'starting' | 'searching' | 'verified' | 'retry' | 'nofind' | 'unavailable';

const TICK_MS = 500;
const SEARCH_TIMEOUT_MS = 15000;
const RETRY_PAUSE_MS = 1200;
const VERIFIED_HOLD_MS = 600;
const UNAVAILABLE_HOLD_MS = 1500;
const MAX_FAILURES = 3;

const STATUS: Record<Phase, string> = {
  starting: 'Ouverture de la caméra…',
  searching: 'Recherche du visage…',
  verified: 'Identité confirmée',
  retry: 'Visage non reconnu, réessayez',
  nofind: 'Aucun visage détecté',
  unavailable: 'Caméra indisponible : le pointage sera noté sans photo.',
};

async function openCamera(): Promise<MediaStream | null> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return null;
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch {
    return null;
  }
}

export function FaceCheck(props: FaceCheckProps) {
  const { firstName, reference } = props;
  const [phase, setPhase] = useState<Phase>('starting');
  const videoRef = useRef<HTMLVideoElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const ctrl = useRef<{ cancel: () => void; retry: () => void; skip: () => void } | null>(null);

  useEffect(() => {
    // Everything below is scoped to this run of the effect, so a StrictMode re-run starts clean.
    const referenceAtMount = reference;
    let alive = true;
    let settled = false;
    let stream: MediaStream | null = null;
    let loopTimer: number | undefined;
    let noFaceTimer: number | undefined;
    let holdTimer: number | undefined;
    let running = false;
    let busy = false;
    let failures = 0;

    const stopCamera = () => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const shutdown = () => {
      alive = false;
      running = false;
      clearTimeout(loopTimer);
      clearTimeout(noFaceTimer);
      clearTimeout(holdTimer);
      stopCamera();
    };

    // Stops everything first, then reports exactly once.
    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      shutdown();
      action();
    };

    function schedule(ms: number) {
      clearTimeout(loopTimer);
      loopTimer = window.setTimeout(() => void tick(), ms);
    }

    async function tick() {
      if (!alive || !running || busy) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        schedule(300);
        return;
      }
      setPhase('searching');
      busy = true;
      let descriptor: Float32Array | null = null;
      // Offscreen canvas: the frame is wiped right after the descriptor is computed.
      const canvas = document.createElement('canvas');
      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        descriptor = await describeFace(canvas);
      } catch {
        descriptor = null;
      } finally {
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        busy = false;
      }
      if (!alive || !running) return;

      if (!descriptor) {
        schedule(TICK_MS);
        return;
      }

      // A face was found: the 15 s search window no longer applies.
      clearTimeout(noFaceTimer);
      const values = Array.from(descriptor);

      if (referenceAtMount === null) {
        const photo = idPhoto(video);
        settle(() => latest.current.onResult({ identity: 'enrolled', descriptor: values, photo }));
        return;
      }

      const distance = faceDistance(descriptor, referenceAtMount);
      if (distance < FACE_MATCH_DISTANCE) {
        running = false;
        setPhase('verified');
        holdTimer = window.setTimeout(
          () => settle(() => latest.current.onResult({ identity: 'verified', descriptor: values, distance })),
          VERIFIED_HOLD_MS,
        );
        return;
      }

      failures += 1;
      if (failures >= MAX_FAILURES) {
        settle(() => latest.current.onResult({ identity: 'mismatch', distance }));
        return;
      }
      running = true;
      setPhase('retry');
      schedule(RETRY_PAUSE_MS);
    }

    function begin() {
      if (!alive) return;
      running = true;
      setPhase('searching');
      clearTimeout(noFaceTimer);
      noFaceTimer = window.setTimeout(() => {
        running = false;
        clearTimeout(loopTimer);
        setPhase('nofind');
      }, SEARCH_TIMEOUT_MS);
      schedule(0);
    }

    async function start() {
      const [cam, modelsOk] = await Promise.all([openCamera(), loadFaceModels()]);
      if (!alive) {
        cam?.getTracks().forEach((t) => t.stop());
        return;
      }
      if (!cam || !modelsOk) {
        cam?.getTracks().forEach((t) => t.stop());
        setPhase('unavailable');
        holdTimer = window.setTimeout(
          () => settle(() => latest.current.onResult({ identity: 'no_camera' })),
          UNAVAILABLE_HOLD_MS,
        );
        return;
      }
      stream = cam;
      const video = videoRef.current;
      if (video) {
        video.srcObject = cam;
        await video.play().catch(() => undefined);
      }
      if (!alive) return;
      begin();
    }

    ctrl.current = {
      cancel: () => settle(() => latest.current.onCancel()),
      retry: () => {
        if (alive && !running) begin();
      },
      skip: () => settle(() => latest.current.onResult({ identity: 'no_camera' })),
    };

    void start();

    return () => {
      shutdown();
      ctrl.current = null;
    };
    // The props are read through `latest`; the check runs once per mount.
  }, []);

  const tone =
    phase === 'verified' ? 'ok' : phase === 'retry' ? 'bad' : phase === 'unavailable' ? 'off' : 'wait';

  return (
    <div className="pc-face">
      <div className="pc-face-head">
        <h2 className="pc-face-title">Photo de vérification</h2>
        <p className="pc-face-hello">Bonjour {firstName}, regardez la caméra</p>
        {reference === null && (
          <p className="pc-face-note">
            Photo de référence : regardez la caméra, le visage sera enregistré pour comparer les prochains pointages.
          </p>
        )}
      </div>

      <div className={`pc-face-frame pc-face-frame--${tone}`}>
        <video ref={videoRef} className="pc-face-video" autoPlay muted playsInline />
        <div className="pc-face-guide" aria-hidden="true" />
      </div>

      <p className={`pc-face-status pc-face-status--${tone}`} role="status" aria-live="polite">
        {STATUS[phase]}
      </p>

      <div className="pc-face-actions">
        {phase === 'nofind' && (
          <>
            <button type="button" className="pc-face-btn pc-face-btn--primary" onClick={() => ctrl.current?.retry()}>
              Réessayer
            </button>
            <button
              type="button"
              className="pc-face-btn pc-face-btn--ghost"
              onClick={() => ctrl.current?.skip()}
            >
              Continuer sans photo
            </button>
          </>
        )}
        <button type="button" className="pc-face-btn pc-face-btn--ghost" onClick={() => ctrl.current?.cancel()}>
          Annuler
        </button>
      </div>
    </div>
  );
}
