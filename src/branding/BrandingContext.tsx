/**
 * Loads the organisation's branding and applies it: colours (CSS variables), browser tab title and icon. Pages read
 * the name and logo with useBranding(). With the server, branding comes from /api/branding (public); in the browser
 * dev backend it is kept in this browser.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { API_MODE, api } from '@/data/db';
import { BrandingSchema, DEFAULT_BRANDING, type Branding } from './brandingSchema';

const LOCAL_KEY = 'imago:branding';

async function load(): Promise<Branding> {
  if (!API_MODE) {
    try {
      const parsed = BrandingSchema.safeParse(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null'));
      return parsed.success ? parsed.data : DEFAULT_BRANDING;
    } catch {
      return DEFAULT_BRANDING;
    }
  }
  const res = await fetch('/api/branding', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (!res.ok) return DEFAULT_BRANDING;
  const parsed = BrandingSchema.safeParse(await res.json());
  return parsed.success ? parsed.data : DEFAULT_BRANDING;
}

export async function saveBranding(b: Branding): Promise<Branding> {
  const value = BrandingSchema.parse(b);
  if (!API_MODE) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
    return value;
  }
  return api<Branding>('/branding', { method: 'PUT', body: value });
}

export async function resetBranding(): Promise<Branding> {
  if (!API_MODE) {
    localStorage.removeItem(LOCAL_KEY);
    return DEFAULT_BRANDING;
  }
  return api<Branding>('/branding', { method: 'DELETE' });
}

/** Mixes a colour with black (amount < 0) or white (amount > 0), for the hover / strong shades. */
export function shade(hex: string, amount: number): string {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  return '#' + n.map((c) => Math.round(c + (t - c) * p).toString(16).padStart(2, '0')).join('');
}

const STYLE_ID = 'imago-branding';

/** Writes the colour overrides as a style sheet (light and dark themes), so module accents still work on top. */
export function applyBranding(b: Branding) {
  const c = b.colors;
  const light: string[] = [];
  const dark: string[] = [];
  if (c.primary) light.push(`--red: ${c.primary}`, `--red-strong: ${shade(c.primary, -0.15)}`, `--red-glow: ${shade(c.primary, 0.15)}`);
  if (c.sidebarBg) light.push(`--sidebar-bg: ${c.sidebarBg}`), dark.push(`--sidebar-bg: ${shade(c.sidebarBg, -0.35)}`);
  if (c.sidebarText) light.push(`--sidebar-text: ${c.sidebarText}`, `--sidebar-text-2: color-mix(in srgb, ${c.sidebarText} 55%, transparent)`);
  if (c.bgLight) light.push(`--bg: ${c.bgLight}`, `--bg-sunken: ${shade(c.bgLight, -0.04)}`);
  if (c.bgDark) dark.push(`--bg: ${c.bgDark}`, `--bg-sunken: ${shade(c.bgDark, -0.25)}`);
  const css = `${light.length ? `:root { ${light.join('; ')}; }` : ''}\n${dark.length ? `:root[data-theme='dark'] { ${dark.join('; ')}; }` : ''}`;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;

  document.title = b.title;
  let icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"][data-brand]');
  if (b.favicon) {
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      icon.dataset.brand = '1';
      document.head.appendChild(icon);
    }
    icon.href = b.favicon;
  } else icon?.remove();
}

interface Ctx {
  branding: Branding;
  /** Reloads from the server (after a save, or to undo a preview). */
  refresh: () => Promise<void>;
  /** Shows a branding without saving it (the admin page's live preview). */
  preview: (b: Branding | null) => void;
}

const BrandingCtx = createContext<Ctx>({ branding: DEFAULT_BRANDING, refresh: async () => {}, preview: () => {} });

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Branding>(DEFAULT_BRANDING);
  const [previewing, setPreviewing] = useState<Branding | null>(null);
  const refresh = useCallback(async () => {
    try {
      setSaved(await load());
    } catch {
      /* keep what we have */
    }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);
  const branding = previewing ?? saved;
  useEffect(() => applyBranding(branding), [branding]);
  return <BrandingCtx.Provider value={{ branding, refresh, preview: setPreviewing }}>{children}</BrandingCtx.Provider>;
}

export const useBranding = () => useContext(BrandingCtx);
