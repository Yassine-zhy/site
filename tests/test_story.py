"""Le récit de l'accueil suit la place choisie (France, Canada, États-Unis) : textes, horloges, maquette 3D, sélecteur
lié à l'adresse. Aucun réseau : les cours sont simulés."""

import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pytest
from streamlit.testing.v1 import AppTest

import scene3d
import theme
from conftest import make_article
from core import market
from core.market import PLACES, Quote

DAYS = pd.date_range("2026-10-17", periods=4, freq="D")  # la dernière séance est celle du jour de NOW
NOW = datetime(2026, 10, 20, 12, 0, tzinfo=timezone.utc)  # un mardi : Paris ouverte (14 h)


def make_quote(symbol, name, change, last=100.0):
    """Un cours dont la dernière séance varie de `change` %."""
    previous = last / (1 + change / 100)
    return Quote(symbol, name, "G", "%", last, previous, pd.Series([previous] * 3 + [last], index=DAYS))


def members_of(place, changes=None):
    """Un cours pour chaque valeur d'une place ; `changes` : {symbole: variation} (0,1 % sinon)."""
    return [make_quote(symbol, name, (changes or {}).get(symbol, 0.1)) for symbol, name, _ in PLACES[place][3]]


# --- Le texte du récit ------------------------------------------------------------------------------------------


def test_le_recit_de_la_france_ne_change_pas():
    index = make_quote("^FCHI", "CAC 40", 1.06, 7921.68)
    html = theme.story_html(index, members_of("france"), now=NOW)
    assert "Le CAC 40 progresse de" in html and "Il s&#x27;établit à 7 921,68 points." in html
    assert "La plus forte hausse du CAC 40" in html and "La plus forte baisse du CAC 40" in html
    assert html == theme.story_html(index, members_of("france"), now=NOW, place="france")  # la France par défaut
    assert "Toronto" in html  # les horloges ont Toronto


def test_le_recit_du_canada():
    index = make_quote("^GSPTSX", "S&P/TSX", -0.8, 27500.0)
    lead = type("Lead", (), {"title": "La Banque du Canada surveille l'inflation"})()
    html = theme.story_html(index, members_of("canada"), lead, now=NOW, place="canada")
    assert "Le S&amp;P/TSX recule de" in html and "27\u202f500 points." in html
    assert "La plus forte hausse du S&amp;P/TSX 60" in html and "La plus forte baisse du S&amp;P/TSX 60" in html
    assert "Ce qui fait l'actualité au Canada" in html.replace("&#x27;", "'")
    assert "Le CAC 40" not in html and 'data-place="canada"' in html


def test_le_recit_des_etats_unis():
    index = make_quote("^DJI", "Dow Jones", 0.4, 45000.0)
    lead = type("Lead", (), {"title": "Wall Street ouvre en hausse"})()
    html = theme.story_html(index, members_of("usa"), lead, now=NOW, place="usa")
    assert "Le Dow Jones progresse de" in html
    assert "La plus forte hausse à Wall Street" in html and "La plus forte baisse à Wall Street" in html
    assert "Ce qui fait l'actualité dans le monde" in html.replace("&#x27;", "'")


def test_le_fonds_de_secours_ne_parle_pas_de_points():
    fund = make_quote("XIU.TO", "S&P/TSX 60 (fonds XIU)", 0.5, 54.10)
    html = theme.story_html(fund, members_of("canada"), now=NOW, place="canada")
    assert "Le S&amp;P/TSX\u00a060 progresse de" in html
    assert "D&#x27;après son fonds XIU, qui s&#x27;échange à 54,10 $." in html
    assert "points" not in html


def test_les_maquettes_se_decrivent_pour_les_lecteurs_d_ecran():
    labels = [("france", "La maquette du CAC 40"), ("canada", "La maquette du S&amp;P/TSX 60 : ses 40 plus grandes"),
              ("usa", "La maquette de Wall Street : les 30 valeurs du Dow Jones et cinq géants de la tech")]
    for place, start in labels:
        html = theme.story_html(None, city=scene3d.city_data(members_of(place), place), place=place)
        assert f'aria-label="{start}' in html, place
        assert "son toit est vert si elle monte, rouge si elle baisse." in html


def test_toronto_dans_les_horloges():
    cities = [city for city, *_ in theme.EXCHANGES]
    assert cities.index("Londres") < cities.index("Toronto") < cities.index("New York")
    zone = next(zone for city, zone, *_ in theme.EXCHANGES if city == "Toronto")
    assert zone == "America/Toronto"
    tuesday_noon_toronto = datetime(2026, 10, 20, 16, 0, tzinfo=timezone.utc)  # 12 h à Toronto
    status = {city: is_open for city, _, is_open in theme.exchange_status(tuesday_noon_toronto)}
    assert status["Toronto"] and status["New York"] and not status["Tokyo"]


@pytest.mark.parametrize("place, town", [("france", "Paris"), ("canada", "Toronto"), ("usa", "New York")])
def test_l_horloge_de_la_place_racontee_ressort(place, town):
    html = theme.sessions_html(NOW, town)
    assert html.count("is-current") == 1
    assert f'<b>{town}</b>' in html.split("is-current")[1]
    assert "is-current" not in theme.sessions_html(NOW)


# --- La maquette 3D ---------------------------------------------------------------------------------------------


def test_la_maquette_de_la_france_et_des_etats_unis_garde_toutes_les_valeurs():
    assert len(scene3d.city_data(members_of("france"))["towers"]) == 40
    assert len(scene3d.city_data(members_of("usa"), "usa")["towers"]) == 35
    # sans cours, les tours sont là quand même, sans couleur
    assert all(tower["c"] is None for tower in scene3d.city_data([], "usa")["towers"])
    assert scene3d.city_data([], "inconnue") == scene3d.city_data([])  # une place inconnue : la France


def test_chaque_valeur_a_son_poids():
    for place, (weights, _) in scene3d.CITY_WEIGHTS.items():
        assert {symbol for symbol, *_ in PLACES[place][3]} == set(weights), place


def test_la_maquette_du_canada_garde_les_extremes_de_la_seance():
    smallest = ["SAP.TO", "TFII.TO", "CAE.TO"]  # des petites valeurs qui ne passeraient pas dans les 40 plus lourdes
    changes = {symbol: 0.3 for symbol, *_ in PLACES["canada"][3]}
    changes.update({"SAP.TO": 9.0, "TFII.TO": 7.5, "CAE.TO": 6.0, "CTC-A.TO": -8.0, "MG.TO": -7.0, "X.TO": -6.5})
    data = scene3d.city_data(members_of("canada", changes), "canada")
    towers = data["towers"]
    names = {tower["n"] for tower in towers}
    assert len(towers) == 40
    by_symbol = {symbol: name for symbol, name, _ in PLACES["canada"][3]}
    for symbol in [*smallest, "CTC-A.TO", "MG.TO", "X.TO"]:
        assert by_symbol[symbol] in names, symbol
    # le reste, ce sont les plus lourdes : Shopify et la Banque Royale sont là
    assert by_symbol["SHOP.TO"] in names and by_symbol["RY.TO"] in names
    assert max(tower["c"] for tower in towers) == 9.0 and min(tower["c"] for tower in towers) == -8.0
    assert data["act"] == scene3d.CITY_ACT


def test_la_maquette_du_canada_sans_cours_garde_les_plus_lourdes():
    towers = scene3d.city_data([], "canada")["towers"]
    assert len(towers) == 40
    weights = sorted((tower["w"] for tower in towers), reverse=True)
    assert weights[0] == 190 and weights[-1] >= 22  # les 20 valeurs les plus légères sont écartées


# --- L'accueil, avec des cours simulés (AppTest) -----------------------------------------------------------------
APP = Path(__file__).parent.parent / "app.py"
CHANGES = {"france": {}, "canada": {"SAP.TO": 5.0, "MG.TO": -4.0}, "usa": {"NVDA": 3.0, "BA": -2.0}}


@pytest.fixture
def app(db, monkeypatch):
    import socket

    import streamlit as st

    import ui
    from core import aggregator, capacity, images

    def no_network(*args, **kwargs):
        raise OSError("réseau coupé pendant les tests")

    monkeypatch.setattr(socket, "getaddrinfo", no_network)  # un appel réseau oublié fait échouer le test tout de suite
    st.cache_data.clear()
    monkeypatch.setenv("LOCAL_MODE", "true")
    articles = [make_article("Wall Street hits a record", source="CNBC", category="marches", region="monde"),
                make_article("Bank of Canada holds its rate", source="CBC", category="macro", region="ca", hours_ago=2),
                make_article("La Bourse de Paris recule", source="Les Échos", category="marches", region="fr",
                             hours_ago=3)]
    monkeypatch.setattr(aggregator, "build_tasks", lambda keys: [("Test", lambda: list(articles), ())])
    monkeypatch.setattr(aggregator, "fetch_yahoo_ticker_news", lambda ticker: [])
    monkeypatch.setattr(images, "share_images", lambda urls: {})
    monkeypatch.setattr(ui, "ai_keys", lambda: {})
    monkeypatch.setattr(market, "euro_rates", lambda: {"EUR": 1.0, "USD": 1.1})
    monkeypatch.setattr(ui, "LAST_GOOD", capacity.Memory())
    monkeypatch.setattr(capacity, "QUEUE", capacity.RenderQueue())
    monkeypatch.setattr(ui, "fetch_quotes", lambda watchlist=None, period="3mo": (
        [make_quote("^FCHI", "CAC 40", 1.0, 7900.0)] if watchlist is None else
        [make_quote(symbol, name, CHANGES["france"].get(symbol, 0.5)) for symbol, name, *_ in watchlist]))
    asked = []

    def fake_place(key):
        asked.append(key)
        index = make_quote(PLACES[key][1], PLACES[key][2], 0.7, 27000.0)
        return index, members_of(key, CHANGES[key])

    monkeypatch.setattr(ui, "load_place", fake_place)
    test = AppTest.from_file(str(APP), default_timeout=60)
    test.asked = asked
    return test


def story_of(app) -> str:
    return " ".join(element.value for element in app.get("html") if "fv-story" in element.value)


def test_l_accueil_s_ouvre_sur_la_france(app):
    app.run()
    assert not app.exception
    assert app.segmented_control(key="story_place").value == "france"
    assert "Le CAC 40" in story_of(app) and "place" not in app.query_params
    assert app.asked == []  # la France ne passe pas par load_place


def test_l_adresse_ouvre_l_accueil_sur_le_canada(app):
    app.query_params["place"] = "canada"
    app.run()
    assert not app.exception
    assert app.segmented_control(key="story_place").value == "canada"
    story = story_of(app)
    assert re.search(r"Le S&amp;P/TSX (progresse|a progressé) de", story) and 'data-place="canada"' in story
    assert "Bank of Canada holds its rate" in story  # la une est cherchée parmi les dépêches canadiennes
    assert "Wall Street hits a record" not in story
    assert app.asked == ["canada"]


def test_changer_de_place_met_a_jour_l_adresse_et_le_recit(app):
    app.run()
    app.segmented_control(key="story_place").set_value("canada").run()
    assert not app.exception
    assert app.query_params["place"] in ("canada", ["canada"])
    assert 'data-place="canada"' in story_of(app)
    app.segmented_control(key="story_place").set_value("usa").run()
    assert not app.exception and re.search(r"Le Dow Jones (progresse|a progressé) de", story_of(app))
    assert "Wall Street hits a record" in story_of(app)  # aux États-Unis : la une du monde
    app.segmented_control(key="story_place").set_value("france").run()
    assert not app.exception and "place" not in app.query_params  # la France est la place par défaut
    assert "Le CAC 40" in story_of(app)


def test_une_place_inconnue_dans_l_adresse_donne_la_france(app):
    app.query_params["place"] = "mars"
    app.run()
    assert not app.exception
    assert app.segmented_control(key="story_place").value == "france"
    assert "place" not in app.query_params and "Le CAC 40" in story_of(app)


def test_une_place_sans_cours_ne_fait_pas_tomber_l_accueil(app, monkeypatch):
    import ui

    monkeypatch.setattr(ui, "load_place", lambda key: (None, []))
    app.query_params["place"] = "usa"
    app.run()
    assert not app.exception
    assert "Les marchés, en direct." in story_of(app)


# --- La séance des chiffres : en cours, close, ou une séance précédente -------------------------------------------


def quote_until(symbol, name, change, last, day):
    """Un cours dont la dernière séance, datée `day`, varie de `change` %."""
    previous = last / (1 + change / 100)
    days = pd.date_range(end=day, periods=4, freq="D")
    return Quote(symbol, name, "G", "%", last, previous, pd.Series([previous] * 3 + [last], index=days))


def test_avant_l_ouverture_le_recit_donne_la_seance_precedente_au_passe():
    """À 8 h à Paris, les chiffres sont ceux de la veille : le récit le dit, au passé (avant : « Mardi 20 octobre,
    08 h 00 … progresse de », comme si c'était la séance du jour)."""
    index = quote_until("^FCHI", "CAC 40", 0.34, 8205.37, "2026-10-19")
    members = [quote_until(s, n, 0.1, 100.0, "2026-10-19") for s, n, _ in PLACES["france"][3]]
    html = theme.story_html(index, members, now=datetime(2026, 10, 20, 6, 0, tzinfo=timezone.utc))
    assert "Séance du lundi 19 octobre" in html and "Mardi 20 octobre" not in html
    assert "Le CAC 40 a progressé de" in html and "Il a terminé à 8 205,37 points." in html.replace("\u202f", " ")


def test_le_week_end_le_recit_donne_la_seance_du_vendredi():
    index = quote_until("^FCHI", "CAC 40", -0.5, 8100.0, "2026-10-23")
    html = theme.story_html(index, now=datetime(2026, 10, 24, 12, 0, tzinfo=timezone.utc))
    assert "Séance du vendredi 23 octobre" in html and "Le CAC 40 a reculé de" in html


def test_apres_la_cloture_le_recit_parle_de_la_cloture():
    index = quote_until("^FCHI", "CAC 40", 0.0, 8100.0, "2026-10-20")
    html = theme.story_html(index, now=datetime(2026, 10, 20, 17, 0, tzinfo=timezone.utc))  # 19 h à Paris
    assert "Mardi 20 octobre, à la clôture" in html and "Le CAC 40 est resté stable, à" in html


def test_pendant_la_seance_le_recit_est_au_present_avec_l_heure():
    index = quote_until("^FCHI", "CAC 40", 0.8, 8100.0, "2026-10-20")
    html = theme.story_html(index, now=datetime(2026, 10, 20, 9, 30, tzinfo=timezone.utc))  # 11 h 30 à Paris
    assert "Mardi 20 octobre, 11 h 30" in html and "Le CAC 40 progresse de" in html
    assert "Il s&#x27;établit à 8 100,00 points." in html.replace("\u202f", " ")


def test_des_cours_d_hier_en_memoire_sont_remplaces_par_ceux_du_jour(app):
    """Avant, l'accueil reprenait tels quels les cours du CAC 40 gardés en mémoire (jusqu'à 24 h) : le récit et les
    tours restaient sur la séance de la veille. Les cours du jour les remplacent maintenant."""
    import ui

    ui.LAST_GOOD.put("cac40|()", [quote_until(s, n, -3.0, 100.0, "2026-10-19") for s, n, _ in PLACES["france"][3]])
    app.run()
    story = story_of(app)
    assert not app.exception
    assert "Séance du mardi 20 octobre" in story and " 0 en baisse." in story
    assert "lundi 19 octobre" not in story
