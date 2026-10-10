# Étape 8 — Résumé automatique par IA

> **Objectif :** un bouton « Résumé » sous chaque article, qui affiche **l'essentiel en trois points**. Sans clé, un
> algorithme local s'en charge ; avec une clé gratuite Gemini ou Groq, un modèle de langage rédige un résumé en
> français, avec une ligne « Pourquoi c'est important ».

Fichiers créés : `core/summarizer.py`. Fichiers modifiés : `core/storage.py`, `core/config.py`, `ui.py`, `theme.py`,
`.streamlit/secrets.toml.example`, `requirements.txt`.

---

## 1. Deux familles de résumé

| | Résumé **extractif** | Résumé **abstractif** |
| --- | --- | --- |
| Principe | on **choisit** les phrases les plus représentatives du texte | un modèle de langage **réécrit** le texte avec ses mots |
| Exemple | algorithme de Luhn (1958), TextRank | Gemini, Llama, GPT, Claude… |
| Avantages | gratuit, instantané, hors ligne, ne peut rien inventer | fluide, traduit en français, synthétise |
| Limites | phrases parfois mal enchaînées, reste dans la langue d'origine | nécessite une API ; peut **inventer** (« halluciner ») |

FinVeille utilise les deux : le résumé abstractif quand une clé est disponible, l'extractif sinon, ou en secours si
l'API échoue.

---

## 2. Étape préalable : récupérer le texte de l'article

```python
def extract_text(url):
    try:
        response = requests.get(url, headers=BROWSER_HEADERS, timeout=REQUEST_TIMEOUT)
    except requests.RequestException:
        return None
    if not response.ok:
        return None
    return trafilatura.extract(response.text, include_comments=False, include_tables=False, favor_precision=True)
```

Une page web contient des menus, des publicités, des liens « à lire aussi »… `trafilatura` (une bibliothèque issue de
la recherche en linguistique) repère et extrait le **corps de l'article**.

**Ce qu'on a mesuré en testant** sur les 12 sources : la moitié renvoie le texte complet (BBC, BFM Bourse, CoinDesk,
Fed, BCE…). Les autres refusent : CNBC, Nasdaq et The Economist bloquent les robots (code `403`), Le Monde réserve ses
articles aux abonnés (code `402`). Dans ces cas, on résume **le titre et le chapeau** et on l'écrit clairement sous le
résumé (« chapeau seulement »). On ne contourne pas un paywall : c'est le modèle économique de la presse.

`response.ok` vaut vrai pour les codes 200 à 399. C'est un raccourci pour « la requête a réussi ».

---

## 3. Le résumé local : l'algorithme de Luhn

Hans Peter Luhn (IBM, 1958) part d'une idée simple : **les mots importants d'un texte sont ceux qui reviennent
souvent** (sauf les mots-outils comme « le », « the », « and »).

```python
def summarize_local(text, count=3):
    sentences = split_sentences(text)
    ...
    frequencies = Counter(w for sentence in sentences for w in words(sentence))   # 1. compter les mots
    top = max(frequencies.values())

    def score(item):                                                              # 2. noter chaque phrase
        index, sentence = item
        tokens = words(sentence)
        position_bonus = 1.15 if index < 3 else 1.0
        return position_bonus * sum(frequencies[w] / top for w in tokens) / (len(tokens) or 1)

    best = sorted(enumerate(sentences), key=score, reverse=True)[:count]           # 3. garder les meilleures
    return [sentence for _, sentence in sorted(best)]                              # 4. dans l'ordre du texte
```

1. **Compter** les mots de tout le texte, sauf les **mots vides** (`STOPWORDS`).
2. **Noter** chaque phrase : la moyenne de la fréquence de ses mots. On divise par le nombre de mots pour ne pas
   favoriser les phrases longues. Petit bonus pour les trois premières phrases : en journalisme, l'essentiel est en
   tête (la « pyramide inversée »).
3. **Garder** les trois meilleures.
4. Les remettre **dans l'ordre du texte**, pour que le résumé se lise naturellement.

`enumerate(sentences)` donne des paires `(position, phrase)` : trier ces paires (`sorted(best)`) les remet dans
l'ordre des positions.

### Découper en phrases

```python
_SENTENCE_RE = re.compile(r"(?<=[.!?…])\s+(?=[\"«“A-ZÀ-ÖØ-Þ0-9])")
```

« Couper sur les espaces **précédés** d'une ponctuation finale (`(?<=…)`) et **suivis** d'une majuscule, d'un
chiffre ou d'un guillemet (`(?=…)`) ». Ces `(?<=…)` et `(?=…)` sont des **assertions** : elles vérifient le contexte
sans le consommer, donc la ponctuation reste dans la phrase. Limite : « M. Powell a dit… » serait coupé après « M. ».
C'est acceptable ici.

---

## 4. Le résumé par un modèle de langage

### Choisir une API gratuite

| Service | Offre gratuite | Clé |
| --- | --- | --- |
| **Google Gemini** | quota quotidien généreux sur les modèles « Flash » | <https://aistudio.google.com/apikey> |
| **Groq** | modèles ouverts (Llama, GPT-OSS…) très rapides, quota par minute et par jour | <https://console.groq.com/keys> |

Ajoute la clé dans `.streamlit/secrets.toml` (`GEMINI_API_KEY = "…"` ou `GROQ_API_KEY = "…"`). Sans aucune clé,
tout fonctionne avec le résumé local.

Les noms de modèles évoluent vite. Par défaut, on utilise `gemini-flash-latest`, un **alias** que Google fait toujours
pointer vers son modèle Flash le plus récent, et `llama-3.3-70b-versatile` chez Groq. Tu peux les changer sans
toucher au code (`GEMINI_MODEL`, `GROQ_MODEL` dans `secrets.toml`).

### Anatomie d'un appel

```python
response = requests.post(
    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    headers={"x-goog-api-key": api_key},
    json={
        "contents": [{"parts": [{"text": PROMPT.format(title=title, text=text[:MAX_LLM_CHARS])}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 500},
    },
    timeout=30,
)
answer = response.json()["candidates"][0]["content"]["parts"][0]["text"]
```

- `requests.post(..., json=...)` envoie des données (ici la consigne et l'article) au lieu de seulement en demander.
- La **température** règle la part de hasard : 0,2 = réponses sobres et stables, ce qu'on veut pour un résumé
  factuel.
- `maxOutputTokens` limite la longueur de la réponse. Un *token* ≈ ¾ de mot.
- On coupe l'article à 12 000 caractères (`MAX_LLM_CHARS`) : les longs communiqués de la BCE dépassent 60 000
  caractères, ce qui serait lent et gaspillerait le quota.
- Lire la réponse, c'est descendre dans le JSON : `["candidates"][0]["content"]["parts"][0]["text"]`. Si la
  structure n'est pas celle attendue (réponse filtrée, vide…), on lève `SummaryError`.

L'appel à Groq a la même forme, au format *chat completions* devenu un standard de fait
(`messages: [{"role": "user", "content": ...}]`).

### Écrire la consigne (le *prompt*)

```text
Tu es un journaliste financier. Résume l'article ci-dessous pour un étudiant en finance.
Réponds en français, exactement dans ce format :
- (premier point clé, une phrase factuelle)
- (deuxième point clé)
- (troisième point clé)
Pourquoi c'est important : (une phrase sur la portée pour les marchés ou l'économie)
N'invente aucun chiffre : utilise seulement ceux de l'article.
```

Trois principes :

1. **Un rôle et un public** (journaliste, étudiant en finance) orientent le ton et le niveau.
2. **Un format exact** : on doit pouvoir découper la réponse automatiquement (`_parse_llm_answer` repère les lignes
   qui commencent par `-` et celle qui commence par « Pourquoi c'est important »). Si le modèle ne respecte pas le
   format, on garde le texte brut plutôt que de planter.
3. **Une garde-fou contre l'invention** : les modèles peuvent produire des chiffres plausibles mais faux. D'où la
   consigne, **et** l'avertissement affiché sous chaque résumé.

### La chaîne de secours

```python
for name, function, key, model in engines:
    if not key:
        continue
    try:
        points, why = _parse_llm_answer(function(article.title, text, key, model))
        return Summary(points, why, name, based_on)
    except (requests.RequestException, SummaryError, ValueError) as exc:
        note = f"{name} indisponible (...)"
return Summary(summarize_local(text), None, "Résumé local", based_on, note)
```

Gemini, sinon Groq, sinon le résumé local. Quota épuisé (`429`), panne, clé fausse : l'utilisateur a **toujours** un
résumé, et une note lui dit pourquoi ce n'est pas celui de l'IA.

---

## 5. Ne payer qu'une fois : le cache en base

```sql
CREATE TABLE IF NOT EXISTS summaries (
    article_id   TEXT PRIMARY KEY,
    summary_json TEXT NOT NULL,
    created_at   TEXT NOT NULL
);
```

Un résumé coûte du temps (2 à 5 secondes) et du quota. Une fois calculé, il est enregistré : rouvrir le résumé est
instantané, même après redémarrage. `INSERT OR REPLACE` écrase l'ancienne version si on en recalcule une.

On ajoute aussi une table `settings` (clé/valeur) pour les **préférences**. Le moteur de résumé y est lu
(`storage.get_setting("summary_engine", "auto")`) ; la page Réglages de l'étape 9 permettra de le changer.

---

## 6. Dans l'interface

```python
if summary_open:
    show_summary(article)
```

Le bouton « Résumé » bascule une valeur dans `st.session_state` (ouvert/fermé). Si le résumé est ouvert et pas
encore en base, `st.spinner("Lecture et résumé de l'article…")` affiche une animation d'attente pendant le calcul.

Le bloc « L'essentiel » indique toujours **le moteur utilisé** et **la base du résumé** (article complet ou chapeau).
C'est une question de **transparence**, essentielle dès qu'on affiche du contenu généré automatiquement.

---

## 7. Éthique et confidentialité, en bref

- Le texte des articles est envoyé à Google ou Groq quand tu utilises leur moteur. Ce sont des articles publics, mais
  n'y envoie jamais de document confidentiel.
- Les offres gratuites peuvent utiliser les données envoyées pour améliorer leurs modèles : lis leurs conditions.
- Un résumé n'est pas une source. Pour un mémoire ou un post, **cite l'article**, pas le résumé.

---

## 8. Exercices

1. Passe à 5 points au lieu de 3 (paramètre `count` et consigne).
2. Demande au modèle d'ajouter une ligne « Entreprises et actifs concernés : … » et affiche-la.
3. Compare, sur trois articles, le résumé local et celui de Gemini. Lequel préfères-tu, et pourquoi ?
4. **Défi :** remplace l'algorithme de Luhn par **TextRank** (les phrases « se votent » entre elles selon les mots
   qu'elles partagent, comme le PageRank de Google pour les pages web).

---

## 9. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Le résumé dit « chapeau seulement » | Le site bloque les robots (403) ou l'article est payant (402) | Normal. Depuis une connexion domestique, certains sites acceptent plus volontiers. |
| `Gemini indisponible (Gemini a répondu 404)` | Nom de modèle inconnu ou retiré | Vérifie `GEMINI_MODEL` (ou supprime-le pour revenir à l'alias par défaut). |
| `… a répondu 400` | Clé invalide, ou requête mal formée | Vérifie la clé. Teste dans le navigateur la page de la console du fournisseur. |
| `… a répondu 429` | Quota gratuit dépassé (par minute ou par jour) | Attends ; le résumé local prend le relais automatiquement. |
| `… a répondu 403` (Gemini) | Service non disponible dans ton pays ou projet sans accès | Essaie Groq. |
| Le résumé est en anglais | C'est le résumé local (il garde la langue de l'article) | Ajoute une clé Gemini ou Groq pour un résumé en français. |
| Le résumé ne change pas après modification du prompt | Il est enregistré en base | Supprime la ligne de la table `summaries` (ou tout `data/finveille.db` pour repartir de zéro). |
| `ModuleNotFoundError: No module named 'trafilatura'` | Nouvelle dépendance | `pip install -r requirements.txt`. |
| Le spinner tourne longtemps | Site lent + modèle lent (jusqu'à 10 + 30 s) | Les `timeout` bornent l'attente ; réessaie. |

➡️ Étape suivante : [réglages, tests, mise en ligne et présentation portfolio](09-reglages-tests-deploiement.md).
