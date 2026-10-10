# Étape 21 — Le brief et les alertes par e-mail

> **Objectif :** que FinVeille **envoie** lui-même : le brief chaque matin des jours de Bourse, et un e-mail dès
> qu'une alerte de cours se déclenche, aux utilisateurs qui l'ont demandé dans *Réglages → Notifications par
> e-mail*. Le tout gratuitement : un compte d'envoi d'e-mails et une tâche planifiée sur GitHub.

Fichiers créés : `core/notify.py`, `scripts/send_notifications.py`, `.github/workflows/notifications.yml`,
`tests/test_notify.py`, ce guide. Fichiers modifiés : `core/brief.py`, `core/storage.py`, `views/brief.py`,
`views/settings.py`, `views/alerts.py`, `tests/`.

---

## 1. Le principe

Une application Streamlit ne tourne que lorsque quelqu'un a la page ouverte : elle ne peut pas envoyer un e-mail à
7 h 45 si personne n'est connecté. On sépare donc les rôles :

```
 Le site (Streamlit)                     La base en ligne (étape 20)           GitHub Actions (tâche planifiée)
 l'utilisateur coche                     settings : email_brief = true          chaque matin et chaque heure :
 « Recevoir le brief »    ──écrit──▶      alerts : LVMH < 400          ◀──lit──  python -m scripts.send_notifications
                                                                                     │ envoie par SMTP
                                                                                     ▼
                                                                                 la boîte mail de l'utilisateur
```

Le script ne passe pas par l'interface : il réutilise directement `core/` (collecte, brief, alertes, stockage). C'est
le bénéfice de la séparation `core/` / interface décidée à l'étape 0.

> Il faut la **base en ligne** de l'étape 20 : la tâche GitHub et le site doivent lire les mêmes données.

---

## 2. Envoyer un e-mail avec Python (SMTP)

Le protocole d'envoi du courrier s'appelle **SMTP**. Python sait le parler (`smtplib`) :

```python
message = EmailMessage()
message["From"], message["To"], message["Subject"] = sender, to, subject
message.set_content(text)                          # version texte : lue partout
message.add_alternative(html, subtype="html")      # version mise en forme

with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as server:
    server.starttls()                              # 1. on chiffre la connexion…
    server.login(user, password)                   # 2. … AVANT d'envoyer le mot de passe
    server.send_message(message)
```

Un e-mail HTML n'est pas une page web : les messageries ignorent souvent les feuilles de style. `Brief.to_html()`
écrit donc les styles **dans chaque balise** (`style="…"`), sur une seule colonne de 600 pixels.

### Choisir un service d'envoi (gratuit)

**Option A — Gmail** (le plus simple pour commencer) :

1. Active la **validation en deux étapes** de ton compte Google (*Gérer votre compte Google → Sécurité*).
2. Crée un **mot de passe d'application** : <https://myaccount.google.com/apppasswords> → nom « FinVeille » →
   copie les 16 lettres.
3. Réglages : `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=ton.adresse@gmail.com`,
   `SMTP_PASSWORD=` les 16 lettres, `SMTP_FROM=FinVeille <ton.adresse@gmail.com>`.

Gmail limite l'envoi à quelques centaines d'e-mails par jour : largement assez pour un projet étudiant.

**Option B — Brevo** (300 e-mails par jour gratuits, fait pour ça) : crée un compte sur <https://www.brevo.com>,
valide ton adresse d'expéditeur, puis *SMTP & API → SMTP* : `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`,
identifiant et clé SMTP fournis par Brevo.

> ⚠️ Le mot de passe SMTP est un secret : jamais dans le code ni sur GitHub en clair.

---

## 3. Ne pas envoyer deux fois la même chose

Les alertes sont vérifiées **toutes les heures** : sans précaution, « LVMH en dessous de 400 » partirait 14 fois
dans la journée. On note dans les préférences de l'utilisateur le jour d'envoi de chaque alerte :

```python
due = notify.not_yet_sent(fired, storage.get_setting(user, "alerts_sent", {}), today)
```

Et surtout, on ne note l'envoi **qu'une fois réussi** : si le serveur SMTP est en panne, la prochaine exécution
réessaiera. Même principe pour le brief (`brief_sent`) : relancer la tâche à la main ne le renvoie pas.

---

## 4. La tâche planifiée (GitHub Actions)

`.github/workflows/notifications.yml` :

```yaml
on:
  schedule:
    - cron: "45 5 * * 1-5"     # le brief, du lundi au vendredi à 5 h 45 UTC
    - cron: "10 7-20 * * 1-5"  # les alertes, toutes les heures de 7 h à 20 h UTC
  workflow_dispatch:           # bouton pour lancer à la main
```

Une ligne `cron` se lit : *minute, heure, jour du mois, mois, jour de la semaine* (`1-5` = lundi à vendredi). Les
heures sont en **UTC** : Paris a une heure d'avance en hiver, deux en été.

Mise en place (le projet doit être à la racine de son dépôt, voir étape 9) :

1. Sur GitHub : *Settings → Secrets and variables → Actions → New repository secret*, crée `DATABASE_URL`,
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` et `SITE_URL` (l'adresse de ton appli,
   pour les liens dans les e-mails).
2. Onglet *Actions → Notifications → Run workflow* : lance « alerts » pour tester tout de suite.
3. Dans l'appli, connecte-toi, coche les notifications dans *Réglages*, crée une alerte déjà déclenchée (par
   exemple « CAC 40 au-dessus de 1 ») et relance le workflow : l'e-mail arrive.

> GitHub peut retarder une tâche planifiée de quelques minutes aux heures chargées, et suspend les tâches
> planifiées d'un dépôt sans activité pendant 60 jours (un commit les réactive).

### Tester sans rien envoyer

```bash
python -m scripts.send_notifications brief --dry-run
python -m scripts.send_notifications alerts --dry-run
```

`--dry-run` (essai à blanc) affiche les e-mails dans le terminal sans les envoyer ni les noter comme envoyés.

### Les tests automatiques

Impossible d'envoyer de vrais e-mails pendant les tests : `FakeSMTP` **se fait passer** pour `smtplib.SMTP` et
enregistre ce qu'on lui demande. On vérifie ainsi l'ordre des étapes (chiffrement avant le mot de passe), le
destinataire (Bob, qui n'a rien coché, ne reçoit rien) et l'absence de doublon.

---

## 5. Exercices

1. Ajoute un réglage « heure du brief » (7 h ou 8 h) et deux lignes `cron`.
2. Envoie un **résumé hebdomadaire** du portefeuille virtuel le vendredi soir (valeur, plus-value, meilleure ligne).
3. Ajoute un lien de **désinscription en un clic** dans l'e-mail (indice : un jeton secret par utilisateur dans
   l'adresse, vérifié par une page de l'appli).

---

## 6. Erreurs fréquentes

| Symptôme | Cause | Solution |
| --- | --- | --- |
| `SMTPAuthenticationError: 535 … Username and Password not accepted` | Mot de passe Gmail habituel au lieu d'un mot de passe d'application | Crée un mot de passe d'application (validation en deux étapes requise). |
| `SMTP non configuré` | Secrets SMTP absents de GitHub | *Settings → Secrets and variables → Actions*. |
| Aucun e-mail, script sans erreur (« 0 e-mail préparé ») | Personne n'a coché la case, ou la tâche lit une autre base | Vérifie *Réglages*, et que `DATABASE_URL` est la même pour le site et pour GitHub. |
| Les e-mails arrivent dans les indésirables | Expéditeur inconnu de la messagerie | Envoie depuis l'adresse du compte SMTP ; ajoute l'expéditeur aux contacts. |
| La tâche ne se lance pas à l'heure | Retard de GitHub, ou dépôt inactif depuis 60 jours | Patiente quelques minutes ; fais un commit. |
| `ModuleNotFoundError: No module named 'scripts'` | Script lancé depuis un autre dossier | Lance-le depuis `finveille/` avec `python -m scripts.send_notifications`. |

Étape suivante : [les comptes par e-mail](22-comptes-par-email.md). Retour au [sommaire du guide](README.md).
