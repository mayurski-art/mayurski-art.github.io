"""
The Portal (build_trollface_island.blender.py, phase 2): trollface.io's
terracotta gateway on its sandy rock, rebuilt as a stone arch with the
trollface carved over the door and a lab bunker inside the rock, in its own
frame (the rock's centre at 0, 0; x east, z south; the map lays it at
LANDMARKS.portal).

  the mesa: a sandy rock block 26 x 20, 3 m high (it was 2.31), one flight
  up its south face and one up its west face
  the bunker inside it, floor at the ground: the blast door in the west face
  (its leaf swung open against the rock, KEEP OUT by it), a corridor, the
  control room (three standing consoles, the planning table, the whiteboard,
  cable trays under the ceiling) and through the partition the store (two
  cots, drums, the shelf, crates stencilled TOP KEK)
  on top: the dais (4.5 m) and the gate on it, two piers and a round arch
  over the 6 x 7.2 m door, copper coils up the jambs, the trollface carved
  in the arch's tympanum (tf-portalface, the real artwork cut in terracotta)
  the generator by the dais with its drums and the cable to the coils, two
  flood lights on stands, crates, the four rocks, stones floating beside the
  piers (never in front of the door)

The green door itself stays a canvas the map draws (TF_BUILT.portal.door:
its centre, width, height); it is the face the obstruction test guards.
"""
import math
import random

from map_kit import mat
from tf_city import quad

MESA = (-13.0, 13.0, -10.0, 10.0, 3.0)          # x0, x1, z0, z1, top
CEIL = 2.85                                     # the bunker's ceiling (the slab is CEIL..top)
CORRIDOR = (-13.0, -9.0, 1.0, 3.4)              # x0, x1, z0, z1
ROOM_A = (-9.0, 0.8, -3.0, 7.0)
WALL_AB = (0.8, 1.2, 1.0, 3.0)                  # the partition's x0, x1 and its door's z0, z1
ROOM_B = (1.2, 10.0, -3.0, 7.0)
DAIS = (-5.0, 9.0, -9.0, -2.5, 4.5)             # x0, x1, z0, z1, top
DOOR = (2.0, -6.0, 6.0, 7.2)                    # centre x, z, width, height (bottom on the dais)
PIERS = ((-2.6, -1.0), (5.0, 6.6))              # x0, x1 of each
GATE_D = (-7.2, -4.8)                           # the gate's depth, z0..z1
ARCH_R = (3.0, 4.0)                             # inner, outer radius
RISE, RUN = 0.3, 0.5

LOOT = []
SIGNS = []


def palette():
    return {
        "sandrock": mat("TF_SandRock", 0xe0c48e, 0.95),
        "sandrock_dk": mat("TF_SandRockDark", 0xc29f66, 0.95),
        "sand": mat("TF_Sand", 0xf0dcb0, 0.95),
        "terra": mat("TF_Terracotta", 0xb4673e, 0.85),
        "terra_dk": mat("TF_TerracottaDark", 0x8a4a2a, 0.85),
        "terra_lt": mat("TF_TerracottaLight", 0xc98a5e, 0.85),
        "rune": mat("TF_Rune", 0x9dff6a, 0.3, 0.0, 0x7dff4a, 2.0),
        "copper": mat("TF_Copper", 0xc87a3e, 0.35, 0.8),
        "coil_glow": mat("TF_CoilGlow", 0x9dff6a, 0.3, 0.0, 0x6dff3a, 1.6),
        "conc": mat("GS_Concrete", 0xffffff, 0.8),
        "conc_dk": mat("TF_BunkerConcrete", 0x8a8d8f, 0.8),
        "floor": mat("TF_BunkerFloor", 0x5d6266, 0.7),
        "wall": mat("TF_BunkerWall", 0xb8bcb4, 0.8),
        "hazard_y": mat("TF_HazardYellow", 0xf2c21a, 0.6),
        "ink": mat("TF_Ink", 0x111114, 0.7),
        "steel": mat("TF_Steel", 0x6b7078, 0.5, 0.5),
        "steel_dk": mat("TF_SteelDark", 0x3c4046, 0.5, 0.5),
        "pole": mat("TF_Pole", 0x2f3338, 0.5, 0.3),
        "lamp": mat("TF_Lamp", 0xfff6dc, 0.2, 0.0, 0xfff1d0, 1.2),
        "strip": mat("TF_CeilingStrip", 0xeaf6ff, 0.2, 0.0, 0xdff0ff, 1.4),
        "screen_g": mat("TF_ConsoleGreen", 0x7fffa0, 0.3, 0.0, 0x57ff70, 1.0),
        "screen_b": mat("TF_ConsoleBlue", 0x7fe0ff, 0.3, 0.0, 0x5fc8f0, 1.0),
        "console": mat("TF_Console", 0x4a5560, 0.5, 0.3),
        "button_r": mat("TF_ButtonRed", 0xff3a2a, 0.3, 0.0, 0xff2a1a, 1.5),
        "white": mat("TF_White", 0xf4f4f0, 0.6),
        "marker_r": mat("TF_MarkerRed", 0xd83a3a, 0.5),
        "marker_b": mat("TF_MarkerBlue", 0x2f63e0, 0.5),
        "wood": mat("TF_Counter", 0x9a7b55, 0.7),
        "crate": mat("TF_CrateOlive", 0x3b4a2f, 0.8),
        "crate_dk": mat("TF_CrateOliveDark", 0x2a3521, 0.8),
        "drum": mat("TF_DrumBlue", 0x2f5aa8, 0.5, 0.4),
        "drum_y": mat("TF_DrumYellow", 0xe0b020, 0.5, 0.4),
        "cot": mat("TF_CotCanvas", 0x6b7a4a, 0.8),
        "blanket": mat("TF_Blanket", 0x7b3a3a, 0.8),
        "gen": mat("TF_GenOrange", 0xe07a1a, 0.5, 0.3),
        "cable": mat("TF_Cable", 0x161616, 0.6),
        "board": mat("TF_SignBoard", 0x0c0d0e, 0.5),
        "map": mat("TF_MapPaper", 0xe8dcb0, 0.8),
    }


class Site:
    def __init__(self, b, P, R, origin):
        self.b, self.P, self.R = b, P, R
        self.ox, self.oz = origin
        self.rng = random.Random(5)
        LOOT.clear()
        SIGNS.clear()

    def col(self, x, z, w, d, h, y=0.0, pen=3):
        if w > 0.02 and d > 0.02 and h > 0.02:
            self.R.collider(self.ox + x, self.oz + z, w, d, h, y, pen)

    def col_box(self, x0, x1, z0, z1, h, y=0.0, pen=3):
        self.col((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h, y, pen)

    def face(self, fid, owner, c, n, w, h):
        self.R.face(fid, owner, (self.ox + c[0], c[1], self.oz + c[2]), (n[0], 0.0, n[1]), w, h)

    def begin(self, pid, on=None):
        # everything but the rock itself stands in it or on it
        if pid != "mesa":
            on = tuple(on) + ("mesa",) if isinstance(on, (tuple, list)) else ((on, "mesa") if on else "mesa")
        self.R.begin(self.b, pid, on)

    def end(self):
        self.R.end((self.ox, 0.0, self.oz))

    def loot(self, x, y, z):
        LOOT.append({"x": round(self.ox + x, 2), "z": round(self.oz + z, 2), "y": round(y, 2)})

    def sign(self, text, x, y, z, nx, nz, w, h, colour):
        SIGNS.append([text, round(self.ox + x, 2), round(y, 2), round(self.oz + z, 2), nx, nz, w, h, colour])


def stairs(C, m, x, z, dx, dz, from_y, to_y, w):
    b = C.b
    n = math.ceil((to_y - from_y) / RISE - 1e-6)
    for i in range(n):
        h = to_y - from_y - i * ((to_y - from_y) / n)
        along = (i + 0.5) * RUN
        sx = RUN if dx else w
        sz = RUN if dz else w
        b.box(m, sx, h, sz, x + dx * along, from_y, z + dz * along, bevel=0.02)
        C.col(x + dx * along, z + dz * along, sx, sz, h, from_y, 3)


def rock_face(b, rng, m, ax, az, bx, bz, nx, nz, y0, y1, lean=0.35, jit=0.22, step=1.5, rings=3):
    """One side of a rock block, A to B, its top edge on y1 exactly, leaning
    out along n to the foot (crag_box's maths for one side, open at the ends
    so a door can cut it)."""
    L = math.hypot(bx - ax, bz - az)
    n = max(2, round(L / step))
    pts, cols = [], []
    for i in range(n + 1):
        t = i / n
        px, pz = ax + (bx - ax) * t, az + (bz - az) * t
        end = i in (0, n)
        col = []
        for k in range(rings + 1):
            s = k / rings
            y = y0 + (y1 - y0) * s
            off = lean * (1 - s)
            if 0 < k < rings and not end:
                off += rng.uniform(-jit, jit)
                y += rng.uniform(-0.2, 0.2) * (y1 - y0) / rings
            elif k == rings:
                off = -0.02
            col.append(len(pts))
            pts.append((px + nx * off, y, pz + nz * off))
        cols.append(col)
    faces = []
    for i in range(n):
        for k in range(rings):
            faces.append([cols[i][k], cols[i + 1][k], cols[i + 1][k + 1], cols[i][k + 1]])
    return b.poly(m, pts, faces)


# ------------------------------------------------------------- the rock and the bunker shell

def mesa(C):
    b, P, rng = C.b, C.P, C.rng
    x0, x1, z0, z1, top = MESA
    cx0, cx1, cz0, cz1 = CORRIDOR
    C.begin("mesa")
    rock_face(b, rng, P["sandrock_dk"], x0, z0, x1, z0, 0, -1, -0.3, top)
    rock_face(b, rng, P["sandrock_dk"], x1, z0, x1, z1, 1, 0, -0.3, top)
    rock_face(b, rng, P["sandrock_dk"], x1, z1, x0, z1, 0, 1, -0.3, top)
    # the west face, cut for the blast door's frame
    rock_face(b, rng, P["sandrock_dk"], x0, z1, x0, cz1 + 0.6, -1, 0, -0.3, top)
    rock_face(b, rng, P["sandrock_dk"], x0, cz0 - 0.6, x0, z0, -1, 0, -0.3, top)
    b.box(P["sandrock_dk"], 0.7, top - 2.6, cz1 - cz0 + 1.2, x0 - 0.05, 2.6, (cz0 + cz1) / 2)     # rock over the frame
    for (cx, cz) in ((x0, z0), (x1, z0), (x1, z1), (x0, z1)):                                 # the corners, boulders
        b.lump(P["sandrock_dk"], 1.6, top + 0.1, 1.6, cx, -0.3, cz, seed=int(cx * 7 + cz * 3) & 255, rnd=0.5, jitter=0.12)
    b.box(P["sand"], x1 - x0 - 0.1, 0.04, z1 - z0 - 0.1, (x0 + x1) / 2, top - 0.03, (z0 + z1) / 2)
    for k in range(8):                                                          # drifts on the top
        b.lump(P["sand"], rng.uniform(1.5, 3.0), 0.18, rng.uniform(1.0, 2.0), rng.uniform(-11, 11), top - 0.05,
               rng.uniform(1.0, 9.0), seed=300 + k, rnd=0.3, jitter=0.15)
    # the bunker's inside: floor, walls, ceiling, the partition
    ax0, ax1, az0, az1 = ROOM_A
    bx0, bx1, bz0, bz1 = ROOM_B
    b.box(P["floor"], bx1 - cx0, 0.03, az1 - az0, (cx0 + bx1) / 2, 0.0, (az0 + az1) / 2)
    b.box(P["conc_dk"], bx1 - cx0, 0.1, az1 - az0, (cx0 + bx1) / 2, CEIL, (az0 + az1) / 2)
    for (wx0, wx1, wz0, wz1) in ((ax0, bx1, az0 - 0.02, az0), (ax0, bx1, az1, az1 + 0.02), (bx1, bx1 + 0.02, az0, az1),
                                 (ax0 - 0.02, ax0, az0, cz0), (ax0 - 0.02, ax0, cz1, az1),
                                 (cx0, ax0, cz0 - 0.02, cz0), (cx0, ax0, cz1, cz1 + 0.02)):
        b.box(P["wall"], wx1 - wx0, CEIL, wz1 - wz0, (wx0 + wx1) / 2, 0, (wz0 + wz1) / 2)
    px0, px1, pd0, pd1 = WALL_AB
    for (a, c) in ((az0, pd0), (pd1, az1)):
        b.box(P["wall"], px1 - px0, CEIL, c - a, (px0 + px1) / 2, 0, (a + c) / 2)
    b.box(P["wall"], px1 - px0, CEIL - 2.2, pd1 - pd0, (px0 + px1) / 2, 2.2, (pd0 + pd1) / 2)
    b.box(P["hazard_y"], 0.03, 0.2, pd1 - pd0, px0 - 0.015, 2.0, (pd0 + pd1) / 2)
    # a dado line and the strip lights
    for (wx0, wx1, wz) in ((ax0, px0, az0 + 0.01), (px1, bx1, az0 + 0.01), (ax0, px0, az1 - 0.01), (px1, bx1, az1 - 0.01)):
        b.box(P["conc_dk"], wx1 - wx0, 0.9, 0.02, (wx0 + wx1) / 2, 0, wz)
    for (lx, lz) in ((-6.0, 0.5), (-2.0, 4.5), (-6.0, 4.5), (-2.0, 0.5), (4.0, 2.0), (8.0, 2.0), (-11.0, 2.2)):
        b.box(P["strip"], 1.4 if lx > -10 else 0.3, 0.05, 0.2, lx, CEIL - 0.05, lz)
    C.end()
    # colliders: the rock round the rooms, the partition, the slab
    C.col_box(x0, x1, z0, az0, top)                                           # north of the rooms
    C.col_box(x0, x1, az1, z1, top)                                           # south of them
    C.col_box(x0, ax0, az0, cz0, top)                                         # west, either side of the corridor
    C.col_box(x0, ax0, cz1, az1, top)
    C.col_box(bx1, x1, az0, az1, top)                                         # east
    for (a, c) in ((az0, pd0), (pd1, az1)):
        C.col_box(px0, px1, a, c, CEIL)
    C.col_box(px0, px1, pd0, pd1, CEIL - 2.2, 2.2)
    C.col_box(x0, bx1, az0, az1, top - CEIL, CEIL)


def blast_door(C):
    """The frame proud of the rock, hazard stripes on its lintel, the leaf
    swung open south against the rock face, its wheel."""
    b, P = C.b, C.P
    x0 = MESA[0]
    cz0, cz1 = CORRIDOR[2], CORRIDOR[3]
    H = 2.6
    C.begin("blast-door")
    for (a, c) in ((cz0 - 0.6, cz0), (cz1, cz1 + 0.6)):
        b.box(P["conc_dk"], 1.1, MESA[4], c - a, x0 - 0.15, 0, (a + c) / 2, bevel=0.03)
    b.box(P["conc_dk"], 1.1, MESA[4] - H, cz1 - cz0, x0 - 0.15, H, (cz0 + cz1) / 2)
    for k in range(7):                                                         # the stripes
        z = cz0 - 0.5 + k * (cz1 - cz0 + 1.0) / 7
        b.box(P["hazard_y"] if k % 2 == 0 else P["ink"], 0.02, 0.3, (cz1 - cz0 + 1.0) / 7, x0 - 0.71, H + 0.05, z + (cz1 - cz0 + 1.0) / 14)
    # the leaf: hinged at the south jamb's outer corner, swung flat against the rock
    lz0 = cz1 + 0.6
    b.box(P["steel_dk"], 0.35, H, cz1 - cz0 + 0.2, x0 - 1.05, 0, lz0 + (cz1 - cz0 + 0.2) / 2, bevel=0.04)
    wz = lz0 + (cz1 - cz0 + 0.2) / 2
    b.cyl(P["steel"], 0.55, (x0 - 1.23, 1.3, wz), (x0 - 1.29, 1.3, wz), seg=16, caps=False)
    for a in (0.0, math.pi / 2):
        b.bar(P["steel"], (x0 - 1.26, 1.3 + 0.55 * math.sin(a), wz + 0.55 * math.cos(a)), (x0 - 1.26, 1.3 - 0.55 * math.sin(a), wz - 0.55 * math.cos(a)), 0.06)
    C.end()
    for (a, c) in ((cz0 - 0.6, cz0), (cz1, cz1 + 0.6)):
        C.col(x0 - 0.15, (a + c) / 2, 1.1, c - a, MESA[4], 0, 3)
    C.col(x0 - 1.05, wz, 0.35, cz1 - cz0 + 0.2, H, 0, 3)
    C.col(x0 - 0.15, (cz0 + cz1) / 2, 1.1, cz1 - cz0, MESA[4] - H, H, 3)
    C.face("door:bunker", "blast-door", (x0 - 0.7, H / 2, (cz0 + cz1) / 2), (-1, 0), cz1 - cz0, H)


def keep_out(C):
    """KEEP OUT on two posts south of the door, facing west."""
    b, P = C.b, C.P
    x, z = MESA[0] - 1.4, 8.4
    C.begin("keep-out")
    for sz in (-0.75, 0.75):
        b.box(P["steel"], 0.1, 2.2, 0.1, x + 0.06, 0, z + sz)
    b.box(P["hazard_y"], 0.06, 0.8, 1.9, x, 1.3, z)
    C.end()
    C.col(x + 0.03, z, 0.16, 1.9, 2.2, 0, 1)
    C.sign("KEEP OUT", x - 0.035, 1.7, z, -1, 0, 1.7, 0.6, 0xf2c21a)
    C.face("keep-out", "keep-out", (x - 0.035, 1.7, z), (-1, 0), 1.7, 0.6)


# ------------------------------------------------------------- inside

def console(C, k, x, z):
    """A standing console against the north wall: a sloped desk, two screens
    on a riser facing south, buttons."""
    b, P = C.b, C.P
    C.begin(f"console{k}")
    b.box(P["console"], 2.0, 0.95, 0.8, x, 0, z + 0.4, bevel=0.02)
    b.box(P["console"], 2.0, 0.08, 0.6, x, 0.95, z + 0.45, rx=-0.25)
    b.box(P["steel_dk"], 2.0, 0.95, 0.25, x, 0.95, z + 0.125)
    for (sx, m) in ((-0.48, "screen_g"), (0.48, "screen_b")):
        b.box(P[m], 0.82, 0.55, 0.02, x + sx, 1.25, z + 0.26)
    for j in range(5):
        b.box(P["button_r" if j == 2 else "steel"], 0.1, 0.05, 0.1, x - 0.6 + j * 0.3, 1.0, z + 0.62)
    C.end()
    C.col(x, z + 0.4, 2.0, 0.8, 1.9, 0, 1)
    C.face(f"console{k}-screens", f"console{k}", (x, 1.525, z + 0.27), (0, 1), 1.8, 0.55)


def cable_trays(C):
    b, P = C.b, C.P
    ax0 = ROOM_A[0]
    bx1 = ROOM_B[1]
    C.begin("cable-trays")
    for z in (-2.4, 6.4):
        b.box(P["steel"], bx1 - ax0 - 0.4, 0.04, 0.4, (ax0 + bx1) / 2, CEIL - 0.42, z)
        for y in (CEIL - 0.38,):
            for k in range(3):
                b.cyl(P["cable"], 0.04, (ax0 + 0.3, y + 0.04, z - 0.12 + k * 0.12), (bx1 - 0.3, y + 0.04, z - 0.12 + k * 0.12), seg=6)
        for k in range(6):
            rx = ax0 + 0.5 + k * (bx1 - ax0 - 1.0) / 5
            b.cyl(P["steel"], 0.015, (rx, CEIL - 0.42, z), (rx, CEIL, z), seg=4)
    C.end()


def planning_table(C, x, z):
    b, P = C.b, C.P
    C.begin("plan-table")
    b.box(P["wood"], 2.4, 0.06, 1.2, x, 0.86, z)
    for sx in (-1.1, 1.1):
        for sz in (-0.5, 0.5):
            b.box(P["steel"], 0.06, 0.86, 0.06, x + sx, 0, z + sz)
    b.box(P["map"], 1.4, 0.01, 0.9, x - 0.3, 0.92, z, ry=0.08)
    b.box(P["ink"], 0.4, 0.02, 0.28, x + 0.75, 0.92, z - 0.1)                     # the laptop
    b.box(P["screen_g"], 0.4, 0.26, 0.02, x + 0.75, 0.94, z - 0.25, rx=-0.25)
    C.end()
    C.col(x, z, 2.4, 1.2, 0.92, 0, 1)
    C.loot(x, 0.92, z)


def whiteboard(C, x, z):
    """On the control room's south wall, facing north, with the plan drawn on:
    a ring, an arrow to it, the grin."""
    b, P = C.b, C.P
    C.begin("whiteboard")
    b.box(P["steel"], 3.0, 1.5, 0.05, x, 0.9, z - 0.025)
    b.box(P["white"], 2.8, 1.3, 0.02, x, 1.0, z - 0.06)
    for k in range(10):                                                        # the ring
        a0, a1 = 2 * math.pi * k / 10, 2 * math.pi * (k + 1) / 10
        b.bar(P["marker_b"], (x - 0.6 + 0.4 * math.cos(a0), 1.65 + 0.4 * math.sin(a0), z - 0.075),
              (x - 0.6 + 0.4 * math.cos(a1), 1.65 + 0.4 * math.sin(a1), z - 0.075), 0.03, 0.03)
    b.bar(P["marker_r"], (x + 0.9, 1.4, z - 0.075), (x - 0.1, 1.65, z - 0.075), 0.03, 0.03)
    b.bar(P["marker_r"], (x - 0.1, 1.65, z - 0.075), (x + 0.05, 1.55, z - 0.075), 0.03, 0.03)
    b.bar(P["marker_r"], (x - 0.1, 1.65, z - 0.075), (x + 0.07, 1.72, z - 0.075), 0.03, 0.03)
    for k in range(6):                                                         # the grin under it
        a0, a1 = math.pi * (1.1 + 0.8 * k / 6), math.pi * (1.1 + 0.8 * (k + 1) / 6)
        b.bar(P["ink"], (x + 0.7 + 0.45 * math.cos(a0), 1.45 + 0.25 * math.sin(a0) * -1, z - 0.075),
              (x + 0.7 + 0.45 * math.cos(a1), 1.45 + 0.25 * math.sin(a1) * -1, z - 0.075), 0.03, 0.03)
    C.end()
    C.face("whiteboard", "whiteboard", (x, 1.65, z - 0.075), (0, -1), 2.8, 1.3)


def cot(C, k, x, z):
    b, P = C.b, C.P
    C.begin(f"cot{k}")
    b.box(P["cot"], 0.8, 0.06, 2.0, x, 0.42, z)
    for sx in (-0.36, 0.36):
        b.bar(P["steel"], (x + sx, 0, z - 0.95), (x - sx, 0.42, z + 0.95), 0.03)
    b.box(P["blanket"], 0.78, 0.06, 1.2, x, 0.48, z + 0.35)
    b.box(P["white"], 0.6, 0.1, 0.35, x, 0.48, z - 0.75)
    C.end()
    C.col(x, z, 0.8, 2.0, 0.54, 0, 1)


def drum(C, pid, x, z, m="drum", y=0.0, on=None):
    b, P = C.b, C.P
    C.begin(pid, on)
    b.cyl(P[m], 0.3, (x, y, z), (x, y + 0.88, z), seg=14)
    for ry in (0.2, 0.68):
        b.cyl(P["steel_dk"], 0.31, (x, y + ry, z), (x, y + ry + 0.04, z), seg=14, caps=False)
    C.end()
    C.col(x, z, 0.6, 0.6, 0.88, y, 1)


def crate_stack(C, pid, x, z, y, n, face_n, sign=True):
    """Olive crates in a stack, the top one's face stencilled TOP KEK."""
    b, P = C.b, C.P
    s = 1.1
    C.begin(pid)
    for k in range(n):
        dx = 0.08 * (k % 2)
        b.box(P["crate"], s, s * 0.8, s, x + dx, y + k * s * 0.8, z, bevel=0.03)
        for o in (-0.5, 0.5):
            b.box(P["crate_dk"], s * 1.01, 0.08, 0.08, x + dx, y + k * s * 0.8 + 0.4 + o * 0.5, z + face_n[1] * (s / 2))
    C.end()
    C.col(x + 0.04, z, s + 0.1, s, n * s * 0.8, y, 1)
    if sign:
        fy = y + (n - 0.5) * s * 0.8
        fx, fz = x + face_n[0] * (s / 2 + 0.005), z + face_n[1] * (s / 2 + 0.005)
        if face_n[0]:
            fx += 0.08 * ((n - 1) % 2)
        C.sign("TOP KEK", fx, fy, fz, face_n[0], face_n[1], 0.95, 0.42, 0xe8e2c8)


def shelf(C, x, z):
    b, P = C.b, C.P
    C.begin("supply-shelf")
    for sx in (-1.2, 1.2):
        b.box(P["steel"], 0.05, 2.0, 0.5, x + sx, 0, z)
    for y in (0.3, 0.95, 1.6):
        b.box(P["steel"], 2.45, 0.04, 0.5, x, y, z)
    rng = random.Random(77)
    for y in (0.34, 0.99, 1.64):
        px = x - 1.05
        while px < x + 1.0:
            w = rng.uniform(0.25, 0.5)
            b.box(P[rng.choice(("crate", "drum_y", "white", "drum"))], w, rng.uniform(0.2, 0.45), 0.4, px + w / 2, y, z)
            px += w + 0.06
    C.end()
    C.col(x, z, 2.5, 0.5, 2.0, 0, 1)


# ------------------------------------------------------------- on top

def dais(C):
    b, P, rng = C.b, C.P, C.rng
    x0, x1, z0, z1, top = DAIS
    base = MESA[4]
    C.begin("dais")
    rock_face(b, rng, P["terra_dk"], x0, z0, x1, z0, 0, -1, base - 0.1, top, lean=0.2, step=1.2, rings=2)
    rock_face(b, rng, P["terra_dk"], x1, z0, x1, z1, 1, 0, base - 0.1, top, lean=0.2, step=1.2, rings=2)
    rock_face(b, rng, P["terra_dk"], x1, z1, x0, z1, 0, 1, base - 0.1, top, lean=0.2, step=1.2, rings=2)
    rock_face(b, rng, P["terra_dk"], x0, z1, x0, z0, -1, 0, base - 0.1, top, lean=0.2, step=1.2, rings=2)
    b.box(P["terra"], x1 - x0 - 0.06, 0.04, z1 - z0 - 0.06, (x0 + x1) / 2, top - 0.035, (z0 + z1) / 2)
    C.end()
    C.col_box(x0, x1, z0, z1, top - base, base)
    stairs(C, P["terra_lt"], DOOR[0], z1, 0, 1, base, top, 4.0)


def gate(C):
    """Two piers and a round arch over the door, the tympanum (where the
    carved face sits), copper coils up the jambs' faces, runes."""
    b, P = C.b, C.P
    dx, dz, dw, dh = DOOR
    y0 = DAIS[4]
    gz0, gz1 = GATE_D
    depth = gz1 - gz0
    ri, ro = ARCH_R
    spring = y0 + dh
    C.begin("gate")
    for (px0, px1) in PIERS:
        pc = (px0 + px1) / 2
        b.box(P["terra"], px1 - px0, dh + 0.4, depth, pc, y0, dz, bevel=0.1)
        b.box(P["terra_dk"], px1 - px0 + 0.3, 0.6, depth + 0.3, pc, y0, dz, bevel=0.06)          # the plinth
        b.box(P["terra_lt"], px1 - px0 + 0.2, 0.3, depth + 0.2, pc, spring - 0.3, dz, bevel=0.05)  # the impost
        for y in (y0 + 2.0, y0 + 3.6, y0 + 5.2):                                                     # chisel marks
            b.box(P["ink"], 0.7, 0.05, 0.03, pc, y, gz1 + 0.11)
    # the arch: voussoirs round the half circle, its haunches filled square
    seg = 11
    for i in range(seg):
        a0, a1 = math.pi * i / seg, math.pi * (i + 1) / seg
        pts = [(dx + ri * math.cos(a0), spring + ri * math.sin(a0)), (dx + ro * math.cos(a0), spring + ro * math.sin(a0)),
               (dx + ro * math.cos(a1), spring + ro * math.sin(a1)), (dx + ri * math.cos(a1), spring + ri * math.sin(a1))]
        b.prism(P["terra_lt"] if i == seg // 2 else P["terra"], pts, gz0, gz1)
    for s in (-1, 1):                                                          # the haunches up to the crown's level
        hx0 = dx + s * ro
        hx1 = PIERS[1][1] if s > 0 else PIERS[0][0]
        prof = [(hx0, spring), (hx1, spring), (hx1, spring + ro), (dx + s * ro * math.cos(0.45), spring + ro * math.sin(0.45))]
        if s < 0:
            prof = prof[::-1]
        b.prism(P["terra"], prof, gz0, gz1)
    b.box(P["terra_dk"], PIERS[1][1] - PIERS[0][0] + 0.6, 0.5, depth + 0.4, dx, spring + ro, dz, bevel=0.08)   # the cornice
    # the tympanum: a half disc filling the arch, set back to the gate's middle
    tz0, tz1 = dz - 0.3, dz + 0.3
    pts = [(dx + ri * math.cos(math.pi * k / 16), spring + ri * math.sin(math.pi * k / 16)) for k in range(17)]
    b.prism(P["terra_dk"], pts, tz0, tz1)
    # coils: copper rings stacked up both jambs, on the front and the back
    for jx in (PIERS[0][1] - 0.3, PIERS[1][0] + 0.3):
        for fz, nz in ((gz1, 1), (gz0, -1)):
            for k in range(9):
                y = y0 + 0.8 + k * 0.72
                b.cyl(P["copper"], 0.26, (jx, y, fz), (jx, y, fz + nz * 0.14), seg=12)
                b.cyl(P["coil_glow"], 0.12, (jx, y, fz + nz * 0.14), (jx, y, fz + nz * 0.17), seg=8)
    for k in range(5):                                                         # runes on the arch's face
        a = math.pi * (0.15 + 0.7 * k / 4)
        rx, ry = dx + (ri + ro) / 2 * math.cos(a), spring + (ri + ro) / 2 * math.sin(a)
        b.box(P["rune"], 0.35, 0.35, 0.03, rx, ry - 0.17, gz1 + 0.01, rz=0.785)
    C.end()
    for (px0, px1) in PIERS:
        C.col_box(px0, px1, gz0, gz1, dh + ro + 0.5, y0)
    C.col_box(PIERS[0][1], PIERS[1][0], gz0, gz1, ro + 0.5, spring)
    C.face("door:portal", "gate", (dx, y0 + dh / 2, dz + 0.02), (0, 1), dw, dh)


def generator(C, x, z):
    """The genset by the dais, its drums, and the cable over the dais to the
    gate's coils."""
    b, P = C.b, C.P
    y = MESA[4]
    C.begin("generator")
    b.box(P["steel_dk"], 2.4, 0.15, 1.3, x, y, z)
    b.box(P["gen"], 2.2, 1.2, 1.1, x, y + 0.15, z, bevel=0.05)
    for k in range(6):
        b.box(P["ink"], 0.04, 0.8, 0.9, x - 0.95 + k * 0.08, y + 0.35, z)
    b.box(P["steel"], 0.6, 0.4, 0.6, x + 0.6, y + 1.35, z)
    b.cyl(P["steel_dk"], 0.08, (x + 0.6, y + 1.75, z), (x + 0.6, y + 2.4, z), seg=8)
    b.box(P["button_r"], 0.1, 0.1, 0.02, x - 0.6, y + 1.0, z + 0.56)
    C.end()
    C.col(x, z, 2.4, 1.3, 1.75, y, 1)
    # the cable: from the genset up the dais's side and along its top to the east pier
    cy = DAIS[4] + 0.04
    pts = [(x - 1.1, y + 0.3, z), (DAIS[1] + 0.3, y + 0.05, z), (DAIS[1] + 0.25, cy, z), (PIERS[1][1] + 0.2, cy, GATE_D[1] + 0.3),
           (PIERS[1][1] + 0.05, cy + 1.0, GATE_D[1] + 0.1)]
    C.begin("gen-cable", on=("dais", "generator", "gate"))
    for a, c in zip(pts, pts[1:]):
        b.cyl(P["cable"], 0.06, a, c, seg=6)
    C.end()


def flood(C, k, x, z, aim):
    """A flood light on a tripod, aimed at the gate."""
    b, P = C.b, C.P
    y = MESA[4]
    C.begin(f"flood{k}")
    for j in range(3):
        a = aim + math.pi + (j - 1) * 2.1
        b.cyl(P["steel"], 0.03, (x + 0.6 * math.sin(a), y, z + 0.6 * math.cos(a)), (x, y + 1.8, z), seg=5)
    b.cyl(P["steel"], 0.04, (x, y + 1.6, z), (x, y + 2.3, z), seg=6)
    hx, hz = x + 0.15 * math.sin(aim), z + 0.15 * math.cos(aim)
    b.box(P["steel_dk"], 0.7, 0.5, 0.3, hx, y + 2.2, hz, ry=aim, rx=-0.3)
    b.box(P["lamp"], 0.6, 0.4, 0.02, hx + 0.16 * math.sin(aim), y + 2.27, hz + 0.16 * math.cos(aim), ry=aim, rx=-0.3)
    C.end()
    C.col(x, z, 0.5, 0.5, 2.5, y, 1)


def rocks(C):
    b, P, rng = C.b, C.P, C.rng
    y = MESA[4]
    for k, (dx, dz, s) in enumerate(((-10.3, -7.6, 2.0), (10.0, 7.2, 1.8), (11.4, -8.9, 1.4), (-8.0, 7.6, 1.5))):
        C.begin(f"rock{k}")
        b.lump(P["terra"], s * 1.75, s * 1.35, s * 1.75, dx, y - 0.15, dz, seed=40 + k, rnd=0.55, jitter=0.16, ry=rng.uniform(0, 3))
        b.lump(P["terra_dk"], s * 0.9, s * 0.7, s * 0.9, dx + s * 0.55, y - 0.1, dz + s * 0.4, seed=50 + k, rnd=0.6, jitter=0.12)
        C.end()
        C.col(dx, dz, s * 1.6, s * 1.6, s * 1.2, y, 6)
    # stones hanging in the air beside the piers (never in front of the door)
    for k in range(12):
        side = -1 if k % 2 else 1
        x = rng.uniform(-5.4, -3.6) if side < 0 else rng.uniform(7.6, 9.4)
        yy = rng.uniform(6.0, 13.5)
        z = DOOR[1] + rng.uniform(-3.2, 3.2)
        s = rng.uniform(0.35, 0.8)
        b.lump(P["terra_lt"] if k % 3 else P["terra"], s, s * 0.8, s, x, yy, z, seed=60 + k, rnd=0.6, jitter=0.12, ry=rng.uniform(0, 3), flat_base=False)
    # rubble round the mesa's foot, clear of the flights, the door and the sign
    x0, x1, z0, z1, top = MESA
    for k in range(18):
        a = 2 * math.pi * k / 18 + rng.uniform(-0.08, 0.08)
        x, z = 15.0 * math.cos(a), 12.0 * math.sin(a)
        if (z > 9 and abs(x + 4) < 3.5) or (x < -12 and -5 < z < 11) or (x > 11 and z > 9):
            continue
        s = rng.uniform(0.8, 1.5)
        b.lump(P["sandrock_dk"], s * 1.3, s * 0.7, s, x, -0.1, z, seed=70 + k, rnd=0.6, ry=a)


# ------------------------------------------------------------- the build

def build(b, P, R, origin):
    C = Site(b, P, R, origin)
    mesa(C)
    x0, x1, z0, z1, top = MESA
    stairs(C, P["terra_lt"], -4.0, z1, 0, 1, 0, top, 3.0)                     # up the south face
    stairs(C, P["terra_lt"], x0, -1.5, -1, 0, 0, top, 3.0)                    # up the west face, north of the door
    blast_door(C)
    keep_out(C)
    # the control room
    for k, x in enumerate((-7.2, -4.0, -0.8)):
        console(C, k, x, ROOM_A[2])
    planning_table(C, -4.0, 2.2)
    whiteboard(C, -4.0, ROOM_A[3])
    cable_trays(C)
    # the store
    cot(C, 0, 9.3, -1.6)
    cot(C, 1, 9.3, 5.6)
    shelf(C, 4.4, ROOM_B[2] + 0.3)
    for k, (x, z, m) in enumerate(((8.6, 1.6, "drum"), (8.0, 2.5, "drum_y"), (8.9, 2.9, "drum"))):
        drum(C, f"bdrum{k}", x, z, m)
    crate_stack(C, "crates-store", 4.0, ROOM_B[3] - 0.6, 0.0, 2, (0, -1))
    crate_stack(C, "crates-store-b", 5.4, ROOM_B[3] - 0.6, 0.0, 1, (0, -1), sign=False)
    C.loot(5.6, 0.0, 2.0)
    # on top
    dais(C)
    gate(C)
    generator(C, 10.8, -6.0)
    drum(C, "gdrum0", 11.6, -3.6, "drum_y", MESA[4])
    drum(C, "gdrum1", 10.9, -3.3, "drum", MESA[4])
    flood(C, 0, -6.5, 0.5, math.atan2(DOOR[0] + 6.5, DOOR[1] - 0.5))
    flood(C, 1, 10.0, 0.8, math.atan2(DOOR[0] - 10.0, DOOR[1] - 0.8))
    crate_stack(C, "crates-top", -7.5, -3.8, MESA[4], 2, (0, 1))
    rocks(C)
    C.loot(-1.0, MESA[4], 5.0)
    C.loot(DOOR[0] - 3.0, DAIS[4], DAIS[3] - 1.2)
    b.finish("tf-portal-p2.glb")
    return {"door": [round(C.ox + DOOR[0], 2), round(DAIS[4] + DOOR[3] / 2, 2), round(C.oz + DOOR[1], 2), DOOR[2], DOOR[3]]}


def portal_face(GLB, P):
    """The trollface carved in the tympanum, facing the approach (south):
    Grinleria's trollhead (the real artwork's outline and ink cut in) in
    terracotta, its own GLB like the dome's face."""
    dx, dz = DOOR[0], DOOR[1]
    GLB.build_trollhead(P, width=2.7, res=90, front=0.4, back=0.0, carve=0.08, name="tf-portalface",
                        place=(dx, DAIS[4] + DOOR[3] + 0.25, dz + 0.3, 0.0, 0.0, 0.0),
                        colors=(0xc98a5e, 0xb4673e, 0x3a1e10), moss_on=False)
