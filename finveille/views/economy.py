"""Page « Économie » : inflation, taux directeurs, chômage, taux d'intérêt et croissance (BCE et Fed)."""

from datetime import date

import altair as alt
import pandas as pd
import streamlit as st

import theme
from core import macro
from core.macro import EA, FR, US
from theme import esc
from ui import end_page, hero_quotes, load_macro, load_yield_curves

START = f"{date.today().year - 10}-01-01"  # dix ans d'historique
ZONES = [EA, FR, US]
ZONE_COLORS = {EA: theme.SERIES_COLORS[0], FR: theme.SERIES_COLORS[2], US: theme.SERIES_COLORS[1]}  # une couleur fixe par zone
ROWS = [  # (titre de la ligne, {zone: clé de l'indicateur})
    ("Inflation", {EA: "infl_ea", FR: "infl_fr", US: "infl_us"}),
    ("Inflation sous-jacente", {EA: "core_ea", US: "core_us"}),
    ("Taux directeur", {EA: "rate_ecb", US: "rate_fed"}),
    ("Taux à 10 ans", {EA: "bond_ea", FR: "bond_fr", US: "bond_us"}),
    ("Chômage", {EA: "unemp_ea", FR: "unemp_fr", US: "unemp_us"}),
    ("Croissance du PIB", {EA: "gdp_ea", US: "gdp_us"}),
]

theme.page_header(
    "L'économie,",
    "Inflation, taux directeurs, chômage et taux d'intérêt en zone euro, en France et aux États-Unis : les "
    "statistiques officielles de la BCE et de la Réserve fédérale, mises à jour chaque jour.",
    eyebrow="Économie", accent="en chiffres officiels.", quotes=hero_quotes("EURUSD=X", "BZ=F", "GC=F"),
)

data, errors = load_macro(START)
if not data:
    st.warning("Les statistiques ne sont pas disponibles pour le moment (BCE et FRED ne répondent pas). Réessaie "
               "dans quelques minutes.", icon=":material/cloud_off:")
    end_page()


def cell(key: str) -> str:
    """Une case du tableau : dernière valeur, mini-courbe sur trois ans, évolution sur un an et date."""
    series = data.get(key)
    if series is None:
        return '<span class="fv-move">—</span>'
    info, freq = macro.latest(series), macro.frequency(series)
    recent = series[series.index >= series.index[-1] - pd.DateOffset(years=3)]
    change = theme.move(info["change_year"]) + " sur un an · " if info["change_year"] is not None else ""
    return (
        f'<span class="fv-mcell" title="{esc(macro.BY_KEY[key].help)}"><b>{theme.fr_number(info["value"], 2)} %</b>'
        f'<img src="{theme.sparkline_uri(recent.tolist(), "fv-flat", 64, 24)}" alt="">'
        f"<small>{change}{theme.period_label(info['date'], freq)}</small></span>"
    )


# --- Le tableau de bord ---------------------------------------------------------------------------
theme.section("Tableau de bord", "dernière valeur publiée, évolution sur un an")
rows = "".join(
    f"<tr><td>{esc(title)}<small>{esc(macro.BY_KEY[next(iter(keys.values()))].help)}</small></td>"
    + "".join(f"<td>{cell(keys[zone]) if zone in keys else '<span class=fv-move>—</span>'}</td>" for zone in ZONES)
    + "</tr>"
    for title, keys in ROWS
)
st.html(theme.table(["Indicateur", *ZONES], rows).replace('class="fv-table"', 'class="fv-table fv-macro"'))


def line_chart(series: dict[str, pd.Series], height: int = 260, step: bool = False, target: float | None = None):
    """Une courbe par zone, avec un réticule qui affiche toutes les valeurs à la même date."""
    frame = pd.concat(series, axis=1).sort_index()
    long = frame.rename_axis("date").reset_index().melt("date", var_name="zone", value_name="valeur").dropna()
    color = alt.Color("zone:N", scale=alt.Scale(domain=list(series), range=[ZONE_COLORS[z] for z in series]),
                      legend=alt.Legend(title=None, orient="top"))
    x = alt.X("date:T", title=None, axis=alt.Axis(format="%Y", grid=False, labelAngle=0, domainOpacity=0.4,
                                                  tickCount={"interval": "year", "step": 2}))
    y = alt.Y("valeur:Q", title=None, axis=alt.Axis(format=".1f", gridOpacity=0.18, domain=False, ticks=False))
    lines = alt.Chart(long).mark_line(strokeWidth=2, interpolate="step-after" if step else "linear").encode(
        x=x, y=y, color=color)
    hover = alt.selection_point(fields=["date"], nearest=True, on="pointerover", empty=False, clear="pointerout")
    wide = frame.ffill().rename_axis("date").reset_index()
    rule = alt.Chart(wide).mark_rule(color=theme.NEUTRAL).encode(
        x="date:T", opacity=alt.condition(hover, alt.value(1), alt.value(0)),
        tooltip=[alt.Tooltip("date:T", title="Date", format="%m/%Y")]
        + [alt.Tooltip(f"{zone}:Q", title=zone, format=".2f") for zone in series],
    ).add_params(hover)
    ends = long.sort_values("date").groupby("zone").tail(1)
    span = float(long["valeur"].max() - long["valeur"].min()) or 1.0
    labels = theme.end_labels(ends, x, "valeur", "zone", color, lambda v: f"{theme.fr_number(v, 1)} %", span)
    layers = [lines, labels, rule, theme.hover_points(long, x, y, color, hover)]
    if target is not None:
        goal = pd.DataFrame({"y": [target], "label": [f"objectif {theme.fr_number(target, 0)} %"]})
        layers.insert(0, alt.Chart(goal).mark_rule(color=theme.NEUTRAL, strokeDash=[4, 4]).encode(y="y:Q"))
        layers.insert(1, alt.Chart(goal).mark_text(align="left", dx=4, dy=-7, color=theme.chart_ink(), fontSize=11)
                      .encode(y="y:Q", text="label:N", x=alt.value(0)))
    return alt.layer(*layers).properties(height=height, background="transparent",
                                         padding={"left": 5, "top": 5, "bottom": 5, "right": 150})


def pick(*keys: str) -> dict[str, pd.Series]:
    """Les séries disponibles, nommées par leur zone."""
    return {macro.BY_KEY[k].zone: data[k] for k in keys if k in data}


# --- Inflation ----------------------------------------------------------------------------------
theme.section("Inflation", "hausse des prix sur un an, en %")
if inflation := pick("infl_ea", "infl_fr", "infl_us"):
    with st.container(key="fvchart_inflation"):
        st.altair_chart(theme.french(line_chart(inflation, target=2)), width="stretch")
    st.caption("La BCE et la Fed visent toutes deux une inflation de 2 % par an à moyen terme. Au-dessus, elles "
               "ont tendance à monter leurs taux ; en dessous, à les baisser.")

# --- Politique monétaire -------------------------------------------------------------------------
theme.section("Politique monétaire", "taux directeurs et taux réels")
left, right = st.columns([1.6, 1], gap="large")
with left:
    if rates := pick("rate_ecb", "rate_fed"):
        # Le taux de la BCE n'a une valeur qu'aux dates de décision : on prolonge le dernier palier jusqu'à aujourd'hui
        rates = {zone: macro.extend_to(series, pd.Timestamp(date.today())) for zone, series in rates.items()}
        with st.container(key="fvchart_rates"):
            st.altair_chart(theme.french(line_chart(rates, step=True)), width="stretch")


def verdict(real: float) -> str:
    if real < -0.5:
        return "accommodante : elle soutient l'activité"
    if real > 0.5:
        return "restrictive : elle freine l'économie pour calmer les prix"
    return "plutôt neutre"


with right:
    blocks = []
    for name, rate_key, inflation_key in [("BCE", "rate_ecb", "infl_ea"), ("Fed", "rate_fed", "infl_us")]:
        if rate_key in data and inflation_key in data:
            rate, inflation = data[rate_key].iloc[-1], data[inflation_key].iloc[-1]
            real = macro.real_rate(rate, inflation)
            blocks.append(
                f'<div class="fv-kpi"><div class="fv-kpi-label">Taux réel · {name}</div>'
                f'<div class="fv-kpi-value">{theme.signed(real, "%")}</div>'
                f'<div class="fv-kpi-sub">taux directeur {theme.fr_number(rate, 2)} % − inflation '
                f'{theme.fr_number(inflation, 1)} %</div><span class="fv-verdict">Politique {verdict(real)}</span></div>'
            )
    if blocks:
        st.html(f'<div class="fv-kpis" style="grid-template-columns:1fr">{"".join(blocks)}</div>')
        st.caption("Taux réel = ce que rapporte vraiment l'argent placé au taux directeur, une fois l'inflation "
                   "déduite (relation de Fisher).")

# --- Courbes des taux ------------------------------------------------------------------------------
curves = load_yield_curves(f"{date.today().year - 2}-01-01")
if curves:
    theme.section("Courbes des taux", "rendement des emprunts d'État selon leur durée")
    columns = st.columns(2, gap="large")
    labels = [label for label, *_ in macro.MATURITIES]
    for column, (zone, table) in zip(columns, curves.items()):
        if table.empty:
            continue
        today = macro.curve_on(table, table.index[-1])
        year_ago = macro.curve_on(table, table.index[-1] - pd.DateOffset(years=1))
        shape, spread = macro.curve_shape(today)
        frame = pd.DataFrame({"maturité": today.index, "Aujourd'hui": today.values}).merge(
            pd.DataFrame({"maturité": year_ago.index, "Il y a un an": year_ago.values}), on="maturité")
        long = frame.melt("maturité", var_name="date", value_name="taux")
        chart = (
            alt.Chart(long).mark_line(point=True, strokeWidth=2)
            .encode(
                x=alt.X("maturité:N", sort=labels, title=None, axis=alt.Axis(labelAngle=0, domainOpacity=0.4)),
                y=alt.Y("taux:Q", title=None, scale=alt.Scale(zero=False),
                        axis=alt.Axis(format=".1f", gridOpacity=0.18, domain=False, ticks=False)),
                color=alt.Color("date:N", scale=alt.Scale(domain=["Aujourd'hui", "Il y a un an"],
                                                          range=[ZONE_COLORS[zone], theme.REFERENCE]),
                                legend=alt.Legend(title=None, orient="top", symbolType="stroke", symbolStrokeWidth=3,
                                                  symbolSize=260)),
                strokeDash=alt.StrokeDash("date:N", scale=alt.Scale(domain=["Aujourd'hui", "Il y a un an"],
                                                                     range=[[1, 0], [4, 3]]), legend=None),
                tooltip=[alt.Tooltip("maturité:N", title="Durée"), alt.Tooltip("date:N", title="Courbe"),
                         alt.Tooltip("taux:Q", title="Taux (%)", format=".2f")],
            )
            .properties(height=220, background="transparent")
        )
        with column, st.container(key=f"fvchart_curve_{'us' if zone == US else 'ea'}"):
            st.html(f'<div class="fv-chart-title"><b>{esc(zone)}</b><small>{"États AAA" if zone == EA else "Trésor"}'
                    f" · {theme.period_label(table.index[-1], 'jour')}</small></div>")
            st.altair_chart(theme.french(chart), width="stretch")
            st.html(f'<p class="fv-note">Courbe <b>{shape}</b> : écart 10 ans − 2 ans de {theme.signed(spread, "pt")}. '
                    + ("Les taux courts dépassent les taux longs : historiquement, un signal avancé de récession."
                       if shape == "inversée" else
                       "Prêter longtemps rapporte plus que prêter court : c'est la situation habituelle."
                       if shape == "normale" else "Prêter court ou long rapporte à peu près autant.") + "</p>")

# --- Emploi et croissance --------------------------------------------------------------------------
left, right = st.columns(2, gap="large")
with left:
    theme.section("Chômage", "en % de la population active")
    if unemployment := pick("unemp_ea", "unemp_fr", "unemp_us"):
        with st.container(key="fvchart_unemployment"):
            st.altair_chart(theme.french(line_chart(unemployment, height=220)), width="stretch")
with right:
    theme.section("Croissance du PIB", "sur un an, en volume")
    if growth := pick("gdp_ea", "gdp_us"):
        with st.container(key="fvchart_growth"):
            st.altair_chart(theme.french(line_chart(growth, height=220, step=True)), width="stretch")

# --- Données et sources -------------------------------------------------------------------------
with st.expander("Voir les données en tableau", icon=":material/table:"):
    table = pd.concat({f"{macro.BY_KEY[k].label} · {macro.BY_KEY[k].zone}": s for k, s in data.items()}, axis=1)
    st.dataframe(table.sort_index(ascending=False), column_config={"_index": st.column_config.DateColumn("Date")})
if errors:
    st.caption("Indisponible pour le moment : " + " ; ".join(errors))
st.caption("Sources : Banque centrale européenne (data.ecb.europa.eu) et Réserve fédérale de Saint-Louis "
           "(fred.stlouisfed.org). Inflation : IPCH d'Eurostat (Europe), CPI (États-Unis).")
