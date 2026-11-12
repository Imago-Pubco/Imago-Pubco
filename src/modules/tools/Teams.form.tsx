import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { uid, useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import type { Team } from './schemas';
import { huddles, kpis, priorities, teams } from './stores';

export const TEAM_COLORS = ['#1e6fd9', '#7b4fd6', '#d6336c', '#2e9e5b', '#e07a10', '#0ea5c6', '#da291c', '#5b6b82'];

/** A new team, ready for the form. */
export function blankTeam(ownerId: string, color: string): Team {
  return { id: uid('tm_'), name: '', description: '', color, ownerId, memberIds: [], archived: false };
}

/** Schema fields only: the server refuses unknown keys and stamps the audit fields itself. */
function teamFields(t: Team) {
  return {
    name: t.name.trim(),
    description: t.description.trim(),
    color: t.color,
    ownerId: t.ownerId,
    memberIds: t.memberIds,
    archived: t.archived,
  };
}

/** Removes the team from its KPIs, priorities and huddles (they stay, without a team). */
async function detachTeam(teamId: string) {
  const [k, p, h] = await Promise.all([kpis.list(), priorities.list(), huddles.list()]);
  for (const x of k.filter((r) => r.teamId === teamId)) await kpis.update(x.id, { teamId: null });
  for (const x of p.filter((r) => r.teamId === teamId)) await priorities.update(x.id, { teamId: null });
  for (const x of h.filter((r) => r.teamId === teamId)) await huddles.update(x.id, { teamId: null });
}

export function TeamModal({ team, existing, onClose }: { team: Team; existing: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<Team>(team);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!draft.name.trim() || !draft.ownerId) return;
    setBusy(true);
    try {
      if (existing) await teams.update(draft.id, teamFields(draft));
      else await teams.insert({ id: draft.id, ...teamFields(draft) });
      toast(t('Équipe enregistrée', 'Team saved'));
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = window.confirm(
      t(
        `Supprimer l’équipe « ${draft.name} » ? Ses KPI, priorités et huddles restent, mais ne seront plus rattachés à une équipe.`,
        `Delete the team "${draft.name}"? Its KPIs, priorities and huddles stay, but are no longer attached to a team.`,
      ),
    );
    if (!ok) return;
    setBusy(true);
    try {
      await detachTeam(draft.id);
      await teams.remove(draft.id);
      toast(t('Équipe supprimée', 'Team deleted'));
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? t('Modifier l’équipe', 'Edit team') : t('Nouvelle équipe', 'New team')}
      footer={
        <>
          {existing && (
            <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove} disabled={busy}>
              <Trash2 size={15} /> {t('Supprimer', 'Delete')}
            </button>
          )}
          <button className="btn" onClick={onClose}>{t('Annuler', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !draft.name.trim() || !draft.ownerId}>
            {t('Enregistrer', 'Save')}
          </button>
        </>
      }
    >
      <TeamFields value={draft} onChange={setDraft} />
    </Modal>
  );
}

function TeamFields({ value, onChange }: { value: Team; onChange: (t: Team) => void }) {
  const { t } = useI18n();
  const { rows: allUsers } = useCollection(users);
  const [q, setQ] = useState('');
  const byName = (a: { displayName: string }, b: { displayName: string }) => a.displayName.localeCompare(b.displayName);
  const owners = allUsers.filter((u) => u.active || u.id === value.ownerId).sort(byName);
  // Active people, plus inactive members so that nothing selected is hidden.
  const people = allUsers.filter((u) => u.active || value.memberIds.includes(u.id)).sort(byName);
  const s = q.trim().toLowerCase();
  const shown = people.filter((u) => !s || [u.displayName, u.username].some((v) => v.toLowerCase().includes(s)));

  const toggleMember = (id: string) =>
    onChange({
      ...value,
      memberIds: value.memberIds.includes(id) ? value.memberIds.filter((x) => x !== id) : [...value.memberIds, id],
    });
  const selectShown = () => onChange({ ...value, memberIds: [...new Set([...value.memberIds, ...shown.map((u) => u.id)])] });

  return (
    <div className="stack">
      <div className="form-grid">
        <label className="field span-2">
          <span>{t('Nom', 'Name')}</span>
          <input className="input" value={value.name} maxLength={80} autoFocus onChange={(e) => onChange({ ...value, name: e.target.value })} />
        </label>
        <label className="field span-2">
          <span>Description</span>
          <textarea className="textarea" value={value.description} maxLength={500} onChange={(e) => onChange({ ...value, description: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('Responsable', 'Owner')}</span>
          <select className="select" value={value.ownerId} onChange={(e) => onChange({ ...value, ownerId: e.target.value })}>
            {owners.map((u) => (
              <option key={u.id} value={u.id}>{u.displayName}</option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>{t('Couleur', 'Colour')}</span>
          <div className="row row-wrap" style={{ gap: 8, minHeight: 38 }}>
            {TEAM_COLORS.map((c) => {
              const on = value.color === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={on}
                  onClick={() => onChange({ ...value, color: c })}
                  style={{
                    width: 28,
                    height: 28,
                    padding: 0,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    background: c,
                    border: on ? '3px solid var(--bg-elev)' : '1px solid var(--border)',
                    boxShadow: on ? `0 0 0 2px ${c}` : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <div className="row row-wrap" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="label">
            {t('Membres', 'Members')} <span className="faint">({value.memberIds.length})</span>
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn-sm" onClick={selectShown}>{t('Tout sélectionner', 'Select all')}</button>
            <button type="button" className="btn btn-sm" onClick={() => onChange({ ...value, memberIds: [] })}>{t('Aucun', 'None')}</button>
          </div>
        </div>
        <input className="input" style={{ marginBottom: 8 }} placeholder={t('Rechercher…', 'Search…')} value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
          {shown.map((u) => (
            <label key={u.id} className="check" style={{ display: 'flex', padding: '8px 12px', borderBottom: '1px solid var(--border)', opacity: u.active ? 1 : 0.6 }}>
              <input type="checkbox" checked={value.memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} />
              <span>{u.displayName}</span>
              {!u.active && <span className="faint small">({t('inactif', 'inactive')})</span>}
            </label>
          ))}
          {!shown.length && <p className="faint small" style={{ padding: 12, margin: 0 }}>{t('Aucun résultat.', 'No result.')}</p>}
        </div>
      </div>

      <label className="check">
        <input type="checkbox" checked={value.archived} onChange={(e) => onChange({ ...value, archived: e.target.checked })} />
        {t('Archivée', 'Archived')}
      </label>
    </div>
  );
}
