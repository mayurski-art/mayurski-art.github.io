"""
Hollowgrin's hedge garden and glasshouse (phase 2 of "Troll Forces:
Hollowgrin in Blender"): hg-garden.glb, in map coordinates.

The hedge garden (NW of the manor): clipped hedges with depth (their faces
gridded and pushed in and out, three greens, the grass photo on them), a
topiary troll on each corner, the fountain (a moulded basin, a pedestal and
a bowl: the water and the jack on it are the JS's), two stone benches, a
birdbath, a sundial, two troll busts on plinths at the east way in, two
dead trees.

The glasshouse (behind the manor): the brick dwarf walls and their sills,
the iron frame (mullions, glazing bars, door posts, the eave rail, the
rafters, purlins, the ridge with its cresting and finials, the gables'
king bars and roundels), the raised beds with their coping and soil, dead
plants where the JS's glowing flowers stand (the same random stream:
buildOutskirts' R, rng(2026), read past the hollow and the glass), a giant
pumpkin, pots, watering cans, the potting bench by the west door. The glass
stays the JS's live material, as do the flowers' glow and the festoon.

Drawn over the colliders hollowgrin.js lays (GARDEN_PROPS there: the
birdbath, the sundial, the busts and the bench are new ones).
"""
import math
import random

from map_kit import TEXTURED, mat
from hg_kit import HGBuilder, dead_tree, facing, fbox, js_rng, lathe, pumpkin, ring, troll_face

TEXTURED.update({"HG_Granite", "HG_GraniteDark", "HG_Brick", "HG_Hedge", "HG_HedgeLight", "HG_HedgeDark"})

# the hedge garden (hollowgrin.js: the hedge garden (NW))
GX, GZ, HALF, HEDGE_H, HEDGE_T = -24.0, -19.0, 6.0, 1.35, 1.0
BENCHES = [(-27.6, -15.2), (-20.4, -22.8)]
BIRDBATH = (-27.4, -22.4)
SUNDIAL = (-20.6, -15.6)
BUSTS = [(-16.8, -20.9), (-16.8, -17.1)]       # either side of the east way in, facing east
TREES = [(-33.0, -12.0, 901, 8.0, 0.34), (-16.5, -29.5, 902, 7.0, 0.3)]
# the glasshouse (hollowgrin.js: the glasshouse)
G0, G1, Z0, Z1, EAVE, RIDGE = -9.0, 9.0, -43.0, -34.0, 3.0, 5.2
S_DOORS = [(-6.5, 1.4), (6.5, 1.4)]
N_DOORS = [(0.0, 1.6)]
EW_DOOR = [(-38.5, 1.4)]
BEDS = [(-4.7, -40.8, 7.0, 1.6), (4.7, -40.8, 7.0, 1.6), (0.0, -36.3, 10.8, 1.4)]
BED_H = 0.6
POTTING = (-9.45, -41.7)        # outside the west wall, north of its door: 0.6 x 1.8


def palette():
    return {
        "hedge": mat("HG_Hedge", 0x3a6230, 1.0),
        "hedge_lt": mat("HG_HedgeLight", 0x4a7638, 1.0),
        "hedge_dk": mat("HG_HedgeDark", 0x2a4a24, 1.0),
        "cut": mat("HG_HedgeCut", 0x0c140a, 1.0),
        "granite": mat("HG_Granite", 0x8c8c94, 0.9),
        "granite_dk": mat("HG_GraniteDark", 0x5a5a62, 0.9),
        "marble": mat("HG_OldMarble", 0xb8b4a8, 0.7),
        "lichen": mat("HG_Lichen", 0x8a9a5a, 0.95),
        "dial": mat("HG_Dial", 0xd8cfb4, 0.6),
        "bronze": mat("HG_Bronze", 0x3d6a58, 0.5, 0.6),
        "iron": mat("HG_Iron", 0x1c1c22, 0.55, 0.3),
        "brick": mat("HG_Brick", 0x8a4a3a, 0.9),
        "sill": mat("HG_StoneSill", 0x7a766e, 0.85),
        "soil": mat("HG_GraveDirt", 0x3a2e24, 1.0),
        "rot": mat("HG_RotGreen", 0x5a6a3a, 0.9),
        "dry": mat("HG_DryStalk", 0x6a5a3a, 1.0),
        "stem": mat("HG_Stem", 0x4a4a22, 0.9),
        "pk": mat("HG_Pumpkin1", 0xd8641c, 0.6),
        "terracotta": mat("HG_Terracotta", 0x9a4e30, 0.85),
        "zinc": mat("HG_Zinc", 0x7a8086, 0.45, 0.5),
        "bench": mat("HG_MarketWood", 0x6a4a30, 0.8),
        "bark": mat("HG_OakBark", 0x2e2620, 0.95),
        "bark_lt": mat("HG_OakBarkLight", 0x3e342c, 0.95),
    }


# ------------------------------------------------------------------ the hedges

def bumps(seed):
    """A smooth bulge field (a few sines), +-1, from world position."""
    r = random.Random(seed)
    waves = [(r.uniform(1.5, 4.0), r.uniform(1.5, 4.0), r.uniform(1.5, 4.0), r.uniform(0, 6.3)) for _ in range(4)]
    fine = [(r.uniform(7, 11), r.uniform(7, 11), r.uniform(7, 11), r.uniform(0, 6.3)) for _ in range(2)]
    return lambda x, y, z: (sum(math.sin(a * x + b_ * y + c * z + p) for a, b_, c, p in waves) / 4
                            + 0.45 * sum(math.sin(a * x + b_ * y + c * z + p) for a, b_, c, p in fine) / 2)


def hedge_face(b, P, rnd, f, tone, corner, ua, va, nu, nv, n, amp=0.07):
    """One face of a clipped hedge: a grid over corner + s*ua + t*va, each
    inner point pushed along n by the bulge field (the edges stay true, as
    shears leave them), each quad one of three greens."""
    pts = []
    for j in range(nv + 1):
        row = []
        for i in range(nu + 1):
            s, t = i / nu, j / nv
            p = [corner[k] + s * ua[k] + t * va[k] for k in range(3)]
            if 0 < i < nu and 0 < j < nv:
                d = amp * f(*p)
                p = [p[k] + d * n[k] for k in range(3)]
            row.append(tuple(p))
        pts.append(row)
    for j in range(nv):
        for i in range(nu):
            q = [pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]]
            # soft patches of lighter and darker growth, not a checker
            v = tone(*[sum(p[k] for p in q) / 4 for k in range(3)]) + rnd.uniform(-0.12, 0.12)
            m = P["hedge_dk"] if v < -0.3 else P["hedge_lt"] if v > 0.3 else P["hedge"]
            facing(b, m, q, n).smooth = True


def hedge_box(b, P, x0, x1, z0, z1, sides, seed, h=HEDGE_H, cell=0.25):
    """A clipped hedge over [x0, x1] x [z0, z1], h tall, with only the named
    faces (+x -x +z -z +y)."""
    rnd = random.Random(seed)
    f, tone = bumps(seed), bumps(seed + 50)
    nx, nz, ny = max(1, round((x1 - x0) / cell)), max(1, round((z1 - z0) / cell)), max(1, round(h / cell))
    if "+y" in sides:
        hedge_face(b, P, rnd, f, tone, (x0, h, z0), (x1 - x0, 0, 0), (0, 0, z1 - z0), nx, nz, (0, 1, 0), amp=0.05)
    if "-z" in sides:
        hedge_face(b, P, rnd, f, tone, (x0, 0, z0), (x1 - x0, 0, 0), (0, h, 0), nx, ny, (0, 0, -1))
    if "+z" in sides:
        hedge_face(b, P, rnd, f, tone, (x0, 0, z1), (x1 - x0, 0, 0), (0, h, 0), nx, ny, (0, 0, 1))
    if "-x" in sides:
        hedge_face(b, P, rnd, f, tone, (x0, 0, z0), (0, 0, z1 - z0), (0, h, 0), nz, ny, (-1, 0, 0))
    if "+x" in sides:
        hedge_face(b, P, rnd, f, tone, (x1, 0, z0), (0, 0, z1 - z0), (0, h, 0), nz, ny, (1, 0, 0))


def hedges(b, P, R):
    """The square of hedges: north and south runs (with the corners), then
    west and east runs between them, each split by a path 2.4 m wide."""
    t = HEDGE_T / 2
    k = 0
    for s in (-1, 1):
        z, ns = GZ + s * HALF, "n" if s < 0 else "s"
        # north/south runs reach out over the corners
        for we, x0, x1 in (("w", GX - HALF - t, GX - 1.2), ("e", GX + 1.2, GX + HALF + t)):
            R.begin(b, f"garden:hedge-{ns}{we}")
            hedge_box(b, P, x0, x1, z - t, z + t, "+y -z +z -x +x", 700 + k)
            R.end()
            k += 1
    for s in (-1, 1):
        # west/east runs: no face against the north/south runs they butt
        x, we = GX + s * HALF, "w" if s < 0 else "e"
        R.begin(b, f"garden:hedge-{we}n", on=f"garden:hedge-n{we}")
        hedge_box(b, P, x - t, x + t, GZ - HALF + t, GZ - 1.2, "+y -x +x +z", 700 + k)
        R.end()
        R.begin(b, f"garden:hedge-{we}s", on=f"garden:hedge-s{we}")
        hedge_box(b, P, x - t, x + t, GZ + 1.2, GZ + HALF - t, "+y -x +x -z", 701 + k)
        R.end()
        k += 2


def topiary(b, P, R, x, z, i):
    """A topiary troll head on a hedge corner: a clipped ball, two pointed
    ears, the grin cut into it, looking in at the fountain."""
    R.begin(b, f"garden:topiary-{i}", on=f"garden:hedge-{'n' if z < GZ else 's'}{'w' if x < GX else 'e'}")
    r, y = 0.42, HEDGE_H
    cy = y + r * 0.95
    lathe(b, P["hedge"], x, z, [(0.0, 0.0)] + [(r * math.sin(math.pi * k / 8), r * 0.95 - r * math.cos(math.pi * k / 8)) for k in range(1, 8)] + [(0.0, r * 1.9)],
          seg=12, y0=y)
    d = (GX - x, GZ - z)
    L = math.hypot(*d)
    f = (d[0] / L, 0.0, d[1] / L)
    rt = (f[2], 0.0, -f[0])
    for s in (-1, 1):
        ex, ez = x + rt[0] * s * r * 0.8, z + rt[2] * s * r * 0.8
        lathe(b, P["hedge_lt"], ex, ez, [(0.13, 0.0), (0.08, 0.14), (0.0, 0.3)], seg=6, y0=cy + r * 0.35)
    troll_face(b, P["cut"], (x, cy, z), r, f)
    R.end()


def fountain(b, P, R):
    """The fountain: a moulded basin (its water the JS's at 0.5), a turned
    pedestal and a shallow bowl the jack sits on at 1.85."""
    R.begin(b, "garden:fountain")
    lathe(b, P["granite"], GX, GZ, [(2.32, 0.0), (2.3, 0.08), (2.2, 0.12), (2.2, 0.56), (2.29, 0.6), (2.3, 0.7), (2.22, 0.75),
                                     (1.95, 0.75), (1.95, 0.5)], seg=32, caps=False)
    lathe(b, P["granite_dk"], GX, GZ, [(0.38, 0.0), (0.38, 0.12), (0.3, 0.18), (0.24, 0.3), (0.2, 1.3), (0.26, 1.38), (0.28, 1.45),
                                        (0.2, 1.52), (0.3, 1.56), (0.9, 1.78), (0.92, 1.85), (0.0, 1.85)], seg=16, y0=0.5, caps=False)
    for i in range(10):                              # lichen patches on the basin's rim
        a = i * 0.63 + 0.3
        b.box(P["lichen"], 0.18, 0.012, 0.12, GX + math.cos(a) * 2.08, 0.75, GZ + math.sin(a) * 2.08, ry=-a)
    R.end()


def bench(b, P, R, x, z, i):
    """A stone bench (1.8 x 0.5, 0.5 high): two scrolled ends, a slab seat."""
    R.begin(b, f"garden:bench-{i}")
    for s in (-1, 1):
        b.box(P["granite_dk"], 0.22, 0.42, 0.46, x + s * 0.7, 0.0, z, bevel=0.02)
        b.box(P["granite_dk"], 0.3, 0.06, 0.5, x + s * 0.7, 0.0, z)
    b.box(P["granite"], 1.8, 0.08, 0.5, x, 0.42, z, bevel=0.02)
    b.box(P["lichen"], 0.3, 0.01, 0.2, x - 0.4, 0.5, z + 0.1, ry=0.4)
    R.end()


def birdbath(b, P, R):
    x, z = BIRDBATH
    R.begin(b, "garden:birdbath")
    lathe(b, P["granite"], x, z, [(0.0, 0.0), (0.24, 0.0), (0.24, 0.06), (0.16, 0.12), (0.09, 0.2), (0.07, 0.62), (0.1, 0.7),
                                   (0.32, 0.82), (0.34, 0.88), (0.28, 0.88), (0.0, 0.84)], seg=16)
    b.box(P["soil"], 0.4, 0.004, 0.4, x, 0.86, z)        # (rainwater gone brown)
    R.end()


def sundial(b, P, R):
    x, z = SUNDIAL
    R.begin(b, "garden:sundial")
    lathe(b, P["granite"], x, z, [(0.0, 0.0), (0.22, 0.0), (0.22, 0.08), (0.14, 0.14), (0.1, 0.25), (0.12, 0.55), (0.09, 0.75),
                                   (0.0, 0.75)], seg=8)
    b.box(P["granite_dk"], 0.42, 0.06, 0.42, x, 0.75, z, bevel=0.01)
    lathe(b, P["bronze"], x, z, [(0.17, 0.0), (0.17, 0.012), (0.0, 0.012)], seg=20, y0=0.81)
    for k in range(12):                              # the hour marks
        a = k / 12 * 2 * math.pi
        b.box(P["dial"], 0.01, 0.003, 0.03, x + math.cos(a) * 0.14, 0.822, z + math.sin(a) * 0.14, ry=-a)
    b.prism(P["bronze"], [(z - 0.13, 0.822), (z + 0.1, 0.822), (z - 0.13, 0.98)], x - 0.006, x + 0.006, axis="x")    # the gnomon, to the north
    R.end()


def bust(b, P, R, x, z, i):
    """A troll bust on a granite plinth: shoulders, a round head with the
    grin cut in, looking east down the path (0.6 square, 1.75 high)."""
    R.begin(b, f"garden:bust-{i}")
    b.box(P["granite_dk"], 0.6, 0.12, 0.6, x, 0.0, z, bevel=0.02)
    b.box(P["granite"], 0.48, 0.8, 0.48, x, 0.12, z)
    b.box(P["granite_dk"], 0.58, 0.08, 0.58, x, 0.92, z, bevel=0.015)
    M = P["marble"]
    lathe(b, M, x, z, [(0.18, 0.0), (0.22, 0.04), (0.18, 0.1), (0.1, 0.14), (0.26, 0.22), (0.24, 0.32), (0.12, 0.38), (0.07, 0.42)],
          seg=12, y0=1.0)
    r = 0.24
    lathe(b, M, x, z, [(0.0, 0.0)] + [(r * math.sin(math.pi * k / 8), r - r * math.cos(math.pi * k / 8)) for k in range(1, 8)] + [(0.0, 2 * r)],
          seg=12, y0=1.38)
    troll_face(b, P["granite_dk"], (x, 1.38 + r, z), r, (1.0, 0.0, 0.0))
    b.box(P["lichen"], 0.2, 0.01, 0.14, x - 0.05, 1.0, z + 0.1, ry=0.5)
    R.end()


def garden(b, P, R):
    hedges(b, P, R)
    for i, (sx, sz) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        topiary(b, P, R, GX + sx * HALF, GZ + sz * HALF, i)
    fountain(b, P, R)
    for i, (x, z) in enumerate(BENCHES):
        bench(b, P, R, x, z, i)
    birdbath(b, P, R)
    sundial(b, P, R)
    for i, (x, z) in enumerate(BUSTS):
        bust(b, P, R, x, z, i)
    for x, z, seed, h, r in TREES:
        dead_tree(b, P["bark"], P["bark_lt"], x, z, h=h, r=r, seed=seed, R=R, pid=f"garden:tree-{seed}")


# ------------------------------------------------------------------ the glasshouse

def runs(a, b_, gaps):
    """[a, b_] less the gaps."""
    out, cur = [], a
    for g0, g1 in sorted(gaps):
        if g0 > cur:
            out.append((cur, g0))
        cur = max(cur, g1)
    if cur < b_:
        out.append((cur, b_))
    return out


def side(b, P, axis, at, a, b_, doors, J):
    """One wall of the glasshouse along `axis` at `at` from a to b_: the
    dwarf wall and its sill, mullions every 1.5 m (none in a doorway), door
    posts and heads, glazing bars, the eave rail. The JS's glass: R() once a
    bay unless it is by a door (the panes it leaves out are smashed)."""
    gaps = [(c - w / 2, c + w / 2) for c, w in doors]

    def box(m, s0, s1, y0, y1, d0, d1):
        if axis == "x":
            fbox(b, m, s0, s1, y0, y1, at + d0, at + d1, "+y -y +z -z -x +x")
        else:
            fbox(b, m, at + d0, at + d1, y0, y1, s0, s1, "+y -y +x -x -z +z")

    for s0, s1 in runs(a, b_, gaps):
        if axis == "x":
            fbox(b, P["brick"], s0, s1, 0.0, 0.7, at - 0.12, at + 0.12, "+z -z" + (" -x" if s0 > a else "") + (" +x" if s1 < b_ else ""))
        else:
            fbox(b, P["brick"], at - 0.12, at + 0.12, 0.0, 0.7, s0, s1, "+x -x" + (" -z" if s0 > a else "") + (" +z" if s1 < b_ else ""))
        box(P["sill"], s0, s1, 0.7, 0.76, -0.16, 0.16)
    in_door = lambda s, pad=0.0: any(g0 - pad < s < g1 + pad for g0, g1 in gaps)     # noqa: E731
    s = a
    while s <= b_ + 0.01:
        if not in_door(s, 0.05):
            box(P["iron"], s - 0.035, s + 0.035, 0.76, EAVE, -0.035, 0.035)
        s += 1.5
    smashed = []
    s = a
    while s < b_ - 0.01:
        e = min(b_, s + 1.5)
        c = (s + e) / 2
        door = any(c > g0 - 0.4 and c < g1 + 0.4 for g0, g1 in gaps)
        if not door and J() < 0.25:
            smashed.append((s, e))
        if not in_door(c, 0.05):                      # the bay's half bar
            box(P["iron"], c - 0.017, c + 0.017, 0.76, EAVE, -0.017, 0.017)
        for y in (1.55, 2.4):                         # glazing bars across
            for p0, p1 in runs(s + 0.035, e - 0.035, gaps):
                box(P["iron"], p0, p1, y - 0.017, y + 0.017, -0.02, 0.02)
        s = e
    for g0, g1 in gaps:                               # door posts and the head
        for g in (g0, g1):
            box(P["iron"], g - 0.04, g + 0.04, 0.0, 2.4, -0.05, 0.05)
    box(P["iron"], a, b_, EAVE - 0.06, EAVE + 0.02, -0.05, 0.05)
    return smashed


def frame(b, P, R, J):
    R.begin(b, "glasshouse:frame")
    side(b, P, "x", Z1, G0, G1, S_DOORS, J)
    side(b, P, "x", Z0, G0, G1, N_DOORS, J)
    side(b, P, "z", G0, Z0, Z1, EW_DOOR, J)
    side(b, P, "z", G1, Z0, Z1, EW_DOOR, J)
    zc, half, rise = (Z0 + Z1) / 2, (Z1 - Z0) / 2, RIDGE - EAVE
    x = G0
    while x <= G1 + 0.01:                             # rafters
        for s in (-1, 1):
            b.cyl(P["iron"], 0.04, (x, EAVE, zc + s * half), (x, RIDGE, zc), seg=4, caps=False)
        x += 1.5
    for s in (-1, 1):                                 # purlins, mid-slope
        b.cyl(P["iron"], 0.025, (G0, EAVE + rise / 2, zc + s * half / 2), (G1, EAVE + rise / 2, zc + s * half / 2), seg=4, caps=False)
    fbox(b, P["iron"], G0, G1, RIDGE - 0.1, RIDGE + 0.02, zc - 0.05, zc + 0.05, "+y -z +z -x +x -y")
    x = G0 + 0.375
    while x < G1:                                     # the cresting: little spikes along the ridge
        lathe(b, P["iron"], x, zc, [(0.025, 0.0), (0.012, 0.1), (0.03, 0.12), (0.0, 0.2)], seg=4, y0=RIDGE + 0.02)
        x += 0.75
    for gx in (G0, G1):                               # the gables: a king bar, a roundel, the finial
        b.cyl(P["iron"], 0.03, (gx, EAVE, zc), (gx, RIDGE, zc), seg=4, caps=False)
        ring(b, P["iron"], (gx, EAVE + rise * 0.45, zc), 0.45, 0.02, seg=16, tseg=4, axis="x")
        lathe(b, P["iron"], gx, zc, [(0.05, 0.0), (0.03, 0.15), (0.07, 0.22), (0.0, 0.5)], seg=6, y0=RIDGE + 0.02)
    R.end()


def dead_plant(b, P, rnd, x, y, z, h):
    """Withered stalks and drooping leaves, the tallest reaching h."""
    for k in range(3):
        a = rnd.uniform(0, 6.3)
        hh = h * (1.0 if k == 0 else rnd.uniform(0.5, 0.8))
        tx, tz = x + math.cos(a) * 0.04 * k, z + math.sin(a) * 0.04 * k
        b.cyl(P["dry"], 0.012, (tx, y, tz), (tx + rnd.uniform(-0.04, 0.04), y + hh, tz + rnd.uniform(-0.04, 0.04)), seg=3, r2=0.005, caps=False)
    for k in range(4):
        a = rnd.uniform(0, 6.3)
        yy = y + rnd.uniform(0.1, h * 0.6)
        ca, sa = math.cos(a), math.sin(a)
        L = rnd.uniform(0.14, 0.24)
        p0 = (x, yy, z)
        p1 = (x + ca * L, yy - L * 0.6, z + sa * L)
        w = (-sa * 0.03, 0.0, ca * 0.03)
        q = [(p0[0] - w[0], p0[1], p0[2] - w[2]), (p0[0] + w[0], p0[1], p0[2] + w[2]), (p1[0], p1[1], p1[2]), (p1[0], p1[1] - 0.01, p1[2])]
        m = P["rot"] if rnd.random() < 0.5 else P["dry"]
        facing(b, m, q[:3], (ca * 0.6, 0.8, sa * 0.6))
        facing(b, m, q[:3], (-ca * 0.6, -0.8, -sa * 0.6))


def beds(b, P, R, J):
    rnd = random.Random(31)
    big = None
    for bi, (x, z, w, d) in enumerate(BEDS):
        R.begin(b, f"glasshouse:bed-{bi}", on="glasshouse:frame")
        fbox(b, P["brick"], x - w / 2, x + w / 2, 0.0, BED_H - 0.06, z - d / 2, z + d / 2, "+x -x +z -z")
        for (a0, a1, c0, c1) in ((x - w / 2, x + w / 2, z - d / 2, z - d / 2 + 0.12), (x - w / 2, x + w / 2, z + d / 2 - 0.12, z + d / 2),
                                 (x - w / 2, x - w / 2 + 0.12, z - d / 2 + 0.12, z + d / 2 - 0.12), (x + w / 2 - 0.12, x + w / 2, z - d / 2 + 0.12, z + d / 2 - 0.12)):
            fbox(b, P["sill"], a0 - 0.02, a1 + 0.02 if a1 == x + w / 2 else a1, BED_H - 0.06, BED_H, c0 - (0.02 if c0 == z - d / 2 else 0), c1 + (0.02 if c1 == z + d / 2 else 0), "+y +x -x +z -z")
        fbox(b, P["soil"], x - w / 2 + 0.12, x + w / 2 - 0.12, BED_H - 0.03, BED_H - 0.03, z - d / 2 + 0.12, z + d / 2 - 0.12, "+y")
        # the JS's plants, call for call: where each glowing flower stands
        flowers = []
        for i in range(round(w * 1.6)):
            px = x - w / 2 + 0.3 + J() * (w - 0.6)
            pz = z + (J() - 0.5) * (d - 0.4)
            J()                                       # (the leaf card's turn)
            glow = i % 3 == 0
            if glow:
                flowers.append((px, pz))
            dead_plant(b, P, rnd, px, BED_H - 0.03, pz, 1.12 - (BED_H - 0.03) if glow else rnd.uniform(0.25, 0.45))
        R.end()
        if bi == 2:
            big = flowers
    return big


def props(b, P, R, flowers):
    """The giant pumpkin on the long bed where no flower stands, pots,
    watering cans, the potting bench by the west door."""
    x, z, w, d = BEDS[2]
    best, bd = x, -1.0
    for k in range(41):
        cx = x - w / 2 + 0.8 + k * (w - 1.6) / 40
        dmin = min([abs(cx - fx) for fx, _ in flowers] + [9.0])
        if dmin > bd:
            best, bd = cx, dmin
    R.begin(b, "glasshouse:pumpkin", on=["glasshouse:bed-2", "glasshouse:frame"])
    pumpkin(b, P["pk"], P["stem"], best, BED_H - 0.03, z, 0.55, ribs=12, squash=0.7, seg=8, seed=88)
    R.end()
    rnd = random.Random(12)
    for bi, (bx, bz, bw, bdp) in enumerate(BEDS):    # a pot on each end of each bed's coping
        for s in (-1, 1):
            R.begin(b, f"glasshouse:pot-{bi}{'we'[s > 0]}", on=[f"glasshouse:bed-{bi}", "glasshouse:frame"])
            px, pz = bx + s * (bw / 2 - 0.06), bz + rnd.uniform(-0.2, 0.2) * bdp
            r = rnd.uniform(0.09, 0.13)
            lathe(b, P["terracotta"], px, pz, [(r * 0.7, 0.0), (r, r * 1.5), (r * 1.12, r * 1.55), (r * 1.12, r * 1.75), (r * 0.95, r * 1.75), (r * 0.9, r * 1.5)],
                  seg=10, y0=BED_H, caps=False)
            lathe(b, P["soil"], px, pz, [(r * 0.9, 0.0), (0.0, 0.0)], seg=10, y0=BED_H + r * 1.45)
            if rnd.random() < 0.6:
                dead_plant(b, P, rnd, px, BED_H + r * 1.45, pz, rnd.uniform(0.15, 0.3))
            R.end()
    for ci, (cx, cz, ry) in enumerate(((-1.7, -40.3, 0.5), (7.6, -41.3, 2.2))):
        R.begin(b, f"glasshouse:can-{ci}", on=[f"glasshouse:bed-{ci}", "glasshouse:frame"])
        lathe(b, P["zinc"], cx, cz, [(0.0, 0.0), (0.11, 0.0), (0.12, 0.02), (0.12, 0.24), (0.07, 0.27), (0.0, 0.27)], seg=10, y0=BED_H)
        ca, sa = math.cos(ry), math.sin(ry)
        b.cyl(P["zinc"], 0.018, (cx + ca * 0.1, BED_H + 0.06, cz + sa * 0.1), (cx + ca * 0.36, BED_H + 0.3, cz + sa * 0.36), seg=5, r2=0.012)
        lathe(b, P["zinc"], cx + ca * 0.38, cz + sa * 0.38, [(0.012, 0.0), (0.035, 0.03), (0.0, 0.035)], seg=6, y0=BED_H + 0.3)
        ring(b, P["zinc"], (cx, BED_H + 0.3, cz), 0.09, 0.01, seg=10, tseg=4, axis="x" if abs(sa) > 0.7 else "z", arc=math.pi)
        R.end()
    # the potting bench outside the west door: a slatted top, a shelf, pots and a trowel
    x, z = POTTING
    R.begin(b, "glasshouse:potting-bench", on="glasshouse:frame")    # (against the west wall's outside)
    for dz in (-0.82, 0.82):
        for dx in (-0.24, 0.24):
            b.box(P["bench"], 0.06, 0.88, 0.06, x + dx, 0.0, z + dz)
    for k in range(5):
        b.box(P["bench"], 0.6, 0.035, 0.32, x, 0.88, z - 0.72 + k * 0.36)
    b.box(P["bench"], 0.56, 0.03, 1.7, x, 0.25, z)
    b.box(P["bench"], 0.06, 0.3, 1.76, x + 0.27, 0.91, z)           # the back board, against the wall
    for k in range(4):
        px, pz = x - 0.05 + rnd.uniform(-0.08, 0.08), z - 0.55 + k * 0.33
        for st in range(1 + k % 3):                                   # pots, some stacked
            lathe(b, P["terracotta"], px, pz, [(0.07, 0.0), (0.1, 0.14), (0.11, 0.16), (0.0, 0.16)], seg=8, y0=0.915 + st * 0.07)
    b.box(P["iron"], 0.04, 0.02, 0.24, x - 0.12, 0.915, z + 0.7, ry=0.3)
    for k in range(3):                                                # pots under it
        lathe(b, P["terracotta"], x - 0.05, z - 0.5 + k * 0.45, [(0.09, 0.0), (0.13, 0.2), (0.14, 0.22), (0.0, 0.22)], seg=8, y0=0.28)
    R.end()


def glasshouse(b, P, R):
    J = js_rng(2026)                                  # buildOutskirts' R, read past the hollow
    for _ in range(11 * 2 + 11 * 30 + 5 + 27 + 15 + 22):
        J()
    frame(b, P, R, J)
    x0 = G0
    while x0 < G1 - 0.01:                             # the roof glass, R() a pane (the JS draws it)
        for _s in (-1, 1):
            J()
        x0 += 1.5
    flowers = beds(b, P, R, J)
    props(b, P, R, flowers)


def build_garden(P, R):
    b = HGBuilder()
    garden(b, P, R)
    glasshouse(b, P, R)
    for face in FACES:
        R.face(*face)
    b.finish("hg-garden.glb")


FACES = [
    ("door:glasshouse-sw", "glasshouse:frame", (-6.5, 1.2, Z1 + 0.06), (0, 0, 1), 1.4, 2.4),
    ("door:glasshouse-se", "glasshouse:frame", (6.5, 1.2, Z1 + 0.06), (0, 0, 1), 1.4, 2.4),
    ("door:glasshouse-n", "glasshouse:frame", (0.0, 1.2, Z0 - 0.06), (0, 0, -1), 1.6, 2.4),
    ("door:glasshouse-w", "glasshouse:frame", (G0 - 0.06, 1.2, -38.5), (-1, 0, 0), 1.4, 2.4),
    ("door:glasshouse-e", "glasshouse:frame", (G1 + 0.06, 1.2, -38.5), (1, 0, 0), 1.4, 2.4),
]
