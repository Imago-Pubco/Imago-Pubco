import { useState } from 'react';
import { Plus, Pencil, Trash2, BookUser, Star } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, Modal, PageHeader, useToast } from '@/components/ui';
import { addressBook, shipFroms } from '../stores';
import type { Address } from '../types';

function AddressFields<T extends Address>({ value, onChange }: { value: T; onChange: (v: T) => void }) {
  const { t } = useI18n();
  const f = (k: keyof Address, label: string, span2 = false) => (
    <label className={`field ${span2 ? 'span-2' : ''}`}>
      <span>{label}</span>
      <input className="input" value={(value[k] as string) ?? ''} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
    </label>
  );
  return (
    <>
      {f('name', t('Nom / entreprise', 'Name / company'), true)}
      {f('attention', t('À l’attention de', 'Attention'))}
      {f('phone', t('Téléphone', 'Phone'))}
      {f('street', t('Adresse', 'Street'), true)}
      {f('street2', t('Adresse (ligne 2)', 'Street (line 2)'), true)}
      {f('city', t('Ville', 'City'))}
      {f('province', t('Province', 'Province'))}
      {f('postalCode', t('Code postal', 'Postal code'))}
      {f('country', t('Pays', 'Country'))}
    </>
  );
}

const blankAddr: Address = { name: '', street: '', city: '', province: 'QC', postalCode: '', country: 'CA' };

/** Customer address book used by the label editor. */
export function Addresses() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const { rows } = useCollection(addressBook);
  const [edit, setEdit] = useState<(Address & { id?: string; code: string }) | null>(null);
  const manage = can('shipping.addresses.manage');

  const save = async () => {
    if (!edit) return;
    if (edit.id) await addressBook.update(edit.id, edit);
    else await addressBook.insert({ ...edit, id: uid('ad_') });
    setEdit(null);
    toast(t('Adresse enregistrée', 'Address saved'));
  };

  return (
    <Page>
      <PageHeader
        eyebrow={t('Production', 'Production')}
        title={t('Carnet d’adresses', 'Address book')}
        actions={
          manage && (
            <button className="btn btn-primary" onClick={() => setEdit({ ...blankAddr, code: '' })}>
              <Plus size={16} /> {t('Adresse', 'Address')}
            </button>
          )
        }
      />
      <div className="card">
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Code', 'Code')}</th>
                  <th>{t('Nom', 'Name')}</th>
                  <th>{t('Adresse', 'Address')}</th>
                  <th>{t('Téléphone', 'Phone')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{a.code}</td>
                    <td>
                      {a.name}
                      {a.attention && <div className="faint small">{a.attention}</div>}
                    </td>
                    <td className="muted">
                      {a.street}, {a.city} {a.province} {a.postalCode}
                    </td>
                    <td className="muted">{a.phone}</td>
                    <td className="num">
                      {manage && (
                        <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEdit(a)} aria-label="Edit">
                            <Pencil size={14} />
                          </button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => addressBook.remove(a.id)} aria-label="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<BookUser size={36} />} title={t('Aucune adresse', 'No addresses')} />
        )}
      </div>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? t('Modifier l’adresse', 'Edit address') : t('Nouvelle adresse', 'New address')}
        footer={
          <>
            <button className="btn" onClick={() => setEdit(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary" onClick={save} disabled={!edit?.name || !edit?.code}>
              {t('Enregistrer', 'Save')}
            </button>
          </>
        }
      >
        {edit && (
          <div className="form-grid">
            <label className="field">
              <span>{t('Code client', 'Customer code')}</span>
              <input className="input mono" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} />
            </label>
            <div />
            <AddressFields value={edit} onChange={setEdit} />
          </div>
        )}
      </Modal>
    </Page>
  );
}

/** Ship-from origins (plants / warehouses). */
export function ShipSettings() {
  const { t } = useI18n();
  const toast = useToast();
  const { rows } = useCollection(shipFroms);
  const [edit, setEdit] = useState<(Address & { id?: string; label: string; isDefault?: boolean }) | null>(null);

  const save = async () => {
    if (!edit) return;
    if (edit.isDefault) for (const r of rows) if (r.id !== edit.id && r.isDefault) await shipFroms.update(r.id, { isDefault: false });
    if (edit.id) await shipFroms.update(edit.id, edit);
    else await shipFroms.insert({ ...edit, id: uid('sf_') });
    setEdit(null);
    toast(t('Origine enregistrée', 'Origin saved'));
  };

  return (
    <Page>
      <PageHeader
        eyebrow={t('Production', 'Production')}
        title={t('Paramètres d’expédition', 'Shipping settings')}
        subtitle={t('Adresses d’expédition (usines, entrepôts).', 'Ship-from addresses (plants, warehouses).')}
        actions={
          <button className="btn btn-primary" onClick={() => setEdit({ ...blankAddr, label: '' })}>
            <Plus size={16} /> {t('Origine', 'Origin')}
          </button>
        }
      />
      <div className="grid-2">
        {rows.map((r) => (
          <div key={r.id} className="card card-pad">
            <div className="row" style={{ marginBottom: 8 }}>
              <strong>{r.label}</strong>
              {r.isDefault && (
                <span className="badge badge-accent">
                  <Star size={12} /> {t('Par défaut', 'Default')}
                </span>
              )}
              <span className="spacer" />
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEdit(r)} aria-label="Edit">
                <Pencil size={14} />
              </button>
            </div>
            <div className="muted small">
              {r.name}
              <br />
              {r.street}
              <br />
              {r.city} {r.province} {r.postalCode}
              <br />
              {r.phone}
            </div>
          </div>
        ))}
      </div>
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={t('Origine d’expédition', 'Ship-from origin')}
        footer={
          <>
            <button className="btn" onClick={() => setEdit(null)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary" onClick={save} disabled={!edit?.label}>
              {t('Enregistrer', 'Save')}
            </button>
          </>
        }
      >
        {edit && (
          <div className="form-grid">
            <label className="field">
              <span>{t('Libellé', 'Label')}</span>
              <input className="input" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
            </label>
            <label className="check" style={{ alignSelf: 'end', height: 38 }}>
              <input type="checkbox" checked={!!edit.isDefault} onChange={(e) => setEdit({ ...edit, isDefault: e.target.checked })} />
              {t('Par défaut', 'Default')}
            </label>
            <AddressFields value={edit} onChange={setEdit} />
          </div>
        )}
      </Modal>
    </Page>
  );
}
