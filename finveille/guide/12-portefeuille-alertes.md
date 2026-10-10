# Étape 12 — Portefeuille virtuel et alertes de cours

> **Objectif :** s'entraîner à investir sans risquer un euro. Un **portefeuille virtuel** (plus-values, répartition,
> performance comparée au CAC 40) et des **alertes** qui préviennent quand un cours franchit un seuil.

Fichiers créés : `core/portfolio.py`, `core/alerts.py`, `views/portfolio.py`, `views/alerts.py`,
`tests/test_portfolio_alerts.py`. Fichiers modifiés : `core/storage.py`, `ui.py`, `theme.py`, `app.py`,
`views/compare.py`, tests.

---

## 1. Deux nouvelles tables

```sql
CREATE TABLE IF NOT EXISTS positions (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol    TEXT NOT NULL,
    label     TEXT NOT NULL,
    quantity  REAL NOT NULL CHECK (quantity > 0),
    price     REAL NOT NULL CHECK (price > 0),
    currency  TEXT NOT NULL,
    bought_on TEXT NOT NULL
);
```

- `INTEGER PRIMARY KEY AUTOINCREMENT` : SQLite attribue lui-même un numéro unique à chaque ligne (1, 2, 3…). On peut
  acheter deux fois LVMH à des dates différentes : ce sont deux lignes distinctes.
- `CHECK (quantity > 0)` : la base **refuse** une quantité négative, même si un bug laissait passer la saisie. Un test
  le vérifie (`sqlite3.IntegrityError`).
- `currency` est enregistrée à l'achat : Apple cote en dollars, LVMH en euros.

La table `alerts` suit le même modèle, avec `kind IN ('above', 'below', 'move')`.

---

## 2. Valoriser un portefeuille : `core/portfolio.py`

### Tout ramener en euros

```python
def to_eur(amount, currency, rates):
    if currency == "GBp":
        amount, currency = amount / 100, "GBP"
    return amount / rates.get(currency, 1.0)
```

`rates` donne la valeur d'**un euro** dans chaque devise (1 EUR = 1,12 USD). Pour passer des dollars aux euros, on
**divise** : 112 USD ÷ 1,12 = 100 EUR.

**Piège réel :** la Bourse de Londres cote en **pence** (`GBp`, avec un p minuscule), pas en livres (`GBP`). Une action
à 2 450 GBp vaut 24,50 £. Sans cette ligne, une position britannique serait valorisée 100 fois trop cher.

### Plus-value latente et poids

```python
@dataclass
class Line:
    position: dict
    last: float
    value: float   # en euros
    cost: float    # en euros

    @property
    def gain(self):
        return self.value - self.cost
```

- **Valeur** = quantité × dernier cours. **Prix de revient** = quantité × prix d'achat.
- **Plus-value latente** = valeur − prix de revient : un gain « sur le papier », qui ne devient réel qu'à la vente.
- **Poids** = valeur de la ligne ÷ valeur totale. Une ligne à 60 % rend le portefeuille très dépendant d'une seule
  entreprise : c'est le contraire de la diversification.

Simplification assumée (écrite à l'écran) : le prix de revient d'Apple est converti au taux de change **actuel**. Un
vrai logiciel de gestion utiliserait le taux du jour d'achat et distinguerait l'effet de change de l'effet action.

### Comparer au CAC 40 sans se tromper

Piège classique : additionner la valeur du portefeuille jour après jour **à partir des dates d'achat**. Le jour où
tu ajoutes 3 000 € d'Airbus, la valeur « bondit » de 3 000 € : ce n'est pas de la performance, c'est un apport.

La solution retenue répond à une question précise : **« comment aurait évolué ce que je détiens aujourd'hui ? »** On
garde les quantités actuelles constantes sur toute la période :

```python
def composition_history(positions, closes, rates):
    value = pd.Series(0.0, index=closes.index)
    for position in positions:
        value += to_eur(1.0, position["currency"], rates) * position["quantity"] * closes[position["symbol"]]
    return value
```

`value += …` additionne des **séries entières** d'un coup, date par date : c'est la force de pandas, sans boucle sur
les jours. On met ensuite cette série et le CAC 40 en base 100 sur le même graphique : la courbe bleue (ton
portefeuille) se détache, le CAC 40 reste en gris comme **référence**. C'est la forme « mise en avant » : une série
colorée, le contexte en gris.

### Le portefeuille d'exemple

Le bouton « Charger un portefeuille d'exemple » achète 4 actions **il y a six mois, au vrai cours de l'époque** :

```python
price = float(closes[symbol].asof(pd.Timestamp(start)))
```

`asof` (étape 11) renvoie le dernier cours connu à cette date, même si c'était un week-end.

---

## 3. Saisir une position : `st.form`

```python
with st.form("new_position", clear_on_submit=True, border=False):
    symbol = st.selectbox("Entreprise", list(choices), index=None, accept_new_options=True)
    quantity = st.number_input("Quantité", min_value=0.0, value=10.0)
    ...
    if st.form_submit_button("Ajouter", type="primary"):
        ...
```

- Dans un **formulaire**, modifier un champ ne relance **pas** le script : tout est envoyé d'un coup au clic sur
  « Ajouter ». Indispensable quand on remplit plusieurs champs liés.
- `accept_new_options=True` permet de **taper** un symbole absent de la liste (par exemple `ASML.AS`).
- Un prix laissé à 0 prend le dernier cours connu ; si aucun cours n'est trouvé, on explique pourquoi au lieu
  d'enregistrer une position fausse. **Valide les saisies avant de les enregistrer.**

---

## 4. Les alertes : `core/alerts.py`

```python
def is_triggered(alert, last, change_pct):
    if alert["kind"] == "above":
        return last >= alert["threshold"]
    if alert["kind"] == "below":
        return last <= alert["threshold"]
    return abs(change_pct) >= alert["threshold"]
```

Trois types d'alerte : au-dessus d'un seuil, en dessous d'un seuil, ou variation du jour d'au moins X % **dans un sens
ou dans l'autre** (`abs` = valeur absolue). Une fonction pure, testée sans réseau ni base.

### Le bandeau sur toutes les pages

Le fragment de `app.py` qui dessine le bandeau des cours vérifie aussi les alertes, toutes les 2 minutes :

```python
if my_alerts := storage.list_alerts():
    quotes = load_symbol_quotes(tuple(sorted({a["symbol"] for a in my_alerts})))
    if fired := alerts.check(my_alerts, quotes):
        theme.alert_banner(fired)
```

`{a["symbol"] for a in my_alerts}` (un ensemble) évite de demander deux fois le même cours si tu as deux alertes sur
LVMH. Le bandeau contient un lien vers la page Alertes : `<a href="alerts" target="_self">`. `alerts` est l'adresse
de la page, déduite du nom du fichier `views/alerts.py`.

Limite : FinVeille vérifie les alertes **quand une page est ouverte**. Pour recevoir un e-mail à n'importe quel
moment, il faudrait un programme qui tourne en permanence (la tâche planifiée évoquée à l'étape 9).

---

## 5. Exercices

1. Ajoute une colonne « Dividende annuel estimé » au portefeuille : quantité × cours × rendement du dividende (fiche
   Yahoo, `dividendYield`).
2. Ajoute un graphique de **répartition par devise** (euros / dollars).
3. Ajoute le type d'alerte « perte de plus de X % depuis mon prix d'achat » pour les positions du portefeuille.
4. **Défi :** calcule la vraie performance de tes décisions avec le **rendement pondéré par le temps** (*time-weighted
   return*) : on découpe la période à chaque achat et on enchaîne les rendements des sous-périodes.

---

## 6. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Une action londonienne vaut 100 fois trop | Cours en pence (`GBp`) traité comme des livres | `to_eur` divise par 100 pour `GBp`. |
| `sqlite3.IntegrityError: CHECK constraint failed` | Quantité ou prix ≤ 0 | Normal : la base protège les données. Valide la saisie avant d'enregistrer. |
| « Aucun cours trouvé pour … » | Symbole inexact | Cherche le symbole sur finance.yahoo.com (suffixe `.PA` pour Paris, `.AS` pour Amsterdam, `.DE` pour Francfort). |
| La courbe du portefeuille « saute » | Valeur calculée à partir des dates d'achat | Utilise la composition actuelle à quantités constantes (`composition_history`). |
| Le bandeau d'alerte ne disparaît pas | La condition est toujours remplie | Supprime l'alerte ou change son seuil sur la page Alertes. |
| Le formulaire se vide avant d'être envoyé | Champs hors d'un `st.form` : chaque saisie relance la page | Mets tous les champs dans `with st.form(...)`. |

➡️ Étape suivante : [le brief du jour](13-brief-du-jour.md).
