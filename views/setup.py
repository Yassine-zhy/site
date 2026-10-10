"""Page « Configuration » (administrateur) : état des services et valeurs prêtes à copier pour les activer."""

import secrets
from pathlib import Path
from urllib.parse import urlparse

import streamlit as st

import theme
from core import assistant, capacity, notify, storage
from theme import esc
from ui import LAST_GOOD, SYMBOL_QUOTES, ai_keys, auth_providers, current_user, is_admin, local_mode, smtp_settings

theme.page_header("Configuration", "Active les connexions et les services du site. Cette page n'est visible que "
                  "par l'administrateur.", eyebrow="Outils")
user = current_user()
if not is_admin(user):  # sécurité : la page n'apparaît pas dans le menu, mais on vérifie aussi ici
    st.error("Cette page est réservée à l'administrateur du site.")
    st.stop()

providers = auth_providers()
keys = ai_keys()
SERVICES = [
    ("Connexion par e-mail", True, "Inscription et connexion avec un e-mail et un mot de passe. Toujours active.",
     "22-comptes-par-email.md"),
    ("Connexion avec Google", "google" in providers, "Le bouton « Continuer avec Google ».", "14-comptes-utilisateurs.md"),
    ("Facebook et autres comptes", "auth0" in providers, "Facebook, Apple, Microsoft… via le service gratuit Auth0.",
     "14-comptes-utilisateurs.md"),
    ("Envoi d'e-mails", smtp_settings() is not None, "Codes de confirmation, mot de passe oublié, brief et alertes.",
     "21-notifications-par-email.md"),
    ("Base de données en ligne", storage.backend() == "postgres", "Indispensable en ligne : les comptes survivent "
     "aux redémarrages.", "20-base-de-donnees-en-ligne.md"),
    ("Intelligence artificielle", bool(keys.get("GEMINI_API_KEY") or keys.get("GROQ_API_KEY")),
     "Résumés, assistant, analyses d'entreprises et édito du brief (Gemini ou Groq, gratuits).",
     "24-assistant-ia.md"),
]
if local_mode():
    st.warning("Le **mode local** est activé (`LOCAL_MODE = true`) : pas de comptes, une seule personne. Retire ce "
               "réglage pour un site en ligne.", icon=":material/person:")

theme.section("Les services", f"{sum(active for _, active, *_ in SERVICES)} sur {len(SERVICES)} actifs")
cards = "".join(
    f'<div class="fv-kpi"><div class="fv-kpi-label">{esc(name)}</div>'
    f'<div class="fv-service {"is-on" if active else ""}">{"Actif" if active else "À configurer"}</div>'
    f'<div class="fv-kpi-sub">{esc(text)}<br>Guide : <code>guide/{guide}</code></div></div>'
    for name, active, text, guide in SERVICES
)
st.html(f'<div class="fv-kpis">{cards}</div>')

# --- La charge en ce moment (guide 25) ------------------------------------------------------------------


def memory_mb() -> float | None:
    """Mémoire occupée par le serveur (Linux : /proc/self/status) ; None ailleurs (Windows, macOS)."""
    try:
        line = next(row for row in Path("/proc/self/status").read_text().splitlines() if row.startswith("VmRSS:"))
    except (OSError, StopIteration):
        return None
    return int(line.split()[1]) / 1024


@st.fragment(run_every="10s")
def load_panel() -> None:
    queue, memory = capacity.QUEUE.stats(), memory_mb()
    cards = [
        ("Pages en cours d'affichage", f"{queue['running']} / {queue['slots']}",
         f"{queue['waiting']} en attente · record : {queue['max_waiting']} en attente"),
        ("Pages servies", f"{queue['served']:,}".replace(",", "\u202f"),
         f"attente la plus longue : {theme.fr_number(queue['longest_wait'], 1)} s"),
        ("Mémoire du serveur", f"{memory:.0f} Mo" if memory else "—", "à comparer à la limite de ton hébergeur"),
        ("Mémoires partagées", f"{len(LAST_GOOD) + len(SYMBOL_QUOTES) + len(assistant.CACHE)}",
         "données de secours, cours, réponses de l'IA (bornées)"),
    ]
    st.html('<div class="fv-kpis">' + "".join(
        f'<div class="fv-kpi"><div class="fv-kpi-label">{esc(label)}</div><div class="fv-kpi-value">{esc(value)}</div>'
        f'<div class="fv-kpi-sub">{esc(sub)}</div></div>' for label, value, sub in cards) + "</div>")


theme.section("La charge en ce moment", "mis à jour toutes les 10 secondes")
load_panel()
st.caption("Si des visiteurs attendent souvent, augmente RENDER_SLOTS (secrets) ou passe à un hébergement plus "
           "puissant : voir guide/25-tenir-la-charge.md.")

# --- Les valeurs à copier ----------------------------------------------------------------------------
theme.section("Les valeurs à copier", "calculées pour l'adresse de ce site")
url = urlparse(st.context.url or "http://localhost:8501/")
origin = f"{url.scheme}://{url.netloc}"
redirect = f"{origin}/oauth2callback"
if "fv_cookie_secret" not in st.session_state:
    st.session_state["fv_cookie_secret"] = secrets.token_hex(32)  # 64 caractères aléatoires, à garder secrets
st.markdown("**Adresse de retour** à déclarer chez Google (*URI de redirection autorisés*) et chez Auth0 "
            "(*Allowed Callback URLs*) :")
st.code(redirect, language=None)
st.markdown(f"**Adresse de déconnexion** pour Auth0 (*Allowed Logout URLs*) : `{origin}`")

st.markdown("**Ton fichier de secrets**, prêt à compléter (en local : `.streamlit/secrets.toml` ; sur Streamlit "
            "Cloud : *Settings → Secrets*). Remplace seulement les valeurs `COLLE-ICI…` :")
admin_email = (storage.get_user(user) or {}).get("email") or "ton.adresse@gmail.com"
st.code(f'''# Administrateur (accès à cette page en ligne)
ADMIN_EMAILS = "{admin_email}"

# Base en ligne (Neon ou Supabase) — guide 20
DATABASE_URL = "COLLE-ICI-l-adresse-postgresql://..."

# Envoi d'e-mails (Gmail : mot de passe d'application) — guide 21
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = "587"
SMTP_USER = "{admin_email}"
SMTP_PASSWORD = "COLLE-ICI-les-16-lettres"
SMTP_FROM = "FinVeille <{admin_email}>"

# IA gratuite (au moins une des deux) — guide 8 et 24
GEMINI_API_KEY = "COLLE-ICI"
GROQ_API_KEY = "COLLE-ICI"

# --- Connexion Google et autres comptes : toujours À LA FIN du fichier ---
[auth]
redirect_uri = "{redirect}"
cookie_secret = "{st.session_state['fv_cookie_secret']}"

[auth.google]
client_id = "COLLE-ICI.apps.googleusercontent.com"
client_secret = "COLLE-ICI"
server_metadata_url = "https://accounts.google.com/.well-known/openid-configuration"

[auth.auth0]
client_id = "COLLE-ICI"
client_secret = "COLLE-ICI"
server_metadata_url = "https://COLLE-ICI-TON-DOMAINE.eu.auth0.com/.well-known/openid-configuration"
client_kwargs = {{ "prompt" = "login" }}
''', language="toml")
st.caption("Supprime les sections dont tu ne veux pas (par exemple [auth.auth0]). Une section laissée avec "
           "« COLLE-ICI » afficherait un bouton qui ne fonctionne pas.")

# --- Les étapes chez Google, en résumé ------------------------------------------------------------
theme.section("Activer « Continuer avec Google »", "5 minutes, gratuit")
st.markdown(f"""
1. Ouvre la [console Google Cloud](https://console.cloud.google.com/auth/clients) et crée un projet « FinVeille ».
2. **Google Auth Platform → Commencer** : nom de l'appli, ton e-mail, audience **Externe**.
3. **Clients → Créer un client** → *Application Web* → *URI de redirection autorisés* : colle `{redirect}`.
4. Copie l'**ID client** et le **code secret** dans la section `[auth.google]` ci-dessus.
5. **Audience → Publier l'application**, puis redémarre FinVeille : le bouton apparaît sur l'écran de connexion.
""")

# --- Tester l'envoi d'e-mails ---------------------------------------------------------------------
theme.section("Tester l'envoi d'e-mails")
settings = smtp_settings()
if settings is None:
    st.caption("Renseigne d'abord SMTP_HOST, SMTP_USER et SMTP_PASSWORD.")
elif st.button("M'envoyer un e-mail de test", icon=":material/send:"):
    recipient = (storage.get_user(user) or {}).get("email") or settings.user
    try:
        notify.send(notify.make_message(settings.sender, recipient, "FinVeille · e-mail de test",
                                        "L'envoi d'e-mails fonctionne.", "<p>L'envoi d'e-mails fonctionne.</p>"),
                    settings)
    except Exception as error:  # on montre le type d'erreur, jamais le détail (il pourrait contenir un secret)
        st.error(f"Échec de l'envoi ({type(error).__name__}) : vérifie l'adresse du serveur et le mot de passe.")
    else:
        st.success(f"E-mail envoyé à {recipient}.")
