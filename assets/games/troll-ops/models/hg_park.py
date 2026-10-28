"""
Hollowgrin's Grinmoor Fair park (phase 4), in map coordinates, one GLB per
landmark as build_grinmoor.blender.py drew them: the fountain first. The
park's pieces move here one by one; build_grinmoor retires when nothing
draws from it.

The fountain (hg-fountain.glb): the granite curb and its iron fence, three
verdigris tiers, the bronze troll with his lantern on the top plinth, the
vines climbing out of the pool and the autumn garlands swagged round the
bowls, all leaves as shaped cards (the old lumps were two thirds of the
map's fountain bytes), pumpkins in the pool. hollowgrin.js keeps the water,
the spray, the troll's face, the lantern's light and the five giants.
"""
import math
import random

from map_kit import mat
from hg_kit import HGBuilder, facing, pumpkin
from hg_fair import turn
from hg_village import palette as village_palette

TAU = 2 * math.pi
FOUNTAIN = (63.0, 2.5)                 # hollowgrin.js FOUNTAIN


def palette():
    return {
        **village_palette(),
        "granite": mat("HG_Granite", 0x8c8c94, 0.9),
        "granite_dk": mat("HG_GraniteDark", 0x5a5a62, 0.9),
        "verd": mat("GF_Verdigris", 0x4f8a78, 0.55, 0.15),
        "verd_dk": mat("GF_VerdigrisDark", 0x2c5246, 0.6, 0.15),
        "bronze": mat("GF_Bronze", 0x5a7a62, 0.45, 0.25),
        "iron": mat("HG_Iron", 0x1c1c22, 0.55, 0.3),
        "gold": mat("GF_Gold", 0xd8b050, 0.3, 0.45),
        "vine": mat("GF_Vine", 0x2a3a1c, 0.9),
        "leaf": mat("GF_Leaf", 0x3a5a24, 0.85),
        "leaf2": mat("GF_Leaf2", 0x4a6a2a, 0.85),
        "leaf_o": mat("GF_LeafOrange", 0xd8641c, 0.85),
        "leaf_r": mat("GF_LeafRed", 0x9a2a1c, 0.85),
        "leaf_y": mat("GF_LeafYellow", 0xd8a02a, 0.85),
        "pumpkin": mat("GF_Pumpkin", 0xe07423, 0.55),
        "lamp": mat("HG_Lamp", 0xfff0c8, 0.2, 0.0, 0xffd890, 3.0),
    }


def tube(b, m, pts, r, seg=5):
    """One smooth tube along pts (a vine), radius r or a list of radii."""
    rings = []
    for i, p in enumerate(pts):
        a, c = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        t = [c[k] - a[k] for k in range(3)]
        L = math.sqrt(sum(v * v for v in t)) or 1.0
        t = [v / L for v in t]
        h = (0.0, 1.0, 0.0) if abs(t[1]) < 0.9 else (1.0, 0.0, 0.0)
        u = [t[1] * h[2] - t[2] * h[1], t[2] * h[0] - t[0] * h[2], t[0] * h[1] - t[1] * h[0]]
        Lu = math.sqrt(sum(v * v for v in u))
        u = [v / Lu for v in u]
        w = [u[1] * t[2] - u[2] * t[1], u[2] * t[0] - u[0] * t[2], u[0] * t[1] - u[1] * t[0]]
        rr = r[i] if isinstance(r, (list, tuple)) else r
        rings.append([tuple(p[k] + rr * (math.cos(TAU * j / seg) * u[k] + math.sin(TAU * j / seg) * w[k]) for k in range(3)) for j in range(seg)])
    vs = [v for ring_ in rings for v in ring_]
    faces = [[i * seg + j, (i + 1) * seg + j, (i + 1) * seg + (j + 1) % seg, i * seg + (j + 1) % seg]
             for i in range(len(rings) - 1) for j in range(seg)]
    out = b.poly(m, vs, faces)
    for f in out:
        f.smooth = True
    return out


def leaf_card(b, m, c, ry, size, tilt=0.5, droop=0.0):
    """A leaf as one shaped card: a pointed oval from its stalk at c out
    along ry, tipped up by `tilt` and its point dropped by `droop`."""
    ca, sa = math.cos(ry), math.sin(ry)
    def at(u, v, dy=0.0):
        return (c[0] + ca * u - sa * v, c[1] + u * tilt * 0.6 + dy, c[2] + sa * u + ca * v)
    L, W = size, size * 0.42
    pts = [at(0.0, 0.0), at(L * 0.35, -W), at(L, 0.0, -droop * L), at(L * 0.35, W)]
    facing(b, m, pts, (0.0, 1.0, 0.0))


def build_fountain(P, R):
    """The plaza's pumpkin fountain: see the module's notes."""
    b = HGBuilder()
    fx, fz = FOUNTAIN
    V, VD = P["verd"], P["verd_dk"]
    R.begin(b, "park:fountain")
    # the curb: a granite ring with a rounded coping, the pool floor inside
    turn(b, P["granite"], fx, fz, [(3.3, 0.0), (3.75, 0.0), (3.75, 0.36), (3.68, 0.45), (3.37, 0.45), (3.3, 0.36), (3.3, 0.0)], seg=40)
    turn(b, P["granite_dk"], fx, fz, [(0, 0.12), (3.31, 0.12), (3.31, 0.1), (0, 0.1)], seg=40)
    # the low iron fence along the curb: posts with gold knobs, two rails, spear bars
    FR = 3.52
    for i in range(16):
        t = i / 16 * TAU
        x, z = fx + math.cos(t) * FR, fz + math.sin(t) * FR
        b.box(P["iron"], 0.07, 0.62, 0.07, x, 0.45, z, ry=-t)
        turn(b, P["gold"], x, z, [(0, 1.07), (0.05, 1.1), (0.05, 1.14), (0, 1.22)], seg=6)
    for yy in (0.55, 0.98):
        turn(b, P["iron"], fx, fz, [(FR - 0.015, yy), (FR + 0.015, yy), (FR + 0.015, yy + 0.03), (FR - 0.015, yy + 0.03), (FR - 0.015, yy)], seg=48)
    for i in range(96):
        t = (i + 0.5) / 96 * TAU
        x, z = fx + math.cos(t) * FR, fz + math.sin(t) * FR
        b.cyl(P["iron"], 0.012, (x, 0.45, z), (x, 1.02, z), seg=4, caps=False)
        b.cyl(P["iron"], 0.025, (x, 1.02, z), (x, 1.1, z), seg=4, r2=0.0)
    # three tiers: fluted pedestals, bowls with rolled lips
    turn(b, VD, fx, fz, [(0, 0.12), (0.7, 0.12), (0.7, 0.3), (0.5, 0.42), (0.42, 0.5), (0.42, 1.1), (0.55, 1.2), (0, 1.2)], seg=16,
         rmod=lambda t: 1 + 0.05 * math.cos(t * 8))
    turn(b, V, fx, fz, [(0, 1.15), (0.6, 1.18), (1.5, 1.42), (2.0, 1.6), (2.12, 1.72), (2.06, 1.8), (1.92, 1.74), (0, 1.62)], seg=32)
    turn(b, VD, fx, fz, [(0, 1.62), (0.32, 1.62), (0.26, 1.9), (0.22, 2.5), (0.34, 2.6), (0, 2.6)], seg=12, rmod=lambda t: 1 + 0.06 * math.cos(t * 6))
    turn(b, V, fx, fz, [(0, 2.56), (0.4, 2.6), (1.05, 2.78), (1.3, 2.9), (1.37, 2.99), (1.3, 3.04), (1.2, 2.98), (0, 2.88)], seg=28)
    turn(b, VD, fx, fz, [(0, 2.88), (0.22, 2.88), (0.16, 3.1), (0.14, 3.42), (0.24, 3.5), (0, 3.5)], seg=10)
    turn(b, V, fx, fz, [(0, 3.46), (0.25, 3.5), (0.62, 3.6), (0.75, 3.68), (0.7, 3.74), (0.6, 3.7), (0, 3.66)], seg=20)
    # gold beading under the first two lips
    for rr, yy, n in ((2.08, 1.7, 40), (1.34, 2.97, 28)):
        for i in range(n):
            t = i / n * TAU
            b.box(P["gold"], 0.035, 0.035, 0.035, fx + math.cos(t) * rr, yy - 0.03, fz + math.sin(t) * rr, ry=-t)
    # the plinth and the bronze troll: robe, cape, raised lantern arm
    B = P["bronze"]
    turn(b, VD, fx, fz, [(0, 3.66), (0.3, 3.66), (0.3, 3.86), (0.26, 3.9), (0, 3.9)], seg=8)
    turn(b, B, fx, fz, [(0, 3.9), (0.36, 3.9), (0.33, 4.0), (0.27, 4.5), (0.24, 4.95), (0.27, 5.12), (0.22, 5.22), (0, 5.24)], seg=14,
         rmod=lambda t: 1 + 0.07 * math.sin(t * 7))
    b.lump(B, 0.62, 0.26, 0.4, fx, 4.98, fz, seed=31, rnd=0.7, jitter=0.0)                 # shoulders
    b.lump(B, 0.38, 0.4, 0.36, fx, 5.18, fz, seed=32, rnd=0.85, jitter=0.0)                # head (the JS lays the face on)
    b.lump(B, 0.3, 0.14, 0.34, fx - 0.06, 5.2, fz, seed=33, rnd=0.8, jitter=0.0)           # the jutting jaw, toward the gate
    sh, el, wr = (fx, 5.1, fz + 0.27), (fx - 0.05, 5.38, fz + 0.48), (fx - 0.08, 5.82, fz + 0.52)
    b.cyl(B, 0.075, sh, el, seg=8, r2=0.065)
    b.cyl(B, 0.065, el, wr, seg=8, r2=0.055)
    b.lump(B, 0.11, 0.12, 0.11, wr[0], wr[1] - 0.02, wr[2], seed=34, rnd=0.8, jitter=0.0, n=2)
    b.cyl(B, 0.012, (wr[0], wr[1] + 0.08, wr[2]), (wr[0], wr[1] + 0.2, wr[2]), seg=4)
    lx, ly, lz = wr[0], wr[1] - 0.28, wr[2]
    turn(b, VD, lx, lz, [(0, ly + 0.47), (0.12, ly + 0.44), (0.1, ly + 0.4), (0, ly + 0.4)], seg=6)
    turn(b, P["lamp"], lx, lz, [(0, ly + 0.12), (0.09, ly + 0.14), (0.1, ly + 0.36), (0.07, ly + 0.4), (0, ly + 0.4)], seg=6)
    turn(b, VD, lx, lz, [(0, ly + 0.08), (0.1, ly + 0.08), (0.1, ly + 0.13), (0, ly + 0.13)], seg=6)
    for k in range(4):
        t = k / 4 * TAU + 0.4
        b.cyl(VD, 0.008, (lx + math.cos(t) * 0.095, ly + 0.12, lz + math.sin(t) * 0.095), (lx + math.cos(t) * 0.095, ly + 0.41, lz + math.sin(t) * 0.095), seg=3, caps=False)
    b.cyl(B, 0.075, (fx, 5.1, fz - 0.27), (fx - 0.12, 4.82, fz - 0.4), seg=8, r2=0.06)
    b.cyl(B, 0.06, (fx - 0.12, 4.82, fz - 0.4), (fx - 0.02, 4.62, fz - 0.3), seg=8, r2=0.055)
    for s in (1, -1):                   # the cape down his back (+x)
        facing(b, B, [(fx + 0.14, 5.08, fz - 0.32), (fx + 0.14, 5.08, fz + 0.32), (fx + 0.36, 4.0, fz + 0.4), (fx + 0.36, 4.0, fz - 0.4)], (float(s), 0.2, 0.0))
    # the vines: stems spiralling up out of the pool, leaves off them in pairs
    rnd = random.Random(7)
    greens = (P["leaf"], P["leaf2"])
    for v in range(4):
        a0 = v / 4 * TAU + 0.3
        pts = []
        for k in range(22):
            t = k / 21
            ang = a0 + t * 2.6
            rad = 2.9 - t * 2.3 + 0.25 * math.sin(t * 9 + v)
            if t > 0.55:
                rad = 0.45 + 0.15 * math.sin(t * 7)
            yy = 0.12 + t * 3.3
            if 0.32 < t < 0.5:
                yy = 1.55 + (t - 0.32) * 2   # over the first lip
            pts.append((fx + math.cos(ang) * rad, yy, fz + math.sin(ang) * rad))
        tube(b, P["vine"], pts, [0.07 - 0.035 * k / 21 for k in range(22)], seg=5)
        for k, p in enumerate(pts[1:-1]):
            if k % 2:
                continue
            for j in range(3):
                leaf_card(b, greens[(k + j) % 2], (p[0], p[1] + 0.02, p[2]), rnd.uniform(0, TAU), rnd.uniform(0.2, 0.3), tilt=rnd.uniform(0.1, 0.6), droop=0.15)
    # autumn garlands swagged round the first two bowls' lips: leaf clusters
    cols = [P["leaf_o"], P["leaf_r"], P["leaf_y"]]
    for (rr, yy, n, sag, m, size, seed) in ((2.12, 1.76, 10, 0.35, 8, 0.16, 0), (1.37, 3.0, 7, 0.2, 6, 0.12, 500)):
        for i in range(n):
            a, c = i / n * TAU, (i + 1) / n * TAU
            A = (fx + math.cos(a) * rr, yy, fz + math.sin(a) * rr)
            C = (fx + math.cos(c) * rr, yy, fz + math.sin(c) * rr)
            for k in range(m + 1):
                t = k / m
                p = (A[0] + (C[0] - A[0]) * t, A[1] - sag * 4 * t * (1 - t) - 0.04, A[2] + (C[2] - A[2]) * t)
                for j in range(4):
                    leaf_card(b, cols[(i + k + j) % 3], p, rnd.uniform(0, TAU), size * rnd.uniform(0.8, 1.2), tilt=rnd.uniform(-0.8, 0.8))
    # pumpkins sitting in the pool among the vines (the five giants are JS)
    for i, (a, rr, sz) in enumerate([(0.6, 2.6, 0.32), (1.9, 2.75, 0.26), (2.9, 2.5, 0.36), (4.0, 2.7, 0.28), (5.2, 2.55, 0.3), (5.8, 2.85, 0.22)]):
        pumpkin(b, P["pumpkin"], P["stem"], fx + math.cos(a) * rr, 0.12, fz + math.sin(a) * rr, sz, ribs=8, squash=0.75, ry=a, seed=40 + i)
    R.end()
    b.finish("hg-fountain.glb")
