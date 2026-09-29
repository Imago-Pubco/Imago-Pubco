/**
 * Dashboard layouts.
 *
 * - The organisation DEFAULT layout is stored in `app.settings` (id `dashboard.default`)
 *   and set by an administrator from the dashboard ("Enregistrer comme disposition par défaut").
 * - Each user may have a PERSONAL layout in `user.prefs.dashboard`. Without one, they get the default.
 * - Widgets a user has no permission for are simply skipped.
 */
import { useEffect, useState } from 'react';
import { appSettings } from '@/data/stores';
import type { DashboardItem } from '@/data/types';

const DEFAULT_KEY = 'dashboard.default';

/** Used until an administrator saves a default. */
export const FALLBACK_LAYOUT: DashboardItem[] = [
  { id: 'core.welcome', size: 2 },
  { id: 'core.modules', size: 2 },
  { id: 'accounting.kpis', size: 2 },
  { id: 'accounting.todo', size: 1 },
  { id: 'shipping.todo', size: 1 },
  { id: 'shipping.kpis', size: 2 },
  { id: 'accounting.pipeline', size: 2 },
  { id: 'core.activity', size: 1 },
  { id: 'core.notes', size: 1 },
  { id: 'admin.kpis', size: 2 },
];

export async function saveDefaultLayout(layout: DashboardItem[]) {
  if (await appSettings.get(DEFAULT_KEY)) await appSettings.update(DEFAULT_KEY, { value: layout });
  else await appSettings.insert({ id: DEFAULT_KEY, value: layout });
}

export function useDefaultLayout() {
  const [layout, setLayout] = useState<DashboardItem[]>(FALLBACK_LAYOUT);
  useEffect(() => {
    const load = () =>
      appSettings.get(DEFAULT_KEY).then((d) => setLayout((d?.value as DashboardItem[] | undefined) ?? FALLBACK_LAYOUT));
    load();
    return appSettings.subscribe(load);
  }, []);
  return layout;
}
