"""Les régions du fil : flux, modèle, filtre et préférence française de la une."""

from datetime import datetime, timezone

from core.aggregator import filter_region, prefer_french
from core.classifier import classify
from core.config import CATEGORIES, REGIONS, RSS_FEEDS
from core.models import Article


def _article(title="t", region="monde", url=None, **kw):
    return Article(title=title, url=url or f"https://x/{title}", source="S", published=datetime.now(timezone.utc),
                   region=region, **kw)


def test_chaque_flux_a_une_region_et_une_categorie_valides():
    for feed in RSS_FEEDS:
        assert feed["region"] in REGIONS, feed["name"]
        assert feed["category"] in CATEGORIES, feed["name"]


def test_pas_de_doublon_de_flux():
    urls = [feed["url"] for feed in RSS_FEEDS]
    assert len(urls) == len(set(urls))
    names = [feed["name"] for feed in RSS_FEEDS]
    assert len(names) == len(set(names))


def test_les_trois_regions_ont_des_flux():
    assert {feed["region"] for feed in RSS_FEEDS} == set(REGIONS)


def test_ancien_article_sans_region_se_relit():
    data = _article().to_dict()
    del data["region"]
    assert Article.from_dict(data).region == "monde"
    assert Article.from_dict(_article(region="ca").to_dict()).region == "ca"


def test_filtre_par_region():
    items = [_article("a", "fr"), _article("b", "ca"), _article("c", "monde")]
    assert [a.title for a in filter_region(items, "ca")] == ["b"]
    assert len(filter_region(items, "tout")) == 3
    assert len(filter_region(items, None)) == 3


def test_la_une_prefere_la_france_a_egalite():
    us, fr = _article("us", "monde"), _article("fr", "fr")
    assert prefer_french([(us, 3), (fr, 3)])[0] is fr
    assert prefer_french([(us, 4), (fr, 3)])[0] is us  # pas d'égalité : le plus repris gagne


def test_vocabulaire_canadien_reconnu():
    article = _article("La Bourse de Toronto grimpe, le huard recule", category="macro")
    assert classify(article) == "marches"
