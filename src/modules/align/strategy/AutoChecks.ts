/** Automatic alignment checks computed from the data for one quarter. Pure functions, no React. */
import type { L } from '@/i18n';
import { isOverdue, priorityInQuarter } from '../lib';
import type { AlignNote, AlignPriority, Rock } from '../schemas';

/** An item that fails a check. `to` links to the screen where it can be fixed. */
export interface Offender {
  label: string;
  to?: string;
}

export interface AutoCheck {
  id: string;
  label: L;
  offenders: Offender[];
}

interface Input {
  quarter: string;
  rocks: Rock[];
  priorities: AlignPriority[];
  notes: AlignNote[];
  thrusts: string[];
  now?: number;
}

const DAY = 86_400_000;

/** A note counts as recent when it was written in the last 14 days, or when its date is unknown. */
const isRecent = (n: AlignNote, since: number) => {
  const ts = n.createdAt ? Date.parse(n.createdAt) : Number.NaN;
  return Number.isNaN(ts) || ts >= since;
};

/**
 * The checks of a quarter. Scope: the non-archived Rocks of the quarter and their non-archived priorities.
 * The last check covers the priorities that belong to no Rock for the quarter (same rule as the Rocks page).
 */
export function computeAutoChecks({ quarter, rocks, priorities, notes, thrusts, now = Date.now() }: Input): AutoCheck[] {
  const qRocks = rocks.filter((r) => r.quarter === quarter && !r.archived);
  const qRockIds = new Set(qRocks.map((r) => r.id));
  const rockById = new Map(rocks.map((r) => [r.id, r] as const));
  const qPrios = priorities.filter((p) => !p.archived && p.rockId && qRockIds.has(p.rockId));
  const since = now - 14 * DAY;

  const rockLink = (r: Rock) => ({ label: r.title, to: `/align/rocks/${r.id}` });
  const prioLink = (p: AlignPriority) => {
    const rock = p.rockId ? rockById.get(p.rockId) : undefined;
    return { label: rock ? `${p.title} — ${rock.title}` : p.title, to: p.rockId ? `/align/rocks/${p.rockId}` : '/align/rocks' };
  };

  /** Waits for a priority that is still open and is archived or belongs to another quarter. */
  const isBlockedOutOfQuarter = (p: AlignPriority) => {
    if (!p.blockedById || p.status === 'completed') return false;
    const by = priorities.find((x) => x.id === p.blockedById);
    if (!by || by.status === 'completed') return false;
    if (by.archived) return true;
    const byQuarter = by.rockId ? rockById.get(by.rockId)?.quarter : undefined;
    return byQuarter !== undefined && byQuarter !== quarter;
  };

  const unlinked = priorities.filter((p) => !p.rockId && priorityInQuarter(p, quarter, rockById));

  return [
    {
      id: 'rock-owner',
      label: { fr: 'Chaque Rock a un responsable', en: 'Every Rock has an owner' },
      offenders: qRocks.filter((r) => !r.ownerId).map(rockLink),
    },
    {
      id: 'rock-priority',
      label: { fr: 'Chaque Rock a au moins une priorité', en: 'Every Rock has at least one priority' },
      offenders: qRocks.filter((r) => !qPrios.some((p) => p.rockId === r.id)).map(rockLink),
    },
    {
      id: 'rock-thrust',
      label: { fr: 'Chaque Rock est lié à un grand axe stratégique', en: 'Every Rock is linked to a key thrust' },
      offenders: qRocks.filter((r) => r.thrust === null || r.thrust >= thrusts.length).map(rockLink),
    },
    {
      id: 'prio-owner',
      label: { fr: 'Chaque priorité a un responsable', en: 'Every priority has an owner' },
      offenders: qPrios.filter((p) => !p.ownerId).map(prioLink),
    },
    {
      id: 'prio-due',
      label: { fr: 'Chaque priorité a une échéance', en: 'Every priority has a due date' },
      offenders: qPrios.filter((p) => !p.dueDate).map(prioLink),
    },
    {
      id: 'overdue',
      label: { fr: 'Aucune priorité en retard', en: 'No overdue priority' },
      offenders: qPrios.filter((p) => isOverdue(p)).map(prioLink),
    },
    {
      id: 'blocked',
      label: {
        fr: 'Aucune priorité bloquée par une priorité d’un autre trimestre ou archivée',
        en: 'No priority blocked by a priority of another quarter or an archived one',
      },
      offenders: qPrios.filter(isBlockedOutOfQuarter).map(prioLink),
    },
    {
      id: 'red-note',
      label: { fr: 'Chaque priorité en rouge a une note des 14 derniers jours', en: 'Every red priority has a note from the last 14 days' },
      offenders: qPrios
        .filter((p) => p.health === 'red' && p.status !== 'completed' && !notes.some((n) => n.priorityId === p.id && isRecent(n, since)))
        .map(prioLink),
    },
    {
      id: 'thrust-coverage',
      label: { fr: 'Chaque grand axe a au moins un Rock ce trimestre', en: 'Every key thrust has at least one Rock this quarter' },
      offenders: thrusts
        .map((text, i) => ({ text, i }))
        .filter(({ i }) => !qRocks.some((r) => r.thrust === i))
        .map(({ text, i }) => ({ label: `${i + 1}. ${text}` })),
    },
    {
      id: 'unlinked',
      label: { fr: 'Aucune priorité sans Rock pour ce trimestre', en: 'No priority without a Rock for this quarter' },
      offenders: unlinked.map((p) => ({ label: p.title, to: '/align/rocks' })),
    },
  ];
}
