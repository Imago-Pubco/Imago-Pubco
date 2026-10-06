import { useMemo, useState } from 'react';
import { KeyRound, Plus, Search, Trash2, UserCheck, UserX } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { logAudit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, Modal, PageHeader, useToast } from '@/components/ui';
import { o365 } from '../connector';
import { skuName } from '../skus';
import type { O365License, O365Tenant, O365User, O365UserInput } from '../types';
import { ErrorBox, ReloadButton, WithTenant, errMsg, matches, useTenantData } from '../ui';

export function Users() {
  return <WithTenant>{(tenant) => <UsersFor tenant={tenant} />}</WithTenant>;
}

type Draft = O365UserInput & { id?: string; alias: string; domain: string; password: string; licenses: string[] };

/** Strong random password: 16 chars from letters, digits and symbols. */
function generatePassword() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?'];
  const all = sets.join('');
  const pick = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  const chars = [...sets.map(pick), ...Array.from({ length: 12 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function UsersFor({ tenant }: { tenant: O365Tenant }) {
  const { t } = useI18n();
  const { user: me, can } = useAuth();
  const toast = useToast();
  const manage = can('o365.users.manage');
  const users = useTenantData(tenant.id, o365.listUsers);
  const lic = useTenantData(tenant.id, o365.listLicenses);
  const ov = useTenantData(tenant.id, o365.overview);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'enabled' | 'disabled' | 'unlicensed'>('all');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [original, setOriginal] = useState<O365User | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [reset, setReset] = useState<{ user: O365User; password: string; force: boolean } | null>(null);
  const [del, setDel] = useState<O365User | null>(null);

  const licenses: O365License[] = lic.data ?? [];
  const licName = (skuId: string) => skuName(licenses.find((l) => l.skuId === skuId)?.skuPartNumber ?? skuId);

  const rows = useMemo(
    () =>
      [...(users.data ?? [])]
        .filter((u) => matches(q, u.displayName, u.userPrincipalName, u.jobTitle, u.department))
        .filter((u) =>
          status === 'enabled' ? u.accountEnabled : status === 'disabled' ? !u.accountEnabled : status === 'unlicensed' ? !u.licenses.length : true,
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [users.data, q, status],
  );

  const domains = ov.data?.domains ?? [];
  const audit = (action: string, detail: string) => logAudit(me!.id, action, `${tenant.name}: ${detail}`);

  const openNew = () => {
    setErr('');
    setOriginal(null);
    setDraft({
      displayName: '',
      givenName: '',
      surname: '',
      jobTitle: '',
      department: '',
      officeLocation: '',
      mobilePhone: '',
      usageLocation: 'CA',
      accountEnabled: true,
      alias: '',
      domain: ov.data?.defaultDomain ?? domains[0] ?? '',
      password: generatePassword(),
      licenses: [],
    });
  };

  const openEdit = (u: O365User) => {
    setErr('');
    setOriginal(u);
    const [alias, domain] = u.userPrincipalName.split('@');
    setDraft({ ...u, alias, domain, password: '', licenses: [...u.licenses] });
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setErr('');
    const fields: O365UserInput = {
      displayName: draft.displayName.trim() || `${draft.givenName} ${draft.surname}`.trim(),
      givenName: draft.givenName.trim(),
      surname: draft.surname.trim(),
      jobTitle: draft.jobTitle.trim(),
      department: draft.department.trim(),
      officeLocation: draft.officeLocation.trim(),
      mobilePhone: draft.mobilePhone.trim(),
      usageLocation: draft.usageLocation.trim().toUpperCase(),
      accountEnabled: draft.accountEnabled,
    };
    try {
      let id = draft.id;
      if (!id) {
        const upn = `${draft.alias.trim().toLowerCase()}@${draft.domain}`;
        const created = await o365.createUser(tenant.id, { ...fields, userPrincipalName: upn, password: draft.password });
        id = created.id;
        await audit('o365.user.create', upn);
      } else {
        await o365.updateUser(tenant.id, id, fields);
        await audit('o365.user.update', original?.userPrincipalName ?? id);
      }
      const before = original?.licenses ?? [];
      const add = draft.licenses.filter((s) => !before.includes(s));
      const remove = before.filter((s) => !draft.licenses.includes(s));
      if (add.length || remove.length) {
        await o365.setLicenses(tenant.id, id, add, remove);
        await audit('o365.user.licenses', `${draft.alias}@${draft.domain} +${add.map(licName).join(', ')} −${remove.map(licName).join(', ')}`);
      }
      if (!draft.id) toast(t(`Utilisateur créé. Mot de passe temporaire : ${draft.password}`, `User created. Temporary password: ${draft.password}`));
      else toast(t('Utilisateur enregistré', 'User saved'));
      setDraft(null);
      users.reload();
      lic.reload();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (u: O365User) => {
    try {
      await o365.updateUser(tenant.id, u.id, { accountEnabled: !u.accountEnabled });
      await audit(u.accountEnabled ? 'o365.user.disable' : 'o365.user.enable', u.userPrincipalName);
      toast(u.accountEnabled ? t('Connexion bloquée', 'Sign-in blocked') : t('Connexion autorisée', 'Sign-in allowed'));
      users.reload();
    } catch (e) {
      toast(errMsg(e), 'err');
    }
  };

  const doReset = async () => {
    if (!reset) return;
    setBusy(true);
    try {
      await o365.resetPassword(tenant.id, reset.user.id, reset.password, reset.force);
      await audit('o365.user.password', reset.user.userPrincipalName);
      toast(t(`Mot de passe réinitialisé : ${reset.password}`, `Password reset: ${reset.password}`));
      setReset(null);
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!del) return;
    setBusy(true);
    try {
      await o365.deleteUser(tenant.id, del.id);
      await audit('o365.user.delete', del.userPrincipalName);
      toast(t('Utilisateur supprimé (récupérable 30 jours dans Microsoft 365)', 'User deleted (recoverable for 30 days in Microsoft 365)'));
      setDel(null);
      users.reload();
      lic.reload();
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => d && { ...d, [k]: v });

  return (
    <Page wide>
      <PageHeader
        eyebrow={tenant.name}
        title={t('Utilisateurs', 'Users')}
        subtitle={users.data ? t(`${users.data.length} comptes`, `${users.data.length} accounts`) : undefined}
        actions={
          <>
            <ReloadButton onClick={users.reload} loading={users.loading} />
            {manage && (
              <button className="btn btn-primary" onClick={openNew} disabled={!domains.length}>
                <Plus size={16} /> {t('Utilisateur', 'User')}
              </button>
            )}
          </>
        }
      />

      <div className="row row-wrap" style={{ marginBottom: 16 }}>
        <div className="o365-search">
          <Search size={16} />
          <input className="input" placeholder={t('Rechercher…', 'Search…')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">{t('Tous', 'All')}</option>
          <option value="enabled">{t('Actifs', 'Enabled')}</option>
          <option value="disabled">{t('Bloqués', 'Blocked')}</option>
          <option value="unlicensed">{t('Sans licence', 'Unlicensed')}</option>
        </select>
      </div>

      {users.error ? (
        <ErrorBox message={users.error} onRetry={users.reload} />
      ) : (
        <div className="card">
          {rows.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Nom', 'Name')}</th>
                    <th>{t('Identifiant', 'Username')}</th>
                    <th>{t('Poste / service', 'Title / department')}</th>
                    <th>{t('Licences', 'Licenses')}</th>
                    <th>{t('Statut', 'Status')}</th>
                    {manage && <th />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className={manage ? 'clickable' : ''} onClick={() => manage && openEdit(u)}>
                      <td>
                        <strong>{u.displayName}</strong>
                      </td>
                      <td className="mono small">{u.userPrincipalName}</td>
                      <td className="small">{[u.jobTitle, u.department].filter(Boolean).join(' · ') || <span className="faint">—</span>}</td>
                      <td className="small">
                        {u.licenses.length ? u.licenses.map(licName).join(', ') : <span className="faint">{t('Aucune', 'None')}</span>}
                      </td>
                      <td>
                        {u.accountEnabled ? (
                          <span className="badge badge-ok">{t('Actif', 'Enabled')}</span>
                        ) : (
                          <span className="badge badge-err">{t('Bloqué', 'Blocked')}</span>
                        )}
                      </td>
                      {manage && (
                        <td className="num" onClick={(e) => e.stopPropagation()}>
                          <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost btn-icon btn-sm" title={t('Réinitialiser le mot de passe', 'Reset password')} onClick={() => setReset({ user: u, password: generatePassword(), force: true })}>
                              <KeyRound size={15} />
                            </button>
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              title={u.accountEnabled ? t('Bloquer la connexion', 'Block sign-in') : t('Autoriser la connexion', 'Allow sign-in')}
                              onClick={() => toggle(u)}
                            >
                              {u.accountEnabled ? <UserX size={15} /> : <UserCheck size={15} />}
                            </button>
                            <button className="btn btn-ghost btn-icon btn-sm" title={t('Supprimer', 'Delete')} onClick={() => setDel(u)}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !users.loading && <Empty icon={<Search size={36} />} title={t('Aucun utilisateur', 'No users')} />
          )}
        </div>
      )}

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        large
        title={draft?.id ? draft.displayName : t('Nouvel utilisateur', 'New user')}
        footer={
          <>
            <button className="btn" onClick={() => setDraft(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary" onClick={save} disabled={busy || !draft || (!draft.id && (!draft.alias.trim() || !draft.domain || draft.password.length < 8))}>
              {t('Enregistrer', 'Save')}
            </button>
          </>
        }
      >
        {draft && (
          <div className="stack">
            {err && <div className="badge badge-err" style={{ whiteSpace: 'normal' }}>{err}</div>}
            <div className="form-grid">
              <label className="field">
                <span>{t('Prénom', 'First name')}</span>
                <input className="input" value={draft.givenName} onChange={(e) => set('givenName', e.target.value)} />
              </label>
              <label className="field">
                <span>{t('Nom', 'Last name')}</span>
                <input className="input" value={draft.surname} onChange={(e) => set('surname', e.target.value)} />
              </label>
              <label className="field">
                <span>{t('Nom complet', 'Display name')}</span>
                <input className="input" value={draft.displayName} placeholder={`${draft.givenName} ${draft.surname}`.trim()} onChange={(e) => set('displayName', e.target.value)} />
              </label>
              <label className="field">
                <span>{t('Nom d’utilisateur', 'Username')}</span>
                {draft.id ? (
                  <input className="input mono" value={`${draft.alias}@${draft.domain}`} disabled />
                ) : (
                  <div className="row" style={{ gap: 6 }}>
                    <input className="input mono" value={draft.alias} placeholder="prenom.nom" onChange={(e) => set('alias', e.target.value.replace(/\s/g, ''))} />
                    <span className="faint">@</span>
                    <select className="select" value={draft.domain} onChange={(e) => set('domain', e.target.value)}>
                      {domains.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}
              </label>
              <label className="field">
                <span>{t('Poste', 'Job title')}</span>
                <input className="input" value={draft.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} />
              </label>
              <label className="field">
                <span>{t('Service', 'Department')}</span>
                <input className="input" value={draft.department} onChange={(e) => set('department', e.target.value)} />
              </label>
              <label className="field">
                <span>{t('Bureau', 'Office')}</span>
                <input className="input" value={draft.officeLocation} onChange={(e) => set('officeLocation', e.target.value)} />
              </label>
              <label className="field">
                <span>{t('Mobile', 'Mobile')}</span>
                <input className="input" value={draft.mobilePhone} onChange={(e) => set('mobilePhone', e.target.value)} />
              </label>
              <label className="field">
                <span>{t('Pays d’utilisation (licences)', 'Usage location (licenses)')}</span>
                <input className="input mono" maxLength={2} value={draft.usageLocation} onChange={(e) => set('usageLocation', e.target.value.toUpperCase())} />
              </label>
              {!draft.id && (
                <label className="field">
                  <span>{t('Mot de passe temporaire', 'Temporary password')}</span>
                  <div className="row" style={{ gap: 6 }}>
                    <input className="input mono" value={draft.password} onChange={(e) => set('password', e.target.value)} />
                    <button className="btn btn-sm" type="button" onClick={() => set('password', generatePassword())}>
                      {t('Générer', 'Generate')}
                    </button>
                  </div>
                </label>
              )}
            </div>
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={draft.accountEnabled} onChange={(e) => set('accountEnabled', e.target.checked)} />
              {t('Connexion autorisée', 'Sign-in allowed')}
            </label>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>
                {t('Licences', 'Licenses')}
              </div>
              <div className="o365-checks">
                {licenses.map((l) => {
                  const had = original?.licenses.includes(l.skuId) ?? false;
                  const on = draft.licenses.includes(l.skuId);
                  const free = l.total - l.consumed + (had ? 1 : 0);
                  return (
                    <label key={l.skuId} className="row" style={{ gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!on && free <= 0}
                        onChange={(e) => set('licenses', e.target.checked ? [...draft.licenses, l.skuId] : draft.licenses.filter((s) => s !== l.skuId))}
                      />
                      <span>{skuName(l.skuPartNumber)}</span>
                      <span className="faint small">
                        {t(`${Math.max(free - (on && !had ? 1 : 0), 0)} disponible(s)`, `${Math.max(free - (on && !had ? 1 : 0), 0)} available`)}
                      </span>
                    </label>
                  );
                })}
                {!licenses.length && <span className="faint small">{t('Aucune licence dans ce locataire.', 'No licenses in this tenant.')}</span>}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!reset}
        onClose={() => setReset(null)}
        title={t('Réinitialiser le mot de passe', 'Reset password')}
        footer={
          <>
            <button className="btn" onClick={() => setReset(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary" onClick={doReset} disabled={busy || !reset || reset.password.length < 8}>
              {t('Réinitialiser', 'Reset')}
            </button>
          </>
        }
      >
        {reset && (
          <div className="stack">
            <div className="muted">{reset.user.userPrincipalName}</div>
            <label className="field">
              <span>{t('Nouveau mot de passe', 'New password')}</span>
              <div className="row" style={{ gap: 6 }}>
                <input className="input mono" value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} />
                <button className="btn btn-sm" onClick={() => setReset({ ...reset, password: generatePassword() })}>
                  {t('Générer', 'Generate')}
                </button>
              </div>
            </label>
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={reset.force} onChange={(e) => setReset({ ...reset, force: e.target.checked })} />
              {t('Exiger un changement à la prochaine connexion', 'Require a change at next sign-in')}
            </label>
          </div>
        )}
      </Modal>

      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        title={t('Supprimer cet utilisateur ?', 'Delete this user?')}
        footer={
          <>
            <button className="btn" onClick={() => setDel(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-danger" onClick={doDelete} disabled={busy}>
              {t('Supprimer', 'Delete')}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {t(
            `${del?.displayName} (${del?.userPrincipalName}) sera supprimé et ses licences libérées. Le compte reste récupérable 30 jours dans le centre d’administration Microsoft 365.`,
            `${del?.displayName} (${del?.userPrincipalName}) will be deleted and their licenses freed. The account can be restored for 30 days in the Microsoft 365 admin center.`,
          )}
        </p>
      </Modal>
    </Page>
  );
}
