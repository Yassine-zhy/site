"""Portefeuille virtuel : valorisation en euros, plus-values latentes et historique de la composition actuelle."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


def to_eur(amount: float, currency: str, rates: dict[str, float]) -> float:
    """Convertit un montant en euros. `rates` donne la valeur d'un euro dans chaque devise ({"USD": 1.12, …}).

    Piège : la Bourse de Londres cote en *pence* (« GBp ») et non en livres (« GBP ») : 100 pence = 1 livre.
    """
    if currency == "GBp":
        amount, currency = amount / 100, "GBP"
    return amount / rates.get(currency, 1.0)  # devise inconnue : traitée comme de l'euro


@dataclass
class Line:
    """Une ligne du portefeuille, valorisée."""

    position: dict  # la ligne de la table positions (symbol, label, quantity, price, currency, bought_on…)
    last: float  # dernier cours, dans la devise de cotation
    value: float  # valeur actuelle, en euros
    cost: float  # prix de revient, en euros
    weight: float = 0.0  # part du portefeuille, en %

    @property
    def gain(self) -> float:
        """Plus-value (ou moins-value) latente, en euros."""
        return self.value - self.cost

    @property
    def gain_pct(self) -> float:
        return (self.value / self.cost - 1) * 100 if self.cost else 0.0


def valuate(positions: list[dict], last_prices: dict[str, float], rates: dict[str, float]) -> list[Line]:
    """Valorise chaque position au dernier cours connu (les positions sans cours sont ignorées).

    Simplification : le prix de revient est converti au taux de change **actuel**, pas à celui du jour d'achat.
    """
    lines = []
    for position in positions:
        last = last_prices.get(position["symbol"])
        if last is None:
            continue
        currency = position["currency"]
        lines.append(Line(
            position=position,
            last=last,
            value=to_eur(position["quantity"] * last, currency, rates),
            cost=to_eur(position["quantity"] * position["price"], currency, rates),
        ))
    total = sum(line.value for line in lines) or 1
    for line in lines:
        line.weight = line.value / total * 100
    return lines


def totals(lines: list[Line]) -> dict[str, float]:
    value = sum(line.value for line in lines)
    cost = sum(line.cost for line in lines)
    return {"value": value, "cost": cost, "gain": value - cost, "gain_pct": (value / cost - 1) * 100 if cost else 0.0}


def composition_history(positions: list[dict], closes: pd.DataFrame, rates: dict[str, float]) -> pd.Series:
    """Valeur en euros, jour après jour, du portefeuille **actuel** (mêmes quantités sur toute la période).

    On répond à la question « comment aurait évolué ce que je détiens aujourd'hui ? ». Cela évite le piège des
    achats en cours de route, qui feraient « sauter » la valeur sans que ce soit de la performance.
    """
    value = pd.Series(0.0, index=closes.index)
    for position in positions:
        if position["symbol"] in closes:
            value += to_eur(1.0, position["currency"], rates) * position["quantity"] * closes[position["symbol"]]
    return value
