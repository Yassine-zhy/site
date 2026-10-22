"""Cryptomonnaies : cours et capitalisations (CoinGecko) et indice de sentiment « peur et avidité ».

Deux API publiques, gratuites et sans clé :
- CoinGecko (https://www.coingecko.com/api) : les 20 premières cryptomonnaies par capitalisation, en euros ;
- alternative.me (https://alternative.me/crypto/fear-and-greed-index/) : l'indice Crypto Fear & Greed, de 0
  (peur extrême) à 100 (avidité extrême), calculé chaque jour à partir de la volatilité, des volumes, des
  réseaux sociaux et de la dominance du bitcoin.

L'offre gratuite de CoinGecko limite le nombre de requêtes par minute : l'interface les garde en cache.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from urllib.parse import quote

import requests

COINGECKO = "https://api.coingecko.com/api/v3"
FEAR_GREED = "https://api.alternative.me/fng/"
TIMEOUT = 15

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


def _get(url: str, params: dict | None = None):
    response = requests.get(url, params=params, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()


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


def fetch_markets(count: int = 20) -> list[Coin]:
    rows = _get(f"{COINGECKO}/coins/markets", {
        "vs_currency": "eur", "order": "market_cap_desc", "per_page": count, "page": 1,
        "sparkline": "true", "price_change_percentage": "24h,7d,30d",
    })
    return parse_markets(rows)


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


def fetch_global() -> dict:
    return parse_global(_get(f"{COINGECKO}/global"))


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


def fetch_coin(coin_id: str) -> CoinDetail:
    """La fiche d'une cryptomonnaie ; UnknownCoin si l'identifiant n'existe pas."""
    response = requests.get(f"{COINGECKO}/coins/{quote(coin_id, safe='')}", timeout=TIMEOUT, params={
        "localization": "true", "tickers": "false", "community_data": "false", "developer_data": "false",
        "market_data": "true", "sparkline": "false"})
    if response.status_code == 404:
        raise UnknownCoin(coin_id)
    response.raise_for_status()
    return parse_coin(response.json())


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
