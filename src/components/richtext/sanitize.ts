/**
 * Browser-side cleaning of rich text before it is shown (the server already cleans it before storing: server/richText.ts).
 * Same allow-list; pictures only from the Align image store (or, in the browser dev backend, inline data images).
 */
import DOMPurify from 'dompurify';
import { API_MODE } from '@/data/db';

const IMG_SRC = API_MODE ? /^\/api\/align\/images\/aimg_[a-f0-9]{16}$/ : /^(\/api\/align\/images\/aimg_[a-f0-9]{16}|data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+)$/;
const HREF = /^(https?:|mailto:)/i;

let hooked = false;
function hook() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') ?? '';
      if (!HREF.test(href)) node.removeAttribute('href');
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
    if (node.tagName === 'IMG' && !IMG_SRC.test(node.getAttribute('src') ?? '')) node.remove();
    if (node.tagName === 'INPUT') {
      if (node.getAttribute('type') !== 'checkbox') node.remove();
      else node.setAttribute('disabled', 'disabled');
    }
  });
}

const CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'span', 'code', 'pre', 'blockquote', 'hr',
    'ul', 'ol', 'li', 'label', 'input', 'div', 'a', 'img', 'table', 'colgroup', 'col', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'start', 'data-type', 'data-checked', 'type', 'checked', 'disabled', 'colspan', 'rowspan', 'colwidth', 'style', 'data-color'],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(https?:|mailto:|\/api\/align\/images\/|data:image\/(png|jpeg|webp|gif);base64,)/i,
};

export function cleanRich(html: string): string {
  hook();
  return DOMPurify.sanitize(html, CONFIG) as unknown as string;
}

/** Is this stored text HTML from the editor (rather than older plain text)? */
export const isRichHtml = (s: string) => /^\s*<(p|h[1-3]|ul|ol|table|blockquote|pre|hr|div|img)[\s>/]/i.test(s);

/** Plain text (older entries) as editor HTML: one paragraph per line, escaped. */
export function textToHtml(s: string): string {
  if (!s) return '';
  if (isRichHtml(s)) return s;
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return s.split(/\r?\n/).map((l) => `<p>${esc(l)}</p>`).join('');
}

/** Has the rich text any visible content (text, picture, table)? */
export function hasRichContent(s: string | null | undefined): boolean {
  if (!s) return false;
  if (!isRichHtml(s)) return !!s.trim();
  return /<(img|table|hr)\b/i.test(s) || !!s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/** Pictures still being uploaded (pasted inline pictures, with the server backend): wait before saving. */
export const hasUploadingImages = (html: string) => API_MODE && /<img[^>]+src="(data:|https?:)/i.test(html);
