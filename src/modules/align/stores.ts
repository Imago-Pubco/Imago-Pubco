import { collection } from '@/data/db';
import type { AlignHuddle, AlignNote, AlignPriority, AlignTask, Checkin, ChecklistItem, HuddleWeek, Rock, Strategy } from './schemas';

/** Collections of the Align module (validated, permission-checked and stamped by the server: server/alignGuard.ts). */
export const rocks = collection<Rock>('align.rocks');
export const alignPriorities = collection<AlignPriority>('align.priorities');
export const notes = collection<AlignNote>('align.notes');
export const alignHuddles = collection<AlignHuddle>('align.huddles');
export const strategy = collection<Strategy>('align.strategy');
export const checklist = collection<ChecklistItem>('align.checklist');
export const tasks = collection<AlignTask>('align.tasks');
export const checkins = collection<Checkin>('align.checkins');
export const huddleWeeks = collection<HuddleWeek>('align.huddleWeeks');
