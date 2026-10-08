"""
Backtest : rejoue la stratégie sur l'historique pour voir comment elle se
serait comportée, AVANT de risquer de l'argent. Mêmes réglages que le bot
(lus dans le .env), même fonction check_buy_sell_signals.

    python backtest.py                          # 365 jours, exchange du .env
    python backtest.py --days 730 --exchange binance
    python backtest.py --csv bougies.csv        # hors ligne, depuis un fichier

Hypothèses volontairement prudentes :
  * le signal est calculé à la clôture d'une bougie et l'ordre exécuté à
    l'ouverture de la suivante (pas de « triche » avec le futur) ;
  * stop-loss et take-profit sont contrôlés avec le plus bas et le plus haut
    de chaque bougie ; si les deux sont touchés dans la même bougie, on
    suppose que le stop-loss l'a été en premier (pire cas) ;
  * frais (PAPER_FEE_PCT) et glissement (PAPER_SLIPPAGE_PCT) à chaque ordre.

Un bon résultat passé ne garantit RIEN pour l'avenir.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass

import ccxt
import pandas as pd

from config import ConfigError, Settings, load_settings
from risk import compute_buy_cost
from strategy import BUY, OHLCV_COLUMNS, SELL, add_indicators, check_buy_sell_signals, ohlcv_to_dataframe


@dataclass
class Trade:
    entry_time: pd.Timestamp
    exit_time: pd.Timestamp
    entry_price: float
    exit_price: float
    reason: str
    pnl: float        # en USDT, frais inclus
    pnl_pct: float


# ============================================================================
# Données
# ============================================================================

def fetch_history(exchange_id: str, symbol: str, timeframe: str, days: int) -> pd.DataFrame:
    """Télécharge l'historique par paquets (données publiques, sans clé API)."""
    options = {"defaultType": "spot"}
    if exchange_id == "binance":
        options["fetchMarkets"] = {"types": ["spot"]}
    exchange = getattr(ccxt, exchange_id)({"enableRateLimit": True, "options": options})
    exchange.load_markets()
    timeframe_ms = exchange.parse_timeframe(timeframe) * 1000
    since = exchange.milliseconds() - days * 86_400_000
    rows: list[list[float]] = []
    while True:
        batch = exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=1000)
        if not batch or (rows and batch[-1][0] <= rows[-1][0]):
            break
        rows.extend(batch)
        since = batch[-1][0] + timeframe_ms
        if since > exchange.milliseconds():
            break
    now = exchange.milliseconds()
    rows = [row for row in rows if row[0] + timeframe_ms <= now]   # bougies clôturées
    if not rows:
        raise ccxt.ExchangeError("Aucune bougie reçue.")
    return ohlcv_to_dataframe(rows)


def load_csv(path: str) -> pd.DataFrame:
    """Lit un CSV avec les colonnes timestamp, open, high, low, close, volume."""
    raw = pd.read_csv(path)
    raw.columns = [column.strip().lower() for column in raw.columns]
    missing = set(OHLCV_COLUMNS) - set(raw.columns)
    if missing:
        raise ValueError(f"Colonnes manquantes dans {path} : {sorted(missing)}")
    ts = raw["timestamp"]
    if pd.api.types.is_numeric_dtype(ts):
        unit = "ms" if ts.iloc[0] > 1e11 else "s"   # horodatage en millisecondes ou secondes
        raw["timestamp"] = pd.to_datetime(ts, unit=unit, utc=True)
    else:
        raw["timestamp"] = pd.to_datetime(ts, utc=True)
    df = raw.set_index("timestamp")[OHLCV_COLUMNS[1:]].astype(float)
    return df[~df.index.duplicated(keep="last")].sort_index()


# ============================================================================
# Simulation
# ============================================================================

def run_backtest(df: pd.DataFrame, settings: Settings) -> dict:
    """Simule la stratégie bougie par bougie et renvoie les statistiques."""
    params = settings.strategy
    data = add_indicators(df, params)
    fee, slippage = settings.paper_fee, settings.paper_slippage
    start_balance = settings.paper_start_balance

    cash, amount = start_balance, 0.0
    entry_price = entry_cost = 0.0
    entry_time = None
    pending = None             # ordre décidé à la clôture, exécuté à l'ouverture suivante
    fees_paid = 0.0
    candles_in_position = 0
    trades: list[Trade] = []
    equity: list[float] = []

    opens, highs, lows, closes = (data[c].to_numpy() for c in ("open", "high", "low", "close"))

    def close_position(i: int, price: float, reason: str) -> None:
        nonlocal cash, amount, fees_paid
        proceeds = amount * price * (1 - fee)
        fees_paid += amount * price * fee
        pnl = proceeds - entry_cost
        trades.append(Trade(entry_time, data.index[i], entry_price, price, reason, pnl, pnl / entry_cost * 100))
        cash += proceeds
        amount = 0.0

    for i in range(len(data)):
        # 1. Exécution, à l'ouverture, de l'ordre décidé à la bougie précédente.
        if pending == BUY and amount == 0:
            entry_price = opens[i] * (1 + slippage)
            entry_cost = compute_buy_cost(cash, settings.position_size, settings.max_order_cost)
            amount = entry_cost / entry_price * (1 - fee)
            fees_paid += entry_cost * fee
            cash -= entry_cost
            entry_time = data.index[i]
        elif pending == SELL and amount > 0:
            close_position(i, opens[i] * (1 - slippage), "SIGNAL")
        pending = None

        # 2. Stop-loss / take-profit pendant la bougie.
        if amount > 0:
            candles_in_position += 1
            sl = entry_price * (1 - settings.stop_loss)
            tp = entry_price * (1 + settings.take_profit)
            if lows[i] <= sl:
                # Si le marché ouvre déjà sous le stop (trou de cotation), on vend à l'ouverture.
                close_position(i, min(opens[i], sl) * (1 - slippage), "STOP-LOSS")
            elif highs[i] >= tp:
                close_position(i, max(opens[i], tp) * (1 - slippage), "TAKE-PROFIT")

        # 3. Signal à la clôture (mêmes règles que le bot en direct).
        if i >= 1 and i + 1 < len(data):
            signal = check_buy_sell_signals(data.iloc[i - 1:i + 1], params)
            if amount == 0 and signal == BUY:
                pending = BUY
            elif amount > 0 and signal == SELL:
                pending = SELL

        equity.append(cash + amount * closes[i])

    equity_series = pd.Series(equity, index=data.index)
    # Les statistiques démarrent quand l'EMA lente est calculable (période de chauffe).
    first_valid = data["ema_slow"].first_valid_index()
    if first_valid is None:
        raise ValueError(f"Historique trop court : il faut plus de {params.ema_slow} bougies.")
    equity_series = equity_series.loc[first_valid:]
    drawdown = (equity_series / equity_series.cummax() - 1) * 100

    final_equity = equity_series.iloc[-1]
    wins = [t for t in trades if t.pnl > 0]
    losses = [t for t in trades if t.pnl <= 0]
    return {
        "period": (first_valid, data.index[-1]),
        "candles": len(equity_series),
        "start_balance": start_balance,
        "final_equity": final_equity,
        "return_pct": (final_equity / start_balance - 1) * 100,
        "buy_hold_pct": (data["close"].iloc[-1] / data.loc[first_valid, "close"] - 1) * 100,
        "max_drawdown_pct": drawdown.min(),
        "trades": trades,
        "win_rate": len(wins) / len(trades) * 100 if trades else 0.0,
        "avg_win_pct": sum(t.pnl_pct for t in wins) / len(wins) if wins else 0.0,
        "avg_loss_pct": sum(t.pnl_pct for t in losses) / len(losses) if losses else 0.0,
        "fees_paid": fees_paid,
        "exposure_pct": candles_in_position / len(equity_series) * 100,
        "open_position": amount > 0,
    }


def print_report(result: dict, settings: Settings) -> None:
    quote = settings.symbol.split("/")[1]
    start, end = result["period"]
    print()
    print(f"=== Backtest {settings.symbol} {settings.timeframe} | {start:%Y-%m-%d} -> {end:%Y-%m-%d} "
          f"({result['candles']} bougies) ===")
    print(f"Réglages : {settings.position_size * 100:.0f} % du solde par achat, stop-loss "
          f"-{settings.stop_loss * 100:g} %, take-profit +{settings.take_profit * 100:g} %, "
          f"frais {settings.paper_fee * 100:g} % par ordre")
    print()
    for t in result["trades"][-20:]:
        print(f"  {t.entry_time:%Y-%m-%d %H:%M} -> {t.exit_time:%Y-%m-%d %H:%M}  "
              f"{t.entry_price:>10.2f} -> {t.exit_price:>10.2f}  {t.reason:<11}  "
              f"{t.pnl:+8.2f} {quote} ({t.pnl_pct:+.2f} %)")
    if len(result["trades"]) > 20:
        print(f"  ... ({len(result['trades']) - 20} trades plus anciens non affichés)")
    print()
    print(f"Capital         : {result['start_balance']:.2f} -> {result['final_equity']:.2f} {quote}"
          f"  ({result['return_pct']:+.2f} %)")
    print(f"Buy & hold      : {result['buy_hold_pct']:+.2f} % (acheter au début et ne rien faire)")
    print(f"Trades          : {len(result['trades'])} | gagnants {result['win_rate']:.0f} % | "
          f"gain moyen {result['avg_win_pct']:+.2f} % | perte moyenne {result['avg_loss_pct']:+.2f} %")
    print(f"Pire baisse     : {result['max_drawdown_pct']:.2f} % du capital")
    print(f"Frais payés     : {result['fees_paid']:.2f} {quote}")
    print(f"Temps investi   : {result['exposure_pct']:.0f} % du temps")
    if result["open_position"]:
        print("(une position est encore ouverte à la fin : elle est comptée à son dernier prix)")
    print()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Backtest de la stratégie du bot.")
    parser.add_argument("--days", type=int, default=365, help="profondeur d'historique (défaut : 365 jours)")
    parser.add_argument("--exchange", help="exchange pour les données (défaut : EXCHANGE du .env)")
    parser.add_argument("--csv", help="fichier CSV de bougies à utiliser au lieu de l'exchange")
    parser.add_argument("--save-csv", help="enregistre les bougies téléchargées dans ce fichier")
    args = parser.parse_args(argv)

    try:
        settings = load_settings(for_backtest=True)
    except ConfigError as exc:
        print(f"Configuration invalide : {exc}")
        return 2

    try:
        if args.csv:
            df = load_csv(args.csv)
        else:
            exchange_id = (args.exchange or settings.exchange_id).lower()
            print(f"Téléchargement de {args.days} jours de bougies {settings.symbol} {settings.timeframe} "
                  f"sur {exchange_id}...")
            df = fetch_history(exchange_id, settings.symbol, settings.timeframe, args.days)
            covered_days = (df.index[-1] - df.index[0]).days
            if covered_days < args.days * 0.9:
                print(f"Attention : l'exchange n'a fourni que {covered_days} jours d'historique "
                      "(Kraken se limite aux 720 dernières bougies). "
                      "Essayez --exchange binance pour un historique plus long.")
            if args.save_csv:
                out = df.reset_index()
                epoch = pd.Timestamp("1970-01-01", tz="UTC")
                out["timestamp"] = (out["timestamp"] - epoch) // pd.Timedelta(milliseconds=1)
                out.to_csv(args.save_csv, index=False)
        result = run_backtest(df, settings)
    except (ccxt.BaseError, ValueError, OSError) as exc:
        print(f"Backtest impossible : {exc}")
        return 1

    print_report(result, settings)
    return 0


if __name__ == "__main__":
    sys.exit(main())
