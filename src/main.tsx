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
    ]).then(async ([seed, est, cmp, it, o365, rh]) => {
      await seed.ensureSeeded();
      await Promise.all([est.ensureEstimatingSeeded(), cmp.ensureComplianceSeeded(), it.ensureItAccess(), o365.ensureO365Seeded()]);
      await rh.ensureRhAccess();
    });

ready.then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
