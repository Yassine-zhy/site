# La bande-annonce de FinVeille

Une publicité de 53 s, sans voix off, écrite en React avec [Remotion](https://www.remotion.dev/) (guides 32 et 34 à
37). Chaque image est un rendu React ; les animations suivent le numéro de l'image (`useCurrentFrame`), jamais
l'horloge. 1920 × 1080, 60 images par seconde.

On voit d'abord le logo ; un curseur appuie dessus pendant la seconde de silence de la musique, et l'application
s'ouvre quand le rythme repart. Puis tout le contenu défile : l'actualité de toutes les rubriques réunie en un seul fil,
les marchés, la carte du CAC 40, l'économie, la crypto, les questions avec leurs sources, les alertes, le portefeuille
virtuel, le vrai site sur ordinateur et sur téléphone, et le logo sur l'arrêt final de la musique. Tout est calé sur la
musique : 127 temps par minute, `b(k)` donne l'image du temps k.

- `src/Trailer.tsx` : le montage ; en tête, la table des scènes ; les transitions entre scènes (zoom à travers,
  glissés), la couleur du fond scène par scène, les sons ;
- `src/kit.tsx` : le temps musical, les courbes, le fond (lueur, vignettage, grain), le verre lumineux, les titres
  animés (`Title`), les poussières de lumière (`Sparks`), les pictogrammes, le logo ;
- `src/scenes/` : l'ouverture, l'actu, les marchés, l'économie et la crypto, les outils, « partout », la fin ;
- `public/music/` : la musique, « Expressive Courage », sur [Mixkit](https://mixkit.co/free-stock-music/) (licence
  Mixkit : libre dans une vidéo, même commerciale, sans citer l'auteur, mais interdit de redistribuer le fichier seul ;
  d'où son absence du dépôt) ; `tools/trailer_assets.py` la télécharge et la monte sur la grille du film ;
- `public/footage/` : les séquences du vrai site, filmées par `tools/footage.py` (la scène « partout » se sert des
  marchés, en thème sombre et clair, et du téléphone) ;
- (ces fichiers ne sont pas suivis par Git : on les refait à la demande) ;
- `public/sfx/` : l'habillage sonore (souffle, clic, cloche, frappe, tic), créé par `tools/music.py` ;
- `public/grain.png` : le grain de pellicule ; `public/fonts/` : Schibsted Grotesk et IBM Plex Sans (licence SIL Open
  Font, voir `LICENCES.txt`).

## Refaire la vidéo

Depuis le dossier `finveille/`, le site lancé en local (`streamlit run app.py`) si les séquences manquent :

```bash
python tools/footage.py --url http://localhost:8501/   # les séquences du site (≈ 1 h sans carte graphique)
python tools/trailer_assets.py                         # la musique montée (quelques secondes)
python tools/music.py                                  # l'habillage sonore (moins d'une minute)
cd video
npm install
npx remotion studio                                    # aperçu, image par image
npx remotion render Trailer out/trailer.mp4            # le fichier final, 1920 × 1080, 60 im/s
```

Remotion est gratuit pour un particulier ou une petite équipe ; une entreprise plus grande a besoin d'une licence
(<https://www.remotion.dev/license>).
