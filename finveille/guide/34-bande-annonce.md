# Étape 34 — Une vraie bande-annonce du site, et des maquettes réparées

> **Objectif :** remplacer la vidéo « séance du jour » par un film de lancement qui montre tout ce que le site contient,
> monté selon les règles du métier, et réparer les maquettes 3D qui devenaient noires sur une vraie carte graphique.

Fichiers créés : `tools/vitrines_film.py`, les skills de `.claude/skills/` listés plus bas, ce guide. Fichiers modifiés :
`static/fv3d/atelier.js`, `static/fv3d/vitrines.js`, `tools/footage.py`, `tools/music.py`, `tools/vitrines_preview.html`,
`video/src/Trailer.tsx`, `video/src/Root.tsx`, `video/README.md`, `video/.gitignore`, `docs/branding/trailer.mp4`,
`README.md`. Supprimés : `video/public/data.json`, `video/public/mobile.jpg`.

---

## 1. Ce que tu as demandé

Deux choses. Un bug : sur la page Économie, « quand je passe dessus, ça fait noir ou blanc, le modèle n'est pas fixe ».
Et la bande-annonce : pas un bulletin du jour, mais « un trailer du site, qui montre tout ce qu'il y a », monté « comme
par un mec qui a quinze ans d'expérience dans le montage », avec des skills de montage importés de GitHub.

## 2. Le bug : une silhouette noire ou blanche

Ta capture montrait la maquette des courbes des taux réduite à des aplats noirs. Le navigateur des tests (sans carte
graphique) ne le montrait pas : il fallait chercher dans les données plutôt que dans l'image.

Un contrôle des normales de toutes les maquettes a trouvé le coupable. Une **normale** dit dans quelle direction regarde
une surface ; la lumière en dépend. Les rubans des taux et les engrenages contenaient des **triangles plats** :

- trois points alignés sur une portion droite d'une courbe (le triangle n'a pas de surface) ;
- un cercle qui se referme sur son premier point (deux points confondus).

Un triangle plat a une normale nulle. Sur une vraie carte graphique, `normalize(0)` donne **NaN** (« pas un nombre »),
et l'effet de halo, qui floute l'image, étale ce seul pixel sur tout l'objet : noir ou blanc selon la carte, et ça
change à chaque mouvement de la souris. Un test le reproduit à l'identique en injectant volontairement un pixel NaN.

Deux corrections, l'une à la source, l'autre en garde-fou :

```js
// atelier.js : une extrusion sans triangle plat
const out = pts.filter((p, i) => p.distanceToSquared(pts[(i + 1) % pts.length]) > 1e-12);   // points confondus
return out.filter((p, i) => {   // le point du milieu de trois points alignés n'apporte rien à la forme
  const a = out[(i + out.length - 1) % out.length], c = out[(i + 1) % out.length];
  return Math.abs((p.x - a.x) * (c.y - p.y) - (p.y - a.y) * (c.x - p.x)) > 1e-9;
});
```

```glsl
// vitrines.js : un pixel invalide n'entre pas dans le halo
if (any(isnan(texel)) || any(isinf(texel))) texel = vec4(0.0);
```

**La leçon :** ce qui marche dans le navigateur de test peut casser sur une vraie carte graphique. Un contrôle des données
(ici, aucune normale nulle dans les 17 maquettes) vaut mieux qu'une capture d'écran.

## 3. Des skills de montage, importés de GitHub

| Skill | Dépôt (licence) | À quoi il sert |
| --- | --- | --- |
| `motion-art-direction` | `github.com/iart-ai/motion-design-skills` (MIT) | Fixer un langage du mouvement avant d'animer : une courbe, une unité de temps, une famille de transitions |
| `beat-sync-editing` | idem | Couper sur la musique, construire un arc, raccords, montée avant le drop |
| `shot-composition` | idem | Grilles, zones sûres, un seul point focal, un mouvement de caméra par plan |
| `animation-principles`, `color-motion`, `logo-animation`, `motion-background`, `remotion-video` | idem | Les principes d'animation, la couleur en mouvement, l'animation d'un logo, les fonds animés, Remotion |
| `playwright-recording`, `ffmpeg` | `github.com/digitalsamba/claude-code-video-toolkit` (MIT) | Filmer un site, préparer les vidéos |

Écartés : **OpenMontage**, sous licence AGPL (elle s'étendrait au projet), et les skills officiels de **Remotion**, sans
licence déclarée (lus, pas copiés). Avant d'importer, on a vérifié qu'il n'y avait que du texte et de petits scripts
ffmpeg inoffensifs.

## 4. La direction artistique, avant la première image

Le skill `motion-art-direction` impose de décider avant d'animer. Le résumé :

- **L'intention :** « FinVeille réunit l'actualité financière, les marchés et des outils, en français, dans un seul
  site. » Trois adjectifs : précis, nocturne, ambitieux.
- **Le ton :** calme et net, celui de la fintech haut de gamme. Aucun rebond (*overshoot*) : sur un sujet financier,
  ça fait jouet.
- **Le langage du mouvement :**

| Propriété | Choix unique |
| --- | --- |
| Courbe d'arrivée (90 % des mouvements) | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Courbe de sortie | `cubic-bezier(0.7, 0, 0.84, 0)` |
| Unité de temps | 1 temps de la musique = 15 images |
| Transitions | coupe franche par défaut, quelques raccords, un seul flash blanc (le drop), un fondu au noir à la fin |
| Caméra | un seul mouvement par plan : une poussée lente, de 1,00 à 1,06 |

- **Un seul héros par image :** dans un plan filmé, la séquence ; la légende reste petite, en bas à gauche.
- **Une signature :** la ligne de cours du logo. Elle se dessine à l'ouverture, se replie en logo, revient à la fin.
  Nulle part ailleurs : une signature répétée partout n'en est plus une.

## 5. Le montage, calé sur la musique

À 120 battements par minute et 30 images par seconde, un temps dure 15 images et une mesure 60 (skill
`beat-sync-editing`). Chaque coupe tombe sur un temps, chaque section sur une mesure : 34 mesures, 2 040 images, 68 s.

| Mesures | Section | Rythme des coupes |
| --- | --- | --- |
| 1-4 | L'accroche : « Chaque jour, des milliers de dépêches. », des colonnes de titres qui défilent | un seul plan, qui respire |
| 5-6 | Le logo : la ligne de cours se replie en logo, sur un impact | un seul plan |
| 7-12 | S'informer : le récit 3D, le fil, la recherche, le brief, l'assistant | toutes les 2 mesures, puis chaque mesure |
| 13-18 | Comprendre les marchés : le globe cliqué, la carte du CAC 40, les taux, la crypto, le comparateur | chaque mesure |
| 19-20 | La montée : « Chaque page a sa maquette 3D. Et chacune répond au clic. » | un carton ; silence total sur le dernier demi-temps |
| 21-24 | Le drop : les 16 maquettes en plein cadre, une par temps | chaque temps (15 images) |
| 25-26 | La grille des 17 maquettes | un plan qui recule |
| 27-30 | Tes outils : portefeuille, alerte, simulateurs, téléphone et thème clair | chaque mesure, en demi-tempo |
| 31-34 | La signature : logo, adresse, « Un projet de Yassine Zouhair, étudiant en finance » | un long plan, fondu au noir |

C'est l'arc du métier : **établir** (des plans longs), **développer** (des coupes de plus en plus rapprochées),
**l'apogée** (le drop, la plus grande image sur le temps fort), puis **résoudre** (un long plan qui laisse respirer).

Les raccords : la sphère de l'assistant devient le globe des marchés (même cercle, même place) ; à la fin, tout
s'efface sauf la ligne de cours.

## 6. La musique et l'habillage sonore, par le code

`tools/music.py` suit la grille : une accroche sans batterie, un tic-tac et une sous-basse qui gonfle, un impact sur
le logo, la grosse caisse à la mesure 7, une montée (la caisse claire accélère, le bruit blanc monte, le filtre s'ouvre),
**un silence total juste avant le drop**, des accords larges sur le drop, un demi-tempo pour les outils, un dernier
accord qui s'éteint.

Un piège : tout est normalisé à -14 LUFS (le niveau des plateformes), et le drop ne ressortait que de 1 dB. La solution
est celle d'un mixeur : une **automation de volume** par section, avant la normalisation (-3 dB pour « S'informer »,
-1,5 dB pour les marchés). Résultat mesuré : « S'informer » à -19,6 dB, les marchés à -16,6, le drop à -14,4.

L'habillage sonore est fait de fichiers séparés (`video/public/sfx/`), placés par le montage : un souffle dont le sommet
tombe sur chaque changement de section, des impacts (logo, drop, signature), un clic aux clics filmés, une cloche quand
la cloche sonne, des frappes quand « Sanofi » se tape, un petit tic à chaque maquette du drop.

## 7. Les images

- **Le site** (`tools/footage.py`) : toujours filmé image par image (le temps de la page s'arrête entre deux captures),
  avec de nouvelles séquences : le globe cliqué, l'alerte, la recherche, l'économie, la carte du CAC 40, le
  comparateur, le portefeuille, les simulateurs, le brief, le thème clair, le téléphone.
- **Les clics :** un clic sur une maquette fait défiler la page en temps réel, ce qui casse le tournage image par
  image. Un crochet, `window.__fvObjs.scroller`, laisse le tournage mener le défilement lui-même.
- **Le curseur :** une capture sans écran ne le montre pas. Le tournage enregistre sa position à chaque image
  (`<séquence>.cursor.json`), et le montage dessine une flèche, avec un cercle quand on clique.
- **Les maquettes** (`tools/vitrines_film.py`) : chacune seule, en plein cadre 1920 × 1080, en lente rotation, grâce à
  un mode « film » du banc d'essai (`vitrines_preview.html?film=1`).

Ces vidéos ne sont pas dans Git : trop lourdes, on les refait à la demande.

## 8. Le montage dans Remotion

`video/src/Trailer.tsx` est fait de briques réutilisées, une idée par brique : le fond, la ligne de cours, l'apparition
du logo, le texte qui monte mot à mot, les colonnes de dépêches, la fenêtre du site qui flotte en 3D, la légende, le
titre de section, la galerie, la grille, l'écran partagé. En tête du fichier, la table des plans donne chaque plan en
images absolues : on relit le montage comme une liste de coupes.

```tsx
const WHOOSH = [225, 705, 1185, 1545, 1785];  // 15 images avant chaque changement de section : le sommet tombe sur la coupe
{WHOOSH.map((f) => <Sfx key={`w${f}`} file="whoosh" at={f} volume={VOL.whoosh} />)}
```

## 9. Refaire la vidéo

Depuis le dossier `finveille/`, le site lancé en local :

```bash
python tools/footage.py --url http://localhost:8501/     # les séquences du site (compter une heure sans carte graphique)
python tools/vitrines_film.py                             # les 17 maquettes
python tools/music.py                                     # la musique et l'habillage sonore
cd video && npx remotion render Trailer out/trailer.mp4
```

## 10. Vérifier

- Une image clé par plan (`npx remotion still Trailer --frame=N`), regardée une à une : zones sûres, un seul héros,
  rien de coupé.
- Des planches contact des séquences et des maquettes.
- Le volume de la musique section par section, pour vérifier l'arc.
- Le contrôle des normales des 17 maquettes, et le test du pixel NaN.

## 11. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| La maquette devient noire ou blanche sur une vraie carte graphique | Un triangle plat, une normale nulle, un NaN que le halo étale | Retirer les points en double et alignés ; un halo qui ignore les NaN |
| Le site en ligne ne se met plus à jour | Le dépôt GitHub a été renommé : Streamlit suit l'ancien nom | Recréer l'application avec le nouveau nom, relier GitHub au bon compte, « Reboot app » |
| Les sous-agents s'arrêtent tous en même temps | Le quota de la session est épuisé | Les reprendre là où ils se sont arrêtés, plutôt que de tout relancer |
| Le drop ne ressort pas | La normalisation à -14 LUFS égalise tout | Une automation de volume par section, avant la normalisation |
| Pas de curseur dans les séquences filmées | Une capture sans écran ne dessine pas le pointeur | Enregistrer sa position, le dessiner au montage |
| Le clic filmé saute d'un coup | Le site défile en temps réel entre deux captures | Le crochet `scroller` : le tournage mène le défilement |
| La vidéo parle du jour (« le CAC 40 recule de 0,11 % ») | L'ancienne bande-annonce était construite sur la séance | Un film de lancement : le site, ses pages, ses outils |

Retour au [sommaire du guide](README.md).
