"""
Troll Forces — Hollowgrin's Grinmoor Fair park (map detail pass phase 6b).

Run with (no names = all):
  blender --background --python build_grinmoor.blender.py -- carousel ride horse fountain plaza wheel stalls

Writes, in MAP coordinates (placed at the origin) unless noted:
  hg-carousel.glb       the carousel's still parts: drum, canopy, rounding boards
  hg-carousel-ride.glb  its turning deck, poles and pumpkin coaches, about the
                        carousel's centre (the JS spins it)
  hg-horse.glb          one carved horse about its own centre, nose +x (the JS
                        instances it eight times and bobs them)
  hg-fountain.glb       the pumpkin fountain: curb, basins, vines, the bronze troll
  hg-plaza.glb          benches and banner lamp posts round the plaza
  hg-wheelbase.glb      the Ferris wheel's A-frame, boarding deck, stair, lamp deck,
                        operator's shack and ticket podium (the wheel itself is JS)
  hg-stalls.glb         the five midway stalls on the plaza's north edge
Colliders live in hollowgrin.js (constants PARK_* / FOUNTAIN / FERRIS /
STALLS): change a size here, change it there. The JS keeps everything that
glows, flickers, turns or carries a canvas (bulbs, water, signs, prizes,
the tin trolls).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
import math  # noqa: E402
import random  # noqa: E402

TEXTURED.update({"HG_Granite", "HG_GraniteDark", "HG_Brick", "HG_Floorboards", "HG_BarnWood"})

TAU = math.pi * 2

# --- shared with hollowgrin.js -------------------------------------------
CAROUSEL = (44.5, -4.0, 4.5)          # x, z, deck radius
FOUNTAIN = (63.0, 2.5)
PLAZA_R = 9.0
FERRIS = (80.0, 2.5, 11.0, 13.2)       # x, z, r, hub height
WHEEL_STAIR = dict(x0=76.6, x1=77.8, z_foot=0.6, steps=20, rise=0.3, run=0.3)
WHEEL_DECK = dict(x0=74.0, x1=78.0, z0=-8.8, z1=-5.4, y=6.0)
BOARDING = dict(x0=78.0, x1=82.4, z0=0.4, z1=4.6, y=0.6)
SHACK = dict(x0=74.4, x1=77.0, z0=-8.4, z1=-5.9, h=2.6)
PODIUM = (75.2, 5.2)
STALL_Z = (-11.2, -8.2)                 # back wall, front (counter) line
STALLS = [(53.4, 56.9), (56.9, 60.4), (62.9, 66.4), (66.4, 69.9), (69.9, 73.4)]


def gf_palette():
    return {
        "granite": mat("HG_Granite", 0x8c8c94, 0.9),
        "granite_dk": mat("HG_GraniteDark", 0x5a5a62, 0.9),
        "brick": mat("HG_Brick", 0x8a4a3a, 0.9),
        "deck": mat("HG_Floorboards", 0x6a4a30, 0.8),
        "plank": mat("HG_BarnWood", 0x8a6a48, 0.85),
        "verd": mat("GF_Verdigris", 0x4f8a78, 0.55, 0.15),
        "verd_dk": mat("GF_VerdigrisDark", 0x2c5246, 0.6, 0.15),
        "bronze": mat("GF_Bronze", 0x5a7a62, 0.45, 0.25),
        "iron": mat("HG_Iron", 0x1c1c22, 0.55, 0.3),
        "gold": mat("GF_Gold", 0xd8b050, 0.3, 0.45),
        "brass": mat("HG_Brass", 0xc8a050, 0.35, 0.4),
        "steel": mat("GF_Steel", 0xc8ccd6, 0.45, 0.3),
        "steel_dk": mat("GF_SteelDark", 0x5a6068, 0.5, 0.3),
        "vine": mat("GF_Vine", 0x2a3a1c, 0.9),
        "leaf": mat("GF_Leaf", 0x3a5a24, 0.85),
        "leaf_o": mat("GF_LeafOrange", 0xd8641c, 0.85),
        "leaf_r": mat("GF_LeafRed", 0x9a2a1c, 0.85),
        "leaf_y": mat("GF_LeafYellow", 0xd8a02a, 0.85),
        "cream": mat("GF_Cream", 0xeee2c8, 0.7),
        "red": mat("GF_Red", 0xb8242c, 0.7),
        "purple": mat("GF_Purple", 0x5a2a7c, 0.75),
        "teal": mat("GF_Teal", 0x2a8a86, 0.6),
        "orange": mat("GF_Orange", 0xe0762a, 0.65),
        "black": mat("GF_Black", 0x16141a, 0.7),
        "green": mat("GF_Green", 0x2e5a3a, 0.7),
        "white": mat("GF_White", 0xf0ece4, 0.6),
        "pink": mat("GF_Pink", 0xf08ac8, 0.7),
        "blue": mat("GF_Blue", 0x3a6ad8, 0.6),
        "yellow": mat("GF_Yellow", 0xf0c83a, 0.6),
        "wood": mat("GF_Wood", 0x6a4a30, 0.8),
        "wood_dk": mat("GF_WoodDark", 0x3a2a1e, 0.8),
        "pumpkin": mat("GF_Pumpkin", 0xe07423, 0.55),
        "stem": mat("GF_Stem", 0x4a4a22, 0.9),
        "tin": mat("HG_Tin", 0xc8c0a8, 0.5, 0.2),
        "mirror": mat("GF_Mirror", 0x9ab8d0, 0.15, 0.0, 0x4a6a8a, 0.6),
        "lamp": mat("HG_Lamp", 0xfff0c8, 0.2, 0.0, 0xffd890, 3.0),
        "warm": mat("HG_WarmGlass", 0xffd08a, 0.3, 0.0, 0xffb860, 1.6),
        "red_lamp": mat("GF_RedLamp", 0xff6a5a, 0.3, 0.0, 0xff3a2a, 2.0),
        "glass": mat("HG_GlassDark", 0x1a2028, 0.1),
        "rubber": mat("GF_Rubber", 0x222226, 0.9),
        "canvas": mat("GF_Canvas", 0xd8ccb0, 0.95),
    }


# ------------------------------------------------------------ helpers

def lathe(b, m, cx, cz, prof, seg=24, y0=0.0, a0=0.0, a1=TAU, rmod=None):
    """Revolve a profile [(r, y), ...] about the vertical axis through (cx, cz).
    A profile that starts and ends on the axis (r = 0) makes a closed solid.
    `rmod(theta) -> scale` ribs or flutes the radius."""
    full = abs(a1 - a0 - TAU) < 1e-6
    n = seg if full else seg + 1
    pts, idx = [], []
    for p, (r, y) in enumerate(prof):
        row = []
        if r < 1e-6:
            pts.append((cx, y0 + y, cz))
            row = [len(pts) - 1] * n
        else:
            for i in range(n):
                t = a0 + (a1 - a0) * i / seg
                k = rmod(t) if rmod else 1.0
                pts.append((cx + math.cos(t) * r * k, y0 + y, cz + math.sin(t) * r * k))
                row.append(len(pts) - 1)
        idx.append(row)
    faces = []
    for p in range(len(prof) - 1):
        A, B = idx[p], idx[p + 1]
        for i in range(seg):
            j = (i + 1) % n if full else i + 1
            f = [A[i], A[j], B[j], B[i]]
            dedup = []
            for v in f:
                if v not in dedup:
                    dedup.append(v)
            if len(dedup) >= 3:
                faces.append(dedup)
    out = b.poly(m, pts, faces)
    for f in out:
        f.smooth = True
    return out


def ring(b, m, cx, cz, r_in, r_out, y0, y1, seg=32):
    """A flat-topped annulus (curb, rim)."""
    return lathe(b, m, cx, cz, [(r_in, y0), (r_out, y0), (r_out, y1), (r_in, y1), (r_in, y0)], seg)


def pumpkin(b, m, x, y, z, r, ribs=10, squash=0.78, seed=0, stem=None):
    """Ribbed pumpkin, bottom on y."""
    rnd = random.Random(seed)
    tw = rnd.uniform(0, TAU)
    prof = []
    N = 9
    for i in range(N + 1):
        a = -math.pi / 2 + math.pi * i / N
        rr = math.cos(a) * r
        yy = (math.sin(a) + 1) * r * squash
        if i == 0:
            yy += r * squash * 0.12      # dimple underneath
        if i == N:
            yy -= r * squash * 0.18      # dimple at the stem
        prof.append((max(rr, 0.0), yy))
    lathe(b, m, x, z, prof, seg=ribs * 4, y0=y, rmod=lambda t: 1 - 0.09 * abs(math.sin((t + tw) * ribs / 2)) ** 0.6)
    if stem:
        top = y + 2 * r * squash * 0.86
        b.cyl(stem, r * 0.1, (x, top - 0.02, z), (x + r * 0.08, top + r * 0.32, z + r * 0.05), seg=6, r2=r * 0.06)


def catenary(a, b_, sag, n):
    out = []
    for i in range(n + 1):
        t = i / n
        out.append((a[0] + (b_[0] - a[0]) * t, a[1] + (b_[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b_[2] - a[2]) * t))
    return out


def tube(b, m, pts, r, seg=5):
    for p, q in zip(pts, pts[1:]):
        b.cyl(m, r, p, q, seg=seg)


def lamp_post(b, P, x, z, h=3.6, banner=None, face=0.0):
    """Cast-iron plaza lamp: fluted base, tapering shaft, a crossarm with two
    lanterns, and (optional) a hanging banner on an arm facing `face`."""
    b.cyl(P["iron"], 0.2, (x, 0, z), (x, 0.45, z), seg=8, r2=0.14)
    b.cyl(P["iron"], 0.24, (x, 0, z), (x, 0.08, z), seg=8)
    b.cyl(P["iron"], 0.07, (x, 0.45, z), (x, h, z), seg=8, r2=0.05)
    for yy in (1.0, 2.2):
        b.cyl(P["iron"], 0.085, (x, yy, z), (x, yy + 0.06, z), seg=8)
    # crossarm (along the banner's direction, so the lanterns sit either side)
    ca, sa = math.cos(face), math.sin(face)
    b.bar(P["iron"], (x - ca * 0.55, h, z - sa * 0.55), (x + ca * 0.55, h, z + sa * 0.55), 0.05)
    for s in (-1, 1):
        lx, lz = x + ca * 0.5 * s, z + sa * 0.5 * s
        b.cyl(P["iron"], 0.012, (lx, h, lz), (lx, h - 0.12, lz), seg=4)
        b.cyl(P["iron"], 0.1, (lx, h - 0.16, lz), (lx, h - 0.12, lz), seg=6)
        b.cyl(P["lamp"], 0.09, (lx, h - 0.5, lz), (lx, h - 0.16, lz), seg=6, r2=0.1)
        b.cyl(P["iron"], 0.06, (lx, h - 0.56, lz), (lx, h - 0.5, lz), seg=6, r2=0.09)
    b.cyl(P["iron"], 0.06, (x, h, z), (x, h + 0.35, z), seg=6, r2=0.0)
    if banner:
        # arm out, the banner hangs from it: orange with a black bar and fringe
        nx, nz = -sa, ca
        b.bar(P["iron"], (x, h - 0.75, z), (x + nx * 0.62, h - 0.75, z + nz * 0.62), 0.035)
        cx, cz = x + nx * 0.36, z + nz * 0.36
        w = 0.5
        top, bot = h - 0.78, h - 2.0
        th = 0.012
        b.box(banner[0], w if abs(nz) > 0.5 else th, top - bot, th if abs(nz) > 0.5 else w, cx, bot, cz, ry=0)
        b.box(banner[1], (w if abs(nz) > 0.5 else th) + 0.004, 0.16, (th if abs(nz) > 0.5 else w) + 0.004, cx, bot + 0.55, cz)
        b.box(banner[1], (w if abs(nz) > 0.5 else th) + 0.004, 0.05, (th if abs(nz) > 0.5 else w) + 0.004, cx, top - 0.12, cz)
        # a pointed swallowtail
        for s in (-1, 1):
            ox = (w / 4) * s if abs(nz) > 0.5 else 0
            oz = 0 if abs(nz) > 0.5 else (w / 4) * s
            b.box(banner[0], (w / 2 if abs(nz) > 0.5 else th), 0.18, (th if abs(nz) > 0.5 else w / 2), cx + ox, bot - 0.18, cz + oz)


def bench(b, P, x, z, ry):
    """Park bench: cast-iron scroll ends, wooden slats; faces -z before ry."""
    c, s = math.cos(ry), math.sin(ry)

    def at(px, py, pz):
        return (x + px * c + pz * s, py, z - px * s + pz * c)
    for ex in (-0.8, 0.8):
        b.bar(P["iron"], at(ex, 0, 0.22), at(ex, 0.42, 0.2), 0.05)
        b.bar(P["iron"], at(ex, 0, -0.22), at(ex, 0.42, -0.2), 0.05)
        b.bar(P["iron"], at(ex, 0.42, -0.25), at(ex, 0.42, 0.25), 0.05)
        b.bar(P["iron"], at(ex, 0.42, 0.22), at(ex, 0.9, 0.3), 0.05)
        b.bar(P["iron"], at(ex, 0.55, -0.25), at(ex, 0.62, -0.32), 0.04)
    for k in range(4):
        b.bar(P["wood"], at(-0.95, 0.44, -0.18 + k * 0.12), at(0.95, 0.44, -0.18 + k * 0.12), 0.09, 0.03)
    for k in range(3):
        y = 0.56 + k * 0.12
        zz = 0.24 + (y - 0.42) * 0.17
        b.bar(P["wood"], at(-0.95, y, zz), at(0.95, y, zz), 0.03, 0.09)


# ------------------------------------------------------------ the carousel

def build_carousel(P):
    b = Builder()
    cx, cz, r = CAROUSEL
    # the centre drum: twelve panels, mirrors and painted boards, cornices
    R = 0.8
    lathe(b, P["cream"], cx, cz, [(0, 0.3), (R + 0.06, 0.3), (R + 0.06, 0.5), (R, 0.5), (R, 3.85), (R + 0.1, 3.85), (R + 0.1, 4.05), (0, 4.05)], seg=12)
    for i in range(12):
        t = (i + 0.5) / 12 * TAU
        px, pz = cx + math.cos(t) * (R + 0.01), cz + math.sin(t) * (R + 0.01)
        w = 2 * R * math.sin(math.pi / 12) * 0.78
        m = P["mirror"] if i % 2 else P["red"]
        b.box(m, 0.02, 1.7, w, px, 1.3, pz, ry=-t)
        b.box(P["gold"], 0.03, 0.06, w + 0.08, px, 1.27, pz, ry=-t)
        b.box(P["gold"], 0.03, 0.06, w + 0.08, px, 3.0, pz, ry=-t)
        # the band organ's pipes on the south face
        if i in (2, 3, 4):
            for k in range(5):
                off = (k - 2) * w / 5
                qx, qz = px - math.sin(t) * off * -1, pz + math.cos(t) * off
                b.cyl(P["brass"], 0.035, (qx + math.cos(t) * 0.04, 3.1, qz + math.sin(t) * 0.04),
                      (qx + math.cos(t) * 0.04, 3.4 + 0.3 * (1 - abs(k - 2) / 2), qz + math.sin(t) * 0.04), seg=6)
    # the canopy: twenty-four stripes in red and cream, a peaked roof
    seg = 24
    rr = r + 0.6
    for i in range(seg):
        a0, a1 = TAU * i / seg, TAU * (i + 1) / seg
        m = P["red"] if i % 2 else P["cream"]
        lathe(b, m, cx, cz, [(rr, 4.6), (rr * 0.55, 5.4), (0.0, 6.35)], seg=2, a0=a0, a1=a1)
        lathe(b, m, cx, cz, [(rr * 0.98, 4.58), (rr * 0.53, 5.36), (0.0, 6.3)][::-1], seg=2, a0=a0, a1=a1)
    # the rounding boards: a band of panels with oval mirrors, scalloped hem
    lathe(b, P["cream"], cx, cz, [(rr + 0.02, 3.95), (rr + 0.02, 4.62), (rr - 0.06, 4.62), (rr - 0.06, 3.95), (rr + 0.02, 3.95)], seg=48)
    for i in range(16):
        t = (i + 0.5) / 16 * TAU
        px, pz = cx + math.cos(t) * (rr + 0.04), cz + math.sin(t) * (rr + 0.04)
        b.box(P["mirror"], 0.02, 0.36, 0.5, px, 4.1, pz, ry=-t)
        b.box(P["gold"], 0.025, 0.44, 0.06, px + math.sin(t) * 0.29, 4.06, pz - math.cos(t) * 0.29, ry=-t)
    for i in range(48):
        t = (i + 0.5) / 48 * TAU
        px, pz = cx + math.cos(t) * (rr + 0.02), cz + math.sin(t) * (rr + 0.02)
        b.cyl(P["red"] if i % 2 else P["gold"], 0.16, (px, 3.95, pz), (px + math.cos(t) * 0.02, 3.95, pz + math.sin(t) * 0.02), seg=8)
        b.box(P["red"] if i % 2 else P["gold"], 0.02, 0.12, 0.32, px, 3.84, pz, ry=-t)
    lathe(b, P["gold"], cx, cz, [(rr + 0.04, 4.62), (rr + 0.12, 4.66), (rr + 0.04, 4.7), (rr - 0.1, 4.66), (rr + 0.04, 4.62)], seg=48)
    # sweeps under the canopy, from the drum out to the rounding boards
    for i in range(16):
        t = i / 16 * TAU
        b.bar(P["cream"], (cx + math.cos(t) * R, 4.0, cz + math.sin(t) * R), (cx + math.cos(t) * rr, 4.25, cz + math.sin(t) * rr), 0.08, 0.16)
    # the crown: a gold finial with a pennant
    b.cyl(P["gold"], 0.18, (cx, 6.25, cz), (cx, 6.55, cz), seg=10, r2=0.1)
    b.cyl(P["gold"], 0.035, (cx, 6.55, cz), (cx, 7.35, cz), seg=6)
    lathe(b, P["gold"], cx, cz, [(0, 6.6), (0.13, 6.7), (0.0, 6.85)], seg=10)
    b.poly(P["orange"], [(cx, 7.32, cz), (cx, 7.05, cz), (cx + 0.6, 7.2, cz + 0.05)], [[0, 1, 2]])
    b.poly(P["orange"], [(cx, 7.32, cz), (cx + 0.6, 7.2, cz + 0.05), (cx, 7.05, cz)], [[0, 1, 2]])
    # the step round the turning deck
    ring(b, P["granite_dk"], cx, cz, r + 0.02, r + 0.35, 0.0, 0.12, seg=40)
    b.finish("hg-carousel.glb")


def build_ride(P):
    """The turning part, about the carousel's centre (origin)."""
    b = Builder()
    r = CAROUSEL[2]
    lathe(b, P["deck"], 0, 0, [(0, 0.3), (r, 0.3), (r, 0.04), (0, 0.04)], seg=40)
    ring(b, P["gold"], 0, 0, r - 0.04, r + 0.03, 0.04, 0.3, seg=40)
    lathe(b, P["red"], 0, 0, [(r + 0.035, 0.08), (r + 0.035, 0.27), (r + 0.01, 0.27), (r + 0.01, 0.08), (r + 0.035, 0.08)], seg=40)
    # brass poles for the eight horses: twisted, with collars
    for i in range(8):
        t = i / 8 * TAU
        x, z = math.cos(t) * 3.3, math.sin(t) * 3.3
        b.cyl(P["brass"], 0.04, (x, 0.3, z), (x, 3.95, z), seg=8)
        for k in range(14):
            yy = 0.5 + k * 0.25
            b.cyl(P["gold"], 0.048, (x, yy, z), (x, yy + 0.05, z), seg=8)
        b.cyl(P["gold"], 0.08, (x, 0.3, z), (x, 0.38, z), seg=8)
        b.cyl(P["gold"], 0.08, (x, 3.87, z), (x, 3.95, z), seg=8)
    # inner ring of poles for the coaches
    for i in range(8):
        t = (i + 0.5) / 8 * TAU
        x, z = math.cos(t) * 2.0, math.sin(t) * 2.0
        b.cyl(P["brass"], 0.03, (x, 0.3, z), (x, 3.95, z), seg=6)
    # four pumpkin coaches: a carved shell, a bench, gold wheels
    for i in range(4):
        t = (i + 0.5) / 4 * TAU
        x, z = math.cos(t) * 1.9, math.sin(t) * 1.9
        pumpkin(b, P["pumpkin"], x, 0.36, z, 0.62, ribs=10, squash=0.82, seed=i, stem=P["stem"])
        # the door: a dark oval on the outside face, a gold frame round it
        ox, oz = math.cos(t), math.sin(t)
        b.box(P["black"], 0.04, 0.5, 0.42, x + ox * 0.6, 0.6, z + oz * 0.6, ry=-t)
        b.box(P["gold"], 0.05, 0.56, 0.05, x + ox * 0.6 - oz * 0.24, 0.57, z + oz * 0.6 + ox * 0.24, ry=-t)
        b.box(P["gold"], 0.05, 0.56, 0.05, x + ox * 0.6 + oz * 0.24, 0.57, z + oz * 0.6 - ox * 0.24, ry=-t)
        for s in (-1, 1):
            wx, wz = x - oz * 0.45 * s, z + ox * 0.45 * s
            b.cyl(P["gold"], 0.2, (wx, 0.52, wz), (wx + ox * 0.05, 0.52, wz + oz * 0.05), seg=12)
            b.cyl(P["gold"], 0.2, (wx - ox * 0.05 + ox * 0.0, 0.52, wz), (wx + ox * 0.05, 0.52, wz + oz * 0.05), seg=12)
    b.finish("hg-carousel-ride.glb")


def build_horse(P):
    """One carved carousel horse, nose +x, its body's centre at the origin."""
    b = Builder()
    W, S, G, M_ = P["white"], P["red"], P["gold"], P["black"]
    b.lump(W, 1.05, 0.46, 0.34, 0.0, -0.23, 0.0, seed=1, rnd=0.7, jitter=0.0)          # barrel
    b.lump(W, 0.36, 0.42, 0.32, 0.36, -0.22, 0.0, seed=2, rnd=0.7, jitter=0.0)          # chest
    b.lump(W, 0.34, 0.38, 0.3, -0.38, -0.2, 0.0, seed=3, rnd=0.7, jitter=0.0)           # rump
    # neck up and forward, the head tucked
    b.cyl(W, 0.13, (0.42, 0.05, 0.0), (0.62, 0.52, 0.0), seg=10, r2=0.09)
    b.lump(W, 0.36, 0.17, 0.15, 0.78, 0.43, 0.0, seed=4, rnd=0.6, jitter=0.0)
    b.cyl(W, 0.08, (0.66, 0.56, 0.0), (0.92, 0.44, 0.0), seg=8, r2=0.06)
    for s in (-1, 1):
        b.cyl(W, 0.025, (0.66, 0.6, 0.04 * s), (0.64, 0.72, 0.05 * s), seg=4, r2=0.0)      # ears
        b.box(M_, 0.04, 0.035, 0.01, 0.8, 0.5, 0.075 * s)                                 # eyes
    # mane: a gold ridge down the neck
    for k in range(6):
        t = k / 5
        b.lump(G, 0.1, 0.1, 0.07, 0.42 + t * 0.24 - 0.06, 0.12 + t * 0.48, 0.0, seed=10 + k, rnd=0.8, jitter=0.02)
    # tail
    b.cyl(G, 0.05, (-0.52, 0.02, 0.0), (-0.72, -0.3, 0.0), seg=6, r2=0.08)
    b.cyl(G, 0.08, (-0.72, -0.3, 0.0), (-0.74, -0.55, 0.0), seg=6, r2=0.03)
    # saddle, blanket and bridle
    b.lump(S, 0.4, 0.06, 0.38, 0.0, 0.0, 0.0, seed=20, rnd=0.5, jitter=0.0)
    b.lump(G, 0.3, 0.08, 0.3, -0.02, 0.04, 0.0, seed=21, rnd=0.5, jitter=0.0)
    b.box(G, 0.04, 0.12, 0.05, 0.13, 0.08, 0.0)
    for s in (-1, 1):
        b.box(S, 0.34, 0.24, 0.02, 0.0, -0.22, 0.17 * s)
        b.cyl(G, 0.008, (0.0, -0.02, 0.17 * s), (0.02, -0.4, 0.18 * s), seg=3)
        b.box(G, 0.08, 0.02, 0.04, 0.02, -0.42, 0.18 * s)
        b.bar(G, (0.68, 0.54, 0.075 * s), (0.9, 0.42, 0.06 * s), 0.015)
    # legs mid-gallop: front pair curled up, back pair reaching
    for lz, fx, k in ((0.1, 0.32, 0), (-0.1, 0.32, 1)):
        knee = (fx + 0.22, -0.42 + 0.06 * k, lz)
        b.cyl(W, 0.055, (fx, -0.3, lz), knee, seg=8, r2=0.045)
        hoof = (knee[0] - 0.05, knee[1] - 0.26, lz)
        b.cyl(W, 0.042, knee, hoof, seg=8, r2=0.035)
        b.cyl(G, 0.04, hoof, (hoof[0] - 0.02, hoof[1] - 0.05, lz), seg=8)
    for lz, k in ((0.1, 0), (-0.1, 1)):
        hip = (-0.36, -0.3, lz)
        hock = (-0.6 - 0.04 * k, -0.48, lz)
        b.cyl(W, 0.06, hip, hock, seg=8, r2=0.045)
        hoof = (-0.76 - 0.04 * k, -0.62, lz)
        b.cyl(W, 0.04, hock, hoof, seg=8, r2=0.035)
        b.cyl(G, 0.04, hoof, (hoof[0] - 0.05, hoof[1] - 0.02, lz), seg=8)
    b.finish("hg-horse.glb")


# ------------------------------------------------------------ the fountain

def build_fountain(P):
    b = Builder()
    fx, fz = FOUNTAIN
    V, VD = P["verd"], P["verd_dk"]
    # the curb: a granite ring with a rounded coping, the pool floor inside
    lathe(b, P["granite"], fx, fz, [(3.3, 0.0), (3.75, 0.0), (3.75, 0.36), (3.68, 0.45), (3.37, 0.45), (3.3, 0.36), (3.3, 0.0)], seg=40)
    lathe(b, P["granite_dk"], fx, fz, [(0, 0.12), (3.31, 0.12), (3.31, 0.1), (0, 0.1)], seg=40)
    # the low iron fence along the curb: posts, two rails, spear bars
    FR = 3.52
    for i in range(16):
        t = i / 16 * TAU
        x, z = fx + math.cos(t) * FR, fz + math.sin(t) * FR
        b.box(P["iron"], 0.07, 0.62, 0.07, x, 0.45, z, ry=-t)
        b.cyl(P["gold"], 0.045, (x, 1.07, z), (x, 1.12, z), seg=6)
        lathe(b, P["gold"], x, z, [(0, 1.1), (0.05, 1.14), (0, 1.22)], seg=6)
    for yy in (0.55, 0.98):
        lathe(b, P["iron"], fx, fz, [(FR - 0.015, yy), (FR + 0.015, yy), (FR + 0.015, yy + 0.03), (FR - 0.015, yy + 0.03), (FR - 0.015, yy)], seg=48)
    for i in range(96):
        t = (i + 0.5) / 96 * TAU
        x, z = fx + math.cos(t) * FR, fz + math.sin(t) * FR
        b.cyl(P["iron"], 0.012, (x, 0.45, z), (x, 1.02, z), seg=4)
        b.cyl(P["iron"], 0.025, (x, 1.02, z), (x, 1.1, z), seg=4, r2=0.0)
    # tier one: a fluted pedestal, a deep bowl with a rolled lip
    lathe(b, VD, fx, fz, [(0, 0.12), (0.7, 0.12), (0.7, 0.3), (0.5, 0.42), (0.42, 0.5), (0.42, 1.1), (0.55, 1.2), (0, 1.2)], seg=16,
          rmod=lambda t: 1 + 0.05 * math.cos(t * 8))
    lathe(b, V, fx, fz, [(0, 1.15), (0.6, 1.18), (1.5, 1.42), (2.0, 1.6), (2.12, 1.72), (2.06, 1.8), (1.92, 1.74), (0, 1.62)], seg=32)
    # tier two
    lathe(b, VD, fx, fz, [(0, 1.62), (0.32, 1.62), (0.26, 1.9), (0.22, 2.5), (0.34, 2.6), (0, 2.6)], seg=12, rmod=lambda t: 1 + 0.06 * math.cos(t * 6))
    lathe(b, V, fx, fz, [(0, 2.56), (0.4, 2.6), (1.05, 2.78), (1.3, 2.9), (1.37, 2.99), (1.3, 3.04), (1.2, 2.98), (0, 2.88)], seg=28)
    # tier three
    lathe(b, VD, fx, fz, [(0, 2.88), (0.22, 2.88), (0.16, 3.1), (0.14, 3.42), (0.24, 3.5), (0, 3.5)], seg=10)
    lathe(b, V, fx, fz, [(0, 3.46), (0.25, 3.5), (0.62, 3.6), (0.75, 3.68), (0.7, 3.74), (0.6, 3.7), (0, 3.66)], seg=20)
    # the plinth and the bronze troll: robe, cape, raised lantern arm
    B = P["bronze"]
    lathe(b, VD, fx, fz, [(0, 3.66), (0.3, 3.66), (0.3, 3.86), (0.26, 3.9), (0, 3.9)], seg=8)
    lathe(b, B, fx, fz, [(0, 3.9), (0.36, 3.9), (0.33, 4.0), (0.27, 4.5), (0.24, 4.95), (0.27, 5.12), (0.22, 5.22), (0, 5.24)], seg=14,
          rmod=lambda t: 1 + 0.07 * math.sin(t * 7))
    b.lump(B, 0.62, 0.26, 0.4, fx, 4.98, fz, seed=31, rnd=0.7, jitter=0.0)                 # shoulders
    b.lump(B, 0.38, 0.4, 0.36, fx, 5.18, fz, seed=32, rnd=0.85, jitter=0.0)                # head (the JS lays the face on)
    # the face side is -x (toward the gate); a jaw that juts like the grin
    b.lump(B, 0.3, 0.14, 0.34, fx - 0.06, 5.2, fz, seed=33, rnd=0.8, jitter=0.0)
    # right arm (+z side) raised with the lantern, left on the hip
    sh = (fx, 5.1, fz + 0.27)
    el = (fx - 0.05, 5.38, fz + 0.48)
    wr = (fx - 0.08, 5.82, fz + 0.52)
    b.cyl(B, 0.075, sh, el, seg=8, r2=0.065)
    b.cyl(B, 0.065, el, wr, seg=8, r2=0.055)
    b.lump(B, 0.11, 0.12, 0.11, wr[0], wr[1] - 0.02, wr[2], seed=34, rnd=0.8, jitter=0.0)
    b.cyl(B, 0.012, (wr[0], wr[1] + 0.08, wr[2]), (wr[0], wr[1] + 0.2, wr[2]), seg=4)
    lx, ly, lz = wr[0], wr[1] - 0.28, wr[2]
    lathe(b, VD, lx, lz, [(0, ly + 0.47), (0.12, ly + 0.44), (0.1, ly + 0.4), (0, ly + 0.4)], seg=6)
    lathe(b, P["lamp"], lx, lz, [(0, ly + 0.12), (0.09, ly + 0.14), (0.1, ly + 0.36), (0.07, ly + 0.4), (0, ly + 0.4)], seg=6)
    lathe(b, VD, lx, lz, [(0, ly + 0.08), (0.1, ly + 0.08), (0.1, ly + 0.13), (0, ly + 0.13)], seg=6)
    for k in range(4):
        t = k / 4 * TAU + 0.4
        b.cyl(VD, 0.008, (lx + math.cos(t) * 0.095, ly + 0.12, lz + math.sin(t) * 0.095), (lx + math.cos(t) * 0.095, ly + 0.41, lz + math.sin(t) * 0.095), seg=3)
    b.cyl(B, 0.075, (fx, 5.1, fz - 0.27), (fx - 0.12, 4.82, fz - 0.4), seg=8, r2=0.06)
    b.cyl(B, 0.06, (fx - 0.12, 4.82, fz - 0.4), (fx - 0.02, 4.62, fz - 0.3), seg=8, r2=0.055)
    # cape, hanging off the shoulders down the back (+x side)
    b.poly(B, [(fx + 0.14, 5.08, fz - 0.32), (fx + 0.14, 5.08, fz + 0.32), (fx + 0.36, 4.0, fz + 0.4), (fx + 0.36, 4.0, fz - 0.4)], [[0, 1, 2, 3]])
    b.poly(B, [(fx + 0.12, 5.08, fz + 0.32), (fx + 0.12, 5.08, fz - 0.32), (fx + 0.33, 4.0, fz - 0.4), (fx + 0.33, 4.0, fz + 0.4)], [[0, 1, 2, 3]])
    # the vines: thick stems spiralling up out of the pool, leaves on them
    rnd = random.Random(7)
    for v in range(4):
        a0 = v / 4 * TAU + 0.3
        pts = []
        for k in range(22):
            t = k / 21
            ang = a0 + t * 2.6
            rad = 2.9 - t * 2.3 + 0.25 * math.sin(t * 9 + v)
            if t > 0.55:
                rad = 0.45 + 0.15 * math.sin(t * 7)
            yy = 0.12 + t * 3.3
            if 0.32 < t < 0.5:
                yy = 1.55 + (t - 0.32) * 2   # over the first lip
            pts.append((fx + math.cos(ang) * rad, yy, fz + math.sin(ang) * rad))
        tube(b, P["vine"], pts, 0.07 - 0.0 * v, seg=5)
        for k, p in enumerate(pts[1:-1]):
            if k % 2:
                continue
            for j in range(2):
                b.lump(P["leaf"], 0.32, 0.08, 0.24, p[0] + rnd.uniform(-0.18, 0.18), p[1] - 0.02, p[2] + rnd.uniform(-0.18, 0.18),
                       seed=rnd.randint(0, 9999), rnd=0.6, jitter=0.03, ry=rnd.uniform(0, TAU), flat_base=False)
    # autumn garlands swagged round the first bowl's lip
    cols = [P["leaf_o"], P["leaf_r"], P["leaf_y"]]
    for i in range(10):
        a = i / 10 * TAU
        c = (i + 1) / 10 * TAU
        A = (fx + math.cos(a) * 2.12, 1.76, fz + math.sin(a) * 2.12)
        C = (fx + math.cos(c) * 2.12, 1.76, fz + math.sin(c) * 2.12)
        for k, p in enumerate(catenary(A, C, 0.35, 8)):
            b.lump(cols[(i + k) % 3], 0.16, 0.14, 0.16, p[0], p[1] - 0.07, p[2], seed=i * 20 + k, rnd=0.7, jitter=0.03, ry=k)
    # the same, smaller, round the second bowl
    for i in range(7):
        a = i / 7 * TAU
        c = (i + 1) / 7 * TAU
        A = (fx + math.cos(a) * 1.37, 3.0, fz + math.sin(a) * 1.37)
        C = (fx + math.cos(c) * 1.37, 3.0, fz + math.sin(c) * 1.37)
        for k, p in enumerate(catenary(A, C, 0.2, 6)):
            b.lump(cols[(i + k) % 3], 0.12, 0.1, 0.12, p[0], p[1] - 0.05, p[2], seed=500 + i * 20 + k, rnd=0.7, jitter=0.02, ry=k)
    # pumpkins sitting in the pool among the vines (the five giants are JS)
    for i, (a, rr, sz) in enumerate([(0.6, 2.6, 0.32), (1.9, 2.75, 0.26), (2.9, 2.5, 0.36), (4.0, 2.7, 0.28), (5.2, 2.55, 0.3), (5.8, 2.85, 0.22)]):
        pumpkin(b, P["pumpkin"], fx + math.cos(a) * rr, 0.3, fz + math.sin(a) * rr, sz, ribs=9, squash=0.75, seed=40 + i, stem=P["stem"])
    b.finish("hg-fountain.glb")


# ------------------------------------------------------------ plaza furniture

def build_plaza(P):
    b = Builder()
    fx, fz = FOUNTAIN
    banner = (P["orange"], P["black"])
    for i in range(8):
        t = (i + 0.5) / 8 * TAU
        x, z = fx + math.cos(t) * 8.3, fz + math.sin(t) * 8.3
        lamp_post(b, P, x, z, banner=banner, face=t + math.pi / 2)
    for t in (math.radians(a) for a in (40, 90, 140, 220, 270, 320)):
        x, z = fx + math.cos(t) * 7.3, fz + math.sin(t) * 7.3
        # the bench faces the fountain: its front (-z before turning) toward the centre
        bench(b, P, x, z, math.atan2(math.cos(t), math.sin(t)) + math.pi)
    # a granite edging ring round the plaza's paving
    lathe(b, P["granite_dk"], fx, fz, [(PLAZA_R - 0.15, 0.0), (PLAZA_R + 0.15, 0.0), (PLAZA_R + 0.15, 0.05), (PLAZA_R - 0.15, 0.05), (PLAZA_R - 0.15, 0.0)], seg=64)
    b.finish("hg-plaza.glb")


# ------------------------------------------------------------ the wheel's base

def build_wheel(P):
    b = Builder()
    fx, fz, r, hub = FERRIS
    S, SD = P["steel"], P["steel_dk"]
    # the A-frames: four legs, cross braces, concrete feet
    for s in (-1, 1):
        for dz in (-5, 5):
            foot = (fx + s * 1.6, 0.0, fz + dz)
            top = (fx + s * 0.7, hub, fz)
            b.cyl(S, 0.17, foot, top, seg=10)
            b.box(P["granite_dk"], 0.8, 0.35, 0.8, foot[0], 0, foot[2])
        for k in range(1, 5):
            t = k / 5.5
            y = hub * t
            xa = fx + s * (1.6 - 0.9 * t)
            za, zb = fz - 5 * (1 - t), fz + 5 * (1 - t)
            b.cyl(SD, 0.06, (xa, y, za), (xa, y, zb), seg=6)
            if k < 4:
                t2 = (k + 1) / 5.5
                y2, xb = hub * t2, fx + s * (1.6 - 0.9 * t2)
                b.cyl(SD, 0.045, (xa, y, za), (xb, y2, fz + 5 * (1 - t2)), seg=5)
                b.cyl(SD, 0.045, (xa, y, zb), (xb, y2, fz - 5 * (1 - t2)), seg=5)
    b.cyl(S, 0.32, (fx - 1.0, hub, fz), (fx + 1.0, hub, fz), seg=14)
    for s in (-1, 1):
        b.cyl(P["red"], 0.5, (fx + s * 0.75, hub, fz), (fx + s * 0.95, hub, fz), seg=16)
    # the motor house under the hub on the east side
    b.box(P["green"], 1.6, 1.4, 2.0, fx + 2.6, 0, fz)
    b.box(P["black"], 1.8, 0.12, 2.2, fx + 2.6, 1.4, fz)
    # the boarding deck: planks on a steel frame, a rail on three sides
    B = BOARDING
    b.box(SD, B["x1"] - B["x0"], B["y"] - 0.12, B["z1"] - B["z0"], (B["x0"] + B["x1"]) / 2, 0, (B["z0"] + B["z1"]) / 2)
    b.box(P["deck"], B["x1"] - B["x0"] + 0.1, 0.12, B["z1"] - B["z0"] + 0.1, (B["x0"] + B["x1"]) / 2, B["y"] - 0.12, (B["z0"] + B["z1"]) / 2)
    for k in range(2):
        b.box(P["plank"], 0.6, 0.2 * (k + 1), 2.2, B["x0"] - 0.3 - 0.6 * (1 - k), 0, 3.1)   # clear of the stair foot
    for zz in (B["z0"] + 0.05, B["z1"] - 0.05):
        b.box(P["yellow"], B["x1"] - B["x0"] - 1.2, 0.05, 0.05, (B["x0"] + B["x1"]) / 2 + 0.6, B["y"] + 0.95, zz)
        for xx in (B["x0"] + 1.2, (B["x0"] + B["x1"]) / 2 + 0.6, B["x1"] - 0.05):
            b.box(P["yellow"], 0.06, 1.0, 0.06, xx, B["y"], zz)
    b.box(P["yellow"], 0.06, 0.05, B["z1"] - B["z0"], B["x1"] - 0.05, B["y"] + 0.95, (B["z0"] + B["z1"]) / 2)
    # the stair to the lamp deck: steel stringers, plank treads, a hand rail,
    # lattice under it (the collider is solid down to the ground)
    st = WHEEL_STAIR
    sx = (st["x0"] + st["x1"]) / 2
    w = st["x1"] - st["x0"]
    for i in range(st["steps"]):
        top = st["rise"] * (i + 1)
        zc = st["z_foot"] - st["run"] * (i + 0.5)
        b.box(P["plank"], w - 0.08, 0.06, st["run"] + 0.02, sx, top - 0.06, zc)
        b.box(SD, w - 0.08, st["rise"] - 0.06, 0.03, sx, top - st["rise"], zc + st["run"] / 2 - 0.02)
    z_top = st["z_foot"] - st["run"] * st["steps"]
    y_top = st["rise"] * st["steps"]
    for xx in (st["x0"] + 0.03, st["x1"] - 0.03):
        b.bar(S, (xx, -0.1, st["z_foot"] + 0.1), (xx, y_top - 0.05, z_top), 0.06, 0.3)
        b.bar(S, (xx, 1.0, st["z_foot"]), (xx, y_top + 1.0, z_top), 0.04)
        for k in range(0, st["steps"] + 1, 4):
            yy = st["rise"] * k
            zz = st["z_foot"] - st["run"] * k
            b.box(S, 0.04, 1.0, 0.04, xx, yy, zz)
    # lattice skirting under the flight (both sides), in diamonds
    for xx in (st["x0"] + 0.01, st["x1"] - 0.01):
        for k in range(12):
            za = st["z_foot"] - k * 0.5
            b.bar(P["cream"], (xx, 0.0, za), (xx, min(y_top, (st["z_foot"] - (za - 1.2)) / st["run"] * st["rise"]) - 0.2, za - 1.2), 0.03, 0.06)
            b.bar(P["cream"], (xx, 0.0, za - 1.2), (xx, min(y_top, (st["z_foot"] - za) / st["run"] * st["rise"]) - 0.2, za), 0.03, 0.06)
    # the lamp deck: steel posts, planks, a rail, two flood lamps on a mast
    D = WHEEL_DECK
    dcx, dcz = (D["x0"] + D["x1"]) / 2, (D["z0"] + D["z1"]) / 2
    dw, dd = D["x1"] - D["x0"], D["z1"] - D["z0"]
    for xx in (D["x0"] + 0.15, D["x1"] - 0.15):
        for zz in (D["z0"] + 0.15, D["z1"] - 0.15):
            b.box(S, 0.22, D["y"] - 0.25, 0.22, xx, 0, zz)
    for xx in (D["x0"] + 0.15, D["x1"] - 0.15):
        b.bar(SD, (xx, 0.4, D["z0"] + 0.15), (xx, D["y"] - 0.4, D["z1"] - 0.15), 0.07)
        b.bar(SD, (xx, 0.4, D["z1"] - 0.15), (xx, D["y"] - 0.4, D["z0"] + 0.15), 0.07)
    b.box(SD, dw, 0.18, dd, dcx, D["y"] - 0.25, dcz)
    b.box(P["deck"], dw + 0.05, 0.07, dd + 0.05, dcx, D["y"] - 0.07, dcz)
    rails = [((D["x0"], D["z0"]), (D["x1"], D["z0"])), ((D["x0"], D["z0"]), (D["x0"], D["z1"])),
             ((D["x1"], D["z0"]), (D["x1"], D["z1"])), ((D["x0"], D["z1"]), (st["x0"], D["z1"]))]
    for (ax, az), (bx, bz) in rails:
        L = math.hypot(bx - ax, bz - az)
        n = max(1, round(L / 1.0))
        for k in range(n + 1):
            px, pz = ax + (bx - ax) * k / n, az + (bz - az) * k / n
            b.box(P["yellow"], 0.06, 1.05, 0.06, px, D["y"], pz)
        for yy in (0.5, 1.02):
            b.bar(P["yellow"], (ax, D["y"] + yy, az), (bx, D["y"] + yy, bz), 0.05)
        b.bar(P["yellow"], (ax, D["y"] + 0.05, az), (bx, D["y"] + 0.05, bz), 0.02, 0.12)
    mx, mz = D["x1"] - 0.35, D["z0"] + 0.35
    b.cyl(S, 0.07, (mx, D["y"], mz), (mx, D["y"] + 3.2, mz), seg=8)
    b.bar(S, (mx - 0.5, D["y"] + 3.2, mz), (mx + 0.5, D["y"] + 3.2, mz), 0.05)
    for s in (-1, 1):
        lx = mx + 0.45 * s
        b.box(P["black"], 0.36, 0.32, 0.26, lx, D["y"] + 3.0, mz + 0.12, rx=0.5)
        b.box(P["lamp"], 0.3, 0.26, 0.02, lx, D["y"] + 3.06, mz + 0.27, rx=0.5)
    # the operator's shack under the deck: plank walls, a lit window, a door
    H = SHACK
    hx, hz = (H["x0"] + H["x1"]) / 2, (H["z0"] + H["z1"]) / 2
    hw, hd = H["x1"] - H["x0"], H["z1"] - H["z0"]
    b.box(P["green"], hw, H["h"], hd, hx, 0, hz)
    b.box(P["cream"], hw + 0.1, 0.1, hd + 0.1, hx, H["h"] - 0.1, hz)
    b.box(P["black"], hw + 0.3, 0.12, hd + 0.4, hx, H["h"], hz)
    # boxed in with lattice from its roof up to the deck (the collider is solid)
    y0, y1 = H["h"] + 0.12, D["y"] - 0.25
    for (ax, az, bx, bz) in ((H["x0"], H["z0"], H["x1"], H["z0"]), (H["x0"], H["z1"], H["x1"], H["z1"]),
                             (H["x0"], H["z0"], H["x0"], H["z1"]), (H["x1"], H["z0"], H["x1"], H["z1"])):
        L = math.hypot(bx - ax, bz - az)
        n = max(2, round(L / 0.5))
        ux, uz = (bx - ax) / L, (bz - az) / L
        b.bar(P["cream"], (ax, y0, az), (bx, y0, bz), 0.08)
        b.bar(P["cream"], (ax, y1 - 0.04, az), (bx, y1 - 0.04, bz), 0.08)
        for k in range(n):
            p0 = (ax + ux * L * k / n, az + uz * L * k / n)
            p1 = (ax + ux * L * (k + 1) / n, az + uz * L * (k + 1) / n)
            b.bar(P["cream"], (p0[0], y0, p0[1]), (p1[0], y1, p1[1]), 0.03, 0.05)
            b.bar(P["cream"], (p1[0], y0, p1[1]), (p0[0], y1, p0[1]), 0.03, 0.05)
    b.box(P["warm"], 1.1, 0.7, 0.02, hx - 0.3, 1.2, H["z1"] + 0.01)
    b.box(P["cream"], 1.25, 0.08, 0.06, hx - 0.3, 1.15, H["z1"] + 0.03)
    b.box(P["cream"], 1.25, 0.06, 0.05, hx - 0.3, 1.9, H["z1"] + 0.03)
    b.box(P["wood_dk"], 0.02, 2.0, 0.85, H["x0"] - 0.01, 0, hz)
    b.box(P["brass"], 0.04, 0.05, 0.05, H["x0"] - 0.03, 1.0, hz + 0.3)
    # the control desk at the window and the big lever
    b.box(SD, 0.6, 1.0, 0.4, hx + 0.2, 0, H["z1"] + 0.25)
    b.cyl(P["red"], 0.025, (hx + 0.1, 1.0, H["z1"] + 0.25), (hx + 0.0, 1.4, H["z1"] + 0.3), seg=5)
    b.cyl(P["red"], 0.05, (hx + 0.0, 1.4, H["z1"] + 0.3), (hx + 0.0, 1.46, H["z1"] + 0.3), seg=8)
    # the ticket podium
    px, pz = PODIUM
    b.box(P["red"], 0.9, 1.05, 0.7, px, 0, pz, bevel=0.02)
    b.box(P["gold"], 1.0, 0.06, 0.8, px, 1.05, pz)
    b.box(P["cream"], 0.06, 1.6, 0.06, px + 0.4, 1.1, pz - 0.3)
    b.finish("hg-wheelbase.glb")


# ------------------------------------------------------------ the stalls

def awning(b, P, x0, x1, z, y_back, y_front, depth, cols):
    """A striped awning running x0..x1, sloping from y_back at z to y_front
    `depth` metres forward (+z), with a scalloped valance."""
    n = max(4, round((x1 - x0) / 0.36))
    w = (x1 - x0) / n
    ang = math.atan2(y_back - y_front, depth)
    L = math.hypot(depth, y_back - y_front)
    for k in range(n):
        x = x0 + w * (k + 0.5)
        b.box(cols[k % 2], w + 0.002, 0.03, L, x, (y_back + y_front) / 2 - 0.015, z + depth / 2, rx=ang)
        b.box(cols[k % 2], w + 0.002, 0.24, 0.02, x, y_front - 0.24, z + depth)
        b.cyl(cols[k % 2], w / 2, (x, y_front - 0.24, z + depth - 0.012), (x, y_front - 0.24, z + depth + 0.012), seg=10)


def build_stalls(P):
    b = Builder()
    zb, zf = STALL_Z
    looks = [
        ("red", "cream"),      # Balloon Pop
        ("teal", "cream"),     # Shooting Gallery
        ("green", "yellow"),   # Hook-a-Pepe
        ("pink", "white"),     # Cotton Candy
        ("orange", "black"),   # Corn Dogs
    ]
    for i, (x0, x1) in enumerate(STALLS):
        cx, w = (x0 + x1) / 2, x1 - x0
        ca, cb = P[looks[i][0]], P[looks[i][1]]
        # back wall and partitions: planks inside, painted boards outside
        b.box(P["plank"], w, 3.0, 0.2, cx, 0, zb + 0.1)
        b.box(ca, w + 0.02, 0.5, 0.22, cx, 2.5, zb + 0.1)
        for xx in (x0 + 0.1, x1 - 0.1):
            b.box(P["plank"], 0.2, 2.9, zf - zb, xx, 0, (zb + zf) / 2)
            b.box(P["wood_dk"], 0.24, 0.12, zf - zb + 0.04, xx, 2.9, (zb + zf) / 2)
        # the counter, with a gap (the flap) at the east end
        gap = 0.8
        cw = w - 0.2 - gap
        ccx = x0 + 0.1 + cw / 2
        b.box(ca, cw, 0.95, 0.5, ccx, 0, zf - 0.25)
        b.box(P["wood"], cw + 0.06, 0.08, 0.6, ccx, 0.95, zf - 0.22)
        for k in range(int(cw / 0.5)):
            b.box(cb, 0.18, 0.7, 0.02, x0 + 0.35 + k * 0.5, 0.12, zf + 0.005)
        # front posts and fascia board for the sign
        for xx in (x0 + 0.1, x1 - 0.1):
            b.box(P["wood_dk"], 0.14, 3.2, 0.14, xx, 0, zf - 0.07)
        b.box(P["wood_dk"], w, 0.7, 0.08, cx, 2.95, zf - 0.04)
        b.box(cb, w + 0.06, 0.06, 0.12, cx, 3.65, zf - 0.04)
        b.box(cb, w + 0.06, 0.06, 0.12, cx, 2.92, zf - 0.04)
        # roof and the striped awning out front
        b.box(P["black"], w + 0.2, 0.1, zf - zb + 0.2, cx, 3.0, (zb + zf) / 2)
        awning(b, P, x0, x1, zf, 2.85, 2.45, 1.0, (ca, cb))
        # the prize shelf on the back wall
        b.box(P["wood"], w - 0.4, 0.05, 0.3, cx, 2.15, zb + 0.35)
    # 1: Balloon Pop — a cork board of balloons
    x0, x1 = STALLS[0]
    cx = (x0 + x1) / 2
    b.box(P["wood_dk"], 2.8, 1.5, 0.05, cx, 0.7, zb + 0.22)
    cols = [P["red"], P["yellow"], P["blue"], P["purple"], P["green"], P["orange"]]
    rnd = random.Random(3)
    for r_ in range(4):
        for c in range(7):
            if rnd.random() < 0.12:
                continue
            bx = cx - 1.2 + c * 0.4 + (0.2 if r_ % 2 else 0)
            if bx > cx + 1.3:
                continue
            b.lump(cols[(r_ * 7 + c) % 6], 0.24, 0.3, 0.2, bx, 0.8 + r_ * 0.34, zb + 0.32, seed=r_ * 10 + c, rnd=0.9, jitter=0.0, flat_base=False)
    # 2: Shooting Gallery — the target board, rails and a row of tin ducks' rail
    x0, x1 = STALLS[1]
    cx = (x0 + x1) / 2
    b.box(P["teal"], 3.0, 1.9, 0.05, cx, 0.5, zb + 0.22)
    for yy in (1.2, 1.72):
        b.box(P["brass"], 3.0, 0.04, 0.06, cx, yy, zb + 0.5)
    for k in range(6):
        b.cyl(P["cream"], 0.16, (cx - 1.25 + k * 0.5, 2.3, zb + 0.26), (cx - 1.25 + k * 0.5, 2.3, zb + 0.28), seg=12)
        b.cyl(P["red"], 0.1, (cx - 1.25 + k * 0.5, 2.3, zb + 0.28), (cx - 1.25 + k * 0.5, 2.3, zb + 0.29), seg=12)
    for k in range(3):
        rx = cx - 0.9 + k * 0.9
        b.bar(P["wood_dk"], (rx, 1.02, zf - 0.28), (rx + 0.1, 1.06, zf - 0.6), 0.05, 0.06)
        b.cyl(P["steel_dk"], 0.015, (rx + 0.1, 1.08, zf - 0.6), (rx + 0.12, 1.1, zf - 0.95), seg=6)
    # 3: Hook-a-Pepe — a water trough of little green frogs
    x0, x1 = STALLS[2]
    cx = (x0 + x1) / 2
    b.box(P["blue"], 2.6, 0.75, 1.0, cx - 0.2, 0, (zb + zf) / 2 + 0.2)
    b.box(P["teal"], 2.5, 0.02, 0.9, cx - 0.2, 0.7, (zb + zf) / 2 + 0.2)
    for k in range(10):
        px = cx - 1.3 + (k % 5) * 0.5 + rnd.uniform(-0.1, 0.1)
        pz = (zb + zf) / 2 - 0.05 + (k // 5) * 0.45 + rnd.uniform(-0.05, 0.05)
        b.lump(P["green"], 0.2, 0.14, 0.18, px, 0.68, pz, seed=60 + k, rnd=0.9, jitter=0.0)
        for s in (-1, 1):
            b.cyl(P["white"], 0.03, (px + 0.06, 0.82, pz + s * 0.04), (px + 0.08, 0.83, pz + s * 0.04), seg=6)
    for k in range(3):
        rx = cx - 1.0 + k * 0.8
        b.cyl(P["wood"], 0.012, (rx, 0.98, zf - 0.3), (rx, 2.1, zf - 0.35), seg=4)
    # 4: Cotton Candy — the spinning bowl and a rack of pink clouds
    x0, x1 = STALLS[3]
    cx = (x0 + x1) / 2
    b.box(P["steel_dk"], 0.9, 0.85, 0.7, cx, 0, (zb + zf) / 2)
    lathe(b, P["steel"], cx, (zb + zf) / 2, [(0.0, 0.85), (0.38, 0.85), (0.45, 1.12), (0.42, 1.14), (0.35, 0.9), (0.0, 0.9)], seg=16)
    b.lump(P["pink"], 0.5, 0.3, 0.5, cx, 0.95, (zb + zf) / 2, seed=70, rnd=1.0, jitter=0.03)
    for k in range(6):
        px = x0 + 0.5 + k * 0.48
        b.cyl(P["white"], 0.012, (px, 1.6, zb + 0.4), (px, 1.95, zb + 0.4), seg=4)
        b.lump(P["pink"] if k % 2 else P["blue"], 0.24, 0.3, 0.24, px, 1.92, zb + 0.4, seed=71 + k, rnd=1.0, jitter=0.03, flat_base=False)
    # 5: Corn Dogs — a fryer, a hood, a stand of corn dogs
    x0, x1 = STALLS[4]
    cx = (x0 + x1) / 2
    b.box(P["steel"], 1.4, 0.95, 0.7, cx - 0.5, 0, zb + 0.55)
    b.box(P["black"], 1.2, 0.04, 0.5, cx - 0.5, 0.95, zb + 0.55)
    b.frustum(P["steel_dk"], 1.6, 0.9, 0.6, 0.4, 2.0, 2.6, cx - 0.5, zb + 0.6)
    b.box(P["steel_dk"], 0.3, 0.4, 0.3, cx - 0.5, 2.6, zb + 0.6)
    b.box(P["wood"], 0.6, 0.3, 0.3, cx + 0.9, 0.95, zf - 0.3)
    for k in range(8):
        px = cx + 0.7 + (k % 4) * 0.12
        pz = zf - 0.36 + (k // 4) * 0.12
        b.cyl(P["cream"], 0.006, (px, 1.25, pz), (px, 1.45, pz), seg=3)
        b.lump(P["leaf_y"], 0.06, 0.2, 0.06, px, 1.42, pz, seed=80 + k, rnd=0.9, jitter=0.0)
    b.finish("hg-stalls.glb")


BUILDS = {"carousel": build_carousel, "ride": build_ride, "horse": build_horse, "fountain": build_fountain,
          "plaza": build_plaza, "wheel": build_wheel, "stalls": build_stalls}
FILES = {"carousel": "hg-carousel.glb", "ride": "hg-carousel-ride.glb", "horse": "hg-horse.glb",
         "fountain": "hg-fountain.glb", "plaza": "hg-plaza.glb", "wheel": "hg-wheelbase.glb", "stalls": "hg-stalls.glb"}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    names = argv or list(BUILDS)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    P = palette()
    P.update(gf_palette())
    import quantize_glb
    for n in names:
        BUILDS[n](P)
        quantize_glb.main([os.path.join(OUT_DIR, FILES[n])])


main()
