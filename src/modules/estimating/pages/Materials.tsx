import { useState } from 'react';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { uid, useCollection } from '@/data/db';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { Empty, Modal, PageHeader, useToast } from '@/components/ui';
import { materials } from '../stores';
import type { Material } from '../types';

const CATEGORIES: { key: Material['category']; fr: string; en: string }[] = [
  { key: 'carton', fr: 'Carton plat', en: 'Paperboard' },
  { key: 'corrugated', fr: 'Carton ondulé', en: 'Corrugated' },
  { key: 'rigid', fr: 'Rigide', en: 'Rigid' },
  { key: 'plastic', fr: 'Plastique', en: 'Plastic' },
];

/** Material catalogue with indicative cost per m² (used by the pricing model). */
export function Materials() {
  const { t, fmtMoney } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const { rows } = useCollection(materials);
  const [edit, setEdit] = useState<Material | null>(null);
  const manage = can('estimating.catalog');

  const save = async () => {
    if (!edit) return;
    if (await materials.get(edit.id)) await materials.update(edit.id, edit);
    else await materials.insert(edit);
    setEdit(null);
    toast(t('Matériau enregistré', 'Material saved'));
  };

  return (
    <Page>
      <PageHeader
        eyebrow={t('Estimation', 'Estimating')}
        title={t('Matériaux et tarifs', 'Materials & rates')}
        subtitle={t('Coûts indicatifs par m², utilisés pour le chiffrage.', 'Indicative cost per m², used for costing.')}
        actions={
          manage && (
            <button className="btn btn-primary" onClick={() => setEdit({ id: uid('mat_'), code: '', name: '', category: 'carton', caliper: '', costPerM2: 0 })}>
              <Plus size={16} /> {t('Matériau', 'Material')}
            </button>
          )
        }
      />
      {CATEGORIES.map((c) => {
        const list = rows.filter((r) => r.category === c.key);
        if (!list.length) return null;
        return (
          <div key={c.key} className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h3>{t(c.fr, c.en)}</h3>
              <span className="faint small">{list.length}</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>{t('Description', 'Description')}</th>
                    <th>{t('Épaisseur', 'Caliper')}</th>
                    <th className="num">{t('Coût / m²', 'Cost / m²')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id}>
                      <td className="mono">{m.code}</td>
                      <td>{m.name}</td>
                      <td className="muted">{m.caliper}</td>
                      <td className="num">{fmtMoney(m.costPerM2)}</td>
                      <td className="num">
                        {manage && (
                          <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEdit(m)} aria-label="Edit">
                              <Pencil size={14} />
                            </button>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => materials.remove(m.id)} aria-label="Delete">
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
          </div>
        );
      })}
      {!rows.length && (
        <div className="card">
          <Empty icon={<Layers size={36} />} title={t('Aucun matériau', 'No materials')} />
        </div>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={t('Matériau', 'Material')}
        footer={
          <>
            <button className="btn" onClick={() => setEdit(null)}>{t('Annuler', 'Cancel')}</button>
            <button className="btn btn-primary" onClick={save} disabled={!edit?.code || !edit?.name}>{t('Enregistrer', 'Save')}</button>
          </>
        }
      >
        {edit && (
          <div className="form-grid">
            <label className="field">
              <span>Code</span>
              <input className="input mono" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} />
            </label>
            <label className="field">
              <span>{t('Catégorie', 'Category')}</span>
              <select className="select" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as Material['category'] })}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{t(c.fr, c.en)}</option>)}
              </select>
            </label>
            <label className="field span-2">
              <span>{t('Description', 'Description')}</span>
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('Épaisseur / cannelure', 'Caliper / flute')}</span>
              <input className="input" value={edit.caliper} onChange={(e) => setEdit({ ...edit, caliper: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('Coût / m² ($)', 'Cost / m² ($)')}</span>
              <input className="input num" type="number" step="0.01" value={edit.costPerM2} onChange={(e) => setEdit({ ...edit, costPerM2: +e.target.value })} />
            </label>
          </div>
        )}
      </Modal>
    </Page>
  );
}
