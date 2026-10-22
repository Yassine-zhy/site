"""Une même séance pour un indice et ses valeurs (étape 38) : Yahoo publie parfois la clôture d'une action des heures
après celle de son indice."""

import math

import pandas as pd

from core.market import Quote, align_session, fill_last_closes


def _quote(symbol: str, days: list[str], prices: list[float]) -> Quote:
    history = pd.Series(prices, index=pd.to_datetime(days))
    return Quote(symbol, symbol, "g", "%", prices[-1], prices[-2], history)


def test_un_indice_plus_frais_que_ses_valeurs_est_ramene_a_leur_seance():
    index = _quote("^FCHI", ["2026-10-19", "2026-10-20", "2026-10-21"], [7868.0, 7838.5, 7921.7])
    members = [_quote(s, ["2026-10-19", "2026-10-20"], [100.0, 101.0]) for s in "ABCDE"]
    aligned, same, session = align_session(index, members)
    assert str(session) == "2026-10-20"
    assert aligned.last == 7838.5 and math.isclose(aligned.change, (7838.5 / 7868.0 - 1) * 100)
    assert same == members  # déjà à cette séance : inchangées


def test_une_valeur_en_retard_ne_fait_pas_reculer_toute_la_cote():
    index = _quote("^FCHI", ["2026-10-20", "2026-10-21"], [7838.5, 7921.7])
    members = [_quote(s, ["2026-10-20", "2026-10-21"], [100.0, 102.0]) for s in "ABCDEFGHI"]
    members.append(_quote("Z", ["2026-10-19", "2026-10-20"], [50.0, 49.0]))  # 1 sur 10 en retard
    aligned, same, session = align_session(index, members)
    assert str(session) == "2026-10-21" and aligned.last == 7921.7


def test_sans_valeurs_rien_ne_change():
    index = _quote("^FCHI", ["2026-10-20", "2026-10-21"], [1.0, 2.0])
    assert align_session(index, []) == (index, [], None)


def _daily(rows: dict[str, list[float]], days: list[str]) -> pd.DataFrame:
    frame = pd.DataFrame({(s, "Close"): v for s, v in rows.items()}, index=pd.to_datetime(days))
    frame.columns = pd.MultiIndex.from_tuples(frame.columns)
    return frame


def test_la_cloture_manquante_est_completee_par_le_dernier_cours_horaire():
    days = ["2026-10-20", "2026-10-21"]
    data = _daily({"MC.PA": [386.75, float("nan")], "^FCHI": [7838.5, 7921.7]}, days)
    stamps = pd.to_datetime(["2026-10-21 16:00", "2026-10-21 17:00"]).tz_localize("Europe/Paris")
    hourly = pd.DataFrame({("MC.PA", "Close"): [388.0, 388.6]}, index=stamps)
    hourly.columns = pd.MultiIndex.from_tuples(hourly.columns)
    asked = []
    filled = fill_last_closes(data, ["MC.PA", "^FCHI"], hourly=lambda symbols: asked.append(symbols) or hourly)
    assert asked == [["MC.PA"]]  # une seule requête, pour la seule valeur incomplète
    assert filled["MC.PA"]["Close"].iloc[-1] == 388.6


def test_un_jour_ferie_reste_vide_et_un_echec_ne_casse_rien():
    days = ["2026-10-20", "2026-10-21"]
    data = _daily({"7203.T": [10.0, float("nan")], "^GSPC": [1.0, 2.0]}, days)
    empty = pd.DataFrame({("7203.T", "Close"): [9.9]}, index=pd.to_datetime(["2026-10-20 05:00"]).tz_localize("UTC"))
    empty.columns = pd.MultiIndex.from_tuples(empty.columns)
    assert math.isnan(fill_last_closes(data.copy(), ["7203.T"], hourly=lambda s: empty)["7203.T"]["Close"].iloc[-1])

    def boom(symbols):
        raise RuntimeError("Yahoo ne répond pas")

    assert math.isnan(fill_last_closes(data.copy(), ["7203.T"], hourly=boom)["7203.T"]["Close"].iloc[-1])
