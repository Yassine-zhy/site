# Étape 3 — Favoris, « lu », « masquer » avec SQLite

> **Objectif :** mettre un article en favori, le marquer comme lu ou le masquer, et que ces choix **restent**
> après avoir fermé l'application. On en profite pour découper l'appli en **plusieurs pages**.

Fichiers créés : `core/storage.py`, `ui.py`, `views/feed.py`, `views/favorites.py`.
Fichiers modifiés : `core/models.py`, `core/sources.py`, `app.py` (qui devient un simple menu).

---

## 1. Pourquoi une base de données ?

`st.session_state` (étape 2) est effacé quand tu fermes l'onglet. Pour garder des informations **durablement**, il
faut les écrire sur le disque. Deux options simples :

- un **fichier JSON** : facile, mais il faut tout relire et tout réécrire à chaque modification, et deux écritures
  simultanées peuvent le corrompre ;
- une **base SQLite** : un seul fichier aussi (`data/finveille.db`), mais on peut lire et modifier une seule ligne,
  faire des recherches (« tous les favoris triés par date »), et les écritures sont sûres.

SQLite est fourni avec Python (`import sqlite3`) : rien à installer. Et le **SQL** que tu vas écrire est le même que
celui des grosses bases (PostgreSQL, Oracle…) utilisées en banque et en finance.

---

## 2. Le SQL en 5 minutes

Une base contient des **tables** (comme des feuilles Excel). Une table a des **colonnes** (typées) et des **lignes**.

```sql
CREATE TABLE IF NOT EXISTS article_status (
    article_id   TEXT PRIMARY KEY,
    is_favorite  INTEGER NOT NULL DEFAULT 0,
    is_read      INTEGER NOT NULL DEFAULT 0,
    is_hidden    INTEGER NOT NULL DEFAULT 0,
    article_json TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);
```

- `PRIMARY KEY` : la colonne qui identifie **de façon unique** une ligne (deux lignes ne peuvent pas avoir le même
  `article_id`). On utilise l'`id` calculé à l'étape 1.
- `INTEGER NOT NULL DEFAULT 0` : un nombre entier, obligatoire, qui vaut 0 si on ne précise rien. SQLite n'a pas de
  type booléen : on utilise 0 (faux) et 1 (vrai).
- `article_json` : on garde l'article **complet** (titre, URL, résumé…) au format texte JSON. Ainsi un favori reste
  consultable même quand l'article a disparu du flux RSS.
- `IF NOT EXISTS` : la commande ne fait rien si la table existe déjà. On peut donc l'exécuter à chaque démarrage.

Les commandes qu'on utilise :

```sql
SELECT article_id, is_favorite FROM article_status;                 -- lire
SELECT article_json FROM article_status WHERE is_favorite = 1
       ORDER BY updated_at DESC;                                     -- filtrer et trier
INSERT INTO article_status (...) VALUES (...);                       -- ajouter
INSERT ... ON CONFLICT(article_id) DO UPDATE SET is_read = ...;      -- ajouter OU mettre à jour
```

Le dernier s'appelle un **UPSERT** (*update* + *insert*) : « insère cette ligne ; si elle existe déjà (conflit sur la
clé primaire), mets-la à jour ». Une seule requête au lieu de « est-ce que la ligne existe ? si oui… sinon… ».

---

## 3. `core/storage.py` — parler à la base

### Ouvrir et fermer proprement la connexion

```python
@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
```

C'est un **gestionnaire de contexte** : il s'utilise avec `with`, comme `open()` pour les fichiers.

```python
with connect() as conn:
    conn.execute("…")
```

1. Tout ce qui est **avant** `yield` s'exécute à l'entrée du bloc `with` : on crée le dossier `data/` s'il n'existe
   pas, puis on ouvre la base.
2. `yield conn` « prête » la connexion au bloc `with`.
3. À la sortie du bloc, `commit()` **valide** les modifications (sans `commit`, elles seraient perdues).
4. `finally` garantit que `close()` s'exécute **même en cas d'erreur**. Une connexion jamais fermée finit par bloquer
   la base (`database is locked`).

`row_factory = sqlite3.Row` permet d'écrire `row["is_read"]` au lieu de `row[2]` : plus lisible et ça ne casse pas si
on ajoute une colonne.

### Écrire : `set_flag`

```python
def set_flag(article, flag, value):
    if flag not in FLAGS:
        raise ValueError(f"Indicateur inconnu : {flag}")
    with connect() as conn:
        conn.execute(
            f"""
            INSERT INTO article_status (article_id, {flag}, article_json, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(article_id) DO UPDATE SET {flag} = excluded.{flag}, updated_at = excluded.updated_at
            """,
            (article.id, int(value), json.dumps(article.to_dict()), _now()),
        )
```

**⚠️ Sécurité : l'injection SQL.** Les valeurs sont passées via des `?` et un tuple séparé, **jamais** collées dans
le texte de la requête. Si on écrivait `f"... VALUES ('{article.title}')"` et qu'un titre contenait
`'); DROP TABLE article_status; --`, la base exécuterait cette commande ! Avec `?`, SQLite traite la valeur comme
du texte, quoi qu'elle contienne.

Le nom de colonne `{flag}`, lui, ne peut pas être un `?` (SQLite ne l'accepte pas pour un nom de colonne). On le met
donc dans le texte, **mais** seulement après avoir vérifié qu'il fait partie d'une liste autorisée (`FLAGS`). C'est le
principe de la **liste blanche**.

`excluded.is_read` désigne « la valeur qu'on essayait d'insérer ».

### Lire : `get_statuses` et `list_favorites`

```python
def get_statuses():
    with connect() as conn:
        rows = conn.execute("SELECT article_id, is_favorite, is_read, is_hidden FROM article_status").fetchall()
    return {row["article_id"]: {flag: bool(row[flag]) for flag in FLAGS} for row in rows}
```

On lit **toutes** les lignes en une seule requête, et on les range dans un dictionnaire `{id: {...}}`. Ensuite,
retrouver le statut d'un article est instantané : `statuses.get(article.id)`. C'est bien plus rapide que de faire
une requête SQL par article affiché.

---

## 4. `core/models.py` — transformer un article en JSON et inversement

```python
def to_dict(self) -> dict:
    data = asdict(self)
    data["published"] = self.published.isoformat()
    return data

@classmethod
def from_dict(cls, data: dict) -> Article:
    data = dict(data)
    data["published"] = datetime.fromisoformat(data["published"])
    return cls(**data)
```

- `asdict` convertit l'objet en dictionnaire. Mais JSON ne connaît pas les dates : `isoformat()` les écrit en texte
  standard (`"2026-10-10T08:30:00+00:00"`), et `fromisoformat` fait l'inverse.
- `@classmethod` : une méthode appelée sur la **classe** (`Article.from_dict(...)`) et pas sur un objet. Elle sert
  souvent de « constructeur alternatif ». `cls(**data)` équivaut à
  `Article(title=data["title"], url=data["url"], …)`.
- `data = dict(data)` fait une **copie** : on évite de modifier le dictionnaire reçu (effet de bord surprenant pour
  l'appelant).

---

## 5. Plusieurs pages : `app.py`, `views/` et `ui.py`

### `app.py` devient un aiguilleur

```python
st.set_page_config(page_title="FinVeille", page_icon="📰")
storage.init_db()

pages = [
    st.Page("views/feed.py", title="Fil d'actualité", icon="📰", default=True),
    st.Page("views/favorites.py", title="Favoris", icon="⭐"),
]
st.navigation(pages, position="top").run()
```

`st.navigation` affiche le menu (en haut sur ordinateur, dans le menu `>>` sur mobile) et `.run()` exécute le fichier
de la page choisie. `app.py` ne contient plus que ce qui est **commun** à toutes les pages.

### `ui.py` : ne pas se répéter

La carte d'article apparaît sur deux pages (fil et favoris). Plutôt que de copier-coller le code, on le place dans
une fonction `article_card` dans `ui.py`, importée par les deux pages. C'est le principe **DRY** (*Don't Repeat
Yourself*) : une correction faite à un endroit profite partout.

### Les boutons et leurs callbacks

```python
st.button(
    "Retirer des favoris" if favorite else "Favori",
    icon=":material/star:" if favorite else ":material/star_border:",
    key=f"{key}_fav",
    type="tertiary",
    on_click=_update,
    args=(article, "is_favorite", not favorite, "Ajouté aux favoris ⭐"),
)
```

- `"A" if condition else "B"` est une **expression conditionnelle** : le libellé change selon l'état.
- `on_click=_update, args=(…)` : au clic, Streamlit appelle `_update(article, "is_favorite", True, "…")`, **puis**
  relance le script. La carte se redessine avec la nouvelle valeur lue en base.
- `key=f"{key_prefix}_{article.id}_fav"` : chaque widget doit avoir une clé **unique** sur la page. Le `key_prefix`
  (`"feed"` ou `"fav"`) évite les collisions si un jour une page affiche deux fois le même article.
- `type="tertiary"` : bouton sans bordure, plus discret. Le bouton principal (« Lire ») garde sa bordure.
- `:material/star:` : une icône de la bibliothèque *Material Symbols* de Google
  (<https://fonts.google.com/icons>).

Le bouton « Lire » est un `st.link_button` (il ouvre l'article dans un nouvel onglet) qui appelle aussi `_update`
pour marquer l'article comme lu automatiquement.

`st.toast("…")` affiche une petite notification en bas de l'écran pendant quelques secondes : l'utilisateur sait que
son clic a été pris en compte.

### `st.container(horizontal=True)`

Les quatre boutons sont dans un conteneur **horizontal** : ils se placent côte à côte et **passent à la ligne
automatiquement** si l'écran est trop étroit (téléphone).

---

## 6. 🐞 Un vrai bug trouvé en route

En testant cette étape, des résumés affichaient : `@media (max-width: 768px) { .image-container { width: 100% … } }`.

**Démarche de débogage :**

1. *Reproduire* : le problème venait toujours de la source « Nasdaq ».
2. *Regarder la donnée brute* plutôt que de deviner :
   ```python
   r = requests.get("https://www.nasdaq.com/feed/rssoutbound?category=Markets", timeout=10)
   i = r.text.find("@media"); print(r.text[i - 200 : i + 50])
   ```
   Résultat : le flux contient du code CSS **directement dans le texte** de la description, sans balise `<style>`.
   Notre `clean_html` retire les balises… mais il n'y en a pas !
3. *Corriger au bon endroit* : dans `clean_html` (côté `core/`), pas dans l'affichage. On ajoute une regex qui
   retire les règles `@media … { … }`, et une autre qui retire les blocs `<style>…</style>` / `<script>…</script>`
   avec leur contenu, au cas où d'autres sources en enverraient.
4. *Vérifier* : plus aucun résumé ne contient d'accolade.

On en a profité pour couper les résumés trop longs **à la fin d'un mot** avec `textwrap.shorten` au lieu de
`[:500]`, qui coupait au milieu d'un mot.

**Leçon :** les données du monde réel sont sales. Nettoie-les **dès leur entrée** dans l'application.

---

## 7. Regarder dans la base

Ta base est un fichier : `data/finveille.db`. Pour l'explorer :

- **DB Browser for SQLite** (gratuit) : <https://sqlitebrowser.org> → *Ouvrir une base de données* → onglet
  *Parcourir les données*.
- Ou l'extension VS Code **SQLite Viewer**.
- Ou en Python :
  ```bash
  python -c "import sqlite3; print(sqlite3.connect('data/finveille.db').execute('SELECT * FROM article_status').fetchall())"
  ```

Pour **tout remettre à zéro** : arrête l'appli et supprime `data/finveille.db` (il sera recréé vide).

---

## 8. Exercices

1. Ajoute un compteur dans le titre de la page Favoris : « ⭐ Favoris (3) ».
2. Écris une requête SQL qui compte les articles lus : `SELECT COUNT(*) FROM article_status WHERE is_read = 1`.
   Affiche le résultat dans la barre latérale.
3. Ajoute un bouton « Tout marquer comme lu » sur le fil (indice : une boucle sur `filtered` qui appelle
   `storage.set_flag`).

---

## 9. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| `sqlite3.OperationalError: no such table: article_status` | `init_db()` pas appelé | Vérifie qu'`app.py` appelle `storage.init_db()` **avant** `st.navigation`. |
| `sqlite3.OperationalError: database is locked` | Une connexion n'a pas été fermée, ou la base est ouverte dans DB Browser avec des modifications non enregistrées | Utilise toujours `with connect()`. Ferme DB Browser (ou clique *Écrire les modifications*). |
| `sqlite3.OperationalError: table article_status has no column named …` | Tu as ajouté une colonne dans `SCHEMA`, mais la table existait déjà (`IF NOT EXISTS` ne la modifie pas) | Supprime `data/finveille.db` (perte des données) ou ajoute la colonne : `ALTER TABLE article_status ADD COLUMN …`. |
| Les favoris disparaissent après un redémarrage **en ligne** | L'hébergement gratuit efface les fichiers locaux | Normal sur Streamlit Community Cloud : voir l'étape 9. En local, aucun problème. |
| `StreamlitDuplicateElementKey` | Deux boutons avec la même `key` | Vérifie que la clé contient l'`id` de l'article **et** un préfixe propre à la page. |
| `TypeError: Object of type datetime is not JSON serializable` | `json.dumps` sur un objet contenant une date | Passe par `article.to_dict()`, qui convertit la date en texte. |
| Il faut cliquer deux fois pour que le bouton change | Lecture des statuts **avant** l'écriture | Fais l'écriture dans un callback `on_click` : il s'exécute avant la relance du script. |

➡️ Étape suivante : [sources par API : Finnhub et NewsAPI](04-sources-api.md).
