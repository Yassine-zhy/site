# Étape 1 — Version minimale : un fil d'actualité RSS

> **Objectif :** une page web qui affiche les derniers articles de 12 sources financières, du plus récent au plus
> ancien. C'est notre **MVP** (*Minimum Viable Product*) : la plus petite version utile, sur laquelle on construira
> tout le reste.

Fichiers créés : `requirements.txt`, `core/config.py`, `core/models.py`, `core/sources.py`, `core/aggregator.py`,
`app.py`.

---

## 1. C'est quoi, un flux RSS ?

Un flux RSS est une page web écrite pour les **machines** et pas pour les humains : un fichier XML qui liste les
derniers articles d'un site. Ouvre <https://feeds.bbci.co.uk/news/business/rss.xml> dans ton navigateur : tu verras
quelque chose comme

```xml
<item>
  <title>Trump announces deal for Russian diesel</title>
  <description>The agreement comes as…</description>
  <link>https://www.bbc.co.uk/news/articles/…</link>
  <pubDate>Sat, 10 Oct 2026 00:45:51 GMT</pubDate>
</item>
```

Chaque `<item>` est un article. Notre travail : télécharger ce fichier, le lire, et en extraire titre, lien, date et
résumé. C'est gratuit, sans inscription et sans quota : idéal pour démarrer.

---

## 2. `requirements.txt` — la liste des courses

```text
streamlit>=1.65,<2   # l'interface web
requests>=2.32       # télécharger des pages et interroger des API
feedparser>=6.0      # lire les flux RSS
```

`>=1.65,<2` veut dire « au moins la version 1.65, mais pas la 2.0 » : on profite des corrections sans risquer une
version majeure qui changerait tout. Installe avec `pip install -r requirements.txt` (venv activé !).

---

## 3. `core/config.py` — les réglages au même endroit

```python
CATEGORIES = {
    "marches": "📈 Marchés",
    ...
}

RSS_FEEDS = [
    {"name": "CNBC Marchés", "url": _CNBC + "10000664", "category": "marches"},
    {"name": "BFM Bourse", "url": "https://www.tradingsat.com/rssbourse.xml", "category": "marches"},
    ...
]
```

- `CATEGORIES` est un **dictionnaire** (`clé: valeur`). La clé (`"marches"`, sans accent ni espace) sert dans le
  code ; la valeur est ce que voit l'utilisateur. Séparer les deux évite de casser le code le jour où tu changes un
  libellé.
- `RSS_FEEDS` est une **liste de dictionnaires** : un dictionnaire par flux. Pour ajouter une source, il suffit
  d'ajouter une ligne, sans toucher au reste du code. C'est le principe de *configuration* : les données qui
  changent souvent sont isolées du code qui, lui, change rarement.
- `REQUEST_TIMEOUT = 10` : on n'attendra jamais un site plus de 10 secondes.
- `USER_AGENT` : la « carte d'identité » que notre programme présente aux sites. Certains refusent les visiteurs
  sans identité.

---

## 4. `core/models.py` — la forme d'un article

```python
@dataclass
class Article:
    title: str
    url: str
    source: str
    published: datetime  # toujours en heure UTC
    summary: str = ""
    category: str = "marches"
    image: str | None = None
    tickers: list[str] = field(default_factory=list)

    @property
    def id(self) -> str:
        return hashlib.sha1(self.url.encode("utf-8")).hexdigest()[:16]
```

**Pourquoi une classe ?** CNBC, Finnhub et NewsAPI décrivent un article chacun à leur façon (`headline`, `title`,
`pubDate`, `datetime`…). On convertit tout en `Article` dès la réception : le reste de l'application ne connaît
**qu'un seul format**. C'est le même réflexe qu'en finance quand on harmonise des données de plusieurs fournisseurs
avant de les analyser.

- `@dataclass` génère automatiquement le constructeur : `Article(title="…", url="…", …)` fonctionne sans écrire de
  `__init__`.
- `: str`, `: datetime` sont des **annotations de type** : elles documentent ce qu'on attend et permettent à VS Code
  de te prévenir des erreurs. Python ne les vérifie pas à l'exécution.
- `= ""` donne une valeur par défaut. Pour une liste, on écrit `field(default_factory=list)` : sinon **tous** les
  articles partageraient la même liste (piège classique de Python).
- `@property` transforme la méthode `id` en attribut calculé : on écrit `article.id`, sans parenthèses.
- **L'identifiant** est une *empreinte* (hash SHA-1) de l'URL : la même URL donne toujours le même identifiant de
  16 caractères. Il nous servira à l'étape 3 pour retenir les favoris.
- `published` est **toujours en UTC** : les sources publient dans tous les fuseaux horaires ; on harmonise pour
  pouvoir comparer et trier les dates.

---

## 5. `core/sources.py` — télécharger et lire un flux

### Le cœur : `fetch_rss`

```python
def fetch_rss(feed: dict) -> list[Article]:
    response = requests.get(feed["url"], headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    parsed = feedparser.parse(response.content)

    articles = []
    for entry in parsed.entries:
        title = clean_html(entry.get("title"))
        url = entry.get("link", "")
        if not title or not url:
            continue
        articles.append(Article(title=title, url=url, source=feed["name"], ...))

    articles.sort(key=lambda article: article.published, reverse=True)
    return articles[:MAX_ARTICLES_PER_FEED]
```

Ligne par ligne :

1. `requests.get(...)` télécharge le flux. Le `timeout` est **indispensable** : sans lui, un site qui ne répond pas
   bloquerait ton appli indéfiniment.
2. `raise_for_status()` transforme une réponse d'erreur (403 interdit, 404 introuvable, 500 panne) en **exception**
   Python. Sans cette ligne, on essaierait de lire une page d'erreur comme si c'était un flux.
3. `feedparser.parse(...)` lit le XML et nous donne `parsed.entries`, une liste d'entrées.
   *Pourquoi ne pas donner directement l'URL à feedparser ?* Parce qu'il ne gère pas de `timeout` : on télécharge
   avec `requests` (qui le gère), puis on donne le contenu à feedparser.
4. `entry.get("title")` plutôt que `entry["title"]` : `.get` renvoie `None` au lieu de planter si le champ manque.
   Les flux RSS sont souvent incomplets ; on est **défensif**.
5. `continue` saute une entrée sans titre ou sans lien et passe à la suivante.
6. On trie (le plus récent d'abord) **avant** de couper aux 25 premiers : certains flux, comme The Economist,
   publient 300 entrées dans le désordre.

`lambda article: article.published` est une mini-fonction anonyme : « pour trier, regarde la date de chaque
article ». `reverse=True` met les plus récents en premier.

### Nettoyer le HTML : `clean_html`

Les résumés RSS contiennent souvent du HTML (`<p>`, `<a href…>`, `&amp;`). On utilise des **expressions
régulières** (*regex*), des motifs de recherche dans du texte :

```python
_TAG_RE = re.compile(r"<[^>]+>")   # « < », puis tout sauf « > », puis « > » : une balise
_SPACES_RE = re.compile(r"\s+")    # un ou plusieurs espaces/retours à la ligne

text = _TAG_RE.sub(" ", text or "")   # remplace chaque balise par un espace
text = html.unescape(text)            # &amp; → &, &eacute; → é
return _SPACES_RE.sub(" ", text).strip()   # espaces multiples → un seul
```

`text or ""` : si `text` vaut `None`, on prend `""` (une chaîne vide), ce qui évite un plantage.

### Les dates : `_entry_date`

feedparser convertit les dates du flux en un tuple `(année, mois, jour, heure, minute, seconde, …)` déjà en UTC.
`datetime(*parsed[:6], tzinfo=timezone.utc)` prend les 6 premiers éléments (l'étoile les « déballe » comme arguments)
et construit une vraie date. Si le flux n'a pas de date, on prend « maintenant ».

---

## 6. `core/aggregator.py` — rassembler toutes les sources

```python
def collect_articles(feeds=RSS_FEEDS):
    articles, errors = [], []
    for feed in feeds:
        try:
            articles.extend(fetch_rss(feed))
        except requests.RequestException as exc:
            errors.append(f"{feed['name']} : {exc}")

    articles = deduplicate(articles)
    articles.sort(key=lambda article: article.published, reverse=True)
    return articles, errors
```

- **`try / except`** : si un site est en panne, on note l'erreur et on **continue** avec les autres. Une seule source
  défaillante ne doit jamais faire tomber l'application.
- On attrape **précisément** `requests.RequestException` (erreurs réseau et HTTP), pas toutes les erreurs : une faute
  de frappe dans *notre* code doit, elle, s'afficher clairement pour qu'on la corrige.
- La fonction renvoie **deux** valeurs (un *tuple*) : les articles et la liste des erreurs, que l'interface pourra
  afficher.

`deduplicate` utilise des **ensembles** (`set`) : vérifier si un élément est dans un `set` est instantané, même avec
des milliers d'éléments (dans une liste, Python devrait tout parcourir). Un article est un doublon si on a déjà vu
la même URL **ou** le même titre (le même communiqué repris par deux flux).

---

## 7. `app.py` — l'interface

### Le modèle d'exécution de Streamlit (à bien comprendre !)

Streamlit exécute `app.py` **de haut en bas**, et affiche chaque élément au moment où la ligne est exécutée. **À
chaque interaction** (clic, saisie…), il **relance tout le script** depuis le début. Il n'y a pas de « boucle
d'événements » à gérer : c'est ce qui rend Streamlit si simple.

Conséquence : sans précaution, on retéléchargerait les 12 flux **à chaque clic**. D'où le cache.

### Le cache

```python
@st.cache_data(ttl=600, show_spinner="Récupération des actualités…")
def load_articles():
    return collect_articles()
```

`@st.cache_data` est un **décorateur** : il « enveloppe » la fonction. Au premier appel, elle s'exécute normalement
et Streamlit garde le résultat. Aux appels suivants, il renvoie directement le résultat gardé, sans rien
retélécharger, jusqu'à ce que 600 secondes (`ttl`, *time to live*) soient écoulées.

Le bouton « Actualiser » vide ce cache :

```python
if st.button("🔄 Actualiser"):
    load_articles.clear()
```

`st.button` renvoie `True` **uniquement** pendant l'exécution qui suit le clic. On vide le cache, puis la ligne
suivante (`load_articles()`) retélécharge tout.

### L'affichage

```python
for article in articles[:50]:
    with st.container(border=True):
        st.markdown(f"#### [{md_escape(article.title)}]({article.url})")
        st.caption(f"{article.source} · {time_ago(article.published)}")
        if article.summary:
            st.write(md_escape(article.summary))
```

- `articles[:50]` : on n'affiche que les 50 premiers (l'affichage de centaines de cartes ralentirait la page).
- `with st.container(border=True):` : tout ce qui est écrit dans le bloc `with` va dans une carte encadrée.
- `f"…{variable}…"` est une **f-string** : Python remplace `{…}` par la valeur.
- `#### [texte](lien)` est du **Markdown** : un titre de niveau 4 cliquable.
- **`md_escape`** : en Markdown, `$` démarre une formule mathématique, `*` met en gras… Un titre comme « Oil over $100
  and a $7 billion offer » deviendrait une formule illisible. On place un `\` devant chaque caractère spécial pour
  qu'il s'affiche tel quel.

`time_ago` calcule l'écart entre maintenant et la publication (`total_seconds() // 60` donne des minutes entières)
et choisit l'unité la plus parlante.

---

## 8. Lance-la !

```bash
streamlit run app.py
```

Tu dois voir environ 250 articles. Si une source est en panne, un encadré « ⚠️ source(s) indisponible(s) » le signale
sans bloquer le reste.

---

## 9. Exercices (pour vérifier que tu as compris)

1. **Ajoute une source :** trouve le flux RSS d'un média que tu lis (cherche « nom du média RSS ») et ajoute-le dans
   `RSS_FEEDS`.
2. **Casse volontairement** une URL de `RSS_FEEDS` (ajoute `xxx` au milieu). Que se passe-t-il ? Pourquoi
   l'appli ne plante-t-elle pas ?
3. Remplace `ttl=600` par `ttl=10` et observe le spinner revenir quand tu cliques ailleurs après 10 secondes.
4. Retire `md_escape` du titre et cherche un article qui contient un `$`. Que vois-tu ?

---

## 10. Erreurs fréquentes

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| `ModuleNotFoundError: No module named 'core'` | Tu as lancé Streamlit depuis un autre dossier | Lance `streamlit run app.py` **depuis le dossier `finveille/`** (`cd finveille`). |
| `ModuleNotFoundError: No module named 'feedparser'` | Bibliothèques non installées dans le venv actif | Active le venv, puis `pip install -r requirements.txt`. |
| Toutes les sources « indisponibles » | Pas d'Internet, proxy d'entreprise/école, pare-feu | Teste une URL de flux dans ton navigateur. Sur un réseau d'école, essaie le partage de connexion de ton téléphone. |
| Une source répond `403 Forbidden` | Le site bloque les robots | Retire ce flux ou cherche une autre adresse RSS du même média. |
| Les modifications du code ne s'affichent pas | Streamlit ne recharge pas tout seul | Clique sur **Rerun** en haut à droite, ou active *Always rerun*. |
| Les articles ne se mettent pas à jour | Le cache garde les données 10 minutes | Clique sur « 🔄 Actualiser ». |
| `AttributeError: 'NoneType' object has no attribute …` | Un champ manque dans une entrée RSS | Utilise `.get("champ")` et prévois une valeur par défaut (`or ""`). |

**Méthode de débogage universelle :** lis le message d'erreur **en partant du bas** (la dernière ligne dit *quoi*,
les lignes du dessus disent *où*). Ajoute un `st.write(variable)` (ou `print(variable)`, visible dans le terminal)
juste avant la ligne qui plante pour voir ce que contient réellement la variable.

➡️ Étape suivante : [catégories, sources et recherche](02-filtres-et-recherche.md).
