"""Rassemble les articles de toutes les sources en un seul fil propre."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Callable

import requests

from core.analytics import detect_companies
from core.classifier import classify
from core.config import FINNHUB_CATEGORIES, RSS_FEEDS
from core.models import Article
from core.sources import (
    SourceError,
    describe_error,
    fetch_alphavantage_news,
    fetch_finnhub_news,
    fetch_marketaux_news,
    fetch_finnhub_company_news,
    fetch_newsapi_headlines,
    fetch_rss,
    fetch_yahoo_ticker_news,
)
from core.filters import matches_query

WORKERS = 12  # requêtes en parallèle (une quarantaine de flux)

# Une « tâche » = (nom affiché, fonction à appeler, arguments de la fonction)
Task = tuple[str, Callable[..., list[Article]], tuple]


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


def build_tasks(keys: dict[str, str | None]) -> list[Task]:
    """La liste des sources à interroger : tous les flux RSS, plus chaque API dont on a la clé."""
    tasks: list[Task] = [(feed["name"], fetch_rss, (feed,)) for feed in RSS_FEEDS]
    if key := keys.get("FINNHUB_API_KEY"):
        tasks += [(f"Finnhub · {category}", fetch_finnhub_news, (key, category)) for category in FINNHUB_CATEGORIES]
    if key := keys.get("NEWSAPI_API_KEY"):
        tasks.append(("NewsAPI", fetch_newsapi_headlines, (key,)))
    if key := keys.get("MARKETAUX_API_KEY"):
        tasks.append(("Marketaux", fetch_marketaux_news, (key,)))
    if key := keys.get("ALPHAVANTAGE_API_KEY"):
        tasks.append(("Alpha Vantage", fetch_alphavantage_news, (key,)))
    return tasks


def _run(task: Task) -> tuple[list[Article], str | None]:
    """Exécute une tâche et renvoie (articles, message d'erreur ou None)."""
    name, function, args = task
    try:
        return function(*args), None
    except Exception as exc:
        # Une source en panne ne doit pas faire tomber toute l'application : un flux mal formé ne doit pas
        # faire tomber les autres (réseau, SourceError, JSON invalide, erreur d'analyse…).
        return [], f"{name} : {describe_error(exc)}"


def run_tasks(tasks: list[Task]) -> tuple[list[Article], list[str]]:
    """Lance toutes les tâches **en parallèle**, puis classe, dédoublonne et trie les articles."""
    # Chaque requête passe l'essentiel de son temps à attendre le réseau : en lancer 12 à la fois
    # divise le temps total par ~12, sans effort pour le processeur.
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(_run, tasks))

    articles = [article for found, _ in results for article in found]
    errors = [error for _, error in results if error]

    for article in articles:
        article.category = classify(article)
        # Ajoute les grandes entreprises reconnues dans le texte aux tickers fournis par la source
        article.tickers = list(dict.fromkeys(article.tickers + detect_companies(article)))

    articles = deduplicate(articles)
    articles.sort(key=lambda article: article.published, reverse=True)
    return articles, errors


def collect_articles(keys: dict[str, str | None] | None = None) -> tuple[list[Article], list[str]]:
    """Interroge toutes les sources disponibles et renvoie (articles du plus récent au plus ancien, erreurs)."""
    return run_tasks(build_tasks(keys or {}))


def collect_followed(
    follows: list[dict], keys: dict[str, str | None], base: list[Article]
) -> tuple[dict[tuple[str, str], list[Article]], list[str]]:
    """Le fil dédié de chaque suivi : {(kind, value): articles}, plus les erreurs.

    - entreprise : flux Yahoo de l'entreprise, Finnhub si la clé existe (actions américaines seulement
      en offre gratuite), et les articles du fil principal qui la citent ;
    - thème : articles du fil principal qui contiennent le mot-clé, et recherche NewsAPI si la clé existe.
    """
    tasks: list[Task] = []
    owners: list[tuple[str, str]] = []  # owners[i] = le suivi auquel appartient tasks[i]
    for follow in follows:
        owner = (follow["kind"], follow["value"])
        if follow["kind"] == "company":
            tasks.append((f"Yahoo · {follow['label']}", fetch_yahoo_ticker_news, (follow["value"],)))
            owners.append(owner)
            if (key := keys.get("FINNHUB_API_KEY")) and "." not in follow["value"]:
                tasks.append((f"Finnhub · {follow['label']}", fetch_finnhub_company_news, (key, follow["value"])))
                owners.append(owner)
        elif key := keys.get("NEWSAPI_API_KEY"):
            tasks.append((f"NewsAPI · {follow['label']}", fetch_newsapi_headlines, (key, follow["value"])))
            owners.append(owner)

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(_run, tasks))

    feeds: dict[tuple[str, str], list[Article]] = {(f["kind"], f["value"]): [] for f in follows}
    errors = []
    for owner, (found, error) in zip(owners, results):
        feeds[owner].extend(found)
        if error:
            errors.append(error)

    for follow in follows:
        owner = (follow["kind"], follow["value"])
        if follow["kind"] == "company":
            symbol = follow["value"]
            mentioned = [a for a in base if symbol in a.tickers or matches_query(a, follow["label"])]
        else:
            mentioned = [a for a in base if matches_query(a, follow["value"])]
        found = feeds[owner] + mentioned
        for article in found:
            article.category = classify(article)
        found = deduplicate(found)
        found.sort(key=lambda article: article.published, reverse=True)
        feeds[owner] = found
    return feeds, errors


def filter_region(articles: list[Article], region: str | None) -> list[Article]:
    """Garde les articles d'une région (« fr », « ca », « monde ») ; None ou « tout » : tous."""
    if not region or region == "tout":
        return articles
    return [article for article in articles if article.region == region]


def prefer_french(ranked: list[tuple[Article, int]]) -> tuple[Article, int]:
    """Parmi les histoires à égalité de reprises en tête du classement, préfère une histoire française."""
    top = ranked[0][1]
    return next((item for item in ranked if item[1] == top and item[0].region == "fr"), ranked[0])
