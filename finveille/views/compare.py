"""Page « Comparer » : jusqu'à quatre entreprises côte à côte (performance, risque, valorisation)."""

import altair as alt
import pandas as pd
import streamlit as st

import theme
from core import metrics
from core.market import INDICATORS
from theme import esc
from ui import company_choices, current_user, load_closes, load_profile

PERIODS = {"6 mois": "6mo", "1 an": "1y", "3 ans": "3y", "5 ans": "5y"}
# Un repère de date par mois (ou tous les 2, 6 ou 12 mois) : sinon le même mois peut apparaître deux fois
TICKS = {"6 mois": ("month", 1), "1 an": ("month", 2), "3 ans": ("month", 6), "5 ans": ("year", 1)}
RATIOS = ["trailingPE", "enterpriseToEbitda", "dividendYield", "profitMargins", "returnOnEquity", "beta"]

choices = company_choices(current_user())  # mes suivis, puis le CAC 40 et les grandes valeurs connues


def comparison_chart(rebased: pd.DataFrame, names: dict[str, str], colors: dict[str, str], period: str) -> alt.LayerChart:
    """Courbes en base 100, une couleur par entreprise, réticule qui affiche toutes les valeurs à la même date."""
    long = rebased.rename(columns=names).rename_axis("date").reset_index().melt("date", var_name="entreprise", value_name="base100")
    wide = rebased.rename(columns=names).rename_axis("date").reset_index()
    color = alt.Color("entreprise:N", scale=alt.Scale(domain=list(colors), range=list(colors.values())),
                      legend=alt.Legend(title=None, orient="top"))
    interval, step = TICKS[period]
    x = alt.X("date:T", title=None, axis=alt.Axis(grid=False, labelAngle=0, format="%b %Y" if interval == "month" else "%Y",
                                                  domainOpacity=0.4, tickCount={"interval": interval, "step": step}))
    lines = alt.Chart(long).mark_line(strokeWidth=2, strokeJoin="round").encode(
        x=x, y=alt.Y("base100:Q", title=None, scale=alt.Scale(zero=False),
                     axis=alt.Axis(gridOpacity=0.18, domain=False, ticks=False)),
        color=color,
    )
    # Étiquette directe au bout de chaque courbe (en plus de la légende)
    ends = alt.Chart(long).transform_window(rank="rank()", sort=[alt.SortField("date", order="descending")],
                                            groupby=["entreprise"]).transform_filter("datum.rank == 1")
    end_dots = ends.mark_circle(size=70).encode(x=x, y="base100:Q", color=color)
    baseline = alt.Chart(pd.DataFrame({"y": [100]})).mark_rule(color=theme.NEUTRAL, strokeWidth=1).encode(y="y:Q")
    hover = alt.selection_point(fields=["date"], nearest=True, on="pointerover", empty=False, clear="pointerout")
    rule = alt.Chart(wide).mark_rule(color=theme.NEUTRAL).encode(
        x=x,
        opacity=alt.condition(hover, alt.value(1), alt.value(0)),
        tooltip=[alt.Tooltip("date:T", title="Date", format="%d/%m/%Y")]
        + [alt.Tooltip(f"{name}:Q", title=name, format=".1f") for name in colors],
    ).add_params(hover)
    return (baseline + lines + end_dots + rule).properties(height=340, background="transparent")


theme.page_header("Comparer", "Jusqu'à quatre entreprises côte à côte : performance, risque et valorisation.",
                  eyebrow="Marchés")

defaults = [s for s in ["MC.PA", "RMS.PA", "KER.PA"] if s in choices]
selected = st.multiselect("Entreprises", list(choices), default=defaults, max_selections=4,
                          format_func=lambda s: f"{choices[s]} · {s}", placeholder="Choisis 2 à 4 entreprises")
period = st.segmented_control("Période", list(PERIODS), default="1 an", label_visibility="collapsed") or "1 an"

if len(selected) < 2:
    st.info("Choisis au moins deux entreprises à comparer.")
    st.stop()

closes = load_closes(tuple(selected), PERIODS[period])
if closes is None or closes.empty or len(closes) < 5:
    st.warning("Historique indisponible pour le moment.", icon=":material/cloud_off:")
    st.stop()

selected = [s for s in selected if s in closes.columns]  # un symbole sans données est ignoré
names = {s: choices[s] for s in selected}
colors = {names[s]: theme.SERIES_COLORS[i] for i, s in enumerate(selected)}  # la couleur suit l'entreprise

theme.section("Performance", f"base 100 au début de la période · {period}")
with st.container(key="fvchart_compare"):
    chart = comparison_chart(metrics.rebase(closes[selected]), names, colors, period)
    st.altair_chart(theme.french(chart), width="stretch")
st.caption("Cours ajustés des dividendes et des divisions d'actions. Les devises ne sont pas converties : "
           "on compare des évolutions en %, pas des prix.")

theme.section("Risque et rendement")
rows = "".join(
    f'<tr><td><span class="fv-swatch" style="--c:{colors[names[s]]}"></span>{esc(names[s])}</td>'
    f"<td>{theme.change(metrics.total_return(closes[s]))}</td>"
    f"<td>{theme.change(metrics.annualized_return(closes[s]))}</td>"
    f"<td>{theme.fr_number(metrics.annualized_volatility(closes[s]), 1)} %</td>"
    f"<td>{theme.signed(metrics.max_drawdown(closes[s]))}</td></tr>"
    for s in selected
)
st.html(theme.table(
    ["Entreprise", "Rendement", "Rendement annualisé",
     '<span title="Écart-type annualisé des rendements quotidiens">Volatilité</span>',
     '<span title="Pire baisse entre un sommet et le point bas suivant">Perte maximale</span>'],
    rows,
))

left, right = st.columns([1.3, 1], gap="large")
with left:
    theme.section("Valorisation")
    profiles = {s: load_profile(s) for s in selected}

    def cell(symbol: str, key: str) -> str:
        value = profiles[symbol].get(key)
        kind = INDICATORS[key][1]
        if value is None:
            return "—"
        if kind == "pct":
            return f"{theme.fr_number(value, 2)} %"
        if kind == "ratio":
            return f"{theme.fr_number(value * 100, 1)} %"
        return theme.fr_number(value, 1) + ("×" if kind == "x" else "")

    body = "".join(
        f'<tr><td title="{esc(INDICATORS[key][2])}">{esc(INDICATORS[key][0])}</td>'
        + "".join(f"<td>{cell(s, key)}</td>" for s in selected) + "</tr>"
        for key in RATIOS
    )
    st.html(theme.table(["Indicateur", *(esc(names[s]) for s in selected)], body))
with right:
    theme.section("Corrélation", "rendements quotidiens")
    corr = metrics.correlation(closes[selected])
    body = "".join(
        f"<tr><td>{esc(names[a])}</td>" + "".join(f"<td>{theme.fr_number(corr.loc[a, b], 2)}</td>" for b in selected) + "</tr>"
        for a in selected
    )
    st.html(theme.table(["", *(esc(names[s]) for s in selected)], body))
    st.caption("Proche de 1 : les deux actions montent et baissent ensemble. Proche de 0 : elles évoluent "
               "indépendamment, ce qui diversifie un portefeuille.")
