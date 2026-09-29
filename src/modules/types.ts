import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { L } from '@/i18n';

export interface PermissionDef {
  key: string;
  label: L;
  description?: L;
}

export interface NavItem {
  /** Relative to the module path ('' = module index). */
  path: string;
  label: L;
  icon: LucideIcon;
  permission?: string;
}

export interface WidgetDef {
  id: string;
  title: L;
  permission: string;
  /** Grid width on the dashboard (1 or 2 columns). */
  size?: 1 | 2;
  component: ComponentType;
}

/**
 * A module is a self-contained area of Imago (Accounting, Shipping, ...).
 * Adding a new module = create a folder under src/modules and register it in registry.ts.
 */
export interface ModuleDef {
  id: string;
  path: string;
  name: L;
  tagline: L;
  icon: LucideIcon;
  /** Accent colour used across the module and its transition. */
  accent: string;
  /** Permission needed to see the module at all. */
  entryPermission: string;
  permissions: PermissionDef[];
  nav: NavItem[];
  /**
   * Where the module is reached from: the sidebar (default) or the user menu
   * at the top right (used for Administration).
   */
  placement?: 'sidebar' | 'userMenu';
  /** Shrink the sidebar to icons automatically while this module is open. */
  compactSidebar?: boolean;
  /** Extra controls rendered in the app top bar while this module is open. */
  topbarActions?: ComponentType;
  /** Renders the module's nested <Routes>. */
  component: ComponentType;
  widgets?: WidgetDef[];
}
