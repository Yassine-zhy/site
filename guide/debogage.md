# Mémo de débogage

## La méthode, en 6 réflexes

1. **Lis le message d'erreur en partant du bas.** La dernière ligne dit *quoi* (`KeyError: 'title'`), les lignes
   au-dessus disent *où* (fichier et numéro de ligne). Repère la première ligne qui pointe vers **ton** code (pas
   vers `site-packages/`).
2. **Regarde ce que contiennent vraiment tes variables.** Ajoute `st.write(variable)` dans la page, ou
   `print(variable)` (le résultat s'affiche dans le terminal), juste avant la ligne qui plante.
3. **Regarde la donnée brute** plutôt que de deviner : ouvre l'URL du flux ou de l'API dans le navigateur, affiche
   `response.text[:500]`. Les bugs de l'étape 3 (CSS dans les résumés) et de l'étape 7 (`nan`) se sont résolus ainsi.
4. **Isole le problème.** Teste la fonction seule, sans Streamlit :
   ```bash
   python -c "from core.sources import fetch_rss; from core.config import RSS_FEEDS; print(fetch_rss(RSS_FEEDS[0])[:2])"
   ```
5. **Vérifie l'environnement.** `(.venv)` affiché ? Bon dossier (`finveille/`) ? `pip install -r requirements.txt`
   relancé après une modification ?
6. **Lance les tests** (`pytest`) : s'ils échouent, ils te disent souvent exactement ce qui a changé.

Et quand rien ne marche : cherche le message exact entre guillemets sur un moteur de recherche.

## Environnement

| Symptôme | Solution |
| --- | --- |
| `'python' n'est pas reconnu…` (Windows) | Réinstalle Python en cochant *Add python.exe to PATH*, ou utilise `py`. |
| `…Activate.ps1 cannot be loaded because running scripts is disabled` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` une fois, puis réessaie. |
| `ModuleNotFoundError: No module named 'core'` | Lance Streamlit (ou pytest) depuis le dossier `finveille/`. |
| `ModuleNotFoundError: No module named 'xxx'` | Active le venv puis `pip install -r requirements.txt`. Dans VS Code, choisis l'interpréteur `.venv`. |
| `streamlit: command not found` | Venv non activé, ou `python -m streamlit run app.py`. |
| `Port 8501 is already in use` | Une autre instance tourne : ferme-la, ou `--server.port 8502`. |
| `ZoneInfoNotFoundError` | `pip install tzdata` (Windows). |
| Le code modifié ne change rien | Clique sur **Rerun** (ou `R`). Après une modification de `config.toml`, redémarre Streamlit. |

## Réseau et sources

| Symptôme | Solution |
| --- | --- |
| `ConnectTimeout`, `ReadTimeout` | Site lent ou bloqué : réessaie ; vérifie ta connexion. |
| `403 Forbidden` | Le site refuse les robots : change de flux. |
| `404 Not Found` | L'adresse du flux a changé : cherche la nouvelle. |
| Toutes les sources en erreur | Pas d'Internet ou réseau filtré (école, entreprise) : teste avec le partage de connexion. |
| `clé API refusée (401)` | Clé fausse ou pas encore active : recopie-la sans espace. |
| `quota dépassé (429)` / « rate limit » | Attends ; n'abaisse pas le `ttl` des caches. |
| Alpha Vantage : « Thank you for using Alpha Vantage!… » | Quota du jour atteint (25 requêtes) ou clé invalide. |
| Une clé apparaît dans un message | Utilise `describe_error`, et **régénère la clé** chez le fournisseur. |
| Yahoo : « Les cours ne sont pas disponibles » / `YFRateLimitError` / `Crumb fetch rate-limited` | Patiente ; `pip install -U yfinance` si ça persiste. |

## Données

| Symptôme | Solution |
| --- | --- |
| `KeyError` sur un champ d'une API | Utilise `.get("champ")` avec une valeur par défaut : les réponses sont souvent incomplètes. |
| `nan` dans un cours | `.dropna()` avant de lire la dernière valeur. |
| Valeur 100 fois trop grande ou trop petite | Vérifie l'unité : déjà en % (`dividendYield`) ou fraction (`profitMargins`) ? |
| Heures décalées | Les dates sont stockées en UTC et affichées dans le fuseau du navigateur ou de Paris. |
| `TypeError: Object of type datetime is not JSON serializable` | Passe par `article.to_dict()`. |

## Base SQLite

| Symptôme | Solution |
| --- | --- |
| `no such table: …` | `storage.init_db()` doit être appelé dans `app.py` avant la navigation. |
| `database is locked` | Toujours `with connect()` ; ferme DB Browser ou valide ses modifications. |
| `table … has no column named …` | `CREATE TABLE IF NOT EXISTS` ne modifie pas une table existante : supprime `data/finveille.db` ou fais un `ALTER TABLE`. |
| En ligne, les données disparaissent | Stockage éphémère de l'hébergement gratuit (étape 9). |

## Streamlit

| Symptôme | Solution |
| --- | --- |
| Un titre s'affiche en formule mathématique | `$` interprété comme LaTeX : échappe le texte (`md_escape` ou `esc` + `st.html`). |
| Le HTML s'affiche comme du texte | Utilise `st.html(...)`. |
| Un `<svg>` disparaît dans `st.html` | Encode-le en image `data:image/svg+xml;base64,…`. |
| `StreamlitDuplicateElementKey` | Deux widgets avec la même `key` : ajoute un préfixe propre à la page. |
| Il faut cliquer deux fois | Fais la modification dans un callback `on_click` / `on_change`. |
| `st.session_state.x cannot be modified after the widget … is instantiated` | Modifie la valeur d'un widget **dans un callback** uniquement. |
| `The body parameter is required` (`st.html`) | Le HTML construit est vide : vérifie avant d'afficher. |
| Avertissement « fragment rerun … callback that displays elements » | N'affiche rien depuis un callback de fragment (voir `flush_toast`, étape 9). |
| Les données ne se rafraîchissent pas | C'est le cache : « Actualiser maintenant », ou menu ⋮ → *Clear cache*. |
| La mise en page change après une mise à jour de Streamlit | Les règles CSS qui ciblent des `data-testid` internes peuvent casser (`theme.py`). |

## Python

| Symptôme | Solution |
| --- | --- |
| `SyntaxError: unterminated f-string literal` | Guillemets ouvrants et fermants différents (`f"…'`). |
| `IndentationError` | Mélange d'espaces et de tabulations, ou bloc mal aligné : VS Code → *Convert Indentation to Spaces*. |
| `AttributeError: 'NoneType' object has no attribute …` | Une fonction a renvoyé `None` : teste le cas (`if valeur is None: …`). |
| `IndexError: list index out of range` | Liste vide : vérifie `if liste:` avant `liste[0]`. |
