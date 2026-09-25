"""
Troll Ops — The Depot (warehouse) models, headless Blender.

Run with:
  blender --background --python build_depot.blender.py

Writes dp-*.glb into this folder, authored in MAP coordinates (placed at
0,0) and sized from the approved blockout's colliders in maps.js
(MAPS.depot): change one, change the other. The office glass is NOT here:
it stays a transparent pane in maps.js (the kit's paint is opaque).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
import math  # noqa: E402
import random  # noqa: E402
from mathutils import Vector  # noqa: E402

CAT_Y, TOP = 4.6, 5.0
ROWS = (-11, 0, 11)
BAYS = (-18, -6, 6, 18)
LAMPS = [(-18, -14), (0, -14), (18, -14), (-18, 0), (0, 0), (18, 0), (-18, 14), (0, 14), (18, 14)]
DOORS = (-14, 0, 12)


# -------------------------------------------------------------------- shell

def build_shell(P):
    """walls(0, 0, 56, 44, 9, 1.5) + the ceiling at y 9, dressed inside."""
    b = Builder()
    rng = random.Random(5)
    for s in (-1, 1):
        b.box(P["panel"], 56, 9, 1.5, 0, 0, s * 21.25)
        b.box(P["panel"], 1.5, 9, 41, s * 27.25, 0, 0)
    b.box(P["panel_dk"], 56, 0.6, 44, 0, 8.7, 0)
    # ribs on the inside faces, a concrete upstand, a painted band
    k = -26.2
    while k <= 26.21:
        for s in (-1, 1):
            b.box(P["panel"], 0.06, 7.6, 0.05, k, 1.2, s * 20.47)
        k += 0.4
    k = -20.2
    while k <= 20.21:
        for s in (-1, 1):
            b.box(P["panel"], 0.05, 7.6, 0.06, s * 26.47, 1.2, k)
        k += 0.4
    for s in (-1, 1):
        b.box(P["conc"], 53, 1.2, 0.1, 0, 0, s * 20.45)
        b.box(P["conc"], 0.1, 1.2, 41, s * 26.45, 0, 0)
        b.box(P["yellow"], 53, 0.12, 0.11, 0, 1.2, s * 20.45)
        b.box(P["yellow"], 0.11, 0.12, 41, s * 26.45, 1.2, 0)
    # portal frame: columns against the long walls, trusses across the roof
    for x in (-24, -18, -12, -6, 0, 6, 12, 18, 24):
        for s in (-1, 1):
            b.box(P["panel_dk"], 0.35, 8.7, 0.3, x, 0, s * 20.3)
        yb, yt = 7.7, 8.65
        for s in (-1, 1):
            b.bar(P["panel_dk"], (x, yb, -20.3), (x, yb, 20.3), 0.14)
        b.bar(P["panel_dk"], (x, yt, -20.3), (x, yt, 20.3), 0.14)
        z = -20.3
        up = True
        while z < 20.3:
            z1 = min(z + 2.0, 20.3)
            b.bar(P["panel_dk"], (x, yb if up else yt, z), (x, yt if up else yb, z1), 0.07)
            up = not up
            z = z1
    for z in (-14, -7, 0, 7, 14):
        b.bar(P["panel_dk"], (-26.4, 8.55, z), (26.4, 8.55, z), 0.12)
    # high-bay fittings over the lamps (the lights themselves are api.lamp)
    for (x, z) in LAMPS:
        b.cyl(P["black"], 0.012, (x, 8.4, z), (x, 7.7, z), seg=4, smooth=False)
        b.cyl(P["panel_dk"], 0.55, (x, 8.28, z), (x, 8.55, z), seg=16, r2=0.18)
        b.cyl(P["lamp"], 0.42, (x, 8.27, z), (x, 8.29, z), seg=16)
    # dock doors (south wall, face at z 20.5): roller shutters, one half up
    for i, x in enumerate(DOORS):
        top = 4.2 if i != 2 else 4.2
        b.box(P["yellow"], 0.18, 4.4, 0.2, x - 1.9, 0, 20.4)
        b.box(P["yellow"], 0.18, 4.4, 0.2, x + 1.9, 0, 20.4)
        b.box(P["panel_dk"], 4.0, 0.5, 0.35, x, 4.3, 20.35)
        shut_from = 2.0 if i == 1 else 0.0
        for k in range(int((top - shut_from) / 0.2)):
            b.box(P["steel"], 3.6, 0.17, 0.08, x, shut_from + k * 0.2, 20.42)
        if shut_from > 0:
            b.box(P["black"], 3.6, shut_from, 0.04, x, 0, 20.46)
            b.box(P["yellow"], 3.62, 0.08, 0.1, x, shut_from - 0.04, 20.4)
        for sx in (-1.45, 1.45):
            b.box(P["rubber"], 0.35, 0.45, 0.25, x + sx, 0.95, 20.33)
        for sx in (-2.4, 2.4):
            b.cyl(P["yellow"], 0.12, (x + sx, 0, 20.1), (x + sx, 1.1, 20.1), seg=10)
            for y in (0.3, 0.7):
                b.cyl(P["black"], 0.125, (x + sx, y, 20.1), (x + sx, y + 0.15, 20.1), seg=10)
        # bay number board: a white panel with dark bars
        b.box(P["white"], 1.0, 0.7, 0.03, x, 4.95, 20.44)
        for k in range(i + 1):
            b.box(P["black"], 0.12, 0.45, 0.01, x - 0.2 * i / 2 + k * 0.2, 5.07, 20.425)
    # signs and a fire point on the long walls
    for x in (-21, 9):
        b.box(P["sign_red"], 0.4, 0.5, 0.03, x, 1.7, -20.44)
        b.cyl(P["sign_red"], 0.1, (x + 0.6, 0.9, -20.3), (x + 0.6, 1.5, -20.3), seg=10)
        b.box(P["green"], 1.0, 0.35, 0.03, x + 3, 2.6, -20.44)
    # floor markings: aisle lines and hatched dock apron (a hair above the floor)
    for z in (-16.2, -5.6, 5.6, 16.2):
        b.box(P["yellow"], 48.0, 0.004, 0.1, 0, 0.002, z)
    for x in (-24.2, 24.2):
        b.box(P["yellow"], 0.1, 0.004, 32.0, x, 0.002, 0)
    for x in DOORS:
        for k in range(8):
            b.box(P["yellow"], 0.14, 0.004, 1.3, x - 1.6 + k * 0.45, 0.003, 19.4, ry=0.6)
    b.finish("dp-shell.glb")


# -------------------------------------------------------------------- racks

def load_on_pallet(b, P, x, z, y, w, d, h, kind, rng):
    top = pallet(b, P, w, d, x, z, y)
    hh = h - 0.13
    if kind == 0:  # cardboard boxes, stacked in rows
        nx = max(1, int(w / 0.78))
        nz = max(1, int(d / 0.78))
        ny = max(1, int(hh / 0.52))
        bw, bd, bh = w / nx, d / nz, hh / ny
        for i in range(nx):
            for j in range(nz):
                for k in range(ny):
                    if k == ny - 1 and rng.random() < 0.25:
                        continue
                    bx = x - w / 2 + bw * (i + 0.5)
                    bz = z - d / 2 + bd * (j + 0.5)
                    by = top + k * bh
                    b.box(P["cardboard"], bw - 0.03, bh - 0.02, bd - 0.03, bx, by, bz)
                    b.box(P["tape"], 0.07, 0.005, bd - 0.02, bx, by + bh - 0.02, bz)
    elif kind == 1:  # shrink-wrapped block with straps
        b.box(P["wrap"], w - 0.04, hh, d - 0.04, x, top, z, bevel=0.03)
        for o in (-w / 4, w / 4):
            b.box(P["black"], 0.04, hh + 0.01, d - 0.02, x + o, top, z)
    else:  # drums
        for i in range(2):
            for j in range(2):
                dx = x - w / 4 + i * w / 2
                dz = z - d / 4 + j * d / 2
                r = min(w, d) / 4 - 0.03
                b.cyl(P["drum_blue"], r, (dx, top, dz), (dx, top + min(hh, 0.9), dz), seg=14)
                b.cyl(P["black"], r * 0.3, (dx + r * 0.4, top + min(hh, 0.9), dz), (dx + r * 0.4, top + min(hh, 0.9) + 0.02, dz), seg=8)


def build_racks(P):
    b = Builder()
    rng = random.Random(17)
    bay_index = 0
    for row_z in ROWS:
        for bx in BAYS:
            # uprights with diagonal bracing between front and back
            for px in (-3.9, 3.9):
                for pz in (-1.4, 1.4):
                    b.box(P["rack_blue"], 0.15, 4.5, 0.15, bx + px, 0, row_z + pz)
                    b.box(P["steel"], 0.22, 0.02, 0.22, bx + px, 0, row_z + pz)
                y = 0.3
                up = True
                while y < 4.3:
                    y1 = min(y + 0.9, 4.4)
                    b.bar(P["rack_blue"], (bx + px, y, row_z - 1.33 if up else row_z + 1.33),
                          (bx + px, y1, row_z + 1.33 if up else row_z - 1.33), 0.04)
                    up = not up
                    y = y1
            # beams at 1.5 and 3.1 (collider is a 7.8 x 2.8 x 0.1 deck) with mesh decking
            for y in (1.5, 3.1):
                for pz in (-1.35, 1.35):
                    b.box(P["beam_orange"], 7.8, 0.12, 0.08, bx, y - 0.02, row_z + pz)
                b.box(P["grate"], 7.6, 0.02, 2.6, bx, y + 0.08, row_z)
            has_mid = bay_index % 2 == 0
            for (y, h) in ((0.0, 1.2), (1.6, 1.2), (3.2, 1.1)):
                if y == 1.6 and not has_mid:
                    continue
                for i in range(3):
                    px = bx - 7.4 / 2 + 7.4 / 3 * (i + 0.5)
                    kind = rng.choice((0, 0, 1, 1, 2)) if y < 3 else rng.choice((0, 1))
                    load_on_pallet(b, P, px, row_z, y if y else 0.0, 2.38, 2.35, h, kind, rng)
            bay_index += 1
        bay_index += 1
    # end-of-aisle guards and row labels
    for row_z in ROWS:
        for ex in (-22.2, 22.2):
            b.box(P["yellow"], 0.3, 0.5, 2.9, ex, 0, row_z)
            b.box(P["sign_blue"], 0.03, 0.5, 0.8, ex + (0.16 if ex > 0 else -0.16), 4.0, row_z)
    b.finish("dp-racks.glb")


# ------------------------------------------------------------------ catwalk

def build_catwalk(P):
    b = Builder()
    for (x, z, w, d) in ((0, -19, 54, 3), (0, 19, 54, 3), (-25.5, 0, 3, 38), (25.5, 0, 3, 38)):
        b.box(P["grate"], w, 0.06, d, x, CAT_Y + 0.34, z)
        b.box(P["panel_dk"], w, 0.3, d, x, CAT_Y + 0.04, z)
    # edge channels on the inner edges + the rails the colliders stand for
    edge_rail(b, P, -24, -17.55, 22, -17.55, TOP)
    edge_rail(b, P, -22, 17.55, 24, 17.55, TOP)
    edge_rail(b, P, -23.95, -17.5, -23.95, 17.5, TOP)
    edge_rail(b, P, 23.95, -17.5, 23.95, -6.0, TOP)
    edge_rail(b, P, 23.95, 6.0, 23.95, 17.5, TOP)
    cols = [(x, z) for x in (-22, -11, 0, 11) for z in (-17.8, 17.8)]
    cols += [(x, z) for z in (-11, 11) for x in (-24.3, 24.3)] + [(-24.3, 0)]
    for (x, z) in cols:
        b.box(P["panel_dk"], 0.3, CAT_Y, 0.3, x, 0, z)
        b.box(P["steel"], 0.45, 0.03, 0.45, x, 0, z)
        b.box(P["yellow"], 0.34, 1.0, 0.34, x, 0, z)
        for y in (0.2, 0.6):
            b.box(P["black"], 0.35, 0.18, 0.35, x, y, z)
    # stairs: (-23, 8.2) up +z to the south deck, (23, -8.2) up -z to the north deck
    steel_stair(b, P, 15, 0.334, 0.62, 2.0, 17.5 - 15 * 0.62, 1, x=-23)
    steel_stair(b, P, 15, 0.334, 0.62, 2.0, -17.5 + 15 * 0.62, -1, x=23)
    b.finish("dp-catwalk.glb")


# ------------------------------------------------------------------- office

def build_office(P):
    """Mezzanine (20,0) 8 x 12 at 4.6, walls to 7.6, glass front on x 16.05."""
    b = Builder()
    b.box(P["panel_dk"], 8, 0.4, 12, 20, CAT_Y, 0)
    b.box(P["floor"], 7.8, 0.01, 11.8, 20, TOP, 0)
    for z in (-5.8, 5.8):
        b.box(P["panel_dk"], 0.3, CAT_Y, 0.3, 16.2, 0, z)
    b.box(P["panel"], 0.1, 1.0, 12, 16.05, TOP, 0)
    for k in range(7):
        z = -6 + k * 2
        b.box(P["panel_dk"], 0.12, 1.55, 0.08, 16.05, TOP + 1.0, z)
    b.box(P["panel_dk"], 0.12, 0.1, 12, 16.05, TOP + 2.5, 0)
    b.box(P["panel"], 0.1, 0.1, 12, 16.05, TOP + 2.6, 0)
    for s in (-1, 1):
        b.box(P["panel"], 8, 2.6, 0.1, 20, TOP, s * 5.95)
    b.box(P["panel_dk"], 8.2, 0.2, 12.2, 20, TOP + 2.6, 0)
    b.box(P["white"], 1.2, 0.05, 0.3, 20, TOP + 2.55, 0)
    b.box(P["lamp"], 1.1, 0.01, 0.2, 20, TOP + 2.545, 0)
    # desk (collider 3 x 1.4 x 0.8 at (20,-3)), monitors, chair, cabinets, board
    b.box(P["desk"], 3.0, 0.06, 1.4, 20, TOP + 0.74, -3)
    for dx in (-1.4, 1.4):
        b.box(P["dark"], 0.06, 0.74, 1.3, 20 + dx, TOP, -3)
    for dx in (-0.6, 0.4):
        b.box(P["dark"], 0.5, 0.32, 0.04, 20 + dx, TOP + 0.95, -3.4, ry=0.1)
        b.box(P["screen"], 0.46, 0.28, 0.01, 20 + dx, TOP + 0.97, -3.37, ry=0.1)
        b.box(P["dark"], 0.06, 0.18, 0.06, 20 + dx, TOP + 0.8, -3.42)
    b.box(P["paper"], 0.3, 0.01, 0.22, 20.9, TOP + 0.8, -2.8, ry=0.3)
    b.box(P["dark"], 0.5, 0.08, 0.5, 20, TOP + 0.45, -1.9)
    b.box(P["dark"], 0.5, 0.55, 0.06, 20, TOP + 0.5, -1.62)
    for z in (4.2, 4.9):
        b.box(P["trim"], 0.6, 1.3, 0.6, 23.4, TOP, z)
    b.box(P["white"], 0.03, 1.0, 2.0, 23.9, TOP + 1.1, 2.0)
    b.box(P["sign_blue"], 0.01, 0.05, 1.2, 23.88, TOP + 1.8, 2.0)
    b.box(P["sign_red"], 0.01, 0.05, 0.8, 23.88, TOP + 1.6, 1.9)
    b.finish("dp-office.glb")


# ---------------------------------------------------------------- loading bay

def build_bay(P):
    """Trailer backed into door 1 (collider (-14,16.8) 2.6 x 7.4 x 3.6)."""
    b = Builder()
    x0, z0 = -14, 16.8
    b.box(P["trailer"], 2.6, 2.5, 7.4, x0, 1.1, z0, bevel=0.03)
    k = z0 - 3.6
    while k <= z0 + 3.61:
        for s in (-1, 1):
            b.box(P["trailer"], 0.04, 2.4, 0.08, x0 + s * 1.32, 1.15, k)
        k += 0.6
    for s in (-1, 1):
        b.box(P["sign_red"], 0.02, 0.18, 7.3, x0 + s * 1.31, 2.9, z0)
        b.box(P["steel"], 0.04, 0.8, 5.0, x0 + s * 1.25, 0.3, z0 - 0.9)
    b.box(P["dark"], 2.2, 0.3, 7.2, x0, 0.8, z0)
    for z in (z0 + 1.9, z0 + 3.0):
        for s in (-1, 1):
            b.cyl(P["tyre"], 0.48, (x0 + s * 0.85, 0.48, z), (x0 + s * 1.2, 0.48, z), seg=16)
            b.cyl(P["steel"], 0.26, (x0 + s * 0.86, 0.48, z), (x0 + s * 1.22, 0.48, z), seg=10)
    for s in (-1, 1):
        b.box(P["dark"], 0.12, 1.0, 0.12, x0 + s * 0.9, 0, z0 - 2.4)
        b.box(P["dark"], 0.3, 0.05, 0.3, x0 + s * 0.9, 0, z0 - 2.4)
    b.box(P["white"], 0.02, 0.6, 1.0, x0 + 1.33, 2.2, z0 - 2.6)
    # wrapped pallets (colliders 1.2 x 1.2 x 1.4) at (10,15), (-4,16), (8,-15)
    rng = random.Random(9)
    for (x, z) in ((10, 15), (-4, 16), (8, -15)):
        load_on_pallet(b, P, x, z, 0.0, 1.2, 1.2, 1.4, 1, rng)
    # pallet jack and a stack of empty pallets by door 3
    b.box(P["sign_red"], 0.55, 0.1, 1.2, 14.2, 0.05, 17.5)
    b.bar(P["dark"], (14.2, 0.15, 16.9), (14.2, 1.1, 16.6), 0.05)
    for k in range(6):
        pallet(b, P, 1.2, 1.0, 16.0, 17.8, k * 0.13)
    b.finish("dp-bay.glb")


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    P = palette()
    for fn in (build_shell, build_racks, build_catwalk, build_office, build_bay):
        fn(P)
    print("ALL DEPOT MODELS EXPORTED")


main()
