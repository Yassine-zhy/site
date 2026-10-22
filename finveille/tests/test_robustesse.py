"""Robustesse : entrées d'adresse hostiles, données absentes ou aberrantes, pannes de source."""

import math
from datetime import datetime, timezone

import pandas as pd
import pytest

import coins
import ui
from core import aggregator, company, crypto, market, sources
from test_app import app  # noqa: F401  (la fixture de l'application)
from test_fiche import yahoo  # noqa: F401  (Yahoo simulé)


def open_page(app, page, **params):
    for key, value in params.items():
        app.query_params[key] = value
    app.run()
    app.switch_page(page).run()
    return app


def quote(last, previous, history=(1.0, 2.0), unit="%"):
    return market.Quote("X", "X", "g", unit, last, previous, pd.Series(history, dtype=float))


# 1, 2, 13 : la fiche

def test_fiche_indice_historique_que_des_nan(app, monkeypatch, yahoo):
    days = pd.bdate_range(end=pd.Timestamp.today().normalize(), periods=300, tz="Europe/Paris")
    monkeypatch.setattr(market, "price_history", lambda symbol, period="6mo": pd.DataFrame({"Close": [math.nan] * len(days)}, index=days))
    monkeypatch.setattr(market, "company_profile", lambda symbol: {"shortName": symbol, "quoteType": "INDEX"})
    assert not open_page(app, "views/quote.py", s="^XYZ").exception


@pytest.mark.parametrize("value", ["Infinity", math.inf, -math.inf, math.nan, True, None, [1]])
def test_indicateur_non_numerique(value):
    import sheet
    assert all(sheet.format_indicator(value, kind, "EUR") == "—" for kind in ("money", "x", "pct", "ratio", "n"))


def test_indicateur_numerique():
    import sheet
    assert sheet.format_indicator(3, "x", "EUR").endswith("×")


def test_resultats_sans_devise(app, monkeypatch, yahoo):
    import sheet
    rows = [{"year": 2025, "revenue": 5e9, "net": 1e9, "margin": 20.0}]
    monkeypatch.setattr(sheet, "load_income", lambda symbol: rows)
    monkeypatch.setattr(market, "company_profile", lambda symbol: {"shortName": "Z", "quoteType": "EQUITY"})
    assert not open_page(app, "views/quote.py", s="ZZ").exception
    assert "None" not in "".join(str(e.value) for e in app.get("html"))


# 3 : cours nul au départ

def test_crypto_premier_cours_nul(app, monkeypatch):
    pts = [(datetime(2026, 1, 1, tzinfo=timezone.utc), 0.0), (datetime(2026, 1, 2, tzinfo=timezone.utc), 1.0)]
    monkeypatch.setattr(crypto, "fetch_coin", lambda cid: crypto.parse_coin(
        {"id": "x", "name": "X", "symbol": "x", "market_data": {"current_price": {"eur": 1}}}))
    monkeypatch.setattr(crypto, "fetch_chart", lambda *a, **k: pts)
    assert not open_page(app, "views/coin.py", c="x").exception


# 4 : Yahoo lève, le secours prend le relais

def test_profil_en_erreur_secours(monkeypatch):
    def boom(symbol):
        raise RuntimeError("429")
    monkeypatch.setattr(market, "company_profile", boom)
    monkeypatch.setattr(company, "_from_metadata", lambda symbol: {"shortName": "secours"})
    assert company.fetch_overview("AAPL") == {"shortName": "secours"}


# 5 : le titre ne ferme pas la balise script

def test_titre_sans_fermeture_de_script(app, monkeypatch, yahoo):
    monkeypatch.setattr(market, "company_profile", lambda symbol: {
        "shortName": 'AB</script><img src=x onerror=alert(1)>', "quoteType": "EQUITY", "currency": "EUR"})
    open_page(app, "views/quote.py", s="ZZ")
    scripts = [h.value for h in app.get("html") if "document.title" in h.value]
    assert scripts and not any("</script><img" in s or "<img" in s for s in scripts)


# 6 : le Markdown venu de l'adresse est neutralisé

def test_symbole_inconnu_pas_de_lien_markdown(app, monkeypatch):
    monkeypatch.setattr(market, "company_profile", lambda symbol: {})
    monkeypatch.setattr(market, "price_history", lambda symbol, period="6mo": pd.DataFrame())
    monkeypatch.setattr(company, "_from_metadata", lambda symbol: {})
    open_page(app, "views/quote.py", s="X[clique](https://evil.example)")
    # le symbole invalide est refusé avant : plus de message avec lien
    assert not any("](" in w.value and "`" not in w.value for w in app.warning)


def test_md_code():
    import theme
    out = theme.md_code("a`b[x](https://evil.example)" + "z" * 80)
    assert out.startswith("`") and out.endswith("`") and out.count("`") == 2 and len(out) <= 42


def test_coin_inconnu_message_protege(app, monkeypatch):
    monkeypatch.setattr(coins, "valid_id", lambda c: True)  # force le chemin « inconnu » avec un id hostile
    monkeypatch.setattr(coins, "load_coin", lambda c: (None, coins.UNKNOWN))
    open_page(app, "views/coin.py", c="[clique](https://evil.example)")
    texts = [w.value for w in app.warning]
    assert texts and all("`[clique]" in t for t in texts)


# 7 : entrées bornées et cache négatif

def test_symbole_borne_et_filtre():
    assert company.normalize_symbol("x" * 50) == "X" * 20
    assert company.normalize_symbol("MC.PA") == "MC.PA" and company.normalize_symbol("^FCHI") == "^FCHI"
    assert company.normalize_symbol("EURUSD=X") == "EURUSD=X"
    for bad in ["A B", "<b>", "[x](y)", "A/B", "../..", "A&B"]:
        assert company.normalize_symbol(bad) == ""


def test_identifiant_coingecko(monkeypatch):
    assert coins.valid_id("bitcoin") and coins.valid_id("a-b-1")
    assert not coins.valid_id("A") and not coins.valid_id("a.b") and not coins.valid_id("a_b")
    assert not coins.valid_id("a" * 65) and not coins.valid_id("")
    calls = []
    monkeypatch.setattr(crypto, "fetch_coin", lambda cid: calls.append(cid))
    assert coins.load_coin("../..") == (None, coins.UNKNOWN) and not calls


def test_cache_negatif_inconnu(monkeypatch):
    ui.UNKNOWN._items.clear()
    ui.LAST_GOOD._items.clear()
    calls = []

    def fetch(x):
        calls.append(x)
        raise LookupError("réponse vide")

    for _ in range(3):
        assert ui._resilient("t", fetch, "zz", empty={}) == {}
    assert calls == ["zz"] and ui.LAST_GOOD.get("t|('zz',)") is None


def test_inconnu_none_pas_dans_last_good():
    ui.UNKNOWN._items.clear()
    ui.LAST_GOOD._items.clear()
    calls = []
    for _ in range(3):
        assert ui._resilient("c", lambda x: calls.append(x), "inconnu", empty=False) is None
    assert len(calls) == 1 and len(ui.LAST_GOOD) == 0


def test_erreur_reseau_pas_retenue():
    ui.UNKNOWN._items.clear()
    calls = []

    def fetch(x):
        calls.append(x)
        raise ConnectionError

    ui._resilient("e", fetch, "a", empty=None)
    ui._resilient("e", fetch, "a", empty=None)
    assert len(calls) == 2  # une panne est réessayée à chaque fois


# 8 : le ticker est encodé

def test_ticker_encode_dans_l_url(monkeypatch):
    seen = []
    monkeypatch.setattr(sources, "fetch_rss", lambda feed: seen.append(feed["url"]) or [])
    sources.fetch_yahoo_ticker_news("A&region=ZZ#x")
    assert "s=A%26region%3DZZ%23x&region=US" in seen[0]


# 9 : un flux mal formé ne fait pas tomber les autres

def test_flux_mal_forme_isole():
    def bad():
        raise KeyError("parsing")
    articles, error = aggregator._run(("Mauvais", bad, ()))
    assert articles == [] and error and "Mauvais" in error


# 10 : cours à zéro

def test_variation_cours_nul():
    assert quote(5.0, 0.0).change == 0.0
    assert quote(5.0, 1.0, history=(0.0, 0.0)).change_over(1) == 0.0
    assert quote(5.0, 4.0).change == pytest.approx(25.0)


def test_fiche_cours_precedent_nul(app, monkeypatch, yahoo):
    days = pd.bdate_range(end=pd.Timestamp.today().normalize(), periods=300, tz="Europe/Paris")
    values = [0.0, 0.0] + [5.0] * (len(days) - 2)
    monkeypatch.setattr(market, "price_history", lambda symbol, period="6mo": pd.DataFrame({"Close": values[::-1]}, index=days))
    monkeypatch.setattr(market, "company_profile", lambda symbol: {"shortName": symbol, "quoteType": "INDEX"})
    assert not open_page(app, "views/quote.py", s="^XYZ").exception


# 11 : hausses et baisses

def test_top_moves_signes():
    def q(last):  # change_over lit l'historique : [veille, jour]
        return quote(last, 100, history=(100.0, float(last)))
    ups, downs = market.top_moves([q(101), q(102)])
    assert len(ups) == 2 and downs == []
    ups, downs = market.top_moves([q(99), q(98)])
    assert ups == [] and len(downs) == 2 and downs[0][0] <= downs[1][0]
