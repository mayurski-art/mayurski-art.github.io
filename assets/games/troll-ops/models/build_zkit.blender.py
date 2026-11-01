"""
Troll Forces Zombies, the Rookie kit's deployables (modes/zombies/kits.js).

    blender --background --python build_zkit.blender.py
    blender --background --python build_zkit.blender.py -- --render <dir>

Writes next to this script:
  zk-turret.glb     sentry gun (Black Ops 2 style): turret_head (yaw pivot) > turret_gun
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


# ============================================================ Sentry Gun
# Black Ops 2's sentry gun (user, 2026-11-01, with a reference render: see
# refs/arms/sentry/NOTES.md): a six-barrel rotary gun on a boxy receiver,
# a big ammo box on its right with a light grey camera on top at the back,
# all on a pan head over a stout column and three straight splayed legs
# with knee collars and flat octagonal pads. Worn dark gunmetal, the box a
# greyer olive. Round where the real thing is (barrels, clamps, motor,
# column, legs, lens), square where it is (receiver, box, plates).
# Pivots: turret_head (yaw) at the pan head, turret_gun (pitch) at the
# trunnion, turret_barrels (the cluster, spun about its axis while firing)
# and turret_muzzle (an empty at the barrels' tips).

def build_turret():
    reset()
    gun_m = material("SentryGunmetal", hexc(0x2b2e32), rough=0.48, metal=0.7)
    black = material("SentryBlack", hexc(0x141517), rough=0.55, metal=0.5)
    edge = material("SentryEdge", hexc(0x5c6168), rough=0.35, metal=0.85)
    box_m = material("SentryBox", hexc(0x33362f), rough=0.7, metal=0.25)
    cam_m = material("SentryCamera", hexc(0xc9cdd2), rough=0.4, metal=0.3)
    glass = material("SentryGlass", hexc(0x0b1a24), rough=0.08, metal=0.2)
    led = material("SentryLed", hexc(0xff2b2b), rough=0.3, emit=hexc(0xff2b2b), strength=7.0)

    PAN_Z = 0.62          # the pan head: the head's yaw pivot
    TRUN_Z = 0.82         # the trunnion: the gun's pitch pivot
    SCALE = 1.2           # everything above is laid out 1/1.2 size, then scaled

    # ---- the stand: a stout column, three straight legs, octagonal pads
    parts = [cyl("Column", 0.05, PAN_Z - 0.28, (0, 0, (PAN_Z + 0.28) / 2), gun_m, verts=20)]
    parts.append(cyl("ColumnBand", 0.058, 0.04, (0, 0, PAN_Z - 0.08), black, verts=20))
    parts.append(cyl("Hub", 0.085, 0.1, (0, 0, 0.32), black, verts=20))
    parts.append(cyl("HubFoot", 0.06, 0.08, (0, 0, 0.24), gun_m, verts=16))
    for k in range(3):
        a = math.radians(90 + 120 * k)
        c, s = math.cos(a), math.sin(a)
        hip = (c * 0.07, s * 0.07, 0.33)
        knee = (c * 0.27, s * 0.27, 0.17)
        foot = (c * 0.44, s * 0.44, 0.03)
        parts.append(rod(f"Thigh{k}", hip, knee, 0.029, gun_m, verts=12))
        parts.append(rod(f"Shin{k}", knee, foot, 0.023, black, verts=12))
        parts.append(rod(f"Collar{k}", knee, tuple(knee[i] + (hip[i] - knee[i]) * 0.16 for i in range(3)), 0.036, edge, verts=12))
        parts.append(cyl(f"Pad{k}", 0.078, 0.03, (foot[0], foot[1], 0.014), black, verts=8))
        parts.append(cyl(f"PadTop{k}", 0.03, 0.02, (foot[0], foot[1], 0.036), gun_m, verts=8))
    legs = join(parts, "turret")

    # ---- the head: the pan head and the yoke
    hp = [cyl("Pan", 0.085, 0.06, (0, 0, PAN_Z + 0.03), black, verts=24)]
    hp.append(cyl("PanRim", 0.095, 0.015, (0, 0, PAN_Z + 0.005), edge, verts=24))
    hp.append(box("Saddle", (0.2, 0.14, 0.04), (0, 0, PAN_Z + 0.075), gun_m, bevel=0.012))
    for x in (-0.1, 0.1):
        hp.append(box(f"Cheek{x}", (0.022, 0.12, 0.13), (x, 0, PAN_Z + 0.145), black, bevel=0.008))
        hp.append(cyl(f"Knob{x}", 0.03, 0.025, (x + (0.022 if x > 0 else -0.022), 0, TRUN_Z), edge, verts=14, rot=(0, math.radians(90), 0)))
    head = join(hp, "turret_head")
    set_origin(head, (0, 0, PAN_Z))

    # ---- the gun about the trunnion (+Y downrange)
    G = TRUN_Z
    gp = [box("Receiver", (0.19, 0.38, 0.19), (0, 0.0, G + 0.03), gun_m, bevel=0.02)]
    gp.append(box("TopRail", (0.07, 0.3, 0.02), (0, 0.0, G + 0.13), black, bevel=0.005))
    gp.append(box("SideL", (0.01, 0.26, 0.12), (-0.1, 0.01, G + 0.03), black, bevel=0.003))
    gp.append(box("Rear", (0.16, 0.05, 0.15), (0, -0.21, G + 0.03), black, bevel=0.014))
    # the motor housing the cluster comes out of
    gp.append(rod("Motor", (0, 0.18, G), (0, 0.27, G), 0.075, black, verts=24))
    gp.append(rod("MotorRing", (0, 0.265, G), (0, 0.29, G), 0.082, edge, verts=24))
    # the ammo box on the right, a feed chute into the receiver
    gp.append(box("AmmoBox", (0.18, 0.32, 0.25), (0.2, -0.08, G + 0.04), box_m, bevel=0.014, rot=(math.radians(10), 0, 0)))
    gp.append(box("AmmoLid", (0.19, 0.33, 0.025), (0.2, -0.1, G + 0.18), black, bevel=0.006, rot=(math.radians(10), 0, 0)))
    gp.append(box("AmmoRib", (0.185, 0.015, 0.24), (0.2, 0.03, G + 0.05), black, rot=(math.radians(10), 0, 0)))
    gp.append(box("AmmoLatch", (0.01, 0.06, 0.04), (0.293, -0.02, G + 0.11), edge))
    gp.append(rod("Chute", (0.12, 0.06, G + 0.08), (0.08, 0.1, G + 0.08), 0.026, black, verts=10))
    # the camera: a light grey box on the ammo box's top at the back, lens forward
    gp.append(box("CamMount", (0.03, 0.04, 0.05), (0.02, -0.1, G + 0.16), black))
    gp.append(box("Camera", (0.09, 0.16, 0.075), (0.02, -0.07, G + 0.22), cam_m, bevel=0.022))
    gp.append(rod("CamHood", (0.02, 0.01, G + 0.22), (0.02, 0.035, G + 0.22), 0.028, black, verts=20))
    gp.append(rod("CamLens", (0.02, 0.03, G + 0.22), (0.02, 0.039, G + 0.22), 0.021, glass, verts=20))
    gp.append(cyl("Led", 0.008, 0.01, (0.05, 0.012, G + 0.245), led, verts=10, rot=(math.radians(90), 0, 0)))
    gun = join(gp, "turret_gun")
    set_origin(gun, (0, 0, G))

    # ---- the rotary cluster: six barrels round a spindle, two clamps, a
    # muzzle ring with the bores showing; spins about its own axis
    BR = 0.046            # the barrels' circle
    bp = [rod("Spindle", (0, 0.28, G), (0, 0.6, G), 0.02, edge, verts=12)]
    for i in range(6):
        a = i * math.pi / 3
        x, z = math.cos(a) * BR, G + math.sin(a) * BR
        bp.append(rod(f"Barrel{i}", (x, 0.28, z), (x, 0.64, z), 0.0145, gun_m, verts=12))
        bp.append(rod(f"Bore{i}", (x, 0.64, z), (x, 0.642, z), 0.008, black, verts=10))
    for y, w, r in ((0.3, 0.035, 0.022), (0.46, 0.03, 0.02), (0.57, 0.05, 0.024)):
        bp.append(rod(f"Clamp{y}", (0, y, G), (0, y + w, G), BR + r, black, verts=24))
    barrels = join(bp, "turret_barrels")
    set_origin(barrels, (0, 0, G))

    muzzle = bpy.data.objects.new("turret_muzzle", None)
    bpy.context.scene.collection.objects.link(muzzle)
    muzzle.location = (0, 0.65, G)

    parent(head, legs)
    parent(gun, head)
    parent(barrels, gun)
    parent(muzzle, gun)
    # BO2's size (user, 2026-11-01): barrels at a soldier's waist, 1.3 m to
    # the camera, the tripod about as wide as it is tall
    legs.scale = (SCALE, SCALE, SCALE)
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
