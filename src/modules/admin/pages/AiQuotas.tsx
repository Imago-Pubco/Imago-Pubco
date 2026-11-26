import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { API_MODE, api, useCollection } from '@/data/db';
import { users } from '@/data/stores';
import { useI18n } from '@/i18n';
import { Page } from '@/components/Page';
import { PageHeader, useToast } from '@/components/ui';

/* ---------- contract (server/aiUsage.ts) ---------- */

type Limit = { maxTokens?: number; maxCalls?: number };
interface Quotas {
  org: Limit;
  defaultUser: Limit;
  perUser: Record<string, Limit>;
}
interface Counter {
  calls: number;
  input: number;
  output: number;
}
interface Snapshot {
  month: string;
  current: { org: Counter; users: Record<string, Counter>; features: Record<string, Counter> };
  history: { month: string; calls: number; input: number; output: number }[];
}
interface UsageResponse extends Snapshot {
  quotas: Quotas;
}

const SYSTEM = 'system';
const STORE_KEY = 'imago:ai.quotas';
const EMPTY: Counter = { calls: 0, input: 0, output: 0 };
const FEATURES = [
  { key: 'sales.request', fr: 'Demandes de vente', en: 'Sales requests' },
  { key: 'sales.image', fr: 'Analyse d’image', en: 'Image analysis' },
  { key: 'accounting.invoice', fr: 'Lecture de factures', en: 'Invoice reading' },
  { key: 'assistant', fr: 'Assistant d’aide', en: 'Help assistant' },
] as const;

/* ---------- demo data (browser backend, no server) ---------- */

const DEFAULT_QUOTAS: Quotas = {
  org: { maxTokens: 5_000_000, maxCalls: 5_000 },
  defaultUser: { maxTokens: 250_000, maxCalls: 300 },
  perUser: {},
};
/** Demo usage, assigned to the users in list order. */
const DEMO_USERS: Counter[] = [
  { calls: 412, input: 210_000, output: 58_000 },
  { calls: 233, input: 128_000, output: 34_000 },
  { calls: 97, input: 61_000, output: 15_000 },
  { calls: 18, input: 9_000, output: 2_400 },
];
const DEMO_SYSTEM: Counter = { calls: 524, input: 900_000, output: 183_000 };
const DEMO_FEATURES: Record<string, Counter> = {
  'sales.request': { calls: 812, input: 1_000_000, output: 220_000 },
  'sales.image': { calls: 233, input: 180_000, output: 40_000 },
  assistant: { calls: 142, input: 210_000, output: 38_000 },
  'accounting.invoice': { calls: 239, input: 130_000, output: 30_400 },
};
/** Tokens of the 11 months before the current one, oldest first. */
const DEMO_PAST_TOKENS = [900_000, 1_100_000, 1_000_000, 1_300_000, 1_200_000, 1_400_000, 1_500_000, 1_300_000, 1_600_000, 1_400_000, 1_200_000];

const tokensOf = (c?: Counter) => (c ? c.input + c.output : 0);
const currentMonth = () => new Date().toISOString().slice(0, 7);

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym: string, locale: string, long: boolean) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, long ? { month: 'long', year: 'numeric' } : { month: 'short' });
}

function demoSnapshot(userIds: string[]): Snapshot {
  const month = currentMonth();
  const byUser: Record<string, Counter> = {};
  userIds.forEach((id, i) => (byUser[id] = DEMO_USERS[i % DEMO_USERS.length]));
  byUser[SYSTEM] = DEMO_SYSTEM;
  const org = Object.values(byUser).reduce<Counter>((a, c) => ({ calls: a.calls + c.calls, input: a.input + c.input, output: a.output + c.output }), { ...EMPTY });
  const past = DEMO_PAST_TOKENS.slice()
    .reverse()
    .map((tok, k) => {
      const input = Math.round(tok * 0.82);
      return { month: shiftMonth(month, -(k + 1)), calls: Math.round(tok / 1100), input, output: tok - input };
    });
  return {
    month,
    current: { org, users: byUser, features: DEMO_FEATURES },
    history: [{ month, ...org }, ...past],
  };
}

function readDemoQuotas(): Quotas {
  try {
    const q = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Quotas | null;
    if (q && q.org && q.defaultUser && q.perUser) return q;
  } catch {
    /* unreadable: defaults */
  }
  return DEFAULT_QUOTAS;
}

function writeDemoQuotas(q: Quotas) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(q));
  } catch {
    /* storage blocked: the change stays on screen only */
  }
}

/* ---------- form state: every input is a string, so partial input is representable ---------- */

type Vals = Record<string, string>;
const FIELDS = ['maxTokens', 'maxCalls'] as const;

/** Keys: `org.<field>`, `def.<field>`, `u:<userId>.<field>`. */
function valsFrom(q: Quotas): Vals {
  const v: Vals = {};
  const put = (prefix: string, l: Limit) => {
    for (const f of FIELDS) v[`${prefix}.${f}`] = l[f] === undefined ? '' : String(l[f]);
  };
  put('org', q.org);
  put('def', q.defaultUser);
  for (const [id, l] of Object.entries(q.perUser)) put(`u:${id}`, l);
  return v;
}

/** Turns the form strings into a quotas object. Empty = left out (inherit / unlimited). */
function quotasFrom(v: Vals): { quotas: Quotas; invalid: Record<string, true> } {
  const invalid: Record<string, true> = {};
  const read = (prefix: string): Limit => {
    const out: Limit = {};
    for (const f of FIELDS) {
      const key = `${prefix}.${f}`;
      const raw = (v[key] ?? '').replace(/\s/g, '');
      if (raw === '') continue;
      const n = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n)) {
        invalid[key] = true;
        continue;
      }
      out[f] = n;
    }
    return out;
  };
  const ids = new Set(Object.keys(v).filter((k) => k.startsWith('u:')).map((k) => k.slice(2, k.lastIndexOf('.'))));
  const perUser: Record<string, Limit> = {};
  for (const id of [...ids].sort()) {
    const l = read(`u:${id}`);
    if (l.maxTokens !== undefined || l.maxCalls !== undefined) perUser[id] = l;
  }
  return { quotas: { org: read('org'), defaultUser: read('def'), perUser }, invalid };
}

/** Effective limit of a user: own entry field by field over the default. Undefined = unlimited. */
function effective(q: Quotas, id: string): Limit {
  if (id === SYSTEM) return {};
  const own = q.perUser[id] ?? {};
  return { maxTokens: own.maxTokens ?? q.defaultUser.maxTokens, maxCalls: own.maxCalls ?? q.defaultUser.maxCalls };
}

const ratio = (used: number, limit?: number) => (limit ? used / limit : undefined);
const level = (r: number) => (r >= 1 ? 'err' : r >= 0.8 ? 'warn' : 'ok');

/* ---------- small pieces ---------- */

function Bar({ value, label }: { value?: number; label: string }) {
  if (value === undefined) return null;
  const pct = Math.min(100, Math.round(value * 100));
  return (
    <div className={`ai-bar ${level(value)}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${pct} %`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

function AiKpi({ label, value, hint, ratio: r }: { label: string; value: string; hint?: string; ratio?: number }) {
  return (
    <div className="kpi card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
      <Bar value={r} label={label} />
    </div>
  );
}

function LimitInput({
  id,
  label,
  compact,
  value,
  placeholder,
  invalid,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  compact?: boolean;
  value: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const { t } = useI18n();
  const input = (
    <input
      id={id}
      className={compact ? 'input input-sm' : 'input'}
      inputMode="numeric"
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={compact ? label : undefined}
      aria-invalid={invalid || undefined}
      style={compact ? { width: 120 } : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  if (compact) return input;
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {input}
      {invalid && <span className="small" style={{ color: 'var(--err)' }}>{t('Entier positif ou 0 requis', 'Whole number, zero or more, required')}</span>}
    </label>
  );
}

function HistoryChart({ data, locale, label }: { data: Snapshot['history']; locale: string; label: string }) {
  const { t, fmtNum } = useI18n();
  const W = 640;
  const H = 220;
  const items = data.slice(0, 12).reverse();
  const max = Math.max(1, ...items.map((i) => tokensOf(i)));
  const bw = W / Math.max(items.length, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="ai-chart">
      {items.map((it, i) => {
        const tok = tokensOf(it);
        const h = ((H - 40) * tok) / max;
        const x = i * bw + bw * 0.18;
        const w = bw * 0.64;
        return (
          <g key={it.month}>
            <rect x={x} y={H - 26 - h} width={w} height={h} rx={3} style={{ fill: 'var(--accent)' }}>
              <title>{`${monthLabel(it.month, locale, true)} : ${fmtNum(tok)} ${t('jetons', 'tokens')}`}</title>
            </rect>
            <text x={x + w / 2} y={H - 8} textAnchor="middle" className="ai-chart-label">
              {monthLabel(it.month, locale, false)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- page ---------- */

export function AiQuotas() {
  const { t, lang, fmtNum } = useI18n();
  const toast = useToast();
  const { rows: userRows } = useCollection(users);
  const [server, setServer] = useState<UsageResponse | null>(null);
  const [quotas, setQuotas] = useState<Quotas | null>(null);
  const [vals, setVals] = useState<Vals>({});
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
  const shortNum = (n: number) =>
    n >= 1e6 ? `${(n / 1e6).toLocaleString(locale, { maximumFractionDigits: 1 })} M` : n >= 1e3 ? `${(n / 1e3).toLocaleString(locale, { maximumFractionDigits: 1 })} k` : fmtNum(n);
  const pctText = (r?: number) => (r === undefined ? '' : `${Math.round(r * 100)} %`);

  const fetchUsage = () =>
    api<UsageResponse>('/ai/usage').then((r) => {
      setServer(r);
      return r;
    });

  useEffect(() => {
    if (!API_MODE) {
      const q = readDemoQuotas();
      setQuotas(q);
      setVals(valsFrom(q));
      return;
    }
    let alive = true;
    api<UsageResponse>('/ai/usage').then(
      (r) => {
        if (!alive) return;
        setServer(r);
        setQuotas(r.quotas);
        setVals(valsFrom(r.quotas));
      },
      (e: unknown) => {
        if (alive) setLoadError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const demo = useMemo(() => demoSnapshot(userRows.map((u) => u.id)), [userRows]);
  const snap = API_MODE ? server : demo;
  const parsed = useMemo(() => quotasFrom(vals), [vals]);
  const savedKey = useMemo(() => (quotas ? JSON.stringify(quotasFrom(valsFrom(quotas)).quotas) : ''), [quotas]);
  const dirty = !!quotas && JSON.stringify(parsed.quotas) !== savedKey;
  const invalid = Object.keys(parsed.invalid).length > 0;
  const setVal = (key: string, value: string) => setVals((s) => ({ ...s, [key]: value }));
  const hasOverride = (id: string) => !!(vals[`u:${id}.maxTokens`] || vals[`u:${id}.maxCalls`]);
  const resetUser = (id: string) => setVals((s) => ({ ...s, [`u:${id}.maxTokens`]: '', [`u:${id}.maxCalls`]: '' }));

  const save = async () => {
    if (!dirty || invalid) return;
    setSaving(true);
    try {
      const body = parsed.quotas;
      let saved: Quotas;
      if (API_MODE) {
        saved = await api<Quotas>('/ai/quotas', { method: 'PUT', body });
      } else {
        writeDemoQuotas(body);
        saved = body;
      }
      setQuotas(saved);
      setVals(valsFrom(saved));
      toast(t('Quotas enregistrés', 'Quotas saved'));
    } catch (e) {
      toast(`${t('Enregistrement impossible : ', 'Could not save: ')}${e instanceof Error ? e.message : String(e)}`, 'err');
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <PageHeader
      eyebrow={t('Administration', 'Administration')}
      title={t('IA et quotas', 'AI & quotas')}
      subtitle={t('Consommation et plafonds des appels aux API OpenAI et Claude de l’entreprise.', 'Usage and caps for the company’s OpenAI and Claude API calls.')}
      actions={
        <>
          {!API_MODE && <span className="badge badge-warn">{t('Données de démonstration', 'Demo data')}</span>}
          {API_MODE && (
            <button className="btn btn-ghost btn-sm" onClick={() => fetchUsage().catch((e: unknown) => toast(e instanceof Error ? e.message : String(e), 'err'))}>
              {t('Actualiser', 'Refresh')}
            </button>
          )}
        </>
      }
    />
  );

  if (!quotas || !snap) {
    return (
      <Page>
        {header}
        {loadError ? <div className="alert alert-err">{loadError}</div> : <div className="card card-pad muted">{t('Chargement…', 'Loading…')}</div>}
      </Page>
    );
  }

  const cur = snap.current;
  const q = quotas;
  const orgTok = tokensOf(cur.org);
  const orgTokR = ratio(orgTok, q.org.maxTokens);
  const orgCallR = ratio(cur.org.calls, q.org.maxCalls);
  const remTok = q.org.maxTokens ? Math.max(0, q.org.maxTokens - orgTok) : undefined;
  const remCalls = q.org.maxCalls ? Math.max(0, q.org.maxCalls - cur.org.calls) : undefined;
  const monthName = monthLabel(snap.month, locale, true);

  const people = [
    ...userRows.map((u) => ({ id: u.id, label: u.displayName || u.username })).sort((a, b) => a.label.localeCompare(b.label)),
    { id: SYSTEM, label: t('Système (formulaire public, boîte courriel)', 'System (public form, mailbox)') },
  ];

  return (
    <Page>
      {header}

      <div className="kpis">
        <AiKpi
          label={t('Jetons de l’organisation', 'Organisation tokens')}
          value={shortNum(orgTok)}
          hint={q.org.maxTokens ? `${t('sur', 'of')} ${shortNum(q.org.maxTokens)} · ${pctText(orgTokR)}` : t('Illimité', 'Unlimited')}
          ratio={orgTokR}
        />
        <AiKpi
          label={t('Demandes ce mois', 'Requests this month')}
          value={fmtNum(cur.org.calls)}
          hint={q.org.maxCalls ? `${t('sur', 'of')} ${fmtNum(q.org.maxCalls)} · ${pctText(orgCallR)}` : t('Illimité', 'Unlimited')}
          ratio={orgCallR}
        />
        <AiKpi
          label={t('Restant', 'Remaining')}
          value={remTok === undefined ? t('Illimité', 'Unlimited') : `${shortNum(remTok)} ${t('jetons', 'tokens')}`}
          hint={remCalls === undefined ? t('Demandes : illimitées', 'Requests: unlimited') : `${fmtNum(remCalls)} ${t('demandes restantes', 'requests left')}`}
        />
        <AiKpi label={t('Mois en cours', 'Current month')} value={monthName.charAt(0).toUpperCase() + monthName.slice(1)} hint={t('Compteurs remis à zéro le 1er', 'Counters reset on the 1st')} />
      </div>

      <section className="card card-pad stack" style={{ marginTop: 16 }}>
        <div className="row row-wrap">
          <h3>{t('Limites mensuelles', 'Monthly limits')}</h3>
          <span className="spacer" />
          {dirty && !invalid && <span className="ai-unsaved">{t('Modifications non enregistrées', 'Unsaved changes')}</span>}
          {invalid && <span className="small" style={{ color: 'var(--err)' }}>{t('Corrigez les valeurs en rouge', 'Fix the values in red')}</span>}
        </div>
        <div className="ai-two">
          <div className="stack" style={{ gap: 10 }}>
            <strong>{t('Organisation', 'Organisation')}</strong>
            <div className="form-grid">
              <LimitInput id="ai-org-tokens" label={t('Jetons par mois', 'Tokens per month')} value={vals['org.maxTokens'] ?? ''} invalid={!!parsed.invalid['org.maxTokens']} onChange={(v) => setVal('org.maxTokens', v)} />
              <LimitInput id="ai-org-calls" label={t('Demandes par mois', 'Requests per month')} value={vals['org.maxCalls'] ?? ''} invalid={!!parsed.invalid['org.maxCalls']} onChange={(v) => setVal('org.maxCalls', v)} />
            </div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <strong>{t('Par utilisateur (défaut)', 'Per user (default)')}</strong>
            <div className="form-grid">
              <LimitInput id="ai-def-tokens" label={t('Jetons par mois', 'Tokens per month')} value={vals['def.maxTokens'] ?? ''} invalid={!!parsed.invalid['def.maxTokens']} onChange={(v) => setVal('def.maxTokens', v)} />
              <LimitInput id="ai-def-calls" label={t('Demandes par mois', 'Requests per month')} value={vals['def.maxCalls'] ?? ''} invalid={!!parsed.invalid['def.maxCalls']} onChange={(v) => setVal('def.maxCalls', v)} />
            </div>
          </div>
        </div>
        <div className="ai-hint">
          <span>{t('0 = illimité', '0 = unlimited')}</span> · <span>{t('vide = hérite', 'empty = inherit')}</span>
        </div>
        <div className="row row-wrap">
          <button className="btn btn-primary" onClick={save} disabled={!dirty || invalid || saving}>
            <Save size={16} /> {saving ? t('Enregistrement…', 'Saving…') : t('Enregistrer', 'Save')}
          </button>
        </div>
      </section>

      <section className="card card-pad stack" style={{ marginTop: 16 }}>
        <div className="row row-wrap">
          <h3>{t('Utilisation par personne', 'Usage by person')}</h3>
          <span className="spacer" />
          <span className="ai-hint">{t('Plafond personnel : vide = hérite du défaut', 'Personal cap: empty = inherit the default')}</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('Utilisateur', 'User')}</th>
                <th scope="col" className="num">{t('Demandes', 'Requests')}</th>
                <th scope="col" className="num">{t('Jetons', 'Tokens')}</th>
                <th scope="col">{t('Par rapport à la limite', 'Against the limit')}</th>
                <th scope="col">{t('Jetons (perso)', 'Tokens (own)')}</th>
                <th scope="col">{t('Demandes (perso)', 'Requests (own)')}</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const c = cur.users[p.id] ?? EMPTY;
                const tok = tokensOf(c);
                const eff = effective(q, p.id);
                const worst = [ratio(tok, eff.maxTokens), ratio(c.calls, eff.maxCalls)].filter((x): x is number => x !== undefined);
                const bar = worst.length ? Math.max(...worst) : undefined;
                const isSystem = p.id === SYSTEM;
                const keyT = `u:${p.id}.maxTokens`;
                const keyC = `u:${p.id}.maxCalls`;
                const idSafe = p.id.replace(/[^a-zA-Z0-9]+/g, '-');
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.label}</strong>
                    </td>
                    <td className="num">{fmtNum(c.calls)}</td>
                    <td className="num">{fmtNum(tok)}</td>
                    <td style={{ minWidth: 160 }}>
                      {isSystem ? (
                        <span className="faint small">{t('Limite de l’organisation', 'Organisation limit only')}</span>
                      ) : bar === undefined ? (
                        <span className="faint small">{t('Illimité', 'Unlimited')}</span>
                      ) : (
                        <>
                          <Bar value={bar} label={`${p.label}: ${pctText(bar)}`} />
                          <span className="small faint">{pctText(bar)}</span>
                        </>
                      )}
                    </td>
                    <td>
                      {isSystem ? (
                        <span className="faint">—</span>
                      ) : (
                        <LimitInput
                          id={`ai-u-${idSafe}-tokens`}
                          label={`${p.label} — ${t('jetons', 'tokens')}`}
                          compact
                          value={vals[keyT] ?? ''}
                          placeholder={t('hérite', 'inherit')}
                          invalid={!!parsed.invalid[keyT]}
                          onChange={(v) => setVal(keyT, v)}
                        />
                      )}
                    </td>
                    <td>
                      {isSystem ? (
                        <span className="faint">—</span>
                      ) : (
                        <LimitInput
                          id={`ai-u-${idSafe}-calls`}
                          label={`${p.label} — ${t('demandes', 'requests')}`}
                          compact
                          value={vals[keyC] ?? ''}
                          placeholder={t('hérite', 'inherit')}
                          invalid={!!parsed.invalid[keyC]}
                          onChange={(v) => setVal(keyC, v)}
                        />
                      )}
                    </td>
                    <td>
                      {!isSystem && (
                        <button className="btn btn-ghost btn-sm" onClick={() => resetUser(p.id)} disabled={!hasOverride(p.id)}>
                          <RotateCcw size={14} /> {t('Réinitialiser', 'Reset')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="ai-two" style={{ marginTop: 16 }}>
        <section className="card card-pad stack">
          <h3>{t('Par fonctionnalité', 'By feature')}</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('Fonctionnalité', 'Feature')}</th>
                  <th scope="col" className="num">{t('Demandes', 'Requests')}</th>
                  <th scope="col" className="num">{t('Jetons', 'Tokens')}</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((f) => {
                  const c = cur.features[f.key] ?? EMPTY;
                  return (
                    <tr key={f.key}>
                      <td>{t(f.fr, f.en)}</td>
                      <td className="num">{fmtNum(c.calls)}</td>
                      <td className="num">{fmtNum(tokensOf(c))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card card-pad stack">
          <h3>{t('Historique (jetons, 12 mois)', 'History (tokens, 12 months)')}</h3>
          <HistoryChart data={snap.history} locale={locale} label={t('Jetons par mois, 12 derniers mois', 'Tokens per month, last 12 months')} />
        </section>
      </div>

      <section className="card card-pad stack small muted" style={{ marginTop: 16, gap: 4 }}>
        <p style={{ margin: 0 }}>{t('Le quota s’applique aux appels IA de ventes et de comptabilité.', 'The quota applies to AI calls for sales and accounting.')}</p>
        <p style={{ margin: 0 }}>{t('Un appel démarré juste sous la limite peut la dépasser légèrement.', 'A call started just under the limit may exceed it slightly.')}</p>
      </section>
    </Page>
  );
}
