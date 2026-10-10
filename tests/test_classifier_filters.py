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


def test_recherche_avancee_expression_exclusion_et_source():
    from core.filters import parse_query

    q = parse_query('inflation "banque centrale" -crypto source:cnbc')
    assert (q.terms, q.excluded, q.sources) == (["inflation", "banque centrale"], ["crypto"], ["cnbc"])

    bce = make_article("La banque centrale relève ses taux face à l'inflation", source="CNBC Économie")
    btc = make_article("Bitcoin : la banque centrale et l'inflation", source="CNBC Économie")
    other = make_article("La banque centrale relève ses taux face à l'inflation", source="BBC")
    query = 'inflation "banque centrale" -bitcoin source:cnbc'
    assert matches_query(bce, query)
    assert not matches_query(btc, query)  # mot exclu
    assert not matches_query(other, query)  # mauvaise source
    assert not matches_query(bce, '"centrale banque"')  # l'expression exacte doit être dans le bon ordre


def test_apostrophes_et_guillemets_francais():
    from core.filters import parse_query

    assert parse_query("l'or et l'argent").terms == ["l'or", "et", "l'argent"]
    assert parse_query("«Banque de France»").terms == ["banque de france"]
    assert parse_query('"non fermé').terms == ["non", "ferme"]  # guillemet oublié : pas de plantage
