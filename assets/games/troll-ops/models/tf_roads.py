"""
The roads and the lake boardwalks (build_trollface_island.blender.py, phase
3), drawn at the island's origin (x east, z south) from the layout file's
road network (maps/trollface-island.js ROAD_NET, 6 m wide, flattened under
by tools/troll-ops-island-ground-flatten.mjs) and its parking spots:

  the asphalt ribbon of every road 3.5 cm over the ground, a white edge line
  each side, the centre line dashed, the paint stopping short of every
  junction and a round patch of asphalt filling the junction's corners; the
  parking bays outlined beside the road where PARKING puts them
  mile posts every 100 m along the north and the shore roads, power poles
  along the north road with their wires sagging pole to pole, two wrecked
  cars in the gaps (cover), the bus shelter at the Marketplace junction
  the two lake boardwalks (west: the Cave's shore to the south shore by the
  river; east: the Peak's shore to the south shore), 2.4 m wide on posts in
  the lake, waist-high rails, steps at both ends, and every 18 m a landing
  where the rails open and a step goes down into the water each side, so a
  wading player crosses them anywhere

Colliders: the posts, poles, wrecks and the shelter; the boardwalks' decks,
rails and steps. The asphalt and its paint are flat and register nothing.
"""
import json
import math
import os
import random

from map_kit import mat
from tf_city import flat
from tf_skate import orient

HERE = os.path.dirname(os.path.abspath(__file__))
ROAD_W = 6.0
ROAD_Y = 0.035
# the boardwalks: [(x0, z0), (x1, z1)] as the road-clear tool knows them
BOARDWALKS = [((-6.0, -5.5), (-2.0, 62.0)), ((76.0, -5.0), (82.0, 62.0))]
WALK_W, WALK_Y = 2.4, 0.66
LANDING_EVERY = 18.0
# the arches the Boat sails under (maps/trollface-boat.js BOAT_ARCHES: where
# its loop crosses a boardwalk, square across it): an open channel ARCH_GAP
# m each side of the crossing with nothing under ARCH_UNDER (the Boat's
# highest under an arch: its exhaust, 6.3 m; its mast folds down onto the
# wheelhouse roof, 5.9 m), the flat top to ARCH_TOP_HALF on two timber
# piers, then ARCH_STEPS steps down to the boardwalk each way
ARCH_GAP, ARCH_TOP_HALF = 5.6, 6.4
ARCH_TOP, ARCH_DECK = 7.1, 0.3
ARCH_UNDER = ARCH_TOP - ARCH_DECK
ARCH_STEPS = 23
ARCH_RISE = (ARCH_TOP - WALK_Y) / ARCH_STEPS        # 0.28: under the 0.36 step-up
ARCH_RUN = 0.3
ARCH_HALF = ARCH_TOP_HALF + ARCH_STEPS * ARCH_RUN   # 13.3 m: the arch's reach along the boardwalk
WRECKS = [(-118.0, -80.0, 0.9), (32.0, -13.0, -0.4)]
SHELTER = (134.0, 74.5, math.pi)        # x, z, yaw: open to the road (north)

LOOT = []
SIGNS = []


def palette():
    return {
        # plain asphalt: the photo set (GS_Asphalt) carries its own lane
        # lines, which ran across the island's roads at every angle
        "asphalt": mat("TF_Asphalt", 0x3b3e44, 0.92),
        "paint": mat("TF_RoadPaint", 0xf0eee6, 0.6),
        "paint_y": mat("TF_RoadPaintYellow", 0xf2cf4a, 0.6),
        "post": mat("TF_MilePost", 0xf4f4f0, 0.6),
        "post_red": mat("TF_MilePostBand", 0xd23b2f, 0.6),
        "pole": mat("TF_PowerPole", 0x6b5236, 0.9),
        "wire": mat("TF_Wire", 0x161616, 0.6),
        "insulator": mat("TF_Insulator", 0xd8dde0, 0.3),
        "rust": mat("TF_WreckRust", 0x7a4a2e, 0.9),
        "rust_dk": mat("TF_WreckRustDark", 0x4a2e1e, 0.95),
        "tyre": mat("TF_Tyre", 0x1a1a1c, 0.9),
        "steel": mat("TF_Steel", 0x6b7078, 0.5, 0.5),
        "ink": mat("TF_Ink", 0x111114, 0.7),
        "glass": mat("TF_ShelterGlass", 0x9fd2f0, 0.1, 0.1),
        "bench": mat("TF_BenchYellow", 0xf2dc8a, 0.6),
        "plank": mat("GS_Plank", 0xffffff, 0.8),
        "plank_dk": mat("TF_PlankDark", 0x6b4a2e, 0.8),
        "pile": mat("TF_Pile", 0x4a3828, 0.9),
        "lantern": mat("TF_LanternLit", 0xffd27a, 0.3, 0.0, 0xffb84a, 1.6),
        "rope": mat("TF_Rope", 0xc8b48a, 0.9),
    }


class Net:
    def __init__(self, b, P, R):
        self.b, self.P, self.R = b, P, R
        self.rng = random.Random(41)
        LOOT.clear()
        SIGNS.clear()

    def col(self, x, z, w, d, h, y=0.0, pen=3):
        if w > 0.02 and d > 0.02 and h > 0.02:
            self.R.collider(x, z, w, d, h, y, pen)

    def begin(self, pid, on=None):
        self.R.begin(self.b, pid, on)

    def end(self):
        self.R.end()

    def loot(self, x, y, z):
        LOOT.append({"x": round(x, 2), "z": round(z, 2), "y": round(y, 2)})


# ------------------------------------------------------------- polyline helpers

def densify(pts, step=3.0):
    out = [tuple(pts[0])]
    for (ax, az), (bx, bz) in zip(pts, pts[1:]):
        L = math.hypot(bx - ax, bz - az)
        n = max(1, math.ceil(L / step))
        for i in range(1, n + 1):
            out.append((ax + (bx - ax) * i / n, az + (bz - az) * i / n))
    return out


def offsets(pts, off):
    """The polyline moved `off` to its left (x east, z south: left of the
    walk direction (dx, dz) is (dz, -dx)), mitred at the bends."""
    n = len(pts)
    dirs = []
    for i in range(n - 1):
        dx, dz = pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]
        L = math.hypot(dx, dz) or 1.0
        dirs.append((dx / L, dz / L))
    out = []
    for i in range(n):
        d0 = dirs[max(0, i - 1)]
        d1 = dirs[min(n - 2, i)]
        mx, mz = d0[0] + d1[0], d0[1] + d1[1]
        L = math.hypot(mx, mz)
        if L < 1e-6:
            mx, mz, L = d1[0], d1[1], 1.0
        mx, mz = mx / L, mz / L
        cos_half = max(0.5, mx * d1[0] + mz * d1[1])
        k = off / cos_half
        out.append((pts[i][0] + mz * k, pts[i][1] - mx * k))
    return out


def ribbon(b, m, pts, off_l, off_r, y):
    """Quads between the polyline offset off_l (left) and off_r (right)."""
    L = offsets(pts, off_l)
    Rr = offsets(pts, -off_r)
    verts = [(x, y, z) for (x, z) in L] + [(x, y, z) for (x, z) in Rr]
    n = len(pts)
    faces = [[i, i + 1, n + i + 1, n + i] for i in range(n - 1)]
    orient(b, b.poly(m, verts, faces), (0, 1, 0))


def along(pts, s):
    """The point and direction s metres along the polyline."""
    acc = 0.0
    for (ax, az), (bx, bz) in zip(pts, pts[1:]):
        L = math.hypot(bx - ax, bz - az)
        if acc + L >= s:
            t = (s - acc) / L
            return (ax + (bx - ax) * t, az + (bz - az) * t), ((bx - ax) / L, (bz - az) / L)
        acc += L
    (ax, az), (bx, bz) = pts[-2], pts[-1]
    L = math.hypot(bx - ax, bz - az)
    return (bx, bz), ((bx - ax) / L, (bz - az) / L)


def length(pts):
    return sum(math.hypot(bx - ax, bz - az) for (ax, az), (bx, bz) in zip(pts, pts[1:]))


# ------------------------------------------------------------- the roads

def seg_dist(x, z, a, c):
    ex, ez = c[0] - a[0], c[1] - a[1]
    t = max(0.0, min(1.0, ((x - a[0]) * ex + (z - a[1]) * ez) / ((ex * ex + ez * ez) or 1.0)))
    return math.hypot(x - (a[0] + ex * t), z - (a[1] + ez * t))


def junctions(road_list):
    """Where a road's corner or end lies on another road: the junctions."""
    out = []
    for i, road in enumerate(road_list):
        for (x, z) in road:
            for j, other in enumerate(road_list):
                if j != i and any(seg_dist(x, z, a, c) < 1.0 for a, c in zip(other, other[1:])):
                    if all(math.hypot(x - jx, z - jz) > 3.0 for (jx, jz) in out):
                        out.append((x, z))
                    break
    return out


JUNCTION_CLEAR = ROAD_W * 0.95          # no paint this close to a junction


def roads(N, LAYOUT):
    b, P = N.b, N.P
    nets = LAYOUT["roads"]
    J = junctions(nets)
    top = ROAD_Y + 0.0012 * len(nets)
    for k, road in enumerate(nets):
        pts = densify(road, 3.0)
        y = ROAD_Y + 0.0012 * k                        # each road a hair higher: no shimmer where they meet
        if len(pts) < 2:
            continue
        ribbon(b, P["asphalt"], pts, ROAD_W / 2, ROAD_W / 2, y)
        others = [o for o in nets if o is not road]

        def clear(x, z):
            # no paint near a junction, nor where another road runs over this one
            return (all(math.hypot(x - jx, z - jz) > JUNCTION_CLEAR for (jx, jz) in J)
                    and all(seg_dist(x, z, a, c) > ROAD_W * 0.8 for o in others for a, c in zip(o, o[1:])))
        # the edge lines, in runs between the junctions
        fine = densify(road, 0.75)
        run = []
        for q in fine + [None]:
            if q is not None and clear(*q):
                run.append(q)
                continue
            if len(run) >= 2:
                for side in (1, -1):
                    ribbon(b, P["paint"], run, side * (ROAD_W / 2 - 0.25) + 0.05, -side * (ROAD_W / 2 - 0.25) + 0.05, top + 0.004)
            run = []
        s, total = 1.5, length(road)
        while s < total - 1.2:
            (x, z), (dx, dz) = along(road, s)
            if clear(x, z):
                flat(b, P["paint"], x, top + 0.004, z, 1.6, 0.14, -math.atan2(dz, dx))
            s += 3.6
    # the junctions: a round patch of asphalt over the roads' meeting corners
    for (x, z) in J:
        n = 20
        R_ = ROAD_W * 0.62
        verts = [(x, top + 0.001, z)] + [(x + R_ * math.cos(2 * math.pi * i / n), top + 0.001, z + R_ * math.sin(2 * math.pi * i / n)) for i in range(n)]
        orient(b, b.poly(P["asphalt"], verts, [[0, 1 + i, 1 + (i + 1) % n] for i in range(n)]), (0, 1, 0))
    # the parking bays: an outline 5 x 2.6, the nose along yaw
    for (x, z, yaw) in LAYOUT.get("parking", []):
        ry = math.radians(yaw)
        c, sn = math.cos(ry), math.sin(ry)
        flat(b, P["asphalt"], x, ROAD_Y + 0.01, z, 5.2, 2.8, -ry)
        for (u, v, w, d) in ((0, 1.3, 5.0, 0.12), (0, -1.3, 5.0, 0.12), (2.5, 0, 0.12, 2.6), (-2.5, 0, 0.12, 2.6)):
            flat(b, P["paint"], x + u * c + v * sn, ROAD_Y + 0.014, z - u * sn + v * c, w, d, -ry)


def mile_posts(N, LAYOUT):
    b, P = N.b, N.P
    k = 0
    for road in LAYOUT["roads"]:
        total = length(road)
        if total < 150:
            continue
        s = 50.0
        while s < total - 20:
            (x, z), (dx, dz) = along(road, s)
            px, pz = x + dz * 3.9, z - dx * 3.9
            N.begin(f"milepost{k}")
            b.box(P["post"], 0.18, 0.95, 0.18, px, 0.0, pz, bevel=0.02)
            b.box(P["post_red"], 0.19, 0.18, 0.19, px, 0.65, pz)
            N.end()
            N.col(px, pz, 0.18, 0.18, 0.95, 0, 1)
            k += 1
            s += 100.0


def power_poles(N, LAYOUT):
    """Along the north road from Meme Lab, behind the city, to short of the
    Observatory (the first 190 m of the longest road), on its seaward side."""
    b, P = N.b, N.P
    road = max(LAYOUT["roads"], key=length)
    s, k, prev = 6.0, 0, None
    while s < 190:
        (x, z), (dx, dz) = along(road, s)
        px, pz = x + dz * 4.4, z - dx * 4.4
        N.begin(f"pole{k}")
        b.cyl(P["pole"], 0.16, (px, -0.1, pz), (px, 8.0, pz), seg=7, r2=0.11)
        b.box(P["pole"], 1.8, 0.12, 0.12, px, 7.4, pz, ry=-math.atan2(dz, dx))
        tips = []
        for o in (-0.75, 0.0, 0.75):
            tx, tz = px + dx * o, pz + dz * o
            b.cyl(P["insulator"], 0.05, (tx, 7.52, tz), (tx, 7.72, tz), seg=6)
            tips.append((tx, 7.72, tz))
        N.end()
        N.col(px, pz, 0.32, 0.32, 8.0, 0, 3)
        if prev:
            N.begin("wires", on=(f"pole{k - 1}", f"pole{k}"))
            for (a, c) in zip(prev, tips):
                mid = ((a[0] + c[0]) / 2, (a[1] + c[1]) / 2 - 0.9, (a[2] + c[2]) / 2)
                b.cyl(P["wire"], 0.02, a, mid, seg=4)
                b.cyl(P["wire"], 0.02, mid, c, seg=4)
            N.end()
        prev = tips
        k += 1
        s += 28.0


def wreck(N, k, x, z, ry):
    """A burnt-out sedan: no glass, the bonnet up, one wheel off."""
    b, P = N.b, N.P
    c, s = math.cos(ry), math.sin(ry)
    L = lambda lx, lz: (x + lx * c + lz * s, z - lx * s + lz * c)      # noqa: E731
    N.begin(f"wreck{k}")
    b.box(P["rust"], 4.4, 0.6, 1.8, x, 0.22, z, ry=ry, bevel=0.05)
    cx, cz = L(-0.3, 0)
    b.box(P["rust_dk"], 2.3, 0.55, 1.6, cx, 0.82, cz, ry=ry, bevel=0.06)
    for (lx, lz) in ((-0.3, 0.78), (-0.3, -0.78)):                                 # the empty window frames
        wx, wz = L(lx, lz)
        b.box(P["ink"], 2.1, 0.45, 0.04, wx, 0.87, wz, ry=ry)
    hx, hz = L(1.5, 0)
    b.box(P["rust"], 1.3, 0.06, 1.6, hx, 0.85, hz, ry=ry, rx=0.0, rz=0.6)         # the bonnet, up
    for (lx, lz, flat_t) in ((1.5, 0.95, False), (1.5, -0.95, True), (-1.5, 0.95, True)):
        wx, wz = L(lx, lz)
        r = 0.34 if not flat_t else 0.26
        b.cyl(P["tyre"], r, (wx + s * 0.12, r, wz + c * 0.12), (wx - s * 0.12, r, wz - c * 0.12), seg=10)
    wx, wz = L(-2.6, 1.6)
    b.cyl(P["tyre"], 0.34, (wx, 0.12, wz), (wx + 0.02, 0.35, wz + 0.2), seg=10)    # the wheel that came off
    N.end()
    N.col(x, z, abs(4.4 * c) + abs(1.8 * s), abs(4.4 * s) + abs(1.8 * c), 1.4, 0, 1.5)
    N.col(wx, wz, 0.7, 0.7, 0.4, 0, 1)


def shelter(N, x, z, ry):
    """A bus shelter: glass back and ends, a bench, open to the road."""
    b, P = N.b, N.P
    c, s = math.cos(ry), math.sin(ry)
    L = lambda lx, lz: (x + lx * c + lz * s, z - lx * s + lz * c)      # noqa: E731
    N.begin("bus-shelter")
    for (lx, lz) in ((-1.6, -0.7), (1.6, -0.7), (-1.6, 0.7), (1.6, 0.7)):
        px, pz = L(lx, lz)
        b.box(P["steel"], 0.12, 2.6, 0.12, px, 0, pz)
    b.box(P["steel"], 3.5, 0.12, 1.7, x, 2.6, z, ry=ry)
    bx, bz = L(0, 0.72)
    b.box(P["glass"], 3.2, 2.3, 0.04, bx, 0.2, bz, ry=ry)
    for lx in (-1.6, 1.6):
        px, pz = L(lx, 0)
        b.box(P["glass"], 0.04, 2.3, 1.3, px, 0.2, pz, ry=ry)
    sx, sz = L(0, 0.35)
    b.box(P["bench"], 2.4, 0.08, 0.45, sx, 0.46, sz, ry=ry)
    for lx in (-1.0, 1.0):
        px, pz = L(lx, 0.35)
        b.box(P["steel"], 0.08, 0.46, 0.4, px, 0, pz, ry=ry)
    N.end()
    N.col(bx, bz, abs(3.3 * c) + abs(0.1 * s), abs(3.3 * s) + abs(0.1 * c), 2.6, 0, 1)
    for lx in (-1.6, 1.6):
        px, pz = L(lx, 0)
        N.col(px, pz, abs(0.1 * c) + abs(1.4 * s), abs(0.1 * s) + abs(1.4 * c), 2.6, 0, 1)
    N.col(sx, sz, abs(2.4 * c) + abs(0.45 * s), abs(2.4 * s) + abs(0.45 * c), 0.54, 0, 1)
    N.loot(x, 0.0, z)


# ------------------------------------------------------------- the boardwalks

def boardwalk(N, k, a, c, crossings=()):
    b, P, rng = N.b, N.P, N.rng
    (ax, az), (cx, cz) = a, c
    total = math.hypot(cx - ax, cz - az)
    dx, dz = (cx - ax) / total, (cz - az) / total
    nx, nz = dz, -dx                                   # the left side
    hw = WALK_W / 2
    at = lambda s, o: (ax + dx * s + nx * o, az + dz * s + nz * o)      # noqa: E731
    # the Boat's crossings on this boardwalk, as distances along it
    arches = []
    for (px, pz) in crossings:
        t = (px - ax) * dx + (pz - az) * dz
        if 0 < t < total and abs((px - ax) * nx + (pz - az) * nz) < 3.0:
            arches.append(t)
    in_arch = lambda s, pad=0.0: any(abs(s - t) < ARCH_HALF + pad for t in arches)      # noqa: E731
    # the landings: every LANDING_EVERY m, 2.4 m long, with the steps either side
    landings = []
    s = LANDING_EVERY
    while s < total - LANDING_EVERY / 2:
        if not in_arch(s, 1.5):
            landings.append(s)
        s += LANDING_EVERY
    pid = f"boardwalk{k}"
    N.begin(pid)
    # stringers and planks the whole way, posts every 3 m into the lake bed
    flats = []                                         # the flat runs between the arches
    s0 = 0.0
    for t in sorted(arches):
        flats.append((s0, t - ARCH_HALF))
        s0 = t + ARCH_HALF
    flats.append((s0, total))
    for (f0, f1) in flats:
        for o in (-hw + 0.25, 0.0, hw - 0.25):
            p0, p1 = at(f0, o), at(f1, o)
            b.bar(P["plank_dk"], (p0[0], WALK_Y - 0.36, p0[1]), (p1[0], WALK_Y - 0.36, p1[1]), 0.18, 0.28)
    s = 0.02
    while s < total - 0.2:
        if not in_arch(s + 0.14):
            (x, z) = at(s + 0.14, 0)
            b.box(P["plank"], 0.27, 0.07, WALK_W + rng.uniform(-0.05, 0.05), x, WALK_Y - 0.07, z, ry=-math.atan2(dz, dx) + math.pi / 2)
        s += 0.31
    s = 1.5
    while s < total:
        if not in_arch(s, 0.3):
            for o in (-hw + 0.2, hw - 0.2):
                (x, z) = at(s, o)
                b.cyl(P["pile"], 0.17, (x, -0.2, z), (x, WALK_Y - 0.2, z), seg=8)
        s += 3.0
    # rails: posts every 3 m, two rails, open over the landings; a lantern every 12 m
    def in_landing(s):
        return any(abs(s - l) < 1.4 for l in landings) or in_arch(s)
    runs = []
    s = 0.0
    start = 0.0
    while s <= total + 0.01:
        if in_landing(s) or s > total:
            if s - start > 0.5:
                runs.append((start, min(s, total)))
            start = s + 0.1
        s += 0.5
    for (r0, r1) in runs:
        for side in (-1, 1):
            o = side * (hw - 0.1)
            p0, p1 = at(r0, o), at(r1, o)
            for ry in (WALK_Y + 0.55, WALK_Y + 1.0):
                b.bar(P["plank_dk"], (p0[0], ry, p0[1]), (p1[0], ry, p1[1]), 0.08, 0.06)
            s = r0
            while s <= r1 + 0.01:
                (x, z) = at(s, o)
                b.box(P["plank_dk"], 0.12, 1.05, 0.12, x, WALK_Y, z, ry=-math.atan2(dz, dx))
                if int(s / 3.0) % 4 == 1 and side == 1:
                    b.box(P["lantern"], 0.2, 0.26, 0.2, x, WALK_Y + 1.1, z)
                s += 3.0
    # the end steps and the landings' steps
    for (s_end, dirn) in ((0.0, -1), (total, 1)):
        (x, z) = at(s_end + dirn * 0.25, 0)
        b.box(P["plank_dk"], 0.5, 0.33, WALK_W, x, 0.0, z, ry=-math.atan2(dz, dx), bevel=0.02)
    for l in landings:
        for side in (-1, 1):
            (x, z) = at(l, side * (hw + 0.3))
            b.box(P["plank_dk"], 2.4, 0.33, 0.6, x, 0.0, z, ry=-math.atan2(dz, dx), bevel=0.02)
            (x2, z2) = at(l, side * (hw + 0.75))
            b.cyl(P["pile"], 0.1, (x2, -0.2, z2), (x2, 0.33, z2), seg=6)
    N.end()
    for t in arches:
        boat_arch(N, at, dx, dz, t, pid)
    # colliders: the deck in 3 m pieces, the rails in runs of 3 m, the steps
    seg = 3.0
    s = 0.0
    for (f0, f1) in flats:
        s = f0
        while s < f1 - 0.01:
            s1 = min(f1, s + seg)
            (x0, z0), (x1, z1) = at(s, 0), at(s1, 0)
            w = abs(x1 - x0) + abs(nx) * WALK_W
            d = abs(z1 - z0) + abs(nz) * WALK_W
            N.col((x0 + x1) / 2, (z0 + z1) / 2, w, d, WALK_Y, 0, 3)
            s = s1
    for (r0, r1) in runs:
        s = r0
        while s < r1:
            s1 = min(r1, s + seg)
            for side in (-1, 1):
                o = side * (hw - 0.1)
                (x0, z0), (x1, z1) = at(s, o), at(s1, o)
                N.col((x0 + x1) / 2, (z0 + z1) / 2, abs(x1 - x0) + 0.14, abs(z1 - z0) + 0.14, 1.05, WALK_Y, 1)
            s = s1
    for (s_end, dirn) in ((0.0, -1), (total, 1)):
        (x, z) = at(s_end + dirn * 0.25, 0)
        N.col(x, z, abs(dx) * 0.5 + abs(nx) * WALK_W, abs(dz) * 0.5 + abs(nz) * WALK_W, 0.33, 0, 3)
    for l in landings:
        for side in (-1, 1):
            (x, z) = at(l, side * (hw + 0.3))
            N.col(x, z, abs(dx) * 2.4 + abs(nx) * 0.6, abs(dz) * 2.4 + abs(nz) * 0.6, 0.33, 0, 3)
        (x, z) = at(l, 0)
        N.loot(x, WALK_Y, z)


def boat_arch(N, at, dx, dz, t, walk):
    """One arch over the Boat's channel, centred `t` m along a boardwalk."""
    b, P = N.b, N.P
    hw = WALK_W / 2
    ry = -math.atan2(dz, dx)
    nx, nz = dz, -dx

    def span(s0, s1, o0=-hw, o1=hw):
        return (abs(dx) * abs(s1 - s0) + abs(nx) * (o1 - o0), abs(dz) * abs(s1 - s0) + abs(nz) * (o1 - o0))

    N.begin("boat-arch", on=walk)            # it stands in its boardwalk's box
    # the top: planks on two beams, a rail each side, a lantern each end
    for o in (-hw + 0.25, hw - 0.25):
        p0, p1 = at(t - ARCH_TOP_HALF, o), at(t + ARCH_TOP_HALF, o)
        b.bar(P["plank_dk"], (p0[0], ARCH_UNDER + 0.08, p0[1]), (p1[0], ARCH_UNDER + 0.08, p1[1]), 0.22, 0.16)
    s = t - ARCH_TOP_HALF
    while s < t + ARCH_TOP_HALF - 0.1:
        (x, z) = at(s + 0.14, 0)
        b.box(P["plank"], 0.27, 0.07, WALK_W, x, ARCH_TOP - 0.07, z, ry=ry + math.pi / 2)
        s += 0.31
    # the piers: a timber trestle each side of the channel, down into the lake bed
    for e in (-1, 1):
        sc = t + e * (ARCH_GAP + ARCH_TOP_HALF) / 2
        for o in (-hw + 0.2, hw - 0.2):
            (x, z) = at(sc, o)
            b.box(P["pile"], 0.36, ARCH_UNDER + 0.2, 0.36, x, -0.2, z, ry=ry)
        (x, z) = at(sc, 0)
        for y in (1.6, 3.6):
            b.box(P["plank_dk"], 0.2, 0.2, WALK_W, x, y, z, ry=ry + math.pi / 2)
    # the steps up from the boardwalk each side, on posts
    for e in (-1, 1):
        for i in range(ARCH_STEPS):
            sm = t + e * (ARCH_HALF - (i + 0.5) * ARCH_RUN)
            (x, z) = at(sm, 0)
            top = WALK_Y + (i + 1) * ARCH_RISE
            b.box(P["plank"], ARCH_RUN + 0.02, 0.07, WALK_W, x, top - 0.07, z, ry=ry + math.pi / 2)
            b.box(P["plank_dk"], ARCH_RUN, ARCH_RISE, WALK_W - 0.1, x, top - ARCH_RISE - 0.07, z, ry=ry + math.pi / 2)
            if i % 4 == 1:
                for o in (-hw + 0.2, hw - 0.2):
                    (px, pz) = at(sm, o)
                    b.cyl(P["pile"], 0.14, (px, -0.2, pz), (px, top - 0.2, pz), seg=8)
        for o in (-hw + 0.1, hw - 0.1):
            p0, p1 = at(t + e * ARCH_HALF, o), at(t + e * ARCH_TOP_HALF, o)
            for h in (0.55, 1.0):
                b.bar(P["plank_dk"], (p0[0], WALK_Y + h, p0[1]), (p1[0], ARCH_TOP + h, p1[1]), 0.08, 0.06)
    for o in (-hw + 0.1, hw - 0.1):
        p0, p1 = at(t - ARCH_TOP_HALF, o), at(t + ARCH_TOP_HALF, o)
        for h in (0.55, 1.0):
            b.bar(P["plank_dk"], (p0[0], ARCH_TOP + h, p0[1]), (p1[0], ARCH_TOP + h, p1[1]), 0.08, 0.06)
        for sp in (t - ARCH_TOP_HALF, t, t + ARCH_TOP_HALF):
            (x, z) = at(sp, o)
            b.box(P["plank_dk"], 0.12, 1.05, 0.12, x, ARCH_TOP, z, ry=ry)
        for sp in (t - ARCH_HALF, t + ARCH_HALF):
            (x, z) = at(sp, o)
            b.box(P["plank_dk"], 0.12, 1.05, 0.12, x, WALK_Y, z, ry=ry)
    for e in (-1, 1):
        (x, z) = at(t + e * ARCH_TOP_HALF, hw - 0.1)
        b.box(P["lantern"], 0.2, 0.26, 0.2, x, ARCH_TOP + 1.1, z)
    N.end()
    # colliders: the top slab, the piers, each step solid to the lake bed,
    # the rails along the top and up the steps
    (x, z) = at(t, 0)
    w, d = span(t - ARCH_TOP_HALF, t + ARCH_TOP_HALF)
    N.col(x, z, w, d, ARCH_DECK, ARCH_UNDER, 3)
    for e in (-1, 1):
        s0, s1 = t + e * ARCH_GAP, t + e * ARCH_TOP_HALF
        (x, z) = at((s0 + s1) / 2, 0)
        w, d = span(s0, s1)
        N.col(x, z, w, d, ARCH_UNDER, 0, 3)
        for i in range(ARCH_STEPS):
            sm = t + e * (ARCH_HALF - (i + 0.5) * ARCH_RUN)
            (x, z) = at(sm, 0)
            w, d = span(sm - ARCH_RUN / 2, sm + ARCH_RUN / 2)
            N.col(x, z, w, d, WALK_Y + (i + 1) * ARCH_RISE, 0, 3)
            if i % 2 == 0:
                for o in (-hw + 0.1, hw - 0.1):
                    (x, z) = at(sm + e * ARCH_RUN / 2, o)
                    N.col(x, z, abs(dx) * ARCH_RUN * 2 + 0.14, abs(dz) * ARCH_RUN * 2 + 0.14, 1.05, WALK_Y + (i + 1) * ARCH_RISE, 1)
    for o in (-hw + 0.1, hw - 0.1):
        (x, z) = at(t, o)
        w, d = span(t - ARCH_TOP_HALF, t + ARCH_TOP_HALF, 0, 0)
        N.col(x, z, w + 0.14, d + 0.14, 1.05, ARCH_TOP, 1)


# ------------------------------------------------------------- the build

def build(b, P, R, origin):
    N = Net(b, P, R)
    with open(os.path.join(HERE, "trollface-island-layout.json"), encoding="utf8") as f:
        LAYOUT = json.load(f)
    roads(N, LAYOUT)
    mile_posts(N, LAYOUT)
    power_poles(N, LAYOUT)
    for k, (x, z, ry) in enumerate(WRECKS):
        wreck(N, k, x, z, ry)
    shelter(N, *SHELTER)
    for k, (a, c) in enumerate(BOARDWALKS):
        boardwalk(N, k, a, c, LAYOUT.get("boatArches", []))
    b.finish("tf-roads-p4.glb")
