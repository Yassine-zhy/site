"""Éléments d'interface partagés par plusieurs pages."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import streamlit as st

import theme
from core import macro, market, storage
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
# Libellé et icône du bouton de connexion pour chaque service (nom de la section [auth.xxx] de secrets.toml)
PROVIDERS = {
    "google": ("Continuer avec Google", ":material/account_circle:"),
    "auth0": ("E-mail, Google ou Facebook", ":material/mail:"),
    "microsoft": ("Continuer avec Microsoft", ":material/account_circle:"),
    None: ("Se connecter", ":material/login:"),
}


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


def current_user() -> str | None:
    """Qui utilise l'application ?

    - comptes non configurés (en local) : l'utilisateur unique « local » ;
    - comptes configurés : l'e-mail (s'il est vérifié) ou l'identifiant fourni par le service de connexion ;
    - personne de connecté : None.
    """
    if not auth_providers():
        return storage.LOCAL_USER
    if not st.user.get("is_logged_in", False):  # .get : st.user est vide tant que [auth] n'est pas chargé
        return None
    email = st.user.get("email")
    # Un e-mail non vérifié (inscription par e-mail pas encore confirmée) ne doit pas donner accès aux données
    # d'un compte Google qui a la même adresse : on utilise alors l'identifiant unique du service (« sub »).
    user = email if email and st.user.get("email_verified", False) else st.user.get("sub") or email
    if st.session_state.get("fv_known_user") != user:  # une fois par session : on enregistre la visite
        storage.touch_user(user, email, st.user.get("name"))
        st.session_state["fv_known_user"] = user
    return user


def login_buttons(key: str) -> None:
    """Un bouton par service de connexion configuré."""
    for index, provider in enumerate(auth_providers()):
        label, icon = PROVIDERS.get(provider, (f"Continuer avec {str(provider).capitalize()}", ":material/login:"))
        st.button(label, icon=icon, key=f"{key}_{provider}", type="primary" if index == 0 else "secondary",
                  width="stretch", on_click=st.login, args=(provider,) if provider else ())


def login_box(key: str, title: str, text: str) -> None:
    """Une carte de connexion : titre, explication, un bouton par service, mention de confidentialité."""
    with st.container(key=f"fvbox_{key}", width=440):
        st.html(f'<h3 class="fv-box-title">{esc(title)}</h3><p class="fv-box-text">{esc(text)}</p>')
        login_buttons(key)
        st.caption("Aucun mot de passe n'est stocké par FinVeille : la connexion est gérée par Google ou par le "
                   "service Auth0. Seuls ton nom et ton e-mail sont enregistrés.")


def require_user() -> str:
    """Renvoie l'utilisateur, ou affiche une invitation à se connecter et arrête la page."""
    user = current_user()
    if user is None:
        login_box("require", "Connecte-toi pour accéder à ton espace",
                  "Cette page contient tes données personnelles : favoris, suivis, portefeuille, alertes. "
                  "Elles sont enregistrées dans ton compte et toi seul y as accès.")
        st.stop()
    return user


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
