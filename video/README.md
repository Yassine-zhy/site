# La bande-annonce de FinVeille

Un montage en motion design, écrit en React avec [Remotion](https://www.remotion.dev/) (guide 32). Chaque image est
un rendu React ; les animations suivent le numéro de l'image (`useCurrentFrame`), jamais l'horloge.

- `src/Trailer.tsx` : les scènes (ouverture, palmarès du CAC 40, séquences filmées, fin) et le montage ;
- `public/data.json` : les chiffres de la séance (CAC 40, plus fortes hausses et baisses), écrits par
  `tools/footage.py` à partir de Yahoo Finance ;
- `public/footage/` : les séquences filmées dans le vrai site par `tools/footage.py` (non suivies par Git, trop
  lourdes : on les refait à la demande) ;
- `public/fonts/` : Schibsted Grotesk et IBM Plex Sans (licence SIL Open Font, voir `LICENCES.txt`).

## Refaire la vidéo

Depuis le dossier `finveille/`, le site lancé en local (`streamlit run app.py`) :

```bash
python tools/footage.py --url http://localhost:8501/   # les séquences et les chiffres du jour (≈ 15 min)
cd video
npm install
npx remotion studio                                    # aperçu, image par image
npx remotion render Trailer out/trailer.mp4            # le fichier final, 1920 × 1080
```

Remotion est gratuit pour un particulier ou une petite équipe ; une entreprise plus grande a besoin d'une licence
(<https://www.remotion.dev/license>).
