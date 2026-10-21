# Étape 33 — Des maquettes 3D dans la page, une bande-annonce en musique

> **Objectif :** sortir la 3D du simple décor, en posant de vraies maquettes (ville, globe, pièces, assistant) dans les
> pages, leur donner la matière du site plutôt qu'un look d'icône, et finir la bande-annonce sur de la musique.

Fichiers créés : `static/fv3d/vitrines.js`, `kit.js`, `models.js`, `atelier.js`, le dossier `static/fv3d/addons/`
(modules de Three.js : environnement, boîtes arrondies, effets), `tools/music.py`, `tools/vitrines_preview.py` (et son
`.html`), `video/public/music.mp3`, le dossier `.claude/` (skills et agents), `CLAUDE.md`, ce guide. Fichiers
modifiés : `scene3d.py`, `theme.py`, `views/feed.py`, `views/crypto.py`, `static/fv3d/engine.js`, `tools/footage.py`,
`video/src/Trailer.tsx`, `tests/test_market_theme.py`, `README.md`.

---

## 1. Ce que tu as demandé

Quatre demandes, dans cet ordre. Premièrement : « la ville, c'est un fond, je ne veux pas que ce soit que le fond »,
donc refaire l'ensemble des modèles 3D et les inclure dans le site. Deuxièmement : importer de nouveaux skills depuis
GitHub pour varier les modèles et économiser des tokens. Troisièmement, après un premier essai : « les modèles sont
moches et ne s'intègrent pas », avec la consigne d'être bien plus professionnel et de mettre plein de détails.
Quatrièmement : de la musique dans la bande-annonce, tout à la fin.

## 2. Répartir le travail entre les modèles

Les skills importés vivent dans le dossier `.claude/` à la racine du dépôt : les sessions suivantes les chargent.

| Skill | Dépôt (licence MIT) | À quoi il sert |
| --- | --- | --- |
| `agent-routing`, `down-skilling` | `github.com/oaustegard/claude-skills` | Choisir le modèle (Haiku, Sonnet, Opus) et l'effort de chaque sous-agent ; écrire des consignes que Haiku exécute de façon fiable |
| `threejs-materials`, `-postprocessing`, `-shaders`, `-geometry`, `-lighting`, `-textures`, `-performance` | `github.com/cloudai-x/threejs-skills` | Les bonnes pratiques Three.js, une par domaine |

Avant de les installer, nous avons vérifié qu'il n'y avait que du texte (Markdown), aucun script et aucune instruction
suspecte.

Ensuite, un agent par couple modèle-effort, comme le recommande `agent-routing` : `.claude/agents/haiku.md`,
`sonnet-low.md` et `sonnet-high.md`. Le fichier `CLAUDE.md` à la racine contient le tableau de répartition :

| Travail | Sous-agent |
| --- | --- |
| Lire l'architecture, lancer les tests, vérifier | `haiku` |
| Corriger un défaut précis, rédiger à partir de notes | `sonnet-low` |
| Écrire un module à partir d'une spécification (ici, 13 maquettes) | `sonnet-high` |

**La limite, honnêtement :** la session principale reste sur le modèle que tu as choisi avec `/model`. L'économie ne
vient donc pas d'elle mais des sous-agents : la lecture de l'architecture est partie à Haiku, les 13 maquettes à
Sonnet en effort haut, les vérifications à Haiku. Et on relit toujours ce qu'ils rendent.

## 3. Des objets dans la page, pas seulement derrière

`static/fv3d/vitrines.js` fait vivre les maquettes. Côté Python, `scene3d.vitrine()` et `scene3d.page_object()` écrivent
un emplacement dans la page :

```html
<div class="fv-obj" data-obj="globe" data-obj-data="{…}" role="img" aria-label="Globe des marchés"></div>
```

Au chargement, `vitrines.js` donne à chaque emplacement sa propre toile et son moteur WebGL. Ce que fait l'objet :

- au survol, il affiche un nom et un chiffre (un *raycaster* trouve la pièce sous la souris) ;
- au glisser, il tourne, avec de l'élan ; au repos, il se tourne un peu vers la souris ;
- quand rien ne bouge, **il ne dessine rien** ;
- avec « réduire les animations » : ni montage ni parallaxe.

Où ils se trouvent :

- **Les en-têtes de page** (`theme.hero_html(obj=…)`) : le texte à gauche, la maquette à droite, les tuiles de cours
  sous le titre. Sur téléphone, la maquette passe sous le texte.
- **L'accueil** : la maquette du CAC 40 est dans la scène collée du récit. Sa caméra suit le chapitre : Sanofi s'allume
  en vert, Schneider Electric en rouge, les autres s'effacent.
- **Le décor plein écran** (`engine.js`) devient une simple ambiance : terrain « calm », opacité 0,55. Le fichier passe
  de 1 338 à 869 lignes, car la ville, le globe, la chaîne, la sphère, les tours et la galaxie sont devenus des
  maquettes.
- **Sans WebGL**, ou si le navigateur refuse un contexte de plus, c'est l'illustration de l'étape 29 qui s'affiche
  (classe `fv-obj-fallback`).

## 4. Une première direction rejetée

Le premier essai était de la porcelaine blanche mate sur des socles d'encre. Le rendu ressemblait à une icône 3D
d'argile, étrangère à un site sombre. Ton verdict : « extrêmement moches, ne s'intègrent pas ».

**La leçon** (elle vient du skill `frontend-design`) : la matière des objets doit venir de l'interface elle-même, pas
d'un style choisi pour son effet. On ne retouche pas une direction qui part du mauvais endroit, on la reprend.

## 5. La matière du site

`kit.js` décide la matière d'après le **rôle** de la couleur dans la palette, pas d'après sa teinte :

```js
mat(pal.porcelain)           // verre sombre, avec un contre-jour bleu
mat(changeColor(pal, 2.9))   // lumière : la couleur est émise, elle brille
```

| Rôle de la couleur | Matière |
| --- | --- |
| `porcelain`, `relief`, `shade`, `plinth` | verre sombre, bordé d'un contre-jour bleu (effet de Fresnel, via `onBeforeCompile`) |
| `up`, `down`, `brand`, `ink`, `violet` | lumière |
| (métal) | `metal()` : métal sombre verni, `MeshPhysicalMaterial` avec `clearcoat` |

Trois ingrédients complètent la matière :

- **Le contour** : `outline()` trace des arêtes de lumière (`EdgesGeometry`, seuil de 32°) sur chaque volume.
- **Le sol** : la grille de points des en-têtes, un halo bleu, l'ombre seule (`ShadowMaterial`) et de la poussière de
  particules. Il n'y a plus de socle.
- **L'éclairage** : un environnement « pièce » (`RoomEnvironment` et PMREM) pour les reflets, un soleil avec ombres,
  deux contre-jours, un bleu et un violet.

## 6. Le niveau de détail

Quatre maquettes servent de référence. Les 13 autres ont été refaites au même niveau par un sous-agent Sonnet en
effort haut, à partir de ces quatre exemples.

- **La ville** : dalle de verre gravée du plan des rues (avenues, pointillés, passages piétons, lampadaires), fûts à
  façades de fenêtres allumées (chaud et froid, étages éteints), retraits et corniches pour les grandes tours, toits
  colorés par la séance, flèches à balise sur les trois plus lourdes. Les fenêtres s'allument une fois la tour montée.
- **Le globe** : pied tourné à gradins, méridien gradué tous les 5° avec pivots, atmosphère (*shader* de Fresnel),
  9 000 points de Fibonacci devenus des terres en colonnes hexagonales, lumières des villes, faisceaux colorés à la
  hauteur du mouvement, arcs lumineux depuis Paris.
- **Les pièces** : face frappée dessinée (grènetis, nom en couronne, symbole), relief (`bumpMap`), tranche cannelée à
  240 côtés, pile de six pièces, filet de la couleur de la séance.
- **L'assistant** : coque de verre, réseau de neurones lumineux (icosaèdre), cœur violet, trois orbites qui portent des
  fiches d'articles.

Le rendu passe par une chaîne d'effets, sur une toile **transparente** pour que la maquette se fonde dans la page :

```text
EffectComposer, puis UnrealBloomPass (le halo), puis OutputPass
tampon HalfFloat multiéchantillonné : MSAA 4 (2 sur téléphone)
```

Le thème clair garde les objets en verre sombre et n'a pas de halo : une lueur additive disparaît sur un fond clair.

## 7. La musique de la bande-annonce

`tools/music.py` compose le morceau par le code (numpy, scipy), sans échantillon extérieur :

- 120 BPM, ré mineur (progression i, VI, III, VII), 24 mesures, soit 48 s ;
- une nappe (scies polyBLEP filtrées), une basse, une grosse caisse, un charleston, un clap, un arpège avec écho
  ping-pong, des montées et des impacts ;
- une réverbération par convolution, une compression déclenchée par la grosse caisse, environ -14 LUFS ;
- le résultat est écrit dans `video/public/music.mp3`.

Le montage (`Trailer.tsx`) range chaque scène sur un nombre entier de mesures. À 120 BPM et 30 images par seconde, une
mesure fait 60 images. Avec `TransitionSeries`, une scène dure donc :

```text
durée d'une scène = n mesures × 60 images + 15 images de fondu
```

Toutes les coupes tombent ainsi sur un temps fort. La musique entre par `<Audio>` de `@remotion/media`, avec un fondu de
sortie. Côté image, `tools/footage.py` fait aussi avancer les maquettes (`window.__fvObjs.tick`), tourne le globe à la
souris et survole une pièce.

## 8. Vérifier

- `tools/vitrines_preview.py` (avec son `.html`) produit une planche de photos des maquettes sans lancer Streamlit.
  **Au plus 8 maquettes par planche** : chacune demande un contexte WebGL, et le navigateur en refuse au-delà.
- `pytest` : 232 tests passent, 28 sont ignorés. Un test couvre les emplacements (échappement du JSON, récit avec
  maquette).
- Des captures d'écran en thème sombre, en thème clair et sur téléphone.
- Audit d'accessibilité : AUDIT_RESULT.

## 9. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Le fond de la vitrine est plus clair que la page | Three.js convertit la couleur d'effacement avant de choisir le tampon hors écran | Toile transparente (alpha) |
| Un rectangle sombre entoure l'objet | Le halo (additif) écrivait aussi la transparence | Mélange personnalisé : couleur ajoutée, alpha conservé |
| La ville du récit ne se dessine pas | L'observateur d'intersection se trompe dans une scène collée (`sticky`) | Mesurer la position à chaque image |
| La ville rejoue son montage | Le récit est redessiné à l'arrivée des cours (nouvel élément) | Mémoire de 30 s des objets déjà montés |
| La maquette crypto est vide | CoinGecko limite les requêtes, la liste de pièces est vide | Pièces par défaut, sans chiffres |
| `WEIGHTS` a disparu de `scene3d.py` | Une découpe trop large | Restauré depuis Git |
| Les objets ressemblent à des icônes d'argile | Une matière étrangère au site | Reprendre la matière de l'interface |

Retour au [sommaire du guide](README.md).
