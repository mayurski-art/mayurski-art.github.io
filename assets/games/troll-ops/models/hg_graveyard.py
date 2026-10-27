"""
Hollowgrin's graveyard (phase 2 of "Troll Forces: Hollowgrin in Blender"):
hg-graveyard.glb, in map coordinates. The iron fence and both gates, the
stones (eight kinds of headstone, crosses, obelisks), the graves (curbed,
or open with a mound and a shovel), the monument as a weeping angel, urns,
wreaths, the gravedigger's barrow, two dead trees, skulls in the
mausoleum's niches. The mausoleum itself stays hg-mausoleum.glb.

Drawn over the colliders maps/hollowgrin.js lays: the stones' positions,
kinds and sizes come from the JS's own random stream (hg_kit.js_rng(66),
the calls in the same order), so each stone stands in its collider. The JS
keeps the candles, the lanterns, the epitaphs, the sign, the stained glass,
the cobwebs and the lights.
"""
import math
import random

from map_kit import TEXTURED, mat
from hg_kit import HGBuilder, dead_tree, facing, fbox, headstone_profile, js_rng, lathe, ring, slab

TEXTURED.update({"HG_Granite", "HG_GraniteDark"})

FENCE = [("x", -6.0, -35.6, -26.6), ("x", -6.0, -23.4, -16.0), ("x", 20.0, -35.6, -23.6), ("x", 20.0, -20.4, -16.0),
         ("z", -16.0, -6.0, 0.4), ("z", -16.0, 3.6, 12.4), ("z", -16.0, 15.6, 20.0),
         ("z", -35.6, -6.0, 0.4), ("z", -35.6, 3.6, 20.0)]
ROWS = [-33.4, -30.4, -27.2, -22.6, -19.6]
ZS = [-4.5, -2.0, 5.0, 7.5, 10.0, 12.5, 15.0, 17.5]
OPEN = {(-33.4, -2.0), (-30.4, -4.5), (-27.2, 17.5), (-22.6, 10.0), (-19.6, -4.5), (-19.6, 15.0), (-22.6, 5.0), (-33.4, 17.5)}
MONUMENT = (-24.0, 2.0)


def palette():
    return {
        "granite": mat("HG_Granite", 0x8c8c94, 0.9),
        "granite_dk": mat("HG_GraniteDark", 0x5a5a62, 0.9),
        "slate": mat("HG_SlateStone", 0x4a4e58, 0.85),
        "marble": mat("HG_OldMarble", 0xb8b4a8, 0.7),
        "moss": mat("HG_Moss", 0x3a4a2c, 0.95),
        "lichen": mat("HG_Lichen", 0x8a9a5a, 0.95),
        "iron": mat("HG_Iron", 0x1c1c22, 0.55, 0.3),
        "rust": mat("HG_Rust", 0x4a2e1c, 0.9),
        "dirt": mat("HG_GraveDirt", 0x3a2e24, 1.0),
        "dirt_dk": mat("HG_GraveHole", 0x0e0c0a, 1.0),
        "wood": mat("HG_BarrowWood", 0x5a4030, 0.85),
        "steel": mat("HG_ToolSteel", 0x6a6e74, 0.5, 0.3),
        "wreath": mat("HG_Wreath", 0x2a4a24, 0.95),
        "ribbon": mat("HG_Ribbon", 0x8a1a22, 0.6),
        "bone": mat("HG_Bone", 0xd8d0b8, 0.7),
        "bark": mat("HG_OakBark", 0x2e2620, 0.95),
        "bark_lt": mat("HG_OakBarkLight", 0x3e342c, 0.95),
        "grass": mat("HG_GraveGrass", 0x2c3a24, 1.0),
    }


def box2(b, m, x0, x1, y0, y1, z0, z1, **kw):
    b.box(m, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2, **kw)


# ------------------------------------------------------------------ the fence

def fence_run(b, P, axis, at, a, b_, h=1.9):
    """hollowgrin.js ironFence(): two rails, spear-topped bars every 0.16 m
    leaning a little, a post with a ball every 2.5 m."""
    L = b_ - a
    if L < 0.1:
        return
    c = (a + b_) / 2
    for ry in (0.35, h - 0.3):
        if axis == "x":
            box2(b, P["iron"], a, b_, ry, ry + 0.05, at - 0.025, at + 0.025)
        else:
            box2(b, P["iron"], at - 0.025, at + 0.025, ry, ry + 0.05, a, b_)
    bars = round(L / 0.16)
    for i in range(bars + 1):
        s = a + L * i / bars
        lean = math.sin(s * 1.7) * 0.025
        x, z = (s, at) if axis == "x" else (at, s)
        b.box(P["iron"], 0.025, h, 0.025, x, 0, z, rx=lean if axis == "x" else 0.0, rz=lean if axis == "z" else 0.0)
        b.cyl(P["iron"], 0.035, (x, h, z), (x, h + 0.14, z), seg=4, r2=0.0, caps=False)
    posts = max(1, round(L / 2.5))
    for i in range(posts + 1):
        s = a + L * i / posts
        x, z = (s, at) if axis == "x" else (at, s)
        b.box(P["iron"], 0.1, h + 0.12, 0.1, x, 0, z)
        lathe(b, P["iron"], x, z, [(0.0, 0), (0.06, 0.02), (0.07, 0.07), (0.05, 0.12), (0.0, 0.14)], seg=8, y0=h + 0.12)


def gate(b, P, R, x, z0, z1, h, arch, leaves):
    """A gate in the fence: stone pillars with caps and balls at z0 and z1,
    an iron arch over (the main gate), the leaves swung in against the fence."""
    for gz in (z0, z1):
        R.begin(b, f"graveyard:pillar-{x}-{gz}", on="graveyard:fence")
        b.box(P["granite"], 0.6, h, 0.6, x, 0, gz)
        for y in (0.45, 1.3):          # ashlar joints
            box2(b, P["granite_dk"], x - 0.305, x + 0.305, y, y + 0.02, gz - 0.305, gz + 0.305)
        b.box(P["granite_dk"], 0.75, 0.15, 0.75, x, h, gz, bevel=0.02)
        lathe(b, P["granite"], x, gz, [(0.0, 0), (0.18, 0.02), (0.22, 0.12), (0.2, 0.26), (0.12, 0.36), (0.0, 0.4)], seg=10, y0=h + 0.15)
        R.end()
    if arch:
        R.begin(b, "graveyard:gate-arch", on=[f"graveyard:pillar-{x}-{z0}", f"graveyard:pillar-{x}-{z1}", "graveyard:fence"])
        ring(b, P["iron"], (x, h, (z0 + z1) / 2), (z1 - z0) / 2, 0.05, seg=20, tseg=6, axis="x", arc=math.pi, a0=0.0)
        for k in range(7):             # scrolls under the arch
            a = math.pi * (k + 0.5) / 7
            cz, cy = (z0 + z1) / 2 + math.cos(a) * (z1 - z0) / 2, h + math.sin(a) * (z1 - z0) / 2
            b.cyl(P["iron"], 0.015, (x, cy - 0.05, cz), (x + 0.0, cy - 0.3, cz - math.cos(a) * 0.2), seg=4, caps=False)
        R.end()
    if leaves:
        for gz, d in ((z0 + 0.3, -1), (z1 - 0.3, 1)):
            R.begin(b, f"graveyard:gate-leaf-{d}", on=[f"graveyard:pillar-{x}-{round(gz - d * 0.3, 1)}", "graveyard:fence"])
            lx = x - 0.9
            for y in (0.1, 1.7):
                box2(b, P["iron"], lx - 0.8, lx + 0.8, y, y + 0.05, gz + d * 0.05 - 0.02, gz + d * 0.05 + 0.02)
            for i in range(9):
                bx = x - 0.2 - i * 0.18
                b.box(P["iron"], 0.025, 1.75 - (0.0 if i in (0, 8) else 0.0), 0.025, bx, 0.1, gz + d * 0.05)
                b.cyl(P["iron"], 0.03, (bx, 1.85, gz + d * 0.05), (bx, 1.95, gz + d * 0.05), seg=4, r2=0.0, caps=False)
            R.end()


# ------------------------------------------------------------------ the stones

def headstone(b, P, R, x, z, w, h, kind, twist, tilt, rnd, k):
    m = (P["granite"], P["granite_dk"], P["slate"], P["marble"])[rnd.randrange(4)]
    R.begin(b, f"graveyard:stone-{k}")
    slab(b, m, headstone_profile(w, h, kind), 0.18, x, 0.0, z, ry=math.pi / 2 + twist)
    # a plinth under the tablet, lichen on the top of the taller ones
    b.box(P["granite_dk"], 0.3, 0.08, w + 0.12, x, 0, z, ry=twist)
    if rnd.random() < 0.5:
        b.lump(P["lichen"] if rnd.random() < 0.5 else P["moss"], 0.08, 0.03, w * 0.5, x + 0.0, h - 0.03, z + (rnd.random() - 0.5) * w * 0.4, seed=k, rnd=0.7, jitter=0.01, ry=twist)
    if kind == 2 and rnd.random() < 0.6:        # an urn on a shouldered stone
        lathe(b, m, x, z, [(0.0, 0), (0.1, 0.01), (0.06, 0.05), (0.09, 0.12), (0.11, 0.22), (0.07, 0.3), (0.1, 0.33), (0.0, 0.34)], seg=8, y0=h)
    R.end()
    if rnd.random() < 0.3:                      # a wreath leaned on the front
        R.begin(b, f"graveyard:wreath-{k}", on=[f"graveyard:stone-{k}", f"graveyard:curb-{k}", f"graveyard:grave-{k}"])
        wx = x + 0.2
        ring(b, P["wreath"], (wx, 0.22, z), 0.17, 0.05, seg=12, tseg=5, axis="x", a0=0.0)
        b.box(P["ribbon"], 0.02, 0.12, 0.16, wx + 0.03, 0.0, z, ry=0.2)
        R.end()


def cross(b, P, R, x, z, twist, tilt, rnd, k):
    m = P["granite"] if rnd.random() < 0.6 else P["marble"]
    R.begin(b, f"graveyard:cross-{k}")
    b.box(P["granite_dk"], 0.4, 0.14, 0.5, x, 0, z, ry=twist)
    b.box(P["granite_dk"], 0.3, 0.1, 0.36, x, 0.14, z, ry=twist)
    b.box(m, 0.16, 1.1, 0.16, x, 0.24, z, ry=twist, rz=tilt)
    b.box(m, 0.16, 0.14, 0.7, x - math.sin(tilt) * 0.95, 0.8 + math.cos(tilt) * 0.0, z, ry=twist, rz=tilt)
    if rnd.random() < 0.4:                      # a Celtic ring
        ring(b, m, (x - math.sin(tilt) * 0.95, 0.87, z), 0.26, 0.035, seg=16, tseg=5, axis="x")
    R.end()


def obelisk(b, P, R, x, z, twist, rnd, k):
    R.begin(b, f"graveyard:obelisk-{k}")
    b.box(P["granite_dk"], 0.55, 0.3, 0.55, x, 0, z, ry=twist, bevel=0.02)
    b.box(P["granite"], 0.44, 0.1, 0.44, x, 0.3, z, ry=twist)
    b.frustum(P["granite"], 0.36, 0.36, 0.22, 0.22, 0.4, 1.4, x=x, z=z)
    b.frustum(P["granite"], 0.22, 0.22, 0.0, 0.0, 1.4, 1.66, x=x, z=z)
    R.end()


def open_grave(b, P, R, gx, z, rnd, k, sid):
    """A fresh grave: a dark pit in a dirt rim, the spoil heaped beside it,
    a shovel stuck in the heap. (Zombies climb out of these.)"""
    R.begin(b, f"graveyard:grave-{k}", on=sid)
    fbox(b, P["dirt_dk"], gx - 0.75, gx + 0.75, 0.03, 0.03, z - 0.32, z + 0.32, "+y")
    for x0, x1, z0, z1 in ((gx - 0.95, gx - 0.75, z - 0.5, z + 0.5), (gx + 0.75, gx + 0.95, z - 0.5, z + 0.5),
                           (gx - 0.95, gx + 0.95, z - 0.5, z - 0.32), (gx - 0.95, gx + 0.95, z + 0.32, z + 0.5)):
        b.lump(P["dirt"], x1 - x0, 0.12, z1 - z0, (x0 + x1) / 2, 0.0, (z0 + z1) / 2, seed=k * 3, rnd=0.3, jitter=0.02)
    b.lump(P["dirt"], 1.5, 0.5, 0.75, gx + 0.2, 0.0, z + 0.85, seed=k * 5 + 1, rnd=0.7, jitter=0.03)
    if rnd.random() < 0.7:
        sx, sz = gx + 0.5, z + 0.95
        b.cyl(P["wood"], 0.02, (sx, 0.4, sz), (sx + 0.35, 1.35, sz - 0.2), seg=5)
        b.box(P["steel"], 0.2, 0.3, 0.015, sx - 0.05, 0.12, sz + 0.05, rz=0.3, ry=0.6)
        b.box(P["wood"], 0.12, 0.03, 0.03, sx + 0.35, 1.34, sz - 0.2, ry=0.6)
    R.end()


def curb(b, P, R, gx, z, rnd, k, sid):
    R.begin(b, f"graveyard:curb-{k}", on=sid)
    m = P["granite_dk"] if rnd.random() < 0.7 else P["marble"]
    box2(b, m, gx - 0.9, gx + 0.9, 0, 0.12, z - 0.46, z - 0.38)
    box2(b, m, gx - 0.9, gx + 0.9, 0, 0.12, z + 0.38, z + 0.46)
    box2(b, m, gx + 0.82, gx + 0.9, 0, 0.12, z - 0.46, z + 0.46)
    if rnd.random() < 0.5:
        fbox(b, P["grass"], gx - 0.88, gx + 0.82, 0.04, 0.04, z - 0.38, z + 0.38, "+y")
    else:
        fbox(b, P["dirt"], gx - 0.88, gx + 0.82, 0.04, 0.04, z - 0.38, z + 0.38, "+y")
    R.end()


def angel(b, P, R):
    """The monument where the aisle crosses the lane: a weeping angel on a
    pedestal, kneeling, head down on her arms over the top of a cross, her
    wings folded and drooping behind (the JS's 1.3 m plinth and 0.8 m
    shaft colliders)."""
    x, z = MONUMENT
    M = P["marble"]
    R.begin(b, "graveyard:monument")
    b.box(P["granite_dk"], 1.3, 0.5, 1.3, x, 0, z, bevel=0.02)
    b.box(P["granite"], 1.0, 0.12, 1.0, x, 0.5, z, bevel=0.015)
    b.box(P["granite"], 0.8, 0.9, 0.8, x, 0.62, z)
    b.box(P["granite"], 0.96, 0.1, 0.96, x, 1.52, z, bevel=0.015)
    y = 1.62
    # the cross she leans on, at the front (east), its foot on the pedestal
    b.box(M, 0.14, 1.9, 0.14, x + 0.22, y, z)
    b.box(M, 0.14, 0.14, 0.62, x + 0.22, y + 1.5, z)
    # the robe: a kneeling figure, hem pooled on the pedestal, hips, waist, shoulders
    lathe(b, M, x - 0.1, z, [(0.0, 0), (0.4, 0.02), (0.38, 0.1), (0.3, 0.3), (0.25, 0.55), (0.22, 0.8), (0.17, 1.0), (0.2, 1.2), (0.26, 1.35),
                              (0.24, 1.45), (0.1, 1.52), (0.0, 1.54)], seg=12, y0=y)
    # the knees: two rounds at the front of the hem
    for s in (-1, 1):
        b.lump(M, 0.22, 0.22, 0.26, x + 0.12, y + 0.02, z + s * 0.16, seed=20 + s, rnd=0.9, jitter=0.005)
    # arms crossed on the cross's arm, the head down on them
    for s in (-1, 1):
        b.cyl(M, 0.055, (x - 0.08, y + 1.3, z + s * 0.18), (x + 0.22, y + 1.62, z - s * 0.12), seg=6, r2=0.045)
    b.lump(M, 0.26, 0.24, 0.24, x + 0.02, y + 1.52, z, seed=11, rnd=0.9, jitter=0.005)
    b.lump(M, 0.3, 0.12, 0.3, x - 0.08, y + 1.62, z, seed=12, rnd=0.6, jitter=0.01)      # hair, down over the arms
    # wings: folded, drooping down her back, each a feathered profile
    feathers = []
    for k in range(6):
        t = k / 5
        feathers += [(0.12 + t * 0.5, -0.1 - t * 1.1), (0.2 + t * 0.5, -0.02 - t * 1.1)]
    prof = [(0.0, 0.0), (0.3, 0.25), (0.62, 0.05)] + feathers[::-1] + [(0.1, -1.25), (0.0, -0.9)]
    for s in (-1, 1):
        slab(b, M, prof, 0.05, x - 0.3, y + 1.35, z + s * 0.14, ry=s * 0.3 + math.pi / 2 * 0.0)
    R.end()


def barrow(b, P, R):
    """The gravedigger's barrow, tipped against the inside of the east
    fence by the south-east gap (on the fence's collider line)."""
    x, z = -16.7, 14.0
    R.begin(b, "graveyard:barrow")
    b.box(P["wood"], 0.5, 0.04, 1.1, x, 0.42, z, rz=0.5)
    for dx in (-0.24, 0.24):
        b.box(P["wood"], 0.03, 0.32, 1.0, x + dx * math.cos(0.5), 0.46 + dx * math.sin(0.5) * -1, z, rz=0.5)
    b.box(P["wood"], 0.5, 0.3, 0.03, x, 0.44, z - 0.5, rz=0.5)
    ring(b, P["rust"], (x + 0.1, 0.2, z + 0.75), 0.2, 0.03, seg=14, tseg=5, axis="x")
    for dz in (-0.2, 0.2):
        b.cyl(P["wood"], 0.025, (x - 0.2, 0.3, z + 0.55), (x - 0.35, 0.05, z - 0.5 + dz * 0.1), seg=5)
    b.cyl(P["wood"], 0.02, (x - 0.2, 0.3, z + 0.4), (x + 0.1, 0.45, z - 0.9), seg=5)   # handle
    b.cyl(P["wood"], 0.02, (x - 0.3, 0.4, z - 0.6), (x - 0.3, 1.5, z - 0.9), seg=5)
    b.box(P["steel"], 0.14, 0.26, 0.015, x - 0.3, 0.3, z - 0.55, rz=0.1)
    R.end()


def skulls(b, P, R):
    """Skulls in the mausoleum's niches (hg-mausoleum.glb: three a wall,
    two levels, on the north and south walls)."""
    rnd = random.Random(9)
    R.begin(b, "graveyard:niche-skulls", on="landmark:mausoleum")
    for zz, s in ((8.5, 1), (13.5, -1)):
        for xx in (-29.6, -27.6, -26.2):
            for lv in (0.6, 1.75):
                if rnd.random() < 0.75:
                    b.lump(P["bone"], 0.15, 0.14, 0.17, xx + rnd.uniform(-0.1, 0.1), lv + 0.14, zz + s * 0.2, seed=int(xx * 10 + lv * 7), rnd=0.75, jitter=0.01)
    R.end()


def build_graveyard(P, R):
    b = HGBuilder()
    rnd = random.Random(66)
    for axis, at, a, b_ in FENCE:
        R.begin(b, "graveyard:fence")            # one prop in nine runs
        fence_run(b, P, axis, at, a, b_)
        R.end()
    gate(b, P, R, -16.0, 0.1, 3.9, 2.5, arch=True, leaves=True)
    gate(b, P, R, -35.6, 0.1, 3.9, 2.3, arch=False, leaves=False)
    # the stones, in the JS's order and from its numbers (hollowgrin.js: rng(66))
    J = js_rng(66)
    k = 0
    for x in ROWS:
        for z in ZS:
            if -31.5 < x < -24.5 and 6 < z < 15:
                continue
            k += 1
            kind = J()
            tilt, twist = (J() - 0.5) * 0.14, (J() - 0.5) * 0.12
            if kind < 0.62:
                w, h = 0.62 + J() * 0.2, 0.8 + J() * 0.35
                J()                                   # (the JS's colour pick)
                headstone(b, P, R, x, z, w, h, rnd.randrange(8), twist, tilt, rnd, k)
                sid = f"graveyard:stone-{k}"
            elif kind < 0.84:
                cross(b, P, R, x, z, twist, tilt, rnd, k)
                sid = f"graveyard:cross-{k}"
            else:
                obelisk(b, P, R, x, z, twist, rnd, k)
                sid = f"graveyard:obelisk-{k}"
            gx = x + 1.05
            if (x, z) in OPEN:
                open_grave(b, P, R, gx, z, rnd, k, sid)
            elif J() < 0.6:
                curb(b, P, R, gx, z, rnd, k, sid)
            J()                                       # (the JS's candle pick)
    angel(b, P, R)
    barrow(b, P, R)
    skulls(b, P, R)
    for (x, z, seed, h) in ((-34.2, 6.2, 777, 7.0), (-16.9, 8.8, 778, 6.0)):
        dead_tree(b, P["bark"], P["bark_lt"], x, z, h=h, r=0.3 if h > 6.5 else 0.26, seed=seed, R=R, pid=f"graveyard:tree-{seed}")
    b.finish("hg-graveyard.glb")
