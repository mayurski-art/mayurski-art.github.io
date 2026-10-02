"""
Troll Forces — The Grinnery (the test range), realism pass 2026-10-02.

Run with:
  blender --background --python build_range.blender.py

Writes gr-range.glb in MAP coordinates over the colliders in maps.js
(MAPS.range): the block shell (walls(0, -2, 44, 64, 8, 1.2)), the firing
line bench and bay partitions, the roof and its columns, the cover blocks,
the raised platform and its stair, a sandbag backstop along the far wall.
The distance boards' numbers and the penetration walls' labels are canvases
in maps.js. Change a collider there, change it here.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
import math  # noqa: E402
import random  # noqa: E402


def build_range(P):
    b = Builder()
    rng = random.Random(8)
    block = P["block"]
    steel = P["steel"]
    dark = P["dark"]
    yellow = P["yellow"]
    sand = mat("GR_Sandbag", 0x9a8a62, 0.95)
    sand2 = mat("GR_Sandbag2", 0x8a7a54, 0.95)
    ply = P["plank"]
    timber = P["timber"]
    roof = mat("GR_Roof", 0x5a6068, 0.55, 0.4)
    green = mat("GR_Paint", 0x4a5a3e, 0.7)
    # --- the shell: block walls (x -22 .. 22, z -34 .. 30, 1.2 thick, 8 tall)
    X0, X1, Z0, Z1, T, H = -22.0, 22.0, -34.0, 30.0, 1.2, 8.0
    b.box(block, X1 - X0, H, T, 0, 0, Z0 + T / 2)
    b.box(block, X1 - X0, H, T, 0, 0, Z1 - T / 2)
    for sx in (X0 + T / 2, X1 - T / 2):
        b.box(block, T, H, Z1 - Z0, sx, 0, (Z0 + Z1) / 2)
    # coping, pilasters, a painted dado band, drainage at the foot
    b.box(P["precast"], X1 - X0 + 0.3, 0.2, T + 0.3, 0, H, Z0 + T / 2)
    b.box(P["precast"], X1 - X0 + 0.3, 0.2, T + 0.3, 0, H, Z1 - T / 2)
    for sx in (X0 + T / 2, X1 - T / 2):
        b.box(P["precast"], T + 0.3, 0.2, Z1 - Z0 + 0.3, sx, H, (Z0 + Z1) / 2)
    z = Z0 + 4
    while z < Z1 - 2:
        for sx in (X0 + T, X1 - T):
            b.box(P["precast"], 0.25, H - 0.4, 0.6, sx + (0.12 if sx < 0 else -0.12), 0, z)
        z += 6
    for sx in (X0 + T, X1 - T):
        b.box(green, 0.02, 1.2, Z1 - Z0 - 2 * T, sx + (0.01 if sx < 0 else -0.01), 0, (Z0 + Z1) / 2)
        b.box(yellow, 0.02, 0.1, Z1 - Z0 - 2 * T, sx + (0.012 if sx < 0 else -0.012), 1.2, (Z0 + Z1) / 2)
    # --- the backstop: a sandbag wall against the far wall, two bags deep
    x = X0 + T + 0.3
    row = 0
    while row < 6:
        x = X0 + T + 0.5 + (0.5 if row % 2 else 0)
        while x < X1 - T - 0.5:
            m = sand if rng.random() < 0.6 else sand2
            b.box(m, 0.98, 0.26, 0.5, x, row * 0.27, Z0 + T + 0.3, ry=rng.uniform(-0.04, 0.04), bevel=0.07)
            x += 1.0
        row += 1
    # --- the firing line: a timber bench (collider 44 x 0.6 x 1.05 at z 27.2)
    b.box(timber, 44, 0.08, 0.75, 0, 0.97, 27.2)
    b.box(ply, 44, 0.8, 0.04, 0, 0.12, 26.92)
    b.box(dark, 44, 0.12, 0.6, 0, 0, 27.2)
    for xx in range(-21, 22, 2):
        b.box(timber, 0.1, 0.97, 0.5, xx, 0, 27.25)
    # shooting positions: a rest pad and a number plate every 3 m
    k = 0
    for xx in [x_ * 3.0 for x_ in range(-6, 7)]:
        b.box(P["rubber"], 0.6, 0.03, 0.4, xx, 1.05, 27.15)
        b.box(yellow, 0.4, 0.25, 0.02, xx, 0.7, 26.89)
        k += 1
    # bay partitions (colliders 0.5 x 3.2 x 2.4 at x +-7, z 28.6)
    for px in (-7, 7):
        b.box(dark, 0.08, 2.4, 0.08, px, 0, 27.05)
        b.box(dark, 0.08, 2.4, 0.08, px, 0, 30.15)
        b.box(ply, 0.42, 2.3, 3.0, px, 0.05, 28.6)
        b.box(steel, 0.5, 0.06, 3.2, px, 2.35, 28.6)
        for yy in (0.6, 1.4):
            b.box(mat("GR_Baffle", 0x3a3e44, 0.9), 0.52, 0.5, 2.8, px, yy, 28.6)
    # --- the roof over the firing line (collider 44 x 5.2 x 0.4 at y 4.2,
    # z 28.4) on columns at x -20, -7, 7, 20 (z 30.4, 4.2 tall)
    for cx in (-20, -7, 7, 20):
        b.box(steel, 0.3, 4.2, 0.3, cx, 0, 30.4)
        b.box(dark, 0.5, 0.06, 0.5, cx, 0, 30.4)
        b.bar(steel, (cx, 3.2, 30.4), (cx, 4.2, 29.0), 0.12)
    for zz in (26.2, 28.4, 30.6):
        b.box(steel, 44.2, 0.3, 0.16, 0, 4.2, zz)
    k = 0
    xx = -22.0
    while xx < 22:
        b.box(roof, 0.5, 0.06, 5.4, xx + 0.25, 4.5, 28.4)
        b.box(roof, 0.06, 0.05, 5.4, xx + 0.5, 4.56, 28.4)
        xx += 0.5
    b.box(yellow, 44.4, 0.25, 0.06, 0, 4.3, 25.78)
    # strip lights under the roof
    for lx in (-14, 0, 14):
        b.box(P["lamp"], 2.4, 0.06, 0.2, lx, 4.12, 28.4)
    # --- distance boards on the left wall: frame + post (numbers in maps.js)
    for dz in (10, 25, 40, 55):
        zz = 26 - dz
        b.box(dark, 0.12, 1.1, 2.6, -20.75, 1.5, zz)
        b.box(P["white"], 0.04, 0.95, 2.45, -20.68, 1.57, zz)
    # --- cover: concrete blocks (3 x 3 x 1.5), sandbag walls, a barrier
    for cx in (-11, 11):
        for (ox, oz) in ((-0.75, -0.75), (0.75, -0.75), (-0.75, 0.75), (0.75, 0.75)):
            b.box(P["precast"], 1.46, 0.73, 1.46, cx + ox, 0, 8 + oz, bevel=0.03)
        for (ox, oz) in ((-0.75, -0.75), (0.75, -0.75), (-0.75, 0.75), (0.75, 0.75)):
            b.box(P["precast"], 1.46, 0.75, 1.46, cx + ox, 0.75, 8 + oz, bevel=0.03)
        for (ox, oz) in ((-0.4, -0.4), (0.4, 0.4)):
            b.cyl(P["precast"], 0.18, (cx + ox, 1.5, 8 + oz), (cx + ox, 1.62, 8 + oz), seg=10)
    for cx in (-6, 6):              # sandbag walls 2.4 x 6 x 1.2
        for row in range(5):
            zz = -2 - 3 + 0.3 + (0.3 if row % 2 else 0)
            while zz < -2 + 3 - 0.2:
                for ox in (-0.6, 0.6):
                    b.box(sand if rng.random() < 0.6 else sand2, 1.1, 0.24, 0.58, cx + ox * 0.95, row * 0.24, zz + 0.2,
                          ry=rng.uniform(-0.05, 0.05), bevel=0.06)
                zz += 0.6
    # the low barrier at z 14 (5 x 1.6 x 1.1): two precast jersey sections
    for ox in (-1.25, 1.25):
        b.prism(P["precast"], [(13.2, 0), (14.8, 0), (14.25, 0.3), (14.2, 1.1), (13.8, 1.1), (13.75, 0.3)], ox - 1.23, ox + 1.23, axis="x")
    # --- the platform (box 16, 10, 6 x 10 x 2.7) and its stair (16, 20, -z)
    PX, PZ, PW, PD, PH = 16, 10, 6, 10, 2.7
    b.box(ply, PW, 0.06, PD, PX, PH - 0.06, PZ)
    for (ox, oz) in ((-1, -1), (1, -1), (-1, 1), (1, 1), (-1, 0), (1, 0)):
        b.box(steel, 0.15, PH, 0.15, PX + ox * (PW / 2 - 0.08), 0, PZ + oz * (PD / 2 - 0.08))
    for side in (-1, 1):
        b.box(ply, 0.04, PH - 0.1, PD, PX + side * (PW / 2 - 0.02), 0, PZ)
        b.box(ply, PW, PH - 0.1, 0.04, PX, 0, PZ + side * (PD / 2 - 0.02))
        b.box(yellow, 0.06, 0.12, PD, PX + side * (PW / 2 - 0.03), PH, PZ)
        b.box(yellow, PW, 0.12, 0.06, PX, PH, PZ + side * (PD / 2 - 0.03))
    for k in range(8):
        h = 0.34 * (k + 1)
        zz = 20 - 0.7 * (k + 0.5)
        b.box(P["grate"], 4.0, 0.05, 0.66, 16, h - 0.05, zz)
        b.box(yellow, 4.0, 0.02, 0.06, 16, h - 0.01, zz + 0.3)
    for side in (-1, 1):
        b.prism(steel, [(20, 0), (19.7, 0), (14.4, PH), (14.4, PH - 0.3), (19.9, 0.3)], 16 + side * 2.0 - 0.05, 16 + side * 2.0 + 0.05, axis="x")
    b.finish("gr-range.glb")


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    P = palette()
    build_range(P)
    import quantize_glb
    quantize_glb.main([os.path.join(os.path.dirname(os.path.abspath(__file__)), "gr-range.glb")])


main()
