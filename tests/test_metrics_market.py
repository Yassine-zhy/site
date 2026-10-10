"""Indicateurs de risque, conversion de devises et agenda des entreprises."""

from datetime import date, timedelta
from unittest import mock

import pandas as pd

from core import market, metrics


def series(values, start="2026-01-01"):
    return pd.Series(values, index=pd.date_range(start, periods=len(values), freq="D"), dtype=float)


def test_base_100_et_rendement():
    prices = series([50, 55, 60])
    assert [round(v, 6) for v in metrics.rebase(prices)] == [100, 110, 120]  # arrondi : 55 / 50 × 100 = 110,00000000000001
    assert round(metrics.total_return(prices), 6) == 20.0


def test_perte_maximale():
    prices = series([100, 120, 90, 110, 130])  # sommet 120, creux 90 : -25 %
    assert round(metrics.max_drawdown(prices), 6) == -25.0


def test_volatilite_nulle_pour_une_croissance_reguliere():
    prices = series([100 * 1.01 ** i for i in range(30)])  # +1 % chaque jour, sans aucun écart
    assert metrics.annualized_volatility(prices) < 1e-9


def test_rendement_annualise_sur_deux_ans():
    prices = pd.Series([100.0, 121.0], index=pd.to_datetime(["2024-01-01", "2026-01-01"]))
    assert round(metrics.annualized_return(prices), 1) == 10.0  # 1,1 × 1,1 = 1,21


def test_correlation_parfaite():
    table = pd.DataFrame({"A": [1, 2, 3, 2, 4.0], "B": [2, 4, 6, 4, 8.0]})
    assert round(metrics.correlation(table).loc["A", "B"], 6) == 1.0


def test_conversion_par_l_euro():
    rates = {"EUR": 1.0, "USD": 1.10, "GBP": 0.85}
    assert round(market.convert(110, "USD", "EUR", rates), 6) == 100.0
    assert round(market.convert(100, "GBP", "USD", rates), 4) == round(100 / 0.85 * 1.10, 4)


def test_agenda_ignore_les_dates_passees():
    today = date.today()
    fake = {"Earnings Date": [today - timedelta(days=60), today + timedelta(days=20)],
            "Ex-Dividend Date": today - timedelta(days=5), "Earnings Average": 1.98}
    with mock.patch.object(market.yf, "Ticker") as ticker:
        ticker.return_value.calendar = fake
        calendar = market.company_calendar("XYZ")
    assert calendar["earnings"] == today + timedelta(days=20)
    assert calendar["ex_dividend"] is None
    assert calendar["eps_average"] == 1.98


# --- Frontière efficiente --------------------------------------------------------------------------


def three_assets():
    import numpy as np

    rng = np.random.default_rng(7)
    days = pd.bdate_range("2024-01-01", periods=500)
    returns = {"A": (0.0006, 0.02), "B": (0.0002, 0.008), "C": (0.0009, 0.03)}
    return pd.DataFrame({name: 100 * np.cumprod(1 + rng.normal(mu, sigma, len(days)))
                         for name, (mu, sigma) in returns.items()}, index=days)


def test_les_poids_des_portefeuilles_font_100_pourcent():
    portfolios = metrics.random_portfolios(three_assets(), count=500)
    weights = portfolios[["A", "B", "C"]]
    assert ((weights >= 0) & (weights <= 1)).all().all()
    assert (weights.sum(axis=1).round(9) == 1).all()


def test_le_tirage_est_reproductible():
    table = three_assets()
    assert metrics.random_portfolios(table, seed=3).equals(metrics.random_portfolios(table, seed=3))


def test_la_diversification_reduit_le_risque():
    table = three_assets()
    portfolios = metrics.random_portfolios(table, count=4000)
    best = metrics.optimal_portfolios(portfolios)
    least_risky_asset = min(metrics.annualized_volatility(table[c]) for c in table)
    assert best["Variance minimale"]["volatilité"] < least_risky_asset  # mieux que l'actif le plus sûr seul
    assert best["Sharpe maximal"]["sharpe"] == portfolios["sharpe"].max()


def test_la_frontiere_monte_avec_le_risque():
    frontier = metrics.efficient_frontier(metrics.random_portfolios(three_assets(), count=3000))
    assert len(frontier) > 3
    assert frontier["volatilité"].is_monotonic_increasing and frontier["rendement"].is_monotonic_increasing
