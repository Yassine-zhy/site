# Étape 26 — Refaire le design : un système de jetons, une charte, des visuels

> **Objectif :** passer d'un site « propre » à un site **beau et cohérent**, comme un produit fini : une seule
> source pour les couleurs (les **jetons**), des composants redessinés, plus aucune image inventée, une
> accessibilité mesurée, une **charte de marque** écrite et des **visuels** prêts pour LinkedIn et GitHub.

Fichiers créés : `docs/brand-guidelines.md`, `docs/branding/` (feuille de style, bannière LinkedIn, aperçu GitHub,
script d'export), ce guide. Fichiers modifiés : `theme.py`, `ui.py`, `views/feed.py`, `app.py`,
`.streamlit/config.toml`, `core/assistant.py`, `tests/test_images.py`, `tests/test_assistant.py`, `README.md`,
`docs/screenshots/`, guide 23.

---

## 1. Le diagnostic

Avant de toucher au code, on regarde le site comme un visiteur, et on note ce qui gêne :

| Problème | Pourquoi ça gêne |
| --- | --- |
| Des « couvertures dessinées » pour les articles sans photo | Une image qui n'apprend rien : l'œil s'y arrête pour rien |
| Des aplats gris partout | Pas de profondeur : on ne sait pas où regarder en premier |
| Des couleurs écrites en dur dans 40 endroits | Changer un bleu, c'est 40 modifications (et 3 oublis) |
| Des boutons de 29 px sur téléphone | Trop petits pour un pouce (il faut 44 px) |
| Des gros chiffres trop serrés (« 2512,0Md€ ») | Illisibles d'un coup d'œil |

Les deux premiers sont des questions de goût ; les trois derniers sont des **règles** qu'on peut vérifier.

---

## 2. Les jetons de design, en trois couches

Un **jeton** est une variable CSS qui porte une décision de design. On les range en trois couches :

```
 Primitifs            Sémantiques                    Composants
 (les valeurs)        (le rôle)                      (l'usage précis)
 --blue-600: #2451de  --fv-brand: light-dark(        --btn-primary-bg: linear-gradient(
 --blue-400: #6d93ff      var(--blue-600),               135deg, var(--blue-600), var(--violet-600))
                          var(--blue-400))           --accent-bar: linear-gradient(...var(--fv-brand)...)
```

- Les **primitifs** sont la palette brute : `--ink-*` (gris clairs), `--night-*` (bleus nuit), `--blue-*`,
  `--green-*`, `--red-*`, `--amber-*`, plus les espacements (`--space-1` = 4 px … `--space-10` = 40 px), les rayons et
  les durées d'animation.
- Les **sémantiques** disent à quoi sert une couleur : fond, surface, texte, secondaire, marque, hausse, baisse…
  C'est ici, et **seulement ici**, que se fait la différence entre le thème clair et le thème sombre, avec
  `light-dark(clair, sombre)`.
- Les **composants** (bouton principal, carte, pastille) piochent dans les sémantiques.

La règle d'or : **un composant n'utilise jamais une couleur brute**. Pour changer de bleu de marque, on modifie une
ligne ; pour ajouter un thème, on réécrit la couche sémantique et rien d'autre.

```css
/* theme.py, section 1 (extrait) */
--fv-surface: light-dark(var(--ink-0), var(--night-850));
--fv-up:      light-dark(var(--green-700), var(--green-400));   /* hausse */
--card-bg: var(--fv-surface); --card-radius: var(--radius-lg); --card-shadow: var(--fv-elev);
```

Les couleurs du thème Streamlit lui-même (boutons, champs) sont réglées dans `.streamlit/config.toml`, sections
`[theme.light]` et `[theme.dark]`, avec les mêmes valeurs (fond `#F4F6FB` / `#060912`, texte `#0B1220` / `#E8EDF6`).

---

## 3. Les composants redessinés

**Le fond de page.** Deux halos très doux (bleu en haut à gauche, violet en haut à droite) posés sur le fond :
une profondeur qu'on sent sans la voir.

**L'en-tête de page.** Une carte avec un quadrillage de papier millimétré, qui s'efface vers la gauche grâce à un
**masque** (`mask-image`) : le texte reste sur fond calme, le motif n'apparaît que derrière le vide.

```css
.fv-pagehead::before { background-image: linear-gradient(var(--fv-line) 1px, transparent 1px),
                                         linear-gradient(90deg, var(--fv-line) 1px, transparent 1px);
  background-size: 28px 28px;
  -webkit-mask-image: linear-gradient(105deg, transparent 35%, #000 100%);   /* Safari veut le préfixe */
  mask-image: linear-gradient(105deg, transparent 35%, #000 100%); }
```

Le sur-titre (« MARCHÉS », la date du jour) devient une **pastille** avec un point en dégradé ; le titre s'adapte à
la largeur de l'écran avec `clamp(1.9rem, 3.6vw, 2.65rem)`.

**Les tuiles de cours.** `quote_tile` ajoute la classe `is-up` ou `is-down` : un liseré vert ou rouge en haut, un
léger dégradé de la même couleur, la variation dans une pastille, et la tuile se soulève de 2 px au survol.

**Le fil.** Au survol d'un article, une barre de marque apparaît à gauche ; les titres passent à 19 px en
Newsreader (la police de presse). **Le pied de page** reprend le logo, les liens principaux et l'origine des données.

---

## 4. Une vraie photo, ou rien

À l'étape 23, un article sans photo recevait une couverture générée. Le problème : sur un site d'information, une
image **promet** quelque chose (une scène, une personne). Une image inventée trompe un peu, et alourdit la page.

Désormais :

- **À la une, sans photo** : le titre s'affiche en très grand, avec un liseré de 4 px de la couleur de la rubrique.
- **Les vignettes** : `pick_tiles` choisit des dépêches **avec une vraie photo**, une par rubrique si possible. Une
  rangée doit rester homogène : avec au moins 2 photos on ne garde que des vignettes illustrées, sinon toutes
  passent en version texte (liseré en haut, chapeau sur 3 lignes).
- **En continu** : une miniature seulement si l'article a sa photo.

```python
# ui.py, article_html : sans image, une classe « no-media » et la couleur de la rubrique en variable CSS
return f'<article class="{classes}{extra} no-media" style="--c:{color}">…</article>'
```

```css
.fv-item.layout-lead.no-media { border-left: 4px solid var(--c); }
.layout-tile.no-media { border-top: 3px solid var(--c); }
```

Le test `test_no_placeholder_image_when_there_is_no_photo` vérifie qu'un article sans photo ne reçoit aucune
image (seul reste le petit logo de la source) et passe bien en version texte.

---

## 5. Vérifier l'accessibilité (au lieu de l'espérer)

**Le contraste.** Le texte doit atteindre **4,5:1** sur son fond (norme WCAG AA). On le calcule avec la formule de
luminance relative (le test `tests/test_market_theme.py` le fait pour les couleurs principales) :

| Paire | Clair | Sombre |
| --- | --- | --- |
| Texte sur carte | 18,7:1 | 16,1:1 |
| Secondaire (sources, dates) | 6,2:1 | 7,3:1 |
| Hausse / baisse | 5,4 / 5,5:1 | 9,5 / 6,5:1 |
| « Discret » `--fv-faint` | 3,2:1 | 3,5:1 |

Le gris « discret » échoue : il est réservé au **décor** (points, filets). La note du pied de page, qui l'utilisait,
est passée en couleur secondaire.

**Les cibles tactiles.** Sur un écran tactile, chaque bouton fait au moins 44 px de haut. On ne pénalise pas la
souris : la règle ne s'applique qu'aux écrans qu'on touche du doigt.

```css
@media (pointer: coarse) { [class*="st-key-fvcard_"] button, .st-key-fvtrends button { min-height: 44px; } }
```

**Le mouvement.** Le bandeau défilant, les survols et le point qui pulse s'arrêtent si le visiteur a demandé moins
d'animations à son système (`@media (prefers-reduced-motion: reduce)`).

**Les chiffres.** `font-variant-numeric: tabular-nums` : tous les chiffres ont la même largeur, les colonnes
s'alignent. Et un espacement de lettres trop serré (`-.03em`) colle les chiffres : `-.015em` suffit.

**La couleur ne parle jamais seule** : une hausse a toujours son ▲ et son « + », pour les daltoniens.

---

## 6. La charte de marque

`docs/brand-guidelines.md` met par écrit ce que le code applique : la promesse, les couleurs (avec leur rôle et leur
contraste mesuré), les trois polices et pourquoi, les règles du logo, le ton (tutoiement, pédagogique, factuel,
jamais de conseil d'investissement), les mots maison (« dépêche », « le fil », « la une ») et une liste de contrôle
avant publication. Elle sert à garder le même style quand le projet grandit, ou quand quelqu'un d'autre y contribue.

---

## 7. Les visuels pour LinkedIn et GitHub

Les visuels sont des pages **HTML** (`docs/branding/`), exportées en PNG par un navigateur sans fenêtre :
on les modifie comme le site, avec les mêmes jetons (`brand.css`) et une vraie capture de la page *Marchés*.

```bash
pip install playwright && playwright install chromium
python docs/branding/render.py       # → linkedin-banner.png (3168 × 792) et social-preview.png (1280 × 640)
```

| Visuel | Taille | Où le mettre |
| --- | --- | --- |
| `linkedin-banner.png` | 1584 × 396 (exporté en double, plus net) | Profil LinkedIn → crayon sur la bannière |
| `social-preview.png` | 1280 × 640, moins de 1 Mo | Dépôt GitHub → *Settings* → *General* → *Social preview* |

Deux règles de composition : sur LinkedIn, la **photo de profil** couvre le coin bas gauche, donc rien d'important
avant 400 px ; sur GitHub, on garde une **marge de 40 px** sur chaque bord. Et on n'utilise **aucune photo de presse**
(elles appartiennent aux médias) : la capture de *Marchés* ne contient que nos propres tuiles et courbes.

---

## 8. Exercices

1. Ajoute un troisième thème, « sépia », en ne modifiant **que** la couche sémantique.
2. Écris un test qui échoue si une couleur hexadécimale (`#…`) apparaît dans le CSS de `theme.py` hors de la
   section 1 (seule exception : le `#000` des masques, qui n'est jamais affiché).
3. Crée l'image de partage pour Instagram (1080 × 1080) à partir de `social-preview.html`.

---

## 9. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| `base = "dark"` dans `config.toml` ne change rien | Avec `[theme.light]` **et** `[theme.dark]`, Streamlit suit le système | Normal : le visiteur choisit dans le menu ⋮ (Système, Clair, Sombre). |
| Une couleur reste claire en thème sombre | Couleur écrite en dur dans un composant | Passe par un jeton sémantique `light-dark(…)`. |
| Le quadrillage couvre tout l'en-tête sur Safari | `mask-image` sans préfixe | Ajoute `-webkit-mask-image` avec la même valeur. |
| Les gros chiffres se chevauchent | `letter-spacing` trop négatif | Pas moins de `-.015em` sur des chiffres. |
| Une capture d'écran montre une page vide | Prise avant la fin du chargement | Attendre un texte précis (`get_by_text("En continu")`), pas un délai fixe. |
| Les polices des visuels sont différentes | Export avant le chargement des polices | `render.py` attend `document.fonts.ready`. |

Étape suivante : [des pages aussi belles que la bannière](27-pages-principales.md). Retour au [sommaire du guide](README.md).
