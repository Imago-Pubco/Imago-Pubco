import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Empty } from '@/components/ui';
import { useSelectedTenant } from './stores';
import type { O365Tenant } from './types';

/** Tenant selector shown in the top bar while the module is open. */
export function TenantPicker() {
  const { t } = useI18n();
  const { tenants, tenant, select } = useSelectedTenant();
  if (!tenants.length) return null;
  return (
    <label className="o365-picker" title={t('Locataire Microsoft 365', 'Microsoft 365 tenant')}>
      <Building2 size={15} />
      <select className="select input-sm" value={tenant?.id ?? ''} onChange={(e) => select(e.target.value)}>
        {tenants.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Renders children with the selected tenant, or an empty state when none exists. */
export function WithTenant({ children }: { children: (tenant: O365Tenant) => ReactNode }) {
  const { t } = useI18n();
  const { tenant, loading } = useSelectedTenant();
  if (loading) return null;
  if (!tenant)
    return (
      <Empty icon={<Building2 size={36} />} title={t('Aucun locataire', 'No tenant')}>
        <Link to="/o365" className="btn btn-primary">
          {t('Ajouter un locataire', 'Add a tenant')}
        </Link>
      </Empty>
    );
  return <>{children(tenant)}</>;
}

/** Loads data for a tenant; `reload` refetches. Errors are kept for display. */
export function useTenantData<T>(tenantKey: string | undefined, load: (tenant: string) => Promise<T>) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    if (!tenantKey) return;
    setLoading(true);
    setError('');
    load(tenantKey)
      .then(setData, (e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantKey]);
  useEffect(() => {
    setData(undefined);
    reload();
  }, [reload]);
  return { data, error, loading, reload };
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="o365-error card card-pad">
      <AlertTriangle size={18} />
      <div className="spacer">{message}</div>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>
          <RefreshCw size={14} /> {t('Réessayer', 'Retry')}
        </button>
      )}
    </div>
  );
}

export function ReloadButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  const { t } = useI18n();
  return (
    <button className="btn" onClick={onClick} disabled={loading} title={t('Actualiser', 'Refresh')}>
      <RefreshCw size={16} className={loading ? 'spin' : ''} />
    </button>
  );
}

/** Case-insensitive match of a search string against several fields. */
export const matches = (q: string, ...fields: (string | undefined)[]) => {
  const s = q.trim().toLowerCase();
  return !s || fields.some((f) => f?.toLowerCase().includes(s));
};

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
