"""Les images de la bande-annonce (guide 32) : des séquences filmées dans le vrai site, image par image, et les chiffres
de la séance. Le montage, lui, est fait avec Remotion (dossier video/).

Pourquoi image par image : un navigateur sans carte graphique dessine la 3D lentement. On arrête donc le temps : à
chaque image, le moteur 3D avance de 1/30 s (window.__fv3d.tick), les animations CSS aussi (Web Animations API), GSAP
aussi (gsap.updateRoot), puis on prend une capture. Les séquences sont fluides, quelle que soit la machine.

Depuis le dossier finveille/, le site étant lancé en local (streamlit run app.py) :
    python tools/footage.py --url http://localhost:8501/      # écrit video/public/footage/*.mp4 et data.json
    cd video && npx remotion render Trailer out/trailer.mp4  # le montage
Il faut Playwright (pip install playwright) et ffmpeg. Compter une quinzaine de minutes.
"""

import argparse
import json
import os
import shutil
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

FPS = 30
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "video" / "public" / "footage"

# Fait avancer d'un pas toutes les animations de la page (CSS, GSAP, 3D) : la séquence suit son propre temps
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
  if (window.gsap) {
    if (st.g0 === undefined) { window.gsap.ticker.remove(window.gsap.updateRoot); st.g0 = window.gsap.ticker.time; }
    window.gsap.updateRoot(st.g0 + st.t / 1000);
  }
  if (window.__fv3d) window.__fv3d.tick(ms);
}"""
HIDE = ".fv-intro, [data-testid='stStatusWidget'], [data-testid='stDecoration'] { display: none !important; }"
MAIN = "document.querySelector('[data-testid=stMain]')"


def ease(t: float) -> float:
    return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


class Clip:
    """Une séquence : des images numérotées dans un dossier temporaire, puis un MP4."""

    def __init__(self, page, name: str):
        self.page, self.name = page, name
        self.folder = Path(tempfile.mkdtemp(prefix=f"clip-{name}-"))
        self.count = 0

    def hold(self, seconds: float, each=None):
        n = round(seconds * FPS)
        for k in range(n):
            if each:
                each(k, n)
            self.page.evaluate(STEP, 1000 / FPS)
            self.page.screenshot(path=str(self.folder / f"{self.count:05d}.jpg"), type="jpeg", quality=93)
            self.count += 1
        return self

    def save(self):
        OUT.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", str(self.folder / "%05d.jpg"),
                        "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow",
                        "-crf", "18", "-movflags", "+faststart", str(OUT / f"{self.name}.mp4")], check=True)
        shutil.rmtree(self.folder)
        print(f"{self.name}.mp4 : {self.count / FPS:.1f} s", flush=True)


def settle(page):
    """Attend que la page ait fini de s'exécuter (plus de bouton « Stop »)."""
    for _ in range(120):
        if not page.locator('[data-testid="stStatusWidget"]').count():
            break
        page.wait_for_timeout(500)
    page.wait_for_timeout(800)


def go(page, section: str, title: str, scene: str):
    """Change de page par le menu du haut, comme un visiteur : les particules passent d'un décor à l'autre."""
    page.locator('[data-testid="stTopNavSection"]', has_text=section).first.click()
    page.locator('[data-testid="stTopNavDropdownLink"]', has_text=title).first.click()
    page.wait_for_function(f"() => window.__fv3d && window.__fv3d.key.includes('{scene}')", timeout=90_000)
    settle(page)
    page.add_style_tag(content=HIDE)


def story_scroll(page, progress: float) -> int:
    """La position de défilement qui affiche le récit de l'accueil à `progress` (0 : la séance, 1 : la fin)."""
    return page.evaluate("""(p) => {
      const story = document.querySelector('.fv-story'), stage = story.querySelector('.fv-story-stage');
      const sc = document.querySelector('[data-testid=stMain]');
      const span = story.offsetHeight - stage.offsetHeight, stuck = parseFloat(getComputedStyle(stage).top) || 0;
      const top = story.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
      return Math.round(top - stuck + p * span);
    }""", progress)


def scroll_between(page, start: int, end: int):
    return lambda k, n: page.evaluate(f"{MAIN}.scrollTo(0, {start + (end - start) * ease(k / max(1, n - 1)):.0f})")


def market_data() -> dict:
    """Les chiffres de la séance pour la vidéo : le CAC 40, ses plus fortes hausses et baisses."""
    import sys
    sys.path.insert(0, str(ROOT))
    from core import market

    quotes = market.fetch_quotes([(s, n, sector, "%") for s, n, sector in market.CAC40])
    index = next(iter(market.fetch_quotes([("^FCHI", "CAC 40", "Europe", "%")])), None)
    ranked = sorted(quotes, key=lambda q: q.change, reverse=True)
    pick = lambda qs: [{"name": q.name, "change": round(q.change, 2)} for q in qs]
    return {"date": datetime.now().strftime("%Y-%m-%d"), "index": round(index.last, 2) if index else None,
            "change": round(index.change, 2) if index else None, "up": sum(q.change > 0 for q in quotes),
            "down": sum(q.change <= 0 for q in quotes), "top": pick(ranked[:5]), "bottom": pick(ranked[::-1][:5])}


def main() -> None:
    parser = argparse.ArgumentParser(description="Séquences filmées pour la bande-annonce de FinVeille")
    parser.add_argument("--url", default="http://localhost:8501/")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT.parent / "data.json").write_text(json.dumps(market_data(), ensure_ascii=False, indent=1))
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH"),
                                    args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        context = browser.new_context(viewport={"width": 1600, "height": 900}, device_scale_factor=1.2,
                                      color_scheme="dark", locale="fr-FR")
        page = context.new_page()
        page.goto(args.url, timeout=180_000)
        page.wait_for_selector(".fv-story", timeout=180_000)
        page.wait_for_selector("#fv3d.is-on", timeout=180_000)
        settle(page)
        page.add_style_tag(content=HIDE)
        page.mouse.move(800, 420)
        page.wait_for_timeout(1500)
        page.evaluate("() => { window.__fv3d.tick(16); window.__fv3d.replay(); }")

        # 1. Le récit de la séance : la ville se construit, puis un chapitre après l'autre
        at = [story_scroll(page, p) for p in (0.0, 0.37, 0.62, 0.88, 1.0)]
        clip = Clip(page, "story").hold(3.2)
        for a, b in zip(at[:3], at[1:4]):
            clip.hold(1.3, scroll_between(page, a, b)).hold(2.2)
        clip.save()
        # 2. Le fil : on quitte le récit, les dépêches s'impriment
        Clip(page, "feed").hold(4.5, scroll_between(page, at[3], at[4] + 820)).save()
        page.evaluate(f"{MAIN}.scrollTo(0, 0)")
        # 3. Marchés : les particules quittent la ville et forment le globe
        go(page, "Marchés", "Marchés", "globe")
        Clip(page, "markets").hold(5.5, lambda k, n: page.mouse.move(760 + 140 * k / n, 360)).save()
        # 4. Crypto : la chaîne du bitcoin, un bloc par jour
        go(page, "Marchés", "Crypto", "chain")
        Clip(page, "crypto").hold(4.5, lambda k, n: page.mouse.move(900 - 120 * k / n, 330)).save()
        # 5. L'assistant : une vraie question, une vraie réponse, qui cite ses sources
        go(page, "Actualité", "Assistant IA", "orb")
        page.locator(".st-key-fvsuggest button").first.click()
        page.wait_for_timeout(1500)
        settle(page)
        top = page.evaluate("() => { const m = document.querySelector('.st-key-fvchatlog [data-testid=stChatMessage]');"
                            f" return m ? m.getBoundingClientRect().top + {MAIN}.scrollTop - 110 : 0; }}")
        Clip(page, "ai").hold(4.5, scroll_between(page, int(top), int(top) + 260)).save()
        browser.close()


if __name__ == "__main__":
    main()
