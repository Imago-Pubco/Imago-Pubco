import { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { Page } from '@/components/Page';
import { PageHeader, useToast } from '@/components/ui';
import { Avatar } from '@/modules/admin/pages/Users';
import { useCollection } from '@/data/db';
import { users } from '@/data/stores';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { addDays, counted, fmtHours, iso, weeklyHoursOf } from '../lib';
import type { Rate, Staff } from '../schemas';
import { rates, staff, timeEntries } from '../stores';

/** Work days when a person has no capacity record yet: Monday to Friday. */
const DEFAULT_DAYS = [1, 2, 3, 4, 5];

interface Draft {
  title: string;
  weeklyHours: string;
  workDays: number[];
  costRate: string;
}

function draftOf(s: Staff | undefined, r: Rate | undefined): Draft {
  return {
    title: s?.title ?? '',
    weeklyHours: String(weeklyHoursOf(s)),
    workDays: s && s.workDays.length ? [...s.workDays].sort((a, b) => a - b) : DEFAULT_DAYS,
    costRate: r ? String(r.costRate) : '',
  };
}

/** Accepts "37,5" or "37.5"; null when empty or not a number. */
function parseNum(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const LETTERS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const LETTERS_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const NAMES_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Team and rates: title, weekly capacity and work days (not confidential) and the confidential cost rate. */
export function Team() {
  const { t, lang } = useI18n();
  const { rows: userRows } = useCollection(users);
  const { rows: staffRows } = useCollection(staff);
  const { rows: rateRows } = useCollection(rates);
  const { rows: entryRows } = useCollection(timeEntries);

  const today = iso(new Date());
  const since = addDays(today, -29);
  const staffMap = useMemo(() => new Map(staffRows.map((s) => [s.id, s])), [staffRows]);
  const rateMap = useMemo(() => new Map(rateRows.map((r) => [r.id, r])), [rateRows]);
  const hoursById = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entryRows) {
      if (counted(e) && e.date >= since && e.date <= today) m.set(e.userId, (m.get(e.userId) ?? 0) + e.hours);
    }
    return m;
  }, [entryRows, since, today]);
  const people = useMemo(
    () => userRows.filter((u) => u.active).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [userRows],
  );

  return (
    <Page>
      <PageHeader
        eyebrow={t('Outils · Gestion de projet', 'Tools · Project management')}
        title={t('Équipe et taux', 'Team and rates')}
        subtitle={t('Capacité, titre et taux de coût de chaque personne active.', 'Capacity, title and cost rate of each active person.')}
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-pad row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <Lock size={18} color="var(--warn)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p className="small" style={{ margin: 0 }}>
            {t(
              'Le taux de coût est confidentiel : il n’est visible que des gestionnaires et des personnes ayant la permission Rapports, et ne sert qu’aux rapports de rentabilité. Il n’apparaît dans aucune autre page.',
              'The cost rate is confidential: only managers and people with the Reports permission can see it, and it is only used in the profitability reports. It is not shown on any other page.',
            )}
          </p>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="card empty">
          <h3>{t('Aucune personne active', 'No active people')}</h3>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Personne', 'Person')}</th>
                <th>{t('Titre', 'Title')}</th>
                <th className="num">{t('Heures / semaine', 'Hours / week')}</th>
                <th>{t('Jours travaillés', 'Work days')}</th>
                <th className="num">{t('Taux de coût ($/h)', 'Cost rate ($/h)')}</th>
                <th className="num">{t('Heures (30 derniers jours)', 'Hours (last 30 days)')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {people.map((u) => (
                <TeamRow
                  key={u.id}
                  user={u}
                  staffRow={staffMap.get(u.id)}
                  rate={rateMap.get(u.id)}
                  hours={hoursById.get(u.id) ?? 0}
                  lang={lang}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

function TeamRow({ user, staffRow, rate, hours, lang }: { user: User; staffRow: Staff | undefined; rate: Rate | undefined; hours: number; lang: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // Unsaved edits are kept only while the saved values they started from are unchanged.
  const persisted = JSON.stringify(draftOf(staffRow, rate));
  const [edit, setEdit] = useState<{ base: string; draft: Draft } | null>(null);
  const draft = edit && edit.base === persisted ? edit.draft : draftOf(staffRow, rate);
  const dirty = JSON.stringify(draft) !== persisted;
  const patch = (p: Partial<Draft>) => setEdit({ base: persisted, draft: { ...draft, ...p } });
  const letters = lang === 'fr' ? LETTERS_FR : LETTERS_EN;
  const names = lang === 'fr' ? NAMES_FR : NAMES_EN;

  function toggleDay(day: number) {
    const next = draft.workDays.includes(day) ? draft.workDays.filter((d) => d !== day) : [...draft.workDays, day];
    patch({ workDays: next.sort((a, b) => a - b) });
  }

  async function save() {
    const weekly = parseNum(draft.weeklyHours);
    if (weekly === null || weekly < 0 || weekly > 100) {
      toast(t('Heures par semaine : entre 0 et 100.', 'Weekly hours: between 0 and 100.'), 'err');
      return;
    }
    if (draft.workDays.length === 0) {
      toast(t('Choisissez au moins un jour travaillé.', 'Pick at least one work day.'), 'err');
      return;
    }
    const costText = draft.costRate.trim();
    const cost = costText === '' ? null : parseNum(costText);
    if (costText !== '' && (cost === null || cost < 0 || cost > 100_000_000)) {
      toast(t('Taux de coût invalide.', 'Invalid cost rate.'), 'err');
      return;
    }
    setBusy(true);
    try {
      const fields = { title: draft.title.trim(), weeklyHours: weekly, workDays: draft.workDays };
      const existing = await staff.get(user.id);
      if (existing) await staff.update(user.id, fields);
      else await staff.insert({ id: user.id, ...fields });

      // Empty cost rate = no rate on record.
      const existingRate = await rates.get(user.id);
      if (cost === null) {
        if (existingRate) await rates.remove(user.id);
      } else if (existingRate) {
        await rates.update(user.id, { costRate: cost });
      } else {
        await rates.insert({ id: user.id, costRate: cost });
      }
      toast(t('Enregistré.', 'Saved.'));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        <div className="row" style={{ gap: 10 }}>
          <Avatar name={user.displayName} size={28} />
          <div>
            <div>{user.displayName}</div>
            <div className="small faint mono">{user.username}</div>
          </div>
        </div>
      </td>
      <td>
        <input className="input" style={{ minWidth: 160 }} maxLength={120} value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
      </td>
      <td className="num">
        <input
          className="input"
          style={{ width: 90, textAlign: 'right' }}
          inputMode="decimal"
          aria-label={t('Heures par semaine', 'Hours per week')}
          value={draft.weeklyHours}
          onChange={(e) => patch({ weeklyHours: e.target.value })}
        />
      </td>
      <td>
        <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const on = draft.workDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                title={names[day - 1]}
                className={`btn btn-sm ${on ? 'btn-primary' : 'btn-ghost'}`}
                style={{ width: 28, minWidth: 0, padding: '4px 0' }}
                onClick={() => toggleDay(day)}
              >
                {letters[day - 1]}
              </button>
            );
          })}
        </div>
      </td>
      <td className="num">
        <input
          className="input"
          style={{ width: 110, textAlign: 'right' }}
          inputMode="decimal"
          placeholder="—"
          aria-label={t('Taux de coût ($/h)', 'Cost rate ($/h)')}
          value={draft.costRate}
          onChange={(e) => patch({ costRate: e.target.value })}
        />
      </td>
      <td className="num">{fmtHours(hours)}</td>
      <td>
        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
          {dirty && (
            <button className="btn btn-sm btn-ghost" onClick={() => setEdit(null)} disabled={busy}>
              {t('Annuler', 'Cancel')}
            </button>
          )}
          <button className="btn btn-sm btn-primary" onClick={save} disabled={!dirty || busy}>
            {t('Enregistrer', 'Save')}
          </button>
        </div>
      </td>
    </tr>
  );
}
