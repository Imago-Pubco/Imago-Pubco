# Build du guide utilisateur (Imago · Pubco Hub 2.0)

## Fichiers
- `index.html` : le guide complet (un seul fichier, contenu, diagrammes SVG et icônes inline).
- `guide.css` : mise en page écran et impression A4 (`@page`, cadres de marge, en-tête et pied de page courants, numéros de page via `counter(page)`).
- `fonts.css` + `assets/fonts/` : Bricolage Grotesque et Instrument Sans (sous-ensemble latin, variables), embarquées dans le PDF.
- `assets/logo-akab.png` : logo AKAB tel que publié sur akab.ca.
- `assets/logo-foot.png` : même logo sur un fond noir, pour le pied de page imprimé.

## Valeurs de marque prises sur akab.ca (lues le 26 novembre 2026)
- Logo : `https://akab.ca/img/logo-akab.png` (PNG 400 × 96, dégradé or). Nom affiché : « AKAB Informatique ».
- Couleurs : noir `#0a0a0b` (couleur de thème), dégradé or `#ffe24a` → `#ffce1a` → `#f59410`, or foncé `#e0870a`, papier `#f4f4f1`, encre `#121317`, texte secondaire `#5a5c63`.
- Polices : Bricolage Grotesque (titres, variable 400–800) et Instrument Sans (texte), chargées depuis Google Fonts sur le site, puis téléchargées localement.
- Ton : français (Québec), direct, orienté services TI pour PME. Slogan repris : « Services TI pour PME en Lanaudière ».
- Mention : « Préparé par AKAB » sur la couverture et dans le pied de page.

## Génération (build.mjs)
Le fichier `index.html` est la source unique. `build.mjs` fait, dans l’ordre :
1. ajoute un emplacement de numéro à chaque ligne du sommaire et imprime le PDF avec Microsoft Edge (sans en-tête ni pied de page du navigateur) ;
2. relit le PDF avec pdfjs-dist, trouve la page de départ de chaque chapitre et annexe (en-tête « CHAPITRE n » ou « ANNEXE x » suivi du titre) et écrit ces numéros dans le sommaire ;
3. imprime le PDF final dans `docs/Imago-Guide-Utilisateur.pdf` et vérifie : chaque numéro du sommaire égale la page relue, et chaque « Page n » du pied de page égale l’index du PDF.

pdfjs-dist n’est pas une dépendance du dépôt. L’installer dans un dossier hors dépôt :

    mkdir C:\temp\imago-pdfjs && cd C:\temp\imago-pdfjs && npm install pdfjs-dist@4.10.38

Lancer ensuite (depuis la racine du dépôt) :

    set PDFJS_DIR=C:\temp\imago-pdfjs
    node docs/guide/build.mjs

Le script affiche le nombre de pages, les numéros du sommaire et la liste des problèmes (vide si tout concorde). Edge est lancé via PowerShell (`Start-Process -Wait`) : lancé directement depuis Node, il rend la main avant la fin de l’écriture du PDF.

Résultat de la dernière exécution : 44 pages ; 23 entrées de sommaire vérifiées ; aucun écart pour le pied de page.

## Sources du contenu
- `README.md`, `SANDBOX.md`, `.env.example` (noms de variables seulement, aucune valeur).
- `src/help/content.a.ts` et `content.b.ts` (pages, conseils, procédures en français).
- `src/modules/*/index.tsx` (noms, descriptions, permissions), `src/layout/menuDefaults.ts` (sections du menu).
- `src/modules/sales/types.ts`, `pages/RequestDetail.tsx` (étapes, blocages, boutons), `server/sales.ts` (règles de passage d'étape, validité des soumissions).
- `src/modules/estimating/pricing.ts` (étapes de calcul du prix : `price = cost / (1 − margin)`), `defaults.ts` (modèle provisoire).
- `src/modules/workorders/types.ts` (statuts), `src/assistant/` (bouton « Comment ça marche », assistant), `server/aiUsage.ts` (quotas).

## Écarts relevés (à trancher)
- L'aide intégrée décrit l'analyse de photo de boîte comme disponible en mode serveur, alors que le README la présente comme une étape à venir. Le guide le signale dans « Ce qui s'en vient ».
- Le nom « KPI » est dit provisoire dans le README : signalé de la même façon.
- Le bouton de passage en production apparaît à l’étape Accepté ; le guide le nomme « Envoyer en production », comme dans l’application.
