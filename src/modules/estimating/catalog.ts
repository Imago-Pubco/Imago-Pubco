/** Reference lists for packaging specs (to be refined with the estimating team). */
import type { L } from '@/i18n';
import type { PackagingType } from './types';

export const PACKAGING_TYPES: { key: PackagingType; label: L; hint: L }[] = [
  { key: 'folding', label: { fr: 'Boîte pliante', en: 'Folding carton' }, hint: { fr: 'Carton plat, SBS / CRB', en: 'Paperboard, SBS / CRB' } },
  { key: 'corrugated', label: { fr: 'Carton ondulé', en: 'Corrugated box' }, hint: { fr: 'Cannelures B, C, E, BC', en: 'B, C, E, BC flutes' } },
  { key: 'rigid', label: { fr: 'Boîte rigide', en: 'Rigid box' }, hint: { fr: 'Carton gris recouvert', en: 'Wrapped chipboard' } },
  { key: 'display', label: { fr: 'Présentoir', en: 'Display' }, hint: { fr: 'Comptoir, plancher, PLV', en: 'Counter, floor, POP' } },
  { key: 'copacking', label: { fr: 'Co-packing', en: 'Co-packing' }, hint: { fr: 'Assemblage, kits, ensachage', en: 'Assembly, kitting, bagging' } },
];

export const STYLES: Record<PackagingType, { code: string; label: L }[]> = {
  folding: [
    { code: 'ECMA A20.20.03.01', label: { fr: 'Rabat inversé (RTE)', en: 'Reverse tuck end (RTE)' } },
    { code: 'ECMA A20.20.01.01', label: { fr: 'Rabat droit (STE)', en: 'Straight tuck end (STE)' } },
    { code: 'ECMA A60.20.00.01', label: { fr: 'Fond automatique', en: 'Auto-lock bottom' } },
    { code: 'ECMA F42', label: { fr: 'Plateau', en: 'Tray' } },
    { code: 'ECMA C10', label: { fr: 'Manchon', en: 'Sleeve' } },
  ],
  corrugated: [
    { code: 'FEFCO 0201', label: { fr: 'Caisse américaine (RSC)', en: 'Regular slotted container (RSC)' } },
    { code: 'FEFCO 0427', label: { fr: 'Boîte postale (mailer)', en: 'Mailer box' } },
    { code: 'FEFCO 0300', label: { fr: 'Boîte à couvercle', en: 'Telescope box' } },
    { code: 'FEFCO 0711', label: { fr: 'Fond automatique', en: 'Crash-lock bottom' } },
  ],
  rigid: [
    { code: 'RIG-LID', label: { fr: 'Couvercle et fond', en: 'Lid and base' } },
    { code: 'RIG-MAG', label: { fr: 'Aimantée (livre)', en: 'Magnetic book-style' } },
    { code: 'RIG-DRAW', label: { fr: 'Tiroir', en: 'Drawer' } },
  ],
  display: [
    { code: 'DSP-CTR', label: { fr: 'Présentoir de comptoir', en: 'Counter display' } },
    { code: 'DSP-FLR', label: { fr: 'Présentoir de plancher', en: 'Floor display' } },
    { code: 'DSP-PDQ', label: { fr: 'Plateau PDQ', en: 'PDQ tray' } },
  ],
  copacking: [
    { code: 'CPK-KIT', label: { fr: 'Assemblage de kits', en: 'Kit assembly' } },
    { code: 'CPK-SHR', label: { fr: 'Emballage rétractable', en: 'Shrink wrapping' } },
    { code: 'CPK-FIL', label: { fr: 'Remplissage / insertion', en: 'Filling / insertion' } },
  ],
};

export const FINISHES: { key: string; label: L }[] = [
  { key: 'aqueous', label: { fr: 'Vernis aqueux', en: 'Aqueous coating' } },
  { key: 'uv', label: { fr: 'Vernis UV', en: 'UV coating' } },
  { key: 'spotuv', label: { fr: 'UV sélectif', en: 'Spot UV' } },
  { key: 'matte', label: { fr: 'Laminage mat', en: 'Matte lamination' } },
  { key: 'gloss', label: { fr: 'Laminage lustré', en: 'Gloss lamination' } },
  { key: 'foil', label: { fr: 'Dorure à chaud', en: 'Hot foil stamping' } },
  { key: 'emboss', label: { fr: 'Gaufrage', en: 'Embossing' } },
];

export const OPTIONS: { key: string; label: L }[] = [
  { key: 'window', label: { fr: 'Fenêtre PET', en: 'PET window' } },
  { key: 'insert', label: { fr: 'Insert / calage', en: 'Insert' } },
  { key: 'handle', label: { fr: 'Poignée', en: 'Handle' } },
  { key: 'glue', label: { fr: 'Collage', en: 'Gluing' } },
  { key: 'assembly', label: { fr: 'Assemblage manuel', en: 'Hand assembly' } },
  { key: 'tape', label: { fr: 'Bande d’ouverture', en: 'Tear strip' } },
];

export const PRINT_PROCESSES: { key: 'offset' | 'flexo' | 'digital' | 'none'; label: L }[] = [
  { key: 'offset', label: { fr: 'Offset', en: 'Offset' } },
  { key: 'flexo', label: { fr: 'Flexographie', en: 'Flexo' } },
  { key: 'digital', label: { fr: 'Numérique', en: 'Digital' } },
  { key: 'none', label: { fr: 'Sans impression', en: 'No print' } },
];
