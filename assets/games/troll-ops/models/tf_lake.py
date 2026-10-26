"""
The lake's five places (build_trollface_island.blender.py, phase 3), each in
its own frame as the map lays it (x east, z south), five GLBs:

  CAVE   (origin LANDMARKS.cave): the teal rock mound with the tunnel north
         to south through it, the back chamber east of the tunnel (the pool,
         the campfire ring, the sleeping bag, crates, bones, the pickaxes),
         cart rails down the tunnel with a cart, lanterns, stalactites, the
         chest alcove in the tunnel's west wall, the warning sign at the
         south mouth
  DOCK   (origin: the jetty's shore end): the plank jetty out into the lake
         and its east arm as before, the bait shop (walk in; the counter at
         its serving window on the water) and the boat shed on the shore,
         the fuel pump, the slipway, rowing boats tied up, crab pots, nets
         drying, the bench, buoys
  TREE   (origin LANDMARKS.tree): the old tree grown big, a plank stair
         round the trunk up to the treehouse on its south-east side (bunk,
         lantern, crate), the rope ladder off its far edge, the tyre swing
         on the long branch, the bird box, the picnic table
  BOAT   (origin LANDMARKS.boat): a sailing smack aground in the lake, the
         deck 2.7 m up: the stern steps, the wheelhouse (the wheel, the
         radio, a stool), the companionway down into the hold (fish boxes,
         barrels, nets, rope), the mast with the sail and its blue mark,
         the winch, buoys, floats, the life ring, the figurehead (the real
         trollface, tf-boatface)
  BRIDGE (origin: the deck's middle): the plank bridge over the river roofed
         over, 1 m walls you duck behind, lanterns under the roof, a toll
         booth at each end (stool, cash box) with a barrier arm raised, the
         TOLL signs on the gables, a bike at the west booth

Every solid thing registers a collider; doors, windows and signs register
faces (rule 9). A player wades below y 0.5 in the lake, so the boat's hold
floor is 0.55 and its deck slab leaves 2 m of headroom over it.
"""
import math
import random
from types import SimpleNamespace

from mathutils import Vector

from map_kit import mat
from tf_city import flat, quad
from tf_portal import rock_face
from tf_skate import stairs, RISE, RUN
import tf_kit

WATER_Y = 0.34
LOOT = []
SIGNS = []


def palette():
    return {
        "plank": mat("GS_Plank", 0xffffff, 0.8),
        "plank_dk": mat("TF_PlankDark", 0x6b4a2e, 0.8),
        "pile": mat("TF_Pile", 0x4a3828, 0.9),
        "rope": mat("TF_Rope", 0xc8b48a, 0.9),
        "crate": mat("TF_Crate", 0x8a6a3e, 0.8),
        "lantern": mat("TF_LanternLit", 0xffd27a, 0.3, 0.0, 0xffb84a, 1.6),
        "lamp": mat("TF_Lamp", 0xfff6dc, 0.2, 0.0, 0xfff1d0, 1.2),
        "coping": mat("TF_Coping", 0xc8ccd0, 0.3, 0.8),
        "steel": mat("TF_Steel", 0x6b7078, 0.5, 0.5),
        "steel_dk": mat("TF_SteelDark", 0x3c4046, 0.5, 0.5),
        "pole": mat("TF_Pole", 0x2f3338, 0.5, 0.3),
        "ink": mat("TF_Ink", 0x111114, 0.7),
        "white": mat("TF_White", 0xf4f4f0, 0.6),
        "stone": mat("GS_Concrete", 0xffffff, 0.8),
        "conc": mat("TF_SlipConcrete", 0xb8b6ae, 0.85),
        "sand": mat("TF_Sand", 0xf0dcb0, 0.95),
        "cave": mat("TF_CaveRock", 0x3f8f86, 0.95),
        "cave_dk": mat("TF_CaveRockDark", 0x2b6b64, 0.95),
        "cave_in": mat("TF_CaveInside", 0x24544f, 0.95),
        "crystal": mat("TF_Crystal", 0x9df0e8, 0.2, 0.0, 0x5fd8cc, 1.4),
        "pool": mat("TF_CavePool", 0x3fb7d8, 0.1, 0.0, 0x2a8fb0, 0.5),
        "ember": mat("TF_Ember", 0xff6a1a, 0.4, 0.0, 0xff4a0a, 2.2),
        "ash": mat("TF_Ash", 0x3a3a3a, 0.95),
        "bone": mat("TF_Bone", 0xe8e2cf, 0.7),
        "rail": mat("TF_RailIron", 0x4a4442, 0.5, 0.6),
        "cart": mat("TF_CartRust", 0x6b4a36, 0.7, 0.3),
        "ore": mat("TF_Ore", 0x5a5a62, 0.9),
        "bag": mat("TF_SleepingBag", 0x2f63a0, 0.8),
        "hazard_y": mat("TF_HazardYellow", 0xf2c21a, 0.6),
        "shed": mat("TF_ShedBoards", 0x7a8a9a, 0.8),
        "shed_dk": mat("TF_ShedBoardsDark", 0x55636f, 0.8),
        "roof_tin": mat("TF_TinRoof", 0x8a8f94, 0.5, 0.4),
        "board": mat("TF_SignBoard", 0x0c0d0e, 0.5),
        "wood": mat("TF_Counter", 0x9a7b55, 0.7),
        "net": mat("TF_Net", 0x3f7a4a, 0.9),
        "float_o": mat("TF_FloatOrange", 0xff7a1a, 0.5),
        "buoy_r": mat("TF_BuoyRed", 0xd83a3a, 0.5),
        "buoy_w": mat("TF_BuoyWhite", 0xf0f0ec, 0.5),
        "pot": mat("TF_CrabPot", 0x5a4a3a, 0.9),
        "pump": mat("TF_FuelPump", 0xd23b2f, 0.5, 0.2),
        "boat_r": mat("TF_RowboatRed", 0xc23a30, 0.6),
        "boat_b": mat("TF_RowboatBlue", 0x2f63a0, 0.6),
        "bark": mat("TF_Bark", 0x5a4030, 0.95),
        "leaf_a": mat("TF_LeafA", 0x3fbf62, 0.9),
        "leaf_b": mat("TF_LeafB", 0x2f9e44, 0.9),
        "leaf_lt": mat("TF_LeafLight", 0x7bd96a, 0.9),
        "tyre": mat("TF_Tyre", 0x1a1a1c, 0.9),
        "bed": mat("TF_Bed", 0xe8e4da, 0.8),
        "blanket": mat("TF_Blanket", 0x7b3a3a, 0.8),
        "hull": mat("TF_Hull", 0x9aa0a6, 0.55, 0.2),
        "hull_lo": mat("TF_HullLow", 0x5a2e2a, 0.7),
        "stripe": mat("TF_BootStripe", 0x1f2f55, 0.6),
        "deck": mat("TF_Teak", 0xb8905a, 0.7),
        "house": mat("TF_Wheelhouse", 0xf2f2ee, 0.6),
        "house_tr": mat("TF_WheelhouseTrim", 0x1f3f6b, 0.6),
        "cabin_win": mat("TF_CabinGlass", 0x9fd2f0, 0.1, 0.1),
        "mast": mat("TF_Mast", 0xd8c8a8, 0.6),
        "sail": mat("TF_Sail", 0xf6f4ec, 0.8),
        "sail_line": mat("TF_SailLine", 0x9a9690, 0.8),
        "logo": mat("TF_SailMark", 0x2a7fe0, 0.6),
        "fishbox": mat("TF_FishBox", 0xd8dde0, 0.6),
        "fish": mat("TF_Fish", 0x8fb0c0, 0.4, 0.3),
        "barrel": mat("TF_BarrelBlue", 0x2f5aa8, 0.5, 0.4),
        "barrel_y": mat("TF_BarrelYellow", 0xe0b020, 0.5, 0.4),
        "radio": mat("TF_Radio", 0x3a3a3e, 0.5, 0.3),
        "led": mat("TF_RadioLed", 0x57ff70, 0.3, 0.0, 0x57ff70, 2.0),
        "ring": mat("TF_LifeRing", 0xff7a1a, 0.6),
        "shingle": mat("TF_Shingle", 0x6b4a3a, 0.9),
        "booth": mat("TF_BoothRed", 0xb03a2a, 0.7),
        "booth_lt": mat("TF_BoothCream", 0xf2e8d0, 0.7),
        "cash": mat("TF_CashBox", 0x3a4a5a, 0.5, 0.4),
        "leather": mat("TF_Leather", 0x5a2e2a, 0.5),
        "bike": mat("TF_Bike", 0x2f8f4e, 0.5, 0.4),
        "water_o": mat("TF_Oar", 0xc8a870, 0.7),
    }


class Site:
    def __init__(self, b, P, R, origin, seed):
        self.b, self.P, self.R = b, P, R
        self.ox, self.oz = origin
        self.rng = random.Random(seed)
        self.container = None       # a prop everything else stands in or on
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
        c = self.container
        if c and pid != c:
            on = tuple(on) + (c,) if isinstance(on, (tuple, list)) else ((on, c) if on else c)
        self.R.begin(self.b, pid, on)

    def end(self):
        self.R.end((self.ox, 0.0, self.oz))

    def loot(self, x, y, z):
        LOOT.append({"x": round(self.ox + x, 2), "z": round(self.oz + z, 2), "y": round(y, 2)})

    def sign(self, text, x, y, z, nx, nz, w, h, colour):
        SIGNS.append([text, round(self.ox + x, 2), round(y, 2), round(self.oz + z, 2), nx, nz, w, h, colour])


def torus(b, m, c, R, r, u, v, seg=24, tseg=8):
    c, u, v = Vector(c), Vector(u).normalized(), Vector(v).normalized()
    n = u.cross(v)
    pts, faces = [], []
    for i in range(seg):
        th = 2 * math.pi * i / seg
        d = u * math.cos(th) + v * math.sin(th)
        for j in range(tseg):
            ph = 2 * math.pi * j / tseg
            pts.append(tuple(c + d * (R + r * math.cos(ph)) + n * (r * math.sin(ph))))
    for i in range(seg):
        ii = (i + 1) % seg
        for j in range(tseg):
            jj = (j + 1) % tseg
            faces.append([i * tseg + j, ii * tseg + j, ii * tseg + jj, i * tseg + jj])
    for f in b.poly(m, pts, faces):
        f.smooth = True


def sphere(b, m, c, r, seg=10, ring=6):
    cx, cy, cz = c
    pts, faces = [], []
    for i in range(ring + 1):
        e = math.pi * i / ring
        for j in range(seg):
            a = 2 * math.pi * j / seg
            pts.append((cx + r * math.sin(e) * math.cos(a), cy + r * math.cos(e), cz + r * math.sin(e) * math.sin(a)))
    for i in range(ring):
        for j in range(seg):
            k = (j + 1) % seg
            faces.append([i * seg + j, (i + 1) * seg + j, (i + 1) * seg + k, i * seg + k])
    for f in b.poly(m, pts, faces):
        f.smooth = True


def lantern_post(C, pid, x, z, y=0.0, h=1.7):
    b, P = C.b, C.P
    C.begin(pid)
    b.cyl(P["pole"], 0.05, (x, y, z), (x, y + h, z), seg=6)
    b.box(P["pole"], 0.5, 0.05, 0.06, x + 0.2, y + h - 0.05, z)
    b.box(P["lantern"], 0.22, 0.3, 0.22, x + 0.4, y + h - 0.4, z)
    b.box(P["ink"], 0.26, 0.04, 0.26, x + 0.4, y + h - 0.1, z)
    C.end()
    C.col(x, z, 0.14, 0.14, h, y, 1)


def crate(C, pid, x, z, y=0.0, s=1.0, ry=0.0, on=None):
    b, P = C.b, C.P
    C.begin(pid, on)
    b.box(P["crate"], s, s * 0.8, s, x, y, z, ry=ry, bevel=0.03)
    for o in (-0.3, 0.3):
        b.box(P["plank_dk"], s * 1.02, 0.06, 0.06, x, y + s * 0.4 + o * s, z + math.cos(ry) * s / 2, ry=ry)
    C.end()
    C.col(x, z, s * (abs(math.cos(ry)) + abs(math.sin(ry))), s * (abs(math.cos(ry)) + abs(math.sin(ry))), s * 0.8, y, 1)


def barrel(C, pid, x, z, y=0.0, m="barrel"):
    b, P = C.b, C.P
    C.begin(pid)
    b.cyl(P[m], 0.3, (x, y, z), (x, y + 0.88, z), seg=12)
    for ry in (0.2, 0.68):
        b.cyl(P["steel_dk"], 0.31, (x, y + ry, z), (x, y + ry + 0.04, z), seg=12, caps=False)
    C.end()
    C.col(x, z, 0.6, 0.6, 0.88, y, 1)


def box_shed(C, pid, x, z, w, d, H, doors, windows, m_wall, m_roof, t=0.18, roof_pitch=True):
    """Four walls with openings (doors: (side, at, width, height); windows:
    (side, at, width, y0, y1)), a pitched tin roof along x. Colliders for
    every wall piece; faces for the doors and windows."""
    b, P = C.b, C.P
    xw, xe, zn, zs = x - w / 2, x + w / 2, z - d / 2, z + d / 2
    C.begin(pid)
    pieces = []
    for side in ("n", "s", "w", "e"):
        horiz = side in ("n", "s")
        L = w if horiz else d
        c0 = xw if horiz else zn
        gaps = sorted([(at - wd / 2, at + wd / 2, 0.0, hh) for (s, at, wd, hh) in doors if s == side]
                      + [(at - wd / 2, at + wd / 2, y0, y1) for (s, at, wd, y0, y1) in windows if s == side])
        cur = c0
        for (g0, g1, y0, y1) in gaps + [(c0 + L, c0 + L, 0, 0)]:
            if g0 - cur > 0.01:
                pieces.append((side, cur, g0, 0.0, H))
            if y1 > 0:
                if y0 > 0.01:
                    pieces.append((side, g0, g1, 0.0, y0))
                if H - y1 > 0.01:
                    pieces.append((side, g0, g1, y1, H))
            cur = g1
    for (side, a, c, y0, y1) in pieces:
        if side in ("n", "s"):
            zz = zn + t / 2 if side == "n" else zs - t / 2
            b.box(P[m_wall], c - a, y1 - y0, t, (a + c) / 2, y0, zz)
            C.col((a + c) / 2, zz, c - a, t, y1 - y0, y0, 3)
        else:
            xx = xw + t / 2 if side == "w" else xe - t / 2
            b.box(P[m_wall], t, y1 - y0, c - a, xx, y0, (a + c) / 2)
            C.col(xx, (a + c) / 2, t, c - a, y1 - y0, y0, 3)
    for (xx, zz) in ((xw, zn), (xe, zn), (xw, zs), (xe, zs)):
        b.box(P["plank_dk"], 0.12, H, 0.12, xx, 0, zz)
    b.box(P["plank"], w - 2 * t, 0.03, d - 2 * t, x, 0.0, z)
    if roof_pitch:
        rise = d * 0.28
        L = math.hypot(d / 2 + 0.4, rise)
        for s in (-1, 1):
            b.box(P[m_roof], w + 0.6, 0.08, L, x, H + rise / 2 - 0.04, z + s * (d / 4 + 0.1), rx=s * math.atan2(rise, d / 2 + 0.4))
        b.box(P[m_wall], w - 2 * t, rise, t, x, H, zn + t / 2)
        b.box(P[m_wall], w - 2 * t, rise, t, x, H, zs - t / 2)
        for s in (-1, 1):
            prof = [(zn, H), (zs, H), (z, H + rise)]
            b.prism(P[m_wall], [(u, v) for (u, v) in prof], (xw if s < 0 else xe - 0.02), (xw + 0.02 if s < 0 else xe), axis="x")
        C.col(x, z, w + 0.6, d + 0.8, rise + 0.1, H, 3)
    else:
        b.box(P[m_roof], w + 0.5, 0.1, d + 0.5, x, H, z)
        C.col(x, z, w + 0.5, d + 0.5, 0.1, H, 3)
    C.end()
    for (side, at, wd, hh) in doors:
        if side == "n":
            C.face(f"door:{pid}", pid, (at, hh / 2, zn - 0.01), (0, -1), wd, hh)
        elif side == "s":
            C.face(f"door:{pid}", pid, (at, hh / 2, zs + 0.01), (0, 1), wd, hh)
        elif side == "w":
            C.face(f"door:{pid}", pid, (xw - 0.01, hh / 2, at), (-1, 0), wd, hh)
        else:
            C.face(f"door:{pid}", pid, (xe + 0.01, hh / 2, at), (1, 0), wd, hh)
    for k, (side, at, wd, y0, y1) in enumerate(windows):
        n = {"n": (0, -1), "s": (0, 1), "w": (-1, 0), "e": (1, 0)}[side]
        c = {"n": (at, (y0 + y1) / 2, zn - 0.01), "s": (at, (y0 + y1) / 2, zs + 0.01), "w": (xw - 0.01, (y0 + y1) / 2, at), "e": (xe + 0.01, (y0 + y1) / 2, at)}[side]
        C.face(f"window:{pid}{k}", pid, c, n, wd, y1 - y0)


# ============================================================== THE CAVE

CAVE_X, CAVE_Z, CAVE_H = 12.0, 12.0, 6.5
TUN = 2.6                  # the tunnel's half width
TUN_H = 3.2
CHAMBER = (2.6, 10.5, -5.0, 5.0, 3.9)      # x0, x1, z0, z1, ceiling
CH_DOOR = (-2.0, 2.0)                      # the opening from the tunnel, z0..z1
ALCOVE = (-4.6, -2.6, 5.0, 7.0, 2.0)


def cave_build(b, P, R, origin):
    C = Site(b, P, R, origin, 13)
    C.container = "cave-rock"
    rng = C.rng
    X, Z, H = CAVE_X, CAVE_Z, CAVE_H
    cx0, cx1, cz0, cz1, ch = CHAMBER
    C.begin("cave-rock")
    # the mound: four crag faces, the north and south ones cut for the mouths
    for (ax, az, bx, bz, nx, nz) in ((-X, -Z, -TUN - 0.8, -Z, 0, -1), (TUN + 0.8, -Z, X, -Z, 0, -1), (X, -Z, X, Z, 1, 0),
                                     (X, Z, TUN + 0.8, Z, 0, 1), (-TUN - 0.8, Z, -X, Z, 0, 1), (-X, Z, -X, -Z, -1, 0)):
        rock_face(b, rng, P["cave_dk"], ax, az, bx, bz, nx, nz, -0.4, H, lean=1.3, jit=0.45, step=1.4, rings=5)
    # the mouths: an arch of rock over each, the rock between the mouth and the face
    for (zz, nz) in ((-Z, -1), (Z, 1)):
        b.box(P["cave_dk"], 2 * TUN + 1.7, H - TUN_H, 1.6, 0, TUN_H, zz + nz * 0.2)
        for s in (-1, 1):
            b.lump(P["cave"], 1.4, 1.2, 1.3, s * (TUN + 0.5), TUN_H - 0.5, zz + nz * 0.5, seed=200 + int(zz) + s, rnd=0.5, jitter=0.15, flat_base=False)
    # boulders embedded in the faces, so the mound reads as a rock pile
    for (ax, az, bx, bz, nx, nz) in ((-X, -Z, X, -Z, 0, -1), (X, -Z, X, Z, 1, 0), (X, Z, -X, Z, 0, 1), (-X, Z, -X, -Z, -1, 0)):
        for k in range(7):
            t = (k + 0.5) / 7 + rng.uniform(-0.05, 0.05)
            x, z = ax + (bx - ax) * t, az + (bz - az) * t
            if nz and abs(x) < TUN + 2.2:
                continue
            sz = rng.uniform(2.6, 4.6)
            y = rng.uniform(-0.3, H - 3.0)
            b.lump(P["cave"] if k % 3 else P["cave_dk"], sz, rng.uniform(1.6, 3.0), sz * 0.8, x + nx * (sz * 0.25), y, z + nz * (sz * 0.25),
                   seed=180 + k * 7 + int(ax + az), rnd=0.6, jitter=0.2, ry=rng.uniform(0, 3), flat_base=False)
    for k in range(10):                                                           # boulders round the foot
        a = 2 * math.pi * k / 10 + rng.uniform(-0.15, 0.15)
        x, z = 13.5 * math.cos(a), 13.5 * math.sin(a)
        if abs(x) < TUN + 2.5 and abs(z) > 10:
            continue
        sz = rng.uniform(1.2, 2.4)
        b.lump(P["cave_dk"], sz * 1.3, sz * 0.8, sz, x, -0.2, z, seed=190 + k, rnd=0.6, jitter=0.15, ry=a)
    # the top: hummocks of rock, the cap
    b.box(P["cave"], 2 * X - 0.2, 0.3, 2 * Z - 0.2, 0, H - 0.3, 0)
    for k in range(14):
        x, z = rng.uniform(-X + 2, X - 2), rng.uniform(-Z + 2, Z - 2)
        s = rng.uniform(2.0, 4.5)
        b.lump(P["cave"] if k % 3 else P["cave_dk"], s, rng.uniform(1.0, 2.6), s * rng.uniform(0.7, 1.2), x, H - 0.4, z, seed=220 + k, rnd=0.6, jitter=0.2, ry=rng.uniform(0, 3))
    # inside: the tunnel's walls and ceiling, the chamber's, the alcove's
    b.box(P["cave_in"], 0.3, TUN_H, 2 * Z, -TUN - 0.15, 0, 0)
    for (z0, z1) in ((-Z, CH_DOOR[0]), (CH_DOOR[1], Z)):
        b.box(P["cave_in"], 0.3, TUN_H, z1 - z0, TUN + 0.15, 0, (z0 + z1) / 2)
    b.box(P["cave_in"], 2 * TUN + 0.6, 0.3, 2 * Z, 0, TUN_H, 0)
    b.box(P["cave_in"], cx1 - cx0, 0.3, cz1 - cz0, (cx0 + cx1) / 2, ch, (cz0 + cz1) / 2)
    b.box(P["cave_in"], 0.3, ch, cz1 - cz0, cx1 - 0.15, 0, (cz0 + cz1) / 2)
    b.box(P["cave_in"], cx1 - cx0, ch, 0.3, (cx0 + cx1) / 2, 0, cz0 + 0.15)
    b.box(P["cave_in"], cx1 - cx0, ch, 0.3, (cx0 + cx1) / 2, 0, cz1 - 0.15)
    b.box(P["cave_in"], 0.3, ch - TUN_H, CH_DOOR[1] - CH_DOOR[0], cx0 + 0.15, TUN_H, 0)
    ax0, ax1, az0, az1, ah = ALCOVE
    b.box(P["cave_in"], ax1 - ax0, 0.3, az1 - az0, (ax0 + ax1) / 2, ah, (az0 + az1) / 2)
    b.box(P["cave_in"], 0.3, ah, az1 - az0, ax0 + 0.15, 0, (az0 + az1) / 2)
    # the floor: sand in the tunnel and the chamber, spilling out of the mouths
    b.box(P["sand"], 2 * TUN, 0.03, 2 * Z + 6, 0, 0.0, 0)
    b.box(P["sand"], cx1 - cx0, 0.03, cz1 - cz0, (cx0 + cx1) / 2, 0.0, (cz0 + cz1) / 2)
    for (zz, nz, reach) in ((-Z, -1, 1.8), (Z, 1, 3.5)):     # the north spill stays short of the city's Bar
        b.lump(P["sand"], 7.0, 0.25, reach + 0.6, 0, -0.08, zz + nz * reach, seed=240 + int(zz), rnd=0.3, jitter=0.15)
    # stalactites and crystals
    for k in range(16):
        inside = k < 10
        x = rng.uniform(cx0 + 0.6, cx1 - 0.6) if inside else rng.uniform(-TUN + 0.4, TUN - 0.4)
        z = rng.uniform(cz0 + 0.6, cz1 - 0.6) if inside else rng.uniform(-Z + 1, Z - 1)
        top = ch if inside else TUN_H
        L = rng.uniform(0.5, 1.1)
        b.cyl(P["cave_in"], rng.uniform(0.12, 0.22), (x, top + 0.1, z), (x, top - L, z), seg=6, r2=0.02)
    for k in range(7):
        x = cx1 - 0.2 if k % 2 else cx0 + 0.25
        z = rng.uniform(cz0 + 0.5, cz1 - 0.5)
        if abs(z) < 2.6 and k % 2 == 0:
            z = cz0 + 0.8
        b.lump(P["crystal"], 0.5, rng.uniform(0.6, 1.2), 0.5, x, rng.uniform(0.3, 2.2), z, seed=260 + k, rnd=0.7, jitter=0.1, flat_base=False)
    C.end()
    # colliders: the rock round the tunnel, the chamber and the alcove; the roofs
    C.col_box(-X, -TUN, -Z, az0, H)
    C.col_box(-X, ax0, az0, az1, H)
    C.col_box(-X, -TUN, az1, Z, H)
    C.col_box(TUN, X, -Z, cz0, H)
    C.col_box(TUN, X, cz1, Z, H)
    C.col_box(cx1, X, cz0, cz1, H)
    C.col_box(TUN, cx0 + 0.3, cz0, CH_DOOR[0], H)
    C.col_box(TUN, cx0 + 0.3, CH_DOOR[1], cz1, H)
    C.col_box(TUN, cx0 + 0.3, CH_DOOR[0], CH_DOOR[1], H - TUN_H, TUN_H)
    C.col_box(-TUN, TUN, -Z, Z, H - TUN_H, TUN_H)
    C.col_box(cx0, cx1, cz0, cz1, H - ch, ch)
    C.col_box(ax0, ax1, az0, az1, H - ah, ah)
    C.face("door:cave-south", "cave-rock", (0, TUN_H / 2, Z + 0.5), (0, 1), 2 * TUN, TUN_H)
    C.face("door:cave-north", "cave-rock", (0, TUN_H / 2, -Z - 0.5), (0, -1), 2 * TUN, TUN_H)
    # cart rails down the tunnel, the cart
    C.begin("rails")
    for x in (-0.35, 0.35):
        b.box(P["rail"], 0.06, 0.08, 2 * Z + 3, x, 0.03, 0)
    zz = -Z - 1
    while zz < Z + 1:
        b.box(P["plank_dk"], 1.2, 0.05, 0.16, 0, 0.0, zz)
        zz += 0.7
    C.end()
    C.begin("cart", on="rails")
    cxx = -1.85                                  # off the rails against the west wall
    b.box(P["cart"], 0.95, 0.75, 1.5, cxx, 0.3, 7.5, rz=0.08, bevel=0.04)
    b.box(P["ore"], 0.7, 0.3, 1.2, cxx, 1.0, 7.5)
    for k in range(5):
        b.lump(P["ore"], 0.3, 0.25, 0.3, cxx + rng.uniform(-0.3, 0.3), 1.1, 7.5 + rng.uniform(-0.5, 0.5), seed=280 + k, rnd=0.6, jitter=0.15, flat_base=False)
    for (sx, sz) in ((-0.42, 7.0), (0.42, 7.0), (-0.42, 8.0), (0.42, 8.0)):
        b.cyl(P["steel_dk"], 0.18, (cxx + sx - 0.05, 0.2, sz), (cxx + sx + 0.05, 0.2, sz), seg=10)
    for k in range(4):                                                         # ore spilt toward the rails
        b.lump(P["ore"], 0.28, 0.2, 0.28, cxx + 0.7 + rng.uniform(0, 0.4), 0.0, 7.5 + rng.uniform(-0.8, 0.8), seed=290 + k, rnd=0.6, jitter=0.15)
    C.end()
    C.col(cxx, 7.5, 1.0, 1.5, 1.3, 0, 1)
    # the chamber: the pool, the campfire, the sleeping bag, crates, bones, pickaxes
    C.begin("pool")
    b.cyl(P["cave_dk"], 2.0, (7.6, 0.0, -2.8), (7.6, 0.18, -2.8), seg=18)
    b.cyl(P["pool"], 1.65, (7.6, 0.18, -2.8), (7.6, 0.2, -2.8), seg=18)
    for k in range(9):
        a = 2 * math.pi * k / 9
        b.lump(P["cave"], 0.5, 0.35, 0.45, 7.6 + 1.95 * math.cos(a), 0.05, -2.8 + 1.95 * math.sin(a), seed=300 + k, rnd=0.6, jitter=0.15)
    C.end()
    C.col(7.6, -2.8, 4.0, 4.0, 0.3, 0, 1)
    C.begin("campfire")
    for k in range(10):
        a = 2 * math.pi * k / 10
        b.lump(P["cave_dk"], 0.35, 0.25, 0.3, 5.0 + 0.8 * math.cos(a), 0.0, 2.6 + 0.8 * math.sin(a), seed=320 + k, rnd=0.6, jitter=0.15)
    b.cyl(P["ash"], 0.6, (5.0, 0.0, 2.6), (5.0, 0.06, 2.6), seg=12)
    for k in range(3):
        a = k * 2.1
        b.cyl(P["plank_dk"], 0.09, (5.0 - 0.5 * math.cos(a), 0.12, 2.6 - 0.5 * math.sin(a)), (5.0 + 0.5 * math.cos(a), 0.3, 2.6 + 0.5 * math.sin(a)), seg=6)
    b.lump(P["ember"], 0.5, 0.25, 0.5, 5.0, 0.1, 2.6, seed=330, rnd=0.6, jitter=0.2)
    C.end()
    C.col(5.0, 2.6, 1.8, 1.8, 0.4, 0, 1)
    C.begin("sleeping-bag")
    b.lump(P["bag"], 0.8, 0.28, 2.0, 8.6, 0.0, 3.4, seed=340, rnd=0.3, jitter=0.1)
    b.lump(P["white"], 0.5, 0.18, 0.4, 8.6, 0.1, 2.5, seed=341, rnd=0.4, jitter=0.1)
    C.end()
    crate(C, "cave-crate0", 3.7, -4.1, 0.0, 1.0, 0.1)
    crate(C, "cave-crate1", 4.9, -4.2, 0.0, 0.8, -0.2)
    crate(C, "cave-crate2", 3.8, -4.1, 0.8, 0.7, 0.4)
    C.begin("bones")
    sphere(b, P["bone"], (9.6, 0.22, 0.5), 0.22, seg=8, ring=5)
    for k in range(4):
        b.bar(P["bone"], (9.0 - k * 0.25, 0.04, 0.2), (8.7 - k * 0.25, 0.04, 0.7), 0.05)
    b.bar(P["bone"], (9.1, 0.05, -0.2), (8.2, 0.05, 0.1), 0.06)
    C.end()
    C.begin("pickaxes", on="pool")
    for k, (x, z, ry) in enumerate(((9.9, -4.4, 0.0), (9.5, -4.5, 0.3))):
        b.bar(P["plank_dk"], (x, 0.0, z + 0.4), (x - 0.2, 1.4, z - 0.1), 0.05)
        b.box(P["steel_dk"], 0.7, 0.06, 0.08, x - 0.2, 1.38, z - 0.1, ry=ry)
    C.end()
    # lanterns at the mouths and in the chamber, the warning sign
    lantern_post(C, "cave-lamp0", TUN + 1.4, Z + 1.2)
    lantern_post(C, "cave-lamp1", -TUN - 1.4, -Z - 1.2)
    lantern_post(C, "cave-lamp2", cx1 - 0.6, cz1 - 0.6, 0.0, 1.9)
    lantern_post(C, "cave-lamp3", cx0 + 0.8, cz1 - 0.6, 0.0, 1.9)
    C.begin("cave-sign")
    b.cyl(P["pole"], 0.05, (TUN + 3.2, 0.0, Z + 2.5), (TUN + 3.2, 2.2, Z + 2.5), seg=6)
    b.box(P["hazard_y"], 1.1, 1.1, 0.05, TUN + 3.2, 1.5, Z + 2.5, rz=0.785)
    b.box(P["ink"], 0.14, 0.5, 0.02, TUN + 3.2, 1.75, Z + 2.54)
    b.box(P["ink"], 0.14, 0.14, 0.02, TUN + 3.2, 1.5, Z + 2.54)
    C.end()
    C.col(TUN + 3.2, Z + 2.5, 0.14, 0.14, 2.2, 0, 1)
    C.face("cave-sign", "cave-sign", (TUN + 3.2, 2.05, Z + 2.56), (0, 1), 1.0, 1.0)
    C.loot(-3.6, 0.0, 6.0)
    C.loot(7.0, 0.0, 0.6)
    C.loot(0.0, 0.0, -8.0)
    b.finish("tf-cave-p3.glb")


# ============================================================== THE DOCK

DOCK_L, DOCK_A = 21.7, 27.2          # the jetty south, the arm east (the map's P())


def rowboat(C, pid, x, z, y, ry, m, on=None):
    b, P = C.b, C.P
    c, s = math.cos(ry), math.sin(ry)
    C.begin(pid, on)
    plan = [(-1.8, 0.0), (-1.5, -0.55), (-0.5, -0.7), (0.8, -0.7), (1.6, -0.45), (2.0, 0.0), (1.6, 0.45), (0.8, 0.7), (-0.5, 0.7), (-1.5, 0.55)]
    pts = [(x + u * 0.85 * c + v * 0.65 * s, y + 0.1, z - u * 0.85 * s + v * 0.65 * c) for (u, v) in plan]
    pts += [(x + u * c + v * s, y + 0.62, z - u * s + v * c) for (u, v) in plan]
    pts += [(x + u * 0.85 * c + v * 0.7 * s, y + 0.2, z - u * 0.85 * s + v * 0.7 * c) for (u, v) in plan]
    n = len(plan)
    faces = [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)] + [list(range(n))[::-1]]
    faces += [[n + i, n + (i + 1) % n, 2 * n + (i + 1) % n, 2 * n + i] for i in range(n)] + [[2 * n + i for i in range(n)]]
    b.poly(P[m], pts, faces)
    for u in (-0.8, 0.4):
        b.box(P["plank"], 0.25, 0.05, 1.3, x + u * c, y + 0.4, z - u * s, ry=ry)
    b.bar(P["water_o"], (x - 0.3 * c - 0.9 * s, y + 0.45, z + 0.3 * s - 0.9 * c), (x + 1.2 * c + 1.4 * s, y + 0.35, z - 1.2 * s + 1.4 * c), 0.05)
    C.end()
    C.col(x, z, 4.0 * abs(c) + 1.4 * abs(s), 4.0 * abs(s) + 1.4 * abs(c), 0.62, y, 1)


def crab_pot(C, pid, x, z, y, ry=0.0, on=None):
    b, P = C.b, C.P
    C.begin(pid, on)
    b.box(P["pot"], 0.7, 0.45, 0.5, x, y, z, ry=ry)
    for k in range(4):
        b.box(P["net"], 0.72, 0.02, 0.52, x, y + 0.08 + k * 0.1, z, ry=ry)
    C.end()
    C.col(x, z, 0.8, 0.6, 0.45, y, 1)


def dock_build(b, P, R, origin):
    C = Site(b, P, R, origin, 17)
    C.container = "jetty"
    rng = C.rng
    L, A = DOCK_L, DOCK_A
    # the jetty and the arm, as the old build laid them (their colliders too)
    C.begin("jetty")
    b.box(P["plank_dk"], 3.6, 0.33, 1.0, 0, 0, -0.5, bevel=0.03)
    z = 0.02
    while z < L - 0.2:
        b.box(P["plank"], 3.6 + rng.uniform(-0.06, 0.06), 0.07, 0.27, rng.uniform(-0.03, 0.03), 0.59, z + 0.14, ry=rng.uniform(-0.012, 0.012))
        z += 0.31
    for x in (-1.45, 0, 1.45):
        b.box(P["plank_dk"], 0.2, 0.3, L, x, 0.29, L / 2)
    for s in (-1, 1):
        b.box(P["plank_dk"], 0.07, 0.24, L, s * 1.83, 0.37, L / 2)
    k = 0.6
    while k < L:
        for x in (-1.7, 1.7):
            b.cyl(P["pile"], 0.17, (x, -0.1, k), (x, 0.6, k), seg=8)
        k += 3.0
    for t in range(5):                                                     # mooring posts
        zz = 3 + t * 4.5
        b.cyl(P["pile"], 0.2, (2.0, -0.2, zz), (2.0, 1.55, zz), seg=8)
        b.cyl(P["plank_dk"], 0.23, (2.0, 1.55, zz), (2.0, 1.62, zz), seg=8)
        b.cyl(P["rope"], 0.24, (2.0, 1.05, zz), (2.0, 1.2, zz), seg=10)
    C.end()
    C.begin("jetty")                                                       # the arm: the same prop, its own box
    x = 1.82
    while x < A + 1.8 - 0.2:
        b.box(P["plank"], 0.27, 0.07, 3.6 + rng.uniform(-0.06, 0.06), x + 0.14, 0.59, L + rng.uniform(-0.03, 0.03), ry=rng.uniform(-0.012, 0.012))
        x += 0.31
    for zz in (L - 1.45, L, L + 1.45):
        b.box(P["plank_dk"], A, 0.3, 0.2, 1.8 + A / 2, 0.29, zz)
    for s in (-1, 1):
        b.box(P["plank_dk"], A, 0.24, 0.07, 1.8 + A / 2, 0.37, L + s * 1.83)
    x = 3.6
    while x < A + 1.8:
        for zz in (L - 1.7, L + 1.7):
            b.cyl(P["pile"], 0.17, (x, -0.1, zz), (x, 0.6, zz), seg=8)
        x += 3.0
    ex = A + 1.6                                                           # the lamp and ladder at the end
    b.box(P["plank_dk"], 0.18, 2.6, 0.18, ex, 0.66, L - 1.6)
    b.box(P["plank_dk"], 0.6, 0.1, 0.12, ex - 0.2, 3.2, L - 1.6)
    b.box(P["lantern"], 0.26, 0.36, 0.26, ex - 0.42, 2.82, L - 1.6)
    for s in (-1, 1):
        b.bar(P["coping"], (ex + 0.25, -0.2, L + s * 0.35), (ex + 0.25, 1.4, L + s * 0.35), 0.06)
    for y in (0.1, 0.4):
        b.bar(P["coping"], (ex + 0.25, y, L - 0.35), (ex + 0.25, y, L + 0.35), 0.05)
    C.end()
    C.col(0, -0.5, 3.6, 1, 0.33, 0, 3)
    C.col(0, L / 2, 3.6, L, 0.66, 0, 3)
    C.col(1.8 + A / 2, L, A, 3.6, 0.66, 0, 3)
    C.col(ex, L - 1.6, 0.2, 0.2, 2.6, 0.66, 1)
    # the bait shop west of the root: in by the east door, the serving window on the water
    box_shed(C, "bait-shop", -5.2, -4.2, 5.0, 4.2, 2.6, [("e", -4.2, 1.1, 2.1)], [("s", -5.2, 2.4, 1.0, 2.0)], "shed", "roof_tin")
    C.begin("bait-counter", on="bait-shop")
    b.box(P["wood"], 2.8, 0.06, 0.6, -5.2, 0.94, -2.4)
    b.box(P["shed_dk"], 2.8, 0.94, 0.5, -5.2, 0.0, -2.45)
    b.box(P["wood"], 2.4, 0.05, 0.3, -5.2, 0.9, -1.95)
    for k in range(4):
        b.box(P[("crate", "white", "net", "crate")[k]], 0.3, 0.22, 0.25, -6.2 + k * 0.65, 1.0, -2.45)
    C.end()
    C.col(-5.2, -2.45, 2.8, 0.6, 1.0, 0, 1)
    C.begin("bait-shelf", on="bait-shop")
    for y in (0.5, 1.2, 1.9):
        b.box(P["plank_dk"], 3.0, 0.04, 0.4, -5.2, y, -6.05)
        for k in range(5):
            b.box(P[("crate", "white", "pot", "net", "crate")[k]], 0.4, rng.uniform(0.2, 0.4), 0.3, -6.4 + k * 0.6, y + 0.04, -6.05)
    C.end()
    C.col(-5.2, -6.05, 3.0, 0.4, 2.2, 0, 1)
    C.sign("BAIT", -5.2, 2.95, -2.1 + 0.08, 0, 1, 2.6, 0.55, 0x7fe0ff)
    C.begin("bait-sign", on="bait-shop")
    b.box(P["board"], 2.8, 0.65, 0.12, -5.2, 2.62, -2.06)
    C.end()
    C.face("bait-sign", "bait-shop", (-5.2, 2.95, -1.99), (0, 1), 2.6, 0.55)
    C.loot(-5.0, 0.0, -4.9)
    # the boat shed east of the root, open to the water, the slipway down from it
    box_shed(C, "boat-shed", 6.0, -4.5, 5.2, 6.4, 3.0, [("s", 6.0, 3.6, 2.8)], [("e", -4.5, 1.4, 1.2, 2.0)], "shed_dk", "roof_tin")
    C.begin("shed-boat", on="boat-shed")
    for sx in (-1.2, 1.2):
        b.box(P["plank_dk"], 0.3, 0.6, 1.2, 6.0 + sx, 0.0, -5.0)
    C.end()
    rowboat(C, "shed-rowboat", 6.0, -5.0, 0.6, math.pi / 2, "boat_r", on="boat-shed")
    C.begin("oars", on="boat-shed")
    for k in range(3):
        b.bar(P["water_o"], (3.75, 0.0, -7.0 + k * 0.5), (3.9, 2.4, -6.7 + k * 0.5), 0.05)
    C.end()
    for k in range(3):
        crab_pot(C, f"pot{k}", 8.0, -6.6 + k * 0.02, k * 0.47, 0.1 * k, on="boat-shed")
    C.loot(4.4, 0.0, -4.5)
    C.begin("slipway", on="boat-shed")
    b.box(P["conc"], 4.2, 0.05, 10.0, 6.0, -0.02, 3.7)
    for k in range(8):
        flat(b, P["shed_dk"], 6.0, 0.035, -0.6 + k * 1.2, 4.0, 0.08)
    C.end()
    for sx in (-2.2, 2.2):
        C.begin(f"slip-rail{int(sx > 0)}")
        for zz in (0.0, 3.0, 6.0):
            b.cyl(P["steel"], 0.04, (6.0 + sx, 0.0, zz), (6.0 + sx, 0.55, zz), seg=6)
        b.cyl(P["steel"], 0.035, (6.0 + sx, 0.55, -0.2), (6.0 + sx, 0.55, 6.2), seg=6)
        C.end()
        C.col(6.0 + sx, 3.0, 0.1, 6.4, 0.6, 0, 1)
    C.begin("fuel-pump")
    b.box(P["pump"], 0.6, 1.5, 0.45, 3.0, 0.0, -8.6, bevel=0.03)
    b.box(P["white"], 0.4, 0.3, 0.02, 3.0, 0.9, -8.37)
    b.box(P["steel_dk"], 0.08, 0.5, 0.08, 3.34, 0.9, -8.6)
    b.bar(P["ink"], (3.34, 1.4, -8.6), (3.5, 0.5, -8.3), 0.03)
    C.end()
    C.col(3.0, -8.6, 0.6, 0.45, 1.5, 0, 1)
    # boats tied up, crab pots on the arm, nets drying, the bench, buoys
    rowboat(C, "rowboat0", -3.3, 7.5, 0.04, 0.12, "boat_b")
    C.begin("rowboat0-line", on="rowboat0")
    b.bar(P["rope"], (-1.9, 0.5, 7.0), (2.0, 1.1, 7.5), 0.025)
    C.end()
    rowboat(C, "rowboat1", 18.0, L + 3.4, 0.04, 0.05, "boat_r")
    C.begin("rowboat1-line", on="rowboat1")
    b.bar(P["rope"], (16.4, 0.5, L + 3.0), (16.0, 0.7, L + 1.8), 0.025)
    C.end()
    for k in range(3):
        crab_pot(C, f"arm-pot{k}", 11.5 + (k % 2) * 0.8, L + 1.2, 0.66 + (k // 2) * 0.47, 0.2 * k)
    C.begin("net-frame")
    for x in (-9.0, -6.0):
        b.cyl(P["pile"], 0.08, (x, 0.0, 1.5), (x, 2.2, 1.5), seg=6)
    b.cyl(P["rope"], 0.025, (-9.0, 2.1, 1.5), (-6.0, 2.1, 1.5), seg=5)
    quad(b, P["net"], (-7.5, 1.25, 1.5), (0, 1), (1, 0), 2.8, 1.6)
    C.end()
    for x in (-9.0, -6.0):
        C.col(x, 1.5, 0.16, 0.16, 2.2, 0, 1)
    C.begin("dock-bench")
    b.box(P["plank"], 1.8, 0.08, 0.45, -1.0, 0.44, -8.4)
    b.box(P["plank"], 1.8, 0.4, 0.07, -1.0, 0.52, -8.6, rx=-0.15)
    for sx in (-0.75, 0.75):
        b.box(P["ink"], 0.08, 0.44, 0.4, -1.0 + sx, 0.0, -8.4)
    C.end()
    C.col(-1.0, -8.4, 1.8, 0.5, 0.9, 0, 1)
    for k, (x, z) in enumerate(((-6.0, 9.5), (10.0, L + 5.0), (24.0, L - 4.0))):
        C.begin(f"buoy{k}")
        sphere(b, P["buoy_r" if k % 2 else "buoy_w"], (x, 0.3, z), 0.3, seg=10, ring=6)
        b.cyl(P["pole"], 0.03, (x, 0.5, z), (x, 1.0, z), seg=5)
        C.end()
    C.loot(A + 0.6, 0.66, L)
    b.finish("tf-dock-p3.glb")


# ============================================================== OLD TREE

TRUNK_R = 1.3
DECK = (2.4, 2.4, 4.6, 5.0)            # centre x, z, size, top
CABIN = (3.4, 2.4, 2.6, 2.6, 2.2)      # x, z, w, d, wall height; the door south, onto the deck's open strip      # x, z, w, d, wall height


def tree_build(b, P, R, origin):
    C = Site(b, P, R, origin, 19)
    C.container = "tree"
    rng = C.rng

    def limb(pts, r0, r1, m="bark"):
        n = len(pts) - 1
        for i in range(n):
            ra, rb = r0 + (r1 - r0) * i / n, r0 + (r1 - r0) * (i + 1) / n
            b.cyl(P[m], ra, pts[i], pts[i + 1], seg=10, r2=rb)
            if i < n - 1:
                sphere(b, P[m], pts[i + 1], rb * 1.03, seg=10, ring=5)

    C.begin("tree")
    limb([(0, -0.3, 0), (0.1, 2.5, 0.1), (-0.2, 5.0, -0.05), (0.2, 7.5, 0.1), (0.5, 9.5, 0.0)], TRUNK_R, 0.55)
    for k in range(6):                                                         # root buttresses
        a = 2 * math.pi * k / 6 + 0.3
        b.cyl(P["bark"], 0.5, (0, 1.0, 0), (2.4 * math.cos(a), -0.15, 2.4 * math.sin(a)), seg=7, r2=0.12)
    limb([(-0.2, 5.6, 0.0), (-3.0, 6.8, 0.4), (-6.0, 7.3, 0.6), (-8.6, 7.1, 0.7)], 0.5, 0.15)       # the long branch (the swing)
    limb([(-6.0, 7.3, 0.6), (-6.8, 8.6, 0.3)], 0.15, 0.06)
    limb([(0.3, 7.6, 0.0), (3.0, 9.0, -0.6), (5.6, 9.6, -1.0)], 0.42, 0.14)
    limb([(0.2, 7.0, 0.1), (1.8, 8.2, 2.6), (3.6, 9.0, 4.4)], 0.36, 0.12)
    limb([(0.5, 9.5, 0.0), (0.3, 11.5, 0.5)], 0.4, 0.15)
    limb([(0.5, 9.5, 0.0), (2.2, 11.2, -0.4)], 0.32, 0.12)
    limb([(0.5, 9.5, 0.0), (-1.6, 11.0, -1.2)], 0.3, 0.12)
    for k, (x, y, z, w, h, d) in enumerate(((1.2, 11.2, 0.2, 7.6, 3.6, 6.4), (5.4, 9.8, -1.0, 5.2, 3.0, 4.4), (-2.0, 11.0, 0.7, 5.4, 3.2, 4.8),
                                            (-7.0, 8.4, 0.7, 4.0, 2.2, 3.4), (3.6, 9.6, 3.8, 4.0, 2.4, 3.0), (0.8, 13.4, 0.0, 4.6, 2.6, 4.2))):
        b.lump(P["leaf_b"], w * 0.95, h * 0.6, d * 0.95, x, y - h * 0.4, z, seed=140 + k, rnd=0.65, jitter=0.12)
        b.lump(P["leaf_a"], w, h, d, x, y - h * 0.25, z, seed=150 + k, rnd=0.6, jitter=0.14)
        b.lump(P["leaf_lt"], w * 0.5, h * 0.45, d * 0.5, x - w * 0.12, y + h * 0.5, z - d * 0.1, seed=160 + k, rnd=0.65, jitter=0.1)
    # the bird box on the trunk's north side
    b.box(P["plank"], 0.3, 0.4, 0.26, 0.0, 3.6, -TRUNK_R + 0.1)
    b.box(P["plank_dk"], 0.4, 0.05, 0.34, 0.0, 4.0, -TRUNK_R + 0.08)
    b.cyl(P["ink"], 0.05, (0.0, 3.85, -TRUNK_R), (0.0, 3.85, -TRUNK_R - 0.05), seg=8)
    C.end()
    C.col(0, 0, 2 * TRUNK_R, 2 * TRUNK_R, 9.5, 0, 3)
    # the tyre swing on the long branch
    C.begin("swing", on="tree")
    b.cyl(P["rope"], 0.03, (-7.6, 7.15, 0.65), (-7.6, 2.3, 0.65), seg=6)
    torus(b, P["tyre"], (-7.6, 1.85, 0.65), 0.42, 0.16, (1, 0, 0), (0, 1, 0), seg=20, tseg=8)
    C.end()
    C.col(-7.6, 0.65, 0.4, 1.2, 1.0, 1.4, 1)
    # the plank stair round the trunk: north over west to south, up to the deck
    dx, dz, ds, dtop = DECK
    N = 15
    C.begin("tree-stair", on="tree")
    for i in range(N):
        a = -math.pi / 2 - math.pi * i / (N - 1)         # north, round the west, to the south (the deck is south-east)
        r = TRUNK_R + 1.0
        x, z = r * math.cos(a), r * math.sin(a)
        top = dtop * (i + 1) / N
        b.box(P["plank"], 1.5, 0.12, 0.75, x, top - 0.12, z, ry=-a, bevel=0.02)
        b.bar(P["plank_dk"], (TRUNK_R * 0.8 * math.cos(a), top - 0.9, TRUNK_R * 0.8 * math.sin(a)), (x + 0.5 * math.cos(a), top - 0.16, z + 0.5 * math.sin(a)), 0.1)
        if i % 2 == 0:
            px, pz = (r + 0.6) * math.cos(a), (r + 0.6) * math.sin(a)
            b.cyl(P["plank_dk"], 0.05, (px, top - 0.12, pz), (px, top + 0.9, pz), seg=6)
        w = abs(1.5 * math.cos(a)) + abs(0.75 * math.sin(a))
        d = abs(1.5 * math.sin(a)) + abs(0.75 * math.cos(a))
        C.col(x, z, w, d, 0.12, top - 0.12, 3)
    for i in range(0, N - 2, 2):
        a0 = -math.pi / 2 - math.pi * i / (N - 1)
        a1 = -math.pi / 2 - math.pi * (i + 2) / (N - 1)
        r = TRUNK_R + 1.6
        b.cyl(P["rope"], 0.025, (r * math.cos(a0), dtop * (i + 1) / N + 0.85, r * math.sin(a0)), (r * math.cos(a1), dtop * (i + 3) / N + 0.85, r * math.sin(a1)), seg=5)
    C.end()
    # the deck and the cabin
    dxd0 = CABIN[0] - 0.4
    C.begin("treehouse", on=("tree", "tree-stair"))
    b.box(P["plank_dk"], ds, 0.25, ds, dx, dtop - 0.25, dz)
    zz = dz - ds / 2 + 0.02
    while zz < dz + ds / 2 - 0.2:
        b.box(P["plank"], ds, 0.04, 0.27, dx, dtop, zz + 0.14)
        zz += 0.31
    for (sx, sz) in ((dx + ds / 2 - 0.3, dz - ds / 2 + 0.3), (dx + ds / 2 - 0.3, dz + ds / 2 - 0.3), (dx - ds / 2 + 0.3, dz + ds / 2 - 0.3)):
        b.cyl(P["plank_dk"], 0.1, (sx, 0.0, sz), (sx, dtop - 0.2, sz), seg=7)
    for s in (-1, 1):                                                           # braces to the trunk
        b.bar(P["plank_dk"], (TRUNK_R * 0.7, dtop - 2.2, s * 0.5), (dx + s * 1.2, dtop - 0.3, dz + s * 1.2), 0.12)
    for (ax, az, bx, bz) in ((dx + ds / 2, dz - ds / 2, dx + ds / 2, dz + 0.4), (dx - ds / 2, dz + ds / 2, dxd0 - 0.9, dz + ds / 2)):
        b.cyl(P["rope"], 0.025, (ax, dtop + 0.95, az), (bx, dtop + 0.95, bz), seg=5)
    C.end()
    C.col(dx, dz, ds, ds, 0.25, dtop - 0.25, 3)
    cx, cz, cw, cd, ch = CABIN
    dxd = dxd0                                       # the door's centre along the south wall
    C.begin("treehouse", on=("tree", "tree-stair"))
    t = 0.12
    zs = cz + cd / 2
    b.box(P["plank"], cw, ch, t, cx, dtop, cz - cd / 2 + t / 2)
    b.box(P["plank"], t, ch, cd, cx + cw / 2 - t / 2, dtop, cz)
    b.box(P["plank"], t, ch, cd, cx - cw / 2 + t / 2, dtop, cz)
    for (a, c) in ((cx - cw / 2, dxd - 0.55), (dxd + 0.55, cx + cw / 2)):
        b.box(P["plank"], c - a, ch, t, (a + c) / 2, dtop, zs - t / 2)
    b.box(P["plank"], 1.1, ch - 1.9, t, dxd, dtop + 1.9, zs - t / 2)
    b.box(P["cabin_win"], 0.02, 0.7, 1.0, cx + cw / 2 - 0.05, dtop + 1.0, cz)
    rise = 0.9
    for s_ in (-1, 1):
        Lr = math.hypot(cd / 2 + 0.3, rise)
        b.box(P["shingle"], cw + 0.5, 0.08, Lr, cx, dtop + ch + rise / 2 - 0.04, cz + s_ * (cd / 4 + 0.08), rx=s_ * math.atan2(rise, cd / 2 + 0.3))
    for s_ in (-1, 1):
        b.prism(P["plank"], [(cz - cd / 2, dtop + ch), (cz + cd / 2, dtop + ch), (cz, dtop + ch + rise)], (cx - cw / 2 if s_ < 0 else cx + cw / 2 - 0.02), (cx - cw / 2 + 0.02 if s_ < 0 else cx + cw / 2), axis="x")
    C.end()
    C.col(cx, cz - cd / 2 + t / 2, cw, t, ch, dtop, 3)
    C.col(cx + cw / 2 - t / 2, cz, t, cd, ch, dtop, 3)
    C.col(cx - cw / 2 + t / 2, cz, t, cd, ch, dtop, 3)
    for (a, c) in ((cx - cw / 2, dxd - 0.55), (dxd + 0.55, cx + cw / 2)):
        C.col((a + c) / 2, zs - t / 2, c - a, t, ch, dtop, 3)
    C.col(cx, cz, cw + 0.5, cd + 0.6, rise + 0.1, dtop + ch, 3)
    C.face("door:treehouse", "tree", (dxd, dtop + 0.95, zs + 0.01), (0, 1), 1.1, 1.9)
    C.face("window:treehouse", "tree", (cx + cw / 2 + 0.01, dtop + 1.35, cz), (1, 0), 1.0, 0.7)
    C.begin("bunk", on=("treehouse", "tree-stair"))
    b.box(P["plank_dk"], 2.0, 0.35, 0.9, cx - 0.1, dtop, cz - 0.6)
    b.box(P["bed"], 1.96, 0.14, 0.86, cx - 0.1, dtop + 0.35, cz - 0.6)
    b.box(P["blanket"], 1.1, 0.06, 0.84, cx + 0.3, dtop + 0.49, cz - 0.6)
    C.end()
    C.col(cx - 0.1, cz - 0.6, 2.0, 0.9, 0.55, dtop, 1)
    crate(C, "cabin-crate", cx + 0.8, cz + 0.55, dtop, 0.6, 0.3, on=("treehouse", "tree-stair"))
    C.begin("cabin-lantern", on="treehouse")
    b.cyl(P["ink"], 0.02, (cx + 0.6, dtop + ch, cz), (cx + 0.6, dtop + ch - 0.3, cz), seg=5)
    b.box(P["lantern"], 0.2, 0.26, 0.2, cx + 0.6, dtop + ch - 0.56, cz)
    C.end()
    C.loot(cx + 0.4, dtop, cz + 0.2)
    # the rope ladder off the deck's east edge, a rope rail round the deck
    C.begin("rope-ladder", on="treehouse")
    ex = dx + ds / 2 + 0.1
    for s in (-0.25, 0.25):
        b.cyl(P["rope"], 0.025, (ex, dtop + 0.9, dz + 1.2 + s), (ex + 0.2, 0.4, dz + 1.2 + s), seg=5)
    for k in range(12):
        y = 0.6 + k * 0.36
        xx = ex + 0.2 - 0.2 * (y - 0.4) / (dtop + 0.5)
        b.cyl(P["plank_dk"], 0.03, (xx, y, dz + 0.9), (xx, y, dz + 1.5), seg=5)
    C.end()
    # the picnic table under the tree
    C.begin("picnic")
    px, pz = 3.6, -3.6                       # north-east, clear of the stair (which spirals round the west)
    b.box(P["plank"], 1.8, 0.06, 0.8, px, 0.72, pz)
    for s in (-1, 1):
        b.box(P["plank"], 1.8, 0.05, 0.3, px, 0.44, pz + s * 0.65)
    for sx in (-0.7, 0.7):
        b.bar(P["plank_dk"], (px + sx, 0.0, pz - 0.8), (px + sx, 0.72, pz + 0.8), 0.08)
        b.bar(P["plank_dk"], (px + sx, 0.0, pz + 0.8), (px + sx, 0.72, pz - 0.8), 0.08)
    C.end()
    C.col(px, pz, 1.8, 1.6, 0.78, 0, 1)
    C.loot(px, 0.78, pz)
    b.finish("tf-tree-p3.glb")


# ============================================================== THE BOAT

DK = 2.7                       # the deck
HOLD_Y = 0.55                  # the hold's floor (a player wades below 0.5 in the lake)
HATCH = (-5.9, -0.8, -0.7, 0.7)          # a metre past the stair foot: headroom to step off it under the deck          # x0, x1, z0, z1 of the companionway
HOUSE = (2.0, 6.6, -1.7, 1.7, 2.3)       # x0, x1, z0, z1, wall height
GANGWAY = 1.2                  # half the stern steps' width: the opening in the stern's bulwark
STERN_X0, STERN_X1 = -8.52, -7.86        # the stern's bulwark, the hull's skin in to the sides' inner face
CHEEK = 0.14                   # the stern steps' side panels
# The rig folds for the boardwalks' arches (maps/trollface-boat.js): the
# mast above its tabernacle, the sail and the boom are GLBs of their own in
# the Boat's frame (the map moves them; the sail furls onto the boom, the boom
# drops onto the wheelhouse roof, the mast swings aft about MAST_PIVOT)
MAST_X, TABERNACLE = 8.2, 3.0
MAST_PIVOT = (MAST_X, DK + TABERNACLE)
BOOM_Y = DK + 4.6
RIG_GLBS = ("tf-boatmast-p3.glb", "tf-boatsail-p3.glb", "tf-boatboom-p3.glb")
PLAN = [(-8.5, -2.9), (-6.0, -3.2), (5.5, -3.2), (8.5, -2.8), (10.6, -1.9), (12.1, -0.95), (12.9, 0.0),
        (12.1, 0.95), (10.6, 1.9), (8.5, 2.8), (5.5, 3.2), (-6.0, 3.2), (-8.5, 2.9)]


def boat_build(b, P, R, origin):
    C = Site(b, P, R, origin, 23)
    C.container = "hull"
    rng = C.rng
    CX = 2.2
    rings = [(DK + 0.9, 1.0, 1.0), (DK, 1.0, 1.0), (0.75, 0.99, 0.97), (0.34, 0.975, 0.93), (0.0, 0.9, 0.7)]
    bands = ["hull", "hull", "stripe", "hull_lo"]
    n = len(PLAN)
    C.begin("hull")
    pts = []
    for (y, fx, fz) in rings:
        for (x, z) in PLAN:
            pts.append((CX + (x - CX) * fx, y, z * fz))
    faces, mats = [], []
    for k in range(len(rings) - 1):
        for i in range(n):
            j = (i + 1) % n
            if k == 0 and i == n - 1:
                continue        # the stern's bulwark: solid pieces either side of the gangway (below)
            faces.append([k * n + i, k * n + j, (k + 1) * n + j, (k + 1) * n + i])
            mats.append(bands[k])
    faces.append([4 * n + i for i in range(n)][::-1])
    mats.append("hull_lo")
    out = b.poly(P["hull"], pts, faces)
    if len(out) == len(mats):
        for f, m in zip(out, mats):
            b._tag([f], P[m])
    # the bulwark's inner face and cap rail
    inner = [(CX + (x - CX) * 0.94, z * 0.9) for (x, z) in PLAN]
    ipts = [(x, DK, z) for (x, z) in inner] + [(x, DK + 0.9, z) for (x, z) in inner]
    ifaces = [[n + i, n + (i + 1) % n, (i + 1) % n, i] for i in range(n - 1)]
    b.poly(P["hull"], ipts, ifaces)
    for i in range(n - 1):
        (x0, z0), (x1, z1) = PLAN[i], PLAN[i + 1]
        b.bar(P["deck"], (x0, DK + 0.88, z0 * 0.97), (x1, DK + 0.88, z1 * 0.97), 0.3, 0.08)
        b.bar(P["stripe"], (x0, DK - 0.1, z0 * 1.01), (x1, DK - 0.1, z1 * 1.01), 0.1, 0.12)
    # the stern's bulwark (user: "the stairs should not be open at the back
    # end of the boat"): solid either side of the gangway the stern steps
    # come up through, capped like the sides (it was the hull's outer skin
    # only, see-through from the deck, and stood across the stair head)
    for s in (-1, 1):
        b.box(P["hull"], STERN_X1 - STERN_X0, 0.9, 2.75 - GANGWAY, (STERN_X0 + STERN_X1) / 2, DK, s * (GANGWAY + 2.75) / 2)
        b.box(P["deck"], STERN_X1 - STERN_X0 + 0.1, 0.08, 2.85 - GANGWAY + 0.04, (STERN_X0 + STERN_X1) / 2, DK + 0.84,
              s * (GANGWAY - 0.04 + 2.85) / 2)
    # the deck: planked, with the hatch's hole and the hold's floor under it
    hx0, hx1, hz0, hz1 = HATCH
    for (x0, x1, z0, z1) in ((-8.7, hx0, -3.0, 3.0), (hx1, 12.6, -3.0, 3.0), (hx0, hx1, -3.0, hz0), (hx0, hx1, hz1, 3.0)):
        b.box(P["deck"], x1 - x0, 0.1, z1 - z0, (x0 + x1) / 2, DK - 0.1, (z0 + z1) / 2)
    for k in range(1, 9):
        z = -2.7 + k * 5.4 / 9
        for (x0, x1) in ((-8.5, hx0), (hx1, 12.0)):
            b.box(P["plank_dk"], x1 - x0, 0.01, 0.04, (x0 + x1) / 2, DK, z)
    b.box(P["deck"], 0.12, 0.5, hz1 - hz0 + 0.24, hx0 - 0.06, DK, 0)             # the coaming (open at the stair head)
    for zz in (hz0 - 0.06, hz1 + 0.06):
        b.box(P["deck"], hx1 - hx0 + 0.24, 0.5, 0.12, (hx0 + hx1) / 2, DK, zz)
    b.box(P["plank_dk"], 19.0, 0.08, 5.2, 1.5, HOLD_Y - 0.08, 0)                   # the hold's floor
    for k in range(-8, 12):                                                         # frames in the hold
        b.box(P["plank_dk"], 0.14, DK - HOLD_Y - 0.1, 0.12, k * 1.0 + 1.0, HOLD_Y, -2.55)
        b.box(P["plank_dk"], 0.14, DK - HOLD_Y - 0.1, 0.12, k * 1.0 + 1.0, HOLD_Y, 2.55)
    C.end()
    # colliders: the hull's sides and ends, the deck slab round the hatch, the hold's floor
    C.col_box(-8.5, 12.9, -3.4, -2.5, DK + 0.9, 0.0)
    C.col_box(-8.5, 12.9, 2.5, 3.4, DK + 0.9, 0.0)
    C.col_box(10.5, 12.9, -3.4, 3.4, DK + 0.9, 0.0)
    for (x0, x1, z0, z1) in ((-8.7, hx0, -2.5, 2.5), (hx1, 10.5, -2.5, 2.5), (hx0, hx1, -2.5, hz0), (hx0, hx1, hz1, 2.5)):
        C.col_box(x0, x1, z0, z1, 0.12, DK - 0.08)
    C.col_box(-8.7, 10.5, -2.5, 2.5, HOLD_Y, 0.0)
    C.col_box(-8.7, -8.3, -2.5, 2.5, DK - 0.2, 0.0)       # the transom below the deck (the stair hangs off it)
    C.col(hx0 - 0.06, 0, 0.12, hz1 - hz0 + 0.24, 0.5, DK, 1)
    for zz in (hz0 - 0.06, hz1 + 0.06):
        C.col((hx0 + hx1) / 2, zz, hx1 - hx0 + 0.24, 0.12, 0.5, DK, 1)
    # the companionway down into the hold, the stern steps up from the water
    stairs(C, P["deck"], hx1, 0, -1, 0, HOLD_Y, DK, 1.2)
    stairs(C, P["deck"], -8.5, 0, -1, 0, 0.0, DK, 2 * GANGWAY)
    for s in (-1, 1):       # the stern's bulwark either side of the gangway
        C.col_box(STERN_X0, STERN_X1, *sorted((s * GANGWAY, s * 2.5)), 0.9, DK)
    # the stern steps' sides, closed (they were open, a rope rail each side):
    # a panel each side in the hull's colour from the water up to 0.9 m over
    # the steps' nosings, capped in teak like the bulwark it runs into; its
    # colliders step down with the stair, so nobody walks or falls off its sides
    steps = math.ceil(DK / RISE - 1e-6)
    x_end = -8.5 - steps * RUN
    C.begin("stern-rails", on="hull")
    for s in (-1, 1):
        z0, z1 = sorted((s * GANGWAY, s * (GANGWAY + CHEEK)))
        b.prism(P["hull"], [(-8.53, -0.3), (x_end, -0.3), (x_end, 0.9), (-8.53, DK + 0.9)], z0, z1, axis="z")
        b.bar(P["deck"], (-8.53, DK + 0.9, s * (GANGWAY + CHEEK / 2)), (x_end - 0.03, 0.9, s * (GANGWAY + CHEEK / 2)), CHEEK + 0.06, 0.08)
    C.end()
    for s in (-1, 1):
        for i in range(steps):
            C.col(-8.5 - (i + 0.5) * RUN, s * (GANGWAY + CHEEK / 2), RUN, CHEEK, DK + 0.9 - i * RISE, 0.0)
    # the wheelhouse: in by the aft door, windows forward and to the sides
    wx0, wx1, wz0, wz1, wh = HOUSE
    C.begin("wheelhouse", on="hull")
    t = 0.12
    b.box(P["house"], wx1 - wx0, wh, t, (wx0 + wx1) / 2, DK, wz0 + t / 2)
    b.box(P["house"], wx1 - wx0, wh, t, (wx0 + wx1) / 2, DK, wz1 - t / 2)
    b.box(P["house"], t, wh, wz1 - wz0, wx1 - t / 2, DK, 0)
    for (a, c) in ((wz0, -0.55), (0.55, wz1)):
        b.box(P["house"], t, wh, c - a, wx0 + t / 2, DK, (a + c) / 2)
    b.box(P["house"], t, wh - 1.95, 1.1, wx0 + t / 2, DK + 1.95, 0)
    b.box(P["cabin_win"], 0.02, 0.8, wz1 - wz0 - 0.6, wx1 - 0.04, DK + 1.1, 0)
    for zz in (wz0 + 0.04, wz1 - 0.04):
        b.box(P["cabin_win"], wx1 - wx0 - 1.2, 0.8, 0.02, (wx0 + wx1) / 2 + 0.3, DK + 1.1, zz)
    b.box(P["house_tr"], wx1 - wx0 + 0.4, 0.14, wz1 - wz0 + 0.4, (wx0 + wx1) / 2, DK + wh, 0, bevel=0.03)
    b.box(P["house_tr"], wx1 - wx0 + 0.1, 0.1, wz1 - wz0 + 0.1, (wx0 + wx1) / 2, DK - 0.02, 0)
    b.cyl(P["steel_dk"], 0.08, (wx1 - 0.6, DK + wh, 0.9), (wx1 - 0.6, DK + wh + 1.3, 0.9), seg=8)       # the exhaust
    b.cyl(P["pole"], 0.02, (wx0 + 0.5, DK + wh, -1.0), (wx0 + 0.5, DK + wh + 1.4, -1.0), seg=5)         # the aerial (under the arches)
    sphere(b, P["lamp"], (wx1 - 1.2, DK + wh + 0.3, 0.0), 0.16, seg=8, ring=5)
    C.end()
    C.col((wx0 + wx1) / 2, wz0 + t / 2, wx1 - wx0, t, wh, DK, 3)
    C.col((wx0 + wx1) / 2, wz1 - t / 2, wx1 - wx0, t, wh, DK, 3)
    C.col(wx1 - t / 2, 0, t, wz1 - wz0, wh, DK, 3)
    for (a, c) in ((wz0, -0.55), (0.55, wz1)):
        C.col(wx0 + t / 2, (a + c) / 2, t, c - a, wh, DK, 3)
    C.col((wx0 + wx1) / 2, 0, wx1 - wx0 + 0.4, wz1 - wz0 + 0.4, 0.14, DK + wh, 3)
    C.face("door:wheelhouse", "wheelhouse", (wx0 - 0.01, DK + 0.98, 0), (-1, 0), 1.1, 1.95)
    C.face("window:wheelhouse", "wheelhouse", (wx1 + 0.01, DK + 1.5, 0), (1, 0), wz1 - wz0 - 0.6, 0.8)
    C.begin("helm", on="wheelhouse")
    b.box(P["plank_dk"], 1.2, 0.9, 0.5, wx1 - 0.5, DK, 0.0)
    b.cyl(P["mast"], 0.03, (wx1 - 0.7, DK + 0.9, 0.0), (wx1 - 0.6, DK + 1.2, 0.0), seg=5)
    torus(b, P["plank_dk"], (wx1 - 0.62, DK + 1.35, 0.0), 0.32, 0.03, (0, 1, 0), (0, 0, 1), seg=16, tseg=5)
    for k in range(6):
        a = math.pi * k / 3
        b.bar(P["plank_dk"], (wx1 - 0.62, DK + 1.35, 0.0), (wx1 - 0.62, DK + 1.35 + 0.4 * math.sin(a), 0.4 * math.cos(a)), 0.025)
    b.box(P["radio"], 0.4, 0.22, 0.26, wx1 - 0.5, DK + 0.9, 1.0)
    b.box(P["led"], 0.2, 0.05, 0.02, wx1 - 0.5, DK + 1.0, 0.87)
    b.cyl(P["ink"], 0.015, (wx1 - 0.5, DK + 1.12, 1.1), (wx1 - 0.5, DK + 1.6, 1.1), seg=4)
    C.end()
    C.col(wx1 - 0.5, 0.0, 1.2, 0.5, 1.4, DK, 1)
    C.begin("stool", on="wheelhouse")
    b.cyl(P["steel"], 0.04, (wx0 + 1.2, DK, -0.9), (wx0 + 1.2, DK + 0.65, -0.9), seg=6)
    b.cyl(P["leather"], 0.2, (wx0 + 1.2, DK + 0.65, -0.9), (wx0 + 1.2, DK + 0.73, -0.9), seg=10)
    C.end()
    C.loot(wx0 + 1.4, DK, 0.9)
    # the mast with the sail and its blue mark, forward of the wheelhouse: the
    # tabernacle on the deck (the hull's), the rig in three GLBs that fold
    mx = MAST_X
    C.begin("hull")             # the tabernacle: a piece of the hull prop
    b.cyl(P["mast"], 0.18, (mx, DK, 0), (mx, DK + TABERNACLE, 0), seg=10, r2=0.17)
    for s_ in (-1, 1):
        b.box(P["steel_dk"], 0.5, TABERNACLE + 0.1, 0.06, mx, DK, s_ * 0.21)
    C.end()
    mast, sail, boom = (tf_kit.TFBuilder() for _ in range(3))
    mast.cyl(P["mast"], 0.17, (mx, DK + TABERNACLE, 0), (mx, DK + 17.0, 0), seg=10, r2=0.11)
    sphere(mast, P["lamp"], (mx, DK + 17.15, 0), 0.14, seg=8, ring=5)
    mast.bar(P["mast"], (mx, DK + 10.5, -1.5), (mx, DK + 10.5, 1.5), 0.09)
    for s_ in (-1, 1):
        mast.bar(P["ink"], (mx, DK + 16.7, 0), (mx, DK + 10.5, s_ * 1.5), 0.03)
    boom_y = BOOM_Y
    boom.cyl(P["mast"], 0.1, (mx - 0.2, boom_y, 0), (mx - 7.2, boom_y + 0.1, 0), seg=8)
    b = sail                    # the sail, its lines and its mark

    def leech(p, q, bulge, steps=6):
        out = []
        for i in range(1, steps):
            tt = i / steps
            x, y = p[0] + (q[0] - p[0]) * tt, p[1] + (q[1] - p[1]) * tt
            nx, ny = (q[1] - p[1]), -(q[0] - p[0])
            L = math.hypot(nx, ny)
            s = bulge * math.sin(math.pi * tt)
            out.append((x + nx / L * s, y + ny / L * s))
        return out
    main = [(mx - 0.25, boom_y + 0.15), (mx - 0.25, DK + 16.8)] + leech((mx - 0.25, DK + 16.8), (mx - 7.0, boom_y + 0.2), 0.5) + [(mx - 7.0, boom_y + 0.2)]
    b.prism(P["sail"], main, -0.03, 0.03, axis="z")
    for y in (DK + 8.0, DK + 11.5, DK + 14.5):
        xl = mx - 0.25 - 6.75 * (DK + 16.8 - y) / (DK + 16.8 - boom_y)
        b.bar(P["sail_line"], (mx - 0.3, y, 0), (xl + 0.15, y - 0.05, 0), 0.09, 0.05)
    blob = []
    for i in range(12):
        a = 2 * math.pi * i / 12
        r = 1.4 * (1 + 0.14 * math.sin(3 * a + 0.7) + rng.uniform(-0.05, 0.05))
        blob.append((mx - 3.4 + r * 1.1 * math.cos(a), DK + 9.0 + r * 0.85 * math.sin(a)))
    b.prism(P["logo"], blob, -0.045, 0.045, axis="z")
    b = C.b
    for (rig, name) in zip((mast, sail, boom), RIG_GLBS):
        rig.finish(name)
    C.col(mx, 0, 0.4, 0.4, TABERNACLE, DK, 1)
    # deck gear: the winch at the bow, barrels, nets, fish boxes, floats, the life ring, buoys
    C.begin("winch", on="hull")
    b.box(P["steel_dk"], 1.2, 0.25, 0.9, 10.2, DK, 0)
    b.cyl(P["steel"], 0.3, (10.2, DK + 0.6, -0.35), (10.2, DK + 0.6, 0.35), seg=12)
    for s in (-1, 1):
        b.box(P["steel_dk"], 0.5, 0.7, 0.1, 10.2, DK + 0.25, s * 0.42)
    b.cyl(P["rope"], 0.32, (10.2, DK + 0.6, -0.25), (10.2, DK + 0.6, 0.25), seg=12)
    b.cyl(P["steel_dk"], 0.06, (10.2, DK + 0.6, 0), (12.2, DK + 1.2, 0), seg=6)
    C.end()
    C.col(10.2, 0, 1.2, 0.9, 1.0, DK, 1)
    barrel(C, "boat-barrel0", -6.6, -1.9, DK)
    barrel(C, "boat-barrel1", -6.6, -1.2, DK, "barrel_y")
    C.begin("net-heap", on="hull")
    b.lump(P["net"], 2.2, 0.6, 1.6, -6.4, DK, 1.6, seed=400, rnd=0.5, jitter=0.2)
    for k in range(5):
        sphere(b, P["float_o"], (-7.2 + k * 0.4, DK + 0.55 + (k % 2) * 0.15, 1.9 - (k % 3) * 0.3), 0.14, seg=8, ring=5)
    C.end()
    C.col(-6.4, 1.6, 2.2, 1.6, 0.6, DK, 1)
    for k in range(3):
        C.begin(f"fishbox{k}", on="hull")
        x, z, y = 0.0 + (k % 2) * 0.1, 1.9, DK + k * 0.32
        b.box(P["fishbox"], 0.8, 0.3, 0.55, x, y, z, bevel=0.02)
        if k == 2:
            for j in range(3):
                b.lump(P["fish"], 0.5, 0.08, 0.14, x - 0.2 + j * 0.2, y + 0.3, z, seed=410 + j, rnd=0.5, jitter=0.1)
        C.end()
    C.col(0.05, 1.9, 0.9, 0.55, 1.0, DK, 1)
    C.begin("rope-coil", on="hull")
    torus(b, P["rope"], (-1.2, DK + 0.08, -1.9), 0.35, 0.08, (1, 0, 0), (0, 0, 1), seg=16, tseg=6)
    torus(b, P["rope"], (-1.2, DK + 0.22, -1.9), 0.3, 0.08, (1, 0, 0), (0, 0, 1), seg=16, tseg=6)
    C.end()
    C.begin("life-ring", on="wheelhouse")
    torus(b, P["ring"], (wx0 + 1.5, DK + 1.4, wz1 + 0.08), 0.32, 0.09, (1, 0, 0), (0, 1, 0), seg=16, tseg=6)
    for a in (0.4, 2.0, 3.5, 5.1):
        b.box(P["white"], 0.2, 0.2, 0.2, wx0 + 1.5 + 0.32 * math.cos(a), DK + 1.3 + 0.32 * math.sin(a), wz1 + 0.08)
    C.end()
    C.begin("buoys", on="hull")
    for k in range(4):
        x = -4.0 + k * 3.0
        b.cyl(P["rope"], 0.02, (x, DK + 0.85, -3.25), (x, DK + 0.2, -3.45), seg=4)
        sphere(b, P["buoy_r" if k % 2 else "buoy_w"], (x, DK + 0.1, -3.5), 0.26, seg=8, ring=5)
    C.end()
    # the hold: fish boxes, barrels, a lantern, loot
    for k in range(4):
        C.begin(f"hold-box{k}", on="hull")
        x, z, y = 6.0 + (k % 2) * 0.9, -1.8, HOLD_Y + (k // 2) * 0.32
        b.box(P["fishbox"], 0.8, 0.3, 0.55, x, y, z, bevel=0.02)
        C.end()
    C.col(6.45, -1.8, 1.8, 0.6, 0.64, HOLD_Y, 1)
    barrel(C, "hold-barrel0", 8.5, 1.6, HOLD_Y)
    barrel(C, "hold-barrel1", 8.5, 0.9, HOLD_Y, "barrel_y")
    crate(C, "hold-crate", -6.5, 1.6, HOLD_Y, 1.0, 0.1)
    C.begin("hold-net", on="hull")
    b.lump(P["net"], 1.8, 0.5, 1.4, 1.5, HOLD_Y, 1.7, seed=420, rnd=0.5, jitter=0.2)
    C.end()
    C.col(1.5, 1.7, 1.8, 1.4, 0.5, HOLD_Y, 1)
    C.begin("hold-lantern", on="hull")
    b.cyl(P["ink"], 0.015, (3.0, DK - 0.12, 0.0), (3.0, DK - 0.4, 0.0), seg=4)
    b.box(P["lantern"], 0.2, 0.26, 0.2, 3.0, DK - 0.66, 0.0)
    C.end()
    C.loot(3.5, HOLD_Y, -1.5)
    C.loot(-2.0, HOLD_Y, 1.0)
    C.loot(9.0, DK, 1.6)
    b.finish("tf-boat-p3.glb")


def boat_face(GLB, P):
    """The figurehead: the real trollface under the bowsprit, facing forward."""
    GLB.build_trollhead(P, width=1.3, res=60, front=0.5, back=0.0, carve=0.06, name="tf-boatface",
                        place=(12.95, DK - 0.3, 0.0, math.pi / 2, -0.35, 0.0),
                        colors=(0xe6d8b8, 0xd4c29c, 0x4a3a2a), moss_on=False)


# ============================================================== THE BRIDGE

BR_LEN = 55.8
BR_H = 0.66
ROOF_Y = BR_H + 3.0


def booth(C, pid, x, z, face_n):
    """A toll booth 2.2 square beside the deck: its window toward the deck,
    the door on the far side, a stool and the cash box inside."""
    b, P = C.b, C.P
    nx, nz = face_n
    win_side = "n" if nz < 0 else "s"
    door_side = "s" if nz < 0 else "n"
    box_shed(C, pid, x, z, 2.2, 2.2, 2.5, [(door_side, x, 0.9, 2.0)], [(win_side, x, 1.4, 1.0, 1.9)], "booth", "booth_lt")
    C.begin(f"{pid}-inside", on=pid)
    zz = z + nz * 0.55
    b.box(P["booth_lt"], 1.6, 0.05, 0.4, x, 0.95, zz)
    b.box(P["cash"], 0.4, 0.18, 0.3, x + 0.4, 1.0, zz)
    b.box(P["ink"], 0.36, 0.02, 0.02, x + 0.4, 1.18, zz + nz * 0.14)
    b.cyl(P["steel"], 0.04, (x - 0.3, 0.0, z - nz * 0.3), (x - 0.3, 0.65, z - nz * 0.3), seg=6)
    b.cyl(P["leather"], 0.2, (x - 0.3, 0.65, z - nz * 0.3), (x - 0.3, 0.73, z - nz * 0.3), seg=10)
    C.end()
    C.col(x, zz, 1.6, 0.4, 1.2, 0.9, 1)


def bridge_build(b, P, R, origin):
    C = Site(b, P, R, origin, 31)
    C.container = "bridge-deck"
    rng = C.rng
    H = BR_LEN / 2
    C.begin("bridge-deck")
    for s in (-1, 1):
        b.box(P["plank_dk"], 1.0, 0.33, 5.0, s * (H + 0.5), 0, 0, bevel=0.03)
        b.box(P["stone"], 1.8, 0.7, 6.0, s * (H - 0.4), -0.45, 0, bevel=0.05)
    x = -H + 0.02
    while x < H - 0.2:
        b.box(P["plank"], 0.27, 0.08, 5.0 + rng.uniform(-0.06, 0.06), x + 0.14, BR_H - 0.08, rng.uniform(-0.03, 0.03), ry=rng.uniform(-0.01, 0.01))
        x += 0.31
    for z in (-2.2, 0, 2.2):
        b.box(P["plank_dk"], BR_LEN, 0.3, 0.22, 0, 0.28, z)
    k = -H + 3.5
    while k < H - 2:
        for z in (-2.3, 2.3):
            b.cyl(P["pile"], 0.2, (k, -0.6, z), (k, 0.3, z), seg=8)
        b.box(P["plank_dk"], 0.35, 0.25, 5.4, k, 0.03, 0)
        b.bar(P["pile"], (k, -0.3, -2.3), (k, 0.25, 2.3), 0.12)
        k += 7.0
    C.end()
    C.col(-H - 0.5, 0, 1, 5, 0.33, 0, 3)
    C.col(H + 0.5, 0, 1, 5, 0.33, 0, 3)
    C.col(0, 0, BR_LEN, 5, BR_H, 0, 3)
    # the cover: posts every bay, the 1 m walls, the beams, the pitched roof, lanterns
    bays = 8
    C.begin("bridge-cover", on="bridge-deck")
    for i in range(bays + 1):
        x = -H + BR_LEN * i / bays
        for z in (-2.4, 2.4):
            b.box(P["plank_dk"], 0.22, ROOF_Y - BR_H, 0.22, x, BR_H, z, bevel=0.02)
        b.box(P["plank_dk"], 0.2, 0.22, 5.4, x, ROOF_Y - 0.22, 0)
        b.bar(P["plank_dk"], (x, ROOF_Y - 0.1, -2.4), (x, ROOF_Y + 1.1, 0), 0.12)
        b.bar(P["plank_dk"], (x, ROOF_Y - 0.1, 2.4), (x, ROOF_Y + 1.1, 0), 0.12)
        if 0 < i < bays:
            b.cyl(P["ink"], 0.015, (x, ROOF_Y - 0.22, 0), (x, ROOF_Y - 0.5, 0), seg=4)
            b.box(P["lantern"], 0.22, 0.3, 0.22, x, ROOF_Y - 0.8, 0)
    for z in (-2.4, 2.4):
        b.box(P["plank"], BR_LEN, 1.0, 0.15, 0, BR_H, z)
        b.box(P["plank_dk"], BR_LEN + 0.2, 0.08, 0.25, 0, BR_H + 1.0, z)
        b.box(P["plank_dk"], BR_LEN, 0.12, 0.12, 0, ROOF_Y - 0.12, z)
    rise = 1.2
    for s in (-1, 1):
        Lr = math.hypot(3.1, rise)
        b.box(P["shingle"], BR_LEN + 0.8, 0.08, Lr, 0, ROOF_Y + rise / 2 - 0.04, s * 1.55, rx=s * math.atan2(rise, 3.1))
    b.box(P["plank_dk"], BR_LEN + 0.9, 0.14, 0.3, 0, ROOF_Y + rise, 0)
    for s in (-1, 1):                                                          # the gables, boarded, with the sign board
        b.prism(P["plank"], [(-3.0, ROOF_Y), (3.0, ROOF_Y), (0.0, ROOF_Y + rise)], s * H - 0.02, s * H + 0.02, axis="x")
        b.box(P["board"], 0.12, 0.6, 2.6, s * (H + 0.08), ROOF_Y + 0.15, 0)
    C.end()
    for z in (-2.4, 2.4):
        C.col(0, z, BR_LEN, 0.22, 1.1, BR_H, 3)
    C.col(0, 0, BR_LEN + 0.8, 6.4, rise + 0.2, ROOF_Y, 3)
    for i in range(bays + 1):
        x = -H + BR_LEN * i / bays
        for z in (-2.4, 2.4):
            C.col(x, z, 0.22, 0.22, ROOF_Y - BR_H, BR_H, 1)
    for s in (-1, 1):
        C.sign("TOLL", s * (H + 0.15), ROOF_Y + 0.45, 0, s, 0, 2.4, 0.5, 0xf2cf4a)
        C.face(f"toll-sign{int(s > 0)}", "bridge-cover", (s * (H + 0.15), ROOF_Y + 0.45, 0), (s, 0), 2.4, 0.5)
    # the toll booths beside the deck at both ends, the barrier arms (raised), the bike
    booth(C, "booth-w", -H - 2.6, 4.2, (0, -1))
    booth(C, "booth-e", H + 2.6, 4.2, (0, -1))
    for s in (-1, 1):
        C.begin(f"barrier{int(s > 0)}")
        px = s * (H + 0.8)
        b.box(P["steel_dk"], 0.4, 1.2, 0.4, px, 0.0, 3.3, bevel=0.03)
        b.cyl(P["steel"], 0.06, (px, 1.1, 3.3), (px, 4.2, 3.3), seg=8)
        for k in range(6):
            b.box(P["hazard_y"] if k % 2 else P["white"], 0.14, 0.5, 0.14, px, 1.2 + k * 0.5, 3.3)
        C.end()
        C.col(px, 3.3, 0.4, 0.4, 4.2, 0, 1)
    C.begin("bike", on=("booth-w", "booth-w-inside"))
    bx, bz = -H - 2.6 - 1.4, 4.5
    for o in (-0.5, 0.5):
        torus(b, P["tyre"], (bx + o, 0.34, bz), 0.33, 0.04, (1, 0, 0), (0, 1, 0), seg=16, tseg=5)
    b.bar(P["bike"], (bx - 0.5, 0.34, bz), (bx + 0.1, 0.85, bz), 0.035)
    b.bar(P["bike"], (bx + 0.1, 0.85, bz), (bx + 0.5, 0.34, bz), 0.035)
    b.bar(P["bike"], (bx - 0.25, 0.9, bz), (bx - 0.5, 0.34, bz), 0.035)
    b.bar(P["bike"], (bx + 0.1, 0.85, bz), (bx - 0.25, 0.9, bz), 0.035)
    b.bar(P["steel"], (bx + 0.4, 0.95, bz - 0.25), (bx + 0.4, 0.95, bz + 0.25), 0.025)
    C.end()
    C.loot(0.0, BR_H, 0.0)
    b.finish("tf-bridge-p3.glb")


# ============================================================== the modules the build script takes

def _mod(fn):
    return SimpleNamespace(build=fn, palette=palette, LOOT=LOOT, SIGNS=SIGNS)


CAVE = _mod(cave_build)
DOCK = _mod(dock_build)
TREE = _mod(tree_build)
BOAT = _mod(boat_build)
BRIDGE = _mod(bridge_build)
