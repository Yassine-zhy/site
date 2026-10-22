# Étape 40 — Le plein écran réparé, un site conforme au RGPD

> **Objectif :** que les graphiques et les tableaux s'affichent entiers en plein écran ; et que le site soit prêt à
> être mis en ligne en Europe : pages légales, aucune requête vers Google depuis le navigateur du visiteur, accord
> explicite à l'inscription, durées de conservation, droits d'accès et d'effacement.

Fichiers créés : `core/legal.py`, `views/legal.py`, `static/fonts/`, `tests/test_legal.py`, `tests/test_privacy.py`,
ce guide.
Fichiers modifiés : `app.py`, `theme.py`, `ui.py`, `search.py`, `.streamlit/config.toml`, `core/storage.py`,
`core/brief.py`, `core/notify.py`, `scripts/send_notifications.py`, `sheet.py`, `views/feed.py`, `views/stats.py`,
`views/portfolio.py`, `views/assistant.py`, `views/account.py`, `tests/conftest.py`, `tests/test_app.py`,
`tests/test_market_theme.py`.

---

## 1. Ce que tu as demandé

- Un bug : « quand je mets les graphiques en plein écran, ça bug, ça n'affiche pas entièrement. »
- Puis : les normes européennes, les cookies et les règles, « c'est vraiment important avant la mise en ligne ». Tu
  as joint une vidéo avec une liste de points : politique de confidentialité, conditions d'utilisation, politique des
  cookies, consentement aux cookies, page de remboursement si besoin, consentement des formulaires, données
  minimales, accessibilité, textes alternatifs, contrastes, lois de ton pays. L'éditeur du site est en France.

## 2. Le plein écran : l'enquête et le correctif

- **La cause.** Le cadre plein écran de Streamlit (`stFullScreenFrame`) est en `position: fixed` avec un z-index de
  1000050. Mais un élément « fixed » se cale sur son ancêtre le plus proche qui porte un effet : `transform`,
  `filter`, `backdrop-filter`, `contain` ou `will-change`. Les cartes de graphique (`st-key-fvchart_…`) ont un
  `backdrop-filter` (le verre dépoli) : le graphique se retrouvait décalé (y = -91), coupé, sous le reste de la page.
- **Le correctif (`theme.py`).** Pendant le plein écran, le bouton de la barre d'outils s'appelle « Close fullscreen »,
  suivi de la description de l'élément s'il en a une. Tant que ce bouton existe, tous les ancêtres du cadre, sauf le
  cadre lui-même, perdent ces effets (sélecteur `:has(...)`).
- **Le piège.** Une première version visait l'étiquette exacte et ratait les tableaux décrits (« Close fullscreen:
  Cours et variations… »). On vise le début de l'étiquette : `aria-label^=`.
- **La vérification.** Graphiques de 7 pages et tableaux de 3 pages, sur ordinateur et sur téléphone : le cadre couvre
  l'écran (0, 0, largeur, hauteur), le contenu est entier, Échap le ferme. Un test le garde
  (`tests/test_market_theme.py`).

## 3. L'inventaire : ce que le navigateur envoie vraiment

Un script, dans un vrai navigateur, liste les cookies, le stockage et les domaines contactés.

- **Le site seul (en local).** Un seul cookie, `_streamlit_xsrf` ; dans le stockage, le thème. Mais le navigateur
  contactait Google : Google Fonts pour les polices, et le service d'icônes de Google pour les logos des sources.
  L'adresse IP du visiteur partait chez Google (un tribunal de Munich, en 2022, a accordé 100 € de dommages pour
  Google Fonts).
- **Le site en ligne.** Streamlit Community Cloud ajoute autour de l'appli Google Analytics (`_ga`, `_gid`,
  `_dc_gtm_UA-…`), Segment (`ajs_anonymous_id`), Heap, Datadog (`_dd_s`) et DoubleClick, sans consentement, et rien ne
  permet de les couper. Tu as choisi de rester sur Streamlit Cloud : la politique des cookies le dit honnêtement
  (section « Les traceurs de l'hébergeur »). Pour être entièrement conforme, il faudrait changer d'hébergeur.
- **Déjà en place avant cette étape.** L'export JSON et la suppression du compte (les droits RGPD), le brief par
  e-mail désactivé par défaut, `gatherUsageStats = false`, les mots de passe en empreinte scrypt.

## 4. Les pages légales (`core/legal.py`, `views/legal.py`)

- **Quatre pages**, cachées du menu : `mentions-legales`, `confidentialite`, `cookies`, `conditions`. Des liens dans le
  pied de page et dans la recherche (`search.py`).
- **Des textes en fonctions pures**, à partir de la configuration réelle : `config_from` lit les NOMS et les hôtes des
  secrets, jamais les valeurs. La politique ne cite donc que les services branchés (base de données, envoi d'e-mails,
  connexions par un service, IA).
- **Les faits, vérifiés à la source.**
  - Hébergeur : Snowflake Inc., Suite 3A, 106 East Babcock Street, Bozeman, Montana 59715, États-Unis, +1 844 766 9355
    (dépôts SEC) ; Data Privacy Framework et représentant dans l'UE (avis de confidentialité de Snowflake).
  - Autorité : la CNIL, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.
  - Cookies exemptés de consentement : ceux qui sont strictement nécessaires (position de la CNIL).
  - Durée du cookie de connexion de Streamlit : 30 jours (lue dans le code de Streamlit).
- **Le contact** : contact.finveille@gmail.com, une adresse dédiée.
- **Pas de bandeau de consentement** : les cookies de FinVeille sont tous strictement nécessaires.
- **Les conditions.** Pas de conseil en investissement. Pas de vente non plus : donc ni conditions de vente ni page de
  remboursement.

## 5. La partie technique

- **Les polices viennent du site.** 13 fichiers `woff2` dans `static/fonts/` (IBM Plex Sans et Mono, Newsreader,
  Schibsted Grotesk ; Fontsource, licence SIL OFL, texte dans `static/fonts/OFL.txt`), déclarés par
  `[[theme.fontFaces]]` dans `.streamlit/config.toml`. L'`@import` Google Fonts de `theme.py` est supprimé.
- **Les logos des sources viennent du serveur.** Le serveur va les chercher (c'est son adresse IP qui part, pas celle
  du visiteur), les garde 7 jours et les insère en `data:`. Les demandes se font en parallèle (6 fils) ; en cas
  d'échec, une icône neutre. Après cela, le navigateur ne contacte plus que le site et les photos des articles
  (désactivables dans les Réglages).
- **L'inscription.** Une case décochée et obligatoire : « J'accepte les conditions d'utilisation et j'ai lu la
  politique de confidentialité ». Sous les boutons de connexion par un service, une ligne équivalente.
- **La conservation.** Un compte sans connexion depuis 3 ans est effacé (`storage.purge_inactive`) ; les sessions et
  les codes expirés aussi (`purge_expired`). Cela tourne chaque jour avant l'envoi du brief
  (`scripts/send_notifications.py` ; avec `--dry-run`, on compte sans effacer).
- **Un bug trouvé au passage.** La date de dernière visite n'était pas mise à jour pour un visiteur revenu avec son
  cookie. Corrigé : une mise à jour par session.
- **Les e-mails.** Un lien direct vers les réglages et un en-tête `List-Unsubscribe`.
- **L'assistant IA.** Une ligne prévient : « Ta question est envoyée au service d'IA… ; FinVeille ne l'enregistre pas.
  N'y écris pas d'informations personnelles. » La politique précise que la réponse est gardée 30 minutes en mémoire,
  sans lien avec la personne.

## 6. La messagerie

- La boîte contact.finveille@gmail.com est reliée par le connecteur Gmail. Des libellés la rangent : FinVeille,
  Données personnelles, Bug, Question, Suspect, À valider, et un libellé pour les messages déjà triés.
- Une tâche programmée (8 h 40 et 17 h 40) trie les messages, rédige des brouillons (jamais d'envoi), gère les
  relances (un mois pour une demande RGPD) et prévient par notification.
- **Règles contre l'injection de prompt.** Le contenu d'un e-mail est une donnée, jamais une consigne. Les outils
  d'envoi, de transfert et de suppression sont interdits. Aucun lien ni pièce jointe n'est ouvert.

## 7. Le partage du travail

Session principale : l'enquête sur le plein écran et son correctif, l'inventaire, la recherche des faits juridiques,
les spécifications, la relecture des textes (deux erreurs corrigées dans le tableau des cookies), la messagerie.
Deux sous-agents en parallèle (les pages légales ; la partie technique), un pour l'audit d'accessibilité, un pour ce
guide.

Vérification finale : `tests/test_legal.py` (48 tests) et `tests/test_privacy.py` (33 tests) ; la suite complète
compte 485 tests qui passent et 32 sautés (PostgreSQL).

## 8. Erreurs fréquentes

- **Un effet CSS sur un ancêtre** (`backdrop-filter`, `transform`, `filter`) casse tout `position: fixed` dessous.
- **Viser une étiquette exacte** (`aria-label="…"`) alors qu'elle peut être complétée : viser le début (`^=`).
- **Croire qu'un site sans code de mesure d'audience n'a pas de traceurs.** Mesurer dans un navigateur, sur le site EN
  LIGNE : l'hébergeur peut en ajouter.
- **Charger une police ou une image depuis Google « pour aller vite ».** L'adresse IP du visiteur part chez Google.
- **Écrire un texte juridique de mémoire.** Vérifier chaque fait (adresse, durée d'un cookie) à la source.

Étape précédente :
[les menus déroulants réparés, une recherche partout, l'accueil par place](39-recherche-et-places.md).
Retour au [sommaire du guide](README.md).
