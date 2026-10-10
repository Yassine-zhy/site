"""Cryptomonnaies : lecture des réponses de CoinGecko et d'alternative.me (fichiers d'exemple, aucun réseau)."""

import json

from conftest import FIXTURES
from core import crypto


def load(name):
    return json.loads((FIXTURES / name).read_text())


def test_lecture_du_classement_coingecko():
    coins = crypto.parse_markets(load("coingecko_markets.json"))
    assert [c.symbol for c in coins] == ["BTC", "ETH", "USDT"]  # la ligne sans cours est ignorée
    bitcoin = coins[0]
    assert bitcoin.rank == 1 and bitcoin.name == "Bitcoin" and bitcoin.price > 0
    assert bitcoin.change_7d is not None and bitcoin.from_ath < 0
    assert len(bitcoin.sparkline) > 10


def test_un_champ_manquant_ne_fait_pas_planter():
    coins = crypto.parse_markets([{"name": "Mini", "symbol": "min", "current_price": 1.5}])
    assert coins[0].change_24h is None and coins[0].sparkline == [] and coins[0].market_cap == 0


def test_lecture_des_chiffres_du_marche():
    overview = crypto.parse_global(load("coingecko_global.json"))
    assert overview["market_cap"] > 1e12  # en euros
    assert 0 < overview["btc_dominance"] < 100
    assert crypto.parse_global({}) ["market_cap"] == 0


def test_indice_peur_et_avidite_trie_et_traduit():
    points = crypto.parse_fear_greed(load("fear_greed.json"))
    assert [(value, label) for _, value, label in points] == [(20, "Peur extrême"), (64, "Avidité")]  # « oops » ignoré
    assert points[0][0] < points[1][0]  # du plus ancien au plus récent


def test_libelles_selon_les_seuils():
    assert [crypto.fear_greed_label(v) for v in (10, 30, 50, 60, 90)] == [
        "Peur extrême", "Peur", "Neutre", "Avidité", "Avidité extrême"]
