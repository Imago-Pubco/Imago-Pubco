import { useCallback, useEffect, useState } from 'react';
import { collection, useCollection } from '@/data/db';
import type { O365Tenant } from './types';

export const o365Tenants = collection<O365Tenant>('o365.tenants');

const KEY = 'imago:o365:tenant';
const EVENT = 'imago:o365:tenant';

/** The tenant currently selected in the module (remembered per browser). */
export function useSelectedTenant() {
  const { rows, loading } = useCollection(o365Tenants);
  const [id, setId] = useState<string | null>(() => localStorage.getItem(KEY));

  useEffect(() => {
    const on = () => setId(localStorage.getItem(KEY));
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  const select = useCallback((next: string) => {
    localStorage.setItem(KEY, next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  const tenant = sorted.find((t) => t.id === id) ?? sorted[0] ?? null;
  return { tenants: sorted, tenant, select, loading };
}
