/**
 * Turns the archived Align export (src/modules/tools/archive.ts) into documents of the KPI collections.
 * Pure function: no database access. People and teams are referenced by name in the archive and mapped to
 * Imago users here; anything that cannot be mapped is kept as text or skipped, and reported.
 */
import { createHash } from 'node:crypto';
import type { AlignArchive } from '../src/modules/tools/archive.ts';
import { monthStart, mondayOf, parseDate, iso } from '../src/modules/tools/lib.ts';
import { PERSONAL_SECTIONS, TEAM_SECTIONS, TOOLS_SCHEMAS } from '../src/modules/tools/schemas.ts';

export type KpiData = Record<keyof typeof TOOLS_SCHEMAS, Record<string, unknown>[]>;
export const KPI_COLLECTIONS = Object.keys(TOOLS_SCHEMAS) as (keyof typeof TOOLS_SCHEMAS)[];

export interface ImportUser {
  id: string;
  displayName: string;
  username: string;
  email: string;
  active: boolean;
}

export interface ImportReport {
  counts: Record<string, number>;
  /** Names found in the archive that match no Imago user (their owner/member links are left empty). */
  unmatchedPeople: string[];
  /** Documents refused by the schemas, per collection. */
  invalid: Record<string, number>;
  notes: string[];
}

export const emptyData = (): KpiData => Object.fromEntries(KPI_COLLECTIONS.map((c) => [c, []])) as unknown as KpiData;

const COLORS = ['#1e6fd9', '#2e9e5b', '#e07a10', '#7b4fd6', '#d6336c', '#0ea5c6', '#da291c', '#5b6b82'];

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const slug = (s: string) => fold(s).replace(/ /g, '-').slice(0, 40) || 'x';
const short = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 6);
const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

/** Words of a name, order-free: "Bâ Mairame" and "Mairame Bâ" are the same person. */
const nameKey = (s: string) => fold(s).split(' ').filter(Boolean).sort().join(' ');

/** Metrics whose NAME STARTS with a cost-type word are "lower is better" (a name that merely mentions a cost, e.g. "Projets terminés avec coût et marge validés", is not). */
const DOWN = /^\s*(co[uû]ts?|[ée]carts?|taux de rejets?|rejets?|retards?|d[ée]passements?|mod r[ée]elle|defects?|scrap|waste|overtime)\b/i;

/** Every person name the archive refers to (the people list and every owner, member, task owner and check-in author). */
export function referencedNames(archive: AlignArchive): string[] {
  const names = new Set<string>(archive.people.map((p) => p.name));
  const add = (n: string | null | undefined) => n && names.add(n);
  for (const t of archive.teams) {
    add(t.owner);
    t.members.forEach(add);
  }
  for (const m of archive.metrics) add(m.owner);
  for (const p of archive.priorities) {
    add(p.owner);
    p.tasks.forEach((t) => add(t.owner));
  }
  for (const h of archive.huddles) {
    add(h.owner);
    h.members.forEach(add);
    h.entries.forEach((e) => add(e.person));
    h.tasks.forEach((t) => add(t.owner));
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Automatic matching of archived names to Imago users: by display name (accents, case and word order ignored), then by e-mail. */
export function makeMatcher(archive: AlignArchive, users: ImportUser[]): (name: string) => string | null {
  const byName = new Map<string, string>();
  const byEmail = new Map<string, string>();
  for (const u of users.filter((x) => x.active)) {
    byName.set(nameKey(u.displayName), u.id);
    if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
  }
  const emailOf = new Map(archive.people.filter((p) => p.email).map((p) => [nameKey(p.name), p.email!.toLowerCase()]));
  return (name) => byName.get(nameKey(name)) ?? (emailOf.get(nameKey(name)) ? byEmail.get(emailOf.get(nameKey(name))!) : undefined) ?? null;
}

/**
 * `overrides` are the administrator's explicit choices (name -> Imago user id, or null = "no account / ignore");
 * a name absent from it is matched automatically.
 */
export function buildKpiData(
  archive: AlignArchive,
  users: ImportUser[],
  actingUserId: string,
  overrides: Record<string, string | null> = {},
): { data: KpiData; report: ImportReport } {
  const data = emptyData();
  const report: ImportReport = { counts: {}, unmatchedPeople: [], invalid: {}, notes: [] };
  const unmatched = new Set<string>();

  const matcher = makeMatcher(archive, users);
  const userOf = (name: string | null | undefined): string | null => {
    if (!name) return null;
    if (Object.prototype.hasOwnProperty.call(overrides, name)) return overrides[name]; // explicit choice (even "no account")
    const id = matcher(name);
    if (!id) unmatched.add(name);
    return id;
  };
  /** "Align owner" note appended when the owner has no Imago account yet (nothing is lost). */
  const ownerNote = (name: string | null, id: string | null) => (name && !id ? `\n\nResponsable (Align) : ${name}` : '');

  // ---- teams ----
  const teamId = new Map<string, string>();
  const ensureTeam = (name: string | null, members: string[] = [], owner: string | null = null): string | null => {
    if (!name) return null;
    const key = fold(name);
    if (!teamId.has(key)) {
      const id = `t_${slug(name)}`;
      teamId.set(key, id);
      data['tools.teams'].push({ id, name: clip(name, 80), description: '', color: COLORS[data['tools.teams'].length % COLORS.length], ownerId: userOf(owner) ?? actingUserId, memberIds: [], archived: false });
    }
    const id = teamId.get(key)!;
    const team = data['tools.teams'].find((t) => t.id === id)!;
    for (const m of members) {
      const uid = userOf(m);
      if (uid && !(team.memberIds as string[]).includes(uid)) (team.memberIds as string[]).push(uid);
    }
    return id;
  };
  for (const t of archive.teams) ensureTeam(t.name, t.members, t.owner);

  // ---- KPIs and their values ----
  const critical = new Set(archive.criticalNumbers.map(fold));
  const kpiIdByName = new Map<string, string>();
  archive.metrics.forEach((m, i) => {
    const id = `k_${slug(m.name)}_${short(m.name)}`;
    kpiIdByName.set(fold(m.name), id);
    const frequency = m.frequency === 'monthly' ? 'monthly' : 'weekly';
    const owner = userOf(m.owner);
    let description = m.description + ownerNote(m.owner, owner);
    if (m.frequency !== 'weekly' && m.frequency !== 'monthly') description += `\n\nFréquence dans Align : ${m.frequency}`;
    if (m.targetText && m.target === null) description += `\n\nCible (Align) : ${m.targetText}`;
    data['tools.kpis'].push({
      id,
      name: clip(m.name, 120),
      description: clip(description, 4000),
      unit: clip(m.unit, 12),
      frequency,
      direction: m.direction ?? (DOWN.test(m.name) ? 'down' : 'up'),
      target: m.target,
      ownerId: owner,
      teamId: ensureTeam(m.team),
      status: m.status,
      critical: critical.has(fold(m.name)),
      order: i,
    });
    const seen = new Map<string, Record<string, unknown>>();
    for (const v of m.values) {
      const period = frequency === 'monthly' ? monthStart(v.period) : mondayOf(v.period);
      seen.set(period, { id: `${id}_${period}`, kpiId: id, period, value: v.value, note: clip(v.note, 2000) });
    }
    data['tools.kpiValues'].push(...seen.values());
  });
  if (archive.metrics.some((m) => m.direction === null)) report.notes.push('Direction (higher/lower is better) was inferred from the name for metrics where Align does not state it: please review.');

  // ---- priorities, tasks, weekly updates ----
  const quarterStart = (() => {
    const d = parseDate(archive.exportedAt.slice(0, 10));
    return iso(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1));
  })();
  const quarterEnd = (() => {
    const d = parseDate(archive.exportedAt.slice(0, 10));
    return iso(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0));
  })();
  const priorityId = (title: string, start: string) => `p_${slug(title)}_${short(title + start)}`;
  archive.priorities.forEach((p, i) => {
    const start = p.periodStart ?? quarterStart;
    const end = p.periodEnd ?? quarterEnd;
    const id = priorityId(p.title, start);
    const owner = userOf(p.owner);
    const parent = p.parent ? priorityId(p.parent, start) : null;
    data['tools.priorities'].push({
      id,
      title: clip(p.title, 200),
      description: clip(p.description + ownerNote(p.owner, owner), 4000),
      ownerId: owner,
      teamId: ensureTeam(p.team),
      company: p.company,
      periodStart: start,
      periodEnd: end,
      parentId: parent,
      status: p.status ?? 'green',
      progress: p.progress,
      order: i,
      archived: p.archived,
    });
    p.tasks.forEach((t, n) => {
      const to = userOf(t.owner);
      data['tools.tasks'].push({
        id: `tk_${short(id + n)}`,
        title: clip(t.title + (t.owner && !to ? ` — ${t.owner}` : ''), 300),
        ownerId: to,
        dueDate: t.due,
        done: t.done,
        doneAt: t.done ? archive.exportedAt : null,
        priorityId: id,
        huddleId: null,
        week: null,
      });
    });
    for (const u of p.updates) {
      const week = mondayOf(u.week);
      data['tools.priorityUpdates'].push({ id: `${id}_${week}`, priorityId: id, week, progress: u.progress, status: u.status ?? 'green', note: clip(u.note, 2000) });
    }
  });

  // ---- huddles ----
  const teamMap: [RegExp, (typeof TEAM_SECTIONS)[number]][] = [
    [/agenda/i, 'agenda'],
    [/critical|critique/i, 'criticalNumbers'],
    [/performance|kpi|indicat/i, 'kpis'],
    [/priorit/i, 'priorities'],
    [/who what when|qui.*quoi|www/i, 'tasks'],
    [/parking/i, 'parking'],
    [/issue|enjeu/i, 'issues'],
  ];
  const personalMap: [RegExp, (typeof PERSONAL_SECTIONS)[number]][] = [
    [/what.?s up|quoi de neuf/i, 'whatsUp'],
    [/feedback|r[ée]troaction/i, 'feedback'],
    [/priority progress|progr[eè]s|progression/i, 'priorityProgress'],
    [/besoin|help/i, 'help'],
    [/stuck|blocage/i, 'stucks'],
  ];
  const mapSections = <T extends string>(labels: string[], map: [RegExp, T][], all: readonly T[]): T[] => {
    const out: T[] = [];
    for (const label of labels) {
      const hit = map.find(([re]) => re.test(label))?.[1];
      if (hit && !out.includes(hit)) out.push(hit);
    }
    return out.length ? out : [...all];
  };
  let skippedEntries = 0;
  for (const h of archive.huddles) {
    const id = `h_${slug(h.name)}_${short(h.name)}`;
    const members = [...new Set(h.members.map(userOf).filter((x): x is string => !!x))];
    data['tools.huddles'].push({
      id,
      name: clip(h.name, 120),
      teamId: ensureTeam(h.team),
      ownerId: userOf(h.owner),
      cadence: h.cadence,
      dayOfWeek: h.dayOfWeek ?? 1,
      startTime: h.startTime,
      endTime: h.endTime,
      videoUrl: /^https?:\/\/\S+$/i.test(h.videoUrl) ? h.videoUrl : '',
      description: clip(h.description, 8000),
      memberIds: members,
      teamSections: mapSections(h.teamSections, teamMap, TEAM_SECTIONS),
      personalSections: mapSections(h.personalSections, personalMap, PERSONAL_SECTIONS),
      active: h.active,
    });
    h.items.forEach((it, n) => data['tools.huddleItems'].push({ id: `hi_${short(id + n + it.week)}`, huddleId: id, week: mondayOf(it.week), type: it.type, text: clip(it.text, 1000), status: it.status, order: n }));
    const entries = new Map<string, Record<string, unknown>>();
    for (const e of h.entries) {
      const uid = userOf(e.person);
      if (!uid) {
        skippedEntries++;
        continue;
      }
      const week = mondayOf(e.week);
      entries.set(`${week}_${uid}`, { id: `${id}_${week}_${uid}`, huddleId: id, week, userId: uid, whatsUp: clip(e.whatsUp, 4000), feedback: clip(e.feedback, 4000), help: clip(e.help, 4000), stucks: clip(e.stucks, 4000) });
    }
    data['tools.huddleEntries'].push(...entries.values());
    h.tasks.forEach((t, n) => {
      const to = userOf(t.owner);
      data['tools.tasks'].push({
        id: `tk_${short(id + 'h' + n + t.title)}`,
        title: clip(t.title + (t.owner && !to ? ` — ${t.owner}` : ''), 300),
        ownerId: to,
        dueDate: t.due,
        done: t.done,
        doneAt: t.done ? archive.exportedAt : null,
        priorityId: null,
        huddleId: id,
        week: t.week ? mondayOf(t.week) : null,
      });
    });
  }
  if (skippedEntries) report.notes.push(`${skippedEntries} huddle check-in(s) belong to people with no Imago account yet: they stay in the archive and come in with a later import once the account exists.`);

  // ---- validate everything against the real schemas; drop what does not fit (reported) ----
  for (const c of KPI_COLLECTIONS) {
    const schema = TOOLS_SCHEMAS[c];
    const ok: Record<string, unknown>[] = [];
    for (const doc of data[c]) {
      if (schema.safeParse(doc).success) ok.push(doc);
      else report.invalid[c] = (report.invalid[c] ?? 0) + 1;
    }
    data[c] = ok;
    report.counts[c] = ok.length;
  }
  report.unmatchedPeople = [...unmatched].sort();
  return { data, report };
}
