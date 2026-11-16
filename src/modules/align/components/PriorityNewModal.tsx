import { errorText } from './RockShared';
import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { uid } from '@/data/db';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import { quarterRange } from '../lib';
import { alignPriorities } from '../stores';
import type { AlignPriority, Rock } from '../schemas';
import { userOptions } from './RockShared';

/** Adds a priority to a Rock (defaults: not started, green, 0 %, due at the end of the Rock's quarter). */
export function PriorityNewModal({ rock, all, people, onClose }: { rock: Rock; all: AlignPriority[]; people: User[]; onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState(user!.id);
  const [dueDate, setDueDate] = useState(quarterRange(rock.quarter).end);
  const [busy, setBusy] = useState(false);
  const owners = userOptions(people, user!.id);

  const save = async () => {
    const name = title.trim();
    if (!name) return;
    setBusy(true);
    try {
      await alignPriorities.insert({
        id: uid('pr_'),
        title: name,
        description: description.trim(),
        ownerId: ownerId || null,
        dueDate: dueDate || null,
        status: 'not_started',
        health: 'green',
        progress: 0,
        blockedById: null,
        blockedNote: '',
        order: all.filter((p) => p.rockId === rock.id).length,
        archived: false,
        sourceId: null,
        rockId: rock.id,
      });
      toast(t('Priorité ajoutée', 'Priority added'));
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
      title={t('Nouvelle priorité', 'New priority')}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('Annuler', 'Cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !title.trim()}>
            {t('Ajouter', 'Add')}
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
          <textarea className="textarea" rows={3} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
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
            <span>{t('Échéance', 'Due date')}</span>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
      </div>
    </Modal>
  );
}
