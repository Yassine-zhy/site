"""Stockage persistant : données personnelles de chaque utilisateur et cache partagé.

Deux bases possibles, avec les mêmes requêtes SQL :
- **SQLite** (par défaut) : une base complète dans un seul fichier, data/finveille.db, fournie avec Python ;
- **PostgreSQL** (en ligne) : une base hébergée gratuite (Supabase, Neon…), indiquée par DATABASE_URL dans les
  secrets. Indispensable sur un hébergement gratuit, dont le disque est effacé à chaque redémarrage.

Chaque donnée personnelle (favoris, suivis, portefeuille, alertes, notes, préférences) porte une
colonne `user_id`, et chaque fonction reçoit l'utilisateur **en paramètre**. On n'utilise jamais de
variable globale « utilisateur courant » : un serveur Streamlit sert plusieurs visiteurs en même
temps, et une variable globale serait partagée entre eux.
"""

from __future__ import annotations

import atexit
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from core.models import Article

# Emplacement du fichier SQLite. La variable d'environnement FINVEILLE_DB permet d'en utiliser un autre.
DB_PATH = Path(os.environ.get("FINVEILLE_DB", Path(__file__).resolve().parent.parent / "data" / "finveille.db"))
# Adresse d'une base PostgreSQL (« postgresql://… ») ; vide = SQLite. Réglée par configure() au démarrage.
DATABASE_URL = os.environ.get("FINVEILLE_DATABASE_URL", "")

LOCAL_USER = "local"  # l'utilisateur unique quand les comptes ne sont pas configurés
SCHEMA_VERSION = 1  # 0 = étapes 3 à 13 (un seul utilisateur), 1 = comptes utilisateurs

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    user_id    TEXT PRIMARY KEY,             -- e-mail vérifié, ou identifiant fourni par le service de connexion
    email      TEXT,
    name       TEXT,
    created_at TEXT NOT NULL,
    last_seen  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS article_status (
    user_id      TEXT NOT NULL,
    article_id   TEXT NOT NULL,              -- Article.id
    is_favorite  INTEGER NOT NULL DEFAULT 0, -- 0 = non, 1 = oui (SQLite n'a pas de vrai booléen)
    is_read      INTEGER NOT NULL DEFAULT 0,
    is_hidden    INTEGER NOT NULL DEFAULT 0,
    article_json TEXT NOT NULL,              -- l'article complet, pour retrouver un favori disparu du flux
    updated_at   TEXT NOT NULL,
    PRIMARY KEY (user_id, article_id)        -- un statut par article ET par utilisateur
);

CREATE TABLE IF NOT EXISTS follows (
    user_id    TEXT NOT NULL,
    kind       TEXT NOT NULL CHECK (kind IN ('company', 'theme')),
    value      TEXT NOT NULL,                -- symbole Yahoo (« MC.PA ») ou mot-clé (« inflation »)
    label      TEXT NOT NULL,                -- nom affiché (« LVMH »)
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, kind, value)       -- on ne peut pas suivre deux fois la même chose
);

CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT NOT NULL,
    key     TEXT NOT NULL,                   -- nom de la préférence
    value   TEXT NOT NULL,                   -- sa valeur, en JSON (texte, nombre, liste…)
    PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS notes (
    user_id    TEXT NOT NULL,
    article_id TEXT NOT NULL,                -- une note personnelle par article
    text       TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, article_id)
);

CREATE TABLE IF NOT EXISTS positions (
    id        {auto_id},                         -- numéro attribué automatiquement par la base
    user_id   TEXT NOT NULL,
    symbol    TEXT NOT NULL,
    label     TEXT NOT NULL,
    quantity  DOUBLE PRECISION NOT NULL CHECK (quantity > 0),
    price     DOUBLE PRECISION NOT NULL CHECK (price > 0),  -- prix d'achat unitaire, dans la devise de cotation
    currency  TEXT NOT NULL,
    bought_on TEXT NOT NULL                      -- date d'achat, format AAAA-MM-JJ
);

CREATE TABLE IF NOT EXISTS alerts (
    id         {auto_id},
    user_id    TEXT NOT NULL,
    symbol     TEXT NOT NULL,
    label      TEXT NOT NULL,
    kind       TEXT NOT NULL CHECK (kind IN ('above', 'below', 'move')),
    threshold  DOUBLE PRECISION NOT NULL CHECK (threshold > 0),
    created_at TEXT NOT NULL
);

-- Partagé par tous : un résumé d'article est le même pour tout le monde (on ne le calcule qu'une fois).
CREATE TABLE IF NOT EXISTS summaries (
    article_id   TEXT PRIMARY KEY,
    summary_json TEXT NOT NULL,
    created_at   TEXT NOT NULL
);

-- Comptes « e-mail + mot de passe » gérés par FinVeille (étape 22). Le mot de passe n'est JAMAIS stocké :
-- seulement son empreinte, calculée avec scrypt (voir core/accounts.py).
CREATE TABLE IF NOT EXISTS credentials (
    email         TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    verified      INTEGER NOT NULL DEFAULT 0,   -- adresse confirmée par un code envoyé par e-mail
    failed_logins INTEGER NOT NULL DEFAULT 0,   -- échecs de connexion consécutifs (anti « force brute »)
    locked_until  TEXT,                          -- connexion bloquée jusqu'à cette date après trop d'échecs
    created_at    TEXT NOT NULL
);

-- Sessions : « rester connecté » 30 jours. On garde l'empreinte du jeton, pas le jeton lui-même.
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Codes à 6 chiffres envoyés par e-mail (confirmer l'adresse, réinitialiser le mot de passe)
CREATE TABLE IF NOT EXISTS email_codes (
    email      TEXT NOT NULL,
    purpose    TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
    code_hash  TEXT NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    PRIMARY KEY (email, purpose)
);
"""

FLAGS = ("is_favorite", "is_read", "is_hidden")
PERSONAL_TABLES = ("article_status", "follows", "settings", "notes", "positions", "alerts")
ALL_TABLES = (*PERSONAL_TABLES, "users", "summaries", "credentials", "sessions", "email_codes")


AUTO_ID = {
    "sqlite": "INTEGER PRIMARY KEY AUTOINCREMENT",
    "postgres": "BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY",
}
_ready: set[str] = set()  # bases déjà initialisées par ce processus (init_db ne travaille qu'une fois)
_pools: dict = {}  # une réserve de connexions PostgreSQL par adresse, partagée par tous les visiteurs


def configure(database_url: str | None) -> None:
    """Choisit la base : PostgreSQL si une adresse est donnée, sinon SQLite. À appeler au démarrage (app.py)."""
    global DATABASE_URL
    DATABASE_URL = (database_url or "").strip()


def backend() -> str:
    return "postgres" if DATABASE_URL else "sqlite"


class _PostgresConnection:
    """Donne à une connexion PostgreSQL (psycopg) la même interface que sqlite3 pour nos requêtes.

    Seule différence à gérer : SQLite note les paramètres « ? », psycopg « %s ».
    """

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql: str, params: tuple = ()):
        return self._conn.execute(sql.replace("?", "%s"), params)

    def executescript(self, script: str) -> None:
        for statement in script.split(";"):
            if statement.strip():
                self._conn.execute(statement)


def _postgres_pool():
    """La réserve de connexions : ouvrir une connexion à un serveur distant prend du temps, on les réutilise."""
    if DATABASE_URL not in _pools:
        from psycopg.rows import dict_row  # importés seulement si PostgreSQL est utilisé
        from psycopg_pool import ConnectionPool

        _pools[DATABASE_URL] = ConnectionPool(
            DATABASE_URL, min_size=1, max_size=4, open=True, timeout=15,
            # dict_row : les lignes sont des dictionnaires (row["is_read"]) ;
            # prepare_threshold=None : compatible avec les « poolers » de Supabase (PgBouncer)
            kwargs={"row_factory": dict_row, "prepare_threshold": None},
        )
        atexit.register(_pools[DATABASE_URL].close)  # ferme proprement les connexions quand le programme s'arrête
    return _pools[DATABASE_URL]


@contextmanager
def connect():
    """Ouvre la base, valide les modifications à la fin du bloc `with` (annule en cas d'erreur), puis libère la
    connexion."""
    if backend() == "postgres":
        with _postgres_pool().connection() as conn:  # valide à la sortie, annule si une exception survient
            yield _PostgresConnection(conn)
        return
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)  # attend jusqu'à 10 s si un autre visiteur écrit au même moment
    conn.row_factory = sqlite3.Row  # accès aux colonnes par leur nom : row["is_read"]
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [row["name"] for row in conn.execute(f"PRAGMA table_info({table})")]


def init_db() -> None:
    """Crée les tables manquantes, et met à jour une base SQLite créée par une version précédente (migration).

    `PRAGMA user_version` est un petit nombre que SQLite garde dans le fichier : on s'en sert pour savoir
    quelle version du schéma la base utilise. Une base PostgreSQL, elle, est toujours créée au dernier schéma.
    """
    target = DATABASE_URL or str(DB_PATH)
    if target in _ready:  # app.py appelle init_db à chaque affichage : on ne refait pas le travail
        return
    schema = SCHEMA.format(auto_id=AUTO_ID[backend()])
    with connect() as conn:
        if backend() == "postgres":
            conn.executescript(schema)
            _ready.add(target)
            return
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        legacy = []
        if version < 1:
            # Version 0 : les tables personnelles n'avaient pas de colonne user_id. On les met de côté…
            for table in PERSONAL_TABLES:
                exists = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
                if exists and "user_id" not in _columns(conn, table):
                    conn.execute(f"ALTER TABLE {table} RENAME TO {table}_v0")
                    legacy.append(table)
        conn.executescript(schema)  # … on crée les nouvelles tables…
        for table in legacy:  # … puis on recopie les anciennes données, attribuées à l'utilisateur « local »
            old = [c for c in _columns(conn, f"{table}_v0") if c in _columns(conn, table)]
            names = ", ".join(old)
            conn.execute(
                f"INSERT INTO {table} (user_id, {names}) SELECT ?, {names} FROM {table}_v0", (LOCAL_USER,)
            )
            conn.execute(f"DROP TABLE {table}_v0")
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
    _ready.add(target)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- Utilisateurs ------------------------------------------------------------------------------


def touch_user(user: str, email: str | None, name: str | None) -> None:
    """Enregistre un utilisateur à sa première visite, puis met à jour sa date de dernière visite."""
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO users (user_id, email, name, created_at, last_seen) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, name = excluded.name,
                                               last_seen = excluded.last_seen
            """,
            (user, email, name, _now(), _now()),
        )


def get_user(user: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE user_id = ?", (user,)).fetchone()
    return dict(row) if row else None


def users_with_setting(key: str, value=True) -> list[dict]:
    """Les comptes qui ont choisi un réglage (ex. recevoir le brief par e-mail) : [{"user_id", "email", "name"}]."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT u.user_id, u.email, u.name FROM users u JOIN settings s ON s.user_id = u.user_id "
            "WHERE s.key = ? AND s.value = ? ORDER BY u.user_id",
            (key, json.dumps(value)),
        ).fetchall()
    return [dict(row) for row in rows]


def export_user_data(user: str) -> dict:
    """Toutes les données d'un utilisateur (droit d'accès et de portabilité du RGPD)."""
    data = {"user": get_user(user)}
    with connect() as conn:
        for table in PERSONAL_TABLES:
            rows = conn.execute(f"SELECT * FROM {table} WHERE user_id = ?", (user,)).fetchall()
            data[table] = [dict(row) for row in rows]
    return data


def delete_user_data(user: str) -> None:
    """Efface toutes les données d'un utilisateur (droit à l'effacement du RGPD), y compris son mot de passe."""
    profile = get_user(user)
    with connect() as conn:
        for table in (*PERSONAL_TABLES, "sessions", "users"):
            conn.execute(f"DELETE FROM {table} WHERE user_id = ?", (user,))
        if user.startswith("mail:") and profile and profile.get("email"):  # compte e-mail + mot de passe
            for table in ("credentials", "email_codes"):
                conn.execute(f"DELETE FROM {table} WHERE email = ?", (profile["email"],))


# --- Comptes e-mail + mot de passe (la logique est dans core/accounts.py) -----------------------------


def get_credentials(email: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM credentials WHERE email = ?", (email,)).fetchone()
    return dict(row) if row else None


def save_credentials(email: str, password_hash: str, verified: bool) -> None:
    """Crée le compte, ou remplace le mot de passe (et remet à zéro les échecs de connexion)."""
    with connect() as conn:
        conn.execute(
            "INSERT INTO credentials (email, password_hash, verified, failed_logins, locked_until, created_at) "
            "VALUES (?, ?, ?, 0, NULL, ?) ON CONFLICT (email) DO UPDATE SET password_hash = excluded.password_hash, "
            "failed_logins = 0, locked_until = NULL",
            (email, password_hash, int(verified), _now()),
        )


def set_verified(email: str) -> None:
    with connect() as conn:
        conn.execute("UPDATE credentials SET verified = 1 WHERE email = ?", (email,))


def record_failed_login(email: str, locked_until: str | None) -> None:
    with connect() as conn:
        conn.execute("UPDATE credentials SET failed_logins = failed_logins + 1, locked_until = ? WHERE email = ?",
                     (locked_until, email))


def reset_failed_logins(email: str) -> None:
    with connect() as conn:
        conn.execute("UPDATE credentials SET failed_logins = 0, locked_until = NULL WHERE email = ?", (email,))


def save_session(token_hash: str, user: str, expires_at: str) -> None:
    with connect() as conn:
        conn.execute("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                     (token_hash, user, expires_at, _now()))


def get_session(token_hash: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE token_hash = ?", (token_hash,)).fetchone()
    return dict(row) if row else None


def delete_session(token_hash: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))


def delete_sessions(user: str) -> None:
    """Déconnecte un utilisateur de tous ses appareils (après un changement de mot de passe)."""
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user,))


def save_code(email: str, purpose: str, code_hash: str, expires_at: str) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO email_codes (email, purpose, code_hash, attempts, expires_at) VALUES (?, ?, ?, 0, ?) "
            "ON CONFLICT (email, purpose) DO UPDATE SET code_hash = excluded.code_hash, attempts = 0, "
            "expires_at = excluded.expires_at",
            (email, purpose, code_hash, expires_at),
        )


def get_code(email: str, purpose: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM email_codes WHERE email = ? AND purpose = ?", (email, purpose)).fetchone()
    return dict(row) if row else None


def count_code_attempt(email: str, purpose: str) -> None:
    with connect() as conn:
        conn.execute("UPDATE email_codes SET attempts = attempts + 1 WHERE email = ? AND purpose = ?", (email, purpose))


def delete_code(email: str, purpose: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM email_codes WHERE email = ? AND purpose = ?", (email, purpose))


def count_users() -> int:
    with connect() as conn:
        return conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]


# --- Favoris, lu, masqué -----------------------------------------------------------------------


def set_flag(user: str, article: Article, flag: str, value: bool) -> None:
    """Active ou désactive un indicateur (favori, lu, masqué) pour un article et un utilisateur."""
    if flag not in FLAGS:
        raise ValueError(f"Indicateur inconnu : {flag}")
    # « UPSERT » : on insère la ligne, ou on la met à jour si elle existe déjà pour cet utilisateur.
    # Les ? sont des paramètres : SQLite y insère les valeurs de façon sûre.
    # Le nom de colonne {flag}, lui, ne peut pas être un paramètre ; il est sûr car vérifié juste au-dessus.
    with connect() as conn:
        conn.execute(
            f"""
            INSERT INTO article_status (user_id, article_id, {flag}, article_json, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, article_id) DO UPDATE SET {flag} = excluded.{flag}, updated_at = excluded.updated_at
            """,
            (user, article.id, int(value), json.dumps(article.to_dict()), _now()),
        )


def get_statuses(user: str) -> dict[str, dict[str, bool]]:
    """Les indicateurs de l'utilisateur, rangés par identifiant d'article : {id: {"is_favorite": True, …}}."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT article_id, is_favorite, is_read, is_hidden FROM article_status WHERE user_id = ?", (user,)
        ).fetchall()
    return {row["article_id"]: {flag: bool(row[flag]) for flag in FLAGS} for row in rows}


def list_favorites(user: str) -> list[Article]:
    """Les favoris de l'utilisateur, du plus récemment modifié au plus ancien."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT article_json FROM article_status WHERE user_id = ? AND is_favorite = 1 ORDER BY updated_at DESC",
            (user,),
        ).fetchall()
    return [Article.from_dict(json.loads(row["article_json"])) for row in rows]


def reset_flag(user: str, flag: str) -> None:
    """Remet un indicateur à 0 pour tous les articles de l'utilisateur (ex. « réafficher les masqués »)."""
    if flag not in FLAGS:
        raise ValueError(f"Indicateur inconnu : {flag}")
    with connect() as conn:
        conn.execute(f"UPDATE article_status SET {flag} = 0 WHERE user_id = ?", (user,))


# --- Suivis ------------------------------------------------------------------------------------


def add_follow(user: str, kind: str, value: str, label: str) -> None:
    """Suit une entreprise (kind="company", value=symbole) ou un thème (kind="theme", value=mot-clé)."""
    with connect() as conn:
        conn.execute(
            "INSERT INTO follows (user_id, kind, value, label, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
            (user, kind, value.strip(), label.strip(), _now()),
        )


def remove_follow(user: str, kind: str, value: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM follows WHERE user_id = ? AND kind = ? AND value = ?", (user, kind, value))


def list_follows(user: str, kind: str | None = None) -> list[dict]:
    """Les suivis de l'utilisateur, du plus ancien au plus récent : [{"kind", "value", "label"}, …]."""
    query = "SELECT kind, value, label FROM follows WHERE user_id = ?"
    params: tuple = (user,)
    if kind:
        query += " AND kind = ?"
        params += (kind,)
    with connect() as conn:
        rows = conn.execute(query + " ORDER BY created_at", params).fetchall()
    return [dict(row) for row in rows]


# --- Préférences -------------------------------------------------------------------------------


def get_setting(user: str, key: str, default=None):
    """Une préférence de l'utilisateur, ou `default` s'il ne l'a jamais réglée."""
    with connect() as conn:
        row = conn.execute("SELECT value FROM settings WHERE user_id = ? AND key = ?", (user, key)).fetchone()
    return json.loads(row["value"]) if row else default


def set_setting(user: str, key: str, value) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?) "
            "ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value",
            (user, key, json.dumps(value)),
        )


def counts(user: str) -> dict[str, int]:
    """Quelques compteurs pour les pages Réglages et Mon compte."""
    with connect() as conn:
        row = conn.execute(
            "SELECT SUM(is_favorite) AS favorites, SUM(is_read) AS read, SUM(is_hidden) AS hidden "
            "FROM article_status WHERE user_id = ?",
            (user,),
        ).fetchone()

        def count(table: str) -> int:
            return conn.execute(f"SELECT COUNT(*) AS n FROM {table} WHERE user_id = ?", (user,)).fetchone()["n"]

        result = {
            "favorites": row["favorites"] or 0,  # SUM renvoie NULL (None) quand il n'y a aucune ligne
            "read": row["read"] or 0,
            "hidden": row["hidden"] or 0,
            "follows": count("follows"),
            "notes": count("notes"),
            "positions": count("positions"),
            "alerts": count("alerts"),
        }
        result["summaries"] = conn.execute("SELECT COUNT(*) AS n FROM summaries").fetchone()["n"]
    return result


# --- Notes -------------------------------------------------------------------------------------


def get_notes(user: str) -> dict[str, str]:
    """Les notes personnelles de l'utilisateur : {article_id: texte}."""
    with connect() as conn:
        rows = conn.execute("SELECT article_id, text FROM notes WHERE user_id = ?", (user,)).fetchall()
    return {row["article_id"]: row["text"] for row in rows}


def save_note(user: str, article_id: str, text: str) -> None:
    """Enregistre une note ; une note vide la supprime."""
    with connect() as conn:
        if text.strip():
            conn.execute(
                "INSERT INTO notes (user_id, article_id, text, updated_at) VALUES (?, ?, ?, ?) "
                "ON CONFLICT (user_id, article_id) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at",
                (user, article_id, text.strip(), _now()),
            )
        else:
            conn.execute("DELETE FROM notes WHERE user_id = ? AND article_id = ?", (user, article_id))


# --- Portefeuille ------------------------------------------------------------------------------


def add_position(user: str, symbol: str, label: str, quantity: float, price: float, currency: str,
                 bought_on: str) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO positions (user_id, symbol, label, quantity, price, currency, bought_on) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user, symbol, label, quantity, price, currency, bought_on),
        )


def list_positions(user: str) -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM positions WHERE user_id = ? ORDER BY bought_on, id", (user,)).fetchall()
    return [dict(row) for row in rows]


def delete_position(user: str, position_id: int) -> None:
    # « AND user_id = ? » : impossible de supprimer la position d'un autre, même en devinant son numéro.
    with connect() as conn:
        conn.execute("DELETE FROM positions WHERE id = ? AND user_id = ?", (position_id, user))


# --- Alertes -----------------------------------------------------------------------------------


def add_alert(user: str, symbol: str, label: str, kind: str, threshold: float) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO alerts (user_id, symbol, label, kind, threshold, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user, symbol, label, kind, threshold, _now()),
        )


def list_alerts(user: str) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, symbol, label, kind, threshold FROM alerts WHERE user_id = ? ORDER BY created_at", (user,)
        ).fetchall()
    return [dict(row) for row in rows]


def delete_alert(user: str, alert_id: int) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM alerts WHERE id = ? AND user_id = ?", (alert_id, user))


# --- Résumés (cache partagé entre tous les utilisateurs) ---------------------------------------


def get_summary(article_id: str) -> dict | None:
    """Le résumé déjà calculé pour cet article (on ne paie le calcul qu'une fois), ou None."""
    with connect() as conn:
        row = conn.execute("SELECT summary_json FROM summaries WHERE article_id = ?", (article_id,)).fetchone()
    return json.loads(row["summary_json"]) if row else None


def save_summary(article_id: str, summary: dict) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO summaries (article_id, summary_json, created_at) VALUES (?, ?, ?) "
            "ON CONFLICT (article_id) DO UPDATE SET summary_json = excluded.summary_json, created_at = excluded.created_at",
            (article_id, json.dumps(summary, ensure_ascii=False), _now()),
        )


def clear_summaries() -> None:
    with connect() as conn:
        conn.execute("DELETE FROM summaries")
