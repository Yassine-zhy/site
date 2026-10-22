"""La fiche d'une valeur : performances, résultats, avis des analystes, dividendes, actualités liées.

Les fonctions « pures » (sans réseau) transforment des données déjà téléchargées ; les fonctions `fetch_*` interrogent
Yahoo Finance (yfinance) et sont mises en cache par `sheet.py`.
"""

from __future__ import annotations

import re
from datetime import date, timedelta

import pandas as pd
import yfinance as yf

from core import market
from core.aggregator import deduplicate
from core.config import COMPANIES
from core.filters import normalize
from core.models import Article

# Les taux d'intérêt (le « cours » est un taux en %) : leurs variations se lisent en points de base
RATE_SYMBOLS = {"^TNX", "^FVX", "^TYX", "^IRX"}

# Les types Yahoo (`quoteType`) qui ont une fiche d'entreprise
STOCK_TYPES = {"EQUITY", "ETF"}

# Libellé de la catégorie d'un instrument (fil d'Ariane et en-tête), d'après `quoteType`
KINDS = {
    "EQUITY": "Actions", "ETF": "Fonds indiciels", "INDEX": "Indices", "CURRENCY": "Devises",
    "FUTURE": "Matières premières", "CRYPTOCURRENCY": "Crypto", "MUTUALFUND": "Fonds",
}
# Le même, au singulier (« Type : Indice »)
KIND_NAMES = {
    "EQUITY": "Action", "ETF": "Fonds indiciel", "INDEX": "Indice", "CURRENCY": "Devise", "FUTURE": "Matière première",
    "CRYPTOCURRENCY": "Crypto", "MUTUALFUND": "Fonds",
}
# Ordre des périodes du tableau des performances : (libellé, décalage en calendrier)
PERFORMANCE_PERIODS = [
    ("1 semaine", pd.DateOffset(weeks=1)), ("1 mois", pd.DateOffset(months=1)), ("3 mois", pd.DateOffset(months=3)),
    ("6 mois", pd.DateOffset(months=6)), ("Depuis le 1er janvier", None), ("1 an", pd.DateOffset(years=1)),
    ("5 ans", pd.DateOffset(years=5)),
]


# --- Quelle sorte de valeur ? ------------------------------------------------------------------


SYMBOL_OK = re.compile(r"[A-Z0-9.^=_-]*")


def normalize_symbol(raw) -> str:
    """Le symbole lu dans l'adresse (`?s=mc.pa` → « MC.PA ») ; chaîne vide s'il n'y en a pas, ou s'il est invalide
    (20 caractères au plus, parmi lettres, chiffres et . ^ = _ -)."""
    if isinstance(raw, (list, tuple)):
        raw = raw[0] if raw else ""
    symbol = str(raw or "").strip().upper()[:20]
    return symbol if SYMBOL_OK.fullmatch(symbol) else ""


def guess_type(symbol: str) -> str:
    """Le type Yahoo d'après la forme du symbole, quand Yahoo ne répond pas : « ^FCHI » est un indice, « EURUSD=X »
    une devise, « GC=F » une matière première, « BTC-USD » une crypto, le reste une action."""
    if symbol.startswith("^"):
        return "INDEX"
    if symbol.endswith("=X"):
        return "CURRENCY"
    if symbol.endswith("=F"):
        return "FUTURE"
    if re.fullmatch(r"[A-Z0-9]{2,6}-(USD|EUR|CAD|GBP)", symbol):
        return "CRYPTOCURRENCY"
    return "EQUITY"


def quote_type(symbol: str, profile: dict | None = None) -> str:
    """Le type de la valeur : celui de Yahoo si on l'a, sinon une estimation d'après le symbole."""
    declared = str((profile or {}).get("quoteType") or "").upper()
    return declared or guess_type(symbol)


def is_stock(kind: str) -> bool:
    """Vrai pour une action ou un fonds indiciel (la fiche d'entreprise), faux pour un indice, une devise, etc."""
    return kind in STOCK_TYPES


def known_name(symbol: str) -> str | None:
    """Le nom d'une valeur que le site connaît déjà (CAC 40, Toronto, New York, grandes entreprises, marchés)."""
    for _, _, _, members in market.PLACES.values():
        for member, name, _ in members:
            if member == symbol:
                return name
    if symbol in COMPANIES:
        return COMPANIES[symbol][0]
    return next((name for member, name, *_ in market.WATCHLIST if member == symbol), None)


def sector_peers(symbol: str, limit: int = 12) -> list[tuple[str, str]]:
    """Les autres valeurs de la même place et du même secteur : [(symbole, nom), …]."""
    key = market.place_of(symbol)
    if key is None:
        return []
    members = market.PLACES[key][3]
    sector = next(sec for s, _, sec in members if s == symbol)
    return [(s, name) for s, name, sec in members if sec == sector and s != symbol][:limit]


def place_of_index(symbol: str) -> str | None:
    """La clé de la place (« france », « canada », « usa ») dont c'est l'indice, ou None."""
    return next((key for key, (_, index, *_) in market.PLACES.items() if index == symbol), None)


def with_symbol(options: list[str], symbol: str) -> tuple[list[str], int | None]:
    """Les choix d'une liste, avec `symbol` ajouté en tête s'il n'y est pas, et sa position (None s'il n'y a pas de
    symbole) : sert à présélectionner la valeur de la fiche dans les formulaires d'alerte et de portefeuille."""
    if not symbol:
        return options, None
    if symbol not in options:
        options = [symbol, *options]
    return options, options.index(symbol)


# --- Performances ------------------------------------------------------------------------------


def performances(closes: pd.Series, unit: str = "%") -> list[tuple[str, float | None]]:
    """La variation entre le dernier cours et le cours d'il y a une semaine, un mois… : [(libellé, variation), …].

    Le cours de référence est celui de la dernière séance au plus tard à la date voulue ; « depuis le 1er janvier »
    part de la clôture du dernier jour de l'année précédente. Une période plus longue que l'historique donne None.
    En points de base (unité « pb ») pour un taux d'intérêt.
    """
    closes = closes.dropna()
    if len(closes) < 2:
        return []
    last_day, last = closes.index[-1], float(closes.iloc[-1])
    zone = closes.index.tz

    def start_price(target: pd.Timestamp) -> float | None:
        before = closes[closes.index <= target]
        if not before.empty:
            return float(before.iloc[-1])
        # La première séance connue est à quelques jours de la date voulue (week-end, jour férié) : on la prend
        return float(closes.iloc[0]) if closes.index[0] - target <= timedelta(days=5) else None

    result = []
    for label, offset in PERFORMANCE_PERIODS:
        if offset is None:
            target = pd.Timestamp(year=last_day.year - 1, month=12, day=31, hour=23, minute=59, tz=zone)
        else:
            target = last_day - offset
        start = start_price(target)
        if start is None or start == 0:
            result.append((label, None))
        elif unit == "pb":
            result.append((label, (last - start) * 100))
        else:
            result.append((label, (last / start - 1) * 100))
    return result


# --- Les analystes -----------------------------------------------------------------------------


def recommendation_label(mean: float | None) -> str | None:
    """La recommandation moyenne (1 = achat fort … 5 = vente forte, l'échelle de Yahoo) en français."""
    if mean is None:
        return None
    for limit, label in [(1.5, "achat fort"), (2.5, "achat"), (3.5, "conserver"), (4.5, "vente")]:
        if mean < limit:
            return label
    return "vente forte"


def mean_from_counts(counts: dict) -> tuple[float | None, int]:
    """La note moyenne (1 à 5) et le nombre d'analystes d'après leur répartition
    {"strongBuy": 3, "buy": 14, "hold": 10, "sell": 0, "strongSell": 0}."""
    weights = {"strongBuy": 1, "buy": 2, "hold": 3, "sell": 4, "strongSell": 5}
    total = sum(int(counts.get(key) or 0) for key in weights)
    if not total:
        return None, 0
    return sum(weight * int(counts.get(key) or 0) for key, weight in weights.items()) / total, total


def upside(current: float | None, target: float | None) -> float | None:
    """Le potentiel, en %, entre le cours actuel et l'objectif de cours (négatif si l'objectif est plus bas)."""
    if not current or not target or current <= 0:
        return None
    return (target / current - 1) * 100


def analyst_summary(profile: dict, extra: dict | None = None) -> dict | None:
    """L'avis des analystes : {"label", "mean", "count", "low", "target", "high", "current", "upside"}, ou None si
    Yahoo ne donne rien. `profile` : la fiche Yahoo ; `extra` : {"counts": {...}, "targets": {...}} en secours."""
    extra = extra or {}
    mean, count = profile.get("recommendationMean"), profile.get("numberOfAnalystOpinions")
    if mean is None and extra.get("counts"):
        mean, count_from_votes = mean_from_counts(extra["counts"])
        count = count or count_from_votes
    targets = extra.get("targets") or {}
    low = profile.get("targetLowPrice") or targets.get("low")
    target = profile.get("targetMeanPrice") or targets.get("mean")
    high = profile.get("targetHighPrice") or targets.get("high")
    current = profile.get("regularMarketPrice") or profile.get("currentPrice") or targets.get("current")
    if mean is None and not target:
        return None
    return {"label": recommendation_label(mean), "mean": mean, "count": int(count or 0), "low": low,
            "target": target, "high": high, "current": current, "upside": upside(current, target)}


def target_positions(low: float, target: float, high: float, current: float) -> dict[str, float]:
    """La place (0 à 100 %) de chaque repère sur la barre des objectifs de cours, avec une marge de chaque côté."""
    values = {"low": low, "target": target, "high": high, "current": current}
    floor, ceiling = min(values.values()), max(values.values())
    margin = (ceiling - floor) * 0.08 or 1
    floor, ceiling = floor - margin, ceiling + margin
    return {name: (value - floor) / (ceiling - floor) * 100 for name, value in values.items()}


# --- Résultats et dividendes -------------------------------------------------------------------


def yearly_results(income: pd.DataFrame | None, years: int = 4) -> list[dict]:
    """Chiffre d'affaires, résultat net et marge nette des dernières années, du plus ancien au plus récent :
    [{"year": 2025, "revenue": …, "net": …, "margin": …}, …]. `income` : `income_stmt` de yfinance (une colonne par
    exercice). Un exercice sans chiffre d'affaires est ignoré."""
    if income is None or income.empty or "Total Revenue" not in income.index:
        return []
    row_net = next((name for name in ("Net Income", "Net Income Common Stockholders") if name in income.index), None)
    rows = []
    for moment in sorted(income.columns, reverse=True):
        revenue = income.at["Total Revenue", moment]
        if pd.isna(revenue) or not revenue:
            continue
        net = income.at[row_net, moment] if row_net else None
        net = None if net is None or pd.isna(net) else float(net)
        rows.append({"year": pd.Timestamp(moment).year, "revenue": float(revenue), "net": net,
                     "margin": net / float(revenue) * 100 if net is not None else None})
        if len(rows) == years:
            break
    return rows[::-1]


def annual_dividends(payments: list[tuple[str, float]], today: date | None = None, years: int = 5) -> list[tuple[int, float]]:
    """Le dividende total versé par année civile, pour les `years` dernières années COMPLÈTES : [(2021, 6.0), …].
    `payments` : [("2025-12-02", 5.5), …]. L'année en cours est laissée de côté : elle est incomplète."""
    today = today or date.today()
    totals: dict[int, float] = {}
    for day, amount in payments:
        year = int(str(day)[:4])
        if year < today.year:
            totals[year] = totals.get(year, 0.0) + float(amount)
    return sorted(totals.items())[-years:]


def trailing_yield(payments: list[tuple[str, float]], price: float | None, today: date | None = None) -> float | None:
    """Le rendement, en %, des dividendes versés sur les 12 derniers mois par rapport au cours actuel."""
    if not price or price <= 0:
        return None
    today = today or date.today()
    since = (today - timedelta(days=365)).isoformat()
    paid = sum(float(amount) for day, amount in payments if str(day)[:10] >= since)
    return paid / price * 100 if paid else None


# --- Actualités --------------------------------------------------------------------------------


def mentions(article: Article, symbol: str, names: list[str]) -> bool:
    """Vrai si l'article parle de l'entreprise : son symbole est dans ses mots-clés, ou un de ses noms est cité
    (mot entier, sans tenir compte de la casse ni des accents)."""
    if symbol in article.tickers:
        return True
    text = normalize(f"{article.title} {article.summary}")
    for name in names:
        name = normalize(name).strip()
        if len(name) >= 3 and re.search(rf"(?<![a-z0-9]){re.escape(name)}(?![a-z0-9])", text):
            return True
    return False


def related_news(feed: list[Article], yahoo: list[Article], symbol: str, names: list[str], limit: int = 8) -> list[Article]:
    """Les dépêches du fil qui parlent de la valeur, plus les nouvelles Yahoo de la valeur, sans doublon, les `limit`
    plus récentes."""
    pool = [a for a in feed if mentions(a, symbol, names)] + list(yahoo)
    return sorted(deduplicate(pool), key=lambda a: a.published, reverse=True)[:limit]


def movers(changes: list[tuple[str, str, float]], count: int = 5) -> tuple[list, list]:
    """Les plus fortes hausses et baisses d'une liste [(symbole, nom, variation), …] : (hausses, baisses). Une valeur
    ne figure que d'un seul côté (une liste courte n'affiche pas la même valeur deux fois)."""
    ranked = sorted(changes, key=lambda item: item[2], reverse=True)
    ups = [item for item in ranked if item[2] > 0][:count]
    downs = [item for item in ranked[::-1] if item[2] < 0][:count]
    return ups, downs


# --- Yahoo Finance -----------------------------------------------------------------------------


def _from_metadata(symbol: str) -> dict:
    """La fiche minimale d'une valeur d'après les métadonnées de son historique (servie par une autre route de Yahoo
    que `info`, qui refuse parfois de répondre) : nom, devise, type, Bourse, fourchette sur 52 semaines."""
    meta = yf.Ticker(symbol).history_metadata or {}
    if not meta.get("symbol"):
        return {}
    kind = str(meta.get("instrumentType") or "").upper()
    return {
        "shortName": meta.get("shortName") or meta.get("longName"), "longName": meta.get("longName"),
        "currency": meta.get("currency"), "quoteType": "FUTURE" if kind == "FUTURES" else kind,
        "fullExchangeName": meta.get("fullExchangeName") or meta.get("exchangeName"),
        "regularMarketPrice": meta.get("regularMarketPrice"),
        "fiftyTwoWeekLow": meta.get("fiftyTwoWeekLow"), "fiftyTwoWeekHigh": meta.get("fiftyTwoWeekHigh"),
    }


def fetch_overview(symbol: str) -> dict:
    """La fiche Yahoo d'une valeur (`info`) ; à défaut, la fiche minimale tirée de l'historique. Vide si Yahoo ne
    connaît pas le symbole."""
    try:
        info = market.company_profile(symbol)
    except Exception:  # Yahoo refuse (429, 401, 404…) ou renvoie un format inattendu : on passe au secours
        info = {}
    return info or _from_metadata(symbol)


def fetch_income(symbol: str) -> list[dict]:
    """Les résultats annuels (voir `yearly_results`)."""
    return yearly_results(yf.Ticker(symbol).income_stmt)


def fetch_dividends(symbol: str) -> list[tuple[str, float]]:
    """Tous les dividendes versés : [("2025-12-02", 5.5), …], du plus ancien au plus récent."""
    series = yf.Ticker(symbol).dividends
    return [(moment.strftime("%Y-%m-%d"), float(amount)) for moment, amount in series.items() if amount]


def fetch_analysts(symbol: str) -> dict:
    """Les avis des analystes quand `info` n'en donne pas : {"counts": {...}, "targets": {...}}. Chaque morceau est
    facultatif : Yahoo n'a rien pour la plupart des indices et des petites valeurs."""
    ticker, found = yf.Ticker(symbol), {}
    try:
        targets = ticker.analyst_price_targets
        if targets:
            found["targets"] = {key: float(value) for key, value in targets.items() if value is not None}
    except Exception:
        pass
    try:
        summary = ticker.recommendations_summary
        if summary is not None and not summary.empty:
            found["counts"] = summary.iloc[0].to_dict()
    except Exception:
        pass
    return found
