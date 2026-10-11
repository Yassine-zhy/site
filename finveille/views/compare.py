"""Page « Comparer » : jusqu'à quatre entreprises côte à côte (performance, risque, valorisation)."""

import altair as alt
import pandas as pd
import streamlit as st

import theme
from core import metrics
from core.market import INDICATORS
from theme import esc
from ui import company_choices, current_user, end_page, load_closes, load_profile

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
                  eyebrow="Marchés", accent="pour mieux choisir.")

# Par défaut, quatre secteurs différents (luxe, énergie, aéronautique, santé) : la diversification se voit mieux
defaults = [s for s in ["MC.PA", "TTE.PA", "AIR.PA", "SAN.PA"] if s in choices]
selected = st.multiselect("Entreprises", list(choices), default=defaults, max_selections=4,
                          format_func=lambda s: f"{choices[s]} · {s}", placeholder="Choisis 2 à 4 entreprises")
period = st.segmented_control("Période", list(PERIODS), default="1 an", label_visibility="collapsed") or "1 an"

if len(selected) < 2:
    st.info("Choisis au moins deux entreprises à comparer.")
    end_page()

closes = load_closes(tuple(selected), PERIODS[period])
if closes is None or closes.empty or len(closes) < 5:
    st.warning("Historique indisponible pour le moment.", icon=":material/cloud_off:")
    end_page()

selected = [s for s in selected if s in closes.columns]  # un symbole sans données est ignoré
if len(selected) < 2:
    st.warning("Pas assez d'historiques disponibles pour comparer : choisis d'autres entreprises.",
               icon=":material/cloud_off:")
    end_page()
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

# --- Optimiser la répartition : la frontière efficiente de Markowitz ---------------------------------
theme.section("Optimiser la répartition", "frontière efficiente de Markowitz")
risk_free = st.number_input(
    "Taux sans risque (%)", min_value=0.0, max_value=10.0, value=2.0, step=0.25, format="%.2f",
    help="Ce que rapporte un placement sans risque (taux de dépôt de la BCE, voir la page Économie). "
         "Il sert au ratio de Sharpe.",
)
portfolios = metrics.random_portfolios(closes[selected], risk_free=risk_free)
best = metrics.optimal_portfolios(portfolios)
frontier = metrics.efficient_frontier(portfolios)
assets = pd.DataFrame([{"nom": names[s], "volatilité": metrics.annualized_volatility(closes[s]),
                        "rendement": closes[s].pct_change().mean() * metrics.TRADING_DAYS * 100} for s in selected])
special = pd.DataFrame([{"portefeuille": label, "volatilité": row["volatilité"], "rendement": row["rendement"],
                         "sharpe": row["sharpe"]} for label, row in best.items()])

x = alt.X("volatilité:Q", title="Risque : volatilité annualisée (%)", scale=alt.Scale(zero=False),
          axis=alt.Axis(gridOpacity=0.18, domainOpacity=0.4))
y = alt.Y("rendement:Q", title="Rendement annuel moyen (%)", scale=alt.Scale(zero=False),
          axis=alt.Axis(gridOpacity=0.18, domain=False))
cloud = alt.Chart(portfolios).mark_circle(size=12, opacity=0.35, color=theme.NEUTRAL).encode(
    x=x, y=y, tooltip=[alt.Tooltip("rendement:Q", format=".1f"), alt.Tooltip("volatilité:Q", format=".1f"),
                       alt.Tooltip("sharpe:Q", title="Sharpe", format=".2f")]
    + [alt.Tooltip(f"{s}:Q", title=names[s], format=".0%") for s in selected],
)
line = alt.Chart(frontier).mark_line(strokeWidth=2.5, color="#3987e5").encode(x=x, y=y)
points = alt.Chart(assets).mark_circle(size=110, opacity=1).encode(
    x=x, y=y, color=alt.Color("nom:N", scale=alt.Scale(domain=list(colors), range=list(colors.values())),
                              legend=alt.Legend(title=None, orient="top")),
    tooltip=[alt.Tooltip("nom:N", title="Entreprise"), alt.Tooltip("rendement:Q", format=".1f"),
             alt.Tooltip("volatilité:Q", format=".1f")],
)
labels = alt.Chart(assets).mark_text(align="left", dx=8, dy=-6, fontSize=11, color=theme.NEUTRAL).encode(
    x=x, y=y, text="nom:N")
stars = alt.Chart(special).mark_point(size=260, filled=True, strokeWidth=1.5, stroke="white").encode(
    x=x, y=y,
    shape=alt.Shape("portefeuille:N", scale=alt.Scale(domain=list(best), range=["diamond", "triangle-up"]),
                    legend=alt.Legend(title=None, orient="top", symbolSize=180, symbolFillColor="#c98500")),
    color=alt.value("#c98500"),
    tooltip=[alt.Tooltip("portefeuille:N", title="Portefeuille"), alt.Tooltip("rendement:Q", format=".1f"),
             alt.Tooltip("volatilité:Q", format=".1f"), alt.Tooltip("sharpe:Q", title="Sharpe", format=".2f")],
)
with st.container(key="fvchart_frontier"):
    chart = (cloud + line + points + labels + stars).resolve_legend(color="independent", shape="independent")
    st.altair_chart(theme.french(chart.properties(height=380, background="transparent")), width="stretch")

rows = "".join(
    f"<tr><td>{esc(label)}</td>" + "".join(f"<td>{theme.fr_number(row[s] * 100, 0)} %</td>" for s in selected)
    + f"<td>{theme.change(row['rendement'])}</td><td>{theme.fr_number(row['volatilité'], 1)} %</td>"
    f"<td>{theme.fr_number(row['sharpe'], 2)}</td></tr>"
    for label, row in best.items()
)
st.html(theme.table(["Portefeuille", *(esc(names[s]) for s in selected), "Rendement", "Volatilité", "Sharpe"], rows))
if best["Sharpe maximal"]["sharpe"] < 0:
    st.info("Sur cette période, aucune répartition ne rapporte plus que le taux sans risque : le ratio de Sharpe est "
            "négatif partout. Le « meilleur » portefeuille est seulement le moins mauvais. Essaie une autre période ou "
            "d'autres entreprises.", icon=":material/info:")
st.caption(
    f"Chaque point gris est une répartition tirée au hasard ({theme.fr_number(len(portfolios), 0)} au total) entre "
    "ces entreprises. La ligne bleue, la frontière efficiente, rassemble les meilleures : pour un risque donné, aucune "
    "autre ne "
    "rapporte plus. Le losange est le portefeuille le moins risqué, le triangle celui qui rémunère le mieux chaque "
    "unité de risque (ratio de Sharpe). Rendements calculés sur le passé : ils ne prédisent pas l'avenir, et la "
    "méthode suppose qu'ils se répéteront. Exercice pédagogique, pas un conseil d'investissement."
)
