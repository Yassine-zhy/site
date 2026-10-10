"""Éléments d'interface partagés par plusieurs pages."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import streamlit as st
import streamlit.components.v1 as components

import theme
from core import accounts, crypto, macro, market, notify, storage
from core.aggregator import collect_articles, collect_followed
from core.market import fetch_quotes
from core.config import AI_KEYS, API_KEYS, CATEGORIES, COMPANIES
from core.models import Article
from core.summarizer import summarize
from theme import esc, safe_url

NO_STATUS = {flag: False for flag in storage.FLAGS}


def get_secret(name: str) -> str | None:
    """Lit une clé dans .streamlit/secrets.toml, ou à défaut dans les variables d'environnement."""
    try:
        value = st.secrets.get(name)
    except FileNotFoundError:  # pas de fichier secrets.toml : ce n'est pas une erreur
        value = None
    return value or os.environ.get(name) or None


def api_keys() -> dict[str, str | None]:
    """Toutes les clés API connues, None pour celles qui ne sont pas renseignées."""
    return {name: get_secret(name) for name in API_KEYS}


def ai_keys() -> dict[str, str | None]:
    """Clés (et modèles, facultatifs) des moteurs de résumé par IA."""
    return {name: get_secret(name) for name in [*AI_KEYS, "GEMINI_MODEL", "GROQ_MODEL"]}


# --- Comptes utilisateurs ---------------------------------------------------------------------
# Trois façons de se connecter (étapes 14 et 22) :
# - e-mail + mot de passe, géré par FinVeille (toujours disponible, rien à configurer) ;
# - Google, ou d'autres comptes (Facebook…) via Auth0, avec st.login, si [auth] est configuré dans les secrets ;
# - « mode local » (LOCAL_MODE = true) : un seul utilisateur, sans connexion, pour un usage personnel.
COOKIE = "fv_session"  # le cookie qui garde la connexion e-mail 30 jours

# Libellé et icône du bouton de connexion pour chaque service (nom de la section [auth.xxx] de secrets.toml)
PROVIDERS = {
    "google": ("Continuer avec Google", None),  # le logo « G » est ajouté en CSS (theme.py)
    "auth0": ("Facebook et autres comptes", ":material/group:"),
    "microsoft": ("Continuer avec Microsoft", ":material/account_circle:"),
    None: ("Se connecter avec mon compte", ":material/login:"),
}
SMTP_KEYS = ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM")


def local_mode() -> bool:
    """Vrai si l'appli tourne pour une seule personne, sans comptes (LOCAL_MODE = true dans les secrets)."""
    return str(get_secret("LOCAL_MODE") or "").strip().lower() in ("1", "true", "oui", "yes")


def smtp_settings() -> notify.SmtpSettings | None:
    """Le service d'envoi d'e-mails (codes de confirmation, mot de passe oublié), s'il est configuré."""
    return notify.SmtpSettings.from_env({name: get_secret(name) for name in SMTP_KEYS})


def auth_providers() -> list[str | None]:
    """Les services de connexion configurés dans secrets.toml : ["google", "auth0"], [None] ou []."""
    try:
        auth = st.secrets.get("auth")
    except FileNotFoundError:
        return []
    if not auth:
        return []
    providers = [name for name, value in auth.items() if hasattr(value, "keys")]  # sous-sections [auth.xxx]
    if not providers and "client_id" in auth:
        return [None]  # un seul service, décrit directement dans [auth]
    return providers


def _oidc_user() -> str | None:
    """L'utilisateur connecté avec Google ou Auth0 (st.login), ou None."""
    if not auth_providers() or not st.user.get("is_logged_in", False):  # st.user est vide sans [auth]
        return None
    email = st.user.get("email")
    # Un e-mail non vérifié ne doit pas donner accès aux données d'un compte qui a la même adresse : on utilise
    # alors l'identifiant unique du service (« sub »).
    user = email if email and st.user.get("email_verified", False) else st.user.get("sub") or email
    if st.session_state.get("fv_known_user") != user:  # une fois par session : on enregistre la visite
        storage.touch_user(user, email, st.user.get("name"))
        st.session_state["fv_known_user"] = user
    return user


def _cookie_token() -> str | None:
    """Le jeton de session lu dans le cookie du navigateur (ou None)."""
    try:
        token = st.context.cookies.get(COOKIE)
    except Exception:  # hors d'une vraie page (tests, script) : pas de cookie
        return None
    return token if isinstance(token, str) and token else None


def current_user() -> str | None:
    """Qui utilise l'application ? L'identifiant du compte connecté, LOCAL_USER en mode local, sinon None."""
    if local_mode():
        return storage.LOCAL_USER
    if user := _oidc_user():
        return user
    if user := st.session_state.get("fv_user"):
        return user
    token = _cookie_token()
    if token and st.session_state.get("fv_cookie_checked") != token:  # une seule lecture de la base par session
        st.session_state["fv_cookie_checked"] = token
        if user := accounts.session_user(token):
            st.session_state["fv_user"], st.session_state["fv_token"] = user, token
            return user
        st.session_state["fv_cookie_set"] = ""  # jeton expiré ou inconnu : on efface le cookie
    return None


def sign_in(user: str) -> None:
    """Ouvre une session de 30 jours ; le cookie est posé par sync_cookie() au prochain affichage."""
    token = accounts.create_session(user)
    st.session_state["fv_user"], st.session_state["fv_token"] = user, token
    st.session_state["fv_cookie_set"] = token
    profile = storage.get_user(user) or {}
    storage.touch_user(user, profile.get("email"), profile.get("name"))  # date de dernière visite


def sign_out() -> None:
    """Callback « Se déconnecter » : ferme la session e-mail (et la session Google ou Auth0)."""
    accounts.end_session(st.session_state.get("fv_token") or _cookie_token())
    for key in ("fv_user", "fv_token", "fv_known_user"):
        st.session_state.pop(key, None)
    st.session_state["fv_cookie_set"] = ""
    if auth_providers() and st.user.get("is_logged_in", False):
        st.logout()


def sync_cookie() -> None:
    """Pose (ou efface) le cookie de session dans le navigateur, via un petit script.

    Streamlit ne sait pas écrire de cookie depuis Python : on affiche un composant HTML invisible dont le script
    écrit `document.cookie` de la page (le cadre du composant a la même origine que la page).
    """
    if "fv_cookie_set" not in st.session_state:
        return
    token = st.session_state.pop("fv_cookie_set")
    age = accounts.SESSION_DAYS * 86400 if token else 0
    script = (
        "<script>const secure = window.parent.location.protocol === 'https:' ? '; Secure' : '';"
        f"window.parent.document.cookie = '{COOKIE}={token}; path=/; max-age={age}; SameSite=Lax' + secure;</script>"
    )
    with st.container(key="fvcookie"):
        components.html(script, height=0)


def login_buttons(key: str) -> None:
    """Un bouton par service de connexion configuré (Google, Auth0…)."""
    for provider in auth_providers():
        label, icon = PROVIDERS.get(provider, (f"Continuer avec {str(provider).capitalize()}", ":material/login:"))
        st.button(label, icon=icon, key=f"{key}_{provider}", width="stretch",
                  on_click=st.login, args=(provider,) if provider else ())


def _attempt_allowed() -> bool:
    """Au plus 20 tentatives (connexions, codes) par session : freine les robots, même sur plusieurs adresses."""
    st.session_state["fv_attempts"] = st.session_state.get("fv_attempts", 0) + 1
    if st.session_state["fv_attempts"] > 20:
        st.error("Trop de tentatives depuis ce navigateur. Réessaie plus tard.")
        return False
    return True


def _send_code(email: str, purpose: str) -> bool:
    """Envoie un code à 6 chiffres par e-mail. Renvoie False (avec un message) si l'envoi échoue."""
    settings = smtp_settings()
    subject, text, html_body = notify.code_email(accounts.issue_code(email, purpose), purpose)
    try:
        notify.send(notify.make_message(settings.sender, email, subject, text, html_body), settings)
    except Exception:  # serveur d'envoi injoignable : on n'affiche pas le détail (il peut contenir des secrets)
        st.error("Impossible d'envoyer l'e-mail pour le moment. Réessaie dans quelques minutes.")
        return False
    return True


def _login_form(key: str) -> None:
    with st.form(f"{key}_login", border=False):
        email = st.text_input("E-mail", autocomplete="email", key=f"{key}_login_email")
        password = st.text_input("Mot de passe", type="password", autocomplete="current-password",
                                 key=f"{key}_login_password")
        if st.form_submit_button("Se connecter", type="primary", width="stretch") and _attempt_allowed():
            try:
                user = accounts.authenticate(email, password)
            except accounts.AccountError as error:
                if error.needs_verification and smtp_settings() and _send_code(accounts.normalize_email(email), "verify"):
                    st.session_state["fv_verify_email"] = accounts.normalize_email(email)
                    st.rerun()
                st.error(str(error))
            else:
                sign_in(user)
                st.rerun()


def _signup_form(key: str) -> None:
    with st.form(f"{key}_signup", border=False):
        name = st.text_input("Prénom ou pseudo", max_chars=40, autocomplete="given-name", key=f"{key}_signup_name")
        email = st.text_input("E-mail", autocomplete="email", key=f"{key}_signup_email")
        password = st.text_input("Mot de passe", type="password", autocomplete="new-password",
                                 help="Au moins 8 caractères, avec des lettres et des chiffres.",
                                 key=f"{key}_signup_password")
        confirm = st.text_input("Confirme le mot de passe", type="password", autocomplete="new-password",
                                key=f"{key}_signup_confirm")
        if st.form_submit_button("Créer mon compte", type="primary", width="stretch") and _attempt_allowed():
            if password != confirm:
                st.error("Les deux mots de passe sont différents.")
                return
            verify = smtp_settings() is not None  # sans service d'envoi, on ne peut pas confirmer l'adresse
            try:
                user = accounts.register(email, password, name, verified=not verify)
            except accounts.AccountError as error:
                st.error(str(error))
                return
            if verify:
                st.session_state["fv_verify_email"] = accounts.normalize_email(email)
                _send_code(accounts.normalize_email(email), "verify")
            else:
                sign_in(user)
            st.rerun()


def _verify_form(key: str, email: str) -> None:
    st.info(f"Un code à 6 chiffres vient d'être envoyé à {email}. Saisis-le pour activer ton compte.",
            icon=":material/mark_email_read:")
    with st.form(f"{key}_verify", border=False):
        code = st.text_input("Code reçu par e-mail", max_chars=6, key=f"{key}_verify_code")
        if st.form_submit_button("Activer mon compte", type="primary", width="stretch") and _attempt_allowed():
            try:
                user = accounts.confirm_email(email, code)
            except accounts.AccountError as error:
                st.error(str(error))
            else:
                st.session_state.pop("fv_verify_email", None)
                sign_in(user)
                st.rerun()
    left, right = st.columns(2)
    if left.button("Renvoyer le code", key=f"{key}_resend", type="tertiary") and _attempt_allowed():
        if _send_code(email, "verify"):
            st.toast("Nouveau code envoyé")
    if right.button("Annuler", key=f"{key}_cancel_verify", type="tertiary"):
        st.session_state.pop("fv_verify_email", None)
        st.rerun()


def _reset_forms(key: str) -> None:
    if smtp_settings() is None:
        st.caption("Le site n'a pas encore de service d'envoi d'e-mails : la réinitialisation du mot de passe n'est "
                   "pas disponible. Contacte l'administrateur du site.")
        return
    email = st.session_state.get("fv_reset_email")
    if not email:
        with st.form(f"{key}_reset_ask", border=False):
            address = st.text_input("E-mail de ton compte", autocomplete="email", key=f"{key}_reset_email")
            if st.form_submit_button("Recevoir un code", width="stretch") and _attempt_allowed():
                try:
                    address = accounts.normalize_email(address)
                except accounts.AccountError as error:
                    st.error(str(error))
                    return
                if storage.get_credentials(address):  # on n'envoie qu'aux comptes existants…
                    _send_code(address, "reset")
                st.session_state["fv_reset_email"] = address  # … mais on répond pareil dans tous les cas
                st.rerun()
        return
    st.info(f"Si un compte existe pour {email}, un code vient d'y être envoyé.", icon=":material/mail:")
    with st.form(f"{key}_reset", border=False):
        code = st.text_input("Code reçu par e-mail", max_chars=6, key=f"{key}_reset_code")
        password = st.text_input("Nouveau mot de passe", type="password", autocomplete="new-password",
                                 key=f"{key}_reset_password")
        if st.form_submit_button("Changer mon mot de passe", type="primary", width="stretch") and _attempt_allowed():
            try:
                user = accounts.reset_password(email, code, password)
            except accounts.AccountError as error:
                st.error(str(error))
            else:
                st.session_state.pop("fv_reset_email", None)
                sign_in(user)
                st.rerun()
    if st.button("Utiliser une autre adresse", key=f"{key}_reset_other", type="tertiary"):
        st.session_state.pop("fv_reset_email", None)
        st.rerun()


def login_panel(key: str, title: str, text: str) -> None:
    """La carte de connexion : services configurés (Google…), puis e-mail et mot de passe, inscription, oubli."""
    with st.container(key=f"fvbox_{key}", width=460):
        st.html(f'<h3 class="fv-box-title">{esc(title)}</h3><p class="fv-box-text">{esc(text)}</p>')
        if email := st.session_state.get("fv_verify_email"):
            _verify_form(key, email)
            return
        login_tab, signup_tab, reset_tab = st.tabs(["Se connecter", "Créer un compte", "Mot de passe oublié"])
        with login_tab:
            if auth_providers():
                login_buttons(key)
                st.html('<div class="fv-or"><span>ou avec ton e-mail</span></div>')
            _login_form(key)
        with signup_tab:
            _signup_form(key)
        with reset_tab:
            _reset_forms(key)
        st.caption("Ton mot de passe n'est jamais enregistré en clair (empreinte scrypt). FinVeille ne garde que ton "
                   "nom et ton e-mail, et tu peux tout supprimer depuis « Mon compte ».")


def require_user() -> str:
    """Renvoie l'utilisateur, ou affiche la carte de connexion et arrête la page."""
    user = current_user()
    if user is None:
        login_panel("require", "Connecte-toi pour accéder à ton espace",
                    "Cette page contient tes données personnelles : favoris, suivis, portefeuille, alertes. "
                    "Elles sont enregistrées dans ton compte et toi seul y as accès.")
        st.stop()
    return user


def is_admin(user: str | None) -> bool:
    """Administrateur : e-mail listé dans ADMIN_EMAILS, ou visite depuis l'ordinateur qui fait tourner le site."""
    host = (st.context.headers.get("Host") or "").split(":")[0]
    if host in ("localhost", "127.0.0.1"):
        return True
    admins = {a.strip().lower() for a in str(get_secret("ADMIN_EMAILS") or "").split(",") if a.strip()}
    email = ((storage.get_user(user) or {}).get("email") or "").lower() if user else ""
    return bool(email) and email in admins


def setting(user: str | None, key: str, default=None):
    """Une préférence de l'utilisateur, ou la valeur par défaut pour un visiteur non connecté."""
    return storage.get_setting(user, key, default) if user else default


@st.cache_data(ttl=900, show_spinner="Récupération des actualités…")
def load_articles(keys: dict[str, str | None]):
    """Appelle les sources au plus une fois toutes les 15 minutes (900 s), pour ménager les quotas des API.

    Renvoie (articles, erreurs, heure de la collecte).
    """
    articles, errors = collect_articles(keys)
    return articles, errors, datetime.now(timezone.utc)


@st.cache_data(ttl=120, show_spinner=False)
def load_quotes():
    """Cours des marchés, rafraîchis au plus toutes les 2 minutes. Liste vide si Yahoo ne répond pas."""
    try:
        return fetch_quotes()
    except Exception:  # yfinance peut lever des erreurs très variées (réseau, quota, format) : on n'affiche rien
        return []


@st.cache_data(ttl=900, show_spinner="Récupération de tes fils dédiés…")
def load_followed(follows: tuple[tuple[str, str, str], ...], keys: dict[str, str | None]):
    """Fils dédiés aux suivis. `follows` est un tuple (et pas une liste) pour pouvoir servir de clé de cache."""
    base, _, _ = load_articles(keys)
    rows = [{"kind": kind, "value": value, "label": label} for kind, value, label in follows]
    return collect_followed(rows, keys, base)


@st.cache_data(ttl=3600, show_spinner=False)
def search_companies(query: str):
    try:
        return market.search_companies(query)
    except Exception:  # même raison que load_quotes : yfinance peut échouer de multiples façons
        return []


@st.cache_data(ttl=6 * 3600, show_spinner=False)
def load_profile(symbol: str) -> dict:
    """Fiche d'une entreprise, gardée 6 heures (ces données changent peu)."""
    try:
        return market.company_profile(symbol)
    except Exception:
        return {}


@st.cache_data(ttl=900, show_spinner=False)
def load_history(symbol: str, period: str):
    try:
        return market.price_history(symbol, period)
    except Exception:
        return None


@st.cache_data(ttl=120, show_spinner=False)
def load_followed_quotes(companies: tuple[tuple[str, str], ...]):
    """Cours des entreprises suivies (même format que la page Marchés)."""
    try:
        return fetch_quotes([(symbol, label, "Mes entreprises", "%") for symbol, label in companies])
    except Exception:
        return []


@st.cache_data(ttl=300, show_spinner="Chargement des 40 valeurs du CAC 40…")
def load_cac40():
    try:
        return fetch_quotes([(symbol, name, sector, "%") for symbol, name, sector in market.CAC40])
    except Exception:
        return []


@st.cache_data(ttl=600, show_spinner=False)
def load_euro_rates() -> dict[str, float]:
    try:
        return market.euro_rates()
    except Exception:
        return {}


@st.cache_resource
def _last_good() -> dict:
    """Mémoire partagée par tous les visiteurs : la dernière réponse réussie de chaque source fragile."""
    return {}


@st.cache_data(ttl=300, show_spinner="Cours des cryptomonnaies (CoinGecko)…")
def _crypto_markets() -> list:
    return crypto.fetch_markets()


@st.cache_data(ttl=300, show_spinner=False)
def _crypto_overview() -> dict:
    return crypto.fetch_global()


def load_crypto() -> tuple[list, dict]:
    """Les 20 premières cryptomonnaies et les chiffres du marché, gardés 5 minutes (quota gratuit de CoinGecko).

    Une erreur n'est jamais mise en cache (st.cache_data ne garde que les résultats) : on réessaiera à
    l'affichage suivant. En attendant, on montre les derniers chiffres obtenus, s'il y en a.
    """
    memory = _last_good()
    results = []
    for name, fetch, empty in [("coins", _crypto_markets, []), ("overview", _crypto_overview, {})]:
        try:
            memory[name] = fetch()
        except Exception:
            pass
        results.append(memory.get(name, empty))
    return results[0], results[1]


@st.cache_data(ttl=3600, show_spinner=False)
def load_fear_greed() -> list:
    """L'indice peur et avidité sur un an (publié une fois par jour)."""
    try:
        return crypto.fetch_fear_greed(365)
    except Exception:
        return []


@st.cache_data(ttl=6 * 3600, show_spinner="Chargement des statistiques officielles (BCE, Réserve fédérale)…")
def load_macro(start: str) -> tuple[dict, list[str]]:
    """Les indicateurs économiques : publiés au plus une fois par jour, on les garde 6 heures."""
    return macro.fetch_all(start)


@st.cache_data(ttl=6 * 3600, show_spinner=False)
def load_yield_curves(start: str) -> dict:
    try:
        return macro.fetch_yield_curves(start)
    except Exception:  # une source en panne : la section est simplement masquée
        return {}


@st.cache_data(ttl=6 * 3600, show_spinner=False)
def load_calendar(symbol: str) -> dict:
    try:
        return market.company_calendar(symbol)
    except Exception:
        return {}


@st.cache_data(ttl=900, show_spinner="Téléchargement des historiques…")
def load_closes(symbols: tuple[str, ...], period: str):
    try:
        return market.closes_table(list(symbols), period)
    except Exception:
        return None


@st.cache_data(ttl=120, show_spinner=False)
def load_symbol_quotes(symbols: tuple[str, ...]) -> dict:
    """Cotations d'une liste de symboles, rangées par symbole : {"MC.PA": Quote, …}."""
    if not symbols:
        return {}
    try:
        return {q.symbol: q for q in fetch_quotes([(s, s, "", "%") for s in symbols])}
    except Exception:
        return {}


def company_choices(user: str | None = None) -> dict[str, str]:
    """Les entreprises proposées dans les listes : mes suivis d'abord, puis le CAC 40 et les grandes valeurs."""
    choices = {f["value"]: f["label"] for f in storage.list_follows(user, "company")} if user else {}
    choices |= {symbol: name for symbol, name, _ in market.CAC40 if symbol not in choices}
    choices |= {symbol: name for symbol, (name, _, _) in COMPANIES.items() if symbol not in choices}
    return choices


def _update(user: str, article: Article, flag: str, value: bool, message: str) -> None:
    """Callback des boutons : enregistre le changement et prépare une petite notification.

    On n'appelle pas st.toast ici : un callback qui affiche quelque chose pendant la relance d'un
    fragment n'est pas pris en charge. Le message est affiché par flush_toast() au début de la page.
    """
    storage.set_flag(user, article, flag, value)
    st.session_state["fv_toast"] = message


def flush_toast() -> None:
    """Affiche la notification laissée par le dernier callback, s'il y en a une."""
    if message := st.session_state.pop("fv_toast", None):
        st.toast(message)


def _toggle_summary(article_id: str) -> None:
    key = f"summary_{article_id}"
    st.session_state[key] = not st.session_state.get(key, False)


def summary_html(summary: dict) -> str:
    """Le bloc « L'essentiel » : points clés, portée, moteur utilisé et avertissement."""
    points = "".join(f"<li>{esc(point)}</li>" for point in summary["points"])
    why = (f'<p class="fv-brief-why"><b>Pourquoi c\'est important.</b> {esc(summary["why"])}</p>'
           if summary.get("why") else "")
    note = f" · {esc(summary['note'])}" if summary.get("note") else ""
    return (
        f'<aside class="fv-brief"><div class="fv-brief-head"><span>L\'essentiel</span>'
        f'<small>{esc(summary["engine"])} · {esc(summary["based_on"])}{note}</small></div>'
        f"<ul>{points}</ul>{why}"
        f'<p class="fv-brief-note">Résumé automatique : vérifie dans l\'article avant de citer un chiffre.</p></aside>'
    )


def show_summary(article: Article, user: str | None) -> None:
    """Affiche le résumé de l'article ; le calcule (puis l'enregistre) s'il n'existe pas encore."""
    summary = storage.get_summary(article.id)
    if summary is None:
        with st.spinner("Lecture et résumé de l'article…"):
            engine = setting(user, "summary_engine", "auto")
            summary = summarize(article, ai_keys(), engine).to_dict()
        storage.save_summary(article.id, summary)
    st.html(summary_html(summary))


def _save_note(user: str, article_id: str, widget_key: str) -> None:
    storage.save_note(user, article_id, st.session_state.get(widget_key, ""))
    st.session_state["fv_toast"] = "Note enregistrée"


def article_html(article: Article, read: bool, lead: bool = False, compact: bool = False, echoes: int = 0,
                 show_image: bool = False) -> str:
    """Le HTML d'un article : rubrique, source, heure, titre, chapeau (et photo pour la une, si demandée).

    En vue compacte, on n'affiche ni le chapeau ni la photo : une ligne de titre par article.
    """
    kicker = [
        theme.category_tag(article.category, CATEGORIES.get(article.category, article.category)),
        f'<span class="fv-src"><img src="{theme.favicon_url(article.url)}" alt="" loading="lazy">'
        f"{esc(article.source)}</span>",
        f'<time class="fv-time" datetime="{article.published.isoformat()}">{theme.clock(article.published)}</time>',
        f'<span class="fv-ago">{theme.time_ago(article.published)}</span>',
    ]
    if echoes:
        kicker.append(f'<span class="fv-echo">reprise par {echoes} autre{"s" if echoes > 1 else ""} '
                      f'source{"s" if echoes > 1 else ""}</span>')
    if read:
        kicker.append('<span class="fv-flag">Lu</span>')
    heading = "h2" if lead else "h3"
    text = (
        f'<div class="fv-kicker">{"".join(kicker)}</div>'
        f'<{heading} class="fv-headline"><a href="{safe_url(article.url)}" target="_blank" rel="noopener">'
        f"{esc(article.title)}</a></{heading}>"
        + (f'<p class="fv-dek">{esc(article.summary)}</p>' if article.summary and not compact else "")
    )
    classes = ["fv-item"] + (["is-read"] if read else []) + (["fv-lead"] if lead else []) + (["is-compact"] if compact else [])
    if lead and show_image and article.image:
        classes.append("has-img")
        figure = f'<figure><img src="{safe_url(article.image)}" alt="" loading="lazy"></figure>'
        return f'<article class="{" ".join(classes)}"><div>{text}</div>{figure}</article>'
    return f'<article class="{" ".join(classes)}">{text}</article>'


def article_card(
    article: Article,
    status: dict[str, bool],
    key_prefix: str,
    lead: bool = False,
    compact: bool = False,
    note: str | None = None,
    with_note: bool = False,
    user: str | None = None,
    echoes: int = 0,
    show_image: bool = False,
) -> None:
    """Affiche un article et ses boutons d'action.

    - `key_prefix` rend les clés des boutons uniques quand le même article apparaît sur plusieurs pages ;
    - `compact` : une ligne par article (titre et informations, sans chapeau) ;
    - `note` / `with_note` : affiche la note personnelle et le bouton pour l'écrire (page Favoris) ;
    - `user` : l'utilisateur connecté ; sans utilisateur, seuls « Lire » et « Résumé » sont proposés ;
    - `echoes`, `show_image` (la une) : nombre d'autres sources qui reprennent l'histoire, photo de l'article.
    """
    favorite, read, hidden = status["is_favorite"], status["is_read"], status["is_hidden"]
    key = f"{key_prefix}_{article.id}"

    # La clé du conteneur devient une classe CSS (st-key-fvcard_…) que theme.CSS met en forme.
    summary_open = st.session_state.get(f"summary_{article.id}", False)

    kind = "fvlead" if lead else "fvcompact" if compact else "fvcard"
    with st.container(key=f"{kind}_{key}", gap="small"):
        st.html(article_html(article, read, lead, compact, echoes, show_image))
        if note:
            st.html(f'<blockquote class="fv-note-block"><b>Ma note</b>{esc(note)}</blockquote>')
        if summary_open:
            show_summary(article, user)
        with st.container(horizontal=True, gap="small"):
            st.link_button(
                "Lire", article.url, icon=":material/north_east:", key=f"{key}_open", type="tertiary",
                on_click=_update if user else "ignore",
                args=(user, article, "is_read", True, "Article marqué comme lu") if user else None,
            )
            st.button(
                "Fermer le résumé" if summary_open else "Résumé",
                icon=":material/subject:",
                key=f"{key}_sum",
                type="tertiary",
                help="Résumé automatique de l'article en quelques points",
                on_click=_toggle_summary,
                args=(article.id,),
            )
            if user:
                st.button(
                    "Retirer" if favorite else "Garder",
                    icon=":material/bookmark:" if favorite else ":material/bookmark_border:",
                    key=f"{key}_fav",
                    type="tertiary",
                    help="Retirer des favoris" if favorite else "Ajouter aux favoris",
                    on_click=_update,
                    args=(user, article, "is_favorite", not favorite, "Favori retiré" if favorite else "Ajouté aux favoris"),
                )
                st.button(
                    "Non lu" if read else "Lu",
                    icon=":material/radio_button_unchecked:" if read else ":material/check:",
                    key=f"{key}_read",
                    type="tertiary",
                    on_click=_update,
                    args=(user, article, "is_read", not read, "Marqué comme non lu" if read else "Marqué comme lu"),
                )
                st.button(
                    "Réafficher" if hidden else "Masquer",
                    icon=":material/visibility:" if hidden else ":material/visibility_off:",
                    key=f"{key}_hide",
                    type="tertiary",
                    on_click=_update,
                    args=(user, article, "is_hidden", not hidden, "Article réaffiché" if hidden else "Article masqué"),
                )
            if with_note and user:
                with st.popover("Modifier la note" if note else "Annoter", icon=":material/edit_note:", type="tertiary"):
                    st.text_area("Ma note", value=note or "", key=f"{key}_note", height=110,
                                 placeholder="Pourquoi cet article t'intéresse, à quoi il te servira…")
                    st.button("Enregistrer", key=f"{key}_note_save", type="primary",
                              on_click=_save_note, args=(user, article.id, f"{key}_note"))
