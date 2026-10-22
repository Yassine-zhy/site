"""La recherche du site, ouverte depuis le bouton « Rechercher » de la barre du haut (app.py), sur toutes les pages.

Un dialogue (`st.dialog`) cherche une valeur (Yahoo Finance), une cryptomonnaie (CoinGecko), une page du site ou un
terme du glossaire, et mène à sa fiche. Les trois fonctions `page_hits`, `glossary_hits` et `results_html` sont pures :
on les teste sans Streamlit. Le raccourci clavier (touche « / » ou Ctrl+K) vit dans static/fv3d/engine.js.
"""

from __future__ import annotations

from urllib.parse import quote as url_quote

import streamlit as st

import coins
import theme
import ui
from core.crypto import CoinHit
from core.filters import normalize
from core.glossary import GLOSSARY
from theme import esc, safe_url

MIN_CHARS = 2  # en dessous, des raccourcis plutôt que des résultats
MAX_VALUES, MAX_COINS, MAX_PAGES, MAX_TERMS = 8, 5, 4, 4
DEFINITION_CHARS = 90

# (titre, adresse, mots-clés) : les adresses sont relatives, comme celles des fiches (`theme.fiche_url`)
PAGES: list[tuple[str, str, str]] = [
    ("Le fil", "./", "actualité actualités news articles fil d'actualité accueil"),
    ("Le brief", "./brief", "résumé du jour synthèse matin"),
    ("Assistant IA", "./assistant", "question intelligence artificielle chat réponse"),
    ("En chiffres", "./stats", "statistiques sources catégories"),
    ("Marchés", "./markets", "bourse indices actions cours monde matières premières taux"),
    ("Marchés : France", "./markets?view=france", "paris cac 40 bourse"),
    ("Marchés : Canada", "./markets?view=canada", "toronto tsx bourse"),
    ("Marchés : États-Unis", "./markets?view=usa", "new york wall street dow jones s&p 500 nasdaq bourse"),
    ("Marchés : Devises", "./markets?view=devises", "change euro dollar monnaies"),
    ("Économie", "./economy", "inflation taux chômage croissance BCE Fed banque centrale pib"),
    ("Crypto", "./crypto", "cryptomonnaie bitcoin ether blockchain"),
    ("Comparer", "./compare", "comparaison performances valeurs"),
    ("Mes suivis", "./following", "liste de suivi valeurs suivies"),
    ("Portefeuille", "./portfolio", "positions investissements gains"),
    ("Alertes", "./alerts", "seuil prix notification"),
    ("Favoris", "./favorites", "articles gardés enregistrés"),
    ("Simulateurs", "./simulators",
     "calculatrice épargne crédit immobilier investissement inflation intérêts composés prêt retraite"),
    ("Quiz", "./quiz", "questions test connaissances"),
    ("Glossaire", "./glossary", "dictionnaire définitions vocabulaire mots termes"),
    ("Réglages", "./settings", "paramètres préférences sources thème"),
    ("Mon compte", "./account", "connexion profil mot de passe inscription"),
    ("À propos", "./about", "projet auteur contact"),
]

# Ce qu'on propose avant que le visiteur ait tapé : (libellé, symbole, place) ou (libellé, identifiant, symbole)
SHORTCUT_PLACES = [("CAC 40", "^FCHI", "Paris"), ("S&P/TSX 60 (fonds XIU)", "XIU.TO", "Toronto"),
                   ("Dow Jones", "^DJI", "New York"), ("S&P 500", "^GSPC", "New York")]
SHORTCUT_VALUES = [("LVMH", "MC.PA"), ("TotalEnergies", "TTE.PA"), ("Shopify", "SHOP.TO"), ("Royal Bank", "RY.TO"),
                   ("Apple", "AAPL"), ("Nvidia", "NVDA")]
SHORTCUT_COINS = [("Bitcoin", "bitcoin", "BTC"), ("Ether", "ethereum", "ETH")]

CSS = """<style>
/* Le bouton de la barre du haut : une pilule assortie au lien « Se connecter » */
.st-key-fvaccount .st-key-fvsearch_open button { min-height: 0; padding: .3rem .7rem;
  border: 1px solid var(--fv-line-strong); border-radius: 999px; background: var(--fv-surface); }
.st-key-fvaccount .st-key-fvsearch_open button:hover { border-color: var(--fv-brand); }
.st-key-fvaccount .st-key-fvsearch_open button p { font-size: .85rem; font-weight: 500; }
@media (max-width: 640px) {  /* téléphone : l'icône seule, le texte reste lu par les lecteurs d'écran */
  .st-key-fvaccount .st-key-fvsearch_open button { min-width: 2.3rem; min-height: 2.3rem; padding: .4rem; gap: 0;
    justify-content: center; }
  .st-key-fvaccount .st-key-fvsearch_open button p { position: absolute; width: 1px; height: 1px; overflow: hidden;
    clip-path: inset(50%); }
}
/* Le dialogue : Streamlit le place hors de .stApp, où theme.py définit les variables --fv-* ; on reprend ici les
   valeurs dont il a besoin (mêmes teintes que la couche sémantique de theme.py, clair et sombre) */
[role="dialog"] { --fv-line: light-dark(#e2e7f0, #1a2335); --fv-surface: light-dark(#ffffff, #0c111d);
  --fv-sunken: light-dark(#f6f8fc, #0a0e18); --fv-text: light-dark(#0b1220, #e8edf6);
  --fv-muted: light-dark(#566176, #96a2b9); --fv-brand: light-dark(#2451de, #6d93ff);
  --fv-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace; }
.st-key-fvsearch_q { margin-bottom: 0; }
.fvs-note { margin: -.4rem 0 .6rem; font-size: .76rem; color: var(--fv-muted); }
.fvs-group { margin: .9rem 0 0; }
.fvs-title { margin: 0 0 .35rem; font-size: .8rem; font-weight: 600; color: var(--fv-muted); }
.fvs-list { display: flex; flex-direction: column; gap: .3rem; }
a.fvs-hit { display: flex; align-items: center; justify-content: space-between; gap: .8rem; min-height: 44px;
  padding: .45rem .8rem; border: 1px solid var(--fv-line); border-radius: 10px; background: var(--fv-surface);
  color: var(--fv-text) !important; font-size: .9rem; text-decoration: none !important;
  transition: border-color .15s, background-color .15s; }
a.fvs-hit:hover, a.fvs-hit:focus-visible { border-color: var(--fv-brand); background: var(--fv-sunken); }
a.fvs-hit:focus-visible { outline: 2px solid var(--fv-brand); outline-offset: 2px; }
.fvs-main { display: flex; align-items: center; gap: .55rem; min-width: 0; }
.fvs-main img { width: 22px; height: 22px; flex: none; border-radius: 50%; }
.fvs-text { display: flex; flex-direction: column; min-width: 0; }
.fvs-text b { font-weight: 600; overflow-wrap: anywhere; }
.fvs-text small { font-size: .76rem; color: var(--fv-muted); }
.fvs-tag { flex: none; font-family: var(--fv-mono); font-size: .72rem; color: var(--fv-muted); white-space: nowrap; }
.fvs-empty { margin: 1rem 0 0; font-size: .9rem; color: var(--fv-muted); }
.fvs-off { margin: .8rem 0 0; font-size: .76rem; color: var(--fv-muted); }
</style>"""


# --- Chercher (fonctions pures) --------------------------------------------------------------------------


def page_hits(query: str) -> list[tuple[str, str]]:
    """Les pages du site qui correspondent : (titre, adresse). Chaque mot tapé doit se trouver dans le titre ou les
    mots-clés, sans tenir compte des accents ni des majuscules ; les titres qui correspondent passent en premier."""
    words = normalize(query).split()
    if not words:
        return []
    found = []
    for title, address, keywords in PAGES:
        in_title = normalize(title)
        text = f"{in_title} {normalize(keywords)}"
        if all(word in text for word in words):
            found.append((not all(word in in_title for word in words), len(found), title, address))
    return [(title, address) for _, _, title, address in sorted(found)[:MAX_PAGES]]


def glossary_hits(query: str) -> list[tuple[str, str]]:
    """Les termes du glossaire dont le nom contient la recherche : (terme, définition). Ceux qui commencent par elle
    d'abord, puis l'ordre alphabétique."""
    wanted = normalize(query).strip()
    if not wanted:
        return []
    names = sorted((term for term in GLOSSARY if wanted in normalize(term)),
                   key=lambda term: (not normalize(term).startswith(wanted), normalize(term)))
    return [(term, GLOSSARY[term][1]) for term in names[:MAX_TERMS]]


def shorten(text: str, limit: int = DEFINITION_CHARS) -> str:
    """Un texte coupé à la fin d'un mot, avec des points de suspension s'il a fallu le couper."""
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(" ,;:.") + "…"


# --- Le rendu --------------------------------------------------------------------------------------------


def _row(href: str, name: str, tag: str = "", sub: str = "", thumb: str = "") -> str:
    """Une ligne cliquable : le nom en gras (avec une précision en petit dessous), à droite le symbole ou la place."""
    image = f'<img src="{safe_url(thumb)}" alt="" loading="lazy">' if safe_url(thumb) != "#" else ""
    detail = f"<small>{esc(sub)}</small>" if sub else ""
    label = f'<span class="fvs-tag">{esc(tag)}</span>' if tag else ""
    return (f'<a class="fvs-hit" href="{esc(href)}" target="_self"><span class="fvs-main">{image}'
            f'<span class="fvs-text"><b>{esc(name)}</b>{detail}</span></span>{label}</a>')


def _group(title: str, rows: list[str]) -> str:
    if not rows:
        return ""
    return (f'<div class="fvs-group" role="group" aria-label="{esc(title)}"><p class="fvs-title" aria-hidden="true">'
            f'{esc(title)}</p><div class="fvs-list">{"".join(rows)}</div></div>')


def results_html(values: list[dict], coin_hits: list[CoinHit], pages: list[tuple[str, str]],
                 terms: list[tuple[str, str]]) -> str:
    """Les résultats en groupes (valeurs, cryptomonnaies, pages, glossaire) ; un groupe vide n'apparaît pas."""
    return "".join([
        _group("Valeurs", [_row(theme.fiche_url(v["symbol"]), v["name"], v["symbol"], v.get("exchange", ""))
                           for v in values[:MAX_VALUES]]),
        _group("Cryptomonnaies", [_row(theme.coin_url(c.id), c.name, c.symbol, thumb=c.thumb)
                                  for c in coin_hits[:MAX_COINS]]),
        _group("Pages du site", [_row(address, title) for title, address in pages[:MAX_PAGES]]),
        _group("Glossaire", [_row(f"./glossary?q={url_quote(term, safe='')}", term, sub=shorten(definition))
                             for term, definition in terms[:MAX_TERMS]]),
    ])


def shortcuts_html() -> str:
    """Avant toute saisie : les places, quelques valeurs et deux cryptomonnaies."""
    return "".join([
        _group("Places", [_row(theme.fiche_url(symbol), name, place) for name, symbol, place in SHORTCUT_PLACES]),
        _group("Valeurs", [_row(theme.fiche_url(symbol), name, symbol) for name, symbol in SHORTCUT_VALUES]),
        _group("Cryptomonnaies",
               [_row(theme.coin_url(coin_id), name, symbol) for name, coin_id, symbol in SHORTCUT_COINS]),
    ])


# --- Le dialogue -----------------------------------------------------------------------------------------


@st.dialog("Rechercher", width="medium")
def open_dialog() -> None:
    """Le champ de recherche et ses résultats ; un clic sur un résultat ouvre la fiche (le dialogue se ferme avec la
    page). Appelé par le bouton de la barre du haut (app.py)."""
    query = st.text_input("Chercher", key="fvsearch_q", label_visibility="collapsed", icon=":material/search:",
                          placeholder="Action, indice, crypto, page…").strip()[:60]
    st.html('<p class="fvs-note">Entrée pour chercher</p>')
    if len(query) < MIN_CHARS:
        st.html(shortcuts_html())
        return
    values = (ui.search_companies(query) or [])[:MAX_VALUES]
    found_coins = coins.search_coins(query)
    page_found, terms = page_hits(query), glossary_hits(query)
    body = results_html(values, found_coins or [], page_found, terms)
    if body:
        st.html(body)
    else:
        st.html(f'<p class="fvs-empty">Rien trouvé pour « {esc(query)} ». Essaie le nom anglais ou le symbole '
                "boursier (MC.PA, AAPL).</p>")
    if found_coins is None:
        st.html('<p class="fvs-off">La recherche des cryptos est indisponible pour le moment.</p>')
