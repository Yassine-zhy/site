"""Page « Portefeuille » : un portefeuille virtuel pour s'entraîner (aucun argent réel)."""

from datetime import date, timedelta

import altair as alt
import pandas as pd
import streamlit as st

import theme
from core import company, metrics, portfolio, storage
from sheet import display_name
from theme import esc
from ui import (company_choices, end_page, flush_toast, load_closes, load_euro_rates, load_profile,
                load_symbol_quotes, require_user)

PERIODS = {"1 mois": "1mo", "6 mois": "6mo", "1 an": "1y"}
EXAMPLE = [("MC.PA", "LVMH", 10), ("TTE.PA", "TotalEnergies", 40), ("AIR.PA", "Airbus", 15), ("AAPL", "Apple", 8)]


def add_position(user: str, symbol: str, label: str, quantity: float, price: float, bought_on: date) -> None:
    currency = load_profile(symbol).get("currency", "EUR")
    storage.add_position(user, symbol, label, quantity, price, currency, bought_on.isoformat())
    st.session_state["fv_toast"] = f"{label} ajouté au portefeuille"


def load_example(user: str) -> None:
    """Un portefeuille d'exemple acheté il y a 6 mois, au vrai cours de l'époque."""
    start = date.today() - timedelta(days=182)
    closes = load_closes(tuple(s for s, _, _ in EXAMPLE), "1y")
    if closes is None or closes.empty:
        st.session_state["fv_toast"] = "Exemple indisponible : les cours ne répondent pas"
        return
    for symbol, label, quantity in EXAMPLE:
        if symbol in closes:
            price = float(closes[symbol].asof(pd.Timestamp(start)))
            add_position(user, symbol, label, quantity, round(price, 2), start)


def logo(symbol: str) -> str:
    """Logo de l'entreprise à partir de son site web (fiche Yahoo), ou chaîne vide."""
    website = load_profile(symbol).get("website")
    return theme.favicon_url(website) if website else ""


def performance_chart(data: pd.DataFrame, period: str) -> alt.LayerChart:
    """Deux courbes en base 100 : le portefeuille (en couleur) et le CAC 40 (en gris, pour comparaison)."""
    long = data.rename_axis("date").reset_index().melt("date", var_name="série", value_name="base100")
    colors = alt.Scale(domain=["Mon portefeuille", "CAC 40"], range=[theme.SERIES_COLORS[0], theme.REFERENCE])
    ticks = {"interval": "week", "step": 1} if period == "1 mois" else {"interval": "month", "step": 1}
    x = alt.X("date:T", title=None, axis=alt.Axis(grid=False, labelAngle=0, domainOpacity=0.4, tickCount=ticks,
                                                  format="%d %b" if period == "1 mois" else "%b %Y"))
    color = alt.Color("série:N", scale=colors, legend=alt.Legend(title=None, orient="top"))
    lines = alt.Chart(long).mark_line(strokeWidth=2, strokeJoin="round").encode(
        x=x, y=alt.Y("base100:Q", title=None, scale=alt.Scale(zero=False),
                     axis=alt.Axis(gridOpacity=0.18, domain=False, ticks=False)),
        color=color,
    )
    ends = long.dropna().sort_values("date").groupby("série").tail(1)
    span = float(long["base100"].max() - long["base100"].min()) or 1.0
    labels = theme.end_labels(ends, x, "base100", "série", color, lambda v: theme.fr_number(v, 0), span)
    hover = alt.selection_point(fields=["date"], nearest=True, on="pointerover", empty=False, clear="pointerout")
    rule = alt.Chart(data.rename_axis("date").reset_index()).mark_rule(color=theme.NEUTRAL).encode(
        x=x, opacity=alt.condition(hover, alt.value(1), alt.value(0)),
        tooltip=[alt.Tooltip("date:T", title="Date", format="%d/%m/%Y"),
                 alt.Tooltip("Mon portefeuille:Q", format=".1f"), alt.Tooltip("CAC 40:Q", format=".1f")],
    ).add_params(hover)
    baseline = alt.Chart(pd.DataFrame({"y": [100]})).mark_rule(color=theme.NEUTRAL, strokeWidth=1).encode(y="y:Q")
    points = theme.hover_points(long, x, "base100:Q", color, hover)
    return (baseline + lines + labels + rule + points).properties(
        height=300, background="transparent", padding={"left": 5, "top": 5, "bottom": 5, "right": 190})


flush_toast()
theme.page_header("Ton portefeuille,", "Un portefeuille virtuel pour t'entraîner : aucun argent réel, aucune transaction.",
                  eyebrow="Mon espace", accent="sans risquer un euro.", art="portfolio")
user = require_user()
choices = company_choices(user)

positions = storage.list_positions(user)

# Arrivée depuis une fiche (portfolio?s=MC.PA) : le formulaire s'ouvre avec la valeur déjà choisie, même si la liste
# ne la connaît pas. Le formulaire ne s'ouvre qu'une fois par valeur, pour ne pas se rouvrir à chaque action.
wanted = company.normalize_symbol(st.query_params.get("s"))
options, chosen = company.with_symbol(list(choices), wanted)
if wanted and wanted not in choices:
    choices[wanted] = display_name(wanted)
if wanted and st.session_state.get("fv_position_for") != wanted:
    st.session_state["fv_position_for"] = wanted
    st.session_state["fv_position_popover"] = True

with st.container(horizontal=True, gap="small"):
    with st.popover("Ajouter une position", icon=":material/add_chart:", key="fv_position_popover", on_change="rerun"):
        with st.form("new_position", clear_on_submit=True, border=False):
            symbol = st.selectbox("Entreprise", options, format_func=lambda s: f"{choices.get(s, s)} · {s}",
                                  index=chosen, placeholder="Choisis ou tape un symbole (ex. MC.PA)",
                                  accept_new_options=True)
            quantity = st.number_input("Quantité", min_value=0.0, value=10.0, step=1.0)
            price = st.number_input("Prix d'achat unitaire (devise de cotation)", min_value=0.0, value=0.0,
                                    step=1.0, help="Laisse 0 pour utiliser le dernier cours connu.")
            bought_on = st.date_input("Date d'achat", value=date.today(), max_value=date.today(), format="DD/MM/YYYY")
            if st.form_submit_button("Ajouter", type="primary"):
                if not symbol or quantity <= 0:
                    st.error("Choisis une entreprise et une quantité positive.")
                else:
                    symbol = symbol.strip().upper()
                    if price <= 0:
                        quote = load_symbol_quotes((symbol,)).get(symbol)
                        price = quote.last if quote else 0.0
                    if price <= 0:
                        st.error(f"Aucun cours trouvé pour « {symbol} ». Vérifie le symbole sur finance.yahoo.com.")
                    else:
                        add_position(user, symbol, choices.get(symbol, symbol), quantity, price, bought_on)
                        st.rerun()
    if positions:
        with st.popover("Retirer une position", icon=":material/remove_circle:"):
            to_remove = st.selectbox("Position", positions, format_func=lambda p: f"{p['label']} · {p['quantity']:g} "
                                     f"titres achetés le {date.fromisoformat(p['bought_on']):%d/%m/%Y}")
            if st.button("Retirer", type="primary"):
                storage.delete_position(user, to_remove["id"])
                st.rerun()

if not positions:
    theme.section("Pour commencer")
    st.caption("Ton portefeuille est vide. Ajoute une position, ou charge un exemple : 4 actions achetées il y a "
               "six mois, au cours de l'époque.")
    st.button("Charger un portefeuille d'exemple", icon=":material/science:", on_click=load_example, args=(user,))
    end_page()

symbols = tuple(sorted({p["symbol"] for p in positions}))
quotes = load_symbol_quotes(symbols)
rates = load_euro_rates() or {"EUR": 1.0}
lines = portfolio.valuate(positions, {s: q.last for s, q in quotes.items()}, rates)
if not lines:
    st.warning("Les cours ne sont pas disponibles pour le moment.", icon=":material/cloud_off:")
    end_page()
total = portfolio.totals(lines)
best = max(lines, key=lambda line: line.gain_pct)

theme.section("Vue d'ensemble", "valeurs en euros")
st.html(
    f'<div class="fv-kpis">'
    f'<div class="fv-kpi"><div class="fv-kpi-label">Valeur du portefeuille</div>'
    f'<div class="fv-kpi-value">{theme.fr_number(total["value"], 0)} €</div>'
    f'<div class="fv-kpi-sub">investi : {theme.fr_number(total["cost"], 0)} €</div></div>'
    f'<div class="fv-kpi"><div class="fv-kpi-label">Plus-value latente</div>'
    f'<div class="fv-kpi-value"><span class="{theme.direction(total["gain"])}">{theme.signed(total["gain"], "€", 0)}</span></div>'
    f'<div class="fv-kpi-sub">{theme.change(total["gain_pct"])} depuis l\'achat</div></div>'
    f'<div class="fv-kpi"><div class="fv-kpi-label">Meilleure ligne</div><div class="fv-kpi-value">{esc(best.position["label"])}</div>'
    f'<div class="fv-kpi-sub">{theme.change(best.gain_pct)}</div></div>'
    f'<div class="fv-kpi"><div class="fv-kpi-label">Lignes</div><div class="fv-kpi-value">{len(lines)}</div>'
    f'<div class="fv-kpi-sub">{len({line.position["currency"] for line in lines})} devise(s)</div></div></div>'
)

theme.section("Mes positions")
rows = "".join(
    f"<tr><td>{esc(line.position['label'])} <small>{esc(line.position['symbol'])}</small></td>"
    f"<td>{theme.fr_number(line.position['quantity'], 0)}</td>"
    f"<td>{theme.price(line.position['price'])} {esc(line.position['currency'])}</td>"
    f"<td>{theme.price(line.last)} {esc(line.position['currency'])}</td>"
    f"<td>{theme.fr_number(line.value, 0)} €</td>"
    f"<td>{theme.change(line.gain, '€', 0)}</td>"
    f"<td>{theme.change(line.gain_pct)}</td><td>{theme.fr_number(line.weight, 1)} %</td></tr>"
    for line in sorted(lines, key=lambda line: line.value, reverse=True)
)
st.html(theme.table(["Entreprise", "Quantité", "Prix de revient", "Cours", "Valeur", "+/− value", "+/− %", "Poids"],
                    rows))
st.caption("Prix de revient converti en euros au taux de change actuel (simplification). Poids = part de la valeur "
           "totale.")

theme.section("Répartition")
bars = "".join(
    f'<li title="{esc(line.position["label"])} : {theme.fr_number(line.weight, 1)} %">'
    f'<img src="{logo(line.position["symbol"])}" alt="">'
    f'<span>{esc(line.position["label"])}</span><span class="fv-track"><i style="width:{line.weight:.1f}%"></i></span>'
    f'<span class="fv-num">{theme.fr_number(line.weight, 0)} %</span></li>'
    for line in sorted(lines, key=lambda line: line.weight, reverse=True)
)
st.html(theme.card(f'<ul class="fv-list">{bars}</ul>'))

theme.section("Performance de la composition actuelle", "comparée au CAC 40")
period = st.segmented_control("Période", list(PERIODS), default="6 mois", label_visibility="collapsed") or "6 mois"
closes = load_closes(symbols + ("^FCHI",), PERIODS[period])
if closes is None or closes.empty or "^FCHI" not in closes:
    st.caption("Historique indisponible pour le moment.")
else:
    value = portfolio.composition_history(positions, closes, rates)
    data = pd.DataFrame({"Mon portefeuille": metrics.rebase(value), "CAC 40": metrics.rebase(closes["^FCHI"])})
    with st.container(key="fvchart_portfolio"):
        st.altair_chart(theme.french(performance_chart(data, period)), width="stretch")
    rows = "".join(
        f"<tr><td>{name}</td><td>{theme.change(metrics.total_return(series))}</td>"
        f"<td>{theme.fr_number(metrics.annualized_volatility(series), 1)} %</td>"
        f"<td>{theme.signed(metrics.max_drawdown(series))}</td></tr>"
        for name, series in [("Mon portefeuille", value), ("CAC 40", closes["^FCHI"])]
    )
    st.html(theme.table(["", "Rendement", "Volatilité annualisée", "Perte maximale"], rows))
    st.caption("On simule la détention des quantités actuelles sur toute la période (cours ajustés, taux de change "
               "actuels) : c'est la performance de ta composition, pas de tes décisions d'achat.")
