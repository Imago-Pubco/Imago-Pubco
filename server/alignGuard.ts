/**
 * Server rules of the Align module. Every write is validated against the strict schemas (unknown fields refused),
 * stamped by the server, and checked against the person's rights:
 *   - align.access              read everything; update the progress/status/blocking of priorities assigned to oneself;
 *                               write notes and follow-ups (edit/delete one's own; tick follow-ups assigned to oneself)
 *   - align.rocks.manage        create / edit / delete rocks
 *   - align.priorities.manage   create / edit / delete / assign any priority; edit or delete any note
 *   - align.strategy.manage     one-page plan, 4D Vision, alignment checklist
 *   - align.huddles.manage      create / edit / delete huddles (a huddle's owner may also edit it)
 *
 * Weekly layer (work weeks, Monday = weekStart):
 *   - align.tasks        an action of someone's weekly plan. The owner (and the creator) manages it; a non-manager may not
 *                        give it to anyone else. kind 'rock' needs an existing rockId; kind 'weekly' is forced to rockId null.
 *                        priorityId / huddleId, when set, must exist. align.priorities.manage manages everyone's.
 *                        Delete: owner, creator or manager.
 *   - align.checkins     "Quoi de neuf": one per person and week, id = `${userId}_${weekStart}`. The person (or a manager)
 *                        writes it; userId and weekStart cannot change. Delete: the person or a manager.
 *   - align.huddleWeeks  a huddle's description for one week, id = `${huddleId}_${weekStart}`. The huddle must exist; the
 *                        huddle's editors (align.huddles.manage or the huddle's owner) write it; huddleId and weekStart
 *                        cannot change. Delete: the same right, checked against the huddle (manager only if it is gone).
 *
 * Deleting a rock, a priority or a huddle also unlinks the tasks that pointed at it (one transaction, see deleteAlign).
 */
import type { ZodObject } from 'zod';
import { ALIGN_SCHEMAS } from '../src/modules/align/schemas.ts';
import type { AuthInfo } from './auth.ts';
import * as db from './db.ts';

type Result = { doc: Record<string, unknown> } | { status: number; error: string };
type Doc = Record<string, unknown> & db.Doc;

const STAMPS = ['createdBy', 'createdAt', 'updatedBy', 'updatedAt'];
/** What the person a priority is assigned to may change without align.priorities.manage. */
const OWNER_FIELDS = new Set(['status', 'health', 'progress', 'blockedById', 'blockedNote']);
/** What the assignee of a follow-up may change on someone else's note. */
const ASSIGNEE_FIELDS = new Set(['done']);

export const isAlignCollection = (c: string) => c in ALIGN_SCHEMAS;

const forbidden = (error: string): Result => ({ status: 403, error });

/** The values a document will have once written, for rights and links checked on the final state. */
const final = (input: Record<string, unknown>, existing?: Doc): Record<string, unknown> => ({ ...(existing ?? {}), ...input });

/** Refuses a blocking link to a missing priority, to itself, or one that would create a loop. */
async function checkBlocking(id: string, blockedById: unknown): Promise<string | null> {
  if (blockedById == null) return null;
  const all = await db.listDocs<{ id: string; blockedById?: string | null }>('align.priorities');
  const byId = new Map(all.map((p) => [p.id, p]));
  if (blockedById === id) return 'A priority cannot wait for itself.';
  if (!byId.has(String(blockedById))) return 'The blocking priority does not exist.';
  const seen = new Set([id]);
  let cur: string | null | undefined = String(blockedById);
  while (cur) {
    if (seen.has(cur)) return 'This would create a loop of priorities waiting for each other.';
    seen.add(cur);
    cur = byId.get(cur)?.blockedById;
  }
  return null;
}

async function canWrite(c: string, input: Record<string, unknown>, a: AuthInfo, existing?: Doc): Promise<string | null> {
  switch (c) {
    case 'align.rocks':
      return a.can('align.rocks.manage') ? null : 'Managing rocks requires the right to manage rocks.';
    case 'align.strategy':
    case 'align.checklist':
      return a.can('align.strategy.manage') ? null : 'Editing the strategy requires the right to manage the strategy.';
    case 'align.huddles':
      if (a.can('align.huddles.manage')) return null;
      if (existing && existing.ownerId === a.user.id && !('ownerId' in input && input.ownerId !== a.user.id)) return null;
      return 'Managing huddles requires the right to manage huddles.';
    case 'align.priorities': {
      if (a.can('align.priorities.manage')) return null;
      if (!existing) return 'Creating priorities requires the right to manage priorities.';
      if (existing.ownerId !== a.user.id) return 'You can only update the priorities assigned to you.';
      const extra = Object.keys(input).filter((k) => !OWNER_FIELDS.has(k));
      return extra.length ? `You can only update the advancement of your priority (not: ${extra.join(', ')}).` : null;
    }
    case 'align.notes': {
      if (!existing) return null; // anyone with access may write a note; the server stamps them as author
      if (existing.createdBy === a.user.id || a.can('align.priorities.manage')) return null;
      const onlyTick = Object.keys(input).every((k) => ASSIGNEE_FIELDS.has(k));
      if (existing.assigneeId === a.user.id && onlyTick) return null;
      return 'You can only edit your own notes.';
    }
    case 'align.tasks': {
      if (a.can('align.priorities.manage')) return null;
      if (!existing) return input.ownerId === a.user.id ? null : 'You can only create your own actions.';
      if (existing.ownerId !== a.user.id && existing.createdBy !== a.user.id) return 'You can only edit your own actions.';
      return input.ownerId === undefined || input.ownerId === a.user.id ? null : 'You can only give your actions to yourself.';
    }
    case 'align.checkins':
      if (a.can('align.priorities.manage')) return null;
      return final(input, existing).userId === a.user.id ? null : 'You can only write your own check-in.';
    case 'align.huddleWeeks': {
      if (a.can('align.huddles.manage')) return null;
      const huddle = await db.getDoc<Doc>('align.huddles', String(final(input, existing).huddleId));
      return huddle && huddle.ownerId === a.user.id ? null : 'Managing a huddle week requires the right to manage huddles (or to own the huddle).';
    }
    default:
      return 'unknown collection';
  }
}

/** Validation, rights and stamps for a create (no `existing`) or an update. */
export async function guardAlign(c: string, body: Record<string, unknown>, a: AuthInfo, existing?: Doc): Promise<Result> {
  const schema = (ALIGN_SCHEMAS as Record<string, ZodObject>)[c];
  if (!schema) return { status: 404, error: 'unknown collection' };
  const input = { ...body };
  for (const f of STAMPS) delete input[f];
  if (existing) delete input.id;

  if (c === 'align.huddleWeeks') {
    const huddleId = String(final(input, existing).huddleId ?? '');
    if (!(await db.getDoc('align.huddles', huddleId))) return { status: 400, error: 'The huddle does not exist.' };
  }

  const refusal = await canWrite(c, input, a, existing);
  if (refusal) return forbidden(refusal);

  const parsed = (existing ? schema.partial() : schema).safeParse(existing ? input : { ...input, id: body.id });
  if (!parsed.success) {
    return { status: 400, error: `invalid data: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'body'} ${i.message}`).join('; ')}` };
  }
  const doc: Record<string, unknown> = { ...parsed.data };

  if (c === 'align.strategy' && (existing ? existing.id : doc.id) !== 'plan') return { status: 400, error: 'invalid id' };
  if (c === 'align.priorities' && 'blockedById' in doc) {
    const bad = await checkBlocking(String(existing?.id ?? doc.id), doc.blockedById);
    if (bad) return { status: 400, error: bad };
  }
  if (c === 'align.priorities') {
    // A completed priority is at 100 %, whoever sends what (keeps rock progress and bars consistent).
    const status = 'status' in doc ? doc.status : existing?.status;
    if (status === 'completed' && (doc.progress !== 100 || existing?.progress !== 100)) doc.progress = 100;
  }
  if (c === 'align.priorities' && 'rockId' in doc && doc.rockId != null && !(await db.getDoc('align.rocks', String(doc.rockId)))) {
    return { status: 400, error: 'The rock does not exist.' };
  }
  if (c === 'align.notes' && !existing && !(await db.getDoc('align.priorities', String(doc.priorityId)))) {
    return { status: 400, error: 'The priority does not exist.' };
  }
  if (c === 'align.notes' && existing && 'priorityId' in doc && doc.priorityId !== existing.priorityId) {
    return { status: 400, error: 'priorityId cannot be changed' };
  }
  if (c === 'align.tasks') {
    const fin = final(doc, existing);
    if (fin.kind === 'weekly') doc.rockId = null;
    else if (fin.rockId == null) return { status: 400, error: 'A Rock action needs a Rock.' };
    else if (!(await db.getDoc('align.rocks', String(fin.rockId)))) return { status: 400, error: 'The rock does not exist.' };
    if (fin.priorityId != null && !(await db.getDoc('align.priorities', String(fin.priorityId)))) {
      return { status: 400, error: 'The priority does not exist.' };
    }
    if (fin.huddleId != null && !(await db.getDoc('align.huddles', String(fin.huddleId)))) {
      return { status: 400, error: 'The huddle does not exist.' };
    }
  }
  if (c === 'align.checkins') {
    if (!existing && doc.id !== `${doc.userId}_${doc.weekStart}`) return { status: 400, error: 'invalid id' };
    if (existing && (('userId' in doc && doc.userId !== existing.userId) || ('weekStart' in doc && doc.weekStart !== existing.weekStart))) {
      return { status: 400, error: 'userId and weekStart cannot be changed' };
    }
  }
  if (c === 'align.huddleWeeks') {
    if (!existing && doc.id !== `${doc.huddleId}_${doc.weekStart}`) return { status: 400, error: 'invalid id' };
    if (existing && (('huddleId' in doc && doc.huddleId !== existing.huddleId) || ('weekStart' in doc && doc.weekStart !== existing.weekStart))) {
      return { status: 400, error: 'huddleId and weekStart cannot be changed' };
    }
  }

  const stamp = new Date().toISOString();
  if (!existing) {
    doc.createdBy = a.user.id;
    doc.createdAt = stamp;
  }
  doc.updatedBy = a.user.id;
  doc.updatedAt = stamp;
  return { doc };
}

/** Rights for a delete, plus the clean-up that goes with it. Returns a refusal, or null when done is allowed. */
export async function guardAlignDelete(c: string, id: string, a: AuthInfo): Promise<{ status: number; error: string } | null> {
  const existing = await db.getDoc<Doc>(c, id);
  // A missing document is a 404: the clean-up must never run for it (it would unlink others' priorities).
  if (!existing) return { status: 404, error: 'not_found' };
  if (c === 'align.notes') {
    return existing.createdBy === a.user.id || a.can('align.priorities.manage') ? null : { status: 403, error: 'You can only delete your own notes.' };
  }
  if (c === 'align.priorities' && !a.can('align.priorities.manage')) return { status: 403, error: 'Deleting priorities requires the right to manage priorities.' };
  if (c === 'align.rocks' && !a.can('align.rocks.manage')) return { status: 403, error: 'Deleting rocks requires the right to manage rocks.' };
  if ((c === 'align.strategy' || c === 'align.checklist') && !a.can('align.strategy.manage')) return { status: 403, error: 'Editing the strategy requires the right to manage the strategy.' };
  if (c === 'align.huddles' && !a.can('align.huddles.manage') && existing.ownerId !== a.user.id) return { status: 403, error: 'Managing huddles requires the right to manage huddles.' };
  if (c === 'align.tasks') {
    return existing.ownerId === a.user.id || existing.createdBy === a.user.id || a.can('align.priorities.manage')
      ? null
      : { status: 403, error: 'You can only delete your own actions.' };
  }
  if (c === 'align.checkins') {
    return existing.userId === a.user.id || a.can('align.priorities.manage') ? null : { status: 403, error: 'You can only delete your own check-in.' };
  }
  if (c === 'align.huddleWeeks' && !a.can('align.huddles.manage')) {
    const huddle = await db.getDoc<Doc>('align.huddles', String(existing.huddleId));
    if (!huddle || huddle.ownerId !== a.user.id) return { status: 403, error: 'Managing a huddle week requires the right to manage huddles (or to own the huddle).' };
  }
  return null;
}

/**
 * A permitted delete and the clean-up of its links, in ONE transaction (all or nothing), with set-based SQL:
 *   rock deleted     → its priorities stay, unlinked (nobody's work disappears with a rock)
 *   priority deleted → its notes go; priorities that waited for it are unblocked
 * Returns the collections that changed, for the live refresh.
 */
export async function deleteAlign(c: string, id: string): Promise<string[]> {
  const client = await db.pool.connect();
  const touched = [c];
  try {
    await client.query('begin');
    await client.query('delete from docs where collection = $1 and id = $2', [c, id]);
    if (c === 'align.rocks') {
      await client.query(
        `update docs set data = data || '{"rockId": null}'::jsonb, updated_at = now() where collection = 'align.priorities' and data->>'rockId' = $1`,
        [id],
      );
      await client.query(
        `update docs set data = data || '{"rockId": null, "kind": "weekly"}'::jsonb, updated_at = now() where collection = 'align.tasks' and data->>'rockId' = $1`,
        [id],
      );
      touched.push('align.priorities', 'align.tasks');
    }
    if (c === 'align.priorities') {
      await client.query(`delete from docs where collection = 'align.notes' and data->>'priorityId' = $1`, [id]);
      await client.query(
        `update docs set data = data || '{"blockedById": null, "blockedNote": ""}'::jsonb, updated_at = now() where collection = 'align.priorities' and data->>'blockedById' = $1`,
        [id],
      );
      await client.query(
        `update docs set data = data || '{"priorityId": null}'::jsonb, updated_at = now() where collection = 'align.tasks' and data->>'priorityId' = $1`,
        [id],
      );
      touched.push('align.notes', 'align.tasks');
    }
    if (c === 'align.huddles') {
      await client.query(`delete from docs where collection = 'align.huddleWeeks' and data->>'huddleId' = $1`, [id]);
      await client.query(
        `update docs set data = data || '{"huddleId": null}'::jsonb, updated_at = now() where collection = 'align.tasks' and data->>'huddleId' = $1`,
        [id],
      );
      touched.push('align.huddleWeeks', 'align.tasks');
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
  return touched;
}
