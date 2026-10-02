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


# ============================================================ phase 4: landmarks B
# Meme Lab, the Observatory, the Portal, the Skate Bowl, the Cave, the Dock,
# the Old Tree, the Boat, the Marketplace and the Bridge. Same rules as above:
# every collider stays in trollface-island.js and the numbers here copy it.
# The two portal surfaces (Meme Lab's swirl, the Portal's green door) are JS
# canvas textures; everything here is opaque.

def pal4():
    return {
        # Meme Lab
        "lab_side": mat("TF_LabSide", 0x7f9aac, 0.6, 0.2),
        "lab_deck": mat("TF_LabDeck", 0xb3cad8, 0.55, 0.15),
        "lab_seam": mat("TF_LabSeam", 0x5d7486, 0.6),
        "lab_step": mat("TF_LabStep", 0x9db6c6, 0.6, 0.15),
        "hazard": mat("TF_Hazard", 0xf6d23a, 0.6),
        "lab_glow": mat("TF_LabGlow", 0x7fe8ff, 0.3, 0.0, 0x5fe0ff, 1.6),
        "lab_ring": mat("TF_LabRing", 0x5a7484, 0.45, 0.3),
        "lab_ring_dk": mat("TF_LabRingDark", 0x34444f, 0.5, 0.3),
        "cuff": mat("TF_LabCuff", 0xf2d68a, 0.5, 0.1),
        "orb": mat("TF_LabOrb", 0xf8e9ad, 0.4),
        "orb_core": mat("TF_LabOrbCore", 0x8dff6a, 0.3, 0.0, 0x5dff3a, 2.2),
        "arc": mat("TF_LabArc", 0xb8fbff, 0.3, 0.0, 0x8ff4ff, 2.4),
        "panel_frame": mat("TF_PanelFrame", 0xc8ced4, 0.4, 0.3),
        "panel_cell": mat("TF_PanelCell", 0x1f3d8a, 0.2, 0.3),
        "cable": mat("TF_Cable", 0x1a1c20, 0.7),
        # The Observatory
        "obs_wall": mat("TF_ObsWall", 0xa9b7c0, 0.8),
        "obs_band": mat("TF_ObsBand", 0x76858f, 0.7),
        "obs_win": mat("TF_ObsWindow", 0x9fd8ff, 0.2, 0.0, 0x6fc4ff, 0.5),
        "obs_dome": mat("TF_ObsDome", 0xf6f6f2, 0.35, 0.05),
        "slit": mat("TF_ObsSlit", 0x15171c, 0.6),
        "scope": mat("TF_Scope", 0xf2cf5a, 0.4, 0.1),
        "scope_dk": mat("TF_ScopeDark", 0xb8902e, 0.5, 0.1),
        "lens": mat("TF_Lens", 0x0d1014, 0.1, 0.3),
        "obs_screen": mat("TF_ObsScreen", 0x7fd0ff, 0.3, 0.0, 0x4fb8ff, 1.1),
        # The Portal
        "sandrock": mat("TF_SandRock", 0xe0bf92, 0.95),
        "sandrock_dk": mat("TF_SandRockDark", 0xbf9468, 0.95),
        "terra": mat("TF_Terra", 0xc47a58, 0.9),
        "terra_dk": mat("TF_TerraDark", 0x9a573d, 0.9),
        "terra_lt": mat("TF_TerraLight", 0xdb9a74, 0.9),
        "rune": mat("TF_Rune", 0xa8ff7a, 0.3, 0.0, 0x6dff3a, 1.6),
        # Skate Bowl
        "conc": mat("GS_Concrete", 0xd0d0cc, 0.92),
        "conc_dk": mat("TF_SkateStep", 0xa9abae, 0.9),
        "coping": mat("TF_Coping", 0x9aa3ad, 0.35, 0.5),
        "paint_y": mat("TF_PaintYellow", 0xf6d23a, 0.6),
        "paint_r": mat("TF_PaintRed", 0xe8412f, 0.6),
        "paint_b": mat("TF_PaintBlue", 0x2f8fe0, 0.6),
        "paint_g": mat("TF_PaintGreen", 0x3dbb4a, 0.6),
        "paint_p": mat("TF_PaintPink", 0xff5ca8, 0.6),
        "bench": mat("TF_Bench", 0xc3cad2, 0.4, 0.3),
        # The Cave
        "cave": mat("TF_CaveRock", 0x5aa592, 0.95),
        "cave_dk": mat("TF_CaveRockDark", 0x3f8574, 0.95),
        "cave_in": mat("TF_CaveInside", 0x1b2925, 1.0),
        "sand": mat("TF_Sand", 0xecd6a6, 0.95),
        "crystal": mat("TF_Crystal", 0x9ff6ff, 0.2, 0.0, 0x5fe8ff, 2.0),
        "lantern": mat("TF_Lantern", 0xffe2a0, 0.3, 0.0, 0xffc860, 1.8),
        # The Dock, the Bridge
        "plank": mat("GS_Plank", 0xb0874f, 0.85),
        "plank_dk": mat("TF_PlankDark", 0x6e5034, 0.85),
        "pile": mat("TF_Pile", 0x54402c, 0.9),
        "rope": mat("TF_RopeHemp", 0xd6bf8c, 0.9),
        "crate": mat("TF_Crate", 0xc49a62, 0.85),
        "stone": mat("TF_BridgeStone", 0xa9a49a, 0.95),
        # The Old Tree
        "bark": mat("TF_Bark", 0x6b4a2e, 0.95),
        "leaf_a": mat("TF_LeafA", 0x35b04f, 0.85),
        "leaf_b": mat("TF_LeafB", 0x23893d, 0.85),
        "leaf_lt": mat("TF_LeafLight", 0x63cf5e, 0.85),
        "tyre": mat("TF_Tyre", 0x141414, 0.9),
        # The Boat
        "hull": mat("TF_Hull", 0xd3dcdf, 0.45, 0.05),
        "hull_lo": mat("TF_HullLow", 0xaebabf, 0.5, 0.05),
        "stripe": mat("TF_HullStripe", 0x1d3b5c, 0.45),
        "deck": mat("TF_Deck", 0xc49a64, 0.8),
        "sail": mat("TF_Sail", 0xfbfbf7, 0.8),
        "sail_line": mat("TF_SailLine", 0xd9dde2, 0.7),
        "logo": mat("TF_SailLogo", 0x1f8ff0, 0.6),
        "mast": mat("TF_Mast", 0xdfe3e6, 0.35, 0.3),
        "cabin_win": mat("TF_CabinWindow", 0x1d2a38, 0.15, 0.3),
        "masthead": mat("TF_Masthead", 0xffffff, 0.3, 0.0, 0xfff4d8, 2.0),
        # The Marketplace
        "stall": mat("TF_Stall", 0xb07a4a, 0.85),
        "stall_lt": mat("TF_StallTop", 0xc99662, 0.85),
        "stall_dk": mat("TF_StallDark", 0x7e5330, 0.85),
        "cloth_r": mat("TF_ClothRed", 0xf0262e, 0.85),
        "cloth_y": mat("TF_ClothYellow", 0xffdc1e, 0.85),
        "cloth_b": mat("TF_ClothBlue", 0x1c3ff0, 0.85),
        "cloth_g": mat("TF_ClothGreen", 0x2ee02e, 0.85),
        "cloth_c": mat("TF_ClothCyan", 0x18a8f0, 0.85),
        "pole_w": mat("TF_PoleWhite", 0xf2f2ee, 0.6),
        "fairy": mat("TF_FairyBulb", 0xfff4c8, 0.3, 0.0, 0xffe8a8, 1.8),
        "fruit_r": mat("TF_FruitRed", 0xd8302a, 0.5),
        "fruit_o": mat("TF_FruitOrange", 0xf5901e, 0.5),
        "fruit_g": mat("TF_FruitGreen", 0x7ccf3a, 0.5),
    }


# ------------------------------------------------------------ phase 4 helpers

def torus(b, m, c, R, r, u, v, seg=48, tseg=10):
    """A ring of radius R, tube r, in the plane of u and v round c."""
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
            faces.append([i * tseg + j, i * tseg + jj, ii * tseg + jj, ii * tseg + j])
    smooth(b.poly(m, pts, faces))


def sheet(b, m, grid, thick=0.04):
    """A thin closed slab from a grid of top points (rows x cols), so cloth
    reads from above and below."""
    R, C = len(grid), len(grid[0])
    pts = [p for row in grid for p in row] + [(p[0], p[1] - thick, p[2]) for row in grid for p in row]
    off = R * C
    at = lambda r, c: r * C + c  # noqa: E731
    faces = []
    for r in range(R - 1):
        for c in range(C - 1):
            q = [at(r, c), at(r, c + 1), at(r + 1, c + 1), at(r + 1, c)]
            faces.append(q)
            faces.append([off + i for i in q[::-1]])
    ring = [at(0, c) for c in range(C)] + [at(r, C - 1) for r in range(1, R)] + \
        [at(R - 1, c) for c in range(C - 2, -1, -1)] + [at(r, 0) for r in range(R - 2, 0, -1)]
    for i in range(len(ring)):
        a, bb = ring[i], ring[(i + 1) % len(ring)]
        faces.append([a, off + a, off + bb, bb])
    return b.poly(m, pts, faces)


def arc(b, m, a, c, rng, n=5, amp=0.35, w=0.05):
    """A zig-zag spark from a to c."""
    a, c = Vector(a), Vector(c)
    prev = a
    for k in range(1, n + 1):
        p = a.lerp(c, k / n)
        if k < n:
            p += Vector((rng.uniform(-amp, amp), rng.uniform(-amp, amp), rng.uniform(-amp, amp)))
        b.bar(m, prev, p, w)
        prev = p


def crag_box(b, rng, m, x0, z0, x1, z1, y0, y1, lean=0.3, jit=0.25, step=1.6, rings=3):
    """A rectangular block of rock: jagged leaning sides whose top edge sits
    on the collider's (x0..x1, z0..z1) at exactly y1, capped flat."""
    path = []
    for (ax, az, bx, bz, nx, nz) in ((x0, z0, x1, z0, 0, -1), (x1, z0, x1, z1, 1, 0), (x1, z1, x0, z1, 0, 1), (x0, z1, x0, z0, -1, 0)):
        L = math.hypot(bx - ax, bz - az)
        n = max(2, round(L / step))
        for i in range(n):
            t = i / n
            path.append((ax + (bx - ax) * t, az + (bz - az) * t, nx, nz, i == 0))
    pts, idx = [], []
    for (px, pz, nx, nz, corner) in path:
        col = []
        for k in range(rings + 1):
            t = k / rings
            y = y0 + (y1 - y0) * t
            off = lean * (1 - t)
            if 0 < k < rings:
                off += rng.uniform(-jit, jit)
                y += rng.uniform(-0.2, 0.2) * (y1 - y0) / rings
            elif k == rings:
                off = -0.02
            if corner:
                ox, oz = (px - (x0 + x1) / 2), (pz - (z0 + z1) / 2)
                L = math.hypot(ox, oz) or 1
                dx, dz = ox / L * off, oz / L * off
            else:
                dx, dz = nx * off, nz * off
            col.append(len(pts))
            pts.append((px + dx, y, pz + dz))
        idx.append(col)
    faces = []
    N = len(idx)
    for i in range(N):
        j = (i + 1) % N
        for k in range(rings):
            faces.append([idx[i][k], idx[j][k], idx[j][k + 1], idx[i][k + 1]])
    faces.append([idx[i][rings] for i in range(N)])
    return b.poly(m, pts, faces)


# ------------------------------------------------------------ Meme Lab

LAB_C = Vector((-2.0, 1.32 + 6.7, -1.0))                          # the ring's centre
LAB_U = Vector((math.cos(0.6), 0.0, math.sin(0.6)))                # three.js rotateY(-0.6) of +x
LAB_V = Vector((0.0, 1.0, 0.0))


def build_memelab(P):
    """The blue portal ring on a steel deck (trollface.io's Meme Generator):
    slate tube, cream cuffs, orbs with green cores and sparks round it, the
    solar panel. Colliders: deck 18 x 12 x 1.32, stairs S and E, the ring's
    foot, the panel's stand."""
    b = Builder()
    rng = random.Random(11)
    b.box(P["lab_side"], 18, 1.2, 12, 0, 0, 0, bevel=0.06)
    b.box(P["lab_deck"], 18.1, 0.13, 12.1, 0, 1.2, 0, bevel=0.04)
    for x in (-6, -3, 0, 3, 6):
        b.box(P["lab_seam"], 0.06, 0.01, 11.7, x, 1.33, 0)
    for z in (-3, 3):
        b.box(P["lab_seam"], 17.7, 0.01, 0.06, 0, 1.33, z)
    for i in range(36):                                             # hazard edging, open at the stairs
        x = -9 + 0.25 + i * 0.5
        for sz in (-1, 1):
            if sz > 0 and abs(x) < 2.3:
                continue
            b.box(P["hazard"] if i % 2 else P["ink"], 0.5, 0.02, 0.3, x, 1.33, sz * 5.83)
    for i in range(24):
        z = -6 + 0.25 + i * 0.5
        for sx in (-1, 1):
            if sx > 0 and abs(z) < 2.3:
                continue
            b.box(P["hazard"] if i % 2 else P["ink"], 0.3, 0.02, 0.5, sx * 8.83, 1.33, z)
    for (x, z, w, d) in ((0, -6.07, 17.6, 0.04), (0, 6.07, 17.6, 0.04), (-9.07, 0, 0.04, 11.6), (9.07, 0, 0.04, 11.6)):
        b.box(P["lab_glow"], w, 0.1, d, x, 0.25, z)                # underglow strip
    stairs(b, P["lab_step"], 0, 6, 0, 1, 0, 1.32, 4)
    stairs(b, P["lab_step"], 9, 0, 1, 0, 0, 1.32, 4)
    # the ring, its lip round the swirl, four cuffs
    c, u, v = LAB_C, LAB_U, LAB_V
    n = u.cross(v)
    torus(b, P["lab_ring"], c, 6.0, 0.7, u, v, seg=60, tseg=12)
    torus(b, P["lab_ring_dk"], c, 5.32, 0.16, u, v, seg=60, tseg=6)
    for deg in (68, 160, 232, 352):
        th = math.radians(deg)
        p = c + (u * math.cos(th) + v * math.sin(th)) * 6.0
        t = -u * math.sin(th) + v * math.cos(th)
        b.cyl(P["cuff"], 0.98, p - t * 0.62, p + t * 0.62, seg=18)
        for s in (-1, 1):
            b.cyl(P["ink"], 1.01, p + t * (s * 0.62 - 0.07), p + t * (s * 0.62 + 0.07), seg=18)
    # the clamp at its foot (collider 2.4 x 1.6 x 1.4) and two braces
    b.box(P["lab_ring_dk"], 2.4, 1.4, 1.1, -2, 1.32, -1, ry=-0.6, bevel=0.1)
    for deg in (245, 295):
        th = math.radians(deg)
        p = c + (u * math.cos(th) + v * math.sin(th)) * 6.2
        b.bar(P["lab_ring_dk"], c + u * (math.cos(th) * 1.0) + Vector((0, -5.6, 0)), p, 0.32)
    # orbs round it, each with green cores on both faces and a spark to the ring
    for i in range(6):
        a = i / 6 * 2 * math.pi
        d = u * math.cos(a) + v * math.sin(a)
        p = c + d * 7.6
        sphere(b, P["orb"], p, 0.45, seg=16, ring=10)
        for s in (-1, 1):
            sphere(b, P["orb_core"], p + n * s * 0.36, 0.17, seg=10, ring=6)
        arc(b, P["arc"], p - d * 0.45, c + d * 6.75, rng, n=4, amp=0.3, w=0.05)
        arc(b, P["arc"], p + (u * -math.sin(a) + v * math.cos(a)) * 0.45,
            c + (u * math.cos(a + 0.5) + v * math.sin(a + 0.5)) * 7.6, rng, n=5, amp=0.4, w=0.04)
    # the solar panel: 7 x 4.4 tilted -0.35 about x at (5, 2.6, 1.5) on its stand
    def tilt(lx, ly, lz):
        a = -0.35
        return (5 + lx, 2.6 + ly * math.cos(a) - lz * math.sin(a), 1.5 + ly * math.sin(a) + lz * math.cos(a))
    b.box(P["panel_frame"], 7.0, 0.16, 4.4, 5, 2.52, 1.5, rx=-0.35)
    for i in range(6):
        for j in range(3):
            X, Y, Z = tilt(-3.4 + (i + 0.5) * 6.8 / 6, 0.09, -2.1 + (j + 0.5) * 4.2 / 3)
            b.box(P["panel_cell"], 6.8 / 6 - 0.07, 0.04, 4.2 / 3 - 0.07, X, Y - 0.02, Z, rx=-0.35)
    b.box(P["lab_ring_dk"], 1.0, 1.12, 1.0, 5, 1.32, 1.5, bevel=0.05)
    b.cyl(P["lab_ring_dk"], 0.25, (5, 2.3, 1.5), (5, 2.55, 1.5), seg=10)
    b.bar(P["cable"], (4.5, 1.37, 1.5), (0.6, 1.37, 0.3), 0.12, 0.06)
    b.bar(P["cable"], (0.6, 1.37, 0.3), (-0.8, 1.37, -0.2), 0.12, 0.06)
    for (x, z) in ((-8.4, -5.4), (8.4, -5.4), (-8.4, 5.4), (8.4, 5.4)):
        b.cyl(P["lab_glow"], 0.18, (x, 1.33, z), (x, 1.45, z), seg=10)
    b.finish("tf-memelab.glb")


# ------------------------------------------------------------ The Observatory

OB_DOORS = [("s", 0, 3), ("n", 2, 2.6)]
OB_R, OB_Y = 6.4, 6.5                     # dome radius, its base


def build_observatory(P):
    """A grey-blue house under a white dome with a dark slit, the fat yellow
    telescope out of it (trollface.io's Observatory). Colliders: room 14 x 14
    x 6, roof slab, the dome's disc, the mount inside."""
    b = Builder()
    for (sx, sz, ww, dd, side) in room_segments(0, 0, 14, 14, OB_DOORS):
        horiz = side in ("n", "s")
        b.box(P["obs_wall"], ww, 6.0, dd, sx, 0, sz)
        b.box(P["obs_band"], ww + (0.04 if horiz else 0.12), 0.55, dd + (0.12 if horiz else 0.04), sx, 0, sz)
        b.box(P["obs_band"], ww + (0.04 if horiz else 0.12), 0.3, dd + (0.12 if horiz else 0.04), sx, 4.9, sz)
    for (side, gx, gz, gw) in door_gaps(0, 0, 14, 14, OB_DOORS):
        horiz = side in ("n", "s")
        b.box(P["obs_wall"], gw if horiz else 0.5, 6.0 - 3.2, 0.5 if horiz else gw, gx, 3.2, gz)
        for s in (-1, 1):
            px, pz = (gx + s * (gw / 2 + 0.08), gz) if horiz else (gx, gz + s * (gw / 2 + 0.08))
            b.box(P["obs_band"], 0.16 if horiz else 0.62, 3.2, 0.62 if horiz else 0.16, px, 0, pz)
        b.box(P["obs_band"], gw + 0.32 if horiz else 0.62, 0.18, 0.62 if horiz else gw + 0.32, gx, 3.05, gz)
    for x in (-4.5, 4.5):                                             # round windows, N and S
        for zs in (-1, 1):
            b.cyl(P["obs_band"], 0.75, (x, 3.6, zs * 6.7), (x, 3.6, zs * 7.32), seg=18)
            b.cyl(P["obs_win"], 0.55, (x, 3.6, zs * 6.66), (x, 3.6, zs * 7.36), seg=18)
    for z in (-4, 0, 4):                                              # and E and W
        for xs in (-1, 1):
            b.cyl(P["obs_band"], 0.75, (xs * 6.7, 3.6, z), (xs * 7.32, 3.6, z), seg=18)
            b.cyl(P["obs_win"], 0.55, (xs * 6.66, 3.6, z), (xs * 7.36, 3.6, z), seg=18)
    b.box(P["obs_band"], 14.6, 0.5, 14.6, 0, 6.0, 0, bevel=0.06)
    b.cyl(P["obs_band"], OB_R + 0.25, (0, OB_Y, 0), (0, OB_Y + 0.35, 0), seg=48)
    # the dome: white, a dark slit facing +x where the telescope comes out
    LAT, SEG = 12, 48
    pts = []
    for i in range(LAT + 1):
        e = (math.pi / 2) * i / LAT
        for j in range(SEG):
            a = 2 * math.pi * j / SEG
            pts.append((OB_R * math.cos(e) * math.cos(a), OB_Y + 0.3 + OB_R * math.sin(e), OB_R * math.cos(e) * math.sin(a)))
    dome, slit = [], []
    for i in range(LAT):
        for j in range(SEG):
            k = (j + 1) % SEG
            f = [i * SEG + j, i * SEG + k, (i + 1) * SEG + k, (i + 1) * SEG + j]
            amid = 2 * math.pi * (j + 0.5) / SEG
            amid = math.atan2(math.sin(amid), math.cos(amid))
            (slit if abs(amid) < 0.2 and i >= 2 else dome).append(f)
    smooth(b.poly(P["obs_dome"], pts, dome))
    b.poly(P["slit"], pts, slit)
    for s in (-1, 1):                                                 # the slit's shutter rails
        a = s * 0.2
        prev = None
        for i in range(2, LAT + 1):
            e = (math.pi / 2) * i / LAT
            p = Vector((OB_R * math.cos(e) * math.cos(a), OB_Y + 0.3 + OB_R * math.sin(e), OB_R * math.cos(e) * math.sin(a))) * 1.0
            p = Vector((p.x * 1.012, (p.y - OB_Y - 0.3) * 1.012 + OB_Y + 0.3, p.z * 1.012))
            if prev:
                b.bar(P["obs_band"], prev, p, 0.16)
            prev = p
    sphere(b, P["obs_band"], (0, OB_Y + 0.3 + OB_R, 0), 0.35)
    # the telescope (trollface-island.js: its axis rotZ -0.9 through (4.5, 11, 0))
    d = Vector((math.sin(0.9), math.cos(0.9), 0.0))
    c = Vector((4.5, 11.0, 0.0))
    inner, outer = c - d * 4.5, c + d * 4.5
    b.cyl(P["scope"], 1.1, inner, c + d * 2.7, seg=28, r2=1.25)
    b.cyl(P["scope_dk"], 1.32, c + d * 2.5, c + d * 2.85, seg=28)
    b.cyl(P["scope"], 1.48, c + d * 2.85, outer, seg=28, r2=1.58)
    b.cyl(P["ink"], 1.6, outer - d * 0.12, outer, seg=28)
    b.cyl(P["white"], 1.38, outer, outer + d * 0.04, seg=28)
    b.cyl(P["lens"], 1.08, outer + d * 0.02, outer + d * 0.08, seg=28)
    perp = Vector((-d.y, d.x, 0.0))
    b.cyl(P["scope_dk"], 0.24, c + perp * 1.45 - d * 0.6, c + perp * 1.45 + d * 1.6, seg=12)
    for f in (-0.3, 1.2):
        b.bar(P["scope_dk"], c + perp * 1.1 + d * f, c + perp * 1.45 + d * f, 0.12)
    # inside: tile, the mount (collider 3 x 3 x 1.2 at (-2, -2)) with a desk
    b.box(P["tile"], 13.0, 0.02, 13.0, 0, 0, 0)
    b.box(P["obs_band"], 3.0, 1.2, 3.0, -2, 0, -2, bevel=0.06)
    b.box(P["register"], 1.8, 0.4, 0.9, -2, 1.2, -2.6, bevel=0.04)
    b.box(P["obs_screen"], 1.4, 0.7, 0.05, -2, 1.65, -2.95, rx=0.15)
    b.cyl(P["brass"], 0.35, (-1.6, 1.2, -1.4), (-1.6, 1.55, -1.4), seg=12)
    b.cyl(P["scope"], 0.18, (-1.6, 1.6, -1.4), (-0.6, 2.3, -1.2), seg=10, r2=0.24)
    b.box(P["lamp"], 6.0, 0.06, 0.4, 0, 5.92, 0)
    b.finish("tf-observatory.glb")


# ------------------------------------------------------------ The Portal

def build_portal(P):
    """A chunky terracotta stone gateway up steps on a sandy plateau, rocks
    round it and pebbles floating near the door (trollface.io's Portal). The
    green door itself is a JS canvas. Colliders: plateau 26 x 20 x 2.31, the
    upper block 12 x 7 x 4.62, three flights, posts, lintel, four rocks."""
    b = Builder()
    rng = random.Random(5)
    crag_box(b, rng, P["sandrock_dk"], -13, -10, 13, 10, -0.3, 2.31, lean=0.35, step=1.8)
    b.box(P["sandrock"], 25.9, 0.02, 19.9, 0, 2.3, 0)
    stairs(b, P["terra_lt"], -4, 10, 0, 1, 0, 2.31, 4)
    stairs(b, P["terra_lt"], -13, 4, -1, 0, 0, 2.31, 4)
    crag_box(b, rng, P["terra_dk"], -4, -8.5, 8, -1.5, 2.2, 4.62, lean=0.25, step=1.5)
    b.box(P["terra"], 11.9, 0.02, 6.9, 2, 4.6, -5)
    stairs(b, P["terra_lt"], 2, -1.5, 0, 1, 2.31, 4.62, 3.4)
    # the gateway: posts (colliders 1 x 1 x 8 at x -1.5 and 5.5), lintel 8 x 1 x 1
    for px, s in ((-1.6, -1), (5.6, 1)):
        b.box(P["terra"], 1.3, 8.0, 1.7, px, 4.62, -5, bevel=0.12)
        b.box(P["terra_dk"], 0.2, 7.9, 1.2, px - s * 0.62, 4.62, -5)          # the reveal
        b.box(P["terra_dk"], 1.6, 0.55, 2.1, px - s * 0.0 + s * 0.15, 4.62, -5, bevel=0.08)
        for y in (6.6, 9.1, 11.3):                                            # chisel marks
            b.box(P["ink"], 0.7, 0.06, 0.04, px, y, -5 + 0.87)
            b.box(P["ink"], 0.7, 0.06, 0.04, px, y + 0.4, -5 - 0.87)
    b.box(P["terra"], 9.6, 1.5, 2.1, 2, 12.45, -5, bevel=0.15, rz=0.025)
    b.box(P["terra_lt"], 10.3, 0.4, 2.4, 2, 13.85, -5, bevel=0.1, rz=0.025)
    b.box(P["ink"], 6.0, 0.16, 0.5, 2, 12.47, -5)
    for x in (-0.94, 4.94):
        b.box(P["ink"], 0.12, 7.85, 0.5, x, 4.62, -5)
    b.box(P["terra_lt"], 6.0, 0.12, 2.2, 2, 4.62, -5)                         # the sill
    for x in (-0.2, 2.0, 4.2):                                                # glowing runes on the lintel
        b.box(P["rune"], 0.5, 0.5, 0.04, x, 12.95, -5 + 1.07, ry=0.0, rz=0.785)
        b.box(P["rune"], 0.5, 0.5, 0.04, x, 12.95, -5 - 1.07, ry=0.0, rz=0.785)
    # the four rocks (colliders s*1.6 square, s*1.2 high, on the plateau)
    for k, (dx, dz, s) in enumerate(((-10, -7, 2.2), (9, 6, 1.8), (11, -8, 2.6), (-7, 7, 1.5))):
        b.lump(P["terra"], s * 1.75, s * 1.35, s * 1.75, dx, 2.15, dz, seed=40 + k, rnd=0.55, jitter=0.16, ry=rng.uniform(0, 3))
        b.lump(P["terra_dk"], s * 0.9, s * 0.7, s * 0.9, dx + s * 0.7, 2.2, dz + s * 0.5, seed=50 + k, rnd=0.6, jitter=0.12)
    # pebbles hanging in the air round the door
    for k in range(10):
        side = -1 if k % 2 else 1
        x = rng.uniform(-4.5, 8.5)
        y = rng.uniform(6.0, 13.5)
        z = -5 + side * rng.uniform(1.6, 3.4)
        s = rng.uniform(0.35, 0.8)
        b.lump(P["terra_lt"] if k % 3 else P["terra"], s, s * 0.8, s, x, y, z, seed=60 + k, rnd=0.6, jitter=0.12, ry=rng.uniform(0, 3), flat_base=False)
    # rubble round the plateau's foot, clear of the stairs
    for k in range(16):
        a = 2 * math.pi * k / 16 + rng.uniform(-0.1, 0.1)
        x, z = 14.2 * math.cos(a), 11.2 * math.sin(a)
        if (z > 9 and abs(x + 4) < 4) or (x < -12 and abs(z - 4) < 4):
            continue
        s = rng.uniform(0.8, 1.6)
        b.lump(P["sandrock_dk"], s * 1.3, s * 0.7, s, x, -0.1, z, seed=70 + k, rnd=0.6, ry=a)
    b.finish("tf-portal.glb")


# ------------------------------------------------------------ Skate Bowl

SK_DOORS = [("s", -12, 6), ("w", 4, 6), ("e", 0, 6), ("n", 16, 5)]


def build_skate(P):
    """A walled concrete skate park: steel coping on every edge, graffiti on
    the walls, painted funboxes, yellow rails, ledges, bleachers on the north
    rim, flood lights. Colliders: room 60 x 36 x 1.1, two funboxes with steps,
    rails, ledges, the three bleacher tiers."""
    b = Builder()
    rng = random.Random(9)
    paints = [P["paint_y"], P["paint_r"], P["paint_b"], P["paint_g"], P["paint_p"]]
    for (sx, sz, ww, dd, side) in room_segments(0, 0, 60, 36, SK_DOORS):
        horiz = side in ("n", "s")
        L = ww if horiz else dd
        b.box(P["conc"], ww, 1.1, dd, sx, 0, sz)
        for o in (-0.22, 0.22):
            if horiz:
                b.cyl(P["coping"], 0.07, (sx - L / 2, 1.1, sz + o), (sx + L / 2, 1.1, sz + o), seg=8)
            else:
                b.cyl(P["coping"], 0.07, (sx + o, 1.1, sz - L / 2), (sx + o, 1.1, sz + L / 2), seg=8)
        for out in (-1, 1):                                           # graffiti both faces
            pos = -L / 2 + 0.3
            while True:
                w = rng.uniform(1.0, 3.4)
                if pos + w > L / 2 - 0.3:
                    break
                if rng.random() < 0.7:
                    h = rng.uniform(0.35, 0.8)
                    y = rng.uniform(0.06, 1.02 - h)
                    m = rng.choice(paints)
                    if horiz:
                        b.box(m, w, h, 0.03, sx + pos + w / 2, y, sz + out * 0.26)
                    else:
                        b.box(m, 0.03, h, w, sx + out * 0.26, y, sz + pos + w / 2)
                pos += w + rng.uniform(0.2, 1.2)
    for (fx, fz, col) in ((-14, -4, "paint_b"), (12, 6, "paint_r")):
        b.box(P["conc"], 10, 1.65, 5, fx, 0, fz)
        b.box(P[col], 10.03, 0.55, 5.03, fx, 0.55, fz)
        for s in (-1, 1):
            b.bar(P["coping"], (fx - 5, 1.62, fz + s * 2.47), (fx + 5, 1.62, fz + s * 2.47), 0.1)
        stairs(b, P["conc_dk"], fx - 5, fz, -1, 0, 0, 1.65, 5)
        stairs(b, P["conc_dk"], fx + 5, fz, 1, 0, 0, 1.65, 5)
    for (rx, rz, L) in ((2, -8, 12), (-4, 10, 10)):
        b.cyl(P["paint_y"], 0.07, (rx - L / 2, 0.64, rz), (rx + L / 2, 0.64, rz), seg=10)
        for k in range(3):
            px = rx - L / 2 + 0.6 + k * (L - 1.2) / 2
            b.cyl(P["coping"], 0.05, (px, 0, rz), (px, 0.62, rz), seg=8)
            b.box(P["coping"], 0.3, 0.02, 0.3, px, 0, rz)
    for (x, z, w, d, col) in ((20, -8, 6, 3, "paint_p"), (-22, 9, 3, 7, "paint_g")):
        b.box(P["conc"], w, 1.0, d, x, 0, z, bevel=0.03)
        b.box(P[col], w + 0.03, 0.4, d + 0.03, x, 0.1, z)
        if w > d:
            for s in (-1, 1):
                b.bar(P["coping"], (x - w / 2, 0.98, z + s * (d / 2 - 0.03)), (x + w / 2, 0.98, z + s * (d / 2 - 0.03)), 0.08)
        else:
            for s in (-1, 1):
                b.bar(P["coping"], (x + s * (w / 2 - 0.03), 0.98, z - d / 2), (x + s * (w / 2 - 0.03), 0.98, z + d / 2), 0.08)
    for t in range(3):                                                # bleachers
        z = -19.5 - t * 1.4
        top = 0.66 * (t + 1)
        b.box(P["conc_dk"], 26, top, 1.4, -6, 0, z)
        b.box(P["bench"], 25.6, 0.07, 0.6, -6, top, z + 0.3)
    for k in range(9):
        x = -18.5 + k * 3.125
        b.cyl(P["coping"], 0.05, (x, 1.98, -23.0), (x, 2.95, -23.0), seg=8)
    b.cyl(P["coping"], 0.06, (-18.6, 2.95, -23.0), (6.6, 2.95, -23.0), seg=8)
    for (lx, lz, ry) in ((-31.8, -19.8, 0.8), (31.8, -19.8, -0.8), (31.8, 19.8, -2.35), (-31.8, 19.8, 2.35)):
        b.cyl(P["pole"], 0.13, (lx, 0, lz), (lx, 8.0, lz), seg=8, r2=0.09)
        b.box(P["pole"], 1.4, 0.25, 0.5, lx, 8.0, lz, ry=ry)
        b.box(P["lamp"], 1.2, 0.05, 0.4, lx, 7.97, lz, ry=ry)
    b.finish("tf-skate.glb")


# ------------------------------------------------------------ The Cave

def build_cave(P):
    """A teal rock mound (trollface.io's Cave) round the tunnel and its side
    chamber, sand spilling out of the mouths, crystals and lanterns inside,
    the warning sign. Colliders: the rock blocks (x -10.5..10.5, z -11..11,
    6 high), the tunnel x -2.5..2.5 and the chamber x 2.5..8, z -3..3, both
    3.2 high."""
    b = Builder()
    rng = random.Random(13)
    X, Z, H, MO, MH = 10.5, 11.0, 6.0, 2.5, 3.2
    cols = []                                               # (x, z, nx, nz, bottom)

    def side(ax, az, bx, bz, nx, nz, mouth):
        L = math.hypot(bx - ax, bz - az)
        n = max(2, round(L / 1.1))
        for i in range(n):
            t = i / n
            x, z = ax + (bx - ax) * t, az + (bz - az) * t
            if i == 0:
                cols.append((x, z, math.copysign(0.7071, x), math.copysign(0.7071, z), 0.0))
                continue
            if mouth and abs(x) < MO + 0.6:
                continue
            cols.append((x, z, nx, nz, 0.0))
        if mouth:
            # the mouth: sharp sides at x = +-2.5, the arch over it at 3.2
            xs = [MO, MO - 0.05, 1.2, 0.0, -1.2, -(MO - 0.05), -MO] if bx < ax else [-MO, -(MO - 0.05), -1.2, 0.0, 1.2, MO - 0.05, MO]
            insert = [(x, az, nx, nz, 0.0 if abs(x) >= MO else MH) for x in xs]
            # splice in sorted along the walk direction
            run = [c for c in cols if c[1] == az and abs(c[0]) < X - 0.01]
            for c in run:
                cols.remove(c)
            allc = run + insert
            allc.sort(key=lambda c: c[0], reverse=bx < ax)
            cols.extend(allc)

    side(-X, -Z, X, -Z, 0, -1, True)
    side(X, -Z, X, Z, 1, 0, False)
    side(X, Z, -X, Z, 0, 1, True)
    side(-X, Z, -X, -Z, -1, 0, False)
    R = 4
    pts, idx = [], []
    for (x, z, nx, nz, yb) in cols:
        col = []
        for k in range(R + 1):
            t = k / R
            y = yb + (H - yb) * t
            # a rounded, leaning side: out 1.3 at the foot, in to the edge at the top
            off = 1.3 * (1 - t) ** 0.7 if yb == 0 else 0.1 * (1 - t)
            if 0 < k < R:
                off += rng.uniform(-0.25, 0.25)
                y += rng.uniform(-0.2, 0.2)
            elif k == R:
                off = rng.uniform(-0.15, 0.05)
                y += rng.uniform(0.0, 0.25)
            col.append(len(pts))
            pts.append((x + nx * off, y, z + nz * off))
        idx.append(col)
    faces = []
    N = len(idx)
    for i in range(N):
        j = (i + 1) % N
        for k in range(R):
            faces.append([idx[i][k], idx[j][k], idx[j][k + 1], idx[i][k + 1]])
    faces.append([idx[i][R] for i in range(N)])
    b.poly(P["cave"], pts, faces)
    # the hill over it: a faceted heightfield peaking west of centre like the
    # art, a lower hump to the east; its edge tucks under the walls' top ring
    GX, GZ = 14, 15

    def hill(x, z):
        f1 = max(0.0, 1 - ((x + 2.5) / 10.5) ** 2 - ((z + 1.0) / 11.0) ** 2)
        f2 = max(0.0, 1 - ((x - 5.0) / 6.0) ** 2 - ((z - 4.5) / 6.5) ** 2)
        return H + 6.2 * f1 ** 1.1 + 2.6 * f2

    hp, hf = [], []
    for i in range(GX + 1):
        for j in range(GZ + 1):
            x, z = -X + 0.15 + (2 * X - 0.3) * i / GX, -Z + 0.15 + (2 * Z - 0.3) * j / GZ
            edge = i in (0, GX) or j in (0, GZ)
            hp.append((x, H - 0.05 if edge else hill(x, z) + rng.uniform(-0.3, 0.3), z))
    for i in range(GX):
        for j in range(GZ):
            a = i * (GZ + 1) + j
            hf.append([a, a + 1, a + GZ + 2, a + GZ + 1])
    top = b.poly(P["cave"], hp, hf)
    for f in top:
        f.normal_update()
    if sum(f.normal.y for f in top) < 0:
        bmesh.ops.reverse_faces(b.bm, faces=top)
    for f in top:
        if rng.random() < 0.3:
            b._tag([f], P["cave_dk"])
    for k in range(5):                                                     # a few boulders up there
        x, z = rng.uniform(-8, 8), rng.uniform(-8, 8)
        s = rng.uniform(0.9, 1.6)
        b.lump(P["cave_dk"], s * 1.3, s * 0.8, s, x, hill(x, z) - 0.4, z, seed=90 + k, rnd=0.6)
    for k in range(14):                                                    # boulders at the foot
        a = 2 * math.pi * k / 14 + rng.uniform(-0.12, 0.12)
        x, z = (X + 1.4) * math.cos(a), (Z + 1.4) * math.sin(a)
        if abs(x) < 4.2 and abs(z) > 8:
            continue
        s = rng.uniform(0.7, 1.5)
        b.lump(P["cave_dk"], s * 1.3, s * 0.8, s, x, -0.1, z, seed=100 + k, rnd=0.6, ry=a)
    # inside: dark lining, sand floor, crystals, lanterns
    for (bx, bz, bw, bd, bh, by) in ((-2.44, 0, 0.12, 22.0, MH, 0), (2.44, -7, 0.12, 8.0, MH, 0), (2.44, 7, 0.12, 8.0, MH, 0),
                                     (7.94, 0, 0.12, 6.0, MH, 0), (5.25, -2.94, 5.5, 0.12, MH, 0), (5.25, 2.94, 5.5, 0.12, MH, 0),
                                     (0, 0, 5.0, 22.0, 0.12, MH - 0.12), (5.25, 0, 5.5, 6.0, 0.12, MH - 0.12)):
        b.box(P["cave_in"], bw, bh, bd, bx, by, bz)
    for k in range(10):                                                    # rocky lumps along the tunnel walls
        z = -9.5 + k * 2.1
        s = rng.uniform(0.35, 0.6)
        b.lump(P["cave_in"], s, s * 0.8, s, -2.2, 0, z, seed=120 + k, rnd=0.6)
    b.box(P["sand"], 4.9, 0.02, 22.0, 0, 0, 0)
    b.box(P["sand"], 5.4, 0.02, 5.9, 5.25, 0, 0)
    for s in (-1, 1):
        plate(b, P["sand"], [(-2.5, s * 11.0), (2.5, s * 11.0), (4.6, s * 14.6), (0.5, s * 15.6), (-3.8, s * 14.8)], 0.0, 0.025)
    for k, (x, z, lean) in enumerate(((7.4, -2.3, 0.3), (7.5, 2.2, -0.3), (7.6, 0.4, 0.1), (6.2, -2.5, 0.4), (5.6, 2.5, -0.4), (-2.1, -4.5, 0.2), (-2.1, 5.2, -0.2))):
        h = rng.uniform(0.7, 1.3)
        b.cyl(P["crystal"], 0.22, (x, 0, z), (x - math.copysign(0.25, x) * 0.5, h, z + lean), seg=5, r2=0.02)
        b.cyl(P["crystal"], 0.14, (x, 0, z + 0.3), (x - math.copysign(0.2, x) * 0.5, h * 0.6, z + 0.3 + lean), seg=5, r2=0.02)
    for z in (-6.5, 0.0, 6.5):
        b.box(P["pole"], 0.4, 0.06, 0.08, 2.2, 2.55, z)
        b.box(P["lantern"], 0.22, 0.32, 0.22, 2.02, 2.25, z)
    # the warning sign (trollface-island.js: post at (3.6, 12.5), board facing +z)
    b.box(P["pole"], 0.12, 2.3, 0.12, 3.6, 0, 12.5)
    b.prism(P["ink"], [(3.6 - 0.9, 1.95), (3.6 + 0.9, 1.95), (3.6, 3.5)], 12.56, 12.6)
    b.prism(P["hazard"], [(3.6 - 0.72, 2.05), (3.6 + 0.72, 2.05), (3.6, 3.3)], 12.6, 12.63)
    b.box(P["ink"], 0.13, 0.55, 0.02, 3.6, 2.55, 12.635)
    b.box(P["ink"], 0.13, 0.13, 0.02, 3.6, 2.25, 12.635)
    b.finish("tf-cave.glb")


# ------------------------------------------------------------ The Dock

# trollface-island.js: x0 = P(27) -104.4, z0 = P(36) -39.8, z1 = P(42) -18.1,
# x1 = P(33) -77.2. The model's origin is (x0, z0).
DOCK_L, DOCK_A = 21.7, 27.2


def build_dock(P):
    """A plank jetty out into the lake and its east arm: boards over three
    stringers on piles, mooring posts with rope, the crate, a lamp and a
    ladder at the end (trollface.io's Dock). Colliders: the shore step, the
    jetty, the arm, the crate."""
    b = Builder()
    rng = random.Random(17)
    L, A = DOCK_L, DOCK_A
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
    for t in range(5):                                                     # mooring posts (no colliders)
        zz = 3 + t * 4.5
        b.cyl(P["pile"], 0.2, (2.0, -0.2, zz), (2.0, 1.55, zz), seg=8)
        b.cyl(P["plank_dk"], 0.23, (2.0, 1.55, zz), (2.0, 1.62, zz), seg=8)
        b.cyl(P["rope"], 0.24, (2.0, 1.05, zz), (2.0, 1.2, zz), seg=10)
    cx, cz = A - 2, L                                                      # the crate (collider 1.4 cube)
    b.box(P["crate"], 1.38, 1.38, 1.38, cx, 0.66, cz)
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box(P["plank_dk"], 0.13, 1.42, 0.13, cx + sx * 0.65, 0.65, cz + sz * 0.65)
    for y in (0.66, 1.98):
        for (w, d, ox, oz) in ((1.42, 0.12, 0, -0.65), (1.42, 0.12, 0, 0.65), (0.12, 1.42, -0.65, 0), (0.12, 1.42, 0.65, 0)):
            b.box(P["plank_dk"], w, 0.12, d, cx + ox, y, cz + oz)
    for s in (-1, 1):
        b.bar(P["plank_dk"], (cx - 0.62, 0.72, cz + s * 0.7), (cx + 0.62, 1.98, cz + s * 0.7), 0.12, 0.04)
    torus(b, P["rope"], (cx - 1.6, 0.7, cz + 1.0), 0.32, 0.07, (1, 0, 0), (0, 0, 1), seg=16, tseg=6)
    torus(b, P["rope"], (cx - 1.6, 0.8, cz + 1.0), 0.26, 0.07, (1, 0, 0), (0, 0, 1), seg=16, tseg=6)
    ex = A + 1.6                                                           # the lamp and ladder at the end
    b.box(P["plank_dk"], 0.18, 2.6, 0.18, ex, 0.66, L - 1.6)
    b.box(P["plank_dk"], 0.6, 0.1, 0.12, ex - 0.2, 3.2, L - 1.6)
    b.box(P["lantern"], 0.26, 0.36, 0.26, ex - 0.42, 2.82, L - 1.6)
    for s in (-1, 1):
        b.bar(P["coping"], (ex + 0.25, -0.2, L + s * 0.35), (ex + 0.25, 1.4, L + s * 0.35), 0.06)
    for y in (0.1, 0.4):
        b.bar(P["coping"], (ex + 0.25, y, L - 0.35), (ex + 0.25, y, L + 0.35), 0.05)
    b.finish("tf-dock.glb")


# ------------------------------------------------------------ The Old Tree

def build_tree(P):
    """The bonsai-ish old tree with a tyre swing off its long branch
    (trollface.io's dock tree). Collider: the trunk (r 0.8, 5 high)."""
    b = Builder()

    def limb(pts, r0, r1):
        n = len(pts) - 1
        for i in range(n):
            ra, rb = r0 + (r1 - r0) * i / n, r0 + (r1 - r0) * (i + 1) / n
            b.cyl(P["bark"], ra, pts[i], pts[i + 1], seg=9, r2=rb)
            if i < n - 1:
                sphere(b, P["bark"], pts[i + 1], rb * 1.03, seg=9, ring=5)

    limb([(0, -0.2, 0), (0.15, 1.6, 0.1), (-0.25, 3.0, -0.05), (0.2, 4.3, 0.1), (0.6, 5.4, 0.0)], 0.88, 0.45)
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.3
        b.cyl(P["bark"], 0.38, (0, 0.7, 0), (1.7 * math.cos(a), -0.1, 1.7 * math.sin(a)), seg=7, r2=0.1)
    limb([(-0.2, 3.3, 0.0), (-2.2, 4.2, 0.3), (-4.4, 4.55, 0.4), (-6.6, 4.4, 0.5)], 0.42, 0.13)
    limb([(-4.4, 4.55, 0.4), (-5.0, 5.5, 0.2)], 0.13, 0.06)
    limb([(0.3, 4.4, 0.0), (2.4, 5.5, -0.4), (4.3, 5.9, -0.7)], 0.36, 0.13)
    limb([(0.6, 5.4, 0.0), (0.4, 6.8, 0.4)], 0.32, 0.14)
    limb([(0.6, 5.4, 0.0), (1.9, 6.8, -0.2)], 0.28, 0.12)
    for k, (x, y, z, w, h, d) in enumerate(((1.0, 6.6, 0.1, 5.4, 2.6, 4.6), (4.0, 5.9, -0.7, 3.8, 2.2, 3.2), (-1.5, 6.5, 0.5, 3.8, 2.3, 3.4),
                                            (-5.2, 5.3, 0.5, 2.8, 1.6, 2.4), (0.6, 8.0, 0.0, 3.2, 1.9, 3.0))):
        b.lump(P["leaf_b"], w * 0.95, h * 0.6, d * 0.95, x, y - h * 0.4, z, seed=140 + k, rnd=0.65, jitter=0.12)
        b.lump(P["leaf_a"], w, h, d, x, y - h * 0.25, z, seed=150 + k, rnd=0.6, jitter=0.14)
        b.lump(P["leaf_lt"], w * 0.5, h * 0.45, d * 0.5, x - w * 0.12, y + h * 0.5, z - d * 0.1, seed=160 + k, rnd=0.65, jitter=0.1)
    b.cyl(P["rope"], 0.03, (-5.9, 4.45, 0.5), (-5.9, 1.85, 0.5), seg=6)
    torus(b, P["tyre"], (-5.9, 1.42, 0.5), 0.42, 0.16, (1, 0, 0), (0, 1, 0), seg=20, tseg=8)
    b.finish("tf-tree.glb")


# ------------------------------------------------------------ The Boat

def build_boat(P):
    """The sailboat (trollface.io's Boat): grey hull with a navy boot stripe,
    teak deck, white cabin, mast, boom, two sails with the blue mark, rigging
    and lifelines. Colliders: hull 17 x 5.6 x 1.32, the bow, the stern steps,
    the cabin 5 x 3.6 x 1.9, the mast."""
    b = Builder()
    rng = random.Random(23)
    plan = [(-8.5, -2.6), (-6.0, -2.8), (5.5, -2.8), (8.5, -2.5), (10.6, -1.7), (12.1, -0.85), (12.9, 0.0),
            (12.1, 0.85), (10.6, 1.7), (8.5, 2.5), (5.5, 2.8), (-6.0, 2.8), (-8.5, 2.6)]
    rings = [(1.32, 1.0, 1.0), (0.62, 0.99, 0.97), (0.40, 0.975, 0.93), (0.0, 0.9, 0.7)]
    bands = ["hull", "stripe", "hull_lo"]
    CX = 2.2
    n = len(plan)
    pts = []
    for (y, fx, fz) in rings:
        for (x, z) in plan:
            pts.append((CX + (x - CX) * fx, y, z * fz))
    faces, mats = [], []
    for k in range(len(rings) - 1):
        for i in range(n):
            j = (i + 1) % n
            faces.append([k * n + i, k * n + j, (k + 1) * n + j, (k + 1) * n + i])
            mats.append(bands[k])
    faces.append(list(range(n)))
    mats.append("deck")
    faces.append([3 * n + i for i in range(n)][::-1])
    mats.append("hull_lo")
    out = b.poly(P["hull"], pts, faces)
    if len(out) == len(mats):
        for f, m in zip(out, mats):
            b._tag([f], P[m])
    for i in range(n - 1):                                                 # rub rail (open across the transom)
        (x0, z0), (x1, z1) = plan[i], plan[i + 1]
        b.bar(P["stripe"], (x0, 1.3, z0 * 1.01), (x1, 1.3, z1 * 1.01), 0.1, 0.12)
    for k in range(1, 9):                                                  # deck seams
        z = -2.5 + k * 5.0 / 9
        b.box(P["plank_dk"], 14.0, 0.01, 0.04, 1.0, 1.32, z)
    stairs(b, P["deck"], -8.5, 0, -1, 0, 0, 1.32, 2.4)
    # the cabin (collider 5 x 3.6 x 1.9 at (3, 0) on the deck)
    b.box(P["white"], 5.0, 1.9, 3.6, 3, 1.32, 0, bevel=0.22)
    b.box(P["white"], 5.2, 0.12, 3.8, 3, 3.18, 0, bevel=0.05)
    for s in (-1, 1):
        b.box(P["cabin_win"], 3.4, 0.42, 0.05, 3, 2.4, s * 1.8)
    b.box(P["cabin_win"], 0.05, 0.45, 2.6, 5.5, 2.4, 0)
    b.box(P["deck"], 1.3, 0.12, 1.3, 2.2, 3.28, 0)
    # mast (collider r 0.25 x 18 at (-1, 0)), spreaders, masthead light, boom
    b.cyl(P["mast"], 0.2, (-1, 1.32, 0), (-1, 19.3, 0), seg=10, r2=0.13)
    b.bar(P["mast"], (-1, 12.0, -1.7), (-1, 12.0, 1.7), 0.1)
    sphere(b, P["masthead"], (-1, 19.45, 0), 0.16)
    b.cyl(P["mast"], 0.12, (-1, 3.05, 0), (-9.9, 3.15, 0), seg=8)
    # sails: main aft of the mast with the blue mark, jib forward
    def leech(p, q, bulge, steps=6):
        out = []
        for i in range(1, steps):
            t = i / steps
            x, y = p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t
            nx, ny = (q[1] - p[1]), -(q[0] - p[0])
            L = math.hypot(nx, ny)
            s = bulge * math.sin(math.pi * t)
            out.append((x + nx / L * s, y + ny / L * s))
        return out
    main = [(-1.25, 3.25), (-1.25, 19.1)] + leech((-1.25, 19.1), (-9.8, 3.3), 0.5) + [(-9.8, 3.3)]
    b.prism(P["sail"], main, -0.03, 0.03, axis="z")
    jib = [(-0.75, 3.7), (8.8, 3.8)] + leech((8.8, 3.8), (-0.75, 18.3), 0.45) + [(-0.75, 18.3)]
    b.prism(P["sail"], jib, -0.03, 0.03, axis="z")
    for y in (7.0, 11.0, 15.0):                                            # battens on the main
        xl = -1.25 - 8.55 * (19.1 - y) / 15.8
        b.bar(P["sail_line"], (-1.3, y, 0), (xl + 0.15, y - 0.05, 0), 0.09, 0.05)
    blob = []
    for i in range(12):                                                    # the blue mark (as the art)
        a = 2 * math.pi * i / 12
        r = 1.4 * (1 + 0.14 * math.sin(3 * a + 0.7) + rng.uniform(-0.05, 0.05))
        blob.append((-4.6 + r * 1.1 * math.cos(a), 7.4 + r * 0.85 * math.sin(a)))
    b.prism(P["logo"], blob, -0.045, 0.045, axis="z")
    # rigging: forestay, backstay, shrouds via the spreaders
    b.bar(P["ink"], (-1, 19.2, 0), (12.6, 1.4, 0), 0.035)
    b.bar(P["ink"], (-1, 19.2, 0), (-8.4, 1.35, 0), 0.035)
    for s in (-1, 1):
        b.bar(P["ink"], (-1, 19.0, 0), (-1, 12.0, s * 1.7), 0.03)
        b.bar(P["ink"], (-1, 12.0, s * 1.7), (-1.2, 1.32, s * 2.65), 0.03)
    # lifelines round the deck (stern open for the steps)
    rail = [(-8.3, -2.4), (-6.0, -2.6), (-2.5, -2.6), (1.5, -2.6), (5.5, -2.6), (8.4, -2.3), (10.5, -1.5), (12.2, 0.0),
            (10.5, 1.5), (8.4, 2.3), (5.5, 2.6), (1.5, 2.6), (-2.5, 2.6), (-6.0, 2.6), (-8.3, 2.4)]
    for (x, z) in rail:
        b.cyl(P["mast"], 0.035, (x, 1.32, z), (x, 2.05, z), seg=6)
    for i in range(len(rail) - 1):
        (x0, z0), (x1, z1) = rail[i], rail[i + 1]
        for y in (1.68, 2.03):
            b.bar(P["mast"], (x0, y, z0), (x1, y, z1), 0.03)
    b.finish("tf-boat.glb")


# ------------------------------------------------------------ The Marketplace

# trollface-island.js: stall t at (-20 + 8t, 12 - 5t), counter 4.4 x 2 x 1.1,
# posts at +-2.2, +-1.6, the canopy 5.2 x 3.8 at 2.8.
STALLS = [(-20 + 8 * t, 12 - 5 * t) for t in range(6)]
CLOTH = [("cloth_y", "cloth_r"), ("cloth_b", "cloth_y"), ("cloth_r", "cloth_g"), ("cloth_c", "cloth_r"), ("cloth_g", "cloth_b"), ("cloth_y", "cloth_c")]


def catenary(b, P, a, c, sag, rng, bulbs=True):
    a, c = Vector(a), Vector(c)
    L = (c - a).length
    n = max(3, int(L / 0.55))
    prev = a
    for i in range(1, n + 1):
        t = i / n
        p = a.lerp(c, t) - Vector((0, sag * 4 * t * (1 - t), 0))
        b.bar(P["cable"], prev, p, 0.025)
        if bulbs and i < n:
            sphere(b, P["fairy"], p - Vector((0, 0.07, 0)), 0.075, seg=6, ring=4)
        prev = p


def build_market(P):
    """A run of wooden stalls under sagging bright cloth canopies, strung
    with fairy lights, goods on every counter, a banner pole at each end
    (trollface.io's Marketplace). Colliders: the six counters."""
    b = Builder()
    rng = random.Random(29)
    W, D, Y = 5.2, 3.8, 3.05
    for i, (sx, sz) in enumerate(STALLS):
        c1, c2 = CLOTH[i]
        b.box(P["stall"], 4.4, 1.0, 2.0, sx, 0, sz, bevel=0.03)
        b.box(P["stall_lt"], 4.6, 0.1, 2.2, sx, 1.0, sz, bevel=0.02)
        for y in (0.33, 0.66):
            b.box(P["stall_dk"], 4.42, 0.04, 2.02, sx, y, sz)
        b.box(P[c2], 4.0, 0.62, 0.03, sx, 0.25, sz + 1.02)
        for (dx, dz) in ((-2.2, -1.6), (2.2, -1.6), (-2.2, 1.6), (2.2, 1.6)):
            b.cyl(P["pole_w"], 0.07, (sx + dx, 0, sz + dz), (sx + dx, Y, sz + dz), seg=8)
        # the canopy: sags between the posts, scalloped valances front and back
        C, R = 10, 5
        grid = []
        for r in range(R + 1):
            v = r / R
            row = []
            for c in range(C + 1):
                u = c / C
                y = Y + 0.04 - 0.38 * math.sin(math.pi * u) - 0.08 * math.sin(math.pi * v)
                row.append((sx - W / 2 + W * u, y, sz - D / 2 + D * v))
            grid.append(row)
        sheet(b, P[c1], grid, 0.04)
        for zs in (-1, 1):
            top = [(sx - W / 2 + W * c / C, Y + 0.04 - 0.38 * math.sin(math.pi * c / C) - 0.02) for c in range(C + 1)]
            bot = []
            for c in range(C, -1, -1):
                x, y = top[c]
                bot.append((x, y - 0.3 - (0.12 if c % 2 else 0.0)))
            b.prism(P[c2], top + bot, sz + zs * D / 2 - 0.015, sz + zs * D / 2 + 0.015, axis="z")
        catenary(b, P, (sx - 2.2, Y - 0.25, sz - 1.6), (sx + 2.2, Y - 0.25, sz + 1.6), 0.3, rng)
        catenary(b, P, (sx - 2.2, Y - 0.25, sz + 1.6), (sx + 2.2, Y - 0.25, sz - 1.6), 0.3, rng)
        # goods on the counter (top at 1.1)
        x = sx - 2.0
        while x < sx + 1.7:
            k = rng.random()
            if k < 0.4:                                                   # a crate of fruit
                b.box(P["stall_dk"], 0.7, 0.22, 0.5, x + 0.35, 1.1, sz + rng.uniform(-0.4, 0.4))
                fruit = rng.choice([P["fruit_r"], P["fruit_o"], P["fruit_g"]])
                for fx in (-0.2, 0.0, 0.2):
                    for fz in (-0.12, 0.12):
                        sphere(b, fruit, (x + 0.35 + fx, 1.4, sz + fz), 0.1, seg=7, ring=5)
                x += 0.85
            elif k < 0.7:                                                 # a stack of shirts
                col = rng.choice([P["box_a"], P["box_b"], P["box_c"], P["box_d"], P["box_e"]])
                for j in range(rng.randint(2, 4)):
                    b.box(col, 0.6, 0.09, 0.45, x + 0.3, 1.1 + j * 0.1, sz + 0.2, ry=rng.uniform(-0.1, 0.1))
                x += 0.75
            else:                                                         # jars
                for j in range(3):
                    b.cyl(rng.choice([P["shop_glass"], P["box_c"], P["box_b"]]), 0.1, (x + 0.12 + j * 0.24, 1.1, sz - 0.4), (x + 0.12 + j * 0.24, 1.36, sz - 0.4), seg=8)
                x += 0.8
    # fairy lights between neighbouring stalls, front and back
    for i in range(len(STALLS) - 1):
        (ax, az), (cx, cz) = STALLS[i], STALLS[i + 1]
        for dz in (-1.6, 1.6):
            catenary(b, P, (ax + 2.2, Y, az + dz), (cx - 2.2, Y, cz + dz), 0.45, rng)
    # a banner pole at each end, strung to its stall
    for (px, pz, (sx, sz)) in ((-25.5, 15.5, STALLS[0]), (25.5, -16.5, STALLS[-1])):
        b.cyl(P["pole_w"], 0.1, (px, 0, pz), (px, 6.2, pz), seg=8)
        sphere(b, P["gold"], (px, 6.3, pz), 0.16)
        b.box(P["pole_w"], 0.05, 3.4, 1.2, px, 2.6, pz + 0.65, rz=0.06)
        corner = (sx - 2.2, Y, sz + 1.6) if px < 0 else (sx + 2.2, Y, sz - 1.6)
        catenary(b, P, (px, 5.6, pz), corner, 0.5, rng)
    b.finish("tf-market.glb")


# ------------------------------------------------------------ The Bridge

# trollface-island.js: xa = P(37.6) -56.3, xb = P(49.9) -0.5, deck at z of the
# bridge, 5 wide, top 0.66; the model's origin is the deck's middle.
BR_LEN = 55.8


def build_bridge(P):
    """A long plank footbridge over the river: boards on stringers, pile
    bents every 7 m, post-and-rail sides, lanterns at both ends and the
    middle. Colliders: the deck, its two end steps, both rails."""
    b = Builder()
    rng = random.Random(31)
    H = BR_LEN / 2
    for s in (-1, 1):
        b.box(P["plank_dk"], 1.0, 0.33, 5.0, s * (H + 0.5), 0, 0, bevel=0.03)
        b.box(P["stone"], 1.8, 0.7, 6.0, s * (H - 0.4), -0.45, 0, bevel=0.05)
    x = -H + 0.02
    while x < H - 0.2:
        b.box(P["plank"], 0.27, 0.08, 5.0 + rng.uniform(-0.06, 0.06), x + 0.14, 0.58, rng.uniform(-0.03, 0.03), ry=rng.uniform(-0.01, 0.01))
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
    n = 24
    for i in range(n + 1):                                                # posts (rail colliders 0.2 x 0.9)
        x = -H + BR_LEN * i / n
        for z in (-2.4, 2.4):
            post_h = 1.85 if i in (0, n // 2, n) else 0.95
            b.box(P["plank_dk"], 0.17, post_h, 0.17, x, 0.66, z, bevel=0.02)
            if post_h > 1:
                b.box(P["pole"], 0.5, 0.06, 0.08, x + (0.2 if i < n else -0.2), 2.4, z)
                b.box(P["lantern"], 0.22, 0.3, 0.22, x + (0.38 if i < n else -0.38), 2.08, z)
    for z in (-2.4, 2.4):
        b.box(P["plank"], BR_LEN, 0.1, 0.2, 0, 1.5, z)
        b.box(P["plank_dk"], BR_LEN, 0.08, 0.1, 0, 1.05, z)
    b.finish("tf-bridge.glb")


PHASE3 = ["city", "cityface", "peak", "gallery", "shop", "bus", "busface", "skybox"]
PHASE4 = ["memelab", "observatory", "portal", "skate", "cave", "dock", "tree", "boat", "market", "bridge"]


def main():
    # blender ... --python build_island.blender.py -- [name ...]  builds only those
    only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    want = only or PHASE3 + PHASE4
    bpy.ops.wm.read_factory_settings(use_empty=True)
    P = pal()
    P.update(pal4())
    R = rprops()
    builders = {
        "city": lambda: build_city(P), "cityface": lambda: build_city_face(P), "peak": lambda: build_peak(P),
        "gallery": lambda: build_gallery(P), "shop": lambda: build_shop(P),
        "bus": lambda: build_bus(R), "busface": lambda: build_bus_face(R), "skybox": lambda: build_skybox(R),
        "memelab": lambda: build_memelab(P), "observatory": lambda: build_observatory(P), "portal": lambda: build_portal(P),
        "skate": lambda: build_skate(P), "cave": lambda: build_cave(P), "dock": lambda: build_dock(P),
        "tree": lambda: build_tree(P), "boat": lambda: build_boat(P), "market": lambda: build_market(P),
        "bridge": lambda: build_bridge(P),
    }
    for k in want:
        builders[k]()
    quantize_glb.main([os.path.join(HERE, f"tf-{k}.glb") for k in want])
    print("ALL ISLAND LANDMARKS EXPORTED")


if __name__ == "__main__":
    main()
