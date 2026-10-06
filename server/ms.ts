/** Microsoft Entra ID client-credentials tokens, cached per scope. */
import { config } from './config.ts';

const cache = new Map<string, { token: string; expiresAt: number }>();

export class HttpError extends Error {
  status: number;
  body: string;
  constructor(status: number, message: string, body = '') {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function msToken(scope: string): Promise<string> {
  const hit = cache.get(scope);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;
  const { tenantId, clientId, clientSecret } = config.ms;
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope }),
  });
  const text = await res.text();
  if (!res.ok) throw new HttpError(res.status, `Microsoft sign-in failed (${res.status})`, text);
  const json = JSON.parse(text) as { access_token: string; expires_in: number };
  cache.set(scope, { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 });
  return json.access_token;
}

/** fetch() with a bearer token; throws HttpError with the response body on failure. */
export async function msFetch(scope: string, url: string, init: RequestInit = {}): Promise<Response> {
  const token = await msToken(scope);
  const res = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    let detail = '';
    try {
      detail = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? '';
    } catch {
      /* not JSON */
    }
    throw new HttpError(res.status, detail || `Request failed (${res.status})`, body);
  }
  return res;
}
