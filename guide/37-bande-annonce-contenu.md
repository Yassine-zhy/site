# Étape 37 — Une bande-annonce qui montre ce qu'il y a dedans

> **Objectif :** refaire la bande-annonce à partir de tes retours sur la v4 : on voit d'abord le logo et on appuie
> dessus, puis tout le contenu du site défile en motion design, sur une musique plus rapide et plus entraînante ; 53 s.

Fichiers créés : `video/src/scenes/opening.tsx`, `actu.tsx`, `marches.tsx`, `eco.tsx`, `outils.tsx`, `partout.tsx`,
ce guide.
Fichiers modifiés : `video/src/kit.tsx` (le temps à 127 BPM, `Title`, `Sparks`, cinq pictogrammes),
`video/src/Trailer.tsx` (la table des scènes, les transitions, les sons), `video/src/scenes/finale.tsx` (réécrit),
`tools/trailer_assets.py` (le nouveau morceau ; plus de mur de maquettes), `video/.gitignore`, `video/README.md`,
`docs/branding/trailer.mp4` et sa vignette, `README.md`, `guide/README.md`.
Fichiers supprimés : les scènes de la v4 (`market.tsx`, `news.tsx`, `assistant.tsx`, `wall.tsx`, `alert.tsx`,
`portfolio.tsx`).

---

## 1. Ce que tu as dit

- Le début ne dit pas ce que c'est : il faut le logo FinVeille tout de suite, et un bouton sur lequel on appuie.
- Plus animé, plus de motion design ; s'inspirer de la pub de référence, pas la calquer.
- Les maquettes 3D, « on s'en fout un peu » : parler du contenu, de tout ce qu'on trouve (l'actualité de tous les
  sujets, les marchés…). Les pastilles qui comptaient les dépêches : dire plutôt que le site regroupe l'actualité.
- L'assistant ressemblait trop à un outil d'IA : plus sobre, au clavier. Rien sur la façon dont le site a été fait,
  rien sur le statut de l'auteur.
- 45 s à 1 min.
- La musique : un rythme plus rapide, plus d'entrain, mais sans que les plans défilent trop vite.

## 2. La musique

- « Expressive Courage », Mixkit (même licence : libre dans une vidéo, pas de redistribution du fichier seul → hors du
  dépôt, téléchargé par `tools/trailer_assets.py`).
- Choisie parmi 17 morceaux Mixkit entraînants, mesurés par le script d'analyse : tempo (peigne sur les attaques de la
  grosse caisse), contraste du temps (une grosse caisse bien nette), énergie seconde par seconde, longueur de l'intro.
  127 BPM, ambiance motivante, la grosse caisse la plus franche du lot.
- Sa structure, mesure par mesure (énergie, charleston, accords) : intro calme de 16 s ; au milieu de la dernière
  mesure d'intro, **une seconde de silence** (la basse se coupe), puis le drop ; 15 mesures pleines ; un passage creux
  de 7 mesures ; 16 mesures pleines ; un arrêt net avec une cymbale qui résonne. Les accords tournent sur un cycle de
  4 mesures.
- Le montage : 3 mesures d'intro → le silence tombe sur l'appui sur le logo (temps 8 et 9 du film), la musique repart
  au temps 10 = l'application s'ouvre ; 15 mesures pleines ; raccord sur la mesure 31 (même place dans le cycle des
  accords) : on saute le passage creux, l'énergie ne retombe pas ; l'arrêt net tombe sur le logo final (temps 106),
  la cymbale résonne pendant que l'adresse s'affiche. 53 s.
- Plus rapide (127 au lieu de 67 temps par minute), mais les scènes changent toutes les 3 à 4 mesures (6 à 8 s) : le
  rythme est dans la musique et dans le mouvement à l'intérieur des plans, pas dans des coupes rapides.

## 3. Le film, scène par scène

| Scène | Temps | Ce qu'on voit | Ce que ça dit |
| --- | --- | --- | --- |
| ouverture | 0 - 12 | l'icône FinVeille se dessine, son nom lettre par lettre, la phrase de la marque ; un curseur arrive, appuie pendant le silence (deux ondes), on reste appuyé ; au retour de la musique l'icône s'agrandit jusqu'à remplir l'écran de bleu | « c'est FinVeille, une app » |
| l'actu | 12 - 28 | un flot de vraies rubriques de dépêches en perspective ; « Toute l'actu financière. », puis la rubrique change à chaque temps (Marchés, Économie, Entreprises, Crypto) et ses dépêches s'allument ; les sources défilent ; tout se range en un seul fil avec ses onglets | le site regroupe toute l'actualité |
| les marchés | 28 - 44 | la courbe du CAC 40 qui se dessine, deux bandeaux de cotations, puis la carte des 40 valeurs du CAC 40 qui se retourne en vague | les marchés en direct |
| l'économie et la crypto | 44 - 56 | les courbes des taux qui ondulent, trois pastilles (taux directeurs, inflation, emploi), puis trois pièces qui tournent (Bitcoin, Ethereum, Solana) | l'économie et la crypto aussi |
| tes outils | 56 - 72 | une barre de recherche où l'on tape « Pourquoi l'or monte-t-il ? », la réponse avec ses trois sources ; la cloche qui sonne et deux alertes ; le portefeuille virtuel qui gagne | poser une question, être alerté, s'entraîner |
| partout | 72 - 84 | le vrai site (séquences filmées) dans une fenêtre d'ordinateur, puis sur un téléphone, puis l'écran passe en thème clair | sur ordinateur, sur téléphone, clair ou sombre |
| la fin | 84 - fin | une mosaïque de 9 tuiles animées (tout ce qu'on a vu) autour du logo ; elles s'envolent, le logo grandit ; la phrase, l'adresse, « Gratuit, sans publicité » | la signature |

- L'assistant : plus d'icône d'étoile, plus de violet « IA », plus de bulles de discussion : une barre de recherche,
  une question tapée au clavier (avec le son des touches), une réponse avec ses sources numérotées.
- Les séquences du vrai site : celle de l'accueil montre un badge dont on ne veut pas dans la pub : on ne l'utilise
  pas ; on prend celles des marchés (ordinateur, thème sombre et clair) et du téléphone.
- Les chiffres et les titres sont des illustrations (plausibles, neutres), pas un relevé du jour ; les cotations
  reprennent les niveaux affichés dans les séquences filmées du site, pour rester cohérent.

## 4. Les transitions

- Elles sont faites à un seul endroit, `Trailer.tsx` (`Shot`) : chaque scène entre et sort par un **zoom à travers**
  (la scène qui part grossit et se floute, celle qui arrive vient de plus loin et devient nette) ou par un **glissé**
  (horizontal ou vertical, avec flou), sur un temps, centré sur la frontière ; un souffle au même instant.
- À l'intérieur d'une scène, pas de coupe : les éléments se transforment (la barre de recherche qui laisse la place à
  la cloche, la cloche qui devient l'anneau du portefeuille, la fenêtre qui se décale pour le téléphone…).
- L'ouverture est un vrai geste d'application : l'icône est le bouton, le curseur appuie, l'icône s'ouvre en plein
  écran.

## 5. La boîte à outils (ajouts)

- `b(k)` passe à 127 BPM (1 temps = 28,344 images à 60 im/s).
- `Title` : un titre dont chaque mot monte derrière un cache à son image, et repart vers le haut ; c'est le texte
  animé de toutes les scènes.
- `Sparks` : des poussières de lumière qui dérivent (le fond vit toujours).
- Pictogrammes : téléphone, ordinateur, grille, livre, calculatrice.

## 6. Le partage du travail

Comme le demande le fichier de consignes du projet : direction artistique, musique, boîte à outils, montage,
transitions, ouverture, « partout » et la fin dans la session principale ; « l'actu », « les marchés », « l'économie
et la crypto » et « tes outils » écrites par trois sous-agents en parallèle, chacun à partir d'une spécification
(fenêtre d'images, textes exacts, positions, couleurs des rubriques, règles communes : textes lisibles sur téléphone,
rien de figé, aucun mot sur la fabrication du site) ; relues et vérifiées ensuite (planches d'images, rendu complet,
détecteur d'images isolées).

## 7. Refaire la vidéo

Depuis `finveille/` :

```bash
python tools/footage.py --url http://localhost:8501/   # les séquences du vrai site, si public/footage/ est vide
python tools/trailer_assets.py                         # la musique montée
cd video && npm install
npx remotion render Trailer out/trailer.mp4 --codec=h264 --crf=18 --concurrency=3
```

Puis la version publiée : −14 LUFS en deux passes (`loudnorm`) et H.264 crf 23.

## 8. Erreurs fréquentes

- **Un « tempo » trompeur** : mesurer la grosse caisse à part, et vérifier en repliant les attaques sur une mesure.
- **Une seconde de silence dans la musique est un cadeau** : c'est là qu'on place le geste (l'appui), et le retour du
  son devient l'événement (l'ouverture).
- **Des séquences filmées du site qui montrent ce qu'on ne veut pas** (un badge, une date) : regarder chaque séquence
  en planche avant de s'en servir.
- **Trop de texte tue la pub** : un titre court par idée, gros, et l'image qui le prouve.

Étape précédente : [la bande-annonce comme une pub d'application](36-pub-application.md). Retour au
[sommaire du guide](README.md).
