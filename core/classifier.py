"""Ranger chaque article dans une catégorie à partir des mots-clés qu'il contient."""

from __future__ import annotations

import re

from core.config import CATEGORY_KEYWORDS
from core.filters import normalize
from core.models import Article

# On compile chaque mot-clé une seule fois, entouré de \b (« frontière de mot ») :
# ainsi « fed » trouve « the Fed » mais pas « FedEx » ni « feeds ».
_PATTERNS = {
    category: [re.compile(rf"\b{re.escape(keyword)}\b") for keyword in keywords]
    for category, keywords in CATEGORY_KEYWORDS.items()
}


def category_scores(text: str) -> dict[str, int]:
    """Nombre de mots-clés de chaque catégorie présents dans le texte."""
    text = normalize(text)
    return {category: sum(1 for p in patterns if p.search(text)) for category, patterns in _PATTERNS.items()}


def classify(article: Article) -> str:
    """Catégorie la plus probable de l'article.

    La catégorie du flux (ex. « crypto » pour CoinDesk) part avec un point d'avance : il faut au
    moins deux indices pour la contredire. Les flux spécialisés restent donc fiables, et les flux
    généralistes sont triés par leur contenu.
    """
    scores = category_scores(f"{article.title} {article.summary}")
    scores[article.category] = scores.get(article.category, 0) + 1
    best = max(scores.values())
    if scores[article.category] == best:
        return article.category  # en cas d'égalité, on garde la catégorie du flux
    return max(scores, key=scores.get)
