"""Simulateurs financiers : épargne à intérêts composés, investissement programmé, crédit immobilier, inflation.

Toutes les fonctions sont de simples calculs (aucun accès réseau) : faciles à vérifier avec une calculatrice
et à tester. Les montants sont en euros, les taux en % par an.
"""

from __future__ import annotations

import math

import pandas as pd


def monthly_rate(annual_rate: float) -> float:
    """Taux mensuel « équivalent » : 12 mois à ce taux donnent exactement le taux annuel.

    (1 + r_mensuel)^12 = 1 + r_annuel  →  r_mensuel = (1 + r_annuel)^(1/12) − 1
    """
    return (1 + annual_rate / 100) ** (1 / 12) - 1


# --- Épargne à intérêts composés -----------------------------------------------------------------


def savings_plan(initial: float, monthly: float, annual_rate: float, years: int, fees: float = 0.0) -> pd.DataFrame:
    """Valeur d'une épargne année par année : capital de départ + versements chaque fin de mois.

    Les frais (en % par an) sont retirés du rendement. Colonnes : année, versé, intérêts, valeur.
    """
    rate = monthly_rate(annual_rate - fees)
    value, paid = float(initial), float(initial)
    rows = [{"année": 0, "versé": paid, "intérêts": 0.0, "valeur": value}]
    for month in range(1, years * 12 + 1):
        value = value * (1 + rate) + monthly  # les intérêts du mois, puis le versement
        paid += monthly
        if month % 12 == 0:
            rows.append({"année": month // 12, "versé": paid, "intérêts": value - paid, "valeur": value})
    return pd.DataFrame(rows)


def future_value(initial: float, monthly: float, annual_rate: float, years: int) -> float:
    """La même chose en une formule (sert à vérifier savings_plan) : VF = C·(1+i)^n + V·((1+i)^n − 1) / i."""
    i, n = monthly_rate(annual_rate), years * 12
    growth = (1 + i) ** n
    return initial * growth + (monthly * (growth - 1) / i if i else monthly * n)


def doubling_time(annual_rate: float) -> tuple[float, float]:
    """Années pour doubler un capital : (règle de 72, calcul exact ln 2 / ln(1 + r))."""
    if annual_rate <= 0:
        return math.inf, math.inf
    return 72 / annual_rate, math.log(2) / math.log(1 + annual_rate / 100)


# --- Investissement programmé (DCA) ----------------------------------------------------------------


def _since(closes: pd.Series, start) -> pd.Series:
    """Les cours à partir d'une date (dates sans fuseau horaire, pour pouvoir les comparer)."""
    closes = closes.dropna()
    if closes.empty:
        return closes
    if getattr(closes.index, "tz", None) is not None:
        closes = closes.tz_localize(None)
    return closes[closes.index >= pd.Timestamp(start)]


def dollar_cost_averaging(closes: pd.Series, monthly: float, start) -> pd.DataFrame:
    """Investir la même somme chaque mois (le premier jour de cotation du mois) à partir d'une date.

    On achète des parts (fractions possibles) au cours de clôture. Colonnes : investi, parts, valeur.
    """
    closes = _since(closes, start)
    if closes.empty:
        return pd.DataFrame(columns=["investi", "parts", "valeur"])
    month = closes.index.to_period("M")
    is_buy_day = ~month.duplicated()  # premier jour de cotation de chaque mois
    bought = pd.Series(0.0, index=closes.index)
    bought[is_buy_day] = monthly / closes[is_buy_day]
    invested = pd.Series(0.0, index=closes.index)
    invested[is_buy_day] = monthly
    table = pd.DataFrame({"investi": invested.cumsum(), "parts": bought.cumsum()})
    table["valeur"] = table["parts"] * closes
    return table


def lump_sum(closes: pd.Series, amount: float, start) -> float:
    """Valeur finale si l'on avait tout investi d'un coup au premier jour."""
    closes = _since(closes, start)
    return float(amount / closes.iloc[0] * closes.iloc[-1]) if not closes.empty else 0.0


# --- Crédit immobilier -----------------------------------------------------------------------------


def loan_payment(principal: float, annual_rate: float, years: int) -> float:
    """Mensualité d'un prêt à taux fixe, hors assurance : M = C · i / (1 − (1 + i)^−n).

    En France, le taux mensuel d'un crédit immobilier est le taux annuel divisé par 12 (taux « proportionnel »).
    """
    i, n = annual_rate / 100 / 12, years * 12
    return principal / n if i == 0 else principal * i / (1 - (1 + i) ** -n)


def amortization(principal: float, annual_rate: float, years: int, insurance_rate: float = 0.0) -> pd.DataFrame:
    """Tableau d'amortissement résumé par année : capital remboursé, intérêts, assurance, capital restant dû.

    L'assurance est calculée sur le capital emprunté (cas le plus courant) : insurance_rate en % par an.
    """
    i = annual_rate / 100 / 12
    payment = loan_payment(principal, annual_rate, years)
    insurance = principal * insurance_rate / 100 / 12
    remaining, rows = float(principal), []
    for year in range(1, years + 1):
        interest_year = capital_year = 0.0
        for _ in range(12):
            interest = remaining * i  # les intérêts du mois portent sur ce qui reste à rembourser
            capital = payment - interest
            remaining -= capital
            interest_year += interest
            capital_year += capital
        rows.append({"année": year, "capital": capital_year, "intérêts": interest_year,
                     "assurance": insurance * 12, "restant dû": max(remaining, 0.0)})
    return pd.DataFrame(rows)


def borrowing_capacity(net_income: float, annual_rate: float, years: int, insurance_rate: float = 0.0,
                       max_ratio: float = 35.0) -> float:
    """Montant maximal empruntable si la mensualité (assurance comprise) ne dépasse pas max_ratio % des revenus.

    35 % est la limite recommandée en France par le Haut Conseil de stabilité financière (HCSF).
    """
    budget = net_income * max_ratio / 100
    # mensualité pour 1 € emprunté, assurance comprise : on divise le budget par ce coût unitaire
    per_euro = loan_payment(1.0, annual_rate, years) + insurance_rate / 100 / 12
    return budget / per_euro


# --- Inflation ----------------------------------------------------------------------------------


def purchasing_power(amount: float, inflation: float, years: int) -> pd.DataFrame:
    """Ce que vaudra une somme, en euros d'aujourd'hui, si les prix montent de `inflation` % par an."""
    return pd.DataFrame({"année": range(years + 1),
                         "pouvoir d'achat": [amount / (1 + inflation / 100) ** year for year in range(years + 1)]})
