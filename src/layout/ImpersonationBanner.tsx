import { useState } from 'react';
import { Eye, LogOut } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n';

/** Shown on every screen while an administrator is viewing the portal as another user. */
export function ImpersonationBanner() {
  const { t } = useI18n();
  const { user, impersonated, stopImpersonating } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!impersonated || !user) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 18,
        transform: 'translateX(-50%)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px 10px 16px',
        borderRadius: 999,
        background: '#7b4fd6',
        color: '#fff',
        boxShadow: '0 8px 30px rgba(0,0,0,.45)',
        fontSize: 14,
        maxWidth: 'calc(100vw - 24px)',
      }}
    >
      <Eye size={18} />
      <span>
        {t('Vous consultez le portail comme', 'You are viewing the portal as')} <strong>{user.displayName}</strong> · {t('lecture seule', 'read-only')}
      </span>
      <button
        className="btn btn-sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          stopImpersonating().catch(() => setBusy(false));
        }}
        style={{ background: '#fff', color: '#3b2a78', border: 0 }}
      >
        <LogOut size={14} /> {t('Quitter', 'Exit')}
      </button>
    </div>
  );
}
