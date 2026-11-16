import { errorText } from '../components/RockShared';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Empty, useToast } from '@/components/ui';
import { ARCHIVE_CHECKLIST } from '../archive';
import { checklist } from '../stores';
import type { ChecklistItem } from '../schemas';
import { ProgressBar } from '../components/RockShared';
import { ChecklistItemModal } from './ChecklistItemModal';

/** Part B: the manual checklist, grouped by category. Managers tick, add, edit, reorder and delete; others read. */
export function ManualChecklist({ items, canManage }: { items: ChecklistItem[]; canManage: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [editing, setEditing] = useState<ChecklistItem | 'new' | null>(null);
  const [seeding, setSeeding] = useState(false);

  const sorted = useMemo(() => [...items].sort((a, b) => a.order - b.order), [items]);
  const groups = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const it of sorted) {
      const list = map.get(it.category);
      if (list) list.push(it);
      else map.set(it.category, [it]);
    }
    return [...map];
  }, [sorted]);
  const categories = useMemo(() => groups.map(([c]) => c), [groups]);
  const nextOrder = sorted.length ? Math.max(...sorted.map((i) => i.order)) + 1 : 0;
  const doneCount = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast(errorText(e), 'err');
    }
  };

  /** Swaps the order of an item with its neighbour inside the same category. */
  const move = (it: ChecklistItem, dir: -1 | 1) => {
    const group = groups.find(([c]) => c === it.category)?.[1] ?? [];
    const other = group[group.indexOf(it) + dir];
    if (!other) return;
    void run(() => Promise.all([checklist.update(it.id, { order: other.order }), checklist.update(other.id, { order: it.order })]));
  };

  const remove = (it: ChecklistItem) => {
    if (!window.confirm(t('Supprimer cet élément ?', 'Delete this item?'))) return;
    void run(() => checklist.remove(it.id), t('Élément supprimé', 'Item deleted'));
  };

  /** Loads Align's 40-point checklist. The ids are stable, so loading it twice cannot duplicate the items. */
  const seed = async () => {
    setSeeding(true);
    try {
      await Promise.all(ARCHIVE_CHECKLIST.map((item) => checklist.insert({ ...item })));
      toast(t('Liste Align (40 points) chargée', 'Align list (40 points) loaded'));
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <section className="card card-pad align-checklist-card">
      <div className="row row-wrap" style={{ gap: 10, marginBottom: 12 }}>
        <h2 className="align-section-title" style={{ margin: 0 }}>
          {t('Liste manuelle', 'Manual checklist')}
        </h2>
        <span className="spacer" />
        {canManage && items.length > 0 && (
          <button className="btn btn-sm" onClick={() => setEditing('new')}>
            <Plus size={14} /> {t('Élément', 'Item')}
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="row" style={{ gap: 12, marginBottom: 16 }}>
          <strong className="align-score">
            {doneCount} / {items.length} {t('points complétés', 'points completed')}
          </strong>
          <div style={{ flex: 1, minWidth: 80 }}>
            <ProgressBar pct={pct} large />
          </div>
          <span className="small mono">{pct} %</span>
        </div>
      )}

      {!items.length ? (
        <Empty icon={<ListChecks size={36} />} title={t('Aucun élément dans la liste', 'No item in the checklist')}>
          {canManage && (
            <button className="btn btn-primary btn-sm" disabled={seeding} onClick={seed}>
              {t('Charger la liste Align (40 points)', 'Load the Align list (40 points)')}
            </button>
          )}
        </Empty>
      ) : (
        groups.map(([category, list]) => (
          <div className="align-cl-group" key={category}>
            <h3 className="align-cl-cat">{category}</h3>
            <ul className="align-cl-list">
              {list.map((it, i) => (
                <li key={it.id} className={`align-cl-item${it.done ? ' is-done' : ''}`}>
                  <input
                    type="checkbox"
                    className="align-cl-check"
                    checked={it.done}
                    disabled={!canManage}
                    aria-label={it.text}
                    onChange={(e) => void run(() => checklist.update(it.id, { done: e.target.checked }))}
                  />
                  <div className="align-cl-main">
                    <span className="align-cl-text">{it.text}</span>
                    {it.note && <div className="small muted align-cl-note">{it.note}</div>}
                  </div>
                  {canManage && (
                    <div className="align-cl-tools">
                      <button className="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onClick={() => move(it, -1)} aria-label={t('Monter', 'Move up')} title={t('Monter', 'Move up')}>
                        <ArrowUp size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        disabled={i === list.length - 1}
                        onClick={() => move(it, 1)}
                        aria-label={t('Descendre', 'Move down')}
                        title={t('Descendre', 'Move down')}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditing(it)} aria-label={t('Modifier', 'Edit')} title={t('Modifier', 'Edit')}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(it)} aria-label={t('Supprimer', 'Delete')} title={t('Supprimer', 'Delete')}>
                        <Trash2 size={14} color="var(--err)" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {editing && (
        <ChecklistItemModal
          item={editing === 'new' ? undefined : editing}
          categories={categories}
          nextOrder={nextOrder}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
