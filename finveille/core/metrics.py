"""Indicateurs de performance et de risque, calculés sur une série de cours (pandas Series indexée par date)."""

from __future__ import annotations

import math

import numpy as np
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


# --- Théorie moderne du portefeuille (Markowitz, 1952) ---------------------------------------------


def random_portfolios(table: pd.DataFrame, count: int = 4000, risk_free: float = 0.0, seed: int = 0) -> pd.DataFrame:
    """Simule `count` répartitions au hasard entre les colonnes d'un tableau de cours.

    Pour chacune : rendement attendu et volatilité annualisés (en %), et ratio de Sharpe
    = (rendement − taux sans risque) ÷ volatilité. Le rendement attendu est la moyenne passée :
    une hypothèse forte (le passé ne prédit pas l'avenir), mais c'est la méthode de Markowitz.
    Une colonne par actif contient son poids (de 0 à 1, la somme fait 1 : pas de vente à découvert).
    """
    returns = table.pct_change().dropna()
    mean = returns.mean().to_numpy() * TRADING_DAYS  # rendement moyen annualisé de chaque actif
    cov = returns.cov().to_numpy() * TRADING_DAYS  # matrice de covariance annualisée
    rng = np.random.default_rng(seed)  # graine fixe : les mêmes données donnent toujours le même nuage
    weights = rng.dirichlet(np.ones(len(table.columns)), size=count)  # poids positifs dont la somme vaut 1
    expected = weights @ mean * 100
    volatility = np.sqrt(np.einsum("ij,jk,ik->i", weights, cov, weights)) * 100  # √(wᵀ Σ w) pour chaque ligne
    result = pd.DataFrame(weights, columns=table.columns)
    result["rendement"] = expected
    result["volatilité"] = volatility
    result["sharpe"] = (expected - risk_free) / volatility
    return result


def optimal_portfolios(portfolios: pd.DataFrame) -> dict[str, pd.Series]:
    """Les deux portefeuilles remarquables du nuage : le moins risqué et le meilleur ratio de Sharpe."""
    return {
        "Variance minimale": portfolios.loc[portfolios["volatilité"].idxmin()],
        "Sharpe maximal": portfolios.loc[portfolios["sharpe"].idxmax()],
    }


def efficient_frontier(portfolios: pd.DataFrame, buckets: int = 40) -> pd.DataFrame:
    """La frontière efficiente : pour chaque niveau de risque, le meilleur rendement obtenu.

    On découpe l'axe de la volatilité en tranches et on garde le meilleur rendement de chaque tranche, puis
    seulement les points qui font mieux que tous les points moins risqués (`cummax`) : prendre plus de risque
    n'a d'intérêt que si cela rapporte plus.
    """
    bins = pd.cut(portfolios["volatilité"], buckets)
    best = portfolios.loc[portfolios.groupby(bins, observed=True)["rendement"].idxmax()].sort_values("volatilité")
    efficient = best[best["rendement"] >= best["rendement"].cummax()]
    return efficient[["volatilité", "rendement"]].reset_index(drop=True)
