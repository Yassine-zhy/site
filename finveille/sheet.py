"""La fiche d'une valeur, partagée par les pages « Fiche » (views/quote.py) et « Mes suivis » (views/following.py).

Une page Streamlit ne peut pas être importée (elle s'exécuterait) : les morceaux communs vivent ici. On y trouve la fiche
d'entreprise (cours, graphique annoté, indicateurs, agenda, analyse), les sections de la fiche complète (performances,
résultats, analystes, dividendes, actualités, valeurs du secteur) et leurs chargements en cache (`st.cache_data`).
"""

import re
from datetime import date
from urllib.parse import quote as url_quote

import altair as alt
import pandas as pd
import streamlit as st

import theme
from core import assistant, company, storage
from core.config import COMPANIES
from core.market import INDICATORS, PLACES, Quote, place_of
from core.sources import fetch_yahoo_ticker_news
from theme import esc
from ui import (NO_STATUS, _network, _not_empty, _resilient, ai_count, ai_enabled, ai_quota, api_keys, article_card,
                complete_ai, load_articles, load_calendar, load_history, load_symbol_quotes, search_companies)

CHART_PERIODS = {"1 mois": "1mo", "6 mois": "6mo", "1 an": "1y", "5 ans": "5y"}

# Les raccourcis de la page « Chercher une valeur » : (symbole Yahoo, nom)
SHORTCUTS = [("^FCHI", "CAC 40"), ("MC.PA", "LVMH"), ("AI.PA", "Air Liquide"), ("RY.TO", "Banque Royale"),
             ("SHOP.TO", "Shopify"), ("AAPL", "Apple"), ("NVDA", "Nvidia"), ("GC=F", "Or"), ("EURUSD=X", "EUR/USD")]


# --- Les chargements en cache --------------------------------------------------------------------
# Chacun passe par `_resilient` : en cas de panne de Yahoo, la dernière réponse connue, sinon une valeur vide, et la
# page continue de s'afficher.


@st.cache_data(ttl=6 * 3600, max_entries=500, show_spinner=False)
@_network
def _overview(symbol: str) -> dict:
    return _not_empty(company.fetch_overview(symbol))


def load_overview(symbol: str) -> dict:
    """La fiche Yahoo d'une valeur (nom, type, devise, indicateurs), gardée 6 heures. Vide si Yahoo ne la connaît pas."""
    return _resilient("overview", _overview, symbol, empty={})


@st.cache_data(ttl=6 * 3600, max_entries=500, show_spinner=False)
@_network
def _income(symbol: str) -> list[dict]:
    return _not_empty(company.fetch_income(symbol))


def load_income(symbol: str) -> list[dict]:
    """Chiffre d'affaires et résultat net des dernières années, gardés 6 heures."""
    return _resilient("income", _income, symbol, empty=[])


@st.cache_data(ttl=6 * 3600, max_entries=500, show_spinner=False)
@_network
def _dividends(symbol: str) -> list[tuple[str, float]]:
    return company.fetch_dividends(symbol)


def load_dividends(symbol: str) -> list[tuple[str, float]]:
    """Les dividendes versés, gardés 6 heures."""
    return _resilient("dividends", _dividends, symbol, empty=[])


@st.cache_data(ttl=6 * 3600, max_entries=500, show_spinner=False)
@_network
def _analysts(symbol: str) -> dict:
    return company.fetch_analysts(symbol)


def load_analysts(symbol: str) -> dict:
    """Les avis des analystes quand la fiche Yahoo n'en donne pas, gardés 6 heures."""
    return _resilient("analysts", _analysts, symbol, empty={})


@st.cache_data(ttl=900, max_entries=300, show_spinner=False)
@_network
def _ticker_news(symbol: str) -> list:
    return fetch_yahoo_ticker_news(symbol)


def load_ticker_news(symbol: str) -> list:
    """Les nouvelles de Yahoo Finance sur une valeur, gardées 15 minutes."""
    return _resilient("ticker_news", _ticker_news, symbol, empty=[])


def display_name(symbol: str) -> str:
    """Le nom à afficher pour un symbole : celui que le site connaît, sinon celui de Yahoo, sinon le symbole."""
    return company.known_name(symbol) or load_overview(symbol).get("shortName") or symbol


# --- Mise en forme -------------------------------------------------------------------------------


def format_indicator(value, kind: str, currency: str) -> str:
    if value is None:
        return "—"
    if kind == "money":
        return theme.compact_money(value, currency)
    if kind == "x":
        return f"{theme.fr_number(value, 1)}×"
    if kind == "pct":  # yfinance donne déjà ce chiffre en pourcentage (3,41 = 3,41 %)
        return f"{theme.fr_number(value, 2)} %"
    if kind == "ratio":  # fraction : 0,137 = 13,7 %
        return f"{theme.fr_number(value * 100, 1)} %"
    return theme.fr_number(value, 2)


def news_markers(closes: pd.Series, articles) -> pd.DataFrame:
    """Place chaque dépêche sur la courbe : à sa date, à la hauteur du dernier cours connu à ce moment-là."""
    rows = []
    for article in articles[:40]:
        moment = pd.Timestamp(article.published)
        moment = moment.tz_convert(closes.index.tz) if closes.index.tz else moment.tz_localize(None)
        if closes.index[0] <= moment:
            rows.append({"date": closes.index[closes.index.get_indexer([moment], method="pad")[0]],
                         "cours": float(closes.asof(moment)), "titre": article.title, "source": article.source})
    return pd.DataFrame(rows)


def price_chart(closes: pd.Series, currency: str, long_period: bool, markers: pd.DataFrame) -> alt.LayerChart:
    """Courbe du cours de clôture, avec un réticule et les dépêches placées sur la courbe.

    Sous la courbe, un voile dégradé qui descend jusqu'au bas du graphique (y2 = « height ») : l'axe ne part pas de
    zéro, les variations restent bien visibles.
    """
    data = closes.rename("cours").rename_axis("date").reset_index()
    base = alt.Chart(data).encode(
        # Mois en français grâce à theme.french (voir theme.ALTAIR_LOCALE)
        x=alt.X("date:T", title=None, axis=alt.Axis(grid=False, labelAngle=0, tickCount=6, domainOpacity=0.4,
                                                    format="%b %Y" if long_period else "%d %b")),
        y=alt.Y("cours:Q", title=None, scale=alt.Scale(zero=False), stack=None,  # le voile ne force pas le zéro
                axis=alt.Axis(gridOpacity=0.18, domain=False, ticks=False, tickCount=5)),
    )
    hover = alt.selection_point(fields=["date"], nearest=True, on="pointerover", empty=False, clear="pointerout")
    blue = theme.SERIES_COLORS[0]
    area = base.mark_area(color=theme.area_fill(blue)).encode(y2=alt.value("height"))
    line = base.mark_line(color=blue, strokeWidth=2, strokeJoin="round")
    rule = (
        base.mark_rule(color=theme.NEUTRAL, strokeWidth=1)
        .encode(opacity=alt.condition(hover, alt.value(1), alt.value(0)),
                tooltip=[alt.Tooltip("date:T", title="Date", format="%d/%m/%Y"),
                         alt.Tooltip("cours:Q", title=f"Clôture ({currency})", format=",.2f")])
        .add_params(hover)
    )
    dot = base.mark_circle(color=blue, size=70, stroke=theme.chart_surface(), strokeWidth=2).encode(
        opacity=alt.condition(hover, alt.value(1), alt.value(0))
    )
    layers = area + line + rule + dot
    if not markers.empty:
        news = alt.Chart(markers).mark_point(shape="diamond", filled=True, size=90, color=theme.NEUTRAL).encode(
            x="date:T", y="cours:Q",
            tooltip=[alt.Tooltip("date:T", title="Séance", format="%d/%m/%Y"),
                     alt.Tooltip("titre:N", title="Dépêche"), alt.Tooltip("source:N", title="Source")],
        )
        layers = layers + news
    return layers.properties(height=280, background="transparent")  # fond de la carte


def agenda_html(symbol: str, currency: str) -> str:
    """Prochains rendez-vous de l'entreprise et consensus des analystes (vide si Yahoo ne fournit rien)."""
    calendar = load_calendar(symbol)
    rows = []

    def when(day: date) -> str:
        delta = (day - date.today()).days
        countdown = "aujourd'hui" if delta == 0 else f"dans {delta} jour{'s' if delta > 1 else ''}"
        return f"{theme.fr_day(day)} {day.year}<small>{countdown}</small>"

    if calendar.get("earnings"):
        rows.append(("Prochains résultats", when(calendar["earnings"])))
    if calendar.get("ex_dividend"):
        rows.append(("Détachement du dividende", when(calendar["ex_dividend"])))
    if calendar.get("dividend"):
        rows.append(("Versement du dividende", when(calendar["dividend"])))
    if calendar.get("eps_average") is not None:
        rows.append(("Consensus BPA du trimestre", f"{theme.fr_number(calendar['eps_average'])} {esc(currency)}"))
    if calendar.get("revenue_average"):
        rows.append(("Consensus chiffre d'affaires", theme.compact_money(calendar["revenue_average"], currency)))
    if not rows:
        return ""
    items = "".join(f"<li><span>{label}</span><span>{value}</span></li>" for label, value in rows)
    return theme.card(f'<ul class="fv-agenda">{items}</ul>', "Agenda")


def range_html(low, high, current, stats: dict | None = None) -> str:
    """La fourchette sur 52 semaines : une barre entre le plus bas et le plus haut, et le cours actuel dessus."""
    if not (low and high and current and high > low):
        return ""
    position = min(max((current - low) / (high - low), 0), 1)
    if stats is not None:
        stats["Position dans la fourchette sur 52 semaines (%)"] = round(position * 100)
    return (
        f'<div class="fv-range" title="Le cours actuel se situe à {position:.0%} entre le plus bas et le plus haut sur un an">'
        f"Fourchette sur 52 semaines"
        f'<div class="fv-range-bar"><i style="left:{position:.1%}"></i></div>'
        f'<div class="fv-range-ends"><span>{theme.price(low)}</span><span>cours {theme.price(current)}</span>'
        f"<span>{theme.price(high)}</span></div></div>"
    )


def price_block(symbol: str, currency: str, articles, stats: dict, unit: str = "%") -> None:
    """Le cours, sa variation et le graphique annoté, avec le choix de la période. `stats` reçoit les chiffres
    calculés (pour l'analyse). Unité « pb » : un taux d'intérêt, dont la variation se lit en points de base."""
    period = st.segmented_control("Période du graphique", list(CHART_PERIODS), default="6 mois",
                                  key=f"period_{symbol}", label_visibility="collapsed")
    history = load_history(symbol, CHART_PERIODS[period or "6 mois"])
    closes = history["Close"].dropna() if history is not None and not history.empty else pd.Series(dtype=float)
    if len(closes) < 2:
        st.caption("Historique indisponible pour le moment.")
        return
    # dropna() : la ligne du jour peut être vide (week-end, séance pas encore ouverte)
    last, previous, first = float(closes.iloc[-1]), float(closes.iloc[-2]), float(closes.iloc[0])
    if unit == "pb":
        day, span = (last - previous) * 100, (last - first) * 100
    else:
        day, span = (last / previous - 1) * 100, (last / first - 1) * 100
    stats["Variation sur la période affichée (%)"] = round(span, 1)
    stats["Période affichée"] = period or "6 mois"
    st.html(
        f'<div class="fv-quote-big"><b>{theme.price(last)} {esc(currency)}</b>'
        f"{theme.change(day, unit)}"
        f"<small>sur la séance · {theme.signed(span, unit)} sur {esc(period or '6 mois')}</small></div>"
    )
    markers = news_markers(closes, list(articles))
    with st.container(key=f"fvchart_{symbol}"):
        chart = price_chart(closes, currency, period in ("1 an", "5 ans"), markers)
        st.altair_chart(theme.french(chart), width="stretch")
    if not markers.empty:
        st.caption(f"◆ {len(markers)} dépêche(s) placée(s) sur la courbe : survole un losange pour lire le titre.")


def company_sheet(symbol: str, label: str, articles=(), user: str | None = None) -> None:
    """La fiche d'une entreprise : identité, cours, graphique annoté, indicateurs clés, agenda, présentation.
    `user` : l'utilisateur connecté (son quota d'analyse par l'IA), ou None."""
    profile = load_overview(symbol)
    name = profile.get("longName") or profile.get("shortName") or label
    currency = profile.get("currency", "")
    website = profile.get("website") or (f"https://{COMPANIES[symbol][1]}" if symbol in COMPANIES else "")
    logo = theme.favicon_url(website) if website else ""
    details = " · ".join(
        esc(part) for part in [symbol, profile.get("fullExchangeName"), profile.get("sector"), profile.get("country")]
        if part
    )
    st.html(
        f'<div class="fv-firm">{f"<img src={chr(34)}{logo}{chr(34)} alt={chr(34)}{chr(34)}>" if logo else ""}'
        f"<div><h2>{esc(name)}</h2><p>{details}</p></div></div>"
    )

    left, right = st.columns([1.6, 1], gap="large")
    stats = {}  # les chiffres calculés ici, transmis à l'analyse (IA ou lecture automatique)
    with left:
        price_block(symbol, currency, articles, stats)

    with right:
        rows = "".join(
            f'<dt title="{esc(help_text)}">{esc(title)}</dt>'
            f"<dd>{format_indicator(profile.get(key), kind, currency)}</dd>"
            for key, (title, kind, help_text) in INDICATORS.items()
        )
        range_block = range_html(profile.get("fiftyTwoWeekLow"), profile.get("fiftyTwoWeekHigh"),
                                 profile.get("regularMarketPrice"), stats)
        st.html(theme.card(f'<dl class="fv-ratios">{rows}</dl>{range_block}', "Indicateurs clés"))
        if agenda := agenda_html(symbol, currency):
            st.html(agenda)
        st.caption("Survole un indicateur pour voir sa définition. Données Yahoo Finance.")
        st.page_link("views/glossary.py", label="Tous les termes dans le glossaire", icon=":material/menu_book:")

    analysis(symbol, name, profile, stats, list(articles), user)
    if profile.get("longBusinessSummary"):
        with st.expander("À propos de l'entreprise"):
            st.write(profile["longBusinessSummary"])


def analysis(symbol: str, name: str, profile: dict, stats: dict, articles: list, user: str | None) -> None:
    """L'analyse de l'entreprise : par l'IA (gardée 6 heures, pour tous les visiteurs), sinon une lecture
    automatique des indicateurs. Calculée seulement à la demande (bouton), pour ménager le quota gratuit."""
    use_ai = ai_enabled() and ai_quota(user)[0] > 0
    theme.section("L'analyse", "rédigée par l'IA" if use_ai else "lecture automatique des indicateurs")
    flag = f"fv_analysis_{symbol}"
    if not st.session_state.get(flag):
        st.button("Analyser cette entreprise", icon=":material/auto_awesome:", key=f"{flag}_button",
                  on_click=lambda: st.session_state.update({flag: True}))
        st.caption("Points forts, points de vigilance et ce qu'il faut surveiller, expliqués simplement.")
        return
    result, sources = {"text": None, "note": None, "engine": ""}, []
    if use_ai:
        messages, sources = assistant.company_messages(name, symbol, profile, stats, articles)

        def compute() -> dict:
            answer = complete_ai(messages, max_tokens=1200)
            if answer["text"]:
                ai_count(user)  # compté seulement quand l'IA travaille vraiment (pas pour une analyse en mémoire)
            return answer | {"sources": [s.to_dict() for s in sources]}

        key = f"company|{symbol}|{date.today()}|{stats.get('Période affichée', '')}"
        with st.spinner(f"Analyse de {name} en cours…"):
            result = assistant.ANALYSES.get_or_compute(key, compute)
        sources = [assistant.Source(**s) for s in result.get("sources", [])]  # celles de l'analyse en mémoire
    text = result["text"] or assistant.company_offline(name, profile, stats)
    with st.container(key=f"fvanalysis_{symbol}"):
        st.markdown(assistant.linkify(text, sources))
    if result["text"] and (used := assistant.cited(text, sources)):
        st.html(theme.sources_html([s.to_dict() for s in used], "Dépêches citées"))
    origin = f"Rédigé par {result['engine']}" if result["text"] else "Lecture automatique des indicateurs, sans IA"
    note = f" ({result['note']})" if result["note"] and not result["text"] else ""
    st.caption(f"{origin}{note}. Analyse pédagogique, pas un conseil en investissement.")


def follow(user: str, kind: str, value: str, label: str) -> None:
    storage.add_follow(user, kind, value, label)
    st.toast(f"Tu suis maintenant {label}")


def unfollow_company(user: str, symbol: str, label: str) -> None:
    storage.remove_follow(user, "company", symbol)
    st.toast(f"Tu ne suis plus {label}")


# --- La fiche d'un indice, d'une devise, d'une matière première, d'un taux -----------------------


def market_sheet(symbol: str, name: str, profile: dict, kind: str, articles=()) -> str:
    """La fiche d'une valeur qui n'est pas une entreprise : cours et graphique à gauche, repères et fourchette sur
    52 semaines à droite. Renvoie l'unité de variation (« % » ou « pb ») pour les sections suivantes."""
    unit = "pb" if symbol in company.RATE_SYMBOLS else "%"
    currency = "%" if unit == "pb" else "points" if kind == "INDEX" else profile.get("currency", "")
    details = " · ".join(esc(part) for part in [symbol, profile.get("fullExchangeName"), company.KIND_NAMES.get(kind)] if part)
    st.html(f'<div class="fv-firm"><div><h2>{esc(profile.get("longName") or name)}</h2><p>{details}</p></div></div>')
    left, right = st.columns([1.6, 1], gap="large")
    with left:
        price_block(symbol, currency, articles, {}, unit)
    with right:
        low, high, current = (profile.get("fiftyTwoWeekLow"), profile.get("fiftyTwoWeekHigh"),
                              profile.get("regularMarketPrice"))
        if not (low and high and current):  # Yahoo n'a pas donné la fourchette : on la lit dans l'historique d'un an
            year = load_history(symbol, "1y")
            if year is not None and not year.empty:
                closes = year["Close"].dropna()
                low, high, current = float(closes.min()), float(closes.max()), float(closes.iloc[-1])
        exchange = profile.get("fullExchangeName")
        facts = [("Symbole", symbol), ("Type", company.KIND_NAMES.get(kind, "—")),
                 *([("Place de cotation", exchange)] if exchange and exchange != "CCY" else []),
                 ("Cotation en", "pourcentage (taux)" if unit == "pb" else currency or "—")]
        rows = "".join(f"<dt>{label}</dt><dd>{esc(value)}</dd>" for label, value in facts)
        st.html(theme.card(f'<dl class="fv-ratios">{rows}</dl>{range_html(low, high, current)}', "Repères"))
        st.caption("Données Yahoo Finance, différées.")
    return unit


def performance_section(symbol: str, unit: str = "%") -> None:
    """Un tableau compact des variations sur une semaine, un mois, 3 mois, 6 mois, depuis le 1er janvier, un an, 5 ans."""
    theme.section("Performances", "variation du cours" if unit == "%" else "variation, en points de base")
    history = load_history(symbol, "5y")
    closes = history["Close"].dropna() if history is not None and not history.empty else pd.Series(dtype=float)
    rows = company.performances(closes, unit)
    if not rows:
        st.caption("Performances indisponibles pour le moment.")
        return
    cells = "".join(
        f"<div><small>{esc(label)}</small>"
        + (theme.change(value, unit) if value is not None else '<span class="fv-flat">—</span>') + "</div>"
        for label, value in rows
    )
    st.html(f'<div class="fvq-perf">{cells}</div>')
    st.caption("Dernier cours comparé à la clôture de la date indiquée. « — » : l'historique est trop court.")


def index_movers(symbol: str) -> None:
    """Pour l'indice d'une place (CAC 40, S&P/TSX, Dow Jones) : ses 5 plus fortes hausses et baisses, et un lien vers
    la carte de la place."""
    key = company.place_of_index(symbol)
    if key is None:
        return
    place, _, index_name, members = PLACES[key]
    theme.section(f"Dans le {index_name}", "plus fortes hausses et baisses de la séance")
    labels = {s: name for s, name, _ in members}
    quotes = load_symbol_quotes(tuple(labels), labels, "Fiche")
    changes = [(s, labels[s], quotes[s].change) for s in labels if s in quotes]
    if not changes:
        st.caption("Les cours des valeurs de cet indice ne sont pas disponibles pour le moment.")
    else:
        ups, downs = company.movers(changes)
        left, right = st.columns(2, gap="large")
        for column, title, items in [(left, "Plus fortes hausses", ups), (right, "Plus fortes baisses", downs)]:
            with column:
                st.markdown(f"**{title}**")
                if not items:
                    st.caption("Aucune valeur aujourd'hui.")
                    continue
                rows = "".join(
                    f'<li><a class="fv-rank-link" href="{theme.fiche_url(s)}" target="_self"><b>{esc(name)}</b></a>'
                    f"{theme.change(move)}</li>"
                    for s, name, move in items
                )
                st.html(theme.card(f'<ul class="fv-ranking">{rows}</ul>'))
    st.page_link("views/markets.py", label=f"Voir la carte de la place : {place}", icon=":material/map:",
                 query_params={"view": key})


# --- Les sections de la fiche d'une action -------------------------------------------------------


def scaled(values: list[float]) -> tuple[float, str]:
    """Le diviseur et le suffixe qui rendent des montants lisibles (milliards, millions) : (1e9, « Md »)."""
    biggest = max((abs(v) for v in values), default=0)
    if biggest >= 1e9:
        return 1e9, "Md"
    if biggest >= 1e6:
        return 1e6, "M"
    return 1.0, ""


def results_section(symbol: str, currency: str) -> None:
    """Chiffre d'affaires et résultat net des 4 dernières années, en barres groupées, avec la marge nette."""
    theme.section("Résultats", "4 derniers exercices")
    rows = load_income(symbol)
    if not rows:
        st.caption("Les résultats annuels ne sont pas disponibles pour cette valeur (Yahoo n'en donne pas).")
        return
    divisor, suffix = scaled([r["revenue"] for r in rows] + [r["net"] for r in rows if r["net"] is not None])
    unit = f"{suffix} {currency}".strip()
    names = {"revenue": "Chiffre d'affaires", "net": "Résultat net"}
    data = pd.DataFrame(
        [{"exercice": str(r["year"]), "série": names[key], "montant": r[key] / divisor,
          "libellé": theme.fr_number(r[key] / divisor, 1 if divisor > 1 else 0)}
         for r in rows for key in names if r[key] is not None]
    )
    colors = alt.Scale(domain=list(names.values()), range=[theme.SERIES_COLORS[0], theme.SERIES_COLORS[2]])
    base = alt.Chart(data).encode(
        x=alt.X("exercice:O", title=None, axis=alt.Axis(labelAngle=0, domainOpacity=0.4, ticks=False)),
        xOffset=alt.XOffset("série:N"),
        y=alt.Y("montant:Q", title=f"En {unit}" if unit else None,
                axis=alt.Axis(gridOpacity=0.18, domain=False, ticks=False, tickCount=5)),
        color=alt.Color("série:N", scale=colors, legend=alt.Legend(title=None, orient="top")),
        tooltip=[alt.Tooltip("exercice:O", title="Exercice"), alt.Tooltip("série:N", title="Mesure"),
                 alt.Tooltip("montant:Q", title=f"Montant ({unit})", format=",.2f")],
    )
    bars = base.mark_bar(cornerRadiusTopLeft=3, cornerRadiusTopRight=3)
    labels = base.mark_text(dy=-6, fontSize=11, fontWeight=600, color=theme.chart_ink(strong=True)).encode(
        text="libellé:N")
    with st.container(key=f"fvchart_results_{symbol}"):
        st.altair_chart(theme.french((bars + labels).properties(height=280, background="transparent")),
                        width="stretch")
    margins = "".join(
        f'<li><span>{r["year"]}</span><b>{theme.fr_number(r["margin"], 1)} %</b></li>'
        for r in rows if r["margin"] is not None
    )
    if margins:
        st.html(f'<div class="fvq-margins"><span>Marge nette</span><ul>{margins}</ul></div>')
    st.caption(f"Montants en {unit}. Marge nette = résultat net ÷ chiffre d'affaires. Données Yahoo Finance.")


def analysts_section(symbol: str, profile: dict, currency: str) -> None:
    """Ce qu'en pensent les analystes : recommandation moyenne, objectifs de cours sur une barre, potentiel."""
    theme.section("Ce qu'en pensent les analystes")
    extra = {} if profile.get("recommendationMean") and profile.get("targetMeanPrice") else load_analysts(symbol)
    summary = company.analyst_summary(profile, extra)
    if summary is None:
        st.caption("Yahoo ne donne pas d'avis d'analystes sur cette valeur.")
        return
    head = ""
    if summary["label"]:
        count = f"{summary['count']} analyste{'s' if summary['count'] > 1 else ''}" if summary["count"] else ""
        head = (f'<div class="fvq-verdict"><b>{summary["label"].capitalize()}</b>'
                f'<span>{"avis moyen de " + count if count else "avis moyen des analystes"}</span></div>')
    bar = ""
    low, target, high, current = summary["low"], summary["target"], summary["high"], summary["current"]
    if low and target and high and current:
        spots = company.target_positions(low, target, high, current)
        bar = (
            '<div class="fvq-targets" role="img" aria-label="Objectifs de cours des analystes et cours actuel">'
            f'<div class="fvq-track"><i class="fvq-span" style="left:{spots["low"]:.1f}%;'
            f'width:{spots["high"] - spots["low"]:.1f}%"></i>'
            f'<i class="fvq-mark is-target" style="left:{spots["target"]:.1f}%"></i>'
            f'<i class="fvq-mark is-now" style="left:{spots["current"]:.1f}%"></i></div>'
            f'<dl><div><dt>Objectif bas</dt><dd>{theme.price(low)}</dd></div>'
            f'<div class="is-target"><dt>Objectif moyen</dt><dd>{theme.price(target)}</dd></div>'
            f'<div><dt>Objectif haut</dt><dd>{theme.price(high)}</dd></div>'
            f'<div class="is-now"><dt>Cours actuel</dt><dd>{theme.price(current)}</dd></div></dl></div>'
        )
    potential = ""
    if summary["upside"] is not None:
        potential = (f'<p class="fvq-upside">Potentiel jusqu\'à l\'objectif moyen : {theme.change(summary["upside"])}'
                     f'</p>')
    st.html(theme.card(head + bar + potential, "Objectifs de cours"))
    st.caption("Avis et objectifs publiés par des analystes financiers, relayés par Yahoo Finance : une opinion, "
               "pas un conseil en investissement.")


def dividends_section(symbol: str, profile: dict, currency: str) -> None:
    """Dividendes : rendement, dernier montant versé et historique annuel des 5 dernières années (barres)."""
    theme.section("Dividendes")
    payments = load_dividends(symbol)
    if not payments:
        st.caption("Aucun dividende versé, ou Yahoo n'en donne pas pour cette valeur.")
        return
    rate = profile.get("dividendYield")  # déjà en % chez yfinance
    if rate is None:
        rate = company.trailing_yield(payments, profile.get("regularMarketPrice"))
    last_day, last_amount = payments[-1]
    left, right = st.columns([1, 1.6], gap="large")
    with left:
        yield_text = f"{theme.fr_number(rate, 2)}\u202f%" if rate is not None else "—"
        rows = (f'<dt title="Dividendes versés sur les 12 derniers mois ÷ cours actuel.">Rendement</dt><dd>{yield_text}</dd>'
                f"<dt>Dernier dividende</dt><dd>{theme.fr_number(last_amount)}\u00a0{esc(currency)}</dd>"
                f"<dt>Versé le</dt><dd>{date.fromisoformat(last_day):%d/%m/%Y}</dd>")
        st.html(theme.card(f'<dl class="fv-ratios">{rows}</dl>', "En un coup d'œil"))
    with right:
        yearly = company.annual_dividends(payments)
        if not yearly:
            st.caption("L'historique annuel n'est pas encore disponible.")
            return
        data = pd.DataFrame({"année": [str(y) for y, _ in yearly], "montant": [m for _, m in yearly],
                             "libellé": [theme.fr_number(m) for _, m in yearly]})
        base = alt.Chart(data).encode(
            x=alt.X("année:O", title=None, axis=alt.Axis(labelAngle=0, domainOpacity=0.4, ticks=False)),
            y=alt.Y("montant:Q", title=f"Par action ({currency})" if currency else None,
                    axis=alt.Axis(gridOpacity=0.18, domain=False, ticks=False, tickCount=4)),
            tooltip=[alt.Tooltip("année:O", title="Année"), alt.Tooltip("montant:Q", title="Dividende", format=",.2f")],
        )
        bars = base.mark_bar(color=theme.SERIES_COLORS[3], cornerRadiusTopLeft=3, cornerRadiusTopRight=3)
        labels = base.mark_text(dy=-6, fontSize=11, fontWeight=600, color=theme.chart_ink(strong=True)).encode(
            text="libellé:N")
        with st.container(key=f"fvchart_dividends_{symbol}"):
            st.altair_chart(theme.french((bars + labels).properties(height=220, background="transparent")),
                            width="stretch")
    st.caption("Total versé par action et par année civile (années complètes). Données Yahoo Finance.")


def news_section(articles: list, symbol: str, user: str | None) -> None:
    """Les dépêches du fil qui parlent de l'entreprise et les nouvelles de Yahoo sur la valeur (voir
    `company.related_news`), les plus récentes d'abord."""
    theme.section("Actualités", "dépêches du fil et nouvelles Yahoo")
    if not articles:
        st.caption("Aucune dépêche récente sur cette valeur.")
        return
    statuses = storage.get_statuses(user) if user else {}
    with st.container(key=f"fvpanel_fiche_{symbol}"):
        for article in articles:
            article_card(article, statuses.get(article.id, NO_STATUS), key_prefix=f"fiche_{symbol}", user=user,
                         show_image=False)


def peers_section(symbol: str) -> None:
    """Les autres valeurs de la même place et du même secteur, en tuiles cliquables avec leur variation du jour."""
    peers = company.sector_peers(symbol)
    if not peers:
        return
    key = place_of(symbol)
    sector = next(sec for s, _, sec in PLACES[key][3] if s == symbol)
    theme.section("Les autres valeurs du secteur", f"{sector} · {PLACES[key][0]}")
    labels = dict(peers)
    quotes = load_symbol_quotes(tuple(labels), labels, "Fiche")
    tiles = [theme.quote_tile(quotes[s]) for s in labels if s in quotes]
    if tiles:
        st.html(f'<div class="fv-tiles">{"".join(tiles)}</div>')
    else:
        st.caption("Les cours de ces valeurs ne sont pas disponibles pour le moment.")


def actions_row(symbol: str, name: str, user: str | None, stock: bool) -> None:
    """Suivre la valeur (une entreprise seulement), créer une alerte, l'ajouter au portefeuille (une action seulement)."""
    with st.container(horizontal=True, gap="small", key="fvq_actions"):
        if stock and user is None:
            st.page_link("views/account.py", label="Connecte-toi pour suivre", icon=":material/login:")
        elif stock and symbol in {f["value"] for f in storage.list_follows(user, "company")}:
            st.button("Tu suis cette valeur", icon=":material/star:", key="fvq_unfollow", type="primary",
                      help="Cliquer pour ne plus la suivre", on_click=unfollow_company, args=(user, symbol, name))
        elif stock:
            st.button("Suivre", icon=":material/star_outline:", key="fvq_follow", on_click=follow,
                      args=(user, "company", symbol, name))
        st.page_link("views/alerts.py", label="Créer une alerte", icon=":material/notifications:",
                     query_params={"s": symbol})
        if stock:
            st.page_link("views/portfolio.py", label="Ajouter au portefeuille", icon=":material/add_chart:",
                         query_params={"s": symbol})


# --- La recherche d'une valeur -------------------------------------------------------------------

STYLE = """<style>
.fvq-results { display: flex; flex-direction: column; margin: 0; padding: 0; }
.fvq-results a { display: flex; flex-wrap: wrap; align-items: baseline; gap: .1rem .7rem; padding: .55rem .2rem;
  border-bottom: 1px solid var(--fv-line); color: inherit; text-decoration: none; font-size: .9rem; }
.fvq-results a:last-child { border-bottom: 0; }
.fvq-results a:hover b, .fvq-results a:focus-visible b { color: var(--fv-brand); }
.fvq-results small { color: var(--fv-muted); }
.fvq-chips { display: flex; flex-wrap: wrap; gap: .5rem; margin: .4rem 0 0; }
.fvq-chips a { padding: .4rem .85rem; border: 1px solid var(--fv-line-strong); border-radius: var(--chip-radius);
  background: var(--fv-surface); color: inherit; text-decoration: none; font-size: .88rem; font-weight: 500; }
.fvq-chips a:hover, .fvq-chips a:focus-visible { border-color: var(--fv-brand); color: var(--fv-brand); }
.fvq-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem .5rem; margin: 0; padding: 0;
  list-style: none; font-size: .82rem; color: var(--fv-muted); }
.fvq-crumbs li { display: inline-flex; align-items: center; gap: .5rem; margin: 0; padding: 0; }
.fvq-crumbs li + li::before { content: "›"; color: var(--fv-faint); }
.fvq-crumbs a { color: var(--fv-brand); text-decoration: none; font-weight: 500; }
.fvq-crumbs a:hover { text-decoration: underline; }
.fvq-crumbs [aria-current] { color: var(--fv-text); font-weight: 600; }
.fvq-perf { display: grid; grid-template-columns: repeat(auto-fit, minmax(7.2rem, 1fr)); gap: .6rem; }
.fvq-perf div { display: flex; flex-direction: column; gap: .25rem; margin: 0; padding: .7rem .85rem; border: 1px solid var(--fv-line);
  border-radius: var(--radius-md); background: var(--fv-surface); box-shadow: var(--fv-elev); font-size: 1rem; font-weight: 600;
  font-variant-numeric: tabular-nums; }
.fvq-perf small { font-size: .74rem; font-weight: 500; color: var(--fv-muted); }
.fvq-margins { display: flex; flex-wrap: wrap; align-items: baseline; gap: .3rem 1rem; margin: .5rem 0 .2rem;
  font-size: .85rem; }
.fvq-margins > span { color: var(--fv-muted); font-weight: 600; }
.fvq-margins ul { display: flex; flex-wrap: wrap; gap: .3rem 1.1rem; margin: 0; padding: 0; list-style: none; }
.fvq-margins li { display: inline-flex; gap: .4rem; margin: 0; padding: 0; color: var(--fv-muted); }
.fvq-margins b { color: var(--fv-text); font-variant-numeric: tabular-nums; }
.fvq-verdict { display: flex; flex-wrap: wrap; align-items: baseline; gap: .2rem .8rem; margin: .1rem 0 1.1rem; }
.fvq-verdict b { font-size: 1.5rem; letter-spacing: -.02em; }
.fvq-verdict span { font-size: .82rem; color: var(--fv-muted); }
.fvq-track { position: relative; height: 8px; margin: 1.1rem 0 1rem; border-radius: 4px; background: var(--fv-line); }
.fvq-span { position: absolute; top: 0; height: 100%; border-radius: 4px;
  background: color-mix(in srgb, var(--fv-brand) 35%, transparent); }
.fvq-mark { position: absolute; top: -6px; width: 4px; height: 20px; margin-left: -2px; border-radius: 2px; }
.fvq-mark.is-target { background: var(--fv-brand); }
.fvq-mark.is-now { background: var(--fv-text); box-shadow: 0 0 0 2px var(--fv-surface); }
.fvq-targets dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr)); gap: .5rem 1rem; margin: 0; }
.fvq-targets dl div { margin: 0; padding-left: .6rem; border-left: 3px solid transparent; }
.fvq-targets dl div.is-target { border-left-color: var(--fv-brand); }
.fvq-targets dl div.is-now { border-left-color: var(--fv-text); }
.fvq-targets dt { font-size: .74rem; color: var(--fv-muted); }
.fvq-targets dd { margin: 0; font-family: var(--fv-mono); font-size: 1.05rem; font-variant-numeric: tabular-nums; }
.fvq-upside { margin: 1rem 0 0; padding-top: .8rem; border-top: 1px solid var(--fv-line); font-size: .9rem; }
.fvq-upside small { margin-left: .4rem; color: var(--fv-muted); }
</style>"""


def search_results(query: str) -> str:
    """Les résultats de la recherche, en liens vers les fiches. Un symbole tapé tel quel (« ^FCHI », « GC=F »)
    est toujours proposé : la recherche de Yahoo ne trouve que les actions et les fonds."""
    query = query.strip()
    symbol = company.normalize_symbol(query)
    rows = [(found["symbol"], found["name"], f"{found['symbol']} · {found['exchange']}")
            for found in search_companies(query) if found["symbol"] != symbol]
    # Ce qui ressemble à un symbole (« ^FCHI », « GC=F », « AAPL »), à la fin de la liste
    if re.fullmatch(r"[A-Za-z0-9^.=\-]{1,20}", query) and (query != query.lower() or re.search(r"[\^.=\-\d]", query)):
        rows.append((symbol, f"Ouvrir le symbole {symbol}", "Indice, devise, matière première, action…"))
    if not rows:
        return ""
    links = "".join(
        f'<a href="{theme.fiche_url(symbol)}" target="_self"><b>{esc(title)}</b><small>{esc(detail)}</small></a>'
        for symbol, title, detail in rows
    )
    return f'<nav class="fvq-results" aria-label="Résultats de la recherche">{links}</nav>'


def search_box(key: str = "fiche_search") -> None:
    """Le champ de recherche d'une valeur (nom ou symbole) et, dessous, les fiches trouvées."""
    query = st.text_input("Chercher une valeur", key=key, icon=":material/search:", label_visibility="collapsed",
                          placeholder="Nom ou symbole : LVMH, Apple, ^FCHI, EURUSD=X…")
    if query.strip():
        with st.container(border=True):
            if found := search_results(query):
                st.html(found)
            else:
                st.caption("Aucun résultat. Essaie le nom anglais ou le symbole boursier.")


def shortcuts_html() -> str:
    """Quelques fiches connues, en liens."""
    links = "".join(f'<a href="{theme.fiche_url(symbol)}" target="_self">{esc(name)}</a>' for symbol, name in SHORTCUTS)
    return f'<nav class="fvq-chips" aria-label="Fiches connues">{links}</nav>'


def breadcrumb(symbol: str, name: str, kind: str) -> str:
    """Le fil d'Ariane « Marchés › France › LVMH » : « Marchés » et la place mènent à la page Marchés."""
    key = place_of(symbol) or company.place_of_index(symbol)
    steps = ['<li><a href="markets" target="_self">Marchés</a></li>']
    if key:
        steps.append(f'<li><a href="markets?view={url_quote(key)}" target="_self">{esc(PLACES[key][0])}</a></li>')
    else:
        steps.append(f"<li><span>{esc(company.KINDS.get(kind, 'Valeurs'))}</span></li>")
    steps.append(f'<li><span aria-current="page">{esc(name)}</span></li>')
    return f'<nav aria-label="Fil d\'Ariane"><ul class="fvq-crumbs">{"".join(steps)}</ul></nav>'


def quote_for_header(symbol: str, name: str, unit: str) -> list[Quote]:
    """Le cours de la valeur pour l'en-tête de la page (tuile flottante), d'après son historique : aucun appel de plus."""
    history = load_history(symbol, "5y")
    closes = history["Close"].dropna() if history is not None and not history.empty else pd.Series(dtype=float)
    if len(closes) < 2:
        return []
    return [Quote(symbol, name, "", unit, float(closes.iloc[-1]), float(closes.iloc[-2]), closes.tail(60))]
