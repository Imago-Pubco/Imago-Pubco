/**
 * Rich text (HTML from the editor) is cleaned by the server before it is stored: only the formatting the editor
 * produces is kept (an allow-list), so a document can never carry scripts, event handlers, frames or outside images.
 * The browser cleans it again before showing it (src/components/richtext/sanitize.ts).
 */
import sanitizeHtml from 'sanitize-html';

/** Pictures must be Align images stored by this server. */
export const ALIGN_IMAGE_SRC = /^\/api\/align\/images\/aimg_[a-f0-9]{16}$/;

const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'span', 'code', 'pre', 'blockquote', 'hr',
    'ul', 'ol', 'li', 'label', 'input', 'div', 'a', 'img', 'table', 'colgroup', 'col', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    ol: ['start'],
    ul: ['data-type'],
    li: ['data-type', 'data-checked'],
    input: ['type', 'checked', 'disabled'],
    th: ['colspan', 'rowspan', 'colwidth'],
    td: ['colspan', 'rowspan', 'colwidth'],
    col: ['style'],
    mark: ['data-color', 'style'],
    span: ['style'],
    p: ['style'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
  },
  allowedStyles: {
    '*': {
      color: COLOR,
      'background-color': COLOR,
      'font-family': [/^[\w\s,'"-]{1,80}$/],
      'font-size': [/^\d{1,2}(\.\d)?(px|pt|em|rem)$/],
      'text-align': [/^(left|right|center|justify)$/],
      'margin-left': [/^\d{1,2}em$/],
      width: [/^\d{1,4}px$/],
      'min-width': [/^\d{1,4}px$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: [] },
  allowProtocolRelative: false,
  // Links open in a new tab without giving the target page access to Imago.
  transformTags: {
    a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' } }),
    input: (tagName, attribs) => ({ tagName, attribs: { type: 'checkbox', ...(attribs.checked !== undefined ? { checked: 'checked' } : {}), disabled: 'disabled' } }),
  },
  exclusiveFilter: (frame) =>
    (frame.tag === 'img' && !ALIGN_IMAGE_SRC.test(frame.attribs.src ?? '')) || (frame.tag === 'input' && frame.attribs.type !== 'checkbox'),
};

/** The cleaned HTML (empty paragraphs-only content becomes ''). */
export function sanitizeRich(html: string): string {
  const clean = sanitizeHtml(html, OPTIONS).trim();
  return /^(<p>\s*<\/p>|<p><br\s*\/?><\/p>|\s)*$/i.test(clean) ? '' : clean;
}
