import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ensureSeeded } from './data/seed';
import { ensureEstimatingSeeded } from './modules/estimating/stores';
import { ensureItAccess } from './modules/it/migrate';
import { applyTheme, initialTheme } from './layout/theme';
import './styles/global.css';

applyTheme(initialTheme());

ensureSeeded()
  .then(() => Promise.all([ensureEstimatingSeeded(), ensureItAccess()]))
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
