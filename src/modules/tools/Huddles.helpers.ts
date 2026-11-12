/** Helpers for the Huddles screen: labels, cadence sentence, form draft <-> stored huddle. */
import { PERSONAL_SECTIONS, TEAM_SECTIONS, type Huddle, type PersonalSection, type TeamSection } from './schemas';

/** Bilingual translation function (French first). */
export type Tr = (fr: string, en: string) => string;

/** Day names, Sunday = 0 as in the data model. Capitalised French for selects, lower-cased in sentences. */
const DAYS: { fr: string; en: string }[] = [
  { fr: 'Dimanche', en: 'Sunday' },
  { fr: 'Lundi', en: 'Monday' },
  { fr: 'Mardi', en: 'Tuesday' },
  { fr: 'Mercredi', en: 'Wednesday' },
  { fr: 'Jeudi', en: 'Thursday' },
  { fr: 'Vendredi', en: 'Friday' },
  { fr: 'Samedi', en: 'Saturday' },
];

/** Order shown in the day select: Monday first. */
export const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0];

export const dayLabel = (d: number, tr: Tr) => tr(DAYS[d].fr, DAYS[d].en);

/** Plain-language cadence, e.g. "Chaque lundi, 09:00–09:30" / "Every Monday, 09:00–09:30". */
export function cadenceText(h: Pick<Huddle, 'cadence' | 'dayOfWeek' | 'startTime' | 'endTime'>, tr: Tr): string {
  const day = DAYS[h.dayOfWeek] ?? DAYS[1];
  const when =
    h.cadence === 'daily'
      ? tr('Chaque jour ouvrable', 'Every weekday')
      : h.cadence === 'weekly'
        ? tr(`Chaque ${day.fr.toLowerCase()}`, `Every ${day.en}`)
        : tr(`Chaque mois, le ${day.fr.toLowerCase()}`, `Every month, on ${day.en}`);
  const time = h.startTime && h.endTime ? `${h.startTime}–${h.endTime}` : h.startTime || h.endTime;
  return time ? `${when}, ${time}` : when;
}

export function teamLabels(tr: Tr): Record<TeamSection, string> {
  return {
    agenda: tr('Ordre du jour', 'Agenda'),
    criticalNumbers: tr('Nombres critiques', 'Critical numbers'),
    kpis: tr('Performance de l’équipe (indicateurs)', 'Team performance (KPIs)'),
    priorities: tr('Priorités', 'Priorities'),
    tasks: tr('Qui – Quoi – Quand', 'Who – What – When'),
    parking: tr('Parking lot', 'Parking lot'),
    issues: tr('Enjeux', 'Issues'),
  };
}

export function personalLabels(tr: Tr): Record<PersonalSection, string> {
  return {
    whatsUp: tr('Quoi de neuf', 'What’s up'),
    feedback: tr('Rétroaction employés, clients, partenaires', 'Feedback from employees, customers, partners'),
    priorityProgress: tr('Progrès des priorités', 'Priority progress'),
    help: tr('Besoin d’aide', 'Need help'),
    stucks: tr('Blocages', 'Stuck points'),
  };
}

/** A section of the form: its key, and whether the huddle runs it. The array order is the display order. */
export interface SectionItem<K extends string> {
  key: K;
  on: boolean;
}

/** Editable copy of a huddle, as held by the form. */
export interface HuddleDraft {
  id?: string;
  name: string;
  teamId: string | null;
  ownerId: string | null;
  cadence: Huddle['cadence'];
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  videoUrl: string;
  description: string;
  memberIds: string[];
  teamSections: SectionItem<TeamSection>[];
  personalSections: SectionItem<PersonalSection>[];
  active: boolean;
}

/** Enabled sections first (in their saved order), then the disabled ones in the default order. */
export function orderSections<K extends string>(all: readonly K[], saved: readonly K[]): SectionItem<K>[] {
  return [
    ...saved.map((key) => ({ key, on: true })),
    ...all.filter((k) => !saved.includes(k)).map((key) => ({ key, on: false })),
  ];
}

/** Defaults for a new huddle. */
export function newDraft(ownerId: string | null): HuddleDraft {
  return {
    name: '',
    teamId: null,
    ownerId,
    cadence: 'weekly',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '09:30',
    videoUrl: '',
    description: '',
    memberIds: [],
    teamSections: orderSections(TEAM_SECTIONS, TEAM_SECTIONS),
    personalSections: orderSections(PERSONAL_SECTIONS, PERSONAL_SECTIONS),
    active: true,
  };
}

export function draftFromHuddle(h: Huddle): HuddleDraft {
  return {
    id: h.id,
    name: h.name,
    teamId: h.teamId,
    ownerId: h.ownerId,
    cadence: h.cadence,
    dayOfWeek: h.dayOfWeek,
    startTime: h.startTime,
    endTime: h.endTime,
    videoUrl: h.videoUrl,
    description: h.description,
    memberIds: [...h.memberIds],
    teamSections: orderSections(TEAM_SECTIONS, h.teamSections),
    personalSections: orderSections(PERSONAL_SECTIONS, h.personalSections),
    active: h.active,
  };
}

/** The stored fields of a huddle (no id, no server stamps). */
export function toPayload(d: HuddleDraft): Omit<Huddle, 'id'> {
  return {
    name: d.name,
    teamId: d.teamId,
    ownerId: d.ownerId,
    cadence: d.cadence,
    dayOfWeek: d.dayOfWeek,
    startTime: d.startTime,
    endTime: d.endTime,
    videoUrl: d.videoUrl,
    description: d.description,
    memberIds: d.memberIds,
    teamSections: d.teamSections.filter((s) => s.on).map((s) => s.key),
    personalSections: d.personalSections.filter((s) => s.on).map((s) => s.key),
    active: d.active,
  };
}

/** Only web links are rendered as links or accepted as a video link. */
export const isWebUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);
