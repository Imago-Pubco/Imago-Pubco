/**
 * The organisation's sidebar menu: sections (name, order, modules) and module names, set by an administrator in
 * Administration → Menu. Falls back to the default layout (menuDefaults.ts).
 */
import { useMemo } from 'react';
import { useCollection } from '@/data/db';
import { appSettings } from '@/data/stores';
import { modules } from '@/modules/registry';
import { DEFAULT_SECTIONS } from './menuDefaults';
import type { ModuleDef } from '@/modules/types';
import { MENU_LAYOUT_ID, MenuLayoutSchema, type MenuLayout } from './menuSchema';

/** Always at the bottom of the sidebar, outside the editable menu (like "Tableau de bord", always at the top). */
export const PINNED_BOTTOM = ['it'];

export const DEFAULT_MENU: MenuLayout = {
  sections: DEFAULT_SECTIONS.map((s) => ({ id: s.id, label: s.label, moduleIds: [...s.moduleIds] })),
  names: {},
};

/** Modules the administrator arranges (Administration lives in the user menu; Support TI is pinned at the bottom). */
export const menuModules = () => modules.filter((m) => m.placement !== 'userMenu' && !PINNED_BOTTOM.includes(m.id));

/** The pinned bottom modules the user may open. */
export const pinnedBottomModules = (can: (p: string) => boolean) => modules.filter((m) => PINNED_BOTTOM.includes(m.id) && can(m.entryPermission));

/**
 * Makes a saved layout safe to use with the current code: unknown modules are dropped, each module appears once,
 * and modules added to the app since the layout was saved go to a section before the last one (so nothing vanishes).
 */
export function normalizeMenu(saved: MenuLayout | null | undefined): MenuLayout {
  const parsed = saved ? MenuLayoutSchema.safeParse(saved) : null;
  const base = parsed?.success ? parsed.data : DEFAULT_MENU;
  const known = new Set(menuModules().map((m) => m.id));
  const seen = new Set<string>();
  const sections = base.sections
    .map((s) => ({
      ...s,
      moduleIds: s.moduleIds.filter((id) => known.has(id) && !seen.has(id) && (seen.add(id), true)),
    }))
    // An untitled section emptied this way (e.g. the old Support TI one, now pinned) is dropped; titled ones are kept.
    .filter((s) => s.label || s.moduleIds.length);
  // A module added since the layout was saved joins the section it belongs to by default, if that section still exists.
  const missing: string[] = [];
  for (const id of [...known].filter((k) => !seen.has(k))) {
    const home = DEFAULT_SECTIONS.find((d) => d.moduleIds.includes(id));
    const target = home && sections.find((s) => s.id === home.id);
    if (!home || !target) {
      missing.push(id);
      continue;
    }
    const before = home.moduleIds.slice(0, home.moduleIds.indexOf(id)).reverse().find((m) => target.moduleIds.includes(m));
    target.moduleIds.splice(before ? target.moduleIds.indexOf(before) + 1 : 0, 0, id);
  }
  if (missing.length) {
    const at = Math.max(0, sections.length - 1);
    sections.splice(at, 0, { id: 'other', label: { fr: 'Autres', en: 'Other' }, moduleIds: missing });
  }
  const names = Object.fromEntries(Object.entries(base.names).filter(([id]) => known.has(id)));
  return { sections, names };
}

/** The current menu layout (reactive), plus the raw saved document if any. */
export function useMenuLayout() {
  const { rows, loading } = useCollection(appSettings);
  const saved = rows.find((r) => r.id === MENU_LAYOUT_ID)?.value as MenuLayout | undefined;
  const layout = useMemo(() => normalizeMenu(saved), [saved]);
  return { layout, saved: !!saved, loading };
}

/** A module with its display name replaced by the administrator's override, if any. */
export const withMenuName = (m: ModuleDef, layout: MenuLayout): ModuleDef => (layout.names[m.id] ? { ...m, name: layout.names[m.id] } : m);

/** The sidebar sections with the modules the user may open, in the administrator's order and names. */
export function resolveSections(layout: MenuLayout, visible: ModuleDef[]) {
  const byId = new Map(visible.map((m) => [m.id, m]));
  return layout.sections
    .map((s) => ({ ...s, modules: s.moduleIds.map((id) => byId.get(id)).filter((m): m is ModuleDef => !!m).map((m) => withMenuName(m, layout)) }))
    .filter((s) => s.modules.length);
}

/** Saves the layout for everyone (admin.menu is checked by the server). */
export async function saveMenuLayout(layout: MenuLayout) {
  const value = MenuLayoutSchema.parse(layout);
  if (await appSettings.get(MENU_LAYOUT_ID)) await appSettings.update(MENU_LAYOUT_ID, { value });
  else await appSettings.insert({ id: MENU_LAYOUT_ID, value });
}

/** Back to the default layout and names. */
export async function resetMenuLayout() {
  if (await appSettings.get(MENU_LAYOUT_ID)) await appSettings.remove(MENU_LAYOUT_ID);
}
