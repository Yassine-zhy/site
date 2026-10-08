"""
Bot de swing trading crypto : boucle principale.

Lancement :
    python bot.py           tourne en continu (Ctrl+C pour l'arrêter proprement)
    python bot.py --once    une seule analyse puis arrêt (pratique pour tester)

Tout se règle dans le fichier .env (voir .env.example). Par défaut le bot est
en mode « paper » : il utilise les vrais prix du marché mais ne passe aucun
ordre réel.

Organisation d'un passage de boucle (toutes les PRICE_CHECK_INTERVAL_SECONDS) :
  1. Si une position est ouverte : contrôle stop-loss / take-profit sur le
     dernier prix, vente au marché immédiate si un seuil est franchi.
  2. Toutes les ANALYSIS_INTERVAL_SECONDS : téléchargement des bougies,
     calcul des indicateurs, signal BUY / SELL / HOLD, puis exécution.
"""

from __future__ import annotations

import argparse
import logging
import signal
import sys
import threading
import time
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from typing import Any

import ccxt

from broker import ExchangeClient, Fill, LiveTrader, OrderStatusUnknown, PaperTrader
from config import LOG_FILE, ConfigError, Settings, load_settings
from risk import STOP_LOSS, check_exit, compute_buy_cost, pnl_pct, stop_loss_price, take_profit_price
from state import StateStore
from strategy import BUY, SELL, add_indicators, evaluate_signal

log = logging.getLogger("bot")

MAX_BACKOFF_SECONDS = 300   # attente maximale entre deux essais après des erreurs

MODE_LABELS = {
    "paper": "PAPER (ordres simulés, aucun argent engagé)",
    "testnet": "TESTNET (ordres réels sur de l'argent fictif)",
    "live": "LIVE (ARGENT RÉEL)",
}


# ============================================================================
# Journalisation
# ============================================================================

def setup_logging(level: str = "INFO") -> None:
    """Écrit chaque événement, horodaté, dans la console ET dans bot_trading.log."""
    formatter = logging.Formatter("%(asctime)s | %(levelname)-8s | %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

    # Fichier tournant : 5 Mo maximum, 5 anciens fichiers conservés.
    file_handler = RotatingFileHandler(LOG_FILE, maxBytes=5_000_000, backupCount=5, encoding="utf-8")
    file_handler.setFormatter(formatter)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

    for old_handler in log.handlers[:]:
        old_handler.close()
        log.removeHandler(old_handler)
    log.addHandler(file_handler)
    log.addHandler(console_handler)
    log.setLevel(getattr(logging, level, logging.INFO))
    log.propagate = False


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ============================================================================
# Le bot
# ============================================================================

class TradingBot:
    """Relie la stratégie, la gestion des risques et l'exécution des ordres."""

    def __init__(self, settings: Settings, client: ExchangeClient, trader, store: StateStore,
                 state: dict[str, Any], stop_event: threading.Event):
        self.settings = settings
        self.client = client
        self.trader = trader          # LiveTrader ou PaperTrader
        self.store = store
        self.state = state
        self.stop_event = stop_event
        self._next_analysis = 0.0     # 0 = analyse dès le premier passage
        self._errors = 0              # erreurs consécutives (pour espacer les essais)
        self._reconciled = False

    # ------------------------------------------------------------- boucle
    def run(self) -> None:
        """Boucle principale : tourne jusqu'à Ctrl+C ou une erreur fatale."""
        log.info(
            "Boucle démarrée : analyse toutes les %d min, contrôle stop-loss / take-profit toutes les %d s.",
            self.settings.analysis_interval // 60, self.settings.price_check_interval,
        )
        while not self.stop_event.is_set():
            wait = self.run_cycle()
            # Pause interruptible : Ctrl+C arrête le bot sans attendre la fin du délai.
            self.stop_event.wait(wait)
        log.info("Bot arrêté. Résultat cumulé : %+.2f %s sur %d trade(s).",
                 self.state["realized_pnl"], self.client.quote, self.state["trades"])

    def run_cycle(self) -> float:
        """
        Un passage de boucle, protégé contre toutes les erreurs : le bot ne
        doit jamais s'arrêter à cause d'une coupure réseau ou d'un refus d'ordre.
        Renvoie le nombre de secondes à attendre avant le passage suivant.
        """
        try:
            self._cycle()
            self._errors = 0
            return self.settings.price_check_interval

        # L'ordre des « except » compte : les erreurs les plus précises d'abord.
        except ccxt.AuthenticationError as exc:
            # Clé invalide, révoquée ou sans permission : inutile d'insister.
            log.critical("Clés API refusées : %s. Vérifiez API_KEY, API_SECRET et leurs permissions. Arrêt du bot.", exc)
            self.stop_event.set()
            return 0
        except ccxt.InsufficientFunds as exc:
            log.error("Fonds insuffisants : %s. Ordre abandonné, nouvelle analyse au prochain intervalle.", exc)
        except ccxt.InvalidOrder as exc:
            log.error("Ordre refusé par l'exchange : %s. Nouvelle analyse au prochain intervalle.", exc)
        except ccxt.NetworkError as exc:
            # Timeout, coupure Internet, exchange en maintenance, limite de requêtes...
            self._errors += 1
            self._next_analysis = 0.0     # on refait l'analyse dès que ça repasse
            wait = self._backoff()
            log.warning("Problème de connexion (%s : %s). Nouvel essai dans %d s.", type(exc).__name__, exc, wait)
            return wait
        except ccxt.ExchangeError as exc:
            self._errors += 1
            wait = self._backoff()
            log.error("Erreur renvoyée par l'exchange : %s. Nouvel essai dans %d s.", exc, wait)
            return wait
        except Exception:  # noqa: BLE001 - dernier filet de sécurité
            self._errors += 1
            wait = self._backoff()
            log.exception("Erreur inattendue. Nouvel essai dans %d s.", wait)
            return wait
        return self.settings.price_check_interval

    def _backoff(self) -> int:
        """30 s, 60 s, 120 s... plafonné à 5 min pour garder le stop-loss sous contrôle."""
        return min(30 * 2 ** (self._errors - 1), MAX_BACKOFF_SECONDS)

    def _cycle(self) -> None:
        if not self._reconciled:
            self.reconcile_position()
            self._reconciled = True
        if self.state.get("pending_buy"):
            self.resolve_pending_buy()

        # 1. La gestion du risque passe avant tout le reste.
        if self.state["in_position"]:
            self.check_stop_loss_take_profit()

        # 2. Analyse des bougies à intervalle régulier.
        if time.monotonic() >= self._next_analysis:
            # Programmée AVANT l'analyse : un ordre refusé n'est pas retenté
            # toutes les minutes.
            self._next_analysis = time.monotonic() + self.settings.analysis_interval
            self.analyze_and_trade()

    # ----------------------------------------------------- gestion du risque
    def check_stop_loss_take_profit(self) -> None:
        """Vend immédiatement au marché si le stop-loss ou le take-profit est atteint."""
        price = self.client.fetch_last_price()
        entry = self.state["entry_price"]
        reason = check_exit(entry, price, self.settings.stop_loss, self.settings.take_profit)
        log.debug("Contrôle SL/TP : prix %.2f (%+.2f %% depuis l'achat).", price, pnl_pct(entry, price))
        if reason is None:
            return
        label = "STOP-LOSS" if reason == STOP_LOSS else "TAKE-PROFIT"
        log.warning("%s déclenché : prix %.2f, soit %+.2f %% depuis l'achat à %.2f. Vente au marché immédiate.",
                    label, price, pnl_pct(entry, price), entry)
        self.sell(label)

    # --------------------------------------------------------------- analyse
    def analyze_and_trade(self) -> None:
        """Télécharge les bougies, calcule le signal et agit en conséquence."""
        s = self.settings
        df = add_indicators(self.client.fetch_closed_candles(), s.strategy)
        signal, reason = evaluate_signal(df, s.strategy)
        last = df.iloc[-1]
        candle_time = df.index[-1]

        log.info(
            "Analyse %s %s | bougie du %s UTC | clôture %.2f | RSI %.1f | EMA%d %.2f | EMA%d %.2f -> %s (%s)",
            s.symbol, s.timeframe, candle_time.strftime("%Y-%m-%d %H:%M"), last["close"], last["rsi"],
            s.strategy.ema_fast, last["ema_fast"], s.strategy.ema_slow, last["ema_slow"], signal, reason,
        )
        self.log_portfolio()

        if self.state["in_position"]:
            if signal == SELL:
                self.sell("SIGNAL")
            else:
                log.info("Position conservée.")
            return

        if signal == BUY:
            candle_id = candle_time.isoformat()
            if self.state.get("last_buy_candle") == candle_id:
                # Évite de racheter sur le même signal après un stop-loss :
                # chaque aller-retour coûte des frais.
                log.info("Signal BUY déjà utilisé sur cette bougie : on attend la suivante.")
                return
            self.buy(candle_id)
        elif signal == SELL:
            log.info("Signal SELL ignoré : aucune position ouverte.")

    def log_portfolio(self) -> None:
        quote_free, base_free = self.trader.get_free_balances()
        price = self.client.fetch_last_price()
        equity = quote_free + base_free * price
        line = (f"Portefeuille : {quote_free:.2f} {self.client.quote} + {base_free:.8f} {self.client.base} "
                f"(valeur ~ {equity:.2f} {self.client.quote})")
        if self.trader.is_paper:
            start = self.settings.paper_start_balance
            line += f" | performance paper {pnl_pct(start, equity):+.2f} %"
        if self.state["in_position"]:
            entry = self.state["entry_price"]
            line += (f" | position {pnl_pct(entry, price):+.2f} % "
                     f"(SL {stop_loss_price(entry, self.settings.stop_loss):.2f} / "
                     f"TP {take_profit_price(entry, self.settings.take_profit):.2f})")
        log.info(line)

    # --------------------------------------------------------------- ordres
    def buy(self, candle_id: str) -> None:
        """Achète au marché avec POSITION_SIZE_PCT % du solde disponible."""
        quote = self.client.quote
        quote_free, _ = self.trader.get_free_balances()
        cost = compute_buy_cost(quote_free, self.settings.position_size, self.settings.max_order_cost)
        min_cost = self.client.min_order_cost(self.client.fetch_last_price())
        if cost <= 0 or cost < min_cost:
            log.warning("Achat annulé : %.2f %s à investir, l'exchange exige au moins %.2f %s.",
                        cost, quote, min_cost, quote)
            return

        log.info("Signal BUY : achat au marché pour %.2f %s (%.0f %% de %.2f %s disponibles%s).",
                 cost, quote, self.settings.position_size * 100, quote_free, quote,
                 ", plafonné par MAX_ORDER_COST" if cost < quote_free * self.settings.position_size else "")
        try:
            fill = self.trader.market_buy(cost)
        except OrderStatusUnknown as exc:
            # L'ordre est peut-être passé : on note de quoi vérifier au
            # prochain passage, et on ne rachète pas sur ce signal.
            self.state["last_buy_candle"] = candle_id
            self.state["pending_buy"] = {
                "amount": exc.amount, "price": exc.price,
                "quote_before": exc.quote_before, "base_before": exc.base_before,
            }
            self.store.save(self.state)
            raise
        self._open_position(fill, candle_id)

    def resolve_pending_buy(self) -> None:
        """Tranche un achat interrompu par le réseau en comparant les soldes."""
        pending = self.state["pending_buy"]
        quote_now, base_now = self.trader.get_free_balances()
        received = base_now - pending["base_before"]
        if received >= pending["amount"] * 0.5:
            spent = pending["quote_before"] - quote_now
            price = spent / received if spent > 0 else pending["price"]
            log.warning("L'achat interrompu par la coupure réseau a bien été exécuté : position enregistrée.")
            self.state["pending_buy"] = None
            self._open_position(Fill(amount=received, price=price, quote=spent if spent > 0 else received * price),
                                self.state.get("last_buy_candle"))
        else:
            log.warning("L'achat interrompu par la coupure réseau n'a pas été exécuté.")
            self.state["pending_buy"] = None
            self.store.save(self.state)

    def _open_position(self, fill: Fill, candle_id: str | None) -> None:
        self.state.update(
            symbol=self.settings.symbol,
            in_position=True,
            entry_price=fill.price,
            amount=fill.amount,
            entry_cost=fill.quote,
            entry_time=utc_now_iso(),
            last_buy_candle=candle_id,
        )
        self.store.save(self.state)
        log.info(
            "ACHAT exécuté : %.8f %s à %.2f (coût %.2f %s, frais inclus). Stop-loss %.2f | Take-profit %.2f.",
            fill.amount, self.client.base, fill.price, fill.quote, self.client.quote,
            stop_loss_price(fill.price, self.settings.stop_loss),
            take_profit_price(fill.price, self.settings.take_profit),
        )

    def sell(self, reason: str) -> None:
        """Vend au marché toute la position du bot."""
        _, base_free = self.trader.get_free_balances()
        # On ne vend jamais plus que ce que le bot a acheté : les cryptos
        # que vous déteniez déjà sur le compte ne sont pas touchées.
        amount = min(self.state["amount"], base_free)
        price = self.client.fetch_last_price()
        if self.client.round_amount(amount) <= 0 or amount < self.client.min_order_amount(price):
            log.warning("Vente impossible : %.8f %s disponibles (position enregistrée %.8f). "
                        "Position considérée comme fermée (vendue manuellement ?).",
                        base_free, self.client.base, self.state["amount"])
            self._reset_position()
            return

        fill = self.trader.market_sell(amount)
        pnl = fill.quote - self.state["entry_cost"]
        self.state["realized_pnl"] += pnl
        self.state["trades"] += 1
        self.state["wins"] += int(pnl > 0)
        log.info(
            "VENTE (%s) exécutée : %.8f %s à %.2f -> %.2f %s reçus | résultat %+.2f %s (%+.2f %%) | "
            "bilan : %d trade(s), %d gagnant(s), %+.2f %s.",
            reason, fill.amount, self.client.base, fill.price, fill.quote, self.client.quote,
            pnl, self.client.quote, pnl / self.state["entry_cost"] * 100 if self.state["entry_cost"] else 0.0,
            self.state["trades"], self.state["wins"], self.state["realized_pnl"], self.client.quote,
        )
        self._reset_position()

    def _reset_position(self) -> None:
        self.state.update(in_position=False, entry_price=None, amount=0.0, entry_cost=0.0, entry_time=None)
        self.store.save(self.state)

    def reconcile_position(self) -> None:
        """Au démarrage : reprend la position enregistrée et vérifie qu'elle existe encore."""
        if not self.state["in_position"]:
            log.info("Aucune position ouverte. En attente d'un signal d'achat.")
            return
        entry = self.state["entry_price"]
        log.info("Position reprise : %.8f %s achetés à %.2f le %s (SL %.2f / TP %.2f).",
                 self.state["amount"], self.client.base, entry, self.state["entry_time"],
                 stop_loss_price(entry, self.settings.stop_loss),
                 take_profit_price(entry, self.settings.take_profit))
        if self.trader.is_paper:
            return
        _, base_free = self.trader.get_free_balances()
        if base_free < self.state["amount"] * 0.5:
            log.warning("Position introuvable sur le compte (%.8f %s disponibles) : réinitialisation.",
                        base_free, self.client.base)
            self._reset_position()


# ============================================================================
# Démarrage
# ============================================================================

def connect_with_retry(client: ExchangeClient, stop_event: threading.Event) -> bool:
    """Se connecte à l'exchange, en réessayant tant que le réseau est indisponible."""
    attempt = 0
    while not stop_event.is_set():
        try:
            client.connect()
            log.info("Connecté à %s : paire %s (%s / %s).", client.exchange.id, client.symbol, client.base, client.quote)
            return True
        except ccxt.AuthenticationError as exc:
            log.critical("Clés API refusées : %s. Vérifiez le fichier .env et les permissions de la clé.", exc)
            return False
        except ConfigError as exc:
            log.error("Configuration invalide : %s", exc)
            return False
        except (ccxt.NetworkError, ccxt.ExchangeError) as exc:
            attempt += 1
            wait = min(30 * 2 ** (attempt - 1), MAX_BACKOFF_SECONDS)
            log.warning("Connexion à %s impossible (%s). Nouvel essai dans %d s.", client.exchange.id, exc, wait)
            stop_event.wait(wait)
    return False


def install_signal_handlers(stop_event: threading.Event) -> None:
    """Ctrl+C (ou un arrêt du service) termine le cycle en cours puis arrête le bot."""
    def handler(signum, _frame):
        if stop_event.is_set():
            raise KeyboardInterrupt  # second Ctrl+C : arrêt immédiat
        log.info("Arrêt demandé : fin du cycle en cours puis arrêt (Ctrl+C à nouveau pour forcer).")
        stop_event.set()

    signal.signal(signal.SIGINT, handler)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handler)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Bot de swing trading crypto (ccxt).")
    parser.add_argument("--once", action="store_true", help="exécute une seule analyse puis s'arrête")
    args = parser.parse_args(argv)

    setup_logging()
    try:
        settings = load_settings()
    except ConfigError as exc:
        log.error("Configuration invalide : %s", exc)
        return 2
    setup_logging(settings.log_level)

    log.info("=" * 70)
    log.info("Démarrage | mode %s | %s | %s en %s", MODE_LABELS[settings.mode],
             settings.exchange_id, settings.symbol, settings.timeframe)
    log.info("Risque : %.0f %% du solde par achat | stop-loss -%.1f %% | take-profit +%.1f %%",
             settings.position_size * 100, settings.stop_loss * 100, settings.take_profit * 100)
    if settings.mode == "live":
        log.warning("MODE RÉEL : le bot va passer de vrais ordres avec votre argent.")

    store = StateStore(settings.state_file, settings.paper_start_balance)
    try:
        state = store.load()
    except RuntimeError as exc:
        log.critical("%s", exc)
        return 2
    if state["in_position"] and state.get("symbol") not in (None, settings.symbol):
        log.critical("Une position %s est ouverte dans %s alors que SYMBOL=%s. "
                     "Remettez l'ancienne paire le temps de la clôturer.",
                     state["symbol"], settings.state_file.name, settings.symbol)
        return 2

    stop_event = threading.Event()
    install_signal_handlers(stop_event)
    try:
        client = ExchangeClient(settings)
        if not connect_with_retry(client, stop_event):
            return 0 if stop_event.is_set() else 1   # 0 si l'arrêt a été demandé
        if settings.mode == "paper":
            trader = PaperTrader(client, state, settings.paper_fee, settings.paper_slippage)
        else:
            trader = LiveTrader(client)
        bot = TradingBot(settings, client, trader, store, state, stop_event)
        if args.once:
            bot.run_cycle()
        else:
            bot.run()
    except ConfigError as exc:
        log.error("Configuration invalide : %s", exc)
        return 2
    except KeyboardInterrupt:
        log.warning("Arrêt forcé.")
        return 130
    return 0


if __name__ == "__main__":
    sys.exit(main())
