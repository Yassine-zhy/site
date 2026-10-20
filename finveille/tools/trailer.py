"""La bande-annonce de FinVeille (guide 31) : une vidéo de 40 s, filmée dans le vrai site, image par image.

Pourquoi image par image : un navigateur sans carte graphique dessine la 3D lentement (quelques images par seconde).
On arrête donc le temps : à chaque image, le moteur 3D avance de 1/30 s (window.__fv3d.tick), les animations CSS
aussi (Web Animations API), puis on prend une capture. La vidéo est fluide, quelle que soit la vitesse de la machine.

Depuis le dossier finveille/, le site étant lancé en local (streamlit run app.py) :
    python tools/trailer.py --url http://localhost:8501/ --out docs/branding/trailer.mp4
Il faut Playwright (pip install playwright) et ffmpeg. Compter 15 à 25 minutes.
"""

import argparse
import base64
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

FPS = 30
ROOT = Path(__file__).resolve().parent.parent
LOGO = base64.b64encode((ROOT / "assets" / "logo.svg").read_bytes()).decode()
PHONE = ROOT / "docs" / "screenshots" / "mobile-3d.jpg"

# Fait avancer d'un pas toutes les animations de la page (CSS et 3D) : la vidéo suit son propre temps
STEP = r"""(ms) => {
  const st = window.__tt ??= {seen: new Map(), t: 0};
  st.t += ms;
  for (const a of document.getAnimations()) {
    if (!(a.timeline instanceof DocumentTimeline)) continue;   // animations liées au défilement : déjà réglées
    if (!st.seen.has(a)) {
      const infinite = a.effect?.getComputedTiming().iterations === Infinity;
      st.seen.set(a, {base: infinite ? (a.currentTime || 0) : 0, start: st.t - ms});
      a.pause();
    }
    const r = st.seen.get(a);
    a.currentTime = r.base + (st.t - r.start);
  }
  if (window.__fv3d) window.__fv3d.tick(ms);
}"""

# Les sous-titres de la bande-annonce, posés sur la page filmée
CAPTION_CSS = """
#trailer-cap { position: fixed; left: 4.5vw; bottom: 7vh; z-index: 2000000; pointer-events: none; max-width: 46vw;
  font-family: "IBM Plex Sans", system-ui, sans-serif; transition: none; }
#trailer-cap::before { content: ""; position: fixed; left: 0; right: 0; bottom: 0; height: 34vh; z-index: -1;
  background: linear-gradient(0deg, rgba(4, 7, 14, .88), transparent); }
#trailer-cap small { display: block; margin-bottom: .55rem; font-size: 15px; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: #6ee7a8; }
#trailer-cap b { display: block; font-size: 44px; line-height: 1.08; font-weight: 700; letter-spacing: -.03em; color: #fff; }
#trailer-cap b em { font-style: normal; background: linear-gradient(90deg, #6d93ff, #a78bfa); -webkit-background-clip: text;
  background-clip: text; color: transparent; }
.fv-intro, [data-testid="stStatusWidget"], [data-testid="stDecoration"] { display: none !important; }
"""

CARD = """<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
html, body { margin: 0; height: 100%; background: #060912; color: #e8edf6; font-family: "IBM Plex Sans", sans-serif; overflow: hidden; }
.bg { position: fixed; inset: 0; background:
  radial-gradient(60% 70% at 72% 30%, rgba(109, 147, 255, .22), transparent 60%),
  radial-gradient(50% 60% at 20% 80%, rgba(167, 139, 250, .16), transparent 60%), #060912; }
.grid { position: fixed; inset: 0; opacity: .5;
  background-image: linear-gradient(rgba(42, 53, 80, .5) 1px, transparent 1px), linear-gradient(90deg, rgba(42, 53, 80, .5) 1px, transparent 1px);
  background-size: 48px 48px; mask-image: radial-gradient(70% 70% at 50% 50%, #000, transparent 85%);
  animation: drift 12s linear both; }
.wrap { position: relative; height: 100%; display: grid; place-items: center; text-align: center; }
.logo { width: 112px; height: 112px; border-radius: 30px; box-shadow: 0 30px 80px -20px rgba(36, 81, 222, .8);
  animation: pop .9s cubic-bezier(.2, .9, .2, 1.15) .1s both; }
h1 { margin: 34px 0 0; font-size: 104px; line-height: 1; letter-spacing: -.05em; font-weight: 700; animation: up .9s cubic-bezier(.2, .8, .2, 1) .35s both; }
h1 em { font-style: normal; background: linear-gradient(90deg, #6d93ff, #a78bfa); -webkit-background-clip: text; background-clip: text; color: transparent; }
p { margin: 22px 0 0; font-size: 34px; color: #96a2b9; animation: up .9s cubic-bezier(.2, .8, .2, 1) .7s both; }
p b { color: #fff; font-weight: 600; }
.line { width: 220px; height: 3px; margin: 34px auto 0; border-radius: 3px; background: rgba(42, 53, 80, .9); overflow: hidden; }
.line i { display: block; height: 100%; background: linear-gradient(90deg, #6d93ff, #6ee7a8); transform-origin: 0 50%;
  animation: load 1.6s cubic-bezier(.6, 0, .2, 1) .9s both; }
.chips { display: flex; gap: 14px; justify-content: center; margin-top: 30px; animation: up .9s cubic-bezier(.2, .8, .2, 1) 1.1s both; }
.chips span { padding: 10px 20px; border: 1px solid #2a3550; border-radius: 999px; font-size: 22px; color: #e8edf6; background: rgba(15, 22, 38, .8); }
.outro { display: grid; grid-template-columns: auto 1fr; gap: 80px; align-items: center; text-align: left; padding: 0 140px; }
.outro .phone { width: 300px; border-radius: 42px; border: 10px solid #141c2c; box-shadow: 0 40px 90px -30px rgba(0, 0, 0, .9), 0 0 0 1px #2a3550;
  animation: phone 1.1s cubic-bezier(.2, .8, .2, 1) .2s both; }
.outro h1 { font-size: 92px; margin-top: 0; }
.outro .who { font-size: 30px; color: #96a2b9; margin-top: 26px; }
.outro .who b { color: #fff; }
.outro .chips { justify-content: flex-start; }
@keyframes pop { from { opacity: 0; transform: scale(.6) rotate(-8deg); } }
@keyframes up { from { opacity: 0; transform: translateY(40px); filter: blur(8px); } }
@keyframes load { from { transform: scaleX(0); } }
@keyframes drift { from { transform: translateY(0); } to { transform: translateY(-96px); } }
@keyframes phone { from { opacity: 0; transform: translateY(60px) rotate(-4deg); } }
</style></head><body><div class="bg"></div><div class="grid"></div><div class="wrap">BODY</div></body></html>"""

INTRO = (f'<div><img class="logo" src="data:image/svg+xml;base64,{LOGO}" alt="">'
         "<h1>Fin<em>Veille</em></h1><p>L'actualité financière, <b>en 3D.</b></p>"
         '<div class="line"><i></i></div></div>')


def outro() -> str:
    phone = f'<img class="phone" src="data:image/jpeg;base64,{base64.b64encode(PHONE.read_bytes()).decode()}" alt="">' \
        if PHONE.exists() else ""
    return (f'<div class="outro">{phone}<div><h1>Fin<em>Veille</em></h1>'
            '<p class="who">Conçu et développé par <b>Yassine Zouhair</b></p>'
            '<div class="chips"><span>Python</span><span>Streamlit</span><span>Three.js</span><span>IA</span></div></div></div>')


class Recorder:
    def __init__(self, page, folder: Path):
        self.page, self.folder, self.count = page, folder, 0

    def frame(self):
        self.page.evaluate(STEP, 1000 / FPS)
        self.page.screenshot(path=str(self.folder / f"{self.count:05d}.jpg"), type="jpeg", quality=92)
        self.count += 1

    def hold(self, seconds: float, each=None):
        """Filme `seconds` secondes ; each(k, n) est appelé avant chaque image (défilement, souris…)."""
        n = round(seconds * FPS)
        for k in range(n):
            if each:
                each(k, n)
            self.frame()

    def caption(self, kicker: str, text: str):
        self.page.evaluate("""([kicker, text]) => {
          let cap = document.getElementById('trailer-cap');
          if (!cap) { cap = document.createElement('div'); cap.id = 'trailer-cap'; document.body.appendChild(cap); }
          cap.innerHTML = `<small>${kicker}</small><b>${text}</b>`;
          cap.animate([{opacity: 0, transform: 'translateY(24px)'}, {opacity: 1, transform: 'none'}],
                      {duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards'});
        }""", [kicker, text])


def ease(t: float) -> float:
    return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def card(context, html: str, folder: Path, start: int, seconds: float) -> int:
    page = context.new_page()
    page.set_content(CARD.replace("BODY", html))
    page.wait_for_timeout(1500)  # la police
    rec = Recorder(page, folder)
    rec.count = start
    page.evaluate("() => document.getAnimations().forEach(a => { a.pause(); a.currentTime = 0; })")
    rec.hold(seconds)
    page.close()
    return rec.count


def go(page, section: str, title: str):
    """Change de page par le menu du haut, comme un visiteur : le décor 3D passe d'une page à l'autre."""
    page.locator('[data-testid="stTopNavSection"]', has_text=section).first.click()
    page.locator('[data-testid="stTopNavDropdownLink"]', has_text=title).first.click()  # pas le lien du pied de page
    page.wait_for_function("() => window.__fv3d && window.__fv3d.key.includes('" + {
        "Marchés": "globe", "Crypto": "chain", "Simulateurs": "towers"}[title] + "')", timeout=60_000)
    for _ in range(60):  # la page a fini de s'afficher
        if not page.locator('[data-testid="stStatusWidget"]').count():
            break
        page.wait_for_timeout(500)
    page.wait_for_timeout(1500)


def main() -> None:
    parser = argparse.ArgumentParser(description="Bande-annonce de FinVeille")
    parser.add_argument("--url", default="http://localhost:8501/")
    parser.add_argument("--out", default=str(ROOT / "docs" / "branding" / "trailer.mp4"))
    args = parser.parse_args()
    folder = Path(tempfile.mkdtemp(prefix="trailer-"))
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH"),
                                    args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        context = browser.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=1.5,
                                      color_scheme="dark", locale="fr-FR")
        count = card(context, INTRO, folder, 0, 3.4)

        page = context.new_page()
        page.goto(args.url, timeout=120_000)
        page.add_style_tag(content=CAPTION_CSS)
        page.wait_for_selector("#fv3d.is-on", timeout=120_000)
        for _ in range(90):
            if not page.locator('[data-testid="stStatusWidget"]').count():
                break
            page.wait_for_timeout(1000)
        page.add_style_tag(content=CAPTION_CSS)
        page.mouse.move(640, 300)
        rec = Recorder(page, folder)
        rec.count = count
        page.evaluate("() => { window.__fv3d.tick(16); window.__fv3d.replay(); }")
        main_area = "document.querySelector('[data-testid=stMain]')"

        # 1. La ville du CAC 40 se construit
        rec.caption("01 — Le fil", "Le CAC 40 <em>en 3D</em>, en direct.")
        rec.hold(5.5, lambda k, n: page.mouse.move(640 + 160 * k / n, 300 - 40 * k / n))
        # 2. Survol d'une tour : son nom et sa séance
        rec.caption("Survole une tour", "Son nom, <em>sa séance.</em>")
        rec.hold(3.2, lambda k, n: page.mouse.move(905 + 30 * ease(k / n), 300 + 12 * ease(k / n)))
        # 3. Le défilement : la ville passe aux rayons X, le fil apparaît
        rec.caption("Au défilement", "La ville passe <em>aux rayons X.</em>")
        rec.hold(4.5, lambda k, n: page.evaluate(f"{main_area}.scrollTo(0, {720 * ease(k / n):.0f})"))
        rec.caption("L'actualité", "Classée, <em>expliquée</em>, sourcée.")
        rec.hold(3, lambda k, n: page.mouse.move(380 + 120 * k / n, 470 - 30 * k / n))
        page.evaluate(f"{main_area}.scrollTo(0, 0)")

        # 4. Marchés : les particules quittent la ville et forment le globe
        go(page, "Marchés", "Marchés")
        page.add_style_tag(content=CAPTION_CSS)
        rec.caption("02 — Marchés", "Les places boursières, <em>en un coup d'œil.</em>")
        rec.hold(5.5, lambda k, n: page.mouse.move(700 + 120 * k / n, 320))
        rec.hold(2.5, lambda k, n: page.evaluate(f"{main_area}.scrollTo(0, {380 * ease(k / n):.0f})"))
        page.evaluate(f"{main_area}.scrollTo(0, 0)")

        # 5. Crypto : la chaîne du bitcoin, un bloc par jour
        go(page, "Marchés", "Crypto")
        page.add_style_tag(content=CAPTION_CSS)
        rec.caption("03 — Crypto", "Le bitcoin, <em>bloc par bloc.</em>")
        rec.hold(5, lambda k, n: page.mouse.move(800 - 100 * k / n, 300))

        # 6. Simulateurs : l'escalier des intérêts composés
        go(page, "Outils", "Simulateurs")
        page.add_style_tag(content=CAPTION_CSS)
        rec.caption("04 — Outils", "Les intérêts composés, <em>en escalier.</em>")
        rec.hold(4, lambda k, n: page.mouse.move(700, 300 + 40 * k / n))
        page.close()

        count = card(context, outro(), folder, rec.count, 4.6)
        browser.close()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", str(folder / "%05d.jpg"),
                    "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow",
                    "-crf", "19", "-movflags", "+faststart", args.out], check=True)
    shutil.rmtree(folder)
    print(f"{args.out} : {count} images, {count / FPS:.1f} s")


if __name__ == "__main__":
    main()
