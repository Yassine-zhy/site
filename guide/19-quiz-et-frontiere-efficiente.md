# Étape 19 — Le quiz de la finance et la frontière efficiente

> **Objectif :** deux outils pour apprendre en jouant. Un **quiz** tiré du glossaire (une définition, quatre
> propositions, meilleur score enregistré dans le compte), et la **frontière efficiente** de Markowitz dans le
> comparateur : comment répartir son argent entre plusieurs actions pour le meilleur couple risque / rendement.

Fichiers créés : `core/quiz.py`, `views/quiz.py`, `tests/test_quiz.py`, ce guide. Fichiers modifiés :
`core/metrics.py`, `views/compare.py`, `theme.py`, `app.py`, `tests/`.

---

## 1. Le quiz

### Fabriquer une question

```python
def make_question(answer, rng, glossary=GLOSSARY):
    section, definition = glossary[answer]
    same = sorted(t for t, (s, _) in glossary.items() if s == section and t != answer)
    distractors = rng.sample(same, 3)          # 3 pièges de la MÊME rubrique : plus difficile
    choices = distractors + [answer]
    rng.shuffle(choices)                        # la bonne réponse n'est pas toujours à la même place
    return Question(mask(definition, answer), choices, answer, section)
```

- Les **pièges** viennent de la même rubrique : confondre « PER » et « VE/EBITDA » est plus instructif que
  confondre « PER » et « Bitcoin ».
- `mask` cache le terme s'il apparaît dans sa propre définition (« Le **VIX** mesure… » → « Le **…** mesure… »).
  Un test vérifie les 55 termes un par un.
- `random.Random(seed)` : un générateur de hasard **avec graine**. La même graine redonne exactement le même quiz,
  ce qui rend les tests possibles. L'application tire une graine au hasard à chaque partie.

### Le déroulé avec `st.session_state`

Une partie dure plusieurs relances du script : on garde l'état dans `st.session_state` (le quiz, le numéro de la
question, les réponses données). Chaque bouton appelle une petite fonction (callback) :

```python
st.button(choice, on_click=answer, args=(choice,))       # enregistre la réponse
st.button("Question suivante", on_click=next_question)   # avance ; à la fin, enregistre le meilleur score
```

Après la réponse, la bonne proposition s'affiche en vert avec ✓, la mauvaise en rouge avec ✗ : jamais la couleur
seule. Le meilleur score et le nombre de parties sont des **préférences** du compte (`storage.set_setting`, étape
14) : chaque utilisateur a les siens.

---

## 2. La frontière efficiente (Harry Markowitz, prix Nobel 1990)

### L'idée

Deux actions qui ne montent et ne baissent pas en même temps (corrélation faible) se **compensent** : un portefeuille
qui mélange les deux est **moins risqué** que chacune prise seule. Parmi toutes les répartitions possibles, certaines
sont « efficientes » : pour un niveau de risque donné, aucune autre ne rapporte plus. Elles forment une courbe, la
**frontière efficiente**.

### Le calcul, avec NumPy

On tire 4 000 répartitions au hasard (des poids positifs dont la somme vaut 1, grâce à la loi de Dirichlet), et pour
chacune :

```
rendement attendu = Σ poids × rendement moyen de chaque action          (wᵀ μ)
volatilité        = √(Σ Σ poids_i × poids_j × covariance_ij)             (√(wᵀ Σ w))
ratio de Sharpe   = (rendement − taux sans risque) ÷ volatilité
```

```python
weights = rng.dirichlet(np.ones(n), size=4000)                         # 4 000 lignes de n poids
expected = weights @ mean * 100                                         # @ : produit matriciel
volatility = np.sqrt(np.einsum("ij,jk,ik->i", weights, cov, weights)) * 100
```

`einsum` calcule `wᵀ Σ w` pour les 4 000 lignes d'un coup, sans boucle Python : c'est instantané.

### Les deux portefeuilles remarquables

- **Variance minimale** (le losange) : le moins risqué de tous. Le test vérifie qu'il est **moins volatil que
  l'action la plus sûre** : c'est la diversification.
- **Sharpe maximal** (le triangle) : celui qui rémunère le mieux chaque unité de risque prise.

### Les limites (à dire en entretien)

- Le rendement attendu est la **moyenne passée** : la méthode suppose que le passé se répète, ce qui est faux.
  De petites erreurs d'estimation changent beaucoup les poids « optimaux ».
- Quand toutes les actions ont baissé sur la période, le ratio de Sharpe est négatif partout : la page le signale,
  le « meilleur » portefeuille n'est que le moins mauvais.
- Pas de vente à découvert (poids entre 0 et 1), pas de frais, pas de rééquilibrage.

---

## 3. Exercices

1. Quiz : ajoute un mode « chrono » (10 secondes par question, `st.fragment(run_every="1s")`).
2. Quiz : propose à la fin de suivre les termes ratés dans le glossaire (lien vers la page avec une recherche).
3. Frontière : ajoute le CAC 40 (`^FCHI`) comme point de repère sur le graphique.
4. **Défi :** remplace le tirage au hasard par une vraie optimisation (`scipy.optimize.minimize` sous la contrainte
   « somme des poids = 1 ») et compare les résultats.

---

## 4. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Le terme à trouver apparaît dans la définition | Il n'est pas masqué | `quiz.mask`, avec `\b` (limites de mot) et sans tenir compte des majuscules. |
| Le quiz recommence à chaque clic | État stocké dans une variable ordinaire | Utilise `st.session_state`. |
| `ValueError: Sample larger than population` | Moins de 3 termes dans la rubrique | Compléter avec des termes d'autres rubriques. |
| Le nuage change à chaque affichage | Hasard sans graine | `np.random.default_rng(seed)`. |
| `ValueError: shapes not aligned` | Poids et rendements dans un ordre différent | Construis les deux à partir des mêmes colonnes du tableau. |

Étape suivante : [une base de données en ligne](20-base-de-donnees-en-ligne.md). Retour au [sommaire du guide](README.md).
