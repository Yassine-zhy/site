"""Indicateurs de performance et de risque, calculés sur une série de cours (pandas Series indexée par date)."""

from __future__ import annotations

import math

import pandas as pd

TRADING_DAYS = 252  # nombre de séances de Bourse dans une année (convention)


def rebase(series: pd.Series, base: float = 100) -> pd.Series:
    """« Base 100 » : divise toute la série par sa première valeur. Permet de comparer des actifs de prix différents."""
    return series / series.iloc[0] * base


def total_return(series: pd.Series) -> float:
    """Rendement sur toute la période, en % : (dernier ÷ premier − 1) × 100."""
    return (series.iloc[-1] / series.iloc[0] - 1) * 100


def annualized_return(series: pd.Series) -> float:
    """Rendement ramené à un an, en % : (dernier ÷ premier)^(1 / nombre d'années) − 1."""
    years = (series.index[-1] - series.index[0]).days / 365.25
    if years <= 0:
        return math.nan
    return ((series.iloc[-1] / series.iloc[0]) ** (1 / years) - 1) * 100


def annualized_volatility(series: pd.Series) -> float:
    """Écart-type des rendements quotidiens × √252, en %. Mesure l'ampleur typique des variations sur un an."""
    daily_returns = series.pct_change().dropna()
    return daily_returns.std() * math.sqrt(TRADING_DAYS) * 100


def max_drawdown(series: pd.Series) -> float:
    """Perte maximale, en % (nombre négatif) : la pire baisse entre un sommet et le point bas qui suit."""
    running_peak = series.cummax()  # le plus haut atteint jusqu'à chaque date
    return (series / running_peak - 1).min() * 100


def correlation(table: pd.DataFrame) -> pd.DataFrame:
    """Corrélation des rendements quotidiens entre les colonnes d'un tableau de cours (de −1 à +1)."""
    return table.pct_change().dropna().corr()
