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
