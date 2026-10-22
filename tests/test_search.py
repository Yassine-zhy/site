"""La recherche du site (search.py) : pages, glossaire, rendu des résultats, bouton de la barre du haut et dialogue."""

import pytest

import coins
import search
import ui
from core.crypto import CoinHit
from core.filters import normalize
from core.glossary import GLOSSARY
from test_app import app  # noqa: F401  (la fixture qui monte le site complet avec des données factices)

VALUES = [{"symbol": "MC.PA", "name": "LVMH Moet Hennessy", "exchange": "Paris"}]
COINS = [CoinHit(id="bitcoin", name="Bitcoin", symbol="BTC", rank=1, thumb="https://example.com/btc.png")]


def titles(query):
    return [title for title, _ in search.page_hits(query)]


# --- Les pages du site -----------------------------------------------------------------------------


def test_pages_par_titre_sans_accent_ni_majuscule():
    assert titles("simulateur") == ["Simulateurs"]
    assert titles("ECONOMIE")[0] == "Économie"
    assert titles("a propos") == ["À propos"]


def test_pages_par_mot_cle():
    assert titles("crédit immobilier") == ["Simulateurs"]
    assert titles("credit immobilier") == ["Simulateurs"]  # sans accent
    assert {"Économie", "Simulateurs"} <= set(titles("inflation"))
    assert "Marchés : Canada" in titles("toronto")


def test_pages_les_titres_d_abord_et_quatre_au_plus():
    assert titles("marches")[0] == "Marchés"
    assert len(search.page_hits("e")) <= 4
    assert search.page_hits("") == [] and search.page_hits("   ") == []
    assert search.page_hits("zzzzzz") == []


def test_chaque_adresse_de_page_est_relative():
    assert all(address.startswith("./") for _, address, _ in search.PAGES)
    assert dict(search.page_hits("canada"))["Marchés : Canada"] == "./markets?view=canada"


# --- Le glossaire ----------------------------------------------------------------------------------


# --- Les valeurs connues du site, avant celles de Yahoo ----------------------------------------------


def test_valeurs_connues_par_debut_de_mot():
    assert [v["symbol"] for v in search.local_values("total")] == ["TTE.PA"]  # Yahoo : des fonds Vanguard
    assert search.local_values("royal")[0]["symbol"] == "RY.TO"
    assert search.local_values("ROYAL")[0]["exchange"] == "Toronto"
    assert search.local_values("cac")[0]["symbol"] == "^FCHI"
    assert search.local_values("") == [] and search.local_values("zzzz") == []


def test_valeurs_connues_quatre_au_plus_sans_doublon():
    hits = search.local_values("banque")
    assert 0 < len(hits) <= 4 and len({v["symbol"] for v in hits}) == len(hits)


def test_valeurs_connues_d_abord_puis_yahoo_sans_doublon():
    yahoo = [{"symbol": "TTE.PA", "name": "TotalEnergies SE", "exchange": "Paris"},
             {"symbol": "VTI", "name": "Vanguard Total Stock", "exchange": "NYSEArca"}]
    merged = search.merge_values(search.local_values("total"), yahoo)
    assert [v["symbol"] for v in merged] == ["TTE.PA", "VTI"]
    assert merged[0]["name"] == "TotalEnergies"  # le nom du site, pas celui de Yahoo


def test_glossaire_par_nom_de_terme():
    hits = search.glossary_hits("dividende")
    assert hits[0] == ("Dividende", GLOSSARY["Dividende"][1])
    assert search.glossary_hits("DIVIDENDE") == hits  # majuscules sans importance
    assert [term for term, _ in search.glossary_hits("capitalisation")][0] == "Capitalisation boursière"


def test_glossaire_cherche_le_nom_pas_la_definition():
    assert search.glossary_hits("zzzzzz") == []
    assert all("action" in normalize(term) for term, _ in search.glossary_hits("action"))
    assert len(search.glossary_hits("e")) <= 4


def test_definition_tronquee():
    assert search.shorten("Court.") == "Court."
    short = search.shorten(GLOSSARY["Action"][1])
    assert short.endswith("…") and len(short) <= 91


# --- Le rendu --------------------------------------------------------------------------------------


def test_resultats_en_groupes_sans_groupe_vide():
    html = search.results_html(VALUES, COINS, [("Simulateurs", "./simulators")], [("Dividende", "Part du bénéfice.")])
    for title in ["Valeurs", "Cryptomonnaies", "Pages du site", "Glossaire"]:
        assert f'aria-label="{title}"' in html
    for href in ["fiche?s=MC.PA", "fiche-crypto?c=bitcoin", "./simulators", "./glossary?q=Dividende"]:
        assert f'href="{href}"' in html
    only_pages = search.results_html([], [], [("Simulateurs", "./simulators")], [])
    assert "Pages du site" in only_pages and "Valeurs" not in only_pages and "Glossaire" not in only_pages
    assert search.results_html([], [], [], []) == ""


def test_le_terme_du_glossaire_est_encode_dans_l_adresse():
    html = search.results_html([], [], [], [("Bêta & co", "x")])
    assert 'href="./glossary?q=B%C3%AAta%20%26%20co"' in html


def test_resultats_echappes_et_sans_lien_javascript():
    trap = '<script>alert(1)</script>'
    html = search.results_html(
        [{"symbol": "X<b>", "name": trap, "exchange": trap}],
        [CoinHit(id="a", name=trap, symbol=trap, rank=1, thumb="javascript:alert(1)")],
        [(trap, "./a")], [(trap, trap)])
    assert "<script" not in html and "&lt;script&gt;" in html
    assert "javascript:" not in html  # la vignette douteuse est écartée
    assert "<img" not in html


def test_raccourcis_sans_saisie():
    html = search.shortcuts_html()
    for href in ["fiche?s=%5EFCHI", "fiche?s=XIU.TO", "fiche?s=%5EDJI", "fiche?s=%5EGSPC", "fiche?s=MC.PA",
                 "fiche?s=TTE.PA", "fiche?s=SHOP.TO", "fiche?s=RY.TO", "fiche?s=AAPL", "fiche?s=NVDA",
                 "fiche-crypto?c=bitcoin", "fiche-crypto?c=ethereum"]:
        assert f'href="{href}"' in html, href


# --- Le bouton et le dialogue (le site complet, données factices) ----------------------------------


def open_button(app):
    return next((b for b in app.button if b.key == "fvsearch_open"), None)


@pytest.mark.parametrize("page", ["views/feed.py", "views/markets.py", "views/glossary.py", "views/crypto.py"])
def test_le_bouton_rechercher_est_sur_chaque_page(app, page):
    app.run()
    app.switch_page(page).run()
    assert not app.exception
    button = open_button(app)
    assert button is not None and button.label == "Rechercher"


def test_le_bouton_cote_a_cote_avec_se_connecter(app, monkeypatch):
    monkeypatch.delenv("LOCAL_MODE")
    monkeypatch.setattr(ui, "current_user", lambda: None)
    app.run()
    assert not app.exception
    assert open_button(app) is not None
    assert any(link.label == "Se connecter" for link in app.get("page_link"))


def test_dialogue_sans_saisie_propose_des_raccourcis(app):
    app.run()
    open_button(app).click().run()
    assert not app.exception
    assert any("fiche?s=MC.PA" in element.value for element in app.get("html"))


def test_dialogue_avec_une_recherche(app, monkeypatch):
    monkeypatch.setattr(ui, "search_companies", lambda query: VALUES)
    monkeypatch.setattr(coins, "search_coins", lambda query: COINS)
    app.run()
    app.session_state["fvsearch_q"] = "simul"
    open_button(app).click().run()
    assert not app.exception
    html = "".join(element.value for element in app.get("html"))
    for href in ["fiche?s=MC.PA", "fiche-crypto?c=bitcoin", 'href="./simulators"']:
        assert href in html, href


def test_dialogue_cryptos_indisponibles(app, monkeypatch):
    monkeypatch.setattr(ui, "search_companies", lambda query: VALUES)
    monkeypatch.setattr(coins, "search_coins", lambda query: None)  # CoinGecko ne répond pas
    app.run()
    app.session_state["fvsearch_q"] = "lvmh"
    open_button(app).click().run()
    assert not app.exception
    html = "".join(element.value for element in app.get("html"))
    assert "fiche?s=MC.PA" in html and "La recherche des cryptos est indisponible" in html


def test_dialogue_sans_resultat(app, monkeypatch):
    monkeypatch.setattr(ui, "search_companies", lambda query: [])
    monkeypatch.setattr(coins, "search_coins", lambda query: [])
    app.run()
    app.session_state["fvsearch_q"] = "<qqqq>"
    open_button(app).click().run()
    assert not app.exception
    html = "".join(element.value for element in app.get("html"))
    assert "Rien trouvé pour « &lt;qqqq&gt; »" in html and "<qqqq>" not in html


def test_glossaire_prerempli_par_l_adresse(app):
    app.query_params["q"] = "Dividende"
    app.run()
    app.switch_page("views/glossary.py").run()
    assert not app.exception
    assert app.text_input(key="glossary_q").value == "Dividende"
