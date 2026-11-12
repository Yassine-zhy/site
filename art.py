"""Les illustrations de secours des pages : un cadre au trait et un motif, dessinés en SVG.

Elles remplacent la maquette 3D d'une page quand le navigateur ne sait pas la dessiner (pas de WebGL, ou contexte
perdu : `.fv-obj-fallback`, theme.py). Tout est en SVG, sans image à télécharger ni image d'autrui, et passe par une
image « data URI », car st.html retire les balises <svg>. Aucun dégradé, aucun halo, aucune animation : des traits
d'une seule couleur, lisibles sur le fond clair comme sur le fond sombre.
"""

from __future__ import annotations

import base64
import math
from functools import lru_cache

# Les teintes des traits : le bleu de la marque, un vert (hausse) et un gris, lisibles sur les deux fonds
BLUE, GRAY, MINT = "#6d93ff", "#8a929d", "#34d17f"


def uri(svg: str) -> str:
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()


# --- Les illustrations des pages : un cadre et un motif au trait ---------------------------------------------

def _line(d: str, order: int = 1, width: float = 3.5, color: str = BLUE) -> str:
    """Un trait. `order` (1 à 3), l'ordre où les traits se dessinaient autrefois, n'a plus d'effet."""
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" '
            'stroke-linecap="round" stroke-linejoin="round"/>')


def _dot(x: float, y: float, r: float = 5, color: str = MINT) -> str:
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{color}"/>'


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
        + '<path d="M254,58 l5,12 l12,5 l-12,5 l-5,12 l-5,-12 l-12,-5 l12,-5 z" fill="' + MINT + '"/>'),
    "crypto": lambda: (  # des blocs hexagonaux reliés (une chaîne de blocs)
        _line(_hexagon(160, 128, 34)) + _line(_hexagon(92, 88, 22), 2) + _line(_hexagon(232, 172, 22), 2)
        + _line(_hexagon(240, 84, 16), 3) + _line("M111,99 L131,111 M189,146 L213,160 M190,112 L226,92", 3, 2.5)
        + _dot(160, 128, 6)),
    "stats": lambda: (  # des barres qui montent et une tendance
        _line("M96,196 v-40 M128,196 v-62 M160,196 v-50 M192,196 v-84 M224,196 v-104", 1, 16)
        + _line("M84,150 C120,140 150,128 176,118 S226,84 252,74", 2) + _dot(252, 74)),
    "compare": lambda: (  # deux courbes qui se croisent autour d'une référence
        _line("M64,140 h204", 1, 1.5, "rgba(138,146,157,.45)")
        + _line("M68,172 C110,156 132,124 170,128 S228,96 262,80", 2)
        + _line("M68,110 C110,126 140,150 180,146 S236,162 262,168", 3, 3.5, GRAY)
        + _dot(262, 80) + _dot(262, 168, 5, GRAY)),
    "portfolio": lambda: (  # une répartition en anneau
        _line(_arc(160, 128, 56, 0, 150), 1, 14) + _line(_arc(160, 128, 56, 162, 262), 2, 14, GRAY)
        + _line(_arc(160, 128, 56, 274, 348), 3, 14, MINT)
        + _line(_circle(160, 128, 26), 3, 2, "rgba(138,146,157,.5)")),
    "alerts": lambda: (  # une cloche, ses ondes et le seuil franchi
        _line("M160,70 c-26,0 -42,20 -42,46 v26 l-12,16 h108 l-12,-16 v-26 c0,-26 -16,-46 -42,-46 z")
        + _line("M150,168 a10,10 0 0 0 20,0", 2)
        + _line("M102,94 a64,64 0 0 1 14,-24 M218,94 a64,64 0 0 0 -14,-24", 3, 3)
        + '<path d="M64,112 H268" fill="none" stroke="' + MINT + '" stroke-width="2.5" stroke-dasharray="6 8"/>'
        + _dot(244, 112, 6)),
    "favorites": lambda: (  # des signets
        _line("M140,62 h76 v128 l-38,-26 l-38,26 z", 2, 2.5, "rgba(138,146,157,.6)")
        + _line("M110,74 h76 v128 l-38,-26 l-38,26 z")
        + '<path d="M148,104 l6,12 l13,2 l-9,9 l2,13 l-12,-6 l-12,6 l2,-13 l-9,-9 l13,-2 z" fill="'
        + MINT + '"/>'),
    "following": lambda: (  # une cible et une flèche : ce que l'on suit
        _line(_circle(160, 130, 58)) + _line(_circle(160, 130, 38), 2)
        + _line(_circle(160, 130, 18), 3) + _line("M252,58 L176,116 M176,116 l18,-2 M176,116 l2,-18", 3, 3.5, GRAY)
        + _dot(160, 130, 6)),
    "simulators": lambda: (  # des pièces empilées et une croissance exponentielle
        _line("M80,186 a24,8 0 1 0 48,0 a24,8 0 1 0 -48,0 M80,172 a24,8 0 1 0 48,0 a24,8 0 1 0 -48,0 "
              "M80,158 a24,8 0 1 0 48,0 a24,8 0 1 0 -48,0", 2, 3)
        + _line("M140,190 C186,186 206,168 224,140 S252,82 266,64") + _dot(266, 64)),
    "quiz": lambda: (  # une carte question et une bonne réponse
        _line("M118,62 h84 a14,14 0 0 1 14,14 v116 a14,14 0 0 1 -14,14 h-84 a14,14 0 0 1 -14,-14 v-116 "
              "a14,14 0 0 1 14,-14 z")
        + _line("M142,108 a19,19 0 1 1 26,18 c-6,3 -8,6 -8,14", 2, 5) + _dot(160, 160, 4.5, GRAY)
        + _line("M224,84 l8,8 l16,-18", 3, 4, MINT)),
    "glossary": lambda: (  # un livre ouvert
        _line("M160,82 C136,70 104,70 80,78 v104 c24,-8 56,-8 80,4 c24,-12 56,-12 80,-4 V78 c-24,-8 -56,-8 -80,4 z")
        + _line("M160,82 v104", 2, 2.5) + _line("M96,104 h48 M96,122 h40 M96,140 h46 M176,104 h48 M176,122 h40", 3, 3)
        + _dot(214, 140)),
    "settings": lambda: (  # trois réglages
        _line("M76,96 h168 M76,132 h168 M76,168 h168", 1, 3)
        + _line(_circle(122, 96, 10) + " " + _circle(202, 132, 10), 2, 3.5)
        + _line(_circle(150, 168, 10), 3, 3.5, GRAY) + _dot(202, 132, 4)),
    "account": lambda: (  # une personne et un bouclier : tes données
        _line(_circle(150, 104, 24)) + _line("M102,186 c0,-30 22,-46 48,-46 s48,16 48,46", 2)
        + _line("M236,74 l24,9 v20 c0,17 -11,28 -24,34 c-13,-6 -24,-17 -24,-34 v-20 z", 2, 3.5, GRAY)
        + _line("M227,103 l7,7 l13,-14", 3, 3.5, MINT)),
    "setup": lambda: (  # des engrenages
        _line(_circle(150, 124, 36)) + _line(_teeth(150, 124, 36, 10), 2, 9) + _line(_circle(150, 124, 13), 2)
        + _line(_circle(232, 174, 16), 3, 3, GRAY) + _line(_teeth(232, 174, 16, 7), 3, 7, GRAY)
        + _dot(150, 124, 4)),
}


@lru_cache(maxsize=32)
def spot(name: str) -> str:
    """L'illustration d'une page : un cadre au trait (trois lignes de grille) et le motif de la page."""
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">'
        '<rect x="16" y="16" width="288" height="208" rx="8" fill="none" stroke="#8a929d" stroke-opacity=".45" '
        'stroke-width="1.5"/>'
        '<path d="M36,96 H284 M36,136 H284 M36,176 H284" stroke="#8a929d" stroke-opacity=".2" stroke-width="1"/>'
        + GLYPHS[name]()
        + "</svg>"
    )
    return uri(svg)
