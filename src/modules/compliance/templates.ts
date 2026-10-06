/**
 * Framework templates for a Québec manufacturing business — a starting point, not legal advice.
 * Titles are short paraphrases of the obligations; confirm thresholds, deadlines and applicability
 * with the regulator (CNESST, OQLF, Revenu Québec, MELCCFP) or a legal advisor before relying on them.
 * Adding a template creates the framework and its requirements (all "to do") — everything stays editable.
 */
import type { FrameworkCategory, RiskLevel } from './types';

export type TemplateScope = 'general' | 'production';

/** [ref, title, description, risk] */
type Row = [string, string, string, RiskLevel];

export interface FrameworkTemplate {
  id: string;
  scope: TemplateScope;
  code: string;
  name: string;
  category: FrameworkCategory;
  description: string;
  color: string;
  requirements: Row[];
}

export const TEMPLATE_SCOPES: Record<TemplateScope, { fr: string; en: string }> = {
  general: { fr: 'Entreprise au Québec — général', en: 'Québec business — general' },
  production: { fr: 'Entreprise de production / fabrication', en: 'Production / manufacturing' },
};

const NOTE = ' Modèle de départ : à valider avec l’organisme concerné ou un conseiller juridique.';

export const FRAMEWORK_TEMPLATES: FrameworkTemplate[] = [
  /* ---------------- General (any Québec employer) ---------------- */
  {
    id: 'tpl_lnt',
    scope: 'general',
    code: 'LNT',
    name: 'Normes du travail (Québec)',
    category: 'other',
    description: 'Obligations de l’employeur en vertu de la Loi sur les normes du travail.' + NOTE,
    color: '#0ea5c6',
    requirements: [
      ['LNT-1', 'Politique de prévention du harcèlement psychologique et sexuel adoptée et diffusée', 'Politique écrite, connue des employés, avec processus de plainte.', 'high'],
      ['LNT-2', 'Salaire minimum, paie et bulletin de paie conformes', 'Bulletin de paie remis à chaque paie avec les mentions obligatoires.', 'high'],
      ['LNT-3', 'Heures supplémentaires et heures de travail respectées', 'Majoration au-delà du seuil hebdomadaire, repos et pauses.', 'medium'],
      ['LNT-4', 'Congés annuels, jours fériés et congés familiaux appliqués', 'Calcul et octroi conformes (vacances, fériés, absences pour raisons familiales).', 'medium'],
      ['LNT-5', 'Registres de paie et de présence conservés', 'Système d’enregistrement tenu et conservé pendant la durée prescrite.', 'medium'],
      ['LNT-6', 'Préavis de cessation d’emploi et licenciement collectif', 'Procédure et délais de préavis suivis; avis au ministre au besoin.', 'medium'],
      ['LNT-7', 'Dépense de formation (1 % de la masse salariale) suivie, si applicable', 'Applicable aux employeurs dont la masse salariale dépasse le seuil de la loi.', 'low'],
      ['LNT-8', 'Équité salariale : évaluation et maintien à jour, si applicable', 'Entreprises de 10 employés et plus : évaluation, affichage et déclaration à la CNESST.', 'medium'],
    ],
  },
  {
    id: 'tpl_sst_gen',
    scope: 'general',
    code: 'SST-QC',
    name: 'Santé et sécurité du travail — obligations générales (CNESST)',
    category: 'health',
    description: 'Obligations générales de la LSST et de la LMRSST pour tout employeur du Québec.' + NOTE,
    color: '#e07a10',
    requirements: [
      ['SST-1', 'Inscription à la CNESST et déclaration annuelle des salaires', 'Cotisation payée; classification de l’entreprise à jour.', 'high'],
      ['SST-2', 'Mécanisme de participation : comité SST ou représentant selon la taille', 'Membres désignés, rencontres tenues et consignées.', 'high'],
      ['SST-3', 'Identification et analyse des risques', 'Risques recensés par poste et par secteur de travail.', 'high'],
      ['SST-4', 'Programme de prévention ou plan d’action, selon le secteur et la taille', 'Mesures, responsables et échéances documentés et mis à jour.', 'high'],
      ['SST-5', 'Plan des mesures d’urgence et exercices d’évacuation', 'Plan à jour, exercices périodiques, issues dégagées.', 'high'],
      ['SST-6', 'Accueil, formation et supervision des travailleurs', 'Information et formation sur les risques, y compris nouveaux employés et temporaires.', 'high'],
      ['SST-7', 'Déclaration et registre des accidents et événements', 'Déclaration à la CNESST dans les délais; registre interne.', 'medium'],
      ['SST-8', 'Premiers secours : secouristes formés et trousses complètes', 'Selon le règlement sur les normes minimales de premiers secours.', 'medium'],
    ],
  },
  {
    id: 'tpl_loi25',
    scope: 'general',
    code: 'Loi 25',
    name: 'Protection des renseignements personnels (Québec)',
    category: 'privacy',
    description: 'Obligations de la Loi sur la protection des renseignements personnels dans le secteur privé, modernisée par la Loi 25.' + NOTE,
    color: '#d6336c',
    requirements: [
      ['L25-1', 'Responsable de la protection des renseignements personnels désigné et publié', 'Titre et coordonnées accessibles, par exemple sur le site Web.', 'high'],
      ['L25-2', 'Politiques et pratiques de gouvernance publiées', 'Rôles, conservation, gestion des plaintes, en langage clair.', 'high'],
      ['L25-3', 'Registre des incidents de confidentialité et avis en cas de risque sérieux', 'Avis à la Commission d’accès à l’information et aux personnes concernées.', 'high'],
      ['L25-4', 'Évaluation des facteurs relatifs à la vie privée (EFVP)', 'Pour les nouveaux projets et les transferts hors Québec.', 'medium'],
      ['L25-5', 'Consentement et transparence (témoins, profilage, fins de la collecte)', 'Consentement manifeste, libre et éclairé; paramètres de confidentialité.', 'medium'],
      ['L25-6', 'Droits d’accès, de rectification et de portabilité traités', 'Procédure et délai de réponse définis.', 'medium'],
      ['L25-7', 'Conservation limitée, destruction ou anonymisation', 'Calendrier de conservation appliqué.', 'medium'],
    ],
  },
  {
    id: 'tpl_langue',
    scope: 'general',
    code: 'Charte FR',
    name: 'Charte de la langue française (Loi 96)',
    category: 'other',
    description: 'Obligations linguistiques des entreprises au Québec, notamment la francisation.' + NOTE,
    color: '#1e6fd9',
    requirements: [
      ['LF-1', 'Communications avec le personnel en français', 'Offres d’emploi, contrats, conditions de travail, documents internes.', 'medium'],
      ['LF-2', 'Inscription à l’OQLF et démarche de francisation, selon la taille', 'Seuils d’employés applicables; certificat et comité de francisation au besoin.', 'high'],
      ['LF-3', 'Affichage public et publicité commerciale conformes', 'Français nettement prédominant; marques de commerce selon la règle applicable.', 'medium'],
      ['LF-4', 'Site Web, documents commerciaux et factures disponibles en français', 'Version française au moins équivalente.', 'medium'],
      ['LF-5', 'Contrats d’adhésion et documents aux clients en français d’abord', 'Version anglaise seulement après la version française.', 'medium'],
    ],
  },
  {
    id: 'tpl_fisc',
    scope: 'general',
    code: 'Fiscalité QC',
    name: 'Obligations fiscales et corporatives (Québec)',
    category: 'other',
    description: 'Échéances récurrentes de l’entreprise envers Revenu Québec, l’Agence du revenu du Canada et le Registraire des entreprises.' + NOTE,
    color: '#5b6b82',
    requirements: [
      ['FIS-1', 'Déclaration de mise à jour annuelle au Registraire des entreprises (REQ)', 'Produite chaque année dans la période prescrite.', 'high'],
      ['FIS-2', 'Déclarations et remises de TPS et de TVQ', 'Selon la fréquence assignée.', 'high'],
      ['FIS-3', 'Retenues à la source remises à temps (impôt, RRQ, RQAP, AE, FSS)', 'Remises périodiques selon le statut de remettant.', 'high'],
      ['FIS-4', 'Relevés d’emploi, Relevés 1 et feuillets T4 produits dans les délais', 'Fin février pour les relevés fiscaux annuels.', 'medium'],
      ['FIS-5', 'Déclarations de revenus de la société produites', 'Provincial et fédéral.', 'high'],
      ['FIS-6', 'Livres et pièces justificatives conservés', 'Durée de conservation fiscale respectée.', 'medium'],
      ['FIS-7', 'Assurances d’entreprise et permis municipaux à jour', 'Responsabilité civile, biens, interruption, selon les besoins.', 'low'],
    ],
  },

  /* ---------------- Production / manufacturing ---------------- */
  {
    id: 'tpl_sst_usine',
    scope: 'production',
    code: 'SST-Usine',
    name: 'SST — Usine de production (RSST)',
    category: 'health',
    description: 'Exigences du Règlement sur la santé et la sécurité du travail propres à une usine de fabrication.' + NOTE,
    color: '#da291c',
    requirements: [
      ['U-1', 'Cadenassage et contrôle des énergies dangereuses', 'Procédures par machine, cadenas et étiquettes, formation et audits.', 'high'],
      ['U-2', 'Protection des machines (protecteurs, dispositifs de sécurité)', 'Zones dangereuses protégées, dispositifs vérifiés.', 'high'],
      ['U-3', 'Chariots élévateurs : formation, autorisation et inspection', 'Cariste formé et autorisé; vérification avant utilisation.', 'high'],
      ['U-4', 'SIMDUT : étiquettes, fiches de données de sécurité et formation', 'Registre des produits dangereux (encres, colles, solvants).', 'high'],
      ['U-5', 'Bruit : évaluation de l’exposition et protection auditive', 'Mesures, protecteurs, dépistage selon les niveaux.', 'medium'],
      ['U-6', 'Qualité de l’air, poussières de papier et carton, ventilation', 'Captation à la source et entretien des systèmes.', 'medium'],
      ['U-7', 'Équipements de levage et ponts roulants inspectés', 'Inspections périodiques consignées.', 'medium'],
      ['U-8', 'Équipements de protection individuelle fournis et portés', 'Évaluation du besoin par poste, ajustement, remplacement.', 'medium'],
      ['U-9', 'Prévention des incendies et entreposage', 'Extincteurs, issues, allées dégagées, stockage de matières combustibles.', 'high'],
      ['U-10', 'Manutention et ergonomie (prévention des TMS)', 'Analyse des postes à risque, aides mécaniques.', 'medium'],
      ['U-11', 'Espaces clos et travaux en hauteur, si applicables', 'Permis d’entrée, protection contre les chutes.', 'medium'],
    ],
  },
  {
    id: 'tpl_env',
    scope: 'production',
    code: 'ENV-QC',
    name: 'Environnement — usine (MELCCFP)',
    category: 'environment',
    description: 'Principales obligations environnementales d’une usine d’emballage ou d’impression au Québec.' + NOTE,
    color: '#2e9e5b',
    requirements: [
      ['E-1', 'Autorisations environnementales requises obtenues et à jour', 'Selon la Loi sur la qualité de l’environnement et la nature des activités.', 'high'],
      ['E-2', 'Émissions atmosphériques (encres, solvants, COV) conformes', 'Règlement sur l’assainissement de l’atmosphère, suivi des émissions.', 'high'],
      ['E-3', 'Matières dangereuses résiduelles : registre et transporteurs autorisés', 'Encres, solvants, huiles, chiffons souillés, contenants.', 'high'],
      ['E-4', 'Rejets d’eaux usées conformes', 'Règlement provincial ou municipal applicable à l’usine.', 'medium'],
      ['E-5', 'Gestion des matières résiduelles : tri, recyclage, valorisation', 'Cibles, ententes avec les récupérateurs, suivi des volumes.', 'medium'],
      ['E-6', 'Responsabilité élargie des producteurs (emballages) évaluée', 'Déterminer si l’entreprise est assujettie et déclarer le cas échéant.', 'medium'],
      ['E-7', 'Réservoirs, entreposage et plan d’intervention en cas de déversement', 'Confinement, trousses, formation du personnel.', 'medium'],
    ],
  },
  {
    id: 'tpl_prod_qual',
    scope: 'production',
    code: 'QUAL-Prod',
    name: 'Qualité et traçabilité de production',
    category: 'quality',
    description: 'Bonnes pratiques qualité pour la fabrication d’emballages et de présentoirs (base d’un futur ISO 9001).' + NOTE,
    color: '#7b4fd6',
    requirements: [
      ['Q-1', 'Plan de contrôle qualité par produit ou famille de produits', 'Points de contrôle, fréquences, critères d’acceptation.', 'high'],
      ['Q-2', 'Étalonnage et vérification des instruments de mesure', 'Registre et échéances.', 'medium'],
      ['Q-3', 'Traçabilité des matières et des lots', 'Liens matière première, production et expédition.', 'high'],
      ['Q-4', 'Gestion des non-conformités et actions correctives', 'Cause, correction, vérification de l’efficacité.', 'high'],
      ['Q-5', 'Évaluation et suivi des fournisseurs critiques', 'Critères, cotes et revues périodiques.', 'medium'],
      ['Q-6', 'Maîtrise des documents et des gabarits (devis, épreuves, couteaux)', 'Version en vigueur, approbations clients conservées.', 'medium'],
      ['Q-7', 'Étiquetage et mode d’emploi des produits conformes (français)', 'Exigences de la Charte pour l’étiquetage des produits.', 'medium'],
      ['Q-8', 'Mesure de la satisfaction client et traitement des plaintes', 'Suivi des retours et des réclamations.', 'low'],
      ['Q-9', 'Emballages en contact avec les aliments conformes, si applicable', 'Matériaux et encres adaptés; exigences fédérales applicables.', 'high'],
    ],
  },
];
