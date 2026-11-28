/**
 * Punch card (Système 1) — shared contract between the week engine (engine.ts), the e-mail rules
 * (notify.ts), the face check (FaceCheck.tsx), the stores and the screens. Keep this file free of imports (shared with the punch server).
 *
 * Simple model: an employee types the last 4 digits of their phone, confirms identity with a photo,
 * then punches Entrée / Pause / Fin pause / Sortie. No rigid lunch or break rules.
 * Hours are counted per week (Sunday → Saturday) and drive e-mails at 10, 20, 30, 40 h.
 */

/** Events an employee can punch on the tablet. */
export type PunchKind = 'in' | 'pause_start' | 'pause_end' | 'out';

/** A pause written in the schedule (shown in the 30 h e-mail, never enforced). */
export interface PlannedPause {
  at: string; // 'HH:MM'
  minutes: number;
}

/** One scheduled shift in the week template. */
export interface DayShift {
  start: string; // 'HH:MM'
  end: string; // 'HH:MM' (same day)
  pauses: PlannedPause[];
}

/** Week template, index 0 = Sunday … 6 = Saturday; null = day off. */
export type WeekSchedule = (DayShift | null)[];

export interface PunchEmployee {
  id: string;
  name: string;
  /** Last 4 digits of the phone number: the code typed on the tablet. Unique among active employees. */
  phoneLast4: string;
  email: string;
  role?: string;
  schedule: WeekSchedule;
  active: boolean;
  /** ID photo taken at the first punch (small JPEG data URL), shown to the admin next to the code. Never a punch photo. */
  photo: string | null;
  /** A face reference exists (the descriptor itself stays on the server). */
  hasFace: boolean;
  /** Signed up alone on the tablet: the administrator must check and accept (schedule, e-mail). */
  toApprove: boolean;
}

/** Result of the photo identity check done at each punch. The photo itself is never stored. */
export type IdentityCheck =
  | 'verified' // face matches the employee's enrolled face
  | 'enrolled' // first punch: the face reference was just created
  | 'mismatch' // face did not match after the retries (punch kept, flagged)
  | 'no_camera' // no camera, permission refused or models unavailable (punch kept, flagged)
  | 'no_reference' // no reference face taken yet by the admin (punch kept, flagged)
  | 'off'; // photo check disabled in the settings

/** One punch, stored as typed on the tablet. */
export interface PunchEvent {
  id: string;
  employeeId: string;
  /** Local date 'YYYY-MM-DD'. */
  date: string;
  /** ISO timestamp of the punch. */
  at: string;
  kind: PunchKind;
  identity: IdentityCheck;
  /** Face distance to the reference when compared (lower = closer; match below FACE_MATCH_DISTANCE). */
  faceDistance?: number;
  /** 'kiosk' = punched on the tablet; 'admin' = added or corrected by an administrator. */
  source: 'kiosk' | 'admin';
  /** Admin note, e.g. why a punch was corrected. */
  note?: string;
}

/** Face reference of an employee: a 128-number descriptor, never a picture. id = employeeId. */
export interface FaceProfile {
  id: string;
  descriptor: number[];
  enrolledAt: string;
}

export interface PunchSettings {
  id: 'settings';
  /** Sender of every e-mail: the Gmail account set in .env.punch (pubco.ca Google account later). */
  senderEmail: string;
  /** Production director, warned at 35 h when an employee keeps working after their shift. */
  directorEmail: string;
  /** Ask a photo at each punch. */
  photoCheck: boolean;
  /** Hours between two summary e-mails to the administrator (grouped by hour brackets). */
  digestHours: number;
  /** When the last summary was sent ISO; null = never. */
  lastDigestAt: string | null;
}

/* ---------------- Week engine ---------------- */

export interface EngineEvent {
  kind: PunchKind;
  /** Epoch milliseconds. */
  at: number;
}

export interface WeekInput {
  schedule: WeekSchedule;
  /** Local midnight of the Sunday that starts the week, epoch ms. */
  weekStart: number;
  /** The employee's punches of that week, any order (the engine sorts them). */
  events: EngineEvent[];
  /** Current time, epoch ms. */
  now: number;
}

export type WorkStatus = 'off' | 'working' | 'pause';

export interface DaySummary {
  /** 'YYYY-MM-DD' local. */
  date: string;
  /** Worked = time punched in minus pauses. A segment counts on the day of its 'in'. */
  workedMinutes: number;
  pauseMinutes: number;
  shift: DayShift | null;
}

export interface UpcomingShift {
  date: string;
  /** 'Lundi 30 novembre' style label, French. */
  label: string;
  shift: DayShift;
  /** Scheduled minutes of this shift (end − start − pauses). */
  minutes: number;
}

export interface WeekSummary {
  status: WorkStatus;
  /** Total worked this week, ongoing segment included up to `now`. */
  workedMinutes: number;
  todayMinutes: number;
  days: DaySummary[]; // 7, Sunday first
  /** Thresholds already reached, in hours, among 10, 20, 30, 40. */
  reachedHours: number[];
  /** Shifts still ahead this week: today's if it has not ended yet, then the following days. */
  upcoming: UpcomingShift[];
  /** Scheduled minutes still ahead (today's remaining part + upcoming days). */
  remainingScheduledMinutes: number;
  /** workedMinutes + remainingScheduledMinutes. */
  projectedMinutes: number;
  /** Working or on pause now, and either no shift today or now is past today's shift end. */
  inPostShift: boolean;
  /** Punches allowed next (the kiosk shows only these buttons). */
  nextAllowed: PunchKind[];
}

/* ---------------- E-mails (sent by the punch server through Gmail) ---------------- */

export type MailKind = 'hours_10' | 'hours_20' | 'hours_30' | 'hours_40' | 'director_35' | 'admin_digest' | 'admin_faces' | 'admin_new';

/** Placeholder in the 30 h body, replaced by the server with the answer link (Oui / Non + justification). */
export const ANSWER_LINK = '{{lien_reponse}}';

export interface OutboxMessage {
  id: string;
  /** Deduplication key: one message per key, e.g. `emp_julie|2026-11-22|hours_30`. */
  key: string;
  kind: MailKind;
  employeeId: string;
  /** 'YYYY-MM-DD' of the week's Sunday. */
  weekStart: string;
  from: string;
  to: string;
  subject: string;
  /** Plain text body, French. */
  body: string;
  /** The 30 h message asks: will you go over 40 h this week? */
  asksYesNo: boolean;
  answer: 'yes' | 'no' | null;
  /** Why the employee wants to go over 40 h (asked when the answer is yes). */
  justification: string | null;
  answeredAt: string | null;
  createdAt: string;
  /** 'pending' until the server tried to send it; 'disabled' when no Gmail account is configured. */
  status: 'pending' | 'sent' | 'failed' | 'disabled' | 'grouped';
  sentAt: string | null;
  error: string | null;
}
