# Étape 13 — Le brief du jour

> **Objectif :** une page qui se lit en deux minutes le matin, comme la une d'un quotidien, **entièrement rédigée par
> le programme** : la séance en une phrase, l'histoire la plus reprise de chaque rubrique, les sujets qui montent,
> tes entreprises, leur agenda et le mot du jour. Téléchargeable en un clic.

Fichiers créés : `core/brief.py`, `views/brief.py`, `tests/test_brief.py`. Fichiers modifiés : `core/analytics.py`,
`theme.py`, `app.py`.

---

## 1. Écrire une phrase avec du code

On appelle cela de la **génération de texte à base de règles** (*template-based NLG*). Pas d'IA : des règles simples,
donc un texte toujours juste et gratuit.

```python
def verb(change):
    if change >= 1.5:
        return "s'envole de"
    if change > 0.05:
        return "gagne"
    if change <= -1.5:
        return "chute de"
    if change < -0.05:
        return "cède"
    return "est stable"
```

Puis on assemble : « Séance de **hausse** à Paris : le CAC 40 **gagne** 0,95 %. Ailleurs, le S&P 500 gagne 0,59 %,
l'euro face au dollar **est stable**… et le bitcoin **chute de** 2,10 %. »

Détails qui font la différence :

- le **verbe** porte le sens, donc le chiffre s'écrit **sans signe** (« cède 0,30 % », pas « cède −0,30 % ») ;
- les éléments d'une liste sont séparés par des virgules, sauf le dernier, précédé de « et » :
  ```python
  listing = ", ".join(others[:-1]) + (" et " if len(others) > 1 else "") + others[-1]
  ```
- `others[:-1]` = tous les éléments **sauf le dernier** ; `others[-1]` = **le dernier**.

---

## 2. L'histoire la plus reprise

Pour la une, on ne prend pas la dernière dépêche, mais celle que **le plus de sources différentes** racontent :
c'est souvent l'information la plus importante du moment.

Deux titres « racontent la même histoire » s'ils partagent assez de mots significatifs. On le mesure avec l'**indice
de Jaccard** :

```
Jaccard(A, B) = |A ∩ B| ÷ |A ∪ B|        (mots communs ÷ mots au total)
```

« UK sanctions three crypto exchanges tied to Russia » et « UK slaps sanctions on three crypto exchanges over Russia
links » partagent *sanctions, crypto, exchanges, russia* : l'indice dépasse 0,3, c'est la même histoire, reprise par
CoinDesk **et** Cointelegraph.

```python
len(terms[i] & terms[j]) / len(terms[i] | terms[j]) >= 0.3
```

`&` (intersection) et `|` (union) sont les opérations d'**ensembles** de Python. On ne compte que les sources
**différentes** : un média qui publie trois fois la même info ne fait pas une histoire « reprise ».

---

## 3. Les sujets qui montent

Idée : un sujet « monte » quand il apparaît **beaucoup plus** ces dernières 24 heures que ce que laisseraient prévoir
les dépêches plus anciennes.

```python
ratio = len(recent) / len(older)                 # le volume récent comparé au volume ancien
surprise = count - older_counts[term] * ratio    # au-delà de ce qu'on attendait
```

Si « Trump » apparaît dans 2 dépêches anciennes sur 160 et dans 5 récentes sur 105, on en attendait environ 1,3 : la
surprise vaut 3,7. Un sujet présent partout depuis des semaines (« inflation ») ne « monte » pas, même s'il est
fréquent.

Trois finitions :

1. **Mots et paires de mots** : `title_terms` extrait les mots significatifs **et** les paires consécutives
   (« rate cut », « SpaceX unveils »). À égalité, la paire passe avant les mots seuls, plus précise.
2. **Pas de doublons** : si « rate cut » est retenu, « rate » et « cut » seuls sont écartés.
3. **La bonne écriture** : tout est comparé en minuscules sans accents, mais on réaffiche le terme tel qu'il est écrit
   dans les titres (« SpaceX », pas « spacex ») :
   ```python
   position = normalize(title).find(term)
   forms[title[position:position + len(term)]] += 1
   ```
   Astuce : `normalize` ne change pas la longueur d'un texte en alphabet latin (« é » devient « e »), donc la position
   dans le titre normalisé est la même que dans le titre d'origine.

On écarte aussi une liste de mots trop généraux pour faire un sujet (*stock, market, million, three, dollars…*). Cette
liste s'est construite **en regardant les résultats réels** : c'est normal, et c'est ainsi qu'on règle ce genre
d'algorithme.

---

## 4. Le brief, une structure de données d'abord

```python
@dataclass
class Brief:
    date_label: str
    market: str
    headlines: list[tuple[str, str, str, str]]
    topics: list[tuple[str, int, int]]
    companies: list[tuple[str, str]]
    agenda: list[tuple[str, str]]
    word: tuple[str, str] | None

    def to_markdown(self) -> str: ...
```

On rassemble d'abord **toutes les données** du brief dans un objet, puis on les **affiche** (la page) ou on les
**exporte** (`to_markdown`). Séparer le contenu de sa présentation permet d'ajouter un autre format (HTML, e-mail…)
sans toucher au calcul, et de tester l'export sans Streamlit.

Le bouton « Télécharger le brief (.md) » produit un fichier **Markdown** : du texte simple avec quelques signes
(`#` pour un titre, `**gras**`, `[lien](url)`), lisible partout et joliment affiché sur GitHub ou Notion.

Le temps de lecture est estimé à **220 mots par minute**, la vitesse moyenne de lecture d'un texte informatif.

---

## 5. Exercices

1. Ajoute au brief la **meilleure et la pire valeur du CAC 40** du jour (indice : `load_cac40`, étape 11).
2. Écris `to_html()` dans `Brief`, et un second bouton de téléchargement en HTML.
3. Ajoute une phrase sur la **volatilité** : « Le VIX recule à 14,8 : les marchés sont sereins. » (seuils de 15 et 30,
   voir le glossaire).
4. **Défi :** envoie-toi le brief chaque matin par e-mail avec une tâche planifiée GitHub Actions (`on: schedule`) et
   le module `smtplib` de Python.

---

## 6. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Aucun sujet ne « monte » | Peu de dépêches récentes (nuit, week-end) | Normal ; la fenêtre de 24 h et le seuil de 3 dépêches limitent le bruit. |
| Un sujet sans intérêt (« million », « three ») | Mot trop général | Ajoute-le à `_NEWS_WORDS` dans `core/analytics.py`. |
| « Spacex » au lieu de « SpaceX » | Terme affiché sous sa forme normalisée | Utilise `original_spelling`. |
| La une montre une dépêche ancienne | Fenêtre de 24 h vide pour cette rubrique | La rubrique est simplement omise ; élargis la fenêtre si besoin. |
| Le fichier téléchargé a des accents illisibles | Encodage | On encode en UTF-8 (`.encode("utf-8")`) ; ouvre-le avec un éditeur moderne (VS Code, Notepad++). |

Étape suivante : [comptes utilisateurs](14-comptes-utilisateurs.md). Retour au [sommaire du guide](README.md).
