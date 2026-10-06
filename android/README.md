# Aetheria — application Android

Le jeu (HTML/JS/WebGL) est embarqué tel quel dans un APK : une activité plein écran
(`src/com/aetheria/jeu/MainActivity.java`) l'affiche dans une WebView et sert les fichiers
hors-ligne depuis `https://appassets.androidplatform.net/` (modules, `fetch()` des modèles 3D
et sauvegardes `localStorage` fonctionnent comme dans un navigateur).

- **Installer** : copier `release/Aetheria.apk` sur le téléphone, l'ouvrir et autoriser
  « Installer des applis inconnues » pour l'appli qui l'ouvre (Chrome, Fichiers…). Android 7+.
- **Construire** : `npm run build:apk` (Node + Java 11+, aucun SDK Android). Les outils (aapt2,
  dx, apksig) sont téléchargés depuis Maven Central dans `android/.tools`.
- **Mettre à jour** : augmenter `versionCode` dans `app.json` et garder la même clé
  (`keystore/aetheria.p12`) ; sinon Android refuse la mise à jour et il faudrait désinstaller,
  ce qui effacerait les sauvegardes.

Fonctionnement propre à l'appli : bouton retour du téléphone (ferme la fenêtre ouverte, sinon
ouvre les options), écran toujours allumé, mode immersif, paysage, son coupé en arrière-plan.
Hors-ligne, le jeu est en solo (pas de monde partagé ni d'expéditions en ligne) et les PNJ
répondent avec leurs dialogues intégrés.

Polices : Uncial Antiqua, Alegreya, Alegreya Sans (SIL Open Font License, `www/fonts/OFL.txt`).
