"""Le dernier cours des indices racontés corrigé par le cours officiel de Yahoo (core.market.apply_official)."""

import pandas as pd

from core import market
from core.market import Quote

DAYS = pd.date_range("2026-11-03", periods=4, freq="D", tz="Europe/Paris")  # 3 → 6 novembre


def cac(closes):
    series = pd.Series(closes, index=DAYS[: len(closes)], dtype=float)
    return Quote("^FCHI", "CAC 40", "Indices", "%", float(series.iloc[-1]), float(series.iloc[-2]), series)


def meta(price, when):
    return {"regularMarketPrice": price, "regularMarketTime": pd.Timestamp(when, tz="Europe/Paris"),
            "exchangeTimezoneName": "Europe/Paris"}


def test_une_cloture_du_jour_fausse_est_remplacee_par_le_cours_officiel():
    """Vendredi 6 novembre 2026 : Yahoo donnait 8 130,54 (−0,91 %) au lieu de 8 139,00 (−0,81 %)."""
    quote = market.apply_official(cac([8020.31, 8177.89, 8205.37, 8130.54]), meta(8139.0, "2026-11-06 18:05"))
    assert quote.last == 8139.0 and quote.previous == 8205.37 and round(quote.change, 2) == -0.81
    assert quote.history.iloc[-1] == 8139.0 and len(quote.history) == 4


def test_une_seance_du_jour_absente_est_ajoutee():
    quote = market.apply_official(cac([8020.31, 8177.89, 8205.37]), meta(8139.0, "2026-11-06 18:05"))
    assert quote.last == 8139.0 and quote.previous == 8205.37
    assert quote.history.index[-1].date().isoformat() == "2026-11-06" and len(quote.history) == 4


def test_un_cours_officiel_plus_ancien_ou_invraisemblable_est_ignore():
    base = cac([8020.31, 8177.89, 8205.37, 8130.54])
    assert market.apply_official(base, meta(8100.0, "2026-11-05 18:05")) is base  # séance plus ancienne
    assert market.apply_official(base, meta(1.0, "2026-11-06 18:05")) is base  # écart de plus de 15 %
    assert market.apply_official(base, None) is base and market.apply_official(base, {}) is base


def test_l_heure_en_secondes_de_l_api_brute_est_comprise():
    when = int(pd.Timestamp("2026-11-06 18:05", tz="Europe/Paris").timestamp())
    quote = market.apply_official(cac([8020.31, 8177.89, 8205.37, 8130.54]),
                                  {"regularMarketPrice": 8139.0, "regularMarketTime": when,
                                   "exchangeTimezoneName": "Europe/Paris"})
    assert quote.last == 8139.0


def test_seuls_les_indices_racontes_sont_corriges_et_une_panne_ne_change_rien():
    other = Quote("^GDAXI", "DAX", "Indices", "%", 100.0, 99.0, pd.Series([99.0, 100.0], index=DAYS[2:]))
    asked = []

    def fetch(symbol):
        asked.append(symbol)
        raise OSError("réseau coupé")

    quotes = [cac([8205.37, 8130.54]), other]
    assert market.with_official_prices(quotes, fetch=fetch) == quotes and asked == ["^FCHI"]
    fixed = market.with_official_prices(quotes, fetch=lambda symbol: meta(8139.0, "2026-11-06 18:05"))
    assert fixed[0].last == 8139.0 and fixed[1] is other
