"""
Hollowgrin's ground (phase 5 of "Troll Forces: Hollowgrin in Blender"):
hg-ground.glb, in map coordinates, a hair over the grass.

The paths the JS laid as flat rectangles, from its numbers: dirt roads and
tracks, the gravel of the west loop and the hedge garden, with ragged edges
and a worn verge where they meet the grass, cart ruts down the wide roads
and puddles in them. The setts: the square's rings round the oak (smaller,
darker) and the park's, from the gate to the plaza and round the fountain,
course by course as the JS laid them, with a kerb at the edge of each
ring. The setts carry the JS's own texture (hollowgrin.js swaps the
HG_Setts and HG_SettsSquare materials for its canvas one), so their UVs are
the JS's: one course 0.42 m (0.252 on the square), four to the texture.

The ground is not a prop: everything stands on it.
"""
import math
import random

import bmesh  # noqa: F401
import bpy  # noqa: F401

import tf_kit
from map_kit import TEXTURED, mat
from hg_kit import HGBuilder

TEXTURED.update({"HG_Dirt", "HG_Verge", "HG_Rut", "HG_Gravel", "HG_GravelVerge", "HG_Kerb"})


def palette():
    keep = dict(emit=0x000000, emit_strength=0.0)       # kept as a material of its own
    return {
        "dirt": mat("HG_Dirt", 0x6a5236, 0.95),
        "verge": mat("HG_Verge", 0x4e4c30, 0.95),
        "rut": mat("HG_Rut", 0x40301e, 0.9),
        "gravel": mat("HG_Gravel", 0x6a6460, 0.95),
        "gverge": mat("HG_GravelVerge", 0x4a4c38, 0.95),
        "kerb": mat("HG_Kerb", 0x6c6870, 0.9),
        "puddle": mat("HG_Puddle", 0x0e1218, 0.08, **keep),
        "setts": mat("HG_Setts", 0x9a96a0, 0.92, **keep),
        "setts_sq": mat("HG_SettsSquare", 0x6c6870, 0.92, **keep),
    }


# [x, z, w (along x), d (along z)], hollowgrin.js's flat() and dirtPlane() calls
DIRT = [
    (-37.2, 2.0, 4.4, 2.6),            # the churchyard's west gate
    (-35.5, -19.0, 10.0, 2.2), (-44.6, -31.0, 2.0, 13.0),     # the hollow: from the garden, the pond to the hut
    (-7.25, -31.0, 2.0, 6.2), (7.25, -31.0, 2.0, 6.2),        # the manor's back doors
    (39.2, -3.5, 3.4, 73.0), (28.6, 4.1, 17.4, 1.8),          # the old midway
    (0.0, 35.0, 112.0, 3.2), (0.0, 32.6, 4.4, 1.8),           # Trick-or-Treat Lane
    (65.25, 35.0, 14.9, 3.2),                                 # the lane on to the mountain
    (45.7, 2.5, 9.6, 3.2), (61.65, -8.6, 2.5, 6.2),           # the park's gate, the stalls' alley
    (74.45, 35.1, 3.5, 2.2), (75.1, 32.3, 2.2, 3.4),          # the cave path
    (0.0, 22.0, 4.4, 20.0), (0.0, -10.0, 3.6, 3.2),           # the south road, the porch
    (-14.5, 2.0, 5.0, 3.2), (15.5, 2.0, 9.0, 3.4),            # west and east roads
    (-24.0, 7.0, 1.8, 26.0), (-25.0, 2.0, 18.0, 2.6),         # the graveyard
] + [(m, 37.7, 1.1, 1.4) for m in (-46.0, -27.5, -16.0, 16.0, 27.5, 42.5)]   # the lane's front paths
GRAVEL = [
    (-37.4, -7.5, 1.8, 19.0), (-37.4, 18.3, 1.8, 30.0),       # the west loop
    (-24.0, -19.0, 2.4, 13.4), (-24.0, -19.0, 13.4, 2.4),     # the hedge garden
]
# roads wide and long enough for carts: ruts, and puddles in them
RUTTED = {(39.2, -3.5), (0.0, 35.0), (65.25, 35.0), (0.0, 22.0)}
SQUARE = (0.0, 1.0, 3.8, 12.5, 0.6)          # cx, cz, r0, r1, scale; the oak's bed inside r 3.9
PLAZA = (63.0, 2.5, 3.6, 9.0, 1.0)
PARK_RECTS = [(50.4, 54.4, -0.2, 5.2), (71.5, 76.8, 0.4, 4.6)]   # settsRect(x0, x1, z0, z1)


def jag(rnd, k):
    """A ragged edge: smooth wander plus a little noise, about +-k."""
    a, b, p = rnd.uniform(0.6, 1.4), rnd.uniform(1.6, 2.6), rnd.uniform(0, 6.3)
    return lambda t: k * (0.55 * math.sin(p + t * a) + 0.3 * math.sin(p * 2 + t * b) + 0.15 * rnd.uniform(-1, 1))


def patch(b, P, rnd, cx, cz, w, d, y, core, verge, ruts=False):
    """A path: rows across its length every 2.2 m, its edges ragged, a
    verge 0.35 m wide outside them a hair lower, the ends ragged too."""
    along_x = w >= d
    L, S = (w, d) if along_x else (d, w)
    n = max(2, int(math.ceil(L / 2.2)))
    e0, e1, v0, v1 = jag(rnd, 0.24), jag(rnd, 0.24), jag(rnd, 0.16), jag(rnd, 0.16)
    endj = [rnd.uniform(-0.15, 0.15) for _ in range(4)]

    def P_(a, c, yy):
        return (cx + a, yy, cz + c) if along_x else (cx + c, yy, cz + a)

    rows = []
    for i in range(n + 1):
        t = -L / 2 + L * i / n
        if i == 0:
            t -= 0.1 + endj[0]
        if i == n:
            t += 0.1 + endj[1]
        lo, hi = -S / 2 + e0(t), S / 2 + e1(t)
        rows.append((t, lo, hi, lo - 0.45 + v0(t), hi + 0.45 + v1(t)))
    for (t0, a0, b0, va0, vb0), (t1, a1, b1, va1, vb1) in zip(rows, rows[1:]):
        # the core in two strips (the centre line lets the ruts sit flat on it)
        for (p, q, r_, s) in (((t0, a0), (t1, a1), (t1, 0.0), (t0, 0.0)), ((t0, 0.0), (t1, 0.0), (t1, b1), (t0, b0))):
            _quad(b, core, [P_(p[0], p[1], y), P_(s[0], s[1], y), P_(r_[0], r_[1], y), P_(q[0], q[1], y)])
        _quad(b, verge, [P_(t0, va0, y - 0.002), P_(t0, a0, y - 0.002), P_(t1, a1, y - 0.002), P_(t1, va1, y - 0.002)])
        _quad(b, verge, [P_(t0, b0, y - 0.002), P_(t0, vb0, y - 0.002), P_(t1, vb1, y - 0.002), P_(t1, b1, y - 0.002)])
    # the verge round the two ends
    for (t, a, bb, va, vb), s in ((rows[0], -1), (rows[-1], 1)):
        e = t + s * (0.35 + rnd.uniform(0, 0.15))
        pts = [P_(t, va, y - 0.002), P_(t, vb, y - 0.002), P_(e, vb * 0.8, y - 0.002), P_(e, va * 0.8, y - 0.002)]
        _quad(b, verge, pts if s > 0 else pts[::-1])
    if ruts:
        for c in (-0.85, 0.85):
            j = jag(rnd, 0.06)
            for (t0, *_r0), (t1, *_r1) in zip(rows[1:-1], rows[2:-1]):
                w0, w1 = c + j(t0), c + j(t1)
                _quad(b, P["rut"], [P_(t0, w0 - 0.2, y + 0.002), P_(t0, w0 + 0.2, y + 0.002), P_(t1, w1 + 0.2, y + 0.002), P_(t1, w1 - 0.2, y + 0.002)])
        for k in range(max(1, int(L / 16))):
            t, c = rnd.uniform(-L / 2 + 2, L / 2 - 2), rnd.choice((-0.85, 0.85, 0.0))
            r = rnd.uniform(0.35, 0.75)
            seg = 9
            ring = []
            for s in range(seg):
                a = s / seg * 2 * math.pi
                rr = r * rnd.uniform(0.75, 1.15)
                ring.append(P_(t + math.cos(a) * rr * 1.6, c + math.sin(a) * rr, y + 0.004))
            for s in range(seg):
                _quad(b, P["puddle"], [ring[s], ring[(s + 1) % seg], P_(t, c, y + 0.004)])


def _quad(b, m, pts):
    """A face through pts, turned to face up (+y)."""
    (x0, _, z0), (x1, _, z1), (x2, _, z2) = pts[0], pts[1], pts[2]
    up = (x1 - x0) * (z2 - z1) - (z1 - z0) * (x2 - x1)
    if up > 0:                         # wound clockwise seen from above: flip
        pts = pts[::-1]
    vs = [b.bm.verts.new(p) for p in pts]
    f = b.bm.faces.new(vs)
    f.material_index = b._mi(m)


def setts_ring(b, m, kerb, cx, cz, r0, r1, scale, y):
    """settsRing's courses (one ring a course), then a kerb outside them:
    a granite band 0.22 m wide standing 0.04 proud, its outer edge
    dropping to the grass."""
    band = 0.42 * scale
    k = 0
    while r0 + k * band < r1 - 0.01:
        ri, ro = r0 + k * band, min(r1, r0 + (k + 1) * band)
        seg = max(24, math.ceil(2 * math.pi * ro / 1.0))
        for i in range(seg):
            a0, a1 = i / seg * 2 * math.pi, (i + 1) / seg * 2 * math.pi
            P = lambda r, a: (cx + math.cos(a) * r, y, cz + math.sin(a) * r)       # noqa: E731
            _quad(b, m, [P(ri, a0), P(ri, a1), P(ro, a1), P(ro, a0)])
        k += 1
    seg = max(24, math.ceil(2 * math.pi * r1 / 0.6))
    rk = r1 + 0.22
    for i in range(seg):
        a0, a1 = i / seg * 2 * math.pi, (i + 1) / seg * 2 * math.pi
        P = lambda r, a, yy: (cx + math.cos(a) * r, yy, cz + math.sin(a) * r)       # noqa: E731
        _quad(b, kerb, [P(r1, a0, y + 0.04), P(r1, a1, y + 0.04), P(rk, a1, y + 0.04), P(rk, a0, y + 0.04)])
        vs = [b.bm.verts.new(p) for p in (P(rk, a0, y + 0.04), P(rk, a1, y + 0.04), P(rk, a1, 0.0), P(rk, a0, 0.0))]
        f = b.bm.faces.new(vs)
        f.material_index = b._mi(kerb)
        f.normal_update()
        if f.normal.dot((math.cos((a0 + a1) / 2), 0, math.sin((a0 + a1) / 2))) < 0:
            f.normal_flip()


def setts_rect(b, m, x0, x1, z0, z1, y):
    _quad(b, m, [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)])


def setts_uvs(obj):
    """The setts' UVs, as hollowgrin.js laid them: round a ring, a whole
    number of repeats per course, the course's quarter of the texture
    across it; along a straight run, x / 3.4 and -z / 1.68. The mesh is in
    Blender axes here (game x, -z, y)."""
    me = obj.data
    uv = me.uv_layers["UVMap"]
    names = [m.name for m in me.materials]
    for poly in me.polygons:
        name = names[poly.material_index]
        if name not in ("HG_Setts", "HG_SettsSquare"):
            continue
        pts = [(me.vertices[v].co.x, -me.vertices[v].co.y) for v in poly.vertices]       # game x, z
        mx, mz = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
        ring = None
        for cx, cz, r0, r1, scale in (SQUARE, PLAZA):
            if r0 - 0.01 < math.hypot(mx - cx, mz - cz) < r1 + 0.01 and (name == "HG_SettsSquare") == (scale != 1.0):
                ring = (cx, cz, r0, r1, scale)
        for li, (x, z) in zip(poly.loop_indices, pts):
            if ring is None:
                uv.data[li].uv = (x / 3.4, -z / 1.68)
                continue
            cx, cz, r0, r1, scale = ring
            band = 0.42 * scale
            k = int((math.hypot(mx - cx, mz - cz) - r0) // band)
            ri, ro = r0 + k * band, min(r1, r0 + (k + 1) * band)
            reps = max(1, round(2 * math.pi * (ri + ro) / 2 / (3.4 * scale)))
            am = math.atan2(mz - cz, mx - cx) % (2 * math.pi)
            a = math.atan2(z - cz, x - cx) % (2 * math.pi)
            a += 2 * math.pi * round((am - a) / (2 * math.pi))          # the face's own side of the seam
            r = math.hypot(x - cx, z - cz)
            uv.data[li].uv = (a / (2 * math.pi) * reps, (k % 4) / 4 + (r - ri) / band / 4)


def build_ground(P, R):
    b = HGBuilder()
    rnd = random.Random(5)
    for i, (x, z, w, d) in enumerate(DIRT):
        patch(b, P, rnd, x, z, w, d, 0.012 + (i % 5) * 0.0006, P["dirt"], P["verge"], ruts=(x, z) in RUTTED)
    for i, (x, z, w, d) in enumerate(GRAVEL):
        patch(b, P, rnd, x, z, w, d, 0.015 + (i % 2) * 0.0005, P["gravel"], P["gverge"])
    # the oak's bed
    seg = 24
    pts = [(SQUARE[0] + math.cos(s / seg * 2 * math.pi) * 3.9, 0.01, SQUARE[1] + math.sin(s / seg * 2 * math.pi) * 3.9) for s in range(seg)]
    for s in range(seg):
        _quad(b, P["dirt"], [pts[s], pts[(s + 1) % seg], (SQUARE[0], 0.01, SQUARE[1])])
    cx, cz, r0, r1, sc = SQUARE
    setts_ring(b, P["setts_sq"], P["kerb"], cx, cz, r0, r1, sc, 0.017)
    cx, cz, r0, r1, sc = PLAZA
    setts_ring(b, P["setts"], P["kerb"], cx, cz, r0, r1, sc, 0.017)
    for x0, x1, z0, z1 in PARK_RECTS:
        setts_rect(b, P["setts"], x0, x1, z0, z1, 0.018)
    obj = tf_kit.to_object(b, "hg-ground")
    setts_uvs(obj)
    tf_kit.lightmap_uv(obj)
    tf_kit.export(obj, "hg-ground.glb")
