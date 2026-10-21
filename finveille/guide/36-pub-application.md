# Étape 36 — Une bande-annonce comme une pub d'application

> **Objectif :** refaire la bande-annonce sans voix off, dans le style d'une publicité d'application (la pub « Opal »
> de @__mcvisuals__, envoyée en référence) : des éléments d'interface de FinVeille qui se transforment l'un en l'autre,
> sur une vraie musique.

Fichiers créés : `tools/trailer_assets.py`, `video/src/scenes/market.tsx`, `news.tsx`, `assistant.tsx`, `wall.tsx`,
`alert.tsx`, `portfolio.tsx`, `finale.tsx` (réécrit), `video/public/grain.png`, ce guide.
Fichiers modifiés : `video/src/kit.tsx`, `video/src/Trailer.tsx`, `video/src/Root.tsx`, `video/.gitignore`,
`video/package.json` (DiceBear retiré), `video/README.md`, `docs/branding/trailer.mp4` et `trailer-cover.jpg`,
`README.md`, `guide/README.md`.
Fichiers supprimés : la voix off (`video/public/vo/`), les personnages (`video/public/characters/`), la musique
synthétique de la v3 (`video/public/music.mp3`), les anciennes scènes et `captions.tsx`, `site.tsx`, `wall.tsx`,
`sound.tsx` (l'historique Git les garde : étape 35).

---

## 1. Ce que tu as dit

- La voix est monotone, le rythme ressemble à des diapositives.
- Elle prononce mal : « Fin Veille » lu « fin » au lieu de « fine » ; « Bitcoin » sans le bon accent ; d'autres mots
  lus comme ils s'écrivent. Une voix de synthèse hors ligne (Kokoro) ne sait pas prononcer un nom de marque.
- Retirer le passage « un projet d'étudiant » et la mention de l'outil de code : ça ne fait pas professionnel.
- « Enlève la voix off, fais un truc dans le style de ce TikTok, importe la musique que tu veux. »

## 2. La référence, image par image

On l'a téléchargée (`yt-dlp`) et découpée en planches (4 images par seconde). Elle dure 12 s, en 1920 × 1080, à
60 images/s, pour environ 89 BPM. Ce qu'on y voit :

- un tableau de bord incliné en 3D que la caméra survole, une barre qui s'allume (bleu cyan, sommet jaune) ;
- la caméra plonge dedans, il reste un point ; le point devient une pastille « Sleep » qui compte jusqu'à 67 ; deux
  autres pastilles la rejoignent ; une accolade les réunit sous un « Score » qui compte ;
- l'icône d'une application se change en cadenas avec une lueur rouge ; la liste « Blocked Apps » ; un bouton
  « Start » balayé par un reflet ; le logo qui entre au point ; l'adresse seule ; noir.

Les règles qu'on en tire :

- un fond nuit avec UNE lueur colorée en haut ;
- peu d'éléments et beaucoup de vide ;
- des composants en « verre lumineux » (intérieur sombre, liseré blanc plus fort en haut à gauche, halo) ;
- des mises au point (flou → net) et des ressorts légers ;
- surtout, **aucune coupe** : chaque élément devient le suivant.

## 3. L'histoire de FinVeille, en un seul plan

Temps de la musique ; 1 temps = 0,9 s.

| Scène | Temps | Ce qu'on voit | Ce que ça dit du site |
| --- | --- | --- | --- |
| A | 0 - 7,5 | la carte du CAC 40 inclinée sort du noir ; au drop la barre du vendredi s'allume, la carte se redresse, la caméra plonge dans la barre, qui devient un point | les marchés en direct |
| B | 7,5 - 12,5 | le point devient la pastille « Marchés » qui compte ses dépêches, puis Économie, Entreprises, Crypto ; une accolade : « Dépêches du moment 248 » | toutes les dépêches, triées par sujet (les 4 rubriques de `core/config.py`) |
| C | 11,5 - 17 | la caméra monte : l'icône de l'assistant, la question tapée « Qu'est-ce qui fait bouger le CAC 40 aujourd'hui ? », la réponse, trois sources (BFM Bourse, Le Monde Économie, CNBC Marchés, de vrais flux du site) | un assistant qui cite ses sources |
| D | 16 - 23 | la réponse rétrécit et devient une tuile d'un mur de 15 maquettes 3D (les vraies, filmées dans le site), survolé en 3D ; « 17 maquettes 3D, une par page » ; plongée dans la cloche | une maquette 3D par page |
| E | 22 - 25 | la cloche 3D se floute, une cloche dessinée devient nette, sonne, lueur ambre ; la notification « Alerte de cours : Airbus a franchi 180,00 € » | les alertes de cours |
| F | 25 - 28 | le carré de la cloche s'arrondit en anneau : la répartition d'un portefeuille (Actions, ETF, Crypto), 10 000 € → 10 842 € | le portefeuille d'entraînement |
| G | 28 - 32 | l'anneau s'étire en bouton « Commencer », un reflet le balaie, on appuie | l'invitation |
| H | 32 - fin | le bouton se resserre en carré bleu, le logo s'y dessine sur l'accord final, « FinVeille », « Toute la finance qui compte, en un seul site. », puis l'adresse seule | la marque |

Les chiffres sont des illustrations (pas la séance d'un jour précis) : c'est une publicité, pas un relevé.

## 4. La musique

- « Uplifting Bass » de Lily J, sur Mixkit. La licence Mixkit permet de l'utiliser dans une vidéo, même commerciale,
  sans citer l'auteur, mais interdit de redistribuer le fichier seul : il n'est donc pas dans le dépôt, et
  `tools/trailer_assets.py` le télécharge (https://assets.mixkit.co/music/726/726.mp3).
- Elle a été choisie parmi une dizaine de morceaux Mixkit téléchargés et mesurés (tempo, énergie par seconde, part des
  basses) : intro calme puis un vrai drop, énergie constante ensuite, une vraie fin (un accord qui s'éteint).
- **Piège :** la première mesure du tempo a donné 89 BPM, ce qui est faux. Le morceau a des triolets de charleston
  (trois notes par temps) : l'autocorrélation tombe sur un multiple de la mauvaise pulsation. En « repliant » les
  attaques sur une mesure (moyenne de l'énergie à chaque position de la mesure, en séparant grosse caisse < 150 Hz,
  caisse claire 1-4 kHz, charleston > 6 kHz), on voit le vrai motif : grosse caisse et caisse claire alternent tous les
  0,8955 s, donc **67 BPM**, caisse claire sur les temps 2 et 4. La grille est stable de 14 s à 84 s du morceau (le drop
  est à 14,34 s).
- Le montage du morceau (fait par ffmpeg dans le script) :
  - 1 mesure d'intro calme, le drop et 6 mesures (10,76 → 35,83 s du morceau) ;
  - raccord sur la mesure 18 après le drop (78,82 s) : même accord que la mesure qui aurait suivi (on a comparé les
    accords de chaque mesure par leur « chroma », l'énergie de chacune des 12 notes) ;
  - un fondu enchaîné de 20 ms centré sur le raccord ;
  - l'accord final (82,40 s du morceau) tombe pile au temps 32 du film, sur le logo ;
  - fondu de sortie sur la dernière seconde et demie. Total : 33,33 s.
- Dans le code : `b(k)` donne l'image du temps k (1 temps = 53,733 images à 60 im/s). Le drop est au temps 4, l'accord
  final au temps 32. Les gros mouvements partent sur un temps, les petits sur un demi-temps.
- Quelques sons d'interface discrets (tic des pastilles, souffle des mouvements de caméra, frappe de la question,
  cloche, clic du bouton), déjà faits par `tools/music.py` à l'étape 34.

## 5. La boîte à outils (`video/src/kit.tsx`)

- 60 images par seconde : les ressorts et les mises au point restent fluides (la référence aussi est à 60).
- `Backdrop` : le fond nuit, une lueur en haut dont la couleur suit la scène (bleu marque, lavande, violet de
  l'assistant, ambre de l'alerte, vert du portefeuille), un vignettage, un grain de pellicule qui bouge (une image de
  bruit de 256 px, `public/grain.png`, répétée et décalée toutes les 2 images).
- `glass()` : le verre lumineux en CSS : deux fonds (intérieur sombre en `padding-box`, dégradé blanc en `border-box`)
  avec une bordure transparente, et une ombre portée qui fait le halo.
- `focus(p)` : opacité + flou ; `pop()` : un ressort (Remotion `spring`) avec un léger dépassement ; `count()` : un
  compteur qui roule, nombres à la française (espace fine insécable, virgule).
- `LogoMark` : le logo redessiné, qui se dessine (le F, la ligne de cours, le point vert).
- Les morphoses : une forme garde la même taille et la même place à l'image où une scène passe la main à la suivante
  (exemple : la barre du jour est reprise « à l'écran » quand la caméra s'arrête, puis se resserre en disque de 26 px ;
  la pastille suivante naît de ce disque).

## 6. Le mur des maquettes

- 15 des 17 maquettes filmées à l'étape 34 (`tools/vitrines_film.py`) sont rangées par ffmpeg (`xstack`) en une seule
  vidéo de 5 × 3 tuiles (3216 × 1278) : une seule vidéo à décoder au lieu de quinze.
- Dans la scène, un plan CSS 3D (`perspective`, `rotateX`, `rotateZ`, `scale`) que la caméra incline et survole ; coins
  arrondis par un masque SVG ; une tuile survolée est une copie de la vidéo, rognée, soulevée en Z avec son cadre.
- La plongée finit sur la tuile de la cloche, agrandie 3,3 fois ; on enchaîne en fondu sur le plan plein cadre de la
  cloche, à la même phase de sa boucle.

## 7. Le partage du travail

- Comme le demande `CLAUDE.md` : la direction artistique, la musique, la boîte à outils et les scènes A, B, F, G, H
  dans la session principale ; les scènes C, D et E écrites par un sous-agent à partir d'une spécification à l'image
  près (positions, tailles, couleurs, images-clés de caméra, état exact à la passation) ; relu et vérifié ensuite
  (planche d'images, raccords), avec trois retouches de minutage aux passations.
- Vérification du film : un détecteur d'images isolées (une image très différente de ses deux voisines, qui elles se
  ressemblent) n'en trouve aucune ; les plus grands écarts d'une image à l'autre sont les deux mouvements de caméra
  rapides (le recul du mur, la plongée), voulus.

## 8. Refaire la vidéo

Depuis `finveille/` :

```bash
python tools/vitrines_film.py      # les 17 maquettes (≈ 30 min sans carte graphique), si public/models/ est vide
python tools/trailer_assets.py     # la musique montée et le mur des maquettes (≈ 1 min)
cd video && npm install
npx remotion studio                # aperçu
npx remotion render Trailer out/trailer.mp4 --codec=h264 --crf=18 --concurrency=3   # ≈ 7 min sur 4 cœurs
```

Puis la version publiée : volume normalisé à −14 LUFS en deux passes (`loudnorm` de ffmpeg, comme au guide 34) et
compression H.264 (crf 23) pour rester sous ~15 Mo.

## 9. Erreurs fréquentes

- **Tempo faux à cause des triolets** (voir § 4) : toujours vérifier la grille en repliant les attaques sur une mesure.
- **`background-image` refusé par le lint de Remotion** (une image de fond peut ne pas être chargée quand l'image est
  capturée) : le grain utilise des `<Img>` répétées.
- **Une transition qui « saute »** : à l'image de la passation, les deux scènes doivent dessiner exactement la même
  forme (taille, rayon, couleur, halo) ; le vérifier sur deux images fixes voisines.
- **Un compteur qui tremble** : le texte est aligné au centre, sa largeur change ; c'est acceptable pendant qu'il roule,
  mais pas à l'arrêt.
- **La musique dans Git** : non (licence Mixkit) ; elle est dans `.gitignore`, refaite par le script.

Étape précédente : [la bande-annonce qui raconte](35-bande-annonce-racontee.md). Retour au
[sommaire du guide](README.md).
