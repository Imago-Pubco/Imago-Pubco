import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Search, UserCheck, UserX, KeyRound, Mail } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { effectivePermissions } from '@/auth/permissions';
import { API_MODE, api, uid, useCollection } from '@/data/db';
import { groups, logAudit, users } from '@/data/stores';
import { hashPassword, newSalt } from '@/data/crypto';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Modal, PageHeader, useToast } from '@/components/ui';
import type { User } from '@/data/types';

interface Draft {
  id?: string;
  displayName: string;
  username: string;
  email: string;
  active: boolean;
  groupIds: string[];
  password: string;
  /** New users only: send the welcome e-mail (identifier + link to choose a password). */
  sendWelcome?: boolean;
}

/** A password nobody knows: the person sets their own through the link in the welcome e-mail. */
const randomPassword = () => {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, 'x');
};

export function Users() {
  const { t, fmtDate } = useI18n();
  const { user: me } = useAuth();
  const toast = useToast();
  const { rows } = useCollection(users);
  const { rows: allGroups } = useCollection(groups);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState('');
  const [mailOn, setMailOn] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (API_MODE) api<{ enabled: boolean }>('/mail/status').then((r) => setMailOn(r.enabled), () => setMailOn(false));
  }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return rows
      .filter((u) => !s || [u.displayName, u.username, u.email].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [rows, q]);

  const open = (u?: User) => {
    setErr('');
    setDraft(
      u
        ? { id: u.id, displayName: u.displayName, username: u.username, email: u.email, active: u.active, groupIds: [...u.groupIds], password: '' }
        : { displayName: '', username: '', email: '', active: true, groupIds: [], password: '', sendWelcome: mailOn },
    );
  };

  const save = async () => {
    if (!draft) return;
    const uname = draft.username.trim().toLowerCase();
    if (!draft.displayName.trim() || !uname) return setErr(t('Nom et identifiant requis.', 'Name and username are required.'));
    if (rows.some((u) => u.username.toLowerCase() === uname && u.id !== draft.id))
      return setErr(t('Cet identifiant existe déjà.', 'That username already exists.'));
    // With the welcome e-mail the password is optional: the person chooses their own from the link.
    const welcome = !draft.id && !!draft.sendWelcome && mailOn && !!draft.email.trim();
    if (!draft.id && draft.sendWelcome && mailOn && !draft.email.trim()) return setErr(t('Un courriel est requis pour envoyer le message de bienvenue.', 'An e-mail address is required to send the welcome message.'));
    if (!draft.id && !welcome && draft.password.length < 8) return setErr(t('Mot de passe : 8 caractères minimum.', 'Password: at least 8 characters.'));
    if (draft.id && draft.password && draft.password.length < 8) return setErr(t('Mot de passe : 8 caractères minimum.', 'Password: at least 8 characters.'));
    if (draft.id === me?.id && !draft.active) return setErr(t('Vous ne pouvez pas désactiver votre propre compte.', 'You cannot deactivate your own account.'));
    if (draft.id === me?.id) {
      const perms = effectivePermissions({ ...me!, groupIds: draft.groupIds }, allGroups);
      if (!perms.has('*') && !perms.has('admin.*') && !perms.has('admin.users.manage'))
        return setErr(t('Vous perdriez votre accès à la gestion des utilisateurs.', 'You would lose access to user management.'));
    }

    const base = { displayName: draft.displayName.trim(), username: uname, email: draft.email.trim(), active: draft.active, groupIds: draft.groupIds };
    try {
      if (draft.id) {
        const patch: Partial<User> & { password?: string } = { ...base };
        if (draft.password) {
          if (API_MODE) patch.password = draft.password; // hashed by the server
          else {
            patch.salt = newSalt();
            patch.passwordHash = await hashPassword(draft.password, patch.salt);
          }
        }
        await users.update(draft.id, patch);
        await logAudit(me!.id, 'admin.user.update', uname + (draft.password ? ' (password reset)' : ''));
      } else {
        const created = { ...base, id: uid('u_'), createdAt: new Date().toISOString() };
        if (API_MODE) {
          await users.insert({ ...created, password: draft.password || randomPassword() } as unknown as User);
          if (welcome) {
            try {
              const r = await api<{ to: string }>(`/users/${created.id}/welcome-email`, { method: 'POST' });
              toast(t(`Courriel de bienvenue envoyé à ${r.to}`, `Welcome e-mail sent to ${r.to}`));
            } catch (e) {
              toast(t('Utilisateur créé, mais le courriel n’a pas pu être envoyé : ', 'User created, but the e-mail could not be sent: ') + (e instanceof Error ? e.message : String(e)), 'err');
            }
          }
        } else {
          const salt = newSalt();
          await users.insert({ ...created, salt, passwordHash: await hashPassword(draft.password, salt) });
        }
        await logAudit(me!.id, 'admin.user.create', uname);
      }
    } catch (e) {
      return setErr(e instanceof Error ? e.message : String(e));
    }
    setDraft(null);
    toast(t('Utilisateur enregistré', 'User saved'));
  };

  const resendWelcome = async () => {
    if (!draft?.id) return;
    setSending(true);
    try {
      const r = await api<{ to: string }>(`/users/${draft.id}/welcome-email`, { method: 'POST' });
      toast(t(`Courriel de bienvenue envoyé à ${r.to}`, `Welcome e-mail sent to ${r.to}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const toggleGroup = (gid: string) =>
    setDraft((d) => d && { ...d, groupIds: d.groupIds.includes(gid) ? d.groupIds.filter((x) => x !== gid) : [...d.groupIds, gid] });

  const draftPerms = draft ? effectivePermissions({ groupIds: draft.groupIds } as User, allGroups) : new Set<string>();

  return (
    <Page>
      <PageHeader
        eyebrow={t('Administration', 'Administration')}
        title={t('Utilisateurs', 'Users')}
        actions={
          <button className="btn btn-primary" onClick={() => open()}>
            <Plus size={16} /> {t('Utilisateur', 'User')}
          </button>
        }
      />
      <div style={{ position: 'relative', width: 320, marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} />
        <input className="input" style={{ paddingLeft: 34 }} placeholder={t('Rechercher…', 'Search…')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Nom', 'Name')}</th>
                <th>{t('Identifiant', 'Username')}</th>
                <th>{t('Groupes d’accès', 'Access groups')}</th>
                <th>{t('Dernière connexion', 'Last sign-in')}</th>
                <th>{t('Statut', 'Status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="clickable" onClick={() => open(u)}>
                  <td>
                    <div className="row">
                      <Avatar name={u.displayName} />
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {u.displayName} {u.id === me?.id && <span className="faint small">({t('vous', 'you')})</span>}
                        </div>
                        <div className="faint small">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{u.username}</td>
                  <td>
                    <div className="row row-wrap" style={{ gap: 4 }}>
                      {u.groupIds.map((gid) => {
                        const g = allGroups.find((x) => x.id === gid);
                        return g ? (
                          <span key={gid} className="badge" style={{ background: `color-mix(in srgb, ${g.color ?? '#888'} 16%, transparent)`, color: g.color }}>
                            {g.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </td>
                  <td className="muted small">{fmtDate(u.lastLoginAt, true)}</td>
                  <td>
                    {u.active ? (
                      <span className="badge badge-ok">
                        <UserCheck size={12} /> {t('Actif', 'Active')}
                      </span>
                    ) : (
                      <span className="badge badge-err">
                        <UserX size={12} /> {t('Inactif', 'Inactive')}
                      </span>
                    )}
                  </td>
                  <td className="num">
                    <Pencil size={14} className="faint" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? t('Modifier l’utilisateur', 'Edit user') : t('Nouvel utilisateur', 'New user')}
        footer={
          <>
            <button className="btn" onClick={() => setDraft(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary" onClick={save}>
              {t('Enregistrer', 'Save')}
            </button>
          </>
        }
      >
        {draft && (
          <div className="stack">
            {err && <div className="alert alert-err">{err}</div>}
            <div className="form-grid">
              <label className="field">
                <span>{t('Nom complet', 'Full name')}</span>
                <input className="input" value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} autoFocus />
              </label>
              <label className="field">
                <span>{t('Identifiant', 'Username')}</span>
                <input className="input mono" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} autoComplete="off" />
              </label>
              <label className="field">
                <span>{t('Courriel', 'E-mail')}</span>
                <input className="input" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </label>
              <label className="field">
                <span className="row" style={{ gap: 6 }}>
                  <KeyRound size={13} />
                  {draft.id ? t('Nouveau mot de passe (facultatif)', 'New password (optional)') : t('Mot de passe', 'Password')}
                </span>
                <input className="input" type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} autoComplete="new-password" />
              </label>
            </div>
            {mailOn && !draft.id && (
              <label className="check">
                <input type="checkbox" checked={!!draft.sendWelcome} onChange={(e) => setDraft({ ...draft, sendWelcome: e.target.checked })} />
                {t('Envoyer le courriel de bienvenue (le mot de passe devient facultatif : la personne le choisit)', 'Send the welcome e-mail (password becomes optional: the person chooses it)')}
              </label>
            )}
            {mailOn && draft.id && draft.email && (
              <div>
                <button className="btn btn-sm" type="button" onClick={resendWelcome} disabled={sending}>
                  <Mail size={14} /> {t('Renvoyer le courriel de bienvenue', 'Resend the welcome e-mail')}
                </button>
              </div>
            )}
            <label className="check">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              {t('Compte actif', 'Account active')}
            </label>
            <div>
              <div className="label" style={{ marginBottom: 8 }}>
                {t('Groupes d’accès', 'Access groups')}
              </div>
              <div className="group-picker">
                {allGroups.map((g) => (
                  <label key={g.id} className={`group-chip ${draft.groupIds.includes(g.id) ? 'on' : ''}`} style={{ ['--g' as string]: g.color ?? '#888' }}>
                    <input type="checkbox" checked={draft.groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                    <div>
                      <strong>{g.name}</strong>
                      <div className="faint small">{g.description}</div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="faint small" style={{ marginBottom: 0 }}>
                {draftPerms.has('*')
                  ? t('Accès complet (super administrateur).', 'Full access (super administrator).')
                  : t(`${draftPerms.size} permission(s) effective(s).`, `${draftPerms.size} effective permission(s).`)}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}
