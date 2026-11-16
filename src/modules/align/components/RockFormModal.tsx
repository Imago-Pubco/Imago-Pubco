import { useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import { quarterLabel } from '../lib';
import { rocks, strategy } from '../stores';
import type { Rock } from '../schemas';
import { errorText, planFrom, quarterOptions, truncate, userOptions } from './RockShared';

interface Props {
  /** Edit this Rock, or create one when omitted. */
  rock?: Rock;
  defaultQuarter: string;
  /** Order given to a new Rock (after the existing ones). */
  nextOrder: number;
  thrusts: string[];
  people: User[];
  onClose: () => void;
}

/** Create or edit a Rock (title, description, owner, quarter, key thrust, key initiative). */
export function RockFormModal({ rock, defaultQuarter, nextOrder, thrusts, people, onClose }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const { rows: strategyRows } = useCollection(strategy);
  const initiatives = useMemo(() => planFrom(strategyRows).keyInitiatives, [strategyRows]);
  interface FormValues {
    title: string;
    description: string;
    ownerId: string;
    quarter: string;
    thrust: string;
    initiative: string;
  }
  // The values as they were loaded (or the defaults of a new Rock). Only what the user changed is saved.
  const [base] = useState<FormValues>(() => ({
    title: rock?.title ?? '',
    description: rock?.description ?? '',
    ownerId: rock ? (rock.ownerId ?? '') : user!.id,
    quarter: rock?.quarter ?? defaultQuarter,
    thrust: rock?.thrust != null ? String(rock.thrust) : '',
    initiative: rock?.initiative != null ? String(rock.initiative) : '',
  }));
  const [title, setTitle] = useState(base.title);
  const [description, setDescription] = useState(base.description);
  const [ownerId, setOwnerId] = useState(base.ownerId);
  const [quarter, setQuarter] = useState(base.quarter);
  const [thrust, setThrust] = useState(base.thrust);
  const [initiative, setInitiative] = useState(base.initiative);
  const [busy, setBusy] = useState(false);

  const owners = userOptions(people, rock?.ownerId);
  const quarters = quarterOptions(defaultQuarter, quarter);

  const fieldsOf = (f: FormValues) => ({
    title: f.title.trim(),
    description: f.description.trim(),
    ownerId: f.ownerId || null,
    quarter: f.quarter,
    thrust: f.thrust === '' ? null : Number(f.thrust),
    initiative: f.initiative === '' ? null : Number(f.initiative),
  });

  const save = async () => {
    const name = title.trim();
    if (!name) return;
    const fields = fieldsOf({ title, description, ownerId, quarter, thrust, initiative });
    setBusy(true);
    try {
      if (rock) {
        const was = fieldsOf(base);
        const patch: Partial<Rock> = {};
        for (const k of Object.keys(fields) as (keyof typeof fields)[]) {
          if (fields[k] !== was[k]) (patch as Record<string, unknown>)[k] = fields[k];
        }
        if (Object.keys(patch).length) await rocks.update(rock.id, patch);
      } else {
        await rocks.insert({ id: uid('rock_'), ...fields, order: nextOrder, archived: false, sourceId: null });
      }
      toast(t('Rock enregistré', 'Rock saved'));
      onClose();
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={rock ? t('Modifier le Rock', 'Edit Rock') : t('Nouveau Rock', 'New Rock')}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('Annuler', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !title.trim()}>
            {t('Enregistrer', 'Save')}
          </button>
        </>
      }
    >
      <div className="stack">
        <label className="field">
          <span>{t('Titre', 'Title')} *</span>
          <input className="input" value={title} maxLength={200} autoFocus onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('Description', 'Description')}</span>
          <textarea className="textarea" rows={4} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>{t('Responsable', 'Owner')}</span>
            <select className="select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">{t('— Aucun —', '— None —')}</option>
              {owners.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('Trimestre', 'Quarter')}</span>
            <select className="select" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
              {quarters.map((q) => (
                <option key={q} value={q}>
                  {quarterLabel(q)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>{t('Priorité stratégique liée', 'Linked key thrust')}</span>
            <select className="select" value={thrust} onChange={(e) => setThrust(e.target.value)}>
              <option value="">{t('Aucune', 'None')}</option>
              {thrusts.map((txt, i) => (
                <option key={i} value={String(i)}>
                  {`${t('Axe', 'Thrust')} ${i + 1} — ${truncate(txt, 90)}`}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('Initiative clé liée', 'Linked key initiative')}</span>
            <select className="select" value={initiative} onChange={(e) => setInitiative(e.target.value)}>
              <option value="">{t('Aucune', 'None')}</option>
              {initiatives.map((item, i) => (
                <option key={i} value={String(i)}>
                  {`${t('Initiative', 'Initiative')} ${i + 1} — ${truncate(item.text, 90)}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </Modal>
  );
}
