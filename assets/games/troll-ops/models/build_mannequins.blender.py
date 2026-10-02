"""
Troll Forces — Hollowgrin's mannequins (Nuketown style): posed shop-window
figures in real clothes, painted faces, plastic sheen.

Run with (no names = all):
  blender --background --python build_mannequins.blender.py -- proto

A figure is built from a pose: joint positions worked out by forward
kinematics from a few angles, then smooth body segments (tapered tubes,
ellipsoids) dressed in clothing colours, hair and painted features.
Everything is in a figure's own frame (x right, y up, z forward, feet on
y = 0) and placed with (x, z, yaw) into map coordinates.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
import math  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402


def mq_palette():
    return {
        "skin": mat("MQ_Skin", 0xe8c8b0, 0.35),
        "skin2": mat("MQ_SkinTan", 0xc8946c, 0.35),
        "skin3": mat("MQ_SkinDark", 0x7a5038, 0.35),
        "cheek": mat("MQ_Cheek", 0xe07a78, 0.4),
        "lips": mat("MQ_Lips", 0xa8283a, 0.3),
        "eyew": mat("MQ_EyeWhite", 0xf4f0ea, 0.25),
        "iris": mat("MQ_Iris", 0x2a4a6a, 0.2),
        "brow": mat("MQ_Brow", 0x3a2418, 0.6),
        "hair_dk": mat("MQ_HairDark", 0x2a1a12, 0.55),
        "hair_br": mat("MQ_HairBrown", 0x5a3a22, 0.55),
        "hair_bl": mat("MQ_HairBlonde", 0xc8a060, 0.55),
        "hair_gr": mat("MQ_HairGrey", 0x9a968c, 0.6),
        "black": mat("MQ_Black", 0x18161a, 0.6),
        "white": mat("MQ_White", 0xeeeae2, 0.6),
        "orange": mat("MQ_Orange", 0xe0802a, 0.7),
        "purple": mat("MQ_Purple", 0x5a2a7c, 0.7),
        "red": mat("MQ_Red", 0xa8242c, 0.7),
        "navy": mat("MQ_Navy", 0x22304a, 0.75),
        "khaki": mat("MQ_Khaki", 0xb8a07a, 0.8),
        "cardigan": mat("MQ_Cardigan", 0x6a7a4a, 0.85),
        "denim": mat("MQ_Denim", 0x3a4a6a, 0.85),
        "grey": mat("MQ_Grey", 0x6a6a72, 0.8),
        "brown": mat("MQ_Brown", 0x5a3a24, 0.75),
        "shoe": mat("MQ_Shoe", 0x1e1a18, 0.4),
        "gold": mat("MQ_Gold", 0xd8b050, 0.3, 0.4),
        "tights": mat("MQ_Tights", 0x2a2228, 0.7),
        "pumpkin": mat("MQ_Pumpkin", 0xe07423, 0.55),
        "green": mat("MQ_Green", 0x2e5a34, 0.7),
        "lamp": mat("MQ_Lamp", 0xfff0c8, 0.2, 0.0, 0xffd890, 3.0),
    }


# ------------------------------------------------------------ shapes

def ellipsoid(b, m, c, rx, ry, rz, yaw=0.0, pitch=0.0, seg=16, rings=10):
    M = Matrix.Translation(c) @ Matrix.Rotation(yaw, 4, "Y") @ Matrix.Rotation(pitch, 4, "X") @ Matrix.Diagonal((rx, ry, rz, 1))
    verts = bmesh.ops.create_uvsphere(b.bm, u_segments=seg, v_segments=rings, radius=1.0, matrix=M)["verts"]
    faces = b._faces(verts)
    b._tag(faces, m, smooth=True)
    return verts


def tube(b, m, a, c, r0, r1, seg=12):
    """A tapered limb from a to c, capped by spheres so joints stay round."""
    b.cyl(m, r0, a, c, seg=seg, r2=r1)
    ellipsoid(b, m, Vector(a), r0, r0, r0, seg=seg, rings=8)
    ellipsoid(b, m, Vector(c), r1, r1, r1, seg=seg, rings=8)


def loft(b, m, rings, seg=16):
    """Rings [(centre, rx, rz, yaw)] stacked into one smooth closed body."""
    pts, faces = [], []
    for (c, rx, rz, yaw) in rings:
        cy, sy = math.cos(yaw), math.sin(yaw)
        for i in range(seg):
            t = 2 * math.pi * i / seg
            lx, lz = math.cos(t) * rx, math.sin(t) * rz
            pts.append((c[0] + lx * cy + lz * sy, c[1], c[2] - lx * sy + lz * cy))
    n = len(rings)
    for r in range(n - 1):
        for i in range(seg):
            j = (i + 1) % seg
            faces.append([r * seg + i, r * seg + j, (r + 1) * seg + j, (r + 1) * seg + i])
    faces.append(list(range(seg - 1, -1, -1)))
    faces.append([(n - 1) * seg + i for i in range(seg)])
    out = b.poly(m, pts, faces)
    for f in out:
        f.smooth = True
    return out


def skin_part(b, m, pts, edges, radii, levels=2):
    """A smooth organic part: Blender's Skin modifier grown over a little
    skeleton (pts joined by edges, radius (rx, ry) per point), subdivided,
    then merged into the builder's mesh with material m."""
    me = bpy.data.meshes.new("skin_tmp")
    me.from_pydata([tuple(p) for p in pts], edges, [])
    ob = bpy.data.objects.new("skin_tmp", me)
    bpy.context.scene.collection.objects.link(ob)
    ob.modifiers.new("skin", "SKIN")
    sv = me.skin_vertices[0].data
    for i, r in enumerate(radii):
        sv[i].radius = r
        sv[i].use_root = (i == 0)
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = levels
    sub.render_levels = levels
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    em = bpy.data.meshes.new_from_object(ev)
    before = set(b.bm.faces)
    b.bm.from_mesh(em)
    new = [f for f in b.bm.faces if f not in before]
    b._tag(new, m, smooth=True)
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    bpy.data.meshes.remove(em)
    return new


# ------------------------------------------------------------ the figure

class Figure:
    """Pose + proportions -> joint positions (local frame, z forward).
    `pose` keys (all optional), each a direction (dx, dy, dz) in the body's
    own frame: arm_l/arm_r = (upper, fore), leg_l/leg_r = (thigh, shin);
    plus hip_y (pelvis height), lean (torso pitch forward, rad), head_pitch,
    head_yaw, twist (shoulders yaw)."""

    def __init__(self, height=1.75, build=1.0, pose=None, female=False, child=False):
        self.s = height / 1.75
        self.w = build
        self.female = female
        self.child = child
        self.p = dict(pose or {})

    def joints(self):
        s, w, P = self.s, self.w, self.p
        J = {}
        hip_y = P.get("hip_y", 0.93 * s)
        J["pelvis"] = Vector((0, hip_y, P.get("hip_z", 0.0)))
        lean = P.get("lean", 0.0)
        up = Vector((0, math.cos(lean), math.sin(lean)))
        J["chest"] = J["pelvis"] + up * 0.36 * s
        J["neck"] = J["pelvis"] + up * 0.52 * s
        hp = P.get("head_pitch", 0.0) + lean * 0.5
        J["head"] = J["neck"] + Vector((0, math.cos(hp), math.sin(hp))) * 0.13 * s
        tw = P.get("twist", 0.0)
        sh = 0.19 * s * w * (0.9 if self.female else 1.0)
        for side, sgn in (("l", -1), ("r", 1)):
            shoulder = J["chest"] + up * 0.09 * s + Vector((sgn * sh * math.cos(tw), 0, -sgn * sh * math.sin(tw)))
            J["sh_" + side] = shoulder
            ua, fa = P.get("arm_" + side, ((sgn * 0.12, -1, 0.02), (sgn * 0.05, -1, 0.12)))
            el = shoulder + Vector(ua).normalized() * 0.29 * s
            wr = el + Vector(fa).normalized() * 0.26 * s
            J["el_" + side], J["wr_" + side] = el, wr
            J["hand_" + side] = wr + Vector(fa).normalized() * 0.08 * s
            hip = J["pelvis"] + Vector((sgn * 0.095 * s * w, -0.04 * s, 0))
            th, sn = P.get("leg_" + side, ((0, -1, 0.0), (0, -1, -0.02)))
            kn = hip + Vector(th).normalized() * 0.45 * s
            an = kn + Vector(sn).normalized() * 0.44 * s
            J["hip_" + side], J["kn_" + side], J["an_" + side] = hip, kn, an
            J["foot_dir_" + side] = Vector(P.get("foot_" + side, (0, 0, 1))).normalized()
        J["up"] = up
        return J


def build_figure(b, P, fig, look, place):
    """`look`: skin, hair, hair_style, top, sleeves, sleeve_len, bottom,
    legs, shoes, dress (+dress_len, flare), cheeks, extras.
    `place` = (x, z, yaw) in map coordinates."""
    x0, z0, yaw = place
    R = Matrix.Rotation(yaw, 4, "Y")

    def T(v):
        v = R @ Vector(v)
        return Vector((v.x + x0, v.y, v.z + z0))
    J = fig.joints()
    s, w = fig.s, fig.w
    fem = fig.female
    skin = P[look.get("skin", "skin")]
    top = P[look.get("top", "white")]
    bottom = P[look.get("bottom", "navy")]
    sleeve = P[look.get("sleeves", look.get("top", "white"))]
    shoe = P[look.get("shoes", "shoe")]
    dress = look.get("dress")
    sl = look.get("sleeve_len", "long")
    up = J["up"]
    pel, chest, neck = J["pelvis"], J["chest"], J["neck"]
    waist = pel + up * 0.17 * s
    nk = neck + up * 0.06 * s

    def r(a, c=None):
        a *= s * w
        return (a, (c if c is not None else a / (s * w)) * s * w)

    # only what shows is skin (neck, hands, bare arms): nothing pokes through
    skin_part(b, skin, [T(neck - up * 0.03 * s), T(nk)], [(0, 1)], [r(0.06, 0.055), r(0.047)])
    tm = P[dress] if dress else top
    # the shirt / bodice: pelvis up to the neck, shoulder caps
    pts = [T(pel), T(waist), T(chest), T(neck - up * 0.015 * s), T(J["sh_l"]), T(J["sh_r"])]
    rad = [r(0.15, 0.108), r(0.122 if fem else 0.135, 0.095), r(0.15 if fem else 0.17, 0.112), r(0.068, 0.058), r(0.062), r(0.062)]
    skin_part(b, tm, pts, [(0, 1), (1, 2), (2, 3), (2, 4), (2, 5)], rad)
    for sd in ("l", "r"):
        sh, el, wr, hand = J["sh_" + sd], J["el_" + sd], J["wr_" + sd], J["hand_" + sd]
        if sl == "long":
            skin_part(b, sleeve, [T(sh), T(el), T(wr)], [(0, 1), (1, 2)], [r(0.058), r(0.045), r(0.038)])
            skin_part(b, skin, [T(wr - (wr - el).normalized() * 0.02 * s), T(hand)], [(0, 1)], [r(0.03, 0.022), r(0.032, 0.014)])
        elif sl == "short":
            skin_part(b, sleeve, [T(sh), T(sh + (el - sh) * 0.6)], [(0, 1)], [r(0.06), r(0.052)])
            skin_part(b, skin, [T(sh + (el - sh) * 0.3), T(el), T(wr), T(hand)], [(0, 1), (1, 2), (2, 3)], [r(0.045), r(0.04), r(0.03), r(0.032, 0.014)])
        else:
            skin_part(b, skin, [T(sh), T(el), T(wr), T(hand)], [(0, 1), (1, 2), (2, 3)], [r(0.05), r(0.04), r(0.03), r(0.032, 0.014)])

    # trousers (or tights under a dress) and shoes
    lm = P[look.get("legs", "tights")] if dress else bottom
    for sd in ("l", "r"):
        lp = [T(pel + Vector((0, 0.04 * s, 0))), T(J["hip_" + sd]), T(J["kn_" + sd]), T(J["an_" + sd])]
        lr = [r(0.15, 0.11), r(0.092 if fem else 0.09), r(0.058), r(0.042)]
        if dress:
            lr = [r(0.12, 0.09), r(0.088), r(0.053), r(0.037)]
        skin_part(b, lm, lp, [(0, 1), (1, 2), (2, 3)], lr)
        fd = J["foot_dir_" + sd]
        an = J["an_" + sd]
        heel = an + Vector((-fd.x * 0.03 * s, -0.06 * s, -fd.z * 0.03 * s))
        toe = an + Vector((fd.x * 0.17 * s, -0.065 * s, fd.z * 0.17 * s))
        skin_part(b, shoe, [T(an), T(heel), T(toe)], [(0, 1), (1, 2)], [r(0.042), r(0.04, 0.03), r(0.04, 0.025)])
    if dress:
        # an A-line skirt from the waist down: a smooth flared loft
        dm = P[dress]
        length = look.get("dress_len", 0.5) * s
        flare = look.get("flare", 0.12)
        rr = []
        for k in range(7):
            t = k / 6
            c = pel + up * 0.12 * s - Vector((0, length * t, 0))
            rx = (0.155 + flare * t) * s * w
            rr.append((T(c), rx, rx * 0.78, yaw))
        loft(b, dm, rr[::-1], seg=20)
        b.bar(dm, T(pel + up * 0.12 * s + Vector((-0.15 * s, 0, 0))), T(pel + up * 0.12 * s + Vector((0.15 * s, 0, 0))), 0.02)

    # the head: skull, jaw, nose, ears, painted features, hair
    hc = J["head"]
    hp = fig.p.get("head_pitch", 0.0)
    hyl = fig.p.get("head_yaw", 0.0)
    hy = yaw + hyl
    ellipsoid(b, skin, T(hc), 0.09 * s, 0.112 * s, 0.1 * s, yaw=hy, pitch=-hp, seg=22, rings=16)
    fwd = Vector((math.sin(hyl) * math.cos(hp), -math.sin(hp), math.cos(hyl) * math.cos(hp))).normalized()
    side = Vector((math.cos(hyl), 0, -math.sin(hyl)))
    upv = fwd.cross(side).normalized()

    def F(v, out, sd=0.0):
        return T(hc + side * sd * s + upv * v * s + fwd * out * s)
    ellipsoid(b, skin, F(-0.05, 0.005), 0.074 * s, 0.062 * s, 0.084 * s, yaw=hy, pitch=-hp, seg=16, rings=12)   # jaw
    ellipsoid(b, skin, F(-0.088, 0.055), 0.03 * s, 0.022 * s, 0.03 * s, yaw=hy, pitch=-hp, seg=12, rings=8)     # chin
    ellipsoid(b, skin, F(-0.003, 0.098), 0.012 * s, 0.024 * s, 0.02 * s, yaw=hy, pitch=-hp - 0.35, seg=10, rings=8)  # nose
    for sd in (-1, 1):
        ellipsoid(b, skin, F(0.0, -0.005, sd * 0.09), 0.012 * s, 0.028 * s, 0.02 * s, yaw=hy, seg=8, rings=6)
        ellipsoid(b, P["eyew"], F(0.02, 0.082, sd * 0.034), 0.02 * s, 0.012 * s, 0.013 * s, yaw=hy + sd * 0.15, pitch=-hp, seg=14, rings=8)
        ellipsoid(b, P["iris"], F(0.02, 0.0935, sd * 0.033), 0.0085 * s, 0.0085 * s, 0.004 * s, yaw=hy + sd * 0.15, pitch=-hp, seg=12, rings=6)
        ellipsoid(b, P["black"], F(0.02, 0.0965, sd * 0.033), 0.0038 * s, 0.0038 * s, 0.002 * s, yaw=hy + sd * 0.15, pitch=-hp, seg=8, rings=6)
        ellipsoid(b, skin, F(0.031, 0.083, sd * 0.034), 0.022 * s, 0.006 * s, 0.013 * s, yaw=hy + sd * 0.15, pitch=-hp, seg=12, rings=6)     # upper lid
        ellipsoid(b, P["brow"], F(0.046, 0.088, sd * 0.035), 0.021 * s, 0.0045 * s, 0.007 * s, yaw=hy + sd * 0.12, pitch=-hp, seg=10, rings=6)
        if fem:
            ellipsoid(b, P["brow"], F(0.031, 0.089, sd * 0.034), 0.018 * s, 0.003 * s, 0.006 * s, yaw=hy, pitch=-hp, seg=8, rings=4)   # lashes
        if look.get("cheeks", fem or fig.child):
            ellipsoid(b, P["cheek"], F(-0.022, 0.078, sd * 0.05), 0.019 * s, 0.015 * s, 0.008 * s, yaw=hy + sd * 0.4, pitch=-hp, seg=10, rings=6)
    lipm = P["lips"] if fem else P["cheek"]
    ellipsoid(b, lipm, F(-0.047, 0.0845), 0.024 * s, 0.0075 * s, 0.011 * s, yaw=hy, pitch=-hp, seg=14, rings=8)
    ellipsoid(b, lipm, F(-0.059, 0.083), 0.021 * s, 0.0085 * s, 0.011 * s, yaw=hy, pitch=-hp, seg=14, rings=8)
    ellipsoid(b, P["brow"], F(-0.0525, 0.0915), 0.022 * s, 0.0016 * s, 0.003 * s, yaw=hy, pitch=-hp, seg=10, rings=4)
    hair = look.get("hair")
    if hair:
        hm = P[hair]
        style = look.get("hair_style", "short")
        if style == "bob":
            ellipsoid(b, hm, F(0.03, -0.012), 0.104 * s, 0.1 * s, 0.108 * s, yaw=hy, pitch=-hp, seg=22, rings=14)
            for sd in (-1, 1):
                ellipsoid(b, hm, F(-0.03, -0.01, sd * 0.07), 0.05 * s, 0.085 * s, 0.085 * s, yaw=hy, pitch=-hp, seg=14, rings=10)
            ellipsoid(b, hm, F(0.072, 0.06), 0.08 * s, 0.028 * s, 0.045 * s, yaw=hy, pitch=-hp + 0.45, seg=14, rings=8)
        elif style == "long":
            ellipsoid(b, hm, F(0.03, -0.012), 0.102 * s, 0.1 * s, 0.108 * s, yaw=hy, pitch=-hp, seg=22, rings=14)
            ellipsoid(b, hm, F(-0.1, -0.06), 0.095 * s, 0.14 * s, 0.05 * s, yaw=hy, pitch=-hp, seg=14, rings=10)
        elif style == "bald":
            ellipsoid(b, hm, F(-0.01, -0.035), 0.094 * s, 0.065 * s, 0.08 * s, yaw=hy, pitch=-hp, seg=16, rings=10)
        else:
            ellipsoid(b, hm, F(0.034, -0.014), 0.095 * s, 0.09 * s, 0.104 * s, yaw=hy, pitch=-hp, seg=20, rings=12)
            ellipsoid(b, hm, F(0.075, 0.05), 0.07 * s, 0.022 * s, 0.04 * s, yaw=hy, pitch=-hp + 0.3, seg=12, rings=6)
    for fn in look.get("extras", ()):
        fn(b, P, J, T, fig)


# ------------------------------------------------------------ poses + extras

def stand(**kw):
    return dict(kw)


def collar(b, P, J, T, fig):
    s = fig.s
    up = J["up"]
    c = J["neck"] + up * 0.015 * s
    ellipsoid(b, P["white"], T(c + Vector((0, 0, 0.035 * s))), 0.055 * s, 0.012 * s, 0.02 * s, seg=10, rings=6)


def stole(b, P, J, T, fig):
    s = fig.s
    for sd in (-1, 1):
        a = J["neck"] + Vector((sd * 0.06 * s, 0, 0.1 * s))
        c = J["pelvis"] + Vector((sd * 0.07 * s, -0.4 * s, 0.13 * s))
        b.bar(P["purple"], T(a), T(c), 0.07 * s, 0.012 * s)
        b.bar(P["gold"], T(c + Vector((0, 0.04 * s, 0.003))), T(c + Vector((0, 0.07 * s, 0.003))), 0.072 * s, 0.014 * s)


def book(b, P, J, T, fig):
    s = fig.s
    h = J["hand_l"]
    b.box(P["black"], 0.16 * s, 0.03 * s, 0.22 * s, *T(h + Vector((0.02 * s, 0.0, 0.0))), 0, 0, 0)


def flashlight(b, P, J, T, fig):
    s = fig.s
    h = J["hand_r"]
    d = (J["hand_r"] - J["wr_r"]).normalized()
    a, c = h, h + Vector((0, 0, 0.2 * s))
    b.cyl(P["grey"], 0.022 * s, T(a), T(c), seg=8)
    b.cyl(P["lamp"], 0.03 * s, T(c), T(c + Vector((0, 0, 0.02 * s))), seg=10)


def bucket(side="r", color="pumpkin"):
    def fn(b, P, J, T, fig):
        s = fig.s
        h = J["hand_" + side]
        c = h - Vector((0, 0.12 * s, 0))
        lathe_pts = [(0, -0.09), (0.08, -0.09), (0.1, 0.04), (0.0, 0.04)]
        ellipsoid(b, P[color], T(c), 0.1 * s, 0.09 * s, 0.1 * s, seg=12, rings=8)
        b.cyl(P["black"], 0.006, T(h), T(c + Vector((0.08 * s, 0.05 * s, 0))), seg=4)
        b.cyl(P["black"], 0.006, T(h), T(c + Vector((-0.08 * s, 0.05 * s, 0))), seg=4)
    return fn


def witch_hat(b, P, J, T, fig):
    s = fig.s
    top = J["head"] + Vector((0, 0.09 * s, 0))
    b.cyl(P["black"], 0.17 * s, T(top), T(top + Vector((0, 0.012, 0))), seg=18)
    b.cyl(P["black"], 0.085 * s, T(top), T(top + Vector((0.02, 0.26 * s, -0.04))), seg=12, r2=0.005)


def sheet_ghost(b, P, J, T, fig):
    """A kid under a bedsheet with two eyeholes: a draped cone over the lot."""
    s = fig.s
    head = J["head"]
    rr = []
    for k in range(7):
        t = k / 6
        y = head.y + 0.12 * s - t * (head.y + 0.12 * s - 0.05)
        r = 0.12 * s + 0.24 * s * (t ** 0.8)
        rr.append((T(Vector((0, y, 0.01))), r, r * 0.9, 0.0))
    loft(b, P["white"], rr)
    for sd in (-1, 1):
        ellipsoid(b, P["black"], T(head + Vector((sd * 0.04 * s, 0.01 * s, 0.13 * s))), 0.02 * s, 0.028 * s, 0.01 * s, seg=8, rings=6)


# ------------------------------------------------------------ cast

def cast_proto():
    """Prototype pair for the design doc: the priest and the 60s mom."""
    priest = (Figure(1.78, 1.0, pose=dict(
        arm_r=((0.25, 0.2, 0.9), (0.05, 0.95, 0.3)),          # raised in a blessing
        arm_l=((-0.15, -0.6, 0.6), (0.2, 0.05, 1.0)),         # holding the book
        head_pitch=-0.08)),
        dict(skin="skin", hair="hair_gr", hair_style="short", top="black", bottom="black", sleeves="black",
             dress="black", dress_len=0.92, flare=0.12, extras=(collar, stole, book)))
    mom = (Figure(1.68, 0.95, female=True, pose=dict(
        arm_r=((0.25, -0.9, 0.15), (0.3, -0.3, 0.9)),
        arm_l=((-0.1, -1, -0.1), (-0.05, -1, 0.1)),
        leg_l=((0, -1, 0.18), (0, -1, -0.05)), leg_r=((0, -1, -0.12), (0, -1, -0.15)),
        head_yaw=0.25)),
        dict(skin="skin", hair="hair_dk", hair_style="bob", top="orange", sleeves="black", bottom="orange",
             dress="orange", dress_len=0.52, flare=0.06, legs="tights", cheeks=True))
    return [(priest, (-0.6, 0.0, 0.0)), (mom, (0.6, 0.0, 0.0))]


def build_proto(P):
    b = Builder()
    for fig, place in cast_proto():
        build_figure(b, P, fig[0] if isinstance(fig, tuple) else fig, fig[1] if isinstance(fig, tuple) else {}, place)
    b.finish("mq-proto.glb")


BUILDS = {"proto": build_proto}
FILES = {"proto": "mq-proto.glb"}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    names = [a for a in argv if a in BUILDS] or list(BUILDS)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    P = palette()
    P.update(mq_palette())
    import quantize_glb
    for n in names:
        BUILDS[n](P)
        quantize_glb.main([os.path.join(OUT_DIR, FILES[n])])


if __name__ == "__main__":
    main()
