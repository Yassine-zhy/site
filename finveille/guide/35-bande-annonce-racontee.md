# Étape 35 — Une bande-annonce qui raconte, au lieu de montrer

> **Objectif :** refaire la bande-annonce pour qu'elle explique le site : une voix off, trois personnages, et une
> image qui illustre chaque phrase, dans l'énergie graphique des références que tu as envoyées.

Fichiers créés : `video/src/kit.tsx`, `site.tsx`, `wall.tsx`, `captions.tsx`, `sound.tsx`, le dossier `video/src/scenes/`,
`video/public/vo/` (la voix et ses minutages), `video/public/characters/` (les personnages), les skills
`.claude/skills/hyperframes-*`, ce guide. Fichiers modifiés : `video/src/Trailer.tsx`, `video/src/Root.tsx`,
`tools/music.py`, `tools/footage.py`, `video/package.json`, `docs/branding/trailer.mp4` et sa vignette, `README.md`,
`video/README.md`.

---

## 1. Ce que tu as dit

« Il y a trop de moments où on fait que montrer, et ces moments-là ne disent rien. » Avec deux références TikTok :

1. **Une pub produit faite avec Claude** (et l'outil HyperFrames). Une **voix off** raconte une histoire : un problème
   (« Your customers are 3 people. Not 10,000 reviews. »), le produit (« So we built Cast »), trois personnages
   (« Meet Maya, 31… ») et ce que le produit change pour chacun, une chute, un clin d'œil final.
2. **Une démo de motion design** : une typographie énorme, des grilles de formes qui se transforment, des volumes 3D,
   une seule couleur d'accent, un plan toutes les demi-secondes, sans voix.

Pour les analyser, on les a téléchargées (`yt-dlp`), découpées en planches d'images, et la voix de la première a été
retranscrite (Whisper). C'est en lisant sa transcription qu'on a compris l'essentiel : **c'est la voix qui porte
l'histoire**, et l'image illustre la phrase en cours.

## 2. Les skills : HyperFrames

La première référence cite HyperFrames, l'outil vidéo de HeyGen, publié sous licence Apache 2.0 avec des skills pour
les agents. On en a repris les textes (`.claude/skills/hyperframes-*`, avec la licence et une note sur ce qui a été
retiré : leurs scripts appellent les services de HeyGen). Les idées qui ont servi :

- **un arc éprouvé** : accroche, problème, produit, preuves, chute, appel à l'action ;
- **la règle « anti-PowerPoint »** : chaque élément entre à l'écran au mot qui le nomme, jamais tout d'un coup ;
- **traduire chaque fonction en bénéfice** pour quelqu'un : pas « un simulateur », mais « Sami voit ce que cent euros
  par mois deviennent en dix ans ».

## 3. L'histoire

| Temps | La voix | L'image |
| --- | --- | --- |
| 0-12 s | « Chaque jour, des milliers d'articles sur les marchés. En anglais. Sur des dizaines de sites. À toute heure. Et toi, tu as dix minutes. Pour comprendre ce qui compte. » | un mur de dépêches, une horloge, un « 10:00 » géant, trois cartes qui s'allument |
| 12-21 s | « Alors voici FinVeille. FinVeille rassemble toutes les dépêches, les trie par sujet, et t'explique l'essentiel, en français. » | le logo sur un impact, les dépêches aspirées dans le fil, quatre colonnes, le brief et son tampon « En français » |
| 21-31 s | « Voici Inès. Vingt ans. Un oral de marchés demain matin. Elle demande à l'assistant ce qui fait bouger le CAC 40. Une réponse claire, sources à l'appui. » | le monde violet d'Inès, puis la vraie question tapée dans le site et la vraie réponse, ses sources encadrées |
| 31-40 s | « Voici Hugo. Vingt-trois ans. Cent euros par mois à placer. Il s'entraîne sur un portefeuille virtuel, et règle une alerte sur Airbus. » | le monde vert, « 100 € » qui compte, l'anneau du portefeuille, la cloche qui sonne au clic |
| 40-50 s | « Et voici Sami. Dix-neuf ans. Il a acheté du bitcoin… un peu vite. Lui, il apprend enfin le vocabulaire, et voit ce que cent euros par mois deviennent en dix ans. » | le monde orange, une pièce qui tombe et une courbe qui plonge, un tableau à palettes, dix barres qui montent |
| 50-57 s | « Un seul site. Trois façons de comprendre les marchés. Et chaque page a sa maquette 3D, qui répond au clic. » | le drop : les trois personnages côte à côte, puis une rafale de maquettes et un vrai clic sur le globe |
| 57-66 s | « Et ce site ? C'est un projet d'étudiant, codé avec Claude Code. FinVeille. Gratuit, et en français. » | « Et ce site ? » géant, un terminal, ta carte, puis le logo, l'adresse et les pastilles « Gratuit » et « En français » |

**Rien d'inventé.** La voix disait d'abord « pourquoi le CAC 40 recule » : ce jour-là, il montait. Elle dit donc « ce
qui fait bouger le CAC 40 », et la séquence montre la vraie réponse du site à cette question, tapée dans le vrai site.
Le simulateur affiche « 12 000 € versés » (100 € × 120 mois) et « + les intérêts composés », sans montant final
inventé.

## 4. La voix off, par le code

La voix est française et faite **hors ligne** par Kokoro (un modèle de synthèse vocale libre, licence Apache 2.0,
voix `ff_siwis`), avec `kokoro-onnx`. Trois vérifications :

- **la prononciation** : chaque phrase est retranscrite par Whisper et comparée au texte. « rassemble les dépêches »
  s'entendait « rassemble et dépêche » : la phrase est devenue « rassemble toutes les dépêches » ;
- **l'intonation** : « Et ce site ? Un projet d'étudiant… » perdait sa question ; elle est coupée en deux phrases ;
- **le minutage de chaque mot** (Whisper encore), dans `video/public/vo/vo.json` : c'est lui qui fait entrer chaque
  élément à l'écran, et les sous-titres mot à mot.

Chaque phrase démarre sur un temps de la musique ; le logo, la chute et la fin sur une mesure.

## 5. Les personnages

Inès, Hugo et Sami viennent de **Notionists** (Zoish, CC0), une collection d'illustrations au trait noir de la
bibliothèque DiceBear. On a tiré 24 visages et choisi : Inès à lunettes et queue de cheval (l'étudiante qui révise),
Hugo pouce levé (posé), Sami l'air surpris (« un peu vite »). Chacun a son monde de couleur : violet, vert, orange.

## 6. Le son

- La musique (`tools/music.py`) suit l'histoire : douce sous l'accroche, un impact sur le logo, un roulement avant
  chaque personnage, la montée, **un silence total**, le drop sur « Un seul site », et un impact sur la fin.
- Elle **baisse sous la voix** (de 0,85 à 0,32 au plus, et plus encore sur le drop) : la voix passe 8 à 10 dB
  au-dessus, mesuré phrase par phrase.
- La version publiée est normalisée à -14 LUFS en deux passes (`loudnorm`), crête à -1,3 dB.

## 7. Le montage

`video/src/` est découpé en briques : `kit.tsx` (couleurs, typographie, texte cinétique, logo, éclat radial),
`site.tsx` (la fenêtre du site, recadrée sur l'élément nommé, la surbrillance, le curseur), `wall.tsx` (le mur de
dépêches), `captions.tsx` (les sous-titres), `sound.tsx` (la voix, la musique qui baisse, les bruitages), et une scène
par partie dans `scenes/`. Les minutages viennent de `vo.json`, jamais recopiés à la main.

## 8. Refaire la vidéo

Depuis `finveille/` :

```bash
python tools/footage.py --url http://localhost:8501/ --only ai   # l'assistant, avec la question tapée
python tools/music.py
cd video && npx remotion render Trailer out/trailer.mp4 --codec=h264 --crf=18
```

La voix et ses minutages sont dans `video/public/vo/` ; pour changer le texte, on refait la phrase avec Kokoro, puis
ses minutages avec Whisper.

## 9. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| La vidéo montre sans rien dire | Pas d'histoire : des plans du site les uns après les autres | Une voix off qui raconte, et chaque image qui illustre sa phrase |
| Un mot mal prononcé | La synthèse vocale bute sur une liaison | Retranscrire chaque phrase (Whisper) et reformuler |
| La voix affirme quelque chose de faux (« le CAC 40 recule ») | Le texte écrit avant de connaître la séance | Une formulation toujours vraie, et la vraie réponse du site à l'image |
| La musique couvre la voix sur le drop | La musique est bien plus forte après 46 s | Baisser davantage la musique sur ces phrases ; mesurer l'écart phrase par phrase |
| La voix sature | Le mélangeur de Remotion remonte les WAV mono de 2,8 dB | Voix à 0,75 |

Étape précédente : [la bande-annonce montée](34-bande-annonce.md). Retour au [sommaire du guide](README.md).
