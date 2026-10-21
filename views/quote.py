"""Page « Fiche » : une valeur (action, indice, devise, matière première, taux), par son symbole Yahoo Finance.

Adresse : fiche?s=MC.PA. Sans symbole, ou avec un symbole que Yahoo ne connaît pas, la page propose de chercher une valeur.
"""

import json

import streamlit as st

import sheet
import theme
from core import company
from core.config import COMPANIES
from ui import api_keys, current_user, end_page, load_articles, load_history

st.html(sheet.STYLE)
symbol = company.normalize_symbol(st.query_params.get("s"))
user = current_user()

if symbol:
    overview = sheet.load_overview(symbol)
    history = load_history(symbol, "5y")
    known = bool(overview) or (history is not None and not history.empty)
else:
    overview, known = {}, False

if not known:  # pas de symbole, ou un symbole inconnu de Yahoo : on propose de chercher
    theme.page_header("Chercher une valeur", "Une action, un indice, une devise, une matière première : tape un nom ou "
                      "un symbole pour ouvrir sa fiche (cours, graphique, indicateurs, performances).",
                      eyebrow="Marchés", accent="")
    if symbol:
        st.warning(f"Yahoo Finance ne connaît pas « {symbol} », ou ne répond pas pour le moment. Vérifie le symbole "
                   "ou cherche la valeur par son nom.", icon=":material/search_off:")
    sheet.search_box()
    theme.section("Quelques fiches")
    st.html(sheet.shortcuts_html())
    end_page()

kind = company.quote_type(symbol, overview)
stock = company.is_stock(kind)
name = company.known_name(symbol) or overview.get("shortName") or symbol
currency = overview.get("currency", "")
unit = "pb" if symbol in company.RATE_SYMBOLS else "%"

# Le titre de l'onglet du navigateur : le nom de la valeur (st.set_page_config n'est permis qu'une fois, dans app.py)
st.html(f"<script>document.title = {json.dumps(f'{name} · FinVeille')};</script>", unsafe_allow_javascript=True)

crumbs, finder = st.columns([3, 2], gap="large", vertical_alignment="center")
crumbs.html(sheet.breadcrumb(symbol, name, kind))
with finder:
    sheet.search_box()

if stock:
    dek = f"Cours, indicateurs, résultats, avis des analystes, dividendes et actualités de {name}."
else:
    dek = f"Cours, graphique et performances de {name}, d'après Yahoo Finance (cours différés)."
theme.page_header(f"{name},", dek, eyebrow="Marchés", accent="la fiche complète." if stock else "en détail.",
                  quotes=sheet.quote_for_header(symbol, name, unit))
sheet.actions_row(symbol, name, user, stock)

if stock:
    names = [name, overview.get("shortName"), overview.get("longName"), *COMPANIES.get(symbol, ("", "", []))[2]]
    feed, _, _ = load_articles(api_keys())
    articles = company.related_news(feed, sheet.load_ticker_news(symbol), symbol, [n for n in names if n], limit=40)
    sheet.company_sheet(symbol, name, articles, user)
    sheet.performance_section(symbol)
    results, analysts = st.columns([1.5, 1], gap="large")
    with results:
        sheet.results_section(symbol, currency)
    with analysts:
        sheet.analysts_section(symbol, overview, currency)
    sheet.dividends_section(symbol, overview, currency)
    sheet.news_section(articles[:8], symbol, user)
    sheet.peers_section(symbol)
else:
    unit = sheet.market_sheet(symbol, name, overview, kind)
    sheet.performance_section(symbol, unit)
    sheet.index_movers(symbol)
