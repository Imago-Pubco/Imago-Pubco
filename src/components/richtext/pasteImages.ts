/**
 * Pictures that arrive inside pasted or dropped content (Word, Outlook, web pages) are kept where they were pasted:
 * they show at once, are uploaded in the background, then point to the stored copy. A picture that cannot be read
 * (a web site refusing the copy) is removed, with a message. In the browser dev backend, inline pictures are kept as is.
 */
import type { Editor } from '@tiptap/react';
import { API_MODE } from '@/data/db';
import { dataUrlToFile, uploadRichImage } from './images';

const STORED = /^\/api\/align\/images\/aimg_[a-f0-9]{16}$/;
const INLINE = /^data:image\/(png|jpeg|webp|gif);base64,/i;

/** Is this picture already stored by Imago (or acceptable as it is)? */
const isSettled = (src: string) => STORED.test(src) || (!API_MODE && INLINE.test(src));

async function toFile(src: string, i: number): Promise<File | null> {
  if (INLINE.test(src)) return dataUrlToFile(src, `image-${i + 1}`);
  if (/^https?:\/\//i.test(src)) {
    try {
      const res = await fetch(src, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!/^image\/(png|jpeg|webp|gif)$/.test(blob.type)) return null;
      return new File([blob], `image-${i + 1}.${blob.type.split('/')[1]}`, { type: blob.type });
    } catch {
      return null; // the site does not allow its picture to be copied
    }
  }
  return null;
}

/** Replaces (or removes) the picture whose src is `from`, wherever it is in the text. */
function swap(editor: Editor, from: string, to: string | null) {
  const { state } = editor;
  const tr = state.tr;
  const hits: { pos: number; size: number; attrs: Record<string, unknown> }[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'image' && node.attrs.src === from) hits.push({ pos, size: node.nodeSize, attrs: node.attrs });
  });
  // From the end, so earlier positions stay valid.
  for (const h of hits.reverse()) {
    if (to) tr.setNodeMarkup(h.pos, undefined, { ...h.attrs, src: to });
    else tr.delete(h.pos, h.pos + h.size);
  }
  if (hits.length) editor.view.dispatch(tr);
}

let running = false;

/** Uploads every picture of the text that is not stored yet. Returns how many could not be kept. */
export async function settleImages(editor: Editor): Promise<number> {
  if (running) return 0;
  running = true;
  let lost = 0;
  try {
    const pending = new Set<string>();
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image' && typeof node.attrs.src === 'string' && !isSettled(node.attrs.src)) pending.add(node.attrs.src);
    });
    let i = 0;
    for (const src of pending) {
      const file = await toFile(src, i++);
      let url: string | null = null;
      if (file) {
        try {
          url = await uploadRichImage(file);
        } catch {
          url = null;
        }
      }
      if (editor.isDestroyed) return lost;
      if (!url) lost++;
      swap(editor, src, url);
    }
  } finally {
    running = false;
  }
  return lost;
}
