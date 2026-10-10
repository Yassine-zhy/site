"""Page « Marchés » : le monde, le CAC 40 valeur par valeur, et un convertisseur de devises."""

import pandas as pd
import streamlit as st

import theme
from core.market import CURRENCIES, convert
from theme import esc
from ui import load_cac40, load_euro_rates, load_quotes

PERIODS = {"1 séance": 1, "5 séances": 5, "1 mois": 21, "3 mois": 63}
# Variation qui donne la couleur la plus intense dans les cartes de performances, selon la période
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
                color, alpha = theme.NEUTRAL, 22
            else:
                color = theme.UP if change >= 0 else theme.DOWN
                alpha = 4 + min(abs(change) / scale, 1) * 56  # de 4 % à 60 % de couleur
            cells.append(
                f'<div class="fv-cell" style="--c:{color};--a:{alpha:.0f}%" '
                f'title="{esc(q.name)} : {theme.signed(change, q.unit)}">'
                f'<b>{esc(q.name)}</b><span class="{theme.direction(change)}">{theme.signed(change, q.unit)}</span></div>'
            )
        rows.append(f'<div class="fv-heat-label">{esc(group)}</div><div class="fv-heat-row">{"".join(cells)}</div>')
    legend = (
        f'<div class="fv-heat-legend"><span>▼ −{theme.fr_number(scale, 0)} % ou moins</span><i></i>'
        f'<span>▲ +{theme.fr_number(scale, 0)} % ou plus</span></div>'
    )
    return f'<div class="fv-heat">{"".join(rows)}</div>{legend}'


def period_selector(key: str) -> int:
    """Le choix de la période, placé juste au-dessus de ce qu'il pilote."""
    period = st.segmented_control("Période", list(PERIODS), default="1 séance", key=key, label_visibility="collapsed")
    return PERIODS[period or "1 séance"]


def data_table(quotes) -> None:
    with st.expander("Voir les données en tableau", icon=":material/table:"):
        table = pd.DataFrame(
            {"Instrument": q.name, "Groupe": q.group, "Dernier cours": q.last, "Séance": q.change,
             "5 séances": q.change_over(5), "1 mois": q.change_over(21), "3 mois": q.change_over(63), "Unité": q.unit}
            for q in quotes
        )
        st.dataframe(table, hide_index=True, column_config={
            col: st.column_config.NumberColumn(format="%.2f")
            for col in ["Dernier cours", "Séance", "5 séances", "1 mois", "3 mois"]
        })


def world_view() -> None:
    quotes = load_quotes()
    if not quotes:
        st.warning("Les cours ne sont pas disponibles pour le moment (Yahoo Finance ne répond pas). Réessaie dans "
                   "quelques minutes.", icon=":material/cloud_off:")
        return
    # Une section dont tous les instruments manquent (panne partielle de Yahoo) est simplement sautée :
    # st.html("") lèverait une erreur.
    sections = [
        ("Indices boursiers", ["Europe", "Amériques", "Asie"]),
        ("Devises, taux, matières premières, crypto", ["Devises", "Taux et volatilité", "Matières premières", "Crypto"]),
    ]
    for title, groups in sections:
        if tiles := tiles_by_group(quotes, groups):
            theme.section(title, f"séance du {theme.fr_day(quotes[0].history.index[-1])}" if title.startswith("Indices") else "")
            st.html(tiles)
    theme.section("Carte des performances")
    st.html(heatmap(quotes, period_selector("period_world")))
    data_table(quotes)
    st.caption("Variations en % (en points de base pour le taux à 10 ans). Données fournies à titre informatif.")


def cac40_view() -> None:
    quotes = load_cac40()
    if not quotes:
        st.warning("Les cours du CAC 40 ne sont pas disponibles pour le moment.", icon=":material/cloud_off:")
        return
    sessions = period_selector("period_cac")
    changes = sorted(((q.change_over(sessions), q) for q in quotes), key=lambda item: item[0], reverse=True)
    up = sum(1 for change, _ in changes if change > 0)
    down = sum(1 for change, _ in changes if change < 0)
    average = sum(change for change, _ in changes) / len(changes)

    theme.section("Ambiance de la cote", f"{len(quotes)} valeurs")
    st.html(
        f'<div class="fv-kpis">'
        f'<div class="fv-kpi"><div class="fv-kpi-label">Valeurs en hausse</div><div class="fv-kpi-value">{up}</div>'
        f'<div class="fv-breadth" title="{up} en hausse, {down} en baisse">'
        f'<i style="flex:{up};background:var(--fv-up)"></i><i style="flex:{down};background:var(--fv-down)"></i></div>'
        f'<div class="fv-kpi-sub">contre {down} en baisse</div></div>'
        f'<div class="fv-kpi"><div class="fv-kpi-label">Variation moyenne</div>'
        f'<div class="fv-kpi-value"><span class="{theme.direction(average)}">{theme.signed(average)}</span></div>'
        f'<div class="fv-kpi-sub">moyenne simple des 40 valeurs</div></div>'
        f'<div class="fv-kpi"><div class="fv-kpi-label">Meilleure valeur</div><div class="fv-kpi-value">{esc(changes[0][1].name)}</div>'
        f'<div class="fv-kpi-sub">{theme.change(changes[0][0])}</div></div>'
        f'<div class="fv-kpi"><div class="fv-kpi-label">Plus forte baisse</div><div class="fv-kpi-value">{esc(changes[-1][1].name)}</div>'
        f'<div class="fv-kpi-sub">{theme.change(changes[-1][0])}</div></div></div>'
    )

    theme.section("La carte du CAC 40", "par secteur")
    st.html(heatmap(quotes, sessions))

    left, right = st.columns(2, gap="large")
    for column, title, items in [(left, "Plus fortes hausses", changes[:5]), (right, "Plus fortes baisses", changes[::-1][:5])]:
        with column:
            theme.section(title)
            rows = "".join(
                f'<li><span>{esc(q.name)} <small>{esc(q.group)}</small></span>{theme.change(change)}</li>'
                for change, q in items
            )
            st.html(theme.card(f'<ul class="fv-ranking">{rows}</ul>'))
    data_table(quotes)
    st.caption("Composition indicative de l'indice. Moyenne simple : le vrai CAC 40 pondère chaque valeur par sa "
               "capitalisation flottante.")


def currency_view() -> None:
    rates = load_euro_rates()
    if len(rates) < 2:
        st.warning("Les taux de change ne sont pas disponibles pour le moment.", icon=":material/cloud_off:")
        return
    codes = [code for code in CURRENCIES if code in rates]
    theme.section("Convertisseur")
    amount_col, source_col, target_col = st.columns([1.2, 1, 1])
    amount = amount_col.number_input("Montant", min_value=0.0, value=100.0, step=10.0, format="%.2f")
    source = source_col.selectbox("De", codes, index=codes.index("EUR"), format_func=lambda c: f"{c} · {CURRENCIES[c]}")
    target = target_col.selectbox("Vers", codes, index=codes.index("USD"), format_func=lambda c: f"{c} · {CURRENCIES[c]}")
    result = convert(amount, source, target, rates)
    st.html(theme.card(
        f'<div class="fv-convert">{theme.fr_number(amount)} {source} = {theme.fr_number(result)} {target}'
        f"<small>1 {source} = {theme.fr_number(convert(1, source, target, rates), 4)} {target} · dernier cours connu</small></div>"
    ))
    theme.section("Ce que vaut un euro")
    rows = "".join(
        f"<tr><td>{esc(CURRENCIES[code])}</td><td>{code}</td><td>{theme.fr_number(rates[code], 4)}</td>"
        f"<td>{theme.fr_number(1 / rates[code], 4)}</td></tr>"
        for code in codes if code != "EUR"
    )
    st.html(theme.table(["Devise", "Code", "1 EUR =", "En euros"], rows))


theme.page_header(
    "Marchés",
    "Indices, CAC 40, devises, taux, matières premières et crypto : dernier cours connu (Yahoo Finance, différé).",
    eyebrow="Marchés",
)
VIEWS = {"Monde": world_view, "CAC 40": cac40_view, "Devises": currency_view}
# Un sélecteur plutôt que des onglets : seule la vue choisie télécharge ses données.
view = st.segmented_control("Vue", list(VIEWS), default="Monde", key="markets_view", label_visibility="collapsed")
VIEWS[view or "Monde"]()
