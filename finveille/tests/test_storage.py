"""Base SQLite : favoris, suivis, préférences, résumés, comptes (base temporaire, voir conftest.db)."""

import sqlite3

import pytest

from conftest import make_article

ME = "moi@example.com"


def test_upsert_des_indicateurs(db):
    article = make_article("Un article")
    db.set_flag(ME, article, "is_favorite", True)
    db.set_flag(ME, article, "is_read", True)  # même article : mise à jour, pas de doublon
    assert db.get_statuses(ME)[article.id] == {"is_favorite": True, "is_read": True, "is_hidden": False}
    assert db.counts(ME)["favorites"] == 1


def test_un_favori_survit_a_la_disparition_du_flux(db):
    article = make_article("Gardé pour plus tard", summary="Résumé")
    db.set_flag(ME, article, "is_favorite", True)
    favorite = db.list_favorites(ME)[0]
    assert (favorite.title, favorite.summary, favorite.published) == (article.title, article.summary, article.published)


def test_indicateur_inconnu_refuse(db):
    with pytest.raises(ValueError):
        db.set_flag(ME, make_article(), "is_deleted; DROP TABLE follows", True)


def test_suivis_sans_doublon_et_suppression(db):
    db.add_follow(ME, "company", "MC.PA", "LVMH")
    db.add_follow(ME, "company", "MC.PA", "LVMH")
    db.add_follow(ME, "theme", "inflation", "inflation")
    assert [f["value"] for f in db.list_follows(ME)] == ["MC.PA", "inflation"]
    db.remove_follow(ME, "company", "MC.PA")
    assert [f["value"] for f in db.list_follows(ME, "company")] == []


def test_preferences_et_resumes(db):
    assert db.get_setting(ME, "page_size", 30) == 30
    db.set_setting(ME, "default_categories", ["macro", "crypto"])
    assert db.get_setting(ME, "default_categories") == ["macro", "crypto"]
    db.save_summary("abc", {"points": ["Un point"], "engine": "Résumé local"})
    assert db.get_summary("abc")["points"] == ["Un point"]
    db.clear_summaries()
    assert db.get_summary("abc") is None


def test_notes_personnelles(db):
    db.save_note(ME, "abc", "  Utile pour mon mémoire  ")
    assert db.get_notes(ME) == {"abc": "Utile pour mon mémoire"}
    db.save_note(ME, "abc", "")  # une note vide supprime la note
    assert db.get_notes(ME) == {}


def test_positions_et_alertes(db):
    db.add_position(ME, "MC.PA", "LVMH", 10, 400.0, "EUR", "2026-04-01")
    db.add_alert(ME, "MC.PA", "LVMH", "below", 385.0)
    position, alert = db.list_positions(ME)[0], db.list_alerts(ME)[0]
    assert (position["label"], position["quantity"], position["currency"]) == ("LVMH", 10, "EUR")
    assert (alert["kind"], alert["threshold"]) == ("below", 385.0)
    db.delete_position(ME, position["id"])
    db.delete_alert(ME, alert["id"])
    assert db.list_positions(ME) == [] and db.list_alerts(ME) == []


def test_la_base_refuse_une_quantite_negative(db):
    # la contrainte CHECK (quantity > 0) protège les données, même si l'interface laissait passer
    with pytest.raises(sqlite3.IntegrityError):
        db.add_position(ME, "MC.PA", "LVMH", -5, 400.0, "EUR", "2026-04-01")


# --- Comptes utilisateurs ------------------------------------------------------------------------


def test_chaque_utilisateur_ne_voit_que_ses_donnees(db):
    article = make_article("Une dépêche")
    db.set_flag("alice", article, "is_favorite", True)
    db.add_follow("alice", "company", "MC.PA", "LVMH")
    db.save_note("alice", article.id, "Note d'Alice")
    db.add_position("alice", "MC.PA", "LVMH", 10, 400.0, "EUR", "2026-04-01")
    db.set_setting("alice", "page_size", 50)
    # Bob ne voit rien de tout cela…
    assert db.list_favorites("bob") == [] and db.list_follows("bob") == [] and db.get_notes("bob") == {}
    assert db.list_positions("bob") == [] and db.get_setting("bob", "page_size", 30) == 30
    # … et le même article peut avoir un statut différent pour chacun
    db.set_flag("bob", article, "is_hidden", True)
    assert db.get_statuses("alice")[article.id]["is_hidden"] is False
    assert db.get_statuses("bob")[article.id] == {"is_favorite": False, "is_read": False, "is_hidden": True}


def test_impossible_de_supprimer_la_position_d_un_autre(db):
    db.add_position("alice", "MC.PA", "LVMH", 10, 400.0, "EUR", "2026-04-01")
    db.add_alert("alice", "MC.PA", "LVMH", "above", 500.0)
    position, alert = db.list_positions("alice")[0], db.list_alerts("alice")[0]
    db.delete_position("bob", position["id"])  # Bob devine le numéro : sans effet
    db.delete_alert("bob", alert["id"])
    assert len(db.list_positions("alice")) == 1 and len(db.list_alerts("alice")) == 1


def test_enregistrement_export_et_suppression_d_un_compte(db):
    db.touch_user("alice", "alice@example.com", "Alice")
    first_visit = db.get_user("alice")["created_at"]
    db.touch_user("alice", "alice@example.com", "Alice Martin")  # nouvelle visite : nom mis à jour
    assert db.get_user("alice")["name"] == "Alice Martin"
    assert db.get_user("alice")["created_at"] == first_visit  # la date d'inscription ne change pas

    db.add_follow("alice", "theme", "inflation", "inflation")
    db.add_follow("bob", "theme", "pétrole", "pétrole")
    export = db.export_user_data("alice")
    assert export["user"]["email"] == "alice@example.com"
    assert [f["value"] for f in export["follows"]] == ["inflation"]  # rien de Bob dans l'export d'Alice

    db.delete_user_data("alice")
    assert db.get_user("alice") is None and db.export_user_data("alice")["follows"] == []
    assert len(db.list_follows("bob")) == 1  # les données de Bob sont intactes


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
