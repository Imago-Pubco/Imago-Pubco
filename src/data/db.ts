/**
 * Data access layer.
 *
 * Every screen talks to data through `Collection<T>` — an async, promise-based
 * interface. In development it is backed by the browser's localStorage
 * (`BrowserCollection`). In production it will be replaced by an HTTP client
 * that calls the Imago API (Node + PostgreSQL on the Ubuntu server) with the
 * same method signatures, so no module code has to change.
 */
import { useEffect, useState, useCallback } from 'react';

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

const registry = new Map<string, BrowserCollection<Entity>>();

export function collection<T extends Entity>(name: string): Collection<T> & { replaceAll(rows: T[]): Promise<void> } {
  let c = registry.get(name);
  if (!c) {
    c = new BrowserCollection<Entity>(name);
    registry.set(name, c);
  }
  return c as unknown as Collection<T> & { replaceAll(rows: T[]): Promise<void> };
}

/** Reactive list of a collection's rows. */
export function useCollection<T extends Entity>(col: Collection<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    col.list().then((r) => {
      setRows(r);
      setLoading(false);
    });
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
