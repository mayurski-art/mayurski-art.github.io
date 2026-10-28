"""
Hollowgrin's woods ring (phase 5 of "Troll Forces: Hollowgrin in Blender").

hg-woods.glb, in map coordinates: the crumbling field-stone wall just
outside the playable line (hollowgrin.js BOUNDS), on all four sides, with
the JS's gaps where the lane, the creek and the chapel's apse run out.
Stones in courses, only the faces a player inside can see (the inner face,
the tops, the ends at a gap): the outer face looks away from every eye
point. Here and there a run has fallen to a heap of loose stones.

hg-woodkit.glb, each piece its own node at the origin: the woods'
pieces, which hollowgrin.js instances round the ring from its seeded
stream: four dead trees with real trunks (root flares, roots, crooked
limbs), two dark pines for the back rows, stumps, fallen logs, a root
tangle, bramble, a toadstool cluster and a crow. Instanced, so they take
no bake (phase 6 bakes the wall); they stand outside the line, where no
eye point reaches them.
"""
import math
import os
import random

import bpy

import map_kit
import tf_kit
from map_kit import TEXTURED, mat
from hg_kit import HGBuilder, branch, fbox, facing, lathe

TEXTURED.update({"HG_FieldRock", "HG_FieldRockDark", "HG_Bark", "HG_WoodsPine", "HG_WoodsPineLight"})

# hollowgrin.js BOUNDS, LANE and the wall's gaps (the JS's numbers)
BOUNDS = (-51.0, 87.0, -45.0, 45.0)        # minX, maxX, minZ, maxZ
LANE = (33.4, 36.6)
OFF = 0.6                                  # the wall's line, outside the bounds
T = 0.7                                    # its thickness


def palette():
    return {
        "rock": mat("HG_FieldRock", 0x6e6a62, 0.95),
        "rock_dk": mat("HG_FieldRockDark", 0x55524c, 0.95),
        "moss": mat("HG_WoodsMoss", 0x34442a, 0.95),
        "bark": mat("HG_Bark", 0x3a3028, 0.95),
        "bark_lt": mat("HG_BarkLight", 0x4a3e32, 0.95),
        "wood_in": mat("HG_StumpWood", 0x8a6e4a, 0.9),
        "ring": mat("HG_StumpRing", 0x6a5236, 0.9),
        "pine": mat("HG_WoodsPine", 0x14261a, 0.95),
        "pine_lt": mat("HG_WoodsPineLight", 0x1a2e20, 0.95),
        "bramble": mat("HG_Bramble", 0x2a2a1c, 0.95),
        "berry": mat("HG_Blackberry", 0x1a0e1e, 0.4),
        "leafy": mat("HG_BrambleLeaf", 0x2e3a22, 0.95),
        "toad": mat("HG_ToadCap", 0xc0283a, 0.5, emit=0x3a0610, emit_strength=0.6),
        "toad_stem": mat("HG_ToadStem", 0xd8d2c4, 0.8),
        "fungus": mat("HG_Bracket", 0x5a4a34, 0.85),
        "crow": mat("HG_Crow", 0x101014, 0.45),
        "beak": mat("HG_CrowBeak", 0x2a2620, 0.5),
        "eye": mat("HG_CrowEye", 0xd8a020, 0.3, emit=0xd8a020, emit_strength=0.5),
    }


# ------------------------------------------------------------------ the wall

def runs():
    """The wall's four runs: (axis, at, a, b, inner side, gaps)."""
    x0, x1, z0, z1 = BOUNDS
    lane = (LANE[0] - 0.4, LANE[1] + 0.4)
    return [
        # the north and south runs take the corners, the west and east stop
        # short of them
        # (open where the drop tower's feet, Skull Mountain's rock and the
        # pond's stones reach the line)
        ("x", z0 - OFF, x0 - OFF - T / 2 - 0.05, x1 + OFF + T / 2 + 0.05, 1, [(83.0, 89.0)]),
        ("x", z1 + OFF, x0 - OFF - T / 2 - 0.05, x1 + OFF + T / 2 + 0.05, -1, [(-38.9, -33.6), (69.8, 89.0)]),
        ("z", x0 - OFF, z0 - OFF + T / 2 + 0.25, z1 + OFF - T / 2 - 0.25, 1, [lane, (16.5, 23.5), (-1.6, 5.6), (-25.4, -14.9)]),    # the chapel's apse
        ("z", x1 + OFF, z0 - OFF + T / 2 + 0.25, z1 + OFF - T / 2 - 0.25, -1, [(29.1, 46.0)]),
    ]


def stone(b, m, axis, at, inner, a0, a1, y0, y1, across, sides):
    """One field stone [a0, a1] along the run, y0..y1 high; `across` nudges
    it in or out of the line. Sides: "in", "top", "a0", "a1"."""
    c = at + across
    lo, hi = c - T / 2, c + T / 2
    if axis == "x":
        want = {"in": "+z" if inner > 0 else "-z", "top": "+y", "a0": "-x", "a1": "+x"}
        fbox(b, m, a0, a1, y0, y1, lo, hi, " ".join(want[s] for s in sides))
    else:
        want = {"in": "+x" if inner > 0 else "-x", "top": "+y", "a0": "-z", "a1": "+z"}
        fbox(b, m, lo, hi, y0, y1, a0, a1, " ".join(want[s] for s in sides))


def wall_run(b, P, R, rnd, axis, at, a, b_, inner, gaps):
    """A run: sections 2-5.5 m long, each its own height, the top crumbling
    stone by stone; one in eight fallen to a heap; open at the gaps."""
    s, i = a, 0
    while s < b_:
        ln = min(b_ - s, rnd.uniform(2.0, 5.5))
        open_ = any(s < g1 and s + ln > g0 for g0, g1 in gaps)
        if open_:
            s += ln + 0.05
            continue
        # each section its own prop (a run's box would take in its neighbours' corners)
        R.begin(b, f"woods:wall-{axis}{'+' if at > 0 else '-'}{i}")
        end = s - a < 1.5 or b_ - s - ln < 1.5
        if rnd.random() < 0.12 and not end:
            heap(b, P, rnd, axis, at, inner, s, s + ln, s - a < 1.5 or b_ - s - ln < 1.5)
        else:
            section(b, P, rnd, axis, at, inner, s, s + ln, rnd.uniform(0.75, 1.25), s - a < 1.5 or b_ - s - ln < 1.5)
        R.end()
        s, i = s + ln + 0.05, i + 1


def section(b, P, rnd, axis, at, inner, a, b_, h, end=False):
    # the top sags and breaks: each stone stands if its course is under the
    # section's height there (a slow wave plus a little noise)
    ph, k = rnd.uniform(0, 6.28), rnd.uniform(0.6, 1.4)
    top = lambda u: h * (0.82 + 0.18 * math.sin(ph + u * k)) - rnd.uniform(0, 0.12)
    y, row = 0.0, 0
    courses = []
    while True:
        ch = rnd.uniform(0.25, 0.36)
        courses.append((y, ch))
        y += ch
        if y > h:
            break
    first = True
    for i, (y0, ch) in enumerate(courses):
        u = a + (rnd.uniform(0.2, 0.45) if i % 2 else 0.0)
        if i % 2:                                    # stagger: a short stone at the start
            if top((a + u) / 2) > y0 + ch * 0.5:
                stone(b, P["rock"], axis, at, inner, a, u, y0, y0 + ch, rnd.uniform(-0.04, 0.04), ["in", "top", "a0"])
        while u < b_ - 0.05:
            ln = min(b_ - u, rnd.uniform(0.55, 1.1))
            if top(u + ln / 2) > y0 + ch * 0.5:
                above = i + 1 < len(courses) and top(u + ln / 2) > courses[i + 1][0] + courses[i + 1][1] * 0.5
                sides = ["in"] + ([] if above else ["top"])
                if u <= a + 1e-6:
                    sides.append("a0")
                if u + ln >= b_ - 1e-6:
                    sides.append("a1")
                m = P["rock"] if rnd.random() < 0.6 else P["rock_dk"]
                stone(b, m, axis, at, inner, u, u + ln - 0.02, y0, y0 + ch - 0.015, rnd.uniform(-0.05, 0.05), sides)
                if not above and ln > 0.5 and rnd.random() < 0.25:     # moss on the top
                    mo = rnd.uniform(0.1, 0.3)
                    stone(b, P["moss"], axis, at, inner, u + mo, u + ln - mo, y0 + ch - 0.01, y0 + ch + 0.012, 0.0, ["top", "in"])
            u += ln
    # a stone fallen off the top, on the inside (not in the park: the moat)
    if rnd.random() < 0.35 and not end and not (axis == "x" and a > 50):
        c = rnd.uniform(a + 0.65, b_ - 0.65)
        d = at + inner * rnd.uniform(0.75, 1.3)
        x, z = (c, d) if axis == "x" else (d, c)
        b.lump(P["rock_dk"], rnd.uniform(0.35, 0.6), rnd.uniform(0.2, 0.3), rnd.uniform(0.3, 0.5), x, 0.0, z, seed=rnd.randrange(9999), n=1)


def heap(b, P, rnd, axis, at, inner, a, b_, end=False):
    """A run fallen down: a low spill of loose stones."""
    n = int((b_ - a) * 1.6)
    for i in range(n):
        w = rnd.uniform(0.4, 0.75)
        c = rnd.uniform(a + w + 0.2, b_ - w - 0.2)         # (turned, its own length: clear of the next section)
        d = at + inner * rnd.uniform(-0.3, 0.6)
        x, z = (c, d) if axis == "x" else (d, c)
        b.lump(P["rock"] if i % 3 else P["rock_dk"], w, rnd.uniform(0.2, 0.4), w * rnd.uniform(0.6, 1.0), x, 0.0, z,
               ry=rnd.uniform(0, 3.14), seed=rnd.randrange(9999), n=1)


def build_woods(P, R):
    b = HGBuilder()
    rnd = random.Random(4)
    for axis, at, a, b_, inner, gaps in runs():
        wall_run(b, P, R, rnd, axis, at, a, b_, inner, gaps)
    b.finish("hg-woods.glb")


# ------------------------------------------------------------------ the kit

def tree(b, P, seed, h, r):
    """A dead tree with a real trunk: a fat, leaning bole that flares into
    four or five roots and forks into crooked limbs."""
    rnd = random.Random(seed)
    fork = h * rnd.uniform(0.42, 0.55)
    la = rnd.uniform(0, 2 * math.pi)
    lean = rnd.uniform(0.06, 0.14)
    mid = (math.cos(la) * lean * fork * 0.4, fork * 0.5, math.sin(la) * lean * fork * 0.4)
    top = (math.cos(la) * lean * fork, fork, math.sin(la) * lean * fork)
    b.cyl(P["bark"], r, (0.0, -0.1, 0.0), mid, seg=9, r2=r * 0.86, caps=False)
    b.cyl(P["bark"], r * 0.86, mid, top, seg=9, r2=r * 0.7, caps=False)
    b.cyl(P["bark"], r * 1.35, (0.0, -0.1, 0.0), (0.0, 0.45, 0.0), seg=9, r2=r * 0.98, caps=False)
    # roots: out and down into the ground
    for i in range(rnd.choice((4, 5))):
        a = la + i * 2 * math.pi / 5 + rnd.uniform(-0.3, 0.3)
        p0 = (math.cos(a) * r * 0.7, 0.35, math.sin(a) * r * 0.7)
        L = rnd.uniform(0.8, 1.5) * r / 0.3
        p1 = (math.cos(a) * (r + L * 0.55), 0.12, math.sin(a) * (r + L * 0.55))
        p2 = (math.cos(a + 0.2) * (r + L), -0.08, math.sin(a + 0.2) * (r + L))
        b.cyl(P["bark"], r * 0.32, p0, p1, seg=5, r2=r * 0.2, caps=False)
        b.cyl(P["bark"], r * 0.24, p1, p2, seg=5, r2=0.05, caps=False)
    # a knot hole and a bracket fungus on the bole
    fa = la + math.pi + rnd.uniform(-0.5, 0.5)
    for k in range(2):
        fy = rnd.uniform(0.9, 1.8) + k * 0.22
        fx, fz = math.cos(fa) * r * 0.92, math.sin(fa) * r * 0.92
        lathe(b, P["fungus"], fx + math.cos(fa) * 0.05, fz + math.sin(fa) * 0.05,
              [(0.0, fy), (0.09, fy + 0.01), (0.07, fy + 0.035), (0.0, fy + 0.04)], seg=5)
    tips = []
    limbs = rnd.choice((3, 4))
    for i in range(limbs):
        a = la + 2 * math.pi * i / limbs + rnd.uniform(-0.4, 0.4)
        d = [math.cos(a) * 0.75, 0.8, math.sin(a) * 0.75]
        n = math.sqrt(sum(c * c for c in d))
        branch(b, P["bark"], P["bark_lt"], top, [c / n for c in d], (h - fork) * 0.85, r * 0.58, 2, rnd, tips)
    return tips


def pine(b, P, seed, h):
    """A dark pine for the back rows: a trunk and seven tiers of drooping,
    ragged boughs, each steep and overlapping the one under it, narrowing to
    the tip."""
    rnd = random.Random(seed)
    b.cyl(P["bark"], 0.16, (0.0, -0.1, 0.0), (0.0, h * 0.35, 0.0), seg=6, r2=0.11, caps=False)
    tiers = 7
    for i in range(tiers):
        f = i / tiers
        y0 = h * (0.18 + 0.74 * f)
        r = (1.0 - f) * h * 0.22 + 0.2
        th = h * 0.22
        seg = 9
        verts = []
        turn = rnd.uniform(0, 1)
        for k in range(seg):
            a = (k + turn) / seg * 2 * math.pi + rnd.uniform(-0.12, 0.12)
            rr = r * rnd.uniform(0.82, 1.12)
            verts.append((math.cos(a) * rr, y0 - rnd.uniform(0.0, 0.25), math.sin(a) * rr))
        tip = (rnd.uniform(-0.05, 0.05), y0 + th, rnd.uniform(-0.05, 0.05))
        m = P["pine"] if i % 2 else P["pine_lt"]
        pts = verts + [tip, (0.0, y0 + 0.15, 0.0)]
        faces = [(k, (k + 1) % seg, seg) for k in range(seg)] + [((k + 1) % seg, k, seg + 1) for k in range(seg)]
        b.poly(m, pts, faces)


def stump(b, P, seed):
    rnd = random.Random(seed)
    r = rnd.uniform(0.3, 0.42)
    h = rnd.uniform(0.35, 0.6)
    b.cyl(P["bark"], r * 1.25, (0.0, -0.05, 0.0), (0.0, h * 0.4, 0.0), seg=9, r2=r, caps=False)
    b.cyl(P["bark"], r, (0.0, h * 0.4, 0.0), (0.0, h, 0.0), seg=9, r2=r * 0.96, caps=False)
    # the cut top, a little proud of the bark, its rings
    lathe(b, P["wood_in"], 0.0, 0.0, [(0.0, h + 0.01), (r * 0.94, h - 0.01)], seg=9, caps=False)
    lathe(b, P["ring"], 0.0, 0.0, [(r * 0.35, h + 0.008), (r * 0.42, h + 0.008)], seg=9, caps=False)
    for i in range(3):
        a = rnd.uniform(0, 2 * math.pi)
        b.cyl(P["bark"], r * 0.3, (math.cos(a) * r * 0.8, h * 0.25, math.sin(a) * r * 0.8),
              (math.cos(a) * (r + 0.45), -0.06, math.sin(a) * (r + 0.45)), seg=5, r2=0.03, caps=False)
    return h


def log(b, P, seed):
    """A fallen trunk along x, half sunk, a broken limb, fungus on its side."""
    rnd = random.Random(seed)
    L = rnd.uniform(3.0, 4.2)
    r = rnd.uniform(0.25, 0.34)
    b.cyl(P["bark"], r, (-L / 2, r * 0.75, 0.0), (L / 2, r * 0.68, 0.0), seg=8, r2=r * 0.85, caps=False)
    for s, rr, y in ((-1, r, r * 0.75), (1, r * 0.85, r * 0.68)):          # the ends: rotten wood
        x = s * L / 2
        verts = [(x, y + math.sin(k / 8 * 2 * math.pi) * rr * 0.97, math.cos(k / 8 * 2 * math.pi) * rr * 0.97) for k in range(8)]
        b.poly(P["wood_in"], verts + [(x + s * 0.03, y, 0.0)], [((k + 1) % 8, k, 8) if s < 0 else (k, (k + 1) % 8, 8) for k in range(8)])
    a = rnd.choice((-1, 1))
    b.cyl(P["bark_lt"], r * 0.35, (L * 0.15, r * 1.2, a * r * 0.6), (L * 0.35, r * 1.5, a * (r + 0.7)), seg=5, r2=0.04, caps=False)
    for k in range(3):
        x = rnd.uniform(-L / 3, L / 3)
        lathe(b, P["fungus"], x, a * -r * 0.92, [(0.0, r + k * 0.04), (0.11, r + 0.01 + k * 0.04), (0.08, r + 0.04 + k * 0.04), (0.0, r + 0.05 + k * 0.04)], seg=6)


def roots(b, P, seed):
    """A tangle of surface roots, knee-high where they arch."""
    rnd = random.Random(seed)
    for i in range(5):
        a = rnd.uniform(0, 2 * math.pi)
        L = rnd.uniform(1.2, 2.2)
        p0 = (math.cos(a) * 0.2, -0.05, math.sin(a) * 0.2)
        p1 = (math.cos(a) * L * 0.5, rnd.uniform(0.15, 0.35), math.sin(a) * L * 0.5)
        p2 = (math.cos(a + 0.3) * L, -0.08, math.sin(a + 0.3) * L)
        b.cyl(P["bark"], 0.09, p0, p1, seg=5, r2=0.07, caps=False)
        b.cyl(P["bark"], 0.07, p1, p2, seg=5, r2=0.02, caps=False)


def bramble(b, P, seed):
    """A bramble thicket: arching canes in a mound, leaf clumps, berries."""
    rnd = random.Random(seed)
    for i in range(9):
        a = rnd.uniform(0, 2 * math.pi)
        L = rnd.uniform(0.8, 1.5)
        p0 = (math.cos(a) * 0.15, 0.0, math.sin(a) * 0.15)
        p1 = (math.cos(a) * L * 0.45, rnd.uniform(0.6, 1.0), math.sin(a) * L * 0.45)
        p2 = (math.cos(a + 0.4) * L, 0.0, math.sin(a + 0.4) * L)
        b.cyl(P["bramble"], 0.025, p0, p1, seg=3, r2=0.02, caps=False)
        b.cyl(P["bramble"], 0.02, p1, p2, seg=3, r2=0.008, caps=False)
    for i in range(6):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0.1, 0.8)
        b.lump(P["leafy"], rnd.uniform(0.5, 0.9), rnd.uniform(0.35, 0.65), rnd.uniform(0.5, 0.9),
               math.cos(a) * d, 0.0, math.sin(a) * d, seed=rnd.randrange(9999), rnd=0.6, jitter=0.18, n=1)
    for i in range(7):
        a = rnd.uniform(0, 2 * math.pi)
        d = rnd.uniform(0.2, 0.8)
        b.box(P["berry"], 0.05, 0.05, 0.05, math.cos(a) * d, rnd.uniform(0.3, 0.7), math.sin(a) * d)


def toadstools(b, P, seed):
    rnd = random.Random(seed)
    for i in range(6):
        a, d = rnd.uniform(0, 2 * math.pi), rnd.uniform(0.0, 0.45)
        x, z, s = math.cos(a) * d, math.sin(a) * d, rnd.uniform(0.45, 1.0)
        lathe(b, P["toad_stem"], x, z, [(0.06 * s, 0), (0.045 * s, 0.18 * s), (0.05 * s, 0.3 * s)], seg=6, caps=False)
        lathe(b, P["toad"], x, z, [(0.0, 0.22 * s), (0.17 * s, 0.26 * s), (0.14 * s, 0.35 * s), (0.06 * s, 0.4 * s), (0.0, 0.42 * s)], seg=8)


def crow(b, P):
    """A crow perched, beak +x: a lofted body, a head, the tail, folded
    wings, feet on whatever it stands on (y 0)."""
    C = P["crow"]
    b.lump(C, 0.3, 0.17, 0.15, 0.0, 0.07, 0.0, seed=11, rnd=0.7, jitter=0.0, n=1)
    b.lump(C, 0.12, 0.11, 0.1, 0.15, 0.19, 0.0, seed=12, rnd=0.7, jitter=0.0, n=1)
    b.cyl(P["beak"], 0.022, (0.2, 0.235, 0.0), (0.29, 0.22, 0.0), seg=4, r2=0.0)
    for s in (-1, 1):
        b.box(P["eye"], 0.012, 0.012, 0.01, 0.19, 0.25, s * 0.045)
        b.poly(C, [(0.1, 0.18, s * 0.075), (-0.18, 0.13, s * 0.07), (-0.05, 0.09, s * 0.08)], [(0, 1, 2) if s > 0 else (0, 2, 1)])
        b.cyl(P["beak"], 0.008, (0.0, 0.08, s * 0.03), (0.01, 0.0, s * 0.03), seg=3)
    b.poly(C, [(-0.12, 0.13, -0.04), (-0.12, 0.13, 0.04), (-0.3, 0.07, 0.06), (-0.3, 0.07, -0.06)], [(0, 1, 2, 3), (3, 2, 1, 0)])


KIT = [
    ("tree0", lambda b, P: tree(b, P, 11, 7.5, 0.34)),
    ("tree1", lambda b, P: tree(b, P, 23, 8.5, 0.4)),
    ("tree2", lambda b, P: tree(b, P, 37, 9.0, 0.44)),
    ("tree3", lambda b, P: tree(b, P, 51, 10.0, 0.5)),
    ("pine0", lambda b, P: pine(b, P, 61, 9.0)),
    ("pine1", lambda b, P: pine(b, P, 67, 11.0)),
    ("stump0", lambda b, P: stump(b, P, 71)),
    ("stump1", lambda b, P: stump(b, P, 73)),
    ("log0", lambda b, P: log(b, P, 81)),
    ("log1", lambda b, P: log(b, P, 83)),
    ("roots0", lambda b, P: roots(b, P, 91)),
    ("bramble0", lambda b, P: bramble(b, P, 101)),
    ("bramble1", lambda b, P: bramble(b, P, 103)),
    ("toad0", lambda b, P: toadstools(b, P, 111)),
    ("crow0", lambda b, P: crow(b, P)),
]


def build_woodkit(P, R):
    """Each piece its own node (hollowgrin.js finds them by name), all in
    one GLB."""
    objs, tris = [], 0
    for name, fn in KIT:
        b = HGBuilder()
        fn(b, P)
        o = tf_kit.to_object(b, name)
        objs.append(o)
        n = sum(len(p.vertices) - 2 for p in o.data.polygons)
        tris += n
        print(f"   {name:10}{n:6} tris")
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(map_kit.OUT_DIR, "hg-woodkit.glb")
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_yup=True, export_apply=True)
    tf_kit.Report.rows.append(["hg-woodkit", tris, sum(len(o.data.vertices) for o in objs), 0, [0, 0, 0], [0, 0, 0]])
    for o in objs:
        me = o.data
        bpy.data.objects.remove(o)
        bpy.data.meshes.remove(me)
    print("Exported", path)
