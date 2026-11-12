import { useState } from 'react';
import { uid } from '@/data/db';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import type { Client } from './schemas';
import { clients } from './stores';

type ClientFields = Pick<Client, 'name' | 'contact' | 'email' | 'phone' | 'notes'>;

interface Props {
  /** Undefined = create a new client. Mount the form only while it is open. */
  client?: Client;
  onClose: () => void;
  onSaved?: (client: Client) => void;
}

export function ClientForm({ client, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [id] = useState(() => client?.id ?? uid('c_'));
  const [f, setF] = useState<ClientFields>(() => ({
    name: client?.name ?? '',
    contact: client?.contact ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    notes: client?.notes ?? '',
  }));
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof ClientFields>(key: K, value: string) => setF((prev) => ({ ...prev, [key]: value }));

  /** Trimmed payload, or an error message to show. */
  function buildFields(): ClientFields | string {
    const clean: ClientFields = {
      name: f.name.trim(),
      contact: f.contact.trim(),
      email: f.email.trim(),
      phone: f.phone.trim(),
      notes: f.notes.trim(),
    };
    if (!clean.name) return t('Le nom du client est obligatoire.', 'The client name is required.');
    if (clean.email && !/^[^\s@]+@[^\s@]+$/.test(clean.email)) return t('Le courriel est invalide.', 'The email address is invalid.');
    return clean;
  }

  async function save() {
    const fields = buildFields();
    if (typeof fields === 'string') {
      toast(fields, 'err');
      return;
    }
    setBusy(true);
    try {
      const saved = client
        ? await clients.update(id, fields)
        : await clients.insert({ id, ...fields, archived: false });
      toast(t('Client enregistré', 'Client saved'));
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
      onClose={onClose}
      title={client ? t('Modifier le client', 'Edit client') : t('Nouveau client', 'New client')}
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
        <label className="field span-2">
          <span>{t('Nom *', 'Name *')}</span>
          <input className="input" maxLength={120} autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field">
          <span>{t('Personne-ressource', 'Contact person')}</span>
          <input className="input" maxLength={120} value={f.contact} onChange={(e) => set('contact', e.target.value)} />
        </label>
        <label className="field">
          <span>{t('Courriel', 'Email')}</span>
          <input className="input" type="email" maxLength={200} value={f.email} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label className="field">
          <span>{t('Téléphone', 'Phone')}</span>
          <input className="input" type="tel" maxLength={40} value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        </label>
        <label className="field span-2">
          <span>{t('Notes', 'Notes')}</span>
          <textarea className="textarea" rows={3} maxLength={4000} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
