"""Cours de Bourse et indicateurs, via yfinance (données Yahoo Finance, gratuites et sans clé)."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, replace
from datetime import date

import pandas as pd
import yfinance as yf

# Ce que l'on suit sur la page Marchés : (symbole Yahoo, nom affiché, groupe, unité de variation)
# Unité « % » : variation en pourcentage. Unité « pb » : variation en points de base (taux d'intérêt).
WATCHLIST = [
    ("^FCHI", "CAC 40", "Europe", "%"),
    ("^STOXX50E", "Euro Stoxx 50", "Europe", "%"),
    ("^GDAXI", "DAX", "Europe", "%"),
    ("^FTSE", "FTSE 100", "Europe", "%"),
    ("^GSPC", "S&P 500", "Amériques", "%"),
    ("^IXIC", "Nasdaq", "Amériques", "%"),
    ("^DJI", "Dow Jones", "Amériques", "%"),
    ("^GSPTSX", "S&P/TSX", "Amériques", "%"),
    ("^N225", "Nikkei 225", "Asie", "%"),
    ("^HSI", "Hang Seng", "Asie", "%"),
    ("000001.SS", "Shanghai", "Asie", "%"),
    ("EURUSD=X", "EUR/USD", "Devises", "%"),
    ("USDJPY=X", "USD/JPY", "Devises", "%"),
    ("EURGBP=X", "EUR/GBP", "Devises", "%"),
    ("CAD=X", "USD/CAD", "Devises", "%"),
    ("EURCAD=X", "EUR/CAD", "Devises", "%"),
    ("^TNX", "Taux US 10 ans", "Taux et volatilité", "pb"),
    ("^VIX", "VIX", "Taux et volatilité", "%"),
    ("BZ=F", "Pétrole Brent", "Matières premières", "%"),
    ("GC=F", "Or", "Matières premières", "%"),
    ("HG=F", "Cuivre", "Matières premières", "%"),
    ("BTC-USD", "Bitcoin", "Crypto", "%"),
    ("ETH-USD", "Ether", "Crypto", "%"),
]


# Les 40 valeurs du CAC 40 (composition indicative, à mettre à jour si l'indice change) : (symbole, nom, secteur)
CAC40 = [
    ("MC.PA", "LVMH", "Luxe"), ("RMS.PA", "Hermès", "Luxe"), ("OR.PA", "L'Oréal", "Luxe"), ("KER.PA", "Kering", "Luxe"),
    ("BNP.PA", "BNP Paribas", "Finance"), ("CS.PA", "AXA", "Finance"), ("ACA.PA", "Crédit Agricole", "Finance"),
    ("GLE.PA", "Société Générale", "Finance"), ("EDEN.PA", "Edenred", "Finance"),
    ("AIR.PA", "Airbus", "Industrie"), ("SAF.PA", "Safran", "Industrie"), ("SU.PA", "Schneider Electric", "Industrie"),
    ("DG.PA", "Vinci", "Industrie"), ("HO.PA", "Thales", "Industrie"), ("LR.PA", "Legrand", "Industrie"),
    ("EN.PA", "Bouygues", "Industrie"), ("BVI.PA", "Bureau Veritas", "Industrie"),
    ("TTE.PA", "TotalEnergies", "Énergie et services publics"), ("ENGI.PA", "Engie", "Énergie et services publics"),
    ("VIE.PA", "Veolia", "Énergie et services publics"),
    ("SAN.PA", "Sanofi", "Santé"), ("EL.PA", "EssilorLuxottica", "Santé"), ("ERF.PA", "Eurofins", "Santé"),
    ("AI.PA", "Air Liquide", "Matériaux"), ("SGO.PA", "Saint-Gobain", "Matériaux"), ("MT.AS", "ArcelorMittal", "Matériaux"),
    ("CAP.PA", "Capgemini", "Technologie"), ("DSY.PA", "Dassault Systèmes", "Technologie"),
    ("STMPA.PA", "STMicroelectronics", "Technologie"), ("TEP.PA", "Teleperformance", "Technologie"),
    ("ORA.PA", "Orange", "Télécoms et médias"), ("PUB.PA", "Publicis", "Télécoms et médias"),
    ("BN.PA", "Danone", "Consommation"), ("RI.PA", "Pernod Ricard", "Consommation"), ("CA.PA", "Carrefour", "Consommation"),
    ("AC.PA", "Accor", "Consommation"),
    ("STLAP.PA", "Stellantis", "Automobile"), ("RNO.PA", "Renault", "Automobile"), ("ML.PA", "Michelin", "Automobile"),
    ("URW.PA", "Unibail-Rodamco-Westfield", "Immobilier"),
]

# Les grandes valeurs de Toronto (S&P/TSX 60, composition indicative) : (symbole, nom, secteur)
TSX60 = [
    ("RY.TO", "Banque Royale", "Finance"), ("TD.TO", "Banque TD", "Finance"), ("BMO.TO", "BMO", "Finance"),
    ("BNS.TO", "Banque Scotia", "Finance"), ("CM.TO", "CIBC", "Finance"), ("NA.TO", "Banque Nationale", "Finance"),
    ("MFC.TO", "Manuvie", "Finance"), ("SLF.TO", "Financière Sun Life", "Finance"), ("IFC.TO", "Intact", "Finance"),
    ("GWO.TO", "Great-West Lifeco", "Finance"), ("POW.TO", "Power Corporation", "Finance"),
    ("FFH.TO", "Fairfax", "Finance"), ("BN.TO", "Brookfield", "Finance"), ("BAM.TO", "Brookfield Asset Management", "Finance"),
    ("X.TO", "Groupe TMX", "Finance"),
    ("ENB.TO", "Enbridge", "Énergie"), ("CNQ.TO", "Canadian Natural", "Énergie"), ("SU.TO", "Suncor", "Énergie"),
    ("TRP.TO", "TC Énergie", "Énergie"), ("CVE.TO", "Cenovus", "Énergie"), ("IMO.TO", "Pétrolière Impériale", "Énergie"),
    ("TOU.TO", "Tourmaline", "Énergie"), ("CCO.TO", "Cameco", "Énergie"),
    ("AEM.TO", "Agnico Eagle", "Mines et matériaux"), ("ABX.TO", "Barrick", "Mines et matériaux"),
    ("WPM.TO", "Wheaton Precious Metals", "Mines et matériaux"), ("FNV.TO", "Franco-Nevada", "Mines et matériaux"),
    ("K.TO", "Kinross", "Mines et matériaux"), ("AGI.TO", "Alamos Gold", "Mines et matériaux"),
    ("TECK-B.TO", "Teck", "Mines et matériaux"), ("FM.TO", "First Quantum", "Mines et matériaux"),
    ("NTR.TO", "Nutrien", "Mines et matériaux"), ("CCL-B.TO", "CCL Industries", "Mines et matériaux"),
    ("CNR.TO", "CN", "Industrie"), ("CP.TO", "CPKC", "Industrie"), ("WCN.TO", "Waste Connections", "Industrie"),
    ("WSP.TO", "WSP", "Industrie"), ("CAE.TO", "CAE", "Industrie"), ("TFII.TO", "TFI International", "Industrie"),
    ("SHOP.TO", "Shopify", "Technologie"), ("CSU.TO", "Constellation Software", "Technologie"),
    ("GIB-A.TO", "CGI", "Technologie"), ("OTEX.TO", "OpenText", "Technologie"), ("CLS.TO", "Celestica", "Technologie"),
    ("TRI.TO", "Thomson Reuters", "Technologie"),
    ("ATD.TO", "Couche-Tard", "Consommation"), ("L.TO", "Loblaw", "Consommation"), ("DOL.TO", "Dollarama", "Consommation"),
    ("QSR.TO", "Restaurant Brands", "Consommation"), ("MRU.TO", "Metro", "Consommation"),
    ("WN.TO", "George Weston", "Consommation"), ("SAP.TO", "Saputo", "Consommation"),
    ("CTC-A.TO", "Canadian Tire", "Consommation"), ("MG.TO", "Magna", "Consommation"),
    ("BCE.TO", "BCE", "Télécoms"), ("T.TO", "Telus", "Télécoms"), ("RCI-B.TO", "Rogers", "Télécoms"),
    ("FTS.TO", "Fortis", "Services publics"), ("EMA.TO", "Emera", "Services publics"), ("H.TO", "Hydro One", "Services publics"),
]

# Les grandes valeurs de New York : les 30 du Dow Jones, plus cinq géants de la technologie
USA = [
    ("AAPL", "Apple", "Technologie"), ("MSFT", "Microsoft", "Technologie"), ("NVDA", "Nvidia", "Technologie"),
    ("GOOGL", "Alphabet", "Technologie"), ("META", "Meta", "Technologie"), ("AVGO", "Broadcom", "Technologie"),
    ("CSCO", "Cisco", "Technologie"), ("IBM", "IBM", "Technologie"), ("CRM", "Salesforce", "Technologie"),
    ("AMZN", "Amazon", "Consommation"), ("TSLA", "Tesla", "Consommation"), ("WMT", "Walmart", "Consommation"),
    ("HD", "Home Depot", "Consommation"), ("MCD", "McDonald's", "Consommation"), ("NKE", "Nike", "Consommation"),
    ("KO", "Coca-Cola", "Consommation"), ("PG", "Procter & Gamble", "Consommation"),
    ("NFLX", "Netflix", "Télécoms et médias"), ("DIS", "Disney", "Télécoms et médias"), ("VZ", "Verizon", "Télécoms et médias"),
    ("JPM", "JPMorgan", "Finance"), ("GS", "Goldman Sachs", "Finance"), ("V", "Visa", "Finance"),
    ("AXP", "American Express", "Finance"), ("TRV", "Travelers", "Finance"),
    ("UNH", "UnitedHealth", "Santé"), ("JNJ", "Johnson & Johnson", "Santé"), ("MRK", "Merck", "Santé"),
    ("AMGN", "Amgen", "Santé"),
    ("CAT", "Caterpillar", "Industrie"), ("BA", "Boeing", "Industrie"), ("HON", "Honeywell", "Industrie"),
    ("MMM", "3M", "Industrie"), ("SHW", "Sherwin-Williams", "Industrie"), ("CVX", "Chevron", "Énergie"),
]

# Les places suivies sur la page Marchés, chacune avec son indice et ses valeurs. Le CAC 40 n'y est qu'une place parmi
# d'autres. (clé → nom affiché, indice Yahoo, nom de l'indice, valeurs)
PLACES = {
    "france": ("France", "^FCHI", "CAC 40", CAC40),
    "canada": ("Canada", "^GSPTSX", "S&P/TSX", TSX60),
    "usa": ("États-Unis", "^DJI", "Dow Jones", USA),
}


# Yahoo refuse parfois l'indice de Toronto : à sa place, le fonds qui suit le S&P/TSX 60 (symbole, nom affiché)
FALLBACKS = {"^GSPTSX": ("XIU.TO", "S&P/TSX 60 (fonds XIU)")}


def place_of(symbol: str) -> str | None:
    """La place (« france », « canada », « usa ») dont une valeur fait partie, ou None."""
    return next((key for key, (*_, members) in PLACES.items() if any(s == symbol for s, *_ in members)), None)


CURRENCIES = {
    "EUR": "Euro", "USD": "Dollar américain", "GBP": "Livre sterling", "CHF": "Franc suisse",
    "JPY": "Yen japonais", "CNY": "Yuan chinois", "CAD": "Dollar canadien",
}


@dataclass
class Quote:
    """Le cours d'un instrument et son historique récent."""

    symbol: str
    name: str
    group: str
    unit: str  # "%" ou "pb"
    last: float
    previous: float
    history: pd.Series  # cours de clôture quotidiens, du plus ancien au plus récent

    @property
    def change(self) -> float:
        """Variation sur la dernière séance : en % (ou en points de base pour un taux)."""
        if self.unit == "pb":
            return (self.last - self.previous) * 100  # 1 point de pourcentage = 100 points de base
        return (self.last / self.previous - 1) * 100 if self.previous else 0.0

    def change_over(self, sessions: int) -> float:
        """Variation sur les N dernières séances (même unité que `change`)."""
        start = self.history.iloc[-min(sessions + 1, len(self.history))]
        if self.unit == "pb":
            return (self.last - start) * 100
        return (self.last / start - 1) * 100 if start else 0.0


def _hourly(symbols: list[str]) -> pd.DataFrame:
    return yf.download(symbols, period="5d", interval="60m", group_by="ticker", progress=False, auto_adjust=False)


def fill_last_closes(data: pd.DataFrame, symbols: list[str], hourly=_hourly) -> pd.DataFrame:
    """Yahoo publie parfois la clôture quotidienne d'une action des heures après celle de son indice : la dernière
    ligne reste vide (NaN) alors que la séance a bien eu lieu, et la page mélangerait deux séances. On la complète
    avec le dernier cours horaire de ce jour-là, en une seule requête de plus, pour les seuls instruments concernés.
    Un instrument sans cours horaire ce jour-là (jour férié de sa place) reste vide."""
    if data.empty or data.columns.nlevels < 2:
        return data
    last = data.index[-1]
    present = set(data.columns.get_level_values(0))
    missing = [s for s in symbols if s in present and pd.isna(data[s]["Close"].iloc[-1])]
    if not missing:
        return data
    try:
        bars = hourly(missing)
    except Exception:  # le complément échoue : on garde les clôtures publiées
        return data
    if bars is None or bars.empty or bars.columns.nlevels < 2:
        return data
    for symbol in missing:
        if symbol not in set(bars.columns.get_level_values(0)):
            continue
        closes = bars[symbol]["Close"].dropna()
        same_day = closes[[stamp.date() == last.date() for stamp in closes.index]]
        if len(same_day):
            data.loc[last, (symbol, "Close")] = float(same_day.iloc[-1])
    return data


def fetch_quotes(watchlist: list[tuple[str, str, str, str]] = WATCHLIST, period: str = "3mo") -> list[Quote]:
    """Télécharge en une seule requête les cours quotidiens de tous les instruments."""
    symbols = [symbol for symbol, *_ in watchlist]
    data = yf.download(symbols, period=period, interval="1d", group_by="ticker", progress=False, auto_adjust=False)
    data = fill_last_closes(data, symbols)

    quotes = []
    for symbol, name, group, unit in watchlist:
        if symbol not in data.columns.get_level_values(0):
            continue  # symbole inconnu ou indisponible aujourd'hui
        # Chaque marché a ses jours fériés (et la crypto cote le week-end) : on retire les jours sans cours.
        closes = data[symbol]["Close"].dropna()
        if len(closes) < 2:
            continue
        quotes.append(Quote(symbol, name, group, unit, float(closes.iloc[-1]), float(closes.iloc[-2]), closes))
    return quotes


def _until(quote: Quote, day: date) -> Quote:
    """Le cours tel qu'il était à la clôture du jour `day` (inchangé s'il n'a rien de plus récent)."""
    history = quote.history[[stamp.date() <= day for stamp in quote.history.index]]
    if len(history) < 2 or len(history) == len(quote.history):
        return quote
    return replace(quote, last=float(history.iloc[-1]), previous=float(history.iloc[-2]), history=history)


def align_session(index: Quote | None, members: list[Quote], share: float = 0.8) -> tuple[Quote | None, list[Quote], date | None]:
    """Un indice et ses valeurs ramenés à la même séance : la plus récente que l'indice et au moins 80 % des valeurs
    ont tous les deux (sinon le récit dirait « le CAC 40 monte » d'une séance et « 16 valeurs en hausse » d'une
    autre). Renvoie (indice, valeurs, date de la séance) ; tels quels si aucune séance commune n'est trouvée."""
    if not members:
        return index, members, None
    counts = Counter(day for q in members for day in {stamp.date() for stamp in q.history.index})
    index_days = {stamp.date() for stamp in index.history.index} if index else None
    session = next((day for day in sorted(counts, reverse=True)
                    if counts[day] >= share * len(members) and (index_days is None or day in index_days)), None)
    if session is None:
        return index, members, None
    return (_until(index, session) if index else None), [_until(q, session) for q in members], session


def fetch_quotes_with_fallback(watchlist: list[tuple[str, str, str, str]] = WATCHLIST, period: str = "3mo",
                               fetch=None) -> list[Quote]:
    """Comme `fetch_quotes` (ou `fetch`, si on en donne une autre), mais un instrument introuvable est remplacé par
    son secours (`FALLBACKS`), à sa place."""
    fetch = fetch or fetch_quotes
    quotes = fetch(watchlist, period)
    found = {q.symbol: q for q in quotes}
    spare = [(FALLBACKS[symbol][0], FALLBACKS[symbol][1], group, unit)
             for symbol, _, group, unit in watchlist if symbol in FALLBACKS and symbol not in found]
    if spare:
        try:
            found.update({q.symbol: q for q in fetch(spare, period)})
        except Exception:  # le secours échoue aussi : la page s'affiche sans cet instrument
            pass
    # L'ordre de la liste suivie est conservé : le secours prend la place de l'instrument manquant.
    result = []
    for symbol, *_ in watchlist:
        chosen = symbol if symbol in found else FALLBACKS.get(symbol, (None,))[0]
        if chosen in found:
            result.append(found[chosen])
    return result


def place_index(key: str, quotes: list[Quote]) -> Quote | None:
    """Le cours de l'indice d'une place parmi des cours (l'indice lui-même, sinon son secours), ou None."""
    symbol = PLACES[key][1]
    wanted = {symbol, FALLBACKS.get(symbol, (symbol,))[0]}
    return next((q for q in quotes if q.symbol in wanted), None)


def fetch_place(key: str, fetch=None) -> tuple[Quote | None, list[Quote]]:
    """Les cours d'une place, en une seule requête : (son indice, ses valeurs avec leur secteur comme groupe)."""
    _, index, index_name, members = PLACES[key]
    watchlist = [(index, index_name, "Indice", "%")] + [(symbol, name, sector, "%") for symbol, name, sector in members]
    quotes = fetch_quotes_with_fallback(watchlist, fetch=fetch)
    head = place_index(key, quotes)
    return head, [q for q in quotes if q is not head]


def mood(quotes: list[Quote], sessions: int = 1) -> dict | None:
    """L'ambiance d'une cote sur N séances : valeurs en hausse / en baisse / stables, variation moyenne, meilleure
    valeur et plus forte baisse (chacune sous la forme (variation, cours)). None sans aucun cours."""
    if not quotes:
        return None
    changes = sorted(((q.change_over(sessions), q) for q in quotes), key=lambda item: item[0], reverse=True)
    return {
        "count": len(changes),
        "up": sum(1 for change, _ in changes if change > 0),
        "down": sum(1 for change, _ in changes if change < 0),
        "average": sum(change for change, _ in changes) / len(changes),
        "best": changes[0],
        "worst": changes[-1],
    }


def top_moves(quotes: list[Quote], sessions: int = 1, count: int = 5) -> tuple[list, list]:
    """Les plus fortes hausses et les plus fortes baisses : deux listes de (variation, cours), les extrêmes d'abord."""
    changes = sorted(((q.change_over(sessions), q) for q in quotes), key=lambda item: item[0], reverse=True)
    return [c for c in changes if c[0] > 0][:count], [c for c in changes[::-1] if c[0] < 0][:count]


# Les vues de la page Marchés, et les autres écritures acceptées dans l'adresse (`markets?view=…`)
VIEW_KEYS = ("monde", "france", "canada", "usa", "devises")
VIEW_ALIASES = {"etats-unis": "usa", "états-unis": "usa", "us": "usa", "world": "monde", "cac40": "france",
                "cac-40": "france", "devise": "devises", "change": "devises"}


def resolve_view(value, default: str = "monde") -> str:
    """La vue demandée par le paramètre d'adresse `view` ; la vue par défaut si elle est absente ou inconnue."""
    if isinstance(value, (list, tuple)):
        value = value[-1] if value else None
    text = str(value or "").strip().lower()
    text = VIEW_ALIASES.get(text, text)
    return text if text in VIEW_KEYS else default


def search_companies(query: str, limit: int = 8) -> list[dict]:
    """Cherche des actions ou des ETF par nom ou symbole : [{"symbol", "name", "exchange"}, …]."""
    results = yf.Search(query, max_results=limit).quotes
    return [
        {"symbol": r["symbol"], "name": r.get("shortname") or r.get("longname") or r["symbol"],
         "exchange": r.get("exchDisp", "")}
        for r in results
        if r.get("quoteType") in ("EQUITY", "ETF") and r.get("symbol")
    ]


# Indicateurs affichés sur la fiche : clé yfinance -> (libellé, format, explication)
# Formats : "money" (montant), "x" (multiple), "pct" (déjà en %), "ratio" (fraction à convertir en %), "num"
INDICATORS = {
    "marketCap": ("Capitalisation", "money", "Valeur de l'entreprise en Bourse : cours × nombre d'actions."),
    "trailingPE": ("PER (12 derniers mois)", "x",
                   "Price Earnings Ratio : cours ÷ bénéfice par action. Combien d'années de bénéfices le marché paie."),
    "forwardPE": ("PER prévisionnel", "x", "Le même ratio, calculé sur le bénéfice attendu par les analystes."),
    "priceToBook": ("Cours / valeur comptable", "x", "Supérieur à 1 : le marché valorise l'entreprise au-dessus de ses fonds propres."),
    "enterpriseToEbitda": ("VE / EBITDA", "x", "Valeur d'entreprise (dette comprise) ÷ excédent brut d'exploitation."),
    "dividendYield": ("Rendement du dividende", "pct", "Dividende annuel ÷ cours de l'action."),
    "profitMargins": ("Marge nette", "ratio", "Part du chiffre d'affaires qui reste en bénéfice net."),
    "returnOnEquity": ("Rentabilité des capitaux propres (ROE)", "ratio", "Bénéfice net ÷ capitaux propres."),
    "revenueGrowth": ("Croissance du chiffre d'affaires", "ratio", "Sur un an, dernier trimestre publié."),
    "beta": ("Bêta", "num", "Sensibilité au marché : 1,2 = bouge en moyenne 20 % de plus que l'indice."),
}


def company_profile(symbol: str) -> dict:
    """Fiche d'une entreprise (nom, secteur, site, indicateurs…). Dictionnaire vide si indisponible."""
    info = yf.Ticker(symbol).info or {}
    if not info.get("shortName") and not info.get("longName"):
        return {}
    return info


def price_history(symbol: str, period: str = "6mo") -> pd.DataFrame:
    """Historique quotidien (Open, High, Low, Close, Volume), index = dates."""
    return yf.Ticker(symbol).history(period=period, auto_adjust=False)


def euro_rates() -> dict[str, float]:
    """Combien vaut 1 euro dans chaque devise de CURRENCIES : {"USD": 1.12, "GBP": 0.85, …}."""
    pairs = [f"EUR{code}=X" for code in CURRENCIES if code != "EUR"]
    data = yf.download(pairs, period="5d", interval="1d", group_by="ticker", progress=False, auto_adjust=False)
    rates = {"EUR": 1.0}
    for code in CURRENCIES:
        pair = f"EUR{code}=X"
        if code != "EUR" and pair in data.columns.get_level_values(0):
            closes = data[pair]["Close"].dropna()
            if not closes.empty:
                rates[code] = float(closes.iloc[-1])
    return rates


def convert(amount: float, source: str, target: str, rates: dict[str, float]) -> float:
    """Convertit un montant d'une devise à l'autre en passant par l'euro (taux « croisé »)."""
    return amount / rates[source] * rates[target]


def company_calendar(symbol: str) -> dict:
    """Prochains rendez-vous d'une entreprise (dates passées ignorées) et consensus des analystes."""
    calendar = yf.Ticker(symbol).calendar or {}
    today = date.today()

    def upcoming(value):
        return value if isinstance(value, date) and value >= today else None

    earnings = [d for d in calendar.get("Earnings Date", []) if upcoming(d)]
    return {
        "earnings": earnings[0] if earnings else None,
        "ex_dividend": upcoming(calendar.get("Ex-Dividend Date")),
        "dividend": upcoming(calendar.get("Dividend Date")),
        "eps_average": calendar.get("Earnings Average"),
        "revenue_average": calendar.get("Revenue Average"),
    }


def closes_table(symbols: list[str], period: str = "1y") -> pd.DataFrame:
    """Cours de clôture ajustés (dividendes et divisions d'actions pris en compte), une colonne par symbole.

    Les Bourses n'ont pas les mêmes jours fériés : on reporte le dernier cours connu (ffill) pour aligner les dates.
    """
    data = yf.download(symbols, period=period, interval="1d", group_by="ticker", progress=False, auto_adjust=True)
    available = [s for s in symbols if s in data.columns.get_level_values(0)]
    table = pd.DataFrame({s: data[s]["Close"] for s in available})
    return table.dropna(how="all").ffill().dropna()
