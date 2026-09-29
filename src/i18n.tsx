/**
 * Minimal bilingual support (FR default, EN).
 * Usage: const { t } = useI18n(); t('Bonjour', 'Hello')  or  t(label) for an L object.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Lang } from './data/types';

export interface L {
  fr: string;
  en: string;
}

type T = {
  (label: L): string;
  (fr: string, en: string): string;
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: T;
  fmtDate: (iso: string | undefined, withTime?: boolean) => string;
  fmtMoney: (n: number, currency?: string) => string;
  fmtNum: (n: number, digits?: number) => string;
}

const Ctx = createContext<I18nCtx | null>(null);
const KEY = 'imago:lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem(KEY) as Lang) || 'fr');
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    localStorage.setItem(KEY, l);
    setLangState(l);
  };
  const t = ((a: L | string, b?: string) =>
    typeof a === 'string' ? (lang === 'fr' ? a : (b ?? a)) : a[lang]) as T;
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';

  const value: I18nCtx = {
    lang,
    setLang,
    t,
    fmtDate: (iso, withTime) =>
      iso
        ? new Date(iso).toLocaleString(locale, {
            dateStyle: 'medium',
            ...(withTime ? { timeStyle: 'short' } : {}),
          })
        : '—',
    fmtMoney: (n, currency = 'CAD') => n.toLocaleString(locale, { style: 'currency', currency }),
    fmtNum: (n, digits = 0) =>
      n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useI18n outside I18nProvider');
  return c;
}
