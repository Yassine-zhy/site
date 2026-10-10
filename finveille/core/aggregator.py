"""Rassemble les articles de toutes les sources en un seul fil propre."""

from __future__ import annotations

import requests

from core.config import RSS_FEEDS
from core.models import Article
from core.sources import fetch_rss


def deduplicate(articles: list[Article]) -> list[Article]:
    """Supprime les doublons (même URL ou même titre), en gardant la première occurrence."""
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    unique = []
    for article in articles:
        title_key = article.title.lower().strip()
        if article.url in seen_urls or title_key in seen_titles:
            continue
        seen_urls.add(article.url)
        seen_titles.add(title_key)
        unique.append(article)
    return unique


def collect_articles(feeds: list[dict] = RSS_FEEDS) -> tuple[list[Article], list[str]]:
    """Interroge chaque flux et renvoie (articles triés du plus récent au plus ancien, erreurs)."""
    articles: list[Article] = []
    errors: list[str] = []
    for feed in feeds:
        try:
            articles.extend(fetch_rss(feed))
        except requests.RequestException as exc:
            # Une source en panne ne doit pas faire tomber toute l'application.
            errors.append(f"{feed['name']} : {exc}")

    articles = deduplicate(articles)
    articles.sort(key=lambda article: article.published, reverse=True)
    return articles, errors
