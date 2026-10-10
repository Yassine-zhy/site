# Étape 6 — Marchés et tableaux de bord

> **Objectif :** un bandeau défilant des cours en haut de chaque page, et deux tableaux de bord :
> **Marchés** (indices, devises, taux, matières premières, crypto) et **En chiffres** (ce que raconte le flux
> d'actualité : volume, entreprises citées, tonalité).

Fichiers créés : `core/market.py`, `core/analytics.py`, `views/markets.py`, `views/stats.py`.
Fichiers modifiés : `theme.py`, `ui.py`, `app.py`, `core/config.py`, `core/aggregator.py`, `requirements.txt`.

---

## 1. Les cours avec yfinance

`yfinance` lit les données publiques de Yahoo Finance, sans clé. Chaque instrument a un **symbole Yahoo** :

| Type | Exemple | Convention |
| --- | --- | --- |
| Action française | `MC.PA` (LVMH) | suffixe `.PA` = Euronext Paris |
| Action américaine | `AAPL` | pas de suffixe |
| Indice | `^FCHI` (CAC 40), `^GSPC` (S&P 500) | préfixe `^` |
| Devise | `EURUSD=X` | suffixe `=X` |
| Contrat à terme | `BZ=F` (Brent), `GC=F` (or) | suffixe `=F` |
| Crypto | `BTC-USD` | paire avec la devise |
| Taux | `^TNX` (Trésor américain à 10 ans) | en % |

Pour trouver un symbole : cherche le nom sur <https://finance.yahoo.com>, le symbole est dans l'URL.

### Tout télécharger en une requête

```python
data = yf.download(symbols, period="3mo", interval="1d", group_by="ticker", progress=False, auto_adjust=False)
closes = data["^FCHI"]["Close"].dropna()
```

`yf.download` renvoie un **DataFrame** pandas (un tableau, comme une feuille Excel) : une ligne par jour, et pour
chaque symbole les colonnes `Open`, `High`, `Low`, `Close`, `Volume`. `data["^FCHI"]["Close"]` est une **Series**
(une colonne) des cours de clôture.

`.dropna()` retire les jours sans valeur (*NA* = *not available*). Indispensable : chaque Bourse a ses jours
fériés, et la crypto cote même le week-end. Toutes les lignes ne sont donc pas remplies pour tous les symboles.

### La classe `Quote`

```python
@dataclass
class Quote:
    symbol: str
    name: str
    group: str
    unit: str          # "%" ou "pb"
    last: float
    previous: float
    history: pd.Series

    @property
    def change(self) -> float:
        if self.unit == "pb":
            return (self.last - self.previous) * 100
        return (self.last / self.previous - 1) * 100
```

- La variation d'un indice se lit en **pourcentage** : `(dernier / précédent − 1) × 100`.
- Celle d'un **taux** se lit en **points de base** (pb) : passer de 5,23 % à 5,24 % = +1 pb. Dire « le taux a monté de
  0,25 % » serait ambigu (0,25 point ? ou 0,25 % de 5,23 ?). Les professionnels parlent en pb.
- `change_over(21)` donne la variation sur 21 séances, environ **un mois de Bourse** (5 séances = une semaine,
  63 = un trimestre).

### Le cache et les erreurs

```python
@st.cache_data(ttl=120, show_spinner=False)
def load_quotes():
    try:
        return fetch_quotes()
    except Exception:
        return []
```

- `ttl=120` : au plus une requête toutes les 2 minutes. Yahoo limite les requêtes trop fréquentes.
- On attrape **toutes** les exceptions (`Exception`), alors qu'à l'étape 1 on disait de rester précis. Pourquoi
  cette exception à la règle ? yfinance n'est pas une API officielle : il peut lever des erreurs réseau, de quota, ou
  de format quand Yahoo change son site. Dans tous ces cas, le comportement voulu est le même : ne rien afficher plutôt
  que planter. On le fait **à un seul endroit**, en le justifiant dans un commentaire.

---

## 2. Le bandeau défilant

Le bandeau est un fragment de `app.py`, donc présent sur **toutes** les pages, et rafraîchi toutes les 2 minutes :

```python
@st.fragment(run_every="2min")
def tape():
    theme.ticker_tape(load_quotes())
```

Le défilement est 100 % CSS :

```css
.fv-tape-track { display: inline-flex; animation: fv-tape 110s linear infinite; }
@keyframes fv-tape { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.fv-tape:hover .fv-tape-track { animation-play-state: paused; }
```

Trois astuces :

1. **La boucle invisible :** le contenu est écrit **deux fois** à la suite. On le décale de 50 % (la longueur d'une
   copie) ; à la fin du tour, la deuxième copie est exactement à la place de la première, et l'animation repart sans
   saut visible. (Pour que ce soit exact, l'espace entre les cours est un `padding-right` et pas un `gap` : sinon il
   manquerait un espacement entre les deux copies.)
2. **Pas de retour au début :** chaque rafraîchissement redessine le bandeau, qui repartirait de zéro. On donne donc
   un **délai négatif** calé sur l'horloge : `animation-delay: -(time.time() % 110)s`. L'animation reprend au point où
   elle « devrait » être.
3. **Accessibilité :** le survol met en pause (pour lire un cours), et les personnes qui ont demandé à leur système de
   réduire les animations (`prefers-reduced-motion`) obtiennent un bandeau fixe, défilable à la main.

---

## 3. Tableau de bord « Marchés »

### Choisir la bonne forme

Avant de dessiner un graphique, demande-toi **quelle question** il doit permettre de répondre :

| Question | Forme choisie |
| --- | --- |
| « Où en est le CAC 40 ? » (une valeur + sa tendance) | **tuile** : cours, variation, mini-courbe sur un mois |
| « Qu'est-ce qui monte, qu'est-ce qui baisse ? » (comparer des signes et des ampleurs) | **carte de chaleur** |
| « Je veux les chiffres exacts » | **tableau** (dans « Voir les données en tableau ») |

Un graphique en barres pour un seul chiffre, ou un camembert à deux parts, n'apportent rien : la tuile **est** le
graphique.

### Les tuiles

Chaque tuile suit le même contrat : **nom · cours · variation de la séance · mini-courbe · variation sur un mois**.

- La mini-courbe (*sparkline*) est **grise** ; seul son **dernier point** est coloré (vert ou rouge selon le mois).
  L'œil voit la tendance sans être agressé par la couleur.
- La variation s'écrit `▲ +0,95 %` : la **flèche** porte la couleur, le **chiffre** reste à l'encre, et le signe
  `+`/`−` dit la même chose. Trois indices pour une seule information : lisible même pour un daltonien ou imprimé en
  noir et blanc.
- Le `title` de la tuile résume tout au survol.

La mini-courbe est un petit dessin **SVG** construit en Python :

```python
points = [(4 + i * step, height - 4 - (v - low) / span * (height - 8)) for i, v in enumerate(values)]
```

C'est une règle de trois : la valeur la plus basse (`low`) va en bas du cadre, la plus haute en haut. Le SVG est
ensuite encodé en **base64** dans l'adresse de l'image (`data:image/svg+xml;base64,…`), car `st.html` refuse le SVG
directement dans la page (étape 5).

### La carte des performances

```python
alpha = 6 + min(abs(change) / scale, 1) * 56     # de 6 % à 62 % d'opacité
color = theme.UP if change >= 0 else theme.DOWN
```

- La **teinte** dit le sens (vert = hausse, rouge = baisse), l'**intensité** dit l'ampleur. Au-delà de l'échelle
  (2 % sur une séance, 8 % sur un mois…), la couleur sature. Une légende rappelle l'échelle.
- Le **taux** est en teinte neutre : qu'un taux monte n'est ni « bien » ni « mal », ça dépend de qui le regarde.
- Chaque case **écrit** sa valeur : la couleur n'est jamais la seule source d'information.

Le choix de la période (`st.segmented_control`) est placé **au-dessus** de la carte qu'il pilote : une rangée de
filtres au-dessus de ce qu'ils filtrent, c'est la règle des tableaux de bord lisibles.

### Le tableau « Voir les données »

Chaque visualisation a son **jumeau en tableau** (`st.dataframe`). C'est indispensable pour l'accessibilité (un
lecteur d'écran lit un tableau, pas une couleur), et pratique pour qui veut copier les chiffres dans Excel.

---

## 4. Tableau de bord « En chiffres »

### Reconnaître les entreprises citées : `core/analytics.py`

```python
COMPANIES = {"NVDA": ("Nvidia", "nvidia.com", ["nvidia"]), "MC.PA": ("LVMH", "lvmh.com", ["lvmh", "louis vuitton"]), …}

_COMPANY_PATTERNS = {
    ticker: re.compile(r"\b(" + "|".join(re.escape(word) for word in words) + r")\b")
    for ticker, (_, _, words) in COMPANIES.items()
}
```

Pour chaque entreprise, une regex « l'un de ces mots, en mot entier » (`|` signifie « ou »). L'agrégateur ajoute les
tickers trouvés à `article.tickers` : la recherche par entreprise du fil en profite aussi. Le domaine
(`nvidia.com`) sert à afficher le **vrai logo** de l'entreprise.

`counts.update(set(article.tickers) & set(COMPANIES))` : `&` est l'**intersection** de deux ensembles (les tickers
de l'article qui sont aussi dans notre liste). Le `set` garantit qu'un article qui cite trois fois Nvidia ne compte
qu'une fois.

### Mesurer la tonalité avec un lexique

```python
def lexicon_sentiment(text):
    words = _WORD_RE.findall(normalize(text))
    positive = sum(word in _POSITIVE for word in words)
    negative = sum(word in _NEGATIVE for word in words)
    if positive + negative == 0:
        return None
    return (positive - negative) / (positive + negative)
```

C'est la méthode des **dictionnaires**, très utilisée en finance empirique : la référence est le dictionnaire de
**Loughran et McDonald (2011)**, construit à partir des rapports annuels d'entreprises américaines. On compte les mots
positifs (*rally, rebound, hausse…*) et négatifs (*plunge, layoffs, chute…*). Le score va de −1 (que du négatif) à
+1 (que du positif).

- `sum(word in _POSITIVE for word in words)` : `True` compte pour 1, `False` pour 0. On compte donc les mots
  positifs.
- `None` si aucun mot n'est reconnu : « on ne sait pas » n'est pas « neutre ».

**Limites (à connaître pour en parler en entretien) :** la méthode ignore la négation (« no rebound » compte comme
positif), l'ironie, le contexte (« la volatilité recule » est plutôt une bonne nouvelle, mais « recule » est dans
la liste négative). Quand Marketaux ou Alpha Vantage sont actifs, on utilise leur score, calculé par des modèles plus
fins.

### Volume par heure : des petits multiples plutôt qu'un empilement

Quatre rubriques × 24 heures : on pourrait empiler les quatre couleurs dans chaque barre. Mais dans une barre
empilée, seule la catégorie du bas se lit facilement. On dessine plutôt **quatre petits graphiques identiques**
(*small multiples*), un par rubrique, **avec la même échelle verticale** :

```python
y_max = max(int(volume["depeches"].max()), 1)
alt.Y("depeches:Q", scale=alt.Scale(domain=[0, y_max]))
```

Sans échelle commune, une rubrique à 2 dépêches/heure aurait des barres aussi hautes qu'une rubrique à 8 : la
comparaison serait trompeuse.

### Altair en bref

```python
chart = (
    alt.Chart(subset)                                    # 1. les données (un DataFrame)
    .mark_bar(color=..., cornerRadiusEnd=3, size=9)      # 2. la forme : des barres fines, bout arrondi
    .encode(                                             # 3. qui va où
        x=alt.X("heure:T", ...),                         #    :T = temporel
        y=alt.Y("depeches:Q", ...),                      #    :Q = quantitatif
        tooltip=[...],                                   #    l'info-bulle au survol
    )
    .properties(height=130)
)
st.altair_chart(chart, width="stretch")
```

Altair est une **grammaire des graphiques** : on décrit *ce que* l'on veut (telle colonne en x, telle autre en y),
pas *comment* le dessiner. Il est installé avec Streamlit, et il adopte automatiquement le thème clair ou sombre.

### La tonalité par rubrique : des barres divergentes

Une valeur qui peut être positive **ou** négative se montre autour d'un **axe central** : vers la droite en vert si
positive, vers la gauche en rouge si négative, avec la valeur écrite au bout. On voit d'un coup d'œil le sens **et**
l'ampleur.

---

## 5. Exercices

1. Ajoute le **Nikkei** à la liste de Tokyo dans les horloges, puis l'indice **SMI** suisse (`^SSMI`) à `WATCHLIST`.
2. Ajoute 10 mots à chaque liste du lexique de tonalité, puis compare la tonalité moyenne avant/après.
3. Dans « Entreprises les plus citées », ajoute la variation du jour de chaque entreprise (indice : `fetch_quotes`
   accepte n'importe quelle liste de symboles).
4. **Défi :** calcule la corrélation entre la tonalité moyenne des dépêches « Marchés » d'une journée et la variation
   du S&P 500 le même jour. Il faudra enregistrer les deux chaque jour (SQLite !) pendant quelques semaines.

---

## 6. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| « Les cours ne sont pas disponibles » | Yahoo ne répond pas ou limite les requêtes (`YFRateLimitError`) | Attends quelques minutes. Évite de réduire le `ttl`. Mets yfinance à jour : `pip install -U yfinance` (Yahoo change souvent son site). |
| Un instrument manque dans les tuiles | Symbole faux ou temporairement indisponible | Vérifie le symbole sur finance.yahoo.com. Le code l'ignore sans planter (`if symbol not in data.columns…`). |
| `KeyError: 'Close'` | Ancienne version de yfinance avec un autre format de tableau | `pip install -U yfinance`, et garde `group_by="ticker"`. |
| Variation à 0 % le lundi matin | Le marché n'a pas encore ouvert : la dernière ligne est vendredi | Normal : on compare les deux derniers cours **connus**. |
| `Possibly delisted; no price data found` dans le terminal | Message de yfinance pour un symbole sans données | Sans gravité si ce n'est pas un de tes symboles ; sinon corrige le symbole. |
| Les heures du graphique sont décalées | Données en UTC, affichage dans le fuseau du navigateur | C'est voulu : chacun voit son heure locale. |
| `TypeError: altair_chart() got an unexpected keyword argument 'width'` | Streamlit trop ancien | `pip install -U streamlit` (ou utilise `use_container_width=True`). |
| Le bandeau ne défile pas | Ton système demande de réduire les animations | C'est voulu (accessibilité) : le bandeau se fait défiler à la main. |
| Le bandeau saute à chaque rafraîchissement | Délai d'animation non calé sur l'horloge | Vérifie que `TAPE_SECONDS` (Python) et la durée de l'animation (CSS) sont identiques. |

➡️ Étape suivante : [suivi personnalisé et fiches entreprises](07-suivi-personnalise.md).
