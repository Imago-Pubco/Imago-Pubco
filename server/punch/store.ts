/**
 * Punch card storage: one SQLite file (data/punch.sqlite), built into Node (node:sqlite).
 * Holds employees (with their ID photo and face descriptor), punches, e-mails and settings.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { OutboxMessage, PunchEmployee, PunchEvent, PunchSettings, WeekSchedule } from '../../src/modules/dev/punch/types.ts';

export const DATA_DIR = path.resolve(import.meta.dirname, '../../data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'punch.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone_last4 TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT '',
    schedule TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    photo TEXT,
    face TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    at TEXT NOT NULL,
    kind TEXT NOT NULL,
    identity TEXT NOT NULL,
    face_distance REAL,
    source TEXT NOT NULL,
    note TEXT
  );
  CREATE INDEX IF NOT EXISTS events_emp_at ON events (employee_id, at);
  CREATE TABLE IF NOT EXISTS mails (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    week_start TEXT NOT NULL,
    from_addr TEXT NOT NULL,
    to_addr TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    asks_yes_no INTEGER NOT NULL,
    answer TEXT,
    justification TEXT,
    answered_at TEXT,
    token TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    sent_at TEXT,
    error TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);
// Added later: employees who signed themselves up on the tablet, waiting for the administrator.
if (!(db.prepare('PRAGMA table_info(employees)').all() as { name: string }[]).some((c) => c.name === 'to_approve')) {
  db.exec('ALTER TABLE employees ADD COLUMN to_approve INTEGER NOT NULL DEFAULT 0');
}

export const newId = (prefix: string) => prefix + crypto.randomBytes(8).toString('hex');

/* ---------- settings ---------- */

const DEFAULTS: Omit<PunchSettings, 'id' | 'senderEmail'> = {
  directorEmail: '',
  photoCheck: true,
  digestHours: 48,
  lastDigestAt: null,
};

// The test clock was removed: forget any offset left by older versions.
db.exec("DELETE FROM settings WHERE key = 'clockOffsetMinutes'");

export function getSettings(senderEmail: string): PunchSettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  // Keys starting with '_' are internal (access key, notified list) and never leave the server.
  const stored = Object.fromEntries(rows.filter((r) => !r.key.startsWith('_')).map((r) => [r.key, JSON.parse(r.value)]));
  return { id: 'settings', senderEmail, ...DEFAULTS, ...stored };
}

export function setSetting<K extends keyof typeof DEFAULTS>(key: K, value: (typeof DEFAULTS)[K]) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
}

/** Secret of the protected links sent to the administrator (live follow-up, face setup). Created on first use. */
export function accessKey(): string {
  const r = db.prepare("SELECT value FROM settings WHERE key = '_accessKey'").get() as { value: string } | undefined;
  if (r) return JSON.parse(r.value) as string;
  return renewAccessKey();
}

/** New secret: every link sent before stops working. */
export function renewAccessKey(): string {
  const key = crypto.randomBytes(24).toString('base64url');
  db.prepare("INSERT INTO settings (key, value) VALUES ('_accessKey', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(key));
  return key;
}

/** Employees already listed in a "face to set up" e-mail (so the administrator gets each one once). */
export function faceNotified(): string[] {
  const r = db.prepare("SELECT value FROM settings WHERE key = '_faceNotified'").get() as { value: string } | undefined;
  return r ? (JSON.parse(r.value) as string[]) : [];
}

export function setFaceNotified(ids: string[]) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('_faceNotified', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(ids));
}

/* ---------- employees ---------- */

interface EmployeeRow {
  id: string;
  name: string;
  phone_last4: string;
  email: string;
  role: string;
  schedule: string;
  active: number;
  photo: string | null;
  face: string | null;
  to_approve: number;
}

const toEmployee = (r: EmployeeRow): PunchEmployee => ({
  id: r.id,
  name: r.name,
  phoneLast4: r.phone_last4,
  email: r.email,
  role: r.role || undefined,
  schedule: JSON.parse(r.schedule) as WeekSchedule,
  active: r.active === 1,
  photo: r.photo,
  hasFace: !!r.face,
  toApprove: r.to_approve === 1,
});

export function listEmployees(): PunchEmployee[] {
  return (db.prepare('SELECT * FROM employees ORDER BY name').all() as unknown as EmployeeRow[]).map(toEmployee);
}

export function getEmployee(id: string): PunchEmployee | undefined {
  const r = db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as EmployeeRow | undefined;
  return r && toEmployee(r);
}

export function findActiveByCode(code: string): PunchEmployee | undefined {
  const r = db.prepare('SELECT * FROM employees WHERE phone_last4 = ? AND active = 1').get(code) as EmployeeRow | undefined;
  return r && toEmployee(r);
}

export function getFace(id: string): number[] | null {
  const r = db.prepare('SELECT face FROM employees WHERE id = ?').get(id) as { face: string | null } | undefined;
  return r?.face ? (JSON.parse(r.face) as number[]) : null;
}

export function setFace(id: string, face: number[] | null, photo: string | null) {
  db.prepare('UPDATE employees SET face = ?, photo = ? WHERE id = ?').run(face ? JSON.stringify(face) : null, photo, id);
  // Face removed: the administrator will be asked again to set it up.
  if (!face) setFaceNotified(faceNotified().filter((x) => x !== id));
}

export interface EmployeeInput {
  name: string;
  phoneLast4: string;
  email: string;
  role?: string;
  schedule: WeekSchedule;
  active: boolean;
  /** Signed up on the tablet: shown to the administrator as « à valider ». */
  toApprove?: boolean;
}

export function codeTaken(code: string, exceptId?: string): boolean {
  return !!db.prepare('SELECT 1 FROM employees WHERE phone_last4 = ? AND active = 1 AND id != ?').get(code, exceptId ?? '');
}

export function createEmployee(e: EmployeeInput): PunchEmployee {
  const id = newId('emp_');
  db.prepare('INSERT INTO employees (id, name, phone_last4, email, role, schedule, active, to_approve, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    id,
    e.name,
    e.phoneLast4,
    e.email,
    e.role ?? '',
    JSON.stringify(e.schedule),
    e.active ? 1 : 0,
    e.toApprove ? 1 : 0,
    new Date().toISOString(),
  );
  return getEmployee(id)!;
}

export function updateEmployee(id: string, e: EmployeeInput) {
  db.prepare('UPDATE employees SET name = ?, phone_last4 = ?, email = ?, role = ?, schedule = ?, active = ?, to_approve = 0 WHERE id = ?').run(
    e.name,
    e.phoneLast4,
    e.email,
    e.role ?? '',
    JSON.stringify(e.schedule),
    e.active ? 1 : 0,
    id,
  );
}

/** The administrator accepts an employee who signed up on the tablet. */
export function approveEmployee(id: string) {
  db.prepare('UPDATE employees SET to_approve = 0 WHERE id = ?').run(id);
}

/** Deletes the employee and everything about them (punches, e-mails, photo, face). */
export function deleteEmployee(id: string) {
  db.prepare('DELETE FROM events WHERE employee_id = ?').run(id);
  db.prepare('DELETE FROM mails WHERE employee_id = ?').run(id);
  db.prepare('DELETE FROM employees WHERE id = ?').run(id);
}

/* ---------- events ---------- */

interface EventRow {
  id: string;
  employee_id: string;
  at: string;
  kind: PunchEvent['kind'];
  identity: PunchEvent['identity'];
  face_distance: number | null;
  source: PunchEvent['source'];
  note: string | null;
}

const localDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const toEvent = (r: EventRow): PunchEvent => ({
  id: r.id,
  employeeId: r.employee_id,
  date: localDate(r.at),
  at: r.at,
  kind: r.kind,
  identity: r.identity,
  ...(r.face_distance !== null ? { faceDistance: r.face_distance } : {}),
  source: r.source,
  ...(r.note ? { note: r.note } : {}),
});

/** Events with from <= at < to (ISO strings compare in time order). */
export function listEvents(fromIso: string, toIso: string, employeeId?: string): PunchEvent[] {
  const rows = employeeId
    ? db.prepare('SELECT * FROM events WHERE employee_id = ? AND at >= ? AND at < ? ORDER BY at').all(employeeId, fromIso, toIso)
    : db.prepare('SELECT * FROM events WHERE at >= ? AND at < ? ORDER BY at').all(fromIso, toIso);
  return (rows as unknown as EventRow[]).map(toEvent);
}

export function insertEvent(e: Omit<PunchEvent, 'id' | 'date'>): PunchEvent {
  const id = newId('pe_');
  db.prepare('INSERT INTO events (id, employee_id, at, kind, identity, face_distance, source, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    id,
    e.employeeId,
    e.at,
    e.kind,
    e.identity,
    e.faceDistance ?? null,
    e.source,
    e.note ?? null,
  );
  return { ...e, id, date: localDate(e.at) };
}

export function updateEvent(id: string, patch: { at: string; kind: PunchEvent['kind']; note: string }) {
  db.prepare("UPDATE events SET at = ?, kind = ?, note = ?, source = 'admin' WHERE id = ?").run(patch.at, patch.kind, patch.note || null, id);
}

export function deleteEvent(id: string) {
  db.prepare('DELETE FROM events WHERE id = ?').run(id);
}

/* ---------- mails ---------- */

interface MailRow {
  id: string;
  key: string;
  kind: OutboxMessage['kind'];
  employee_id: string;
  week_start: string;
  from_addr: string;
  to_addr: string;
  subject: string;
  body: string;
  asks_yes_no: number;
  answer: 'yes' | 'no' | null;
  justification: string | null;
  answered_at: string | null;
  token: string;
  status: OutboxMessage['status'];
  created_at: string;
  sent_at: string | null;
  error: string | null;
}

const toMail = (r: MailRow): OutboxMessage & { token: string } => ({
  id: r.id,
  key: r.key,
  kind: r.kind,
  employeeId: r.employee_id,
  weekStart: r.week_start,
  from: r.from_addr,
  to: r.to_addr,
  subject: r.subject,
  body: r.body,
  asksYesNo: r.asks_yes_no === 1,
  answer: r.answer,
  justification: r.justification,
  answeredAt: r.answered_at,
  createdAt: r.created_at,
  status: r.status,
  sentAt: r.sent_at,
  error: r.error,
  token: r.token,
});

export function listMails(): (OutboxMessage & { token: string })[] {
  return (db.prepare('SELECT * FROM mails ORDER BY created_at DESC').all() as unknown as MailRow[]).map(toMail);
}

export function mailByKey(key: string) {
  const r = db.prepare('SELECT * FROM mails WHERE key = ?').get(key) as MailRow | undefined;
  return r && toMail(r);
}

export function mailByToken(token: string) {
  const r = db.prepare('SELECT * FROM mails WHERE token = ?').get(token) as MailRow | undefined;
  return r && toMail(r);
}

export function mailById(id: string) {
  const r = db.prepare('SELECT * FROM mails WHERE id = ?').get(id) as MailRow | undefined;
  return r && toMail(r);
}

/** Messages to the administrator are not about one employee: employee_id is ''. */
/** Inserts the message unless one with the same key exists. Returns the stored row, or null if it already existed. */
export function insertMail(m: Omit<OutboxMessage, 'id'>, token: string) {
  const id = newId('mail_');
  const res = db
    .prepare(
      `INSERT OR IGNORE INTO mails (id, key, kind, employee_id, week_start, from_addr, to_addr, subject, body, asks_yes_no, answer,
        justification, answered_at, token, status, created_at, sent_at, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, NULL, NULL)`,
    )
    .run(id, m.key, m.kind, m.employeeId, m.weekStart, m.from, m.to, m.subject, m.body, m.asksYesNo ? 1 : 0, token, m.status, m.createdAt);
  return res.changes ? mailById(id)! : null;
}

export function setMailStatus(id: string, status: OutboxMessage['status'], error: string | null) {
  db.prepare('UPDATE mails SET status = ?, error = ?, sent_at = ? WHERE id = ?').run(status, error, status === 'sent' ? new Date().toISOString() : null, id);
}

export function answerMail(id: string, answer: 'yes' | 'no', justification: string | null, atIso: string) {
  db.prepare('UPDATE mails SET answer = ?, justification = ?, answered_at = ? WHERE id = ?').run(answer, justification, atIso, id);
}

