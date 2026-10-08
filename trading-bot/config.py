"""
Configuration du bot : lecture du fichier .env et validation des paramètres.

Aucune clé API n'est écrite dans le code : elles sont lues depuis le fichier
.env (voir .env.example) grâce à python-dotenv. Toutes les autres options
(paire, unité de temps, stop-loss...) se règlent aussi dans ce fichier.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import ccxt
from dotenv import load_dotenv

# Dossier du bot : le .env, le journal et les fichiers d'état y sont rangés,
# quel que soit le dossier depuis lequel on lance le script.
BASE_DIR = Path(__file__).resolve().parent
LOG_FILE = BASE_DIR / "bot_trading.log"

VALID_MODES = ("paper", "testnet", "live")

# Mot à recopier dans CONFIRM_LIVE pour autoriser les ordres en argent réel.
LIVE_CONFIRMATION_WORD = "OUI"


class ConfigError(ValueError):
    """Paramètre manquant ou invalide dans le fichier .env."""


@dataclass(frozen=True)
class StrategyParams:
    """Réglages des indicateurs (utilisés par strategy.py et backtest.py)."""

    rsi_period: int = 14
    rsi_buy_level: float = 40.0    # rebond du RSI au-dessus de ce niveau = achat
    rsi_sell_level: float = 70.0   # RSI au-dessus = surachat = vente
    ema_fast: int = 50
    ema_slow: int = 200


@dataclass(frozen=True)
class Settings:
    """Tous les paramètres du bot, déjà convertis et vérifiés."""

    mode: str                  # "paper", "testnet" ou "live"
    exchange_id: str           # identifiant ccxt : "kraken", "binance"...
    api_key: str
    api_secret: str
    symbol: str                # paire, ex. "BTC/USDT"
    timeframe: str             # unité des bougies, ex. "4h" ou "1d"
    candles_limit: int         # nombre de bougies téléchargées à chaque analyse
    position_size: float       # part du solde investie à l'achat (0.5 = 50 %)
    max_order_cost: float      # plafond d'un achat en USDT (0 = pas de plafond)
    stop_loss: float           # 0.03 = vente si le prix baisse de 3 %
    take_profit: float         # 0.08 = vente si le prix monte de 8 %
    strategy: StrategyParams
    analysis_interval: int     # secondes entre deux analyses des bougies
    price_check_interval: int  # secondes entre deux contrôles stop-loss / take-profit
    paper_start_balance: float
    paper_fee: float           # frais simulés par ordre (0.004 = 0,40 %)
    paper_slippage: float      # écart de prix simulé sur un ordre au marché
    log_level: str
    state_file: Path

    @property
    def uses_real_orders(self) -> bool:
        """Vrai si des ordres sont envoyés à l'exchange (testnet ou réel)."""
        return self.mode in ("testnet", "live")


# --------------------------------------------------------------------------
# Petites fonctions de lecture : chaque valeur du .env est du texte, on la
# convertit et on vérifie qu'elle reste dans une plage raisonnable.
# --------------------------------------------------------------------------

def _get_str(name: str, default: str) -> str:
    value = os.getenv(name, "").strip()
    return value or default


def _get_float(name: str, default: float, minimum: float, maximum: float) -> float:
    raw = _get_str(name, str(default)).replace(",", ".")  # accepte « 0,4 »
    try:
        value = float(raw)
    except ValueError:
        raise ConfigError(f"{name} doit être un nombre (valeur lue : {raw!r}).") from None
    if not minimum <= value <= maximum:
        raise ConfigError(f"{name} doit être compris entre {minimum} et {maximum} (valeur lue : {value}).")
    return value


def _get_int(name: str, default: int, minimum: int, maximum: int) -> int:
    value = _get_float(name, default, minimum, maximum)
    if not value.is_integer():
        raise ConfigError(f"{name} doit être un nombre entier (valeur lue : {value}).")
    return int(value)


def load_settings(for_backtest: bool = False) -> Settings:
    """
    Lit le fichier .env et renvoie la configuration validée.

    for_backtest=True ignore les contrôles liés aux clés et au mode, inutiles
    pour rejouer l'historique (seules les données publiques sont lues).
    Lève ConfigError avec un message clair si un paramètre est incorrect.
    """
    load_dotenv(BASE_DIR / ".env")

    mode = _get_str("MODE", "paper").lower()
    if mode not in VALID_MODES:
        raise ConfigError(f"MODE doit valoir paper, testnet ou live (valeur lue : {mode!r}).")

    exchange_id = _get_str("EXCHANGE", "kraken").lower()
    if exchange_id not in ccxt.exchanges:
        raise ConfigError(f"EXCHANGE inconnu de ccxt : {exchange_id!r}.")

    api_key = os.getenv("API_KEY", "").strip()
    api_secret = os.getenv("API_SECRET", "").strip()

    strategy = StrategyParams(
        rsi_period=_get_int("RSI_PERIOD", 14, 2, 100),
        rsi_buy_level=_get_float("RSI_BUY_LEVEL", 40, 1, 99),
        rsi_sell_level=_get_float("RSI_SELL_LEVEL", 70, 1, 99),
        ema_fast=_get_int("EMA_FAST", 50, 2, 500),
        ema_slow=_get_int("EMA_SLOW", 200, 3, 1000),
    )
    if strategy.ema_fast >= strategy.ema_slow:
        raise ConfigError("EMA_FAST doit être plus petite que EMA_SLOW.")
    if strategy.rsi_buy_level >= strategy.rsi_sell_level:
        raise ConfigError("RSI_BUY_LEVEL doit être plus petit que RSI_SELL_LEVEL.")

    # Il faut nettement plus de bougies que la plus longue moyenne mobile,
    # sinon l'EMA 200 n'a pas le temps de se stabiliser.
    candles_limit = _get_int("CANDLES_LIMIT", 500, 50, 1000)
    if candles_limit < strategy.ema_slow + 50:
        raise ConfigError(f"CANDLES_LIMIT doit valoir au moins EMA_SLOW + 50 ({strategy.ema_slow + 50}).")

    if not for_backtest:
        if mode in ("testnet", "live") and not (api_key and api_secret):
            raise ConfigError(f"Le mode {mode} nécessite API_KEY et API_SECRET dans le fichier .env.")
        if mode == "live" and _get_str("CONFIRM_LIVE", "").upper() != LIVE_CONFIRMATION_WORD:
            raise ConfigError(
                "Mode live (argent réel) refusé : ajoutez CONFIRM_LIVE=OUI dans le .env "
                "une fois les tests en paper trading terminés."
            )

    return Settings(
        mode=mode,
        exchange_id=exchange_id,
        api_key=api_key,
        api_secret=api_secret,
        symbol=_get_str("SYMBOL", "BTC/USDT").upper(),
        timeframe=_get_str("TIMEFRAME", "4h"),
        candles_limit=candles_limit,
        # Dans le .env les pourcentages s'écrivent « 50 », « 3 », « 8 » :
        # on les convertit ici en fractions (0.5, 0.03, 0.08).
        position_size=_get_float("POSITION_SIZE_PCT", 50, 1, 100) / 100,
        max_order_cost=_get_float("MAX_ORDER_COST", 0, 0, 1_000_000_000),
        stop_loss=_get_float("STOP_LOSS_PCT", 3, 0.1, 50) / 100,
        take_profit=_get_float("TAKE_PROFIT_PCT", 8, 0.1, 500) / 100,
        strategy=strategy,
        analysis_interval=_get_int("ANALYSIS_INTERVAL_SECONDS", 900, 60, 86400),
        price_check_interval=_get_int("PRICE_CHECK_INTERVAL_SECONDS", 60, 10, 3600),
        paper_start_balance=_get_float("PAPER_START_BALANCE", 100, 1, 1_000_000),
        paper_fee=_get_float("PAPER_FEE_PCT", 0.4, 0, 5) / 100,
        paper_slippage=_get_float("PAPER_SLIPPAGE_PCT", 0.05, 0, 5) / 100,
        log_level=_get_str("LOG_LEVEL", "INFO").upper(),
        # Un fichier d'état par mode : le paper trading ne touche jamais
        # à la position enregistrée en argent réel, et inversement.
        state_file=BASE_DIR / f"state_{mode}.json",
    )
