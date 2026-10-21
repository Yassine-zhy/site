# La bande-annonce de FinVeille

Une bande-annonce racontée par une voix off, écrite en React avec [Remotion](https://www.remotion.dev/) (guides 32, 34
et 35). Chaque image est
un rendu React ; les animations suivent le numéro de l'image (`useCurrentFrame`), jamais l'horloge.

- `src/Trailer.tsx` : le montage (66 s, 1 980 images) ; en tête, la table des 22 plans ; les scènes dans `src/scenes/`,
  les briques dans `src/kit.tsx`, `site.tsx`, `wall.tsx`, `captions.tsx`, `sound.tsx` ;
- `public/vo/` : la voix off (une phrase par fichier) et `vo.json`, le minutage de chaque mot. Voix française de
  Kokoro (`ff_siwis`, modèle sous licence Apache 2.0), faite hors ligne avec `kokoro-onnx` ;
- `public/characters/` : Inès, Hugo et Sami, tirés de Notionists (Zoish, licence CC0) avec DiceBear ;
- `public/footage/` : les séquences filmées dans le vrai site par `tools/footage.py`, avec la position du curseur
  (`*.cursor.json`) et l'instant des clics (`*.events.json`) ;
- `public/models/` : les 17 maquettes 3D en plein cadre, filmées par `tools/vitrines_film.py` ;
- (ces deux dossiers ne sont pas suivis par Git, trop lourds : on les refait à la demande) ;
- `public/sfx/` : l'habillage sonore (souffle, impact, clic, cloche, frappe, tic), créé par `tools/music.py` ;
- `public/fonts/` : Schibsted Grotesk et IBM Plex Sans (licence SIL Open Font, voir `LICENCES.txt`) ;
- `public/music.mp3` : la musique, composée par `tools/music.py` (120 battements par minute ; chaque scène dure un
  nombre entier de mesures, les coupes tombent sur un temps fort).

## Refaire la vidéo

Depuis le dossier `finveille/`, le site lancé en local (`streamlit run app.py`) :

```bash
python tools/footage.py --url http://localhost:8501/   # les séquences du site (≈ 1 h sans carte graphique)
python tools/vitrines_film.py                          # les 17 maquettes (≈ 30 min)
python tools/music.py                                  # la musique et l'habillage sonore (moins d'une minute)
cd video
npm install
npx remotion studio                                    # aperçu, image par image
npx remotion render Trailer out/trailer.mp4            # le fichier final, 1920 × 1080
```

Remotion est gratuit pour un particulier ou une petite équipe ; une entreprise plus grande a besoin d'une licence
(<https://www.remotion.dev/license>).
