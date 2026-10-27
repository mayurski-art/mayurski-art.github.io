"""
St. Grinsworth's tower and bell (phase 2 of "Troll Forces: Hollowgrin in
Blender"; the user: "feel free to make the church bigger", picks: wider,
taller and a tower; organ + ghost, troll gargoyles, a clock at 13, bats and
the bell rope). The chapel's nave stays maps/hollowgrin-chapel.js (its
inside is code: the lancets, the dome, the frieze); this draws the tower on
its north-east corner and what hangs in it:

hg-chapel-tower.glb (map coordinates): the brick shaft with stone quoins,
string courses and slit windows, the bell-ringers' room at its foot (board
floor, a ceiling with the rope's hole, a bench, the peal board), the
belfry's twin pointed openings on every side, the corbel table and the
crenellated parapet, four pinnacles, four gargoyles, the slate spire with
its lucarnes, the gilt ball, cross and weathercock, the clocks' stone
roundels (their dials are the JS's canvas), the bell frame; and three
gargoyles on the nave's corners.

hg-bell.glb and hg-bell-clapper.glb (drawn about the axle, the origin):
the bronze bell on its oak headstock, and the clapper. hollowgrin-chapel.js
swings both.
"""
import math

from map_kit import TEXTURED, mat
from hg_kit import HGBuilder, Wall, facing, fbox, lathe, quad, slab, troll_face

TEXTURED.update({"HG_Granite", "HG_GraniteDark", "HG_ChapelBrick", "HG_Floorboards"})

# hollowgrin-chapel.js CHAPEL and CHAPEL_TOWER: the same numbers
NAVE = {"x0": -49.5, "x1": -39.0, "z0": -5.0, "z1": 8.5, "h": 7.6}
TW = {"x0": -42.6, "x1": -39.0, "z0": -8.4, "z1": -4.4, "shaft": 14.6, "belfry": 18.2, "spire": 26.0}
T = 0.6
TX, TZ = (TW["x0"] + TW["x1"]) / 2, (TW["z0"] + TW["z1"]) / 2
ROOM_CEIL = 3.0                                    # the ringing room's ceiling
CLOCK_Y, CLOCK_R = 12.3, 0.95
BELL_S = 1.35
PIVOT = (TX, 16.75, TZ)                            # the bell's axle (along z)


def palette():
    return {
        "brick": mat("HG_ChapelBrick", 0xc89a5a, 0.9),
        "granite": mat("HG_Granite", 0x8c8c94, 0.9),
        "granite_dk": mat("HG_GraniteDark", 0x5a5a62, 0.9),
        "slate": mat("HG_SpireSlate", 0x3e4250, 0.8),
        "lead": mat("HG_RidgeLead", 0x2a2c30, 0.6, 0.3),
        "iron": mat("HG_Iron", 0x1c1c22, 0.55, 0.3),
        "gilt": mat("HG_Gilt", 0xb89040, 0.4, 0.8),
        "oak": mat("HG_OakDark", 0x34221a, 0.55),
        "boards": mat("HG_Floorboards", 0x6a4a30, 0.8),
        "slit": mat("HG_Recess", 0x26262c, 0.9),
        "dark": mat("HG_Joint", 0x2a2a30, 0.9),
        "bell": mat("HG_BellBronze", 0xa8783a, 0.35, 0.85),
        "verdigris": mat("HG_Bronze", 0x3d6a58, 0.5, 0.6),
        "moss": mat("HG_Moss", 0x3a4a2c, 0.95),
        "oak_lt": mat("HG_Oak", 0x5a3a24, 0.55),
        "pewter": mat("HG_Pewter", 0x8a8c90, 0.35, 0.8),
        "ivory": mat("HG_Ivory", 0xe0d8c0, 0.5),
        "paper": mat("HG_NoticePaper", 0xc8bfa4, 0.9),
    }


def arch_profile(span, spring, apex, top, n=8):
    """A lintel's profile (u along the span, v up) whose underside is a
    two-centred pointed arch from the springing at either end to the apex.
    Each arc has radius R = h + c, centred c past the middle."""
    h, r = span / 2, apex - spring
    c = max(0.0, (r * r - h * h) / (2 * h))
    R = h + c
    a1 = math.acos(-c / R)
    left = [(c + R * math.cos(math.pi - (math.pi - a1) * i / n), spring + R * math.sin(math.pi - (math.pi - a1) * i / n)) for i in range(n + 1)]
    right = [(-u, v) for u, v in reversed(left[:-1])]
    return [(-h, top)] + left + right + [(h, top)]


# ------------------------------------------------------------------ the tower

def belfry_holes(c0, c1):
    """Twin lancets on one face: centres either side of the face's middle."""
    m = (c0 + c1) / 2
    return [{"c": m - 0.62, "w": 0.9, "spans": [(15.0, 17.6)]}, {"c": m + 0.62, "w": 0.9, "spans": [(15.0, 17.6)]}]


def tower(b, P, R):
    x0, x1, z0, z1, top = TW["x0"], TW["x1"], TW["z0"], TW["z1"], TW["belfry"]
    R.begin(b, "chapel:tower")
    # the walls: N, E, W from the ground; S (over the nave's wall) from its eaves
    ew = belfry_holes(z0 + T, z1 - T)
    ns = belfry_holes(x0 + T, x1 - T)
    walls = [Wall("x", z0 + T / 2, x0, x1, top, T, holes=ns, out=-1),
             Wall("x", z1 - T / 2, x0, x1, top - NAVE["h"], T, holes=[{**q, "spans": [(lo - NAVE["h"], hi - NAVE["h"]) for lo, hi in q["spans"]]} for q in ns],
                  y=NAVE["h"], out=1),
             Wall("z", x0 + T / 2, z0 + T, z1 - T, top, T, holes=ew, out=-1),
             Wall("z", x1 - T / 2, z0 + T, z1 - T, top, T, holes=ew, out=1)]
    for w in walls:
        w.solid(b, P["brick"])
    # the arch heads over the belfry's lancets, flush in the wall
    for w in walls:
        for q in w.holes:
            lo, hi = q["spans"][0]
            prof = arch_profile(q["w"], w.y + hi - 0.42, w.y + hi - 0.02, w.y + hi)
            if w.axis == "x":
                slab(b, P["granite"], prof, T + 0.04, q["c"], 0.0, w.at)
            else:
                slab(b, P["granite"], prof, T + 0.04, w.at, 0.0, q["c"], ry=math.pi / 2)
            # a sill under each
            if w.axis == "x":
                fbox(b, P["granite"], q["c"] - q["w"] / 2 - 0.08, q["c"] + q["w"] / 2 + 0.08, w.y + lo - 0.08, w.y + lo, w.at - T / 2 - 0.08, w.at + T / 2 + 0.08, "+y -y +z -z -x +x")
            else:
                fbox(b, P["granite"], w.at - T / 2 - 0.08, w.at + T / 2 + 0.08, w.y + lo - 0.08, w.y + lo, q["c"] - q["w"] / 2 - 0.08, q["c"] + q["w"] / 2 + 0.08, "+y -y +x -x -z +z")
        # the mullion between the twin lancets
        m = (w.a + w.b) / 2
        lo, hi = w.holes[0]["spans"][0]
        if w.axis == "x":
            fbox(b, P["granite"], m - 0.17, m + 0.17, w.y + lo, w.y + hi, w.at - T / 2 - 0.02, w.at + T / 2 + 0.02, "+z -z -x +x")
        else:
            fbox(b, P["granite"], w.at - T / 2 - 0.02, w.at + T / 2 + 0.02, w.y + lo, w.y + hi, m - 0.17, m + 0.17, "+x -x -z +z")
    # quoins: long and short stones up every corner
    k = 0
    y = 0.0
    while y < top - 0.1:
        hh = 0.32
        for (cx, cz, sx, sz) in ((x0, z0, -1, -1), (x1, z0, 1, -1), (x0, z1, -1, 1), (x1, z1, 1, 1)):
            if sz > 0 and y < NAVE["h"]:
                continue
            long_ = 0.55 if k % 2 else 0.32
            ax0, ax1 = (cx - 0.02, cx + long_) if sx < 0 else (cx - long_, cx + 0.02)
            az0, az1 = (cz - 0.02, cz + (0.32 if k % 2 else 0.55)) if sz < 0 else (cz - (0.32 if k % 2 else 0.55), cz + 0.02)
            fbox(b, P["granite"], ax0, ax1, y, y + hh - 0.02, az0, az1, ("-x" if sx < 0 else "+x") + (" -z" if sz < 0 else " +z") + " +y")
        y += hh
        k += 1
    # string courses: at the nave's eaves (N, E, W), under the belfry, the corbel table
    for yc, d in ((NAVE["h"], 0.08), (14.45, 0.1)):
        fbox(b, P["granite"], x0 - d, x1 + d, yc, yc + 0.16, z0 - d, z1 + d if yc > NAVE["h"] else z1, "+y -y -x +x -z" + (" +z" if yc > NAVE["h"] else ""))
    fbox(b, P["granite_dk"], x0 - 0.12, x1 + 0.12, top - 0.05, top + 0.2, z0 - 0.12, z1 + 0.12, "+y -y -x +x -z +z")
    for i in range(14):                               # corbels under the parapet
        for side in range(4):
            if side < 2:
                u = x0 + 0.15 + i * (x1 - x0 - 0.3) / 13
                zz = z0 - 0.12 if side == 0 else z1 + 0.12
                b.box(P["granite"], 0.14, 0.22, 0.16, u, top - 0.27, zz + (0.04 if side == 0 else -0.04))
            else:
                u = z0 + 0.15 + i * (z1 - z0 - 0.3) / 13
                xx = x0 - 0.12 if side == 2 else x1 + 0.12
                b.box(P["granite"], 0.16, 0.22, 0.14, xx + (0.04 if side == 2 else -0.04), top - 0.27, u)
    # the parapet with merlons, on the outer line
    py = top + 0.2
    for (a, b_, at, axis) in ((x0 - 0.12, x1 + 0.12, z0 - 0.12 + 0.15, "x"), (x0 - 0.12, x1 + 0.12, z1 + 0.12 - 0.15, "x"),
                              (z0 + 0.18, z1 - 0.18, x0 - 0.12 + 0.15, "z"), (z0 + 0.18, z1 - 0.18, x1 + 0.12 - 0.15, "z")):
        if axis == "x":
            fbox(b, P["granite"], a, b_, py, py + 0.55, at - 0.15, at + 0.15, "+y -z +z -x +x")
        else:
            fbox(b, P["granite"], at - 0.15, at + 0.15, py, py + 0.55, a, b_, "+y -x +x -z +z")
        n = int((b_ - a) / 0.9)
        for i in range(n):
            u = a + (i + 0.5) * (b_ - a) / n
            if axis == "x":
                fbox(b, P["granite"], u - 0.22, u + 0.22, py + 0.55, py + 0.95, at - 0.15, at + 0.15, "+y -z +z -x +x")
            else:
                fbox(b, P["granite"], at - 0.15, at + 0.15, py + 0.55, py + 0.95, u - 0.22, u + 0.22, "+y -x +x -z +z")
    # slit windows lighting the stair, dark, in stone surrounds
    for yy in (5.2, 9.6):
        for (x, z, n) in ((x1 + 0.005, TZ, (1, 0, 0)), (TX, z0 - 0.005, (0, 0, -1))):
            if n[0]:
                facing(b, P["slit"], [(x, yy, z - 0.09), (x, yy, z + 0.09), (x, yy + 0.9, z + 0.09), (x, yy + 0.9, z - 0.09)], n)
                fbox(b, P["granite"], x - 0.02, x + 0.05, yy - 0.12, yy + 1.02, z - 0.2, z + 0.2, "+x -z +z +y -y")
                facing(b, P["slit"], [(x + 0.051, yy, z - 0.09), (x + 0.051, yy, z + 0.09), (x + 0.051, yy + 0.9, z + 0.09), (x + 0.051, yy + 0.9, z - 0.09)], n)
            else:
                fbox(b, P["granite"], x - 0.2, x + 0.2, yy - 0.12, yy + 1.02, z - 0.05, z + 0.02, "-z -x +x +y -y")
                facing(b, P["slit"], [(x - 0.09, yy, z - 0.051), (x + 0.09, yy, z - 0.051), (x + 0.09, yy + 0.9, z - 0.051), (x - 0.09, yy + 0.9, z - 0.051)], n)
    # the clocks' roundels: east, north, south (the dials are the JS's)
    for (c, n) in (((x1, CLOCK_Y, TZ), (1, 0, 0)), ((TX, CLOCK_Y, z0), (0, 0, -1)), ((TX, CLOCK_Y, z1), (0, 0, 1))):
        roundel(b, P, c, n)
    # the belfry: its floor, the bell frame's beams and bearings
    fbox(b, P["boards"], x0 + T, x1 - T, 14.55, 14.6, z0 + T, z1 - T, "+y")
    for sz in (-1, 1):
        z = TZ + sz * 0.95
        fbox(b, P["oak"], x0 + T, x1 - T, PIVOT[1] - 0.26, PIVOT[1] - 0.08, z - 0.08, z + 0.08, "+y -y +z -z")
        for sx in (-1, 1):                           # the frame's posts to the floor
            fbox(b, P["oak"], TX + sx * 0.95 - 0.07, TX + sx * 0.95 + 0.07, 14.6, PIVOT[1] - 0.26, z - 0.07, z + 0.07, "+x -x +z -z")
        b.box(P["iron"], 0.16, 0.06, 0.18, TX, PIVOT[1] - 0.08, z)
    R.end()
    # the top: pinnacles, gargoyles, the spire
    R.begin(b, "chapel:spire", on="chapel:tower")
    for (cx, cz) in ((x0 - 0.02, z0 - 0.02), (x1 + 0.02, z0 - 0.02), (x0 - 0.02, z1 + 0.02), (x1 + 0.02, z1 + 0.02)):
        lathe(b, P["granite"], cx, cz, [(0.26, 0.0), (0.26, 0.5), (0.3, 0.6), (0.22, 0.7), (0.16, 1.4), (0.1, 2.0), (0.0, 2.5)], seg=8, y0=py + 0.95)
        lathe(b, P["granite"], cx, cz, [(0.0, 0.0), (0.06, 0.03), (0.08, 0.09), (0.05, 0.15), (0.0, 0.17)], seg=8, y0=py + 3.45)
    for (cx, cz, sx, sz) in ((x0, z0, -1, -1), (x1, z0, 1, -1), (x0, z1, -1, 1), (x1, z1, 1, 1)):
        gargoyle(b, P, cx, top - 0.35, cz, (sx / math.sqrt(2), 0.0, sz / math.sqrt(2)), 1.0)
    # the spire: an octagon of slate from inside the parapet to the point
    r0, sb, apex = 1.55, py + 0.1, TW["spire"]
    ring_ = [(TX + r0 * math.cos(math.pi / 8 + i * math.pi / 4), sb, TZ + r0 * math.sin(math.pi / 8 + i * math.pi / 4)) for i in range(8)]
    ap = (TX, apex, TZ)
    for i in range(8):
        a, d = ring_[i], ring_[(i + 1) % 8]
        facing(b, P["slate"], [a, d, ap], ((a[0] + d[0]) / 2 - TX, 0.35, (a[2] + d[2]) / 2 - TZ))
        b.cyl(P["lead"], 0.035, a, ap, seg=4, caps=False)
    for k in range(1, 10):                            # slate courses: lead-dark lines round it
        t = k / 11
        for i in range(8):
            a, d = ring_[i], ring_[(i + 1) % 8]
            pa = [a[j] + (ap[j] - a[j]) * t for j in range(3)]
            pd = [d[j] + (ap[j] - d[j]) * t for j in range(3)]
            n = ((a[0] + d[0]) / 2 - TX, 0.35, (a[2] + d[2]) / 2 - TZ)
            L = math.sqrt(sum(v * v for v in n))
            off = [v / L * 0.012 for v in n]
            facing(b, P["lead"], [tuple(pa[j] + off[j] for j in range(3)), tuple(pd[j] + off[j] for j in range(3)),
                                  tuple(pd[j] + off[j] + (0.0 if j != 1 else 0.035) for j in range(3)), tuple(pa[j] + off[j] + (0.0 if j != 1 else 0.035) for j in range(3))], n)
    # lucarnes: little gabled openings on the cardinal faces
    for ang in (0.0, math.pi / 2, math.pi, 3 * math.pi / 2):
        lucarne(b, P, ang, sb + 1.7, r0)
    # the top: gilt ball, cross, the weathercock
    lathe(b, P["gilt"], TX, TZ, [(0.0, 0.0), (0.1, 0.04), (0.14, 0.14), (0.1, 0.24), (0.0, 0.28)], seg=12, y0=apex - 0.05)
    b.cyl(P["iron"], 0.03, (TX, apex + 0.2, TZ), (TX, apex + 1.6, TZ), seg=6)
    b.box(P["iron"], 0.05, 0.05, 0.6, TX, apex + 1.0, TZ)
    for sx, sz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        b.cyl(P["iron"], 0.012, (TX, apex + 0.6, TZ), (TX + sx * 0.38, apex + 0.6, TZ + sz * 0.38), seg=4)
    cock = [(-0.32, 0.0), (0.05, 0.0), (0.12, 0.08), (0.22, 0.1), (0.3, 0.2), (0.22, 0.26), (0.2, 0.34), (0.12, 0.3), (0.06, 0.18),
            (-0.12, 0.2), (-0.26, 0.42), (-0.3, 0.28), (-0.36, 0.12)]
    y = apex + 1.62
    b.prism(P["gilt"], [(TX + u, y + v) for u, v in cock], TZ - 0.008, TZ + 0.008, axis="z")
    R.end()


def roundel(b, P, c, n):
    """A clock's stone surround: a ring proud of the wall, a dark dial bed."""
    U = (0.0, 0.0, 1.0) if n[0] else (1.0, 0.0, 0.0)          # across the face

    def at(u, v, d):
        return (c[0] + n[0] * d + U[0] * u, c[1] + v, c[2] + n[2] * d + U[2] * u)
    seg = 24
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        for (ra, rb, d, m) in ((CLOCK_R, CLOCK_R + 0.16, 0.1, P["granite"]), (0.0, CLOCK_R, 0.04, P["dark"])):
            pts = [at(rb * math.cos(a0), rb * math.sin(a0), d), at(rb * math.cos(a1), rb * math.sin(a1), d)]
            pts = ([at(0.0, 0.0, d)] if ra == 0 else [at(ra * math.cos(a1), ra * math.sin(a1), d), at(ra * math.cos(a0), ra * math.sin(a0), d)]) + pts
            facing(b, m, pts, n)
        r, am = CLOCK_R + 0.16, (a0 + a1) / 2                   # the ring's outer edge
        out = (U[0] * math.cos(am), math.sin(am), U[2] * math.cos(am))
        facing(b, P["granite"], [at(r * math.cos(a0), r * math.sin(a0), 0.0), at(r * math.cos(a1), r * math.sin(a1), 0.0),
                                 at(r * math.cos(a1), r * math.sin(a1), 0.1), at(r * math.cos(a0), r * math.sin(a0), 0.1)], out)


def lucarne(b, P, ang, y, r0):
    """A little gabled opening on the spire's face at angle ang."""
    ca, sa = math.cos(ang), math.sin(ang)
    d = r0 * math.cos(math.pi / 8) * 0.62           # partway up, so set in from the base
    cx, cz = TX + ca * d, TZ + sa * d
    w, h, depth = 0.5, 0.6, 0.7
    rt = (-sa, 0.0, ca)
    def P_(u, v, t):
        return (cx + rt[0] * u + ca * t, y + v, cz + rt[2] * u + sa * t)
    # front gable and roof
    front = [P_(-w / 2, 0, 0.15), P_(w / 2, 0, 0.15), P_(w / 2, h, 0.15), P_(0, h + 0.3, 0.15), P_(-w / 2, h, 0.15)]
    facing(b, P["slate"], front, (ca, 0, sa))
    facing(b, P["dark"], [P_(-w / 2 + 0.08, 0.05, 0.16), P_(w / 2 - 0.08, 0.05, 0.16), P_(w / 2 - 0.08, h - 0.05, 0.16), P_(-w / 2 + 0.08, h - 0.05, 0.16)], (ca, 0, sa))
    for s in (-1, 1):
        facing(b, P["slate"], [P_(s * w / 2, h, 0.15), P_(0, h + 0.3, 0.15), P_(0, h + 0.3, -depth), P_(s * w / 2 * 1.0, h, -depth)], (rt[0] * s, 0.8, rt[2] * s))
        facing(b, P["slate"], [P_(s * w / 2, 0, 0.15), P_(s * w / 2, h, 0.15), P_(s * w / 2, h, -depth), P_(s * w / 2, 0, -depth)], (rt[0] * s, 0, rt[2] * s))


def gargoyle(b, P, x, y, z, d, s):
    """A troll gargoyle crouched on a corner, leaning out along d (unit,
    horizontal): a stone body, forepaws on the ledge, the head with the grin
    cut in, a spout out of the mouth."""
    rt = (-d[2], 0.0, d[0])
    def at(fwd, up, side):
        return (x + d[0] * fwd + rt[0] * side, y + up, z + d[2] * fwd + rt[2] * side)
    G = P["granite_dk"]
    b.cyl(G, 0.2 * s, at(-0.1, 0.0, 0.0), at(0.45 * s, 0.12 * s, 0.0), seg=8, r2=0.17 * s)           # the body
    for side in (-1, 1):
        b.cyl(G, 0.06 * s, at(0.3 * s, 0.05, side * 0.13 * s), at(0.55 * s, -0.18 * s, side * 0.16 * s), seg=5)     # forelegs
        b.cyl(G, 0.05 * s, at(0.1, 0.25 * s, side * 0.15 * s), at(-0.05, 0.45 * s, side * 0.32 * s), seg=4, r2=0.01)   # wing stubs
    hc = at(0.62 * s, 0.22 * s, 0.0)
    r = 0.2 * s
    lathe(b, G, hc[0], hc[2], [(0.0, 0.0)] + [(r * math.sin(math.pi * k / 8), r - r * math.cos(math.pi * k / 8)) for k in range(1, 8)] + [(0.0, 2 * r)],
          seg=10, y0=hc[1] - r)
    for side in (-1, 1):                              # pointed ears
        e = at(0.6 * s, 0.38 * s, side * 0.15 * s)
        lathe(b, G, e[0], e[2], [(0.06 * s, 0.0), (0.0, 0.16 * s)], seg=5, y0=e[1])
    troll_face(b, P["slit"], hc, r, d)
    b.cyl(P["lead"], 0.035 * s, at(0.75 * s, 0.14 * s, 0.0), at(1.05 * s, 0.1 * s, 0.0), seg=6, caps=False)   # the spout
    b.box(P["moss"], 0.2 * s, 0.01, 0.16 * s, *at(0.2 * s, 0.19 * s, 0.0))


def ringing_room(b, P, R):
    """At the tower's foot, through the nave's north wall: a board floor, a
    ceiling with the rope's hole, a bench along the west wall, the peal
    board (its words are the JS's)."""
    x0, x1, z0, z1 = TW["x0"] + T, TW["x1"] - T, TW["z0"] + T, NAVE["z0"]
    R.begin(b, "chapel:ringing-room", on="chapel:tower")
    fbox(b, P["boards"], x0, x1, 0.0, 0.02, z0, z1, "+y")
    fbox(b, P["boards"], x0, x1, ROOM_CEIL, ROOM_CEIL + 0.12, z0, z1, "-y")
    for k in range(4):                                # the joists
        z = z0 + 0.35 + k * (z1 - z0 - 0.7) / 3
        fbox(b, P["oak"], x0, x1, ROOM_CEIL - 0.16, ROOM_CEIL, z - 0.07, z + 0.07, "-y +z -z")
    facing(b, P["dark"], [(TX + 0.3, ROOM_CEIL - 0.165, TZ - 0.1), (TX + 0.5, ROOM_CEIL - 0.165, TZ - 0.1), (TX + 0.5, ROOM_CEIL - 0.165, TZ + 0.1),
                          (TX + 0.3, ROOM_CEIL - 0.165, TZ + 0.1)], (0, -1, 0))
    # the bench along the west wall
    fbox(b, P["oak"], x0, x0 + 0.38, 0.42, 0.47, z0 + 0.3, z1 - 0.5, "+y -y +x +z -z")
    for z in (z0 + 0.45, z1 - 0.65):
        fbox(b, P["oak"], x0 + 0.05, x0 + 0.33, 0.0, 0.42, z - 0.04, z + 0.04, "+x +z -z")
    # the peal board on the north wall: a dark frame
    fbox(b, P["oak"], TX - 0.6, TX + 0.6, 1.3, 2.3, z0, z0 + 0.04, "+z +y -y -x +x")
    R.end()


def nave_gargoyles(b, P, R):
    """Three more on the nave's corners (the fourth is the tower's)."""
    h = NAVE["h"]
    for i, (x, z, sx, sz) in enumerate(((NAVE["x0"], NAVE["z0"], -1, -1), (NAVE["x0"], NAVE["z1"], -1, 1), (NAVE["x1"], NAVE["z1"], 1, 1))):
        R.begin(b, f"chapel:gargoyle-{i}")
        gargoyle(b, P, x, h - 0.3, z, (sx / math.sqrt(2), 0.0, sz / math.sqrt(2)), 0.85)
        R.end()


def build_tower(P, R):
    b = HGBuilder()
    tower(b, P, R)
    ringing_room(b, P, R)
    nave_gargoyles(b, P, R)
    for face in FACES:
        R.face(*face)
    b.finish("hg-chapel-tower.glb")


# ------------------------------------------------------------------ the bell

def build_bell(P, R):
    """The bell about its axle (origin), its mouth down: crown, shoulder,
    waist, sound bow, lip; the headstock and gudgeons above."""
    b = HGBuilder()
    R.begin(b, "chapel:bell", on="chapel:tower")
    S = BELL_S
    prof = [(0.0, 0.55), (0.2, 0.5), (0.22, 0.25), (0.3, 0.08), (0.33, 0.0), (0.38, 0.0), (0.385, 0.05), (0.34, 0.12),
            (0.27, 0.25), (0.24, 0.4), (0.23, 0.52), (0.2, 0.58), (0.12, 0.62), (0.0, 0.63)]
    lip = -0.72 * S
    lathe(b, P["bell"], 0.0, 0.0, [(r * S, v * S) for r, v in prof], seg=24, y0=lip, caps=False)
    for k in range(2):                               # the inscription bands, a touch proud
        y = lip + (0.47 + k * 0.05) * S
        lathe(b, P["bell"], 0.0, 0.0, [(0.236 * S, 0.0), (0.244 * S, 0.006 * S), (0.244 * S, 0.012 * S), (0.236 * S, 0.018 * S)], seg=24, y0=y, caps=False)
    for a in (0.4, 2.1, 3.9, 5.2):                   # verdigris streaks down from the crown
        ca, sa = math.cos(a), math.sin(a)
        facing(b, P["verdigris"], [(0.207 * S * ca, lip + 0.585 * S, 0.207 * S * sa), (0.207 * S * ca - 0.04 * sa, lip + 0.585 * S, 0.207 * S * sa + 0.04 * ca),
                                   (0.262 * S * ca - 0.03 * sa, lip + 0.3 * S, 0.262 * S * sa + 0.03 * ca), (0.262 * S * ca, lip + 0.3 * S, 0.262 * S * sa)], (ca, 0.3, sa))
    fbox(b, P["oak"], -0.15, 0.15, -0.14, 0.1, -0.85, 0.85, "+y -y +x -x +z -z")     # the headstock
    for sz in (-1, 1):
        b.cyl(P["iron"], 0.035, (0.0, 0.0, sz * 0.85), (0.0, 0.0, sz * 0.97), seg=6)   # the gudgeons
        for sx in (-1, 1):                                                            # straps over the crown
            b.box(P["iron"], 0.035, 0.24, 0.06, sx * 0.13, -0.18, sz * 0.15)
    R.end(offset=PIVOT)
    b.finish("hg-bell.glb")


def build_clapper(P, R):
    b = HGBuilder()
    R.begin(b, "chapel:bell-clapper", on=["chapel:bell", "chapel:tower"])
    S = BELL_S
    b.cyl(P["iron"], 0.022, (0.0, -0.1 * S, 0.0), (0.0, -0.55 * S, 0.0), seg=6)
    lathe(b, P["iron"], 0.0, 0.0, [(0.0, 0.0), (0.05, 0.03), (0.085, 0.08), (0.08, 0.13), (0.04, 0.17), (0.0, 0.18)], seg=10, y0=-0.66 * S)
    b.cyl(P["iron"], 0.018, (0.0, -0.66 * S, 0.0), (0.0, -0.71 * S, 0.0), seg=5)       # the flight
    R.end(offset=PIVOT)
    b.finish("hg-bell-clapper.glb")


# ------------------------------------------------------------------ the organ

# hollowgrin-chapel.js ORGAN: the case against the east wall south of the
# door, the console before it, the bench the ghost sits on
ORGAN = {"x0": -40.15, "x1": -39.6, "z0": 4.6, "z1": 7.4, "h": 6.6}
CONSOLE = {"x0": -40.7, "x1": -40.15, "z0": 5.1, "z1": 6.7, "h": 1.1}
BENCH = {"x0": -41.3, "x1": -40.9, "z0": 5.3, "z1": 6.5, "h": 0.5}


def pipe(b, P, x, z, y0, length, r):
    """One front pipe: a conical foot, the body, the mouth's dark slot
    and its gilt lip, facing west."""
    lathe(b, P["pewter"], x, z, [(0.02, 0.0), (r, 0.22), (r, 0.24)], seg=8, y0=y0, caps=False)
    b.cyl(P["pewter"], r, (x, y0 + 0.24, z), (x, y0 + length, z), seg=8, caps=False)
    facing(b, P["dark"], [(x - r - 0.002, y0 + 0.3, z - r * 0.55), (x - r - 0.002, y0 + 0.3, z + r * 0.55),
                          (x - r - 0.002, y0 + 0.3 + r * 0.9, z + r * 0.55), (x - r - 0.002, y0 + 0.3 + r * 0.9, z - r * 0.55)], (-1, 0, 0))
    facing(b, P["gilt"], [(x - r - 0.004, y0 + 0.27, z - r * 0.6), (x - r - 0.004, y0 + 0.27, z + r * 0.6),
                          (x - r - 0.004, y0 + 0.3, z + r * 0.6), (x - r - 0.004, y0 + 0.3, z - r * 0.6)], (-1, 0, 0))


def build_organ(P, R):
    b = HGBuilder()
    O, Cn, B = ORGAN, CONSOLE, BENCH
    R.begin(b, "chapel:organ")
    # the case: an oak base, panelled; the pipe towers stand on it
    fbox(b, P["oak"], O["x0"], O["x1"], 0.0, 1.1, O["z0"], O["z1"], "-x +y +z -z")
    for k in range(4):
        z0 = O["z0"] + 0.12 + k * (O["z1"] - O["z0"] - 0.24) / 4
        fbox(b, P["oak_lt"], O["x0"] - 0.02, O["x0"], 0.15, 0.95, z0 + 0.06, z0 + (O["z1"] - O["z0"] - 0.24) / 4 - 0.06, "-x +y -y +z -z")
    fbox(b, P["oak"], O["x0"] - 0.06, O["x1"], 1.1, 1.2, O["z0"] - 0.06, O["z1"] + 0.06, "-x +y -y +z -z")
    # three towers of pipes, the middle one tallest, the flats between
    zc = (O["z0"] + O["z1"]) / 2
    towers = [(O["z0"] + 0.4, 0.75, 3.4), (zc, 0.95, 4.9), (O["z1"] - 0.4, 0.75, 3.4)]
    flats = [((O["z0"] + 0.4 + 0.375, zc - 0.475), 2.6), ((zc + 0.475, O["z1"] - 0.4 - 0.375), 2.6)]
    xp = O["x0"] + 0.12
    for (c, w, top) in towers:
        n = 5 if w > 0.8 else 4
        for i in range(n):
            u = (i - (n - 1) / 2) / max(1, n - 1)
            length = top - 0.25 - 0.55 * abs(u) * 2
            pipe(b, P, xp, c + u * (w - 0.18), 1.2, length, 0.075 if w > 0.8 else 0.065)
        # the tower's shell behind and its cornice, a finial
        fbox(b, P["oak"], xp + 0.08, O["x1"], 1.2, 1.2 + top, c - w / 2, c + w / 2, "-x -z +z +y")
        fbox(b, P["oak"], O["x0"] - 0.04, O["x1"], 1.2 + top, 1.32 + top, c - w / 2 - 0.06, c + w / 2 + 0.06, "-x +y -y +z -z")
        lathe(b, P["gilt"], O["x0"] + 0.2, c, [(0.08, 0.0), (0.05, 0.12), (0.09, 0.2), (0.0, 0.5)], seg=8, y0=1.32 + top)
    for ((a, e), top) in flats:
        n = max(3, int((e - a) / 0.13))
        for i in range(n):
            u = a + (i + 0.5) * (e - a) / n
            pipe(b, P, xp, u, 1.2, top - 0.3 - 0.25 * abs((u - (a + e) / 2) / (e - a)) * 2, 0.045)
        fbox(b, P["oak"], xp + 0.06, O["x1"], 1.2, 1.2 + top, a, e, "-x +y")
        fbox(b, P["oak"], O["x0"] - 0.03, O["x1"], 1.2 + top, 1.28 + top, a, e, "-x +y -y")
    # the carved boss over the middle tower: a gilt roundel, a trollface cut in it
    by = 1.2 + towers[1][2] + 0.75
    lathe(b, P["gilt"], O["x0"] + 0.15, zc, [(0.0, -0.32), (0.3, -0.3), (0.32, 0.0), (0.3, 0.3), (0.0, 0.32)], seg=14, y0=by)
    troll_face(b, P["dark"], (O["x0"] + 0.15, by, zc), 0.3, (-1.0, 0.0, 0.0))
    R.end()
    # the console: the key desk (its keys are the JS's), stop knobs either side, a music desk
    R.begin(b, "chapel:organ-console", on="chapel:organ")
    fbox(b, P["oak"], Cn["x0"], Cn["x1"], 0.0, 0.72, Cn["z0"], Cn["z1"], "-x +y +z -z")
    for s in (-1, 1):                                 # cheeks either side of the keys
        z = Cn["z0"] + 0.05 if s < 0 else Cn["z1"] - 0.05
        fbox(b, P["oak"], Cn["x0"], Cn["x1"], 0.72, Cn["h"], z - 0.05, z + 0.05, "-x +y +z -z")
        for k in range(6):                            # stop knobs, white faces
            kz = z - s * 0.0
            ky = 0.82 + (k % 3) * 0.09
            kx = Cn["x0"] + 0.18 + (k // 3) * 0.12
            b.cyl(P["oak_lt"], 0.018, (kx, ky, z - s * 0.05), (kx, ky, z - s * 0.1), seg=6)
            b.cyl(P["ivory"], 0.022, (kx, ky, z - s * 0.1), (kx, ky, z - s * 0.11), seg=8)
    fbox(b, P["oak"], Cn["x0"] + 0.3, Cn["x1"], 0.72, Cn["h"] + 0.35, Cn["z0"] + 0.1, Cn["z1"] - 0.1, "-x +y")
    facing(b, P["paper"], [(Cn["x0"] + 0.295, 1.18, 5.55), (Cn["x0"] + 0.295, 1.18, 6.25), (Cn["x0"] + 0.295, 1.42, 6.25), (Cn["x0"] + 0.295, 1.42, 5.55)], (-1, 0, 0))
    R.end()
    R.begin(b, "chapel:organ-bench", on="chapel:organ-console")
    fbox(b, P["oak"], B["x0"], B["x1"], B["h"] - 0.05, B["h"], B["z0"], B["z1"], "+y -y -x +x +z -z")
    for z in (B["z0"] + 0.06, B["z1"] - 0.06):
        fbox(b, P["oak"], B["x0"] + 0.03, B["x1"] - 0.03, 0.0, B["h"] - 0.05, z - 0.03, z + 0.03, "-x +x +z -z")
    R.end()
    b.finish("hg-organ.glb")


FACES = [
    ("clock:east", "chapel:tower", (TW["x1"] + 0.06, CLOCK_Y, TZ), (1, 0, 0), 2.0, 2.0),
    ("clock:north", "chapel:tower", (TX, CLOCK_Y, TW["z0"] - 0.06), (0, 0, -1), 2.0, 2.0),
    ("clock:south", "chapel:tower", (TX, CLOCK_Y, TW["z1"] + 0.06), (0, 0, 1), 2.0, 2.0),
]
