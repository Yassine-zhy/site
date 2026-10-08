"""Outils communs aux tests : faux exchange et données synthétiques (aucun accès réseau)."""

from __future__ import annotations

import math
import threading
from pathlib import Path

import ccxt
import pytest

from bot import TradingBot
from broker import ExchangeClient, LiveTrader, PaperTrader
from config import Settings, StrategyParams
from state import StateStore

TF_MS = 4 * 3600 * 1000
START_MS = 1_700_000_000_000 - (1_700_000_000_000 % TF_MS)


def uptrend_with_pullback() -> list[float]:
    """Hausse régulière, repli de 8 bougies, puis rebond : doit produire un BUY."""
    closes = [100 * 1.004 ** i * (1 + 0.003 * math.sin(i)) for i in range(300)]
    for _ in range(8):
        closes.append(closes[-1] * 0.988)
    for _ in range(6):
        closes.append(closes[-1] * 1.015)
    return closes


def downtrend() -> list[float]:
    closes = [100 * 0.996 ** i * (1 + 0.01 * math.sin(i / 2)) for i in range(400)]
    return closes


def make_ohlcv(closes: list[float]) -> list[list[float]]:
    rows = []
    for i, close in enumerate(closes):
        open_ = closes[i - 1] if i else close
        rows.append([START_MS + i * TF_MS, open_, max(open_, close) * 1.002, min(open_, close) * 0.998, close, 10.0])
    return rows


class FakeExchange:
    """Imite les méthodes de ccxt utilisées par le bot."""

    id = "fake"
    urls = {"test": {}}
    timeframes = {"4h": "4h", "1d": "1d"}
    has = {"fetchOrder": True}
    parse_timeframe = staticmethod(ccxt.Exchange.parse_timeframe)

    def __init__(self, ohlcv, price=None, quote=100.0, base=0.0, base_fee=0.001):
        self.ohlcv = ohlcv
        self.price = price if price is not None else ohlcv[-1][4]
        # « Maintenant » = fin de la dernière bougie fournie : elle est clôturée.
        self.now = ohlcv[-1][0] + TF_MS + 1
        self.balances = {"USDT": quote, "BTC": base}
        self.base_fee = base_fee
        self.markets = {"BTC/USDT": {
            "symbol": "BTC/USDT", "base": "BTC", "quote": "USDT",
            "limits": {"amount": {"min": 0.0001}, "cost": {"min": 5.0}},
        }}
        self.fail = {}            # nom de méthode -> exception à lever
        self.orders = []

    def _maybe_fail(self, name):
        exc = self.fail.get(name)
        if exc is not None:
            raise exc

    def load_markets(self):
        self._maybe_fail("load_markets")
        return self.markets

    def market(self, symbol):
        return self.markets[symbol]

    def milliseconds(self):
        return self.now

    def fetch_ohlcv(self, symbol, timeframe, since=None, limit=None):
        self._maybe_fail("fetch_ohlcv")
        rows = self.ohlcv[-limit:] if limit else self.ohlcv
        return [list(r) for r in rows]

    def fetch_ticker(self, symbol):
        self._maybe_fail("fetch_ticker")
        return {"last": self.price, "bid": self.price, "close": self.price}

    def amount_to_precision(self, symbol, amount):
        value = math.floor(amount * 1e6) / 1e6
        if value <= 0:
            raise ccxt.InvalidOrder("amount too small")
        return f"{value:.6f}"

    def fetch_balance(self):
        self._maybe_fail("fetch_balance")
        return {code: {"free": value} for code, value in self.balances.items()}

    def create_market_buy_order(self, symbol, amount):
        self._execute("buy", amount)
        self._maybe_fail("create_order_after_fill")
        return self.orders[-1]

    def create_market_sell_order(self, symbol, amount):
        self._execute("sell", amount)
        self._maybe_fail("create_order_after_fill")
        return self.orders[-1]

    def _execute(self, side, amount):
        self._maybe_fail("create_order")
        cost = amount * self.price
        if side == "buy":
            if cost > self.balances["USDT"]:
                raise ccxt.InsufficientFunds("not enough USDT")
            self.balances["USDT"] -= cost
            self.balances["BTC"] += amount * (1 - self.base_fee)   # frais en BTC, comme Binance
        else:
            if amount > self.balances["BTC"] + 1e-12:
                raise ccxt.InsufficientFunds("not enough BTC")
            self.balances["BTC"] -= amount
            self.balances["USDT"] += cost * (1 - self.base_fee)
        self.orders.append({"id": str(len(self.orders) + 1), "status": "closed", "filled": amount,
                            "average": self.price, "cost": cost})

    def fetch_order(self, order_id, symbol):
        return next(o for o in self.orders if o["id"] == order_id)


def make_settings(tmp_path: Path, mode: str = "paper", **overrides) -> Settings:
    values = dict(
        mode=mode, exchange_id="binance", api_key="k", api_secret="s",
        symbol="BTC/USDT", timeframe="4h", candles_limit=500,
        position_size=0.5, max_order_cost=0.0, stop_loss=0.03, take_profit=0.08,
        strategy=StrategyParams(), analysis_interval=900, price_check_interval=60,
        paper_start_balance=100.0, paper_fee=0.004, paper_slippage=0.0,
        log_level="INFO", state_file=tmp_path / f"state_{mode}.json",
    )
    values.update(overrides)
    return Settings(**values)


def make_bot(settings: Settings, fake: FakeExchange, advisor=None) -> TradingBot:
    client = ExchangeClient(settings)
    client.exchange = fake          # on remplace la vraie connexion par le faux exchange
    client.connect()
    store = StateStore(settings.state_file, settings.paper_start_balance)
    state = store.load()
    if settings.mode == "paper":
        trader = PaperTrader(client, state, settings.paper_fee, settings.paper_slippage)
    else:
        trader = LiveTrader(client)
    return TradingBot(settings, client, trader, store, state, threading.Event(), advisor)


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    """Les attentes de broker.py (suivi des ordres) sont inutiles en test."""
    monkeypatch.setattr("broker.time.sleep", lambda _seconds: None)
