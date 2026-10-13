"""Audit d'accessibilité et d'ergonomie de toutes les pages (guide 28), dans un vrai navigateur.

Pour chaque page, en thème clair ou sombre, sur ordinateur ou téléphone, il mesure :
- le contraste de chaque texte avec son fond (4,5:1, ou 3:1 pour un grand texte), opacités comprises ;
- les boutons et liens sans nom accessible, les images sans texte de remplacement (attribut alt) ;
- un défilement horizontal (la page déborde) ;
- sur téléphone, les commandes de moins de 44 px de haut ;
- le texte posé sur le décor 3D (guide 30) : son contraste, mesuré sur les vrais pixels de l'écran (le décor est
  dessiné en WebGL, le CSS ne dit rien de sa couleur).

Depuis le dossier finveille/, le site étant lancé (streamlit run app.py) :
    pip install playwright && playwright install chromium
    python tools/ux_audit.py                         # thème sombre, ordinateur
    python tools/ux_audit.py --theme light --mobile  # thème clair, téléphone de 375 px
CHROMIUM_PATH=/chemin/vers/chromium pour utiliser un Chromium déjà installé.

Limites : le texte des graphiques (SVG) et les étiquettes cachées des curseurs sont signalés à tort ; une page
lente peut dépasser le délai. Chaque alerte se vérifie à l'œil avant correction.
"""

import argparse
import json
import os
import sys

from playwright.sync_api import sync_playwright

PAGES = ["", "brief", "assistant", "stats", "markets", "economy", "crypto", "compare", "following", "portfolio",
         "alerts", "favorites", "simulators", "quiz", "glossary", "settings", "account"]

JS = r"""(mobile) => {
  const res = {hscroll: false, noName: [], noAlt: [], contrast: [], small: {}};
  const main = document.querySelector('[data-testid=stMain]');
  res.hscroll = document.documentElement.scrollWidth > innerWidth + 1 || !!(main && main.scrollWidth > main.clientWidth + 1);
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  for (const el of document.querySelectorAll('button, a[href], [role=button], [role=tab]')) {
    if (!vis(el) || el.closest('[aria-hidden="true"]')) continue;
    const name = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '').trim();
    if (!name) res.noName.push(el.outerHTML.slice(0, 160));
    // Exception de la norme (WCAG 2.5.8) : un lien au fil d'une phrase garde la hauteur de la ligne
    const inSentence = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.closest('p, li');
    // Exception « contrôle équivalent » : le titre d'un article a toujours son bouton « Lire » de 44 px
    const hasEquivalent = !!el.closest('.fv-headline');
    if (mobile && !inSentence && !hasEquivalent) { const r = el.getBoundingClientRect(); if (r.height < 44) {
      const key = (el.closest('[data-testid]')?.getAttribute('data-testid') || el.tagName) + ' · ' + (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30);
      res.small[key] = Math.round(r.height); } }
  }
  for (const img of document.querySelectorAll('img')) if (!img.hasAttribute('alt') && vis(img)) res.noAlt.push(img.outerHTML.slice(0, 120));
  const parse = c => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
  const lum = ({r, g, b}) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const appBg = parse(getComputedStyle(document.querySelector('.stApp')).backgroundColor);
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e);
      if (e.classList && e.classList.contains('stApp')) return appBg;
      const c = parse(cs.backgroundColor);
      if (cs.backgroundImage !== 'none' && !(c && c.a > 0.9)) return null;   // dégradé, image : on ne juge pas
      if (c && c.a > 0.9) return c; } return appBg; };
  const opacityOf = el => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode; const text = node.textContent.trim(); if (text.length < 2) continue;
    const el = node.parentElement; if (!el || !vis(el)) continue;
    // Faux positifs connus : texte des graphiques (SVG, couleur donnée par « fill »), étiquettes des curseurs
    // (placées hors du bouton coloré qui les contient), éléments invisibles (opacité nulle)
    if (el.closest('svg') || el.closest('[data-testid="stSliderThumbValue"]') || opacityOf(el) < 0.05) continue;
    const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg || fg.a === 0) continue;
    if (cs.webkitTextFillColor && parse(cs.webkitTextFillColor)?.a === 0) continue;
    const bg = bgOf(el); if (!bg) continue;
    const alpha = fg.a * opacityOf(el);
    const mix = {r: fg.r * alpha + bg.r * (1 - alpha), g: fg.g * alpha + bg.g * (1 - alpha), b: fg.b * alpha + bg.b * (1 - alpha)};
    const [l1, l2] = [lum(mix), lum(bg)].sort((a, b) => b - a); const ratio = (l1 + 0.05) / (l2 + 0.05);
    const size = parseFloat(cs.fontSize); const bold = parseInt(cs.fontWeight) >= 700;
    const need = (size >= 24 || (bold && size >= 18.66)) ? 3 : 4.5;
    if (ratio < need) { const key = text.slice(0, 40) + '|' + cs.color;
      if (!seen.has(key)) { seen.add(key); res.contrast.push({text: text.slice(0, 50), ratio: +ratio.toFixed(2), size, color: cs.color,
        bg: `rgb(${bg.r},${bg.g},${bg.b})`, cls: (el.className && el.className.baseVal === undefined ? el.className : '').toString().slice(0, 60),
        testid: el.closest('[data-testid]')?.getAttribute('data-testid') || ''}); } }
  }
  return res;
}"""


# Les textes posés directement sur le fond de la page, là où le décor 3D se voit (aucun fond derrière eux)
SCENE_TEXT = r"""() => {
  const app = document.querySelector('.stApp'), out = [], seen = new Set();
  const onPage = el => { for (let e = el; e && e !== app; e = e.parentElement) {
      const cs = getComputedStyle(e), m = cs.backgroundColor.match(/[\d.]+/g);
      if ((m && (m.length < 4 || +m[3] > 0.05)) || cs.backgroundImage !== 'none' || cs.backdropFilter !== 'none') return false; }
    return true; };
  const main = document.querySelector('[data-testid=stMain], [data-testid=stAppScrollToBottomContainer]');
  const walker = document.createTreeWalker(main || document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement, text = walker.currentNode.textContent.trim();
    if (!el || text.length < 2 || seen.has(el)) continue;
    seen.add(el);
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (r.width < 2 || r.bottom < 0 || r.top > innerHeight || cs.visibility === 'hidden') continue;
    if (/rgba\(.*,\s*0\)$/.test(cs.webkitTextFillColor || '')) continue;   // texte en dégradé (fin du titre)
    if (onPage(el)) out.push({text: text.slice(0, 50), box: [r.left, r.top, r.width, r.height], color: cs.color,
      size: parseFloat(cs.fontSize), bold: parseInt(cs.fontWeight) >= 700});
  }
  return out;
}"""
# Cacher le texte pour photographier son fond : couleur transparente, et les textes en dégradé (fin du titre, nom du
# logo), dessinés par leur fond (background-clip: text), rendus invisibles
HIDE_TEXT = (".stApp * { color: transparent !important; -webkit-text-fill-color: transparent !important;"
             " text-shadow: none !important; } [data-fv-clip] { visibility: hidden !important; }")
MARK_CLIPPED = """() => { for (const e of document.querySelectorAll('.stApp *')) {
  const cs = getComputedStyle(e); if (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') e.dataset.fvClip = '1'; } }"""


def luminance(rgb) -> float:
    def channel(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])


def scene_contrast(page) -> tuple[list[dict], int]:
    """Le contraste du texte posé sur le décor 3D : une capture de l'écran, texte caché, donne le vrai fond de chaque
    texte. On retient le pire cas (les 5 % de pixels du fond les plus proches de la couleur du texte)."""
    from io import BytesIO

    from PIL import Image

    if not page.locator("#fv3d.is-on").count():
        return [], 0
    page.evaluate("window.__fv3d && (window.__fv3d.started -= 9)")  # l'arrivée du décor est terminée
    page.wait_for_timeout(1_500)
    texts = page.evaluate(SCENE_TEXT)
    page.evaluate(MARK_CLIPPED)
    style = page.add_style_tag(content=HIDE_TEXT)
    page.wait_for_timeout(150)
    shot = Image.open(BytesIO(page.screenshot())).convert("RGB")
    style.evaluate("node => node.remove()")
    page.evaluate("() => document.querySelectorAll('[data-fv-clip]').forEach(e => delete e.dataset.fvClip)")
    found = []
    for item in texts:
        x, y, w, h = (round(v) for v in item["box"])
        box = (max(0, x), max(0, y), min(shot.width, x + w), min(shot.height, y + h))
        if box[2] - box[0] < 2 or box[3] - box[1] < 2:
            continue
        raw = shot.crop(box).tobytes()  # trois octets (rouge, vert, bleu) par pixel
        values = sorted(luminance(raw[i:i + 3]) for i in range(0, len(raw), 3))
        fg = luminance([float(v) for v in item["color"][item["color"].index("(") + 1:-1].split(",")[:3]])
        light_text = fg > values[len(values) // 2]
        bg = values[int(len(values) * 0.95)] if light_text else values[int(len(values) * 0.05)]
        ratio = (max(fg, bg) + 0.05) / (min(fg, bg) + 0.05)
        need = 3 if item["size"] >= 24 or (item["bold"] and item["size"] >= 18.66) else 4.5
        if ratio < need:
            found.append({"text": item["text"], "ratio": round(ratio, 2), "need": need})
    return found, len(texts)


def audit_page(context, url: str, mobile: bool) -> dict:
    page = context.new_page()
    try:
        page.goto(url, timeout=120_000)
        page.locator(".fv-footer").first.wait_for(timeout=120_000)  # le pied de page : la page est entière
        page.wait_for_timeout(2_000)
        result = page.evaluate(JS, mobile)
        result["exceptions"] = page.locator("[data-testid=stException]").count()
        page.evaluate("document.querySelector('[data-testid=stMain], [data-testid=stAppScrollToBottomContainer]')"
                      "?.scrollTo(0, 0)")
        result["scene"], result["scene_checked"] = scene_contrast(page)
    except Exception as error:  # une page en erreur ne doit pas arrêter l'audit des autres
        result = {"error": f"{type(error).__name__}: {str(error)[:150]}"}
    page.close()
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit d'accessibilité de toutes les pages de FinVeille.")
    parser.add_argument("--url", default="http://localhost:8501/", help="adresse du site (défaut : local)")
    parser.add_argument("--theme", choices=["dark", "light"], default="dark")
    parser.add_argument("--mobile", action="store_true", help="téléphone de 375 × 812 px, écran tactile")
    parser.add_argument("--json", help="enregistre le rapport complet dans ce fichier")
    args = parser.parse_args()
    width, height = (375, 812) if args.mobile else (1440, 1000)
    report, problems = {}, 0
    with sync_playwright() as p:
        # WebGL sans carte graphique (rendu logiciel SwiftShader) : le décor 3D s'affiche aussi pendant l'audit
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH"),
                                    args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        context = browser.new_context(viewport={"width": width, "height": height}, color_scheme=args.theme,
                                      has_touch=args.mobile, is_mobile=args.mobile)
        for path in PAGES:
            result = report[path or "feed"] = audit_page(context, args.url.rstrip("/") + "/" + path, args.mobile)
            if "error" in result:
                print(f"{path or 'feed':11s} ERREUR {result['error']}")
                problems += 1
                continue
            found = {"exceptions": result["exceptions"], "défilement horizontal": int(bool(result["hscroll"])),
                     "sans nom": len(result["noName"]), "sans alt": len(result["noAlt"]),
                     "contraste": len(result["contrast"]), "cibles < 44 px": len(result["small"]),
                     "texte sur le décor 3D": len(result["scene"])}
            problems += sum(found.values())
            print(f"{path or 'feed':11s}", " · ".join(f"{k} {v}" for k, v in found.items() if v) or "ok")
        browser.close()
    if args.json:
        with open(args.json, "w", encoding="utf-8") as file:
            json.dump(report, file, ensure_ascii=False, indent=1)
    print(f"\n{problems} point(s) à vérifier" + (f" (détails : {args.json})" if args.json else ""))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
