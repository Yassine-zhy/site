"""Éléments d'interface partagés par plusieurs pages."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import streamlit as st

import theme
from core import storage
from core import market
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


def company_choices() -> dict[str, str]:
    """Les entreprises proposées dans les listes : mes suivis d'abord, puis le CAC 40 et les grandes valeurs."""
    choices = {f["value"]: f["label"] for f in storage.list_follows("company")}
    choices |= {symbol: name for symbol, name, _ in market.CAC40 if symbol not in choices}
    choices |= {symbol: name for symbol, (name, _, _) in COMPANIES.items() if symbol not in choices}
    return choices


def _update(article: Article, flag: str, value: bool, message: str) -> None:
    """Callback des boutons : enregistre le changement et prépare une petite notification.

    On n'appelle pas st.toast ici : un callback qui affiche quelque chose pendant la relance d'un
    fragment n'est pas pris en charge. Le message est affiché par flush_toast() au début de la page.
    """
    storage.set_flag(article, flag, value)
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


def show_summary(article: Article) -> None:
    """Affiche le résumé de l'article ; le calcule (puis l'enregistre) s'il n'existe pas encore."""
    summary = storage.get_summary(article.id)
    if summary is None:
        with st.spinner("Lecture et résumé de l'article…"):
            engine = storage.get_setting("summary_engine", "auto")
            summary = summarize(article, ai_keys(), engine).to_dict()
        storage.save_summary(article.id, summary)
    st.html(summary_html(summary))


def _save_note(article_id: str, widget_key: str) -> None:
    storage.save_note(article_id, st.session_state.get(widget_key, ""))
    st.session_state["fv_toast"] = "Note enregistrée"


def article_html(article: Article, read: bool, lead: bool = False, compact: bool = False) -> str:
    """Le HTML d'un article : rubrique, source, heure, titre, chapeau (et photo pour la une).

    En vue compacte, on n'affiche ni le chapeau ni la photo : une ligne de titre par article.
    """
    kicker = [
        theme.category_tag(article.category, CATEGORIES.get(article.category, article.category)),
        f'<span class="fv-src"><img src="{theme.favicon_url(article.url)}" alt="" loading="lazy">'
        f"{esc(article.source)}</span>",
        f'<time class="fv-time" datetime="{article.published.isoformat()}">{theme.clock(article.published)}</time>',
        f'<span class="fv-ago">{theme.time_ago(article.published)}</span>',
    ]
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
    if lead and article.image:
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
) -> None:
    """Affiche un article et ses boutons d'action.

    - `key_prefix` rend les clés des boutons uniques quand le même article apparaît sur plusieurs pages ;
    - `compact` : une ligne par article (titre et informations, sans chapeau) ;
    - `note` / `with_note` : affiche la note personnelle et le bouton pour l'écrire (page Favoris).
    """
    favorite, read, hidden = status["is_favorite"], status["is_read"], status["is_hidden"]
    key = f"{key_prefix}_{article.id}"

    # La clé du conteneur devient une classe CSS (st-key-fvcard_…) que theme.CSS met en forme.
    summary_open = st.session_state.get(f"summary_{article.id}", False)

    kind = "fvlead" if lead else "fvcompact" if compact else "fvcard"
    with st.container(key=f"{kind}_{key}", gap="small"):
        st.html(article_html(article, read, lead, compact))
        if note:
            st.html(f'<blockquote class="fv-note-block"><b>Ma note</b>{esc(note)}</blockquote>')
        if summary_open:
            show_summary(article)
        with st.container(horizontal=True, gap="small"):
            st.link_button(
                "Lire", article.url, icon=":material/north_east:", key=f"{key}_open", type="tertiary",
                on_click=_update, args=(article, "is_read", True, "Article marqué comme lu"),
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
            st.button(
                "Retirer" if favorite else "Garder",
                icon=":material/bookmark:" if favorite else ":material/bookmark_border:",
                key=f"{key}_fav",
                type="tertiary",
                help="Retirer des favoris" if favorite else "Ajouter aux favoris",
                on_click=_update,
                args=(article, "is_favorite", not favorite, "Favori retiré" if favorite else "Ajouté aux favoris"),
            )
            st.button(
                "Non lu" if read else "Lu",
                icon=":material/radio_button_unchecked:" if read else ":material/check:",
                key=f"{key}_read",
                type="tertiary",
                on_click=_update,
                args=(article, "is_read", not read, "Marqué comme non lu" if read else "Marqué comme lu"),
            )
            st.button(
                "Réafficher" if hidden else "Masquer",
                icon=":material/visibility:" if hidden else ":material/visibility_off:",
                key=f"{key}_hide",
                type="tertiary",
                on_click=_update,
                args=(article, "is_hidden", not hidden, "Article réaffiché" if hidden else "Article masqué"),
            )
            if with_note:
                with st.popover("Modifier la note" if note else "Annoter", icon=":material/edit_note:", type="tertiary"):
                    st.text_area("Ma note", value=note or "", key=f"{key}_note", height=110,
                                 placeholder="Pourquoi cet article t'intéresse, à quoi il te servira…")
                    st.button("Enregistrer", key=f"{key}_note_save", type="primary",
                              on_click=_save_note, args=(article.id, f"{key}_note"))
