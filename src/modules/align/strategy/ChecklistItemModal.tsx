import { errorText } from '../components/RockShared';
import { useState } from 'react';
import { uid } from '@/data/db';
import { useI18n } from '@/i18n';
import { Modal, useToast } from '@/components/ui';
import { checklist } from '../stores';
import type { ChecklistItem } from '../schemas';

/** Create or edit one line of the manual checklist. `done` is changed from the list, not here. */
export function ChecklistItemModal({
  item,
  categories,
  nextOrder,
  onClose,
}: {
  item?: ChecklistItem;
  categories: string[];
  nextOrder: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [category, setCategory] = useState(item?.category ?? categories[0] ?? '');
  const [text, setText] = useState(item?.text ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [busy, setBusy] = useState(false);
  const valid = category.trim().length > 0 && text.trim().length > 0;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const fields = { category: category.trim(), text: text.trim(), note: note.trim() };
      if (item) await checklist.update(item.id, fields);
      else await checklist.insert({ id: uid('chk_'), ...fields, done: false, order: nextOrder });
      toast(t('Élément enregistré', 'Item saved'));
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
      title={item ? t('Modifier l’élément', 'Edit item') : t('Nouvel élément', 'New item')}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {t('Annuler', 'Cancel')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!valid || busy}>
            {t('Enregistrer', 'Save')}
          </button>
        </>
      }
    >
      <div className="stack">
        <label className="field">
          <span>{t('Catégorie', 'Category')}</span>
          <input className="input" list="align-cl-categories" value={category} maxLength={80} onChange={(e) => setCategory(e.target.value)} />
          <datalist id="align-cl-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>{t('Élément', 'Item')}</span>
          <textarea className="textarea" rows={3} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('Note', 'Note')}</span>
          <textarea className="textarea" rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
