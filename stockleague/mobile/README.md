# StockLeague — application mobile

L'application Android de StockLeague : ligue boursière entre amis, avec portefeuille fictif et pronostics sur les résultats trimestriels.

> Argent fictif — à but ludique et éducatif — ceci n'est pas un conseil en investissement.

**Installer la démo :** copie `android/release/StockLeague-0.5-demo.apk` sur un téléphone Android 7 ou plus récent, ouvre-le et autorise « Installer des applis inconnues » pour l'appli qui l'ouvre (Fichiers, Chrome…).

## Nouveautés de la version 0.5 : « arcade financière »

- **Clair, lumineux, coloré** : chaque rubrique a sa couleur (orange accueil, violet ligue, bleu portefeuille, rose pronostics, menthe profil), blocs en dégradé, cartes blanches à ombre douce. Thème sombre « néon » disponible.
- **Illustrations 3D** (trophée, flamme, fusée, coffre, médailles…) pour les missions, titres, badges, récompenses et célébrations ; icônes vectorielles conservées pour la navigation.
- **Boutons « jeu » en relief** qui s'enfoncent sous le doigt, typographie Bricolage Grotesque.
- **Fluidité** : transitions à ressort entre écrans (Motion), feuilles qui se ferment d'un glissement, indicateur d'onglet qui glisse, classement qui se réordonne en animation, carte de pronostic qui suit le doigt avec inertie, confettis physiques. Flous d'arrière-plan supprimés (coûteux sur Android).

## Nouveautés de la version 0.4 : plus addictif

- **Soirée résultats** : quand une entreprise publie, le joueur révèle lui-même le chiffre (compte à rebours, BPA qui défile, verdict, points), puis voit l'impact en direct : « Tu passes devant Léa ! », score du duel mis à jour.
- **Mode rafale** : tous les pronostics de la semaine en cartes à glisser (droite = bat, gauche = manque), sentiment de tous les joueurs affiché, XP groupée à la fin.
- **Passe de saison** : 10 paliers débloqués avec l'XP de la saison, récompenses cosmétiques (cadres photo Carbone, Or massif, Néon, Légende ; titres ; gels de série). Aucun point de classement.
- **Gel de série** : un jour manqué est pardonné si tu en as un en réserve.
- **« Ta semaine » en story** : récap plein écran façon réseaux sociaux (rang, meilleur coup, pronostics, objectif de la semaine).
- **Notifications** : centre de notifications avec pastille (résultat à révéler, verrouillage proche, dépassement, chambrage).
- **Chambrer** un ami avec un message prédéfini, visible dans le fil.

## Nouveautés de la version 0.3 : refonte visuelle

- **Direction « retransmission de nuit »** : thème sombre par défaut (clair disponible), angles nets à 2 px partout, filets fins, un seul accent or, étiquettes inclinées façon habillage télé, onglets soulignés au lieu de boutons arrondis, listes pleine largeur.
- **Typographie de sport** : Barlow Condensed italique pour les titres et les scores, Barlow pour le texte.
- **Vraies photos** : chaque joueur importe la sienne ; les joueurs de la démo ont des portraits.
- **Une seule famille d'icônes vectorielles** (Phosphor), en deux tons, et des médaillons hexagonaux métalliques pour les titres et badges. Plus aucun émoji.
- **Podium en cartes de joueurs** avec photo, rang et points.

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
| Portraits des joueurs de démo | Unsplash | licence Unsplash (usage libre) |
| Illustrations 3D | Microsoft Fluent Emoji 3D | MIT |
| Icônes d'interface | Phosphor Icons | MIT |
| Police | Bricolage Grotesque | SIL OFL |
| Animations / confettis | Motion, canvas-confetti | MIT / ISC |

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | aperçu dans le navigateur (mode téléphone conseillé) |
| `npm test` | tests unitaires des règles du jeu |
| `npm run build:apk` | construit l'APK signé dans `android/release/` (Node + Java 11+, sans SDK Android) |
| `npm run assets` / `npm run icons` | télécharge logos, portraits et illustrations 3D / régénère les icônes du lanceur |

Pour publier une mise à jour, augmente `versionCode` dans `android/app.json` et garde la même clé (`android/keystore/`), sinon Android refuse la mise à jour.
