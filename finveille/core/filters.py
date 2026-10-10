"""Filtrer le fil d'actualité : par catégorie, par source et par mot-clé (recherche avancée)."""

from __future__ import annotations

import shlex
import unicodedata
from dataclasses import dataclass, field

from core.models import Article


def normalize(text: str) -> str:
    """Met en minuscules et retire les accents : « Économie » -> « economie »."""
    decomposed = unicodedata.normalize("NFKD", text.lower())  # « é » devient « e » + accent
    return "".join(char for char in decomposed if not unicodedata.combining(char))


@dataclass
class Query:
    """Une recherche découpée en morceaux.

    Syntaxe acceptée (comme sur les moteurs de recherche) :
    - `inflation bce`        → les deux mots doivent apparaître ;
    - `"banque centrale"`    → l'expression exacte ;
    - `-crypto`              → exclut les articles qui contiennent ce mot ;
    - `source:cnbc`          → seulement les sources dont le nom contient « cnbc ».
    """

    terms: list[str] = field(default_factory=list)
    excluded: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)


def parse_query(text: str) -> Query:
    """Transforme le texte tapé dans la barre de recherche en `Query`."""
    text = text.replace("«", '"').replace("»", '"').replace("“", '"').replace("”", '"')
    lexer = shlex.shlex(text, posix=True)
    lexer.quotes = '"'  # seuls les guillemets droits délimitent une expression (pas l'apostrophe de « l'or »)
    lexer.whitespace_split = True
    lexer.commenters = ""
    try:
        parts = list(lexer)
    except ValueError:  # guillemet non refermé : on découpe simplement sur les espaces
        parts = text.replace('"', " ").split()

    query = Query()
    for part in parts:
        if part.startswith("-") and len(part) > 1:
            query.excluded.append(normalize(part[1:]))
        elif part.lower().startswith("source:") and len(part) > 7:
            query.sources.append(normalize(part[7:]))
        elif part.strip():
            query.terms.append(normalize(part))
    return query


def matches_query(article: Article, query: str | Query) -> bool:
    """Vrai si l'article respecte la recherche (tous les termes, aucun mot exclu, bonne source)."""
    q = parse_query(query) if isinstance(query, str) else query
    haystack = normalize(" ".join([article.title, article.summary, article.source, *article.tickers]))
    if any(term not in haystack for term in q.terms):
        return False
    if any(word in haystack for word in q.excluded):
        return False
    return not q.sources or any(source in normalize(article.source) for source in q.sources)


def filter_articles(
    articles: list[Article],
    categories: list[str] | None = None,
    sources: list[str] | None = None,
    query: str = "",
) -> list[Article]:
    """Garde les articles qui passent tous les filtres (un filtre vide ne filtre rien)."""
    parsed = parse_query(query) if query else None  # on analyse la recherche une seule fois
    kept = []
    for article in articles:
        if categories and article.category not in categories:
            continue
        if sources and article.source not in sources:
            continue
        if parsed and not matches_query(article, parsed):
            continue
        kept.append(article)
    return kept
