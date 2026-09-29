import { useEffect, useState } from 'react';
import type { ThemeMode } from '@/data/types';

const KEY = 'imago:theme';

export function initialTheme(): ThemeMode {
  const saved = localStorage.getItem(KEY) as ThemeMode | null;
  if (saved) return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(t: ThemeMode) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem(KEY, t);
  window.dispatchEvent(new CustomEvent('imago:theme', { detail: t }));
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => (document.documentElement.dataset.theme as ThemeMode) || initialTheme());
  useEffect(() => {
    const on = (e: Event) => setTheme((e as CustomEvent<ThemeMode>).detail);
    window.addEventListener('imago:theme', on);
    return () => window.removeEventListener('imago:theme', on);
  }, []);
  const toggle = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    return next;
  };
  return { theme, toggle };
}
