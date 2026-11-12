"""Rend les pièces de la page Crypto (guide 42) : un bitcoin d'or debout, sa pile, un ether d'argent appuyé dessus.

    python tools/blender/coins.py 1200 200      # côté de l'image en pixels, échantillons   → static/renders/coins.png
"""

import math
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import common  # noqa: E402

side = int(sys.argv[1]) if len(sys.argv) > 1 else 1200
samples = int(sys.argv[2]) if len(sys.argv) > 2 else 200
OUT = HERE.parent.parent / "static" / "renders"
OUT.mkdir(parents=True, exist_ok=True)

scene = common.reset(samples, (side, round(side * 0.8)))
FONT = bpy.data.fonts.load("/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf")
common.sky(scene, strength=0.2, sun_elevation=40, sun_rotation=150)
scene.view_settings.exposure = -1.4
GOLD = common.principled("Or", (1.0, 0.56, 0.12), metallic=1.0, roughness=0.24)
SILVER = common.principled("Argent", (0.78, 0.8, 0.84), metallic=1.0, roughness=0.26)


def coin(symbol, material, radius=1.0, thickness=0.15, engraved=True):
    """Une pièce couchée, centrée sur l'origine : le flan, un listel en relief, le symbole frappé sur les deux faces."""
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=radius, depth=thickness)
    body = bpy.context.object
    bevel = body.modifiers.new("Chanfrein", "BEVEL")
    bevel.width, bevel.segments = 0.02, 3
    bpy.ops.object.shade_auto_smooth() if hasattr(bpy.ops.object, "shade_auto_smooth") else bpy.ops.object.shade_smooth()
    parts.append(body)
    for side_z in (1, -1):
        bpy.ops.mesh.primitive_torus_add(major_radius=radius * 0.9, minor_radius=0.035, major_segments=128, minor_segments=12,
                                         location=(0, 0, side_z * thickness / 2))
        parts.append(bpy.context.object)
        bpy.ops.object.shade_smooth()
        if engraved:
            bpy.ops.object.text_add(location=(0, 0, side_z * thickness / 2), rotation=(0 if side_z > 0 else math.pi, 0, 0))
            text = bpy.context.object
            text.data.body, text.data.font = symbol, FONT
            text.data.align_x, text.data.align_y = "CENTER", "CENTER"
            text.data.size, text.data.extrude, text.data.bevel_depth = radius * 1.15, 0.03, 0.008
            parts.append(text)
    for obj in parts:
        obj.data.materials.append(material)
        if obj is not body:
            obj.parent = body
    return body


def place(obj, location, rotation):
    obj.location, obj.rotation_euler = location, rotation


big = coin("₿", GOLD, 1.25)
place(big, (0.55, 0.35, 1.25), (math.radians(90), 0, math.radians(18)))
for k in range(6):   # la pile : six petites pièces d'or, à peine désaxées
    stacked = coin("₿", GOLD, 0.62, 0.12, engraved=k == 5)
    place(stacked, (-1.1 + (k % 2) * 0.03, -0.55 + (k % 3) * 0.02, 0.06 + k * 0.122), (0, 0, k * 0.4))
ether = coin("Ξ", SILVER, 0.9)
place(ether, (-1.75, 0.5, 0.86), (math.radians(72), 0, math.radians(-28)))
flat = coin("Ξ", SILVER, 0.78, 0.13)
place(flat, (1.55, -1.15, 0.065), (0, 0, 0.6))
common.shadow_catcher(z=0)
common.camera(scene, common.y_up(1.2, 3.6, 9.6), common.y_up(-0.1, 0.95, 0), 30)
common.render(scene, OUT / "coins.png")
print("FINI coins")
