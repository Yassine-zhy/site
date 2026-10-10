"""Indicateurs économiques : lecture des fichiers BCE et FRED, calculs (aucun accès réseau)."""

import pandas as pd
import pytest
import requests

from core import macro

ECB_CSV = """KEY,FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE
YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y,B,U2,2026-10-07,3.54
YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y,B,U2,2026-10-08,3.52
YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y,B,U2,2026-10-07,3.00
YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y,B,U2,2026-10-08,
"""

FRED_CSV = """observation_date,DGS10
2026-10-06,5.30
2026-10-07,.
2026-10-08,5.22
"""


def monthly(values, start="2025-01-01"):
    return pd.Series(values, index=pd.date_range(start, periods=len(values), freq="MS"), dtype=float)


def test_les_differents_formats_de_date():
    assert macro.parse_period("2026-09") == pd.Timestamp("2026-09-01")
    assert macro.parse_period("2026-Q3") == pd.Timestamp("2026-07-01")  # début du trimestre
    assert macro.parse_period("2026-10-08") == pd.Timestamp("2026-10-08")
    assert macro.parse_period("2026") == pd.Timestamp("2026-01-01")


def test_lecture_du_csv_de_la_bce_plusieurs_series():
    table = macro.parse_ecb_csv(ECB_CSV)
    assert list(table.columns) == ["SR_10Y", "SR_2Y"]  # une colonne par série, nommée par la fin de la clé
    assert table.loc["2026-10-08", "SR_10Y"] == 3.52
    assert pd.isna(table.loc["2026-10-08", "SR_2Y"])  # valeur vide : manquante, pas zéro


def test_lecture_du_csv_de_fred_avec_valeur_manquante():
    table = macro.parse_fred_csv(FRED_CSV)
    assert list(table.columns) == ["DGS10"]
    assert pd.isna(table.loc["2026-10-07", "DGS10"])  # « . » = pas de cotation ce jour-là
    assert table["DGS10"].dropna().tolist() == [5.30, 5.22]


def test_variation_sur_un_an_d_un_indice_de_prix():
    index = monthly([100.0] * 12 + [103.0])
    assert round(macro.year_over_year(index).iloc[-1], 6) == 3.0  # 103 / 100 − 1 = 3 %


def test_derniere_valeur_et_evolutions():
    series = monthly([2.0] * 12 + [2.5, 3.8])
    info = macro.latest(series)
    assert info["value"] == 3.8 and info["date"] == pd.Timestamp("2026-02-01")
    assert round(info["change"], 6) == 1.3  # depuis le mois précédent
    assert round(info["change_year"], 6) == 1.8  # depuis février 2025


def test_frequence_d_une_serie():
    assert macro.frequency(monthly([1, 2, 3])) == "mois"
    quarterly = pd.Series([1.0, 2.0, 3.0], index=pd.to_datetime(["2025-07-01", "2025-10-01", "2026-01-01"]))
    assert macro.frequency(quarterly) == "trimestre"
    decisions = pd.Series([2.0, 2.25], index=pd.to_datetime(["2026-06-17", "2026-09-16"]))
    assert macro.frequency(decisions) == "jour"  # dates de décision, pas un mois


def test_palier_prolonge_jusqu_a_aujourd_hui():
    decisions = pd.Series([2.0, 2.25], index=pd.to_datetime(["2026-06-17", "2026-09-16"]))
    extended = macro.extend_to(decisions, pd.Timestamp("2026-10-10"))
    assert extended.index[-1] == pd.Timestamp("2026-10-10") and extended.iloc[-1] == 2.25


def test_forme_de_la_courbe_des_taux():
    assert macro.curve_shape(pd.Series({"2 ans": 3.0, "10 ans": 3.5}))[0] == "normale"
    assert macro.curve_shape(pd.Series({"2 ans": 4.8, "10 ans": 4.3}))[0] == "inversée"
    assert macro.curve_shape(pd.Series({"2 ans": 3.0, "10 ans": 3.1}))[0] == "plate"


def test_courbe_a_une_date_reprend_la_derniere_valeur_connue():
    table = pd.DataFrame({"2 ans": [3.0, None], "10 ans": [3.4, 3.5]},
                         index=pd.to_datetime(["2026-10-07", "2026-10-08"]))
    curve = macro.curve_on(table, pd.Timestamp("2026-10-08"))
    assert curve.to_dict() == {"2 ans": 3.0, "10 ans": 3.5}


def test_taux_reel_relation_de_fisher():
    assert round(macro.real_rate(2.5, 3.8), 2) == -1.25
    assert macro.real_rate(2.0, 2.0) == 0


def test_une_source_en_panne_n_empeche_pas_les_autres(monkeypatch):
    def fake_fetch(indicator, start):
        if indicator.source == "fred":
            raise requests.ReadTimeout("FRED ne répond pas")
        return monthly([1.0, 2.0])

    monkeypatch.setattr(macro, "fetch_indicator", fake_fetch)
    data, errors = macro.fetch_all("2025-01-01")
    assert set(data) == {i.key for i in macro.INDICATORS if i.source == "ecb"}
    assert len(errors) == sum(1 for i in macro.INDICATORS if i.source == "fred")
    assert all("ReadTimeout" in error for error in errors)


@pytest.mark.parametrize("indicator", macro.INDICATORS, ids=lambda i: i.key)
def test_chaque_indicateur_est_bien_decrit(indicator):
    assert indicator.source in ("ecb", "fred") and indicator.zone in (macro.EA, macro.FR, macro.US)
    assert indicator.help and indicator.series
