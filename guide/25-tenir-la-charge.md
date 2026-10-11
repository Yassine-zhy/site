# Étape 25 — Tenir la charge : beaucoup de visiteurs, sans crash

> **Objectif :** que FinVeille reste rapide et ne tombe pas quand des dizaines ou des centaines de personnes
> l'ouvrent en même temps (un post LinkedIn qui marche, une classe entière en cours). On **mesure** d'abord, on
> trouve la **vraie** cause, on corrige, on **re-mesure**. Puis on prépare un hébergement gratuit plus puissant.

Fichiers créés : `core/capacity.py`, `tools/load_test.py`, `Dockerfile`, `.dockerignore`, `deploy/entrypoint.sh`,
`deploy/huggingface-README.md`, `deploy/publish_space.py`, `.github/workflows/huggingface.yml`,
`tests/test_capacity.py`, `tests/test_deploy.py`, ce guide. Fichiers
modifiés : `.streamlit/config.toml`, `app.py`, `ui.py`, `views/feed.py`, `views/brief.py`, `views/setup.py`,
`views/settings.py`, `core/storage.py`, `core/accounts.py`, `core/assistant.py`, `tests/test_app.py`.

---

## 1. Comment Streamlit sert ses visiteurs

```
 navigateur 1 ─┐                        ┌─ fil d'exécution : script de la page du visiteur 1
 navigateur 2 ─┼── WebSocket ── boucle ─┼─ fil d'exécution : script de la page du visiteur 2
 navigateur 3 ─┘   (connexion   principale ─ fil d'exécution : …
                    permanente)  (« event loop » : reçoit les clics, envoie les pages, répond aux « pings »)
                       └──────────── un seul processus Python ────────────┘
```

Deux faits à retenir :

1. Chaque visiteur relance le script de sa page à chaque clic, dans son propre **fil d'exécution** (thread).
2. Python n'exécute qu'**un fil à la fois** (le verrou global, ou *GIL*) : 100 scripts « en même temps » se
   partagent un seul cœur de processeur. Et la **boucle principale**, qui parle aux navigateurs, attend son tour
   comme les autres. Si elle ne répond plus aux signaux de vie (*pings*) pendant 30 secondes, les connexions sont
   coupées : pour le visiteur, le site a « planté ».

---

## 2. Mesurer : un test de charge

`tools/load_test.py` simule des visiteurs qui parlent à Streamlit **comme un navigateur** : connexion WebSocket,
demande d'une page, attente de la fin du script. Un visiteur virtuel coûte quelques kilo-octets (un vrai navigateur,
150 Mo) : on peut en lancer des centaines depuis un ordinateur portable.

```bash
streamlit run app.py                      # dans un premier terminal
python tools/load_test.py --visitors 100 --pid $(pgrep -f "streamlit run")
python tools/load_test.py --visitors 300 --ramp 30 --hold 20    # 10 arrivées par seconde, 20 s de lecture
python tools/load_test.py --visitors 150 --pages "" markets brief crypto economy assistant glossary
```

**Mesures de départ** (page d'accueil, données déjà en cache, ordinateur à 4 cœurs) :

| Visiteurs arrivés ensemble | Servis | Temps d'affichage |
| --- | --- | --- |
| 1 | 1 / 1 | 0,33 s |
| 20 | 20 / 20 | 5,1 s |
| 50 | 50 / 50 | 15,8 s |
| 100 | **0 / 100** | connexions coupées |

Deux signes inquiétants : tout le monde finit **en même temps** (le dernier comme le premier), et à 100 visiteurs
le serveur, saturé, ne répond plus du tout.

---

## 3. Trouver la vraie cause : un profileur

Deviner est une perte de temps : on **observe**. `py-spy` regarde, 50 fois par seconde, ce que fait chaque fil
d'exécution d'un programme qui tourne, sans le modifier :

```bash
pip install py-spy
py-spy record -p <numéro du processus streamlit> -d 25 -o profil.svg     # pendant le test de charge
```

Le résultat a surpris :

- la **boucle principale** passait **92 %** de son temps dans `update_watched_modules` : après chaque affichage,
  Streamlit vérifie, pour chaque visiteur, si l'un des centaines de fichiers de code a changé (pour recharger
  l'appli quand on modifie le code). Utile en développement, inutile en production ;
- **58 %** de tous les échantillons tombaient dans `gc.collect(2)` : après **chaque** affichage, Streamlit lance un
  grand ménage complet de la mémoire, qui arrête tout le serveur le temps de parcourir des millions d'objets.

Notre propre code (la page du fil) ne pesait que 15 %. Sans mesure, on aurait optimisé le mauvais endroit.

---

## 4. Les correctifs

### Réglages du serveur (`.streamlit/config.toml`)

```toml
[server]
fileWatcherType = "none"        # ne plus surveiller les fichiers du code
websocketPingInterval = 45      # un serveur très occupé a 45 s pour répondre aux pings

[runner]
postScriptGC = false            # Python fait déjà le ménage de la mémoire tout seul, au bon moment
```

Pour développer avec rechargement automatique : `streamlit run app.py --server.fileWatcherType auto`.

### Une file d'attente (`core/capacity.py`)

Comme à un guichet : 4 pages s'affichent à la fois (réglable : `RENDER_SLOTS`), les suivantes attendent leur tour
**sans consommer de processeur**. La boucle principale garde du temps pour répondre aux navigateurs, et le visiteur
voit « Beaucoup de visiteurs en ce moment : ta page arrive… » au lieu d'une page figée.

```python
with capacity.QUEUE.slot(on_wait=lambda: st.toast("Beaucoup de visiteurs en ce moment…")):
    page.run()
```

Pendant une attente **réseau** (une source, la réponse de l'IA), le visiteur **rend sa place**
(`QUEUE.released()`) : attendre un serveur distant ne demande pas de calcul.

### Calculer une fois pour tout le monde

- Les sujets qui montent et le choix de « À la une » ne changent qu'à chaque collecte : ils sont calculés **une
  fois par collecte** (`load_trends`, `lead_for`), et non une fois par visiteur.
- Les cours sont gardés **symbole par symbole** (`SYMBOL_QUOTES`) : deux visiteurs qui suivent LVMH partagent le
  même cours, même si le reste de leurs listes diffère.
- Quand un cache expire, Streamlit s'assure qu'**un seul** visiteur recharge les données ; les autres attendent son
  résultat (sinon : 100 appels identiques à Yahoo au même instant, et un blocage pour quota dépassé).

### Une mémoire qui ne déborde jamais

Un serveur qui plante « au bout de quelques heures » souffre souvent d'une **fuite de mémoire** : un cache qui
grossit sans fin. Tous les caches qui dépendent d'un paramètre ont désormais une taille maximale
(`max_entries`), et les mémoires partagées (`capacity.Memory`) oublient leurs plus anciennes valeurs quand elles
sont pleines. Un test vérifie qu'aucun cache n'est oublié (`test_caches_with_parameters_are_bounded`).

### Résister aux pannes des sources

Avant, si Yahoo répondait « trop de requêtes » (429), une liste vide était gardée en cache 2 minutes : bandeau vide
pour **tout le monde**. Désormais, une erreur n'est jamais mise en cache, et on affiche la **dernière réponse
réussie** (`_resilient`) : sous forte affluence, les sources limitent souvent les requêtes, le site reste plein.

### Base de données et mots de passe

- SQLite passe en **journal WAL** : les lectures ne bloquent plus les écritures.
- PostgreSQL : réserve de 10 connexions (`DB_POOL_SIZE`) au lieu de 4.
- `scrypt` utilise 16 Mo par calcul de mot de passe : au plus **4 calculs à la fois**, pour que 100 connexions
  simultanées ne demandent pas 1,6 Go d'un coup.

---

## 5. Les résultats

Mêmes mesures, même ordinateur :

| Situation | Avant | Après |
| --- | --- | --- |
| 1 visiteur | 0,33 s | **0,08 s** |
| 100 visiteurs arrivés ensemble | 0 / 100 servis | **100 / 100**, en 5,5 s |
| 200 visiteurs arrivés ensemble | — | **200 / 200**, en 11 s |
| 300 visiteurs sur 30 s, qui restent 20 s | — | **300 / 300**, médiane **0,12 s**, 95 % en moins de 0,5 s |
| 150 visiteurs sur 7 pages différentes | — | **150 / 150**, en 11 s |
| Mémoire par visiteur connecté | 1 Mo | **0,3 à 0,4 Mo** |

Un seul processus sert environ **18 pages par seconde** (200 pages en 11 s), soit plus de 60 000 pages par heure. La page *Outils → Configuration* affiche la charge en direct : pages en cours, visiteurs en attente, mémoire.

---

## 6. Mettre le site en ligne

| Hébergeur | Prix | À savoir |
| --- | --- | --- |
| **Streamlit Community Cloud** | Gratuit | Fait pour Streamlit ; déploie directement depuis ce dépôt ; l'appli s'endort sans visites et se réveille en quelques secondes. |
| **Hugging Face Spaces** (Docker) | Abonnement PRO | Depuis octobre 2026, Hugging Face refuse les Spaces Docker gratuits (« 402 Payment Required » : vécu lors du premier essai de publication). |
| **Ton ordinateur / un serveur** | Selon l'hébergeur | `docker run`, voir ci-dessous. |

### Streamlit Community Cloud (gratuit) : 5 minutes

FinVeille peut rester dans le sous-dossier `finveille/` : Streamlit lit `finveille/.streamlit/config.toml` (thème
et réglages de charge) et `finveille/requirements.txt`, à côté du fichier de l'appli. Vérifié en lançant
`streamlit run finveille/app.py` depuis la racine du dépôt : toutes les pages s'affichent, réglages appliqués.

1. Va sur <https://share.streamlit.io> → **Continue with GitHub** (autorise l'accès à tes dépôts).
2. **Create app** → *Deploy a public app from GitHub*, puis :
   - *Repository* : `ton-pseudo/finveille` (le dépôt public du projet) ;
   - *Branch* : `main` ;
   - *Main file path* : `app.py` (ou `finveille/app.py` si le projet est dans un sous-dossier d'un autre dépôt) ;
   - *App URL* : par exemple `finveille` (→ `https://finveille.streamlit.app`, si le nom est libre).
3. **Advanced settings** : *Python version* 3.12 ; dans *Secrets*, colle au format TOML :

   ```toml
   GEMINI_API_KEY = "ta-clé"
   DATABASE_URL = "postgresql://…"   # conseillé (étape 20), sinon les comptes s'effacent au redémarrage
   ```

4. **Deploy**. Premier démarrage : 2 à 4 minutes (installation des bibliothèques). Ensuite, chaque push sur la
   branche met le site à jour tout seul.

Pour la connexion Google, l'adresse de retour devient `https://finveille.streamlit.app/oauth2callback` (la page
*Configuration* la calcule pour toi) et la section `[auth]` se colle dans les mêmes *Secrets*.

### Docker : le même site partout

Le `Dockerfile` décrit tout l'environnement (Python, bibliothèques, réglages de production, utilisateur sans droits
d'administration, contrôle de santé). On le construit une fois, il tourne pareil partout :

```bash
docker build -t finveille .
docker run -p 8501:8501 -e DATABASE_URL="postgresql://…" -e GEMINI_API_KEY="…" finveille
```

Les secrets passent en **variables d'environnement** (`-e`, ou les réglages de l'hébergeur), que `get_secret` lit
directement. Seule la connexion Google exige un vrai fichier `secrets.toml` : colle son contenu entier dans la
variable `SECRETS_TOML`, `deploy/entrypoint.sh` l'écrit au démarrage. En production, le visiteur ne voit jamais le
détail technique d'une erreur (`STREAMLIT_CLIENT_SHOW_ERROR_DETAILS=none`) : il reste dans les journaux.

### Publier sur Hugging Face Spaces (abonnement PRO)

`deploy/publish_space.py` fait tout le travail sur Hugging Face : il **crée le Space** (Docker) s'il n'existe pas,
y **recopie tes secrets**, puis **envoie le code** (sans le guide, les tests, ni aucun fichier secret). Le workflow
GitHub le lance après avoir vérifié que les tests passent ; comme Hugging Face exige désormais l'abonnement PRO pour
un Space Docker, il ne se déclenche plus tout seul : lance-le depuis l'onglet *Actions* (*Run workflow*). Avec un
compte PRO, deux choses à faire, une seule fois :

1. **Un compte et un jeton Hugging Face** : inscris-toi sur <https://huggingface.co/join>, puis
   <https://huggingface.co/settings/tokens> → *Create new token* → type **Write** → copie le jeton (`hf_…`).
2. **Les secrets dans GitHub** : dans ton dépôt, *Settings → Secrets and variables → Actions → New repository
   secret* :
   - `HF_TOKEN` : le jeton de l'étape 1 (obligatoire) ;
   - `GEMINI_API_KEY` : ta clé d'IA ; `DATABASE_URL` : ta base Neon (étape 20), sans laquelle les comptes
     disparaissent à chaque redémarrage du Space ; et si tu veux `SMTP_…`, `ADMIN_EMAILS`, `SECRETS_TOML`.

Ensuite : onglet **Actions** → *FinVeille → Hugging Face* → **Run workflow**. Au bout de 3 à 5 minutes (construction de l'image Docker), ton site est en ligne à
l'adresse affichée à la fin du journal : `https://ton-pseudo-finveille.hf.space`.

Ouvre le site par cette adresse directe, plutôt que par la page du Space sur huggingface.co : là, le site est
affiché dans un cadre, et les navigateurs y bloquent souvent les cookies, donc la connexion aux comptes. Pour
Google, l'adresse de retour est `https://ton-pseudo-finveille.hf.space/oauth2callback` (la page *Configuration* la
calcule pour toi).

Le workflow se trouve à la racine du dépôt (`.github/workflows/finveille-huggingface.yml`). Si FinVeille a son
propre dépôt, c'est `finveille/.github/workflows/huggingface.yml` qui prend le relais, avec les mêmes secrets.

À la main, depuis le dossier `finveille/` : `python deploy/publish_space.py --dry-run` liste ce qui serait envoyé ;
`HF_TOKEN=hf_… python deploy/publish_space.py` publie.

---

## 7. Aller plus loin

- **Plusieurs processus** : un processus Python n'utilise qu'un cœur. Sur un serveur à 4 cœurs, on peut lancer 4
  copies de Streamlit derrière un répartiteur (nginx) avec des sessions « collantes » (chaque visiteur reste sur la
  même copie, qui garde sa session). Chaque copie a ses propres caches : 4 fois plus d'appels aux sources.
- **Moins de widgets** : chaque bouton coûte un peu de calcul ; le fil charge désormais 20 articles à la fois
  (*Afficher plus* pour la suite, réglable dans *Réglages*).

---

## 8. Exercices

1. Lance `tools/load_test.py` avec 50 visiteurs, `RENDER_SLOTS` à 1, puis à 8. Compare la médiane et le maximum.
   Pourquoi la médiane change-t-elle plus que le maximum ?
2. Avec `py-spy top -p <pid>` pendant un test de charge, trouve la fonction de FinVeille qui coûte le plus.
3. Ajoute au panneau *La charge en ce moment* le nombre de pages servies par minute (indice : garde l'heure de
   chaque page servie dans `RenderQueue`, et compte celles de la dernière minute).

---

## 9. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Le site ne se recharge plus quand je modifie le code | `fileWatcherType = "none"` (production) | `streamlit run app.py --server.fileWatcherType auto`. |
| « Beaucoup de visiteurs en ce moment » | La file d'attente est pleine | Normal en pic ; augmente `RENDER_SLOTS` si le processeur n'est pas saturé. |
| Le bandeau des cours ne bouge plus | Yahoo limite les requêtes : on affiche les derniers cours connus | Patiente ; le cache réessaie toutes les 2 minutes. |
| `ConnectionClosedError` dans le test de charge | Serveur saturé, connexions coupées | Vérifie `config.toml` (§ 4) ; profile avec `py-spy`. |
| `docker: Cannot connect to the Docker daemon` | Docker n'est pas démarré | Lance Docker Desktop (Windows, macOS) ou `sudo systemctl start docker`. |
| Le Space Hugging Face affiche « Runtime error » | Erreur au démarrage | Onglet *Logs* du Space ; vérifie `DATABASE_URL` et les secrets. |
| Comptes perdus après un redémarrage du Space | Disque non conservé | Configure `DATABASE_URL` (étape 20). |
| Le workflow affiche « Secret HF_TOKEN absent » | Le jeton n'est pas dans les secrets GitHub | *Settings → Secrets and variables → Actions*, puis *Re-run all jobs*. |
| Streamlit : « This repository does not exist » | Dépôt **privé** : Streamlit n'a pas l'autorisation de le lire | Dépôt public, ou autorise l'accès aux dépôts privés dans les réglages de ton compte Streamlit. |
| `402 Payment Required … requires a PRO subscription` | Hugging Face réserve les Spaces Docker à l'abonnement PRO | Mets le site en ligne sur Streamlit Community Cloud (gratuit, § 6). |
| « Mode sans IA » sur le site en ligne | `GEMINI_API_KEY` absent des *Secrets* de l'hébergeur | Streamlit Cloud : ⋮ → *Settings* → *Secrets*. |
| `Invalid user token` | Jeton mal copié, ou de type « Read » | Recrée un jeton de type **Write**. |
| Impossible de rester connecté sur la page du Space | Site affiché dans un cadre : cookies bloqués | Utilise l'adresse directe `https://ton-pseudo-finveille.hf.space`. |

Retour au [sommaire du guide](README.md).
