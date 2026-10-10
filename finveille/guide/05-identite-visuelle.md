# Étape 5 — Une identité visuelle originale (clair / sombre)

> **Objectif :** que FinVeille ait l'air d'un vrai produit, avec **sa** personnalité, et pas d'une démo Streamlit ou
> d'un site « généré par IA ». Au passage : mode clair/sombre soigné, mise à jour automatique de la page, et
> premières règles d'accessibilité.

Fichiers créés : `theme.py`, `.streamlit/config.toml`. Fichiers modifiés : `ui.py`, `views/feed.py`,
`views/favorites.py`, `app.py`, `core/config.py`, `core/sources.py`.

---

## 1. Pourquoi tant de sites se ressemblent

Les interfaces générées automatiquement recyclent les mêmes recettes : dégradés violet-bleu, cartes arrondies avec
ombre portée, émojis en guise d'icônes, police Inter partout, grands titres en dégradé. Aucune n'est « fausse »,
mais ensemble elles donnent un air **générique**, sans point de vue.

Une identité originale part d'une **idée**, puis en déduit chaque choix. La nôtre :

> **FinVeille est un quotidien financier transposé à l'écran.** Le sérieux et la hiérarchie d'un journal imprimé
> (titres à empattements, filets, rubriques en petites capitales), avec les codes d'une salle de marché (horloges des
> places boursières, chiffres alignés, bandeau des cours à l'étape 6).

Ce que cette idée implique concrètement :

| Choix | Pourquoi |
| --- | --- |
| Fond **papier** (`#F4F1EA`) en clair, **ardoise** (`#111416`) en sombre | Le blanc pur fait « application » ; le papier fait « journal ». L'ardoise évite le noir pur, fatigant. |
| La couleur de marque est **l'encre** (noir sur papier, crème sur ardoise) | Un journal n'a pas besoin d'un bleu « tech ». La couleur est réservée aux **données** : elle signifie quelque chose quand elle apparaît. |
| Titres en **Newsreader** | Police à empattements dessinée pour la lecture de presse à l'écran. |
| Interface en **IBM Plex Sans**, heures et chiffres en **IBM Plex Mono** | Plex a un caractère technique (elle a été dessinée pour IBM) ; la chasse fixe aligne les heures comme sur un terminal. |
| **Filets** et double filet au lieu de cartes avec ombre | C'est la grammaire de la mise en page de presse. |
| Rubriques en **petites capitales espacées** (`À LA UNE`, `EN CONTINU`) | Idem. |
| **Logo** : trois chandeliers boursiers dessinés en CSS | Un signe propre à la finance, pas une icône de bibliothèque. |
| **Logos réels** des sources (favicons) | Repérer CNBC ou Le Monde d'un coup d'œil, comme dans un agrégateur professionnel. |
| Aucun émoji | Les émojis s'affichent différemment selon le système et font « messagerie ». Les icônes viennent de *Material Symbols*, cohérentes et sobres. |

**Exercice de regard :** ouvre les sites du *Financial Times*, du *Monde* et de *Bloomberg*. Note ce qu'ils ont en
commun (typographie, filets, densité) et ce qui les distingue. Tu verras qu'un design « pro » tient surtout à la
**retenue** et à la **cohérence**.

---

## 2. Le thème Streamlit : `.streamlit/config.toml`

Streamlit lit ce fichier au démarrage. On y décrit **deux thèmes complets** :

```toml
[theme]
font = "IBM Plex Sans:https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:..."
headingFont = "Newsreader:https://fonts.googleapis.com/css2?family=Newsreader:..."
codeFont = "IBM Plex Mono:https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:..."
baseRadius = "small"

[theme.light]
primaryColor = "#1B1A17"      # l'encre
backgroundColor = "#F4F1EA"   # papier
...

[theme.dark]
primaryColor = "#ECE6D8"
backgroundColor = "#111416"   # ardoise
...
```

- Les polices viennent de **Google Fonts**, gratuitement : le format est `"Nom:URL de la feuille de style"`.
- Quand `[theme.light]` **et** `[theme.dark]` existent, le menu ⋮ propose **Système / Clair / Sombre**. « Système »
  suit le réglage de ton ordinateur ou de ton téléphone. C'est notre mode clair/sombre, sans une ligne de Python.
- `toolbarMode = "viewer"` cache les outils de développement (bouton *Deploy*) pour les visiteurs.

---

## 3. La couleur : une décision vérifiée, pas un goût

### Le piège du thème qui change sans prévenir

On a testé (avec un navigateur automatisé) ce qui se passe quand on change de thème dans le menu : Streamlit change
les couleurs **immédiatement**, mais **ne relance pas** le script Python. Conséquence : on ne peut pas choisir nos
couleurs en Python selon le thème (`st.context.theme.type` resterait sur l'ancienne valeur jusqu'au clic suivant).

Deux solutions combinées :

1. **Les gris sont calculés à partir de la couleur du texte**, en CSS :
   ```css
   --fv-muted: color-mix(in srgb, currentColor 66%, transparent);   /* texte secondaire */
   --fv-rule: color-mix(in srgb, currentColor 15%, transparent);    /* filets */
   ```
   `currentColor` = la couleur du texte courant (encre sur papier, crème sur ardoise). Mélangée avec du transparent,
   elle donne un gris **adapté aux deux thèmes automatiquement**.
2. **Les couleurs de données sont choisies pour fonctionner sur les deux fonds.**

### Choisir des couleurs lisibles par tous

Environ **1 homme sur 12** a une forme de daltonisme (souvent rouge-vert). On a vérifié les couleurs avec un outil qui
simule ces visions et mesure la distance entre couleurs (ΔE) et le contraste avec le fond :

| Rôle | Couleur | Remarque |
| --- | --- | --- |
| Marchés | `#3987e5` bleu | |
| Crypto | `#d95926` orange | |
| Entreprises | `#199e70` sarcelle | |
| Macro | `#c98500` ocre | contraste un peu faible sur papier → toujours accompagné de son nom |
| Hausse | `#008300` vert | toujours avec **▲** et le signe **+** |
| Baisse | `#e34948` rouge | toujours avec **▼** et le signe **−** |

Le vert et le rouge « classiques » de la Bourse se confondent pour un daltonien deutéranope (ΔE = 5,9, sous le seuil
de 6). La paire retenue atteint 7,2 : acceptable **à condition** d'ajouter un second indice (flèche + signe).

**Règles qui en découlent :**

- une couleur ne porte **jamais** l'information seule (carré de couleur **+** nom de la rubrique) ;
- le **texte** reste à l'encre ; la couleur est sur une petite marque à côté (carré, barre, triangle).

---

## 4. `theme.py` : la feuille de style et les blocs réutilisables

### Injecter du CSS

```python
def inject_css() -> None:
    st.html(CSS)   # CSS = "<style> … </style>"
```

Appelée **une fois** dans `app.py`, avant la navigation : toutes les pages en profitent. Un `st.html` qui ne contient
qu'une balise `<style>` ne prend aucune place à l'écran.

### Les variables CSS (« jetons de design »)

```css
.stApp {
  --fv-serif: "Newsreader", Georgia, "Times New Roman", serif;
  --fv-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
  --fv-up: #008300;
  --fv-down: #e34948;
  ...
}
.fv-headline { font-family: var(--fv-serif); }
```

Une **variable CSS** (`--nom`) se définit une fois et s'utilise partout avec `var(--nom)`. Pour changer la police des
titres, on ne modifie qu'**une** ligne. Les polices de secours (`Georgia, …, serif`) s'affichent si Google Fonts ne
répond pas.

### Cibler un bloc Streamlit précis

```python
with st.container(key=f"fvcard_{key}"):
    ...
```

Quand un conteneur a une `key`, Streamlit lui ajoute la classe CSS `st-key-fvcard_…`. On peut donc le styler :

```css
[class*="st-key-fvcard_"] { padding: .55rem 0 .35rem; border-bottom: 1px solid var(--fv-rule); }
```

`[class*="…"]` signifie « tout élément dont la classe **contient** ce texte ». C'est une méthode documentée par
Streamlit, donc stable d'une version à l'autre.

> ⚠️ La règle `[data-testid="stMainBlockContainer"]` (largeur maximale de la page) cible, elle, un détail **interne**
> de Streamlit. Elle peut cesser de fonctionner après une mise à jour : si la mise en page change brusquement après
> un `pip install --upgrade streamlit`, regarde ici en premier.

### Construire du HTML sans faille de sécurité

Les titres d'articles viennent de sites extérieurs. Si un titre contenait `<img src=x onerror=alert(1)>` et qu'on
l'insérait tel quel dans la page, le navigateur l'exécuterait : c'est une faille **XSS** (*cross-site scripting*).
D'où deux fonctions utilisées **systématiquement** :

```python
def esc(text):
    return html.escape(text or "", quote=True)        # < devient &lt;, " devient &quot;…

def safe_url(url):
    return esc(url) if url and url.startswith(("http://", "https://")) else "#"
```

`safe_url` refuse les liens `javascript:…`, qui exécuteraient du code au clic. (Streamlit nettoie aussi le HTML de
`st.html`, mais en sécurité on ne compte jamais sur une seule protection.)

### Les logos des sources

```python
def favicon_url(url):
    domain = urlparse(url).netloc.removeprefix("www.")
    return f"https://www.google.com/s2/favicons?domain={esc(domain)}&sz=64"
```

`urlparse` découpe une URL (`https://www.cnbc.com/2026/…` → `netloc = "www.cnbc.com"`). Le service public de Google
renvoie le petit logo du site. C'est le navigateur du visiteur qui le télécharge, pas notre serveur.

### Le français sans `locale`

```python
_DAYS = ["lundi", "mardi", …]
def fr_date(moment):
    return f"{_DAYS[moment.weekday()]} {moment.day} {_MONTHS[moment.month - 1]} {moment.year}"
```

On pourrait demander à Python d'écrire les dates en français avec `locale.setlocale(...)`, mais cela dépend de la
configuration de l'ordinateur (et plante souvent sur les serveurs). Deux listes de mots, et le problème disparaît.

Pour les nombres, `fr_number(8012.34)` donne `8 012,34` : on formate à l'anglaise (`8,012.34`) puis on échange les
séparateurs. L'espace utilisée est une **espace fine insécable** (` `), la norme typographique française : le
nombre ne sera jamais coupé en fin de ligne.

### Les horloges des places boursières

```python
EXCHANGES = [("Tokyo", "Asia/Tokyo", time(9, 0), time(15, 30)), ...]

def exchange_status(now):
    for city, zone, opens, closes in EXCHANGES:
        local = now.astimezone(ZoneInfo(zone))
        is_open = local.weekday() < 5 and opens <= local.time() < closes
```

On convertit l'heure UTC dans le fuseau de chaque place, puis on vérifie « jour de semaine **et** dans les horaires ».
`opens <= x < closes` est une **comparaison chaînée** propre à Python. Limites assumées (écrites en commentaire) :
jours fériés et pause déjeuner de Hong Kong non gérés.

À l'écran, une séance ouverte a un **disque plein** et le mot « ouverte », une séance fermée un **cercle vide** et
« fermée » : forme + texte, aucune dépendance à la couleur.

---

## 5. La mise en page du fil

### Deux colonnes qui deviennent une seule sur mobile

```python
main, rail = st.columns([2.2, 1], gap="large")
```

Sur ordinateur, le fil occupe ~70 % de la largeur, la colonne « Le fil en chiffres » le reste. Sous 640 pixels de
large, Streamlit **empile** automatiquement les colonnes : la colonne de droite passe sous le fil.

Pour la une, c'est du CSS qui gère l'adaptation :

```css
.fv-lead.has-img { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
@media (max-width: 760px) {
  .fv-lead.has-img { grid-template-columns: 1fr; }
  .fv-lead figure { order: -1; }          /* sur mobile, la photo passe au-dessus du titre */
}
```

Une **media query** (`@media (max-width: 760px)`) applique des règles seulement sur les écrans étroits. C'est la base
du *responsive design*.

### « À la une »

```python
lead = next((a for a in filtered[:6] if a.image), filtered[0])
```

`next(générateur, défaut)` renvoie le **premier** élément qui satisfait la condition (le plus récent article avec une
photo parmi les 6 premiers), ou la valeur par défaut s'il n'y en a aucun.

### La colonne « Le fil en chiffres »

Un mini-graphique en barres fait en HTML/CSS : la largeur de chaque barre est la part de la rubrique par rapport à la
plus grande (`width: 40%`). Chaque barre a son **nom** et sa **valeur** écrits à côté, et un `title` qui affiche le
détail au survol (« Macro : 106 dépêches (40 %) »).

---

## 6. La page se met à jour toute seule

```python
@st.fragment(run_every="5min")
def body(query, categories, sources, hide_read, show_hidden):
    current, _, collected = load_articles(keys)
    ...
```

Un **fragment** est une partie de la page que Streamlit peut relancer **seule**, sans recharger le reste. Avec
`run_every="5min"`, il se relance toutes les 5 minutes tant que la page est ouverte.

Le fragment appelle `load_articles`, qui garde ses données 15 minutes en cache : la page **vérifie** les nouveautés
toutes les 5 minutes, et les sources sont **réellement interrogées** au plus toutes les 15 minutes (pour respecter
les quotas des API, voir l'étape 4).

Le bandeau du haut est un second fragment, relancé chaque minute (`run_every="1min"`) pour que les horloges des
places boursières restent à l'heure.

Bonus : les boutons placés **dans** un fragment ne relancent que ce fragment. Cliquer sur « Garder » est donc plus
rapide qu'avant.

**Limite :** une fois l'appli en ligne gratuitement, elle se met en veille sans visiteur. La collecte reprend à la
visite suivante. Pour collecter 24 h/24, il faudrait une tâche planifiée séparée (voir l'étape 9).

---

## 7. Exercices

1. Change l'identité : remplace Newsreader par une autre police à empattements de Google Fonts (par exemple
   *Source Serif 4* ou *Literata*) dans `config.toml` **et** dans `--fv-serif`. Qu'est-ce que ça change à l'ambiance ?
2. Ajoute Francfort (`Europe/Berlin`, 9:00–17:30) aux horloges.
3. Dans les outils de développement du navigateur (F12 → *Elements*), trouve un article et modifie en direct la
   taille de `.fv-headline`. C'est la meilleure façon d'expérimenter le CSS.

---

## 8. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Les polices restent celles de Streamlit | Pas d'accès à Google Fonts (réseau filtré), ou faute de frappe dans l'URL | Ouvre l'URL de la police dans le navigateur : elle doit afficher du CSS. |
| `"theme.light.xxx" is not a valid config option` dans le terminal | Option inconnue de ta version de Streamlit | Supprime la ligne ou mets Streamlit à jour (`pip install -U streamlit`). |
| Le menu ne propose pas Clair/Sombre | `[theme.light]` ou `[theme.dark]` manquant | Les deux sections doivent exister. Redémarre Streamlit après avoir modifié `config.toml`. |
| Mes styles CSS ne s'appliquent pas | Le sélecteur ne correspond à rien, ou une règle de Streamlit est plus prioritaire | F12 → *Elements* → clique sur l'élément : le panneau *Styles* montre quelles règles s'appliquent et lesquelles sont barrées. En dernier recours, `!important`. |
| Le HTML s'affiche comme du texte (`<div class=…>`) | Utilisation de `st.write` ou `st.markdown` sans `unsafe_allow_html` | Utilise `st.html(...)`. |
| Un dessin `<svg>` disparaît dans `st.html` | Streamlit retire le SVG intégré par sécurité | Encode le SVG en image (`<img src="data:image/svg+xml;base64,…">`), comme les mini-courbes de l'étape 6. |
| Un titre d'article casse la mise en page | Caractères `<`, `>` ou `"` non échappés | Passe **tout** texte extérieur dans `esc()`. |
| Le haut de la page est caché sous la barre de navigation | Marge supérieure trop petite | Augmente `padding-top` de `stMainBlockContainer` dans `theme.CSS`. |
| La page « clignote » toutes les 5 minutes | C'est le fragment qui se relance | Normal et rapide. Pour désactiver : retire `run_every`. |

➡️ Étape suivante : [marchés et tableaux de bord](06-marches-et-tableaux-de-bord.md).
