import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ensureSeeded } from './data/seed';
import { applyTheme, initialTheme } from './layout/theme';
import './styles/global.css';

applyTheme(initialTheme());

ensureSeeded().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
