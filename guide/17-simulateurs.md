# Étape 17 — Les simulateurs : épargne, investissement programmé, crédit, inflation

> **Objectif :** une page *Outils → Simulateurs* pour faire les calculs de base de la finance personnelle, voir
> l'effet de chaque paramètre et comprendre les formules. Le simulateur d'investissement programmé rejoue
> l'**historique réel** d'un indice.

Fichiers créés : `core/simulators.py`, `views/simulators.py`, `tests/test_simulators.py`, ce guide. Fichiers
modifiés : `theme.py` (graphiques en français), `app.py`, toutes les pages avec des graphiques.

---

## 1. Les intérêts composés

Chaque mois, l'épargne rapporte des intérêts… qui rapportent à leur tour des intérêts le mois suivant. La boucle
reproduit exactement ce que fait une banque :

```python
for month in range(1, years * 12 + 1):
    value = value * (1 + rate) + monthly     # les intérêts du mois, puis le versement
```

**Le taux mensuel** n'est pas le taux annuel divisé par 12 : 12 mois à 0,4167 % font 5,12 %, pas 5 %. Le taux
mensuel **équivalent** est celui qui, composé 12 fois, donne exactement le taux annuel :

```
(1 + r_mensuel)^12 = 1 + r_annuel   →   r_mensuel = (1 + r_annuel)^(1/12) − 1
```

La même valeur s'obtient en une formule (celle de la **valeur future** d'une suite de versements) ; le test
`test_le_tableau_d_epargne_retrouve_la_formule` vérifie que la boucle et la formule donnent le même résultat :

```
VF = C × (1 + i)^n  +  V × ((1 + i)^n − 1) / i       C : capital de départ, V : versement, i : taux, n : mois
```

**La règle de 72** : un capital double en environ `72 ÷ taux` années (à 6 %, 12 ans). Le calcul exact est
`ln 2 / ln(1 + taux)` : la page affiche les deux.

**Les frais** semblent petits (0,5 % ou 1 % par an), mais ils sont retirés **chaque année** : sur 20 ou 30 ans, ils
coûtent des milliers d'euros. Le chiffre clé « Coût des frais » le montre.

---

## 2. L'investissement programmé (DCA)

Investir la même somme chaque mois (*dollar-cost averaging*) évite de devoir choisir le « bon moment » : on achète
plus de parts quand le cours est bas, moins quand il est haut.

On rejoue l'historique de Yahoo Finance : le premier jour de cotation de chaque mois, on achète des parts.

```python
month = closes.index.to_period("M")          # le mois de chaque date : 2026-01, 2026-01, 2026-02…
is_buy_day = ~month.duplicated()             # True pour la première date de chaque mois
bought[is_buy_day] = monthly / closes[is_buy_day]    # parts achetées = montant ÷ cours
table["valeur"] = bought.cumsum() * closes   # valeur = parts accumulées × cours du jour
```

`~` inverse un tableau de booléens (`True` ↔ `False`) : `duplicated()` marque les dates **déjà vues** dans le mois,
on garde les autres.

La page compare avec « tout investir au début » : sur un marché qui monte, investir tout de suite rapporte
généralement plus ; le DCA réduit surtout le **risque** d'investir juste avant une chute.

> **Honnêteté des chiffres :** `^FCHI` est l'indice CAC 40 **hors dividendes**. Un fonds (ETF) qui réinvestit les
> dividendes ferait 2 à 3 points de mieux par an. La page le dit, tout comme l'absence d'effet de change pour les
> actifs en dollars.

---

## 3. Le crédit immobilier

### La mensualité

Pour un prêt à taux fixe, toutes les mensualités sont égales :

```
M = C × i / (1 − (1 + i)^−n)        C : capital emprunté, i : taux annuel ÷ 12, n : nombre de mois
```

En France, le taux mensuel d'un crédit est le taux annuel **divisé par 12** (taux « proportionnel »), pas le taux
équivalent de l'épargne. Le test vérifie un cas calculé à la main : 200 000 € sur 20 ans à 3,6 % → 1 170,22 €.

### Le tableau d'amortissement

Chaque mois, les intérêts portent sur le **capital restant dû** ; le reste de la mensualité rembourse le capital :

```python
interest = remaining * i
capital = payment - interest
remaining -= capital
```

Au début, on paie surtout des intérêts ; à la fin, surtout du capital. Le graphique en barres empilées le rend
évident.

### La capacité d'emprunt

Le Haut Conseil de stabilité financière (HCSF) limite la mensualité, **assurance comprise**, à **35 % des revenus
nets**, sur 25 ans au plus. On inverse la formule : on connaît la mensualité maximale, on cherche le capital.

```python
budget = net_income * 0.35
per_euro = loan_payment(1.0, annual_rate, years) + insurance_rate / 100 / 12   # coût mensuel d'1 € emprunté
capacity = budget / per_euro
```

---

## 4. L'inflation et le rendement réel

Avec 2 % d'inflation par an, 100 € d'aujourd'hui n'achèteront plus que pour `100 / 1,02^n` euros dans `n` ans.
Le simulateur prend par défaut **l'inflation actuelle de la zone euro**, lue sur la page Économie (étape 16) : les
pages réutilisent les mêmes données en cache.

Le **rendement réel** d'un placement (relation de Fisher) : `(1 + rendement) / (1 + inflation) − 1`. Un livret à
3 % quand l'inflation est à 3,8 % fait **perdre** du pouvoir d'achat, même si le solde augmente.

---

## 5. Des graphiques en français

Vega-Lite (le moteur d'Altair) écrit par défaut les nombres et les mois en anglais : `40,000`, `Nov 2025`.
On lui donne une **locale** française une fois pour toutes (`theme.ALTAIR_LOCALE`) :

```python
ALTAIR_LOCALE = {
    "number": {"decimal": ",", "thousands": " ", "grouping": [3], "currency": ["", " €"]},
    "time": {"months": ["janvier", ...], "shortMonths": ["janv.", ...], ...},
}

def french(chart):
    return chart.configure(locale=ALTAIR_LOCALE)

st.altair_chart(theme.french(chart))
```

Résultat : `40 000` et `nov. 2025`, sur toutes les pages. `configure` s'applique au graphique **final** (après les
`+` qui superposent les couches), juste avant de l'afficher.

---

## 6. Exercices

1. Ajoute au simulateur d'épargne un **versement qui augmente** de 2 % par an (indexé sur l'inflation).
2. Calcule pour le DCA le **rendement annualisé** (indice : une recherche par dichotomie du taux qui annule la valeur
   actuelle des flux, le « TRI »).
3. Crédit : ajoute un **remboursement anticipé** à une année choisie et montre les intérêts économisés.
4. **Défi :** un simulateur de **retraite** : combien épargner par mois pour toucher un complément de 500 € par mois
   pendant 25 ans à partir de 64 ans ?

---

## 7. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| L'épargne rapporte un peu trop | Taux mensuel = taux annuel ÷ 12 | Taux équivalent `(1 + r)^(1/12) − 1` (le crédit, lui, utilise ÷ 12). |
| `ZeroDivisionError` dans la mensualité | Taux de 0 % | Cas particulier : `principal / n`. |
| `TypeError: '>=' not supported between ... 'Timestamp'` | Série vide ou dates avec fuseau horaire | Teste `closes.empty` avant de filtrer ; `tz_localize(None)`. |
| Deux fois la même année sur l'axe | Altair place un repère tous les 6 mois | `tickCount={"interval": "year", "step": 1}`. |
| `40,000` au lieu de `40 000` | Locale anglaise de Vega-Lite | `theme.french(chart)`. |
| Le DCA achète tous les jours | On a oublié de ne garder que le premier jour du mois | `~month.duplicated()`. |

Retour au [sommaire du guide](README.md).
