/** Agenda, parking lot and issues of one huddle week: a list with an add form, status marks, inline edit and delete. */
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { uid } from '@/data/db';
import { useI18n } from '@/i18n';
import { huddleItems } from './stores';
import type { HuddleItem } from './schemas';
import { huddleItemsOf, type MeetingData } from './HuddleMeeting.data';
import { LINK_RESET, SectionCard, useRun } from './HuddleMeeting.ui';

const BADGE: Record<HuddleItem['status'], string> = { open: 'badge-warn', discussed: 'badge-info', resolved: 'badge-ok' };
const NEXT: Record<HuddleItem['status'], HuddleItem['status']> = { open: 'discussed', discussed: 'resolved', resolved: 'open' };

export function ItemsSection({ data, type }: { data: MeetingData; type: HuddleItem['type'] }) {
  const { t } = useI18n();
  const run = useRun();
  const [text, setText] = useState('');
  const items = huddleItemsOf(data, type);
  const titles: Record<HuddleItem['type'], string> = {
    agenda: t('Ordre du jour', 'Agenda'),
    parking: 'Parking lot',
    issue: t('Enjeux', 'Issues'),
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    run(async () => {
      await huddleItems.insert({
        id: uid('hi_'),
        huddleId: data.huddle.id,
        week: data.week,
        type,
        text: value,
        status: 'open',
        order: items.length,
      });
      setText('');
    });
  };

  return (
    <SectionCard title={titles[type]}>
      <form onSubmit={add} className="row row-wrap" style={{ gap: 8, marginBottom: items.length ? 12 : 0 }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 220 }}
          value={text}
          maxLength={1000}
          placeholder={t('Ajouter un point…', 'Add an item…')}
          aria-label={titles[type]}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-sm" type="submit" disabled={!text.trim()}>
          <Plus size={15} />
          {t('Ajouter', 'Add')}
        </button>
      </form>
      {items.length === 0 ? (
        <p className="faint small" style={{ margin: 0 }}>
          {t('Aucun point pour cette semaine.', 'No items for this week.')}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} agenda={type === 'agenda'} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function ItemRow({ item, agenda }: { item: HuddleItem; agenda: boolean }) {
  const { t } = useI18n();
  const run = useRun();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const discussed = item.status === 'discussed';

  const setStatus = (status: HuddleItem['status']) => run(() => huddleItems.update(item.id, { status }));

  const save = () => {
    setEditing(false);
    const value = draft.trim();
    if (!value || value === item.text) {
      setDraft(item.text);
      return;
    }
    run(() => huddleItems.update(item.id, { text: value }));
  };

  const onEditKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); // the blur handler saves once
    if (e.key === 'Escape') {
      setDraft(item.text);
      setEditing(false);
    }
  };

  const remove = () => {
    if (window.confirm(t('Supprimer cet élément ?', 'Delete this item?'))) run(() => huddleItems.remove(item.id));
  };

  const statusLabel = item.status === 'open' ? t('Ouvert', 'Open') : item.status === 'discussed' ? t('Discuté', 'Discussed') : t('Résolu', 'Resolved');

  return (
    <li className="row" style={{ gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      {agenda ? (
        <input
          type="checkbox"
          checked={discussed}
          onChange={() => setStatus(discussed ? 'open' : 'discussed')}
          aria-label={t('Discuté', 'Discussed')}
          style={{ accentColor: 'var(--accent)', width: 18, height: 18, flex: 'none' }}
        />
      ) : (
        <button
          type="button"
          className={`badge ${BADGE[item.status]}`}
          onClick={() => setStatus(NEXT[item.status])}
          title={t('Changer le statut', 'Change status')}
          style={{ cursor: 'pointer', border: 'none', flex: 'none' }}
        >
          {statusLabel}
        </button>
      )}
      {editing ? (
        <input
          className="input input-sm"
          autoFocus
          style={{ flex: 1, minWidth: 0 }}
          value={draft}
          maxLength={1000}
          aria-label={t('Modifier le texte', 'Edit text')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={onEditKey}
        />
      ) : (
        <button
          type="button"
          title={t('Cliquer pour modifier', 'Click to edit')}
          onClick={() => {
            setDraft(item.text);
            setEditing(true);
          }}
          style={{
            ...LINK_RESET,
            flex: 1,
            minWidth: 0,
            overflowWrap: 'anywhere',
            textDecoration: agenda && discussed ? 'line-through' : undefined,
            color: agenda && discussed ? 'var(--text-3)' : undefined,
          }}
        >
          {item.text}
        </button>
      )}
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={remove} aria-label={t('Supprimer', 'Delete')}>
        <X size={16} />
      </button>
    </li>
  );
}
