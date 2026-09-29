import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { NavLink, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Home as HomeIcon, PanelLeftClose, PanelLeftOpen, Moon, Sun, LogOut, Menu, ChevronDown, ArrowDownUp } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';
import { modules, moduleForPath, orderModules, HOME_ACCENT } from '@/modules/registry';
import type { ModuleDef } from '@/modules/types';
import { Butterfly, Wordmark } from '@/components/Butterfly';
import { RequirePermission } from '@/components/ui';
import { Avatar } from '@/modules/admin/pages/Users';
import { Home } from '@/pages/Home';
import { WingTransition } from './WingTransition';
import { SideModules } from './SideModules';
import { applyTheme, useTheme } from './theme';
import './shell.css';

const subPath = (m: ModuleDef, path: string) => `${m.path}${path ? '/' + path : ''}`;

export function AppShell() {
  const { t, lang, setLang } = useI18n();
  const { user, can, updatePrefs } = useAuth();
  const location = useLocation();
  const current = moduleForPath(location.pathname);
  const moduleKey = current?.id ?? 'home';
  const accent = current?.accent ?? HOME_ACCENT;
  // Full-screen modules (e.g. IT support's embedded site): no top bar, and the sidebar becomes a thin bar on top.
  const topNav = current?.chrome === 'topnav';
  const ModuleActions = current?.topbarActions;
  const collapsed = !!user?.prefs?.sidebarCollapsed;
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sidebar modules in the user's saved order (drag and drop in the sidebar).
  const sidebarModules = orderModules(
    modules.filter((m) => m.placement !== 'userMenu' && can(m.entryPermission)),
    user?.prefs?.menuOrder,
  );

  /* ----- module menus: open on entering a module, close on leaving it (accordion) ----- */
  // `manual` holds explicit toggles made while inside the current module; it resets on every module change.
  const [manual, setManual] = useState<Record<string, boolean>>({});
  useEffect(() => setManual({}), [moduleKey]);
  const isOpen = (id: string) => manual[id] ?? current?.id === id;
  const setOpen = (id: string, open: boolean) => setManual((m) => ({ ...m, [id]: open }));
  const onModuleClick = (e: MouseEvent, m: ModuleDef) => {
    if (current?.id === m.id) {
      // Already in this module: the header only opens/closes its menu.
      e.preventDefault();
      setOpen(m.id, !isOpen(m.id));
    }
    // Otherwise navigation happens; the new module opens and the previous one closes automatically.
  };

  useEffect(() => {
    if (user?.prefs?.theme) applyTheme(user.prefs.theme);
  }, [user?.prefs?.theme]);
  useEffect(() => {
    if (user?.prefs?.lang && user.prefs.lang !== lang) setLang(user.prefs.lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [moduleKey]);

  const pageLabel = current?.nav
    .slice()
    .reverse()
    .find((n) => (n.path ? location.pathname.startsWith(subPath(current, n.path)) : location.pathname === current.path));

  // During the sign-out fade the shell can re-render once without a user.
  if (!user) return null;

  const workspace = (
    <div className="workspace">
      <div className="scroll" ref={scrollRef}>
        <AnimatePresence mode="wait">
          <motion.div
            key={moduleKey}
            className="module-frame"
            initial={{ opacity: 0, scale: 0.985, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0.45, delay: 0.12, ease: [0.2, 0.7, 0.2, 1] } }}
            exit={{ opacity: 0, scale: 0.985, filter: 'blur(6px)', transition: { duration: 0.3 } }}
          >
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              {modules.map((m) => {
                const C = m.component;
                return (
                  <Route
                    key={m.id}
                    path={`${m.path}/*`}
                    element={
                      <RequirePermission permission={m.entryPermission}>
                        <C />
                      </RequirePermission>
                    }
                  />
                );
              })}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
      <WingTransition moduleKey={moduleKey} color={accent} />
    </div>
  );

  /* ---------- Full-screen layout: horizontal module bar on top ---------- */
  if (topNav) {
    return (
      <div className="shell shell-topnav" style={{ ['--accent' as string]: accent }}>
        <header className="topnav">
          <NavLink to="/" className="topnav-brand" aria-label="Imago">
            <Butterfly size={30} />
          </NavLink>
          <nav className="topnav-links">
            <NavLink to="/" end className="topnav-link" style={{ ['--m' as string]: HOME_ACCENT }} title={t('Tableau de bord', 'Dashboard')}>
              <HomeIcon size={17} />
            </NavLink>
            <span className="topnav-sep" />
            {sidebarModules.map((m) => {
              const Icon = m.icon;
              return (
                <NavLink key={m.id} to={m.path} className="topnav-link" style={{ ['--m' as string]: m.accent }} title={t(m.name)}>
                  <Icon size={17} />
                  {current?.id === m.id && <span className="topnav-label">{t(m.name)}</span>}
                </NavLink>
              );
            })}
          </nav>
          <span className="spacer" />
          {ModuleActions && <ModuleActions />}
          <UserMenu compact />
        </header>
        {workspace}
      </div>
    );
  }

  /* ---------- Standard layout: sidebar + top bar ---------- */
  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`} style={{ ['--accent' as string]: accent }}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <NavLink to="/" aria-label="Imago">
            <Wordmark compact={collapsed} />
          </NavLink>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end className="side-link" style={{ ['--m' as string]: HOME_ACCENT }} title={t('Tableau de bord', 'Dashboard')}>
            <span className="side-icon">
              <HomeIcon size={18} />
            </span>
            <span className="side-text">{t('Tableau de bord', 'Dashboard')}</span>
          </NavLink>

          {sidebarModules.length > 0 && <div className="side-section">{t('Modules', 'Modules')}</div>}
          <SideModules
            modules={sidebarModules}
            currentId={current?.id}
            collapsed={collapsed}
            isOpen={isOpen}
            setOpen={setOpen}
            onModuleClick={onModuleClick}
            can={can}
            onReorder={(ids) => updatePrefs({ menuOrder: ids })}
          />
        </nav>

        <button
          className="side-collapse"
          onClick={() => updatePrefs({ sidebarCollapsed: !collapsed })}
          title={collapsed ? t('Ouvrir le menu latéral', 'Open sidebar') : t('Réduire le menu latéral', 'Collapse sidebar')}
          aria-label={collapsed ? t('Ouvrir le menu latéral', 'Open sidebar') : t('Réduire le menu latéral', 'Collapse sidebar')}
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </aside>
      <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon mobile-only" onClick={() => setMobileOpen(true)} aria-label="Menu">
            <Menu size={20} />
          </button>
          <div className="crumbs">
            <motion.span key={moduleKey} className="crumb-module" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <span className="crumb-dot" />
              {current ? t(current.name) : t('Tableau de bord', 'Dashboard')}
            </motion.span>
            {pageLabel && pageLabel.path && <span className="crumb-page">/ {t(pageLabel.label)}</span>}
          </div>
          <span className="spacer" />
          {ModuleActions && <ModuleActions />}
          <button
            className="btn btn-ghost btn-sm lang-toggle"
            onClick={() => {
              const next = lang === 'fr' ? 'en' : 'fr';
              setLang(next);
              updatePrefs({ lang: next });
            }}
            title="Langue / Language"
          >
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => updatePrefs({ theme: toggleTheme() })} aria-label={t('Thème', 'Theme')}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <UserMenu />
        </header>
        {workspace}
      </div>
    </div>
  );
}

/** Avatar button + dropdown (admin settings, menu order reset, sign-out). */
function UserMenu({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  const { user, can, logout, updatePrefs } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const userMenuModules = modules.filter((m) => m.placement === 'userMenu' && can(m.entryPermission));

  useEffect(() => setOpen(false), [location.pathname]);
  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  return (
    <div className="user-menu" ref={ref}>
      <button className={`user-btn ${open ? 'open' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} title={user.displayName}>
        <Avatar name={user.displayName} size={compact ? 28 : 32} />
        {!compact && <span className="user-name">{user.displayName}</span>}
        <ChevronDown size={14} className="user-chevron" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="user-pop card" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            <div className="user-pop-head">
              <Avatar name={user.displayName} size={40} />
              <div style={{ minWidth: 0 }}>
                <strong>{user.displayName}</strong>
                <div className="faint small">{user.email}</div>
              </div>
            </div>

            {userMenuModules.map((m) => {
              const Icon = m.icon;
              return (
                <NavLink key={m.id} to={m.path} className="user-pop-item user-pop-admin" style={{ ['--m' as string]: m.accent }}>
                  <span className="user-pop-admin-icon">
                    <Icon size={16} />
                  </span>
                  {t('Paramètres d’administration', 'Admin settings')}
                </NavLink>
              );
            })}

            {user.prefs?.menuOrder && (
              <button className="user-pop-item user-pop-admin" onClick={() => updatePrefs({ menuOrder: undefined })}>
                <span className="user-pop-admin-icon" style={{ ['--m' as string]: 'var(--text-3)' }}>
                  <ArrowDownUp size={16} />
                </span>
                {t('Rétablir l’ordre du menu', 'Reset menu order')}
              </button>
            )}

            <hr className="divider" />
            <button className="user-pop-item" onClick={logout}>
              <LogOut size={16} /> {t('Se déconnecter', 'Sign out')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
