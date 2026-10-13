"""Génère static/fv3d/land.js : la carte des terres émergées, pour le globe 3D de la page Marchés (guide 30).

Une image de 360 × 180 points (un point par degré de longitude et de latitude), en noir et blanc : 1 = terre,
0 = mer. Elle est rangée en bits (8 points par octet) puis encodée en base64 : 11 Ko, chargés une seule fois.

Source : Natural Earth, « Land » au 1:110 millions (domaine public, https://www.naturalearthdata.com).

Usage, depuis le dossier finveille/ (outil ponctuel, pas une dépendance de l'appli) :
    curl -o land110.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
    python tools/make_land_mask.py land110.geojson
"""
import base64
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

WIDTH, HEIGHT, SCALE = 360, 180, 4  # dessiné 4 fois plus grand puis réduit : des côtes plus justes


def rings(geometry: dict):
    """Les contours extérieurs d'un Polygon ou d'un MultiPolygon (les lacs, trop petits ici, sont ignorés)."""
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    for polygon in polygons:
        yield polygon[0]


def main(source: str) -> None:
    image = Image.new("L", (WIDTH * SCALE, HEIGHT * SCALE), 0)
    draw = ImageDraw.Draw(image)
    for feature in json.loads(Path(source).read_text())["features"]:
        for ring in rings(feature["geometry"]):
            # longitude -180…180 → x de gauche à droite ; latitude 90…-90 → y de haut en bas
            draw.polygon([((lon + 180) * SCALE, (90 - lat) * SCALE) for lon, lat in ring], fill=255)
    small = image.resize((WIDTH, HEIGHT), Image.Resampling.BOX)
    bits = bytearray(WIDTH * HEIGHT // 8)
    for index, value in enumerate(small.tobytes()):  # un octet par point (0 à 255)
        if value >= 96:  # plus d'un tiers du degré carré est de la terre
            bits[index // 8] |= 1 << (index % 8)
    target = Path(__file__).resolve().parent.parent / "static" / "fv3d" / "land.js"
    target.write_text(
        "// Terres émergées, 360 × 180 points (1 par degré), 1 bit par point. Généré par tools/make_land_mask.py\n"
        "// à partir de Natural Earth (domaine public). Ne pas modifier à la main.\n"
        f'export const LAND_W = {WIDTH}, LAND_H = {HEIGHT};\n'
        f'export const LAND = "{base64.b64encode(bytes(bits)).decode()}";\n'
    )
    print(f"{target} : {sum(bin(b).count('1') for b in bits)} points de terre sur {WIDTH * HEIGHT}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "land110.geojson")
