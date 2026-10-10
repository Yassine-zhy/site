"""Lecture et nettoyage des sources (RSS et API), sans aucun appel réseau."""

from unittest import mock

import requests

from conftest import FIXTURES
from core import sources


def test_clean_html_retire_balises_entites_et_css():
    raw = "<style>p{color:red}</style><p>Prix &amp; <b>taux</b></p> @media (max-width: 768px) { .a { b: c } }"
    assert sources.clean_html(raw) == "Prix & taux"


def test_clean_html_retire_un_credit_photo_seul():
    assert sources.clean_html("Image source: The Motley Fool") == ""


def test_clean_html_retire_l_intertitre_key_points():
    assert sources.clean_html("Key PointsForecasting an AI bubble…") == "Forecasting an AI bubble…"
    assert sources.clean_html("<h2>Key Points</h2><p>Les marchés</p>") == "Les marchés"


def test_shorten_coupe_a_la_fin_d_un_mot():
    text = sources.shorten("mot " * 100, width=20)
    assert len(text) <= 20 and text.endswith("…") and "mo …" not in text


def fake_response(content: bytes, status: int = 200) -> requests.Response:
    response = requests.Response()
    response.status_code = status
    response._content = content
    return response


def test_fetch_rss_convertit_les_entrees_en_articles():
    xml = (FIXTURES / "sample_feed.xml").read_bytes()
    feed = {"name": "Test", "url": "https://example.com/rss", "category": "macro"}
    with mock.patch.object(sources.requests, "get", return_value=fake_response(xml)):
        articles = sources.fetch_rss(feed)

    assert [a.url for a in articles] == ["https://example.com/btc", "https://example.com/bce"]  # tri + sans titre ignoré
    bce = articles[1]
    assert bce.title == "La BCE maintient ses taux & surveille l'inflation"
    assert bce.summary == "La Banque centrale européenne laisse ses taux inchangés."
    assert bce.published.isoformat() == "2026-10-09T14:00:00+00:00"
    assert bce.image == "https://example.com/bce.jpg"
    assert articles[0].summary == ""  # crédit photo retiré


def test_describe_error_ne_revele_jamais_l_url():
    error = requests.Timeout("https://api.example.com/?apikey=SECRET")
    assert "SECRET" not in sources.describe_error(error)
    response = fake_response(b"", 429)
    assert sources.describe_error(requests.HTTPError(response=response)) == "quota dépassé (429)"


def test_finnhub_signale_une_erreur_renvoyee_en_json():
    with mock.patch.object(sources, "_get_json", return_value={"error": "Invalid API key"}):
        try:
            sources.fetch_finnhub_news("cle")
        except sources.SourceError as exc:
            assert "Invalid API key" in str(exc)
        else:
            raise AssertionError("une SourceError était attendue")


def test_newsapi_ignore_les_articles_retires():
    data = {"status": "ok", "articles": [
        {"source": {"name": "Reuters"}, "title": "Fed holds", "url": "https://r/1", "publishedAt": "2026-10-09T14:00:00Z"},
        {"source": {"name": "[Removed]"}, "title": "[Removed]", "url": "https://removed.com", "publishedAt": "2026-10-09T14:00:00Z"},
    ]}
    with mock.patch.object(sources, "_get_json", return_value=data):
        articles = sources.fetch_newsapi_headlines("cle")
    assert [a.source for a in articles] == ["Reuters"]


def test_alpha_vantage_quota_atteint_avec_un_code_200():
    with mock.patch.object(sources, "_get_json", return_value={"Information": "25 requests per day"}):
        try:
            sources.fetch_alphavantage_news("cle")
        except sources.SourceError as exc:
            assert "25 requests" in str(exc)
        else:
            raise AssertionError("une SourceError était attendue")


def test_marketaux_moyenne_du_sentiment_des_entreprises():
    data = {"data": [{"title": "LVMH", "url": "https://m/1", "published_at": "2026-10-09T12:00:00.000000Z",
                      "source": "reuters.com", "entities": [{"symbol": "MC.PA", "sentiment_score": 0.5},
                                                            {"symbol": "KER.PA", "sentiment_score": -0.1}]}]}
    with mock.patch.object(sources, "_get_json", return_value=data):
        article = sources.fetch_marketaux_news("cle")[0]
    assert article.tickers == ["MC.PA", "KER.PA"]
    assert abs(article.sentiment - 0.2) < 1e-9
