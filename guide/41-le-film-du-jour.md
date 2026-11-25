# Étape 41 — Le film du jour

L'accueil s'ouvre sur un « film » : les entreprises qui comptent aujourd'hui, en immeubles 3D, que la caméra montre
l'une après l'autre. Le reste du site prend le même style (titres et chiffres en Archivo, cartes nettes, variations
pleines).

## Ce que montre le film

- **Zone** (sous le film) : *Monde* par défaut — 28 géants mondiaux (`core/market.py::WORLD`) —, ou le CAC 40, le
  S&P/TSX 60, le Dow Jones. La zone suit l'adresse : `?place=france`.
- **Trier** : *Mix du jour* (les deux plus grosses, les deux plus fortes hausses, les deux plus fortes baisses),
  *Plus grosses*, *Hausses*, *Baisses* (`theme.film_stars`).
- Chaque immeuble : sa hauteur suit la capitalisation (`scene3d.WORLD_WEIGHTS`, en milliards de dollars, approchée :
  seule la hauteur relative compte), son toit est vert ou rouge selon la séance, son nom et sa variation flottent
  au-dessus.

Chaque jour a donc son film : rien n'est enregistré, tout vient des cours de la séance (gardés 10 minutes).

## Comment il marche

| Morceau | Rôle |
| --- | --- |
| `theme.film_html` | le HTML : titre, barres des scènes, un bandeau par entreprise, la maquette |
| `static/fv3d/models.js::skyline` | la rangée d'immeubles ; `pose("n:<nom>")` cadre la caméra, la tour s'allume |
| `static/fv3d/motion.js::installFilm` | fait défiler les scènes (6 s), pause au bouton, au survol, hors de l'écran |
| `static/fv3d/vitrines.js` | donne la scène en cours (`window.__fvFilm`) à la maquette |

La caméra garde toute la rangée à l'écran (à droite du texte sur grand écran) et se balance doucement. Avec les
mouvements réduits, le film ne défile pas tout seul : on clique sur les barres.

## Tester

```bash
python -m pytest tests/test_story.py
```
