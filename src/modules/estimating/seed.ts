/** Development seed — fictional customers and indicative material costs. */
import type { Estimate, Material, PackagingSpec } from './types';

export const seedMaterials: Material[] = [
  { id: 'mat1', code: 'SBS-18', name: 'Carton SBS blanchi', category: 'carton', caliper: '18 pt', costPerM2: 0.92 },
  { id: 'mat2', code: 'SBS-24', name: 'Carton SBS blanchi', category: 'carton', caliper: '24 pt', costPerM2: 1.18 },
  { id: 'mat3', code: 'CRB-20', name: 'Carton recyclé CRB', category: 'carton', caliper: '20 pt', costPerM2: 0.71 },
  { id: 'mat4', code: 'ECT32-C', name: 'Ondulé cannelure C 32 ECT', category: 'corrugated', caliper: 'C', costPerM2: 0.84 },
  { id: 'mat5', code: 'ECT44-BC', name: 'Ondulé double BC 44 ECT', category: 'corrugated', caliper: 'BC', costPerM2: 1.36 },
  { id: 'mat6', code: 'E-FLUTE', name: 'Microcannelure E', category: 'corrugated', caliper: 'E', costPerM2: 0.95 },
  { id: 'mat7', code: 'GREY-2MM', name: 'Carton gris 2 mm + papier couché', category: 'rigid', caliper: '2 mm', costPerM2: 3.4 },
  { id: 'mat8', code: 'PET-030', name: 'Feuille PET transparente', category: 'plastic', caliper: '0,30 mm', costPerM2: 2.1 },
];

const spec = (s: Partial<PackagingSpec>): PackagingSpec => ({
  type: 'folding',
  style: 'ECMA A20.20.03.01',
  lengthMm: 80,
  widthMm: 50,
  heightMm: 150,
  materialId: 'mat1',
  printProcess: 'offset',
  colorsOutside: 4,
  colorsInside: 0,
  finishes: [],
  options: [],
  newDie: true,
  notes: '',
  ...s,
});

const d = (days: number) => new Date(Date.now() + days * 864e5).toISOString();

export const seedEstimates: Estimate[] = [
  {
    id: 'est1', no: 'EST-26-0001', status: 'costing', customer: 'Maison Élégance Cosmétiques', contact: 'Julie Tremblay', email: 'julie@exemple.ca',
    project: 'Coffret sérum — lancement printemps', dueDate: d(4).slice(0, 10), ownerId: 'u_admin',
    spec: spec({ type: 'folding', style: 'ECMA A20.20.03.01', lengthMm: 45, widthMm: 45, heightMm: 130, materialId: 'mat2', colorsOutside: 5, finishes: ['matte', 'foil'], options: ['insert'] }),
    quantities: [2500, 5000, 10000], marginPct: 32, internalNotes: 'Dorure or sur logo. Échantillon demandé.',
    createdAt: d(-2), updatedAt: d(-1), createdBy: 'u_admin', history: [{ at: d(-2), userId: 'u_admin', action: 'created' }],
  },
  {
    id: 'est2', no: 'EST-26-0002', status: 'sent', customer: 'Distribution Nordet', contact: 'Marc Gagnon', email: 'marc@exemple.ca',
    project: 'Caisses d’expédition e-commerce', dueDate: d(-3).slice(0, 10), ownerId: 'u_admin',
    spec: spec({ type: 'corrugated', style: 'FEFCO 0427', lengthMm: 300, widthMm: 220, heightMm: 100, materialId: 'mat6', printProcess: 'flexo', colorsOutside: 1, colorsInside: 1, newDie: false }),
    quantities: [5000, 20000], marginPct: 25, internalNotes: '',
    createdAt: d(-9), updatedAt: d(-5), createdBy: 'u_admin', history: [{ at: d(-9), userId: 'u_admin', action: 'created' }, { at: d(-5), userId: 'u_admin', action: 'sent' }],
  },
  {
    id: 'est3', no: 'EST-26-0003', status: 'won', customer: 'Boutique Horizon', contact: 'Sophie Roy', email: 'sophie@exemple.ca',
    project: 'Présentoir comptoir — collection été', dueDate: d(-12).slice(0, 10), ownerId: 'u_admin',
    spec: spec({ type: 'display', style: 'DSP-CTR', lengthMm: 350, widthMm: 250, heightMm: 400, materialId: 'mat4', printProcess: 'digital', colorsOutside: 4, finishes: ['aqueous'], options: ['assembly'] }),
    quantities: [250, 500], marginPct: 35, internalNotes: '',
    createdAt: d(-20), updatedAt: d(-11), createdBy: 'u_admin', history: [{ at: d(-20), userId: 'u_admin', action: 'created' }, { at: d(-15), userId: 'u_admin', action: 'sent' }, { at: d(-11), userId: 'u_admin', action: 'won' }],
  },
  {
    id: 'est4', no: 'EST-26-0004', status: 'draft', customer: 'Great Lakes Retail Co.', contact: 'Emma Wilson', email: 'emma@example.com',
    project: 'Gift box — holiday', dueDate: d(10).slice(0, 10), ownerId: 'u_admin',
    spec: spec({ type: 'rigid', style: 'RIG-MAG', lengthMm: 220, widthMm: 160, heightMm: 60, materialId: 'mat7', printProcess: 'offset', colorsOutside: 4, finishes: ['spotuv'], options: ['insert'] }),
    quantities: [1000, 3000], marginPct: 30, internalNotes: '',
    createdAt: d(-1), updatedAt: d(-1), createdBy: 'u_admin', history: [{ at: d(-1), userId: 'u_admin', action: 'created' }],
  },
];
