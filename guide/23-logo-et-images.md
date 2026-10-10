# Étape 23 — Un vrai logo et un fil illustré

> **Objectif :** donner à FinVeille une **identité qu'on reconnaît** (un symbole et un nom en deux couleurs) et une
> page d'accueil **illustrée** comme celle d'un journal en ligne : une grande photo à la une, des vignettes, une
> image pour chaque article. Gratuitement et sans stocker une seule image.

Fichiers créés : `core/images.py`, `tools/make_logo.py`, `assets/logo-light.svg`, `assets/logo-dark.svg`,
`tests/test_images.py`, ce guide. Fichiers modifiés : `assets/logo.svg`, `theme.py`, `ui.py`, `views/feed.py`,
`views/settings.py`, `app.py`, `README.md`.

---

## 1. Le logo

Un bon logo de site tient dans un carré de 16 pixels (l'onglet du navigateur) et se lit en un coup d'œil. Le
symbole de FinVeille assemble deux idées :

```
 ┌──────────────┐
 │ ███████████  │   la barre du haut et le jambage : la lettre F (Fin)
 │ ██           │
 │ ██  ╱╲  ╱●   │   la barre du milieu est une courbe de cours qui monte,
 │ ██ ╱  ╲╱     │   terminée par un point vert (Veille : on suit le marché)
 │ ██           │
 └──────────────┘
```

C'est un fichier **SVG** (`assets/logo.svg`) : une image décrite par des formes (`<rect>`, `<path>`, `<circle>`), nette
à toutes les tailles et qui pèse moins d'un kilo-octet.

Dans le site, le nom à côté du symbole est écrit **en CSS** : « Fin » dans la couleur du texte, « Veille » en bleu.
Il suit donc le thème clair ou sombre tout seul :

```css
[data-testid="stLogoLink"]::before { content: "Fin"; }
[data-testid="stLogoLink"]::after  { content: "Veille"; color: var(--fv-brand); }
```

Pour le README (GitHub), il faut une image complète. `tools/make_logo.py` transforme les lettres de la police
IBM Plex Sans en **tracés** (bibliothèque `fontTools`) : le logo s'affiche à l'identique même sur un ordinateur qui
n'a pas la police. Il en écrit deux versions, et le README choisit selon le thème du lecteur :

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg">
  <img src="assets/logo-light.svg" alt="FinVeille" height="56">
</picture>
```

---

## 2. Trouver une photo pour chaque article (og:image)

Certains flux RSS donnent une image (Cointelegraph, BBC), d'autres non (CNBC, The Economist). Mais **chaque page
d'article** en déclare une pour les réseaux sociaux : c'est elle qu'affichent LinkedIn ou WhatsApp quand on colle un
lien.

```html
<head>
  <meta property="og:image" content="https://images.site.com/photo-1200x630.jpg">
</head>
```

`core/images.py` va la chercher, avec quatre précautions :

| Précaution | Pourquoi |
| --- | --- |
| On ne lit que le **début** de la page (jusqu'à `</head>`, 300 Ko au plus) | L'image est déclarée dans l'en-tête : inutile de télécharger tout l'article. |
| Seulement pour la une et les 3 vignettes, **en parallèle** (6 à la fois), 3 secondes au plus | La page reste rapide. |
| Chaque adresse n'est lue **qu'une fois** (`@lru_cache`) | Les visites suivantes n'attendent plus. |
| Un site qui répond **403** (« interdit aux robots ») n'est plus sollicité | On respecte son refus, et on ne perd pas de temps. |

On ne **copie** aucune image : la page affiche l'image depuis le site de l'éditeur, comme le fait un réseau social.

---

## 3. Une couverture dessinée quand il n'y a pas de photo

Plutôt qu'un trou, un article sans photo reçoit une **couverture générée** (`theme.cover_html`) : un dégradé aux
couleurs de sa rubrique, le logo de la source et une courbe décorative. La courbe est tirée au hasard… mais avec le
**titre comme graine** :

```python
rng = random.Random(seed)   # même titre → mêmes nombres « au hasard » → même dessin à chaque visite
```

Dans le fil « En continu », la version réduite (`mini=True`) ne garde que le logo de la source : chaque ligne a
ainsi son image, et l'œil repère d'un coup d'œil d'où vient l'information.

### Le piège : `st.html` retire les `<svg>`

Pour la sécurité, `st.html` nettoie le HTML (bibliothèque DOMPurify) et **supprime les balises `<svg>`**. On ne
voit qu'un carré vide, sans message d'erreur. La solution : passer le dessin en **image** (`data URI`), que le
navigateur affiche sans pouvoir y exécuter de code :

```python
def svg_uri(svg: str) -> str:
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()

f'<img src="{svg_uri(svg)}" alt="">'                 # une icône
f'<div style="--art:url({svg_uri(svg)})">'            # un fond, utilisé par le CSS : background: var(--art)
```

---

## 4. La mise en page « journal »

```
 ┌────────────────────────────────────────────┐
 │  [ grande photo ]   CRYPTO · Cointelegraph  │   À la une : l'histoire la plus reprise
 │                     Titre en grand          │
 │                     Chapeau sur 5 lignes    │
 └────────────────────────────────────────────┘
 ┌────────────┐ ┌────────────┐ ┌────────────┐
 │  [ photo ] │ │  [ photo ] │ │  [ photo ] │       3 vignettes : une par rubrique si possible
 │  Titre     │ │  Titre     │ │  Titre     │       (pick_tiles), pour varier les sujets
 └────────────┘ └────────────┘ └────────────┘
 ┌────────────────────────────────────────────┐
 │  MARCHÉS · CNBC · 09:12            [image] │    En continu : une ligne par article
 │  Titre                                      │
 └────────────────────────────────────────────┘
```

Les vignettes sont étroites : leurs boutons n'affichent que l'icône (le texte reste dans l'infobulle), et la ligne
d'informations ne garde que l'heure. Sur téléphone, les colonnes s'empilent et l'illustration de la page de
connexion disparaît (`@media (max-width: 640px)`).

Les photos se désactivent dans *Réglages* ou dans le menu *Filtres* (« Photos des articles ») pour un fil plus
dense ou une connexion lente.

---

## 5. La page de connexion illustrée

À côté du formulaire, un panneau aux couleurs du logo rappelle ce que le compte apporte (favoris, portefeuille,
alertes, brief). Les pictogrammes sont dessinés en SVG dans `theme.py` (dictionnaire `_ICONS`) : aucun fichier à
télécharger, aucune bibliothèque d'icônes à installer.

---

## 6. Exercices

1. Ajoute des **drapeaux** devant les indices de la page *Marchés* (indice : `https://flagcdn.com/24x18/fr.png`).
2. Dans `cover_html`, remplace la courbe par des barres pour la rubrique « Macro ».
3. Crée une **image de partage** pour FinVeille (1200 × 630 pixels, le logo et une phrase) et déclare-la dans le
   dépôt GitHub (*Settings → Social preview*).

---

## 7. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Une icône ou un dessin n'apparaît pas, sans erreur | `st.html` a retiré la balise `<svg>` | Passe par `<img src="data:image/svg+xml;base64,…">` (§ 3). |
| Les images d'un site n'apparaissent jamais | Le site refuse les robots (403) ou n'a pas d'`og:image` | Normal : l'article reçoit une couverture dessinée. |
| La page met quelques secondes à s'afficher la première fois | Recherche des images de la une et des vignettes | Elle est mise en mémoire : les visites suivantes sont immédiates. |
| Le logo du README est noir sur fond noir | Une seule version du logo | Utilise `<picture>` avec les deux versions (§ 1). |
| Le nouveau logo n'apparaît pas dans l'onglet | Le navigateur garde l'ancienne icône en mémoire | Rechargement forcé : Ctrl + Maj + R. |

Étape suivante : [l'assistant IA](24-assistant-ia.md). Retour au [sommaire du guide](README.md).
