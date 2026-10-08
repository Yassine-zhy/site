"""
Actions et ETF américains (Nvidia, Apple, Tesla, S&P 500...) via le courtier Alpaca.

ccxt ne gère que les cryptos. Pour les actions, ce module parle à Alpaca avec
son SDK officiel (alpaca-py), en offrant au bot exactement les mêmes méthodes
qu'ExchangeClient et LiveTrader (broker.py). Le reste du bot (stratégie, IA,
stop-loss, journal) fonctionne donc sans changement.

Différences avec les cryptos :
  * la Bourse américaine ferme le soir et le week-end : le bot ne passe des
    ordres que pendant la séance (15 h 30 à 22 h, heure de Paris) ;
  * Alpaca ne prend pas de commission et permet d'acheter des fractions
    d'action (par exemple 50 $ de Nvidia) ;
  * les erreurs d'Alpaca sont traduites en erreurs ccxt, pour que la boucle
    du bot les traite comme d'habitude (réseau, fonds insuffisants...).
"""

from __future__ import annotations

import logging
import math
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

import ccxt
import pandas as pd
import requests
from alpaca.common.enums import Sort
from alpaca.common.exceptions import APIError
from alpaca.data.enums import Adjustment, DataFeed
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest, StockLatestTradeRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from alpaca.trading.client import TradingClient
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.trading.requests import MarketOrderRequest

from broker import LiveTrader
from config import ConfigError, Settings
from strategy import ohlcv_to_dataframe

log = logging.getLogger("bot")

REQUEST_TIMEOUT = 30          # secondes : le SDK n'en impose aucun par défaut
MIN_NOTIONAL = 1.0            # Alpaca accepte des ordres à partir de 1 $
FRACTION_STEP = 1e-6          # précision utilisée pour les fractions d'action

TIMEFRAMES = {
    "1h": TimeFrame(1, TimeFrameUnit.Hour),
    "2h": TimeFrame(2, TimeFrameUnit.Hour),
    "4h": TimeFrame(4, TimeFrameUnit.Hour),
    "1d": TimeFrame.Day,
}


def translate_error(exc: APIError) -> ccxt.BaseError:
    """Erreur Alpaca -> erreur ccxt équivalente, que la boucle du bot sait traiter."""
    status = exc.status_code
    try:
        message = exc.message
    except Exception:  # noqa: BLE001 - réponse d'erreur non JSON
        message = str(exc)
    message = str(message).rstrip(".")
    text = f"Alpaca ({status}) : {message}"
    # Alpaca répond 403 quand le solde est insuffisant : à tester avant les clés.
    if "insufficient" in str(message).lower():
        return ccxt.InsufficientFunds(text)
    if status in (401, 403):
        return ccxt.AuthenticationError(text)
    if status == 429 or (status and status >= 500):
        return ccxt.ExchangeNotAvailable(text)
    if status in (400, 422):
        return ccxt.InvalidOrder(text)
    return ccxt.ExchangeError(text)


def call_alpaca(fn: Callable, *args, **kwargs):
    """Appelle Alpaca en traduisant ses erreurs en erreurs ccxt."""
    try:
        return fn(*args, **kwargs)
    except APIError as exc:
        raise translate_error(exc) from exc
    except requests.exceptions.RequestException as exc:
        raise ccxt.NetworkError(f"Alpaca injoignable : {exc}") from exc


def _add_timeout(client: Any) -> None:
    """Ajoute un délai maximal aux requêtes du SDK (sinon une coupure peut bloquer le bot)."""
    session = getattr(client, "_session", None)
    if session is None:
        return
    original = session.request

    def request(method, url, **kwargs):
        kwargs.setdefault("timeout", REQUEST_TIMEOUT)
        return original(method, url, **kwargs)

    session.request = request


def _feed() -> DataFeed:
    """Source des prix : IEX (gratuite) par défaut, SIP pour un abonnement payant."""
    name = os.getenv("ALPACA_DATA_FEED", "iex").strip().lower() or "iex"
    try:
        return DataFeed(name)
    except ValueError:
        raise ConfigError(f"ALPACA_DATA_FEED inconnu : {name!r} (iex ou sip).") from None


def bars_to_ohlcv(bars: list) -> list[list[float]]:
    """Convertit les bougies Alpaca au format de ccxt : [horodatage_ms, o, h, l, c, v]."""
    return [[int(b.timestamp.timestamp() * 1000), float(b.open), float(b.high), float(b.low),
             float(b.close), float(b.volume)] for b in bars]


def fetch_stock_bars(data_client: StockHistoricalDataClient, symbol: str, timeframe: str,
                     start: datetime, limit: int | None = None) -> list:
    """Bougies ajustées des divisions d'actions et dividendes (sinon une division fausse tout)."""
    request = StockBarsRequest(
        symbol_or_symbols=symbol,
        timeframe=TIMEFRAMES[timeframe],
        start=start,
        limit=limit,
        sort=Sort.DESC if limit else Sort.ASC,   # avec une limite : les plus récentes
        adjustment=Adjustment.ALL,
        feed=_feed(),
    )
    barset = call_alpaca(data_client.get_stock_bars, request)
    bars = list(barset.data.get(symbol, []))
    return sorted(bars, key=lambda b: b.timestamp)


class AlpacaClient:
    """Données de marché et règles d'une action, avec la même interface qu'ExchangeClient."""

    name = "alpaca"

    def __init__(self, settings: Settings, trading: Any = None, data: Any = None):
        if settings.timeframe not in TIMEFRAMES:
            raise ConfigError(f"TIMEFRAME={settings.timeframe} non géré pour les actions "
                              f"(choix : {', '.join(TIMEFRAMES)} ; 1d conseillé).")
        # MODE=paper et MODE=testnet utilisent le compte d'entraînement
        # d'Alpaca (argent fictif) ; seul MODE=live touche le vrai compte.
        self.trading = trading or TradingClient(settings.api_key, settings.api_secret,
                                                paper=settings.mode != "live")
        self.data = data or StockHistoricalDataClient(settings.api_key, settings.api_secret)
        _add_timeout(self.trading)
        _add_timeout(self.data)
        self.settings = settings
        self.symbol = settings.base_currency      # « NVDA/USD » ou « NVDA » -> « NVDA »
        self.timeframe = settings.timeframe
        self.timeframe_ms = ccxt.Exchange.parse_timeframe(settings.timeframe) * 1000
        self.asset: Any = None
        self._clock: Any = None
        self._clock_checked = 0.0

    # ---------------------------------------------------------------- connexion
    def connect(self) -> None:
        try:
            self.asset = self.trading.get_asset(self.symbol)
        except APIError as exc:
            if exc.status_code == 404:
                raise ConfigError(f"Action {self.symbol} introuvable sur Alpaca.") from exc
            raise translate_error(exc) from exc
        except requests.exceptions.RequestException as exc:
            raise ccxt.NetworkError(f"Alpaca injoignable : {exc}") from exc
        if not self.asset.tradable:
            raise ConfigError(f"{self.symbol} n'est pas négociable sur Alpaca.")
        account = call_alpaca(self.trading.get_account)
        if account.trading_blocked or account.account_blocked:
            raise ConfigError("Le compte Alpaca est bloqué pour le trading (voir le site d'Alpaca).")
        log.info("Alpaca : %s (%s), fractions d'action %s, compte %s.", self.symbol, self.asset.name,
                 "acceptées" if self.asset.fractionable else "refusées",
                 "réel" if self.settings.mode == "live" else "d'entraînement")

    @property
    def base(self) -> str:
        return self.symbol

    @property
    def quote(self) -> str:
        return "USD"

    @property
    def fractionable(self) -> bool:
        return bool(self.asset and self.asset.fractionable)

    # ------------------------------------------------------- heures d'ouverture
    def _refresh_clock(self) -> None:
        if self._clock is None or time.monotonic() - self._clock_checked > 60:
            self._clock = call_alpaca(self.trading.get_clock)
            self._clock_checked = time.monotonic()

    def market_is_open(self) -> bool:
        self._refresh_clock()
        return bool(self._clock.is_open)

    def next_open_text(self) -> str:
        self._refresh_clock()
        return f"{self._clock.next_open.astimezone(timezone.utc):%Y-%m-%d %H:%M} UTC"

    # ------------------------------------------------------------ données marché
    def fetch_closed_candles(self) -> pd.DataFrame:
        # Assez loin dans le passé pour obtenir CANDLES_LIMIT bougies,
        # week-ends et jours fériés compris.
        days = 5 * 365 if self.timeframe == "1d" else 2 * 365
        start = datetime.now(timezone.utc) - timedelta(days=days)
        ohlcv = bars_to_ohlcv(fetch_stock_bars(self.data, self.symbol, self.timeframe, start,
                                               limit=self.settings.candles_limit))
        if not ohlcv:
            raise ccxt.ExchangeError(f"Aucune bougie reçue pour {self.symbol}.")
        now_ms = datetime.now(timezone.utc).timestamp() * 1000
        if ohlcv[-1][0] + self.timeframe_ms > now_ms:
            ohlcv = ohlcv[:-1]   # bougie encore en cours
        return ohlcv_to_dataframe(ohlcv)

    def fetch_last_price(self) -> float:
        request = StockLatestTradeRequest(symbol_or_symbols=self.symbol, feed=_feed())
        trades = call_alpaca(self.data.get_stock_latest_trade, request)
        trade = trades.get(self.symbol)
        if not trade or not trade.price:
            raise ccxt.ExchangeError(f"Prix indisponible pour {self.symbol}.")
        return float(trade.price)

    # ----------------------------------------------------------- règles marché
    def round_amount(self, amount: float) -> float:
        """Arrondit vers le bas : fractions d'action si possible, sinon actions entières."""
        if self.fractionable:
            return math.floor(amount / FRACTION_STEP) * FRACTION_STEP
        return float(math.floor(amount))

    def min_order_cost(self, price: float) -> float:
        return MIN_NOTIONAL if self.fractionable else price

    def min_order_amount(self, price: float) -> float:
        if self.fractionable:
            return max(FRACTION_STEP, MIN_NOTIONAL / price if price else 0.0)
        return 1.0


class AlpacaTrader(LiveTrader):
    """
    Ordres au marché sur Alpaca. Hérite de LiveTrader toute la logique de
    sécurité : vérification des soldes après une coupure, attente de
    l'exécution, calcul du prix moyen.
    """

    def __init__(self, client: AlpacaClient):
        self.client = client
        self.trading = client.trading

    def get_free_balances(self) -> tuple[float, float]:
        account = call_alpaca(self.trading.get_account)
        # Les fractions d'action ne s'achètent pas à crédit : on s'en tient
        # à l'argent réellement disponible.
        cash = max(0.0, min(float(account.cash), float(account.non_marginable_buying_power)))
        try:
            position = self.trading.get_open_position(self.client.symbol)
            shares = float(position.qty_available)
        except APIError as exc:
            if exc.status_code != 404:   # 404 = aucune action détenue
                raise translate_error(exc) from exc
            shares = 0.0
        except requests.exceptions.RequestException as exc:
            raise ccxt.NetworkError(f"Alpaca injoignable : {exc}") from exc
        return cash, shares

    def _send_order(self, side: str, amount: float, quote_amount: float) -> dict[str, Any]:
        if side == "buy" and self.client.fractionable:
            # Achat « pour X dollars » : Alpaca calcule la fraction d'action.
            request = MarketOrderRequest(symbol=self.client.symbol, notional=round(quote_amount, 2),
                                         side=OrderSide.BUY, time_in_force=TimeInForce.DAY)
        else:
            request = MarketOrderRequest(symbol=self.client.symbol, qty=amount,
                                         side=OrderSide.BUY if side == "buy" else OrderSide.SELL,
                                         time_in_force=TimeInForce.DAY)
        return self._as_dict(call_alpaca(self.trading.submit_order, order_data=request))

    def _wait_until_filled(self, order: dict[str, Any], attempts: int = 10) -> dict[str, Any]:
        for _ in range(attempts):
            if order["status"] == "closed":
                return order
            if order["status"] in ("canceled", "expired", "rejected"):
                raise ccxt.InvalidOrder(f"Ordre {order['id']} refusé par Alpaca ({order['status']}).")
            time.sleep(2)
            try:
                order = self._as_dict(call_alpaca(self.trading.get_order_by_id, order["id"]))
            except ccxt.NetworkError as exc:
                log.warning("Suivi de l'ordre %s impossible pour l'instant : %s", order["id"], exc)
        log.warning("Ordre %s : exécution non confirmée, estimation à partir des soldes.", order["id"])
        return order

    @staticmethod
    def _as_dict(order: Any) -> dict[str, Any]:
        """Présente l'ordre Alpaca comme un ordre ccxt, attendu par LiveTrader."""
        status = getattr(order.status, "value", order.status)
        filled = float(order.filled_qty or 0)
        average = float(order.filled_avg_price or 0)
        return {
            "id": str(order.id),
            "status": "closed" if status == "filled" else status,
            "filled": filled,
            "average": average,
            "cost": filled * average,
        }


def fetch_stock_history(settings: Settings, days: int) -> pd.DataFrame:
    """Historique pour backtest.py (clés Alpaca nécessaires, même gratuites)."""
    if not (settings.api_key and settings.api_secret):
        raise ConfigError("Le backtest d'une action nécessite API_KEY et API_SECRET d'Alpaca dans le .env.")
    data = StockHistoricalDataClient(settings.api_key, settings.api_secret)
    _add_timeout(data)
    start = datetime.now(timezone.utc) - timedelta(days=days)
    timeframe_ms = ccxt.Exchange.parse_timeframe(settings.timeframe) * 1000
    ohlcv = bars_to_ohlcv(fetch_stock_bars(data, settings.base_currency, settings.timeframe, start))
    now_ms = datetime.now(timezone.utc).timestamp() * 1000
    ohlcv = [row for row in ohlcv if row[0] + timeframe_ms <= now_ms]
    if not ohlcv:
        raise ccxt.ExchangeError(f"Aucune bougie reçue pour {settings.base_currency}.")
    return ohlcv_to_dataframe(ohlcv)
