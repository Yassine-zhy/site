"""Génère les fichiers du logo FinVeille : le symbole, et le logo complet avec le nom vectorisé.

Le nom « FinVeille » est converti en tracés (fontTools) : le logo s'affiche alors à l'identique partout, même là où
la police IBM Plex Sans n'est pas installée (README sur GitHub, messageries, réseaux sociaux).

Usage, depuis le dossier finveille/ (outil ponctuel, pas une dépendance de l'appli) :
    pip install fonttools
    curl -o plex-bold.ttf "<adresse du fichier TTF d'IBM Plex Sans Bold, donnée par fonts.googleapis.com>"
    python tools/make_logo.py   # écrit assets/logo.svg, assets/logo-light.svg, assets/logo-dark.svg
"""
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

MARK = """<defs><linearGradient id="fvg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b6cff"/><stop offset="1" stop-color="#1536b4"/></linearGradient></defs>
  <rect width="64" height="64" rx="16" fill="url(#fvg)"/>
  <rect x="16" y="13" width="9.5" height="38" rx="3.5" fill="#fff"/>
  <rect x="16" y="13" width="32" height="9.5" rx="3.5" fill="#fff"/>
  <path d="M25.5 38.5 L32 33.2 L38 36.2 L46 28.5" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="46.5" cy="28" r="5" fill="#6ee7a8"/>"""


def text_path(font, text, size, x0, baseline, tracking=-0.02):
    glyph_set, cmap = font.getGlyphSet(), font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    x, paths = x0, []
    for char in text:
        name = cmap[ord(char)]
        pen = SVGPathPen(glyph_set)
        glyph_set[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        paths.append(pen.getCommands())
        x += glyph_set[name].width * scale + tracking * size
    return " ".join(paths), x


font = TTFont("plex-bold.ttf")
with open("assets/logo.svg", "w") as f:
    f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">\n  {MARK}\n</svg>\n')
for variant, color in [("light", "#0f1724"), ("dark", "#ffffff")]:
    fin, x = text_path(font, "Fin", 40, 80, 46)
    veille, end = text_path(font, "Veille", 40, x, 46)
    width = int(end + 8)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="64" viewBox="0 0 {width} 64" '
           f'role="img" aria-label="FinVeille">\n  {MARK}\n  <path d="{fin}" fill="{color}"/>\n'
           f'  <path d="{veille}" fill="{"#2f62ff" if variant == "light" else "#7fa2ff"}"/>\n</svg>\n')
    with open(f"assets/logo-{variant}.svg", "w") as f:
        f.write(svg)
print("Logo écrit dans assets/")
