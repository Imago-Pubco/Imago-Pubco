import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, initialTheme } from './layout/theme';
import './styles/global.css';

applyTheme(initialTheme());

// Demo data is for the browser dev backend only (loaded lazily so it is not part of the
// production bundle); the API server initialises its own database.
// Decided from build-time constants only, so the production build contains no demo data or demo passwords at all.
const BROWSER_BACKEND = import.meta.env.VITE_BACKEND ? import.meta.env.VITE_BACKEND === 'browser' : !import.meta.env.PROD;

const ready = !BROWSER_BACKEND
  ? Promise.resolve()
  : Promise.all([
      import('./data/seed'),
      import('./modules/estimating/stores'),
      import('./modules/compliance/stores'),
      import('./modules/it/migrate'),
      import('./modules/o365/connector'),
      import('./modules/rh/migrate'),
      import('./modules/align/devSeed'),
      import('./modules/sales/stores'),
    ]).then(async ([seed, est, cmp, it, o365, rh, align, sales]) => {
      await seed.ensureSeeded();
      await Promise.all([est.ensureEstimatingSeeded(), cmp.ensureComplianceSeeded(), it.ensureItAccess(), o365.ensureO365Seeded(), align.ensureAlignSeeded(), sales.ensureSalesSeeded()]);
      await rh.ensureRhAccess();
      // Sandbox preview (built by the Sandbox runner, demo data only): open signed in, with exactly the rights of the
      // person who made the request, so they land in the app but can only open what their real access allows. Every
      // demo account is switched off, so nobody can sign in as the demo administrator instead. Browser backend only.
      if (import.meta.env.VITE_SANDBOX_PREVIEW === '1') {
        const { users, groups } = await import('./data/stores');
        let rights: string[] = [];
        try {
          const v: unknown = JSON.parse(import.meta.env.VITE_SANDBOX_PERMS ?? '[]');
          if (Array.isArray(v)) rights = v.filter((p): p is string => typeof p === 'string');
        } catch {
          /* no rights: an empty preview, never an open one */
        }
        for (const u of await users.list()) await users.update(u.id, { active: false });
        await groups.insert({ id: 'g_sandbox', name: 'Vos droits', description: 'Les droits de la personne qui a fait la demande', permissions: rights, system: true });
        await users.insert({
          id: 'u_sandbox',
          username: 'sandbox',
          displayName: import.meta.env.VITE_SANDBOX_USER || 'Vous',
          email: '',
          passwordHash: '',
          salt: '',
          groupIds: ['g_sandbox'],
          active: true,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem('imago:session', 'u_sandbox');
      }
    });

ready.then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
