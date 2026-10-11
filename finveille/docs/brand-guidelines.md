# Charte de marque FinVeille

> Version 1.0 · octobre 2026 · source de vérité des couleurs et des règles visuelles.
> Les valeurs de cette charte sont celles du code : jetons CSS de `theme.py` (section 1) et palette de
> `.streamlit/config.toml`. Si l'une change, l'autre aussi. Le guide 26 explique le système.

## En bref

| Élément | Valeur |
| --- | --- |
| Promesse | L'actualité financière mondiale, triée et expliquée, en français |
| Couleur principale | Bleu FinVeille `#2451DE` (clair) / `#6D93FF` (sombre) |
| Couleur secondaire | Violet `#7C3AED` (clair) / `#A78BFA` (sombre), pour les dégradés seulement |
| Accent du logo | Menthe `#6EE7A8` (le point de la courbe) |
| Polices | IBM Plex Sans (interface), Newsreader (titres d'articles), IBM Plex Mono (chiffres) |
| Ton | Tutoiement, pédagogique, factuel, jamais de conseil d'investissement |

---

## 1. Positionnement

**Pour qui ?** Étudiants en finance, curieux de l'économie, petits épargnants : des lecteurs qui veulent
comprendre l'actualité des marchés sans payer un terminal professionnel.

**Ce qui nous distingue.** Toutes les sources au même endroit, classées, résumées et **expliquées**
(glossaire, fiches commentées, assistant qui cite ses sources). Gratuit, sans publicité.

**Piliers de message**

| Pilier | Ce qu'on dit | Preuve dans le site |
| --- | --- | --- |
| Tout voir | 12 flux, 4 API, cours mondiaux, statistiques officielles | Le fil, Marchés, Économie |
| Comprendre | Chaque chiffre a son explication | Glossaire, indicateurs expliqués, assistant |
| Faire confiance | On cite, on date, on montre la source | Liens vers l'article, « [1] » dans les réponses de l'IA |

---

## 2. Couleurs

Trois couches, comme dans le code : **primitifs** (les valeurs), **sémantiques** (le rôle), **composants**.
Un écran n'utilise jamais une couleur brute : il utilise un rôle (`--fv-brand`, `--fv-up`…).

### Marque

| Rôle | Clair | Sombre | Usage |
| --- | --- | --- | --- |
| Marque `--fv-brand` | `#2451DE` | `#6D93FF` | Liens, éléments actifs, pastilles |
| Marque 2 `--fv-brand-2` | `#7C3AED` | `#A78BFA` | Second ton des dégradés, jamais seul |
| Bouton principal | dégradé `#2451DE` → `#5B3FD9` | idem | Une seule action principale par écran |
| Fond de marque `--fv-brand-soft` | `#ECF1FF` | `#141F3D` | Fond des pastilles et des encadrés |

### Neutres

| Rôle | Clair | Sombre | Usage |
| --- | --- | --- | --- |
| Fond `--fv-bg` | `#F4F6FB` | `#060912` | Fond de page (deux halos bleu et violet en haut) |
| Surface `--fv-surface` | `#FFFFFF` | `#0C111D` | Cartes |
| Texte `--fv-text` | `#0B1220` | `#E8EDF6` | Titres, texte courant |
| Secondaire `--fv-muted` | `#566176` | `#96A2B9` | Sources, dates, légendes |
| Discret `--fv-faint` | `#8791A5` | `#5D6A83` | **Décor seulement** (points, filets) |
| Filet `--fv-line` | `#E2E7F0` | `#1A2335` | Bordures, séparateurs |

### Marchés

| Rôle | Clair | Sombre | Règle |
| --- | --- | --- | --- |
| Hausse `--fv-up` | `#047A3C` | `#34D17F` | Toujours avec ▲ ou un « + » |
| Baisse `--fv-down` | `#C8263A` | `#FF6375` | Toujours avec ▼ ou un « − » |
| Alerte `--fv-warn` | `#9A5B00` | `#F5B54E` | Avertissements, rubrique Macro |

La couleur ne porte jamais seule l'information : un daltonien doit lire la hausse grâce au signe.

### Rubriques

Marchés (bleu `#3987E5`), Crypto (orange `#D95926`), Entreprises (vert `#199E70`), Macro (ambre `#C98500`). La couleur de la rubrique colore sa
pastille, le liseré d'un article sans photo et les barres de « Par rubrique ».

### Contraste (WCAG 2.1, mesuré)

| Paire | Clair | Sombre | Niveau |
| --- | --- | --- | --- |
| Texte sur surface | 18,7:1 | 16,1:1 | AAA |
| Secondaire sur surface | 6,2:1 | 7,3:1 | AA |
| Marque sur surface | 6,4:1 | 6,5:1 | AA |
| Hausse sur surface | 5,4:1 | 9,5:1 | AA |
| Baisse sur surface | 5,5:1 | 6,5:1 | AA |
| Blanc sur bouton principal | 6,4 à 6,7:1 | idem | AA |
| Discret sur surface | 3,2:1 | 3,5:1 | Insuffisant : jamais pour du texte |

---

## 3. Typographie

| Police | Rôle | Pourquoi |
| --- | --- | --- |
| **IBM Plex Sans** | Interface, titres de page, boutons | Sobre, technique, très lisible en petit |
| **Newsreader** | Titres d'articles, édito du brief | Une police de presse : on lit un journal |
| **IBM Plex Mono** | Heures, cours, variations | Chiffres de même largeur : les colonnes s'alignent |

Les chiffres des tableaux et des tuiles utilisent toujours `font-variant-numeric: tabular-nums`.

| Élément | Taille | Graisse | Interligne |
| --- | --- | --- | --- |
| Titre de page | 30 à 42 px (s'adapte à l'écran) | 700 | 1,08 |
| Titre de section | 19 px | 650 | 1,3 |
| Titre « À la une » | 22 à 30 px, Newsreader | 600 | 1,18 |
| Titre d'article | 19 px, Newsreader | 600 | 1,3 |
| Chapeau, texte courant | 14 à 16 px | 400 | 1,55 à 1,65 |
| Légende, source | 12 à 13 px | 500 | 1,4 |
| Pastille (sur-titre) | 11 px, capitales, espacé | 700 | 1 |

---

## 4. Logo

Le symbole : un « F » blanc dont la barre du bas devient une **courbe de cours** qui monte, terminée par
un point menthe. Fond carré arrondi en dégradé bleu.

| Version | Fichier | Usage |
| --- | --- | --- |
| Symbole | `assets/logo.svg` | Icône du site, réseaux, petite taille |
| Logo complet, fond clair | `assets/logo-light.svg` | README, documents clairs |
| Logo complet, fond sombre | `assets/logo-dark.svg` | Thème sombre, bannières |

**Dans le nom**, « Fin » prend la couleur du texte et « Veille » la couleur de marque (en dégradé dans
l'en-tête du site).

**Espace libre** : autour du logo, au moins la moitié de la hauteur du symbole. **Taille minimale** :
24 px pour le symbole, 120 px de large pour le logo complet.

À ne pas faire : déformer, faire pivoter, changer les couleurs, ajouter une ombre, poser le logo sur une
photo chargée, séparer le point menthe de la courbe.

---

## 5. Images et direction artistique

### Les photos d'articles

- **Une photo seulement si c'est la vraie** : celle de l'article (image de partage). Sans photo, l'article
  passe en version texte, avec le liseré de couleur de sa rubrique. Jamais d'image de remplacement ni
  d'illustration générée à la place d'une photo d'article.
- Les photos sont recadrées (`object-fit: cover`), coins arrondis comme les cartes, chargées en différé.
- Les logos des sources s'affichent en 16 px à côté de leur nom.

### Le concept : « le terminal de nuit »

Une salle des marchés la nuit : des écrans bleu nuit, des lignes de cours qui s'allument, du verre. Tout le décor
du site en découle (`art.py`, guide 29) :

| Motif | Où | Règle |
| --- | --- | --- |
| **La ligne de cours** | En travers de chaque en-tête | Elle reprend la courbe du logo : monte de gauche à droite, finit par le point menthe qui pulse |
| **Les halos** | Derrière l'en-tête | Bleu et violet, très flous, ils dérivent en 24 à 31 s ; bords toujours fondus |
| **Le panneau de verre** | À droite de l'en-tête des pages | Une fenêtre (trois points), une grille, le motif de la page au trait dégradé bleu → violet, un accent menthe |
| **Le quadrillage** | Derrière l'en-tête | Papier millimétré de salle de marché, effacé par un masque |

Les illustrations sont **dessinées à la main en SVG** (aucune image d'autrui, aucune image générée), une par page :
journal (brief), bulle et citation (assistant), blocs reliés (crypto), barres (en chiffres), courbes croisées
(comparer), anneau (portefeuille), cloche et seuil (alertes), signets (favoris), cible (suivis), pièces et courbe
(simulateurs), carte question (quiz), livre (glossaire), réglages, personne et bouclier (compte), engrenages.

### Le mouvement

| Moment | Effet | Durée |
| --- | --- | --- |
| Ouverture d'une page | Le contenu arrive en cascade (8 éléments au plus) | 500 ms, 40 ms d'écart |
| En-tête | La ligne et les illustrations se dessinent ; le dégradé du titre balaie le texte une fois | 1,6 à 2 s |
| Défilement | Cartes, tableaux, graphiques apparaissent en entrant à l'écran | lié au défilement |
| Mini-courbes | Elles se tracent de gauche à droite | 1,1 s |
| Repos | Halos qui dérivent, illustration qui flotte de 10 px, point menthe qui pulse | 3 à 31 s |

Règles : le mouvement accompagne, il ne bloque jamais la lecture ; rien ne se rejoue en boucle sur un contenu qui
se met à jour (en-tête du fil) ; **tout s'arrête** si le visiteur demande moins d'animations à son système.

---

## 6. Ton et vocabulaire

| On est | On n'est pas |
| --- | --- |
| Pédagogue : on explique le terme technique la première fois | Jargonneux |
| Factuel : un chiffre, une date, une source | Sensationnaliste (« krach ! », « explosion ! ») |
| Direct et proche : on tutoie | Familier ou moqueur |
| Prudent : « à titre d'information » | Prescripteur : jamais « achète », « vends » |

| Contexte | Exemple |
| --- | --- |
| Titre de page | « Le fil de l'actualité financière » |
| Aide | « Le PER compare le prix de l'action aux bénéfices : 15 veut dire 15 ans de bénéfices. » |
| Erreur | « Cette source ne répond pas : on affiche les dernières données reçues. » |
| État vide | « Aucune dépêche pour cette recherche. Essaie un mot plus court. » |
| IA | « D'après les dépêches du moment [1][2]… Ceci n'est pas un conseil d'investissement. » |

**Mots maison** : « dépêche » (pas « news »), « le fil », « la une », « le brief », « mes suivis ».
Nombres à la française : `3,52 %`, `2 512,0 Md€`, `+1,13 %`, espace insécable avant `%` et `€`.

---

## 7. Composants (rappel)

| Composant | Règle |
| --- | --- |
| Carte | Surface, filet 1 px, rayon 14 px, ombre douce ; se soulève de 2 px au survol |
| Tuile de cours | Liseré haut vert ou rouge selon la tendance, mini-courbe 96 × 34 |
| Pastille | Rayon complet, capitales 11 px, fond `--fv-brand-soft` |
| Bouton principal | Dégradé de marque, texte blanc, un seul par écran |
| Chiffre clé | Voile de marque, liseré dégradé de 3 px en haut, valeur 1,85 rem |
| Sélecteur segmenté | Rail en creux, choix actif en relief à la couleur du texte |
| Champ de saisie | Surface, bordure, halo de marque au focus |
| Graphique | Couleurs `SERIES_COLORS` en ordre fixe, série de comparaison en gris, texte à l'encre, étiquettes au bout des courbes |
| Cible tactile | 44 px de haut au minimum sur écran tactile |
| Animation | 150 à 450 ms ; coupée si l'utilisateur demande moins de mouvement |

---

## 8. Avant de publier (liste de contrôle)

- [ ] Couleurs prises dans les jetons, aucune valeur brute ajoutée dans un composant
- [ ] Contraste du texte ≥ 4,5:1 en clair **et** en sombre
- [ ] Hausse et baisse lisibles sans la couleur (signe ou flèche)
- [ ] Aucune image de remplacement : vraie photo ou rien
- [ ] Tutoiement, pas de conseil d'investissement, source citée
- [ ] Testé sur téléphone (390 px) et en mode sombre
