import { useMemo, useState } from 'react';
import { KeyRound, Search } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, Modal, PageHeader } from '@/components/ui';
import { o365 } from '../connector';
import { skuName } from '../skus';
import type { O365License, O365Tenant } from '../types';
import { ErrorBox, ReloadButton, WithTenant, matches, useTenantData } from '../ui';

export function Licenses() {
  return <WithTenant>{(tenant) => <LicensesFor tenant={tenant} />}</WithTenant>;
}

function LicensesFor({ tenant }: { tenant: O365Tenant }) {
  const { t } = useI18n();
  const lic = useTenantData(tenant.id, o365.listLicenses);
  const [open, setOpen] = useState<O365License | null>(null);

  const rows = [...(lic.data ?? [])].sort((a, b) => skuName(a.skuPartNumber).localeCompare(skuName(b.skuPartNumber)));

  return (
    <Page>
      <PageHeader
        eyebrow={tenant.name}
        title={t('Licences', 'Licenses')}
        subtitle={t('Cliquez sur une licence pour voir à qui elle est attribuée.', 'Click a license to see who it is assigned to.')}
        actions={<ReloadButton onClick={lic.reload} loading={lic.loading} />}
      />
      {lic.error ? (
        <ErrorBox message={lic.error} onRetry={lic.reload} />
      ) : rows.length ? (
        <div className="o365-licenses">
          {rows.map((l) => {
            const pct = l.total ? Math.min(100, Math.round((l.consumed / l.total) * 100)) : 100;
            const free = l.total - l.consumed;
            const tone = free < 0 ? 'err' : free === 0 ? 'warn' : 'ok';
            return (
              <button key={l.skuId} className="card card-pad o365-license" onClick={() => setOpen(l)}>
                <div className="row">
                  <KeyRound size={18} className="o365-accent" />
                  <strong>{skuName(l.skuPartNumber)}</strong>
                </div>
                <div className="mono faint small">{l.skuPartNumber}</div>
                <div className="o365-bar">
                  <div className={`o365-bar-fill ${tone}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="row small">
                  <span>
                    <strong>{l.consumed}</strong> / {l.total} {t('attribuées', 'assigned')}
                  </span>
                  <span className="spacer" />
                  <span className={`badge badge-${tone}`}>{t(`${Math.max(free, 0)} libre(s)`, `${Math.max(free, 0)} free`)}</span>
                </div>
                {(l.suspended > 0 || l.warning > 0) && (
                  <div className="faint small">
                    {l.warning > 0 && t(`${l.warning} en période de grâce`, `${l.warning} in grace period`)}
                    {l.warning > 0 && l.suspended > 0 && ' · '}
                    {l.suspended > 0 && t(`${l.suspended} suspendue(s)`, `${l.suspended} suspended`)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        !lic.loading && (
          <div className="card">
            <Empty icon={<KeyRound size={36} />} title={t('Aucune licence', 'No licenses')} />
          </div>
        )
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? skuName(open.skuPartNumber) : ''}>
        {open && <Holders tenant={tenant} license={open} />}
      </Modal>
    </Page>
  );
}

function Holders({ tenant, license }: { tenant: O365Tenant; license: O365License }) {
  const { t } = useI18n();
  const holders = useTenantData(tenant.id, (x) => o365.licenseHolders(x, license.skuId));
  const [q, setQ] = useState('');
  const rows = useMemo(
    () => [...(holders.data ?? [])].filter((h) => matches(q, h.displayName, h.userPrincipalName)).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [holders.data, q],
  );

  if (holders.error) return <ErrorBox message={holders.error} onRetry={holders.reload} />;
  if (holders.loading && !holders.data) return <p className="faint">{t('Chargement…', 'Loading…')}</p>;

  return (
    <div className="stack">
      <div className="muted small">
        {t(`${holders.data?.length ?? 0} utilisateur(s) sur ${license.total} licence(s)`, `${holders.data?.length ?? 0} user(s) of ${license.total} license(s)`)}
      </div>
      {(holders.data?.length ?? 0) > 8 && (
        <div className="o365-search">
          <Search size={16} />
          <input className="input" placeholder={t('Rechercher…', 'Search…')} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
      )}
      {rows.length ? (
        <div className="table-wrap o365-holders">
          <table className="table">
            <tbody>
              {rows.map((h) => (
                <tr key={h.id}>
                  <td>
                    <strong>{h.displayName}</strong>
                  </td>
                  <td className="mono small">{h.userPrincipalName}</td>
                  <td>{!h.accountEnabled && <span className="badge badge-err">{t('Bloqué', 'Blocked')}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="faint" style={{ margin: 0 }}>
          {t('Cette licence n’est attribuée à personne.', 'This license is not assigned to anyone.')}
        </p>
      )}
    </div>
  );
}
