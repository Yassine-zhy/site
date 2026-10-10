# Étape 11 — Marchés : carte du CAC 40, devises, comparateur, fiche enrichie

> **Objectif :** des outils d'analyste. La carte du CAC 40 valeur par valeur, un convertisseur de devises, un
> comparateur d'entreprises avec des **indicateurs de risque**, et une fiche entreprise qui montre l'agenda et place
> l'actualité **sur la courbe du cours**.

Fichiers créés : `core/metrics.py`, `views/compare.py`, `tests/test_metrics_market.py`. Fichiers modifiés :
`core/market.py`, `views/markets.py`, `views/following.py`, `ui.py`, `theme.py`, `app.py`, `tests/test_app.py`.

---

## 1. La page Marchés en trois vues

```python
VIEWS = {"Monde": world_view, "CAC 40": cac40_view, "Devises": currency_view}
view = st.segmented_control("Vue", list(VIEWS), default="Monde", key="markets_view")
VIEWS[view or "Monde"]()
```

Un dictionnaire qui associe un **nom** à une **fonction**, puis on appelle la fonction choisie. Pourquoi pas
`st.tabs` ? Les onglets de Streamlit exécutent **tous** leur contenu, même invisible : la page téléchargerait les
40 valeurs du CAC 40 alors que tu regardes les devises. Ici, seule la vue affichée charge ses données.

### La carte du CAC 40

`core/market.py` contient la liste des 40 valeurs avec leur **secteur** :

```python
CAC40 = [("MC.PA", "LVMH", "Luxe"), ("BNP.PA", "BNP Paribas", "Finance"), ...]
```

On réutilise `fetch_quotes` (une seule requête pour les 40) et la fonction `heatmap` de l'étape 6. Ici, le groupe de
chaque cotation est son secteur : on obtient une carte **par secteur** sans écrire de nouveau code de dessin.

Au-dessus, quatre chiffres clés : valeurs en hausse/en baisse (avec une barre de proportion), variation moyenne,
meilleure et pire valeur. En dessous, le palmarès des 5 plus fortes hausses et baisses.

⚠️ La **moyenne simple** des 40 variations n'est pas la variation du CAC 40. L'indice **pondère** chaque valeur par
sa capitalisation flottante : LVMH compte beaucoup plus que Bouygues. On l'écrit sous la carte.

### Le convertisseur de devises

On télécharge en une requête le prix de 1 euro dans chaque devise (`EURUSD=X`, `EURGBP=X`…). Pour convertir entre
deux devises quelconques, on passe par l'euro : c'est un **taux croisé**.

```python
def convert(amount, source, target, rates):
    return amount / rates[source] * rates[target]
```

100 livres en dollars : 100 GBP ÷ 0,846 = 118,2 EUR, puis × 1,12 = 132,4 USD.

---

## 2. Mesurer le risque : `core/metrics.py`

Comparer deux actions sur leur seul rendement, c'est oublier la moitié de l'histoire. Quatre indicateurs, chacun en
une ou deux lignes de pandas :

| Indicateur | Code | Ce qu'il dit |
| --- | --- | --- |
| Base 100 | `series / series.iloc[0] * 100` | Ramène tout le monde au même point de départ pour comparer des actions à 30 € et à 1 200 €. |
| Rendement annualisé | `(dernier / premier) ** (1 / années) − 1` | Le rendement « par an », comparable entre périodes de durées différentes. |
| Volatilité annualisée | `rendements_quotidiens.std() × √252` | L'ampleur typique des variations sur un an. |
| Perte maximale | `(series / series.cummax() − 1).min()` | La pire chute entre un sommet et le creux suivant. |
| Corrélation | `table.pct_change().corr()` | Est-ce que deux actions bougent ensemble ? |

Deux notions de pandas à retenir :

- `pct_change()` calcule la variation d'une ligne à la suivante : la série des **rendements quotidiens**.
- `cummax()` (maximum cumulé) donne, à chaque date, le plus haut atteint **jusque-là**. Diviser le cours par ce
  sommet montre à quelle distance du sommet on se trouve chaque jour.

**Pourquoi √252 ?** Si les rendements quotidiens sont indépendants, la variance s'additionne d'un jour à l'autre :
sur 252 séances (une année de Bourse), la variance est multipliée par 252, donc l'écart-type par √252.

### Des cours « ajustés »

```python
yf.download(symbols, period=period, auto_adjust=True)
```

Le jour du détachement d'un dividende, le cours baisse du montant versé, alors que l'actionnaire n'a rien perdu. Les
cours **ajustés** corrigent cet effet (et les divisions d'actions) : la comparaison reflète la vraie performance pour
l'actionnaire.

Les Bourses de Paris et de New York n'ont pas les mêmes jours fériés. `ffill()` (*forward fill*) reporte le dernier
cours connu sur les jours sans cotation, pour que toutes les colonnes aient les mêmes dates.

---

## 3. Le comparateur

Jusqu'à 4 entreprises, choisies parmi tes suivis, le CAC 40 et les grandes valeurs connues :

- **Courbes en base 100**, une couleur par entreprise. Les 4 couleurs suivent un **ordre fixe** et la couleur suit
  l'entreprise. Une légende **et** un point au bout de chaque courbe aident à les identifier.
- Un **réticule** affiche les valeurs de **toutes** les entreprises à la date survolée, sans devoir viser une courbe.
- Une **ligne à 100** sert de repère : au-dessus, l'action a gagné depuis le début de la période ; en dessous, perdu.
- Un **tableau risque/rendement**, un tableau de **valorisation** (PER, VE/EBITDA, rendement, marges, ROE, bêta) et une
  **matrice de corrélation**.

Pour l'info-bulle commune, on a besoin des données sous deux formes :

```python
long = rebased.melt(...)   # une ligne par (date, entreprise) : pour dessiner les courbes
wide = rebased             # une ligne par date, une colonne par entreprise : pour l'info-bulle
```

`melt` passe du format « large » (une colonne par entreprise) au format « long » (une ligne par observation). Altair
préfère le format long pour colorer par catégorie.

**Exemple d'interprétation (luxe, octobre 2026) :** LVMH, Hermès et Kering ont tous baissé de 30 à 40 % sur un an,
avec des corrélations de 0,44 à 0,70 entre eux. Ils subissent le **même risque sectoriel** : en détenir trois ne
diversifie presque rien. Apple, corrélé à 0,1–0,2 avec eux, diversifie bien plus.

---

## 4. La fiche entreprise enrichie

### L'agenda

`yf.Ticker(symbol).calendar` fournit la date des prochains résultats, le détachement du dividende et le **consensus**
des analystes (bénéfice par action et chiffre d'affaires attendus). On ne garde que les dates **futures** : Yahoo
renvoie parfois la date des résultats précédents.

```python
def upcoming(value):
    return value if isinstance(value, date) and value >= today else None
```

### L'actualité sur la courbe

Chaque dépêche du fil de l'entreprise devient un **losange** sur la courbe, à la date de sa publication. Au survol, on
lit son titre. On voit d'un coup d'œil si une chute coïncide avec une nouvelle.

```python
moment = pd.Timestamp(article.published).tz_convert(closes.index.tz)
cours = closes.asof(moment)   # le dernier cours connu à ce moment-là
```

- `tz_convert` met l'heure de l'article dans le fuseau de la Bourse de l'action (Paris pour LVMH).
- `asof` renvoie la dernière valeur **à ou avant** une date : une dépêche publiée un samedi se place sur le cours du
  vendredi.

---

## 5. Exercices

1. Ajoute le **ratio de Sharpe** au comparateur : rendement annualisé ÷ volatilité annualisée (version simplifiée,
   sans taux sans risque).
2. Ajoute « 1 EUR = … » pour le **franc CFA** (`XOF`) au convertisseur. Que remarques-tu sur ce taux, et pourquoi ?
3. Dans la carte du CAC 40, trie les secteurs du plus performant au moins performant.

---

## 6. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Un cours identique deux jours de suite | Yahoo n'a pas encore la clôture du jour (valeur vide), `ffill` reprend la veille | Normal : vérifie avec `yf.Ticker(s).history()` (la ligne est `NaN`). |
| `assert 110.00000000000001 == 110` dans un test | Calcul en virgule flottante | Arrondis avant de comparer (`round(x, 6)`). |
| Le même mois apparaît deux fois sur l'axe | Repères hebdomadaires étiquetés au format mois | Impose l'intervalle : `tickCount={"interval": "month", "step": 1}`. |
| Une entreprise disparaît du comparateur | Symbole sans données sur la période (introduction en Bourse récente…) | Normal : le code l'ignore. Choisis une période plus courte. |
| `TypeError: Cannot compare tz-naive and tz-aware` | Comparaison d'une date avec fuseau et d'une date sans fuseau | Convertis d'abord (`tz_convert` ou `tz_localize(None)`), comme dans `news_markers`. |
| La page Marchés est lente | La vue CAC 40 télécharge 40 valeurs (~4 s) | Le cache (5 min) rend les affichages suivants instantanés. |

➡️ Étape suivante : [portefeuille virtuel et alertes de cours](12-portefeuille-alertes.md).
