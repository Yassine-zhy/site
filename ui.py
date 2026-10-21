"""Éléments d'interface partagés par plusieurs pages."""

from __future__ import annotations

import functools
import math
import os
import time
from datetime import date, datetime, timezone

import streamlit as st
import streamlit.components.v1 as components

import theme
import requests

from core import accounts, analytics, assistant, capacity, crypto, macro, market, notify, storage
from core.aggregator import collect_articles, collect_followed
from core.market import fetch_quotes
from core.config import AI_KEYS, API_KEYS, CATEGORIES, COMPANIES
from core.models import Article
from core.summarizer import summarize
from theme import esc, safe_url

NO_STATUS = {flag: False for flag in storage.FLAGS}


_NO_SECRETS_FILE = {"until": 0.0}  # sans fichier secrets.toml, Streamlit le recherche à chaque lecture : on s'en souvient


def get_secret(name: str) -> str | None:
    """Lit une clé dans .streamlit/secrets.toml, ou à défaut dans les variables d'environnement (Docker, guide 25)."""
    value = None
    if time.monotonic() >= _NO_SECRETS_FILE["until"]:
        try:
            value = st.secrets.get(name)
        except FileNotFoundError:  # pas de fichier secrets.toml : ce n'est pas une erreur, on revérifie dans 1 min
            _NO_SECRETS_FILE["until"] = time.monotonic() + 60
    return value or os.environ.get(name) or None


def api_keys() -> dict[str, str | None]:
    """Toutes les clés API connues, None pour celles qui ne sont pas renseignées."""
    return {name: get_secret(name) for name in API_KEYS}


def ai_keys() -> dict[str, str | None]:
    """Clés (et modèles, facultatifs) des moteurs de résumé par IA."""
    return {name: get_secret(name) for name in [*AI_KEYS, "GEMINI_MODEL", "GROQ_MODEL"]}


# --- Intelligence artificielle (étape 24) -------------------------------------------------------------
# Les offres gratuites de Gemini et Groq limitent les appels : un quota par personne, un limiteur pour tout le site
# et une mémoire des réponses partagée (core/assistant.py). Les trois réglages sont modifiables dans les secrets.


def _int_secret(name: str, default: int) -> int:
    try:
        return int(get_secret(name) or default)
    except ValueError:
        return default


def ai_enabled() -> bool:
    return bool(assistant.available_engines(ai_keys()))


def ai_quota(user: str | None) -> tuple[int, int]:
    """(questions restantes, limite) : par jour pour un compte, par session pour un visiteur, large en mode local."""
    if user is None:
        limit = _int_secret("AI_VISITOR_LIMIT", 5)
        return max(limit - st.session_state.get("fv_ai_used", 0), 0), limit
    limit = _int_secret("AI_DAILY_LIMIT", 200 if local_mode() else 30)
    return assistant.quota_left(storage.get_setting(user, "ai_usage"), limit, date.today()), limit


def ai_count(user: str | None) -> None:
    """Compte une question posée à l'IA (les réponses en mémoire et les réponses sans IA ne comptent pas)."""
    if user is None:
        st.session_state["fv_ai_used"] = st.session_state.get("fv_ai_used", 0) + 1
    else:
        storage.set_setting(user, "ai_usage", assistant.count_use(storage.get_setting(user, "ai_usage"), date.today()))


def _ai_stream(messages: list[dict], max_tokens: int):
    """Ouvre le flux de la réponse ; (moteur, flux) ou (None, raison) si l'IA ne peut pas répondre maintenant."""
    assistant.LIMITER.per_minute = _int_secret("AI_PER_MINUTE", 10)
    if wait := assistant.LIMITER.try_acquire():
        return None, f"l'IA est très demandée en ce moment, réessaie dans {math.ceil(wait)} s"
    try:
        return assistant.open_stream(messages, ai_keys(), max_tokens)
    except assistant.AssistantError as error:
        return None, f"IA indisponible : {error}"


def stream_ai(messages: list[dict], sources: list[assistant.Source], placeholder, max_tokens: int = 1500) -> dict:
    """Affiche la réponse au fur et à mesure qu'elle arrive. {"text": … ou None, "engine": …, "note": …}"""
    with capacity.QUEUE.released():  # l'IA rédige : une attente réseau, on laisse sa place dans la file
        engine, stream = _ai_stream(messages, max_tokens)
        if engine is None:
            return {"text": None, "engine": "", "note": stream}
        text, note = "", None
        try:
            for piece in stream:
                text += piece
                placeholder.markdown(assistant.linkify(text, sources) + " ▌")
        except requests.RequestException as error:  # coupure en cours de route : on garde le début
            note = f"réponse interrompue ({type(error).__name__})"
        except assistant.Truncated as error:  # gardée à l'écran, mais jamais mise en mémoire (note)
            note = str(error)
    if not text.strip():
        return {"text": None, "engine": engine, "note": note or "réponse vide"}
    placeholder.markdown(assistant.linkify(text, sources))
    return {"text": text, "engine": engine, "note": note}


def complete_ai(messages: list[dict], max_tokens: int = 1500) -> dict:
    """La réponse complète, sans affichage progressif (édito du brief, analyse d'entreprise)."""
    with capacity.QUEUE.released():
        engine, stream = _ai_stream(messages, max_tokens)
        if engine is None:
            return {"text": None, "engine": "", "note": stream}
        try:
            text = "".join(stream).strip()
        except requests.RequestException as error:
            return {"text": None, "engine": engine, "note": f"réponse interrompue ({type(error).__name__})"}
        except assistant.Truncated as error:  # un édito coupé ne doit pas rester affiché 6 heures
            return {"text": None, "engine": engine, "note": str(error)}
    return {"text": text or None, "engine": engine, "note": None if text else "réponse vide"}


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
    """La carte de connexion : services configurés (Google…), puis e-mail et mot de passe, inscription, oubli.
    À droite, une illustration de ce que le compte apporte (masquée sur téléphone)."""
    form_column, picture_column = st.columns([5, 6], gap="large")
    with picture_column:
        st.html(theme.showcase_html())
    with form_column, st.container(key=f"fvbox_{key}"):
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


class PageEnd(Exception):
    """Fin anticipée d'une page, à la place de st.stop() : après st.stop(), Streamlit n'affiche plus rien, pas même le
    pied de page. app.py attrape cette exception, puis dessine le pied de page comme sur les autres pages."""


def end_page():
    """Arrête la page ici (connexion requise, quiz pas commencé…) ; le pied de page s'affiche quand même."""
    raise PageEnd


def require_user() -> str:
    """Renvoie l'utilisateur, ou affiche la carte de connexion et arrête la page."""
    user = current_user()
    if user is None:
        login_panel("require", "Connecte-toi pour accéder à ton espace",
                    "Cette page contient tes données personnelles : favoris, suivis, portefeuille, alertes. "
                    "Elles sont enregistrées dans ton compte et toi seul y as accès.")
        end_page()
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


# --- Chargement des données : en cache, bornées, et résistantes aux pannes (étapes 6 et 25) -----------------
# - chaque fonction est en cache (st.cache_data) : une source n'est interrogée qu'une fois pour tous les visiteurs,
#   et Streamlit garantit qu'un seul visiteur la recharge quand le cache expire (les autres attendent son résultat) ;
# - max_entries borne les caches qui dépendent d'un paramètre (un symbole, une recherche…) : sans limite, des
#   milliers de visiteurs les feraient grossir jusqu'à saturer la mémoire du serveur ;
# - une erreur n'est jamais mise en cache : on montre la dernière réponse réussie (LAST_GOOD) et on réessaie
#   au prochain affichage, au lieu de garder une page vide pour tout le monde pendant toute la durée du cache ;
# - pendant l'attente du réseau, le visiteur rend sa place dans la file d'attente (@_network).

LAST_GOOD = capacity.Memory(max_entries=1000, ttl=24 * 3600)


def _network(func):
    """Pendant un appel réseau (lent, mais sans calcul), la place dans la file d'attente est rendue."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        with capacity.QUEUE.released():
            return func(*args, **kwargs)
    return wrapper


def _resilient(name: str, fetch, *args, empty=None):
    """Appelle `fetch(*args)` (une fonction en cache) ; en cas d'échec, la dernière réponse réussie, sinon `empty`."""
    key = f"{name}|{args!r}"
    try:
        value = fetch(*args)
    except Exception:  # réseau, quota (429), format inattendu… : rien n'est mis en cache, on réessaiera
        found = LAST_GOOD.get(key)
        return empty if found is None else found
    LAST_GOOD.put(key, value)
    return value


def _not_empty(value):
    """Une réponse vide est traitée comme une panne : elle ne doit pas rester en cache."""
    if value is None or (hasattr(value, "__len__") and len(value) == 0):
        raise LookupError("réponse vide")
    return value


@st.cache_data(ttl=900, max_entries=4, show_spinner="Récupération des actualités…")
@_network
def _articles(keys: dict[str, str | None]):
    articles, errors = collect_articles(keys)
    _not_empty(articles)  # toutes les sources en panne : on garde la collecte précédente
    return articles, errors, datetime.now(timezone.utc)


def load_articles(keys: dict[str, str | None]):
    """Appelle les sources au plus une fois toutes les 15 minutes (900 s), pour ménager les quotas des API.

    Renvoie (articles, erreurs, heure de la collecte).
    """
    return _resilient("articles", _articles, keys,
                      empty=([], ["Aucune source ne répond pour le moment"], datetime.now(timezone.utc)))


load_articles.clear = _articles.clear  # bouton « Actualiser » du fil


@st.cache_data(ttl=900, max_entries=8, show_spinner=False)
def load_trends(collected: datetime) -> list[tuple[str, int, int]]:
    """Les sujets qui montent, calculés une fois par collecte (`collected` sert de clé) au lieu d'une fois par
    visiteur : le calcul parcourt toutes les dépêches."""
    articles, _, _ = load_articles(api_keys())
    return analytics.rising_topics(articles, now=datetime.now(timezone.utc))


@st.cache_data(ttl=120, max_entries=2, show_spinner=False)
@_network
def _quotes():
    return _not_empty(market.fetch_quotes_with_fallback(fetch=fetch_quotes))


def load_quotes():
    """Cours des marchés, rafraîchis au plus toutes les 2 minutes ; les derniers connus si Yahoo ne répond pas."""
    return _resilient("quotes", _quotes, empty=[])


def hero_quotes(*symbols: str) -> list:
    """Les cours qui flottent dans l'en-tête d'une page : les données du bandeau, déjà en mémoire (aucun appel réseau
    de plus). Un symbole absent (source en panne) est simplement omis."""
    by_symbol = {quote.symbol: quote for quote in load_quotes()}
    return [by_symbol[symbol] for symbol in symbols if symbol in by_symbol]


@st.cache_data(ttl=900, max_entries=300, show_spinner="Récupération de tes fils dédiés…")
@_network
def _followed(follows: tuple[tuple[str, str, str], ...], keys: dict[str, str | None]):
    base, _, _ = load_articles(keys)
    rows = [{"kind": kind, "value": value, "label": label} for kind, value, label in follows]
    return collect_followed(rows, keys, base)


def load_followed(follows: tuple[tuple[str, str, str], ...], keys: dict[str, str | None]):
    """Fils dédiés aux suivis. `follows` est un tuple (et pas une liste) pour pouvoir servir de clé de cache."""
    return _resilient("followed", _followed, follows, keys, empty=({}, ["Fils dédiés indisponibles"]))


@st.cache_data(ttl=3600, max_entries=500, show_spinner=False)
@_network
def _search(query: str):
    return market.search_companies(query)


def search_companies(query: str):
    return _resilient("search", _search, query, empty=[])


@st.cache_data(ttl=6 * 3600, max_entries=500, show_spinner=False)
@_network
def _profile(symbol: str) -> dict:
    return _not_empty(market.company_profile(symbol))


def load_profile(symbol: str) -> dict:
    """Fiche d'une entreprise, gardée 6 heures (ces données changent peu)."""
    return _resilient("profile", _profile, symbol, empty={})


@st.cache_data(ttl=900, max_entries=500, show_spinner=False)
@_network
def _history(symbol: str, period: str):
    return _not_empty(market.price_history(symbol, period))


def load_history(symbol: str, period: str):
    return _resilient("history", _history, symbol, period)


# Les cours sont gardés symbole par symbole : deux visiteurs qui suivent LVMH partagent le même cours, même si le
# reste de leurs listes diffère (un cache par liste complète ne servirait presque jamais deux fois).
SYMBOL_QUOTES = capacity.Memory(max_entries=3000, ttl=120)


def load_symbol_quotes(symbols: tuple[str, ...], labels: dict[str, str] | None = None,
                       group: str = "") -> dict:
    """Cotations d'une liste de symboles, rangées par symbole : {"MC.PA": Quote, …}."""
    found = {s: q for s in symbols if (q := SYMBOL_QUOTES.get(f"{group}|{s}")) is not None}
    missing = [s for s in symbols if s not in found]
    if missing:
        try:
            with capacity.QUEUE.released():
                fetched = fetch_quotes([(s, (labels or {}).get(s, s), group, "%") for s in missing])
        except Exception:
            fetched = []
        for quote in fetched:
            SYMBOL_QUOTES.put(f"{group}|{quote.symbol}", quote)
            LAST_GOOD.put(f"symbol|{group}|{quote.symbol}", quote)
            found[quote.symbol] = quote
        for symbol in missing:  # pas de réponse : le dernier cours connu, s'il y en a un
            if symbol not in found and (last := LAST_GOOD.get(f"symbol|{group}|{symbol}")) is not None:
                found[symbol] = last
    return found


def load_followed_quotes(companies: tuple[tuple[str, str], ...]):
    """Cours des entreprises suivies (même format que la page Marchés)."""
    labels = dict(companies)
    quotes = load_symbol_quotes(tuple(labels), labels, "Mes entreprises")
    return [quotes[symbol] for symbol in labels if symbol in quotes]


@st.cache_data(ttl=300, max_entries=2, show_spinner="Chargement des 40 valeurs du CAC 40…")
@_network
def _cac40():
    return _not_empty(fetch_quotes([(symbol, name, sector, "%") for symbol, name, sector in market.CAC40]))


def load_cac40():
    return _resilient("cac40", _cac40, empty=[])


@st.cache_data(ttl=900, max_entries=4, show_spinner="Chargement des cours de la place…")
@_network
def _place(key: str):
    index, members = market.fetch_place(key, fetch=fetch_quotes)
    _not_empty(members)
    return index, members


def load_place(key: str):
    """Une place de la page Marchés (clé de `market.PLACES`) : (le cours de son indice ou None, les cours de ses
    valeurs), gardés 15 minutes. Sans réponse : (None, [])."""
    return _resilient("place", _place, key, empty=(None, []))


def known_cac40() -> list:
    """Les cours du CAC 40 déjà en mémoire (aucun appel réseau), ou une liste vide si personne ne les a demandés."""
    return LAST_GOOD.get("cac40|()") or []


def warm_cac40() -> list:
    """Cherche les cours du CAC 40 sans indicateur de chargement : le décor 3D du fil peut attendre, le visiteur lit.
    (Le conteneur « fvquiet » est caché par theme.py.)"""
    with st.container(key="fvquiet"):
        return load_cac40()


@st.cache_data(ttl=600, max_entries=2, show_spinner=False)
@_network
def _euro_rates() -> dict[str, float]:
    return _not_empty(market.euro_rates())


def load_euro_rates() -> dict[str, float]:
    return _resilient("euro_rates", _euro_rates, empty={})


@st.cache_data(ttl=300, max_entries=2, show_spinner="Cours des cryptomonnaies (CoinGecko)…")
@_network
def _crypto_markets() -> list:
    return _not_empty(crypto.fetch_markets())


@st.cache_data(ttl=300, max_entries=2, show_spinner=False)
@_network
def _crypto_overview() -> dict:
    return _not_empty(crypto.fetch_global())


def load_crypto() -> tuple[list, dict]:
    """Les 20 premières cryptomonnaies et les chiffres du marché, gardés 5 minutes (quota gratuit de CoinGecko).

    Une erreur n'est jamais mise en cache : on réessaiera à l'affichage suivant. En attendant, on montre les
    derniers chiffres obtenus, s'il y en a.
    """
    return _resilient("crypto_markets", _crypto_markets, empty=[]), _resilient("crypto_overview", _crypto_overview,
                                                                               empty={})


@st.cache_data(ttl=3600, max_entries=2, show_spinner=False)
@_network
def _fear_greed() -> list:
    return _not_empty(crypto.fetch_fear_greed(365))


def load_fear_greed() -> list:
    """L'indice peur et avidité sur un an (publié une fois par jour)."""
    return _resilient("fear_greed", _fear_greed, empty=[])


@st.cache_data(ttl=6 * 3600, max_entries=10, show_spinner="Chargement des statistiques officielles (BCE, Réserve fédérale)…")
@_network
def load_macro(start: str) -> tuple[dict, list[str]]:
    """Les indicateurs économiques : publiés au plus une fois par jour, on les garde 6 heures."""
    return macro.fetch_all(start)


@st.cache_data(ttl=6 * 3600, max_entries=10, show_spinner=False)
@_network
def _yield_curves(start: str) -> dict:
    return _not_empty(macro.fetch_yield_curves(start))


def load_yield_curves(start: str) -> dict:
    return _resilient("yield_curves", _yield_curves, start, empty={})  # une source en panne : section masquée


@st.cache_data(ttl=6 * 3600, max_entries=500, show_spinner=False)
@_network
def _calendar(symbol: str) -> dict:
    return market.company_calendar(symbol)


def load_calendar(symbol: str) -> dict:
    return _resilient("calendar", _calendar, symbol, empty={})


@st.cache_data(ttl=900, max_entries=200, show_spinner="Téléchargement des historiques…")
@_network
def _closes(symbols: tuple[str, ...], period: str):
    return _not_empty(market.closes_table(list(symbols), period))


def load_closes(symbols: tuple[str, ...], period: str):
    return _resilient("closes", _closes, symbols, period)


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
        with st.spinner("Lecture et résumé de l'article…"), capacity.QUEUE.released():
            engine = setting(user, "summary_engine", "auto")
            summary = summarize(article, ai_keys(), engine).to_dict()
        storage.save_summary(article.id, summary)
    st.html(summary_html(summary))


def _save_note(user: str, article_id: str, widget_key: str) -> None:
    storage.save_note(user, article_id, st.session_state.get(widget_key, ""))
    st.session_state["fv_toast"] = "Note enregistrée"


def article_html(article: Article, read: bool, layout: str = "row", echoes: int = 0, image: str | None = None) -> str:
    """Le HTML d'un article, selon sa présentation :

    - « lead » : la une, grande photo à gauche, titre et chapeau à droite ;
    - « tile » : une vignette, photo en haut, titre en dessous (les autres titres) ;
    - « row » : une ligne du fil, avec une petite photo à droite s'il y en a une ;
    - « compact » : une ligne de titre, sans chapeau ni photo.

    Sans vraie photo, rien n'est dessiné à la place : la une et les vignettes passent en version texte, avec un
    liseré à la couleur de la rubrique.
    """
    label = CATEGORIES.get(article.category, article.category)
    kicker = [theme.category_tag(article.category, label)]
    if layout != "tile":
        kicker.append(f'<span class="fv-src"><img src="{theme.favicon_url(article.url)}" alt="" loading="lazy">'
                      f"{esc(article.source)}</span>")
    kicker += [f'<time class="fv-time" datetime="{article.published.isoformat()}">{theme.clock(article.published)}</time>',
               f'<span class="fv-ago">{theme.time_ago(article.published)}</span>']
    if echoes:
        kicker.append(f'<span class="fv-echo">reprise par {echoes} autre{"s" if echoes > 1 else ""} '
                      f'source{"s" if echoes > 1 else ""}</span>')
    if read:
        kicker.append('<span class="fv-flag">Lu</span>')
    heading = "h3"  # sous le titre de section (h2) : la une comme les autres, sa taille vient du CSS
    link = f'href="{safe_url(article.url)}" target="_blank" rel="noopener"'
    title = esc(article.title)
    if layout == "lead":  # la une : les mots du titre apparaissent l'un après l'autre (theme.py)
        title = " ".join(f'<span class="fv-w" style="--i:{i}">{word}</span>' for i, word in enumerate(title.split(" ")))
    with_dek = article.summary and (layout in ("lead", "row") or (layout == "tile" and not image))
    text = (
        f'<div class="fv-kicker">{"".join(kicker)}</div>'
        f'<{heading} class="fv-headline"><a {link}>{title}</a></{heading}>'
        + (f'<p class="fv-dek">{esc(article.summary)}</p>' if with_dek else "")
        + (f'<p class="fv-tile-src"><img src="{theme.favicon_url(article.url)}" alt="" loading="lazy">'
           f"{esc(article.source)}</p>" if layout == "tile" else "")
    )
    classes = f'fv-item layout-{layout}{" is-read" if read else ""}{" is-compact" if layout == "compact" else ""}'
    color = theme.CATEGORY_COLORS.get(article.category, theme.BRAND)
    if layout in ("lead", "tile"):
        extra = " fv-lead" if layout == "lead" else ""
        if not image:
            return f'<article class="{classes}{extra} no-media" style="--c:{color}"><div class="fv-item-text">{text}</div></article>'
        return (f'<article class="{classes}{extra}"><a class="fv-media" {link} tabindex="-1" aria-hidden="true">'
                f'<img src="{safe_url(image)}" alt="" loading="lazy"></a><div class="fv-item-text">{text}</div></article>')
    if layout == "row" and image:
        return (f'<article class="{classes} has-thumb"><div class="fv-item-text">{text}</div>'
                f'<a class="fv-thumb" {link} tabindex="-1" aria-hidden="true"><img src="{safe_url(image)}" alt="" loading="lazy"></a></article>')
    return f'<article class="{classes}">{text}</article>'


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
    show_image: bool = True,
    tile: bool = False,
    image: str | None = None,
) -> None:
    """Affiche un article et ses boutons d'action.

    - `key_prefix` rend les clés des boutons uniques quand le même article apparaît sur plusieurs pages ;
    - `lead` (la une), `tile` (vignette) ou `compact` (une ligne) : la présentation, sinon une ligne avec image ;
    - `note` / `with_note` : affiche la note personnelle et le bouton pour l'écrire (page Favoris) ;
    - `user` : l'utilisateur connecté ; sans utilisateur, seuls « Lire » et « Résumé » sont proposés ;
    - `echoes` : nombre d'autres sources qui reprennent l'histoire ; `show_image`, `image` : la photo à afficher.
    """
    favorite, read, hidden = status["is_favorite"], status["is_read"], status["is_hidden"]
    key = f"{key_prefix}_{article.id}"
    layout = "lead" if lead else "tile" if tile else "compact" if compact else "row"
    picture = (image or article.image) if show_image and layout != "compact" else None

    # La clé du conteneur devient une classe CSS (st-key-fvcard_…) que theme.CSS met en forme.
    summary_open = st.session_state.get(f"summary_{article.id}", False)

    kind = {"lead": "fvlead", "tile": "fvtile", "compact": "fvcompact", "row": "fvcard"}[layout]
    with st.container(key=f"{kind}_{key}", gap="small"):
        st.html(article_html(article, read, layout, echoes, picture))
        if note:
            st.html(f'<blockquote class="fv-note-block"><b>Ma note</b>{esc(note)}</blockquote>')
        if summary_open:
            show_summary(article, user)
        short = layout == "tile"  # vignette étroite : des icônes seules (le texte est dans l'infobulle)
        with st.container(horizontal=True, gap="small", key=f"fvactions_{key}"):
            st.link_button(
                "" if short else "Lire", article.url, icon=":material/north_east:", key=f"{key}_open",
                type="tertiary", help="Lire l'article sur le site de la source",
                on_click=_update if user else "ignore",
                args=(user, article, "is_read", True, "Article marqué comme lu") if user else None,
            )
            st.button(
                "" if short else "Fermer le résumé" if summary_open else "Résumé",
                icon=":material/close:" if short and summary_open else ":material/subject:",
                key=f"{key}_sum",
                type="tertiary",
                help="Résumé automatique de l'article en quelques points",
                on_click=_toggle_summary,
                args=(article.id,),
            )
            if user:
                st.button(
                    "" if short else "Retirer" if favorite else "Garder",
                    icon=":material/bookmark:" if favorite else ":material/bookmark_border:",
                    key=f"{key}_fav",
                    type="tertiary",
                    help="Retirer des favoris" if favorite else "Ajouter aux favoris",
                    on_click=_update,
                    args=(user, article, "is_favorite", not favorite, "Favori retiré" if favorite else "Ajouté aux favoris"),
                )
            if user and not short:
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
