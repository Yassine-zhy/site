# Étape 14 — Comptes utilisateurs : Google, e-mail, Facebook

> **Objectif :** que chaque visiteur ait **ses propres** favoris, suivis, notes, portefeuille, alertes et réglages.
> Connexion avec **Google** en un clic, ou par **e-mail + mot de passe** et **Facebook** grâce au service Auth0.
> FinVeille ne stocke **jamais** de mot de passe.

Fichiers créés : `views/account.py`, ce guide. Fichiers modifiés : `core/storage.py`, `ui.py`, `app.py`, toutes les
pages personnelles (`views/`), `requirements.txt`, `.streamlit/secrets.toml.example`, `tests/`.

---

## 1. Pourquoi des comptes ?

Jusqu'ici, la base SQLite n'avait qu'**un seul utilisateur**. En ligne, tous les visiteurs partageaient donc les mêmes
favoris (voir l'étape 9). Il faut deux choses :

1. **savoir qui est là** : c'est l'*authentification* (« prouve-moi que tu es bien toi ») ;
2. **ranger chaque donnée au nom de son propriétaire** : une colonne `user_id` dans chaque table personnelle.

### Pourquoi ne pas coder soi-même l'inscription par mot de passe ?

Stocker des mots de passe, c'est : les chiffrer correctement (*hachage* avec sel), gérer « mot de passe oublié »,
envoyer des e-mails de confirmation, bloquer les robots qui essaient des milliers de mots de passe… et risquer une
fuite. On **délègue** tout cela à des services spécialisés, avec le protocole standard **OpenID Connect (OIDC)** :

```
 Visiteur ──clic « Continuer avec Google »──▶ FinVeille ──redirection──▶ Google (saisie du mot de passe chez Google)
    ▲                                                                          │
    └──────────── FinVeille reçoit « c'est bien alice@gmail.com » ◀────────────┘  (adresse /oauth2callback)
```

FinVeille ne voit **jamais** le mot de passe : seulement le nom, l'e-mail et un identifiant unique.

Streamlit gère tout le protocole avec trois commandes :

| Commande | Rôle |
| --- | --- |
| `st.login("google")` | envoie le visiteur vers la page de connexion du service `[auth.google]` |
| `st.user` | les informations de la personne connectée : `st.user.is_logged_in`, `st.user.email`, `st.user.name`… |
| `st.logout()` | déconnecte (supprime le cookie de session signé) |

Il faut installer l'extra `auth` de Streamlit (il ajoute les bibliothèques **Authlib** et **httpx**) :

```bash
pip install -r requirements.txt     # contient maintenant streamlit[auth]
```

---

## 2. La base : une colonne `user_id` partout

Chaque table personnelle reçoit une colonne `user_id`, et elle entre dans la **clé primaire** :

```sql
CREATE TABLE IF NOT EXISTS follows (
    user_id    TEXT NOT NULL,
    kind       TEXT NOT NULL CHECK (kind IN ('company', 'theme')),
    value      TEXT NOT NULL,
    label      TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, kind, value)   -- Alice et Bob peuvent suivre LVMH tous les deux
);
```

Et **chaque fonction reçoit l'utilisateur en premier paramètre** :

```python
def list_follows(user: str, kind: str | None = None) -> list[dict]:
    query = "SELECT kind, value, label FROM follows WHERE user_id = ?"
```

> ⚠️ **Piège classique :** une variable globale `UTILISATEUR_COURANT = "alice"`. Un serveur Streamlit sert
> **plusieurs visiteurs en même temps** dans le même programme Python : la variable serait partagée, et Bob verrait
> les favoris d'Alice. On passe donc toujours `user` en paramètre.

Même la suppression vérifie le propriétaire :

```python
conn.execute("DELETE FROM positions WHERE id = ? AND user_id = ?", (position_id, user))
```

Sans `AND user_id = ?`, quelqu'un qui devinerait le numéro d'une position pourrait supprimer celle d'un autre.

Une nouvelle table `users` garde l'e-mail, le nom, la date d'inscription et de dernière visite. La table `summaries`,
elle, reste **partagée** : un résumé d'article est le même pour tout le monde, on ne le calcule qu'une fois.

---

## 3. La migration : ne pas perdre les données des étapes précédentes

Ta base `data/finveille.db` contient déjà des favoris **sans** colonne `user_id`. `CREATE TABLE IF NOT EXISTS` ne
modifie pas une table existante (voir le mémo de débogage) : il faut une **migration**.

SQLite garde dans chaque fichier un petit numéro libre, `PRAGMA user_version` (0 par défaut). On s'en sert comme
numéro de version du schéma :

```python
version = conn.execute("PRAGMA user_version").fetchone()[0]
if version < 1:
    for table in PERSONAL_TABLES:                         # 1. on met les anciennes tables de côté
        if table_existe and "user_id" not in colonnes(table):
            conn.execute(f"ALTER TABLE {table} RENAME TO {table}_v0")
conn.executescript(SCHEMA)                                # 2. on crée les nouvelles
for table in legacy:                                      # 3. on recopie, au nom de l'utilisateur « local »
    conn.execute(f"INSERT INTO {table} (user_id, {names}) SELECT ?, {names} FROM {table}_v0", (LOCAL_USER,))
    conn.execute(f"DROP TABLE {table}_v0")
conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")   # 4. on note la nouvelle version
```

La migration ne s'exécute qu'**une fois** : au démarrage suivant, `user_version` vaut 1. Le test
`test_migration_d_une_base_des_etapes_precedentes` le vérifie sur une base « à l'ancienne ».

---

## 4. Qui est connecté ? (`ui.py`)

```python
def current_user() -> str | None:
    if not auth_providers():              # aucune section [auth] dans secrets.toml
        return storage.LOCAL_USER         # → « mode local » : un seul utilisateur, comme avant
    if not st.user.get("is_logged_in", False):
        return None                       # → visiteur non connecté
    email = st.user.get("email")
    return email if email and st.user.get("email_verified", False) else st.user.get("sub") or email
```

- **Mode local :** sans configuration, l'appli marche exactement comme avant. Pratique sur ton ordinateur.
- **Pourquoi l'e-mail *vérifié* ?** On identifie la personne par son e-mail, pour qu'elle retrouve ses données en se
  connectant avec Google **ou** par e-mail. Mais quelqu'un pourrait s'inscrire par e-mail avec l'adresse d'un autre,
  sans l'avoir confirmée : dans ce cas on utilise `sub`, l'identifiant unique et privé fourni par le service.

Deux autres fonctions servent dans les pages :

```python
user = require_user()      # pages personnelles : invite à se connecter puis arrête la page (st.stop())
user = current_user()      # pages publiques : le fil, le brief, les marchés restent lisibles sans compte
```

Dans le fil, un visiteur non connecté peut lire et résumer les articles ; les boutons *Garder*, *Lu*, *Masquer* et
*Note* n'apparaissent qu'une fois connecté.

---

## 5. Configurer la connexion Google (15 minutes, gratuit)

1. Va sur <https://console.cloud.google.com> → **Créer un projet** → nom : `FinVeille`.
2. Menu **Google Auth Platform** → **Commencer** :
   - nom de l'application : `FinVeille`, adresse e-mail d'assistance : la tienne ;
   - audience : **Externe** ; coordonnées : ton e-mail → **Créer**.
3. **Clients** → **Créer un client** :
   - type d'application : **Application Web**, nom : `FinVeille` ;
   - **URI de redirection autorisés** → ajoute les deux adresses :
     ```
     http://localhost:8501/oauth2callback
     https://TON-APPLI.streamlit.app/oauth2callback
     ```
   - **Créer**, puis copie l'**ID client** et le **code secret du client**.
4. **Audience** → **Publier l'application**. Sinon, seuls les « utilisateurs test » que tu as listés peuvent se
   connecter. FinVeille ne demande que le nom et l'e-mail (portées `openid email profile`) : aucune vérification de
   Google n'est nécessaire.
5. Dans `.streamlit/secrets.toml`, **à la fin du fichier** :

   ```toml
   [auth]
   redirect_uri = "http://localhost:8501/oauth2callback"
   cookie_secret = "colle-ici-une-longue-chaine-aleatoire"

   [auth.google]
   client_id = "xxxx.apps.googleusercontent.com"
   client_secret = "xxxx"
   server_metadata_url = "https://accounts.google.com/.well-known/openid-configuration"
   ```

   Pour générer `cookie_secret` (il signe le cookie de connexion : garde-le secret) :

   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```

6. Redémarre Streamlit : un bouton **Se connecter** apparaît en haut à droite.

> **Pourquoi à la fin du fichier ?** En TOML, tout ce qui suit `[auth]` appartient à la section `[auth]`. Si tu
> écris `GEMINI_API_KEY = "…"` après, ta clé devient `st.secrets["auth"]["GEMINI_API_KEY"]` et n'est plus trouvée.

---

## 6. E-mail + mot de passe et Facebook avec Auth0 (gratuit jusqu'à 25 000 utilisateurs)

Google ne propose que les comptes Google. **Auth0** est un service qui gère pour toi l'inscription par e-mail (avec
e-mail de confirmation et « mot de passe oublié ») **et** les connexions Facebook, Google, Apple, GitHub… derrière
un seul bouton.

1. Crée un compte sur <https://auth0.com> (offre *Free*), région **Europe**. Ton *domaine* ressemble à
   `finveille.eu.auth0.com`.
2. **Applications** → **Create Application** → nom `FinVeille`, type **Regular Web Applications** → *Create*.
3. Onglet **Settings** :
   - copie **Domain**, **Client ID**, **Client Secret** ;
   - **Allowed Callback URLs** : `http://localhost:8501/oauth2callback, https://TON-APPLI.streamlit.app/oauth2callback`
   - **Allowed Logout URLs** : `http://localhost:8501, https://TON-APPLI.streamlit.app`
   - **Save**.
4. **E-mail + mot de passe** : *Authentication → Database → Username-Password-Authentication* est déjà active.
   Vérifie dans son onglet **Applications** que `FinVeille` est cochée. Auth0 envoie l'e-mail de confirmation
   automatiquement.
5. **Facebook** : *Authentication → Social → Create Connection → Facebook*.
   - Pour tester, laisse les champs *App ID* / *App Secret* **vides** : Auth0 utilise ses clés de développement.
   - Pour un vrai site : crée une application sur <https://developers.facebook.com> (cas d'usage *Facebook Login*),
     ajoute `https://TON-DOMAINE.eu.auth0.com/login/callback` dans *Valid OAuth Redirect URIs*, puis colle l'*App
     ID* et l'*App Secret* dans Auth0.
   - Coche **email** dans les permissions, et active la connexion pour l'application `FinVeille` (onglet
     *Applications*).
   - Fais de même avec **Google** si tu veux tout regrouper derrière un seul bouton.
6. Ajoute dans `secrets.toml`, sous la section `[auth]` :

   ```toml
   [auth.auth0]
   client_id = "xxxx"
   client_secret = "xxxx"
   server_metadata_url = "https://TON-DOMAINE.eu.auth0.com/.well-known/openid-configuration"
   client_kwargs = { "prompt" = "login" }
   ```

   `prompt = "login"` redemande l'identifiant à chaque connexion : sans lui, après « Se déconnecter », Auth0 te
   reconnecterait aussitôt (tu es encore connecté **chez Auth0**, `st.logout` ne déconnecte que de FinVeille).

Tu peux garder `[auth.google]` **et** `[auth.auth0]` : la page de connexion affiche alors deux boutons,
« Continuer avec Google » et « E-mail, Google ou Facebook ». Les libellés se règlent dans `PROVIDERS` (`ui.py`).

---

## 7. En ligne (Streamlit Community Cloud)

Dans **Settings → Secrets** de ton appli, colle le même contenu que `secrets.toml`, en changeant une ligne :

```toml
redirect_uri = "https://TON-APPLI.streamlit.app/oauth2callback"
```

L'adresse doit être **exactement** la même (https, sans `/` final) que celle déclarée chez Google et Auth0.

> ⚠️ **Le stockage reste éphémère** (étape 9) : sur l'offre gratuite, `data/finveille.db` est effacé au redémarrage
> du serveur, comptes compris. Pour un vrai service, la suite logique est une base hébergée (Supabase, Neon,
> Turso…) : grâce à `user_id`, le schéma est déjà prêt.

---

## 8. La page « Mon compte » et le RGPD

Le **RGPD** (règlement européen sur les données personnelles) donne à chacun le droit d'**accéder** à ses données,
de les **emporter** et de les **effacer**. La page *Outils → Mon compte* le permet :

- **Télécharger toutes mes données (JSON)** : `storage.export_user_data(user)` parcourt chaque table personnelle ;
- **Supprimer toutes mes données** : `storage.delete_user_data(user)`, derrière une confirmation (`st.popover`),
  puis déconnexion.

On applique aussi la **minimisation** : FinVeille n'enregistre que l'e-mail et le nom, rien d'autre.

---

## 9. Les tests

Impossible de se connecter à Google dans un test automatique. On **remplace** donc les fonctions de connexion :

```python
def test_visiteur_non_connecte(app, monkeypatch):
    monkeypatch.setattr(ui, "auth_providers", lambda: ["google", "auth0"])
    monkeypatch.setattr(ui, "current_user", lambda: None)
    app.run()
    assert not any(b.label == "Garder" for b in app.button)
```

Et pour la base, on vérifie l'**isolation** : ce qu'Alice enregistre, Bob ne le voit pas, et Bob ne peut pas supprimer
la position d'Alice même en devinant son numéro (`tests/test_storage.py`).

---

## 10. Exercices

1. Affiche sur « Mon compte » la **date de dernière visite** (colonne `last_seen`).
2. Ajoute un bouton **Continuer avec Microsoft** : section `[auth.microsoft]` avec
   `server_metadata_url = "https://login.microsoftonline.com/consumers/v2.0/.well-known/openid-configuration"`.
3. **Défi :** une page d'administration, visible seulement si `user` est ton e-mail, qui affiche le nombre de comptes
   créés par jour.

---

## 11. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| `ModuleNotFoundError: No module named 'httpx'` ou `'authlib'` en cliquant sur « Se connecter » | Extra `auth` non installé | `pip install -r requirements.txt` (contient `streamlit[auth]`). |
| `redirect_uri_mismatch` (Google) / `Callback URL mismatch` (Auth0) | L'adresse de retour n'est pas déclarée, ou diffère d'un caractère | Copie exactement `redirect_uri` dans la console du service (http ≠ https, port, `/` final). |
| Google : « Accès bloqué : l'application n'a pas terminé la procédure de validation » | Application non publiée | *Audience → Publier l'application*, ou ajoute ton adresse en utilisateur test. |
| `The OAuth client was not found` / `invalid_client` | `client_id` ou `client_secret` mal recopié | Recopie-les sans espace. |
| Le bouton « Se connecter » n'apparaît pas | Section `[auth]` absente ou mal placée | Vérifie `secrets.toml` et redémarre Streamlit. |
| Une clé API n'est plus trouvée après l'ajout de `[auth]` | La clé est écrite après `[auth]` | Mets les clés API **avant** `[auth]`. |
| Après « Se déconnecter », Auth0 reconnecte tout seul | Tu es encore connecté chez Auth0 | `client_kwargs = { "prompt" = "login" }`. |
| Mes anciens favoris ont disparu après connexion | Ils appartiennent à l'utilisateur « local » | Normal : ils restent visibles en mode local (sans `[auth]`). |
| `sqlite3.OperationalError: no such column: user_id` | Base modifiée à la main entre deux versions | Supprime `data/finveille.db` (ou remets `PRAGMA user_version = 0` pour relancer la migration). |

Retour au [sommaire du guide](README.md).
