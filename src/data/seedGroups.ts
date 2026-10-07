/** Default access groups. Shared by the browser dev seed and the production server first start. */
import type { Group } from './types';

export const seedGroups: Group[] = [
  { id: 'g_admin', name: 'Administrateurs', description: 'Accès complet à Imago', permissions: ['*'], system: true, color: '#da291c' },
  {
    id: 'g_prod',
    name: 'Production',
    description: 'Étiquettes d’expédition',
    permissions: ['shipping.access', 'shipping.labels.create', 'shipping.labels.print', 'shipping.addresses.manage'],
    color: '#1e6fd9',
  },
  {
    id: 'g_prod_lead',
    name: 'Chefs d’équipe production',
    description: 'Annulation et paramètres d’expédition',
    permissions: ['shipping.*'],
    color: '#0f8b8d',
  },
  {
    id: 'g_compta',
    name: 'Comptabilité',
    description: 'Traitement des factures fournisseurs',
    permissions: [
      'accounting.access',
      'accounting.inbox.view',
      'accounting.invoices.import',
      'accounting.invoices.edit',
      'accounting.invoices.validate',
      'accounting.invoices.approve',
      'accounting.invoices.post',
      'accounting.po.view',
      'accounting.po.process',
      'accounting.po.approve',
    ],
    color: '#e07a10',
  },
  {
    id: 'g_controleur',
    name: 'Contrôleur',
    description: 'Dérogations et paramètres comptables',
    permissions: ['accounting.*'],
    color: '#c2185b',
  },
  {
    id: 'g_estim',
    name: 'Estimation',
    description: 'Chiffrage des emballages',
    permissions: ['estimating.access', 'estimating.edit', 'estimating.pricing.view', 'estimating.approve'],
    color: '#2e9e5b',
  },
  {
    id: 'g_conformite',
    name: 'Conformité',
    description: 'Gestion de la conformité (ISO, Loi 25, FSC, SST)',
    permissions: ['compliance.*', 'rh.access'],
    color: '#d6336c',
  },
  {
    id: 'g_o365',
    name: 'Gestion O365',
    description: 'Locataires, utilisateurs, contacts, groupes et licences Microsoft 365',
    permissions: ['o365.*'],
    color: '#0f6cbd',
  },
  {
    id: 'g_read',
    name: 'Lecture seule',
    description: 'Consultation sans modification',
    permissions: ['accounting.access', 'accounting.po.view', 'shipping.access', 'estimating.access', 'compliance.access', 'rh.access'],
    color: '#5b6b82',
  },
];
