"""Cryptomonnaies : cours et capitalisations (CoinGecko) et indice de sentiment « peur et avidité ».

Deux API publiques, gratuites et sans clé :
- CoinGecko (https://www.coingecko.com/api) : les 20 premières cryptomonnaies par capitalisation, en euros ;
- alternative.me (https://alternative.me/crypto/fear-and-greed-index/) : l'indice Crypto Fear & Greed, de 0
  (peur extrême) à 100 (avidité extrême), calculé chaque jour à partir de la volatilité, des volumes, des
  réseaux sociaux et de la dominance du bitcoin.

L'offre gratuite de CoinGecko limite le nombre de requêtes par minute : l'interface les garde en cache.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

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
