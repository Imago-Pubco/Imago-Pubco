/**
 * Shared pieces of the public (no login) pages: the request helper and the page frame.
 * These pages never call `api()`: a 401 there would log the staff user out, so this helper only reports the status.
 */
import type { ReactNode } from 'react';
import { BrandLogo } from '@/branding/BrandLogo';
import { useBranding } from '@/branding/BrandingContext';
import { API_MODE, ApiError } from '@/data/db';
import { useI18n } from '@/i18n';
import { localPublicForm, localPublicQuote, localPublicRequest, localPublicRespond, localPublicUpload } from '@/modules/sales/localServer';
import './public.css';

export class PublicApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PublicApiError';
  }
}

/**
 * Dev mode (no server): the public routes the customer pages use are answered by the browser stand-in
 * in localServer.ts, with the same status codes and messages.
 */
async function localPublicApi<T>(path: string, init: { method?: string; body?: unknown }): Promise<T> {
  const method = init.method ?? 'GET';
  const body = (init.body ?? {}) as Record<string, unknown>;
  const quote = /^\/quote\/([^/]+)(\/respond)?$/.exec(path);
  try {
    if (method === 'GET' && path === '/request-form') return (await localPublicForm()) as T;
    if (method === 'POST' && path === '/upload') return (await localPublicUpload(body)) as T;
    if (method === 'POST' && path === '/request') return (await localPublicRequest(body)) as T;
    if (quote && method === 'GET' && !quote[2]) return (await localPublicQuote(decodeURIComponent(quote[1]))) as T;
    if (quote && method === 'POST' && quote[2]) return (await localPublicRespond(decodeURIComponent(quote[1]), body)) as T;
    throw new ApiError(404, 'not_found');
  } catch (e) {
    if (e instanceof ApiError) throw new PublicApiError(e.status, e.message);
    throw e;
  }
}

/** JSON request to /api/public. Throws PublicApiError for non-2xx answers, a TypeError when the network fails. */
export async function publicApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!API_MODE) return localPublicApi<T>(path, init);
  const res = await fetch('/api/public' + path, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-Imago': '1',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {
      /* no body */
    }
    throw new PublicApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

/** Brand bar (logo, name, FR/EN switch) around a public page. */
export function PublicShell({ company, children }: { company?: string; children: ReactNode }) {
  const { branding } = useBranding();
  const { lang, setLang, t } = useI18n();
  return (
    <div className="pub">
      <header className="pub-header">
        <div className="pub-brand">
          <BrandLogo size={32} />
          <span className="pub-brand-name">{company || branding.appName}</span>
        </div>
        <button
          type="button"
          className="pub-lang"
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          aria-label={t('Switch to English', 'Passer au français')}
          title={t('Switch to English', 'Passer au français')}
        >
          {lang === 'fr' ? 'EN' : 'FR'}
        </button>
      </header>
      <main className="pub-main">{children}</main>
    </div>
  );
}
