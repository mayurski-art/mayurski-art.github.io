"""
Hollowgrin's village (phase 1: the square half; phase 3 adds the candy shop,
the barn, the windmill and the south road: hg-barn.glb, hg-candyshop.glb,
hg-windmill.glb, hg-windmill-sails.glb, hg-southroad.glb). hg-square.glb, in map
coordinates: the well, the pumpkin market (the stall, crates, baskets, the
scale, the chalk board's frame, the notice board), the hand cart, the hay,
the four gas lamps and the bunting round the square. The dead oak is its
own GLB, hg-oak.glb: Studio's generate_mesh tree (the user's pick over a
Blender one, 2026-10-27), kept as it came at studio/hollowgrin/oak.glb (in
metres, on the square) and given the bake's UV set here.

Drawn over the colliders maps/hollowgrin.js lays (hollowgrin-layout.json).
The JS keeps the jack-o'-lanterns, the lamp glass and lights, the well's
water, the setts and the words (the chalk board and the notices are canvas
textures it hangs on the frames drawn here).
"""
import math
import os
import random

import bpy

from map_kit import TEXTURED, mat
from hg_kit import HGBuilder, Report, Wall, facing, fbox, gable_prism, lathe, pumpkin, ring, slates

TEXTURED.update({"HG_GraniteDark", "HG_BarnRed", "HG_BarnWood", "HG_Clapboard", "HG_Brick", "HG_Floorboards", "HG_Granite"})

WELL = (-8.0, 6.0)
STALL = (8.0, -4.3)
CART = (8.8, 9.2)
LAMPS = [(-11.0, -8.0), (11.0, 10.5), (-11.0, 11.0), (11.0, -8.5)]
# hollowgrin.js hayBale() calls in the square: x, z, y, ry
BALES = [(-6.5, -5.0, 0.0, 0.0), (-6.5, -5.0, 0.75, 0.05), (-5.2, -5.2, 0.0, math.pi / 2), (5.5, 8.6, 0.0, 0.0),
         (-3.8, 12.5, 0.0, math.pi / 2), (-3.8, 13.8, 0.0, math.pi / 2), (12.2, -3.6, 0.0, 0.0), (12.2, -3.6, 0.75, -0.08)]
OAK_SOURCE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "studio", "hollowgrin", "oak.glb")


def palette():
    return {
        "stone": mat("HG_WellStone", 0x77757c, 0.9),
        "stone_dk": mat("HG_WellStoneDark", 0x5a5860, 0.9),
        "moss": mat("HG_Moss", 0x3a4a2c, 0.95),
        "wood": mat("HG_MarketWood", 0x6a4a30, 0.8),
        "wood_dk": mat("HG_MarketWoodDark", 0x3e2a1c, 0.8),
        "wood_grey": mat("HG_WeatheredWood", 0x6e665c, 0.9),
        "shingle": mat("HG_WellShingle", 0x4a3a30, 0.85),
        "shingle2": mat("HG_WellShingle2", 0x3e3028, 0.85),
        "iron": mat("HG_Iron", 0x1c1c22, 0.55, 0.3),
        "rope": mat("HG_Rope", 0x9a8458, 1.0),
        "hay": mat("HG_Hay", 0xb89a50, 1.0),
        "hay_dk": mat("HG_HayDark", 0x8a7038, 1.0),
        "twine": mat("HG_Twine", 0x6a5434, 1.0),
        "orange": mat("HG_StripeOrange", 0xd8601c, 0.9),
        "black": mat("HG_StripeBlack", 0x1a1216, 0.9),
        "purple": mat("HG_FlagPurple", 0x6d3a9c, 0.9),
        "bone": mat("HG_FlagBone", 0xd8ccb0, 0.9),
        "pk1": mat("HG_Pumpkin1", 0xd8641c, 0.6),
        "pk2": mat("HG_Pumpkin2", 0xe07423, 0.6),
        "pk3": mat("HG_Pumpkin3", 0xcf5a17, 0.6),
        "ghost": mat("HG_GhostPumpkin", 0xd8d4c4, 0.6),
        "gourd_g": mat("HG_GourdGreen", 0x4a6a2a, 0.6),
        "gourd_y": mat("HG_GourdYellow", 0xd8b03a, 0.6),
        "stem": mat("HG_Stem", 0x4a4a22, 0.9),
        "wicker": mat("HG_Wicker", 0x8a6a3a, 0.95),
        "burlap": mat("HG_Burlap", 0x8a6a42, 1.0),
        "brass": mat("HG_Brass", 0xc8a050, 0.35, 0.4),
        "cork": mat("HG_Cork", 0x7a5a3a, 0.9),
        "paper": mat("HG_NoticePaper", 0xc8bfa4, 0.9),
        "slate": mat("HG_ChalkSlate", 0x1c1f1c, 0.8),
        # phase 3's props in the barn and the candy shop
        "crow": mat("HG_Crow", 0x111118, 0.6),
        "beak": mat("HG_Beak", 0x3a3020, 0.6),
        "sack": mat("HG_Burlap", 0x8a7450, 1.0),
        "pail": mat("HG_Galvanised", 0x8a9096, 0.45, 0.5),
        "water": mat("HG_TroughWater", 0x1a2a2a, 0.08, 0.2),
        "web": mat("HG_Web", 0xc8c8d0, 0.9, 0.0, 0x606070, 0.3),
        "gumred": mat("HG_GumRed", 0xb81c24, 0.4, 0.2),
        "paper_w": mat("HG_StickPaper", 0xeee8d8, 0.9),
        "kraft": mat("HG_Kraft", 0xa8865a, 0.95),
        # the barn's and the candy shop's (phase 3, from hg_legacy_village.py)
        "granite": mat("HG_Granite", 0x8c8c94, 0.9),
        "granite_dk": mat("HG_GraniteDark", 0x5a5a62, 0.9),
        "joint": mat("HG_Joint", 0x2a2a30, 0.95),
        "bronze": mat("HG_Bronze", 0x3d6a58, 0.45, 0.3),
        "bronze_dk": mat("HG_BronzeDark", 0x26402f, 0.5, 0.3),
        "recess": mat("HG_Recess", 0x26262c, 0.95),
        "barn": mat("HG_BarnRed", 0xc8382c, 0.85),
        "barnwood": mat("HG_BarnWood", 0x8a6a48, 0.85),
        "trim": mat("HG_TrimWhite", 0xd9d2c2, 0.75),
        "roofmetal": mat("HG_RoofMetal", 0x4a524e, 0.5, 0.25),
        "roofrib": mat("HG_RoofRib", 0x5c6662, 0.45, 0.25),
        "clap": mat("HG_Clapboard", 0x5b3a6e, 0.8),
        "shoptrim": mat("HG_ShopTrim", 0xe0762a, 0.65),
        "shopdark": mat("HG_ShopDark", 0x2a1832, 0.7),
        "brick": mat("HG_Brick", 0x8a4a3a, 0.9),
        "floor": mat("HG_Floorboards", 0x6a4a30, 0.8),
        "wainscot": mat("HG_Wainscot", 0x4a2e22, 0.6),
        "tin": mat("HG_Tin", 0xc8c0a8, 0.5, 0.2),
        "tar": mat("HG_Tar", 0x1e1e22, 0.95),
        "glass": mat("HG_GlassDark", 0x1a2028, 0.1),
        "warm": mat("HG_WarmGlass", 0xffd08a, 0.3, 0.0, 0xffb860, 1.6),
        "lamp": mat("HG_Lamp", 0xfff0c8, 0.2, 0.0, 0xffd890, 3.0),
        "tool": mat("HG_ToolSteel", 0x6a6e74, 0.5, 0.3),
        "handle": mat("HG_Handle", 0x8a6a40, 0.8),
    }


def box2(b, m, x0, x1, y0, y1, z0, z1, **kw):
    b.box(m, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2, **kw)


def flag(b, m, p, along, h, w):
    """A pennant hanging from p: a thin triangular plate, its top edge along
    the (unit, horizontal) `along`."""
    ax, az = along
    nx, nz = -az, ax
    t = 0.006
    tri = [(p[0] - ax * w / 2, p[1], p[2] - az * w / 2), (p[0] + ax * w / 2, p[1], p[2] + az * w / 2), (p[0], p[1] - h, p[2])]
    pts = [(x + nx * t, y, z + nz * t) for x, y, z in tri] + [(x - nx * t, y, z - nz * t) for x, y, z in tri]
    b.poly(m, pts, [[0, 1, 2], [5, 4, 3], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]])


def bunting(b, P, a, c, sag=0.6, rnd=None):
    """A string of pennants from a to c, sagging in the middle."""
    L = math.hypot(c[0] - a[0], c[2] - a[2])
    ax, az = (c[0] - a[0]) / L, (c[2] - a[2]) / L
    pts = []
    n = max(2, int(L / 0.45))
    for i in range(n + 1):
        t = i / n
        pts.append((a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (c[2] - a[2]) * t))
    for p, q in zip(pts, pts[1:]):
        b.cyl(P["twine"], 0.006, p, q, seg=3, caps=False)
    cols = [P["orange"], P["purple"], P["black"], P["bone"]]
    for i, p in enumerate(pts[1:-1]):
        flag(b, cols[i % 4], p, (ax, az), 0.3, 0.24)


# ------------------------------------------------------------------ the well

def well(b, P, R):
    wx, wz = WELL
    rnd = random.Random(31)
    R.begin(b, "square:well")
    # three courses of dressed blocks round a 0.95 m bore, coping on top
    for k in range(3):
        n = 14
        for i in range(n):
            a = (i + (0.5 if k % 2 else 0.0)) / n * 2 * math.pi
            r = 1.075
            ch = 2 * math.pi * r / n - 0.03
            m = P["stone"] if rnd.random() < 0.7 else P["stone_dk"]
            b.box(m, 0.26, 0.27, ch, wx + math.cos(a) * r, k * 0.28, wz + math.sin(a) * r, ry=-a)
    for i in range(10):
        a = (i + 0.3) / 10 * 2 * math.pi
        ch = 2 * math.pi * 1.08 / 10 - 0.02
        b.box(P["stone_dk"], 0.38, 0.12, ch, wx + math.cos(a) * 1.08, 0.84, wz + math.sin(a) * 1.08, ry=-a)
    # the dark bore below the water (the water is the JS's, at 0.2)
    lathe(b, P["moss"], wx, wz, [(0.95, -0.4), (0.95, 0.19)], seg=16)
    for i in range(6):                                   # moss in the joints
        a = rnd.uniform(0, 2 * math.pi)
        b.lump(P["moss"], 0.3, 0.06, 0.12, wx + math.cos(a) * 1.21, rnd.uniform(0.1, 0.6), wz + math.sin(a) * 1.21, ry=-a, seed=i, rnd=0.6, jitter=0.01)
    # posts on the coping, the winch between them, its crank
    for dz in (-1.05, 1.05):
        box2(b, P["wood_grey"], wx - 0.07, wx + 0.07, 0.9, 2.42, wz + dz - 0.07, wz + dz + 0.07)
        b.box(P["wood_grey"], 0.06, 0.06, 0.45, wx, 1.95, wz + dz - math.copysign(0.18, dz), rx=math.copysign(0.7, dz))
    b.cyl(P["wood"], 0.12, (wx, 1.55, wz - 0.95), (wx, 1.55, wz + 0.95), seg=10)
    b.cyl(P["iron"], 0.025, (wx, 1.55, wz - 1.2), (wx, 1.55, wz + 1.2), seg=6)
    for k in range(7):
        ring(b, P["rope"], (wx, 1.55, wz - 0.4 + k * 0.05), 0.13, 0.022, seg=10, tseg=4, axis="z")
    b.box(P["iron"], 0.04, 0.32, 0.04, wx, 1.4, wz + 1.22)
    b.cyl(P["wood_dk"], 0.03, (wx, 1.25, wz + 1.22), (wx, 1.25, wz + 1.42), seg=6)
    # the rope down into the bore, the bucket on the coping
    b.cyl(P["rope"], 0.015, (wx, 1.43, wz + 0.2), (wx, 0.35, wz + 0.2), seg=4)
    bx, bz = wx + 0.78, wz + 0.55
    lathe(b, P["wood"], bx, bz, [(0.15, 0), (0.19, 0.32), (0.17, 0.32), (0.13, 0.03)], seg=12, y0=0.96)
    for yy in (0.04, 0.27):
        lathe(b, P["iron"], bx, bz, [(0.155 + yy * 0.12, yy), (0.16 + yy * 0.12, yy + 0.03)], seg=12, y0=0.96)
    ring(b, P["iron"], (bx, 1.28, bz), 0.18, 0.008, seg=12, tseg=4, axis="x", arc=math.pi)
    # the roof: a little gable along z, wood shingles, barge boards
    sh = [P["shingle"], P["shingle2"], P["shingle"]]
    for s in (-1, 1):
        slates(b, sh, "z", wz - 1.3, wz + 1.3, (wx + s * 1.15, 2.05), (wx, 2.72), seed=40 + s, course=0.16, deck=0.05)
    for dz in (-1.31, 1.31):
        b.prism(P["wood_grey"], [(wx - 1.2, 2.02), (wx + 1.2, 2.02), (wx, 2.76)], wz + dz - 0.03, wz + dz + 0.03, axis="z")
    b.cyl(P["wood_dk"], 0.05, (wx, 2.78, wz - 1.35), (wx, 2.78, wz + 1.35), seg=6)
    R.end()


# ------------------------------------------------------------------ the market

def crate(b, P, x, y, z, w, h, d, ry=0.0, open_top=True):
    """A slatted crate: corner posts, three slats a side, a slatted floor."""
    c, s = math.cos(ry), math.sin(ry)
    def at(dx, dz):
        return x + dx * c + dz * s, z - dx * s + dz * c
    for dx in (-w / 2 + 0.03, w / 2 - 0.03):
        for dz in (-d / 2 + 0.03, d / 2 - 0.03):
            px, pz = at(dx, dz)
            b.box(P["wood_dk"], 0.06, h, 0.06, px, y, pz, ry=ry)
    for k in range(3):
        yy = y + 0.04 + k * (h - 0.1) / 2.6
        for sd in (-1, 1):
            px, pz = at(0, sd * (d / 2 - 0.012))
            b.box(P["wood"], w - 0.02, 0.09, 0.024, px, yy, pz, ry=ry)
            px, pz = at(sd * (w / 2 - 0.012), 0)
            b.box(P["wood"], 0.024, 0.09, d - 0.02, px, yy, pz, ry=ry)
    b.box(P["wood_dk"], w - 0.04, 0.03, d - 0.04, x, y + 0.02, z, ry=ry)
    if not open_top:
        b.box(P["wood"], w, 0.03, d, x, y + h - 0.03, z, ry=ry)


def fill(b, P, x, y, z, w, d, n, rnd, kinds=("pk1", "pk2", "pk3")):
    """Pumpkins or gourds heaped in a crate or basket: a layer and a few on top."""
    for i in range(n):
        r = rnd.uniform(0.11, 0.16)
        px = x + rnd.uniform(-w / 2 + r, w / 2 - r)
        pz = z + rnd.uniform(-d / 2 + r, d / 2 - r)
        lift = 0.0 if i < n * 0.6 else r * 0.9
        k = rnd.choice(kinds)
        tall = 1.6 if k.startswith("gourd") else 1.0
        pumpkin(b, P[k], P["stem"], px, y + lift, pz, r * (0.75 if tall > 1 else 1.0), ribs=rnd.choice((8, 9, 10)),
                squash=0.75, ry=rnd.uniform(0, 6), tall=tall, wart=0.06 if k == "gourd_g" else 0.0, seed=i * 7 + int(x * 10))


def basket(b, P, x, z, r, h, rnd):
    lathe(b, P["wicker"], x, z, [(r * 0.8, 0), (r, h * 0.9), (r * 1.03, h), (r * 0.95, h)], seg=14)
    for k in range(4):
        lathe(b, P["wood_dk"], x, z, [(r * (0.82 + 0.05 * k) + 0.008, h * 0.2 * k + 0.03), (r * (0.84 + 0.05 * k) + 0.008, h * 0.2 * k + 0.05)], seg=14)
    ring(b, P["wicker"], (x, h + 0.2, z), r * 0.85, 0.015, seg=12, tseg=4, axis="x", arc=math.pi)


def stall(b, P, R):
    sx, sz = STALL
    rnd = random.Random(55)
    R.begin(b, "square:stall")
    # the counter (collider 3.2 x 1.0 x 1.0 at 8, -4.0): a planked front, a top
    cz = sz + 0.3
    box2(b, P["wood_dk"], sx - 1.6, sx + 1.6, 0.0, 0.92, cz - 0.5, cz + 0.45)
    x = sx - 1.6
    while x < sx + 1.59:
        box2(b, P["wood_grey" if rnd.random() < 0.3 else "wood"], x + 0.005, min(sx + 1.6, x + 0.2) - 0.005, 0.02, 0.92, cz + 0.45, cz + 0.5)
        x += 0.2
    box2(b, P["wood"], sx - 1.68, sx + 1.68, 0.92, 1.0, cz - 0.55, cz + 0.56, bevel=0.01)
    for yy in (0.15, 0.75):
        box2(b, P["wood_dk"], sx - 1.6, sx + 1.6, yy, yy + 0.08, cz + 0.5, cz + 0.53)
    # posts (colliders 0.14 square, 2.7 tall) with knee braces
    for dx in (-1.7, 1.7):
        for dz in (-0.9, 0.9):
            box2(b, P["wood_grey"], sx + dx - 0.07, sx + dx + 0.07, 0.0, 2.7, sz + dz - 0.07, sz + dz + 0.07)
            b.box(P["wood_grey"], 0.06, 0.5, 0.06, sx + dx - math.copysign(0.18, dx), 2.15, sz + dz, rz=math.copysign(0.75, dx))
    for dz in (-0.9, 0.9):
        box2(b, P["wood_grey"], sx - 1.8, sx + 1.8, 2.55, 2.68, sz + dz - 0.06, sz + dz + 0.06)
    # the striped awning, sagging, with a scalloped valance at the front
    cols = (P["orange"], P["black"])
    n = 12
    for i in range(n):
        x0 = sx - 1.9 + 3.8 * i / n
        x1 = x0 + 3.8 / n
        sag = 0.05 * math.sin(math.pi * (i + 0.5) / n)
        b.box(cols[i % 2], x1 - x0 + 0.002, 0.03, 2.35, (x0 + x1) / 2, 2.6 - sag, sz, rx=0.18)
        for k in range(2):
            vx0 = x0 + k * (x1 - x0) / 2
            vx1 = vx0 + (x1 - x0) / 2
            b.box(cols[i % 2], vx1 - vx0 + 0.002, 0.28, 0.02, (vx0 + vx1) / 2, 2.12 - sag, sz + 1.22, rx=0.06)
            b.cyl(cols[i % 2], (vx1 - vx0) / 2, ((vx0 + vx1) / 2, 2.12 - sag, sz + 1.205), ((vx0 + vx1) / 2, 2.12 - sag, sz + 1.235), seg=8, caps=False)
    R.end()
    # the crates by it (colliders: 0.9 cube, a 0.7 one on top, at 10.6, -4.5)
    R.begin(b, "square:crates")
    crate(b, P, sx + 2.6, 0.0, sz - 0.2, 0.9, 0.9, 0.9, open_top=False)
    crate(b, P, sx + 2.6, 0.9, sz - 0.2, 0.7, 0.6, 0.7, ry=0.12)
    fill(b, P, sx + 2.6, 0.93, sz - 0.2, 0.55, 0.55, 7, rnd)
    R.end()
    # baskets of gourds and a sack west of the stall
    R.begin(b, "square:baskets")
    basket(b, P, sx - 2.45, sz - 0.55, 0.32, 0.36, rnd)
    fill(b, P, sx - 2.45, 0.2, sz - 0.55, 0.42, 0.42, 6, rnd, kinds=("gourd_g", "gourd_y", "ghost"))
    basket(b, P, sx - 2.6, sz + 0.4, 0.28, 0.3, rnd)
    fill(b, P, sx - 2.6, 0.16, sz + 0.4, 0.36, 0.36, 5, rnd, kinds=("ghost", "pk1"))
    b.lump(P["burlap"], 0.55, 0.62, 0.45, sx - 2.4, 0.0, sz - 1.7, seed=3, rnd=0.55, jitter=0.03)
    for k in range(3):
        pumpkin(b, P[("gourd_y", "gourd_g", "pk2")[k]], P["stem"], sx - 2.7 + k * 0.17, 0.0, sz - 2.0 + k * 0.1, 0.1,
                tall=1.5 if k < 2 else 1.0, seed=60 + k)
    R.end()
    # a hanging scale off the front beam, over the counter's east end
    R.begin(b, "square:scale", on="square:stall")
    hx, hz = sx + 1.3, sz + 0.82
    b.cyl(P["iron"], 0.008, (hx, 2.55, hz), (hx, 2.2, hz), seg=4)
    box2(b, P["brass"], hx - 0.05, hx + 0.05, 1.95, 2.2, hz - 0.02, hz + 0.02)
    b.cyl(P["dial"] if "dial" in P else P["paper"], 0.045, (hx, 2.1, hz + 0.021), (hx, 2.1, hz + 0.026), seg=10)
    for a in range(3):
        ang = a * 2 * math.pi / 3
        b.cyl(P["iron"], 0.004, (hx, 1.93, hz), (hx + math.cos(ang) * 0.17, 1.62, hz + math.sin(ang) * 0.17), seg=3)
    lathe(b, P["brass"], hx, hz, [(0.18, 0.03), (0.16, 0.0), (0.002, -0.02)], seg=12, y0=1.6)
    pumpkin(b, P["pk2"], P["stem"], hx, 1.63, hz, 0.1, seed=71)
    R.end()
    # the notice board between the back posts (the notices are the JS's)
    R.begin(b, "square:notice-board", on="square:stall")
    nz = sz - 0.9 - 0.09
    box2(b, P["cork"], sx - 0.85, sx + 0.85, 1.1, 2.1, nz - 0.03, nz)
    for y0, y1 in ((1.05, 1.1), (2.1, 2.16)):
        box2(b, P["wood_dk"], sx - 0.92, sx + 0.92, y0, y1, nz - 0.05, nz + 0.01)
    for x0 in (sx - 0.92, sx + 0.85):
        box2(b, P["wood_dk"], x0, x0 + 0.07, 1.05, 2.16, nz - 0.05, nz + 0.01)
    b.prism(P["wood_dk"], [(sx - 1.0, 2.16), (sx + 1.0, 2.16), (sx, 2.4)], nz - 0.08, nz + 0.02, axis="z")
    R.end()
    # the chalk A-board on the square side, its faces east and west (its
    # words are the JS's; north it would face the stall)
    R.begin(b, "square:a-board")
    ax_, az_ = sx - 1.9, sz + 2.35
    for s in (-1, 1):
        b.box(P["wood_dk"], 0.04, 0.92, 0.66, ax_ + s * 0.14, 0.0, az_, rz=s * 0.17)
        b.box(P["slate"], 0.012, 0.74, 0.54, ax_ + s * 0.165, 0.1, az_, rz=s * 0.17)
    b.cyl(P["iron"], 0.01, (ax_ - 0.1, 0.45, az_ - 0.3), (ax_ + 0.1, 0.45, az_ - 0.3), seg=4)
    R.end()


def cart(b, P, R):
    cx, cz = CART
    R.begin(b, "square:cart")
    # the bed and its sides (collider 3.4 x 1.7 x 1.25)
    z = cz - 0.85
    while z < cz + 0.84:
        box2(b, P["wood"], cx - 1.7, cx + 1.7, 0.55, 0.67, z + 0.005, z + 0.165)
        z += 0.17
    for dz in (-0.82, 0.82):
        for yy in (0.67, 0.9):
            box2(b, P["wood_grey"], cx - 1.7, cx + 1.7, yy, yy + 0.18, cz + dz - 0.03, cz + dz + 0.03)
        for dx in (-1.65, -0.55, 0.55, 1.65):
            box2(b, P["wood_dk"], cx + dx - 0.04, cx + dx + 0.04, 0.5, 1.2, cz + dz - 0.05 * (1 if dz > 0 else -1) - 0.025, cz + dz - 0.05 * (1 if dz > 0 else -1) + 0.025)
    for dx in (-1.67, 1.67):
        for yy in (0.67, 0.9):
            box2(b, P["wood_grey"], cx + dx - 0.03, cx + dx + 0.03, yy, yy + 0.18, cz - 0.82, cz + 0.82)
    box2(b, P["wood_dk"], cx - 1.6, cx + 1.6, 0.42, 0.55, cz - 0.6, cz - 0.45)
    box2(b, P["wood_dk"], cx - 1.6, cx + 1.6, 0.42, 0.55, cz + 0.45, cz + 0.6)
    # two spoked wheels on an iron axle
    wx = cx - 0.6
    b.cyl(P["iron"], 0.035, (wx, 0.5, cz - 1.02), (wx, 0.5, cz + 1.02), seg=6)
    for dz in (-0.95, 0.95):
        ring(b, P["iron"], (wx, 0.5, cz + dz), 0.48, 0.035, seg=24, tseg=5, axis="z")
        ring(b, P["wood_dk"], (wx, 0.5, cz + dz), 0.43, 0.04, seg=20, tseg=4, axis="z")
        b.cyl(P["wood_dk"], 0.1, (wx, 0.5, cz + dz - 0.08), (wx, 0.5, cz + dz + 0.08), seg=10)
        for k in range(10):
            a = k / 10 * 2 * math.pi
            b.cyl(P["wood"], 0.018, (wx + math.cos(a) * 0.09, 0.5 + math.sin(a) * 0.09, cz + dz), (wx + math.cos(a) * 0.41, 0.5 + math.sin(a) * 0.41, cz + dz), seg=4)
    # the shafts, dropped to the ground, a cross bar, a prop stick
    for dz in (-0.3, 0.3):
        b.cyl(P["wood_dk"], 0.04, (cx + 1.6, 0.6, cz + dz), (cx + 3.15, 0.18, cz + dz * 1.4), seg=6)
    b.cyl(P["wood_dk"], 0.03, (cx + 2.8, 0.27, cz - 0.42), (cx + 2.8, 0.27, cz + 0.42), seg=6)
    b.cyl(P["wood_grey"], 0.03, (cx + 1.45, 0.0, cz), (cx + 1.6, 0.55, cz), seg=6)
    R.end()


def bale(b, P, rnd, x, z, y, ry, seed):
    """A hay bale (1.3 x 0.75 x 0.85, the JS's hayBale), its straws and twine."""
    w, h, d = 1.3, 0.75, 0.85
    b.lump(P["hay"], w, h, d, x, y, z, ry=ry, seed=seed, rnd=0.12, jitter=0.025)
    c, s = math.cos(ry), math.sin(ry)

    def at(lx, ly, lz):
        return (x + lx * c + lz * s, y + ly, z - lx * s + lz * c)
    # straws: short tilted blades over every face but the bottom
    for k in range(46):
        f = rnd.randrange(5)
        u, v = rnd.uniform(-0.45, 0.45), rnd.uniform(0.08, 0.92)
        ln, tilt = rnd.uniform(0.08, 0.2), rnd.uniform(-0.9, 0.9)
        col = P["hay_dk"] if rnd.random() < 0.45 else P["hay"]
        if f < 2:                         # the long faces
            sd = 1 if f else -1
            p0 = at(u * w, v * h, sd * (d / 2 + 0.01))
            p1 = at(u * w + math.cos(tilt) * ln, v * h + math.sin(tilt) * ln, sd * (d / 2 + 0.03))
            n = (s * sd, 0.0, c * sd)
        elif f < 4:                       # the ends
            sd = 1 if f == 3 else -1
            p0 = at(sd * (w / 2 + 0.01), v * h, u * d)
            p1 = at(sd * (w / 2 + 0.03), v * h + math.sin(tilt) * ln, u * d + math.cos(tilt) * ln)
            n = (c * sd, 0.0, -s * sd)
        else:                             # the top
            p0 = at(u * w, h + 0.012, (v - 0.5) * d)
            p1 = at(u * w + math.cos(tilt) * ln, h + 0.03, (v - 0.5) * d + math.sin(tilt) * ln)
            n = (0.0, 1.0, 0.0)
        ex, ez = p1[0] - p0[0], p1[2] - p0[2]
        el = math.hypot(ex, ez) or 1.0
        wx, wz = -ez / el * 0.012, ex / el * 0.012
        wy = 0.012 if f < 4 and abs(ex) + abs(ez) < 0.02 else 0.0
        facing(b, col, [(p0[0] - wx, p0[1] - wy, p0[2] - wz), (p0[0] + wx, p0[1] + wy, p0[2] + wz),
                        (p1[0] + wx, p1[1] + wy, p1[2] + wz), (p1[0] - wx, p1[1] - wy, p1[2] - wz)], n)
    for t in (-0.32, 0.32):
        px, pz = x + t * c, z - t * s
        b.box(P["twine"], 0.03, h + 0.02, d + 0.03, px, y - 0.005, pz, ry=ry)


def hay(b, P, R):
    rnd = random.Random(77)
    for i, (x, z, y, ry) in enumerate(BALES):
        # stacked, or end to end with the one before (4 and 5)
        R.begin(b, f"square:bale-{i}", on=f"square:bale-{i - 1}" if y > 0 or i == 5 else None)
        bale(b, P, rnd, x, z, y, ry, i + 90)
        R.end()
        # loose straw on the ground round the bottom bales (flat: no prop)
        if y == 0:
            for k in range(6):
                a = rnd.uniform(0, 2 * math.pi)
                r = rnd.uniform(0.75, 1.05)
                b.box(P["hay"], rnd.uniform(0.15, 0.35), 0.008, 0.012, x + math.cos(a) * r, 0.0, z + math.sin(a) * r, ry=rnd.uniform(0, 3.1))


def gas_lamp(b, P, R, x, z, i, area="square"):
    R.begin(b, f"{area}:lamp-{i}")
    lathe(b, P["iron"], x, z, [(0.24, 0), (0.24, 0.12), (0.19, 0.18), (0.19, 0.38), (0.13, 0.48), (0.1, 0.56), (0.11, 0.62), (0.08, 0.7)], seg=12)
    # the fluted shaft (collider 0.24 square, 3.0 tall)
    n = 8
    for k in range(n):
        a = k / n * 2 * math.pi
        b.cyl(P["iron"], 0.022, (x + math.cos(a) * 0.055, 0.7, z + math.sin(a) * 0.055), (x + math.cos(a) * 0.04, 2.85, z + math.sin(a) * 0.04), seg=4)
    lathe(b, P["iron"], x, z, [(0.06, 0.7), (0.045, 2.85), (0.09, 2.9), (0.12, 3.0)], seg=10)
    # the ladder bar, then the lantern cage round the JS's glass (0.34 square, 3.06 .. 3.62)
    b.cyl(P["iron"], 0.02, (x - 0.38, 2.62, z), (x + 0.38, 2.62, z), seg=5)
    for s in (-1, 1):
        lathe(b, P["iron"], x + s * 0.38, z, [(0.03, 0), (0.002, 0.06)], seg=5, y0=2.62)
    box2(b, P["iron"], x - 0.21, x + 0.21, 3.0, 3.06, z - 0.21, z + 0.21)
    for dx in (-0.18, 0.18):
        for dz in (-0.18, 0.18):
            box2(b, P["iron"], x + dx - 0.015, x + dx + 0.015, 3.06, 3.62, z + dz - 0.015, z + dz + 0.015)
    box2(b, P["iron"], x - 0.23, x + 0.23, 3.62, 3.68, z - 0.23, z + 0.23)
    b.frustum(P["iron"], 0.46, 0.46, 0.08, 0.08, 3.68, 3.95, x=x, z=z)
    lathe(b, P["iron"], x, z, [(0.05, 3.95), (0.03, 4.05), (0.05, 4.1), (0.002, 4.22)], seg=8)
    R.end()


# ------------------------------------------------------------------ the dead oak

def build_oak(P, R):
    """Studio's oak (generate_mesh, textured) as it was exported, plus the
    bake's UV set, as hg-oak.glb. Its trunk stands on the oak's collider
    (2.6 m square at 0, 1); its roots and crown register as two props, so
    the crown overhead doesn't count against what stands under it."""
    from tf_kit import bounds, lightmap_uv
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=OAK_SOURCE)
    ob = [o for o in bpy.data.objects if o not in before and o.type == "MESH"][0]
    ob.name = "hg-oak"
    lightmap_uv(ob)
    game = [(v.co.x, v.co.z, -v.co.y) for v in ob.data.vertices]
    for pid, keep, on in (("square:oak", lambda p: p[1] < 3.0, None), ("square:oak-crown", lambda p: p[1] >= 3.0, "square:oak")):
        ps = [p for p in game if keep(p)]
        R.prop(pid, [min(p[k] for p in ps) for k in range(3)], [max(p[k] for p in ps) for k in range(3)], on=on)
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hg-oak.glb")
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_yup=True,
                              export_image_format="JPEG", export_jpeg_quality=85, export_apply=True)
    lo, hi = bounds(ob)
    Report.rows.append(["hg-oak", len(ob.data.polygons), len(ob.data.vertices), 0, lo, hi])
    bpy.data.objects.remove(ob)


def build_square(P, R):
    b = HGBuilder()
    well(b, P, R)
    stall(b, P, R)
    cart(b, P, R)
    hay(b, P, R)
    for i, (x, z) in enumerate(LAMPS):
        gas_lamp(b, P, R, x, z, i)
    # bunting round the square, lamp to lamp, and off the stall's front posts
    (a, c, d, e) = [(x, 3.5, z) for x, z in LAMPS]   # NW, SE, SW, NE
    rnd = random.Random(3)
    # three sides of the square (none across the manor's front: rule 9)
    strings = ((d, c, 2, 1), (a, d, 0, 2), (e, c, 3, 1))
    for k, (p, q, i, j) in enumerate(strings):
        # hung off its two lamps, meeting the next string at a lamp
        R.begin(b, f"square:bunting-{k}", on=[f"square:lamp-{i}", f"square:lamp-{j}"] + [f"square:bunting-{n}" for n in range(len(strings)) if n != k])
        bunting(b, P, p, q, sag=0.7, rnd=rnd)
        R.end()
    R.begin(b, "square:bunting-stall", on=["square:stall", "square:lamp-3", "square:scale", "square:notice-board", "square:bunting-2"])
    bunting(b, P, (STALL[0] - 1.7, 2.7, STALL[1] + 0.9), (LAMPS[3][0], 3.5, LAMPS[3][1]), sag=0.3, rnd=rnd)
    R.end()
    for face in FACES:
        R.face(*face)
    b.finish("hg-square.glb")


# The words the JS paints on these frames (rule 9 keeps them clear).
FACES = [
    ("sign:market-a-board-e", "square:a-board", (STALL[0] - 1.9 + 0.22, 0.5, STALL[1] + 2.35), (1, 0, 0), 0.54, 0.74),
    ("sign:market-a-board-w", "square:a-board", (STALL[0] - 1.9 - 0.22, 0.5, STALL[1] + 2.35), (-1, 0, 0), 0.54, 0.74),
    ("sign:notice-board", "square:notice-board", (STALL[0], 1.6, STALL[1] - 0.9 - 0.13), (0, 0, -1), 1.6, 0.95),
]


# ------------------------------------------------------------------ barn

def build_barn(P, Rg):
    """Over: walls x 17..29, z 20..29 (0.35 thick, 4.4 tall); ceiling slab
    12.4 x 9.4 x 0.3 at y 4.4; the loft deck x 17.35..20.4, z 20.35..28.65
    at 2.4 and its stair (x 20.9, z 21 -> 24.36, 8 x 0.3); openings as in
    hollowgrin.js (north door 4 x 3.6, west door 3 x 2.2 + loft window)."""
    b = HGBuilder()
    rng = random.Random(23)
    Rg.begin(b, "south:barn")
    R, Wd, T = P["barn"], P["barnwood"], P["trim"]
    x0, x1, z0, z1, h, t = 17.0, 29.0, 20.0, 29.0, 4.4, 0.35
    walls = [
        Wall("x", z0 + t / 2, x0, x1, h, t, out=-1, holes=[{"c": 23, "w": 4, "spans": [(0, 3.6)]}]),
        Wall("x", z1 - t / 2, x0, x1, h, t, out=1, holes=[{"c": 20, "w": 1.2, "spans": [(1.8, 2.8)]},
                                                          {"c": 26, "w": 1.2, "spans": [(1.8, 2.8)]}]),
        Wall("z", x0 + t / 2, z0 + t, z1 - t, h, t, out=-1, holes=[{"c": 24.5, "w": 3, "spans": [(0, 2.2)]},
                                                                  {"c": 22.0, "w": 1.4, "spans": [(3.0, 4.25)]}]),
        Wall("z", x1 - t / 2, z0 + t, z1 - t, h, t, out=1, holes=[{"c": 26, "w": 1.6, "spans": [(0, 2.4)]},
                                                                 {"c": 22.5, "w": 1.2, "spans": [(1.8, 2.8)]}]),
    ]
    for w in walls:
        w.solid(b, R, inner=Wd, split=0.45)
        w.battens(b, R, 0.42, y0=0.3)
        w.casings(b, T, fw=0.12)
        w.casings(b, Wd, fw=0.08, sill=False, side=-1)
    # the corners the walls leave open on the long sides
    for cx in (x0 + t / 2, x1 - t / 2):
        for cz in (z0 + t / 2, z1 - t / 2):
            b.box(R, t, h, t, cx, 0, cz)
    # foundation course, corner boards, a sill board
    for (cx, cz, w_, d_) in ((23, z0 - 0.03, 12.2, 0.12), (23, z1 + 0.03, 12.2, 0.12),
                             (x0 - 0.03, 24.5, 0.12, 9.2), (x1 + 0.03, 24.5, 0.12, 9.2)):
        b.box(P["granite_dk"], w_, 0.3, d_, cx, 0, cz)
    for cx, sx in ((x0, -1), (x1, 1)):
        for cz, sz in ((z0, -1), (z1, 1)):
            b.box(T, 0.16, h - 0.3, 0.05, cx - sx * 0.08 + sx * 0.0, 0.3, cz + sz * 0.03)
            b.box(T, 0.05, h - 0.3, 0.16, cx + sx * 0.03, 0.3, cz - sz * 0.08)
    # gambrel roof along x: eaves z 19.6 / 29.4 at 4.4, breaks z 21.5 / 27.5
    # at 6.4, ridge z 24.5 at 7.7
    ridge = 24.5
    rx0, rx1 = x0 - 0.35, x1 + 0.35
    RL = rx1 - rx0
    rcx = (rx0 + rx1) / 2
    planes = []
    for s in (-1, 1):
        planes.append(((ridge + s * 4.9, 4.4), (ridge + s * 3.0, 6.4)))
        planes.append(((ridge + s * 3.0, 6.4), (ridge, 7.7)))
    for (za, ya), (zb, yb) in planes:
        L = math.hypot(zb - za, yb - ya) + 0.06
        ang = math.atan2(yb - ya, zb - za)
        zc, yc = (za + zb) / 2, (ya + yb) / 2
        b.box(P["roofmetal"], RL, 0.08, L, rcx, yc - 0.04 + 0.05, zc, rx=-ang)
        xx = rx0 + 0.25
        while xx < rx1:
            b.box(P["roofrib"], 0.035, 0.05, L, xx, yc + 0.06, zc, rx=-ang)
            xx += 0.48
    b.box(P["roofrib"], RL + 0.04, 0.12, 0.34, rcx, 7.68, ridge)
    # gable ends: siding pentagons, rake boards, fascia
    gable = [(z0 - 0.0 + 0.0, 4.4), (z1, 4.4), (ridge + 3.0, 6.4 - 0.0), (ridge, 7.7), (ridge - 3.0, 6.4)]
    gprof = [(z0 + 0.0, 0), (z1, 0), (ridge + 3.0 - 0.1, 2.0 - 0.1), (ridge, 3.3 - 0.08), (ridge - 3.0 + 0.1, 2.0 - 0.1)]
    for gx in (x0, x1):
        b.prism(R, [(zz, 4.4 + yy) for zz, yy in gprof], gx - 0.02 if gx == x0 else gx - t + 0.02,
                gx + t - 0.02 if gx == x0 else gx + 0.02, axis="x")
        out = -1 if gx == x0 else 1
        zz = z0 + 0.3
        while zz < z1 - 0.1:
            top = 4.4 + (2.0 * max(0.0, min(1.0, (zz - z0 + 0.4) / 1.9)) if zz < ridge - 3.0 else
                         2.0 + 1.3 * (zz - (ridge - 3.0)) / 3.0 if zz < ridge else
                         2.0 + 1.3 * ((ridge + 3.0) - zz) / 3.0 if zz < ridge + 3.0 else
                         2.0 * max(0.0, min(1.0, (z1 + 0.4 - zz) / 1.9)))
            if top - 4.4 > 0.2:
                b.box(R, 0.03, top - 4.4 - 0.12, 0.07, gx + out * 0.015, 4.4, zz)
            zz += 0.42
        for (za, ya), (zb, yb) in planes:
            L = math.hypot(zb - za, yb - ya) + 0.04
            ang = math.atan2(yb - ya, zb - za)
            b.box(T, 0.06, 0.2, L, gx + out * 0.4, (ya + yb) / 2 - 0.08, (za + zb) / 2, rx=-ang)
        b.box(T, 0.04, 0.14, z1 - z0 + 0.1, gx + out * 0.03, 4.3, (z0 + z1) / 2)
    for s in (-1, 1):
        b.box(T, RL + 0.04, 0.22, 0.05, rcx, 4.22, ridge + s * 4.92)
        b.box(T, RL, 0.06, 0.38, rcx, 4.38, ridge + s * 4.75)
    # cupola + weathervane on the ridge
    cx = 23.0
    b.box(T, 1.2, 0.5, 1.2, cx, 7.4, ridge)
    b.box(R, 1.0, 0.75, 1.0, cx, 7.9, ridge)
    for side in range(4):
        a = side * math.pi / 2
        for k in range(5):
            yy = 7.98 + k * 0.12
            ox, oz = math.cos(a) * 0.51, math.sin(a) * 0.51
            b.box(T, 0.62 if side % 2 == 1 else 0.03, 0.025, 0.03 if side % 2 == 1 else 0.62,
                  cx + ox, yy, ridge + oz, rx=0.4 if side % 2 == 1 else 0.0, rz=0.4 if side % 2 == 0 else 0.0)
    b.box(T, 1.15, 0.06, 1.15, cx, 8.65, ridge)
    b.poly(P["roofmetal"], [(cx - 0.65, 8.71, ridge - 0.65), (cx + 0.65, 8.71, ridge - 0.65), (cx + 0.65, 8.71, ridge + 0.65),
                           (cx - 0.65, 8.71, ridge + 0.65), (cx, 9.3, ridge)],
           [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [3, 2, 1, 0]])
    I = P["iron"]
    b.cyl(I, 0.02, (cx, 9.3, ridge), (cx, 10.3, ridge), seg=6)
    b.cyl(I, 0.05, (cx, 9.55, ridge), (cx, 9.6, ridge), seg=10)
    for (dx, dz) in ((0.32, 0), (-0.32, 0), (0, 0.32), (0, -0.32)):
        b.bar(I, (cx, 9.7, ridge), (cx + dx, 9.7, ridge + dz), 0.015)
    b.bar(I, (cx - 0.45, 10.05, ridge), (cx + 0.45, 10.05, ridge), 0.02)
    b.poly(I, [(cx + 0.45, 9.97, ridge), (cx + 0.62, 10.05, ridge), (cx + 0.45, 10.13, ridge)], [[0, 1, 2]])
    b.box(I, 0.2, 0.2, 0.012, cx - 0.4, 9.98, ridge)
    # (the little troll head on the vane: a flat disc, the JS paints the face)
    b.cyl(I, 0.12, (cx - 0.05, 10.25, ridge - 0.006), (cx - 0.05, 10.25, ridge + 0.006), seg=14)
    # hay-loft door + hoist beam high on the east gable
    gx = x1 + 0.04
    b.box(R, 0.06, 1.5, 1.4, gx, 4.75, ridge)
    b.box(T, 0.07, 0.1, 1.5, gx + 0.01, 4.7, ridge)
    b.box(T, 0.07, 0.1, 1.5, gx + 0.01, 6.2, ridge)
    for s in (-1, 1):
        b.box(T, 0.07, 1.6, 0.1, gx + 0.01, 4.7, ridge + s * 0.7)
    for r in (0.82, -0.82):
        b.box(T, 0.075, 1.75, 0.09, gx + 0.012, 4.6, ridge, rx=r)
    b.box(Wd, 1.6, 0.18, 0.18, x1 + 0.6, 7.05, ridge)
    b.cyl(I, 0.09, (x1 + 1.25, 6.86, ridge - 0.03), (x1 + 1.25, 6.86, ridge + 0.03), seg=12)
    b.cyl(P["rope"], 0.015, (x1 + 1.34, 6.86, ridge), (x1 + 1.34, 4.4, ridge), seg=5)
    b.lump(P["hay"], 0.55, 0.4, 0.45, x1 + 1.34, 4.0, ridge, seed=3, rnd=0.3, jitter=0.03, flat_base=False)
    # sliding doors hung off a track over the north opening, slid aside
    b.box(I, 8.4, 0.12, 0.08, 23, 3.72, z0 - 0.08)
    b.box(T, 8.6, 0.2, 0.04, 23, 3.84, z0 - 0.05)
    for cxd in (20.0, 26.0):
        zf = z0 - 0.17
        b.box(R, 2.0, 3.55, 0.07, cxd, 0.08, zf)
        b.box(T, 2.04, 0.13, 0.05, cxd, 0.08, zf - 0.05)
        b.box(T, 2.04, 0.13, 0.05, cxd, 3.5, zf - 0.05)
        b.box(T, 2.04, 0.12, 0.05, cxd, 1.8, zf - 0.05)
        for s in (-1, 1):
            b.box(T, 0.13, 3.55, 0.05, cxd + s * 0.955, 0.08, zf - 0.05)
        for (ylo, yhi) in ((0.21, 1.8), (1.92, 3.5)):
            L = math.hypot(1.78, yhi - ylo)
            ang = math.atan2(yhi - ylo, 1.78)
            for s in (-1, 1):
                b.box(T, L, 0.1, 0.045, cxd, (ylo + yhi) / 2 - 0.05, zf - 0.07, rz=s * ang)
        for s in (-1, 1):
            b.cyl(I, 0.07, (cxd + s * 0.6, 3.78, zf), (cxd + s * 0.6, 3.78, zf - 0.08), seg=10)
        b.box(I, 0.04, 0.3, 0.06, cxd + 0.85, 1.2, zf - 0.08)
    # the west door: a smaller pair of hinged doors swung flat
    for s in (-1, 1):
        zc = 24.5 + s * 2.25
        xf = x0 - 0.08
        b.box(R, 0.06, 2.15, 1.45, xf, 0.05, zc)
        b.box(T, 0.04, 0.1, 1.45, xf - 0.04, 1.05, zc)
        for r in (0.98, -0.98):
            b.box(T, 0.04, 2.3, 0.09, xf - 0.045, 0.0, zc, rx=r * 0.55)
    # windows: muntins in the open frames (no glass: an old barn)
    for w in walls:
        for hole in w.holes:
            for lo, hi in hole["spans"]:
                if lo < 0.05:
                    continue
                c = hole["c"]
                w.slab(b, T, c - 0.025, c + 0.025, lo, hi, w.at, 0.05)
                w.slab(b, T, c - hole["w"] / 2, c + hole["w"] / 2, (lo + hi) / 2 - 0.025, (lo + hi) / 2 + 0.025, w.at, 0.05)
    # inside: ceiling boards on joists, posts and beams, the loft
    b.box(Wd, x1 - x0 - 2 * t, 0.04, z1 - z0 - 2 * t, 23, 4.36, 24.5)
    xx = x0 + 0.9
    while xx < x1 - 0.5:
        b.box(Wd, 0.14, 0.22, z1 - z0 - 2 * t, xx, 4.14, 24.5)
        xx += 1.2
    lx0, lx1, lz0, lz1, ly = x0 + t, 20.4, z0 + t, z1 - t, 2.4
    b.box(Wd, lx1 - lx0, 0.06, lz1 - lz0, (lx0 + lx1) / 2, ly - 0.06, (lz0 + lz1) / 2)
    zz = lz0 + 0.5
    while zz < lz1:
        b.box(Wd, lx1 - lx0, 0.18, 0.1, (lx0 + lx1) / 2, ly - 0.24, zz)
        zz += 0.8
    b.box(Wd, 0.2, 0.25, lz1 - lz0, lx1 - 0.1, ly - 0.31, (lz0 + lz1) / 2)
    for pz in (lz0 + 0.12, lz1 - 0.12):
        b.box(Wd, 0.2, ly - 0.06, 0.2, lx1 - 0.1, 0, pz)
    # loft rail (the JS collider is a railing along x 20.4 with a gap at the stair)
    for (za, zb) in ((lz0, 27.1),):
        n = max(2, int((zb - za) / 1.2) + 1)
        for i in range(n):
            pz = za + 0.05 + (zb - za - 0.1) * i / (n - 1)
            b.box(Wd, 0.08, 1.0, 0.08, lx1 - 0.04, ly, pz)
        b.box(Wd, 0.09, 0.08, zb - za, lx1 - 0.04, ly + 0.95, (za + zb) / 2)
        b.box(Wd, 0.06, 0.07, zb - za, lx1 - 0.04, ly + 0.5, (za + zb) / 2)
    # the stair: climbs west along the south wall straight onto the loft;
    # plank treads + risers, boxed in underneath (its collider is solid to
    # the floor), a short landing, a handrail on the open (north) side
    sz = 27.7
    for k in range(8):
        top = 0.3 * (k + 1)
        xc = 24.4 - 0.42 * (k + 0.5)
        b.box(Wd, 0.4, 0.05, 1.0, xc, top - 0.05, sz)
        b.box(Wd, 0.03, 0.26, 0.98, xc + 0.2, top - 0.3, sz)
    for zz in (sz - 0.48, sz + 0.48):
        b.poly(Wd, [(24.4, 0, zz), (21.04, 0, zz), (21.04, 2.38, zz), (24.4, 0.28, zz)], [[0, 1, 2, 3]])
        b.poly(Wd, [(24.4, 0, zz), (24.4, 0.28, zz), (21.04, 2.38, zz), (21.04, 0, zz)], [[0, 1, 2, 3]])
    b.box(Wd, 0.64, 0.06, 1.0, 20.72, 2.34, sz)
    b.box(Wd, 0.64, 2.34, 0.04, 20.72, 0, sz - 0.48)
    b.bar(Wd, (24.3, 1.25, sz - 0.48), (21.1, 3.35, sz - 0.48), 0.06)
    for k in (0, 3, 6):
        b.box(Wd, 0.06, 0.95, 0.06, 24.4 - 0.42 * (k + 0.5), 0.3 * (k + 1), sz - 0.48)
    # stalls along the east wall: low plank partitions (decor: under 1.1 m)
    for pz in (23.3, 24.9):
        b.box(Wd, 2.0, 1.05, 0.08, 27.75, 0, pz)
        b.box(Wd, 0.12, 1.25, 0.12, 26.8, 0, pz)
    # tools hung on the north wall, a lantern hook, a saddle on a rail
    for i, (tx, kind) in enumerate(((18.0, "fork"), (18.5, "rake"), (19.0, "shovel"), (27.2, "fork"), (28.0, "scythe"))):
        zz = z0 + t + 0.06
        b.cyl(P["handle"], 0.025, (tx, 0.5, zz), (tx + 0.08, 2.1, zz), seg=6)
        if kind == "fork":
            for d in (-0.08, 0, 0.08):
                b.cyl(P["tool"], 0.008, (tx + d, 0.18, zz), (tx + d, 0.5, zz), seg=4)
            b.box(P["tool"], 0.2, 0.03, 0.02, tx, 0.48, zz)
        elif kind == "rake":
            b.box(P["tool"], 0.4, 0.04, 0.03, tx, 0.48, zz)
            for d in range(-4, 5):
                b.box(P["tool"], 0.01, 0.07, 0.01, tx + d * 0.045, 0.41, zz)
        elif kind == "shovel":
            b.box(P["tool"], 0.24, 0.32, 0.02, tx, 0.18, zz)
        else:
            b.bar(P["tool"], (tx + 0.08, 2.1, zz), (tx + 0.62, 1.95, zz), 0.03, 0.12)
    b.box(Wd, 0.1, 0.1, 1.4, x1 - t - 0.06, 1.2, 27.0)
    b.lump(P["wainscot"], 0.5, 0.35, 0.6, x1 - t - 0.25, 1.25, 27.0, seed=9, rnd=0.5, jitter=0.03)
    Rg.end()
    barn_props(b, P, Rg)
    b.finish("hg-barn.glb")


# ------------------------------------------------------------- candy shop

def build_shop(P, Rg):
    """Over: walls x -11..-1, z 21..27.5 (0.4 thick, 3.4 tall); roof slab
    10.6 x 7.1 x 0.3 at 3.4; false front 10.2 x 1.8 x 0.3 at z 21.1;
    counter (-8.4, 25.1) 2.8 x 0.8 x 1.05; shelves (-7.6, 27.0) 4.6 x 0.5 x 2.2;
    bay knee wall (-9, 20.72) 2.0 x 0.55 x 0.9."""
    b = HGBuilder()
    rng = random.Random(41)
    Rg.begin(b, "south:candyshop")
    C, OT, D, BR = P["clap"], P["shoptrim"], P["shopdark"], P["brick"]
    x0, x1, z0, z1, h, t = -11.0, -1.0, 21.0, 27.5, 3.4, 0.4
    front = Wall("x", z0 + 0.2, x0, x1, h, t, out=-1, holes=[
        {"c": -6, "w": 1.8, "spans": [(0, 2.5)]}, {"c": -9, "w": 2.2, "spans": [(0.9, 2.3)]},
        {"c": -2.9, "w": 1.8, "spans": [(0.9, 2.3)]}])
    back = Wall("x", z1 - 0.2, x0, x1, h, t, out=1, holes=[
        {"c": -3.5, "w": 1.6, "spans": [(0, 2.4)]}, {"c": -8.5, "w": 1.4, "spans": [(1.0, 2.2)]}])
    west = Wall("z", x0 + 0.2, z0 + 0.4, z1 - 0.4, h, t, out=-1, holes=[{"c": 24.2, "w": 1.6, "spans": [(1.0, 2.3)]}])
    east = Wall("z", x1 - 0.2, z0 + 0.4, z1 - 0.4, h, t, out=1, holes=[{"c": 24.2, "w": 1.4, "spans": [(1.0, 2.3)]}])
    front.solid(b, D, inner=P["wainscot"], split=0.3)
    front.laps(b, C, every=0.19, y0=0.85)
    for w in (back, west, east):
        w.solid(b, BR, inner=P["paper"], split=0.6)
    # brick: soldier-course heads + stone sills on the brick walls' windows
    for w in (back, west, east):
        for hole in w.holes:
            for lo, hi in hole["spans"]:
                c = hole["c"]
                k = -hole["w"] / 2 - 0.06
                while k < hole["w"] / 2 + 0.06:
                    w.slab(b, BR, c + k, c + k + 0.075, hi, hi + 0.24, w.face(0.012), 0.025)
                    k += 0.085
                if lo > 0.05:
                    w.slab(b, P["granite"], c - hole["w"] / 2 - 0.1, c + hole["w"] / 2 + 0.1, lo - 0.08, lo, w.face(0.05), 0.1)
        w.casings(b, D, fw=0.07, proud=0.03, sill=False)
    # parapet + coping on the sides and back, tar roof, chimney
    for (cx, cz, w_, d_) in ((-6, z1 - 0.2, 10.0, 0.4), (x0 + 0.2, 24.25, 0.4, 6.5), (x1 - 0.2, 24.25, 0.4, 6.5)):
        b.box(BR, w_, 0.5, d_, cx, 3.7, cz)
        b.box(P["granite"], w_ + 0.1, 0.07, d_ + 0.1, cx, 4.2, cz)
    b.box(P["tar"], 9.6, 0.02, 6.0, -6, 3.7, 24.3)
    b.box(BR, 0.7, 1.6, 0.6, -9.6, 3.7, 26.6)
    b.box(P["granite"], 0.8, 0.08, 0.7, -9.6, 5.3, 26.6)
    b.cyl(P["iron"], 0.12, (-3.0, 3.72, 25.0), (-3.0, 4.3, 25.0), seg=10)
    b.cyl(P["iron"], 0.2, (-3.0, 4.3, 25.0), (-3.0, 4.42, 25.0), seg=10, r2=0.05)
    # the storefront: pilasters, kick panels, door + transom, cornice band
    zf = z0 - 0.0
    for px in (-10.82, -7.4, -4.65, -1.18):
        b.box(OT, 0.34, 3.0, 0.12, px, 0, zf - 0.04)
        b.box(OT, 0.42, 0.14, 0.16, px, 0, zf - 0.06)
        b.box(OT, 0.42, 0.16, 0.16, px, 2.9, zf - 0.06)
    for (c, w_) in ((-2.9, 1.8),):
        b.box(D, w_ + 0.2, 0.85, 0.06, c, 0, zf - 0.03)
        b.box(OT, w_ - 0.2, 0.5, 0.03, c, 0.18, zf - 0.07)
    front.casings(b, OT, fw=0.1, proud=0.05)
    b.box(P["warm"], 1.6, 0.48, 0.03, -6, 2.62, zf - 0.0)
    b.box(OT, 1.8, 0.06, 0.06, -6, 2.58, zf - 0.04)
    b.box(OT, 1.8, 0.06, 0.06, -6, 3.1, zf - 0.04)
    for k in (-0.4, 0.0, 0.4):
        b.box(OT, 0.04, 0.48, 0.05, -6 + k, 2.62, zf - 0.03)
    # display-window muntins (no glass: open, as before)
    for c, w_ in ((-2.9, 1.8),):
        b.box(OT, 0.04, 1.4, 0.04, c - w_ / 6, 0.9, zf + 0.0)
        b.box(OT, 0.04, 1.4, 0.04, c + w_ / 6, 0.9, zf + 0.0)
        b.box(OT, w_, 0.04, 0.04, c, 1.95, zf + 0.0)
    # the door leaf, swung in against the wall
    b.box(D, 0.9, 2.4, 0.05, -6.45 - 0.45 + 0.45, 0.02, zf + 0.62)
    b.box(P["warm"], 0.6, 0.9, 0.06, -6.45, 1.2, zf + 0.62)
    b.box(OT, 0.04, 0.04, 0.12, -6.05, 1.1, zf + 0.62)
    # the bay window: knee wall, angled sides, mullions, a copper cap
    bz = z0 - 0.55
    pts = [(-10.1, z0), (-9.65, bz), (-8.35, bz), (-7.9, z0)]
    prof = [(p[0], p[1]) for p in pts]
    for (yy0, yy1, m) in ((0.0, 0.88, C), (0.88, 0.95, OT), (2.3, 2.38, OT)):
        vs = [(x, yy0, z) for x, z in prof] + [(x, yy1, z) for x, z in prof]
        b.poly(m, vs, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3]])
    for (xa, za) in pts:
        b.box(OT, 0.07, 1.36, 0.07, xa, 0.95, za)
    for xa in (-9.22, -8.78):
        b.box(OT, 0.04, 1.36, 0.04, xa, 0.95, bz)
    capv = [(-10.25, 2.38, z0), (-9.72, 2.38, bz - 0.12), (-8.28, 2.38, bz - 0.12), (-7.75, 2.38, z0),
            (-9.6, 2.62, z0), (-8.4, 2.62, z0)]
    b.poly(P["bronze"], capv, [[0, 1, 4], [1, 2, 5, 4], [2, 3, 5]])
    # candy jars stacked in the bay (painted: bright lids, coloured fills)
    for i, xj in enumerate((-9.55, -9.2, -8.85, -8.5)):
        for row, (yj, zj) in enumerate(((0.95, bz + 0.18), (1.25, bz + 0.38))):
            col = [0xff4a7a, 0x5ad0ff, 0xffd23a, 0x8aff6a, 0xc07aff, 0xff8a3a][(i * 2 + row) % 6]
            jar = mat("HG_Jar%d" % ((i * 2 + row) % 6), col, 0.3, 0.0, col, 0.25)
            b.cyl(jar, 0.11, (xj, yj, zj), (xj, yj + 0.24, zj), seg=10)
            b.cyl(P["brass"], 0.08, (xj, yj + 0.24, zj), (xj, yj + 0.29, zj), seg=10)
    b.box(P["wainscot"], 1.3, 0.04, 0.5, -9, 0.95, bz + 0.27)
    # false front: lap boards, a sign frame, brackets, a heavy cornice
    ffz = z0 + 0.1
    for k in range(9):
        yy = h + k * 0.2
        b.box(C, 10.2, 0.22, 0.3, -6, yy, ffz, rx=0.0)
        b.box(C, 10.22, 0.03, 0.32, -6, yy + 0.19, ffz)
    b.box(D, 7.8, 1.65, 0.06, -6, h + 0.08, ffz - 0.16)
    for yy in (h + 0.04, h + 1.7):
        b.box(OT, 8.1, 0.12, 0.1, -6, yy, ffz - 0.18)
    for xx in (-9.98, -2.02):
        b.box(OT, 0.12, 1.78, 0.1, xx, h + 0.04, ffz - 0.18)
    b.box(OT, 10.6, 0.16, 0.5, -6, h + 1.8, ffz)
    b.box(OT, 10.8, 0.1, 0.62, -6, h + 1.96, ffz)
    b.box(D, 10.3, 0.22, 0.12, -6, h + 1.55, ffz - 0.2)
    xx = -10.8
    while xx <= -1.15:
        b.prism(OT, [(ffz - 0.15, h + 1.55), (ffz - 0.45, h + 1.8), (ffz - 0.15, h + 1.8)], xx - 0.05, xx + 0.05, axis="x")
        xx += 0.6
    for xx in (-10.6, -1.4):
        b.cyl(OT, 0.09, (xx, h + 2.06, ffz), (xx, h + 2.4, ffz), seg=10, r2=0.02)
    # the storefront cornice band over the shopfront (the roof slab's edge)
    b.box(D, 10.6, 0.3, 0.12, -6, 3.4, z0 - 0.05)
    b.box(OT, 10.7, 0.06, 0.2, -6, 3.37, z0 - 0.08)
    # inside: floorboards, wainscot + chair rail, pressed-tin ceiling
    b.box(P["floor"], 9.2, 0.02, 5.7, -6, 0, 24.25)
    for (cx, cz, w_, d_) in ((-6, z1 - t - 0.02, 9.2, 0.04), (x0 + t + 0.02, 24.25, 0.04, 5.7), (x1 - t - 0.02, 24.25, 0.04, 5.7)):
        b.box(P["wainscot"], w_, 1.0, d_, cx, 0, cz)
        b.box(OT, w_ + (0.04 if w_ > 1 else 0.02), 0.06, d_ + (0.02 if w_ > 1 else 0.04), cx, 1.0, cz)
    b.box(P["tin"], 9.2, 0.02, 5.7, -6, 3.37, 24.25)
    for i in range(10):
        b.box(P["brass"], 0.04, 0.02, 5.7, -10.6 + i * 1.0 + 0.5, 3.35, 24.25)
    for i in range(6):
        b.box(P["brass"], 9.2, 0.02, 0.04, -6, 3.35, z0 + t + 0.5 + i * 1.0)
    # the glass counter: wood plinth, dark glass, a brass rail, scale + till
    cx, cz = -8.4, 25.1
    b.box(P["wainscot"], 2.8, 0.4, 0.8, cx, 0, cz, bevel=0.01)
    b.box(P["glass"], 2.7, 0.55, 0.72, cx, 0.4, cz)
    b.box(P["warm"], 2.6, 0.03, 0.6, cx, 0.62, cz)
    b.box(P["wainscot"], 2.9, 0.08, 0.86, cx, 0.95, cz, bevel=0.01)
    b.box(P["brass"], 2.8, 0.03, 0.03, cx, 0.6, cz - 0.38)
    b.cyl(P["brass"], 0.14, (cx - 0.8, 1.03, cz), (cx - 0.8, 1.06, cz), seg=14)
    b.cyl(P["brass"], 0.03, (cx - 0.8, 1.06, cz), (cx - 0.8, 1.35, cz), seg=6)
    b.cyl(P["brass"], 0.16, (cx - 0.8, 1.35, cz), (cx - 0.8, 1.4, cz), seg=14, r2=0.2)
    b.box(P["brass"], 0.4, 0.3, 0.35, cx + 0.7, 1.03, cz)
    b.box(P["brass"], 0.42, 0.05, 0.25, cx + 0.7, 1.33, cz - 0.05, rx=0.4)
    # shelving behind (JS jars sit on these boards)
    sx, sz = -7.6, 27.0
    for s in (-1, 1):
        b.box(P["wainscot"], 0.06, 2.2, 0.5, sx + s * 2.27, 0, sz)
    for k in range(4):
        b.box(P["wainscot"], 4.6, 0.04, 0.42, sx, 0.41 + k * 0.62, sz - 0.04)
    b.box(OT, 4.7, 0.12, 0.52, sx, 2.2, sz)
    # the pendant lamp
    b.cyl(P["iron"], 0.008, (-6, 3.37, 24.3), (-6, 2.85, 24.3), seg=4)
    b.cyl(P["bronze_dk"], 0.06, (-6, 2.85, 24.3), (-6, 2.6, 24.3), seg=12, r2=0.3)
    b.cyl(P["lamp"], 0.09, (-6, 2.55, 24.3), (-6, 2.68, 24.3), seg=10)
    Rg.end()
    shop_props(b, P, Rg)
    b.finish("hg-candyshop.glb")


CANDY = [0xff4a7a, 0x5ad0ff, 0xffd23a, 0x8aff6a, 0xc07aff, 0xff8a3a]


def candy_mats():
    return [mat("HG_Candy%d" % i, c, 0.4, 0.0, c, 0.05) for i, c in enumerate(CANDY)]


def sweet(b, m, x, y, z, ry, s=1.0):
    """A wrapped sweet: a little bar with a twist at each end."""
    b.box(m, 0.07 * s, 0.03 * s, 0.035 * s, x, y, z, ry=ry)
    for e in (-1, 1):
        dx, dz = math.cos(ry) * e * 0.05 * s, -math.sin(ry) * e * 0.05 * s
        b.box(m, 0.03 * s, 0.025 * s, 0.045 * s, x + dx, y + 0.003, z + dz, ry=ry)


def cobweb(b, m, c, u, v, size, seed):
    """A corner's cobweb: spokes out from the corner along the wall faces
    u and v (unit vectors in the two walls), three sagging rings of thread."""
    rnd = random.Random(seed)
    n = 6
    spokes = []
    for i in range(n):
        t = i / (n - 1)
        d = (u[0] * (1 - t) + v[0] * t, u[1] * (1 - t) + v[1] * t, u[2] * (1 - t) + v[2] * t)
        L = size * (0.8 + rnd.random() * 0.3)
        spokes.append((d, L))
        b.bar(m, c, (c[0] + d[0] * L, c[1] + d[1] * L, c[2] + d[2] * L), 0.006)
    for k in (0.35, 0.62, 0.88):
        for i in range(n - 1):
            (d0, L0), (d1, L1) = spokes[i], spokes[i + 1]
            p = (c[0] + d0[0] * L0 * k, c[1] + d0[1] * L0 * k - 0.02 * k, c[2] + d0[2] * L0 * k)
            q = (c[0] + d1[0] * L1 * k, c[1] + d1[1] * L1 * k - 0.02 * k, c[2] + d1[2] * L1 * k)
            b.bar(m, p, q, 0.005)


def crow(b, P, x, y, z, ry, seed):
    """A crow perched (feet at y), facing ry."""
    m = P["crow"]
    c, s = math.cos(ry), math.sin(ry)
    at = lambda f, up, side=0.0: (x + c * f + s * side, y + up, z - s * f + c * side)
    b.lump(m, 0.16, 0.16, 0.3, x, y + 0.05, z, seed=seed, rnd=0.8, jitter=0.01, ry=ry, n=2)
    hx, hy, hz = at(0.15, 0.17)
    b.lump(m, 0.1, 0.1, 0.1, hx, hy, hz, seed=seed + 1, rnd=0.9, jitter=0.005, ry=ry, n=2)
    b.bar(P["beak"], at(0.19, 0.215), at(0.27, 0.205), 0.025, 0.02)
    b.bar(m, at(-0.12, 0.13), at(-0.3, 0.09), 0.08, 0.015)
    for sd in (-0.035, 0.035):
        b.bar(P["beak"], at(0.0, 0.0, sd), at(0.0, 0.06, sd), 0.012)


def sack(b, P, x, y, z, ry, seed, w=0.55):
    b.lump(P["sack"], w, 0.42, w * 0.72, x, y, z, seed=seed, rnd=0.55, jitter=0.03, ry=ry)
    # the tied neck
    c, s = math.cos(ry), math.sin(ry)
    b.cyl(P["twine"], 0.05, (x + c * w * 0.42, y + 0.28, z - s * w * 0.42), (x + c * w * 0.52, y + 0.33, z - s * w * 0.52), seg=6)


def pail(b, P, x, z, r=0.15, h=0.3, y=0.0, full=None):
    lathe(b, P["pail"], x, z, [(r * 0.78, 0.0), (r, h), (r * 0.94, h)], seg=12, y0=y, caps=False)
    lathe(b, P["pail"], x, z, [(0.002, 0.004), (r * 0.78, 0.004)], seg=12, y0=y, caps=False)
    ring(b, P["iron"], (x, y + h, z), r, 0.008, seg=14, tseg=4)
    ring(b, P["iron"], (x, y + h * 0.75, z), r * 1.05, 0.06, seg=10, tseg=4, axis="x", arc=math.pi)
    if full:
        b.cyl(full, r * 0.92, (x, y + h * 0.7, z), (x, y + h * 0.72, z), seg=12)


def barn_props(b, P, R):
    """The barn dressed (phase 3): a wheelbarrow of hay by the north door,
    feed sacks under the loft, the east stall's trough with a pail and a milk
    can, a pitchfork against the stall post, cobwebs in the corners, a cart
    wheel against the north wall outside, crows on the ridge. hollowgrin.js
    lays the barrow's, sacks' and trough's colliders."""
    W = P["barnwood"]
    # the wheelbarrow, east of the north door, nosed into the corner
    R.begin(b, "south:barn-barrow", on="south:barn")
    bx, bz, ry = 26.6, 21.3, 0.3
    c, s = math.cos(ry), math.sin(ry)
    at = lambda f, side, y: (bx + c * f + s * side, y, bz - s * f + c * side)
    tray = [at(-0.45, -0.32, 0.38), at(0.35, -0.32, 0.38), at(0.5, -0.38, 0.62), at(-0.55, -0.42, 0.66),
            at(-0.45, 0.32, 0.38), at(0.35, 0.32, 0.38), at(0.5, 0.38, 0.62), at(-0.55, 0.42, 0.66)]
    b.poly(P["pail"], tray, [[0, 1, 5, 4], [0, 3, 2, 1], [4, 5, 6, 7], [1, 2, 6, 5], [0, 4, 7, 3]])
    for sd in (-0.3, 0.3):
        b.bar(W, at(0.55, sd * 0.5, 0.3), at(-1.05, sd, 0.62), 0.045)
        b.bar(W, at(-0.35, sd, 0.4), at(-0.4, sd, 0.0), 0.04)
    wx, wy, wz = at(0.62, 0.0, 0.2)
    ring(b, P["iron"], (wx, wy, wz), 0.18, 0.035, seg=16, tseg=5, axis="x" if abs(s) > 0.7 else "z")
    b.cyl(P["iron"], 0.03, at(0.62, -0.05, 0.2), at(0.62, 0.05, 0.2), seg=6)
    b.lump(P["hay"], 0.85, 0.32, 0.62, bx - c * 0.05, 0.52, bz + s * 0.05, seed=31, rnd=0.6, jitter=0.05, ry=ry, flat_base=False)
    R.end()
    # feed sacks under the loft, west of the north door
    R.begin(b, "south:barn-sacks", on="south:barn")
    for i, (x, y, z, r) in enumerate(((17.95, 0.0, 20.95, 0.2), (18.55, 0.0, 21.05, -0.15), (19.15, 0.0, 20.9, 0.1),
                                      (18.25, 0.36, 21.0, 1.3), (18.85, 0.36, 20.98, 1.7), (17.95, 0.0, 21.55, 1.5))):
        sack(b, P, x, y, z, r, 40 + i)
    R.end()
    # the east stall: a trough along the wall, a pail, a milk can
    R.begin(b, "south:barn-trough", on="south:barn")
    tx, tz = 28.3, 24.1
    b.box(W, 0.06, 0.48, 1.2, tx - 0.22, 0.0, tz)
    b.box(W, 0.06, 0.48, 1.2, tx + 0.22, 0.0, tz)
    b.box(W, 0.5, 0.06, 1.2, tx, 0.06, tz)
    for e in (-1, 1):
        b.box(W, 0.5, 0.48, 0.06, tx, 0.0, tz + e * 0.57)
    b.box(P["water"], 0.38, 0.02, 1.08, tx, 0.36, tz)
    pail(b, P, 27.25, 24.45, full=P["water"])
    lathe(b, P["pail"], 27.15, 23.65, [(0.16, 0.0), (0.17, 0.42), (0.1, 0.5), (0.1, 0.58), (0.12, 0.6)], seg=12)
    R.end()
    # a pitchfork against the stall post
    R.begin(b, "south:barn-fork", on="south:barn")
    b.cyl(P["handle"], 0.022, (26.55, 0.05, 22.95), (26.74, 1.45, 23.22), seg=6)
    for d in (-0.06, 0.0, 0.06):
        b.cyl(P["tool"], 0.008, (26.5 + d * 0.2, 0.02, 22.88 + d), (26.55, 0.33, 22.95 + d * 0.4), seg=4)
    R.end()
    # cobwebs in the corners under the ceiling
    R.begin(b, "south:barn-webs", on="south:barn")
    for (cx, cz, ux, vz) in ((17.36, 28.64, 1, -1), (28.64, 28.64, -1, -1), (28.64, 20.36, -1, 1)):
        cobweb(b, P["web"], (cx, 4.34, cz), (ux, -0.35, 0), (0, -0.35, vz), 0.7, int(cx * 10))
    R.end()
    # a cart wheel leant on the north wall, west of the doors
    R.begin(b, "south:barn-wheel", on="south:barn")
    wc = (18.6, 0.56, 19.72)
    ring(b, W, wc, 0.52, 0.04, seg=18, tseg=5, axis="z")
    for k in range(8):
        a = k * math.pi / 4
        b.bar(W, (wc[0], wc[1], wc[2]), (wc[0] + math.cos(a) * 0.5, wc[1] + math.sin(a) * 0.5, wc[2]), 0.03)
    b.cyl(P["iron"], 0.07, (wc[0], wc[1], wc[2] - 0.06), (wc[0], wc[1], wc[2] + 0.06), seg=10)
    R.end()
    # crows on the ridge and the hoist beam
    R.begin(b, "south:barn-crows", on="south:barn")
    for i, (x, y, z, r) in enumerate(((18.6, 7.74, 24.5, 1.2), (19.3, 7.74, 24.52, -2.0), (27.4, 7.74, 24.48, 0.4), (29.7, 7.14, 24.5, 2.9))):
        crow(b, P, x, y, z, r, 90 + i)
    R.end()


def shop_props(b, P, R):
    """The candy shop dressed (phase 3): a gumball machine by the back door,
    a rack of sweet bins under the west window, a jar of lollipops, paper
    bags and loose sweets on the counter, sweets spilled on the floor,
    cobwebs in two corners. hollowgrin.js lays the machine's and the rack's
    colliders; the jars on the shelves and the candy cauldron stay its."""
    rnd = random.Random(401)
    CM = candy_mats()
    W = P["wainscot"]
    # the gumball machine
    R.begin(b, "south:shop-gumball", on="south:candyshop")
    gx, gz = -1.95, 26.55
    lathe(b, P["gumred"], gx, gz, [(0.22, 0.0), (0.22, 0.05), (0.06, 0.08), (0.04, 0.12), (0.04, 0.72), (0.09, 0.75)], seg=14)
    b.box(P["gumred"], 0.26, 0.22, 0.26, gx, 0.75, gz)
    b.box(P["brass"], 0.1, 0.07, 0.02, gx, 0.85, gz - 0.13)
    b.cyl(P["brass"], 0.025, (gx, 0.87, gz - 0.14), (gx, 0.87, gz - 0.18), seg=8)
    ring(b, P["brass"], (gx, 0.98, gz), 0.12, 0.012, seg=14, tseg=4)
    n = 46
    for i in range(n):
        yy = 1 - 2 * (i + 0.5) / n
        rr = math.sqrt(1 - yy * yy)
        a = i * 2.39996
        px, py, pz = gx + math.cos(a) * rr * 0.17, 1.17 + yy * 0.17, gz + math.sin(a) * rr * 0.17
        b.lump(CM[i % len(CM)], 0.07, 0.07, 0.07, px, py - 0.035, pz, seed=i, rnd=1.0, jitter=0.0, flat_base=False, n=2)
    ring(b, P["brass"], (gx, 1.35, gz), 0.1, 0.012, seg=14, tseg=4)
    lathe(b, P["gumred"], gx, gz, [(0.11, 1.34), (0.11, 1.38), (0.05, 1.42), (0.025, 1.47)], seg=12)
    R.end()
    # the rack of bins along the west wall, under the window's sill
    R.begin(b, "south:shop-bins", on="south:candyshop")
    rx0, rx1, rz0, rz1 = -10.58, -10.02, 21.8, 24.4
    b.box(W, rx1 - rx0, 0.04, rz1 - rz0, (rx0 + rx1) / 2, 0.42, (rz0 + rz1) / 2)
    for zz in (rz0 + 0.03, rz1 - 0.03):
        b.box(W, rx1 - rx0, 0.85, 0.05, (rx0 + rx1) / 2, 0.0, zz)
    b.box(W, 0.05, 0.85, rz1 - rz0, rx0 + 0.03, 0.0, (rz0 + rz1) / 2)
    nb = 4
    for tier, (y0, x_in, h) in enumerate(((0.0, 0.0, 0.4), (0.46, 0.18, 0.36))):
        for k in range(nb):
            za = rz0 + 0.06 + k * (rz1 - rz0 - 0.12) / nb
            zb = za + (rz1 - rz0 - 0.12) / nb - 0.04
            bx0 = rx0 + 0.06 + x_in
            # the bin: open front, a little lower than its back
            b.box(W, rx1 - bx0, 0.03, zb - za, (bx0 + rx1) / 2, y0, (za + zb) / 2)
            b.box(W, rx1 - bx0, h, 0.025, (bx0 + rx1) / 2, y0, za)
            b.box(W, rx1 - bx0, h, 0.025, (bx0 + rx1) / 2, y0, zb)
            b.box(W, 0.025, h * 0.6, zb - za, rx1 - 0.0125, y0, (za + zb) / 2)
            m = CM[(k + tier * 2) % len(CM)]
            b.lump(m, rx1 - bx0 - 0.06, h * 0.55, zb - za - 0.06, (bx0 + rx1) / 2 - 0.01, y0 + 0.03, (za + zb) / 2,
                   seed=k * 7 + tier, rnd=0.4, jitter=0.02, flat_base=True, n=2)
            for j in range(5):
                sweet(b, CM[(k + j) % len(CM)], bx0 + 0.08 + rnd.random() * (rx1 - bx0 - 0.16), y0 + h * 0.55 + 0.02,
                      za + 0.06 + rnd.random() * (zb - za - 0.12), rnd.random() * 3.1)
    R.end()
    # the counter top: a jar of lollipops, a stack of paper bags, loose sweets
    R.begin(b, "south:shop-counter-goods", on=["south:candyshop"])
    jx, jz, top = -8.55, 25.25, 1.03
    lathe(b, P["glass"], jx, jz, [(0.09, 0.0), (0.1, 0.02), (0.1, 0.2), (0.07, 0.22)], seg=12, y0=top, caps=False)
    for i in range(7):
        a = i * 0.9
        tip = (jx + math.cos(a) * 0.09, top + 0.42 + (i % 2) * 0.05, jz + math.sin(a) * 0.09)
        b.cyl(P["paper_w"], 0.006, (jx + math.cos(a) * 0.02, top + 0.05, jz + math.sin(a) * 0.02), tip, seg=4)
        b.cyl(CM[i % len(CM)], 0.055, (tip[0] - 0.008, tip[1], tip[2]), (tip[0] + 0.008, tip[1], tip[2]), seg=12)
    for k in range(4):
        b.box(P["kraft"], 0.2, 0.012, 0.13, -8.12, top + k * 0.013, 24.95, ry=k * 0.08)
    b.box(P["kraft"], 0.15, 0.24, 0.09, -7.88, top, 25.3, ry=0.2)
    for i in range(9):
        sweet(b, CM[i % len(CM)], -8.9 + rnd.random() * 0.75, top + 0.003, 24.85 + rnd.random() * 0.45, rnd.random() * 3.1)
    R.end()
    # sweets spilled on the floor in front of the counter and the bins
    R.begin(b, "south:shop-spill", on=["south:candyshop", "south:shop-bins"])
    for i in range(14):
        x = -9.9 + rnd.random() * 2.8 if i % 2 else -9.95 + rnd.random() * 0.6
        z = 24.1 + rnd.random() * 0.5 if i % 2 else 22.0 + rnd.random() * 2.2
        sweet(b, CM[i % len(CM)], x, 0.022, z, rnd.random() * 3.1)
    R.end()
    # cobwebs high in two corners
    R.begin(b, "south:shop-webs", on="south:candyshop")
    cobweb(b, P["web"], (-10.59, 3.34, 21.41), (1, -0.3, 0), (0, -0.3, 1), 0.55, 11)
    cobweb(b, P["web"], (-1.41, 3.34, 21.41), (-1, -0.3, 0), (0, -0.3, 1), 0.5, 12)
    R.end()


# ------------------------------------------------------------------ the windmill

MILL = (28.0, -22.0)                 # hollowgrin.js: the solid 4 x 4 x 7 under it
HUB = (28.0, 7.6, -19.7)             # the sails' group in the JS, tilted back 0.12
TILT = 0.12
OCT = math.cos(math.pi / 8)
# hollowgrin.js MILL_PROPS' pieces, and the bales its hayBale() calls lay
MILL_BALES = [(24.6, -21.2, math.pi / 2), (24.75, -19.75, math.pi / 2 + 0.06), (31.5, -23.2, 0.7)]


def mill_apo(y):
    """The tower's apothem (centre to a face) at height y: the brick base
    near plumb to 2.3 m, then the smock's taper to the curb at 7."""
    if y <= 2.3:
        return 2.0 - 0.06 * y / 2.3
    return 1.82 - (y - 2.3) * 0.52 / 4.7


def oct_pt(apo, ang, y, c=MILL):
    r = apo / OCT
    return (c[0] + r * math.cos(ang), y, c[1] + r * math.sin(ang))


def on_face(k, u, y, out=0.0):
    """A point on the tower's face k (its normal at k * 45 degrees from +x,
    2 = south): u along the face, `out` off it."""
    phi = k * math.pi / 4
    a = mill_apo(y) + out
    return (MILL[0] + a * math.cos(phi) - u * math.sin(phi), y, MILL[1] + a * math.sin(phi) + u * math.cos(phi))


def oct_shell(b, m, y0, y1, a0, a1, c=MILL):
    for k in range(8):
        phi = k * math.pi / 4
        p, q = phi - math.pi / 8, phi + math.pi / 8
        facing(b, m, [oct_pt(a0, p, y0, c), oct_pt(a0, q, y0, c), oct_pt(a1, q, y1, c), oct_pt(a1, p, y1, c)], (math.cos(phi), 0, math.sin(phi)))


def oct_ring(b, m, y, a_out, a_in, up=1, c=MILL):
    """A flat octagonal annulus at y (a ledge's top, a band's underside)."""
    for k in range(8):
        phi = k * math.pi / 4
        p, q = phi - math.pi / 8, phi + math.pi / 8
        facing(b, m, [oct_pt(a_out, p, y, c), oct_pt(a_out, q, y, c), oct_pt(a_in, q, y, c), oct_pt(a_in, p, y, c)], (0, up, 0))


def mill_window(b, P, k, yc, w, h, glass):
    """A four-pane window on face k: glass, a frame, a cross of glazing bars."""
    o = 0.04
    facing(b, glass, [on_face(k, -w / 2, yc - h / 2, o), on_face(k, w / 2, yc - h / 2, o), on_face(k, w / 2, yc + h / 2, o), on_face(k, -w / 2, yc + h / 2, o)],
           (math.cos(k * math.pi / 4), 0, math.sin(k * math.pi / 4)))
    f = 0.075
    for u in (-w / 2 - f / 2, w / 2 + f / 2):
        b.bar(P["trim"], on_face(k, u, yc - h / 2 - f, o + 0.03), on_face(k, u, yc + h / 2 + f, o + 0.03), f, 0.06)
    for y in (yc - h / 2 - f / 2, yc + h / 2 + f / 2):
        b.bar(P["trim"], on_face(k, -w / 2 - f, y, o + 0.03), on_face(k, w / 2 + f, y, o + 0.03), 0.06, f)
    b.bar(P["trim"], on_face(k, 0.0, yc - h / 2, o + 0.015), on_face(k, 0.0, yc + h / 2, o + 0.015), 0.03, 0.03)
    b.bar(P["trim"], on_face(k, -w / 2, yc, o + 0.015), on_face(k, w / 2, yc, o + 0.015), 0.03, 0.03)
    # the sill, a little proud
    b.bar(P["trim"], on_face(k, -w / 2 - 0.12, yc - h / 2 - f - 0.03, o + 0.07), on_face(k, w / 2 + 0.12, yc - h / 2 - f - 0.03, o + 0.07), 0.12, 0.05)


def build_windmill(P, R):
    """The windmill (phase 3): a weatherboarded smock on a brick base, its
    corner posts, windows (the south one lit), the door, the ogee cap with
    its finial, the windshaft out to the sails (hg-windmill-sails, turned by
    the JS) and the fantail at the back. Round its foot: flour sacks and
    crates by the door, a millstone against the west face, a ladder up the
    east one, the JS's three hay bales. hollowgrin.js lays the props'
    colliders (MILL_PROPS)."""
    b = HGBuilder()
    MP = mill_palette()
    cx, cz = MILL
    R.begin(b, "east:windmill")
    # the brick base, a granite plinth and the string course over it
    oct_shell(b, P["brick"], 0.0, 2.3, mill_apo(0.0), mill_apo(2.3))
    oct_shell(b, P["granite_dk"], 0.0, 0.32, 2.035, 2.03)
    oct_ring(b, P["granite_dk"], 0.32, 2.035, mill_apo(0.32))
    oct_shell(b, P["granite"], 2.22, 2.4, 2.05, 2.05)
    oct_ring(b, P["granite"], 2.22, 2.05, mill_apo(2.22), up=-1)
    oct_ring(b, P["granite"], 2.4, 2.05, mill_apo(2.4))
    # the smock: a backing shell, then lapped boards, each course's foot proud
    oct_shell(b, MP["board_dk"], 2.4, 7.0, mill_apo(2.4), mill_apo(7.0))
    y, course = 2.4, (7.0 - 2.4) / 19
    rnd = random.Random(5)
    for i in range(19):
        for k in range(8):
            phi = k * math.pi / 4
            p, q = phi - math.pi / 8, phi + math.pi / 8
            m = MP["board"] if rnd.random() < 0.8 else MP["board2"]
            facing(b, m, [oct_pt(mill_apo(y) + 0.03, p, y), oct_pt(mill_apo(y) + 0.03, q, y),
                          oct_pt(mill_apo(y + course), q, y + course), oct_pt(mill_apo(y + course), p, y + course)], (math.cos(phi), 0, math.sin(phi)))
        y += course
    # corner posts
    for k in range(8):
        a = k * math.pi / 4 + math.pi / 8
        b.bar(P["trim"], oct_pt(mill_apo(2.4) + 0.03, a, 2.4), oct_pt(mill_apo(7.0) + 0.03, a, 7.0), 0.1, 0.1)
    # windows: the south one lit (the JS's old glow), the rest dark
    mill_window(b, P, 2, 5.0, 0.5, 0.62, P["warm"])
    mill_window(b, P, 4, 4.5, 0.46, 0.58, P["glass"])
    mill_window(b, P, 6, 3.6, 0.46, 0.58, P["glass"])
    mill_window(b, P, 6, 1.35, 0.5, 0.6, P["glass"])
    # the door in the base, south: planks, a frame, a granite lintel, strap hinges
    k, n = 2, (0, 0, 1)
    for i in range(5):
        u0 = -0.5 + i * 0.2
        facing(b, MP["door"] if i % 2 else P["wood_dk"], [on_face(k, u0 + 0.005, 0.0, 0.03), on_face(k, u0 + 0.195, 0.0, 0.03),
                                                            on_face(k, u0 + 0.195, 1.95, 0.03), on_face(k, u0 + 0.005, 1.95, 0.03)], n)
    for yy in (0.35, 1.55):
        b.bar(P["iron"], on_face(k, -0.5, yy, 0.05), on_face(k, 0.2, yy, 0.05), 0.04, 0.05)
    b.bar(P["wood_dk"], on_face(k, -0.45, 0.4, 0.045), on_face(k, 0.45, 1.5, 0.045), 0.08, 0.03)
    for u in (-0.56, 0.56):
        b.bar(P["trim"], on_face(k, u, 0.0, 0.05), on_face(k, u, 2.0, 0.05), 0.12, 0.08)
    b.box(P["granite"], 1.4, 0.2, 0.16, cx, 2.0, cz + mill_apo(2.0) + 0.06)
    b.cyl(P["brass"], 0.03, on_face(k, 0.38, 1.0, 0.04), on_face(k, 0.38, 1.0, 0.1), seg=8)
    # the curb, the ogee cap and its finial
    oct_shell(b, MP["cap"], 6.95, 7.12, 1.42, 1.42)
    oct_ring(b, MP["cap"], 6.95, 1.42, mill_apo(6.95), up=-1)
    lathe(b, MP["cap"], cx, cz, [(1.44, 0.0), (1.5, 0.1), (1.48, 0.2), (1.4, 0.42), (1.2, 0.78), (0.92, 1.08), (0.64, 1.3),
                                 (0.42, 1.46), (0.24, 1.6), (0.12, 1.72), (0.1, 1.82)], seg=16, y0=7.1)
    for r, y0 in ((1.51, 7.18), (1.45, 7.36)):
        ring(b, P["trim"], (cx, y0, cz), r, 0.025, seg=24, tseg=4)
    lathe(b, P["brass"], cx, cz, [(0.002, 0.0), (0.12, 0.06), (0.15, 0.15), (0.12, 0.24), (0.04, 0.3), (0.05, 0.42), (0.002, 0.5)], seg=12, y0=8.9)
    # the windshaft, out of the cap's front, tilted up to the hub
    f = (0.0, math.sin(TILT), math.cos(TILT))
    at = lambda s: (HUB[0] + f[0] * s, HUB[1] + f[1] * s, HUB[2] + f[2] * s)    # noqa: E731
    b.cyl(MP["shaft"], 0.17, at(-2.3), at(-0.28), seg=12)
    for s in (-1.1, -0.6):
        ring(b, P["iron"], at(s), 0.175, 0.025, seg=14, tseg=4, axis="z")
    # the fantail at the back: two struts, a frame, six vanes about a hub
    fh = (cx, 8.3, cz - 2.55)
    for sx in (-1, 1):
        b.bar(MP["shaft"], (cx + sx * 0.55, 7.25, cz - 1.25), (cx + sx * 0.12, fh[1] - 0.05, fh[2]), 0.07, 0.07)
        b.bar(MP["shaft"], (cx + sx * 0.5, 8.1, cz - 1.0), (cx + sx * 0.12, fh[1] + 0.05, fh[2]), 0.06, 0.06)
    b.cyl(P["iron"], 0.09, (fh[0], fh[1], fh[2] - 0.1), (fh[0], fh[1], fh[2] + 0.1), seg=10)
    for i in range(6):
        a = i * math.pi / 3 + 0.3
        d = (math.cos(a), math.sin(a))
        b.bar(P["trim"], (fh[0] + d[0] * 0.08, fh[1] + d[1] * 0.08, fh[2]), (fh[0] + d[0] * 0.78, fh[1] + d[1] * 0.78, fh[2]), 0.035, 0.035)
        e = (-d[1], d[0])
        pts = [(fh[0] + d[0] * r + e[0] * w, fh[1] + d[1] * r + e[1] * w, fh[2] + w * 0.6) for r, w in ((0.25, -0.08), (0.78, -0.13), (0.78, 0.13), (0.25, 0.08))]
        facing(b, MP["vane"], pts, (0, 0, 1))
        facing(b, MP["vane"], [(p[0], p[1], p[2] - 0.01) for p in pts], (0, 0, -1))
    R.end()

    # flour sacks stacked by the door, west of it
    R.begin(b, "east:mill-sacks", on="east:windmill")
    for i, (x, y, z, r) in enumerate(((26.55, 0.0, -19.62, 0.2), (27.15, 0.0, -19.6, -0.1), (26.85, 0.38, -19.6, 0.05),
                                      (26.5, 0.0, -19.25, 1.6))):
        b.lump(MP["flour"], 0.55, 0.42, 0.4, x, y, z, seed=60 + i, rnd=0.75, jitter=0.05, ry=r)
        c, s = math.cos(r), math.sin(r)
        b.cyl(P["twine"], 0.05, (x + c * 0.23, y + 0.28, z - s * 0.23), (x + c * 0.29, y + 0.33, z - s * 0.29), seg=6)
    # a dusting of flour where one has split
    b.lump(MP["flour"], 0.4, 0.03, 0.25, 27.35, 0.0, -19.25, seed=66, rnd=0.9, jitter=0.01, n=2)
    R.end()
    # crates by the door, east of it
    R.begin(b, "east:mill-crates", on="east:windmill")
    crate(b, P, 29.15, 0.0, -19.62, 0.72, 0.55, 0.62, 0.08, open_top=False)
    crate(b, P, 29.2, 0.55, -19.6, 0.66, 0.5, 0.58, -0.12, open_top=False)
    crate(b, P, 29.82, 0.0, -19.55, 0.5, 0.42, 0.5, 0.35, open_top=True)
    for i in range(3):
        b.lump(MP["flour"], 0.3, 0.14, 0.24, 29.82 + (i - 1) * 0.1, 0.36, -19.55 + (i % 2) * 0.06, seed=70 + i, rnd=0.7, jitter=0.02, n=2)
    R.end()
    # a millstone leant on the west face: its eye, the dressing's furrows
    R.begin(b, "east:millstone", on="east:windmill")
    al = 0.22
    ax, au = (math.cos(al), -math.sin(al), 0.0), (math.sin(al), math.cos(al), 0.0)
    C = (25.68, 0.6 * math.cos(al) + 0.03, -22.0)
    b.cyl(MP["millstone"], 0.6, (C[0] - ax[0] * 0.11, C[1] - ax[1] * 0.11, C[2]), (C[0] + ax[0] * 0.11, C[1] + ax[1] * 0.11, C[2]), seg=22)
    b.cyl(P["recess"], 0.1, (C[0] - ax[0] * 0.115, C[1] - ax[1] * 0.115, C[2]), (C[0] + ax[0] * 0.115, C[1] + ax[1] * 0.115, C[2]), seg=10)
    for i in range(10):
        a = i * math.pi / 5
        v = (au[0] * math.cos(a), au[1] * math.cos(a), math.sin(a))
        p0 = (C[0] - ax[0] * 0.112 + v[0] * 0.16, C[1] - ax[1] * 0.112 + v[1] * 0.16, C[2] + v[2] * 0.16)
        w = (au[0] * math.cos(a + 0.5), au[1] * math.cos(a + 0.5), math.sin(a + 0.5))
        p1 = (C[0] - ax[0] * 0.112 + w[0] * 0.56, C[1] - ax[1] * 0.112 + w[1] * 0.56, C[2] + w[2] * 0.56)
        b.bar(P["recess"], p0, p1, 0.03, 0.01)
    R.end()
    # a ladder up the east face, its foot in the grass
    R.begin(b, "east:mill-ladder", on="east:windmill")
    lz, foot, top = -21.62, (30.78, 0.0), (mill_apo(4.6) + cx + 0.06, 4.6)
    for s in (-0.21, 0.21):
        b.bar(MP["ladder"], (foot[0], foot[1], lz + s), (top[0], top[1], lz + s * 0.9), 0.06, 0.045)
    for i in range(1, 15):
        t = i / 15
        x, yy = foot[0] + (top[0] - foot[0]) * t, foot[1] + (top[1] - foot[1]) * t
        b.cyl(MP["ladder"], 0.018, (x, yy, lz - 0.21 + 0.02 * t), (x, yy, lz + 0.21 - 0.02 * t), seg=6)
    R.end()
    # the JS's hay bales (their colliders are its)
    hrnd = random.Random(78)
    for i, (x, z, ry) in enumerate(MILL_BALES):
        R.begin(b, f"east:mill-bale-{i}")
        bale(b, P, hrnd, x, z, 0.0, ry, 120 + i)
        R.end()
    b.finish("hg-windmill.glb")


def mill_palette():
    return {
        "board": mat("HG_MillBoard", 0xc9c2b2, 0.85),
        "board2": mat("HG_MillBoard2", 0xb3ab9a, 0.88),
        "board_dk": mat("HG_MillBoardDark", 0x3a3630, 0.9),
        "cap": mat("HG_MillCap", 0x2c2a30, 0.55, 0.15),
        "shaft": mat("HG_MillShaft", 0x4a3828, 0.8),
        "vane": mat("HG_MillVane", 0xd0c8b8, 0.8),
        "door": mat("HG_MillDoor", 0x5a3e2a, 0.8),
        "flour": mat("HG_FlourSack", 0xa89e88, 1.0),
        "millstone": mat("HG_Millstone", 0x8c8478, 0.95),
        "ladder": mat("HG_LadderWood", 0x7a6248, 0.85),
        "sailwood": mat("HG_SailWood", 0xb8b0a0, 0.85),
        "cloth": mat("HG_SailCloth", 0x9a8e74, 1.0),
    }


def build_sails(P, R):
    """The four sails about the hub (origin), in the plane z = 0, facing +z:
    the canister, two stocks through it, on each arm the sail bars between
    the hemlock and the trailing stile. Two carry their canvas, torn; two
    have it furled along the stock. The JS spins it about z."""
    b = HGBuilder()
    MP = mill_palette()
    rnd = random.Random(17)
    b.box(P["iron"], 0.44, 0.44, 0.6, 0.0, -0.22, 0.0)
    b.cyl(P["iron"], 0.16, (0.0, 0.0, 0.3), (0.0, 0.0, 0.42), seg=12)
    for i in range(4):
        a = i * math.pi / 2 + 0.2
        d, t = (math.cos(a), math.sin(a)), (-math.sin(a), math.cos(a))
        zs = 0.12 if i % 2 == 0 else -0.12
        p = lambda r, u, z=0.0: (d[0] * r + t[0] * u, d[1] * r + t[1] * u, zs + z)    # noqa: E731
        b.bar(MP["sailwood"], p(0.2, 0.0), p(4.9, 0.0), 0.15, 0.13)
        r0, r1, n = 1.0, 4.82, 11
        for u, w in ((-0.3, 0.06), (0.45, 0.04), (1.15, 0.06)):
            b.bar(MP["sailwood"], p(r0, u, 0.1), p(r1, u, 0.1), w, w)
        rs = [r0 + (r1 - r0) * k / n for k in range(n + 1)]
        for r in rs:
            b.bar(MP["sailwood"], p(r, -0.33, 0.1), p(r, 1.18, 0.1), 0.045, 0.045)
        if i % 2 == 0:
            # canvas between the bars, a panel or two torn away, one flapping
            for k in range(n):
                if rnd.random() < 0.22:
                    continue
                lo, hi = rs[k] + 0.03, rs[k + 1] - 0.03
                flap = 0.18 if rnd.random() < 0.15 else 0.0
                pts = [p(lo, 0.02, 0.06), p(lo, 1.12, 0.06), p(hi, 1.12, 0.06 + flap), p(hi, 0.02, 0.06 + flap)]
                facing(b, MP["cloth"], pts, (0, 0, 1))
                facing(b, MP["cloth"], [(q[0], q[1], q[2] - 0.008) for q in pts], (0, 0, -1))
        else:
            # furled: the canvas rolled along the stock, tied at three points
            b.cyl(MP["cloth"], 0.085, p(1.15, 0.12, 0.12), p(4.6, 0.12, 0.12), seg=8)
            for r in (1.6, 2.9, 4.2):
                ring(b, P["rope"], p(r, 0.12, 0.12), 0.09, 0.015, seg=8, tseg=3,
                     axis="x" if abs(d[0]) > 0.7 else "y")
    b.finish("hg-windmill-sails.glb")
    R.prop("east:windmill-sails", (HUB[0] - 4.95, HUB[1] - 4.95, HUB[2] - 0.3), (HUB[0] + 4.95, HUB[1] + 4.95, HUB[2] + 0.75), on="east:windmill")


# ------------------------------------------------------------------ the south road

HEARSE = (6.4, 18.2)                 # hollowgrin.js: nose north, its ghostBox 2.0 x 5.4 x 1.7
WAGON = (-14.5, 29.6)
SIGNPOST = (4.4, 28.6)
# the signpost's fingers: words, direction (x, z), height of the board's foot
FINGERS = [("fair", (1.0, 0.0), 2.2), ("chapel", (-1.0, 0.0), 1.92), ("manor", (0.0, -1.0), 1.64)]
MILESTONE = (-3.55, 19.0)
ROAD_BALES = [(-21.0, 28.6, 0.0, 0.0), (-21.0, 28.6, 0.75, 0.1), (9.5, 27.5, 0.0, math.pi / 2)]


def road_palette():
    return {
        "black": mat("HG_HearseBlack", 0x0d0d11, 0.22, 0.35),
        "chrome": mat("HG_Chrome", 0xc8ccd2, 0.18, 0.9),
        "tyre": mat("HG_Tyre", 0x141414, 0.9),
        "whitewall": mat("HG_Whitewall", 0xd8d4c8, 0.7),
        "landau": mat("HG_Landau", 0x1a1418, 0.85),
        "curtain": mat("HG_Curtain", 0x3a1a3c, 0.9),
        "tail": mat("HG_TailLight", 0x801010, 0.4, 0.0, 0x701010, 0.8),
        "coffin": mat("HG_CoffinWood", 0x7a4426, 0.35),
        "shed": mat("HG_ShedBoard", 0x5e584e, 0.92),
        "tin": mat("HG_RustTin", 0x6a4a36, 0.75, 0.35),
        "grass": mat("HG_VergeGrass", 0x45552a, 0.95),
        "grass2": mat("HG_VergeGrassDry", 0x7a6e40, 0.95),
        "post": mat("HG_PostWood", 0x4e4032, 0.85),
        "finger": mat("HG_FingerBoard", 0xd8ccb0, 0.8),
        "milestone": mat("HG_MilestoneStone", 0x8a8478, 0.95),
        "wallstone": mat("HG_FieldStone", 0x6a6660, 0.95),
        "wallstone2": mat("HG_FieldStone2", 0x55524c, 0.95),
    }


def hull(b, m, prof, x, half):
    """A body from its side profile [(z, y)], its half-width half(y) about x."""
    n = len(prof)
    pts = [(x - half(y), y, z) for z, y in prof] + [(x + half(y), y, z) for z, y in prof]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    return b.poly(m, pts, faces)


def arch(zc, yc, r, steps=8):
    """A wheel arch's points, rear foot to front foot, over the top."""
    return [(zc + r * math.cos(math.pi * k / steps), yc + r * math.sin(math.pi * k / steps)) for k in range(steps + 1)]


def hearse(b, P, RP, R):
    """A long black fifties hearse, nose north: fins, chrome, whitewalls,
    landau bars on its curtained flanks, the back hatch up and a coffin
    sliding out over the bumper."""
    hx, hz = HEARSE
    R.begin(b, "south:hearse")
    # the lower body (wheel arches cut) and the glasshouse over it
    body = [(-2.62, 0.3), (-2.7, 0.42), (-2.72, 0.72), (-2.6, 0.84), (-1.5, 0.93), (2.4, 0.96), (2.62, 1.08), (2.77, 1.07),
            (2.79, 0.8), (2.74, 0.42), (2.62, 0.3), (2.24, 0.3)]
    body += arch(1.76, 0.38, 0.47) + [(1.29, 0.3), (-1.29, 0.3)] + arch(-1.76, 0.38, 0.47) + [(-2.24, 0.3)]
    hull(b, RP["black"], [(hz + z, y) for z, y in body], hx, lambda y: 0.975 - max(0.0, 0.5 - y) * 0.12)
    cab = [(-1.5, 0.93), (-0.95, 1.6), (-0.8, 1.7), (2.45, 1.7), (2.62, 1.6), (2.62, 0.96)]
    cw = lambda y: 0.93 - (y - 0.95) * 0.12        # noqa: E731
    hull(b, RP["black"], [(hz + z, y) for z, y in cab], hx, cw)
    # glass: the windscreen, the front doors' windows
    wl = math.hypot(0.55, 0.67)
    nz, ny = -0.67 / wl * 0.012, 0.55 / wl * 0.012
    facing(b, P["glass"], [(hx - 0.78, 0.99 + ny, hz - 1.45 + nz), (hx + 0.78, 0.99 + ny, hz - 1.45 + nz),
                           (hx + 0.74, 1.56 + ny, hz - 0.99 + nz), (hx - 0.74, 1.56 + ny, hz - 0.99 + nz)], (0, 0.6, -0.8))
    for s in (-1, 1):
        sx = hx + s * (cw(1.3) + 0.006)
        facing(b, P["glass"], [(sx, 1.03, hz - 0.9), (sx, 1.03, hz + 0.32), (sx, 1.56, hz + 0.32), (sx, 1.56, hz - 0.72)], (s, 0, 0))
        # the flank behind: landau leather, the S-shaped landau iron, a curtained oval
        lx = hx + s * (cw(1.3) + 0.004)
        facing(b, RP["landau"], [(lx, 1.0, hz + 0.42), (lx, 1.0, hz + 2.56), (lx, 1.64, hz + 2.48), (lx, 1.64, hz + 0.42)], (s, 0, 0))
        facing(b, RP["curtain"], [(lx + s * 0.003, 1.18, hz + 0.65), (lx + s * 0.003, 1.18, hz + 1.25), (lx + s * 0.003, 1.48, hz + 1.25), (lx + s * 0.003, 1.48, hz + 0.65)], (s, 0, 0))
        ox = lx + s * 0.012
        S = [(1.55, 1.52), (1.75, 1.5), (1.88, 1.38), (1.95, 1.27), (2.05, 1.16), (2.25, 1.12), (2.42, 1.16)]
        for (z0, y0), (z1, y1) in zip(S, S[1:]):
            b.bar(RP["chrome"], (ox, y0, hz + z0), (ox, y1, hz + z1), 0.025, 0.035)
        # chrome: a belt strip, the door handle, the sill
        b.bar(RP["chrome"], (hx + s * 0.982, 0.82, hz - 2.4), (hx + s * 0.982, 0.86, hz + 2.6), 0.012, 0.025)
        b.box(RP["chrome"], 0.02, 0.025, 0.12, hx + s * 0.985, 0.88, hz + 0.25)
        # the wheels: tyre, whitewall, hub cap
        for wz in (-1.76, 1.76):
            b.cyl(RP["tyre"], 0.38, (hx + s * 0.7, 0.38, hz + wz), (hx + s * 0.95, 0.38, hz + wz), seg=18)
            ring(b, RP["whitewall"], (hx + s * 0.953, 0.38, hz + wz), 0.27, 0.035, seg=18, tseg=4, axis="x")
            b.cyl(RP["chrome"], 0.18, (hx + s * 0.95, 0.38, hz + wz), (hx + s * 0.975, 0.38, hz + wz), seg=14)
            b.cyl(RP["chrome"], 0.05, (hx + s * 0.975, 0.38, hz + wz), (hx + s * 1.0, 0.38, hz + wz), seg=8)
        # tail lights in the fins
        b.cyl(RP["tail"], 0.045, (hx + s * 0.9, 0.98, hz + 2.7), (hx + s * 0.9, 1.0, hz + 2.8), seg=8)
    # the nose: grille, bezels round the JS's lamps, bumpers, the ornament
    b.box(P["recess"], 1.1, 0.2, 0.03, hx, 0.47, hz - 2.735)
    for i in range(9):
        b.box(RP["chrome"], 0.025, 0.2, 0.04, hx - 0.48 + i * 0.12, 0.47, hz - 2.74)
    for s in (-1, 1):
        b.box(RP["chrome"], 0.36, 0.18, 0.025, hx + s * 0.7, 0.59, hz - 2.705)
    for zb, yb in ((-2.78, 0.3), (2.84, 0.32)):
        b.bar(RP["chrome"], (hx - 1.0, yb + 0.08, hz + zb), (hx + 1.0, yb + 0.08, hz + zb), 0.12, 0.15)
    b.bar(RP["chrome"], (hx, 0.86, hz - 2.5), (hx, 0.95, hz - 2.3), 0.03, 0.04)
    # the open back: dark inside, a chrome frame, the hatch up on its hinge
    facing(b, P["recess"], [(hx - 0.78, 0.97, hz + 2.625), (hx + 0.78, 0.97, hz + 2.625), (hx + 0.74, 1.6, hz + 2.625), (hx - 0.74, 1.6, hz + 2.625)], (0, 0, 1))
    for s in (-1, 1):
        b.bar(RP["chrome"], (hx + s * 0.8, 0.96, hz + 2.63), (hx + s * 0.76, 1.62, hz + 2.63), 0.04, 0.03)
    hinge, tip = (hx, 1.68, hz + 2.6), (hx, 2.0, hz + 3.26)
    b.bar(RP["black"], hinge, tip, 1.72, 0.045)
    b.bar(P["glass"], (hx, 1.72, hz + 2.75), (hx, 1.94, hz + 3.2), 1.3, 0.05)
    R.end()
    # the coffin, half out, tilted down over the bumper, its lid askew
    R.begin(b, "south:coffin", on="south:hearse")
    t = 0.2
    O = (hx, 1.06, hz + 2.3)
    V, W = (0.0, -math.sin(t), math.cos(t)), (0.0, math.cos(t), math.sin(t))
    L = lambda u, v, w: (O[0] + u, O[1] + V[1] * v + W[1] * w, O[2] + V[2] * v + W[2] * w)    # noqa: E731
    out = [(-0.2, -1.0), (0.2, -1.0), (0.3, 0.42), (0.24, 1.0), (-0.24, 1.0), (-0.3, 0.42)]
    n = len(out)

    def slab_(m, w0, w1, du=0.0, dv=0.0):
        pts = [L(u + du, v + dv, w0) for u, v in out] + [L(u + du, v + dv, w1) for u, v in out]
        fs = [list(range(n - 1, -1, -1)), list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
        b.poly(m, pts, fs)
    slab_(RP["coffin"], 0.0, 0.34)
    slab_(RP["coffin"], 0.345, 0.42, du=0.04, dv=0.08)
    for s in (-1, 1):
        for v in (-0.5, 0.1, 0.65):
            b.bar(P["brass"], L(s * 0.31, v - 0.12, 0.17), L(s * 0.31, v + 0.12, 0.17), 0.025, 0.03)
    b.bar(P["brass"], L(0.04, 0.3, 0.425), L(0.04, 0.62, 0.425), 0.03, 0.01)
    b.bar(P["brass"], L(-0.07, 0.46, 0.425), L(0.15, 0.46, 0.425), 0.03, 0.01)
    R.end()


def gate_pier(b, P, R, x, z, i):
    """A stone pier at the south gate (its solid 0.8 square, 2.4 tall; the
    JS's jack sits on its cap)."""
    R.begin(b, f"south:gate-{i}")
    rnd = random.Random(300 + i)
    y = 0.0
    while y < 2.1:
        h = min(rnd.uniform(0.26, 0.34), 2.1 - y)
        b.box(P["granite"] if rnd.random() < 0.7 else P["granite_dk"], 0.8, h - 0.012, 0.8, x, y, z)
        b.box(P["joint"], 0.79, 0.012, 0.79, x, y + h - 0.012, z)
        y += h
    b.box(P["granite_dk"], 0.96, 0.12, 0.96, x, 2.1, z)
    b.frustum(P["granite_dk"], 0.96, 0.96, 0.62, 0.62, 2.22, 2.4, x=x, z=z)
    R.end()


def toolshed(b, P, RP, R):
    """The toolshed in the south-west corner (its solid 4 x 3 x 2.6):
    weathered boards and battens, a rusted tin roof falling to the back, a
    braced door north, a window east, a scythe against the wall."""
    x0, x1, z0, z1, h = -29.0, -25.0, 24.5, 27.5, 2.6
    R.begin(b, "south:shed")
    fbox(b, RP["shed"], x0, x1, 0.0, h, z0, z1, "+x -x +z -z")
    for x in [x0 + 0.1 + k * 0.38 for k in range(11)]:
        for zz, s in ((z0, -1), (z1, 1)):
            b.box(RP["shed"], 0.06, h + (0.25 if zz == z0 else 0.0), 0.03, x, 0.0, zz + s * 0.015)
    for z in [z0 + 0.1 + k * 0.4 for k in range(8)]:
        for xx, s in ((x0, -1), (x1, 1)):
            b.box(RP["shed"], 0.03, h + 0.25 * (z1 - z) / (z1 - z0), 0.06, xx + s * 0.015, 0.0, z)
    # the roof, high at the door, falling south: corrugations as ribs
    y_n, y_s = h + 0.3, h - 0.05
    facing(b, RP["tin"], [(x0 - 0.2, y_n, z0 - 0.3), (x1 + 0.2, y_n, z0 - 0.3), (x1 + 0.2, y_s, z1 + 0.3), (x0 - 0.2, y_s, z1 + 0.3)], (0, 1, 0.1))
    facing(b, RP["tin"], [(x0 - 0.2, y_n - 0.03, z0 - 0.3), (x1 + 0.2, y_n - 0.03, z0 - 0.3), (x1 + 0.2, y_s - 0.03, z1 + 0.3), (x0 - 0.2, y_s - 0.03, z1 + 0.3)], (0, -1, -0.1))
    for k in range(17):
        x = x0 - 0.15 + k * 0.27
        b.bar(RP["tin"], (x, y_n + 0.015, z0 - 0.3), (x, y_s + 0.015, z1 + 0.3), 0.05, 0.03)
    # the gable infill over the walls under the roof's fall
    for xx, s in ((x0, -1), (x1, 1)):
        facing(b, RP["shed"], [(xx, h, z0), (xx, y_n - 0.03, z0), (xx, y_s - 0.03, z1), (xx, h, z1)], (s, 0, 0))
    facing(b, RP["shed"], [(x0, h, z0), (x1, h, z0), (x1, y_n - 0.03, z0), (x0, y_n - 0.03, z0)], (0, 0, -1))
    # the door: planks, a Z brace, hinges, a latch
    dx = -27.0
    for i in range(5):
        b.box(P["wood_dk"] if i % 2 else RP["post"], 0.21, 2.0, 0.04, dx - 0.44 + i * 0.22, 0.0, z0 - 0.05)
    for yy in (0.25, 1.75):
        b.box(RP["post"], 1.1, 0.14, 0.04, dx, yy, z0 - 0.09)
    b.bar(RP["post"], (dx - 0.45, 0.4, z0 - 0.09), (dx + 0.45, 1.72, z0 - 0.09), 0.12, 0.035)
    for yy in (0.3, 1.8):
        b.box(P["iron"], 0.35, 0.05, 0.015, dx - 0.4, yy, z0 - 0.11)
    b.box(P["iron"], 0.04, 0.12, 0.04, dx + 0.42, 1.0, z0 - 0.11)
    # a window east, dark, four panes
    wz = 26.0
    facing(b, P["glass"], [(x1 + 0.03, 1.2, wz - 0.35), (x1 + 0.03, 1.2, wz + 0.35), (x1 + 0.03, 1.8, wz + 0.35), (x1 + 0.03, 1.8, wz - 0.35)], (1, 0, 0))
    for zz in (wz - 0.39, wz + 0.39):
        b.box(P["trim"], 0.06, 0.74, 0.07, x1 + 0.05, 1.13, zz)
    for yy in (1.13, 1.8):
        b.box(P["trim"], 0.06, 0.07, 0.85, x1 + 0.05, yy, wz)
    b.box(P["trim"], 0.04, 0.6, 0.03, x1 + 0.045, 1.2, wz)
    b.box(P["trim"], 0.04, 0.03, 0.7, x1 + 0.045, 1.49, wz)
    R.end()
    # a scythe against the east wall, north of the window
    R.begin(b, "south:shed-scythe", on="south:shed")
    sx, sz = x1 + 0.12, 25.0
    b.cyl(P["handle"], 0.022, (sx + 0.25, 0.0, sz), (sx, 1.75, sz - 0.08), seg=6)
    for yy in (0.75, 1.2):
        b.cyl(P["handle"], 0.016, (sx + 0.25 - 0.25 * yy / 1.75, yy, sz - 0.08 * yy / 1.75), (sx + 0.3 - 0.25 * yy / 1.75, yy + 0.02, sz - 0.08 * yy / 1.75 + 0.14), seg=5)
    blade = [(sx + 0.02, 1.72, sz - 0.08), (sx + 0.06, 1.78, sz + 0.25), (sx + 0.08, 1.66, sz + 0.62), (sx + 0.05, 1.7, sz + 0.25)]
    facing(b, P["tool"], blade, (1, 0, 0))
    facing(b, P["tool"], [(p[0] - 0.01, p[1], p[2]) for p in blade], (-1, 0, 0))
    R.end()


def hay_wagon(b, P, RP, R):
    """A hay wagon (its ghostBox 3.6 x 2.0 x 2.0), shafts west and down:
    the bed on two beams, flared hay ladders, a heaped load, four spoked
    wheels (the front pair smaller)."""
    cx, cz = WAGON
    R.begin(b, "south:wagon")
    W, Wd = P["wood"], P["wood_dk"]
    for dz in (-0.5, 0.5):
        box2(b, Wd, cx - 1.6, cx + 1.6, 0.68, 0.82, cz + dz - 0.07, cz + dz + 0.07)
    z = cz - 0.75
    while z < cz + 0.74:
        box2(b, W, cx - 1.65, cx + 1.65, 0.82, 0.88, z + 0.005, z + 0.145)
        z += 0.15
    for s in (-1, 1):
        b.bar(Wd, (cx - 1.65, 0.95, cz + s * 0.78), (cx + 1.65, 0.95, cz + s * 0.78), 0.07, 0.07)
        b.bar(Wd, (cx - 1.65, 1.68, cz + s * 0.98), (cx + 1.65, 1.68, cz + s * 0.98), 0.07, 0.07)
        for k in range(12):
            x = cx - 1.6 + k * 0.29
            b.bar(W, (x, 0.88, cz + s * 0.76), (x, 1.7, cz + s * 0.99), 0.045, 0.045)
        # the end ladders, taller
        ex = cx + s * 1.68
        for zz in (-0.75, -0.25, 0.25, 0.75):
            b.bar(W, (ex, 0.85, cz + zz), (ex + s * 0.08, 2.05, cz + zz * 1.15), 0.05, 0.05)
        b.bar(Wd, (ex + s * 0.08, 2.0, cz - 0.95), (ex + s * 0.08, 2.0, cz + 0.95), 0.06, 0.06)
    # the load: a heaped mound, wisps over the rails
    b.lump(P["hay"], 3.2, 0.95, 1.85, cx, 0.88, cz, seed=211, rnd=0.35, jitter=0.06, flat_base=True)
    for i, (dx, dz, w) in enumerate(((-0.8, -0.2, 1.4), (0.6, 0.25, 1.5), (0.0, 0.0, 1.2))):
        b.lump(P["hay"], w, 0.42, 1.0, cx + dx, 1.62, cz + dz, seed=212 + i, rnd=0.6, jitter=0.06, flat_base=False)
    rnd = random.Random(213)
    for k in range(26):
        x = cx + rnd.uniform(-1.5, 1.5)
        s = rnd.choice((-1, 1))
        y0 = rnd.uniform(1.25, 1.65)
        p0, p1 = (x, y0, cz + s * 0.94), (x + rnd.uniform(-0.12, 0.12), y0 - rnd.uniform(0.15, 0.3), cz + s * 1.02)
        facing(b, P["hay_dk"] if k % 2 else P["hay"], [(p0[0] - 0.012, p0[1], p0[2]), (p0[0] + 0.012, p0[1], p0[2]), (p1[0] + 0.012, p1[1], p1[2]), (p1[0] - 0.012, p1[1], p1[2])], (0, 0, s))
    # the wheels: rear big, front small, on iron axles
    for wx, r in ((cx + 1.1, 0.55), (cx - 1.1, 0.42)):
        b.cyl(P["iron"], 0.04, (wx, r, cz - 0.98), (wx, r, cz + 0.98), seg=6)
        for s in (-1, 1):
            c = (wx, r, cz + s * 0.9)
            ring(b, P["iron"], c, r, 0.035, seg=22, tseg=4, axis="z")
            ring(b, Wd, c, r - 0.05, 0.04, seg=20, tseg=4, axis="z")
            b.cyl(Wd, 0.1, (wx, r, c[2] - 0.08), (wx, r, c[2] + 0.08), seg=10)
            for k in range(10):
                a = k / 10 * 2 * math.pi
                b.cyl(W, 0.018, (wx + math.cos(a) * 0.09, r + math.sin(a) * 0.09, c[2]), (wx + math.cos(a) * (r - 0.07), r + math.sin(a) * (r - 0.07), c[2]), seg=4)
    # the shafts, down in the grass to the west, a swingletree
    for dz in (-0.32, 0.32):
        b.cyl(Wd, 0.04, (cx - 1.5, 0.55, cz + dz), (cx - 3.25, 0.07, cz + dz * 1.5), seg=6)
    b.cyl(Wd, 0.035, (cx - 1.85, 0.45, cz - 0.5), (cx - 1.85, 0.45, cz + 0.5), seg=6)
    R.end()


def signpost(b, P, RP, R):
    """A fingerpost where the road meets the lane: a post, a cap, three
    pointed boards (the fair east, the chapel west, the manor north) that
    the JS letters (SIGNPOST_FINGERS)."""
    x, z = SIGNPOST
    R.begin(b, "south:signpost")
    b.box(RP["post"], 0.13, 2.62, 0.13, x, 0.0, z)
    b.frustum(RP["post"], 0.2, 0.2, 0.02, 0.02, 2.62, 2.8, x=x, z=z)
    b.box(RP["post"], 0.17, 0.05, 0.17, x, 2.6, z)
    for name, (dx, dz), y in FINGERS:
        # the board: its own profile (a point at the far end), 0.045 thick
        prof = [(0.07, 0.0), (1.05, 0.0), (1.2, 0.11), (1.05, 0.22), (0.07, 0.22)]
        nx, nz = -dz, dx
        pts = [(x + dx * r + nx * s * 0.0225, y + v, z + dz * r + nz * s * 0.0225) for s in (-1, 1) for r, v in prof]
        k = len(prof)
        b.poly(RP["finger"], pts, [list(range(k)), list(range(2 * k - 1, k - 1, -1))] + [[i, (i + 1) % k, k + (i + 1) % k, k + i] for i in range(k)])
        b.bar(RP["post"], (x + dx * 0.08, y + 0.11, z + dz * 0.08), (x + dx * 0.02, y + 0.11, z + dz * 0.02), 0.06, 0.24)
    R.end()


def milestone(b, P, RP, R):
    """A milestone on the west verge, its face to the road (the JS letters
    it): a round-headed stone, a little sunk and leaning."""
    x, z = MILESTONE
    R.begin(b, "south:milestone")
    prof = [(-0.2, 0.0), (0.2, 0.0), (0.2, 0.52)] + [(0.2 * math.cos(a), 0.52 + 0.2 * math.sin(a)) for a in [math.pi * k / 8 for k in range(1, 8)]] + [(-0.2, 0.52)]
    k = len(prof)
    pts = [(x + s * 0.11, v, z + u) for s in (-1, 1) for u, v in prof]
    b.poly(RP["milestone"], pts, [list(range(k)), list(range(2 * k - 1, k - 1, -1))] + [[i, (i + 1) % k, k + (i + 1) % k, k + i] for i in range(k)])
    b.lump(P["moss"], 0.3, 0.06, 0.5, x, 0.0, z, seed=330, rnd=0.8, jitter=0.02, n=2)
    R.end()


def verges(b, P, RP):
    """Grass tufts and a few stones along the road's edges, clear of the
    JS's jack-o'-lanterns (x +-2.6) and the lamps. Flat: no props."""
    rnd = random.Random(340)
    jacks = [(-2.6, z) for z in (13, 17, 21, 25, 29)] + [(2.6, z + 1.5) for z in (13, 17, 21, 25, 29)] + [(3.2, 15.5), (3.2, 24.5), MILESTONE]
    for s in (-1, 1):
        z = 12.4
        while z < 30.4:
            z += rnd.uniform(0.5, 1.1)
            x = s * rnd.uniform(2.15, 2.4)
            if s < 0 and 20.6 < z < 27.9:          # the candy shop stands over the road's west edge
                continue
            if any(abs(x - jx) < 0.55 and abs(z - jz) < 0.55 for jx, jz in jacks):
                continue
            if rnd.random() < 0.15:
                b.lump(RP["wallstone"], rnd.uniform(0.12, 0.22), 0.08, rnd.uniform(0.1, 0.18), x, 0.0, z, seed=int(z * 10), rnd=0.8, jitter=0.02, n=2)
                continue
            for k in range(7):
                a = rnd.uniform(0, 2 * math.pi)
                ln = rnd.uniform(0.18, 0.34)
                lean = rnd.uniform(0.15, 0.5)
                p0 = (x + math.cos(a) * 0.04, 0.0, z + math.sin(a) * 0.04)
                p1 = (p0[0] + math.cos(a) * ln * lean, ln, p0[2] + math.sin(a) * ln * lean)
                e = (-math.sin(a) * 0.02, math.cos(a) * 0.02)
                m = RP["grass2"] if rnd.random() < 0.4 else RP["grass"]
                pts = [(p0[0] - e[0], 0.0, p0[2] - e[1]), (p0[0] + e[0], 0.0, p0[2] + e[1]), (p1[0], p1[1], p1[2])]
                n = (math.cos(a + math.pi / 2), 0.0, math.sin(a + math.pi / 2))
                for want in (n, (-n[0], 0.0, -n[2])):
                    vs = [b.bm.verts.new(p) for p in pts]
                    f = b.bm.faces.new(vs)
                    f.material_index = b._mi(m)
                    nn = f.normal
                    if nn.x * want[0] + nn.z * want[2] < 0:
                        f.normal_flip()


def build_road(P, R):
    """The south road (phase 3): the hearse and its coffin, the gate's piers,
    the low dry-stone walls, the toolshed, two gas lamps, the hay wagon, a
    fingerpost and a milestone, tufts along the verges, the JS's hay bales.
    hollowgrin.js keeps the colliders (SOUTH_PROPS for the new pieces), the
    jack-o'-lanterns, the lamps' glass and the words."""
    from hg_west import drystone
    b = HGBuilder()
    RP = road_palette()
    P = {**P, **RP}
    hearse(b, P, RP, R)
    for i, gx in enumerate((-3.0, 3.0)):
        gate_pier(b, P, R, gx, 31.2, i)
    drystone(b, P, R, "south:wall-w", -18.0, 21.5, 26.5, h=1.0, t=0.7, seed=351)
    drystone(b, P, R, "south:wall-e", 13.4, 21.6, 25.6, h=1.0, t=0.7, seed=352)
    toolshed(b, P, RP, R)
    for i, (x, z) in enumerate(((3.2, 15.5), (3.2, 24.5))):
        gas_lamp(b, P, R, x, z, i, area="south")
    hay_wagon(b, P, RP, R)
    signpost(b, P, RP, R)
    milestone(b, P, RP, R)
    hrnd = random.Random(79)
    for i, (x, z, y, ry) in enumerate(ROAD_BALES):
        R.begin(b, f"south:bale-{i}", on="south:bale-0" if y > 0 else None)
        bale(b, P, hrnd, x, z, y, ry, 140 + i)
        R.end()
    verges(b, P, RP)
    for face in SOUTH_FACES:
        R.face(*face)
    b.finish("hg-southroad.glb")


def _finger_faces():
    out = []
    x, z = SIGNPOST
    for name, (dx, dz), y in FINGERS:
        nx, nz = -dz, dx
        c = (x + dx * 0.56, y + 0.11, z + dz * 0.56)
        for s in (-1, 1):
            out.append((f"sign:finger-{name}-{'ab'[s > 0]}", "south:signpost", (c[0] + nx * s * 0.026, c[1], c[2] + nz * s * 0.026), (nx * s, 0, nz * s), 0.9, 0.16))
    return out


# The words the JS paints on the fingerpost and the milestone (rule 9).
SOUTH_FACES = _finger_faces() + [
    ("sign:milestone", "south:milestone", (MILESTONE[0] + 0.115, 0.5, MILESTONE[1]), (1, 0, 0), 0.32, 0.24),
]
