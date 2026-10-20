# Étape 32 — Une page IA qui reste en place, un accueil qui raconte la séance, une vraie vidéo

> **Objectif :** réparer la page de l'assistant (elle descendait toute seule tout en bas), donner au site de vraies
> animations, tirées du monde de la Bourse, au lieu d'un simple décor 3D derrière les pages, et refaire la
> bande-annonce en motion design.

Fichiers créés : `static/fv3d/motion.js`, `static/fv3d/gsap.min.js`, `static/fv3d/ScrollTrigger.min.js` (et leur
licence), `tools/footage.py`, le dossier `video/` (projet Remotion), ce guide. Fichiers modifiés :
`views/assistant.py`, `views/feed.py`, `theme.py`, `static/fv3d/engine.js`, `tools/ux_audit.py`,
`tests/test_market_theme.py`, `docs/branding/trailer.mp4`, `README.md`. Supprimé : `tools/trailer.py` (remplacé).

---

## 1. Le bug : la page de l'IA descendait toute seule

`st.chat_input` appelé au niveau de la page est **épinglé en bas de l'écran**. Pour qu'il reste visible, Streamlit
place alors toute la page dans un conteneur qui **défile automatiquement jusqu'en bas** dès que du contenu arrive.
Résultat : à l'ouverture et après chaque réponse, on se retrouvait en bas, et il fallait remonter pour lire.

La correction tient en une règle de Streamlit : **un `chat_input` placé dans un conteneur s'affiche à sa place**, sans
épinglage ni défilement forcé.

```python
panel = st.container(key="fvchat")          # le panneau de la conversation
log = panel.container(key="fvchatlog")       # les messages
question = panel.chat_input("Pose ta question…")   # la saisie, juste sous les messages
with log:
    ...  # suggestions, historique, nouvelle question et sa réponse
```

Reste à choisir **où** va l'écran quand on pose une question. Le bon endroit n'est pas le bas de la page, mais **la
question** : on la remonte en haut de l'écran, et la réponse s'écrit en dessous, sous les yeux du lecteur
(`installChat` dans `engine.js`). Pour reconnaître une question parmi les messages, on ne peut pas se fier à
`aria-label` (Streamlit ne le remplit pas) : on cherche l'icône « personne » des messages de l'utilisateur.

```js
const asked = log.querySelectorAll('[data-testid="stChatMessage"]:has([data-testid="stChatMessageAvatarCustom"])');
asked[asked.length - 1].scrollIntoView({ block: "start", behavior: "smooth" });
```

## 2. L'accueil raconte la séance

Avant, la 3D tournait derrière la page sans rien dire. Maintenant, **le haut de l'accueil est un récit en quatre
chapitres**, et la ville 3D du CAC 40 le joue :

| Chapitre | Le texte | La caméra |
| --- | --- | --- |
| La séance | « Le CAC 40 recule de 0,11 % », les points, combien de valeurs montent, les horloges des places | vue d'ensemble de la ville |
| Hausse | la plus forte hausse du CAC 40, puis les deux suivantes | elle file vers sa tour, qui s'allume en vert, les autres s'assombrissent |
| Baisse | la plus forte baisse | même chose, en rouge |
| L'actualité | l'histoire reprise par le plus de sources, un bouton vers le fil | la ville passe en rayons X |

Le principe (le *scrollytelling* des sites de presse) : la section est haute de plusieurs écrans, sa **scène reste
collée** en haut (`position: sticky`) et la **position du défilement choisit le chapitre**. `motion.js` publie l'état
dans `window.__fvStory` (chapitre, progression) ; le moteur 3D le lit à chaque image et amortit sa caméra vers la pose
du chapitre. La tour mise en valeur passe par le *shader* : chaque bâtiment porte un numéro (`aId`) et un réglage
`uHi` dit lequel éclairer. Dès que la caméra et l'éclairage ont rejoint le chapitre, le moteur revient au repos
(une image sur trois) : lire le fil ne vide pas la batterie d'un téléphone.

Les chiffres sont **ceux du moment**, tirés de Yahoo Finance avec `yfinance` (les 40 valeurs, avec cache, comme pour
la carte du CAC 40 de l'étape 11). Sans eux, le récit garde seulement le chapitre de la séance.

Ce qui ne change pas : **sans JavaScript, tout reste lisible** (les chapitres s'affichent les uns sous les autres), un
seul chapitre est lu à la fois par les lecteurs d'écran (`aria-hidden` sur les autres), les étiquettes du rail sont
de vrais boutons, et « réduire les animations » coupe les transitions.

## 3. Le mouvement, avec GSAP, et pas partout

Deux principes de design ont guidé les choix :

- **un seul grand moment** vaut mieux que des effets éparpillés : les apparitions en fondu sur chaque bloc, qu'on
  voit sur tous les sites générés, ont été **retirées** ;
- une animation doit **dire quelque chose**. Ici, elles reprennent les gestes de la Bourse.

| Effet | D'où il vient | Comment |
| --- | --- | --- |
| Les cours en rouleaux | les tableaux de cotation | chaque chiffre devient une colonne 0-9 qui défile jusqu'à sa valeur (`gsap.fromTo`, `yPercent`) |
| Les dépêches qui s'impriment | le fil d'une agence de presse | la carte se dévoile de gauche à droite (`clip-path`, `ScrollTrigger.batch`) |
| Les horloges des places | les écrans des salles de marché | l'heure et « ouverte / fermée » se mettent à jour dans le navigateur |

GSAP est **copié dans le projet** (`static/fv3d/`, version 3.12.5, licence gratuite incluse) plutôt que chargé depuis
un CDN : le site ne dépend pas d'un service extérieur. Deux pièges propres à Streamlit :

- la page ne défile pas dans `window` mais dans `[data-testid=stMain]` : il faut le dire à ScrollTrigger,
  `ScrollTrigger.defaults({ scroller })` ;
- Streamlit redessine des morceaux de page à tout moment : un `MutationObserver` repère les nouveaux chiffres et les
  nouvelles cartes.

Pour l'accessibilité, le texte d'origine du chiffre reste dans la page (lu par les lecteurs d'écran) ; la colonne qui
défile est décorative (`aria-hidden`), et le chiffre final est en place dès le départ.

## 4. Une typographie moins « gabarit »

| Avant | Après |
| --- | --- |
| Titres en IBM Plex Sans | **Schibsted Grotesk**, une grotesque dessinée pour un groupe de presse, plus serrée et plus franche |
| Petites étiquettes en MAJUSCULES espacées | en minuscules, ou supprimées quand elles répétaient le titre |
| La fin des titres en dégradé de couleur | d'une seule couleur |
| Un point devant chaque titre de section | supprimé |
| Des flèches « → » au bout des liens | supprimées : le texte du lien suffit |

Toutes ces marques se retrouvent sur la plupart des pages générées automatiquement ; les retirer rend le site plus
personnel et plus calme.

## 5. La bande-annonce, refaite en motion design

L'ancienne vidéo enchaînait des captures du site. La nouvelle est **montée avec Remotion** : une vidéo écrite en
React, où chaque image est un rendu, calculé à partir de son numéro (`useCurrentFrame`). On peut donc animer des
**vraies données** :

1. `tools/footage.py` filme cinq séquences dans le vrai site, **image par image** (le temps est arrêté : le moteur 3D,
   les animations CSS et GSAP avancent de 1/30 s entre deux captures), et écrit les chiffres de la séance
   (`video/public/data.json`) ;
2. `video/src/Trailer.tsx` monte le tout : ouverture sur la séance du jour (« Le CAC 40 recule de 0,11 % », en
   rouleaux), le récit de l'accueil, le palmarès des hausses et des baisses en barres, le fil, le globe des marchés,
   la chaîne du bitcoin, l'assistant, puis la signature.

```bash
python tools/footage.py --url http://localhost:8501/
cd video && npm install && npx remotion render Trailer out/trailer.mp4
```

Les polices sont **dans le projet** (`video/public/fonts/`) plutôt que chargées en ligne pendant le rendu : le
navigateur de Remotion ne passe pas toujours par le réseau de la machine. Les séquences filmées ne sont pas dans Git
(trop lourdes) : on les refait à la demande. Résultat : `docs/branding/trailer.mp4`.

## 6. Vérifier

- `pytest` : un nouveau test vérifie le récit (quatre chapitres, un seul lu à la fois, titre de dépêche échappé,
  pluriels justes : « 3 autres sources »).
- `tools/ux_audit.py` (sombre, clair, téléphone) : contraste, y compris sur le décor 3D, et tailles des boutons.
  Il ignore désormais le texte caché aux lecteurs d'écran (les chapitres inactifs).
- Des captures d'écran à chaque chapitre, sur ordinateur et sur téléphone.

## 7. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| La page descend toute seule tout en bas | `st.chat_input` au niveau de la page | Le placer dans un `st.container` |
| La question ne remonte pas en haut de l'écran | Le sélecteur visait `aria-label`, vide | Reconnaître l'icône des messages de l'utilisateur |
| Les animations au défilement ne partent jamais | La page défile dans `stMain`, pas dans `window` | `ScrollTrigger.defaults({ scroller })` |
| « 0 , 41 % » : une virgule trop large | Les chiffres à chasse fixe (`tabular-nums`) élargissent aussi la virgule | `font-variant-numeric: proportional-nums` sur les grands chiffres |
| « 3 autre sources » | Le pluriel n'était ajouté qu'au dernier mot | Mettre chaque mot au pluriel |
| Le rendu Remotion échoue sur les polices | Le navigateur de rendu ne passe pas par le proxy | Polices locales avec `@remotion/fonts` |
| L'audit signale du texte invisible | Les chapitres inactifs sont transparents | Ignorer ce qui est `aria-hidden` |

Étape suivante : [des maquettes 3D dans la page](33-maquettes-3d.md). Retour au [sommaire du guide](README.md).
