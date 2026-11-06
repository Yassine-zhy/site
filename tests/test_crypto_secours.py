"""Cryptomonnaies : les sources de secours de CoinGecko (CoinPaprika, CoinLore) avec des réponses simulées, sans réseau.

Les fichiers d'exemple sont de vraies réponses tronquées (tests/fixtures/paprika_*.json, coinlore_*.json, coinbase_rates.json).
"""

import json

import pytest
import requests

from conftest import FIXTURES
from core import crypto


def load(name):
    return json.loads((FIXTURES / name).read_text())


RATE = 0.8919926666666667  # euros pour un dollar, comme dans coinbase_rates.json


class Answers:
    """Un faux réseau : `crypto._get` rend la réponse enregistrée pour l'adresse demandée, ou lève l'erreur donnée."""

    def __init__(self, monkeypatch, **by_host):
        self.calls = []
        self.by_host = by_host  # « coingecko » : réponse ou exception ; une adresse inconnue lève une erreur réseau
        monkeypatch.setattr(crypto, "_get", self.get)

    def get(self, url, params=None, timeout=crypto.TIMEOUT):
        self.calls.append((url, params, timeout))
        for host, answer in self.by_host.items():
            if host in url:
                if isinstance(answer, BaseException):
                    raise answer
                return answer(url) if callable(answer) else answer
        raise requests.ConnectionError(url)


DOWN = requests.HTTPError("429 Too Many Requests")


# --- Les parseurs ------------------------------------------------------------------------------------------

def test_lecture_du_classement_coinpaprika():
    coins = crypto.parse_paprika_markets(load("paprika_tickers.json"))
    assert [c.symbol for c in coins] == ["BTC", "ETH", "USDT"]  # la ligne sans cours est ignorée
    bitcoin = coins[0]
    assert (bitcoin.rank, bitcoin.name, bitcoin.id, bitcoin.source) == (1, "Bitcoin", "bitcoin", "CoinPaprika")
    assert bitcoin.price == pytest.approx(67788.74, abs=0.01) and bitcoin.market_cap > 1e12  # déjà en euros
    assert bitcoin.change_24h == -5.77 and bitcoin.change_7d == -2.36 and bitcoin.change_30d == -8.61
    assert bitcoin.from_ath == -39.84
    assert bitcoin.image == "" and bitcoin.sparkline == []
    assert coins[1].id == "ethereum"


def test_identifiant_coingecko_derive_de_celui_de_coinpaprika():
    rows = [{"id": "bnb-binance-coin", "name": "BNB", "symbol": "bnb", "quotes": {"EUR": {"price": 500}}},
            {"id": "wsteth-wrapped-liquid-staked-ether-20", "name": "W", "symbol": "w", "quotes": {"EUR": {"price": 1}}},
            {"name": "Sans identifiant", "symbol": "x", "quotes": {"EUR": {"price": 1}}}]
    assert [c.id for c in crypto.parse_paprika_markets(rows)] == ["binance-coin", "wrapped-liquid-staked-ether-20", ""]


def test_champ_manquant_coinpaprika_ne_fait_pas_planter():
    coins = crypto.parse_paprika_markets([{"name": "Mini", "symbol": "min", "quotes": {"EUR": {"price": 1.5}}}])
    assert coins[0].change_24h is None and coins[0].from_ath is None and coins[0].market_cap == 0
    assert coins[0].rank == 1 and coins[0].id == ""
    assert crypto.parse_paprika_markets([]) == [] and crypto.parse_paprika_markets({"error": "limite"}) == []
    assert crypto.parse_paprika_markets([{"name": "Sans devise", "quotes": {"USD": {"price": 1}}}]) == []


def test_lecture_du_classement_coinlore_converti_en_euros():
    coins = crypto.parse_coinlore_markets(load("coinlore_tickers.json"), RATE)
    assert [c.symbol for c in coins] == ["BTC", "ETH", "USDT"]
    bitcoin = coins[0]
    assert (bitcoin.rank, bitcoin.name, bitcoin.id, bitcoin.source) == (1, "Bitcoin", "bitcoin", "CoinLore")
    assert bitcoin.price == pytest.approx(76045.71 * RATE)  # les dollars deviennent des euros
    assert bitcoin.market_cap == pytest.approx(1518697651177.80 * RATE)
    assert bitcoin.volume == pytest.approx(124439407313.53503 * RATE)
    assert bitcoin.change_24h == -5.67 and bitcoin.change_7d == -6.47  # des pourcentages : pas convertis
    assert bitcoin.change_30d is None and bitcoin.from_ath is None and bitcoin.image == "" and bitcoin.sparkline == []


def test_champ_manquant_coinlore_ne_fait_pas_planter():
    coins = crypto.parse_coinlore_markets({"data": [{"name": "Mini", "symbol": "min", "price_usd": "2", "rank": 0,
                                                     "percent_change_24h": "n/a"}, {"name": "Sans cours"}]}, 0.5)
    assert len(coins) == 1 and coins[0].price == 1.0 and coins[0].rank == 1
    assert coins[0].change_24h is None and coins[0].market_cap == 0 and coins[0].id == ""
    assert crypto.parse_coinlore_markets({}, 0.9) == [] and crypto.parse_coinlore_markets(None, 0.9) == []


def test_taux_dollar_euro_de_coinbase():
    assert crypto.parse_usd_eur(load("coinbase_rates.json")) == pytest.approx(RATE)
    assert crypto.parse_usd_eur({"data": {"rates": {"GBP": "0.7"}}}) is None
    assert crypto.parse_usd_eur({"data": {"rates": {"EUR": "0"}}}) is None
    assert crypto.parse_usd_eur({}) is None


def test_chiffres_du_marche_coinpaprika_en_euros():
    overview = crypto.parse_paprika_global(load("paprika_global.json"), RATE)
    assert overview["market_cap"] == pytest.approx(2673548896297 * RATE)
    assert overview["volume"] == pytest.approx(153722597798 * RATE)
    assert overview["change_24h"] == -5.38 and overview["btc_dominance"] == 57.09
    assert overview["eth_dominance"] is None and overview["coins"] == 12028  # CoinPaprika ne donne pas l'ether
    assert crypto.parse_paprika_global({}, RATE)["market_cap"] == 0


def test_chiffres_du_marche_coinlore_en_euros():
    overview = crypto.parse_coinlore_global(load("coinlore_global.json"), RATE)
    assert overview["market_cap"] == pytest.approx(2554608586930.525 * RATE)
    assert overview["change_24h"] == -5.08 and overview["btc_dominance"] == 59.45 and overview["eth_dominance"] == 10.72
    assert overview["coins"] == 14993
    assert crypto.parse_coinlore_global([], RATE)["market_cap"] == 0 and crypto.parse_coinlore_global({}, RATE)["coins"] is None


def test_coingecko_garde_sa_source_par_defaut():
    assert crypto.parse_markets([{"name": "Mini", "symbol": "min", "current_price": 1.5}])[0].source == "CoinGecko"
    assert crypto.parse_coin({"id": "x"}).source == "CoinGecko"


# --- La chaîne de secours ----------------------------------------------------------------------------------

def test_classement_coingecko_d_abord(monkeypatch):
    gecko = load("coingecko_markets.json")
    net = Answers(monkeypatch, coingecko=gecko)
    coins = crypto.fetch_markets(3)
    assert {c.source for c in coins} == {"CoinGecko"} and len(net.calls) == 1
    assert net.calls[0][2] == crypto.TIMEOUT_SECOURS  # un délai court : des secours attendent


def test_classement_coingecko_en_panne_coinpaprika_prend_le_relais(monkeypatch):
    net = Answers(monkeypatch, coingecko=DOWN, coinpaprika=load("paprika_tickers.json"))
    coins = crypto.fetch_markets(20)
    assert [c.source for c in coins] == ["CoinPaprika"] * 3 and coins[0].price > 60000
    url, params, timeout = net.calls[1]
    assert url.endswith("/tickers") and params == {"quotes": "EUR", "limit": 20} and timeout == crypto.TIMEOUT_SECOURS
    assert not any("coinlore" in call[0] for call in net.calls)


@pytest.mark.parametrize("coingecko", [DOWN, ValueError("pas du JSON"), []])
def test_classement_coingecko_illisible_ou_vide_donne_le_secours(monkeypatch, coingecko):
    Answers(monkeypatch, coingecko=coingecko, coinpaprika=load("paprika_tickers.json"))
    assert crypto.fetch_markets()[0].source == "CoinPaprika"


def test_classement_coinlore_converti_quand_les_deux_premiers_echouent(monkeypatch):
    net = Answers(monkeypatch, coingecko=DOWN, coinpaprika=requests.ConnectionError("hors ligne"),
                  coinbase=load("coinbase_rates.json"), coinlore=load("coinlore_tickers.json"))
    coins = crypto.fetch_markets(20)
    assert [c.source for c in coins] == ["CoinLore"] * 3
    assert coins[0].price == pytest.approx(76045.71 * RATE)  # en euros
    lore = [call for call in net.calls if "coinlore" in call[0]][0]
    assert lore[1] == {"start": 0, "limit": 20}


def test_classement_coinlore_abandonne_sans_taux(monkeypatch):
    net = Answers(monkeypatch, coingecko=DOWN, coinpaprika=DOWN, coinbase={"data": {"rates": {}}},
                  coinlore=load("coinlore_tickers.json"))
    with pytest.raises(requests.HTTPError):  # l'erreur de CoinGecko remonte
        crypto.fetch_markets()
    assert not any("coinlore" in call[0] for call in net.calls)  # sans taux, CoinLore n'est même pas interrogé


def test_classement_tout_en_panne_l_erreur_de_coingecko_remonte(monkeypatch):
    Answers(monkeypatch, coingecko=DOWN)  # le reste : erreur réseau
    with pytest.raises(requests.HTTPError, match="429"):
        crypto.fetch_markets()


def test_chiffres_du_marche_chaine_de_secours(monkeypatch):
    Answers(monkeypatch, coingecko=load("coingecko_global.json"))
    assert crypto.fetch_global()["eth_dominance"] is not None

    Answers(monkeypatch, coingecko=DOWN, coinbase=load("coinbase_rates.json"), coinpaprika=load("paprika_global.json"))
    overview = crypto.fetch_global()
    assert overview["market_cap"] == pytest.approx(2673548896297 * RATE) and overview["eth_dominance"] is None

    Answers(monkeypatch, coingecko=DOWN, coinpaprika=DOWN, coinbase=load("coinbase_rates.json"),
            coinlore=load("coinlore_global.json"))
    assert crypto.fetch_global()["market_cap"] == pytest.approx(2554608586930.525 * RATE)

    Answers(monkeypatch, coingecko=DOWN, coinpaprika=DOWN, coinbase=load("coinbase_rates.json"))
    with pytest.raises(requests.HTTPError):
        crypto.fetch_global()
    Answers(monkeypatch, coingecko=DOWN, coinpaprika=load("paprika_global.json"))  # pas de taux : rien à convertir
    with pytest.raises(requests.HTTPError):
        crypto.fetch_global()


def test_mention_de_la_source():
    assert crypto.source_label("CoinGecko") == "CoinGecko"
    assert crypto.source_label("CoinPaprika") == "CoinPaprika, CoinGecko indisponible"
    assert crypto.source_label("CoinLore") == "CoinLore, CoinGecko indisponible"


# --- La fiche d'une cryptomonnaie --------------------------------------------------------------------------

def test_lecture_de_la_fiche_coinpaprika():
    coin = crypto.parse_paprika_coin(load("paprika_ticker.json"), load("paprika_coin.json"), "bitcoin")
    assert (coin.id, coin.name, coin.symbol, coin.rank, coin.source) == ("bitcoin", "Bitcoin", "BTC", 1, "CoinPaprika")
    assert coin.price > 60000 and coin.market_cap > 1e12 and coin.volume > 1e9
    assert coin.change_1h == -0.05 and coin.change_24h == -5.86 and coin.change_1y == -22.89
    assert coin.ath > 100000 and coin.ath_change == -39.84 and coin.ath_date.year == 2025
    assert coin.max_supply == 21_000_000 and coin.total_supply > 2e7
    assert coin.atl is None and coin.circulating is None and coin.fdv is None
    assert coin.website == "https://bitcoin.org/" and coin.whitepaper.endswith("whitepaper.pdf")
    assert coin.created.year == 2009 and coin.categories[0] == "Segwit" and coin.image.endswith("logo.png")
    assert coin.description.startswith("Bitcoin (BTC) is a decentralized") and coin.description_lang == "en"


def test_fiche_coinpaprika_sans_description_ni_donnees():
    coin = crypto.parse_paprika_coin(load("paprika_ticker.json"), None)
    assert coin.id == "bitcoin" and coin.description == "" and coin.categories == [] and coin.website == ""
    assert coin.created is None and coin.image == "" and coin.price > 0
    bare = crypto.parse_paprika_coin({"id": "xyz-mystere", "name": "Mystère", "symbol": "xyz"}, {})
    assert bare.price is None and bare.change_24h is None and bare.ath_date is None and bare.rank is None
    assert crypto.parse_paprika_coin({}, None).id == ""


class FakeResponse:
    def __init__(self, status=200, payload=None):
        self.status_code, self._payload = status, payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(str(self.status_code))

    def json(self):
        return self._payload


def paprika_answers(url):
    if "/search/" in url:
        return load("paprika_search.json")
    if "/tickers/" in url:
        return load("paprika_ticker.json")
    return load("paprika_coin.json")


def test_fiche_de_secours_quand_coingecko_refuse(monkeypatch):
    monkeypatch.setattr(requests, "get", lambda *a, **k: FakeResponse(429))
    net = Answers(monkeypatch, coinpaprika=paprika_answers)
    coin = crypto.fetch_coin("bitcoin")
    assert coin.source == "CoinPaprika" and coin.id == "bitcoin" and coin.price > 0
    assert net.calls[0][1]["q"] == "bitcoin" and net.calls[0][2] == crypto.TIMEOUT_SECOURS


def test_fiche_de_secours_trouvee_dans_les_premiers_du_classement(monkeypatch):
    """« binance-coin » : la recherche de CoinPaprika ne sait pas le trouver (elle ignore les tirets)."""
    monkeypatch.setattr(requests, "get", lambda *a, **k: FakeResponse(404))
    bnb = {"id": "bnb-binance-coin", "name": "BNB", "symbol": "BNB", "rank": 4, "quotes": {"EUR": {"price": 500.0}}}

    def paprika(url):
        if "/search/" in url:
            return {"currencies": []}
        if url.endswith("/tickers"):
            return [load("paprika_ticker.json"), bnb]
        raise requests.ConnectionError(url)  # pas de description : la fiche se contente du cours

    Answers(monkeypatch, coinpaprika=paprika)
    coin = crypto.fetch_coin("binance-coin")
    assert (coin.id, coin.name, coin.price, coin.description, coin.source) == ("binance-coin", "BNB", 500.0, "", "CoinPaprika")


def test_fiche_coingecko_d_abord(monkeypatch):
    monkeypatch.setattr(requests, "get", lambda *a, **k: FakeResponse(200, {"id": "bitcoin", "name": "Bitcoin"}))
    net = Answers(monkeypatch)
    coin = crypto.fetch_coin("bitcoin")
    assert coin.source == "CoinGecko" and net.calls == []


def test_fiche_sans_secours_l_erreur_de_coingecko_remonte(monkeypatch):
    monkeypatch.setattr(requests, "get", lambda *a, **k: FakeResponse(429))
    Answers(monkeypatch)  # CoinPaprika est aussi hors ligne
    with pytest.raises(requests.HTTPError, match="429"):
        crypto.fetch_coin("bitcoin")
    monkeypatch.setattr(requests, "get", lambda *a, **k: FakeResponse(404))
    Answers(monkeypatch, coinpaprika={"currencies": []})  # CoinPaprika ne la connaît pas non plus
    with pytest.raises(crypto.UnknownCoin):
        crypto.fetch_coin("inconnue")
