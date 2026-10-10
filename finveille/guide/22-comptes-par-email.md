# Étape 22 — Les comptes par e-mail, gérés par FinVeille

> **Objectif :** que n'importe qui puisse créer un compte avec **son e-mail et un mot de passe**, sans rien
> configurer chez Google ou ailleurs ; que la connexion **dure 30 jours** (même après avoir fermé l'onglet) ;
> réunir Google, les autres comptes et l'e-mail sur **un seul écran de connexion** ; et un **assistant de
> configuration** qui donne les valeurs exactes à copier pour activer Google et les autres services.

Fichiers créés : `core/accounts.py`, `views/setup.py`, `tests/test_accounts.py`, ce guide. Fichiers modifiés :
`core/storage.py`, `core/notify.py`, `ui.py`, `app.py`, `views/account.py`, `theme.py`, `tests/`.

---

## 1. Trois façons de se connecter

| Méthode | Ce qu'il faut configurer | Identifiant du compte |
| --- | --- | --- |
| **E-mail + mot de passe** | rien (toujours active) | `mail:alice@example.com` |
| **Google** | un identifiant client Google (gratuit, 5 min), étape 14 | `alice@gmail.com` (e-mail vérifié par Google) |
| **Facebook et autres** | un compte Auth0 (gratuit), étape 14 | l'e-mail vérifié, ou l'identifiant fourni |

Pourquoi `mail:` devant l'adresse ? Sans confirmation par e-mail, n'importe qui pourrait créer un compte avec
l'adresse d'un autre. S'il avait le même identifiant que le compte Google de cette personne, il verrait ses données.
Avec le préfixe, les deux comptes restent séparés : impossible de se faire passer pour quelqu'un.

Et le **mode local** ? Pour un usage strictement personnel sur ton ordinateur, ajoute `LOCAL_MODE = true` dans les
secrets : plus de connexion, une seule personne, comme aux étapes 3 à 13.

---

## 2. Ne jamais enregistrer un mot de passe

Si la base fuitait, des mots de passe en clair seraient une catastrophe (beaucoup de gens réutilisent le même
partout). On enregistre donc seulement une **empreinte** :

```python
salt = secrets.token_bytes(16)                         # un « sel » aléatoire, différent pour chaque compte
digest = hashlib.scrypt(password.encode(), salt=salt, dklen=32, n=2**14, r=8, p=1)
# enregistré : "scrypt$16384$8$1$<sel>$<empreinte>"
```

- Une **empreinte** se calcule dans un sens, jamais dans l'autre : on ne peut pas retrouver le mot de passe.
- Le **sel** fait que deux personnes au même mot de passe ont deux empreintes différentes (impossible d'utiliser des
  tables d'empreintes précalculées).
- **scrypt** est volontairement lent (~50 ms) et gourmand en mémoire (16 Mo) : un pirate qui volerait la base ne
  pourrait tester que quelques mots de passe par seconde et par processeur, au lieu de milliards.
- Pour vérifier, on recalcule l'empreinte avec le même sel et on compare avec `hmac.compare_digest`, qui met le même
  temps que la comparaison réussisse ou non (une comparaison ordinaire s'arrête au premier caractère différent : en
  mesurant le temps de réponse, on pourrait deviner l'empreinte petit à petit).

Toutes ces fonctions sont dans la **bibliothèque standard** de Python : rien à installer.

### Les autres protections

| Attaque | Protection |
| --- | --- |
| Essayer des milliers de mots de passe (« force brute ») | Compte bloqué 15 minutes après 5 échecs ; 20 tentatives au plus par session |
| Découvrir qui est inscrit | Même message (« E-mail ou mot de passe incorrect ») et même durée de réponse dans tous les cas, y compris pour « mot de passe oublié » |
| Mots de passe faibles | 8 caractères minimum, lettres et chiffres, liste des mots de passe les plus courants refusée |
| Vol d'un code reçu par e-mail | 6 chiffres, valable 15 minutes, 5 essais, utilisable une seule fois |
| Changement de mot de passe | Toutes les autres sessions sont fermées (un éventuel intrus est déconnecté) |

---

## 3. Rester connecté : un cookie

Streamlit oublie tout (`st.session_state`) quand on recharge la page. Pour rester connecté, on fait comme tous les
sites : un **cookie**, un petit texte que le navigateur renvoie au serveur à chaque visite.

1. À la connexion, on tire au hasard un **jeton** de 256 bits (`secrets.token_urlsafe(32)`). La base garde son
   **empreinte SHA-256** et sa date d'expiration (30 jours), pas le jeton lui-même.
2. Le navigateur garde le jeton dans le cookie `fv_session`.
3. À la visite suivante, `st.context.cookies` le lit ; on retrouve l'utilisateur grâce à son empreinte.

Streamlit sait **lire** les cookies, pas en **écrire**. Astuce : un composant HTML invisible exécute une ligne de
JavaScript :

```python
components.html(f"<script>window.parent.document.cookie = 'fv_session={token}; path=/; max-age=2592000; "
                "SameSite=Lax' + secure;</script>", height=0)
```

Le cadre du composant a la même origine que la page (`allow-same-origin`) : il peut écrire le cookie du site.
`SameSite=Lax` empêche d'autres sites d'envoyer ce cookie à FinVeille ; `Secure` (ajouté en HTTPS) interdit de
l'envoyer sans chiffrement. À la déconnexion, la session est supprimée de la base et le cookie effacé (`max-age=0`).

> Limite à connaître : un cookie écrit en JavaScript ne peut pas être `HttpOnly`. Une faille XSS (du code
> malveillant injecté dans la page) pourrait le lire. C'est pourquoi tout le HTML de FinVeille est échappé (`esc`)
> depuis l'étape 2.

---

## 4. Confirmer l'adresse et « mot de passe oublié »

Ces deux fonctions ont besoin d'**envoyer des e-mails** : elles s'activent toutes seules dès que les réglages SMTP de
l'étape 21 sont dans les secrets.

- **Inscription** : un code à 6 chiffres est envoyé ; le compte n'est actif qu'une fois le code saisi.
- **Mot de passe oublié** : on saisit son e-mail, on reçoit un code, on choisit un nouveau mot de passe.

Sans service d'envoi, l'inscription fonctionne directement (sans confirmation) et « mot de passe oublié » indique de
contacter l'administrateur.

---

## 5. L'assistant de configuration

La page *Outils → Configuration* n'apparaît que pour l'administrateur : en local (adresse `localhost`), ou pour les
e-mails listés dans `ADMIN_EMAILS`. Elle affiche :

- l'état de chaque service (connexion e-mail, Google, autres comptes, envoi d'e-mails, base en ligne, IA) ;
- l'**adresse de retour** exacte à coller chez Google et Auth0, calculée à partir de l'adresse du site
  (`st.context.url`) : plus d'erreur `redirect_uri_mismatch` ;
- un `cookie_secret` tiré au hasard et un fichier de secrets complet, où il ne reste qu'à remplacer les
  `COLLE-ICI…` ;
- un bouton pour **s'envoyer un e-mail de test**.

Ce qui ne peut pas être automatisé : créer l'identifiant client chez Google (il faut ton compte Google) et le compte
Auth0. Les étapes sont rappelées sur la page et détaillées à l'étape 14.

---

## 6. Les tests

`tests/test_accounts.py` (sur SQLite **et** PostgreSQL) vérifie chaque règle : empreinte jamais égale au mot de passe,
sel différent à chaque fois, blocage après 5 échecs puis déblocage, même message pour un compte inconnu, sessions qui
expirent, codes à usage unique… `tests/test_app.py` rejoue les parcours complets dans l'interface : inscription,
connexion, erreur, déconnexion, code de confirmation et mot de passe oublié avec un **faux serveur d'e-mails**.

---

## 7. Exercices

1. Ajoute un compteur « dernière connexion le … » sur la page *Mon compte* (colonne `last_seen` de `users`).
2. Affiche à l'administrateur le nombre de comptes créés (`storage.count_users()`).
3. **Défi :** une connexion **sans mot de passe** (« lien magique ») : un code envoyé par e-mail à chaque connexion.

---

## 8. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| Déconnecté à chaque rechargement | Cookie bloqué (navigation privée stricte, extension) | Autorise les cookies du site ; la session tient alors 30 jours. |
| « Trop de tentatives » | 5 mots de passe faux de suite | Attends 15 minutes, ou « Mot de passe oublié ». |
| Pas de code reçu | SMTP non configuré, ou e-mail dans les indésirables | Réglages SMTP (étape 21) ; bouton de test de la page *Configuration*. |
| La page *Configuration* n'apparaît pas en ligne | Ton e-mail n'est pas dans `ADMIN_EMAILS` | Ajoute `ADMIN_EMAILS = "ton@email"` dans les secrets. |
| Je ne retrouve pas mes données en me connectant avec Google | Compte Google et compte e-mail sont deux comptes distincts (sécurité, § 1) | Utilise toujours la même méthode de connexion. |
| Plus besoin de se connecter du tout | `LOCAL_MODE = true` dans les secrets | Retire-le pour un site en ligne. |

Retour au [sommaire du guide](README.md).
