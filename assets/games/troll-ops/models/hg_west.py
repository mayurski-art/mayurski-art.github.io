"""
Hollowgrin's west edge (phase 2 of "Troll Forces: Hollowgrin in Blender"):
hg-west.glb, in map coordinates.

The west loop (the doc's decision 7, the one approved layout change): a
gravel path from the graveyard's west gate north past the chapel to the
witch's hollow and south to the covered bridge, knee-high stone walls
along it with gaps, a lychgate on the churchyard's approach, two clusters
of chest tombs as cover (north of the chapel, in the churchyard). Their
colliders are hollowgrin.js's (WEST_LOOP there), as every collider is.

The witch's hollow: the crooked hut (board walls, a thatch, a chimney, the
door frames), its shelves, table, the cauldron on its tripod over the fire,
a broom, herb bundles, a spell book on a stump, bones, the toadstool ring,
the pond's stones and reeds, the dead trees. The creek: stones and reeds
along both banks, a broken rowing boat, a fishing rod on the bank. The
covered bridge: the deck's boards, the steps, the barn-red board walls
with their windows, the shingled roof.

Drawn over the colliders hollowgrin.js lays. The JS keeps the water, the
mud, the lily pads, Pepe, the jars' glow, the brew, the flames, the glows,
the signs, the troll under the bridge, the lantern, the fireflies and the
mist. The pond's stones, the logs, the toadstools and the creek's stones
come from the JS's random streams (hg_kit.js_rng), the calls in order.
"""
import math
import random

from map_kit import TEXTURED, mat
from hg_kit import HGBuilder, Wall, dead_tree, facing, fbox, js_rng, lathe, pumpkin, ring, skin, slab, slates

TEXTURED.update({"HG_Granite", "HG_GraniteDark", "HG_BarnRed", "HG_BarnWood"})

# the loop (hollowgrin.js WEST_LOOP: the same numbers)
PATH_X = -37.4
WALLS = [          # (z0, z1) runs of the low wall, west of the path at x -38.75
    (-16.0, -11.5), (-10.0, -5.0), (11.0, 13.0), (14.0, 19.0), (20.5, 25.0), (26.5, 28.8)]
WALL_X, WALL_H, WALL_T = -38.75, 0.6, 0.35
EAST_WALLS = [(-16.0, -12.0), (14.5, 19.5), (22.0, 27.0)]     # a few on the east side too, at x -36.05
EAST_X = -36.05
LYCH = {"z": 9.5, "x0": -38.7, "x1": -36.1}
TOMBS = [(-46.5, 17.5, 0.1), (-43.0, 18.6, -0.15), (-45.2, -8.4, 0.2), (-41.4, -9.6, -0.1)]   # x, z, ry
# the hollow (hollowgrin.js)
HUT = (-47.5, -42.0, -42.5, -37.5, 2.8, 0.25)     # x0, x1, z0, z1, h, t
CAULDRON = (-40.5, -33.5)
FAIRY = (-36.5, -40.0)
POND = (-46.0, -20.0, 5.2, 4.2)
DEAD_TREES = [(-49, -30, 4001), (-38.4, -26.5, 4002), (-49.2, -43.2, 4003), (-33.5, -33, 4004)]
# the creek (CREEK, CREEK_W, BRIDGE)
CREEK = [(-54, 18.5), (-49, 21.5), (-44.5, 25.5), (-40.6, 30), (-37.8, 34.5), (-37, 39), (-36.4, 48)]
CREEK_W = 3.4
BRIDGE = (-40.4, -34.4, 33.2, 36.8, 0.54)       # x0, x1, z0, z1, deck


def palette():
    return {
        "granite": mat("HG_Granite", 0x8c8c94, 0.9),
        "granite_dk": mat("HG_GraniteDark", 0x5a5a62, 0.9),
        "wallstone": mat("HG_FieldStone", 0x6a6660, 0.95),
        "wallstone2": mat("HG_FieldStone2", 0x55524c, 0.95),
        "moss": mat("HG_Moss", 0x3a4a2c, 0.95),
        "lichen": mat("HG_Lichen", 0x8a9a5a, 0.95),
        "oak_dk": mat("HG_OakDark", 0x34221a, 0.55),
        "shingle": mat("HG_WellShingle", 0x4a3a30, 0.85),
        "shingle2": mat("HG_WellShingle2", 0x3e3028, 0.85),
        "iron": mat("HG_Iron", 0x1c1c22, 0.55, 0.3),
        "rust": mat("HG_Rust", 0x4a2e1c, 0.9),
        "witch": mat("HG_WitchWood", 0x3a3026, 0.9),
        "witch_lt": mat("HG_WitchWoodLight", 0x4e4234, 0.9),
        "thatch": mat("HG_Thatch", 0x8a7a50, 1.0),
        "thatch_dk": mat("HG_ThatchDark", 0x6a5c3c, 1.0),
        "brick": mat("HG_Brick", 0x8a4a3a, 0.9),
        "shelf": mat("HG_MarketWood", 0x6a4a30, 0.8),
        "glass": mat("HG_GlassDark", 0x1a2028, 0.1),
        "cork": mat("HG_Cork", 0x7a5a3a, 0.9),
        "herb": mat("HG_Herb", 0x4a5a2c, 1.0),
        "twine": mat("HG_Twine", 0x6a5434, 1.0),
        "leather": mat("HG_Leather", 0x4a2a1c, 0.7),
        "paper": mat("HG_NoticePaper", 0xc8bfa4, 0.9),
        "bone": mat("HG_Bone", 0xd8d0b8, 0.7),
        "straw": mat("HG_Hay", 0xb89a50, 1.0),
        "toad": mat("HG_ToadCap", 0xc0283a, 0.5, emit=0x3a0610, emit_strength=0.6),
        "toad_stem": mat("HG_ToadStem", 0xd8d2c4, 0.8),
        "stone_dk": mat("HG_StoneDark", 0x55545c, 0.9),
        "reed": mat("HG_Reed", 0x4a4a22, 0.9),
        "mud": mat("HG_Mud", 0x3a2e24, 1.0),
        "bark": mat("HG_OakBark", 0x2e2620, 0.95),
        "bark_lt": mat("HG_OakBarkLight", 0x3e342c, 0.95),
        "barn": mat("HG_BarnRed", 0xc8382c, 0.85),
        "barnwood": mat("HG_BarnWood", 0x8a6a48, 0.85),
        "trim": mat("HG_TrimWhite", 0xd9d2c2, 0.75),
        "deck": mat("HG_Floorboards", 0x6a4a30, 0.8),
        "boat": mat("HG_BoatWood", 0x5a4a3a, 0.9),
        "rope": mat("HG_Rope", 0x9a8458, 1.0),
    }


def box2(b, m, x0, x1, y0, y1, z0, z1, **kw):
    b.box(m, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2, **kw)


# ------------------------------------------------------------------ the loop

def drystone(b, P, R, pid, x, z0, z1, h=WALL_H, t=WALL_T, seed=1):
    """A dry-stone wall along z: courses of field stones, uneven, a few
    fallen, moss in the joints, coping stones set on edge."""
    rnd = random.Random(seed)
    R.begin(b, pid)
    y = 0.0
    k = 0
    while y < h - 0.12:
        # a course: stones of their own length, each a little proud or shy
        # of the line (only the faces that show: both sides, the run's ends,
        # the top of the last course under the coping)
        ch = min(rnd.uniform(0.12, 0.17), h - 0.12 - y + 0.06)
        top = y + ch >= h - 0.12
        z = z0
        first = (z1 - z0) * rnd.uniform(0.05, 0.12) if k % 2 else 0.0
        while z < z1 - 0.01:
            ln = min(z1 - z, first or rnd.uniform(0.4, 0.85))
            first = 0.0
            m = P["wallstone"] if rnd.random() < 0.6 else P["wallstone2"]
            hw = t / 2 - rnd.uniform(0.0, 0.03)
            xo = rnd.uniform(-0.015, 0.015)
            sides = "+x -x" + (" +y" if top else "") + (" -z" if z <= z0 + 1e-6 else "") + (" +z" if z + ln >= z1 - 1e-6 else "")
            fbox(b, m, x + xo - hw, x + xo + hw, y, y + ch, z, z + ln, sides)
            if rnd.random() < 0.22:                  # moss in the joint, a patch on the face
                s = rnd.choice((-1, 1))
                mx, mz, mw = x + xo + s * (hw + 0.004), z + ln * rnd.uniform(0.2, 0.8), rnd.uniform(0.08, 0.2)
                facing(b, P["moss"], [(mx, y - 0.02, mz - mw / 2), (mx, y - 0.02, mz + mw / 2), (mx, y + 0.05, mz + mw / 2), (mx, y + 0.05, mz - mw / 2)], (s, 0, 0))
            z += ln
        y += ch
        k += 1
    # coping: stones on edge along the top
    z = z0 + 0.05
    while z < z1 - 0.1:
        b.box(P["wallstone2"], t * 0.7, 0.16, 0.13, x, y - 0.02, z + 0.065, rz=rnd.uniform(-0.1, 0.1))
        z += 0.19
    # a stone or two fallen beside it
    if rnd.random() < 0.6:
        # (always to the west: the field side of the west walls, the path side
        # of the east ones, clear of the graveyard fence)
        b.box(P["wallstone"], 0.2, 0.12, 0.3, x - 0.45, 0.0, rnd.uniform(z0, z1), ry=rnd.uniform(0, 1), rz=0.3)
    R.end()


def lychgate(b, P, R):
    """A lychgate over the path on the churchyard's approach: oak posts on
    stone plinths, braces, a little shingled gable, its ridge along the
    path's line (the colliders: the four posts)."""
    z, x0, x1 = LYCH["z"], LYCH["x0"], LYCH["x1"]
    R.begin(b, "west:lychgate")
    for x in (x0, x1):
        for dz in (-0.8, 0.8):
            b.box(P["granite_dk"], 0.4, 0.3, 0.4, x, 0, z + dz, bevel=0.02)
            b.box(P["oak_dk"], 0.22, 2.3, 0.22, x, 0.3, z + dz)
            for s in (-1, 1):   # knee braces up to the tie beams
                b.box(P["oak_dk"], 0.08, 0.7, 0.08, x, 2.0, z + dz + s * 0.3, rx=-s * 0.7)
        box2(b, P["oak_dk"], x - 0.12, x + 0.12, 2.6, 2.8, z - 1.0, z + 1.0)      # the plate, along the path
    for dz in (-0.8, 0.8):                                                        # tie beams across the path
        box2(b, P["oak_dk"], x0 - 0.1, x1 + 0.1, 2.5, 2.7, z + dz - 0.1, z + dz + 0.1)
    # the roof: ridge along z, slopes east and west, shingles
    S = [P["shingle"], P["shingle2"], P["shingle"]]
    xm = (x0 + x1) / 2
    for s in (-1, 1):
        slates(b, S, "z", z - 1.3, z + 1.3, (xm + s * 1.6, 2.8), (xm, 3.7), seed=50 + s, course=0.18, deck=0.06)
    b.cyl(P["oak_dk"], 0.05, (xm, 3.72, z - 1.35), (xm, 3.72, z + 1.35), seg=6)
    for dz in (-1.3, 1.3):
        b.prism(P["witch_lt"], [(xm - 1.6, 2.77), (xm + 1.6, 2.77), (xm, 3.68)], z + dz - 0.03, z + dz + 0.03, axis="z")
    # a coffin rest: the stone slab across the middle, waist high, between the posts on the west side
    box2(b, P["granite"], x0 + 0.2, x0 + 0.7, 0.0, 0.75, z - 0.6, z + 0.6)
    box2(b, P["granite_dk"], x0 + 0.15, x0 + 0.75, 0.75, 0.83, z - 0.68, z + 0.68, bevel=0.01)
    R.end()


def tomb(b, P, R, x, z, ry, i):
    """A chest tomb: a stepped base, panelled sides, a ledger stone on
    top, moss and a skull in a corner (2.2 x 1.0 x 1.2, its collider)."""
    R.begin(b, f"west:tomb-{i}")
    b.box(P["granite_dk"], 2.2, 0.14, 1.0, x, 0, z, ry=ry)
    b.box(P["granite"], 1.95, 0.9, 0.78, x, 0.14, z, ry=ry)
    c, s = math.cos(ry), math.sin(ry)
    for sd in (-1, 1):                               # the side panels, sunk
        for k in range(3):
            u = -0.6 + k * 0.6
            px, pz = x + u * c + sd * 0.4 * s, z - u * s + sd * 0.4 * c
            b.box(P["granite_dk"], 0.44, 0.52, 0.03, px, 0.3, pz, ry=ry)
        px, pz = x + (sd * 0.99) * c, z - (sd * 0.99) * s
        b.box(P["granite_dk"], 0.03, 0.52, 0.5, px, 0.3, pz, ry=ry)
    b.box(P["granite"], 2.15, 0.16, 0.95, x, 1.04, z, ry=ry, bevel=0.02)
    b.lump(P["moss"], 0.5, 0.04, 0.3, x + 0.6 * c, 1.2, z - 0.6 * s, seed=i, rnd=0.7, jitter=0.01, ry=ry, n=2)
    if i % 2:
        b.lump(P["bone"], 0.15, 0.14, 0.17, x - 0.8 * c + 0.3 * s, 1.2, z + 0.8 * s + 0.3 * c, seed=i + 5, rnd=0.75, jitter=0.01, n=2)
    R.end()


def loop(b, P, R):
    for i, (z0, z1) in enumerate(WALLS):
        drystone(b, P, R, f"west:wall-{i}", WALL_X, z0, z1, seed=100 + i)
    for i, (z0, z1) in enumerate(EAST_WALLS):
        drystone(b, P, R, f"west:wall-e{i}", EAST_X, z0, z1, seed=120 + i)
    lychgate(b, P, R)
    for i, (x, z, ry) in enumerate(TOMBS):
        tomb(b, P, R, x, z, ry, i)


# ------------------------------------------------------------------ the hollow

def hut(b, P, R, J):
    x0, x1, z0, z1, h, t = HUT
    R.begin(b, "west:hut")
    # the walls as the JS lays them (hollowgrin.js: the hut), boarded
    # vertically outside, crooked; the openings framed in rough oak
    holes = {
        ("x", z0 + t / 2): ([{"c": -45.5, "w": 0.8, "spans": [(1.0, 1.8)]}], -1, x0, x1),
        ("x", z1 - t / 2): ([{"c": -44.6, "w": 1.2, "spans": [(0, 2.1)]}, {"c": -46.6, "w": 0.8, "spans": [(1.0, 1.8)]}], 1, x0, x1),
        ("z", x0 + t / 2): ([{"c": -40, "w": 0.8, "spans": [(1.0, 1.8)]}], -1, z0 + t, z1 - t),
        ("z", x1 - t / 2): ([{"c": -41.4, "w": 1.2, "spans": [(0, 2.1)]}], 1, z0 + t, z1 - t),
    }
    rnd = random.Random(42)
    for (axis, at), (hs, out, a, b_) in holes.items():
        w = Wall(axis, at, a, b_, h, t, holes=hs, out=out)
        w.solid(b, P["witch"])
        # boards outside, each its own width and a touch askew; wattle-ish inside
        s = a
        while s < b_ - 0.02:
            bw = rnd.uniform(0.14, 0.26)
            e = min(b_, s + bw)
            for lo, hi in __import__("hg_kit").heights_free((s + e) / 2, h, hs):
                if hi - lo > 0.05:
                    w.slab(b, P["witch_lt"] if rnd.random() < 0.3 else P["witch"], s + 0.01, e - 0.01, lo, hi - rnd.uniform(0.0, 0.08), w.face(0.02), 0.04)
            s = e
        w.casings(b, P["witch_lt"], fw=0.1, proud=0.05, sill=True)
    # the thatch: a four-sided cap, layers of straw stepping down, ragged at the eaves
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    base, top, hh = 4.3, 0.35, 3.2
    for k in range(7):
        f0, f1 = k / 7, (k + 1) / 7
        r0, r1 = base * (1 - f0) + top * f0, base * (1 - f1) + top * f1
        y0, y1 = h + hh * f0, h + hh * f1
        m = P["thatch"] if k % 2 else P["thatch_dk"]
        lathe(b, m, cx, cz, [(r0 + 0.12, y0 - 0.12), (r0 + 0.18, y0), (r1 + 0.1, y1)], seg=4, y0=0.0, caps=False)
    lathe(b, P["thatch_dk"], cx, cz, [(top + 0.2, h + hh - 0.1), (0.15, h + hh + 0.25), (0.002, h + hh + 0.3)], seg=4, caps=False)
    for i in range(40):                              # straws hanging off the eaves
        a = rnd.uniform(0, 2 * math.pi)
        r = base + 0.1
        px, pz = cx + math.cos(a) * r, cz + math.sin(a) * r
        b.box(P["straw"], 0.02, rnd.uniform(0.1, 0.3), 0.02, px, h - rnd.uniform(0.15, 0.35), pz, rx=rnd.uniform(-0.3, 0.3), rz=rnd.uniform(-0.3, 0.3))
    # the chimney, leaning, with a pot
    b.box(P["brick"], 0.5, 2.6, 0.4, -43, h, -41.6, rz=-0.1)
    b.box(P["stone_dk"], 0.6, 0.12, 0.5, -43.1, h + 2.55, -41.6)
    lathe(b, P["brick"], -43.12, -41.6, [(0.12, 0), (0.1, 0.25), (0.13, 0.3), (0.0, 0.3)], seg=8, y0=h + 2.67)
    R.end()
    # inside: the shelves (the jars' glow is the JS's), the table, a broom, herbs, a book on a stump, bones
    R.begin(b, "west:hut-shelves", on="west:hut")
    for s in range(3):
        box2(b, P["shelf"], x0 + 0.28, x0 + 0.63, 0.6 + s * 0.55, 0.64 + s * 0.55, -41.6, -38.4)
        b.box(P["shelf"], 0.04, 0.5, 0.04, x0 + 0.6, 0.64 + s * 0.55 - 0.5 if s else 0.1, -41.6)
        b.box(P["shelf"], 0.04, 0.5, 0.04, x0 + 0.6, 0.64 + s * 0.55 - 0.5 if s else 0.1, -38.4)
        for i in range(9):                           # the jars' necks and corks (the glowing body is the JS's, the height from its R)
            jh = 0.16 + J() * 0.14
            y = 0.64 + s * 0.55 + jh
            lathe(b, P["glass"], x0 + 0.45, -41.4 + i * 0.35, [(0.062, -0.01), (0.045, 0.02), (0.035, 0.05), (0.042, 0.06)], seg=7, y0=y)
            lathe(b, P["cork"], x0 + 0.45, -41.4 + i * 0.35, [(0.032, 0), (0.036, 0.04), (0.0, 0.045)], seg=6, y0=y + 0.055)
    R.end()
    R.begin(b, "west:hut-table", on="west:hut")
    b.box(P["shelf"], 1.2, 0.06, 0.8, -45.6, 0.74, -41.4)
    for dx in (-0.5, 0.5):
        for dz in (-0.32, 0.32):
            b.box(P["witch_lt"], 0.07, 0.74, 0.07, -45.6 + dx, 0, -41.4 + dz, rz=dx * 0.06)
    b.box(P["leather"], 0.3, 0.05, 0.22, -45.3, 0.8, -41.5, ry=0.3)               # a closed book
    b.lump(P["bone"], 0.15, 0.14, 0.17, -45.95, 0.8, -41.3, seed=3, rnd=0.75, jitter=0.01, n=2)
    lathe(b, P["glass"], -45.5, -41.15, [(0.05, 0), (0.06, 0.08), (0.02, 0.16), (0.02, 0.22)], seg=7, y0=0.8)
    R.end()
    R.begin(b, "west:hut-broom", on="west:hut")
    b.cyl(P["witch_lt"], 0.018, (x1 - 0.35, 0.3, z0 + 0.6), (x1 - 0.5, 1.7, z0 + 0.35), seg=5)
    for i in range(14):
        a = i / 14 * 2 * math.pi
        b.cyl(P["straw"], 0.012, (x1 - 0.35, 0.3, z0 + 0.6), (x1 - 0.35 + math.cos(a) * 0.07, 0.0, z0 + 0.6 + math.sin(a) * 0.07), seg=3, r2=0.004)
    ring(b, P["twine"], (x1 - 0.36, 0.28, z0 + 0.58), 0.04, 0.008, seg=8, tseg=4, axis="y")
    R.end()
    R.begin(b, "west:hut-herbs", on="west:hut")
    for i in range(5):                               # bundles hung from the north wall's plate
        hx = -46.8 + i * 0.5
        b.cyl(P["twine"], 0.004, (hx, 2.5, z0 + 0.3), (hx, 2.2, z0 + 0.3), seg=3)
        for k in range(4):
            a = k * 1.6 + i
            b.cyl(P["herb"], 0.018, (hx, 2.2, z0 + 0.3), (hx + math.cos(a) * 0.08, 1.85, z0 + 0.3 + math.sin(a) * 0.06), seg=4, r2=0.03)
    R.end()


def cauldron(b, P, R):
    """The cauldron: an iron pot with a lip and two ears on a tripod over a
    fire of logs (the brew, the flames and the glow are the JS's)."""
    cx, cz = CAULDRON
    R.begin(b, "west:cauldron")
    lathe(b, P["iron"], cx, cz, [(0.0, 0), (0.45, 0.02), (0.66, 0.3), (0.7, 0.55), (0.62, 0.8), (0.64, 0.86), (0.7, 0.9), (0.7, 0.94), (0.6, 0.94), (0.6, 0.84)],
          seg=16, y0=0.15)
    for s in (-1, 1):
        ring(b, P["iron"], (cx + s * 0.72, 1.02, cz), 0.07, 0.015, seg=10, tseg=4, axis="z")
    for i in range(3):
        a = i / 3 * 2 * math.pi
        b.cyl(P["iron"], 0.035, (cx + math.cos(a) * 0.55, 0.0, cz + math.sin(a) * 0.55), (cx + math.cos(a) * 0.1, 1.75, cz + math.sin(a) * 0.1), seg=5)
    b.cyl(P["iron"], 0.025, (cx, 1.75, cz), (cx, 1.1, cz), seg=5)
    ring(b, P["iron"], (cx, 1.75, cz), 0.08, 0.02, seg=10, tseg=4)
    R.end()


def toadstools(b, P, R, J):
    fx, fz = FAIRY
    R.begin(b, "west:fairy-ring")
    for i in range(11):
        a = i / 11 * 2 * math.pi
        r, s = 2.2 + (J() - 0.5) * 0.3, 0.6 + J() * 0.6
        x, z = fx + math.cos(a) * r, fz + math.sin(a) * r
        lathe(b, P["toad_stem"], x, z, [(0.07 * s, 0), (0.05 * s, 0.2 * s), (0.06 * s, 0.35 * s)], seg=7)
        lathe(b, P["toad"], x, z, [(0.0, 0.26 * s), (0.2 * s, 0.3 * s), (0.17 * s, 0.4 * s), (0.08 * s, 0.47 * s), (0.0, 0.49 * s)], seg=10)
        for k in range(5):                           # white spots
            sa = k * 1.26 + i
            b.cyl(P["toad_stem"], 0.03 * s, (x + math.cos(sa) * 0.11 * s, 0.4 * s, z + math.sin(sa) * 0.11 * s), (x + math.cos(sa) * 0.11 * s, 0.415 * s, z + math.sin(sa) * 0.11 * s), seg=6)
    R.end()


def pond_edge(b, P, R, J):
    """Stones and reeds round the pond (hollowgrin.js pondOutline(22, 0.6)),
    from the JS's numbers."""
    px, pz, rx, rz = POND
    R.begin(b, "west:pond-edge")
    for i in range(22):
        a = i / 22 * 2 * math.pi
        wob = 1 + 0.08 * math.sin(a * 3 + 1) + 0.05 * math.sin(a * 5 + 2)
        x, z = px + math.cos(a) * (rx + 0.6) * wob, pz + math.sin(a) * (rz + 0.6) * wob
        if i % 2:
            r = 0.18 + J() * 0.2
            ry = J() * 6
            b.lump(P["stone_dk"], r * 2, r * 1.2, r * 2, x, 0.0, z, seed=i, rnd=0.8, jitter=0.03, ry=ry, n=2)
        else:
            for k in range(6):
                ox, oz = (J() - 0.5) * 0.5, (J() - 0.5) * 0.5
                hh = 0.7 + J() * 0.6
                rz_ = (J() - 0.5) * 0.3
                b.box(P["reed"], 0.025, hh, 0.025, x + ox, 0, z + oz, rz=rz_, rx=(J() - 0.5) * 0.3)
                b.box(P["mud"], 0.03, 0.12, 0.03, x + ox + math.sin(rz_) * hh * 0.3, hh * 0.9, z + oz, rz=rz_)   # the seed head
    R.end()


def thatch_dist(x, z, y=None):
    """How far (x, z) is outside the hut's thatch: a four-sided cap, its
    corners on the axes, 4.48 out at the eave (y 2.68) to 0.35 at 6.0; with
    no y, outside its eave."""
    x0, x1, z0, z1, h, _t = HUT
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    r = 4.48 if y is None else (4.48 - (y - 2.68) / 3.32 * 4.13 if 2.4 < y < 6.4 else -9.0)
    return (abs(x - cx) + abs(z - cz) - r) / math.sqrt(2)


def hollow(b, P, R):
    J = js_rng(2026)                                  # buildOutskirts' R: the pond's stones come first
    pond_edge(b, P, R, J)
    for _ in range(5):                                # the lily pads' turns (the JS draws those)
        J()
    hut(b, P, R, J)
    cauldron(b, P, R)
    R.begin(b, "west:cauldron-logs", on="west:cauldron")
    cx, cz = CAULDRON
    for i in range(5):
        ox, oz, ry = (J() - 0.5) * 0.4, (J() - 0.5) * 0.4, J() * 3
        b.cyl(P["bark"], 0.06, (cx + ox - math.cos(ry) * 0.4, 0.1, cz + oz - math.sin(ry) * 0.4), (cx + ox + math.cos(ry) * 0.4, 0.1, cz + oz + math.sin(ry) * 0.4), seg=5, r2=0.05)
    R.end()
    toadstools(b, P, R, J)
    for x, z, seed in DEAD_TREES:
        # the shape's seed: the first whose limbs all stay clear of the hut's
        # thatch (the tree by its west corner), so it may waive the bounds check
        s, near = seed, thatch_dist(x, z) < 5.0
        while near and not all(thatch_dist(px, pz, py) > 0.6 for (px, py, pz), _r in dead_tree(None, None, None, x, z, h=6 + seed % 3, r=0.28, seed=s)):
            s += 1000
        dead_tree(b, P["bark"], P["bark_lt"], x, z, h=6 + seed % 3, r=0.28, seed=s, R=R, pid=f"west:tree-{seed}", on="west:hut" if near else None)
    # a spell book open on a stump by the cauldron, bones about the fire
    R.begin(b, "west:stump")
    lathe(b, P["bark"], -38.6, -34.6, [(0.3, 0), (0.28, 0.4), (0.26, 0.5)], seg=9)
    b.box(P["leather"], 0.36, 0.03, 0.26, -38.6, 0.5, -34.6, ry=0.4)
    for s in (-1, 1):
        b.box(P["paper"], 0.16, 0.025, 0.24, -38.6 + s * 0.085, 0.53, -34.6, ry=0.4, rz=s * 0.12)
    R.end()
    for k, (bx, bz) in enumerate(((-41.6, -32.4), (-39.4, -32.2), (-41.9, -34.6))):
        R.begin(b, f"west:bone-{k}")
        b.cyl(P["bone"], 0.03, (bx, 0.03, bz), (bx + 0.3, 0.03, bz + 0.15), seg=5)
        if k == 0:
            b.lump(P["bone"], 0.16, 0.15, 0.18, bx + 0.4, 0.0, bz - 0.2, seed=7, rnd=0.75, jitter=0.01, n=2)
        R.end()


# ------------------------------------------------------------------ the creek and the bridge

def banks():
    def off(half):
        left, right = [], []
        for i in range(len(CREEK)):
            px, pz = CREEK[max(0, i - 1)]
            nx, nz = CREEK[min(len(CREEK) - 1, i + 1)]
            dx, dz = nx - px, nz - pz
            L = math.hypot(dx, dz)
            dx, dz = dx / L, dz / L
            x, z = CREEK[i]
            left.append((x + dz * half, z - dx * half))
            right.append((x - dz * half, z + dx * half))
        return left, right
    return off(CREEK_W / 2 + 0.7)


def creek(b, P, R):
    """Stones and reeds along both banks (rng(2031), kept off the bridge),
    a rowing boat drawn up broken on the north-east bank,
    a fishing rod left on the east one."""
    J = js_rng(2031)
    left, right = banks()
    # (only the model reads this stream now, so a clump that would crowd
    # another, the loop's wall or the boat is simply left out)
    keep_out = [(-39.7, -37.8, 25.8, 29.6), (-47.6, -43.2, 19.2, 23.4), (-37.1, -32.5, 28.9, 33.0)]
    placed = []
    n_ = 0
    for bank in (left, right):
        for i in range(1, len(bank)):
            (ax, az), (bx, bz) = bank[i - 1], bank[i]
            n = round(math.hypot(bx - ax, bz - az) / 1.3)
            for k in range(n):
                x = ax + (bx - ax) * (k + J()) / n
                z = az + (bz - az) * (k + J()) / n
                if -42 < x < -33 and 32.4 < z < 37.6:
                    continue
                if any(x0 < x < x1 and z0 < z < z1 for x0, x1, z0, z1 in keep_out) or any(math.hypot(x - px, z - pz) < 0.95 for px, pz in placed):
                    continue
                placed.append((x, z))
                n_ += 1
                R.begin(b, f"west:creek-{n_}")
                if J() < 0.5:
                    r = 0.15 + J() * 0.2
                    ry = J() * 6
                    b.lump(P["stone_dk"], r * 2, r * 1.2, r * 2, x, 0.0, z, seed=k + i * 7, rnd=0.8, jitter=0.03, ry=ry, n=2)
                else:
                    for j in range(5):
                        ox, oz = (J() - 0.5) * 0.4, (J() - 0.5) * 0.4
                        hh = 0.6 + J() * 0.6
                        rz_ = (J() - 0.5) * 0.3
                        b.box(P["reed"], 0.025, hh, 0.025, x + ox, 0, z + oz, rz=rz_)
                R.end()
    R.begin(b, "west:boat")
    bx, bz, ry = -45.4, 21.2, -0.727            # on the north-east bank, along the creek, out of the water
    c, s = math.cos(ry), math.sin(ry)
    prof = [(-1.5, 0.0), (1.5, 0.0), (1.7, 0.25), (1.55, 0.42), (-1.45, 0.42), (-1.6, 0.25)]
    for sd in (-1, 1):
        pts = [(bx + u * c + sd * (0.42 + v * 0.25) * s, v, bz - u * s + sd * (0.42 + v * 0.25) * c) for u, v in prof]
        n = len(pts)
        facing(b, P["boat"], pts, (s * sd, 0.0, c * sd))
    for u in (-1.2, -0.6, 0.0, 0.6, 1.2):
        b.box(P["boat"], 0.08, 0.3, 0.84 + 0.1, bx + u * c, 0.0, bz - u * s, ry=-ry)
    fbox(b, P["boat"], bx - 1.5, bx + 1.5, 0.05, 0.05, bz - 0.4, bz + 0.4, "+y")
    b.box(P["boat"], 0.9, 0.04, 0.2, bx + 0.3 * c, 0.3, bz - 0.3 * s, ry=-ry)      # a thwart
    b.box(P["boat"], 0.1, 0.05, 1.6, bx + 0.3, 0.0, bz - 1.0, ry=0.3, rz=0.05)    # an oar, out of it on the grass
    R.end()
    R.begin(b, "west:rod")
    b.cyl(P["shelf"], 0.012, (-33.2, 0.05, 29.5), (-35.3, 0.95, 31.2), seg=4, r2=0.005)
    b.box(P["stone_dk"], 0.3, 0.2, 0.25, -34.4, 0.0, 30.5)
    b.cyl(P["rope"], 0.003, (-35.3, 0.95, 31.2), (-36.4, 0.1, 32.4), seg=3)
    R.end()


def bridge(b, P, R):
    x0, x1, z0, z1, deck = BRIDGE
    xm, zm = (x0 + x1) / 2, (z0 + z1) / 2
    rnd = random.Random(5)
    R.begin(b, "west:bridge")
    # the deck's boards, across, on two beams; the steps either end
    box2(b, P["oak_dk"], x0 + 0.1, x1 - 0.1, 0.0, deck - 0.1, z0 + 0.4, z1 - 0.4)
    x = x0
    while x < x1 - 0.01:
        bw = min(x1 - x, rnd.uniform(0.14, 0.2))
        fbox(b, P["deck"], x + 0.005, x + bw - 0.005, deck - 0.1, deck - rnd.uniform(0.0, 0.01), z0, z1, "+y")
        x += bw
    for s, edge in ((-1, x0), (1, x1)):
        for k, (w, h) in enumerate(((0.6, 0.36), (0.6, 0.18))):
            cx = edge + s * (0.3 + k * 0.6)
            box2(b, P["oak_dk"], cx - 0.3, cx + 0.3, 0.0, h - 0.04, z0 + 0.2, z1 - 0.2)
            fbox(b, P["deck"], cx - 0.3, cx + 0.3, h - 0.04, h, z0 + 0.2, z1 - 0.2, "+y" + (" -x" if s < 0 else " +x"))
    for x in (x0 + 0.3, xm, x1 - 0.3):
        for z in (z0 + 0.2, z1 - 0.2):
            b.box(P["bark"], 0.25, 0.44, 0.25, x, 0.0, z)
    # the walls: boards, a window each side of the middle, the frame posts
    for z, out in ((z0 + 0.1, -1), (z1 - 0.1, 1)):
        w = Wall("x", z, x0, x1, 2.4, 0.16, y=deck, out=out,
                 holes=[{"c": xm - 1.6, "w": 1.0, "spans": [(1.0, 1.6)]}, {"c": xm + 1.6, "w": 1.0, "spans": [(1.0, 1.6)]}])
        w.solid(b, P["barn"], inner=P["barnwood"], split=0.5)
        w.battens(b, P["barn"], 0.4, y0=0.05)
        w.casings(b, P["trim"], fw=0.08)
        for x in (x0 + 0.08, xm, x1 - 0.08):
            b.box(P["barnwood"], 0.14, 2.4, 0.14, x, deck, z + out * -0.1)
    # the roof: a gable along x, shingles, the gable boards, the ridge
    S = [P["shingle"], P["shingle2"], P["shingle"]]
    rise, half = 1.3, (z1 - z0) / 2
    for s in (-1, 1):
        slates(b, S, "x", x0 - 0.2, x1 + 0.2, (zm + s * (half + 0.1), deck + 2.4), (zm, deck + 2.4 + rise), seed=60 + s, course=0.2, deck=0.08)
    b.cyl(P["oak_dk"], 0.06, (x0 - 0.25, deck + 2.4 + rise + 0.05, zm), (x1 + 0.25, deck + 2.4 + rise + 0.05, zm), seg=6)
    for x in (x0 + 0.05, x1 - 0.05):
        b.prism(P["barn"], [(zm - half - 0.1, deck + 2.4), (zm + half + 0.1, deck + 2.4), (zm, deck + 2.4 + rise)], x - 0.05, x + 0.05, axis="x")
        b.box(P["barn"], 0.1, 0.25, z1 - z0, x, deck + 2.15, zm)
        # a board for the sign (the words are the JS\x27s)
        b.box(P["trim"], 0.04, 0.6, 2.6, x - 0.04 if x < xm else x + 0.04, deck + 2.55, zm)
    R.end()


def build_west(P, R):
    b = HGBuilder()
    loop(b, P, R)
    hollow(b, P, R)
    creek(b, P, R)
    bridge(b, P, R)
    for face in FACES:
        R.face(*face)
    b.finish("hg-west.glb")


x0, x1, z0, z1, _d = BRIDGE
FACES = [
    ("sign:troll-bridge-w", "west:bridge", (x0 - 0.02, 3.39, (z0 + z1) / 2), (-1, 0, 0), 2.4, 0.5),
    ("sign:troll-bridge-e", "west:bridge", (x1 + 0.02, 3.39, (z0 + z1) / 2), (1, 0, 0), 2.4, 0.5),
    ("door:hut-south", "west:hut", (-44.6, 1.05, -37.5), (0, 0, 1), 1.2, 2.1),
    ("door:hut-east", "west:hut", (-42.0, 1.05, -41.4), (1, 0, 0), 1.2, 2.1),
]
