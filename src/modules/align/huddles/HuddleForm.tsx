import { useMemo, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid } from '@/data/db';
import { logAudit } from '@/data/stores';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import { alignHuddles } from '../stores';
import type { AlignHuddle, Cadence } from '../schemas';
import { errorText } from '../components/RockShared';
import { CADENCE_LABEL, TIME_RE, VIDEO_RE, WEEKDAY_LABEL } from './huddleLib';

type Form = {
  name: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  cadence: Cadence;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  videoUrl: string;
  active: boolean;
};
type Errors = Partial<Record<keyof Form, string>>;

const errStyle = { color: 'var(--err)', fontSize: 12 } as const;

/**
 * Create or edit a huddle (also used by the meeting page's "Paramètres"). Mount it only while it is needed:
 * the form state is read from `huddle` when it mounts.
 */
export function HuddleForm({ huddle, people, onClose }: { huddle: AlignHuddle | null; people: User[]; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { user, can } = useAuth();
  // Only huddle managers may hand a huddle over to someone else (the server refuses it otherwise).
  const canReassign = can('align.huddles.manage');
  const toast = useToast();
  const [v, setV] = useState<Form>(() =>
    huddle
      ? {
          name: huddle.name,
          description: huddle.description,
          ownerId: huddle.ownerId ?? user!.id,
          memberIds: huddle.memberIds,
          cadence: huddle.cadence,
          dayOfWeek: huddle.dayOfWeek,
          startTime: huddle.startTime,
          endTime: huddle.endTime,
          videoUrl: huddle.videoUrl,
          active: huddle.active,
        }
      : {
          name: '',
          description: '',
          ownerId: user!.id,
          memberIds: [],
          cadence: 'weekly',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '09:30',
          videoUrl: '',
          active: true,
        },
  );
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  const set = <K extends keyof Form>(k: K, val: Form[K]) => setV((s) => ({ ...s, [k]: val }));

  // Owner choices are the active users; keep the current owner visible even when inactive.
  const ownerOptions = useMemo(() => {
    const list = [...people];
    if (v.ownerId && !list.some((p) => p.id === v.ownerId)) list.push({ id: v.ownerId, displayName: v.ownerId } as User);
    return list;
  }, [people, v.ownerId]);

  const term = memberSearch.trim().toLowerCase();
  const memberChoices = people.filter((p) => !term || p.displayName.toLowerCase().includes(term));

  const toggleMember = (id: string) =>
    set('memberIds', v.memberIds.includes(id) ? v.memberIds.filter((m) => m !== id) : [...v.memberIds, id]);

  function validate(): Errors {
    const e: Errors = {};
    if (!v.name.trim()) e.name = t('Le nom est requis.', 'Name is required.');
    if (!TIME_RE.test(v.startTime)) e.startTime = t('Format HH:MM.', 'Use HH:MM.');
    if (!TIME_RE.test(v.endTime)) e.endTime = t('Format HH:MM.', 'Use HH:MM.');
    if (!e.startTime && !e.endTime && v.endTime <= v.startTime)
      e.endTime = t('L’heure de fin doit être après le début.', 'End time must be after start time.');
    const url = v.videoUrl.trim();
    if (url && !VIDEO_RE.test(url)) e.videoUrl = t('Le lien doit commencer par http:// ou https://', 'The link must start with http:// or https://');
    return e;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const payload = {
      name: v.name.trim(),
      description: v.description.trim(),
      ownerId: v.ownerId || null,
      memberIds: v.memberIds,
      cadence: v.cadence,
      dayOfWeek: v.dayOfWeek,
      startTime: v.startTime,
      endTime: v.endTime,
      videoUrl: v.videoUrl.trim(),
      active: v.active,
    };
    try {
      if (huddle) {
        await alignHuddles.update(huddle.id, payload);
        logAudit(user!.id, 'align.huddle.update', payload.name).catch(() => undefined);
      } else {
        await alignHuddles.insert({ id: uid('hud_'), ...payload, sourceId: null });
        logAudit(user!.id, 'align.huddle.create', payload.name).catch(() => undefined);
      }
      toast(t('Huddle enregistré', 'Huddle saved'));
      onClose();
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={huddle ? t('Paramètres du huddle', 'Huddle settings') : t('Nouveau huddle', 'New huddle')}
      large
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('Annuler', 'Cancel')}
          </button>
          <button type="submit" form="align-huddle-form" className="btn btn-primary" disabled={busy}>
            {t('Enregistrer', 'Save')}
          </button>
        </>
      }
    >
      <form id="align-huddle-form" className="stack" onSubmit={submit} noValidate>
        <label className="field">
          <span>{t('Nom *', 'Name *')}</span>
          <input className="input" maxLength={120} value={v.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} />
          {errors.name && <small style={errStyle}>{errors.name}</small>}
        </label>

        <label className="field">
          <span>{t('Objectif et ordre du jour', 'Purpose and agenda')}</span>
          <textarea className="input" rows={3} maxLength={4000} value={v.description} onChange={(e) => set('description', e.target.value)} />
        </label>

        <div className="form-grid">
          <label className="field">
            <span>{t('Responsable', 'Owner')}</span>
            <select className="select" value={v.ownerId} onChange={(e) => set('ownerId', e.target.value)} disabled={!canReassign && !!huddle}>
              {ownerOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="check" style={{ alignSelf: 'end' }}>
            <input type="checkbox" checked={v.active} onChange={(e) => set('active', e.target.checked)} />
            {t('Actif', 'Active')}
          </label>
        </div>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <span>
            {t('Membres', 'Members')} <span className="muted small">({v.memberIds.length})</span>
          </span>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-3)' }} />
            <input
              className="input"
              style={{ paddingLeft: 30 }}
              placeholder={t('Rechercher une personne…', 'Search a person…')}
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              aria-label={t('Rechercher un membre', 'Search a member')}
            />
          </div>
          <div className="align-check-list">
            {memberChoices.length === 0 && <div className="muted small">{t('Aucune personne trouvée.', 'No one found.')}</div>}
            {memberChoices.map((p) => (
              <label key={p.id} className="check">
                <input type="checkbox" checked={v.memberIds.includes(p.id)} onChange={() => toggleMember(p.id)} />
                {p.displayName}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-grid">
          <label className="field">
            <span>{t('Fréquence', 'Cadence')}</span>
            <select className="select" value={v.cadence} onChange={(e) => set('cadence', e.target.value as Cadence)}>
              {(Object.keys(CADENCE_LABEL) as Cadence[]).map((c) => (
                <option key={c} value={c}>
                  {CADENCE_LABEL[c][lang]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('Jour', 'Day')}</span>
            <select className="select" value={v.dayOfWeek} onChange={(e) => set('dayOfWeek', Number(e.target.value))}>
              {WEEKDAY_LABEL.map((d, i) => (
                <option key={i} value={i}>
                  {d[lang]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('Début', 'Start')}</span>
            <input type="time" className="input" value={v.startTime} onChange={(e) => set('startTime', e.target.value)} aria-invalid={!!errors.startTime} />
            {errors.startTime && <small style={errStyle}>{errors.startTime}</small>}
          </label>
          <label className="field">
            <span>{t('Fin', 'End')}</span>
            <input type="time" className="input" value={v.endTime} onChange={(e) => set('endTime', e.target.value)} aria-invalid={!!errors.endTime} />
            {errors.endTime && <small style={errStyle}>{errors.endTime}</small>}
          </label>
        </div>

        <label className="field">
          <span>{t('Lien de visioconférence', 'Video link')}</span>
          <input className="input" type="url" placeholder="https://…" value={v.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} aria-invalid={!!errors.videoUrl} />
          {errors.videoUrl && <small style={errStyle}>{errors.videoUrl}</small>}
        </label>
      </form>
    </Modal>
  );
}
