# La bande-annonce de FinVeille

Une publicité d'application, sans voix off, écrite en React avec [Remotion](https://www.remotion.dev/) (guides 32,
34, 35 et 36). Chaque image est un rendu React ; les animations suivent le numéro de l'image (`useCurrentFrame`),
jamais l'horloge. 1920 × 1080, 60 images par seconde, 33 s.

Un seul plan continu : chaque élément d'interface se transforme en le suivant (la barre du jour devient un point, le
point une pastille, la carte de l'assistant une tuile du mur des maquettes, la cloche un anneau, l'anneau un bouton,
le bouton le logo). Tout est calé sur la musique : 67 temps par minute, `b(k)` donne l'image du temps k.

- `src/Trailer.tsx` : le montage ; en tête, la table des 8 scènes ; la couleur du fond scène par scène ; les sons ;
- `src/kit.tsx` : le temps musical, les courbes, le fond (lueur, vignettage, grain), le verre lumineux, les icônes, le
  logo ;
- `src/scenes/` : le marché (A), les dépêches (B), l'assistant (C), le mur des maquettes (D), l'alerte (E), le
  portefeuille (F), le bouton et le logo (G, H) ;
- `public/music/` : la musique, « Uplifting Bass » de Lily J, sur [Mixkit](https://mixkit.co/free-stock-music/)
  (licence Mixkit : libre dans une vidéo, même commerciale, sans citer l'auteur, mais interdit de redistribuer le
  fichier seul ; d'où son absence du dépôt) ; `tools/trailer_assets.py` la télécharge et la monte sur la grille du film ;
- `public/models/` : les 17 maquettes 3D en plein cadre, filmées par `tools/vitrines_film.py`, et `public/models-grid.mp4`,
  15 d'entre elles en un mur de 5 × 3 tuiles (par `tools/trailer_assets.py`) ;
- (ces fichiers ne sont pas suivis par Git : on les refait à la demande) ;
- `public/sfx/` : l'habillage sonore (souffle, clic, cloche, frappe, tic), créé par `tools/music.py` ;
- `public/grain.png` : le grain de pellicule ; `public/fonts/` : Schibsted Grotesk et IBM Plex Sans (licence SIL Open
  Font, voir `LICENCES.txt`).

## Refaire la vidéo

Depuis le dossier `finveille/` :

```bash
python tools/vitrines_film.py                          # les 17 maquettes (≈ 30 min sans carte graphique)
python tools/trailer_assets.py                         # la musique montée et le mur des maquettes (≈ 1 min)
python tools/music.py                                  # l'habillage sonore (moins d'une minute)
cd video
npm install
npx remotion studio                                    # aperçu, image par image
npx remotion render Trailer out/trailer.mp4            # le fichier final, 1920 × 1080, 60 im/s
```

Remotion est gratuit pour un particulier ou une petite équipe ; une entreprise plus grande a besoin d'une licence
(<https://www.remotion.dev/license>).
