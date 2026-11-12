import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import type { Kpi } from './schemas';
import { kpis, kpiValues, teams } from './stores';
import { kpiFieldsOf, MAX_CRITICAL, parseNumber, type KpiFields } from './Kpis.shared';

function newFields(ownerId: string | null, order: number): KpiFields {
  return {
    name: '',
    description: '',
    unit: '',
    frequency: 'weekly',
    direction: 'up',
    target: null,
    ownerId,
    teamId: null,
    status: 'active',
    critical: false,
    order,
  };
}

interface Props {
  /** null = create a new indicator. */
  kpi: Kpi | null;
  /** Order given to a new indicator (number of existing ones). */
  order: number;
  /** Other indicators already marked critical (for the non-blocking warning). */
  criticalOthers: number;
  onClose: () => void;
}

/** Create or edit one indicator. Mounted only while open, so its state starts fresh each time. */
export function KpiFormModal({ kpi, order, criticalOthers, onClose }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const { rows: allUsers } = useCollection(users);
  const { rows: allTeams } = useCollection(teams);
  const [id] = useState(() => kpi?.id ?? uid('k_'));
  const [f, setF] = useState<KpiFields>(() => (kpi ? kpiFieldsOf(kpi) : newFields(user?.id ?? null, order)));
  const [targetText, setTargetText] = useState(() => (typeof kpi?.target === 'number' ? String(kpi.target) : ''));
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof KpiFields>(key: K, value: KpiFields[K]) => setF((prev) => ({ ...prev, [key]: value }));

  // Keep the current owner/team visible even when they are inactive or archived.
  const owners = allUsers
    .filter((u) => u.active || u.id === f.ownerId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const teamOptions = allTeams
    .filter((x) => !x.archived || x.id === f.teamId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const warnCritical = f.critical && criticalOthers >= MAX_CRITICAL;

  async function save() {
    const name = f.name.trim();
    const target = parseNumber(targetText);
    if (!name || target === undefined) {
      toast(t('Vérifiez le nom et la cible.', 'Check the name and the target.'), 'err');
      return;
    }
    const payload: KpiFields = { ...f, name, target };
    setBusy(true);
    try {
      if (kpi) await kpis.update(id, payload);
      else await kpis.insert({ id, ...payload });
      toast(t('Indicateur enregistré', 'Indicator saved'));
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('Enregistrement impossible', 'Could not save'), 'err');
      setBusy(false);
    }
  }

  async function remove() {
    if (!kpi) return;
    setBusy(true);
    try {
      const values = (await kpiValues.list()).filter((v) => v.kpiId === kpi.id);
      const ok = window.confirm(
        t(
          `Supprimer « ${kpi.name} » et ses ${values.length} valeur(s) ? Cette action est irréversible.`,
          `Delete "${kpi.name}" and its ${values.length} value(s)? This cannot be undone.`,
        ),
      );
      if (!ok) {
        setBusy(false);
        return;
      }
      await Promise.all(values.map((v) => kpiValues.remove(v.id)));
      await kpis.remove(kpi.id);
      toast(t('Indicateur supprimé', 'Indicator deleted'));
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('Suppression impossible', 'Could not delete'), 'err');
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={kpi ? t('Modifier l’indicateur', 'Edit indicator') : t('Nouvel indicateur', 'New indicator')}
      footer={
        <>
          {kpi && (
            <button className="btn btn-danger" onClick={remove} disabled={busy} style={{ marginRight: 'auto' }}>
              {t('Supprimer', 'Delete')}
            </button>
          )}
          <button className="btn" onClick={onClose}>{t('Annuler', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !f.name.trim()}>
            {t('Enregistrer', 'Save')}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="field span-2">
          <span>{t('Nom *', 'Name *')}</span>
          <input className="input" value={f.name} maxLength={120} autoFocus onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field span-2">
          <span>{t('Définition et source des données', 'Definition and data source')}</span>
          <textarea
            className="textarea"
            rows={3}
            maxLength={4000}
            value={f.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('Unité', 'Unit')}</span>
          <input className="input" value={f.unit} maxLength={12} placeholder="$, %, h, #" onChange={(e) => set('unit', e.target.value)} />
        </label>
        <label className="field">
          <span>{t('Cible', 'Target')}</span>
          <input
            className="input"
            type="number"
            step="any"
            value={targetText}
            placeholder={t('Aucune', 'None')}
            onChange={(e) => setTargetText(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t('Fréquence', 'Frequency')}</span>
          <select className="select" value={f.frequency} onChange={(e) => set('frequency', e.target.value as KpiFields['frequency'])}>
            <option value="weekly">{t('Hebdomadaire', 'Weekly')}</option>
            <option value="monthly">{t('Mensuel', 'Monthly')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('Sens', 'Direction')}</span>
          <select className="select" value={f.direction} onChange={(e) => set('direction', e.target.value as KpiFields['direction'])}>
            <option value="up">{t('Plus haut est mieux', 'Higher is better')}</option>
            <option value="down">{t('Plus bas est mieux', 'Lower is better')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('Responsable', 'Owner')}</span>
          <select className="select" value={f.ownerId ?? ''} onChange={(e) => set('ownerId', e.target.value || null)}>
            <option value="">{t('Aucun', 'None')}</option>
            {owners.map((u) => (
              <option key={u.id} value={u.id}>{u.displayName}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Équipe', 'Team')}</span>
          <select className="select" value={f.teamId ?? ''} onChange={(e) => set('teamId', e.target.value || null)}>
            <option value="">{t('Aucune', 'None')}</option>
            {teamOptions.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('Statut', 'Status')}</span>
          <select className="select" value={f.status} onChange={(e) => set('status', e.target.value as KpiFields['status'])}>
            <option value="active">{t('Actif', 'Active')}</option>
            <option value="draft">{t('Brouillon', 'Draft')}</option>
            <option value="archived">{t('Archivé', 'Archived')}</option>
          </select>
        </label>
        <label className="check span-2">
          <input type="checkbox" checked={f.critical} onChange={(e) => set('critical', e.target.checked)} />
          <span>{t('Indicateur critique (chiffre clé de l’entreprise)', 'Critical indicator (key company number)')}</span>
        </label>
        {warnCritical && (
          <div className="alert alert-info span-2">
            {t(
              `Il y a déjà ${criticalOthers} indicateurs critiques. Le maximum recommandé est ${MAX_CRITICAL}.`,
              `There are already ${criticalOthers} critical indicators. The recommended maximum is ${MAX_CRITICAL}.`,
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
