/** Development seed for Sales: requests on every stage, two quotes, one work order. Fictional customers. */
import type { Quote, RequestAnalysis, SalesNote, SalesRequest, SalesStage, StageEvent, StudioInfo } from './types';
import type { WorkOrder, WorkOrderTask } from '@/modules/workorders/types';

const DAY = 864e5;
const pad = (n: number) => String(n).padStart(2, '0');
/** ISO timestamp `d` days before now (fractions allowed). */
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();
/** Calendar day (YYYY-MM-DD, local) `d` days from now. */
const dayFrom = (d: number) => {
  const x = new Date(Date.now() + d * DAY);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

/** A 1x1 transparent PNG, standing in for a drawn signature. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const TOKEN_A = 'Hq3sVb7mKc2tRz9LpXw4Nd8QyFa1Ue6TjGo0Is5ZkMA';
const TOKEN_B = 'R7pXk2Lw9Qe4Vn1Ty8Ub3Mc6Dh0Jf5Sa2Gi7Wo4Zx9Ep';

const ev = (daysAgo: number, by: string, from: SalesStage | null, to: SalesStage, note?: string): StageEvent => ({
  at: ago(daysAgo),
  by,
  from,
  to,
  ...(note ? { note } : {}),
});

const noStudio: StudioInfo = { status: 'none', brief: '', fileIds: [] };
const pendingAnalysis: RequestAnalysis = { status: 'pending', summary: '', assumptions: [], questions: [], confidence: 'low' };
const doneAnalysis = (
  summary: string,
  assumptions: string[],
  questions: string[],
  confidence: RequestAnalysis['confidence'] = 'high',
): RequestAnalysis => ({ status: 'done', summary, assumptions, questions, confidence });

const note = (id: string, daysAgo: number, userId: string, kind: SalesNote['kind'], text: string, dueAt?: string, done?: boolean): SalesNote => ({
  id,
  at: ago(daysAgo),
  userId,
  kind,
  text,
  ...(dueAt ? { dueAt } : {}),
  ...(done !== undefined ? { done } : {}),
});

/* Specs reuse the estimates in estimating/seed.ts (est1..est6) so the sales view and the estimating view agree. */

export const seedSalesRequests: SalesRequest[] = [
  {
    id: 'req_demo_declined', no: 'REQ-26-0001', source: 'form', stage: 'declined', revision: 1,
    history: [
      ev(39, 'u_admin', 'received', 'estimating'),
      ev(34, 'u_admin', 'estimating', 'quote_ready'),
      ev(31, 'u_admin', 'quote_ready', 'declined', 'Budget client dépassé; projet reporté à l’an prochain'),
    ],
    customer: 'Chocolaterie du Mont-Royal', contact: 'Étienne Parent', email: 'etienne@exemple.ca', phone: '514-555-0186',
    project: 'Coffrets rigides cadeaux — Fêtes', dueDate: dayFrom(-25), ownerId: 'u_admin',
    description: 'Coffrets rigides magnétiques pour nos chocolats des Fêtes, couvercle imprimé et insert en carton. Environ 1 500 à 3 000 coffrets.',
    spec: { type: 'rigid', style: 'RIG-MAG', lengthMm: 180, widthMm: 180, heightMm: 60, materialId: 'mat7', printProcess: 'offset', colorsOutside: 4, finishes: ['spotuv'], options: ['insert'] },
    quantities: [1500, 3000], fileIds: [],
    analysis: doneAnalysis('Coffret rigide magnétique 180 x 180 x 60 mm, couvercle imprimé 4 couleurs, vernis sélectif et insert.', ['Carton gris 2 mm avec papier couché supposé.'], ['Le couvercle est-il magnétique ou à rabat?'], 'medium'),
    studio: noStudio,
    notes: [note('n_demo_1a', 33, 'u_admin', 'note', 'Le client compare avec un fournisseur de Toronto. Prix serré.')],
    createdAt: ago(40), updatedAt: ago(31), createdBy: 'u_admin',
  },
  {
    id: 'req_demo_production', no: 'REQ-26-0002', source: 'manual', stage: 'production', revision: 1,
    history: [
      ev(30, 'u_admin', 'received', 'estimating'),
      ev(27, 'u_admin', 'estimating', 'quote_ready'),
      ev(25, 'u_admin', 'quote_ready', 'with_client', 'Soumission envoyée par courriel'),
      ev(21, 'client', 'with_client', 'accepted', 'Acceptée en ligne : 500 présentoirs'),
      ev(19, 'u_admin', 'accepted', 'production', 'Ordre de travail créé'),
    ],
    customer: 'Boutique Horizon', contact: 'Sophie Roy', email: 'sophie@exemple.ca', phone: '418-555-0163',
    project: 'Présentoir comptoir — collection été', dueDate: dayFrom(12), ownerId: 'u_admin',
    description: 'Présentoir comptoir pour la collection d’été, 250 ou 500 unités, couleurs de la collection sur quatre faces, assemblage sans colle.',
    spec: { type: 'display', style: 'DSP-CTR', lengthMm: 350, widthMm: 250, heightMm: 400, materialId: 'mat4', printProcess: 'digital', colorsOutside: 4, finishes: ['aqueous'], options: ['assembly'] },
    quantities: [250, 500], fileIds: [],
    analysis: doneAnalysis('Présentoir comptoir en carton ondulé C, 350 x 250 x 400 mm, impression numérique 4 couleurs, enduit aqueux, assemblage.', ['Présentoir livré à plat, assemblé par le client.'], [], 'high'),
    studio: { status: 'done', brief: 'Maquette quatre faces approuvée par la cliente', fileIds: [], updatedAt: ago(28) },
    quoteId: 'quo_demo_accepted', estimateId: 'est3', workOrderId: 'wo_demo_1',
    notes: [note('n_demo_2a', 19, 'u_admin', 'system', 'Ordre de travail WO-26-0001 créé à partir de la soumission acceptée')],
    createdAt: ago(31), updatedAt: ago(4), createdBy: 'u_admin',
  },
  {
    id: 'req_demo_estimating', no: 'REQ-26-0003', source: 'email', stage: 'estimating', revision: 2,
    emailRef: { messageId: 'msg_demo_elegance_02', subject: 'Changements — coffret sérum', from: 'julie@exemple.ca', receivedAt: ago(12) },
    history: [
      ev(27, 'u_admin', 'received', 'estimating'),
      ev(21, 'u_admin', 'estimating', 'quote_ready'),
      ev(20, 'u_admin', 'quote_ready', 'with_client', 'Soumission envoyée; la cliente veut voir la dorure'),
      ev(12, 'client', 'with_client', 'estimating', 'Demande de changements : 5 000 unités et dorure sur le logo'),
    ],
    customer: 'Maison Élégance Cosmétiques', contact: 'Julie Tremblay', email: 'julie@exemple.ca', phone: '418-555-0177',
    project: 'Coffret sérum — lancement printemps', dueDate: dayFrom(4), ownerId: 'u_admin',
    description: 'Coffret tuck-end pour un sérum de 30 ml, 45 x 45 x 130 mm. Dorure or sur le logo, finition mate. Un échantillon physique est demandé avant la décision.',
    spec: { type: 'folding', style: 'ECMA A20.20.03.01', lengthMm: 45, widthMm: 45, heightMm: 130, materialId: 'mat2', printProcess: 'offset', colorsOutside: 5, colorsInside: 0, finishes: ['matte', 'foil'], options: ['insert'], newDie: true },
    quantities: [2500, 5000], fileIds: [],
    analysis: doneAnalysis(
      'Coffret pliant ECMA 45 x 45 x 130 mm sur carton SBS 24 pt, quadrichromie, dorure or sur logo, finition mate et insert.',
      ['Carton SBS 24 pt retenu pour la rigidité du sérum.', 'Dorure sur une seule face.'],
      ['Le logo sera-t-il fourni en vectoriel (AI ou EPS)?', 'Le volume final est-il de 5 000 ou 10 000 unités?'],
      'medium',
    ),
    studio: { status: 'requested', brief: 'Revoir le gabarit 45 x 45 x 130 mm pour la dorure sur logo; fournir deux variantes de maquette et le fichier de découpe.', fileIds: [], updatedAt: ago(11) },
    blocker: { kind: 'studio', note: 'Studio : attend le logo vectoriel haute résolution', since: ago(11), followUpAt: dayFrom(2), userId: 'u_admin' },
    estimateId: 'est1',
    notes: [
      note('n_demo_3a', 12, 'u_admin', 'note', 'La cliente veut un échantillon physique avant de signer. Demander un délai au studio.'),
      note('n_demo_3b', 11, 'u_admin', 'followup', 'Relancer le studio pour le logo', dayFrom(1), false),
    ],
    createdAt: ago(28), updatedAt: ago(11), createdBy: 'u_admin',
  },
  {
    id: 'req_demo_accepted', no: 'REQ-26-0004', source: 'email', stage: 'accepted', revision: 1,
    emailRef: { messageId: 'msg_demo_pommes_01', subject: 'Commande caisses de pommes', from: 'luc@exemple.ca', receivedAt: ago(6) },
    history: [
      ev(21, 'u_admin', 'received', 'estimating'),
      ev(18, 'u_admin', 'estimating', 'review'),
      ev(15, 'u_admin', 'review', 'quote_ready'),
      ev(13, 'u_admin', 'quote_ready', 'with_client'),
      ev(6, 'client', 'with_client', 'accepted', 'Accepté par courriel : 3 000 caisses'),
    ],
    customer: 'Verger du Lac', contact: 'Luc Bergeron', email: 'luc@exemple.ca', phone: '450-555-0144',
    project: 'Caisses de pommes — saison', dueDate: dayFrom(14), ownerId: 'u_admin',
    description: 'Caisses de récolte pour pommes, 400 x 300 x 250 mm, qui doivent supporter environ 12 kg. Volumes de 3 000 et 10 000 unités.',
    spec: { type: 'corrugated', style: 'FEFCO 0201', lengthMm: 400, widthMm: 300, heightMm: 250, materialId: 'mat5', printProcess: 'flexo', colorsOutside: 2, colorsInside: 0, newDie: true },
    quantities: [3000, 10000], fileIds: [],
    analysis: doneAnalysis('Caisse américaine FEFCO 0201 en double cannelure BC, 400 x 300 x 250 mm, impression flexo 2 couleurs.', ['Cannelure double BC retenue pour la charge (environ 12 kg).'], ['Confirmer la date de livraison pour la récolte.'], 'high'),
    studio: { status: 'done', brief: 'Gabarit de découpe validé', fileIds: [], updatedAt: ago(7) },
    estimateId: 'est6',
    notes: [note('n_demo_4a', 6, 'u_admin', 'followup', 'Confirmer la date de livraison et l’horaire de la récolte', dayFrom(2), false)],
    createdAt: ago(22), updatedAt: ago(6), createdBy: 'u_admin',
  },
  {
    id: 'req_demo_with_client', no: 'REQ-26-0005', source: 'manual', stage: 'with_client', revision: 1,
    history: [
      ev(13, 'u_admin', 'received', 'estimating'),
      ev(11, 'u_admin', 'estimating', 'review'),
      ev(10, 'u_admin', 'review', 'quote_ready'),
      ev(9, 'u_admin', 'quote_ready', 'with_client', 'Soumission envoyée par courriel'),
    ],
    customer: 'Distribution Nordet', contact: 'Marc Gagnon', email: 'marc@exemple.ca', phone: '450-555-0131',
    project: 'Caisses d’expédition e-commerce', dueDate: dayFrom(18), ownerId: 'u_admin',
    description: 'Caisses FEFCO 0427 pour l’expédition e-commerce, 300 x 220 x 100 mm, microcannelure E. Le client hésite entre 5 000 et 20 000 unités.',
    spec: { type: 'corrugated', style: 'FEFCO 0427', lengthMm: 300, widthMm: 220, heightMm: 100, materialId: 'mat6', printProcess: 'flexo', colorsOutside: 1, colorsInside: 1, newDie: false },
    quantities: [5000, 20000], fileIds: [],
    analysis: doneAnalysis('Caisse FEFCO 0427 en microcannelure E, impression flexo 1 couleur extérieure et intérieure, outillage existant.', ['Outillage existant réutilisé, pas de nouveau tableau.'], ['Quel volume le client choisit-il, 5 000 ou 20 000?', 'Les caisses doivent-elles être livrées à plat?'], 'high'),
    studio: noStudio,
    quoteId: 'quo_demo_sent', estimateId: 'est2',
    blocker: { kind: 'customer', note: 'Attend le choix de volume (5 000 ou 20 000)', since: ago(5), followUpAt: dayFrom(-3), userId: 'u_admin' },
    notes: [note('n_demo_5a', 4, 'u_admin', 'followup', 'Relancer Marc pour le choix de volume', dayFrom(-3), false)],
    createdAt: ago(14), updatedAt: ago(4), createdBy: 'u_admin',
  },
  {
    id: 'req_demo_quote_ready', no: 'REQ-26-0006', source: 'manual', stage: 'quote_ready', revision: 1,
    history: [
      ev(8, 'u_admin', 'received', 'estimating'),
      ev(6, 'u_admin', 'estimating', 'review'),
      ev(4, 'u_admin', 'review', 'quote_ready', 'Soumission prête, en attente d’envoi'),
    ],
    customer: 'Brasserie des Deux Rives', contact: 'Samuel Ouellet', email: 'samuel@exemple.ca', phone: '819-555-0120',
    project: 'Présentoir comptoir — bières artisanales', dueDate: dayFrom(21), ownerId: 'u_admin',
    description: 'Présentoir de comptoir pour six bouteilles de 650 ml, logo en couleur sur les côtés et cadre d’assemblage sans colle. Besoin de 300 à 600 unités.',
    spec: { type: 'display', style: 'DSP-CTR', lengthMm: 300, widthMm: 220, heightMm: 320, materialId: 'mat4', printProcess: 'digital', colorsOutside: 4, colorsInside: 0, finishes: ['aqueous'], options: ['assembly'], newDie: false },
    quantities: [300, 600], fileIds: [], estimateId: 'est7',
    analysis: doneAnalysis('Présentoir de comptoir en carton ondulé C, 300 x 220 x 320 mm, impression numérique 4 couleurs, assemblage manuel.', ['Impression numérique retenue pour les petites séries.', 'Cannelure C suffisante pour six bouteilles.'], ['Le logo est-il prêt en haute résolution?'], 'medium'),
    studio: { status: 'done', brief: 'Croquis et gabarit envoyés', fileIds: [], updatedAt: ago(5) },
    notes: [
      note('n_demo_6a', 4, 'u_admin', 'note', 'Soumission à envoyer après validation de la marge par la direction.'),
      note('n_demo_6b', 3, 'u_admin', 'followup', 'Envoyer la soumission à Samuel', dayFrom(0), false),
    ],
    createdAt: ago(9), updatedAt: ago(4), createdBy: 'u_admin',
  },
  {
    id: 'req_demo_review', no: 'REQ-26-0007', source: 'email', stage: 'review', revision: 1,
    emailRef: { messageId: 'msg_demo_degustation_01', subject: 'Coffret dégustation — photo', from: 'helene@exemple.ca', receivedAt: ago(4) },
    history: [
      ev(3.8, 'system', 'received', 'estimating', 'Construite automatiquement à partir de la demande'),
      ev(2, 'system', 'estimating', 'review', 'Dimensions à confirmer'),
    ],
    customer: 'Atelier Bois & Sel', contact: 'Hélène Côté', email: 'helene@exemple.ca', phone: '418-555-0109',
    project: 'Coffret dégustation — 3 bouteilles', dueDate: dayFrom(6), ownerId: 'u_admin',
    description: 'Coffret dégustation pour trois bouteilles de 375 ml, à partir d’une photo de maquette. Dimensions à confirmer.',
    spec: { type: 'folding', style: 'ECMA A20.20.03.01', lengthMm: 110, widthMm: 110, heightMm: 300, materialId: 'mat2', printProcess: 'offset', colorsOutside: 4, colorsInside: 1, finishes: ['uv'], options: ['window'], newDie: true },
    quantities: [1000, 2500], fileIds: [],
    analysis: doneAnalysis(
      'Coffret pliant 110 x 110 x 300 mm estimé depuis la photo, fenêtre PET sur une face, vernis UV.',
      ['Dimensions estimées à partir de la photo (±10 mm).', 'Carton SBS 24 pt supposé; grammage non précisé.', 'Fenêtre PET supposée sur une seule face.'],
      ['Quelles sont les dimensions exactes du coffret?', 'La fenêtre PET est-elle sur une ou deux faces?'],
      'low',
    ),
    studio: { status: 'in_progress', brief: 'Gabarit estimé depuis la photo; valider les dimensions avant le BAT.', fileIds: [], updatedAt: ago(2) },
    estimateId: 'est5',
    notes: [note('n_demo_7a', 2, 'u_admin', 'followup', 'Demander les dimensions exactes à Hélène', dayFrom(1), false)],
    createdAt: ago(4), updatedAt: ago(2), createdBy: 'u_admin',
  },
  {
    id: 'req_demo_received', no: 'REQ-26-0008', source: 'email', stage: 'received', revision: 1,
    emailRef: { messageId: 'msg_demo_savon_01', subject: 'Demande de prix — étuis savons', from: 'nadia@exemple.ca', receivedAt: ago(1) },
    history: [],
    customer: 'Savonnerie Le Plateau', contact: 'Nadia Lessard', email: 'nadia@exemple.ca', phone: '514-555-0142',
    project: 'Étuis pliants — savons artisanaux', dueDate: dayFrom(30), ownerId: 'u_admin',
    description: 'Étuis pour trois formats de savon (100 g, 150 g et 200 g), carton blanc avec impression sur une face. Nous aimerions une maquette d’ici deux semaines.',
    spec: { type: 'folding', lengthMm: 95, widthMm: 95, heightMm: 35 },
    quantities: [2000, 5000], fileIds: [],
    analysis: pendingAnalysis,
    studio: noStudio,
    notes: [],
    createdAt: ago(1), updatedAt: ago(1), createdBy: 'u_admin',
  },
];

export const seedSalesQuotes: Quote[] = [
  {
    id: 'quo_demo_sent', no: 'Q-26-0005-R1', requestId: 'req_demo_with_client', estimateId: 'est2', revision: 1, status: 'sent', token: TOKEN_A,
    customer: 'Distribution Nordet', contact: 'Marc Gagnon', email: 'marc@exemple.ca', project: 'Caisses d’expédition e-commerce',
    specSummary: 'Caisse FEFCO 0427, 300 x 220 x 100 mm, microcannelure E, impression flexo 1 couleur extérieure et intérieure.',
    lines: [
      { quantity: 5000, unitPrice: 0.62, total: 3100 },
      { quantity: 20000, unitPrice: 0.41, total: 8200 },
    ],
    currency: 'CAD',
    terms: 'Prix en dollars canadiens, taxes en sus. Acompte de 30 % à l’acceptation, solde à la livraison.',
    notes: 'Outillage existant réutilisé. Prix valides pour une livraison en quatre semaines après approbation du BAT.',
    validUntil: dayFrom(21), sentAt: ago(9), sentBy: 'u_admin', viewedAt: ago(8),
  },
  {
    id: 'quo_demo_accepted', no: 'Q-26-0002-R1', requestId: 'req_demo_production', estimateId: 'est3', revision: 1, status: 'accepted', token: TOKEN_B,
    customer: 'Boutique Horizon', contact: 'Sophie Roy', email: 'sophie@exemple.ca', project: 'Présentoir comptoir — collection été',
    specSummary: 'Présentoir comptoir 350 x 250 x 400 mm, carton ondulé C 32 ECT, impression numérique 4 couleurs, enduit aqueux, assemblage.',
    lines: [
      { quantity: 250, unitPrice: 14.8, total: 3700 },
      { quantity: 500, unitPrice: 11.9, total: 5950 },
    ],
    currency: 'CAD',
    terms: 'Prix en dollars canadiens, taxes en sus. Acompte de 30 % à l’acceptation, solde à la livraison.',
    notes: '',
    validUntil: dayFrom(5), sentAt: ago(25), sentBy: 'u_admin', viewedAt: ago(24),
    response: { decision: 'accept', at: ago(21), quantity: 500, signedName: 'Sophie Roy', signature: PNG },
  },
];

export const seedWorkOrders: WorkOrder[] = [
  {
    id: 'wo_demo_1', no: 'WO-26-0001', requestId: 'req_demo_production', quoteId: 'quo_demo_accepted', estimateId: 'est3',
    customer: 'Boutique Horizon', contact: 'Sophie Roy', project: 'Présentoir comptoir — collection été',
    specSummary: 'Présentoir comptoir DSP-CTR 350 x 250 x 400 mm, carton ondulé C 32 ECT, impression numérique 4 couleurs, enduit aqueux, assemblage.',
    quantity: 500, unitPrice: 11.9, total: 5950, dueDate: dayFrom(12), status: 'in_progress', managerId: 'u_prod',
    tasks: [
      { id: 'wot_1', title: 'Approbation de la prépresse', department: 'prepress', assigneeId: 'u_prod', status: 'done', dueAt: dayFrom(-17) },
      { id: 'wot_2', title: 'Impression numérique', department: 'printing', assigneeId: 'u_prod', status: 'doing', dueAt: dayFrom(2) },
      { id: 'wot_3', title: 'Découpe à l’emporte-pièce', department: 'diecutting', assigneeId: '', status: 'todo', dueAt: dayFrom(4) },
      { id: 'wot_4', title: 'Finition aqueuse', department: 'finishing', assigneeId: '', status: 'todo', dueAt: dayFrom(5) },
      { id: 'wot_5', title: 'Collage et assemblage', department: 'assembly', assigneeId: '', status: 'todo', dueAt: dayFrom(7) },
      { id: 'wot_6', title: 'Contrôle qualité', department: 'finishing', assigneeId: '', status: 'todo', dueAt: dayFrom(9) },
      { id: 'wot_7', title: 'Emballage et expédition', department: 'shipping', assigneeId: '', status: 'todo', dueAt: dayFrom(11) },
    ] satisfies WorkOrderTask[],
    notes: 'Vérifier la couleur sur la maquette signée avant l’impression.',
    createdAt: ago(19), updatedAt: ago(4),
    history: [
      { at: ago(19), by: 'system', text: 'Ordre de travail créé à partir de la soumission acceptée' },
      { at: ago(18), by: 'u_prod', text: 'Approbation de la prépresse terminée' },
      { at: ago(4), by: 'u_prod', text: 'Impression numérique démarrée' },
    ],
  },
];
