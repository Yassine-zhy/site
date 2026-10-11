"""Images des articles : l'image de partage d'une page web (balise « og:image »).

Beaucoup de flux RSS ne donnent pas d'image (CNBC, The Economist…), mais chaque article en déclare une pour les
réseaux sociaux, dans l'en-tête de sa page :  <meta property="og:image" content="https://…/photo.jpg">
On ne lit que le début de la page (l'en-tête), et seulement pour les quelques articles mis en avant.
"""

from __future__ import annotations

import html
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from urllib.parse import urlparse

import requests

TIMEOUT = 3
MAX_BYTES = 300_000  # l'en-tête <head> tient presque toujours dans les premiers 300 Ko
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FinVeille/1.0; +https://github.com)"}
_META_RE = re.compile(r"<meta\b[^>]*>", re.IGNORECASE)
_ATTR_RE = re.compile(r'(\w[\w:-]*)\s*=\s*["\']([^"\']*)["\']')
WANTED = ("og:image", "og:image:url", "twitter:image", "twitter:image:src")
_GENERIC_RE = re.compile(r"default|placeholder|logo", re.IGNORECASE)  # image « par défaut » d'un site : sans intérêt
_blocked: set[str] = set()  # sites qui refusent les robots (403) : on ne les sollicite plus
_lock = threading.Lock()
_fetched: dict[str, None] = {}  # articles déjà lus, du plus ancien au plus récent (même borne que le cache)


def find_share_image(page: str) -> str | None:
    """L'adresse de l'image de partage déclarée dans le HTML d'une page, ou None."""
    found = {}
    for tag in _META_RE.findall(page):
        attrs = {name.lower(): value for name, value in _ATTR_RE.findall(tag)}
        key = (attrs.get("property") or attrs.get("name") or "").lower()
        if key in WANTED and attrs.get("content"):
            found.setdefault(key, html.unescape(attrs["content"]).strip())
    for key in WANTED:
        url = found.get(key)
        if url and url.startswith(("http://", "https://")) and not _GENERIC_RE.search(urlparse(url).path):
            return url
    return None


@lru_cache(maxsize=2048)  # mémoire du processus : chaque article n'est lu qu'une fois (réussite ou échec)
def fetch_share_image(url: str) -> str | None:
    """Télécharge le début de la page d'un article et renvoie son image de partage (None en cas d'échec)."""
    domain = urlparse(url).netloc
    if domain in _blocked:
        return None
    try:
        with requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True) as response:
            if response.status_code in (401, 403, 429):
                with _lock:
                    _blocked.add(domain)
                return None
            response.raise_for_status()
            chunks, size = [], 0
            for chunk in response.iter_content(chunk_size=16_384, decode_unicode=False):
                chunks.append(chunk)
                size += len(chunk)
                if size >= MAX_BYTES or b"</head>" in chunk.lower():
                    break
        page = b"".join(chunks).decode(response.encoding or "utf-8", errors="replace")
    except requests.RequestException:
        return None
    return find_share_image(page)


def share_images(urls: list[str]) -> dict[str, str]:
    """Les images de partage de plusieurs articles, cherchées en parallèle : {adresse de l'article: image}."""
    with ThreadPoolExecutor(max_workers=6) as pool:
        found = dict(zip(urls, pool.map(fetch_share_image, urls)))
    with _lock:
        _fetched.update(dict.fromkeys(urls))
        while len(_fetched) > 2048:  # on oublie les plus anciens, comme le cache de fetch_share_image
            del _fetched[next(iter(_fetched))]
    return {url: image for url, image in found.items() if image}


def all_known(urls: list[str]) -> bool:
    """Vrai si toutes ces pages ont déjà été lues : share_images répondra alors tout de suite (sans attente)."""
    return all(url in _fetched for url in urls)
