/**
 * Builds the Align data from the KPI tool's data (pure function, used by the server import and the dev backend):
 *   - company priorities without a parent        → Rocks (quarter from the priority's period)
 *   - their sub-priorities                       → Priorities of that rock
 *   - other priorities (team priorities, …)      → Priorities not linked to a rock yet (to be linked by a manager)
 *   - tasks of a priority                        → follow-ups of that priority
 *   - weekly update notes of a priority          → notes of that priority
 *   - huddles                                    → Align huddles (name, people, schedule)
 * Ids are derived from the source ids, so running it again gives the same documents.
 */
import type { Huddle, Priority, PriorityUpdate, Task } from '@/modules/tools/schemas';
import type { AlignHuddle, AlignNote, AlignPriority, PriorityStatus, Rock } from './schemas';

export interface KpiSource {
  priorities: Priority[];
  priorityUpdates: PriorityUpdate[];
  tasks: Task[];
  huddles: Huddle[];
}

export interface AlignBuild {
  rocks: Rock[];
  priorities: AlignPriority[];
  notes: AlignNote[];
  huddles: AlignHuddle[];
  /** Source records not carried over (e.g. tasks of a rock), for the report. */
  skipped: number;
}

const quarterOfDate = (d: string) => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
const statusOf = (progress: number): PriorityStatus => (progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started');
const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

export function buildAlignFromKpi(src: KpiSource): AlignBuild {
  const isRock = (p: Priority) => p.company && !p.parentId;
  const rockSources = src.priorities.filter(isRock);
  const rockIdOf = new Map(rockSources.map((p) => [p.id, `r_${p.id}`]));

  const rocks: Rock[] = rockSources
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .map((p, i) => ({
      id: `r_${p.id}`,
      title: clip(p.title, 200),
      description: clip(p.description, 4000),
      ownerId: p.ownerId,
      quarter: quarterOfDate(p.periodStart),
      thrust: null,
      order: i,
      archived: p.archived,
      sourceId: p.id,
    }));

  const prioritySources = src.priorities.filter((p) => !isRock(p));
  const priorityIdOf = new Map(prioritySources.map((p) => [p.id, `p_${p.id}`]));
  const priorities: AlignPriority[] = prioritySources
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .map((p, i) => {
      const progress = Math.round(Math.min(100, Math.max(0, p.progress)));
      return {
        id: `p_${p.id}`,
        rockId: (p.parentId && rockIdOf.get(p.parentId)) || null,
        title: clip(p.title, 200),
        description: clip(p.description, 4000),
        ownerId: p.ownerId,
        dueDate: p.periodEnd,
        status: statusOf(progress),
        health: p.status,
        progress,
        blockedById: null,
        blockedNote: '',
        order: i,
        archived: p.archived,
        sourceId: p.id,
      };
    });

  let skipped = 0;
  const notes: AlignNote[] = [];
  for (const t of src.tasks) {
    const pid = t.priorityId ? priorityIdOf.get(t.priorityId) : undefined;
    if (!pid) {
      if (t.priorityId) skipped++; // a task of a rock, or of a deleted priority
      continue;
    }
    notes.push({
      id: `n_${t.id}`,
      priorityId: pid,
      kind: 'followup',
      text: clip(t.title, 4000),
      assigneeId: t.ownerId,
      dueDate: t.dueDate,
      done: t.done,
      huddleId: null,
      sourceId: t.id,
    });
  }
  for (const u of src.priorityUpdates) {
    const pid = priorityIdOf.get(u.priorityId);
    if (!u.note.trim()) continue;
    if (!pid) {
      skipped++;
      continue;
    }
    notes.push({
      id: `n_${u.id}`,
      priorityId: pid,
      kind: 'note',
      text: clip(`Semaine du ${u.week} — ${u.note.trim()}`, 4000),
      assigneeId: null,
      dueDate: null,
      done: false,
      huddleId: null,
      sourceId: u.id,
    });
  }

  const huddles: AlignHuddle[] = src.huddles.map((h) => ({
    id: `h_${h.id}`,
    name: clip(h.name, 120),
    description: clip(h.description, 4000),
    ownerId: h.ownerId,
    memberIds: h.memberIds,
    cadence: h.cadence,
    dayOfWeek: h.dayOfWeek,
    startTime: h.startTime,
    endTime: h.endTime,
    videoUrl: h.videoUrl,
    active: h.active,
    sourceId: h.id,
  }));

  return { rocks, priorities, notes, huddles, skipped };
}
