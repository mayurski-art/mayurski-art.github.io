"""
Hollowgrin Island ("Troll Royale: Two Worlds"): Trollface Island's underside,
a Halloween trollface pumpkin, built like the top side (the user, 2026-10-28:
"the way the troll royale island is built that's how i want hollowgrin to be
built"). Scenery only: the fight stays inside Hollowgrin's invisible walls,
the island round it is seen from the planes and the fall. hg-island.glb, in
map coordinates, loaded by Troll Royale on Hollowgrin only
(maps/hollowgrin-island.js).

The shapes are the approved blueprint's (models/hollowgrin-island.json,
tools/troll-ops-hollowgrin-island-shapes.mjs): the top side's own coast;
the grin where its lake is, a closed pool of witch's brew (the river was
dropped, user 2026-10-28), its teeth the land; the eyes and the nose smaller
pools; the stem on the north coast, past the village's wall.

The look (user, 2026-10-28): "the orange border of the island should have a
strong bright hue to it and the island should appear dark from looking down
while in the plane". So the land is dark, the rind round the coast (a raised
band and the top of the cliff) glows a strong orange, the brew glows green;
under the rind the cliff is dark rock, hung with outcrops like the top
side's coast (tf_coast.py), 46 m down to the island's floor.
"""
import json
import math
import os
import random

from mathutils import geometry, Vector

from map_kit import TEXTURED, mat
from hg_kit import HGBuilder, facing

TEXTURED.update({"HG_IslandGrass", "HG_IslandRock"})
HERE = os.path.dirname(os.path.abspath(__file__))

LAND_Y = -0.04        # a hair under the game's ground plane (which covers the village)
LIP = 0.35            # the rind band's height over the land
BAND = 8.0            # the rind band's width
RIND_H = 4.5          # how far the glowing rind runs down the cliff
CLIFF = 46.0          # the cliff, as the top side's
POOL = 0.9            # how far the brew sits under the land
STEP = 2.5            # the coast resampled to this, for the walls and the band


def palette():
    return {
        "land": mat("HG_IslandGrass", 0x1c2416, 0.97),
        "rib": mat("HG_IslandRib", 0x0e140c, 0.97),
        "rind": mat("HG_IslandRind", 0xff6a12, 0.55, emit=0xff4a00, emit_strength=2.4),
        "rind2": mat("HG_IslandRindDark", 0xe85a0c, 0.55, emit=0xe03800, emit_strength=2.1),
        "lip": mat("HG_IslandRindLip", 0xff8a2a, 0.5, emit=0xff5500, emit_strength=2.6),
        "rock": mat("HG_IslandRock", 0x2e2a28, 0.95),
        "rock_dk": mat("HG_IslandRockDark", 0x1a1716, 0.95),
        "belly": mat("HG_IslandBelly", 0x120f0e, 0.97),
        "brew": mat("HG_IslandBrew", 0x2ec81e, 0.3, emit=0x22d014, emit_strength=1.3),
        "bank": mat("HG_IslandBank", 0x16300f, 0.9, emit=0x1a7a10, emit_strength=0.4),
        "stem_base": mat("HG_IslandStemBase", 0x4e6424, 0.85),
        "stem_mid": mat("HG_IslandStemMid", 0x6e6a32, 0.85),
        "stem_tip": mat("HG_IslandStemTip", 0x9a8250, 0.85),
        "cut": mat("HG_IslandStemCut", 0xc8b07a, 0.9),
        "cut_ring": mat("HG_IslandStemRing", 0x7a6236, 0.9),
    }


def ccw(poly):
    a = sum(x * w - u * z for (x, z), (u, w) in zip(poly, poly[1:] + poly[:1]))
    return poly if a > 0 else poly[::-1]


def inside(poly, x, z):
    c = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, zi = poly[i]
        xj, zj = poly[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
            c = not c
        j = i
    return c


def flat(b, m, outer, holes, y):
    """A face looking up at height y over outer minus holes."""
    loops = [[Vector((x, z, 0.0)) for x, z in p] for p in [outer] + holes]
    pts = [v for lp in loops for v in lp]
    for t in geometry.tessellate_polygon(loops):
        facing(b, m, [(pts[i].x, y, pts[i].y) for i in t], (0, 1, 0))


def resample(poly, step):
    out = []
    for (ax, az), (bx, bz) in zip(poly, poly[1:] + poly[:1]):
        n = max(1, math.ceil(math.hypot(bx - ax, bz - az) / step))
        out += [(ax + (bx - ax) * k / n, az + (bz - az) * k / n) for k in range(n)]
    return out


def inset(poly, d):
    """A ccw polygon pulled in by d, its mitres capped at 2d."""
    out = []
    n = len(poly)
    for i in range(n):
        (px, pz), (x, z), (qx, qz) = poly[i - 1], poly[i], poly[(i + 1) % n]
        e1 = Vector((x - px, z - pz)).normalized()
        e2 = Vector((qx - x, qz - z)).normalized()
        n1, n2 = Vector((-e1.y, e1.x)), Vector((-e2.y, e2.x))      # left of travel: inside
        nm = n1 + n2
        nm = n1 if nm.length < 1e-6 else nm.normalized()
        k = min(2.0, 1.0 / max(0.5, nm.dot(n1)))
        out.append((x + nm.x * d * k, z + nm.y * d * k))
    return out


def outward(a, c):
    """The outward normal (x, 0, z) of a ccw polygon's edge a-c."""
    dx, dz = c[0] - a[0], c[1] - a[1]
    L = math.hypot(dx, dz) or 1.0
    return (dz / L, 0.0, -dx / L)


def wall(b, m, a, c, y0, y1, want):
    facing(b, m, [(a[0], y0, a[1]), (c[0], y0, c[1]), (c[0], y1, c[1]), (a[0], y1, a[1])], want)


def build_island(P, R):
    S = json.load(open(os.path.join(HERE, "hollowgrin-island.json")))
    b = HGBuilder()
    rng = random.Random(1028)
    coast = ccw([tuple(p) for p in S["coast"]])
    pools = [ccw([tuple(p) for p in S["mouth"]])] + [ccw([tuple(p) for p in e]) for e in S["eyes"]] + [ccw([tuple(p) for p in S["nose"]])]
    edge = resample(coast, STEP)
    band = inset(edge, BAND)

    # the land: dark, the pools cut out of it (the band lies over its rim)
    flat(b, P["land"], coast, pools, LAND_Y)

    # the brew: each pool sunk under the land, its banks faintly lit by it
    for pool in pools:
        flat(b, P["brew"], pool, [], LAND_Y - POOL)
        for a, c in zip(pool, pool[1:] + pool[:1]):
            n = outward(a, c)
            wall(b, P["bank"], a, c, LAND_Y - POOL, LAND_Y, (-n[0], 0, -n[2]))   # facing into the pool

    # the rind: a raised band round the coast and the top of the cliff, a
    # strong bright orange, ribbed (two hues, a rib every ~7 m)
    run = 0.0
    for i, (a, c) in enumerate(zip(edge, edge[1:] + edge[:1])):
        ia, ic = band[i], band[(i + 1) % len(band)]
        n = outward(a, c)
        hue = P["rind"] if int(run / 7.0) % 2 == 0 else P["rind2"]
        run += math.hypot(c[0] - a[0], c[1] - a[1])
        facing(b, P["lip"], [(a[0], LAND_Y + LIP, a[1]), (c[0], LAND_Y + LIP, c[1]), (ic[0], LAND_Y + LIP, ic[1]), (ia[0], LAND_Y + LIP, ia[1])], (0, 1, 0))
        wall(b, P["lip"], ia, ic, LAND_Y, LAND_Y + LIP, (-n[0], 0, -n[2]))
        wall(b, hue, a, c, -RIND_H, LAND_Y + LIP, n)
        wall(b, P["rock"], a, c, -CLIFF, -RIND_H, n)
    facing_floor = [(x, -CLIFF, z) for x, z in coast]
    loops = [[Vector((x, z, 0.0)) for x, z in coast]]
    for t in geometry.tessellate_polygon(loops):
        facing(b, P["belly"], [facing_floor[i] for i in t], (0, -1, 0))

    # rock hung on the cliff under the rind, as the top side's coast: an
    # outcrop every 6 to 10 m, a bigger crag under some, darker going down
    for (ax, az), (cx, cz) in zip(coast, coast[1:] + coast[:1]):
        L = math.hypot(cx - ax, cz - az)
        if L < 0.5:
            continue
        tx, tz = (cx - ax) / L, (cz - az) / L
        ox, oz = tz, -tx
        s = rng.uniform(0.5, 3.0)
        while s < L - 0.5:
            x, z = ax + tx * s, az + tz * s
            w = rng.uniform(3.5, 6.5)
            out = rng.uniform(0.8, 2.6)
            top = -RIND_H - rng.uniform(0.3, 1.5)
            h = rng.uniform(2.0, 4.0)
            b.lump(P["rock"] if rng.random() < 0.6 else P["rock_dk"], w, h, out + 0.8, x + ox * out * 0.5, top - h, z + oz * out * 0.5,
                   seed=rng.randrange(1 << 20), rnd=0.6, jitter=0.18, ry=rng.uniform(0, 3))
            if rng.random() < 0.3:
                hh = rng.uniform(8.0, 20.0)
                b.lump(P["rock_dk"], w * 1.1, hh, out + 1.2, x + ox * out * 0.6, top - h - hh * 0.8, z + oz * out * 0.6,
                       seed=rng.randrange(1 << 20), rnd=0.6, jitter=0.16, ry=rng.uniform(0, 3))
            s += rng.uniform(6.0, 10.0)

    # rib grooves down the face, north to south, on the land only (not in
    # the brew, not over the village and its woods ring)
    for x0, bulge in ((-150.0, -30.0), (-75.0, -12.0), (75.0, 12.0), (150.0, 30.0)):
        prev = None
        for i in range(91):
            t = i / 90
            p = (x0 + 9.0 + bulge * math.sin(math.pi * t), -63.0 + 300.0 * t)
            ok = inside(coast, *p) and not any(inside(q, *p) for q in pools) and not (-75 < p[0] < 111 and -69 < p[1] < 69)
            if prev and ok:
                dx, dz = p[0] - prev[0], p[1] - prev[1]
                L = math.hypot(dx, dz)
                nx, nz = -dz / L * 0.9, dx / L * 0.9
                y = LAND_Y + 0.02
                facing(b, P["rib"], [(prev[0] - nx, y, prev[1] - nz), (p[0] - nx, y, p[1] - nz), (p[0] + nx, y, p[1] + nz), (prev[0] + nx, y, prev[1] + nz)], (0, 1, 0))
            prev = p if ok else None

    stem(b, P, S["stem"])
    b.finish("hg-island.glb")


def stem(b, P, at):
    """A real pumpkin's stem: fluted and woody, flaring where it grows out of
    the top, rising, curving off north over the coast and drooping a little,
    green at the root drying to tan, a pale cut end with its growth rings."""
    sx, sz = at
    sz += 8.0                                    # the root just inside the coast, clear of the village's wall
    C = [(sx, -1.0, sz), (sx, 12.0, sz - 1.0), (sx + 1.0, 21.0, sz - 8.0), (sx + 8.0, 18.0, sz - 23.0)]

    def bez(t):
        u = 1 - t
        return tuple(u ** 3 * C[0][k] + 3 * u * u * t * C[1][k] + 3 * u * t * t * C[2][k] + t ** 3 * C[3][k] for k in range(3))

    def radius(t):
        return 5.0 - 1.6 * t + 3.0 * math.exp(-t * 12.0)

    RINGS, SEG, FLUTES = 28, 40, 10
    rings = []
    up = Vector((1.0, 0.0, 0.0))
    for i in range(RINGS + 1):
        t = i / RINGS
        c = Vector(bez(t))
        d = (Vector(bez(min(1, t + 0.01))) - Vector(bez(max(0, t - 0.01)))).normalized()
        nrm = d.cross(up).normalized()
        bin_ = d.cross(nrm).normalized()
        r = radius(t)
        ring = []
        for j in range(SEG):
            a = 2 * math.pi * j / SEG
            f = 0.84 + 0.16 * abs(math.cos(FLUTES * a / 2)) ** 0.6       # the flutes
            v = c + (nrm * math.cos(a) + bin_ * math.sin(a)) * r * f
            ring.append(tuple(v))
        rings.append((t, ring, c, d, r))
    for (t0, r0, _, _, _), (t1, r1, _, _, _) in zip(rings, rings[1:]):
        tm = (t0 + t1) / 2
        for j in range(SEG):
            k = (j + 1) % SEG
            m = P["stem_base"] if tm < 0.35 else P["stem_mid"] if tm < 0.7 else P["stem_tip"]
            vs = [b.bm.verts.new(p) for p in (r0[j], r0[k], r1[k], r1[j])]
            f = b.bm.faces.new(vs)
            f.material_index = b._mi(m)
            f.normal_update()
            mid = Vector(r0[j]) - Vector(bez(tm))
            if f.normal.dot(mid) < 0:
                f.normal_flip()
    # the cut end: pale wood, its rings a touch proud of it
    _, tip, c, d, r = rings[-1]
    cen = b.bm.verts.new(tuple(c))
    vs = [b.bm.verts.new(p) for p in tip]
    for j in range(SEG):
        f = b.bm.faces.new((cen, vs[j], vs[(j + 1) % SEG]))
        f.material_index = b._mi(P["cut"])
        f.normal_update()
        if f.normal.dot(d) < 0:
            f.normal_flip()
    for s in (0.7, 0.45, 0.2):
        pts = [tuple(c + d * 0.04 + (Vector(p) - c) * s) for p in tip]
        inner = [tuple(c + d * 0.04 + (Vector(p) - c) * (s - 0.06)) for p in tip]
        for j in range(SEG):
            k = (j + 1) % SEG
            vv = [b.bm.verts.new(q) for q in (pts[j], pts[k], inner[k], inner[j])]
            f = b.bm.faces.new(vv)
            f.material_index = b._mi(P["cut_ring"])
            f.normal_update()
            if f.normal.dot(d) < 0:
                f.normal_flip()
