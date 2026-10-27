"""
Hollowgrin's village (phase 1: the square half; phase 3 adds the candy shop,
the barn, the windmill and the south road). hg-square.glb, in map
coordinates: the well, the pumpkin market (the stall, crates, baskets, the
scale, the chalk board's frame, the notice board), the hand cart, the hay,
the four gas lamps, the bunting round the square, and the dead oak with its
rope swing.

Drawn over the colliders maps/hollowgrin.js lays (hollowgrin-layout.json).
The JS keeps the jack-o'-lanterns, the lamp glass and lights, the well's
water, the setts and the words (the chalk board and the notices are canvas
textures it hangs on the frames drawn here).
"""
import math
import random

from map_kit import mat
from hg_kit import HGBuilder, facing, lathe, pumpkin, ring, slates

WELL = (-8.0, 6.0)
STALL = (8.0, -4.3)
CART = (8.8, 9.2)
OAK = (0.0, 1.0)
LAMPS = [(-11.0, -8.0), (11.0, 10.5), (-11.0, 11.0), (11.0, -8.5)]
# hollowgrin.js hayBale() calls in the square: x, z, y, ry
BALES = [(-6.5, -5.0, 0.0, 0.0), (-6.5, -5.0, 0.75, 0.05), (-5.2, -5.2, 0.0, math.pi / 2), (5.5, 8.6, 0.0, 0.0),
         (-3.8, 12.5, 0.0, math.pi / 2), (-3.8, 13.8, 0.0, math.pi / 2), (12.2, -3.6, 0.0, 0.0), (12.2, -3.6, 0.75, -0.08)]
# the swing's branch: from the trunk out over the square's south-east
SWING_BRANCH = ((0.0, 4.3, 1.0), (3.1, 5.0, 2.55))


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
        "bark": mat("HG_OakBark", 0x2e2620, 0.95),
        "bark_lt": mat("HG_OakBarkLight", 0x3e342c, 0.95),
        "dirt": mat("HG_RootDirt", 0x3a2e24, 1.0),
        "cork": mat("HG_Cork", 0x7a5a3a, 0.9),
        "paper": mat("HG_NoticePaper", 0xc8bfa4, 0.9),
        "slate": mat("HG_ChalkSlate", 0x1c1f1c, 0.8),
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


def hay(b, P, R):
    rnd = random.Random(77)
    for i, (x, z, y, ry) in enumerate(BALES):
        # stacked, or end to end with the one before (4 and 5)
        R.begin(b, f"square:bale-{i}", on=f"square:bale-{i - 1}" if y > 0 or i == 5 else None)
        w, h, d = 1.3, 0.75, 0.85
        b.lump(P["hay"], w, h, d, x, y, z, ry=ry, seed=i + 90, rnd=0.12, jitter=0.025)
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
        R.end()
        # loose straw on the ground round the bottom bales (flat: no prop)
        if y == 0:
            for k in range(6):
                a = rnd.uniform(0, 2 * math.pi)
                r = rnd.uniform(0.75, 1.05)
                b.box(P["hay"], rnd.uniform(0.15, 0.35), 0.008, 0.012, x + math.cos(a) * r, 0.0, z + math.sin(a) * r, ry=rnd.uniform(0, 3.1))


def gas_lamp(b, P, R, x, z, i):
    R.begin(b, f"square:lamp-{i}")
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

def branch(b, P, p0, d, length, r0, depth, rnd, out):
    """A crooked limb from p0 along d: three bends, tapering, splitting into
    two or three at its end until `depth` runs out."""
    segs = 3
    p = list(p0)
    r = r0
    for k in range(segs):
        L = length / segs
        dx, dy, dz = d
        q = [p[0] + dx * L, p[1] + dy * L, p[2] + dz * L]
        r1 = r * 0.82
        b.cyl(P["bark"] if depth % 2 else P["bark_lt"], r, tuple(p), tuple(q), seg=7 if r > 0.08 else 5, r2=r1)
        # bend
        nd = [dx + rnd.uniform(-0.35, 0.35), dy + rnd.uniform(-0.25, 0.3), dz + rnd.uniform(-0.35, 0.35)]
        n = math.sqrt(sum(c * c for c in nd))
        d = [c / n for c in nd]
        p, r = q, r1
    out.append((tuple(p), r))
    if depth == 0 or r < 0.025:
        return
    kids = 2 if rnd.random() < 0.6 else 3
    for i in range(kids):
        a = rnd.uniform(0, 2 * math.pi)
        spread = rnd.uniform(0.45, 0.8)
        nd = [d[0] + math.cos(a) * spread, d[1] + rnd.uniform(-0.1, 0.25), d[2] + math.sin(a) * spread]
        n = math.sqrt(sum(c * c for c in nd))
        branch(b, P, p, [c / n for c in nd], length * rnd.uniform(0.55, 0.75), r * rnd.uniform(0.6, 0.8), depth - 1, rnd, out)


def oak(b, P, R):
    ox, oz = OAK
    rnd = random.Random(1234)
    R.begin(b, "square:oak")
    # the trunk (collider 1.4 square, 6 tall), leaning, splitting at 4.6 m
    pts = [(ox, 0.0, oz), (ox + 0.08, 1.4, oz - 0.05), (ox + 0.05, 2.8, oz + 0.06), (ox - 0.1, 4.0, oz + 0.02), (ox - 0.15, 4.7, oz)]
    radii = [0.66, 0.55, 0.5, 0.46, 0.42]
    for (p, r0), (q, r1) in zip(zip(pts, radii), zip(pts[1:], radii[1:])):
        b.cyl(P["bark"], r0, p, q, seg=10, r2=r1)
    # buttress roots, between the jack-o'-lanterns round it
    for i in range(6):
        a = (i + 0.5) / 6 * 2 * math.pi + 0.3
        ca, sa = math.cos(a), math.sin(a)
        b.cyl(P["bark_lt"], 0.24, (ox + ca * 0.3, 0.55, oz + sa * 0.3), (ox + ca * 1.3, -0.05, oz + sa * 1.3), seg=6, r2=0.06)
    b.lump(P["dirt"], 3.0, 0.08, 3.0, ox, -0.02, oz, seed=7, rnd=0.9, jitter=0.02)
    # a knot hole, half way up the south side
    b.lump(P["soot"] if "soot" in P else P["bark"], 0.22, 0.32, 0.1, ox + 0.05, 2.2, oz + 0.47, seed=2, rnd=0.8, jitter=0.01)
    tips = []
    top = pts[-1]
    R.end()
    # the crown, its own prop (its bounds start at the fork)
    R.begin(b, "square:oak-crown", on="square:oak")
    for i in range(4):
        a = i / 4 * 2 * math.pi + 0.9
        d = [math.cos(a) * 0.65, 0.75, math.sin(a) * 0.65]
        n = math.sqrt(sum(c * c for c in d))
        branch(b, P, top, [c / n for c in d], 3.6, 0.3, 3, rnd, tips)
    branch(b, P, (ox - 0.1, 5.6, oz), [0.1, 1.0, -0.1], 3.2, 0.26, 3, rnd, tips)
    (a0, b0) = SWING_BRANCH
    v = [b0[k] - a0[k] for k in range(3)]
    L = math.sqrt(sum(c * c for c in v))
    b.cyl(P["bark"], 0.24, a0, b0, seg=8, r2=0.11)
    branch(b, P, b0, [c / L for c in v], 1.6, 0.11, 2, rnd, tips)
    R.end()
    # the rope swing: two ropes off the limb, a plank
    R.begin(b, "square:swing", on="square:oak-crown")
    pa = [a0[k] + v[k] * 0.62 for k in range(3)]
    pb = [a0[k] + v[k] * 0.82 for k in range(3)]
    for p in (pa, pb):
        b.cyl(P["rope"], 0.018, (p[0], p[1] - 0.2, p[2]), (p[0], 1.08, p[2]), seg=5)
        ring(b, P["rope"], (p[0], p[1] - 0.04, p[2]), 0.12, 0.02, seg=8, tseg=4, axis="x")
    mx, mz = (pa[0] + pb[0]) / 2, (pa[2] + pb[2]) / 2
    ry = -math.atan2(pb[2] - pa[2], pb[0] - pa[0])
    b.box(P["wood_grey"], math.hypot(pb[0] - pa[0], pb[2] - pa[2]) + 0.2, 0.05, 0.26, mx, 1.03, mz, ry=ry)
    R.end()


def build_square(P, R):
    b = HGBuilder()
    well(b, P, R)
    stall(b, P, R)
    cart(b, P, R)
    hay(b, P, R)
    for i, (x, z) in enumerate(LAMPS):
        gas_lamp(b, P, R, x, z, i)
    oak(b, P, R)
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
