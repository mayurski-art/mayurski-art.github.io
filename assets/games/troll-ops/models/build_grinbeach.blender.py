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
# The map's extent (maps.js grinbeach bounds, Grin Beach 5a): the west edge
# at -WEST_X, the east at EAST_X (wider: the tennis court), side walls 0.7
# inside them, the back wall at BACK_Z, the boardwalk to +-WALK_X.
WEST_X = 56.0
EAST_X = 74.0
MID_X = (EAST_X - WEST_X) / 2              # the centre of the span
SPAN_X = WEST_X + EAST_X
BACK_Z = 39.3
WALK_X = 54.0
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


# ----------------------------------------------------------------------------
# The realism pass (2026-10-02): the shop row, lifeguard towers, beach set
# pieces, the bluffs that close both ends, the lot's back wall and the
# boardwalk, all in MAP coordinates over the colliders in maps.js.

def pal_gb():
    return {
        "stucco": [mat("GS_StuccoA", 0xf0d0c0, 0.9), mat("GS_StuccoB", 0xcfe8e2, 0.9),
                   mat("GS_StuccoC", 0xf4e2b8, 0.9), mat("GS_StuccoD", 0xdcd0ec, 0.9)],
        "wall": mat("GS_StuccoE", 0xe8dcc8, 0.9),
        "drift": mat("GS_Driftwood", 0xb8ad98, 0.9),
        "sand": mat("GS_Sandstone", 0xd8b890, 0.95),
        "deck": mat("GS_Deck", 0xc8a878, 0.85),
        "trim": mat("GB_Trim", 0xe2dccf, 0.6),
        "frame": mat("GB_Frame", 0x2c3238, 0.45, 0.3),
        "shopglass": mat("GB_ShopGlass", 0x2e4a5c, 0.08, 0.2),
        "glass_lit": mat("GB_GlassLit", 0x8fb8c8, 0.1, 0.0, 0xffe8c0, 0.25),
        "under": mat("GB_Under", 0x2a2420, 0.95),
        "roof": mat("GB_Roof", 0x8a8680, 0.95),
        "red": mat("GB_TowerRed", 0xd8452f, 0.55),
        "red_dk": mat("GB_TowerRedDark", 0xa83222, 0.6),
        "post": mat("GB_Post", 0x7a6248, 0.85),
        "metal": mat("GB_Metal", 0x9aa0a6, 0.35, 0.6),
        "rope": mat("GB_Rope", 0xd8ccb0, 0.9),
        "net": mat("GB_Net", 0x1c1c1c, 0.8),
        "ash": mat("GB_Ash", 0x3a3634, 0.95),
        "char": mat("GB_Char", 0x1a1412, 0.9),
        "algae": mat("GB_Algae", 0x3e4a30, 0.8),
        "bush": mat("GB_Bush", 0x4c7a3a, 0.9),
        "bush_dk": mat("GB_BushDark", 0x36602c, 0.9),
        "chair": mat("GB_ChairBlue", 0x2f78c8, 0.6),
        "light": mat("GB_Light", 0xfff2d8, 0.3, 0.0, 0xfff2d8, 1.2),
        "screen": mat("GB_ArcadeScreen", 0x5ad8ff, 0.3, 0.0, 0x5ad8ff, 1.5),
        "screen2": mat("GB_ArcadeScreen2", 0xff5ad0, 0.3, 0.0, 0xff5ad0, 1.5),
        "freezer": mat("GB_Freezer", 0xe8eef2, 0.3, 0.1),
    }


SHOPS = [  # x, width, stucco index, sign colour, theme  (maps.js `shops`)
    (-28, 12, 0, 0xe8574a, "surf"),
    (-12, 10, 1, 0x2fa8b8, "tacos"),
    (4, 11, 2, 0xf2b134, "icecream"),
    (22, 13, 3, 0x8a5ad8, "arcade"),
]
SHOP_Z0, SHOP_Z1, SHOP_H, SHOP_T = 14.5, 23.5, 3.4, 0.45
FRONT_GAP, BACK_GAP = 2.8, 3.4


def hsl_hex(h, s, l):
    import colorsys
    r, g, b = colorsys.hls_to_rgb(h / 360.0, l, s)
    return (int(r * 255) << 16) | (int(g * 255) << 8) | int(b * 255)


def build_shops(P, G):
    b = Builder()
    rng = random.Random(41)
    for (x, w, si, sign, theme) in SHOPS:
        st = G["stucco"][si]
        signm = mat("GB_Sign%d" % si, sign, 0.5)
        x0, x1 = x - w / 2, x + w / 2
        zi0, zi1 = SHOP_Z0 + SHOP_T, SHOP_Z1 - SHOP_T
        # side walls
        for sx in (x0 + SHOP_T / 2, x1 - SHOP_T / 2):
            b.box(st, SHOP_T, SHOP_H, SHOP_Z1 - SHOP_Z0, sx, 0, (SHOP_Z0 + SHOP_Z1) / 2)
        # back wall (lot side) with its door, a lintel over it
        zb = SHOP_Z1 - SHOP_T / 2
        seg = (w - BACK_GAP) / 2
        for sg in (-1, 1):
            b.box(st, seg, SHOP_H, SHOP_T, x + sg * (BACK_GAP / 2 + seg / 2), 0, zb)
        b.box(st, BACK_GAP, SHOP_H - 2.6, SHOP_T, x, 2.6, zb)
        b.box(G["frame"], BACK_GAP + 0.2, 0.12, SHOP_T + 0.06, x, 2.48, zb)
        for sg in (-1, 1):
            b.box(G["frame"], 0.1, 2.6, SHOP_T + 0.06, x + sg * (BACK_GAP / 2 + 0.05), 0, zb)
        # front: storefront windows either side of the open door
        zf = SHOP_Z0 + SHOP_T / 2
        seg = (w - FRONT_GAP) / 2
        for sg in (-1, 1):
            cx = x + sg * (FRONT_GAP / 2 + seg / 2)
            b.box(st, seg, 0.6, SHOP_T, cx, 0, zf)                         # kickplate
            b.box(st, seg, SHOP_H - 2.5, SHOP_T, cx, 2.5, zf)              # band over the glass
            b.box(G["trim"], seg + 0.04, 0.08, SHOP_T + 0.1, cx, 0.6, zf)  # sill
            gl = seg - 0.5
            b.box(G["shopglass"], gl, 1.9, 0.06, cx, 0.6, zf)
            # frame round the glass and a mullion or two
            for ex in (-1, 1):
                b.box(G["frame"], 0.08, 1.9, 0.14, cx + ex * (gl / 2 + 0.04), 0.6, zf)
            b.box(G["frame"], gl + 0.16, 0.08, 0.14, cx, 2.46, zf)
            nm = int(gl // 1.6)
            for k in range(1, nm + 1):
                b.box(G["frame"], 0.06, 1.9, 0.12, cx - gl / 2 + gl * k / (nm + 1), 0.6, zf)
            # the wall piers between glass and door/corner
            for ex in (-1, 1):
                b.box(st, 0.25, 1.9, SHOP_T, cx + ex * (seg / 2 - 0.125), 0.6, zf)
        b.box(st, FRONT_GAP, SHOP_H - 2.6, SHOP_T, x, 2.6, zf)            # over the door
        b.box(G["frame"], FRONT_GAP + 0.2, 0.12, SHOP_T + 0.06, x, 2.48, zf)
        for sg in (-1, 1):
            b.box(G["frame"], 0.1, 2.6, SHOP_T + 0.06, x + sg * (FRONT_GAP / 2 + 0.05), 0, zf)
        b.box(G["under"], FRONT_GAP - 0.4, 0.02, 0.9, x, 0.45, SHOP_Z0 - 0.5)  # door mat on the boardwalk
        # corner pilasters, proud of the facade
        for px in (x0 + 0.25, x1 - 0.25):
            b.box(G["trim"], 0.5, 3.75, 0.12, px, 0, SHOP_Z0 - 0.05)
            b.box(G["trim"], 0.5, 3.75, 0.12, px, 0, SHOP_Z1 + 0.05)
        # roof slab, fascia boards front and back
        b.box(G["roof"], w + 1, 0.3, 10, x, 3.4, 19)
        for zz in (13.95, 24.05):
            b.box(G["trim"], w + 1.1, 0.45, 0.1, x, 3.33, zz)
        b.box(signm, w + 1.1, 0.08, 0.12, x, 3.72, 13.95)
        # roof clutter that stays out of the way: a vent stack at the back corner
        b.cyl(G["metal"], 0.12, (x1 - 0.4, 3.7, 23.6), (x1 - 0.4, 4.15, 23.6), seg=8)
        b.cyl(G["metal"], 0.18, (x1 - 0.4, 4.15, 23.6), (x1 - 0.4, 4.25, 23.6), seg=8)
        # the awning: striped canvas sloping out over the boardwalk (collider
        # z 12.4 .. 14.8 at y 3 .. 3.2), a scalloped valance, two arms
        za, zb2, ya, yb = 14.45, 12.45, 3.28, 3.0
        L = math.hypot(za - zb2, ya - yb)
        ang = math.atan2(ya - yb, za - zb2)
        n = max(2, int(round(w / 0.55)))
        sw = w / n
        for k in range(n):
            m = signm if k % 2 == 0 else G["trim"]
            b.box(m, sw + 0.002, 0.04, L, x0 + sw * (k + 0.5), (ya + yb) / 2 - 0.02, (za + zb2) / 2, rx=ang)
            b.box(m, sw + 0.002, 0.24, 0.03, x0 + sw * (k + 0.5), yb - 0.22, zb2 - 0.01)
            b.cyl(m, sw / 2, (x0 + sw * (k + 0.5), yb - 0.22, zb2 - 0.025), (x0 + sw * (k + 0.5), yb - 0.22, zb2 + 0.005), seg=10)
        for ex in (-1, 1):
            ax = x + ex * (w / 2 - 0.4)
            b.bar(G["frame"], (ax, 2.45, SHOP_Z0 - 0.02), (ax, yb + 0.02, zb2 + 0.15), 0.05)
        # the sign: a framed board on the roof edge (the lettering is a JS canvas)
        sgw = w * 0.7
        b.box(G["frame"], sgw + 0.16, 1.12, 0.18, x, 3.68, 14.26)
        for ex in (-1, 1):
            b.box(G["frame"], 0.08, 0.5, 0.5, x + ex * (sgw / 2 - 0.3), 3.7, 14.55)
        for ex in (-1, 1):  # gooseneck lamps over the board
            lx = x + ex * sgw * 0.3
            b.bar(G["frame"], (lx, 4.8, 14.3), (lx, 4.95, 13.95), 0.04)
            b.cyl(G["frame"], 0.09, (lx, 4.9, 13.9), (lx, 4.98, 13.9), seg=8, r2=0.03)
        # inside: tiled floor, ceiling lights, the counter, a menu board
        b.box(P["tile"], w - 2 * SHOP_T, 0.015, zi1 - zi0, x, 0, (zi0 + zi1) / 2)
        for lz in (16.5, 20.5):
            b.box(G["light"], 1.2, 0.04, 0.3, x, 3.36, lz)
        cw = w - 4
        b.box(P["desk"], cw, 1.05, 1.0, x, 0, 21)
        b.box(G["trim"], cw + 0.1, 0.1, 1.2, x, 1.05, 21)
        for k in range(int(cw // 0.9)):
            b.box(signm, 0.05, 0.8, 0.02, x - cw / 2 + 0.45 + k * 0.9, 0.12, 20.49)
        b.box(G["frame"], 0.35, 0.25, 0.3, x + cw / 2 - 0.5, 1.15, 21)          # register
        b.box(G["frame"], 2.2, 0.9, 0.06, x - w / 2 + SHOP_T + 1.4, 1.9, zi1 - 0.04)   # menu board
        b.box(G["trim"], 2.0, 0.7, 0.02, x - w / 2 + SHOP_T + 1.4, 2.0, zi1 - 0.08)
        # shallow wall shelving on both side walls, stocked by theme
        for ex in (-1, 1):
            sx = x + ex * (w / 2 - SHOP_T - 0.18)
            for yy in (0.4, 1.0, 1.6):
                b.box(P["desk"], 0.36, 0.04, 3.2, sx, yy, 16.9)
            b.box(P["desk"], 0.36, 2.0, 0.05, sx, 0, 15.3)
            b.box(P["desk"], 0.36, 2.0, 0.05, sx, 0, 18.5)
            for yy in (0.44, 1.04, 1.64):
                zz = 15.5
                while zz < 18.3:
                    sz = rng.uniform(0.2, 0.4)
                    c = mat("GB_Goods%d" % rng.randrange(6), [0xd84a3a, 0x3a8ad8, 0xf2c232, 0x5ac87a, 0xe8e2d8, 0x8a5ad8][rng.randrange(6)], 0.6)
                    b.box(c, 0.25, rng.uniform(0.18, 0.45), sz, sx, yy, zz + sz / 2)
                    zz += sz + 0.05
        if theme == "surf":
            # surfboards leaning on the back wall, and two out front
            for k, (bx, c) in enumerate([(x - 4, 0xff7a3a), (x - 3.2, 0x3ab0e8), (x + 3.4, 0xf2e86a), (x + 4.2, 0xe8e8e0)]):
                bm = mat("GB_Board%d" % k, c, 0.35)
                b.box(bm, 0.5, 2.2, 0.06, bx, 0.05, zi1 - 0.25, rx=-0.12)
                b.box(G["trim"], 0.06, 2.1, 0.07, bx, 0.08, zi1 - 0.25, rx=-0.12)
            for k, (bx, c) in enumerate([(x0 + 0.75, 0x3ab0e8), (x1 - 0.75, 0xff5a6a)]):
                bm = mat("GB_BoardOut%d" % k, c, 0.35)
                b.box(bm, 0.5, 2.1, 0.06, bx, 0.45, SHOP_Z0 - 0.2, rx=0.12)
        elif theme == "tacos":
            for k in range(6):
                b.cyl(mat("GB_Sauce", 0xc8301e, 0.3), 0.04, (x - 1.5 + k * 0.25, 1.15, 21), (x - 1.5 + k * 0.25, 1.33, 21), seg=8)
            b.cyl(G["metal"], 0.35, (x + 1, 1.15, 21), (x + 1, 1.3, 21), seg=14)
            b.box(G["metal"], 1.6, 0.9, 0.6, x - 2, 0, zi1 - 0.4)        # griddle station
            b.box(G["frame"], 1.6, 0.04, 0.6, x - 2, 0.9, zi1 - 0.4)
        elif theme == "icecream":
            b.box(G["freezer"], cw - 0.6, 0.15, 0.8, x, 1.15, 21)
            for k in range(8):
                c = mat("GB_Scoop%d" % (k % 4), [0xffc8d8, 0xfff2c8, 0x8a5a3a, 0xc8f0d8][k % 4], 0.5)
                b.box(c, 0.45, 0.06, 0.5, x - (cw - 1.2) / 2 + k * (cw - 1.2) / 7, 1.24, 21)
            # a giant cone by the door
            b.cyl(mat("GB_Cone", 0xd8a050, 0.7), 0.42, (x1 - 0.9, 0.45 + 1.1, SHOP_Z0 - 0.45), (x1 - 0.9, 0.45, SHOP_Z0 - 0.45), seg=12, r2=0.04)
            b.lump(mat("GB_Scoop0", 0xffc8d8, 0.5), 0.9, 0.7, 0.9, x1 - 0.9, 1.45, SHOP_Z0 - 0.45, seed=3)
        elif theme == "arcade":
            for k in range(4):
                for ex in (-1,):
                    cz = 15.6 + k * 0.85
                    cx = x + ex * (w / 2 - SHOP_T - 0.45)
                    b.box(G["frame"], 0.7, 1.8, 0.7, cx + 0.2, 0, cz)
                    b.box(G["screen"] if k % 2 else G["screen2"], 0.04, 0.5, 0.55, cx + 0.57, 1.05, cz)
                    b.box(signm, 0.3, 0.06, 0.6, cx + 0.62, 0.9, cz)
        # back of the shop (the lot): an AC unit, a meter box, a downpipe, a lamp
        b.box(G["metal"], 0.9, 0.7, 0.45, x - w / 2 + 1.2, 1.6, SHOP_Z1 + 0.22)
        b.box(G["frame"], 0.8, 0.6, 0.02, x - w / 2 + 1.2, 1.65, SHOP_Z1 + 0.455)
        b.box(G["frame"], 0.4, 0.55, 0.18, x + w / 2 - 1.1, 1.2, SHOP_Z1 + 0.09)
        b.cyl(G["metal"], 0.05, (x1 - 0.12, 0, SHOP_Z1 + 0.12), (x1 - 0.12, 3.5, SHOP_Z1 + 0.12), seg=6)
        b.box(G["frame"], 0.3, 0.12, 0.25, x, 2.75, SHOP_Z1 + 0.12)
        b.box(G["light"], 0.24, 0.03, 0.18, x, 2.72, SHOP_Z1 + 0.14)
    b.finish("gb-shops.glb")


TOWERS = [(14, -16), (-30, -12), (26, 2)]
TY = 2.1


def build_towers(P, G):
    b = Builder()
    for (tx, tz) in TOWERS:
        # stilts (colliders r 0.22 at +-1.8) with cross bracing
        for (dx, dz) in ((-1.8, -1.8), (1.8, -1.8), (-1.8, 1.8), (1.8, 1.8)):
            b.cyl(G["post"], 0.2, (tx + dx, 0, tz + dz), (tx + dx, TY, tz + dz), seg=10)
        for (a, c) in (((-1.8, -1.8), (1.8, -1.8)), ((-1.8, 1.8), (1.8, 1.8)), ((-1.8, -1.8), (-1.8, 1.8)), ((1.8, -1.8), (1.8, 1.8))):
            b.bar(G["post"], (tx + a[0], 0.3, tz + a[1]), (tx + c[0], TY - 0.15, tz + c[1]), 0.1, 0.06)
            b.bar(G["post"], (tx + a[0], TY - 0.15, tz + a[1]), (tx + c[0], 0.3, tz + c[1]), 0.1, 0.06)
        # the deck and its joists
        b.box(G["red_dk"], 4.6, 0.3, 4.6, tx, TY, tz)
        for k in range(5):
            b.box(G["post"], 4.7, 0.12, 0.12, tx, TY - 0.1, tz - 2.0 + k)
        # half walls of red lap siding (gaps n/s 2.6), white cap
        for (side, w2, d2, cx, cz) in (("n", 4.6, 0.25, tx, tz - 2.175), ("s", 4.6, 0.25, tx, tz + 2.175),
                                       ("w", 0.25, 4.6, tx - 2.175, tz), ("e", 0.25, 4.6, tx + 2.175, tz)):
            spans = [(cx, w2 if side in "ns" else d2)]
            if side in "ns":
                seg = (4.6 - 2.6) / 2
                spans = [(tx - 1.3 - seg / 2, seg), (tx + 1.3 + seg / 2, seg)]
            for (c, L) in spans:
                for k in range(6):
                    y = TY + 0.3 + k * 0.183
                    if side in "ns":
                        b.box(G["red"] if k % 2 == 0 else G["red_dk"], L, 0.17, 0.25 + 0.02 * (k % 2), c, y, cz)
                    else:
                        b.box(G["red"] if k % 2 == 0 else G["red_dk"], 0.25 + 0.02 * (k % 2), 0.17, L, cx, y, c)
                if side in "ns":
                    b.box(G["trim"], L + 0.04, 0.08, 0.32, c, TY + 1.4, cz)
                else:
                    b.box(G["trim"], 0.32, 0.08, L + 0.04, cx, TY + 1.4, c)
        # corner posts and the roof (flat, 5 x 5, a white edge band)
        for (dx, dz) in ((-2.15, -2.15), (2.15, -2.15), (-2.15, 2.15), (2.15, 2.15)):
            b.box(G["trim"], 0.18, 2.3, 0.18, tx + dx, TY + 0.3, tz + dz)
        b.box(G["red"], 5.0, 0.22, 5.0, tx, TY + 2.6, tz)
        b.box(G["trim"], 5.08, 0.12, 5.08, tx, TY + 2.56, tz)
        # LIFEGUARD board under the front eave, a red cross on white
        b.box(G["trim"], 2.4, 0.42, 0.06, tx, TY + 2.12, tz - 2.32)
        b.box(G["red"], 0.36, 0.1, 0.02, tx - 0.9, TY + 2.28, tz - 2.36)
        b.box(G["red"], 0.1, 0.36, 0.02, tx - 0.9, TY + 2.15, tz - 2.36)
        # rescue buoy, flag pole + flag, binoculars on the ledge
        b.cyl(P["orange"], 0.32, (tx + 2.32, TY + 0.9, tz + 0.8), (tx + 2.38, TY + 0.9, tz + 0.8), seg=16)
        b.cyl(G["trim"], 0.18, (tx + 2.31, TY + 0.9, tz + 0.8), (tx + 2.39, TY + 0.9, tz + 0.8), seg=16)
        b.cyl(G["metal"], 0.03, (tx + 2.4, TY + 2.82, tz - 2.4), (tx + 2.4, TY + 5.0, tz - 2.4), seg=6)
        b.box(mat("GB_Flag", 0xe8302a, 0.8), 0.02, 0.6, 0.9, tx + 2.4, TY + 4.35, tz - 2.85)
        b.box(G["frame"], 0.25, 0.1, 0.12, tx - 1.2, TY + 1.48, tz - 2.15)
        # the stair (api.stairs at tz + 6.3, 8 x 0.3 rise x 0.5 run, -z), stringers + rails
        for i in range(8):
            h = 0.3 * (i + 1)
            zz = tz + 6.3 - 0.5 * (i + 0.5)
            b.box(G["red_dk"], 2.4, 0.07, 0.48, tx, h - 0.07, zz)
        for sx in (-1, 1):
            b.prism(G["post"], [(tz + 6.3, 0), (tz + 6.3 - 0.25, 0), (tz + 2.3, TY + 0.15), (tz + 2.3, TY + 0.3), (tz + 6.05, 0.3)],
                    tx + sx * 1.2 - 0.05, tx + sx * 1.2 + 0.05, axis="x")
            b.cyl(G["post"], 0.05, (tx + sx * 1.25, 0, tz + 6.1), (tx + sx * 1.25, 1.1, tz + 6.1), seg=6)
            b.bar(G["trim"], (tx + sx * 1.25, 1.1, tz + 6.1), (tx + sx * 1.25, TY + 1.3, tz + 2.4), 0.06)
    b.finish("gb-towers.glb")


UMBRELLAS = [(-24, -18, 8), (4, -20, 190), (32, -14, 45), (-6, -4, 320)]
FIRE = [(-23, -1.5), (20, -20), (10, 8)]
DRIFT = [(-8, -26, 7, 1), (-46, -17, 6, 1), (-28, 2, 6, 1)]   # (24,-30) moved off the surf


def build_beach(P, G):
    b = Builder()
    rng = random.Random(77)
    # umbrellas: an 8-panel canopy, alternating colour and white, ribs, a
    # scalloped edge, a pole with a tilt joint; a lounger under each
    for (ux, uz, hue) in UMBRELLAS:
        c1 = mat("GB_Umb%d" % hue, hsl_hex(hue, 0.62, 0.58), 0.75)
        R, top, rim = 2.1, 2.85, 2.25
        N = 8
        for k in range(N):
            a0 = 2 * math.pi * k / N
            a1 = 2 * math.pi * (k + 1) / N
            p0 = (ux + R * math.cos(a0), rim, uz + R * math.sin(a0))
            p1 = (ux + R * math.cos(a1), rim, uz + R * math.sin(a1))
            am = (a0 + a1) / 2
            pm = (ux + R * 0.55 * math.cos(am), (rim + top) / 2 + 0.06, uz + R * 0.55 * math.sin(am))
            m = c1 if k % 2 == 0 else G["trim"]
            b.poly(m, [(ux, top, uz), p0, pm, p1], [[0, 1, 2], [0, 2, 3]])
            b.poly(m, [(ux, top - 0.01, uz), p1, pm, p0], [[0, 1, 2], [0, 2, 3]])   # underside
            b.bar(G["metal"], (ux, top - 0.05, uz), (p0[0], rim - 0.02, p0[2]), 0.02)
            # valance flap
            b.poly(m, [p0, p1, (p1[0], rim - 0.2, p1[2]), (p0[0], rim - 0.2, p0[2])], [[0, 1, 2, 3], [3, 2, 1, 0]])
        b.cyl(G["metal"], 0.045, (ux, 0, uz), (ux, top, uz), seg=8)
        b.cyl(G["metal"], 0.07, (ux, 1.6, uz), (ux, 1.75, uz), seg=8)
        b.cyl(c1, 0.06, (ux, top, uz), (ux, top + 0.12, uz), seg=8, r2=0.02)
        # a lounger beside it
        lx, lz = ux + 1.0, uz + 0.6
        b.box(G["chair"], 0.65, 0.05, 1.3, lx, 0.32, lz)
        b.box(G["chair"], 0.65, 0.05, 0.75, lx, 0.55, lz - 0.85, rx=-0.9)
        for (dx, dz) in ((-0.3, -0.55), (0.3, -0.55), (-0.3, 0.6), (0.3, 0.6)):
            b.cyl(G["metal"], 0.02, (lx + dx, 0, lz + dz), (lx + dx, 0.33, lz + dz), seg=5)
    # fire rings (collider cylinder r 1.15 h .45): a cast ring, sand and ash,
    # charred logs (the JS embers glow under them)
    for (fx, fz) in FIRE:
        N = 18
        for k in range(N):
            a = 2 * math.pi * k / N
            cx, cz = fx + 1.0 * math.cos(a), fz + 1.0 * math.sin(a)
            b.box(P["precast"], 0.3, 0.45, 0.4, cx, 0, cz, ry=-a)
        b.cyl(G["ash"], 0.86, (fx, 0, fz), (fx, 0.18, fz), seg=18)
        for k in range(4):
            a = rng.uniform(0, math.pi)
            dx, dz = math.cos(a) * 0.42, math.sin(a) * 0.42
            b.cyl(G["char"], 0.09, (fx - dx, 0.28, fz - dz), (fx + dx, 0.34, fz + dz), seg=7)
    # driftwood logs (collider boxes h .8): a bleached trunk, knots, a stub, roots
    for (dx_, dz_, w, d) in DRIFT:
        along_x = w > d
        L = max(w, d)
        a = Vector((dx_ - L / 2, 0.38, dz_)) if along_x else Vector((dx_, 0.38, dz_ - L / 2))
        c = Vector((dx_ + L / 2, 0.36, dz_)) if along_x else Vector((dx_, 0.36, dz_ + L / 2))
        b.cyl(G["drift"], 0.38, a, c, seg=12, r2=0.3)
        for k in range(4):
            t = rng.uniform(0.15, 0.85)
            p = a.lerp(c, t)
            b.lump(G["drift"], 0.3, 0.25, 0.3, p.x + rng.uniform(-0.1, 0.1), p.y + 0.15, p.z + rng.uniform(-0.1, 0.1), seed=k)
        p = a.lerp(c, 0.6)
        b.cyl(G["drift"], 0.08, p + Vector((0, 0.3, 0)), p + Vector((0.4, 0.75, 0.5)), seg=6, r2=0.03)
        for k in range(3):
            ang = 2 * math.pi * k / 3 + 0.4
            off = Vector((0, math.sin(ang) * 0.35, math.cos(ang) * 0.35)) if along_x else Vector((math.cos(ang) * 0.35, math.sin(ang) * 0.35, 0))
            tip = a - ((c - a).normalized() * 0.35) + off * 1.5
            tip.y = max(0.05, tip.y)
            b.cyl(G["drift"], 0.12, a + off * 0.4, tip, seg=6, r2=0.05)
    # volleyball net: posts at x -2 and 8 (r .12, h 2.6), the net (x -2..8,
    # y 1.5..2.4), tapes, guy lines to stakes
    for px in (-2, 8):
        b.cyl(G["metal"], 0.1, (px, 0, -12), (px, 2.6, -12), seg=10)
        b.cyl(G["frame"], 0.12, (px, 2.6, -12), (px, 2.66, -12), seg=10)
        sx = -1 if px < 3 else 1
        b.cyl(G["rope"], 0.01, (px, 2.4, -12), (px + sx * 2.2, 0.05, -12), seg=4)
        b.box(G["frame"], 0.08, 0.15, 0.08, px + sx * 2.2, 0, -12)
    xa, xb = -1.9, 7.9
    x = xa
    while x <= xb + 0.001:
        b.box(G["net"], 0.012, 0.9, 0.012, x, 1.5, -12)
        x += 0.1
    for k in range(10):
        b.box(G["net"], xb - xa, 0.012, 0.012, (xa + xb) / 2, 1.5 + k * 0.1, -12)
    b.box(G["trim"], xb - xa, 0.07, 0.03, (xa + xb) / 2, 2.36, -12)
    b.box(G["trim"], xb - xa, 0.05, 0.03, (xa + xb) / 2, 1.48, -12)
    for ax in (xa, xb):
        b.box(G["trim"], 0.05, 0.95, 0.03, ax, 1.48, -12)
    # the seawall (collider 80 x 0.8 x 0.75 at z -21): precast blocks with
    # joints, a rounded cap, weed and wet staining on the sea face
    x = -WEST_X
    while x < EAST_X - 0.01:
        L = min(2.5, EAST_X - x)
        b.box(P["precast"], L - 0.03, 0.62, 0.8, x + L / 2, 0, -21)
        b.box(P["precast"], L - 0.03, 0.13, 0.86, x + L / 2, 0.62, -21, bevel=0.04)
        x += L
    b.box(G["algae"], SPAN_X, 0.28, 0.02, MID_X, 0, -21.41)
    b.box(P["wet"], SPAN_X, 0.18, 0.02, MID_X, 0.28, -21.41)
    b.finish("gb-beach.glb")


def build_bluffs(P, G):
    """The two side walls (x -WEST_X + 0.7, EAST_X - 0.7, 1.4 thick, 6 tall, z -44 .. BACK_Z) become
    sandstone bluffs running out into the sea; the back wall (z 31.3) a
    painted retaining wall with a cap and pilasters (the mural is JS)."""
    b = Builder()
    rng = random.Random(9)
    for sx in (-1, 1):
        SIDE_X = (WEST_X if sx < 0 else EAST_X) - 0.7
        z = -48.0
        k = 0
        while z < BACK_Z + 2.7:
            d = rng.uniform(3.0, 5.0)
            h = rng.uniform(6.2, 7.6) if z > -22 else rng.uniform(6.1, 6.8)
            w = rng.uniform(3.6, 5.2)
            cx = sx * (SIDE_X - 0.75 + w / 2 - 0.05)
            b.lump(G["sand"], w, h, d + 0.8, cx, -0.3, z + d / 2, seed=k, rnd=0.35, jitter=0.12, ry=rng.uniform(-0.15, 0.15))
            if rng.random() < 0.7:
                b.lump(G["sand"], w * 0.7, h * 0.45, d * 0.6, cx + sx * 0.8, h - 0.8, z + d / 2 + rng.uniform(-0.5, 0.5), seed=k + 50)
            if z > -20 and rng.random() < 0.8:
                b.lump(G["bush"] if rng.random() < 0.5 else G["bush_dk"], rng.uniform(1.2, 2.2), rng.uniform(0.6, 1.0), rng.uniform(1.2, 2.0),
                       cx + sx * rng.uniform(0, 1.2), h - 0.25, z + d / 2, seed=k + 90)
            z += d * 0.82
            k += 1
        # boulders at the foot, half in the sand
        for j in range(10):
            zz = rng.uniform(-44, BACK_Z - 6)
            s = rng.uniform(0.6, 1.3)
            b.lump(G["sand"], s * 1.4, s, s * 1.2, sx * rng.uniform(SIDE_X - 1.3, SIDE_X - 0.9), -0.15, zz, seed=200 + j)
    # back wall
    b.box(G["wall"], SPAN_X, 6, 1.4, MID_X, 0, BACK_Z)
    b.box(G["trim"], SPAN_X + 0.4, 0.25, 1.7, MID_X, 6, BACK_Z)
    for k in range(int(SPAN_X / 8) + 1):
        b.box(G["trim"], 0.7, 6.0, 1.6, -WEST_X + k * 8, 0, BACK_Z)
    b.box(P["wet"], SPAN_X, 0.35, 0.02, MID_X, 0, BACK_Z - 0.71)
    b.finish("gb-bluffs.glb")


WALK_RAILS = ((-(WALK_X + 16) / 2, WALK_X - 16), (0, 14), ((WALK_X + 16) / 2, WALK_X - 16))   # maps.js: the same runs


def build_boardwalk(P, G):
    """api.box(x+3, 12, 6, 7, 0.45) sections x -WALK_X .. WALK_X (z 8.5 .. 15.5),
    the sand-side rail (z 8.7, 0.25 thick, 1 tall at y .45) with gaps at x
    +-15, and the 2-step stairs there."""
    b = Builder()
    rng = random.Random(3)
    y = 0.45
    b.box(G["under"], WALK_X * 2, 0.33, 7, 0, 0, 12)
    x = -WALK_X
    while x < WALK_X - 0.01:
        w = 0.17
        b.box(G["deck"], w - 0.018, 0.1, 7.0, x + w / 2, y - 0.1, 12 + rng.uniform(-0.02, 0.02))
        x += w
    b.box(G["deck"], WALK_X * 2, 0.36, 0.06, 0, 0.06, 8.52)       # fascia board on the sand side
    for xx in range(-int(WALK_X), int(WALK_X) + 1, 2):
        b.box(G["post"], 0.16, 0.42, 0.16, xx, 0, 8.6)
    # the rail: posts every 2 m, top + mid rails, balusters
    for (rx, rw) in WALK_RAILS:
        x0, x1 = rx - rw / 2, rx + rw / 2
        xx = x0
        while xx <= x1 + 0.01:
            b.box(G["deck"], 0.14, 1.0, 0.14, xx, y, 8.7)
            xx += 2.0
        b.box(G["deck"], rw, 0.06, 0.22, rx, y + 0.98, 8.7)
        b.box(G["deck"], rw, 0.08, 0.08, rx, y + 0.12, 8.7)
        b.box(G["deck"], rw, 0.08, 0.08, rx, y + 0.86, 8.7)
        xx = x0 + 0.1
        while xx < x1:
            b.box(G["deck"], 0.04, 0.74, 0.04, xx, y + 0.2, 8.7)
            xx += 0.16
    # stairs at x +-15 (api.stairs(.., 7.6, 5, 2, 0.25, 0.6, "+z"))
    for sx in (-15, 15):
        for i in range(2):
            h = 0.25 * (i + 1)
            zz = 7.6 + 0.6 * (i + 0.5)
            b.box(G["deck"], 5.0, 0.06, 0.58, sx, h - 0.06, zz)
            b.box(G["under"], 4.9, h - 0.06, 0.5, sx, 0, zz)
    b.finish("gb-boardwalk.glb")


# ----------------------------------------------------------------------------
# Grin Beach 5a, "Venice": the strips the bigger map added. grinbeach-venice.js
# lays the same layout's colliders: change one, change the other.

MUSCLE = (-48.0, -4.0, 13.0, 12.0)        # centre x, z, width (x), depth (z)
SKATE = (-48.0, 23.5, 13.0, 13.0)
COURT = (48.0, -6.0, 14.0, 26.0)          # the basketball court's slab
COURT_LINES = (41.5, 54.5, -18.5, 6.5)    # its painted boundary
HOOP_Z = (-17.8, 5.8)                     # the backboards' faces (rims 0.38 in front)
RIM_Y = 3.05
STALLS = [(41.5, "ice"), (46.5, "tees"), (51.5, "shades"), (-42.0, "henna"), (-48.0, "psychic")]
STALL_Z = 14.2
VB = (-1.0, 7.0, -19.5, -4.5)             # volleyball court lines (x0, x1, z0, z1)
RACKS = [(-28.0, 6.5), (10.0, -19.4)]
# the tennis court (user, 2026-10-23: "do both", the map wider for it): a
# full-size court (doubles lines 10.97 x 23.77, the net across z) on an
# acrylic slab with 2 m round it, fenced, past the basketball court
TENNIS = (64.5, -6.1, 15.0, 27.8)          # the slab: centre x, z, width (x), depth (z)
TENNIS_GATES = (("w", 1.0, 4.0), ("n", 61.0, 64.0))   # fence gaps: side, from, to


def pal_venice():
    return {
        "pad": mat("GV_Pad", 0xa8a49a, 0.95),
        "pad_dk": mat("GV_PadDark", 0x8c887e, 0.95),
        "mat": mat("GV_RubberMat", 0x2a2a2c, 0.95),
        "blue": mat("GV_RailBlue", 0x2f6cc8, 0.45, 0.2),
        "chrome": mat("GV_Chrome", 0xc8ccd0, 0.25, 0.85),
        "iron": mat("GV_Iron", 0x2a2c30, 0.5, 0.6),
        "plate_red": mat("GV_PlateRed", 0xb8262a, 0.6),
        "vinyl": mat("GV_Vinyl", 0x1c1c22, 0.7),
        "asphalt": mat("GV_Asphalt", 0x55585c, 0.95),
        "court_green": mat("GV_CourtGreen", 0x3e7a5a, 0.85),
        "court_blue": mat("GV_CourtBlue", 0x2e5f9e, 0.85),
        "line": mat("GV_Line", 0xf2f0e8, 0.8),
        "board": mat("GV_Backboard", 0xf4f4f0, 0.35),
        "rim": mat("GV_Rim", 0xe0561e, 0.4, 0.5),
        "netw": mat("GV_Net", 0xf0f0ea, 0.9),
        "post": mat("GV_PostGrey", 0x6c7176, 0.4, 0.6),
        "alu": mat("GV_Alu", 0xb8bcc0, 0.35, 0.7),
        "granite": mat("GV_Granite", 0x9a948c, 0.7),
        "coping": mat("GV_Coping", 0xb0b4b8, 0.3, 0.8),
        "ramp": mat("GV_RampPaint", 0x5a6670, 0.8),
        "tape": mat("GV_VBTape", 0x2f7ad8, 0.8),
        "canvas_a": mat("GV_CanopyWhite", 0xf2efe6, 0.85),
        "canopies": [mat("GV_CanopyRed", 0xe2483a, 0.85), mat("GV_CanopyTeal", 0x2aa8a0, 0.85),
                     mat("GV_CanopyYellow", 0xf2b52e, 0.85), mat("GV_CanopyPink", 0xe86aa8, 0.85),
                     mat("GV_CanopyPurple", 0x8a5ad8, 0.85)],
        "wood": mat("GV_StallWood", 0xb08454, 0.85),
        "wood_dk": mat("GV_StallWoodDark", 0x7a5634, 0.9),
        "cups": [mat("GV_SyrupRed", 0xe8304a, 0.4), mat("GV_SyrupBlue", 0x2f8ae8, 0.4), mat("GV_SyrupGreen", 0x3ac85a, 0.4)],
        "tee": [mat("GV_TeeWhite", 0xf2f0ea, 0.9), mat("GV_TeeBlack", 0x1e1e22, 0.9),
                mat("GV_TeeTeal", 0x2ab0a8, 0.9), mat("GV_TeeOrange", 0xf08a2a, 0.9)],
        "lens": mat("GV_Lens", 0x101418, 0.1, 0.6),
        "crystal": mat("GV_Crystal", 0x9ad8f0, 0.05, 0.1, 0x6ab8e8, 0.6),
        "boards": [mat("GV_SurfA", 0xf4ead2, 0.35), mat("GV_SurfB", 0x3ab8d8, 0.35), mat("GV_SurfC", 0xf0702a, 0.35),
                   mat("GV_SurfD", 0xf2d23a, 0.35), mat("GV_SurfE", 0xe84a7a, 0.35)],
    }


def ring(b, m, cx, y, cz, r, w=0.08, seg=40, a0=0.0, a1=math.tau, h=0.006):
    """A painted arc on the ground (or a hoop): short boxes round a circle."""
    n = max(3, int(seg * abs(a1 - a0) / math.tau))
    for i in range(n):
        a = a0 + (a1 - a0) * (i + 0.5) / n
        L = r * abs(a1 - a0) / n * 1.06
        b.box(m, L, h, w, cx + r * math.cos(a), y, cz + r * math.sin(a), ry=-a + math.pi / 2)


def line(b, m, x0, z0, x1, z1, y=0.06, w=0.08):
    L = math.hypot(x1 - x0, z1 - z0)
    b.box(m, L, 0.006, w, (x0 + x1) / 2, y, (z0 + z1) / 2, ry=-math.atan2(z1 - z0, x1 - x0))


def fence_run(b, V, x0, z0, x1, z1, h=1.0, gaps=()):
    """Blue tube rails (Muscle Beach): posts every ~2 m, two rails, open
    over `gaps` ((a, b) fractions along the run)."""
    L = math.hypot(x1 - x0, z1 - z0)
    spans = [(0.0, 1.0)]
    for (ga, gb) in gaps:
        out = []
        for (sa, sb) in spans:
            if gb <= sa or ga >= sb:
                out.append((sa, sb))
                continue
            if ga > sa:
                out.append((sa, ga))
            if gb < sb:
                out.append((gb, sb))
        spans = out
    for (sa, sb) in spans:
        pa = (x0 + (x1 - x0) * sa, z0 + (z1 - z0) * sa)
        pb = (x0 + (x1 - x0) * sb, z0 + (z1 - z0) * sb)
        n = max(1, round(L * (sb - sa) / 2.0))
        for i in range(n + 1):
            k = i / n
            px, pz = pa[0] + (pb[0] - pa[0]) * k, pa[1] + (pb[1] - pa[1]) * k
            b.cyl(V["blue"], 0.045, (px, 0.06, pz), (px, h, pz), seg=10)
            b.cyl(V["blue"], 0.06, (px, h, pz), (px, h + 0.05, pz), seg=10)
        for y in (h - 0.02, h * 0.5):
            b.cyl(V["blue"], 0.035, (pa[0], y, pa[1]), (pb[0], y, pb[1]), seg=10)


def barbell(b, V, x, y, z, along_x=True, plates=2):
    a = (x - 1.1, y, z) if along_x else (x, y, z - 1.1)
    c = (x + 1.1, y, z) if along_x else (x, y, z + 1.1)
    b.cyl(V["chrome"], 0.016, a, c, seg=10)
    for s in (-1, 1):
        for k in range(plates):
            off = 0.72 + k * 0.07
            p0 = (x + s * off, y, z) if along_x else (x, y, z + s * off)
            p1 = (x + s * (off + 0.055), y, z) if along_x else (x, y, z + s * (off + 0.055))
            b.cyl(V["plate_red"] if k == 0 else V["iron"], 0.225 - k * 0.05, p0, p1, seg=20)


def bench(b, V, x, z):
    """A flat bench (along z) with its rack at the head and the bar racked."""
    b.box(V["vinyl"], 0.32, 0.1, 1.25, x, 0.38, z, bevel=0.03)
    b.box(V["iron"], 0.12, 0.38, 1.05, x, 0.0, z)
    for px in (-0.55, 0.55):
        b.box(V["iron"], 0.07, 1.15, 0.07, x + px, 0.0, z - 0.45)
        b.box(V["iron"], 0.07, 0.07, 0.16, x + px, 1.0, z - 0.4)
    barbell(b, V, x, 1.1, z - 0.38)


def surfboard(b, m, M, L=2.1, W=0.52, T=0.07):
    """A board's outline (nose and tail rounded, widest a little forward),
    extruded T thick, placed by the 4x4 matrix M: local x across, y up
    through the deck, z nose to tail."""
    n = 18
    half = []
    for i in range(n + 1):
        t = i / n
        z = -L / 2 + L * t
        w = W / 2 * (math.sin(math.pi * (0.04 + 0.92 * t)) ** 0.55) * (1.0 - 0.18 * t)
        half.append((z, w))
    outline = [(w, z) for z, w in half] + [(-w, z) for z, w in half[::-1]]
    k = len(outline)
    pts = [tuple(M @ Vector((x, -T / 2, z))) for x, z in outline] + [tuple(M @ Vector((x, T / 2, z))) for x, z in outline]
    faces = [list(range(k)), list(range(2 * k - 1, k - 1, -1))]
    for i in range(k):
        j = (i + 1) % k
        faces.append([i, j, k + j, k + i])
    b.poly(m, pts, faces)


def build_venice(P, G):
    import mathutils
    V = pal_venice()
    b = Builder()

    # --- Muscle Beach: a fenced concrete pit of iron on the west strip
    mx, mz, mw, md = MUSCLE
    b.box(V["pad_dk"], mw + 0.3, 0.05, md + 0.3, mx, 0.0, mz)
    b.box(V["pad"], mw, 0.06, md, mx, 0.0, mz)
    b.box(V["mat"], 6.5, 0.03, 4.0, -50.0, 0.06, -7.2)
    b.box(V["mat"], 3.0, 0.03, 3.0, -46.0, 0.06, -7.0)
    x0, x1, z0, z1 = mx - mw / 2, mx + mw / 2, mz - md / 2, mz + md / 2
    fence_run(b, V, x0, z0, x1, z0)
    fence_run(b, V, x0, z1, x1, z1, gaps=((0.42, 0.62),))          # north: to the boardwalk
    fence_run(b, V, x0, z0, x0, z1)
    fence_run(b, V, x1, z0, x1, z1, gaps=((0.38, 0.62),))          # east: in from the sand
    # the arch over the east gate (its sign board is a canvas in JS)
    for gz in (mz - 1.6, mz + 1.6):
        b.box(V["blue"], 0.18, 3.4, 0.18, x1, 0.0, gz, bevel=0.02)
    b.box(V["blue"], 0.22, 0.22, 3.6, x1, 3.3, mz, bevel=0.02)
    # benches with racked bars, a squat cage, a pull-up / rings frame,
    # dumbbells on an A-frame, plates on a tree
    for bx in (-52.0, -49.5):
        bench(b, V, bx, -7.0)
    cx, cz = -46.0, -7.0
    for (dx, dz) in ((-0.6, -0.6), (0.6, -0.6), (-0.6, 0.6), (0.6, 0.6)):
        b.box(V["iron"], 0.08, 2.3, 0.08, cx + dx, 0.06, cz + dz)
    for (a, c) in (((-0.6, -0.6), (0.6, -0.6)), ((-0.6, 0.6), (0.6, 0.6)), ((-0.6, -0.6), (-0.6, 0.6)), ((0.6, -0.6), (0.6, 0.6))):
        b.bar(V["iron"], (cx + a[0], 2.32, cz + a[1]), (cx + c[0], 2.32, cz + c[1]), 0.08)
    for dx in (-0.6, 0.6):
        b.box(V["iron"], 0.12, 0.05, 0.2, cx + dx, 1.4, cz - 0.5)
    barbell(b, V, cx, 1.47, cz - 0.5, along_x=True, plates=3)
    fx, fz = -51.5, -1.0
    for dz in (-1.6, 1.6):
        b.cyl(V["iron"], 0.06, (fx, 0.06, fz + dz), (fx, 2.9, fz + dz), seg=12)
        b.box(V["iron"], 0.5, 0.06, 0.5, fx, 0.06, fz + dz)
    b.cyl(V["chrome"], 0.025, (fx, 2.75, fz - 1.7), (fx, 2.75, fz + 1.7), seg=10)
    for rz in (fz - 0.25, fz + 0.25):
        b.cyl(V["netw"], 0.008, (fx, 2.74, rz), (fx, 1.8, rz), seg=4)
        ring(b, V["wood"], fx, 1.62, rz, 0.1, w=0.03, seg=14, h=0.03)
    b.cyl(V["chrome"], 0.025, (fx, 2.1, fz + 0.6), (fx, 2.1, fz + 1.5), seg=10)
    dx_, dz_ = -45.5, 0.5
    b.box(V["iron"], 2.4, 0.06, 0.5, dx_, 0.75, dz_)
    for sx in (-1.1, 1.1):
        b.bar(V["iron"], (dx_ + sx, 0.06, dz_ - 0.3), (dx_ + sx, 0.78, dz_), 0.06)
        b.bar(V["iron"], (dx_ + sx, 0.06, dz_ + 0.3), (dx_ + sx, 0.78, dz_), 0.06)
    for k in range(7):
        x = dx_ - 1.0 + k * 0.33
        r = 0.07 + 0.012 * k
        b.cyl(V["chrome"], 0.015, (x, 0.81 + r, dz_ - 0.19), (x, 0.81 + r, dz_ + 0.19), seg=8)
        for s in (-1, 1):
            b.cyl(V["iron"], r, (x, 0.81 + r, dz_ + s * 0.12), (x, 0.81 + r, dz_ + s * 0.19), seg=10)
    tx, tz = -53.0, 1.0
    b.cyl(V["iron"], 0.05, (tx, 0.06, tz), (tx, 1.2, tz), seg=8)
    b.box(V["iron"], 0.6, 0.05, 0.6, tx, 0.06, tz)
    for k, y in enumerate((0.35, 0.65, 0.95)):
        for s in (-1, 1):
            b.cyl(V["iron"], 0.02, (tx, y, tz), (tx + s * 0.22, y, tz), seg=6)
            b.cyl(V["plate_red"] if k == 0 else V["iron"], 0.2 - k * 0.04, (tx + s * 0.08, y, tz), (tx + s * 0.13, y, tz), seg=18)

    # --- the skate plaza: a ledge, a rail, a funbox with banks, a quarter pipe
    sx_, sz_, sw, sd = SKATE
    b.box(V["pad"], sw, 0.08, sd, sx_, 0.0, sz_, bevel=0.03)
    for k in range(1, 6):
        zz = sz_ - sd / 2 + k * sd / 6
        line(b, V["pad_dk"], sx_ - sw / 2, zz, sx_ + sw / 2, zz, y=0.081, w=0.03)
    b.box(V["granite"], 6.0, 0.45, 0.6, -47.0, 0.08, 19.5, bevel=0.03)        # the ledge
    b.box(V["coping"], 6.0, 0.04, 0.08, -47.0, 0.53, 19.22)
    for px in (-46.5, -42.8):                                                  # the rail
        b.cyl(V["iron"], 0.04, (px, 0.08, 26.5), (px, 0.78, 26.5), seg=10)
    b.cyl(V["coping"], 0.035, (-46.8, 0.8, 26.5), (-42.5, 0.8, 26.5), seg=10)
    fbx, fbz = -49.0, 24.0                                                     # the funbox
    b.box(V["ramp"], 3.0, 0.42, 2.0, fbx, 0.08, fbz, bevel=0.02)
    for s in (-1, 1):
        b.box(V["coping"], 3.0, 0.04, 0.06, fbx, 0.5, fbz + s * 1.0)
        e = fbx + s * 1.5
        b.prism(V["ramp"], [(e, 0.08), (e + s * 1.6, 0.08), (e, 0.5)], fbz - 1.0, fbz + 1.0, axis="z")
    prof = [(-52.4, 0.08)]                                                     # the quarter pipe
    for i in range(1, 9):
        a = (i / 8) * (math.pi / 2) * 0.86
        prof.append((-52.4 - 1.9 * math.sin(a), 0.08 + 1.9 * (1 - math.cos(a))))
    lipx, lipy = prof[-1]
    prof += [(-54.5, lipy), (-54.5, 0.08)]
    b.prism(V["ramp"], prof, 18.0, 29.0, axis="z")
    b.cyl(V["coping"], 0.04, (lipx, lipy, 18.0), (lipx, lipy, 29.0), seg=10)

    # --- the basketball court (east strip): asphalt, green paint, blue keys,
    # white lines, two hoops, posts for the fence (its chain link is JS)
    cx, cz, cw, cd = COURT
    b.box(V["asphalt"], cw + 1.0, 0.05, cd + 1.0, cx, 0.0, cz)
    lx0, lx1, lz0, lz1 = COURT_LINES
    b.box(V["court_green"], lx1 - lx0, 0.006, lz1 - lz0, (lx0 + lx1) / 2, 0.05, (lz0 + lz1) / 2)
    for (bz, s) in ((lz0, 1), (lz1, -1)):
        b.box(V["court_blue"], 4.9, 0.006, 5.8, cx, 0.056, bz + s * 2.9)
    Y = 0.062
    for (a, c) in (((lx0, lz0), (lx1, lz0)), ((lx0, lz1), (lx1, lz1)), ((lx0, lz0), (lx0, lz1)), ((lx1, lz0), (lx1, lz1)), ((lx0, cz), (lx1, cz))):
        line(b, V["line"], a[0], a[1], c[0], c[1], y=Y)
    ring(b, V["line"], cx, Y, cz, 1.8)
    for (bz, s, hz) in ((lz0, 1, HOOP_Z[0]), (lz1, -1, HOOP_Z[1])):
        ft = bz + s * 5.8
        for kx in (cx - 2.45, cx + 2.45):
            line(b, V["line"], kx, bz, kx, ft, y=Y)
        line(b, V["line"], cx - 2.45, ft, cx + 2.45, ft, y=Y)
        ring(b, V["line"], cx, Y, ft, 1.8, a0=(0.0 if s > 0 else math.pi), a1=(math.pi if s > 0 else math.tau))
        rimz = hz + s * 0.38
        r3, cxl = 6.0, lx1 - 0.6 - cx
        corner = math.sqrt(max(0.0, r3 * r3 - cxl * cxl))
        for kx in (lx0 + 0.6, lx1 - 0.6):
            line(b, V["line"], kx, bz, kx, rimz + s * corner, y=Y)
        ang = math.acos(min(1.0, cxl / r3))
        if s > 0:
            ring(b, V["line"], cx, Y, rimz, r3, a0=ang, a1=math.pi - ang, seg=70)
        else:
            ring(b, V["line"], cx, Y, rimz, r3, a0=math.pi + ang, a1=math.tau - ang, seg=70)
        # pole behind the baseline, the arm, the board, the rim and its net
        pz = bz - s * 1.1
        b.box(V["post"], 0.3, 0.25, 0.3, cx, 0.0, pz, bevel=0.03)
        b.cyl(V["post"], 0.1, (cx, 0.0, pz), (cx, 3.55, pz), seg=14)
        b.bar(V["post"], (cx, 3.45, pz), (cx, 3.45, hz - s * 0.05), 0.1)
        b.box(V["board"], 1.8, 1.05, 0.05, cx, 2.9, hz - s * 0.025, bevel=0.01)
        b.box(V["line"], 1.84, 0.05, 0.07, cx, 3.93, hz - s * 0.025)
        for y in (3.0, 3.4):
            b.box(V["vinyl"], 0.59, 0.05, 0.012, cx, y, hz + s * 0.006)
        for kx in (cx - 0.295, cx + 0.295):
            b.box(V["vinyl"], 0.05, 0.45, 0.012, kx, 3.0, hz + s * 0.006)
        ring(b, V["rim"], cx, RIM_Y, rimz, 0.23, w=0.02, seg=24, h=0.02)
        b.box(V["rim"], 0.12, 0.03, 0.16, cx, RIM_Y, hz + s * 0.08)
        for i in range(12):
            a = i / 12 * math.tau
            top = (cx + 0.23 * math.cos(a), RIM_Y, rimz + 0.23 * math.sin(a))
            bot = (cx + 0.14 * math.cos(a + 0.5), RIM_Y - 0.42, rimz + 0.14 * math.sin(a + 0.5))
            b.cyl(V["netw"], 0.006, top, bot, seg=4, smooth=False)
        ring(b, V["netw"], cx, RIM_Y - 0.42, rimz, 0.14, w=0.01, seg=16, h=0.01)
    for fz in (cz - cd / 2 - 0.2, cz + cd / 2 + 0.2):                         # fence posts + rails
        x = cx - cw / 2
        while x <= cx + cw / 2 + 0.01:
            b.cyl(V["post"], 0.045, (x, 0.0, fz), (x, 3.4, fz), seg=10)
            x += 2.0
        for y in (3.38, 0.12):
            b.cyl(V["post"], 0.03, (cx - cw / 2, y, fz), (cx + cw / 2, y, fz), seg=8)
    for k in range(3):                                                         # bleachers, west side
        bx = 38.0 + k * 0.85
        y = 0.4 + k * 0.42
        b.box(V["alu"], 0.34, 0.05, 12.0, bx + 0.1, y, -7.0, bevel=0.01)
        b.box(V["alu"], 0.22, 0.04, 12.0, bx - 0.25, y - 0.22, -7.0)
    for z in (-12.8, -7.0, -1.2):
        b.bar(V["post"], (37.7, 0.0, z), (40.2, 1.35, z), 0.06)
        b.bar(V["post"], (40.2, 0.0, z), (40.2, 1.35, z), 0.06)
        b.bar(V["post"], (37.9, 0.0, z), (37.9, 0.42, z), 0.06)

    # --- vendor stalls along the boardwalk's new ends: a counter, posts,
    # a striped canopy, and what they sell (the signs are JS)
    WY = 0.45
    for i, (sxp, kind) in enumerate(STALLS):
        can = V["canopies"][i % len(V["canopies"])]
        b.box(V["wood"], 2.6, 0.95, 0.9, sxp, WY, STALL_Z, bevel=0.02)
        b.box(V["wood_dk"], 2.7, 0.06, 1.0, sxp, WY + 0.95, STALL_Z)
        for (dx, dz) in ((-1.3, -0.55), (1.3, -0.55), (-1.3, 0.8), (1.3, 0.8)):
            b.box(V["wood_dk"], 0.08, 2.3 if dz < 0 else 2.6, 0.08, sxp + dx, WY, STALL_Z + dz)
        for k in range(8):
            x = sxp - 1.4 + (k + 0.5) * 0.35
            m_ = can if k % 2 == 0 else V["canvas_a"]
            b.box(m_, 0.35, 0.05, 1.7, x, WY + 2.42, STALL_Z + 0.12, rx=0.16)
            b.box(m_, 0.35, 0.24, 0.03, x, WY + 2.12, STALL_Z - 0.74)
        top = WY + 1.01
        if kind == "ice":
            for k in range(9):
                x = sxp - 1.0 + (k % 5) * 0.48
                z = STALL_Z - 0.15 + (k // 5) * 0.3
                b.cyl(V["canvas_a"], 0.06, (x, top, z), (x, top + 0.13, z), seg=10, r2=0.075)
                b.lump(V["cups"][k % 3], 0.15, 0.1, 0.15, x, top + 0.12, z, seed=k, rnd=0.6)
            b.box(V["chrome"], 0.5, 0.45, 0.45, sxp + 0.9, top, STALL_Z + 0.2, bevel=0.03)
        elif kind == "tees":
            b.cyl(V["chrome"], 0.02, (sxp - 1.25, WY + 2.0, STALL_Z - 0.5), (sxp + 1.25, WY + 2.0, STALL_Z - 0.5), seg=8)
            for k in range(6):
                x = sxp - 1.05 + k * 0.42
                t = V["tee"][k % 4]
                b.box(t, 0.36, 0.5, 0.03, x, WY + 1.45, STALL_Z - 0.5)
                b.box(t, 0.58, 0.14, 0.03, x, WY + 1.81, STALL_Z - 0.5)
            for k in range(4):
                b.box(V["tee"][k], 0.34, 0.06, 0.3, sxp - 0.8 + k * 0.5, top, STALL_Z + 0.05)
        elif kind == "shades":
            b.box(V["wood_dk"], 0.5, 1.1, 0.12, sxp, top, STALL_Z - 0.1)
            for row in range(4):
                for col in range(2):
                    x, y = sxp - 0.12 + col * 0.24, top + 0.2 + row * 0.24
                    for s in (-1, 1):
                        b.cyl(V["lens"], 0.04, (x + s * 0.045, y, STALL_Z - 0.165), (x + s * 0.045, y, STALL_Z - 0.18), seg=10)
                    b.box(V["vinyl"], 0.2, 0.012, 0.012, x, y + 0.03, STALL_Z - 0.18)
        elif kind == "henna":
            for k in range(3):
                b.box(V["canvas_a"], 0.5, 0.008, 0.35, sxp - 0.7 + k * 0.7, top, STALL_Z)
            b.box(V["wood"], 0.45, 0.45, 0.45, sxp, WY, STALL_Z - 1.2)
        elif kind == "psychic":
            b.box(V["canopies"][4], 2.4, 0.02, 0.8, sxp, top, STALL_Z)
            b.cyl(V["iron"], 0.1, (sxp, top, STALL_Z), (sxp, top + 0.1, STALL_Z), seg=12, r2=0.06)
            b.lump(V["crystal"], 0.28, 0.28, 0.28, sxp, top + 0.08, STALL_Z, seed=3, rnd=1.0, jitter=0.0)

    # --- volleyball: tape lines round the court, a referee's chair, bleachers
    vx0, vx1, vz0, vz1 = VB
    for (a, c) in (((vx0, vz0), (vx1, vz0)), ((vx0, vz1), (vx1, vz1)), ((vx0, vz0), (vx0, vz1)), ((vx1, vz0), (vx1, vz1))):
        line(b, V["tape"], a[0], a[1], c[0], c[1], y=0.012, w=0.06)
    rcx, rcz = 8.9, -10.6
    for (dx, dz) in ((-0.35, -0.35), (0.35, -0.35), (-0.35, 0.35), (0.35, 0.35)):
        b.bar(V["alu"], (rcx + dx * 1.3, 0.0, rcz + dz * 1.3), (rcx + dx * 0.6, 1.9, rcz + dz * 0.6), 0.05)
    b.box(V["wood"], 0.6, 0.06, 0.6, rcx, 1.9, rcz)
    b.box(V["wood"], 0.6, 0.5, 0.06, rcx, 1.96, rcz + 0.28)
    for k in range(5):
        b.bar(V["alu"], (rcx - 0.4, 0.35 * k + 0.2, rcz - 0.42), (rcx + 0.4, 0.35 * k + 0.2, rcz - 0.42), 0.03)
    for k in range(3):
        b.box(V["alu"], 0.3, 0.05, 4.8, 9.7 + k * 0.6, 0.4 + k * 0.38, -7.0, bevel=0.01)
    for z in (-9.2, -4.8):
        b.bar(V["post"], (9.5, 0.0, z), (11.1, 1.2, z), 0.05)
        b.bar(V["post"], (11.1, 0.0, z), (11.1, 1.2, z), 0.05)

    # --- the tennis court: green slab, blue court, white lines, the net on
    # its posts, an umpire's chair, players' benches, fence posts (the chain
    # link is JS) and bleachers outside the north fence
    tx, tz, tw, td = TENNIS
    b.box(V["asphalt"], tw + 0.4, 0.05, td + 0.4, tx, 0.0, tz)
    b.box(V["court_green"], tw, 0.006, td, tx, 0.05, tz)
    dw, dl, sw_ = 10.97 / 2, 23.77 / 2, 8.23 / 2
    b.box(V["court_blue"], dw * 2, 0.006, dl * 2, tx, 0.053, tz)
    Y = 0.059
    for kx in (tx - dw, tx + dw, tx - sw_, tx + sw_):                          # side lines
        line(b, V["line"], kx, tz - dl, kx, tz + dl, y=Y, w=0.05)
    for kz in (tz - dl, tz + dl):                                              # baselines + centre marks
        line(b, V["line"], tx - dw, kz, tx + dw, kz, y=Y, w=0.08)
        line(b, V["line"], tx, kz, tx, kz - math.copysign(0.1, kz - tz), y=Y, w=0.05)
    for kz in (tz - 6.4, tz + 6.4):                                            # service lines
        line(b, V["line"], tx - sw_, kz, tx + sw_, kz, y=Y, w=0.05)
    line(b, V["line"], tx, tz - 6.4, tx, tz + 6.4, y=Y, w=0.05)               # centre service line
    for px in (tx - dw - 0.914, tx + dw + 0.914):                             # net posts
        b.cyl(V["post"], 0.05, (px, 0.0, tz), (px, 1.07, tz), seg=12)
        b.cyl(V["post"], 0.06, (px, 1.07, tz), (px, 1.1, tz), seg=12)
    nl = tx - dw - 0.914, tx + dw + 0.914
    for i in range(24):                                                        # the net sags to 0.914
        a, c = i / 24, (i + 1) / 24
        xa, xc = nl[0] + (nl[1] - nl[0]) * a, nl[0] + (nl[1] - nl[0]) * c
        ya = 1.07 - 0.156 * (1 - (2 * a - 1) ** 2)
        yc = 1.07 - 0.156 * (1 - (2 * c - 1) ** 2)
        xm, ym = (xa + xc) / 2, (ya + yc) / 2
        b.box(V["vinyl"], xc - xa + 0.01, ym - 0.08, 0.012, xm, 0.08, tz)     # the mesh (dark)
        b.box(V["netw"], xc - xa + 0.01, 0.06, 0.02, xm, ym - 0.06, tz)       # the white band
    b.box(V["netw"], 0.05, 0.914 - 0.08, 0.016, tx, 0.08, tz)                 # the centre strap
    ux = tx + dw + 1.6                                                         # umpire's chair, east
    for (dx, dz) in ((-0.35, -0.35), (0.35, -0.35), (-0.35, 0.35), (0.35, 0.35)):
        b.bar(V["alu"], (ux + dx * 1.2, 0.05, tz + dz * 1.2), (ux + dx * 0.6, 1.8, tz + dz * 0.6), 0.05)
    b.box(V["wood"], 0.6, 0.06, 0.6, ux, 1.8, tz)
    b.box(V["wood"], 0.06, 0.5, 0.6, ux + 0.28, 1.86, tz)
    for k in range(5):
        b.bar(V["alu"], (ux + 0.42, 0.33 * k + 0.2, tz - 0.4), (ux + 0.42, 0.33 * k + 0.2, tz + 0.4), 0.03)
    for bz in (tz - 2.2, tz + 2.2):                                            # players' benches, west
        bx = tx - dw - 1.2
        b.box(V["wood"], 0.45, 0.06, 1.8, bx, 0.45, bz, bevel=0.01)
        for dz in (-0.75, 0.75):
            b.box(V["iron"], 0.4, 0.45, 0.06, bx, 0.05, bz + dz)
    x0, x1, z0, z1 = tx - tw / 2, tx + tw / 2, tz - td / 2, tz + td / 2       # fence posts + rails
    for (side, fixed, a0, a1, along_x) in (("s", z0, x0, x1, True), ("n", z1, x0, x1, True), ("w", x0, z0, z1, False), ("e", x1, z0, z1, False)):
        spans = [(a0, a1)]
        for g in TENNIS_GATES:
            if g[0] == side:
                spans = [s_ for sp in spans for s_ in ((sp[0], g[1]), (g[2], sp[1]))]
        for (sa, sb) in spans:
            n = max(1, round((sb - sa) / 2.5))
            for i in range(n + 1):
                a = sa + (sb - sa) * i / n
                p = (a, fixed) if along_x else (fixed, a)
                b.cyl(V["post"], 0.045, (p[0], 0.0, p[1]), (p[0], 3.4, p[1]), seg=10)
            pa = (sa, fixed) if along_x else (fixed, sa)
            pb = (sb, fixed) if along_x else (fixed, sb)
            for y in (3.38, 0.12):
                b.cyl(V["post"], 0.03, (pa[0], y, pa[1]), (pb[0], y, pb[1]), seg=8)
    for k in range(3):                                                         # bleachers, north
        bz = z1 + 1.2 + k * 0.85
        y = 0.4 + k * 0.42
        b.box(V["alu"], 9.0, 0.05, 0.34, tx, y, bz + 0.1, bevel=0.01)
        b.box(V["alu"], 9.0, 0.04, 0.22, tx, y - 0.22, bz - 0.25)
    for x in (tx - 4.3, tx, tx + 4.3):
        b.bar(V["post"], (x, 0.0, z1 + 0.9), (x, 1.35, z1 + 3.4), 0.06)
        b.bar(V["post"], (x, 0.0, z1 + 3.4), (x, 1.35, z1 + 3.4), 0.06)
        b.bar(V["post"], (x, 0.0, z1 + 1.1), (x, 0.42, z1 + 1.1), 0.06)

    # --- surfboard racks (5c uses them): an A-frame of 2x4s, boards on edge
    for (rx, rz) in RACKS:
        for dx in (-1.3, 1.3):
            b.bar(V["wood_dk"], (rx + dx, 0.0, rz - 0.5), (rx + dx, 1.35, rz), 0.08)
            b.bar(V["wood_dk"], (rx + dx, 0.0, rz + 0.5), (rx + dx, 1.35, rz), 0.08)
        b.bar(V["wood_dk"], (rx - 1.45, 1.35, rz), (rx + 1.45, 1.35, rz), 0.08)
        for s in (-1, 1):
            b.bar(V["wood_dk"], (rx - 1.45, 0.3, rz + s * 0.39), (rx + 1.45, 0.3, rz + s * 0.39), 0.06)
        for k in range(6):
            s = -1 if k % 2 == 0 else 1
            x = rx - 1.05 + k * 0.42
            L = 2.0 + 0.15 * (k % 3)
            # tail on the sand outside the frame, the deck leaning on the ridge
            a = math.atan2(0.74, 1.3)
            M = (mathutils.Matrix.Translation((x, 0.05 + L / 2 * math.cos(a), rz + s * 0.8 - s * (L / 2) * math.sin(a)))
                 @ mathutils.Matrix.Rotation(-s * a, 4, "X")
                 @ mathutils.Matrix.Rotation(math.pi / 2, 4, "X"))
            surfboard(b, V["boards"][k % 5], M, L=L)
    b.finish("gb-venice.glb")


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    P = palette()
    G = pal_gb()
    # Light maps (stylised realism, REALISM.md): the beach sky (maps.js hemi
    # sky, sky horizon; 1.4 for its strong 2.6 hemi) and sand bounce, each model baked with the rest of
    # the beach standing round it.
    bake_every_model(samples=128, sky=(0xcce8ff, 0xf2a86a, 1.4), ground=0xd6c194, blur=1, context="grinbeach")
    builders = {"pier": lambda: build_pier(P), "foodtruck": lambda: build_foodtruck(P),
                "shops": lambda: build_shops(P, G), "towers": lambda: build_towers(P, G),
                "beach": lambda: build_beach(P, G), "bluffs": lambda: build_bluffs(P, G),
                "boardwalk": lambda: build_boardwalk(P, G),
                "venice": lambda: build_venice(P, G)}
    only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    built = [k for k in builders if not only or k in only]
    for k in built:
        builders[k]()
    import quantize_glb
    quantize_glb.main([os.path.join(os.path.dirname(os.path.abspath(__file__)), "gb-%s.glb" % k) for k in built])
    print("ALL GRIN BEACH MODELS EXPORTED")


main()
