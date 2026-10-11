"""Tests des images : image de partage (og:image), couvertures dessinées, illustration de la page de connexion."""

from datetime import datetime, timezone

import pytest
import requests

import theme
from core import images
from core.models import Article


def test_find_share_image_prefers_open_graph():
    page = """<head><meta name="twitter:image" content="https://cdn.example.com/twitter.jpg">
    <meta property="og:image" content="https://cdn.example.com/photo.jpg?w=1200&amp;h=630"></head>"""
    assert images.find_share_image(page) == "https://cdn.example.com/photo.jpg?w=1200&h=630"  # &amp; décodé


def test_find_share_image_falls_back_to_twitter_and_skips_bad_values():
    assert images.find_share_image('<meta content="https://a.com/t.png" name="twitter:image">') == "https://a.com/t.png"
    assert images.find_share_image('<meta property="og:image" content="/relative.jpg">') is None  # pas d'adresse complète
    assert images.find_share_image('<meta property="og:image" content="https://a.com/img/logo-default.png">') is None
    assert images.find_share_image("<head><title>Sans image</title></head>") is None


class FakeResponse:
    def __init__(self, status: int, body: bytes = b""):
        self.status_code, self.body, self.encoding = status, body, "utf-8"

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(str(self.status_code))

    def iter_content(self, chunk_size, decode_unicode=False):
        yield self.body


@pytest.fixture
def fresh_images(monkeypatch):
    images.fetch_share_image.cache_clear()
    monkeypatch.setattr(images, "_blocked", set())
    yield
    images.fetch_share_image.cache_clear()


def test_fetch_share_image_reads_the_page_once(monkeypatch, fresh_images):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return FakeResponse(200, b'<head><meta property="og:image" content="https://cdn.site.com/a.jpg"></head>')

    monkeypatch.setattr(images.requests, "get", fake_get)
    assert images.share_images(["https://site.com/article-1"]) == {"https://site.com/article-1": "https://cdn.site.com/a.jpg"}
    assert images.fetch_share_image("https://site.com/article-1") == "https://cdn.site.com/a.jpg"
    assert calls == ["https://site.com/article-1"]  # le second appel vient de la mémoire


def test_fetch_share_image_stops_asking_a_site_that_refuses(monkeypatch, fresh_images):
    calls = []

    def fake_get(url, **kwargs):
        calls.append(url)
        return FakeResponse(403)

    monkeypatch.setattr(images.requests, "get", fake_get)
    assert images.share_images(["https://blocked.com/a"]) == {}
    assert images.fetch_share_image("https://blocked.com/b") is None
    assert calls == ["https://blocked.com/a"]  # « b » n'a pas été demandé : le site refuse les robots


def test_fetch_share_image_survives_network_errors(monkeypatch, fresh_images):
    def fake_get(url, **kwargs):
        raise requests.ConnectionError("hors ligne")

    monkeypatch.setattr(images.requests, "get", fake_get)
    assert images.fetch_share_image("https://down.com/a") is None


def test_no_placeholder_image_when_there_is_no_photo():
    import ui

    article = Article(title="Titre", url="https://example.com/a", source="Exemple", category="marches",
                      summary="Chapeau", published=datetime(2026, 10, 10, 9, 0, tzinfo=timezone.utc))
    images_in = lambda html: html.count("<img")  # noqa: E731 — le logo de la source compte pour une
    row = ui.article_html(article, False, "row")
    assert "has-thumb" not in row and images_in(row) == 1
    lead = ui.article_html(article, False, "lead")
    assert "no-media" in lead and "fv-media" not in lead and "Chapeau" in lead  # la une passe en version texte
    tile = ui.article_html(article, False, "tile")
    assert "no-media" in tile and "--c:" in tile and "Chapeau" in tile  # liseré de la rubrique, chapeau affiché
    with_photo = ui.article_html(article, False, "row", image="https://cdn.example.com/p.jpg")
    assert 'src="https://cdn.example.com/p.jpg"' in with_photo and "has-thumb" in with_photo
    tile_photo = ui.article_html(article, False, "tile", image="https://cdn.example.com/p.jpg")
    assert "no-media" not in tile_photo and "Chapeau" not in tile_photo  # avec photo : titre seul, plus compact


def test_showcase_uses_images_not_inline_svg():
    showcase = theme.showcase_html()
    assert "<svg" not in showcase and showcase.count("data:image/svg+xml") >= 5
    assert "Portefeuille virtuel" in showcase


def test_all_known_after_a_search(monkeypatch):
    from core import images

    monkeypatch.setattr(images, "fetch_share_image", lambda url: "https://cdn.example.com/p.jpg" if url.endswith("known") else None)
    urls = ["https://example.com/a-known", "https://example.com/other"]
    assert not images.all_known(urls)
    assert images.share_images(urls) == {"https://example.com/a-known": "https://cdn.example.com/p.jpg"}
    assert images.all_known(urls)  # la prochaine fois : pas d'attente, donc pas de squelette de chargement
