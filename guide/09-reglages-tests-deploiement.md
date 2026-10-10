# Étape 9 — Réglages, tests, mise en ligne et présentation

> **Objectif :** finir proprement. Une page Réglages, des tests automatiques, l'application en ligne avec une
> adresse à partager, et une présentation pour ton portfolio et LinkedIn.

Fichiers créés : `views/settings.py`, `tests/` (39 tests), `pytest.ini`, `requirements-dev.txt`,
`.github/workflows/tests.yml`, `README.md`, `docs/screenshots/`. Fichiers modifiés : `core/storage.py`, `ui.py`,
`views/feed.py`, `views/favorites.py`, `views/following.py`, `views/markets.py`, `app.py`.

---

## 1. La page Réglages

Les préférences sont rangées dans la table `settings` (créée à l'étape 8) sous forme de paires clé/valeur, la valeur
en JSON pour accepter du texte, des nombres ou des listes :

```python
storage.set_setting("default_categories", ["macro", "crypto"])
storage.get_setting("page_size", 30)        # 30 = valeur par défaut si jamais réglée
```

Chaque widget enregistre sa valeur dès qu'elle change, grâce à **un seul** callback générique :

```python
def save(setting, widget_key):
    storage.set_setting(setting, st.session_state[widget_key])

st.toggle("Cacher les articles lus par défaut", value=storage.get_setting("hide_read", False),
          key="pref_hide_read", on_change=save, args=("hide_read", "pref_hide_read"))
```

Le fil relit ces préférences pour ses valeurs par défaut (`default=` des rubriques, `value=` du bouton « Cacher les
articles lus », taille des pages). Le moteur de résumé (« automatique » ou « toujours local ») y est aussi réglable.

D'autres outils utiles de cette page :

- `st.download_button` exporte les favoris en **CSV**. L'encodage `utf-8-sig` ajoute une marque invisible qui permet à
  **Excel** d'afficher correctement les accents.
- `st.popover("Réinitialiser…")` cache les actions définitives derrière un clic supplémentaire : on évite les erreurs
  de manipulation.
- `st.page_link("views/settings.py", …)` crée un lien vers une autre page de l'application (depuis la barre latérale
  du fil).

### 🐞 Une notification qui ne doit pas s'afficher n'importe quand

Streamlit avertissait : *« A fragment rerun was triggered with a callback that displays one or more elements »*. Les
boutons des articles sont dans un **fragment** (étape 5), et leur callback appelait `st.toast`. Or afficher quelque
chose depuis un callback, pendant la relance d'un fragment, n'est pas pris en charge. Correction : le callback
**range** le message (`st.session_state["fv_toast"] = message`) et la page l'**affiche** au début de sa relance
(`flush_toast()`). **Leçon :** lis aussi les avertissements, pas seulement les erreurs.

---

## 2. Les tests automatiques

Un test est un petit programme qui vérifie qu'une fonction fait ce qu'on attend. On les lance tous d'une commande,
**avant chaque modification importante**, pour vérifier qu'on n'a rien cassé ailleurs (on parle de **non-régression**).

```bash
pip install -r requirements-dev.txt
pytest
```

```
.......................................                                  [100%]
39 passed in 3.07s
```

### Anatomie d'un test

```python
def test_variation_d_un_taux_en_points_de_base():
    quote = make_quote([5.20, 5.23, 5.24], unit="pb")
    assert round(quote.change, 6) == 1.0
```

- Le nom commence par `test_` : pytest le trouve tout seul. Un nom en phrase dit ce qui est vérifié.
- `assert condition` : si la condition est fausse, le test échoue et pytest montre les valeurs en jeu.
- `round(..., 6)` : les nombres à virgule ne sont jamais exacts en informatique (`0.1 + 0.2 = 0.30000000000000004`),
  on arrondit avant de comparer.

### Les outils utilisés

| Outil | Rôle | Exemple dans `tests/` |
| --- | --- | --- |
| **Fixture** (`@pytest.fixture`) | prépare un environnement réutilisable | `db` : une base SQLite **temporaire** pour chaque test, jamais ta vraie base |
| **Fichier exemple** | des données réalistes et figées | `fixtures/sample_feed.xml`, un faux flux RSS |
| **mock** | remplace une fonction par une fausse | `mock.patch.object(sources.requests, "get", …)` : aucun appel Internet pendant les tests |
| **AppTest** | exécute l'application sans navigateur | `test_app.py` ouvre chaque page et vérifie qu'aucune erreur ne s'affiche |

Pourquoi bloquer Internet dans les tests ? Un test doit donner **le même résultat** à chaque fois. Avec de vraies
sources, il échouerait le jour où CNBC est en panne, alors que ton code est correct.

### 🐞 Ce que les tests ont trouvé

1. **Un vrai bug :** si Yahoo ne renvoie que les indices (panne partielle), la section « Devises, taux… » est vide,
   et `st.html("")` faisait planter la page Marchés. Correction : une section vide est sautée.
2. **Un faux exemple :** le premier jeu de données du test avait un historique indexé par 0, 1, 2 alors que les vrais
   cours sont indexés par des **dates**. Un test n'est utile que si ses données ressemblent aux vraies.

### Les tests à chaque push : `.github/workflows/tests.yml`

Ce fichier demande à **GitHub Actions** (gratuit) de lancer `pytest` à chaque envoi de code. Le badge vert dans ton
dépôt montre aux recruteurs que le projet est testé. Il ne s'active que lorsque `finveille/` est à la racine d'un
dépôt (section suivante).

---

## 3. Mettre le projet dans son propre dépôt

Le projet vit aujourd'hui dans le dossier `finveille/` d'un dépôt qui contient aussi autre chose. Pour ton portfolio,
il mérite **son propre dépôt**. Cette commande en extrait l'historique complet : chaque étape du guide reste un
commit, ce qui montre ta progression.

```bash
git clone https://github.com/yassine20060825-lang/site-bu.git
cd site-bu
git checkout ccr-f679736f-rs406o                 # la branche qui contient FinVeille
git subtree split --prefix=finveille -b finveille-seul
```

Puis crée un dépôt **vide** nommé `finveille` sur GitHub (bouton *New repository*, sans README) et envoie-y la
branche :

```bash
git push https://github.com/<ton-identifiant>/finveille.git finveille-seul:main
```

Ajoute une licence depuis GitHub (*Add file → Create new file → `LICENSE` → Choose a license template*, MIT par
exemple) pour indiquer ce que les autres ont le droit de faire avec ton code.

---

## 4. La mise en ligne sur Streamlit Community Cloud (gratuit)

1. Va sur <https://share.streamlit.io> et connecte-toi avec ton compte GitHub.
2. **Create app** → *Deploy a public app from GitHub* → choisis le dépôt `finveille`, la branche `main`, le fichier
   `app.py`. (Si l'appli est restée dans un sous-dossier, indique `finveille/app.py`.)
3. **Advanced settings** :
   - *Python version* : **3.12** (pandas 3 exige Python 3.11 ou plus) ;
   - *Secrets* : colle le contenu de ton `secrets.toml` (mêmes lignes `CLE = "valeur"`).
4. **Deploy.** Quelques minutes plus tard, ton appli a une adresse en `….streamlit.app` à mettre sur ton CV.

Chaque `git push` sur `main` met l'appli à jour automatiquement.

### Ce qui change une fois en ligne (à savoir avant d'en parler en entretien)

| Point | Conséquence | Que faire |
| --- | --- | --- |
| **Stockage éphémère** | le fichier `data/finveille.db` est effacé quand le serveur redémarre (mise à jour, mise en veille) | Acceptable pour une démo. Pour un vrai usage : une base hébergée gratuite (Supabase, Neon, Turso) via `st.connection`. |
| **Base partagée** | tous les visiteurs voient les **mêmes** favoris et suivis | Restreins l'appli à ton adresse e-mail (*Settings → Sharing*), ou ajoute une connexion avec `st.login`. |
| **Mise en veille** | sans visite pendant un moment, l'appli s'endort ; la visite suivante la réveille (quelques dizaines de secondes) | Normal en gratuit. |
| **NewsAPI** | l'offre gratuite est réservée au **développement** | En ligne, laisse sa clé vide : les autres sources suffisent. |
| **Collecte 24 h/24** | l'appli ne collecte que lorsqu'elle est ouverte | Piste : un script lancé chaque heure par GitHub Actions (`on: schedule`) qui enregistre les articles dans une base hébergée. |

---

## 5. Le portfolio : ton README

`README.md` (à la racine du projet) est la **page d'accueil** de ton dépôt. Un recruteur y passe 30 secondes : il doit
comprendre **quoi**, **pourquoi c'est bien fait** et **comment le lancer**. Sa structure :

1. une phrase qui dit ce que fait l'application ;
2. une capture d'écran **immédiatement** (les images sont dans `docs/screenshots/`) ;
3. les fonctionnalités en tableau ;
4. l'architecture et les choix techniques (c'est là que tu te distingues d'un tutoriel recopié) ;
5. comment lancer le projet en 5 commandes ;
6. les limites connues : montrer qu'on les connaît est une marque de maturité.

Conseils :

- **Ajoute le lien de l'appli en ligne** tout en haut du README dès qu'elle est déployée.
- Enregistre une **courte vidéo** (20–30 s) de navigation et convertis-la en GIF pour le README.
- **Épingle** le dépôt sur ton profil GitHub (*Customize your pins*).
- Sois prêt à expliquer en entretien : le parallélisme (étape 4), le cache et les quotas, la séparation `core/` /
  interface, le choix des couleurs accessibles, les limites du lexique de tonalité.

---

## 6. Le post LinkedIn

Une proposition à adapter avec **tes** mots (un recruteur repère vite un texte trop lisse). Remplace les crochets.

> 📰 J'ai construit FinVeille, ma propre application de veille financière.
>
> Étudiant en finance, je passais chaque matin d'un site à l'autre pour suivre les marchés. J'ai donc décidé
> d'apprendre à coder en construisant l'outil dont j'avais besoin.
>
> Ce qu'elle fait :
> → rassemble en continu l'actualité de 12 médias et 4 API financières (CNBC, BBC, Le Monde, BFM Bourse, la Fed,
> la BCE…) et la classe par rubrique : marchés, entreprises, macro, crypto ;
> → suit les entreprises qui m'intéressent, avec leur cours et leurs indicateurs clés (PER, VE/EBITDA, ROE…) ;
> → affiche un tableau de bord des marchés mondiaux et de la tonalité de l'actualité ;
> → résume chaque article en trois points grâce à l'IA.
>
> Ce que j'ai appris en chemin :
> • Python, les API REST et le JSON, SQL avec SQLite ;
> • nettoyer des données réelles (souvent sales !) et gérer les quotas des API gratuites ;
> • écrire des tests automatiques… qui m'ont fait découvrir de vrais bugs ;
> • qu'un bon design repose sur la retenue et l'accessibilité : mes couleurs sont vérifiées pour le daltonisme.
>
> Tout est construit avec des outils gratuits (Python, Streamlit, yfinance) et documenté étape par étape.
>
> 🔗 Démo : [lien de l'appli]
> 💻 Code : [lien GitHub]
>
> Je suis preneur de vos retours, et curieux de savoir comment vous faites votre veille !
>
> #Finance #Python #DataAnalysis #Fintech #Streamlit #ProjetEtudiant

**Variante courte** (pour la section *Projets* du profil) :

> FinVeille : application web de veille financière (Python, Streamlit, SQLite). Agrège 12 flux d'actualité et
> 4 API, suit des entreprises (cours, PER, ROE…), tableaux de bord des marchés et de la tonalité de l'actualité,
> résumés d'articles par IA. Tests automatisés, thème clair/sombre, accessible.

Conseils de publication : joins **2 ou 3 captures** (ou la vidéo), publie en semaine en début de matinée, et réponds
aux commentaires dans la journée.

---

## 7. Pour aller plus loin

- **Alertes** : un e-mail quand une entreprise suivie bouge de plus de 3 % ou est citée dans une dépêche.
- **Calendrier économique** : dates des réunions de la BCE et de la Fed, publications d'inflation et d'emploi.
- **Portefeuille** : saisir ses positions et suivre la performance par rapport à un indice.
- **Analyse** : corréler la tonalité de l'actualité et les rendements du lendemain (un bon sujet de mémoire !).
- **Modèle de classification** : remplacer les mots-clés par un modèle entraîné (scikit-learn) sur des articles
  étiquetés à la main.

---

## 8. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| `pytest: command not found` | Outils de dev non installés | `pip install -r requirements-dev.txt`, ou `python -m pytest`. |
| `ModuleNotFoundError: No module named 'core'` pendant les tests | pytest lancé hors du dossier `finveille/` | Lance `pytest` depuis `finveille/` (c'est `pytest.ini` qui ajoute la racine au chemin). |
| Un test échoue après une modification | La modification a changé un comportement | Lis le message : soit c'est un bug à corriger, soit le comportement a changé exprès et le test doit être mis à jour. |
| Déploiement : `ModuleNotFoundError` dans les journaux | Dépendance absente de `requirements.txt` | Toute bibliothèque importée doit y figurer. |
| Déploiement : `ERROR: … requires a different Python` | Python trop ancien | Choisis Python 3.12 dans *Advanced settings* (supprime et recrée l'appli si besoin). |
| Les API sont « inactives » en ligne | Secrets non renseignés sur l'hébergeur | *Settings → Secrets* de l'appli Streamlit Cloud. |
| En ligne, mes favoris ont disparu | Stockage éphémère | Normal en gratuit (section 4). |
| `git subtree split` : `fatal: … is not a valid prefix` | Mauvais nom de dossier ou de branche | Vérifie que tu es sur la branche qui contient `finveille/` (`git branch`, `ls`). |

🎉 **Bravo, tu as construit une vraie application de bout en bout.** Le mémo [debogage.md](debogage.md) regroupe
toutes les erreurs rencontrées dans le guide.
