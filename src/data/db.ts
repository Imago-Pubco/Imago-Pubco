/**
 * Data access layer.
 *
 * Every screen talks to data through `Collection<T>` — an async, promise-based
 * interface with two backends:
 *  - `BrowserCollection` (dev, `npm run dev`): localStorage, demo data, no server.
 *  - `ApiCollection` (production build): the Imago API (Node + PostgreSQL), shared by
 *    all users, with server-side sessions and permission checks.
 * `VITE_BACKEND=api|browser` overrides the default for a build or dev run.
 */
import { useEffect, useState, useCallback } from 'react';

export const API_MODE = import.meta.env.VITE_BACKEND ? import.meta.env.VITE_BACKEND === 'api' : import.meta.env.PROD;

/** Thrown by `api()` for non-2xx responses. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Fetch a JSON endpoint of the Imago API. A 401 signals the session ended (see AuthContext). */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-Imago': '1',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/me') {
    window.dispatchEvent(new Event('imago:unauthorized'));
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {
      /* no body */
    }
    if (msg === 'read_only_impersonation') msg = 'Lecture seule : vous consultez le portail comme un autre utilisateur. / Read-only: you are viewing the portal as another user.';
    throw new ApiError(res.status, msg);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export interface Entity {
  id: string;
}

export interface Collection<T extends Entity> {
  readonly name: string;
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  insert(item: Omit<T, 'id'> & { id?: string }): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
  subscribe(fn: () => void): () => void;
}

const PREFIX = 'imago:db:';

export function uid(prefix = ''): string {
  const r = crypto.getRandomValues(new Uint8Array(8));
  return prefix + Array.from(r, (b) => b.toString(16).padStart(2, '0')).join('');
}

class BrowserCollection<T extends Entity> implements Collection<T> {
  private listeners = new Set<() => void>();
  constructor(readonly name: string) {
    // Keep multiple tabs in sync.
    window.addEventListener('storage', (e) => {
      if (e.key === PREFIX + name) this.emit();
    });
  }

  private read(): T[] {
    try {
      return JSON.parse(localStorage.getItem(PREFIX + this.name) ?? '[]') as T[];
    } catch {
      return [];
    }
  }
  private write(rows: T[]) {
    localStorage.setItem(PREFIX + this.name, JSON.stringify(rows));
    this.emit();
  }
  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  async list() {
    return this.read();
  }
  async get(id: string) {
    return this.read().find((r) => r.id === id);
  }
  async insert(item: Omit<T, 'id'> & { id?: string }) {
    const row = { ...item, id: item.id ?? uid() } as T;
    this.write([...this.read(), row]);
    return row;
  }
  async update(id: string, patch: Partial<T>) {
    const rows = this.read();
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) throw new Error(`${this.name}: ${id} not found`);
    rows[i] = { ...rows[i], ...patch, id };
    this.write(rows);
    return rows[i];
  }
  async remove(id: string) {
    this.write(this.read().filter((r) => r.id !== id));
  }
  /** Replace all rows (used by seeding). */
  async replaceAll(rows: T[]) {
    this.write(rows);
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

/* ---------- API backend ---------- */

const apiCollections = new Map<string, ApiCollection<Entity>>();
let events: EventSource | null = null;

/** One server-sent-events stream tells every collection when the server data changed. */
function ensureEvents() {
  if (events && events.readyState !== EventSource.CLOSED) return;
  events = new EventSource('/api/events');
  events.onmessage = (e) => {
    try {
      const { c } = JSON.parse(e.data) as { c: string };
      apiCollections.get(c)?.emit();
    } catch {
      /* ignore */
    }
  };
}

/** After sign-in / sign-out: reconnect the event stream and reload every open screen. */
export function refreshAllCollections() {
  events?.close();
  events = null;
  if (apiCollections.size) ensureEvents();
  apiCollections.forEach((c) => c.emit());
}

class ApiCollection<T extends Entity> implements Collection<T> {
  private listeners = new Set<() => void>();
  private readonly base: string;
  constructor(readonly name: string) {
    this.base = '/c/' + encodeURIComponent(name);
  }
  emit() {
    this.listeners.forEach((fn) => fn());
  }
  private path(id: string) {
    return `${this.base}/${encodeURIComponent(id)}`;
  }
  list() {
    return api<T[]>(this.base);
  }
  async get(id: string) {
    try {
      return await api<T>(this.path(id));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return undefined;
      throw e;
    }
  }
  async insert(item: Omit<T, 'id'> & { id?: string }) {
    const row = await api<T>(this.base, { method: 'POST', body: { ...item, id: item.id ?? uid() } });
    this.emit();
    return row;
  }
  async update(id: string, patch: Partial<T>) {
    const row = await api<T>(this.path(id), { method: 'PATCH', body: patch });
    this.emit();
    return row;
  }
  async remove(id: string) {
    await api<void>(this.path(id), { method: 'DELETE' });
    this.emit();
  }
  async replaceAll(rows: T[]) {
    await api<void>(this.base, { method: 'PUT', body: rows });
    this.emit();
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    ensureEvents();
    return () => {
      this.listeners.delete(fn);
    };
  }
}

const registry = new Map<string, Collection<Entity> & { replaceAll(rows: Entity[]): Promise<void> }>();

export function collection<T extends Entity>(name: string): Collection<T> & { replaceAll(rows: T[]): Promise<void> } {
  let c = registry.get(name);
  if (!c) {
    if (API_MODE) {
      const ac = new ApiCollection<Entity>(name);
      apiCollections.set(name, ac);
      c = ac;
    } else {
      c = new BrowserCollection<Entity>(name);
    }
    registry.set(name, c);
  }
  return c as unknown as Collection<T> & { replaceAll(rows: T[]): Promise<void> };
}

/** Reactive list of a collection's rows. */
export function useCollection<T extends Entity>(col: Collection<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    col.list().then(
      (r) => {
        setRows(r);
        setLoading(false);
      },
      () => {
        // Not signed in, no permission, or server unreachable: show nothing rather than hang.
        setRows([]);
        setLoading(false);
      },
    );
  }, [col]);
  useEffect(() => {
    reload();
    return col.subscribe(reload);
  }, [col, reload]);
  return { rows, loading, reload };
}

/** Wipe all Imago data from this browser (dev only). */
export function resetBrowserData() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith('imago:'))
    .forEach((k) => localStorage.removeItem(k));
}
