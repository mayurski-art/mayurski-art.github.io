"""
Troll Ops — Cul-de-Grin polish models, headless Blender.

Run with:
  blender --background --python build_culdegrin.blender.py

Writes cg-*.glb into this folder. The houses themselves are the existing
house-*.glb (build_houses.blender.py); this adds what the maps doc asked
for: back fences, hedges and trees round the edge (houses behind them are
house-*.glb placed outside the bounds in maps.js), sidewalks, curbs and
driveways, parked cars, and furniture inside the houses.
World-space models are authored in MAP coordinates (placed at 0,0).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
import math  # noqa: E402
import random  # noqa: E402
from mathutils import Vector  # noqa: E402

HOUSES = [(-18, -18, "e", 12, 10), (-18, 0, "e", 14, 12), (-18, 18, "e", 11, 11),
          (18, -18, "w", 11, 11), (18, 0, "w", 14, 12), (18, 18, "w", 12, 10)]
DRIVEWAYS = [(-10, 9.3), (10, -9.3)]          # parked cars in driveways (maps.js colliders)
YARD_TREES = [(-29, -9), (29, 9), (-29, -21), (29, 21)]
# neighbours outside the fence (house-*.glb placed by maps.js): keep trees off them
OUTSIDE_HOUSES = [(-24, -40), (0, -41), (24, -40), (-24, 40), (0, 41), (24, 40),
                  (-44, -14), (-44, 14), (44, -14), (44, 14)]
STREET_HEDGES = [(-10, 24, 14, 1.2), (10, -24, 14, 1.2), (-10, -24, 14, 1.2), (10, 24, 14, 1.2)]


def tree(b, P, x, z, h=6.0, seed=0, spread=1.0):
    rng = random.Random(seed)
    b.cyl(P["bark"], 0.22 * spread, (x, 0, z), (x + rng.uniform(-0.2, 0.2), h * 0.55, z + rng.uniform(-0.2, 0.2)), seg=8, r2=0.14 * spread)
    for k in range(6):
        a = 2 * math.pi * k / 6 + rng.uniform(-0.3, 0.3)
        r = rng.uniform(0.6, 1.3) * spread
        s = rng.uniform(1.6, 2.4) * spread
        cx, cz = x + math.cos(a) * r, z + math.sin(a) * r
        cy = h * rng.uniform(0.5, 0.72)
        b.lump(P["leaf"] if k % 2 else P["leaf_dk"], s, s * 0.85, s, cx, cy, cz, seed=seed * 10 + k, rnd=0.7, jitter=0.12)
    b.lump(P["leaf"], 2.4 * spread, 2.0 * spread, 2.4 * spread, x, h * 0.72, z, seed=seed * 10 + 9, rnd=0.7, jitter=0.1)


def hedge(b, P, x, z, w, d, h, seed):
    rng = random.Random(seed)
    along_x = w >= d
    L = w if along_x else d
    n = max(2, int(L / 1.1))
    for i in range(n):
        k = -L / 2 + L * (i + 0.5) / n
        s = L / n * 1.35
        hh = h * rng.uniform(0.95, 1.08)
        if along_x:
            b.lump(P["leaf_dk"] if i % 2 else P["leaf"], s, hh, d * 1.1, x + k, 0, z, seed=seed * 50 + i, rnd=0.55, jitter=0.1)
        else:
            b.lump(P["leaf_dk"] if i % 2 else P["leaf"], d * 1.1, hh, s, x, 0, z + k, seed=seed * 50 + i, rnd=0.55, jitter=0.1)


# ---------------------------------------------------------------- surround

def build_surround(P):
    """Back fences on the inside of the (now invisible) boundary, hedge
    clumps against them, trees in the backyards and outside, and grass
    running out past the playable ground so the houses outside sit on it."""
    b = Builder()
    rng = random.Random(8)
    b.box(P["grass"], 170, 0.02, 150, 0, -0.03, 0)
    # fences: x = +-32.55 along z, z = +-28.55 along x, 1.9 tall
    for (x0, z0, x1, z1) in ((-32.55, -28.6, -32.55, 28.6), (32.55, -28.6, 32.55, 28.6),
                             (-32.6, -28.55, 32.6, -28.55), (-32.6, 28.55, 32.6, 28.55)):
        a, c = Vector((x0, 0, z0)), Vector((x1, 0, z1))
        L = (c - a).length
        n = math.ceil(L / 2.4)
        along_x = abs(z1 - z0) < 0.01
        for i in range(n):
            p = a.lerp(c, (i + 0.5) / n)
            seg = L / n
            if along_x:
                b.box(P["fence"], seg - 0.02, 1.75, 0.04, p.x, 0.08, p.z)
                for y in (0.35, 1.5):
                    b.box(P["plank"], seg, 0.1, 0.05, p.x, y, p.z - math.copysign(0.05, p.z))
            else:
                b.box(P["fence"], 0.04, 1.75, seg - 0.02, p.x, 0.08, p.z)
                for y in (0.35, 1.5):
                    b.box(P["plank"], 0.05, 0.1, seg, p.x - math.copysign(0.05, p.x), y, p.z)
        for i in range(n + 1):
            p = a.lerp(c, i / n)
            b.box(P["plank"], 0.12, 1.95, 0.12, p.x, 0, p.z)
    # hedge clumps along the fences, away from the spawn corners
    for (x, z, w, d) in ((-32.0, -12, 1.0, 5), (32.0, 12, 1.0, 5), (-20, -28.0, 6, 1.0), (20, 28.0, 6, 1.0),
                         (-32.0, 14, 1.0, 4), (32.0, -14, 1.0, 4), (14, -28.0, 5, 1.0), (-14, 28.0, 5, 1.0)):
        hedge(b, P, x, z, w, d, 1.3, seed=int(abs(x) + abs(z)))
    for i, (x, z, w, d) in enumerate(STREET_HEDGES):
        hedge(b, P, x, z, w, d, 1.5, seed=300 + i)
    # trees: in four backyards (trunk colliders in maps.js) and a ring outside
    for i, (x, z) in enumerate(YARD_TREES):
        tree(b, P, x, z, h=rng.uniform(6.0, 7.5), seed=i + 1)
    ring = []
    for x in range(-44, 45, 8):
        ring += [(x + rng.uniform(-2, 2), -34 - rng.uniform(0, 6)), (x + rng.uniform(-2, 2), 34 + rng.uniform(0, 6))]
    for z in range(-28, 29, 8):
        ring += [(-38 - rng.uniform(0, 6), z + rng.uniform(-2, 2)), (38 + rng.uniform(0, 6), z + rng.uniform(-2, 2))]
    for i, (x, z) in enumerate(ring):
        if rng.random() < 0.3 or any(abs(x - hx) < 9 and abs(z - hz) < 8.5 for hx, hz in OUTSIDE_HOUSES):
            continue
        tree(b, P, x, z, h=rng.uniform(6.5, 9.5), seed=100 + i, spread=rng.uniform(1.0, 1.4))
    # the neighbours' back fences, outside
    for s in (-1, 1):
        b.box(P["fence"], 90, 1.75, 0.05, 0, 0.08, s * 46.0)
        b.box(P["fence"], 0.05, 1.75, 90, s * 50.0, 0.08, 0)
    b.finish("cg-surround.glb")


# -------------------------------------------------------------------- street

def build_street(P):
    """Sidewalks + curbs either side of the 12 m road, driveways, front paths."""
    b = Builder()
    for s in (-1, 1):
        b.box(P["pavement"], 1.7, 0.06, 57.2, s * 6.95, 0, 0)
        b.box(P["conc"], 0.16, 0.12, 57.2, s * 6.08, 0, 0)
        z = -28
        while z <= 28.01:
            b.box(P["dark"], 1.7, 0.062, 0.03, s * 6.95, 0, z)
            z += 1.6
    for (x, z) in DRIVEWAYS:
        s = -1 if x < 0 else 1
        b.box(P["pavement"], 5.0, 0.05, 3.2, s * 10.3, 0, z)
    for (hx, hz, door, w, d) in HOUSES:
        # the house models have no floor: boards inside, skirting round the walls
        b.box(P["plank"], w - 0.7, 0.03, d - 0.7, hx, 0, hz)
        front = hx + (w / 2 if door == "e" else -w / 2)
        x0, x1 = sorted((front, 7.8 if hx > 0 else -7.8))
        b.box(P["pavement"], x1 - x0, 0.04, 1.3, (x0 + x1) / 2, 0, hz)
        # a welcome mat and a potted plant either side of the door
        mx = front + (0.4 if door == "e" else -0.4)
        b.box(P["cloth_red"], 0.5, 0.01, 1.0, mx, 0.04, hz)
        for dz in (-1.9, 1.9):
            b.cyl(P["terracotta"], 0.22, (mx + (0.3 if door == "e" else -0.3), 0, hz + dz), (mx + (0.3 if door == "e" else -0.3), 0.5, hz + dz), seg=10, r2=0.28)
            b.lump(P["leaf"], 0.55, 0.5, 0.55, mx + (0.3 if door == "e" else -0.3), 0.45, hz + dz, seed=int(hz + dz * 7))
    # centre line + a couple of manholes on the asphalt (road plane at y 0.02)
    z = -27
    while z <= 27:
        b.box(P["yellow"], 0.14, 0.01, 2.0, 0, 0.02, z)
        z += 4
    for z in (-20, 6):
        b.cyl(P["dark"], 0.35, (-2.5, 0.02, z), (-2.5, 0.035, z), seg=16)
    b.finish("cg-street.glb")


# ----------------------------------------------------------------- props

def build_cars(P):
    for key in ("car_red", "car_blue", "car_silver"):
        b = Builder()
        sedan(b, P, P[key])
        b.finish(f"cg-{key.replace('_', '-')}.glb")


def build_dumpster(P):
    """Fills the 2.4 x 2.4 x 1.6 street boxes."""
    b = Builder()
    b.frustum(P["dumpster"], 2.2, 2.0, 2.35, 2.3, 0.15, 1.45, 0, 0)
    b.box(P["dark"], 2.4, 0.08, 2.35, 0, 1.45, 0, rx=0.06)
    b.box(P["dark"], 2.3, 0.1, 0.1, 0, 1.2, 1.18)
    for (x, z) in ((-0.9, -0.8), (0.9, -0.8), (-0.9, 0.8), (0.9, 0.8)):
        b.cyl(P["tyre"], 0.08, (x, 0.08, z - 0.04), (x, 0.08, z + 0.04), seg=10)
    b.box(P["white"], 0.7, 0.25, 0.01, 0, 0.8, 1.16)
    b.lump(P["black"], 0.8, 0.35, 0.6, 0.5, 1.46, 0.3, seed=3)
    b.finish("cg-dumpster.glb")


def build_lounge(P):
    """Sofa + coffee table + rug in the old 3 x 2 x 1.2 cover box; sofa faces -z."""
    b = Builder()
    b.box(P["cloth_blue"], 3.4, 0.01, 2.4, 0, 0, -0.2)
    b.box(P["sofa"], 2.9, 0.42, 0.9, 0, 0.08, 0.5)
    b.box(P["sofa"], 2.9, 0.62, 0.22, 0, 0.45, 0.88)
    for sx in (-1.35, 1.35):
        b.box(P["sofa"], 0.22, 0.6, 0.9, sx, 0.08, 0.5)
    for sx in (-0.72, 0.0, 0.72):
        b.box(P["cushion"], 0.68, 0.14, 0.7, sx, 0.5, 0.42, bevel=0.03)
    b.box(P["dark"], 2.9, 0.08, 0.9, 0, 0, 0.5)
    b.box(P["desk"], 1.3, 0.05, 0.6, 0, 0.4, -0.5)
    for (dx, dz) in ((-0.58, -0.75), (0.58, -0.75), (-0.58, -0.25), (0.58, -0.25)):
        b.box(P["desk"], 0.05, 0.4, 0.05, dx, 0, dz)
    b.box(P["paper"], 0.3, 0.01, 0.22, -0.3, 0.45, -0.5, ry=0.3)
    b.cyl(P["sign_red"], 0.05, (0.3, 0.45, -0.5), (0.3, 0.57, -0.5), seg=8)
    b.finish("cg-lounge.glb")


def build_kitchen(P):
    """Counter (1.7 x 0.62 x 0.92) + fridge (0.8 x 0.7 x 1.85) along a wall;
    back to +z... here: back to -z, fridge on the +x end."""
    b = Builder()
    b.box(P["white"], 1.7, 0.88, 0.6, -0.4, 0, 0)
    b.box(P["desk"], 1.74, 0.05, 0.64, -0.4, 0.88, 0)
    for k in range(3):
        b.box(P["trim"], 0.05, 0.05, 0.02, -1.0 + k * 0.55, 0.7, 0.31)
    b.box(P["steel"], 0.5, 0.02, 0.4, -0.6, 0.93, 0)
    b.cyl(P["steel"], 0.02, (-0.6, 0.93, -0.25), (-0.6, 1.2, -0.25), seg=6)
    b.box(P["fridge"], 0.78, 1.85, 0.68, 0.85, 0, 0, bevel=0.03)
    b.box(P["dark"], 0.78, 0.01, 0.02, 0.85, 1.25, 0.35)
    for y in (0.7, 1.45):
        b.box(P["steel"], 0.03, 0.3, 0.03, 0.55, y, 0.36)
    b.box(P["sign_red"], 0.08, 0.08, 0.01, 0.95, 1.5, 0.345)
    b.box(P["cloth_green"], 0.12, 0.25, 0.01, 1.1, 1.2, 0.345)
    b.finish("cg-kitchen.glb")


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    P = palette()
    for fn in (build_surround, build_street, build_cars, build_dumpster, build_lounge, build_kitchen):
        fn(P)
    print("ALL CUL-DE-GRIN MODELS EXPORTED")


main()
