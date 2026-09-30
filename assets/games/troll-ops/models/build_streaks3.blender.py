"""
Troll Forces scorestreaks, third batch: the Orbital VSAT satellite.

    blender --background --python build_streaks3.blender.py

Writes orbital-vsat.glb next to this script. It isn't flown in the match
(the VSAT is a minimap reveal); it's the lobby preview and the HUD icon
(render_streak_icons.blender.py).

Conventions as build_streaks2.blender.py: metres, Blender +Y is "forward".
  orbital-vsat.glb  VSAT_Bus > VSAT_Wing_L/R (solar arrays), VSAT_Dish
"""
import bpy
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def material(name, color, rough=0.7, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1.0)
        b.inputs["Emission Strength"].default_value = strength
    return m


def hexc(h):
    return (((h >> 16) & 255) / 255.0, ((h >> 8) & 255) / 255.0, (h & 255) / 255.0)


def active():
    return bpy.context.view_layer.objects.active


def select_only(*objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def apply_scale(o):
    select_only(o)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def sphere(name, r, loc, scale=(1, 1, 1), mat=None, seg=24, rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=rings)
    o = active()
    o.name = name
    o.scale = scale
    apply_scale(o)
    if mat:
        o.data.materials.append(mat)
    return o


def box(name, size, loc, mat=None, bevel=0.0, segs=3, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = active()
    o.name = name
    o.scale = size
    o.rotation_euler = rot
    apply_scale(o)
    if bevel:
        mod = o.modifiers.new("b", "BEVEL")
        mod.width = bevel
        mod.segments = segs
        mod.limit_method = "NONE"
        select_only(o)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if mat:
        o.data.materials.append(mat)
    return o


def cyl(name, r, depth, loc, mat=None, verts=20, rot=(0, 0, 0), r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, vertices=verts, location=loc, rotation=rot)
    o = active()
    o.name = name
    if mat:
        o.data.materials.append(mat)
    return o


def join(objs, name):
    select_only(*objs)
    bpy.ops.object.join()
    o = active()
    o.name = name
    return o


def set_origin(o, at):
    bpy.context.scene.cursor.location = at
    select_only(o)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.context.scene.cursor.location = (0, 0, 0)


def parent(child, par):
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()


def export(root, filename):
    select_only(root, *root.children_recursive)
    path = os.path.join(HERE, filename)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB",
                              export_yup=True, export_apply=True)
    tris = 0
    for o in [root, *root.children_recursive]:
        if o.type == "MESH":
            tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    print("Exported", path, "tris", tris)


# ============================================================ Orbital VSAT
# A comms/recon satellite: a gold-foil bus, two long solar wings of blue
# cells in silver frames, a big dish looking down at the map, and a red
# status light so it reads as ours-and-live.

def build_vsat():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    foil = material("VS_Foil", hexc(0xd6a338), rough=0.28, metal=0.95)
    foil_dark = material("VS_FoilDark", hexc(0x8a6420), rough=0.35, metal=0.9)
    frame = material("VS_Frame", hexc(0xc9ccd0), rough=0.3, metal=0.9)
    cell = material("VS_Cell", hexc(0x1b3a86), rough=0.18, metal=0.55)
    dark = material("VS_Dark", hexc(0x202326), rough=0.45, metal=0.6)
    white = material("VS_White", hexc(0xe8eaec), rough=0.4, metal=0.2)
    red = material("VS_Red", hexc(0xff2a1a), rough=0.3, emit=hexc(0xff2a1a), strength=10)

    p = []
    # Bus: an octagonal prism in crinkled gold foil, banded top and bottom.
    p.append(cyl("bus", 0.75, 1.6, (0, 0, 0), foil, verts=8))
    p.append(cyl("bandTop", 0.78, 0.1, (0, 0, 0.72), frame, verts=8))
    p.append(cyl("bandBot", 0.78, 0.1, (0, 0, -0.72), frame, verts=8))
    for i in range(8):
        a = (i + 0.5) * math.pi / 4
        p.append(box(f"panel{i}", (0.05, 0.42, 1.2), (math.cos(a) * 0.72, math.sin(a) * 0.72, 0),
                     foil_dark, rot=(0, 0, a)))
    # Top: star tracker and a whip antenna; bottom: thruster bells.
    p.append(cyl("tracker", 0.16, 0.3, (0.3, 0.2, 0.95), dark, verts=14))
    p.append(cyl("mast", 0.025, 1.0, (-0.3, -0.25, 1.25), frame, verts=8))
    p.append(sphere("mastTip", 0.05, (-0.3, -0.25, 1.77), mat=white, seg=10, rings=6))
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        p.append(cyl(f"thruster{i}", 0.08, 0.2, (math.cos(a) * 0.4, math.sin(a) * 0.4, -0.9), dark, verts=12, r2=0.13))
    p.append(sphere("status", 0.06, (0, 0.78, 0.5), mat=red, seg=10, rings=6))
    bus = join(p, "VSAT_Bus")
    select_only(bus)
    bpy.ops.object.shade_auto_smooth(angle=math.radians(35))

    # Solar wings: a boom out each side, then three hinged panels of cells.
    for side, sx in (("L", -1), ("R", 1)):
        parts = [cyl("boom", 0.05, 0.9, (sx * 1.2, 0, 0), frame, verts=10, rot=(0, math.radians(90), 0)),
                 box("yoke", (0.12, 0.5, 0.12), (sx * 1.62, 0, 0), frame)]
        for k in range(3):
            x = sx * (2.35 + k * 1.3)
            parts.append(box(f"frame{k}", (1.24, 1.5, 0.05), (x, 0, 0), frame))
            for cx in range(3):
                for cy in range(4):
                    parts.append(box(f"cell{k}{cx}{cy}", (0.36, 0.33, 0.07),
                                     (x + (cx - 1) * 0.39, (cy - 1.5) * 0.36, 0), cell))
        wing = join(parts, f"VSAT_Wing_{side}")
        set_origin(wing, (sx * 0.75, 0, 0))
        parent(wing, bus)

    # Dish: a shallow bowl on a strut, looking down and forward, with its
    # feed horn on a tripod.
    dparts = [
        cyl("strut", 0.05, 0.6, (0, 0.55, -0.95), frame, verts=10, rot=(math.radians(40), 0, 0)),
        cyl("bowl", 0.85, 0.32, (0, 0.95, -1.3), white, verts=32, r2=0.18, rot=(math.radians(-140), 0, 0)),
        cyl("rim", 0.87, 0.04, (0, 1.05, -1.42), frame, verts=32, rot=(math.radians(-140), 0, 0)),
        cyl("feed", 0.07, 0.5, (0, 1.2, -1.62), dark, verts=10, rot=(math.radians(-140), 0, 0)),
    ]
    dish = join(dparts, "VSAT_Dish")
    select_only(dish)
    bpy.ops.object.shade_auto_smooth(angle=math.radians(35))
    set_origin(dish, (0, 0.55, -0.8))
    parent(dish, bus)

    export(bus, "orbital-vsat.glb")


build_vsat()
print("STREAKS3 DONE")
