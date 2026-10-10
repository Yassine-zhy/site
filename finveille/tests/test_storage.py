"""Base de données : favoris, suivis, préférences, résumés, comptes.

Chaque test tourne sur SQLite, puis sur PostgreSQL si une base de test est configurée (voir conftest.store).
"""

import sqlite3

import pytest

from conftest import make_article

ME = "moi@example.com"


def test_upsert_des_indicateurs(store):
    article = make_article("Un article")
    store.set_flag(ME, article, "is_favorite", True)
    store.set_flag(ME, article, "is_read", True)  # même article : mise à jour, pas de doublon
    assert store.get_statuses(ME)[article.id] == {"is_favorite": True, "is_read": True, "is_hidden": False}
    assert store.counts(ME)["favorites"] == 1


def test_un_favori_survit_a_la_disparition_du_flux(store):
    article = make_article("Gardé pour plus tard", summary="Résumé")
    store.set_flag(ME, article, "is_favorite", True)
    favorite = store.list_favorites(ME)[0]
    assert (favorite.title, favorite.summary, favorite.published) == (article.title, article.summary, article.published)


def test_indicateur_inconnu_refuse(store):
    with pytest.raises(ValueError):
        store.set_flag(ME, make_article(), "is_deleted; DROP TABLE follows", True)


def test_suivis_sans_doublon_et_suppression(store):
    store.add_follow(ME, "company", "MC.PA", "LVMH")
    store.add_follow(ME, "company", "MC.PA", "LVMH")
    store.add_follow(ME, "theme", "inflation", "inflation")
    assert [f["value"] for f in store.list_follows(ME)] == ["MC.PA", "inflation"]
    store.remove_follow(ME, "company", "MC.PA")
    assert [f["value"] for f in store.list_follows(ME, "company")] == []


def test_preferences_et_resumes(store):
    assert store.get_setting(ME, "page_size", 30) == 30
    store.set_setting(ME, "default_categories", ["macro", "crypto"])
    assert store.get_setting(ME, "default_categories") == ["macro", "crypto"]
    store.save_summary("abc", {"points": ["Un point"], "engine": "Résumé local"})
    assert store.get_summary("abc")["points"] == ["Un point"]
    store.clear_summaries()
    assert store.get_summary("abc") is None


def test_notes_personnelles(store):
    store.save_note(ME, "abc", "  Utile pour mon mémoire  ")
    assert store.get_notes(ME) == {"abc": "Utile pour mon mémoire"}
    store.save_note(ME, "abc", "")  # une note vide supprime la note
    assert store.get_notes(ME) == {}


def test_positions_et_alertes(store):
    store.add_position(ME, "MC.PA", "LVMH", 10, 400.0, "EUR", "2026-04-01")
    store.add_alert(ME, "MC.PA", "LVMH", "below", 385.0)
    position, alert = store.list_positions(ME)[0], store.list_alerts(ME)[0]
    assert (position["label"], position["quantity"], position["currency"]) == ("LVMH", 10, "EUR")
    assert (alert["kind"], alert["threshold"]) == ("below", 385.0)
    store.delete_position(ME, position["id"])
    store.delete_alert(ME, alert["id"])
    assert store.list_positions(ME) == [] and store.list_alerts(ME) == []


def test_la_base_refuse_une_quantite_negative(store):
    # la contrainte CHECK (quantity > 0) protège les données, même si l'interface laissait passer
    with pytest.raises(Exception) as error:
        store.add_position(ME, "MC.PA", "LVMH", -5, 400.0, "EUR", "2026-04-01")
    # sqlite3.IntegrityError, ou psycopg.errors.CheckViolation (une IntegrityError) avec PostgreSQL
    assert "IntegrityError" in [cls.__name__ for cls in type(error.value).__mro__]
    assert store.list_positions(ME) == []


# --- Comptes utilisateurs ------------------------------------------------------------------------


def test_chaque_utilisateur_ne_voit_que_ses_donnees(store):
    article = make_article("Une dépêche")
    store.set_flag("alice", article, "is_favorite", True)
    store.add_follow("alice", "company", "MC.PA", "LVMH")
    store.save_note("alice", article.id, "Note d'Alice")
    store.add_position("alice", "MC.PA", "LVMH", 10, 400.0, "EUR", "2026-04-01")
    store.set_setting("alice", "page_size", 50)
    # Bob ne voit rien de tout cela…
    assert store.list_favorites("bob") == [] and store.list_follows("bob") == [] and store.get_notes("bob") == {}
    assert store.list_positions("bob") == [] and store.get_setting("bob", "page_size", 30) == 30
    # … et le même article peut avoir un statut différent pour chacun
    store.set_flag("bob", article, "is_hidden", True)
    assert store.get_statuses("alice")[article.id]["is_hidden"] is False
    assert store.get_statuses("bob")[article.id] == {"is_favorite": False, "is_read": False, "is_hidden": True}


def test_impossible_de_supprimer_la_position_d_un_autre(store):
    store.add_position("alice", "MC.PA", "LVMH", 10, 400.0, "EUR", "2026-04-01")
    store.add_alert("alice", "MC.PA", "LVMH", "above", 500.0)
    position, alert = store.list_positions("alice")[0], store.list_alerts("alice")[0]
    store.delete_position("bob", position["id"])  # Bob devine le numéro : sans effet
    store.delete_alert("bob", alert["id"])
    assert len(store.list_positions("alice")) == 1 and len(store.list_alerts("alice")) == 1


def test_enregistrement_export_et_suppression_d_un_compte(store):
    store.touch_user("alice", "alice@example.com", "Alice")
    first_visit = store.get_user("alice")["created_at"]
    store.touch_user("alice", "alice@example.com", "Alice Martin")  # nouvelle visite : nom mis à jour
    assert store.get_user("alice")["name"] == "Alice Martin"
    assert store.get_user("alice")["created_at"] == first_visit  # la date d'inscription ne change pas

    store.add_follow("alice", "theme", "inflation", "inflation")
    store.add_follow("bob", "theme", "pétrole", "pétrole")
    export = store.export_user_data("alice")
    assert export["user"]["email"] == "alice@example.com"
    assert [f["value"] for f in export["follows"]] == ["inflation"]  # rien de Bob dans l'export d'Alice

    store.delete_user_data("alice")
    assert store.get_user("alice") is None and store.export_user_data("alice")["follows"] == []
    assert len(store.list_follows("bob")) == 1  # les données de Bob sont intactes


def test_migration_d_une_base_des_etapes_precedentes(tmp_path, monkeypatch):
    """Une base créée avant les comptes (sans colonne user_id) est convertie sans perte de données."""
    from core import storage

    path = tmp_path / "ancienne.db"
    with sqlite3.connect(path) as conn:
        conn.executescript("""
            CREATE TABLE follows (kind TEXT NOT NULL, value TEXT NOT NULL, label TEXT NOT NULL,
                                  created_at TEXT NOT NULL, PRIMARY KEY (kind, value));
            INSERT INTO follows VALUES ('company', 'MC.PA', 'LVMH', '2026-01-01T00:00:00+00:00');
            CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            INSERT INTO settings VALUES ('page_size', '50');
            CREATE TABLE summaries (article_id TEXT PRIMARY KEY, summary_json TEXT NOT NULL, created_at TEXT NOT NULL);
            INSERT INTO summaries VALUES ('abc', '{"points": ["Un point"]}', '2026-01-01');
        """)
    monkeypatch.setattr(storage, "DB_PATH", path)
    storage.init_db()
    storage.init_db()  # une deuxième fois : rien ne doit changer
    assert [f["label"] for f in storage.list_follows(storage.LOCAL_USER)] == ["LVMH"]
    assert storage.get_setting(storage.LOCAL_USER, "page_size") == 50
    assert storage.get_summary("abc") == {"points": ["Un point"]}  # table partagée : inchangée
    storage.add_follow("alice", "company", "MC.PA", "LVMH")  # la nouvelle clé primaire accepte un 2e utilisateur
    assert len(storage.list_follows("alice")) == 1
