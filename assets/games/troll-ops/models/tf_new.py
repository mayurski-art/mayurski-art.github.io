"""
The five new places (build_trollface_island.blender.py, phase 5), each in
its own frame as the map lays it (x east, z south), five GLBs:

  RANCH    Rage Ranch: the red barn with its hayloft (a stair up inside, the
           hay door east), the silo, the farmhouse with its porch, the
           fenced field with the scarecrow (its face the trollface canvas:
           TF_BUILT.ranch.face), the water tower, the tractor and its
           trailer, hay bales, feed troughs, the chicken coop, oil drums,
           the wrecked pickup. The three roads meet in its yard.
  LODGE    Lulz Lodge: four log cabins round the fire pit, the wash block,
           the jetty on the lake, tents, camp chairs, logs, the canoe rack,
           the notice board, string lights, the barbecue, bear-proof bins
  LIGHT    Lighthouse Point: the lighthouse you climb (a square stair round
           its core up to the lamp room, the gallery round it), the
           keeper's house by the road, the sea wall, the foghorn, the bell,
           lobster pots, the rowing boat on its trailer, the flagpole, the
           rain barrel, a bench facing the sea. The lamp room's glass is
           the map's (TF_BUILT.light.glass)
  PLANT    Problem Plant: two cooling towers you can walk in under, the
           turbine hall (two turbines, the gantry crane) with a stair to
           its roof, the control room (the desk of dials), the transformer
           yard, pipes and valves, pylons, the cooling pond, the forklift,
           drums, hard hats, warning signs
  GAS      Grin Gas: the canopy over four pumps, the diner (booths, the
           counter and stools, the jukebox, the pie case, the menu board;
           its windows the map's glass), the car wash, the price sign, tyre
           stacks, the air hose, the payphone, bins

Every solid thing registers a collider; doors and windows register faces
(rule 9).
"""
import math
from types import SimpleNamespace

from mathutils import Vector

from map_kit import mat
import tf_mid
from tf_city import flat, quad, car, bench, lamp_post, bin_, fire_escape
from tf_lake import sphere, box_shed, rowboat, crab_pot, LOOT, SIGNS
from tf_mid import MSite, rail_run, poster
from tf_skate import stairs

GLASS = []        # panes the map draws in glass: [cx, cy, cz, w, h, nx, nz] in map metres
EXTRA = {}        # what else the map needs from a place (the scarecrow's face)


def palette():
    P = dict(tf_mid.palette())
    P.update({
        "barn": mat("TF_BarnRed", 0xa8322a, 0.85),
        "barn_trim": mat("TF_BarnTrim", 0xf2ede2, 0.8),
        "tin": mat("TF_TinRoof", 0x5a6068, 0.6, 0.4),
        "silo": mat("TF_Silo", 0xc9ccd0, 0.45, 0.6),
        "hay": mat("TF_Hay", 0xe0b84a, 0.95),
        "soil": mat("TF_Soil", 0x6b4a2e, 0.95),
        "crop": mat("TF_Crop", 0x7fbf3a, 0.9),
        "farm_wall": mat("TF_FarmWall", 0xf0e6cf, 0.85),
        "farm_roof": mat("TF_FarmRoof", 0x5a3a2a, 0.8),
        "tractor": mat("TF_Tractor", 0x2f9a3a, 0.5, 0.2),
        "tractor_y": mat("TF_TractorYellow", 0xf2c21a, 0.5, 0.2),
        "rust": mat("TF_Rust", 0x8a4a2a, 0.9, 0.3),
        "straw": mat("TF_Straw", 0xd8b45a, 0.95),
        "sack": mat("TF_Sack", 0xe8dcc0, 0.9),
        "denim": mat("TF_Denim", 0x3a5a9a, 0.9),
        "flannel": mat("TF_Flannel", 0xc8322a, 0.9),
        "drum_r": mat("TF_DrumRed", 0xb8322a, 0.5, 0.4),
        "drum_b": mat("TF_DrumBlue", 0x2a5ab8, 0.5, 0.4),
        "drum_y": mat("TF_DrumYellow", 0xe8b81a, 0.5, 0.4),
        "chicken": mat("TF_Chicken", 0xf6f2ea, 0.8),
        "log": mat("TF_Log", 0x7a5232, 0.9),
        "log_end": mat("TF_LogEnd", 0xc8a070, 0.9),
        "cabin_roof": mat("TF_CabinRoof", 0x3a5a3a, 0.8),
        "ember": mat("TF_Ember", 0xff6a2a, 0.5, 0.0, 0xff5a1a, 2.4),
        "ash": mat("TF_Ash", 0x3a3634, 0.95),
        "tent_o": mat("TF_TentOrange", 0xf28a2a, 0.85),
        "tent_b": mat("TF_TentBlue", 0x2a7ad8, 0.85),
        "canvas": mat("TF_Canvas", 0xe8dcc0, 0.9),
        "bulb": mat("TF_Bulb", 0xffe2a0, 0.3, 0.0, 0xffc860, 2.2),
        "cooler": mat("TF_Cooler", 0x2a8ad8, 0.5),
        "canoe": mat("TF_Canoe", 0xd8582a, 0.6),
        "canoe_g": mat("TF_CanoeGreen", 0x2f8a54, 0.6),
        "lh_white": mat("TF_LighthouseWhite", 0xf4f2ee, 0.7),
        "lh_red": mat("TF_LighthouseRed", 0xc8322a, 0.7),
        "lh_lamp": mat("TF_LighthouseLamp", 0xfff2b0, 0.1, 0.0, 0xffe080, 3.0),
        "lh_cap": mat("TF_LighthouseCap", 0x23272c, 0.5, 0.5),
        "cottage": mat("TF_Cottage", 0xe6e2d6, 0.85),
        "slate": mat("TF_Slate", 0x3a4048, 0.8),
        "seawall": mat("TF_SeaWall", 0x8f8a7e, 0.95),
        "concrete": mat("TF_Concrete", 0xc2c0ba, 0.9),
        "concrete_dk": mat("TF_ConcreteDark", 0x8e8c86, 0.9),
        "tower_band": mat("TF_TowerBand", 0xd8322a, 0.7),
        "pipe": mat("TF_Pipe", 0x7a8a96, 0.45, 0.6),
        "pipe_y": mat("TF_PipeYellow", 0xe8c22a, 0.5, 0.3),
        "pipe_g": mat("TF_PipeGreen", 0x3a9a5a, 0.5, 0.3),
        "transformer": mat("TF_Transformer", 0x5a6a5a, 0.6, 0.4),
        "hazard": mat("TF_Hazard", 0xf2c21a, 0.6),
        "turbine": mat("TF_Turbine", 0x2a6ab8, 0.4, 0.5),
        "dial": mat("TF_Dial", 0xf6f6ee, 0.4),
        "dial_glow": mat("TF_DialGlow", 0x7aff8a, 0.3, 0.0, 0x5aff6a, 1.6),
        "warn": mat("TF_WarnLight", 0xff3a2a, 0.3, 0.0, 0xff2a1a, 2.0),
        "gas_red": mat("TF_GasRed", 0xd8322a, 0.5),
        "canopy_light": mat("TF_CanopyLight", 0xffffff, 0.2, 0.0, 0xf6fbff, 1.8),
        "pump": mat("TF_Pump", 0xeeeeee, 0.4, 0.2),
        "diner": mat("TF_DinerTeal", 0x3fb8b0, 0.5, 0.1),
        "booth": mat("TF_Booth", 0xc8322a, 0.5),
        "check_w": mat("TF_CheckWhite", 0xf4f4f0, 0.6),
        "check_b": mat("TF_CheckBlack", 0x1a1a1c, 0.6),
        "juke": mat("TF_Jukebox", 0xff8a3a, 0.3, 0.0, 0xff7a2a, 1.6),
        "pie": mat("TF_Pie", 0xd89a4a, 0.8),
        "brush": mat("TF_WashBrush", 0x2a7ad8, 0.9),
        "brush_r": mat("TF_WashBrushRed", 0xd8322a, 0.9),
    })
    return P


def glass(C, x0, z0, x1, z1, y0, y1, out):
    """A glass pane from (x0, z0) to (x1, z1), y0 to y1, facing `out` (nx, nz)."""
    w = math.hypot(x1 - x0, z1 - z0)
    if w < 0.05 or y1 - y0 < 0.05:
        return
    GLASS.append([round(C.ox + (x0 + x1) / 2, 3), round((y0 + y1) / 2, 3), round(C.oz + (z0 + z1) / 2, 3),
                  round(w, 3), round(y1 - y0, 3), round(out[0], 4), round(out[1], 4)])


def start(b, P, R, origin, seed):
    C = MSite(b, P, R, origin, seed)
    GLASS.clear()
    EXTRA.clear()
    return C


# ------------------------------------------------------------- shared props

def fence(C, pid, pts, h=1.15, m="wood", rails=2):
    """A post-and-rail fence along the points, a thin collider per run."""
    b, P = C.b, C.P
    for (ax, az), (cx, cz) in zip(pts, pts[1:]):
        C.begin(pid)
        L = math.hypot(cx - ax, cz - az)
        n = max(1, round(L / 2.4))
        for i in range(n + 1):
            t = i / n
            b.box(P["wood_dk"], 0.14, h, 0.14, ax + (cx - ax) * t, 0, az + (cz - az) * t)
        for k in range(rails):
            y = h * (0.45 + 0.45 * k / max(1, rails - 1))
            b.bar(P[m], (ax, y, az), (cx, y, cz), 0.07, 0.14)
        C.end()
        C.col((ax + cx) / 2, (az + cz) / 2, max(0.15, abs(cx - ax)), max(0.15, abs(cz - az)), h, 0, 1)


def hay_bale(C, pid, x, z, y=0.0, ry=0.0, rnd=False, on=None):
    b, P = C.b, C.P
    C.begin(pid, on)
    if rnd:
        c, s = math.cos(ry), math.sin(ry)
        b.cyl(P["hay"], 0.75, (x - c * 0.6, y + 0.75, z + s * 0.6), (x + c * 0.6, y + 0.75, z - s * 0.6), seg=14)
        C.end()
        C.col(x, z, 1.5, 1.5, 1.5, y, 1)
    else:
        b.box(P["hay"], 1.2, 0.5, 0.6, x, y, z, ry=ry, bevel=0.05)
        for o in (-0.3, 0.3):
            b.box(P["rope"], 0.03, 0.52, 0.62, x + math.cos(ry) * o, y - 0.01, z - math.sin(ry) * o, ry=ry)
        C.end()
        C.col(x, z, 1.2 * abs(math.cos(ry)) + 0.6 * abs(math.sin(ry)), 1.2 * abs(math.sin(ry)) + 0.6 * abs(math.cos(ry)), 0.5, y, 1)


def drum(C, pid, x, z, m="drum_r", y=0.0, on=None):
    b, P = C.b, C.P
    C.begin(pid, on)
    b.cyl(P[m], 0.3, (x, y, z), (x, y + 0.88, z), seg=12)
    for ry in (0.2, 0.68):
        b.cyl(P["steel"], 0.31, (x, y + ry, z), (x, y + ry + 0.04, z), seg=12, caps=False)
    C.end()
    C.col(x, z, 0.6, 0.6, 0.88, y, 1)


def stair_up(C, pid, m, x, z, dx, dz, y0, y1, w, on=None):
    """tf_skate.stairs as one prop: steps whose top is at (x, z), going down along (dx, dz)."""
    C.begin(pid, on)
    stairs(C, m, x, z, dx, dz, y0, y1, w)
    C.end()


def cyl_ring(C, pid, cx, cz, r, t, y0, h, m, seg=24, gap=None, slices=None, on=None):
    """A round wall: seg panels, one door gap (centre angle, half width in
    radians) left out; a collider per panel."""
    b, P = C.b, C.P
    C.begin(pid, on)
    for i in range(seg):
        a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
        am = (a0 + a1) / 2
        if gap and abs(math.atan2(math.sin(am - gap[0]), math.cos(am - gap[0]))) < gap[1]:
            continue
        p0 = (cx + r * math.cos(a0), cz + r * math.sin(a0))
        p1 = (cx + r * math.cos(a1), cz + r * math.sin(a1))
        L = math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 0.04
        mx, mz = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        b.box(P[m], L, h, t, mx, y0, mz, ry=-am + math.pi / 2)
        C.col(mx, mz, max(t, abs(p1[0] - p0[0])), max(t, abs(p1[1] - p0[1])), h, y0, 3)
    C.end()


# ============================================================== RAGE RANCH
#
# The ring's centre is the yard where the three roads meet; the coast is 20 m
# west, so the farm lies east of the junction between the shore road (north)
# and the south road.

BARN = (15.0, 29.0, -3.0, 7.0, 5.0)         # x0, x1, z0, z1, wall height
LOFT_Y = 2.8                                # the hayloft's floor
LOFT_X = 21.6                               # the loft runs from here to the east wall
SILO = (33.4, -1.6, 2.6, 12.0)              # x, z, radius, height
FARM = (22.5, 31.5, 14.5, 21.5, 3.2)        # the farmhouse
FIELD = (33.0, 40.5, 6.0, 23.5)             # x0, x1, z0, z1, fenced


def gambrel(C, pid, x0, x1, z0, z1, y0, rise, m_roof, m_wall, on=None):
    """A barn roof along x: two pitches each side, the gables filled in."""
    b, P = C.b, C.P
    d = z1 - z0
    zc = (z0 + z1) / 2
    prof = [(z0 - 0.45, y0 - 0.2), (z0 + d * 0.16, y0 + rise * 0.62), (zc, y0 + rise), (z1 - d * 0.16, y0 + rise * 0.62), (z1 + 0.45, y0 - 0.2)]
    C.begin(pid, on)
    for (a, c) in zip(prof, prof[1:]):
        L = math.hypot(c[0] - a[0], c[1] - a[1])
        ang = math.atan2(c[1] - a[1], c[0] - a[0])
        b.box(P[m_roof], x1 - x0 + 0.7, 0.12, L, (x0 + x1) / 2, (a[1] + c[1]) / 2 - 0.06, (a[0] + c[0]) / 2, rx=-ang)
    gable = [(z0, y0), (z0 + d * 0.16, y0 + rise * 0.62 - 0.1), (zc, y0 + rise - 0.12), (z1 - d * 0.16, y0 + rise * 0.62 - 0.1), (z1, y0)]
    for (xa, xb) in ((x0, x0 + 0.2), (x1 - 0.2, x1)):
        b.prism(P[m_wall], gable, xa, xb, axis="x")
    C.end()
    C.col((x0 + x1) / 2, zc, x1 - x0 + 0.7, d + 0.9, rise, y0, 3)


def tractor(C, pid, x, z, ry):
    """A farm tractor, its nose along +x before ry: big back wheels, cab."""
    b, P = C.b, C.P
    c, s = math.cos(ry), math.sin(ry)
    L = lambda lx, lz: (x + lx * c + lz * s, z - lx * s + lz * c)      # noqa: E731
    C.begin(pid)
    b.box(P["tractor"], 2.2, 0.8, 1.0, *L(0.4, 0)[:1], 0.7, L(0.4, 0)[1], ry=ry, bevel=0.05)          # the bonnet
    b.box(P["tractor"], 1.2, 0.7, 1.3, *L(-0.9, 0)[:1], 0.7, L(-0.9, 0)[1], ry=ry, bevel=0.04)
    for (lx, lz) in ((-1.4, 0.55), (-1.4, -0.55), (-0.4, 0.55), (-0.4, -0.55)):                     # the cab's posts
        px, pz = L(lx, lz)
        b.box(P["ink"], 0.08, 1.3, 0.08, px, 1.4, pz, ry=ry)
    b.box(P["tractor"], 1.3, 0.1, 1.3, *L(-0.9, 0)[:1], 2.7, L(-0.9, 0)[1], ry=ry)
    b.box(P["tractor_y"], 0.5, 0.08, 0.5, *L(-0.9, 0)[:1], 1.4, L(-0.9, 0)[1], ry=ry)                 # the seat
    px, pz = L(1.2, 0.25)
    b.cyl(P["ink"], 0.07, (px, 1.5, pz), (px, 2.4, pz), seg=8)                                       # the exhaust
    for (lx, lz, r, w) in ((-1.0, 0.9, 0.85, 0.5), (-1.0, -0.9, 0.85, 0.5), (1.2, 0.7, 0.5, 0.3), (1.2, -0.7, 0.5, 0.3)):
        wx, wz = L(lx, lz)
        b.cyl(P["tyre"], r, (wx + s * w / 2, r, wz + c * w / 2), (wx - s * w / 2, r, wz - c * w / 2), seg=16)
        b.cyl(P["tractor_y"], r * 0.55, (wx + s * (w / 2 + 0.01), r, wz + c * (w / 2 + 0.01)), (wx - s * (w / 2 + 0.01), r, wz - c * (w / 2 + 0.01)), seg=12)
    C.end()
    C.col(x, z, abs(3.4 * c) + abs(2.3 * s), abs(3.4 * s) + abs(2.3 * c), 2.8, 0, 1.5)


def pickup(C, pid, x, z, ry, m, wreck=False):
    """A pickup, its nose along +x before ry; the wreck sits on its rims, rusted, a door gone."""
    b, P = C.b, C.P
    c, s = math.cos(ry), math.sin(ry)
    L = lambda lx, lz: (x + lx * c + lz * s, z - lx * s + lz * c)      # noqa: E731
    y0 = 0.1 if wreck else 0.35
    C.begin(pid)
    b.box(P[m], 5.0, 0.6, 1.9, x, y0, z, ry=ry, bevel=0.05)
    b.box(P[m], 1.7, 0.6, 1.8, *L(0.5, 0)[:1], y0 + 0.6, L(0.5, 0)[1], ry=ry, bevel=0.06)
    b.box(P["glass" if not wreck else "ink"], 1.6, 0.5, 1.7, *L(0.5, 0)[:1], y0 + 0.64, L(0.5, 0)[1], ry=ry)
    for lz in (-0.92, 0.92):                                                                          # the bed's sides
        px, pz = L(-1.4, lz)
        b.box(P[m], 2.1, 0.45, 0.07, px, y0 + 0.6, pz, ry=ry)
    px, pz = L(-2.45, 0)
    b.box(P[m], 0.07, 0.45, 1.9, px, y0 + 0.6, pz, ry=ry)
    for (lx, lz) in ((1.6, 0.95), (1.6, -0.95), (-1.6, 0.95), (-1.6, -0.95)):
        wx, wz = L(lx, lz)
        r = 0.22 if wreck else 0.38
        b.cyl(P["steel" if wreck else "tyre"], r, (wx + s * 0.13, r, wz + c * 0.13), (wx - s * 0.13, r, wz - c * 0.13), seg=12)
    if wreck:
        for k in range(4):
            px, pz = L(-1.6 + k * 0.9, 0.3 * (k % 2))
            b.box(P["rust"], 0.5, 0.02, 0.4, px, y0 + 0.605, pz, ry=ry + k)                         # rust patches
        px, pz = L(-1.2, 0.2)
        b.lump(P["tyre"], 0.9, 0.35, 0.9, px, y0 + 0.6, pz, seed=3)                                  # a spare in the bed
    C.end()
    C.col(x, z, abs(5.0 * c) + abs(1.9 * s), abs(5.0 * s) + abs(1.9 * c), y0 + 1.2, 0, 1.5)


def ranch_build(b, P, R, origin):
    C = start(b, P, R, origin, 51)
    rng = C.rng
    x0, x1, z0, z1, H = BARN
    bx, bz = (x0 + x1) / 2, (z0 + z1) / 2
    # the yard: packed earth round the junction and up to the barn doors
    flat(b, P["soil"], 9.0, 0.012, 2.0, 11.0, 13.0)          # a decal, no prop
    # the barn: red boards, white trim, the big doors west to the yard, a
    # door east, the hay door up the east gable over the loft
    box_shed(C, "barn", bx, bz, x1 - x0, z1 - z0, H,
             [("w", 2.0, 4.8, 4.2), ("e", 4.6, 2.0, 2.6)],
             [("e", -0.4, 2.2, 3.2, 4.8)], "barn", "tin", t=0.25, roof_pitch=False)
    gambrel(C, "barn-roof", x0, x1, z0, z1, H + 0.1, 3.8, "tin", "barn", on=("barn", "barn-trim"))
    C.containers = ("barn",)
    C.begin("barn-trim")
    for (xx, zz) in ((x0 - 0.02, 2.0), ):
        for s in (-1, 1):
            b.box(P["barn_trim"], 0.3, 4.4, 0.25, xx, 0, zz + s * 2.55)                              # the door frame
        b.box(P["barn_trim"], 0.3, 0.25, 5.35, xx, 4.2, zz)
    for zz in (z0 - 0.02, z1 + 0.02):
        b.box(P["barn_trim"], x1 - x0 + 0.1, 0.22, 0.3, bx, H - 0.25, zz)
        for xx in (x0 + 0.1, x1 - 0.1):
            b.box(P["barn_trim"], 0.3, H, 0.3, xx, 0, zz)
    # the west doors slid open along the wall, their white X braces
    for s in (-1, 1):
        zz = 2.0 + s * 4.2
        b.box(P["barn"], 0.12, 4.0, 2.4, x0 - 0.22, 0.05, zz)
        b.bar(P["barn_trim"], (x0 - 0.3, 0.2, zz - 1.1), (x0 - 0.3, 3.9, zz + 1.1), 0.14)
        b.bar(P["barn_trim"], (x0 - 0.3, 0.2, zz + 1.1), (x0 - 0.3, 3.9, zz - 1.1), 0.14)
    b.box(P["steel"], 0.1, 0.1, 10.8, x0 - 0.2, 4.15, 2.0)                                           # the door rail
    C.end()
    C.containers = ("barn", "barn-trim")
    C.col(x0 - 0.22, 2.0 - 4.2, 0.12, 2.4, 4.0, 0, 1)
    C.col(x0 - 0.22, 2.0 + 4.2, 0.12, 2.4, 4.0, 0, 1)
    C.sign("RAGE RANCH", bx, H + 1.5, z1 + 0.5, 0, 1, 6.0, 1.0, 0xf2ede2)
    # the hayloft: a floor over the east half, a stair up the north wall, hay up there
    C.begin("hayloft")
    b.box(P["plank"], x1 - LOFT_X - 0.25, 0.15, z1 - z0 - 0.5, (LOFT_X + x1 - 0.25) / 2, LOFT_Y - 0.15, bz)
    for zz in (z0 + 2.5, bz + 1.0, z1 - 2.0):
        b.box(P["wood_dk"], 0.25, LOFT_Y - 0.15, 0.25, LOFT_X + 0.15, 0, zz)                           # posts
    rail_pts = [(LOFT_X + 0.05, z0 + 1.6), (LOFT_X + 0.05, z1 - 0.25)]
    for (ax, az), (cx_, cz_) in zip(rail_pts, rail_pts[1:]):
        for yy in (0.5, 1.0):
            b.bar(P["wood"], (ax, LOFT_Y + yy, az), (cx_, LOFT_Y + yy, cz_), 0.08)
        for k in range(5):
            t = k / 4
            b.box(P["wood_dk"], 0.1, 1.0, 0.1, ax, LOFT_Y, az + (cz_ - az) * t)
    C.end()
    C.col((LOFT_X + x1 - 0.25) / 2, bz, x1 - LOFT_X - 0.25, z1 - z0 - 0.5, 0.15, LOFT_Y - 0.15, 3)
    C.col(LOFT_X + 0.05, (z0 + 1.6 + z1 - 0.25) / 2, 0.15, z1 - 0.25 - z0 - 1.6, 1.0, LOFT_Y, 1)
    for zz in (z0 + 2.5, bz + 1.0, z1 - 2.0):
        C.col(LOFT_X + 0.15, zz, 0.25, 0.25, LOFT_Y - 0.15, 0, 1)
    stair_up(C, "loft-stair", P["plank_dk"], LOFT_X - 0.05, z0 + 0.85, -1, 0, 0.0, LOFT_Y, 1.1)
    for k, (hx, hz, hy) in enumerate(((26.5, -1.4, 0.0), (26.5, -0.8, 0.5), (27.6, -1.4, 0.0), (27.6, 0.0, 0.0), (25.2, 5.6, 0.0))):
        hay_bale(C, f"loft-hay{k}", hx, hz, LOFT_Y + hy, ry=math.pi / 2 if k < 4 else 0.0, on=("hayloft", f"loft-hay{k - 1}") if k == 1 else "hayloft")
    C.loot(24.0, LOFT_Y, 2.0)
    C.loot(27.8, LOFT_Y, 3.6)
    # downstairs: two stalls on the south wall, the tool wall, the workbench
    C.begin("barn-stalls", on="hayloft")
    for k, xx in enumerate((22.5, 25.5, 28.5)):
        b.box(P["wood"], 0.12, 1.4, 2.6, xx, 0, z1 - 1.55)
    b.box(P["wood"], 6.0, 0.12, 0.12, 25.5, 1.3, z1 - 2.85)
    C.end()
    for xx in (22.5, 25.5, 28.5):
        C.col(xx, z1 - 1.55, 0.14, 2.6, 1.4, 0, 1)
    for k, xx in enumerate((24.0, 27.0)):
        C.begin(f"trough{k}", on=("barn-stalls", "hayloft"))
        b.box(P["steel"], 1.4, 0.5, 0.5, xx, 0, z1 - 0.6)
        b.box(P["water"], 1.3, 0.02, 0.4, xx, 0.45, z1 - 0.6)
        C.end()
    C.begin("tool-wall")
    b.box(P["wood_dk"], 3.2, 1.6, 0.06, 18.4, 1.0, z1 - 0.3)
    for k in range(6):
        tx = 17.1 + k * 0.52
        b.box(P["steel"], 0.06, 0.9, 0.04, tx, 1.3, z1 - 0.36, rz=0.05 * (k - 3))
        b.box(P[("wood", "steel", "red")[k % 3]], 0.26 if k % 2 else 0.12, 0.12, 0.05, tx, 2.15, z1 - 0.37)
    C.end()
    C.begin("workbench", on="tool-wall")
    b.box(P["wood"], 2.4, 0.08, 0.8, 18.4, 0.85, z1 - 0.75)
    for (lx, lz) in ((-1.1, -0.3), (1.1, -0.3), (-1.1, 0.3), (1.1, 0.3)):
        b.box(P["wood_dk"], 0.08, 0.85, 0.08, 18.4 + lx, 0, z1 - 0.75 + lz)
    b.box(P["red"], 0.5, 0.3, 0.25, 17.8, 0.93, z1 - 0.7)                                            # a toolbox
    b.cyl(P["drum_y"], 0.12, (19.2, 0.93, z1 - 0.7), (19.2, 1.25, z1 - 0.7), seg=8)                  # an oil can
    C.end()
    C.col(18.4, z1 - 0.75, 2.4, 0.8, 0.95, 0, 1)
    C.containers = ()
    # the silo: a steel drum with a domed cap, a cage ladder, a chute to the barn
    sx, sz, sr, sh = SILO
    C.begin("silo", on=("barn", "barn-roof", "barn-trim"))
    b.cyl(P["silo"], sr, (sx, 0, sz), (sx, sh, sz), seg=24)
    for k in range(1, 6):
        b.cyl(P["steel"], sr + 0.04, (sx, k * sh / 6, sz), (sx, k * sh / 6 + 0.1, sz), seg=24, caps=False)
    sphere(b, P["silo"], (sx, sh, sz), sr, seg=24, ring=8)
    b.cyl(P["concrete"], sr + 0.3, (sx, 0, sz), (sx, 0.4, sz), seg=24)
    for s in (-0.3, 0.3):
        b.box(P["steel"], 0.06, sh + 0.8, 0.06, sx - sr - 0.25, 0, sz + s)
    for k in range(int(sh / 0.4)):
        b.box(P["steel"], 0.06, 0.04, 0.66, sx - sr - 0.25, 0.3 + k * 0.4, sz)
    b.bar(P["steel"], (sx - sr + 0.4, sh - 1.0, sz), (x1 + 0.2, H - 0.4, sz + 0.5), 0.4)              # the chute
    C.end()
    C.col(sx, sz, 2 * sr + 0.6, 2 * sr + 0.6, sh + sr, 0, 3)
    # the farmhouse: cream boards, a porch west to the road, its windows
    f0, f1, g0, g1, FH = FARM
    fx, fz = (f0 + f1) / 2, (g0 + g1) / 2
    box_shed(C, "farmhouse", fx, fz, f1 - f0, g1 - g0, FH,
             [("w", fz, 1.2, 2.3), ("n", fx + 2.6, 1.1, 2.2)],
             [("w", fz - 2.2, 1.2, 1.0, 2.2), ("w", fz + 2.2, 1.2, 1.0, 2.2), ("s", fx - 2.0, 1.4, 1.0, 2.2), ("e", fz, 1.4, 1.0, 2.2)],
             "farm_wall", "farm_roof", t=0.22)
    C.containers = ("farmhouse",)
    for (x0_, z0_, x1_, z1_, n) in ((f0, fz - 2.8, f0, fz - 1.6, (-1, 0)), (f0, fz + 1.6, f0, fz + 2.8, (-1, 0)),
                                    (fx - 2.7, g1, fx - 1.3, g1, (0, 1)), (f1, fz - 0.7, f1, fz + 0.7, (1, 0))):
        glass(C, x0_ + n[0] * 0.13, z0_ + n[1] * 0.13, x1_ + n[0] * 0.13, z1_ + n[1] * 0.13, 1.0, 2.2, n)
    C.begin("farm-kitchen")
    b.box(P["wood"], 3.0, 0.9, 0.6, fx + 2.0, 0, g0 + 0.55)
    b.box(P["chrome"], 0.6, 0.05, 0.4, fx + 2.6, 0.9, g0 + 0.5)
    b.box(P["fridge"], 0.8, 1.9, 0.7, f1 - 0.6, 0, g0 + 0.6)
    C.end()
    C.col(fx + 2.0, g0 + 0.55, 3.0, 0.6, 0.9, 0, 1)
    C.col(f1 - 0.6, g0 + 0.6, 0.8, 0.7, 1.9, 0, 1)
    C.begin("farm-table")
    b.box(P["wood"], 1.8, 0.06, 1.0, fx - 1.0, 0.76, fz + 0.6)
    for (lx, lz) in ((-0.8, -0.4), (0.8, -0.4), (-0.8, 0.4), (0.8, 0.4)):
        b.box(P["wood_dk"], 0.07, 0.76, 0.07, fx - 1.0 + lx, 0, fz + 0.6 + lz)
    b.box(P["flannel"], 1.9, 0.01, 0.3, fx - 1.0, 0.82, fz + 0.6)                                   # the runner
    b.cyl(P["mug"], 0.06, (fx - 1.2, 0.82, fz + 0.4), (fx - 1.2, 0.94, fz + 0.4), seg=8)
    C.end()
    C.col(fx - 1.0, fz + 0.6, 1.8, 1.0, 0.82, 0, 1)
    C.begin("farm-bed")
    b.box(P["wood_dk"], 1.6, 0.45, 2.1, fx + 2.6, 0, g1 - 1.3)
    b.box(P["blanket"], 1.5, 0.15, 1.6, fx + 2.6, 0.45, g1 - 1.1)
    b.box(P["bed"], 1.4, 0.12, 0.4, fx + 2.6, 0.48, g1 - 2.1)
    C.end()
    C.col(fx + 2.6, g1 - 1.3, 1.6, 2.1, 0.6, 0, 1)
    C.containers = ()
    C.begin("porch", on="farmhouse")
    b.box(P["wood"], 2.0, 0.25, 6.6, f0 - 1.0, 0, fz)
    b.box(P["farm_roof"], 2.4, 0.1, 7.0, f0 - 1.1, 2.75, fz, rz=-0.12)
    for zz in (fz - 3.1, fz + 3.1):
        b.box(P["barn_trim"], 0.14, 2.6, 0.14, f0 - 1.9, 0.25, zz)
    C.end()
    C.col(f0 - 1.0, fz, 2.0, 6.6, 0.25, 0, 3)
    C.col(f0 - 1.1, fz, 2.4, 7.0, 0.15, 2.7, 3)
    for zz in (fz - 3.1, fz + 3.1):
        C.col(f0 - 1.9, zz, 0.14, 0.14, 2.6, 0.25, 1)
    C.begin("rocker", on="porch")
    b.box(P["wood_dk"], 0.55, 0.06, 0.55, f0 - 1.2, 0.7, fz - 2.5)
    b.box(P["wood_dk"], 0.06, 0.6, 0.55, f0 - 0.95, 0.75, fz - 2.5)
    for s in (-0.25, 0.25):
        b.box(P["wood_dk"], 0.7, 0.05, 0.05, f0 - 1.2, 0.27, fz - 2.5 + s)
        b.box(P["wood_dk"], 0.05, 0.45, 0.05, f0 - 1.2, 0.27, fz - 2.5 + s)
    C.end()
    # the field: furrows, the crop, a fence round it with a gate on the yard side
    a0, a1, c0, c1 = FIELD
    C.begin("field")
    flat(b, P["soil"], (a0 + a1) / 2, 0.012, (c0 + c1) / 2, a1 - a0, c1 - c0)
    for k in range(int((a1 - a0 - 1.0) / 1.1)):
        xx = a0 + 0.9 + k * 1.1
        b.box(P["soil"], 0.45, 0.16, c1 - c0 - 1.6, xx, 0, (c0 + c1) / 2)
        zz = c0 + 1.2
        while zz < c1 - 1.2:
            if rng.random() < 0.85:
                b.box(P["crop"], 0.3, rng.uniform(0.35, 0.6), 0.3, xx + rng.uniform(-0.05, 0.05), 0.16, zz, ry=rng.uniform(0, 1.5))
            zz += 0.7
    C.end()
    C.containers = ("field",)
    fence(C, "field-fence", [(a0, c0 + 3.0), (a0, c0), (a1, c0), (a1, c1), (a0, c1), (a0, c0 + 6.0)])
    # the scarecrow: a straw man on a cross in the field, his face the trollface
    scx, scz = 36.3, 15.0
    C.begin("scarecrow", on="field")
    b.box(P["wood_dk"], 0.14, 2.6, 0.14, scx, 0, scz)
    b.box(P["wood_dk"], 0.12, 0.12, 1.9, scx, 1.75, scz)
    b.box(P["flannel"], 0.4, 0.75, 0.62, scx, 1.15, scz)
    b.box(P["denim"], 0.36, 0.75, 0.5, scx, 0.42, scz)
    for s in (-1, 1):
        b.box(P["flannel"], 0.24, 0.24, 0.7, scx, 1.62, scz + s * 0.62)
        b.box(P["straw"], 0.16, 0.24, 0.16, scx, 1.6, scz + s * 1.05)
    b.box(P["sack"], 0.5, 0.56, 0.52, scx, 1.9, scz)
    b.cyl(P["straw"], 0.55, (scx, 2.42, scz), (scx, 2.46, scz), seg=14)                              # the hat's brim
    b.cyl(P["straw"], 0.3, (scx, 2.46, scz), (scx, 2.75, scz), seg=12, r2=0.26)
    C.end()
    C.col(scx, scz, 0.5, 0.7, 1.9, 0, 1)
    EXTRA["face"] = [round(C.ox + scx - 0.27, 3), 2.18, round(C.oz + scz, 3), 0.5, round(-math.pi / 2, 4)]
    C.face("scarecrow-face", "scarecrow", (scx - 0.27, 2.18, scz), (-1, 0), 0.5, 0.5)
    tractor(C, "tractor", 38.0, 10.0, -math.pi / 2)
    C.containers = ()
    # the trailer of bales by the barn's north wall, round bales, troughs
    C.begin("hay-trailer")
    b.box(P["wood"], 4.0, 0.15, 2.0, 21.0, 0.7, -5.6)
    b.box(P["steel"], 0.1, 0.1, 1.8, 18.6, 0.6, -5.6)
    b.bar(P["steel"], (18.6, 0.65, -5.6), (17.6, 0.5, -5.6), 0.1)
    for s in (-1, 1):
        b.cyl(P["tyre"], 0.38, (21.0, 0.38, -5.6 + s * 1.1), (21.0, 0.38, -5.6 + s * 0.85), seg=12)
    C.end()
    C.col(21.0, -5.6, 4.0, 2.0, 0.85, 0, 1)
    for k, (hx, hz, hy) in enumerate(((20.0, -5.95, 0.85), (21.3, -5.95, 0.85), (20.0, -5.25, 0.85), (21.3, -5.25, 0.85), (20.65, -5.6, 1.35))):
        hay_bale(C, f"trailer-hay{k}", hx, hz, hy, on=("hay-trailer",) + (tuple(f"trailer-hay{j}" for j in range(4)) if k == 4 else ()))
    for k, (hx, hz) in enumerate(((25.2, -5.6), (27.0, -5.8))):
        hay_bale(C, f"round-bale{k}", hx, hz, rnd=True, ry=0.3 * k)
    C.begin("feed-trough")
    b.box(P["wood"], 2.4, 0.55, 0.7, 12.2, 0, 10.8, ry=0.2)
    b.box(P["hay"], 2.2, 0.05, 0.5, 12.2, 0.5, 10.8, ry=0.2)
    C.end()
    C.col(12.2, 10.8, 2.4, 1.1, 0.55, 0, 1)
    # the coop: a little hut on legs with a ramp, chickens about it
    C.begin("coop")
    b.box(P["barn"], 2.2, 1.2, 1.6, 13.5, 0.6, 14.6)
    b.prism(P["tin"], [(13.5 - 1.3, 1.8), (13.5 + 1.3, 1.8), (13.5, 2.4)], 14.6 - 0.95, 14.6 + 0.95)
    for (lx, lz) in ((-1.0, -0.7), (1.0, -0.7), (-1.0, 0.7), (1.0, 0.7)):
        b.box(P["wood_dk"], 0.1, 0.6, 0.1, 13.5 + lx, 0, 14.6 + lz)
    b.box(P["plank_dk"], 0.5, 0.05, 1.2, 12.2, 0.0, 14.6, rz=-0.5)
    for k in range(4):
        hx, hz = 11.4 + rng.uniform(-0.8, 0.6), 12.4 + k * 0.5 + rng.uniform(-0.2, 0.2)
        b.box(P["chicken"], 0.26, 0.22, 0.18, hx, 0.14, hz, ry=rng.uniform(0, 3))
        b.box(P["chicken"], 0.1, 0.14, 0.1, hx + 0.12, 0.3, hz, ry=rng.uniform(0, 3))
        b.box(P["red"], 0.04, 0.05, 0.03, hx + 0.13, 0.44, hz)
        for s in (-0.05, 0.05):
            b.box(P["tractor_y"], 0.02, 0.14, 0.02, hx, 0, hz + s)
    C.end()
    C.col(13.5, 14.6, 2.2, 1.6, 2.4, 0, 1)
    # the water tower east of the silo
    wx, wz = 38.8, -6.2
    C.begin("water-tower")
    for (lx, lz) in ((-1.4, -1.4), (1.4, -1.4), (-1.4, 1.4), (1.4, 1.4)):
        b.bar(P["wood_dk"], (wx + lx, 0, wz + lz), (wx + lx * 0.7, 7.0, wz + lz * 0.7), 0.2)
    for y in (2.3, 4.6):
        f = 1 - 0.3 * y / 7.0
        for (ax, az, cx_, cz_) in ((-1, -1, 1, -1), (1, -1, 1, 1), (1, 1, -1, 1), (-1, 1, -1, -1)):
            b.bar(P["wood_dk"], (wx + ax * 1.4 * f, y, wz + az * 1.4 * f), (wx + cx_ * 1.4 * f, y, wz + cz_ * 1.4 * f), 0.1)
    b.box(P["wood"], 3.2, 0.15, 3.2, wx, 7.0, wz)
    b.cyl(P["wood"], 1.7, (wx, 7.15, wz), (wx, 10.0, wz), seg=18)
    for y in (7.6, 8.6, 9.5):
        b.cyl(P["steel"], 1.73, (wx, y, wz), (wx, y + 0.08, wz), seg=18, caps=False)
    b.cyl(P["tin"], 1.9, (wx, 10.0, wz), (wx, 11.0, wz), seg=18, r2=0.1)
    C.end()
    for (lx, lz) in ((-1.4, -1.4), (1.4, -1.4), (-1.4, 1.4), (1.4, 1.4)):
        C.col(wx + lx * 0.95, wz + lz * 0.95, 0.5, 0.5, 7.0, 0, 1)
    C.col(wx, wz, 3.4, 3.4, 4.0, 7.0, 3)
    # the wreck, the drums, a stack of tyres, the mailbox at the road
    pickup(C, "wrecked-pickup", 18.4, 11.2, 0.35, "rust", wreck=True)
    for k, (dx_, dz_, m) in enumerate(((31.2, 9.3, "drum_r"), (31.9, 9.9, "drum_b"), (31.0, 10.4, "drum_y"))):
        drum(C, f"ranch-drum{k}", dx_, dz_, m)
    C.begin("ranch-tyres")
    for k in range(3):
        b.cyl(P["tyre"], 0.45, (9.0, k * 0.28, -6.6), (9.0, k * 0.28 + 0.28, -6.6), seg=14)
    C.end()
    C.col(9.0, -6.6, 0.9, 0.9, 0.84, 0, 1)
    C.begin("mailbox")
    b.box(P["wood_dk"], 0.1, 1.1, 0.1, 7.0, 0, 8.4)
    b.box(P["red"], 0.25, 0.25, 0.45, 7.0, 1.1, 8.4, bevel=0.04)
    C.end()
    lamp_post(C, "ranch-lamp0", 12.5, -3.5, 0.0)
    lamp_post(C, "ranch-lamp1", 21.5, 9.0, math.pi)
    C.loot(16.5, 0.0, -1.2)
    b.finish("tf-ranch-p5.glb")


# ============================================================== LULZ LODGE
#
# The west road runs through the ring's centre from the north-west to the
# lake; the camp is north-east of it, the lake 28 m east (the jetty), the
# wash block and the tents south of the road.

PIT = (8.5, -12.5)


def log_cabin(C, pid, x, z, face):
    """A 4.2 x 3.6 log cabin, the door facing `face` ('n' 's' 'e' 'w'),
    a window either side of it; a bunk, a stove and a table inside."""
    b, P = C.b, C.P
    w, d = (4.2, 3.6) if face in ("n", "s") else (3.6, 4.2)
    box_shed(C, pid, x, z, w, d, 2.5, [(face, x if face in ("n", "s") else z, 1.0, 2.1)], [], "log", "cabin_roof", t=0.28)
    C.containers = (pid,)
    C.begin(f"{pid}-logs")
    xw, xe, zn, zs = x - w / 2, x + w / 2, z - d / 2, z + d / 2
    for k in range(6):                                                     # the log ends at the corners
        y = 0.2 + k * 0.4
        for (cx_, cz_) in ((xw, zn), (xe, zn), (xw, zs), (xe, zs)):
            b.cyl(P["log_end"], 0.16, (cx_ - 0.2, y, cz_), (cx_ + 0.2, y, cz_), seg=8)
    C.end()
    C.containers = (pid, f"{pid}-logs")
    inner = {"n": (0, 1), "s": (0, -1), "e": (-1, 0), "w": (1, 0)}[face]
    bx_, bz_ = x - inner[0] * (d / 2 - 0.6) if face in ("e", "w") else x + 1.0, z - inner[1] * (d / 2 - 0.8) if face in ("n", "s") else z + 1.0
    C.begin(f"{pid}-bunk")
    b.box(P["wood_dk"], 1.9 if face in ("n", "s") else 0.9, 0.45, 0.9 if face in ("n", "s") else 1.9, bx_, 0, bz_)
    b.box(P["blanket"], 1.7 if face in ("n", "s") else 0.8, 0.12, 0.8 if face in ("n", "s") else 1.7, bx_, 0.45, bz_)
    C.end()
    C.col(bx_, bz_, 1.9 if face in ("n", "s") else 0.9, 0.9 if face in ("n", "s") else 1.9, 0.6, 0, 1)
    sx_, sz_ = (x - 1.3, z - inner[1] * (d / 2 - 0.5)) if face in ("n", "s") else (x - inner[0] * (w / 2 - 0.5), z - 1.3)
    C.begin(f"{pid}-stove")
    b.box(P["ink"], 0.6, 0.7, 0.5, sx_, 0, sz_)
    b.cyl(P["ink"], 0.08, (sx_, 0.7, sz_), (sx_, 2.9, sz_), seg=8)
    C.end()
    C.col(sx_, sz_, 0.6, 0.5, 0.7, 0, 1)
    C.containers = ()


def lodge_build(b, P, R, origin):
    C = start(b, P, R, origin, 61)
    rng = C.rng
    px, pz = PIT
    # string lights from the cabins' corners over the pit
    C.begin("string-lights")
    poles = [(px - 6.5, pz + 2.6), (px - 6.5, pz - 6.0), (px + 7.5, pz - 6.0), (px + 7.5, pz + 2.6)]
    for (qx, qz) in poles:
        b.cyl(P["wood_dk"], 0.07, (qx, 0, qz), (qx, 3.3, qz), seg=6)
    for (a, c) in ((poles[0], poles[2]), (poles[1], poles[3])):
        prev = None
        for k in range(13):
            t = k / 12
            y = 3.2 - 0.9 * math.sin(math.pi * t)
            p = (a[0] + (c[0] - a[0]) * t, y, a[1] + (c[1] - a[1]) * t)
            if prev:
                b.bar(P["ink"], prev, p, 0.02)
            b.box(P["bulb"], 0.1, 0.13, 0.1, p[0], y - 0.14, p[2])
            prev = p
    C.end()
    for (qx, qz) in poles:
        C.col(qx, qz, 0.16, 0.16, 3.3, 0, 1)
    C.containers = ("string-lights",)
    # the fire pit: a ring of stones, logs, embers; log benches and camp chairs round it
    C.begin("fire-pit")
    for k in range(12):
        a = 2 * math.pi * k / 12
        b.lump(P["stone"], 0.45, 0.32, 0.4, px + 1.05 * math.cos(a), 0, pz + 1.05 * math.sin(a), seed=k, ry=a)
    b.cyl(P["ash"], 0.85, (px, 0, pz), (px, 0.05, pz), seg=14)
    for k in range(4):
        a = k * math.pi / 4
        b.cyl(P["log"], 0.08, (px - 0.55 * math.cos(a), 0.06, pz - 0.55 * math.sin(a)), (px + 0.1 * math.cos(a), 0.45, pz + 0.1 * math.sin(a)), seg=6)
    for k in range(7):
        b.box(P["ember"], 0.16, 0.08, 0.14, px + rng.uniform(-0.35, 0.35), 0.05, pz + rng.uniform(-0.35, 0.35), ry=rng.uniform(0, 3))
    C.end()
    C.col(px, pz, 2.5, 2.5, 0.35, 0, 1)
    for k, a in enumerate((0.3, 1.9, 3.5, 5.0)):
        lx_, lz_ = px + 3.2 * math.cos(a), pz + 3.2 * math.sin(a)
        C.begin(f"log-seat{k}")
        b.cyl(P["log"], 0.25, (lx_ - 0.9 * math.sin(a), 0.25, lz_ + 0.9 * math.cos(a)), (lx_ + 0.9 * math.sin(a), 0.25, lz_ - 0.9 * math.cos(a)), seg=10)
        C.end()
        C.col(lx_, lz_, abs(1.8 * math.sin(a)) + 0.5, abs(1.8 * math.cos(a)) + 0.5, 0.5, 0, 1)
    for k, a in enumerate((1.1, 2.7, 4.3)):
        cx_, cz_ = px + 2.6 * math.cos(a), pz + 2.6 * math.sin(a)
        ry = -a + math.pi / 2
        C.begin(f"camp-chair{k}")
        m = ("tent_b", "green", "tent_o")[k]
        b.box(P[m], 0.55, 0.05, 0.5, cx_, 0.42, cz_, ry=ry)
        b.box(P[m], 0.55, 0.55, 0.05, cx_ + 0.24 * math.cos(a), 0.45, cz_ + 0.24 * math.sin(a), ry=ry, rx=0.15)
        for s in (-0.25, 0.25):
            b.bar(P["steel"], (cx_ - 0.2 * math.cos(a) + s * math.sin(a), 0, cz_ - 0.2 * math.sin(a) - s * math.cos(a)),
                  (cx_ + 0.2 * math.cos(a) + s * math.sin(a), 0.42, cz_ + 0.2 * math.sin(a) - s * math.cos(a)), 0.03)
        C.end()
    C.begin("cooler")
    b.box(P["cooler"], 0.7, 0.45, 0.42, px + 3.6, 0, pz - 2.6, bevel=0.04)
    b.box(P["white"], 0.72, 0.08, 0.44, px + 3.6, 0.45, pz - 2.6)
    C.end()
    # four cabins round the pit, their doors to it
    C.containers = ()
    cabins = [("cabin0", px - 9.0, pz - 1.0, "e"), ("cabin1", px - 4.0, pz - 8.5, "s"), ("cabin2", px + 5.0, pz - 8.5, "s"), ("cabin3", px + 10.0, pz - 1.0, "w")]
    for pid, x, z, face in cabins:
        log_cabin(C, pid, x, z, face)
    C.loot(px - 4.0, 0.0, pz - 8.5)
    # the notice board by the road, LULZ LODGE over it
    C.begin("notice-board")
    for s in (-1.1, 1.1):
        b.box(P["log"], 0.18, 2.6, 0.18, 4.0 + s, 0, -4.0)
    b.box(P["wood"], 2.4, 1.2, 0.1, 4.0, 1.0, -4.0)
    b.prism(P["cabin_roof"], [(4.0 - 1.5, 2.6), (4.0 + 1.5, 2.6), (4.0, 3.1)], -4.3, -3.7)
    for k in range(5):
        b.box(P[("poster_y", "white", "poster_r", "poster_b", "white")[k]], 0.38, 0.45, 0.01, 3.2 + k * 0.42 + rng.uniform(-0.05, 0.05), 1.35, -3.94, rz=rng.uniform(-0.1, 0.1))
    C.end()
    C.col(4.0, -4.0, 2.6, 0.3, 2.6, 0, 1)
    C.face("lodge-notices", "notice-board", (4.0, 1.6, -3.94), (0, 1), 2.2, 1.0)
    C.sign("LULZ LODGE", 4.0, 2.25, -3.92, 0, 1, 2.4, 0.42, 0xffd23a)
    # the barbecue and bear-proof bins by the cabins
    C.begin("barbecue")
    b.box(P["stone"], 1.4, 0.8, 0.8, px + 4.5, 0, pz + 4.0)
    b.box(P["ink"], 1.1, 0.06, 0.6, px + 4.5, 0.8, pz + 4.0)
    for k in range(5):
        b.box(P["steel"], 0.04, 0.02, 0.6, px + 4.05 + k * 0.22, 0.88, pz + 4.0)
    C.end()
    C.col(px + 4.5, pz + 4.0, 1.4, 0.8, 0.9, 0, 1)
    for k, (bx_, bz_) in enumerate(((px + 13.5, pz - 7.0), (px + 13.5, pz - 5.8))):
        C.begin(f"bear-bin{k}")
        b.box(P["green"], 0.9, 1.1, 0.9, bx_, 0, bz_, bevel=0.03)
        b.box(P["steel"], 0.92, 0.08, 0.92, bx_, 1.1, bz_)
        C.end()
        C.col(bx_, bz_, 0.9, 0.9, 1.18, 0, 1)
    # the canoe rack and the jetty on the lake
    C.begin("canoe-rack")
    for s in (-1.4, 1.4):
        b.box(P["wood_dk"], 0.14, 1.7, 0.14, 23.0, 0, -15.0 + s)
        for y in (0.7, 1.4):
            b.box(P["wood_dk"], 1.2, 0.1, 0.1, 23.0, y, -15.0 + s)
    for k, (y, m) in enumerate(((0.8, "canoe"), (1.5, "canoe_g"))):
        b.cyl(P[m], 0.35, (23.0, y + 0.25, -17.8), (23.0, y + 0.25, -12.2), seg=10, r2=0.35)
        b.box(P[m], 0.62, 0.1, 5.2, 23.0, y + 0.02, -15.0)
    C.end()
    C.col(23.0, -15.0, 1.2, 5.6, 2.0, 0, 1)
    C.begin("jetty")
    b.box(P["plank"], 6.4, 0.15, 2.4, 27.2, 0.51, -5.5)
    b.box(P["plank"], 2.4, 0.15, 4.4, 31.4, 0.51, -5.5)
    for k in range(3):
        for s in (-1.15, 1.15):
            b.cyl(P["pile"], 0.12, (24.6 + k * 2.6, -1.0, -5.5 + s), (24.6 + k * 2.6, 1.0, -5.5 + s), seg=8)
    for s in (-2.15, 2.15):
        b.cyl(P["pile"], 0.12, (32.4, -1.0, -5.5 + s), (32.4, 1.0, -5.5 + s), seg=8)
    C.end()
    b.box(P["plank_dk"], 0.6, 0.33, 2.4, 23.7, 0, -5.5)                 # the step up from the beach
    C.col(23.7, -5.5, 0.6, 2.4, 0.33, 0, 3)
    C.col(27.2, -5.5, 6.4, 2.4, 0.66, 0, 3)
    C.col(31.4, -5.5, 2.4, 4.4, 0.66, 0, 3)
    C.loot(31.4, 0.66, -5.5)
    rowboat(C, "lodge-boat", 30.6, -9.4, 0.2, 0.1, "canoe")
    # the wash block south of the road: showers and sinks, its door to the tents
    box_shed(C, "wash-block", 10.0, 14.0, 6.0, 3.6, 2.7, [("s", 10.0, 1.2, 2.2)], [], "log", "cabin_roof", t=0.25)
    C.containers = ("wash-block",)
    C.begin("wash-sinks")
    for k in range(3):
        b.box(P["white"], 0.5, 0.15, 0.4, 8.2 + k * 0.8, 0.8, 12.6)
        b.box(P["steel"], 0.06, 0.8, 0.06, 8.2 + k * 0.8, 0, 12.6)
        b.box(P["chrome"], 0.4, 0.5, 0.02, 8.2 + k * 0.8, 1.3, 12.33)
    C.end()
    C.col(9.0, 12.6, 2.2, 0.4, 0.95, 0, 1)
    C.begin("wash-showers")
    for k in range(2):
        b.box(P["white"], 0.06, 2.0, 1.2, 11.4 + k * 1.1, 0, 12.8)
        b.cyl(P["chrome"], 0.08, (11.95 + k * 1.1, 2.0, 12.6), (11.95 + k * 1.1, 2.06, 12.6), seg=8)
    C.end()
    for k in range(2):
        C.col(11.4 + k * 1.1, 12.8, 0.08, 1.2, 2.0, 0, 1)
    C.containers = ()
    # tents south of the road, a clothes line
    for k, (tx, tz, ry, m) in enumerate(((3.0, 13.5, 0.2, "tent_o"), (16.5, 15.0, -0.3, "tent_b"), (20.0, 9.5, 0.6, "tent_o"))):
        c, s = math.cos(ry), math.sin(ry)
        C.begin(f"tent{k}")
        pts = []
        for (lx, ly, lz) in ((-1.3, 0, -1.1), (1.3, 0, -1.1), (1.3, 0, 1.1), (-1.3, 0, 1.1), (-1.3, 1.3, 0), (1.3, 1.3, 0)):
            pts.append((tx + lx * c + lz * s, ly, tz - lx * s + lz * c))
        b.poly(P[m], pts, [[0, 1, 5, 4], [2, 3, 4, 5], [1, 2, 5], [3, 0, 4], [0, 3, 2, 1]])
        fx_, fz_ = tx + 1.32 * c, tz - 1.32 * s
        b.poly(P["ink"], [(fx_ + 0.35 * s, 0.01, fz_ + 0.35 * c), (fx_ - 0.35 * s, 0.01, fz_ - 0.35 * c), (fx_, 0.9, fz_)], [[0, 1, 2]])
        C.end()
        C.col(tx, tz, 2.6 * abs(c) + 2.2 * abs(s), 2.6 * abs(s) + 2.2 * abs(c), 1.3, 0, 1)
    C.begin("clothes-line")
    for xx in (5.5, 13.0):
        b.cyl(P["wood_dk"], 0.06, (xx, 0, 18.6), (xx, 1.9, 18.6), seg=6)
    b.bar(P["rope"], (5.5, 1.85, 18.6), (13.0, 1.85, 18.6), 0.02)
    for k, m in enumerate(("flannel", "white", "denim", "poster_y")):
        b.box(P[m], 0.6, 0.7, 0.02, 6.6 + k * 1.6, 1.15, 18.6)
    C.end()
    C.col(5.5, 18.6, 0.14, 0.14, 1.9, 0, 1)
    C.col(13.0, 18.6, 0.14, 0.14, 1.9, 0, 1)
    lamp_post(C, "lodge-lamp0", -2.0, -6.5, 0.0)
    lamp_post(C, "lodge-lamp1", 18.0, 2.0, math.pi)
    b.finish("tf-lodge-p5.glb")


# ============================================================== LIGHTHOUSE POINT
#
# The east road runs north-south 6.5 m east of the ring's centre and the
# coast is 20 m east of it, so the lighthouse stands on the rocks between
# the road and the sea, the keeper's house west of the road by its parking
# bay (maps/trollface-island.js PARKING [161.5, 20]).

LH = (14.6, 8.0)             # the tower's centre (the coast swings east south of the bay)
LH_R = 4.2                   # its octagon's outer corner radius
LH_T = 0.35
LH_HS = 2.5                  # the square stairwell's half size
FLIGHT = 1.2                 # a flight's width (and a corner landing's)
LH_BASE = 0.3                # the tower's floor (on its plinth, a step up)
LH_TOP = LH_BASE + 15.0      # the lamp room's floor: ten flights
LH_GLASS = 2.6               # the lamp room's glass height


def octagon(r, rot=math.pi / 8):
    return [(r * math.cos(rot + k * math.pi / 4), r * math.sin(rot + k * math.pi / 4)) for k in range(8)]


def oct_wall(C, pid, cx, cz, r, t, y0, h, bands, door=None, on=None):
    """An octagonal wall (flats square to the axes), painted in `bands`
    [(y0, y1, m)], with a door gap (side index, width, height); colliders
    as short slices along each flat so its corners stay out of the stairwell."""
    b, P = C.b, C.P
    pts = octagon(r)
    C.begin(pid, on)
    for k in range(8):
        (ax, az), (bx_, bz_) = pts[k], pts[(k + 1) % 8]
        L = math.hypot(bx_ - ax, bz_ - az)
        mx, mz = (ax + bx_) / 2, (az + bz_) / 2
        nrm = math.atan2(mz, mx)
        ry = -nrm + math.pi / 2
        for (ya, yb, m) in bands:
            ya, yb = max(ya, y0), min(yb, y0 + h)
            if yb <= ya:
                continue
            if door and door[0] == k and ya < door[2]:
                side = (L - door[1]) / 2
                for s in (-1, 1):
                    off = s * (door[1] / 2 + side / 2)
                    b.box(P[m], side + 0.02, yb - ya, t, cx + mx - math.sin(nrm) * off, ya, cz + mz + math.cos(nrm) * off, ry=ry)
                if yb > door[2]:
                    b.box(P[m], door[1] + 0.02, yb - door[2], t, cx + mx, door[2], cz + mz, ry=ry)
                continue
            b.box(P[m], L + 0.03, yb - ya, t, cx + mx, ya, cz + mz, ry=ry)
        # colliders: 4 slices along the flat
        n = 4
        for i in range(n):
            t0, t1 = i / n, (i + 1) / n
            sx0, sz0 = ax + (bx_ - ax) * t0, az + (bz_ - az) * t0
            sx1, sz1 = ax + (bx_ - ax) * t1, az + (bz_ - az) * t1
            smx, smz = (sx0 + sx1) / 2 - math.cos(nrm) * t / 2, (sz0 + sz1) / 2 - math.sin(nrm) * t / 2
            w_, d_ = max(t, abs(sx1 - sx0)), max(t, abs(sz1 - sz0))
            if door and door[0] == k and abs((t0 + t1) / 2 - 0.5) * L < door[1] / 2:
                C.col(cx + smx, cz + smz, w_, d_, h - (door[2] - 0.0), y0 + door[2], 3)
                continue
            C.col(cx + smx, cz + smz, w_, d_, h, y0, 3)
    C.end()


def lh_stair(C, cx, cz, y0, y_top):
    """The stair inside the tower: flights up the four walls clockwise seen
    from above (east along the north wall, south along the east, west
    along the south, north along the west), a landing in each corner, 1.5 m
    a flight; colliders as slabs 0.6 thick so the flights below keep their
    headroom."""
    b, P = C.b, C.P
    h, w = LH_HS, FLIGHT
    corners = [(-h + w / 2, -h + w / 2), (h - w / 2, -h + w / 2), (h - w / 2, h - w / 2), (-h + w / 2, h - w / 2)]
    dirs = [(1, 0), (0, 1), (-1, 0), (0, -1)]
    run = 2 * h - 2 * w                        # each flight's run between its landings
    n = 5
    rise = 1.5 / n
    step = run / n
    y = y0
    k = 0
    C.begin("lh-stair", on="lighthouse")
    lands = []
    while y < y_top - 0.01:
        (ax, az) = corners[k % 4]
        dx, dz = dirs[k % 4]
        sx0, sz0 = ax + dx * w / 2, az + dz * w / 2
        for i in range(n):
            top = y + rise * (i + 1)
            sx, sz = cx + sx0 + dx * step * (i + 0.5), cz + sz0 + dz * step * (i + 0.5)
            W, D = (step, w) if dx else (w, step)
            b.box(P["plank_dk"], W, 0.12, D, sx, top - 0.12, sz)
            b.box(P["steel"], W if dx else 0.06, 0.25, 0.06 if dx else D, sx + (0 if dx else (-dz) * 0), top - 0.37, sz)
            C.col(sx, sz, W, D, min(0.6, top - y0), top - min(0.6, top - y0), 3)
        y += 1.5
        k += 1
        (lx, lz) = corners[k % 4]
        if y < y_top - 0.01:
            b.box(P["plank_dk"], w, 0.15, w, cx + lx, y - 0.15, cz + lz)
            C.col(cx + lx, cz + lz, w, w, 0.3, y - 0.3, 3)
            lands.append((lx, lz, y))
    # the core the flights wind round (the lamp's pedestal at the top), the inner rail
    core = h - w
    b.box(P["lh_white"], 2 * core - 0.1, y_top + 0.9 - y0, 2 * core - 0.1, cx, y0, cz)
    C.end()
    C.col(cx, cz, 2 * core - 0.1, 2 * core - 0.1, y_top + 0.9 - y0, y0, 3)
    return k


def light_build(b, P, R, origin):
    C = start(b, P, R, origin, 71)
    rng = C.rng
    cx, cz = LH
    # the plinth the tower stands on, rocks either side, the sea wall along the coast
    C.begin("lh-rocks")
    b.cyl(P["seawall"], LH_R + 0.8, (cx, 0, cz), (cx, LH_BASE, cz), seg=16)
    C.end()
    C.col(cx, cz, 2 * LH_R + 1.6, 2 * LH_R + 1.6, LH_BASE, 0, 3)
    for k, a in enumerate((1.2, 2.3, -2.3)):
        rx_, rz_ = cx + 6.4 * math.cos(a), cz + 6.4 * math.sin(a)
        C.begin(f"lh-rock{k}", on=("lh-rocks", "lighthouse", "lh-floor"))      # beside the tower (its octagon's box)
        b.lump(P["seawall"], rng.uniform(1.4, 2.0), rng.uniform(0.7, 1.2), rng.uniform(1.2, 1.6), rx_, 0, rz_, seed=20 + k, ry=a)
        C.end()
        C.col(rx_, rz_, 1.4, 1.4, 0.9, 0, 1)
    wall = [(16.6, -13.0), (17.4, -8.0), (18.2, -3.0), (18.9, 1.5)]          # along the coast
    for (ax, az), (bx_, bz_) in zip(wall, wall[1:]):
        C.begin("sea-wall")
        b.bar(P["seawall"], (ax, 0.55, az), (bx_, 0.55, bz_), 0.9, 1.1)
        b.bar(P["quay_dk"], (ax, 1.17, az), (bx_, 1.17, bz_), 1.1, 0.15)
        C.end()
    for (ax, az), (bx_, bz_) in zip(wall, wall[1:]):
        for t in (0.25, 0.75):
            C.col(ax + (bx_ - ax) * t, az + (bz_ - az) * t, 0.9, 2.5, 1.25, 0, 3)
    # the tower: white with two red bands, the door west to the road
    bands = [(0.0, 0.6, "lh_red"), (0.6, 5.0, "lh_white"), (5.0, 7.6, "lh_red"), (7.6, 11.0, "lh_white"), (11.0, LH_TOP, "lh_red")]
    oct_wall(C, "lighthouse", cx, cz, LH_R, LH_T, LH_BASE, LH_TOP - LH_BASE, bands, door=(3, 1.3, 2.3), on="lh-rocks")
    C.face("door:lighthouse", "lighthouse", (cx - LH_R * math.cos(math.pi / 8) - 0.02, LH_BASE + 1.15, cz), (-1, 0), 1.3, 2.3)
    C.containers = ("lighthouse",)
    C.begin("lh-floor")
    b.cyl(P["plank"], LH_R - 0.2, (cx, LH_BASE, cz), (cx, LH_BASE + 0.03, cz), seg=8)
    C.end()
    C.containers = ("lighthouse", "lh-rocks", "lh-floor")
    k = lh_stair(C, cx, cz, LH_BASE, LH_TOP)
    C.containers = ()
    # the lamp room floor over the stairwell (open over the last flight and the landing before it)
    top = LH_TOP
    last = (k - 1) % 4                       # the last flight's wall
    C.begin("lamp-floor", on=("lighthouse", "lh-stair"))
    b.cyl(P["lh_cap"], LH_R + 1.3, (cx, top - 0.3, cz), (cx, top, cz), seg=8)
    C.end()
    hs, w = LH_HS, FLIGHT
    # the floor's colliders round the hole: the hole is the last flight's strip and its first landing
    hole = {0: (-hs, hs, -hs, -hs + w), 1: (hs - w, hs, -hs, hs), 2: (-hs, hs, hs - w, hs), 3: (-hs, -hs + w, -hs, hs)}[last]
    hx0, hx1, hz0, hz1 = hole
    R_ = LH_R + 1.3
    for (a0, a1, c0, c1) in ((-R_, hx0, -R_, R_), (hx1, R_, -R_, R_), (hx0, hx1, -R_, hz0), (hx0, hx1, hz1, R_)):
        if a1 - a0 > 0.05 and c1 - c0 > 0.05:
            C.col(cx + (a0 + a1) / 2, cz + (c0 + c1) / 2, a1 - a0, c1 - c0, 0.3, top - 0.3, 3)
    C.loot(cx - 1.8, LH_TOP, cz + 1.8)
    # the lamp room: glass all round on a red sill, the lamp on its pedestal, the dark cap, the vane
    gr = LH_R - 0.6
    C.begin("lamp-room", on=("lamp-floor", "lh-stair"))
    gp = octagon(gr)
    for i in range(8):
        (ax, az), (bx_, bz_) = gp[i], gp[(i + 1) % 8]
        b.box(P["lh_red"], 0.12, LH_GLASS + 0.4, 0.12, cx + ax, top, cz + az)
        mx, mz = (ax + bx_) / 2, (az + bz_) / 2
        nrm = math.atan2(mz, mx)
        L = math.hypot(bx_ - ax, bz_ - az)
        if i != 3:                                                      # the door west to the gallery
            b.box(P["lh_red"], L, 0.6, 0.1, cx + mx, top, cz + mz, ry=-nrm + math.pi / 2)
            glass(C, cx + ax, cz + az, cx + bx_, cz + bz_, top + 0.6, top + LH_GLASS, (math.cos(nrm), math.sin(nrm)))
    b.cyl(P["lh_cap"], gr + 0.4, (cx, top + LH_GLASS, cz), (cx, top + LH_GLASS + 0.3, cz), seg=8)
    b.cyl(P["lh_cap"], gr + 0.2, (cx, top + LH_GLASS + 0.3, cz), (cx, top + LH_GLASS + 2.0, cz), seg=8, r2=0.3)
    sphere(b, P["lh_cap"], (cx, top + LH_GLASS + 2.15, cz), 0.3)
    b.cyl(P["steel"], 0.04, (cx, top + LH_GLASS + 2.3, cz), (cx, top + LH_GLASS + 3.3, cz), seg=6)
    b.box(P["steel"], 0.9, 0.04, 0.04, cx, top + LH_GLASS + 3.0, cz)
    b.prism(P["lh_red"], [(cx + 0.1, top + LH_GLASS + 2.9), (cx + 0.6, top + LH_GLASS + 3.05), (cx + 0.1, top + LH_GLASS + 3.2)], cz - 0.02, cz + 0.02)
    C.end()
    for i in range(8):
        if i == 3:
            continue
        (ax, az), (bx_, bz_) = gp[i], gp[(i + 1) % 8]
        C.col(cx + (ax + bx_) / 2, cz + (az + bz_) / 2, max(0.3, abs(bx_ - ax)), max(0.3, abs(bz_ - az)), LH_GLASS, top, 3)
    C.col(cx, cz, 2 * gr + 0.8, 2 * gr + 0.8, 2.0, top + LH_GLASS, 3)
    C.face("door:lamp-room", "lamp-room", (cx - gr * math.cos(math.pi / 8) - 0.05, top + 1.1, cz), (-1, 0), 1.4, 2.1)
    C.begin("lamp", on=("lamp-room", "lh-stair"))
    core = LH_HS - FLIGHT
    b.cyl(P["brass"], 0.55, (cx, top + 0.9, cz), (cx, top + 1.0, cz), seg=12)
    for k2 in range(5):
        b.cyl(P["lh_lamp"], 0.5 - abs(k2 - 2) * 0.08, (cx, top + 1.0 + k2 * 0.26, cz), (cx, top + 1.24 + k2 * 0.26, cz), seg=12)
        b.cyl(P["brass"], 0.52 - abs(k2 - 2) * 0.08, (cx, top + 1.24 + k2 * 0.26, cz), (cx, top + 1.26 + k2 * 0.26, cz), seg=12, caps=False)
    b.cyl(P["brass"], 0.25, (cx, top + 2.3, cz), (cx, top + 2.45, cz), seg=10)
    C.end()
    # the gallery round the outside, its rail
    rail_pts = [(cx + x_, cz + z_) for (x_, z_) in octagon(LH_R + 1.2)]
    rail_run(C, "gallery-rail", rail_pts + rail_pts[:1], top, on=("lamp-floor", "lh-stair", "lamp-room"))
    # the foghorn, the bell on its frame, the flagpole, the bench to the sea
    C.begin("foghorn")
    b.box(P["steel"], 0.5, 1.0, 0.5, 16.2, 0, 0.6)
    b.cyl(P["lh_red"], 0.12, (16.2, 1.1, 0.6), (17.2, 1.2, 0.6), seg=10, r2=0.45)
    C.end()
    C.col(16.2, 0.6, 0.6, 0.6, 1.2, 0, 1)
    C.begin("bell")
    for s in (-0.6, 0.6):
        b.box(P["wood_dk"], 0.14, 2.2, 0.14, 10.2, 0, -1.6 + s)
    b.box(P["wood_dk"], 0.14, 0.14, 1.4, 10.2, 2.2, -1.6)
    b.cyl(P["brass"], 0.18, (10.2, 2.15, -1.6), (10.2, 1.65, -1.6), seg=12, r2=0.32)
    C.end()
    C.col(10.2, -1.6, 0.3, 1.4, 2.3, 0, 1)
    C.begin("flagpole")
    b.cyl(P["steel"], 0.06, (1.8, 0, -6.0), (1.8, 7.5, -6.0), seg=8)
    b.box(P["blue"], 0.02, 0.8, 1.2, 1.8, 6.5, -5.4)
    C.end()
    C.col(1.8, -6.0, 0.2, 0.2, 7.5, 0, 1)
    C.begin("sea-bench")
    b.box(P["wood"], 0.45, 0.08, 1.8, 16.3, 0.44, -3.0)
    b.box(P["wood"], 0.07, 0.4, 1.8, 16.0, 0.52, -3.0, rz=0.15)
    for s in (-0.75, 0.75):
        b.box(P["ink"], 0.4, 0.44, 0.08, 16.3, 0.0, -3.0 + s)
    C.end()
    C.col(16.3, -3.0, 0.5, 1.8, 0.5, 0, 1)
    for k in range(3):
        crab_pot(C, f"lobster-pot{k}", 12.8 + k * 1.0, -13.2 + (k % 2) * 0.5, 0.0, ry=k * 0.6)
    # the keeper's house on the shore strip north of the tower (the lake
    # comes to 6 m west of the road): white walls, slate roof, the door
    # south to the tower, his table, bed and stove
    hx, hz = 12.5, -8.5
    box_shed(C, "keeper", hx, hz, 5.4, 5.4, 2.9, [("s", hx - 0.8, 1.1, 2.2)],
             [("e", hz, 1.4, 1.0, 2.1), ("n", hx + 0.6, 1.4, 1.0, 2.1)], "cottage", "slate", t=0.25)
    glass(C, hx + 2.7 + 0.13, hz - 0.7, hx + 2.7 + 0.13, hz + 0.7, 1.0, 2.1, (1, 0))
    glass(C, hx - 0.1, hz - 2.7 - 0.13, hx + 1.3, hz - 2.7 - 0.13, 1.0, 2.1, (0, -1))
    C.containers = ("keeper",)
    C.begin("keeper-table")
    b.box(P["wood"], 1.2, 0.06, 0.8, hx + 1.4, 0.76, hz + 1.2)
    for (lx, lz) in ((-0.5, -0.32), (0.5, -0.32), (-0.5, 0.32), (0.5, 0.32)):
        b.box(P["wood_dk"], 0.06, 0.76, 0.06, hx + 1.4 + lx, 0, hz + 1.2 + lz)
    b.box(P["chart"], 0.6, 0.01, 0.45, hx + 1.4, 0.82, hz + 1.2, ry=0.2)
    b.cyl(P["lantern"], 0.1, (hx + 1.8, 0.82, hz + 1.0), (hx + 1.8, 1.1, hz + 1.0), seg=8)
    C.end()
    C.col(hx + 1.4, hz + 1.2, 1.2, 0.8, 0.82, 0, 1)
    C.begin("keeper-bed")
    b.box(P["wood_dk"], 2.0, 0.45, 1.0, hx - 1.7, 0, hz - 1.9)
    b.box(P["blanket"], 1.6, 0.12, 0.92, hx - 1.5, 0.45, hz - 1.9)
    C.end()
    C.col(hx - 1.7, hz - 1.9, 2.0, 1.0, 0.6, 0, 1)
    C.begin("keeper-stove")
    b.box(P["ink"], 0.7, 0.8, 0.6, hx - 2.3, 0, hz + 1.8)
    b.cyl(P["ink"], 0.08, (hx - 2.3, 0.8, hz + 1.8), (hx - 2.3, 3.6, hz + 1.8), seg=8)
    C.end()
    C.col(hx - 2.3, hz + 1.8, 0.7, 0.6, 0.8, 0, 1)
    C.containers = ()
    C.begin("rain-barrel")
    b.cyl(P["wood"], 0.4, (hx + 2.2, 0, hz + 3.7), (hx + 2.2, 1.0, hz + 3.7), seg=12)
    b.cyl(P["water"], 0.36, (hx + 2.2, 0.95, hz + 3.7), (hx + 2.2, 1.0, hz + 3.7), seg=12)
    C.end()
    C.col(hx + 2.2, hz + 3.7, 0.8, 0.8, 1.0, 0, 1)
    # the rowing boat on its trailer on the lake beach west of the road
    C.begin("boat-trailer")
    b.box(P["steel"], 0.12, 0.12, 4.0, -1.5, 0.45, 8.0)
    b.box(P["steel"], 1.4, 0.1, 0.12, -1.5, 0.45, 6.8)
    b.box(P["steel"], 1.4, 0.1, 0.12, -1.5, 0.45, 9.2)
    for s in (-0.75, 0.75):
        b.cyl(P["tyre"], 0.32, (-1.5 + s, 0.32, 8.2), (-1.5 + s * 1.25, 0.32, 8.2), seg=12)
    C.end()
    C.col(-1.5, 8.0, 1.8, 4.2, 0.6, 0, 1)
    rowboat(C, "trailer-boat", -1.5, 8.0, 0.58, math.pi / 2, "canoe_g", on="boat-trailer")
    lamp_post(C, "lh-lamp0", 2.5, -10.0, 0.0)
    b.finish("tf-light-p5.glb")


# ============================================================== PROBLEM PLANT
#
# The north road crosses the ring 8 m north of its centre (the coast 10 m past
# it); the plant lies south of the road, the pylons go off west and east.

TOWERS = [(-15.0, 10.0, 6.6, 4.3, 5.0, 19.0), (1.5, 14.5, 6.0, 3.9, 4.6, 16.0)]      # x, z, base r, waist r, top r, height
HALL = (8.0, 24.0, -2.0, 10.0, 6.0)          # the turbine hall
CTRL = (10.0, 18.0, 14.0, 20.0, 3.4)         # the control room


def cooling_tower(C, pid, x, z, r0, rw, r1, h):
    """A hyperboloid shell on a ring of raking legs: open underneath, you
    walk in between the legs; colliders as a ring of short wall slices up
    the shell (each band's radius) and one per leg."""
    b, P = C.b, C.P
    seg, lat, leg_h = 32, 10, 2.6
    tw = 0.68
    def rad(t):
        return rw + (r0 - rw) * ((tw - t) / tw) ** 2 if t < tw else rw + (r1 - rw) * ((t - tw) / (1 - tw)) ** 2
    C.begin(pid)
    outer, inner = [], []
    for i in range(lat + 1):
        t = i / lat
        y = leg_h + (h - leg_h) * t
        r = rad(t)
        for j in range(seg):
            a = 2 * math.pi * j / seg
            outer.append((x + r * math.cos(a), y, z + r * math.sin(a)))
            inner.append((x + (r - 0.3) * math.cos(a), y, z + (r - 0.3) * math.sin(a)))
    pts = outer + inner
    N = len(outer)
    faces = []
    for i in range(lat):
        for j in range(seg):
            k = (j + 1) % seg
            faces.append([i * seg + j, i * seg + k, (i + 1) * seg + k, (i + 1) * seg + j])
            faces.append([N + i * seg + j, N + (i + 1) * seg + j, N + (i + 1) * seg + k, N + i * seg + k])
    for j in range(seg):
        k = (j + 1) % seg
        faces.append([j, N + j, N + k, k])
        top = lat * seg
        faces.append([top + j, top + k, N + top + k, N + top + j])
    for f in b.poly(P["concrete"], pts, faces):
        f.smooth = True
    # the red and white band at the lip
    b.cyl(P["tower_band"], r1 + 0.02, (x, h - 1.4, z), (x, h - 0.6, z), seg=seg, caps=False)
    # the legs: raking pairs round the base
    for j in range(16):
        a = 2 * math.pi * j / 16
        for s in (-1, 1):
            a2 = a + s * 0.09
            b.bar(P["concrete_dk"], (x + r0 * math.cos(a), 0, z + r0 * math.sin(a)), (x + r0 * math.cos(a2), leg_h + 0.05, z + r0 * math.sin(a2)), 0.32)
    b.cyl(P["water"], r0 - 0.4, (x, 0.0, z), (x, 0.06, z), seg=seg)                                # the basin
    C.end()
    for j in range(16):
        a = 2 * math.pi * j / 16
        C.col(x + r0 * math.cos(a), z + r0 * math.sin(a), 0.6, 0.6, leg_h, 0, 3)
    for i in range(3):
        t = (i + 0.5) / 6
        y0 = leg_h + (h - leg_h) * i / 6
        r = rad(t) - 0.15
        for j in range(16):
            a0, a1 = 2 * math.pi * j / 16, 2 * math.pi * (j + 1) / 16
            p0 = (x + r * math.cos(a0), z + r * math.sin(a0))
            p1 = (x + r * math.cos(a1), z + r * math.sin(a1))
            C.col((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, max(0.35, abs(p1[0] - p0[0])), max(0.35, abs(p1[1] - p0[1])), (h - leg_h) / 6, y0, 3)


def pylon(C, pid, x, z, h=15.0, ry=0.0):
    """A lattice pylon, its arms across ry."""
    b, P = C.b, C.P
    c, s = math.cos(ry), math.sin(ry)
    C.begin(pid)
    feet = [(-1.6, -1.6), (1.6, -1.6), (1.6, 1.6), (-1.6, 1.6)]
    for (fx, fz) in feet:
        b.bar(P["steel"], (x + fx, 0, z + fz), (x + fx * 0.25, h, z + fz * 0.25), 0.12)
    for k in range(6):
        y = k * h / 6
        f = 1 - 0.75 * y / h
        for i in range(4):
            (ax, az), (cx_, cz_) = feet[i], feet[(i + 1) % 4]
            yy = y + h / 6
            g = 1 - 0.75 * yy / h
            b.bar(P["steel"], (x + ax * f, y, z + az * f), (x + cx_ * g, yy, z + cz_ * g), 0.05)
    for (y, L) in ((h * 0.72, 4.5), (h * 0.9, 3.4)):
        b.bar(P["steel"], (x - c * L, y, z + s * L), (x + c * L, y, z - s * L), 0.14)
        for e in (-1, 1):
            b.cyl(P["white"], 0.1, (x + e * c * L * 0.9, y, z - e * s * L * 0.9), (x + e * c * L * 0.9, y - 0.8, z - e * s * L * 0.9), seg=6)
    C.end()
    C.col(x, z, 3.4, 3.4, 2.0, 0, 1)
    for (fx, fz) in feet:
        C.col(x + fx * 0.9, z + fz * 0.9, 0.4, 0.4, h * 0.4, 0, 1)


def plant_build(b, P, R, origin):
    C = start(b, P, R, origin, 81)
    rng = C.rng
    # the yard: concrete apron from the road
    C.begin("plant-yard")
    flat(b, P["concrete"], 2.0, 0.012, 9.0, 46.0, 24.0)
    for k in range(9):
        flat(b, P["hazard"], -20.0 + k * 5.0, 0.02, -2.6, 2.4, 0.3)
    C.end()
    C.containers = ("plant-yard",)
    for k, (x, z, r0, rw, r1, h) in enumerate(TOWERS):
        cooling_tower(C, f"cooling-tower{k}", x, z, r0, rw, r1, h)
    C.containers = ("plant-yard",)
    # the turbine hall: grey panels, big doors west and north, the windows high up
    x0, x1, z0, z1, H = HALL
    hx, hz = (x0 + x1) / 2, (z0 + z1) / 2
    box_shed(C, "turbine-hall", hx, hz, x1 - x0, z1 - z0, H,
             [("w", 4.0, 4.0, 4.5), ("n", 12.0, 2.0, 2.6), ("s", 20.0, 1.4, 2.3)],
             [("n", 17.5, 4.0, 3.4, 5.2), ("s", 12.5, 4.0, 3.4, 5.2)], "concrete", "concrete_dk", t=0.3, roof_pitch=False)
    for (side, at) in (("n", 17.5), ("s", 12.5)):
        zz = z0 - 0.02 if side == "n" else z1 + 0.02
        glass(C, at - 2.0, zz, at + 2.0, zz, 3.4, 5.2, (0, -1) if side == "n" else (0, 1))
    C.containers = ("plant-yard", "turbine-hall")
    C.begin("hall-trim")
    for zz in (z0 - 0.03, z1 + 0.03):
        b.box(P["turbine"], x1 - x0 + 0.1, 0.4, 0.3, hx, H - 0.4, zz)
    b.box(P["concrete_dk"], x1 - x0 - 0.6, 0.03, z1 - z0 - 0.6, hx, 0.0, hz)
    C.end()
    C.containers = ("plant-yard", "turbine-hall", "hall-trim")
    for k, tx in enumerate((12.5, 19.5)):
        C.begin(f"turbine{k}")
        b.box(P["concrete_dk"], 4.0, 0.6, 2.6, tx, 0, hz + 1.0)
        b.cyl(P["turbine"], 1.1, (tx - 1.8, 1.7, hz + 1.0), (tx + 1.2, 1.7, hz + 1.0), seg=16, r2=0.8)
        b.cyl(P["pipe_y"], 0.75, (tx + 1.2, 1.7, hz + 1.0), (tx + 1.9, 1.7, hz + 1.0), seg=14)
        b.cyl(P["pipe"], 0.25, (tx - 0.4, 2.6, hz + 1.0), (tx - 0.4, H - 0.2, hz + 1.0), seg=10)
        C.end()
        C.col(tx, hz + 1.0, 4.0, 2.6, 2.8, 0, 3)
    C.begin("gantry-crane", on=("turbine0", "turbine1"))
    for zz in (z0 + 0.6, z1 - 0.6):
        b.box(P["hazard"], x1 - x0 - 0.8, 0.4, 0.3, hx, H - 1.4, zz)
    b.box(P["hazard"], 0.5, 0.5, z1 - z0 - 1.2, 15.0, H - 1.5, hz)
    b.box(P["ink"], 0.5, 0.4, 0.5, 15.0, H - 2.0, hz + 1.0)
    b.cyl(P["steel"], 0.02, (15.0, H - 2.0, hz + 1.0), (15.0, 4.0, hz + 1.0), seg=4)
    b.box(P["hazard"], 0.3, 0.3, 0.1, 15.0, 3.7, hz + 1.0)
    C.end()
    C.containers = ("plant-yard",)
    # the stair up the hall's east wall to its roof, the rail round the roof
    fire_escape(C, "hall-stair", x1 + 0.7, z1 - 0.8, 0, -1, H + 0.1, 0.0, on=("turbine-hall", "hall-trim"))
    rail_run(C, "hall-roof-rail", [(x1 - 0.1, z0 + 0.2), (x0 + 0.2, z0 + 0.2), (x0 + 0.2, z1 - 0.2), (x1 - 0.1, z1 - 0.2)], H + 0.1, on=("turbine-hall", "hall-trim"))
    C.loot(hx, H + 0.1, hz)
    C.begin("roof-vents", on="turbine-hall")
    for k in range(3):
        b.box(P["steel"], 1.2, 0.8, 1.2, x0 + 3.0 + k * 4.5, H + 0.1, z0 + 2.0)
    C.end()
    for k in range(3):
        C.col(x0 + 3.0 + k * 4.5, z0 + 2.0, 1.2, 1.2, 0.8, H + 0.1, 1)
    # the control room: a low block with the big window over the yard, the desk of dials
    c0, c1, d0, d1, CH = CTRL
    ccx, ccz = (c0 + c1) / 2, (d0 + d1) / 2
    box_shed(C, "control-room", ccx, ccz, c1 - c0, d1 - d0, CH, [("e", ccz, 1.2, 2.3)], [("w", ccz, 4.0, 1.2, 2.6)],
             "concrete", "concrete_dk", t=0.3, roof_pitch=False)
    glass(C, c0 - 0.02, ccz - 2.0, c0 - 0.02, ccz + 2.0, 1.2, 2.6, (-1, 0))
    C.containers = ("plant-yard", "control-room")
    C.begin("control-desk")
    b.box(P["concrete_dk"], 0.9, 0.85, 4.2, c0 + 1.0, 0, ccz)
    b.box(P["steel"], 0.6, 0.5, 4.2, c0 + 0.9, 0.85, ccz, rz=-0.5)
    for k in range(7):
        zz = ccz - 1.8 + k * 0.6
        b.cyl(P["dial"], 0.12, (c0 + 0.78, 1.15, zz), (c0 + 0.7, 1.1, zz), seg=10)
        b.box(P["dial_glow" if k % 3 else "warn"], 0.04, 0.06, 0.06, c0 + 0.95, 0.95, zz + 0.2)
    C.end()
    C.col(c0 + 1.0, ccz, 0.9, 4.2, 1.2, 0, 1)
    C.begin("ctrl-cabinets")
    for k in range(3):
        b.box(P["server"], 0.6, 2.0, 0.8, c1 - 0.6, 0, d0 + 1.0 + k * 0.85)
        b.box(P["dial_glow"], 0.02, 0.05, 0.4, c1 - 0.91, 1.6, d0 + 1.0 + k * 0.85)
    C.end()
    C.col(c1 - 0.6, d0 + 1.85, 0.6, 2.55, 2.0, 0, 1)
    C.begin("hard-hats")
    b.box(P["wood"], 1.2, 0.06, 0.4, ccx, 1.5, d1 - 0.5)
    for k in range(3):
        sphere(b, P["hazard"], (ccx - 0.4 + k * 0.4, 1.56, d1 - 0.5), 0.16, seg=8, ring=4)
    C.end()
    C.containers = ("plant-yard",)
    # the transformer yard behind its fence, the pipe rack to the towers
    tx0, tx1, tz0, tz1 = -6.0, 4.0, -1.0, 4.0
    for k in range(3):
        xx = tx0 + 1.8 + k * 3.2
        C.begin(f"transformer{k}")
        b.box(P["transformer"], 2.0, 2.0, 1.6, xx, 0, 1.5)
        for f in range(5):
            b.box(P["transformer"], 2.1, 1.6, 0.06, xx, 0.2, 0.6 + f * 0.45)
        for e in (-0.6, 0.0, 0.6):
            b.cyl(P["white"], 0.1, (xx + e, 2.0, 1.5), (xx + e, 2.7, 1.5), seg=6)
        C.end()
        C.col(xx, 1.5, 2.1, 1.8, 2.0, 0, 1)
    fence(C, "transformer-fence", [(tx0 - 0.3, tz1 - 2.0), (tx0 - 0.3, tz0 - 0.4), (tx1 + 0.3, tz0 - 0.4), (tx1 + 0.3, tz1 - 2.0)], h=2.0, m="steel", rails=3)
    C.begin("danger-sign", on="transformer-fence")
    b.box(P["hazard"], 0.9, 0.7, 0.03, -1.0, 1.0, tz0 - 0.46)
    b.box(P["ink"], 0.15, 0.4, 0.01, -1.0, 1.15, tz0 - 0.48)
    C.end()
    C.sign("DANGER", -1.0, 1.55, tz0 - 0.5, 0, -1, 1.2, 0.3, 0xf2c21a)
    C.begin("pipe-rack", on=("cooling-tower0", "turbine-hall", "hall-trim"))
    for xx in (-8.0, -3.0, 2.0, 7.0):
        b.box(P["steel"], 0.25, 4.6, 0.25, xx, 0, 7.4)
    b.box(P["steel"], 15.6, 0.25, 0.4, -0.5, 4.6, 7.4)
    for k, (m, dz) in enumerate((("pipe", -0.6), ("pipe_y", 0.0), ("pipe_g", 0.6))):
        b.cyl(P[m], 0.22, (-9.5, 4.85 + 0.0, 7.4 + dz * 0.6), (x0 + 0.1, 4.85, 7.4 + dz * 0.6), seg=10)
    for k in range(3):
        b.cyl(P["pipe_y"], 0.18, (-4.5 + k * 3.0, 4.85, 7.4), (-4.5 + k * 3.0, 0.0, 7.4 - 1.3), seg=8)
        b.cyl(P["red"], 0.22, (-4.5 + k * 3.0, 1.2, 7.4 - 1.25), (-4.5 + k * 3.0, 1.3, 7.4 - 1.25), seg=10)   # the valve wheels
    C.end()
    for xx in (-8.0, -3.0, 2.0, 7.0):
        C.col(xx, 7.4, 0.25, 0.25, 4.6, 0, 1)
    for k in range(3):
        C.col(-4.5 + k * 3.0, 6.4, 0.4, 0.4, 1.4, 0, 1)
    # the cooling pond south of the towers
    C.begin("cooling-pond")
    b.box(P["concrete_dk"], 14.0, 0.5, 0.4, -8.0, 0, 21.2)
    b.box(P["concrete_dk"], 14.0, 0.5, 0.4, -8.0, 0, 25.6)
    b.box(P["concrete_dk"], 0.4, 0.5, 4.0, -15.0, 0, 23.4)
    b.box(P["concrete_dk"], 0.4, 0.5, 4.0, -1.0, 0, 23.4)
    b.box(P["water"], 13.6, 0.02, 4.0, -8.0, 0.25, 23.4)
    C.end()
    for (x_, z_, w_, d_) in ((-8.0, 21.2, 14.0, 0.4), (-8.0, 25.6, 14.0, 0.4), (-15.0, 23.4, 0.4, 4.0), (-1.0, 23.4, 0.4, 4.0)):
        C.col(x_, z_, w_, d_, 0.5, 0, 1)
    # the forklift, drums, the pylons
    C.begin("forklift")
    b.box(P["hazard"], 2.2, 1.0, 1.2, 4.5, 0.3, -0.4 + 7.4 - 4.0)
    b.box(P["ink"], 0.6, 0.8, 1.1, 3.6, 0.3, 3.0)
    for (lx, lz) in ((3.8, 2.5), (3.8, 3.5), (5.2, 2.5), (5.2, 3.5)):
        b.cyl(P["tyre"], 0.3, (lx, 0.3, lz - 0.1), (lx, 0.3, lz + 0.1), seg=10)
    for s in (-0.55, 0.55):
        b.box(P["ink"], 0.08, 2.4, 0.08, 5.65, 0.1, 3.0 + s)
    for s in (-0.35, 0.35):
        b.box(P["steel"], 1.1, 0.06, 0.14, 6.25, 0.15, 3.0 + s)
    b.box(P["ink"], 1.6, 0.06, 1.2, 4.6, 2.1, 3.0)
    for (lx, lz) in ((3.9, 2.45), (3.9, 3.55), (5.3, 2.45), (5.3, 3.55)):
        b.box(P["ink"], 0.06, 0.8, 0.06, lx, 1.3, lz)
    C.end()
    C.col(4.8, 3.0, 3.2, 1.3, 2.2, 0, 1)
    for k, (dx_, dz_, m) in enumerate(((-12.5, 0.0, "drum_y"), (-11.8, 0.6, "drum_y"), (-12.6, 1.2, "drum_b"), (24.8, 12.0, "drum_r"))):
        drum(C, f"plant-drum{k}", dx_, dz_, m)
    pylon(C, "pylon-west", -24.0, -1.0, ry=math.pi / 2)
    pylon(C, "pylon-east", 28.0, 0.0, ry=math.pi / 2)
    # the lines: off west and east at full height, down to the transformers
    # and to the insulators on the hall's east wall (the arms run along z)
    lines = [(-24.0, -1.0, -32.0, -0.5, None), (28.0, 0.0, 32.0, 0.0, None), (-24.0, -1.0, -4.0, 1.5, 2.7), (28.0, 0.0, 24.3, 0.0, 5.0)]
    for (ax, az, cx_, cz_, y_end) in lines:
        C.begin("power-lines", on=("pylon-west", "pylon-east", "transformer0", "transformer1", "transformer2", "turbine-hall", "hall-trim", "hall-stair", "plant-yard"))
        for e in (-1, 1):
            for y, L in ((15 * 0.72 - 0.8, 4.5 * 0.9), (15 * 0.9 - 0.8, 3.4 * 0.9)):
                prev = None
                for i in range(9):
                    t = i / 8
                    sag = math.sin(math.pi * t) * 1.0
                    ye = y - 1.0 if y_end is None else y_end
                    off = e * L * (1 - t if y_end is not None else 1)
                    p = (ax + (cx_ - ax) * t, y + (ye - y) * t - sag, az + (cz_ - az) * t + off)
                    if prev:
                        b.bar(P["ink"], prev, p, 0.03)
                    prev = p
        C.end()
    lamp_post(C, "plant-lamp0", 1.0, -3.2, 0.0)
    lamp_post(C, "plant-lamp1", 25.0, -3.5, math.pi)
    C.containers = ()
    C.sign("PROBLEM PLANT", hx, H - 1.7, z0 - 0.35, 0, -1, 9.0, 1.1, 0xf2ede2)
    b.finish("tf-plant-p5.glb")


# ============================================================== GRIN GAS
#
# The north road turns west along the ring's north edge (z -13) to the Shop;
# the two parking bays sit south of it (PARKING [84, 116.5], [78, 116.5]).
# The forecourt, the diner west of it and the car wash east face the road.

CANOPY = (-2.0, 12.0, -4.0, 4.5, 5.2)        # x0, x1, z0, z1, underside
DINER = (-21.0, -9.0, -3.0, 6.0, 3.6)
WASH = (14.5, 20.5, -3.0, 7.0, 3.6)


def gas_pump(C, pid, x, z, on=None):
    b, P = C.b, C.P
    C.begin(pid, on)
    b.box(P["pump"], 0.7, 1.7, 0.5, x, 0.2, z, bevel=0.04)
    b.box(P["gas_red"], 0.72, 0.35, 0.52, x, 1.6, z)
    for s in (-1, 1):
        b.box(P["screen"], 0.4, 0.25, 0.01, x, 1.1, z + s * 0.26)
        b.box(P["ink"], 0.1, 0.25, 0.08, x + 0.3, 0.7, z + s * 0.26)
        b.bar(P["ink"], (x + 0.3, 0.75, z + s * 0.3), (x + 0.42, 0.2, z + s * 0.36), 0.03)
    C.end()
    C.col(x, z, 0.7, 0.5, 1.95, 0.2, 1)


def gas_build(b, P, R, origin):
    C = start(b, P, R, origin, 91)
    rng = C.rng
    # the forecourt: concrete from the road, the pump islands
    C.begin("forecourt")
    flat(b, P["concrete"], 4.0, 0.012, -0.5, 32.0, 18.0)          # up to the road
    C.end()
    C.containers = ("forecourt",)
    a0, a1, c0, c1, CY = CANOPY
    acx, acz = (a0 + a1) / 2, (c0 + c1) / 2
    # the canopy: four columns, the deck, the red fascia, the lights under it
    C.begin("canopy")
    for (x, z) in ((a0 + 1.0, c0 + 1.0), (a1 - 1.0, c0 + 1.0), (a0 + 1.0, c1 - 1.0), (a1 - 1.0, c1 - 1.0)):
        b.box(P["pump"], 0.4, CY, 0.4, x, 0, z)
    b.box(P["white"], a1 - a0, 0.6, c1 - c0, acx, CY, acz)
    for (x, z, w, d) in ((acx, c0 - 0.02, a1 - a0 + 0.06, 0.08), (acx, c1 + 0.02, a1 - a0 + 0.06, 0.08), (a0 - 0.02, acz, 0.08, c1 - c0), (a1 + 0.02, acz, 0.08, c1 - c0)):
        b.box(P["gas_red"], w, 0.9, d, x, CY - 0.15, z)
    for k in range(3):
        for j in range(2):
            b.box(P["canopy_light"], 1.6, 0.04, 0.5, a0 + 2.5 + k * 4.5, CY - 0.04, acz - 2.0 + j * 4.0)
    C.end()
    for (x, z) in ((a0 + 1.0, c0 + 1.0), (a1 - 1.0, c0 + 1.0), (a0 + 1.0, c1 - 1.0), (a1 - 1.0, c1 - 1.0)):
        C.col(x, z, 0.4, 0.4, CY, 0, 1)
    C.col(acx, acz, a1 - a0, c1 - c0, 0.75, CY - 0.15, 3)
    C.sign("GRIN GAS", acx, CY + 0.3, c0 - 0.08, 0, -1, 6.0, 0.7, 0xffffff)
    C.sign("GRIN GAS", acx, CY + 0.3, c1 + 0.08, 0, 1, 6.0, 0.7, 0xffffff)
    C.containers = ("forecourt", "canopy")
    for k, ix in enumerate((acx - 3.0, acx + 3.0)):
        C.begin(f"pump-island{k}")
        b.box(P["concrete_dk"], 1.2, 0.2, 6.0, ix, 0, acz, bevel=0.04)
        b.box(P["hazard"], 1.22, 0.06, 0.3, ix, 0.14, acz - 3.0)
        b.box(P["hazard"], 1.22, 0.06, 0.3, ix, 0.14, acz + 3.0)
        C.end()
        C.col(ix, acz, 1.2, 6.0, 0.2, 0, 1)
        for j, pz_ in enumerate((acz - 1.4, acz + 1.4)):
            gas_pump(C, f"pump{k}{j}", ix, pz_, on=f"pump-island{k}")
    C.containers = ("forecourt",)
    # the diner: teal walls with a chrome band, big windows to the forecourt, the door north
    d0, d1, e0, e1, DH = DINER
    dcx, dcz = (d0 + d1) / 2, (e0 + e1) / 2
    box_shed(C, "diner", dcx, dcz, d1 - d0, e1 - e0, DH, [("n", dcx + 3.4, 1.4, 2.4), ("w", dcz + 2.5, 1.0, 2.2)],
             [("n", dcx - 3.0, 4.2, 1.0, 2.6), ("e", dcz - 0.4, 4.6, 1.0, 2.6)], "diner", "concrete_dk", t=0.25, roof_pitch=False)
    glass(C, dcx - 5.1, e0 - 0.03, dcx - 0.9, e0 - 0.03, 1.0, 2.6, (0, -1))
    glass(C, d1 + 0.03, dcz - 2.7, d1 + 0.03, dcz + 1.9, 1.0, 2.6, (1, 0))
    C.containers = ("forecourt", "diner")
    C.begin("diner-trim")
    for zz in (e0 - 0.03, e1 + 0.03):
        b.box(P["chrome"], d1 - d0 + 0.1, 0.2, 0.06, dcx, 0.9, zz)
        b.box(P["chrome"], d1 - d0 + 0.1, 0.25, 0.06, dcx, DH - 0.35, zz)
    for xx in (d0 - 0.03, d1 + 0.03):
        b.box(P["chrome"], 0.06, 0.2, e1 - e0 + 0.1, xx, 0.9, dcz)
        b.box(P["chrome"], 0.06, 0.25, e1 - e0 + 0.1, xx, DH - 0.35, dcz)
    for i in range(int((d1 - d0 - 0.6) / 0.6)):                         # the checker floor
        for j in range(int((e1 - e0 - 0.6) / 0.6)):
            if (i + j) % 2 == 0:
                b.box(P["check_b"], 0.6, 0.012, 0.6, d0 + 0.6 + i * 0.6, 0.02, e0 + 0.6 + j * 0.6)
    b.box(P["check_w"], d1 - d0 - 0.5, 0.015, e1 - e0 - 0.5, dcx, 0.0, dcz)
    C.end()
    C.containers = ("forecourt", "diner", "diner-trim")
    C.sign("DINER", dcx, DH + 0.4, e0 - 0.2, 0, -1, 4.0, 0.9, 0xff4a8a)
    C.begin("diner-sign-board", on="diner")
    b.box(P["ink"], 4.4, 1.1, 0.12, dcx, DH + 0.3, e0 - 0.12)
    C.end()
    # booths along the north windows
    for k, bx_ in enumerate((dcx - 4.6, dcx - 1.6)):
        C.begin(f"booth{k}")
        for s in (-1, 1):
            b.box(P["booth"], 0.55, 0.45, 1.4, bx_ + s * 1.0, 0, e0 + 1.1, bevel=0.04)
            b.box(P["booth"], 0.15, 0.6, 1.4, bx_ + s * 1.22, 0.45, e0 + 1.1, bevel=0.03)
        b.box(P["check_w"], 0.9, 0.05, 1.2, bx_, 0.74, e0 + 1.1)
        b.box(P["chrome"], 0.08, 0.74, 0.08, bx_, 0, e0 + 1.1)
        b.cyl(P["red"], 0.04, (bx_ + 0.2, 0.79, e0 + 1.4), (bx_ + 0.2, 0.95, e0 + 1.4), seg=6)          # ketchup
        b.cyl(P["poster_y"], 0.04, (bx_ + 0.3, 0.79, e0 + 1.4), (bx_ + 0.3, 0.95, e0 + 1.4), seg=6)    # mustard
        C.end()
        C.col(bx_, e0 + 1.1, 2.6, 1.4, 1.05, 0, 1)
    # the counter, its stools, the pie case, the menu board, the jukebox
    C.begin("diner-counter")
    b.box(P["diner"], 6.0, 1.0, 0.7, dcx - 0.2, 0, e1 - 2.2)
    b.box(P["check_w"], 6.2, 0.06, 0.85, dcx - 0.2, 1.0, e1 - 2.2)
    b.box(P["chrome"], 6.0, 0.1, 0.04, dcx - 0.2, 0.4, e1 - 2.57)
    b.box(P["chrome"], 0.6, 0.5, 0.4, dcx - 2.5, 1.06, e1 - 2.15)                                 # the coffee machine
    C.end()
    C.col(dcx - 0.2, e1 - 2.2, 6.2, 0.85, 1.06, 0, 1)
    C.begin("pie-case", on="diner-counter")
    b.box(P["chrome"], 0.9, 0.05, 0.5, dcx + 1.8, 1.06, e1 - 2.2)
    b.box(P["ice"], 0.86, 0.5, 0.46, dcx + 1.8, 1.11, e1 - 2.2)
    for k in range(2):
        b.cyl(P["pie"], 0.16, (dcx + 1.6 + k * 0.38, 1.12, e1 - 2.2), (dcx + 1.6 + k * 0.38, 1.2, e1 - 2.2), seg=10)
    C.end()
    for k in range(5):
        sx_ = dcx - 2.6 + k * 1.2
        C.begin(f"stool{k}")
        b.cyl(P["chrome"], 0.04, (sx_, 0, e1 - 3.2), (sx_, 0.72, e1 - 3.2), seg=6)
        b.cyl(P["booth"], 0.2, (sx_, 0.72, e1 - 3.2), (sx_, 0.8, e1 - 3.2), seg=10)
        C.end()
    C.begin("menu-board")
    b.box(P["chalk"], 3.0, 1.0, 0.06, dcx - 0.2, 2.2, e1 - 0.16)
    for k in range(4):
        b.box(P["chalk_w"], rng.uniform(1.0, 2.2), 0.05, 0.01, dcx - 0.8, 2.4 + k * 0.18, e1 - 0.2)
    C.end()
    C.begin("jukebox")
    b.box(P["juke"], 0.8, 1.4, 0.5, d0 + 0.6, 0, dcz - 1.3, bevel=0.05)
    b.cyl(P["juke"], 0.4, (d0 + 0.55, 1.4, dcz - 1.3 - 0.25), (d0 + 0.55, 1.4, dcz - 1.3 + 0.25), seg=12)
    b.box(P["chrome"], 0.05, 0.5, 0.44, d0 + 1.0, 0.6, dcz - 1.3)
    C.end()
    C.col(d0 + 0.6, dcz - 1.3, 0.8, 0.9, 1.8, 0, 1)
    C.containers = ("forecourt",)
    # the car wash: an open tunnel with the brushes, the WASH sign
    w0, w1, v0, v1, WH = WASH
    wcx, wcz = (w0 + w1) / 2, (v0 + v1) / 2
    C.begin("car-wash")
    for xx in (w0, w1):
        b.box(P["white"], 0.3, WH, v1 - v0, xx, 0, wcz)
        b.box(P["brush_r"], 0.32, 0.4, v1 - v0 + 0.02, xx, WH - 0.6, wcz)
    b.box(P["white"], w1 - w0 + 0.6, 0.3, v1 - v0 + 0.4, wcx, WH, wcz)
    b.box(P["steel"], w1 - w0 - 0.4, 0.2, 0.3, wcx, WH - 0.5, wcz)
    C.end()
    for xx in (w0, w1):
        C.col(xx, wcz, 0.3, v1 - v0, WH, 0, 3)
    C.col(wcx, wcz, w1 - w0 + 0.6, v1 - v0 + 0.4, 0.3, WH, 3)
    C.begin("wash-brushes", on="car-wash")
    for k, (bx_, bz_) in enumerate(((w0 + 0.9, wcz - 1.6), (w1 - 0.9, wcz - 1.6), (w0 + 0.9, wcz + 1.8), (w1 - 0.9, wcz + 1.8))):
        b.cyl(P["brush" if k % 2 else "brush_r"], 0.45, (bx_, 0.1, bz_), (bx_, WH - 0.6, bz_), seg=12)
    b.cyl(P["brush"], 0.42, (w0 + 0.5, WH - 1.1, wcz + 0.2), (w1 - 0.5, WH - 1.1, wcz + 0.2), seg=12)
    C.end()
    for (bx_, bz_) in ((w0 + 0.9, wcz - 1.6), (w1 - 0.9, wcz - 1.6), (w0 + 0.9, wcz + 1.8), (w1 - 0.9, wcz + 1.8)):
        C.col(bx_, bz_, 0.9, 0.9, WH - 0.6, 0, 1)
    C.sign("WASH", wcx, WH + 0.6, v0 - 0.25, 0, -1, 3.0, 0.7, 0x5fd0ff)
    C.begin("wash-sign-board", on="car-wash")
    b.box(P["ink"], 3.4, 1.0, 0.12, wcx, WH + 0.3, v0 - 0.12)
    C.end()
    # the price sign by the road
    C.begin("price-sign")
    b.box(P["steel"], 0.3, 4.0, 0.3, 10.0, 0, -9.0)
    b.box(P["gas_red"], 2.6, 2.4, 0.3, 10.0, 4.0, -9.0)
    b.box(P["ink"], 2.2, 1.2, 0.32, 10.0, 4.2, -9.0)
    C.end()
    C.col(10.0, -9.0, 0.3, 0.3, 4.0, 0, 1)
    C.sign("4.20", 10.0, 4.8, -9.17, 0, -1, 1.9, 0.5, 0xffd23a)
    C.sign("6.90", 10.0, 4.8, -8.83, 0, 1, 1.9, 0.5, 0xffd23a)
    # the air hose, the payphone, the tyre stacks, bins
    C.begin("air-hose")
    b.box(P["gas_red"], 0.4, 1.2, 0.3, 13.0, 0, 9.5)
    b.cyl(P["ink"], 0.15, (13.2, 0.9, 9.5), (13.2, 0.9, 9.5 + 0.3), seg=10)
    C.end()
    C.col(13.0, 9.5, 0.4, 0.3, 1.2, 0, 1)
    C.begin("payphone")
    b.box(P["steel"], 0.12, 1.2, 0.12, -7.4, 0, 8.6)
    b.box(P["blue"], 0.6, 0.9, 0.35, -7.4, 1.2, 8.6)
    b.box(P["ink"], 0.12, 0.3, 0.1, -7.2, 1.5, 8.82)
    C.end()
    C.col(-7.4, 8.6, 0.6, 0.4, 2.1, 0, 1)
    for k, (tx, tz, n) in enumerate(((18.0, 10.5, 4), (19.2, 10.8, 3), (18.6, 11.9, 2))):
        C.begin(f"tyre-stack{k}")
        for j in range(n):
            b.cyl(P["tyre"], 0.38, (tx, j * 0.26, tz), (tx, j * 0.26 + 0.26, tz), seg=14)
        C.end()
        C.col(tx, tz, 0.76, 0.76, n * 0.26, 0, 1)
    bin_(C, "gas-bin0", -6.0, -4.5)
    bin_(C, "gas-bin1", 13.4, -4.4)
    C.containers = ("forecourt", "canopy")
    car(C, "gas-car", -0.3, 0.5, math.pi / 2, "car_b")
    C.containers = ()
    C.loot(wcx, WH + 0.3, wcz)
    lamp_post(C, "gas-lamp0", -13.5, -8.0, 0.0)
    lamp_post(C, "gas-lamp1", 23.0, -2.0, math.pi)
    b.finish("tf-gas-p5.glb")


# ============================================================== the modules the build script takes

def _mod(fn):
    return SimpleNamespace(build=fn, palette=palette, LOOT=LOOT, SIGNS=SIGNS, GLASS=GLASS, EXTRA=EXTRA)


RANCH = _mod(ranch_build)
LODGE = _mod(lodge_build)
LIGHT = _mod(light_build)
PLANT = _mod(plant_build)
GAS = _mod(gas_build)
