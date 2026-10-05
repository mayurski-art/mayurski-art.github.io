"""
THE SOUL BLAZER, Hellseeker shotgun (weapons.js id `soulblazer`).

    blender --background --python build_soulblazer.blender.py            # export .glb
    blender --background --python build_soulblazer.blender.py -- render  # + studio renders

Read off the user's concept sheet ("It feeds on the dead. And spits fire."):
twin stacked black-iron barrels cracked with ember light, banded with rusted
collars and bone spikes, ending in a horned demon skull whose open mouth is
the muzzle; a bone-plated receiver with a row of six small skulls down each
flank on a red leather band (they are the gun's shell counter: their eyes
burn while their shell is in the tube); a leather-wrapped pump with bone
rings; skull and blade charms on chains under the barrels; a raked bone
grip with a talon; a flared stock in red leather wrap with a pentagram
plate, draped chains and a spiked bone butt.

Skulls are metaballs (smooth bone in a few elements, negative balls for the
sockets), converted once and stamped wherever a skull goes.

Game coordinates like the other builds (x right, y up, -z = muzzle forward,
metres, origin about the grip).

Nodes the game reads (weapon-model.js buildSoulBlazer):
  SB_Body       everything that never moves (muzzle skull included)
  SB_Jaw        the skull's lower jaw (pivot = the hinge; rotation.x < 0 opens it)
  SB_Pump       leather forend + action bars (pivot = its rest centre; slides on z)
  SB_IronRear / SB_IronFront   bone notch + ember bead (hidden under an optic)
  SB_Shell      one loose shell for the reload (origin at its middle, head +z)
  SB_Charm0..5  hanging charms (pivot = the top link; they swing about it)
  SB_Grip / SB_Support / SB_Muzzle / SB_Aim / SB_Port / SB_Under / SB_Rail   empties
  SB_Slot0..5   empties at the left flank skulls' eyes, front to back = shell 1..6
"""
import os
import sys
import math
import random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import gunkit as gk
from gunkit import (Part, TAU, material, lathe, box, loft, rrect, local_lathe, sweep,
                    catmull, spike, empty)
from mathutils import Vector, Quaternion

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_GLB = os.path.join(OUT_DIR, "soulblazer.glb")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER = "render" in ARGS

gk.M.update({
    "bone":     material("SB_Bone", 0xae9468, 0.66, 0.0),
    "boneD":    material("SB_BoneDark", 0x5e4831, 0.7, 0.0),
    "iron":     material("SB_Iron", 0x1d1a19, 0.42, 0.85),
    "rust":     material("SB_Rust", 0x3a2117, 0.62, 0.6),
    "leather":  material("SB_Leather", 0x4a0c0c, 0.72, 0.0),
    "leatherD": material("SB_LeatherDark", 0x1e0606, 0.8, 0.0),
    "chain":    material("SB_Chain", 0x806a4a, 0.36, 0.9),
    "socket":   material("SB_Socket", 0x150a07, 0.88, 0.0),
    "ember":    material("SB_Ember", 0xff6a1e, 0.4, 0.0, 0xff4a0e, 8.0),
    "rune":     material("SB_Rune", 0xe0161c, 0.4, 0.0, 0xd00a10, 5.0),
    "eye":      material("SB_Eye", 0xffa030, 0.3, 0.0, 0xff7010, 10.0),
    "slotEye":  material("SB_SlotEye", 0xffa030, 0.3, 0.0, 0xff7010, 10.0),
    "charmEye": material("SB_CharmEye", 0xff8a30, 0.3, 0.0, 0xff5a10, 6.0),
    "throat":   material("SB_Throat", 0xff4a10, 0.5, 0.0, 0xff3008, 6.0),
    "hull":     material("SB_Hull", 0x4a0c0c, 0.55, 0.0),
    "dark":     material("SB_Dark", 0x0d0b0a, 0.6, 0.3),
})
X = Vector((1, 0, 0))
Y = Vector((0, 1, 0))
Z = Vector((0, 0, 1))

# ------------------------------------------------------------------ dimensions (game coords)
BORE_Y = 0.010            # upper barrel axis
LOW_Y = -0.022            # lower barrel axis (the pump rides it)
BR = 0.0125               # barrel radius
R_Z0, R_Z1 = 0.078, -0.150   # receiver rear / front
R_TOP, R_BOT, R_HW = 0.030, -0.046, 0.019
RAIL_TOP = 0.036
SIGHT_Y = 0.064
REAR_SIGHT_Z = 0.056
BAR_END = -0.590          # barrels end inside the skull
PUMP_Z = -0.300           # forend rest centre
PUMP_LEN = 0.130
GRIP_TOP = Vector((0, -0.040, 0.028))
GRIP_AX = Vector((0, -0.95, 0.31)).normalized()
GRIP_LEN = 0.118
SLOT_Z = [0.030 - i * 0.031 for i in range(6)]      # flank skulls, rear to front
HANG_Y = LOW_Y - BR - 0.0075
CHARM_Z = [-0.392, -0.418, -0.444, -0.470, -0.496, -0.522]
CHARM_KIND = ["skull", "blade", "skull", "blade", "skull", "blade"]
CHARM_LINKS = [5, 7, 4, 8, 5, 6]

# The muzzle skull: skull-local units (about one unit tall, face toward -z)
# placed at SK_O, S metres per unit.
S_BIG = 0.082
SK_O = Vector((0, 0.022, -0.631))


def big(p):
    return SK_O + Vector(p) * S_BIG


# ------------------------------------------------------------------ skulls (signed distance fields)
# Each skull is a signed distance field in skull-local units (about one unit
# tall, face toward -z): bone shapes smooth-unioned, sockets and the nose
# smooth-subtracted. It is meshed with surface nets (numpy), each vertex
# pulled onto the true surface, then decimated. The same field gives every
# vertex its ambient occlusion, baked into the vertex colour as grime.
import numpy as np


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b + (a - b) * h - k * h * (1.0 - h)


def ssub(a, b, k):
    """a minus b, blended."""
    h = np.clip(0.5 - 0.5 * (a + b) / k, 0.0, 1.0)
    return a + (-b - a) * h + k * h * (1.0 - h)


def ell(P, c, r):
    x = (P[0] - c[0]) / r[0]
    y = (P[1] - c[1]) / r[1]
    z = (P[2] - c[2]) / r[2]
    k0 = np.sqrt(x * x + y * y + z * z)
    k1 = np.sqrt((x / r[0]) ** 2 + (y / r[1]) ** 2 + (z / r[2]) ** 2)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def cap(P, a, b, r):
    pa = [P[i] - a[i] for i in range(3)]
    ba = [b[i] - a[i] for i in range(3)]
    h = np.clip(sum(pa[i] * ba[i] for i in range(3)) / sum(v * v for v in ba), 0.0, 1.0)
    return np.sqrt(sum((pa[i] - ba[i] * h) ** 2 for i in range(3))) - r


def mirror(fn):
    """Apply a one-sided feature to both sides (x -> |x|)."""
    return lambda P: fn((np.abs(P[0]), P[1], P[2]))


SOCKET = (0.150, -0.055, -0.40)


def cranium_sdf(P):
    d = ell(P, (0, 0.13, 0.08), (0.40, 0.40, 0.47))                                    # vault
    d = smin(d, ell(P, (0, -0.09, -0.20), (0.335, 0.30, 0.26)), 0.08)                   # face
    m = mirror(lambda Q: ell(Q, (0.275, -0.125, -0.25), (0.10, 0.075, 0.16)))(P)        # cheekbones
    d = smin(d, m, 0.06)
    m = mirror(lambda Q: cap(Q, (0.29, -0.12, -0.20), (0.34, -0.10, 0.06), 0.045))(P)  # zygomatic arches
    d = smin(d, m, 0.05)
    d = smin(d, ell(P, (0, -0.27, -0.29), (0.215, 0.12, 0.18)), 0.07)                   # maxilla
    m = mirror(lambda Q: cap(Q, (0.31, 0.10, -0.32), (0.05, 0.005, -0.415), 0.062))(P)  # brow, angry
    d = smin(d, m, 0.05)
    d = smin(d, ell(P, (0, 0.30, -0.10), (0.06, 0.06, 0.40)), 0.06)                     # sagittal crest
    m = mirror(lambda Q: ell(Q, SOCKET, (0.112, 0.102, 0.24)))(P)                       # eye sockets
    d = ssub(d, m, 0.025)
    d = ssub(d, ell(P, (0, -0.185, -0.45), (0.048, 0.085, 0.16)), 0.02)                 # nose
    m = mirror(lambda Q: ell(Q, (0.44, 0.03, -0.05), (0.10, 0.17, 0.20)))(P)            # temple hollows
    d = ssub(d, m, 0.05)
    m = mirror(lambda Q: ell(Q, (0.27, -0.29, -0.11), (0.075, 0.08, 0.14)))(P)          # cheek hollows
    d = ssub(d, m, 0.04)
    d = ssub(d, P[1] + 0.375, 0.02)                                                       # flat under the upper teeth
    return d


def mandible_sdf(P):
    d = cap(P, (-0.095, -0.475, -0.335), (0.095, -0.475, -0.335), 0.060)                  # chin bar
    m = mirror(lambda Q: cap(Q, (0.095, -0.475, -0.335), (0.255, -0.46, -0.06), 0.050))(P)  # body
    d = smin(d, m, 0.04)
    m = mirror(lambda Q: cap(Q, (0.255, -0.46, -0.06), (0.28, -0.27, 0.10), 0.044))(P)    # ramus
    d = smin(d, m, 0.05)
    d = smin(d, ell(P, (0, -0.51, -0.355), (0.09, 0.05, 0.045)), 0.03)                   # chin point
    d = ssub(d, -0.41 - P[1], 0.02)                                                       # flat on top for the teeth
    return d


def skull_full_sdf(P):
    return np.minimum(cranium_sdf(P), mandible_sdf(P))


def surface_nets(fn, lo, hi, h):
    nx, ny, nz = (int(math.ceil((hi[i] - lo[i]) / h)) + 1 for i in range(3))
    xs = lo[0] + h * np.arange(nx)
    ys = lo[1] + h * np.arange(ny)
    zs = lo[2] + h * np.arange(nz)
    X, Yg, Zg = np.meshgrid(xs, ys, zs, indexing="ij")
    D = fn((X, Yg, Zg))
    S = np.zeros((nx - 1, ny - 1, nz - 1, 3))
    C = np.zeros((nx - 1, ny - 1, nz - 1))
    quads = []
    for ax in range(3):
        sl0 = [slice(None)] * 3
        sl1 = [slice(None)] * 3
        sl0[ax] = slice(0, -1)
        sl1[ax] = slice(1, None)
        d0, d1 = D[tuple(sl0)], D[tuple(sl1)]
        cross = (d0 < 0) != (d1 < 0)
        idx = np.argwhere(cross)
        if not len(idx):
            continue
        a, b = d0[cross], d1[cross]
        t = a / (a - b)
        p = np.stack([xs[idx[:, 0]], ys[idx[:, 1]], zs[idx[:, 2]]], axis=1)
        p[:, ax] += t * h
        o1, o2 = [i for i in range(3) if i != ax]
        # the four cells round this edge
        cells = []
        for du, dv in ((-1, -1), (0, -1), (0, 0), (-1, 0)):
            c = idx.copy()
            c[:, o1] += du
            c[:, o2] += dv
            cells.append(c)
        ok = np.ones(len(idx), bool)
        for c in cells:
            for i in range(3):
                ok &= (c[:, i] >= 0) & (c[:, i] < S.shape[i])
        for c in cells:
            cc = c[ok]
            np.add.at(S, (cc[:, 0], cc[:, 1], cc[:, 2]), p[ok])
            np.add.at(C, (cc[:, 0], cc[:, 1], cc[:, 2]), 1)
        flip = (a < 0)[ok]
        q = np.stack([c[ok] for c in cells], axis=1)
        q[flip] = q[flip][:, ::-1]
        quads.append(q)
    act = C > 0
    vid = -np.ones(C.shape, np.int64)
    vid[act] = np.arange(int(act.sum()))
    V = S[act] / C[act][:, None]
    Q = np.concatenate(quads)
    F = vid[Q[:, :, 0], Q[:, :, 1], Q[:, :, 2]]
    F = F[(F >= 0).all(axis=1)]
    return V, F


def grad(fn, V, e=0.002):
    g = np.zeros_like(V)
    for i in range(3):
        a, b = V.copy(), V.copy()
        a[:, i] += e
        b[:, i] -= e
        g[:, i] = fn(tuple(a.T)) - fn(tuple(b.T))
    n = np.linalg.norm(g, axis=1, keepdims=True)
    return g / np.maximum(n, 1e-9)


def project(fn, V, iters=3):
    for _ in range(iters):
        V = V - grad(fn, V) * fn(tuple(V.T))[:, None]
    return V


def sdf_mesh(name, fn, lo, hi, h, keep=1.0):
    V, F = surface_nets(fn, lo, hi, h)
    V = project(fn, V)
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in V], [], [tuple(int(i) for i in f) for f in F])
    me.validate()
    if keep < 1.0:
        me = decimated(me, keep)
    # pull the decimated vertices back onto the surface
    V = np.array([v.co[:] for v in me.vertices])
    V = project(fn, V, 2)
    return V, [tuple(p.vertices) for p in me.polygons]


def decimated(me, ratio):
    ob = bpy.data.objects.new("tmpdec", me)
    gk.scene.collection.objects.link(ob)
    m = ob.modifiers.new("d", "DECIMATE")
    m.ratio = ratio
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    out = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    return out


def smooth01(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def skull_colours(fn, V, teeth=False):
    """Grime: SDF ambient occlusion (the classic five-step march along the
    normal), the sockets and nose sunk to near black, the teeth line."""
    N = grad(fn, V)
    occ = np.zeros(len(V))
    for i in range(1, 6):
        dl = 0.035 * i
        occ += (dl - fn(tuple((V + N * dl).T))) / (2.0 ** i)
    ao = np.clip(1.0 - occ * 4.0, 0.0, 1.0)
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    r = np.sqrt((np.abs(x) - SOCKET[0]) ** 2 + ((y - SOCKET[1]) * 1.05) ** 2)
    sock = smooth01(0.115, 0.06, r) * smooth01(-0.45, -0.36, -z) * 0.9
    nose = smooth01(0.06, 0.03, np.abs(x)) * smooth01(-0.05, -0.12, y) * smooth01(-0.30, -0.24, y) * smooth01(-0.40, -0.44, z) * 0.85
    d = np.maximum(sock, nose)
    if teeth:
        line = smooth01(0.035, 0.0, np.abs(y + 0.39)) * smooth01(-0.15, -0.25, z)
        gaps = 0.5 + 0.5 * np.cos((x + 1) / 0.062 * TAU)
        d = np.maximum(d, line * (0.5 + 0.45 * gaps))
    g = np.clip(ao * (1.0 - d), 0.05, 1.0)
    return [(float(v), float(v) * 0.96, float(v) * 0.92, 1.0) for v in g]


def bbox(verts):
    lo = Vector((min(v.x for v in verts), min(v.y for v in verts), min(v.z for v in verts)))
    hi = Vector((max(v.x for v in verts), max(v.y for v in verts), max(v.z for v in verts)))
    return lo, hi


class CPart(Part):
    """A Part with a vertex colour per vertex (white unless set). Exported as
    COLOR_0, which three.js multiplies into the material colour: the grime
    and cavity darkness on the skulls."""

    def __init__(self, name, pivot=(0, 0, 0)):
        super().__init__(name, pivot)
        self.col_layer = self.bm.verts.layers.float_color.new("Col")
        self.col = (1.0, 1.0, 1.0, 1.0)

    def v(self, p, col=None):
        vert = self.bm.verts.new(p)
        vert[self.col_layer] = col or self.col
        return vert

    def finish(self, *a, **k):
        ob = super().finish(*a, **k)
        ca = ob.data.color_attributes
        if "Col" in ca:
            ca.active_color = ca["Col"]
            ca.render_color_index = ca.active_color_index
        return ob


def stamp(P, data, frame, key="bone"):
    """Copy skull data into a Part; frame maps a skull-local Vector to game."""
    verts, faces, cols = data
    vs = [P.v(frame(v), c) for v, c in zip(verts, cols)]
    for idx in faces:
        try:
            P.face([vs[i] for i in idx], key)
        except ValueError:
            pass   # a degenerate face from the decimator


def ball(P, c, r, key, segs=12, rings=7):
    prof = [(r - r * math.cos(math.pi * k / rings), r * math.sin(math.pi * k / rings) if 0 < k < rings else 0.0)
            for k in range(rings + 1)]
    local_lathe(P, Vector(c) - Vector((0, r, 0)), (0, 1, 0), prof, key, segs=segs)


def frame_of(origin, ez, scale, flat=1.0):
    """Skull-local -> game: the face (local -z) looks along -ez; `flat`
    squashes the skull's depth (a relief skull on a flank)."""
    ez = Vector(ez).normalized()
    ey = Y.copy()
    ex = ey.cross(ez).normalized()
    o = Vector(origin)
    return lambda p: o + ex * (p.x * scale) + ey * (p.y * scale) + ez * (p.z * scale * flat)


def skull_data(name, fn, h, keep, teeth):
    V, F = sdf_mesh(name, fn, (-0.5, -0.65, -0.62), (0.5, 0.62, 0.62), h, keep)
    return [Vector(v) for v in V], F, skull_colours(fn, V, teeth)


# The ember sits deep in each socket (the game adds its glow).
EYE_L = Vector((-SOCKET[0], SOCKET[1] - 0.01, -0.30))
EYE_R = Vector((SOCKET[0], SOCKET[1] - 0.01, -0.30))

print("building skulls...")
big_cran = skull_data("SkullBig", cranium_sdf, 0.016, 0.3, False)
big_jaw = skull_data("JawBig", mandible_sdf, 0.014, 0.4, False)
small_skull = skull_data("SkullSmall", skull_full_sdf, 0.05, 0.22, True)
for nm, dd in (("cranium", big_cran), ("jaw", big_jaw), ("small", small_skull)):
    lo, hi = bbox(dd[0])
    print(f"  {nm} bbox lo={tuple(round(v, 3) for v in lo)} hi={tuple(round(v, 3) for v in hi)}  faces={len(dd[1])}")


def crown_y(data, z0, z1):
    return max(v.y for v in data[0] if abs(v.x) < 0.06 and z0 < v.z < z1)


# ------------------------------------------------------------------ chains

def chain(P, path, key, link=0.0058, wire=0.0008, width=0.0028, segs=10, sides=5, phase=0):
    """Links along a sampled path, each at right angles to the last."""
    pts = [Vector(p) for p in path]
    lens = [0.0]
    for i in range(1, len(pts)):
        lens.append(lens[-1] + (pts[i] - pts[i - 1]).length)
    L = lens[-1]
    pitch = link * 0.78
    n = max(1, int(L / pitch))
    out = []
    for k in range(n):
        s = (k + 0.5) * L / n
        j = 1
        while j < len(lens) - 1 and lens[j] < s:
            j += 1
        u = (s - lens[j - 1]) / max(1e-9, lens[j] - lens[j - 1])
        c = pts[j - 1].lerp(pts[j], u)
        t = (pts[j] - pts[j - 1]).normalized()
        n0 = t.cross(X) if abs(t.x) < 0.9 else t.cross(Y)
        n0.normalize()
        n1 = t.cross(n0).normalized()
        side = n0 if (k + phase) % 2 == 0 else n1
        ring = [c + t * (link / 2 * math.cos(TAU * a / segs)) + side * (width / 2 * math.sin(TAU * a / segs)) for a in range(segs)]
        sweep(P, ring + [ring[0]], lambda q: wire, key, sides=sides, uv=False)
        out.append(c)
    return out


def ring_x(P, c, r, wire, key, segs=14):
    """A ring standing in the YZ plane (an eyelet a chain hangs from)."""
    c = Vector(c)
    ring = [c + Y * (r * math.cos(TAU * a / segs)) + Z * (r * math.sin(TAU * a / segs)) for a in range(segs)]
    sweep(P, ring + [ring[0]], lambda q: wire, key, sides=6, uv=False)


# ------------------------------------------------------------------ crack lines

def _bolt(rnd, n, step, jag):
    """A lightning-bolt walk: n kinks, each a short run then a hard turn."""
    out = [(0.0, 0.0)]
    u = v = 0.0
    dirv = rnd.choice((-1, 1))
    for _ in range(n):
        u += step * rnd.uniform(0.6, 1.4)
        if rnd.random() < 0.55:
            dirv = -dirv
        v += dirv * jag * rnd.uniform(0.3, 1.0)
        out.append((u, v))
    return out


def crack(P, cy, a_mid, z0, z1, seed, r_bar, width=0.0007, cx=0.0):
    """Broken runs of molten crack round a barrel, each with a branch or
    two: (u along -z, v around the barrel)."""
    rnd = random.Random(seed)
    z = z0
    while z > z1 + 0.02:
        run = rnd.uniform(0.035, 0.11)
        pts2 = _bolt(rnd, rnd.randint(5, 9), run / 7, 0.10)
        a0 = a_mid + rnd.uniform(-0.25, 0.25)
        def on_bar(u, v):
            a = a0 + v
            return Vector((cx + r_bar * math.cos(a), cy + r_bar * math.sin(a), z - u))
        w = width * rnd.uniform(0.7, 1.3)
        sweep(P, [on_bar(u, v) for u, v in pts2], lambda s: w * (0.25 + 0.75 * math.sin(math.pi * s) ** 0.6), "ember", sides=5, uv=False)
        if rnd.random() < 0.7:
            k = rnd.randint(1, len(pts2) - 2)
            bu, bv = pts2[k]
            br = _bolt(rnd, 3, run / 9, 0.14)
            sweep(P, [on_bar(bu + u, bv + v * 1.3) for u, v in br], lambda s: w * 0.6 * (1 - s) + 0.0002, "ember", sides=5, uv=False)
        z -= run + rnd.uniform(0.012, 0.05)


def side_crack(P, x, y0, z0, z1, seed, amp=0.004, width=0.0007):
    """A jagged crack on a flat flank at x (runs toward -z)."""
    rnd = random.Random(seed)
    z = z0
    while z > z1 + 0.015:
        run = rnd.uniform(0.03, 0.08)
        pts2 = _bolt(rnd, rnd.randint(4, 8), run / 6, amp)
        yb = y0 + rnd.uniform(-amp, amp)
        w = width * rnd.uniform(0.7, 1.3)
        sweep(P, [Vector((x, yb + v, z - u)) for u, v in pts2], lambda s: w * (0.25 + 0.75 * math.sin(math.pi * s) ** 0.6),
              "ember", sides=5, uv=False)
        z -= run + rnd.uniform(0.01, 0.04)


body = CPart("SB_Body")
org = CPart("SB_Organic")   # skulls, spikes, chains, cracks: smooth or thin, no bevel

# ---- receiver: blackened iron block, bone plates up top, the leather skull band below
loft(body, [
    rrect(R_Z0, R_HW - 0.002, R_TOP - 0.004, R_BOT + 0.004, 0.006),
    rrect(R_Z0 - 0.004, R_HW, R_TOP, R_BOT, 0.005),
    rrect(R_Z1 + 0.004, R_HW, R_TOP, R_BOT, 0.005),
    rrect(R_Z1, R_HW - 0.002, R_TOP - 0.003, R_BOT + 0.003, 0.006),
], "iron")


def flank_slab(sx, z0, z1, ytop, ybot, t, key, r=0.0015):
    """A raised flat panel on a receiver flank, its outer face at R_HW + t."""
    xc = sx * (R_HW + t / 2 - 0.0004)
    loft(body, [rrect(z, t / 2 + 0.0004, ytop, ybot, r, x0=xc) for z in (z0, z0 - 0.003, z1 + 0.003, z1)], key)


SKULL_S = 0.0235
SKULL_Y = -0.013


def slot_frame(sx, z):
    # A relief skull on the flank, face out, squashed to half its depth.
    return frame_of((sx * (R_HW + 0.0040), SKULL_Y + 0.03 * SKULL_S, z), (-sx, 0, 0), SKULL_S, flat=0.5)


for sx in (-1, 1):
    flank_slab(sx, 0.066, -0.142, 0.0275, 0.0055, 0.0020, "bone")
    side_crack(org, sx * (R_HW + 0.0020), 0.0168, 0.054, -0.132, 11 + sx, amp=0.006, width=0.0008)
    flank_slab(sx, 0.050, -0.146, 0.0030, -0.0300, 0.0026, "leather")
    for k in range(25):                         # bone stitching along the band
        z = 0.045 - k * 0.0078
        for y in (0.0016, -0.0286):
            box(body, (sx * (R_HW + 0.0024), y, z), (0.0012, 0.0012, 0.0034), "bone")
    for z in SLOT_Z:
        f = slot_frame(sx, z)
        stamp(org, small_skull, f)
        for e in (EYE_L, EYE_R):
            ball(org, f(e + Vector((0, 0, -0.08))), 0.085 * SKULL_S, "slotEye", segs=8, rings=5)

# loading port underneath (the reload thumbs shells in here)
box(body, (0, R_BOT - 0.0003, -0.080), (0.022, 0.0016, 0.090), "socket")
# ejection port on the right
box(body, (R_HW + 0.0004, 0.010, -0.066), (0.0016, 0.012, 0.050), "socket")

# ---- the spine: an iron strap with a row of bone vertebrae on it (optics
# sit on RAIL_TOP), swept-back spikes off both sides
box(body, (0, R_TOP + 0.0015, -0.035), (0.016, 0.003, 0.214), "iron")
for k in range(9):
    z = 0.060 - k * 0.0238
    local_lathe(org, (0, R_TOP + 0.002, z), (0, 1, 0), [(0, 0.0082), (0.0025, 0.0086), (0.0035, 0.0072), (0.0040, 0.0)],
                "bone", segs=14)
    for sx in (-1, 1):   # the transverse processes
        local_lathe(org, (sx * 0.004, R_TOP + 0.0035, z), (sx, 0.25, 0.15), [(0, 0.0026), (0.0070, 0.0016), (0.0085, 0.0)],
                    "boneD", segs=6)
for k in range(6):
    z = 0.050 - k * 0.036
    for sx in (-1, 1):
        spike(org, (sx * 0.0105, R_TOP + 0.004, z), (sx * 0.78, 0.42, 0.46), 0.015 + 0.002 * (k % 2), 0.0029,
              "bone", sides=5, tip_key="boneD", spin=0.3 * k)

# ---- twin barrels, the web between them, ember cracks
for cy in (BORE_Y, LOW_Y):
    lathe(body, [(R_Z1 + 0.004, 0.0), (R_Z1 + 0.004, BR + 0.0022), (R_Z1 - 0.012, BR + 0.0022), (R_Z1 - 0.016, BR),
                 (BAR_END, BR), (BAR_END, 0.0)], "iron", segs=36, cy=cy)
box(body, (0, (BORE_Y + LOW_Y) / 2, (R_Z1 + BAR_END) / 2), (0.011, 0.030, R_Z1 - BAR_END), "iron")
seed = 100
for cy, angs in ((BORE_Y, (math.pi - 0.55, math.pi + 0.15, 0.55, -0.15, math.pi / 2 + 0.35, math.pi / 2 - 0.35)),
                 (LOW_Y, (math.pi + 0.05, -0.05, 3 * math.pi / 2))):
    for a in angs:
        crack(org, cy, a, R_Z1 - 0.012, BAR_END + 0.012, seed, BR + 0.0001)
        seed += 1
for sx in (-1, 1):
    side_crack(org, sx * 0.0056, (BORE_Y + LOW_Y) / 2, R_Z1 - 0.02, BAR_END + 0.02, 40 + sx, amp=0.004)


def collar(z, depth, grow=0.0, spikes=True):
    secs = []
    for dz, g in ((depth / 2, 0.0), (depth / 2 - 0.0015, 0.0016), (-depth / 2 + 0.0015, 0.0016), (-depth / 2, 0.0)):
        secs.append(rrect(z + dz, 0.0150 + g + grow, BORE_Y + BR + 0.0022 + g + grow, LOW_Y - BR - 0.0022 - g - grow, 0.012))
    loft(body, secs, "rust")
    for sx in (-1, 1):
        for y in (BORE_Y + 0.004, LOW_Y - 0.002):
            gk.screw(body, (sx * (0.0167 + grow), y, z), (sx, 0, 0), r=0.0021, key="iron")
        if spikes:
            spike(org, (sx * (0.0160 + grow), (BORE_Y + LOW_Y) / 2, z), (sx, -0.15, 0.35), 0.012 + grow * 0.6, 0.0034,
                  "bone", sides=5, tip_key="boneD")


collar(-0.380, 0.010)
collar(-0.455, 0.010)
collar(-0.528, 0.010)
collar(-0.578, 0.016, grow=0.003)
# spikes along the top of the upper barrel, swept back off the sight line
for k in range(9):
    z = -0.170 - k * 0.046
    if any(abs(z - c) < 0.012 for c in (-0.380, -0.455, -0.528)):
        continue
    for sx in (-1, 1):
        spike(org, (sx * 0.0072, BORE_Y + BR - 0.002, z), (sx * 0.70, 0.62, 0.40), 0.014 + 0.004 * ((k + 1) % 2), 0.0028,
              "bone", sides=5, tip_key="boneD", spin=0.4 * k)

# ---- the chain bar under the lower barrel, an eyelet per charm
box(body, (0, HANG_Y + 0.0050, (CHARM_Z[0] + CHARM_Z[-1]) / 2), (0.006, 0.0040, abs(CHARM_Z[-1] - CHARM_Z[0]) + 0.024), "iron")
for z in CHARM_Z:
    ring_x(org, (0, HANG_Y + 0.0012, z), 0.0026, 0.0008, "chain")

# ---- muzzle skull: cranium, eyes, upper fangs, horns, throat
stamp(org, big_cran, big)
for e in (EYE_L, EYE_R):
    ball(org, big(e + Vector((0, 0, 0.03))), 0.045 * S_BIG, "eye", segs=12, rings=7)
ball(org, big((0, -0.33, -0.22)), 0.17 * S_BIG, "throat", segs=16, rings=8)
for k in range(9):
    u = (k - 4) / 4.0
    x = 0.21 * u
    z = -0.43 + 0.16 * u * u
    canine = abs(k - 4) == 2
    ln = (0.17 if canine else 0.085 if k != 4 else 0.07) * S_BIG
    local_lathe(org, big((x, -0.31, z)), (0, -1, 0.06), [(0.0, 0.034 * S_BIG), (ln * 0.35, 0.03 * S_BIG), (ln, 0.0)], "bone", segs=6)
for sx in (-1, 1):
    hp = catmull([big((sx * 0.30, 0.30, 0.02)), big((sx * 0.46, 0.44, 0.24)), big((sx * 0.55, 0.64, 0.56)),
                  big((sx * 0.50, 0.80, 0.86)), big((sx * 0.40, 0.86, 1.08))], 26)
    sweep(org, hp, lambda s: S_BIG * 0.11 * (1 - s) ** 0.85 * (1 + 0.07 * math.sin(s * 46)) + 0.0004, "boneD", sides=14, uv=False)
    # crown spikes either side of the sight line
    for k, (z, ln) in enumerate(((-0.05, 0.20), (0.18, 0.24), (0.40, 0.18))):
        spike(org, big((sx * 0.16, 0.48 - 0.04 * k, z)), (sx * 0.45, 0.65, 0.55), ln * S_BIG, 0.045 * S_BIG,
              "bone", sides=5, tip_key="boneD")

# ---- pistol grip: raked bone, leather wrap, a talon off the base
nrm = X.cross(GRIP_AX).normalized()
secs = []
N = 16
for i in range(N + 1):
    t = i / N
    c = GRIP_TOP + GRIP_AX * (GRIP_LEN * t)
    hw = 0.0150 + (0.0022 if t > 0.9 else 0.0) + 0.0012 * math.sin(t * math.pi)
    back = 0.0200 + 0.0035 * math.sin(t * math.pi * 0.9)
    front = 0.0190
    if 0.18 < t < 0.88:
        front += 0.0028 * math.cos((t - 0.18) / 0.70 * 3 * TAU) - 0.0008
    if t > 0.92:
        front += 0.004
        back += 0.004
    ring = []
    for k in range(28):
        a = TAU * k / 28
        ca, sa = math.cos(a), math.sin(a)
        u = hw * math.copysign(abs(ca) ** (2 / 2.6), ca)
        dv = front if sa > 0 else back
        v = dv * math.copysign(abs(sa) ** (2 / 2.6), sa)
        p = c + X * u + nrm * v
        ring.append((p.x, p.y, p.z))
    secs.append(ring)
loft(body, secs, "bone")
for k in range(4):                                  # leather wraps round the grip
    t = 0.22 + k * 0.17
    c = GRIP_TOP + GRIP_AX * (GRIP_LEN * t)
    ring = []
    for a in range(24):
        ang = TAU * a / 24
        ca, sa = math.cos(ang), math.sin(ang)
        dv = 0.0215 if sa > 0 else 0.0232
        ring.append(c + X * (0.0172 * math.copysign(abs(ca) ** (2 / 2.6), ca)) + nrm * (dv * math.copysign(abs(sa) ** (2 / 2.6), sa))
                    + GRIP_AX * (0.004 * ca))
    sweep(org, ring + [ring[0]], lambda s: 0.0024, "leatherD", sides=6, uv=False)
gb = GRIP_TOP + GRIP_AX * (GRIP_LEN + 0.004)
talon = catmull([gb + Vector((0, 0.004, 0.012)), gb + Vector((0, -0.010, 0.026)), gb + Vector((0, -0.028, 0.030)),
                 gb + Vector((0, -0.042, 0.020))], 16)
sweep(org, talon, lambda s: 0.0065 * (1 - s) ** 0.9 + 0.0003, "boneD", sides=8, uv=False)

# ---- trigger guard (iron, a spur under it) and trigger
guard = catmull([(0, R_BOT + 0.002, -0.020), (0, -0.066, -0.014), (0, -0.071, 0.006), (0, -0.066, 0.024)], 24)
sweep(org, guard, lambda s: 0.0030, "iron", sides=10, uv=False)
spike(org, (0, -0.069, -0.010), (0, -0.55, -0.8), 0.014, 0.0028, "boneD", sides=5)
trig = catmull([(0, R_BOT, 0.004), (0, -0.054, 0.002), (0, -0.061, 0.007), (0, -0.064, 0.014)], 16)
sweep(org, trig, lambda s: 0.0022 - 0.0006 * s, "rust", sides=8, uv=False)

# ---- stock: flared, red leather, bone edging, straps, pentagram plate, spiked butt
ST_Z0, ST_Z1 = R_Z0, 0.350


def stock_dims(z, inflate=0.0):
    t = max(0.0, min(1.0, (z - ST_Z0) / (ST_Z1 - ST_Z0)))
    hw = 0.0168 + 0.0040 * t + inflate
    ytop = 0.026 + 0.006 * t + inflate
    ybot = -0.042 - 0.085 * t ** 1.15 - inflate
    return hw, ytop, ybot


def stock_sec(z, inflate=0.0, slant=0.0):
    hw, yt, yb = stock_dims(z, inflate)
    pts = rrect(z, hw, yt, yb, 0.007)
    return [(p[0], p[1], p[2] + slant * (p[1] - (yt + yb) / 2)) for p in pts]


loft(body, [stock_sec(ST_Z0 + (ST_Z1 - ST_Z0) * k / 12) for k in range(13)], "leather")
for z in (0.112, 0.160, 0.300):                     # slanted wraps
    loft(body, [stock_sec(z, 0.0013, 0.5), stock_sec(z + 0.007, 0.0013, 0.5)], "leatherD")
for side in (0, 1):                                  # bone edging along the top and bottom
    pts = []
    for k in range(13):
        z = ST_Z0 + 0.01 + (ST_Z1 - ST_Z0 - 0.01) * k / 12
        hw, yt, yb = stock_dims(z)
        pts.append(Vector((0, yt - 0.0015 if side == 0 else yb + 0.0015, z)))
    sweep(org, pts, lambda s: 0.0032, "bone", sides=8, uv=False)
for sx in (-1, 1):                                   # a bone frame round each flank
    outline = []
    for k in range(10):
        z = ST_Z0 + 0.022 + (ST_Z1 - 0.010 - ST_Z0 - 0.022) * k / 9
        outline.append(Vector((0, stock_dims(z)[1] - 0.0055, z)))
    hwe, yte, ybe = stock_dims(ST_Z1 - 0.010)
    for k in range(1, 6):
        outline.append(Vector((0, yte - 0.0055 + (ybe - yte + 0.011) * k / 5, ST_Z1 - 0.010)))
    for k in range(1, 10):
        z = ST_Z1 - 0.010 - (ST_Z1 - 0.010 - ST_Z0 - 0.040) * k / 9
        outline.append(Vector((0, stock_dims(z)[2] + 0.0055, z)))
    for p in outline:
        p.x = sx * (stock_dims(p.z)[0] + 0.0009)
    sweep(org, outline, lambda s: 0.0021, "bone", sides=8, uv=False)
for k in range(3):                                   # spikes along the comb
    z = 0.255 + k * 0.035
    spike(org, (0, stock_dims(z)[1] - 0.001, z), (0, 0.7, 0.7), 0.014 + 0.004 * k, 0.0034, "bone", sides=5, tip_key="boneD")
PZ = 0.232
hw_p, yt_p, yb_p = stock_dims(PZ)
PY = (yt_p + yb_p) / 2 - 0.004
for sx in (-1, 1):
    local_lathe(org, (sx * (hw_p + 0.0004), PY, PZ), (sx, 0, 0), [(0, 0.025), (0.0016, 0.025), (0.0022, 0.0232), (0.0022, 0.0)], "iron", segs=36)
    xr = sx * (hw_p + 0.0026)
    ring = [Vector((xr, PY + 0.0245 * math.cos(TAU * a / 40), PZ + 0.0245 * math.sin(TAU * a / 40))) for a in range(40)]
    sweep(org, ring + [ring[0]], lambda s: 0.0009, "rune", sides=5, uv=False)
    star = [Vector((xr, PY + 0.0235 * math.cos(TAU * k / 5), PZ + 0.0235 * math.sin(TAU * k / 5))) for k in range(5)]
    for k in range(5):
        a, b = star[k], star[(k + 2) % 5]
        sweep(org, [a, a.lerp(b, 0.5), b], lambda s: 0.0007, "rune", sides=5, uv=False)
    for k in range(6):                               # rivets round the plate
        a = TAU * k / 6 + 0.26
        local_lathe(org, (sx * (hw_p + 0.0022), PY + 0.0280 * math.cos(a), PZ + 0.0280 * math.sin(a)), (sx, 0, 0),
                    [(0, 0.0018), (0.0008, 0.0016), (0.0012, 0.0)], "bone", segs=8)
    # a chain draped along the upper flank, receiver to heel
    drape = []
    for k in range(9):
        z = 0.094 + (0.338 - 0.094) * k / 8
        hw, yt, yb = stock_dims(z)
        sag = math.sin(math.pi * k / 8) * 0.014
        drape.append((sx * (hw + 0.0042), yt - 0.012 - sag - 0.012 * k / 8, z))
    chain(org, catmull(drape, 30), "chain", link=0.0085, wire=0.0011, width=0.0042, segs=10, sides=5, phase=int(sx > 0))
loft(body, [stock_sec(ST_Z1 - 0.002, 0.0018), stock_sec(ST_Z1 + 0.012, 0.0018)], "bone")
hw_b, yt_b, yb_b = stock_dims(ST_Z1)
for k in range(7):                                   # ribs on the butt plate
    box(body, (0, yt_b - 0.012 - k * 0.0215, ST_Z1 + 0.0126), (2 * hw_b, 0.003, 0.0016), "boneD")
spike(org, (0, yt_b, ST_Z1 + 0.004), (0, 0.55, 0.85), 0.030, 0.0060, "bone", sides=5, tip_key="boneD")
spike(org, (0, yb_b + 0.004, ST_Z1 + 0.006), (0, -0.62, 0.78), 0.040, 0.0068, "bone", sides=5, tip_key="boneD")
for sx in (-1, 1):
    spike(org, (sx * hw_b, (yt_b + yb_b) / 2 + 0.02, ST_Z1 + 0.004), (sx * 0.6, 0.15, 0.78), 0.018, 0.0040, "bone", sides=5, tip_key="boneD")
    spike(org, (sx * hw_b, yb_b + 0.022, ST_Z1 + 0.004), (sx * 0.55, -0.25, 0.78), 0.016, 0.0036, "bone", sides=5, tip_key="boneD")
for k in range(4):                                   # spikes down the bottom edge
    z = 0.150 + k * 0.048
    hw, yt, yb = stock_dims(z)
    spike(org, (0, yb + 0.002, z), (0, -0.55, 0.8), 0.012, 0.0030, "bone", sides=5, tip_key="boneD")

body.finish(bevel=0.00035)
org.finish(smooth_angle=80)

# ---- jaw (hinge pivot): mandible, lower fangs
HINGE = big((0, -0.27, 0.15))
jaw = CPart("SB_Jaw", pivot=tuple(HINGE))
stamp(jaw, big_jaw, big)
for k in range(7):
    u = (k - 3) / 3.0
    x = 0.15 * u
    z = -0.375 + 0.14 * u * u
    canine = abs(k - 3) == 2
    ln = (0.13 if canine else 0.07) * S_BIG
    local_lathe(jaw, big((x, -0.405, z)), (0, 1, -0.05), [(0.0, 0.031 * S_BIG), (ln * 0.35, 0.027 * S_BIG), (ln, 0.0)], "bone", segs=6)
jaw.finish(bevel=0.0002)

# ---- the pump: red leather wrap between bone rings, spurred underneath
pump = CPart("SB_Pump", pivot=(0, LOW_Y, PUMP_Z))
PZ0, PZ1 = PUMP_Z + PUMP_LEN / 2, PUMP_Z - PUMP_LEN / 2
lathe(pump, [(PZ0, 0.0135, "bone"), (PZ0, 0.0215, "bone"), (PZ0 - 0.003, 0.0236, "bone"), (PZ0 - 0.012, 0.0236, "bone"),
             (PZ0 - 0.014, 0.0212, "leather"), (PUMP_Z + 0.008, 0.0212, "bone"), (PUMP_Z + 0.006, 0.0230, "bone"),
             (PUMP_Z - 0.006, 0.0230, "bone"), (PUMP_Z - 0.008, 0.0212, "leather"),
             (PZ1 + 0.014, 0.0212, "bone"), (PZ1 + 0.012, 0.0236, "bone"), (PZ1 + 0.003, 0.0236, "bone"),
             (PZ1, 0.0215, "bone"), (PZ1, 0.0135, "bone")], "leather", segs=44, cy=LOW_Y)
for hand in (1, -1):                                # criss-cross leather straps
    for seg in ((PZ0 - 0.014, PUMP_Z + 0.008), (PUMP_Z - 0.008, PZ1 + 0.014)):
        n = 40
        pts = []
        for i in range(n + 1):
            z = seg[0] + (seg[1] - seg[0]) * i / n
            a = hand * TAU * i / n + (0 if hand > 0 else math.pi)
            pts.append(Vector((0.0218 * math.cos(a), LOW_Y + 0.0218 * math.sin(a), z)))
        sweep(pump, pts, lambda s: 0.0012, "leatherD", sides=5, uv=False)
for z in (PZ0 - 0.007, PZ1 + 0.007):
    for a in (-math.pi / 2 - 0.5, -math.pi / 2, -math.pi / 2 + 0.5):
        d = Vector((math.cos(a), math.sin(a), 0))
        spike(pump, Vector((0, LOW_Y, z)) + d * 0.0232, d + Vector((0, 0, 0.3)), 0.008, 0.0024, "bone", sides=5, tip_key="boneD")
for sx in (-1, 1):
    box(pump, (sx * 0.0135, -0.010, PZ0 + 0.045), (0.0030, 0.0055, 0.095), "iron")        # action bars
pump.finish()

# ---- iron sights: a bone notch on the spine, an ember bead on the skull's crown
ir = CPart("SB_IronRear")
box(ir, (0, RAIL_TOP + 0.0035, REAR_SIGHT_Z), (0.020, 0.007, 0.014), "iron")
# two little horns curling in: the notch is the gap between their tips
for sx in (-1, 1):
    hp = catmull([(sx * 0.0080, RAIL_TOP + 0.005, REAR_SIGHT_Z), (sx * 0.0098, RAIL_TOP + 0.014, REAR_SIGHT_Z + 0.002),
                  (sx * 0.0082, SIGHT_Y - 0.004, REAR_SIGHT_Z + 0.001), (sx * 0.0036, SIGHT_Y + 0.0035, REAR_SIGHT_Z - 0.001)], 16)
    sweep(ir, hp, lambda s: 0.0030 * (1 - s) ** 0.7 + 0.0005, "bone", sides=10, uv=False)
box(ir, (0, (RAIL_TOP + 0.007 + SIGHT_Y - 0.0040) / 2, REAR_SIGHT_Z), (0.0048, SIGHT_Y - 0.0040 - RAIL_TOP - 0.007, 0.0040), "boneD")
ir.finish(smooth_angle=70)

FRONT_Z = SK_O.z - 0.10 * S_BIG
crown = SK_O.y + crown_y(big_cran, -0.16, -0.04) * S_BIG
fs = CPart("SB_IronFront")
local_lathe(fs, (0, crown - 0.004, FRONT_Z), (0, 1, 0), [(0, 0.0034), (SIGHT_Y - crown + 0.002, 0.0016), (SIGHT_Y - crown + 0.0026, 0.0)],
            "boneD", segs=8)
ball(fs, (0, SIGHT_Y, FRONT_Z), 0.0014, "eye", segs=10, rings=6)
fs.finish(bevel=0.0002)
print(f"  crown at y={crown:.4f}, front bead y={SIGHT_Y}")

# ---- the loose shell: bone head, ember band, blood-red hull
sh = CPart("SB_Shell")
lathe(sh, [(0.029, 0.0, "bone"), (0.029, 0.0118, "bone"), (0.0272, 0.0118, "bone"), (0.0270, 0.0108, "bone"),
           (0.0185, 0.0108, "ember"), (0.0165, 0.0108, "hull"), (-0.0290, 0.0106, "hull"), (-0.0302, 0.0086, "hull"),
           (-0.0306, 0.0, "hull")], "hull", segs=24)
sh.finish()

# ---- charms: chain links down from the eyelet, then a skull or a blade.
# Pivot = the top link, where the eyelet holds it.
CHARM_S = 0.0165
for i, (z, kind, links) in enumerate(zip(CHARM_Z, CHARM_KIND, CHARM_LINKS)):
    top = Vector((0, HANG_Y - 0.0006, z))
    ch = CPart(f"SB_Charm{i}", pivot=tuple(top))
    drop = links * 0.0058 * 0.78 + 0.002
    chain(ch, [top, top + Vector((0, -drop, 0))], "chain", link=0.0058, wire=0.0008, width=0.0028, phase=i)
    bottom = top + Vector((0, -drop - 0.002, 0))
    ring_x(ch, bottom + Vector((0, 0.0005, 0)), 0.0022, 0.0007, "chain")
    if kind == "skull":
        face = Vector((-1, 0, 0.35) if i % 4 == 0 else (1, 0, 0.35)).normalized()
        cen = bottom + Vector((0, -0.55 * CHARM_S, 0))
        f = frame_of(cen, -face, CHARM_S)
        stamp(ch, small_skull, f)
        for e in (EYE_L, EYE_R):
            ball(ch, f(e + Vector((0, 0, -0.08))), 0.085 * CHARM_S, "charmEye", segs=8, rings=5)
        spike(ch, cen + Vector((0, -0.58 * CHARM_S, 0)), (0, -1, 0), 0.012, 0.0022, "iron", sides=4, spin=math.pi / 4)
    else:
        local_lathe(ch, bottom + Vector((0, -0.002, 0)), (0, -1, 0), [(0, 0.0034), (0.003, 0.0034), (0.004, 0.0020)], "rust", segs=8)
        local_lathe(ch, bottom + Vector((0, -0.006, 0)), (0, -1, 0),
                    [(0, 0.0048), (0.008, 0.0056), (0.030, 0.0012), (0.034, 0.0)], "iron", segs=4, spin=math.pi / 4)
        for sx in (-1, 1):                          # barbs
            spike(ch, bottom + Vector((sx * 0.004, -0.012, 0)), (sx * 0.8, 0.5, 0), 0.006, 0.0014, "iron", sides=4)
    ch.finish()

# ------------------------------------------------------------------ anchors
grip_mid = GRIP_TOP + GRIP_AX * 0.050
empty("SB_Grip", tuple(grip_mid))
empty("SB_Support", (0, LOW_Y + 0.022, PUMP_Z - 0.015))
MOUTH = big((0, -0.36, -0.46))
empty("SB_Muzzle", tuple(MOUTH))
empty("SB_Aim", (0, SIGHT_Y, REAR_SIGHT_Z))
empty("SB_Port", (0, R_BOT - 0.004, -0.080))
empty("SB_Under", (0, LOW_Y - 0.0236, PUMP_Z - 0.010))
empty("SB_Rail", (0, RAIL_TOP, -0.040))
empty("SB_Eject", (R_HW + 0.0015, 0.010, -0.066))
empty("SB_EyeL", tuple(big(EYE_L + Vector((0, 0, -0.06)))))
empty("SB_EyeR", tuple(big(EYE_R + Vector((0, 0, -0.06)))))
for i, z in enumerate(reversed(SLOT_Z)):          # shell 1 = the front skull
    empty(f"SB_Slot{i}", tuple(slot_frame(-1, z)(Vector((0, -0.04, -0.4)))))

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", use_selection=False, export_apply=True,
                          export_yup=True, export_extras=False, export_vertex_color="ACTIVE",
                          export_active_vertex_color_when_no_material=True)
tris = 0
dg = bpy.context.evaluated_depsgraph_get()
for ob in gk.scene.objects:
    if ob.type == "MESH":
        me = ob.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        print(f"  {ob.name}: {len(me.loop_triangles)} tris")
        ob.evaluated_get(dg).to_mesh_clear()
print(f"SB export: {OUT_GLB}  tris={tris}  size={os.path.getsize(OUT_GLB) // 1024} KB")
# byte normals and colours (KHR_mesh_quantization): about 40% smaller
import quantize_glb
quantize_glb.main([OUT_GLB])

if RENDER:
    # Preview the vertex-colour grime in Cycles (the game multiplies it in).
    for m in gk.M.values():
        nt = m.node_tree
        bsdf = nt.nodes.get("Principled BSDF")
        ca = nt.nodes.new("ShaderNodeVertexColor")
        ca.layer_name = "Col"
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs[6].default_value = bsdf.inputs["Base Color"].default_value
        nt.links.new(ca.outputs["Color"], mix.inputs[7])
        nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    views = {
        "sb-right": ((1.35, 0.02, -0.13), (0, -0.02, -0.13), 50),
        "sb-left": ((-1.35, 0.02, -0.13), (0, -0.02, -0.13), 50),
        "sb-fp": ((-0.10, 0.10, 0.42), (0.0, 0.0, -0.25), 40),
        "sb-skull": ((-0.20, 0.07, -0.86), (0, 0.006, -0.61), 55),
        "sb-charms": ((-0.30, -0.08, -0.36), (0, -0.06, -0.46), 55),
        "sb-stock": ((-0.42, 0.05, 0.36), (0, -0.04, 0.22), 50),
        "sb-flank": ((-0.30, 0.03, 0.08), (0, -0.01, -0.05), 55),
    }
    pick = os.environ.get("SB_VIEWS")
    if pick:
        views = {k: v for k, v in views.items() if k in pick.split(",")}
    gk.render_views(os.environ.get("SB_RENDER_DIR", os.path.join(OUT_DIR, "_renders")), views, "SB")
