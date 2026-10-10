"""Cours de Bourse et indicateurs, via yfinance (données Yahoo Finance, gratuites et sans clé)."""

from __future__ import annotations

from dataclasses import dataclass

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
