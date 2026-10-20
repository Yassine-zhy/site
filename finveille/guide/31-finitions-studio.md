# Étape 31 — Finitions de studio : un bug, un design plus épuré, une signature, une bande-annonce

> **Objectif :** corriger le bouton « Se connecter » caché sur téléphone, épurer le site tout en lui donnant plus de
> relief (comme les sites de studio), signer le site, et filmer une bande-annonce.

Fichiers créés : `views/about.py`, `tools/trailer.py`, `docs/branding/trailer.mp4`, ce guide. Fichiers modifiés :
`theme.py`, `app.py`, `scene3d.py`, `static/fv3d/engine.js`, `tests/test_app.py`, `README.md`.

---

## 1. Le bug : le bouton « Se connecter » sous le bandeau des cours

Le bouton est placé dans la barre du haut avec `position: fixed`. Or un élément « fixe » se cale sur la fenêtre…
**sauf si un de ses parents a un `transform`** : il se cale alors sur ce parent. L'animation d'entrée des pages
(étape 29) déplaçait les blocs (`translateY(14px)` → position finale) avec `animation-fill-mode: both` : une fois
finie, elle **laissait** `transform: translateY(0)`. Le bouton suivait le bloc et tombait sous le bandeau.

```css
/* avant */ animation: fv-enter .5s … both;
/* après */ animation: fv-enter .5s … backwards;   /* une fois finie, plus aucun transform */
```

`backwards` applique la première image **avant** le départ (pas de saut), et ne garde rien **après**. Même
correction pour toutes les animations d'entrée. Sur téléphone, le bouton devient une icône (le texte reste lu par
les lecteurs d'écran) et le bouton « Stop » de Streamlit, qui le chevauchait, est caché.

## 2. Plus épuré, plus de relief

La règle (ui-ux-pro-max : *Minimalism & Swiss Style*, « éviter : mise en page encombrée ») : **retirer des boîtes,
ajouter de la profondeur**.

| Élément | Avant | Après |
| --- | --- | --- |
| Barre du haut | collée aux bords | une pilule de verre qui flotte |
| Bandeau des cours | une boîte | un simple filet |
| Places boursières | cinq pastilles | une ligne de texte |
| Titres de section | une barre de couleur | un point et un filet qui file jusqu'au bord |
| Cartes | opaques | verre dépoli devant le décor 3D (ordinateur) |
| Titres des pages | fixes | les mots montent l'un après l'autre derrière un cache |
| Bouton principal | — | un reflet passe au survol |

Deux ajouts de « site de studio » :

- **une intro** à l'arrivée (logo, nom, trait qui se remplit, le rideau se lève) : 1,6 s, une fois par visite ;
- **une barre de lecture** en haut de l'écran, liée au défilement en CSS pur (`animation-timeline`).

## 3. La signature

- Le pied de page : « Conçu et développé par **Yassine Zouhair** », le nom du site en très grand, un lien
  « Haut de page ».
- Une page **À propos** (menu Outils) : l'auteur, le projet en chiffres (calculés : nombre de sources, de termes,
  d'étapes), la pile technique.

## 4. La bande-annonce : filmer image par image

Un navigateur sans carte graphique dessine la 3D à quelques images par seconde : une capture d'écran en direct
serait saccadée. `tools/trailer.py` **arrête le temps** :

1. le moteur 3D avance de 1/30 s par image (`window.__fv3d.tick(33)`) ;
2. toutes les animations CSS aussi, grâce à la Web Animations API (`document.getAnimations()`, `currentTime`) ;
3. une capture, et on recommence. `ffmpeg` assemble les images en MP4.

Les changements de page passent par le menu du haut, comme un visiteur : les particules quittent la ville et forment
le globe. Résultat : `docs/branding/trailer.mp4` (1920 × 1080, 30 images/s).

> À l'étape 32, ce tournage devient `tools/footage.py` et la vidéo est montée en motion design avec Remotion
> (dossier `video/`) : voir [l'étape 32](32-recit-de-la-seance.md).

## 5. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Un élément `position: fixed` est mal placé | Un parent a un `transform` (même `translateY(0)`) | `animation-fill-mode: backwards` |
| L'intro se rejoue à chaque clic | Elle est dans un élément recréé | La placer avec la feuille de style, au début d'`app.py` |
| La vidéo est saccadée | Rendu plus lent que 30 images/s | Avancer le temps image par image |
| Le tournage ouvre le lien du pied de page | Deux liens « Marchés » dans la page | Viser `[data-testid=stTopNavDropdownLink]` |

Étape suivante : [un accueil qui raconte la séance](32-recit-de-la-seance.md). Retour au [sommaire du guide](README.md).
