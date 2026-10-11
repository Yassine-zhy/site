# Étape 27 — Des pages aussi belles que la bannière

> **Objectif :** donner aux pages principales (le fil, Marchés, Économie, Crypto, le brief, l'assistant) la force
> des visuels de la marque (`docs/branding/`) : un grand titre dont la fin passe en couleur, de la profondeur, de
> l'air, des cours qui flottent. Et supprimer le dernier moment « vide » du site : l'attente des photos.

Fichiers modifiés : `theme.py`, `ui.py`, `core/images.py`, `views/feed.py`, `views/markets.py`, `views/economy.py`,
`views/crypto.py`, `views/brief.py`, `views/assistant.py`, `views/stats.py`, `views/compare.py`,
`tests/test_images.py`, `README.md`, `docs/screenshots/`, ce guide.

---

## 1. Pourquoi la bannière plaît (et pas la page)

On compare les deux côte à côte et on liste ce que la bannière fait, et pas la page :

| La bannière | L'ancienne page |
| --- | --- |
| **Un** message, en très grand (jusqu'à 58 px) | Un titre moyen dans une boîte, à côté de beaucoup d'autres boîtes |
| La fin du titre en dégradé : l'œil sait où aller | Tout le titre de la même couleur |
| De la profondeur : tuiles inclinées, ombres, halo | Des cartes à plat |
| Beaucoup de vide autour du titre | Un cadre bordé autour de l'en-tête |

Ce sont des **règles de composition**, pas des goûts : on peut les appliquer au code.

---

## 2. L'en-tête « héros »

`theme.hero_html` remplace l'ancien en-tête encadré. Plus de bordure : le titre se pose directement sur le fond,
le quadrillage de salle de marché n'apparaît qu'à droite (un masque `radial-gradient` l'efface ailleurs).

```python
theme.page_header("Les marchés mondiaux,", "Indices, CAC 40, devises…", eyebrow="Marchés",
                  accent="en un coup d'œil.", quotes=hero_quotes("^STOXX50E", "^IXIC", "^N225"))
```

- `accent` : la fin du titre, écrite en dégradé de marque. Chaque page principale a sa formule :
  « L'actualité financière, *en continu.* », « Le brief *du jour.* », « Pose ta question, *l'IA cite ses
  sources.* »…
- `quotes` : les cours à faire flotter à droite (facultatif).

Le dégradé sur du texte tient en trois lignes de CSS :

```css
.fv-hero-title em { display: inline-block;   /* la fin du titre reste d'un seul tenant */
  background: linear-gradient(90deg, var(--fv-brand), var(--fv-brand-2));
  -webkit-background-clip: text; background-clip: text; color: transparent; }
```

`display: inline-block` évite une coupure maladroite (« L'économie, en / chiffres officiels ») : la formule passe
à la ligne en entier. `text-wrap: balance` équilibre la longueur des lignes du titre.

---

## 3. Les tuiles qui flottent

Ce sont les tuiles de la bannière, avec les vrais cours : nom, cours, variation de la séance, courbe sur un mois.
Elles sont posées en **composition décalée** (la 2ᵉ descend, la 3ᵉ glisse vers la droite) et inclinées :

```css
.fv-hero-aside { transform: perspective(1400px) rotateY(-11deg) rotateX(4deg); }
.fv-float:nth-child(2) { translate: 0 1.75rem; }
.fv-float:nth-child(3) { translate: 32% -.25rem; }
```

**Aucun appel réseau de plus** : `ui.hero_quotes` pioche dans les cours du bandeau, déjà en mémoire. Si une source
est en panne, la tuile manquante est simplement omise. Sur téléphone, l'inclinaison disparaît et les trois tuiles
se rangent sur une ligne, sans courbe : un résumé des marchés lisible en un coup d'œil.

| Page | Tuiles |
| --- | --- |
| Le fil | CAC 40, S&P 500, Bitcoin |
| Marchés | Euro Stoxx 50, Nasdaq, Nikkei 225 |
| Économie | EUR/USD, pétrole Brent, or |

(Pas de tuiles sur la page Crypto : ses cours sont en euros, ceux du bandeau en dollars.)

---

## 4. Le squelette de chargement

Mesure avant la refonte : après l'arrivée des dépêches, la zone sous la barre de recherche restait **vide pendant
une dizaine de secondes**, le temps de chercher les photos de 16 articles. Le visiteur croit que le site est cassé.

Deux corrections :

1. **La colonne de droite d'abord.** Dans Streamlit, une colonne se remplit dans l'ordre du code, pas de l'écran :
   on écrit donc les chiffres du fil (rapides) avant de chercher les photos (lentes).
2. **Un squelette** à la place des articles à venir : des formes grises qui ondulent doucement, à l'endroit exact
   de la une et des vignettes. Rien ne saute quand le vrai contenu arrive.

```python
waiting = st.empty()
if not images.all_known(wanted):        # vraie attente : des pages jamais lues
    waiting.html(theme.feed_skeleton())
pictures = images.share_images(wanted)
waiting.empty()                         # le squelette disparaît, les articles prennent sa place
```

`images.all_known` évite un piège : sans lui, le squelette clignoterait à chaque clic (les photos sont déjà en
mémoire, l'attente dure quelques millisecondes). Pour un lecteur d'écran, le squelette annonce « Chargement du
fil… » (`role="status"`).

---

## 5. Les finitions

- **Les boutons d'action restent discrets** (« Lire », « Résumé », « Garder »…) tant qu'on ne survole pas
  l'article : le fil se lit comme un journal, et les actions apparaissent au moment où on les cherche. Au clavier,
  elles s'allument dès qu'un bouton reçoit le focus (`:focus-within`) ; sur écran tactile, elles restent visibles.

  ```css
  @media (hover: hover) and (pointer: fine) {
    [class*="st-key-fvcard_"] [class*="st-key-fvactions_"] { opacity: .55; }
    [class*="st-key-fvcard_"]:hover [class*="st-key-fvactions_"],
    [class*="st-key-fvcard_"]:focus-within [class*="st-key-fvactions_"] { opacity: 1; }
  }
  ```

- **Les dépêches arrivent en cascade** (300 à 450 ms, la une puis les vignettes une à une). L'animation ne se joue
  qu'une fois : Streamlit garde les éléments déjà affichés d'une exécution à l'autre.
- **L'en-tête du fil n'est pas animé** (classe `is-live`) : il se redessine chaque minute pour les horloges des
  places boursières, et une animation rejouée chaque minute fatigue l'œil.
- **Pas de doublon** : la carte bleue de l'assistant répétait le titre de la page ; elle ne garde que l'état de
  l'IA et ses trois promesses.
- Tout mouvement s'arrête si le visiteur a demandé moins d'animations (`prefers-reduced-motion`).

---

## 6. Exercices

1. Ajoute des tuiles flottantes à la page *Comparer* : les entreprises comparées, avec leur variation sur un an.
2. Donne au squelette la forme de la page *Marchés* (douze tuiles) et affiche-le pendant le premier chargement des
   cours.
3. Mesure avec Playwright le temps avant le premier élément utile à l'écran (`wait_for` sur la colonne de droite),
   avant et après ce guide.

---

## 7. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Une modification du CSS n'apparaît pas | `fileWatcherType = "none"` (guide 25) : les modules ne sont pas rechargés | Redémarre le serveur, ou lance avec `--server.fileWatcherType auto` pour développer. |
| Une animation se rejoue toute seule | L'élément est dans un `st.fragment(run_every=…)` dont le HTML change | Pas d'animation d'entrée sur les éléments rafraîchis (classe `is-live`). |
| La fin du titre en dégradé se coupe au milieu | Le dégradé suit le texte ligne par ligne | `display: inline-block` sur la formule. |
| Le squelette clignote à chaque clic | Il s'affiche même quand les photos sont en mémoire | Ne l'afficher que si `images.all_known(...)` est faux. |
| Un test Playwright trouve le texte trop tôt | `get_by_text` ignore la casse : « en continu. » (titre) répond pour « En continu » | `get_by_text("En continu", exact=True)`. |

Retour au [sommaire du guide](README.md).
