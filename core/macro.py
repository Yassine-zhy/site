"""Indicateurs macroéconomiques officiels, sans clé API.

- Zone euro et France : portail de données de la Banque centrale européenne (BCE),
  https://data.ecb.europa.eu — séries identifiées par une « clé » (ex. HICP/M.U2.N.000000.4D0.ANR) ;
- États-Unis : FRED, la base de données de la Réserve fédérale de Saint-Louis,
  https://fred.stlouisfed.org — séries identifiées par un code (ex. CPIAUCSL).

Les deux services renvoient du CSV : un tableau en texte que pandas lit directement.
"""

from __future__ import annotations

import io
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

import pandas as pd
import requests

ECB_URL = "https://data-api.ecb.europa.eu/service/data/{key}"
FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv"
TIMEOUT = 20
# Pas d'en-tête « User-Agent » personnalisé : la protection anti-robots de FRED laisse alors la requête
# sans réponse (délai dépassé). L'en-tête par défaut de requests est accepté.


@dataclass(frozen=True)
class Indicator:
    key: str  # identifiant interne
    label: str  # « Inflation »
    zone: str  # « Zone euro », « France », « États-Unis »
    source: str  # "ecb" ou "fred"
    series: str  # identifiant de la série chez la source
    help: str = ""  # explication affichée au survol
    transform: str = ""  # "yoy" : la source donne un indice de prix, on calcule la variation sur un an


EA, FR, US = "Zone euro", "France", "États-Unis"

INDICATORS = [
    Indicator("infl_ea", "Inflation", EA, "ecb", "HICP/M.U2.N.000000.4D0.ANR",
              "Hausse des prix à la consommation sur un an (indice IPCH d'Eurostat)."),
    Indicator("infl_fr", "Inflation", FR, "ecb", "HICP/M.FR.N.000000.4D0.ANR",
              "Hausse des prix à la consommation sur un an (IPCH, comparable entre pays européens)."),
    Indicator("infl_us", "Inflation", US, "fred", "CPIAUCSL",
              "Hausse de l'indice des prix à la consommation (CPI) sur un an.", "yoy"),
    Indicator("core_ea", "Inflation sous-jacente", EA, "ecb", "HICP/M.U2.N.XEF000.4D0.ANR",
              "Hors énergie et alimentation, dont les prix varient beaucoup : la tendance de fond des prix."),
    Indicator("core_us", "Inflation sous-jacente", US, "fred", "CPILFESL",
              "CPI hors énergie et alimentation, sur un an.", "yoy"),
    Indicator("rate_ecb", "Taux de dépôt de la BCE", EA, "ecb", "FM/B.U2.EUR.4F.KR.DFR.LEV",
              "Taux auquel la BCE rémunère les dépôts des banques : il pilote les taux courts de la zone euro."),
    Indicator("rate_fed", "Taux des fonds fédéraux", US, "fred", "FEDFUNDS",
              "Taux directeur de la Réserve fédérale (moyenne mensuelle du taux effectif)."),
    Indicator("unemp_ea", "Chômage", EA, "ecb", "LFSI/M.I9.S.UNEHRT.TOTAL0.15_74.T",
              "Part des 15-74 ans sans emploi qui en cherchent un, corrigée des variations saisonnières."),
    Indicator("unemp_fr", "Chômage", FR, "ecb", "LFSI/M.FR.S.UNEHRT.TOTAL0.15_74.T",
              "Taux de chômage au sens du Bureau international du travail (Eurostat)."),
    Indicator("unemp_us", "Chômage", US, "fred", "UNRATE", "Taux de chômage (Bureau of Labor Statistics)."),
    Indicator("bond_ea", "Taux à 10 ans", EA, "ecb", "YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y",
              "Rendement des emprunts d'État à 10 ans les mieux notés (AAA) de la zone euro."),
    Indicator("bond_fr", "Taux à 10 ans", FR, "ecb", "IRS/M.FR.L.L40.CI.0000.EUR.N.Z",
              "Rendement de l'OAT à 10 ans (moyenne mensuelle)."),
    Indicator("bond_us", "Taux à 10 ans", US, "fred", "DGS10", "Rendement du bon du Trésor américain à 10 ans."),
    Indicator("gdp_ea", "Croissance du PIB", EA, "ecb", "MNA/Q.Y.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY",
              "Évolution du PIB en volume par rapport au même trimestre de l'année précédente."),
    Indicator("gdp_us", "Croissance du PIB", US, "fred", "A191RO1Q156NBEA",
              "Évolution du PIB en volume par rapport au même trimestre de l'année précédente."),
]
BY_KEY = {indicator.key: indicator for indicator in INDICATORS}

# Courbes des taux : (étiquette, maturité en années, code FRED, code BCE)
MATURITIES = [
    ("3 mois", 0.25, "DGS3MO", "SR_3M"),
    ("1 an", 1, "DGS1", "SR_1Y"),
    ("2 ans", 2, "DGS2", "SR_2Y"),
    ("5 ans", 5, "DGS5", "SR_5Y"),
    ("10 ans", 10, "DGS10", "SR_10Y"),
    ("30 ans", 30, "DGS30", "SR_30Y"),
]
ECB_CURVE = "YC/B.U2.EUR.4F.G_N_A.SV_C_YM." + "+".join(code for *_, code in MATURITIES)


# --- Lecture des données --------------------------------------------------------------------------


def parse_period(value: str) -> pd.Timestamp:
    """« 2026-09 » (mois), « 2026-Q1 » (trimestre), « 2026-10-08 » (jour) ou « 2026 » (année) → une date."""
    value = value.strip()
    if "-Q" in value:
        year, quarter = value.split("-Q")
        return pd.Timestamp(year=int(year), month=3 * int(quarter) - 2, day=1)
    if len(value) == 4:
        return pd.Timestamp(year=int(value), month=1, day=1)
    return pd.Timestamp(value)


def parse_ecb_csv(text: str) -> pd.DataFrame:
    """CSV de la BCE → tableau : une ligne par date, une colonne par série (nommée par le dernier élément de sa clé)."""
    raw = pd.read_csv(io.StringIO(text), dtype=str)
    if raw.empty:
        return pd.DataFrame()
    raw["date"] = raw["TIME_PERIOD"].map(parse_period)
    raw["serie"] = raw["KEY"].str.split(".").str[-1]
    raw["valeur"] = pd.to_numeric(raw["OBS_VALUE"], errors="coerce")
    return raw.pivot_table(index="date", columns="serie", values="valeur", aggfunc="last").sort_index()


def parse_fred_csv(text: str) -> pd.DataFrame:
    """CSV de FRED → tableau indexé par date. Les valeurs manquantes (« . » ou vides) deviennent NaN."""
    table = pd.read_csv(io.StringIO(text), na_values=["."])
    date_column = table.columns[0]  # « observation_date » (ou « DATE » dans les anciens fichiers)
    table[date_column] = pd.to_datetime(table[date_column])
    return table.set_index(date_column).apply(pd.to_numeric, errors="coerce").sort_index()


def _get(url: str, params: dict) -> str:
    response = requests.get(url, params=params, timeout=TIMEOUT)
    response.raise_for_status()
    return response.text


def fetch_ecb(key: str, start: str) -> pd.DataFrame:
    """Une ou plusieurs séries de la BCE (les « + » dans la clé demandent plusieurs séries d'un coup)."""
    return parse_ecb_csv(_get(ECB_URL.format(key=key), {"format": "csvdata", "detail": "dataonly",
                                                         "startPeriod": start}))


def fetch_fred(series: str, start: str) -> pd.DataFrame:
    return parse_fred_csv(_get(FRED_URL, {"id": series, "cosd": start}))


def year_over_year(index: pd.Series) -> pd.Series:
    """Variation sur un an, en %, d'un indice mensuel : (indice / indice 12 mois plus tôt − 1) × 100."""
    return (index / index.shift(12) - 1) * 100


def fetch_indicator(indicator: Indicator, start: str) -> pd.Series:
    """La série d'un indicateur, en %, sans valeurs manquantes."""
    if indicator.source == "ecb":
        table = fetch_ecb(indicator.series, start)
    else:
        # Pour une variation sur un an, il faut 12 mois d'historique en plus
        begin = str(pd.Timestamp(start) - pd.DateOffset(months=13))[:10] if indicator.transform == "yoy" else start
        table = fetch_fred(indicator.series, begin)
    series = table.iloc[:, 0] if not table.empty else pd.Series(dtype=float)
    if indicator.transform == "yoy":
        series = year_over_year(series)
    series = series.dropna()
    return series[series.index >= pd.Timestamp(start)].rename(indicator.key)


def fetch_all(start: str, indicators=INDICATORS) -> tuple[dict[str, pd.Series], list[str]]:
    """Télécharge tous les indicateurs en parallèle. Une source en panne n'empêche pas d'afficher les autres."""
    results, errors = {}, []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {indicator.key: pool.submit(fetch_indicator, indicator, start) for indicator in indicators}
    for key, future in futures.items():
        try:
            series = future.result()
        except (requests.RequestException, ValueError, KeyError) as error:
            indicator = BY_KEY[key]
            errors.append(f"{indicator.label} ({indicator.zone}) : {type(error).__name__}")
            continue
        if not series.empty:
            results[key] = series
    return results, errors


def fetch_yield_curves(start: str) -> dict[str, pd.DataFrame]:
    """Historique quotidien des taux par maturité : {"États-Unis": tableau, "Zone euro": tableau}.

    Colonnes = étiquettes des maturités (« 3 mois », « 10 ans »…).
    """
    with ThreadPoolExecutor(max_workers=8) as pool:
        us = {label: pool.submit(fetch_fred, code, start) for label, _, code, _ in MATURITIES}
        euro = pool.submit(fetch_ecb, ECB_CURVE, start)
    us_table = pd.concat({label: future.result().iloc[:, 0] for label, future in us.items()}, axis=1)
    euro_table = euro.result().rename(columns={code: label for label, _, _, code in MATURITIES})
    return {US: us_table, EA: euro_table[[label for label, *_ in MATURITIES if label in euro_table]]}


# --- Calculs -----------------------------------------------------------------------------------


def frequency(series: pd.Series) -> str:
    """« jour », « mois » ou « trimestre ».

    Les séries mensuelles et trimestrielles sont datées du 1er de la période (voir parse_period) : une date qui
    n'est pas un 1er indique une série quotidienne (ou des dates de décision, comme le taux de la BCE).
    """
    if len(series) < 2 or (series.index.day != 1).any():
        return "jour"
    gap = series.index.to_series().diff().median()
    return "mois" if gap <= pd.Timedelta(days=40) else "trimestre"


def extend_to(series: pd.Series, moment: pd.Timestamp) -> pd.Series:
    """Prolonge une série « par paliers » (taux directeur : une valeur par décision) jusqu'à une date."""
    if series.empty or series.index[-1] >= moment:
        return series
    return pd.concat([series, pd.Series([series.iloc[-1]], index=[moment])])


def latest(series: pd.Series) -> dict:
    """Dernière valeur, date, et évolution depuis la valeur précédente et depuis un an (en points)."""
    series = series.dropna()
    last_date = series.index[-1]
    year_ago = series[series.index <= last_date - pd.DateOffset(years=1)]
    return {
        "value": float(series.iloc[-1]),
        "date": last_date,
        "change": float(series.iloc[-1] - series.iloc[-2]) if len(series) > 1 else 0.0,
        "change_year": float(series.iloc[-1] - year_ago.iloc[-1]) if not year_ago.empty else None,
    }


def curve_on(table: pd.DataFrame, moment: pd.Timestamp) -> pd.Series:
    """La courbe des taux à une date : la dernière valeur connue de chaque maturité à cette date."""
    return table[table.index <= moment].ffill().iloc[-1].dropna()


def curve_shape(curve: pd.Series) -> tuple[str, float]:
    """Forme de la courbe d'après l'écart 10 ans − 2 ans : (« normale » / « plate » / « inversée », écart en points)."""
    spread = float(curve["10 ans"] - curve["2 ans"])
    if spread < -0.1:
        return "inversée", spread
    if spread < 0.25:
        return "plate", spread
    return "normale", spread


def real_rate(nominal: float, inflation: float) -> float:
    """Taux réel (relation de Fisher) : ce que rapporte vraiment un placement une fois l'inflation déduite."""
    return ((1 + nominal / 100) / (1 + inflation / 100) - 1) * 100
