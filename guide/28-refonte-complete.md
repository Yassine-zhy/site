# Étape 28 — Tout le site au même niveau : composants, audit, graphiques

> **Objectif :** après les pages principales (étape 27), plus aucun recoin « Streamlit par défaut » : les mêmes
> boutons, champs, sélecteurs et graphiques partout, un en-tête soigné sur chaque page, et une accessibilité
> **mesurée par un outil**, pas estimée à l'œil.

Fichiers créés : `tools/ux_audit.py`, ce guide. Fichiers modifiés : `theme.py`, `ui.py`, `app.py`, toutes les
pages de `views/`, `tests/test_app.py`, `tests/test_market_theme.py`, `guide/27-pages-principales.md`, `README.md`.

---

## 1. Le diagnostic : captures et mesures

Deux sources, comme pour l'étape 26 :

- **les captures** de chaque page, en clair et en sombre : les pages secondaires (Portefeuille, Alertes, Glossaire,
  Réglages…) gardaient un titre nu, et les sélecteurs, champs et graphiques avaient l'allure par défaut ;
- **un audit automatique** (§ 5) des 17 pages : 76 alertes de contraste (dont une vingtaine de faux positifs,
  voir § 5), 9 liens sans nom pour les lecteurs d'écran, 617 commandes de moins de 44 px sur téléphone.

---

## 2. Une couche de composants

Les jetons de l'étape 26 avaient trois couches ; la troisième (composants) s'enrichit :

```css
--control-bg: var(--fv-surface); --control-border: var(--fv-line-strong); --control-radius: var(--radius-md);
--ring: 0 0 0 3px color-mix(in srgb, var(--fv-brand) 26%, transparent);   /* le halo du focus */
```

Chaque type de commande les utilise, avec les mêmes états partout :

| Composant | Repos | Survol | Appui | Focus clavier |
| --- | --- | --- | --- | --- |
| Bouton secondaire | surface, bordure | bordure et texte de marque | `scale(.98)` | contour de marque 2 px |
| Bouton principal | dégradé de marque | plus lumineux | `scale(.98)` | contour de marque 2 px |
| Champ, liste | surface, bordure | — | — | bordure de marque + halo |
| Sélecteur segmenté | rail en creux | texte qui fonce | — | contour |
| Pastille | surface, bordure | bordure de marque | — | contour |

L'appui utilise `transform: scale(.98)` : le bouton s'enfonce sans **déplacer** ce qui l'entoure.

### Le piège : les noms internes de Streamlit changent

Les anciennes règles visaient `[data-testid="stBaseButton-pillsActive"]`. Streamlit 1.65 ne produit plus ces noms :
les règles ne s'appliquaient plus du tout, sans aucune erreur. On a regardé la page réelle (outil de
développement du navigateur, ou Playwright) avant d'écrire le CSS :

```css
.stApp [data-variant="segmented_control"][aria-checked="true"] { … }   /* le choix actif du sélecteur */
.stApp [data-variant="pills"][aria-pressed="true"] { … }               /* une pastille sélectionnée */
```

Les attributs `aria-checked` / `aria-pressed` sont un bon point d'appui : ils décrivent l'état réel (celui que
lisent les lecteurs d'écran) et changent rarement.

---

## 3. Un en-tête pour chaque page

Toutes les pages reçoivent l'en-tête « héros » de l'étape 27, avec leur formule en dégradé :

| Page | Titre |
| --- | --- |
| Portefeuille | Ton portefeuille, *sans risquer un euro.* |
| Alertes | Tes alertes, *sans surveiller l'écran.* |
| Favoris | Tes favoris, *à lire plus tard.* |
| Mes suivis | Tes suivis, *en un seul fil.* |
| Simulateurs | Simulateurs *d'épargne et de crédit.* |
| Quiz | Teste ton vocabulaire *de la finance.* |
| Glossaire | La finance, *expliquée simplement.* |
| Réglages | Ton FinVeille, *à ta façon.* |
| Compte | Ton compte, *tes données.* |

Les **chiffres clés** prennent le style des tuiles de la marque (voile de couleur, liseré dégradé en haut, valeur
plus grande) et les **titres de section** grandissent (1,3 rem, graisse 700).

**Le plan des titres** ne saute plus de niveau : titre de page `h1`, sections `h2`, articles et titres de cartes
`h3`. Un lecteur d'écran s'en sert pour naviguer de section en section.

---

## 4. Le pied de page qui disparaissait

Sur le Quiz et sur les pages qui demandent une connexion, le pied de page manquait. La cause : `st.stop()`.
Après lui, Streamlit n'affiche **plus rien**, même dans un bloc `finally`. La solution : une exception à nous.

```python
# ui.py
class PageEnd(Exception): ...
def end_page():
    raise PageEnd

# app.py
try:
    page.run()
except PageEnd:      # la page s'est arrêtée tôt : rien à signaler
    pass
theme.footer()
```

Les pages appellent `end_page()` là où elles appelaient `st.stop()`. Un test vérifie que le pied de page est bien
là sur le Quiz et sur chaque page qui demande une connexion.

---

## 5. L'audit automatique : `tools/ux_audit.py`

L'outil ouvre chaque page dans un vrai navigateur (Playwright) et mesure :

| Mesure | Règle |
| --- | --- |
| Contraste de chaque texte | 4,5:1 (3:1 pour un grand texte), **opacités comprises** |
| Boutons et liens sans nom | un lecteur d'écran doit pouvoir les annoncer |
| Images sans `alt` | texte de remplacement obligatoire (vide si décorative) |
| Défilement horizontal | la page ne doit jamais déborder |
| Commandes sur téléphone | au moins 44 px de haut |

```bash
streamlit run app.py                                   # dans un premier terminal
python tools/ux_audit.py                               # sombre, ordinateur
python tools/ux_audit.py --theme light --mobile --json rapport.json
```

**Ce qu'il a trouvé, et la correction :**

| Constat | Correction |
| --- | --- |
| Légendes (`st.caption`) à 2,5:1 : Streamlit les pâlit à 60 % d'opacité | `opacity: 1`, couleur secondaire (5,7 à 7,3:1) |
| Boutons d'action du fil pâlis (étape 27) à 3,0:1 | pâlissement retiré |
| Choix actif des sélecteurs à 4,2:1 en sombre | texte à la couleur du texte, sur un segment en relief |
| Valeur au-dessus des curseurs à 4,2:1 en sombre | bleu de la marque (6,5:1) |
| Code dans le texte vert sur gris (4,3:1) | couleur du texte sur fond gris |
| Liens des photos sans nom (doublon du titre) | `aria-hidden="true"` et `tabindex="-1"` |
| 617 commandes de moins de 44 px sur téléphone | `@media (pointer: coarse)` : 44 px pour boutons, champs, menus, liens |
| Bandeau des cours qui défile sans pause au clavier | pause aussi au focus et au doigt posé |

**Résultat :** 0 point à vérifier sur ordinateur, en clair comme en sombre. Sur téléphone, l'outil signale encore
les titres d'articles, que la norme accepte : chacun a son bouton « Lire » de 44 px qui fait la même chose
(exception du « contrôle équivalent », WCAG 2.5.8) ; et quelques liens des listes du brief et de la page Crypto,
à 42 px, à agrandir (exercice 4).

**Ses limites, écrites dans l'outil :** le texte des graphiques (SVG, dont la couleur vient de `fill`) et les
étiquettes des curseurs sont écartés, car l'outil ne peut pas mesurer leur vrai fond. Les liens au fil d'une phrase
sont acceptés (autre exception de la norme). Chaque alerte se vérifie à l'œil avant d'être corrigée.

---

## 6. Les graphiques, avec une méthode

Les couleurs des graphiques étaient écrites page par page (`"#3987e5"` ici, `BLUE` là). Elles suivent maintenant
une méthode en quatre points.

**1. Une palette validée par le calcul, pas à l'œil.** Le script de validation mesure, pour les 4 couleurs des
séries, la séparation pour les daltoniens (ΔE 8,4, cible 8), la séparation en vision normale (ΔE 19,8, plancher
15) et le contraste sur les deux fonds de carte (au moins 3:1). Elles vivent dans `theme.SERIES_COLORS`, en ordre
fixe : la couleur suit l'entreprise ou la zone, jamais son rang. La série de comparaison (CAC 40, sommes versées)
est en gris : `theme.REFERENCE`.

**2. Le texte reste à la couleur du texte.** Une étiquette n'est jamais de la couleur de sa série : un point coloré
porte l'identité, le texte est à l'encre. Dans un graphique, `light-dark()` n'existe pas : `theme.chart_mode()` lit
le thème signalé par le navigateur (`st.context.theme`) et `theme.chart_ink()` donne l'encre qui va avec.

**3. Des étiquettes directes au bout des courbes**, en plus de la légende : « TotalEnergies 161 »,
« Mon portefeuille 100 ». Deux courbes qui finissent proches donneraient des étiquettes l'une sur l'autre :
`theme.end_labels` les écarte d'au moins 8 % de la hauteur, le point restant sur sa courbe.

```python
positions = []
for value in sorted(last_values):
    positions.append(max(value, positions[-1] + gap) if positions else value)
```

**4. Des formes nettes.** Traits de 2 px ; au survol, un point sur chaque courbe à la date visée ; les segments
empilés (crédit) séparés par 2 px de la couleur du fond ; et sous une courbe seule (cours d'une entreprise,
indice « peur et avidité », inflation), le voile dégradé des mini-courbes de la marque.

Et une correction de sens : sur la frontière efficiente, les deux portefeuilles remarquables étaient de la même
couleur que la 4ᵉ entreprise. **Une couleur, un sens** : la frontière et ces portefeuilles passent à l'encre.

---

## 7. Exercices

1. Ajoute à `tools/ux_audit.py` une mesure de l'ordre des titres (aucun `h3` avant le premier `h2`).
2. Donne à la carte du CAC 40 une version « daltonien » : des motifs en plus des couleurs pour hausse et baisse.
3. Ajoute une vue « tableau » sous un graphique qui n'en a pas (une section repliable avec les données).
4. Porte les liens des listes du brief et de la page Crypto à 44 px sur téléphone, puis relance l'audit.

---

## 8. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Une règle CSS sur un composant Streamlit ne fait plus rien | Les `data-testid` internes ont changé avec la version | Inspecter la page réelle ; préférer `aria-checked`, `aria-pressed`, `role`. |
| Le pied de page manque sur une page | `st.stop()` : plus rien ne s'affiche après | `ui.end_page()` (§ 4). |
| Le voile sous une courbe fait partir l'axe de zéro | Une aire s'empile depuis zéro par défaut | `stack=None` sur l'axe vertical, et `y2=alt.value("height")`. |
| La légende montre un rond pour une courbe en pointillés | Symbole de légende rond pour tout le site | `symbolType="stroke"` sur cette légende. |
| Les étiquettes d'un graphique gardent l'ancien thème | `st.context.theme` change à la prochaine exécution | Une action ou un rechargement les remet à jour. |
| Une alerte de l'audit ne se reproduit pas | Élément en cours de rafraîchissement (Streamlit l'estompe) | Relancer ; seule une alerte qui revient se corrige. |

Étape suivante : [une direction artistique](29-direction-artistique.md). Retour au [sommaire du guide](README.md).
