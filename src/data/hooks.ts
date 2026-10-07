import { useCallback } from 'react';
import { useCollection } from './db';
import { users } from './stores';

/** Resolve user ids to display names. */
export function useUserName() {
  const { rows } = useCollection(users);
  return useCallback((id?: string) => (id === 'system' ? 'Automatisation' : (rows.find((u) => u.id === id)?.displayName ?? id ?? '—')), [rows]);
}
