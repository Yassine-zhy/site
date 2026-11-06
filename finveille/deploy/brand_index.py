"""La page de départ de Streamlit aux couleurs de FinVeille (guide 25), réécrite une fois à la construction de l'image
Docker (Dockerfile).

Streamlit envoie d'abord une page HTML à lui, que l'appli ne complète qu'une fois démarrée : pendant quelques
secondes, l'onglet affichait « Streamlit » et son logo. Et un lien partagé (LinkedIn, WhatsApp, Messenger…) montrait
« Streamlit », sans description ni image : ces sites lisent cette page sans lancer l'appli. Ce script y met le titre,
la langue, la description, l'aperçu des liens (Open Graph : static/og.png) et l'icône de l'onglet (static/favicon.png,
toutes deux produites par docs/branding/render.py).

    python deploy/brand_index.py          # depuis finveille/ ; sans effet si la page est déjà réécrite
"""

from __future__ import annotations

import os
import re
import shutil
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # le dossier finveille/
SITE = os.environ.get("SITE_URL", "https://finveille.com").rstrip("/")
TITLE = "FinVeille"
SHARE_TITLE = "FinVeille · Toute la finance qui compte, en un seul site"
DESCRIPTION = ("L'actualité de plus de 40 sources internationales, les marchés mondiaux, l'économie, la crypto et un "
               "assistant IA qui cite ses sources. Gratuit, sans publicité.")
MARK = 'property="og:title"'  # présent : la page est déjà réécrite


def head_tags(site: str = SITE) -> str:
    """Les balises ajoutées dans <head>, après le titre."""
    tags = [
        ("name", "description", DESCRIPTION),
        ("property", "og:type", "website"),
        ("property", "og:site_name", TITLE),
        ("property", "og:locale", "fr_FR"),
        ("property", "og:title", SHARE_TITLE),
        ("property", "og:description", DESCRIPTION),
        ("property", "og:image", f"{site}/app/static/og.png"),
        ("property", "og:image:width", "1280"),
        ("property", "og:image:height", "640"),
        ("property", "og:image:alt", "FinVeille : la veille financière mondiale, triée et expliquée"),
        ("name", "twitter:card", "summary_large_image"),
    ]
    lines = [f'<meta {kind}="{key}" content="{escape(value)}" />' for kind, key, value in tags]
    lines.append('<link rel="apple-touch-icon" href="./app/static/favicon.png" />')
    return "\n    ".join(lines)


def brand(page: str, site: str = SITE) -> str:
    """La page de départ réécrite : langue, titre, description, aperçu des liens. Une page déjà réécrite est rendue
    telle quelle ; une page sans <title> (Streamlit a changé) fait échouer la construction plutôt que de passer."""
    if MARK in page:
        return page
    page = page.replace('<html lang="en">', '<html lang="fr">', 1)
    page, found = re.subn(r"<title>.*?</title>", f"<title>{TITLE}</title>\n    {head_tags(site)}", page, count=1,
                          flags=re.S)
    if not found:
        raise SystemExit("deploy/brand_index.py : pas de <title> dans la page de départ de Streamlit")
    return page


def main() -> None:
    import streamlit

    static = Path(streamlit.__file__).resolve().parent / "static"
    index = static / "index.html"
    index.write_text(brand(index.read_text(encoding="utf-8")), encoding="utf-8")
    shutil.copyfile(ROOT / "static" / "favicon.png", static / "favicon.png")  # l'icône avant le démarrage de l'appli
    print(f"Page de départ réécrite : {index}")


if __name__ == "__main__":
    main()
