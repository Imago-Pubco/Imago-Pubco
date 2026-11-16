/**
 * Archive of Pubco's Align (aligntoday.com) strategy, captured on 2026-11-16 from the One Page Strategic Plan,
 * the Alignment Checklist and the 4D Vision Summary. It is the default plan, and it can be reloaded from
 * Administration → Modules → Align ("Recharger l'archive Align").
 */
import type { ChecklistItem, Strategy } from './schemas';

export const ALIGN_ARCHIVE_DATE = '2026-11-16';

export const ARCHIVE_STRATEGY: Strategy = {
  id: 'plan',
  coreValues: ['Faire partie de la solution', 'Avoir du cœur au ventre', 'Être dédié aux clients', 'Être sérieusement drôle'],
  messages: [
    'Chaque projet doit créer de la valeur pour le client et contribuer à la rentabilité de Pubco. Chaque responsable connaît ses engagements et répond de ses résultats.',
    '',
    'Faire partie de la solution',
    'OUI : Prendre en charge un problème, proposer un correctif et vérifier le résultat.',
    'NON : Transférer le problème ou attendre que quelqu’un d’autre le règle.',
    '',
    'Être sérieusement drôle',
    'OUI : Travailler avec rigueur, respect et bonne humeur.',
    'NON : Banaliser une erreur ou manquer de respect sous prétexte d’humour.',
    '',
    'Être dédié aux clients',
    'OUI : Comprendre leurs besoins et tenir des engagements réalistes.',
    'NON : Promettre sans valider ou accepter des changements sans mesurer leur impact.',
    '',
    'Avoir du cœur au ventre',
    'OUI : Oser améliorer les méthodes, assumer ses décisions et avoir les conversations difficiles.',
    'NON : Cacher un écart, abandonner ou répéter une méthode qui ne fonctionne pas.',
  ].join('\n'),
  purpose:
    'Bâtir une entreprise durable où nos gens se développent et contribuent à la réussite de nos clients.\n\nCela relie les employés, les clients et la pérennité. Le 15 % net devient alors un objectif qui permet d’investir, de développer les compétences et d’assurer cet avenir.',
  bhag: 'Devenir une référence nord-américaine en solutions intégrées d’emballage, de présentoirs et de conditionnement, reconnue pour la fiabilité de son exécution.',
  brandPromise:
    'Vous offrir la tranquillité d’esprit grâce à une prise en charge complète, des engagements clairs et une exécution maîtrisée, de la conception à la livraison.',

  targets: {
    date: '2029-06-30',
    rows: [
      { category: 'Chiffre d’affaires', projected: '20 000 000', actual: '12 000 000', owner: 'Patrick Zacard' },
      { category: 'Profit net', projected: '15 %', actual: '1 %', owner: 'Nicole Heroux' },
      { category: '95 % des commandes livrées −3/+2 j', projected: '95 %', actual: '0', owner: 'Pablo Leiva' },
      { category: 'Projets clôturés avec coût de revient et marge réelle validés', projected: '100 %', actual: '0', owner: 'Mairame Bâ' },
    ],
  },
  keyThrusts: [
    'Développer des comptes rentables et récurrents qui utilisent notre offre intégrée : emballage, présentoirs, conditionnement et logistique.',
    'Maîtriser les coûts et protéger la marge, de la soumission à la facturation.',
    'Standardiser les méthodes et automatiser les opérations pour améliorer la productivité et la qualité.',
    'Unifier Pubco et Montech autour d’une planification commune et de données fiables.',
    'Développer une équipe de gestion autonome et responsable, avec les compétences et la relève nécessaires.',
  ],
  profitX: [
    'Marge brute générée par heure de MOD.',
    '',
    'Calcul : marge brute réelle en dollars ÷ heures de MOD réelles, sur les mêmes dossiers terminés.',
    '',
    'Exemple — Actuel : 100 000 $ de marge brute ÷ 2 000 heures = 50 $/h. Amélioré : 120 000 $ de marge brute ÷ 2 000 heures = 60 $/h.',
    '20 % plus de marge avec le même nombre d’heures. Cela peut venir de meilleurs prix, de projets mieux choisis, de moins de reprises ou de l’automatisation.',
    '',
    'Cet indicateur complète le réel/prévu : réel/prévu vérifie le respect du budget d’heures; marge brute/heure mesure ce que ces heures rapportent à Pubco.',
  ].join('\n'),

  goals: {
    date: '2027-06-30',
    rows: [
      { category: 'Marge nette', projected: '> 15 %', actual: '1 %', owner: 'Nicole Heroux' },
      { category: 'Livraison −3 / +2 jours', projected: '> 95 %', actual: '50 %', owner: 'Pablo Leiva' },
      { category: 'Taux de rejets de production', projected: '< 5 %', actual: '0', owner: 'Pablo Leiva' },
      { category: 'Heures MOD réelles ÷ MOD estimées', projected: '< 100 %', actual: '0', owner: 'Pablo Leiva' },
      { category: 'Écart du coût des matières réel vs estimé', projected: '< 0 %', actual: '0', owner: 'Mairame Bâ' },
    ],
  },
  keyInitiatives: [
    { text: 'Implanter le suivi de rentabilité par projet', quarter: null },
    { text: 'Standardiser le parcours de la soumission à la facturation', quarter: null },
    { text: 'Compléter l’intégration opérationnelle de Montech', quarter: null },
    { text: 'Déployer un programme de développement de clients récurrents en conditionnement', quarter: null },
    { text: 'Déployer la gestion par résultats dans chaque département', quarter: null },
  ],
  actions: [
    'Définir les critères d’acceptation des projets et les produits standards',
    'Structurer les demandes de soumission, les cibles commerciales et le suivi des ventes potentielles',
    'Formaliser la validation de faisabilité avant l’engagement envers le client',
    'Standardiser les estimations et les recettes : matériaux et heures prévues',
    'Assurer un dossier de production complet et validé avant le démarrage',
    'Maintenir la planification de production sur quatre semaines et les dates à jour',
    'Assurer la saisie des heures réelles, des matières consommées et des rejets',
    'Formaliser et faire appliquer les standards de qualité',
    'Fiabiliser les achats, les stocks et le suivi des écarts d’inventaire',
    'Standardiser les instructions de livraison et suivre les coûts de transport',
    'Assurer une facturation complète et exacte',
    'Implanter le suivi du coût de revient et de la marge par commande',
    'Structurer l’évaluation des compétences et la relève des postes critiques',
  ],

  actionsQtr: [
    { category: 'Valider la méthode de calcul et comparer l’estimé au réel sur 10 commandes terminées.', projected: '', actual: '', owner: 'Mairame Bâ' },
    { category: 'Dossier de production : approuver les étapes, les responsabilités et les documents obligatoires.', projected: '', actual: '', owner: 'Sebastien Poirier' },
    { category: 'Mettre en place un calendrier partagé sur quatre semaines, couvrant toutes les commandes confirmées.', projected: '', actual: '', owner: 'Pablo Leiva' },
    { category: 'Identifier les postes critiques et évaluer les compétences actuelles.', projected: '', actual: '', owner: 'Tammy Zacard' },
    { category: 'Mettre en place une méthode systématique pour calculer la MOD par projet.', projected: '', actual: '', owner: 'Pablo Leiva' },
  ],
  criticalNumbersBS: [],
  criticalNumbersPL: [],
  theme: { name: 'PROFIT NET = 15 %', deadline: '2026-12-31', target: '', celebration: '', reward: '' },

  swot: { strengths: [], weaknesses: [], opportunities: [], trends: [] },
  people: { employees: [], customers: [], shareholders: [] },
  process: { operations: [], sales: [], finance: [] },
  sandbox: '',
};

/** The quarter's company priorities in Align (Rocks), with their owner's name as written in Align. */
export const ARCHIVE_ROCKS: { title: string; owner: string; thrust: number; initiative: number }[] = [
  { title: 'Déployer la revue hebdomadaire des marges et des écarts des projets terminés', owner: 'Mairame Bâ', thrust: 1, initiative: 0 },
  { title: 'Atteindre 100 % de dossiers complets avant le démarrage des nouveaux projets', owner: 'Sebastien Poirier', thrust: 2, initiative: 1 },
  { title: 'Planifier 100 % des commandes à produire sur les quatre prochaines semaines', owner: 'Pablo Leiva', thrust: 3, initiative: 1 },
  { title: 'Rendre opérationnel le tableau de bord hebdomadaire de chaque département', owner: 'Nicole Heroux', thrust: 4, initiative: 4 },
];

/** Align's Alignment Checklist (Rockefeller Habits): 10 habits × 4 points, in French. */
const HABITS: [string, string[]][] = [
  ['1. L’équipe de direction est en santé et alignée.', [
    'Les membres de l’équipe comprennent leurs différences, leurs priorités et leurs styles.',
    'L’équipe se réunit souvent (idéalement chaque semaine) pour réfléchir à la stratégie.',
    'L’équipe suit une formation continue de direction (mensuelle recommandée).',
    'L’équipe sait débattre de façon constructive et chacun se sent à l’aise de participer.',
  ]],
  ['2. Tous sont alignés sur la chose n° 1 à accomplir ce trimestre pour faire avancer l’entreprise.', [
    'Le nombre critique qui fera avancer l’entreprise ce trimestre est identifié.',
    'De 3 à 5 priorités qui soutiennent le nombre critique sont identifiées et classées pour le trimestre.',
    'Un thème trimestriel et une célébration/récompense qui donnent vie au nombre critique sont annoncés à tous les employés.',
    'Le thème et le nombre critique sont affichés partout et les employés connaissent l’avancement chaque semaine.',
  ]],
  ['3. Le rythme de communication est établi et l’information circule rapidement et fidèlement.', [
    'Tous les employés participent à un huddle quotidien de moins de 15 minutes.',
    'Toutes les équipes ont une réunion hebdomadaire.',
    'La direction et les cadres intermédiaires se réunissent chaque mois pour apprendre, régler les grands enjeux et transmettre l’ADN.',
    'Chaque trimestre et chaque année, la direction et les cadres se réunissent hors site pour travailler sur les 4 décisions.',
  ]],
  ['4. Chaque facette de l’organisation a une personne responsable de l’atteinte des objectifs.', [
    'Le tableau des responsabilités fonctionnelles (FACe) est complété (les bonnes personnes, qui font les bonnes choses, bien).',
    'Chaque ligne des états financiers a une personne responsable.',
    'Chacun des 4 à 9 processus du tableau des responsabilités par processus (PACe) a un responsable.',
    'Chaque grand axe ou capacité sur 3 à 5 ans a un expert au comité consultatif si l’expertise n’existe pas à l’interne.',
  ]],
  ['5. Les commentaires des employés sont recueillis en continu pour cerner obstacles et occasions.', [
    'Les commentaires des employés sur les obstacles et les occasions sont recueillis chaque semaine.',
    'Une équipe de cadres intermédiaires est responsable de boucler la boucle sur tous les obstacles et occasions.',
    'Chaque dirigeant (et cadre) a une conversation Commencer/Arrêter/Continuer avec au moins un employé chaque semaine.',
    'Les constats tirés des conversations avec les employés sont partagés à la réunion hebdomadaire de direction.',
  ]],
  ['6. Les commentaires des clients sont analysés aussi souvent et aussi précisément que les données financières.', [
    'Tous les employés participent à la collecte de données clients.',
    'Une équipe de cadres intermédiaires est responsable de boucler la boucle sur tous les commentaires clients.',
    'Chaque dirigeant (et cadre) a une conversation « 4 questions » avec au moins un utilisateur final chaque semaine.',
    'Les constats tirés des conversations avec les clients sont partagés à la réunion hebdomadaire de direction.',
  ]],
  ['7. Les valeurs fondamentales et la raison d’être sont « vivantes » dans l’organisation.', [
    'Les valeurs sont découvertes, la raison d’être est formulée, et les deux sont connues de tous les employés.',
    'Les dirigeants et les cadres s’appuient sur les valeurs et la raison d’être pour féliciter ou réprimander.',
    'Les processus RH sont alignés sur les valeurs et la raison d’être (embauche, accueil, évaluation, reconnaissance, etc.).',
    'Des actions sont définies et réalisées chaque trimestre pour renforcer les valeurs et la raison d’être.',
  ]],
  ['8. Les employés savent expliquer avec justesse les éléments clés de la stratégie :', [
    'BHAG — son avancement est suivi et visible.',
    'Client principal — son profil en 25 mots ou moins.',
    '3 promesses de marque — et les KPI correspondants, rapportés chaque semaine.',
    'Argumentaire éclair — une réponse convaincante à « Que fait votre entreprise ? ».',
  ]],
  ['9. Tous les employés peuvent dire, chiffres à l’appui, s’ils ont eu une bonne journée ou une bonne semaine.', [
    '1 ou 2 indicateurs clés (KPI) sont rapportés chaque semaine pour chaque rôle ou personne.',
    'Chaque employé a 1 nombre critique aligné sur celui de l’entreprise pour le trimestre (ligne de mire claire).',
    'Chaque personne ou équipe a de 3 à 5 priorités (Rocks) alignées sur celles de l’entreprise.',
    'Chaque dirigeant et cadre a un coach (ou un pair) qui le tient responsable de ses changements de comportement.',
  ]],
  ['10. Les plans et les résultats de l’entreprise sont visibles de tous.', [
    'Une « salle de situation » est en place pour les réunions hebdomadaires (physique ou virtuelle).',
    'Les valeurs, la raison d’être et les priorités sont affichées partout dans l’entreprise.',
    'Des tableaux de pointage affichent partout l’avancement des KPI et des nombres critiques.',
    'Un système permet de suivre et de gérer les priorités et les KPI en cascade.',
  ]],
];

/** The 40 checklist items, ready to insert (ids are stable so reloading replaces them). */
export const ARCHIVE_CHECKLIST: ChecklistItem[] = HABITS.flatMap(([category, items], h) =>
  items.map((text, i) => ({ id: `chk_h${h + 1}_${i + 1}`, category, text, done: false, note: '', order: h * 10 + i })),
);
