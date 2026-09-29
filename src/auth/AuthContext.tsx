import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { groups, logAudit, users } from '@/data/stores';
import { useCollection } from '@/data/db';
import { verifyPassword } from '@/data/crypto';
import type { User, UserPrefs } from '@/data/types';
import { effectivePermissions, hasPermission } from './permissions';

interface AuthCtx {
  user: User | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<'ok' | 'invalid' | 'disabled'>;
  logout: () => void;
  can: (permission: string) => boolean;
  updatePrefs: (patch: Partial<UserPrefs>) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
const SESSION_KEY = 'imago:session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { rows: allUsers, loading: usersLoading } = useCollection(users);
  const { rows: allGroups, loading: groupsLoading } = useCollection(groups);
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(SESSION_KEY));

  const user = useMemo(
    () => allUsers.find((u) => u.id === sessionId && u.active) ?? null,
    [allUsers, sessionId],
  );
  const perms = useMemo(() => effectivePermissions(user, allGroups), [user, allGroups]);
  const ready = !usersLoading && !groupsLoading;

  // If the account was disabled/deleted while signed in, end the session.
  useEffect(() => {
    if (ready && sessionId && !user) {
      localStorage.removeItem(SESSION_KEY);
      setSessionId(null);
    }
  }, [ready, sessionId, user]);

  const login = useCallback(async (username: string, password: string) => {
    const all = await users.list();
    const u = all.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
    if (!u || !(await verifyPassword(password, u.salt, u.passwordHash))) return 'invalid' as const;
    if (!u.active) return 'disabled' as const;
    await users.update(u.id, { lastLoginAt: new Date().toISOString() });
    await logAudit(u.id, 'auth.login', u.username);
    localStorage.setItem(SESSION_KEY, u.id);
    setSessionId(u.id);
    return 'ok' as const;
  }, []);

  const logout = useCallback(() => {
    if (user) logAudit(user.id, 'auth.logout', user.username);
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
  }, [user]);

  const can = useCallback((p: string) => hasPermission(perms, p), [perms]);

  const updatePrefs = useCallback(
    async (patch: Partial<UserPrefs>) => {
      if (!user) return;
      await users.update(user.id, { prefs: { ...user.prefs, ...patch } });
    },
    [user],
  );

  return <Ctx.Provider value={{ user, ready, login, logout, can, updatePrefs }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
