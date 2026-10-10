"""Base SQLite : favoris, suivis, préférences, résumés (base temporaire, voir conftest.db)."""

from conftest import make_article


def test_upsert_des_indicateurs(db):
    article = make_article("Un article")
    db.set_flag(article, "is_favorite", True)
    db.set_flag(article, "is_read", True)  # même article : mise à jour, pas de doublon
    assert db.get_statuses()[article.id] == {"is_favorite": True, "is_read": True, "is_hidden": False}
    assert db.counts()["favorites"] == 1


def test_un_favori_survit_a_la_disparition_du_flux(db):
    article = make_article("Gardé pour plus tard", summary="Résumé")
    db.set_flag(article, "is_favorite", True)
    favorite = db.list_favorites()[0]
    assert (favorite.title, favorite.summary, favorite.published) == (article.title, article.summary, article.published)


def test_indicateur_inconnu_refuse(db):
    try:
        db.set_flag(make_article(), "is_deleted; DROP TABLE follows", True)
    except ValueError:
        pass
    else:
        raise AssertionError("une ValueError était attendue")


def test_suivis_sans_doublon_et_suppression(db):
    db.add_follow("company", "MC.PA", "LVMH")
    db.add_follow("company", "MC.PA", "LVMH")
    db.add_follow("theme", "inflation", "inflation")
    assert [f["value"] for f in db.list_follows()] == ["MC.PA", "inflation"]
    db.remove_follow("company", "MC.PA")
    assert [f["value"] for f in db.list_follows("company")] == []


def test_preferences_et_resumes(db):
    assert db.get_setting("page_size", 30) == 30
    db.set_setting("default_categories", ["macro", "crypto"])
    assert db.get_setting("default_categories") == ["macro", "crypto"]
    db.save_summary("abc", {"points": ["Un point"], "engine": "Résumé local"})
    assert db.get_summary("abc")["points"] == ["Un point"]
    db.clear_summaries()
    assert db.get_summary("abc") is None


def test_notes_personnelles(db):
    db.save_note("abc", "  Utile pour mon mémoire  ")
    assert db.get_notes() == {"abc": "Utile pour mon mémoire"}
    db.save_note("abc", "")  # une note vide supprime la note
    assert db.get_notes() == {}


def test_positions_et_alertes(db):
    db.add_position("MC.PA", "LVMH", 10, 400.0, "EUR", "2026-04-01")
    db.add_alert("MC.PA", "LVMH", "below", 385.0)
    position, alert = db.list_positions()[0], db.list_alerts()[0]
    assert (position["label"], position["quantity"], position["currency"]) == ("LVMH", 10, "EUR")
    assert (alert["kind"], alert["threshold"]) == ("below", 385.0)
    db.delete_position(position["id"])
    db.delete_alert(alert["id"])
    assert db.list_positions() == [] and db.list_alerts() == []


def test_la_base_refuse_une_quantite_negative(db):
    import sqlite3

    try:
        db.add_position("MC.PA", "LVMH", -5, 400.0, "EUR", "2026-04-01")
    except sqlite3.IntegrityError:
        pass  # la contrainte CHECK (quantity > 0) protège les données, même si l'interface laissait passer
    else:
        raise AssertionError("une IntegrityError était attendue")
