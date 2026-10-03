"""
Troll Forces — Hollowgrin's mannequins (hollowgrin-mannequins.js): Nuketown
style, real-looking people frozen mid-moment round the village, the chapel
and the fair.

    blender --background --python build_mannequins.blender.py -- render [names]
    blender --background --python build_mannequins.blender.py -- export [names]

Bodies are MakeHuman (MPFB 2 + the CC0 packs, see the zombie builder and
HANDOFF.md session "zombies"); this borrows build_zombies.blender.py's
plumbing (it runs that file minus its main()). Per figure: a body (sex, age,
build), its skin with a mannequin's sheen, eyebrows and lashes, period
clothes recoloured, hair, a pose on the game_engine rig, props (a book, a
candy bowl, a witch's hat...). Export freezes it: the posed mesh, each part
decimated, all of it baked onto ONE texture atlas (the head's islands given
extra room), one material, no rig: mq-<name>.glb, feet on y = 0, facing +z.

The pets aren't MakeHuman: they're built from skin-modifier sketches here
(build_pet), plain colours, no bake.
"""
import bmesh
import bpy
import math
import os
import sys
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
_ZB = os.path.join(HERE, "build_zombies.blender.py")
_src = open(_ZB, encoding="utf8").read()
Z = {"__file__": _ZB, "__name__": "build_zombies"}
exec(compile(_src[: _src.rindex("\nmain()")], _ZB, "exec"), Z)
HumanService, TargetService = Z["HumanService"], Z["TargetService"]
user_asset, hexlin, flat, _nodes = Z["user_asset"], Z["hexlin"], Z["flat"], Z["_nodes"]
MPFB_USER = Z["MPFB_USER"]

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER_DIR = os.environ.get("MQ_RENDER_DIR", os.path.join(HERE, "_renders"))
BAKE_DIR = os.environ.get("MQ_BAKE_DIR", os.path.join(os.environ.get("TEMP", "/tmp"), "mq_bake"))

# ---------------------------------------------------------------- poses
# As the zombie builder's: (bone, (x, y, z)) aims a bone along a WORLD
# direction (+X the body's left, -Y forward, +Z up); (bone, (axis, deg))
# turns it about a world axis. Parents before children.
ARMS_DOWN = [
    ("upperarm_l", (0.16, 0.02, -1)), ("lowerarm_l", (0.08, -0.12, -1)),
    ("upperarm_r", (-0.16, 0.02, -1)), ("lowerarm_r", (-0.08, -0.12, -1)),
]
ARM_L_DOWN, ARM_R_DOWN = ARMS_DOWN[:2], ARMS_DOWN[2:]
SIT = [
    ("thigh_l", (0.1, -1, 0.05)), ("calf_l", (0.02, -0.12, -1)), ("foot_l", (0.0, -1, -0.15)),
    ("thigh_r", (-0.1, -1, 0.05)), ("calf_r", (-0.02, -0.12, -1)), ("foot_r", (0.0, -1, -0.15)),
]
HANDS_IN_LAP = [
    ("upperarm_l", (0.14, -0.35, -0.93)), ("lowerarm_l", (-0.35, -0.92, -0.1)),
    ("upperarm_r", (-0.14, -0.35, -0.93)), ("lowerarm_r", (0.35, -0.92, -0.1)),
]
POSES = {
    # the priest: right hand raised in blessing, the book in the left
    "bless": [
        ("spine_03", ("X", -3)), ("head", ("X", 10)),
        ("upperarm_r", (-0.62, -0.62, -0.15)), ("lowerarm_r", (-0.08, -0.25, 0.97)), ("hand_r", (-0.02, -0.1, 1.0)),
        ("upperarm_l", (0.2, -0.18, -0.96)), ("lowerarm_l", (-0.12, -0.97, -0.12)),
    ],
    # the man begging at the rail: up on his knees, hands reaching
    "beg": [
        ("thigh_l", (0.12, 0.08, -1)), ("calf_l", (0.03, 1, -0.05)), ("foot_l", (0, 1, -0.3)),
        ("thigh_r", (-0.12, 0.08, -1)), ("calf_r", (-0.03, 1, -0.05)), ("foot_r", (0, 1, -0.3)),
        ("spine_02", ("X", -6)), ("neck_01", ("X", -10)), ("head", ("X", -16)),
        ("upperarm_l", (0.22, -0.85, -0.25)), ("lowerarm_l", (-0.5, -0.55, 0.65)),
        ("upperarm_r", (-0.22, -0.85, -0.25)), ("lowerarm_r", (0.5, -0.55, 0.65)),
    ],
    # in a pew, head bowed, hands folded in the lap
    "pray": SIT + HANDS_IN_LAP + [("spine_03", ("X", 8)), ("head", ("X", 24))],
    "sit": SIT + HANDS_IN_LAP + [("head", ("Z", 12))],
    "sit_lean": SIT + HANDS_IN_LAP + [("spine_02", ("Y", 5)), ("head", ("Z", -14)), ("head", ("X", 6))],
    # the 60s mom: candy bowl held out, the other hand at her collar
    "offer": [
        ("head", ("Z", 10)), ("head", ("X", -4)),
        ("upperarm_r", (-0.2, -0.45, -0.87)), ("lowerarm_r", (0.12, -0.97, -0.05)),
        ("upperarm_l", (0.24, -0.15, -0.96)), ("lowerarm_l", (-0.55, -0.55, 0.62)),
    ],
    # dad with the flashlight, pointing it up the lane
    "torch": ARM_L_DOWN + [
        ("upperarm_r", (-0.12, -0.82, -0.55)), ("lowerarm_r", (0.0, -0.96, -0.28)),
        ("head", ("Z", -8)),
    ],
    # a trick-or-treater, bucket in the right hand
    "bucket": ARM_L_DOWN + [
        ("upperarm_r", (-0.12, -0.3, -0.95)), ("lowerarm_r", (-0.06, -0.8, -0.6)),
        ("head", ("X", -8)),
    ],
    "ghost": ARM_L_DOWN + [("upperarm_r", (-0.14, -0.62, -0.77)), ("lowerarm_r", (-0.05, -0.95, -0.3))],
    "wave": ARM_L_DOWN + [("upperarm_r", (-0.75, -0.2, 0.45)), ("lowerarm_r", (-0.18, -0.15, 0.97))],
    "counter": [
        ("upperarm_l", (0.18, -0.5, -0.85)), ("lowerarm_l", (0.04, -0.98, -0.12)),
        ("upperarm_r", (-0.18, -0.5, -0.85)), ("lowerarm_r", (-0.04, -0.98, -0.12)),
        ("spine_02", ("X", 6)),
    ],
    "clasp": [
        ("upperarm_l", (0.12, -0.25, -0.96)), ("lowerarm_l", (-0.55, -0.8, -0.1)),
        ("upperarm_r", (-0.12, -0.25, -0.96)), ("lowerarm_r", (0.55, -0.8, -0.1)),
        ("head", ("Z", 6)),
    ],
    "fork": ARM_L_DOWN + [("upperarm_r", (-0.3, -0.05, -0.95)), ("lowerarm_r", (-0.08, -0.85, 0.5))],
    "candy": ARM_L_DOWN + [
        ("upperarm_r", (-0.2, -0.62, -0.76)), ("lowerarm_r", (0.22, -0.4, 0.89)),
        ("head", ("X", -6)),
    ],
    "stand": ARMS_DOWN,
}

# ---------------------------------------------------------------- props
# Each prop: fn(rig, P) -> list of bmesh-built objects, in world space.
def bone(rig, name, end="head"):
    pb = rig.pose.bones[name]
    return rig.matrix_world @ (pb.head if end == "head" else pb.tail)


def mesh_obj(name, build, mat):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    build(bm)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat)
    return ob


def cube(bm, c, size, rot=Matrix.Identity(3)):
    m = Matrix.Translation(c) @ rot.to_4x4() @ Matrix.Diagonal((*size, 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def cyl(bm, a, b, r0, r1, seg=12, cap=True):
    a, b = Vector(a), Vector(b)
    d = b - a
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    m = Matrix.Translation((a + b) / 2) @ rot
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=r0, radius2=r1, depth=d.length, matrix=m)


def sphere(bm, c, r, sx=1.0, sy=1.0, sz=1.0, seg=16):
    m = Matrix.Translation(c) @ Matrix.Diagonal((r * sx, r * sy, r * sz, 1))
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg // 2), radius=1.0, matrix=m)


def hand_point(rig, side, out=0.06):
    h, t = bone(rig, f"hand_{side}"), bone(rig, f"hand_{side}", "tail")
    return h + (t - h).normalized() * out


# The posed figure's surfaces (body + clothes), for laying props ON them:
# surf(p) casts from in front of p back toward it and returns the first hit.
SURF = {"trees": []}


def surface_trees(rig):
    dg = bpy.context.evaluated_depsgraph_get()
    SURF["trees"] = []
    for ob in rig.children_recursive:
        if ob.type != "MESH" or any(k in ob.name.lower() for k in ("eye", "brow", "lash")):
            continue
        SURF["trees"].append((BVHTree.FromObject(ob, dg), ob.matrix_world.copy()))
    SURF["arms"] = [(bone(rig, n), bone(rig, n, "tail")) for side in ("l", "r") for n in (f"upperarm_{side}", f"lowerarm_{side}", f"hand_{side}")]


def near_arm(p, r=0.075):
    for a, b in SURF["arms"]:
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        if (a + ab * t - p).length < r:
            return True
    return False


def surf(p, d=(0, -1, 0), lift=0.008, skip_arms=False):
    """The first surface hit casting back from in front of p; skip_arms:
    the first one that isn't an arm (the torso behind arms held in front)."""
    d = Vector(d).normalized()
    o = Vector(p) + d * 0.6
    hits = []
    for tree, mw in SURF["trees"]:
        inv = mw.inverted()
        lo, ld = inv @ o, (inv.to_3x3() @ -d).normalized()
        for _ in range(6):
            hit = tree.ray_cast(lo, ld, 1.2)
            if hit[0] is None:
                break
            hits.append(mw @ hit[0])
            lo = hit[0] + ld * 0.004
    if not hits:
        return Vector(p)
    hits.sort(key=lambda h: (h - o).length)
    if skip_arms:
        hits = [h for h in hits if not near_arm(h)] or hits
    return hits[0] + d * lift


def patch(b, cx, z_top, z_bot, half_w, cols=4, rows=8, y=0.0, d=(0, -1, 0), skip_arms=True, hang=None, lift=0.008):
    """A sheet (stole, apron) draped on the front of the torso (past any arm
    in front of it): a grid of points projected onto its surface, faces
    turned outward. Below `hang` (a z) it falls straight, a hand's breadth
    clear of the legs, instead of following them."""
    pts = []
    for r in range(rows + 1):
        z = z_top + (z_bot - z_top) * r / rows
        pts.append([surf(Vector((cx + half_w * (2 * c / cols - 1), y, z)), d, skip_arms=skip_arms, lift=lift) for c in range(cols + 1)])
    if hang is not None:
        # below the waist row, each column carries straight on down from it
        last = None
        for row in pts:
            if row[0].z >= hang:
                last = [p.y for p in row]
                continue
            if last is None:
                last = [p.y for p in row]
            for c, p in enumerate(row):
                p.y = last[c] - (hang - p.z) * 0.15
    grid = [[b.verts.new(p) for p in row] for row in pts]
    for r in range(rows):
        for c in range(cols):
            b.faces.new((grid[r][c], grid[r + 1][c], grid[r + 1][c + 1], grid[r][c + 1]))


def extent(rig, key, exact=False):
    """World bounding box (min, max) of the figure's mesh named key."""
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in rig.children_recursive:
        if ob.type == "MESH" and (ob.name == key if exact else key in ob.name):
            e = ob.evaluated_get(dg)
            vs = [e.matrix_world @ v.co for v in e.to_mesh().vertices]
            e.to_mesh_clear()
            return (Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))),
                    Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs))))
    raise KeyError(key)


def shoulders(rig):
    return (bone(rig, "upperarm_l") - bone(rig, "upperarm_r")).length


def p_book(rig, P):
    c = hand_point(rig, "l", 0.05) + Vector((0, 0, 0.03))
    return [mesh_obj("MQp_book", lambda b: cube(b, c, (0.17, 0.24, 0.035)), P["black"])]


def p_collar(rig, P):
    n = bone(rig, "neck_01") + Vector((0, -0.045, 0.02))
    return [mesh_obj("MQp_collar", lambda b: cyl(b, n - Vector((0, 0, 0.015)), n + Vector((0, 0, 0.015)), 0.058, 0.058, 16), P["white"])]


def p_stole(rig, P):
    n = bone(rig, "neck_01")
    def build(b):
        for s in (-1, 1):
            patch(b, n.x + s * 0.07, n.z - 0.02, n.z - 0.85, 0.042, cols=2, rows=12, y=n.y, skip_arms=False)
    return [mesh_obj("MQp_stole", build, P["purple"])]


def p_bowl(rig, P):
    c = hand_point(rig, "r", 0.03) + Vector((0, -0.04, 0.05))
    def bowl(b):
        cyl(b, c - Vector((0, 0, 0.03)), c + Vector((0, 0, 0.06)), 0.07, 0.15, 20)
    def candy(b):
        for i in range(9):
            a = i * 2.4
            sphere(b, c + Vector((math.cos(a) * 0.07, math.sin(a) * 0.07, 0.065)), 0.03, seg=8)
    return [mesh_obj("MQp_bowl", bowl, P["orange"]), mesh_obj("MQp_candy", candy, P["candy"])]


def p_flashlight(rig, P):
    h, t = bone(rig, "hand_r"), bone(rig, "hand_r", "tail")
    a = bone(rig, "lowerarm_r")
    d = (h - a).normalized()
    s = h + (t - h) * 0.5
    return [mesh_obj("MQp_torch", lambda b: cyl(b, s - d * 0.06, s + d * 0.17, 0.022, 0.032, 12), P["chrome"]),
            mesh_obj("MQp_torchlens", lambda b: cyl(b, s + d * 0.17, s + d * 0.175, 0.03, 0.03, 12), P["lens"])]


def p_bucket(rig, P):
    c = hand_point(rig, "r", 0.02) - Vector((0, 0, 0.17))
    def body(b):
        sphere(b, c, 0.11, 1, 1, 0.85, 16)
    def handle(b):
        cyl(b, c + Vector((-0.1, 0, 0.05)), c + Vector((0, 0, 0.17)), 0.007, 0.007, 6)
        cyl(b, c + Vector((0, 0, 0.17)), c + Vector((0.1, 0, 0.05)), 0.007, 0.007, 6)
    return [mesh_obj("MQp_pail", body, P["orange"]), mesh_obj("MQp_pailh", handle, P["black"])]


def p_witch_hat(rig, P):
    h = bone(rig, "head", "tail")
    def build(b):
        cyl(b, h - Vector((0, 0, 0.03)), h - Vector((0, 0, 0.015)), 0.2, 0.2, 24)
        cyl(b, h - Vector((0, 0, 0.02)), h + Vector((0.03, 0.04, 0.3)), 0.1, 0.008, 16)
    return [mesh_obj("MQp_hat", build, P["black"]), mesh_obj("MQp_band", lambda b: cyl(b, h - Vector((0, 0, 0.01)), h + Vector((0, 0, 0.025)), 0.1, 0.095, 16), P["purple"])]


def p_ghost_sheet(rig, P):
    """A sheet over the head to the floor, two eye holes."""
    lo, hi = extent(rig, "Human", exact=True)
    top = Vector((bone(rig, "head").x, bone(rig, "head").y, hi.z + 0.015))
    e0, e1 = extent(rig, "low-poly")
    eye = (e0 + e1) / 2
    def build(b):
        rings = 14
        prev = None
        verts_rows = []
        for i in range(rings + 1):
            t = i / rings
            z = top.z - t * top.z
            r = 0.1 + 0.32 * (t ** 0.8) if t > 0.08 else 0.1 * math.sin(t / 0.08 * math.pi / 2) + 0.001
            row = []
            for k in range(20):
                a = k / 20 * math.tau
                wob = 1 + (0.06 * math.sin(a * 5 + t * 3) * t)
                row.append(b.verts.new((top.x + math.cos(a) * r * wob, top.y + math.sin(a) * r * wob * 0.9, z + (0.03 * math.sin(a * 6) * t if i == rings else 0))))
            verts_rows.append(row)
        for i in range(rings):
            for k in range(20):
                a0, a1 = verts_rows[i][k], verts_rows[i][(k + 1) % 20]
                b0, b1 = verts_rows[i + 1][k], verts_rows[i + 1][(k + 1) % 20]
                b.faces.new((a0, b0, b1, a1))
        b.faces.new(verts_rows[0])
    sheet = mesh_obj("MQp_sheet", build, P["sheet"])
    sub = sheet.modifiers.new("s", "SUBSURF")
    sub.levels = 1
    t = (top.z - eye.z) / top.z
    r = 0.1 + 0.32 * (t ** 0.8)
    def holes(b):
        for s in (-1, 1):
            a = -math.pi / 2 + s * 0.32
            sphere(b, Vector((top.x + math.cos(a) * r, top.y + math.sin(a) * r * 0.9, eye.z)), 0.03, 1, 0.5, 1.3, 10)
    eyes = mesh_obj("MQp_holes", holes, P["black"])
    return [sheet, eyes]


def p_pumpkin_suit(rig, P):
    c = bone(rig, "spine_02") + Vector((0, -0.02, -0.02))
    h = bone(rig, "head", "tail")
    def body(b):
        bmesh.ops.create_uvsphere(b, u_segments=24, v_segments=14, radius=1.0, matrix=Matrix.Translation(c) @ Matrix.Diagonal((0.24, 0.22, 0.2, 1)))
        for v in b.verts:
            d = v.co - c
            a = math.atan2(d.y, d.x)
            v.co = c + Vector((d.x, d.y, d.z)) * (1 + 0.07 * math.cos(a * 8))
    def face(b):
        f = c + Vector((0, -0.215, 0.02))
        for s in (-1, 1):
            cube(b, f + Vector((s * 0.07, 0, 0.06)), (0.05, 0.02, 0.04), Matrix.Rotation(s * 0.6, 3, "Y"))
        cube(b, f + Vector((0, 0, -0.06)), (0.15, 0.02, 0.035))
    def stem(b):
        bmesh.ops.create_uvsphere(b, u_segments=16, v_segments=8, radius=1.0, matrix=Matrix.Translation(h - Vector((0, 0.01, 0.05))) @ Matrix.Diagonal((0.1, 0.1, 0.07, 1)))
        cyl(b, h + Vector((0, 0, 0.01)), h + Vector((0.02, 0, 0.07)), 0.02, 0.012, 8)
    return [mesh_obj("MQp_pumpkin", body, P["orange"]), mesh_obj("MQp_pface", face, P["black"]), mesh_obj("MQp_stem", stem, P["green"])]


def p_skeleton(rig, P):
    """White bones on a black suit, laid on its surface: limbs, ribs, spine,
    pelvis."""
    k = shoulders(rig) / 0.36
    def chain(b, pts, r):
        for a, c in zip(pts, pts[1:]):
            cyl(b, a, c, r, r, 6)
    def build(b):
        for side in ("l", "r"):
            for name in (f"upperarm_{side}", f"lowerarm_{side}", f"thigh_{side}", f"calf_{side}"):
                a, c = bone(rig, name), bone(rig, name, "tail")
                pts = [surf(a + (c - a) * t, lift=0.01) for t in (0.14, 0.5, 0.86)]
                chain(b, pts, 0.013 * k)
                sphere(b, pts[0], 0.022 * k, seg=8)
                sphere(b, pts[-1], 0.022 * k, seg=8)
        s3, s1 = bone(rig, "spine_03"), bone(rig, "spine_01")
        for i in range(4):
            mid = s3 + (s1 - s3) * (i / 4.5) + Vector((0, 0, 0.05 * k))
            w = (0.12 - i * 0.012) * k
            chain(b, [surf(mid + Vector((x, 0, -abs(x) * 0.35)), lift=0.01) for x in (-w, -w * 0.6, -w * 0.25, w * 0.25, w * 0.6, w)], 0.011 * k)
        chain(b, [surf(s3 + (s1 - s3) * t + Vector((0, 0, 0.08 * k)), lift=0.01) for t in (0, 0.35, 0.7, 1.0)], 0.012 * k)
        p = surf(bone(rig, "pelvis"), lift=0.01)
        sphere(b, p, 0.07 * k, 1.4, 0.3, 0.8, 12)
    return [mesh_obj("MQp_bones", build, P["bone"])]


def p_cotton_candy(rig, P):
    h = hand_point(rig, "r", 0.03)
    def stick(b):
        cyl(b, h - Vector((0, 0, 0.06)), h + Vector((0, 0, 0.16)), 0.006, 0.006, 6)
    def fluff(b):
        for i, (x, y, z, r) in enumerate([(0, 0, 0.24, 0.1), (0.05, 0, 0.27, 0.07), (-0.05, 0.02, 0.26, 0.075), (0, -0.04, 0.3, 0.07), (0.02, 0.04, 0.2, 0.07)]):
            sphere(b, h + Vector((x, y, z)), r, seg=10)
    return [mesh_obj("MQp_stick", stick, P["white"]), mesh_obj("MQp_fluff", fluff, P["pink"])]


def p_vendor(rig, P):
    n, pel = bone(rig, "neck_01"), bone(rig, "pelvis")
    h = bone(rig, "head", "tail")
    def apron(b):
        patch(b, n.x, n.z - 0.12, pel.z - 0.45, 0.17, cols=5, rows=12, y=n.y, hang=pel.z + 0.05, lift=0.014)
    def hat(b):
        cube(b, h + Vector((0, 0, -0.02)), (0.12, 0.26, 0.08), Matrix.Rotation(0.0, 3, "Z"))
    return [mesh_obj("MQp_apron", apron, P["white"]), mesh_obj("MQp_paperhat", hat, P["white"])]


def p_apron(rig, P):
    n, pel = bone(rig, "neck_01"), bone(rig, "pelvis")
    return [mesh_obj("MQp_apron", lambda b: patch(b, n.x, n.z - 0.15, pel.z - 0.4, 0.16, cols=5, rows=12, y=n.y, hang=pel.z + 0.05, lift=0.014), P["gingham"])]


def p_pitchfork(rig, P):
    h = hand_point(rig, "r", 0.04)
    def shaft(b):
        cyl(b, Vector((h.x, h.y, 0.02)), Vector((h.x, h.y, 1.5)), 0.016, 0.016, 8)
    def tines(b):
        t = Vector((h.x, h.y, 1.5))
        cube(b, t + Vector((0, 0, 0.02)), (0.2, 0.025, 0.025))
        for s in (-1, 0, 1):
            cyl(b, t + Vector((s * 0.09, 0, 0.02)), t + Vector((s * 0.09, 0, 0.3)), 0.008, 0.004, 6)
    return [mesh_obj("MQp_shaft", shaft, P["wood"]), mesh_obj("MQp_tines", tines, P["chrome"])]


# ---------------------------------------------------------------- the cast
# macros: MakeHuman's 0..1 sliders (age 0.5 = 25 years, 0.19 ~ 11, 0.1 ~ 6).
# clothes: (asset, tint or None). The kids' bodies under a sheet or a
# pumpkin are still there (the sheet hides them; the pumpkin rides on top).
CAST = {
    "priest": dict(macros=dict(gender=1.0, age=0.82, muscle=0.4, weight=0.55, height=0.55), skin="old_caucasian_male",
                   clothes=[("toigo_turtleneck_halter_top", 0x111113, 0.0), ("mindfront_kimono", 0x141416, 0.0), ("shoes02", 0x111111)], hair=("short04", 0xb8b4ae),
                   brows="eyebrow006", pose="bless", props=[p_collar, p_stole, p_book]),
    "beggar": dict(macros=dict(gender=1.0, age=0.45, muscle=0.45, weight=0.45, height=0.5), skin="middleage_caucasian_male",
                   clothes=[("male_casualsuit02", 0x5a6a7a), ("shoes01", None)], hair=("short02", 0x3a2a1c),
                   brows="eyebrow002", pose="beg"),
    "pew_woman": dict(macros=dict(gender=0.0, age=0.72, muscle=0.35, weight=0.6, height=0.4), skin="old_caucasian_female",
                      clothes=[("female_elegantsuit01", 0x2a3a5a), ("shoes04", 0x1a1a1a)], hair=("bob02", 0xc8c4bc),
                      brows="eyebrow009", pose="pray"),
    "pew_man": dict(macros=dict(gender=1.0, age=0.6, muscle=0.45, weight=0.6, height=0.55), skin="middleage_african_male",
                    clothes=[("male_casualsuit05", 0x4a3a2a), ("shoes03", None)], hair=("short01", 0x141210),
                    brows="eyebrow001", pose="sit"),
    "mom": dict(macros=dict(gender=0.0, age=0.42, muscle=0.4, weight=0.45, height=0.5), skin="young_caucasian_female",
                clothes=[("toigo_shift_dress", 0xe8901c), ("shoes04", 0x2a1a12)],
                hair=("bob02", 0x4a3020), brows="eyebrow010", pose="offer", props=[p_bowl]),
    "dad": dict(macros=dict(gender=1.0, age=0.45, muscle=0.55, weight=0.5, height=0.6), skin="young_caucasian_male",
                clothes=[("male_casualsuit04", None), ("shoes02", None)], hair=("short03", 0x2a1c12),
                brows="eyebrow003", pose="torch", props=[p_flashlight]),
    "kid_ghost": dict(macros=dict(gender=1.0, age=0.12, muscle=0.5, weight=0.5, height=0.5), skin="young_caucasian_male",
                      clothes=[("shoes01", None)], pose="ghost", props=[p_ghost_sheet, p_bucket]),
    "kid_witch": dict(macros=dict(gender=0.0, age=0.13, muscle=0.5, weight=0.5, height=0.5), skin="young_caucasian_female",
                      clothes=[("toigo_dress_with_tiered_skirt", 0x1a1420), ("shoes04", 0x111111)], hair=("long01", 0x8a5a2a),
                      brows="eyebrow010", pose="bucket", props=[p_witch_hat, p_bucket]),
    "kid_skeleton": dict(macros=dict(gender=1.0, age=0.14, muscle=0.5, weight=0.45, height=0.5), skin="young_african_male",
                         clothes=[("toigo_basic_tucked_t-shirt", 0x111111), ("toigo_wool_pants", 0x111111), ("shoes01", 0x111111)],
                         hair=("short02", 0x111111), brows="eyebrow001", pose="bucket", props=[p_skeleton, p_bucket]),
    "kid_pumpkin": dict(macros=dict(gender=1.0, age=0.09, muscle=0.5, weight=0.6, height=0.45), skin="young_asian_male",
                        clothes=[("toigo_basic_tucked_t-shirt", 0x2a5a2a), ("toigo_wool_pants", 0x1a2a1a), ("shoes03", None)],
                        brows="eyebrow002", pose="bucket", props=[p_pumpkin_suit, p_bucket]),
    "bench_woman": dict(macros=dict(gender=0.0, age=0.32, muscle=0.4, weight=0.45, height=0.5), skin="young_african_female",
                        clothes=[("toigo_halter_dress_knee_length", 0x2a6a5a), ("shoes04", None)], hair=("ponytail01", 0x141010),
                        brows="eyebrow011", pose="sit_lean"),
    "bench_man": dict(macros=dict(gender=1.0, age=0.34, muscle=0.5, weight=0.45, height=0.6), skin="young_caucasian_male2",
                      clothes=[("namuhekam_male_polo_shirt", 0x8a2a2a), ("cortu_cargo_pants", 0x3a3a3a), ("shoes02", None)],
                      hair=("short04", 0x6a4a2a), brows="eyebrow004", pose="sit"),
    "kid_candy": dict(macros=dict(gender=0.0, age=0.16, muscle=0.5, weight=0.5, height=0.5), skin="young_asian_female",
                      clothes=[("toigo_halter_dress_knee_length", 0xd86a9a), ("shoes04", 0xf0f0f0)], hair=("ponytail01", 0x1a1410),
                      brows="eyebrow010", pose="candy", props=[p_cotton_candy]),
    "vendor": dict(macros=dict(gender=1.0, age=0.35, muscle=0.45, weight=0.6, height=0.5), skin="young_caucasian_male",
                   clothes=[("toigo_basic_tucked_t-shirt", 0xe8e4dc), ("toigo_wool_pants", 0x2a2a3a), ("shoes01", None)],
                   hair=("short01", 0x5a3a1c), brows="eyebrow005", pose="counter", props=[p_vendor]),
    "attendant": dict(macros=dict(gender=1.0, age=0.28, muscle=0.5, weight=0.4, height=0.55), skin="young_african_male",
                      clothes=[("namuhekam_male_polo_shirt", 0x1a6a8a), ("cortu_cargo_pants", 0x2a2a2a), ("shoes02", None)],
                      hair=("short02", 0x101010), brows="eyebrow001", pose="wave"),
    "shopkeeper": dict(macros=dict(gender=0.0, age=0.75, muscle=0.35, weight=0.62, height=0.42), skin="old_caucasian_female",
                       clothes=[("toigo_fisherman_sweater", 0x8a2a3a), ("toigo_wool_pants", 0x3a3030), ("shoes04", None)],
                       hair=("bob01", 0xd8d4cc), brows="eyebrow009", pose="clasp", props=[p_apron]),
    "farmer": dict(macros=dict(gender=1.0, age=0.68, muscle=0.6, weight=0.55, height=0.58), skin="old_caucasian_male",
                   clothes=[("male_worksuit01", 0x3a4a6a), ("fedora01", 0x6a5a3a), ("shoes03", None)],
                   brows="eyebrow006", pose="fork", props=[p_pitchfork]),
}


def palette():
    # fake users: MPFB purges unused materials while it builds a human
    P = {
        "black": flat("MQ_Black", 0x141414, 0.6), "white": flat("MQ_White", 0xf0eee8, 0.6),
        "purple": flat("MQ_Purple", 0x6a2a9a, 0.6), "orange": flat("MQ_Orange", 0xe0701c, 0.45),
        "candy": flat("MQ_Candy", 0xe03a6a, 0.3), "chrome": flat("MQ_Chrome", 0xb8bcc0, 0.25),
        "lens": flat("MQ_Lens", 0xfff4c0, 0.2, 0xfff0b0, 6.0), "sheet": flat("MQ_Sheet", 0xe8e6e0, 0.85),
        "green": flat("MQ_Green", 0x2a6a2a, 0.6), "bone": flat("MQ_Bone", 0xe8e2d0, 0.5),
        "pink": flat("MQ_Pink", 0xf0a0c8, 0.9), "wood": flat("MQ_Wood", 0x8a6a40, 0.7),
        "gingham": flat("MQ_Gingham", 0xe8d8d0, 0.8),
    }
    for m in P.values():
        m.use_fake_user = True
    return P


# ---------------------------------------------------------------- materials
def mannequin_skin(skin_name):
    """The MakeHuman skin texture as it is, with a shop mannequin's sheen."""
    m = bpy.data.materials.new("MQ_Skin")
    N, L = _nodes(m)
    b = N["Principled BSDF"]
    img = N.new("ShaderNodeTexImage")
    d = os.path.join(MPFB_USER, "skins", skin_name)
    img.image = bpy.data.images.load(os.path.join(d, [f for f in os.listdir(d) if f.endswith(".png")][0]))
    uv = N.new("ShaderNodeUVMap")
    L.new(uv.outputs["UV"], img.inputs["Vector"])
    hsv = N.new("ShaderNodeHueSaturation")
    hsv.inputs["Saturation"].default_value = 0.9
    hsv.inputs["Value"].default_value = 1.05
    L.new(img.outputs["Color"], hsv.inputs["Color"])
    L.new(hsv.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.42
    return m


def tint(m, col, keep=0.25):
    """Recolour a garment: its texture's shading times the new colour."""
    N, L = _nodes(m)
    b = next(n for n in N if n.type == "BSDF_PRINCIPLED")
    link = next(iter(b.inputs["Base Color"].links), None)
    rgb = N.new("ShaderNodeRGB")
    rgb.outputs[0].default_value = hexlin(col)
    if keep == 0.0 and link is not None:
        L.remove(link)
        link = None
    if link is None:
        L.new(rgb.outputs[0], b.inputs["Base Color"])
        return
    src = link.from_socket
    bw = N.new("ShaderNodeRGBToBW")
    L.new(src, bw.inputs["Color"])
    lift = N.new("ShaderNodeMath")
    lift.operation = "MULTIPLY_ADD"
    lift.inputs[1].default_value = 0.7
    lift.inputs[2].default_value = 0.65
    L.new(bw.outputs[0], lift.inputs[0])
    mul = N.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    L.new(rgb.outputs[0], mul.inputs[6])
    L.new(lift.outputs[0], mul.inputs[7])
    mix = N.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["Factor"].default_value = keep
    L.new(mul.outputs[2], mix.inputs[6])
    L.new(src, mix.inputs[7])
    L.new(mix.outputs[2], b.inputs["Base Color"])


def pin_uvs(m):
    """Point every image texture at the mesh's original UV map by name, so
    the atlas UV can become the active one for the bake."""
    N, L = _nodes(m)
    for t in [n for n in N if n.type == "TEX_IMAGE"]:
        if not t.inputs["Vector"].links:
            uv = N.new("ShaderNodeUVMap")
            uv.uv_map = "UVMap"
            L.new(uv.outputs["UV"], t.inputs["Vector"])


# ---------------------------------------------------------------- build
def make_person(look):
    macro = TargetService.get_default_macro_info_dict()
    macro.update(look["macros"])
    bm = HumanService.create_human(macro_detail_dict=macro)
    rig = HumanService.add_builtin_rig(bm, "game_engine")
    HumanService.add_mhclo_asset(user_asset("eyes", "low-poly"), bm, asset_type="Eyes", subdiv_levels=0)
    if look.get("brows"):
        HumanService.add_mhclo_asset(user_asset("eyebrows", look["brows"]), bm, asset_type="Eyebrows", subdiv_levels=0)
        HumanService.add_mhclo_asset(user_asset("eyelashes", "eyelashes01"), bm, asset_type="Eyelashes", subdiv_levels=0)
    tints = {}
    keeps = {}
    for c, col, *k in look["clothes"]:
        cl = HumanService.add_mhclo_asset(user_asset("clothes", c), bm, asset_type="Clothes", subdiv_levels=0)
        if cl is not None and col is not None:
            tints[cl.name] = col
            if k:
                keeps[cl.name] = k[0]
    if look.get("hair"):
        h = HumanService.add_mhclo_asset(user_asset("hair", look["hair"][0]), bm, asset_type="Hair", subdiv_levels=0)
        if h is not None:
            tints[h.name] = look["hair"][1]
    bm.data.materials.clear()
    bm.data.materials.append(mannequin_skin(look["skin"]))
    for ob in rig.children_recursive:
        if ob.type != "MESH" or ob is bm:
            continue
        for i, m in enumerate(ob.data.materials):
            if m is None:
                continue
            m = m.copy()
            ob.data.materials[i] = m
            if ob.name in tints:
                tint(m, tints[ob.name], keep=keeps.get(ob.name, 0.1 if look.get("hair") and ob.name.endswith(look["hair"][0]) else 0.03))
    return bm, rig


def pose_person(rig, look):
    Z["_rest"](rig)
    Z["apply_spec"](rig, POSES[look["pose"]])


def build_person(name, look, P):
    bm, rig = make_person(look)
    pose_person(rig, look)
    bpy.context.view_layer.update()
    surface_trees(rig)
    props = []
    for fn in look.get("props", []):
        props += fn(rig, P)
    return bm, rig, props


# ---------------------------------------------------------------- freeze + bake
def _frozen(ob, name):
    """ob's evaluated mesh (armature, masks, subsurf applied) as a new object."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    me.name = name
    new = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(new)
    new.matrix_world = ob.matrix_world.copy()
    return new


def _tris(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)


BUDGET = {"body": 3200, "hair": 1200, "cloth": 1600, "shoe": 260, "prop": 700}


def export_person(name, look, P):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 4
    sc.cycles.use_denoising = False
    bm, rig, props = build_person(name, look, P)
    parts = []
    for ob in [bm] + [c for c in rig.children_recursive if c.type == "MESH" and c is not bm] + props:
        low = ob.name.lower()
        if ob is bm and look.get("hide_body"):
            continue
        if look.get("hide_body") and any(k in low for k in ("eye", "brow", "lash")):
            continue
        f = _frozen(ob, "MQ_" + ob.name)
        for m in f.data.materials:
            if m:
                pin_uvs(m)
        kind = "body" if ob is bm else "prop" if ob.name.startswith("MQp_") else "shoe" if "shoe" in low else "hair" if look.get("hair") and low.endswith(look["hair"][0]) else "cloth"
        if any(k in low for k in ("eye", "brow", "lash")):
            kind = None
        if kind and _tris(f) > BUDGET[kind]:
            Z["_decimate"](f, BUDGET[kind] / _tris(f))
        # one UV map per part, all named alike: join() merges layers BY NAME,
        # and a part whose map is named otherwise ends up with zeroed UVs
        uvs = f.data.uv_layers
        if not uvs:
            uvs.new(name="UVMap")
        keep = uvs.active_render if uvs.active_render is not None else uvs[0]
        for u in [u for u in uvs if u.name != keep.name]:
            uvs.remove(u)
        uvs[0].name = "UVMap"
        parts.append(f)
    # one mesh
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = f"MQ_{name}"
    me = ob.data
    if me.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for a in [a for a in me.attributes if a.name in ("sharp_face", "sharp_edge")]:
        me.attributes.remove(a)
    me.shade_smooth()
    # the atlas UV: smart projected, the head's islands doubled, packed
    atlas = me.uv_layers.new(name="atlas")
    me.uv_layers.active = atlas
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    head_z = (rig.matrix_world @ rig.pose.bones["neck_01"].head).z
    head_c = rig.matrix_world @ rig.pose.bones["head"].head
    atlas = me.uv_layers["atlas"]   # edit mode reallocated the layers: never reuse the old handle
    uvd = atlas.data
    for poly in me.polygons:
        c = ob.matrix_world @ poly.center
        if c.z > head_z and (c - head_c).length < 0.3:
            for li in poly.loop_indices:
                uvd[li].uv = uvd[li].uv * 2.2
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(rotate=True, margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")
    size = int(os.environ.get("MQ_SIZE", "768"))
    col = Z["_new_img"](f"mq_{name}_col", size)
    Z["_bake"](ob, col, "DIFFUSE")
    # alpha through an emission bake, ONLY from hair, brows and lashes:
    # clothes textures carry alpha too, and a decimated triangle that lands
    # on a clear texel would bake see-through
    cards = ("eyebrow", "eyelash") + ((look["hair"][0],) if look.get("hair") else ())
    for m in me.materials:
        N, L = _nodes(m)
        b = next(n for n in N if n.type == "BSDF_PRINCIPLED")
        src = next(iter(b.inputs["Alpha"].links), None) if any(k in m.name for k in cards) else None
        out = next(n for n in N if n.type == "OUTPUT_MATERIAL")
        em = N.new("ShaderNodeEmission")
        if src is not None:
            L.new(src.from_socket, em.inputs["Color"])
        else:
            em.inputs["Color"].default_value = (1, 1, 1, 1)
        L.new(em.outputs[0], out.inputs["Surface"])
    a_img = Z["_new_img"](f"mq_{name}_a", size)
    Z["_bake"](ob, a_img, "EMIT")
    px = list(col.pixels)
    px[3::4] = list(a_img.pixels)[0::4]
    rgba = Z["_new_img"](f"mq_{name}", size, alpha=True)
    rgba.pixels = px
    os.makedirs(BAKE_DIR, exist_ok=True)
    rgba.filepath_raw = os.path.join(BAKE_DIR, rgba.name + ".png")
    rgba.file_format = "PNG"
    rgba.save()
    m = bpy.data.materials.new(f"MQ_{name}")
    N, L = _nodes(m)
    b = N["Principled BSDF"]
    t = N.new("ShaderNodeTexImage")
    t.image = rgba
    L.new(t.outputs["Color"], b.inputs["Base Color"])
    L.new(t.outputs["Alpha"], b.inputs["Alpha"])
    b.inputs["Roughness"].default_value = 0.75
    me.materials.clear()
    me.materials.append(m)
    for uv in [u for u in me.uv_layers if u.name != "atlas"]:
        me.uv_layers.remove(uv)
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)
    for g in list(ob.vertex_groups):
        ob.vertex_groups.remove(g)
    ob.shape_key_clear() if me.shape_keys else None
    # feet (or knees) on the floor, centred over the origin
    bpy.context.view_layer.update()
    zs = [(ob.matrix_world @ v.co).z for v in me.vertices]
    ob.location.z -= min(zs)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    path = os.path.join(HERE, f"mq-{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
        export_image_format="WEBP", export_image_quality=72, export_extras=False, export_cameras=False, export_lights=False,
    )
    print(f"EXPORT {path} tris={_tris(ob)} size={os.path.getsize(path) // 1024} KB")


# ---------------------------------------------------------------- pets
def build_pet(kind, P):
    """Metaball sculpts (converted to mesh): a black cat sitting, a golden
    retriever lying down, a dachshund in a hot-dog bun. Facing -Y, on z = 0,
    plain colours."""
    def blob(name, elems, mat, res=0.012):
        """Overlapping balls, ellipsoids and capsules fused into one smooth
        skin: a voxel remesh, smoothed, decimated."""
        def build(b):
            for e in elems:
                kind_, co, r = e[0], Vector(e[1]), e[2]
                if kind_ == "BALL":
                    sphere(b, co, r, seg=20)
                elif kind_ == "ELLIPSOID":
                    sphere(b, co, r, *e[3], seg=20)
                else:
                    end = Vector(e[3])
                    cyl(b, co, end, r, r, 16)
                    sphere(b, co, r, seg=16)
                    sphere(b, end, r, seg=16)
        raw = mesh_obj(name + "_raw", build, mat)
        rm = raw.modifiers.new("remesh", "REMESH")
        rm.mode = "VOXEL"
        rm.voxel_size = res * 0.6
        sm = raw.modifiers.new("smooth", "SMOOTH")
        sm.factor = 0.6
        sm.iterations = 8
        ob = _frozen(raw, name)
        bpy.data.objects.remove(raw)
        if _tris(ob) > 5000:
            Z["_decimate"](ob, 5000 / _tris(ob))
        for p in ob.data.polygons:
            p.use_smooth = True
        return ob

    def pricked_ears(name, pts, mat):
        def build(b):
            for c, tilt in pts:
                m = Matrix.Translation(c) @ Matrix.Rotation(tilt, 4, "Y") @ Matrix.Rotation(-0.15, 4, "X")
                bmesh.ops.create_cone(b, cap_ends=True, segments=8, radius1=0.026, radius2=0.002, depth=0.05, matrix=m)
        return mesh_obj(name, build, mat)

    eye = flat("MQ_PetEye", 0x0a0806, 0.12)
    nose = flat("MQ_PetNose", 0x1a1214, 0.4)
    obs = []
    if kind == "cat":
        fur = flat("MQ_Cat", 0x141218, 0.55)
        obs.append(blob("pet_body", [
            ("ELLIPSOID", (0, 0.03, 0.11), 0.11, (0.85, 1.05, 1.0)),
            ("BALL", (0, -0.035, 0.2), 0.075),
            ("BALL", (0, -0.06, 0.27), 0.05),
            ("ELLIPSOID", (0, -0.075, 0.33), 0.068, (1.05, 0.95, 0.9)),
            ("ELLIPSOID", (0, -0.122, 0.315), 0.032, (1.1, 0.8, 0.75)),
            ("CAPSULE", (0.033, -0.075, 0.02), 0.022, (0.03, -0.06, 0.17)),
            ("CAPSULE", (-0.033, -0.075, 0.02), 0.022, (-0.03, -0.06, 0.17)),
            ("BALL", (0.035, -0.09, 0.015), 0.022),
            ("BALL", (-0.035, -0.09, 0.015), 0.022),
            ("ELLIPSOID", (0.075, 0.0, 0.05), 0.05, (0.7, 1.3, 1.0)),
            ("ELLIPSOID", (-0.075, 0.0, 0.05), 0.05, (0.7, 1.3, 1.0)),
            ("CAPSULE", (0.04, 0.13, 0.02), 0.017, (0.12, 0.03, 0.018)),
            ("CAPSULE", (0.12, 0.03, 0.018), 0.017, (0.09, -0.1, 0.02)),
        ], fur, 0.008))
        obs.append(pricked_ears("pet_ears", [((0.036, -0.07, 0.385), 0.35), ((-0.036, -0.07, 0.385), -0.35)], fur))
        glow = flat("MQ_CatEye", 0xc8e040, 0.15, 0xc8e040, 4.0)
        obs.append(mesh_obj("pet_eyes", lambda b: [sphere(b, (s * 0.026, -0.133, 0.343), 0.011, 1, 0.6, 0.8, 10) for s in (-1, 1)], glow))
        obs.append(mesh_obj("pet_nose", lambda b: sphere(b, (0, -0.152, 0.322), 0.007, seg=8), flat("MQ_CatNose", 0x6a3a40, 0.4)))
    elif kind == "porchdog":
        fur = flat("MQ_Retriever", 0xc08a48, 0.7)
        obs.append(blob("pet_body", [
            ("ELLIPSOID", (0, 0.08, 0.17), 0.2, (0.82, 1.55, 0.78)),
            ("BALL", (0, -0.16, 0.2), 0.15),
            ("BALL", (0, 0.34, 0.15), 0.14),
            ("BALL", (0, -0.29, 0.3), 0.09),
            ("ELLIPSOID", (0, -0.37, 0.37), 0.1, (0.95, 1.05, 0.92)),
            ("ELLIPSOID", (0, -0.48, 0.34), 0.055, (0.85, 1.45, 0.78)),
            ("CAPSULE", (0.085, -0.2, 0.05), 0.042, (0.085, -0.5, 0.04)),
            ("CAPSULE", (-0.085, -0.2, 0.05), 0.042, (-0.085, -0.5, 0.04)),
            ("ELLIPSOID", (0.085, -0.53, 0.03), 0.045, (0.9, 1.2, 0.6)),
            ("ELLIPSOID", (-0.085, -0.53, 0.03), 0.045, (0.9, 1.2, 0.6)),
            ("ELLIPSOID", (0.13, 0.32, 0.1), 0.11, (0.6, 1.3, 0.9)),
            ("ELLIPSOID", (-0.13, 0.32, 0.1), 0.11, (0.6, 1.3, 0.9)),
            ("ELLIPSOID", (0.13, 0.14, 0.03), 0.04, (0.8, 1.3, 0.6)),
            ("ELLIPSOID", (-0.13, 0.14, 0.03), 0.04, (0.8, 1.3, 0.6)),
            ("CAPSULE", (0.02, 0.48, 0.1), 0.03, (0.16, 0.74, 0.04)),
        ], fur, 0.014))
        ear = flat("MQ_RetrieverEar", 0xa06a30, 0.75)
        obs.append(mesh_obj("pet_ears", lambda b: [sphere(b, (s * 0.092, -0.35, 0.36), 1.0, 0.018, 0.05, 0.08, 12) for s in (-1, 1)], ear))
        obs.append(mesh_obj("pet_eyes", lambda b: [sphere(b, (s * 0.042, -0.45, 0.4), 0.013, seg=10) for s in (-1, 1)], eye))
        obs.append(mesh_obj("pet_nose", lambda b: sphere(b, (0, -0.535, 0.36), 0.022, 1.2, 0.8, 0.8, 10), nose))
    elif kind == "dachshund":
        fur = flat("MQ_Doxie", 0x5a2a12, 0.55)
        obs.append(blob("pet_body", [
            ("CAPSULE", (0, 0.2, 0.2), 0.085, (0, -0.14, 0.21)),
            ("BALL", (0, -0.16, 0.19), 0.088),
            ("BALL", (0, -0.24, 0.26), 0.06),
            ("ELLIPSOID", (0, -0.3, 0.3), 0.066, (0.95, 1.05, 0.95)),
            ("ELLIPSOID", (0, -0.38, 0.285), 0.036, (0.8, 1.7, 0.8)),
            ("CAPSULE", (0.05, -0.15, 0.02), 0.028, (0.05, -0.15, 0.13)),
            ("CAPSULE", (-0.05, -0.15, 0.02), 0.028, (-0.05, -0.15, 0.13)),
            ("CAPSULE", (0.05, 0.17, 0.02), 0.03, (0.05, 0.17, 0.13)),
            ("CAPSULE", (-0.05, 0.17, 0.02), 0.03, (-0.05, 0.17, 0.13)),
            ("CAPSULE", (0, 0.28, 0.23), 0.018, (0, 0.42, 0.29)),
        ], fur, 0.01))
        obs.append(mesh_obj("pet_ears", lambda b: [sphere(b, (s * 0.062, -0.28, 0.28), 1.0, 0.012, 0.035, 0.065, 12) for s in (-1, 1)], flat("MQ_DoxieEar", 0x4a2010, 0.6)))
        obs.append(mesh_obj("pet_eyes", lambda b: [sphere(b, (s * 0.03, -0.35, 0.32), 0.011, seg=10) for s in (-1, 1)], eye))
        obs.append(mesh_obj("pet_nose", lambda b: sphere(b, (0, -0.44, 0.29), 0.014, seg=10), nose))
        bun = flat("MQ_Bun", 0xd09848, 0.75)
        def buns(b):
            for s in (-1, 1):
                sphere(b, (s * 0.1, 0.02, 0.2), 1.0, 0.055, 0.36, 0.1, 20)
        obs.append(mesh_obj("pet_bun", buns, bun))
        mustard = flat("MQ_Mustard", 0xf0c020, 0.45)
        def zig(b):
            pts = [Vector((0.04 * (1 if i % 2 else -1), 0.24 - i * 0.065, 0.295 + (0.006 if i in (2, 3, 4) else 0))) for i in range(8)]
            for a, c in zip(pts, pts[1:]):
                cyl(b, a, c, 0.011, 0.011, 6)
        obs.append(mesh_obj("pet_mustard", zig, mustard))
    return obs


def export_pet(kind, P):
    obs = build_pet(kind, P)
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    path = os.path.join(HERE, f"mq-{kind}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
                              export_extras=False, export_cameras=False, export_lights=False)
    print(f"EXPORT {path} size={os.path.getsize(path) // 1024} KB")


PETS = ("dachshund", "porchdog", "cat")


# ---------------------------------------------------------------- main
def main():
    names = [a for a in ARGS if a in CAST or a in PETS] or list(CAST) + list(PETS)
    os.makedirs(RENDER_DIR, exist_ok=True)
    for name in names:
        Z["clear_scene"]()
        P = palette()
        if "export" in ARGS:
            if name in PETS:
                export_pet(name, P)
            else:
                export_person(name, CAST[name], P)
            continue
        if name in PETS:
            build_pet(name, P)
            target, dist, h = (0, -0.2, 0.25), 2.0, 0.8
        else:
            build_person(name, CAST[name], P)
            target, dist, h = (0, 0, 0.85), 4.2, 1.1
        cam = Z["render_setup"]()
        bpy.context.scene.view_settings.exposure = float(os.environ.get("MQ_EXPOSURE", "-0.6"))
        for yaw in [int(v) for v in os.environ.get("MQ_VIEWS", "20").split(",") if v]:
            Z["shoot"](cam, os.path.join(RENDER_DIR, f"mq-{name}-y{yaw}.png"), yaw, target=target, dist=dist, height=h, w=600, h=900)


main()
