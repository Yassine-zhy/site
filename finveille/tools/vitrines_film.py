"""Le tournage des maquettes 3D pour la bande-annonce : un plan MP4 par maquette, en 1920×1080.

Depuis le dossier finveille/ :
    python tools/vitrines_film.py                              # les 17 maquettes → video/public/models/<nom>.mp4
    python tools/vitrines_film.py --kinds globe,bell --frames 30 --out /tmp/plans
Chaque maquette s'ouvre seule, en plein cadre, sur le noir nuit de la vidéo (tools/vitrines_preview.html?film=1). Elle
monte jusqu'au bout, puis 75 images (2,5 s à 30 im/s) la montrent en lente rotation (de -0,2 à +0,2 rad, départ et
arrivée adoucis) ; ffmpeg assemble les images en H.264.
Il faut Playwright (pip install playwright) et ffmpeg ; sans carte graphique, Chromium dessine avec SwiftShader
(1 à 3 s par image). Pour un autre Chromium : CHROMIUM_PATH=/chemin/vers/chrome.
"""

import argparse
import functools
import http.server
import os
import subprocess
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ALL = "city,globe,coins,orb,quiz,paper,bars,duel,ring,stairs,ridges,bell,lens,bookmark,books,gear,logo"
FPS = 30
SIZE = (1920, 1080)


def film(browser, base: str, kind: str, frames: int, out: Path) -> list[str]:
    """Tourne une maquette ; renvoie les messages de la console."""
    errors = []
    page = browser.new_page(viewport={"width": SIZE[0], "height": SIZE[1]}, device_scale_factor=1)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type in ("error", "warning") and errors.append(m.text))
    ffmpeg = None
    try:
        page.goto(f"{base}/tools/vitrines_preview.html?kinds={kind}&film=1")
        page.wait_for_function("window.__ready && window.__fvObjs && window.__fvObjs.live && window.__fvObjs.live.size > 0",
                               timeout=60_000)
        page.wait_for_timeout(300)
        # le montage : le temps avance par pas de 100 ms jusqu'à l'objet en place (la souris reste hors de la fenêtre)
        mounted = page.evaluate("""() => { const v = [...window.__fvObjs.live.values()][0];
            for (let i = 0; i < 200 && v.t < 99; i++) window.__fvObjs.tick(100);
            return v.t === 99; }""")
        if not mounted:
            errors.append("le montage n'a pas fini")
        ffmpeg = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
             "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", "-r", str(FPS),
             "-movflags", "+faststart", str(out)], stdin=subprocess.PIPE)
        for k in range(frames):
            # la rotation est imposée : yaw = yawGoal (pas de retard lissé) et plus d'élan (spin) ; sans pointeur
            # (la souris n'a jamais bougé), la parallaxe de vitrines.js reste nulle
            page.evaluate("""([k, n]) => { const v = [...window.__fvObjs.live.values()][0];
                const x = n > 1 ? k / (n - 1) : 0, e = x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
                v.spin = 0; v.yaw = v.yawGoal = -0.2 + 0.4 * e; v.dirty = true;
                window.__fvObjs.tick(1000 / 30); }""", [k, frames])
            ffmpeg.stdin.write(page.screenshot(type="jpeg", quality=95, timeout=300_000))
        ffmpeg.stdin.close()
        if ffmpeg.wait() != 0:
            errors.append("ffmpeg a échoué")
    finally:
        if ffmpeg and ffmpeg.poll() is None:
            ffmpeg.kill()
        page.close()
    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Filme les maquettes 3D de FinVeille (un MP4 par maquette)")
    parser.add_argument("--kinds", default=ALL, help="les maquettes, séparées par des virgules")
    parser.add_argument("--frames", type=int, default=75, help="le nombre d'images par plan (30 par seconde)")
    parser.add_argument("--out", default=str(ROOT / "video" / "public" / "models"), help="le dossier des MP4")
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):   # pas de journal des requêtes
            pass

    handler = functools.partial(Quiet, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH"),
                                    args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        for kind in args.kinds.split(","):
            start = time.time()
            errors = film(browser, base, kind, args.frames, out / f"{kind}.mp4")   # la page se ferme entre deux maquettes
            print(f"{kind}.mp4 : {args.frames} images en {time.time() - start:.0f} s")
            for line in errors:
                print("  console :", line)
        browser.close()
    server.shutdown()


if __name__ == "__main__":
    main()
