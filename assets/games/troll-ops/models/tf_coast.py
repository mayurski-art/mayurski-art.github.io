"""
The coast (build_trollface_island.blender.py, phase 3), drawn at the
island's origin (x east, z south) round the coastline in the layout file:

  rock outcrops hung on the cliff all the way round, jutting 1 to 4 m out
  from the edge with their tops just under it, so the island's rim reads as
  broken rock rather than a clean extruded wall
  sand shelves where the coast is beach (the art's beige edges): wide flat
  ledges 1.2 to 2 m below the rim with a lip of rock, stepping down
  the cliffs under the Portal and the Gallery (the art's grey crags): taller
  bands of rock columns down the face, darker, deeper

All of it hangs outside the coastline, below the rim: nothing a player can
reach (the edge is an invisible wall), so it registers no colliders and the
coast's height contract (under 0.25 m) is untouched.
"""
import json
import math
import os
import random

from map_kit import mat

HERE = os.path.dirname(os.path.abspath(__file__))
LOOT = []
SIGNS = []
# where the cliffs are tall (the art's crags): (x, z, reach)
CRAGS = [(120.8, -100.6, 60.0), (-99.0, 45.3, 55.0)]
# where the coast is beach (sand shelves): (x, z, reach)
BEACHES = [(-170.0, -10.0, 45.0), (175.0, 30.0, 40.0), (60.0, 132.0, 45.0)]


def palette():
    return {
        "rock": mat("TF_CoastRock", 0x6b7280, 0.95),
        "rock_dk": mat("TF_CoastRockDark", 0x464c57, 0.95),
        "rock_lt": mat("TF_CoastRockLight", 0x8a919c, 0.95),
        "sand": mat("TF_Sand", 0xf0dcb0, 0.95),
        "sand_dk": mat("TF_SandWet", 0xd8bf8a, 0.95),
        "grass": mat("TF_CoastGrass", 0x5fc46e, 0.9),
    }


def near(points, x, z):
    best = 0.0
    for (px, pz, reach) in points:
        d = math.hypot(x - px, z - pz)
        best = max(best, max(0.0, 1.0 - d / reach))
    return best


def build(b, P, R, origin):
    LOOT.clear()
    SIGNS.clear()
    rng = random.Random(53)
    with open(os.path.join(HERE, "trollface-island-layout.json"), encoding="utf8") as f:
        L = json.load(f)
    edge = L["edge"]
    # winding: outward normal = the edge direction turned toward outside
    area = sum(edge[i][0] * edge[(i + 1) % len(edge)][1] - edge[(i + 1) % len(edge)][0] * edge[i][1] for i in range(len(edge)))
    sgn = 1.0 if area > 0 else -1.0
    n = len(edge)
    for i in range(n):
        (ax, az), (bx, bz) = edge[i], edge[(i + 1) % n]
        L_ = math.hypot(bx - ax, bz - az)
        if L_ < 0.5:
            continue
        tx, tz = (bx - ax) / L_, (bz - az) / L_
        ox, oz = -tz * sgn, tx * sgn                     # outward
        # walk the side, a piece every 3 to 6 m
        s = rng.uniform(0.5, 2.5)
        while s < L_ - 0.5:
            x, z = ax + tx * s, az + tz * s
            crag = near(CRAGS, x, z)
            beach = near(BEACHES, x, z) * (1.0 - crag)
            if beach > 0.35 and rng.random() < 0.75:
                # a sand shelf: a flat ledge below the rim, a rock lip at its edge
                w = rng.uniform(6.0, 9.0)
                out = rng.uniform(2.0, 3.6)
                y = -rng.uniform(1.2, 2.0)
                cx, cz = x + ox * out / 2, z + oz * out / 2
                ry = -math.atan2(tz, tx)
                b.box(P["sand"], w, 0.5, out, cx, y - 0.5, cz, ry=ry)
                b.lump(P["rock"], w * 0.95, 1.6, 1.2, x + ox * (out + 0.2), y - 1.4, z + oz * (out + 0.2), seed=rng.randrange(1 << 20), rnd=0.55, jitter=0.18, ry=ry)
                b.lump(P["rock_dk"], w * 0.8, 2.6, out * 0.9, cx, y - 3.0, cz, seed=rng.randrange(1 << 20), rnd=0.55, jitter=0.18, ry=ry)
                s += w * 0.85
                continue
            if crag > 0.15:
                # a tall column of rock down the face, darker as it goes
                h = 6.0 + crag * rng.uniform(8.0, 16.0)
                w = rng.uniform(3.5, 6.0)
                out = rng.uniform(0.8, 2.4) * (0.6 + crag)
                top = -rng.uniform(0.15, 0.5)
                b.lump(P["rock_lt"], w, 1.8, out + 0.8, x + ox * out * 0.5, top - 1.8, z + oz * out * 0.5, seed=rng.randrange(1 << 20), rnd=0.6, jitter=0.2, ry=rng.uniform(0, 3))
                b.lump(P["rock_dk"], w * 1.1, h, out + 1.2, x + ox * out * 0.6, top - 1.6 - h, z + oz * out * 0.6, seed=rng.randrange(1 << 20), rnd=0.6, jitter=0.16, ry=rng.uniform(0, 3))
                s += w * rng.uniform(0.7, 1.0)
                continue
            # an ordinary outcrop under the rim, a smaller one below it
            w = rng.uniform(3.0, 5.5)
            out = rng.uniform(0.6, 2.2)
            top = -rng.uniform(0.2, 0.9)
            b.lump(P["rock"] if rng.random() < 0.7 else P["rock_lt"], w, rng.uniform(1.4, 2.6), out + 0.8, x + ox * out * 0.5, top - 2.0, z + oz * out * 0.5, seed=rng.randrange(1 << 20), rnd=0.6, jitter=0.18, ry=rng.uniform(0, 3))
            if rng.random() < 0.2:
                b.lump(P["rock_dk"], w * 0.8, rng.uniform(2.0, 4.0), out + 0.5, x + ox * out * 0.4, top - 6.0, z + oz * out * 0.4, seed=rng.randrange(1 << 20), rnd=0.6, jitter=0.18, ry=rng.uniform(0, 3))
            if rng.random() < 0.12:                                                 # a tuft of grass on its top
                b.lump(P["grass"], w * 0.5, 0.25, out * 0.6, x + ox * out * 0.5, top - 0.1, z + oz * out * 0.5, seed=rng.randrange(1 << 20), rnd=0.4, jitter=0.12)
            s += rng.uniform(6.0, 10.0)
    b.finish("tf-coast-p3.glb")
