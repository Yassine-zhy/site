"""Simulateurs : épargne, investissement programmé, crédit, inflation (résultats vérifiés à la main)."""

import math

import pandas as pd

from core import simulators as sim


def test_le_tableau_d_epargne_retrouve_la_formule():
    plan = sim.savings_plan(initial=1_000, monthly=100, annual_rate=5, years=20)
    assert len(plan) == 21  # année 0 à année 20
    assert round(plan["valeur"].iloc[-1], 6) == round(sim.future_value(1_000, 100, 5, 20), 6)
    assert plan["versé"].iloc[-1] == 1_000 + 100 * 12 * 20


def test_sans_rendement_on_recupere_ce_qu_on_a_verse():
    plan = sim.savings_plan(initial=500, monthly=50, annual_rate=0, years=3)
    assert round(plan["valeur"].iloc[-1], 6) == 500 + 50 * 36
    assert round(plan["intérêts"].iloc[-1], 6) == 0


def test_les_frais_reduisent_le_rendement():
    with_fees = sim.savings_plan(10_000, 0, 5, 10, fees=1)["valeur"].iloc[-1]
    assert round(with_fees, 6) == round(10_000 * 1.04 ** 10, 6)  # 5 % − 1 % de frais = 4 % par an


def test_taux_mensuel_equivalent():
    assert round((1 + sim.monthly_rate(6)) ** 12 - 1, 10) == 0.06


def test_regle_de_72():
    rule, exact = sim.doubling_time(7.2)
    assert rule == 10 and round(exact, 2) == 9.97  # la règle de 72 est une très bonne approximation
    assert sim.doubling_time(0) == (math.inf, math.inf)


def test_mensualite_d_un_credit_immobilier():
    # 200 000 € sur 20 ans à 3,6 % : 200 000 × 0,003 / (1 − 1,003^−240) ≈ 1 170,22 €
    assert round(sim.loan_payment(200_000, 3.6, 20), 2) == 1170.22
    assert sim.loan_payment(120_000, 0, 10) == 1_000  # taux zéro : on rembourse le capital par parts égales


def test_le_tableau_d_amortissement_rembourse_tout_le_capital():
    table = sim.amortization(200_000, 3.6, 20, insurance_rate=0.3)
    assert round(table["capital"].sum(), 2) == 200_000
    assert round(table["restant dû"].iloc[-1], 2) == 0
    payment = sim.loan_payment(200_000, 3.6, 20)
    assert round(table["intérêts"].sum(), 2) == round(payment * 240 - 200_000, 2)
    assert table["intérêts"].iloc[0] > table["intérêts"].iloc[-1]  # on paie surtout des intérêts au début
    assert round(table["assurance"].sum(), 2) == round(200_000 * 0.003 * 20, 2)


def test_capacite_d_emprunt_a_35_pourcent():
    capacity = sim.borrowing_capacity(3_000, 3.6, 25, insurance_rate=0.3)
    monthly = sim.loan_payment(capacity, 3.6, 25) + capacity * 0.003 / 12
    assert round(monthly, 6) == round(3_000 * 0.35, 6)


def test_investissement_programme_a_cours_constant_puis_double():
    days = pd.to_datetime(["2026-01-02", "2026-01-15", "2026-02-02", "2026-03-02", "2026-03-20"])
    closes = pd.Series([100.0, 100.0, 100.0, 200.0, 200.0], index=days)
    table = sim.dollar_cost_averaging(closes, monthly=100, start="2026-01-01")
    assert table["investi"].iloc[-1] == 300  # un achat par mois, pas un par jour de cotation
    assert round(table["parts"].iloc[-1], 6) == 2.5  # 1 + 1 + 0,5 part
    assert round(table["valeur"].iloc[-1], 6) == 500
    assert sim.lump_sum(closes, 300, "2026-01-01") == 600  # tout investir au début : 3 parts × 200


def test_investissement_programme_sans_donnees():
    table = sim.dollar_cost_averaging(pd.Series(dtype=float), 100, "2026-01-01")
    assert table.empty


def test_pouvoir_d_achat():
    table = sim.purchasing_power(100, 2, 10)
    assert round(table["pouvoir d'achat"].iloc[1], 2) == 98.04
    assert round(table["pouvoir d'achat"].iloc[-1], 2) == round(100 / 1.02 ** 10, 2)
