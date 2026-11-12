"""Rend le globe de la page Marchés (guide 42) : une mer de verre bleu, des continents d'or brossé en léger relief, un
méridien et un pied d'acier poli.

    python tools/blender/globe.py 1200 200      # côté de l'image en pixels, échantillons   → static/renders/globe.png
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

scene = common.reset(samples, (side, side))
common.sky(scene, strength=0.2, sun_elevation=42, sun_rotation=140)
scene.view_settings.exposure = -1.4
STEEL = common.principled("Acier", (0.7, 0.72, 0.75), metallic=1.0, roughness=0.16)

# La Terre : la carte des terres (tools/blender/data/land.png) choisit l'or ou le verre, et soulève les continents
R = 2.15
bpy.ops.mesh.primitive_uv_sphere_add(segments=192, ring_count=96, radius=R, location=(0, 0, 3.4))
earth = bpy.context.object
bpy.ops.object.shade_smooth()
material = common.principled("Terre", (0.01, 0.04, 0.12), metallic=0.0, roughness=0.05, coat=1.0)
nodes, links = material.node_tree.nodes, material.node_tree.links
bsdf = nodes["Principled BSDF"]
land = nodes.new("ShaderNodeTexImage")
land.image = bpy.data.images.load(str(HERE / "data" / "land.png"))
land.image.colorspace_settings.name = "Non-Color"
ramp = nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = 0.45, 0.55
links.new(land.outputs["Color"], ramp.inputs["Fac"])
for name, sea, ground in (("Base Color", (0.008, 0.035, 0.11, 1), (0.9, 0.58, 0.16, 1)),):
    mix = nodes.new("ShaderNodeMixRGB")
    mix.inputs["Color1"].default_value, mix.inputs["Color2"].default_value = sea, ground
    links.new(ramp.outputs["Color"], mix.inputs["Fac"])
    links.new(mix.outputs["Color"], bsdf.inputs[name])
links.new(ramp.outputs["Color"], bsdf.inputs["Metallic"])
rough = nodes.new("ShaderNodeMapRange")
rough.inputs["To Min"].default_value, rough.inputs["To Max"].default_value = 0.04, 0.32
links.new(ramp.outputs["Color"], rough.inputs["Value"])
links.new(rough.outputs[0], bsdf.inputs["Roughness"])
bump = nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value, bump.inputs["Distance"].default_value = 0.6, 0.05
links.new(ramp.outputs["Color"], bump.inputs["Height"])
links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
earth.data.materials.append(material)
# l'axe penche comme celui de la Terre ; l'Europe et l'Atlantique face à nous
earth.rotation_euler = (math.radians(-18), math.radians(12), math.radians(-62))

# Le méridien (un arc d'acier), ses pivots, la colonne et le pied tourné
bpy.ops.mesh.primitive_torus_add(major_radius=R + 0.2, minor_radius=0.035, major_segments=160, minor_segments=16,
                                 location=(0, 0, 3.4), rotation=(math.radians(90), math.radians(-18), 0))
bpy.context.object.data.materials.append(STEEL)
bpy.ops.object.shade_smooth()
for z, r1, r2, depth in ((0.07, 1.05, 1.0, 0.14), (0.2, 0.6, 0.22, 0.12), (0.62, 0.1, 0.07, 0.75)):
    bpy.ops.mesh.primitive_cone_add(vertices=96, radius1=r1, radius2=r2, depth=depth, location=(0, 0, z))
    bpy.context.object.data.materials.append(STEEL)
    bpy.ops.object.shade_smooth()
common.shadow_catcher(z=0)
common.camera(scene, common.y_up(0.6, 6.6, 13.4), common.y_up(0, 2.95, 0), 30)
common.render(scene, OUT / "globe.png")
print("FINI globe")
