/** Pictures for rich text: resized in the browser, then stored by the server (or kept inline in the browser dev backend). */
import { API_MODE } from '@/data/db';

const MAX_SIDE = 1600;

async function resize(file: File): Promise<Blob> {
  // Animated GIFs would lose their animation: keep them as they are (the server limit is 3 MB).
  if (file.type === 'image/gif') return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('Image illisible / Unreadable image'));
      im.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image'))), type, 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

/** Uploads a picture and returns the URL to put in the text. */
export async function uploadRichImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error('Format accepté : JPEG, PNG, WebP ou GIF / Accepted: JPEG, PNG, WebP or GIF');
  const blob = await resize(file);
  if (blob.size > 3 * 1024 * 1024) throw new Error('Image trop lourde (3 Mo max) / Image too large (3 MB max)');
  if (!API_MODE) return toDataUrl(blob);
  const res = await fetch('/api/align/images', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': blob.type, 'X-Imago': '1', Accept: 'application/json' },
    body: blob,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {
      /* no body */
    }
    throw new Error(msg);
  }
  return ((await res.json()) as { url: string }).url;
}
