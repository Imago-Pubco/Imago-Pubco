/**
 * Pure helpers for the menu editor: edit operations on the draft, id generation, validation before save.
 * The draft keeps partial module names (one language filled) so the inputs can be typed in; prepareMenu() rejects them.
 */
import type { L } from '@/i18n';
import type { ModuleDef } from '@/modules/types';
import type { MenuLayout, MenuName } from '@/layout/menuSchema';

export type MenuSection = MenuLayout['sections'][number];

export const MAX_SECTIONS = 30;
const NAME_MAX = 60;
const ID_RE = /^[a-z0-9_-]{1,40}$/;
export const NEW_SECTION_LABEL: MenuName = { fr: 'Nouvelle section', en: 'New section' };

export type MenuOp =
  | { type: 'section-add' }
  | { type: 'section-label'; index: number; label: MenuName | null }
  | { type: 'section-move'; index: number; dir: -1 | 1 }
  | { type: 'section-delete'; index: number }
  | { type: 'module-move'; section: number; index: number; dir: -1 | 1 }
  | { type: 'module-to'; from: number; index: number; to: number }
  | { type: 'module-name'; id: string; lang: 'fr' | 'en'; value: string };

function swap<T>(list: T[], i: number, j: number): T[] {
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

function replaceSection(d: MenuLayout, index: number, fn: (s: MenuSection) => MenuSection): MenuLayout {
  return { ...d, sections: d.sections.map((s, i) => (i === index ? fn(s) : s)) };
}

/** Lowercase, accents removed, runs of other characters become one '-', at most 40 characters. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

/** A section id not used by the other sections; `section-<n>` when the name gives nothing usable. */
export function uniqueSectionId(sections: MenuSection[], name: string, n: number): string {
  const base = slugify(name) || `section-${n}`;
  const taken = new Set(sections.map((s) => s.id));
  if (!taken.has(base)) return base;
  for (let k = 2; ; k++) {
    const suffix = `-${k}`;
    const candidate = `${base.slice(0, 40 - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Heading of a section, by its FR name, or 'Sans titre n' (n = position) when it has none. */
export function sectionTitle(label: MenuName | null, index: number): string {
  return label?.fr.trim() || `Sans titre ${index + 1}`;
}

/** The name a module shows in the sidebar: the override when both languages are filled, else the default. */
export function effectiveName(m: ModuleDef, names: MenuLayout['names']): L {
  const n = names[m.id];
  return n && n.fr.trim() && n.en.trim() ? { fr: n.fr.trim(), en: n.en.trim() } : m.name;
}

/** Applies one edit to the draft and returns the new draft (the input is never mutated). */
export function applyOp(d: MenuLayout, op: MenuOp): MenuLayout {
  const sections = d.sections;
  switch (op.type) {
    case 'section-add': {
      if (sections.length >= MAX_SECTIONS) return d;
      const id = uniqueSectionId(sections, NEW_SECTION_LABEL.fr, sections.length + 1);
      return { ...d, sections: [...sections, { id, label: { ...NEW_SECTION_LABEL }, moduleIds: [] }] };
    }
    case 'section-label':
      return replaceSection(d, op.index, (s) => ({ ...s, label: op.label }));
    case 'section-move': {
      const j = op.index + op.dir;
      if (j < 0 || j >= sections.length) return d;
      return { ...d, sections: swap(sections, op.index, j) };
    }
    case 'section-delete': {
      // A section keeps its modules until they are moved: nothing disappears from the menu.
      if (!sections[op.index] || sections[op.index].moduleIds.length) return d;
      return { ...d, sections: sections.filter((_, i) => i !== op.index) };
    }
    case 'module-move': {
      const s = sections[op.section];
      const j = op.index + op.dir;
      if (!s || j < 0 || j >= s.moduleIds.length) return d;
      return replaceSection(d, op.section, (sec) => ({ ...sec, moduleIds: swap(sec.moduleIds, op.index, j) }));
    }
    case 'module-to': {
      const from = sections[op.from];
      const to = sections[op.to];
      const id = from?.moduleIds[op.index];
      if (!from || !to || id === undefined || op.from === op.to) return d;
      return {
        ...d,
        sections: sections.map((s, i) => {
          if (i === op.from) return { ...s, moduleIds: s.moduleIds.filter((_, k) => k !== op.index) };
          if (i === op.to) return { ...s, moduleIds: [...s.moduleIds, id] };
          return s;
        }),
      };
    }
    case 'module-name': {
      const next = { ...(d.names[op.id] ?? { fr: '', en: '' }), [op.lang]: op.value };
      const names = { ...d.names };
      if (!next.fr.trim() && !next.en.trim()) delete names[op.id];
      else names[op.id] = next;
      return { ...d, names };
    }
  }
}

/** Stable text of a layout (key order and whitespace independent), used to detect unsaved changes. */
export function canon(l: MenuLayout): string {
  return JSON.stringify({
    sections: l.sections.map((s) => ({ id: s.id, label: s.label ? { fr: s.label.fr, en: s.label.en } : null, moduleIds: s.moduleIds })),
    names: Object.fromEntries(
      Object.keys(l.names)
        .sort()
        .map((k) => [k, { fr: l.names[k].fr, en: l.names[k].en }]),
    ),
  });
}

/** Audit detail: the sections with their modules, and the modules with a custom name. */
export function summarizeMenu(m: MenuLayout): string {
  const structure = m.sections.map((s) => `${s.label?.fr ?? '(sans titre)'}: ${s.moduleIds.join(', ') || '-'}`).join(' | ');
  const names = Object.keys(m.names);
  return names.length ? `${structure} | noms: ${names.join(', ')}` : structure;
}

/**
 * Checks the draft before saving. Returns the trimmed layout to save, or the first problem found (bilingual).
 * Module names are both-or-none: an emptied pair is dropped.
 */
export function prepareMenu(d: MenuLayout, modules: ModuleDef[]): { menu: MenuLayout } | { error: L } {
  if (d.sections.length > MAX_SECTIONS) {
    return { error: { fr: `Le menu compte au plus ${MAX_SECTIONS} sections.`, en: `The menu can have at most ${MAX_SECTIONS} sections.` } };
  }
  const ids = new Set<string>();
  const sections: MenuSection[] = [];
  for (const [i, s] of d.sections.entries()) {
    const title = sectionTitle(s.label, i);
    if (!ID_RE.test(s.id)) {
      return { error: { fr: `Identifiant de section invalide : « ${s.id} ».`, en: `Invalid section id: “${s.id}”.` } };
    }
    if (ids.has(s.id)) {
      return { error: { fr: `Deux sections ont l’identifiant « ${s.id} ».`, en: `Two sections share the id “${s.id}”.` } };
    }
    ids.add(s.id);
    let label: MenuName | null = null;
    if (s.label) {
      const fr = s.label.fr.trim();
      const en = s.label.en.trim();
      if (!fr || !en) {
        return {
          error: {
            fr: `« ${title} » : le nom FR et le nom EN sont requis (ou cochez « Sans titre »).`,
            en: `“${title}”: the FR and EN names are required (or tick “Untitled”).`,
          },
        };
      }
      if (fr.length > NAME_MAX || en.length > NAME_MAX) {
        return { error: { fr: `« ${title} » : ${NAME_MAX} caractères maximum par nom.`, en: `“${title}”: ${NAME_MAX} characters maximum per name.` } };
      }
      label = { fr, en };
    }
    sections.push({ id: s.id, label, moduleIds: [...s.moduleIds] });
  }

  const names: MenuLayout['names'] = {};
  for (const [id, n] of Object.entries(d.names)) {
    const fr = n.fr.trim();
    const en = n.en.trim();
    if (!fr && !en) continue;
    const who = modules.find((m) => m.id === id)?.name ?? { fr: id, en: id };
    if (!fr || !en) {
      return {
        error: {
          fr: `${who.fr} : remplissez le nom affiché FR et EN, ou aucun des deux.`,
          en: `${who.en}: fill in the displayed name in both FR and EN, or in neither.`,
        },
      };
    }
    if (fr.length > NAME_MAX || en.length > NAME_MAX) {
      return { error: { fr: `${who.fr} : ${NAME_MAX} caractères maximum par nom.`, en: `${who.en}: ${NAME_MAX} characters maximum per name.` } };
    }
    names[id] = { fr, en };
  }
  return { menu: { sections, names } };
}
