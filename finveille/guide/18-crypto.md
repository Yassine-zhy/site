# Étape 18 — La page Crypto : classement, marché et indice « peur et avidité »

> **Objectif :** une page *Marchés → Crypto* : les 20 premières cryptomonnaies en euros (cours, variations sur
> 24 h, 7 et 30 jours, capitalisation, mini-courbe), la taille du marché, la dominance du bitcoin, l'indice de
> sentiment *Crypto Fear & Greed* et les dernières dépêches crypto du fil.

Fichiers créés : `core/crypto.py`, `views/crypto.py`, `tests/test_crypto.py`, trois fichiers d'exemple dans
`tests/fixtures/`, ce guide. Fichiers modifiés : `ui.py`, `theme.py`, `app.py`, `tests/test_app.py`.

---

## 1. Les notions

| Notion | Définition |
| --- | --- |
| **Capitalisation** | cours × nombre d'unités en circulation : la « taille » d'une cryptomonnaie |
| **Dominance du bitcoin** | part du bitcoin dans la capitalisation de tout le marché crypto ; elle monte souvent quand les investisseurs se replient sur le plus « sûr » |
| **Stablecoin** | cryptomonnaie adossée à une monnaie (USDT, USDC ≈ 1 dollar) : sa variation doit rester proche de 0 % |
| **Plus haut historique (ATH)** | *all-time high* : l'écart avec ce sommet mesure la chute depuis l'euphorie |
| **Peur et avidité** | indice de 0 à 100 qui résume volatilité, volumes, réseaux sociaux et dominance : un thermomètre de l'humeur |

---

## 2. Deux API publiques, sans clé

```python
requests.get("https://api.coingecko.com/api/v3/coins/markets", params={
    "vs_currency": "eur", "order": "market_cap_desc", "per_page": 20,
    "sparkline": "true",                        # les cours horaires des 7 derniers jours
    "price_change_percentage": "24h,7d,30d",    # trois variations d'un coup
})
requests.get("https://api.coingecko.com/api/v3/global")          # capitalisation totale, dominance
requests.get("https://api.alternative.me/fng/", params={"limit": 365})   # un an de l'indice
```

Les réponses sont en **JSON**. Chaque ligne est convertie en objet `Coin` avec `row.get("champ")` : un champ absent
devient `None` au lieu de faire planter la page. Une ligne sans cours est ignorée.

L'indice arrive avec des libellés anglais (*Extreme Fear*, *Greed*…) : un dictionnaire les traduit.

---

## 3. Une source capricieuse : ne jamais garder une erreur en cache

L'offre gratuite de CoinGecko limite le nombre de requêtes par minute : de temps en temps, elle répond
`429 Too Many Requests`. Première version : la fonction en cache attrapait l'erreur et renvoyait une liste vide…
qui restait **en cache 5 minutes** : la page affichait « indisponible » alors que l'API répondait de nouveau.

Correction en deux temps (`ui.py`) :

```python
@st.cache_data(ttl=300)
def _crypto_markets():
    return crypto.fetch_markets()          # une erreur remonte : st.cache_data ne garde que les résultats

@st.cache_resource
def _last_good():
    return {}                              # mémoire partagée : la dernière réponse réussie

def load_crypto():
    memory = _last_good()
    try:
        memory["coins"] = _crypto_markets()
    except Exception:
        pass                               # on réessaiera à l'affichage suivant
    return memory.get("coins", [])         # en attendant : les derniers cours connus
```

- `st.cache_data` garde une **copie** du résultat pour une durée (`ttl`) ;
- `st.cache_resource` garde **le même objet** pour tout le serveur : idéal pour une petite mémoire partagée.

Avec 5 minutes de cache, le serveur n'interroge CoinGecko qu'environ 12 fois par heure, quel que soit le nombre de
visiteurs : c'est ce qui permet de rester dans le quota gratuit.

---

## 4. L'affichage

- **Le tableau** : logo, rang, symbole, cours au format français, variations colorées, capitalisation en
  milliards (`compact_money`), mini-courbe sur 7 jours. Les 168 points horaires sont réduits à ~42 (un sur quatre) :
  la forme est la même, l'image plus légère.
- **La jauge** : une barre en dégradé (rouge = peur, gris = neutre, vert = avidité) avec un repère, et les valeurs
  d'hier, d'il y a 7 et 30 jours.
- **L'historique sur un an** avec une ligne pointillée à 50 (neutre).
- **L'actualité crypto** réutilise le fil (`load_articles`, étape 1) : une seule collecte pour tout le site.

> **Bug rencontré :** le texte alternatif d'une image contenait le HTML coloré de la variation
> (`<span class="fv-down">…`). Les guillemets du HTML fermaient l'attribut `alt="…"` et un morceau de texte
> s'affichait sous l'image. Dans un attribut, on met du **texte brut échappé** (`esc(theme.signed(...))`), jamais du
> HTML.

---

## 5. Exercices

1. Ajoute une colonne « Écart au plus haut historique » avec une barre horizontale.
2. Ajoute un sélecteur de devise (euro / dollar) : paramètre `vs_currency`.
3. Fais une carte de chaleur des variations sur 24 h, comme celle du CAC 40 (étape 11).
4. **Défi :** un graphique qui superpose l'indice peur et avidité et le cours du bitcoin (deux graphiques alignés
   l'un sous l'autre, pas deux axes).

---

## 6. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| `429 Too Many Requests` | Quota gratuit de CoinGecko dépassé | Patiente ; ne baisse pas le `ttl` du cache. |
| « Indisponible » alors que l'API répond | Une erreur a été mise en cache | Laisse l'exception remonter de la fonction en cache (voir § 3). |
| Du texte `">` sous une image | HTML dans un attribut | Texte brut échappé dans `alt` et `title`. |
| `TypeError: float() argument must be ... 'NoneType'` | Champ absent dans la réponse | `row.get("champ") or 0`, ou ignorer la ligne. |

Étape suivante : [le quiz et la frontière efficiente](19-quiz-et-frontiere-efficiente.md). Retour au [sommaire du guide](README.md).
