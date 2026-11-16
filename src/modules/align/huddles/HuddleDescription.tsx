import { useState } from 'react';
import { Pencil, FileText } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/components/ui';
import { Collapsible } from '../components/WeekKit';
import { errorText } from '../components/RockShared';
import type { AlignHuddle, HuddleWeek } from '../schemas';
import { huddleWeeks } from '../stores';
import { huddleWeekId } from '../week';
import { fmtDay } from './huddleLib';
import { RichTextEditor } from '@/components/richtext/RichTextEditor';
import { RichText } from '@/components/richtext/RichText';
import { hasRichContent } from '@/components/richtext/sanitize';

/**
 * The huddle's description for one week. Shown: this week's text; else the latest earlier week's text (carried over);
 * else the huddle's own description. Editors can write this week's text (kept per week).
 */
export function HuddleDescription({ huddle, week, weeks, canEdit }: { huddle: AlignHuddle; week: string; weeks: HuddleWeek[]; canEdit: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const current = weeks.find((w) => w.id === huddleWeekId(huddle.id, week));
  const earlier = weeks
    .filter((w) => w.huddleId === huddle.id && w.weekStart < week && hasRichContent(w.description))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];

  const shown: { text: string; source: 'week' | 'carried' | 'huddle' | 'none'; from?: string } = current && hasRichContent(current.description)
    ? { text: current.description, source: 'week' }
    : earlier
      ? { text: earlier.description, source: 'carried', from: earlier.weekStart }
      : hasRichContent(huddle.description)
        ? { text: huddle.description, source: 'huddle' }
        : { text: '', source: 'none' };

  function startEdit() {
    setDraft(shown.text);
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    try {
      if (current) await huddleWeeks.update(current.id, { description: draft });
      else
        await huddleWeeks.insert({
          id: huddleWeekId(huddle.id, week),
          huddleId: huddle.id,
          weekStart: week,
          description: draft,
        });
      setEditing(false);
      toast(t('Ordre du jour enregistré', 'Agenda saved'));
    } catch (err) {
      toast(errorText(err), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Collapsible
      id="huddle.description" info={{ what: t("L’ordre du jour du huddle pour la semaine choisie. Chaque semaine peut avoir le sien ; sinon le dernier ordre du jour écrit est repris.", "The huddle's agenda for the selected week. Each week can have its own; otherwise the last one written is carried over."), source: t("ordres du jour hebdomadaires du huddle (écrites par l'animateur ou un gestionnaire des huddles).", "the huddle's weekly agendas (written by the host or a huddle manager).") }}
      title={t('Ordre du jour', 'Agenda')}
      icon={<FileText size={18} />}
      actions={
        canEdit && !editing ? (
          <button className="btn btn-sm" onClick={startEdit}>
            <Pencil size={14} /> {t('Modifier', 'Edit')}
          </button>
        ) : undefined
      }
    >
      {editing ? (
        <div className="stack">
          <RichTextEditor
            value={draft}
            onChange={setDraft}
            disabled={busy}
            ariaLabel={t('Ordre du jour', 'Agenda')}
            minHeight={140}
          />
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-sm" disabled={busy} onClick={() => setEditing(false)}>
              {t('Annuler', 'Cancel')}
            </button>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void save()}>
              {t('Enregistrer', 'Save')}
            </button>
          </div>
        </div>
      ) : shown.source === 'none' ? (
        <div className="small muted">{t('Aucun ordre du jour', 'No agenda')}</div>
      ) : (
        <>
          {shown.source === 'carried' && shown.from && (
            <div className="small muted" style={{ marginBottom: 6 }}>
              {t(`Reprise de la semaine du ${fmtDay(shown.from, 'fr')}`, `Carried from the week of ${fmtDay(shown.from, 'en')}`)}
            </div>
          )}
          <RichText html={shown.text} className={`align-desc-text${shown.source === 'week' ? '' : ' muted'}`} />
        </>
      )}
    </Collapsible>
  );
}
