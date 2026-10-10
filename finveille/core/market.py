"""Cours de Bourse et indicateurs, via yfinance (données Yahoo Finance, gratuites et sans clé)."""

from __future__ import annotations

from dataclasses import dataclass
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
    ("^N225", "Nikkei 225", "Asie", "%"),
    ("^HSI", "Hang Seng", "Asie", "%"),
    ("000001.SS", "Shanghai", "Asie", "%"),
    ("EURUSD=X", "EUR/USD", "Devises", "%"),
    ("USDJPY=X", "USD/JPY", "Devises", "%"),
    ("EURGBP=X", "EUR/GBP", "Devises", "%"),
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
        return (self.last / self.previous - 1) * 100

    def change_over(self, sessions: int) -> float:
        """Variation sur les N dernières séances (même unité que `change`)."""
        start = self.history.iloc[-min(sessions + 1, len(self.history))]
        return (self.last - start) * 100 if self.unit == "pb" else (self.last / start - 1) * 100


def fetch_quotes(watchlist: list[tuple[str, str, str, str]] = WATCHLIST, period: str = "3mo") -> list[Quote]:
    """Télécharge en une seule requête les cours quotidiens de tous les instruments."""
    symbols = [symbol for symbol, *_ in watchlist]
    data = yf.download(symbols, period=period, interval="1d", group_by="ticker", progress=False, auto_adjust=False)

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
