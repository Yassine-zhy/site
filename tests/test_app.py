"""Test « de fumée » : chaque page s'affiche sans erreur, avec des données factices (aucun réseau)."""

from pathlib import Path
from unittest import mock

import pandas as pd
import pytest
import streamlit as st
from streamlit.testing.v1 import AppTest

import ui
from conftest import make_article
from core import aggregator, macro, market
from core.market import Quote

ARTICLES = [
    make_article("Fed holds rates as inflation cools", summary="Le résumé.", source="CNBC", category="macro"),
    make_article("Nvidia shares rally to a record", source="Nasdaq", category="entreprises", hours_ago=2),
    make_article("Bitcoin rebounds", source="CoinDesk", category="crypto", hours_ago=3),
]
# Comme les vraies données : un historique indexé par des dates de séance
HISTORY = pd.Series([7700.0, 7729.7, 7803.3], index=pd.date_range("2026-10-07", periods=3, freq="D", tz="Europe/Paris"))
QUOTES = [Quote("^FCHI", "CAC 40", "Europe", "%", 7803.3, 7729.7, HISTORY)]


@pytest.fixture
def app(db, monkeypatch):
    st.cache_data.clear()
    monkeypatch.setattr(aggregator, "build_tasks", lambda keys: [("Test", lambda: list(ARTICLES), ())])
    def fake_quotes(watchlist=None, period="3mo"):
        """Le bandeau (sans argument) reçoit QUOTES ; une liste de symboles reçoit un cours factice pour chacun."""
        if watchlist is None:
            return QUOTES
        return [Quote(symbol, name, group, unit, 108.0, 107.0, HISTORY) for symbol, name, group, unit in watchlist]

    monkeypatch.setattr(ui, "fetch_quotes", fake_quotes)
    monkeypatch.setattr(aggregator, "fetch_yahoo_ticker_news", lambda ticker: [])
    closes = pd.DataFrame({"MC.PA": [100.0, 102, 101, 104, 108, 107], "RMS.PA": [200.0, 199, 204, 210, 205, 212],
                           "^FCHI": [7700.0, 7710, 7690, 7750, 7800, 7803]},
                          index=pd.date_range("2026-01-05", periods=6, freq="D"))
    monkeypatch.setattr(market, "closes_table", lambda symbols, period: closes[[s for s in symbols if s in closes]])
    monkeypatch.setattr(market, "company_profile", lambda symbol: {"shortName": symbol, "trailingPE": 20.0})
    monkeypatch.setattr(market, "company_calendar", lambda symbol: {})
    monkeypatch.setattr(market, "euro_rates", lambda: {"EUR": 1.0, "USD": 1.1})
    # Économie : une série mensuelle factice par indicateur, et des courbes des taux « normales »
    months = pd.date_range("2016-01-01", "2026-09-01", freq="MS")
    fake_macro = {i.key: pd.Series([2.0 + (n % 12) / 10 for n in range(len(months))], index=months)
                  for i in macro.INDICATORS}
    monkeypatch.setattr(macro, "fetch_all", lambda start, indicators=macro.INDICATORS: (fake_macro, []))
    days = pd.date_range("2024-10-01", "2026-10-08", freq="B")
    curve = pd.DataFrame({label: 2 + years / 10 for label, years, *_ in macro.MATURITIES}, index=days)
    monkeypatch.setattr(macro, "fetch_yield_curves", lambda start: {macro.US: curve, macro.EA: curve})
    with mock.patch.object(ui, "summarize") as fake_summary:
        fake_summary.return_value.to_dict.return_value = {
            "points": ["Point"], "why": None, "engine": "Résumé local", "based_on": "article complet", "note": None,
        }
        yield AppTest.from_file(str(Path(__file__).parent.parent / "app.py"), default_timeout=60)


@pytest.mark.parametrize("page", ["views/feed.py", "views/markets.py", "views/stats.py", "views/following.py",
                                  "views/favorites.py", "views/settings.py", "views/glossary.py", "views/compare.py",
                                  "views/portfolio.py", "views/alerts.py", "views/brief.py",
                                  "views/account.py", "views/economy.py"])
def test_chaque_page_s_affiche(app, page):
    app.run()
    app.switch_page(page).run()
    assert not app.exception


def test_garder_puis_retrouver_dans_les_favoris(app, db):
    app.run()
    next(b for b in app.button if b.label == "Garder").click().run()
    assert db.counts(db.LOCAL_USER)["favorites"] == 1
    app.switch_page("views/favorites.py").run()
    assert any(b.label == "Retirer" for b in app.button)


def test_resume_affiche(app):
    app.run()
    next(b for b in app.button if b.label == "Résumé").click().run()
    assert not app.exception
    assert any(b.label == "Fermer le résumé" for b in app.button)


def test_les_trois_vues_des_marches(app):
    app.run()
    app.switch_page("views/markets.py").run()
    for view in ["CAC 40", "Devises", "Monde"]:
        app.segmented_control(key="markets_view").set_value(view).run()
        assert not app.exception, view


def test_portefeuille_et_alertes_avec_des_donnees(app, db):
    db.add_position(db.LOCAL_USER, "MC.PA", "LVMH", 10, 95.0, "EUR", "2026-01-05")
    db.add_alert(db.LOCAL_USER, "MC.PA", "LVMH", "above", 50.0)  # déclenchée : le cours factice est 108
    app.run()
    assert not app.exception
    assert any("LVMH" in element.value for element in app.get("html"))  # le bandeau d'alerte est affiché
    app.switch_page("views/portfolio.py").run()
    assert not app.exception
    assert any("Mes positions" in element.value for element in app.get("html"))  # la valorisation s'affiche
    app.switch_page("views/alerts.py").run()
    assert not app.exception
    assert any("Déclenchée" in element.value for element in app.get("html"))


# --- Comptes utilisateurs : on simule la connexion en remplaçant les fonctions de ui.py -----------


def test_visiteur_non_connecte(app, monkeypatch):
    monkeypatch.setattr(ui, "auth_providers", lambda: ["google", "auth0"])
    monkeypatch.setattr(ui, "current_user", lambda: None)
    app.run()
    assert not app.exception
    assert not any(b.label == "Garder" for b in app.button)  # pas d'action personnelle sans compte
    assert any(b.label == "Résumé" for b in app.button)  # mais la lecture reste ouverte à tous
    for page in ["views/favorites.py", "views/following.py", "views/portfolio.py", "views/alerts.py",
                 "views/settings.py", "views/account.py"]:
        app.switch_page(page).run()
        assert not app.exception, page
        assert any(b.label == "Continuer avec Google" for b in app.button), page
        assert any(b.label == "E-mail, Google ou Facebook" for b in app.button), page
    for page in ["views/brief.py", "views/markets.py", "views/compare.py", "views/glossary.py", "views/stats.py"]:
        app.switch_page(page).run()  # les pages publiques s'affichent normalement
        assert not app.exception, page


def test_les_favoris_vont_dans_le_compte_connecte(app, db, monkeypatch):
    monkeypatch.setattr(ui, "auth_providers", lambda: ["google"])
    monkeypatch.setattr(ui, "current_user", lambda: "alice@example.com")
    app.run()
    next(b for b in app.button if b.label == "Garder").click().run()
    assert db.counts("alice@example.com")["favorites"] == 1
    assert db.counts(db.LOCAL_USER)["favorites"] == 0
    app.switch_page("views/account.py").run()
    assert not app.exception
    assert any(b.label == "Se déconnecter" for b in app.button)
