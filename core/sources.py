"""Récupération des articles depuis les différentes sources."""

from __future__ import annotations

import html
import re
import textwrap
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import feedparser
import requests

from core.config import (
    ALPHAVANTAGE_TOPICS,
    FINNHUB_CATEGORIES,
    MAX_ARTICLES_PER_FEED,
    REQUEST_TIMEOUT,
    USER_AGENT,
)
from core.models import Article


class SourceError(Exception):
    """Une API a répondu, mais avec un message d'erreur (clé invalide, quota dépassé…)."""

_BLOCK_RE = re.compile(r"<(script|style)\b.*?</\1>", re.IGNORECASE | re.DOTALL)  # <style>…</style>
_CSS_RE = re.compile(r"@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}")  # règle CSS « @media … { … } »
_TAG_RE = re.compile(r"<[^>]+>")  # une balise HTML : <p>, </a>, <img src="…">…
_SPACES_RE = re.compile(r"\s+")  # une suite d'espaces, tabulations ou retours à la ligne
_CREDIT_RE = re.compile(r"^Image source:.*$", re.IGNORECASE)  # crédit photo seul, sans contenu (Nasdaq)
_HEADING_RE = re.compile(r"^Key Points\s*")  # intertitre collé au texte : « Key PointsForecasting… » (Nasdaq)


def clean_html(text: str | None) -> str:
    """Transforme un fragment HTML en texte brut lisible."""
    text = _BLOCK_RE.sub(" ", text or "")  # enlève les blocs de code CSS/JavaScript ET leur contenu
    text = _TAG_RE.sub(" ", text)  # enlève les autres balises (leur texte reste)
    text = html.unescape(text)  # &amp; -> &, &eacute; -> é…
    text = _CSS_RE.sub(" ", text)  # du CSS « nu » glissé par erreur dans certains flux (ex. Nasdaq)
    text = _SPACES_RE.sub(" ", text).strip()
    return _HEADING_RE.sub("", _CREDIT_RE.sub("", text))


def shorten(text: str, width: int = 400) -> str:
    """Coupe un texte trop long à la fin d'un mot, avec « … »."""
    return textwrap.shorten(text, width=width, placeholder=" …")


def _entry_date(entry) -> datetime:
    """Date de publication d'une entrée RSS, en UTC (maintenant si le flux n'en donne pas)."""
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if parsed:
        return datetime(*parsed[:6], tzinfo=timezone.utc)
    return datetime.now(timezone.utc)


def _entry_image(entry) -> str | None:
    """URL de l'image d'illustration, si le flux en fournit une."""
    for key in ("media_content", "media_thumbnail"):
        for media in entry.get(key) or []:
            if media.get("url"):
                return media["url"]
    for link in entry.get("links", []):
        if link.get("rel") == "enclosure" and link.get("type", "").startswith("image"):
            return link.get("href")
    return None


def fetch_rss(feed: dict) -> list[Article]:
    """Télécharge un flux RSS et le convertit en liste d'`Article`.

    Lève `requests.RequestException` si le site ne répond pas : c'est l'appelant qui décide
    quoi faire de l'erreur.
    """
    response = requests.get(feed["url"], headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()  # erreur si le serveur répond 403, 404, 500…
    parsed = feedparser.parse(response.content)

    articles = []
    for entry in parsed.entries:
        title = clean_html(entry.get("title"))
        url = entry.get("link", "")
        if not title or not url:
            continue  # entrée incomplète : on l'ignore
        articles.append(
            Article(
                title=title,
                url=url,
                source=feed["name"],
                published=_entry_date(entry),
                summary=shorten(clean_html(entry.get("summary"))),
                category=feed["category"],
                image=_entry_image(entry),
            )
        )

    articles.sort(key=lambda article: article.published, reverse=True)
    return articles[:MAX_ARTICLES_PER_FEED]


def fetch_yahoo_ticker_news(ticker: str) -> list[Article]:
    """Actualités d'une entreprise via le flux RSS de Yahoo Finance (gratuit, sans clé, toutes Bourses)."""
    feed = {
        "name": "Yahoo Finance",
        "url": f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US",
        "category": "entreprises",
    }
    articles = fetch_rss(feed)
    for article in articles:
        article.tickers = [ticker]
    return articles


# --- API d'actualités ------------------------------------------------------------------------
# Chaque fonction interroge une API et convertit sa réponse JSON en liste d'`Article`.


def describe_error(exc: Exception) -> str:
    """Message d'erreur lisible et SANS l'URL (qui peut contenir une clé API secrète)."""
    if isinstance(exc, SourceError):
        return shorten(str(exc), 160)
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        return {401: "clé API refusée (401)", 403: "accès interdit (403)", 429: "quota dépassé (429)"}.get(
            exc.response.status_code, f"erreur HTTP {exc.response.status_code}"
        )
    if isinstance(exc, requests.Timeout):
        return "le serveur met trop de temps à répondre"
    if isinstance(exc, requests.ConnectionError):
        return "connexion impossible"
    return type(exc).__name__


def _get_json(url: str, params: dict | None = None, headers: dict | None = None):
    """GET + décodage JSON, avec délai maximum et vérification du code HTTP."""
    response = requests.get(
        url, params=params, headers={"User-Agent": USER_AGENT, **(headers or {})}, timeout=REQUEST_TIMEOUT
    )
    response.raise_for_status()
    return response.json()


def fetch_finnhub_news(api_key: str, category: str = "general") -> list[Article]:
    """Actualités générales Finnhub (catégories : general, merger, forex, crypto). 60 requêtes/min."""
    items = _get_json(
        "https://finnhub.io/api/v1/news",
        params={"category": category},
        headers={"X-Finnhub-Token": api_key},  # clé dans l'en-tête plutôt que dans l'URL
    )
    if isinstance(items, dict):  # en cas d'erreur, Finnhub renvoie {"error": "..."} au lieu d'une liste
        raise SourceError(items.get("error", "réponse inattendue"))
    return [_finnhub_article(item, FINNHUB_CATEGORIES.get(category, "marches")) for item in items if item.get("url")]


def fetch_finnhub_company_news(api_key: str, ticker: str, days: int = 7) -> list[Article]:
    """Actualités d'une entreprise cotée (ticker américain : AAPL, MSFT…) sur les N derniers jours."""
    today = datetime.now(timezone.utc).date()
    items = _get_json(
        "https://finnhub.io/api/v1/company-news",
        params={"symbol": ticker, "from": str(today.fromordinal(today.toordinal() - days)), "to": str(today)},
        headers={"X-Finnhub-Token": api_key},
    )
    if isinstance(items, dict):
        raise SourceError(items.get("error", "réponse inattendue"))
    return [_finnhub_article(item, "entreprises") for item in items if item.get("url")]


def _finnhub_article(item: dict, category: str) -> Article:
    return Article(
        title=clean_html(item.get("headline")),
        url=item["url"],
        source=item.get("source") or "Finnhub",
        published=datetime.fromtimestamp(item.get("datetime", 0), tz=timezone.utc),  # secondes Unix
        summary=shorten(clean_html(item.get("summary"))),
        category=category,
        image=item.get("image") or None,
        tickers=[t for t in (item.get("related") or "").split(",") if t],
    )


def fetch_newsapi_headlines(api_key: str, query: str | None = None) -> list[Article]:
    """Gros titres « business » de NewsAPI, ou recherche par mot-clé si `query` est donné. 100 requêtes/jour."""
    if query:
        url, params = "https://newsapi.org/v2/everything", {"q": query, "sortBy": "publishedAt", "pageSize": 30}
    else:
        url, params = "https://newsapi.org/v2/top-headlines", {"category": "business", "language": "en", "pageSize": 50}
    data = _get_json(url, params=params, headers={"X-Api-Key": api_key})
    if data.get("status") != "ok":
        raise SourceError(data.get("message", "réponse inattendue"))

    articles = []
    for item in data.get("articles", []):
        title = clean_html(item.get("title"))
        if not item.get("url") or not title or title == "[Removed]":  # articles retirés par l'éditeur
            continue
        articles.append(
            Article(
                title=title,
                url=item["url"],
                source=(item.get("source") or {}).get("name") or "NewsAPI",
                published=datetime.fromisoformat(item["publishedAt"]),  # format ISO : "2026-10-09T14:00:00Z"
                summary=shorten(clean_html(item.get("description"))),
                category="entreprises",
                image=item.get("urlToImage") or None,
            )
        )
    return articles


def fetch_marketaux_news(api_key: str) -> list[Article]:
    """Actualités Marketaux, avec les entreprises citées et leur sentiment. 100 requêtes/jour, 3 articles/requête."""
    data = _get_json(
        "https://api.marketaux.com/v1/news/all",
        params={"api_token": api_key, "language": "en,fr", "filter_entities": "true", "limit": 3},
    )
    if "error" in data:
        raise SourceError(data["error"].get("message", "réponse inattendue"))

    articles = []
    for item in data.get("data", []):
        entities = item.get("entities") or []
        scores = [e["sentiment_score"] for e in entities if e.get("sentiment_score") is not None]
        articles.append(
            Article(
                title=clean_html(item.get("title")),
                url=item["url"],
                source=item.get("source") or "Marketaux",
                published=datetime.fromisoformat(item["published_at"]),
                summary=shorten(clean_html(item.get("description") or item.get("snippet"))),
                category="entreprises",
                image=item.get("image_url") or None,
                tickers=[e["symbol"] for e in entities if e.get("symbol")],
                sentiment=sum(scores) / len(scores) if scores else None,
            )
        )
    return articles


_NEW_YORK = ZoneInfo("America/New_York")


def fetch_alphavantage_news(api_key: str) -> list[Article]:
    """Actualités Alpha Vantage avec score de sentiment. 25 requêtes/jour seulement."""
    data = _get_json(
        "https://www.alphavantage.co/query",
        params={"function": "NEWS_SENTIMENT", "sort": "LATEST", "limit": 50, "apikey": api_key},
    )
    # Piège : en cas de quota dépassé, Alpha Vantage répond « 200 OK » avec un simple message.
    if "feed" not in data:
        raise SourceError(data.get("Information") or data.get("Note") or data.get("Error Message") or "réponse inattendue")

    articles = []
    for item in data["feed"]:
        topics = [t["topic"] for t in item.get("topics", [])]  # ex. ["earnings", "technology"]
        category = next((ALPHAVANTAGE_TOPICS[t] for t in topics if t in ALPHAVANTAGE_TOPICS), "marches")
        # Date au format "20261009T231231". Hypothèse : heure de New York, comme les autres données du service.
        published = datetime.strptime(item["time_published"], "%Y%m%dT%H%M%S").replace(tzinfo=_NEW_YORK)
        articles.append(
            Article(
                title=clean_html(item.get("title")),
                url=item["url"],
                source=item.get("source") or "Alpha Vantage",
                published=published.astimezone(timezone.utc),
                summary=shorten(clean_html(item.get("summary"))),
                category=category,
                image=item.get("banner_image") or None,
                tickers=[t["ticker"] for t in item.get("ticker_sentiment", []) if t.get("ticker")],
                sentiment=item.get("overall_sentiment_score"),
            )
        )
    return articles
