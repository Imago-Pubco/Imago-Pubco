import { useMemo, useState } from 'react';
import { Contact, Mail, Search, Trash2, User, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { logAudit } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, Modal, PageHeader, useToast } from '@/components/ui';
import { o365 } from '../connector';
import type { O365Group, O365Member, O365Tenant } from '../types';
import { ErrorBox, ReloadButton, WithTenant, errMsg, matches, useTenantData } from '../ui';

export function Groups() {
  return <WithTenant>{(tenant) => <GroupsFor tenant={tenant} />}</WithTenant>;
}

function GroupsFor({ tenant }: { tenant: O365Tenant }) {
  const { t } = useI18n();
  const { can } = useAuth();
  const groups = useTenantData(tenant.id, o365.listGroups);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(
    () => [...(groups.data ?? [])].filter((g) => matches(q, g.displayName, g.email)).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [groups.data, q],
  );
  const selected = rows.find((g) => g.id === selectedId) ?? rows[0];

  return (
    <Page wide>
      <PageHeader
        eyebrow={tenant.name}
        title={t('Groupes de distribution', 'Distribution groups')}
        actions={<ReloadButton onClick={groups.reload} loading={groups.loading} />}
      />
      {groups.error ? (
        <ErrorBox message={groups.error} onRetry={groups.reload} />
      ) : (
        <div className="o365-split">
          <div className="card o365-list">
            <div className="o365-search" style={{ padding: 12 }}>
              <Search size={16} />
              <input className="input" placeholder={t('Rechercher…', 'Search…')} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {rows.map((g) => (
              <button key={g.id} className={`o365-list-item ${selected?.id === g.id ? 'active' : ''}`} onClick={() => setSelectedId(g.id)}>
                <strong>{g.displayName}</strong>
                <span className="mono faint small">{g.email}</span>
              </button>
            ))}
            {!rows.length && !groups.loading && <Empty icon={<Users size={32} />} title={t('Aucun groupe', 'No groups')} />}
          </div>
          {selected && <GroupMembers key={selected.id} tenant={tenant} group={selected} manage={can('o365.groups.manage')} />}
        </div>
      )}
    </Page>
  );
}

const ICON: Record<O365Member['type'], typeof User> = { user: User, contact: Contact, group: Users, other: Mail };

function GroupMembers({ tenant, group, manage }: { tenant: O365Tenant; group: O365Group; manage: boolean }) {
  const { t } = useI18n();
  const { user: me } = useAuth();
  const toast = useToast();
  const members = useTenantData(tenant.id, (x) => o365.listMembers(x, group.id));
  // Suggestions for the add field: the tenant's users and mail contacts.
  const users = useTenantData(manage ? tenant.id : undefined, o365.listUsers);
  const contacts = useTenantData(manage ? tenant.id : undefined, o365.listContacts);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<O365Member | null>(null);

  const current = new Set((members.data ?? []).map((m) => m.email.toLowerCase()));
  const suggestions = [
    ...(users.data ?? []).filter((u) => u.accountEnabled).map((u) => ({ email: u.mail || u.userPrincipalName, label: u.displayName })),
    ...(contacts.data ?? []).map((c) => ({ email: c.email, label: c.displayName })),
  ].filter((s) => s.email && !current.has(s.email.toLowerCase()));

  const sorted = [...(members.data ?? [])].sort((a, b) => a.displayName.localeCompare(b.displayName));

  const add = async () => {
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    try {
      await o365.addMember(tenant.id, group.id, value);
      await logAudit(me!.id, 'o365.group.member.add', `${tenant.name}: ${value} → ${group.displayName}`);
      toast(t('Membre ajouté', 'Member added'));
      setEmail('');
      members.reload();
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!del) return;
    setBusy(true);
    try {
      await o365.removeMember(tenant.id, group.id, del.id);
      await logAudit(me!.id, 'o365.group.member.remove', `${tenant.name}: ${del.email} ✕ ${group.displayName}`);
      toast(t('Membre retiré', 'Member removed'));
      setDel(null);
      members.reload();
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad stack">
      <div>
        <h2 style={{ margin: 0 }}>{group.displayName}</h2>
        <div className="mono faint small">{group.email}</div>
        {group.description && <p className="muted small" style={{ margin: '6px 0 0' }}>{group.description}</p>}
      </div>

      {manage && (
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            list={`members-${group.id}`}
            placeholder={t('Courriel d’un utilisateur ou d’un contact', 'E-mail of a user or contact')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <datalist id={`members-${group.id}`}>
            {suggestions.map((s) => (
              <option key={s.email} value={s.email}>
                {s.label}
              </option>
            ))}
          </datalist>
          <button className="btn btn-primary" onClick={add} disabled={busy || !email.trim()}>
            <UserPlus size={16} /> {t('Ajouter', 'Add')}
          </button>
        </div>
      )}

      {members.error ? (
        <ErrorBox message={members.error} onRetry={members.reload} />
      ) : (
        <>
          <div className="label">{t(`${sorted.length} membre(s)`, `${sorted.length} member(s)`)}</div>
          {sorted.length ? (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {sorted.map((m) => {
                    const Icon = ICON[m.type];
                    return (
                      <tr key={m.id}>
                        <td style={{ width: 28 }}>
                          <Icon size={16} className="faint" />
                        </td>
                        <td>
                          <strong>{m.displayName}</strong>
                        </td>
                        <td className="mono small">{m.email}</td>
                        <td className="small faint">
                          {m.type === 'user' ? t('Utilisateur', 'User') : m.type === 'contact' ? t('Contact', 'Contact') : m.type === 'group' ? t('Groupe', 'Group') : ''}
                        </td>
                        {manage && (
                          <td className="num">
                            <button className="btn btn-ghost btn-icon btn-sm" title={t('Retirer', 'Remove')} onClick={() => setDel(m)}>
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            !members.loading && <p className="faint">{t('Ce groupe n’a aucun membre.', 'This group has no members.')}</p>
          )}
        </>
      )}

      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        title={t('Retirer ce membre ?', 'Remove this member?')}
        footer={
          <>
            <button className="btn" onClick={() => setDel(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-danger" onClick={remove} disabled={busy}>
              {t('Retirer', 'Remove')}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {del?.displayName} &lt;{del?.email}&gt; {t('ne recevra plus les courriels envoyés à', 'will no longer receive e-mail sent to')} {group.email}.
        </p>
      </Modal>
    </div>
  );
}
