# Étape 0 — Architecture, stack et prérequis

> **Objectif de l'étape :** comprendre *ce qu'on va construire*, *avec quels outils* et *pourquoi*, puis installer
> tout ce qu'il faut sur ton ordinateur. On n'écrit pas encore de code applicatif.

---

## 1. Le projet en une phrase

**FinVeille** est une application web qui rassemble l'actualité financière et économique mondiale (marchés, crypto,
entreprises, macroéconomie) venant de nombreuses sources. Tu peux la filtrer, la rechercher, garder tes articles
favoris, suivre des entreprises (avec leur cours de Bourse) et obtenir un résumé automatique de chaque article.

---

## 2. La stack recommandée (et pourquoi)

Une *stack*, c'est l'ensemble des outils techniques d'un projet. Pour un débutant, le critère n° 1 est :
**un seul langage, le moins de pièces mobiles possible**.

| Besoin | Outil choisi | Pourquoi ce choix | Alternatives écartées |
| --- | --- | --- | --- |
| Langage | **Python 3.11+** | Le langage de la data et de la finance quantitative (pandas, numpy…). Tu le réutiliseras en stage. | JavaScript : il faudrait apprendre HTML + CSS + JS + un framework. |
| Interface web | **Streamlit** | Transforme un script Python en site web. Pas de HTML/CSS/JS à écrire. Responsive et thème clair/sombre **intégrés**. Hébergement gratuit. | Flask/Django (il faut écrire tout le HTML), React + FastAPI (deux langages), Dash (plus verbeux). |
| Actualités sans clé | **Flux RSS** (`feedparser`) | Gratuits, sans inscription, sans quota. Presque tous les médias en publient. | Scraper les sites : fragile et souvent interdit. |
| Actualités avec clé | **Finnhub**, **NewsAPI**, **Marketaux**, **Alpha Vantage** | Clés gratuites. Finnhub : 60 requêtes/min, actus par entreprise. NewsAPI : recherche plein texte. Marketaux et Alpha Vantage : entreprises citées et **score de sentiment**. Chacune est optionnelle. | Scraping de sites d'information : fragile et souvent interdit par leurs conditions d'utilisation. |
| Cours de Bourse | **yfinance** | Gratuit, sans clé, couvre les Bourses du monde entier (Paris : `MC.PA`, `AIR.PA`…). | Alpha Vantage (25 requêtes/jour), Finnhub (cotations US surtout en gratuit). |
| Stockage | **SQLite** | Inclus dans Python, une base de données dans **un seul fichier**, du vrai SQL (compétence très demandée). | Fichier JSON (fragile, pas de requêtes), PostgreSQL (serveur à installer). |
| Résumé IA | **Résumé local** + **Gemini** ou **Groq** (offres gratuites) | Le résumé local marche toujours, sans clé ni Internet. Si tu ajoutes une clé gratuite, un vrai modèle de langage résume en français. | API payantes. |
| Extraction d'article | **trafilatura** | Récupère le texte principal d'une page web (sans menus ni pubs). | BeautifulSoup à la main : beaucoup de code. |
| Tests | **pytest** | Le standard Python, syntaxe minimale. | `unittest` : plus verbeux. |

### Les limites de Streamlit (pour être honnête)

- **Chaque clic relance tout le script** de haut en bas. C'est déroutant au début, mais c'est aussi ce qui le rend
  simple. On verra deux outils pour vivre avec : le **cache** (`st.cache_data`) et la **mémoire de session**
  (`st.session_state`).
- La personnalisation visuelle est limitée (on ne contrôle pas chaque pixel).
- Ce n'est pas fait pour des milliers d'utilisateurs simultanés. Pour un projet personnel et un portfolio : parfait.

---

## 3. L'architecture

### Le principe clé : séparer la *logique* de l'*affichage*

```
┌───────────────────────── Navigateur (ordinateur ou téléphone) ─────────────────────────┐
│                                                                                         │
│   INTERFACE (Streamlit)        app.py  ·  views/*.py  ·  ui.py                          │
│   « Comment on montre les choses »                                                      │
└───────────────┬─────────────────────────────────────────────────────────┬───────────────┘
                │ appelle des fonctions                                   │
┌───────────────▼──────────────── LOGIQUE MÉTIER : core/ ─────────────────▼───────────────┐
│   « Ce que fait l'application »  (aucune ligne de Streamlit ici)                        │
│                                                                                         │
│   sources.py ──► aggregator.py ──► classifier.py / filters.py                           │
│   market.py        summarizer.py        storage.py                                      │
└──────┬──────────────────┬───────────────────┬─────────────────────┬─────────────────────┘
       ▼                  ▼                   ▼                     ▼
  Flux RSS, Finnhub,   Yahoo Finance      Gemini / Groq        data/finveille.db
  NewsAPI              (yfinance)         (résumés IA)         (SQLite : favoris, suivis…)
```

**Pourquoi séparer ?**

1. **Lisibilité :** chaque fichier a *une* responsabilité. Quand le cours d'une action est faux, tu sais qu'il faut
   regarder `market.py`, pas fouiller 800 lignes.
2. **Testabilité :** les fonctions de `core/` prennent des données et renvoient des données. On peut les tester
   automatiquement sans lancer de site web.
3. **Évolutivité :** si un jour tu remplaces Streamlit par autre chose (une API, une appli mobile), tout `core/` est
   réutilisable tel quel.

### L'arborescence finale du projet

```
finveille/
├── app.py                  ← point d'entrée : configuration de la page + menu de navigation
├── ui.py                   ← éléments d'interface réutilisés (carte d'article, chargement en cache…)
├── theme.py                ← l'identité visuelle : feuille de style, en-tête, bandeau des cours
├── views/                  ← une page = un fichier
│   ├── feed.py             ←   Fil d'actualité (filtres, recherche)
│   ├── markets.py          ←   Tableaux de bord : marchés mondiaux et actualité en chiffres
│   ├── following.py        ←   Mes suivis (entreprises, thèmes, fiches entreprises)
│   ├── favorites.py        ←   Favoris
│   └── settings.py         ←   Réglages (préférences, thème, export)
├── core/                   ← logique métier, sans Streamlit
│   ├── config.py           ←   paramètres : flux RSS, catégories, mots-clés
│   ├── models.py           ←   la « forme » d'un article (classe Article)
│   ├── sources.py          ←   récupérer les articles (RSS, Finnhub, NewsAPI, Yahoo)
│   ├── aggregator.py       ←   rassembler toutes les sources, dédoublonner, trier
│   ├── classifier.py       ←   ranger un article dans une catégorie
│   ├── filters.py          ←   filtrer par catégorie / source / mot-clé
│   ├── storage.py          ←   base SQLite : favoris, lus, masqués, suivis, préférences
│   ├── market.py           ←   cours de Bourse et indicateurs (yfinance)
│   ├── analytics.py        ←   statistiques sur le flux d'actualité (pour les tableaux de bord)
│   └── summarizer.py       ←   résumé automatique (local ou IA)
├── tests/                  ← tests automatiques (pytest)
├── .streamlit/
│   ├── config.toml         ← thème clair / sombre
│   └── secrets.toml        ← TES clés API (jamais publié sur GitHub !)
├── data/finveille.db       ← la base de données (créée automatiquement)
├── requirements.txt        ← la liste des bibliothèques à installer
└── guide/                  ← ce guide
```

### Ce qui se passe quand tu ouvres la page

1. Streamlit exécute `app.py`, qui affiche le menu et lance la page choisie (ex. `views/feed.py`).
2. La page demande les articles à `ui.load_articles()`. Si on les a déjà récupérés il y a moins de 10 minutes, ils
   sortent du **cache** (instantané). Sinon, `core/aggregator.py` interroge chaque source via `core/sources.py`.
3. Chaque article est transformé dans un format **commun** (`Article`), classé dans une catégorie, puis les doublons
   sont supprimés.
4. La page lit dans SQLite quels articles tu as mis en favori, lus ou masqués, applique tes filtres et affiche les
   cartes.
5. Quand tu cliques sur « ⭐ Favori », Streamlit enregistre l'info dans SQLite puis **relance le script** : la page
   se redessine avec l'étoile allumée.

---

## 4. Les prérequis, étape par étape

### 4.1 Installer Python (3.11 ou plus récent)

- **Windows :** télécharge l'installeur sur <https://www.python.org/downloads/>. ⚠️ Sur le premier écran, **coche
  « Add python.exe to PATH »** avant de cliquer sur *Install Now*.
- **macOS :** installeur de <https://www.python.org/downloads/> (ou `brew install python` si tu utilises Homebrew).
- **Linux :** souvent déjà installé (`sudo apt install python3 python3-venv` sur Ubuntu/Debian).

Vérifie dans un terminal (Windows : *PowerShell* ; macOS : *Terminal*) :

```bash
python --version      # Windows
python3 --version     # macOS / Linux
```

Tu dois voir `Python 3.11.x` ou plus. *Dans la suite du guide, j'écris `python` ; sur macOS/Linux, tape `python3`.*

### 4.2 Installer un éditeur de code : VS Code

<https://code.visualstudio.com/>, puis dans l'onglet *Extensions* installe **Python** (de Microsoft). Tu auras la
coloration, l'autocomplétion et la détection d'erreurs.

### 4.3 Installer Git et créer un compte GitHub

- Git : <https://git-scm.com/downloads> (sur macOS, `git --version` propose de l'installer).
- Compte GitHub : <https://github.com>. Il servira à sauvegarder ton code, à le montrer (portfolio) et à déployer
  l'appli gratuitement.

### 4.4 Récupérer le projet et créer un environnement virtuel

Un **environnement virtuel** (*venv*) est un dossier qui contient les bibliothèques **de ce projet uniquement**. Sans
lui, tous tes projets partagent les mêmes versions de bibliothèques et finissent par se casser mutuellement.

```bash
cd chemin/vers/finveille          # va dans le dossier du projet
python -m venv .venv              # crée l'environnement dans le dossier .venv
```

Puis **active-le** (à refaire à chaque nouveau terminal) :

| Système | Commande |
| --- | --- |
| Windows (PowerShell) | `.venv\Scripts\Activate.ps1` |
| Windows (cmd) | `.venv\Scripts\activate.bat` |
| macOS / Linux | `source .venv/bin/activate` |

Ton invite de commande affiche alors `(.venv)` au début. 👍

### 4.5 Installer les bibliothèques

```bash
pip install -r requirements.txt
```

`requirements.txt` liste les bibliothèques du projet. On l'enrichira au fil des étapes ; relance cette commande à
chaque fois qu'il change.

### 4.6 Lancer l'application

```bash
streamlit run app.py
```

Ton navigateur s'ouvre sur <http://localhost:8501>. Pour arrêter : `Ctrl + C` dans le terminal.

### 4.7 Les clés API (plus tard, aux étapes 4 et 8)

Toutes gratuites, sans carte bancaire. Tu n'en as **pas besoin** pour démarrer :

| Service | À quoi il sert | Où s'inscrire |
| --- | --- | --- |
| Finnhub | actualités générales et par entreprise | <https://finnhub.io/register> |
| NewsAPI | recherche d'articles par mot-clé | <https://newsapi.org/register> |
| Marketaux | actualités avec entreprises citées et sentiment | <https://www.marketaux.com/register> |
| Alpha Vantage | actualités avec score de sentiment | <https://www.alphavantage.co/support/#api-key> |
| Google Gemini | résumé IA | <https://aistudio.google.com/apikey> |
| Groq | résumé IA (alternative) | <https://console.groq.com/keys> |

---

## 5. Erreurs fréquentes à cette étape

| Symptôme | Cause | Solution |
| --- | --- | --- |
| `'python' n'est pas reconnu…` (Windows) | Python n'est pas dans le PATH | Réinstalle Python en cochant *Add python.exe to PATH*, ou utilise `py` à la place de `python`. |
| `…Activate.ps1 cannot be loaded because running scripts is disabled` | Sécurité de PowerShell | Lance une fois `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, puis réessaie. |
| `pip: command not found` | Le venv n'est pas activé | Active le venv (4.4), ou utilise `python -m pip install …`. |
| `streamlit: command not found` | Idem | Active le venv, ou lance `python -m streamlit run app.py`. |
| `ModuleNotFoundError: No module named 'feedparser'` | Bibliothèque non installée **dans ce venv** | Vérifie le `(.venv)` dans l'invite, puis `pip install -r requirements.txt`. Dans VS Code : `Ctrl+Shift+P` → *Python: Select Interpreter* → choisis celui de `.venv`. |
| `Port 8501 is already in use` | Une autre appli Streamlit tourne déjà | Ferme l'autre terminal, ou `streamlit run app.py --server.port 8502`. |

---

## 6. La feuille de route

| Étape | Ce qu'on ajoute | Ce que tu apprends |
| --- | --- | --- |
| [1](01-mvp-fil-rss.md) | **Version minimale :** un fil d'actualité à partir de flux RSS | requêtes HTTP, parsing, classes, premier écran Streamlit, cache |
| [2](02-filtres-et-recherche.md) | Catégories, filtre par source, barre de recherche | fonctions pures, classification par mots-clés, widgets |
| [3](03-favoris-lu-masquer.md) | Favoris, « lu », « masquer » (persistants) + plusieurs pages | SQL et SQLite, callbacks, navigation multipage |
| [4](04-sources-api.md) | Finnhub, NewsAPI, Marketaux, Alpha Vantage | API REST, JSON, clés secrètes, requêtes en parallèle |
| [5](05-identite-visuelle.md) | Une identité visuelle originale, clair/sombre | design system, typographie, CSS, accessibilité |
| [6](06-marches-et-tableaux-de-bord.md) | Bandeau des cours, tableaux de bord marchés et actualité | yfinance, pandas, visualisation de données |
| [7](07-suivi-personnalise.md) | Suivre des entreprises et des thèmes, fiches entreprises | recherche de ticker, indicateurs financiers |
| [8](08-resume-ia.md) | Résumé automatique des articles | extraction de texte, algorithme extractif, appel à un LLM |
| [9](09-reglages-tests-deploiement.md) | Réglages, tests, mise en ligne, présentation portfolio/LinkedIn | pytest, Streamlit Community Cloud, rédaction |

Un mémo de débogage regroupe toutes les erreurs courantes : [debogage.md](debogage.md).

### Comment suivre le guide

Chaque étape correspond à **un commit** Git. Tu peux donc voir exactement ce qui change d'une étape à l'autre :

```bash
git log --oneline -- finveille        # liste les étapes
git show <identifiant_du_commit>      # montre les modifications d'une étape
```

Sur GitHub, clique sur un commit pour voir le *diff* en vert (ajouts) et rouge (suppressions).

**Le meilleur moyen d'apprendre :** lis l'explication, **tape le code toi-même** (pas de copier-coller !), lance-le,
casse-le volontairement pour voir l'erreur, puis compare avec le code du commit.
