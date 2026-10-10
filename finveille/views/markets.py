"""Page « Marchés » : tableau de bord des indices, devises, taux, matières premières et crypto."""

import pandas as pd
import streamlit as st

import theme
from theme import esc
from ui import load_quotes

PERIODS = {"1 séance": 1, "5 séances": 5, "1 mois": 21, "3 mois": 63}
# Variation qui donne la couleur la plus intense dans la carte des performances, selon la période
HEAT_SCALE = {1: 2.0, 5: 4.0, 21: 8.0, 63: 15.0}


def tiles_by_group(quotes, groups) -> str:
    blocks = []
    for group in groups:
        members = [q for q in quotes if q.group == group]
        if members:
            blocks.append(f'<div class="fv-group">{esc(group)}</div><div class="fv-tiles">{"".join(map(theme.quote_tile, members))}</div>')
    return "".join(blocks)


def heatmap(quotes, sessions: int) -> str:
    """Carte des performances : l'intensité de la teinte suit l'ampleur de la variation, la teinte son signe."""
    scale = HEAT_SCALE[sessions]
    rows = []
    for group in dict.fromkeys(q.group for q in quotes):  # groupes dans l'ordre d'apparition, sans doublon
        cells = []
        for q in (q for q in quotes if q.group == group):
            change = q.change_over(sessions)
            if q.unit == "pb":  # un taux qui monte n'est ni « bon » ni « mauvais » : teinte neutre
                color, alpha = "#8a8780", 14
            else:
                color = theme.UP if change >= 0 else theme.DOWN
                alpha = 6 + min(abs(change) / scale, 1) * 56  # de 6 % à 62 % d'opacité
            cells.append(
                f'<div class="fv-cell" style="--c:{color};--a:{alpha:.0f}%" '
                f'title="{esc(q.name)} : {theme.signed(change, q.unit)}">'
                f'<b>{esc(q.name)}</b><span class="{theme.direction(change)}">{theme.signed(change, q.unit)}</span></div>'
            )
        rows.append(f'<div class="fv-heat-label">{esc(group)}</div><div class="fv-heat-row">{"".join(cells)}</div>')
    legend = (
        f'<div class="fv-heat-legend"><span>▼ −{theme.fr_number(scale, 0)} % ou moins</span><i></i>'
        f'<span>▲ +{theme.fr_number(scale, 0)} % ou plus</span><span>· taux en points de base, teinte neutre</span></div>'
    )
    return f'<div class="fv-heat">{"".join(rows)}</div>{legend}'


theme.page_header(
    "Marchés",
    "Indices, devises, taux, matières premières et crypto : dernier cours connu (Yahoo Finance, différé).",
)

quotes = load_quotes()
if not quotes:
    st.warning("Les cours ne sont pas disponibles pour le moment (Yahoo Finance ne répond pas). Réessaie dans "
               "quelques minutes.", icon=":material/cloud_off:")
    st.stop()

theme.section("Indices boursiers", f"séance du {theme.fr_day(quotes[0].history.index[-1])}")
st.html(tiles_by_group(quotes, ["Europe", "Amériques", "Asie"]))

theme.section("Devises, taux, matières premières, crypto")
st.html(tiles_by_group(quotes, ["Devises", "Taux et volatilité", "Matières premières", "Crypto"]))

theme.section("Carte des performances")
period = st.segmented_control("Période", list(PERIODS), default="1 séance", label_visibility="collapsed")
sessions = PERIODS[period or "1 séance"]
st.html(heatmap(quotes, sessions))

with st.expander("Voir les données en tableau", icon=":material/table:"):
    table = pd.DataFrame(
        {
            "Instrument": q.name,
            "Groupe": q.group,
            "Dernier cours": q.last,
            "Séance": q.change,
            "5 séances": q.change_over(5),
            "1 mois": q.change_over(21),
            "3 mois": q.change_over(63),
            "Unité": q.unit,
        }
        for q in quotes
    )
    st.dataframe(
        table,
        hide_index=True,
        column_config={
            col: st.column_config.NumberColumn(format="%.2f") for col in ["Dernier cours", "Séance", "5 séances", "1 mois", "3 mois"]
        },
    )
st.caption("Variations en % (en points de base pour le taux à 10 ans). Données fournies à titre informatif.")
