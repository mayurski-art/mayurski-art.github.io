"""
Troll Forces — Cul-de-Grin's houses, rebuilt (realism pass, 2026-10-02).

Run with:
  blender --background --python build_cg_houses.blender.py

Writes house-<variant>.glb (terracotta, sage, violet, each plain and -attic),
the same files and footprints build_houses.blender.py made, in GAME
coordinates (x, y up, z), door gap on +x like before (the game turns the
model PI for a west-facing door). Colliders live in maps.js and must match:
  ghostWalls(x, z, w, d, 3.2, WALL_T 0.35, door gap 3.0 on the door side);
  attic: ghostWalls(x, z, w - 2, d - 2, 2.2, 0.28, y 3.35, a 1.6 gap on the
  model's +z side), attic floor at 3.2.
Lap siding, cased windows with shutters, a porch with columns, a shingled
gable roof with fascia, gutters and downpipes, a brick chimney; inside,
painted walls, a wood floor, skirting, a ceiling and a light.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
import math  # noqa: E402
import random  # noqa: E402

WALL_H = 3.2
WALL_T = 0.35
DOOR_W = 3.0
ATTIC_H = 2.2
ATTIC_T = 0.28
ATTIC_Y = 3.2

VARIANTS = {
    # name: (w, d, siding, siding_dark, roof, trim, shutter, door)
    "terracotta": (12, 10, 0xc89a6a, 0xc0926a, 0x6a3a2e, 0xf4efe4, 0x5a3a2a, 0x2f4a5a),
    "sage": (14, 12, 0x9aaa8c, 0x94a486, 0x3e4a3a, 0xeeeadc, 0x2e3e30, 0x8a2a24),
    "violet": (11, 11, 0xd8ccb0, 0xd0c4a8, 0x4e4058, 0xf6f2e8, 0x5a4a6a, 0x2a3a5a),
}


def darker(c, k):
    return (int(((c >> 16) & 255) * k) << 16) | (int(((c >> 8) & 255) * k) << 8) | int((c & 255) * k)


def mats(v):
    w, d, sid, sid2, roof, trim, shut, door = VARIANTS[v]
    return {
        "sid": mat("CG_Siding_" + v, sid, 0.85), "sid2": mat("CG_SidingB_" + v, sid2, 0.85),
        "roof": mat("CG_Shingle_" + v, roof, 0.9), "roof2": mat("CG_ShingleB_" + v, darker(roof, 0.82), 0.9),
        "trim": mat("CG_Trim_" + v, trim, 0.55), "shut": mat("CG_Shutter_" + v, shut, 0.6),
        "door": mat("CG_Door_" + v, door, 0.45),
        "glass": mat("CG_Glass", 0x22313c, 0.08, 0.2), "curtain": mat("CG_Curtain_" + v, 0xe8dcc0, 0.9),
        "found": mat("GS_Concrete", 0x8e8e88, 0.92), "brick": mat("GS_Brick", 0xa0523a, 0.9),
        "inner": mat("CG_Inner_" + v, 0xece4d4, 0.9), "floor": mat("GS_WoodFloor", 0x9a6a42, 0.6),
        "ceil": mat("CG_Ceiling", 0xf2f0ea, 0.9), "skirt": mat("CG_Skirt", 0xf4f2ec, 0.6),
        "gutter": mat("CG_Gutter", 0xd8d8d2, 0.4, 0.3), "light": mat("CG_Light", 0xfff2d8, 0.3, 0.0, 0xfff2d8, 1.0),
        "deck": mat("GS_Plank", 0xb0874f, 0.85), "dark": mat("CG_Dark", 0x1c1c1e, 0.7),
        "lamp": mat("CG_PorchLamp", 0xfff0c8, 0.3, 0.0, 0xffe0a0, 1.5),
    }


def siding_wall(b, M, axis, fixed, a0, a1, y0, y1, outward, holes, rng):
    """Lap siding boards on one exterior face. axis 'x': the face runs along
    x at z = fixed, outward is +-1 in z; axis 'z': along z at x = fixed.
    holes: [(c0, c1, h0, h1)] openings to skip (window, door)."""
    BH = 0.2
    y = y0
    k = 0
    while y < y1 - 0.01:
        h = min(BH, y1 - y)
        # split this course round any opening it crosses
        segs = [(a0, a1)]
        for (c0, c1, h0, h1) in holes:
            if y + h <= h0 or y >= h1:
                continue
            nxt = []
            for (s0, s1) in segs:
                if c1 <= s0 or c0 >= s1:
                    nxt.append((s0, s1))
                    continue
                if c0 > s0:
                    nxt.append((s0, c0))
                if c1 < s1:
                    nxt.append((c1, s1))
            segs = nxt
        m = M["sid"] if k % 2 == 0 else M["sid2"]
        for (s0, s1) in segs:
            if s1 - s0 < 0.02:
                continue
            L = s1 - s0
            c = (s0 + s1) / 2
            off = fixed + outward * 0.025
            if axis == "x":
                b.box(m, L, h + 0.02, 0.05, c, y, off, rx=-outward * 0.06)
            else:
                b.box(m, 0.05, h + 0.02, L, off, y, c, rz=outward * 0.06)
        y += BH
        k += 1


def window(b, M, axis, fixed, c, sill, ww, wh, outward, shutters=True):
    """A cased double-hung window on the face (glass at the wall's middle)."""
    def bx(m, along, up, depth, ca, y, cd):
        if axis == "x":
            b.box(m, along, up, depth, ca, y, cd)
        else:
            b.box(m, depth, up, along, cd, y, ca)
    face = fixed + outward * 0.05
    bx(M["glass"], ww, wh, 0.04, c, sill, fixed)
    # sashes: a meeting rail and muntins
    bx(M["trim"], ww, 0.06, 0.08, c, sill + wh / 2 - 0.03, fixed + outward * 0.03)
    bx(M["trim"], 0.04, wh, 0.07, c, sill, fixed + outward * 0.03)
    # reveal (the wall thickness) and the casing on the face
    for s in (-1, 1):
        bx(M["trim"], 0.06, wh, WALL_T, c + s * (ww / 2 + 0.03), sill, fixed)
    bx(M["trim"], ww + 0.12, 0.06, WALL_T, c, sill + wh, fixed)
    for s in (-1, 1):
        bx(M["trim"], 0.12, wh + 0.2, 0.05, c + s * (ww / 2 + 0.06), sill - 0.05, face)
    bx(M["trim"], ww + 0.4, 0.14, 0.06, c, sill + wh + 0.05, face)                 # head casing
    bx(M["trim"], ww + 0.3, 0.06, 0.16, c, sill - 0.06, fixed + outward * 0.1)    # sill
    if shutters:
        for s in (-1, 1):
            sc = c + s * (ww / 2 + 0.12 + 0.28)
            bx(M["shut"], 0.5, wh + 0.1, 0.04, sc, sill - 0.05, face + outward * 0.03)
            for k in range(5):
                bx(M["dark"], 0.42, 0.015, 0.02, sc, sill + 0.1 + k * (wh - 0.1) / 5, face + outward * 0.055)
    # a curtain behind the glass, gathered to one side
    bx(M["curtain"], ww * 0.35, wh - 0.05, 0.03, c - ww * 0.3, sill + 0.02, fixed - outward * 0.12)


def build_house(v, attic):
    w, d = VARIANTS[v][0], VARIANTS[v][1]
    M = mats(v)
    b = Builder()
    rng = random.Random(len(v) * 7 + (1 if attic else 0))
    hx, hz = w / 2, d / 2
    # --- shell core (the collider's walls), painted inside
    core = M["inner"]
    b.box(core, WALL_T - 0.06, WALL_H, d, -hx + WALL_T / 2, 0, 0)
    for s in (-1, 1):
        b.box(core, w, WALL_H, WALL_T - 0.06, 0, 0, s * (hz - WALL_T / 2))
    seg = (d - DOOR_W) / 2
    for s in (-1, 1):
        b.box(core, WALL_T - 0.06, WALL_H, seg, hx - WALL_T / 2, 0, s * (DOOR_W / 2 + seg / 2))
    # --- foundation plinth, skirting the outside
    for s in (-1, 1):
        b.box(M["found"], w + 0.1, 0.35, 0.08, 0, 0, s * (hz + 0.02))
    b.box(M["found"], 0.08, 0.35, d + 0.1, -hx - 0.02, 0, 0)
    for s in (-1, 1):
        b.box(M["found"], 0.08, 0.35, seg, hx + 0.02, 0, s * (DOOR_W / 2 + seg / 2))
    # --- windows: two on each long side, one at the back
    WW, WH, SILL = 1.2, 1.35, 0.95
    holes_z = [(c - WW / 2 - 0.1, c + WW / 2 + 0.1, SILL - 0.1, SILL + WH + 0.1) for c in (-w / 4, w / 4)]
    for s in (-1, 1):
        siding_wall(b, M, "x", s * hz, -hx, hx, 0.35, WALL_H, s, holes_z, rng)
        for c in (-w / 4, w / 4):
            window(b, M, "x", s * hz, c, SILL, WW, WH, s)
    siding_wall(b, M, "z", -hx, -hz, hz, 0.35, WALL_H, -1, [(-WW / 2 - 0.1, WW / 2 + 0.1, SILL - 0.1, SILL + WH + 0.1)], rng)
    window(b, M, "z", -hx, 0, SILL, WW, WH, -1)
    siding_wall(b, M, "z", hx, -hz, hz, 0.35, WALL_H, 1, [(-DOOR_W / 2, DOOR_W / 2, 0, WALL_H - 0.55)], rng)
    # corner boards
    for (cx, cz) in ((-hx, -hz), (-hx, hz), (hx, -hz), (hx, hz)):
        b.box(M["trim"], 0.18, WALL_H - 0.3, 0.18, cx, 0.3, cz)
    # --- the front door: a wide cased opening, both leaves swung back flat
    # against the front wall outside, a transom over it
    b.box(M["trim"], 0.08, WALL_H - 0.55, 0.14, hx + 0.04, 0, -DOOR_W / 2 - 0.07)
    b.box(M["trim"], 0.08, WALL_H - 0.55, 0.14, hx + 0.04, 0, DOOR_W / 2 + 0.07)
    b.box(M["trim"], 0.1, 0.18, DOOR_W + 0.4, hx + 0.05, WALL_H - 0.6, 0)
    b.box(M["glass"], 0.04, 0.3, DOOR_W - 0.2, hx - WALL_T / 2, WALL_H - 0.5, 0)
    b.box(M["trim"], WALL_T, 0.06, DOOR_W, hx - WALL_T / 2, WALL_H - 0.55, 0)
    for s in (-1, 1):
        lz = s * (DOOR_W / 2 + 0.45)
        b.box(M["door"], 0.05, 2.3, 0.75, hx + 0.1, 0.02, lz)
        for (py, ph) in ((0.2, 0.9), (1.25, 0.9)):
            b.box(M["trim"], 0.02, ph, 0.55, hx + 0.13, py, lz)
        b.box(M["gutter"], 0.04, 0.04, 0.1, hx + 0.15, 1.05, lz - s * 0.28)
    b.box(M["dark"], 0.04, 0.02, DOOR_W, hx - WALL_T / 2, 0, 0)                   # threshold
    # --- porch: a plank deck, two columns, a shed roof, a lamp
    PD = 1.6
    b.box(M["deck"], PD, 0.06, DOOR_W + 1.4, hx + PD / 2, 0, 0)
    for s in (-1, 1):
        pz = s * (DOOR_W / 2 + 0.5)
        px = hx + PD - 0.15
        b.box(M["trim"], 0.26, 0.2, 0.26, px, 0.06, pz)
        b.box(M["trim"], 0.18, WALL_H - 0.55, 0.18, px, 0.26, pz)
        b.box(M["trim"], 0.26, 0.14, 0.26, px, WALL_H - 0.43, pz)
    b.box(M["trim"], PD + 0.2, 0.2, DOOR_W + 1.6, hx + PD / 2, WALL_H - 0.3, 0)
    b.box(M["roof"], PD + 0.35, 0.08, DOOR_W + 1.8, hx + PD / 2 + 0.05, WALL_H - 0.1, 0, rz=-0.12)
    b.box(M["dark"], 0.1, 0.25, 0.1, hx + 0.08, 2.1, DOOR_W / 2 + 0.25)
    b.box(M["lamp"], 0.08, 0.14, 0.08, hx + 0.1, 2.13, DOOR_W / 2 + 0.25)
    # --- interior: wood floor, skirting, a ceiling and its light
    ix, iz = w - 2 * WALL_T, d - 2 * WALL_T
    b.box(M["floor"], ix, 0.02, iz, 0, 0, 0)
    for s in (-1, 1):
        b.box(M["skirt"], ix, 0.12, 0.03, 0, 0.02, s * (hz - WALL_T - 0.015))
    b.box(M["skirt"], 0.03, 0.12, iz, -hx + WALL_T + 0.015, 0.02, 0)
    if not attic:
        b.box(M["ceil"], ix, 0.04, iz, 0, WALL_H - 0.04, 0)
        b.cyl(M["light"], 0.25, (0, WALL_H - 0.1, 0), (0, WALL_H - 0.04, 0), seg=14)
    # --- roof
    OV = 0.45
    if not attic:
        ridge = WALL_H + 1.9
        gable_roof(b, M, w + 2 * OV, d + 2 * OV, WALL_H - 0.05, ridge, 0, 0, rng)
        gable_ends(b, M, hx, hz, WALL_H, ridge, rng)
        gutters(b, M, hx + OV, hz + OV, WALL_H - 0.12)
        chimney(b, M, -hx - 0.42, hz * 0.4, ridge + 0.3)
    else:
        # storey and a half: a pent roof skirts the ground floor up to the
        # attic walls, the attic storey (inset 1 m) has its own siding and
        # windows, a gable roof over it, and the dormer opening on +z.
        aw, ad = w - 2.0, d - 2.0
        ahx, ahz = aw / 2, ad / 2
        pent(b, M, hx + OV, hz + OV, ahx, ahz, WALL_H - 0.05, ATTIC_Y + 0.55)
        gutters(b, M, hx + OV, hz + OV, WALL_H - 0.12)
        top = ATTIC_Y + 0.15 + ATTIC_H
        b.box(M["inner"], ATTIC_T - 0.04, ATTIC_H + 0.15, ad, -ahx + ATTIC_T / 2, ATTIC_Y, 0)
        b.box(M["inner"], ATTIC_T - 0.04, ATTIC_H + 0.15, ad, ahx - ATTIC_T / 2, ATTIC_Y, 0)
        b.box(M["inner"], aw, ATTIC_H + 0.15, ATTIC_T - 0.04, 0, ATTIC_Y, -ahz + ATTIC_T / 2)
        dg = 1.6
        dseg = (aw - dg) / 2
        for s in (-1, 1):
            b.box(M["inner"], dseg, ATTIC_H + 0.15, ATTIC_T - 0.04, s * (dg / 2 + dseg / 2), ATTIC_Y, ahz - ATTIC_T / 2)
        y0 = ATTIC_Y + 0.55
        siding_wall(b, M, "x", -ahz, -ahx, ahx, y0, top, -1, [(-0.6, 0.6, y0 + 0.4, y0 + 1.4)], rng)
        window(b, M, "x", -ahz, 0, y0 + 0.45, 1.0, 0.9, -1)
        siding_wall(b, M, "x", ahz, -ahx, ahx, y0, top, 1, [(-dg / 2, dg / 2, ATTIC_Y, top)], rng)
        for s in (-1, 1):
            siding_wall(b, M, "z", s * ahx, -ahz, ahz, y0, top, s, [], rng)
        for (cx, cz) in ((-ahx, -ahz), (-ahx, ahz), (ahx, -ahz), (ahx, ahz)):
            b.box(M["trim"], 0.16, top - y0, 0.16, cx, y0, cz)
        # the sniper window: a cased opening, a sill and a little hood
        for s in (-1, 1):
            b.box(M["trim"], 0.12, ATTIC_H - 0.2, ATTIC_T + 0.06, s * (dg / 2 + 0.06), ATTIC_Y + 0.2, ahz - ATTIC_T / 2)
        b.box(M["trim"], dg + 0.3, 0.12, ATTIC_T + 0.1, 0, top - 0.3, ahz - ATTIC_T / 2)
        b.box(M["trim"], dg + 0.4, 0.06, 0.3, 0, ATTIC_Y + 0.15, ahz + 0.05)
        b.box(M["roof"], dg + 0.7, 0.07, 0.7, 0, top - 0.12, ahz + 0.3, rx=0.35)
        b.box(M["ceil"], aw - 0.5, 0.04, ad - 0.5, 0, top - 0.04, 0)
        b.cyl(M["light"], 0.2, (0, top - 0.1, 0), (0, top - 0.04, 0), seg=12)
        ridge = top + 1.5
        gable_roof(b, M, aw + 2 * 0.35, ad + 2 * 0.35, top - 0.05, ridge, 0, 0, rng)
        gable_ends(b, M, ahx, ahz, top, ridge, rng)
        gutters(b, M, ahx + 0.35, ahz + 0.35, top - 0.12)
        chimney(b, M, -hx - 0.42, hz * 0.4, ridge + 0.3)
    b.finish("house-%s%s.glb" % (v, "-attic" if attic else ""))


def gable_roof(b, M, rw, rd, eave_y, ridge_y, cx, cz, rng):
    """Ridge along x. Each slope: a sheathing slab, then shingle courses
    lapped up the slope, a ridge cap, fascia boards on the eaves."""
    half = rd / 2
    rise = ridge_y - eave_y
    slope = math.atan2(rise, half)
    L = math.hypot(rise, half)
    for s in (-1, 1):
        # sheathing, from eave (z = s*half) to ridge (z = 0)
        mz = cz + s * half / 2
        my = eave_y + rise / 2
        b.box(M["roof"], rw, 0.06, L, cx, my - 0.03, mz, rx=s * slope)
        n = int(L / 0.28)
        for k in range(n):
            t = (k + 0.5) / n
            zz = cz + s * half * (1 - t)
            yy = eave_y + rise * t
            m = M["roof"] if (k + rng.randrange(2)) % 3 else M["roof2"]
            b.box(m, rw, 0.035, 0.32, cx, yy + 0.03, zz, rx=s * slope + s * 0.04)
        # fascia + soffit on the eave
        b.box(M["trim"], rw + 0.02, 0.2, 0.04, cx, eave_y - 0.16, cz + s * (half + 0.01))
    b.box(M["roof2"], rw + 0.04, 0.1, 0.3, cx, ridge_y - 0.02, cz)


def gable_ends(b, M, hx, hz, base_y, ridge_y, rng):
    """Siding filling each gable triangle, with a round vent."""
    for sx in (-1, 1):
        x = sx * hx
        k = 0
        y = base_y
        while y < ridge_y - 0.1:
            t = (y + 0.1 - base_y) / (ridge_y - base_y)
            half = hz * (1 - t)
            if half > 0.05:
                b.box(M["sid"] if k % 2 == 0 else M["sid2"], 0.05, 0.22, 2 * half, x + sx * 0.02, y, 0)
            y += 0.2
            k += 1
        vy = base_y + (ridge_y - base_y) * 0.45
        b.cyl(M["trim"], 0.32, (x + sx * 0.02, vy, 0), (x + sx * 0.09, vy, 0), seg=16)
        b.cyl(M["dark"], 0.24, (x + sx * 0.05, vy, 0), (x + sx * 0.1, vy, 0), seg=16)
        for k in range(4):
            b.box(M["trim"], 0.03, 0.03, 0.44, x + sx * 0.11, vy - 0.15 + k * 0.1, 0)
        # barge boards up both rakes
        for s in (-1, 1):
            b.bar(M["trim"], (x + sx * 0.08, base_y - 0.05, s * (hz + 0.45)), (x + sx * 0.08, ridge_y + 0.02, 0), 0.06, 0.2)


def pent(b, M, ohx, ohz, ahx, ahz, y0, y1):
    """A skirt roof round the ground floor: from the eaves up to the attic walls."""
    for s in (-1, 1):
        run = ohz - ahz
        L = math.hypot(run, y1 - y0)
        ang = math.atan2(y1 - y0, run)
        b.box(M["roof"], 2 * ohx, 0.08, L, 0, (y0 + y1) / 2 - 0.04, s * (ahz + run / 2), rx=s * ang)
        b.box(M["trim"], 2 * ohx + 0.02, 0.2, 0.04, 0, y0 - 0.16, s * (ohz + 0.01))
        k = 0
        n = int(L / 0.3)
        for k in range(n):
            t = (k + 0.5) / n
            b.box(M["roof2"] if k % 3 == 0 else M["roof"], 2 * ohx, 0.03, 0.32, 0, y0 + (y1 - y0) * t + 0.03, s * (ohz - run * t), rx=s * ang + s * 0.04)
    for s in (-1, 1):
        run = ohx - ahx
        L = math.hypot(run, y1 - y0)
        ang = math.atan2(y1 - y0, run)
        b.box(M["roof"], L, 0.08, 2 * ahz, s * (ahx + run / 2), (y0 + y1) / 2 - 0.04, 0, rz=-s * ang)


def gutters(b, M, ox, oz, y):
    for s in (-1, 1):
        b.box(M["gutter"], 2 * ox, 0.1, 0.12, 0, y - 0.1, s * (oz + 0.06))
        for sx in (-1, 1):
            b.cyl(M["gutter"], 0.04, (sx * (ox - 0.15), y - 0.1, s * (oz + 0.08)), (sx * (ox - 0.15), 0.05, s * (oz + 0.08)), seg=6)


def chimney(b, M, x, z, top):
    b.box(M["brick"], 0.75, top, 0.9, x, 0, z)
    b.box(M["brick"], 0.85, 0.15, 1.0, x, top - 0.6, z)
    b.box(M["found"], 0.84, 0.12, 0.84, x, top, z)
    b.box(M["dark"], 0.3, 0.2, 0.3, x, top + 0.12, z)


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    palette()
    for v in VARIANTS:
        for attic in (False, True):
            build_house(v, attic)
    import quantize_glb
    here = os.path.dirname(os.path.abspath(__file__))
    quantize_glb.main([os.path.join(here, "house-%s%s.glb" % (v, s)) for v in VARIANTS for s in ("", "-attic")])
    print("ALL HOUSES EXPORTED")


main()
