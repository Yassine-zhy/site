"""Filtrer le fil d'actualité : par catégorie, par source et par mot-clé."""

from __future__ import annotations

import unicodedata

from core.models import Article


def normalize(text: str) -> str:
    """Met en minuscules et retire les accents : « Économie » -> « economie »."""
    decomposed = unicodedata.normalize("NFKD", text.lower())  # « é » devient « e » + accent
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def matches_query(article: Article, query: str) -> bool:
    """Vrai si **tous** les mots de la recherche apparaissent dans l'article."""
    haystack = normalize(" ".join([article.title, article.summary, article.source, *article.tickers]))
    return all(word in haystack for word in normalize(query).split())


def filter_articles(
    articles: list[Article],
    categories: list[str] | None = None,
    sources: list[str] | None = None,
    query: str = "",
) -> list[Article]:
    """Garde les articles qui passent tous les filtres (un filtre vide ne filtre rien)."""
    kept = []
    for article in articles:
        if categories and article.category not in categories:
            continue
        if sources and article.source not in sources:
            continue
        if query and not matches_query(article, query):
            continue
        kept.append(article)
    return kept
