"""Exporte les visuels de la marque en PNG (guide 26), depuis le dossier finveille/ :
    pip install playwright && playwright install chromium
    python docs/branding/render.py
CHROMIUM_PATH=/chemin/vers/chromium pour utiliser un Chromium déjà installé.
"""

import os
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
VISUALS = [  # (page HTML, image produite, largeur, hauteur, échelle)
    ("linkedin-banner.html", "linkedin-banner.png", 1584, 396, 2),  # LinkedIn accepte le double : plus net
    ("social-preview.html", "social-preview.png", 1280, 640, 1),  # GitHub : 1 Mo au plus
]

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH"))
    for page_name, image, width, height, scale in VISUALS:
        page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=scale)
        page.goto((HERE / page_name).as_uri())
        page.wait_for_load_state("networkidle")
        page.evaluate("document.fonts.ready.then(() => true)")  # polices chargées
        page.locator(".canvas").screenshot(path=HERE / image)
        page.close()
        print(f"{image} : {width * scale} × {height * scale}")
    browser.close()
