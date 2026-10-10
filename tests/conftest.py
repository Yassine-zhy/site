"""Outils partagés par les tests (« fixtures » pytest)."""

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from core import storage
from core.models import Article

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def db(tmp_path, monkeypatch):
    """Une base SQLite neuve et temporaire pour chaque test : on ne touche jamais à tes vraies données."""
    monkeypatch.setattr(storage, "DB_PATH", tmp_path / "test.db")
    storage.init_db()
    return storage


def make_article(title="Titre", summary="", source="Test", category="marches", url=None, hours_ago=1, **extra):
    """Fabrique un article de test en une ligne."""
    published = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(hours=hours_ago)
    return Article(title=title, url=url or f"https://example.com/{abs(hash(title))}", source=source,
                   published=published, summary=summary, category=category, **extra)
