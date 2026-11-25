# Étape 41 — Le film du jour

L'accueil s'ouvre sur deux cartes, sous le bandeau des marchés : à gauche un « film », les entreprises qui comptent
aujourd'hui en immeubles 3D, que la caméra montre l'une après l'autre ; à droite les cinq titres du moment (la une
ouvre le fil, juste dessous). Tout tient dans le premier écran : les dépêches arrivent sans long défilement. Le reste du site prend le même style (titres et chiffres en Archivo, cartes nettes, variations
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

Autour d'elles, un quartier compact posé sur son socle : un rang d'autres grandes valeurs de la zone, deux de part et
d'autre de chaque entreprise du jour, plus basses (toit vert ou rouge selon leur séance, leur nom au survol), et des
rues gravées où circulent des phares.

## Le mouvement dans tout le site

- à l'accueil, une seule entrée orchestrée : le film, puis les titres et les marchés, un reflet qui balaie la carte ;
- partout, le mouvement répond au visiteur : une lueur suit la souris sur les cartes et les tableaux, les tuiles de
  cours s'inclinent vers elle, les boutons s'enfoncent au clic (`motion.js::installSpotlight`) ;
- rien de tout cela au doigt ni avec les mouvements réduits.

## Comment il marche

| Morceau | Rôle |
| --- | --- |
| `theme.film_html` | le HTML : titre, barres des scènes, un bandeau par entreprise, la maquette |
| `static/fv3d/models.js::skyline` | la rangée d'immeubles ; `pose("n:<nom>")` cadre la caméra, la tour s'allume |
| `static/fv3d/motion.js::installFilm` | fait défiler les entreprises (4 s chacune) ; un clic sur une pastille ou un immeuble la montre et arrête le défilement 12 s ; pause au bouton, au survol, hors de l'écran |
| `static/fv3d/vitrines.js` | donne la scène en cours (`window.__fvFilm`) à la maquette |

La caméra garde toute la rangée dans la carte et se balance doucement ; seule l'entreprise montrée affiche sa variation. Avec les
mouvements réduits, le film ne défile pas tout seul : on clique sur les barres.

## Tester

```bash
python -m pytest tests/test_story.py
```

## Tout se clique

- un **immeuble** ou une **pastille** (nom, courbe d'un mois, variation) : le film montre cette entreprise ;
- le **bandeau** (rôle, nom, évolution sur un mois, capitalisation, cours) : sa fiche ;
- à droite, les **titres du moment** (l'article) et **les marchés** (CAC 40, S&P 500, bitcoin, EUR/USD, or : leur fiche).
