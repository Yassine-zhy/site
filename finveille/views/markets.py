"""Page « Marchés » : le monde, puis chaque place (France, Canada, États-Unis) valeur par valeur, et un convertisseur
de devises. Chaque valeur affichée mène à sa fiche."""

import pandas as pd
import streamlit as st

import theme
from core import market
from core.market import CURRENCIES, PLACES, align_session, convert, mood, resolve_view, top_moves
from theme import esc
from ui import hero_quotes, load_euro_rates, load_place, load_quotes, search_companies

THIN = "\u202f"  # espace fine insécable, avant « % »

PERIODS = {"1 séance": 1, "5 séances": 5, "1 mois": 21, "3 mois": 63}
# Variation qui donne la couleur la plus intense dans les cartes de performances, selon la période
HEAT_SCALE = {1: 2.0, 5: 4.0, 21: 8.0, 63: 15.0}


# Le style propre à cette page : la ligne des places, les résultats de recherche, les noms qui mènent à une fiche
STYLE = """<style>
.mk-places { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: .8rem; }
a.mk-place { display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: .1rem .8rem; padding: .8rem 1rem;
  color: inherit; text-decoration: none; background: var(--fv-surface); border: 1px solid var(--fv-line);
  border-radius: var(--fv-radius); box-shadow: var(--fv-elev); transition: border-color .15s, box-shadow .2s, transform .2s; }
a.mk-place:hover, a.mk-place:focus-visible { color: inherit; text-decoration: none; transform: translateY(-2px);
  border-color: var(--fv-brand); box-shadow: var(--fv-elev-hover); }
a.mk-place:focus-visible { outline: 2px solid var(--fv-brand); outline-offset: 2px; }
.mk-place-name { font-weight: 650; font-size: .95rem; }
.mk-place-name small { margin-left: .4rem; font-weight: 500; font-size: .76rem; color: var(--fv-muted); }
.mk-place-delta { font-size: .86rem; font-weight: 600; text-align: right; }
.mk-place-bar { grid-column: 1 / -1; display: flex; height: 5px; margin-top: .45rem; border-radius: 3px; overflow: hidden;
  background: var(--fv-line); }
.mk-place-sub { grid-column: 1 / -1; font-size: .76rem; color: var(--fv-muted); }
.mk-kpis.fv-kpis { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-top: 0; }
.mk-kpis .fv-kpi-value { font-size: 1.4rem; white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: anywhere; }
.mk-hits { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: .5rem; margin: .2rem 0 .6rem; }
a.mk-hit { display: flex; justify-content: space-between; align-items: baseline; gap: .8rem; padding: .55rem .8rem;
  color: inherit; text-decoration: none; font-size: .88rem; background: var(--fv-surface); border: 1px solid var(--fv-line);
  border-radius: var(--radius-md, 8px); transition: border-color .15s, background-color .15s; }
a.mk-hit:hover, a.mk-hit:focus-visible { color: inherit; text-decoration: none; border-color: var(--fv-brand); background: var(--fv-sunken); }
a.mk-hit:focus-visible { outline: 2px solid var(--fv-brand); outline-offset: 2px; }
a.mk-hit b { font-weight: 600; }
a.mk-hit small { color: var(--fv-muted); font-family: var(--fv-mono); white-space: nowrap; }
a.mk-link { color: inherit; text-decoration: none; border-bottom: 1px dotted var(--fv-faint); }
a.mk-link:hover, a.mk-link:focus-visible { color: var(--fv-brand); border-bottom-color: var(--fv-brand); }
@media (max-width: 640px) { .fv-heat { grid-template-columns: 1fr; gap: 2px; } .fv-heat-label { padding-top: .6rem; } }
</style>"""


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
                f'<a class="fv-cell" href="{theme.fiche_url(q.symbol)}" target="_self" style="--c:{color};--a:{alpha:.0f}%" '
                f'title="{esc(q.name)} : {theme.signed(change, q.unit)}">'
                f'<b>{esc(q.name)}</b><span class="{theme.direction(change)}">{theme.signed(change, q.unit)}</span></a>'
            )
        rows.append(f'<div class="fv-heat-label">{esc(group)}</div><div class="fv-heat-row">{"".join(cells)}</div>')
    legend = (
        f'<div class="fv-heat-legend"><span>▼ −{theme.fr_number(scale, 0)}{THIN}% ou moins</span><i></i>'
        f'<span>▲ +{theme.fr_number(scale, 0)}{THIN}% ou plus</span></div>'
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
             "5 séances": q.change_over(5), "1 mois": q.change_over(21), "3 mois": q.change_over(63), "Unité": q.unit,
             "Fiche": theme.fiche_url(q.symbol)}
            for q in quotes
        )
        config = {col: st.column_config.NumberColumn(format="%.2f")
                  for col in ["Dernier cours", "Séance", "5 séances", "1 mois", "3 mois"]}
        config["Fiche"] = st.column_config.LinkColumn("Fiche", display_text="Voir", help="Ouvre la fiche de la valeur")
        st.dataframe(table, hide_index=True, column_config=config, alt="Cours et variations des instruments")


def places_row(quotes) -> str:
    """La ligne « Les places » : pour France, Canada et États-Unis, l'indice, sa variation et la part de valeurs en
    hausse. Chaque carte mène à la vue de la place."""
    cards = []
    for key, (name, _, index_name, _) in PLACES.items():
        index, members = load_place(key)
        index = index or market.place_index(key, quotes)  # le cours de l'indice vient du bandeau si la place ne répond pas
        if index is None:
            continue
        facts = mood(members)
        breadth = (
            f'<div class="mk-place-bar" title="{facts["up"]} en hausse, {facts["down"]} en baisse">'
            f'<i style="flex:{facts["up"]};background:var(--fv-up)"></i><i style="flex:{facts["down"]};background:var(--fv-down)"></i></div>'
            f'<div class="mk-place-sub">{facts["up"]} valeurs sur {facts["count"]} en hausse</div>'
        ) if facts else ""
        cards.append(
            f'<a class="mk-place" href="markets?view={key}" target="_self">'
            f'<span class="mk-place-name">{esc(name)}<small>{esc(index.name)}</small></span>'
            f'<span class="mk-place-delta">{theme.change(index.change, index.unit)}</span>{breadth}</a>'
        )
    return f'<div class="mk-places">{"".join(cards)}</div>' if cards else ""


def world_view() -> None:
    slot = st.container()  # la ligne des places se remplit en dernier : elle télécharge les valeurs de chaque place
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
    with slot:
        theme.section("Les places", "choisis-en une pour voir ses valeurs une à une")
        if row := places_row(quotes):
            st.html(row)
        else:
            st.caption("Les places ne sont pas disponibles pour le moment.")


# Pour chaque place : le titre de la carte, et la note de bas de page
PLACE_TEXT = {
    "france": ("La carte du CAC 40", "Composition indicative de l'indice. Moyenne simple : le vrai CAC 40 pondère chaque "
                                      "valeur par sa capitalisation flottante."),
    "canada": ("Les grandes valeurs de Toronto (S&P/TSX 60)", "Composition indicative du S&P/TSX 60, cours en dollars "
                                                               "canadiens. Moyenne simple, sans pondération."),
    "usa": ("Les grandes valeurs de New York (Dow Jones et géants de la tech)", "Les 30 valeurs du Dow Jones et cinq "
                                                                                 "géants de la technologie (composition indicative), cours en dollars. Moyenne simple, sans pondération."),
}


def link(quote) -> str:
    """Le nom d'une valeur, en lien vers sa fiche."""
    return f'<a class="mk-link" href="{theme.fiche_url(quote.symbol)}" target="_self">{esc(quote.name)}</a>'


def mood_html(facts: dict, compact: bool = False) -> str:
    """Les quatre repères de l'ambiance d'une cote (valeurs en hausse, moyenne, meilleure valeur, plus forte baisse)."""
    up, down, count = facts["up"], facts["down"], facts["count"]
    (best_change, best), (worst_change, worst) = facts["best"], facts["worst"]
    return (
        f'<div class="fv-kpis{" mk-kpis" if compact else ""}">'
        f'<div class="fv-kpi"><div class="fv-kpi-label">Valeurs en hausse</div><div class="fv-kpi-value">{up}</div>'
        f'<div class="fv-breadth" title="{up} en hausse, {down} en baisse">'
        f'<i style="flex:{up};background:var(--fv-up)"></i><i style="flex:{down};background:var(--fv-down)"></i></div>'
        f'<div class="fv-kpi-sub">contre {down} en baisse</div></div>'
        f'<div class="fv-kpi"><div class="fv-kpi-label">Variation moyenne</div>'
        f'<div class="fv-kpi-value"><span class="{theme.direction(facts["average"])}">{theme.signed(facts["average"])}</span></div>'
        f'<div class="fv-kpi-sub">moyenne simple des {count} valeurs</div></div>'
        f'<div class="fv-kpi"><div class="fv-kpi-label">Meilleure valeur</div><div class="fv-kpi-value">{link(best)}</div>'
        f'<div class="fv-kpi-sub">{theme.change(best_change)}</div></div>'
        f'<div class="fv-kpi"><div class="fv-kpi-label">Plus forte baisse</div><div class="fv-kpi-value">{link(worst)}</div>'
        f'<div class="fv-kpi-sub">{theme.change(worst_change)}</div></div></div>'
    )


def ranking_html(items) -> str:
    """Un classement : chaque ligne (valeur, secteur, variation) mène à la fiche de la valeur."""
    rows = "".join(
        f'<li><a class="fv-rank-link" href="{theme.fiche_url(q.symbol)}" target="_self"><b>{esc(q.name)}</b> '
        f'<small>{esc(q.group)}</small></a>{theme.change(change)}</li>'
        for change, q in items
    )
    return theme.card(f'<ul class="fv-ranking">{rows}</ul>')


def place_view(key: str) -> None:
    """Une place (clé de PLACES) : son indice, l'ambiance de sa cote, sa carte par secteur, ses plus fortes hausses et
    baisses, et le tableau de ses valeurs."""
    name = PLACES[key][0]
    index, quotes, _ = align_session(*load_place(key))  # l'indice et ses valeurs, sur la même séance
    if not quotes:
        st.warning(f"Les cours de la place « {name} » ne sont pas disponibles pour le moment.", icon=":material/cloud_off:")
        return
    sessions = period_selector(f"period_{key}")
    facts = mood(quotes, sessions)
    title, footnote = PLACE_TEXT[key]

    theme.section("Ambiance de la cote", f"{len(quotes)} valeurs")
    if index:
        head, body = st.columns([1, 3], gap="medium")
        head.html(f'<div class="fv-tiles">{theme.quote_tile(index)}</div>')
        body.html(mood_html(facts, compact=True))
    else:
        st.html(mood_html(facts))

    theme.section(title, "par secteur")
    st.html(heatmap(quotes, sessions))

    left, right = st.columns(2, gap="large")
    gains, losses = top_moves(quotes, sessions)
    for column, heading, items in [(left, "Plus fortes hausses", gains), (right, "Plus fortes baisses", losses)]:
        with column:
            theme.section(heading)
            st.html(ranking_html(items))
    data_table(quotes)
    st.caption(footnote)


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


# Les vues : (clé de l'adresse `markets?view=…`, titre du sélecteur, fonction qui dessine la vue)
VIEWS = {
    "monde": ("Monde", world_view),
    "france": ("France", lambda: place_view("france")),
    "canada": ("Canada", lambda: place_view("canada")),
    "usa": ("États-Unis", lambda: place_view("usa")),
    "devises": ("Devises", currency_view),
}


def search_box() -> None:
    """« Chercher une valeur » : chaque résultat est un lien vers sa fiche."""
    query = st.text_input("Chercher une valeur", placeholder="LVMH, Shopify, Apple, MC.PA…", icon=":material/search:")
    if len(query.strip()) < 2:
        return
    results = search_companies(query.strip())
    if not results:
        st.caption("Aucun résultat, ou la recherche est indisponible pour le moment. Essaie le nom anglais ou le symbole "
                   "boursier.")
        return
    hits = "".join(
        f'<a class="mk-hit" href="{theme.fiche_url(r["symbol"])}" target="_self">'
        f'<span><b>{esc(r["name"])}</b> <small>{esc(r["exchange"])}</small></span><small>{esc(r["symbol"])}</small></a>'
        for r in results
    )
    st.html(f'<div class="mk-hits">{hits}</div>')


st.html(STYLE)
theme.page_header(
    "Les marchés mondiaux,",
    "Paris, Toronto, New York et le reste du monde : indices, devises, taux, matières premières et crypto. "
    "Dernier cours connu (Yahoo Finance, différé).",
    eyebrow="Marchés", accent="en un coup d'œil.", scene="markets",
    quotes=hero_quotes("^FCHI", "^GSPTSX", "XIU.TO", "^GSPC"),
)
search_box()
# Un sélecteur plutôt que des onglets : seule la vue choisie télécharge ses données. Il suit l'adresse
# (`markets?view=canada`), pour qu'une vue se partage et que les fiches puissent y renvoyer.
wanted = resolve_view(st.query_params.get("view"))
labels = {key: title for key, (title, _) in VIEWS.items()}
choice = st.segmented_control("Vue", list(labels.values()), default=labels[wanted], key="markets_view",
                              label_visibility="collapsed")
current = next((key for key, title in labels.items() if title == choice), "monde")
if st.query_params.get("view", "monde") != current:
    st.query_params["view"] = current
VIEWS[current][1]()
