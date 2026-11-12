"""Rend la ville d'une place (guide 42) : une image photoréaliste (Cycles), un masque des tours et leurs positions.

    python tools/blender/city.py france 1400 160      # place, côté de l'image en pixels, échantillons

Sorties dans static/renders/ : city-<place>.png (l'image, fond transparent), city-<place>-mask.png (rouge = numéro de la
tour × 6, vert = 255 sur son toit) et city-<place>.json (le sommet de chaque tour dans l'image, de 0 à 1). Le
navigateur peint les toits à la couleur de la séance avec le masque (static/fv3d/renders.js).
Même plan que l'ancienne maquette : 8 × 5 cases, les valeurs les plus lourdes au centre, la hauteur suit le poids.
"""

import json
import math
import random
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent.parent)]
import common  # noqa: E402
import scene3d  # noqa: E402

place = sys.argv[1] if len(sys.argv) > 1 else "france"
side = int(sys.argv[2]) if len(sys.argv) > 2 else 1400
samples = int(sys.argv[3]) if len(sys.argv) > 3 else 160
OUT = HERE.parent.parent / "static" / "renders"
OUT.mkdir(parents=True, exist_ok=True)

COLS, ROWS, CELL, FW, GAP = 8, 5, 1.22, 0.8, 0.18
W, D = COLS * CELL + GAP + 1.1, ROWS * CELL + 1.1
col_x = lambda i: (i - (COLS - 1) / 2) * CELL + (GAP if i >= COLS / 2 else -GAP)  # noqa: E731
row_z = lambda j: (j - (ROWS - 1) / 2) * CELL  # noqa: E731
cells = sorted(((col_x(i), row_z(j)) for i in range(COLS) for j in range(ROWS)),
               key=lambda c: c[0] * c[0] * 0.55 + c[1] * c[1])
towers = sorted(scene3d.city_data([], place)["towers"], key=lambda t: -t["w"])[:len(cells)]
wmax = towers[0]["w"]

scene = common.reset(samples, (side, round(side * 0.84)))
common.sky(scene, strength=0.22)
rng = random.Random(11)


def glass(name, tint):
    """Le mur-rideau : des vitres sombres qui reflètent le ciel, un quadrillage de meneaux d'aluminium."""
    material = common.principled(name, tint, metallic=1.0, roughness=0.06)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes["Principled BSDF"]
    coords, split, add, combine = (nodes.new("ShaderNodeTexCoord"), nodes.new("ShaderNodeSeparateXYZ"),
                                   nodes.new("ShaderNodeMath"), nodes.new("ShaderNodeCombineXYZ"))
    links.new(coords.outputs["Object"], split.inputs[0])
    links.new(split.outputs["X"], add.inputs[0])
    links.new(split.outputs["Y"], add.inputs[1])
    links.new(add.outputs[0], combine.inputs["X"])
    links.new(split.outputs["Z"], combine.inputs["Y"])
    brick = nodes.new("ShaderNodeTexBrick")
    brick.offset, brick.squash = 0.0, 1.0
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Brick Width"].default_value = 0.13
    brick.inputs["Row Height"].default_value = 0.17
    brick.inputs["Mortar Size"].default_value = 0.007
    brick.inputs["Color1"].default_value = (*tint, 1)
    brick.inputs["Color2"].default_value = (*(c * 1.9 for c in tint), 1)
    brick.inputs["Mortar"].default_value = (0.22, 0.24, 0.27, 1)
    links.new(combine.outputs[0], brick.inputs["Vector"])
    links.new(brick.outputs["Color"], bsdf.inputs["Base Color"])
    rough = nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value, rough.inputs["To Max"].default_value = 0.05, 0.38
    links.new(brick.outputs["Fac"], rough.inputs["Value"])
    links.new(rough.outputs[0], bsdf.inputs["Roughness"])
    return material


GLASS = [glass("Verre bleu", (0.012, 0.035, 0.085)), glass("Verre acier", (0.02, 0.045, 0.075)),
         glass("Verre nuit", (0.008, 0.02, 0.05))]
STEEL = common.principled("Acier", (0.62, 0.64, 0.67), metallic=1.0, roughness=0.28)
STONE = common.principled("Pierre", (0.035, 0.038, 0.045), roughness=0.22, coat=0.6)
ROOF = common.principled("Toit", (0.86, 0.86, 0.86), roughness=0.35, coat=0.4)   # blanc : le navigateur le teinte
UNIT = common.principled("Équipement", (0.16, 0.17, 0.19), roughness=0.5)
bodies, roofs, tops = [], [], []

common.box("Socle", (W, D, 0.16), (0, 0, -0.08), STONE, bevel=0.04)
common.shadow_catcher(z=-0.16)
for k, tower in enumerate(towers):
    x, z = cells[k]
    px, py = x, -z   # le repère de Blender : Y = -Z de l'ancien
    h = 0.7 + 4.4 * math.sqrt(tower["w"] / wmax)
    material = GLASS[k % len(GLASS)]
    parts = [common.box("Podium", (FW + 0.18, FW + 0.18, 0.26), (px, py, 0.13), STEEL, bevel=0.02)]
    setback = h > 2.3
    lower = h * 0.74 if setback else h
    parts.append(common.box("Fût", (FW, FW, lower - 0.26), (px, py, 0.26 + (lower - 0.26) / 2), material, bevel=0.012))
    top, roof_w = lower, FW
    if setback:
        parts.append(common.box("Corniche", (FW + 0.06, FW + 0.06, 0.06), (px, py, lower), STEEL, bevel=0.012))
        parts.append(common.box("Retrait", (FW * 0.68, FW * 0.68, h - lower), (px, py, lower + 0.03 + (h - lower) / 2),
                                material, bevel=0.012))
        top, roof_w = h + 0.03, FW * 0.68
    roof = common.box("Toit", (roof_w + 0.04, roof_w + 0.04, 0.09), (px, py, top + 0.045), ROOF, bevel=0.015)
    if k < 3:
        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.035, radius2=0.008, depth=0.85, location=(px, py, top + 0.09 + 0.425))
        bpy.context.object.data.materials.append(STEEL)
        parts.append(bpy.context.object)
    else:
        for _ in range(1 + k % 3):
            parts.append(common.box("Équipement", (0.2 + rng.random() * 0.12, 0.14, 0.08),
                                    (px + (rng.random() - 0.5) * roof_w * 0.5, py + (rng.random() - 0.5) * roof_w * 0.5, top + 0.13),
                                    UNIT, bevel=0.008))
    bodies.append(parts)
    roofs.append(roof)
    tops.append((px, py, top + 0.09))

cam = common.camera(scene, common.y_up(12.8, 10.2, 15.8), common.y_up(0, 1.5, 0), 27)
common.render(scene, OUT / f"city-{place}.png")

# Les positions des sommets dans l'image (x vers la droite, y vers le bas, de 0 à 1)
from mathutils import Vector  # noqa: E402

points = []
for px, py, pz in tops:
    v = world_to_camera_view(scene, cam, Vector((px, py, pz)))
    points.append([round(v.x, 4), round(1 - v.y, 4)])
(OUT / f"city-{place}.json").write_text(json.dumps({"tops": points}))

# Le masque : chaque tour d'une couleur pure (rouge = (numéro + 1) × 6 ; vert = 255 sur le toit), tout le reste noir
scene.cycles.samples = 1
scene.cycles.use_denoising = False
scene.cycles.filter_width = 0.01
scene.view_settings.view_transform = "Raw"
scene.view_settings.look = "None"
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0
black = common.flat("Noir", (0, 0, 0))
for obj in scene.objects:
    if obj.type == "MESH":
        obj.is_shadow_catcher = False
        obj.data.materials.clear()
        obj.data.materials.append(black)
for k, parts in enumerate(bodies):
    code = (k + 1) * 6 / 255
    body, cap = common.flat(f"Tour {k}", (code, 0, 0)), common.flat(f"Toit {k}", (code, 1, 0))
    for obj in parts:
        obj.data.materials.clear()
        obj.data.materials.append(body)
    roofs[k].data.materials.clear()
    roofs[k].data.materials.append(cap)
common.render(scene, OUT / f"city-{place}-mask.png")
print("FINI", place)
