"""Tests des actions (Alpaca) avec un faux courtier : aucun accès réseau, aucun ordre réel."""

import threading
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import ccxt
import pytest
import requests
from alpaca.common.exceptions import APIError

from ai_advisor import build_market_context
from bot import TradingBot
from broker import PaperTrader
from state import StateStore
from stocks import AlpacaClient, AlpacaTrader
from strategy import add_indicators

from conftest import make_ohlcv, make_settings, uptrend_with_pullback


def api_error(status, message):
    response = requests.Response()
    response.status_code = status
    return APIError(f'{{"code": {status}00000, "message": "{message}"}}', requests.HTTPError(response=response))


class FakeTrading:
    """Imite alpaca.trading.client.TradingClient."""

    def __init__(self, cash=100.0, fractionable=True, is_open=True):
        self.cash, self.shares = cash, 0.0
        self.price = 0.0
        self.fractionable, self.is_open = fractionable, is_open
        self.orders, self.fail_submit = [], None

    def get_asset(self, symbol):
        if symbol != "NVDA":
            raise api_error(404, "asset not found")
        return SimpleNamespace(tradable=True, fractionable=self.fractionable, name="NVIDIA Corporation")

    def get_account(self):
        return SimpleNamespace(cash=str(self.cash), non_marginable_buying_power=str(self.cash),
                               trading_blocked=False, account_blocked=False)

    def get_clock(self):
        return SimpleNamespace(is_open=self.is_open, next_open=datetime(2026, 10, 9, 13, 30, tzinfo=timezone.utc))

    def get_open_position(self, symbol):
        if self.shares <= 0:
            raise api_error(404, "position does not exist")
        return SimpleNamespace(qty_available=str(self.shares))

    def submit_order(self, order_data):
        if self.fail_submit:
            raise self.fail_submit
        buy = order_data.side.value == "buy"
        qty = order_data.qty if order_data.qty is not None else order_data.notional / self.price
        if buy:
            self.cash -= qty * self.price
            self.shares += qty
        else:
            self.shares -= qty
            self.cash += qty * self.price
        order = SimpleNamespace(id=uuid.uuid4(), status="filled", filled_qty=str(qty),
                                filled_avg_price=str(self.price), request=order_data)
        self.orders.append(order)
        return order

    def get_order_by_id(self, order_id):
        return next(o for o in self.orders if o.id == order_id)


class FakeData:
    """Imite alpaca.data.historical.StockHistoricalDataClient."""

    def __init__(self, ohlcv, trading):
        self.trading = trading
        self.bars = [SimpleNamespace(timestamp=datetime.fromtimestamp(r[0] / 1000, timezone.utc), open=r[1],
                                     high=r[2], low=r[3], close=r[4], volume=r[5]) for r in ohlcv]
        self.price = ohlcv[-1][4]
        self.bar_requests = 0

    def get_stock_bars(self, request):
        self.bar_requests += 1
        assert request.adjustment.value == "all"     # cours ajustés des divisions d'actions
        return SimpleNamespace(data={"NVDA": self.bars})

    def get_stock_latest_trade(self, request):
        self.trading.price = self.price
        return {"NVDA": SimpleNamespace(price=self.price)}


def stock_bot(tmp_path, mode="testnet", **trading_kwargs):
    settings = make_settings(tmp_path, mode=mode, exchange_id="alpaca", symbol="NVDA/USD", paper_fee=0.0)
    trading = FakeTrading(**trading_kwargs)
    data = FakeData(make_ohlcv(uptrend_with_pullback()[:310]), trading)
    client = AlpacaClient(settings, trading=trading, data=data)
    client.connect()
    store = StateStore(settings.state_file, settings.paper_start_balance)
    state = store.load()
    trader = (PaperTrader(client, state, settings.paper_fee, settings.paper_slippage)
              if mode == "paper" else AlpacaTrader(client))
    return TradingBot(settings, client, trader, store, state, threading.Event()), trading, data


def test_symbol_and_currency(tmp_path):
    bot, _, _ = stock_bot(tmp_path)
    assert (bot.client.symbol, bot.client.base, bot.client.quote) == ("NVDA", "NVDA", "USD")


def test_unknown_stock_is_a_config_error(tmp_path):
    from config import ConfigError
    settings = make_settings(tmp_path, exchange_id="alpaca", symbol="XXXX")
    trading = FakeTrading()
    with pytest.raises(ConfigError, match="introuvable"):
        AlpacaClient(settings, trading=trading, data=FakeData(make_ohlcv([1.0, 2.0]), trading)).connect()


def test_buy_fraction_then_stop_loss(tmp_path):
    bot, trading, data = stock_bot(tmp_path)
    bot.run_cycle()
    assert bot.state["in_position"]
    buy = trading.orders[0].request
    assert buy.notional == 50.0 and buy.qty is None            # achat « pour 50 $ »
    assert bot.state["amount"] == pytest.approx(50 / data.price)  # fraction d'action

    held = bot.state["amount"]
    data.price = bot.state["entry_price"] * 0.96
    bot.run_cycle()
    assert not bot.state["in_position"]
    sell = trading.orders[1].request
    assert sell.side.value == "sell" and sell.qty == pytest.approx(held, abs=1e-6)
    assert trading.shares == pytest.approx(0, abs=1e-5)


def test_whole_shares_when_fractions_refused(tmp_path):
    bot, trading, data = stock_bot(tmp_path, cash=2000.0, fractionable=False)
    bot.run_cycle()                     # 50 % de 2 000 $ = 1 000 $ -> 3 actions à ~308 $
    request = trading.orders[0].request
    assert request.notional is None and request.qty == 3


def test_market_closed_means_no_activity(tmp_path):
    bot, trading, data = stock_bot(tmp_path, is_open=False)
    bot.run_cycle()
    assert trading.orders == [] and data.bar_requests == 0


def test_insufficient_buying_power_is_not_fatal(tmp_path):
    bot, trading, _ = stock_bot(tmp_path)
    trading.fail_submit = api_error(403, "insufficient buying power")
    bot.run_cycle()
    assert not bot.state["in_position"] and not bot.stop_event.is_set()


def test_rejected_key_stops_bot(tmp_path):
    bot, trading, _ = stock_bot(tmp_path)
    trading.fail_submit = api_error(401, "unauthorized")
    bot.run_cycle()
    assert bot.stop_event.is_set()


def test_network_error_is_retried(tmp_path):
    bot, trading, _ = stock_bot(tmp_path)
    trading.fail_submit = requests.exceptions.ConnectionError("coupure")
    assert bot.run_cycle() == 30        # erreur réseau : nouvel essai dans 30 s
    assert not bot.state["in_position"]


def test_paper_mode_uses_real_prices_and_virtual_wallet(tmp_path):
    bot, trading, _ = stock_bot(tmp_path, mode="paper")
    bot.run_cycle()
    assert bot.state["in_position"] and trading.orders == []     # aucun ordre envoyé
    assert bot.state["paper_quote"] == pytest.approx(50, abs=0.01)   # arrondi au millionième d'action


def test_ai_context_describes_a_stock(tmp_path):
    bot, _, _ = stock_bot(tmp_path)
    df = add_indicators(bot.client.fetch_closed_candles(), bot.settings.strategy)
    text = build_market_context(df, 300.0, bot.state, bot.settings, (100.0, 0.0),
                                now=df.index[-1].to_pydatetime() + timedelta(hours=4))
    assert "Actif : NVDA (action ou ETF américain" in text
    assert "100.00 USD disponibles" in text
    assert "4 h" in text and "30 j" in text


def test_alpaca_requires_keys(monkeypatch):
    from config import ConfigError, load_settings
    monkeypatch.setattr("config.load_dotenv", lambda *_a, **_k: None)
    for name, value in {"EXCHANGE": "alpaca", "SYMBOL": "NVDA", "STRATEGY": "indicators"}.items():
        monkeypatch.setenv(name, value)
    monkeypatch.delenv("API_KEY", raising=False)
    monkeypatch.delenv("API_SECRET", raising=False)
    with pytest.raises(ConfigError, match="Alpaca"):
        load_settings()


def test_error_translation():
    from stocks import translate_error
    assert isinstance(translate_error(api_error(403, "insufficient buying power")), ccxt.InsufficientFunds)
    assert isinstance(translate_error(api_error(403, "forbidden")), ccxt.AuthenticationError)
    assert isinstance(translate_error(api_error(422, "qty must be > 0")), ccxt.InvalidOrder)
    assert isinstance(translate_error(api_error(503, "unavailable")), ccxt.NetworkError)
