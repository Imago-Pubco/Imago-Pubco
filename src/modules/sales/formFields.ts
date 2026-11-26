/**
 * Public packaging request form (default questions). Shared by the public page (browser) and the server,
 * which can replace it with the version stored in app.settings 'sales.form'.
 * Answers are keyed by field id. `maps` says which part of the request each answer fills.
 */
import type { FormField, SalesRequest } from './types';
import type { PackagingSpec, PackagingType } from '../estimating/types';
import { FINISHES, OPTIONS, PACKAGING_TYPES } from '../estimating/catalog.ts';

const PRINT_VALUES = ['offset', 'flexo', 'digital', 'none'] as const;

export const DEFAULT_REQUEST_FORM: FormField[] = [
  { id: 'company', label: { fr: 'Entreprise', en: 'Company' }, type: 'text', required: true, maps: 'customer' },
  { id: 'contact', label: { fr: 'Personne-ressource', en: 'Contact person' }, type: 'text', required: true, maps: 'contact' },
  { id: 'email', label: { fr: 'Courriel', en: 'E-mail' }, type: 'text', required: true, maps: 'email' },
  { id: 'phone', label: { fr: 'Téléphone', en: 'Phone' }, type: 'text', maps: 'phone' },
  { id: 'project', label: { fr: 'Nom du projet', en: 'Project name' }, type: 'text', maps: 'project' },
  {
    id: 'need',
    label: { fr: 'De quoi avez-vous besoin ?', en: 'What do you need?' },
    type: 'textarea',
    required: true,
    help: { fr: 'Décrivez le produit, son usage et ce que vous souhaitez.', en: 'Describe the product, how it is used and what you want.' },
  },
  {
    id: 'type',
    label: { fr: 'Type d’emballage', en: 'Packaging type' },
    type: 'select',
    maps: 'type',
    options: PACKAGING_TYPES.map((t) => ({ value: t.key, label: t.label })),
  },
  {
    id: 'lengthMm',
    label: { fr: 'Longueur intérieure (mm)', en: 'Inside length (mm)' },
    type: 'number',
    maps: 'lengthMm',
    help: { fr: 'Dimensions intérieures. Approximatives, c’est correct.', en: 'Inside dimensions. Approximate is fine.' },
  },
  { id: 'widthMm', label: { fr: 'Largeur intérieure (mm)', en: 'Inside width (mm)' }, type: 'number', maps: 'widthMm' },
  { id: 'heightMm', label: { fr: 'Hauteur intérieure (mm)', en: 'Inside height (mm)' }, type: 'number', maps: 'heightMm' },
  {
    id: 'quantities',
    label: { fr: 'Quantités souhaitées', en: 'Quantities wanted' },
    type: 'text',
    maps: 'quantities',
    help: { fr: 'Plusieurs quantités séparées par des virgules, ex. 1000, 2500, 5000', en: 'Several quantities separated by commas, e.g. 1000, 2500, 5000' },
  },
  {
    id: 'dueDate',
    label: { fr: 'Date requise', en: 'Date needed' },
    type: 'text',
    maps: 'dueDate',
    help: { fr: 'Format AAAA-MM-JJ', en: 'Format YYYY-MM-DD' },
  },
  {
    id: 'material',
    label: { fr: 'Matériau préféré', en: 'Preferred material' },
    type: 'select',
    maps: 'material',
    options: [
      { value: 'carton', label: { fr: 'Carton plat', en: 'Paperboard' } },
      { value: 'corrugated', label: { fr: 'Carton ondulé', en: 'Corrugated' } },
      { value: 'rigid', label: { fr: 'Carton gris (rigide)', en: 'Chipboard (rigid)' } },
      { value: 'plastic', label: { fr: 'Plastique', en: 'Plastic' } },
      { value: 'unsure', label: { fr: 'Je ne sais pas', en: 'Not sure' } },
    ],
  },
  {
    id: 'printing',
    label: { fr: 'Impression', en: 'Printing' },
    type: 'select',
    maps: 'printProcess',
    options: [
      { value: 'offset', label: { fr: 'Offset', en: 'Offset' } },
      { value: 'flexo', label: { fr: 'Flexographie', en: 'Flexo' } },
      { value: 'digital', label: { fr: 'Numérique', en: 'Digital' } },
      { value: 'none', label: { fr: 'Sans impression', en: 'No print' } },
      { value: 'unsure', label: { fr: 'Je ne sais pas', en: 'Not sure' } },
    ],
  },
  { id: 'colorsOutside', label: { fr: 'Couleurs extérieur', en: 'Outside colours' }, type: 'number', maps: 'colorsOutside' },
  { id: 'colorsInside', label: { fr: 'Couleurs intérieur', en: 'Inside colours' }, type: 'number', maps: 'colorsInside' },
  {
    id: 'finishes',
    label: { fr: 'Finitions', en: 'Finishes' },
    type: 'multiselect',
    maps: 'finishes',
    options: FINISHES.map((f) => ({ value: f.key, label: f.label })),
  },
  {
    id: 'options',
    label: { fr: 'Options', en: 'Options' },
    type: 'multiselect',
    maps: 'options',
    options: OPTIONS.map((o) => ({ value: o.key, label: o.label })),
  },
  { id: 'dueDateNote', label: { fr: 'Date limite, si applicable', en: 'Hard deadline, if any' }, type: 'text' },
  {
    id: 'files',
    label: { fr: 'Fichiers (graphisme, croquis, photos)', en: 'Files (artwork, sketches, photos)' },
    type: 'file',
    help: { fr: 'Images ou PDF, 4 Mo maximum chacun.', en: 'Images or PDF, 4 MB maximum each.' },
  },
  { id: 'notes', label: { fr: 'Autres remarques', en: 'Other remarks' }, type: 'textarea', maps: 'notes' },
];

/** "1000, 2 500 / 5000" -> [1000, 2500, 5000] (separators: comma, semicolon, slash, new line). */
export function parseQuantities(s: string): number[] {
  const out: number[] = [];
  for (const part of s.split(/[,;/\n]+/)) {
    const n = Number(part.replace(/\D/g, ''));
    if (Number.isFinite(n) && n > 0 && n <= 10_000_000 && !out.includes(n)) out.push(n);
    if (out.length >= 12) break;
  }
  return out;
}

const parseMm = (s: string): number | undefined => {
  const n = Number(s.replace(/[\s  ]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 5000 ? Math.round(n) : undefined;
};
const parseCount = (s: string): number | undefined => {
  const n = Number(s.replace(/\s/g, ''));
  return Number.isInteger(n) && n >= 0 && n <= 12 ? n : undefined;
};
const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

const MATERIAL_LABEL: Record<string, string> = {
  carton: 'carton plat',
  corrugated: 'carton ondulé',
  rigid: 'carton gris (rigide)',
  plastic: 'plastique',
};

/** Turns the form answers (keyed by field id) into the request fields. Empty values are left empty so the AI can fill them. */
export function answersToRequestFields(
  answers: Record<string, string>,
  fields: FormField[] = DEFAULT_REQUEST_FORM,
): Partial<Pick<SalesRequest, 'customer' | 'contact' | 'email' | 'phone' | 'project' | 'dueDate' | 'quantities' | 'spec' | 'description'>> {
  const val = (f: FormField | undefined) => (f ? String(answers[f.id] ?? '').trim().slice(0, 4000) : '');
  const pick = (maps: NonNullable<FormField['maps']>) => val(fields.find((f) => f.maps === maps));
  const dueRaw = pick('dueDate');
  const spec: Partial<PackagingSpec> = {};

  const type = pick('type') as PackagingType;
  if (PACKAGING_TYPES.some((t) => t.key === type)) spec.type = type;
  const lengthMm = parseMm(pick('lengthMm'));
  const widthMm = parseMm(pick('widthMm'));
  const heightMm = parseMm(pick('heightMm'));
  if (lengthMm !== undefined) spec.lengthMm = lengthMm;
  if (widthMm !== undefined) spec.widthMm = widthMm;
  if (heightMm !== undefined) spec.heightMm = heightMm;
  const printing = pick('printProcess');
  if ((PRINT_VALUES as readonly string[]).includes(printing)) spec.printProcess = printing as PackagingSpec['printProcess'];
  const colorsOutside = parseCount(pick('colorsOutside'));
  const colorsInside = parseCount(pick('colorsInside'));
  if (colorsOutside !== undefined) spec.colorsOutside = colorsOutside;
  if (colorsInside !== undefined) spec.colorsInside = colorsInside;
  spec.finishes = splitList(pick('finishes')).filter((k) => FINISHES.some((f) => f.key === k));
  spec.options = splitList(pick('options')).filter((k) => OPTIONS.some((o) => o.key === k));

  const material = pick('material');
  const notes = [pick('notes'), MATERIAL_LABEL[material] ? `Matériau souhaité : ${MATERIAL_LABEL[material]}` : '', val(fields.find((f) => f.id === 'dueDateNote')) ? `Date limite : ${val(fields.find((f) => f.id === 'dueDateNote'))}` : '']
    .filter(Boolean)
    .join('\n');
  if (notes) spec.notes = notes;

  const descField = fields.find((f) => f.id === 'need') ?? fields.find((f) => f.type === 'textarea' && !f.maps);

  return {
    customer: pick('customer'),
    contact: pick('contact'),
    email: pick('email'),
    phone: pick('phone'),
    project: pick('project'),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : '',
    quantities: parseQuantities(pick('quantities')),
    description: val(descField),
    spec,
  };
}
