"""Le banc d'essai des maquettes 3D (guide 33) : une planche de photos de toutes les vitrines, sans lancer Streamlit.

Depuis le dossier finveille/ :
    python tools/vitrines_preview.py                          # toutes les maquettes, thème sombre
    python tools/vitrines_preview.py --kinds globe,coins --theme light --at 0.8 --out /tmp/planche.png
`--at` : l'instant du montage photographié, en secondes (par défaut 4 : les objets sont en place).
Il faut Playwright (pip install playwright) ; sans carte graphique, Chromium dessine avec SwiftShader (plus lent).
"""

import argparse
import functools
import http.server
import os
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
# chaque maquette a son contexte WebGL et le navigateur en accepte environ 16 : au plus 8 par planche
ALL = "city,globe,coins,orb,quiz,paper,bars,duel"


def main() -> None:
    parser = argparse.ArgumentParser(description="Photographie les maquettes 3D de FinVeille")
    parser.add_argument("--kinds", default=ALL, help="les maquettes, séparées par des virgules")
    parser.add_argument("--theme", choices=["dark", "light"], default="dark")
    parser.add_argument("--at", type=float, default=4.0, help="l'instant du montage, en secondes")
    parser.add_argument("--cols", type=int, default=4)
    parser.add_argument("--width", type=int, default=1600)
    parser.add_argument("--out", default="vitrines.png")
    args = parser.parse_args()

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):   # pas de journal des requêtes
            pass

    handler = functools.partial(Quiet, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}/tools/vitrines_preview.html?kinds={args.kinds}&theme={args.theme}&cols={args.cols}"
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH"),
                                    args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": args.width, "height": 900}, device_scale_factor=1)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: m.type in ("error", "warning") and errors.append(m.text))
        page.goto(url)
        page.wait_for_function("window.__ready && window.__fvObjs && window.__fvObjs.live && window.__fvObjs.live.size > 0",
                               timeout=60_000)
        page.wait_for_timeout(300)
        # le temps du montage avance image par image, puis la photo
        page.evaluate("""(at) => { for (const v of window.__fvObjs.live.values()) v.visible = true;
                                  for (let t = 0; t < at; t += 1 / 30) window.__fvObjs.tick(1000 / 30); }""", args.at)
        page.screenshot(path=args.out, full_page=True)
        browser.close()
    server.shutdown()
    print(f"{args.out} : {len(args.kinds.split(','))} maquettes")
    for line in errors:
        print("console :", line)


if __name__ == "__main__":
    main()
