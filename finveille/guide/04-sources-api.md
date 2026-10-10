# Étape 4 — Sources par API : Finnhub, NewsAPI, Marketaux, Alpha Vantage

> **Objectif :** ajouter quatre fournisseurs d'actualités professionnels, chacun activé seulement si tu as
> renseigné sa clé, et télécharger toutes les sources **en parallèle** pour que l'appli reste rapide.

Fichiers créés : `.streamlit/secrets.toml.example`. Fichiers modifiés : `core/sources.py`, `core/aggregator.py`,
`core/config.py`, `core/models.py`, `ui.py`, `views/feed.py`, `requirements.txt`.

---

## 1. C'est quoi, une API REST ?

Un flux RSS est un fichier unique et figé. Une **API** (*Application Programming Interface*) est un service que ton
programme **interroge** avec des paramètres, et qui répond avec des données structurées, presque toujours en
**JSON**. Exemple avec Finnhub :

```
GET https://finnhub.io/api/v1/news?category=crypto
     └──────── adresse ────────┘└── paramètre ──┘
```

Réponse (simplifiée) :

```json
[
  {"headline": "Bitcoin climbs above…", "url": "https://…", "source": "CoinDesk",
   "datetime": 1791600000, "related": "COIN,MSTR", "summary": "…"}
]
```

En Python, `response.json()` transforme ce texte en **listes** et **dictionnaires** Python. On les convertit
ensuite en `Article`, exactement comme pour le RSS : le reste de l'appli ne voit aucune différence.

Les quatre API, et ce que chacune apporte :

| API | Points forts | Quota gratuit | Pièges |
| --- | --- | --- | --- |
| Finnhub | actualités générales, fusions, forex, crypto ; actus par entreprise | 60 requêtes/minute | En cas d'erreur, renvoie un dictionnaire `{"error": …}` au lieu d'une liste. |
| NewsAPI | 150 000 sources, recherche plein texte | 100 requêtes/jour, **usage en développement uniquement** | Les articles retirés s'appellent `"[Removed]"`. |
| Marketaux | entreprises citées + **sentiment** par entreprise | 100 requêtes/jour, 3 articles par requête | Quota très court en articles. |
| Alpha Vantage | sentiment global de l'article, thèmes | 25 requêtes/jour | Quota dépassé = réponse « 200 OK » avec un simple message ! |

---

## 2. Les clés API et les secrets

Une **clé API** identifie ton compte auprès du service (pour compter ton quota). C'est l'équivalent d'un **mot de
passe** :

- elle ne doit **jamais** être écrite dans le code ;
- elle ne doit **jamais** être publiée sur GitHub (des robots scannent GitHub en permanence pour voler les clés).

Streamlit prévoit un fichier pour ça : `.streamlit/secrets.toml`.

1. Copie `.streamlit/secrets.toml.example` en `.streamlit/secrets.toml`.
2. Colle tes clés entre les guillemets :
   ```toml
   FINNHUB_API_KEY = "d1abc…"
   ```
3. Vérifie que `.streamlit/secrets.toml` est bien listé dans `.gitignore` (c'est le cas) : Git l'ignorera.

Dans le code, `ui.get_secret` lit la clé :

```python
def get_secret(name: str) -> str | None:
    try:
        value = st.secrets.get(name)
    except FileNotFoundError:  # pas de fichier secrets.toml : ce n'est pas une erreur
        value = None
    return value or os.environ.get(name) or None
```

- Si le fichier n'existe pas, Streamlit lève une erreur qui *hérite* de `FileNotFoundError` : on l'intercepte, car
  ne pas avoir de clé est un cas **normal** (les API sont optionnelles).
- `os.environ.get(name)` : à défaut, on regarde les **variables d'environnement** (pratique sur un serveur).
- `a or b or None` renvoie la première valeur « vraie » : une chaîne vide `""` compte comme absente.

Les fonctions de `core/` ne lisent **jamais** les secrets elles-mêmes : elles reçoivent la clé en paramètre.
`core/` reste ainsi indépendant de Streamlit et facile à tester.

### Ne jamais afficher une clé par accident

Piège réel : quand une requête échoue, le message d'erreur de `requests` contient **l'URL complète**… y compris
`?apikey=TA_CLE_SECRETE`. Si on l'affichait à l'écran, la clé serait visible de tous. Deux protections :

1. Quand l'API le permet, la clé passe dans un **en-tête HTTP** (invisible dans l'URL) :
   ```python
   headers={"X-Finnhub-Token": api_key}
   ```
2. `describe_error` traduit chaque erreur en message lisible **sans jamais reprendre l'URL** :
   ```python
   if isinstance(exc, requests.HTTPError) and exc.response is not None:
       return {401: "clé API refusée (401)", 403: "accès interdit (403)", 429: "quota dépassé (429)"}.get(
           exc.response.status_code, f"erreur HTTP {exc.response.status_code}"
       )
   ```
   `{…}.get(code, défaut)` : on cherche le code dans un dictionnaire de messages connus, sinon message générique.

Les **codes HTTP** à connaître : `200` OK · `401` non authentifié (clé absente ou fausse) · `403` interdit · `404`
introuvable · `429` trop de requêtes (quota) · `5xx` panne du serveur.

---

## 3. `core/sources.py` — un connecteur par API

Tous suivent le même schéma : **appeler → vérifier → convertir**.

```python
def fetch_finnhub_news(api_key: str, category: str = "general") -> list[Article]:
    items = _get_json(
        "https://finnhub.io/api/v1/news",
        params={"category": category},
        headers={"X-Finnhub-Token": api_key},
    )
    if isinstance(items, dict):  # en cas d'erreur, Finnhub renvoie {"error": "..."}
        raise SourceError(items.get("error", "réponse inattendue"))
    return [_finnhub_article(item, FINNHUB_CATEGORIES.get(category, "marches")) for item in items if item.get("url")]
```

- `_get_json` regroupe ce qui est commun à tous les appels (en-tête d'identification, `timeout`,
  `raise_for_status()`, `.json()`). `params={…}` laisse `requests` construire `?category=crypto` correctement
  (avec l'encodage des caractères spéciaux).
- `SourceError` est **notre propre type d'exception**. Une API peut répondre « 200 OK » tout en signalant une erreur
  dans son JSON. On transforme ce cas en exception, que l'agrégateur sait gérer.
- La dernière ligne est une **compréhension de liste** avec filtre : « pour chaque `item` qui a une URL, construis
  un `Article` ».

### Trois façons d'écrire une date

Chaque API a son format, et on convertit tout en `datetime` UTC :

| API | Format reçu | Conversion |
| --- | --- | --- |
| Finnhub | `1791600000` (secondes depuis le 1ᵉʳ janvier 1970, dit « timestamp Unix ») | `datetime.fromtimestamp(x, tz=timezone.utc)` |
| NewsAPI, Marketaux | `"2026-10-09T14:00:00Z"` (norme ISO 8601, `Z` = UTC) | `datetime.fromisoformat(x)` (Python ≥ 3.11) |
| Alpha Vantage | `"20261009T231231"` (format maison, sans fuseau) | `datetime.strptime(x, "%Y%m%dT%H%M%S")` puis on précise le fuseau |

Pour Alpha Vantage, la date n'indique pas son fuseau horaire. On fait l'hypothèse (écrite en commentaire dans le code)
qu'il s'agit de l'heure de New York, comme pour les autres données du service :

```python
published = datetime.strptime(item["time_published"], "%Y%m%dT%H%M%S").replace(tzinfo=ZoneInfo("America/New_York"))
published.astimezone(timezone.utc)   # converti en UTC
```

`zoneinfo` (module standard) connaît tous les fuseaux, **changements d'heure été/hiver compris**. Sous Windows, il a
besoin du paquet `tzdata`, d'où son ajout dans `requirements.txt`.

### Le sentiment

Marketaux et Alpha Vantage fournissent un **score de sentiment** entre -1 (très négatif) et +1 (très positif). On
l'ajoute à `Article` :

```python
sentiment: float | None = None
```

`None` signifie « inconnu » (les flux RSS n'en donnent pas). Ce n'est **pas** la même chose que `0` (neutre). On s'en
servira dans les tableaux de bord de l'étape 6.

Pour Marketaux, le sentiment est donné **par entreprise citée** ; on calcule la moyenne :
```python
scores = [e["sentiment_score"] for e in entities if e.get("sentiment_score") is not None]
sentiment = sum(scores) / len(scores) if scores else None
```
Le `if scores else None` évite une division par zéro quand aucune entreprise n'a de score.

---

## 4. `core/aggregator.py` — tout télécharger en parallèle

Avec 12 flux RSS et jusqu'à 7 appels d'API, les télécharger **l'un après l'autre** prend 8 à 10 secondes : chaque
requête passe son temps à **attendre** la réponse du serveur. Pendant ce temps, l'ordinateur ne fait rien.

### Les tâches

```python
Task = tuple[str, Callable[..., list[Article]], tuple]

def build_tasks(keys):
    tasks = [(feed["name"], fetch_rss, (feed,)) for feed in RSS_FEEDS]
    if key := keys.get("FINNHUB_API_KEY"):
        tasks += [(f"Finnhub · {category}", fetch_finnhub_news, (key, category)) for category in FINNHUB_CATEGORIES]
    ...
    return tasks
```

- Une **tâche** décrit un appel à faire, sans le faire : un nom, une **fonction** (oui, en Python une fonction est une
  valeur comme une autre, qu'on peut ranger dans une liste) et ses arguments.
- `if key := keys.get(...)` : l'opérateur `:=` (dit « morse ») affecte **et** teste en même temps. Équivaut à
  `key = keys.get(...)` puis `if key:`.
- `(feed,)` : un tuple d'un seul élément s'écrit avec une virgule finale.

### Le parallélisme

```python
with ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(_run, tasks))
```

Un `ThreadPoolExecutor` est une équipe de 8 « ouvriers » (*threads*). `pool.map(_run, tasks)` distribue les tâches :
chacun en prend une, et dès qu'il a fini, il prend la suivante. Les attentes réseau se chevauchent : on passe de
~8 secondes à **moins de 2**.

C'est efficace parce que nos tâches **attendent** (le réseau) au lieu de **calculer**. Pour des calculs lourds, les
threads Python n'aideraient pas.

`_run` exécute une tâche et **ne laisse jamais passer d'erreur** : il renvoie `(articles, None)` si tout va bien, ou
`([], "Finnhub · crypto : quota dépassé (429)")` sinon. Une source en panne n'arrête pas les autres.

```python
articles = [article for found, _ in results for article in found]
```

Cette compréhension « aplatit » une liste de listes en une seule liste. `_` est le nom conventionnel d'une valeur
qu'on n'utilise pas.

---

## 5. Les quotas : faire le calcul

Le cache de `load_articles` passe de 10 à **15 minutes** (`ttl=900`). Pourquoi ? NewsAPI autorise 100 requêtes par
jour. Si l'appli restait ouverte et rafraîchie en continu :

- toutes les 10 min : 24 × 6 = **144** requêtes/jour → quota dépassé ;
- toutes les 15 min : 24 × 4 = **96** requêtes/jour → ça passe.

Alpha Vantage (25/jour) sera épuisé dans la journée en cas d'usage intensif : l'appli continue de fonctionner sans
lui, et le message « quota » apparaît dans la liste des sources indisponibles.

**À savoir :** l'offre gratuite de NewsAPI est réservée au **développement** (sur ton ordinateur). Pour une appli
publique, garde les autres sources ou passe à une offre payante.

---

## 6. Dans l'interface

La barre latérale du fil affiche l'état de chaque API, avec un lien d'inscription pour celles qui sont inactives :

```python
for name, (label, signup_url) in API_KEYS.items():
    if keys[name]:
        st.caption(f":green-badge[active] {label}")
    else:
        st.caption(f":gray-badge[inactive] {label} · [obtenir une clé gratuite]({signup_url})")
```

`for name, (label, signup_url) in API_KEYS.items()` : chaque valeur de `API_KEYS` est un tuple de deux éléments, qu'on
« déballe » directement dans la boucle.

---

## 7. Tester une API à la main

Avant d'écrire du code, **regarde toujours la réponse brute** :

1. Dans le navigateur : colle l'URL avec ta clé, par exemple
   `https://finnhub.io/api/v1/news?category=crypto&token=TA_CLE`. Firefox affiche joliment le JSON.
2. Dans un terminal Python (venv activé, dossier `finveille/`) :
   ```python
   >>> from core.sources import fetch_finnhub_news
   >>> articles = fetch_finnhub_news("TA_CLE", "crypto")
   >>> len(articles), articles[0].title
   ```

Alpha Vantage propose une clé de démonstration : <https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=AAPL&apikey=demo>.

---

## 8. Exercices

1. Ajoute une deuxième requête NewsAPI pour l'actualité économique **française** (`country="fr"`,
   `category="business"`). Le quota le permet-il ? Fais le calcul.
2. Affiche le sentiment d'un article dans sa carte quand il est connu (par exemple `▲ 0,35` en vert,
   `▼ -0,20` en rouge).
3. Mesure le gain du parallélisme : remplace `max_workers=8` par `max_workers=1` et chronomètre avec
   `time.perf_counter()`.

---

## 9. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| L'API reste « inactive » alors que la clé est dans `secrets.toml` | Fichier mal placé ou mal nommé | Le fichier doit être `finveille/.streamlit/secrets.toml` (avec le point, sans `.example`). Redémarre Streamlit. |
| `toml.decoder.TomlDecodeError` / `StreamlitSecretNotFoundError: Error parsing secrets file` | Erreur de syntaxe TOML | Les valeurs texte doivent être entre guillemets droits `"…"`, une clé par ligne. |
| `… : clé API refusée (401)` | Clé fausse, incomplète ou pas encore activée | Recopie-la (sans espace) ; certaines clés ne marchent que quelques minutes après l'inscription. |
| `… : quota dépassé (429)` ou message « rate limit » | Trop de requêtes | Attends (quota par minute ou par jour) ; augmente le `ttl` du cache. |
| `Alpha Vantage : Thank you for using Alpha Vantage!…` | Quota du jour atteint ou clé invalide | Normal avec 25 requêtes/jour : l'appli continue sans cette source. |
| `ZoneInfoNotFoundError: 'No time zone found with key America/New_York'` | Windows sans base de fuseaux | `pip install tzdata` (déjà dans `requirements.txt`). |
| `JSONDecodeError` (affiché comme erreur de la source) | L'API a renvoyé du HTML (page d'erreur, maintenance) | Ouvre l'URL dans le navigateur pour voir ce qu'elle renvoie vraiment. |
| Ta clé apparaît dans un message d'erreur | Message construit avec `str(exc)` d'une erreur `requests` | Utilise `describe_error(exc)`, qui n'affiche jamais l'URL. Si une clé a fuité, **régénère-la** sur le site du fournisseur. |
| J'ai publié ma clé sur GitHub par erreur | `secrets.toml` ajouté avant le `.gitignore` | Régénère immédiatement la clé (la supprimer de l'historique Git ne suffit pas), puis `git rm --cached .streamlit/secrets.toml`. |

➡️ Étape suivante : [une identité visuelle originale](05-identite-visuelle.md).
