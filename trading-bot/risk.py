"""
Gestion des risques : taille de position, stop-loss et take-profit.

Fonctions pures (sans réseau) : faciles à lire, à tester et à modifier.
"""

from __future__ import annotations

STOP_LOSS = "STOP_LOSS"
TAKE_PROFIT = "TAKE_PROFIT"


def compute_buy_cost(free_quote: float, position_size: float, max_cost: float = 0.0) -> float:
    """
    Montant en USDT à engager pour un achat.

    position_size = 0.5 -> on n'investit que 50 % du solde disponible ;
    le reste sert de réserve. max_cost (> 0) plafonne le montant d'un ordre.
    """
    if free_quote <= 0:
        return 0.0
    cost = free_quote * position_size
    return min(cost, max_cost) if max_cost > 0 else cost


def stop_loss_price(entry_price: float, stop_loss: float) -> float:
    """Prix sous lequel on coupe la perte (ex. -3 %)."""
    return entry_price * (1 - stop_loss)


def take_profit_price(entry_price: float, take_profit: float) -> float:
    """Prix au-dessus duquel on encaisse le gain (ex. +8 %)."""
    return entry_price * (1 + take_profit)


def check_exit(entry_price: float, current_price: float, stop_loss: float, take_profit: float) -> str | None:
    """
    Renvoie STOP_LOSS, TAKE_PROFIT ou None selon le prix actuel.

    Règle stricte : dès que l'un des seuils est atteint, le bot doit vendre
    au marché immédiatement, quel que soit le signal des indicateurs.
    """
    if current_price <= stop_loss_price(entry_price, stop_loss):
        return STOP_LOSS
    if current_price >= take_profit_price(entry_price, take_profit):
        return TAKE_PROFIT
    return None


def pnl_pct(entry_price: float, current_price: float) -> float:
    """Variation en % entre le prix d'achat et le prix actuel (hors frais)."""
    return (current_price / entry_price - 1) * 100
