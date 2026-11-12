import { useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import { clients, projects } from './stores';
import { BILLING_TYPES, PROJECT_STATUS, type Project } from './schemas';
import { BILLING_LABEL, STATUS_LABEL, nextProjectCode } from './Projects.shared';

/** Colour swatches for a project (stored as a hex string). */
export const PROJECT_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0891b2', '#db2777', '#64748b'];

type ProjectFields = Omit<Project, 'id' | 'createdBy' | 'createdAt' | 'updatedBy' | 'updatedAt'>;

/** Form state: numbers are kept as text until saved. `code` null = use the suggested next code. */
interface Draft {
  code: string | null;
  name: string;
  clientId: string;
  managerId: string;
  status: Project['status'];
  billing: Project['billing'];
  budgetHours: string;
  budgetAmount: string;
  alertPct: string;
  startDate: string;
  endDate: string;
  description: string;
  color: string;
  memberIds: string[];
  closedToTime: boolean;
}

/** Empty text = null (no budget); undefined = invalid. */
function parseOptional(text: string, max: number): number | null | undefined {
  const s = text.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : undefined;
}

function draftOf(p: Project | undefined, me: string | undefined): Draft {
  if (!p) {
    return {
      code: null,
      name: '',
      clientId: '',
      managerId: me ?? '',
      status: 'planning',
      billing: 'hourly',
      budgetHours: '',
      budgetAmount: '',
      alertPct: '80',
      startDate: '',
      endDate: '',
      description: '',
      color: PROJECT_COLORS[0],
      memberIds: [],
      closedToTime: false,
    };
  }
  return {
    code: p.code,
    name: p.name,
    clientId: p.clientId ?? '',
    managerId: p.managerId ?? '',
    status: p.status,
    billing: p.billing,
    budgetHours: p.budgetHours === null ? '' : String(p.budgetHours),
    budgetAmount: p.budgetAmount === null ? '' : String(p.budgetAmount),
    alertPct: String(p.alertPct),
    startDate: p.startDate,
    endDate: p.endDate,
    description: p.description,
    color: p.color,
    memberIds: p.memberIds,
    closedToTime: p.closedToTime,
  };
}

interface Props {
  /** Undefined = create a new project. Mount the form only while it is open (its state starts fresh each time). */
  project?: Project;
  onClose: () => void;
  onSaved?: (project: Project) => void;
}

export function ProjectForm({ project, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const { rows: allProjects } = useCollection(projects);
  const { rows: allClients } = useCollection(clients);
  const { rows: allUsers } = useCollection(users);
  const [id] = useState(() => project?.id ?? uid('p_'));
  const [f, setF] = useState<Draft>(() => draftOf(project, user?.id));
  const [busy, setBusy] = useState(false);

  const suggestedCode = useMemo(
    () => nextProjectCode(allProjects.map((p) => p.code), new Date().getFullYear()),
    [allProjects],
  );
  const code = f.code ?? suggestedCode;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setF((prev) => ({ ...prev, [key]: value }));

  // Keep the current client/manager/members visible even when archived or inactive.
  const clientOptions = allClients
    .filter((c) => !c.archived || c.id === f.clientId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const people = allUsers
    .filter((u) => u.active || u.id === f.managerId || f.memberIds.includes(u.id))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  function toggleMember(userId: string) {
    setF((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(userId) ? prev.memberIds.filter((m) => m !== userId) : [...prev.memberIds, userId],
    }));
  }

  /** The payload to save, or an error message to show. */
  function buildFields(): ProjectFields | string {
    const name = f.name.trim();
    const cleanCode = code.trim();
    if (!cleanCode || !name) return t('Le code et le nom sont obligatoires.', 'Code and name are required.');
    if (cleanCode.length > 30 || name.length > 160) return t('Le code ou le nom est trop long.', 'Code or name is too long.');
    const budgetHours = parseOptional(f.budgetHours, 100_000);
    const budgetAmount = parseOptional(f.budgetAmount, 100_000_000);
    if (budgetHours === undefined) return t('Le budget en heures est invalide.', 'The hours budget is invalid.');
    if (budgetAmount === undefined) return t('Le budget en argent est invalide.', 'The money budget is invalid.');
    const alertPct = Number(f.alertPct);
    if (!Number.isInteger(alertPct) || alertPct < 1 || alertPct > 200) {
      return t("Le seuil d'alerte doit être entre 1 et 200 %.", 'The alert threshold must be between 1 and 200 %.');
    }
    if (f.startDate && f.endDate && f.endDate < f.startDate) return t('La date de fin précède la date de début.', 'The end date is before the start date.');
    return {
      code: cleanCode,
      name,
      clientId: f.clientId || null,
      managerId: f.managerId || null,
      status: f.status,
      billing: f.billing,
      budgetHours,
      budgetAmount,
      alertPct,
      startDate: f.startDate,
      endDate: f.endDate,
      description: f.description,
      color: f.color,
      memberIds: f.memberIds,
      closedToTime: f.closedToTime,
    };
  }

  async function save() {
    const fields = buildFields();
    if (typeof fields === 'string') {
      toast(fields, 'err');
      return;
    }
    setBusy(true);
    try {
      const saved = project ? await projects.update(id, fields) : await projects.insert({ id, ...fields });
      toast(t('Projet enregistré', 'Project saved'));
      onSaved?.(saved);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('Enregistrement impossible', 'Could not save'), 'err');
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      large
      onClose={onClose}
      title={project ? t('Modifier le projet', 'Edit project') : t('Nouveau projet', 'New project')}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            {t('Annuler', 'Cancel')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !f.name.trim()}>
            {t('Enregistrer', 'Save')}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="field">
          <span>{t('Code *', 'Code *')}</span>
          <input className="input mono" maxLength={30} value={code} onChange={(e) => set('code', e.target.value)} />
        </label>
        <label className="field span-2">
          <span>{t('Nom *', 'Name *')}</span>
          <input className="input" maxLength={160} autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field">
          <span>{t('Client', 'Client')}</span>
          <select className="select" value={f.clientId} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">{t('Aucun', 'None')}</option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.archived ? ` (${t('archivé', 'archived')})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Responsable', 'Manager')}</span>
          <select className="select" value={f.managerId} onChange={(e) => set('managerId', e.target.value)}>
            <option value="">{t('Aucun', 'None')}</option>
            {people.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Statut', 'Status')}</span>
          <select className="select" value={f.status} onChange={(e) => set('status', e.target.value as Project['status'])}>
            {PROJECT_STATUS.map((s) => (
              <option key={s} value={s}>
                {t(STATUS_LABEL[s])}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Facturation', 'Billing')}</span>
          <select className="select" value={f.billing} onChange={(e) => set('billing', e.target.value as Project['billing'])}>
            {BILLING_TYPES.map((b) => (
              <option key={b} value={b}>
                {t(BILLING_LABEL[b])}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Budget (heures)', 'Budget (hours)')}</span>
          <input
            className="input"
            type="number"
            min={0}
            step="any"
            value={f.budgetHours}
            placeholder={t('Aucun', 'None')}
            onChange={(e) => set('budgetHours', e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('Budget ($)', 'Budget ($)')}</span>
          <input
            className="input"
            type="number"
            min={0}
            step="any"
            value={f.budgetAmount}
            placeholder={t('Aucun', 'None')}
            onChange={(e) => set('budgetAmount', e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t("Seuil d'alerte (%)", 'Alert threshold (%)')}</span>
          <input className="input" type="number" min={1} max={200} step={1} value={f.alertPct} onChange={(e) => set('alertPct', e.target.value)} />
        </label>
        <label className="field">
          <span>{t('Date de début', 'Start date')}</span>
          <input className="input" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </label>
        <label className="field">
          <span>{t('Date de fin', 'End date')}</span>
          <input
            className="input"
            type="date"
            min={f.startDate || undefined}
            value={f.endDate}
            onChange={(e) => set('endDate', e.target.value)}
          />
        </label>
        <label className="field span-2">
          <span>{t('Description', 'Description')}</span>
          <textarea className="textarea" rows={3} maxLength={4000} value={f.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <div className="field span-2">
          <span>{t('Couleur', 'Colour')}</span>
          <div className="row row-wrap" role="radiogroup" aria-label={t('Couleur', 'Colour')}>
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={f.color === c}
                aria-label={c}
                onClick={() => set('color', c)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: c,
                  cursor: 'pointer',
                  padding: 0,
                  border: f.color === c ? '3px solid var(--text)' : '1px solid var(--border)',
                }}
              />
            ))}
          </div>
        </div>
        <div className="field span-2">
          <span>{t('Membres (peuvent saisir du temps)', 'Members (can book time)')}</span>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 8,
              maxHeight: 180,
              overflowY: 'auto',
              padding: 4,
            }}
          >
            {people.length === 0 && <span className="small faint">{t('Aucun utilisateur.', 'No users.')}</span>}
            {people.map((u) => (
              <label key={u.id} className="check small">
                <input type="checkbox" checked={f.memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} />
                <span>
                  {u.displayName}
                  {!u.active ? ` (${t('inactif', 'inactive')})` : ''}
                </span>
              </label>
            ))}
          </div>
        </div>
        <label className="check span-2">
          <input type="checkbox" checked={f.closedToTime} onChange={(e) => set('closedToTime', e.target.checked)} />
          <span>{t('Fermé à la saisie de temps', 'Closed to time entries')}</span>
        </label>
      </div>
    </Modal>
  );
}
