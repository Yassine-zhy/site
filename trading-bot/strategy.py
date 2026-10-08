"""
Le « cerveau » du bot : indicateurs techniques et signaux d'achat / vente.

Ce module ne parle jamais à l'exchange : il reçoit un DataFrame de bougies et
renvoie une décision. On peut donc changer d'indicateurs ici sans toucher au
reste du code, et la même logique sert au bot et au backtest.

Règles par défaut (modifiables dans le .env) :
  * Tendance de fond haussière : EMA 50 au-dessus de l'EMA 200 ET clôture
    au-dessus de l'EMA 200.
  * BUY  : tendance haussière ET le RSI repasse au-dessus de 40 (fin d'un repli).
    En tendance haussière le RSI descend rarement sous 30 : il oscille plutôt
    entre 40 et 80, et 40 joue le rôle de zone de survente.
  * SELL : RSI au-dessus de 70 (surachat) OU EMA 50 passée sous l'EMA 200
    (la tendance de fond s'est retournée).
  * HOLD : dans tous les autres cas.
"""

from __future__ import annotations

import pandas as pd
from ta.momentum import RSIIndicator
from ta.trend import EMAIndicator

from config import StrategyParams

BUY = "BUY"
SELL = "SELL"
HOLD = "HOLD"

OHLCV_COLUMNS = ["timestamp", "open", "high", "low", "close", "volume"]


def ohlcv_to_dataframe(ohlcv: list[list[float]]) -> pd.DataFrame:
    """
    Transforme la liste renvoyée par ccxt.fetch_ohlcv en DataFrame pandas.

    Chaque ligne de ccxt vaut [horodatage_ms, open, high, low, close, volume].
    L'index devient la date d'ouverture de la bougie (en UTC).
    """
    df = pd.DataFrame(ohlcv, columns=OHLCV_COLUMNS)
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    df = df.set_index("timestamp").astype(float)
    # Sécurité : bougies triées dans l'ordre chronologique et sans doublon.
    df = df[~df.index.duplicated(keep="last")].sort_index()
    return df


def add_indicators(df: pd.DataFrame, params: StrategyParams) -> pd.DataFrame:
    """Ajoute les colonnes rsi, ema_fast et ema_slow (calculées par la bibliothèque ta)."""
    df = df.copy()
    df["rsi"] = RSIIndicator(close=df["close"], window=params.rsi_period).rsi()
    df["ema_fast"] = EMAIndicator(close=df["close"], window=params.ema_fast).ema_indicator()
    df["ema_slow"] = EMAIndicator(close=df["close"], window=params.ema_slow).ema_indicator()
    return df


def evaluate_signal(df: pd.DataFrame, params: StrategyParams) -> tuple[str, str]:
    """
    Comme check_buy_sell_signals, mais renvoie aussi la raison en clair
    (utile dans le journal pour comprendre chaque décision).
    """
    required = {"close", "rsi", "ema_fast", "ema_slow"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Colonnes manquantes : {sorted(missing)}. Appelez add_indicators(df) d'abord.")

    if len(df) < 2:
        return HOLD, "pas assez de bougies"

    prev, last = df.iloc[-2], df.iloc[-1]
    needed = [prev["rsi"], last["rsi"], last["ema_fast"], last["ema_slow"]]
    if any(pd.isna(value) for value in needed):
        return HOLD, f"historique trop court pour l'EMA {params.ema_slow}"

    uptrend = last["ema_fast"] > last["ema_slow"] and last["close"] > last["ema_slow"]
    rsi_rebound = prev["rsi"] < params.rsi_buy_level <= last["rsi"]

    if last["rsi"] >= params.rsi_sell_level:
        return SELL, f"RSI {last['rsi']:.1f} >= {params.rsi_sell_level:g} (surachat)"
    if last["ema_fast"] < last["ema_slow"]:
        return SELL, "EMA rapide sous l'EMA lente (tendance baissière)"
    if uptrend and rsi_rebound:
        return BUY, (
            f"tendance haussière et RSI qui rebondit "
            f"({prev['rsi']:.1f} -> {last['rsi']:.1f}, seuil {params.rsi_buy_level:g})"
        )
    if not uptrend:
        return HOLD, "clôture sous l'EMA lente : pas de tendance haussière claire"
    return HOLD, f"tendance haussière, en attente d'un rebond du RSI au-dessus de {params.rsi_buy_level:g}"


def check_buy_sell_signals(df: pd.DataFrame, params: StrategyParams | None = None) -> str:
    """
    Analyse les DEUX DERNIÈRES bougies clôturées et renvoie "BUY", "SELL" ou "HOLD".

    df doit contenir les colonnes ajoutées par add_indicators(). Le signal ne
    dépend pas de la position en cours : c'est le bot qui décide d'ignorer un
    BUY s'il est déjà investi, ou un SELL s'il n'a rien à vendre.
    """
    signal, _reason = evaluate_signal(df, params or StrategyParams())
    return signal
