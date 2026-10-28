"""
Hollowgrin's east fields (phase 3): the corn and the pumpkin patch,
hg-fields.glb, in map coordinates. The corn rows on their ridges, the split
rail fence north of them, the pumpkins in five kinds on their vines (the
JS's own random stream, so the carved ones it lights fall in the same
places), the two uncarved giants, the bonfire's stone ring and log
teepee, its four hay bales, and a wheelbarrow of pumpkins. The scarecrow is
Studio's (generate_mesh, the doc's hero pick), kept as it came at
studio/hollowgrin/scarecrow.glb and given the bake's UV set here as
hg-scarecrow.glb.

hollowgrin.js keeps the colliders, the carved jack-o'-lanterns (the big
giant among them), the bonfire's flames, embers and light.
"""
import math
import os
import random

from map_kit import mat
from hg_kit import HGBuilder, facing, js_rng, pumpkin, ring
from hg_village import bale
from hg_village import palette as village_palette

SCARECROW = (26.0, 8.0)                    # hollowgrin.js: the post's solid, 0.25 square
SCARECROW_SOURCE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "studio", "hollowgrin", "scarecrow.glb")
# hollowgrin.js's corn: x, then the z spans of each row's stretches
ROWS = [(22.0, [(-9.5, -4.8), (-2.8, 3.0)]), (25.0, [(-7.5, 3.0)]), (28.0, [(-9.5, -1.2), (0.8, 3.0)]),
        (31.0, [(-9.5, -5.5), (-3.5, 3.0)])]
FENCE_Z = -12.5
FENCE = [(15.0, 20.5), (23.0, 29.5), (32.0, 36.0)]
GIANTS = [(20.0, 7.5, 0.95), (30.5, 11.0, 1.15), (25.0, 16.0, 0.9)]    # the middle one is the JS's, carved
BONFIRE = (17.8, 12.8)
BONFIRE_BALES = [(-2.6, 0.0, math.pi / 2), (2.6, 0.2, math.pi / 2), (0.0, 2.7, 0.0), (0.3, -2.6, 0.0)]
BARROW = (33.2, 7.0, math.pi / 2 + 0.25)   # hollowgrin.js FIELD_PROPS: 1.0 x 1.7 x 0.8
FARMER = (23.5, 6.3)                       # hollowgrin-mannequins.js's farmer
# the JS's patch loop keeps clear of these (x, z, r)
AVOID = [(BONFIRE[0], BONFIRE[1], 3.4), (SCARECROW[0], SCARECROW[1], 1.2), (FARMER[0], FARMER[1], 0.8),
         (BARROW[0], BARROW[1], 1.4)] + [(x, z, r + 0.8) for x, z, r in GIANTS]


def palette():
    return {
        **village_palette(),
        "stalk": mat("HG_CornStalk", 0x8e7a4c, 0.95),
        "cleaf": mat("HG_CornLeaf", 0xa8925e, 0.95),
        "cleaf_dk": mat("HG_CornLeafDark", 0x76643c, 0.95),
        "cleaf_gr": mat("HG_CornLeafGreen", 0x6e7040, 0.95),
        "tassel": mat("HG_CornTassel", 0xc4a870, 1.0),
        "husk": mat("HG_CornHusk", 0xc2ad78, 0.95),
        "kernel": mat("HG_CornKernel", 0xc8962e, 0.7),
        "soil": mat("HG_FieldSoil", 0x3a2c22, 1.0),
        "soil_dk": mat("HG_FieldSoilDark", 0x2a2018, 1.0),
        "vine": mat("HG_Vine", 0x5a6e30, 0.9),
        "pleaf": mat("HG_PumpkinLeaf", 0x5a6a30, 0.9),
        "pleaf_dry": mat("HG_PumpkinLeafDry", 0x847a3e, 0.95),
        "rail": mat("HG_FenceRail", 0x6e665a, 0.9),
        "rail_dk": mat("HG_FenceRailDark", 0x4e473e, 0.9),
        # yellower than the market's: the purple haze over the patch turns a red orange pink
        "pkf1": mat("HG_PatchPumpkin1", 0xf28e12, 0.6),
        "pkf2": mat("HG_PatchPumpkin2", 0xf8a41c, 0.6),
        "pkf3": mat("HG_PatchPumpkin3", 0xe8800e, 0.6),
        "cinder": mat("HG_PumpkinCinderella", 0xe47012, 0.6),
        "jarrah": mat("HG_PumpkinJarrahdale", 0x7c8a86, 0.65),
        "giant": mat("HG_PumpkinGiant", 0xd8823a, 0.6),
        "fstone": mat("HG_FireStone", 0x5c5850, 0.9),
        "char": mat("HG_Char", 0x1c1612, 0.95),
        "logend": mat("HG_LogEnd", 0xa08460, 0.85),
        "bark": mat("HG_LogBark", 0x3e3024, 0.95),
        "barrow": mat("HG_BarrowWood", 0x7a5c3c, 0.85),
    }


def flat(b, m, w, d, x, y, z, ry):
    """A straw or a fallen leaf: one quad lying on the ground."""
    c, s = math.cos(ry), math.sin(ry)
    pts = [(x + c * u + s * v, y, z - s * u + c * v) for u, v in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]
    facing(b, m, pts, (0.0, 1.0, 0.0))


# ------------------------------------------------------------------ the corn

def leaf(b, m, x, y, z, ang, L, w, rise, droop, twist=0.0):
    """A corn leaf: a ribbon out from the stalk that rises, then droops."""
    ca, sa = math.cos(ang), math.sin(ang)
    pts = []
    n = 3
    for k in range(n + 1):
        t = k / n
        d = L * t * (1 - 0.15 * t)
        h = y + L * (rise * t - droop * t * t)
        hw = w * (1 - t) ** 0.8 * (0.6 + 0.4 * math.sin(math.pi * min(1.0, t * 1.6)))
        # the ribbon's width turns from flat to edge-up along it
        tw = twist * t
        nx, nz = -sa, ca
        pts.append((x + ca * d + nx * hw * math.cos(tw), h + hw * math.sin(tw), z + sa * d + nz * hw * math.cos(tw)))
        pts.append((x + ca * d - nx * hw * math.cos(tw), h - hw * math.sin(tw), z + sa * d - nz * hw * math.cos(tw)))
    faces = [[2 * k, 2 * k + 1, 2 * k + 3, 2 * k + 2] for k in range(n - 1)] + [[2 * (n - 1), 2 * (n - 1) + 1, 2 * n]]
    b.poly(m, pts[:2 * n + 1], faces)


def stalk(b, P, x, z, h, rnd):
    lean = (rnd.uniform(-0.08, 0.08), rnd.uniform(-0.08, 0.08))
    top = (x + lean[0], h, z + lean[1])
    b.cyl(P["stalk"], 0.026, (x, 0.0, z), top, seg=3, r2=0.01, caps=False)
    ang = rnd.uniform(0, 2 * math.pi)
    nl = 5
    for k in range(nl):
        f = 0.18 + 0.68 * k / (nl - 1)
        ang += math.pi + rnd.uniform(-0.5, 0.5)
        dry = rnd.random()
        m = P["cleaf_dk"] if dry < 0.35 else P["cleaf_gr"] if dry > 0.88 else P["cleaf"]
        L = rnd.uniform(0.85, 1.1) * (1.1 - 0.35 * f)
        leaf(b, m, x + lean[0] * f, h * f, z + lean[1] * f, ang, L, rnd.uniform(0.07, 0.09),
             rise=rnd.uniform(0.45, 0.8), droop=rnd.uniform(0.8, 1.4), twist=rnd.uniform(-0.6, 0.6))
    # the tassel: three strands off the top
    for k in range(2):
        a = ang + k * 3.1
        tip = (top[0] + math.cos(a) * 0.14, h + 0.18 - k * 0.03, top[2] + math.sin(a) * 0.14)
        b.poly(P["tassel"], [(top[0] - 0.012, h - 0.04, top[2]), (top[0] + 0.012, h - 0.04, top[2]), tip], [[0, 1, 2]])
    # an ear on some, angled out from the stalk in its husk, the husk split
    if rnd.random() < 0.35:
        y = h * rnd.uniform(0.42, 0.55)
        a = rnd.uniform(0, 2 * math.pi)
        p0 = (x + lean[0] * 0.45, y, z + lean[1] * 0.45)
        p1 = (p0[0] + math.cos(a) * 0.12, y + 0.22, p0[2] + math.sin(a) * 0.12)
        b.cyl(P["husk"], 0.045, p0, p1, seg=4, r2=0.02, caps=False)
        if rnd.random() < 0.5:
            b.cyl(P["kernel"], 0.03, (p1[0], p1[1] - 0.04, p1[2]), (p1[0] + math.cos(a) * 0.04, p1[1] + 0.06, p1[2] + math.sin(a) * 0.04), seg=4, r2=0.018, caps=False)


def ridge(b, P, x, z0, z1):
    """The row's ridge of earth, low and rounded, its ends sloped."""
    prof = [(x - 0.75, 0.0), (x - 0.45, 0.1), (x - 0.15, 0.14), (x + 0.15, 0.14), (x + 0.45, 0.1), (x + 0.75, 0.0)]
    pts, faces = [], []
    zs = [z0 - 0.1, z0 + 0.2, z1 - 0.2, z1 + 0.1]
    for i, zz in enumerate(zs):
        k = 0.15 if i in (0, 3) else 1.0
        pts += [(u, v * k, zz) for u, v in prof]
    n = len(prof)
    for i in range(3):
        for j in range(n - 1):
            a = i * n + j
            faces.append([a, a + n, a + n + 1, a + 1])
    b.poly(P["soil"], pts, faces)


def corn(b, P, R):
    rnd = random.Random(808)
    for x, segs in ROWS:
        for k, (a, z1) in enumerate(segs):
            R.begin(b, f"east:corn-{int(x)}-{k}")
            ridge(b, P, x, a, z1)
            z = a + 0.25
            while z < z1 - 0.1:
                for dx in (-0.3, 0.3):
                    stalk(b, P, x + dx + rnd.uniform(-0.1, 0.1), z + rnd.uniform(-0.12, 0.12), rnd.uniform(2.25, 2.75), rnd)
                z += 0.5
            # husks and fallen leaves along the ridge
            for i in range(int((z1 - a) * 1.5)):
                zz = rnd.uniform(a, z1)
                flat(b, P["cleaf_dk"], rnd.uniform(0.2, 0.45), 0.05, x + rnd.uniform(-0.6, 0.6), 0.12, zz, rnd.uniform(0, 3.1))
            R.end()


def fence(b, P, R):
    """Split rails between leaning posts, north of the corn, a rail down in
    the middle stretch."""
    rnd = random.Random(812)
    for k, (a, e) in enumerate(FENCE):
        R.begin(b, f"east:fence-{k}")
        n = max(1, round((e - a) / 1.8))
        xs = [a + (e - a) * i / n for i in range(n + 1)]
        for i, x in enumerate(xs):
            lx, lz = rnd.uniform(-0.04, 0.04), rnd.uniform(-0.05, 0.05)
            b.bar(P["rail_dk"], (x, 0.0, FENCE_Z), (x + lx, 1.15, FENCE_Z + lz), 0.12)
            b.box(P["rail_dk"], 0.15, 0.04, 0.15, x + lx, 1.13, FENCE_Z + lz, ry=rnd.uniform(-0.3, 0.3))
        for i in range(n):
            x0, x1 = xs[i], xs[i + 1]
            for y in (0.45, 0.95):
                if k == 1 and i == 1 and y == 0.95:
                    # this one's come off its far post and hangs to the ground
                    b.bar(P["rail"], (x0 + 0.05, y, FENCE_Z + 0.07), (x1 - 0.1, 0.06, FENCE_Z + 0.3), 0.09, 0.07)
                    continue
                sag = rnd.uniform(0.0, 0.04)
                mid = ((x0 + x1) / 2, y - sag, FENCE_Z + 0.07)
                b.bar(P["rail"], (x0 - 0.08, y + rnd.uniform(-0.02, 0.02), FENCE_Z + 0.07), mid, 0.1, 0.07)
                b.bar(P["rail"], mid, (x1 + 0.08, y + rnd.uniform(-0.02, 0.02), FENCE_Z + 0.07), 0.1, 0.07)
        R.end()


# ------------------------------------------------------------------ the patch

KINDS = {   # kind: material, ribs, squash, wart, size factor
    "orange": (("pkf1", "pkf2", "pkf3"), (9, 10, 11), 0.78, 0.0, 1.0),
    "ghost": (("ghost",), (10, 12), 0.72, 0.0, 0.95),
    "warty": (("gourd_g",), (9, 10), 0.8, 0.09, 0.85),
    "cinder": (("cinder",), (12, 14), 0.52, 0.0, 1.15),
    "jarrah": (("jarrah",), (10, 12), 0.6, 0.02, 1.05),
}
ORDER = ["orange", "orange", "orange", "ghost", "warty", "cinder", "jarrah", "orange"]


def patch_spots():
    """hollowgrin.js's patch loop, call for call: (x, z, r, carved, i)."""
    P = js_rng(4242)
    out = []
    for i in range(70):
        x, z = 14.5 + P() * 20.5, 5.2 + P() * 12.3
        if any(math.hypot(x - ax, z - az) < ar for ax, az, ar in AVOID):
            continue
        r = 0.18 + P() * 0.22
        carved = P() < 0.12
        P()                                  # the carved face's turn
        out.append((x, z, r, carved, i))
    return out


def pumpkin_leaf(b, m, x, z, s, ang, y=0.02):
    """A broad lobed leaf lying on the ground, cupped up at its edges."""
    pts = [(x, y + 0.03 * s, z)]
    lobes = 10                               # five lobes, a notch between each
    for k in range(lobes):
        a = ang + 2 * math.pi * k / lobes
        rr = s * ((1.0 - 0.25 * (k in (4, 6))) if k % 2 == 0 else 0.68)
        pts.append((x + math.cos(a) * rr, y + 0.06 * s + 0.05 * s * (k % 2), z + math.sin(a) * rr))
    b.poly(m, pts, [[0, 1 + k, 1 + (k + 1) % lobes] for k in range(lobes)][::-1])


def vine(b, P, a, c, rnd, y=0.035):
    """A vine along the ground from a to c, kinked, with a curl or two."""
    n = 3
    prev = (a[0], y, a[1])
    for k in range(1, n + 1):
        t = k / n
        p = (a[0] + (c[0] - a[0]) * t + rnd.uniform(-0.35, 0.35) * (k < n), y + 0.02 * (k < n), a[1] + (c[1] - a[1]) * t + rnd.uniform(-0.35, 0.35) * (k < n))
        if k < n:                            # a leaf off each kink
            pumpkin_leaf(b, P["pleaf"] if rnd.random() < 0.7 else P["pleaf_dry"], p[0] + rnd.uniform(-0.2, 0.2), p[2] + rnd.uniform(-0.2, 0.2), rnd.uniform(0.26, 0.36), rnd.uniform(0, 6))
        b.cyl(P["vine"], 0.026, prev, p, seg=3, caps=False)
        prev = p


def patch(b, P):
    """The uncarved pumpkins of the JS's loop in five kinds, joined by vines
    with leaves on them (ground cover: no props)."""
    rnd = random.Random(4243)
    spots = patch_spots()
    for n, (x, z, r, carved, i) in enumerate(spots):
        if not carved:
            kind = ORDER[(i * 7 + n) % len(ORDER)]
            mats, ribs, squash, wart, f = KINDS[kind]
            pumpkin(b, P[rnd.choice(mats)], P["stem"], x, 0.0, z, r * f, ribs=8, squash=squash,
                    ry=rnd.uniform(0, 6), wart=wart, seed=700 + i, seg=5 if r > 0.27 else 4)
        for k in range(1 if r > 0.28 or n % 2 else 0):
            a = rnd.uniform(0, 2 * math.pi)
            d = r + rnd.uniform(0.15, 0.45)
            pumpkin_leaf(b, P["pleaf_dry"] if rnd.random() < 0.35 else P["pleaf"], x + math.cos(a) * d, z + math.sin(a) * d,
                         rnd.uniform(0.28, 0.4), rnd.uniform(0, 6), y=0.02 + 0.002 * k)
    # each pumpkin's vine to its nearest neighbour west (a running chain)
    for n, (x, z, r, carved, i) in enumerate(spots):
        best = min((s for s in spots if s[0] < x and math.hypot(s[0] - x, s[1] - z) < 3.0),
                   key=lambda s: math.hypot(s[0] - x, s[1] - z), default=None)
        if best:
            vine(b, P, (x, z), (best[0], best[1]), rnd)


def giants(b, P, R):
    """The two uncarved giants, pale and warty, sat in straw, their stems
    thick as a wrist, a vine off each."""
    rnd = random.Random(4244)
    for k, (x, z, r) in enumerate(GIANTS):
        if k == 1:
            continue
        R.begin(b, f"east:giant-{k}")
        pumpkin(b, P["giant"], P["stem"], x, 0.0, z, r, ribs=12, squash=0.72, ry=rnd.uniform(0, 6), wart=0.03, seed=50 + k, seg=8)
        b.cyl(P["stem"], r * 0.11, (x, r * 1.38, z), (x + 0.08, r * 1.38 + 0.26, z + 0.05), seg=6, r2=r * 0.07)
        for j in range(14):                  # straw tucked round the foot
            a = rnd.uniform(0, 2 * math.pi)
            d = r * rnd.uniform(0.85, 1.1)
            flat(b, P["hay"], rnd.uniform(0.2, 0.4), 0.02, x + math.cos(a) * d, 0.015, z + math.sin(a) * d, rnd.uniform(0, 3.1))
        R.end()
        for j in range(3):
            a = rnd.uniform(0, 2 * math.pi)
            d = r + 0.35
            pumpkin_leaf(b, P["pleaf"], x + math.cos(a) * d, z + math.sin(a) * d, rnd.uniform(0.3, 0.42), rnd.uniform(0, 6))
        vine(b, P, (x - r * 0.9, z + 0.2), (x - r - 1.6, z + 0.9), rnd)
    # straw under the carved one, the JS's (its body is the JS's jack)
    x, z, r = GIANTS[1]
    for j in range(16):
        a = rnd.uniform(0, 2 * math.pi)
        d = r * rnd.uniform(0.9, 1.15)
        flat(b, P["hay"], rnd.uniform(0.2, 0.4), 0.02, x + math.cos(a) * d, 0.015, z + math.sin(a) * d, rnd.uniform(0, 3.1))


# ------------------------------------------------------------------ the bonfire

def bonfire(b, P, R):
    """A ring of fieldstones, a teepee of logs, charred ends; the flames,
    embers and light are the JS's. Its bales to sit on round it."""
    bx, bz = BONFIRE
    rnd = random.Random(818)
    R.begin(b, "east:bonfire")
    for i in range(12):
        a = i / 12 * 2 * math.pi + rnd.uniform(-0.08, 0.08)
        r = rnd.uniform(0.2, 0.26)
        b.lump(P["fstone"], r * 2, r * 1.3, r * 1.7, bx + math.cos(a) * 0.98, 0.0, bz + math.sin(a) * 0.98, seed=i + 5,
               rnd=0.6, jitter=0.03, ry=a, n=2)
    b.lump(P["char"], 1.3, 0.06, 1.3, bx, 0.0, bz, seed=3, rnd=0.3, jitter=0.02, n=2)
    for i in range(7):
        a = i / 7 * 2 * math.pi + rnd.uniform(-0.15, 0.15)
        foot = (bx + math.cos(a) * 0.55, 0.04, bz + math.sin(a) * 0.55)
        tip = (bx + math.cos(a) * 0.06, 1.0 + rnd.uniform(-0.1, 0.1), bz + math.sin(a) * 0.06)
        rr = rnd.uniform(0.06, 0.085)
        b.cyl(P["bark"], rr, foot, tip, seg=6, r2=rr * 0.8)
        b.cyl(P["char"], rr * 0.82, (tip[0] - (tip[0] - foot[0]) * 0.35, tip[1] - (tip[1] - foot[1]) * 0.35, tip[2] - (tip[2] - foot[2]) * 0.35),
              (tip[0] + (tip[0] - foot[0]) * 0.04, tip[1] + 0.04, tip[2] + (tip[2] - foot[2]) * 0.04), seg=6)
    R.end()
    # split logs stacked by the ring, west (low: no collider)
    R.begin(b, "east:bonfire-logs")
    lx, lz = bx - 1.55, bz - 1.35
    for row, n in enumerate((3, 2)):
        for k in range(n):
            px = lx + (k - (n - 1) / 2) * 0.17
            y = 0.075 + row * 0.14
            b.cyl(P["bark"], 0.075, (px, y, lz - 0.38), (px, y, lz + 0.38), seg=6)
            for sd in (-1, 1):
                b.cyl(P["logend"], 0.066, (px, y, lz + sd * 0.38), (px, y, lz + sd * 0.385), seg=6)
    R.end()
    hrnd = random.Random(819)
    for i, (dx, dz, ry) in enumerate(BONFIRE_BALES):
        R.begin(b, f"east:bale-{i}")
        bale(b, P, hrnd, bx + dx, bz + dz, 0.0, ry, 160 + i)
        R.end()
    for k in range(18):                      # loose straw between the bales
        a = hrnd.uniform(0, 2 * math.pi)
        d = hrnd.uniform(1.3, 3.2)
        flat(b, P["hay"], hrnd.uniform(0.15, 0.35), 0.02, bx + math.cos(a) * d, 0.015, bz + math.sin(a) * d, hrnd.uniform(0, 3.1))


# ------------------------------------------------------------------ the barrow

def barrow(b, P, R):
    """An old wooden wheelbarrow, its tray of boards heaped with pumpkins,
    left at the patch's east edge."""
    bx, bz, ry = BARROW
    c, s = math.cos(ry), math.sin(ry)
    at = lambda f, side, y: (bx + c * f + s * side, y, bz - s * f + c * side)
    W, D = P["barrow"], P["wood_dk"]
    R.begin(b, "east:barrow")
    # the tray: a floor and splayed sides of boards, a high back
    floor = [at(-0.5, -0.27, 0.36), at(0.42, -0.24, 0.36), at(0.42, 0.24, 0.36), at(-0.5, 0.27, 0.36)]
    b.poly(W, floor, [[0, 1, 2, 3], [3, 2, 1, 0]])
    for sd in (-1, 1):
        for k in range(2):
            y0, y1 = 0.36 + k * 0.15, 0.36 + (k + 1) * 0.15 - 0.01
            o0, o1 = 0.27 + k * 0.05, 0.27 + (k + 1) * 0.05
            q = [at(-0.55, sd * o0, y0), at(0.45 - k * 0.04, sd * (o0 - 0.03), y0), at(0.4 - k * 0.04, sd * (o1 - 0.03), y1), at(-0.6, sd * o1, y1)]
            b.poly(W, q, [[0, 1, 2, 3], [3, 2, 1, 0]])
    back = [at(-0.5, -0.27, 0.36), at(-0.5, 0.27, 0.36), at(-0.6, 0.37, 0.66), at(-0.6, -0.37, 0.66)]
    b.poly(W, back, [[0, 1, 2, 3], [3, 2, 1, 0]])
    nose = [at(0.42, -0.24, 0.36), at(0.42, 0.24, 0.36), at(0.36, 0.34, 0.66), at(0.36, -0.34, 0.66)]
    b.poly(W, nose, [[0, 1, 2, 3], [3, 2, 1, 0]])
    # the handles run under the tray from the wheel to the grips, the legs
    for sd in (-1, 1):
        b.bar(D, at(0.7, sd * 0.07, 0.2), at(-1.15, sd * 0.3, 0.56), 0.05)
        b.bar(D, at(-0.35, sd * 0.24, 0.42), at(-0.42, sd * 0.27, 0.0), 0.045)
        b.cyl(P["handle"], 0.03, at(-1.0, sd * 0.28, 0.54), at(-1.22, sd * 0.31, 0.57), seg=6)
    # the wheel: a wooden one with an iron tyre and six spokes
    wx, wy, wz = at(0.7, 0.0, 0.2)
    ax = "x" if abs(s) > 0.7 else "z"
    ring(b, P["iron"], (wx, wy, wz), 0.19, 0.022, seg=16, tseg=4, axis=ax)
    ring(b, W, (wx, wy, wz), 0.165, 0.025, seg=16, tseg=4, axis=ax)
    for k in range(6):
        a = k / 6 * math.pi
        e = (0.0, math.sin(a) * 0.16, math.cos(a) * 0.16)
        p0 = at(0.7 + e[2], 0.0, 0.2 + e[1])
        p1 = at(0.7 - e[2], 0.0, 0.2 - e[1])
        b.cyl(W, 0.012, p0, p1, seg=4, caps=False)
    b.cyl(D, 0.04, at(0.7, -0.08, 0.2), at(0.7, 0.08, 0.2), seg=8)
    # the load
    rnd = random.Random(820)
    for k in range(7):
        f, sd = rnd.uniform(-0.35, 0.25), rnd.uniform(-0.18, 0.18)
        r = rnd.uniform(0.13, 0.18)
        kind = ORDER[k % len(ORDER)]
        mats, ribs, squash, wart, ff = KINDS[kind]
        px, _, pz = at(f, sd, 0)
        pumpkin(b, P[rnd.choice(mats)], P["stem"], px, 0.37 + (0.12 if k > 3 else 0.0), pz, r, ribs=6,
                squash=squash, ry=rnd.uniform(0, 6), wart=wart, seed=900 + k)
    R.end()
    # two fallen off its side
    for k, (f, sd) in enumerate(((0.2, 0.7), (-0.4, 0.85))):
        px, _, pz = at(f, sd, 0)
        pumpkin(b, P["pk2"], P["stem"], px, 0.0, pz, 0.17, ribs=10, ry=k * 2.0, seed=930 + k)


def build_fields(P, R):
    """The corn and the pumpkin patch (phase 3): see the module's notes."""
    b = HGBuilder()
    corn(b, P, R)
    fence(b, P, R)
    patch(b, P)
    giants(b, P, R)
    bonfire(b, P, R)
    barrow(b, P, R)
    b.finish("hg-fields.glb")


def build_scarecrow(P, R):
    """The scarecrow is Studio's (the doc's hero pick: generate_mesh, a
    jack-o'-lantern head under a witch's hat, a patched coat of straw on
    its post and crossbar), exported as it came and placed on the patch's
    post, plus the bake's UV set, as hg-scarecrow.glb."""
    import bpy
    from tf_kit import Report, bounds, lightmap_uv
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=SCARECROW_SOURCE)
    ob = [o for o in bpy.data.objects if o not in before and o.type == "MESH"][0]
    ob.name = "hg-scarecrow"
    dec = ob.modifiers.new("dec", "DECIMATE")   # 8.7k tris to ~5k, and its texture at 512 (the map is near its 16 MB cap)
    dec.ratio = 0.58
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier="dec")
    for m in ob.data.materials:
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image and n.image.size[0] > 512:
                n.image.scale(512, 512)
    lightmap_uv(ob)
    game = [(v.co.x, v.co.z, -v.co.y) for v in ob.data.vertices]
    R.prop("east:scarecrow", [min(p[k] for p in game) for k in range(3)], [max(p[k] for p in game) for k in range(3)])
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hg-scarecrow.glb")
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_yup=True,
                              export_image_format="JPEG", export_jpeg_quality=85, export_apply=True)
    lo, hi = bounds(ob)
    Report.rows.append(["hg-scarecrow", len(ob.data.polygons), len(ob.data.vertices), 0, lo, hi])
    bpy.data.objects.remove(ob)
