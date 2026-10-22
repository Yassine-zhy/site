"""Les textes légaux de FinVeille : mentions légales, politiques de confidentialité et des cookies, conditions.

Tout est pur (aucun appel à Streamlit) : `config_from` déduit la configuration du site des **noms** et des **hôtes** des
secrets (jamais d'une valeur à recopier), et chaque texte est une fonction de cette configuration qui renvoie du
Markdown. Seuls les services réellement configurés y figurent (views/legal.py affiche les pages).
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from urllib.parse import urlparse

UPDATED = "22 octobre 2026"
EDITOR = "Yassine Zouhair"
DEFAULT_SITE_URL = "https://finveille.streamlit.app"
CONTACT = "contact.finveille@gmail.com"  # l'adresse de contact du site ; le réglage CONTACT_EMAIL peut la remplacer
NO_CONTACT = "l'adresse de contact (à venir)"  # si une configuration n'en donne aucune

# L'hébergeur de l'application ; un autre hébergeur s'ajoute ici (le réglage HOSTING donne sa clé)
HOSTS = {
    "streamlit": {
        "name": "Streamlit Community Cloud",
        "company": "Snowflake Inc.",
        "address": "Suite 3A, 106 East Babcock Street, Bozeman, Montana 59715, États-Unis",
        "phone": "+1 844 766 9355",
        "site": "https://streamlit.io",
        "privacy": "https://www.snowflake.com/en/legal/privacy/privacy-policy/",
        "privacy_email": "privacy@snowflake.com",
        "eu_representative": "Snowflake Computing Netherlands B.V., Gustav Mahlerlaan 300-314, "
                             "1082 ME Amsterdam, Pays-Bas",
        "dpf": True,  # adhère au Data Privacy Framework UE–États-Unis
        "tracks": True,  # la plateforme ajoute ses propres traceurs autour de l'application
    },
}

# (mot cherché dans l'adresse, nom affiché) : le premier qui correspond l'emporte
DATABASES = [("neon", "Neon"), ("supabase", "Supabase"), ("render", "Render"), ("aiven", "Aiven"),
             ("railway", "Railway")]
UNKNOWN_DATABASE = "un hébergeur de bases de données"
EMAIL_PROVIDERS = [("brevo", "Brevo (France)"), ("sendinblue", "Brevo (France)"), ("mailjet", "Mailjet (France)"),
                   ("ovh", "OVHcloud (France)"), ("gmail", "Google (Gmail)"), ("google", "Google (Gmail)"),
                   ("sendgrid", "SendGrid (États-Unis)"), ("mailgun", "Mailgun (États-Unis)"),
                   ("resend", "Resend (États-Unis)"), ("outlook", "Microsoft"), ("office365", "Microsoft")]
UNKNOWN_EMAIL_PROVIDER = "un prestataire d'envoi d'e-mails"
LOGIN_NAMES = {"google": "Google", "facebook": "Facebook", "auth0": "Auth0", "microsoft": "Microsoft"}
# Le domaine de server_metadata_url, quand la section de secrets n'a pas de nom de service
LOGIN_DOMAINS = [("google", "Google"), ("facebook", "Facebook"), ("auth0", "Auth0"), ("microsoft", "Microsoft")]
UNKNOWN_LOGIN = "un service de connexion"
AI_KEYS = [("GEMINI_API_KEY", "Gemini"), ("GROQ_API_KEY", "Groq")]


@dataclass(frozen=True)
class LegalConfig:
    editor: str = EDITOR
    contact: str | None = CONTACT  # secret CONTACT_EMAIL, sinon l'adresse du site
    site_url: str = DEFAULT_SITE_URL
    hosting: str = "streamlit"
    database: str | None = None  # None : SQLite, sur le serveur de l'appli
    email_provider: str | None = None  # None : aucun e-mail envoyé
    logins: tuple[str, ...] = ()
    ai: tuple[str, ...] = ()
    email_accounts: bool = False  # vrai si un envoi d'e-mails existe (codes de confirmation, brief, alertes)


def _text(secrets: Mapping, name: str) -> str | None:
    value = secrets.get(name)
    return (str(value).strip() or None) if value is not None else None


def _first_match(text: str, table: list[tuple[str, str]]) -> str | None:
    text = text.lower()
    return next((label for word, label in table if word in text), None)


def _logins(auth) -> tuple[str, ...]:
    """Les services de la section `auth` des secrets (celle de st.login) : [auth.google], [auth.auth0]… ou, à défaut,
    le domaine de `server_metadata_url`."""
    if not auth or not hasattr(auth, "items"):
        return ()
    sections = [(name, value) for name, value in auth.items() if hasattr(value, "get")]
    if not sections and auth.get("client_id"):
        sections = [("", auth)]  # un seul service, décrit directement dans [auth]
    found = []
    for name, value in sections:
        label = LOGIN_NAMES.get(str(name).lower())
        if label is None:
            host = urlparse(str(value.get("server_metadata_url") or "")).hostname or ""
            label = _first_match(host, LOGIN_DOMAINS) or UNKNOWN_LOGIN
        if label not in found:
            found.append(label)
    return tuple(found)


def config_from(secrets: Mapping) -> LegalConfig:
    """La configuration légale d'après les secrets : on n'y lit que des noms de clés et des noms d'hôtes."""
    database_url = _text(secrets, "DATABASE_URL")
    database = None
    if database_url:
        host = urlparse(database_url).hostname or database_url.rpartition("@")[2]
        database = _first_match(host, DATABASES) or UNKNOWN_DATABASE
    smtp_host = _text(secrets, "SMTP_HOST")
    email_provider = (_first_match(smtp_host, EMAIL_PROVIDERS) or UNKNOWN_EMAIL_PROVIDER) if smtp_host else None
    return LegalConfig(
        contact=_text(secrets, "CONTACT_EMAIL") or CONTACT,
        site_url=(_text(secrets, "SITE_URL") or DEFAULT_SITE_URL).rstrip("/"),
        hosting=(_text(secrets, "HOSTING") or "streamlit").lower(),
        database=database,
        email_provider=email_provider,
        logins=_logins(secrets.get("auth")),
        ai=tuple(label for key, label in AI_KEYS if _text(secrets, key)),
        email_accounts=bool(smtp_host),
    )


# --- Les morceaux communs ---------------------------------------------------------------------------------------

PAGES = {  # titre et adresse relative de chaque page
    "mentions": ("Mentions légales", "./mentions-legales"),
    "privacy": ("Politique de confidentialité", "./confidentialite"),
    "cookies": ("Politique des cookies", "./cookies"),
    "terms": ("Conditions d'utilisation", "./conditions"),
}
GOOGLE_PHOTO = ", ainsi que ta photo de profil Google si tu te connectes avec Google"
GEMINI_WARNING = ("Dans la formule gratuite de Gemini, Google peut utiliser les contenus envoyés pour "
                  "améliorer ses services, et des personnes peuvent les relire : n'y écris jamais d'informations "
                  "personnelles.")


def host_of(cfg: LegalConfig) -> dict:
    """L'hébergeur configuré ; un hébergeur inconnu n'a que son nom (on n'invente rien)."""
    return HOSTS.get(cfg.hosting) or {"name": cfg.hosting}


def contact_md(cfg: LegalConfig) -> str:
    return f"[{cfg.contact}](mailto:{cfg.contact})" if cfg.contact else NO_CONTACT


def _head(title: str) -> str:
    return f"# {title}\n\n*Mise à jour : {UPDATED}*\n"


def _see_also(current: str) -> str:
    links = " · ".join(f"[{title}]({url})" for key, (title, url) in PAGES.items() if key != current)
    return f"---\n\nÀ lire aussi : {links}\n"


def _join(items: list[str]) -> str:
    """« a », « a et b », « a, b et c »."""
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " et " + items[-1]


def _cell(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", " ")


def _table(head: list[str], rows: list[list[str]]) -> str:
    lines = ["| " + " | ".join(head) + " |", "|" + " --- |" * len(head)]
    lines += ["| " + " | ".join(_cell(cell) for cell in row) + " |" for row in rows]
    return "\n".join(lines) + "\n"


def _host_lines(cfg: LegalConfig) -> list[str]:
    host = host_of(cfg)
    first = f"**{host['name']}**" + (f", service de **{host['company']}**" if host.get("company") else "")
    lines = [first if host.get("company", "").endswith(".") else first + "."]  # « Snowflake Inc. » a déjà son point
    if host.get("address"):
        lines.append(f"- Adresse : {host['address']}")
    if host.get("phone"):
        lines.append(f"- Téléphone : {host['phone']}")
    if host.get("site"):
        lines.append(f"- Site : <{host['site']}>")
    return lines


# --- 1. Mentions légales ----------------------------------------------------------------------------------------


def mentions_legales(cfg: LegalConfig) -> str:
    contact = contact_md(cfg)
    host_lines = _host_lines(cfg)
    return f"""{_head("Mentions légales")}
## Éditeur du site

FinVeille ({cfg.site_url}) est un site personnel, non professionnel, édité par **{cfg.editor}**, personne physique
résidant en France.

- Directeur de la publication : {cfg.editor}
- Contact : {contact}

## Hébergeur

{host_lines[0]}

{chr(10).join(host_lines[1:])}

## Propriété intellectuelle

Le code, le design et les textes de FinVeille appartiennent à l'éditeur. Les titres et les extraits d'articles
affichés restent la propriété de leurs éditeurs : chacun renvoie vers l'article original. Les données de marché sont
fournies à titre indicatif, en différé.

## Signaler un contenu

Un contenu te semble illicite, inexact ou porte atteinte à tes droits ? Écris à {contact}, en indiquant la page
concernée : l'éditeur y répond dès que possible.

## Crédits

- Polices IBM Plex, sous licence SIL Open Font License.
- Three.js, sous licence MIT.
- GSAP, sous la licence gratuite « Standard No Charge » de GreenSock (Webflow).
- Icônes Material Symbols, sous licence Apache 2.0.

{_see_also("mentions")}"""


# --- 2. Politique de confidentialité ----------------------------------------------------------------------------


def _recipients(cfg: LegalConfig) -> str:
    host = host_of(cfg)
    items = [f"- **L'hébergeur** : {host['name']}" + (f" ({host['company']})" if host.get("company") else "")
             + ", qui fait tourner le site et reçoit ton adresse IP dans ses journaux techniques."]
    if cfg.database:
        items.append(f"- **La base de données** : {cfg.database}, où sont gardées les données de ton compte.")
    else:
        items.append("- **La base de données** : elle est sur le serveur de l'application, chez l'hébergeur.")
    if cfg.email_provider:
        items.append(f"- **L'envoi d'e-mails** : {cfg.email_provider}, qui transmet les codes de confirmation, le "
                     "brief du matin et les alertes que tu as demandés.")
    for login in cfg.logins:
        items.append(f"- **La connexion** : {login}, quand tu te connectes avec ce service. FinVeille en reçoit ton "
                     "identifiant, ton e-mail et ton nom.")
    for engine in cfg.ai:
        if engine == "Gemini":
            items.append(f"- **L'assistant IA** : Gemini (Google). {GEMINI_WARNING}")
        elif engine == "Groq":
            items.append("- **L'assistant IA** : Groq (Groq Inc., États-Unis).")
        else:
            items.append(f"- **L'assistant IA** : {engine}.")
    return "\n".join(items)


def confidentialite(cfg: LegalConfig) -> str:
    contact = contact_md(cfg)
    host = host_of(cfg)
    google_photo = GOOGLE_PHOTO if "Google" in cfg.logins else ""
    rows = [
        ["Ta visite, sans compte", "Faire fonctionner et protéger le site",
         "Intérêt légitime (sécurité et fonctionnement)",
         "FinVeille n'enregistre rien. L'hébergeur traite ton adresse IP dans ses journaux techniques."],
        ["Ton compte et ses contenus : identifiant, e-mail, nom, dates de création et de dernière visite, favoris, "
         "articles lus ou masqués, notes, suivis, portefeuille virtuel, alertes de cours, préférences",
         "Te fournir le service", "Exécution des conditions d'utilisation",
         "Jusqu'à la suppression du compte, ou 3 ans sans connexion"],
        ["La sécurité des comptes « e-mail et mot de passe » : empreinte du mot de passe, échecs de connexion"
         + (", codes à 6 chiffres" if cfg.email_accounts else "") + ", sessions (empreinte du jeton)",
         "Protéger les comptes (blocage de 15 minutes après 5 échecs, session de 30 jours)", "Intérêt légitime",
         "De 15 minutes à 30 jours"],
    ]
    if cfg.email_provider:
        rows.append(["Ton adresse e-mail, pour le brief du matin et les alertes", "T'envoyer ce que tu as demandé",
                     "Ton consentement, que tu peux retirer à tout moment", "Jusqu'à ce que tu les désactives"])
    if cfg.ai:
        rows.append(["Tes questions à l'assistant IA et les dépêches utiles à la réponse", "Rédiger la réponse",
                     "Exécution du service", "FinVeille n'enregistre rien"])
    table = _table(["Ce qui est traité", "Pourquoi", "Sur quelle base", "Combien de temps"], rows)
    transfers = ("Certains destinataires sont établis aux États-Unis, hors de l'Union européenne. Le transfert "
                 "s'appuie alors sur le Data Privacy Framework UE–États-Unis quand le prestataire y adhère, sinon "
                 "sur les clauses contractuelles types de la Commission européenne.")
    if host.get("dpf"):
        transfers += f" L'hébergeur, {host.get('company') or host['name']}, adhère au Data Privacy Framework."
    if host.get("privacy"):
        transfers += f" Son avis de confidentialité : <{host['privacy']}>."
    if host.get("eu_representative"):
        transfers += (f" Son représentant dans l'Union européenne : {host['eu_representative']}"
                      + (f" ({host['privacy_email']})." if host.get("privacy_email") else "."))
    return f"""{_head("Politique de confidentialité")}
Cette page explique quelles données personnelles FinVeille traite, pourquoi et comment tu gardes la main dessus.

## Qui est responsable ?

Le responsable du traitement est **{cfg.editor}**, éditeur du site. Pour toute question : {contact}.

## Ce qui est traité

{table}
Sans compte, FinVeille n'enregistre rien sur toi. Les cookies sont détaillés dans la
[politique des cookies]({PAGES["cookies"][1]}).

## Qui reçoit des données ?

{_recipients(cfg)}

## Transferts hors de l'Union européenne

{transfers}

## Contenus de tiers

Ton navigateur charge directement les photos des articles (depuis les sites des médias) et les images des
cryptomonnaies (depuis CoinGecko){google_photo}. Leurs serveurs reçoivent ton adresse IP et
peuvent poser des cookies techniques. Tu peux couper les photos des articles dans Réglages, option « Afficher les
photos des articles ».

Les données de marché et les actualités sont récupérées par le serveur de FinVeille : aucune donnée personnelle
n'y est envoyée.

## Ce que FinVeille ne fait pas

FinVeille ne vend aucune donnée, n'affiche aucune publicité, ne fait aucun profilage et ne prend aucune décision
automatisée à ton sujet.

## Sécurité

Le site est servi en HTTPS. Les mots de passe sont gardés sous forme d'empreinte (scrypt), jamais en clair. Les
jetons de session et les codes de confirmation sont eux aussi gardés en empreinte.

## Âge

Le service s'adresse aux personnes de 15 ans et plus. En dessous, l'accord d'un parent est nécessaire.

## Tes droits

Tu peux demander l'accès à tes données, leur rectification, leur effacement, la limitation du traitement, t'y
opposer, les récupérer dans un format réutilisable (portabilité), retirer ton consentement à tout moment et donner
des directives sur le sort de tes données après ton décès.

- Depuis la page « Mon compte » : « Télécharger toutes mes données (JSON) » et « Supprimer mon compte et mes
  données ».
- Ou par e-mail à {contact} : la réponse arrive sous un mois.

## Réclamation

Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL : [www.cnil.fr](https://www.cnil.fr),
3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.

{_see_also("privacy")}"""


# --- 3. Politique des cookies -----------------------------------------------------------------------------------


def _cookie_rows(cfg: LegalConfig) -> list[list[str]]:
    rows = [
        ["`_streamlit_xsrf`", "Streamlit", "Protège contre les requêtes falsifiées", "La session de navigation", "Oui"],
        ["`fv_session`", "FinVeille",
         "Garde ta connexion à un compte « e-mail et mot de passe » ; posé seulement après une connexion "
         "(la base n'en garde que l'empreinte)", "30 jours", "Oui (authentification)"],
    ]
    if cfg.logins:
        rows.append(["`_streamlit_user`, `_streamlit_user_tokens`", "Streamlit",
                     f"Gardent ta connexion avec {_join(list(cfg.logins))}", "30 jours",
                     "Oui (authentification)"])
    rows.append(["`stActiveTheme-…` (stockage local du navigateur)", "Streamlit",
                 "Retient le thème d'affichage (clair, sombre ou celui du système) ; ne t'identifie pas",
                 "Jusqu'à ce que tu l'effaces", "Oui (préférence d'affichage)"])
    return rows


def _host_trackers(cfg: LegalConfig) -> str:
    host = host_of(cfg)
    privacy = f" Avis de confidentialité de l'hébergeur : <{host['privacy']}>." if host.get("privacy") else ""
    return f"""## Les traceurs de l'hébergeur

FinVeille ne pose aucun cookie de mesure d'audience, de publicité ou de réseau social, et Streamlit est réglé pour ne
pas envoyer de statistiques d'usage. **Mais** {host['name']}, la plateforme qui héberge le site, ajoute autour de
l'application ses propres traceurs, que FinVeille ne peut pas empêcher. Mesurés le 22 octobre 2026, on y trouve :

- `_ga`, `_gid` et `_dc_gtm_UA-…` (Google Analytics) ;
- `ajs_anonymous_id` (Segment) et `_dd_s` (Datadog) ;
- des appels à Heap et à DoubleClick ;
- ses cookies techniques `streamlit_session`, `_streamlit_csrf` et `proxy-tracking-id`.

Ces traceurs dépendent de l'hébergeur, pas de l'éditeur.{privacy}

Pour les bloquer, utilise les réglages de ton navigateur ou un bloqueur de traceurs.
"""


def cookies(cfg: LegalConfig) -> str:
    google_photo = GOOGLE_PHOTO if "Google" in cfg.logins else ""
    table = _table(["Nom", "Qui le pose", "À quoi il sert", "Durée", "Nécessaire ?"], _cookie_rows(cfg))
    trackers = _host_trackers(cfg) if host_of(cfg).get("tracks") else ""
    return f"""{_head("Politique des cookies")}
Un cookie est un petit fichier que ton navigateur garde à la demande d'un site. Voici ceux de FinVeille.

## Les cookies de FinVeille

{table}
## Pourquoi il n'y a pas de bandeau de consentement

La CNIL exempte de consentement les traceurs strictement nécessaires au service que tu demandes : authentification,
sécurité, préférence que tu as choisie. Tous ceux de FinVeille sont de ce type. FinVeille ne pose aucun cookie de
mesure d'audience, de publicité ou de réseau social.

## Les contenus de tiers

Ton navigateur charge les photos des articles (depuis les sites des médias) et les images des cryptomonnaies
(depuis CoinGecko){google_photo}. Leurs serveurs reçoivent ton adresse IP et peuvent poser des
cookies techniques, par exemple `__cf_bm` (anti-robots de Cloudflare, 30 minutes). Tu peux couper les photos des
articles dans Réglages, option « Afficher les photos des articles », ou avec le filtre « Photos des articles » du fil.

{trackers}
## Supprimer ou bloquer les cookies

Tous les navigateurs permettent de voir, supprimer ou bloquer les cookies dans leurs réglages (rubrique
confidentialité ou sécurité). Bloquer les cookies nécessaires empêche de rester connecté.

{_see_also("cookies")}"""


# --- 4. Conditions d'utilisation --------------------------------------------------------------------------------


def conditions(cfg: LegalConfig) -> str:
    contact = contact_md(cfg)
    mentions, privacy = PAGES["mentions"][1], PAGES["privacy"][1]
    return f"""{_head("Conditions d'utilisation")}
## Objet

FinVeille est un service gratuit d'information financière et économique, édité par {cfg.editor}. Ces conditions
disent comment l'utiliser.

## Acceptation

Utiliser le site vaut acceptation de ces conditions. Créer un compte demande de les accepter.

## Accès au service

Le service est gratuit. Il est fourni sans garantie de disponibilité et peut évoluer ou s'arrêter.

## Ton compte

- Tu as 15 ans ou plus, ou l'accord d'un parent.
- Les informations que tu donnes sont exactes.
- Ton mot de passe est personnel : ne le partage pas.
- Tu peux supprimer ton compte à tout moment (page « Mon compte »).

## Les contenus

- **Actualités** : elles viennent de flux publics. FinVeille affiche les titres, des extraits et des liens vers les
  originaux ; les articles appartiennent à leurs éditeurs.
- **Données de marché** : différées et indicatives.
- **Résumés et réponses de l'IA** : rédigés automatiquement, ils peuvent contenir des erreurs. Vérifie-les dans les
  sources citées.
- **Simulateurs et portefeuille virtuel** : ils sont pédagogiques.

## Pas de conseil en investissement

FinVeille ne fournit aucune recommandation personnalisée. Investir comporte un risque de perte en capital, et les
cryptoactifs sont très volatils. Ne prends pas de décision financière sur la seule base de ce site.

## Usage acceptable

Pas d'accès automatisé massif, pas de tentative d'intrusion, pas de contournement des limites du service.

## Responsabilité

Le site est fourni tel quel. L'éditeur ne répond pas des décisions prises à partir de ses informations.

## Propriété intellectuelle et données personnelles

La propriété intellectuelle est détaillée dans les [mentions légales]({mentions}). Le traitement de tes données
personnelles est expliqué dans la [politique de confidentialité]({privacy}).

## Pas de vente

FinVeille ne vend rien : il n'y a donc ni conditions de vente ni remboursement.

## Modification des conditions

Ces conditions peuvent changer ; la date de mise à jour figure en haut de cette page ({UPDATED}).

## Droit applicable

Ces conditions relèvent du droit français. En cas de litige, on cherche d'abord une solution amiable : écris à
{contact}.

{_see_also("terms")}"""
