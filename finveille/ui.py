"""Éléments d'interface partagés par plusieurs pages."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import streamlit as st

import theme
from core import storage
from core.aggregator import collect_articles
from core.config import API_KEYS, CATEGORIES
from core.models import Article
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


@st.cache_data(ttl=900, show_spinner="Récupération des actualités…")
def load_articles(keys: dict[str, str | None]):
    """Appelle les sources au plus une fois toutes les 15 minutes (900 s), pour ménager les quotas des API.

    Renvoie (articles, erreurs, heure de la collecte).
    """
    articles, errors = collect_articles(keys)
    return articles, errors, datetime.now(timezone.utc)


def _update(article: Article, flag: str, value: bool, message: str) -> None:
    """Callback des boutons : enregistre le changement puis affiche une petite notification."""
    storage.set_flag(article, flag, value)
    st.toast(message)


def article_html(article: Article, read: bool, lead: bool = False) -> str:
    """Le HTML d'un article : rubrique, source, heure, titre, chapeau (et photo pour la une)."""
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
        + (f'<p class="fv-dek">{esc(article.summary)}</p>' if article.summary else "")
    )
    classes = ["fv-item"] + (["is-read"] if read else []) + (["fv-lead"] if lead else [])
    if lead and article.image:
        classes.append("has-img")
        figure = f'<figure><img src="{safe_url(article.image)}" alt="" loading="lazy"></figure>'
        return f'<article class="{" ".join(classes)}"><div>{text}</div>{figure}</article>'
    return f'<article class="{" ".join(classes)}">{text}</article>'


def article_card(article: Article, status: dict[str, bool], key_prefix: str, lead: bool = False) -> None:
    """Affiche un article et ses boutons d'action.

    `key_prefix` rend les clés des boutons uniques quand le même article apparaît sur plusieurs pages.
    """
    favorite, read, hidden = status["is_favorite"], status["is_read"], status["is_hidden"]
    key = f"{key_prefix}_{article.id}"

    # La clé du conteneur devient une classe CSS (st-key-fvcard_…) que theme.CSS met en forme.
    with st.container(key=f"{'fvlead' if lead else 'fvcard'}_{key}", gap="small"):
        st.html(article_html(article, read, lead))
        with st.container(horizontal=True, gap="small"):
            st.link_button(
                "Lire", article.url, icon=":material/north_east:", key=f"{key}_open", type="tertiary",
                on_click=_update, args=(article, "is_read", True, "Article marqué comme lu"),
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
