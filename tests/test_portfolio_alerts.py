"""Portefeuille virtuel et alertes de cours."""

import pandas as pd

from core import alerts, portfolio
from core.market import Quote

RATES = {"EUR": 1.0, "USD": 1.25, "GBP": 0.8}
POSITIONS = [
    {"id": 1, "symbol": "MC.PA", "label": "LVMH", "quantity": 10, "price": 400.0, "currency": "EUR", "bought_on": "2026-04-01"},
    {"id": 2, "symbol": "AAPL", "label": "Apple", "quantity": 4, "price": 250.0, "currency": "USD", "bought_on": "2026-04-01"},
]


def test_conversion_en_euros_y_compris_les_pence_de_londres():
    assert portfolio.to_eur(125, "USD", RATES) == 100
    assert portfolio.to_eur(8000, "GBp", RATES) == 100  # 8 000 pence = 80 livres = 100 €


def test_valorisation_plus_values_et_poids():
    lines = portfolio.valuate(POSITIONS, {"MC.PA": 380.0, "AAPL": 300.0}, RATES)
    lvmh, apple = lines
    assert (lvmh.value, lvmh.cost, lvmh.gain) == (3800, 4000, -200)
    assert (apple.value, apple.cost) == (960, 800)  # 4 × 300 $ ÷ 1,25
    assert round(lvmh.weight + apple.weight, 9) == 100
    total = portfolio.totals(lines)
    assert total["value"] == 4760 and total["gain"] == -40


def test_une_position_sans_cours_est_ignoree():
    assert [line.position["symbol"] for line in portfolio.valuate(POSITIONS, {"MC.PA": 380.0}, RATES)] == ["MC.PA"]


def test_historique_de_la_composition_actuelle():
    closes = pd.DataFrame({"MC.PA": [400.0, 420.0], "AAPL": [250.0, 275.0]},
                          index=pd.to_datetime(["2026-10-08", "2026-10-09"]))
    history = portfolio.composition_history(POSITIONS, closes, RATES)
    assert list(history) == [10 * 400 + 4 * 250 / 1.25, 10 * 420 + 4 * 275 / 1.25]


def quote(last, previous):
    return Quote("MC.PA", "LVMH", "", "%", last, previous, pd.Series([previous, last]))


def test_conditions_des_alertes():
    assert alerts.is_triggered({"kind": "above", "threshold": 400}, 401, 0)
    assert not alerts.is_triggered({"kind": "above", "threshold": 400}, 399, 0)
    assert alerts.is_triggered({"kind": "below", "threshold": 385}, 380.9, 0)
    assert alerts.is_triggered({"kind": "move", "threshold": 2}, 100, -2.5)  # une baisse compte aussi


def test_verification_et_description_des_alertes():
    my_alerts = [{"id": 1, "symbol": "MC.PA", "label": "LVMH", "kind": "below", "threshold": 385.0},
                 {"id": 2, "symbol": "AIR.PA", "label": "Airbus", "kind": "above", "threshold": 200.0}]
    fired = alerts.check(my_alerts, {"MC.PA": quote(380.9, 388.45)})  # pas de cours pour Airbus : ignorée
    assert [alert["label"] for alert, _ in fired] == ["LVMH"]
    assert alerts.describe(my_alerts[0]) == "LVMH en dessous de 385"
    assert alerts.describe({"label": "CAC 40", "kind": "move", "threshold": 2.5}) == "CAC 40 : variation du jour d'au moins 2,5 %"
