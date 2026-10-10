# Étape 2 — Catégories, sources et recherche

> **Objectif :** filtrer le fil par catégorie (marchés, crypto, entreprises, macro) et par source, et chercher par
> mot-clé ou nom d'entreprise.

Fichiers créés : `core/filters.py`, `core/classifier.py`. Fichiers modifiés : `core/config.py`,
`core/aggregator.py`, `app.py`.

---

## 1. Le problème des catégories

À l'étape 1, chaque flux avait une catégorie fixe : tout ce qui vient de « BBC Business » était « Entreprises ».
Mais BBC Business parle aussi d'inflation (macro) ou du pétrole (marchés). On va donc **lire** chaque article et
deviner sa catégorie à partir de **mots-clés**.

C'est une approche « à base de règles » : simple, rapide, gratuite et **explicable** (on sait toujours pourquoi un
article est classé là). Ses limites : elle ne comprend pas le sens (« la Fed ne bougera pas » contient « Fed »
comme « la Fed relève ses taux »). L'étape suivante, en entreprise, serait un modèle de *machine learning* entraîné
sur des articles déjà classés.

---

## 2. `core/filters.py` — normaliser et filtrer

### Normaliser le texte

```python
def normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))
```

Pour qu'une recherche « economie » trouve « Économie », on compare des textes **normalisés** : en minuscules et sans
accents.

- `unicodedata.normalize("NFKD", …)` décompose chaque lettre accentuée en deux caractères : « é » devient « e » +
  « ´ » (un *accent combinant*).
- `unicodedata.combining(char)` vaut vrai pour ces accents : on les retire.
- `"".join(… for … in … if …)` reconstruit une chaîne avec les caractères gardés. C'est une **expression
  génératrice** : une boucle `for` compacte, écrite à l'intérieur d'un appel de fonction.

### Chercher un mot-clé

```python
def matches_query(article, query):
    haystack = normalize(" ".join([article.title, article.summary, article.source, *article.tickers]))
    return all(word in haystack for word in normalize(query).split())
```

- `haystack` (« botte de foin ») : on colle titre, résumé, source et tickers dans un seul texte où chercher.
  `*article.tickers` « déballe » la liste des tickers dans la liste.
- `query.split()` découpe la recherche en mots : « banque centrale » → `["banque", "centrale"]`.
- `all(...)` est vrai si **tous** les mots sont présents (recherche « ET »). Pour une recherche « OU », tu
  remplacerais `all` par `any`.

### Filtrer

```python
def filter_articles(articles, categories=None, sources=None, query=""):
    kept = []
    for article in articles:
        if categories and article.category not in categories:
            continue
        ...
        kept.append(article)
    return kept
```

Règle importante : **un filtre vide ne filtre rien.** `if categories and …` : si aucune catégorie n'est choisie
(liste vide ou `None`, qui valent « faux »), on ne teste même pas.

Cette fonction est **pure** : elle ne lit rien d'extérieur (ni Internet, ni base, ni Streamlit) et ne modifie rien,
elle prend des données et en renvoie. C'est le type de fonction le plus facile à comprendre et à tester. On en
écrira les tests à l'étape 9.

---

## 3. `core/classifier.py` — deviner la catégorie

### Les mots-clés (dans `core/config.py`)

```python
CATEGORY_KEYWORDS = {
    "crypto": ["bitcoin", "btc", "ethereum", "stablecoin", ...],
    "macro": ["inflation", "fed", "bce", "taux directeur", "pib", "chomage", ...],
    ...
}
```

En anglais **et** en français, en minuscules et sans accents (puisqu'on compare à du texte normalisé).

### Les expressions régulières « frontière de mot »

```python
_PATTERNS = {
    category: [re.compile(rf"\b{re.escape(keyword)}\b") for keyword in keywords]
    for category, keywords in CATEGORY_KEYWORDS.items()
}
```

Problème : chercher `"fed"` dans le texte trouverait aussi « **Fed**Ex » ou « **fed**s ». Le motif `\b` (*word
boundary*) signifie « début ou fin de mot » : `\bfed\b` ne trouve que le mot « fed » isolé.

- `re.escape(keyword)` protège les caractères spéciaux des regex (le `&` de « s&p 500 », le `.`…).
- `rf"…"` : `r` (*raw*) garde les `\` tels quels, `f` permet d'insérer `{…}`.
- C'est une **compréhension de dictionnaire** imbriquée : pour chaque catégorie, une liste de motifs compilés. On
  compile **une seule fois** au chargement du module (compiler une regex coûte du temps ; l'utiliser, très peu).

### Le score

```python
def category_scores(text):
    text = normalize(text)
    return {category: sum(1 for p in patterns if p.search(text)) for category, patterns in _PATTERNS.items()}
```

Pour chaque catégorie, on compte combien de ses mots-clés apparaissent. Exemple : « The Fed holds rates as
inflation cools » → `{"macro": 2, "marches": 0, …}`.

### La décision

```python
def classify(article):
    scores = category_scores(f"{article.title} {article.summary}")
    scores[article.category] = scores.get(article.category, 0) + 1   # bonus au flux
    best = max(scores.values())
    if scores[article.category] == best:
        return article.category
    return max(scores, key=scores.get)
```

La catégorie du flux part avec **un point d'avance**. Pourquoi ? CoinDesk ne parle que de crypto : un article
CoinDesk qui mentionne « inflation » doit rester en crypto. Il faut **deux indices** d'une autre catégorie pour
contredire le flux. En cas d'égalité, on fait confiance au flux.

`max(scores, key=scores.get)` : « la clé du dictionnaire dont la valeur est la plus grande ».

Dans `core/aggregator.py`, on applique `classify` à chaque article après la collecte :

```python
for article in articles:
    article.category = classify(article)
```

---

## 4. `app.py` — les filtres à l'écran

### Où placer les filtres ? Pense mobile !

Sur téléphone, la **barre latérale** (`st.sidebar`) est repliée derrière un bouton `>>`. On y met donc ce qui sert
rarement (choix des sources, bouton d'actualisation). La **recherche** et les **catégories**, utilisées tout le
temps, vont en haut de la page principale.

### Les widgets renvoient une valeur

```python
query = st.text_input("Rechercher", placeholder="🔎 Mot-clé ou entreprise : …", label_visibility="collapsed")
categories = st.pills("Catégories", options=list(CATEGORIES), format_func=lambda key: CATEGORIES[key],
                      selection_mode="multi", label_visibility="collapsed")
sources = st.multiselect("Sources", options=sorted({article.source for article in articles}))
```

Un widget Streamlit **affiche** un élément et **renvoie** sa valeur actuelle. À chaque modification, le script est
relancé et la variable contient la nouvelle valeur.

- `st.pills` affiche des boutons « pilules ». `options` contient les **clés** (`"marches"`…) et `format_func` dit
  comment les **afficher** (`"📈 Marchés"`). On récupère donc directement les clés.
- `{article.source for article in articles}` est une compréhension d'**ensemble** : chaque source n'apparaît qu'une
  fois. `sorted` la transforme en liste triée.
- `label_visibility="collapsed"` cache le libellé (le texte d'aide dans la case suffit) mais le garde pour
  l'accessibilité (lecteurs d'écran).

### « Afficher plus » : la mémoire de session

Les variables Python normales sont **remises à zéro** à chaque relance du script. Pour retenir combien d'articles
afficher, on utilise `st.session_state`, un dictionnaire qui **survit** aux relances (le temps que l'onglet reste
ouvert) :

```python
if "visible_count" not in st.session_state:
    st.session_state.visible_count = PAGE_SIZE      # valeur initiale, une seule fois

def show_more():
    st.session_state.visible_count += PAGE_SIZE

st.button("Afficher plus", on_click=show_more)
```

`on_click=show_more` est un **callback** : Streamlit appelle `show_more` **avant** de relancer le script. Quand le
script redémarre, `visible_count` vaut déjà 60, et la page affiche 60 articles. Note qu'on passe la fonction
**sans parenthèses** : on la *donne* à Streamlit, on ne l'appelle pas nous-mêmes.

### Les badges de catégorie

```python
st.caption(f":{color}-badge[{CATEGORIES[article.category]}] · {md_escape(article.source)} · …")
```

`:blue-badge[texte]` est une syntaxe Markdown propre à Streamlit qui dessine une petite étiquette colorée.

### Actualiser

```python
if st.button("🔄 Actualiser les sources", width="stretch"):
    load_articles.clear()
    st.rerun()
```

Le bouton est maintenant **après** `load_articles()` dans le script. On vide donc le cache puis on relance le script
immédiatement (`st.rerun()`) pour que les nouvelles données s'affichent. `width="stretch"` étire le bouton sur toute
la largeur (plus facile à toucher sur mobile).

---

## 5. Exercices

1. Ajoute une catégorie **« 🛢️ Matières premières »** (`"matieres"`) : ajoute-la dans `CATEGORIES`,
   `CATEGORY_KEYWORDS` (oil, brent, gold, copper, wheat, pétrole, or…) et une couleur dans `CATEGORY_COLORS`.
   Aucune autre ligne à modifier : c'est la force d'une configuration bien séparée.
2. Transforme la recherche en recherche « OU » (`any` au lieu de `all`). Laquelle préfères-tu ?
3. Affiche sous chaque titre **pourquoi** l'article est dans sa catégorie (indice : `category_scores`).

---

## 6. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| `KeyError: 'matieres'` | Une catégorie existe dans les mots-clés mais pas dans `CATEGORIES` (ou l'inverse) | Les clés doivent être identiques dans `CATEGORIES`, `CATEGORY_KEYWORDS` et `CATEGORY_COLORS`. |
| `StreamlitDuplicateElementId` / `DuplicateWidgetID` | Deux widgets identiques (même libellé, même type) | Donne-leur un paramètre `key="…"` différent. |
| `StreamlitAPIException: … st.session_state has no key "visible_count"` | Lecture avant initialisation | Initialise avec `if "cle" not in st.session_state:` **en haut** du script. |
| Le bouton « Afficher plus » demande deux clics | Modification de `session_state` **après** l'affichage, dans un `if st.button(...)` | Utilise un callback `on_click=` : il s'exécute **avant** la relance. |
| La recherche « éco » ne trouve rien | Comparaison sans normalisation | Passe la requête **et** le texte dans `normalize`. |
| Un mot-clé classe mal (« fed » dans « FedEx ») | Recherche de sous-chaîne au lieu de mot entier | Utilise `\b…\b` dans la regex. |

➡️ Étape suivante : [favoris, « lu », « masquer » avec SQLite](03-favoris-lu-masquer.md).
