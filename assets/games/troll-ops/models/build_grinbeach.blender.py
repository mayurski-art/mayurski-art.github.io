"""
Troll Ops — Grin Beach polish models, headless Blender.

Run with:
  blender --background --python build_grinbeach.blender.py

Writes gb-*.glb: the pier (deck, pilings, railings with gaps where the two
ramps land, the ramps, lamp posts, the bait shack) in MAP coordinates, and
the lot's food truck (local, nose +x). Sized from the colliders in maps.js
(MAPS.grinbeach): change one, change the other.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
import math  # noqa: E402
import random  # noqa: E402
from mathutils import Vector  # noqa: E402

PIER_Y = 2.6
PIER_X = -13
DECK_TOP = PIER_Y + 0.5
Z0, Z1 = -6.0, -44.0
RAIL_X = 4.85
# railing runs per side, leaving a gap where each ramp's top steps arrive
RAILS = {-1: [(-6.0, -10.0), (-12.4, -44.0)], 1: [(-6.0, -18.0), (-20.4, -44.0)]}


def build_pier(P):
    b = Builder()
    rng = random.Random(12)
    planks = (P["plank_a"], P["plank_b"], P["plank_c"])
    z = Z0
    while z > Z1 + 0.01:
        w = min(0.3, z - Z1)
        b.box(rng.choice(planks), 9.96, 0.1, w - 0.025, PIER_X, DECK_TOP - 0.1, z - w / 2)
        z -= 0.3
    for dx in (-4.2, -1.4, 1.4, 4.2):
        b.box(P["piling"], 0.25, 0.4, Z0 - Z1, PIER_X + dx, PIER_Y, (Z0 + Z1) / 2)
    for sx in (-1, 1):
        b.box(P["piling"], 0.08, 0.5, Z0 - Z1, PIER_X + sx * 4.98, PIER_Y, (Z0 + Z1) / 2)
    # pilings (colliders r 0.42 at x +-4.2, z -8 .. -42 every 6) with caps
    for zz in range(-8, -43, -6):
        for dx in (-4.2, 4.2):
            b.cyl(P["piling"], 0.42, (PIER_X + dx, 0, zz), (PIER_X + dx, PIER_Y, zz), seg=12)
            b.cyl(P["piling"], 0.45, (PIER_X + dx, 0.0, zz), (PIER_X + dx, 0.5, zz), seg=12)
            b.cyl(P["dark"], 0.44, (PIER_X + dx, PIER_Y - 0.05, zz), (PIER_X + dx, PIER_Y + 0.05, zz), seg=12)
    # railings sitting on the deck (colliders 0.3 x 1.1 at x +-4.85)
    for sx, runs in RAILS.items():
        x = PIER_X + sx * RAIL_X
        for (za, zb) in runs:
            L = za - zb
            n = max(1, math.ceil(L / 2.0))
            for i in range(n + 1):
                zz = za - L * i / n
                b.box(P["plank_c"], 0.14, 1.1, 0.14, x, DECK_TOP, zz)
            b.box(P["plank_a"], 0.26, 0.08, L, x, DECK_TOP + 1.02, (za + zb) / 2)
            b.box(P["plank_b"], 0.1, 0.1, L, x, DECK_TOP + 0.55, (za + zb) / 2)
            b.box(P["plank_b"], 0.1, 0.1, L, x, DECK_TOP + 0.2, (za + zb) / 2)
    # lamp posts on the railing line
    for zz in (-9, -24, -39):
        for sx in (-1, 1):
            x = PIER_X + sx * (RAIL_X + 0.02)
            b.cyl(P["dark"], 0.06, (x, DECK_TOP, zz), (x, DECK_TOP + 2.6, zz), seg=8)
            b.cyl(P["lamp"], 0.16, (x, DECK_TOP + 2.55, zz), (x, DECK_TOP + 2.85, zz), seg=10)
            b.cyl(P["dark"], 0.2, (x, DECK_TOP + 2.85, zz), (x, DECK_TOP + 2.95, zz), seg=10, r2=0.05)
    # ramps: api.stairs(PIER_X -/+ 6.8, -6 / -14, 3.4, 10, 0.31, 0.62, "-z")
    for (rx, rz) in ((PIER_X - 6.8, -6.0), (PIER_X + 6.8, -14.0)):
        for i in range(10):
            h = 0.31 * (i + 1)
            b.box(rng.choice(planks), 3.4, 0.08, 0.6, rx, h - 0.08, rz - 0.62 * (i + 0.5))
            b.box(P["piling"], 3.2, h - 0.08, 0.5, rx, 0, rz - 0.62 * (i + 0.5))
        for sx in (-1, 1):
            b.prism(P["piling"], [(rz, 0), (rz - 6.2, 0), (rz - 6.2, 3.1), (rz, 0.31)],
                    rx + sx * 1.7 - 0.04, rx + sx * 1.7 + 0.04, axis="x")
    # bait shack: walls(PIER_X, -33, 7, 6, 3, 0.4, gaps n/s 2.4) on the deck, roof at +3.5
    y0 = DECK_TOP
    walls_geo(b, P["plank_b"], PIER_X, -33, 7, 6, 3, 0.4, {"n": 2.4, "s": 2.4}, y=y0, fill_above=2.4, lintel=P["piling"])
    for sx in (-1, 1):
        k = -2.8
        while k <= 2.81:
            b.box(P["plank_a"], 0.03, 3.0, 0.1, PIER_X + sx * 3.52, y0, -33 + k)
            k += 0.35
    b.box(P["piling"], 7.6, 0.3, 6.6, PIER_X, y0 + 3.0, -33)
    b.box(P["sign_blue"], 7.7, 0.12, 6.7, PIER_X, y0 + 3.3, -33)
    b.box(P["white"], 3.0, 0.7, 0.06, PIER_X, y0 + 3.0 + 0.45, -29.65)
    for k in range(4):
        b.box(P["sign_blue"], 0.45, 0.4, 0.02, PIER_X - 1.1 + k * 0.72, y0 + 3.6, -29.61)
    # inside and around: cooler, rods on the wall, a life ring, nets and a crate
    b.box(P["white"], 0.9, 0.5, 0.5, PIER_X + 2.4, y0, -34.8)
    b.box(P["sign_blue"], 0.92, 0.1, 0.52, PIER_X + 2.4, y0 + 0.5, -34.8)
    for k in range(4):
        b.cyl(P["dark"], 0.015, (PIER_X - 3.05, y0 + 0.3, -34.8 + k * 0.35), (PIER_X - 3.05, y0 + 2.5, -34.6 + k * 0.35), seg=4, smooth=False)
    b.cyl(P["orange"], 0.36, (PIER_X + 3.56, y0 + 1.8, -31.5), (PIER_X + 3.62, y0 + 1.8, -31.5), seg=16)
    b.cyl(P["white"], 0.2, (PIER_X + 3.55, y0 + 1.8, -31.5), (PIER_X + 3.64, y0 + 1.8, -31.5), seg=16)
    b.lump(P["cloth_green"], 1.2, 0.3, 0.9, PIER_X - 2.3, y0, -31.4, seed=4)
    b.box(P["plank"], 0.7, 0.5, 0.5, PIER_X - 2.6, y0, -35.2)
    b.finish("gb-pier.glb")


def build_foodtruck(P):
    """Food truck filling a 6 (x) x 2.4 x 3 collider, nose on +x, hatch on +z."""
    b = Builder()
    T = P["truck_teal"]
    b.box(T, 4.4, 2.3, 2.3, -0.75, 0.55, 0, bevel=0.05)
    prof = [(1.45, 0.55), (2.95, 0.55), (3.0, 1.25), (2.6, 1.45), (2.05, 2.25), (1.45, 2.3)]
    b.prism(T, prof, -1.12, 1.12, axis="z")
    b.box(P["glass"], 0.5, 0.6, 2.26, 1.75, 1.55, 0)
    b.box(P["glass"], 0.03, 0.72, 2.0, 2.33, 1.5, 0, rz=0.94)
    b.box(P["white"], 4.42, 0.35, 2.32, -0.75, 2.5, 0)
    # serving hatch with an awning, a counter and a menu board
    b.box(P["black"], 2.4, 1.1, 0.03, -0.9, 1.3, 1.16)
    b.box(P["fridge"], 2.2, 0.5, 0.02, -0.9, 1.35, 1.14)
    b.box(P["desk"], 2.5, 0.05, 0.4, -0.9, 1.25, 1.35)
    b.box(P["sign_red"], 2.6, 0.04, 0.9, -0.9, 2.45, 1.5, rx=0.35)
    b.box(P["yellow"], 1.4, 0.8, 0.02, -0.9, 2.9, 1.17)
    for k in range(3):
        b.box(P["black"], 1.0, 0.05, 0.01, -0.9, 3.0 + k * 0.18, 1.18)
    b.cyl(P["yellow"], 0.3, (-2.6, 2.85, 0), (-2.6, 3.0, 0), seg=16)
    b.box(P["dark"], 0.8, 0.3, 0.8, 0.4, 2.85, 0)
    for (x, z) in ((-2.2, -0.95), (-2.2, 0.95), (2.1, -0.95), (2.1, 0.95)):
        b.cyl(P["tyre"], 0.4, (x, 0.4, z - 0.14 * (1 if z > 0 else -1)), (x, 0.4, z + 0.14 * (1 if z > 0 else -1)), seg=14)
        b.cyl(P["steel"], 0.22, (x, 0.4, z), (x, 0.4, z + 0.16 * (1 if z > 0 else -1)), seg=10)
    b.box(P["dark"], 6.0, 0.2, 2.3, 0, 0.35, 0)
    for sz in (-0.7, 0.7):
        b.box(P["headlight"], 0.04, 0.15, 0.3, 3.0, 0.9, sz)
        b.box(P["taillight"], 0.04, 0.2, 0.15, -2.97, 1.0, sz)
    b.finish("gb-foodtruck.glb")


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    P = palette()
    build_pier(P)
    build_foodtruck(P)
    print("ALL GRIN BEACH MODELS EXPORTED")


main()
