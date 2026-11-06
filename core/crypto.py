"""Cryptomonnaies : cours et capitalisations (CoinGecko, avec deux secours) et indice de sentiment « peur et avidité ».

API publiques, gratuites et sans clé :
- CoinGecko (https://www.coingecko.com/api) : les 20 premières cryptomonnaies par capitalisation, en euros ;
- CoinPaprika (https://api.coinpaprika.com) puis CoinLore (https://api.coinlore.net) : les secours quand CoinGecko
  refuse ou ne répond pas. CoinPaprika sait donner les cours en euros ; CoinLore ne les donne qu'en dollars, convertis
  avec le taux de Coinbase (https://api.coinbase.com/v2/exchange-rates) ;
- alternative.me (https://alternative.me/crypto/fear-and-greed-index/) : l'indice Crypto Fear & Greed, de 0
  (peur extrême) à 100 (avidité extrême), calculé chaque jour à partir de la volatilité, des volumes, des
  réseaux sociaux et de la dominance du bitcoin.

L'offre gratuite de CoinGecko limite le nombre de requêtes par minute : l'interface les garde en cache, et les
secours prennent le relais quand la limite est atteinte.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from urllib.parse import quote

import requests

COINGECKO = "https://api.coingecko.com/api/v3"
COINPAPRIKA = "https://api.coinpaprika.com/v1"
COINLORE = "https://api.coinlore.net/api"
COINBASE_RATES = "https://api.coinbase.com/v2/exchange-rates"
FEAR_GREED = "https://api.alternative.me/fng/"
TIMEOUT = 15
TIMEOUT_SECOURS = 8  # quand un secours existe : trois délais de 15 s feraient attendre près d'une minute
# Ce qui fait passer au secours suivant (réseau, limite atteinte, réponse illisible ou vide)
PANNES = (requests.RequestException, ValueError, LookupError, KeyError, TypeError, AttributeError)

FEAR_GREED_LABELS = {
    "Extreme Fear": "Peur extrême",
    "Fear": "Peur",
    "Neutral": "Neutre",
    "Greed": "Avidité",
    "Extreme Greed": "Avidité extrême",
}


@dataclass
class Coin:
    rank: int
    name: str
    symbol: str
    image: str
    price: float  # en euros
    market_cap: float
    volume: float  # volume échangé sur 24 h
    change_24h: float | None  # en %
    change_7d: float | None
    change_30d: float | None
    from_ath: float | None  # écart avec le plus haut historique, en %
    sparkline: list[float]  # cours horaires sur 7 jours
    id: str = ""  # identifiant CoinGecko (« bitcoin ») : il sert aux liens vers la fiche
    source: str = "CoinGecko"  # d'où viennent les cours : CoinGecko, ou l'un des secours


def _get(url: str, params: dict | None = None, timeout: float = TIMEOUT):
    response = requests.get(url, params=params, timeout=timeout)
    response.raise_for_status()
    return response.json()


def source_label(source: str) -> str:
    """La source des cours pour l'affichage : « CoinGecko », ou « CoinPaprika, CoinGecko indisponible »."""
    return source if source in ("", "CoinGecko") else f"{source}, CoinGecko indisponible"


def _first_answer(*attempts):
    """Essaie chaque source à son tour (des fonctions sans argument) : la première qui donne quelque chose gagne.

    Si toutes échouent, l'erreur de la première (CoinGecko) remonte, comme avant l'arrivée des secours.
    """
    first = None
    for attempt in attempts:
        try:
            answer = attempt()
            if answer:
                return answer
            error = LookupError("réponse vide")
        except PANNES as caught:
            error = caught
        first = first or error
    raise first


def _float(value) -> float | None:
    """Un nombre lu dans une réponse (CoinLore donne ses chiffres en texte : « 76045.71 »), ou None."""
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and abs(number) != float("inf") else None


def _gecko_id(identifier: str | None) -> str:
    """L'identifiant CoinPaprika (« btc-bitcoin ») → celui de CoinGecko (« bitcoin ») : la partie après le premier tiret."""
    identifier = identifier or ""
    return identifier.split("-", 1)[1] if "-" in identifier else identifier


def parse_usd_eur(payload: dict) -> float | None:
    """Réponse de Coinbase → euros pour un dollar, ou None si le taux manque."""
    rate = _float(((payload or {}).get("data") or {}).get("rates", {}).get("EUR"))
    return rate if rate and rate > 0 else None


def fetch_usd_eur() -> float:
    """Le taux dollar → euro de Coinbase ; LookupError s'il manque (les secours en dollars sont alors abandonnés)."""
    rate = parse_usd_eur(_get(COINBASE_RATES, {"currency": "USD"}, TIMEOUT_SECOURS))
    if rate is None:
        raise LookupError("taux dollar-euro introuvable")
    return rate


def parse_markets(rows: list[dict]) -> list[Coin]:
    """Réponse de /coins/markets → liste de Coin. Les champs absents deviennent None (jamais d'erreur)."""
    coins = []
    for row in rows:
        if row.get("current_price") is None:
            continue
        coins.append(Coin(
            rank=row.get("market_cap_rank") or len(coins) + 1,
            name=row.get("name", ""),
            symbol=(row.get("symbol") or "").upper(),
            image=row.get("image") or "",
            price=float(row["current_price"]),
            market_cap=float(row.get("market_cap") or 0),
            volume=float(row.get("total_volume") or 0),
            change_24h=row.get("price_change_percentage_24h_in_currency"),
            change_7d=row.get("price_change_percentage_7d_in_currency"),
            change_30d=row.get("price_change_percentage_30d_in_currency"),
            from_ath=row.get("ath_change_percentage"),
            sparkline=[float(p) for p in (row.get("sparkline_in_7d") or {}).get("price", []) if p is not None],
            id=row.get("id") or "",
        ))
    return coins


def parse_paprika_markets(rows: list[dict]) -> list[Coin]:
    """Réponse de CoinPaprika /tickers?quotes=EUR → liste de Coin (déjà en euros, triée par rang).

    Les champs absents deviennent None (jamais d'erreur) ; CoinPaprika ne donne ni image ni courbe sur 7 jours.
    """
    coins = []
    for row in rows if isinstance(rows, list) else []:
        quote = ((row.get("quotes") or {}).get("EUR") or {}) if isinstance(row, dict) else {}
        price = _float(quote.get("price"))
        if price is None:
            continue
        coins.append(Coin(
            rank=row.get("rank") or len(coins) + 1,
            name=row.get("name") or "",
            symbol=(row.get("symbol") or "").upper(),
            image="",
            price=price,
            market_cap=_float(quote.get("market_cap")) or 0.0,
            volume=_float(quote.get("volume_24h")) or 0.0,
            change_24h=_float(quote.get("percent_change_24h")),
            change_7d=_float(quote.get("percent_change_7d")),
            change_30d=_float(quote.get("percent_change_30d")),
            from_ath=_float(quote.get("percent_from_price_ath")),
            sparkline=[],
            id=_gecko_id(row.get("id")),
            source="CoinPaprika",
        ))
    return coins


def parse_coinlore_markets(payload: dict, usd_eur: float) -> list[Coin]:
    """Réponse de CoinLore /tickers → liste de Coin, ses montants en dollars convertis en euros avec `usd_eur`.

    CoinLore ne donne ni la variation sur 30 jours ni l'écart au plus haut (None), ni image ni courbe sur 7 jours.
    """
    rows = payload.get("data") if isinstance(payload, dict) else payload
    coins = []
    for row in rows if isinstance(rows, list) else []:
        dollars = _float(row.get("price_usd")) if isinstance(row, dict) else None
        if dollars is None:
            continue
        coins.append(Coin(
            rank=int(_float(row.get("rank")) or 0) or len(coins) + 1,
            name=row.get("name") or "",
            symbol=(row.get("symbol") or "").upper(),
            image="",
            price=dollars * usd_eur,
            market_cap=(_float(row.get("market_cap_usd")) or 0.0) * usd_eur,
            volume=(_float(row.get("volume24")) or 0.0) * usd_eur,
            change_24h=_float(row.get("percent_change_24h")),
            change_7d=_float(row.get("percent_change_7d")),
            change_30d=None,
            from_ath=None,
            sparkline=[],
            id=row.get("nameid") or "",
            source="CoinLore",
        ))
    return coins


def _paprika_markets(count: int) -> list[Coin]:
    return parse_paprika_markets(_get(f"{COINPAPRIKA}/tickers", {"quotes": "EUR", "limit": count}, TIMEOUT_SECOURS))


def _coinlore_markets(count: int) -> list[Coin]:
    usd_eur = fetch_usd_eur()  # sans taux, inutile d'interroger CoinLore
    return parse_coinlore_markets(
        _get(f"{COINLORE}/tickers/", {"start": 0, "limit": min(count, 100)}, TIMEOUT_SECOURS), usd_eur)


def fetch_markets(count: int = 20) -> list[Coin]:
    """Les premières cryptomonnaies : CoinGecko, sinon CoinPaprika, sinon CoinLore (converti en euros)."""
    return _first_answer(
        lambda: parse_markets(_get(f"{COINGECKO}/coins/markets", {
            "vs_currency": "eur", "order": "market_cap_desc", "per_page": count, "page": 1,
            "sparkline": "true", "price_change_percentage": "24h,7d,30d",
        }, TIMEOUT_SECOURS)),
        lambda: _paprika_markets(count),
        lambda: _coinlore_markets(count),
    )


def parse_global(payload: dict) -> dict:
    """Réponse de /global → capitalisation totale (€), variation sur 24 h, dominance du bitcoin et de l'ether."""
    data = payload.get("data", {})
    shares = data.get("market_cap_percentage", {})
    return {
        "market_cap": float(data.get("total_market_cap", {}).get("eur") or 0),
        "volume": float(data.get("total_volume", {}).get("eur") or 0),
        "change_24h": data.get("market_cap_change_percentage_24h_usd"),
        "btc_dominance": shares.get("btc"),
        "eth_dominance": shares.get("eth"),
        "coins": data.get("active_cryptocurrencies"),
    }


def parse_paprika_global(payload: dict, usd_eur: float) -> dict:
    """Réponse de CoinPaprika /global (en dollars, convertis avec `usd_eur`) → les mêmes chiffres que parse_global.

    CoinPaprika ne donne pas la dominance de l'ether : eth_dominance vaut None.
    """
    payload = payload if isinstance(payload, dict) else {}
    return {
        "market_cap": (_float(payload.get("market_cap_usd")) or 0.0) * usd_eur,
        "volume": (_float(payload.get("volume_24h_usd")) or 0.0) * usd_eur,
        "change_24h": _float(payload.get("market_cap_change_24h")),
        "btc_dominance": _float(payload.get("bitcoin_dominance_percentage")),
        "eth_dominance": None,
        "coins": payload.get("cryptocurrencies_number"),
    }


def parse_coinlore_global(payload: list | dict, usd_eur: float) -> dict:
    """Réponse de CoinLore /global/ (une liste d'un élément, en dollars convertis avec `usd_eur`)."""
    data = (payload[0] if payload else {}) if isinstance(payload, list) else payload
    data = data if isinstance(data, dict) else {}
    return {
        "market_cap": (_float(data.get("total_mcap")) or 0.0) * usd_eur,
        "volume": (_float(data.get("total_volume")) or 0.0) * usd_eur,
        "change_24h": _float(data.get("mcap_change")),
        "btc_dominance": _float(data.get("btc_d")),
        "eth_dominance": _float(data.get("eth_d")),
        "coins": data.get("coins_count"),
    }


def _with_market_cap(overview: dict) -> dict:
    """Un résumé sans capitalisation est une réponse vide : on passe au secours suivant."""
    return overview if overview.get("market_cap") else {}


def fetch_global() -> dict:
    """Les chiffres du marché : CoinGecko, sinon CoinPaprika, sinon CoinLore (convertis en euros)."""
    return _first_answer(
        lambda: _with_market_cap(parse_global(_get(f"{COINGECKO}/global", timeout=TIMEOUT_SECOURS))),
        lambda: _with_market_cap(parse_paprika_global(
            _get(f"{COINPAPRIKA}/global", timeout=TIMEOUT_SECOURS), fetch_usd_eur())),
        lambda: _with_market_cap(parse_coinlore_global(
            _get(f"{COINLORE}/global/", timeout=TIMEOUT_SECOURS), fetch_usd_eur())),
    )


def parse_fear_greed(payload: dict) -> list[tuple[datetime, int, str]]:
    """Réponse d'alternative.me → [(date, valeur de 0 à 100, libellé en français)], du plus ancien au plus récent."""
    points = []
    for row in payload.get("data", []):
        try:
            moment = datetime.fromtimestamp(int(row["timestamp"]), tz=timezone.utc)
            value = int(row["value"])
        except (KeyError, ValueError, TypeError):
            continue
        label = row.get("value_classification", "")
        points.append((moment, value, FEAR_GREED_LABELS.get(label, label)))
    return sorted(points)


def fetch_fear_greed(days: int = 90) -> list[tuple[datetime, int, str]]:
    return parse_fear_greed(_get(FEAR_GREED, {"limit": days, "format": "json"}))


def fear_greed_label(value: int) -> str:
    """Le libellé d'une valeur de l'indice, avec les seuils publiés par alternative.me."""
    if value <= 24:
        return "Peur extrême"
    if value <= 46:
        return "Peur"
    if value <= 54:
        return "Neutre"
    if value <= 75:
        return "Avidité"
    return "Avidité extrême"


# --- La fiche d'une cryptomonnaie ---------------------------------------------------------------------

class UnknownCoin(LookupError):
    """CoinGecko ne connaît pas cet identifiant."""


@dataclass
class CoinDetail:
    id: str
    name: str
    symbol: str
    rank: int | None
    image: str
    price: float | None  # en euros
    market_cap: float | None
    volume: float | None  # volume échangé sur 24 h
    change_1h: float | None  # variations en %
    change_24h: float | None
    change_7d: float | None
    change_30d: float | None
    change_1y: float | None
    ath: float | None  # plus haut historique, en euros
    ath_date: datetime | None
    ath_change: float | None  # écart du cours avec ce plus haut, en %
    atl: float | None  # plus bas historique
    atl_date: datetime | None
    atl_change: float | None
    circulating: float | None  # offre en circulation
    total_supply: float | None
    max_supply: float | None  # None quand l'offre n'est pas plafonnée
    fdv: float | None  # valorisation totale diluée (toute l'offre à venir comprise)
    categories: list[str]
    website: str
    whitepaper: str
    created: date | None
    description: str  # texte brut, paragraphes séparés par une ligne vide
    description_lang: str  # « fr » ou « en »
    source: str = "CoinGecko"  # d'où viennent les chiffres : CoinGecko, ou CoinPaprika en secours


def _number(value) -> float | None:
    """Un nombre, ou None ; les montants de CoinGecko sont souvent un dictionnaire {"eur": …, "usd": …}."""
    if isinstance(value, dict):
        value = value.get("eur")
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def _moment(value) -> datetime | None:
    if isinstance(value, dict):
        value = value.get("eur")
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _change(market: dict, period: str) -> float | None:
    """Variation en euros d'une période (« 24h », « 7d »…) ; à défaut, la variation sans devise de CoinGecko."""
    in_euros = _number(market.get(f"price_change_percentage_{period}_in_currency"))
    return in_euros if in_euros is not None else _number(market.get(f"price_change_percentage_{period}"))


def clean_description(text: str | None) -> str:
    """Le texte d'une description CoinGecko sans HTML, en paragraphes séparés par une ligne vide.

    Une première ligne courte, sans point final (« Qu'est-ce que le Bitcoin ? (BTC) »), est un titre : on l'écarte.
    """
    text = re.sub(r"(?i)<\s*br\s*/?\s*>|</\s*(p|li|div|h\d)\s*>", "\n", text or "")
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    paragraphs = [re.sub(r"[ \t\u00a0]+", " ", line).strip() for line in text.splitlines()]
    paragraphs = [line for line in paragraphs if line]
    if len(paragraphs) > 1 and len(paragraphs[0]) <= 80 and not paragraphs[0].endswith((".", "!", "…")):
        paragraphs = paragraphs[1:]
    return "\n\n".join(paragraphs)


def parse_coin(payload: dict) -> CoinDetail:
    """Réponse de /coins/{id} → CoinDetail. Les champs absents deviennent None (jamais d'erreur)."""
    market = payload.get("market_data") or {}
    links = payload.get("links") or {}
    texts = payload.get("description") or {}
    french = clean_description(texts.get("fr"))
    description, lang = (french, "fr") if french else (clean_description(texts.get("en")), "en")
    homepage = next((url for url in links.get("homepage") or [] if url), "")
    whitepaper = links.get("whitepaper") or ""
    try:
        created = date.fromisoformat(payload.get("genesis_date") or "")
    except ValueError:
        created = None
    return CoinDetail(
        id=payload.get("id") or "",
        name=payload.get("name") or "",
        symbol=(payload.get("symbol") or "").upper(),
        rank=payload.get("market_cap_rank"),
        image=(payload.get("image") or {}).get("large") or "",
        price=_number(market.get("current_price")),
        market_cap=_number(market.get("market_cap")),
        volume=_number(market.get("total_volume")),
        change_1h=_change(market, "1h"),
        change_24h=_change(market, "24h"),
        change_7d=_change(market, "7d"),
        change_30d=_change(market, "30d"),
        change_1y=_change(market, "1y"),
        ath=_number(market.get("ath")),
        ath_date=_moment(market.get("ath_date")),
        ath_change=_number(market.get("ath_change_percentage")),
        atl=_number(market.get("atl")),
        atl_date=_moment(market.get("atl_date")),
        atl_change=_number(market.get("atl_change_percentage")),
        circulating=_number(market.get("circulating_supply")),
        total_supply=_number(market.get("total_supply")),
        max_supply=_number(market.get("max_supply")),
        fdv=_number(market.get("fully_diluted_valuation")),
        categories=[c for c in payload.get("categories") or [] if c],
        website=homepage,
        whitepaper=whitepaper,
        created=created,
        description=description,
        description_lang=lang,
    )


def parse_paprika_coin(ticker: dict, info: dict | None = None, coin_id: str = "") -> CoinDetail:
    """Réponses de CoinPaprika /tickers/{id}?quotes=EUR et /coins/{id} → CoinDetail (secours de parse_coin).

    Les champs absents deviennent None ou vides (jamais d'erreur). Pas de plus bas historique, d'offre en circulation
    ni de valorisation diluée chez CoinPaprika ; la description n'existe qu'en anglais. `info` peut manquer.
    """
    ticker = ticker if isinstance(ticker, dict) else {}
    info = info if isinstance(info, dict) else {}
    market = (ticker.get("quotes") or {}).get("EUR") or {}
    links = info.get("links") or {}
    paprika_id = ticker.get("id") or info.get("id") or ""
    try:
        created = date.fromisoformat(str(info.get("started_at") or "")[:10])
    except ValueError:
        created = None
    return CoinDetail(
        id=coin_id or _gecko_id(paprika_id),
        name=ticker.get("name") or info.get("name") or "",
        symbol=(ticker.get("symbol") or info.get("symbol") or "").upper(),
        rank=ticker.get("rank") or None,
        image=info.get("logo") or "",
        price=_number(market.get("price")),
        market_cap=_number(market.get("market_cap")),
        volume=_number(market.get("volume_24h")),
        change_1h=_number(market.get("percent_change_1h")),
        change_24h=_number(market.get("percent_change_24h")),
        change_7d=_number(market.get("percent_change_7d")),
        change_30d=_number(market.get("percent_change_30d")),
        change_1y=_number(market.get("percent_change_1y")),
        ath=_number(market.get("ath_price")),
        ath_date=_moment(market.get("ath_date")),
        ath_change=_number(market.get("percent_from_price_ath")),
        atl=None,
        atl_date=None,
        atl_change=None,
        circulating=None,
        total_supply=_number(ticker.get("total_supply")),
        max_supply=_number(ticker.get("max_supply")),
        fdv=None,
        categories=[tag["name"] for tag in info.get("tags") or [] if isinstance(tag, dict) and tag.get("name")],
        website=next((url for url in links.get("website") or [] if url), ""),
        whitepaper=(info.get("whitepaper") or {}).get("link") or "",
        created=created,
        description=clean_description(info.get("description")),
        description_lang="en",
        source="CoinPaprika",
    )


def _paprika_ticker(coin_id: str) -> dict:
    """Le ticker CoinPaprika (en euros) d'un identifiant CoinGecko ; LookupError s'il n'est pas retrouvé.

    La recherche de CoinPaprika donne les identifiants « btc-bitcoin » : celui dont la partie après le premier tiret
    est `coin_id` est le bon. À défaut (la recherche ignore les tirets : « binance-coin »), on cherche parmi les
    100 premiers.
    """
    for query in dict.fromkeys([coin_id, coin_id.replace("-", " ")]):
        found = _get(f"{COINPAPRIKA}/search/", {"q": query, "c": "currencies", "limit": 10}, TIMEOUT_SECOURS)
        for row in (found.get("currencies") or []) if isinstance(found, dict) else []:
            if row.get("id") and _gecko_id(row["id"]) == coin_id:
                return _get(f"{COINPAPRIKA}/tickers/{quote(row['id'], safe='')}", {"quotes": "EUR"}, TIMEOUT_SECOURS)
    for row in _get(f"{COINPAPRIKA}/tickers", {"quotes": "EUR", "limit": 100}, TIMEOUT_SECOURS):
        if _gecko_id(row.get("id")) == coin_id:
            return row
    raise LookupError(coin_id)


def _paprika_coin(coin_id: str) -> CoinDetail:
    ticker = _paprika_ticker(coin_id)
    try:  # la description et les liens sont un plus : sans eux, la fiche garde son cours
        info = _get(f"{COINPAPRIKA}/coins/{quote(ticker['id'], safe='')}", timeout=TIMEOUT_SECOURS)
    except PANNES:
        info = None
    return parse_paprika_coin(ticker, info, coin_id)


def fetch_coin(coin_id: str) -> CoinDetail:
    """La fiche d'une cryptomonnaie ; UnknownCoin si l'identifiant n'existe pas.

    Si CoinGecko refuse (limite atteinte, panne) ou ne connaît pas l'identifiant (celui d'une liste de secours
    n'est pas toujours le sien), CoinPaprika donne ce qu'il a. Sans réponse du secours, l'erreur de CoinGecko remonte.
    """
    try:
        response = requests.get(f"{COINGECKO}/coins/{quote(coin_id, safe='')}", timeout=TIMEOUT_SECOURS, params={
            "localization": "true", "tickers": "false", "community_data": "false", "developer_data": "false",
            "market_data": "true", "sparkline": "false"})
        if response.status_code == 404:
            raise UnknownCoin(coin_id)
        response.raise_for_status()
        return parse_coin(response.json())
    except (requests.RequestException, ValueError, UnknownCoin) as error:
        try:
            return _paprika_coin(coin_id)
        except PANNES:
            raise error from None


# Les périodes du graphique : jours demandés à CoinGecko → (période, intervalle) de Yahoo Finance pour le secours
CHART_DAYS = {"1": ("1d", "5m"), "7": ("7d", "1h"), "30": ("1mo", "1h"), "365": ("1y", "1d"), "max": ("max", "1wk")}


def parse_chart(payload: dict) -> list[tuple[datetime, float]]:
    """Réponse de /market_chart → [(date, cours en euros)], du plus ancien au plus récent."""
    points = []
    for row in payload.get("prices") or []:
        try:
            moment = datetime.fromtimestamp(row[0] / 1000, tz=timezone.utc)
            points.append((moment, float(row[1])))
        except (IndexError, TypeError, ValueError):
            continue
    return sorted(points)


def _yahoo_chart(symbol: str, days: str) -> list[tuple[datetime, float]]:
    """Secours : le cours « SYMBOLE-EUR » de Yahoo Finance (aucune limite de requêtes comme chez CoinGecko)."""
    import yfinance as yf

    period, interval = CHART_DAYS[days]
    closes = yf.Ticker(f"{symbol.upper()}-EUR").history(period=period, interval=interval)["Close"].dropna()
    return [(moment.to_pydatetime().astimezone(timezone.utc), float(value)) for moment, value in closes.items()]


def fetch_chart(coin_id: str, days: str, symbol: str = "") -> list[tuple[datetime, float]]:
    """Le cours en euros sur 1, 7, 30, 365 jours ou « max ». Si CoinGecko refuse (limite atteinte, historique
    complet réservé aux offres payantes), le cours Yahoo Finance de `symbol` le remplace."""
    try:
        response = requests.get(f"{COINGECKO}/coins/{quote(coin_id, safe='')}/market_chart", timeout=TIMEOUT,
                                params={"vs_currency": "eur", "days": days})
        response.raise_for_status()
        points = parse_chart(response.json())
        if len(points) >= 2:
            return points
    except (requests.RequestException, ValueError):
        pass
    if not symbol:
        raise LookupError("graphique indisponible")
    return _yahoo_chart(symbol, days)


@dataclass
class CoinHit:
    id: str
    name: str
    symbol: str
    rank: int | None
    thumb: str


def parse_search(payload: dict) -> list[CoinHit]:
    """Réponse de /search → les cryptomonnaies trouvées (les mieux classées d'abord)."""
    hits = [CoinHit(id=row["id"], name=row.get("name") or row["id"], symbol=(row.get("symbol") or "").upper(),
                    rank=row.get("market_cap_rank"), thumb=row.get("thumb") or "")
            for row in payload.get("coins") or [] if row.get("id")]
    return sorted(hits, key=lambda hit: (hit.rank is None, hit.rank or 0))


def search_coins(query: str) -> list[CoinHit]:
    return parse_search(_get(f"{COINGECKO}/search", {"query": query.strip()}))


def mentions(text: str, name: str, symbol: str) -> bool:
    """Ce texte parle-t-il de cette cryptomonnaie ? Son nom (« Solana », pluriel compris), ou son symbole en
    majuscules (« SOL ») s'il a au moins trois lettres : « OP » ou « S » se trouvent dans trop de mots."""
    if name and re.search(rf"(?<!\w){re.escape(name)}s?(?!\w)", text, re.IGNORECASE):
        return True
    return len(symbol) >= 3 and re.search(rf"(?<!\w){re.escape(symbol.upper())}(?!\w)", text) is not None
