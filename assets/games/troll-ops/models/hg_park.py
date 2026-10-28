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
import os
import random

from map_kit import TEXTURED, mat
from hg_kit import HGBuilder, facing, pumpkin
from hg_fair import turn
from hg_village import palette as village_palette

TAU = 2 * math.pi
TEXTURED.update({"HG_Granite", "HG_GraniteDark", "HG_Brick", "HG_Floorboards", "HG_BarnWood", "GF_Clapboard", "GF_Rock", "GF_RockDark"})
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
        # the plaza, the wheel base, the stalls (build_grinmoor's colours)
        "deck": mat("HG_Floorboards", 0x6a4a30, 0.8),
        "plank": mat("HG_BarnWood", 0x8a6a48, 0.85),
        "brass": mat("HG_Brass", 0xc8a050, 0.35, 0.4),
        "steel": mat("GF_Steel", 0xc8ccd6, 0.45, 0.3),
        "steel_dk": mat("GF_SteelDark", 0x5a6068, 0.5, 0.3),
        "cream": mat("GF_Cream", 0xeee2c8, 0.7),
        "red": mat("GF_Red", 0xb8242c, 0.7),
        "purple": mat("GF_Purple", 0x5a2a7c, 0.75),
        "teal": mat("GF_Teal", 0x2a8a86, 0.6),
        "orange": mat("GF_Orange", 0xe0762a, 0.65),
        "black": mat("GF_Black", 0x16141a, 0.7),
        "green": mat("GF_Green", 0x2e5a3a, 0.7),
        "white": mat("GF_White", 0xf0ece4, 0.6),
        "pink": mat("GF_Pink", 0xf08ac8, 0.7),
        "blue": mat("GF_Blue", 0x3a6ad8, 0.6),
        "yellow": mat("GF_Yellow", 0xf0c83a, 0.6),
        "wood": mat("GF_Wood", 0x6a4a30, 0.8),
        "wood_dk": mat("GF_WoodDark", 0x3a2a1e, 0.8),
        "warm": mat("HG_WarmGlass", 0xffd08a, 0.3, 0.0, 0xffb860, 1.6),
        "water": mat("GF_BagWater", 0x8ac8e8, 0.1),
        "fish": mat("GF_Goldfish", 0xff8a1a, 0.4),
        "tin": mat("HG_Tin", 0xc8c0a8, 0.5, 0.2),
        # the mansion
        "glass": mat("HG_GlassDark", 0x1a2028, 0.1),
        "clapw": mat("GF_Clapboard", 0xe8e4dc, 0.8),
        "trim_w": mat("GF_TrimWhite", 0xf2efe8, 0.7),
        "damask": mat("GF_Damask", 0x5a1c2a, 0.85),
        "plaster_in": mat("GF_PlasterIn", 0xcfc6b4, 0.9),
        "slate": mat("GF_Slate", 0x5a5a6c, 0.75),
        "slate_dk": mat("GF_SlateDark", 0x3a3a46, 0.8),
        "shutter": mat("GF_Shutter", 0x1f3a2c, 0.8),
        "sheet": mat("GF_Sheet", 0xd8d4c8, 0.95),
        "bone": mat("GF_Bone", 0xe8dfc8, 0.7),
        "burlap": mat("GF_Burlap", 0x7a5a38, 1.0),
        "straw": mat("GF_Straw", 0xd8b860, 1.0),
        "denim": mat("GF_Denim", 0x2e3a5a, 0.9),
        # the mountain and the moat
        "conc": mat("GS_Concrete", 0x8e8e88, 0.92),
        "rock": mat("GF_Rock", 0x5a6070, 0.9),
        "rock_dk": mat("GF_RockDark", 0x3a3e4a, 0.9),
        "pine": mat("GF_Pine", 0x1e3a2a, 0.9),
        "snow": mat("GF_Snow", 0xdde4ee, 0.7),
        "moss": mat("GF_Moss", 0x2c3a24, 0.9),
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


# ------------------------------------------------------------------ the plaza, the wheel base, the stalls
# (moved from build_grinmoor.blender.py in phase 4)

PLAZA_R = 9.0
FERRIS = (80.0, 2.5, 11.0, 13.2)       # x, z, r, hub height: hollowgrin.js
WHEEL_STAIR = dict(x0=76.6, x1=77.8, z_foot=0.6, steps=20, rise=0.3, run=0.3)
WHEEL_DECK = dict(x0=74.0, x1=78.0, z0=-8.8, z1=-5.4, y=6.0)
BOARDING = dict(x0=78.0, x1=82.4, z0=0.4, z1=4.6, y=0.6)
SHACK = dict(x0=74.4, x1=77.0, z0=-8.4, z1=-5.9, h=2.6)
PODIUM = (75.2, 5.2)
STALL_Z = (-11.2, -8.2)                 # back wall, front (counter) line
STALLS = [(53.4, 56.9), (56.9, 60.4), (62.9, 66.4), (66.4, 69.9), (69.9, 73.4)]


def lamp_post(b, P, x, z, h=3.6, banner=None, face=0.0):
    """Cast-iron plaza lamp: fluted base, tapering shaft, a crossarm with two
    lanterns, and (optional) a hanging banner on an arm facing `face`."""
    b.cyl(P["iron"], 0.2, (x, 0, z), (x, 0.45, z), seg=8, r2=0.14)
    b.cyl(P["iron"], 0.24, (x, 0, z), (x, 0.08, z), seg=8)
    b.cyl(P["iron"], 0.07, (x, 0.45, z), (x, h, z), seg=8, r2=0.05)
    for yy in (1.0, 2.2):
        b.cyl(P["iron"], 0.085, (x, yy, z), (x, yy + 0.06, z), seg=8)
    # crossarm (along the banner's direction, so the lanterns sit either side)
    ca, sa = math.cos(face), math.sin(face)
    b.bar(P["iron"], (x - ca * 0.55, h, z - sa * 0.55), (x + ca * 0.55, h, z + sa * 0.55), 0.05)
    for s in (-1, 1):
        lx, lz = x + ca * 0.5 * s, z + sa * 0.5 * s
        b.cyl(P["iron"], 0.012, (lx, h, lz), (lx, h - 0.12, lz), seg=4)
        b.cyl(P["iron"], 0.1, (lx, h - 0.16, lz), (lx, h - 0.12, lz), seg=6)
        b.cyl(P["lamp"], 0.09, (lx, h - 0.5, lz), (lx, h - 0.16, lz), seg=6, r2=0.1)
        b.cyl(P["iron"], 0.06, (lx, h - 0.56, lz), (lx, h - 0.5, lz), seg=6, r2=0.09)
    b.cyl(P["iron"], 0.06, (x, h, z), (x, h + 0.35, z), seg=6, r2=0.0)
    if banner:
        # arm out, the banner hangs from it: orange with a black bar and fringe
        nx, nz = -sa, ca
        b.bar(P["iron"], (x, h - 0.75, z), (x + nx * 0.62, h - 0.75, z + nz * 0.62), 0.035)
        cx, cz = x + nx * 0.36, z + nz * 0.36
        w = 0.5
        top, bot = h - 0.78, h - 2.0
        th = 0.012
        b.box(banner[0], w if abs(nz) > 0.5 else th, top - bot, th if abs(nz) > 0.5 else w, cx, bot, cz, ry=0)
        b.box(banner[1], (w if abs(nz) > 0.5 else th) + 0.004, 0.16, (th if abs(nz) > 0.5 else w) + 0.004, cx, bot + 0.55, cz)
        b.box(banner[1], (w if abs(nz) > 0.5 else th) + 0.004, 0.05, (th if abs(nz) > 0.5 else w) + 0.004, cx, top - 0.12, cz)
        # a pointed swallowtail
        for s in (-1, 1):
            ox = (w / 4) * s if abs(nz) > 0.5 else 0
            oz = 0 if abs(nz) > 0.5 else (w / 4) * s
            b.box(banner[0], (w / 2 if abs(nz) > 0.5 else th), 0.18, (th if abs(nz) > 0.5 else w / 2), cx + ox, bot - 0.18, cz + oz)


def bench(b, P, x, z, ry):
    """Park bench: cast-iron scroll ends, wooden slats; faces -z before ry."""
    c, s = math.cos(ry), math.sin(ry)

    def at(px, py, pz):
        return (x + px * c + pz * s, py, z - px * s + pz * c)
    for ex in (-0.8, 0.8):
        b.bar(P["iron"], at(ex, 0, 0.22), at(ex, 0.42, 0.2), 0.05)
        b.bar(P["iron"], at(ex, 0, -0.22), at(ex, 0.42, -0.2), 0.05)
        b.bar(P["iron"], at(ex, 0.42, -0.25), at(ex, 0.42, 0.25), 0.05)
        b.bar(P["iron"], at(ex, 0.42, 0.22), at(ex, 0.9, 0.3), 0.05)
        b.bar(P["iron"], at(ex, 0.55, -0.25), at(ex, 0.62, -0.32), 0.04)
    for k in range(4):
        b.bar(P["wood"], at(-0.95, 0.44, -0.18 + k * 0.12), at(0.95, 0.44, -0.18 + k * 0.12), 0.09, 0.03)
    for k in range(3):
        y = 0.56 + k * 0.12
        zz = 0.24 + (y - 0.42) * 0.17
        b.bar(P["wood"], at(-0.95, y, zz), at(0.95, y, zz), 0.03, 0.09)


def build_plaza(P, R):
    b = HGBuilder()
    R.begin(b, "park:plaza")
    fx, fz = FOUNTAIN
    banner = (P["orange"], P["black"])
    for i in range(8):
        t = (i + 0.5) / 8 * TAU
        x, z = fx + math.cos(t) * 8.3, fz + math.sin(t) * 8.3
        lamp_post(b, P, x, z, banner=banner, face=t + math.pi / 2)
    for t in (math.radians(a) for a in (40, 90, 140, 220, 270, 320)):
        x, z = fx + math.cos(t) * 7.3, fz + math.sin(t) * 7.3
        # the bench faces the fountain: its front (-z before turning) toward the centre
        bench(b, P, x, z, math.atan2(math.cos(t), math.sin(t)) + math.pi)
    # a granite edging ring round the plaza's paving
    turn(b, P["granite_dk"], fx, fz, [(PLAZA_R - 0.15, 0.0), (PLAZA_R + 0.15, 0.0), (PLAZA_R + 0.15, 0.05), (PLAZA_R - 0.15, 0.05), (PLAZA_R - 0.15, 0.0)], seg=64)
    R.end()
    b.finish("hg-plaza.glb")


def build_wheel(P, R):
    b = HGBuilder()
    R.begin(b, "park:wheelbase")
    fx, fz, r, hub = FERRIS
    S, SD = P["steel"], P["steel_dk"]
    # the A-frames: four legs, cross braces, concrete feet
    for s in (-1, 1):
        for dz in (-5, 5):
            foot = (fx + s * 1.6, 0.0, fz + dz)
            top = (fx + s * 0.7, hub, fz)
            b.cyl(S, 0.17, foot, top, seg=10)
            b.box(P["granite_dk"], 0.8, 0.35, 0.8, foot[0], 0, foot[2])
        for k in range(1, 5):
            t = k / 5.5
            y = hub * t
            xa = fx + s * (1.6 - 0.9 * t)
            za, zb = fz - 5 * (1 - t), fz + 5 * (1 - t)
            b.cyl(SD, 0.06, (xa, y, za), (xa, y, zb), seg=6)
            if k < 4:
                t2 = (k + 1) / 5.5
                y2, xb = hub * t2, fx + s * (1.6 - 0.9 * t2)
                b.cyl(SD, 0.045, (xa, y, za), (xb, y2, fz + 5 * (1 - t2)), seg=5)
                b.cyl(SD, 0.045, (xa, y, zb), (xb, y2, fz - 5 * (1 - t2)), seg=5)
    b.cyl(S, 0.32, (fx - 1.0, hub, fz), (fx + 1.0, hub, fz), seg=14)
    for s in (-1, 1):
        b.cyl(P["red"], 0.5, (fx + s * 0.75, hub, fz), (fx + s * 0.95, hub, fz), seg=16)
    # the motor house under the hub on the east side
    b.box(P["green"], 1.6, 1.4, 2.0, fx + 2.6, 0, fz)
    b.box(P["black"], 1.8, 0.12, 2.2, fx + 2.6, 1.4, fz)
    # the boarding deck: planks on a steel frame, a rail on three sides
    B = BOARDING
    b.box(SD, B["x1"] - B["x0"], B["y"] - 0.12, B["z1"] - B["z0"], (B["x0"] + B["x1"]) / 2, 0, (B["z0"] + B["z1"]) / 2)
    b.box(P["deck"], B["x1"] - B["x0"] + 0.1, 0.12, B["z1"] - B["z0"] + 0.1, (B["x0"] + B["x1"]) / 2, B["y"] - 0.12, (B["z0"] + B["z1"]) / 2)
    for k in range(2):
        b.box(P["plank"], 0.6, 0.2 * (k + 1), 2.2, B["x0"] - 0.3 - 0.6 * (1 - k), 0, 3.1)   # clear of the stair foot
    for zz in (B["z0"] + 0.05, B["z1"] - 0.05):
        b.box(P["yellow"], B["x1"] - B["x0"] - 1.2, 0.05, 0.05, (B["x0"] + B["x1"]) / 2 + 0.6, B["y"] + 0.95, zz)
        for xx in (B["x0"] + 1.2, (B["x0"] + B["x1"]) / 2 + 0.6, B["x1"] - 0.05):
            b.box(P["yellow"], 0.06, 1.0, 0.06, xx, B["y"], zz)
    b.box(P["yellow"], 0.06, 0.05, B["z1"] - B["z0"], B["x1"] - 0.05, B["y"] + 0.95, (B["z0"] + B["z1"]) / 2)
    # the stair to the lamp deck: steel stringers, plank treads, a hand rail,
    # lattice under it (the collider is solid down to the ground)
    st = WHEEL_STAIR
    sx = (st["x0"] + st["x1"]) / 2
    w = st["x1"] - st["x0"]
    for i in range(st["steps"]):
        top = st["rise"] * (i + 1)
        zc = st["z_foot"] - st["run"] * (i + 0.5)
        b.box(P["plank"], w - 0.08, 0.06, st["run"] + 0.02, sx, top - 0.06, zc)
        b.box(SD, w - 0.08, st["rise"] - 0.06, 0.03, sx, top - st["rise"], zc + st["run"] / 2 - 0.02)
    z_top = st["z_foot"] - st["run"] * st["steps"]
    y_top = st["rise"] * st["steps"]
    for xx in (st["x0"] + 0.03, st["x1"] - 0.03):
        b.bar(S, (xx, -0.1, st["z_foot"] + 0.1), (xx, y_top - 0.05, z_top), 0.06, 0.3)
        b.bar(S, (xx, 1.0, st["z_foot"]), (xx, y_top + 1.0, z_top), 0.04)
        for k in range(0, st["steps"] + 1, 4):
            yy = st["rise"] * k
            zz = st["z_foot"] - st["run"] * k
            b.box(S, 0.04, 1.0, 0.04, xx, yy, zz)
    # lattice skirting under the flight (both sides), in diamonds
    for xx in (st["x0"] + 0.01, st["x1"] - 0.01):
        for k in range(12):
            za = st["z_foot"] - k * 0.5
            b.bar(P["cream"], (xx, 0.0, za), (xx, min(y_top, (st["z_foot"] - (za - 1.2)) / st["run"] * st["rise"]) - 0.2, za - 1.2), 0.03, 0.06)
            b.bar(P["cream"], (xx, 0.0, za - 1.2), (xx, min(y_top, (st["z_foot"] - za) / st["run"] * st["rise"]) - 0.2, za), 0.03, 0.06)
    # the lamp deck: steel posts, planks, a rail, two flood lamps on a mast
    D = WHEEL_DECK
    dcx, dcz = (D["x0"] + D["x1"]) / 2, (D["z0"] + D["z1"]) / 2
    dw, dd = D["x1"] - D["x0"], D["z1"] - D["z0"]
    for xx in (D["x0"] + 0.15, D["x1"] - 0.15):
        for zz in (D["z0"] + 0.15, D["z1"] - 0.15):
            b.box(S, 0.22, D["y"] - 0.25, 0.22, xx, 0, zz)
    for xx in (D["x0"] + 0.15, D["x1"] - 0.15):
        b.bar(SD, (xx, 0.4, D["z0"] + 0.15), (xx, D["y"] - 0.4, D["z1"] - 0.15), 0.07)
        b.bar(SD, (xx, 0.4, D["z1"] - 0.15), (xx, D["y"] - 0.4, D["z0"] + 0.15), 0.07)
    b.box(SD, dw, 0.18, dd, dcx, D["y"] - 0.25, dcz)
    b.box(P["deck"], dw + 0.05, 0.07, dd + 0.05, dcx, D["y"] - 0.07, dcz)
    rails = [((D["x0"], D["z0"]), (D["x1"], D["z0"])), ((D["x0"], D["z0"]), (D["x0"], D["z1"])),
             ((D["x1"], D["z0"]), (D["x1"], D["z1"])), ((D["x0"], D["z1"]), (st["x0"], D["z1"]))]
    for (ax, az), (bx, bz) in rails:
        L = math.hypot(bx - ax, bz - az)
        n = max(1, round(L / 1.0))
        for k in range(n + 1):
            px, pz = ax + (bx - ax) * k / n, az + (bz - az) * k / n
            b.box(P["yellow"], 0.06, 1.05, 0.06, px, D["y"], pz)
        for yy in (0.5, 1.02):
            b.bar(P["yellow"], (ax, D["y"] + yy, az), (bx, D["y"] + yy, bz), 0.05)
        b.bar(P["yellow"], (ax, D["y"] + 0.05, az), (bx, D["y"] + 0.05, bz), 0.02, 0.12)
    mx, mz = D["x1"] - 0.35, D["z0"] + 0.35
    b.cyl(S, 0.07, (mx, D["y"], mz), (mx, D["y"] + 3.2, mz), seg=8)
    b.bar(S, (mx - 0.5, D["y"] + 3.2, mz), (mx + 0.5, D["y"] + 3.2, mz), 0.05)
    for s in (-1, 1):
        lx = mx + 0.45 * s
        b.box(P["black"], 0.36, 0.32, 0.26, lx, D["y"] + 3.0, mz + 0.12, rx=0.5)
        b.box(P["lamp"], 0.3, 0.26, 0.02, lx, D["y"] + 3.06, mz + 0.27, rx=0.5)
    # the operator's shack under the deck: plank walls, a lit window, a door
    H = SHACK
    hx, hz = (H["x0"] + H["x1"]) / 2, (H["z0"] + H["z1"]) / 2
    hw, hd = H["x1"] - H["x0"], H["z1"] - H["z0"]
    b.box(P["green"], hw, H["h"], hd, hx, 0, hz)
    b.box(P["cream"], hw + 0.1, 0.1, hd + 0.1, hx, H["h"] - 0.1, hz)
    b.box(P["black"], hw + 0.3, 0.12, hd + 0.4, hx, H["h"], hz)
    # boxed in with lattice from its roof up to the deck (the collider is solid)
    y0, y1 = H["h"] + 0.12, D["y"] - 0.25
    for (ax, az, bx, bz) in ((H["x0"], H["z0"], H["x1"], H["z0"]), (H["x0"], H["z1"], H["x1"], H["z1"]),
                             (H["x0"], H["z0"], H["x0"], H["z1"]), (H["x1"], H["z0"], H["x1"], H["z1"])):
        L = math.hypot(bx - ax, bz - az)
        n = max(2, round(L / 0.5))
        ux, uz = (bx - ax) / L, (bz - az) / L
        b.bar(P["cream"], (ax, y0, az), (bx, y0, bz), 0.08)
        b.bar(P["cream"], (ax, y1 - 0.04, az), (bx, y1 - 0.04, bz), 0.08)
        for k in range(n):
            p0 = (ax + ux * L * k / n, az + uz * L * k / n)
            p1 = (ax + ux * L * (k + 1) / n, az + uz * L * (k + 1) / n)
            b.bar(P["cream"], (p0[0], y0, p0[1]), (p1[0], y1, p1[1]), 0.03, 0.05)
            b.bar(P["cream"], (p1[0], y0, p1[1]), (p0[0], y1, p0[1]), 0.03, 0.05)
    b.box(P["warm"], 1.1, 0.7, 0.02, hx - 0.3, 1.2, H["z1"] + 0.01)
    b.box(P["cream"], 1.25, 0.08, 0.06, hx - 0.3, 1.15, H["z1"] + 0.03)
    b.box(P["cream"], 1.25, 0.06, 0.05, hx - 0.3, 1.9, H["z1"] + 0.03)
    b.box(P["wood_dk"], 0.02, 2.0, 0.85, H["x0"] - 0.01, 0, hz)
    b.box(P["brass"], 0.04, 0.05, 0.05, H["x0"] - 0.03, 1.0, hz + 0.3)
    # the control desk at the window and the big lever
    b.box(SD, 0.6, 1.0, 0.4, hx + 0.2, 0, H["z1"] + 0.25)
    b.cyl(P["red"], 0.025, (hx + 0.1, 1.0, H["z1"] + 0.25), (hx + 0.0, 1.4, H["z1"] + 0.3), seg=5)
    b.cyl(P["red"], 0.05, (hx + 0.0, 1.4, H["z1"] + 0.3), (hx + 0.0, 1.46, H["z1"] + 0.3), seg=8)
    # the ticket podium
    px, pz = PODIUM
    b.box(P["red"], 0.9, 1.05, 0.7, px, 0, pz, bevel=0.02)
    b.box(P["gold"], 1.0, 0.06, 0.8, px, 1.05, pz)
    b.box(P["cream"], 0.06, 1.6, 0.06, px + 0.4, 1.1, pz - 0.3)
    R.end()
    b.finish("hg-wheelbase.glb")


def awning(b, P, x0, x1, z, y_back, y_front, depth, cols):
    """A striped awning running x0..x1, sloping from y_back at z to y_front
    `depth` metres forward (+z), with a scalloped valance."""
    n = max(4, round((x1 - x0) / 0.36))
    w = (x1 - x0) / n
    ang = math.atan2(y_back - y_front, depth)
    L = math.hypot(depth, y_back - y_front)
    for k in range(n):
        x = x0 + w * (k + 0.5)
        b.box(cols[k % 2], w + 0.002, 0.03, L, x, (y_back + y_front) / 2 - 0.015, z + depth / 2, rx=ang)
        b.box(cols[k % 2], w + 0.002, 0.24, 0.02, x, y_front - 0.24, z + depth)
        b.cyl(cols[k % 2], w / 2, (x, y_front - 0.24, z + depth - 0.012), (x, y_front - 0.24, z + depth + 0.012), seg=10)


def build_stalls(P, R):
    b = HGBuilder()
    R.begin(b, "park:stalls")
    zb, zf = STALL_Z
    looks = [
        ("red", "cream"),      # Balloon Pop
        ("teal", "cream"),     # Shooting Gallery
        ("green", "yellow"),   # Hook-a-Pepe
        ("pink", "white"),     # Cotton Candy
        ("orange", "black"),   # Corn Dogs
    ]
    for i, (x0, x1) in enumerate(STALLS):
        cx, w = (x0 + x1) / 2, x1 - x0
        ca, cb = P[looks[i][0]], P[looks[i][1]]
        # back wall and partitions: planks inside, painted boards outside
        b.box(P["plank"], w, 3.0, 0.2, cx, 0, zb + 0.1)
        b.box(ca, w + 0.02, 0.5, 0.22, cx, 2.5, zb + 0.1)
        for xx in (x0 + 0.1, x1 - 0.1):
            b.box(P["plank"], 0.2, 2.9, zf - zb, xx, 0, (zb + zf) / 2)
            b.box(P["wood_dk"], 0.24, 0.12, zf - zb + 0.04, xx, 2.9, (zb + zf) / 2)
        # the counter, with a gap (the flap) at the east end
        gap = 0.8
        cw = w - 0.2 - gap
        ccx = x0 + 0.1 + cw / 2
        b.box(ca, cw, 0.95, 0.5, ccx, 0, zf - 0.25)
        b.box(P["wood"], cw + 0.06, 0.08, 0.6, ccx, 0.95, zf - 0.22)
        for k in range(int(cw / 0.5)):
            b.box(cb, 0.18, 0.7, 0.02, x0 + 0.35 + k * 0.5, 0.12, zf + 0.005)
        # front posts and fascia board for the sign
        for xx in (x0 + 0.1, x1 - 0.1):
            b.box(P["wood_dk"], 0.14, 3.2, 0.14, xx, 0, zf - 0.07)
        b.box(P["wood_dk"], w, 0.7, 0.08, cx, 2.95, zf - 0.04)
        b.box(cb, w + 0.06, 0.06, 0.12, cx, 3.65, zf - 0.04)
        b.box(cb, w + 0.06, 0.06, 0.12, cx, 2.92, zf - 0.04)
        # roof and the striped awning out front
        b.box(P["black"], w + 0.2, 0.1, zf - zb + 0.2, cx, 3.0, (zb + zf) / 2)
        awning(b, P, x0, x1, zf, 2.85, 2.45, 1.0, (ca, cb))
        # the prize shelf on the back wall
        b.box(P["wood"], w - 0.4, 0.05, 0.3, cx, 2.15, zb + 0.35)
    # 1: Balloon Pop — a cork board of balloons
    x0, x1 = STALLS[0]
    cx = (x0 + x1) / 2
    b.box(P["wood_dk"], 2.8, 1.5, 0.05, cx, 0.7, zb + 0.22)
    cols = [P["red"], P["yellow"], P["blue"], P["purple"], P["green"], P["orange"]]
    rnd = random.Random(3)
    for r_ in range(4):
        for c in range(7):
            if rnd.random() < 0.12:
                continue
            bx = cx - 1.2 + c * 0.4 + (0.2 if r_ % 2 else 0)
            if bx > cx + 1.3:
                continue
            # a balloon: a turned egg, its knot under it
            by = 0.8 + r_ * 0.34
            turn(b, cols[(r_ * 7 + c) % 6], bx, zb + 0.36, [(0.0, 0.0), (0.06, 0.03), (0.12, 0.12), (0.12, 0.2), (0.08, 0.27), (0.0, 0.3)], seg=8, y0=by)
            turn(b, cols[(r_ * 7 + c) % 6], bx, zb + 0.36, [(0.0, -0.03), (0.025, 0.0), (0.0, 0.01)], seg=4, y0=by)
    # 2: Shooting Gallery — the target board, rails and a row of tin ducks' rail
    x0, x1 = STALLS[1]
    cx = (x0 + x1) / 2
    b.box(P["teal"], 3.0, 1.9, 0.05, cx, 0.5, zb + 0.22)
    for yy in (1.2, 1.72):
        b.box(P["brass"], 3.0, 0.04, 0.06, cx, yy, zb + 0.5)
    for k in range(6):
        b.cyl(P["cream"], 0.16, (cx - 1.25 + k * 0.5, 2.3, zb + 0.26), (cx - 1.25 + k * 0.5, 2.3, zb + 0.28), seg=12)
        b.cyl(P["red"], 0.1, (cx - 1.25 + k * 0.5, 2.3, zb + 0.28), (cx - 1.25 + k * 0.5, 2.3, zb + 0.29), seg=12)
    for k in range(3):
        rx = cx - 0.9 + k * 0.9
        b.bar(P["wood_dk"], (rx, 1.02, zf - 0.28), (rx + 0.1, 1.06, zf - 0.6), 0.05, 0.06)
        b.cyl(P["steel_dk"], 0.015, (rx + 0.1, 1.08, zf - 0.6), (rx + 0.12, 1.1, zf - 0.95), seg=6)
    # the tin ducks riding the two rails, facing the shooters
    duck = [(-0.14, 0.0), (0.14, 0.0), (0.15, 0.06), (0.08, 0.1), (0.1, 0.18), (0.06, 0.24), (0.0, 0.23), (-0.02, 0.16), (-0.12, 0.1)]
    for j, yy in enumerate((1.24, 1.76)):
        for k in range(6):
            dx = cx - 1.25 + k * 0.5 + (0.25 if j else 0.0)
            if dx > cx + 1.4:
                continue
            zz = zb + 0.53
            facing(b, P["yellow"] if (k + j) % 2 else P["tin"], [(dx + u, yy + v, zz) for u, v in duck], (0.0, 0.0, 1.0))
            b.box(P["black"], 0.025, 0.025, 0.01, dx + 0.065, yy + 0.19, zz + 0.005)
    # 3: Hook-a-Pepe — a water trough of little green frogs
    # (the prizes, goldfish in bags, wait on its shelf)
    gx0 = STALLS[2][0]
    for k in range(6):
        px, pz = gx0 + 0.55 + k * 0.48, zb + 0.35
        turn(b, P["water"], px, pz, [(0.0, 0.0), (0.09, 0.03), (0.1, 0.12), (0.06, 0.2), (0.015, 0.24), (0.03, 0.29), (0.0, 0.3)], seg=8, y0=2.2)
        b.box(P["fish"], 0.07, 0.035, 0.02, px, 2.28, pz + 0.01, ry=0.4 * (k % 3 - 1))
    x0, x1 = STALLS[2]
    cx = (x0 + x1) / 2
    b.box(P["blue"], 2.6, 0.75, 1.0, cx - 0.2, 0, (zb + zf) / 2 + 0.2)
    b.box(P["teal"], 2.5, 0.02, 0.9, cx - 0.2, 0.7, (zb + zf) / 2 + 0.2)
    for k in range(10):
        px = cx - 1.3 + (k % 5) * 0.5 + rnd.uniform(-0.1, 0.1)
        pz = (zb + zf) / 2 - 0.05 + (k // 5) * 0.45 + rnd.uniform(-0.05, 0.05)
        b.lump(P["green"], 0.2, 0.14, 0.18, px, 0.68, pz, seed=60 + k, rnd=0.9, jitter=0.0)
        for s in (-1, 1):
            b.cyl(P["white"], 0.03, (px + 0.06, 0.82, pz + s * 0.04), (px + 0.08, 0.83, pz + s * 0.04), seg=6)
    for k in range(3):
        rx = cx - 1.0 + k * 0.8
        b.cyl(P["wood"], 0.012, (rx, 0.98, zf - 0.3), (rx, 2.1, zf - 0.35), seg=4)
    # 4: Cotton Candy — the spinning bowl and a rack of pink clouds
    x0, x1 = STALLS[3]
    cx = (x0 + x1) / 2
    b.box(P["steel_dk"], 0.9, 0.85, 0.7, cx, 0, (zb + zf) / 2)
    turn(b, P["steel"], cx, (zb + zf) / 2, [(0.0, 0.85), (0.38, 0.85), (0.45, 1.12), (0.42, 1.14), (0.35, 0.9), (0.0, 0.9)], seg=16)
    b.lump(P["pink"], 0.5, 0.3, 0.5, cx, 0.95, (zb + zf) / 2, seed=70, rnd=1.0, jitter=0.03)
    for k in range(6):
        px = x0 + 0.5 + k * 0.48
        b.cyl(P["white"], 0.012, (px, 1.6, zb + 0.4), (px, 1.95, zb + 0.4), seg=4)
        b.lump(P["pink"] if k % 2 else P["blue"], 0.24, 0.3, 0.24, px, 1.92, zb + 0.4, seed=71 + k, rnd=1.0, jitter=0.03, flat_base=False)
    # 5: Corn Dogs — a fryer, a hood, a stand of corn dogs
    x0, x1 = STALLS[4]
    cx = (x0 + x1) / 2
    b.box(P["steel"], 1.4, 0.95, 0.7, cx - 0.5, 0, zb + 0.55)
    b.box(P["black"], 1.2, 0.04, 0.5, cx - 0.5, 0.95, zb + 0.55)
    b.frustum(P["steel_dk"], 1.6, 0.9, 0.6, 0.4, 2.0, 2.6, cx - 0.5, zb + 0.6)
    b.box(P["steel_dk"], 0.3, 0.4, 0.3, cx - 0.5, 2.6, zb + 0.6)
    b.box(P["wood"], 0.6, 0.3, 0.3, cx + 0.9, 0.95, zf - 0.3)
    for k in range(8):
        px = cx + 0.7 + (k % 4) * 0.12
        pz = zf - 0.36 + (k // 4) * 0.12
        b.cyl(P["cream"], 0.006, (px, 1.25, pz), (px, 1.45, pz), seg=3)
        b.lump(P["leaf_y"], 0.06, 0.2, 0.06, px, 1.42, pz, seed=80 + k, rnd=0.9, jitter=0.0)
    R.end()
    b.finish("hg-stalls.glb")


# ------------------------------------------------------------------ U Mad Mansion
# (moved from build_grinmoor.blender.py in phase 4)

GALLERY = dict(x0=61.4, x1=77.6, z0=18.2, z1=20.5)
# Shared with hollowgrin.js (MANSION_*): spans are relative to the floor (0.4).
MANSION = dict(x0=62.0, x1=77.0, z0=20.5, z1=30.5, t=0.3, floor=0.4, slab=3.9, up=4.2, ceil=7.6, eave=7.9)
M_COLS = [61.6, 63.85, 66.1, 68.35, 70.65, 72.9, 75.15, 77.4]
_W, _D = (0.9, 2.6), (0.0, 2.8)
_F = 0.4   # the floor: low enough (< 0.45) that zombies path over the sill
_UW, _UD = (4.5 - _F, 6.1 - _F), (4.2 - _F, 6.6 - _F)
# one opening per column, both storeys stacked in its spans (openings must not overlap)
M_FRONT = [dict(c=63.9, w=1.4, spans=[_W, _UD]), dict(c=66.9, w=1.1, spans=[_W, _UW]), dict(c=69.5, w=1.8, spans=[_D, _UD]),
           dict(c=72.1, w=1.1, spans=[_W, _UW]), dict(c=75.1, w=1.4, spans=[_W, _UD])]
M_BACK = [dict(c=64.5, w=1.1, spans=[_UW]), dict(c=68.0, w=1.1, spans=[_W, _UW]), dict(c=71.0, w=1.1, spans=[_W, _UW]),
          dict(c=75.4, w=1.7, spans=[(0.0, 2.5), _UW])]
M_WEST = [dict(c=26.3, w=1.1, spans=[_W]), dict(c=23.0, w=1.1, spans=[_UW]), dict(c=27.5, w=1.1, spans=[_UW])]
M_EAST = [dict(c=22.8, w=1.1, spans=[_W, _UW]), dict(c=27.5, w=1.1, spans=[_UW])]
# ground-floor partitions: (axis, at, a, b, holes); 0.2 thick, floor to slab
# (doorways >= 1.7 m: the zombies' flow field needs a whole free cell through)
M_PARTS = [("z", 66.0, 20.8, 25.2, [dict(c=21.75, w=1.7, spans=[(0.0, 2.4)])]),
           ("x", 25.2, 62.3, 76.7, [dict(c=63.25, w=1.8, spans=[(0.0, 2.4)])]),
           ("z", 73.0, 25.3, 30.2, [dict(c=26.2, w=1.7, spans=[(0.0, 2.4)])])]
M_CLOSET = (64.2, 65.9, 22.7, 25.1)
M_STAIR = dict(x_foot=67.7, z=28.2, w=1.2, steps=14, rise=(4.2 - 0.4) / 14, run=0.27)
M_HOLE = (64.2, 66.4, 27.6, 28.8)
M_MAZE = [("x", 27.4, 73.1, 74.9), ("x", 28.8, 74.9, 76.7)]
SCARECROW = (59.4, 21.5)
LIT = {63.9, 72.1, 68.0, 22.8}


def catenary(a, b_, sag, n):
    return [(a[0] + (b_[0] - a[0]) * i / n, a[1] + (b_[1] - a[1]) * i / n - sag * 4 * (i / n) * (1 - i / n), a[2] + (b_[2] - a[2]) * i / n) for i in range(n + 1)]


def build_mansion(P, R):
    import importlib
    hk = importlib.import_module("hg_legacy_village")
    Wall = hk.Wall
    b = HGBuilder()
    R.begin(b, "park:mansion")
    Mn = MANSION
    x0, x1, z0, z1, t, F = Mn["x0"], Mn["x1"], Mn["z0"], Mn["z1"], Mn["t"], Mn["floor"]
    CL, TR, DM, PL = P["clapw"], P["trim_w"], P["damask"], P["plaster_in"]
    H = Mn["ceil"] - F
    # the foundation: brick, a white skirt, floorboards on top
    for (ax0, ax1, az0, az1) in ((x0, x1, z0, z1), (GALLERY["x0"], GALLERY["x1"], GALLERY["z0"], z0)):
        b.box(P["brick"], ax1 - ax0, F - 0.02, az1 - az0, (ax0 + ax1) / 2, 0, (az0 + az1) / 2)
        b.box(TR, ax1 - ax0 + 0.04, 0.08, az1 - az0 + 0.04, (ax0 + ax1) / 2, F - 0.12, (az0 + az1) / 2)
        b.box(P["deck"], ax1 - ax0, 0.02, az1 - az0, (ax0 + ax1) / 2, F - 0.02, (az0 + az1) / 2)
    walls = [Wall("x", z0 + t / 2, x0, x1, H, t, holes=M_FRONT, y=F, out=-1),
             Wall("x", z1 - t / 2, x0, x1, H, t, holes=M_BACK, y=F, out=1),
             Wall("z", x0 + t / 2, z0 + t, z1 - t, H, t, holes=M_WEST, y=F, out=-1),
             Wall("z", x1 - t / 2, z0 + t, z1 - t, H, t, holes=M_EAST, y=F, out=1)]
    for w in walls:
        w.solid(b, CL, inner=DM, split=0.4)
        w.laps(b, CL, every=0.21, y0=0.05, y1=H)
        w.casings(b, TR, fw=0.13)
        # baseboards and a picture rail inside, on both floors
        for lo, hi in ((0.0, 0.16), (2.6, 2.66), (3.6, 3.76), (6.2, 6.26)):
            for s, e in hk.spans_free(w.a, w.b, w.holes, (lo + hi) / 2):
                w.slab(b, P["wood_dk"], s, e, lo, hi, w.face(-0.02), 0.04)
        # the glass: warm where a lamp is lit inside, dark otherwise, with mullions
        for hole in w.holes:
            for lo, hi in hole["spans"]:
                if lo < 0.05 or (lo, hi) == _UD:
                    continue
                lit = hole["c"] in LIT
                w.slab(b, P["warm"] if lit else P["glass"], hole["c"] - hole["w"] / 2, hole["c"] + hole["w"] / 2, lo, hi, w.at, 0.03)
                w.slab(b, TR, hole["c"] - 0.025, hole["c"] + 0.025, lo, hi, w.at + 0.0, 0.07)
                w.slab(b, TR, hole["c"] - hole["w"] / 2, hole["c"] + hole["w"] / 2, (lo + hi) / 2 - 0.025, (lo + hi) / 2 + 0.025, w.at, 0.07)
                # green shutters either side, outside
                for side in (-1, 1):
                    p0 = hole["c"] + side * (hole["w"] / 2 + 0.13)
                    p1 = p0 + side * hole["w"] * 0.5
                    w.slab(b, P["shutter"], min(p0, p1), max(p0, p1), lo, hi, w.face(0.03), 0.04)
    # corner boards
    for cx in (x0, x1):
        for cz in (z0, z1):
            b.box(TR, 0.36, H, 0.36, cx, F, cz)
    # the partitions downstairs, the closet block
    for axis, at, a, b_, holes in M_PARTS:
        pw = Wall(axis, at, a, b_, Mn["slab"] - F, 0.2, holes=holes, y=F, out=1)
        pw.solid(b, DM)
        pw.casings(b, P["wood_dk"], fw=0.1, side=1)
        pw.casings(b, P["wood_dk"], fw=0.1, side=-1)
        for side in (-1, 1):
            for s, e in hk.spans_free(pw.a, pw.b, pw.holes, 0.08):
                pw.slab(b, P["wood_dk"], s, e, 0.0, 0.16, pw.face(0.02) if side > 0 else pw.face(-0.02), 0.04)
    cx0, cx1, cz0, cz1 = M_CLOSET
    b.box(DM, cx1 - cx0, Mn["slab"] - F, cz1 - cz0, (cx0 + cx1) / 2, F, (cz0 + cz1) / 2)
    b.box(P["wood_dk"], 0.9, 2.2, 0.04, (cx0 + cx1) / 2, F, cz0 - 0.02)       # a closet door that never opens
    b.box(P["brass"], 0.05, 0.05, 0.05, (cx0 + cx1) / 2 + 0.32, F + 1.0, cz0 - 0.05)
    # the upper floor: ceiling plaster under, boards on top, the stairwell open
    hx0, hx1, hz0, hz1 = M_HOLE
    ix0, ix1, iz0, iz1 = x0 + t, x1 - t, z0 + t, z1 - t
    for (a0, a1, c0, c1) in ((ix0, hx0, iz0, iz1), (hx1, ix1, iz0, iz1), (hx0, hx1, iz0, hz0), (hx0, hx1, hz1, iz1)):
        b.box(PL, a1 - a0, 0.22, c1 - c0, (a0 + a1) / 2, Mn["slab"], (c0 + c1) / 2)
        b.box(P["deck"], a1 - a0, 0.08, c1 - c0, (a0 + a1) / 2, Mn["slab"] + 0.22, (c0 + c1) / 2)
    b.box(PL, ix1 - ix0, 0.3, iz1 - iz0, (ix0 + ix1) / 2, Mn["ceil"], (iz0 + iz1) / 2)
    # crown moulding round both ceilings
    for yy in (Mn["slab"] - 0.12, Mn["ceil"] - 0.12):
        for (ax, az, bx, bz) in ((ix0, iz0 + 0.06, ix1, iz0 + 0.06), (ix0, iz1 - 0.06, ix1, iz1 - 0.06),
                                 (ix0 + 0.06, iz0, ix0 + 0.06, iz1), (ix1 - 0.06, iz0, ix1 - 0.06, iz1)):
            b.bar(TR, (ax, yy + 0.06, az), (bx, yy + 0.06, bz), 0.12)
    # the stair: treads, risers, a panelled side, balusters and a rail
    S = M_STAIR
    for i in range(S["steps"]):
        top = F + S["rise"] * (i + 1)
        xc = S["x_foot"] - S["run"] * (i + 0.5)
        b.box(P["wood_dk"], S["run"] + 0.03, 0.05, S["w"] + 0.06, xc, top - 0.05, S["z"])
        b.box(P["deck"], 0.03, S["rise"] - 0.05, S["w"], xc + S["run"] / 2 - 0.015, top - S["rise"], S["z"])
    xt = S["x_foot"] - S["run"] * S["steps"]
    for zz in (S["z"] - S["w"] / 2 - 0.03, S["z"] + S["w"] / 2 + 0.03):
        b.prism(P["wood_dk"], [(xt, F), (S["x_foot"], F), (S["x_foot"], F + S["rise"]), (xt, F + S["rise"] * S["steps"])], zz - 0.03, zz + 0.03, axis="z")
    zr = S["z"] - S["w"] / 2 - 0.02
    for i in range(0, S["steps"], 1):
        xc = S["x_foot"] - S["run"] * (i + 0.5)
        top = F + S["rise"] * (i + 1)
        b.cyl(P["wood_dk"], 0.025, (xc, top, zr), (xc, top + 0.9, zr), seg=6)
    b.bar(P["wood_dk"], (S["x_foot"] + 0.1, F + 0.95, zr), (xt, F + S["rise"] * S["steps"] + 0.95, zr), 0.07)
    b.box(P["wood_dk"], 0.16, 1.2, 0.16, S["x_foot"] + 0.12, F, zr)
    turn(b, P["brass"], S["x_foot"] + 0.12, zr, [(0, F + 1.2), (0.09, F + 1.24), (0.0, F + 1.36)], seg=8)
    # rails round the stairwell upstairs
    U = Mn["up"]
    for (ax, az, bx, bz) in ((hx0, hz0 - 0.05, hx1, hz0 - 0.05), (hx0, hz1 + 0.05, hx1, hz1 + 0.05), (hx1 + 0.05, hz0, hx1 + 0.05, hz1)):
        L = math.hypot(bx - ax, bz - az)
        n = max(2, round(L / 0.2))
        for k in range(n + 1):
            px, pz = ax + (bx - ax) * k / n, az + (bz - az) * k / n
            b.cyl(P["wood_dk"], 0.022, (px, U, pz), (px, U + 0.95, pz), seg=6)
        b.bar(P["wood_dk"], (ax, U + 0.97, az), (bx, U + 0.97, bz), 0.08, 0.06)
    # the gallery: two decks of columns, the upper deck and its roof
    G = GALLERY
    gcx, gcz = (G["x0"] + G["x1"]) / 2, (G["z0"] + G["z1"]) / 2
    gw, gd = G["x1"] - G["x0"], G["z1"] - G["z0"]
    b.box(TR, gw, 0.26, gd, gcx, 3.94, gcz)
    b.box(P["deck"], gw - 0.04, 0.02, gd - 0.04, gcx, 4.18, gcz)
    b.box(TR, gw + 0.3, 0.16, gd + 0.4, gcx, Mn["eave"], gcz - 0.1)
    b.box(P["slate"], gw + 0.4, 0.06, gd + 0.5, gcx, Mn["eave"] + 0.16, gcz - 0.1)
    for x in M_COLS:
        for (ya, yb) in ((F, 3.94), (4.2, Mn["eave"])):
            b.box(TR, 0.4, 0.14, 0.4, x, ya, 18.4)
            b.cyl(TR, 0.15, (x, ya + 0.14, 18.4), (x, yb - 0.2, 18.4), seg=14, r2=0.13)
            b.box(TR, 0.42, 0.08, 0.42, x, yb - 0.2, 18.4)
            b.box(TR, 0.34, 0.12, 0.34, x, yb - 0.12, 18.4)
    # the front steps, the back steps
    b.box(P["granite"], 3.6, 0.2, 0.4, 69.5, 0, 18.0)
    b.box(P["granite"], 1.6, 0.2, 0.4, 75.4, 0, 30.7)
    # the roof: a hipped slate roof, a ridge crest, two chimneys
    E = Mn["eave"]
    ra, rb, rc, rd = (x0 - 0.4, E, z0 - 0.4), (x1 + 0.4, E, z0 - 0.4), (x1 + 0.4, E, z1 + 0.4), (x0 - 0.4, E, z1 + 0.4)
    half = (z1 - z0) / 2 + 0.4
    rise = 2.7
    r1, r2 = ((x0 - 0.4) + half, E + rise, (z0 + z1) / 2), ((x1 + 0.4) - half, E + rise, (z0 + z1) / 2)
    b.poly(P["slate"], [ra, rb, rc, rd, r1, r2], [[0, 1, 5, 4], [2, 3, 4, 5], [3, 0, 4], [1, 2, 5], [3, 2, 1, 0]])
    # shingle courses: thin lines up each face (just proud of it)
    for k in range(1, 9):
        f = k / 9
        y = E + rise * f
        inset = half * f
        for (a, c) in (((x0 - 0.4 + inset, z0 - 0.4 + inset), (x1 + 0.4 - inset, z0 - 0.4 + inset)),
                       ((x0 - 0.4 + inset, z1 + 0.4 - inset), (x1 + 0.4 - inset, z1 + 0.4 - inset))):
            sgn = -1 if c[1] < (z0 + z1) / 2 else 1
            b.bar(P["slate_dk"], (a[0], y + 0.02, a[1] + sgn * 0.02), (c[0], y + 0.02, c[1] + sgn * 0.02), 0.04, 0.03)
    b.bar(P["slate_dk"], r1, r2, 0.16)
    for (p, q) in ((ra, r1), (rd, r1), (rb, r2), (rc, r2)):
        b.bar(P["slate_dk"], p, q, 0.12)
    for k in range(int((r2[0] - r1[0]) / 0.3) + 1):
        xx = r1[0] + k * 0.3
        b.cyl(P["iron"], 0.012, (xx, r1[1] + 0.08, r1[2]), (xx, r1[1] + 0.5, r1[2]), seg=4)
        turn(b, P["iron"], xx, r1[2], [(0, r1[1] + 0.45), (0.035, r1[1] + 0.5), (0, r1[1] + 0.6)], seg=4)
    b.bar(P["iron"], (r1[0], r1[1] + 0.3, r1[2]), (r2[0], r1[1] + 0.3, r1[2]), 0.02)
    b.box(TR, x1 - x0 + 0.9, 0.22, 0.12, (x0 + x1) / 2, E - 0.2, z0 - 0.42)
    b.box(TR, x1 - x0 + 0.9, 0.22, 0.12, (x0 + x1) / 2, E - 0.2, z1 + 0.42)
    b.box(TR, 0.12, 0.22, z1 - z0 + 0.9, x0 - 0.42, E - 0.2, (z0 + z1) / 2)
    b.box(TR, 0.12, 0.22, z1 - z0 + 0.9, x1 + 0.42, E - 0.2, (z0 + z1) / 2)
    for cx in (63.6, 75.4):
        b.box(P["brick"], 0.9, 4.6, 0.7, cx, E + 0.4, 27.6)
        b.box(P["granite_dk"], 1.05, 0.14, 0.85, cx, E + 5.0, 27.6)
        for s in (-0.2, 0.2):
            b.cyl(P["brick"], 0.1, (cx + s, E + 5.14, 27.6), (cx + s, E + 5.5, 27.6), seg=8)
    # the cupola: windows lit, a cornice, a pyramid cap, cresting, a vane mast
    cx, cz, cy = (x0 + x1) / 2, (z0 + z1) / 2, E + rise - 0.3
    b.box(TR, 2.3, 1.6, 2.3, cx, cy, cz)
    for (dx, dz, w_, d_) in ((0, -1.16, 1.5, 0.03), (0, 1.16, 1.5, 0.03), (-1.16, 0, 0.03, 1.5), (1.16, 0, 0.03, 1.5)):
        b.box(P["warm"], w_, 0.9, d_, cx + dx, cy + 0.4, cz + dz)
    b.box(TR, 2.6, 0.18, 2.6, cx, cy + 1.6, cz)
    pc = cy + 1.78
    b.poly(P["slate"], [(cx - 1.3, pc, cz - 1.3), (cx + 1.3, pc, cz - 1.3), (cx + 1.3, pc, cz + 1.3), (cx - 1.3, pc, cz + 1.3), (cx, pc + 1.3, cz)],
           [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [3, 2, 1, 0]])
    b.cyl(P["iron"], 0.03, (cx, pc + 1.25, cz), (cx, pc + 2.6, cz), seg=6)
    for (dx, dz) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        b.bar(P["iron"], (cx, pc + 2.0, cz), (cx + dx * 0.35, pc + 2.0, cz + dz * 0.35), 0.015)
    b.bar(P["iron"], (cx - 0.6, pc + 2.45, cz), (cx + 0.6, pc + 2.45, cz), 0.03)
    b.poly(P["iron"], [(cx + 0.6, pc + 2.33, cz), (cx + 0.6, pc + 2.57, cz), (cx + 0.82, pc + 2.45, cz)], [[0, 1, 2]])
    b.poly(P["iron"], [(cx + 0.6, pc + 2.57, cz), (cx + 0.6, pc + 2.33, cz), (cx + 0.82, pc + 2.45, cz)], [[0, 1, 2]])
    # foyer: a round ottoman and a grandfather clock; the ballroom fireplace
    turn(b, P["red"], 71.4, 23.0, [(0, F), (0.85, F), (0.85, F + 0.42), (0.7, F + 0.5), (0, F + 0.52)], seg=20)
    b.cyl(P["wood_dk"], 0.12, (71.4, F + 0.5, 23.0), (71.4, F + 1.3, 23.0), seg=10, r2=0.06)
    b.box(P["wood_dk"], 0.6, 2.3, 0.45, 76.3, F, 24.6)
    b.cyl(P["cream"], 0.2, (76.06, F + 1.85, 24.6), (76.04, F + 1.85, 24.6), seg=16)
    b.box(P["brass"], 0.03, 0.6, 0.03, 76.05, F + 0.9, 24.6)
    fx_, fz_ = 69.5, 25.3
    b.box(P["granite"], 2.0, 1.25, 0.5, fx_, F, fz_ + 0.25)
    b.box(P["black"], 1.1, 0.8, 0.06, fx_, F, fz_ + 0.5)
    b.box(P["granite"], 2.4, 0.12, 0.62, fx_, F + 1.25, fz_ + 0.3)
    # the attic upstairs: dust sheets over furniture, trunks, a rocking chair
    for (ax, az, w_, h_, d_, sd) in ((64.0, 22.5, 1.8, 1.0, 0.9, 1), (71.5, 23.0, 1.2, 1.3, 1.2, 2), (73.8, 28.6, 2.0, 0.9, 1.0, 3),
                                     (68.0, 29.2, 1.6, 1.6, 0.8, 4), (66.6, 29.5, 0.9, 1.1, 0.9, 5)):
        b.lump(P["sheet"], w_, h_, d_, ax, U, az, seed=sd, rnd=0.35, jitter=0.04)
    for (ax, az, ry) in ((66.8, 26.0, 0.3), (75.6, 21.6, -0.2), (62.9, 23.0, 1.5)):
        b.box(P["wood"], 1.0, 0.55, 0.6, ax, U, az, ry=ry, bevel=0.02)
        b.box(P["brass"], 1.02, 0.05, 0.62, ax, U + 0.45, az, ry=ry)
    rcx, rcz = 70.6, 27.8
    for s in (-0.25, 0.25):
        b.bar(P["wood_dk"], (rcx - 0.4, U + 0.05, rcz + s), (rcx + 0.4, U + 0.05, rcz + s), 0.04, 0.06)
        b.bar(P["wood_dk"], (rcx, U + 0.05, rcz + s), (rcx, U + 0.45, rcz + s), 0.04)
        b.bar(P["wood_dk"], (rcx + 0.2, U + 0.45, rcz + s), (rcx + 0.3, U + 1.15, rcz + s), 0.04)
    b.box(P["wood_dk"], 0.5, 0.05, 0.56, rcx, U + 0.45, rcz)
    b.box(P["wood_dk"], 0.05, 0.6, 0.5, rcx + 0.26, U + 0.5, rcz, rz=0.2)
    # the planter walls in front, an arch over the way in, the queue rail
    for (a0, a1) in ((G["x0"], 67.5), (71.5, G["x1"])):
        c = (a0 + a1) / 2
        b.box(P["brick"], a1 - a0, 0.7, 0.5, c, 0, 17.25)
        b.box(P["granite"], a1 - a0 + 0.08, 0.06, 0.58, c, 0.7, 17.25)
        b.box(P["black"], a1 - a0 - 0.1, 0.02, 0.4, c, 0.69, 17.25)
        rnd = random.Random(int(a0 * 10))
        for k in range(int((a1 - a0) / 0.5)):
            px = a0 + 0.3 + k * 0.5
            pz = 17.25 + rnd.uniform(-0.05, 0.05)
            for j in range(5):                  # a clump of autumn leaves
                leaf_card(b, (P["leaf_r"], P["leaf_o"], P["leaf"])[(k + j) % 3] if k % 3 else P["leaf"], (px + (j - 2) * 0.07, 0.74, pz),
                          j * 1.3 + k, 0.24, tilt=0.6, droop=0.2)
            if k % 2:
                pumpkin(b, P["pumpkin"], P["stem"], px + 0.1, 0.72, 17.25, 0.14, ribs=8, squash=0.8, seed=950 + k)
        n = max(1, round((a1 - a0) / 1.6))
        for k in range(n + 1):
            px = a0 + 0.15 + (a1 - a0 - 0.3) * k / n
            b.cyl(P["iron"], 0.03, (px, 0.76, 17.25), (px, 1.65, 17.25), seg=6)
            turn(b, P["gold"], px, 17.25, [(0, 1.62), (0.05, 1.68), (0, 1.78)], seg=6)
        for yy in (1.1, 1.55):
            b.bar(P["iron"], (a0 + 0.15, yy, 17.25), (a1 - 0.15, yy, 17.25), 0.025)
    for px in (67.45, 71.55):
        b.box(P["iron"], 0.14, 3.3, 0.14, px, 0, 17.25)
        turn(b, P["gold"], px, 17.25, [(0, 3.3), (0.1, 3.38), (0, 3.55)], seg=8)
    b.box(P["iron"], 4.3, 0.1, 0.1, 69.5, 2.95, 17.25)
    b.box(P["iron"], 4.3, 0.06, 0.06, 69.5, 2.35, 17.25)
    # garlands of skulls and pumpkins swagged along the upper rail
    for i, xa in enumerate(M_COLS[:-1]):
        xb = M_COLS[i + 1]
        for k, p in enumerate(catenary((xa, 5.15, 18.2), (xb, 5.15, 18.2), 0.35, 7)):
            if 0 < k < 7:
                m = P["bone"] if k % 2 else P["pumpkin"]
                b.lump(m, 0.13, 0.13, 0.12, p[0], p[1] - 0.07, p[2], seed=i * 10 + k, rnd=0.8, jitter=0.02, n=2)
    # gingerbread brackets: a pair of braces under the beam at every column head
    for x in M_COLS:
        for yb in (3.94, Mn["eave"]):
            for s in (-1, 1):
                b.bar(TR, (x + s * 0.15, yb - 0.65, 18.4), (x + s * 0.6, yb - 0.08, 18.4), 0.06, 0.05)
                b.bar(TR, (x + s * 0.32, yb - 0.08, 18.4), (x + s * 0.32, yb - 0.4, 18.4), 0.04, 0.04)
    # the scarecrow: post and crossbar, a ragged coat, straw, dangling legs, a witch's hat
    sx, sz = SCARECROW
    b.cyl(P["wood"], 0.11, (sx, 0, sz), (sx, 5.3, sz), seg=8)
    b.bar(P["wood"], (sx - 1.7, 4.45, sz), (sx + 1.7, 4.45, sz), 0.12)
    b.lump(P["burlap"], 1.1, 2.1, 0.62, sx, 2.6, sz, seed=71, rnd=0.45, jitter=0.06, n=2)
    for s in (-1, 1):
        b.lump(P["burlap"], 1.6, 0.42, 0.46, sx + s * 0.95, 4.2, sz, seed=72 + s, rnd=0.5, jitter=0.05, n=2)
        b.lump(P["straw"], 0.3, 0.32, 0.3, sx + s * 1.8, 4.25, sz, seed=74 + s, rnd=0.8, jitter=0.08, n=2)
        b.lump(P["denim"], 0.34, 1.3, 0.34, sx + s * 0.24, 1.4, sz, seed=76 + s, rnd=0.5, jitter=0.04, n=2)
        b.lump(P["straw"], 0.26, 0.3, 0.26, sx + s * 0.24, 1.15, sz, seed=78 + s, rnd=0.8, jitter=0.08, n=2)
        b.lump(P["black"], 0.3, 0.2, 0.42, sx + s * 0.24, 0.95, sz - 0.05, seed=80 + s, rnd=0.6, jitter=0.02, n=2)
    rnd = random.Random(5)
    for k in range(14):
        a = k / 14 * TAU
        b.box(P["burlap"], 0.18, 0.5 + rnd.random() * 0.4, 0.04, sx + math.cos(a) * 0.5, 2.2, sz + math.sin(a) * 0.3, ry=-a)
    b.lump(P["black"], 0.9, 0.2, 0.7, sx, 4.75, sz, seed=82, rnd=0.6, jitter=0.03, n=2)       # collar
    hy = 6.15
    turn(b, P["black"], sx, sz, [(0, hy), (1.15, hy), (1.12, hy + 0.06), (0.55, hy + 0.12), (0, hy + 0.12)], seg=24)
    b.cyl(P["black"], 0.55, (sx, hy + 0.1, sz), (sx + 0.1, hy + 1.0, sz + 0.05), seg=16, r2=0.3)
    b.cyl(P["black"], 0.3, (sx + 0.1, hy + 1.0, sz + 0.05), (sx + 0.45, hy + 1.55, sz + 0.2), seg=12, r2=0.04)
    b.cyl(P["purple"], 0.56, (sx, hy + 0.12, sz), (sx + 0.01, hy + 0.32, sz), seg=16)
    R.end()
    b.finish("hg-mansion.glb")


# ------------------------------------------------------------------ Skull Mountain and the moat
# (moved from build_grinmoor.blender.py in phase 4; hollowgrin.js MOUNTAIN_*, MOAT_*)

MOUNT_SOLIDS = [(72.7, 74.0, 30.6, 34.0, 0.0, 9.0), (76.2, 80.4, 30.6, 36.2, 0.0, 11.0), (80.4, 83.6, 31.6, 36.2, 0.0, 11.0),
                (83.6, 87.0, 30.6, 36.2, 0.0, 10.0), (72.7, 87.0, 36.2, 45.5, 0.0, 12.0),
                (72.7, 76.2, 34.0, 36.2, 3.2, 7.5), (74.0, 76.2, 30.6, 34.0, 3.2, 6.5)]
MOUNT_PEAK = (80.5, 39.5, 15.0)
MOUNT_CELL = 1.8


def mountain_h(x, z, ceiling):
    """The rock's height at (x, z): 15 m at the peak, 1.35 m lower per metre
    out, never under 3.2 (4.6 over the cave path, so it has a roof)."""
    px, pz, ph = MOUNT_PEAK
    return max(4.6 if ceiling else 3.2, ph - 1.35 * math.hypot(x - px, z - pz))


def mountain_cells():
    """(cx, cz, w, d, y0, top) for every rock column, solid by solid."""
    out = []
    for (x0, x1, z0, z1, y0, _h) in MOUNT_SOLIDS:
        nx, nz = max(1, round((x1 - x0) / MOUNT_CELL)), max(1, round((z1 - z0) / MOUNT_CELL))
        for i in range(nx):
            for k in range(nz):
                cx, cz = x0 + (x1 - x0) * (i + 0.5) / nx, z0 + (z1 - z0) * (k + 0.5) / nz
                out.append((cx, cz, (x1 - x0) / nx, (z1 - z0) / nz, y0, mountain_h(cx, cz, y0 > 0)))
    return out
TUNNEL = [(72.7, 76.2, 34.0, 36.2), (74.0, 76.2, 30.6, 34.0)]
MOAT_ARMS = [(54.0, 83.6, 13.5, 16.7), (54.0, 57.2, 16.7, 42.7), (57.2, 64.6, 39.5, 42.7), (80.4, 83.6, 16.7, 31.6)]
POOL = (67.5, 41.1, 3.2)
BRIDGES = [("z", 69.5, 13.5, 16.7, 3.6), ("x", 35.0, 54.0, 57.2, 3.2), ("x", 21.7, 80.4, 83.6, 2.8)]   # axis of travel, centre across, span, width
DECK_Y = 0.55
# curbs along both banks: (axis, at, a, b, gaps); 0.25 thick, 0.2 tall
MOAT_CURBS = [("x", 13.375, 53.75, 83.85, [(67.7, 71.3)]), ("z", 53.875, 13.5, 42.95, [(33.4, 36.6)]),
              ("x", 42.825, 54.0, 64.6, []), ("z", 83.725, 13.5, 31.6, [(20.3, 23.1)]),
              ("x", 16.825, 57.2, 80.4, [(67.7, 71.3)]), ("z", 57.325, 16.7, 39.5, [(33.4, 36.6)]),
              ("x", 39.375, 57.2, 64.6, []), ("z", 80.275, 16.7, 30.6, [(20.3, 23.1)])]




def runs(a, b_, gaps):
    out, cur = [], a
    for g0, g1 in sorted(gaps):
        if g0 > cur:
            out.append((cur, g0))
        cur = max(cur, g1)
    if cur < b_:
        out.append((cur, b_))
    return out
CHUTE = ((74.6, 7.6, 41.1), (70.6, 0.3, 41.1))
SKULL = (79.6, 11.6, 38.4, math.atan2(-0.55, -0.85))   # x, y, z, facing yaw (toward the plaza)


def build_moat(P, R):
    b = HGBuilder()
    R.begin(b, "park:moat")
    C = P["conc"]
    # the channel's curbs on both banks, broken where the bridges cross
    gaps = {i: [] for i in range(len(MOAT_ARMS))}

    def curb(x0, x1, z0, z1):
        if x1 - x0 > 0.05 and z1 - z0 > 0.05:
            b.box(C, x1 - x0, 0.2, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, bevel=0.02)
            b.box(P["moss"], x1 - x0, 0.02, z1 - z0, (x0 + x1) / 2, 0.2, (z0 + z1) / 2)
    for (axis, at, a, b_, gp) in MOAT_CURBS:
        for (s, e) in runs(a, b_, gp):
            if axis == "x":
                curb(s, e, at - 0.125, at + 0.125)
            else:
                curb(at - 0.125, at + 0.125, s, e)
    # the splash pool's round curb, open on the west where the channel leaves
    px_, pz_, pr = POOL
    turn(b, C, px_, pz_, [(pr, 0.0), (pr + 0.25, 0.0), (pr + 0.25, 0.2), (pr, 0.2), (pr, 0.0)], seg=24, a0=-math.pi + 0.55, a1=math.pi - 0.55)
    # the footbridges: a planked deck on beams, posts and a rail
    for (axis, c, a0, a1, w) in BRIDGES:
        L = a1 - a0 + 0.6          # the deck: 0.3 past each bank; a step beyond that
        mid = (a0 + a1) / 2
        def at(along, across, y=0.0):
            return (along, y, c + across) if axis == "x" else (c + across, y, along)
        bw, bd = (L, w) if axis == "x" else (w, L)
        cx, _, cz = at(mid, 0)
        b.box(P["wood_dk"], bw, 0.25, bd, cx, DECK_Y - 0.3, cz)
        n = int(L / 0.32)
        for k in range(n):
            p = a0 - 0.3 + (k + 0.5) * L / n
            x, _, z = at(p, 0)
            b.box(P["plank"], (L / n - 0.03) if axis == "x" else w, 0.06, w if axis == "x" else (L / n - 0.03), x, DECK_Y - 0.06, z)
        for e in (a0 - 0.6, a1 + 0.6):
            x, _, z = at(e, 0)
            b.box(P["plank"], 0.6 if axis == "x" else w, 0.27, w if axis == "x" else 0.6, x, 0, z)
        for s in (-1, 1):
            for k in range(5):
                p = a0 - 0.2 + (L - 0.4) * k / 4
                x, _, z = at(p, s * (w / 2 - 0.05))
                b.box(P["wood_dk"], 0.12, 1.1, 0.12, x, DECK_Y, z)
                turn(b, P["pumpkin"], x, z, [(0, DECK_Y + 1.1), (0.1, DECK_Y + 1.16), (0.0, DECK_Y + 1.3)], seg=8)
            p0, p1 = at(a0 - 0.25, s * (w / 2 - 0.05), DECK_Y + 1.0), at(a1 + 0.25, s * (w / 2 - 0.05), DECK_Y + 1.0)
            b.bar(P["wood_dk"], p0, p1, 0.1, 0.08)
            p0, p1 = at(a0 - 0.25, s * (w / 2 - 0.05), DECK_Y + 0.5), at(a1 + 0.25, s * (w / 2 - 0.05), DECK_Y + 0.5)
            b.bar(P["wood_dk"], p0, p1, 0.06)
    R.end()
    b.finish("hg-moat.glb")


def _rock_top(cells, x, z, pad=0.22):
    """The collider top under (x, z): the highest rock column within pad of
    it (so the surface stands on the colliders, steps and all), and whether
    that column roofs the cave path. None off the rock."""
    best, roof = None, False
    for (cx, cz, cw, cd, y0, top) in cells:
        if abs(x - cx) <= cw / 2 + pad and abs(z - cz) <= cd / 2 + pad and (best is None or top > best):
            best, roof = top, y0 > 0
    return best, roof


def _noise(x, z, seed=0):
    """Smooth value noise, about -1..1 (sums of offset sines)."""
    return (math.sin(x * 0.9 + seed) * math.cos(z * 1.1 - seed * 0.7) * 0.55
            + math.sin(x * 2.3 + z * 1.7 + seed * 1.3) * 0.3 + math.sin(x * 5.1 - z * 4.3) * 0.15)


def build_mountain(P, R):
    """Skull Mountain (phase 4): one rock surface over the colliders' tops,
    terraced where the columns step, cliffs down its sides, the cave path's
    walls and roof, the flume chute, frosted pines. The skull on the peak is
    the Studio hero (hg-skull.glb)."""
    b = HGBuilder()
    R.begin(b, "park:mountain")
    rnd = random.Random(31)
    ROCK, ROCKD, SNOW = P["rock"], P["rock_dk"], P["snow"]
    cells = mountain_cells()
    X0, X1, Z0, Z1 = 72.7, 87.0, 30.6, 45.5
    S = 0.5
    nx, nz = round((X1 - X0) / S), round((Z1 - Z0) / S)
    H, ROOF = {}, {}
    for i in range(nx + 1):
        for k in range(nz + 1):
            x, z = X0 + (X1 - X0) * i / nx, Z0 + (Z1 - Z0) * k / nz
            top, roof = _rock_top(cells, x, z)
            if top is not None:
                edge = i in (0, nx) or k in (0, nz)
                top += 0.1 + 0.22 * _noise(x, z, 3) + (0.0 if edge else 0.12 * _noise(x * 2.7, z * 2.7, 9))
            H[i, k], ROOF[i, k] = top, roof
    P3 = lambda i, k: (X0 + (X1 - X0) * i / nx + 0.12 * _noise(i * 1.7, k * 1.3, 1) * (0 < i < nx), H[i, k],   # noqa: E731
                       Z0 + (Z1 - Z0) * k / nz + 0.12 * _noise(k * 1.9, i * 1.1, 2) * (0 < k < nz))
    for i in range(nx):
        for k in range(nz):
            q = [(i, k), (i, k + 1), (i + 1, k + 1), (i + 1, k)]
            if any(H[c] is None for c in q):
                continue
            pts = [P3(*c) for c in q]
            hs = [p[1] for p in pts]
            steep = max(hs) - min(hs)
            m = SNOW if min(hs) > 11.8 and steep < 0.6 else (ROCKD if steep > 0.9 or rnd.random() < 0.3 else ROCK)
            facing(b, m, pts, (0.0, 1.0, 0.0))
    # cliffs: from every rock edge down to the ground (to the cave's roof
    # over the path), jagged in two bands, boulders heaped at the foot
    def cliff(c0, c1, out):
        if H[c0] is None or H[c1] is None:
            return
        p0, p1 = P3(*c0), P3(*c1)
        y_lo = 3.2 if (ROOF[c0] and ROOF[c1]) else 0.0
        mid0 = (p0[0] + out[0] * 0.25, (p0[1] + y_lo) / 2 + 0.3 * _noise(p0[0], p0[2], 5), p0[2] + out[1] * 0.25)
        mid1 = (p1[0] + out[0] * 0.25, (p1[1] + y_lo) / 2 + 0.3 * _noise(p1[0], p1[2], 5), p1[2] + out[1] * 0.25)
        lo0 = (p0[0] + out[0] * 0.1, y_lo, p0[2] + out[1] * 0.1)
        lo1 = (p1[0] + out[0] * 0.1, y_lo, p1[2] + out[1] * 0.1)
        o3 = (out[0], 0.0, out[1])
        facing(b, ROCKD, [p0, p1, mid1, mid0], o3)
        facing(b, ROCK, [mid0, mid1, lo1, lo0], o3)
    for k in range(nz):
        cliff((0, k), (0, k + 1), (-1.0, 0.0))
        cliff((nx, k), (nx, k + 1), (1.0, 0.0))
    for i in range(nx):
        cliff((i, 0), (i + 1, 0), (0.0, -1.0))
        cliff((i, nz), (i + 1, nz), (0.0, 1.0))
    # the waterway's notch (no rock there): cliffs round its three sides
    for i in range(nx):
        for k in range(nz + 1):
            for dk, out in ((1, (0.0, 1.0)), (-1, (0.0, -1.0))):
                kk = k + dk
                if 0 <= kk <= nz and H[i, k] is None and H[i + 1, k] is None and H[i, kk] is not None and H[i + 1, kk] is not None:
                    cliff((i, kk), (i + 1, kk), (0.0, -out[1]))
    for k in range(nz):
        for i in range(nx + 1):
            for di in (1, -1):
                ii = i + di
                if 0 <= ii <= nx and H[i, k] is None and H[i, k + 1] is None and H[ii, k] is not None and H[ii, k + 1] is not None:
                    cliff((ii, k), (ii, k + 1), (-float(di), 0.0))
    for _ in range(26):                     # boulders round the foot, off the ways in
        side = rnd.randrange(3)
        if side == 0:
            x, z = X0 - 0.4, rnd.uniform(37.0, Z1 - 0.5)
        elif side == 1:
            x, z = rnd.uniform(76.6, X1 - 0.5), Z0 - 0.4
            if 80.0 < x < 84.0:
                continue
        else:
            x, z = X1 + 0.4, rnd.uniform(Z0 + 0.5, Z1 - 0.5)
        s_ = rnd.uniform(0.5, 1.1)
        b.lump(ROCKD if rnd.random() < 0.5 else ROCK, s_ * 1.4, s_, s_ * 1.2, x, -0.1, z, seed=rnd.randint(0, 9999), rnd=0.6, jitter=0.1,
               ry=rnd.uniform(0, TAU), n=2)
    # the cave path: its walls against the solid rock, a rough roof
    for (x0, x1, z0, z1) in TUNNEL:
        b.box(ROCKD, x1 - x0, 0.3, z1 - z0, (x0 + x1) / 2, 2.95, (z0 + z1) / 2)
    walls = [("z", 36.2, 72.7, 76.2, -1), ("x", 76.2, 30.6, 36.2, -1), ("z", 34.0, 72.7, 74.0, 1), ("x", 74.0, 30.6, 34.0, 1)]
    for axis, at, a, b_, s in walls:
        n = max(2, round((b_ - a) / 0.6))
        for j in range(n):
            u0, u1 = a + (b_ - a) * j / n, a + (b_ - a) * (j + 1) / n
            d0, d1 = 0.08 * _noise(u0, at, 7), 0.08 * _noise(u1, at, 7)
            if axis == "z":
                pts = [(u0, 0.0, at + s * d0), (u1, 0.0, at + s * d1), (u1, 3.2, at + s * d1), (u0, 3.2, at + s * d0)]
                facing(b, ROCKD if j % 3 else ROCK, pts, (0.0, 0.0, float(s)))
            else:
                pts = [(at + s * d0, 0.0, u0), (at + s * d1, 0.0, u1), (at + s * d1, 3.2, u1), (at + s * d0, 3.2, u0)]
                facing(b, ROCKD if j % 3 else ROCK, pts, (float(s), 0.0, 0.0))
    # the flume chute down the west face into the splash pool, its trestles
    (ax, ay, az), (cx, cy, cz) = CHUTE
    W = P["plank"]
    n = 10
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        p0 = (ax + (cx - ax) * t0, ay + (cy - ay) * t0, az)
        p1 = (ax + (cx - ax) * t1, ay + (cy - ay) * t1, az)
        b.bar(W, p0, p1, 1.4, 0.12)
        for s in (-1, 1):
            b.bar(W, (p0[0], p0[1] + 0.35, p0[2] + s * 0.7), (p1[0], p1[1] + 0.35, p1[2] + s * 0.7), 0.1, 0.7)
    for t in (0.35, 0.7):
        x, y = ax + (cx - ax) * t, ay + (cy - ay) * t
        for s in (-1, 1):
            b.bar(W, (x, 0, az + s * 0.8), (x, y, az + s * 0.7), 0.16)
        b.bar(W, (x, y * 0.5, az - 0.8), (x, y * 0.5, az + 0.8), 0.1)
    b.lump(P["black"], 2.2, 2.0, 1.2, ax + 0.4, ay - 0.6, az, seed=5, rnd=0.7, jitter=0.05, n=2)
    # cave mouths: rough jambs and lintels
    for (mx, mz, w, ry) in ((72.6, 35.1, 2.4, math.pi / 2), (75.1, 30.5, 2.4, 0.0), (82.0, 31.5, 3.4, 0.0)):
        for s in (-1, 1):
            ox, oz = (math.cos(ry) * s * (w / 2 + 0.3), -math.sin(ry) * s * (w / 2 + 0.3))
            b.lump(ROCKD, 0.9, 3.6, 0.9, mx + ox, 0, mz + oz, seed=int(mx * 10 + s), rnd=0.5, jitter=0.1, n=2)
        b.lump(ROCKD, w + 1.4, 1.0, 1.0, mx, 3.0, mz, seed=int(mz * 10), rnd=0.5, jitter=0.1, ry=ry, n=2)
    # frosted pines on the shoulders, standing on the rock
    for (tx, tz, th) in ((74.0, 38.5, 3.2), (75.6, 43.0, 3.8), (78.2, 33.4, 3.0), (84.5, 33.5, 3.4), (85.8, 41.0, 4.0),
                         (82.8, 43.6, 3.5), (77.5, 44.2, 3.0), (86.0, 37.4, 3.6)):
        base = (_rock_top(cells, tx, tz)[0] or 0.0) - 0.1
        b.cyl(P["wood_dk"], 0.12, (tx, base, tz), (tx, base + 0.8, tz), seg=6)
        for k in range(4):
            y = base + 0.6 + k * th * 0.22
            r = th * 0.32 * (1 - k * 0.2)
            b.cyl(P["pine"], r, (tx, y, tz), (tx, y + th * 0.34, tz), seg=8, r2=0.02)
            b.cyl(SNOW, r * 0.55, (tx, y + th * 0.17, tz), (tx, y + th * 0.34, tz), seg=8, r2=0.02)
    R.end()
    b.finish("hg-mountain.glb")


SKULL_SOURCE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "studio", "hollowgrin", "skull.glb")
SKULL_SCALE = 1.6
SKULL_BASE = 12.7                     # the jaw's foot, 0.4 m into the peak's rock


def build_skull(P, R):
    """The skull on Skull Mountain's peak is Studio's (the doc's hero pick:
    generate_mesh, a weathered bone skull with moss in its cracks), scaled,
    turned to the plaza (SKULL's yaw) and set into the peak, plus the bake's
    UV set, as hg-skull.glb. hollowgrin.js keeps its eyes' red glow."""
    import bpy
    from tf_kit import Report, bounds, lightmap_uv
    sx, _sy, sz, yaw = SKULL
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=SKULL_SOURCE)
    ob = [o for o in bpy.data.objects if o not in before and o.type == "MESH"][0]
    ob.name = "hg-skull"
    for m in ob.data.materials:
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image and n.image.size[0] > 512:
                n.image.scale(512, 512)
    # its face (game -z) turned to face (sin yaw, cos yaw), as SKULL's frame
    ob.rotation_euler = (0.0, 0.0, math.atan2(-math.sin(yaw), -math.cos(yaw)))
    ob.scale = (SKULL_SCALE,) * 3
    ob.location = (sx, -sz, SKULL_BASE)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    lightmap_uv(ob)
    game = [(v.co.x, v.co.z, -v.co.y) for v in ob.data.vertices]
    R.prop("park:skull", [min(p[k] for p in game) for k in range(3)], [max(p[k] for p in game) for k in range(3)], on="park:mountain")
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hg-skull.glb")
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_yup=True,
                              export_image_format="JPEG", export_jpeg_quality=85, export_apply=True)
    lo, hi = bounds(ob)
    Report.rows.append(["hg-skull", len(ob.data.polygons), len(ob.data.vertices), 0, lo, hi])
    bpy.data.objects.remove(ob)


# ------------------------------------------------------------------ The Grinder and the Drop of Doom
# hollowgrin.js keeps the track (it is the train's curve), its supports, the
# moving train and the drop ring, the words, bulbs and every collider.

STATION = dict(x0=55.5, x1=68.5, zN=-20.9, zS=-16.1, y=1.2)      # hollowgrin.js buildCoaster
COASTER_DECK = dict(x0=80.2, x1=83.2, z0=-37.2, z1=-30.4, y=9.0)
COASTER_STAIR = dict(x0=81.6, x1=82.8, z_foot=-21.4, steps=30, rise=0.3, run=0.3)
COASTER_TOWER = (85.0, -43.5, 30.0)
QUEUE = [(-22.6, 57.5, 68.5), (-24.0, 55.5, 66.5), (-25.4, 57.5, 68.5)]


def ibeam(b, m, x, z, y0, y1, w=0.25):
    """A steel post: an H section (two flanges and the web)."""
    for s in (-1, 1):
        b.box(m, w, y1 - y0, 0.04, x, y0, z + s * (w / 2 - 0.02))
    b.box(m, 0.04, y1 - y0, w - 0.08, x, y0, z)


def rails_round(b, P, pts, y, posts_every=1.0, m="yellow"):
    """A two-rail guard along the polyline pts at height y: posts, rails."""
    for (ax, az), (bx, bz) in zip(pts, pts[1:]):
        L = math.hypot(bx - ax, bz - az)
        n = max(1, round(L / posts_every))
        for k in range(n + 1):
            b.box(P[m], 0.06, 1.05, 0.06, ax + (bx - ax) * k / n, y, az + (bz - az) * k / n)
        for yy in (0.5, 1.0):
            b.bar(P[m], (ax, y + yy, az), (bx, y + yy, bz), 0.05)


def build_coaster(P, R):
    """The Grinder's station, queue maze and brake deck, and the Drop of
    Doom's mast (phase 4)."""
    b = HGBuilder()
    S = STATION
    cx, w = (S["x0"] + S["x1"]) / 2, S["x1"] - S["x0"]
    TEAL = P["teal"]
    R.begin(b, "park:station")
    # the platforms: planked decks on a dark frame, a yellow edge on the track side
    for zc, edge in ((-20.15, -19.43), (-16.85, -17.57)):
        b.box(P["wood_dk"], w, S["y"] - 0.06, 1.5, cx, 0.0, zc)
        n = round(w / 0.3)
        for k in range(n):
            b.box(P["plank"] if k % 2 else P["deck"], w / n - 0.015, 0.06, 1.5, S["x0"] + (k + 0.5) * w / n, S["y"] - 0.06, zc)
        b.box(P["yellow"], w, 0.02, 0.14, cx, S["y"], edge)
        for k in range(3):              # the steps up from the west end
            b.box(P["plank"], 0.4, 0.3 * (k + 1), 1.5, S["x0"] - 0.2 - (2 - k) * 0.4, 0.0, zc)
    # steel posts and a gabled roof with trusses under it
    for z in (S["zN"], S["zS"]):
        for x in (S["x0"] + 0.2, cx, S["x1"] - 0.2):
            ibeam(b, P["steel_dk"], x, z, 0.0, 4.2)
    b.box(P["steel_dk"], w + 0.6, 0.25, 5.6, cx, 4.2, -18.5)
    b.box(TEAL, w + 0.7, 0.35, 5.7, cx, 4.45, -18.5)
    for s in (-1, 1):                   # the roof slopes, standing-seam
        z_e, z_r = -18.5 + s * 2.85, -18.5
        facing(b, P["slate"], [(S["x0"] - 0.35, 4.8, z_e), (S["x1"] + 0.35, 4.8, z_e), (S["x1"] + 0.35, 5.7, z_r), (S["x0"] - 0.35, 5.7, z_r)], (0.0, 1.0, s * 0.5))
        for k in range(int(w / 0.6) + 1):
            x = S["x0"] - 0.3 + k * 0.6
            b.bar(P["slate_dk"], (x, 4.83, z_e), (x, 5.73, z_r), 0.03, 0.03)
    for x in (S["x0"] - 0.35, S["x1"] + 0.35):
        facing(b, TEAL, [(x, 4.8, -21.35), (x, 4.8, -15.65), (x, 5.7, -18.5)], (1.0 if x > cx else -1.0, 0.0, 0.0))
    for x in (S["x0"] + 0.2, cx, S["x1"] - 0.2, (S["x0"] + cx) / 2, (cx + S["x1"]) / 2):
        b.bar(P["steel_dk"], (x, 4.15, S["zN"]), (x, 4.15, S["zS"]), 0.12, 0.18)      # tie beam
        b.bar(P["steel_dk"], (x, 4.15, S["zN"] + 0.6), (x, 3.65, -18.5), 0.06)        # struts down to a king post
        b.bar(P["steel_dk"], (x, 4.15, S["zS"] - 0.6), (x, 3.65, -18.5), 0.06)
        b.bar(P["steel_dk"], (x, 3.65, -18.5), (x, 4.15, -18.5), 0.06)
    # the sign backers above the eaves, just behind the JS's THE GRINDER
    for z in (-21.27, -15.73):
        b.box(TEAL, 6.8, 0.95, 0.06, cx, 4.75, z)
        for y0 in (4.73, 5.68):
            b.box(P["gold"], 6.86, 0.04, 0.08, cx, y0, z)
    # gold gate rails along the platforms' track edges
    for z in (-19.45, -17.55):
        b.box(P["gold"], w, 0.06, 0.06, cx, S["y"] + 0.92, z)
        x = S["x0"] + 0.5
        while x < S["x1"]:
            b.box(P["gold"], 0.05, 0.95, 0.05, x, S["y"], z)
            x += 1.3
    R.end()
    R.face("park:grinder-sign-n", "park:station", (cx, 5.2, -21.33), (0.0, 0.0, -1.0), 6.4, 0.8)
    R.face("park:grinder-sign-s", "park:station", (cx, 5.2, -15.67), (0.0, 0.0, 1.0), 6.4, 0.8)
    # the queue maze: iron rails and posts (the bulbs on them are the JS's)
    R.begin(b, "park:queue")
    for z, a, b_ in QUEUE:
        x = a
        while x <= b_ + 0.01:
            b.box(P["iron"], 0.08, 1.05, 0.08, x, 0.0, z)
            x += 2.2
        for y in (0.5, 0.95):
            b.box(P["iron"], b_ - a, 0.05, 0.05, (a + b_) / 2, y, z)
    R.end()
    # the brake deck at 9 m: a braced steel frame, planks, rails, its stair
    D, ST = COASTER_DECK, COASTER_STAIR
    dcx, dcz = (D["x0"] + D["x1"]) / 2, (D["z0"] + D["z1"]) / 2
    dw, dd = D["x1"] - D["x0"], D["z1"] - D["z0"]
    R.begin(b, "park:brakedeck")
    for x in (D["x0"] + 0.15, D["x1"] - 0.15):
        for z in (D["z0"] + 0.15, D["z1"] - 0.15):
            ibeam(b, P["steel_dk"], x, z, 0.0, D["y"] - 0.25, w=0.24)
    for y0 in (0.3, 3.2, 6.1):          # X bracing between the legs, three bays
        y1 = y0 + 2.8
        for x in (D["x0"] + 0.15, D["x1"] - 0.15):
            b.bar(P["steel_dk"], (x, y0, D["z0"] + 0.15), (x, y1, D["z1"] - 0.15), 0.06)
            b.bar(P["steel_dk"], (x, y0, D["z1"] - 0.15), (x, y1, D["z0"] + 0.15), 0.06)
        for z in (D["z0"] + 0.15, D["z1"] - 0.15):
            b.bar(P["steel_dk"], (D["x0"] + 0.15, y0, z), (D["x1"] - 0.15, y1, z), 0.06)
            b.bar(P["steel_dk"], (D["x1"] - 0.15, y0, z), (D["x0"] + 0.15, y1, z), 0.06)
    b.box(P["steel_dk"], dw, 0.18, dd, dcx, D["y"] - 0.25, dcz)
    n = round(dd / 0.3)
    for k in range(n):
        b.box(P["plank"] if k % 2 else P["deck"], dw, 0.07, dd / n - 0.015, dcx, D["y"] - 0.07, D["z0"] + (k + 0.5) * dd / n)
    rails_round(b, P, [(D["x0"], D["z1"]), (D["x0"], D["z0"]), (D["x1"], D["z0"]), (D["x1"], D["z1"])], D["y"])
    rails_round(b, P, [(D["x1"], D["z1"]), (ST["x1"], D["z1"])], D["y"])
    rails_round(b, P, [(ST["x0"], D["z1"]), (D["x0"], D["z1"])], D["y"])
    sx, sw = (ST["x0"] + ST["x1"]) / 2, ST["x1"] - ST["x0"]
    z_top = ST["z_foot"] - ST["run"] * ST["steps"]
    y_top = ST["rise"] * ST["steps"]
    for i in range(ST["steps"]):
        top = ST["rise"] * (i + 1)
        b.box(P["plank"], sw - 0.08, 0.06, ST["run"] + 0.02, sx, top - 0.06, ST["z_foot"] - ST["run"] * (i + 0.5))
    for x in (ST["x0"] + 0.03, ST["x1"] - 0.03):
        b.bar(P["steel_dk"], (x, -0.1, ST["z_foot"] + 0.1), (x, y_top - 0.05, z_top), 0.06, 0.3)
        b.bar(P["yellow"], (x, 1.0, ST["z_foot"]), (x, y_top + 1.0, z_top), 0.04)
        for k in range(0, ST["steps"] + 1, 5):
            b.box(P["yellow"], 0.04, 1.0, 0.04, x, ST["rise"] * k, ST["z_foot"] - ST["run"] * k)
    for k in range(1, 6):               # props under the flight
        zk = ST["z_foot"] - ST["run"] * ST["steps"] * k / 6
        yk = y_top * k / 6
        for x in (ST["x0"] + 0.03, ST["x1"] - 0.03):
            b.box(P["steel_dk"], 0.1, yk - 0.2, 0.1, x, 0.0, zk)
    b.cyl(P["steel_dk"], 0.06, (D["x1"] - 0.3, D["y"], D["z0"] + 0.3), (D["x1"] - 0.3, D["y"] + 2.6, D["z0"] + 0.3), seg=6, r2=0.05)
    b.box(P["black"], 0.46, 0.36, 0.12, D["x1"] - 0.3, D["y"] + 2.42, D["z0"] + 0.42)
    b.box(P["steel_dk"], sw - 0.1, 0.02, ST["run"] * ST["steps"], sx, 0.0, ST["z_foot"] - ST["run"] * ST["steps"] / 2)
    R.end()
    # the Drop of Doom: a stepped plinth, a braced lattice mast, the machine house
    tx, tz, H = COASTER_TOWER
    R.begin(b, "park:droptower")
    b.box(P["conc"], 3.2, 1.0, 3.2, tx, 0.0, tz)
    b.box(P["conc"], 3.6, 0.2, 3.6, tx, 0.0, tz)
    for dx, dz in ((-0.7, -0.7), (0.7, -0.7), (-0.7, 0.7), (0.7, 0.7)):
        b.cyl(P["steel"], 0.12, (tx + dx, 1.0, tz + dz), (tx + dx, H, tz + dz), seg=8, r2=0.1)
        b.box(P["steel_dk"], 0.36, 0.1, 0.36, tx + dx, 1.0, tz + dz)
    corners = [(-0.7, -0.7), (0.7, -0.7), (0.7, 0.7), (-0.7, 0.7)]
    for y in range(2, int(H), 2):
        for i in range(4):
            (ax, az), (bx, bz) = corners[i], corners[(i + 1) % 4]
            b.cyl(P["steel"], 0.035, (tx + ax, y, tz + az), (tx + bx, y + 2, tz + bz), seg=4, caps=False)
            b.cyl(P["steel"], 0.035, (tx + bx, y, tz + bz), (tx + ax, y + 2, tz + az), seg=4, caps=False)
            if y % 6 == 0:
                b.cyl(P["steel_dk"], 0.04, (tx + ax, y, tz + az), (tx + bx, y, tz + bz), seg=4, caps=False)
    b.box(TEAL, 2.6, 0.6, 2.6, tx, H, tz)
    b.box(P["gold"], 2.7, 0.06, 2.7, tx, H + 0.6, tz)
    b.box(P["steel_dk"], 1.6, 0.9, 1.6, tx, H + 0.66, tz)               # the winch house
    b.cyl(TEAL, 0.9, (tx, H + 1.56, tz), (tx, H + 2.4, tz), seg=8, r2=0.2)
    b.cyl(P["red"], 0.05, (tx, H + 2.4, tz), (tx, H + 3.4, tz), seg=6)
    turn(b, P["red"], tx, tz, [(0.0, 0.0), (0.12, 0.08), (0.0, 0.2)], seg=8, y0=H + 3.35)
    # the sign's backer on the mast (the JS lays DROP OF DOOM on it)
    b.box(P["black"], 2.5, 0.6, 0.06, tx, H - 1.7, tz + 1.26)
    for s in (-1, 1):
        b.bar(P["steel_dk"], (tx + s * 0.9, H - 1.4, tz + 1.23), (tx + s * 0.7, H - 1.4, tz + 0.7), 0.05)
    R.end()
    R.face("park:drop-sign", "park:droptower", (tx, H - 1.4, tz + 1.33), (0.0, 0.0, 1.0), 2.4, 0.5)
    b.finish("hg-coaster.glb")
