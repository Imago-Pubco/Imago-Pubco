/**
 * Development seed data — fictional vendors, Business Central purchase orders
 * and vendor e-mails. Each e-mail exercises a different matching scenario.
 */
import type { BcPurchaseOrder, BcVendor, ExtractedInvoice, MailMessage } from './types';

const TAX = 0.14975; // TPS 5 % + TVQ 9,975 %
const r2 = (n: number) => Math.round(n * 100) / 100;

export const seedVendors: BcVendor[] = [
  { id: 'v1', no: 'V10010', name: 'Cartonnerie Laurentide inc.', email: 'factures@cartonnerie-laurentide.example', currency: 'CAD' },
  { id: 'v2', no: 'V10020', name: 'Encres Boréal ltée', email: 'comptes@encresboreal.example', currency: 'CAD' },
  { id: 'v3', no: 'V10030', name: 'Plastiques Nordik', email: 'ar@plastiquesnordik.example', currency: 'CAD' },
  { id: 'v4', no: 'V10040', name: 'Adhésifs Pro-Colle', email: 'facturation@procolle.example', currency: 'CAD' },
  { id: 'v5', no: 'V10050', name: 'Films Saint-Laurent', email: 'billing@filmsstlaurent.example', currency: 'CAD' },
  { id: 'v6', no: 'V10060', name: 'Palettes Rive-Sud', email: 'info@palettesrivesud.example', currency: 'CAD' },
];

const po = (
  id: string,
  no: string,
  v: BcVendor,
  daysAgo: number,
  lines: [string, string, string, number, number, number, number][],
): BcPurchaseOrder => ({
  id,
  no,
  vendorNo: v.no,
  vendorName: v.name,
  orderDate: new Date(Date.now() - daysAgo * 864e5).toISOString(),
  status: 'Released',
  currency: 'CAD',
  lines: lines.map(([itemNo, description, uom, quantity, quantityReceived, quantityInvoiced, directUnitCost], i) => ({
    lineNo: (i + 1) * 10000,
    itemNo,
    description,
    uom,
    quantity,
    quantityReceived,
    quantityInvoiced,
    directUnitCost,
  })),
});

const [V1, V2, V3, V4, V5, V6] = seedVendors;

export const seedPurchaseOrders: BcPurchaseOrder[] = [
  po('po1', 'PO-24-10512', V1, 21, [
    ['CART-C32-4896', 'Carton ondulé C32 ECT 48x96', 'FEUILLE', 2000, 2000, 0, 3.85],
    ['CART-B-4060', 'Carton cannelure B 40x60', 'FEUILLE', 1500, 1500, 0, 2.12],
  ]),
  po('po2', 'PO-24-10518', V2, 18, [
    ['ENC-PMS-185', 'Encre Pantone 185 C (rouge) 2,5 kg', 'CONT', 120, 100, 0, 86.5],
    ['ENC-NOIR-UV', 'Encre noire UV 1 kg', 'CONT', 60, 60, 0, 42],
  ]),
  po('po3', 'PO-24-10521', V3, 15, [
    ['PET-FEU-030', 'Feuille PET transparente 0,30 mm 28x40', 'FEUILLE', 5000, 5000, 0, 0.92],
    ['PET-FEU-050', 'Feuille PET 0,50 mm 28x40', 'FEUILLE', 2000, 2000, 0, 1.45],
  ]),
  po('po4', 'PO-24-10530', V4, 12, [['COL-HM-25', 'Colle thermofusible 25 kg', 'SAC', 10, 8, 0, 145]]),
  po('po5', 'PO-24-10527', V5, 30, [
    ['FLM-RETR-18', 'Film rétractable 18 po x 1500 pi', 'ROUL', 40, 40, 20, 38.75],
    ['FLM-ETIR-20', 'Film étirable 20 po 80 ga', 'ROUL', 60, 30, 0, 24.4],
  ]),
  po('po6', 'PO-24-10533', V6, 9, [['PAL-4840-STD', 'Palette 48x40 standard', 'UN', 200, 200, 0, 14.5]]),
];

function invoice(
  v: BcVendor,
  invoiceNo: string,
  poNo: string,
  daysAgo: number,
  lines: [string, string, string, number, number][],
): ExtractedInvoice {
  const d = new Date(Date.now() - daysAgo * 864e5);
  const subtotal = r2(lines.reduce((s, l) => s + l[3] * l[4], 0));
  const tax = r2(subtotal * TAX);
  return {
    vendorName: v.name,
    vendorEmail: v.email,
    invoiceNo,
    invoiceDate: d.toISOString().slice(0, 10),
    dueDate: new Date(d.getTime() + 30 * 864e5).toISOString().slice(0, 10),
    poNo,
    currency: 'CAD',
    lines: lines.map(([itemNo, description, uom, quantity, unitPrice]) => ({ itemNo, description, uom, quantity, unitPrice })),
    subtotal,
    tax,
    total: r2(subtotal + tax),
  };
}

function mail(id: string, v: BcVendor, hoursAgo: number, subject: string, body: string, file: string, ex: ExtractedInvoice): MailMessage {
  return {
    id,
    from: v.email,
    fromName: v.name,
    subject,
    receivedAt: new Date(Date.now() - hoursAgo * 36e5).toISOString(),
    body,
    attachments: [{ name: file, sizeKb: 80 + ((id.charCodeAt(id.length - 1) * 37) % 200), extracted: ex }],
    read: false,
  };
}

export const seedMail: MailMessage[] = [
  mail(
    'm1', V1, 2, 'Facture 45821 — PO-24-10512',
    'Bonjour,\n\nVeuillez trouver ci-jointe notre facture 45821 pour votre bon de commande PO-24-10512.\n\nMerci et bonne journée,\nService de la facturation\nCartonnerie Laurentide',
    'Facture_45821.pdf',
    invoice(V1, '45821', 'PO-24-10512', 1, [
      ['CART-C32-4896', 'Carton ondulé C32 ECT 48x96', 'FEUILLE', 2000, 3.85],
      ['CART-B-4060', 'Carton cannelure B 40x60', 'FEUILLE', 1500, 2.12],
    ]),
  ),
  mail(
    'm2', V2, 5, 'Invoice EB-2024-0931',
    'Hello,\n\nAttached is invoice EB-2024-0931 covering PO-24-10518 (full order).\n\nRegards,\nEncres Boréal — Accounts receivable',
    'EB-2024-0931.pdf',
    invoice(V2, 'EB-2024-0931', 'PO-24-10518', 2, [
      ['ENC-PMS-185', 'Encre Pantone 185 C (rouge) 2,5 kg', 'CONT', 120, 86.5],
      ['ENC-NOIR-UV', 'Encre noire UV 1 kg', 'CONT', 60, 42],
    ]),
  ),
  mail(
    'm3', V3, 20, 'Facture PN-77310',
    'Bonjour,\n\nCi-joint la facture PN-77310. Veuillez noter l\'ajustement de prix sur les feuilles 0,30 mm.\n\nPlastiques Nordik',
    'PN-77310.pdf',
    invoice(V3, 'PN-77310', 'PO-24-10521', 3, [
      ['PET-FEU-030', 'Feuille PET transparente 0,30 mm 28x40', 'FEUILLE', 5000, 0.97],
      ['PET-FEU-050', 'Feuille PET 0,50 mm 28x40', 'FEUILLE', 2000, 1.45],
    ]),
  ),
  mail(
    'm4', V4, 30, 'Facture 2024-1188',
    'Bonjour,\n\nFacture pour la livraison de colle de la semaine dernière. Votre référence : PO-24-10999.\n\nAdhésifs Pro-Colle',
    'ProColle_2024-1188.pdf',
    invoice(V4, '2024-1188', 'PO-24-10999', 4, [['COL-HM-25', 'Colle thermofusible 25 kg', 'SAC', 8, 145]]),
  ),
];

/** Additional e-mails delivered one at a time by "Synchroniser la boîte". */
export const mailTemplates: MailMessage[] = [
  mail(
    'm5', V5, 0, 'Facture FSL-5520 (livraison partielle)',
    'Bonjour,\n\nFacture FSL-5520 pour la 2e livraison du PO-24-10527.\n\nFilms Saint-Laurent',
    'FSL-5520.pdf',
    invoice(V5, 'FSL-5520', 'PO-24-10527', 0, [
      ['FLM-RETR-18', 'Film rétractable 18 po x 1500 pi', 'ROUL', 20, 38.75],
      ['FLM-ETIR-20', 'Film étirable 20 po 80 ga', 'ROUL', 30, 24.4],
    ]),
  ),
  mail(
    'm6', V6, 0, 'Facture #88412',
    'Bonjour,\n\nVoici la facture #88412 pour les 200 palettes livrées (PO-24-10533).\n\nPalettes Rive-Sud',
    'Facture_88412.pdf',
    invoice(V6, '88412', 'PO-24-10533', 0, [['PAL-4840-STD', 'Palette 48x40 standard', 'PCE', 200, 14.5]]),
  ),
];
