import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Link2, RefreshCw, Save, Search, Users } from 'lucide-react';
import { api, useCollection } from '@/data/db';
import { users } from '@/data/stores';
import type { User } from '@/data/types';
import { useI18n } from '@/i18n';
import { Empty, useToast } from '@/components/ui';
import { errorText, labelOf } from './Settings.types';

const BASE = '/tools/kpi/data';

/* ---------------- Server contract ---------------- */

type Choice = 'auto' | 'none' | 'user';

interface PersonRef {
  id: string;
  displayName: string;
}

interface PersonRow {
  name: string;
  email: string;
  title: string;
  choice: Choice;
  userId: string | null;
  suggested: PersonRef | null;
  effective: PersonRef | null;
  counts: { kpis: number; priorities: number; tasks: number; huddles: number; checkins: number };
  pending: boolean;
}

interface PeopleResponse {
  people: PersonRow[];
  lastSyncedAt: string | null;
  pending: number;
}

interface SyncResponse {
  updated: Record<string, number>;
  inserted: Record<string, number>;
  people: number;
}

/* ---------------- Local draft ---------------- */

/** Draft value per person name: 'auto', 'none', or an Imago user id (the select value). */
type Draft = Record<string, string>;

type Busy = '' | 'save' | 'sync';

type Translate = ReturnType<typeof useI18n>['t'];

/** The select value that matches the loaded state of a person. */
const choiceValue = (p: PersonRow): string => (p.choice === 'user' ? (p.userId ?? 'none') : p.choice);

const draftFrom = (people: PersonRow[]): Draft => Object.fromEntries(people.map((p) => [p.name, choiceValue(p)]));

const draftValue = (draft: Draft, p: PersonRow): string => draft[p.name] ?? 'auto';

const isChanged = (draft: Draft, p: PersonRow): boolean => draftValue(draft, p) !== choiceValue(p);

/** Complete explicit choices for the server: absent = automatic, null = no account, string = user id. */
function buildMap(people: PersonRow[], draft: Draft): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const p of people) {
    const v = draftValue(draft, p);
    if (v === 'auto') continue;
    map[p.name] = v === 'none' ? null : v;
  }
  return map;
}

/* ---------------- Helpers ---------------- */

/** Unassociated first, then by name. Sorted on the loaded state so rows do not jump while editing. */
function sortPeople(a: PersonRow, b: PersonRow): number {
  const ra = a.effective ? 1 : 0;
  const rb = b.effective ? 1 : 0;
  if (ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name, 'fr');
}

function usageLine(c: PersonRow['counts'], t: Translate, fmtNum: (n: number) => string): string {
  const parts: { n: number; fr: string; en: string }[] = [
    { n: c.kpis, fr: 'indicateurs', en: 'indicators' },
    { n: c.priorities, fr: 'priorités', en: 'priorities' },
    { n: c.tasks, fr: 'tâches', en: 'tasks' },
    { n: c.huddles, fr: 'huddles', en: 'huddles' },
    { n: c.checkins, fr: 'bilans', en: 'check-ins' },
  ];
  const shown = parts.filter((p) => p.n > 0).map((p) => `${fmtNum(p.n)} ${t(p.fr, p.en)}`);
  return shown.length > 0 ? shown.join(' · ') : '—';
}

function statusOf(p: PersonRow, t: Translate): { label: string; cls: string } {
  if (p.pending) return { label: t('À synchroniser', 'To sync'), cls: 'badge badge-info' };
  if (p.effective) return { label: t('Associé', 'Linked'), cls: 'badge badge-ok' };
  return { label: t('Non associé', 'Not linked'), cls: 'badge badge-warn' };
}

/* ---------------- Person select ---------------- */

interface PersonSelectProps {
  person: PersonRow;
  value: string;
  activeUsers: User[];
  disabled: boolean;
  onPick: (name: string, value: string) => void;
}

function PersonSelect({ person, value, activeUsers, disabled, onPick }: PersonSelectProps) {
  const { t } = useI18n();
  const autoLabel = person.suggested
    ? t(`Automatique (suggestion : ${person.suggested.displayName})`, `Automatic (suggestion: ${person.suggested.displayName})`)
    : t('Automatique (aucune suggestion)', 'Automatic (no suggestion)');
  // Keep a linked user visible even when that account is now inactive.
  const isActive = activeUsers.some((u) => u.id === value);
  const orphanRef = [person.effective, person.suggested].find((r) => r?.id === value);
  const orphanLabel = orphanRef ? `${orphanRef.displayName} (${t('inactif', 'inactive')})` : value;

  return (
    <select
      className="select"
      aria-label={t(`Compte Imago pour ${person.name}`, `Imago account for ${person.name}`)}
      value={value}
      disabled={disabled}
      onChange={(e) => onPick(person.name, e.target.value)}
      style={{ minWidth: 240 }}
    >
      <option value="auto">{autoLabel}</option>
      <option value="none">{t('Aucun compte / ignorer', 'No account / ignore')}</option>
      {activeUsers.map((u) => (
        <option key={u.id} value={u.id}>
          {`${u.displayName} (${u.username})`}
        </option>
      ))}
      {!isActive && value !== 'auto' && value !== 'none' && <option value={value}>{orphanLabel}</option>}
    </select>
  );
}

/* ---------------- Sync result ---------------- */

function SyncResultPanel({ result, onClose }: { result: SyncResponse; onClose: () => void }) {
  const { t, fmtNum } = useI18n();
  const keys = Array.from(new Set([...Object.keys(result.updated), ...Object.keys(result.inserted)]));
  return (
    <div className="card card-pad stack">
      <div className="row">
        <CheckCircle2 size={20} color="var(--ok)" />
        <h3>{t(`${fmtNum(result.people)} personne(s) synchronisée(s)`, `${fmtNum(result.people)} person(s) synchronised`)}</h3>
        <span className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          {t('Fermer', 'Close')}
        </button>
      </div>
      {keys.length > 0 ? (
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {keys.map((k) => (
            <li key={k}>
              {t(labelOf(k))} :{' '}
              {t(
                `${fmtNum(result.updated[k] ?? 0)} mis à jour · ${fmtNum(result.inserted[k] ?? 0)} ajouté(s)`,
                `${fmtNum(result.updated[k] ?? 0)} updated · ${fmtNum(result.inserted[k] ?? 0)} added`,
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          {t('Aucun élément à mettre à jour.', 'Nothing needed updating.')}
        </p>
      )}
    </div>
  );
}

/* ---------------- Card ---------------- */

/** Tools → KPI → Administration: links archived people (by name) to Imago accounts, then syncs the changed links. */
export function PeopleMatchCard({ onChanged }: { onChanged?: () => void }) {
  const { t, fmtDate, fmtNum } = useI18n();
  const toast = useToast();
  const { rows: userRows } = useCollection(users);
  const [data, setData] = useState<PeopleResponse | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<Busy>('');
  const [search, setSearch] = useState('');
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await api<PeopleResponse>(`${BASE}/people`);
      setData(res);
      setDraft(draftFrom(res.people));
      setLoadError('');
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const people = data?.people ?? [];
  const activeUsers = userRows.filter((u) => u.active).sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'));
  const dirty = people.some((p) => isChanged(draft, p));
  const locked = busy !== '';
  const pending = data?.pending ?? 0;

  const q = search.trim().toLowerCase();
  const visible = people
    .filter((p) => q === '' || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
    .sort(sortPeople);

  const suggestionsToAccept = people.filter((p) => draftValue(draft, p) === 'auto' && p.suggested !== null);

  const acceptSuggestions = () => {
    setDraft((d) => {
      const next = { ...d };
      for (const p of suggestionsToAccept) {
        if (p.suggested) next[p.name] = p.suggested.id;
      }
      return next;
    });
  };

  const pick = (name: string, value: string) => setDraft((d) => ({ ...d, [name]: value }));

  const save = async () => {
    setBusy('save');
    try {
      const res = await api<PeopleResponse>(`${BASE}/people`, {
        method: 'PUT',
        body: { map: buildMap(people, draft) },
      });
      setData(res);
      setDraft(draftFrom(res.people));
      toast(t('Correspondance enregistrée', 'Matching saved'));
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setBusy('');
    }
  };

  const runSync = async () => {
    setBusy('sync');
    try {
      const r = await api<SyncResponse>(`${BASE}/sync-people`, { method: 'POST' });
      setSyncResult(r);
      toast(t('Personnes synchronisées', 'People synchronised'));
      onChanged?.();
    } catch (e) {
      toast(errorText(e), 'err');
    } finally {
      setBusy('');
      await load();
    }
  };

  const syncTitle = dirty
    ? t('Enregistrez d’abord la correspondance', 'Save the matching first')
    : pending === 0
      ? t('Rien à synchroniser', 'Nothing to synchronise')
      : '';

  return (
    <div className="card card-pad stack">
      <div className="row">
        <Link2 size={20} color="var(--accent)" />
        <h3>{t('Correspondance des personnes (Align ↔ Imago)', 'People matching (Align ↔ Imago)')}</h3>
        <span className="spacer" />
        {data && (
          <span className="faint small">
            {t('Dernière synchronisation', 'Last sync')} : {data.lastSyncedAt ? fmtDate(data.lastSyncedAt, true) : '—'}
          </span>
        )}
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {t(
          'Les anciennes données désignent les personnes par leur nom. Associez chaque personne à un compte Imago, enregistrez, puis synchronisez : seules les personnes dont l’association a changé sont traitées. Rien de ce qui a été modifié dans l’application n’est écrasé, et aucune réimportation n’est nécessaire. Une personne sans compte peut rester non associée : ses données attendent dans l’archive.',
          'The old data refers to people by name. Link each person to an Imago account, save, then synchronise: only people whose link changed are processed. Nothing edited in the app is overwritten, and no re-import is needed. A person without an account can stay unlinked: their data waits in the archive.',
        )}
      </p>

      {loadError && (
        <div className="alert alert-err row-wrap" style={{ alignItems: 'center' }}>
          <span>{loadError}</span>
          <span className="spacer" />
          <button className="btn btn-sm" onClick={() => void load()}>
            {t('Réessayer', 'Retry')}
          </button>
        </div>
      )}

      {!data ? (
        !loadError && <p className="muted">{t('Chargement…', 'Loading…')}</p>
      ) : (
        <>
          <div className="row row-wrap">
            <label className="row" style={{ gap: 6, flex: '1 1 220px' }}>
              <Search size={16} color="var(--text-3)" />
              <input
                className="input"
                type="search"
                placeholder={t('Rechercher un nom ou un courriel', 'Search a name or e-mail')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1 }}
              />
            </label>
            <span className="spacer" />
            <div className="row row-wrap" style={{ gap: 6 }}>
              <span className="faint small">{t('Suggestions automatiques', 'Automatic suggestions')}</span>
              <button className="btn btn-sm" onClick={acceptSuggestions} disabled={locked || suggestionsToAccept.length === 0}>
                {t('Accepter toutes les suggestions', 'Accept all suggestions')}
                {suggestionsToAccept.length > 0 ? ` (${fmtNum(suggestionsToAccept.length)})` : ''}
              </button>
            </div>
          </div>

          <div className="row row-wrap">
            <button className="btn btn-primary" onClick={() => void save()} disabled={locked || !dirty}>
              <Save size={16} /> {t('Enregistrer la correspondance', 'Save matching')}
            </button>
            <button
              className="btn"
              onClick={() => void runSync()}
              disabled={locked || dirty || pending === 0}
              title={syncTitle}
            >
              <RefreshCw size={16} />{' '}
              {pending > 0
                ? t(`Synchroniser les personnes associées (${fmtNum(pending)})`, `Sync associated people (${fmtNum(pending)})`)
                : t('Synchroniser les personnes associées', 'Sync associated people')}
            </button>
            {dirty && (
              <span className="small" style={{ color: 'var(--warn)' }}>
                {t('Modifications non enregistrées', 'Unsaved changes')}
              </span>
            )}
          </div>

          {busy && <div className="alert alert-info">{busy === 'save' ? t('Enregistrement…', 'Saving…') : t('Synchronisation en cours…', 'Synchronising…')}</div>}

          {syncResult && <SyncResultPanel result={syncResult} onClose={() => setSyncResult(null)} />}

          {people.length === 0 ? (
            <Empty icon={<Users size={32} />} title={t('Aucune personne archivée', 'No archived people')}>
              {t('Chargez l’archive pour voir les personnes à associer.', 'Load the archive to see the people to link.')}
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Personne (Align)', 'Person (Align)')}</th>
                    <th>{t('Utilisation', 'Usage')}</th>
                    <th>{t('Compte Imago', 'Imago account')}</th>
                    <th>{t('Statut', 'Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={4} className="faint small">
                        {t('Aucun résultat.', 'No results.')}
                      </td>
                    </tr>
                  )}
                  {visible.map((p) => {
                    const status = statusOf(p, t);
                    const changed = isChanged(draft, p);
                    return (
                      <tr key={p.name}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <div className="faint small">
                            {[p.email, p.title].filter((x) => x !== '').join(' · ') || '—'}
                          </div>
                        </td>
                        <td className="small">{usageLine(p.counts, t, fmtNum)}</td>
                        <td>
                          <PersonSelect
                            person={p}
                            value={draftValue(draft, p)}
                            activeUsers={activeUsers}
                            disabled={locked}
                            onPick={pick}
                          />
                          {changed && (
                            <div className="faint small" style={{ marginTop: 2 }}>
                              {t('modifié', 'changed')}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={status.cls}>{status.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="faint small" style={{ margin: 0 }}>
            {t(
              'La synchronisation n’applique que les liens modifiés depuis la dernière synchronisation.',
              'Synchronisation only applies links changed since the last sync.',
            )}
          </p>
        </>
      )}
    </div>
  );
}
