"""
Troll Forces — the humans in the Socialize crowds (docs/KB-HUMANS.md):
real-looking MakeHuman people who move, worn by town NPCs.

    blender --background --python build_people.blender.py -- render [names]
    blender --background --python build_people.blender.py -- export [names]

Built the way the cops are (it runs build_cops.blender.py minus its main(),
which runs the mannequin builder, which borrows the zombie builder): the
same bodies, skin, hair and recoloured clothes, plus each look's kit, and
the same export: rigged, no clips, ONE skinned mesh on ONE atlas, the
game_engine rig, feet on y = 0, facing +z. A crowd needs more looks than a
squad, so each one is lighter (BUDGET): ppl-<name>.glb.

Unlike the cops' kit (rigid, one bone each) the kit here takes its weights
from the body under it, so an apron bends with the thighs and a chain with
the chest.

render: a four-view sheet per look and pose (3/4 front, side, 3/4 back,
top), each view with a Hollowgrin mannequin standing beside it for scale:
_renders/ppl-<name>-<pose>-sheet.png. PP_POSES=stand,reach picks the poses.
"""
import bpy
import math
import os
import sys
import numpy as np
from mathutils import Matrix, Vector
from mathutils.kdtree import KDTree

HERE = os.path.dirname(os.path.abspath(__file__))
_CB = os.path.join(HERE, "build_cops.blender.py")
_src = open(_CB, encoding="utf8").read()
C = {"__file__": _CB, "__name__": "build_cops"}
exec(compile(_src[: _src.rindex("\nmain()")], _CB, "exec"), C)
Q, Z = C["Q"], C["Z"]
bone, mesh_obj, cube, cyl = Q["bone"], Q["mesh_obj"], Q["cube"], Q["cyl"]
surf, patch, extent, flat = Q["surf"], Q["patch"], Q["extent"], Z["flat"]
ring, offset_ring, band = C["ring"], C["offset_ring"], C["band"]

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER_DIR = os.environ.get("PP_RENDER_DIR", os.path.join(HERE, "_renders"))
C["PREFIX"] = "ppl"
# per part, as the cops' (body 6000, cloth 2600 ...) but a crowd's share
C["BUDGET"].update({"body": 3000, "hair": 1000, "cloth": 1400, "shoe": 320, "kit": 700})

# ---------------------------------------------------------------- poses
# Renders only (the game drives the bones). "reach": bent at the hips and
# knees, the right hand down to a low shelf: the elbows, knees and hips the
# sheet has to show bending clean.
ARMS_DOWN = Q["ARMS_DOWN"]
REACH = [
    ("pelvis", ("drop", 0.07)),
    ("spine_01", ("X", 24)), ("spine_02", ("X", 16)), ("spine_03", ("X", 8)), ("head", ("X", 10)),
    ("thigh_l", (0.1, -0.55, -0.83)), ("calf_l", (0.03, 0.42, -0.9)), ("foot_l", (0.0, -1, -0.12)),
    ("thigh_r", (-0.1, -0.48, -0.87)), ("calf_r", (-0.03, 0.38, -0.92)), ("foot_r", (0.0, -1, -0.12)),
    ("upperarm_r", (-0.12, -0.55, -0.83)), ("lowerarm_r", (-0.05, -0.62, -0.78)),
    ("upperarm_l", (0.25, -0.2, -0.95)), ("lowerarm_l", (0.12, -0.55, -0.83)),
    ("fingers", ("curl", 35)),
]
POSES = {"stand": ARMS_DOWN, "reach": REACH}

# ---------------------------------------------------------------- the cast
# As the cops': clothes (asset, colour, keep), kit = the pieces modelled here.
CAST = {
    # the dance floor and the bar: a short champagne dress, long dark hair
    "clubber_f": dict(
        macros=dict(gender=0.0, age=0.5, muscle=0.42, weight=0.42, height=0.55), skin="young_asian_female",
        clothes=[("toigo_cut_out_dress", 0xb8924a, 0.08), ("shoes04", 0x0c0c0e, 0.0)],
        hair=("long01", 0x17110d), brows="eyebrow010",
        kit=("necklace",),
    ),
    # the floor, the bar, the line: black tee, olive cargos, white kicks, a chain
    "clubber_m": dict(
        macros=dict(gender=1.0, age=0.52, muscle=0.6, weight=0.48, height=0.6), skin="young_african_male",
        clothes=[("elvs_crude_t-shirt_male", 0x141416, 0.05), ("cortu_cargo_pants", 0x4a4f3a, 0.05), ("shoes05", 0xe6e6e2, 0.2)],
        hair=("short02", 0x0e0c0a), brows="eyebrow001",
        kit=("chain",),
    ),
    # the same clubber in a rubber trollface mask: a troll in disguise
    "clubber_grin": dict(
        macros=dict(gender=1.0, age=0.52, muscle=0.6, weight=0.48, height=0.6), skin="young_african_male",
        clothes=[("elvs_crude_t-shirt_male", 0x141416, 0.05), ("cortu_cargo_pants", 0x4a4f3a, 0.05), ("shoes05", 0xe6e6e2, 0.2)],
        mask=True,
        kit=("chain",),
    ),
    # behind the bar: all black, a waist apron, a towel on the string
    "bartender": dict(
        macros=dict(gender=1.0, age=0.56, muscle=0.5, weight=0.45, height=0.55), skin="young_asian_male",
        clothes=[("toigo_basic_tucked_t-shirt", 0x131315, 0.05), ("toigo_wool_pants", 0x0f0f11, 0.05), ("shoes02", 0x0e0e0e, 0.2)],
        hair=("short04", 0x16110d), brows="eyebrow005",
        kit=("waist_apron", "towel"),
    ),
    # A Main, the konbini, asleep by the vending machine: a grey suit
    "salaryman": dict(
        macros=dict(gender=1.0, age=0.55, muscle=0.42, weight=0.6, height=0.5), skin="middleage_asian_male",
        clothes=[("male_elegantsuit01", 0x50545a, 0.12), ("shoes02", 0x141210, 0.2)],
        hair=("short01", 0x171513), brows="eyebrow004",
    ),
}


def palette():
    P = {
        "gold": flat("PP_Gold", 0xc9a23a, 0.25), "steel": flat("PP_Steel", 0xc4c8cc, 0.25),
        "apron": flat("PP_Apron", 0x30353d, 0.8), "white": flat("PP_Towel", 0xe9e6de, 0.9),
    }
    for m in P.values():
        m.use_fake_user = True
    return P


# ---------------------------------------------------------------- the kit
def neck_chain(rig, name, mat, drop, r, n=36):
    """A chain round the base of the neck, dipping `drop` down the chest at
    the front: a thin tube through points cast onto the figure."""
    nk = bone(rig, "neck_01")
    z0 = nk.z - 0.035
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        d = Vector((math.sin(a), -math.cos(a), 0.0))
        dz = drop * max(0.0, math.cos(a)) ** 2
        pts.append(surf(Vector((nk.x, nk.y, z0 - dz)), d, lift=r + 0.002, skip_arms=True))
    def build(b):
        for i in range(n):
            cyl(b, pts[i], pts[(i + 1) % n], r, r, 6, cap=False)
    return [mesh_obj(name, build, mat)]


def k_chain(rig, bm, P):
    return neck_chain(rig, "PPk_chain", P["gold"], 0.13, 0.0065)


def k_necklace(rig, bm, P):
    return neck_chain(rig, "PPk_necklace", P["gold"], 0.05, 0.0022)


def k_waist_apron(rig, bm, P):
    """A bar apron: a string round the waist and a sheet from it to above
    the knee: laid on the hips, then hanging straight over the thighs (it
    takes their weights, so it swings with a stride)."""
    lo_shirt, _ = extent(rig, "t-shirt")
    z = lo_shirt.z + 0.03
    pel = bone(rig, "pelvis")
    center = Vector((0.0, pel.y, z))
    waist = ring(z, center, 28)
    lo, hi = offset_ring(waist, z - 0.008, 0.006), offset_ring(waist, z + 0.008, 0.006)
    knee = bone(rig, "calf_l")
    out = [mesh_obj("PPk_string", lambda b: band(b, lo, hi), P["apron"])]
    out.append(mesh_obj("PPk_apron", lambda b: patch(b, 0.0, z, knee.z + 0.1, 0.2, cols=6, rows=10, y=pel.y, hang=pel.z - 0.04, lift=0.022), P["apron"]))
    return out


def k_towel(rig, bm, P):
    """A bar towel tucked into the apron string on the right hip."""
    lo_shirt, _ = extent(rig, "t-shirt")
    z = lo_shirt.z + 0.03
    p = surf(Vector((-0.12, bone(rig, "pelvis").y, z - 0.09)), (-0.55, -0.83, 0), lift=0.016, skip_arms=True)
    yaw = math.atan2(-0.55, 0.83)
    return [mesh_obj("PPk_towel", lambda b: cube(b, p, (0.13, 0.012, 0.2), Matrix.Rotation(yaw, 3, "Z")), P["white"])]


KIT = {"chain": k_chain, "necklace": k_necklace, "waist_apron": k_waist_apron, "towel": k_towel}
C["KIT"] = KIT


def bind_skin(ob, rig, body):
    """Ride the body: each vertex takes the bone weights of the nearest body
    vertices (the body as it stands, shape keys applied), so the piece
    bends with what it lies on."""
    snap = Z["_snapshot"](body, "PP_tmp_body")
    me, mw = snap.data, snap.matrix_world
    kd = KDTree(len(me.vertices))
    for v in me.vertices:
        kd.insert(mw @ v.co, v.index)
    kd.balance()
    names = {g.index: g.name for g in snap.vertex_groups}
    bones = set(rig.data.bones.keys())
    groups = {}
    for v in ob.data.vertices:
        acc = {}
        for co, idx, d in kd.find_n(ob.matrix_world @ v.co, 4):
            k = 1.0 / (d + 0.004)
            for ge in me.vertices[idx].groups:
                n = names[ge.group]
                if n in bones and ge.weight > 0.01:
                    acc[n] = acc.get(n, 0.0) + ge.weight * k
        tot = sum(acc.values()) or 1.0
        for n, w in acc.items():
            groups.setdefault(n, []).append((v.index, w / tot))
    for n, vs in groups.items():
        g = ob.vertex_groups.new(name=n)
        for i, w in vs:
            g.add([i], w, "REPLACE")
    bpy.data.objects.remove(snap)
    ob.parent = rig
    ob.matrix_parent_inverse = rig.matrix_world.inverted()
    md = ob.modifiers.new("Armature", "ARMATURE")
    md.object = rig


def build(name, look, P):
    """The cops' build, with the kit skinned to the body (bind_skin)."""
    bm, rig = Q["make_person"](look)
    Z["_rest"](rig)
    bpy.context.view_layer.update()
    if look.get("mask"):
        _, eyes = Z["face_masks"](bm, rig)
        Z["rubber_mask_material"] = C["clean_mask_material"]
        Z["rubber_mask"](bm, rig, eyes)
        bpy.context.view_layer.update()
    Q["surface_trees"](rig)
    kit = []
    for k in look.get("kit", ()):
        for ob in KIT[k](rig, bm, P):
            bind_skin(ob, rig, bm)
            kit.append(ob)
    return bm, rig, kit


C["build"] = build     # export_cop calls build() through its globals


# ---------------------------------------------------------------- the sheet
MANNEQUIN = os.path.join(HERE, os.environ.get("PP_BESIDE", "mq-attendant.glb"))
VIEWS = [("3/4 front", 30, False), ("side", 90, False), ("3/4 back", 210, False), ("top", 30, True)]


def beside():
    """A Hollowgrin mannequin, for scale: its root objects, to be moved per view."""
    if not os.path.exists(MANNEQUIN):
        return []
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=MANNEQUIN)
    return [o for o in bpy.data.objects if o not in before and o.parent is None]


def sheet(name, pose, cam, roots):
    """Four views, each with the mannequin to the person's left on screen
    (turned the same way, so both show the same side), tiled 2x2."""
    tiles = []
    w, h = 640, 860
    for i, (label, yaw, top) in enumerate(VIEWS):
        y = math.radians(yaw)
        right = Vector((math.cos(y), math.sin(y), 0.0))      # the camera's right, on the ground
        for o in roots:
            o.location = -right * 0.8
        mid = -right * 0.4
        path = os.path.join(RENDER_DIR, f"_ppl-{name}-{pose}-{i}.png")
        if top:
            Z["shoot"](cam, path, yaw, target=(mid.x, mid.y, 0.6), dist=0.9, height=4.6, lens=52, w=w, h=h)
        else:
            Z["shoot"](cam, path, yaw, target=(mid.x, mid.y, 0.86), dist=4.9, height=1.2, lens=72, w=w, h=h)
        img = bpy.data.images.load(path)
        tiles.append(np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4))
        bpy.data.images.remove(img)
        os.remove(path)
    # Blender's pixel rows run bottom-up: the bottom row of tiles goes first
    grid = np.concatenate([np.concatenate(tiles[2:4], axis=1), np.concatenate(tiles[0:2], axis=1)], axis=0)
    out = bpy.data.images.new(f"sheet_{name}_{pose}", 2 * w, 2 * h, alpha=True)
    out.pixels = grid.ravel().tolist()
    out.filepath_raw = os.path.join(RENDER_DIR, f"ppl-{name}-{pose}-sheet.png")
    out.file_format = "PNG"
    out.save()
    print(f"SHEET {out.filepath_raw}")


# ---------------------------------------------------------------- main
def main():
    names = [a for a in ARGS if a in CAST] or list(CAST)
    os.makedirs(RENDER_DIR, exist_ok=True)
    for name in names:
        Z["clear_scene"]()
        P = palette()
        look = CAST[name]
        if "export" in ARGS:
            C["export_cop"](name, look, P)
            continue
        bm, rig, kit = build(name, look, P)
        cam = Z["render_setup"]()
        bpy.context.scene.view_settings.exposure = float(os.environ.get("PP_EXPOSURE", "-0.3"))
        roots = beside()
        for pose in os.environ.get("PP_POSES", "stand,reach").split(","):
            Z["_rest"](rig)
            Z["apply_spec"](rig, POSES[pose])
            sheet(name, pose, cam, roots)


main()
