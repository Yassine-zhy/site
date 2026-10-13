# Étape 30 — Un monde en 3D derrière chaque page

> **Objectif :** donner au site l'effet « waouh » des sites primés (décor 3D qui se transforme au défilement), sans
> sacrifier la lisibilité ni la vitesse. Chaque page a son décor ; sur le fil, c'est la ville du CAC 40.

Fichiers créés : `scene3d.py`, `static/fv3d/engine.js`, `static/fv3d/land.js`, `static/fv3d/three.module.min.js`
(Three.js r170, licence MIT dans `THREE-LICENSE.txt`), `tools/make_land_mask.py`, ce guide. Fichiers modifiés :
`theme.py`, `ui.py`, `views/feed.py`, `views/markets.py`, `views/economy.py`, `tools/ux_audit.py`,
`.streamlit/config.toml`.

---

## 1. Comment font les sites « incroyables »

Le site de la vidéo (terminal-industries.com) joue un **film 3D pré-calculé** (fait par des artistes 3D), découpé
en images : la molette choisit l'image affichée. Nous faisons autrement : une **vraie scène 3D**, calculée par le
navigateur avec Three.js (WebGL), nourrie par **nos données**. Elle est moins photoréaliste, mais elle est vivante
et elle dit quelque chose.

| Page | Décor | Ce qu'il montre |
| --- | --- | --- |
| Le fil | La ville du CAC 40 | une tour par entreprise : hauteur = poids dans l'indice, couleur = séance ; les derniers titres défilent sur les bandeaux des plus hautes tours ; survol = nom |
| Marchés | Le globe | les continents en points, une colonne par place boursière (couleur = séance), étiquettes, capitaux qui circulent depuis Paris |
| Crypto | La chaîne de blocs | un bloc par jour, taille et couleur = variation du bitcoin ce jour-là |
| Assistant, Quiz | L'orbe | une sphère de particules qui respire |
| Simulateurs | L'escalier | les intérêts composés : chaque marche 20 % plus haute |
| Portefeuille | L'anneau | une répartition en 3D |
| Économie, Alertes, Brief… | Terrains | courbes des taux en crêtes, ondes autour d'un seuil, lever de soleil |
| Mes suivis, Favoris | Galaxie | tes centres d'intérêt en bras de spirale |

## 2. L'architecture

- `scene3d.py` déclare un **composant Streamlit** (`st.components.v2`) qui ne contient qu'un petit chargeur. Le
  serveur envoie le nom du décor et quelques données (moins de 3 Ko).
- Le moteur (`static/fv3d/engine.js`) et Three.js sont des **fichiers statiques** (`enableStaticServing = true`) :
  compressés (173 Ko pour Three.js) et mis en cache par le navigateur. La page n'attend jamais la 3D.
- Une **seule** scène WebGL, posée derrière l'application. En changeant de page, les **mêmes particules** quittent
  l'ancien décor et rejoignent le nouveau : c'est la transition entre les pages.

## 3. L'effet « rayons X »

Chaque décor a trois couches : particules, fils de fer, volumes pleins. Un **plan de scanner** horizontal
(`uScan`) sépare les deux dernières : en dessous, les volumes ; au-dessus, seulement les fils de fer et les
particules. À l'arrivée, le scanner monte et révèle la ville ; quand on fait défiler, il redescend et la ville passe
en rayons X, pendant que la caméra plonge. Tout se joue dans les shaders (`SOLID_FS` : `if (above > 0.0) discard;`).

## 4. La lisibilité d'abord, mesurée

- Le décor est entier dans l'en-tête, **atténué à gauche** sous le titre (masque CSS), et devient un fond discret
  (24 %, puis 14 %) derrière le contenu.
- Le CSS ne connaît pas la couleur d'un dessin WebGL : `tools/ux_audit.py` **photographie l'écran texte caché**
  et mesure le contraste de chaque texte posé sur le décor sur les vrais pixels (le pire cas, 5 % des pixels).
  Résultat : 0 point en sombre, sur ordinateur et sur téléphone.

## 5. Sobriété

- Téléphone : 9 000 particules (20 000 sur ordinateur), résolution réduite.
- Un écran lent passe tout seul en résolution 1 ; au repos, une image sur trois est dessinée.
- `prefers-reduced-motion` : une image fixe, aucune animation.
- Sans WebGL : les illustrations de l'étape 29 restent, rien ne casse.

## 6. Le fil, plus vivant

- La une et les vignettes **s'inclinent vers la souris**, avec un reflet qui suit le pointeur.
- Les photos se **développent** sous le passage du scanner ; les mots du titre de la une arrivent un à un.
- Les dépêches du fil en continu se redressent en entrant à l'écran (`animation-timeline: view()`).

## 7. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Rien ne s'affiche, « 404 » sur `app/static/…` | Service statique désactivé | `enableStaticServing = true` dans `.streamlit/config.toml`. |
| La toile 3D cache la page | Placée au-dessus du contenu | Premier enfant de `.stApp`, `z-index: 0`, rien de positionné devant. |
| `position: fixed` ne colle pas à l'écran | Un parent a un `transform` (animation d'entrée) | Placer la toile hors du contenu (dans `.stApp`). |
| Le texte d'un bandeau est à l'envers | Le tour de la tour est parcouru dans le mauvais sens | Parcourir les faces dans le sens de lecture vu de dehors. |
| On voit les murs du fond à travers ceux de devant | Faces tournées vers l'intérieur | Ordre des sommets des triangles inversé (`base, base + 2, base + 1`). |
| `Component 'fv3d' is not registered` (tests) | Nouvel environnement Streamlit | `scene3d.show` réenregistre le composant. |
| `StreamlitDuplicateElementKey` | Deux décors avec la même clé dans une page | Une autre clé pour la mise à jour tardive (`key="fv3d_cac40"`). |

Retour au [sommaire du guide](README.md).
