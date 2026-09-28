"""
Tactical gloved hand + jacket sleeve for the first-person view (the user's
CoD-style reference: black leather gloves, dark sleeves).

    blender --background --python build_gloves.blender.py            # export .glb
    blender --background --python build_gloves.blender.py -- render  # + studio renders
      env GL_POSE=trigger|fist|relaxed|support, GL_VIEWS, GL_SAMPLES, GL_RENDER_DIR

ONE continuous skinned mesh on a bone rig (rigid segments read as a chain of
capsules). Joint positions, frame and sizes match hand-model.js
buildHumanHand, so its HAND_POSES drive the glove (game side converts each
pose rotation into bone space, see glove-model.js).
  hand frame: origin mid-palm, wrist toward +Z, fingers toward -Z, palm faces
  -Y (back of the hand +Y), right hand (thumb on -X).
Bones: Hand, F{i}_{k} (finger i 0 index..3 pinky, joint k 0..2), T0 T1 T2.
Objects: GL_Glove (skinned, one mesh), GL_Sleeve (separate, wrist at the
origin, runs toward +Z / the elbow). Authored in game coords (RX to Blender).
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Euler, Matrix, Vector

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_GLB = os.path.join(OUT_DIR, "gloves.glb")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER = "render" in ARGS
RENDER_DIR = os.environ.get("GL_RENDER_DIR", os.path.join(OUT_DIR, "_renders"))
TAU = math.tau
RX = Matrix.Rotation(math.radians(90), 4, "X")


def B(p):
    """game coords -> Blender coords"""
    return (RX @ Vector(p).to_4d()).to_3d()


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def hexlin(h):
    out = []
    for s in (16, 8, 0):
        v = ((h >> s) & 255) / 255
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def material(name, color, rough=0.5, sheen=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*hexlin(color), 1.0)
    b.inputs["Roughness"].default_value = rough
    if sheen:
        b.inputs["Sheen Weight"].default_value = sheen
    if coat:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.3
    return m


M = {
    "leather": material("GL_Leather", 0x0b0b0c, 0.42, coat=0.35),
    "panel": material("GL_LeatherPanel", 0x070708, 0.6),
    "rubber": material("GL_Rubber", 0x151617, 0.85),
    "neo": material("GL_Neoprene", 0x111213, 0.9, sheen=0.25),
    "stitch": material("GL_Stitch", 0x3c3d40, 0.8),
    "sleeve": material("GL_Sleeve", 0x262825, 0.95, sheen=0.5),
    "sleeveD": material("GL_SleeveCuff", 0x191a18, 0.92, sheen=0.3),
    "velcro": material("GL_Velcro", 0x1d1e1c, 0.98),
}

# ------------------------------------------------------------------ sizes (match hand-model.js)
FINGERS = [
    (-0.0225, (0.034, 0.023, 0.020), 0.0074),
    (-0.0075, (0.037, 0.025, 0.021), 0.0077),
    (0.0075, (0.035, 0.023, 0.020), 0.0073),
    (0.0215, (0.028, 0.018, 0.017), 0.0064),
]
PALM_W, PALM_L = 0.066, 0.07
KNUCKLE_Z = -PALM_L / 2 + 0.008
FINGER_Y = 0.002
THUMB = (Vector((-PALM_W / 2 + 0.004, -0.004, 0.012)), (0.030, 0.024, 0.021), (0.0115, 0.0098, 0.0092))
G = 0.0011   # leather over the bare hand


def smooth01(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


# ------------------------------------------------------------------ mesh builder with weights

class Skin:
    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.dl = self.bm.verts.layers.deform.verify()
        self.mats = []
        self.groups = []

    def gi(self, g):
        if g not in self.groups:
            self.groups.append(g)
        return self.groups.index(g)

    def mi(self, key):
        m = M[key]
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def v(self, p, weights=(("Hand", 1.0),)):
        vert = self.bm.verts.new(p)
        for g, w in weights:
            if w > 1e-4:
                vert[self.dl][self.gi(g)] = w
        return vert

    def face(self, verts, key, uvs=None):
        f = self.bm.faces.new(verts)
        f.material_index = self.mi(key)
        f.smooth = True
        if uvs:
            for loop, uv in zip(f.loops, uvs):
                loop[self.uv].uv = uv
        return f

    def grid(self, fn, nu, nv, key, wfn=None, cap0=None, cap1=None, uvs=(1, 1)):
        """fn(u, v) -> point; closed around u. wfn(u, v) -> weights."""
        rows = []
        for j in range(nv + 1):
            v = j / nv
            rows.append([self.v(fn(i / nu, v), wfn(i / nu, v) if wfn else (("Hand", 1.0),)) for i in range(nu)])
        for j in range(nv):
            for i in range(nu):
                i2 = (i + 1) % nu
                self.face([rows[j][i], rows[j][i2], rows[j + 1][i2], rows[j + 1][i]], key,
                          [(i / nu * uvs[0], j / nv * uvs[1]), ((i + 1) / nu * uvs[0], j / nv * uvs[1]),
                           ((i + 1) / nu * uvs[0], (j + 1) / nv * uvs[1]), (i / nu * uvs[0], (j + 1) / nv * uvs[1])])
        for row, cap, v in ((rows[0], cap0, 0.0), (rows[-1], cap1, 1.0)):
            if cap is None:
                continue
            c = self.v(cap, wfn(0.0, v) if wfn else (("Hand", 1.0),))
            n = len(row)
            for i in range(n):
                self.face([row[i], row[(i + 1) % n], c], key, [(0.5, 0.5)] * 3)
        return rows

    def tube(self, path, radius, key, weights=(("Hand", 1.0),), sides=6):
        n = len(path)
        rings = []
        for i in range(n):
            t = (path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized()
            a = t.cross(Vector((0, 1, 0)))
            if a.length < 1e-6:
                a = t.cross(Vector((1, 0, 0)))
            a.normalize()
            b = t.cross(a).normalized()
            w = weights(i / (n - 1)) if callable(weights) else weights
            rings.append([self.v(path[i] + a * (radius * math.cos(TAU * k / sides)) + b * (radius * math.sin(TAU * k / sides)), w)
                          for k in range(sides)])
        for i in range(n - 1):
            for k in range(sides):
                k2 = (k + 1) % sides
                self.face([rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]], key)
        self.face(list(reversed(rings[0])), key)
        self.face(rings[-1], key)

    def box(self, c, size, key, basis=None, weights=(("Hand", 1.0),)):
        ex, ey, ez = basis or (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        c = Vector(c)
        hx, hy, hz = (s / 2 for s in size)
        vs = [self.v(c + ex * (sx * hx) + ey * (sy * hy) + ez * (sz * hz), weights)
              for sx, sy, sz in ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1))]
        for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 5), (0, 4, 7, 3)):
            self.face([vs[i] for i in f], key)

    def finish(self, subsurf=1):
        bm = self.bm
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for vert in bm.verts:
            vert.co = B(vert.co)
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.name, me)
        scene.collection.objects.link(ob)
        for g in self.groups:
            ob.vertex_groups.new(name=g)
        if subsurf:
            ss = ob.modifiers.new("ss", "SUBSURF")
            ss.levels = subsurf
            ss.render_levels = subsurf
        for p in me.polygons:
            p.use_smooth = True
        return ob


# ------------------------------------------------------------------ the palm + cuff
Z0, Z1 = 0.050, -0.029


def palm_pt(u, v):
    a = TAU * u
    z = Z0 + (Z1 - Z0) * v
    w = 0.0285 + 0.0055 * smooth01(v * 1.3) - 0.0035 * (1 - v) ** 4
    t = 0.0122 - 0.0018 * v
    c, s = math.cos(a), math.sin(a)
    p = 2.8 if s > 0 else 2.3
    x = w * math.copysign(abs(c) ** (2 / p), c)
    y = t * math.copysign(abs(s) ** (2 / p), s)
    th = max(0.0, -c) ** 1.5 * max(0.0, -s) * math.exp(-((v - 0.5) / 0.3) ** 2)
    x -= 0.0065 * th
    y -= 0.005 * th
    hy = max(0.0, c) * max(0.0, -s) * math.exp(-((v - 0.45) / 0.3) ** 2)   # hypothenar pad, pinky side
    y -= 0.0022 * hy
    y += 0.0012 * max(0.0, s) * math.exp(-((v - 0.95) / 0.08) ** 2)          # knuckle ridge
    # tendons on the back, faint
    for fx, _, _ in FINGERS:
        y += 0.0003 * max(0.0, s) * math.exp(-((x - fx * 0.85) / 0.0025) ** 2) * smooth01((v - 0.35) / 0.4)
    k = 1 + G / 0.012
    return Vector((x * k, y * k + 0.0006, z))


glove = Skin("GL_Glove")
# Kept lean (~5k tris a hand): the hands are on screen all match, and weak
# GPUs / software rendering pay per triangle; smooth shading does the rest.
PR = 28   # segments round the palm
rows = glove.grid(palm_pt, PR, 12, "leather", cap0=None, cap1=None, uvs=(3, 2))
# knuckle end: rounded shoulder, closed
prev_pts = [palm_pt(i / PR, 1.0) for i in range(PR)]
prev = rows[-1]
for step in range(1, 4):
    f = step / 3
    ring_pts = [Vector((p.x * (1 - 0.3 * f ** 2), p.y * (1 - 0.6 * f ** 2) + 0.0006 * f, Z1 - 0.0085 * math.sin(f * math.pi / 2)))
                for p in prev_pts]
    ring = [glove.v(p) for p in ring_pts]
    for i in range(PR):
        glove.face([prev[i], prev[(i + 1) % PR], ring[(i + 1) % PR], ring[i]], "leather")
    prev = ring
c = glove.v(Vector((0, 0.0012, Z1 - 0.009)))
for i in range(PR):
    glove.face([prev[i], prev[(i + 1) % PR], c], "leather")

# wrist opening: turn in under the cuff so there's no open hole
cz = glove.v(Vector((0, 0.0006, Z0 - 0.004)))
for i in range(PR):
    glove.face([rows[0][(i + 1) % PR], rows[0][i], cz], "leather")

# back panel seams + stitching (raised piping from the cuff toward the finger gaps)
for (u0, u1) in ((0.37, 0.33), (0.13, 0.17)):
    pts = []
    for i in range(24):
        v = 0.12 + 0.78 * i / 23
        p = palm_pt(u0 + (u1 - u0) * v, v)
        n = Vector((p.x * 0.4, p.y, 0)).normalized()
        pts.append(p + n * 0.0003)
    glove.tube(pts, 0.00055, "panel", sides=6)
    for i in range(1, 22, 2):
        v = 0.14 + 0.74 * i / 22
        u = u0 + (u1 - u0) * v + 0.011
        p = palm_pt(u, v)
        q = palm_pt(u + (u1 - u0) * 0.02, v + 0.02)
        n = Vector((p.x * 0.4, p.y, 0)).normalized()
        t = (q - p).normalized()
        glove.box(p + n * 0.00035, (0.00045, 0.00045, 0.0021), "stitch", (n.cross(t).normalized(), n, t))

def palm_top(x, z):
    """y of the back of the glove at (x, z): walk the top half of the palm
    ring at that z and interpolate."""
    v = max(0.0, min(1.0, (z - Z0) / (Z1 - Z0)))
    prev = None
    for k in range(101):
        p = palm_pt(0.5 * k / 100, v)       # u 0 (+X side) .. 0.5 (-X side) over the top
        if prev is not None and (prev.x - x) * (p.x - x) <= 0:
            t = (x - prev.x) / (p.x - prev.x) if p.x != prev.x else 0
            return prev.y + (p.y - prev.y) * t
        prev = p
    return palm_pt(0.25, v).y


# Knuckle guard: one molded padded strip across the knuckles (not separate
# buttons), a soft rise over each knuckle, tapering at the edges.
KG_X0, KG_X1, KG_Z0, KG_Z1 = -0.0325, 0.0295, -0.0128, -0.0268
NS, NT = 24, 6


def kg_height(s, t):
    x = KG_X0 + (KG_X1 - KG_X0) * s
    edge = smooth01(s / 0.12) * smooth01((1 - s) / 0.12) * smooth01(t / 0.25) * smooth01((1 - t) / 0.25)
    bump = sum(math.exp(-((x - fx) / 0.0058) ** 2) for fx, _, _ in FINGERS)
    return 0.0006 + 0.0021 * edge * (0.72 + 0.28 * min(1.0, bump))


def kg_pt(s, t, lift):
    x = KG_X0 + (KG_X1 - KG_X0) * s
    z = KG_Z0 + (KG_Z1 - KG_Z0) * t
    return Vector((x, palm_top(x, z) + lift, z))


top = [[glove.v(kg_pt(i / NS, j / NT, kg_height(i / NS, j / NT))) for i in range(NS + 1)] for j in range(NT + 1)]
bot = [[glove.v(kg_pt(i / NS, j / NT, -0.0005)) for i in range(NS + 1)] for j in range(NT + 1)]
for j in range(NT):
    for i in range(NS):
        glove.face([top[j][i], top[j + 1][i], top[j + 1][i + 1], top[j][i + 1]], "rubber")
        glove.face([bot[j][i], bot[j][i + 1], bot[j + 1][i + 1], bot[j + 1][i]], "rubber")
for i in range(NS):
    glove.face([top[0][i], top[0][i + 1], bot[0][i + 1], bot[0][i]], "rubber")
    glove.face([top[NT][i + 1], top[NT][i], bot[NT][i], bot[NT][i + 1]], "rubber")
for j in range(NT):
    glove.face([top[j + 1][0], top[j][0], bot[j][0], bot[j + 1][0]], "rubber")
    glove.face([top[j][NS], top[j + 1][NS], bot[j + 1][NS], bot[j][NS]], "rubber")
# grooves between the knuckles
for k in range(3):
    gx = (FINGERS[k][0] + FINGERS[k + 1][0]) / 2
    s = (gx - KG_X0) / (KG_X1 - KG_X0)
    pts = [kg_pt(s, t, kg_height(s, t) + 0.0001) for t in (0.18, 0.4, 0.6, 0.82)]
    glove.tube(pts, 0.00045, "panel", sides=5)

# neoprene cuff with ribs + strap tab
def cuff_pt(u, v):
    p = palm_pt(u, 0.0)
    k = 1.07 + 0.025 * math.sin(v * math.pi)
    return Vector((p.x * k, (p.y - 0.0006) * k + 0.0006, Z0 + 0.004 - 0.026 * v))


glove.grid(cuff_pt, PR, 5, "neo", uvs=(3, 0.5))
for j in range(3):
    v = (j + 0.8) / 4
    glove.tube([Vector((p.x * 1.006, (p.y - 0.0006) * 1.006 + 0.0006, p.z)) for p in (cuff_pt(i / 24, v) for i in range(25))],
               0.00028, "panel", sides=4)
top = cuff_pt(0.25, 0.5)
glove.box(top + Vector((0.004, 0.0021, 0)), (0.031, 0.0022, 0.016), "velcro")
glove.box(top + Vector((0.0205, 0.0019, 0)), (0.006, 0.0026, 0.012), "rubber")
for k in range(5):
    for dz in (0.0072, -0.0072):
        glove.box(top + Vector((-0.010 + k * 0.006, 0.0033, dz)), (0.0021, 0.00045, 0.0005), "stitch")

# ------------------------------------------------------------------ fingers + thumb (continuous tubes)
BLEND = 0.0045   # half-width of the weight blend across each joint


def seg_weights(d, joints, names):
    """d = distance along the digit from its root joint. joints = cumulative
    joint distances [0, l0, l0+l1]; names = bone names per segment; before 0
    blends into 'Hand'."""
    bones = ["Hand"] + names
    edges = [0.0] + joints[1:]
    # which segment, with a smooth blend across each edge
    w = {b: 0.0 for b in bones}
    idx = 0
    for e_i, e in enumerate(edges):
        if d >= e:
            idx = e_i + 1
    cur = bones[min(idx, len(bones) - 1)]
    w[cur] = 1.0
    for e_i, e in enumerate(edges):
        if abs(d - e) < BLEND:
            t = smooth01((d - (e - BLEND)) / (2 * BLEND))
            a, b = bones[e_i], bones[min(e_i + 1, len(bones) - 1)]
            w = {k: 0.0 for k in bones}
            w[a] = 1 - t
            w[b] = t
    return tuple((k, v) for k, v in w.items() if v > 0)


def digit(origin, lens, radii, names, is_thumb=False):
    L = sum(lens)
    joints = [0.0, lens[0], lens[0] + lens[1]]
    back = 0.012 if not is_thumb else 0.018        # root sunk into the palm
    tip_r = radii[-1]

    def rad(d):
        if d < joints[1]:
            r0, r1, t = radii[0], radii[1], d / lens[0]
        elif d < joints[2]:
            r0, r1, t = radii[1], radii[2], (d - joints[1]) / lens[1]
        else:
            r0, r1, t = radii[2], radii[2] * 0.92, (d - joints[2]) / lens[2]
        r = r0 + (r1 - r0) * max(0.0, min(1.0, t))
        # knuckle bulge at each joint, thinner mid-segment
        for j in joints[1:]:
            r += 0.0006 * math.exp(-((d - j) / 0.003) ** 2)
        return r + G

    def pt(u, v):
        d = -back + (L + back) * v
        a = TAU * u
        c, s = math.cos(a), math.sin(a)
        r = rad(max(0.0, d))
        if d < 0:
            r *= 1.0 + 0.25 * (-d / back)                # flare into the palm
        tip = max(0.0, (d - (L - tip_r)) / tip_r)        # round the tip over its last radius
        if tip > 0:
            r *= math.sqrt(max(0.0, 1 - tip ** 2)) * 0.98 + 0.02
        x = r * c
        y = r * (0.86 if not is_thumb else 0.9) * s
        # creases over the joints on the back, and a seam down each side
        if s > 0.15 and not is_thumb:
            for j in joints[1:]:
                y -= 0.00035 * s * (math.exp(-((d - j + 0.0022) / 0.0009) ** 2) + math.exp(-((d - j - 0.0022) / 0.0009) ** 2))
        for side, sign in ((0.0, 1), (0.5, -1)):
            dd = min(abs(u - side), 1 - abs(u - side))
            x += sign * 0.00042 * math.exp(-(dd / 0.02) ** 2) * (1 if d > 0 else 0)
        z = -d
        return Vector((origin.x + x, origin.y + y, origin.z + z))

    def wfn(u, v):
        d = -back + (L + back) * v
        return seg_weights(d, joints, names)

    tip_pt = Vector((origin.x, origin.y, origin.z - L))
    glove.grid(pt, 12, 18, "leather", wfn=wfn, cap0=None, cap1=tip_pt, uvs=(1, 3))


for i, (fx, lens, r) in enumerate(FINGERS):
    R = max(r, 0.0069) * 1.1   # plump leather fingers, nearly touching
    digit(Vector((fx, FINGER_Y, KNUCKLE_Z)), lens, (R, R * 0.95, R * 0.9), [f"F{i}_0", f"F{i}_1", f"F{i}_2"])
digit(THUMB[0], THUMB[1], THUMB[2], ["T0", "T1", "T2"], is_thumb=True)

glove_ob = glove.finish(subsurf=0)   # dense enough to shade smooth; subsurf quadrupled it (~54k tris a hand)

# ------------------------------------------------------------------ armature
arm_data = bpy.data.armatures.new("GL_Rig")
arm = bpy.data.objects.new("GL_Rig", arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones
hand_b = eb.new("Hand")
hand_b.head = B((0, 0, 0.035))
hand_b.tail = B((0, 0, KNUCKLE_Z + 0.004))
for i, (fx, lens, r) in enumerate(FINGERS):
    parent = hand_b
    at = Vector((fx, FINGER_Y, KNUCKLE_Z))
    for k in range(3):
        b = eb.new(f"F{i}_{k}")
        b.head = B(at)
        at = at + Vector((0, 0, -lens[k]))
        b.tail = B(at)
        b.roll = 0
        b.parent = parent
        parent = b
parent = hand_b
at = THUMB[0].copy()
for k in range(3):
    b = eb.new(f"T{k}")
    b.head = B(at)
    at = at + Vector((0, 0, -THUMB[1][k]))
    b.tail = B(at)
    b.parent = parent
    parent = b
bpy.ops.object.mode_set(mode="OBJECT")
glove_ob.parent = arm
mod = glove_ob.modifiers.new("arm", "ARMATURE")
mod.object = arm

# ------------------------------------------------------------------ sleeve
SL = 0.34


def sleeve_pt(u, v):
    a = TAU * u
    z = 0.030 + SL * v
    r = 0.035 + 0.013 * v ** 0.7
    c, s = math.cos(a), math.sin(a)
    fold = 0.0024 * math.sin(v * 34 + 1.4 * math.sin(a * 2)) * math.exp(-((v - 0.2) / 0.28) ** 2) * (0.6 + 0.4 * s)
    fold += 0.0010 * math.sin(a * 5 + v * 9) + 0.0007 * math.sin(a * 9 - v * 21)
    return Vector(((r + fold) * c * 1.1, (r + fold) * s * 0.9 + 0.002, z))


sleeve = Skin("GL_Sleeve")
SR = 24   # segments round the sleeve
sleeve.grid(sleeve_pt, SR, 20, "sleeve", uvs=(2, 5))


def hem(u, v):
    p = sleeve_pt(u, 0.0)
    k = 1.0 + 0.06 * math.sin(v * math.pi)
    return Vector((p.x * k, (p.y - 0.002) * k + 0.002, 0.030 - 0.002 + 0.018 * v))


sleeve.grid(hem, SR, 4, "sleeveD", uvs=(2, 0.3))
# inner rim so the open end isn't see-through
rim = [sleeve.v(Vector((p.x * 0.9, (p.y - 0.002) * 0.9 + 0.002, 0.028))) for p in (sleeve_pt(i / SR, 0.0) for i in range(SR))]
outer = [sleeve.v(Vector((p.x * 1.0, p.y, 0.028))) for p in (sleeve_pt(i / SR, 0.0) for i in range(SR))]
for i in range(SR):
    sleeve.face([outer[i], outer[(i + 1) % SR], rim[(i + 1) % SR], rim[i]], "sleeveD")
tab = sleeve_pt(0.0, 0.06)
sleeve.box(tab + Vector((0.0024, 0, 0.004)), (0.0032, 0.022, 0.03), "velcro")
for k in range(6):
    sleeve.box(tab + Vector((0.0041, -0.009 + k * 0.0036, 0.0176)), (0.0005, 0.0018, 0.0006), "stitch")
sleeve_ob = sleeve.finish(subsurf=0)

# ------------------------------------------------------------------ export
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", use_selection=False, export_apply=True,
                          export_yup=True, export_skins=True, export_animations=False)
tris = 0
dg = bpy.context.evaluated_depsgraph_get()
for ob in scene.objects:
    if ob.type == "MESH":
        me = ob.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        print(f"  {ob.name}: {len(me.loop_triangles)} tris")
        ob.evaluated_get(dg).to_mesh_clear()
print(f"GL export: {OUT_GLB}  tris={tris}  size={os.path.getsize(OUT_GLB) // 1024} KB")

# ------------------------------------------------------------------ studio renders
if RENDER:
    os.makedirs(RENDER_DIR, exist_ok=True)
    POSES = {
        "fist": ([[1.45, 1.55, 1.0], [1.5, 1.6, 1.0], [1.5, 1.6, 1.0], [1.45, 1.55, 1.0]], 0, [0.25, 0.9, 0.5, 0.4]),
        "relaxed": ([[0.25, 0.3, 0.2], [0.28, 0.32, 0.2], [0.3, 0.35, 0.22], [0.35, 0.4, 0.25]], 0.06, [0.55, 0.3, 0.15, 0.15]),
        "trigger": ([[0.35, 0.75, 0.45], [1.3, 1.45, 0.85], [1.35, 1.5, 0.9], [1.3, 1.45, 0.9]], 0.02, [0.35, 1.0, 0.45, 0.3]),
        "support": ([[0.85, 0.9, 0.5], [0.9, 0.95, 0.5], [0.95, 1.0, 0.55], [1.0, 1.05, 0.6]], 0.03, [0.6, 0.55, 0.3, 0.2]),
    }
    pose_name = os.environ.get("GL_POSE", "trigger")
    curl, spread, thumb = POSES[pose_name]
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    pb = arm.pose.bones

    def pose_bone(name, game_euler, order="XYZ"):
        """Rotate a bone by a rotation given in the HAND frame's axes (how
        hand-model.js poses its joints), about the bone's head."""
        b = pb[name]
        R = RX.to_3x3() @ Euler(game_euler, order).to_matrix() @ RX.to_3x3().inverted()
        # parent's rest frame in armature space
        C = b.parent.bone.matrix_local.to_3x3() if b.parent else Matrix.Identity(3)
        L = b.bone.matrix_local.to_3x3()
        P = C if b.parent else Matrix.Identity(3)
        # rest-relative: basis = L^-1 * (C R C^-1)'s effect expressed at this bone
        delta = L.inverted() @ (C @ C.inverted()) @ R @ L
        b.rotation_mode = "QUATERNION"
        b.rotation_quaternion = delta.to_quaternion()

    for i in range(4):
        a, bb, cc = curl[i]
        pose_bone(f"F{i}_0", (-a, (1.5 - i) * spread, 0))
        pose_bone(f"F{i}_1", (-bb, 0, 0))
        pose_bone(f"F{i}_2", (-cc, 0, 0))
    yaw, pitch, c1, c2 = thumb
    pose_bone("T0", (-pitch, yaw, 0), "YXZ")
    pose_bone("T1", (-c1, 0, 0))
    pose_bone("T2", (-c2, 0, 0))
    bpy.ops.object.mode_set(mode="OBJECT")

    if pose_name in ("trigger", "fist"):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.0145, depth=0.12, location=B((-0.004, -0.022, -0.028)),
                                            rotation=(0, math.radians(90), 0))
        g = bpy.context.active_object
        g.scale = (1.0, 1.7, 1.0)
        g.data.materials.append(material("grip", 0x3a3d40, 0.55))
    scene.render.engine = "CYCLES"
    scene.cycles.samples = int(os.environ.get("GL_SAMPLES", "64"))
    scene.cycles.use_denoising = True
    scene.render.resolution_x = int(os.environ.get("GL_W", "1200"))
    scene.render.resolution_y = int(os.environ.get("GL_H", "900"))
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.16, 0.17, 0.19, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.5

    def area(name, loc, size, power):
        ld = bpy.data.lights.new(name, "AREA")
        ld.size = size
        ld.energy = power
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

    area("key", (0.35, -0.3, 0.45), 0.35, 9)
    area("fill", (-0.5, -0.15, 0.15), 0.6, 3)
    area("rim", (-0.05, 0.5, 0.25), 0.25, 12)
    sleeve_ob.location = B((0, 0, 0.026))

    cam_d = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_d)
    scene.collection.objects.link(cam)
    scene.camera = cam

    def shot(name, eye, look, lens=60):
        e, lk = B(eye), B(look)
        cam.location = e
        cam.rotation_euler = (lk - e).to_track_quat("-Z", "Y").to_euler()
        cam_d.lens = lens
        scene.render.filepath = os.path.join(RENDER_DIR, f"{pose_name}-{name}.png")
        bpy.ops.render.render(write_still=True)
        print("rendered", name)

    views = {
        "back": ((0.12, 0.24, 0.16), (0.0, 0.0, -0.01)),
        "side": ((-0.28, 0.04, -0.02), (0.0, -0.005, -0.01)),
        "fp": ((0.06, 0.1, 0.34), (0.0, 0.0, -0.02)),
        "palm": ((0.06, -0.24, -0.05), (0.0, 0.0, -0.01)),
    }
    for v in os.environ.get("GL_VIEWS", "back,side,fp").split(","):
        if v in views:
            shot(v, *views[v])
