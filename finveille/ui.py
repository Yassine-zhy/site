"""Éléments d'interface partagés par plusieurs pages."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import streamlit as st

from core import storage
from core.aggregator import collect_articles
from core.config import API_KEYS, CATEGORIES
from core.models import Article

CATEGORY_COLORS = {"marches": "blue", "crypto": "orange", "entreprises": "violet", "macro": "green"}
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
    """Appelle les sources au plus une fois toutes les 15 minutes (900 s), pour ménager les quotas des API."""
    return collect_articles(keys)


def md_escape(text: str) -> str:
    """Neutralise les caractères spéciaux du Markdown (sinon « $5 … $10 » devient une formule)."""
    for char in "\\`*_[]$<>#":
        text = text.replace(char, "\\" + char)
    return text


def time_ago(published: datetime) -> str:
    """« il y a 5 min », « il y a 3 h », « il y a 2 j »."""
    minutes = int((datetime.now(timezone.utc) - published).total_seconds() // 60)
    if minutes < 60:
        return f"il y a {max(minutes, 0)} min"
    if minutes < 24 * 60:
        return f"il y a {minutes // 60} h"
    return f"il y a {minutes // (24 * 60)} j"


def _update(article: Article, flag: str, value: bool, message: str) -> None:
    """Callback des boutons : enregistre le changement puis affiche une petite notification."""
    storage.set_flag(article, flag, value)
    st.toast(message)


def article_card(article: Article, status: dict[str, bool], key_prefix: str) -> None:
    """Affiche un article dans une carte, avec ses boutons d'action.

    `key_prefix` rend les clés des boutons uniques quand le même article apparaît sur plusieurs pages.
    """
    favorite, read, hidden = status["is_favorite"], status["is_read"], status["is_hidden"]
    key = f"{key_prefix}_{article.id}"

    with st.container(border=True):
        st.markdown(f"##### [{md_escape(article.title)}]({article.url})")
        color = CATEGORY_COLORS.get(article.category, "gray")
        meta = [
            f":{color}-badge[{CATEGORIES.get(article.category, article.category)}]",
            md_escape(article.source),
            time_ago(article.published),
        ]
        if read:
            meta.append(":gray-badge[✓ Lu]")
        st.caption(" · ".join(meta))
        if article.summary:
            st.write(md_escape(article.summary))

        with st.container(horizontal=True, gap="small"):
            st.link_button(
                "Lire", article.url, icon=":material/open_in_new:", key=f"{key}_open",
                on_click=_update, args=(article, "is_read", True, "Article marqué comme lu"),
            )
            st.button(
                "Retirer des favoris" if favorite else "Favori",
                icon=":material/star:" if favorite else ":material/star_border:",
                key=f"{key}_fav",
                type="tertiary",
                on_click=_update,
                args=(article, "is_favorite", not favorite, "Favori retiré" if favorite else "Ajouté aux favoris ⭐"),
            )
            st.button(
                "Non lu" if read else "Lu",
                icon=":material/mark_email_unread:" if read else ":material/done:",
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
