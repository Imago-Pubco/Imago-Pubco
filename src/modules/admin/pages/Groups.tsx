import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, ShieldCheck, Users as UsersIcon, Lock } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { groups, logAudit, users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader, useToast } from '@/components/ui';
import { modules } from '@/modules/registry';
import type { Group } from '@/data/types';

const COLORS = ['#da291c', '#e07a10', '#1e6fd9', '#7b4fd6', '#1f8a4c', '#0f8b8d', '#c2185b', '#5b6b82'];

export function Groups() {
  const { t } = useI18n();
  const { user: me } = useAuth();
  const toast = useToast();
  const { rows } = useCollection(groups);
  const { rows: allUsers } = useCollection(users);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Group | null>(null);

  const selected = rows.find((g) => g.id === selectedId) ?? rows[0];
  useEffect(() => {
    if (selected && (!draft || draft.id !== selected.id)) setDraft(structuredClone(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const isNewDraft = draft && !rows.some((g) => g.id === draft.id);
  const members = draft ? allUsers.filter((u) => u.groupIds.includes(draft.id)) : [];
  const perms = new Set(draft?.permissions ?? []);
  const superAdmin = perms.has('*');

  const setPerms = (next: Set<string>) => draft && setDraft({ ...draft, permissions: [...next].sort() });
  const toggle = (key: string) => {
    const n = new Set(perms);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    setPerms(n);
  };
  const toggleModule = (modId: string, keys: string[]) => {
    const n = new Set(perms);
    const wild = `${modId}.*`;
    if (n.has(wild)) n.delete(wild);
    else {
      keys.forEach((k) => n.delete(k));
      n.add(wild);
    }
    setPerms(n);
  };

  const save = async () => {
    if (!draft || !draft.name.trim()) return;
    if (isNewDraft) await groups.insert(draft);
    else await groups.update(draft.id, draft);
    await logAudit(me!.id, 'admin.group.save', `${draft.name}: ${draft.permissions.join(', ')}`);
    setSelectedId(draft.id);
    toast(t('Groupe enregistré', 'Group saved'));
  };

  const remove = async () => {
    if (!draft || draft.system) return;
    for (const u of members) await users.update(u.id, { groupIds: u.groupIds.filter((g) => g !== draft.id) });
    await groups.remove(draft.id);
    await logAudit(me!.id, 'admin.group.delete', draft.name);
    setSelectedId(null);
    setDraft(null);
    toast(t('Groupe supprimé', 'Group deleted'));
  };

  const create = () => {
    const g: Group = { id: uid('g_'), name: t('Nouveau groupe', 'New group'), description: '', permissions: [], color: COLORS[rows.length % COLORS.length] };
    setDraft(g);
    setSelectedId(null);
  };

  return (
    <Page wide>
      <PageHeader
        eyebrow={t('Administration', 'Administration')}
        title={t('Groupes d’accès', 'Access groups')}
        subtitle={t(
          'Chaque groupe accorde des permissions granulaires par module. Un utilisateur cumule les permissions de tous ses groupes.',
          'Each group grants granular per-module permissions. A user gets the union of all their groups.',
        )}
        actions={
          <button className="btn btn-primary" onClick={create}>
            <Plus size={16} /> {t('Groupe', 'Group')}
          </button>
        }
      />
      <div className="groups-layout">
        <div className="card groups-list">
          {rows.map((g) => (
            <button key={g.id} className={`group-item ${draft?.id === g.id ? 'active' : ''}`} onClick={() => { setSelectedId(g.id); setDraft(structuredClone(g)); }}>
              <span className="group-swatch" style={{ background: g.color }} />
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 6 }}>
                  <strong>{g.name}</strong>
                  {g.system && <Lock size={12} className="faint" />}
                </div>
                <div className="faint small">
                  {allUsers.filter((u) => u.groupIds.includes(g.id)).length} {t('membre(s)', 'member(s)')} ·{' '}
                  {g.permissions.includes('*') ? t('tout', 'all') : `${g.permissions.length} perm.`}
                </div>
              </div>
            </button>
          ))}
          {isNewDraft && (
            <button className="group-item active">
              <span className="group-swatch" style={{ background: draft!.color }} />
              <strong>{draft!.name}</strong>
            </button>
          )}
        </div>

        {draft && (
          <div className="stack">
            <div className="card">
              <div className="card-head">
                <h3>{t('Détails du groupe', 'Group details')}</h3>
                <div className="row">
                  {!draft.system && !isNewDraft && (
                    <button className="btn btn-danger btn-sm" onClick={remove}>
                      <Trash2 size={14} /> {t('Supprimer', 'Delete')}
                    </button>
                  )}
                  <button className="btn btn-primary btn-sm" onClick={save}>
                    <Save size={14} /> {t('Enregistrer', 'Save')}
                  </button>
                </div>
              </div>
              <div className="card-pad form-grid">
                <label className="field">
                  <span>{t('Nom', 'Name')}</span>
                  <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </label>
                <label className="field span-2">
                  <span>Description</span>
                  <input className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </label>
                <div className="field">
                  <span>{t('Couleur', 'Colour')}</span>
                  <div className="row" style={{ gap: 6, height: 38 }}>
                    {COLORS.map((c) => (
                      <button key={c} className={`color-dot ${draft.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setDraft({ ...draft, color: c })} aria-label={c} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>{t('Permissions', 'Permissions')}</h3>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={superAdmin}
                    disabled={draft.system}
                    onChange={() => setPerms(superAdmin ? new Set() : new Set(['*']))}
                  />
                  <ShieldCheck size={16} /> {t('Super administrateur (tout)', 'Super administrator (everything)')}
                </label>
              </div>
              <div className={`perm-matrix ${superAdmin ? 'disabled' : ''}`}>
                {modules.map((m) => {
                  const wild = perms.has(`${m.id}.*`);
                  const Icon = m.icon;
                  return (
                    <div key={m.id} className="perm-module" style={{ ['--accent' as string]: m.accent }}>
                      <div className="perm-module-head">
                        <span className="perm-module-icon">
                          <Icon size={16} />
                        </span>
                        <strong>{t(m.name)}</strong>
                        <span className="spacer" />
                        <label className="check small">
                          <input type="checkbox" checked={superAdmin || wild} disabled={superAdmin} onChange={() => toggleModule(m.id, m.permissions.map((p) => p.key))} />
                          {t('Tout le module', 'Entire module')}
                        </label>
                      </div>
                      <div className="perm-list">
                        {m.permissions.map((p) => (
                          <label key={p.key} className="check perm-item">
                            <input type="checkbox" checked={superAdmin || wild || perms.has(p.key)} disabled={superAdmin || wild} onChange={() => toggle(p.key)} />
                            <div>
                              <div>{t(p.label)}</div>
                              <div className="mono faint" style={{ fontSize: 11 }}>
                                {p.key}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3 className="row">
                  <UsersIcon size={16} /> {t('Membres', 'Members')} ({members.length})
                </h3>
              </div>
              <div className="card-pad row row-wrap">
                {members.length ? (
                  members.map((u) => (
                    <span key={u.id} className="badge">
                      {u.displayName}
                    </span>
                  ))
                ) : (
                  <span className="faint small">{t('Assignez des membres depuis la page Utilisateurs.', 'Assign members from the Users page.')}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
