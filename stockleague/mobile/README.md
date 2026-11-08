# StockLeague — application mobile

L'application Android de StockLeague : ligue boursière entre amis, avec portefeuille fictif et pronostics sur les résultats trimestriels.

> Argent fictif — à but ludique et éducatif — ceci n'est pas un conseil en investissement.

**Installer la démo :** copie `android/release/StockLeague-0.2-demo.apk` sur un téléphone Android 7 ou plus récent, ouvre-le et autorise « Installer des applis inconnues » pour l'appli qui l'ouvre (Fichiers, Chrome…).

## Nouveautés de la version 0.2

- **Photo de profil** importée depuis la galerie, recadrage par glisser + zoom, pseudo modifiable.
- **Accueil quotidien** : « à faire maintenant » (prochain verrouillage), 3 missions du jour et coffre à récompense variable, défi éclair (S&P 500 en hausse ou en baisse), duel de la semaine contre un ami, rang et portefeuille en un coup d'œil.
- **Progression** : XP et 7 niveaux (de Stagiaire à Légende de Wall Street), série de jours consécutifs avec calendrier, célébrations (confettis, vibration), écran de passage de niveau.
- **Social** : réactions sur le fil d'activité.
- **Prise en main** : profil en 1 étape, tutoriel en 4 cartes, explication du BPA, pastille des pronostics à faire.

Ces mécaniques s'appuient sur les travaux sur la formation d'habitudes (déclencheur, action simple, récompense variable, investissement : modèle « Hooked » de Nir Eyal), l'effet de gradient d'objectif (on accélère près du but), l'aversion à la perte (série à ne pas casser) et la comparaison sociale. Elles ne distribuent que de l'XP : le classement de la ligue n'est jamais acheté ni faussé.

## Ce que contient la démo

Toutes les données sont fictives et stockées sur le téléphone. Les achats et les pronostics fonctionnent pour de vrai et sont conservés ; « Réinitialiser la démo » se trouve dans Profil.

- **Accueil, connexion** (lien magique, Google : visuel, le branchement Supabase arrive à l'étape suivante)
- **Ligue** : podium, trois classements (général, portefeuille, pronostics), évolution depuis la veille, titres du jour, bandeau des cours
- **Portefeuille** : valeur, rendement, courbe, répartition, positions, historique
- **Marché et fiche action** : recherche, vrais logos, cours, courbe, position
- **Ordre** : pavé numérique, en dollars ou en actions, frais, contrôle du cash et des quantités, marché ouvert / fermé
- **Pronostics** : à venir (compte à rebours de verrouillage), en attente (choix de la ligue révélés), résultats (points, séries)
- **Activité**, **profil**, **badges**, **joueur**, **mes ligues**, **créer / rejoindre une ligue**, **réglages admin**, **récap de fin de saison** (format carré et LinkedIn)

## Choix techniques

- React 19 + TypeScript strict + Tailwind 4, construit avec Vite.
- L'interface est embarquée dans un APK léger (1,2 Mo) : une activité Android affiche une WebView qui sert les fichiers hors-ligne. Le bouton retour du téléphone, la barre d'état et le thème clair / sombre sont gérés.
- Les règles du jeu sont des fonctions pures testées (`src/lib/`) : achat / vente, barème, séries, heures de marché de New York et verrouillage (changement d'heure compris). Elles reprennent exactement celles des futures fonctions Postgres.

### Ressources visuelles

| Ressource | Source | Licence |
| --- | --- | --- |
| Logos des entreprises (démo) | financialmodelingprep.com | marques de leurs propriétaires, usage d'identification |
| Icônes d'objets (trophée, boule de cristal…) | Microsoft Fluent Emoji Flat | MIT |
| Avatars illustrés | DiceBear « Notionists » | CC0 |
| Icônes d'interface | Phosphor Icons | MIT |
| Police | Archivo (Omnibus-Type) | SIL OFL |

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | aperçu dans le navigateur (mode téléphone conseillé) |
| `npm test` | tests unitaires des règles du jeu |
| `npm run build:apk` | construit l'APK signé dans `android/release/` (Node + Java 11+, sans SDK Android) |
| `npm run assets` / `npm run icons` | régénère logos, icônes, avatars / icônes du lanceur |

Pour publier une mise à jour, augmente `versionCode` dans `android/app.json` et garde la même clé (`android/keystore/`), sinon Android refuse la mise à jour.
