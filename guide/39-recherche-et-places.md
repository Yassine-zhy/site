# Étape 39 — Les menus déroulants réparés, une recherche partout, l'accueil qui suit la place choisie

> **Objectif :** que les menus déroulants et les champs de saisie ne se ferment plus tout seuls (surtout sur
> téléphone) ; pouvoir chercher une valeur, une crypto, une page ou un terme du glossaire depuis n'importe quelle
> page ; et que la séance racontée sur l'accueil suive la place choisie (France, Canada ou États-Unis).

Fichiers créés : `search.py` (la recherche), `tests/test_search.py`, `tests/test_story.py`, ce guide.
Fichiers modifiés : `app.py`, `theme.py`, `scene3d.py`, `views/feed.py`, `views/glossary.py`, `static/fv3d/motion.js`,
`static/fv3d/engine.js`.

---

## 1. Ce que tu as demandé

- « Fais le 6 et le 5. » : le 5 est une recherche disponible partout, le 6 un accueil qui suit la place choisie.
- Et un bug : « dans les trucs où t'écris, où t'as les menus déroulants […] quand je vais dans la page investissement
  et je veux mettre investissement depuis 2018 ou 2019, la petite barre où il y a toutes les années, elle se ferme,
  je ne peux pas écrire. Et ça fait ça un peu partout, pas que ici. »

## 2. Le bug des menus : l'enquête pas à pas

1. **Sur ordinateur, page en haut : impossible à reproduire.** Le menu « Depuis » du simulateur d'investissement
   reste ouvert et « 2018 » s'écrit sans problème.
2. **Sur téléphone, c'est reproduit.** Avec Playwright (390 × 844, tactile) et le clavier simulé (la fenêtre passe à
   390 × 480 après le toucher) : après environ une seconde, le champ perd le focus, la liste se ferme, il ne reste
   que le « 8 » de « 2018 ».
3. **On instrumente la page.** Un script injecté avant le chargement (`add_init_script`) enregistre chaque `scroll`,
   chaque `resize`, chaque perte de focus, et intercepte le setter `scrollTop` ainsi que `scrollTo` et
   `scrollIntoView` avec la pile d'appels (`new Error().stack`). Résultat : après le `resize`, `ScrollTrigger.min.js`
   écrit `stMain.scrollTop = 0` puis `= 613`, toutes les 370 ms environ ; juste après, le champ perd le focus.
4. **Pourquoi ça ferme le menu.** Streamlit 1.66 dessine ses menus avec react-aria
   (`[data-testid=stSelectboxVirtualDropdown]`, attribut `data-rac`), qui ferme une liste dès que la page défile en
   dehors d'elle. Or une mesure de ScrollTrigger (`refresh`) remet un instant la zone de défilement en haut pour
   mesurer, puis la replace : pour react-aria, c'est un défilement.
5. **Pourquoi toutes les 370 ms : une boucle.** On la trouve en traçant qui appelle `ScrollTrigger.refresh` et
   quel élément vient d'arriver dans la page. Pour mesurer la hauteur de l'écran, ScrollTrigger pose un instant dans
   `<body>` un `<div style="height: 100vh; position: absolute">`, puis le retire. L'observateur de `motion.js` (un
   `MutationObserver` : « un élément est arrivé, on cherche de nouveaux chiffres à animer, on relance une mesure
   250 ms plus tard ») le comptait comme un nouvel élément. Nouvelle mesure, nouveau bloc, et ainsi de suite : deux à
   trois mesures par seconde, sans fin, sur toutes les pages qui ont des chiffres animés. Sur ordinateur page en
   haut, `scrollTop = 0` ne change rien (d'où « impossible à reproduire ») ; page descendue ou sur téléphone,
   chaque mesure fait un aller-retour visible pour react-aria. Et la liste qui se redessine ajoutait encore des
   éléments.

### Les correctifs (`static/fv3d/motion.js`, `engine.js`)

- Un élément déjà reparti ne compte pas (`n.isConnected`) : fin de la boucle.
- Les listes des menus et les bulles d'aide ne comptent pas (`[data-rac]`, `[role=listbox]`, `[role=tooltip]`…).
- Plus de mesure quand seule la hauteur de la fenêtre change (le clavier du téléphone) :
  `ST.config({ ignoreMobileResize: true, autoRefreshEvents: "visibilitychange,DOMContentLoaded,load" })`, plus notre
  propre écoute de `resize` qui ne mesure que si la largeur change.
- Une mesure attend la fin d'un menu ouvert, d'un dialogue, d'une fenêtre « popover » et, sur écran tactile
  (`pointer: coarse`), d'une saisie (`busy()`, nouvel essai toutes les 500 ms).
- `engine.js` charge `motion.js` avec sa version (`?v=…`, calculée par `scene3d.py` sur le contenu des fichiers) : le
  serveur n'envoie pas de `Cache-Control`, un navigateur aurait pu garder l'ancien fichier des jours.

### La vérification

Faite sur une copie propre du dépôt, pour ne pas mélanger avec le travail en cours.

- Téléphone : menu « Depuis » (2018 écrit, liste ouverte), champs nombre des simulateurs, recherche du fil,
  glossaire : saisie complète, 0 saut de page.
- Ordinateur, page descendue : menu ouvert 2,5 s, 0 mesure pendant, choix 2018 appliqué, 1 mesure juste après (les
  chiffres animés restent bien placés).
- Plus aucune mesure à vide sur l'accueil.

## 3. La recherche partout (`search.py`)

- **Le bouton.** Un bouton « Rechercher » dans la barre du haut de toutes les pages (`app.py`, `account_bar` : le
  conteneur `fvaccount` est maintenant toujours affiché ; le bouton, puis le compte hors mode local). Il ouvre un
  dialogue (`@st.dialog("Rechercher", width="medium")`).
- **Le raccourci clavier** (`engine.js`, `installShortcut`) : « / » (hors d'un champ de saisie) ou Ctrl+K / Cmd+K ;
  le curseur va dans le champ à l'ouverture.
- **Sans saisie**, des raccourcis : les places (CAC 40, S&P/TSX 60 par son fonds XIU, car Yahoo ne répond pas pour
  `^GSPTSX`, Dow Jones, S&P 500), des valeurs (LVMH, TotalEnergies, Shopify, Banque Royale, Apple, Nvidia) et deux
  cryptos (Bitcoin, Ether).
- **Avec 2 caractères ou plus** (Entrée) : des groupes « Valeurs », « Cryptomonnaies », « Pages du site »,
  « Glossaire ». Chaque ligne est un lien vers la fiche (`theme.fiche_url`, `theme.coin_url`), la page
  (`./simulators`…) ou le glossaire (`./glossary?q=terme` ; `views/glossary.py` préremplit sa recherche avec `?q=`).
- **« Valeurs » : le site d'abord, Yahoo ensuite.** D'abord les valeurs que le site connaît (les 40 du CAC 40, les 60
  du S&P/TSX 60, Wall Street, les cours du bandeau ; un mot du nom qui commence par la recherche, ou le symbole),
  puis Yahoo, sans doublon (`local_values`, `merge_values`). Pourquoi : Yahoo répond en anglais et d'abord pour les
  États-Unis ; « total » y donnait des fonds Vanguard, pas TotalEnergies.
- **Des fonctions pures**, testées sans Streamlit : `page_hits`, `glossary_hits`, `local_values`, `merge_values`,
  `results_html` (tout est échappé ; pas de lien `javascript:`).
- **Deux pièges du dialogue de Streamlit, corrigés.**
  1. Il est posé hors de `.stApp`, où `theme.py` définit ses jetons `--fv-…` : le bloc des jetons vaut maintenant pour
     `.stApp, [data-testid="stDialog"]` (le fond de page, lui, reste sur `.stApp` seul).
  2. Streamlit ne donne le thème (`color-scheme: dark`) qu'à `.stApp` : en mode sombre, les couleurs `light-dark()`
     restaient claires dans le dialogue (champ blanc, texte presque invisible). `engine.js` (`installDialogTheme`)
     recopie le `color-scheme` de `.stApp` sur chaque dialogue.
- **Retouches.** Plus de compteur « 4/60 » dans le champ (il chevauchait le texte sur téléphone), titres de groupes
  en minuscules, et sur téléphone la loupe et le compte sont deux ronds de même taille.

## 4. L'accueil qui suit la place choisie

- **Le sélecteur.** `views/feed.py` : « La séance : France | Canada | États-Unis » (`st.segmented_control`, clé
  `story_place`) au-dessus du récit. Il suit l'adresse (`?place=canada` ; « france » = pas de paramètre ; une valeur
  inconnue donne la France).
- **Les données.** France comme avant. Canada et États-Unis : `ui.load_place` (15 min de cache, secours XIU pour
  Toronto) puis `align_session` (même séance pour l'indice et ses valeurs). À la première visite d'une place, un
  bloc d'attente garde la hauteur du récit.
- **L'histoire du jour** (dernier chapitre) : Canada, la une parmi les dépêches de la région « ca » ; États-Unis,
  « monde » ; France, toutes (préférence française).
- **Le texte.** `theme.story_html(..., place=)` : « Le S&P/TSX progresse de… », « Le Dow Jones… ». Avec le fonds de
  secours : « Le S&P/TSX 60 progresse de 0,65 % », « D'après son fonds XIU, qui s'échange à 54,48 $ » (jamais
  « points » pour un fonds). Accroches : « La plus forte hausse du S&P/TSX 60 », « … à Wall Street ».
- **Les horloges.** Toronto est ajoutée (9 h 30 – 16 h, America/Toronto) ; la place racontée est soulignée.
- **La maquette 3D** (`scene3d.city_data(quotes, place)`). De nouvelles tables d'ordres de grandeur (capitalisation
  approximative en milliards de $ US) pour Toronto et Wall Street. La maquette n'a que 40 cases : pour les 60 du
  S&P/TSX 60, on garde les 40 plus lourdes, mais toujours les 3 plus fortes hausses et baisses (sinon la caméra du
  chapitre « Hausse » visait une autre tour que celle du texte). Vérifié : au Canada, le chapitre Hausse vise WSP
  (+3,30 %), texte et maquette.

## 5. Le partage du travail

Session principale : l'enquête et le correctif du bug des menus, les spécifications, la relecture, les retouches
(thème du dialogue, valeurs connues d'abord, boutons du téléphone), les vérifications. Deux sous-agents en parallèle
(la recherche ; l'accueil par place), chacun sur ses fichiers. Un redémarrage du conteneur les a interrompus : leur
travail était sur le disque, ils ont repris où ils en étaient (et des commits « en cours » réguliers l'avaient mis à
l'abri).

Vérifications finales :

- La suite : 403 tests passent, 28 sautés (PostgreSQL). Nouveaux fichiers : `tests/test_search.py`,
  `tests/test_story.py`.
- Navigateur (ordinateur 1440 × 900 et téléphone 390 × 844) : `/`, `?place=canada`, `?place=usa`,
  `markets?view=canada`, `fiche?s=TTE.PA`, `fiche-crypto?c=bitcoin`, `simulators`, `glossary?q=Dividende`, `crypto`,
  `about` : aucune exception, aucune erreur de page. Dialogue clair et sombre vérifiés.

## 6. Limites connues

- Le sélecteur de place est un peu loin du titre sur grand écran (le récit est centré verticalement dans son écran).
- Yahoo ne répond pas pour l'indice S&P/TSX : le fonds XIU le remplace (nommé comme tel).
- Une panne de la recherche Yahoo ressemble à « aucun résultat » (seule l'indisponibilité de CoinGecko est
  signalée).

## 7. Erreurs fréquentes

- **Un `MutationObserver` qui réagit à ses propres effets** (ou à ceux d'une bibliothèque qu'il appelle) : c'est une
  boucle. Filtrer : les éléments encore dans la page, et seulement ceux qui comptent.
- **Conclure « impossible à reproduire » sur ordinateur** : reproduire dans les conditions de la personne (téléphone,
  clavier virtuel = fenêtre qui rapetisse, page descendue).
- **Écrire un script d'instrumentation dans une chaîne Python** : les `\n` et `\/` y sont interprétés par Python, d'où
  une erreur de syntaxe JavaScript silencieuse. Écrire le script dans un fichier `.js` à part
  (`add_init_script(path=…)`).
- **Tester pendant que d'autres modifient les fichiers** : le serveur lit des fichiers à moitié écrits. Tester sur
  une copie propre (`git worktree add --detach <dossier> HEAD`).

Étape précédente : [une fiche pour chaque valeur, des marchés par place, plus de sources](38-fiches-et-places.md).
Retour au [sommaire du guide](README.md).
