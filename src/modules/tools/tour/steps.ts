import type { L } from '@/i18n';

/** One stop of the KPI guided tour. `target` is a CSS selector (prefer [data-tour="..."]); no target = centred card. */
export interface TourStep {
  /** Route to open before showing the step (omit to stay on the current page). */
  route?: string;
  target?: string;
  title: L;
  body: L;
  /** Optional link shown under the text (e.g. the PDF guide). */
  link?: { href: string; label: L };
}

/** The KPI user guide, served from public/docs. */
export const KPI_GUIDE_URL = '/docs/guide-outil-kpi.pdf';

export const KPI_TOUR_STEPS: TourStep[] = [
  {
    title: { fr: 'Bienvenue dans l’outil KPI', en: 'Welcome to the KPI tool' },
    body: {
      fr: 'Les équipes y suivent leurs indicateurs et leurs priorités, puis les passent en revue chaque semaine lors d’un huddle, une courte réunion d’équipe. Cette visite présente les écrans dans un ordre utile.',
      en: 'Teams track their indicators and priorities here, then review them every week in a huddle, a short team meeting. This tour walks through the screens in a useful order.',
    },
  },
  {
    target: '[data-nav="tools:kpi"]',
    title: { fr: 'Le menu KPI', en: 'The KPI menu' },
    body: {
      fr: 'La section KPI de la barre latérale donne accès aux cinq écrans : tableau de bord, indicateurs, priorités, huddles et équipes. La flèche de la section permet de la replier.',
      en: 'The KPI section of the sidebar opens the five screens: dashboard, indicators, priorities, huddles and teams. The arrow on the section folds it away.',
    },
  },
  {
    route: '/tools/kpi',
    target: '[data-tour="kpi-dashboard"]',
    title: { fr: 'Tableau de bord', en: 'Dashboard' },
    body: {
      fr: 'Il affiche les nombres critiques, les saisies en retard pour la dernière période, vos priorités et vos tâches ouvertes, puis vos prochains huddles. Cliquer sur un indicateur ouvre sa page.',
      en: 'It shows the critical numbers, the entries missing for the last period, your priorities and open tasks, then your next huddles. Clicking an indicator opens its page.',
    },
  },
  {
    route: '/tools/kpi/teams',
    target: '[data-tour="teams-list"]',
    title: { fr: 'Commencez par les équipes', en: 'Start with the teams' },
    body: {
      fr: 'Les indicateurs, les priorités et les huddles peuvent être rattachés à une équipe. Chaque carte montre le responsable, les membres et le nombre d’éléments rattachés. Cliquer sur une carte la modifie ; les équipes archivées sont masquées par défaut.',
      en: 'Indicators, priorities and huddles can be attached to a team. Each card shows the owner, the members and how many items are attached. Clicking a card edits it; archived teams are hidden by default.',
    },
  },
  {
    route: '/tools/kpi/teams',
    target: '[data-tour="teams-new"]',
    title: { fr: 'Créer une équipe', en: 'Create a team' },
    body: {
      fr: 'Le bouton « Équipe » ouvre le formulaire : nom, responsable, couleur et membres. Créez l’équipe avant les indicateurs et les huddles qui lui seront rattachés.',
      en: 'The “Team” button opens the form: name, owner, colour and members. Create the team before the indicators and huddles that will belong to it.',
    },
  },
  {
    route: '/tools/kpi/indicators',
    target: '[data-tour="kpis-table"]',
    title: { fr: 'Indicateurs et saisies', en: 'Indicators and entries' },
    body: {
      fr: 'Chaque ligne est un indicateur avec sa cible et son sens (plus haut ou plus bas est mieux). Cliquez sur une période pour saisir sa valeur. La couleur indique l’écart à la cible : vert si atteint, jaune si l’écart est d’au plus 10 %, rouge au-delà.',
      en: 'Each row is an indicator with its target and direction (higher or lower is better). Click a period to enter its value. The colour shows the gap to target: green when met, yellow when within 10%, red beyond that.',
    },
  },
  {
    route: '/tools/kpi/indicators',
    target: '[data-tour="kpis-filters"]',
    title: { fr: 'Créer et filtrer', en: 'Create and filter' },
    body: {
      fr: 'Le bouton « Indicateur » crée un indicateur : nom, définition et source, unité, cible, fréquence, responsable et équipe. Cochez « critique » pour le faire paraître parmi les nombres critiques. Les filtres restreignent la liste par recherche, statut, équipe ou responsable.',
      en: 'The “Indicator” button creates one: name, definition and source, unit, target, frequency, owner and team. Tick “critical” to show it among the critical numbers. The filters narrow the list by search, status, team or owner.',
    },
  },
  {
    route: '/tools/kpi/priorities',
    target: '[data-tour="priorities-list"]',
    title: { fr: 'Priorités du trimestre', en: 'Quarterly priorities' },
    body: {
      fr: 'Les priorités sont regroupées par trimestre, que les flèches permettent de changer. Chacune a un responsable, une progression en % et un statut vert, jaune ou rouge. La « Mise à jour de la semaine » permet de noter l’avancement, et une priorité peut avoir des sous-priorités.',
      en: 'Priorities are grouped by quarter, which the arrows change. Each has an owner, a progress percentage and a green, yellow or red status. The “Weekly update” records progress, and a priority can have sub-priorities.',
    },
  },
  {
    route: '/tools/kpi/priorities',
    target: '[data-tour="priorities-new"]',
    title: { fr: 'Ajouter une priorité', en: 'Add a priority' },
    body: {
      fr: 'Le bouton « Priorité » crée une priorité pour le trimestre affiché, à l’échelle de l’entreprise ou d’une équipe. Une priorité peut être archivée ; elle reste visible si vous cochez « Afficher les archivées ».',
      en: 'The “Priority” button creates a priority for the displayed quarter, at company or team scope. A priority can be archived; it stays visible when “Show archived” is ticked.',
    },
  },
  {
    route: '/tools/kpi/huddles',
    target: '[data-tour="huddles-list"]',
    title: { fr: 'Huddles', en: 'Huddles' },
    body: {
      fr: 'Un huddle est une réunion d’équipe récurrente de 15 à 30 minutes. « Ouvrir la réunion » lance la page de réunion : tour de table, nombres critiques, performance de l’équipe, priorités et tâches « Qui – Quoi – Quand » de la semaine.',
      en: 'A huddle is a recurring 15 to 30 minute team meeting. “Open meeting” opens the meeting page: round table, critical numbers, team performance, priorities and the week’s “Who – What – When” tasks.',
    },
  },
  {
    route: '/tools/kpi/huddles',
    target: '[data-tour="huddles-new"]',
    title: { fr: 'Créer un huddle', en: 'Create a huddle' },
    body: {
      fr: 'Le bouton « Huddle » ouvre les paramètres : nom, équipe, fréquence et jour, responsable, membres, lien vidéo et sections de la réunion. Les huddles inactifs sont masqués par défaut.',
      en: 'The “Huddle” button opens the settings: name, team, cadence and day, owner, members, video link and meeting sections. Inactive huddles are hidden by default.',
    },
  },
  {
    title: { fr: 'Routine hebdomadaire', en: 'Weekly routine' },
    body: {
      fr: 'Chaque semaine : saisissez les valeurs manquantes, mettez à jour vos priorités, puis tenez le huddle depuis sa page de réunion. Pour aller plus loin, consultez le guide de l’outil KPI (PDF).',
      en: 'Each week: enter the missing values, update your priorities, then hold the huddle from its meeting page. To go further, see the KPI tool guide (PDF).',
    },
    link: { href: KPI_GUIDE_URL, label: { fr: 'Ouvrir le guide (PDF)', en: 'Open the guide (PDF)' } },
  },
];
