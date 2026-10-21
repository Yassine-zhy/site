"""Chargements des cryptomonnaies pour la fiche (views/coin.py) et la page Crypto (views/crypto.py).

Même méthode que ui.py : chaque appel à CoinGecko passe par `st.cache_data`, une erreur n'est jamais mise en cache
(`_resilient` montre alors la dernière réponse réussie). L'offre gratuite de CoinGecko est limitée (~30 appels par
minute) : la fiche, le graphique et la description sont gardés plusieurs minutes pour tous les visiteurs.
"""

from __future__ import annotations

import math
import re
from dataclasses import replace

import streamlit as st

import theme
from core import crypto
from theme import esc, safe_url
from ui import _network, _not_empty, _resilient

CHART_PERIODS = {"24 h": "1", "7 jours": "7", "30 jours": "30", "1 an": "365", "Depuis le début": "max"}
COIN_ID = re.compile(r"[a-z0-9][a-z0-9._-]{0,99}")  # la forme des identifiants CoinGecko

# La fiche : "ok", ou la raison pour laquelle on n'a rien à montrer
OK, UNKNOWN, UNAVAILABLE = "ok", "unknown", "unavailable"


def valid_id(coin_id: str) -> bool:
    return bool(COIN_ID.fullmatch(coin_id))


@st.cache_data(ttl=600, max_entries=200, show_spinner=False)
@_network
def _coin(coin_id: str) -> crypto.CoinDetail | None:
    """La fiche chiffrée, 10 minutes. Un identifiant inconnu donne None (gardé aussi : inutile de le redemander)."""
    try:
        return crypto.fetch_coin(coin_id)
    except crypto.UnknownCoin:
        return None


@st.cache_data(ttl=6 * 3600, max_entries=200, show_spinner=False)
def _texts(coin_id: str) -> dict | None:
    """Ce qui change peu (description, catégories, liens, date de création) : 6 heures. Lit la fiche déjà en
    mémoire, donc sans appel de plus à CoinGecko."""
    detail = _coin(coin_id)
    if detail is None:
        return None
    return {"description": detail.description, "description_lang": detail.description_lang,
            "categories": detail.categories, "website": detail.website, "whitepaper": detail.whitepaper,
            "created": detail.created}


def load_coin(coin_id: str) -> tuple[crypto.CoinDetail | None, str]:
    """(la fiche, état) : OK, UNKNOWN (CoinGecko ne connaît pas cet identifiant) ou UNAVAILABLE (panne, limite atteinte)."""
    if not valid_id(coin_id):
        return None, UNKNOWN
    found = _resilient("coin", _coin, coin_id, empty=False)
    if found is False:
        return None, UNAVAILABLE
    if found is None:
        return None, UNKNOWN
    texts = _resilient("coin_texts", _texts, coin_id, empty=None)
    return (replace(found, **texts) if texts else found), OK


@st.cache_data(ttl=600, max_entries=400, show_spinner=False)
@_network
def _chart(coin_id: str, days: str, symbol: str) -> list:
    return _not_empty(crypto.fetch_chart(coin_id, days, symbol))


def load_chart(coin_id: str, days: str, symbol: str) -> list[tuple]:
    """Le cours en euros [(date, cours)], gardé 10 minutes ; une liste vide si CoinGecko et Yahoo refusent."""
    return _resilient("coin_chart", _chart, coin_id, days, symbol, empty=[])


@st.cache_data(ttl=3600, max_entries=300, show_spinner=False)
@_network
def _search(query: str) -> list:
    return crypto.search_coins(query)


def search_coins(query: str) -> list[crypto.CoinHit] | None:
    """Les cryptomonnaies qui correspondent à la recherche ; None si CoinGecko ne répond pas."""
    return _resilient("coin_search", _search, query.strip().lower(), empty=None)


def euros(value: float) -> str:
    """Un cours en euros : 2 décimales au-delà de 10 €, 4 jusqu'à 1 €, puis assez de décimales pour garder deux
    chiffres significatifs (un cours de 0,0000034 € ne doit pas s'afficher « 0,0000 »)."""
    if value >= 1:
        text = theme.price(value)
    elif value >= 0.01:
        text = theme.fr_number(value, 4)
    elif value > 0:
        text = theme.fr_number(value, 1 - math.floor(math.log10(value)))
    else:
        text = "0"
    return f"{text}\u202f€"


# --- Le champ de recherche et ses résultats (fiche et page Crypto) --------------------------------------

CSS = """<style>
.fvcoin-hits { display: flex; flex-wrap: wrap; gap: .5rem; margin: .1rem 0 .6rem; padding: 0; list-style: none; }
.fvcoin-hits li { margin: 0; }
.fvcoin-hit { display: inline-flex; align-items: center; gap: .5rem; padding: .35rem .8rem .35rem .45rem;
  border: 1px solid var(--fv-line); border-radius: 999px; background: var(--fv-surface); color: var(--fv-text) !important;
  font-size: .85rem; font-weight: 500; text-decoration: none !important;
  transition: border-color .15s, transform .15s, box-shadow .15s; }
.fvcoin-hit:hover { border-color: var(--fv-brand); transform: translateY(-1px); box-shadow: var(--fv-elev-hover); }
.fvcoin-hit img { width: 22px; height: 22px; border-radius: 50%; }
.fvcoin-hit small { font-family: var(--fv-mono); font-size: .72rem; color: var(--fv-muted); }
</style>"""


def hits_html(hits: list[crypto.CoinHit]) -> str:
    """Les résultats d'une recherche : une pastille cliquable par cryptomonnaie, vers sa fiche."""
    return '<ul class="fvcoin-hits">' + "".join(
        f'<li><a class="fvcoin-hit" href="{theme.coin_url(hit.id)}" target="_self">'
        + (f'<img src="{safe_url(hit.thumb)}" alt="" loading="lazy">' if hit.thumb else "")
        + f'{esc(hit.name)} <small>{esc(hit.symbol)}</small></a></li>' for hit in hits[:8]) + "</ul>"


def search_box(key: str) -> None:
    """Un champ « Chercher une crypto » ; Entrée affiche les fiches trouvées juste dessous."""
    query = st.text_input("Chercher une crypto", key=key, icon=":material/search:", label_visibility="collapsed",
                          placeholder="Chercher une crypto : bitcoin, solana, pepe…", max_chars=60).strip()
    if len(query) < 2:
        return
    hits = search_coins(query)
    if hits is None:
        st.caption("La recherche est indisponible pour le moment.")
    elif not hits:
        st.caption(f"Aucune cryptomonnaie ne correspond à « {query} ».")
    else:
        st.html(hits_html(hits))
