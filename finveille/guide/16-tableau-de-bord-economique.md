# Étape 16 — Le tableau de bord économique (BCE et Réserve fédérale)

> **Objectif :** une page *Marchés → Économie* qui rassemble les grands indicateurs que suit un analyste :
> inflation, taux directeurs, taux réels, courbes des taux, chômage et croissance, pour la zone euro, la France et
> les États-Unis. Données **officielles**, **gratuites**, **sans clé API**.

Fichiers créés : `core/macro.py`, `views/economy.py`, `tests/test_macro.py`, ce guide. Fichiers modifiés : `ui.py`,
`theme.py`, `app.py`, `tests/test_app.py`.

---

## 1. Ce que montrent les indicateurs (à savoir expliquer en entretien)

| Indicateur | Ce qu'il mesure | Pourquoi les marchés le regardent |
| --- | --- | --- |
| **Inflation** | hausse des prix à la consommation sur un an | au-dessus de 2 %, les banques centrales montent leurs taux |
| **Inflation sous-jacente** | inflation hors énergie et alimentation | la tendance de fond, moins bruitée que l'inflation totale |
| **Taux directeur** | le taux auquel la banque centrale prête ou rémunère les banques | il fixe le prix de l'argent à court terme |
| **Taux réel** | taux directeur corrigé de l'inflation | négatif : politique **accommodante** ; positif : **restrictive** |
| **Taux à 10 ans** | rendement d'un emprunt d'État à 10 ans | sert de référence pour les crédits immobiliers et la valorisation des actions |
| **Courbe des taux** | les rendements selon la durée (3 mois → 30 ans) | **inversée** (court > long) : signal historique de récession |
| **Chômage** | part des actifs sans emploi | santé du marché du travail, donc de la consommation |
| **Croissance du PIB** | évolution de la production en volume sur un an | le cycle économique |

Le **taux réel** utilise la relation de Fisher : `(1 + taux) / (1 + inflation) − 1`. Avec un taux de 2,50 % et une
inflation de 3,8 %, l'argent placé perd 1,25 % de pouvoir d'achat par an.

---

## 2. Deux sources officielles, sans clé

### La BCE : des clés SDMX

Le portail de la BCE (<https://data.ecb.europa.eu>) identifie chaque série par une **clé** au format SDMX (le
standard international des statistiques). Chaque morceau est une « dimension » :

```
HICP / M . U2 . N . 000000 . 4D0 . ANR
 │      │   │    │    │       │     └ ANR = taux de variation annuel (Annual Rate)
 │      │   │    │    │       └ fournisseur : Eurostat
 │      │   │    │    └ 000000 = indice global (XEF000 = hors énergie et alimentation)
 │      │   │    └ N = non corrigé des variations saisonnières
 │      │   └ U2 = zone euro (FR = France)
 │      └ M = mensuel
 └ jeu de données : prix à la consommation
```

Pour trouver une clé : cherche la série sur le portail, la clé est affichée en haut de sa page. L'adresse de
téléchargement :

```
https://data-api.ecb.europa.eu/service/data/HICP/M.U2.N.000000.4D0.ANR?format=csvdata&detail=dataonly&startPeriod=2016-01
```

Astuce : un `+` demande plusieurs séries d'un coup. La courbe des taux de la zone euro tient en **une** requête :
`YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_3M+SR_1Y+SR_2Y+SR_5Y+SR_10Y+SR_30Y`.

> **Histoire vraie de ce projet :** l'ancienne série d'inflation (`ICP/…`) s'arrêtait en décembre 2025. Eurostat
> a changé de nomenclature en 2026 et la BCE publie désormais l'inflation dans un nouveau jeu, `HICP`, avec un
> nouveau code fournisseur (`4D0`). Une source peut changer : vérifie toujours la **date de la dernière valeur**.

### FRED : des codes courts

FRED (<https://fred.stlouisfed.org>), la base de la Réserve fédérale de Saint-Louis, propose plus de 800 000 séries.
Le code est dans l'adresse de chaque page (`UNRATE`, `CPIAUCSL`, `DGS10`…), et le CSV se télécharge sans clé :

```
https://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE&cosd=2016-01-01
```

FRED donne parfois un **indice** de prix (`CPIAUCSL`) plutôt qu'un taux : on calcule la variation sur un an.

```python
def year_over_year(index):
    return (index / index.shift(12) - 1) * 100     # shift(12) : la valeur 12 mois plus tôt
```

---

## 3. Lire un CSV avec pandas

Les deux sources renvoient du **CSV** (des valeurs séparées par des virgules). `pd.read_csv` lit un fichier… ou un
texte, à condition de l'envelopper dans `io.StringIO` (qui fait passer une chaîne pour un fichier) :

```python
table = pd.read_csv(io.StringIO(response.text), na_values=["."])   # FRED écrit « . » quand il manque une valeur
```

Le CSV de la BCE a une ligne par (série, date). On le **pivote** pour obtenir une colonne par série :

```python
raw.pivot_table(index="date", columns="serie", values="valeur")
```

Les dates arrivent sous plusieurs formes (`2026-09`, `2026-Q3`, `2026-10-08`) : `parse_period` les convertit toutes,
en datant les mois et les trimestres de leur premier jour.

---

## 4. Robustesse et rapidité

- Les 15 indicateurs sont téléchargés **en parallèle** (`ThreadPoolExecutor`, comme à l'étape 4) : 2 à 3 secondes
  au lieu de 15.
- Une source en panne n'empêche pas d'afficher les autres : chaque erreur est notée dans une liste, affichée en bas
  de page.
- Les statistiques sont publiées au plus une fois par jour : cache de **6 heures** (`st.cache_data(ttl=6 * 3600)`).

> **Piège rencontré :** avec un en-tête `User-Agent` personnalisé (`"FinVeille/1.0"`), FRED ne répondait jamais
> (délai dépassé au bout de 20 secondes). Sa protection anti-robots laisse passer l'en-tête par défaut de
> `requests`. Morale : quand une API « ne répond pas », teste la même requête avec `curl` et compare les en-têtes.

---

## 5. Les graphiques

- **Inflation** : une couleur fixe par zone (zone euro en bleu, France en vert, États-Unis en orange, partout sur la
  page) et une ligne pointillée « objectif 2 % ».
- **Taux directeurs** : `interpolate="step-after"` dessine des **paliers** : un taux directeur ne glisse pas, il saute
  à chaque décision. La série de la BCE ne contient que les dates de décision : `extend_to` prolonge le dernier palier
  jusqu'à aujourd'hui.
- **Courbes des taux** : l'axe horizontal est une durée (« 3 mois » … « 30 ans ») traitée comme une catégorie
  ordonnée (`sort=labels`), la courbe d'il y a un an en pointillés gris pour comparer.
- **Le tableau de bord** : chaque case montre la dernière valeur, une mini-courbe sur trois ans et l'évolution sur un
  an. Les flèches sont **grises** (`theme.move`) : une hausse de l'inflation ou du chômage n'est pas « verte ».

---

## 6. Exercices

1. Ajoute l'**Allemagne** : inflation `HICP/M.DE.N.000000.4D0.ANR`, chômage `LFSI/M.DE.S.UNEHRT.TOTAL0.15_74.T`,
   taux à 10 ans `IRS/M.DE.L.L40.CI.0000.EUR.N.Z`.
2. Affiche l'**écart OAT − Bund** (taux à 10 ans France − Allemagne) : la prime de risque demandée à la France.
3. Ajoute le prix du **pétrole Brent** (FRED : `DCOILBRENTEU`) sur le graphique de l'inflation, avec un second
   graphique plutôt qu'un second axe (deux échelles sur un même graphique trompent l'œil).
4. **Défi :** une phrase automatique dans le brief (étape 13) : « L'inflation de la zone euro accélère à 3,8 % en
   septembre, au-dessus de l'objectif de la BCE. »

---

## 7. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| `ReadTimeout` sur FRED | En-tête `User-Agent` personnalisé bloqué | N'envoie pas d'en-tête particulier. |
| `404` sur la BCE | Clé mal recopiée, ou série sans donnée après `startPeriod` | Vérifie la clé sur le portail, élargis la période. |
| Une valeur figée depuis des mois | La série a été remplacée par une autre | Compare la date de la dernière valeur, cherche la nouvelle série. |
| L'inflation américaine vaut 330 % | Tu affiches l'**indice** CPI, pas sa variation | `transform="yoy"`. |
| `ValueError: could not convert string to float: '.'` | Valeur manquante de FRED | `na_values=["."]` dans `read_csv`. |
| Les dates trimestrielles plantent | `2026-Q1` n'est pas une date standard | Passe par `parse_period`. |

Retour au [sommaire du guide](README.md).
