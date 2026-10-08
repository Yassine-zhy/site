import pandas as pd
import pytest

from config import StrategyParams
from risk import STOP_LOSS, TAKE_PROFIT, check_exit, compute_buy_cost
from strategy import BUY, HOLD, SELL, add_indicators, check_buy_sell_signals, ohlcv_to_dataframe

from conftest import downtrend, make_ohlcv, uptrend_with_pullback

PARAMS = StrategyParams()
BUY_INDEX = 309   # bougie du rebond dans uptrend_with_pullback()


def signals(closes):
    df = add_indicators(ohlcv_to_dataframe(make_ohlcv(closes)), PARAMS)
    return [check_buy_sell_signals(df.iloc[: i + 1], PARAMS) for i in range(len(df))]


def test_buy_on_rsi_rebound_in_uptrend():
    result = signals(uptrend_with_pullback())
    assert [i for i, s in enumerate(result) if s == BUY] == [BUY_INDEX]


def test_never_buy_in_downtrend():
    result = signals(downtrend())
    assert BUY not in result
    assert result[-1] == SELL   # EMA 50 sous l'EMA 200


def test_sell_when_overbought():
    closes = uptrend_with_pullback()
    closes += [closes[-1] * 1.03 ** k for k in range(1, 6)]   # forte hausse
    assert signals(closes)[-1] == SELL


def test_hold_when_history_too_short():
    assert set(signals(uptrend_with_pullback()[:150])) == {HOLD}


def test_indicators_required():
    df = ohlcv_to_dataframe(make_ohlcv(uptrend_with_pullback()))
    with pytest.raises(ValueError):
        check_buy_sell_signals(df, PARAMS)


def test_signal_ignores_future_rows():
    """Le signal d'une bougie ne doit dépendre que du passé (pas de biais de look-ahead)."""
    closes = uptrend_with_pullback()
    full = add_indicators(ohlcv_to_dataframe(make_ohlcv(closes)), PARAMS)
    partial = add_indicators(ohlcv_to_dataframe(make_ohlcv(closes[: BUY_INDEX + 1])), PARAMS)
    pd.testing.assert_frame_equal(full.iloc[: BUY_INDEX + 1], partial)


def test_stop_loss_and_take_profit_thresholds():
    assert check_exit(100, 97.01, 0.03, 0.08) is None
    assert check_exit(100, 97.0, 0.03, 0.08) == STOP_LOSS
    assert check_exit(100, 90, 0.03, 0.08) == STOP_LOSS
    assert check_exit(100, 107.99, 0.03, 0.08) is None
    assert check_exit(100, 108.0, 0.03, 0.08) == TAKE_PROFIT


def test_position_size():
    assert compute_buy_cost(100, 0.5) == 50
    assert compute_buy_cost(0, 0.5) == 0
    assert compute_buy_cost(10_000, 0.5, max_cost=50) == 50
    assert compute_buy_cost(60, 0.5, max_cost=50) == 30
