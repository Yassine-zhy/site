# Étape 7 — Suivi personnalisé et fiches entreprises

> **Objectif :** suivre des entreprises et des thèmes, avoir un **fil dédié** pour chacun, et une **fiche
> entreprise** avec le cours, un graphique interactif et les indicateurs clés qu'on apprend en cours de finance.

Fichiers créés : `views/following.py`. Fichiers modifiés : `core/storage.py`, `core/market.py`, `core/sources.py`,
`core/aggregator.py`, `theme.py`, `ui.py`, `views/markets.py`, `app.py`.

---

## 1. Le modèle de données : la table `follows`

```sql
CREATE TABLE IF NOT EXISTS follows (
    kind       TEXT NOT NULL CHECK (kind IN ('company', 'theme')),
    value      TEXT NOT NULL,      -- symbole Yahoo (« MC.PA ») ou mot-clé (« inflation »)
    label      TEXT NOT NULL,      -- nom affiché (« LVMH »)
    created_at TEXT NOT NULL,
    PRIMARY KEY (kind, value)
);
```

- **Une seule table pour deux types de suivis**, distingués par `kind`. Une entreprise et un thème ont les mêmes
  besoins (un identifiant, un nom, une date) : inutile de créer deux tables.
- `CHECK (kind IN (...))` : une **contrainte**. La base refusera toute autre valeur, même en cas de bug dans notre
  code. Les règles importantes se mettent **au plus près des données**.
- `PRIMARY KEY (kind, value)` : une clé primaire **composée** de deux colonnes. On peut suivre le thème « Apple » et
  l'entreprise `AAPL`, mais pas deux fois `AAPL`.
- `INSERT OR IGNORE` : si la ligne existe déjà, SQLite ne fait rien (au lieu de lever une erreur). Cliquer deux fois
  sur « Suivre » est donc sans conséquence.

Pourquoi `CREATE TABLE IF NOT EXISTS` suffit ici : la nouvelle table s'ajoute **à côté** de l'ancienne. Ta base de
l'étape 3 (et tes favoris) reste intacte.

---

## 2. Trouver une entreprise : `yf.Search`

```python
def search_companies(query, limit=8):
    results = yf.Search(query, max_results=limit).quotes
    return [{"symbol": r["symbol"], "name": r.get("shortname") or ..., "exchange": r.get("exchDisp", "")}
            for r in results if r.get("quoteType") in ("EQUITY", "ETF") and r.get("symbol")]
```

On tape « LVMH », Yahoo propose `MC.PA` (Paris), `LVMUY` (certificat américain)… On garde les actions (`EQUITY`) et
les fonds indiciels (`ETF`), et on **affiche la place de cotation**. Une même entreprise est souvent cotée à plusieurs
endroits, en plusieurs devises : à toi de choisir la cotation principale (Paris pour LVMH).

---

## 3. Le fil dédié : `collect_followed`

Pour chaque suivi, on combine plusieurs sources :

| Suivi | Sources |
| --- | --- |
| Entreprise | flux RSS Yahoo Finance **de l'entreprise** (gratuit, sans clé, toutes Bourses) · Finnhub si la clé existe (actions américaines seulement en gratuit, d'où le test `"." not in symbol`) · articles du fil principal qui la citent |
| Thème | articles du fil principal qui contiennent le mot-clé · recherche NewsAPI si la clé existe |

Toutes les requêtes partent **en parallèle**, comme à l'étape 4. Pour savoir à quel suivi appartient chaque
résultat, on tient deux listes alignées :

```python
tasks.append((f"Yahoo · {label}", fetch_yahoo_ticker_news, (symbol,)))
owners.append(("company", symbol))
...
for owner, (found, error) in zip(owners, results):
    feeds[owner].extend(found)
```

`zip(a, b)` parcourt deux listes **en même temps**, élément par élément. Comme `pool.map` renvoie les résultats
**dans l'ordre des tâches**, `owners[i]` correspond bien à `results[i]`.

### Le cache et les arguments « hachables »

```python
@st.cache_data(ttl=900)
def load_followed(follows: tuple[tuple[str, str, str], ...], keys):
```

`st.cache_data` reconnaît un appel déjà fait en calculant une **empreinte** de ses arguments. On passe donc les
suivis sous forme de **tuple** (non modifiable, toujours la même empreinte pour le même contenu) plutôt que de liste
de dictionnaires. Quand tu ajoutes un suivi, le tuple change, et le cache recalcule automatiquement.

---

## 4. La page « Mes suivis »

### Ajouter un suivi : `st.popover`

```python
with st.popover("Suivre une entreprise", icon=":material/add_business:"):
    query = st.text_input("Nom ou symbole")
    for result in search_companies(query):
        st.button(f"{result['name']} · {result['symbol']} · {result['exchange']}",
                  on_click=follow, args=("company", result["symbol"], result["name"]))
```

Un *popover* est un petit panneau qui s'ouvre au clic. Il fonctionne aussi bien sur mobile que sur ordinateur,
contrairement à la barre latérale, cachée sur téléphone.

Pour le thème, on valide avec la touche Entrée grâce à `on_change` :

```python
st.text_input("Mot-clé", key="new_theme", on_change=add_theme)

def add_theme():
    value = st.session_state.get("new_theme", "").strip()
    if value:
        follow("theme", value, value)
    st.session_state.new_theme = ""        # vide le champ
```

Un widget qui a une `key` range sa valeur dans `st.session_state[key]`. Le callback la lit, puis la remet à zéro.
(Modifier la valeur d'un widget n'est permis **que dans un callback**, avant que le widget soit redessiné.)

### Choisir une vue : `st.pills`

```python
view = st.pills("Suivis", options, format_func=labels.get, default="__all__", key="follow_view")
```

Les pilules servent ici de **sélecteur de vue** : « Vue d'ensemble » (tuiles de toutes tes entreprises + fil combiné)
ou un suivi précis (sa fiche + son fil). La valeur technique (`"company|MC.PA"`) est distincte du libellé affiché
(`"LVMH"`) grâce à `format_func`.

`st.stop()` (pour l'état vide) arrête le script à cet endroit : rien en dessous n'est exécuté. Pratique pour éviter
d'imbriquer tout le reste de la page dans un `if`.

---

## 5. La fiche entreprise : de la finance en pratique

### Les indicateurs clés

`yf.Ticker(symbol).info` renvoie un dictionnaire de plus de 100 champs. On en retient dix, rangés dans
`market.INDICATORS` avec leur définition (affichée au survol) :

| Indicateur | Ce qu'il mesure | Comment le lire |
| --- | --- | --- |
| Capitalisation | cours × nombre d'actions | la taille de l'entreprise en Bourse |
| PER | cours ÷ bénéfice par action | « combien d'années de bénéfices le marché paie ». Élevé = croissance attendue (ou survalorisation). |
| PER prévisionnel | idem, sur le bénéfice attendu | inférieur au PER actuel = bénéfices attendus en hausse |
| Cours / valeur comptable | capitalisation ÷ fonds propres | < 1 : le marché valorise l'entreprise sous ses actifs nets |
| VE / EBITDA | (capitalisation + dette nette) ÷ EBITDA | compare des entreprises plus ou moins endettées |
| Rendement du dividende | dividende ÷ cours | le « loyer » versé à l'actionnaire |
| Marge nette | bénéfice net ÷ chiffre d'affaires | rentabilité de l'activité |
| ROE | bénéfice net ÷ capitaux propres | rentabilité pour l'actionnaire |
| Croissance du CA | sur un an | dynamique commerciale |
| Bêta | sensibilité aux mouvements du marché | 1,2 = amplifie le marché de 20 % ; 0,8 = l'amortit |

**⚠️ Piège des unités, découvert en testant :** yfinance donne `dividendYield = 3.41` (déjà en **pour cent**), mais
`profitMargins = 0.137` (une **fraction**, soit 13,7 %). D'où les formats distincts `"pct"` et `"ratio"` dans
`format_indicator`. Vérifie toujours une donnée avec une valeur connue (le rendement de LVMH tourne autour de 3 %,
pas de 341 %).

### La fourchette sur 52 semaines

```python
position = min(max((current - low) / (high - low), 0), 1)
```

Où se situe le cours entre son plus bas et son plus haut sur un an (0 = au plus bas, 1 = au plus haut).
`min(max(x, 0), 1)` **borne** la valeur entre 0 et 1 au cas où le cours sortirait de la fourchette. Un simple trait
sur une barre suffit à le montrer.

### Le graphique interactif

```python
hover = alt.selection_point(fields=["date"], nearest=True, on="pointerover", empty=False, clear="pointerout")
line = base.mark_line(color="#3987e5", strokeWidth=2)
rule = base.mark_rule(color="#8a8780").encode(
    opacity=alt.condition(hover, alt.value(1), alt.value(0)), tooltip=[...]).add_params(hover)
dot = base.mark_point(filled=True, size=60).encode(opacity=alt.condition(hover, alt.value(1), alt.value(0)))
chart = line + rule + dot
```

- `selection_point(nearest=True, on="pointerover")` : Altair repère la date **la plus proche** de la souris (pas
  besoin de viser la ligne au pixel près).
- Une règle verticale (`mark_rule`) et un point n'apparaissent (`opacity` 1) que pour la date survolée : c'est un
  **réticule**, avec une info-bulle (date + cours).
- `line + rule + dot` **superpose** trois couches.

### 🐞 Deux bugs trouvés en testant

1. **« nan EUR » au lieu du cours.** Le samedi, `history()` renvoie une dernière ligne **vide** (`NaN`, *not a
   number*) pour la séance du jour. Lire `iloc[-1]` donnait donc `NaN`. Correction : `history["Close"].dropna()`
   avant de lire le dernier cours. **Leçon :** toute série financière peut contenir des trous ; nettoie-la avant de
   calculer.
2. **Une courbe toute plate.** La première version dessinait une surface colorée sous la courbe. Or une surface part
   forcément de **zéro** : l'axe allait de 0 à 500 €, et une baisse de 21 % ressemblait à une ligne droite. Sans
   surface, l'axe s'ajuste à la plage utile (380–520 €). **Leçon :** pour un cours, l'échelle compte autant que la
   courbe. (À l'inverse, pour des barres, l'axe doit **toujours** partir de zéro, sinon on exagère les écarts.)

Bonus : les dates s'affichent en format numérique (`01/08`) car Vega, le moteur d'Altair, écrirait les mois en
anglais (« Aug »).

---

## 6. Exercices

1. Ajoute l'indicateur **dette / capitaux propres** (`debtToEquity`, attention : en %, 53,3 = 53 %).
2. Dans la vue d'ensemble, trie les tuiles de tes entreprises par variation du jour (de la meilleure à la pire).
3. Ajoute le **volume** sous le graphique de cours (un second graphique en barres, aligné sur les mêmes dates :
   jamais deux axes verticaux sur un même graphique !).
4. **Défi finance :** compare le PER de trois entreprises d'un même secteur (par exemple LVMH, Kering, Hermès) dans
   un petit tableau. Laquelle le marché valorise-t-il le plus cher ? Pourquoi, d'après toi ?

---

## 7. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| La recherche d'entreprise ne renvoie rien | Nom en français ou trop vague, ou Yahoo limite les requêtes | Essaie le nom anglais, le symbole (`AIR.PA`), ou patiente une minute. |
| `Crumb fetch rate-limited (HTTP 429)` dans le terminal | Yahoo freine les requêtes | Sans gravité si la page s'affiche ; sinon attends. Les caches (1 h, 6 h) limitent les appels. |
| Indicateur « — » | Yahoo ne fournit pas ce champ pour cette entreprise (fréquent pour les ETF ou les petites capitalisations) | Normal : le code affiche « — » au lieu de planter. |
| `nan` dans un cours | Ligne vide dans l'historique | `.dropna()` avant `.iloc[-1]`. |
| Rendement du dividende à 341 % | Valeur déjà en %, multipliée par 100 | Format `"pct"` et non `"ratio"`. |
| Pas de résultat Finnhub pour LVMH | L'offre gratuite de Finnhub ne couvre que les actions américaines | Normal : le flux Yahoo de l'entreprise prend le relais. |
| `StreamlitAPIException: st.session_state.new_theme cannot be modified after the widget … is instantiated` | Valeur d'un widget modifiée hors d'un callback | Fais la modification **dans** le callback `on_change`/`on_click`. |
| `SyntaxError: unterminated f-string literal` | Guillemets ouvrants et fermants différents (`f"…'`) | Un `f"` se ferme avec `"`, un `f'` avec `'`. L'erreur indique la ligne : regarde ses guillemets. |

➡️ Étape suivante : [résumé automatique par IA](08-resume-ia.md).
