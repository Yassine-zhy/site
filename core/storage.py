"""Stockage persistant dans une base SQLite : favoris, articles lus ou masqués, suivis.

SQLite est une base de données complète contenue dans un seul fichier (data/finveille.db).
Elle est fournie avec Python : rien à installer.
"""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from core.models import Article

# Emplacement du fichier de base. La variable d'environnement FINVEILLE_DB permet d'en
# utiliser un autre (pratique pour les tests).
DB_PATH = Path(os.environ.get("FINVEILLE_DB", Path(__file__).resolve().parent.parent / "data" / "finveille.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS article_status (
    article_id   TEXT PRIMARY KEY,           -- Article.id
    is_favorite  INTEGER NOT NULL DEFAULT 0, -- 0 = non, 1 = oui (SQLite n'a pas de vrai booléen)
    is_read      INTEGER NOT NULL DEFAULT 0,
    is_hidden    INTEGER NOT NULL DEFAULT 0,
    article_json TEXT NOT NULL,              -- l'article complet, pour retrouver un favori disparu du flux
    updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS follows (
    kind       TEXT NOT NULL CHECK (kind IN ('company', 'theme')),
    value      TEXT NOT NULL,                -- symbole Yahoo (« MC.PA ») ou mot-clé (« inflation »)
    label      TEXT NOT NULL,                -- nom affiché (« LVMH »)
    created_at TEXT NOT NULL,
    PRIMARY KEY (kind, value)                -- on ne peut pas suivre deux fois la même chose
);
"""

FLAGS = ("is_favorite", "is_read", "is_hidden")


@contextmanager
def connect():
    """Ouvre la base, valide les modifications à la fin du bloc `with`, puis ferme toujours la connexion."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # accès aux colonnes par leur nom : row["is_read"]
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Crée les tables si elles n'existent pas encore (sans effet sinon)."""
    with connect() as conn:
        conn.executescript(SCHEMA)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def set_flag(article: Article, flag: str, value: bool) -> None:
    """Active ou désactive un indicateur (favori, lu, masqué) pour un article."""
    if flag not in FLAGS:
        raise ValueError(f"Indicateur inconnu : {flag}")
    # « UPSERT » : on insère la ligne, ou on la met à jour si l'article existe déjà.
    # Les ? sont des paramètres : SQLite y insère les valeurs de façon sûre.
    # Le nom de colonne {flag}, lui, ne peut pas être un paramètre ; il est sûr car vérifié juste au-dessus.
    with connect() as conn:
        conn.execute(
            f"""
            INSERT INTO article_status (article_id, {flag}, article_json, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(article_id) DO UPDATE SET {flag} = excluded.{flag}, updated_at = excluded.updated_at
            """,
            (article.id, int(value), json.dumps(article.to_dict()), _now()),
        )


def get_statuses() -> dict[str, dict[str, bool]]:
    """Tous les indicateurs, rangés par identifiant d'article : {id: {"is_favorite": True, …}}."""
    with connect() as conn:
        rows = conn.execute("SELECT article_id, is_favorite, is_read, is_hidden FROM article_status").fetchall()
    return {row["article_id"]: {flag: bool(row[flag]) for flag in FLAGS} for row in rows}


def list_favorites() -> list[Article]:
    """Les articles mis en favori, du plus récemment modifié au plus ancien."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT article_json FROM article_status WHERE is_favorite = 1 ORDER BY updated_at DESC"
        ).fetchall()
    return [Article.from_dict(json.loads(row["article_json"])) for row in rows]


def add_follow(kind: str, value: str, label: str) -> None:
    """Suit une entreprise (kind="company", value=symbole) ou un thème (kind="theme", value=mot-clé)."""
    with connect() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO follows (kind, value, label, created_at) VALUES (?, ?, ?, ?)",
            (kind, value.strip(), label.strip(), _now()),
        )


def remove_follow(kind: str, value: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM follows WHERE kind = ? AND value = ?", (kind, value))


def list_follows(kind: str | None = None) -> list[dict]:
    """Les suivis, du plus ancien au plus récent : [{"kind": …, "value": …, "label": …}, …]."""
    query = "SELECT kind, value, label FROM follows"
    params: tuple = ()
    if kind:
        query += " WHERE kind = ?"
        params = (kind,)
    with connect() as conn:
        rows = conn.execute(query + " ORDER BY created_at", params).fetchall()
    return [dict(row) for row in rows]
