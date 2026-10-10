"""Page « Mes suivis » : entreprises et thèmes suivis, fils dédiés et fiches entreprises."""

import altair as alt
import pandas as pd
import streamlit as st

import theme
from core import storage
from core.config import COMPANIES
from core.market import INDICATORS
from theme import esc
from ui import (
    NO_STATUS,
    api_keys,
    article_card,
    flush_toast,
    load_followed,
    load_followed_quotes,
    load_history,
    load_profile,
    search_companies,
)

SUGGESTIONS = [("company", "MC.PA", "LVMH"), ("company", "AIR.PA", "Airbus"), ("company", "NVDA", "Nvidia"),
               ("company", "AAPL", "Apple"), ("theme", "inflation", "inflation"), ("theme", "BCE", "BCE")]
CHART_PERIODS = {"1 mois": "1mo", "6 mois": "6mo", "1 an": "1y", "5 ans": "5y"}


def follow(kind: str, value: str, label: str) -> None:
    storage.add_follow(kind, value, label)
    st.toast(f"Tu suis maintenant {label}")


def unfollow(kind: str, value: str, label: str) -> None:
    storage.remove_follow(kind, value)
    st.session_state.pop("follow_view", None)  # revient à la vue d'ensemble
    st.toast(f"Tu ne suis plus {label}")


def add_theme() -> None:
    """Callback du champ « thème » : la valeur saisie est lue via sa clé dans session_state."""
    value = st.session_state.get("new_theme", "").strip()
    if value:
        follow("theme", value, value)
    st.session_state.new_theme = ""


def format_indicator(value, kind: str, currency: str) -> str:
    if value is None:
        return "—"
    if kind == "money":
        return theme.compact_money(value, currency)
    if kind == "x":
        return f"{theme.fr_number(value, 1)}×"
    if kind == "pct":  # yfinance donne déjà ce chiffre en pourcentage (3,41 = 3,41 %)
        return f"{theme.fr_number(value, 2)} %"
    if kind == "ratio":  # fraction : 0,137 = 13,7 %
        return f"{theme.fr_number(value * 100, 1)} %"
    return theme.fr_number(value, 2)


def price_chart(closes: pd.Series, currency: str, long_period: bool) -> alt.LayerChart:
    """Courbe du cours de clôture, avec un réticule qui suit la souris et affiche la valeur.

    Pas de surface colorée sous la courbe : elle obligerait l'axe à partir de zéro et écraserait les variations.
    """
    data = closes.rename("cours").rename_axis("date").reset_index()
    base = alt.Chart(data).encode(
        # Format de date numérique : Vega écrirait les mois en anglais (« May », « Jun »)
        x=alt.X("date:T", title=None, axis=alt.Axis(grid=False, labelAngle=0, tickCount=6, domainOpacity=0.4,
                                                    format="%m/%Y" if long_period else "%d/%m")),
        y=alt.Y("cours:Q", title=None, scale=alt.Scale(zero=False),
                axis=alt.Axis(gridOpacity=0.18, domain=False, ticks=False, tickCount=5)),
    )
    hover = alt.selection_point(fields=["date"], nearest=True, on="pointerover", empty=False, clear="pointerout")
    line = base.mark_line(color="#3987e5", strokeWidth=2, strokeJoin="round")
    rule = (
        base.mark_rule(color="#8a8780", strokeWidth=1)
        .encode(opacity=alt.condition(hover, alt.value(1), alt.value(0)),
                tooltip=[alt.Tooltip("date:T", title="Date", format="%d/%m/%Y"),
                         alt.Tooltip("cours:Q", title=f"Clôture ({currency})", format=",.2f")])
        .add_params(hover)
    )
    dot = base.mark_point(color="#3987e5", filled=True, size=60).encode(
        opacity=alt.condition(hover, alt.value(1), alt.value(0))
    )
    return (line + rule + dot).properties(height=280)


def company_sheet(symbol: str, label: str) -> None:
    """La fiche d'une entreprise : identité, cours, graphique, indicateurs clés, présentation."""
    profile = load_profile(symbol)
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
    with left:
        period = st.segmented_control("Période du graphique", list(CHART_PERIODS), default="6 mois",
                                      key=f"period_{symbol}", label_visibility="collapsed")
        history = load_history(symbol, CHART_PERIODS[period or "6 mois"])
        closes = history["Close"].dropna() if history is not None and not history.empty else pd.Series(dtype=float)
        if len(closes) < 2:
            st.caption("Historique indisponible pour le moment.")
        else:
            # dropna() : la ligne du jour peut être vide (week-end, séance pas encore ouverte)
            last, previous, first = float(closes.iloc[-1]), float(closes.iloc[-2]), float(closes.iloc[0])
            day, span = (last / previous - 1) * 100, (last / first - 1) * 100
            st.html(
                f'<div class="fv-quote-big"><b>{theme.price(last)} {esc(currency)}</b>'
                f'<span class="{theme.direction(day)}">{theme.signed(day)}</span>'
                f"<small>sur la séance · {theme.signed(span)} sur {esc(period or '6 mois')}</small></div>"
            )
            st.altair_chart(price_chart(closes, currency, period in ("1 an", "5 ans")), width="stretch")

    with right:
        rows = "".join(
            f'<dt title="{esc(help_text)}">{esc(title)}</dt>'
            f"<dd>{format_indicator(profile.get(key), kind, currency)}</dd>"
            for key, (title, kind, help_text) in INDICATORS.items()
        )
        st.html(f'<h4 class="fv-rail-title">Indicateurs clés</h4><dl class="fv-ratios">{rows}</dl>')
        low, high, current = profile.get("fiftyTwoWeekLow"), profile.get("fiftyTwoWeekHigh"), profile.get("regularMarketPrice")
        if low and high and current and high > low:
            position = min(max((current - low) / (high - low), 0), 1)
            st.html(
                f'<div class="fv-range" title="Le cours actuel se situe à {position:.0%} entre le plus bas et le plus haut sur un an">'
                f"Fourchette sur 52 semaines"
                f'<div class="fv-range-bar"><i style="left:{position:.1%}"></i></div>'
                f'<div class="fv-range-ends"><span>{theme.price(low)}</span><span>cours {theme.price(current)}</span>'
                f"<span>{theme.price(high)}</span></div></div>"
            )
        st.caption("Survole un indicateur pour voir sa définition. Données Yahoo Finance.")

    if profile.get("longBusinessSummary"):
        with st.expander("À propos de l'entreprise"):
            st.write(profile["longBusinessSummary"])


def news_list(articles, empty_message: str, key_prefix: str) -> None:
    statuses = storage.get_statuses()
    visible = [a for a in articles if not statuses.get(a.id, NO_STATUS)["is_hidden"]]
    if not visible:
        st.caption(empty_message)
    for article in visible[:20]:
        article_card(article, statuses.get(article.id, NO_STATUS), key_prefix=key_prefix)


# --- La page ----------------------------------------------------------------------------------
flush_toast()
theme.page_header("Mes suivis", "Les entreprises et les thèmes que tu suis, avec leur fil et leur fiche.")

with st.container(horizontal=True, gap="small"):
    with st.popover("Suivre une entreprise", icon=":material/add_business:"):
        query = st.text_input("Nom ou symbole", placeholder="LVMH, Airbus, Apple, MC.PA…")
        if query:
            results = search_companies(query)
            if not results:
                st.caption("Aucun résultat. Essaie le nom anglais ou le symbole boursier.")
            for result in results:
                st.button(
                    f"{result['name']} · {result['symbol']} · {result['exchange']}",
                    key=f"add_{result['symbol']}", type="tertiary",
                    on_click=follow, args=("company", result["symbol"], result["name"]),
                )
    with st.popover("Suivre un thème", icon=":material/tag:"):
        st.text_input("Mot-clé", key="new_theme", placeholder="inflation, BCE, intelligence artificielle…",
                      on_change=add_theme)
        st.caption("Appuie sur Entrée pour valider.")

follows = storage.list_follows()

if not follows:
    theme.section("Pour commencer")
    st.caption("Tu ne suis rien pour l'instant. Quelques idées :")
    with st.container(horizontal=True, gap="small"):
        for kind, value, label in SUGGESTIONS:
            st.button(label, key=f"suggest_{value}", icon=":material/add:", on_click=follow, args=(kind, value, label))
    st.stop()

keys = api_keys()
feeds, errors = load_followed(tuple((f["kind"], f["value"], f["label"]) for f in follows), keys)
companies = [f for f in follows if f["kind"] == "company"]

options = ["__all__"] + [f"{f['kind']}|{f['value']}" for f in follows]
labels = {"__all__": "Vue d'ensemble"} | {f"{f['kind']}|{f['value']}": f["label"] for f in follows}
view = st.pills("Suivis", options, format_func=labels.get, default="__all__", key="follow_view",
                label_visibility="collapsed") or "__all__"

if view == "__all__":
    if companies:
        theme.section("Mes entreprises")
        quotes = load_followed_quotes(tuple((f["value"], f["label"]) for f in companies))
        if quotes:
            st.html(f'<div class="fv-tiles">{"".join(map(theme.quote_tile, quotes))}</div>')
    combined = sorted({a.id: a for items in feeds.values() for a in items}.values(),
                      key=lambda a: a.published, reverse=True)
    theme.section("Mon fil", f"{len(combined)} dépêches")
    news_list(combined, "Aucune dépêche pour tes suivis pour le moment.", "follow_all")
else:
    kind, value = view.split("|", 1)
    label = labels[view]
    if kind == "company":
        company_sheet(value, label)
    theme.section(f"Actualités · {label}", f"{len(feeds.get((kind, value), []))} dépêches")
    news_list(feeds.get((kind, value), []), "Aucune dépêche trouvée pour le moment.", f"follow_{value}")
    st.button(f"Ne plus suivre {label}", icon=":material/remove_circle:", on_click=unfollow,
              args=(kind, value, label))

if errors:
    with st.expander(f"{len(errors)} source(s) indisponible(s)", icon=":material/warning:"):
        for error in errors:
            st.caption(error)
