/**
 * In-app help, part A: the shell (dashboard, menus, access) and the accounting, estimating, sales, work order,
 * shipping, IT support, development and sandbox pages. Each entry describes what the page does today. Button names
 * are quoted as the French label the UI shows, followed by the English label in brackets in the answers.
 *
 * Order matters for ties: topicForPath keeps the first topic when two match with the same length, so a literal
 * path (e.g. /estimating/materials) is listed before the ':id' path of the same depth (e.g. /estimating/:id).
 */
import type { Bi, HelpTopic } from './types.ts';

const bi = (fr: string, en: string): Bi => ({ fr, en });

export const HELP_A: HelpTopic[] = [
  /* ------------------------------------------------------------------ app (shell) */
  {
    id: 'app.dashboard',
    module: 'app',
    path: '/',
    permission: '',
    title: bi('Tableau de bord', 'Dashboard'),
    summary: bi(
      'Page d’accueil d’Imago : un message de bienvenue, la liste de vos modules et des widgets (chiffres et listes) selon vos accès. Chaque personne peut ajuster sa propre disposition.',
      'Imago home page: a welcome message, your modules and widgets (figures and lists) that match your access. Each person can adjust their own layout.',
    ),
    tips: [
      bi('Cliquez une carte de « Mes modules » pour ouvrir le module.', 'Click a card in “My modules” to open that module.'),
      bi('« Personnaliser » permet de réordonner les widgets, d’en changer la largeur ou de les masquer. Ces changements ne s’appliquent qu’à vous.', '“Customize” lets you reorder widgets, change their width or hide them. These changes only apply to you.'),
      bi('Le widget « Notes » enregistre automatiquement votre texte.', 'The “Notes” widget saves your text automatically.'),
      bi('« Mon activité » affiche vos six dernières actions enregistrées.', '“My activity” shows your six most recent logged actions.'),
      bi('Un widget n’apparaît que si votre accès le permet.', 'A widget only appears if your access allows it.'),
    ],
    howTo: [
      {
        q: bi('Comment masquer un widget ?', 'How do I hide a widget?'),
        a: bi(
          'Cliquez « Personnaliser », puis l’icône œil barré du widget. Pour le remettre, cliquez son nom sous « Ajouter : ». Cliquez « Terminé » pour quitter le mode personnalisation.',
          'Click “Customize”, then the crossed-eye icon on the widget. To bring it back, click its name under “Add:”. Click “Done” to leave customize mode.',
        ),
      },
      {
        q: bi('Comment revenir à la disposition par défaut ?', 'How do I go back to the default layout?'),
        a: bi(
          'Cliquez « Personnaliser », puis « Rétablir la disposition par défaut ». Ce bouton n’apparaît que si vous avez une disposition personnelle.',
          'Click “Customize”, then “Restore default layout”. This button only shows when you have a personal layout.',
        ),
      },
      {
        q: bi('Comment changer la disposition pour tout le monde ?', 'How do I change the layout for everyone?'),
        a: bi(
          'Un administrateur ajuste la disposition, puis clique « Personnaliser » et « Enregistrer comme défaut pour tous ».',
          'An administrator adjusts the layout, then clicks “Customize” and “Save as default for everyone”.',
        ),
      },
    ],
    keywords: ['accueil', 'tableau de bord', 'widgets', 'personnaliser', 'disposition', 'home', 'dashboard', 'customize', 'layout', 'start page'],
  },
  {
    id: 'app.sidebar',
    module: 'app',
    path: '/',
    permission: '',
    title: bi('Menu latéral et sections', 'Sidebar and sections'),
    summary: bi(
      'Le menu à gauche liste le tableau de bord et les modules, regroupés en sections par thème. Vous pouvez replier une section ou réduire tout le menu en icônes.',
      'The menu on the left lists the dashboard and the modules, grouped in sections by theme. You can fold a section or shrink the whole menu to icons.',
    ),
    tips: [
      bi('Cliquez le titre d’une section pour la replier ou la déployer. Ce choix est gardé dans ce navigateur.', 'Click a section title to fold or unfold it. This choice is kept in this browser.'),
      bi('La section qui contient le module ouvert est déployée automatiquement.', 'The section that holds the open module is unfolded automatically.'),
      bi('Chaque module a sa couleur : son icône prend cette couleur dans le menu, et le module ouvert garde la sienne dans l’interface.', 'Each module has its own colour: its icon takes that colour in the menu, and the open module keeps it in the interface.'),
      bi('Le bouton en bas du menu le réduit en icônes ; cliquez-le à nouveau pour le déployer.', 'The button at the bottom of the menu shrinks it to icons; click it again to expand it.'),
      bi('Un module peut rester épinglé en bas du menu, sous les sections.', 'A module can stay pinned at the bottom of the menu, below the sections.'),
    ],
    howTo: [
      {
        q: bi('Comment réduire le menu ?', 'How do I collapse the menu?'),
        a: bi('Cliquez l’icône de flèche en bas du menu latéral. Cliquez-la à nouveau pour le déployer.', 'Click the arrow icon at the bottom of the sidebar. Click it again to expand the sidebar.'),
      },
      {
        q: bi('Pourquoi je ne vois pas un module ?', 'Why can’t I see a module?'),
        a: bi(
          'Un module n’apparaît que si votre groupe d’accès permet d’y entrer. Demandez à un administrateur de vous donner l’accès.',
          'A module only appears if your access group allows you in. Ask an administrator to grant you access.',
        ),
      },
    ],
    keywords: ['menu', 'barre latérale', 'sidebar', 'section', 'replier', 'réduire', 'collapse', 'fold', 'modules', 'icône', 'navigation'],
  },
  {
    id: 'app.topbar',
    module: 'app',
    path: '/',
    permission: '',
    title: bi('Barre du haut : langue et thème', 'Top bar: language and theme'),
    summary: bi(
      'La barre du haut affiche le module et la page ouverts, le bouton de langue FR / EN, le thème clair ou sombre et votre menu utilisateur.',
      'The top bar shows the open module and page, the FR / EN language button, the light or dark theme and your user menu.',
    ),
    tips: [
      bi('« EN » ou « FR » change la langue de l’interface. Votre choix est enregistré avec votre profil.', '“EN” or “FR” changes the interface language. Your choice is saved with your profile.'),
      bi('L’icône lune ou soleil bascule entre le thème clair et le thème sombre.', 'The moon or sun icon switches between light and dark theme.'),
      bi('Certains modules ajoutent leurs propres boutons dans cette barre, selon votre accès.', 'Some modules add their own buttons to this bar, depending on your access.'),
      bi('Sur petit écran, le bouton « Menu » ouvre le menu latéral.', 'On a small screen, the “Menu” button opens the sidebar.'),
    ],
    howTo: [
      {
        q: bi('Comment passer en anglais ?', 'How do I switch to English?'),
        a: bi('Cliquez « EN » dans la barre du haut. Le bouton affiche « FR » quand l’interface est en anglais : cliquez-le pour revenir au français.', 'Click “EN” in the top bar. The button shows “FR” when the interface is in English: click it to go back to French.'),
      },
      {
        q: bi('Comment passer en thème sombre ?', 'How do I switch to dark theme?'),
        a: bi('Cliquez l’icône lune. Quand le thème est déjà sombre, l’icône devient un soleil : cliquez-la pour revenir au thème clair.', 'Click the moon icon. When the theme is already dark, the icon becomes a sun: click it to go back to light theme.'),
      },
    ],
    keywords: ['langue', 'français', 'anglais', 'EN', 'FR', 'thème', 'sombre', 'clair', 'dark mode', 'light mode', 'language', 'theme', 'top bar'],
  },
  {
    id: 'app.user-menu',
    module: 'app',
    path: '/',
    permission: '',
    title: bi('Menu utilisateur', 'User menu'),
    summary: bi(
      'Votre avatar en haut à droite ouvre le menu utilisateur : votre nom et courriel, les entrées auxquelles votre accès donne droit et la déconnexion.',
      'Your avatar at the top right opens the user menu: your name and e-mail, the entries your access allows and sign-out.',
    ),
    tips: [
      bi('« Paramètres d’administration » n’apparaît que si votre accès le permet.', '“Admin settings” only appears if your access allows it.'),
      bi('Les entrées de ce menu dépendent de votre accès.', 'The entries in this menu depend on your access.'),
      bi('Pour fermer le menu, cliquez ailleurs ou appuyez sur Échap.', 'To close the menu, click elsewhere or press Esc.'),
      bi('« Se déconnecter » ferme votre session.', '“Sign out” ends your session.'),
    ],
    howTo: [
      {
        q: bi('Comment me déconnecter ?', 'How do I sign out?'),
        a: bi('Cliquez votre avatar en haut à droite, puis « Se déconnecter ».', 'Click your avatar at the top right, then “Sign out”.'),
      },
      {
        q: bi('Où sont les paramètres d’administration ?', 'Where are the admin settings?'),
        a: bi(
          'Cliquez votre avatar, puis « Paramètres d’administration ». Cette entrée n’existe que pour les personnes ayant l’accès administrateur.',
          'Click your avatar, then “Admin settings”. The entry only exists for people with administrator access.',
        ),
      },
    ],
    keywords: ['profil', 'compte', 'avatar', 'déconnexion', 'se déconnecter', 'administration', 'paramètres', 'user menu', 'sign out', 'logout', 'account', 'admin settings'],
  },
  {
    id: 'app.access',
    module: 'app',
    path: '/',
    permission: '',
    title: bi('Modules, accès et permissions', 'Modules, access and permissions'),
    summary: bi(
      'Imago est divisé en modules. Vous ne voyez que les modules et les actions que votre groupe d’accès permet.',
      'Imago is split into modules. You only see the modules and actions your access group allows.',
    ),
    tips: [
      bi('Un module est visible si vous avez son accès, en général « Accéder au module ».', 'A module is visible if you have its access, usually “Access module”.'),
      bi('Dans un module, certains boutons demandent une permission précise. Un bouton absent veut dire que votre accès ne le permet pas.', 'Inside a module, some buttons need a specific permission. A missing button means your access does not allow it.'),
      bi('Les groupes d’accès sont gérés par un administrateur dans « Paramètres d’administration » › « Groupes d’accès ».', 'Access groups are managed by an administrator in “Paramètres d’administration” › “Admin settings › Access groups”.'),
      bi('Si une page ne s’ouvre pas, ou si une action manque, vérifiez votre accès auprès d’un administrateur.', 'If a page does not open, or an action is missing, check your access with an administrator.'),
    ],
    howTo: [
      {
        q: bi('Pourquoi je ne vois pas le bouton « Enregistrer » ?', 'Why don’t I see the “Save” button?'),
        a: bi(
          'Votre accès ne permet pas de modifier cette page. Demandez à un administrateur la permission correspondante, par exemple « Créer / modifier des estimations » pour l’estimation.',
          'Your access does not allow editing this page. Ask an administrator for the matching permission, for example “Create / edit estimates” for estimating.',
        ),
      },
      {
        q: bi('Qui peut changer mes accès ?', 'Who can change my access?'),
        a: bi(
          'Une personne ayant « Gérer les groupes et permissions », dans « Paramètres d’administration » › « Groupes d’accès ».',
          'A person with “Manage groups & permissions”, in “Paramètres d’administration” › “Groupes d’accès”.',
        ),
      },
    ],
    keywords: ['permission', 'accès', 'groupe', 'groupes d’accès', 'droits', 'access', 'permissions', 'access group', 'rights', 'module', 'why can’t I see'],
  },
  {
    id: 'app.help',
    module: 'app',
    path: '/',
    permission: '',
    title: bi('Comment ça marche (aide)', 'How it works (help)'),
    summary: bi(
      'Le bouton « Comment ça marche » en haut de chaque page ouvre des conseils rapides sur cette page et une zone pour poser une question. Les réponses ne portent que sur ce que vous pouvez ouvrir.',
      'The “How it works” button at the top of each page opens quick tips for that page and a box to ask a question. Answers only cover what you are allowed to open.',
    ),
    tips: [
      bi('Les conseils affichés correspondent à la page ouverte.', 'The tips shown match the page you have open.'),
      bi('La zone de question répond à partir de cette aide, et seulement pour votre accès.', 'The question box answers from this help, and only for your access.'),
      bi('Une page sans aide détaillée affiche au moins son résumé et des conseils généraux.', 'A page without detailed help still shows a summary and general tips.'),
    ],
    howTo: [
      {
        q: bi('Comment obtenir de l’aide sur la page en cours ?', 'How do I get help on the current page?'),
        a: bi(
          'Cliquez « Comment ça marche » en haut de la page, puis lisez les conseils ou tapez votre question dans la zone prévue.',
          'Click “How it works” at the top of the page, then read the tips or type your question in the box.',
        ),
      },
    ],
    keywords: ['aide', 'comment ça marche', 'help', 'how it works', 'tips', 'conseils', 'question', 'faq'],
  },
  {
    id: 'app.assistant',
    module: 'app',
    path: '/',
    permission: '',
    title: bi('Assistant (logo déplaçable)', 'Assistant (movable logo)'),
    summary: bi(
      'Un petit logo déplaçable ouvre un clavardage avec un assistant IA. L’assistant ne répond qu’à partir de ce que vous pouvez ouvrir dans Imago.',
      'A small movable logo opens a chat with an AI assistant. The assistant only answers from what you are allowed to open in Imago.',
    ),
    tips: [
      bi('Déplacez le logo à la souris pour le placer où vous voulez.', 'Drag the logo with the mouse to place it where you want.'),
      bi('L’assistant ne voit que les modules et pages auxquels vous avez accès.', 'The assistant only sees the modules and pages you have access to.'),
      bi('Pour une question précise, nommez le module ou la page concernée.', 'For a precise question, name the module or page concerned.'),
    ],
    howTo: [
      {
        q: bi('Comment poser une question à l’assistant ?', 'How do I ask the assistant a question?'),
        a: bi('Cliquez le logo, tapez votre question dans le clavardage, puis envoyez-la.', 'Click the logo, type your question in the chat, then send it.'),
      },
    ],
    keywords: ['assistant', 'logo', 'chat', 'clavardage', 'IA', 'AI', 'question', 'helper'],
  },

  /* ------------------------------------------------------------------ accounting */
  {
    id: 'accounting.overview',
    module: 'accounting',
    path: '/accounting',
    permission: 'accounting.access',
    title: bi('Comptabilité : aperçu', 'Accounting: overview'),
    summary: bi(
      'Vue d’ensemble des factures fournisseurs : courriels à traiter, exceptions, factures prêtes à comptabiliser et factures comptabilisées ce mois-ci. Le module relie la boîte des factures à Business Central (BC).',
      'Overview of vendor invoices: e-mails to process, exceptions, invoices ready to post and invoices posted this month. The module links the invoice inbox to Business Central (BC).',
    ),
    tips: [
      bi('Les quatre chiffres (« Courriels à traiter », « Exceptions », « Prêtes à comptabiliser », « Comptabilisées ce mois ») ouvrent la liste correspondante.', 'The four figures (“E-mails to process”, “Exceptions”, “Ready to post”, “Posted this month”) open the matching list.'),
      bi('« Métamorphose des factures » montre combien de factures sont à chaque étape : Reçue, Extraite, Validée BC, Comptabilisée.', '“Invoice metamorphosis” shows how many invoices are at each stage: Received, Extracted, BC validated, Posted.'),
      bi('« Activité récente » liste les dernières factures ; cliquez une ligne pour l’ouvrir.', '“Recent activity” lists the latest invoices; click a row to open it.'),
      bi('Le bouton « Ouvrir la boîte de réception » mène aux courriels à traiter.', 'The “Open inbox” button goes to the e-mails to process.'),
    ],
    howTo: [
      {
        q: bi('Par où commencer une facture reçue par courriel ?', 'Where do I start with an invoice received by e-mail?'),
        a: bi(
          'Cliquez « Ouvrir la boîte de réception », sélectionnez le courriel, puis « Extraire et valider avec BC ».',
          'Click “Open inbox”, select the e-mail, then “Extract & validate with BC”.',
        ),
      },
      {
        q: bi('Comment voir les factures en exception ?', 'How do I see the invoices with exceptions?'),
        a: bi('Cliquez le chiffre « Exceptions ». La liste des factures s’ouvre avec le filtre « À valider ».', 'Click the “Exceptions” figure. The invoice list opens with the “To validate” filter.'),
      },
    ],
    keywords: ['comptabilité', 'comptes fournisseurs', 'factures', 'aperçu', 'accounting', 'accounts payable', 'overview', 'business central', 'BC', 'invoices'],
  },
  {
    id: 'accounting.inbox',
    module: 'accounting',
    path: '/accounting/inbox',
    permission: 'accounting.inbox.view',
    title: bi('Boîte de réception des factures', 'Invoice inbox'),
    summary: bi(
      'Les courriels reçus à la boîte de factures, avec leurs PDF. Une facture peut en être extraite, puis validée avec Business Central.',
      'E-mails received in the invoice mailbox, with their PDFs. An invoice can be extracted from them and validated with Business Central.',
    ),
    tips: [
      bi('« Synchroniser » va chercher les nouveaux courriels de la boîte surveillée, dont l’adresse s’affiche sous le titre.', '“Sync mailbox” fetches new e-mails from the monitored mailbox, whose address shows under the title.'),
      bi('Le badge « Nouvelle » indique un courriel pas encore importé ; « Importée » ouvre la facture créée.', 'The “New” badge marks an e-mail not yet imported; “Imported” opens the invoice created from it.'),
      bi('« Données détectées » montre le numéro de facture, le PO, le nombre de lignes et le total lus dans le PDF.', '“Detected data” shows the invoice number, PO, number of lines and total read from the PDF.'),
      bi('Un PDF de bon de commande est repéré par le badge « Bon de commande ». Ces documents se traitent dans « Documents ».', 'A purchase order PDF is flagged with the “Purchase order” badge. These are processed in “Documents”.'),
    ],
    howTo: [
      {
        q: bi('Comment importer une facture reçue par courriel ?', 'How do I import an invoice received by e-mail?'),
        a: bi(
          '1. Sélectionnez le courriel. 2. Cliquez « Extraire et valider avec BC ». Si rien n’est détecté, cliquez « Saisir la facture manuellement ». 3. La facture s’ouvre. Ce bouton exige la permission « Importer des factures ».',
          '1. Select the e-mail. 2. Click “Extract & validate with BC”. If nothing is detected, click “Enter invoice manually”. 3. The invoice opens. This button needs the “Import invoices” permission.',
        ),
      },
      {
        q: bi('Pourquoi le bouton d’import n’apparaît pas ?', 'Why doesn’t the import button appear?'),
        a: bi('Il faut la permission « Importer des factures ». Sans elle, le message « Permission requise pour importer. » s’affiche à la place.', 'You need the “Importer des factures” permission. Without it, the message “Permission requise pour importer.” shows instead.'),
      },
    ],
    keywords: ['boîte de réception', 'courriel', 'email', 'factures', 'synchroniser', 'import', 'extraire', 'inbox', 'e-mail', 'sync mailbox', 'invoice inbox'],
  },
  {
    id: 'accounting.documents',
    module: 'accounting',
    path: '/accounting/inbox/documents',
    permission: 'accounting.inbox.view',
    title: bi('Documents reçus', 'Received documents'),
    summary: bi(
      'Tous les PDF reçus par courriel, classés en factures, bons de commande ou « À classer ». Vous pouvez corriger le type de chaque document et le traiter.',
      'All PDFs received by e-mail, sorted into invoices, purchase orders or “Unclassified”. You can correct each document’s type and process it.',
    ),
    tips: [
      bi('Les filtres « Tous », « Factures » et « Bons de commande » affichent le nombre de documents de chaque type.', 'The “All”, “Invoices” and “Purchase orders” filters show how many documents each type has.'),
      bi('L’icône baguette magique indique un classement fait par l’IA.', 'The magic wand icon marks a type classified by AI.'),
      bi('Dans la liste « Type », choisissez Facture, Bon de commande client, Bon de commande fournisseur ou Autre. Le changement est enregistré aussitôt.', 'In the “Type” list, choose Facture, Bon de commande – client, Bon de commande – fournisseur or Autre. The change is saved immediately.'),
      bi('La recherche couvre le nom du fichier, l’objet, l’expéditeur et les numéros lus.', 'Search covers the file name, subject, sender and the numbers read.'),
      bi('Le statut indique « Importée » ou « À traiter » pour une facture, et « Reçu » ou « Ouvrir » pour un bon de commande.', 'The status shows “Importée” or “À traiter” for an invoice, and “Reçu” or “Ouvrir” for a purchase order.'),
    ],
    howTo: [
      {
        q: bi('Comment traiter un bon de commande reçu ?', 'How do I process a received purchase order?'),
        a: bi(
          'Dans la ligne du document, cliquez « Traiter » (permission « Traiter les bons de commande reçus »). Le rapprochement avec BC s’exécute, puis le bon s’ouvre. Ensuite, le bouton « Ouvrir » y revient.',
          'In the document row, click “Process” (permission “Process received purchase orders”). The match with BC runs, then the order opens. Afterwards, “Open” returns to it.',
        ),
      },
      {
        q: bi('Comment corriger le type d’un document ?', 'How do I correct a document’s type?'),
        a: bi('Dans la colonne « Type », choisissez le bon type dans la liste déroulante.', 'In the “Type” column, choose the right type in the drop-down list.'),
      },
    ],
    keywords: ['documents', 'pdf', 'classer', 'bons de commande', 'factures', 'filtre', 'type', 'documents received', 'purchase orders', 'classify'],
  },
  {
    id: 'accounting.invoices',
    module: 'accounting',
    path: '/accounting/invoices',
    permission: 'accounting.access',
    title: bi('Factures fournisseurs', 'Vendor invoices'),
    summary: bi(
      'Liste des factures fournisseurs importées, filtrable par étape, et vue des factures synchronisées depuis Business Central.',
      'List of imported vendor invoices, filterable by stage, plus a view of invoices synced from Business Central.',
    ),
    tips: [
      bi('L’onglet « À traiter » liste les factures importées dans Imago ; « Business Central (synchronisées) » liste celles de BC.', 'The “To process” tab lists invoices imported into Imago; “synced” lists those from BC.'),
      bi('Les filtres « Toutes », « À valider », « Prête à comptabiliser », « Comptabilisée » et « Rejetée » indiquent le nombre de factures dans chacun.', 'The “Toutes”, “À valider”, “Prête à comptabiliser”, “Comptabilisée” and “Rejetée” filters show how many invoices each holds.'),
      bi('La colonne « Validation BC » indique le résultat de la validation avec Business Central.', 'The “BC validation” column shows the result of the validation with Business Central.'),
      bi('La zone « Fournisseur, facture, PO… » filtre la liste.', 'The “Fournisseur, facture, PO…” box filters the list.'),
      bi('Cliquez une ligne pour ouvrir la facture.', 'Click a row to open the invoice.'),
    ],
    howTo: [
      {
        q: bi('Comment retrouver une facture ?', 'How do I find an invoice?'),
        a: bi('Tapez le fournisseur, le numéro de facture ou le PO dans la zone « Fournisseur, facture, PO… ».', 'Type the vendor, invoice number or PO in the “Fournisseur, facture, PO…” box.'),
      },
      {
        q: bi('Comment voir ce qui est dans Business Central ?', 'How do I see what is in Business Central?'),
        a: bi('Cliquez l’onglet « Business Central (synchronisées) », puis « Synchroniser BC » pour mettre la liste à jour.', 'Click the “Business Central (synchronisées)” tab, then “Sync BC” to update the list.'),
      },
    ],
    keywords: ['factures fournisseurs', 'factures', 'liste', 'stage', 'étape', 'business central', 'vendor invoices', 'invoices', 'list', 'sync BC'],
  },
  {
    id: 'accounting.invoice',
    module: 'accounting',
    path: '/accounting/invoices/:id',
    permission: 'accounting.access',
    title: bi('Facture fournisseur (détail)', 'Vendor invoice (detail)'),
    summary: bi(
      'Détail d’une facture : en-tête, lignes comparées au bon de commande et à la réception, validation avec Business Central, historique et actions d’approbation.',
      'Invoice detail: header, lines compared with the purchase order and receipt, validation with Business Central, history and approval actions.',
    ),
    tips: [
      bi('Les lignes comparent la facture, le bon de commande et la réception ; la colonne « Écart » signale les différences.', 'The lines compare the invoice, the purchase order and the receipt; the “Var.” column flags differences.'),
      bi('« Validation Business Central » résume les écarts. Une dérogation écrite apparaît sous ce bloc.', '“Validation Business Central” summarises the mismatches. A written override appears below it.'),
      bi('Une facture comptabilisée ou rejetée est verrouillée : elle ne se modifie plus.', 'A posted or rejected invoice is locked and can no longer be changed.'),
      bi('« Approuver et comptabiliser » est désactivé tant qu’il reste des exceptions, sauf si vous avez la permission « Déroger aux exceptions ».', '“Approve & post” is disabled while exceptions remain, unless you have the “Override exceptions” permission.'),
      bi('L’« Historique » garde la trace de chaque action.', 'The “History” section keeps a record of each action.'),
    ],
    howTo: [
      {
        q: bi('Comment corriger une facture ?', 'How do I correct an invoice?'),
        a: bi(
          '1. Cliquez « Corriger ». 2. Modifiez les champs ou les lignes. 3. Cliquez « Enregistrer et valider » : la facture est revalidée avec BC. « Annuler » abandonne les changements.',
          '1. Click “Correct”. 2. Edit the fields or lines. 3. Click “Save & validate”: the invoice is re-validated with BC. “Cancel” discards the changes.',
        ),
      },
      {
        q: bi('Comment comptabiliser une facture ?', 'How do I post an invoice?'),
        a: bi(
          'Cliquez « Approuver et comptabiliser », puis « Comptabiliser » dans la fenêtre de confirmation. Il faut la permission « Comptabiliser dans BC ».',
          'Click “Approve & post”, then “Post” in the confirmation window. You need the “Post to BC” permission.',
        ),
      },
      {
        q: bi('Comment rejeter ou rouvrir une facture ?', 'How do I reject or reopen an invoice?'),
        a: bi(
          'Pour rejeter, cliquez « Rejeter », saisissez le motif (communiqué au fournisseur), puis « Rejeter ». Une facture rejetée se reprend avec « Réouvrir ».',
          'To reject, click “Reject”, enter the reason (shared with the vendor), then “Rejeter”. A rejected invoice is picked up again with “Reopen”.',
        ),
      },
    ],
    keywords: ['facture', 'détail', 'corriger', 'comptabiliser', 'rejeter', 'réouvrir', 'écart', 'validation', 'invoice', 'detail', 'post', 'reject', 'reopen', 'variance'],
  },
  {
    id: 'accounting.customer-pos',
    module: 'accounting',
    path: '/accounting/customers/purchase-orders',
    permission: 'accounting.po.view',
    title: bi('Bons de commande clients', 'Customer purchase orders'),
    summary: bi(
      'Bons de commande reçus de vos clients par courriel, rapprochés des commandes client de Business Central, avec la liste des commandes BC.',
      'Purchase orders received from your customers by e-mail, matched with the sales orders in Business Central, with the BC order list.',
    ),
    tips: [
      bi('« Reçus par courriel » liste les bons traités depuis « Boîte de réception » › « Documents » › « Bons de commande ».', '“Received by e-mail” lists the orders processed from “Boîte de réception” › “Documents” › “Bons de commande”.'),
      bi('« Commandes clients dans Business Central » vient de la synchronisation : bouton « Synchroniser BC ».', '“Commandes clients dans Business Central” comes from the sync: use the “Sync BC” button.'),
      bi('Cliquez une ligne pour ouvrir le bon, voir le rapprochement et l’approuver.', 'Click a row to open the order, see the match and approve it.'),
      bi('Une fois approuvé, la facture client est créée dans BC ; son numéro apparaît dans la colonne « Facture BC ».', 'Once approved, the sales invoice is created in BC; its number appears in the “BC invoice” column.'),
    ],
    howTo: [
      {
        q: bi('Comment approuver un bon de commande client ?', 'How do I approve a customer purchase order?'),
        a: bi(
          'Ouvrez le bon, vérifiez le rapprochement, puis cliquez « Approuver et créer la facture ». Il faut « Approuver / rejeter les bons de commande ». S’il reste des exceptions, une justification écrite est exigée.',
          'Open the order, check the match, then click “Approve & create invoice”. You need “Approve / reject purchase orders”. If exceptions remain, a written justification is required.',
        ),
      },
    ],
    keywords: ['bons de commande clients', 'BC client', 'commande client', 'entrant', 'customer purchase orders', 'sales orders', 'incoming'],
  },
  {
    id: 'accounting.customer-invoices',
    module: 'accounting',
    path: '/accounting/customers/invoices',
    permission: 'accounting.po.view',
    title: bi('Factures clients', 'Customer invoices'),
    summary: bi(
      'Factures de vente créées dans Business Central et synchronisées ici pour consultation, avec leur statut BC.',
      'Sales invoices created in Business Central and synced here for viewing, with their BC status.',
    ),
    tips: [
      bi('Les onglets « Toutes », « Brouillons », « Ouvertes » et « Payées » filtrent par statut BC.', 'The “Toutes”, “Brouillons”, “Ouvertes” and “Payées” tabs filter by BC status.'),
      bi('La zone « Rechercher… » filtre la liste.', 'The “Rechercher…” box filters the list.'),
      bi('« Synchroniser BC » met la liste à jour depuis Business Central.', '“Sync BC” updates the list from Business Central.'),
      bi('Pour voir les montants à recevoir par échéance, ouvrez plutôt « À recevoir ».', 'To see amounts to collect by due date, open “To collect” instead.'),
    ],
    howTo: [
      {
        q: bi('Comment voir les factures non encaissées ?', 'How do I see unpaid invoices?'),
        a: bi('Ouvrez « À recevoir » dans le menu Entrant [Incoming], ou choisissez l’onglet « Ouvertes » ici.', 'Open “To collect” in the Entrant [Incoming] menu, or choose the “Open” tab here.'),
      },
    ],
    keywords: ['factures clients', 'facture client', 'business central', 'payées', 'ouvertes', 'customer invoices', 'sales invoices', 'paid', 'open'],
  },
  {
    id: 'accounting.receivables',
    module: 'accounting',
    path: '/accounting/customers/receivables',
    permission: 'accounting.payables.view',
    title: bi('À recevoir', 'To collect'),
    summary: bi(
      'Factures clients comptabilisées dans Business Central et non encaissées, avec leurs totaux et leurs échéances.',
      'Customer invoices posted in Business Central and not yet collected, with totals and due dates.',
    ),
    tips: [
      bi('Les cartes donnent le total à recevoir, le montant en retard, le montant échéant dans 7 jours et les brouillons BC.', 'The cards show the total to collect, the overdue amount, the amount due within 7 days and the BC drafts.'),
      bi('Les onglets « En retard », « 7 jours », « 30 jours » et « Plus tard » filtrent par échéance.', 'The “En retard”, “7 jours”, “30 jours” and “Plus tard” tabs filter by due date.'),
      bi('Un encaissement saisi dans BC disparaît d’ici à la prochaine synchronisation.', 'A payment entered in BC disappears from here at the next sync.'),
      bi('Cliquez « Synchroniser BC » pour récupérer les factures.', 'Click “Sync BC” to fetch the invoices.'),
    ],
    howTo: [
      {
        q: bi('Comment voir ce qui est en retard ?', 'How do I see what is overdue?'),
        a: bi('Choisissez l’onglet « En retard ». Les jours de retard s’affichent dans chaque ligne.', 'Choose the “En retard” tab. The days overdue show on each row.'),
      },
    ],
    keywords: ['à recevoir', 'encaissement', 'créances', 'clients', 'retard', 'échéance', 'receivables', 'to collect', 'overdue', 'due'],
  },
  {
    id: 'accounting.vendor-pos',
    module: 'accounting',
    path: '/accounting/purchase-orders',
    permission: 'accounting.po.view',
    title: bi('Bons de commande fournisseurs', 'Vendor purchase orders'),
    summary: bi(
      'Confirmations de nos commandes reçues par courriel de nos fournisseurs, rapprochées des bons de commande de Business Central.',
      'Confirmations of our orders received by e-mail from vendors, matched with the purchase orders in Business Central.',
    ),
    tips: [
      bi('« Reçus par courriel » liste les confirmations traitées depuis « Documents » › « Bons de commande ».', '“Received by e-mail” lists the confirmations processed from “Documents” › “Bons de commande”.'),
      bi('« Bons de commande dans Business Central » vient de la synchronisation : bouton « Synchroniser BC ».', '“Bons de commande dans Business Central” comes from the sync: use the “Sync BC” button.'),
      bi('Cliquez une ligne pour voir le rapprochement et les lignes.', 'Click a row to see the match and the lines.'),
    ],
    howTo: [
      {
        q: bi('Comment confirmer une confirmation de fournisseur ?', 'How do I confirm a vendor confirmation?'),
        a: bi(
          'Ouvrez le bon, vérifiez le rapprochement, puis cliquez « Confirmer ». Il faut « Approuver / rejeter les bons de commande ».',
          'Open the order, check the match, then click “Confirm”. You need “Approve / reject purchase orders”.',
        ),
      },
    ],
    keywords: ['bons de commande fournisseurs', 'confirmation', 'commande fournisseur', 'sortant', 'vendor purchase orders', 'vendor confirmation', 'outgoing'],
  },
  {
    id: 'accounting.payables',
    module: 'accounting',
    path: '/accounting/payables',
    permission: 'accounting.payables.view',
    title: bi('À payer', 'To pay'),
    summary: bi(
      'Factures fournisseurs comptabilisées dans Business Central et non payées, avec leurs totaux et leurs échéances.',
      'Vendor invoices posted in Business Central and not yet paid, with totals and due dates.',
    ),
    tips: [
      bi('Les cartes donnent le total à payer, le montant en retard, le montant échéant dans 7 jours et les brouillons non comptabilisés dans BC.', 'The cards show the total to pay, the overdue amount, the amount due within 7 days and the drafts not yet posted in BC.'),
      bi('Les onglets « En retard », « 7 jours », « 30 jours » et « Plus tard » filtrent par échéance.', 'The “En retard”, “7 jours”, “30 jours” and “Plus tard” tabs filter by due date.'),
      bi('Un paiement saisi dans BC disparaît d’ici à la prochaine synchronisation.', 'A payment entered in BC disappears from here at the next sync.'),
      bi('Cliquez « Synchroniser BC » pour récupérer les factures.', 'Click “Sync BC” to fetch the invoices.'),
    ],
    howTo: [
      {
        q: bi('Comment voir ce que je dois payer cette semaine ?', 'How do I see what I owe this week?'),
        a: bi('Choisissez l’onglet « 7 jours » pour les factures échéant dans la semaine, ou « En retard » pour celles déjà dues.', 'Choose the “7 jours” tab for invoices due this week, or “En retard” for those already due.'),
      },
    ],
    keywords: ['à payer', 'fournisseurs', 'dettes', 'échéance', 'paiement', 'payables', 'to pay', 'vendors', 'due', 'overdue'],
  },
  {
    id: 'accounting.po',
    module: 'accounting',
    path: '/accounting/po/:id',
    permission: 'accounting.po.view',
    title: bi('Bon de commande (détail)', 'Purchase order (detail)'),
    summary: bi(
      'Détail d’un bon de commande, client ou fournisseur : document, rapprochement avec Business Central, lignes et approbation.',
      'Purchase order detail, customer or vendor: document, match with Business Central, lines and approval.',
    ),
    tips: [
      bi('« Rapprocher » relance la comparaison avec Business Central.', '“Match” runs the comparison with Business Central again.'),
      bi('« Corriger » modifie les champs et les lignes ; « Enregistrer » rapproche ensuite le bon à nouveau.', '“Edit” changes the fields and lines; “Save” then matches the order again.'),
      bi('Des exceptions bloquent l’approbation. Corrigez le document, ou approuvez avec une justification écrite si vous avez la permission « Déroger aux exceptions ».', 'Exceptions block approval. Correct the document, or approve with a written justification if you have the “Override exceptions” permission.'),
      bi('Un bon déjà facturé, confirmé ou rejeté est verrouillé.', 'An order already invoiced, confirmed or rejected is locked.'),
    ],
    howTo: [
      {
        q: bi('Comment approuver un bon de commande ?', 'How do I approve a purchase order?'),
        a: bi(
          'Cliquez « Approuver et créer la facture » pour un bon client, ou « Confirmer » pour un bon fournisseur, puis confirmez dans la fenêtre. Le bouton est désactivé si le rapprochement n’est pas fait ou s’il reste des exceptions sans dérogation.',
          'Click “Approve & create invoice” for a customer order, or “Confirm” for a vendor order, then confirm in the window. The button is disabled if the match is not done or exceptions remain without an override.',
        ),
      },
      {
        q: bi('Comment rejeter ou rouvrir un bon ?', 'How do I reject or reopen an order?'),
        a: bi('Pour rejeter, cliquez « Rejeter », indiquez le motif, puis « Rejeter ». Sur un bon rejeté, « Rouvrir » le reprend.', 'To reject, click “Reject”, give the reason, then “Rejeter”. On a rejected order, “Reopen” picks it up again.'),
      },
    ],
    keywords: ['bon de commande', 'PO', 'rapprochement', 'approuver', 'confirmer', 'rejeter', 'purchase order', 'match', 'approve', 'confirm'],
  },
  {
    id: 'accounting.settings',
    module: 'accounting',
    path: '/accounting/settings',
    permission: 'accounting.settings',
    title: bi('Paramètres de comptabilité', 'Accounting settings'),
    summary: bi(
      'Réglages du module : mode d’approbation, adresse de la boîte surveillée et tolérances de rapprochement avec Business Central.',
      'Module settings: approval mode, monitored mailbox address and matching tolerances with Business Central.',
    ),
    tips: [
      bi('« Manuel » : chaque document est traité et approuvé par une personne.', '“Manual”: every document is processed and approved by a person.'),
      bi('« Assisté (recommandé) »: les courriels sont classés, lus et rapprochés automatiquement ; une personne approuve avant toute création dans BC.', '“Assisted”: e-mails are classified, read and matched automatically; a person approves before anything is created in BC.'),
      bi('« Automatique » : comme « Assisté », mais les rapprochements parfaits (aucun écart) sont approuvés et créés dans BC sans intervention. Tout écart attend une personne.', '“Automatic”: like “Assisté”, but perfect matches (no variance) are approved and created in BC without anyone. Any variance waits for a person.'),
      bi('Les tolérances (écart de prix en %, écart de quantité, écart de total en $) fixent les écarts acceptés.', 'The tolerances (price variance in %, quantity variance, total variance in $) set the accepted differences.'),
      bi('« Exécuter maintenant » lance tout de suite le traitement automatique ; il est inactif en mode « Manuel ».', '“Run now” starts the automatic processing immediately; it is inactive in “Manuel” mode.'),
    ],
    howTo: [
      {
        q: bi('Comment changer le mode d’approbation ?', 'How do I change the approval mode?'),
        a: bi('Sélectionnez le mode voulu sous « Mode d’approbation », puis cliquez « Enregistrer ».', 'Select the wanted mode under “Approval mode”, then click “Save”.'),
      },
      {
        q: bi('Comment fixer une limite au mode automatique ?', 'How do I set a limit for automatic mode?'),
        a: bi(
          'En mode « Automatique », renseignez « Montant maximum approuvé automatiquement » (0 = sans limite), puis « Enregistrer ». Au-dessus de ce montant, un document attend toujours une personne.',
          'In “Automatique” mode, fill in “Montant maximum approuvé automatiquement” (0 = no limit), then “Enregistrer”. Above that amount, a document always waits for a person.',
        ),
      },
    ],
    keywords: ['paramètres', 'comptabilité', 'approbation', 'automatique', 'manuel', 'assisté', 'tolérance', 'boîte', 'settings', 'approval', 'automatic', 'manual', 'assisted', 'tolerance'],
  },

  /* ------------------------------------------------------------------ estimating */
  {
    id: 'estimating.overview',
    module: 'estimating',
    path: '/estimating',
    permission: 'estimating.access',
    title: bi('Estimation : aperçu', 'Estimating: overview'),
    summary: bi(
      'Tableau de bord de l’estimation d’emballages : estimations à réviser, à chiffrer, soumises en attente, acceptées et taux de succès.',
      'Packaging estimating dashboard: estimates to review, to cost, awaiting the customer, won and the win rate.',
    ),
    tips: [
      bi('Les chiffres « À réviser », « À chiffrer » et « Soumises en attente » ouvrent la liste filtrée.', 'The “À réviser”, “À chiffrer” and “Soumises en attente” figures open the filtered list.'),
      bi('« Métamorphose des estimations » montre où en sont les estimations.', '“Métamorphose des estimations” shows where the estimates stand.'),
      bi('« Voir les révisions » ouvre les estimations qui attendent une révision.', '“View reviews” opens the estimates waiting for a review.'),
      bi('« Nouvelle estimation » n’apparaît que si vous avez la permission « Créer / modifier des estimations ».', '“New estimate” only appears if you have “Créer / modifier des estimations”.'),
    ],
    howTo: [
      {
        q: bi('Comment créer une estimation ?', 'How do I create an estimate?'),
        a: bi('Cliquez « Nouvelle estimation », remplissez le client et le projet, puis « Enregistrer ». Le client et le projet sont obligatoires.', 'Click “New estimate”, fill in the customer and the project, then “Save”. Customer and project are required.'),
      },
    ],
    keywords: ['estimation', 'chiffrage', 'aperçu', 'emballage', 'estimating', 'estimates', 'overview', 'packaging', 'win rate', 'taux de succès'],
  },
  {
    id: 'estimating.list',
    module: 'estimating',
    path: '/estimating/list',
    permission: 'estimating.access',
    title: bi('Estimations', 'Estimates'),
    summary: bi(
      'Liste de toutes les estimations, filtrable par statut et recherchable par numéro, client ou projet.',
      'List of all estimates, filterable by status and searchable by number, customer or project.',
    ),
    tips: [
      bi('Les filtres de statut (Toutes, À chiffrer, À réviser, Soumise…) affichent le nombre d’estimations dans chacun.', 'The status filters (Toutes, À chiffrer, À réviser, Soumise…) show how many estimates each holds.'),
      bi('La colonne « Métamorphose » montre l’avancement de chaque estimation.', 'The “Métamorphose” column shows how far each estimate has progressed.'),
      bi('Les colonnes indiquent le client et le projet, l’emballage, les quantités, l’échéance, le responsable et le statut.', 'The columns show customer and project, packaging, quantities, due date, owner and status.'),
      bi('Cliquez une ligne pour ouvrir l’estimation.', 'Click a row to open the estimate.'),
    ],
    howTo: [
      {
        q: bi('Comment voir seulement les estimations à réviser ?', 'How do I see only the estimates to review?'),
        a: bi('Cliquez le filtre « À réviser » au-dessus du tableau. Le lien « Voir les révisions » du tableau de bord ouvre la même liste.', 'Click the “À réviser” filter above the table. The “Voir les révisions” link on the dashboard opens the same list.'),
      },
    ],
    keywords: ['estimations', 'liste', 'filtre', 'statut', 'recherche', 'estimates', 'list', 'filter', 'status', 'search'],
  },
  {
    id: 'estimating.new',
    module: 'estimating',
    path: '/estimating/new',
    permission: 'estimating.edit',
    title: bi('Nouvelle estimation', 'New estimate'),
    summary: bi(
      'Ouvre une fiche d’estimation vide. Renseignez le client et le projet, puis enregistrez : la fiche reçoit alors son numéro.',
      'Opens an empty estimate sheet. Fill in the customer and the project, then save: the sheet then gets its number.',
    ),
    tips: [
      bi('Le client et le projet sont obligatoires avant l’enregistrement.', 'Customer and project are required before saving.'),
      bi('Une photo de la boîte peut être analysée par l’IA (« Analyser la photo »), qui propose des valeurs à accepter une à une. Cette analyse demande le serveur Imago ; en mode démo, saisissez les valeurs à la main.', 'A photo of the box can be analysed by AI (“Analyse photo”), which suggests values to accept one by one. This needs the Imago server; in demo mode, enter the values by hand.'),
      bi('Les quantités se règlent dans la section « Quantités et prix », à l’onglet Prix.', 'Quantities are set in the “Quantities & price” section, on the Prix tab.'),
      bi('Le titre affiche « Nouvelle estimation » ou « Sans titre » tant que la fiche n’est pas enregistrée.', 'The heading shows “Nouvelle estimation” or “Sans titre” until the sheet is saved.'),
    ],
    howTo: [
      {
        q: bi('Comment enregistrer la nouvelle estimation ?', 'How do I save the new estimate?'),
        a: bi('Cliquez « Enregistrer » en haut. La fiche s’ouvre ensuite avec son numéro d’estimation.', 'Click “Save” at the top. The sheet then reopens with its estimate number.'),
      },
      {
        q: bi('Comment passer au chiffrage ?', 'How do I start costing?'),
        a: bi('Une fois la fiche enregistrée, cliquez « Commencer le chiffrage ».', 'Once the sheet is saved, click “Start costing”.'),
      },
    ],
    keywords: ['nouvelle estimation', 'créer', 'ajouter', 'estimation', 'new estimate', 'create', 'add', 'photo', 'analyse'],
  },
  {
    id: 'estimating.materials',
    module: 'estimating',
    path: '/estimating/materials',
    permission: 'estimating.access',
    title: bi('Matériaux et tarifs', 'Materials & rates'),
    summary: bi(
      'Catalogue des matériaux (cartons, ondulé, rigide, plastique) avec leur coût indicatif par m², utilisé dans le chiffrage.',
      'Catalogue of materials (boards, corrugated, rigid, plastic) with their indicative cost per m², used in costing.',
    ),
    tips: [
      bi('Le bouton « Matériau » ajoute un matériau. Les icônes crayon et corbeille modifient ou suppriment une ligne.', 'The “Material” button adds a material. The pencil and bin icons edit or delete a row.'),
      bi('Ajouter, modifier et supprimer demandent la permission « Gérer les matériaux et tarifs ». Sans elle, vous ne voyez que la liste.', 'Adding, editing and deleting need “Manage materials & rates”. Without it, you only see the list.'),
      bi('Si une feuille n’a pas de format saisi, « Réglage par défaut » s’applique.', 'If a sheet has no size entered, “Default setting” applies.'),
      bi('Le code et le nom sont obligatoires.', 'Code and name are required.'),
    ],
    howTo: [
      {
        q: bi('Comment ajouter un matériau ?', 'How do I add a material?'),
        a: bi('Cliquez « Matériau », remplissez le code, le nom, la catégorie et le coût par m², puis « Enregistrer ».', 'Click “Material”, fill in the code, name, category and cost per m², then “Save”.'),
      },
    ],
    keywords: ['matériaux', 'carton', 'ondulé', 'coût', 'm²', 'feuille', 'tarifs', 'materials', 'board', 'corrugated', 'cost', 'rates'],
  },
  {
    id: 'estimating.settings',
    module: 'estimating',
    path: '/estimating/settings',
    permission: 'estimating.settings',
    title: bi('Paramètres de chiffrage', 'Costing settings'),
    summary: bi(
      'Paramètres qui servent au calcul des prix : entreprise, devise, feuilles, presses, découpe, finitions, main-d’œuvre, frais et marges. L’« Assistant de configuration » guide la saisie étape par étape.',
      'Settings used to calculate prices: company, currency, sheets, presses, die-cutting, finishing, labour, overhead and margins. The “Setup assistant” guides the entry step by step.',
    ),
    tips: [
      bi('L’« Assistant de configuration » parcourt huit groupes : entreprise et devise, cartons et feuilles, impression, découpe et outillage, finitions, collage et emballage, frais généraux et transport, politique de marge.', 'The “Setup assistant” goes through eight groups: company and currency, boards and sheets, printing, die-cutting and tooling, finishing, gluing and packing, overhead and freight, margin policy.'),
      bi('« État des groupes de coûts » indique pour chaque groupe s’il est « Confirmé » ou encore « À valider ».', '“Cost group status” shows for each group whether it is “Confirmed” or still “To validate”.'),
      bi('« Paramètres avancés » affiche tous les champs de calcul : presses, gâche, marges par quantité et par type de produit.', '“Advanced settings” shows every calculation field: presses, waste, margins by quantity and by product type.'),
      bi('Les valeurs « héritées » ne sont plus utilisées par le modèle actuel.', 'The “legacy” values are no longer used by the current model.'),
      bi('« Enregistrer » sauvegarde les changements faits sur cette page.', '“Save” stores the changes made on this page.'),
    ],
    howTo: [
      {
        q: bi('Comment lancer l’assistant de configuration ?', 'How do I run the setup assistant?'),
        a: bi('Cliquez « Assistant de configuration », parcourez les étapes avec « Suivant » et « Précédent », puis cliquez « Terminer ».', 'Click “Setup assistant”, go through the steps with “Next” and “Back”, then click “Finish”.'),
      },
      {
        q: bi('Comment confirmer un groupe de coûts ?', 'How do I confirm a cost group?'),
        a: bi('Dans « État des groupes de coûts », choisissez « Confirmé » dans la liste du groupe, puis enregistrez.', 'In “Cost group status”, choose “Confirmed” in the group’s list, then save.'),
      },
    ],
    keywords: ['paramètres', 'chiffrage', 'marge', 'presse', 'découpe', 'finition', 'assistant', 'configuration', 'settings', 'costing', 'margin', 'press', 'setup', 'wizard'],
  },
  {
    id: 'estimating.editor',
    module: 'estimating',
    path: '/estimating/:id',
    permission: 'estimating.access',
    title: bi('Fiche d’estimation', 'Estimate sheet'),
    summary: bi(
      'Fiche d’une estimation : spécifications de l’emballage, plan, prix par quantité, rapport et historique, avec les actions du cycle (chiffrage, révision, approbation, envoi au client).',
      'An estimate sheet: packaging specifications, blueprint, price by quantity, report and history, with the cycle actions (costing, review, approval, sending to the customer).',
    ),
    tips: [
      bi('Cinq onglets : Spécifications [Specs], Plan [Blueprint], Prix [Pricing], Rapport [Report] et Historique [History]. Le Plan affiche le gabarit, téléchargeable en SVG ; le Rapport explique comment le prix est obtenu.', 'Five tabs: Spécifications [Specs], Plan [Blueprint], Prix [Pricing], Rapport [Report] and Historique [History]. The Plan shows the blank, downloadable as SVG; the Rapport explains how the price was reached.'),
      bi('« Non enregistrée » apparaît quand il reste des modifications : pensez à « Enregistrer ».', '“Unsaved” appears when changes are pending: remember to click “Save”.'),
      bi('Les coûts et marges ne sont visibles qu’avec la permission « Voir les coûts et marges ».', 'Costs and margins are only visible with the “View costs and margins” permission.'),
      bi('Une estimation construite automatiquement depuis une demande de vente affiche ses hypothèses : vérifiez-les avant d’approuver.', 'An estimate built automatically from a sales request shows its assumptions: check them before approving.'),
      bi('Une estimation approuvée, soumise, acceptée ou refusée ne se modifie plus.', 'An estimate that is approved, sent, won or lost can no longer be edited.'),
      bi('« Soumission PDF » est désactivé : cette fonction n’est pas encore disponible.', '“Quote PDF” is disabled: this feature is not available yet.'),
    ],
    howTo: [
      {
        q: bi('Comment envoyer une estimation en révision ?', 'How do I send an estimate for review?'),
        a: bi('Quand le chiffrage est terminé, cliquez « Marquer prêt pour révision ».', 'When costing is done, click “Mark ready for review”.'),
      },
      {
        q: bi('Comment approuver une estimation ?', 'How do I approve an estimate?'),
        a: bi(
          'Un approbateur (permission « Soumettre et conclure ») clique « Approuver et renvoyer aux ventes ». Pour la renvoyer au chiffrage, « Renvoyer en révision (note requise) » demande une note.',
          'An approver (“Send and close” permission) clicks “Approve and return to sales”. To send it back to costing, “Send back to revision” asks for a note.',
        ),
      },
      {
        q: bi('Comment marquer une estimation acceptée ou refusée ?', 'How do I mark an estimate won or lost?'),
        a: bi('Après « Marquer soumise au client », cliquez « Acceptée » ou « Refusée ».', 'After “Mark sent to customer”, click “Won” or “Lost”.'),
      },
      {
        q: bi('Comment demander l’avis du studio ?', 'How do I ask the studio?'),
        a: bi(
          'Sur une estimation liée à une demande de vente, cliquez « Demander le studio », décrivez le travail, puis « Envoyer la demande ».',
          'On an estimate linked to a sales request, click “Ask the studio”, describe the work, then “Send request”.',
        ),
      },
    ],
    keywords: ['fiche', 'estimation', 'spécifications', 'plan', 'prix', 'rapport', 'historique', 'approuver', 'révision', 'studio', 'estimate', 'specs', 'blueprint', 'pricing', 'report', 'history', 'approve', 'review'],
  },

  /* ------------------------------------------------------------------ sales */
  {
    id: 'sales.tracker',
    module: 'sales',
    path: '/sales',
    permission: 'sales.access',
    title: bi('Suivi des demandes', 'Request tracker'),
    summary: bi(
      'Le suivi montre le circuit de chaque demande de vente, de la réception jusqu’à la production, avec les blocages et les suivis en retard. Un clic sur une demande affiche son détail dans le même écran.',
      'The tracker shows the circuit of each sales request, from receipt to production, with blockers and overdue follow-ups. Clicking a request shows its detail on the same screen.',
    ),
    tips: [
      bi('« Toutes » ou « Mes demandes » filtre par responsable ; « Bloquées seulement » ne garde que les demandes bloquées.', '“All” or “My requests” filters by owner; “Blocked only” keeps only blocked requests.'),
      bi('Le champ « Taper un numéro de demande ou un client » trouve une demande et l’ouvre (Entrée).', 'The “Taper un numéro de demande ou un client” box finds a request and opens it (Enter).'),
      bi('La légende explique les couleurs : étape franchie, à venir, changements demandés par le client.', 'The legend explains the colours: completed stage, to come, changes requested by the customer.'),
      bi('« Demandes bloquées » liste celles qui attendent quelque chose : client, studio, information ou décision interne.', '“Blocked requests” lists those waiting for something: the customer, the studio, information or an internal decision.'),
      bi('Le détail d’une demande s’affiche aussi quand l’adresse contient « ?r= » ; « Tous les parcours » revient au circuit.', 'A request’s detail also shows when the address contains “?r=”; “All journeys” goes back to the circuit.'),
    ],
    howTo: [
      {
        q: bi('Comment créer une demande ?', 'How do I create a request?'),
        a: bi('Cliquez « Nouvelle demande ». Ce bouton exige « Créer et modifier les demandes, notes et blocages ».', 'Click “New request”. This needs “Créer et modifier les demandes, notes et blocages”.'),
      },
      {
        q: bi('Comment ouvrir une demande précise ?', 'How do I open a specific request?'),
        a: bi('Cliquez-la dans le circuit, ou tapez son numéro ou le client dans la recherche « Taper un numéro de demande ou un client ».', 'Click it in the circuit, or type its number or the customer in the “Taper un numéro de demande ou un client” box.'),
      },
    ],
    keywords: ['ventes', 'suivi', 'demandes', 'circuit', 'tracker', 'blocage', 'bloquée', 'sales', 'tracking', 'requests', 'blocked'],
  },
  {
    id: 'sales.requests',
    module: 'sales',
    path: '/sales/requests',
    permission: 'sales.access',
    title: bi('Demandes', 'Requests'),
    summary: bi(
      'Liste de toutes les demandes de vente, avec un filtre par étape, une recherche et un tri par colonne.',
      'List of all sales requests, with a stage filter, search and sorting by column.',
    ),
    tips: [
      bi('Le menu « Étape » filtre sur Ouvertes [Open], Toutes [All] ou une étape précise.', 'The “Stage” menu filters on Ouvertes [Open], Toutes [All] or one specific stage.'),
      bi('« Mes demandes » et « Bloquées » filtrent la liste à leur tour.', '“My requests” and “Blocked” filter the list too.'),
      bi('Cliquez un en-tête de colonne pour trier. Chaque ligne ouvre le détail de la demande.', 'Click a column header to sort. Each row opens the request’s detail.'),
      bi('Les demandes closes n’apparaissent pas dans « Ouvertes » ; choisissez « Toutes » pour tout voir.', 'Closed requests do not appear under “Ouvertes”; choose “Toutes” to see everything.'),
    ],
    howTo: [
      {
        q: bi('Comment prendre en charge une demande ?', 'How do I claim a request?'),
        a: bi('Dans la colonne « Responsable », cliquez « Prendre » sur une demande non assignée. Ce bouton exige « Créer et modifier les demandes, notes et blocages ».', 'In the “Owner” column, click “Claim” on an unassigned request. This needs “Créer et modifier les demandes, notes et blocages”.'),
      },
    ],
    keywords: ['demandes', 'liste', 'filtre', 'étape', 'prendre', 'trier', 'requests', 'list', 'filter', 'stage', 'claim', 'sort'],
  },
  {
    id: 'sales.new-request',
    module: 'sales',
    path: '/sales/requests/new',
    permission: 'sales.edit',
    title: bi('Nouvelle demande', 'New request'),
    summary: bi(
      'Crée une demande de vente à partir d’un formulaire, d’un courriel collé ou d’une photo ou d’un dessin. L’IA lit le contenu et prépare une première estimation.',
      'Creates a sales request from a form, a pasted e-mail or a photo or drawing. The AI reads the content and prepares a first estimate.',
    ),
    tips: [
      bi('Trois onglets : « Formulaire », « Courriel » et « Photo / dessin ».', 'Three tabs: “Form”, “E-mail” and “Photo / drawing”.'),
      bi('Dans « Courriel », collez le texte tel quel et joignez les images ou PDF utiles (4 Mo maximum chacun).', 'In “E-mail”, paste the text as it is and attach useful images or PDFs (4 MB maximum each).'),
      bi('Dans « Photo / dessin », ajoutez une photo ou un dessin et une courte description de ce qu’on veut.', 'In “Photo / drawing”, add a photo or drawing and a short description of what is wanted.'),
      bi('Pendant « Lecture par l’IA… », ne quittez pas la page ; cela prend quelques secondes.', 'While “AI reading…” shows, do not leave the page; it takes a few seconds.'),
    ],
    howTo: [
      {
        q: bi('Comment créer une demande à partir d’un courriel ?', 'How do I create a request from an e-mail?'),
        a: bi(
          '1. Ouvrez l’onglet « Courriel ». 2. Collez « De », « Objet » et le « Texte du courriel ». 3. Ajoutez les pièces jointes. 4. Cliquez « Créer la demande ».',
          '1. Open the “E-mail” tab. 2. Paste “From”, “Subject” and the “E-mail text”. 3. Add the attachments. 4. Click “Create request”.',
        ),
      },
      {
        q: bi('Où retrouver la demande créée ?', 'Where do I find the request I created?'),
        a: bi('Elle apparaît dans le « Suivi », à l’étape « Demande reçue ».', 'It appears in the “Tracker”, at the “Request received” stage.'),
      },
    ],
    keywords: ['nouvelle demande', 'créer', 'courriel', 'photo', 'dessin', 'formulaire', 'IA', 'new request', 'create', 'e-mail', 'drawing', 'form', 'AI'],
  },
  {
    id: 'sales.request',
    module: 'sales',
    path: '/sales/requests/:id',
    permission: 'sales.access',
    title: bi('Détail d’une demande', 'Request detail'),
    summary: bi(
      'Le parcours d’une demande : étape et actions, notes, suivis, blocage, studio, analyse IA, source, soumission et historique. L’adresse redirige vers le Suivi (« /sales?r= »), où ce détail s’affiche.',
      'The life of one request: stage and actions, notes, follow-ups, blocker, studio, AI analysis, source, quote and history. The address redirects to the tracker (“/sales?r=”), where this detail shows.',
    ),
    tips: [
      bi('Les boutons d’action dépendent de l’étape : par exemple « Lancer l’estimation », « Marquer prêt pour révision » ou « Envoyer la soumission ».', 'The action buttons depend on the stage: for example “Start estimating”, “Mark ready for review” or “Send the quote”.'),
      bi('« Refuser / perdue » demande toujours une raison.', '“Decline / lost” always asks for a reason.'),
      bi('« Notes » gardent l’historique ; « Suivis » ont une date et se cochent quand ils sont faits.', '“Notes” keep a record; “Follow-ups” have a date and can be ticked when done.'),
      bi('« Blocage » indique ce qui retient la demande : client, studio, information, décision interne ou autre.', '“Blocker” states what holds the request: customer, studio, information, internal decision or other.'),
      bi('« Historique » liste chaque changement d’étape avec son auteur.', '“History” lists each stage change with its author.'),
    ],
    howTo: [
      {
        q: bi('Comment envoyer la soumission au client ?', 'How do I send the quote to the customer?'),
        a: bi(
          'À l’étape « Soumission prête », cliquez « Envoyer la soumission ». Ce bouton exige « Envoyer les soumissions et passer en production ». Fixez la validité en jours, puis « Envoyer au client ».',
          'At the “Quote ready” stage, click “Send the quote”. This needs “Send quotes and move to production”. Set the validity in days, then “Send to customer”.',
        ),
      },
      {
        q: bi('Comment bloquer une demande ?', 'How do I block a request?'),
        a: bi('Dans la carte « Blocage », choisissez la raison, ajoutez des précisions, puis « Bloquer la demande ». Pour la débloquer, « Lever le blocage ».', 'In the “Blocker” card, choose the reason, add details, then “Block request”. To clear it, “Clear blocker”.'),
      },
      {
        q: bi('Que faire quand le client demande des changements ?', 'What do I do when the customer asks for changes?'),
        a: bi('À l’étape « Chez le client », cliquez « Changements demandés » et écrivez la note : la demande revient à l’estimation.', 'At the “With customer” stage, click “Changes requested” and write the note: the request goes back to estimating.'),
      },
    ],
    keywords: ['détail', 'demande', 'notes', 'suivis', 'blocage', 'studio', 'soumission', 'historique', 'refuser', 'request', 'detail', 'follow-ups', 'blocker', 'quote', 'history', 'decline'],
  },
  {
    id: 'sales.public-form',
    module: 'sales',
    path: '/sales/form',
    permission: 'sales.settings',
    title: bi('Formulaire public et boîte courriel', 'Public form and mailbox'),
    summary: bi(
      'Réglages du formulaire public que les clients remplissent pour demander un emballage, et de la boîte courriel des ventes dont les messages deviennent des demandes.',
      'Settings for the public form customers fill in to ask for packaging, and for the sales mailbox whose messages become requests.',
    ),
    tips: [
      bi('« Copier le lien » donne l’adresse du formulaire à partager. Chaque envoi crée une demande.', '“Copy link” gives the form address to share. Each submission creates a request.'),
      bi('La section « Questions du formulaire » contient les champs posés aux clients.', 'The “Form questions” section holds the fields asked of customers.'),
      bi('« Boîte courriel » indique si la lecture est « Activée » et quand a eu lieu la dernière synchronisation.', '“Mailbox” shows whether reading is “Activée” and when the last sync happened.'),
      bi('Les clients n’ont pas besoin de compte : la page publique s’ouvre par le lien.', 'Customers do not need an account: the public page opens from the link.'),
    ],
    howTo: [
      {
        q: bi('Comment partager le formulaire ?', 'How do I share the form?'),
        a: bi('Cliquez « Copier le lien », puis envoyez l’adresse au client.', 'Click “Copy link”, then send the address to the customer.'),
      },
      {
        q: bi('Comment vérifier que les courriels sont lus ?', 'How do I check that e-mails are being read?'),
        a: bi('Dans « Boîte courriel », le badge « Lecture » doit indiquer « Activée ». Cliquez « Synchroniser la boîte courriel » pour récupérer les messages reçus.', 'In “Mailbox”, the “Reading” badge should say “On”. Click “Sync mailbox” to fetch the messages received.'),
      },
    ],
    keywords: ['formulaire public', 'lien', 'boîte courriel', 'synchroniser', 'questions', 'public form', 'link', 'mailbox', 'sync'],
  },
  {
    id: 'sales.public-request',
    module: 'sales',
    path: '/request',
    permission: 'sales.access',
    title: bi('Demande de soumission (page client)', 'Request a quote (customer page)'),
    summary: bi(
      'Page publique où un client décrit son projet d’emballage et joint des fichiers. Aucune connexion n’est requise ; un numéro de référence est donné après l’envoi.',
      'Public page where a customer describes a packaging project and attaches files. No sign-in is needed; a reference number is given after sending.',
    ),
    tips: [
      bi('Les champs obligatoires sont marqués d’un astérisque (*). Les erreurs s’affichent sous le champ concerné.', 'Required fields are marked with an asterisk (*). Errors show under the relevant field.'),
      bi('Vous pouvez joindre jusqu’à 5 fichiers : images ou PDF, 4 Mo chacun.', 'You can attach up to 5 files: images or PDFs, 4 MB each.'),
      bi('Attendez la fin du téléversement (« Téléversé ») avant d’envoyer.', 'Wait for the upload to finish (“Uploaded”) before sending.'),
      bi('Notez le numéro de référence affiché après l’envoi.', 'Note the reference number shown after sending.'),
      bi('Si le message « Trop de demandes » apparaît, réessayez dans quelques minutes.', 'If “Too many requests” appears, try again in a few minutes.'),
    ],
    howTo: [
      {
        q: bi('Comment envoyer ma demande ?', 'How do I send my request?'),
        a: bi('Remplissez les champs obligatoires, joignez vos fichiers si vous en avez, puis cliquez « Envoyer la demande ».', 'Fill in the required fields, attach your files if you have any, then click “Send request”.'),
      },
      {
        q: bi('Comment joindre un fichier ?', 'How do I attach a file?'),
        a: bi('Cliquez la zone de téléversement et choisissez une image ou un PDF. Attendez « Téléversé ».', 'Click the upload area and choose an image or a PDF. Wait for “Uploaded”.'),
      },
    ],
    keywords: ['demande de soumission', 'formulaire', 'client', 'public', 'fichier', 'envoyer', 'request a quote', 'customer', 'form', 'upload', 'send', 'reference'],
  },
  {
    id: 'sales.public-quote',
    module: 'sales',
    path: '/q/:id',
    permission: 'sales.access',
    title: bi('Soumission (page client)', 'Quote (customer page)'),
    summary: bi(
      'Page publique d’une soumission reçue par courriel : le client consulte les prix, puis approuve (avec signature), refuse ou demande des modifications. Le lien suffit, sans connexion.',
      'Public page of a quote received by e-mail: the customer reviews the prices, then approves (with a signature), declines or asks for changes. The link is enough; no sign-in.',
    ),
    tips: [
      bi('Les prix sont en dollars canadiens (CAD), taxes en sus.', 'Prices are in Canadian dollars (CAD), plus applicable taxes.'),
      bi('Après la date « Valide jusqu’au », la page indique que la soumission a expiré et invite à en demander une nouvelle.', 'After the “Valid until” date, the page says the quote has expired and invites you to request an updated one.'),
      bi('Si une version plus récente existe, la page vous le signale : consultez votre courriel.', 'If a newer version exists, the page tells you: check your e-mail.'),
      bi('Une réponse enregistrée affiche sa date sur la page.', 'Once a response is recorded, the page shows its date.'),
    ],
    howTo: [
      {
        q: bi('Comment approuver la soumission ?', 'How do I approve the quote?'),
        a: bi(
          'Cliquez « Approuver », choisissez la quantité, écrivez votre nom complet, signez à la souris ou au doigt, cochez « J’accepte cette soumission et ses conditions », puis « Confirmer mon approbation ».',
          'Click “Approve”, choose the quantity, type your full name, sign with mouse or finger, tick “J’accepte cette soumission et ses conditions”, then “Confirm my approval”.',
        ),
      },
      {
        q: bi('Comment demander des modifications ?', 'How do I ask for changes?'),
        a: bi('Cliquez « Demander des modifications », décrivez ce que vous voulez changer, puis « Envoyer la demande ».', 'Click “Request changes”, describe what you want changed, then “Send request”.'),
      },
    ],
    keywords: ['soumission', 'approuver', 'refuser', 'signature', 'prix', 'conditions', 'quote', 'approve', 'decline', 'prices', 'terms', 'expired'],
  },

  /* ------------------------------------------------------------------ workorders */
  {
    id: 'workorders.board',
    module: 'workorders',
    path: '/workorders',
    permission: 'workorders.access',
    title: bi('Ordres de travail : tableau', 'Work orders: board'),
    summary: bi(
      'Tableau des ordres de travail, en colonnes par statut : Nouveau, Planifié, En production, En pause, Terminé, Expédié. Un ordre est créé quand une soumission acceptée passe en production.',
      'Work order board, in columns by status: Nouveau, Planifié, En production, En pause, Terminé, Expédié. An order is created when an accepted quote goes to production.',
    ),
    tips: [
      bi('Les commandes en retard sont signalées en rouge.', 'Late orders are flagged in red.'),
      bi('Avec « Gérer les ordres », glissez une carte vers une autre colonne, ou utilisez « Déplacer vers » sur la carte.', 'With “Manage orders”, drag a card to another column, or use “Move to” on the card.'),
      bi('Cliquez le nom du client sur une carte pour ouvrir l’ordre.', 'Click the customer name on a card to open the order.'),
      bi('Chaque carte affiche le numéro, la quantité, le total, l’avancement des tâches et le responsable.', 'Each card shows the number, quantity, total, task progress and manager.'),
      bi('« Vue liste » affiche les mêmes ordres dans un tableau.', '“List view” shows the same orders in a table.'),
    ],
    howTo: [
      {
        q: bi('Comment changer le statut d’un ordre ?', 'How do I change an order’s status?'),
        a: bi('Glissez la carte dans la colonne voulue, ou choisissez le statut dans « Déplacer vers ». Il faut « Gérer les ordres (responsable, tâches, statuts) ».', 'Drag the card to the wanted column, or choose the status under “Move to”. You need “Manage orders”.'),
      },
    ],
    keywords: ['ordres de travail', 'tableau', 'production', 'kanban', 'statut', 'en retard', 'work orders', 'board', 'status', 'late'],
  },
  {
    id: 'workorders.list',
    module: 'workorders',
    path: '/workorders/list',
    permission: 'workorders.access',
    title: bi('Ordres de travail : liste', 'Work orders: list'),
    summary: bi(
      'Liste des ordres de travail en tableau, filtrable par statut (Toutes, Ouvertes, En retard ou un statut précis) et recherchable.',
      'List of work orders in a table, filterable by status (Toutes, Ouvertes, En retard or one specific status) and searchable.',
    ),
    tips: [
      bi('Les colonnes indiquent le client et le projet, la quantité, l’échéance, les tâches, le responsable, le statut et le total.', 'The columns show customer and project, quantity, due date, tasks, manager, status and total.'),
      bi('La recherche « No, client, projet… » filtre les lignes.', 'The “No., customer, project…” search filters the rows.'),
      bi('Cliquez une ligne pour ouvrir l’ordre.', 'Click a row to open the order.'),
    ],
    howTo: [
      {
        q: bi('Comment voir les ordres en retard ?', 'How do I see late orders?'),
        a: bi('Cliquez l’onglet « En retard » au-dessus du tableau.', 'Click the “Late” tab above the table.'),
      },
    ],
    keywords: ['liste', 'ordres de travail', 'filtre', 'en retard', 'recherche', 'list', 'work orders', 'filter', 'late', 'search'],
  },
  {
    id: 'workorders.detail',
    module: 'workorders',
    path: '/workorders/:id',
    permission: 'workorders.access',
    title: bi('Ordre de travail (détail)', 'Work order (detail)'),
    summary: bi(
      'Détail d’un ordre : tâches de production assignées aux services, avancement, notes de production, statut, responsable, échéance et historique, avec liens vers la demande de vente et l’estimation.',
      'Order detail: production tasks assigned to departments, progress, production notes, status, manager, due date and history, with links to the sales request and the estimate.',
    ),
    tips: [
      bi('« Ajouter les tâches standard » crée neuf étapes types : approbation de la prépresse, plaques, impression, découpe, finition, collage et assemblage, contrôle qualité, emballage, expédition.', '“Add standard tasks” creates nine standard steps: prepress approval, plates, printing, die-cutting, finishing, gluing and assembly, quality control, packing, shipping.'),
      bi('Sans « Gérer les ordres », vous ne modifiez que vos propres tâches (statut et notes) si « Travailler sur ses tâches » vous est accordé.', 'Without “Gérer les ordres”, you can only change your own tasks (status and notes) if you have “Travailler sur ses tâches”.'),
      bi('Le statut de l’ordre ne se change qu’avec « Gérer les ordres ».', 'The order status can only be changed with “Gérer les ordres”.'),
      bi('« Notes de production » et « Ajouter une note… » gardent les consignes et l’historique.', '“Notes de production” and “Ajouter une note…” keep the instructions and the history.'),
      bi('« Voir la demande de vente » et « Voir l’estimation » ouvrent les dossiers liés.', '“Voir la demande de vente” and “Voir l’estimation” open the linked records.'),
    ],
    howTo: [
      {
        q: bi('Comment ajouter une tâche ?', 'How do I add a task?'),
        a: bi('Cliquez « Ajouter une tâche » et remplissez le nom, le service, l’assigné et l’échéance. Il faut « Gérer les ordres ».', 'Click “Add task” and fill in the name, department, assignee and due date. You need “Gérer les ordres”.'),
      },
      {
        q: bi('Comment marquer une tâche comme faite ?', 'How do I mark a task as done?'),
        a: bi('Dans la tâche, changez le « Statut » : À faire, En cours, Fait ou Bloqué. Le changement est enregistré aussitôt.', 'In the task, change “Status”: À faire, En cours, Fait or Bloqué. The change is saved right away.'),
      },
    ],
    keywords: ['ordre de travail', 'tâches', 'avancement', 'notes', 'production', 'assigné', 'standard', 'work order', 'tasks', 'progress', 'assignee'],
  },

  /* ------------------------------------------------------------------ shipping */
  {
    id: 'shipping.labels',
    module: 'shipping',
    path: '/shipping',
    permission: 'shipping.access',
    title: bi('Étiquettes d’expédition', 'Shipping labels'),
    summary: bi(
      'Liste des étiquettes d’expédition pour l’équipe de production, avec leur statut : Brouillon, Prête, Imprimée, Expédiée ou Annulée. Les indicateurs du haut donnent l’activité du jour.',
      'List of shipping labels for the production team, with their status: Brouillon, Prête, Imprimée, Expédiée or Annulée. The figures at the top give today’s activity.',
    ),
    tips: [
      bi('Les onglets filtrent par statut : Toutes [All], puis chaque statut.', 'The tabs filter by status: Toutes [All], then each status.'),
      bi('La recherche accepte un numéro, un client, un job ou un suivi.', 'Search accepts a number, customer, job or tracking number.'),
      bi('« Nouvelle étiquette » ouvre une étiquette vide. Ce bouton exige « Créer / modifier des étiquettes ».', '“New label” opens an empty label. This needs “Create / edit labels”.'),
      bi('Cliquez une ligne pour ouvrir l’étiquette.', 'Click a row to open the label.'),
      bi('Les indicateurs comptent les brouillons, les étiquettes à imprimer, les expéditions du jour et les colis du mois.', 'The figures count drafts, labels to print, shipments today and packages this month.'),
    ],
    howTo: [
      {
        q: bi('Comment créer une étiquette ?', 'How do I create a label?'),
        a: bi('Cliquez « Nouvelle étiquette », remplissez le destinataire, le no de job et les colis, puis « Enregistrer ».', 'Click “New label”, fill in the recipient, job number and packages, then “Save”.'),
      },
    ],
    keywords: ['expédition', 'étiquettes', 'colis', 'imprimer', 'brouillon', 'expédiée', 'shipping', 'labels', 'packages', 'print', 'draft', 'shipped'],
  },
  {
    id: 'shipping.new-label',
    module: 'shipping',
    path: '/shipping/new',
    permission: 'shipping.labels.create',
    title: bi('Nouvelle étiquette', 'New label'),
    summary: bi(
      'Ouvre une étiquette d’expédition vide : destinataire, expédition, colis et aperçu 4 × 6 po.',
      'Opens an empty shipping label: recipient, shipment, packages and a 4 × 6 in preview.',
    ),
    tips: [
      bi('Champs obligatoires : nom, adresse, ville, code postal, no de job et au moins un colis.', 'Required fields: name, street, city, postal code, job number and at least one package.'),
      bi('« Carnet d’adresses » remplit le destinataire en un choix.', '“Address book…” fills in the recipient with one choice.'),
      bi('« Colis » ajoute un colis, copié du précédent.', '“Package” adds a package, copied from the previous one.'),
      bi('Le titre affiche « Nouvelle » tant que l’étiquette n’est pas enregistrée.', 'The heading shows “New” until the label is saved.'),
    ],
    howTo: [
      {
        q: bi('Comment remplir le destinataire depuis le carnet ?', 'How do I fill in the recipient from the address book?'),
        a: bi('Dans « Destinataire », choisissez une adresse dans la liste « Carnet d’adresses… ».', 'In “Ship to”, choose an address in the “Address book…” list.'),
      },
      {
        q: bi('Comment rendre l’étiquette prête à imprimer ?', 'How do I make the label ready to print?'),
        a: bi('Cliquez « Enregistrer », puis « Marquer prête ». Si un champ manque, le message indique lesquels.', 'Click “Save”, then “Mark ready”. If a field is missing, the message lists which ones.'),
      },
    ],
    keywords: ['nouvelle étiquette', 'créer', 'destinataire', 'colis', 'job', 'new label', 'create', 'recipient', 'package'],
  },
  {
    id: 'shipping.addresses',
    module: 'shipping',
    path: '/shipping/addresses',
    permission: 'shipping.access',
    title: bi('Carnet d’adresses', 'Address book'),
    summary: bi(
      'Carnet des adresses de clients et de destinataires, utilisé pour remplir rapidement une étiquette.',
      'Address book of customers and recipients, used to fill in a label quickly.',
    ),
    tips: [
      bi('Le bouton « Adresse » ajoute une entrée. Il faut « Gérer le carnet d’adresses ».', 'The “Address” button adds an entry. You need “Manage address book”.'),
      bi('Les icônes crayon et corbeille modifient ou suppriment une adresse ; elles demandent la même permission.', 'The pencil and bin icons edit or delete an address; they need the same permission.'),
      bi('Le code et le nom sont obligatoires.', 'Code and name are required.'),
      bi('Les adresses enregistrées apparaissent dans « Carnet d’adresses… » lors de la saisie d’une étiquette.', 'Saved addresses appear under “Carnet d’adresses…” when you fill in a label.'),
    ],
    howTo: [
      {
        q: bi('Comment ajouter une adresse ?', 'How do I add an address?'),
        a: bi('Cliquez « Adresse », remplissez le code client et le nom, puis « Enregistrer ».', 'Click “Address”, fill in the customer code and name, then “Save”.'),
      },
    ],
    keywords: ['carnet d’adresses', 'adresses', 'destinataire', 'client', 'code client', 'address book', 'addresses', 'recipient', 'customer code'],
  },
  {
    id: 'shipping.settings',
    module: 'shipping',
    path: '/shipping/settings',
    permission: 'shipping.settings',
    title: bi('Paramètres d’expédition', 'Shipping settings'),
    summary: bi(
      'Adresses d’origine de l’expédition (usines, entrepôts), proposées comme « Expéditeur » sur les étiquettes.',
      'Ship-from addresses (plants, warehouses), offered as “Ship from” on labels.',
    ),
    tips: [
      bi('Le bouton « Origine » ajoute une adresse d’origine.', 'The “Origin” button adds a ship-from address.'),
      bi('« Libellé » donne un nom à l’origine ; « Par défaut » en fait l’origine proposée d’office.', '“Label” gives the origin a name; “Default” makes it the one offered automatically.'),
      bi('« Enregistrer » sauvegarde les changements.', '“Save” stores the changes.'),
    ],
    howTo: [
      {
        q: bi('Comment définir l’origine par défaut ?', 'How do I set the default origin?'),
        a: bi('Ajoutez ou modifiez une origine, cochez « Par défaut », puis cliquez « Enregistrer ».', 'Add or edit an origin, tick “Default”, then click “Save”.'),
      },
    ],
    keywords: ['paramètres', 'expédition', 'origine', 'expéditeur', 'usine', 'entrepôt', 'par défaut', 'settings', 'shipping', 'origin', 'ship from', 'warehouse', 'default'],
  },
  {
    id: 'shipping.label',
    module: 'shipping',
    path: '/shipping/:id',
    permission: 'shipping.access',
    title: bi('Étiquette d’expédition (détail)', 'Shipping label (detail)'),
    summary: bi(
      'Détail d’une étiquette : destinataire, expédition, colis et aperçu, avec les actions d’impression, d’expédition ou d’annulation.',
      'Label detail: recipient, shipment, packages and preview, with print, ship or void actions.',
    ),
    tips: [
      bi('Une étiquette se modifie tant qu’elle est « Brouillon » ou « Prête ».', 'A label can be edited while it is “Brouillon” or “Prête”.'),
      bi('« Imprimer » imprime une étiquette par colis (le bouton indique leur nombre). Ensuite, il devient « Réimprimer ».', '“Print” prints one label per package (the button shows their number). Afterwards it becomes “Reprint”.'),
      bi('« Expédiée » demande un numéro de suivi facultatif, puis confirme l’expédition.', '“Shipped” asks for an optional tracking number, then confirms the shipment.'),
      bi('« Annuler » passe l’étiquette à « Annulée ».', '“Void” sets the label to “Annulée”.'),
      bi('« Dupliquer » crée une copie pour un autre envoi.', '“Duplicate” creates a copy for another shipment.'),
    ],
    howTo: [
      {
        q: bi('Comment imprimer une étiquette ?', 'How do I print a label?'),
        a: bi('Cliquez « Imprimer », le nombre de colis est indiqué entre parenthèses. Il faut « Imprimer et expédier ».', 'Click “Print”; the number of packages is shown in brackets. You need “Print and ship”.'),
      },
      {
        q: bi('Comment marquer une étiquette expédiée ?', 'How do I mark a label as shipped?'),
        a: bi('Cliquez « Expédiée », saisissez le numéro de suivi si vous l’avez, puis « Confirmer ».', 'Click “Shipped”, enter the tracking number if you have it, then “Confirm”.'),
      },
    ],
    keywords: ['étiquette', 'détail', 'imprimer', 'expédiée', 'annuler', 'colis', 'label', 'detail', 'print', 'shipped', 'void', 'package'],
  },

  /* ------------------------------------------------------------------ IT support */
  {
    id: 'it.support',
    module: 'it',
    path: '/it',
    permission: 'it.access',
    title: bi('Support informatique (AKAB)', 'IT support (AKAB)'),
    summary: bi(
      'Affiche le portail du support informatique (AKAB) directement dans Imago, sans quitter l’application.',
      'Shows the IT support portal (AKAB) directly inside Imago, without leaving the application.',
    ),
    tips: [
      bi('La page occupe tout l’écran ; la barre du haut sert à changer de module.', 'The page fills the screen; the top bar is used to switch module.'),
      bi('Pendant le chargement, « Chargement du support… » s’affiche.', 'While it loads, “Chargement du support…” shows.'),
      bi('Les personnes ayant « Changer l’adresse du support » voient une icône de réglage dans la barre du haut.', 'People with “Change support address” see a settings icon in the top bar.'),
      bi('L’adresse doit commencer par https://. « Par défaut » rétablit l’adresse AKAB.', 'The address must start with https://. “Default” restores the AKAB address.'),
      bi('Le site affiché doit autoriser l’affichage intégré.', 'The site shown must allow being embedded.'),
    ],
    howTo: [
      {
        q: bi('Comment changer la page du support ?', 'How do I change the support page?'),
        a: bi('Cliquez l’icône de réglage dans la barre du haut, saisissez l’adresse https://…, puis « Enregistrer ».', 'Click the settings icon in the top bar, enter the https://… address, then “Save”.'),
      },
      {
        q: bi('La page du support reste vide, pourquoi ?', 'Why is the support page blank?'),
        a: bi('Le site du fournisseur refuse peut-être l’affichage intégré. Ouvrez le portail dans votre navigateur, ou demandez à un administrateur de changer l’adresse.', 'The provider’s site may refuse to be embedded. Open the portal in your browser, or ask an administrator to change the address.'),
      },
    ],
    keywords: ['support', 'informatique', 'TI', 'AKAB', 'billet', 'ticket', 'IT', 'helpdesk', 'portail', 'portal'],
  },

  /* ------------------------------------------------------------------ development */
  {
    id: 'dev.punch-card',
    module: 'dev',
    path: '/dev/punch-card',
    permission: 'dev.punchcard',
    title: bi('Punch card (en développement)', 'Punch card (in development)'),
    summary: bi(
      'Page de développement encore vide : elle affiche seulement un espace réservé « Hello world » en attendant ses fonctionnalités.',
      'Development page still empty: it only shows a “Hello world” placeholder until its features are built.',
    ),
    tips: [
      bi('Les fonctionnalités de cette page ne sont pas encore définies.', 'The features of this page are not defined yet.'),
      bi('L’accès se donne avec la permission « Punch card » dans les groupes d’accès.', 'Access is given with the “Punch card” permission in access groups.'),
    ],
    howTo: [
      {
        q: bi('Pourquoi cette page ne fait rien ?', 'Why doesn’t this page do anything?'),
        a: bi('C’est un espace réservé. La fonctionnalité n’est pas encore développée.', 'It is a placeholder. The feature is not built yet.'),
      },
    ],
    keywords: ['punch card', 'développement', 'pointage', 'essai', 'development', 'time clock', 'placeholder', 'hello world'],
  },

  /* ------------------------------------------------------------------ sandbox */
  {
    id: 'sandbox.review',
    module: 'sandbox',
    path: '/sandbox/review',
    permission: 'sandbox.review',
    title: bi('Sandbox : à réviser', 'Sandbox: to review'),
    summary: bi(
      'Demandes du Sandbox soumises par d’autres personnes, à réviser : vous les approuvez ou les refusez, avec une note.',
      'Sandbox requests submitted by other people, to review: you approve or reject them, with a note.',
    ),
    tips: [
      bi('Ouvrez une demande pour lire la conversation et voir l’aperçu.', 'Open a request to read the conversation and see the preview.'),
      bi('« Approuver » marque la demande comme approuvée dans Imago. La fusion de la demande de fusion se fait sur GitHub.', '“Approve” marks the request as approved in Imago. The merge of the pull request is done on GitHub.'),
      bi('« Refuser » demande une raison, que la personne voit.', '“Reject” asks for a reason, which the requester sees.'),
    ],
    howTo: [
      {
        q: bi('Comment refuser une demande ?', 'How do I reject a request?'),
        a: bi('Ouvrez-la, cliquez « Refuser », puis indiquez la raison.', 'Open it, click “Reject”, then give the reason.'),
      },
      {
        q: bi('Où trouver les demandes à réviser ?', 'Where do I find the requests to review?'),
        a: bi('Menu utilisateur, puis Sandbox, puis « À réviser ».', 'User menu, then Sandbox, then “To review”.'),
      },
    ],
    keywords: ['sandbox', 'réviser', 'approuver', 'refuser', 'approbation', 'review', 'approve', 'reject', 'approval'],
  },
  {
    id: 'sandbox.home',
    module: 'sandbox',
    path: '/sandbox',
    permission: 'sandbox.use',
    title: bi('Sandbox : mes demandes', 'Sandbox: my requests'),
    summary: bi(
      'Décrivez un changement à l’application en langage simple : Claude le réalise dans une copie privée, avec un aperçu. Rien n’atteint l’application réelle sans approbation.',
      'Describe a change to the app in plain words: Claude makes it in a private copy, with a preview. Nothing reaches the real app without approval.',
    ),
    tips: [
      bi('Choisissez le module, donnez un titre, puis « Commencer ».', 'Choose the module, give a title, then click “Start”.'),
      bi('Vous ne proposez des changements que pour les modules auxquels vous avez accès : Align, Gestion O365, RH, Comptabilité, Estimation, Expédition, Function Fox et Support TI.', 'You can only propose changes for modules you can open: Align, Gestion O365, RH, Comptabilité, Estimation, Expédition, Function Fox and Support TI.'),
      bi('« Budget du mois » montre la dépense en cours par rapport au plafond.', '“This month’s budget” shows spending so far against the cap.'),
      bi('La liste montre le statut et le coût de chaque demande.', 'The list shows the status and cost of each request.'),
      bi('Le Sandbox fonctionne avec le serveur Imago ; il n’est pas disponible dans la démo du navigateur.', 'The Sandbox works with the Imago server; it is not available in the browser demo.'),
    ],
    howTo: [
      {
        q: bi('Comment proposer un changement ?', 'How do I propose a change?'),
        a: bi(
          'Cliquez « Nouvelle demande », choisissez le module, écrivez un titre, cliquez « Commencer », puis décrivez le changement dans la conversation et envoyez-le avec « Envoyer » (Ctrl+Entrée).',
          'Click “New request”, choose the module, write a title, click “Start”, then describe the change in the conversation and send it with “Send” (Ctrl+Enter).',
        ),
      },
      {
        q: bi('Comment soumettre le changement ?', 'How do I submit the change?'),
        a: bi('Quand l’aperçu est prêt, ouvrez la demande et cliquez « Soumettre ». Un approbateur la révisera.', 'When the preview is ready, open the request and click “Submit”. An approver will review it.'),
      },
    ],
    keywords: ['sandbox', 'bac à sable', 'proposer', 'changement', 'claude', 'aperçu', 'demande', 'modifier l’application', 'propose', 'change', 'preview', 'request'],
  },
  {
    id: 'sandbox.request',
    module: 'sandbox',
    path: '/sandbox/:id',
    permission: 'sandbox.use',
    title: bi('Sandbox : une demande', 'Sandbox: one request'),
    summary: bi(
      'Espace d’une demande : conversation avec Claude, aperçu de la copie privée (données de démonstration), soumission ou abandon.',
      'Workspace of one request: conversation with Claude, preview of the private copy (demo data), submission or abandonment.',
    ),
    tips: [
      bi('Décrivez le changement précisément : où, quoi, pour qui.', 'Describe the change precisely: where, what, for whom.'),
      bi('« Arrêter » interrompt Claude pendant qu’il travaille.', '“Stop” interrupts Claude while it works.'),
      bi('L’aperçu se recharge avec l’icône de rafraîchissement ; « Ouvrir dans un onglet » l’ouvre à part.', 'The preview reloads with the refresh icon; “Open in a tab” opens it separately.'),
      bi('« Soumettre » n’est possible qu’après un travail de Claude. Avant l’envoi, Imago vérifie le périmètre, le typage et la compilation.', '“Submit” is only possible after Claude has done some work. Before sending, Imago checks the scope, types and build.'),
      bi('« Abandonner » efface la copie privée et ses changements.', '“Abandon” deletes the private copy and its changes.'),
    ],
    howTo: [
      {
        q: bi('Comment demander une modification à Claude ?', 'How do I ask Claude for a change?'),
        a: bi('Tapez dans la zone de message, puis cliquez « Envoyer » ou appuyez sur Ctrl+Entrée.', 'Type in the message box, then click “Send” or press Ctrl+Enter.'),
      },
      {
        q: bi('Comment soumettre pour approbation ?', 'How do I submit for approval?'),
        a: bi('Cliquez « Soumettre », rédigez le « Résumé pour l’approbateur », puis cliquez « Soumettre ».', 'Click “Submit”, write the “Summary for the approver”, then click “Submit”.'),
      },
    ],
    keywords: ['sandbox', 'demande', 'conversation', 'aperçu', 'soumettre', 'abandonner', 'claude', 'request', 'preview', 'submit', 'abandon'],
  },
];
