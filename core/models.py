"""La forme d'un article dans FinVeille.

Chaque source (RSS, API…) renvoie ses données dans son propre format. On les convertit
toutes en objets `Article` : le reste de l'application n'a alors qu'un seul format à connaître.
"""

from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass, field
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

    def to_dict(self) -> dict:
        """Version « dictionnaire » de l'article, prête à être enregistrée en JSON."""
        data = asdict(self)
        data["published"] = self.published.isoformat()  # une date n'est pas du JSON : on la met en texte
        return data

    @classmethod
    def from_dict(cls, data: dict) -> Article:
        """Reconstruit un `Article` à partir de `to_dict()`."""
        data = dict(data)
        data["published"] = datetime.fromisoformat(data["published"])
        return cls(**data)
