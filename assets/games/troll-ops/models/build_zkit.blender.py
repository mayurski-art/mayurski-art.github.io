"""
Troll Forces Zombies, the Rookie kit's deployables (modes/zombies/kits.js).

    blender --background --python build_zkit.blender.py
    blender --background --python build_zkit.blender.py -- --render <dir>

Writes next to this script:
  zk-turret.glb     tripod auto turret: turret_head (yaw pivot) > turret_gun
                    (pitch pivot, recoils along its -Y) > turret_muzzle (empty)
  zk-spikewall.glb  sharpened stakes lashed to a log frame, leaning at +Y
  zk-barrel.glb     a red drum with a hazard band round the top
With --render, also a PNG of each into <dir> (workbench, for a look).

Conventions as build_streaks3.blender.py: metres, Blender +Y is "forward"
(the gun's line, the stakes' lean), feet on z = 0, linear colours (hexc).
"""
import bpy
import math
import os
import random
import sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER_DIR = ARGS[ARGS.index("--render") + 1] if "--render" in ARGS else None


def hexc(h):
    c = (((h >> 16) & 255) / 255.0, ((h >> 8) & 255) / 255.0, (h & 255) / 255.0)
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


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
    m.diffuse_color = (*color, 1.0)   # what the workbench preview shows
    return m


def active():
    return bpy.context.view_layer.objects.active


def select_only(*objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def apply_all(o):
    select_only(o)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def box(name, size, loc, mat=None, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = active()
    o.name = name
    o.scale = size
    o.rotation_euler = rot
    apply_all(o)
    if bevel:
        mod = o.modifiers.new("b", "BEVEL")
        mod.width = bevel
        mod.segments = 2
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
    apply_all(o)
    if mat:
        o.data.materials.append(mat)
    return o


def rod(name, a, b, r, mat=None, verts=10, r2=None):
    """A cylinder (or cone, r -> r2) from point a to point b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    rot = d.to_track_quat("Z", "Y").to_euler()
    return cyl(name, r, d.length, (a + b) / 2, mat, verts, rot, r2)


def join(objs, name):
    select_only(*objs)
    bpy.ops.object.join()
    o = active()
    o.name = name
    apply_all(o)   # join keeps the first part's transform (see the gotchas note)
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
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in [root, *root.children_recursive] if o.type == "MESH")
    print("Exported", path, "tris", tris)
    if RENDER_DIR:
        render(root, os.path.join(RENDER_DIR, filename.replace(".glb", ".png")))


def render(root, path):
    """A three-quarter look from the front-left, flat studio light."""
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.display.shading.show_shadows = True
    sc.display.shading.show_cavity = True
    sc.render.resolution_x = 640
    sc.render.resolution_y = 640
    sc.render.film_transparent = False
    world = bpy.data.worlds.new("w")
    world.color = (0.18, 0.2, 0.24)
    sc.world = world
    sc.display.shading.background_type = "WORLD"
    lo = Vector((1e9, 1e9, 1e9)); hi = -lo
    for o in [root, *root.children_recursive]:
        if o.type != "MESH":
            continue
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    mid = (lo + hi) / 2
    size = max(hi - lo)
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("cam", cam_data)
    sc.collection.objects.link(cam)
    eye = mid + Vector((-1.15, 1.6, 0.85)).normalized() * size * 2.4
    cam.location = eye
    cam.rotation_euler = (mid - eye).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("Rendered", path)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(7)


# ============================================================ Auto Turret
# A squat sentry gun on a tripod, after Zombie Rush's Auto Turret: a pale
# grey housing with a safety-yellow band, twin barrels, an ammo can on the
# left, a red sensor eye. Head pivot at the top of the post.

def build_turret():
    reset()
    steel = material("TurretSteel", hexc(0x3a3f47), rough=0.45, metal=0.6)
    dark = material("TurretDark", hexc(0x1d2025), rough=0.5, metal=0.5)
    shell = material("TurretShell", hexc(0xc9ced6), rough=0.55, metal=0.15)
    yellow = material("TurretStripe", hexc(0xf2c230), rough=0.6)
    olive = material("TurretAmmo", hexc(0x5a6b3a), rough=0.7)
    eye = material("TurretEye", hexc(0xff2b2b), rough=0.3, emit=hexc(0xff2b2b), strength=6.0)

    HEAD_Z = 0.78
    parts = [cyl("Base", 0.2, 0.07, (0, 0, 0.12), steel, verts=6)]
    parts.append(cyl("Post", 0.05, HEAD_Z - 0.12, (0, 0, (HEAD_Z + 0.12) / 2), steel, verts=12))
    parts.append(cyl("Collar", 0.09, 0.06, (0, 0, HEAD_Z - 0.06), dark, verts=16))
    for k in range(3):
        a = math.radians(90 + 120 * k)
        foot = (math.cos(a) * 0.5, math.sin(a) * 0.5, 0.02)
        hip = (math.cos(a) * 0.12, math.sin(a) * 0.12, 0.16)
        parts.append(rod(f"Leg{k}", hip, foot, 0.035, dark, verts=8))
        parts.append(box(f"Foot{k}", (0.12, 0.12, 0.03), (foot[0], foot[1], 0.015), steel))
    legs = join(parts, "turret")

    # the head: housing, band, ammo can, eye
    hp = [box("Shell", (0.36, 0.44, 0.24), (0, 0.02, HEAD_Z + 0.13), shell, bevel=0.03)]
    hp.append(box("BandL", (0.012, 0.3, 0.07), (0.185, 0.02, HEAD_Z + 0.12), yellow))
    hp.append(box("BandR", (0.012, 0.3, 0.07), (-0.185, 0.02, HEAD_Z + 0.12), yellow))
    hp.append(box("Hood", (0.3, 0.22, 0.05), (0, -0.05, HEAD_Z + 0.27), steel, bevel=0.015))
    hp.append(box("Ammo", (0.12, 0.24, 0.16), (-0.25, -0.02, HEAD_Z + 0.1), olive, bevel=0.012))
    hp.append(box("AmmoLid", (0.13, 0.25, 0.02), (-0.25, -0.02, HEAD_Z + 0.185), dark))
    hp.append(cyl("Eye", 0.035, 0.03, (0.1, 0.245, HEAD_Z + 0.2), eye, verts=12, rot=(math.radians(90), 0, 0)))
    hp.append(cyl("EyeRim", 0.048, 0.02, (0.1, 0.235, HEAD_Z + 0.2), dark, verts=12, rot=(math.radians(90), 0, 0)))
    head = join(hp, "turret_head")
    set_origin(head, (0, 0, HEAD_Z))

    # the guns: twin barrels with a shroud and brakes, pitching about the trunnion
    GUN_Z = HEAD_Z + 0.12
    gp = [box("Shroud", (0.2, 0.2, 0.1), (0, 0.27, GUN_Z), steel, bevel=0.012)]
    for x in (-0.055, 0.055):
        gp.append(rod(f"Barrel{x}", (x, 0.3, GUN_Z), (x, 0.74, GUN_Z), 0.024, dark, verts=12))
        gp.append(rod(f"Brake{x}", (x, 0.68, GUN_Z), (x, 0.76, GUN_Z), 0.034, steel, verts=12))
        gp.append(rod(f"Jacket{x}", (x, 0.36, GUN_Z), (x, 0.5, GUN_Z), 0.034, steel, verts=6))
    gun = join(gp, "turret_gun")
    set_origin(gun, (0, 0.2, GUN_Z))

    muzzle = bpy.data.objects.new("turret_muzzle", None)
    bpy.context.scene.collection.objects.link(muzzle)
    muzzle.location = (0, 0.78, GUN_Z)

    parent(head, legs)
    parent(gun, head)
    parent(muzzle, gun)
    export(legs, "zk-turret.glb")


# ============================================================ Barricade
# A row of sharpened stakes lashed to a log frame, leaning out at +Y (the
# side the zombies come from), on two crossed trestles.

def build_spikewall():
    reset()
    wood = material("SpikeWood", hexc(0x7a4a26), rough=0.85)
    dark = material("SpikeLog", hexc(0x4e2f18), rough=0.9)
    tip = material("SpikeTip", hexc(0xd9c39a), rough=0.8)
    rope = material("SpikeRope", hexc(0x8f7a4c), rough=0.95)

    W = 2.4
    parts = [rod("BaseLog", (-W / 2, -0.12, 0.13), (W / 2, -0.12, 0.13), 0.09, dark, verts=10)]
    parts.append(rod("TopLog", (-W / 2 + 0.05, -0.2, 0.62), (W / 2 - 0.05, -0.2, 0.62), 0.065, dark, verts=10))
    for x in (-W / 2 + 0.2, W / 2 - 0.2):
        parts.append(rod(f"TrestleA{x}", (x, -0.32, 0.0), (x, 0.12, 0.72), 0.05, wood, verts=8))
        parts.append(rod(f"TrestleB{x}", (x, 0.18, 0.0), (x, -0.3, 0.72), 0.05, wood, verts=8))
    # two rows: tall stakes behind, shorter ones in front between them
    stakes = [(-W / 2 + 0.12 + i * (W - 0.24) / 10, -0.3, 1.2, 1.45) for i in range(11)]
    stakes += [(-W / 2 + 0.23 + i * (W - 0.46) / 9, -0.08, 0.8, 1.0) for i in range(10)]
    for i, (x0, y0, lo_len, hi_len) in enumerate(stakes):
        x = x0 + random.uniform(-0.03, 0.03)
        lean = math.radians(random.uniform(24, 38))
        length = random.uniform(lo_len, hi_len)
        base = Vector((x, y0, 0.02))
        dirv = Vector((random.uniform(-0.06, 0.06), math.sin(lean), math.cos(lean))).normalized()
        shaft_end = base + dirv * (length - 0.22)
        point = base + dirv * length
        parts.append(rod(f"Stake{i}", base, shaft_end, 0.07, wood if i % 3 else dark, verts=7))
        parts.append(rod(f"Tip{i}", shaft_end, point, 0.07, tip, verts=7, r2=0.004))
        if y0 < -0.2:
            # lashed where it crosses the top log
            t = (0.62 - base.z) / dirv.z
            lash = base + dirv * t
            parts.append(rod(f"Lash{i}", lash - dirv * 0.045, lash + dirv * 0.045, 0.078, rope, verts=7))
    root = join(parts, "spikewall")
    export(root, "zk-spikewall.glb")


# ============================================================ Explosive Barrel
# A red drum with rolled rims, a yellow-and-black hazard band round the top
# and a bung on the lid: it reads as "don't shoot this" from across a map.

def build_barrel():
    reset()
    red = material("BarrelRed", hexc(0xc4231b), rough=0.45, metal=0.25)
    rim = material("BarrelRim", hexc(0x8e1812), rough=0.4, metal=0.35)
    lid = material("BarrelLid", hexc(0x2a2d31), rough=0.5, metal=0.4)
    yel = material("BarrelHazardY", hexc(0xf6c218), rough=0.55)
    blk = material("BarrelHazardK", hexc(0x16171a), rough=0.55)

    R, H = 0.36, 1.0
    parts = [cyl("Drum", R, H, (0, 0, H / 2), red, verts=28)]
    for z in (0.04, 0.36, 0.64, H - 0.04):
        parts.append(cyl(f"Rim{z}", R + 0.014, 0.035, (0, 0, z), rim, verts=28))
    parts.append(cyl("Lid", R - 0.02, 0.02, (0, 0, H + 0.005), lid, verts=28))
    parts.append(cyl("Bung", 0.05, 0.03, (0.17, 0.05, H + 0.025), lid, verts=12))

    # the hazard band: one ring, its sides painted alternately
    band = cyl("Band", R + 0.006, 0.2, (0, 0, 0.8), yel, verts=24)
    band.data.materials.append(blk)
    for p in band.data.polygons:
        if len(p.vertices) == 4:
            p.material_index = p.index % 2   # twelve stripes of each
    parts.append(band)
    root = join(parts, "barrel")
    export(root, "zk-barrel.glb")


build_turret()
build_spikewall()
build_barrel()
