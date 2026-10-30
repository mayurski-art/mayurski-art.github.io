"""
Troll Forces — the Zombies hub as Grin & Sons Funeral Home (design doc
"Zombie Rush: what's next", phase H0, claude.ai/artifact/4pfaNykEVdLDTmpYkxL1vs).

Run with:
  blender --background --python build_zhub.blender.py

Writes, in MAP coordinates (placed at the origin by modes/zombies/hub-hall.js):
  zh-hall.glb       the parlour: floor, aisle runner, walls with wainscot and
                    wallpaper (ZH_Wallpaper: the game paints the damask),
                    pilasters, coffered ceiling, the front door, the night
                    windows and drapes, the two stained-glass windows
  zh-pads.glb       the three map pads (an open casket on a draped bier, a
                    velvet dais, brass stanchions and ropes, candelabras, the
                    sign's frame) and the family vault (the private pad)
  zh-props.glb      the kiosks (embalming table + specimen shelves; the chapel
                    of rest's altar and pews), the memorial wall round the
                    boards, the long-case clock, the organ, the collection
                    lectern, the chandeliers, ferns
  zh-halloween.glb  Chapter One's Halloween set: the fourth pad (the Halloween
                    run), pumpkins, bats on the beams, candles, tombstones
and zhub-faces.json (rule 9: the faces that must stay seen and every prop's
bounds, for tools/troll-ops-obstruction-test.mjs).

Every number here is a collider or a face in hub-hall.js (HUB, the room's
size): change one, change the other. The game draws the lettered faces
itself (the pad signs, the boards, the clock's dial and countdown, the
plaques, the pumpkins' grins from the real trollface art), so nothing here
carries text.
"""
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from map_kit import TEXTURED, mat  # noqa: E402
from tf_kit import Registry, Report, TFBuilder  # noqa: E402
from hg_kit import lathe, ring  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

# ---- the room (hub-hall.js W, D, WALL_H: walls 0.6 thick on the outline)
W, D, H = 40.0, 30.0, 7.0
XI, ZI = W / 2 - 0.6, D / 2 - 0.6        # inner faces: x +-19.4, z +-14.4
CEIL = H

# ---- where things stand (hub-hall.js HUB)
PADS = [
    {"id": "p1", "x": -15.0, "z": -6.0, "w": 6.0, "d": 5.0, "satin": "p1"},
    {"id": "p2", "x": -8.4, "z": -6.0, "w": 6.0, "d": 5.0, "satin": "p2"},
    {"id": "p3", "x": 8.4, "z": -6.0, "w": 6.0, "d": 5.0, "satin": "p3"},
]
PAD4 = {"id": "p4", "x": 15.0, "z": -6.0, "w": 6.0, "d": 5.0, "satin": "p4"}
VAULT = {"id": "priv", "x": -15.0, "z": 8.0, "w": 5.0, "d": 5.0}
SIGN_Y, SIGN_H = 4.3, 1.7
KIOSKS = {"weapons": (16.6, 4.0), "classes": (16.6, 10.0)}
BOARDS = [(-2.65, -14.12), (2.65, -14.12)]      # centre x, z; 5 x 4.4 from y 1.3
BOARD_W, BOARD_H, BOARD_Y = 5.0, 4.4, 1.3
CLOCK = (-19.0, 3.6)                            # its front faces +x
ORGAN_Z = (-3.1, -0.8)
LECTERN = (-4.2, 13.35)
CHANDELIERS = [(0.0, -3.5), (0.0, 3.5), (0.0, 10.0)]
PILLARS_NS = [-19.4, -9.75, 9.75, 19.4]          # on the north and south walls (mid-south is the door)
PILLARS_WE = [-7.5, 0.0, 7.5]                    # on the west and east walls
WINDOWS_S = [-13.0, -6.0, 6.0, 13.0]
STAINED_Z = -6.0

TEXTURED.update({"ZH_Floor", "ZH_Walnut", "ZH_Wallpaper", "ZH_Plaster", "ZH_Marble", "ZH_Stone"})


def palette():
    return {
        # textured (map-models.js RETEXTURE; ZH_Wallpaper is painted by hub-hall.js)
        "floor": mat("ZH_Floor", 0x6e4a30, 0.6),
        "walnut": mat("ZH_Walnut", 0x4a2e1c, 0.55),
        "paper": mat("ZH_Wallpaper", 0x2c4a3a, 0.85),
        "plaster": mat("ZH_Plaster", 0xe4d9c2, 0.9),
        "marble": mat("ZH_Marble", 0xb9b4aa, 0.35),
        "stone": mat("ZH_Stone", 0x9a968c, 0.9),
        # flat paint
        "cream": mat("ZH_Cream", 0xe9dfc8, 0.7),
        "cream_dk": mat("ZH_CreamDark", 0xcdbf9f, 0.75),
        "mahog": mat("ZH_Mahogany", 0x4b1f12, 0.35, 0.05),
        "mahog_lt": mat("ZH_MahoganyLight", 0x5a2a18, 0.4, 0.05),
        "panel": mat("ZH_Panel", 0x3c2416, 0.5, 0.05),
        "velvet": mat("ZH_Velvet", 0x5c1220, 0.95),
        "velvet_dk": mat("ZH_VelvetDark", 0x3a0a14, 0.95),
        "drape": mat("ZH_Drape", 0x641826, 0.92),
        "black": mat("ZH_Black", 0x151214, 0.85),
        "cloth": mat("ZH_Cloth", 0x1b1719, 0.95),
        "iron": mat("ZH_Iron", 0x1d1d20, 0.55, 0.3),
        "brass": mat("ZH_Brass", 0xc49a48, 0.35, 0.6),
        "brass_dk": mat("ZH_BrassDark", 0x8e6a2c, 0.45, 0.5),
        "steel": mat("ZH_Steel", 0xb9bec2, 0.3, 0.6),
        "sheet": mat("ZH_Sheet", 0xe9e6de, 0.9),
        "wax": mat("ZH_Wax", 0xf1e6cc, 0.6),
        "rose": mat("ZH_Rose", 0x8e0f1e, 0.8),
        "lily": mat("ZH_Lily", 0xf3efe4, 0.8),
        "leaf": mat("ZH_Leaf", 0x2b5a2c, 0.8),
        "leaf_dk": mat("ZH_LeafDark", 0x1e4220, 0.85),
        "pot": mat("ZH_Pot", 0x3d2b22, 0.7),
        "pipe": mat("ZH_Pipe", 0xcfc19a, 0.3, 0.6),
        "keys": mat("ZH_Keys", 0xf3efe2, 0.4),
        "keys_dk": mat("ZH_KeysDark", 0x141214, 0.4),
        "glass_rim": mat("ZH_Lead", 0x2a2626, 0.6, 0.2),
        "orange": mat("ZH_Pumpkin", 0xe0701c, 0.6),
        "orange_dk": mat("ZH_PumpkinDark", 0xb5541a, 0.65),
        "stem": mat("ZH_Stem", 0x4a5a26, 0.8),
        "bat": mat("ZH_Bat", 0x111012, 0.9),
        "foam": mat("ZH_Foam", 0x8c8a86, 0.95),
        # emissive (keep their own material)
        "flame": mat("ZH_Flame", 0xffc46a, 0.4, 0.0, 0xffb347, 4.0),
        "bulb": mat("ZH_Bulb", 0xffe2a8, 0.3, 0.0, 0xffd38a, 3.0),
        "night": mat("ZH_Night", 0x1c2a52, 0.15, 0.0, 0x1a2a58, 0.8),
        "moon": mat("ZH_Moon", 0xf4f0d8, 0.3, 0.0, 0xf2eccc, 1.6),
        "g_red": mat("ZH_GlassRed", 0xc8283a, 0.2, 0.0, 0xd02a3e, 1.3),
        "g_blue": mat("ZH_GlassBlue", 0x2a5ad0, 0.2, 0.0, 0x2c5ee0, 1.3),
        "g_gold": mat("ZH_GlassGold", 0xe8a81c, 0.2, 0.0, 0xf0b020, 1.3),
        "g_green": mat("ZH_GlassGreen", 0x2f9a4a, 0.2, 0.0, 0x34a850, 1.3),
        "jar_g": mat("ZH_JarGreen", 0x6cff6a, 0.2, 0.0, 0x58e85a, 0.3),
        "jar_a": mat("ZH_JarAmber", 0xffb040, 0.2, 0.0, 0xf09a2a, 0.3),
        "votive": mat("ZH_Votive", 0xc0182c, 0.2, 0.0, 0xd8283a, 1.6),
        # the satin inside each casket, in its pad's colour (hub-hall.js PAD_COLOR)
        "p1": mat("ZH_SatinP1", 0x5a8dff, 0.3, 0.0, 0x5a8dff, 0.35),
        "p2": mat("ZH_SatinP2", 0xff7a1a, 0.3, 0.0, 0xff7a1a, 0.35),
        "p3": mat("ZH_SatinP3", 0xffb43a, 0.3, 0.0, 0xffb43a, 0.35),
        "p4": mat("ZH_SatinP4", 0xb45cff, 0.3, 0.0, 0xb45cff, 0.35),
        "eye": mat("ZH_BatEye", 0xff3a2a, 0.3, 0.0, 0xff3a2a, 2.0),
    }


# ------------------------------------------------------------------ helpers

def on_wall(b, m, wall, t0, t1, y0, y1, proud, off=0.0):
    """A box flush on a wall's inner face: `wall` n/s/w/e, t0..t1 along it,
    y0..y1 up it, `proud` into the room, `off` further out from the face."""
    h = y1 - y0
    if wall == "n":
        b.box(m, t1 - t0, h, proud, (t0 + t1) / 2, y0, -ZI + off + proud / 2)
    elif wall == "s":
        b.box(m, t1 - t0, h, proud, (t0 + t1) / 2, y0, ZI - off - proud / 2)
    elif wall == "w":
        b.box(m, proud, h, t1 - t0, -XI + off + proud / 2, y0, (t0 + t1) / 2)
    else:
        b.box(m, proud, h, t1 - t0, XI - off - proud / 2, y0, (t0 + t1) / 2)


WALL_SPAN = {"n": (-XI, XI), "s": (-XI, XI), "w": (-ZI, ZI), "e": (-ZI, ZI)}


def flame(b, P, x, y, z, s=1.0):
    """A candle flame: a little teardrop of light standing on y."""
    lathe(b, P["flame"], x, z, [(0.004, 0), (0.016 * s, 0.025 * s), (0.014 * s, 0.05 * s), (0.002, 0.085 * s)], seg=6, y0=y)


def candle(b, P, x, y, z, h=0.18, r=0.026):
    b.cyl(P["wax"], r, (x, y, z), (x, y + h, z), seg=8)
    flame(b, P, x, y + h, z)


def candelabra(b, P, x, z, h=1.45, arms=3):
    """A floor-standing brass candelabra, `arms` candles across x."""
    lathe(b, P["brass"], x, z, [(0.17, 0), (0.17, 0.03), (0.07, 0.07), (0.035, 0.12), (0.03, h * 0.45), (0.05, h * 0.48),
                                (0.028, h * 0.52), (0.028, h - 0.06), (0.06, h - 0.03), (0.05, h)], seg=12)
    if arms > 1:
        span = 0.24
        b.cyl(P["brass"], 0.016, (x - span, h - 0.02, z), (x + span, h - 0.02, z), seg=6)
        for k in range(arms):
            cx = x - span + 2 * span * k / (arms - 1)
            lathe(b, P["brass"], cx, z, [(0.03, 0), (0.045, 0.03), (0.04, 0.05)], seg=8, y0=h - 0.03)
            candle(b, P, cx, h + 0.02, z, h=0.2 if k == arms // 2 else 0.16)
    else:
        candle(b, P, x, h, z)


def rope(b, m, a, c, sag=0.12, n=7, r=0.022):
    """A velvet rope from a to c, hanging `sag` in the middle."""
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append((a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (c[2] - a[2]) * t))
    for p, q in zip(pts, pts[1:]):
        b.cyl(m, r, p, q, seg=6)


def stanchion(b, P, x, z):
    lathe(b, P["brass"], x, z, [(0.15, 0), (0.15, 0.025), (0.06, 0.05), (0.028, 0.09), (0.026, 0.86), (0.04, 0.88),
                               (0.055, 0.93), (0.045, 0.98), (0.0, 1.0)], seg=10)


def flowers(b, P, x0, x1, y, z, depth=0.4, seed=1):
    """A casket spray: leaves under, roses and lilies on top, along x."""
    rng = random.Random(seed)
    L = x1 - x0
    b.lump(P["leaf_dk"], L, 0.1, depth, (x0 + x1) / 2, y, z, seed=seed, rnd=0.3, n=2)
    for i in range(int(L / 0.09)):
        px = x0 + 0.05 + rng.random() * (L - 0.1)
        pz = z + (rng.random() - 0.5) * depth * 0.8
        k = rng.random()
        m = P["rose"] if k < 0.55 else P["lily"] if k < 0.85 else P["leaf"]
        s = rng.uniform(0.07, 0.11)
        b.lump(m, s, s * 0.8, s, px, y + 0.05 + rng.random() * 0.04, pz, seed=seed * 100 + i, rnd=0.5, n=2)


def pilaster(b, P, x, z, along, depth, width, top=6.75):
    """A cream pilaster on a marble base: `along` x for the north/south walls
    (width along x, depth into the room along z), z for west/east."""
    sx, sz = (width, depth) if along == "x" else (depth, width)
    b.box(P["marble"], sx + 0.08, 0.42, sz + 0.08, x, 0, z)
    b.box(P["walnut"], sx + 0.04, 0.06, sz + 0.04, x, 0.42, z)
    b.box(P["cream"], sx, top - 0.48 - 0.5, sz, x, 0.48, z)
    # flutes down the face: thin darker grooves stood proud a hair
    for k in (-2, -1, 0, 1, 2):
        off = k * width * 0.16
        if along == "x":
            b.box(P["cream_dk"], 0.04, top - 1.6, sz + 0.012, x + off, 0.9, z)
        else:
            b.box(P["cream_dk"], sx + 0.012, top - 1.6, 0.04, x, 0.9, z + off)
    # the capital: stepped blocks
    for i, (gw, gh) in enumerate([(0.05, 0.12), (0.1, 0.1), (0.16, 0.12), (0.12, 0.16)]):
        y = top - 0.5 + sum(h for _, h in [(0.05, 0.12), (0.1, 0.1), (0.16, 0.12), (0.12, 0.16)][:i])
        b.box(P["cream"] if i % 2 == 0 else P["brass_dk"] if i == 1 else P["cream_dk"], sx + gw, gh, sz + gw, x, y, z)


# ------------------------------------------------------------------ the hall

def build_hall(P, R):
    b = TFBuilder()
    # the floor (boards), a velvet runner up the aisle with brass edges
    b.box(P["floor"], W - 1.2, 0.1, D - 1.2, 0, -0.1, 0)
    b.box(P["velvet"], 3.2, 0.012, 27.6, 0, 0, 0.2)
    for s in (-1, 1):
        b.box(P["brass_dk"], 0.07, 0.014, 27.6, s * 1.635, 0, 0.2)
    b.box(P["velvet_dk"], 3.0, 0.002, 0.1, 0, 0.012, 13.95)
    # the walls: papered, a walnut wainscot (panels, chair rail, skirting),
    # a cream crown moulding and frieze under the ceiling
    for s in (-1, 1):
        b.box(P["paper"], W, H + 0.2, 0.6, 0, 0, s * (D / 2 - 0.3))
        b.box(P["paper"], 0.6, H + 0.2, D - 1.2, s * (W / 2 - 0.3), 0, 0)
    for wall, (a0, a1) in WALL_SPAN.items():
        on_wall(b, P["walnut"], wall, a0, a1, 0, 1.25, 0.04)
        on_wall(b, P["walnut"], wall, a0, a1, 0, 0.2, 0.07)
        on_wall(b, P["mahog"], wall, a0, a1, 1.22, 1.3, 0.09)
        on_wall(b, P["cream"], wall, a0, a1, H - 0.55, H - 0.4, 0.06)
        on_wall(b, P["cream_dk"], wall, a0, a1, H - 0.4, H - 0.2, 0.1)
        on_wall(b, P["cream"], wall, a0, a1, H - 0.2, H, 0.16)
        # raised panels in the wainscot, one every 1.2 m
        t = a0 + 0.7
        while t + 0.5 < a1 - 0.2:
            on_wall(b, P["panel"], wall, t - 0.45, t + 0.45, 0.32, 1.08, 0.065)
            t += 1.2
    # the ceiling: plaster, coffered by walnut beams, a medallion over each chandelier
    b.box(P["plaster"], W - 1.2, 0.2, D - 1.2, 0, CEIL, 0)
    for z in (-10, -5, 0, 5, 10):
        b.box(P["walnut"], W - 1.2, 0.26, 0.3, 0, CEIL - 0.26, z)
    for x in (-15, -10, -5, 0, 5, 10, 15):
        b.box(P["walnut"], 0.3, 0.24, D - 1.2, x, CEIL - 0.24, 0)
    for (cx, cz) in CHANDELIERS:
        lathe(b, P["cream_dk"], cx, cz, [(0.75, 0), (0.72, -0.04), (0.5, -0.07), (0.2, -0.1), (0.0, -0.11)], seg=24, y0=CEIL - 0.26)
    # pilasters where the old pillars stood (hub-hall.js keeps their colliders)
    for x in PILLARS_NS:
        for s in (-1, 1):
            pilaster(b, P, x, s * 14.4, "x", 0.9, 1.2)
    for z in PILLARS_WE:
        for s in (-1, 1):
            pilaster(b, P, s * 19.4, z, "z", 0.9, 1.2)
    # the front door, mid south wall: casing, two panelled leaves, a fanlight
    dz = ZI
    b.box(P["mahog"], 3.2, 3.6, 0.14, 0, 0, dz - 0.07)
    for s in (-1, 1):
        b.box(P["walnut"], 1.25, 3.2, 0.06, s * 0.64, 0.05, dz - 0.17)
        for (y0, y1) in ((0.3, 1.5), (1.8, 3.0)):
            b.box(P["mahog_lt"], 0.85, y1 - y0, 0.03, s * 0.64, y0, dz - 0.215)
        b.cyl(P["brass"], 0.03, (s * 0.12, 1.45, dz - 0.2), (s * 0.12, 1.45, dz - 0.3), seg=8)
        b.box(P["brass"], 0.04, 0.4, 0.03, s * 0.12, 1.25, dz - 0.3)
    fan = [(math.cos(math.pi * i / 8) * 1.25, 3.62 + math.sin(math.pi * i / 8) * 0.95) for i in range(9)]
    for i in range(8):
        m = (P["g_gold"], P["g_red"])[i % 2]
        b.poly(m, [(0, 3.62, dz - 0.15), (fan[i][0], fan[i][1], dz - 0.15), (fan[i + 1][0], fan[i + 1][1], dz - 0.15)], [[0, 1, 2]])
    for i in range(9):
        b.bar(P["glass_rim"], (0, 3.62, dz - 0.16), (fan[i][0], fan[i][1], dz - 0.16), 0.03)
    for i in range(8):
        b.bar(P["mahog"], (fan[i][0], fan[i][1], dz - 0.17), (fan[i + 1][0], fan[i + 1][1], dz - 0.17), 0.12)
    # the night windows down the south wall, drapes either side
    for x in WINDOWS_S:
        y0, y1, ww = 1.5, 5.3, 1.6
        b.box(P["night"], ww, y1 - y0, 0.02, x, y0, dz - 0.02)
        for yy in (2.45, 3.4, 4.35):
            b.box(P["cream"], ww, 0.05, 0.05, x, yy, dz - 0.05)
        b.box(P["cream"], 0.05, y1 - y0, 0.05, x, y0, dz - 0.05)
        b.box(P["cream"], ww + 0.3, 0.14, 0.18, x, y0 - 0.14, dz - 0.09)
        b.box(P["cream"], ww + 0.2, 0.12, 0.08, x, y1, dz - 0.04)
        for s in (-1, 1):
            b.box(P["cream"], 0.1, y1 - y0 + 0.12, 0.08, x + s * (ww / 2 + 0.05), y0, dz - 0.04)
        # drapes: a pleated fall each side, a pelmet over the top
        for s in (-1, 1):
            cx = x + s * (ww / 2 + 0.32)
            prof = []
            for i in range(9):
                u = -0.26 + 0.52 * i / 8
                prof.append((cx + u, 0.08 + 0.05 * (i % 2)))
            prof += [(cx + 0.26, 0.0), (cx - 0.26, 0.0)]
            pts = [(px, 0.15, dz - pz) for px, pz in prof] + [(px, y1 + 0.55, dz - pz) for px, pz in prof]
            n = len(prof)
            faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
            b.poly(P["drape"], pts, faces)
            b.box(P["brass"], 0.12, 0.06, 0.2, cx, 1.6, dz - 0.12)
        b.box(P["drape"], ww + 1.4, 0.5, 0.22, x, y1 + 0.5, dz - 0.11)
        b.box(P["brass"], ww + 1.4, 0.04, 0.24, x, y1 + 0.98, dz - 0.12)
    # the moon (one pane, east window)
    b.cyl(P["moon"], 0.2, (13.3, 4.7, dz - 0.03), (13.3, 4.7, dz - 0.035), seg=20)
    # the stained-glass windows, west and east, a pointed arch over each
    for s in (-1, 1):
        x = s * (XI - 0.02)
        y0, y1, ww = 1.95, 4.9, 1.4
        rows = 5
        cols = 3
        cols_m = [P["g_blue"], P["g_red"], P["g_gold"], P["g_green"]]
        for r in range(rows):
            for c in range(cols):
                m = cols_m[(r + c * 2 + (r == 2)) % 4]
                zc = STAINED_Z - ww / 2 + ww * (c + 0.5) / cols
                b.box(m, 0.02, (y1 - y0) / rows, ww / cols, x, y0 + (y1 - y0) * r / rows, zc)
        arch = [(STAINED_Z - ww / 2 + ww * (0.5 - 0.5 * math.cos(math.pi * i / 10)), y1 + 0.9 * math.sin(math.pi * i / 10) ** 0.7) for i in range(11)]
        for i in range(10):
            m = cols_m[i % 4]
            b.poly(m, [(x, y1, STAINED_Z), (x, arch[i][1], arch[i][0]), (x, arch[i + 1][1], arch[i + 1][0])], [[0, 1, 2]])
        lead = x - s * 0.02
        for r in range(rows + 1):
            b.box(P["glass_rim"], 0.03, 0.035, ww, lead, y0 + (y1 - y0) * r / rows - 0.017, STAINED_Z)
        for c in range(cols + 1):
            b.box(P["glass_rim"], 0.03, y1 - y0, 0.035, lead, y0, STAINED_Z - ww / 2 + ww * c / cols)
        for i in range(10):
            b.bar(P["mahog"], (lead - s * 0.02, arch[i][1], arch[i][0]), (lead - s * 0.02, arch[i + 1][1], arch[i + 1][0]), 0.12)
        b.box(P["mahog"], 0.12, 0.12, ww + 0.24, lead - s * 0.04, y0 - 0.12, STAINED_Z)
        for e in (-1, 1):
            b.box(P["mahog"], 0.12, y1 - y0 + 0.12, 0.12, lead - s * 0.04, y0 - 0.12, STAINED_Z + e * (ww / 2 + 0.06))
    R.face("door:front", "hall", (0.0, 1.65, ZI - 0.22), (0, 0, -1), 2.5, 3.2)
    for x in WINDOWS_S:
        R.face(f"window:s{x:+.0f}", "hall", (x, 3.4, ZI - 0.03), (0, 0, -1), 1.6, 3.8)
    for s, side in ((-1, "w"), (1, "e")):
        R.face(f"stained:{side}", "hall", (s * (XI - 0.03), 3.6, STAINED_Z), (-s, 0, 0), 1.4, 3.3)
    b.finish("zh-hall.glb")


# ------------------------------------------------------------------ the pads

def casket_pad(b, P, R, p):
    """A map pad: a velvet dais with brass stanchions down its open sides,
    an open casket on a draped bier at its back (the satin in the map's
    colour), a candelabra each side, and the frame the game's sign hangs in."""
    x, z, w, d = p["x"], p["z"], p["w"], p["d"]
    x0, x1, z0, z1 = x - w / 2, x + w / 2, z - d / 2, z + d / 2
    satin = P[p["satin"]]
    R.begin(b, f"pad:{p['id']}:dais")
    b.box(P["walnut"], w, 0.05, d, x, 0, z)
    b.box(P["velvet"], w - 0.24, 0.012, d - 0.24, x, 0.05, z)
    b.box(satin, w - 0.06, 0.022, 0.03, x, 0.012, z1 + 0.005)
    for s in (-1, 1):
        b.box(satin, 0.03, 0.022, d - 0.06, x + s * (w / 2 + 0.005), 0.012, z)
    R.end()
    # stanchions and ropes down the west and east edges (hub-hall.js keeps
    # the old glass panes' colliders there)
    for s in (-1, 1):
        R.begin(b, f"pad:{p['id']}:ropes{'we'[s > 0]}", on=f"pad:{p['id']}:dais")
        px = x + s * (w / 2 - 0.1)
        posts = [z0 + 0.25, z, z1 - 0.25]
        for pz in posts:
            stanchion(b, P, px, pz)
        for a, c in zip(posts, posts[1:]):
            rope(b, P["velvet"], (px, 0.9, a + 0.05), (px, 0.9, c - 0.05))
        R.end()
    # the bier: a draped table, folds down its skirt
    zc = z0 + 0.75
    R.begin(b, f"pad:{p['id']}:casket", on=f"pad:{p['id']}:dais")
    b.box(P["cloth"], 2.3, 0.62, 0.66, x, 0.06, zc)
    for i in range(16):
        fx = x - 1.12 + 2.24 * i / 15
        b.box(P["black"], 0.05, 0.6, 0.02, fx, 0.06, zc + 0.335)
    b.box(P["velvet_dk"], 2.36, 0.05, 0.72, x, 0.66, zc)
    # the casket: body, a moulded base and lip, brass rails and handles
    b.box(P["mahog"], 2.2, 0.08, 0.74, x, 0.71, zc, bevel=0.02)
    b.box(P["mahog"], 2.12, 0.44, 0.66, x, 0.79, zc, bevel=0.03)
    b.box(P["mahog_lt"], 2.18, 0.05, 0.7, x, 1.21, zc, bevel=0.015)
    for s in (-1, 1):
        b.cyl(P["brass"], 0.02, (x - 0.95, 0.94, zc + s * 0.37), (x + 0.95, 0.94, zc + s * 0.37), seg=8)
        for hx in (-0.7, 0.0, 0.7):
            b.box(P["brass"], 0.06, 0.08, 0.04, x + hx, 0.9, zc + s * 0.35)
    # the foot half closed, a domed lid with a spray on it
    b.box(P["mahog"], 1.08, 0.08, 0.66, x + 0.55, 1.26, zc, bevel=0.02)
    b.box(P["mahog_lt"], 1.0, 0.06, 0.56, x + 0.55, 1.34, zc, bevel=0.025)
    # the head half open: the satin lining, a pillow, the lid stood up
    b.box(satin, 1.0, 0.03, 0.56, x - 0.53, 1.18, zc)
    for s in (-1, 1):
        b.box(satin, 1.0, 0.1, 0.03, x - 0.53, 1.12, zc + s * 0.29)
    b.lump(satin, 0.4, 0.12, 0.42, x - 0.85, 1.2, zc, seed=7, rnd=0.25, n=2)
    tilt = math.radians(14)
    hz = zc - 0.33
    ly, lz = 1.26 + 0.31 * math.cos(tilt), hz - 0.31 * math.sin(tilt)
    b.box(P["mahog"], 1.08, 0.62, 0.07, x - 0.53, ly - 0.31, lz, rx=-tilt, bevel=0.015)
    b.box(satin, 0.94, 0.5, 0.02, x - 0.53, ly - 0.25, lz + 0.045 * math.cos(tilt), rx=-tilt)
    R.end()
    R.begin(b, f"pad:{p['id']}:spray", on=f"pad:{p['id']}:casket")
    flowers(b, P, x + 0.15, x + 0.95, 1.4, zc, depth=0.42, seed=hash(p["id"]) % 997)
    R.end()
    for s in (-1, 1):
        R.begin(b, f"pad:{p['id']}:candles{'we'[s > 0]}", on=f"pad:{p['id']}:dais")
        candelabra(b, P, x + s * 1.65, zc, h=1.45)
        R.end()
    # the sign's frame: two turned posts (hub-hall.js's colliders), a walnut
    # surround outside the sign itself, a pediment and an urn on top
    sz = z0 - 0.25
    sw = w - 0.4
    R.begin(b, f"pad:{p['id']}:sign")
    for s in (-1, 1):
        px = x + s * (w / 2 - 0.4)
        lathe(b, P["walnut"], px, sz, [(0.12, 0), (0.12, 0.2), (0.07, 0.26), (0.06, 1.0), (0.085, 1.1), (0.055, 1.25),
                                       (0.055, SIGN_Y - SIGN_H / 2 - 0.15), (0.08, SIGN_Y - SIGN_H / 2 - 0.08), (0.08, SIGN_Y - SIGN_H / 2)], seg=10)
    yb, yt = SIGN_Y - SIGN_H / 2, SIGN_Y + SIGN_H / 2
    b.box(P["walnut"], sw + 0.04, SIGN_H + 0.04, 0.06, x, yb - 0.02, sz - 0.09)
    for (fx, fw) in ((x - sw / 2 - 0.08, 0.16), (x + sw / 2 + 0.08, 0.16)):
        b.box(P["mahog"], fw, SIGN_H + 0.32, 0.16, fx, yb - 0.16, sz - 0.04)
    b.box(P["mahog"], sw + 0.32, 0.16, 0.16, x, yb - 0.16, sz - 0.04)
    b.box(P["mahog"], sw + 0.32, 0.16, 0.16, x, yt, sz - 0.04)
    b.box(P["brass_dk"], sw + 0.36, 0.04, 0.18, x, yt + 0.16, sz - 0.04)
    b.prism(P["mahog"], [(x - sw / 2 - 0.1, yt + 0.2), (x + sw / 2 + 0.1, yt + 0.2), (x, yt + 0.62)], sz - 0.11, sz + 0.03)
    lathe(b, P["brass"], x, sz - 0.04, [(0.06, 0), (0.1, 0.06), (0.12, 0.16), (0.08, 0.26), (0.04, 0.3), (0.05, 0.34), (0.0, 0.4)],
          seg=12, y0=yt + 0.5)
    R.end()
    R.face(f"sign:{p['id']}", f"pad:{p['id']}:sign", (x, SIGN_Y, sz), (0, 0, 1), sw, SIGN_H)


def build_pads(P, R):
    b = TFBuilder()
    for p in PADS:
        casket_pad(b, P, R, p)
    # the family vault (the private pad): a marble floor, an iron fence on its
    # north and west sides, stone piers with urns, iron posts for its sign
    v = VAULT
    x, z, w, d = v["x"], v["z"], v["w"], v["d"]
    x0, x1, z0, z1 = x - w / 2, x + w / 2, z - d / 2, z + d / 2
    R.begin(b, "vault:floor")
    b.box(P["black"], w, 0.04, d, x, 0, z)
    b.box(P["marble"], w - 0.2, 0.012, d - 0.2, x, 0.04, z)
    for i in range(1, 5):
        b.box(P["black"], w - 0.2, 0.002, 0.02, x, 0.052, z0 + d * i / 5)
        b.box(P["black"], 0.02, 0.002, d - 0.2, x0 + w * i / 5, 0.052, z)
    R.end()
    R.begin(b, "vault:fence", on=["vault:floor", "vault:pier-18+6", "vault:pier-12+6", "vault:pier-18+10"])

    def fence(a, c):
        L = math.dist(a, c)
        n = int(L / 0.13)
        for yy in (0.12, 0.95):
            b.bar(P["iron"], (a[0], yy, a[1]), (c[0], yy, c[1]), 0.035)
        for i in range(1, n):
            t = i / n
            px, pz = a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t
            b.box(P["iron"], 0.022, 1.0, 0.022, px, 0.05, pz)
            b.cyl(P["iron"], 0.03, (px, 1.05, pz), (px, 1.16, pz), seg=4, r2=0.002)
    fence((x0 + 0.25, z0), (x1 - 0.25, z0))
    fence((x0, z0 + 0.25), (x0, z1 - 0.25))
    R.end()
    for (px, pz) in ((x0, z0), (x1, z0), (x0, z1)):
        R.begin(b, f"vault:pier{px:+.0f}{pz:+.0f}", on="vault:floor")
        b.box(P["stone"], 0.42, 1.25, 0.42, px, 0, pz)
        b.box(P["stone"], 0.52, 0.1, 0.52, px, 1.25, pz)
        lathe(b, P["stone"], px, pz, [(0.1, 0), (0.16, 0.05), (0.19, 0.18), (0.12, 0.32), (0.08, 0.36), (0.12, 0.4), (0.0, 0.42)], seg=12, y0=1.35)
        R.end()
    # the sign's posts: iron, scrolls at the head
    sz = z0 - 0.25
    sw = w - 0.4
    for s in (-1, 1):
        R.begin(b, f"vault:sign-post{'we'[s > 0]}", on="vault:floor")
        px = x + s * (w / 2 - 0.4)
        b.box(P["iron"], 0.1, SIGN_Y - SIGN_H / 2, 0.1, px, 0, sz)
        ring(b, P["iron"], (px - s * 0.18, SIGN_Y - SIGN_H / 2 - 0.25, sz), 0.16, 0.02, seg=14, tseg=4, axis="z")
        R.end()
    R.begin(b, "vault:sign", on=["vault:sign-postw", "vault:sign-poste"])
    yb, yt = SIGN_Y - SIGN_H / 2, SIGN_Y + SIGN_H / 2
    b.box(P["black"], sw + 0.04, SIGN_H + 0.04, 0.06, x, yb - 0.02, sz - 0.09)
    for fx in (x - sw / 2 - 0.06, x + sw / 2 + 0.06):
        b.box(P["iron"], 0.1, SIGN_H + 0.2, 0.12, fx, yb - 0.1, sz - 0.04)
    for fy in (yb - 0.1, yt):
        b.box(P["iron"], sw + 0.22, 0.1, 0.12, x, fy, sz - 0.04)
    ring(b, P["iron"], (x, yt + 0.1, sz - 0.04), 0.5, 0.025, seg=16, tseg=4, axis="z", arc=math.pi)
    R.end()
    R.face("sign:priv", "vault:sign", (x, SIGN_Y, sz), (0, 0, 1), sw, SIGN_H)
    b.finish("zh-pads.glb")


# ------------------------------------------------------------------ the props

def chandelier(b, P, cx, cz):
    top = CEIL - 0.37
    b.cyl(P["brass_dk"], 0.012, (cx, top, cz), (cx, 6.05, cz), seg=4)
    lathe(b, P["brass"], cx, cz, [(0.0, 0), (0.07, 0.03), (0.12, 0.12), (0.09, 0.22), (0.05, 0.3), (0.05, 0.62), (0.09, 0.7),
                                  (0.06, 0.78), (0.0, 0.8)], seg=12, y0=5.25)
    for (R_, y, n) in ((0.72, 5.55, 8), (0.42, 5.88, 6)):
        ring(b, P["brass"], (cx, y, cz), R_, 0.018, seg=24, tseg=4)
        for i in range(n):
            a = 2 * math.pi * (i + 0.5 * (R_ < 0.5)) / n
            px, pz = cx + R_ * math.cos(a), cz + R_ * math.sin(a)
            b.bar(P["brass"], (cx, y - 0.04, cz), (px, y, pz), 0.02)
            lathe(b, P["brass"], px, pz, [(0.02, 0), (0.05, 0.03), (0.04, 0.05)], seg=8, y0=y)
            b.cyl(P["wax"], 0.018, (px, y + 0.04, pz), (px, y + 0.13, pz), seg=6)
            lathe(b, P["bulb"], px, pz, [(0.004, 0), (0.026, 0.035), (0.02, 0.07), (0.0, 0.1)], seg=8, y0=y + 0.13)
    # crystal drops: little bulb-lit beads hanging off the low ring
    for i in range(16):
        a = 2 * math.pi * i / 16
        px, pz = cx + 0.6 * math.cos(a), cz + 0.6 * math.sin(a)
        b.cyl(P["bulb"], 0.012, (px, 5.5, pz), (px, 5.38, pz), seg=4, r2=0.002)


def fern(b, P, x, z, seed):
    rng = random.Random(seed)
    lathe(b, P["marble"], x, z, [(0.18, 0), (0.18, 0.05), (0.08, 0.12), (0.06, 0.7), (0.14, 0.78), (0.2, 0.8)], seg=12)
    lathe(b, P["pot"], x, z, [(0.0, 0), (0.16, 0.0), (0.22, 0.28), (0.24, 0.32), (0.0, 0.3)], seg=12, y0=0.8)
    for i in range(14):
        a = 2 * math.pi * i / 14 + rng.uniform(-0.2, 0.2)
        L = rng.uniform(0.55, 0.85)
        droop = rng.uniform(0.25, 0.45)
        base = (x, 1.1, z)
        mid = (x + math.cos(a) * L * 0.55, 1.1 + 0.38, z + math.sin(a) * L * 0.55)
        tip = (x + math.cos(a) * L, 1.1 + 0.38 - droop, z + math.sin(a) * L)
        m = P["leaf"] if i % 2 else P["leaf_dk"]
        b.bar(m, base, mid, 0.09, 0.012)
        b.bar(m, mid, tip, 0.06, 0.01)


def build_props(P, R):
    b = TFBuilder()
    # ---- Weapons: the embalming room. A steel table, a sheet half over it,
    # a lamp on a stand, specimen shelves on the wall behind
    kx, kz = KIOSKS["weapons"]
    R.begin(b, "kiosk:weapons")
    for sx in (-0.42, 0.42):
        for sz in (-1.05, 1.05):
            b.cyl(P["steel"], 0.035, (kx + sx, 0, kz + sz), (kx + sx, 0.88, kz + sz), seg=8)
            b.cyl(P["black"], 0.05, (kx + sx, 0, kz + sz), (kx + sx, 0.05, kz + sz), seg=8)
    b.box(P["steel"], 1.0, 0.04, 2.4, kx, 0.88, kz)
    for s in (-1, 1):
        b.box(P["steel"], 0.04, 0.06, 2.4, kx + s * 0.48, 0.92, kz)
        b.box(P["steel"], 1.0, 0.06, 0.04, kx, 0.92, kz + s * 1.18)
    b.box(P["steel"], 0.9, 0.04, 2.2, kx, 0.3, kz)
    b.cyl(P["steel"], 0.08, (kx, 0.88, kz + 1.25), (kx, 0.76, kz + 1.25), seg=10, r2=0.03)
    b.box(P["sheet"], 1.06, 0.02, 0.9, kx, 0.98, kz + 0.75)
    b.box(P["sheet"], 0.02, 0.45, 0.9, kx - 0.52, 0.55, kz + 0.75)
    b.box(P["sheet"], 0.02, 0.45, 0.9, kx + 0.52, 0.55, kz + 0.75)
    R.end()
    R.begin(b, "kiosk:weapons-lamp", on="kiosk:weapons")
    lx, lz = kx - 0.2, kz + 1.65
    b.cyl(P["black"], 0.2, (lx, 0, lz), (lx, 0.04, lz), seg=12)
    b.cyl(P["steel"], 0.025, (lx, 0.04, lz), (lx, 1.75, lz), seg=8)
    b.bar(P["steel"], (lx, 1.75, lz), (kx, 1.9, kz + 0.9), 0.03)
    lathe(b, P["steel"], kx, kz + 0.9, [(0.0, 0.18), (0.08, 0.16), (0.22, 0.02), (0.24, 0.0)], seg=16, y0=1.72)
    lathe(b, P["bulb"], kx, kz + 0.9, [(0.0, 0.02), (0.16, 0.02), (0.0, 0.03)], seg=16, y0=1.72)
    R.end()
    R.begin(b, "kiosk:weapons-shelves")
    sx0 = XI - 0.42
    b.box(P["walnut"], 0.05, 2.25, 2.5, XI - 0.025, 0, kz)
    for s in (-1, 1):
        b.box(P["walnut"], 0.42, 2.25, 0.06, sx0 + 0.21, 0, kz + s * 1.22)
    b.box(P["walnut"], 0.42, 0.25, 2.5, sx0 + 0.21, 0, kz)
    for yy in (0.25, 0.85, 1.45, 2.05):
        b.box(P["mahog"], 0.4, 0.04, 2.4, sx0 + 0.2, yy, kz)
    rng = random.Random(4)
    for yy in (0.29, 0.89, 1.49):
        zz = kz - 1.05
        while zz < kz + 1.05:
            r = rng.uniform(0.07, 0.11)
            h = rng.uniform(0.22, 0.4)
            m = P["jar_g"] if rng.random() < 0.6 else P["jar_a"]
            b.cyl(m, r, (sx0 + 0.18, yy, zz + r), (sx0 + 0.18, yy + h, zz + r), seg=10)
            b.cyl(P["brass_dk"], r * 1.05, (sx0 + 0.18, yy + h, zz + r), (sx0 + 0.18, yy + h + 0.03, zz + r), seg=10)
            zz += 2 * r + rng.uniform(0.04, 0.1)
    b.box(P["mahog"], 0.46, 0.08, 2.56, sx0 + 0.21, 2.25, kz)
    R.end()
    # ---- Classes: the chapel of rest. An altar draped in white and purple,
    # the roster open on a book stand, candlesticks, two pews facing it
    kx, kz = KIOSKS["classes"]
    R.begin(b, "kiosk:classes")
    b.box(P["mahog"], 1.0, 0.95, 2.4, kx, 0, kz, bevel=0.02)
    b.box(P["sheet"], 1.08, 0.03, 2.48, kx, 0.95, kz)
    b.box(P["sheet"], 0.02, 0.5, 2.48, kx - 0.53, 0.47, kz)
    b.box(P["p4"], 0.025, 0.42, 0.5, kx - 0.545, 0.55, kz)
    b.box(P["brass"], 0.025, 0.04, 0.5, kx - 0.55, 0.53, kz)
    b.box(P["brass_dk"], 0.3, 0.12, 0.3, kx, 0.98, kz)
    b.box(P["mahog"], 0.42, 0.04, 0.62, kx - 0.02, 1.13, kz, rz=0.3)
    b.box(P["sheet"], 0.36, 0.03, 0.27, kx - 0.04, 1.16, kz - 0.15, rz=0.3, rx=0.06)
    b.box(P["sheet"], 0.36, 0.03, 0.27, kx - 0.04, 1.16, kz + 0.15, rz=0.3, rx=-0.06)
    for s in (-1, 1):
        lathe(b, P["brass"], kx + 0.1, kz + s * 0.95, [(0.08, 0), (0.08, 0.02), (0.03, 0.06), (0.025, 0.4), (0.06, 0.43), (0.04, 0.45)], seg=10, y0=0.98)
        candle(b, P, kx + 0.1, 1.43, kz + s * 0.95, h=0.24, r=0.03)
    R.end()
    for i, px in enumerate((13.4, 11.7)):
        R.begin(b, f"kiosk:pew{i}")
        L = 2.8
        b.box(P["walnut"], 0.48, 0.06, L, px, 0.42, kz)
        b.box(P["walnut"], 0.06, 0.6, L, px - 0.26, 0.42, kz, rz=0.08)
        b.box(P["brass_dk"], 0.08, 0.04, L + 0.04, px - 0.29, 1.02, kz)
        for s in (-1, 1):
            b.prism(P["walnut"], [(px - 0.32, 0), (px + 0.26, 0), (px + 0.26, 0.62), (px - 0.05, 0.62), (px - 0.32, 1.1)],
                    kz + s * (L / 2) - 0.03, kz + s * (L / 2) + 0.03)
        b.box(P["velvet"], 0.44, 0.03, L - 0.1, px, 0.48, kz)
        R.end()
    # ---- the memorial wall round the two boards
    R.begin(b, "memorial:wall")
    b.box(P["walnut"], 11.6, 5.6, 0.2, 0, 0.9, -ZI + 0.1)
    for (bx, bz) in BOARDS:
        x0, x1 = bx - BOARD_W / 2, bx + BOARD_W / 2
        y0, y1 = BOARD_Y, BOARD_Y + BOARD_H
        b.box(P["mahog"], BOARD_W + 0.36, 0.18, 0.12, bx, y0 - 0.18, bz + 0.01)
        b.box(P["mahog"], BOARD_W + 0.36, 0.18, 0.12, bx, y1, bz + 0.01)
        b.box(P["brass_dk"], BOARD_W + 0.4, 0.03, 0.14, bx, y1 + 0.18, bz + 0.01)
        for fx in (x0 - 0.09, x1 + 0.09):
            b.box(P["mahog"], 0.18, BOARD_H, 0.12, fx, y0, bz + 0.01)
    # the title plaque's brass plate (hub-hall.js letters it), corbels
    b.box(P["brass_dk"], 3.4, 0.5, 0.05, 0, 5.92, -ZI + 0.22)
    b.box(P["mahog"], 3.6, 0.08, 0.1, 0, 6.42, -ZI + 0.25)
    b.prism(P["mahog"], [(-1.9, 6.5), (1.9, 6.5), (0, 6.85)], -ZI + 0.16, -ZI + 0.28)
    R.end()
    R.begin(b, "memorial:ledge", on="memorial:wall")
    b.box(P["mahog"], 11.0, 0.05, 0.28, 0, 0.98, -ZI + 0.34)
    rng = random.Random(9)
    xv = -5.2
    while xv < 5.25:
        if abs(xv) > 0.25:
            b.cyl(P["votive"], 0.035, (xv, 1.03, -ZI + 0.36), (xv, 1.11, -ZI + 0.36), seg=8)
            flame(b, P, xv, 1.11, -ZI + 0.36, 0.7)
        xv += rng.uniform(0.38, 0.6)
    R.end()
    for s in (-1, 1):
        R.begin(b, f"memorial:wreath{'we'[s > 0]}")
        wx, wz = s * 6.5, -13.55
        for k, (dx, dz) in enumerate(((-0.25, 0.18), (0.25, 0.18), (0.0, -0.22))):
            b.bar(P["brass_dk"], (wx + dx, 0, wz + dz), (wx + dx * 0.2, 1.55, wz + dz * 0.2 - 0.05), 0.025)
        ring(b, P["leaf_dk"], (wx, 1.45, wz - 0.06), 0.42, 0.1, seg=20, tseg=6, axis="z")
        rng = random.Random(30 + s)
        for i in range(20):
            a = 2 * math.pi * i / 20
            m = P["rose"] if i % 3 else P["lily"]
            px, py = wx + 0.42 * math.cos(a), 1.45 + 0.42 * math.sin(a)
            b.lump(m, 0.1, 0.1, 0.08, px, py - 0.05, wz + 0.03, seed=s * 50 + i, rnd=0.5, n=2)
        b.box(P["velvet"], 0.14, 0.5, 0.02, wx - 0.1, 0.8, wz + 0.06, rz=0.15)
        b.box(P["velvet"], 0.14, 0.5, 0.02, wx + 0.1, 0.8, wz + 0.06, rz=-0.15)
        R.end()
    # the kiosks' plaques (hub-hall.js letters them), 2.9 m up, facing west
    for k, (kx, kz) in KIOSKS.items():
        R.face(f"plaque:{k}", f"kiosk:{k}", (kx + 0.55, 2.9, kz), (-1, 0, 0), 2.6, 0.65)
    R.face("board:wave", "memorial:wall", (BOARDS[0][0], BOARD_Y + BOARD_H / 2, BOARDS[0][1]), (0, 0, 1), BOARD_W, BOARD_H)
    R.face("board:kills", "memorial:wall", (BOARDS[1][0], BOARD_Y + BOARD_H / 2, BOARDS[1][1]), (0, 0, 1), BOARD_W, BOARD_H)
    R.face("plaque:memoriam", "memorial:wall", (0, 6.17, -ZI + 0.25), (0, 0, 1), 3.2, 0.42)
    # ---- the long-case clock: plinth, trunk with a glass door, hood, crest
    cx, cz = CLOCK
    R.begin(b, "clock")
    b.box(P["mahog"], 0.52, 0.38, 0.78, cx, 0, cz, bevel=0.02)
    b.box(P["mahog"], 0.4, 1.42, 0.56, cx, 0.38, cz)
    b.box(P["walnut"], 0.03, 1.15, 0.44, cx + 0.2, 0.5, cz)
    b.box(P["mahog"], 0.5, 0.06, 0.66, cx, 1.8, cz)
    b.box(P["mahog"], 0.48, 0.74, 0.72, cx, 1.86, cz)
    b.box(P["brass_dk"], 0.02, 0.62, 0.62, cx + 0.245, 1.92, cz)
    for s in (-1, 1):
        b.cyl(P["brass"], 0.035, (cx + 0.22, 1.86, cz + s * 0.33), (cx + 0.22, 2.6, cz + s * 0.33), seg=8)
    b.box(P["mahog"], 0.52, 0.08, 0.76, cx, 2.6, cz)
    b.prism(P["mahog"], [(cz - 0.4, 2.68), (cz + 0.4, 2.68), (cz + 0.14, 2.92), (cz, 2.86), (cz - 0.14, 2.92)], cx - 0.24, cx + 0.24, axis="x")
    for dz in (-0.34, 0.0, 0.34):
        lathe(b, P["brass"], cx, cz + dz, [(0.04, 0), (0.05, 0.04), (0.02, 0.1), (0.0, 0.14)], seg=8, y0=2.68 if dz else 2.9)
    R.end()
    R.face("clock:dial", "clock", (cx + 0.26, 2.23, cz), (1, 0, 0), 0.58, 0.58)
    R.face("clock:plate", "clock", (cx + 0.22, 1.08, cz), (1, 0, 0), 0.4, 0.5)
    # ---- the organ on the west wall: case, two manuals, stops, pipes, bench
    z0, z1 = ORGAN_Z
    oz = (z0 + z1) / 2
    ow = z1 - z0
    ox = -XI
    R.begin(b, "organ")
    b.box(P["mahog"], 0.75, 1.0, ow, ox + 0.375, 0, oz, bevel=0.02)
    b.box(P["mahog"], 0.4, 0.5, ow, ox + 0.2, 1.0, oz)
    for k, (yy, dx) in enumerate(((0.82, 0.62), (0.9, 0.5))):
        b.box(P["keys"], 0.18, 0.03, ow - 0.4, ox + dx, yy, oz)
        nk = int((ow - 0.4) / 0.045)
        for i in range(nk):
            if i % 7 in (1, 2, 4, 5, 6):
                zz = z0 + 0.2 + (i + 0.5) * (ow - 0.4) / nk
                b.box(P["keys_dk"], 0.1, 0.02, 0.022, ox + dx - 0.03, yy + 0.03, zz)
    for i in range(10):
        zz = z0 + 0.3 + i * (ow - 0.6) / 9
        b.cyl(P["lily"] if i % 2 else P["rose"], 0.022, (ox + 0.4, 1.12, zz), (ox + 0.44, 1.12, zz), seg=6)
    b.box(P["mahog"], 0.24, 0.12, ow + 0.1, ox + 0.12, 1.5, oz)
    n = 15
    for i in range(n):
        t = (i - (n - 1) / 2) / ((n - 1) / 2)
        h = 1.6 + 2.2 * (1 - abs(t) ** 1.4)
        zz = oz + t * (ow / 2 - 0.08)
        r = 0.055 - 0.015 * abs(t)
        b.cyl(P["pipe"], r, (ox + 0.12, 1.62, zz), (ox + 0.12, 1.62 + h, zz), seg=10)
        b.cyl(P["pipe"], r, (ox + 0.12, 1.62, zz), (ox + 0.12, 1.5, zz), seg=10, r2=0.01)
        b.box(P["black"], 0.01, 0.05, r * 1.2, ox + 0.12 + r, 1.8, zz)
    R.end()
    R.begin(b, "organ:bench")
    b.box(P["mahog"], 0.36, 0.06, 1.3, ox + 1.3, 0.5, oz)
    for s in (-1, 1):
        b.box(P["mahog"], 0.32, 0.5, 0.06, ox + 1.3, 0, oz + s * 0.6)
    R.end()
    # ---- the collection lectern by the front door
    lx, lz = LECTERN
    R.begin(b, "lectern")
    lathe(b, P["walnut"], lx, lz, [(0.26, 0), (0.26, 0.06), (0.12, 0.12), (0.08, 0.2), (0.07, 0.85), (0.12, 0.92)], seg=12)
    b.box(P["walnut"], 0.62, 0.05, 0.46, lx, 0.98, lz, rx=-0.32)
    b.box(P["mahog"], 0.66, 0.04, 0.05, lx, 0.92, lz - 0.24)
    b.box(P["brass_dk"], 0.46, 0.012, 0.3, lx, 1.035, lz + 0.01, rx=-0.32)
    b.box(P["mahog"], 0.4, 0.04, 0.22, lx + 0.4, 0.86, lz)
    lathe(b, P["brass"], lx + 0.4, lz, [(0.0, 0), (0.08, 0.0), (0.15, 0.03), (0.16, 0.05), (0.0, 0.02)], seg=16, y0=0.9)
    R.end()
    R.face("plate:credits", "lectern", (lx, 1.07, lz + 0.01), (0, 0.95, -0.31), 0.42, 0.26)
    # ---- the chandeliers, the ferns in the corners
    for i, (cx, cz) in enumerate(CHANDELIERS):
        R.begin(b, f"chandelier{i}")
        chandelier(b, P, cx, cz)
        R.end()
    for i, (fx, fz) in enumerate(((-18.0, 13.0), (18.0, 13.0), (-18.2, -12.9), (18.2, -12.9), (-4.4, -13.2), (4.4, -13.2))):
        if abs(fx) < 5:
            continue      # the board wall's ends: the wreaths stand there
        R.begin(b, f"fern{i}")
        fern(b, P, fx, fz, i)
        R.end()
    b.finish("zh-props.glb")


# ------------------------------------------------------------------ Halloween

# where the jack-o'-lanterns sit (zhub-pumpkins.json): hub-hall.js draws
# them, Hollowgrin's own (maps/jack-o-lantern.js), each facing `face`
# (radians about y, 0 = +z). Only the rest of the set is drawn here.
PUMPKINS = []


def build_halloween(P, R):
    b = TFBuilder()
    casket_pad(b, P, R, PAD4)
    def pk(x, z, r, face, key, y=0.0):
        PUMPKINS.append({"x": round(x, 3), "y": round(y, 3), "z": round(z, 3), "r": r, "face": round(face, 4), "key": key})

    # beside each pad's candelabras, facing out into the room
    for p in PADS + [PAD4]:
        zc = p["z"] - p["d"] / 2 + 0.75
        for s in (-1, 1):
            pk(p["x"] + s * 2.25, zc + 0.15, 0.27, 0.0, f"pad-{p['id']}")
            pk(p["x"] + s * 2.55, zc + 0.45, 0.17, 0.0, f"pad-{p['id']}")
    # down the aisle's edges, facing it
    for i, z in enumerate((-11.5, -1.5, 5.5)):
        for s in (-1, 1):
            pk(s * 2.3, z, 0.22, -s * math.pi / 2, "aisle")
    # either side of the front door, a heap
    for s in (-1, 1):
        R.begin(b, f"halloween:door{'we'[s > 0]}")
        pk(s * 2.3, 13.55, 0.34, math.pi, "door")
        pk(s * 2.85, 13.75, 0.22, math.pi, "door")
        pk(s * 2.5, 13.0, 0.16, math.pi, "door")
        for k in range(3):
            candle(b, P, s * (1.95 + 0.12 * k), 0.0, 13.85 - 0.08 * k, h=0.35 + 0.15 * k, r=0.045)
        R.end()
    # by the clock and the organ bench
    pk(CLOCK[0] + 0.35, CLOCK[1] + 0.75, 0.2, math.pi / 2, "clock")
    pk(-XI + 1.0, ORGAN_Z[1] + 0.45, 0.23, math.pi / 2, "organ")
    # two foam tombstones flanking the memorial wall's ends
    for s in (-1, 1):
        R.begin(b, f"halloween:stone{'we'[s > 0]}")
        x = s * 7.6
        b.prism(P["foam"], [(x - 0.32, 0), (x + 0.32, 0), (x + 0.32, 0.7), (x + 0.2, 0.84), (x, 0.88), (x - 0.2, 0.84), (x - 0.32, 0.7)],
                -13.75, -13.6)
        b.box(P["foam"], 0.8, 0.08, 0.3, x, 0, -13.67)
        R.end()
    # bats roosting on the ceiling beams, wings folded, eyes lit
    rng2 = random.Random(77)
    for i, (x, z) in enumerate(((-10, -5), (-5, 0), (5, -5), (10, 5), (-15, 5), (15, -10), (0, -10), (-10, 10), (10, 10))):
        R.begin(b, f"halloween:bat{i}")
        bx = x + rng2.uniform(-1.6, 1.6)
        y = CEIL - 0.26
        b.cyl(P["bat"], 0.004, (bx, y, z), (bx, y - 0.06, z), seg=3)
        b.lump(P["bat"], 0.09, 0.22, 0.08, bx, y - 0.3, z, seed=i, rnd=0.3, n=2)
        for s in (-1, 1):
            b.prism(P["bat"], [(bx + s * 0.03, y - 0.06), (bx + s * 0.11, y - 0.14), (bx + s * 0.07, y - 0.32)], z - 0.02, z + 0.02)
        b.lump(P["bat"], 0.07, 0.07, 0.07, bx, y - 0.37, z, seed=i + 40, rnd=0.2, n=2)
        for s in (-1, 1):
            b.box(P["eye"], 0.012, 0.012, 0.01, bx + s * 0.018, y - 0.34, z + 0.035)
        R.end()
    b.finish("zh-halloween.glb")


# ------------------------------------------------------------------ main

def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    P = palette()
    R = Registry()
    only = [a for a in sys.argv[sys.argv.index("--") + 1:]] if "--" in sys.argv else []
    for name, fn in (("hall", build_hall), ("pads", build_pads), ("props", build_props), ("halloween", build_halloween)):
        if only and name not in only:
            continue
        print(f"-- {name}")
        fn(P, R)
    NL = chr(10)
    if not only:
        eyes = [{"rect": [-XI + 0.3, XI - 0.3, -ZI + 0.3, ZI - 0.3], "y": 0.0}]
        with open(os.path.join(HERE, "zhub-faces.json"), "w", newline=NL) as f:
            json.dump({"eyes": eyes, "known": [], "faces": R.faces, "props": R.props}, f, indent=1)
        with open(os.path.join(HERE, "zhub-pumpkins.json"), "w", newline=NL) as f:
            json.dump(PUMPKINS, f, indent=1)
        print(f"wrote zhub-faces.json ({len(R.faces)} faces, {len(R.props)} props), zhub-pumpkins.json ({len(PUMPKINS)})")
    for n, t, v, by, lo, hi in Report.rows:
        size = os.path.getsize(os.path.join(HERE, n + ".glb"))
        print(f"{n:18}{t:8} tris {size / 1e6:6.2f} MB  {lo} {hi}")
    bad = R.overlaps()
    for a, c in bad:
        print("OVERLAP", a, c)
    print("ALL ZHUB MODELS EXPORTED")


main()
