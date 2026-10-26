"""
The Skate Bowl (build_trollface_island.blender.py, phase 2): the park rebuilt
after trollface.io's art (a big grey pad with the kidney bowl, funboxes, a
quarter pipe, a rail and the bench row), in its own frame (the park's centre
at 0, 0; x east, z south; the map lays it at LANDMARKS.skate).

  the walled park as before (60 x 36, 1.1 m walls with steel coping and
  graffiti, the four gaps where they were), a lit SKATE sign on a gantry
  over the south gap
  the big bowl: a concrete block 22 x 15 with a 16 x 11 pool sunk in it,
  1.8 m deep at the lip, stairs up both ends of the deck
  the small bowl: 12 x 12 with a 9 x 9 pool, 1.2 m deep
  the half-pipe: 20 m along x in the south-east, decks 2.4 m up at both
  ends with stairs and rails
  the quarter pipe along the west wall, a funbox with kickers, two rails,
  a granite ledge, a manual pad
  the snack shack on the north rim (walk in by the east door, the counter
  under its hatch, the fridge, the menu board, stools behind the counter),
  the vending machine by it, the bleachers and the DJ table beside them
  skateboards on a rack, a BMX, cones, bins, benches, spray cans, the four
  flood lights

The bowls' and the ramps' faces are a smoothstep (flat at the lip and the
floor, steepest between): their colliders are 0.3 m steps a player walks up,
nested from the lip inward, so nothing in the park traps you.
"""
import math
import random

from map_kit import mat
from tf_city import flat, quad

WALL_H, WALL_T = 1.1, 0.5
PARK = (60.0, 36.0)
DOORS = [("s", -12, 6), ("w", 4, 6), ("e", 0, 6), ("n", 16, 5)]      # the map's K.room gaps
RISE, RUN = 0.3, 0.5
STEP = 0.3                    # a ramp collider's rise (under the 0.36 step-up)
LIFT = 0.035                  # a ramp's bottom sits this proud of the pad (no z-fight)

# cx, cz, block w, block d, lip w, lip d, depth, transition width
BIG_BOWL = (9.0, -4.0, 22.0, 15.0, 16.0, 11.0, 1.8, 3.6)
SMALL_BOWL = (-17.0, 8.0, 12.0, 12.0, 9.0, 9.0, 1.2, 2.4)
HALFPIPE = (3.0, 23.0, 11.0, 7.0, 2.4, 2.5, 4.5)       # x0, x1, cz, width, height, deck, transition
QUARTER = (-29.5, -14.0, -3.0, 1.5, 1.2, 3.0)          # x back, z0, z1, height, deck, transition
FUNBOX = (-14.0, -9.0, 6.0, 4.0, 0.9, 2.2)             # cx, cz, top length (x), width, height, kicker
SHACK = (17.0, -24.0, 8.0, 5.0, 2.8)                   # x, z, w, d, wall height; the hatch faces south

LOOT = []
SIGNS = []


def palette():
    return {
        "conc": mat("GS_Concrete", 0xffffff, 0.8),
        "conc_lt": mat("TF_SkateConcrete", 0xc9c9c4, 0.75),
        "conc_dk": mat("TF_SkateBowl", 0x9a9a98, 0.6),
        "tile": mat("TF_PoolTile", 0x2f7fc8, 0.3),
        "coping": mat("TF_Coping", 0xc8ccd0, 0.3, 0.8),
        "ink": mat("TF_Ink", 0x111114, 0.7),
        "paint_y": mat("TF_PaintYellow", 0xf2cf4a, 0.6),
        "paint_r": mat("TF_PaintRed", 0xe0463a, 0.6),
        "paint_b": mat("TF_PaintBlue", 0x3a8ef0, 0.6),
        "paint_g": mat("TF_PaintGreen", 0x57d24f, 0.6),
        "paint_p": mat("TF_PaintPink", 0xe0409a, 0.6),
        "bench": mat("TF_BenchYellow", 0xf2dc8a, 0.6),
        "steel": mat("TF_Steel", 0x6b7078, 0.5, 0.5),
        "pole": mat("TF_Pole", 0x2f3338, 0.5, 0.3),
        "lamp": mat("TF_Lamp", 0xfff6dc, 0.2, 0.0, 0xfff1d0, 1.2),
        "wood": mat("TF_Counter", 0x9a7b55, 0.7),
        "wood_dk": mat("TF_WoodDark", 0x5c4327, 0.75),
        "plank": mat("GS_Plank", 0xffffff, 0.8),
        "shack": mat("TF_ShackTeal", 0x3fb8a8, 0.6),
        "shack_dk": mat("TF_ShackTealDark", 0x2a8a7e, 0.6),
        "roof": mat("TF_Roof", 0x5d636c, 0.85),
        "red": mat("TF_AwnRed", 0xd23b2f, 0.7),
        "white": mat("TF_AwnWhite", 0xf2f2ee, 0.7),
        "board": mat("TF_SignBoard", 0x0c0d0e, 0.5),
        "fridge": mat("TF_Fridge", 0xe8ecef, 0.3, 0.3),
        "glass": mat("TF_ShopGlassLit", 0xbfe6ff, 0.15, 0.0, 0x6f90a8, 0.45),
        "screen": mat("TF_VendScreen", 0x7fe0ff, 0.3, 0.0, 0x5fc8f0, 0.9),
        "can_r": mat("TF_CanRed", 0xd83a3a, 0.4, 0.3),
        "can_b": mat("TF_CanBlue", 0x2f63e0, 0.4, 0.3),
        "can_g": mat("TF_CanGreen", 0x3fbf5a, 0.4, 0.3),
        "deck_a": mat("TF_DeckPink", 0xff5ca8, 0.6),
        "deck_b": mat("TF_DeckLime", 0xa8e04a, 0.6),
        "deck_c": mat("TF_DeckCyan", 0x4ad0e0, 0.6),
        "tyre": mat("TF_Tyre", 0x1a1a1c, 0.9),
        "cone": mat("TF_Cone", 0xff7a1a, 0.6),
        "bin": mat("TF_Bin", 0x2a4a2a, 0.6, 0.2),
        "speaker": mat("TF_Speaker", 0x1c1c20, 0.6),
        "vinyl": mat("TF_Vinyl", 0x0a0a0a, 0.3),
        "led": mat("TF_DJLed", 0xff5ca8, 0.3, 0.0, 0xff3a9a, 2.0),
        "snack_a": mat("TF_BoxGreen", 0x57d24f, 0.6),
        "snack_b": mat("TF_BoxPink", 0xff5ca8, 0.6),
        "snack_c": mat("TF_BoxBlue", 0x3a8ef0, 0.6),
        "leather": mat("TF_Leather", 0x5a2e2a, 0.5),
    }


class Park:
    def __init__(self, b, P, R, origin):
        self.b, self.P, self.R = b, P, R
        self.ox, self.oz = origin
        self.rng = random.Random(9)
        LOOT.clear()
        SIGNS.clear()

    def col(self, x, z, w, d, h, y=0.0, pen=3):
        if w > 0.02 and d > 0.02 and h > 0.02:
            self.R.collider(self.ox + x, self.oz + z, w, d, h, y, pen)

    def face(self, fid, owner, c, n, w, h):
        self.R.face(fid, owner, (self.ox + c[0], c[1], self.oz + c[2]), (n[0], 0.0, n[1]), w, h)

    def begin(self, pid, on=None):
        self.R.begin(self.b, pid, on)

    def end(self):
        self.R.end((self.ox, 0.0, self.oz))

    def loot(self, x, y, z):
        LOOT.append({"x": round(self.ox + x, 2), "z": round(self.oz + z, 2), "y": round(y, 2)})

    def sign(self, text, x, y, z, nx, nz, w, h, colour):
        SIGNS.append([text, round(self.ox + x, 2), round(y, 2), round(self.oz + z, 2), nx, nz, w, h, colour])


# ------------------------------------------------------------- ramp maths

def sstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def sstep_inv(y):
    """t in 0..1 with sstep(t) = y."""
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if sstep(mid) < y:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def levels(H, W):
    """The steps of a smoothstep face H high over W: [(top, reach)], each step
    from the lip (reach 0) in to `reach`, its top `top`; the last is the deck
    band itself (top H)."""
    n = max(1, round(H / STEP))
    out = []
    for k in range(1, n + 1):
        top = H * k / n
        mid = top - H / (2 * n)              # the step covers the face down to its mid-rise
        reach = W * sstep_inv(1 - mid / H)
        out.append((top, reach))
    return out


def stairs(C, m, x, z, dx, dz, from_y, to_y, w, pid=None):
    """Steps with the top at x, z, descending along dx, dz; their colliders."""
    b = C.b
    n = math.ceil((to_y - from_y) / RISE - 1e-6)
    for i in range(n):
        h = to_y - from_y - i * ((to_y - from_y) / n)
        along = (i + 0.5) * RUN
        sx = RUN if dx else w
        sz = RUN if dz else w
        b.box(m, sx, h, sz, x + dx * along, from_y, z + dz * along, bevel=0.02)
        C.col(x + dx * along, z + dz * along, sx, sz, h, from_y, 3)


def paint_strip(b, rng, paints, sx, sz, L, horiz, out_off, y_max):
    """Graffiti tags along one face of a wall (L long, centred at sx, sz)."""
    pos = -L / 2 + 0.3
    while True:
        w = rng.uniform(1.0, 3.4)
        if pos + w > L / 2 - 0.3:
            break
        if rng.random() < 0.7:
            h = rng.uniform(0.35, min(0.8, y_max - 0.12))
            y = rng.uniform(0.06, y_max - 0.06 - h)
            m = rng.choice(paints)
            if horiz:
                b.box(m, w, h, 0.03, sx + pos + w / 2, y, sz + out_off)
            else:
                b.box(m, 0.03, h, w, sx + out_off, y, sz + pos + w / 2)
        pos += w + rng.uniform(0.2, 1.2)


def orient(b, faces, n):
    """Turn each face so its normal points along n (the kit recalculates
    normals per face set, which a loose strip of quads can get backwards)."""
    import bmesh
    flip = [f for f in faces if f.normal.x * n[0] + f.normal.y * n[1] + f.normal.z * n[2] < 0]
    if flip:
        bmesh.ops.reverse_faces(b.bm, faces=flip)
    return faces


# ------------------------------------------------------------- the walls

def room_segments(w, d, doors, t=WALL_T):
    """GreyKit.room's wall boxes as (x, z, sx, sz, side), the map's maths."""
    out = []
    for side in ("n", "s", "e", "w"):
        horiz = side in ("n", "s")
        L = w if horiz else d
        gaps = sorted([(at - wd / 2, at + wd / 2) for (s, at, wd) in doors if s == side])
        cur = -L / 2
        for (g0, g1) in gaps + [(L / 2, L / 2)]:
            if g0 - cur > 0.01:
                mid, ln = (cur + g0) / 2, g0 - cur
                if horiz:
                    out.append((mid, -d / 2 if side == "n" else d / 2, ln, t, side))
                else:
                    out.append((w / 2 if side == "e" else -w / 2, mid, t, ln, side))
            cur = g1
    return out


def walls(C):
    b, P, rng = C.b, C.P, C.rng
    paints = [P["paint_y"], P["paint_r"], P["paint_b"], P["paint_g"], P["paint_p"]]
    for (sx, sz, ww, dd, side) in room_segments(*PARK, DOORS):
        C.begin("park-wall")
        horiz = side in ("n", "s")
        L = ww if horiz else dd
        b.box(P["conc"], ww, WALL_H, dd, sx, 0, sz, bevel=0.03)
        for o in (-0.22, 0.22):
            if horiz:
                b.cyl(P["coping"], 0.07, (sx - L / 2, WALL_H, sz + o), (sx + L / 2, WALL_H, sz + o), seg=8)
            else:
                b.cyl(P["coping"], 0.07, (sx + o, WALL_H, sz - L / 2), (sx + o, WALL_H, sz + L / 2), seg=8)
        for out in (-1, 1):
            paint_strip(b, rng, paints, sx, sz, L, horiz, out * 0.26, WALL_H)
        C.end()
        C.col(sx, sz, ww, dd, WALL_H, 0, 3)


def floor(C):
    """The pad: light concrete in bays with dark joints (the map's plaza
    patch is under it), a painted start line by the south gap."""
    b, P = C.b, C.P
    w, d = PARK
    b.box(P["conc_lt"], w - 0.6, 0.03, d - 0.6, 0, 0.0, 0)
    for k in range(1, 10):
        x = -w / 2 + k * w / 10
        flat(b, P["conc_dk"], x, 0.032, 0, 0.06, d - 0.8)
    for k in range(1, 6):
        z = -d / 2 + k * d / 6
        flat(b, P["conc_dk"], 0, 0.032, z, w - 0.8, 0.06)


# ------------------------------------------------------------- bowls and ramps

def pool(C, pid, spec, stair_ends):
    """A concrete block with a pool sunk in its top: the deck band round the
    lip, the smoothstep dish, the coping, graffiti on the block's sides.
    stair_ends: [(side, at)] where a flight comes up onto the deck."""
    b, P, rng = C.b, C.P, C.rng
    cx, cz, bw, bd, lw, ld, H, W = spec
    x0, x1, z0, z1 = cx - lw / 2, cx + lw / 2, cz - ld / 2, cz + ld / 2
    C.begin(pid)
    # the deck band, four boxes round the lip
    for (x, z, w, d) in ((cx, cz - (bd + ld) / 4, bw, (bd - ld) / 2), (cx, cz + (bd + ld) / 4, bw, (bd - ld) / 2),
                         (cx - (bw + lw) / 4, cz, (bw - lw) / 2, ld), (cx + (bw + lw) / 4, cz, (bw - lw) / 2, ld)):
        b.box(P["conc"], w, H, d, x, 0, z)
    # the dish: a 0.5 m grid over the lip, height from the nearest edge
    nx, nz = max(2, round(lw / 0.5)), max(2, round(ld / 0.5))
    pts, faces = [], []
    for j in range(nz + 1):
        for i in range(nx + 1):
            x, z = x0 + lw * i / nx, z0 + ld * j / nz
            e = min(x - x0, x1 - x, z - z0, z1 - z)
            pts.append((x, LIFT + (H - LIFT) * (1 - sstep(e / W)), z))
    lip = []
    for j in range(nz):
        for i in range(nx):
            a = j * (nx + 1) + i
            q = [a, a + nx + 1, a + nx + 2, a + 1]
            (lip if all(pts[k][1] > H - 0.12 for k in q) else faces).append(q)
    for f in orient(b, b.poly(P["conc_dk"], pts, faces), (0, 1, 0)):
        f.smooth = True
    orient(b, b.poly(P["tile"], pts, lip), (0, 1, 0))       # the pool tiles under the coping
    for (ax, az, bx, bz) in ((x0, z0, x1, z0), (x1, z0, x1, z1), (x1, z1, x0, z1), (x0, z1, x0, z0)):
        b.cyl(P["coping"], 0.07, (ax, H, az), (bx, H, bz), seg=8)
    # tags on the block's outer faces, away from the stairs
    paints = [P["paint_y"], P["paint_r"], P["paint_b"], P["paint_p"]]
    for (side, sx, sz, L, horiz, off) in (("n", cx, cz - bd / 2, bw, True, -0.02), ("s", cx, cz + bd / 2, bw, True, 0.02),
                                          ("w", cx - bw / 2, cz, bd, False, -0.02), ("e", cx + bw / 2, cz, bd, False, 0.02)):
        if any(s == side for s, _ in stair_ends):
            continue
        paint_strip(b, rng, paints, sx, sz, L, horiz, off, H)
    C.end()
    # colliders: the deck band reaches in to its own step's edge; inside
    # it the steps nest from the lip
    lv = levels(H, W)
    top, reach = lv[-1]
    for (x, z, w, d) in ((cx, cz - (bd + ld) / 4 + reach / 2, bw, (bd - ld) / 2 + reach), (cx, cz + (bd + ld) / 4 - reach / 2, bw, (bd - ld) / 2 + reach),
                         (cx - (bw + lw) / 4 + reach / 2, cz, (bw - lw) / 2 + reach, ld), (cx + (bw + lw) / 4 - reach / 2, cz, (bw - lw) / 2 + reach, ld)):
        C.col(x, z, w, d, H, 0, 3)
    for (t, r) in lv[:-1]:
        C.col(cx, z0 + r / 2, lw, r, t, 0, 3)
        C.col(cx, z1 - r / 2, lw, r, t, 0, 3)
        C.col(x0 + r / 2, cz, r, ld, t, 0, 3)
        C.col(x1 - r / 2, cz, r, ld, t, 0, 3)


def profile_block(C, m_top, m_side, xs, hs, z0, z1, ends=(True, True)):
    """A ramp drawn as a profile along x (samples xs, heights hs) extruded
    from z0 to z1: the top, both sides, the end walls."""
    b = C.b
    n = len(xs)
    pts = [(xs[i], hs[i], z0) for i in range(n)] + [(xs[i], hs[i], z1) for i in range(n)]
    tops = [[i, i + n, i + n + 1, i + 1] for i in range(n - 1)]
    for f in orient(b, b.poly(m_top, pts, tops), (0, 1, 0)):
        f.smooth = True
    for z, nz in ((z0, -1), (z1, 1)):
        pts_s, f_s = [], []
        for i in range(n - 1):
            if hs[i] < 0.01 and hs[i + 1] < 0.01:
                continue
            k = len(pts_s)
            pts_s += [(xs[i], 0.0, z), (xs[i + 1], 0.0, z), (xs[i + 1], hs[i + 1], z), (xs[i], hs[i], z)]
            f_s.append([k, k + 1, k + 2, k + 3])
        orient(b, b.poly(m_side, pts_s, f_s), (0, 0, nz))
    for i, on, nx in ((0, ends[0], -1), (n - 1, ends[1], 1)):
        if on and hs[i] > 0.01:
            orient(b, b.poly(m_side, [(xs[i], 0.0, z0), (xs[i], 0.0, z1), (xs[i], hs[i], z1), (xs[i], hs[i], z0)], [[0, 1, 2, 3]]), (nx, 0, 0))


def halfpipe(C):
    b, P = C.b, C.P
    x0, x1, cz, wd, H, dl, W = HALFPIPE
    z0, z1 = cz - wd / 2, cz + wd / 2

    def h(x):
        e = min(x - x0 - dl, x1 - dl - x)
        return H if e <= 0 else H * (1 - sstep(e / W))
    xs = [x0, x0 + dl]
    x = x0 + dl
    while x < x1 - dl - 1e-6:
        x = min(x + 0.25, x1 - dl)
        xs.append(x)
    xs.append(x1)
    C.begin("halfpipe")
    profile_block(C, P["conc_dk"], P["conc"], xs, [max(LIFT, h(x)) for x in xs], z0, z1)
    for x in (x0 + dl, x1 - dl):
        b.cyl(P["coping"], 0.07, (x, H, z0), (x, H, z1), seg=8)
    # deck rails along both sides of each deck (the stairs come up the ends)
    for (a, c) in ((x0, x0 + dl), (x1 - dl, x1)):
        for z in (z0 + 0.06, z1 - 0.06):
            b.cyl(P["steel"], 0.035, (a + 0.1, H + 1.0, z), (c - 0.1, H + 1.0, z), seg=6)
            for px in (a + 0.1, c - 0.1):
                b.cyl(P["steel"], 0.03, (px, H, z), (px, H + 1.0, z), seg=6)
    C.end()
    lv = levels(H, W)
    for (t, r) in lv:
        reach = dl + r
        C.col(x0 + reach / 2, cz, reach, wd, t, 0, 3)
        C.col(x1 - reach / 2, cz, reach, wd, t, 0, 3)
    for (a, c) in ((x0, x0 + dl), (x1 - dl, x1)):
        for z in (z0 + 0.06, z1 - 0.06):
            C.col((a + c) / 2, z, c - a, 0.12, 1.0, H, 1)
    stairs(C, P["conc"], x0, cz, -1, 0, 0, H, 2.0)
    stairs(C, P["conc"], x1, cz, 1, 0, 0, H, 2.0)
    C.loot(x0 + dl / 2, H, cz)
    C.loot(x1 - dl / 2, H, cz)


def quarter(C):
    b, P = C.b, C.P
    xb, z0, z1, H, dl, W = QUARTER
    xs = [xb, xb + dl]
    x = xb + dl
    while x < xb + dl + W - 1e-6:
        x = min(x + 0.25, xb + dl + W)
        xs.append(x)
    hs = [H if x <= xb + dl + 1e-6 else max(LIFT, H * (1 - sstep((x - xb - dl) / W))) for x in xs]
    C.begin("quarter")
    profile_block(C, P["conc_dk"], P["conc"], xs, hs, z0, z1, ends=(True, False))
    b.cyl(P["coping"], 0.07, (xb + dl, H, z0), (xb + dl, H, z1), seg=8)
    C.end()
    for (t, r) in levels(H, W):
        C.col(xb + (dl + r) / 2, (z0 + z1) / 2, dl + r, z1 - z0, t, 0, 3)


def funbox(C):
    """A painted box with a kicker up each end and a rail along its top."""
    b, P = C.b, C.P
    cx, cz, L, wd, H, K = FUNBOX
    a0, a1 = cx - L / 2 - K, cx + L / 2 + K
    z0, z1 = cz - wd / 2, cz + wd / 2

    def h(x):
        e = min(x - a0, a1 - x)
        return H * sstep(e / K)
    xs = []
    x = a0
    while x < a1 - 1e-6:
        xs.append(x)
        x += 0.25
    xs.append(a1)
    C.begin("funbox")
    profile_block(C, P["conc"], P["paint_b"], xs, [h(x) for x in xs], z0, z1)
    for z in (z0, z1):
        b.cyl(P["coping"], 0.05, (cx - L / 2, H, z), (cx + L / 2, H, z), seg=6)
    b.cyl(P["paint_y"], 0.05, (cx - L / 2 + 0.4, H + 0.42, cz), (cx + L / 2 - 0.4, H + 0.42, cz), seg=8)
    for px in (cx - L / 2 + 0.6, cx + L / 2 - 0.6):
        b.cyl(P["coping"], 0.04, (px, H, cz), (px, H + 0.42, cz), seg=6)
    C.end()
    for (t, r) in levels(H, K):
        # a kicker rises the other way: from the floor (reach 0 at the
        # outer end) up to the top; the step for `t` starts where h = t - half
        n = len(levels(H, K))
        e = K * sstep_inv((t - H / (2 * n)) / H)
        C.col(cx, cz, (a1 - a0) - 2 * e, wd, t, 0, 3)
    C.col(cx, cz, L - 0.8, 0.1, 0.42, H, 1)


def rail(C, pid, x, z, L, along_x=True, y=0.62):
    b, P = C.b, C.P
    C.begin(pid)
    if along_x:
        b.cyl(P["paint_y"], 0.06, (x - L / 2, y, z), (x + L / 2, y, z), seg=10)
    else:
        b.cyl(P["paint_y"], 0.06, (x, y, z - L / 2), (x, y, z + L / 2), seg=10)
    for k in range(3):
        o = -L / 2 + 0.6 + k * (L - 1.2) / 2
        px, pz = (x + o, z) if along_x else (x, z + o)
        b.cyl(P["coping"], 0.045, (px, 0, pz), (px, y - 0.04, pz), seg=6)
        b.box(P["coping"], 0.3, 0.02, 0.3, px, 0, pz)
    C.end()
    C.col(x, z, L if along_x else 0.14, 0.14 if along_x else L, y + 0.06, 0, 1)


def ledge(C, pid, x, z, w, d, h, colour):
    b, P = C.b, C.P
    C.begin(pid)
    b.box(P["conc"], w, h, d, x, 0, z, bevel=0.03)
    b.box(P[colour], w + 0.03, h * 0.4, d + 0.03, x, h * 0.1, z)
    if w > d:
        for s in (-1, 1):
            b.bar(P["coping"], (x - w / 2, h - 0.02, z + s * (d / 2 - 0.03)), (x + w / 2, h - 0.02, z + s * (d / 2 - 0.03)), 0.08)
    else:
        for s in (-1, 1):
            b.bar(P["coping"], (x + s * (w / 2 - 0.03), h - 0.02, z - d / 2), (x + s * (w / 2 - 0.03), h - 0.02, z + d / 2), 0.08)
    C.end()
    C.col(x, z, w, d, h, 0, 3)


# ------------------------------------------------------------- the north rim

def bleachers(C):
    b, P = C.b, C.P
    C.begin("bleachers")
    for t in range(3):
        z = -19.5 - t * 1.4
        top = 0.66 * (t + 1)
        b.box(P["conc"], 26, top, 1.4, -6, 0, z)
        b.box(P["bench"], 25.6, 0.07, 0.6, -6, top, z + 0.3)
        C.col(-6, z, 26, 1.4, top, 0, 3)
    for k in range(9):
        x = -18.5 + k * 3.125
        b.cyl(P["steel"], 0.05, (x, 1.98, -23.0), (x, 2.95, -23.0), seg=8)
    b.cyl(P["steel"], 0.06, (-18.6, 2.95, -23.0), (6.6, 2.95, -23.0), seg=8)
    C.end()
    C.col(-6, -23.0, 25.2, 0.12, 0.97, 1.98, 1)
    C.loot(-12.0, 1.98, -22.3)


def dj_table(C, x, z):
    """Two decks and a mixer on a trestle, a speaker stack each side, facing
    the park (south)."""
    b, P = C.b, C.P
    C.begin("dj-table")
    b.box(P["ink"], 2.4, 0.06, 0.9, x, 0.92, z)
    for sx in (-1.0, 1.0):
        b.box(P["steel"], 0.06, 0.92, 0.8, x + sx, 0, z)
    for sx in (-0.65, 0.65):
        b.box(P["speaker"], 0.6, 0.1, 0.55, x + sx, 0.98, z)
        b.cyl(P["vinyl"], 0.2, (x + sx, 1.08, z), (x + sx, 1.1, z), seg=16)
    b.box(P["speaker"], 0.45, 0.12, 0.4, x, 0.98, z)
    b.box(P["led"], 0.4, 0.02, 0.05, x, 1.1, z + 0.12)
    b.box(P["led"], 2.3, 0.04, 0.02, x, 0.88, z + 0.46)
    C.end()
    C.col(x, z, 2.4, 0.9, 1.0, 0, 1)
    for sx in (-1.75, 1.75):
        C.begin(f"speaker{int(sx > 0)}")
        b.box(P["speaker"], 0.8, 1.6, 0.7, x + sx, 0, z, bevel=0.03)
        for y in (0.45, 1.15):
            b.cyl(P["ink"], 0.24, (x + sx, y, z + 0.35), (x + sx, y, z + 0.37), seg=14)
            b.cyl(P["steel"], 0.07, (x + sx, y, z + 0.37), (x + sx, y, z + 0.39), seg=8)
        C.end()
        C.col(x + sx, z, 0.8, 0.7, 1.6, 0, 1)


def shack(C):
    """Walk in by the east door; the hatch over the counter looks south onto
    the park; the menu board on the back wall, the fridge in the corner."""
    b, P = C.b, C.P
    x, z, w, d, H = SHACK
    t = 0.2
    zs, zn = z + d / 2, z - d / 2           # the south (hatch) and north walls
    xw, xe = x - w / 2, x + w / 2
    hx0, hx1, hy0, hy1 = x - 2.6, x + 2.6, 1.0, 2.2      # the hatch
    dz0, dz1 = z - 0.3, z + 1.0                           # the east door (z), 2.2 high
    C.begin("shack")
    # walls: south with the hatch, north solid, west solid, east with the door
    b.box(P["shack"], w, hy0, t, x, 0, zs - t / 2)
    b.box(P["shack"], w, H - hy1, t, x, hy1, zs - t / 2)
    for (a, c) in ((xw, hx0), (hx1, xe)):
        b.box(P["shack"], c - a, hy1 - hy0, t, (a + c) / 2, hy0, zs - t / 2)
    b.box(P["shack"], w, H, t, x, 0, zn + t / 2)
    b.box(P["shack"], t, H, d - 2 * t, xw + t / 2, 0, z)
    for (a, c) in ((zn + t, dz0), (dz1, zs - t)):
        b.box(P["shack"], t, H, c - a, xe - t / 2, 0, (a + c) / 2)
    b.box(P["shack"], t, H - 2.2, dz1 - dz0, xe - t / 2, 2.2, (dz0 + dz1) / 2)
    for (px, pz, pw, pd) in ((x, zn, w + 0.1, 0.1), (x, zs, w + 0.1, 0.1), (xw, z, 0.1, d), (xe, z, 0.1, d)):   # the plinth band
        if pw > 1 or abs(px - xe) > 0.01:
            b.box(P["shack_dk"], pw, 0.35, pd, px, 0, pz)
        else:
            for (a, c) in ((zn, dz0), (dz1, zs)):
                b.box(P["shack_dk"], pw, 0.35, c - a, px, 0, (a + c) / 2)
    b.box(P["plank"], w - 2 * t, 0.03, d - 2 * t, x, 0.0, z)                     # the floor boards
    for (a, c) in ((zn, zs),):
        for xx in (xw, xe):
            b.box(P["ink"], 0.08, H, 0.08, xx, 0, a)
            b.box(P["ink"], 0.08, H, 0.08, xx, 0, c)
    # the roof, overhanging the hatch, and a striped awning over it
    b.box(P["roof"], w + 0.8, 0.18, d + 1.4, x, H, z + 0.3)
    b.box(P["board"], w * 0.62, 0.55, 0.12, x, H + 0.18, zs + 0.92)            # the sign board (lettered by the map)
    n = 8
    for k in range(n):
        sx = hx0 + (hx1 - hx0) * (k + 0.5) / n
        b.box(P["red"] if k % 2 == 0 else P["white"], (hx1 - hx0) / n, 0.04, 1.0, sx, 2.32, zs + 0.45, rx=0.35)
    # the counter: inside under the hatch, a shelf outside it
    b.box(P["wood"], hx1 - hx0 + 0.4, 0.06, 0.7, x, hy0 - 0.06, zs - t - 0.35)
    b.box(P["wood_dk"], hx1 - hx0 + 0.4, hy0 - 0.06, 0.6, x, 0, zs - t - 0.4)
    b.box(P["wood"], hx1 - hx0, 0.05, 0.3, x, hy0, zs + 0.15)
    for k in range(5):                                                         # snacks on the counter
        sx = hx0 + 0.6 + k * 0.95
        b.box(P[("snack_a", "snack_b", "snack_c")[k % 3]], 0.32, 0.22, 0.22, sx, hy0, zs - t - 0.45)
    b.box(P["glass"], 0.5, 0.45, 0.4, x + 1.9, hy0, zs - t - 0.4)                # the hot cabinet
    C.end()
    C.col(x, zs - t / 2, w, t, hy0, 0, 3)
    C.col(x, zs - t / 2, w, t, H - hy1, hy1, 3)
    for (a, c) in ((xw, hx0), (hx1, xe)):
        C.col((a + c) / 2, zs - t / 2, c - a, t, hy1 - hy0, hy0, 3)
    C.col(x, zn + t / 2, w, t, H, 0, 3)
    C.col(xw + t / 2, z, t, d - 2 * t, H, 0, 3)
    for (a, c) in ((zn + t, dz0), (dz1, zs - t)):
        C.col(xe - t / 2, (a + c) / 2, t, c - a, H, 0, 3)
    C.col(x, z + 0.3, w + 0.8, d + 1.4, 0.18, H, 3)
    C.face("door:shack", "shack", (xe + 0.01, 1.1, (dz0 + dz1) / 2), (1, 0), dz1 - dz0, 2.2)
    C.col(x, zs - t - 0.4, hx1 - hx0 + 0.4, 0.7, hy0, 0, 1)
    C.sign("SNACKS", x, H + 0.455, zs + 0.98, 0, 1, w * 0.6, 0.5, 0xf2cf4a)
    C.face("snacks-sign", "shack", (x, H + 0.455, zs + 0.98), (0, 1), w * 0.6, 0.5)
    # inside: the fridge in the north-west corner, the menu board on the
    # back wall over a low prep counter, two stools behind the counter
    C.begin("shack-fridge", on="shack")
    b.box(P["fridge"], 0.9, 2.0, 0.7, xw + t + 0.5, 0, zn + t + 0.4, bevel=0.02)
    b.box(P["glass"], 0.7, 1.3, 0.02, xw + t + 0.5, 0.5, zn + t + 0.76)
    for k in range(3):
        for j in range(4):
            b.cyl(P[("can_r", "can_b", "can_g")[(j + k) % 3]], 0.04, (xw + t + 0.25 + j * 0.16, 0.6 + k * 0.4, zn + t + 0.6), (xw + t + 0.25 + j * 0.16, 0.74 + k * 0.4, zn + t + 0.6), seg=6)
    C.end()
    C.col(xw + t + 0.5, zn + t + 0.4, 0.9, 0.7, 2.0, 0, 1)
    C.begin("shack-prep", on="shack")
    b.box(P["wood_dk"], 3.0, 0.9, 0.55, x + 0.6, 0, zn + t + 0.3)
    b.box(P["steel"], 0.9, 0.05, 0.45, x - 0.2, 0.9, zn + t + 0.3)              # the hotplate
    C.end()
    C.col(x + 0.6, zn + t + 0.3, 3.0, 0.55, 0.9, 0, 1)
    C.begin("shack-menu", on="shack")
    b.box(P["board"], 2.6, 1.1, 0.05, x + 0.6, 1.45, zn + t + 0.025)
    C.end()
    C.sign("MENU", x + 0.6, 2.0, zn + t + 0.06, 0, 1, 2.4, 1.0, 0x7fe0ff)
    C.face("shack-menu", "shack", (x + 0.6, 2.0, zn + t + 0.06), (0, 1), 2.4, 1.0)
    for k, sx in enumerate((x - 1.6, x + 1.0)):
        C.begin(f"stool{k}", on="shack")
        b.cyl(P["steel"], 0.04, (sx, 0, zs - 1.25), (sx, 0.7, zs - 1.25), seg=6)
        b.cyl(P["leather"], 0.2, (sx, 0.7, zs - 1.25), (sx, 0.78, zs - 1.25), seg=12)
        C.end()
    C.loot(x - 1.0, 0.0, z - 0.4)


def vending(C, x, z):
    b, P = C.b, C.P
    C.begin("vending")
    b.box(P["paint_r"], 1.0, 1.9, 0.8, x, 0, z, bevel=0.03)
    b.box(P["screen"], 0.62, 1.2, 0.02, x - 0.1, 0.5, z + 0.41)
    b.box(P["ink"], 0.2, 0.5, 0.02, x + 0.34, 0.9, z + 0.41)
    b.box(P["ink"], 0.6, 0.2, 0.03, x - 0.1, 0.18, z + 0.41)
    C.end()
    C.col(x, z, 1.0, 0.8, 1.9, 0, 1)
    C.face("vending-front", "vending", (x - 0.1, 1.1, z + 0.43), (0, 1), 0.62, 1.2)


def board_rack(C, x, z):
    """Five decks stood in a rack against the north wall's inside face."""
    b, P = C.b, C.P
    C.begin("board-rack")
    b.box(P["steel"], 2.4, 0.06, 0.4, x, 0.0, z)
    b.box(P["steel"], 2.4, 0.06, 0.06, x, 0.9, z - 0.17)
    for k in range(5):
        sx = x - 0.96 + k * 0.48
        b.box(P[("deck_a", "deck_b", "deck_c")[k % 3]], 0.22, 0.82, 0.03, sx, 0.08, z - 0.1, rx=-0.2)
        for wy in (0.18, 0.78):
            b.box(P["white"], 0.18, 0.05, 0.05, sx, wy, z - 0.02)
    C.end()
    C.col(x, z, 2.4, 0.4, 0.95, 0, 1)


def bmx(C, x, z, ry):
    b, P = C.b, C.P
    c, s = math.cos(ry), math.sin(ry)
    C.begin("bmx")
    for o in (-0.5, 0.5):
        wx, wz = x + o * c, z - o * s
        b.cyl(P["tyre"], 0.26, (wx + s * 0.03, 0.27, wz + c * 0.03), (wx - s * 0.03, 0.27, wz - c * 0.03), seg=14)
    b.bar(P["paint_p"], (x - 0.5 * c, 0.27, z + 0.5 * s), (x + 0.1 * c, 0.6, z - 0.1 * s), 0.04)
    b.bar(P["paint_p"], (x + 0.1 * c, 0.6, z - 0.1 * s), (x + 0.5 * c, 0.27, z - 0.5 * s), 0.04)
    b.bar(P["paint_p"], (x - 0.25 * c, 0.7, z + 0.25 * s), (x - 0.5 * c, 0.27, z + 0.5 * s), 0.04)
    b.bar(P["steel"], (x + 0.42 * c, 0.85, z - 0.42 * s + 0.25), (x + 0.42 * c, 0.85, z - 0.42 * s - 0.25), 0.03)
    C.end()


def cone(C, pid, x, z):
    b, P = C.b, C.P
    C.begin(pid)
    b.box(P["cone"], 0.36, 0.03, 0.36, x, 0, z)
    b.cyl(P["cone"], 0.14, (x, 0.03, z), (x, 0.5, z), seg=10, r2=0.025)
    b.cyl(P["white"], 0.1, (x, 0.22, z), (x, 0.3, z), seg=10, r2=0.085)
    C.end()


def bin_(C, pid, x, z):
    b, P = C.b, C.P
    C.begin(pid)
    b.cyl(P["bin"], 0.3, (x, 0, z), (x, 0.9, z), seg=12)
    b.cyl(P["ink"], 0.32, (x, 0.9, z), (x, 0.96, z), seg=12)
    C.end()
    C.col(x, z, 0.6, 0.6, 0.96, 0, 1)


def bench(C, pid, x, z):
    b, P = C.b, C.P
    C.begin(pid)
    b.box(P["bench"], 2.2, 0.1, 0.5, x, 0.42, z, bevel=0.02)
    for sx in (-0.9, 0.9):
        b.box(P["steel"], 0.08, 0.42, 0.42, x + sx, 0, z)
    C.end()
    C.col(x, z, 2.2, 0.5, 0.52, 0, 1)


def cans(C, pid, x, z, seed):
    b, P = C.b, C.P
    rng = random.Random(seed)
    C.begin(pid)
    for k in range(4):
        cx, cz = x + rng.uniform(-0.35, 0.35), z + rng.uniform(-0.35, 0.35)
        m = P[("can_r", "can_b", "can_g", "paint_y")[k]]
        if k == 3:
            b.cyl(m, 0.035, (cx, 0.035, cz), (cx + 0.2, 0.035, cz + 0.05), seg=8)         # one on its side
        else:
            b.cyl(m, 0.035, (cx, 0, cz), (cx, 0.2, cz), seg=8)
            b.cyl(P["white"], 0.02, (cx, 0.2, cz), (cx, 0.23, cz), seg=6)
    C.end()


def flood(C, k, x, z, ry):
    b, P = C.b, C.P
    C.begin(f"flood{k}")
    b.cyl(P["pole"], 0.13, (x, 0, z), (x, 8.0, z), seg=8, r2=0.09)
    b.box(P["pole"], 1.4, 0.25, 0.5, x, 8.0, z, ry=ry)
    b.box(P["lamp"], 1.2, 0.05, 0.4, x, 7.97, z, ry=ry)
    C.end()
    C.col(x, z, 0.3, 0.3, 8.0, 0, 3)


def gantry(C):
    """The SKATE sign over the south gap, on two posts beside it."""
    b, P = C.b, C.P
    gx = DOORS[0][1]
    z = PARK[1] / 2 + 0.6
    C.begin("gantry")
    for sx in (-3.6, 3.6):
        b.box(P["steel"], 0.2, 4.2, 0.2, gx + sx, 0, z)
        b.box(P["steel"], 0.5, 0.1, 0.5, gx + sx, 0, z)
    b.box(P["steel"], 7.4, 0.18, 0.2, gx, 4.0, z)
    b.box(P["board"], 5.2, 1.0, 0.16, gx, 2.95, z)
    C.end()
    for sx in (-3.6, 3.6):
        C.col(gx + sx, z, 0.2, 0.2, 4.2, 0, 1)
    C.col(gx, z, 7.4, 0.2, 1.23, 2.95, 1)
    C.sign("SKATE", gx, 3.45, z + 0.09, 0, 1, 5.0, 0.9, 0xff5ca8)
    C.face("skate-sign", "gantry", (gx, 3.45, z + 0.09), (0, 1), 5.0, 0.9)


# ------------------------------------------------------------- the build

def build(b, P, R, origin):
    C = Park(b, P, R, origin)
    floor(C)
    walls(C)
    pool(C, "big-bowl", BIG_BOWL, [("w", 0), ("e", 0)])
    cx, cz, bw, bd, lw, ld, H, W = BIG_BOWL
    stairs(C, P["conc"], cx - bw / 2, cz, -1, 0, 0, H, 2.0)
    stairs(C, P["conc"], cx + bw / 2, cz, 1, 0, 0, H, 2.0)
    C.loot(cx, H, cz - (bd + ld) / 4)
    C.loot(cx, H, cz + (bd + ld) / 4)
    pool(C, "small-bowl", SMALL_BOWL, [("e", 0)])
    cx, cz, bw, bd, lw, ld, H, W = SMALL_BOWL
    stairs(C, P["conc"], cx + bw / 2, cz, 1, 0, 0, H, 2.0)
    C.loot(cx, H, cz - (bd + ld) / 4)
    halfpipe(C)
    quarter(C)
    funbox(C)
    rail(C, "rail-north", 2.0, -14.6, 10.0)
    rail(C, "rail-south", -6.0, 15.6, 8.0)
    ledge(C, "ledge-granite", 25.0, -7.5, 2.0, 6.0, 0.6, "paint_p")
    ledge(C, "ledge-manual", -2.5, 5.0, 5.0, 2.0, 0.3, "paint_g")
    # the north rim: bleachers, the DJ table, the shack and the vending machine
    bleachers(C)
    dj_table(C, 10.0, -21.4)
    shack(C)
    vending(C, 11.9, -25.6)
    bmx(C, 15.0, -27.4, 0.0)
    board_rack(C, 24.0, -17.25)
    # the small stuff on the flat
    for k, (x, z) in enumerate(((-25.0, -0.8), (-22.0, -0.8), (-19.0, -0.8), (-16.0, -0.8))):
        cone(C, f"cone{k}", x, z)
    bin_(C, "bin-south", -16.4, 16.9)
    bin_(C, "bin-east", 29.0, 3.9)
    bin_(C, "bin-north", 12.2, -17.1)
    bench(C, "bench-a", -20.0, 16.9)
    bench(C, "bench-b", 0.5, 16.9)
    cans(C, "cans-a", 27.2, -9.8, 11)
    cans(C, "cans-b", -9.6, 3.3, 12)
    for k, (x, z, ry) in enumerate(((-28.6, -16.6, 0.8), (28.6, -16.6, -0.8), (28.6, 16.6, -2.35), (-28.6, 16.6, 2.35))):
        flood(C, k, x, z, ry)
    gantry(C)
    b.finish("tf-skate-p2.glb")
