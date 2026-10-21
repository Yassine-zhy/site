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


# --- Sujets qui montent et histoire la plus reprise ---------------------------------------------
# Mots trop généraux pour faire un « sujet » (en plus des mots vides du résumé)
_NEWS_WORDS = {
    "says", "said", "stock", "stocks", "market", "markets", "today", "new", "after", "amid", "here", "what", "why",
    "how", "could", "will", "year", "years", "week", "first", "more", "most", "over", "into", "than", "about",
    "just", "best", "buy", "should", "your", "they", "their", "this", "that", "with", "from", "biggest", "moves",
    "selon", "apres", "plus", "pour", "dans", "avec", "sont", "cette", "comme", "fait", "face", "contre", "entre",
    "share", "shares", "price", "prices", "report", "reports", "update", "news", "live", "time", "back", "makes",
    "million", "millions", "billion", "billions", "trillion", "milliards", "one", "two", "three", "four", "five",
    "ten", "deux", "trois", "percent", "points", "rules", "deal", "company", "companies", "group", "inc", "corp",
    "dollar", "dollars", "euros", "now", "next", "big", "top", "need", "know", "look", "high", "low",
    "these", "those", "some", "many", "much", "every", "still", "encore", "tout", "tous", "aussi",
    # les mots de remplissage des titres français (plus nombreux depuis l'étape 38) : « ans » n'est pas un sujet
    "ans", "mois", "jour", "jours", "semaine", "semaines", "annee", "annees", "fois", "chez", "sans", "sous", "vers",
    "leur", "leurs", "mais", "quand", "comment", "pourquoi", "nouveau", "nouvelle", "nouveaux", "nouvelles",
    "milliard", "euro", "plusieurs", "toujours", "deja", "veut", "peut", "doit", "faut", "etre", "avoir", "voici",
}


def title_terms(title: str) -> set[str]:
    """Mots significatifs d'un titre (et paires de mots consécutifs) : « fed », « rate cut », « nvidia »…"""
    from core.summarizer import STOPWORDS  # import local : évite une dépendance circulaire au chargement

    words = [w for w in re.findall(r"[a-z][a-z0-9'&-]+", normalize(title))
             if w not in STOPWORDS and w not in _NEWS_WORDS and len(w) > 2]
    return set(words) | {f"{a} {b}" for a, b in zip(words, words[1:])}


def rising_topics(articles: list[Article], now: datetime | None = None, recent_hours: int = 24,
                  top: int = 8, minimum: int = 3) -> list[tuple[str, int, int]]:
    """Les sujets dont on parle beaucoup plus ces dernières heures qu'avant.

    Pour chaque terme : nombre de dépêches récentes qui le contiennent, comparé à ce qu'on attendrait d'après les
    dépêches plus anciennes (à volume égal). On garde les plus fortes « surprises ».
    Renvoie [(terme, dépêches récentes, dépêches plus anciennes), …].
    """
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=recent_hours)
    recent = [title_terms(a.title) for a in articles if a.published >= cutoff]
    older = [title_terms(a.title) for a in articles if a.published < cutoff]
    if not recent:
        return []
    recent_counts = Counter(term for terms in recent for term in terms)
    older_counts = Counter(term for terms in older for term in terms)
    ratio = len(recent) / max(len(older), 1)

    scored = []
    for term, count in recent_counts.items():
        if count < minimum:
            continue
        surprise = count - older_counts[term] * ratio  # au-delà de ce qu'on attendait
        if surprise > 0:
            scored.append((surprise, term, count, older_counts[term]))
    # Du plus surprenant au moins surprenant ; à égalité, une paire de mots (plus précise) passe avant un mot seul.
    scored.sort(key=lambda item: (item[0], " " in item[1], item[2]), reverse=True)

    # Une paire de mots (« rate cut ») remplace les mots seuls qu'elle contient, pour éviter les doublons.
    chosen: list[tuple[str, int, int]] = []
    for _, term, count, before in scored:
        if any(term in other or other in term for other, _, _ in chosen):
            continue
        chosen.append((term, count, before))
        if len(chosen) == top:
            break
    titles = [a.title for a in articles if a.published >= cutoff]
    return [(original_spelling(term, titles), count, before) for term, count, before in chosen]


def original_spelling(term: str, titles: list[str]) -> str:
    """Retrouve l'écriture la plus fréquente d'un terme dans les titres (« spacex » -> « SpaceX »).

    normalize() ne change pas la longueur d'un texte latin (« é » devient « e ») : la position du terme dans le
    titre normalisé est donc aussi sa position dans le titre d'origine.
    """
    forms: Counter = Counter()
    for title in titles:
        position = normalize(title).find(term)
        if position >= 0:
            forms[title[position:position + len(term)]] += 1
    return forms.most_common(1)[0][0] if forms else term


def most_covered(articles: list[Article]) -> list[tuple[Article, int]]:
    """Classe les articles selon le nombre d'AUTRES sources qui racontent la même histoire.

    Deux titres « racontent la même histoire » s'ils partagent au moins 30 % de leurs mots significatifs
    (indice de Jaccard : taille de l'intersection ÷ taille de l'union).
    """
    terms = [{t for t in title_terms(a.title) if " " not in t} for a in articles]
    ranked = []
    for i, article in enumerate(articles):
        echoes = {
            other.source
            for j, other in enumerate(articles)
            if j != i and other.source != article.source and terms[i] and terms[j]
            and len(terms[i] & terms[j]) / len(terms[i] | terms[j]) >= 0.3
        }
        ranked.append((article, len(echoes)))
    ranked.sort(key=lambda item: (item[1], item[0].published), reverse=True)
    return ranked
