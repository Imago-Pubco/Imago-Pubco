export type Lang = 'fr' | 'en';
export type ThemeMode = 'light' | 'dark';

export interface UserPrefs {
  theme?: ThemeMode;
  lang?: Lang;
  sidebarCollapsed?: boolean;
  /** Personal dashboard layout. Absent = use the organisation default. */
  dashboard?: DashboardItem[];
  /** Personal order of sidebar modules (module ids). */
  menuOrder?: string[];
  /** Personal notes widget. */
  notes?: string;
}

export interface DashboardItem {
  id: string;
  size: 1 | 2;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  passwordHash: string;
  salt: string;
  groupIds: string[];
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
  prefs?: UserPrefs;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  /** Permission keys. `*` grants everything. */
  permissions: string[];
  /** System groups can't be deleted. */
  system?: boolean;
  color?: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  userId: string;
  action: string;
  detail: string;
}
