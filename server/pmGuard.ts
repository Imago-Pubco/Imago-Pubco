/**
 * Tools → Gestion de projet: what the generic /api/c/:collection routes check beyond the zod shape.
 *  - time entries: one's own only (managers excepted), only on projects open to time where one is a member, billable
 *    and rate frozen from the task when the entry is written, approved entries locked, approving only by approvers
 *    (never one's own time), delete only draft/rejected entries
 *  - tasks: written by the project's manager/members or managers; billing rates only by managers
 *  - time off: one's own (managers excepted); projects, tasks, clients: refuse deletes that would orphan history
 */
import type { ZodObject } from 'zod';
import { PM_SCHEMAS } from '../src/modules/tools/pm/schemas.ts';
import type { PmTask, Project, TimeEntry } from '../src/modules/tools/pm/schemas.ts';
import type { AuthInfo } from './auth.ts';
import * as db from './db.ts';

type Doc = Record<string, unknown>;
export type Guarded = { doc: Doc } | { status: number; error: string };

export const isPmCollection = (c: string) => c in PM_SCHEMAS;

const STAMP_FIELDS = ['createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'reviewedBy', 'reviewedAt'] as const;
/** Fields that name a document: they never change after creation. */
const KEYS: Record<string, string[]> = {
  'pm.timeEntries': ['userId'],
  'pm.tasks': ['projectId'],
  'pm.timeOff': ['userId'],
  'pm.expenses': ['projectId'],
};
const fail = (status: number, error: string): Guarded => ({ status, error });
const manages = (a: AuthInfo) => a.canAny('tools.pm.manage');
const approves = (a: AuthInfo) => a.canAny('tools.pm.approve');

/** May this person book time / work on tasks of this project? */
function onProject(p: Project, a: AuthInfo, userId = a.user.id): boolean {
  return manages(a) || p.managerId === userId || p.memberIds.includes(userId);
}

export async function guardPm(c: string, body: Doc, a: AuthInfo, existing?: Doc): Promise<Guarded> {
  const schema = (PM_SCHEMAS as unknown as Record<string, ZodObject>)[c];
  if (!schema) return { doc: body };
  const input = { ...body };
  for (const f of STAMP_FIELDS) delete input[f];
  if (existing) delete input.id;
  const parsed = (existing ? schema.partial() : schema).safeParse(input);
  if (!parsed.success) return fail(400, `invalid data: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'body'} ${i.message}`).join('; ')}`);
  const doc: Doc = { ...parsed.data };
  for (const k of KEYS[c] ?? []) if (existing && k in doc && doc[k] !== existing[k]) return fail(400, `${k} cannot be changed`);
  if (!existing) doc.id = body.id;
  const merged = { ...(existing ?? {}), ...doc } as Doc;

  let res: Guarded | null = null;
  if (c === 'pm.timeEntries') res = await guardEntry(doc, merged, a, existing);
  else if (c === 'pm.tasks') res = await guardTask(doc, merged, a, existing);
  else if (c === 'pm.timeOff') res = await guardTimeOff(merged, a);
  else if (c === 'pm.projects') res = await guardProject(merged);
  else if (c === 'pm.expenses') res = (await db.getDoc('pm.projects', String(merged.projectId))) ? null : fail(400, 'unknown project');
  else if ((c === 'pm.staff' || c === 'pm.rates') && !(await db.getDoc('users', String(merged.id)))) res = fail(400, 'unknown user');
  if (res) return res;

  const stamp = new Date().toISOString();
  if (!existing) {
    doc.createdBy = a.user.id;
    doc.createdAt = stamp;
  }
  doc.updatedBy = a.user.id;
  doc.updatedAt = stamp;
  return { doc };
}

async function guardProject(p: Doc): Promise<Guarded | null> {
  if (p.startDate && p.endDate && String(p.endDate) < String(p.startDate)) return fail(400, 'The end date is before the start date.');
  const users = new Set((await db.listDocs<db.Doc>('users')).map((u) => u.id));
  const people = [...(p.managerId ? [String(p.managerId)] : []), ...(p.memberIds as string[])];
  if (people.some((u) => !users.has(u))) return fail(400, 'Unknown person on the project.');
  if (p.clientId && !(await db.getDoc('pm.clients', String(p.clientId)))) return fail(400, 'unknown client');
  return null;
}

async function guardTimeOff(t: Doc, a: AuthInfo): Promise<Guarded | null> {
  if (String(t.endDate) < String(t.startDate)) return fail(400, 'The end date is before the start date.');
  if (t.userId !== a.user.id && !manages(a)) return fail(403, 'You can only record your own time off.');
  if (!(await db.getDoc('users', String(t.userId)))) return fail(400, 'unknown user');
  return null;
}

async function guardTask(doc: Doc, t: Doc, a: AuthInfo, existing?: Doc): Promise<Guarded | null> {
  const project = await db.getDoc<Project & db.Doc>('pm.projects', String(t.projectId));
  if (!project) return fail(400, 'unknown project');
  if (!onProject(project, a)) return fail(403, 'You are not on this project.');
  // Billing rates are money: managers only (a new task by a member is non-billable until a manager sets its rate).
  if (!manages(a) && ((!existing && Number(t.rate) !== 0) || (existing && 'rate' in doc && doc.rate !== existing.rate))) return fail(403, 'Only managers set billing rates.');
  const known = new Set((await db.listDocs<db.Doc>('users')).map((u) => u.id));
  if ((t.assigneeIds as string[]).some((u) => !known.has(u))) return fail(400, 'Unknown assignee.');
  if (t.dependsOnId) {
    if (t.dependsOnId === t.id) return fail(400, 'A task cannot depend on itself.');
    const dep = await db.getDoc<PmTask & db.Doc>('pm.tasks', String(t.dependsOnId));
    if (!dep || dep.projectId !== t.projectId) return fail(400, 'The dependency must be a task of the same project.');
    // no cycles
    let cur: PmTask | undefined = dep;
    for (let i = 0; cur && i < 200; i++) {
      if (cur.dependsOnId === t.id) return fail(400, 'This dependency would make a cycle.');
      cur = cur.dependsOnId ? await db.getDoc<PmTask & db.Doc>('pm.tasks', cur.dependsOnId) : undefined;
    }
  }
  return null;
}

/** Hours already booked (not rejected) by a person on a day, other than entry `exceptId`. */
async function bookedOn(userId: string, date: string, exceptId: string): Promise<number> {
  const all = await db.listDocs<TimeEntry & db.Doc>('pm.timeEntries');
  return all.filter((x) => x.userId === userId && x.date === date && x.id !== exceptId && x.status !== 'rejected').reduce((h, x) => h + x.hours, 0);
}

async function guardEntry(doc: Doc, e: Doc, a: AuthInfo, existing?: Doc): Promise<Guarded | null> {
  const me = a.user.id;
  const mine = e.userId === me;
  const was = existing ? String(existing.status) : null;

  if (existing) {
    // Reviewing: approvers, never on their own time or on time they entered themselves (super administrators excepted).
    const reviewing = 'status' in doc && doc.status !== existing.status && (doc.status === 'approved' || doc.status === 'rejected' || was === 'approved');
    if (reviewing) {
      if (!approves(a)) return fail(403, 'Only approvers can approve, reject or unlock time.');
      if ((mine || existing.createdBy === me) && !a.can('*')) return fail(403, 'You cannot approve time that is yours or that you entered.');
      const okMove = (was === 'submitted' && (doc.status === 'approved' || doc.status === 'rejected')) || (was === 'approved' && doc.status === 'submitted');
      if (!okMove) return fail(400, 'Invalid status change.');
      const extra = Object.keys(doc).filter((k) => !['status', 'reviewNote'].includes(k));
      if (extra.length) return fail(400, 'An approver can only change the status and the review note.');
      doc.reviewedBy = me;
      doc.reviewedAt = new Date().toISOString();
      if (doc.status !== 'rejected') doc.reviewNote = typeof doc.reviewNote === 'string' && doc.status !== 'submitted' ? doc.reviewNote : '';
      return null;
    }
    if (was === 'approved') return fail(423, 'This time is approved and locked.');
    if (!mine && !manages(a)) return fail(403, 'You can only edit your own time.');
    if ('reviewNote' in doc) return fail(403, 'Only an approver writes the review note.');
    if ('status' in doc && (doc.status === 'approved' || doc.status === 'rejected')) return fail(403, 'Only an approver can approve or reject time.');
    if (was === 'submitted') {
      // Awaiting approval: the only thing allowed is taking it back to draft, with nothing else changed.
      const keys = Object.keys(doc);
      if (!(keys.length === 1 && doc.status === 'draft')) return fail(423, 'Submitted time is awaiting approval: take it back to draft to edit it.');
      return null;
    }
    if (doc.status === 'draft' && was === 'rejected') doc.reviewNote = '';
  } else {
    if (!mine && !manages(a)) return fail(403, 'You can only book your own time.');
    if (e.status !== 'draft' && e.status !== 'submitted') return fail(403, 'New time starts as a draft or submitted.');
    doc.reviewNote = '';
  }

  // Billable and rate are never taken from the client: they are recomputed from the task on every write.
  delete doc.billable;
  delete doc.rate;
  const project = await db.getDoc<Project & db.Doc>('pm.projects', String(e.projectId));
  if (!project) return fail(400, 'unknown project');
  if (project.status === 'archived' || project.status === 'completed' || project.closedToTime) return fail(423, 'This project is closed to time.');
  if (!onProject(project, a, String(e.userId))) return fail(403, 'This person is not on the project.');
  let rate = 0;
  if (e.taskId) {
    const task = await db.getDoc<PmTask & db.Doc>('pm.tasks', String(e.taskId));
    if (!task || task.projectId !== project.id) return fail(400, 'The task is not one of this project.');
    rate = task.rate;
  }
  // The rate of existing time is frozen: only recompute when the task (or project) really changed.
  const moved = !existing || e.projectId !== existing.projectId || e.taskId !== existing.taskId;
  if (moved) {
    doc.billable = project.billing !== 'internal' && rate > 0;
    doc.rate = project.billing === 'internal' ? 0 : rate;
  }
  // 24 hours a day at most, per person, whatever the number of entries.
  if (e.status !== 'rejected' && (await bookedOn(String(e.userId), String(e.date), String(e.id))) + Number(e.hours) > 24) return fail(400, 'That day would exceed 24 hours.');
  return null;
}

/** Deletes that would erase history or orphan records are refused (archive instead). */
export async function guardPmDelete(c: string, id: string, a: AuthInfo): Promise<{ status: number; error: string } | null> {
  const used = async (col: string, key: string) => (await db.listDocs<db.Doc & Doc>(col)).some((d) => d[key] === id);
  if (c === 'pm.timeEntries') {
    const e = await db.getDoc<TimeEntry & db.Doc>('pm.timeEntries', id);
    if (!e) return null;
    if (e.userId !== a.user.id && !manages(a)) return { status: 403, error: 'You can only delete your own time.' };
    if (e.status === 'approved' || e.status === 'submitted') return { status: 423, error: 'Approved or submitted time cannot be deleted.' };
  }
  if (c === 'pm.projects' && ((await used('pm.tasks', 'projectId')) || (await used('pm.timeEntries', 'projectId')) || (await used('pm.expenses', 'projectId')))) {
    return { status: 409, error: 'This project has tasks, time or expenses: archive it instead.' };
  }
  if (c === 'pm.tasks') {
    if (await used('pm.timeEntries', 'taskId')) return { status: 409, error: 'Time was booked on this task: mark it done instead.' };
    const t = await db.getDoc<PmTask & db.Doc>('pm.tasks', id);
    const p = t ? await db.getDoc<Project & db.Doc>('pm.projects', t.projectId) : undefined;
    if (p && !onProject(p, a)) return { status: 403, error: 'You are not on this project.' };
    // tasks that depended on it lose the dependency
    if (t) for (const o of await db.listDocs<PmTask & db.Doc>('pm.tasks')) if (o.dependsOnId === id) await db.updateDoc<PmTask & db.Doc>('pm.tasks', o.id, { dependsOnId: null });
  }
  if (c === 'pm.clients' && (await used('pm.projects', 'clientId'))) return { status: 409, error: 'This client has projects: archive it instead.' };
  if (c === 'pm.timeOff') {
    const t = await db.getDoc<db.Doc & { userId: string }>('pm.timeOff', id);
    if (t && t.userId !== a.user.id && !manages(a)) return { status: 403, error: 'You can only delete your own time off.' };
  }
  return null;
}
