import json

import ccxt
import pytest

from backtest import run_backtest
from strategy import ohlcv_to_dataframe

from conftest import TF_MS, FakeExchange, make_bot, make_ohlcv, make_settings, uptrend_with_pullback

BUY_INDEX = 309


@pytest.fixture
def buy_candles():
    """Bougies dont la dernière clôturée donne un signal BUY."""
    return make_ohlcv(uptrend_with_pullback()[: BUY_INDEX + 1])


# ------------------------------------------------------------------ paper
def test_paper_buy_uses_half_of_balance(tmp_path, buy_candles):
    bot = make_bot(make_settings(tmp_path), FakeExchange(buy_candles))
    bot.run_cycle()
    state = bot.state
    assert state["in_position"]
    assert state["paper_quote"] == pytest.approx(50, abs=0.01)
    assert state["entry_cost"] == pytest.approx(50, abs=0.01)
    assert state["amount"] == pytest.approx(50 / buy_candles[-1][4] * 0.996, rel=1e-3)
    # L'état est bien écrit sur le disque.
    saved = json.loads((tmp_path / "state_paper.json").read_text(encoding="utf-8"))
    assert saved["in_position"] and saved["symbol"] == "BTC/USDT"


def test_unclosed_candle_is_ignored(tmp_path, buy_candles):
    """Une bougie en cours (qui annulerait le signal) ne doit pas être prise en compte."""
    candles = buy_candles + [[buy_candles[-1][0] + TF_MS, 1, 1, 1, 1, 1]]
    fake = FakeExchange(candles, price=buy_candles[-1][4])
    fake.now = candles[-1][0] + 60_000          # la dernière bougie vient d'ouvrir
    bot = make_bot(make_settings(tmp_path), fake)
    df = bot.client.fetch_closed_candles()
    assert len(df) == len(buy_candles)
    bot.run_cycle()
    assert bot.state["in_position"]


def test_stop_loss_sells_at_market(tmp_path, buy_candles):
    fake = FakeExchange(buy_candles)
    bot = make_bot(make_settings(tmp_path), fake)
    bot.run_cycle()
    entry = bot.state["entry_price"]

    fake.price = entry * 0.975                  # -2,5 % : on garde
    bot.run_cycle()
    assert bot.state["in_position"]

    fake.price = entry * 0.969                  # -3,1 % : stop-loss
    bot.run_cycle()
    assert not bot.state["in_position"]
    assert bot.state["trades"] == 1 and bot.state["wins"] == 0
    assert bot.state["realized_pnl"] == pytest.approx(-50 * (1 - 0.969 * 0.996 ** 2), rel=1e-2)
    assert bot.state["paper_base"] == pytest.approx(0, abs=1e-12)


def test_take_profit_and_no_rebuy_on_same_signal(tmp_path, buy_candles):
    fake = FakeExchange(buy_candles)
    bot = make_bot(make_settings(tmp_path), fake)
    bot.run_cycle()
    fake.price = bot.state["entry_price"] * 1.081
    bot.run_cycle()
    assert not bot.state["in_position"]
    assert bot.state["wins"] == 1 and bot.state["realized_pnl"] > 0

    # Nouvelle analyse sur la même bougie : le signal BUY a déjà servi.
    bot._next_analysis = 0
    bot.run_cycle()
    assert not bot.state["in_position"]


def test_position_survives_restart(tmp_path, buy_candles):
    settings = make_settings(tmp_path)
    fake = FakeExchange(buy_candles)
    bot = make_bot(settings, fake)
    bot.run_cycle()
    entry = bot.state["entry_price"]

    restarted = make_bot(settings, fake)
    assert restarted.state["in_position"] and restarted.state["entry_price"] == entry
    fake.price = entry * 0.96
    restarted.run_cycle()
    assert not restarted.state["in_position"]


def test_network_errors_do_not_crash(tmp_path, buy_candles):
    fake = FakeExchange(buy_candles)
    bot = make_bot(make_settings(tmp_path), fake)
    fake.fail["fetch_ohlcv"] = ccxt.RequestTimeout("timeout")
    assert bot.run_cycle() == 30                # 1re erreur : 30 s
    assert bot.run_cycle() == 60                # 2e erreur : 60 s
    fake.fail.clear()
    assert bot.run_cycle() == 60                # rétabli : rythme normal
    assert bot.state["in_position"]


def test_unexpected_error_does_not_crash(tmp_path, buy_candles):
    fake = FakeExchange(buy_candles)
    bot = make_bot(make_settings(tmp_path), fake)
    fake.fail["fetch_ohlcv"] = KeyError("bug")
    assert bot.run_cycle() == 30
    assert not bot.stop_event.is_set()


def test_authentication_error_stops_bot(tmp_path, buy_candles):
    fake = FakeExchange(buy_candles)
    bot = make_bot(make_settings(tmp_path), fake)
    fake.fail["fetch_ohlcv"] = ccxt.AuthenticationError("invalid key")
    bot.run_cycle()
    assert bot.stop_event.is_set()


def test_buy_skipped_below_exchange_minimum(tmp_path, buy_candles):
    bot = make_bot(make_settings(tmp_path, paper_start_balance=8.0), FakeExchange(buy_candles))
    bot.run_cycle()                              # 50 % de 8 = 4 USDT < 5 USDT minimum
    assert not bot.state["in_position"]


# ------------------------------------------------------------------- live
def test_live_buy_records_amount_net_of_fees(tmp_path, buy_candles):
    fake = FakeExchange(buy_candles, base_fee=0.001)
    bot = make_bot(make_settings(tmp_path, mode="live"), fake)
    bot.run_cycle()
    assert bot.state["in_position"]
    assert bot.state["amount"] == pytest.approx(fake.balances["BTC"])   # quantité réellement reçue
    assert bot.state["entry_cost"] == pytest.approx(100 - fake.balances["USDT"])

    fake.price = bot.state["entry_price"] * 0.95
    bot.run_cycle()
    assert not bot.state["in_position"]
    assert fake.balances["BTC"] == pytest.approx(0, abs=1e-6)


def test_live_sell_never_touches_preexisting_crypto(tmp_path, buy_candles):
    fake = FakeExchange(buy_candles, base=1.0)  # 1 BTC déjà sur le compte
    bot = make_bot(make_settings(tmp_path, mode="live"), fake)
    bot.run_cycle()
    bought = bot.state["amount"]
    fake.price = bot.state["entry_price"] * 1.1
    bot.run_cycle()
    assert fake.orders[-1]["filled"] == pytest.approx(bought, rel=1e-5)
    assert fake.balances["BTC"] == pytest.approx(1.0, abs=1e-5)


def test_live_order_executed_despite_timeout(tmp_path, buy_candles):
    fake = FakeExchange(buy_candles)
    fake.fail["create_order_after_fill"] = ccxt.RequestTimeout("timeout")
    bot = make_bot(make_settings(tmp_path, mode="live"), fake)
    bot.run_cycle()
    assert bot.state["in_position"]             # détecté grâce aux soldes
    assert len(fake.orders) == 1                # pas de second achat


def test_live_position_kept_when_balance_unreadable_after_order(tmp_path, buy_candles):
    fake = FakeExchange(buy_candles)
    bot = make_bot(make_settings(tmp_path, mode="live"), fake)
    original_buy = fake.create_market_buy_order

    def buy_then_balance_down(symbol, amount):
        order = original_buy(symbol, amount)
        fake.fail["fetch_balance"] = ccxt.NetworkError("down")
        return order

    fake.create_market_buy_order = buy_then_balance_down
    bot.run_cycle()
    assert bot.state["in_position"]             # position enregistrée malgré tout
    assert len(fake.orders) == 1


def test_live_order_status_unknown_is_resolved_later(tmp_path, buy_candles):
    fake = FakeExchange(buy_candles)
    bot = make_bot(make_settings(tmp_path, mode="live"), fake)
    original_buy = fake.create_market_buy_order

    def buy_then_network_down(symbol, amount):
        fake._execute("buy", amount)                         # l'ordre passe...
        fake.fail["fetch_balance"] = ccxt.NetworkError("down")  # ...puis plus de réseau
        raise ccxt.RequestTimeout("timeout")

    fake.create_market_buy_order = buy_then_network_down
    bot.run_cycle()
    assert bot.state["pending_buy"] is not None and not bot.state["in_position"]

    fake.fail.clear()
    fake.create_market_buy_order = original_buy
    bot.run_cycle()
    assert bot.state["pending_buy"] is None
    assert bot.state["in_position"]             # stop-loss de nouveau actif
    assert bot.state["amount"] == pytest.approx(fake.balances["BTC"])
    assert len(fake.orders) == 1


def test_live_position_sold_manually_is_reset(tmp_path, buy_candles):
    settings = make_settings(tmp_path, mode="live")
    fake = FakeExchange(buy_candles)
    bot = make_bot(settings, fake)
    bot.run_cycle()
    fake.balances["BTC"] = 0.0                  # vendu à la main sur le site
    restarted = make_bot(settings, fake)
    restarted.run_cycle()
    assert not restarted.state["in_position"]


# --------------------------------------------------------------- backtest
def test_backtest_runs_and_counts_fees(tmp_path):
    closes = uptrend_with_pullback()
    closes += [closes[-1] * 1.015 ** k for k in range(1, 11)]   # la hausse continue
    df = ohlcv_to_dataframe(make_ohlcv(closes))
    result = run_backtest(df, make_settings(tmp_path))
    assert len(result["trades"]) == 1
    trade = result["trades"][0]
    assert trade.entry_time == df.index[BUY_INDEX + 1]   # exécuté à l'ouverture suivante
    assert result["fees_paid"] > 0
    assert result["final_equity"] == pytest.approx(100 + trade.pnl)
