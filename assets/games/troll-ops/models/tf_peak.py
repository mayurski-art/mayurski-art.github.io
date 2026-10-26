"""
Troll Peak (build_trollface_island.blender.py, phase 1): the purple mountain
rebuilt after refs/island/troll-peak.webp, in its own frame (the summit's
axis at 0, 0; x east, z south; the map lays it at LANDMARKS.peak).

  the three terraces as the map has always had them (TIERS: r 22, 15, 9 at
  4.62, 8.58, 12.21) with their three flights step for step (south, east,
  north), now with timber rails, grass ledges and rock faces with real facets
  the summit above the third terrace, rebuilt as a crag you can climb: three
  rock bands (12.21-18, 18-24, 24-30), each with a flat south face a flight
  runs along, switching back: up east to the south-east balcony at 18, up
  west to the south-west balcony at 24, up east again to the top at 30
  the two balconies are natural rock ledges, cantilevered over the third
  terrace (a player walks under them); the west one has the telescope
  the top: a rock platform with the lookout hut (its trollface window over
  the door, lettered by the map's grin decal), the flagpole and the bell
  cairns with bunting between them on the terraces, crates, climbing ropes
  down one face, pines on the skirts

Colliders: the terraces and the old flights as before; the bands as 3 m
strips of their discs clipped at the flat face; the new flights step for
step (0.33 rise, 0.5 run, 1.8 wide); the balconies 0.3 thick; the hut's
walls and furniture; the cairns' and the pines' trunks.
"""
import math
import random

from map_kit import mat

TIERS = [(22, 4.62), (15, 8.58), (9, 12.21)]       # [radius, top] as in trollface-island.js
RISE, RUN, STAIR_W = 0.33, 0.5, 1.8
# the summit's bands: (y0, y1, r at y0, r at y1, the flat south face's z)
BANDS = [(12.21, 18.0, 6.5, 6.0, 5.0), (18.0, 24.0, 6.0, 5.4, 4.2), (24.0, 30.0, 5.4, 5.0, 3.4)]
TOP = 30.0
LIP_R = 6.5
# the three new flights: (top x, top z, direction the steps descend along x, y0, y1)
FLIGHTS = [(4.5, 5.9, -1, 12.21, 18.0), (-5.0, 5.1, 1, 18.0, 24.0), (3.5, 4.3, -1, 24.0, 30.0)]   # the last tops inside the lip's strips
LEDGES = [((4.0, 8.5), (1.0, 6.5), 18.0), ((-9.0, -4.5), (0.5, 6.0), 24.0)]     # (x0, x1), (z0, z1), top
HUT = (0.0, -0.8, 4.2, 3.4, 2.6)          # x, z, w (x), d (z), wall height; the door and window face south

LOOT = []
SIGNS = []


def palette():
    return {
        "peak": mat("TF_PeakRock", 0x8f80e6, 0.95),
        "peak_dk": mat("TF_PeakRockDark", 0x6f61c8, 0.95),
        "peak_lt": mat("TF_PeakRockLight", 0xa89cf0, 0.95),
        "snow": mat("TF_PeakSnow", 0xf6f8ff, 0.8),
        "turf": mat("TF_PeakGrass", 0x5fc46e, 0.9),
        "turf_dk": mat("TF_PeakGrassDark", 0x3f9a52, 0.9),
        "step": mat("TF_PeakStep", 0xb3aade, 0.95),
        "flag": mat("TF_FlagPurple", 0x8a3fc4, 0.7),
        "white": mat("TF_White", 0xf4f4f0, 0.6),
        "pole": mat("TF_Pole", 0x2f3338, 0.5, 0.3),
        "brass": mat("TF_Brass", 0xc9a040, 0.35, 0.4),
        "timber": mat("TF_Timber", 0x8a6a3e, 0.8),
        "timber_dk": mat("TF_WoodDark", 0x5c4327, 0.75),
        "plank": mat("GS_Plank", 0xffffff, 0.8),
        "shingle": mat("TF_Shingle", 0x4a3b2e, 0.9),
        "crate": mat("TF_Crate", 0x8a6a3e, 0.8),
        "lamp": mat("TF_Lamp", 0xfff6dc, 0.2, 0.0, 0xfff1d0, 1.2),
        "window": mat("TF_HutWindow", 0xfff1c2, 0.3, 0.0, 0xffe7a8, 0.8),
        "iron": mat("TF_Iron", 0x3a3d42, 0.6, 0.6),
        "rope": mat("TF_ClimbRope", 0xd8c48a, 0.9),
        "bunt_a": mat("TF_BuntRed", 0xd23b2f, 0.7),
        "bunt_b": mat("TF_BuntYellow", 0xf2cf4a, 0.7),
        "bunt_c": mat("TF_BuntBlue", 0x2f63e0, 0.7),
        "bunt_d": mat("TF_BuntGreen", 0x2f8f4e, 0.7),
        "stone": mat("TF_Cairn", 0x7d7f8c, 0.95),
        "pine": mat("TF_Pine", 0x2f7a3e, 0.9),
        "pine_dk": mat("TF_PineDark", 0x235c2e, 0.9),
        "bark": mat("TF_Bark", 0x5a4030, 0.9),
        "brass_dk": mat("TF_BrassDark", 0x8a6a2a, 0.4, 0.4),
        "lens": mat("TF_Lens", 0x9fd2f0, 0.1, 0.1),
        "bed": mat("TF_Bed", 0xe8e4da, 0.8),
        "blanket": mat("TF_BlanketGreen", 0x3a5a3a, 0.8),
    }


class Peak:
    def __init__(self, b, P, R, origin):
        self.b, self.P, self.R = b, P, R
        self.ox, self.oz = origin
        self.rng = random.Random(7)
        LOOT.clear()

    def col(self, x, z, w, d, h, y=0.0, pen=1.2):
        self.R.collider(self.ox + x, self.oz + z, w, d, h, y, pen)

    def face(self, fid, owner, c, n, w, h):
        self.R.face(fid, owner, (self.ox + c[0], c[1], self.oz + c[2]), (n[0], 0.0, n[1]), w, h)

    def begin(self, pid, on=None):
        self.R.begin(self.b, pid, on)

    def end(self):
        self.R.end((self.ox, 0.0, self.oz))

    def loot(self, x, y, z):
        LOOT.append({"x": round(self.ox + x, 2), "z": round(self.oz + z, 2), "y": round(y, 2)})

    def disc_cols(self, r, y, h, zmax=None, pen=1.2, strip=3.0):
        """The map's disc colliders: strips following the circle (3 m, as
        the map laid them; finer where a flight's foot sits near the edge),
        cut at z <= zmax where a flight runs along a flat face."""
        n = max(1, math.ceil(2 * r / strip))
        step = 2 * r / n
        for i in range(n):
            z0, z1 = -r + i * step, -r + (i + 1) * step
            if zmax is not None:
                z1 = min(z1, zmax)
            if z1 - z0 < 0.2:
                continue
            zm = (z0 + z1) / 2
            hw = math.sqrt(max(0.0, r * r - zm * zm))
            if hw > 0.4:
                self.col(0, zm, hw * 2, z1 - z0, h, y, pen)

    def skirt(self, r_bot, r_top, y0, y1, zmax=None):
        """A leaning crag wall's lower two thirds as wider discs (user,
        2026-10-25: "im actually able to enter inside of it a little"): the
        wall leans from r_bot at its foot to r_top at its top, so a disc at
        the top radius alone let a troll walk ~1.4 m into the rock. Each
        slice takes the wall's radius at the slice's foot, 0.15 m in."""
        H = y1 - y0
        for k in range(2):
            r = r_bot + (r_top - r_bot) * k / 3 - 0.15
            self.disc_cols(r, y0 + H * k / 3, H / 3, zmax=zmax, strip=1.2)


# ------------------------------------------------------------- rock

def crag_ring(b, rng, m_side, m_top, r_bot, r_top, y0, y1, seg=30, jit=0.7, top=True, zflat=None):
    """A rocky tier: a leaning wall of facets, jagged sideways, its top ring
    exactly at y1 and capped flat; `zflat` flattens its south side (the
    flights run along it)."""
    rings = 4
    idx, pts = [], []
    for k in range(rings + 1):
        t = k / rings
        y = y0 + (y1 - y0) * t
        row = []
        for j in range(seg):
            a = 2 * math.pi * (j + (0.5 if k % 2 else 0) * 0.35) / seg
            r = r_bot + (r_top - r_bot) * t
            if 0 < k < rings:
                r += rng.uniform(-jit, jit) * 1.2
                y_j = y + rng.uniform(-0.25, 0.25) * (y1 - y0) / rings
            else:
                r += rng.uniform(-jit, jit) * (0.25 if k == rings else 1.0)
                y_j = y
            x, z = r * math.cos(a), r * math.sin(a)
            if zflat is not None and z > zflat - 0.15:
                z = zflat - 0.15 - rng.uniform(0, 0.1)
            row.append(len(pts))
            pts.append((x, y_j, z))
        idx.append(row)
    faces = []
    for k in range(rings):
        for j in range(seg):
            jj = (j + 1) % seg
            faces.append([idx[k][j], idx[k + 1][j], idx[k + 1][jj], idx[k][jj]])
    b.poly(m_side, pts, faces)
    if top:
        tp = [pts[i] for i in idx[rings]]
        b.poly(m_top, tp, [list(range(len(tp)))[::-1]])


def stairs(b, m, x, z, dx, dz, from_y, to_y, w, bevel=0.03):
    """GreyKit.stairs, step for step (the top at x, z; the steps descend along dx, dz)."""
    n = math.ceil((to_y - from_y) / RISE)
    out = []
    for i in range(n):
        h = to_y - from_y - i * ((to_y - from_y) / n)
        along = (i + 0.5) * 0.5
        sx = 0.5 if dx else w
        sz = 0.5 if dz else w
        b.box(m, sx, h, sz, x + dx * along, from_y, z + dz * along, bevel=bevel)
        out.append((x + dx * along, z + dz * along, sx, sz, h, from_y))
    return out


def rails(b, P, x, z, dx, dz, from_y, to_y, w, n_steps, sides=(-1, 1)):
    """Timber posts and a top rail along a flight's sides (no colliders)."""
    L = n_steps * RUN
    ux, uz = (dx, dz)
    px, pz = (-uz, ux)                       # across the flight
    for s in sides:
        for k in range(0, n_steps + 1, 2):
            along = k * RUN
            y = to_y - (to_y - from_y) * (along / L)
            cx, cz = x + ux * along + px * s * (w / 2 + 0.08), z + uz * along + pz * s * (w / 2 + 0.08)
            b.box(P["timber_dk"], 0.1, 1.0, 0.1, cx, y, cz)
        a = (x + px * s * (w / 2 + 0.08), to_y + 0.95, z + pz * s * (w / 2 + 0.08))
        c = (x + ux * L + px * s * (w / 2 + 0.08), from_y + 0.95, z + uz * L + pz * s * (w / 2 + 0.08))
        b.bar(P["timber"], a, c, 0.08, 0.06)


def sphere(b, m, c, r, seg=10, ring=6):
    import bmesh
    from mathutils import Matrix
    M = Matrix.Translation(c) @ Matrix.Diagonal((r, r, r, 1))
    verts = bmesh.ops.create_uvsphere(b.bm, u_segments=seg, v_segments=ring, radius=1.0, matrix=M)["verts"]
    b._tag({f for v in verts for f in v.link_faces}, m, smooth=True)


# ------------------------------------------------------------- the props

def cairn(C, pid, x, z, y, h=1.3):
    """Stacked stones on a terrace top at y."""
    b, P, rng = C.b, C.P, C.rng
    C.begin(pid, on="peak-rock")
    yy, r, k = y, 0.5, 0
    while yy < y + h:
        s = r * rng.uniform(0.85, 1.1)
        b.lump(P["stone"], s * 2, 0.3, s * 1.6, x, yy, z, seed=100 + int(x * 3 + z) + k, rnd=0.5, jitter=0.15, ry=rng.uniform(0, 3))
        yy += 0.26
        r *= 0.88
        k += 1
    C.end()
    C.col(x, z, 1.0, 0.9, h, y, 1.5)


def bunting(C, a, c, n=9, sag=0.5):
    """A string of little flags between two cairns' tops."""
    b, P, rng = C.b, C.P, C.rng
    (x0, y0, z0), (x1, y1, z1) = a, c
    prev = a
    for k in range(1, n + 1):
        t = k / n
        p = (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - sag * math.sin(math.pi * t), z0 + (z1 - z0) * t)
        b.bar(P["rope"], prev, p, 0.02)
        if k < n:
            ry = math.atan2(x1 - x0, z1 - z0)
            b.box(P[rng.choice(("bunt_a", "bunt_b", "bunt_c", "bunt_d"))], 0.26, 0.3, 0.02, p[0], p[1] - 0.3, p[2], ry=ry)
        prev = p


def crate(C, pid, x, z, y, s=0.9, ry=0.0):
    b, P = C.b, C.P
    C.begin(pid, on="peak-rock")
    b.box(P["crate"], s, s, s, x, y, z, ry=ry, bevel=0.03)
    for k in (-0.35, 0.35):
        b.box(P["timber_dk"], s + 0.04, 0.08, s + 0.04, x, y + s / 2 + k * s, z, ry=ry)
    C.end()
    C.col(x, z, s, s, s, y, 1.2)


def pine(C, pid, x, z, h=5.0, y=0.0):
    b, P = C.b, C.P
    C.begin(pid, on="peak-rock")
    b.cyl(P["bark"], 0.22, (x, y, z), (x, y + h * 0.35, z), seg=7, r2=0.16)
    for k in range(4):
        t = k / 4
        yy = y + h * (0.22 + 0.2 * k)
        b.cyl(P["pine"] if k % 2 else P["pine_dk"], (1.9 - 0.4 * k) * (h / 5), (x, yy, z), (x, yy + h * 0.24, z), seg=7, r2=0.05, smooth=False)
    C.end()
    C.col(x, z, 0.5, 0.5, h * 0.4, y, 2)


def telescope(C, x, z, y, ry):
    b, P = C.b, C.P
    C.begin("telescope", on="peak-rock")
    for k in range(3):
        a = ry + k * 2 * math.pi / 3
        b.cyl(P["timber_dk"], 0.04, (x + math.cos(a) * 0.6, y, z + math.sin(a) * 0.6), (x, y + 1.3, z), seg=6)
    b.cyl(P["brass_dk"], 0.1, (x, y + 1.3, z), (x, y + 1.45, z), seg=8)
    dx, dz = math.sin(ry), math.cos(ry)
    b.cyl(P["brass"], 0.14, (x - dx * 0.5, y + 1.3, z - dz * 0.5), (x + dx * 1.2, y + 1.85, z + dz * 1.2), seg=10, r2=0.2)
    b.cyl(P["lens"], 0.18, (x + dx * 1.2, y + 1.85, z + dz * 1.2), (x + dx * 1.25, y + 1.87, z + dz * 1.25), seg=10)
    C.end()
    C.col(x, z, 1.2, 1.2, 1.5, y, 1.0)


def bell(C, x, z, y):
    b, P = C.b, C.P
    C.begin("bell", on="peak-rock")
    for sx in (-0.6, 0.6):
        b.box(P["timber_dk"], 0.14, 2.3, 0.14, x + sx, y, z)
    b.box(P["timber_dk"], 1.5, 0.14, 0.14, x, y + 2.3, z)
    b.cyl(P["brass"], 0.08, (x, y + 2.3, z), (x, y + 2.0, z), seg=6)
    b.cyl(P["brass"], 0.22, (x, y + 2.0, z), (x, y + 1.5, z), seg=12, r2=0.34)
    b.cyl(P["brass_dk"], 0.36, (x, y + 1.5, z), (x, y + 1.42, z), seg=12)
    C.end()
    C.col(x, z, 1.4, 0.3, 2.4, y, 1.0)


def flagpole(C, x, z, y):
    b, P = C.b, C.P
    C.begin("flagpole", on="peak-rock")
    b.cyl(P["stone"], 0.4, (x, y, z), (x, y + 0.4, z), seg=8)
    b.cyl(P["pole"], 0.09, (x, y + 0.4, z), (x, y + 6.0, z), seg=8)
    sphere(b, P["brass"], (x, y + 6.1, z), 0.15)
    b.box(P["flag"], 2.0, 1.2, 0.06, x + 1.1, y + 4.6, z)
    b.cyl(P["white"], 0.38, (x + 1.1, y + 5.2, z - 0.04), (x + 1.1, y + 5.2, z + 0.04), seg=14)
    C.end()
    C.col(x, z, 0.8, 0.8, 6.0, y, 4)


def rope(C, x0, y0, z0, x1, y1, z1):
    b, P = C.b, C.P
    b.bar(P["rope"], (x0, y0, z0), (x1, y1, z1), 0.05)
    for k in range(1, 4):
        t = k / 4
        px, py, pz = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t
        b.box(P["iron"], 0.08, 0.08, 0.3, px, py, pz)


def hut(C):
    """The lookout hut on the top: timber walls on a stone plinth, a gabled
    shingle roof with the ridge running north-south, the door in the south
    gable under the round trollface window (the map's grin decal lights it),
    a table, the stove and its pipe, a bunk, a lantern by the door."""
    b, P = C.b, C.P
    hx, hz, w, d, h = HUT
    y = TOP
    C.begin("hut", on="peak-rock")
    b.box(P["stone"], w + 0.6, 0.25, d + 0.6, hx, y, hz)
    y0 = y + 0.25
    door_w, door_h = 1.0, 2.1
    # walls: north, east, west full; south in two pieces round the door and a band over it
    walls = [(hx, hz - d / 2 + 0.1, w, 0.2), (hx - w / 2 + 0.1, hz, 0.2, d - 0.4), (hx + w / 2 - 0.1, hz, 0.2, d - 0.4)]
    for (x, z, ww, dd) in walls:
        b.box(P["timber"], ww, h, dd, x, y0, z)
        C.col(x, z, ww, dd, h, y0, 1.0)
    sz = hz + d / 2 - 0.1
    for (x, ww) in ((hx - w / 4 - door_w / 4, w / 2 - door_w / 2), (hx + w / 4 + door_w / 4, w / 2 - door_w / 2)):
        b.box(P["timber"], ww, h, 0.2, x, y0, sz)
        C.col(x, sz, ww, 0.2, h, y0, 1.0)
    b.box(P["timber"], door_w + 0.2, h - door_h, 0.2, hx, y0 + door_h, sz)
    b.box(P["timber_dk"], 0.1, door_h, 0.26, hx - door_w / 2 - 0.05, y0, sz)
    b.box(P["timber_dk"], 0.1, door_h, 0.26, hx + door_w / 2 + 0.05, y0, sz)
    b.box(P["timber_dk"], door_w + 0.2, 0.1, 0.26, hx, y0 + door_h, sz)
    # the gables and the roof
    ridge = y0 + h + 1.5
    for (z, s) in ((hz - d / 2 + 0.1, -1), (sz, 1)):
        b.poly(P["timber"], [(hx - w / 2, y0 + h, z), (hx + w / 2, y0 + h, z), (hx, ridge, z)], [[0, 1, 2] if s > 0 else [2, 1, 0]])
    for s in (-1, 1):
        # a slab leaning from the eave up to the ridge, 0.14 thick, 0.4 over the walls
        ex, ey = hx + s * (w / 2 + 0.4), y0 + h - 0.3
        L = math.hypot(w / 2 + 0.4, ridge - ey)
        ang = math.atan2(ridge - ey, w / 2 + 0.4)
        b.box(P["shingle"], L, 0.14, d + 0.8, (ex + hx) / 2, (ey + ridge) / 2 - 0.07, hz, rz=-s * ang)
    b.box(P["shingle"], 0.3, 0.2, d + 0.9, hx, ridge - 0.1, hz)
    # the round window in the south gable over the door, lit from inside;
    # a square one lit on each side wall; a step at the door
    wy = y0 + h + 0.55
    b.cyl(P["timber_dk"], 0.68, (hx, wy, sz + 0.05), (hx, wy, sz + 0.13), seg=18)
    b.cyl(P["window"], 0.58, (hx, wy, sz + 0.08), (hx, wy, sz + 0.14), seg=18)
    for s in (-1, 1):
        b.box(P["timber_dk"], 0.1, 1.0, 1.0, hx + s * (w / 2 + 0.01), y0 + 1.1, hz - 0.3)
        b.box(P["window"], 0.1, 0.8, 0.8, hx + s * (w / 2 + 0.04), y0 + 1.2, hz - 0.3)
    b.box(P["stone"], 1.6, 0.12, 0.7, hx, y, sz + 0.5)
    # inside: the table, the stove and its pipe, the bunk, a lantern by the door
    b.box(P["timber_dk"], 1.1, 0.06, 0.7, hx + 0.9, y0 + 0.74, hz - 0.6)
    for (lx, lz) in ((0.4, 0.3), (-0.4, 0.3), (0.4, -0.3), (-0.4, -0.3)):
        b.box(P["timber_dk"], 0.06, 0.74, 0.06, hx + 0.9 + lx, y0, hz - 0.6 + lz)
    b.box(P["iron"], 0.6, 0.7, 0.6, hx - 1.4, y0, hz - 1.0, bevel=0.03)
    b.box(P["lamp"], 0.3, 0.2, 0.02, hx - 1.4, y0 + 0.25, hz - 0.69)
    b.cyl(P["iron"], 0.08, (hx - 1.4, y0 + 0.7, hz - 1.0), (hx - 1.4, ridge + 0.6, hz - 1.0), seg=8)
    b.box(P["bed"], 0.9, 0.45, 1.9, hx + 1.3, y0, hz + 0.3, bevel=0.03)
    b.box(P["blanket"], 0.9, 0.1, 1.3, hx + 1.3, y0 + 0.45, hz + 0.5)
    b.box(P["iron"], 0.16, 0.26, 0.16, hx + door_w / 2 + 0.5, y0 + 1.6, sz + 0.2)
    b.box(P["lamp"], 0.1, 0.16, 0.1, hx + door_w / 2 + 0.5, y0 + 1.65, sz + 0.2)
    C.end()
    C.col(hx + 0.9, hz - 0.6, 1.1, 0.7, 0.8, y0, 1.0)
    C.col(hx - 1.4, hz - 1.0, 0.6, 0.6, 0.7, y0, 1.0)
    C.col(hx + 1.3, hz + 0.3, 0.9, 1.9, 0.55, y0, 1.0)
    C.face("hut-door", "hut", (hx, y0 + door_h / 2, sz + 0.1), (0, 1), door_w, door_h)
    C.face("hut-window", "hut", (hx, wy, sz + 0.14), (0, 1), 1.2, 1.2)
    C.loot(hx - 0.5, y0, hz + 0.6)
    return (C.ox + hx, wy, C.oz + sz + 0.16)


# ------------------------------------------------------------- the build

def build(b, P, R, origin):
    C = Peak(b, P, R, origin)
    rng = C.rng
    C.begin("peak-rock")
    # the terraces: the visible top edge sits on the collider's disc (rad -
    # 0.6), the wall leans out to rad + 0.8 at the foot
    base = 0.0
    sides = [P["peak_dk"], P["peak"], P["peak"]]
    tops = [P["turf"], P["turf_dk"], P["peak_lt"]]
    for i, (rad, top) in enumerate(TIERS):
        crag_ring(b, rng, sides[i], tops[i], rad + 0.8, rad - 0.6, base - (0.4 if i == 0 else 0.6), top, seg=34 - i * 6)
        base = top
    # grass patches on the rock tops, a few facets each
    for k in range(10):
        a = rng.uniform(0, 2 * math.pi)
        tier = rng.choice((0, 0, 1))
        r = TIERS[tier][0] - 0.6 - rng.uniform(1.5, 4.0)
        b.lump(P["turf_dk"] if tier == 0 else P["turf"], rng.uniform(2, 4), 0.25, rng.uniform(1.5, 3), r * math.cos(a), TIERS[tier][1] - 0.05, r * math.sin(a), seed=50 + k, rnd=0.3, jitter=0.2)
    # the summit's three bands, flat on the south where the flights run, the
    # lip of the top platform, the top itself
    rocks = []         # the crags and boulders drawn as lumps, for their colliders
    for k, (y0, y1, r0, r1, zf) in enumerate(BANDS):
        crag_ring(b, rng, P["peak_dk"] if k == 0 else P["peak"], P["peak_lt"] if k < 2 else P["snow"], r0 + 0.5, r1, y0 - 0.3, y1, seg=18, jit=0.8, zflat=zf, top=(k < 2))
        for j in range(4):                                                         # crags leaning off the band's far side
            a = math.pi + (j - 1.5) * 0.7 + rng.uniform(-0.2, 0.2)
            r = (r0 + r1) / 2 - 0.3
            h, y = rng.uniform(1.6, 2.8), y0 + rng.uniform(0.5, 3.0)
            b.lump(P["peak_dk"], 2.4, h, 1.8, r * math.cos(a), y, r * math.sin(a), seed=120 + k * 4 + j, rnd=0.6, jitter=0.2, ry=a)
            if r * math.sin(a) < zf - 1.2:                                        # clear of the flights along the flat face
                rocks.append((r * math.cos(a), r * math.sin(a), 1.9, 1.9, h, y))
    crag_ring(b, rng, P["peak"], P["snow"], LIP_R - 0.4, LIP_R, TOP - 0.5, TOP, seg=20, jit=0.25)
    for k in range(6):                                                             # snow crags on the top bands
        a = rng.uniform(math.pi * 0.6, math.pi * 1.9)
        band = BANDS[1 + k % 2]
        r = band[2] - 0.4
        b.lump(P["snow"], 1.6, 1.2, 1.4, r * math.cos(a), band[0] + rng.uniform(1, 4), r * math.sin(a), seed=70 + k, rnd=0.6, jitter=0.18, ry=a)
    for k in range(8):                                                             # boulders at the foot, clear of the south flight
        a = 2 * math.pi * k / 8 + rng.uniform(-0.2, 0.2) + 0.3
        if abs(math.atan2(math.sin(a - math.pi / 2), math.cos(a - math.pi / 2))) < 0.4:
            continue
        r = TIERS[0][0] + rng.uniform(0.6, 1.4)
        s = rng.uniform(1.0, 1.8)
        b.lump(P["peak_dk"], s * 1.4, s * 0.8, s, r * math.cos(a), -0.2, r * math.sin(a), seed=20 + k, rnd=0.6, ry=a)
        rocks.append((r * math.cos(a), r * math.sin(a), s * 1.1, s * 1.1, s * 0.8 - 0.2, 0.0))
    # the balconies: a rock slab with a crag under it, cantilevered off the band
    for k, ((x0, x1), (z0, z1), top) in enumerate(LEDGES):
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        b.box(P["peak_lt"], x1 - x0, 0.3, z1 - z0, cx, top - 0.3, cz)
        b.lump(P["peak_dk"], (x1 - x0) * 0.9, 2.2, (z1 - z0) * 0.9, cx, top - 2.4, cz, seed=90 + k, rnd=0.5, jitter=0.2)
        C.col(cx, cz, x1 - x0, z1 - z0, 0.3, top - 0.3, 1.2)
        C.loot(cx, top, cz)
    # the old flights step for step, then the three new ones along the bands
    steps = []
    steps += stairs(b, P["step"], 0, 21.4, 0, 1, 0, 4.62, 4)
    steps += stairs(b, P["step"], 14.4, 0, 1, 0, 4.62, 8.58, 4)
    steps += stairs(b, P["step"], 0, -8.4, 0, -1, 8.58, 12.21, 4)
    for (x, z, dx, dz, y0, y1, w) in ((0, 21.4, 0, 1, 0, 4.62, 4), (14.4, 0, 1, 0, 4.62, 8.58, 4), (0, -8.4, 0, -1, 8.58, 12.21, 4)):
        rails(b, P, x, z, dx, dz, y0, y1, w, math.ceil((y1 - y0) / RISE))
    for (tx, tz, dx, y0, y1) in FLIGHTS:
        steps += stairs(b, P["step"], tx, tz, dx, 0, y0, y1, STAIR_W)
        rails(b, P, tx, tz, dx, 0, y0, y1, STAIR_W, math.ceil((y1 - y0) / RISE), sides=(1,))
    C.end()
    # the terraces', the bands' and the flights' colliders (the balconies'
    # and the props' are registered where they are drawn)
    base = 0.0
    for i, (rad, top) in enumerate(TIERS):
        C.disc_cols(rad - 0.6, 0.0, top, strip=3.0 if i < 2 else 1.2)      # the third terrace's ring is the walk to the first flight
        C.skirt(rad + 0.8, rad - 0.6, base, top)
        base = top
    for (y0, y1, r0, r1, zf) in BANDS:
        C.disc_cols(r0, y0, y1 - y0, zmax=zf, strip=1.2)
        C.skirt(r0 + 0.5, r1, y0, y1, zmax=zf)
    for (x, z, w, d, h, y) in rocks:
        C.col(x, z, w, d, h, y, 1.5)
    # the top's lip, cut at the last flight's face like the band under it: a
    # full disc roofed the flight's upper steps 0.4 under the top, and a
    # climber's head hit it six steps short (only the crag ring is drawn
    # there); a landing off the flight's top instead
    lx, lz = FLIGHTS[2][0], FLIGHTS[2][1]
    C.disc_cols(LIP_R, TOP - 0.4, 0.4, zmax=BANDS[2][4], strip=1.2)
    C.col(lx + 0.45, lz + 0.05, 0.9, STAIR_W + 0.1, 0.4, TOP - 0.4)
    for (sx, sz, w, d, h, y0) in steps:
        C.col(sx, sz, w, d, h, y0, 0.9)
    # on top: the hut, the flagpole, the bell; the telescope on the west balcony
    win = hut(C)
    flagpole(C, -5.0, 1.6, TOP)
    bell(C, 3.8, -3.2, TOP)
    telescope(C, -7.0, 3.2, 24.0, 2.6)
    # cairns with bunting on the first and second terraces, crates, ropes, pines
    cairns = [(-14.0, 4.62, 12.0), (-4.0, 4.62, 17.5), (8.0, 4.62, 16.0), (16.5, 4.62, 8.0), (-9.0, 8.58, 8.5), (3.0, 8.58, 11.0), (11.0, 8.58, 3.0)]
    for k, (x, y, z) in enumerate(cairns):
        cairn(C, f"cairn{k}", x, z, y)
    for (i, j) in ((0, 1), (1, 2), (2, 3), (4, 5), (5, 6)):
        a, c = cairns[i], cairns[j]
        bunting(C, (a[0], a[1] + 1.3, a[2]), (c[0], c[1] + 1.3, c[2]))
    crates = [(-25.0, 0.0, -6.0, 0.3), (-23.6, 0.0, -4.4, -0.2), (12.0, 4.62, -12.0, 0.1), (-10.0, 8.58, -6.0, 0.4), (5.0, 12.21, -5.8, 0.2), (-3.0, 4.62, -18.0, 0.0)]
    for k, (x, y, z, ry) in enumerate(crates):
        crate(C, f"crate{k}", x, z, y, 0.9, ry)
    crate(C, "crate-top", -25.0, -6.0, 0.9, 0.7, 0.5)
    rope(C, -6.0, 12.21, -6.5, -7.5, 8.58, -12.5)
    rope(C, 9.0, 8.58, -12.0, 10.5, 4.62, -17.5)
    for k, a in enumerate((0.3, 1.1, 2.0, 2.9, 3.6, 4.4, 5.3, 6.0)):
        r = TIERS[0][0] + 3.6 + (k % 2) * 1.6
        pine(C, f"pine{k}", r * math.cos(a), r * math.sin(a), h=4.4 + (k % 3) * 0.8)
    b.finish("tf-peak-p1.glb")
    return win
