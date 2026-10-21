"""Les images de la bande-annonce (guides 32 à 34) : des séquences filmées dans le vrai site, image par image. Le
montage, lui, est fait avec Remotion (dossier video/), sur la musique de tools/music.py.

Pourquoi image par image : un navigateur sans carte graphique dessine la 3D lentement. On arrête donc le temps : à
chaque image, le décor 3D avance de 1/30 s (window.__fv3d.tick), les maquettes aussi (window.__fvObjs.tick), les
animations CSS aussi (Web Animations API), GSAP aussi (gsap.updateRoot), puis on prend une capture. Les séquences sont
fluides, quelle que soit la machine.

Étape 34 : la bande-annonce montre le site, plus la séance du jour (plus de chiffres). Seize séquences, écrites dans
video/public/footage/ (MP4 à 30 images par seconde, 1920×1080 sauf `mobile`, en 1080 de large) :
    story       l'accueil : la ville du CAC 40 se construit, une tour s'allume en vert       6 s
    feed        la descente dans le fil, les dépêches s'impriment                            4 s
    search      « Sanofi » tapé lettre à lettre dans le fil, puis les résultats              4 s
    brief       Le brief, en-tête puis descente                                              3 s
    ai          l'assistant : une question suggérée, la réponse et ses sources               4,5 s
    globe       Marchés : le globe tourne à la main, clic sur l'épingle du CAC 40, sa tuile  5 s
    heatmap     Marchés : la carte du CAC 40, survol d'une case                              3 s
    economy     Économie : les courbes des taux en relief, survol d'un ruban                 3 s
    crypto      Crypto : les pièces tombent, descente vers le classement                     4,5 s
    compare     Comparer : le graphique, descente                                            3 s
    portfolio   Portefeuille : l'anneau se monte, descente vers les positions                3 s
    alerts      Alertes : clic sur la cloche, elle sonne, descente vers le formulaire        4 s
    simulators  Simulateurs : descente jusqu'au premier graphique                            3 s
    glossary    Glossaire : clic sur un livre, le résultat (séquence de réserve)             4 s
    light       thème clair : Marchés et son globe                                           3 s
    mobile      téléphone (390×844) : la ville se monte, défilement dans le récit            4 s
Le curseur de la souris n'apparaît pas dans les captures : quand la souris compte, sa position à chaque image est
écrite dans <nom>.cursor.json, une liste de [image, x, y, bouton_enfoncé] en pixels de la vidéo (1,2 × les pixels CSS).
Pour une séquence avec un clic, <nom>.events.json donne {"click": image} : la première image où le bouton est enfoncé.

Depuis le dossier finveille/, le site étant lancé en local (streamlit run app.py) :
    python tools/footage.py --url http://localhost:8501/             # toutes les séquences
    python tools/footage.py --url http://localhost:8501/ --only story,globe
    cd video && npx remotion render Trailer out/trailer.mp4          # le montage
Il faut Playwright (pip install playwright) et ffmpeg. Compter une heure pour tout tourner (la page Crypto met à
elle seule une minute à afficher ses pièces).
"""

import argparse
import json
import os
import shutil
import subprocess
import tempfile
import traceback
from pathlib import Path

from playwright.sync_api import sync_playwright

FPS = 30
SCALE = 1.2   # pixels de la vidéo par pixel CSS (la page fait 1600×900 pour une vidéo de 1920×1080)
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
  if (window.__fvObjs && window.__fvObjs.tick) window.__fvObjs.tick(ms);
}"""
HIDE = ".fv-intro, [data-testid='stStatusWidget'], [data-testid='stDecoration'] { display: none !important; }"
MAIN = "document.querySelector('[data-testid=stMain]')"

# Les points d'une maquette où le pointeur touche quelque chose : une grille de points normalisés (0-1) passée à
# v.pick, en pixels écran. `key` : seulement les parties de cette clé ; `all` : compter aussi l'objet entier.
HITS = r"""([kind, key, n, region, all]) => {
  const v = [...window.__fvObjs.live.values()].find((o) => o.kind === kind && o.el.isConnected);
  if (!v) return [];
  const box = v.el.getBoundingClientRect(), [x0, y0, x1, y1] = region, found = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) / n * (x1 - x0), y = y0 + (j + 0.5) / n * (y1 - y0), hit = v.pick(x, y);
    if (hit && (all || hit.id !== 'all') && (key === null || hit.key === key))
      found.push({x: box.left + x * box.width, y: box.top + y * box.height, id: hit.id, text: hit.text, key: hit.key});
  }
  v.pick(null);
  return found;
}"""
DESKTOP = dict(viewport={"width": 1600, "height": 900}, device_scale_factor=1.2, color_scheme="dark", locale="fr-FR")
CONTEXTS = {
    "dark": DESKTOP,
    "light": {**DESKTOP, "color_scheme": "light"},
    "phone": dict(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True,
                  color_scheme="dark", locale="fr-FR"),
}
SEQUENCES = {}   # nom -> (contexte, fonction), dans l'ordre tourné


def ease(t: float) -> float:
    return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


class Pointer:
    """La souris : sa position et son bouton, enregistrés à chaque image par le Clip (le curseur n'est pas filmé)."""

    def __init__(self, page, x: float, y: float):
        self.page, self.x, self.y, self.down = page, x, y, False
        page.mouse.move(x, y)

    def move(self, x: float, y: float):
        if (round(x), round(y)) != (round(self.x), round(self.y)):
            self.page.mouse.move(x, y)
        self.x, self.y = x, y

    def press(self):
        self.page.mouse.down()
        self.down = True

    def release(self):
        self.page.mouse.up()
        self.down = False


class Clip:
    """Une séquence : des images numérotées dans un dossier temporaire, puis un MP4 (et, si besoin, le curseur)."""

    def __init__(self, page, name: str, pointer: Pointer | None = None):
        self.page, self.name, self.pointer = page, name, pointer
        self.folder = Path(tempfile.mkdtemp(prefix=f"clip-{name}-"))
        self.count = 0
        self.cursor, self.events = [], {}

    def hold(self, seconds: float, each=None):
        n = round(seconds * FPS)
        for k in range(n):
            if each:
                each(k, n)
            if self.pointer:
                p = self.pointer
                self.cursor.append([self.count, round(p.x * SCALE), round(p.y * SCALE), int(p.down)])
            self.page.evaluate(STEP, 1000 / FPS)
            self.page.screenshot(path=str(self.folder / f"{self.count:05d}.jpg"), type="jpeg", quality=93)
            self.count += 1
        return self

    def until(self, seconds: float, each=None):
        """Tient jusqu'à ce que la séquence dure `seconds` en tout."""
        return self.hold(max(0.0, seconds - self.count / FPS), each)

    def mark(self, event: str):
        """Note l'image où commence un événement (le clic) : le montage y place son bruit."""
        self.events[event] = self.count

    def save(self, size: tuple[int, int] = (1920, 1080)):
        """Encode en MP4 à la taille `size` (largeur, hauteur ; -2 : hauteur déduite en gardant les proportions)."""
        OUT.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", str(self.folder / "%05d.jpg"),
                        "-vf", f"scale={size[0]}:{size[1]}:flags=lanczos,format=yuv420p", "-c:v", "libx264",
                        "-preset", "slow", "-crf", "18", "-movflags", "+faststart", str(OUT / f"{self.name}.mp4")],
                       check=True)
        if self.pointer:
            (OUT / f"{self.name}.cursor.json").write_text(json.dumps(self.cursor, separators=(",", ":")))
        if self.events:
            (OUT / f"{self.name}.events.json").write_text(json.dumps(self.events))
        shutil.rmtree(self.folder)
        print(f"{self.name}.mp4 : {self.count / FPS:.1f} s", flush=True)


def advance(page, seconds: float):
    """Laisse passer du temps de séquence sans rien filmer (une caméra 3D qui finit de se placer)."""
    for _ in range(round(seconds * FPS)):
        page.evaluate(STEP, 1000 / FPS)


def settle(page):
    """Attend que la page ait fini de s'exécuter (plus de bouton « Stop »)."""
    for _ in range(120):
        if not page.locator('[data-testid="stStatusWidget"]').count():
            break
        page.wait_for_timeout(500)
    page.wait_for_timeout(800)


def rewind(page, obj: str):
    """Remonte le montage de la maquette `obj` : un objet vu il y a peu ne rejouerait pas sa construction."""
    page.evaluate("""(kind) => { for (const v of window.__fvObjs.live.values()) if (v.kind === kind) { v.t = 0; v.dirty = true; } }""", obj)


def go(page, section: str, title: str, obj: str):
    """Change de page par le menu du haut, comme un visiteur, et attend que la maquette `obj` de l'en-tête soit là."""
    page.locator('[data-testid="stTopNavSection"]', has_text=section).first.click()
    page.locator('[data-testid="stTopNavDropdownLink"]', has_text=title).first.click()
    page.wait_for_function(f"""() => [...(window.__fvObjs?.live?.values() || [])]
                                     .some((v) => v.kind === '{obj}' && v.el.isConnected)""", timeout=300_000)
    settle(page)
    page.add_style_tag(content=HIDE)
    page.evaluate(f"{MAIN}.scrollTo(0, 0)")
    rewind(page, obj)


def center(page, obj: str) -> tuple[float, float]:
    """Le centre d'une maquette à l'écran."""
    box = page.locator(f'.fv-obj[data-obj="{obj}"]').first.bounding_box()
    return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2


def story_scroll(page, progress: float) -> int:
    """La position de défilement qui affiche le récit de l'accueil à `progress` (0 : la séance, 1 : la fin)."""
    return page.evaluate("""(p) => {
      const story = document.querySelector('.fv-story'), stage = story.querySelector('.fv-story-stage');
      const sc = document.querySelector('[data-testid=stMain]');
      const span = story.offsetHeight - stage.offsetHeight, stuck = parseFloat(getComputedStyle(stage).top) || 0;
      const top = story.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
      return Math.round(top - stuck + p * span);
    }""", progress)


def section_scroll(page, *selectors: str, gap: int = 110) -> int:
    """La position de défilement qui amène en haut de l'écran le premier élément trouvé. Un sélecteur peut être le
    titre d'une section (« h2:La carte du CAC 40 ») ou un h3 (« h3:Connecte-toi »)."""
    top = page.evaluate("""([selectors, gap]) => {
      const sc = document.querySelector('[data-testid=stMain]');
      for (const s of selectors) {
        const [css, text] = s.startsWith('h2:') ? ['.fv-section h2', s.slice(3)] : s.startsWith('h3:') ? ['h3', s.slice(3)] : [s, ''];
        const el = [...document.querySelectorAll(css)].find((e) => e.textContent.trim().startsWith(text));
        if (el) return Math.round(sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top - gap);
      }
      return null;
    }""", [list(selectors), gap])
    if top is None:
        raise RuntimeError(f"rien à atteindre parmi {selectors}")
    return max(0, top)


def scroll_to(page, top: int):
    page.evaluate(f"{MAIN}.scrollTo(0, {top})")


def scroll_between(page, start: int, end: int):
    return lambda k, n: page.evaluate(f"{MAIN}.scrollTo(0, {start + (end - start) * ease(k / max(1, n - 1)):.0f})")


def scroll_top(page) -> int:
    return page.evaluate(f"Math.round({MAIN}.scrollTop)")


def glide(pointer: Pointer, x: float, y: float, start: float = 0.0, end: float = 1.0):
    """La souris va (depuis où elle est) en (x, y) pendant une tenue, entre les fractions `start` et `end` de sa durée."""
    x0, y0 = pointer.x, pointer.y

    def each(k, n):
        t = ease(min(1.0, max(0.0, (k / max(1, n - 1) - start) / max(1e-6, end - start))))
        pointer.move(x0 + (x - x0) * t, y0 + (y - y0) * t)
    return each


def hits(page, kind: str, key: str | None = None, n: int = 28, region=(0, 0, 1, 1), all: bool = False) -> list[dict]:
    """Les points de l'écran (en pixels CSS) où la maquette `kind` répond au pointeur."""
    return page.evaluate(HITS, [kind, key, n, list(region), all])


def nearest(points: list[dict], x: float, y: float) -> dict | None:
    return min(points, key=lambda p: (p["x"] - x) ** 2 + (p["y"] - y) ** 2, default=None)


def click(clip: Clip):
    """Un vrai clic de souris à l'endroit où elle est : appuyé deux images, puis relâché (l'image du clic est l'appui)."""
    clip.mark("click")
    clip.pointer.press()
    clip.hold(2 / FPS)
    clip.pointer.release()


def scroller(page):
    """Le défilement d'un clic sur une maquette se fait ici image par image : on note où la page doit aller."""
    page.evaluate("() => { window.__fvGoal = null; window.__fvObjs.scroller = (main, top) => { window.__fvGoal = top; }; }")


def goal(page) -> int | None:
    """Où le clic voulait faire défiler la page (et on rend la main au site)."""
    top = page.evaluate("() => { const g = window.__fvGoal; delete window.__fvObjs.scroller; return g; }")
    if top is None:
        print("  ATTENTION : le clic n'a mené nulle part", flush=True)
    return top


def sequence(name: str, context: str = "dark"):
    def register(fn):
        SEQUENCES[name] = (context, fn)
        return fn
    return register


# --- Les séquences ----------------------------------------------------------------------------------------------------
@sequence("story")
def story(page):
    """L'accueil : la ville du CAC 40 se construit, puis le récit défile jusqu'au chapitre de la hausse."""
    scroll_to(page, 0)
    page.evaluate("""() => { window.__fv3d.replay(); for (const v of window.__fvObjs.live.values()) v.t = 0; }""")
    Pointer(page, 800, 420)
    a, b = story_scroll(page, 0.0), story_scroll(page, 0.4)
    Clip(page, "story").hold(2.5).hold(1.3, scroll_between(page, a, b)).until(6.0).save()


@sequence("feed")
def feed(page):
    """Depuis la fin du récit, la descente dans le fil : les dépêches s'impriment."""
    Pointer(page, 800, 420)
    start = story_scroll(page, 0.96)
    scroll_to(page, start)
    advance(page, 1.0)   # la caméra de la ville finit de se placer sur le dernier chapitre
    Clip(page, "feed").hold(4.0, scroll_between(page, start, story_scroll(page, 1.0) + 820)).save()


@sequence("search")
def search(page):
    """« Sanofi » se tape dans le champ du fil, lettre après lettre ; on descend aux résultats."""
    field = page.locator('[data-testid="stTextInput"] input[placeholder^="Rechercher"]').first
    page.evaluate(f"""() => {{ const f = document.querySelector('[data-testid="stTextInput"] input[placeholder^="Rechercher"]');
      {MAIN}.scrollTo(0, {MAIN}.scrollTop + f.getBoundingClientRect().top - 330); }}""")
    box = field.bounding_box()
    x, y = box["x"] + box["width"] * 0.35, box["y"] + box["height"] / 2
    pointer = Pointer(page, 800, 420)
    clip = Clip(page, "search", pointer)
    clip.hold(0.3, glide(pointer, x, y))
    click(clip)
    clip.hold(0.2)
    page.keyboard.press("Control+A")
    word = "Sanofi"
    clip.hold(len(word) * 4 / FPS, lambda k, n: page.keyboard.type(word[k // 4]) if k % 4 == 0 else None)
    clip.hold(0.2)
    page.keyboard.press("Enter")
    settle(page)   # le temps de la séquence est arrêté pendant le recalcul : la coupe est invisible
    here = scroll_top(page)
    clip.hold(1.0, scroll_between(page, here, section_scroll(page, "#fv-fil", gap=90)))
    clip.until(4.0).save()


@sequence("brief")
def brief(page):
    go(page, "Actualité", "Le brief", "paper")
    Pointer(page, 800, 420)
    Clip(page, "brief").hold(0.8).hold(2.2, scroll_between(page, 0, 500)).save()


@sequence("ai")
def ai(page):
    """L'assistant : on tape une vraie question, il répond, et cite ses sources (la vraie réponse du site)."""
    go(page, "Actualité", "Assistant IA", "orb")
    field = page.locator('[data-testid="stChatInputTextArea"]').first
    field.scroll_into_view_if_needed()
    settle(page)
    box = field.bounding_box()
    pointer = Pointer(page, 800, 420)
    clip = Clip(page, "ai", pointer)
    clip.hold(0.4, glide(pointer, box["x"] + 80, box["y"] + box["height"] / 2))
    click(clip)
    question = "Qu'est-ce qui fait bouger le CAC 40 aujourd'hui ?"
    clip.mark("typing")
    clip.hold(len(question) / FPS, lambda k, n: page.keyboard.type(question[k]))   # une lettre par image
    clip.hold(0.2)
    clip.mark("send")
    page.keyboard.press("Enter")
    page.wait_for_timeout(1500)
    settle(page)   # la réponse s'écrit ; le temps de la vidéo, lui, est arrêté
    page.wait_for_timeout(1500)
    asked = page.evaluate("""() => { const all = document.querySelectorAll('.st-key-fvchatlog [data-testid=stChatMessage]');
      const m = all[all.length - 2] || all[0]; return m ? m.getBoundingClientRect().top + MAIN_TOP : 0; }"""
                          .replace("MAIN_TOP", f"{MAIN}.scrollTop - 110"))
    scroll_to(page, int(asked))
    clip.mark("answer")
    clip.hold(1.2).hold(2.4, scroll_between(page, int(asked), int(asked) + 360)).save()


def chase_pin(page, pointer: Pointer, key: str, state: dict, t: float = 1.0):
    """Mène la souris vers l'épingle `key` du globe, qui bouge encore un peu : on la retrouve à chaque image."""
    last = state.get("at")
    region = (0, 0, 1, 1)
    if last:   # autour de la dernière position, en coordonnées de la maquette
        box = page.locator('.fv-obj[data-obj="globe"]').first.bounding_box()
        u, v = (last[0] - box["x"]) / box["width"], (last[1] - box["y"]) / box["height"]
        region = (max(0, u - 0.12), max(0, v - 0.12), min(1, u + 0.12), min(1, v + 0.12))
    found = hits(page, "globe", key, n=14 if last else 30, region=region) or hits(page, "globe", key)
    if not found:
        raise RuntimeError(f"l'épingle « {key} » n'est pas à l'écran")
    pin = nearest(found, sum(p["x"] for p in found) / len(found), sum(p["y"] for p in found) / len(found))
    state["at"] = (pin["x"], pin["y"])
    state["start"] = state.get("start") or (pointer.x, pointer.y)
    x0, y0 = state["start"]
    pointer.move(x0 + (pin["x"] - x0) * t, y0 + (pin["y"] - y0) * t)


@sequence("globe")
def globe(page):
    """Marchés : le globe se monte, tourne à la main, la souris trouve l'épingle du CAC 40 et clique ; la page descend."""
    go(page, "Marchés", "Marchés", "globe")
    x, y = center(page, "globe")
    pointer = Pointer(page, x - 430, y + 150)   # hors du globe : pas d'étiquette pendant le montage
    clip = Clip(page, "globe", pointer)
    clip.hold(1.6, glide(pointer, x + 70, y, 0.3, 1.0))
    pointer.press()   # on tourne le globe en le tirant
    clip.hold(1.0, glide(pointer, x - 10, y))
    pointer.release()
    state = {}
    clip.hold(0.3, lambda k, n: chase_pin(page, pointer, "CAC 40", state, ease(k / max(1, n - 1))))
    state["start"] = None
    clip.hold(0.4, lambda k, n: chase_pin(page, pointer, "CAC 40", state))   # l'étiquette s'affiche
    scroller(page)
    click(clip)
    clip.hold(0.1)
    here, there = scroll_top(page), goal(page)
    if there is not None:
        clip.hold(1.0, scroll_between(page, here, there))
    clip.until(5.0).save()


@sequence("heatmap")
def heatmap(page):
    """Marchés : la carte du CAC 40 ; la souris se pose sur une case. (Son infobulle est celle du navigateur, qu'une
    capture ne dessine pas : on ne la contrefait pas, la bande-annonce ne montre que ce que le site affiche.)"""
    if not page.locator('.fv-obj[data-obj="globe"]').count():   # sinon on est déjà sur Marchés (après le globe)
        go(page, "Marchés", "Marchés", "globe")
    scroll_to(page, 0)
    page.locator('[data-testid="stButtonGroup"] button', has_text="CAC 40").first.click()   # la vue « CAC 40 »
    page.wait_for_function("""() => [...document.querySelectorAll('.fv-section h2')]
                                   .some((h) => h.textContent.trim().startsWith('La carte du CAC 40'))""", timeout=120_000)
    settle(page)
    pointer = Pointer(page, 800, 420)
    clip = Clip(page, "heatmap", pointer)
    here = 0
    there = section_scroll(page, "h2:La carte du CAC 40", gap=120)
    clip.hold(1.2, scroll_between(page, here, there))
    cell = page.evaluate("""() => {   // la case la plus teintée, bien à l'écran
      const cells = [...document.querySelectorAll('.fv-cell')].map((c) => ({r: c.getBoundingClientRect(),
        a: parseFloat(c.style.getPropertyValue('--a'))})).filter((o) => o.r.top > 260 && o.r.bottom < 720
        && o.r.left > 380 && o.r.right < 1400).sort((p, q) => q.a - p.a);
      return cells.length ? [cells[0].r.left + cells[0].r.width / 2, cells[0].r.top + cells[0].r.height / 2] : null;
    }""")
    if cell is None:
        raise RuntimeError("aucune case de la carte à l'écran")
    clip.hold(0.6, glide(pointer, *cell))
    clip.until(3.0).save()


@sequence("economy")
def economy(page):
    """Économie : les courbes des taux se montent ; la souris survole un ruban, son étiquette s'affiche."""
    go(page, "Marchés", "Économie", "ridges")
    x, y = center(page, "ridges")
    pointer = Pointer(page, x - 480, y + 160)
    clip = Clip(page, "economy", pointer)
    clip.hold(1.8, glide(pointer, x - 60, y + 40, 0.6, 1.0))
    ribbons = hits(page, "ridges", n=30)
    if not ribbons:
        raise RuntimeError("aucun ruban sous le pointeur")
    target = nearest(ribbons, x, y)
    clip.hold(0.5, glide(pointer, target["x"], target["y"]))
    clip.until(3.0, glide(pointer, target["x"] + 36, target["y"] + 6)).save()


@sequence("crypto")
def crypto(page):
    """Crypto : les pièces tombent et se posent, puis la page descend au classement."""
    go(page, "Marchés", "Crypto", "coins")
    Pointer(page, 800, 420)
    clip = Clip(page, "crypto").hold(3.0)
    clip.hold(1.5, scroll_between(page, 0, section_scroll(page, "h2:Les 20 premières", gap=120))).save()


@sequence("compare")
def compare(page):
    """Comparer : le graphique, puis une descente lente."""
    go(page, "Marchés", "Comparer", "duel")
    page.wait_for_selector(".vega-embed canvas, .vega-embed svg", timeout=120_000)
    settle(page)
    Pointer(page, 800, 420)
    Clip(page, "compare").hold(0.6).hold(2.4, scroll_between(page, 0, 400)).save()


@sequence("portfolio")
def portfolio(page):
    """Portefeuille : l'anneau se monte, puis la page descend vers les positions."""
    go(page, "Mon espace", "Portefeuille", "ring")
    Pointer(page, 800, 420)
    there = section_scroll(page, "h2:Mes positions", "h2:Vue d'ensemble", "h2:Pour commencer", "h3:Connecte-toi", gap=120)
    Clip(page, "portfolio").hold(1.2).hold(1.8, scroll_between(page, 0, there)).save()


@sequence("alerts")
def alerts(page):
    """Alertes : la cloche se monte ; un clic en son centre la fait sonner et mène au formulaire."""
    go(page, "Mon espace", "Alertes", "bell")
    x, y = center(page, "bell")
    around = hits(page, "bell", n=24, all=True)
    spot = nearest(around, x, y) or {"x": x, "y": y}
    pointer = Pointer(page, x + 420, y + 170)
    clip = Clip(page, "alerts", pointer)
    clip.hold(1.8, glide(pointer, spot["x"], spot["y"], 0.45, 1.0))
    scroller(page)
    click(clip)
    clip.hold(0.3)   # la cloche sonne
    here, there = scroll_top(page), goal(page)
    if there is not None:
        clip.hold(1.0, scroll_between(page, here, there))
    clip.until(4.0).save()


@sequence("simulators")
def simulators(page):
    """Simulateurs : l'escalier, puis la descente jusqu'au premier graphique."""
    go(page, "Outils", "Simulateurs", "stairs")
    page.wait_for_selector(".vega-embed canvas, .vega-embed svg", timeout=120_000)
    settle(page)
    Pointer(page, 800, 420)
    there = section_scroll(page, ".vega-embed", gap=150)
    Clip(page, "simulators").hold(0.9).hold(1.7, scroll_between(page, 0, there)).until(3.0).save()


@sequence("glossary")
def glossary(page):
    """Glossaire (réserve) : les livres se montent, un clic sur le livre des actions cherche le mot, la page montre le résultat."""
    go(page, "Outils", "Glossaire", "books")
    Pointer(page, 800, 420)
    clip = Clip(page, "glossary").hold(1.8)
    book = (hits(page, "books", "action", n=30) or [None])[0]
    if book is None:
        raise RuntimeError("le livre « action » n'est pas à l'écran")
    scroller(page)
    clip.mark("click")
    page.evaluate("""([x, y]) => { const v = [...window.__fvObjs.live.values()].find((o) => o.kind === 'books');
      const b = v.el.getBoundingClientRect(); const hit = v.pick((x - b.left) / b.width, (y - b.top) / b.height);
      v.activate(hit); v.pick(null); }""", [book["x"], book["y"]])
    page.wait_for_function("() => window.__fvGoal != null", timeout=20_000)
    settle(page)   # le recalcul de la recherche : le temps de la séquence est arrêté
    here, there = scroll_top(page), goal(page)
    clip.hold(0.3)
    if there is not None:
        clip.hold(1.0, scroll_between(page, here, there))
    clip.until(4.0).save()


@sequence("light", "light")
def light(page):
    """Thème clair : Marchés, son en-tête avec le globe, une petite descente."""
    go(page, "Marchés", "Marchés", "globe")
    clear = page.evaluate("""() => { const m = getComputedStyle(document.querySelector('.stApp')).backgroundColor.match(/\\d+/g);
      return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; }""")
    if clear < 0.6:
        raise RuntimeError(f"la page n'est pas claire (luminance {clear:.2f})")
    Pointer(page, 800, 420)
    Clip(page, "light").hold(1.6).hold(1.4, scroll_between(page, 0, 320)).save()


@sequence("mobile", "phone")
def mobile(page):
    """Téléphone : l'accueil, la ville se monte, puis le récit défile."""
    scroll_to(page, 0)
    page.evaluate("""() => { window.__fv3d.replay(); for (const v of window.__fvObjs.live.values()) v.t = 0; }""")
    a, b = story_scroll(page, 0.0), story_scroll(page, 0.4)
    Clip(page, "mobile").hold(1.6).hold(1.2, scroll_between(page, a, b)).until(4.0).save(size=(1080, -2))


# --- Le tournage ------------------------------------------------------------------------------------------------------
def open_site(browser, url: str, context: str):
    """Un contexte de navigateur, le site chargé, le temps arrêté : prêt à filmer."""
    ctx = browser.new_context(**CONTEXTS[context])
    page = ctx.new_page()
    page.goto(url, timeout=180_000)
    page.wait_for_selector(".fv-story", timeout=180_000)
    page.wait_for_selector("#fv3d.is-on", timeout=180_000)
    page.wait_for_function("window.__fvObjs && window.__fvObjs.live && window.__fvObjs.live.size > 0", timeout=90_000)
    settle(page)
    page.add_style_tag(content=HIDE)
    if context != "phone":
        page.mouse.move(800, 420)
    page.wait_for_timeout(1500)
    # le temps s'arrête : décor et maquettes ne bougent plus qu'image par image ; la maquette du CAC 40 se remonte
    page.evaluate("""() => { window.__fv3d.tick(16); window.__fv3d.replay(); window.__fvObjs.tick(0);
                              for (const v of window.__fvObjs.live.values()) v.t = 0; }""")
    return ctx, page


def main() -> None:
    parser = argparse.ArgumentParser(description="Séquences filmées pour la bande-annonce de FinVeille")
    parser.add_argument("--url", default="http://localhost:8501/")
    parser.add_argument("--only", default="", help="ne tourner que ces séquences, séparées par des virgules")
    args = parser.parse_args()
    wanted = [name.strip() for name in args.only.split(",") if name.strip()] or list(SEQUENCES)
    unknown = [name for name in wanted if name not in SEQUENCES]
    if unknown:
        parser.error(f"séquences inconnues : {', '.join(unknown)} (connues : {', '.join(SEQUENCES)})")
    OUT.mkdir(parents=True, exist_ok=True)
    failed = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH"),
                                    args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        try:
            for context in CONTEXTS:   # un contexte à la fois : sombre, clair, téléphone
                names = [name for name in SEQUENCES if name in wanted and SEQUENCES[name][0] == context]
                if not names:
                    continue
                ctx, page = open_site(browser, args.url, context)
                try:
                    for name in names:
                        print(f"-- {name}", flush=True)
                        try:
                            SEQUENCES[name][1](page)
                        except Exception:   # une séquence ratée ne perd pas les autres : on la refait avec --only
                            traceback.print_exc()
                            failed.append(name)
                finally:
                    ctx.close()
        finally:
            browser.close()
    if failed:
        raise SystemExit(f"séquences ratées : {', '.join(failed)}")


if __name__ == "__main__":
    main()
