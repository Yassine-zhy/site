"""
Accès à l'exchange via ccxt, et exécution des ordres (réels ou simulés).

  * ExchangeClient : connexion, bougies, prix, règles du marché.
  * LiveTrader     : vrais ordres au marché (testnet Binance ou argent réel).
  * PaperTrader    : ordres simulés sur un portefeuille virtuel, avec les
                     VRAIS prix du marché. Rien n'est envoyé à l'exchange.

Le bot utilise les deux « traders » de la même façon (mêmes méthodes), ce
qui permet de passer du paper trading au réel en changeant une seule ligne
du fichier .env.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

import ccxt
import pandas as pd

from config import ConfigError, Settings
from strategy import ohlcv_to_dataframe

log = logging.getLogger("bot")


class OrderStatusUnknown(ccxt.NetworkError):
    """
    L'ordre a été envoyé mais le réseau empêche de savoir s'il est passé.
    On garde de quoi trancher plus tard en comparant les soldes.
    """

    def __init__(self, message: str, side: str, amount: float, before: tuple[float, float], price: float):
        super().__init__(message)
        self.side = side
        self.amount = amount
        self.quote_before, self.base_before = before
        self.price = price


@dataclass
class Fill:
    """Résultat d'un ordre exécuté."""

    amount: float          # crypto reçue (achat, frais déduits) ou vendue
    price: float           # prix moyen d'exécution
    quote: float           # USDT dépensés (achat, frais inclus) ou reçus (vente, frais déduits)
    order_id: str | None = None


class ExchangeClient:
    """Connexion à l'exchange : marchés, bougies, prix et règles de la paire."""

    def __init__(self, settings: Settings):
        exchange_class = getattr(ccxt, settings.exchange_id)
        options: dict[str, Any] = {
            "enableRateLimit": True,          # ccxt espace les requêtes pour éviter un blocage
            "timeout": 30_000,                # 30 s maximum par requête
            "options": {"defaultType": "spot"},
        }
        if settings.exchange_id == "binance":
            # Marchés spot uniquement : chargement plus rapide, et le bot
            # n'interroge pas les API futures dont il n'a pas besoin.
            options["options"]["fetchMarkets"] = {"types": ["spot"]}
        # Les clés ne sont transmises que si des ordres réels sont prévus :
        # en paper trading, le bot ne lit que des données publiques.
        if settings.uses_real_orders:
            options["apiKey"] = settings.api_key
            options["secret"] = settings.api_secret
        self.exchange = exchange_class(options)

        if settings.mode == "testnet":
            if not self.exchange.urls.get("test"):
                raise ConfigError(
                    f"{settings.exchange_id} ne propose pas de testnet dans ccxt. "
                    "Utilisez EXCHANGE=binance pour le testnet, ou MODE=paper."
                )
            self.exchange.set_sandbox_mode(True)

        self.settings = settings
        self.symbol = settings.symbol
        self.timeframe = settings.timeframe
        self.timeframe_ms = self.exchange.parse_timeframe(settings.timeframe) * 1000
        self.market: dict[str, Any] = {}

    # ---------------------------------------------------------------- connexion
    def connect(self) -> None:
        """Charge les marchés et vérifie la paire, l'unité de temps et les clés."""
        self.exchange.load_markets()
        if self.symbol not in self.exchange.markets:
            raise ConfigError(f"La paire {self.symbol} n'existe pas sur {self.exchange.id}.")
        if self.exchange.timeframes and self.timeframe not in self.exchange.timeframes:
            raise ConfigError(
                f"Unité de temps {self.timeframe} non disponible sur {self.exchange.id} "
                f"(choix : {', '.join(self.exchange.timeframes)})."
            )
        self.market = self.exchange.market(self.symbol)
        if self.settings.uses_real_orders:
            # Appel privé immédiat : une clé invalide est détectée au démarrage
            # plutôt qu'au moment de vendre.
            self.exchange.fetch_balance()

    @property
    def name(self) -> str:
        return self.exchange.id

    def market_is_open(self) -> bool:
        """Les marchés crypto ne ferment jamais (les actions, si : voir stocks.py)."""
        return True

    def next_open_text(self) -> str:
        return "maintenant"

    @property
    def base(self) -> str:
        """Crypto achetée, ex. BTC."""
        return self.market["base"]

    @property
    def quote(self) -> str:
        """Monnaie de règlement, ex. USDT."""
        return self.market["quote"]

    # ------------------------------------------------------------ données marché
    def fetch_closed_candles(self) -> pd.DataFrame:
        """Télécharge les bougies et ne garde que celles qui sont clôturées."""
        ohlcv = self.exchange.fetch_ohlcv(self.symbol, self.timeframe, limit=self.settings.candles_limit)
        if not ohlcv:
            raise ccxt.ExchangeError("Aucune bougie reçue de l'exchange.")
        # La dernière bougie est généralement encore en cours : sa clôture
        # change jusqu'à la fin de la période. Décider dessus ferait
        # « clignoter » le signal, on l'écarte donc.
        if ohlcv[-1][0] + self.timeframe_ms > self.exchange.milliseconds():
            ohlcv = ohlcv[:-1]
        return ohlcv_to_dataframe(ohlcv)

    def fetch_last_price(self) -> float:
        """Dernier prix échangé sur la paire."""
        ticker = self.exchange.fetch_ticker(self.symbol)
        price = ticker.get("last") or ticker.get("close") or ticker.get("bid")
        if not price:
            raise ccxt.ExchangeError(f"Prix indisponible pour {self.symbol}.")
        return float(price)

    # ----------------------------------------------------------- règles marché
    def round_amount(self, amount: float) -> float:
        """Arrondit (vers le bas) une quantité au pas accepté par l'exchange."""
        try:
            return float(self.exchange.amount_to_precision(self.symbol, amount))
        except ccxt.BaseError:
            return 0.0  # quantité plus petite que le pas minimal

    def min_order_cost(self, price: float) -> float:
        """Montant minimal d'un ordre en USDT (limite en coût ou en quantité)."""
        limits = self.market.get("limits", {})
        min_cost = (limits.get("cost") or {}).get("min") or 0.0
        min_amount = (limits.get("amount") or {}).get("min") or 0.0
        return max(float(min_cost), float(min_amount) * price)

    def min_order_amount(self, price: float) -> float:
        """Quantité minimale vendable (tient compte des deux limites)."""
        limits = self.market.get("limits", {})
        min_amount = float((limits.get("amount") or {}).get("min") or 0.0)
        min_cost = float((limits.get("cost") or {}).get("min") or 0.0)
        return max(min_amount, min_cost / price if price else 0.0)


def _free(balance: dict[str, Any], currency: str) -> float:
    """Solde disponible d'une devise dans la réponse de fetch_balance."""
    return float((balance.get(currency) or {}).get("free") or 0.0)


class LiveTrader:
    """Passe de vrais ordres au marché (testnet ou argent réel)."""

    is_paper = False

    def __init__(self, client: ExchangeClient):
        self.client = client
        self.exchange = client.exchange

    def get_free_balances(self) -> tuple[float, float]:
        """Renvoie (USDT disponibles, crypto disponible)."""
        balance = self.exchange.fetch_balance()
        return _free(balance, self.client.quote), _free(balance, self.client.base)

    def market_buy(self, quote_amount: float) -> Fill:
        """Achète au marché pour environ quote_amount USDT."""
        price = self.client.fetch_last_price()
        amount = self.client.round_amount(quote_amount / price)
        if amount <= 0:
            raise ccxt.InvalidOrder(f"Montant trop faible pour acheter du {self.client.base}.")
        return self._execute("buy", amount, quote_amount, price)

    def market_sell(self, amount: float) -> Fill:
        """Vend au marché la quantité indiquée."""
        price = self.client.fetch_last_price()
        amount = self.client.round_amount(amount)
        if amount <= 0:
            raise ccxt.InvalidOrder(f"Quantité de {self.client.base} trop faible pour être vendue.")
        return self._execute("sell", amount, amount * price, price)

    def _execute(self, side: str, amount: float, quote_amount: float, price: float) -> Fill:
        before = self.get_free_balances()
        try:
            order = self._send_order(side, amount, quote_amount)
        except ccxt.NetworkError:
            # Un timeout peut survenir APRÈS l'exécution de l'ordre : on
            # vérifie le solde avant de conclure à un échec.
            fill = self._fill_from_balance_change(side, amount, before, price)
            if fill is None:
                raise
            return fill
        return self._fill_from_order(self._wait_until_filled(order), side, amount, before, price)

    def _send_order(self, side: str, amount: float, quote_amount: float) -> dict[str, Any]:
        """Envoie l'ordre au marché à l'exchange (redéfini pour les actions, voir stocks.py)."""
        if side == "buy":
            return self.exchange.create_market_buy_order(self.client.symbol, amount)
        return self.exchange.create_market_sell_order(self.client.symbol, amount)

    # ------------------------------------------------------- détails internes
    def _wait_until_filled(self, order: dict[str, Any], attempts: int = 5) -> dict[str, Any]:
        """
        Certains exchanges (Kraken) ne renvoient que l'identifiant de l'ordre :
        on interroge l'exchange jusqu'à connaître la quantité et le prix exécutés.
        """
        for _ in range(attempts):
            if order.get("status") == "closed" and order.get("filled"):
                return order
            if not order.get("id") or not self.exchange.has.get("fetchOrder"):
                break
            time.sleep(2)
            try:
                order = self.exchange.fetch_order(order["id"], self.client.symbol)
            except ccxt.NetworkError as exc:
                log.warning("Suivi de l'ordre %s impossible pour l'instant : %s", order.get("id"), exc)
        log.warning("Ordre %s : exécution non confirmée, estimation à partir des soldes.", order.get("id"))
        return order

    def _fill_from_order(self, order, side, requested, before, price_hint) -> Fill:
        """Construit le Fill à partir de l'ordre et de la variation des soldes."""
        quote_before, base_before = before
        filled = float(order.get("filled") or 0) or requested
        cost = float(order.get("cost") or 0)
        price = float(order.get("average") or 0) or (cost / filled if cost else price_hint)
        try:
            quote_after, base_after = self.get_free_balances()
        except ccxt.BaseError as exc:
            # L'ordre est passé : on ne doit surtout pas perdre la position
            # (sinon plus de stop-loss). On se contente des données de l'ordre.
            log.warning("Soldes illisibles après l'ordre %s (%s) : estimation depuis l'ordre.", side, exc)
            return Fill(amount=filled, price=price, quote=cost or filled * price, order_id=order.get("id"))

        if side == "buy":
            # Binance prélève ses frais en crypto : la quantité réellement
            # reçue est un peu inférieure à la quantité achetée.
            received = base_after - base_before
            amount = received if 0 < received <= filled * 1.001 else filled
            quote = quote_before - quote_after
        else:
            amount = filled
            quote = quote_after - quote_before
        if quote <= 0:  # solde pas encore mis à jour : estimation
            quote = filled * price
        return Fill(amount=amount, price=price, quote=quote, order_id=order.get("id"))

    def _fill_from_balance_change(self, side, amount, before, price_hint) -> Fill | None:
        """Après une erreur réseau, déduit des soldes si l'ordre est passé."""
        log.warning("Erreur réseau pendant l'ordre %s : vérification des soldes...", side)
        time.sleep(5)
        quote_before, base_before = before
        try:
            quote_after, base_after = self.get_free_balances()
        except ccxt.BaseError as exc:
            raise OrderStatusUnknown(
                f"Ordre {side} envoyé mais résultat inconnu (soldes illisibles : {exc}).",
                side, amount, before, price_hint,
            ) from exc
        moved = base_after - base_before if side == "buy" else base_before - base_after
        if moved < amount * 0.5:
            log.warning("L'ordre %s n'a pas été exécuté.", side)
            return None
        quote = quote_before - quote_after if side == "buy" else quote_after - quote_before
        price = quote / moved if quote > 0 else price_hint
        log.warning("L'ordre %s a bien été exécuté malgré l'erreur réseau.", side)
        return Fill(amount=moved, price=price, quote=quote if quote > 0 else moved * price)


class PaperTrader:
    """
    Paper trading : simule les ordres au prix réel du marché, avec frais et
    glissement de prix, sur un portefeuille virtuel enregistré dans l'état.
    """

    is_paper = True

    def __init__(self, client: ExchangeClient, state: dict[str, Any], fee: float, slippage: float):
        self.client = client
        self.state = state       # dictionnaire partagé avec le bot, qui le sauvegarde
        self.fee = fee
        self.slippage = slippage

    def get_free_balances(self) -> tuple[float, float]:
        return float(self.state["paper_quote"]), float(self.state["paper_base"])

    def market_buy(self, quote_amount: float) -> Fill:
        if quote_amount > self.state["paper_quote"] + 1e-9:
            raise ccxt.InsufficientFunds("Solde virtuel insuffisant.")
        # Un ordre au marché s'exécute un peu plus cher que le dernier prix.
        price = self.client.fetch_last_price() * (1 + self.slippage)
        amount = self.client.round_amount(quote_amount / price)
        if amount <= 0:
            raise ccxt.InvalidOrder(f"Montant trop faible pour acheter du {self.client.base}.")
        cost = amount * price
        received = amount * (1 - self.fee)   # frais prélevés sur la crypto reçue
        self.state["paper_quote"] -= cost
        self.state["paper_base"] += received
        return Fill(amount=received, price=price, quote=cost, order_id=f"paper-{int(time.time())}")

    def market_sell(self, amount: float) -> Fill:
        amount = min(amount, self.state["paper_base"])
        if amount <= 0:
            raise ccxt.InsufficientFunds("Aucune crypto virtuelle à vendre.")
        price = self.client.fetch_last_price() * (1 - self.slippage)
        proceeds = amount * price * (1 - self.fee)
        self.state["paper_base"] -= amount
        self.state["paper_quote"] += proceeds
        return Fill(amount=amount, price=price, quote=proceeds, order_id=f"paper-{int(time.time())}")
