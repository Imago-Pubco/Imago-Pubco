/** Development seed — placeholder addresses; replace ship-from with real plant addresses in Settings. */
import type { SavedAddress, ShipFrom, ShippingLabel } from './types';

export const seedShipFroms: ShipFrom[] = [
  {
    id: 'sf1',
    label: 'Usine principale',
    isDefault: true,
    name: 'Pubco',
    attention: 'Expédition',
    street: '1000, rue de l’Exemple',
    city: 'Québec',
    province: 'QC',
    postalCode: 'G1X 0A0',
    country: 'CA',
    phone: '418 555-0100',
  },
];

export const seedAddresses: SavedAddress[] = [
  { id: 'ad1', code: 'C-2041', name: 'Boutique Horizon', attention: 'Réception marchandises', street: '250, boul. des Entreprises', city: 'Laval', province: 'QC', postalCode: 'H7L 0A1', country: 'CA', phone: '450 555-0142' },
  { id: 'ad2', code: 'C-3310', name: 'Distribution Nordet', attention: 'Quai 4', street: '75, rue Industrielle', city: 'Drummondville', province: 'QC', postalCode: 'J2C 0B2', country: 'CA', phone: '819 555-0177' },
  { id: 'ad3', code: 'C-1188', name: 'Maison Élégance Cosmétiques', attention: 'Marketing — présentoirs', street: '1200, av. du Parc', street2: 'Bureau 300', city: 'Montréal', province: 'QC', postalCode: 'H2V 0C3', country: 'CA', phone: '514 555-0199' },
  { id: 'ad4', code: 'C-5020', name: 'Great Lakes Retail Co.', attention: 'Receiving', street: '88 Commerce Drive', city: 'Mississauga', province: 'ON', postalCode: 'L5T 0D4', country: 'CA', phone: '905 555-0123' },
];

export const seedLabels: ShippingLabel[] = [
  {
    id: 'lb1',
    no: 'SHP-000001',
    status: 'shipped',
    shipFromId: 'sf1',
    shipTo: seedAddresses[0],
    carrier: 'Purolator',
    service: 'Ground',
    jobNo: 'J-24-0871',
    customerPo: 'HZ-5521',
    packages: [
      { id: 'p1', weightKg: 18.5, lengthCm: 120, widthCm: 80, heightCm: 60, description: 'Présentoirs de comptoir' },
      { id: 'p2', weightKg: 18.5, lengthCm: 120, widthCm: 80, heightCm: 60, description: 'Présentoirs de comptoir' },
    ],
    instructions: 'Fragile — ne pas empiler',
    trackingNo: '329847561024',
    createdAt: new Date(Date.now() - 3 * 864e5).toISOString(),
    createdBy: 'u_prod',
    printedAt: new Date(Date.now() - 3 * 864e5).toISOString(),
    printCount: 1,
    shippedAt: new Date(Date.now() - 2.8 * 864e5).toISOString(),
  },
  {
    id: 'lb2',
    no: 'SHP-000002',
    status: 'draft',
    shipFromId: 'sf1',
    shipTo: seedAddresses[2],
    carrier: 'UPS',
    service: 'Standard',
    jobNo: 'J-24-0902',
    customerPo: 'MEC-7730',
    packages: [{ id: 'p3', weightKg: 6.2, lengthCm: 60, widthCm: 40, heightCm: 40, description: 'Boîtes pliantes imprimées' }],
    instructions: '',
    createdAt: new Date(Date.now() - 4 * 36e5).toISOString(),
    createdBy: 'u_prod',
  },
];
