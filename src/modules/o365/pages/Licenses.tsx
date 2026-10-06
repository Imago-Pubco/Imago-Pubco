import { useMemo, useState } from 'react';
import { KeyRound, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { logAudit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, Modal, PageHeader, useToast } from '@/components/ui';
import { o365 } from '../connector';
import { skuName } from '../skus';
import type { O365License, O365Tenant } from '../types';
import { ErrorBox, ReloadButton, WithTenant, errMsg, matches, useTenantData } from '../ui';

export function Licenses() {
  return <WithTenant>{(tenant) => <LicensesFor tenant={tenant} />}</WithTenant>;
}

function LicensesFor({ tenant }: { tenant: O365Tenant }) {
  const { t } = useI18n();
  const lic = useTenantData(tenant.id, (id) => o365.listLicenses(id, true));
  const [open, setOpen] = useState<O365License | null>(null);

  const rows = [...(lic.data ?? [])].sort((a, b) => skuName(a.skuPartNumber).localeCompare(skuName(b.skuPartNumber)));

  return (
    <Page>
      <PageHeader
        eyebrow={tenant.name}
        title={t('Licences', 'Licenses')}
        subtitle={t('Licences payantes seulement. Cliquez sur une licence pour voir à qui elle est attribuée.', 'Paid licenses only. Click a license to see who it is assigned to.')}
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
        {open && <Holders tenant={tenant} license={open} onChanged={lic.reload} />}
      </Modal>
    </Page>
  );
}

function Holders({ tenant, license, onChanged }: { tenant: O365Tenant; license: O365License; onChanged: () => void }) {
  const { t } = useI18n();
  const { user: me, can } = useAuth();
  const toast = useToast();
  const manage = can('o365.users.manage');
  const holders = useTenantData(tenant.id, (x) => o365.licenseHolders(x, license.skuId));
  const users = useTenantData(manage ? tenant.id : undefined, o365.listUsers);
  const [q, setQ] = useState('');
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = useMemo(
    () => [...(holders.data ?? [])].filter((h) => matches(q, h.displayName, h.userPrincipalName)).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [holders.data, q],
  );
  const used = holders.data?.length ?? 0;
  const available = Math.max(license.total - used, 0);
  const candidates = useMemo(() => {
    const have = new Set((holders.data ?? []).map((h) => h.id));
    return (users.data ?? [])
      .filter((u) => u.accountEnabled && !have.has(u.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [users.data, holders.data]);

  const change = async (userId: string, upn: string, add: boolean) => {
    setBusy(true);
    try {
      await o365.setLicenses(tenant.id, userId, add ? [license.skuId] : [], add ? [] : [license.skuId]);
      await logAudit(me!.id, 'o365.user.licenses', `${tenant.name}: ${upn} ${add ? '+' : '−'}${skuName(license.skuPartNumber)}`);
      toast(add ? t('Licence attribuée', 'License assigned') : t('Licence retirée', 'License revoked'));
      setPick('');
      holders.reload();
      onChanged();
    } catch (e) {
      toast(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (holders.error) return <ErrorBox message={holders.error} onRetry={holders.reload} />;
  if (holders.loading && !holders.data) return <p className="faint">{t('Chargement…', 'Loading…')}</p>;

  return (
    <div className="stack">
      <div className="muted small">
        {t(`${used} utilisateur(s) sur ${license.total} licence(s) · ${available} disponible(s)`, `${used} user(s) of ${license.total} license(s) · ${available} available`)}
      </div>
      {manage && (
        <div className="row row-wrap">
          <select className="select spacer" value={pick} onChange={(e) => setPick(e.target.value)} disabled={busy || !available}>
            <option value="">{available ? t('Attribuer à un utilisateur…', 'Assign to a user…') : t('Aucune licence disponible', 'No license available')}</option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName} — {u.userPrincipalName}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            disabled={busy || !pick}
            onClick={() => {
              const u = candidates.find((c) => c.id === pick);
              if (u) void change(u.id, u.userPrincipalName, true);
            }}
          >
            <Plus size={15} /> {t('Attribuer', 'Assign')}
          </button>
        </div>
      )}
      {used > 8 && (
        <div className="o365-search">
          <Search size={16} />
          <input className="input" placeholder={t('Rechercher…', 'Search…')} value={q} onChange={(e) => setQ(e.target.value)} />
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
                  {manage && (
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-sm"
                        disabled={busy}
                        title={t('Retirer la licence', 'Revoke license')}
                        onClick={() => {
                          if (window.confirm(t(`Retirer cette licence à ${h.displayName} ?`, `Revoke this license from ${h.displayName}?`))) void change(h.id, h.userPrincipalName, false);
                        }}
                      >
                        <Trash2 size={14} /> {t('Retirer', 'Revoke')}
                      </button>
                    </td>
                  )}
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
