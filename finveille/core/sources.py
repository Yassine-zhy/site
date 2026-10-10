"""Récupération des articles depuis les différentes sources."""

from __future__ import annotations

import html
import re
from datetime import datetime, timezone

import feedparser
import requests

from core.config import MAX_ARTICLES_PER_FEED, REQUEST_TIMEOUT, USER_AGENT
from core.models import Article

_TAG_RE = re.compile(r"<[^>]+>")  # une balise HTML : <p>, </a>, <img src="…">…
_SPACES_RE = re.compile(r"\s+")  # une suite d'espaces, tabulations ou retours à la ligne


def clean_html(text: str | None) -> str:
    """Transforme un fragment HTML en texte brut lisible."""
    text = _TAG_RE.sub(" ", text or "")  # enlève les balises
    text = html.unescape(text)  # &amp; -> &, &eacute; -> é…
    return _SPACES_RE.sub(" ", text).strip()


def _entry_date(entry) -> datetime:
    """Date de publication d'une entrée RSS, en UTC (maintenant si le flux n'en donne pas)."""
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if parsed:
        return datetime(*parsed[:6], tzinfo=timezone.utc)
    return datetime.now(timezone.utc)


def _entry_image(entry) -> str | None:
    """URL de l'image d'illustration, si le flux en fournit une."""
    for key in ("media_content", "media_thumbnail"):
        for media in entry.get(key) or []:
            if media.get("url"):
                return media["url"]
    for link in entry.get("links", []):
        if link.get("rel") == "enclosure" and link.get("type", "").startswith("image"):
            return link.get("href")
    return None


def fetch_rss(feed: dict) -> list[Article]:
    """Télécharge un flux RSS et le convertit en liste d'`Article`.

    Lève `requests.RequestException` si le site ne répond pas : c'est l'appelant qui décide
    quoi faire de l'erreur.
    """
    response = requests.get(feed["url"], headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()  # erreur si le serveur répond 403, 404, 500…
    parsed = feedparser.parse(response.content)

    articles = []
    for entry in parsed.entries:
        title = clean_html(entry.get("title"))
        url = entry.get("link", "")
        if not title or not url:
            continue  # entrée incomplète : on l'ignore
        articles.append(
            Article(
                title=title,
                url=url,
                source=feed["name"],
                published=_entry_date(entry),
                summary=clean_html(entry.get("summary"))[:500],
                category=feed["category"],
                image=_entry_image(entry),
            )
        )

    articles.sort(key=lambda article: article.published, reverse=True)
    return articles[:MAX_ARTICLES_PER_FEED]
