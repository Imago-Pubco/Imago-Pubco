import { useMemo, useState } from 'react';
import { Save, Search, ShieldPlus, UserCog } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { effectivePermissions } from '@/auth/permissions';
import { useCollection } from '@/data/db';
import { groups, logAudit, users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Empty, useToast } from '@/components/ui';
import type { User } from '@/data/types';
import { PermissionMatrix } from '../PermissionMatrix';

/**
 * Individual rights: permissions given to one person directly, on top of their groups.
 * For the exception ("Marie also needs to approve purchase orders") without creating a group for one person.
 */
export function UserRights() {
  const { t } = useI18n();
  const { user: me, can } = useAuth();
  const toast = useToast();
  const { rows } = useCollection(users);
  const { rows: allGroups } = useCollection(groups);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((u) => !s || [u.displayName, u.username, u.email].some((v) => (v ?? '').toLowerCase().includes(s)))
      .sort((a, b) => (b.permissions?.length ?? 0) - (a.permissions?.length ?? 0) || a.displayName.localeCompare(b.displayName));
  }, [rows, q]);

  const selected = rows.find((u) => u.id === selectedId);
  const current = new Set(selected?.permissions ?? []);
  const perms = draft ?? current;
  const dirty = !!draft && [...draft].sort().join() !== [...current].sort().join();
  // What the person already gets from their groups: locked in the editor.
  const fromGroups = selected ? effectivePermissions({ groupIds: selected.groupIds } as User, allGroups) : new Set<string>();
  const groupNames = selected ? allGroups.filter((g) => selected.groupIds.includes(g.id)) : [];
  const withDirect = rows.filter((u) => u.permissions?.length).length;

  const pick = (u: User) => {
    setSelectedId(u.id);
    setDraft(null);
  };

  const save = async () => {
    if (!selected || !draft) return;
    setBusy(true);
    try {
      // Only what the groups do not already give is stored.
      await users.update(selected.id, { permissions: [...draft].sort() });
      await logAudit(me!.id, 'admin.user.rights', `${selected.username}: ${[...draft].sort().join(', ') || '(none)'}`);
      setDraft(null);
      toast(t('Droits individuels enregistrés', 'Individual rights saved'));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  if (!can('admin.groups.manage')) return null;

  return (
    <div className="groups-layout">
      <div className="card groups-list">
        <div style={{ padding: 10, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 20, top: 21, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder={t('Rechercher un utilisateur…', 'Search a user…')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {list.map((u) => (
          <button key={u.id} className={`group-item ${selectedId === u.id ? 'active' : ''}`} onClick={() => pick(u)}>
            <span className="group-swatch" style={{ background: u.permissions?.length ? 'var(--accent)' : 'var(--border)' }} />
            <div style={{ minWidth: 0 }}>
              <strong>{u.displayName}</strong>
              <div className="faint small">
                {u.permissions?.length ? t(`${u.permissions.length} droit(s) individuel(s)`, `${u.permissions.length} individual right(s)`) : t('Aucun droit individuel', 'No individual rights')}
              </div>
            </div>
          </button>
        ))}
        <div className="faint small" style={{ padding: 12 }}>
          {t(`${withDirect} utilisateur(s) avec des droits individuels`, `${withDirect} user(s) with individual rights`)}
        </div>
      </div>

      {selected ? (
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3 className="row">
                <UserCog size={16} /> {selected.displayName}
              </h3>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={!dirty || busy}>
                <Save size={14} /> {t('Enregistrer', 'Save')}
              </button>
            </div>
            <div className="card-pad stack" style={{ gap: 10 }}>
              <p className="muted small" style={{ margin: 0 }}>
                {t(
                  'Ces droits s’ajoutent à ceux des groupes de la personne. Cochez seulement l’exception : ce que ses groupes lui donnent déjà est affiché verrouillé.',
                  'These rights are added to those of the person’s groups. Tick only the exception: what their groups already give is shown locked.',
                )}
              </p>
              <div className="row row-wrap" style={{ gap: 6 }}>
                <span className="faint small">{t('Groupes :', 'Groups:')}</span>
                {groupNames.length ? (
                  groupNames.map((g) => (
                    <span key={g.id} className="badge" style={{ background: `color-mix(in srgb, ${g.color ?? '#888'} 16%, transparent)`, color: g.color }}>
                      {g.name}
                    </span>
                  ))
                ) : (
                  <span className="faint small">{t('aucun', 'none')}</span>
                )}
              </div>
              {fromGroups.has('*') && <div className="alert">{t('Cette personne est super administrateur via un groupe : elle a déjà tous les droits.', 'This person is a super administrator through a group: they already have every right.')}</div>}
              {dirty && <div className="faint small">{t('Modifications non enregistrées', 'Unsaved changes')}</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3 className="row">
                <ShieldPlus size={16} /> {t('Droits individuels', 'Individual rights')}
              </h3>
            </div>
            <PermissionMatrix perms={perms} onChange={setDraft} inherited={fromGroups} disabled={fromGroups.has('*')} />
          </div>
        </div>
      ) : (
        <div className="card">
          <Empty icon={<UserCog size={36} />} title={t('Choisissez un utilisateur', 'Choose a user')}>
            {t('Pour lui donner des droits précis sans le mettre dans un groupe.', 'To give them specific rights without putting them in a group.')}
          </Empty>
        </div>
      )}
    </div>
  );
}
