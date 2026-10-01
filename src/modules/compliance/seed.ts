/**
 * Development seed — a starting set of frameworks with short, paraphrased requirement titles.
 * Replace / extend from the UI (Conformité → Référentiels).
 */
import type { Audit, Framework, PolicyDoc, Requirement, RequirementStatus, RiskLevel } from './types';

const day = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const now = new Date().toISOString();

export const seedFrameworks: Framework[] = [
  { id: 'fw_iso9001', code: 'ISO 9001', name: 'Management de la qualité', category: 'quality', description: 'Système de management de la qualité pour la fabrication d’emballages et présentoirs.', ownerId: 'u_admin', color: '#1e6fd9', certified: true, targetDate: day(240), active: true },
  { id: 'fw_iso27001', code: 'ISO 27001', name: 'Sécurité de l’information', category: 'security', description: 'Système de management de la sécurité de l’information (SMSI) — TI, données et fournisseurs.', ownerId: 'u_admin', color: '#7b4fd6', targetDate: day(300), active: true },
  { id: 'fw_loi25', code: 'Loi 25', name: 'Protection des renseignements personnels (Québec)', category: 'privacy', description: 'Obligations de la Loi modernisant des dispositions législatives en matière de protection des renseignements personnels.', ownerId: 'u_admin', color: '#d6336c', active: true },
  { id: 'fw_fsc', code: 'FSC CoC', name: 'Chaîne de traçabilité FSC', category: 'environment', description: 'Traçabilité des fibres certifiées dans les produits en carton.', ownerId: 'u_admin', color: '#2e9e5b', certified: true, targetDate: day(120), active: true },
  { id: 'fw_sst', code: 'SST', name: 'Santé et sécurité du travail (CNESST)', category: 'health', description: 'Programme de prévention et obligations en santé et sécurité à l’usine.', ownerId: 'u_admin', color: '#e07a10', active: true },
];

type R = [string, string, RequirementStatus, RiskLevel, number?];
const reqs = (fw: string, rows: R[]): Requirement[] =>
  rows.map(([ref, title, status, risk, due], i) => ({
    id: `${fw}_r${i + 1}`,
    frameworkId: fw,
    ref,
    title,
    description: '',
    ownerId: 'u_admin',
    status,
    risk,
    reviewDue: due !== undefined ? day(due) : undefined,
    evidence:
      status === 'verified' || status === 'implemented'
        ? [{ id: `${fw}_e${i + 1}`, label: 'Preuve documentée (démo)', at: now, by: 'u_admin' }]
        : [],
    notes: '',
    updatedAt: now,
  }));

export const seedRequirements: Requirement[] = [
  ...reqs('fw_iso9001', [
    ['4.3', 'Domaine d’application du système qualité défini', 'verified', 'low', 200],
    ['5.2', 'Politique qualité établie et communiquée', 'verified', 'low', 150],
    ['7.1.5', 'Étalonnage des instruments de mesure', 'implemented', 'medium', 20],
    ['7.5', 'Maîtrise des informations documentées', 'progress', 'medium', 45],
    ['8.4', 'Évaluation des fournisseurs externes', 'implemented', 'medium', 60],
    ['9.1.2', 'Mesure de la satisfaction client', 'progress', 'low', 90],
    ['9.2', 'Programme d’audits internes', 'implemented', 'medium', 30],
    ['10.2', 'Non-conformités et actions correctives', 'progress', 'high', 14],
  ]),
  ...reqs('fw_iso27001', [
    ['A.5.1', 'Politiques de sécurité de l’information', 'implemented', 'medium', 60],
    ['A.5.9', 'Inventaire des actifs informationnels', 'progress', 'high', 21],
    ['A.5.15', 'Contrôle d’accès et revue des droits', 'progress', 'high', 10],
    ['A.5.19', 'Sécurité dans les relations fournisseurs', 'todo', 'medium', 75],
    ['A.5.24', 'Gestion des incidents de sécurité', 'todo', 'high', 30],
    ['A.6.3', 'Sensibilisation et formation à la sécurité', 'progress', 'medium', 40],
    ['A.8.13', 'Sauvegardes des données', 'verified', 'high', 90],
    ['A.8.8', 'Gestion des vulnérabilités techniques', 'todo', 'high', 25],
  ]),
  ...reqs('fw_loi25', [
    ['Art. 3.1', 'Responsable de la protection des RP désigné et publié', 'verified', 'high'],
    ['Art. 3.2', 'Politique de gouvernance des RP publiée', 'implemented', 'high', 180],
    ['Art. 3.5', 'Registre des incidents de confidentialité', 'implemented', 'high', 30],
    ['Art. 3.3', 'Évaluation des facteurs relatifs à la vie privée (EFVP)', 'progress', 'high', 20],
    ['Art. 8.1', 'Transparence sur les technologies de profilage / témoins', 'todo', 'medium', 45],
    ['Art. 17', 'Encadrement des transferts hors Québec', 'todo', 'high', 35],
    ['Art. 23', 'Destruction ou anonymisation des RP', 'todo', 'medium', 60],
    ['Art. 27', 'Droit d’accès et portabilité des données', 'progress', 'medium', 50],
  ]),
  ...reqs('fw_fsc', [
    ['1', 'Procédures de chaîne de traçabilité documentées', 'verified', 'medium', 200],
    ['2', 'Vérification des certificats fournisseurs', 'verified', 'medium', 40],
    ['3', 'Contrôle des volumes / bilan matière', 'implemented', 'medium', 30],
    ['4', 'Usage conforme des allégations et logos', 'implemented', 'high', 90],
    ['5', 'Formation du personnel concerné', 'progress', 'low', 60],
  ]),
  ...reqs('fw_sst', [
    ['PP', 'Programme de prévention à jour', 'implemented', 'high', 90],
    ['CSS', 'Comité santé-sécurité actif', 'verified', 'medium', 120],
    ['CAD', 'Procédures de cadenassage des machines', 'progress', 'high', 15],
    ['CAR', 'Formation des caristes', 'implemented', 'high', 45],
    ['REG', 'Registre des accidents et premiers soins', 'verified', 'medium', 100],
  ]),
];

export const seedAudits: Audit[] = [
  {
    id: 'au1', frameworkId: 'fw_iso9001', kind: 'certification', title: 'Audit de surveillance ISO 9001', date: day(42), auditor: 'Organisme de certification', status: 'planned',
    findings: [], notes: '',
  },
  {
    id: 'au2', frameworkId: 'fw_iso27001', kind: 'internal', title: 'Audit interne TI — accès et sauvegardes', date: day(-18), auditor: 'AKAB Informatique', status: 'done',
    findings: [
      { id: 'f1', title: 'Comptes d’anciens employés encore actifs', severity: 'major', requirementId: 'fw_iso27001_r3', ownerId: 'u_admin', dueDate: day(10), closed: false },
      { id: 'f2', title: 'Test de restauration non documenté', severity: 'minor', requirementId: 'fw_iso27001_r7', ownerId: 'u_admin', dueDate: day(25), closed: false },
      { id: 'f3', title: 'Bonne pratique : MFA sur tous les accès distants', severity: 'observation', ownerId: 'u_admin', closed: true },
    ],
    notes: '',
  },
  {
    id: 'au3', frameworkId: 'fw_fsc', kind: 'external', title: 'Audit annuel FSC', date: day(-60), auditor: 'Organisme FSC', status: 'done',
    findings: [{ id: 'f4', title: 'Étiquette FSC non conforme sur un lot', severity: 'minor', requirementId: 'fw_fsc_r4', ownerId: 'u_admin', dueDate: day(-5), closed: false }],
    notes: '',
  },
];

export const seedDocs: PolicyDoc[] = [
  { id: 'doc1', title: 'Manuel qualité', version: '4.2', frameworkIds: ['fw_iso9001'], ownerId: 'u_admin', status: 'approved', approvedAt: day(-120), reviewDue: day(245) },
  { id: 'doc2', title: 'Politique de sécurité de l’information', version: '1.0', frameworkIds: ['fw_iso27001'], ownerId: 'u_admin', status: 'approved', approvedAt: day(-200), reviewDue: day(30) },
  { id: 'doc3', title: 'Politique de gouvernance des renseignements personnels', version: '1.1', frameworkIds: ['fw_loi25'], ownerId: 'u_admin', status: 'approved', approvedAt: day(-90), reviewDue: day(275) },
  { id: 'doc4', title: 'Procédure de gestion des incidents', version: '0.3', frameworkIds: ['fw_iso27001', 'fw_loi25'], ownerId: 'u_admin', status: 'draft', reviewDue: day(14) },
  { id: 'doc5', title: 'Procédure de cadenassage', version: '2.0', frameworkIds: ['fw_sst'], ownerId: 'u_admin', status: 'approved', approvedAt: day(-30), reviewDue: day(335) },
];
