import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { groups, logAudit, users } from '@/data/stores';
import { API_MODE, ApiError, api, refreshAllCollections, useCollection } from '@/data/db';
import { verifyPassword } from '@/data/crypto';
import type { User, UserPrefs } from '@/data/types';
import { effectivePermissions, hasPermission } from './permissions';

export type LoginResult = 'ok' | 'invalid' | 'disabled' | 'locked' | 'error';

interface AuthCtx {
  user: User | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  can: (permission: string) => boolean;
  updatePrefs: (patch: Partial<UserPrefs>) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
const SESSION_KEY = 'imago:session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { rows: allUsers, loading: usersLoading } = useCollection(users);
  const { rows: allGroups, loading: groupsLoading } = useCollection(groups);
  // Browser backend: the signed-in user id is kept in localStorage.
  // API backend: the server holds the session (HttpOnly cookie); we ask it who we are.
  const [sessionId, setSessionId] = useState<string | null>(() => (API_MODE ? null : localStorage.getItem(SESSION_KEY)));
  const [sessionChecked, setSessionChecked] = useState(!API_MODE);

  useEffect(() => {
    if (!API_MODE) return;
    api<{ user: User }>('/auth/me')
      .then((r) => {
        setSessionId(r.user.id);
        refreshAllCollections();
      })
      .catch(() => setSessionId(null))
      .finally(() => setSessionChecked(true));
    const onUnauthorized = () => setSessionId(null);
    window.addEventListener('imago:unauthorized', onUnauthorized);
    return () => window.removeEventListener('imago:unauthorized', onUnauthorized);
  }, []);

  const user = useMemo(
    () => allUsers.find((u) => u.id === sessionId && u.active) ?? null,
    [allUsers, sessionId],
  );
  const perms = useMemo(() => effectivePermissions(user, allGroups), [user, allGroups]);
  const ready = sessionChecked && !usersLoading && !groupsLoading && (!sessionId || !!user || !API_MODE);

  // If the account was disabled/deleted while signed in, end the session.
  useEffect(() => {
    if (!API_MODE && ready && sessionId && !user) {
      localStorage.removeItem(SESSION_KEY);
      setSessionId(null);
    }
  }, [ready, sessionId, user]);

  const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
    if (API_MODE) {
      try {
        const r = await api<{ user: User }>('/auth/login', { method: 'POST', body: { username, password } });
        setSessionId(r.user.id);
        refreshAllCollections();
        return 'ok';
      } catch (e) {
        if (e instanceof ApiError) {
          if (e.status === 401) return 'invalid';
          if (e.status === 403) return 'disabled';
          if (e.status === 429) return 'locked';
        }
        return 'error';
      }
    }
    const all = await users.list();
    const u = all.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
    if (!u || !(await verifyPassword(password, u.salt, u.passwordHash))) return 'invalid';
    if (!u.active) return 'disabled';
    await users.update(u.id, { lastLoginAt: new Date().toISOString() });
    await logAudit(u.id, 'auth.login', u.username);
    localStorage.setItem(SESSION_KEY, u.id);
    setSessionId(u.id);
    return 'ok';
  }, []);

  const logout = useCallback(() => {
    if (API_MODE) {
      api('/auth/logout', { method: 'POST' }).finally(() => {
        setSessionId(null);
        refreshAllCollections();
      });
      return;
    }
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
