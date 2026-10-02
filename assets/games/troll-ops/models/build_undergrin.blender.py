"""
Troll Ops — Undergrin (subway station) models, headless Blender.

Run with:
  blender --background --python build_undergrin.blender.py

Writes ug-*.glb into this folder, authored in MAP coordinates (placed at
0,0) and sized from the approved blockout's colliders in maps.js
(MAPS.undergrin): change one, change the other.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
import math  # noqa: E402
import random  # noqa: E402
from mathutils import Vector  # noqa: E402

PH = 1.1          # platform height
MEZ = 3.5         # mezzanine slab bottom
CARS = (-8, 8)    # carriage centres
DOORS = (-4.5, 0, 4.5)
# 2026-10-01 expansion (mirrors maps.js undergrinExpansion + the cut station walls)
STAFF_DOORS = (-3.5, 11.7)   # z of the staff doors in both side walls
DOOR_W, DOOR_TOP = 2.0, 3.7
CON, CON_H = 7.0, 3.6        # ticket hall floor, wall height


def zsegs(z0, z1, gaps, w):
    """[z0, z1] minus a w-wide gap centred on each of gaps: the solid spans."""
    out, cur = [], z0
    for g in sorted(gaps):
        if g - w / 2 - cur > 0.02:
            out.append((cur, g - w / 2))
        cur = g + w / 2
    if z1 - cur > 0.02:
        out.append((cur, z1))
    return out


# the ceiling slab / hall floor, open over the light well and both stairwells
SLAB = [(-11.5, 2, -30.5, -28.5), (8.05, 11.5, -30.5, -28.5), (-11.5, 11.5, -28.5, -5),
        (-11.5, -1.6, -5, 5), (1.6, 11.5, -5, 5), (-11.5, 11.5, 5, 28.5),
        (-11.5, -8.05, 28.5, 30.5), (-2, 11.5, 28.5, 30.5)]


def poster(b, P, x, y, z, face, w, h, seed):
    """Poster art on a lit panel facing +x (face 1) or -x (face -1): a colour
    field, a big shape and a few lines of "text"."""
    rng = random.Random(seed)
    cols = [P["sign_red"], P["sign_blue"], P["yellow"], P["green"], P["train_red"], P["tile_green"], P["orange"]]
    bg = rng.choice(cols)
    b.box(bg, 0.012, h * 0.62, w * 0.92, x + face * 0.012, y + h * 0.33, z)
    fg = rng.choice([c for c in cols if c is not bg])
    b.cyl(fg, min(w, h) * 0.2, (x + face * 0.018, y + h * 0.64, z + w * 0.18), (x + face * 0.03, y + h * 0.64, z + w * 0.18), seg=16)
    for i in range(3):
        b.box(P["black"], 0.012, h * 0.045, w * (0.75 - i * 0.18), x + face * 0.014, y + h * (0.2 - i * 0.07), z - w * 0.05)


def roundel(b, P, x, y, z, face):
    """Station name sign: red ring, blue bar (face = +1/-1 along x)."""
    b.cyl(P["train_red"], 0.55, (x, y, z), (x + face * 0.03, y, z), seg=24)
    b.cyl(P["white"], 0.4, (x + face * 0.01, y, z), (x + face * 0.04, y, z), seg=24)
    b.box(P["sign_blue"], 0.05, 0.28, 1.5, x + face * 0.05, y - 0.14, z)
    b.box(P["white"], 0.052, 0.05, 1.0, x + face * 0.06, y - 0.03, z)


# ------------------------------------------------------------------ station

def build_station(P):
    """walls(0, 0, 26, 64, 7, 1.5) + ceiling at y 7 (inner faces x +-11.5, z +-30.5)."""
    b = Builder()
    for s in (-1, 1):
        for (z0, z1) in zsegs(-32, 32, STAFF_DOORS, DOOR_W):
            b.box(P["tile"], 1.5, 7, z1 - z0, s * 12.25, 0, (z0 + z1) / 2)
        for dz in STAFF_DOORS:
            b.box(P["tile"], 1.5, 7 - DOOR_TOP, DOOR_W, s * 12.25, DOOR_TOP, dz)        # over the door
            b.box(P["floorconc"], 1.5, PH, DOOR_W, s * 12.25, 0, dz)                   # sill
            # steel frame, hazard edge, a lit STAFF ONLY sign over it
            for side in (-1, 1):
                b.box(P["rail_steel"], 1.56, DOOR_TOP - PH, 0.12, s * 12.25, PH, dz + side * (DOOR_W / 2 + 0.04))
            b.box(P["rail_steel"], 1.56, 0.14, DOOR_W + 0.2, s * 12.25, DOOR_TOP - 0.07, dz)
            b.box(P["yellow"], 1.52, 0.02, DOOR_W, s * 12.25, PH, dz)
            b.box(P["sign_red"], 0.04, 0.32, 1.4, s * 11.47, DOOR_TOP + 0.2, dz)
            b.box(P["white"], 0.045, 0.06, 1.1, s * 11.46, DOOR_TOP + 0.33, dz)
        for sx in (-1, 1):
            b.box(P["tile"], 8.7, 7, 1.5, sx * 7.15, 0, s * 31.25)
        b.box(P["tile"], 5.6, 7 - 3.1, 1.5, 0, 3.1, s * 31.25)
    for (x0, x1, z0, z1) in SLAB:
        # outer pieces run on under the walls so no seam shows
        xa = -13 if x0 <= -11.5 else x0
        xb = 13 if x1 >= 11.5 else x1
        za = -32 if z0 <= -30.5 else z0
        zb = 32 if z1 >= 30.5 else z1
        b.box(P["panel_dk"], xb - xa, 0.6, zb - za, (xa + xb) / 2, 6.7, (za + zb) / 2)
    # green tile band + dark skirting on the side walls, roundels, beams
    for s in (-1, 1):
        for (z0, z1) in zsegs(-30.5, 30.5, STAFF_DOORS, DOOR_W + 0.3):
            L, zc = z1 - z0, (z0 + z1) / 2
            b.box(P["tile_green"], 0.03, 0.35, L, s * 11.49, 3.4, zc)
            b.box(P["tile_green"], 0.03, 0.1, L, s * 11.49, 3.9, zc)
            b.box(P["black"], 0.03, 0.25, L, s * 11.49, PH, zc)
        for z in (-24, -12, 0, 12, 24):
            roundel(b, P, s * 11.47, 2.6, z + 3, -s)
        for z in (-18, 6, 18):
            b.box(P["panel_dk"], 0.04, 1.2, 2.0, s * 11.47, 1.8, z)
            b.box(P["sign_lit"], 0.045, 1.05, 1.85, s * 11.465, 1.87, z)
            poster(b, P, s * 11.44, 1.87, z, -s, 1.85, 1.05, int(z * 7 + s))
    z = -28
    while z <= 28.01:
        b.box(P["panel_dk"], 23, 0.35, 0.4, 0, 6.05, z)
        z += 4
    # strip lights under the lamps (the lights are api.lamp at (+-8.5, 6.4, z))
    z = -28
    while z <= 28.01:
        for x in (-8.5, 8.5):
            b.box(P["dark"], 0.3, 0.1, 2.2, x, 6.5, z)
            b.box(P["lamp"], 0.22, 0.02, 2.0, x, 6.48, z)
        z += 4
    # tunnel mouths in both end walls, lit red above
    for zs in (-1, 1):
        zf = zs * 30.49
        # the mouth sits under the mezzanine slab (y 3.5): dark opening, concrete
        # jambs and lintel, a row of red lamps on the lintel
        b.box(P["conc"], 6.4, 0.4, 0.3, 0, 3.1, zf - zs * 0.1)
        for sx in (-1, 1):
            b.box(P["conc"], 0.4, 3.1, 0.3, sx * 3.0, 0, zf - zs * 0.1)
            b.box(P["red_lamp"], 0.28, 0.28, 0.1, sx * 2.4, 2.75, zf - zs * 0.08)
        for k in range(5):
            b.box(P["red_lamp"], 0.14, 0.14, 0.06, -1.2 + k * 0.6, 3.2, zf - zs * 0.3)
    # tiled round pillars: cylinders r 0.5 at x +-4.6 from the platform up
    for z in [-26 + 6.5 * i for i in range(9)]:
        for x in (-4.6, 4.6):
            b.cyl(P["tile"], 0.5, (x, PH, z), (x, 6.1, z), seg=16)
            b.cyl(P["tile_green"], 0.52, (x, 3.4, z), (x, 3.75, z), seg=16)
            b.cyl(P["panel_dk"], 0.6, (x, 5.8, z), (x, 6.1, z), seg=16, r2=0.5)
    b.finish("ug-station.glb")


# ------------------------------------------------------------ platforms, track

def build_platforms(P):
    b = Builder()
    for s in (-1, 1):
        # main platform (-8.5 / 8.5, 9 x 62) and the extension beside the train
        b.box(P["floorconc"], 9, PH, 62, s * 8.5, 0, 0)
        b.box(P["floorconc"], 2.3, PH, 32, s * 2.85, 0, 0)
        # edge: yellow line + tactile strip + dark nosing, following the real edge
        for (ex, z0, z1) in ((s * 4.0, -31, -16), (s * 4.0, 16, 31), (s * 1.7, -16, 16)):
            L = z1 - z0
            zc = (z0 + z1) / 2
            b.box(P["yellow"], 0.3, 0.012, L, ex - s * 0.35, PH, zc)
            b.box(P["grate"], 0.45, 0.01, L, ex - s * 0.8, PH, zc)
            b.box(P["dark"], 0.08, 0.1, L, ex - s * 0.04, PH - 0.1, zc)
        for zs in (-1, 1):
            b.box(P["yellow"], 2.3, 0.012, 0.3, s * 2.85, PH, zs * 15.85)
        # dark recess under the platform lip along the track
        for (ex, z0, z1) in ((s * 4.0, -31, -16), (s * 4.0, 16, 31)):
            b.box(P["black"], 0.04, 0.5, z1 - z0, ex + s * 0.01, 0.3, (z0 + z1) / 2)
    # ballast bed, sleepers and rails the length of the pit
    b.box(P["ballast"], 8, 0.12, 61, 0, 0, 0)
    z = -30.4
    while z <= 30.41:
        if abs(z) > 16.2:
            b.box(P["sleeper"], 2.5, 0.12, 0.25, 0, 0.1, z)
        z += 0.65
    for rx in (-0.75, 0.75):
        b.box(P["rail_steel"], 0.12, 0.12, 61, rx, 0.2, 0)
        b.box(P["rail_steel"], 0.2, 0.03, 61, rx, 0.2, 0)
    b.box(P["panel_dk"], 0.1, 0.15, 61, 1.4, 0.2, 0)
    # steps from the track up to each platform at both ends
    for zs in (-1, 1):
        for s in (-1, 1):
            for i in range(4):
                h = 0.275 * (i + 1)
                b.box(P["conc"], 0.6, h, 3, s * (1.6 + 0.6 * (i + 0.5)), 0, zs * 22.75)
                b.box(P["yellow"], 0.05, 0.012, 3, s * (1.6 + 0.6 * i + 0.03), h, zs * 22.75)
    # cable trays along the pit walls
    for s in (-1, 1):
        for zs in (-1, 1):
            b.box(P["dark"], 0.15, 0.08, 14, s * 3.9, 0.6, zs * 23.5)
    b.finish("ug-platforms.glb")


# -------------------------------------------------------------------- train

def build_train(P):
    """Undercarriage (0,0) 3.4 x 32 x 1.1; carriages at z -8 / +8, 15 long,
    walls at x +-1.65 with doors (1.4) at cz -4.5 / 0 / +4.5, roof at 3.4."""
    b = Builder()
    b.box(P["train_dk"], 3.2, PH - 0.35, 31.6, 0, 0.35, 0)
    for cz in CARS:
        for bz in (cz - 5.2, cz + 5.2):
            b.box(P["black"], 2.6, 0.5, 2.4, 0, 0.1, bz)
            for wz in (bz - 0.8, bz + 0.8):
                for s in (-1, 1):
                    b.cyl(P["rail_steel"], 0.42, (s * 0.75, 0.42, wz), (s * 0.9, 0.42, wz), seg=14)
        # side walls: lower body, window band, cant rail; door leaves slid into pockets
        for s in (-1, 1):
            x = s * 1.65
            edges = [cz - 7.5] + [e for d in DOORS for e in (cz + d - 0.7, cz + d + 0.7)] + [cz + 7.5]
            for i in range(0, len(edges), 2):
                z0, z1 = edges[i], edges[i + 1]
                L = z1 - z0
                zc = (z0 + z1) / 2
                b.box(P["train"], 0.1, 0.95, L, x, PH, zc)
                b.box(P["glass"], 0.08, 0.95, L - 0.2, x, PH + 0.95, zc)
                b.box(P["train"], 0.1, 0.4, L, x, PH + 1.9, zc)
                for pz in (z0 + 0.05, z1 - 0.05):
                    b.box(P["train"], 0.12, 0.95, 0.1, x, PH + 0.95, pz)
            b.box(P["train_red"], 0.02, 0.25, 15, x + s * 0.06, PH + 0.8, cz)
            for d in DOORS:
                for dz in (-1, 1):
                    b.box(P["train_dk"], 0.04, 2.1, 0.7, x + s * 0.07, PH, cz + d + dz * 1.05)
                    b.box(P["glass"], 0.045, 0.8, 0.4, x + s * 0.09, PH + 1.0, cz + d + dz * 1.05)
                b.box(P["train_dk"], 0.14, 0.12, 1.5, x, PH + 2.1, cz + d)
        # roof: a shallow curved top on the 3.4 wide body
        prof = [(-1.72, PH + 2.3), (1.72, PH + 2.3), (1.6, PH + 2.5), (1.0, PH + 2.62), (-1.0, PH + 2.62), (-1.6, PH + 2.5)]
        b.prism(P["train"], prof, cz - 7.5, cz + 7.5, axis="z")
        b.box(P["train_dk"], 1.2, 0.2, 3.0, 0, PH + 2.62, cz + 3)
        # end walls with a gangway door; gangway bellows between the cars
        for ez in (cz - 7.45, cz + 7.45):
            for sx in (-1.1, 1.1):
                b.box(P["train"], 1.2, 2.3, 0.1, sx, PH, ez)
            b.box(P["train"], 3.4, 0.35, 0.1, 0, PH + 1.95, ez)
        # inside: floor, seats, grab poles, light strips, ads
        b.box(P["floor"], 3.2, 0.02, 14.8, 0, PH, cz)
        for sz in (-6, -2.2, 2.2, 6):
            sx = 1.2 if sz > 0 else -1.2
            b.box(P["seat_blue"], 0.5, 0.45, 1.6, sx, PH, cz + sz)
            b.box(P["seat_blue"], 0.1, 0.6, 1.6, sx + (0.22 if sx > 0 else -0.22), PH + 0.45, cz + sz)
            b.box(P["dark"], 0.06, 0.2, 1.6, sx, PH, cz + sz)
        for d in DOORS:
            for dz in (-0.9, 0.9):
                b.cyl(P["yellow"], 0.025, (0, PH, cz + d + dz), (0, PH + 2.3, cz + d + dz), seg=8)
        for s in (-1, 1):
            b.cyl(P["yellow"], 0.02, (s * 0.8, PH + 2.0, cz - 7.2), (s * 0.8, PH + 2.0, cz + 7.2), seg=6)
            b.box(P["lamp"], 0.15, 0.02, 14, s * 0.6, PH + 2.28, cz)
            for az in (-5.8, -1.9, 2.3, 6.1):
                b.box(P["sign_lit"], 0.02, 0.35, 0.9, s * 1.58, PH + 1.95 - 0.02, cz + az)
                poster(b, P, s * 1.57, PH + 1.93, cz + az, -s, 0.9, 0.35, int(az * 13 + cz + s))
    # cab fronts on the two outer ends
    for zs in (-1, 1):
        ez = zs * 15.55
        b.box(P["train"], 3.4, 2.3, 0.15, 0, PH, ez)
        b.box(P["glass"], 2.6, 0.9, 0.05, 0, PH + 1.1, ez + zs * 0.08)
        b.box(P["train_red"], 3.42, 0.3, 0.16, 0, PH + 0.5, ez + zs * 0.01)
        for sx in (-1.2, 1.2):
            b.box(P["headlight"], 0.35, 0.18, 0.04, sx, PH + 0.3, ez + zs * 0.09)
        b.box(P["black"], 1.2, 0.3, 0.05, 0, PH + 2.0, ez + zs * 0.09)
        b.box(P["sign_lit"], 1.1, 0.22, 0.02, 0, PH + 2.04, ez + zs * 0.12)
    b.box(P["black"], 2.2, 2.2, 1.1, 0, PH, 0)
    b.finish("ug-train.glb")


# ---------------------------------------------------------- mezzanines, kit

def build_fittings(P):
    b = Builder()
    rng = random.Random(4)
    for zs in (-1, 1):
        # slab (0, +-29.1) 26 x 4.3 at y 3.5, a fascia and a rail with the stair gap
        b.box(P["floorconc"], 26, 0.3, 4.3, 0, MEZ, zs * 29.1)
        b.box(P["panel_dk"], 26, 0.3, 0.12, 0, MEZ - 0.05, zs * 26.95)
        sx = -8.5 if zs < 0 else 8.5
        for (x0, x1) in ((-11.5, sx - 1.5), (sx + 1.5, 11.5)):
            edge_rail(b, P, x0, zs * 26.95, x1, zs * 26.95, MEZ + 0.3)
        # stair: api.stairs(sx, zs*(26.95 - 5.4), 3, 9, 0.3, 0.6, +-z, y 1.1)
        zb = zs * (26.95 - 9 * 0.6)
        for i in range(9):
            h = 0.3 * (i + 1)
            b.box(P["conc"], 3, h, 0.6, sx, PH, zb + zs * 0.6 * (i + 0.5))
            b.box(P["yellow"], 3, 0.012, 0.05, sx, PH + h, zb + zs * (0.6 * i + 0.03))
        for px in (sx - 1.55, sx + 1.55):
            b.bar(P["rail_steel"], (px, PH + 0.3 + 0.95, zb + zs * 0.3), (px, PH + 2.7 + 0.95, zb + zs * 5.1), 0.05)
            for i in (0, 4, 8):
                b.box(P["rail_steel"], 0.05, 1.0, 0.05, px, PH + 0.3 * (i + 1), zb + zs * 0.6 * (i + 0.5))
        # exit sign over the mezzanine
        b.box(P["green"], 1.6, 0.4, 0.06, sx, 5.6, zs * 26.9)
        b.box(P["black"], 0.03, 0.9, 0.03, sx, 6.0, zs * 26.9)
    # platform furniture
    for s in (-1, 1):
        for z in (-14, 14):
            x = s * 10.5
            for oz in (-0.9, 0.9):
                b.box(P["dark"], 0.5, 0.42, 0.08, x, PH, z + oz)
            for k in range(4):
                b.box(P["desk"], 0.12, 0.05, 2.2, x - 0.22 + k * 0.14, PH + 0.42, z)
            b.box(P["desk"], 0.06, 0.4, 2.2, x + s * 0.28, PH + 0.47, z, rz=-s * 0.2)
        for zz in (-20, 10):
            z = zz * s
            x = s * 11
            face = -s
            b.box(P["train_red"], 0.8, 2.0, 1.0, x, PH, z)
            b.box(P["glass"], 0.02, 1.2, 0.62, x + face * 0.41, PH + 0.6, z - 0.1)
            for r in range(4):
                col = (P["yellow"], P["sign_blue"], P["green"], P["white"])[r]
                b.box(col, 0.02, 0.12, 0.5, x + face * 0.4, PH + 0.72 + r * 0.26, z - 0.1)
            b.box(P["screen"], 0.02, 0.25, 0.18, x + face * 0.41, PH + 1.2, z + 0.34)
            b.box(P["sign_lit"], 0.02, 0.2, 0.9, x + face * 0.41, PH + 1.85, z)
        # newsstand (s*9, -s*6) 2.4 x 2.4 x 2.2
        nx, nz = s * 9, -s * 6
        b.box(P["tile_green"], 2.4, 1.0, 2.4, nx, PH, nz)
        b.box(P["desk"], 2.5, 0.06, 2.5, nx, PH + 1.0, nz)
        for cx in (-1.15, 1.15):
            for cz in (-1.15, 1.15):
                b.box(P["tile_green"], 0.1, 1.2, 0.1, nx + cx, PH + 1.0, nz + cz)
        b.box(P["tile_green"], 2.6, 0.12, 2.6, nx, PH + 2.1, nz)
        for k in range(8):
            col = (P["sign_red"], P["yellow"], P["sign_blue"], P["white"])[k % 4]
            b.box(col, 0.3, 0.4, 0.02, nx - 1.05 + k * 0.3, PH + 0.4, nz - s * 1.21, rx=0.1)
            b.box(col, 0.02, 0.35, 0.28, nx - s * 1.21, PH + 1.15 + (k % 2) * 0.4, nz - 0.9 + (k // 2) * 0.5)
        b.box(P["sign_lit"], 2.0, 0.3, 0.04, nx, PH + 2.22, nz - s * 1.25)
        # ticket barriers (s*x, +-19), x in 7/9/11: 0.3 x 1.2 x 1.0
        for z in (-19, 19):
            for x in (7, 9, 11):
                bx = s * x
                b.box(P["rail_steel"], 0.3, 1.0, 1.2, bx, PH, z, bevel=0.03)
                b.box(P["black"], 0.31, 0.06, 0.6, bx, PH + 1.0, z)
                b.box(P["green"], 0.1, 0.06, 0.1, bx, PH + 1.02, z - 0.4)
                for dx in (-0.2, 0.2):
                    if abs(bx + dx) < 11.4:
                        b.box(P["glass"], 0.4, 0.7, 0.03, bx + dx * 2.2, PH + 0.3, z)
    # hanging platform signs
    for s in (-1, 1):
        for z in (-22, -2, 18):
            x = s * 7.5
            for dz in (-0.7, 0.7):
                b.cyl(P["black"], 0.01, (x, 6.1, z + dz), (x, 5.25, z + dz), seg=4, smooth=False)
            b.box(P["black"], 0.15, 0.5, 2.0, x, 4.8, z)
            b.box(P["sign_lit"], 0.16, 0.36, 1.84, x, 4.87, z)
            b.box(P["sign_blue"], 0.165, 0.08, 1.84, x, 5.12, z)
    b.finish("ug-fittings.glb")


# ------------------------------------------------------------ the expansion

def build_expansion(P):
    """Service corridors, cross passages, the ticket hall (2026-10-01)."""
    b = Builder()
    rng = random.Random(11)

    # ---- service corridors: x +-(13 .. 17.5), floor at PH, ceiling 4.2
    for s in (-1, 1):
        xc = s * 15.25
        b.box(P["floorconc"], 4.5, PH, 64, xc, 0, 0)
        b.box(P["conc"], 1.0, 4.4, 78, s * 18, 0, 0)                          # outer wall
        b.box(P["panel_dk"], 5.6, 0.3, 78, s * 15.6, 4.2, 0)                  # ceiling
        b.box(P["conc"], 0.03, 4.2 - PH, 64, s * 13.01, PH, 0)                # back of the station wall, painted
        # painted dado + a yellow walkway line
        b.box(P["tile_green"], 0.03, 1.1, 76, s * 17.49, PH, 0)
        b.box(P["yellow"], 0.12, 0.01, 64, s * 14.0, PH, 0)
        # pipes and a cable tray along the outer wall
        for k, (py, pr, pm) in enumerate(((3.5, 0.14, "rust"), (3.15, 0.09, "rail_steel"), (2.85, 0.07, "train_red"))):
            b.cyl(P[pm], pr, (s * (17.3 - k * 0.05), py, -38.5), (s * (17.3 - k * 0.05), py, 38.5), seg=10)
        b.box(P["dark"], 0.5, 0.05, 76, s * 16.9, 3.85, 0)
        for z in range(-36, 37, 3):
            b.box(P["dark"], 0.04, 0.4, 0.04, s * 17.2, 3.85, z)
        # caged work lights every 6 m (only one is a real light)
        for z in range(-30, 31, 6):
            b.box(P["dark"], 0.5, 0.08, 0.3, s * 15.4, 4.12, z)
            b.box(P["lamp"], 0.36, 0.05, 0.2, s * 15.4, 4.07, z)
        # cover, as maps.js: lockers, crates, cable drum, fuse cabinet, a toolbox bench
        zl = s * -21
        for k in range(8):
            z = zl - 2.2 + k * 0.62
            b.box(P["sign_blue"], 0.6, 2.0, 0.6, s * 17.15, PH, z)
            b.box(P["dark"], 0.02, 0.5, 0.05, s * (17.15 - 0.31), PH + 1.2, z)
        for (cz, cy, ch) in ((s * 25, PH, 1.2), (s * 26.3, PH, 1.2), (s * 26.3, PH + 1.2, 1.2)):
            b.box(P["cardboard"], 1.2, ch, 1.2, s * 14.4, cy, cz, bevel=0.02)
            b.box(P["tape"], 1.22, 0.06, 0.2, s * 14.4, cy + ch - 0.05, cz)
        b.cyl(P["plank"], 0.7, (s * 16.4, PH, s * 4 - 0.5), (s * 16.4, PH, s * 4 + 0.5), seg=18)
        b.cyl(P["dark"], 0.3, (s * 16.4, PH, s * 4 - 0.52), (s * 16.4, PH, s * 4 + 0.52), seg=12)
        b.box(P["panel"], 0.5, 2.2, 1.6, s * 17.2, PH, s * -8)
        b.box(P["yellow"], 0.02, 0.3, 0.3, s * (17.2 - 0.26), PH + 1.6, s * -8)
        b.box(P["desk"], 1.0, 0.9, 2.2, s * 14.2, PH, s * -14)
        b.box(P["train_red"], 0.4, 0.25, 0.6, s * 14.2, PH + 0.9, s * -14 + 0.4)
        # graffiti: a big painted grin on the outer wall
        b.box(P["white"], 0.02, 1.6, 3.2, s * 17.47, PH + 1.2, s * 12)
        b.box(P["black"], 0.025, 0.18, 2.6, s * 17.46, PH + 1.55, s * 12)
        for k in range(6):
            b.box(P["black"], 0.025, 0.5, 0.06, s * 17.46, PH + 1.55, s * 12 - 1.15 + k * 0.46)
        for ex in (-0.7, 0.7):
            b.cyl(P["black"], 0.22, (s * 17.46, PH + 2.3, s * 12 + ex), (s * 17.44, PH + 2.3, s * 12 + ex), seg=12)
        # steps down to the passages at both ends
        for zs in (-1, 1):
            for i in range(4):
                h = 0.275 * (i + 1)
                b.box(P["conc"], 4.5, h, 0.6, xc, 0, zs * (34.4 - 0.6 * (i + 0.5)))
                b.box(P["yellow"], 4.5, 0.012, 0.05, xc, h, zs * (34.4 - 0.6 * i - 0.03))

    # ---- cross passages z +-(32 .. 38), track level, ceiling 3.8
    for zs in (-1, 1):
        zc = zs * 35.25
        b.box(P["conc"], 37, 4.4, 1.0, 0, 0, zs * 38.5)                       # far wall
        b.box(P["panel_dk"], 37, 0.3, 6.5, 0, 3.8, zc)                        # ceiling
        b.box(P["floorconc"], 37, 0.02, 6.5, 0, 0, zc)
        b.box(P["conc"], 37, 3.9, 0.03, 0, 0, zs * 31.98)                     # backs of the station's end walls
        # the track runs on to a buffer stop
        b.box(P["ballast"], 3.0, 0.06, 3.6, 0, 0, zs * 33.8)
        for rx in (-0.75, 0.75):
            b.box(P["rail_steel"], 0.12, 0.12, 3.5, rx, 0, zs * 33.75)
        b.box(P["train_red"], 3.0, 1.1, 0.8, 0, 0, zs * 35.8)
        for k in range(5):
            b.box(P["yellow"] if k % 2 else P["black"], 0.6, 0.3, 0.82, -1.2 + k * 0.6, 0.6, zs * 35.8)
        # maintenance cart, cable drums, generator
        cx = zs * 7.5
        b.box(P["yellow"], 3.2, 0.9, 1.6, cx, 0.3, zs * 35.2)
        b.box(P["dark"], 3.0, 0.5, 1.4, cx, 1.2, zs * 35.2)
        for wx in (-1.1, 1.1):
            for wz in (-0.6, 0.6):
                b.cyl(P["tyre"], 0.28, (cx + wx, 0.28, zs * 35.2 + wz - 0.1), (cx + wx, 0.28, zs * 35.2 + wz + 0.1), seg=12)
        for (dx, dz, r, h) in ((-6.5, 36.6, 0.75, 1.3), (-9, 36.8, 0.6, 1.0)):
            x, z = zs * dx, zs * dz
            b.cyl(P["plank"], r, (x, 0, z), (x, h, z), seg=18)
            b.cyl(P["drum_blue"], r * 0.6, (x, 0.02, z), (x, h + 0.02, z), seg=14)
        b.box(P["panel"], 2.4, 2.2, 0.8, zs * 12, 0, zs * 37.6)
        b.box(P["dark"], 2.0, 0.6, 0.02, zs * 12, 1.2, zs * 37.19)
        b.box(P["red_lamp"], 0.2, 0.2, 0.05, zs * 12 + 0.9, 1.9, zs * 37.18)
        # red hazard lights along the ceiling, pipes on the far wall
        for x in range(-16, 17, 4):
            b.box(P["red_lamp"], 0.3, 0.08, 0.3, x, 3.72, zc)
        for k, (py, pr) in enumerate(((3.3, 0.13), (2.95, 0.08))):
            b.cyl(P["rust" if k == 0 else "rail_steel"], pr, (-18, py, zs * 37.85), (18, py, zs * 37.85), seg=10)
        # trollface poster in the tunnel and a "NO ENTRY" sign by the steps
        b.box(P["white"], 2.4, 1.6, 0.02, 0, 0.9, zs * 37.97)
        b.box(P["black"], 2.0, 0.16, 0.025, 0, 1.25, zs * 37.95)
        for k in range(6):
            b.box(P["black"], 0.06, 0.4, 0.025, -0.9 + k * 0.36, 1.25, zs * 37.95)
        for ex in (-0.6, 0.6):
            b.cyl(P["black"], 0.2, (ex, 1.95, zs * 37.95), (ex, 1.95, zs * 37.93), seg=12)
        for sx in (-1, 1):
            b.box(P["sign_red"], 1.2, 0.4, 0.04, sx * 15.25, 3.0, zs * 37.97)

    # ---- the ticket hall: floor at CON over the station, walls to CON + CON_H
    for (x0, x1, z0, z1) in SLAB:
        b.box(P["floorconc"], x1 - x0, 0.02, z1 - z0, (x0 + x1) / 2, CON, (z0 + z1) / 2)
    for s in (-1, 1):
        b.box(P["tile"], 1.5, CON_H + 0.4, 64, s * 12.25, CON, 0)
        b.box(P["tile"], 23, CON_H + 0.4, 1.5, 0, CON, s * 31.25)
        b.box(P["tile_green"], 0.03, 0.3, 61, s * 11.49, CON + 1.2, 0)
        b.box(P["tile_green"], 23, 0.3, 0.03, 0, CON + 1.2, s * 30.49)
    b.box(P["panel_dk"], 26, 0.4, 64, 0, CON + CON_H, 0)                      # ceiling
    for z in range(-28, 29, 4):
        b.box(P["dark"], 0.3, 0.08, 2.4, -6, CON + CON_H - 0.06, z)
        b.box(P["lamp"], 0.22, 0.03, 2.2, -6, CON + CON_H - 0.08, z)
        b.box(P["dark"], 0.3, 0.08, 2.4, 6, CON + CON_H - 0.06, z)
        b.box(P["lamp"], 0.22, 0.03, 2.2, 6, CON + CON_H - 0.08, z)
    # rails round the light well and the stairwells
    for (x0, z0, x1, z1) in ((-1.6, -5.05, 1.6, -5.05), (-1.6, 5.05, 1.6, 5.05), (-1.65, -5, -1.65, 5), (1.65, -5, 1.65, 5),
                             (1.95, -28.45, 8.05, -28.45), (1.95, -30.5, 1.95, -28.45),
                             (-8.05, 28.45, -1.95, 28.45), (-1.95, 28.45, -1.95, 30.5)):
        edge_rail(b, P, x0, z0, x1, z1, CON)
    # the stairs up off each mezzanine (11 x 0.29 rise, 0.55 run, along x)
    for (x0, zc, sx) in ((2.0, -29.5, 1), (-2.0, 29.5, -1)):
        for i in range(11):
            h = 0.29 * (i + 1)
            b.box(P["conc"], 0.55, h, 1.8, x0 + sx * 0.55 * (i + 0.5), MEZ + 0.3, zc)
            b.box(P["yellow"], 0.05, 0.012, 1.8, x0 + sx * (0.55 * i + 0.03), MEZ + 0.3 + h, zc)
        b.bar(P["rail_steel"], (x0, MEZ + 0.3 + 1.0, zc + 0.95), (x0 + sx * 6.05, CON + 1.0, zc + 0.95), 0.05)
        b.box(P["green"], 1.6, 0.4, 0.06, x0 + sx * 1.0, 5.6, zc + 0.95)
    # gate lines (gaps in the middle), ticket offices, machines, columns, benches
    for zs in (-1, 1):
        zg = zs * 16
        for x in (-10, -8, -6, -4, 4, 6, 8, 10):
            b.box(P["rail_steel"], 0.3, 1.0, 1.2, x, CON, zg, bevel=0.03)
            b.box(P["black"], 0.31, 0.06, 0.6, x, CON + 1.0, zg)
            b.box(P["green"], 0.1, 0.06, 0.1, x, CON + 1.02, zg - zs * 0.4)
            if abs(x) < 10:
                b.box(P["glass"], 1.4, 0.7, 0.03, x + 1.0, CON + 0.3, zg)
        bx, bz = zs * 8, zs * 22.5
        b.box(P["panel"], 3.0, 1.1, 3.0, bx, CON, bz)
        b.box(P["glass"], 3.0, 1.2, 3.0, bx, CON + 1.1, bz)
        b.box(P["panel_dk"], 3.2, 0.3, 3.2, bx, CON + 2.3, bz)
        b.box(P["sign_lit"], 2.6, 0.3, 0.04, bx, CON + 2.35, bz - zs * 1.62)
        b.box(P["desk"], 1.0, 0.8, 0.6, bx, CON + 0.3, bz)
        for z in (-9, -3, 3, 9):
            x = zs * 11.1
            b.box(P["sign_blue"], 0.7, 1.9, 1.0, x, CON, z)
            b.box(P["screen"], 0.02, 0.4, 0.5, x - zs * 0.36, CON + 1.2, z)
            b.box(P["yellow"], 0.02, 0.08, 0.6, x - zs * 0.36, CON + 0.8, z)
        for z in (10, 22):
            for sx in (-1, 1):
                b.box(P["tile"], 0.8, CON_H, 0.8, sx * 5.5, CON, zs * z)
                b.box(P["tile_green"], 0.84, 0.3, 0.84, sx * 5.5, CON + 1.2, zs * z)
        b.box(P["desk"], 3.2, 0.08, 0.5, 0, CON + 0.42, zs * 11)
        for bx2 in (-1.4, 1.4):
            b.box(P["dark"], 0.08, 0.42, 0.45, bx2, CON, zs * 11)
        # departure board over the gate line, roundels, posters
        b.box(P["black"], 4.0, 0.9, 0.12, 0, CON + 2.5, zg)
        for r in range(3):
            b.box(P["sign_lit"], 3.6, 0.14, 0.13, 0, CON + 2.62 + r * 0.24, zg)
        for z in (-26, -14, 14, 26):
            roundel(b, P, zs * 11.47, CON + 2.3, z, -zs)
        for z in (-20, -6, 6, 20):
            poster(b, P, zs * 11.44, CON + 1.1, z, -zs, 1.6, 1.0, int(z * 3 + zs * 5))
    # the big mural on each end wall: a trollface grin, tiled
    for zs in (-1, 1):
        z = zs * 30.47
        b.box(P["white"], 9.0, 2.6, 0.03, 0, CON + 0.6, z)
        b.box(P["black"], 7.6, 0.3, 0.035, 0, CON + 1.1, z)
        for k in range(10):
            b.box(P["black"], 0.08, 0.7, 0.035, -3.4 + k * 0.76, CON + 1.1, z)
        for ex in (-2.4, 2.4):
            b.cyl(P["black"], 0.45, (ex, CON + 2.5, z), (ex, CON + 2.5, z - zs * 0.04), seg=18)
            b.cyl(P["white"], 0.18, (ex + 0.15, CON + 2.6, z - zs * 0.04), (ex + 0.15, CON + 2.6, z - zs * 0.06), seg=12)
    b.finish("ug-expansion.glb")


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    P = palette()
    for fn in (build_station, build_platforms, build_train, build_fittings, build_expansion):
        fn(P)
    print("ALL UNDERGRIN MODELS EXPORTED")


main()
