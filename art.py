"""La direction artistique de FinVeille (guide 29) : la « ligne de cours » signature et les illustrations des pages.

Le concept, « le terminal de nuit » : une salle des marchés la nuit, des écrans bleu nuit, des lignes de cours qui
s'allument. La ligne qui monte du logo (le F dont la barre devient une courbe) revient partout : en travers de chaque
en-tête, et dans les illustrations, des panneaux de verre dont les traits se dessinent à l'ouverture.

Tout est dessiné ici en SVG (aucune image à télécharger, aucune image d'autrui) et passe par une image « data URI »,
car st.html retire les balises <svg>. Les animations sont dans le SVG lui-même et s'arrêtent si le visiteur a
demandé moins de mouvement à son système (prefers-reduced-motion).
"""

from __future__ import annotations

import base64
import math
from functools import lru_cache

# Les teintes claires de la marque : lisibles sur le fond clair comme sur le bleu nuit
BLUE, VIOLET, MINT = "#6d93ff", "#a78bfa", "#6ee7a8"

# Le mouvement : les traits se dessinent (stroke-dashoffset), les aplats apparaissent, le point de la ligne pulse.
MOTION = (
    "<style>"
    ".d{stroke-dasharray:1;stroke-dashoffset:1;animation:d 1.6s cubic-bezier(.2,.7,.2,1) .15s forwards}"
    ".d2{animation-delay:.45s}.d3{animation-delay:.75s}"
    ".f{opacity:0;animation:f .9s ease 1s forwards}"
    ".p{transform-box:fill-box;transform-origin:center;animation:p 2.8s ease-out 1.8s infinite}"
    "@keyframes d{to{stroke-dashoffset:0}}@keyframes f{to{opacity:1}}"
    "@keyframes p{0%{transform:scale(1);opacity:.6}70%,100%{transform:scale(2.6);opacity:0}}"
    "@media (prefers-reduced-motion:reduce){.d{animation:none;stroke-dashoffset:0}.f{animation:none;opacity:1}"
    ".p{animation:none;opacity:0}}"
    "</style>"
)
STILL = "<style>.p{display:none}</style>"  # sans mouvement : pour un en-tête redessiné chaque minute


def uri(svg: str) -> str:
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()


def _smooth(points: list[tuple[float, float]]) -> str:
    """Un tracé lisse qui passe par tous les points (courbe de Catmull-Rom convertie en courbes de Bézier)."""
    d = f"M{points[0][0]:.1f},{points[0][1]:.1f}"
    for i in range(len(points) - 1):
        p0 = points[max(i - 1, 0)]
        p1, p2 = points[i], points[i + 1]
        p3 = points[min(i + 2, len(points) - 1)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}"
    return d


def _signature_points(count: int = 46) -> list[tuple[float, float]]:
    """Une courbe de cours stylisée qui monte, avec des oscillations (toujours la même : pas de hasard)."""
    points = []
    for i in range(count):
        t = i / (count - 1)
        trend = 252 - 182 * t ** 1.2
        wave = 17 * math.sin(t * 9.1) + 8 * math.sin(t * 23.7 + 1.3) + 4 * math.sin(t * 47.3 + 0.4)
        points.append((t * 1200, trend + wave * (1 - 0.4 * t)))
    return points


@lru_cache(maxsize=2)
def signature_line(animated: bool = True) -> str:
    """La ligne signature, en travers de l'en-tête : elle se dessine de gauche à droite, finit par le point menthe
    du logo, qui pulse. Image 1200 × 300, recadrée par la droite (le point reste toujours visible)."""
    points = _signature_points()
    d = _smooth(points)
    end_x, end_y = points[-1]
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" preserveAspectRatio="xMaxYMax slice">'
        "<defs>"
        f'<linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-color="{BLUE}" stop-opacity="0"/>'
        f'<stop offset=".3" stop-color="{BLUE}"/><stop offset=".78" stop-color="{VIOLET}"/>'
        f'<stop offset="1" stop-color="{MINT}"/></linearGradient>'
        f'<linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{BLUE}" stop-opacity=".16"/>'
        f'<stop offset="1" stop-color="{BLUE}" stop-opacity="0"/></linearGradient>'
        '<filter id="g" x="-5%" y="-40%" width="110%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>'
        "</defs>"
        + (MOTION if animated else STILL)
        + f'<path class="f" d="{d} L1200,300 L0,300 Z" fill="url(#a)"/>'
        f'<path class="d" pathLength="1" d="{d}" fill="none" stroke="url(#s)" stroke-width="12" stroke-opacity=".35" '
        'filter="url(#g)"/>'
        f'<path class="d" pathLength="1" d="{d}" fill="none" stroke="url(#s)" stroke-width="3" stroke-linecap="round"/>'
        f'<circle class="p" cx="{end_x - 6:.1f}" cy="{end_y:.1f}" r="7" fill="none" stroke="{MINT}" stroke-width="2"/>'
        f'<circle class="f" cx="{end_x - 6:.1f}" cy="{end_y:.1f}" r="6.5" fill="{MINT}"/>'
        "</svg>"
    )
    return uri(svg)


# --- Les illustrations des pages : un panneau de verre (comme une fenêtre d'application) et un motif au trait ----

def _line(d: str, delay: int = 1, width: float = 3.5, color: str = "url(#g)") -> str:
    extra = {1: "", 2: " d2", 3: " d3"}[delay]
    return (f'<path class="d{extra}" pathLength="1" d="{d}" fill="none" stroke="{color}" stroke-width="{width}" '
            'stroke-linecap="round" stroke-linejoin="round"/>')


def _dot(x: float, y: float, r: float = 5, color: str = MINT) -> str:
    return f'<circle class="f" cx="{x}" cy="{y}" r="{r}" fill="{color}"/>'


def _arc(cx: float, cy: float, r: float, start: float, end: float) -> str:
    """Un arc de cercle, de l'angle start à l'angle end (en degrés, 0 = en haut, sens des aiguilles d'une montre)."""
    def point(angle):
        rad = math.radians(angle - 90)
        return cx + r * math.cos(rad), cy + r * math.sin(rad)
    (x0, y0), (x1, y1) = point(start), point(end)
    return f"M{x0:.1f},{y0:.1f} A{r},{r} 0 {1 if end - start > 180 else 0} 1 {x1:.1f},{y1:.1f}"


def _circle(cx: float, cy: float, r: float) -> str:
    """Un cercle complet en deux demi-arcs (un arc qui revient à son point de départ ne serait pas dessiné)."""
    return f"M{cx},{cy - r} A{r},{r} 0 1 1 {cx},{cy + r} A{r},{r} 0 1 1 {cx},{cy - r}"


def _hexagon(cx: float, cy: float, r: float) -> str:
    corners = [(cx + r * math.cos(math.radians(60 * k - 30)), cy + r * math.sin(math.radians(60 * k - 30)))
               for k in range(6)]
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in corners) + " Z"


def _teeth(cx: float, cy: float, r: float, teeth: int) -> str:
    """Les dents d'un engrenage : de courts traits épais, tout autour du cercle."""
    return " ".join(
        f"M{cx + r * math.cos(a):.2f},{cy + r * math.sin(a):.2f} L{cx + (r + 7) * math.cos(a):.2f},"
        f"{cy + (r + 7) * math.sin(a):.2f}"
        for a in (2 * math.pi * k / teeth for k in range(teeth))
    )


GLYPHS = {
    "brief": lambda: (  # un journal, un titre, des colonnes et une petite courbe
        _line("M98,66 h124 a10,10 0 0 1 10,10 v118 a10,10 0 0 1 -10,10 h-124 a10,10 0 0 1 -10,-10 v-118 "
              "a10,10 0 0 1 10,-10 z")
        + _line("M110,88 h100", 2, 7) + _line("M110,112 h52 M110,126 h52 M110,140 h40 M110,170 h100 M110,184 h76", 3, 3)
        + _line("M176,144 l12,-14 l10,7 l14,-20", 2) + _dot(212, 117)),
    "assistant": lambda: (  # une bulle de conversation, une citation [1] et une étincelle
        _line("M84,78 h138 a18,18 0 0 1 18,18 v54 a18,18 0 0 1 -18,18 h-76 l-24,22 v-22 h-38 a18,18 0 0 1 -18,-18 "
              "v-54 a18,18 0 0 1 18,-18 z")
        + _line("M104,108 h96 M104,128 h60", 2, 3) + _line("M182,120 h-5 v16 h5 M198,120 h5 v16 h-5", 3, 3)
        + '<path class="f" d="M254,58 l5,12 l12,5 l-12,5 l-5,12 l-5,-12 l-12,-5 l12,-5 z" fill="' + MINT + '"/>'),
    "crypto": lambda: (  # des blocs hexagonaux reliés (une chaîne de blocs)
        _line(_hexagon(160, 128, 34)) + _line(_hexagon(92, 88, 22), 2) + _line(_hexagon(232, 172, 22), 2)
        + _line(_hexagon(240, 84, 16), 3) + _line("M111,99 L131,111 M189,146 L213,160 M190,112 L226,92", 3, 2.5)
        + _dot(160, 128, 6)),
    "stats": lambda: (  # des barres qui montent et une tendance
        _line("M96,196 v-40 M128,196 v-62 M160,196 v-50 M192,196 v-84 M224,196 v-104", 1, 16)
        + _line("M84,150 C120,140 150,128 176,118 S226,84 252,74", 2) + _dot(252, 74)),
    "compare": lambda: (  # deux courbes qui se croisent autour d'une référence
        _line("M64,140 h204", 1, 1.5, "rgba(150,162,185,.45)")
        + _line("M68,172 C110,156 132,124 170,128 S228,96 262,80", 2)
        + _line("M68,110 C110,126 140,150 180,146 S236,162 262,168", 3, 3.5, VIOLET)
        + _dot(262, 80) + _dot(262, 168, 5, VIOLET)),
    "portfolio": lambda: (  # une répartition en anneau
        _line(_arc(160, 128, 56, 0, 150), 1, 14) + _line(_arc(160, 128, 56, 162, 262), 2, 14, VIOLET)
        + _line(_arc(160, 128, 56, 274, 348), 3, 14, MINT) + _line(_circle(160, 128, 26), 3, 2, "rgba(150,162,185,.5)")),
    "alerts": lambda: (  # une cloche, ses ondes et le seuil franchi
        _line("M160,70 c-26,0 -42,20 -42,46 v26 l-12,16 h108 l-12,-16 v-26 c0,-26 -16,-46 -42,-46 z")
        + _line("M150,168 a10,10 0 0 0 20,0", 2) + _line("M102,94 a64,64 0 0 1 14,-24 M218,94 a64,64 0 0 0 -14,-24", 3, 3)
        + '<path class="f" d="M64,112 H268" stroke="' + MINT + '" stroke-width="2.5" stroke-dasharray="6 8"/>'
        + _dot(244, 112, 6)),
    "favorites": lambda: (  # des signets
        _line("M140,62 h76 v128 l-38,-26 l-38,26 z", 2, 2.5, "rgba(150,162,185,.6)")
        + _line("M110,74 h76 v128 l-38,-26 l-38,26 z")
        + '<path class="f" d="M148,104 l6,12 l13,2 l-9,9 l2,13 l-12,-6 l-12,6 l2,-13 l-9,-9 l13,-2 z" fill="'
        + MINT + '"/>'),
    "following": lambda: (  # une cible et une flèche : ce que l'on suit
        _line(_circle(160, 130, 58)) + _line(_circle(160, 130, 38), 2)
        + _line(_circle(160, 130, 18), 3) + _line("M252,58 L176,116 M176,116 l18,-2 M176,116 l2,-18", 3, 3.5, VIOLET)
        + _dot(160, 130, 6)),
    "simulators": lambda: (  # des pièces empilées et une croissance exponentielle
        _line("M80,186 a24,8 0 1 0 48,0 a24,8 0 1 0 -48,0 M80,172 a24,8 0 1 0 48,0 a24,8 0 1 0 -48,0 "
              "M80,158 a24,8 0 1 0 48,0 a24,8 0 1 0 -48,0", 2, 3)
        + _line("M140,190 C186,186 206,168 224,140 S252,82 266,64") + _dot(266, 64)),
    "quiz": lambda: (  # une carte question et une bonne réponse
        _line("M118,62 h84 a14,14 0 0 1 14,14 v116 a14,14 0 0 1 -14,14 h-84 a14,14 0 0 1 -14,-14 v-116 "
              "a14,14 0 0 1 14,-14 z")
        + _line("M142,108 a19,19 0 1 1 26,18 c-6,3 -8,6 -8,14", 2, 5) + _dot(160, 160, 4.5, VIOLET)
        + _line("M224,84 l8,8 l16,-18", 3, 4, MINT)),
    "glossary": lambda: (  # un livre ouvert
        _line("M160,82 C136,70 104,70 80,78 v104 c24,-8 56,-8 80,4 c24,-12 56,-12 80,-4 V78 c-24,-8 -56,-8 -80,4 z")
        + _line("M160,82 v104", 2, 2.5) + _line("M96,104 h48 M96,122 h40 M96,140 h46 M176,104 h48 M176,122 h40", 3, 3)
        + _dot(214, 140)),
    "settings": lambda: (  # trois réglages
        _line("M76,96 h168 M76,132 h168 M76,168 h168", 1, 3)
        + _line(_circle(122, 96, 10) + " " + _circle(202, 132, 10), 2, 3.5)
        + _line(_circle(150, 168, 10), 3, 3.5, VIOLET) + _dot(202, 132, 4)),
    "account": lambda: (  # une personne et un bouclier : tes données
        _line(_circle(150, 104, 24)) + _line("M102,186 c0,-30 22,-46 48,-46 s48,16 48,46", 2)
        + _line("M236,74 l24,9 v20 c0,17 -11,28 -24,34 c-13,-6 -24,-17 -24,-34 v-20 z", 2, 3.5, VIOLET)
        + _line("M227,103 l7,7 l13,-14", 3, 3.5, MINT)),
    "setup": lambda: (  # des engrenages
        _line(_circle(150, 124, 36)) + _line(_teeth(150, 124, 36, 10), 2, 9) + _line(_circle(150, 124, 13), 2)
        + _line(_circle(232, 174, 16), 3, 3, VIOLET) + _line(_teeth(232, 174, 16, 7), 3, 7, VIOLET)
        + _dot(150, 124, 4)),
}


@lru_cache(maxsize=32)
def spot(name: str) -> str:
    """L'illustration d'une page : un panneau de verre (points de fenêtre, lignes de grille) et le motif de la page,
    dont les traits se dessinent à l'ouverture."""
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">'
        "<defs>"
        f'<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{BLUE}"/>'
        f'<stop offset="1" stop-color="{VIOLET}"/></linearGradient>'
        f'<linearGradient id="pf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{BLUE}" stop-opacity=".14"/>'
        f'<stop offset="1" stop-color="{VIOLET}" stop-opacity=".05"/></linearGradient>'
        f'<linearGradient id="ps" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{BLUE}" stop-opacity=".55"/>'
        f'<stop offset="1" stop-color="{VIOLET}" stop-opacity=".18"/></linearGradient>'
        "</defs>"
        + MOTION
        + '<rect x="16" y="16" width="288" height="208" rx="24" fill="url(#pf)" stroke="url(#ps)" stroke-width="1.5"/>'
        '<circle cx="40" cy="38" r="4.5" fill="#ff6375" fill-opacity=".75"/>'
        '<circle cx="55" cy="38" r="4.5" fill="#f5b54e" fill-opacity=".75"/>'
        '<circle cx="70" cy="38" r="4.5" fill="#34d17f" fill-opacity=".75"/>'
        '<path d="M36,96 H284 M36,136 H284 M36,176 H284" stroke="#96a2b9" stroke-opacity=".16" stroke-width="1"/>'
        + GLYPHS[name]()
        + "</svg>"
    )
    return uri(svg)
