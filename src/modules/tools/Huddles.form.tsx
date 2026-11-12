import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { API_MODE, uid, useCollection } from '@/data/db';
import { users } from '@/data/stores';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import { Avatar } from '@/modules/admin/pages/Users';
import { huddleEntries, huddleItems, huddles, tasks, teams } from './stores';
import {
  DAY_OPTIONS,
  dayLabel,
  isWebUrl,
  personalLabels,
  teamLabels,
  toPayload,
  type HuddleDraft,
  type SectionItem,
} from './Huddles.helpers';

interface Props {
  draft: HuddleDraft | null;
  setDraft: Dispatch<SetStateAction<HuddleDraft | null>>;
  err: string;
  setErr: (msg: string) => void;
}

/** Create / edit dialog of a huddle: basics, members, ordered sections. */
export function HuddleModal({ draft, setDraft, err, setErr }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const { rows: userRows } = useCollection(users);
  const { rows: teamRows } = useCollection(teams);
  const [memberQ, setMemberQ] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => setDraft(null);
  const set = (patch: Partial<HuddleDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const activeUsers = useMemo(
    () => userRows.filter((u) => u.active).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [userRows],
  );
  const activeIds = useMemo(() => new Set(activeUsers.map((u) => u.id)), [activeUsers]);

  if (!draft) return null;

  // Keep the current owner / team in the lists even when they are inactive / archived.
  const ownerOptions = userRows
    .filter((u) => u.active || u.id === draft.ownerId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const teamOptions = teamRows
    .filter((tm) => !tm.archived || tm.id === draft.teamId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const selectedTeam = teamRows.find((tm) => tm.id === draft.teamId);
  const videoError = draft.videoUrl.trim() !== '' && !isWebUrl(draft.videoUrl.trim());

  const teamTitles = teamLabels(t);
  const personalTitles = personalLabels(t);

  // Members: only active users are shown; inactive members already on the huddle are kept as they are.
  const shownUsers = activeUsers.filter((u) => {
    const s = memberQ.trim().toLowerCase();
    return !s || u.displayName.toLowerCase().includes(s) || u.username.toLowerCase().includes(s);
  });
  const addMembers = (ids: string[]) =>
    set({ memberIds: [...new Set([...draft.memberIds, ...ids.filter((id) => activeIds.has(id))])] });
  const toggleMember = (id: string) =>
    set({ memberIds: draft.memberIds.includes(id) ? draft.memberIds.filter((x) => x !== id) : [...draft.memberIds, id] });

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return setErr(t('Le nom est requis.', 'Name is required.'));
    const videoUrl = draft.videoUrl.trim();
    if (videoUrl && !isWebUrl(videoUrl)) return setErr(t('Le lien vidéo doit commencer par http:// ou https://.', 'The video link must start with http:// or https://.'));
    if (draft.startTime && draft.endTime && draft.endTime <= draft.startTime)
      return setErr(t('L’heure de fin doit être après l’heure de début.', 'The end time must be after the start time.'));

    const payload = toPayload({ ...draft, name, videoUrl, description: draft.description.trim() });
    setBusy(true);
    try {
      if (draft.id) await huddles.update(draft.id, payload);
      else await huddles.insert({ id: uid('h_'), ...payload });
      setDraft(null);
      toast(t('Huddle enregistré', 'Huddle saved'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /** Deletes the huddle and its history: agenda/parking/issue items, check-ins and linked tasks. */
  const remove = async () => {
    const id = draft.id;
    if (!id) return;
    const msg = t(
      `Supprimer le huddle « ${draft.name} » ? Son historique (points de l’ordre du jour, stationnement, enjeux, bilans des membres et tâches liées) sera aussi supprimé. Cette action est irréversible.`,
      `Delete the huddle “${draft.name}”? Its history (agenda, parking lot and issue items, member check-ins and linked tasks) will be deleted too. This cannot be undone.`,
    );
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      // On the server the history is removed with the huddle (and only the owner may delete it); the browser-only demo backend cleans up here.
      if (!API_MODE) {
        const [items, entries, linkedTasks] = await Promise.all([huddleItems.list(), huddleEntries.list(), tasks.list()]);
        for (const x of items.filter((i) => i.huddleId === id)) await huddleItems.remove(x.id);
        for (const x of entries.filter((e) => e.huddleId === id)) await huddleEntries.remove(x.id);
        for (const x of linkedTasks.filter((k) => k.huddleId === id)) await tasks.remove(x.id);
      }
      await huddles.remove(id);
      setDraft(null);
      toast(t('Huddle supprimé', 'Huddle deleted'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={close}
      title={t('Paramètres du huddle', 'Huddle settings')}
      footer={
        <>
          {draft.id && (
            <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove} disabled={busy}>
              <Trash2 size={15} /> {t('Supprimer', 'Delete')}
            </button>
          )}
          <button className="btn" onClick={close}>
            {t('Annuler', 'Cancel')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {t('Enregistrer', 'Save')}
          </button>
        </>
      }
    >
      <div className="stack">
        {err && <div className="alert alert-err">{err}</div>}

        <h4 style={sectionTitle}>{t('Général', 'Basics')}</h4>
        <div className="form-grid">
          <label className="field">
            <span>{t('Nom', 'Name')} *</span>
            <input className="input" value={draft.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} autoFocus />
          </label>
          <label className="field">
            <span>{t('Équipe', 'Team')}</span>
            <select className="select" value={draft.teamId ?? ''} onChange={(e) => set({ teamId: e.target.value || null })}>
              <option value="">{t('Aucune équipe', 'No team')}</option>
              {teamOptions.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                  {tm.archived ? ` (${t('archivée', 'archived')})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('Responsable', 'Owner')}</span>
            <select className="select" value={draft.ownerId ?? ''} onChange={(e) => set({ ownerId: e.target.value || null })}>
              <option value="">{t('Aucun', 'None')}</option>
              {ownerOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                  {!u.active ? ` (${t('inactif', 'inactive')})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('Fréquence', 'Cadence')}</span>
            <select className="select" value={draft.cadence} onChange={(e) => set({ cadence: e.target.value as HuddleDraft['cadence'] })}>
              <option value="daily">{t('Quotidien (jours ouvrables)', 'Daily (weekdays)')}</option>
              <option value="weekly">{t('Hebdomadaire', 'Weekly')}</option>
              <option value="monthly">{t('Mensuel', 'Monthly')}</option>
            </select>
          </label>
          <label className="field">
            <span>{t('Jour', 'Day')}</span>
            <select className="select" value={draft.dayOfWeek} disabled={draft.cadence === 'daily'} onChange={(e) => set({ dayOfWeek: Number(e.target.value) })}>
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {dayLabel(d, t)}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="field">
              <span>{t('Début', 'Start')}</span>
              <input className="input" type="time" value={draft.startTime} onChange={(e) => set({ startTime: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('Fin', 'End')}</span>
              <input className="input" type="time" value={draft.endTime} onChange={(e) => set({ endTime: e.target.value })} />
            </label>
          </div>
          <label className="field span-2">
            <span>{t('Lien vidéo', 'Video link')}</span>
            <input className="input" type="url" placeholder="https://" value={draft.videoUrl} maxLength={300} onChange={(e) => set({ videoUrl: e.target.value })} />
            {videoError && (
              <span className="small" style={{ color: 'var(--err)' }}>
                {t('Le lien doit commencer par http:// ou https://, ou rester vide.', 'The link must start with http:// or https://, or be left empty.')}
              </span>
            )}
          </label>
          <label className="field span-2">
            <span>{t('But, préparation et ordre du jour', 'Purpose, preparation and agenda')}</span>
            <textarea className="textarea" rows={6} value={draft.description} maxLength={8000} onChange={(e) => set({ description: e.target.value })} />
          </label>
        </div>

        <h4 style={sectionTitle}>{t('Membres', 'Members')}</h4>
        <div className="row row-wrap" style={{ gap: 6 }}>
          <input className="input" style={{ flex: '1 1 180px' }} placeholder={t('Rechercher…', 'Search…')} value={memberQ} onChange={(e) => setMemberQ(e.target.value)} />
          <button type="button" className="btn btn-sm" onClick={() => addMembers(activeUsers.map((u) => u.id))}>
            {t('Tout sélectionner', 'Select all')}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => set({ memberIds: draft.memberIds.filter((id) => !activeIds.has(id)) })}>
            {t('Aucun', 'None')}
          </button>
          {selectedTeam && (
            <button type="button" className="btn btn-sm" onClick={() => addMembers(selectedTeam.memberIds)}>
              {t('Ajouter les membres de l’équipe', 'Add team members')}
            </button>
          )}
        </div>
        <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 6 }}>
          {shownUsers.length === 0 && <div className="faint small" style={{ padding: 8 }}>{t('Aucun utilisateur trouvé.', 'No user found.')}</div>}
          {shownUsers.map((u) => (
            <MemberRow key={u.id} user={u} checked={draft.memberIds.includes(u.id)} onToggle={() => toggleMember(u.id)} />
          ))}
        </div>

        <h4 style={sectionTitle}>{t('Sections d’équipe', 'Team sections')}</h4>
        <p className="faint small" style={{ margin: 0 }}>
          {t('Cochez les sections utilisées et ordonnez-les avec les flèches.', 'Tick the sections the huddle uses and order them with the arrows.')}
        </p>
        <SectionOrder items={draft.teamSections} labels={teamTitles} onChange={(teamSections) => set({ teamSections })} />

        <h4 style={sectionTitle}>{t('Sections personnelles', 'Personal sections')}</h4>
        <p className="faint small" style={{ margin: 0 }}>
          {t('Une carte par membre, dans cet ordre.', 'One card per member, in this order.')}
        </p>
        <SectionOrder items={draft.personalSections} labels={personalTitles} onChange={(personalSections) => set({ personalSections })} />

        <label className="check">
          <input type="checkbox" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} />
          {t('Huddle actif', 'Active huddle')}
        </label>
      </div>
    </Modal>
  );
}

const sectionTitle = { margin: '8px 0 0', fontSize: 14, fontWeight: 600 } as const;

function MemberRow({ user, checked, onToggle }: { user: User; checked: boolean; onToggle: () => void }) {
  return (
    <label className="check" style={{ padding: '4px 6px' }}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <Avatar name={user.displayName} size={24} />
      <span>{user.displayName}</span>
    </label>
  );
}

/** Ordered list of sections: enable/disable and move up or down. */
function SectionOrder<K extends string>({
  items,
  labels,
  onChange,
}: {
  items: SectionItem<K>[];
  labels: Record<K, string>;
  onChange: (items: SectionItem<K>[]) => void;
}) {
  const { t } = useI18n();
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const toggle = (i: number) => onChange(items.map((it, k) => (k === i ? { ...it, on: !it.on } : it)));

  return (
    <div className="stack" style={{ gap: 4 }}>
      {items.map((it, i) => (
        <div
          key={it.key}
          className="row"
          style={{ justifyContent: 'space-between', padding: '2px 6px', opacity: it.on ? 1 : 0.6, minWidth: 0 }}
        >
          <label className="check" style={{ minWidth: 0 }}>
            <input type="checkbox" checked={it.on} onChange={() => toggle(i)} />
            <span>{labels[it.key]}</span>
          </label>
          <div className="row" style={{ gap: 2, flexShrink: 0 }}>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t('Monter', 'Move up')} disabled={i === 0} onClick={() => move(i, -1)}>
              <ChevronUp size={15} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={t('Descendre', 'Move down')}
              disabled={i === items.length - 1}
              onClick={() => move(i, 1)}
            >
              <ChevronDown size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
