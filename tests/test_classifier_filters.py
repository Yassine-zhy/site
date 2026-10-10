"""Classification par mots-clés et filtres du fil."""

from conftest import make_article
from core.classifier import classify
from core.filters import filter_articles, matches_query, normalize


def test_normalize_retire_accents_et_majuscules():
    assert normalize("Économie À Paris") == "economie a paris"


def test_recherche_sans_accents_et_tous_les_mots():
    article = make_article("La Banque centrale européenne relève ses taux")
    assert matches_query(article, "banque EUROPEENNE")
    assert not matches_query(article, "banque japon")


def test_filtres_vides_ne_filtrent_rien():
    articles = [make_article("A"), make_article("B", category="crypto")]
    assert filter_articles(articles) == articles
    assert [a.title for a in filter_articles(articles, categories=["crypto"])] == ["B"]


def test_classify_reconnait_la_macro_dans_un_flux_generaliste():
    article = make_article("Fed signals rate cut as inflation cools", category="entreprises")
    assert classify(article) == "macro"


def test_classify_garde_la_categorie_du_flux_en_cas_d_egalite():
    article = make_article("Bitcoin miners and inflation", category="crypto")
    assert classify(article) == "crypto"


def test_frontiere_de_mot_fedex_n_est_pas_la_fed():
    article = make_article("FedEx delivers record parcels", category="entreprises")
    assert classify(article) == "entreprises"
