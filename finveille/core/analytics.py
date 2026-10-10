"""Statistiques sur le flux d'actualité : entreprises citées, tonalité, volume par heure."""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timedelta, timezone

from core.config import COMPANIES
from core.filters import normalize
from core.models import Article

_COMPANY_PATTERNS = {
    ticker: re.compile(r"\b(" + "|".join(re.escape(word) for word in words) + r")\b")
    for ticker, (_, _, words) in COMPANIES.items()
}

# Petit lexique de tonalité financière (inspiré du dictionnaire de Loughran et McDonald, 2011),
# en anglais et en français, sans accents. Volontairement simple : voir les limites dans le guide.
_POSITIVE = {
    "gain", "gains", "surge", "surges", "soar", "soars", "rally", "rallies", "rebound", "record", "beat", "beats",
    "growth", "rise", "rises", "jump", "jumps", "climb", "climbs", "upgrade", "profit", "profits", "strong",
    "optimism", "boost", "boosts", "hausse", "rebond", "rebondit", "progresse", "bondit", "grimpe", "benefice",
    "croissance", "succes", "envolee", "solide",
}
_NEGATIVE = {
    "fall", "falls", "drop", "drops", "plunge", "plunges", "slump", "slumps", "loss", "losses", "decline",
    "declines", "miss", "misses", "downgrade", "fear", "fears", "recession", "crash", "layoffs", "warning",
    "risk", "risks", "slide", "slides", "tumble", "tumbles", "weak", "crisis", "baisse", "chute", "recule",
    "perte", "pertes", "crise", "inquietude", "licenciements", "effondrement", "menace", "degringole",
}
_WORD_RE = re.compile(r"[a-z]+")


def detect_companies(article: Article) -> list[str]:
    """Tickers des grandes entreprises citées dans le titre ou le résumé."""
    text = normalize(f"{article.title} {article.summary}")
    return [ticker for ticker, pattern in _COMPANY_PATTERNS.items() if pattern.search(text)]


def lexicon_sentiment(text: str) -> float | None:
    """Tonalité de -1 (négative) à +1 (positive) ; None si aucun mot du lexique n'apparaît."""
    words = _WORD_RE.findall(normalize(text))
    positive = sum(word in _POSITIVE for word in words)
    negative = sum(word in _NEGATIVE for word in words)
    if positive + negative == 0:
        return None
    return (positive - negative) / (positive + negative)


def article_sentiment(article: Article) -> float | None:
    """Le sentiment fourni par l'API s'il existe, sinon celui du lexique."""
    if article.sentiment is not None:
        return article.sentiment
    return lexicon_sentiment(f"{article.title} {article.summary}")


def company_mentions(articles: list[Article]) -> Counter:
    """Nombre d'articles qui citent chaque entreprise connue."""
    counts: Counter = Counter()
    for article in articles:
        counts.update(set(article.tickers) & set(COMPANIES))  # set() : une entreprise compte une fois par article
    return counts


def hourly_volume(articles: list[Article], hours: int = 24, now: datetime | None = None) -> list[dict]:
    """Nombre de dépêches par heure et par catégorie sur les N dernières heures (pour un graphique)."""
    now = (now or datetime.now(timezone.utc)).replace(minute=0, second=0, microsecond=0)
    start = now - timedelta(hours=hours - 1)
    counts = Counter(
        (article.published.replace(minute=0, second=0, microsecond=0), article.category)
        for article in articles
        if start <= article.published < now + timedelta(hours=1)
    )
    categories = sorted({category for _, category in counts} | {article.category for article in articles})
    return [
        {"heure": start + timedelta(hours=h), "categorie": category, "depeches": counts[(start + timedelta(hours=h), category)]}
        for h in range(hours)
        for category in categories
    ]
