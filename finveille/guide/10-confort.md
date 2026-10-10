# Étape 10 — Confort : menu par sections, recherche avancée, vue compacte, notes, glossaire

> **Objectif :** rendre l'application agréable au quotidien. Un menu rangé, une recherche puissante, une vue pour
> parcourir vite, des notes personnelles sur les favoris, et un glossaire de la finance.

Fichiers créés : `core/glossary.py`, `views/glossary.py`, `tests/test_glossary.py`. Fichiers modifiés :
`core/filters.py`, `core/storage.py`, `ui.py`, `views/feed.py`, `views/favorites.py`, `views/settings.py`,
`theme.py`, `app.py`.

---

## 1. Un menu par sections

Avec dix pages, un menu à plat devient illisible. `st.navigation` accepte un **dictionnaire** `{section: pages}` ; dans
le menu du haut, chaque section devient un **menu déroulant** :

```python
pages = {
    "Actualité": [st.Page("views/feed.py", title="Le fil", default=True), st.Page("views/stats.py", …)],
    "Marchés": [...],
    "Mon espace": [...],
    "Outils": [...],
}
st.navigation(pages, position="top").run()
```

Regrouper par **intention** (« je veux lire l'actualité », « je veux gérer mes affaires ») est plus parlant que par
type technique.

---

## 2. La recherche avancée

La barre de recherche comprend maintenant la syntaxe des moteurs de recherche :

| Tu tapes | Résultat |
| --- | --- |
| `inflation bce` | les articles qui contiennent **les deux** mots |
| `"banque centrale"` | l'**expression exacte**, mots dans cet ordre |
| `-crypto` | **exclut** les articles qui contiennent « crypto » |
| `source:cnbc` | seulement les sources dont le nom contient « cnbc » |

On peut tout combiner : `inflation "banque centrale" -bitcoin source:cnbc`.

### Découper la recherche : `shlex`

```python
lexer = shlex.shlex(text, posix=True)
lexer.quotes = '"'
lexer.whitespace_split = True
parts = list(lexer)       # 'inflation "banque centrale"' -> ['inflation', 'banque centrale']
```

`shlex` est le module de Python qui découpe une ligne de commande en respectant les guillemets. Deux réglages
comptent :

- `lexer.quotes = '"'` : seuls les guillemets **droits** délimitent une expression. Par défaut, l'apostrophe compte
  aussi, et « l'or et l'argent » deviendrait « lor et largent » ! On remplace aussi les guillemets français `« »` par
  des droits avant de découper.
- Si un guillemet n'est jamais refermé, `shlex` lève `ValueError` : on se rabat alors sur un simple découpage par
  espaces. **Une barre de recherche ne doit jamais planter**, quoi qu'on y tape.

Chaque morceau est ensuite rangé dans une `Query` (termes, exclusions, sources), une petite `dataclass`. La recherche
est analysée **une seule fois** par affichage, puis appliquée à tous les articles.

---

## 3. La vue compacte

Un interrupteur dans la barre latérale (et un réglage par défaut dans Réglages) affiche **une ligne par article** :
rubrique, source, heure et titre, sans chapeau. Idéal pour parcourir 80 dépêches en une minute.

```python
def article_card(article, status, key_prefix, lead=False, compact=False, note=None, with_note=False):
```

Ajouter un **paramètre avec valeur par défaut** (`compact=False`) est la façon la plus sûre de faire évoluer une
fonction : tous les appels existants continuent de fonctionner sans modification.

---

## 4. Les notes sur les favoris

Une nouvelle table, sur le modèle des précédentes :

```sql
CREATE TABLE IF NOT EXISTS notes (
    article_id TEXT PRIMARY KEY,
    text       TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

Sur la page Favoris, chaque article a un bouton « Annoter » qui ouvre un `st.popover` avec une zone de texte. Une note
**vide** supprime la ligne (`DELETE`) plutôt que de garder une note vide : la base reste propre. La note s'affiche
ensuite sous le titre, en italique, comme une annotation dans la marge d'un journal.

---

## 5. Le glossaire

`core/glossary.py` contient 55 termes, rangés par rubrique (Marchés, Valorisation, Entreprise, Macroéconomie, Crypto,
Portefeuille). La page offre une recherche, un filtre par rubrique, un index alphabétique… et un **mot du jour** :

```python
def term_of_the_day(today=None):
    terms = sorted(GLOSSARY)
    return terms[(today or date.today()).toordinal() % len(terms)]
```

`toordinal()` donne le numéro du jour depuis l'an 1. Le **modulo** (`%`, reste de la division) le ramène entre 0 et
le nombre de termes moins un. Résultat : un mot différent chaque jour, le même pour tout le monde, sans rien stocker.

### Regrouper par lettre : `groupby`

```python
entries = sorted(terms, key=normalize)
for letter, group in groupby(entries, key=lambda term: normalize(term)[0].upper()):
    ...
```

`itertools.groupby` regroupe les éléments **consécutifs** qui ont la même clé. Il faut donc trier d'abord (avec
`normalize`, pour que « Écart » se range avec les E et pas après Z).

---

## 6. Exercices

1. Ajoute l'opérateur `rubrique:macro` à la recherche (indice : comme `source:`, mais sur `article.category`).
2. Ajoute 5 termes au glossaire (par exemple *Repo*, *OAT*, *Spread de crédit*, *Short squeeze*, *Effet de levier*).
3. Sur la page Favoris, ajoute un filtre « seulement les articles annotés ».

---

## 7. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Une recherche avec apostrophe ne trouve rien | Apostrophe traitée comme un guillemet | Vérifie `lexer.quotes = '"'`. |
| `ValueError: No closing quotation` | Guillemet non refermé, sans repli | Entoure `list(lexer)` d'un `try/except ValueError`. |
| `TypeError: body() takes 5 positional arguments but 6 were given` | Paramètre ajouté à l'appel mais pas à la définition (ou l'inverse) | Les deux doivent correspondre : `def body(..., compact)` et `body(..., compact)`. |
| Le glossaire range « Écart » après « Z » | Tri sur le texte brut (É vient après Z) | Trie avec `key=normalize`. |
| Une lettre apparaît deux fois dans le glossaire | `groupby` sur une liste non triée | Trie **avant** `groupby`. |

➡️ Étape suivante : [marchés : carte du CAC 40, comparateur, fiche enrichie](11-marches-avances.md).
