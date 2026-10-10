"""Test « de fumée » : chaque page s'affiche sans erreur, avec des données factices (aucun réseau)."""

from pathlib import Path
from unittest import mock

import pandas as pd
import pytest
import streamlit as st
from streamlit.testing.v1 import AppTest

import ui
from conftest import make_article
from core import aggregator
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
    monkeypatch.setattr(ui, "fetch_quotes", lambda *args, **kwargs: QUOTES)
    monkeypatch.setattr(aggregator, "fetch_yahoo_ticker_news", lambda ticker: [])
    with mock.patch.object(ui, "summarize") as fake_summary:
        fake_summary.return_value.to_dict.return_value = {
            "points": ["Point"], "why": None, "engine": "Résumé local", "based_on": "article complet", "note": None,
        }
        yield AppTest.from_file(str(Path(__file__).parent.parent / "app.py"), default_timeout=60)


@pytest.mark.parametrize("page", ["views/feed.py", "views/markets.py", "views/stats.py", "views/following.py",
                                  "views/favorites.py", "views/settings.py"])
def test_chaque_page_s_affiche(app, page):
    app.run()
    app.switch_page(page).run()
    assert not app.exception


def test_garder_puis_retrouver_dans_les_favoris(app, db):
    app.run()
    next(b for b in app.button if b.label == "Garder").click().run()
    assert db.counts()["favorites"] == 1
    app.switch_page("views/favorites.py").run()
    assert any(b.label == "Retirer" for b in app.button)


def test_resume_affiche(app):
    app.run()
    next(b for b in app.button if b.label == "Résumé").click().run()
    assert not app.exception
    assert any(b.label == "Fermer le résumé" for b in app.button)
