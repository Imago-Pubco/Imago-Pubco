import { AnimatePresence, motion } from 'framer-motion';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { I18nProvider } from '@/i18n';
import { ToastProvider } from '@/components/ui';
import { AppShell } from '@/layout/AppShell';
import { Login } from '@/pages/Login';

function Gate() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return (
    <AnimatePresence mode="wait">
      {user ? (
        <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          <AppShell />
        </motion.div>
      ) : (
        <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.4 }}>
          <Login />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <Gate />
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
