"""Calculs de marché et mise en forme à la française."""

from datetime import datetime, timezone

import pandas as pd

import theme
from core.market import Quote


def make_quote(values, unit="%"):
    history = pd.Series(values, dtype=float)
    return Quote("X", "X", "G", unit, values[-1], values[-2], history)


def test_variation_en_pourcentage_et_sur_periode():
    quote = make_quote([100, 104, 110])
    assert round(quote.change, 4) == round((110 / 104 - 1) * 100, 4)
    assert round(quote.change_over(2), 6) == 10.0


def test_variation_d_un_taux_en_points_de_base():
    quote = make_quote([5.20, 5.23, 5.24], unit="pb")
    assert round(quote.change, 6) == 1.0


def test_nombres_signes_et_montants_a_la_francaise():
    assert theme.fr_number(8012.345) == "8 012,35"
    assert theme.signed(-1.2) == "−1,20 %"
    assert theme.signed(3.04, "pb") == "+3,0 pb"
    assert theme.compact_money(187_326_775_296, "EUR") == "187,3 Md€"


def test_echappement_html_et_liens_surs():
    assert theme.esc('<img src=x onerror="alert(1)">') == "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    assert theme.safe_url("javascript:alert(1)") == "#"
    assert theme.safe_url("https://example.com/?a=1&b=2") == "https://example.com/?a=1&amp;b=2"


def test_horloges_des_places_boursieres():
    tuesday_noon_paris = datetime(2026, 10, 6, 10, 0, tzinfo=timezone.utc)  # 12:00 à Paris
    status = {city: is_open for city, _, is_open in theme.exchange_status(tuesday_noon_paris)}
    assert status["Paris"] and status["Londres"] and not status["New York"]
    saturday = datetime(2026, 10, 10, 10, 0, tzinfo=timezone.utc)
    assert not any(is_open for _, _, is_open in theme.exchange_status(saturday))
