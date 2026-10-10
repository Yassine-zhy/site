# Étape 15 — Un design professionnel, et un mode sombre sans bouton invisible

> **Objectif :** passer d'un style « journal papier » à l'interface d'une vraie plateforme d'information financière
> (barre d'application avec logo, cartes, tableaux de données, chiffres colorés), et corriger les boutons qui
> disparaissaient en mode sombre.

Fichiers créés : `assets/logo.svg`, ce guide. Fichiers modifiés : `theme.py` (réécrit), `.streamlit/config.toml`,
`app.py`, `ui.py`, toutes les pages de `views/`, `tests/test_market_theme.py`.

---

## 1. Le bug : des boutons invisibles en mode sombre

Dans `config.toml`, la couleur principale (`primaryColor`) du thème sombre était **crème** (`#ECE6D8`), pour imiter
l'encre claire sur fond ardoise. Or Streamlit écrit **toujours en blanc** sur les boutons principaux
(`type="primary"`), les cases cochées, le jour choisi d'un calendrier… Blanc sur crème : le texte disparaît
(bouton « Créer l'alerte », « Ajouter » du portefeuille, etc.).

### Mesurer la lisibilité : le contraste WCAG

Les règles d'accessibilité du Web (WCAG) mesurent la lisibilité par un **rapport de contraste** entre deux couleurs,
de 1 (identiques) à 21 (noir sur blanc) :

```
contraste = (L_claire + 0,05) / (L_foncée + 0,05)       L = luminance relative (0 = noir, 1 = blanc)
```

| Élément | Minimum |
| --- | --- |
| Texte courant | 4,5 |
| Grand texte, icônes, bordures de boutons | 3 |

Blanc sur `#ECE6D8` : **1,2**. Blanc sur le nouveau bleu sombre `#3A69EA` : **4,8**. ✅

### Un test pour que le bug ne revienne jamais

`tests/test_market_theme.py` lit `config.toml` et vérifie les deux thèmes :

```python
for mode in ("light", "dark"):
    palette = config["theme"][mode]
    assert contrast(palette["primaryColor"], "#FFFFFF") >= 4.5          # texte du bouton
    assert contrast(palette["primaryColor"], palette["backgroundColor"]) >= 3   # bouton visible sur le fond
```

C'est un **test de non-régression** : si quelqu'un remet une couleur trop claire, `pytest` échoue.

---

## 2. Des couleurs différentes en clair et en sombre… en CSS

Jusqu'ici, toutes nos couleurs CSS devaient fonctionner **sur les deux fonds**, car quand on change de thème
Streamlit **ne relance pas** le script Python : impossible de choisir la couleur en Python.

En inspectant la page (clic droit → *Inspecter*), on découvre que Streamlit pose la propriété CSS
`color-scheme: light` ou `color-scheme: dark` sur l'élément `.stApp`. Le navigateur sait donc quel thème est actif,
et la fonction CSS **`light-dark()`** en profite :

```css
.stApp {
  --fv-surface: light-dark(#ffffff, #11161d);   /* (couleur en clair, couleur en sombre) */
  --fv-up:      light-dark(#06753a, #3cc27a);   /* vert foncé sur blanc, vert vif sur bleu nuit */
}
.fv-kpi { background: var(--fv-surface); }
```

Quand l'utilisateur change de thème, `color-scheme` change, et **toutes** les couleurs suivent instantanément.
`light-dark()` fonctionne dans tous les navigateurs récents (Chrome, Edge, Firefox, Safari depuis 2024).

> Exception : les **images** (mini-courbes en SVG) et les **graphiques Altair** ne voient pas le CSS. Pour eux, on
> garde des teintes moyennes lisibles sur les deux fonds (`theme.UP`, `theme.DOWN`, `theme.NEUTRAL`).

---

## 3. Les jetons de design

Un **jeton de design** (*design token*) est une variable qui porte une décision visuelle. On ne tape plus jamais
`#e4e8ee` dans un composant : on écrit `var(--fv-line)`. Changer un jeton change tout le site.

| Jeton | Rôle | Clair | Sombre |
| --- | --- | --- | --- |
| `--fv-bg` | fond de page | gris bleuté très clair | bleu nuit |
| `--fv-surface` | cartes, tableaux | blanc | bleu nuit plus clair |
| `--fv-line` | filets, bordures | gris clair | gris bleu foncé |
| `--fv-text`, `--fv-muted` | texte, texte secondaire | presque noir, gris | presque blanc, gris clair |
| `--fv-brand` | liens, éléments actifs | bleu FinVeille | bleu lumineux |
| `--fv-up`, `--fv-down` | hausse, baisse | vert et rouge foncés | vert et rouge vifs |
| `--fv-warn` | alertes, notes | ambre foncé | ambre clair |

Règles qu'on s'impose :

- **une seule couleur de marque** (le bleu), réservée aux actions et aux liens ;
- la couleur des **données** est réservée à la hausse, la baisse et aux rubriques, et toujours doublée d'un signe
  (▲ ▼ + −) ou d'un nom : un daltonien ne perd aucune information ;
- **une seule police d'interface** (IBM Plex Sans), le serif (Newsreader) seulement pour les titres d'articles,
  les chiffres en IBM Plex Mono (chiffres de même largeur : les colonnes s'alignent).

---

## 4. Les cartes

Une interface professionnelle range l'information dans des **cartes** : un fond blanc, une bordure fine, des coins
arrondis, une ombre très légère. Deux façons d'en faire :

**En HTML**, avec les petites fonctions de `theme.py` :

```python
st.html(theme.card(f'<ul class="fv-ranking">{rows}</ul>', "Plus fortes hausses"))
st.html(theme.table(["Entreprise", "Rendement", "Volatilité"], rows))   # tableau dans sa carte
```

**Autour d'éléments Streamlit** (boutons, graphiques), avec un conteneur à clé : Streamlit ajoute la classe CSS
`st-key-<clé>`, que le CSS met en forme.

```python
with st.container(key="fvpanel_feed"):        # carte sans marge intérieure (liste d'articles)
    for article in articles:
        article_card(...)
with st.container(key="fvchart_compare"):     # carte pour un graphique
    st.altair_chart(chart)
```

```css
[class*="st-key-fvpanel_"] { background: var(--fv-surface); border: 1px solid var(--fv-line); border-radius: 10px; }
```

`[class*="st-key-fvpanel_"]` signifie « tout élément dont la classe **contient** `st-key-fvpanel_` » : une seule
règle pour toutes les cartes.

Pour que les graphiques Altair se fondent dans leur carte : `.properties(background="transparent")`.

---

## 5. La barre d'application

- **Le logo** : `st.logo("assets/logo.svg")` le place en haut à gauche. C'est un fichier SVG dessiné à la main
  (un carré bleu et une courbe, quelques lignes de texte). Le nom « FinVeille » est ajouté **en CSS**, à côté :
  ```css
  [data-testid="stLogoLink"]::after { content: "FinVeille"; font-weight: 700; }
  ```
  Avantage : écrit en texte, il prend la couleur du thème (noir en clair, blanc en sombre), ce qu'une image ne sait
  pas faire.
- **Le compte** (« Se connecter » ou ton prénom) est un conteneur `key="fvaccount"` placé dans la barre du haut avec
  `position: fixed`.
- **Le menu** reste celui de `st.navigation(position="top")` : sur mobile, il se replie tout seul.

---

## 6. Le fil, repensé

- **Plus de barre latérale** : les filtres secondaires (sources, articles lus ou masqués, vue compacte, photo) sont
  dans un menu **Filtres** (`st.popover`) à côté de la recherche. Toutes les pages ont ainsi la même structure.
- **Les tendances** : les sujets qui montent (étape 13) deviennent des boutons. Un clic lance la recherche :
  ```python
  def search_for(term):
      st.session_state.feed_query = f'"{term}"' if " " in term else term   # la clé du champ de recherche

  st.button(term, on_click=search_for, args=(term,))
  ```
  On modifie la valeur d'un widget **dans un callback** : c'est exécuté avant que le champ ne soit redessiné.
- **La une** n'est plus la dernière dépêche avec une photo, mais **l'histoire reprise par le plus de sources** depuis
  12 heures (`analytics.most_covered`, étape 13), avec la mention « reprise par 3 autres sources ».
- **Les photos sont désactivées par défaut.** Les illustrations des sites crypto (rendus 3D) et les photos de banque
  d'images alourdissent la page sans informer. Elles se réactivent dans *Filtres* ou *Réglages*.

---

## 7. Mobile

Sur un écran étroit, les éléments côte à côte doivent pouvoir passer à la ligne :

```css
.st-key-fvtoolbar { flex-wrap: wrap; }                        /* la barre d'outils peut passer sur 2 lignes */
.st-key-fvtoolbar > div:first-child { flex: 1 1 18rem; }      /* la recherche garde au moins 18rem de large */
@media (max-width: 640px) {                                   /* seulement sur téléphone : */
  .stApp .fv-sessions { flex-wrap: nowrap; overflow-x: auto; } /* places boursières sur une ligne qui défile */
}
```

Teste toujours avec les outils du navigateur (F12 → icône téléphone) en 390 px de large.

---

## 8. Exercices

1. Ajoute un jeton `--fv-radius-small: 6px` et utilise-le pour les étiquettes de rubrique et les cellules de la
   carte du CAC 40.
2. Change la couleur de marque en vert sapin. Que faut-il vérifier avant de valider ? (Indice : le test de contraste,
   et la confusion possible avec la couleur de la hausse.)
3. **Défi :** un mode « haute densité » (réglage) qui réduit les marges des cartes et la taille des titres, pour voir
   plus d'articles à l'écran.

---

## 9. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Un bouton bleu sans texte, ou un texte invisible | Couleur principale trop claire sous un texte blanc | Contraste ≥ 4,5 avec le blanc ; lance `pytest`. |
| Les listes de `st.html` sont décalées vers la droite | Streamlit ajoute `padding-left: 2rem` aux `ul` avec un sélecteur plus **spécifique** | Sélecteur plus fort : `.stApp ul[class^="fv-"] { padding-left: 0 }`. |
| La modification de `theme.py` ne s'affiche pas | Streamlit ne recharge pas toujours un module importé | Arrête et relance `streamlit run app.py`. |
| Une couleur ne change pas avec le thème | Couleur écrite en dur, ou dans une image / un graphique | Utilise un jeton `var(--fv-…)` ; pour Altair et les SVG, une teinte moyenne. |
| `light-dark()` sans effet | Navigateur ancien | Mets à jour le navigateur (ou ajoute une couleur de repli avant la ligne). |
| Fond gris derrière un graphique dans une carte blanche | Altair peint le fond du thème | `.properties(background="transparent")`. |
| Le logo est flou ou déformé | Image bitmap trop petite | Utilise un SVG (vectoriel : net à toutes les tailles). |

Étape suivante : [le tableau de bord économique](16-tableau-de-bord-economique.md). Retour au [sommaire du guide](README.md).
