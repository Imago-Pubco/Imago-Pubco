import { AnimatePresence, motion } from 'framer-motion';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { I18nProvider } from '@/i18n';
import { ToastProvider } from '@/components/ui';
import { BrandingProvider } from '@/branding/BrandingContext';
import { AppShell } from '@/layout/AppShell';
import { Login } from '@/pages/Login';
import { ResetPassword } from '@/pages/ResetPassword';
import { QuotePage } from '@/pages/public/QuotePage';
import { RequestFormPage } from '@/pages/public/RequestFormPage';
import { ImpersonationBanner } from '@/layout/ImpersonationBanner';

function Gate() {
  const { user, ready } = useAuth();
  const { pathname } = useLocation();
  // The link in the welcome / password-reset e-mail works whether or not someone is signed in.
  if (pathname === '/reset-password') return <ResetPassword />;
  // Customer-facing pages: reached by link, no sign-in.
  const quote = /^\/q\/([A-Za-z0-9_-]{20,128})\/?$/.exec(pathname);
  if (quote) return <QuotePage token={quote[1]} />;
  if (/^\/request\/?$/.test(pathname)) return <RequestFormPage />;
  if (!ready) return null;
  return (
    <AnimatePresence mode="wait">
      {user ? (
        <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          <ImpersonationBanner />
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
  // The Sandbox preview is built under a sub-path (vite --base); the normal app has base "/".
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <BrandingProvider>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <Gate />
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
      </BrandingProvider>
    </BrowserRouter>
  );
}
