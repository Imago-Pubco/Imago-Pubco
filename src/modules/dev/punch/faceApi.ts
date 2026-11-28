/**
 * Face recognition helpers for the punch card (browser only, nothing is sent anywhere).
 * The library is loaded lazily so it stays out of the main bundle.
 */

type FaceApiLib = typeof import('@vladmandic/face-api');

/** Euclidean distance under which two descriptors are considered the same person. */
export const FACE_MATCH_DISTANCE = 0.5;

let libPromise: Promise<FaceApiLib> | null = null;

function getLib(): Promise<FaceApiLib> {
  libPromise ??= import('@vladmandic/face-api');
  return libPromise;
}

let modelsPromise: Promise<boolean> | null = null;

/**
 * Loads the three networks used by describeFace, once. Resolves false on any failure (never throws).
 * A failed attempt is not cached, so a later call can retry.
 */
export function loadFaceModels(): Promise<boolean> {
  if (!modelsPromise) {
    const p = (async (): Promise<boolean> => {
      try {
        const faceapi = await getLib();
        const base = `${import.meta.env.BASE_URL}models/face-api/`;
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(base),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(base),
          faceapi.nets.faceRecognitionNet.loadFromUri(base),
        ]);
        return true;
      } catch {
        return false;
      }
    })().then((ok) => {
      if (!ok) modelsPromise = null;
      return ok;
    });
    modelsPromise = p;
  }
  return modelsPromise;
}

/** 128-number descriptor of the single face in the canvas, or null when no face is found. */
export async function describeFace(input: HTMLCanvasElement): Promise<Float32Array | null> {
  const faceapi = await getLib();
  const result = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks(true)
    .withFaceDescriptor();
  return result ? result.descriptor : null;
}

/** Euclidean distance between two descriptors. Infinity when the lengths differ. */
export function faceDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}
