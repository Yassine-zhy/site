"""Outils partagés par les tests (« fixtures » pytest)."""

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from core import storage
from core.models import Article

FIXTURES = Path(__file__).parent / "fixtures"


# Adresse d'une base PostgreSQL de test (vide = les tests PostgreSQL sont sautés). Exemple :
#   FINVEILLE_TEST_DATABASE_URL=postgresql://finveille:finveille@localhost:5432/finveille_test pytest
TEST_DATABASE_URL = os.environ.get("FINVEILLE_TEST_DATABASE_URL", "")


@pytest.fixture
def db(tmp_path, monkeypatch):
    """Une base SQLite neuve et temporaire pour chaque test : on ne touche jamais à tes vraies données."""
    monkeypatch.setattr(storage, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(storage, "DATABASE_URL", "")
    storage.init_db()
    return storage


def empty_postgres(monkeypatch):
    """Configure la base PostgreSQL de test et la vide (on supprime les tables, init_db les recrée)."""
    monkeypatch.setattr(storage, "DATABASE_URL", TEST_DATABASE_URL)
    monkeypatch.setattr(storage, "_ready", set())
    with storage.connect() as conn:
        for table in storage.ALL_TABLES:
            conn.execute(f"DROP TABLE IF EXISTS {table}")
    storage.init_db()
    return storage


@pytest.fixture(params=["sqlite", "postgres"])
def store(request, tmp_path, monkeypatch):
    """La même base de test, avec SQLite puis avec PostgreSQL : chaque test de stockage s'exécute deux fois."""
    if request.param == "sqlite":
        return request.getfixturevalue("db")
    if not TEST_DATABASE_URL:
        pytest.skip("FINVEILLE_TEST_DATABASE_URL non défini : pas de base PostgreSQL de test")
    return empty_postgres(monkeypatch)


def make_article(title="Titre", summary="", source="Test", category="marches", url=None, hours_ago=1, **extra):
    """Fabrique un article de test en une ligne."""
    published = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(hours=hours_ago)
    return Article(title=title, url=url or f"https://example.com/{abs(hash(title))}", source=source,
                   published=published, summary=summary, category=category, **extra)
