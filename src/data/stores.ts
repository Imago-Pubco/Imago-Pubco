import { collection, uid } from './db';
import type { AuditEntry, Group, User } from './types';

export const users = collection<User>('users');
export const groups = collection<Group>('groups');
export const audit = collection<AuditEntry>('audit');
/** Organisation-wide settings (key/value documents). */
export const appSettings = collection<{ id: string; value: unknown }>('app.settings');

export async function logAudit(userId: string, action: string, detail = '') {
  await audit.insert({ id: uid('a_'), at: new Date().toISOString(), userId, action, detail });
}
