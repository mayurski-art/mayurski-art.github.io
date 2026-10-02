"""
Troll Forces - Trollface Island landmarks (map detail pass, phase 3), headless Blender.

Run with:
  blender --background --python build_island.blender.py

Writes tf-city.glb, tf-cityface.glb, tf-peak.glb, tf-gallery.glb and
tf-shop.glb, then quantizes them (quantize_glb.py). Each model is authored
in its landmark's LOCAL coordinates (the landmark's centre at 0,0, game axes:
x east, y up, z south); trollface-island.js places it at LANDMARKS[...].

Every collider stays in trollface-island.js (the walk-tested grey box): the
numbers below are copied from it, so change one, change the other. The look
follows the trollface.io island art (reference only, never shipped): a black
dome with the grin among lit blue and yellow towers, a purple peak with a
snowy summit and the flag, a glass pyramid behind red ropes, and the U MAD
BRO SHOP with its marquee sign. The glass and the sign's lettering are drawn
in JS (transparent / canvas); everything here is opaque.
"""
import importlib.util
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
spec = importlib.util.spec_from_file_location("build_grinleria", os.path.join(HERE, "build_grinleria.blender.py"))
GLB = importlib.util.module_from_spec(spec)
spec.loader.exec_module(GLB)          # defines everything; builds nothing (main is guarded)

import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
from map_kit import Builder, mat  # noqa: E402
import quantize_glb  # noqa: E402

RISE = 0.33          # trollface-island.js RISE (stair steps)


def pal():
    return {
        # Troll City
        "dome": mat("TF_Dome", 0x2c2c30, 0.45, 0.1),
        "dome_seam": mat("TF_DomeSeam", 0x47474d, 0.5, 0.1),
        "ink": mat("TF_Ink", 0x111114, 0.7),
        "blue_a": mat("TF_TowerAzure", 0x3a9ee6, 0.55),
        "blue_b": mat("TF_TowerPeri", 0x7b98e0, 0.55),
        "blue_c": mat("TF_TowerSky", 0x86c4ee, 0.55),
        "yellow": mat("TF_TowerYellow", 0xf2cf4a, 0.6),
        "yellow_dk": mat("TF_TowerYellowDark", 0xd8ad2a, 0.6),
        "window": mat("TF_Window", 0xfff1c2, 0.3, 0.0, 0xffe7a8, 0.55),
        "window_off": mat("TF_WindowOff", 0x2d4057, 0.25, 0.1),
        "storefront": mat("TF_Storefront", 0x264a5e, 0.15, 0.1),
        "roof": mat("TF_Roof", 0x5d636c, 0.85),
        "unit": mat("TF_RoofUnit", 0xa8b0b8, 0.5, 0.2),
        "skylight": mat("TF_Skylight", 0x7fe0ff, 0.2, 0.0, 0x5fc8f0, 0.4),
        "antenna": mat("TF_Antenna", 0x7a2a22, 0.5, 0.2),
        "beacon": mat("TF_Beacon", 0xff3a2a, 0.3, 0.0, 0xff2a1a, 3.0),
        "lamp": mat("TF_Lamp", 0xfff6dc, 0.2, 0.0, 0xfff1d0, 1.2),
        "pole": mat("TF_Pole", 0x2f3338, 0.5, 0.3),
        "tile": mat("GS_Tile", 0xffffff, 0.4),
        "column": mat("TF_Column", 0xe6e3dc, 0.6),
        # Troll Peak
        "peak": mat("TF_PeakRock", 0x8f80e6, 0.95),
        "peak_dk": mat("TF_PeakRockDark", 0x6f61c8, 0.95),
        "snow": mat("TF_PeakSnow", 0xf6f8ff, 0.8),
        "turf": mat("TF_PeakGrass", 0x5fc46e, 0.9),
        "step": mat("TF_PeakStep", 0xb3aade, 0.95),
        "flag": mat("TF_Flag", 0xe8302a, 0.7),
        "white": mat("TF_White", 0xf4f4f0, 0.6),
        # The Gallery
        "frame": mat("TF_GlassFrame", 0xf2f4f6, 0.4, 0.2),
        "frame_dk": mat("TF_GlassFrameDark", 0x24272c, 0.5, 0.2),
        "marble": mat("GS_Marble", 0xffffff, 0.3),
        "rope": mat("TF_Rope", 0xb01e22, 0.8),
        "brass": mat("TF_Brass", 0xc9a040, 0.35, 0.4),
        "gold": mat("TF_Gold", 0xf0c040, 0.3, 0.4),
        "spot": mat("TF_SpotLens", 0xfff2a0, 0.2, 0.0, 0xffe680, 2.5),
        "art_red": mat("TF_ArtRed", 0xe2412f, 0.5),
        "art_blue": mat("TF_ArtBlue", 0x2f63e0, 0.5),
        "canvas": mat("TF_Canvas", 0xf3eee2, 0.9),
        "easel": mat("TF_Easel", 0x8a6236, 0.8),
        # U Mad Bro Shop
        "plaster": mat("TF_PlasterWhite", 0xf4f4f0, 0.9),
        "trim": mat("TF_ShopTrim", 0x9aa0a8, 0.7),
        "red_roof": mat("TF_ShopRed", 0xc23a30, 0.7),
        "shop_blue": mat("TF_ShopBlue", 0x1f9be8, 0.4),
        "shop_blue_dk": mat("TF_ShopBlueDark", 0x1670b8, 0.4),
        "shop_glass": mat("TF_ShopGlass", 0x8fd2f2, 0.12, 0.1),
        "board": mat("TF_SignBoard", 0x0c0d0e, 0.5),
        "bulb": mat("TF_Bulb", 0xffe36b, 0.2, 0.0, 0xffd84a, 0.9),
        "shelf": mat("TF_Shelf", 0xd8dade, 0.5, 0.2),
        "wood": mat("TF_Counter", 0x9a7b55, 0.7),
        "box_a": mat("TF_BoxGreen", 0x57d24f, 0.6),
        "box_b": mat("TF_BoxPink", 0xff5ca8, 0.6),
        "box_c": mat("TF_BoxYellow", 0xf6d23a, 0.6),
        "box_d": mat("TF_BoxBlue", 0x3a8ef0, 0.6),
        "box_e": mat("TF_BoxWhite", 0xf0f0ea, 0.6),
        "register": mat("TF_Register", 0x2a2d33, 0.5, 0.2),
        "screen": mat("TF_RegisterScreen", 0x7fffa0, 0.3, 0.0, 0x57ff70, 1.0),
    }


# ------------------------------------------------------------ shared helpers

def room_segments(cx, cz, w, d, doors, t=0.5):
    """GreyKit.room's wall boxes, as (x, z, sx, sz, side) - same maths, so the
    model's walls land exactly on the colliders. doors: [(side, at, width)]."""
    out = []

    def side(s, x0, z0, x1, z1):
        along = "x" if s in ("n", "s") else "z"
        length = (x1 - x0) if along == "x" else (z1 - z0)
        gaps = sorted([(length / 2 + at - gw / 2, length / 2 + at + gw / 2) for (sd, at, gw) in doors if sd == s])
        frm = 0.0
        for g0, g1 in gaps + [(length, length)]:
            if g0 > frm + 0.05:
                mid, seg = (frm + g0) / 2, g0 - frm
                if along == "x":
                    out.append((x0 + mid, z0, seg, t, s))
                else:
                    out.append((x0, z0 + mid, t, seg, s))
            frm = g1

    side("n", cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2)
    side("s", cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2)
    side("w", cx - w / 2, cz - d / 2 + t / 2, cx - w / 2, cz + d / 2 - t / 2)
    side("e", cx + w / 2, cz - d / 2 + t / 2, cx + w / 2, cz + d / 2 - t / 2)
    return out


def door_gaps(cx, cz, w, d, doors):
    """Each door as (side, centre x, centre z, width)."""
    out = []
    for s, at, gw in doors:
        if s == "n":
            out.append((s, cx + at, cz - d / 2, gw))
        elif s == "s":
            out.append((s, cx + at, cz + d / 2, gw))
        elif s == "w":
            out.append((s, cx - w / 2, cz + at, gw))
        else:
            out.append((s, cx + w / 2, cz + at, gw))
    return out


def stairs(b, m, x, z, dx, dz, from_y, to_y, w, bevel=0.03):
    """GreyKit.stairs, step for step."""
    n = math.ceil((to_y - from_y) / RISE)
    for i in range(n):
        h = to_y - from_y - i * ((to_y - from_y) / n)
        along = (i + 0.5) * 0.5
        sx = 0.5 if dx else w
        sz = 0.5 if dz else w
        b.box(m, sx, h, sz, x + dx * along, from_y, z + dz * along, bevel=bevel)


def smooth(faces):
    for f in faces:
        f.smooth = True


def sphere(b, m, c, r, seg=10, ring=6):
    M = Matrix.Translation(c) @ Matrix.Diagonal((r, r, r, 1))
    verts = bmesh.ops.create_uvsphere(b.bm, u_segments=seg, v_segments=ring, radius=1.0, matrix=M)["verts"]
    b._tag({f for v in verts for f in v.link_faces}, m, smooth=True)


def ring_band(b, m, r, y0, y1, seg=48, r_top=None):
    b.cyl(m, r, (0, y0, 0), (0, y1, 0), seg=seg, r2=r_top, caps=False)


# ------------------------------------------------------------ Troll City

# trollface-island.js Troll City: tower(dx, dz, w, d, h, mat, doors)
TOWERS = [
    (-24, -2, 9, 9, 18, "blue_a", [("e", 0, 3), ("s", 0, 3)]),
    (-22, 11, 8, 8, 12, "blue_c", []),
    (-33, 6, 8, 10, 24, "blue_a", [("n", 0, 3), ("e", 1, 2.6)]),
    (4, -17, 10, 8, 22, "yellow", [("s", 0, 3), ("w", 0, 2.6)]),
    (15, -15, 5, 5, 40, "yellow", []),
    (-6, -18, 8, 7, 16, "yellow_dk", []),
    (22, 4, 9, 9, 20, "blue_b", [("w", 0, 3), ("s", 2, 2.6)]),
    (31, -5, 8, 8, 14, "blue_c", []),
    (27, 14, 8, 8, 10, "blue_b", [("n", 0, 3)]),
]
DOME_R, DRUM_H = 11.0, 5.0


def tower_windows(b, P, rng, x0, z0, x1, z1, nx, nz, y0, y1):
    """A grid of windows along one face (x0,z0)->(x1,z1), outward normal
    (nx, nz), rows from y0 to y1. Most lit, a few dark, like the art."""
    L = math.hypot(x1 - x0, z1 - z0)
    cols = max(1, int((L - 0.8) / 1.7))
    rows = max(0, int((y1 - y0) / 2.4))
    ux, uz = (x1 - x0) / L, (z1 - z0) / L
    for c in range(cols):
        t = (c + 0.5) / cols
        cx, cz = x0 + (x1 - x0) * t + nx * 0.03, z0 + (z1 - z0) * t + nz * 0.03
        for r in range(rows):
            y = y0 + r * 2.4 + 0.5
            m = P["window"] if rng.random() < 0.78 else P["window_off"]
            w, d = (1.0, 0.08) if abs(ux) > 0.5 else (0.08, 1.0)
            b.box(m, w, 1.3, d, cx, y, cz)


def build_city(P):
    b = Builder()
    rng = random.Random(42)
    # the dome: a black drum and hemisphere (colliders: disc r11 h5 + crown)
    b.cyl(P["dome"], DOME_R, (0, 0, 0), (0, DRUM_H, 0), seg=56, caps=False)
    b.cyl(P["dome_seam"], DOME_R + 0.45, (0, 0, 0), (0, 0.7, 0), seg=56)          # a plinth
    b.cyl(P["dome_seam"], DOME_R + 0.08, (0, DRUM_H - 0.12, 0), (0, DRUM_H + 0.12, 0), seg=56, caps=False)
    LAT, SEG = 14, 56
    pts, faces = [], []
    for i in range(LAT + 1):
        e = (math.pi / 2) * i / LAT
        for j in range(SEG):
            a = 2 * math.pi * j / SEG
            pts.append((DOME_R * math.cos(e) * math.sin(a), DRUM_H + DOME_R * math.sin(e), DOME_R * math.cos(e) * math.cos(a)))
    for i in range(LAT):
        for j in range(SEG):
            k = (j + 1) % SEG
            faces.append([i * SEG + j, i * SEG + k, (i + 1) * SEG + k, (i + 1) * SEG + j])
    smooth(b.poly(P["dome"], pts, faces))
    for e in (0.42, 0.85, 1.2):                                                    # panel seams
        r, y = DOME_R * math.cos(e) + 0.04, DRUM_H + DOME_R * math.sin(e)
        b.cyl(P["dome_seam"], r, (0, y - 0.07, 0), (0, y + 0.07, 0), seg=SEG, caps=False)
    b.cyl(P["dome_seam"], 1.6, (0, DRUM_H + DOME_R - 0.15, 0), (0, DRUM_H + DOME_R + 0.5, 0), seg=16)
    b.cyl(P["beacon"], 0.35, (0, DRUM_H + DOME_R + 0.5, 0), (0, DRUM_H + DOME_R + 1.1, 0), seg=10)

    for (dx, dz, w, d, h, col, doors) in TOWERS:
        m = P[col]
        if doors:
            # ground-floor lobby: the room's walls, a storefront on each, the
            # body over it from 4 m, a column inside (the collider's pillar)
            for (sx, sz, ww, dd, side) in room_segments(dx, dz, w, d, doors):
                b.box(m, ww, 4.0, dd, sx, 0, sz)
                if max(ww, dd) > 1.4:
                    out = {"n": (0, -1), "s": (0, 1), "w": (-1, 0), "e": (1, 0)}[side]
                    gw, gd = (ww - 0.5, 0.06) if side in ("n", "s") else (0.06, dd - 0.5)
                    b.box(P["storefront"], gw, 2.6, gd, sx + out[0] * 0.27, 0.45, sz + out[1] * 0.27)
            for (side, gx, gz, gw) in door_gaps(dx, dz, w, d, doors):
                horiz = side in ("n", "s")
                for s in (-1, 1):                                                   # door posts
                    px, pz = (gx + s * (gw / 2 + 0.1), gz) if horiz else (gx, gz + s * (gw / 2 + 0.1))
                    b.box(P["ink"], 0.2 if horiz else 0.62, 4.0, 0.62 if horiz else 0.2, px, 0, pz)
                b.box(P["ink"], gw + 0.4 if horiz else 0.62, 0.35, 0.62 if horiz else gw + 0.4, gx, 3.65, gz)
            b.box(P["tile"], w - 1.0, 0.02, d - 1.0, dx, 0.0, dz)
            b.box(P["column"], 1.0, 4.0, 1.0, dx - w / 4, 0, dz)
            b.box(P["lamp"], w * 0.5, 0.06, d * 0.3, dx + w * 0.1, 3.93, dz)
            b.box(m, w, h - 4.0, d, dx, 4.0, dz)
            b.box(P["ink"], w + 0.2, 0.3, d + 0.2, dx, 3.85, dz)                     # sign band over the lobby
            win_from = 5.0
        else:
            b.box(m, w, h, d, dx, 0, dz)
            b.box(P["roof"], w + 0.06, 0.6, d + 0.06, dx, 0, dz)                     # plinth
            win_from = 1.4
        hw, hd = w / 2, d / 2
        for (x0, z0, x1, z1, nx, nz) in ((dx - hw, dz + hd, dx + hw, dz + hd, 0, 1), (dx + hw, dz - hd, dx - hw, dz - hd, 0, -1),
                                         (dx + hw, dz + hd, dx + hw, dz - hd, 1, 0), (dx - hw, dz - hd, dx - hw, dz + hd, -1, 0)):
            tower_windows(b, P, rng, x0, z0, x1, z1, nx, nz, win_from, h - 1.2)
        # the art's black outlines: corner posts, a parapet, a roof
        for sx in (-1, 1):
            for sz in (-1, 1):
                b.box(P["ink"], 0.24, h + 0.35, 0.24, dx + sx * (hw - 0.05), 0, dz + sz * (hd - 0.05))
        for (px, pz, pw, pd) in ((dx, dz - hd, w + 0.1, 0.24), (dx, dz + hd, w + 0.1, 0.24), (dx - hw, dz, 0.24, d), (dx + hw, dz, 0.24, d)):
            b.box(P["ink"], pw, 0.4, pd, px, h, pz)
        b.box(P["roof"], w - 0.3, 0.12, d - 0.3, dx, h, dz)
        if w >= 8:                                                                   # roof kit
            k = rng.random()
            if k < 0.5:
                b.box(P["skylight"], w * 0.35, 0.7, d * 0.25, dx - w * 0.15, h + 0.12, dz + d * 0.15, bevel=0.08)
            b.box(P["unit"], 1.6, 1.0, 1.2, dx + w * 0.25, h + 0.12, dz - d * 0.2, bevel=0.05)
            if k >= 0.5:
                b.cyl(P["unit"], 0.9, (dx - w * 0.2, h + 0.12, dz - d * 0.2), (dx - w * 0.2, h + 2.0, dz - d * 0.2), seg=12)
                b.cyl(P["roof"], 0.95, (dx - w * 0.2, h + 2.0, dz - d * 0.2), (dx - w * 0.2, h + 2.3, dz - d * 0.2), seg=12, r2=0.2)
    # the tall yellow tower's aerial, red light on top (trollface-island.js: 0.25 x 8 at y 40)
    b.cyl(P["antenna"], 0.25, (15, 40, -15), (15, 48, -15), seg=8, r2=0.12)
    for y in (42.5, 45):
        b.cyl(P["antenna"], 0.42, (15, y, -15), (15, y + 0.2, -15), seg=8)
    sphere(b, P["beacon"], (15, 48.2, -15), 0.32)
    # street lamps round the plaza (no colliders: thin poles)
    for (lx, lz) in ((-36, -21), (-12, -21), (24, -21), (36, -12), (36, 21), (12, 21), (-12, 21), (-36, 21)):
        b.cyl(P["pole"], 0.09, (lx, 0, lz), (lx, 4.2, lz), seg=8)
        b.box(P["pole"], 0.9, 0.12, 0.2, lx + 0.35, 4.1, lz)
        b.box(P["lamp"], 0.5, 0.1, 0.3, lx + 0.6, 4.0, lz)
    b.finish("tf-city.glb")


def build_city_face(P):
    """The dome's grin: the Grinleria's trollhead carving (the real artwork's
    outline and ink) in white with black cuts, wrapped onto the dome's south
    face. build_trollhead places its vertices through GLB.Vector, so a
    stand-in Vector bends each face-space point (x across, y up, z out) round
    the sphere instead of laying it on a plane."""
    real = GLB.Vector
    e0 = math.radians(3.0)          # the chin, just over the drum

    def wrap(v):
        x, y, z = v
        e = e0 + y / DOME_R
        az = x / (DOME_R * max(0.3, math.cos(e)))
        r = DOME_R + 0.05 + z
        return real((r * math.cos(e) * math.sin(az), DRUM_H + r * math.sin(e), r * math.cos(e) * math.cos(az)))

    GLB.Vector = wrap
    try:
        GLB.build_trollhead(P, width=14.0, res=190, front=0.55, back=0.0, carve=0.12, name="tf-cityface",
                            place=(0.0, 0.0, 0.0, 0.0, 0.0, 0.0), colors=(0xffffff, 0xf7f7f4, 0x101012), moss_on=False)
    finally:
        GLB.Vector = real


# ------------------------------------------------------------ Troll Peak

TIERS = [(22, 4.62), (15, 8.58), (9, 12.21)]       # [radius, top] as in trollface-island.js
SUMMIT_R, SUMMIT_H = 8.4, 26.0


def crag_ring(b, rng, m_side, m_top, r_bot, r_top, y0, y1, seg=30, jit=0.7, top=True):
    """A rocky tier: a leaning wall of facets, jagged sideways, its top ring
    exactly at y1 (the collider's walk height) and capped flat."""
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
            row.append(len(pts))
            pts.append((r * math.cos(a), y_j, r * math.sin(a)))
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


def build_peak(P):
    b = Builder()
    rng = random.Random(7)
    base = 0.0
    sides = [P["peak_dk"], P["peak"], P["peak"]]
    tops = [P["turf"], P["peak"], P["snow"]]
    for i, (rad, top) in enumerate(TIERS):
        # the collider is a disc of rad - 0.6: the visible top edge sits on it,
        # the wall leans out to rad + 0.8 at the foot
        crag_ring(b, rng, sides[i], tops[i], rad + 0.8, rad - 0.6, base - (0.4 if i == 0 else 0.6), top, seg=34 - i * 6)
        base = top
    # the summit: a jagged cone, snow above ~2/3 of the way, a few crags
    y0 = TIERS[2][1]
    rings, seg = 7, 20
    pts, idx = [], []
    for k in range(rings):
        t = k / rings
        y = y0 + SUMMIT_H * t + (rng.uniform(-0.6, 0.6) if 0 < k else -0.3)
        r = SUMMIT_R * (1 - t) ** 0.9 + 0.25
        row = []
        for j in range(seg):
            a = 2 * math.pi * (j + 0.4 * (k % 2)) / seg
            rr = r * (1 + rng.uniform(-0.16, 0.16)) if k else r + 0.4
            row.append(len(pts))
            pts.append((rr * math.cos(a), y, rr * math.sin(a)))
        idx.append(row)
    apex = len(pts)
    pts.append((0.3, y0 + SUMMIT_H, -0.2))
    side_snow, side_rock = [], []
    for k in range(rings - 1):
        for j in range(seg):
            jj = (j + 1) % seg
            f = [idx[k][j], idx[k + 1][j], idx[k + 1][jj], idx[k][jj]]
            (side_snow if k >= 3 or (k == 2 and rng.random() < 0.6) else side_rock).append(f)
    for j in range(seg):
        side_snow.append([idx[rings - 1][j], apex, idx[rings - 1][(j + 1) % seg]])
    b.poly(P["snow"], pts, side_snow)
    b.poly(P["peak"], pts, side_rock)
    for k in range(9):                                                             # crags on the slopes
        a = rng.uniform(0, 2 * math.pi)
        t = rng.uniform(0.05, 0.4)
        r = SUMMIT_R * (1 - t) ** 0.9 + 0.25 - 0.5      # sunk into the slope
        b.lump(P["peak_dk"] if t < 0.25 else P["snow"], 2.6, 2.2, 2.0, r * math.cos(a), y0 + SUMMIT_H * t - 0.6,
               r * math.sin(a), seed=k, rnd=0.6, jitter=0.18, ry=a)
    # the flag (trollface-island.js: pole 0.15 x 4 at y 38.2, flag at 40.7)
    b.cyl(P["pole"], 0.12, (0, 37.6, 0), (0, 42.4, 0), seg=8)
    sphere(b, P["brass"], (0, 42.5, 0), 0.18)
    b.box(P["flag"], 2.2, 1.4, 0.08, 1.2, 40.85, 0)
    b.cyl(P["white"], 0.45, (1.2, 41.55, -0.06), (1.2, 41.55, 0.06), seg=16)
    # stairs, step for step with trollface-island.js, carved stone
    stairs(b, P["step"], 0, 21.4, 0, 1, 0, 4.62, 4)
    stairs(b, P["step"], 14.4, 0, 1, 0, 4.62, 8.58, 4)
    stairs(b, P["step"], 0, -8.4, 0, -1, 8.58, 12.21, 4)
    # boulders at the foot, clear of the first flight (visual only, low)
    for k in range(14):
        a = 2 * math.pi * k / 14 + rng.uniform(-0.1, 0.1)
        if abs(math.atan2(math.sin(a - math.pi / 2), math.cos(a - math.pi / 2))) < 0.35:
            continue                                                               # the south flight
        r = TIERS[0][0] + rng.uniform(0.6, 1.4)
        s = rng.uniform(1.0, 1.8)
        b.lump(P["peak_dk"], s * 1.4, s * 0.8, s, r * math.cos(a), -0.2, r * math.sin(a), seed=20 + k, rnd=0.6, ry=a)
    b.finish("tf-peak.glb")


# ------------------------------------------------------------ The Gallery

G_HALF, G_WALL, G_APEX = 13.0, 3.4, 18.0
G_DOORS = [("s", 0, 3.4), ("n", 0, 3.4)]


def build_gallery(P):
    b = Builder()
    # the glass band's frame (glass itself is JS): posts, sill, head beam
    for (sx, sz, ww, dd, side) in room_segments(0, 0, 26, 26, G_DOORS):
        horiz = side in ("n", "s")
        L = ww if horiz else dd
        n = max(1, round(L / 2.6))
        for i in range(n + 1):
            o = -L / 2 + L * i / n
            px, pz = (sx + o, sz) if horiz else (sx, sz + o)
            b.box(P["frame"], 0.16 if horiz else 0.62, G_WALL, 0.62 if horiz else 0.16, px, 0, pz)
        b.box(P["frame"], ww + (0.1 if horiz else 0.12), 0.18, dd + (0.12 if horiz else 0.1), sx, 0, sz)
    for (sx, sz, ww, dd) in ((0, -G_HALF, 26.2, 0.7), (0, G_HALF, 26.2, 0.7), (-G_HALF, 0, 0.7, 26.2), (G_HALF, 0, 0.7, 26.2)):
        b.box(P["frame_dk"], ww, 0.3, dd, sx, G_WALL - 0.3, sz)
    for (side, gx, gz, gw) in door_gaps(0, 0, 26, 26, G_DOORS):
        for s in (-1, 1):
            b.box(P["frame_dk"], 0.3, G_WALL, 0.7, gx + s * (gw / 2 + 0.15), 0, gz)
    # the pyramid's frame: four ridges, two heavy bands, a fine diamond lattice
    base = [(-G_HALF, G_HALF), (G_HALF, G_HALF), (G_HALF, -G_HALF), (-G_HALF, -G_HALF)]
    apex = Vector((0, G_APEX, 0))
    for (x, z) in base:
        b.bar(P["frame_dk"], (x, G_WALL, z), apex, 0.34)
    for k in range(4):
        A = Vector((base[k][0], G_WALL, base[k][1]))
        B = Vector((base[(k + 1) % 4][0], G_WALL, base[(k + 1) % 4][1]))
        C = apex
        nrm = (B - A).cross(C - A).normalized()
        if nrm.dot(Vector(((A.x + B.x) / 2, 0, (A.z + B.z) / 2))) < 0:
            nrm = -nrm
        off = nrm * 0.06
        b.bar(P["frame_dk"], A + off, B + off, 0.3)
        for f in (1 / 3, 2 / 3):                                                     # heavy bands
            p, q = A.lerp(C, f), B.lerp(C, f)
            b.bar(P["frame_dk"], p + off, q + off, 0.22)
        N = 10
        for i in range(1, N):
            t = i / N
            P0 = A.lerp(B, t)
            b.bar(P["frame"], P0 + off, (B * t + C * (1 - t)) + off, 0.06)            # parallel to AC
            b.bar(P["frame"], P0 + off, (A * (1 - t) + C * t) + off, 0.06)            # parallel to BC
    sphere(b, P["gold"], (0, G_APEX + 0.25, 0), 0.4)
    # marble floor, the five plinths (colliders 1.6 x 1.6 x 1.3) and their art
    b.box(P["marble"], 25.0, 0.03, 25.0, 0, 0, 0)
    for (px, pz) in ((-6, -5), (6, -5), (0, 4), (-7, 7), (7, 7)):
        b.box(P["white"], 1.6, 1.3, 1.6, px, 0, pz, bevel=0.04)
        b.box(P["frame_dk"], 1.7, 0.1, 1.7, px, 0, pz)
    sphere(b, P["gold"], (-6, 2.15, -5), 0.75, seg=24, ring=14)                    # the golden orb
    b.cyl(P["brass"], 0.12, (-6, 1.3, -5), (-6, 1.45, -5), seg=12, r2=0.3)
    for i in range(5):                                                             # a twisting cube stack
        s = 0.9 - i * 0.12
        b.box([P["art_red"], P["art_blue"], P["gold"]][i % 3], s, s, s, 6, 1.3 + sum(0.9 - k * 0.12 for k in range(i)), -5,
              ry=i * 0.35, bevel=0.03)
    for i in range(10):                                                            # a white ribbon spiral
        b.box(P["white"], 0.9, 0.22, 0.25, -7, 1.3 + i * 0.24, 7, ry=i * 0.42)
    for s in (-1, 1):                                                              # the easel and its canvas
        b.bar(P["easel"], (7 + s * 0.45, 1.3, 7.3), (7 + s * 0.12, 3.4, 7.05), 0.07)
    b.bar(P["easel"], (7, 1.3, 6.5), (7, 3.1, 6.95), 0.06)
    b.box(P["frame_dk"], 1.25, 1.0, 0.08, 7, 2.0, 7.12, rx=-0.12)
    b.box(P["canvas"], 1.1, 0.85, 0.09, 7, 2.07, 7.12, rx=-0.12)
    # red ropes on brass posts round the pyramid, open at both doors; a
    # spotlight on each corner aimed in
    RH = 15.6
    for (x0, z0, x1, z1) in ((-RH, -RH, RH, -RH), (RH, -RH, RH, RH), (RH, RH, -RH, RH), (-RH, RH, -RH, -RH)):
        L = math.hypot(x1 - x0, z1 - z0)
        n = round(L / 2.6)
        posts = []
        for i in range(n + 1):
            t = i / n
            x, z = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
            if abs(x) < 2.4 and abs(abs(z) - RH) < 0.1:
                posts.append(None)
                continue
            posts.append((x, z))
            b.cyl(P["brass"], 0.06, (x, 0, z), (x, 0.95, z), seg=8)
            b.cyl(P["brass"], 0.2, (x, 0, z), (x, 0.06, z), seg=10)
            sphere(b, P["brass"], (x, 1.0, z), 0.09, seg=8, ring=5)
        for p, q in zip(posts, posts[1:]):
            if not p or not q:
                continue
            mid = ((p[0] + q[0]) / 2, 0.68, (p[1] + q[1]) / 2)
            b.bar(P["rope"], (p[0], 0.92, p[1]), mid, 0.06)
            b.bar(P["rope"], mid, (q[0], 0.92, q[1]), 0.06)
    for (x, z) in ((-17, -17), (17, -17), (17, 17), (-17, 17)):
        b.box(P["frame_dk"], 0.5, 0.3, 0.5, x, 0, z)
        aim = Vector((-x, 9.0, -z)).normalized()
        head = Vector((x, 0.8, z))
        b.cyl(P["frame_dk"], 0.32, head - aim * 0.4, head + aim * 0.4, seg=12)
        b.cyl(P["spot"], 0.26, head + aim * 0.4, head + aim * 0.42, seg=12)
        b.bar(P["frame_dk"], (x, 0.3, z), head, 0.12)
    b.finish("tf-gallery.glb")


# ------------------------------------------------------------ U Mad Bro Shop

S_W, S_D, S_H = 26.0, 14.0, 6.5
S_DOORS = [("s", 0, 4), ("n", -6, 3), ("e", 0, 2.6)]
SIGN = {"w": 15.0, "y0": 5.0, "y1": 11.2, "z": 7.25}      # board on the front (south) face


def awning(b, m, x, z, w, y, depth=1.1, drop=0.7, axis="x", out=1):
    """A curved shop awning: a quarter-round prism along the wall."""
    prof = []
    for i in range(7):
        a = (math.pi / 2) * i / 6
        prof.append((out * depth * math.sin(a), y + drop * math.cos(a) - drop))
    prof += [(out * depth * 0.96, y - drop - 0.06), (0, y - 0.06)]
    if axis == "x":
        pts = [(x - w / 2, v, z + u) for u, v in prof] + [(x + w / 2, v, z + u) for u, v in prof]
    else:
        pts = [(x + u, v, z - w / 2) for u, v in prof] + [(x + u, v, z + w / 2) for u, v in prof]
    n = len(prof)
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    b.poly(m, pts, faces)


def shop_window(b, P, x, z, w, axis="x", out=1, y0=0.8, y1=3.2):
    """Blue-framed window flush on a wall's outer face, with its awning."""
    if axis == "x":
        b.box(P["shop_blue_dk"], w + 0.3, y1 - y0 + 0.3, 0.12, x, y0 - 0.15, z + out * 0.05)
        b.box(P["shop_glass"], w, y1 - y0, 0.12, x, y0, z + out * 0.09)
        for k in range(1, 3):
            b.box(P["shop_blue_dk"], 0.1, y1 - y0, 0.14, x - w / 2 + w * k / 3, y0, z + out * 0.1)
    else:
        b.box(P["shop_blue_dk"], 0.12, y1 - y0 + 0.3, w + 0.3, x + out * 0.05, y0 - 0.15, z)
        b.box(P["shop_glass"], 0.12, y1 - y0, w, x + out * 0.09, y0, z)
    if axis == "x":
        awning(b, P["shop_blue"], x, z + out * 0.1, w + 0.6, y1 + 0.95, axis="x", out=out)
    else:
        awning(b, P["shop_blue"], x + out * 0.1, z, w + 0.6, y1 + 0.95, axis="z", out=out)


def build_shop(P):
    b = Builder()
    rng = random.Random(3)
    hw, hd = S_W / 2, S_D / 2
    # walls (colliders: GreyKit.room 26 x 14 x 6.5, t 0.5), filled in over the
    # doors from 3.2 m (the opening above is out of jump reach)
    for (sx, sz, ww, dd, side) in room_segments(0, 0, S_W, S_D, S_DOORS):
        b.box(P["plaster"], ww, S_H, dd, sx, 0, sz)
        b.box(P["trim"], ww + (0.04 if side in ("n", "s") else 0.1), 0.45, dd + (0.1 if side in ("n", "s") else 0.04), sx, 0, sz)
    for (side, gx, gz, gw) in door_gaps(0, 0, S_W, S_D, S_DOORS):
        horiz = side in ("n", "s")
        b.box(P["plaster"], gw if horiz else 0.5, S_H - 3.2, 0.5 if horiz else gw, gx, 3.2, gz)
        for s in (-1, 1):
            px, pz = (gx + s * (gw / 2 + 0.08), gz) if horiz else (gx, gz + s * (gw / 2 + 0.08))
            b.box(P["shop_blue_dk"], 0.16 if horiz else 0.62, 3.2, 0.62 if horiz else 0.16, px, 0, pz)
        b.box(P["shop_blue_dk"], gw + 0.32 if horiz else 0.62, 0.18, 0.62 if horiz else gw + 0.32, gx, 3.05, gz)
    # the front doors: two glass leaves swung open against the facade
    for s in (-1, 1):
        b.box(P["shop_blue_dk"], 0.08, 3.0, 2.0, s * 2.05, 0, hd + 1.25)
        b.box(P["shop_glass"], 0.1, 2.5, 1.6, s * 2.05, 0.25, hd + 1.25)
    # front windows + awnings, the long awning over the doors
    for x in (-8.2, 8.2):
        shop_window(b, P, x, hd + 0.25, 7.0, "x", 1)
    awning(b, P["shop_blue"], 0, hd + 0.35, 5.2, 4.25, depth=1.4)
    shop_window(b, P, -hw - 0.25, -2.5, 5.0, "z", -1)
    shop_window(b, P, hw + 0.25, -4.5, 3.0, "z", 1)
    # roof (collider 26.6 x 14.6 x 0.5 at 6.5): the slab, a red cornice that
    # sweeps up at the corners like the art's wings
    b.box(P["roof"], S_W + 0.6, 0.5, S_D + 0.6, 0, S_H, 0)
    b.box(P["red_roof"], S_W + 1.2, 0.35, S_D + 1.2, 0, S_H + 0.2, 0, bevel=0.05)
    wing = [(-hd - 0.6, S_H + 0.55), (hd + 0.6, S_H + 0.55), (hd + 0.6, S_H + 0.75), (-hd - 0.6, S_H + 1.6)]
    b.prism(P["red_roof"], wing, -hw - 0.6, -hw + 2.6, axis="x")
    b.prism(P["red_roof"], wing, hw - 2.6, hw + 0.6, axis="x")
    b.box(P["unit"], 2.2, 1.1, 1.6, 8, S_H + 0.55, -3, bevel=0.05)
    b.box(P["unit"], 1.4, 0.8, 1.4, -9, S_H + 0.55, -4, bevel=0.05)
    b.cyl(P["unit"], 0.3, (4, S_H + 0.55, -5), (4, S_H + 1.6, -5), seg=10)
    # the sign: a black board above the doors, past the roofline, marquee
    # bulbs all round (the lettering is a JS canvas)
    W, y0, y1, z = SIGN["w"], SIGN["y0"], SIGN["y1"], SIGN["z"]
    b.box(P["board"], W, y1 - y0, 0.3, 0, y0, z + 0.15, bevel=0.06)
    for sx in (-1, 1):
        b.bar(P["pole"], (sx * W * 0.35, S_H + 0.55, z + 0.1), (sx * W * 0.35, y1 - 0.5, z - 1.8), 0.14)
    per = 2 * (W + (y1 - y0))
    n = int(per / 0.9)
    for i in range(n):
        d = per * i / n
        if d < W:
            p = (-W / 2 + d, y1 - 0.02)
        elif d < W + (y1 - y0):
            p = (W / 2 - 0.02, y1 - (d - W))
        elif d < 2 * W + (y1 - y0):
            p = (W / 2 - (d - W - (y1 - y0)), y0 + 0.02)
        else:
            p = (-W / 2 + 0.02, y0 + (d - 2 * W - (y1 - y0)))
        sphere(b, P["bulb"], (p[0], p[1], z + 0.32), 0.22, seg=8, ring=5)
    # inside: tile floor, ceiling light strips, gondola shelves of merch (the
    # colliders: 4.5 x 1.2 x 1.8 at (-7|0|7, -2)), the counter at (8, 3.5)
    b.box(P["tile"], S_W - 1.0, 0.02, S_D - 1.0, 0, 0, 0)
    for lz in (-4, 0, 4):
        b.box(P["lamp"], S_W - 4, 0.06, 0.4, 0, S_H - 0.08, lz)
    boxes = [P["box_a"], P["box_b"], P["box_c"], P["box_d"], P["box_e"]]
    for gx in (-7, 0, 7):
        b.box(P["shelf"], 4.5, 0.15, 1.2, gx, 0, -2)
        b.box(P["shelf"], 4.5, 1.8, 0.1, gx, 0, -2)
        for ex in (-1, 1):
            b.box(P["shelf"], 0.08, 1.8, 1.2, gx + ex * 2.21, 0, -2)
        for k, sy in enumerate((0.15, 0.75, 1.35)):
            b.box(P["shelf"], 4.4, 0.04, 1.2, gx, sy, -2)
            for side in (-1, 1):
                x = gx - 2.0
                while x < gx + 1.9:
                    s = rng.uniform(0.3, 0.55)
                    if rng.random() < 0.85:
                        b.box(rng.choice(boxes), s, rng.uniform(0.25, 0.5), 0.4, x + s / 2, sy + 0.04, -2 + side * 0.32)
                    x += s + 0.06
    b.box(P["wood"], 5.0, 1.1, 1.4, 8, 0, 3.5, bevel=0.03)
    b.box(P["box_e"], 5.1, 0.06, 1.5, 8, 1.1, 3.5)
    b.box(P["register"], 0.7, 0.35, 0.5, 6.9, 1.16, 3.4, bevel=0.03)
    b.box(P["screen"], 0.5, 0.32, 0.05, 6.9, 1.5, 3.25, rx=-0.3)
    for (tx, tz, c) in ((9.2, 3.3, "box_a"), (9.7, 3.6, "box_b")):                  # merch on the counter
        b.box(P[c], 0.4, 0.3, 0.3, tx, 1.16, tz)
    b.finish("tf-shop.glb")


# ------------------------------------------------------------ Troll Royale props
# royale-drop.js places these: the bus faces +x with its wheels' bottoms near
# y -0.3 (the old grey box's frame); the sky box's origin is the middle of its
# floor (40 x 40, walls 7 high). Glass, flames and the printed trollface stay
# in JS, and so does the paraglider (its trollface is printed on the curved
# canopy, which needs UVs from the same maths that shapes it).

def rprops():
    return {
        "bus": mat("TF_BusYellow", 0xf5c21b, 0.45, 0.05),
        "bus_dk": mat("TF_BusYellowDark", 0xd99a0e, 0.5, 0.05),
        "rub": mat("TF_BusRub", 0x17181a, 0.6),
        "glass": mat("TF_BusGlass", 0x1d2a38, 0.15, 0.3),
        "tyre": mat("TF_Tyre", 0x141414, 0.9),
        "hub": mat("TF_Hub", 0xb8bcc2, 0.35, 0.4),
        "head": mat("TF_Headlight", 0xfff6dc, 0.2, 0.0, 0xfff1d0, 1.5),
        "tail": mat("TF_Taillight", 0xc81e1e, 0.3, 0.0, 0xff2020, 1.2),
        "metal": mat("TF_Engine", 0x5a6068, 0.4, 0.4),
        "metal_dk": mat("TF_EngineDark", 0x2c3036, 0.45, 0.4),
        "glow": mat("TF_Thrust", 0x8fe4ff, 0.2, 0.0, 0x6fd8ff, 2.5),
        "wing": mat("TF_BusWing", 0xe9ebee, 0.4, 0.2),
        "stop": mat("TF_StopRed", 0xd8262a, 0.5),
        "white": mat("TF_White", 0xf4f4f0, 0.6),
        "frame": mat("TF_BoxFrame", 0xf0f3f5, 0.35, 0.3),
        "frame_dk": mat("TF_BoxFrameDark", 0x3a4048, 0.4, 0.3),
        "hull": mat("TF_BoxHull", 0xdfe3e8, 0.4, 0.25),
        "strip": mat("TF_BoxStrip", 0x9fe8ff, 0.2, 0.0, 0x7fdcff, 2.0),
    }


def plate(b, m, pts, y0, y1):
    """A flat polygon (x, z) given a thickness from y0 to y1 (top may tilt:
    pass y1 as a list, one per point)."""
    n = len(pts)
    tops = y1 if isinstance(y1, (list, tuple)) else [y1] * n
    vs = [(x, y0, z) for x, z in pts] + [(x, tops[i], z) for i, (x, z) in enumerate(pts)]
    faces = [list(range(n))[::-1], list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    return b.poly(m, vs, faces)


def build_bus(R):
    b = Builder()
    L0, L1, W = -6.0, 6.0, 3.4              # rear, nose, width (old box: 12 x 3.6)
    hw = W / 2
    # body: lower box to the window sill, the window band, a narrower roof
    b.box(R["bus"], L1 - L0, 1.85, W, 0, 0.3, 0, bevel=0.08)
    b.box(R["bus"], L1 - L0 - 0.2, 1.05, W - 0.04, -0.1, 2.15, 0)
    b.box(R["bus"], L1 - L0 - 0.3, 0.32, W - 0.3, -0.15, 3.2, 0, bevel=0.12)
    b.box(R["bus_dk"], L1 - L0 - 0.6, 0.12, W - 0.9, -0.2, 3.5, 0, bevel=0.04)   # roof crown
    # side windows (pillars are the body showing between) and rub rails
    for s in (-1, 1):
        x = -5.3
        while x < 3.7:
            b.box(R["glass"], 0.95, 0.85, 0.06, x + 0.475, 2.25, s * (hw + 0.0))
            x += 1.15
        for y in (0.75, 1.45, 2.12):
            b.box(R["rub"], L1 - L0 + 0.04, 0.09, 0.05, 0, y, s * (hw + 0.02))
        b.box(R["rub"], 0.06, 1.1, 0.9, 1.0, 0.95, s * (hw + 0.02))                # the side door
    # the nose: windshield over the grin, headlights, grille, bumper
    b.box(R["glass"], 0.08, 1.0, W - 0.5, L1 + 0.02, 2.2, 0)
    b.box(R["rub"], 0.1, 0.12, W - 0.3, L1 + 0.04, 3.2, 0)
    for s in (-1, 1):
        b.cyl(R["head"], 0.24, (L1, 0.95, s * 1.25), (L1 + 0.1, 0.95, s * 1.25), seg=14)
        b.cyl(R["rub"], 0.3, (L1 - 0.02, 0.95, s * 1.25), (L1 + 0.06, 0.95, s * 1.25), seg=14)
        b.cyl(R["tail"], 0.18, (L0 - 0.08, 1.0, s * 1.3), (L0, 1.0, s * 1.3), seg=12)
    b.box(R["rub"], 0.35, 0.36, W + 0.15, L1 + 0.15, 0.2, 0, bevel=0.06)          # bumpers
    b.box(R["rub"], 0.35, 0.36, W + 0.15, L0 - 0.15, 0.2, 0, bevel=0.06)
    b.box(R["glass"], 0.06, 1.0, 1.4, L0 - 0.02, 2.15, 0)                          # rear door window
    b.box(R["rub"], 0.06, 1.5, 0.08, L0 - 0.03, 0.6, 0)
    # wheels and arches
    for x in (3.9, -3.7):
        for s in (-1, 1):
            b.cyl(R["rub"], 0.92, (x, 0.45, s * (hw - 0.02)), (x, 0.45, s * (hw + 0.04)), seg=20)
            b.cyl(R["tyre"], 0.72, (x, 0.45, s * (hw - 0.4)), (x, 0.45, s * (hw + 0.08)), seg=20)
            b.cyl(R["hub"], 0.36, (x, 0.45, s * (hw + 0.06)), (x, 0.45, s * (hw + 0.12)), seg=14)
    # the stop arm, out on the left (troll humour: it never stops)
    b.cyl(R["stop"], 0.42, (2.9, 1.7, -hw - 0.08), (2.9, 1.7, -hw - 0.16), seg=8)
    b.cyl(R["white"], 0.34, (2.9, 1.7, -hw - 0.17), (2.9, 1.7, -hw - 0.19), seg=8)
    # stubby swept wings with a fin each
    for s in (-1, 1):
        pts = [(1.6, s * hw), (-1.8, s * hw), (-3.2, s * 4.9), (-1.9, s * 4.9)]
        plate(b, R["wing"], pts, 1.35, [1.6, 1.6, 1.85, 1.85])
        plate(b, R["stop"], [(-3.2, s * 4.88), (-1.9, s * 4.88), (-2.2, s * 4.88), (-3.4, s * 4.88)], 1.85, [1.88, 1.88, 2.9, 2.9])
        b.box(R["bus_dk"], 1.3, 1.05, 0.08, -2.6, 1.85, s * 4.9)
    # twin jet pods off the back: casing, intake ring, glowing nozzle
    for s in (-1, 1):
        a, c = (L0 + 0.6, 2.2, s * 1.2), (L0 - 1.4, 2.2, s * 1.2)
        b.cyl(R["metal"], 0.82, a, c, seg=20, r2=0.72)
        b.cyl(R["metal_dk"], 0.9, (L0 + 0.7, 2.2, s * 1.2), (L0 + 0.4, 2.2, s * 1.2), seg=20)
        b.cyl(R["metal_dk"], 0.74, c, (L0 - 1.75, 2.2, s * 1.2), seg=20, r2=0.6)
        b.cyl(R["glow"], 0.5, (L0 - 1.74, 2.2, s * 1.2), (L0 - 1.78, 2.2, s * 1.2), seg=16)
        b.bar(R["metal_dk"], (L0 + 0.2, 2.2, s * 1.2), (L0 + 0.2, 1.4, s * 1.2), 0.25)
    # "TROLL BUS" plate on the roof: a sign blank (lettering would need a texture)
    b.box(R["rub"], 3.6, 0.6, 0.12, -0.5, 3.52, 0)
    b.finish("tf-bus.glb")


def build_bus_face(R):
    """The grin on the bus's nose, the same carving as the city dome's."""
    GLB.build_trollhead(R, width=2.5, res=120, front=0.22, back=0.05, carve=0.06, name="tf-busface",
                        place=(6.04, 0.42, 0.0, math.pi / 2, 0.0, 0.0), colors=(0xffffff, 0xf3f3ee, 0x101012), moss_on=False)


def build_skybox(R):
    """The sky lobby's frame round the JS glass: white columns, beams, wall
    mullions and a roof grid; a deck rim with a light strip; under the floor a
    hull of four struts down to a hub with a glowing anti-grav ring."""
    b = Builder()
    S, H = 40.0, 7.0
    h = S / 2
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box(R["frame"], 0.6, H + 0.6, 0.6, sx * h, -0.3, sz * h, bevel=0.05)
            b.box(R["frame_dk"], 0.8, 0.3, 0.8, sx * h, H + 0.3, sz * h, bevel=0.05)
    for y in (0.0, H):
        for (x, z, w, d) in ((0, -h, S, 0.4), (0, h, S, 0.4), (-h, 0, 0.4, S), (h, 0, 0.4, S)):
            b.box(R["frame"], w, 0.4, d, x, y - 0.2, z)
    for k in range(1, 8):                                                          # wall mullions every 5 m
        c = -h + k * S / 8
        for (x, z) in ((c, -h), (c, h), (-h, c), (h, c)):
            b.box(R["frame"], 0.16, H, 0.16, x, 0, z)
    for k in range(1, 4):                                                          # floor + roof grid
        c = -h + k * S / 4
        b.box(R["frame"], S, 0.06, 0.12, 0, 0.0, c)
        b.box(R["frame"], 0.12, 0.06, S, c, 0.0, 0)
        b.box(R["frame"], S, 0.25, 0.25, 0, H, c)
        b.box(R["frame"], 0.25, 0.25, S, c, H, 0)
    # the deck rim under the floor's edge, a light strip round it
    for (x, z, w, d) in ((0, -h + 1, S + 1.2, 2.0), (0, h - 1, S + 1.2, 2.0), (-h + 1, 0, 2.0, S - 2), (h - 1, 0, 2.0, S - 2)):
        b.box(R["hull"], w, 1.4, d, x, -1.8, z, bevel=0.1)
    for (x, z, w, d) in ((0, -h - 0.62, S + 1.2, 0.06), (0, h + 0.62, S + 1.2, 0.06), (-h - 0.62, 0, 0.06, S + 1.2), (h + 0.62, 0, 0.06, S + 1.2)):
        b.box(R["strip"], w, 0.18, d, x, -1.1, z)
    # the hull: struts from the corners to a hub 16 m down, the ring round it
    hub = Vector((0, -16.0, 0))
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.bar(R["hull"], (sx * (h - 1), -1.8, sz * (h - 1)), hub + Vector((sx * 1.5, 2.5, sz * 1.5)), 0.9)
    for sx, sz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        b.bar(R["frame_dk"], (sx * (h - 1), -1.8, sz * (h - 1)), hub + Vector((sx * 1.6, 3.0, sz * 1.6)), 0.4)
    b.cyl(R["hull"], 3.2, hub + Vector((0, 4.0, 0)), hub, seg=24, r2=2.0)
    b.cyl(R["frame_dk"], 2.0, hub, hub + Vector((0, -2.0, 0)), seg=24, r2=0.6)
    for r, y in ((5.2, 1.0), (3.6, -0.8)):
        b.cyl(R["strip"], r, hub + Vector((0, y, 0)), hub + Vector((0, y + 0.3, 0)), seg=40, r2=r)
        b.cyl(R["frame_dk"], r - 0.35, hub + Vector((0, y - 0.01, 0)), hub + Vector((0, y + 0.31, 0)), seg=40)
    b.finish("tf-skybox.glb")


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    P = pal()
    build_city(P)
    build_city_face(P)
    build_peak(P)
    build_gallery(P)
    build_shop(P)
    R = rprops()
    build_bus(R)
    build_bus_face(R)
    build_skybox(R)
    quantize_glb.main([os.path.join(HERE, f) for f in ("tf-city.glb", "tf-cityface.glb", "tf-peak.glb", "tf-gallery.glb", "tf-shop.glb",
                                                      "tf-bus.glb", "tf-busface.glb", "tf-skybox.glb")])
    print("ALL ISLAND LANDMARKS EXPORTED")


if __name__ == "__main__":
    main()
