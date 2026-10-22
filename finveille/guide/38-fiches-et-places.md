# Étape 38 — Une fiche pour chaque valeur, des marchés par place, plus de sources, et la chasse aux bugs

> **Objectif :** pouvoir entrer dans chaque action, indice, devise et cryptomonnaie pour voir son cours et tout ce
> qu'il faut savoir ; regarder Paris, Toronto, New York et le reste du monde (le CAC 40 n'est plus qu'une place parmi
> d'autres) ; lire beaucoup plus de sources, rangées par région ; et corriger tous les bugs trouvés.

Fichiers créés : `views/quote.py` (la fiche d'une valeur), `views/coin.py` (la fiche d'une crypto), `sheet.py` (les
morceaux de fiche partagés), `coins.py` (les chargements de la fiche crypto), `core/company.py` (la logique pure de la
fiche), `tests/test_fiche.py`, `test_coin.py`, `test_places.py`, `test_regions.py`, `test_robustesse.py`,
`test_seance.py`, le skill `.claude/skills/developing-with-streamlit/`, ce guide.
Fichiers modifiés : `app.py` (deux pages cachées), `theme.py` (liens vers les fiches), `ui.py`, `core/config.py`,
`core/models.py`, `core/sources.py`, `core/aggregator.py`, `core/analytics.py`, `core/market.py`, `core/crypto.py`,
`views/feed.py`, `views/markets.py`, `views/crypto.py`, `views/following.py`, `views/alerts.py`, `views/portfolio.py`,
`tests/test_app.py`, `tests/test_sources.py`.

---

## 1. Ce que tu as demandé

- « Il y a trop de bugs, règle tous les bugs que tu trouves. »
- Plus de sites d'actualité.
- Un point principal sur la France (le CAC 40), mais aussi le monde et le Canada ; « le CAC 40, c'est juste un
  point ».
- Pour chaque action, chaque crypto : pouvoir entrer dedans et voir son cours et plein d'informations, pas seulement
  « c'est rouge sur la séance ».
- Utiliser les skills, en chercher sur GitHub si besoin, et toutes les API utiles.

## 2. Le skill officiel de Streamlit

- Streamlit livre son propre skill, « developing-with-streamlit », dans son paquet (`streamlit/.agents/skills/`) ; il
  est aussi publié sur GitHub (streamlit/agent-skills). Licence Apache 2.0. Il est copié dans `.claude/skills/` avec sa
  licence et une note (`NOTICE.md`). C'est un skill « aiguilleur » : des bonnes pratiques et une référence par sujet
  (pages multiples, performance, mise en page, données, tests…).
- Ce qu'il a changé concrètement : des pages cachées du menu (`st.Page(..., visibility="hidden")`), des éléments natifs
  plutôt que du HTML fait main quand c'est possible, chaque appel réseau mis en cache avec une durée de vie.

## 3. Une fiche pour chaque valeur (`fiche?s=<symbole>`)

- Deux pages cachées du menu, déclarées dans `app.py` : `views/quote.py` à l'adresse `fiche` (un symbole Yahoo :
  `fiche?s=MC.PA`, `fiche?s=RY.TO`, `fiche?s=AAPL`, `fiche?s=^FCHI`, `fiche?s=EURUSD=X`, `fiche?s=GC=F`…) et
  `views/coin.py` à l'adresse `fiche-crypto` (un identifiant CoinGecko : `fiche-crypto?c=bitcoin`).
- `theme.fiche_url(symbole)` et `theme.coin_url(id)` fabriquent ces liens (le bitcoin et l'ether de Yahoo mènent à la
  fiche crypto). Un lien relatif marche quelle que soit la page d'où l'on vient.
- La fiche d'une action : le cours et le graphique annoté par période (la fiche de « Mes suivis », déplacée dans
  `sheet.py` pour servir aux deux pages), les indicateurs clés et la fourchette sur 52 semaines, l'agenda, l'analyse,
  puis : les performances (1 semaine à 5 ans), les résultats des 4 dernières années (chiffre d'affaires, résultat net,
  marge), ce qu'en pensent les analystes (recommandation, objectifs bas / moyen / haut et potentiel), les dividendes
  sur 5 ans, les actualités de l'entreprise (le fil + les nouvelles Yahoo), les autres valeurs du secteur, et les
  boutons Suivre, Créer une alerte, Ajouter au portefeuille (les pages Alertes et Portefeuille s'ouvrent sur la
  valeur).
- La fiche d'un indice, d'une devise, d'une matière première : cours, graphique, fourchette, performances ; pour
  l'indice d'une place, ses plus fortes hausses et baisses et un lien vers sa carte.
- Sans symbole ou avec un symbole inconnu : une recherche et des raccourcis. Le titre de l'onglet du navigateur prend
  le nom de la valeur.

## 4. Une fiche pour chaque cryptomonnaie (`fiche-crypto?c=<id>`)

- CoinGecko (sans clé) : le cours en euros, un graphique (24 h, 7 jours, 30 jours, 1 an, depuis le début), les chiffres
  clés (capitalisation, volume, offre en circulation et maximale avec sa barre, valorisation diluée, plus haut et plus
  bas historiques), les variations de 1 h à 1 an, « C'est quoi ? » (la description en français de CoinGecko), les
  catégories, le site officiel et le livre blanc, les dépêches du fil qui en parlent.
- La page Crypto : chaque ligne du classement mène à sa fiche, et une recherche trouve n'importe quelle crypto.
- La limite gratuite de CoinGecko est basse (environ 30 appels par minute) : tout est gardé en mémoire 10 minutes
  (6 heures pour la description) ; si CoinGecko refuse, le graphique passe par Yahoo (`BTC-EUR`) et la page le dit
  clairement. « Depuis le début » passe toujours par Yahoo (l'offre gratuite de CoinGecko le refuse).

## 5. Les marchés par place

- La page Marchés : Monde, France, Canada, États-Unis, Devises (l'adresse retient la vue : `markets?view=canada`).
- Une seule fonction pour les trois places (`place_view`) : l'indice de la place, l'ambiance de la cote, la carte par
  secteur, les plus fortes hausses et baisses, le tableau. France : les 40 du CAC 40. Canada : les 60 du S&P/TSX 60.
  États-Unis : les 30 du Dow Jones et cinq géants de la tech. La vue Monde ajoute « Les places » en tête.
- Le Canada dans le monde : l'indice S&P/TSX, le dollar canadien (USD/CAD, EUR/CAD).
- Yahoo refuse en ce moment l'indice S&P/TSX (erreurs 401/404) : le site prend alors le fonds XIU, qui suit le
  TSX 60, et l'affiche « S&P/TSX 60 (fonds XIU) » (son cours, environ 54 $, n'est pas le niveau de l'indice, environ
  1 700 : le nom le dit).
- Des liens partout : chaque tuile de cotation, chaque case des cartes, chaque ligne des classements, chaque cours du
  bandeau défilant en haut de toutes les pages (il s'arrête au survol, pour qu'on puisse cliquer), les tuiles du haut
  de page et une colonne « Fiche » dans les tableaux mènent à la fiche. Un champ « Chercher une valeur » en haut de la
  page Marchés.

## 6. Plus de sources, rangées par région

- 43 flux au lieu de 12, tous testés avant d'être ajoutés (41 essayés : Les Échos, Boursorama et Zonebourse refusent
  les robots ; Le Parisien n'a pas de dates ; le flux du Wall Street Journal est arrêté depuis janvier 2025).
- France : Le Figaro Économie et Bourse, La Tribune, Capital, Challenges, BFM Business, Franceinfo, 20 Minutes,
  Investing.com France, l'AMF, Journal du Coin, Cryptoast (en plus de BFM Bourse, Le Monde et la BCE).
- Canada : Radio-Canada, La Presse, Le Devoir, The Globe and Mail, Financial Post, BNN Bloomberg, Banque du Canada.
- Monde : MarketWatch, Investing.com, Financial Times, Fortune, Business Insider, The Guardian, Seeking Alpha,
  France 24, Decrypt, The Block.
- Chaque flux porte une région ; le fil se filtre « Tout / France / Canada / Monde » ; à égalité, la une préfère une
  histoire française. Une vraie collecte : 749 articles en 11 secondes (Monde 352, France 284, Canada 113).
- La collecte passe à 12 flux en parallèle ; le classement par mots-clés (`core/config.py`) connaît le vocabulaire
  canadien (TSX, huard, Banque du Canada…) ; l'identification du robot du site est neutre.

## 7. La chasse aux bugs

Trois méthodes : (1) un robot (Playwright) qui ouvre 34 pages sur ordinateur et téléphone, relève les exceptions, les
erreurs de la console, les requêtes en échec, le défilement horizontal, et clique pour de vrai d'une tuile vers une
fiche ; (2) une relecture de tout le code de l'étape par un sous-agent, avec des entrées piégées (adresses bizarres,
réponses de Yahoo inattendues) ; (3) des vérifications à la main sur les données réelles.

Bugs trouvés et corrigés :

- **Deux séances mélangées sur l'accueil** : Yahoo publiait la clôture du CAC 40 du 21 octobre (+1,06 %) mais pas
  encore celle de ses 40 valeurs (vides pour ce jour-là) : l'accueil disait « le CAC 40 progresse de 1,06 % » et
  « 16 valeurs en hausse, 24 en baisse »… de la veille. Correctifs : une clôture quotidienne manquante est complétée
  par le dernier cours horaire de ce jour-là (`fill_last_closes`, une seule requête de plus, seulement si besoin) ; et
  l'indice et ses valeurs sont toujours ramenés à la même séance (`align_session`). Résultat : 29 en hausse, 11 en
  baisse, cohérent.
- **Des plantages possibles** : une série de cours vide (que des valeurs manquantes), une valeur « Infinity » renvoyée
  par Yahoo dans un ratio, un premier cours à zéro (division par zéro) sur la fiche crypto et dans les variations, un
  profil Yahoo qui refuse de répondre (le secours n'était jamais atteint).
- **Deux injections fermées** : un nom piégé qui aurait pu fermer le petit script du titre de l'onglet ; un lien
  Markdown glissé dans l'adresse (`fiche?s=[clique](https://…)`) qui s'affichait comme un lien dans l'avertissement.
- **Des entrées d'adresse bornées** : symbole de 20 caractères au plus, identifiant CoinGecko `[a-z0-9-]`, et un
  symbole inconnu est retenu « inconnu » 5 minutes au lieu de relancer les appels à chaque clic.
- **Une source mal formée** ne fait plus échouer toute la collecte ; le symbole est encodé dans l'adresse de Yahoo.
- **Du HTML dans les résumés** : certains flux échappent leur HTML deux fois (« <link type=… ») ; il est maintenant
  nettoyé aussi après décodage (et « 3 < 5 » reste du texte).
- **Les tendances du fil** affichaient « ans » : les mots de remplissage des titres français sont filtrés.
- **« Plus fortes baisses »** pouvait lister des valeurs en hausse quand peu de cours sont disponibles.

Ce qui n'est pas un bug (vérifié) :

- Les erreurs 404 sur `/<page>/_stcore/health` dans la console viennent de Streamlit lui-même (son interface sonde
  l'adresse de la page avant la racine).
- Un robot ne peut pas cliquer le bandeau défilant tant qu'il bouge, une personne oui (il s'arrête au survol).

Résultat : 361 tests passent (28 sautés : ceux de la base PostgreSQL, sans base de test) ; aucune exception sur les
34 pages.

## 8. Le partage du travail

Comme le demande le fichier de consignes du projet : l'architecture (pages cachées, liens, listes des places), les
choix et la relecture dans la session principale ; quatre sous-agents en parallèle, chacun sur ses fichiers (sources,
fiche d'une valeur, fiche crypto, marchés), à partir de spécifications écrites ; un sous-agent pour le robot de la
chasse aux bugs ; un pour la relecture du code ; un pour les correctifs précis. Chaque rendu est vérifié ensuite
(captures, tests, données réelles).

## 9. Erreurs fréquentes

- **Mélanger deux téléchargements de cours sans vérifier leurs dates** : toujours comparer sur une même séance.
- **Oublier qu'une source de données gratuite a des limites** (CoinGecko : environ 30 appels par minute ; Yahoo :
  refus ponctuels) : mettre en cache, prévoir un secours, et le dire à l'écran.
- **Faire confiance à l'adresse** : c'est une entrée comme une autre, il faut la borner et l'échapper (HTML et
  Markdown).
- **Un robot qui prend ses captures trop tôt invente des bugs** (graphique « vide », page d'accueil « blanche ») :
  attendre la fin réelle du chargement (le pied de page, dessiné en dernier).
- **`pkill -f motif` tue aussi le shell qui le lance** si le motif figure dans sa propre commande : viser un PID, ou
  écrire le motif avec des crochets (`86[0]1`).

Étape précédente : [une bande-annonce qui montre ce qu'il y a dedans](37-bande-annonce-contenu.md). Retour au
[sommaire du guide](README.md).
