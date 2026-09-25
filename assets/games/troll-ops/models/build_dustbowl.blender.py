"""
Troll Ops — Dust Bowl (desert village) models, headless Blender.

Run with:
  blender --background --python build_dustbowl.blender.py

Writes db-*.glb into this folder. Each model covers one zone of the map and
is authored in MAP coordinates (placed at 0,0), sized from the approved
blockout's colliders in maps.js (MAPS.dustbowl): change one, change the other.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
import math  # noqa: E402
import random  # noqa: E402
from mathutils import Vector  # noqa: E402


def adobe_details(b, P, cx, cz, w, d, h, doors, rng, vigas=True, windows=True):
    """Beam ends under the roof line, small shuttered windows, a plinth."""
    t = 0.5
    if vigas:
        for side, (sx, sz, along, L) in {"n": (cx, cz - d / 2, "x", w), "s": (cx, cz + d / 2, "x", w)}.items():
            k = -L / 2 + 0.6
            out = -1 if side == "n" else 1
            while k < L / 2 - 0.4:
                b.cyl(P["timber"], 0.09, (sx + k, h - 0.35, sz), (sx + k, h - 0.35, sz + out * 0.35), seg=6)
                k += 0.9
    if windows:
        for side, (sx, sz, along, L) in {"n": (cx, cz - d / 2, "x", w), "s": (cx, cz + d / 2, "x", w),
                                          "w": (cx - w / 2, cz, "z", d), "e": (cx + w / 2, cz, "z", d)}.items():
            if L < 5:
                continue
            for off in (-L / 4 - 0.3, L / 4 + 0.3):
                if side in doors and abs(off) < doors[side] / 2 + 0.9:
                    continue
                if rng.random() < 0.3:
                    continue
                out = 0.02
                if along == "x":
                    zz = sz + (out if side == "s" else -out)
                    b.box(P["black"], 0.55, 0.75, 0.04, sx + off, 1.5, zz)
                    b.box(P["timber"], 0.7, 0.08, 0.1, sx + off, 1.42, zz)
                    b.box(P["timber"], 0.7, 0.08, 0.1, sx + off, 2.25, zz)
                    for so in (-1, 1):
                        b.box(P["timber"], 0.3, 0.75, 0.04, sx + off + so * 0.45, 1.5, zz + (0.03 if side == "s" else -0.03),
                              ry=so * (0.5 if side == "s" else -0.5))
                else:
                    xx = sx + (out if side == "e" else -out)
                    b.box(P["black"], 0.04, 0.75, 0.55, xx, 1.5, sz + off)
                    b.box(P["timber"], 0.1, 0.08, 0.7, xx, 1.42, sz + off)
                    b.box(P["timber"], 0.1, 0.08, 0.7, xx, 2.25, sz + off)
    # a darker plinth where the walls meet the ground
    for (bw, bd, bx, bz) in ((w + 0.06, t + 0.06, cx, cz - d / 2 + t / 2), (w + 0.06, t + 0.06, cx, cz + d / 2 - t / 2),
                             (t + 0.06, d, cx - w / 2 + t / 2, cz), (t + 0.06, d, cx + w / 2 - t / 2, cz)):
        pass


def roof_parapet(b, P, cx, cz, w, d, y, h=0.35, t=0.25):
    """Low rounded-top parapet round a flat roof (decorative)."""
    for (bw, bd, bx, bz) in ((w, t, cx, cz - d / 2 + t / 2), (w, t, cx, cz + d / 2 - t / 2),
                             (t, d, cx - w / 2 + t / 2, cz), (t, d, cx + w / 2 - t / 2, cz)):
        b.box(P["plaster"], bw, h, bd, bx, y, bz)
        b.box(P["plaster"], bw + 0.04, 0.08, bd + 0.04, bx, y + h, bz, bevel=0.03)


def house(b, P, cx, cz, w, d, h, gaps, rng, dark=False):
    m = P["plaster_dk"] if dark else P["plaster"]
    walls_geo(b, m, cx, cz, w, d, h, 0.5, gaps, fill_above=2.35, lintel=P["timber"])
    adobe_details(b, P, cx, cz, w, d, h, gaps, rng)


# --------------------------------------------------------------- perimeter

def build_perimeter(P):
    """Compound wall: walls(0, 0, 72, 72, 5, 1.6)."""
    b = Builder()
    m = P["plaster_dk"]
    for s in (-1, 1):
        b.box(m, 72, 5, 1.6, 0, 0, s * 35.2)
        b.box(m, 1.6, 5, 68.8, s * 35.2, 0, 0)
    rng = random.Random(3)
    # stepped merlons along the top, stone plinth and water spouts inside
    k = -35.4
    while k <= 35.41:
        for s in (-1, 1):
            hh = rng.uniform(0.3, 0.45)
            b.box(m, 0.9, hh, 1.2, k, 5, s * 35.2)
            b.box(m, 1.2, hh, 0.9, s * 35.2, 5, k)
        k += 1.8
    for s in (-1, 1):
        b.box(P["stone"], 68.8, 0.45, 0.12, 0, 0, s * 34.36)
        b.box(P["stone"], 0.12, 0.45, 68.8, s * 34.36, 0, 0)
        k = -30.0
        while k <= 30.01:
            b.cyl(P["timber"], 0.08, (k, 4.6, s * 34.4), (k, 4.55, s * 33.9), seg=6)
            b.cyl(P["timber"], 0.08, (s * 34.4, 4.6, k), (s * 33.9, 4.55, k), seg=6)
            k += 7.5
    b.finish("db-perimeter.glb")


# ------------------------------------------------------------------- north

ROCKS = [(-24, -19, 5, 3, 2.2), (-16, -25, 4, 3, 1.6), (-6, -21, 3, 4, 2.4), (6, -23, 5, 3, 1.8),
         (14, -22, 3, 3, 2.6), (18, -27, 4, 3, 2.0), (31, -19, 3, 3, 1.4), (-31, -19, 3, 3, 1.8)]
BOULDERS = [(-10, -30, 1.2, 1.2), (9, -17, 1.4, 1.3), (-15, 25, 1.2, 1.1), (18, 26, 1.2, 1.1)]


def build_north(P):
    """Rock ridge, wrecked truck, the two walled courtyards."""
    b = Builder()
    rng = random.Random(11)
    for i, (x, z, w, d, h) in enumerate(ROCKS):
        # a main outcrop filling the collider, plus a couple of shoulder stones
        b.lump(P["rock"], w * 1.04, h * 1.02, d * 1.04, x, 0, z, seed=i, rnd=0.12, jitter=0.16)
        for k in range(2):
            sx = x + rng.choice((-1, 1)) * (w / 2 + rng.uniform(0.0, 0.3))
            sz = z + rng.uniform(-d / 3, d / 3)
            b.lump(P["rock"], rng.uniform(0.6, 1.0), rng.uniform(0.35, 0.6), rng.uniform(0.6, 1.0), sx, 0, sz, seed=100 + i * 3 + k)
    for i, (x, z, r, h) in enumerate(BOULDERS[:2]):
        b.lump(P["rock"], r * 2.05, h * 1.02, r * 2.05, x, 0, z, seed=50 + i, rnd=0.35, jitter=0.14)
    for i in range(26):
        x = rng.uniform(-30, 30)
        z = rng.uniform(-33, -15)
        s = rng.uniform(0.2, 0.45)
        b.lump(P["rock"], s * 1.4, s * 0.6, s, x, 0, z, seed=200 + i, ry=rng.uniform(0, 3))

    # wrecked truck: bed box (-1,-28) 6 x 2.4 x 2.2, cab (3.5,-28) 2 x 2.4 x 2.8
    z0 = -28.0
    for sz in (-0.75, 0.75):
        b.box(P["dark"], 8.4, 0.25, 0.18, 0.2, 0.55, z0 + sz)
    b.box(P["rust"], 6.0, 0.18, 2.4, -1, 0.95, z0)
    for sz in (-1.15, 1.15):
        b.box(P["rust"], 6.0, 0.9, 0.08, -1, 1.12, z0 + sz)
        for x in (-3.4, -1.9, -0.4, 1.1):
            b.box(P["dark"], 0.1, 0.95, 0.12, x, 1.1, z0 + sz)
    b.box(P["rust"], 0.08, 0.9, 2.4, 1.95, 1.12, z0)
    b.box(P["rust"], 0.08, 0.9, 2.3, -4.35, 0.45, z0, rz=-0.9)
    b.lump(P["cloth_cream"], 5.4, 1.15, 2.2, -1.1, 1.05, z0, seed=5, rnd=0.25, jitter=0.06)
    for i, x in enumerate((-3.2, -1.2, 0.8)):
        b.box(P["black"], 0.05, 0.05, 2.3, x, 2.1, z0)
    b.box(P["rust"], 2.0, 1.25, 2.3, 3.5, 0.75, z0, bevel=0.06)
    b.box(P["rust"], 1.4, 0.8, 2.3, 3.65, 2.0, z0, bevel=0.05)
    b.box(P["glass"], 0.05, 0.55, 2.0, 4.36, 2.1, z0, rz=0.18)
    b.box(P["black"], 1.2, 0.5, 2.34, 3.6, 2.1, z0)
    b.box(P["dark"], 0.18, 0.45, 2.4, 4.5, 0.55, z0)
    b.box(P["rust"], 0.9, 0.08, 2.35, 3.95, 1.98, z0, rz=-0.08)
    for (x, sz, r) in ((-3.0, 1.05, 0.5), (-3.0, -1.05, 0.5), (-1.9, 1.05, 0.5), (3.6, -1.05, 0.52)):
        b.cyl(P["tyre"], r, (x, r, z0 + sz - 0.14), (x, r, z0 + sz + 0.14), seg=14)
        b.cyl(P["dark"], r * 0.5, (x, r, z0 + sz - 0.15), (x, r, z0 + sz + 0.15), seg=10)
    b.cyl(P["tyre"], 0.52, (5.5, 0.14, -25.8), (5.5, 0.42, -25.8), seg=14)

    # courtyards: walls(cx, -28, 10, 10, 2.5, 0.6), gates e|w and s, arches over them
    for cx in (-27, 27):
        side = "e" if cx < 0 else "w"
        walls_geo(b, P["plaster"], cx, -28, 10, 10, 2.5, 0.6, {side: 3, "s": 3})
        k = -4.7
        while k <= 4.71:
            for sgn in (-1, 1):
                if not (abs(k) < 1.7):
                    b.box(P["plaster"], 0.5, rng.uniform(0.12, 0.22), 0.66, cx + k, 2.5, -28 + sgn * 4.7)
                    b.box(P["plaster"], 0.66, rng.uniform(0.12, 0.22), 0.5, cx + sgn * 4.7, 2.5, -28 + k)
                elif sgn < 0:
                    b.box(P["plaster"], 0.5, 0.18, 0.66, cx + k, 2.5, -32.7)
                    b.box(P["plaster"], 0.66, 0.18, 0.5, cx - (4.7 if cx < 0 else -4.7), 2.5, -28 + k)
            k += 0.55
        arch(b, P["plaster_dk"], cx, -23.3, 3.0, 0.7, 2.5, along="x")
        arch(b, P["plaster_dk"], cx + (4.7 if cx < 0 else -4.7), -28, 3.0, 0.7, 2.5, along="z")
        # inside: palm, a laundry line, water jars
        px = cx + (-3.5 if cx < 0 else 3.5)
        palm(b, P, px, -25.0, h=5.8, lean=(0.5 if cx < 0 else -0.5, -0.3), seed=cx)
        wall_x = cx + (-4.4 if cx < 0 else 4.4)
        b.cyl(P["black"], 0.01, (wall_x, 2.1, -32.4), (cx, 2.05, -32.4), seg=4, smooth=False)
        for i in range(4):
            x = wall_x + (0.6 + i * 0.95) * (1 if cx < 0 else -1)
            col = (P["cloth_red"], P["cloth_cream"], P["cloth_blue"], P["cloth_green"])[i]
            b.box(col, 0.6, 0.7, 0.02, x, 1.38, -32.4)
        for i in range(3):
            jx = cx + (2.8 if cx < 0 else -2.8) + i * 0.55 * (1 if cx < 0 else -1)
            b.cyl(P["terracotta"], 0.22, (jx, 0, -32.1), (jx, 0.45, -32.1), seg=10, r2=0.28)
            b.cyl(P["terracotta"], 0.28, (jx, 0.45, -32.1), (jx, 0.75, -32.1), seg=10, r2=0.12)
    b.finish("db-north.glb")


# ------------------------------------------------------------------ centre

def build_centre(P):
    """Two-storey house (0,-4) with its interior stair and roof, plus the minaret."""
    b = Builder()
    rng = random.Random(21)
    m = P["plaster"]
    walls_geo(b, m, 0, -4, 10, 8, 3.2, 0.5, {"n": 1.6, "s": 1.6, "e": 1.6}, fill_above=2.4, lintel=P["timber"])
    adobe_details(b, P, 0, -4, 10, 8, 3.2, {"n": 1.6, "s": 1.6, "e": 1.6}, rng)
    # stair: api.stairs(-3.5, -0.9, 1.6, 11, 0.318, 0.55, "-z")
    for i in range(11):
        b.box(P["plaster_dk"], 1.6, 0.318 * (i + 1), 0.55, -3.5, 0, -0.9 - 0.55 * (i + 0.5))
        b.box(P["timber"], 1.6, 0.04, 0.06, -3.5, 0.318 * (i + 1) - 0.02, -0.9 - 0.55 * i - 0.03)
    # roof in four pieces round the stairwell, y 3.2..3.5
    for (x0, x1, z0, z1) in ((-5, -4.3, -8, 0), (-2.7, 5, -8, 0), (-4.3, -2.7, -8, -6.95), (-4.3, -2.7, -0.9, 0)):
        b.box(P["plaster_dk"], x1 - x0, 0.3, z1 - z0, (x0 + x1) / 2, 3.2, (z0 + z1) / 2)
    for (x, z, w, d) in ((0, -7.85, 10, 0.3), (0, -0.15, 10, 0.3), (-4.85, -4, 0.3, 8), (4.85, -4, 0.3, 8)):
        b.box(m, w, 0.9, d, x, 3.5, z)
        b.box(m, w + 0.06, 0.08, d + 0.06, x, 4.4, z, bevel=0.03)
    # merlon bumps on the parapet corners, a water tank and a rug on the roof
    for (x, z) in ((-4.85, -7.85), (4.85, -7.85), (-4.85, -0.15), (4.85, -0.15)):
        b.box(m, 0.5, 0.4, 0.5, x, 4.4, z, bevel=0.05)
    b.cyl(P["dark"], 0.45, (3.6, 3.5, -6.6), (3.6, 4.4, -6.6), seg=12)
    b.box(P["cloth_red"], 2.0, 0.01, 1.4, 1.0, 3.5, -3.5)
    b.box(P["cloth_cream"], 1.6, 0.012, 1.0, 1.0, 3.5, -3.5)
    # inside: rug, low table, cushions, shelf with jars (small, no colliders)
    b.box(P["cloth_red"], 3.0, 0.01, 2.2, 1.6, 0, -4.2)
    b.box(P["cloth_blue"], 2.4, 0.012, 1.6, 1.6, 0, -4.2)
    b.box(P["timber"], 1.0, 0.35, 0.6, 1.6, 0, -4.2)
    for (x, z) in ((0.6, -4.2), (2.6, -4.2)):
        b.lump(P["cloth_green"], 0.55, 0.25, 0.55, x, 0, z, seed=int(x * 10))
    b.box(P["timber"], 2.2, 0.06, 0.35, 1.5, 1.5, -7.33)
    for i in range(4):
        b.cyl(P["terracotta"], 0.1, (0.6 + i * 0.55, 1.56, -7.33), (0.6 + i * 0.55, 1.85, -7.33), seg=8, r2=0.06)

    # minaret: cylinder collider r 1.5, h 12 at (6.5, -10.5)
    mx, mz = 6.5, -10.5
    b.cyl(P["plaster_lt"], 1.52, (mx, 0, mz), (mx, 9.0, mz), seg=8, r2=1.32, smooth=False)
    for y in (3.0, 6.0):
        b.cyl(P["plaster_dk"], 1.58 - y * 0.022, (mx, y, mz), (mx, y + 0.25, mz), seg=8, smooth=False)
    b.cyl(P["plaster_dk"], 1.95, (mx, 9.0, mz), (mx, 9.3, mz), seg=8, smooth=False)
    for k in range(16):
        a = 2 * math.pi * k / 16
        b.box(P["plaster_dk"], 0.12, 0.9, 0.12, mx + math.cos(a) * 1.85, 9.3, mz + math.sin(a) * 1.85)
    b.cyl(P["plaster_dk"], 1.9, (mx, 10.2, mz), (mx, 10.32, mz), seg=16, r2=1.9)
    b.cyl(P["plaster_lt"], 1.0, (mx, 9.3, mz), (mx, 12.0, mz), seg=8, smooth=False)
    b.cyl(P["plaster_dk"], 1.12, (mx, 12.0, mz), (mx, 12.3, mz), seg=8, smooth=False)
    for i in range(6):
        y0 = 12.3 + i * 0.2
        r0 = 1.0 * math.cos(math.pi / 2 * i / 6)
        r1 = 1.0 * math.cos(math.pi / 2 * (i + 1) / 6)
        b.cyl(P["plaster_lt"], max(r0, 0.02), (mx, y0, mz), (mx, y0 + 0.2, mz), seg=12, r2=max(r1, 0.02))
    b.cyl(P["timber"], 0.03, (mx, 13.4, mz), (mx, 14.3, mz), seg=6)
    b.lump(P["yellow"], 0.18, 0.18, 0.18, mx, 13.9, mz, seed=1, rnd=0.9)
    for k in range(4):
        a = 2 * math.pi * k / 4 + math.pi / 8
        for y in (2.0, 5.0, 7.6):
            b.box(P["black"], 0.3, 0.8, 0.3, mx + math.cos(a) * 1.43, y, mz + math.sin(a) * 1.43, ry=-a)
        b.box(P["black"], 0.3, 0.9, 0.3, mx + math.cos(a) * 0.92, 10.6, mz + math.sin(a) * 0.92, ry=-a)
    b.finish("db-centre.glb")


# ------------------------------------------------------------------ market

def stall(b, P, x, z, cloth, rng):
    """Stall (collider 2.6 x 1.4 x 1.1) with an awning over it."""
    b.box(P["plaster_dk"], 2.6, 0.9, 1.4, x, 0, z)
    b.box(P["plank"], 2.7, 0.08, 1.5, x, 0.9, z)
    for sx in (-1.25, 1.25):
        for sz in (-0.65, 0.65):
            b.box(P["timber"], 0.08, 2.35 if sz < 0 else 2.1, 0.08, x + sx, 0, z + sz)
    # striped awning, sloping down toward the street side (+z)
    for i in range(6):
        c = cloth if i % 2 == 0 else P["cloth_cream"]
        b.box(c, 0.46, 0.02, 1.9, x - 1.15 + i * 0.46, 2.22, z + 0.1, rx=-0.16)
    for i in range(6):
        b.box(cloth, 0.4, 0.25, 0.02, x - 1.15 + i * 0.46, 1.88, z + 1.06)
    # goods
    for i in range(3):
        gx = x - 0.8 + i * 0.8
        kind = rng.randrange(3)
        if kind == 0:
            b.box(P["plank"], 0.55, 0.3, 0.4, gx, 0.98, z - 0.1)
            for k in range(5):
                b.lump(P["orange"], 0.12, 0.12, 0.12, gx - 0.18 + k * 0.09, 1.25, z - 0.1 + (k % 2) * 0.08, seed=k)
        elif kind == 1:
            b.cyl(P["terracotta"], 0.16, (gx, 0.98, z), (gx, 1.3, z), seg=10, r2=0.2)
            b.cyl(P["terracotta"], 0.2, (gx, 1.3, z), (gx, 1.45, z), seg=10, r2=0.08)
        else:
            b.lump(P["cloth_cream"], 0.45, 0.4, 0.4, gx, 0.98, z, seed=k if False else i)
    b.box(P["plank"], 0.5, 0.35, 0.5, x + 1.5, 0, z + 0.3, ry=0.3)


def stone_wall(b, P, x, z, w, d, h, seed):
    """Dry-stone field wall filling a w x d x h collider, uneven top."""
    rng = random.Random(seed)
    along_x = w >= d
    L = w if along_x else d
    T = d if along_x else w
    n = max(2, int(L / 0.55))
    step = L / n
    for course, (y0, hh) in enumerate(((0, 0.42), (0.4, 0.4), (0.78, 0.36))):
        for i in range(n + (course % 2)):
            k = -L / 2 + step * (i + 0.5) - (step / 2 if course % 2 else 0)
            k = max(-L / 2 + step * 0.4, min(L / 2 - step * 0.4, k))
            sw = step * rng.uniform(0.95, 1.2)
            sh = hh * rng.uniform(0.9, 1.15)
            st = T * rng.uniform(0.9, 1.05)
            if along_x:
                b.lump(P["stone"], sw, sh, st, x + k, y0, z, seed=seed * 100 + course * 30 + i, rnd=0.3, jitter=0.07)
            else:
                b.lump(P["stone"], st, sh, sw, x, y0, z + k, seed=seed * 100 + course * 30 + i, rnd=0.3, jitter=0.07)


def build_market(P):
    b = Builder()
    rng = random.Random(31)
    for i, cx in enumerate((-16, 16)):
        house(b, P, cx, 0, 8, 6, 3, {"n": 2, "s": 2}, rng, dark=i == 1)
        b.box(P["plaster_dk"], 8.4, 0.3, 6.4, cx, 3, 0)
        roof_parapet(b, P, cx, 0, 8.4, 6.4, 3.3)
    for i, cx in enumerate((-22, -7, 8, 22)):
        house(b, P, cx, 14, 8, 4, 3, {"n": 2, "s": 2}, rng, dark=i % 2 == 0)
        b.box(P["plaster_dk"], 8.4, 0.3, 4.4, cx, 3, 14)
        roof_parapet(b, P, cx, 14, 8.4, 4.4, 3.3)
    cloths = (P["cloth_red"], P["cloth_blue"], P["cloth_green"], P["cloth_red"])
    for i, x in enumerate((-22, -9, 9, 22)):
        stall(b, P, x, 8, cloths[i], rng)
    # the well (0, 5.5), r 1, h 0.9: a stone ring, dark water, a winch frame
    for k in range(12):
        a = 2 * math.pi * k / 12
        b.lump(P["stone"], 0.6, 0.9, 0.45, math.cos(a) * 0.78, 0, 5.5 + math.sin(a) * 0.78, seed=400 + k,
               rnd=0.3, jitter=0.05, ry=-a)
    b.cyl(P["black"], 0.65, (0, 0.5, 5.5), (0, 0.52, 5.5), seg=16)
    for sx in (-0.95, 0.95):
        b.box(P["timber"], 0.12, 2.3, 0.12, sx, 0, 5.5)
    b.cyl(P["timber"], 0.07, (-1.0, 2.1, 5.5), (1.0, 2.1, 5.5), seg=8)
    b.cyl(P["black"], 0.01, (0.2, 2.05, 5.5), (0.2, 1.2, 5.5), seg=4, smooth=False)
    b.cyl(P["timber"], 0.14, (0.2, 0.95, 5.5), (0.2, 1.2, 5.5), seg=10, r2=0.17)
    # field walls
    for i, (x, z, w, d) in enumerate(((-26, -8, 6, 0.6), (26, -6, 0.6, 6), (-10, -12, 0.6, 5), (12, -13, 5, 0.6))):
        stone_wall(b, P, x, z, w, d, 1.1, seed=i + 1)
    # palms along the street (each gets a small trunk collider in maps.js)
    for i, (x, z) in enumerate(PALMS):
        palm(b, P, x, z, h=rng.uniform(5.2, 6.8), lean=(rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6)), seed=60 + i)
    # laundry strung across the street from roof to roof
    for (x0, x1) in ((-18.5, -19.5), (18.5, 19.5)):
        b.cyl(P["black"], 0.012, (x0, 3.15, 3.2), (x1, 3.15, 11.8), seg=4, smooth=False)
        for k in range(6):
            t = (k + 1) / 7
            px = x0 + (x1 - x0) * t
            pz = 3.2 + 8.6 * t
            col = (P["cloth_red"], P["cloth_cream"], P["cloth_blue"], P["cloth_green"], P["white"], P["cloth_red"])[k]
            b.box(col, 0.02, 0.65, 0.55, px, 2.45, pz, ry=0.12)
    # jars and sacks along house fronts
    for i in range(14):
        x = rng.uniform(-26, 26)
        z = rng.choice((3.35, 11.65))
        if any(abs(x - s) < 2.0 for s in (-22, -9, 9, 22, -16, 16, -7, 8)):
            continue
        if rng.random() < 0.5:
            b.cyl(P["terracotta"], 0.2, (x, 0, z), (x, 0.5, z), seg=10, r2=0.26)
            b.cyl(P["terracotta"], 0.26, (x, 0.5, z), (x, 0.8, z), seg=10, r2=0.1)
        else:
            b.lump(P["cloth_cream"], 0.5, 0.55, 0.4, x, 0, z, seed=500 + i)
    b.finish("db-market.glb")


PALMS = [(-14.5, 11.3), (15.0, 11.3), (-6.8, -10.4), (24.0, -2.5), (-24.0, -2.5)]


# ------------------------------------------------------------------- south

def build_south(P):
    """Riverbed: stone-faced banks, cracked mud floor, footbridge, steps."""
    b = Builder()
    rng = random.Random(41)
    BANK = 1.2
    gaps = [(-23.5, -20.5), (-8.5, -5.5), (6.5, 9.5), (20.5, 23.5)]
    frm = -34.4
    for (g0, g1) in gaps + [(34.4, 34.4)]:
        if g0 - frm > 0.1:
            b.box(P["stone"], g0 - frm, BANK, 3, (frm + g0) / 2, 0, 18.5)
            b.box(P["plaster"], g0 - frm, 0.05, 3.02, (frm + g0) / 2, BANK, 18.5)
        frm = g1
    b.box(P["stone"], 68.8, BANK, 4.4, 0, 0, 32.2)
    b.box(P["plaster"], 68.8, 0.05, 4.42, 0, BANK, 32.2)
    # cracked mud channel floor (plaster texture) between the banks
    b.box(P["plaster_dk"], 68.8, 0.02, 10.0, 0, 0, 25.0)
    for i in range(40):
        x = rng.uniform(-33, 33)
        z = rng.uniform(20.3, 29.7)
        if abs(x) < 2:
            continue
        s = rng.uniform(0.2, 0.5)
        b.lump(P["rock"], s * 1.3, s * 0.5, s, x, 0, z, seed=700 + i, ry=rng.uniform(0, 3))
    for i, (x, z, r, h) in enumerate(BOULDERS[2:]):
        b.lump(P["rock"], r * 2.05, h * 1.02, r * 2.05, x, 0, z, seed=60 + i, rnd=0.35, jitter=0.14)
    # dry grass along the bank tops
    for i in range(70):
        x = rng.uniform(-34, 34)
        z = rng.choice((rng.uniform(17.2, 19.8), rng.uniform(30.3, 34)))
        if any(g0 - 0.3 < x < g1 + 0.3 for g0, g1 in gaps) and z < 20:
            continue
        for k in range(3):
            a = rng.uniform(0, 6.28)
            tip = (x + math.cos(a) * 0.25, BANK + rng.uniform(0.35, 0.6), z + math.sin(a) * 0.25)
            b.cyl(P["palm_trunk"], 0.03, (x, BANK, z), tip, seg=3, r2=0.0, smooth=False)
    # footbridge: deck (0,25) 3 x 10 x 0.3 at y 1.2, posts at z 22/25/28, x +-1.3
    for i in range(40):
        z = 20.125 + i * 0.25
        b.box(P["plank"], 3.0, 0.08, 0.23, 0, BANK + 0.22, z, ry=rng.uniform(-0.02, 0.02))
    for sx in (-1.1, 1.1):
        b.box(P["timber"], 0.2, 0.22, 10.0, sx, BANK, 25.0)
    for sx in (-1.45, 1.45):
        b.box(P["timber"], 0.1, 0.1, 10.0, sx, BANK + 0.3, 25.0)
    for z in (22, 25, 28):
        for x in (-1.3, 1.3):
            b.cyl(P["timber"], 0.15, (x, 0, z), (x, BANK, z), seg=8)
    # stone steps
    runs = [(-30, 20 + 4 * 0.6, -1), (30, 17 - 4 * 0.6, 1), (-10, 30 - 4 * 0.6, 1), (12, 30 - 4 * 0.6, 1)]
    for (x, zb, sgn) in runs:
        for i in range(4):
            b.box(P["stone"], 3.0, 0.3 * (i + 1), 0.6, x, 0, zb + sgn * 0.6 * (i + 0.5))
    b.finish("db-south.glb")


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    P = palette()
    for fn in (build_perimeter, build_north, build_centre, build_market, build_south):
        fn(P)
    print("ALL DUST BOWL MODELS EXPORTED")


main()
