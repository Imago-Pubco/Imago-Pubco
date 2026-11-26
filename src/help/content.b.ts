/**
 * In-app help, part B: Administration, Align, Microsoft 365 (O365), HR and Conformité, KPI tool, Function Fox (project
 * management). Each topic describes only what the page does today (checked against the page code). Apostrophes are
 * typographic (’) as in the UI. Permission = the key the page needs; '' is never used here because every page in this
 * part is gated by its module or by a nav permission.
 */
import type { HelpTopic } from './types.ts';

export const HELP_B: HelpTopic[] = [
  // ───────────────────────── Administration ─────────────────────────
  {
    id: 'admin.overview',
    module: 'admin',
    path: '/admin',
    permission: 'admin.access',
    title: { fr: 'Portail administratif', en: 'Admin portal' },
    summary: {
      fr: 'Page d’accueil de l’Administration : nombre d’utilisateurs actifs, de groupes d’accès et de connexions de la semaine, avec les dernières entrées du journal d’audit.',
      en: 'Administration home: counts of active users, access groups and sign-ins this week, with the latest audit log entries.',
    },
    tips: [
      { fr: 'Le lien « Journal complet » est visible par tous ceux qui ont accès au portail ; la page du journal exige la permission « Consulter le journal d’audit ».', en: 'The “Journal complet” link is visible to everyone with portal access; the audit log page itself requires “View audit log”.' },
      { fr: 'Les onglets de la barre du haut n’apparaissent que si vous avez la permission de la section.', en: 'Tabs in the top bar only appear if you hold the permission of that section.' },
      { fr: 'Cette page ne modifie rien : elle sert de tableau de bord.', en: 'This page changes nothing: it is a dashboard.' },
    ],
    howTo: [
      {
        q: { fr: 'Où gérer les comptes ?', en: 'Where do I manage accounts?' },
        a: { fr: 'Ouvrez l’onglet « Utilisateurs » (permission « Gérer les utilisateurs »).', en: 'Open the “Utilisateurs” tab (permission “Manage users”).' },
      },
    ],
    keywords: ['administration', 'admin', 'portail', 'aperçu', 'overview', 'tableau de bord', 'dashboard'],
  },
  {
    id: 'admin.users',
    module: 'admin',
    path: '/admin/users',
    permission: 'admin.users.manage',
    title: { fr: 'Utilisateurs', en: 'Users' },
    summary: {
      fr: 'Créer, modifier, désactiver et supprimer les comptes Imago, et choisir les groupes d’accès de chaque personne.',
      en: 'Create, edit, deactivate and delete Imago accounts, and choose each person’s access groups.',
    },
    tips: [
      { fr: 'Pour bloquer un accès sans perdre l’historique, décochez « Compte actif » au lieu de supprimer.', en: 'To block access without losing history, untick “Compte actif” instead of deleting.' },
      { fr: 'La suppression est définitive : la fiche disparaît et ses sessions se ferment. L’historique d’audit est conservé.', en: 'Deletion is permanent: the account disappears and its sessions close. Audit history is kept.' },
      { fr: 'Vous ne pouvez pas désactiver votre propre compte ni retirer votre propre accès à la gestion des utilisateurs.', en: 'You cannot deactivate your own account or remove your own user-management access.' },
      { fr: 'L’icône « Voir le portail comme cette personne (lecture seule) » demande la permission « Voir le portail comme un autre utilisateur ». La session dure 30 minutes et se termine par la barre en bas de l’écran.', en: 'The “Voir le portail comme cette personne (lecture seule)” icon needs “View the portal as another user”. The session lasts 30 minutes and ends from the bar at the bottom of the screen.' },
      { fr: 'Le nom d’identifiant doit être unique ; il est enregistré en minuscules.', en: 'The username must be unique; it is stored in lowercase.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment créer un utilisateur ?', en: 'How do I create a user?' },
        a: {
          fr: 'Cliquez « Utilisateur ». Saisissez « Nom complet », « Identifiant » et « Courriel ». Cochez « Envoyer le courriel de bienvenue » ou saisissez un mot de passe d’au moins 12 caractères. Cochez les groupes d’accès, puis « Enregistrer ».',
          en: 'Click “Utilisateur”. Enter “Nom complet”, “Identifiant” and “Courriel”. Either tick “Envoyer le courriel de bienvenue” or type a password of at least 12 characters. Tick the access groups, then click “Enregistrer”.',
        },
      },
      {
        q: { fr: 'Comment désactiver ou supprimer un compte ?', en: 'How do I deactivate or delete an account?' },
        a: {
          fr: 'Cliquez l’icône « Modifier » de la ligne. Pour désactiver, décochez « Compte actif » puis « Enregistrer ». Pour supprimer, cliquez « Supprimer », puis confirmez « Supprimer définitivement ».',
          en: 'Click the “Modifier” icon on the row. To deactivate, untick “Compte actif” then “Enregistrer”. To delete, click “Supprimer” and confirm “Supprimer définitivement”.',
        },
      },
      {
        q: { fr: 'Comment changer le mot de passe d’une personne ?', en: 'How do I change someone’s password?' },
        a: {
          fr: 'Cliquez « Modifier », saisissez « Nouveau mot de passe (facultatif) », puis « Enregistrer ». Le journal note « (password reset) ».',
          en: 'Click “Modifier”, type “Nouveau mot de passe (facultatif)”, then “Enregistrer”. The log notes “(password reset)”.',
        },
      },
    ],
    keywords: ['utilisateur', 'utilisateurs', 'compte', 'comptes', 'user', 'users', 'créer', 'désactiver', 'supprimer', 'mot de passe', 'password', 'bienvenue'],
  },
  {
    id: 'admin.groups',
    module: 'admin',
    path: '/admin/groups',
    permission: 'admin.groups.manage',
    title: { fr: 'Groupes d’accès', en: 'Access groups' },
    summary: {
      fr: 'Définir les groupes de permissions (une matrice par module) et, dans l’onglet « Droits individuels », accorder des droits directs à une personne.',
      en: 'Define permission groups (a matrix per module) and, in the “Droits individuels” tab, grant direct rights to one person.',
    },
    tips: [
      { fr: 'Un groupe système ne peut pas être supprimé, et sa case « Super administrateur (tout) » est désactivée.', en: 'A system group cannot be deleted, and its “Super administrateur (tout)” box is disabled.' },
      { fr: 'Supprimer un groupe le retire immédiatement de tous ses membres. Il n’y a pas de confirmation.', en: 'Deleting a group removes it from all its members at once. There is no confirmation.' },
      { fr: 'Les membres d’un groupe s’ajoutent depuis la page Utilisateurs, pas ici : cette page ne fait que les afficher.', en: 'Group members are added from the Users page; this page only lists them.' },
      { fr: 'Les droits donnés par un groupe apparaissent cochés et verrouillés « via un groupe » dans « Droits individuels ».', en: 'Rights granted by a group show ticked and locked “via un groupe” in “Droits individuels”.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment créer un groupe ?', en: 'How do I create a group?' },
        a: {
          fr: 'Cliquez « Groupe ». Saisissez « Nom » et « Description », choisissez « Couleur », cochez les permissions (ou « Tout le module »), puis « Enregistrer ».',
          en: 'Click “Groupe”. Enter “Nom” and “Description”, pick “Couleur”, tick the permissions (or “Tout le module”), then “Enregistrer”.',
        },
      },
      {
        q: { fr: 'Comment donner un droit à une seule personne ?', en: 'How do I give one person an extra right?' },
        a: {
          fr: 'Ouvrez l’onglet « Droits individuels », cherchez la personne dans « Rechercher un utilisateur… », cochez les droits voulus, puis « Enregistrer ».',
          en: 'Open the “Droits individuels” tab, search the person in “Rechercher un utilisateur…”, tick the rights, then “Enregistrer”.',
        },
      },
    ],
    keywords: ['groupe', 'groupes', 'permissions', 'droits', 'rights', 'access groups', 'rôle', 'role', 'accès'],
  },
  {
    id: 'admin.audit',
    module: 'admin',
    path: '/admin/audit',
    permission: 'admin.audit.view',
    title: { fr: 'Journal d’audit', en: 'Audit log' },
    summary: {
      fr: 'Consulter en lecture seule qui a fait quoi dans Imago : date, utilisateur, action et détail.',
      en: 'Read-only view of who did what in Imago: date, user, action and detail.',
    },
    tips: [
      { fr: 'Filtrez par « Tous les utilisateurs », par dates « Du » et « Au », ou par texte avec « Filtrer… ». « Réinitialiser » efface les filtres.', en: 'Filter by “Tous les utilisateurs”, dates “Du” and “Au”, or text with “Filtrer…”. “Réinitialiser” clears the filters.' },
      { fr: 'Au maximum 500 lignes sont affichées. Si la liste est tronquée, resserrez les filtres.', en: 'At most 500 rows are shown. If the list is cut, narrow the filters.' },
      { fr: 'La marque « ·ui » signale une entrée déclarée par le navigateur que le serveur n’a pas pu confirmer.', en: 'The “·ui” marker means the browser declared the entry and the server could not confirm it.' },
      { fr: 'La colonne IP n’apparaît que sur la page complète du journal.', en: 'The IP column only appears on the full log page.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment voir ce qu’une personne a fait cette semaine ?', en: 'How do I see what one person did this week?' },
        a: {
          fr: 'Choisissez la personne dans « Tous les utilisateurs », puis renseignez « Du » et « Au ».',
          en: 'Pick the person in “Tous les utilisateurs”, then fill “Du” and “Au”.',
        },
      },
    ],
    keywords: ['audit', 'journal', 'historique', 'log', 'traçabilité', 'qui a fait quoi', 'activité', 'activity'],
  },
  {
    id: 'admin.modules',
    module: 'admin',
    path: '/admin/modules',
    permission: 'admin.access',
    title: { fr: 'Modules', en: 'Modules' },
    summary: {
      fr: 'Liste des modules d’Imago. Chaque carte ouvre les paramètres du module, si vous avez la permission de ce module.',
      en: 'List of Imago modules. Each card opens that module’s settings, if you hold the module’s settings permission.',
    },
    tips: [
      { fr: 'Une carte indiquant « Réservé aux personnes qui gèrent ce module » exige la permission de paramètres de ce module.', en: 'A card saying “Réservé aux personnes qui gèrent ce module” needs that module’s settings permission.' },
      { fr: 'Une carte sans paramètres est marquée « Aucun paramètre pour l’instant ».', en: 'A card without settings is marked as having no settings yet.' },
      { fr: 'Le module Administration lui-même n’est pas listé.', en: 'The Administration module itself is not listed.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ouvrir les paramètres du module KPI ?', en: 'How do I open the KPI module settings?' },
        a: {
          fr: 'Cliquez la carte « KPI ». Elle n’est ouverte qu’à ceux qui ont la permission « Gérer les données KPI ».',
          en: 'Click the “KPI” card. It only opens for people with “Manage KPI data”.',
        },
      },
    ],
    keywords: ['modules', 'paramètres', 'settings', 'module', 'activer', 'configuration'],
  },
  {
    id: 'admin.mail',
    module: 'admin',
    path: '/admin/mail',
    permission: 'admin.mail',
    title: { fr: 'Courriels', en: 'E-mail' },
    summary: {
      fr: 'Modifier les courriels automatiques d’Imago (bienvenue, réinitialisation de mot de passe, changement de mot de passe) et envoyer un courriel test. Le serveur d’envoi se configure dans le fichier .env du serveur.',
      en: 'Edit Imago’s automatic e-mails (welcome, password reset, password changed) and send a test e-mail. The sending server is configured in the server’s .env file.',
    },
    tips: [
      { fr: 'Le serveur d’envoi (SMTP) ne s’édite pas ici : la page affiche « Configuré » ou « Non configuré ». « Vérifier la connexion » teste la liaison.', en: 'The SMTP server is not edited here: the page shows “Configuré” or “Non configuré”. “Vérifier la connexion” tests the link.' },
      { fr: 'Décochez « Envoyer ce courriel » pour qu’un gabarit ne soit plus envoyé.', en: 'Untick “Envoyer ce courriel” so a template is no longer sent.' },
      { fr: '« Enregistrer » n’est actif que si le texte a changé. « Rétablir le texte d’origine » efface les modifications non enregistrées après confirmation.', en: '“Enregistrer” is active only when the text changed. “Rétablir le texte d’origine” discards unsaved edits after confirmation.' },
      { fr: 'Dans « Texte », une ligne vide crée un paragraphe, « **gras** » met en gras, « - » crée une liste. Les pastilles insèrent des champs {{…}}.', en: 'In “Texte”, a blank line starts a paragraph, “**bold**” is bold, “- ” makes a list. Chips insert {{…}} fields.' },
      { fr: 'L’aperçu se met à jour pendant la rédaction avec des valeurs d’exemple.', en: 'The preview updates while you write, with sample values.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment modifier le courriel de bienvenue ?', en: 'How do I change the welcome e-mail?' },
        a: {
          fr: 'Choisissez le gabarit « welcome », modifiez « Objet » ou « Texte », puis « Enregistrer ». Pour tester, saisissez une adresse dans « Envoyer un test à… » et cliquez « Envoyer un courriel test ».',
          en: 'Select the “welcome” template, edit “Objet” or “Texte”, then “Enregistrer”. To test, type an address in “Envoyer un test à…” and click “Envoyer un courriel test”.',
        },
      },
    ],
    keywords: ['courriel', 'courriels', 'email', 'e-mail', 'mail', 'smtp', 'gabarit', 'template', 'bienvenue', 'réinitialisation'],
  },
  {
    id: 'admin.menu',
    module: 'admin',
    path: '/admin/menu',
    permission: 'admin.menu',
    title: { fr: 'Menu', en: 'Menu' },
    summary: {
      fr: 'Modifier le menu latéral de tous les utilisateurs : noms affichés, ordre des modules et sections.',
      en: 'Change the sidebar menu for all users: displayed names, module order and sections.',
    },
    tips: [
      { fr: 'Les changements restent un brouillon jusqu’à « Enregistrer ». « Annuler les modifications » les abandonne.', en: 'Changes stay a draft until “Enregistrer”. “Annuler les modifications” discards them.' },
      { fr: '« Rétablir le menu par défaut » remet les sections d’origine et efface aussi les noms personnalisés (après confirmation « Rétablir »).', en: '“Rétablir le menu par défaut” restores the original sections and also clears custom names (after confirming “Rétablir”).' },
      { fr: 'Une section vide est masquée. Le tableau de bord reste en haut du menu et le Support TI en bas.', en: 'An empty section is hidden. The dashboard stays at the top of the menu and IT support at the bottom.' },
      { fr: 'Chaque section a « Nom FR » et « Nom EN ». Chaque module a « Nom affiché FR » et « Nom affiché EN ».', en: 'Each section has “Nom FR” and “Nom EN”. Each module has “Nom affiché FR” and “Nom affiché EN”.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment déplacer un module dans une autre section ?', en: 'How do I move a module to another section?' },
        a: {
          fr: 'Dans la carte du module, utilisez « Déplacer vers… » et choisissez la section, puis « Enregistrer ».',
          en: 'On the module’s card, use “Déplacer vers…” to pick the section, then “Enregistrer”.',
        },
      },
      {
        q: { fr: 'Comment ajouter une section ?', en: 'How do I add a section?' },
        a: {
          fr: 'Cliquez « Ajouter une section », saisissez « Nom FR » et « Nom EN », puis « Enregistrer ».',
          en: 'Click “Ajouter une section”, enter “Nom FR” and “Nom EN”, then “Enregistrer”.',
        },
      },
    ],
    keywords: ['menu', 'navigation', 'sidebar', 'barre latérale', 'section', 'sections', 'ordre', 'renommer'],
  },
  {
    id: 'admin.branding',
    module: 'admin',
    path: '/admin/branding',
    permission: 'admin.branding',
    title: { fr: 'Image de marque', en: 'Branding' },
    summary: {
      fr: 'Personnaliser le nom, le logo, l’icône de l’onglet et les couleurs principales de l’application. L’aperçu reste local jusqu’à « Enregistrer ».',
      en: 'Customise the app name, logo, browser tab icon and main colours. The preview stays local until “Enregistrer”.',
    },
    tips: [
      { fr: '« Par défaut » rétablit l’identité d’origine (après confirmation).', en: '“Par défaut” restores the original identity (after confirmation).' },
      { fr: 'Le logo est redimensionné à 512 px et l’icône d’onglet à 64 px ; une image trop lourde est refusée.', en: 'The logo is resized to 512 px and the tab icon to 64 px; an oversized image is refused.' },
      { fr: 'Les couleurs des modules ne changent pas : seules les couleurs de l’application et du menu changent.', en: 'Module colours do not change: only the application and sidebar colours do.' },
      { fr: 'Importer depuis un site web : saisissez « Adresse du site » puis « Analyser » (mode serveur seulement).', en: 'Import from a website: enter “Adresse du site” and click “Analyser” (server mode only).' },
    ],
    howTo: [
      {
        q: { fr: 'Comment changer le nom de l’application ?', en: 'How do I change the application name?' },
        a: {
          fr: 'Modifiez « Nom de l’application (menu latéral, connexion) », puis « Enregistrer ».',
          en: 'Edit “Nom de l’application (menu latéral, connexion)”, then “Enregistrer”.',
        },
      },
      {
        q: { fr: 'Comment changer la couleur principale ?', en: 'How do I change the main colour?' },
        a: {
          fr: 'Modifiez « Couleur principale (boutons, liens, accent) », puis « Enregistrer ». Le bouton de réinitialisation de chaque couleur rétablit sa valeur d’origine.',
          en: 'Change “Couleur principale (boutons, liens, accent)”, then “Enregistrer”. Each colour’s reset button restores its original value.',
        },
      },
    ],
    keywords: ['marque', 'image de marque', 'branding', 'logo', 'couleurs', 'thème', 'theme', 'nom', 'icône', 'favicon'],
  },
  {
    id: 'admin.ai',
    module: 'admin',
    path: '/admin/ai',
    permission: 'admin.ai',
    title: { fr: 'IA et quotas', en: 'AI & quotas' },
    summary: {
      fr: 'Fixer les limites mensuelles d’utilisation de l’IA (jetons et demandes) pour l’organisation, par défaut pour chaque personne et, au besoin, pour une personne en particulier. Les compteurs repartent à zéro le 1er du mois.',
      en: 'Set monthly AI usage limits (tokens and requests) for the organisation, a default for each person and, if needed, per-person overrides. Counters reset on the 1st of each month.',
    },
    tips: [
      { fr: '0 signifie illimité. Un champ vide hérite de la valeur par défaut.', en: '0 means unlimited. An empty field inherits the default.' },
      { fr: 'Les limites d’une personne se règlent champ par champ (« Jetons (perso) », « Demandes (perso) ») ; « Réinitialiser » efface ses valeurs, puis il faut « Enregistrer ».', en: 'A person’s limits are set field by field (“Jetons (perso)”, “Demandes (perso)”); “Réinitialiser” clears their values, then “Enregistrer” is needed.' },
      { fr: 'Un appel commencé juste sous la limite peut la dépasser légèrement.', en: 'A call started just under the limit can exceed it slightly.' },
      { fr: 'La page couvre les appels d’IA des ventes et de la comptabilité. « Par fonctionnalité » et l’historique sur 12 mois sont affichés en bas.', en: 'The page covers AI calls from sales and accounting. “Par fonctionnalité” and a 12-month history are shown below.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment fixer la limite par défaut de chaque personne ?', en: 'How do I set the default limit for each person?' },
        a: {
          fr: 'Sous « Par utilisateur (défaut) », saisissez « Jetons par mois » et/ou « Demandes par mois », puis « Enregistrer ».',
          en: 'Under “Par utilisateur (défaut)”, type “Jetons par mois” and/or “Demandes par mois”, then “Enregistrer”.',
        },
      },
      {
        q: { fr: 'Comment donner une limite particulière à une personne ?', en: 'How do I give one person a specific limit?' },
        a: {
          fr: 'Dans « Utilisation par personne », saisissez dans « Jetons (perso) » ou « Demandes (perso) » de la personne, puis « Enregistrer ». Pour revenir à la valeur par défaut, « Réinitialiser » puis « Enregistrer ».',
          en: 'In “Utilisation par personne”, type in the person’s “Jetons (perso)” or “Demandes (perso)”, then “Enregistrer”. To go back to the default, “Réinitialiser” then “Enregistrer”.',
        },
      },
    ],
    keywords: ['ia', 'ai', 'quota', 'quotas', 'limite', 'jetons', 'tokens', 'demandes', 'requests', 'budget ia', 'utilisation'],
  },
  {
    id: 'admin.system',
    module: 'admin',
    path: '/admin/system',
    permission: 'admin.system',
    title: { fr: 'Système', en: 'System' },
    summary: {
      fr: 'État des intégrations (Business Central, boîte de factures, courriels sortants, lecture IA des PDF), export des données et, en mode serveur, mise à jour de l’application.',
      en: 'Status of integrations (Business Central, invoice mailbox, outgoing e-mail, AI PDF reading), data export and, in server mode, application updates.',
    },
    tips: [
      { fr: 'Les clés des intégrations se règlent dans le fichier .env du serveur. La page n’affiche que « Configuré » ou « Non configuré ».', en: 'Integration keys are set in the server’s .env file. The page only shows “Configuré” or “Non configuré”.' },
      { fr: '« Exporter (JSON) » télécharge une copie des données.', en: '“Exporter (JSON)” downloads a copy of the data.' },
      { fr: 'La mise à jour exige de taper METTRE À JOUR exactement. Elle sauvegarde la base, puis redémarre l’application (1 à 3 minutes d’indisponibilité pour tous) ; en cas d’échec, elle revient en arrière.', en: 'The update requires typing METTRE À JOUR exactly. It backs up the database, then restarts the app (1 to 3 minutes of downtime for everyone); on failure it rolls back.' },
      { fr: 'Hors serveur (démonstration dans le navigateur), « Réinitialiser les données de démo » efface toutes les données de ce navigateur et vous déconnecte.', en: 'Outside server mode (browser demo), “Réinitialiser les données de démo” erases all data in this browser and signs you out.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment tester une connexion ?', en: 'How do I test a connection?' },
        a: {
          fr: 'Cliquez « Tester la connexion » sur la carte Business Central ou « Boîte de factures (Microsoft Graph) ».',
          en: 'Click “Tester la connexion” on the Business Central card or the “Boîte de factures (Microsoft Graph)” card.',
        },
      },
      {
        q: { fr: 'Comment mettre à jour l’application ?', en: 'How do I update the application?' },
        a: {
          fr: 'Cliquez « Vérifier sur GitHub », puis « Mettre à jour maintenant » (désactivé s’il n’y a rien de nouveau). Tapez METTRE À JOUR et confirmez.',
          en: 'Click “Vérifier sur GitHub”, then “Mettre à jour maintenant” (disabled when nothing is new). Type METTRE À JOUR and confirm.',
        },
      },
    ],
    keywords: ['système', 'system', 'export', 'mise à jour', 'update', 'intégrations', 'business central', 'smtp', 'sauvegarde', 'backup'],
  },
  {
    id: 'admin.settings.tools',
    module: 'admin',
    path: '/admin/modules/tools',
    permission: 'tools.kpi.data',
    title: { fr: 'Paramètres - données KPI', en: 'Settings - KPI data' },
    summary: {
      fr: 'Gérer les données de l’outil KPI : importer les anciennes données, associer les personnes à Align, prendre et restaurer des instantanés, ou effacer les données.',
      en: 'Manage KPI tool data: import old data, match people with Align, take and restore snapshots, or erase the data.',
    },
    tips: [
      { fr: '« Importer les anciennes données » remplace toutes les données KPI actuelles. Prenez un instantané avant.', en: '“Importer les anciennes données” replaces all current KPI data. Take a snapshot first.' },
      { fr: 'Trois emplacements d’instantanés. Quand ils sont pleins, « Écraser et prendre un instantané » remplace le plus ancien, après confirmation.', en: 'Three snapshot slots. When they are full, “Écraser et prendre un instantané” replaces the oldest, after confirmation.' },
      { fr: '« Effacer toutes les données KPI » exige de taper EFFACER. Les archives et les instantanés sont conservés.', en: '“Effacer toutes les données KPI” requires typing EFFACER. Archives and snapshots are kept.' },
      { fr: 'Cette page exige la permission « Gérer les données KPI ».', en: 'This page requires “Manage KPI data”.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment prendre un instantané ?', en: 'How do I take a snapshot?' },
        a: { fr: 'Cliquez « Prendre un instantané » dans la section « Instantanés ».', en: 'Click “Prendre un instantané” in the “Instantanés” section.' },
      },
      {
        q: { fr: 'Comment restaurer des données ?', en: 'How do I restore data?' },
        a: {
          fr: 'Cliquez « Restaurer... », choisissez la source (archive ou instantané), puis « Restaurer » dans « Restaurer les données KPI ».',
          en: 'Click “Restaurer...”, choose the source (archive or snapshot), then “Restaurer” in “Restaurer les données KPI”.',
        },
      },
    ],
    keywords: ['données kpi', 'kpi', 'import', 'instantané', 'snapshot', 'restaurer', 'restore', 'effacer', 'correspondance', 'paramètres'],
  },
  {
    id: 'admin.settings.align',
    module: 'admin',
    path: '/admin/modules/align',
    permission: 'align.data',
    title: { fr: 'Align - données', en: 'Align - data' },
    summary: {
      fr: 'Importer les données de l’outil KPI dans Align, reprendre une archive, prendre ou restaurer des instantanés, ou effacer les données Align.',
      en: 'Import KPI tool data into Align, reload an archive, take or restore snapshots, or erase Align data.',
    },
    tips: [
      { fr: '« Importer… » remplace les Rocks, priorités, notes et huddles actuels ; le plan et la liste de vérification sont conservés. Une sauvegarde est gardée. Tapez REMPLACER pour confirmer.', en: '“Importer…” replaces current Rocks, priorities, notes and huddles; the plan and checklist are kept. A backup is kept. Type REMPLACER to confirm.' },
      { fr: 'Restaurer une archive ou un instantané, ou recharger l’archive, exige les cinq permissions Align (données, Rocks, priorités, huddles, stratégie).', en: 'Restoring an archive or snapshot, or reloading the archive, needs all five Align permissions (data, Rocks, priorities, huddles, strategy).' },
      { fr: 'Trois emplacements d’instantanés ; « Écraser et prendre l’instantané » remplace le plus ancien.', en: 'Three snapshot slots; “Écraser et prendre l’instantané” replaces the oldest.' },
      { fr: '« Effacer toutes les données Align » exige de taper EFFACER ; les instantanés sont conservés.', en: '“Effacer toutes les données Align” requires typing EFFACER; snapshots are kept.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment importer les données de l’outil KPI ?', en: 'How do I import data from the KPI tool?' },
        a: {
          fr: 'Cliquez « Importer… », tapez REMPLACER, puis « Remplacer ». Le serveur exige aussi les droits Rocks, priorités, huddles et KPI.',
          en: 'Click “Importer…”, type REMPLACER, then “Remplacer”. The server also requires the Rocks, priorities, huddles and KPI rights.',
        },
      },
    ],
    keywords: ['align', 'données align', 'import', 'kpi', 'instantané', 'restaurer', 'effacer', 'archive', 'paramètres'],
  },

  // ───────────────────────── Align (company goals) ─────────────────────────
  {
    id: 'align.dashboard',
    module: 'align',
    path: '/align',
    permission: 'align.access',
    title: { fr: 'Tableau de bord Align', en: 'Align dashboard' },
    summary: {
      fr: 'Vue d’ensemble du trimestre : progression des Rocks et état des priorités de l’entreprise. Chaque tuile ouvre le détail. La page est en lecture seule.',
      en: 'Quarter overview: Rock progress and the state of company priorities. Each tile opens its detail. The page is read-only.',
    },
    tips: [
      { fr: 'Les flèches changent de trimestre ; « Trimestre actuel » revient au trimestre en cours.', en: 'The arrows change the quarter; “Trimestre actuel” goes back to the current quarter.' },
      { fr: 'Tuiles : « Progression des Rocks », « Priorités terminées », « Priorités bloquées », « Priorités en retard », « Mes priorités ».', en: 'Tiles: “Progression des Rocks”, “Priorités terminées”, “Priorités bloquées”, “Priorités en retard”, “Mes priorités”.' },
      { fr: 'Une priorité est « terminée » à 100 %.', en: 'A priority is “terminée” at 100%.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment voir mes priorités ?', en: 'How do I see my priorities?' },
        a: { fr: 'Cliquez la tuile « Mes priorités ».', en: 'Click the “Mes priorités” tile.' },
      },
    ],
    keywords: ['align', 'tableau de bord', 'dashboard', 'progression', 'objectifs', 'trimestre', 'priorités', 'rocks'],
  },
  {
    id: 'align.strategy',
    module: 'align',
    path: '/align/strategy',
    permission: 'align.access',
    title: { fr: 'Stratégie', en: 'Strategy' },
    summary: {
      fr: 'Le plan stratégique sur une page, la liste de vérification d’alignement et la Vision 4D de l’entreprise. La modification exige la permission « Modifier la stratégie ».',
      en: 'The one-page strategic plan, the alignment checklist and the company 4D Vision. Editing requires “Edit the strategy”.',
    },
    tips: [
      { fr: 'Trois onglets : « Plan stratégique sur une page », « Liste de vérification d’alignement », « Vision 4D ».', en: 'Three tabs: “Plan stratégique sur une page”, “Liste de vérification d’alignement”, “Vision 4D”.' },
      { fr: 'Le plan peut être imprimé par tous (« Imprimer »).', en: 'Anyone can print the plan (“Imprimer”).' },
      { fr: 'Les dates des cibles, objectifs et thème du trimestre doivent être au format AAAA-MM-JJ ; sinon l’enregistrement est refusé.', en: 'Dates for targets, objectives and the quarter theme must be in YYYY-MM-DD format, otherwise saving is refused.' },
      { fr: 'La liste de vérification propose « Charger la liste Align (40 points) » seulement si elle est vide.', en: 'The checklist offers “Charger la liste Align (40 points)” only when it is empty.' },
      { fr: 'Les Rocks et initiatives affichés dans la Vision 4D sont en lecture seule.', en: 'Rocks and initiatives shown in the Vision 4D tab are read-only.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment modifier le plan ou la Vision 4D ?', en: 'How do I edit the plan or the 4D Vision?' },
        a: {
          fr: 'Ouvrez l’onglet, cliquez « Modifier », faites vos changements, puis « Enregistrer » (ou « Annuler »).',
          en: 'Open the tab, click “Modifier”, make your changes, then “Enregistrer” (or “Annuler”).',
        },
      },
      {
        q: { fr: 'Comment ajouter un point à la liste de vérification ?', en: 'How do I add a checklist item?' },
        a: {
          fr: 'Onglet « Liste de vérification d’alignement » > « Élément » > Catégorie, Élément, Note > enregistrer.',
          en: 'Tab “Liste de vérification d’alignement” > “Élément” > Catégorie, Élément, Note > save.',
        },
      },
    ],
    keywords: ['stratégie', 'strategy', 'plan', 'vision 4d', 'bhag', 'valeurs', 'liste de vérification', 'checklist', 'imprimer'],
  },
  {
    id: 'align.rocks',
    module: 'align',
    path: '/align/rocks',
    permission: 'align.access',
    title: { fr: 'Rocks', en: 'Rocks' },
    summary: {
      fr: 'Liste des Rocks (objectifs trimestriels de l’entreprise) avec leur progression, filtrables par « Mes Rocks » et par trimestre.',
      en: 'List of Rocks (quarterly company goals) with their progress, filterable by “Mes Rocks” and by quarter.',
    },
    tips: [
      { fr: 'La progression d’un Rock = priorités terminées ÷ priorités non archivées rattachées à ce Rock.', en: 'A Rock’s progress = finished priorities ÷ non-archived priorities linked to it.' },
      { fr: '« + Rock » exige la permission « Gérer les Rocks ».', en: '“+ Rock” requires “Manage Rocks”.' },
      { fr: 'La carte « Priorités non rattachées » liste les priorités sans Rock. « Rattacher à un Rock » exige « Gérer et assigner toutes les priorités ».', en: 'The “Priorités non rattachées” card lists priorities with no Rock. “Rattacher à un Rock” requires “Manage and assign all priorities”.' },
      { fr: '« Afficher les archivés » montre les Rocks archivés.', en: '“Afficher les archivés” shows archived Rocks.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment créer un Rock ?', en: 'How do I create a Rock?' },
        a: {
          fr: 'Cliquez « + Rock ». Saisissez « Titre » (obligatoire), « Description », « Responsable » (par défaut vous), « Trimestre », éventuellement « Priorité stratégique liée » et « Initiative clé liée », puis « Enregistrer ».',
          en: 'Click “+ Rock”. Enter “Titre” (required), “Description”, “Responsable” (defaults to you), “Trimestre”, optionally “Priorité stratégique liée” and “Initiative clé liée”, then “Enregistrer”.',
        },
      },
    ],
    keywords: ['rock', 'rocks', 'objectif', 'objectifs', 'goal', 'trimestre', 'progression', 'priorités'],
  },
  {
    id: 'align.rockDetail',
    module: 'align',
    path: '/align/rocks/:id',
    permission: 'align.access',
    title: { fr: 'Détail du Rock', en: 'Rock detail' },
    summary: {
      fr: 'Un Rock et la liste de ses priorités : modifier, archiver, supprimer le Rock, et ajouter ou suivre les priorités.',
      en: 'One Rock and its priorities: edit, archive or delete the Rock, and add or follow priorities.',
    },
    tips: [
      { fr: '« Modifier », « Archiver » / « Réactiver » et « Supprimer » exigent « Gérer les Rocks ». Archiver ne demande pas de confirmation.', en: '“Modifier”, “Archiver” / “Réactiver” and “Supprimer” require “Manage Rocks”. Archiving asks for no confirmation.' },
      { fr: 'Supprimer un Rock conserve ses priorités, qui ne sont plus rattachées à un Rock.', en: 'Deleting a Rock keeps its priorities, which are no longer attached to a Rock.' },
      { fr: 'Le responsable d’une priorité ne modifie que Statut, Santé, Avancement (%) et le blocage. Les gestionnaires modifient tous les champs ; les autres voient une lecture seule.', en: 'A priority’s owner only changes Statut, Santé, Avancement (%) and the blocker. Managers edit every field; others see read-only.' },
      { fr: '« Ajouter un suivi » est ouvert à tous.', en: '“Ajouter un suivi” is open to everyone.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ajouter une priorité à un Rock ?', en: 'How do I add a priority to a Rock?' },
        a: {
          fr: 'Cliquez « Priorité » (permission « Gérer et assigner toutes les priorités »). Saisissez « Titre », « Responsable », « Échéance », puis « Ajouter ».',
          en: 'Click “Priorité” (permission “Manage and assign all priorities”). Enter “Titre”, “Responsable”, “Échéance”, then “Ajouter”.',
        },
      },
    ],
    keywords: ['rock', 'détail', 'priorité', 'suivi', 'archiver', 'supprimer', 'avancement', 'santé'],
  },
  {
    id: 'align.huddles',
    module: 'align',
    path: '/align/huddles',
    permission: 'align.access',
    title: { fr: 'Huddles', en: 'Huddles' },
    summary: {
      fr: 'Liste des huddles (réunions d’équipe récurrentes) : ouvrir la réunion de la semaine ou modifier le cadre (fréquence, membres, lien vidéo).',
      en: 'List of huddles (recurring team meetings): open this week’s meeting or edit the setup (frequency, members, video link).',
    },
    tips: [
      { fr: 'Créer un huddle (« Huddle ») exige « Gérer les huddles ».', en: 'Creating a huddle (“Huddle”) requires “Manage huddles”.' },
      { fr: 'Les icônes Modifier et Supprimer apparaissent aux gestionnaires et au responsable du huddle.', en: 'The Modifier and Supprimer icons show to managers and the huddle owner.' },
      { fr: 'Le lien de visioconférence doit commencer par http:// ou https://.', en: 'The video link must start with http:// or https://.' },
      { fr: '« Afficher les inactifs » montre les huddles désactivés.', en: '“Afficher les inactifs” shows deactivated huddles.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment créer un huddle ?', en: 'How do I create a huddle?' },
        a: {
          fr: 'Cliquez « Huddle ». Saisissez « Nom », choisissez « Fréquence », « Jour », « Début », « Fin » et les « Membres », puis « Enregistrer ».',
          en: 'Click “Huddle”. Enter “Nom”, choose “Fréquence”, “Jour”, “Début”, “Fin” and the “Membres”, then “Enregistrer”.',
        },
      },
    ],
    keywords: ['huddle', 'huddles', 'réunion', 'meeting', 'équipe', 'fréquence', 'membres', 'align'],
  },
  {
    id: 'align.huddleMeeting',
    module: 'align',
    path: '/align/huddles/:id',
    permission: 'align.access',
    title: { fr: 'Réunion huddle', en: 'Huddle meeting' },
    summary: {
      fr: 'La réunion d’un huddle pour une semaine : ordre du jour, Rocks, plan d’action de la semaine et points de chaque membre.',
      en: 'A huddle meeting for one week: agenda, Rocks, the week’s action plan and each member’s points.',
    },
    tips: [
      { fr: 'L’ordre du jour est propre à chaque semaine. Sinon, le dernier ordre du jour est repris.', en: 'The agenda is kept per week. Otherwise the last agenda is carried over.' },
      { fr: 'Dans « Plan d’action de la semaine », « Reporter à cette semaine » reprend les actions non terminées des semaines passées.', en: 'In “Plan d’action de la semaine”, “Reporter à cette semaine” brings back unfinished actions from past weeks.' },
      { fr: '« Quoi de neuf ? » s’enregistre à « Enregistrer » et quand on quitte le champ.', en: '“Quoi de neuf ?” saves on “Enregistrer” and when the field loses focus.' },
      { fr: '« Paramètres » et « Modifier » de l’ordre du jour sont réservés aux gestionnaires et au responsable du huddle. « Visioconférence » ouvre le lien de la réunion.', en: '“Paramètres” and the agenda’s “Modifier” are reserved to managers and the huddle owner. “Visioconférence” opens the meeting link.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ajouter une action à la semaine ?', en: 'How do I add an action for the week?' },
        a: {
          fr: 'Dans « Plan d’action de la semaine », saisissez dans « Nouvelle action… », choisissez « Assigné à » et « Hebdo » ou « Rock », puis validez avec le bouton d’ajout.',
          en: 'In “Plan d’action de la semaine”, type in “Nouvelle action…”, choose “Assigné à” and “Hebdo” or “Rock”, then use the add button.',
        },
      },
    ],
    keywords: ['huddle', 'réunion', 'ordre du jour', 'plan d’action', 'visioconférence', 'semaine', 'meeting'],
  },
  {
    id: 'align.tasks',
    module: 'align',
    path: '/align/tasks',
    permission: 'align.access',
    title: { fr: 'Tâches hebdo', en: 'Weekly tasks' },
    summary: {
      fr: 'Les actions de la semaine de chaque personne (plan d’action), en vue « Mes tâches » ou « Toute l’équipe ».',
      en: 'Each person’s actions for the week, in “Mes tâches” or “Toute l’équipe” view.',
    },
    tips: [
      { fr: 'Filtres : « Toutes les actions », « Actions hebdo », « Actions Rock », « Masquer les terminées ».', en: 'Filters: “Toutes les actions”, “Actions hebdo”, “Actions Rock”, “Masquer les terminées”.' },
      { fr: 'Une action non terminée est signalée « 2 sem. » (orange) après 14 jours et « 3 sem. » (rouge) après 21 jours.', en: 'An open action is flagged “2 sem.” (orange) after 14 days and “3 sem.” (red) after 21 days.' },
      { fr: '« Modifier » et « Supprimer » sont réservés au propriétaire, à son créateur et aux gestionnaires des priorités. La suppression demande confirmation.', en: '“Modifier” and “Supprimer” are reserved to the owner, its creator and priority managers. Deletion asks for confirmation.' },
      { fr: '« Ajouter pour… » (pour une autre personne) n’apparaît qu’aux gestionnaires des priorités.', en: '“Ajouter pour…” (for another person) only appears to priority managers.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ajouter une action ?', en: 'How do I add an action?' },
        a: {
          fr: 'Saisissez dans « Nouvelle action… », choisissez « Assigné à » et « Hebdo » ou « Rock », puis validez avec le bouton d’ajout.',
          en: 'Type in “Nouvelle action…”, choose “Assigné à” and “Hebdo” or “Rock”, then use the add button.',
        },
      },
    ],
    keywords: ['tâches', 'taches', 'actions', 'semaine', 'weekly tasks', 'plan d’action', 'hebdo', 'rock'],
  },
  {
    id: 'align.team',
    module: 'align',
    path: '/align/team',
    permission: 'align.access',
    title: { fr: 'Équipe', en: 'Team' },
    summary: {
      fr: 'Une carte par membre avec son bilan (tâches, priorités, blocages, retards). Ouvrir une carte affiche la semaine de la personne.',
      en: 'One card per member with a summary (tasks, priorities, blockers, overdue items). Opening a card shows that person’s week.',
    },
    tips: [
      { fr: 'Recherchez avec « Rechercher un membre… ».', en: 'Search with “Rechercher un membre…”.' },
      { fr: 'Une coche sur la carte indique que « Quoi de neuf » est rempli pour la semaine.', en: 'A tick on the card means “Quoi de neuf” is filled in for the week.' },
      { fr: 'Dans la semaine d’un membre, Alt + flèche gauche ou droite passe à la personne précédente ou suivante.', en: 'In a member’s week, Alt + left or right arrow goes to the previous or next person.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment voir la semaine d’une personne ?', en: 'How do I see one person’s week?' },
        a: { fr: 'Cliquez sa carte dans la liste.', en: 'Click her or his card in the list.' },
      },
    ],
    keywords: ['équipe', 'team', 'membres', 'personnes', 'bilan', 'align'],
  },

  // ───────────────────────── Microsoft 365 (O365) ─────────────────────────
  {
    id: 'o365.tenants',
    module: 'o365',
    path: '/o365',
    permission: 'o365.tenants.view',
    title: { fr: 'Locataires', en: 'Tenants' },
    summary: {
      fr: 'Choisir le locataire Microsoft 365 à gérer et, selon vos droits, en ajouter ou en retirer. Sans droit de vue, cette page redirige vers Utilisateurs.',
      en: 'Choose the Microsoft 365 tenant to manage and, depending on your rights, add or remove tenants. Without view rights this page redirects to Utilisateurs.',
    },
    tips: [
      { fr: 'Le locataire choisi est mémorisé dans ce navigateur et s’applique à toutes les pages du module.', en: 'The chosen tenant is remembered in this browser and applies to every page of the module.' },
      { fr: '« Retirer » supprime seulement l’enregistrement dans Imago ; rien n’est supprimé dans Microsoft 365.', en: '“Retirer” only removes the record in Imago; nothing is deleted in Microsoft 365.' },
      { fr: '« Consentement administrateur » n’apparaît qu’en mode serveur.', en: '“Consentement administrateur” only appears in server mode.' },
      { fr: 'Sans locataire, la barre du haut affiche « Aucun locataire » avec un lien « Ajouter un locataire ».', en: 'With no tenant, the top bar shows “Aucun locataire” with an “Ajouter un locataire” link.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ajouter un locataire ?', en: 'How do I add a tenant?' },
        a: {
          fr: 'Cliquez « Locataire ». Saisissez « Nom », « ID du locataire ou domaine .onmicrosoft.com » et « Notes », puis « Enregistrer ».',
          en: 'Click “Locataire”. Enter “Nom”, “ID du locataire ou domaine .onmicrosoft.com” and “Notes”, then “Enregistrer”.',
        },
      },
    ],
    keywords: ['o365', 'microsoft 365', 'm365', 'locataire', 'tenant', 'consentement', 'office 365'],
  },
  {
    id: 'o365.users',
    module: 'o365',
    path: '/o365/users',
    permission: 'o365.access',
    title: { fr: 'Utilisateurs Microsoft 365', en: 'Microsoft 365 users' },
    summary: {
      fr: 'Comptes Microsoft 365 du locataire choisi : créer, modifier les licences, réinitialiser le mot de passe, bloquer ou débloquer, supprimer. La lecture exige l’accès au module ; les actions exigent « Gérer les utilisateurs et leurs licences ».',
      en: 'Microsoft 365 accounts of the selected tenant: create, change licences, reset passwords, block or unblock, delete. Reading needs module access; actions need “Manage users and their licenses”.',
    },
    tips: [
      { fr: 'Le filtre par défaut est « Actifs avec licence ». Choisissez « Utilisateurs actifs », « Tous », « Bloqués » ou « Sans licence » au besoin.', en: 'The default filter is “Actifs avec licence”. Choose “Utilisateurs actifs”, “Tous”, “Bloqués” or “Sans licence” as needed.' },
      { fr: 'Le mot de passe temporaire s’affiche en clair dans la notification de succès : notez-le.', en: 'The temporary password is shown in clear in the success notice: write it down.' },
      { fr: '« Supprimer » demande confirmation ; le compte reste récupérable pendant 30 jours dans Microsoft 365.', en: '“Supprimer” asks for confirmation; the account stays recoverable for 30 days in Microsoft 365.' },
      { fr: '« Bloquer la connexion » et « Autoriser la connexion » agissent sans confirmation.', en: '“Bloquer la connexion” and “Autoriser la connexion” act without confirmation.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment créer un utilisateur avec une licence ?', en: 'How do I create a user with a licence?' },
        a: {
          fr: 'Cliquez « Nouvel utilisateur ». Saisissez Prénom, Nom et Nom d’utilisateur (alias et domaine). Saisissez ou cliquez « Générer » pour le mot de passe temporaire (8 caractères minimum). Cochez les licences, puis « Enregistrer ».',
          en: 'Click “Nouvel utilisateur”. Enter Prénom, Nom and the username (alias and domain). Type or click “Générer” for the temporary password (8 characters minimum). Tick the licences, then “Enregistrer”.',
        },
      },
      {
        q: { fr: 'Comment réinitialiser un mot de passe ?', en: 'How do I reset a password?' },
        a: {
          fr: 'Cliquez l’icône « Réinitialiser le mot de passe » de la ligne, puis « Réinitialiser ». « Exiger un changement à la prochaine connexion » est coché par défaut.',
          en: 'Click the “Réinitialiser le mot de passe” icon on the row, then “Réinitialiser”. “Exiger un changement à la prochaine connexion” is ticked by default.',
        },
      },
    ],
    keywords: ['o365', 'microsoft 365', 'utilisateurs', 'comptes', 'licence', 'mot de passe', 'bloquer', 'supprimer', 'users'],
  },
  {
    id: 'o365.contacts',
    module: 'o365',
    path: '/o365/contacts',
    permission: 'o365.access',
    title: { fr: 'Contacts', en: 'Contacts' },
    summary: {
      fr: 'Carnet d’adresses Microsoft 365 : contacts externes, utilisables ensuite dans les groupes de distribution. Ajouter ou modifier exige « Ajouter / modifier / supprimer des contacts ».',
      en: 'Microsoft 365 address book: external contacts, usable later in distribution groups. Adding or editing requires “Add / edit / delete contacts”.',
    },
    tips: [
      { fr: 'Le nom affiché se compose du prénom et du nom ; à défaut, du courriel.', en: 'The display name is first + last name; otherwise the e-mail.' },
      { fr: 'Supprimer un contact le retire aussi des groupes de distribution (après confirmation).', en: 'Deleting a contact also removes it from distribution groups (after confirmation).' },
      { fr: 'La recherche « Rechercher… » filtre la liste.', en: 'The “Rechercher…” box filters the list.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ajouter un contact ?', en: 'How do I add a contact?' },
        a: {
          fr: 'Cliquez « Contact ». Saisissez Prénom, Nom, « Courriel externe » et « Entreprise », puis « Ajouter ».',
          en: 'Click “Contact”. Enter Prénom, Nom, “Courriel externe” and “Entreprise”, then “Ajouter”.',
        },
      },
    ],
    keywords: ['contacts', 'carnet d’adresses', 'courriel externe', 'o365', 'microsoft 365', 'address book'],
  },
  {
    id: 'o365.groups',
    module: 'o365',
    path: '/o365/groups',
    permission: 'o365.access',
    title: { fr: 'Groupes de distribution', en: 'Distribution groups' },
    summary: {
      fr: 'Voir les membres des groupes de distribution et, avec la permission appropriée, y ajouter ou en retirer des utilisateurs, des contacts ou des groupes.',
      en: 'See the members of distribution groups and, with the right permission, add or remove users, contacts or groups.',
    },
    tips: [
      { fr: 'Ajouter ou retirer un membre exige « Gérer les membres des groupes de distribution ».', en: 'Adding or removing a member requires “Manage distribution group members”.' },
      { fr: 'Les suggestions viennent des utilisateurs et des contacts.', en: 'Suggestions come from users and contacts.' },
      { fr: 'Retirer un membre demande confirmation.', en: 'Removing a member asks for confirmation.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ajouter un membre à un groupe ?', en: 'How do I add a member to a group?' },
        a: {
          fr: 'Choisissez le groupe dans la liste de gauche, saisissez le courriel dans « Courriel d’un utilisateur ou d’un contact », puis « Ajouter ».',
          en: 'Pick the group on the left, type the address in “Courriel d’un utilisateur ou d’un contact”, then “Ajouter”.',
        },
      },
    ],
    keywords: ['groupes', 'distribution', 'courriel', 'membres', 'distribution group', 'o365', 'microsoft 365'],
  },
  {
    id: 'o365.licenses',
    module: 'o365',
    path: '/o365/licenses',
    permission: 'o365.access',
    title: { fr: 'Licences', en: 'Licenses' },
    summary: {
      fr: 'Licences payantes du locataire : places attribuées, libres, en période de grâce ou suspendues, et leurs titulaires. Attribuer ou retirer une licence exige « Gérer les utilisateurs et leurs licences ».',
      en: 'Paid licences of the tenant: assigned, free, grace-period and suspended seats, and their holders. Assigning or removing a licence requires “Manage users and their licenses”.',
    },
    tips: [
      { fr: '« Attribuer » est désactivé quand il ne reste plus de place libre.', en: '“Attribuer” is disabled when no seat is free.' },
      { fr: 'Une personne doit avoir un pays d’utilisation pour recevoir une licence.', en: 'A person needs a usage location to receive a licence.' },
      { fr: 'Retirer une licence à une personne demande confirmation.', en: 'Removing a licence from a person asks for confirmation.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment attribuer une licence ?', en: 'How do I assign a licence?' },
        a: {
          fr: 'Cliquez la licence, choisissez la personne dans « Attribuer à un utilisateur… », puis « Attribuer ».',
          en: 'Click the licence, pick the person in “Attribuer à un utilisateur…”, then “Attribuer”.',
        },
      },
    ],
    keywords: ['licences', 'licence', 'sku', 'places', 'attribuer', 'o365', 'microsoft 365', 'seats'],
  },

  // ───────────────────────── RH and Conformité ─────────────────────────
  {
    id: 'rh.home',
    module: 'rh',
    path: '/rh',
    permission: 'rh.access',
    title: { fr: 'Ressources humaines', en: 'Human resources' },
    summary: {
      fr: 'Point d’entrée du module RH. Il ouvre directement la section Conformité si vous y avez accès ; sinon il indique qu’aucune section n’est disponible.',
      en: 'Entry point of the HR module. It opens the Conformité section directly if you have access; otherwise it says no section is available.',
    },
    tips: [
      { fr: 'Par défaut, le menu place RH dans « Outils administratifs », avec Align et O365.', en: 'By default the menu places HR under “Outils administratifs”, with Align and O365.' },
      { fr: 'Sans accès à une section, demandez-le à un administrateur.', en: 'Without access to a section, ask an administrator.' },
    ],
    howTo: [
      {
        q: { fr: 'Où est la conformité ?', en: 'Where is compliance?' },
        a: { fr: 'Dans le menu, ouvrez RH puis « Conformité » (visible si vous avez la permission « Conformité : accéder »).', en: 'In the menu, open RH then “Conformité” (visible if you hold “Compliance: access”).' },
      },
    ],
    keywords: ['rh', 'ressources humaines', 'hr', 'human resources', 'conformité', 'compliance'],
  },
  {
    id: 'compliance.overview',
    module: 'rh',
    path: '/rh/conformite',
    permission: 'compliance.access',
    title: { fr: 'Conformité Pubco', en: 'Pubco compliance' },
    summary: {
      fr: 'Tableau de bord de la conformité : score global, non-conformités ouvertes, risques élevés, échéances des 30 prochains jours et liste des certifications et normes suivies.',
      en: 'Compliance dashboard: overall score, open non-conformities, high risks, deadlines in the next 30 days, and the list of certifications and standards tracked.',
    },
    tips: [
      { fr: 'Score global = part des exigences actives. Les exigences « N/A » sont exclues. Implémentée compte pour 0,75, Vérifiée pour 1, En cours pour 0,3, À faire pour 0.', en: 'Overall score = share of active requirements. “N/A” requirements are excluded. Mise en place counts 0.75, Vérifiée 1, En cours 0.3, À faire 0.' },
      { fr: '« Échéances à venir (45 jours) » regroupe les revues d’exigences, les audits planifiés, les révisions de documents et les échéances de non-conformités.', en: '“Échéances à venir (45 jours)” groups requirement reviews, planned audits, document reviews and non-conformity due dates.' },
      { fr: 'Les dates dépassées s’affichent en rouge.', en: 'Overdue dates are shown in red.' },
      { fr: 'Le bouton « Certification / norme » exige « Créer / modifier les certifications et normes ».', en: 'The “Certification / norme” button requires “Create / edit certifications & standards”.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ajouter une certification ou une norme ?', en: 'How do I add a certification or standard?' },
        a: { fr: 'Cliquez « Certification / norme » ; le formulaire est vide. Saisissez Code et Nom, puis « Enregistrer ».', en: 'Click “Certification / norme”; the form is blank. Enter Code and Nom, then “Enregistrer”.' },
      },
    ],
    keywords: ['conformité', 'compliance', 'score', 'iso', 'échéances', 'risques', 'non-conformité', 'tableau de bord'],
  },
  {
    id: 'compliance.frameworks',
    module: 'rh',
    path: '/rh/conformite/frameworks',
    permission: 'compliance.access',
    title: { fr: 'Certifications et normes', en: 'Certifications & standards' },
    summary: {
      fr: 'Liste des certifications et normes suivies, avec leur statut et leur score. Ajoutez-en une vide ou à partir d’un modèle.',
      en: 'List of certifications and standards tracked, with status and score. Add an empty one or one from a template.',
    },
    tips: [
      { fr: 'Statuts : Inactif, Certifié, En démarche.', en: 'Statuses: Inactif, Certifié, En démarche.' },
      { fr: '« Depuis un modèle » crée la norme avec ses exigences, toutes « À faire » et modifiables. Les modèles sont des points de départ pour une entreprise québécoise, à valider auprès de l’organisme ou d’un conseiller juridique.', en: '“Depuis un modèle” creates the standard with its requirements, all “À faire” and editable. Templates are starting points for a Quebec business, to be confirmed with the regulator or a legal advisor.' },
      { fr: 'Un modèle déjà ajouté est désactivé (« déjà ajouté »).', en: 'A template already added is disabled (“déjà ajouté”).' },
      { fr: 'Cliquer une ligne ouvre la certification ou la norme.', en: 'Clicking a row opens the certification or standard.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ajouter une norme à partir d’un modèle ?', en: 'How do I add a standard from a template?' },
        a: { fr: 'Cliquez « Depuis un modèle », choisissez le « Modèle », puis « Ajouter ».', en: 'Click “Depuis un modèle”, choose the “Modèle”, then “Ajouter”.' },
      },
      {
        q: { fr: 'Comment ajouter une norme vide ?', en: 'How do I add an empty standard?' },
        a: { fr: 'Cliquez « Certification / norme ». Saisissez Code et Nom (obligatoires), puis « Enregistrer ».', en: 'Click “Certification / norme”. Enter Code and Nom (required), then “Enregistrer”.' },
      },
    ],
    keywords: ['certification', 'certifications', 'norme', 'normes', 'iso', 'modèle', 'template', 'standard', 'conformité'],
  },
  {
    id: 'compliance.frameworkDetail',
    module: 'rh',
    path: '/rh/conformite/frameworks/:id',
    permission: 'compliance.access',
    title: { fr: 'Certification ou norme', en: 'Certification or standard' },
    summary: {
      fr: 'Les exigences d’une certification ou norme : statut, risque, responsable, prochaine revue et preuves de chacune.',
      en: 'The requirements of one certification or standard: status, risk, owner, next review and evidence for each.',
    },
    tips: [
      { fr: 'Le statut se change dans le menu de la ligne (exige « Gérer les exigences et preuves »).', en: 'The status can be changed from the row’s dropdown (requires “Manage requirements & evidence”).' },
      { fr: 'Statuts : À faire, En cours, Mise en place, Vérifiée, Non applicable. Risques : Faible, Moyen, Élevé.', en: 'Statuses: À faire, En cours, Mise en place, Vérifiée, Non applicable. Risks: Faible, Moyen, Élevé.' },
      { fr: '« Supprimer » d’une exigence ne demande pas de confirmation.', en: 'Deleting a requirement asks for no confirmation.' },
      { fr: 'Supprimer la certification ou norme supprime aussi toutes ses exigences. La fenêtre suggère plutôt de décocher « Actif » pour l’archiver.', en: 'Deleting the certification or standard also deletes all its requirements. The dialog suggests unticking “Actif” to archive it instead.' },
      { fr: 'Les panneaux Avancement, Audits et Documents résument la progression.', en: 'The Avancement, Audits and Documents panels summarise progress.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment mettre à jour une exigence ?', en: 'How do I update a requirement?' },
        a: { fr: 'Changez le statut dans la colonne Statut de la ligne. Pour le reste, cliquez la ligne, modifiez, puis « Enregistrer ».', en: 'Change the status in the row’s Statut column. For other fields, click the row, edit, then “Enregistrer”.' },
      },
      {
        q: { fr: 'Comment ajouter une preuve ?', en: 'How do I add evidence?' },
        a: { fr: 'Ouvrez l’exigence, saisissez dans le champ « Preuves », cliquez « Ajouter », puis « Enregistrer ».', en: 'Open the requirement, type in the “Preuves” field, click “Ajouter”, then “Enregistrer”.' },
      },
    ],
    keywords: ['exigence', 'exigences', 'preuve', 'preuves', 'statut', 'risque', 'revue', 'requirement', 'evidence'],
  },
  {
    id: 'compliance.audits',
    module: 'rh',
    path: '/rh/conformite/audits',
    permission: 'compliance.access',
    title: { fr: 'Audits et non-conformités', en: 'Audits & non-conformities' },
    summary: {
      fr: 'Audits internes, externes et de certification, avec leurs constats, et la liste des non-conformités ouvertes.',
      en: 'Internal, external and certification audits, with their findings, and the list of open non-conformities.',
    },
    tips: [
      { fr: 'Un constat est « NC majeure », « NC mineure » ou « Observation ». Il peut être lié à une exigence.', en: 'A finding is “NC majeure”, “NC mineure” or “Observation”. It can be linked to a requirement.' },
      { fr: 'Cocher le rond d’une non-conformité la ferme (exige « Gérer les audits et non-conformités »).', en: 'Ticking a non-conformity’s circle closes it (requires “Manage audits & non-conformities”).' },
      { fr: 'L’icône corbeille de l’éditeur supprime l’audit immédiatement, sans confirmation.', en: 'The trash icon in the editor deletes the audit immediately, without confirmation.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment créer un audit ?', en: 'How do I create an audit?' },
        a: { fr: 'Cliquez « Audit ». Saisissez Titre, Certification / norme, Type (Interne, Externe, Certification), Date, Statut (Planifié, Réalisé), Auditeur, puis « Enregistrer ».', en: 'Click “Audit”. Enter Titre, Certification / norme, Type (Interne, Externe, Certification), Date, Statut (Planifie, Réalisé), Auditeur, then “Enregistrer”.' },
      },
      {
        q: { fr: 'Comment ajouter un constat ?', en: 'How do I add a finding?' },
        a: { fr: 'Ouvrez l’audit, cliquez « Constat », saisissez la description, la gravité, le responsable et l’échéance, puis « Enregistrer ».', en: 'Open the audit, click “Constat”, enter the description, severity, owner and due date, then “Enregistrer”.' },
      },
    ],
    keywords: ['audit', 'audits', 'non-conformité', 'non-conformités', 'nc', 'constat', 'finding', 'interne', 'externe'],
  },
  {
    id: 'compliance.documents',
    module: 'rh',
    path: '/rh/conformite/documents',
    permission: 'compliance.access',
    title: { fr: 'Politiques et procédures', en: 'Policies & procedures' },
    summary: {
      fr: 'Registre des politiques et procédures : version, statut, responsable, dates d’approbation et de révision, et lien vers le document.',
      en: 'Register of policies and procedures: version, status, owner, approval and review dates, and a link to the document.',
    },
    tips: [
      { fr: 'Statuts : Brouillon, Approuvé, Obsolète.', en: 'Statuses: Brouillon, Approuvé, Obsolète.' },
      { fr: 'Seuls les liens commençant par http:// ou https:// deviennent cliquables.', en: 'Only links starting with http:// or https:// become clickable.' },
      { fr: 'Dans l’éditeur, des pastilles lient le document aux certifications et normes.', en: 'In the editor, chips link the document to certifications and standards.' },
      { fr: 'L’icône corbeille supprime le document immédiatement, sans confirmation.', en: 'The trash icon deletes the document immediately, without confirmation.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ajouter un document ?', en: 'How do I add a document?' },
        a: { fr: 'Cliquez « Document ». Saisissez Titre, Version, Statut, Responsable et Lien (SharePoint, Drive...), puis « Enregistrer ».', en: 'Click “Document”. Enter Titre, Version, Statut, Responsable and Lien (SharePoint, Drive...), then “Enregistrer”.' },
      },
    ],
    keywords: ['politique', 'politiques', 'procédure', 'procédures', 'document', 'version', 'révision', 'policy', 'procedure'],
  },

  // ───────────────────────── KPI tool ─────────────────────────
  {
    id: 'tools.home',
    module: 'tools',
    path: '/tools',
    permission: 'tools.kpi.access',
    title: { fr: 'Outil KPI', en: 'KPI tool' },
    summary: {
      fr: 'Accueil de l’outil KPI : il affiche le même tableau de bord que « Tableau de bord » du menu KPI.',
      en: 'KPI tool home: it shows the same dashboard as the KPI menu’s “Tableau de bord”.',
    },
    tips: [
      { fr: 'La section du menu s’appelle « Archive temporaire » par défaut.', en: 'The menu section is called “Archive temporaire” by default.' },
      { fr: 'Le bouton « Visite guidée » des pages KPI lance une visite pas à pas.', en: 'The “Visite guidée” button on KPI pages starts a step-by-step tour.' },
    ],
    howTo: [
      {
        q: { fr: 'Où se trouve l’outil KPI ?', en: 'Where is the KPI tool?' },
        a: { fr: 'Dans le menu latéral, section « Archive temporaire » (par défaut), puis KPI.', en: 'In the sidebar, under “Archive temporaire” (by default), then KPI.' },
      },
    ],
    keywords: ['kpi', 'outil kpi', 'tools', 'indicateurs', 'accueil', 'archive'],
  },
  {
    id: 'tools.dashboard',
    module: 'tools',
    path: '/tools/kpi',
    permission: 'tools.kpi.access',
    title: { fr: 'Tableau de bord KPI', en: 'KPI dashboard' },
    summary: {
      fr: 'Vue de la semaine : nombres critiques, saisies en retard, mes priorités, mes actions et prochain huddle.',
      en: 'Weekly view: critical numbers, overdue entries, my priorities, my actions and next huddle.',
    },
    tips: [
      { fr: '« Saisies en retard » liste les indicateurs sans valeur pour la dernière période. « Saisir » ouvre l’indicateur.', en: '“Saisies en retard” lists indicators with no value for the latest period. “Saisir” opens the indicator.' },
      { fr: 'Couleurs des nombres critiques : « Atteint » (vert), « Proche de la cible » (jaune), « Loin de la cible » (rouge), « Pas de cible ».', en: 'Critical number colours: “Atteint” (green), “Proche de la cible” (yellow), “Loin de la cible” (red), “Pas de cible”.' },
      { fr: '« Marquer comme fait », dans « Mes actions », est le seul bouton de cette page qui modifie une donnée.', en: '“Marquer comme fait”, in “Mes actions”, is the only button on this page that changes data.' },
      { fr: 'Le bouton « Visite guidée » explique l’outil pas à pas.', en: 'The “Visite guidée” button explains the tool step by step.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment marquer une action comme faite ?', en: 'How do I mark an action as done?' },
        a: { fr: 'Dans « Mes actions », cliquez « Marquer comme fait » sur la tâche.', en: 'In “Mes actions”, click “Marquer comme fait” on the task.' },
      },
    ],
    keywords: ['kpi', 'tableau de bord', 'dashboard', 'critique', 'saisie en retard', 'priorités', 'actions', 'huddle'],
  },
  {
    id: 'tools.indicators',
    module: 'tools',
    path: '/tools/kpi/indicators',
    permission: 'tools.kpi.access',
    title: { fr: 'Indicateurs', en: 'Indicators' },
    summary: {
      fr: 'Liste des indicateurs en deux tableaux : hebdomadaire (8 semaines) et mensuel (6 mois). La valeur de chaque période se saisit directement dans la cellule.',
      en: 'Indicators in two tables: weekly (8 weeks) and monthly (6 months). Each period’s value is entered directly in its cell.',
    },
    tips: [
      { fr: 'Couleur : vert si la cible est atteinte ; jaune si l’écart est d’au plus 10 % de la cible ; rouge au-delà. Sans valeur ou sans cible, aucune couleur.', en: 'Colour: green when the target is met; yellow when the gap is at most 10% of the target; red beyond. No value or no target, no colour.' },
      { fr: 'Le sens se règle par « Plus haut est mieux » ou « Plus bas est mieux ».', en: 'Direction is set by “Plus haut est mieux” or “Plus bas est mieux”.' },
      { fr: 'Filtres : « Recherche », « Statut » (Actifs + brouillons, Archives, Tous), « Équipe », « Responsable ».', en: 'Filters: “Recherche”, “Statut” (Actifs + brouillons, Archives, Tous), “Équipe”, “Responsable”.' },
      { fr: 'Supprimer un indicateur efface aussi toutes ses valeurs. C’est irréversible et une confirmation est demandée.', en: 'Deleting an indicator also deletes all its values. It is irreversible and asks for confirmation.' },
      { fr: 'Un indicateur critique est mis en avant sur le tableau de bord ; plus de 5 génèrent un avertissement sans bloquer.', en: 'A critical indicator is highlighted on the dashboard; more than 5 shows a warning without blocking.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment saisir une valeur ?', en: 'How do I enter a value?' },
        a: { fr: 'Cliquez la cellule de la période. Saisissez « Valeur » (et « Note » si besoin), puis « Enregistrer ». La touche Entrée enregistre aussi. Une valeur vide signifie « non applicable ».', en: 'Click the period’s cell. Enter “Valeur” (and “Note” if needed), then “Enregistrer”. Enter also saves. An empty value means not applicable.' },
      },
      {
        q: { fr: 'Comment créer un indicateur ?', en: 'How do I create an indicator?' },
        a: { fr: 'Cliquez « Indicateur ». Saisissez « Nom » (obligatoire), « Cible », « Fréquence », « Sens », puis « Enregistrer ».', en: 'Click “Indicateur”. Enter “Nom” (required), “Cible”, “Fréquence”, “Sens”, then “Enregistrer”.' },
      },
    ],
    keywords: ['indicateur', 'indicateurs', 'kpi', 'cible', 'valeur', 'saisie', 'hebdomadaire', 'mensuel', 'target'],
  },
  {
    id: 'tools.priorities',
    module: 'tools',
    path: '/tools/kpi/priorities',
    permission: 'tools.kpi.access',
    title: { fr: 'Priorités', en: 'Priorities' },
    summary: {
      fr: 'Priorités trimestrielles de l’entreprise et des équipes, avec leur progression, leurs sous-priorités et leurs tâches. La mise à jour hebdomadaire se fait en une seule fenêtre.',
      en: 'Quarterly company and team priorities, with progress, sub-priorities and tasks. The weekly update is done in one window.',
    },
    tips: [
      { fr: '« Mise à jour de la semaine » enregistre progression, statut et note des priorités modifiées. « Toutes » affiche aussi celles des autres.', en: '“Mise à jour de la semaine” saves progress, status and note for changed priorities. “Toutes” also shows the others’ priorities.' },
      { fr: 'Filtres par statut Vert, Jaune ou Rouge ; « Afficher les archivées » montre les archives.', en: 'Filters by status Vert, Jaune or Rouge; “Afficher les archivées” shows archives.' },
      { fr: 'Supprimer une priorité efface ses sous-priorités, ses tâches et son historique hebdomadaire. C’est irréversible et une confirmation est demandée.', en: 'Deleting a priority erases its sub-priorities, tasks and weekly history. It is irreversible and asks for confirmation.' },
      { fr: 'Une priorité qui a des sous-priorités ne peut pas être rattachée à une autre.', en: 'A priority that has sub-priorities cannot itself be attached to another.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ajouter une priorité ?', en: 'How do I add a priority?' },
        a: { fr: 'Cliquez « Priorité ». Saisissez « Titre », « Responsable », « Statut », « Progression (%) », puis « Enregistrer ».', en: 'Click “Priorité”. Enter “Titre”, “Responsable”, “Statut”, “Progression (%)”, then “Enregistrer”.' },
      },
      {
        q: { fr: 'Comment faire la mise à jour de la semaine ?', en: 'How do I do the weekly update?' },
        a: { fr: 'Cliquez « Mise à jour de la semaine ». Changez « Progression (%) », « Statut » ou « Note de la semaine », puis « Enregistrer ». Le bouton reste désactivé tant que rien n’a changé.', en: 'Click “Mise à jour de la semaine”. Change “Progression (%)”, “Statut” or “Note de la semaine”, then “Enregistrer”. The button stays disabled until something changes.' },
      },
    ],
    keywords: ['priorités', 'priorites', 'priorities', 'progression', 'trimestre', 'mise à jour', 'sous-priorité', 'kpi'],
  },
  {
    id: 'tools.huddles',
    module: 'tools',
    path: '/tools/kpi/huddles',
    permission: 'tools.kpi.access',
    title: { fr: 'Huddles KPI', en: 'KPI huddles' },
    summary: {
      fr: 'Liste des huddles de l’outil KPI, avec l’ouverture de la réunion et les paramètres (membres, fréquence, ordre du jour, lien vidéo).',
      en: 'KPI tool huddles, with opening the meeting and their settings (members, frequency, agenda, video link).',
    },
    tips: [
      { fr: '« Afficher les inactifs » montre les huddles désactivés.', en: '“Afficher les inactifs” shows deactivated huddles.' },
      { fr: 'La fin d’un huddle doit être postérieure à son début.', en: 'A huddle’s end must be after its start.' },
      { fr: 'Le lien vidéo doit commencer par http:// ou https://.', en: 'The video link must start with http:// or https://.' },
      { fr: 'Supprimer un huddle efface son ordre du jour, ses points, ses présences et ses tâches liées. C’est irréversible et une confirmation est demandée.', en: 'Deleting a huddle erases its agenda, items, check-ins and linked tasks. It is irreversible and asks for confirmation.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment créer un huddle ?', en: 'How do I create a huddle?' },
        a: { fr: 'Cliquez « Huddle ». Saisissez « Nom », « Équipe », « Fréquence », « Jour », « Début », « Fin » et les « Membres », puis « Enregistrer ».', en: 'Click “Huddle”. Enter “Nom”, “Équipe”, “Fréquence”, “Jour”, “Début”, “Fin” and the “Membres”, then “Enregistrer”.' },
      },
      {
        q: { fr: 'Comment ouvrir la réunion ?', en: 'How do I open the meeting?' },
        a: { fr: 'Cliquez « Ouvrir la réunion » sur la carte du huddle.', en: 'Click “Ouvrir la réunion” on the huddle’s card.' },
      },
    ],
    keywords: ['huddle', 'huddles', 'réunion', 'meeting', 'membres', 'fréquence', 'lien vidéo', 'kpi'],
  },
  {
    id: 'tools.huddleMeeting',
    module: 'tools',
    path: '/tools/kpi/huddles/:id',
    permission: 'tools.kpi.access',
    title: { fr: 'Réunion huddle KPI', en: 'KPI huddle meeting' },
    summary: {
      fr: 'Déroulement de la réunion d’un huddle pour une semaine : ordre du jour, nombres critiques, performance, priorités, tâches « Qui - Quoi - Quand » et tour de table.',
      en: 'Running a huddle meeting for one week: agenda, critical numbers, performance, priorities, “Qui - Quoi - Quand” tasks and the round table.',
    },
    tips: [
      { fr: 'Changez de semaine avec « Semaine précédente », « Cette semaine » et « Semaine suivante ».', en: 'Change week with “Semaine précédente”, “Cette semaine” and “Semaine suivante”.' },
      { fr: '« Tout développer » et « Tout réduire » ouvrent ou ferment les sections. « Moi d’abord » place votre carte en premier.', en: '“Tout développer” and “Tout réduire” open or close sections. “Moi d’abord” puts your card first.' },
      { fr: '« Copier le résumé » copie le compte rendu de la réunion.', en: '“Copier le résumé” copies the meeting summary.' },
      { fr: '« Rejoindre la réunion » apparaît si un lien vidéo est défini dans le huddle.', en: '“Rejoindre la réunion” appears if the huddle has a video link.' },
      { fr: 'Une carte personnelle ne se modifie que par son membre ou par le responsable du huddle.', en: 'A personal card can only be edited by its member or by the huddle owner.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ajouter une tâche « Qui - Quoi - Quand » ?', en: 'How do I add a “Qui - Quoi - Quand” task?' },
        a: { fr: 'Dans la section « Qui - Quoi - Quand », saisissez « Quoi ? », « Qui » et « Quand », puis « Ajouter ». Cochez « Fait » quand c’est terminé.', en: 'In “Qui - Quoi - Quand”, enter “Quoi ?”, “Qui” and “Quand”, then “Ajouter”. Tick “Fait” when done.' },
      },
    ],
    keywords: ['huddle', 'réunion', 'tour de table', 'tâches', 'qui quoi quand', 'ordre du jour', 'semaine', 'kpi'],
  },
  {
    id: 'tools.teams',
    module: 'tools',
    path: '/tools/kpi/teams',
    permission: 'tools.kpi.access',
    title: { fr: 'Équipes', en: 'Teams' },
    summary: {
      fr: 'Équipes de l’outil KPI : nom, responsable, couleur, membres et archivage. Chaque carte indique le nombre d’indicateurs, de priorités et de huddles.',
      en: 'KPI teams: name, owner, colour, members and archiving. Each card shows the number of indicators, priorities and huddles.',
    },
    tips: [
      { fr: '« Afficher les archivées » montre les équipes archivées.', en: '“Afficher les archivées” shows archived teams.' },
      { fr: 'Cliquez une carte pour la modifier.', en: 'Click a card to edit it.' },
      { fr: 'Supprimer une équipe demande confirmation.', en: 'Deleting a team asks for confirmation.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment créer une équipe ?', en: 'How do I create a team?' },
        a: { fr: 'Cliquez « Équipe ». Saisissez « Nom », « Responsable », choisissez « Couleur » et les « Membres », puis « Enregistrer ».', en: 'Click “Équipe”. Enter “Nom”, “Responsable”, pick “Couleur” and the “Membres”, then “Enregistrer”.' },
      },
    ],
    keywords: ['équipe', 'équipes', 'team', 'teams', 'membres', 'responsable', 'kpi'],
  },

  // ───────────────────────── Function Fox (project management) ─────────────────────────
  {
    id: 'pm.dashboard',
    module: 'tools.pm',
    path: '/tools/pm',
    permission: 'tools.pm.access',
    title: { fr: 'Tableau de bord Function Fox', en: 'Function Fox dashboard' },
    summary: {
      fr: 'Vue d’ensemble de la gestion de projet : mes heures et tâches de la semaine, temps à approuver, projets à surveiller et temps rejeté à corriger.',
      en: 'Project management overview: my hours and tasks this week, time to approve, projects to watch and rejected time to fix.',
    },
    tips: [
      { fr: 'Tuiles : « Mes heures cette semaine », « Mes tâches ouvertes », « Mes tâches en retard », « Temps à approuver » (approbateurs seulement), « Projets actifs ».', en: 'Tiles: “Mes heures cette semaine”, “Mes tâches ouvertes”, “Mes tâches en retard”, “Temps à approuver” (approvers only), “Projets actifs”.' },
      { fr: '« Projets nécessitant attention » montre tous les projets aux gestionnaires, et seulement les vôtres aux autres.', en: '“Projets nécessitant attention” shows all projects to managers, only your own to others.' },
      { fr: 'Les boutons d’en-tête mènent à « Projets », « Tâches » et « Feuille de temps ».', en: 'Header buttons lead to “Projets”, “Tâches” and “Feuille de temps”.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment corriger un temps rejeté ?', en: 'How do I fix rejected time?' },
        a: { fr: 'Cliquez « Corriger » sur la carte « Rejets à corriger ». Dans la feuille de temps, corrigez la ligne, puis « Soumettre la semaine ».', en: 'Click “Corriger” on the “Rejets à corriger” card. In the timesheet, fix the line, then “Soumettre la semaine”.' },
      },
    ],
    keywords: ['function fox', 'gestion de projet', 'projets', 'dashboard', 'tableau de bord', 'heures', 'rejets', 'pm'],
  },
  {
    id: 'pm.projects',
    module: 'tools.pm',
    path: '/tools/pm/projects',
    permission: 'tools.pm.access',
    title: { fr: 'Projets', en: 'Projects' },
    summary: {
      fr: 'Liste des projets avec leurs heures, leur montant facturable et leur statut. Créer, modifier, archiver ou supprimer exige la permission de gestion.',
      en: 'List of projects with hours, billable amount and status. Creating, editing, archiving or deleting requires the management permission.',
    },
    tips: [
      { fr: 'Le filtre par défaut est « Actifs (planif., actifs, en pause) ». La liste montre tous les projets à tous les utilisateurs du module.', en: 'The default filter is “Actifs (planif., actifs, en pause)”. The list shows all projects to every module user.' },
      { fr: 'Les barres Heures et Montant passent en « Alerte » au seuil d’alerte (80 % par défaut) et en « Dépassé » à 100 %.', en: 'The Heures and Montant bars switch to “Alerte” at the alert threshold (80% by default) and to “Dépassé” at 100%.' },
      { fr: 'Archiver met le projet en « Archivé ». Désarchiver le remet toujours en « Actif ».', en: 'Archiving sets the project to “Archivé”. Unarchiving always sets it back to “Actif”.' },
      { fr: 'Supprimer est refusé si le projet a des tâches, du temps ou des dépenses : archivez-le à la place.', en: 'Deleting is refused if the project has tasks, time or expenses: archive it instead.' },
      { fr: 'Le montant est celui des honoraires facturables (heures facturables × tarif de la tâche, plus les dépenses facturables avec marge).', en: 'The amount is billable fees (billable hours × task rate, plus billable expenses with markup).' },
    ],
    howTo: [
      {
        q: { fr: 'Comment créer un projet ?', en: 'How do I create a project?' },
        a: { fr: 'Cliquez « Nouveau projet ». Saisissez « Code » et « Nom » (obligatoires), « Client », « Responsable », « Statut », « Facturation » et, au besoin, « Budget (heures) », « Budget ($) » et « Seuil d’alerte (%) ». Cochez les « Membres (peuvent saisir du temps) », puis « Enregistrer ».', en: 'Click “Nouveau projet”. Enter “Code” and “Nom” (required), “Client”, “Responsable”, “Statut”, “Facturation” and, if needed, “Budget (heures)”, “Budget ($)” and “Seuil d’alerte (%)”. Tick the “Membres (peuvent saisir du temps)”, then “Enregistrer”.' },
      },
      {
        q: { fr: 'Comment archiver un projet ?', en: 'How do I archive a project?' },
        a: { fr: 'Cliquez l’icône « Archiver » de la ligne (permission de gestion).', en: 'Click the “Archiver” icon on the row (management permission).' },
      },
    ],
    keywords: ['projets', 'projet', 'project', 'budget', 'client', 'facturation', 'archiver', 'seuil', 'function fox'],
  },
  {
    id: 'pm.projectDetail',
    module: 'tools.pm',
    path: '/tools/pm/projects/:id',
    permission: 'tools.pm.access',
    title: { fr: 'Fiche projet', en: 'Project record' },
    summary: {
      fr: 'Fiche d’un projet : budget, tâches, temps saisi (lecture seule), dépenses et équipe, en onglets.',
      en: 'One project’s record: budget, tasks, time entered (read-only), expenses and team, in tabs.',
    },
    tips: [
      { fr: 'Onglets : « Vue d’ensemble », « Tâches », « Temps », « Dépenses », « Équipe ».', en: 'Tabs: “Vue d’ensemble”, “Tâches”, “Temps”, “Dépenses”, “Équipe”.' },
      { fr: 'La carte « Rentabilité » (revenus, coût, marge) n’apparaît qu’avec la permission « Rapports, rentabilité et coûts ».', en: 'The “Rentabilité” card (revenue, cost, margin) only appears with “Reports, profitability and costs”.' },
      { fr: 'Dans « Temps », « Exporter CSV » télécharge le détail du temps du projet.', en: 'In “Temps”, “Exporter CSV” downloads the project’s time detail.' },
      { fr: 'L’équipe se modifie dans le formulaire du projet, pas dans cet onglet.', en: 'The team is edited in the project form, not in this tab.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ajouter une dépense ?', en: 'How do I add an expense?' },
        a: { fr: 'Ouvrez l’onglet « Dépenses », cliquez « Dépense » (permission de gestion). Saisissez Date, Description, Fournisseur, Coût, Marge %, cochez « Facturable au client » si besoin, puis validez. Le montant facturé = coût × (1 + marge %).', en: 'Open the “Dépenses” tab, click “Dépense” (management permission). Enter Date, Description, Fournisseur, Coût, Marge %, tick “Facturable au client” if needed, then confirm. Billed amount = cost × (1 + markup %).' },
      },
    ],
    keywords: ['projet', 'fiche', 'budget', 'tâches', 'temps', 'dépenses', 'équipe', 'rentabilité', 'function fox'],
  },
  {
    id: 'pm.clients',
    module: 'tools.pm',
    path: '/tools/pm/clients',
    permission: 'tools.pm.access',
    title: { fr: 'Clients', en: 'Clients' },
    summary: {
      fr: 'Liste des clients avec leurs projets. Créer ou modifier un client exige la permission de gestion.',
      en: 'List of clients with their projects. Creating or editing a client requires the management permission.',
    },
    tips: [
      { fr: '« Afficher les archivés » montre les clients archivés.', en: '“Afficher les archivés” shows archived clients.' },
      { fr: 'Un client qui a des projets ne se supprime pas : archivez-le.', en: 'A client with projects cannot be deleted: archive it.' },
      { fr: 'Les notes du client ne sont pas affichées dans la liste.', en: 'The client’s notes are not shown in the list.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ajouter un client ?', en: 'How do I add a client?' },
        a: { fr: 'Cliquez « Nouveau client ». Saisissez « Nom » (obligatoire), « Personne-ressource », « Courriel », « Téléphone », puis « Enregistrer ».', en: 'Click “Nouveau client”. Enter “Nom” (required), “Personne-ressource”, “Courriel”, “Téléphone”, then “Enregistrer”.' },
      },
    ],
    keywords: ['clients', 'client', 'personne-ressource', 'courriel', 'archiver', 'function fox'],
  },
  {
    id: 'pm.tasks',
    module: 'tools.pm',
    path: '/tools/pm/tasks',
    permission: 'tools.pm.access',
    title: { fr: 'Tâches', en: 'Tasks' },
    summary: {
      fr: 'Tâches de vos projets, en liste ou en tableau par statut. Pour un non-gestionnaire, « Mes tâches » est actif par défaut.',
      en: 'Tasks of your projects, as a list or a status board. For non-managers, “Mes tâches” is on by default.',
    },
    tips: [
      { fr: 'Désactivez « Mes tâches » pour voir les tâches de tous les projets.', en: 'Turn off “Mes tâches” to see tasks of all projects.' },
      { fr: 'En tableau, glissez une tâche d’une colonne à l’autre, ou changez son statut avec le sélecteur (seulement si vous pouvez la modifier).', en: 'In board view, drag a task between columns, or change its status with the selector (only when you can edit it).' },
      { fr: 'Statuts : À faire, En cours, En revue, Terminée. Priorités : Urgente, Haute, Normale, Basse.', en: 'Statuses: À faire, En cours, En revue, Terminée. Priorities: Urgente, Haute, Normale, Basse.' },
      { fr: '« Nouvelle tâche » n’apparaît que si vous êtes membre d’au moins un projet non archivé.', en: '“Nouvelle tâche” only appears if you are on at least one non-archived project.' },
      { fr: 'Une tâche qui a du temps saisi ne se supprime pas : marquez-la « Terminée ». Dans un projet où vous n’êtes pas membre, la tâche est en lecture seule.', en: 'A task with time booked cannot be deleted: mark it “Terminée”. In a project you are not on, the task is read-only.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment créer une tâche ?', en: 'How do I create a task?' },
        a: { fr: 'Cliquez « Nouvelle tâche ». Choisissez le projet, saisissez le nom, les personnes assignées, le statut, la priorité et l’échéance, puis enregistrez.', en: 'Click “Nouvelle tâche”. Pick the project, enter the name, assignees, status, priority and due date, then save.' },
      },
    ],
    keywords: ['tâches', 'taches', 'task', 'tasks', 'kanban', 'tableau', 'statut', 'priorité', 'function fox'],
  },
  {
    id: 'pm.timesheet',
    module: 'tools.pm',
    path: '/tools/pm/timesheet',
    permission: 'tools.pm.access',
    title: { fr: 'Feuille de temps', en: 'Timesheet' },
    summary: {
      fr: 'Saisie de votre temps par semaine (projet ou tâche, par jour), avec chronomètre, copie de la semaine précédente et soumission à l’approbation.',
      en: 'Enter your time by week (project or task, by day), with a timer, copy of last week and submission for approval.',
    },
    tips: [
      { fr: 'Saisie : 1,5 ou 1.5 ou 1:30. Vide ou 0 supprime. Entrée enregistre, Échap annule. Maximum 24 h par entrée et par jour.', en: 'Entry: 1,5 or 1.5 or 1:30. Empty or 0 deletes. Enter saves, Escape cancels. Maximum 24 h per entry and per day.' },
      { fr: 'Chronomètre : « Démarrer », puis « Arrêter et saisir X h ». Le temps est arrondi au quart d’heure supérieur et ajouté à la case du jour.', en: 'Timer: “Démarrer”, then “Arrêter et saisir X h”. Time is rounded up to the quarter hour and added to today’s cell.' },
      { fr: '« Soumettre la semaine » verrouille le temps jusqu’à son approbation ou sa reprise. « Reprendre pour modifier » le renvoie en brouillon.', en: '“Soumettre la semaine” locks the time until it is approved or taken back. “Reprendre pour modifier” sends it back to draft.' },
      { fr: 'Statuts : Brouillon, Soumis, Approuvé, Rejeté. Le motif de rejet s’affiche sur la ligne.', en: 'Statuses: Brouillon, Soumis, Approuvé, Rejeté. The rejection reason shows on the row.' },
      { fr: 'Seuls les projets ouverts (non archivés, non terminés, non fermés à la saisie) sont proposés. Les gestionnaires peuvent choisir « Personne » pour voir la semaine d’un autre.', en: 'Only open projects (not archived, not completed, not closed to time entry) are offered. Managers can pick “Personne” to see another person’s week.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment saisir mon temps ?', en: 'How do I enter my time?' },
        a: { fr: 'Cliquez « Ajouter une ligne », choisissez le « Projet » et la « Tâche » (ou « Sans tâche »), puis tapez les heures dans les cases du jour et appuyez sur Entrée.', en: 'Click “Ajouter une ligne”, pick the “Projet” and “Tâche” (or “Sans tâche”), then type hours in the day cells and press Enter.' },
      },
      {
        q: { fr: 'Comment soumettre ma semaine ?', en: 'How do I submit my week?' },
        a: { fr: 'Cliquez « Soumettre la semaine (X h) », puis confirmez. Pour une ligne rejetée, corrigez-la puis soumettez à nouveau.', en: 'Click “Soumettre la semaine (X h)”, then confirm. For a rejected line, correct it and submit again.' },
      },
    ],
    keywords: ['feuille de temps', 'temps', 'timesheet', 'heures', 'chronomètre', 'timer', 'soumettre', 'approbation', 'function fox'],
  },
  {
    id: 'pm.approvals',
    module: 'tools.pm',
    path: '/tools/pm/approvals',
    permission: 'tools.pm.approve',
    title: { fr: 'Approbations', en: 'Approvals' },
    summary: {
      fr: 'Approuver ou rejeter le temps soumis par l’équipe, par semaine ou par ligne. Réservé aux personnes ayant la permission « Approuver les feuilles de temps ».',
      en: 'Approve or reject submitted team time, by week or by line. Reserved to people with “Approve timesheets”.',
    },
    tips: [
      { fr: 'Deux onglets : « À approuver (n) » et « Approuvés ». Par défaut, la période couvre 8 semaines.', en: 'Two tabs: “À approuver (n)” and “Approuvés”. By default the period covers 8 weeks.' },
      { fr: 'Le rejet exige un motif (« Motif (visible par la personne) », 500 caractères maximum). La personne le voit et corrige son temps.', en: 'Rejecting requires a reason (“Motif (visible par la personne)”, 500 characters maximum). The person sees it and corrects the time.' },
      { fr: 'Annuler une approbation renvoie le temps au statut « Soumis ».', en: 'Cancelling an approval sends the time back to “Soumis”.' },
      { fr: 'Vous ne pouvez pas approuver votre propre temps : les boutons n’apparaissent pas.', en: 'You cannot approve your own time: the buttons do not appear.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment approuver une semaine ?', en: 'How do I approve a week?' },
        a: { fr: 'Sur la carte de la personne, cliquez « Approuver tout ». Pour une seule ligne, cliquez « Approuver » sur la ligne.', en: 'On the person’s card, click “Approuver tout”. For a single line, click “Approuver” on the line.' },
      },
      {
        q: { fr: 'Comment rejeter du temps ?', en: 'How do I reject time?' },
        a: { fr: 'Cliquez « Rejeter », saisissez le « Motif (visible par la personne) », puis validez.', en: 'Click “Rejeter”, enter the “Motif (visible par la personne)”, then confirm.' },
      },
    ],
    keywords: ['approbation', 'approbations', 'approuver', 'rejeter', 'feuille de temps', 'approve', 'reject', 'function fox'],
  },
  {
    id: 'pm.schedule',
    module: 'tools.pm',
    path: '/tools/pm/schedule',
    permission: 'tools.pm.access',
    title: { fr: 'Planification', en: 'Schedule' },
    summary: {
      fr: 'Diagramme de Gantt des projets et des tâches avec leurs dates. Menu : « Échéancier ». Filtrable par client, projet ou personne.',
      en: 'Gantt timeline of projects and tasks with their dates. Menu label: “Échéancier”. Filterable by client, project or person.',
    },
    tips: [
      { fr: 'Zoom : « Semaine » (14 jours), « Mois » ou « Trimestre ». Boutons « Précédent », « Aujourd’hui », « Suivant ».', en: 'Zoom: “Semaine” (14 days), “Mois” or “Trimestre”. Buttons “Précédent”, “Aujourd’hui”, “Suivant”.' },
      { fr: 'Une tâche en retard s’affiche en rouge. Les barres sont colorées selon le statut.', en: 'A late task shows in red. Bars are coloured by status.' },
      { fr: 'Cliquez une tâche pour l’ouvrir ; cliquez un projet pour sa fiche.', en: 'Click a task to open it; click a project to open its record.' },
      { fr: '« Non planifiées » liste les projets sans dates et les tâches sans date. Les dates se changent dans la fenêtre de la tâche.', en: '“Non planifiées” lists projects without dates and undated tasks. Dates are changed in the task window.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment voir le calendrier d’une personne ?', en: 'How do I see one person’s schedule?' },
        a: { fr: 'Choisissez la personne dans le filtre « Personne ». Ajoutez « Client » ou « Projet » si besoin.', en: 'Pick the person in the “Personne” filter. Add “Client” or “Projet” if needed.' },
      },
    ],
    keywords: ['échéancier', 'echeancier', 'planification', 'gantt', 'calendrier', 'dates', 'retard', 'schedule', 'function fox'],
  },
  {
    id: 'pm.workload',
    module: 'tools.pm',
    path: '/tools/pm/workload',
    permission: 'tools.pm.access',
    title: { fr: 'Charge', en: 'Workload' },
    summary: {
      fr: 'Charge prévue et réelle de chaque personne sur 8 semaines, et gestion des absences (vacances, maladie, congé férié, autre). Menu : « Disponibilités ».',
      en: 'Planned and actual load of each person over 8 weeks, and time-off management (vacances, maladie, congé férié, autre). Menu label: “Disponibilités”.',
    },
    tips: [
      { fr: 'Couleurs : « moins de 70 % », « 70 à 100 % », « plus de 100 % » (surcharge).', en: 'Colours: “moins de 70 %”, “70 à 100 %”, “plus de 100 %” (overbooked).' },
      { fr: 'La charge prévue répartit l’estimation de chaque tâche ouverte sur ses jours ouvrables entre le début et l’échéance. Une tâche sans dates ou sans estimation n’est pas comptée.', en: 'Planned load spreads each open task’s estimate over its working days between start and due date. A task without dates or estimate is not counted.' },
      { fr: 'Capacité = heures par semaine (40 par défaut) sur les jours de travail, moins les absences.', en: 'Capacity = weekly hours (40 by default) on working days, minus time off.' },
      { fr: 'Les heures travaillées n’apparaissent que pour les semaines en cours et passées.', en: 'Worked hours only appear for current and past weeks.' },
      { fr: 'Onglet « Absences » : seuls les gestionnaires gèrent les absences des autres. Supprimer une absence demande confirmation.', en: '“Absences” tab: only managers manage other people’s time off. Deleting time off asks for confirmation.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment ajouter une absence ?', en: 'How do I add time off?' },
        a: { fr: 'Ouvrez l’onglet « Absences ». Choisissez « Personne » et « Type », saisissez « Du », « Au (inclus) » et « Note », puis « Ajouter ».', en: 'Open the “Absences” tab. Choose “Personne” and “Type”, enter “Du”, “Au (inclus)” and “Note”, then “Ajouter”.' },
      },
    ],
    keywords: ['charge', 'disponibilités', 'disponibilites', 'workload', 'capacité', 'absences', 'vacances', 'surcharge', 'function fox'],
  },
  {
    id: 'pm.reports',
    module: 'tools.pm',
    path: '/tools/pm/reports',
    permission: 'tools.pm.reports',
    title: { fr: 'Rapports', en: 'Reports' },
    summary: {
      fr: 'Rapports de temps, budget et rentabilité (revenus, coûts, marge), avec export CSV. Réservé aux personnes ayant la permission « Rapports, rentabilité et coûts ».',
      en: 'Time, budget and profitability reports (revenue, costs, margin), with CSV export. Reserved to people with “Reports, profitability and costs”.',
    },
    tips: [
      { fr: 'Onglets : « Temps par projet », « Temps par personne », « Budget vs réel », « Rentabilité », « Dépenses », « Détail du temps ».', en: 'Tabs: “Temps par projet”, “Temps par personne”, “Budget vs réel”, “Rentabilité”, “Dépenses”, “Détail du temps”.' },
      { fr: 'Périodes : « Cette semaine », « Ce mois », « Ce trimestre », « Cette année », ou « Du » et « Au ».', en: 'Periods: “Cette semaine”, “Ce mois”, “Ce trimestre”, “Cette année”, or “Du” and “Au”.' },
      { fr: 'Rentabilité : revenu = honoraires facturables + dépenses facturables. Coût = heures × taux de coût de chaque personne + coût des dépenses. Une personne sans taux compte pour 0 $, et une note le signale.', en: 'Profitability: revenue = billable fees + billable expenses. Cost = hours × each person’s cost rate + expense cost. A person without a rate counts as $0, and a note says so.' },
      { fr: '« Budget vs réel » est cumulatif jusqu’à « Cumul au » ; les filtres Personne et Statut ne s’y appliquent pas.', en: '“Budget vs réel” is cumulative up to “Cumul au”; the Personne and Statut filters do not apply to it.' },
      { fr: '« Exporter CSV » produit un fichier séparé par des points-virgules, en UTF-8.', en: '“Exporter CSV” produces a semicolon-separated file, in UTF-8.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment exporter un rapport ?', en: 'How do I export a report?' },
        a: { fr: 'Choisissez l’onglet et la période, puis cliquez « Exporter CSV ».', en: 'Pick the tab and the period, then click “Exporter CSV”.' },
      },
      {
        q: { fr: 'Comment voir la rentabilité par client ?', en: 'How do I see profitability by client?' },
        a: { fr: 'Ouvrez l’onglet « Rentabilité » et regardez « Rentabilité par client » (« Rentabilité par projet » est juste au-dessus).', en: 'Open the “Rentabilité” tab and look at “Rentabilité par client” (“Rentabilité par projet” is above it).' },
      },
    ],
    keywords: ['rapports', 'rapport', 'rentabilité', 'marge', 'budget', 'coût', 'export', 'csv', 'reports', 'function fox'],
  },
  {
    id: 'pm.team',
    module: 'tools.pm',
    path: '/tools/pm/team',
    permission: 'tools.pm.manage',
    title: { fr: 'Équipe et taux', en: 'Team and rates' },
    summary: {
      fr: 'Pour chaque personne active : heures par semaine, jours de travail et taux de coût horaire. Réservé aux personnes ayant la permission de gestion ; le taux de coût est confidentiel.',
      en: 'For each active person: hours per week, working days and hourly cost rate. Reserved to management; the cost rate is confidential.',
    },
    tips: [
      { fr: 'Le « Taux de coût ($/h) » n’est pas affiché ailleurs que sur cette page. Les rapports de rentabilité n’affichent que le coût calculé.', en: 'The “Taux de coût ($/h)” is not shown anywhere else. Profitability reports only show the calculated cost.' },
      { fr: 'Heures par semaine : de 0 à 100. Au moins un jour de travail doit être coché.', en: 'Hours per week: 0 to 100. At least one working day must be ticked.' },
      { fr: 'Vide = aucun taux. Chaque ligne s’enregistre séparément (« Enregistrer » / « Annuler »).', en: 'Empty = no rate. Each row saves separately (“Enregistrer” / “Annuler”).' },
      { fr: 'Les heures des 30 derniers jours sont affichées à titre de repère.', en: 'The hours of the last 30 days are shown for reference.' },
    ],
    howTo: [
      {
        q: { fr: 'Comment régler le taux de coût d’une personne ?', en: 'How do I set a person’s cost rate?' },
        a: { fr: 'Saisissez le montant dans « Taux de coût ($/h) » de sa ligne, puis « Enregistrer ».', en: 'Type the amount in “Taux de coût ($/h)” on the person’s row, then “Enregistrer”.' },
      },
    ],
    keywords: ['équipe', 'taux', 'coût', 'cost rate', 'capacité', 'heures', 'jours de travail', 'function fox', 'team'],
  },
];
