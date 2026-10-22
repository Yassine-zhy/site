"""La page Marchés par place : ambiance de la cote, classements, secours de l'indice de Toronto, vue demandée
par l'adresse et liens vers les fiches. Aucun réseau : les cours sont simulés."""

from pathlib import Path

import pandas as pd
import pytest
from streamlit.testing.v1 import AppTest

import theme
from core import market
from core.market import PLACES, Quote

HISTORY_DAYS = pd.date_range("2026-10-01", periods=4, freq="D")


def make_quote(symbol, name, change, group="G", unit="%"):
    """Un cours dont la dernière séance varie de `change` %."""
    history = pd.Series([100.0, 100.0, 100.0, 100.0 * (1 + change / 100)], index=HISTORY_DAYS)
    return Quote(symbol, name, group, unit, float(history.iloc[-1]), float(history.iloc[-2]), history)


QUOTES = [make_quote("A", "Alpha", 2.0), make_quote("B", "Bêta", -1.0), make_quote("C", "Gamma", 0.5),
          make_quote("D", "Delta", -3.0), make_quote("E", "Epsilon", 0.0)]


def test_ambiance_de_la_cote():
    facts = market.mood(QUOTES)
    assert (facts["count"], facts["up"], facts["down"]) == (5, 2, 2)  # Epsilon est stable : ni l'un ni l'autre
    assert facts["average"] == pytest.approx(-0.3)
    assert facts["best"][1].name == "Alpha" and facts["best"][0] == pytest.approx(2.0)
    assert facts["worst"][1].name == "Delta" and facts["worst"][0] == pytest.approx(-3.0)


def test_ambiance_sans_cours():
    assert market.mood([]) is None


def test_classement_hausses_et_baisses():
    gains, losses = market.top_moves(QUOTES, count=2)
    assert [q.name for _, q in gains] == ["Alpha", "Gamma"]
    assert [q.name for _, q in losses] == ["Delta", "Bêta"]  # la plus forte baisse d'abord


def test_toutes_les_places_ont_un_indice_et_des_valeurs():
    assert set(PLACES) == {"france", "canada", "usa"}
    for name, index, index_name, members in PLACES.values():
        assert name and index and index_name and members
        assert len({symbol for symbol, *_ in members}) == len(members)  # pas de doublon


def test_toronto_est_dans_la_liste_suivie_avec_les_devises_canadiennes():
    watched = {symbol: (name, group) for symbol, name, group, _ in market.WATCHLIST}
    assert watched["^GSPTSX"][1] == "Amériques"
    assert watched["CAD=X"][1] == watched["EURCAD=X"][1] == "Devises"


def fake_fetch(unavailable=()):
    """Un `fetch_quotes` simulé : les symboles de `unavailable` ne répondent pas (comme Yahoo parfois)."""
    calls = []

    def fetch(watchlist, period="3mo"):
        calls.append([symbol for symbol, *_ in watchlist])
        return [make_quote(symbol, name, 1.0, group, unit)
                for symbol, name, group, unit in watchlist if symbol not in unavailable]

    fetch.calls = calls
    return fetch


def test_secours_xiu_quand_l_indice_de_toronto_manque():
    fetch = fake_fetch(unavailable={"^GSPTSX"})
    quotes = market.fetch_quotes_with_fallback(fetch=fetch)
    symbols = [q.symbol for q in quotes]
    assert "^GSPTSX" not in symbols
    spare = quotes[symbols.index("XIU.TO")]
    assert spare.name == "S&P/TSX 60" and spare.group == "Amériques"
    assert symbols.index("XIU.TO") == symbols.index("^DJI") + 1  # à la place de l'indice manquant, dans l'ordre
    assert fetch.calls[1] == ["XIU.TO"]  # une seconde requête, pour le seul secours


def test_pas_de_secours_quand_l_indice_repond():
    fetch = fake_fetch()
    quotes = market.fetch_quotes_with_fallback(fetch=fetch)
    assert "^GSPTSX" in [q.symbol for q in quotes] and "XIU.TO" not in [q.symbol for q in quotes]
    assert len(fetch.calls) == 1  # aucune requête de plus


def test_secours_qui_echoue_aussi():
    def fetch(watchlist, period="3mo"):
        if [s for s, *_ in watchlist] == ["XIU.TO"]:
            raise ConnectionError("Yahoo ne répond pas")
        return [make_quote(s, n, 1.0, g, u) for s, n, g, u in watchlist if s != "^GSPTSX"]

    symbols = [q.symbol for q in market.fetch_quotes_with_fallback(fetch=fetch)]
    assert "^GSPTSX" not in symbols and "XIU.TO" not in symbols and "^GSPC" in symbols


def test_une_place_avec_son_indice_ou_son_secours():
    index, members = market.fetch_place("canada", fetch=fake_fetch(unavailable={"^GSPTSX"}))
    assert index.symbol == "XIU.TO" and index.name == "S&P/TSX 60"
    assert len(members) == len(PLACES["canada"][3]) and index not in members
    index, members = market.fetch_place("france", fetch=fake_fetch())
    assert index.symbol == "^FCHI" and len(members) == 40


def test_place_index_dans_une_liste_de_cours():
    assert market.place_index("usa", [make_quote("^GSPC", "S&P 500", 1), make_quote("^DJI", "Dow Jones", 1)]).name == "Dow Jones"
    assert market.place_index("usa", [make_quote("^GSPC", "S&P 500", 1)]) is None


@pytest.mark.parametrize("value, expected", [
    (None, "monde"), ("", "monde"), ("canada", "canada"), ("Canada", "canada"), (" france ", "france"),
    ("usa", "usa"), ("etats-unis", "usa"), ("États-Unis", "usa"), ("devises", "devises"),
    ("n'importe quoi", "monde"), (["france", "canada"], "canada"), ([], "monde"),
])
def test_lecture_du_parametre_view(value, expected):
    assert market.resolve_view(value) == expected


def test_chaque_valeur_mene_a_sa_fiche():
    quote = make_quote("MC.PA", "LVMH", 1.0)
    assert 'href="fiche?s=MC.PA"' in theme.quote_tile(quote) and 'target="_self"' in theme.quote_tile(quote)
    assert 'href="fiche?s=%5EFCHI"' in theme.float_tile(make_quote("^FCHI", "CAC 40", 1.0))
    bitcoin = make_quote("BTC-USD", "Bitcoin", 1.0)
    assert 'href="fiche-crypto?c=bitcoin"' in theme.quote_tile(bitcoin)  # la crypto de Yahoo mène à la fiche crypto


# --- La page elle-même, avec des cours simulés (AppTest) ----------------------------------------------------------
APP = Path(__file__).parent.parent / "app.py"


@pytest.fixture
def app(db, monkeypatch):
    import streamlit as st

    import ui
    from core import capacity

    st.cache_data.clear()
    monkeypatch.setenv("LOCAL_MODE", "true")
    monkeypatch.setattr(ui, "fetch_quotes", fake_fetch())
    monkeypatch.setattr(ui, "LAST_GOOD", capacity.Memory())
    monkeypatch.setattr(ui, "search_companies", lambda q: [{"symbol": "SHOP.TO", "name": "Shopify", "exchange": "Toronto"}])
    monkeypatch.setattr(capacity, "QUEUE", capacity.RenderQueue())
    return AppTest.from_file(str(APP), default_timeout=60)


def html_of(app) -> str:
    return " ".join(element.value for element in app.get("html"))


@pytest.mark.parametrize("view, label", [("monde", "Monde"), ("france", "France"), ("canada", "Canada"),
                                          ("usa", "États-Unis"), ("devises", "Devises")])
def test_chaque_vue_s_affiche(app, view, label):
    app.query_params["view"] = view
    app.run()
    app.switch_page("views/markets.py").run()
    assert not app.exception
    assert app.segmented_control(key="markets_view").value == label
    assert 'href="fiche?s=' in html_of(app)  # des valeurs cliquables


def test_changer_de_vue_met_a_jour_l_adresse(app):
    app.run()
    app.switch_page("views/markets.py").run()
    app.segmented_control(key="markets_view").set_value("Canada").run()
    assert not app.exception
    assert app.query_params["view"] in ("canada", ["canada"])
    page = html_of(app)
    assert "Les grandes valeurs de Toronto (S&P/TSX 60)" in page and "RY.TO" in page


def test_titres_des_trois_places(app):
    app.run()
    app.switch_page("views/markets.py").run()
    for label, title in [("France", "La carte du CAC 40"), ("États-Unis", "Les grandes valeurs de New York (Dow Jones et géants de la tech)")]:
        app.segmented_control(key="markets_view").set_value(label).run()
        assert not app.exception and title in html_of(app)


def test_la_vue_monde_presente_les_places(app):
    app.run()
    app.switch_page("views/markets.py").run()
    page = html_of(app)
    assert "Les places" in page and all(f'href="markets?view={key}"' in page for key in PLACES)


def test_recherche_d_une_valeur(app):
    app.run()
    app.switch_page("views/markets.py").run()
    app.text_input[0].set_value("shop").run()
    assert not app.exception
    assert 'href="fiche?s=SHOP.TO"' in html_of(app)


def test_une_place_sans_cours_ne_fait_pas_tomber_la_page(app, monkeypatch):
    import ui

    def fetch(watchlist, period="3mo"):
        raise ConnectionError("Yahoo ne répond pas")

    monkeypatch.setattr(ui, "fetch_quotes", fetch)
    app.query_params["view"] = "canada"
    app.run()
    app.switch_page("views/markets.py").run()
    assert not app.exception
    assert any("pas disponibles" in warning.value for warning in app.warning)
