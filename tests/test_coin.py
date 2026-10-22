"""Fiche d'une cryptomonnaie : lecture des réponses de CoinGecko (réponses simulées, aucun réseau)."""

import json
from datetime import date, datetime, timezone

import pytest
import requests

from conftest import FIXTURES
from core import crypto


def payload(**changes):
    """Une réponse /coins/{id} simulée, avec les champs que la fiche lit."""
    data = {
        "id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "market_cap_rank": 1,
        "image": {"large": "https://example.com/btc.png"},
        "genesis_date": "2009-01-03",
        "categories": ["Layer 1 (L1)", "", "Proof of Work (PoW)"],
        "links": {"homepage": ["", "https://bitcoin.org"], "whitepaper": "https://bitcoin.org/bitcoin.pdf"},
        "description": {"en": "Bitcoin is <b>digital</b> money.", "fr": "Le Bitcoin est une <a href=\"x\">monnaie</a> en ligne."},
        "market_data": {
            "current_price": {"eur": 75000, "usd": 87000}, "market_cap": {"eur": 1.5e12}, "total_volume": {"eur": 2.8e10},
            "price_change_percentage_1h_in_currency": {"eur": -0.35},
            "price_change_percentage_24h_in_currency": {"eur": 1.7}, "price_change_percentage_24h": 1.9,
            "price_change_percentage_7d": 3.3,  # sans version « en euros » : on prend celle-ci
            "price_change_percentage_30d_in_currency": {"eur": -2.4}, "price_change_percentage_1y_in_currency": {"eur": -22.7},
            "ath": {"eur": 107662}, "ath_date": {"eur": "2025-10-06T10:57:42.000Z"}, "ath_change_percentage": {"eur": -30.3},
            "atl": {"eur": 51.3}, "atl_date": {"eur": "2013-07-04T16:00:00.000Z"}, "atl_change_percentage": {"eur": 143903.6},
            "circulating_supply": 20_098_843.0, "total_supply": 20_100_993.0, "max_supply": 21_000_000.0,
            "fully_diluted_valuation": {"eur": 1.6e12},
        },
    }
    data.update(changes)
    return data


def test_lecture_d_une_fiche_complete():
    coin = crypto.parse_coin(payload())
    assert (coin.id, coin.name, coin.symbol, coin.rank) == ("bitcoin", "Bitcoin", "BTC", 1)
    assert coin.price == 75000 and coin.market_cap == 1.5e12 and coin.volume == 2.8e10  # en euros, pas en dollars
    assert coin.fdv == 1.6e12 and coin.max_supply == 21_000_000 and coin.circulating > 2e7
    assert coin.image == "https://example.com/btc.png" and coin.created == date(2009, 1, 3)


def test_variations_en_euros_sinon_sans_devise():
    coin = crypto.parse_coin(payload())
    assert (coin.change_1h, coin.change_24h, coin.change_7d, coin.change_30d, coin.change_1y) == (-0.35, 1.7, 3.3, -2.4, -22.7)


def test_plus_haut_et_plus_bas_historiques():
    coin = crypto.parse_coin(payload())
    assert coin.ath == 107662 and coin.ath_change == -30.3
    assert coin.ath_date == datetime(2025, 10, 6, 10, 57, 42, tzinfo=timezone.utc)
    assert coin.atl == 51.3 and coin.atl_date.year == 2013


def test_description_en_francais_sinon_en_anglais():
    french = crypto.parse_coin(payload())
    assert french.description == "Le Bitcoin est une monnaie en ligne." and french.description_lang == "fr"
    english = crypto.parse_coin(payload(description={"en": "Only <i>English</i>.", "fr": ""}))
    assert english.description == "Only English." and english.description_lang == "en"
    none = crypto.parse_coin(payload(description={}))
    assert none.description == ""


def test_liens_et_categories_sans_valeurs_vides():
    coin = crypto.parse_coin(payload())
    assert coin.website == "https://bitcoin.org" and coin.whitepaper.endswith("bitcoin.pdf")
    assert coin.categories == ["Layer 1 (L1)", "Proof of Work (PoW)"]


def test_sans_offre_maximale_ni_donnees_de_marche():
    data = payload()
    data["market_data"]["max_supply"] = None
    assert crypto.parse_coin(data).max_supply is None
    bare = crypto.parse_coin({"id": "mystere", "name": "Mystère", "symbol": "mys", "genesis_date": None})
    assert bare.price is None and bare.change_24h is None and bare.ath_date is None and bare.created is None
    assert bare.categories == [] and bare.website == "" and bare.rank is None


def test_nettoyage_du_html_de_la_description():
    text = ("Qu'est-ce que le Bitcoin ? (BTC)\nUn <a href=\"https://x.org\" rel=\"nofollow\">lien</a> &amp; du "
            "texte.<br><br>Deuxi&egrave;me   paragraphe.\r\n\r\n<script>alert(1)</script>")
    cleaned = crypto.clean_description(text)
    assert cleaned == "Un lien & du texte.\n\nDeuxième paragraphe.\n\nalert(1)"  # le titre est écarté, les balises aussi
    assert "<" not in cleaned
    assert crypto.clean_description(None) == "" and crypto.clean_description("  ") == ""
    assert crypto.clean_description("Court.") == "Court."  # une seule ligne : jamais écartée


def test_conversion_du_graphique():
    points = crypto.parse_chart({"prices": [[1_700_000_060_000, 2.0], [1_700_000_000_000, 1.5], ["x", 1], [5], None]})
    assert [price for _, price in points] == [1.5, 2.0]  # trié, les lignes cassées sont ignorées
    assert points[0][0] == datetime.fromtimestamp(1_700_000_000, tz=timezone.utc)
    assert crypto.parse_chart({}) == []


def test_graphique_de_secours_yahoo(monkeypatch):
    def refuse(*args, **kwargs):
        raise requests.HTTPError("429")

    monkeypatch.setattr(requests, "get", refuse)
    monkeypatch.setattr(crypto, "_yahoo_chart", lambda symbol, days: [(datetime(2026, 1, 1, tzinfo=timezone.utc), 1.0)] * 2)
    assert len(crypto.fetch_chart("bitcoin", "max", "BTC")) == 2
    with pytest.raises(LookupError):  # pas de symbole : rien à demander à Yahoo
        crypto.fetch_chart("bitcoin", "max")


def test_recherche_triee_par_rang():
    hits = crypto.parse_search({"coins": [
        {"id": "obscur", "name": "Obscur", "symbol": "obs", "market_cap_rank": None, "thumb": ""},
        {"id": "pepe", "name": "Pepe", "symbol": "pepe", "market_cap_rank": 52, "thumb": "https://example.com/p.png"},
        {"name": "sans identifiant"},
        {"id": "ape-and-pepe", "name": "Ape and Pepe", "symbol": "apepe", "market_cap_rank": 163},
    ]})
    assert [h.id for h in hits] == ["pepe", "ape-and-pepe", "obscur"]
    assert hits[0].symbol == "PEPE" and crypto.parse_search({}) == []


def test_identifiant_dans_le_classement():
    coins = crypto.parse_markets(json.loads((FIXTURES / "coingecko_markets.json").read_text()))
    assert [c.id for c in coins] == ["bitcoin", "ethereum", "tether"]
    assert crypto.parse_markets([{"name": "Mini", "symbol": "min", "current_price": 1.5}])[0].id == ""


def test_dépêches_qui_parlent_d_une_crypto():
    assert crypto.mentions("Le Bitcoin repasse au-dessus de 75 000 €", "Bitcoin", "BTC")
    assert crypto.mentions("Les ETF sur BTC attirent les fonds", "Bitcoin", "BTC")
    assert crypto.mentions("Solana et ses SOL", "Solana", "SOL")
    assert not crypto.mentions("Les btc minés", "Bitcoin", "BTC")  # symbole en minuscules : pas le même mot
    assert not crypto.mentions("Les ordinateurs et le Bitcoiner", "Ether", "ETH")
    assert not crypto.mentions("Opération spéciale OP au Sénat", "Optimism", "OP")  # symbole trop court
