"""Exporte les visuels de la marque en PNG (guide 26), depuis le dossier finveille/ :
    pip install playwright && playwright install chromium
    python docs/branding/render.py                       # tous les visuels
    python docs/branding/render.py favicon.html          # seulement celui-là
CHROMIUM_PATH=/chemin/vers/chromium pour utiliser un Chromium déjà installé.
"""

import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
VISUALS = [  # (page HTML, image produite, largeur, hauteur, échelle)
    ("linkedin-banner.html", "linkedin-banner.png", 1584, 396, 2),  # LinkedIn accepte le double : plus net
    ("social-preview.html", "social-preview.png", 1280, 640, 1),  # GitHub : 1 Mo au plus
    # la page de départ du site (deploy/brand_index.py) : l'aperçu des liens partagés et l'icône de l'onglet
    ("site-preview.html", "../../static/og.png", 1280, 640, 1),
    ("favicon.html", "../../static/favicon.png", 192, 192, 1),
]
WANTED = set(sys.argv[1:])  # des noms de pages HTML : seulement celles-là (toutes, sinon)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH"))
    for page_name, image, width, height, scale in VISUALS:
        if WANTED and page_name not in WANTED:
            continue
        page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=scale)
        page.goto((HERE / page_name).as_uri())
        page.wait_for_load_state("networkidle")
        page.evaluate("document.fonts.ready.then(() => true)")  # polices chargées
        page.locator(".canvas").screenshot(path=HERE / image, omit_background=True)  # coins arrondis transparents
        page.close()
        print(f"{image} : {width * scale} × {height * scale}")
    browser.close()
