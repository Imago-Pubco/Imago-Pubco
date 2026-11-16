/**
 * Branding (Administration → Image de marque): stored in the meta table, read publicly (the sign-in page needs it),
 * written by administrators. Also reads a public web site to suggest a name, logo, icon and colours.
 *
 * The site reader only reaches the public internet: http/https on the default ports, every address the name resolves
 * to must be public (checked at connection time, so a DNS change cannot slip in a private address), at most 3
 * redirects (each checked), 8 s per request, and size limits. It never sends cookies or credentials.
 */
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import { BrandingSchema, DEFAULT_BRANDING, type Branding, type SiteBranding } from '../src/branding/brandingSchema.ts';
import * as db from './db.ts';
import { HttpError } from './ms.ts';

const KEY = 'branding';

export async function getBranding(): Promise<Branding> {
  const saved = await db.getMeta<Branding>(KEY);
  const parsed = saved ? BrandingSchema.safeParse({ ...DEFAULT_BRANDING, ...saved }) : null;
  return parsed?.success ? parsed.data : DEFAULT_BRANDING;
}

export async function saveBranding(input: unknown): Promise<Branding> {
  const parsed = BrandingSchema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(400, `invalid branding: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  }
  await db.setMeta(KEY, parsed.data);
  return parsed.data;
}

export async function resetBranding(): Promise<Branding> {
  await db.setMeta(KEY, DEFAULT_BRANDING);
  return DEFAULT_BRANDING;
}

/* ---------------- public-internet-only fetch ---------------- */

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local (cloud metadata)
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapped) return isPrivateIp(mapped[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v); // unique-local, link-local, multicast
}

/** DNS lookup used at connection time: refuses a name that resolves to any non-public address. */
const publicLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, '', 4);
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => isPrivateIp(a.address))) {
      return callback(Object.assign(new Error('private address refused'), { code: 'EPRIVATE' }), '', 4);
    }
    if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

interface Fetched {
  url: string;
  type: string;
  body: Buffer;
}

function checkUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new HttpError(400, 'Adresse invalide / Invalid address');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new HttpError(400, 'Seuls http et https sont acceptés / Only http and https');
  if (u.port && u.port !== '80' && u.port !== '443') throw new HttpError(400, 'Port refusé / Port refused');
  if (u.username || u.password) throw new HttpError(400, 'Adresse invalide / Invalid address');
  if (net.isIP(u.hostname.replace(/^\[|\]$/g, '')) && isPrivateIp(u.hostname.replace(/^\[|\]$/g, ''))) {
    throw new HttpError(400, 'Adresse privée refusée / Private address refused');
  }
  return u;
}

function getOnce(u: URL, maxBytes: number): Promise<{ status: number; location?: string; type: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      u,
      {
        method: 'GET',
        lookup: publicLookup,
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ImagoBranding/1.0)', Accept: '*/*', 'Accept-Encoding': 'identity' },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location, type: '', body: Buffer.alloc(0) });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            req.destroy();
            reject(new HttpError(413, 'Fichier trop gros / File too large'));
          } else chunks.push(c);
        });
        res.on('end', () => resolve({ status, type: String(res.headers['content-type'] ?? ''), body: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new HttpError(504, 'Le site ne répond pas / The site does not answer')));
    req.on('error', (e: NodeJS.ErrnoException) =>
      reject(e instanceof HttpError ? e : new HttpError(502, e.code === 'EPRIVATE' ? 'Adresse privée refusée / Private address refused' : `Site injoignable / Site unreachable (${e.code ?? e.message})`)),
    );
    req.end();
  });
}

async function safeFetch(raw: string, maxBytes: number): Promise<Fetched> {
  let u = checkUrl(raw);
  for (let hop = 0; hop <= 3; hop++) {
    const r = await getOnce(u, maxBytes);
    if (r.location) {
      u = checkUrl(new URL(r.location, u).toString());
      continue;
    }
    if (r.status >= 400) throw new HttpError(502, `Le site a répondu ${r.status} / The site answered ${r.status}`);
    return { url: u.toString(), type: r.type.split(';')[0].trim().toLowerCase(), body: r.body };
  }
  throw new HttpError(502, 'Trop de redirections / Too many redirects');
}

/* ---------------- reading a site ---------------- */

const attr = (tag: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)?.slice(2).find((x) => x !== undefined) ?? null;
const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

function metaContent(html: string, key: string): string | null {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const k = attr(m[0], 'property') ?? attr(m[0], 'name');
    if (k && k.toLowerCase() === key) return decode(attr(m[0], 'content') ?? '').trim() || null;
  }
  return null;
}

function normHex(c: string): string | null {
  let v = c.trim().toLowerCase();
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(v);
  if (rgb) v = '#' + rgb.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('');
  if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + [...v.slice(1)].map((x) => x + x).join('');
  if (/^#[0-9a-f]{8}$/.test(v)) v = v.slice(0, 7);
  return /^#[0-9a-f]{6}$/.test(v) ? v : null;
}

/** Leaves out greys, near-white and near-black (they are not brand colours). */
function isBrandish(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min > 40 && max > 40 && min < 235;
}

const IMAGE_TYPES = /^image\/(png|jpeg|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon)$/;

async function fetchImage(src: string): Promise<string | null> {
  try {
    const f = await safeFetch(src, 600_000);
    let type = f.type;
    if (!IMAGE_TYPES.test(type)) {
      // Some servers send images as octet-stream: recognise PNG / JPEG / SVG by their content.
      const head = f.body.subarray(0, 64).toString('latin1');
      type = head.startsWith('\x89PNG') ? 'image/png' : head.startsWith('\xff\xd8') ? 'image/jpeg' : /<svg[\s>]/i.test(f.body.subarray(0, 600).toString('utf8')) ? 'image/svg+xml' : '';
      if (!type) return null;
    }
    return `data:${type};base64,${f.body.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function inspectSite(raw: string): Promise<SiteBranding> {
  const page = await safeFetch(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`, 2_000_000);
  if (!/html/.test(page.type)) throw new HttpError(400, 'Cette adresse ne renvoie pas une page web / This address is not a web page');
  const html = page.body.toString('utf8');
  const base = new URL(page.url);
  const abs = (href: string) => {
    try {
      return new URL(decode(href), base).toString();
    } catch {
      return null;
    }
  };

  const name = metaContent(html, 'og:site_name') ?? metaContent(html, 'application-name') ?? (decode(/<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)?.[1] ?? '').trim() || null);
  const description = metaContent(html, 'og:description') ?? metaContent(html, 'description');
  const themeColor = normHex(metaContent(html, 'theme-color') ?? metaContent(html, 'msapplication-tilecolor') ?? '');

  // Candidate images: logos in the page, icons, the social sharing picture.
  const found: { href: string; kind: 'logo' | 'icon' | 'social'; label: string }[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (/logo|brand/i.test(`${attr(tag, 'class')} ${attr(tag, 'id')} ${attr(tag, 'alt')} ${attr(tag, 'src')}`)) {
      const src = attr(tag, 'src') ?? attr(tag, 'data-src');
      if (src && !src.startsWith('data:')) found.push({ href: src, kind: 'logo', label: 'Logo' });
    }
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (attr(m[0], 'rel') ?? '').toLowerCase();
    const href = attr(m[0], 'href');
    if (href && /icon/.test(rel)) found.push({ href, kind: 'icon', label: rel.includes('apple') ? 'Apple touch icon' : 'Icône / Icon' });
  }
  const og = metaContent(html, 'og:image');
  if (og) found.push({ href: og, kind: 'social', label: 'Image de partage / Social image' });
  found.push({ href: '/favicon.ico', kind: 'icon', label: 'favicon.ico' });

  const seen = new Set<string>();
  const images: SiteBranding['images'] = [];
  for (const f of found) {
    const url = abs(f.href);
    if (!url || seen.has(url) || !/^https?:/i.test(url)) continue;
    seen.add(url);
    if (images.length >= 8) break;
    const src = await fetchImage(url);
    if (src) images.push({ src, kind: f.kind, label: f.label });
  }

  // Colours: the page's inline styles plus up to 3 of its style sheets.
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  css += '\n' + [...html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => m[1]).join(';');
  const sheets = [...html.matchAll(/<link\b[^>]*>/gi)].filter((m) => /stylesheet/i.test(attr(m[0], 'rel') ?? '')).map((m) => abs(attr(m[0], 'href') ?? '')).filter((x): x is string => !!x);
  for (const s of sheets.slice(0, 3)) {
    try {
      const f = await safeFetch(s, 1_500_000);
      if (/css|text\/plain/.test(f.type)) css += '\n' + f.body.toString('utf8');
    } catch {
      /* skip that sheet */
    }
  }
  const counts = new Map<string, number>();
  for (const m of css.matchAll(/#[0-9a-f]{3,8}\b|rgba?\([^)]{5,40}\)/gi)) {
    const h = normHex(m[0]);
    if (h && isBrandish(h)) counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  // CSS variables named like brand colours weigh more.
  for (const m of css.matchAll(/--[\w-]*(primary|brand|accent|main)[\w-]*\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]+\))/gi)) {
    const h = normHex(m[2]);
    if (h && isBrandish(h)) counts.set(h, (counts.get(h) ?? 0) + 50);
  }
  if (themeColor && isBrandish(themeColor)) counts.set(themeColor, (counts.get(themeColor) ?? 0) + 100);
  const colors = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 10);

  const fontCounts = new Map<string, number>();
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    const first = m[1].split(',')[0].replace(/!important/i, '').trim().replace(/^["']|["']$/g, '');
    if (first && !/^(inherit|initial|var\(|sans-serif|serif|monospace|system-ui|-apple-system)/i.test(first) && !/icon|awesome|glyph/i.test(first) && first.length < 40) {
      fontCounts.set(first, (fontCounts.get(first) ?? 0) + 1);
    }
  }
  const fonts = [...fontCounts.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, 4);

  return { url: page.url, name: name?.slice(0, 120) ?? null, description: description?.slice(0, 200) ?? null, themeColor, images, colors, fonts };
}
