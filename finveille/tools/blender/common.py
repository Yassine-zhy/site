"""Outils communs des rendus Blender (guide 42) : scène vide, ciel, caméra, matières, rendu Cycles sur fond transparent."""

import math

import bpy
from mathutils import Vector


def y_up(x, y, z):
    """Un point du repère des anciennes maquettes (Y vers le haut) dans celui de Blender (Z vers le haut)."""
    return Vector((x, -z, y))


def reset(samples=160, size=(1400, 1400)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    return scene


def sky(scene, strength=1.0, sun_elevation=38, sun_rotation=215):
    """Un ciel physique : il éclaire la scène et se reflète dans le verre et le métal."""
    world = bpy.data.worlds.new("Ciel")
    scene.world = world
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    tex = nodes.new("ShaderNodeTexSky")
    tex.sun_elevation = math.radians(sun_elevation)
    tex.sun_rotation = math.radians(sun_rotation)
    tex.sun_intensity = 0.35
    background = nodes["Background"]
    background.inputs["Strength"].default_value = strength
    links.new(tex.outputs["Color"], background.inputs["Color"])


def camera(scene, pos, look, fov_vertical):
    cam = bpy.data.cameras.new("Camera")
    cam.sensor_fit = "VERTICAL"
    cam.angle_y = math.radians(fov_vertical)
    cam.shift_y = 0.02
    obj = bpy.data.objects.new("Camera", cam)
    scene.collection.objects.link(obj)
    obj.location = pos
    obj.rotation_euler = (Vector(look) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
    scene.camera = obj
    return obj


def principled(name, color, metallic=0.0, roughness=0.5, coat=0.0, transmission=0.0, ior=1.45):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Transmission Weight"].default_value = transmission
    bsdf.inputs["IOR"].default_value = ior
    return material


def flat(name, color):
    """Une couleur pure, sans lumière ni ombre : pour les cartes d'identifiants (masques)."""
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (*color, 1)
    out = nodes.new("ShaderNodeOutputMaterial")
    links.new(emission.outputs["Emission"], out.inputs["Surface"])
    return material


def box(name, size, location, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        modifier = obj.modifiers.new("Chanfrein", "BEVEL")
        modifier.width, modifier.segments = bevel, 3
    obj.data.materials.append(material)
    return obj


def shadow_catcher(size=60, z=0.0):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, z))
    plane = bpy.context.object
    plane.is_shadow_catcher = True
    return plane


def render(scene, path):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
