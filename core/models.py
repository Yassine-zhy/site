"""La forme d'un article dans FinVeille.

Chaque source (RSS, API…) renvoie ses données dans son propre format. On les convertit
toutes en objets `Article` : le reste de l'application n'a alors qu'un seul format à connaître.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Article:
    """Un article d'actualité, quelle que soit sa provenance."""

    title: str
    url: str
    source: str
    published: datetime  # toujours en heure UTC
    summary: str = ""
    category: str = "marches"
    image: str | None = None
    tickers: list[str] = field(default_factory=list)

    @property
    def id(self) -> str:
        """Identifiant stable calculé à partir de l'URL : même URL = même article."""
        return hashlib.sha1(self.url.encode("utf-8")).hexdigest()[:16]
