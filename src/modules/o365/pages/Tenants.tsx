import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, ExternalLink, Globe, KeyRound, Plus, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { API_MODE, api, uid } from '@/data/db';
import { logAudit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Kpi, KpiGrid } from '@/components/Kpi';
import { Empty, Modal, PageHeader, useToast } from '@/components/ui';
import { o365 } from '../connector';
import { o365Tenants, useSelectedTenant } from '../stores';
import type { O365Tenant } from '../types';
import { ErrorBox, ReloadButton, useTenantData } from '../ui';

/** Client id of the multi-tenant app registration, for the admin consent link. */
function useClientId() {
  const [id, setId] = useState('');
  useEffect(() => {
    if (!API_MODE) return;
    api<{ integrations: { o365: { clientId: string } | null } }>('/config').then((c) => setId(c.integrations.o365?.clientId ?? ''), () => {});
  }, []);
  return id;
}

export function Tenants() {
  const { t, fmtDate } = useI18n();
  const { user, can } = useAuth();
  const toast = useToast();
  const { tenants, tenant, select } = useSelectedTenant();
  const [edit, setEdit] = useState<O365Tenant | null>(null);
  const [confirm, setConfirm] = useState<O365Tenant | null>(null);
  const clientId = useClientId();
  const manage = can('o365.tenants.manage');
  const { data: ov, error, loading, reload } = useTenantData(tenant?.id, o365.overview);

  const save = async () => {
    if (!edit) return;
    const row = { ...edit, name: edit.name.trim(), tenantId: edit.tenantId.trim() };
    if (await o365Tenants.get(row.id)) await o365Tenants.update(row.id, row);
    else await o365Tenants.insert(row);
    await logAudit(user!.id, 'o365.tenant.save', `${row.name} (${row.tenantId})`);
    select(row.id);
    setEdit(null);
    toast(t('Locataire enregistré', 'Tenant saved'));
  };

  const remove = async () => {
    if (!confirm) return;
    await o365Tenants.remove(confirm.id);
    await logAudit(user!.id, 'o365.tenant.remove', confirm.name);
    setConfirm(null);
    toast(t('Locataire retiré d’Imago', 'Tenant removed from Imago'));
  };

  const consentUrl = (x: O365Tenant) =>
    `https://login.microsoftonline.com/${encodeURIComponent(x.tenantId)}/adminconsent?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(location.origin + '/o365')}`;

  return (
    <Page>
      <PageHeader
        eyebrow="Gestion O365"
        title={t('Locataires', 'Tenants')}
        subtitle={t('Les locataires Microsoft 365 gérés depuis Imago.', 'Microsoft 365 tenants managed from Imago.')}
        actions={
          manage && (
            <button className="btn btn-primary" onClick={() => setEdit({ id: uid('t_'), name: '', tenantId: '', notes: '', addedAt: new Date().toISOString() })}>
              <Plus size={16} /> {t('Locataire', 'Tenant')}
            </button>
          )
        }
      />

      {tenants.length ? (
        <div className="o365-tenants">
          {tenants.map((x) => (
            <button key={x.id} className={`card card-pad o365-tenant ${tenant?.id === x.id ? 'active' : ''}`} onClick={() => select(x.id)}>
              <div className="row">
                <Building2 size={20} />
                <strong>{x.name}</strong>
                <span className="spacer" />
                {tenant?.id === x.id && <CheckCircle2 size={16} className="o365-accent" />}
              </div>
              <div className="mono faint small">{x.tenantId}</div>
              {x.notes && <div className="muted small">{x.notes}</div>}
            </button>
          ))}
        </div>
      ) : (
        <div className="card">
          <Empty icon={<Building2 size={36} />} title={t('Aucun locataire', 'No tenant')}>
            {t('Ajoutez un locataire avec son identifiant (GUID) ou son domaine .onmicrosoft.com.', 'Add a tenant with its id (GUID) or its .onmicrosoft.com domain.')}
          </Empty>
        </div>
      )}

      {tenant && (
        <div className="stack" style={{ marginTop: 24 }}>
          <div className="row">
            <h2 style={{ margin: 0 }}>{ov?.displayName ?? tenant.name}</h2>
            <span className="spacer" />
            <ReloadButton onClick={reload} loading={loading} />
            {manage && (
              <>
                {API_MODE && clientId && (
                  <a className="btn" href={consentUrl(tenant)} target="_blank" rel="noreferrer">
                    <KeyRound size={16} /> {t('Consentement administrateur', 'Admin consent')} <ExternalLink size={13} />
                  </a>
                )}
                <button className="btn" onClick={() => setEdit(structuredClone(tenant))}>
                  {t('Modifier', 'Edit')}
                </button>
                <button className="btn btn-ghost btn-icon" title={t('Retirer', 'Remove')} onClick={() => setConfirm(tenant)}>
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>

          {error ? (
            <ErrorBox message={error} onRetry={reload} />
          ) : (
            ov && (
              <>
                <KpiGrid>
                  <Kpi label={t('Utilisateurs', 'Users')} value={ov.userCount} icon={<Users size={17} />} to="/o365/users" />
                  <Kpi
                    label={t('Licences utilisées', 'Licenses used')}
                    value={`${ov.licensesUsed} / ${ov.licensesTotal}`}
                    icon={<KeyRound size={17} />}
                    tone={ov.licensesUsed >= ov.licensesTotal ? 'warn' : 'ok'}
                    to="/o365/licenses"
                  />
                  <Kpi label={t('Domaines', 'Domains')} value={ov.domains.length} icon={<Globe size={17} />} hint={ov.defaultDomain} />
                </KpiGrid>
                <div className="card card-pad">
                  <dl className="o365-dl">
                    <dt>{t('Domaine par défaut', 'Default domain')}</dt>
                    <dd>{ov.defaultDomain}</dd>
                    <dt>{t('Domaine initial', 'Initial domain')}</dt>
                    <dd className="mono">{ov.initialDomain}</dd>
                    <dt>{t('Tous les domaines', 'All domains')}</dt>
                    <dd>{ov.domains.join(', ')}</dd>
                    <dt>{t('Pays', 'Country')}</dt>
                    <dd>{ov.country}</dd>
                    <dt>{t('Créé le', 'Created')}</dt>
                    <dd>{fmtDate(ov.createdAt)}</dd>
                  </dl>
                </div>
              </>
            )
          )}
        </div>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={t('Locataire Microsoft 365', 'Microsoft 365 tenant')}
        footer={
          <>
            <button className="btn" onClick={() => setEdit(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary" onClick={save} disabled={!edit?.name.trim() || !edit?.tenantId.trim()}>
              {t('Enregistrer', 'Save')}
            </button>
          </>
        }
      >
        {edit && (
          <div className="stack">
            <label className="field">
              <span>{t('Nom', 'Name')}</span>
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus />
            </label>
            <label className="field">
              <span>{t('ID du locataire ou domaine .onmicrosoft.com', 'Tenant id or .onmicrosoft.com domain')}</span>
              <input
                className="input mono"
                value={edit.tenantId}
                placeholder="00000000-0000-0000-0000-000000000000"
                onChange={(e) => setEdit({ ...edit, tenantId: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{t('Notes', 'Notes')}</span>
              <textarea className="input" rows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </label>
            {API_MODE && (
              <p className="faint small" style={{ margin: 0 }}>
                {t(
                  'Après l’ajout, un administrateur global du locataire doit cliquer sur « Consentement administrateur » pour autoriser l’application Imago.',
                  'After adding it, a global administrator of the tenant must click “Admin consent” to authorise the Imago app.',
                )}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={t('Retirer ce locataire ?', 'Remove this tenant?')}
        footer={
          <>
            <button className="btn" onClick={() => setConfirm(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-danger" onClick={remove}>
              {t('Retirer', 'Remove')}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {t(
            `« ${confirm?.name} » ne sera plus géré depuis Imago. Rien n’est supprimé dans Microsoft 365.`,
            `“${confirm?.name}” will no longer be managed from Imago. Nothing is deleted in Microsoft 365.`,
          )}
        </p>
      </Modal>
    </Page>
  );
}
