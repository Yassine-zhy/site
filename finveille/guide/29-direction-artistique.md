# Étape 29 — Une direction artistique : illustrations, transitions, mise en ligne

> **Objectif :** passer d'un site « bien rangé » à un site qui a une **identité** : une idée visuelle qui revient
> sur chaque page, des illustrations à nous, des transitions soignées. Puis mettre le site en ligne.

Fichiers créés : `art.py`, `docs/branding/demo.mp4`, ce guide. Fichiers modifiés : `theme.py`, `app.py`, les
pages de `views/`, `docs/brand-guidelines.md`, `README.md`, `docs/screenshots/`.

Démonstration en vidéo (29 s) : [`docs/branding/demo.mp4`](../docs/branding/demo.mp4).

---

## 1. Une idée avant des effets

Une direction artistique (« DA ») commence par **une phrase**, pas par une animation. Pour FinVeille :

> **Le terminal de nuit** : une salle des marchés la nuit, des écrans bleu nuit, des lignes de cours qui
> s'allument, du verre.

Chaque décision en découle, et ce qui n'en découle pas n'entre pas sur le site. Le motif central est déjà dans le
logo : **la barre du F devient une courbe de cours qui monte**, terminée par un point menthe. On la reprend partout.

---

## 2. La ligne signature et le décor de l'en-tête

`art.signature_line()` dessine une courbe de cours stylisée (toujours la même : des sinus, pas de hasard), lissée
par une courbe de Catmull-Rom, avec un halo flou, une aire dégradée et le point menthe qui pulse. Elle traverse
chaque en-tête, derrière le texte, avec deux halos (bleu, violet) qui dérivent en 24 et 31 secondes.

Deux détails qui font la différence :

- **les bords fondus** : un décor coupé net par le cadre de l'en-tête dessine un rectangle visible. Un masque CSS
  (deux dégradés croisés) fait disparaître le décor dans le fond de la page ;
- **le recadrage par la droite** (`preserveAspectRatio="xMaxYMax slice"`) : sur un téléphone, l'image perd sa
  gauche, mais le point menthe reste toujours visible.

---

## 3. Une illustration par page

Les pages sans tuiles de cours reçoivent une illustration : un **panneau de verre** (trois points de fenêtre, une
grille) et le motif de la page au trait dégradé, dessinés à la main en SVG dans `art.py` :

```python
GLYPHS = {
    "portfolio": lambda: _line(_arc(160, 128, 56, 0, 150), 1, 14) + _line(_arc(160, 128, 56, 162, 262), 2, 14, VIOLET) + …,
    "alerts": lambda: _line("M160,70 c-26,0 -42,20 …") + …,   # une cloche, ses ondes et le seuil franchi
    …
}
theme.page_header("Ton portefeuille,", "…", accent="sans risquer un euro.", art="portfolio")
```

Pourquoi pas des photos ou des images générées ? Les photos de banques d'images ont des licences à vérifier et
ressemblent à tous les autres sites ; des images générées seraient de « fausses » images. Un dessin au trait,
dans les couleurs de la marque, est à nous et dit exactement ce que fait la page.

### Le piège : le cercle qui ne se dessine pas

Un cercle tracé comme un arc de 0 à 359,9° ne s'affichait pas pour les petits rayons : arrondi à une décimale, le
point d'arrivée devient **identique** au point de départ, et un arc qui revient sur lui-même n'est pas dessiné. Un
cercle se trace donc en deux demi-arcs (`art._circle`).

---

## 4. Les transitions

| Moment | Comment |
| --- | --- |
| Changement de page | Les blocs de la page arrivent en cascade : `animation: fv-enter .5s` avec 40 ms d'écart, 8 blocs au plus |
| Traits qui se dessinent | `pathLength="1"`, `stroke-dasharray: 1` et `stroke-dashoffset` de 1 à 0, **dans le SVG** (il anime tout seul, même en image) |
| Titre | Le dégradé de la formule, deux fois plus large que le texte, glisse une fois (`background-position`) |
| Défilement | Les cartes apparaissent en entrant à l'écran : `animation-timeline: view()` |
| Mini-courbes des tuiles | Elles se tracent de gauche à droite (`sparkline_uri(animate=True)`) |

Trois règles, celles de la recommandation ui-ux-pro-max :

1. **Ne jamais cacher du contenu en attendant une animation.** L'apparition au défilement est enveloppée dans
   `@supports (animation-timeline: view())` : un navigateur qui ne connaît pas cette propriété affiche tout,
   simplement.
2. **Rien ne se rejoue en boucle.** L'en-tête du fil est redessiné chaque minute (horloges des places
   boursières) : il porte la classe `is-live`, qui coupe ses animations d'entrée et utilise la ligne immobile.
3. **Tout s'arrête** avec `prefers-reduced-motion: reduce`, y compris à l'intérieur des SVG (leur propre
   `@media`).

---

## 5. Savoir où l'on est : la rubrique active

Le menu du haut de Streamlit ne signale pas la rubrique de la page ouverte. `app.py` la retrouve et
`theme.nav_active` la souligne (fond teinté, texte de marque, trait dégradé) :

```python
theme.nav_active(next(i for i, entries in enumerate(pages.values())
                      if any(entry.url_path == page.url_path for entry in entries)))
```

---

## 6. Vérifier : l'audit et une vidéo

- `tools/ux_audit.py` (guide 28) : **0 point** sur ordinateur après la refonte. Le décor ne gêne aucun texte.
- Une capture ne montre pas un mouvement : la vidéo de démonstration est enregistrée par Playwright
  (`record_video_dir`), puis convertie en MP4 léger :

```bash
ffmpeg -i page.webm -vf "fps=30,scale=1280:-2" -c:v libx264 -pix_fmt yuv420p -crf 26 -movflags +faststart demo.mp4
```

---

## 7. La mise en ligne

Streamlit Community Cloud déploie un dépôt **public**. Le dépôt du projet contient d'autres choses à sa racine :
on publie donc une branche qui ne contient **que** le dossier `finveille/`, à la racine, grâce à `git subtree` :

```bash
git subtree split --prefix finveille -b finveille-deploy        # l'historique du dossier, seul
git log -p finveille-deploy | grep -E "AQ\.|AIza|gsk_|hf_"       # aucun secret dans tout l'historique publié
git push origin finveille-deploy:refs/heads/finveille-app
```

Sur [share.streamlit.io](https://share.streamlit.io) : *Create app*, dépôt public, branche `finveille-app`,
fichier `app.py`, puis la clé `GEMINI_API_KEY` dans *Advanced settings → Secrets*. À chaque nouveau `git push`
de cette branche, Streamlit remet le site à jour tout seul.

---

## 8. Exercices

1. Ajoute une illustration pour la fiche d'une entreprise (une bougie japonaise, par exemple).
2. Fais varier la ligne signature selon la séance : montante si le CAC 40 monte, descendante sinon.
3. Enregistre une vidéo de démonstration en thème clair et sur téléphone (375 px).

---

## 9. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Un rectangle se voit autour du décor de l'en-tête | Halos coupés net par le cadre | Masque aux bords fondus sur `.fv-hero-art`. |
| Un cercle de l'illustration manque | Arc dont l'arrivée égale le départ après arrondi | Deux demi-arcs (`art._circle`). |
| Une animation se rejoue toutes les minutes | Élément d'un fragment `run_every` dont le HTML change | Classe `is-live` : pas d'animation d'entrée. |
| Les cartes restent invisibles dans un vieux navigateur | Animation au défilement sans repli | L'envelopper dans `@supports (animation-timeline: view())`. |
| Le site en ligne ne change pas après un push | Push sur une autre branche | Refaire le `subtree split` et pousser `finveille-app`. |

Étape suivante : [un monde en 3D](30-monde-3d.md). Retour au [sommaire du guide](README.md).
