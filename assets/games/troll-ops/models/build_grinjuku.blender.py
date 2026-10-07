"""
Troll Forces - Grinjuku (Shinjuku at night, after VALORANT's Split), headless Blender.

Run with:
  node tools/troll-ops-grinjuku-layout.mjs          # layout -> grinjuku-layout.json
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python build_grinjuku.blender.py
  ONLY=shell,props ... builds just those models.
Every model written is then shrunk by quantize_glb.py.

Writes gj-*.glb into this folder, in MAP coordinates (placed at 0,0). Every
collider in grinjuku-layout.js has a `kind`; this script draws a model to
fit each one, so the art can't drift from the colliders. Building faces are
found, not listed: every side of a solid that borders open floor gets a
facade (shops at street level, tunnel lining under the Sewers' and Vents'
ceilings, the post office's insides under its roof).

Rules the art keeps (the colliders are the truth):
- Below 2.4 m nothing sticks out of a solid more than 6 cm (you'd walk
  through it); signs, awnings, lanterns and wires go higher.
- Nothing stands on open floor that isn't a solid in the layout.

Models:
  gj-shell    facades, tunnels, the post office, the Heavens, stairs, ground paint
  gj-props    everything you take cover behind, the ropes and their gantries
  gj-neon     everything that glows (signs, lit windows, lanterns, screens): no shadows
  gj-skyline  the city past the map edge, the viaducts and the trains: no shadows
"""
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, "grinjuku-layout.json")))
GJ = D["GJ"]
SOLIDS = D["solids"]
STAIRS = D["stairs"]
ROPES = D["ropes"]
B = GJ["bounds"]
HV = GJ["heaven"]
SHAFT = GJ["shaft"]
ONLY = set(filter(None, os.environ.get("ONLY", "").split(",")))

GROUND_FLOOR = 3.4      # shopfront band
STOREY = 3.1
SHOP_RECESS = 0.1       # shop glass and shutters sit this far into the wall


def kinds(*ks):
    return [s for s in SOLIDS if s["k"] in ks]


# ------------------------------------------------------------- materials

NEON = {
    "pink": 0xff3fb4, "cyan": 0x3ae8ff, "amber": 0xffb02a, "red": 0xff3a2a,
    "green": 0x4aff7a, "violet": 0xb06aff, "white": 0xf4f2ff, "yellow": 0xffe83a,
}


def gj_palette():
    P = palette()
    P.update({
        # textured (names map-models.js RETEXTURE already knows; colours are ours)
        "conc": mat("GS_Concrete", 0x9a9890, 0.92),
        "slab": mat("GS_Slab", 0x75736e, 0.92),
        "tilewall": mat("GS_Tile", 0xe2e0da, 0.45),
        "pavers": mat("GS_Pavement", 0xa8a49c, 0.85),
        "plaza": mat("GS_FloorConc", 0x8e8c88, 0.75),
        "brick": mat("GS_Brick", 0x8a5442, 0.9),
        "stuccoA": mat("GS_StuccoA", 0xd8ccb4, 0.85),
        "stuccoB": mat("GS_StuccoB", 0xb4b6b4, 0.85),
        "stuccoC": mat("GS_StuccoC", 0x9eb0a0, 0.85),
        "stuccoD": mat("GS_StuccoD", 0xd6b4a4, 0.85),
        "stuccoE": mat("GS_StuccoE", 0x6c6c74, 0.85),
        "plaster": mat("GS_PlasterLight", 0xeae6dc, 0.9),
        "wood": mat("GS_Timber", 0x8a6440, 0.8),
        "planks": mat("GS_Plank", 0x7a5838, 0.85),
        # flat paint
        "frame": mat("GJ_Frame", 0x34363a, 0.55, 0.15),
        "frame_lt": mat("GJ_FrameLight", 0x8a8e94, 0.5, 0.15),
        "shutter": mat("GJ_Shutter", 0x9a9ea4, 0.5, 0.15),
        "shutter_dk": mat("GJ_ShutterDark", 0x5c6066, 0.55, 0.15),
        "glass": mat("GJ_Glass", 0x1c232c, 0.12),
        "sill": mat("GJ_Sill", 0xb8b6b0, 0.7),
        "ac": mat("GJ_AC", 0xd6d6d0, 0.6),
        "ac_dk": mat("GJ_ACGrille", 0x2a2c30, 0.6),
        "pipe": mat("GJ_Pipe", 0x7a7e84, 0.5, 0.2),
        "pipe_rust": mat("GJ_PipeRust", 0x6a4a34, 0.8, 0.1),
        "cable": mat("GJ_Cable", 0x141416, 0.7),
        "noren_navy": mat("GJ_NorenNavy", 0x1c2a4a, 0.95),
        "noren_red": mat("GJ_NorenRed", 0x8a1e1e, 0.95),
        "noren_white": mat("GJ_NorenWhite", 0xe8e2d4, 0.95),
        "awning_red": mat("GJ_AwningRed", 0xb0282a, 0.85),
        "awning_white": mat("GJ_AwningWhite", 0xe8e6e0, 0.85),
        "awning_blue": mat("GJ_AwningBlue", 0x2a4e8a, 0.85),
        "awning_green": mat("GJ_AwningGreen", 0x2a6a4a, 0.85),
        "sign_back": mat("GJ_SignBack", 0x18181c, 0.6),
        "hazard_y": mat("GJ_HazardYellow", 0xe8b81e, 0.6),
        "hazard_k": mat("GJ_HazardBlack", 0x1a1a1a, 0.6),
        "line": mat("GJ_RoadLine", 0xe8e6de, 0.6),
        "line_y": mat("GJ_RoadLineYellow", 0xe0b030, 0.6),
        "water": mat("GJ_SewerWater", 0x1e2a26, 0.05),
        "grate": mat("GJ_Grate", 0x3a3c40, 0.6, 0.25),
        "vermilion": mat("GJ_Vermilion", 0xd8402a, 0.6),
        "black": mat("GJ_Black", 0x16161a, 0.6),
        "steel": mat("GJ_Steel", 0xa8acb2, 0.4, 0.25),
        "steel_dk": mat("GJ_SteelDark", 0x4a4e54, 0.5, 0.25),
        "rope": mat("GJ_Rope", 0x8a7454, 0.95),
        "rope_knot": mat("GJ_RopeKnot", 0x6a5638, 0.95),
        "white": mat("GJ_White", 0xf2f0ea, 0.5),
        "red": mat("GJ_Red", 0xc02428, 0.5),
        "blue": mat("GJ_Blue", 0x2a5aa8, 0.5),
        "yellow": mat("GJ_Yellow", 0xf0c020, 0.5),
        "green": mat("GJ_Green", 0x2a8a5a, 0.5),
        "orange": mat("GJ_Orange", 0xe86a1e, 0.5),
        "tyre": mat("GJ_Tyre", 0x141414, 0.9),
        "seat": mat("GJ_Seat", 0x2a2a2e, 0.7),
        "cardboard": mat("GJ_Cardboard", 0xb08a5a, 0.9),
        "crate_y": mat("GJ_CrateYellow", 0xe8b020, 0.6),
        "crate_r": mat("GJ_CrateRed", 0xc03028, 0.6),
        "crate_b": mat("GJ_CrateBlue", 0x2a5a9a, 0.6),
        "leaf": mat("GS_Leaf", 0x3e6a30, 0.85),
        "leaf_dk": mat("GS_LeafDark", 0x2e5226, 0.85),
        "sakura": mat("GJ_Sakura", 0xf0a8c0, 0.85),
        "sakura_dk": mat("GJ_SakuraDark", 0xd88aa6, 0.85),
        "bark": mat("GS_Bark", 0x4a3a2c, 0.9),
        "soil": mat("GJ_Soil", 0x2e241c, 0.95),
        "mailred": mat("GJ_PostRed", 0xc8282a, 0.5),
        "tank": mat("GJ_Tank", 0xb8bcc0, 0.4, 0.25),
        "truck": mat("GJ_TruckWhite", 0xeceae4, 0.35, 0.15),
        "bumper": mat("GJ_Bumper", 0x1e1e20, 0.8),
        # glowing (kept as their own materials; they bloom)
        # (strengths checked on renders: bloom starts at 0.8 linear, so a
        # window stays a window and only signs and lanterns flare)
        "lit": mat("GJ_WindowLit", 0xffd9a0, 0.4, 0.0, 0xffcf88, 0.42),
        "lit_cool": mat("GJ_WindowCool", 0xd8e8ff, 0.4, 0.0, 0xc8dcff, 0.36),
        "lit_shop": mat("GJ_ShopLit", 0xfff2d8, 0.4, 0.0, 0xffeccc, 0.7),
        "glow_warm": mat("GJ_GlowWarm", 0xffc890, 0.3, 0.0, 0xffb070, 0.3),
        "glow_cool": mat("GJ_GlowCool", 0xe8f0ff, 0.3, 0.0, 0xd0e0ff, 0.24),
        "lightbox": mat("GJ_Lightbox", 0xf4f0e6, 0.4, 0.0, 0xfff4e0, 0.7),
        "lightbox_r": mat("GJ_LightboxRed", 0xe8302a, 0.4, 0.0, 0xff3a2a, 0.9),
        "lightbox_y": mat("GJ_LightboxYellow", 0xf2c200, 0.4, 0.0, 0xffcc10, 0.7),
        "lightbox_b": mat("GJ_LightboxBlue", 0x2a6ae8, 0.4, 0.0, 0x3a7aff, 0.9),
        "lantern": mat("GJ_Lantern", 0xff4a2a, 0.5, 0.0, 0xff5a2a, 1.3),
        "lantern_w": mat("GJ_LanternWhite", 0xfff0d0, 0.5, 0.0, 0xffe8c0, 0.8),
        "vend": mat("GJ_VendingLit", 0xeaf4ff, 0.3, 0.0, 0xe0f0ff, 0.8),
        "lamp": mat("GJ_Lamp", 0xfff3d0, 0.2, 0.0, 0xfff1d4, 2.0),
        "strip": mat("GJ_StripLight", 0xeef6ff, 0.2, 0.0, 0xe8f4ff, 1.3),
        "redlamp": mat("GJ_RedLamp", 0xff3020, 0.3, 0.0, 0xff2a1a, 2.5),
        "screen": mat("GJ_Screen", 0x7ad8ff, 0.3, 0.0, 0x6ad0ff, 0.9),
        "screen_p": mat("GJ_ScreenPink", 0xff7ad0, 0.3, 0.0, 0xff5ac0, 0.9),
    })
    for k, c in NEON.items():
        P["neon_" + k] = mat("GJ_Neon" + k.capitalize(), c, 0.3, 0.0, c, 3.0)
    return P


NEON_KEYS = ["neon_" + k for k in NEON]


# ------------------------------------------------------------- frames

class Frame:
    """A solid's own frame: local x across its face, local z out of its
    front (f = 0 faces +z), y up from its bottom. w/d are LOCAL sizes."""

    def __init__(self, s):
        self.x, self.z, self.y = s["x"], s["z"], s.get("y", 0)
        self.f = s.get("f", 0) or 0
        q = abs(math.sin(self.f)) > 0.7
        self.w = s["d"] if q else s["w"]
        self.d = s["w"] if q else s["d"]
        self.h = s["h"]
        self.c, self.s = math.cos(self.f), math.sin(self.f)

    def p(self, lx, ly, lz):
        return (self.x + lx * self.c + lz * self.s, self.y + ly, self.z - lx * self.s + lz * self.c)

    def box(self, b, m, w, h, d, lx, ly, lz, rx=0.0, rz=0.0, ry=0.0, bevel=0.0):
        X, Y, Z = self.p(lx, ly, lz)
        b.box(m, w, h, d, X, Y, Z, ry=self.f + ry, rx=rx, rz=rz, bevel=bevel)

    def cyl(self, b, m, r, a, c, seg=10, r2=None, caps=True):
        b.cyl(m, r, self.p(*a), self.p(*c), seg=seg, r2=r2, caps=caps)

    def bar(self, b, m, a, c, w, h=None):
        b.bar(m, self.p(*a), self.p(*c), w, h)


def quad(b, m, axis, sign, at, a0, a1, y0, y1):
    """One-sided quad in the plane `axis` = at (axis "z": spans x a0..a1;
    "x": spans z a0..a1), facing `sign` along that axis."""
    if axis == "z":
        pts = [(a0, y0, at), (a1, y0, at), (a1, y1, at), (a0, y1, at)]
    else:
        pts = [(at, y0, a1), (at, y0, a0), (at, y1, a0), (at, y1, a1)]
    if sign < 0:
        pts.reverse()
    face = b.bm.faces.new([b.bm.verts.new(p) for p in pts])
    b._tag([face], m)


class Face:
    """A run of a building face: t along it (from its start), o out of it
    (into the street), y up. Boxes stay axis-aligned."""

    def __init__(self, ax, at, t0, nsign):
        self.ax = ax          # "x": the face runs along x (its normal is +-z)
        self.at = at          # the face's coordinate on the other axis
        self.t0 = t0          # world coordinate of t = 0 along the run
        self.n = nsign        # +1 / -1: which way is out

    def world(self, t, o):
        if self.ax == "x":
            return self.t0 + t, self.at + self.n * o
        return self.at + self.n * o, self.t0 + t

    def box(self, b, m, t0, t1, y, h, o0, o1):
        if t1 < t0:
            t0, t1 = t1, t0
        if o1 < o0:
            o0, o1 = o1, o0
        x, z = self.world((t0 + t1) / 2, (o0 + o1) / 2)
        L, T = t1 - t0, o1 - o0
        if L < 1e-4 or T < 1e-4 or h < 1e-4:
            return
        if self.ax == "x":
            b.box(m, L, h, T, x, y, z)
        else:
            b.box(m, T, h, L, x, y, z)

    def quad(self, b, m, t0, t1, y, h, o):
        """A flat panel facing out of the face, `o` out from it: windows,
        glyph strokes. One quad instead of a box's 24 corners."""
        quad(b, m, "z" if self.ax == "x" else "x", self.n, self.at + self.n * o,
             self.t0 + min(t0, t1), self.t0 + max(t0, t1), y, y + h)

    def cyl_out(self, b, m, r, t, y, o0, o1, seg=10):
        b.cyl(m, r, (*self._xyz(t, y, o0),), (*self._xyz(t, y, o1),), seg=seg)

    def cyl_up(self, b, m, r, t, o, y0, y1, seg=10, r2=None):
        x, z = self.world(t, o)
        b.cyl(m, r, (x, y0, z), (x, y1, z), seg=seg, r2=r2)

    def cyl_along(self, b, m, r, t0, t1, y, o, seg=8):
        b.cyl(m, r, self._xyz(t0, y, o), self._xyz(t1, y, o), seg=seg)

    def _xyz(self, t, y, o):
        x, z = self.world(t, o)
        return (x, y, z)


# ------------------------------------------------------------- glyphs

def glyph_strokes(rng):
    """An abstract kanji: 3-5 strokes in a unit cell, (u0, u1, v0, v1)."""
    th = 0.13
    out = []
    pool = []
    for v in (0.1, 0.5, 0.9):
        pool.append(("h", v, 0.08, 0.92))
        pool.append(("h", v, 0.08, 0.5))
        pool.append(("h", v, 0.5, 0.92))
    for u in (0.15, 0.5, 0.85):
        pool.append(("v", u, 0.05, 0.95))
        pool.append(("v", u, 0.05, 0.55))
        pool.append(("v", u, 0.45, 0.95))
    n = rng.randint(3, 5)
    if rng.random() < 0.25:     # a box (kuchi) plus a stroke or two
        pool_pick = [("h", 0.12, 0.15, 0.85), ("h", 0.88, 0.15, 0.85), ("v", 0.15, 0.12, 0.88), ("v", 0.85, 0.12, 0.88)]
        pool_pick += rng.sample(pool, 1)
    else:
        pool_pick = rng.sample(pool, n)
    for kind, a, s0, s1 in pool_pick:
        if kind == "h":
            out.append((s0, s1, a - th / 2, a + th / 2))
        else:
            out.append((a - th / 2, a + th / 2, s0, s1))
    return out


def glyph_column(rng, n):
    return [glyph_strokes(rng) for _ in range(n)]


# ------------------------------------------------------------- exposure

def solid_at(x, y, z, skip=None):
    for s in SOLIDS:
        if s is skip:
            continue
        if s["y"] - 1e-3 <= y <= s["y"] + s["h"] + 1e-3 \
                and abs(x - s["x"]) < s["w"] / 2 + 1e-3 and abs(z - s["z"]) < s["d"] / 2 + 1e-3:
            return s
    return None


CEILINGS = ("sewer", "vent", "_mailroof")


def ceiling_over(x, z, y):
    for s in SOLIDS:
        if s["k"] in CEILINGS and s["y"] > y and abs(x - s["x"]) < s["w"] / 2 and abs(z - s["z"]) < s["d"] / 2:
            return s["k"]
    return None


def in_shaft(x, z):
    return SHAFT["x0"] - 0.05 <= -abs(x) <= SHAFT["x1"] + 0.05 and SHAFT["z0"] - 0.05 <= z <= SHAFT["z1"] + 0.05


def exposed_runs(s):
    """[(face, t_start, t_end, context, level)] for every side of `s` that
    borders open space. level 0: open at the street (the facade starts at
    the solid's foot); level 1: only open over a Heaven terrace (it starts
    at the terrace). context: None (outdoors), a ceiling kind (indoors),
    "shaft" (a rope room)."""
    x0, x1 = s["x"] - s["w"] / 2, s["x"] + s["w"] / 2
    z0, z1 = s["z"] - s["d"] / 2, s["z"] + s["d"] / 2
    probes = [max(0.5, s["y"] + 1.0)]
    if s["y"] < HV and s["y"] + s["h"] > HV + 1.5:
        probes.append(HV + 1.0)
    sides = [("x", z0, x0, x1, -1), ("x", z1, x0, x1, 1), ("z", x0, z0, z1, -1), ("z", x1, z0, z1, 1)]
    out = []
    for ax, at, a, b2, n in sides:
        face = Face(ax, at, a, n)
        L = b2 - a
        steps = max(1, int(L / 0.25))
        cur = None
        for i in range(steps):
            t = (i + 0.5) * L / steps
            x, z = face.world(t, 0.3)
            inside = B["minX"] + 0.1 < x < B["maxX"] - 0.1 and B["minZ"] + 0.1 < z < B["maxZ"] - 0.1
            lvl, ctx = None, None
            if inside:
                for li, py in enumerate(probes):
                    if solid_at(x, py, z, skip=s) is None:
                        lvl = li
                        ctx = ceiling_over(x, z, py) or ("shaft" if li == 0 and in_shaft(x, z) else None)
                        break
            key = (lvl, ctx)
            t0 = i * L / steps
            if cur and cur[0] == key:
                cur[2] = t0 + L / steps
            else:
                if cur and cur[0][0] is not None:
                    out.append((face, cur[1], cur[2], cur[0][1], cur[0][0]))
                cur = [key, t0, t0 + L / steps]
        if cur and cur[0][0] is not None:
            out.append((face, cur[1], cur[2], cur[0][1], cur[0][0]))
    return [r for r in out if r[2] - r[1] > 0.2]


# ------------------------------------------------------------- facades

STYLES = ["tilewall", "conc", "stuccoA", "stuccoB", "stuccoC", "stuccoD", "stuccoE", "brick"]
SHOPS = ["izakaya", "ramen", "shutter", "glass", "pachinko", "shutter", "izakaya", "glass", "karaoke"]


def neon_pick(rng):
    return rng.choice(NEON_KEYS)


def glyphs_on_board(b, m, face, t0, t1, y0, y1, o, rng, cols=None):
    """A row of glyphs on a board facing out, between t0..t1 and y0..y1."""
    h = y1 - y0
    g = h * 0.78
    n = cols or max(1, int((t1 - t0) / (g * 1.15)))
    span = n * g * 1.15
    start = (t0 + t1) / 2 - span / 2 + g * 0.075
    for i in range(n):
        gx = start + i * g * 1.15
        for (u0, u1, v0, v1) in glyph_strokes(rng):
            face.quad(b, m, gx + u0 * g, gx + u1 * g, y0 + h * 0.11 + v0 * g, (v1 - v0) * g, o + 0.012)


def kanban(sh, ne, P, face, t, y0, height, rng, out=1.0):
    """A vertical sign standing out from the wall at t: dark box, glyphs in
    neon (or a lightbox with dark glyphs) on both broad faces."""
    w = 0.26
    o0, o1 = 0.12, 0.12 + out
    lightbox = rng.random() < 0.4
    body = P[rng.choice(["lightbox", "lightbox_r", "lightbox_y", "lightbox_b"])] if lightbox else P["sign_back"]
    tgt = ne if lightbox else sh
    face.box(tgt, body, t - w / 2, t + w / 2, y0, height, o0, o1)
    # brackets back to the wall
    for yy in (y0 + 0.2, y0 + height - 0.3):
        face.box(sh, P["frame"], t - 0.04, t + 0.04, yy, 0.08, 0.0, o0)
    stroke = P["sign_back"] if lightbox else P[neon_pick(rng)]
    stroke_b = sh if lightbox else ne
    g = out * 0.7
    n = max(2, int((height - 0.3) / (g * 1.1)))
    rows = glyph_column(rng, n)
    for side in (-1, 1):
        # the broad faces look along the street: their plane is across t
        at = face.t0 + t + side * (w / 2 + 0.012)
        for i, strokes in enumerate(rows):
            gy = y0 + height - 0.18 - (i + 1) * g * 1.1
            for (u0, u1, v0, v1) in strokes:
                p0 = face.world(t, o0 + (out - g) / 2 + u0 * g)
                p1 = face.world(t, o0 + (out - g) / 2 + u1 * g)
                k = 1 if face.ax == "x" else 0          # the world axis o runs along
                quad(stroke_b, stroke, "x" if face.ax == "x" else "z", side, at,
                     min(p0[k], p1[k]), max(p0[k], p1[k]), gy + v0 * g, gy + v1 * g)
    if not lightbox:
        # a neon tube round the edge
        tube = P[neon_pick(rng)]
        for side in (-1, 1):
            tt = t + side * (w / 2 + 0.012)
            face.box(ne, tube, min(tt, tt + side * 0.02), max(tt, tt + side * 0.02), y0, 0.035, o0, o1)
            face.box(ne, tube, min(tt, tt + side * 0.02), max(tt, tt + side * 0.02), y0 + height - 0.035, 0.035, o0, o1)
            face.box(ne, tube, min(tt, tt + side * 0.02), max(tt, tt + side * 0.02), y0, height, o1 - 0.035, o1)


def lantern(ne, sh, P, face, t, y, o, white=False, r=0.18, h=0.42):
    x, z = face.world(t, o)
    ne.cyl(P["lantern_w" if white else "lantern"], r, (x, y - h, z), (x, y, z), seg=10)
    sh.cyl(P["black"], r * 0.7, (x, y, z), (x, y + 0.06, z), seg=10)
    sh.cyl(P["black"], r * 0.7, (x, y - h - 0.06, z), (x, y - h, z), seg=10)


def shopfront(sh, ne, P, face, t0, t1, kind, rng):
    """The street-level 0 .. 3.4 band of one building between t0 and t1.
    Below 2.4 m everything stays within 6 cm of the wall."""
    w = t1 - t0
    if w < 1.4:
        return
    pad = 0.35
    a, c = t0 + pad, t1 - pad
    # pilasters at the ends, the fascia above
    face.box(sh, P["frame"], t0, t0 + pad, 0, 2.75, -0.02, 0.05)
    face.box(sh, P["frame"], t1 - pad, t1, 0, 2.75, -0.02, 0.05)
    if kind == "shutter":
        face.box(sh, P["shutter"], a, c, 0, 2.6, -0.02, 0.03)
        for k in range(1, 11):
            face.quad(sh, P["shutter_dk"], a, c, k * 0.24, 0.035, 0.04)
        face.box(sh, P["frame"], a - 0.05, c + 0.05, 2.6, 0.18, 0.0, 0.06)
        if rng.random() < 0.6:
            # tags on the shutter (paint)
            for _ in range(rng.randint(1, 3)):
                tx = rng.uniform(a + 0.3, c - 0.6)
                face.box(sh, P[rng.choice(["crate_r", "awning_blue", "hazard_k", "green"])], tx, tx + rng.uniform(0.3, 0.9),
                         rng.uniform(0.6, 1.6), rng.uniform(0.15, 0.4), 0.05, 0.056)
    else:
        # recessed glass, the shop glowing behind it (warm for the bars,
        # cool for the rest)
        glow = P["glow_warm"] if kind in ("izakaya", "ramen", "karaoke") else P["glow_cool"]
        face.quad(ne, glow, a, c, 0.4, 2.2, -0.06)
        # shelves and a counter in silhouette against the glow
        for yy in (0.95, 1.55):
            face.quad(sh, P["frame"], a + 0.1, c - 0.1, yy, 0.05, -0.05)
        face.quad(sh, P["frame"], a + 0.2, a + 0.2 + min(1.4, (c - a) * 0.4), 0.42, 0.55, -0.045)
        face.box(sh, P["frame"], a, c, 0, 0.42, -0.05, 0.03)                       # stall riser
        mull = max(1, int((c - a) / 1.3))
        for k in range(mull + 1):
            tt = a + (c - a) * k / mull
            face.box(sh, P["frame"], tt - 0.03, tt + 0.03, 0.4, 2.2, -0.04, 0.0)
        if kind in ("izakaya", "ramen"):
            # noren over the door, red lanterns either side
            nm = P["noren_navy" if kind == "ramen" else rng.choice(["noren_red", "noren_navy", "noren_white"])]
            dm = (a + c) / 2
            nw = min(1.8, c - a - 0.2)
            panels = 4
            for k in range(panels):
                pa = dm - nw / 2 + k * nw / panels + 0.02
                face.box(sh, nm, pa, pa + nw / panels - 0.04, 1.75, 0.65, 0.02, 0.045)
            face.box(sh, P["wood"], dm - nw / 2 - 0.05, dm + nw / 2 + 0.05, 2.38, 0.06, 0.0, 0.05)
            for tt in (a + 0.25, c - 0.25):
                lantern(ne, sh, P, face, tt, 3.0, 0.3, white=kind == "ramen" and rng.random() < 0.5)
        if kind == "pachinko":
            for k in range(int((c - a) / 0.5)):
                face.box(ne, P[NEON_KEYS[k % len(NEON_KEYS)]], a + k * 0.5 + 0.1, a + k * 0.5 + 0.4, 2.45, 0.05, 0.0, 0.03)
    # the sign band: a lightbox or a dark board with neon glyphs, over the door
    band = P[rng.choice(["lightbox", "lightbox_r", "lightbox_y", "lightbox_b"])]
    if kind in ("shutter",) and rng.random() < 0.5:
        face.box(sh, P["sign_back"], t0 + 0.1, t1 - 0.1, 2.78, 0.55, 0.0, 0.25)
        glyphs_on_board(sh, P["sill"], face, t0 + 0.3, t1 - 0.3, 2.82, 3.28, 0.25, rng)
    elif kind in ("pachinko", "karaoke"):
        face.box(sh, P["sign_back"], t0 + 0.1, t1 - 0.1, 2.75, 0.62, 0.0, 0.3)
        glyphs_on_board(ne, P[neon_pick(rng)], face, t0 + 0.3, t1 - 0.3, 2.8, 3.32, 0.3, rng)
    else:
        face.box(ne, band, t0 + 0.1, t1 - 0.1, 2.78, 0.55, 0.0, 0.25)
        glyphs_on_board(sh, P["sign_back"], face, t0 + 0.4, t1 - 0.4, 2.82, 3.28, 0.25, rng)
    # an awning over some fronts
    if kind in ("glass", "ramen") and rng.random() < 0.55:
        aw = P[rng.choice(["awning_red", "awning_white", "awning_blue", "awning_green"])]
        x0, z0 = face.world(t0 + 0.15, 0.05)
        x1, z1 = face.world(t1 - 0.15, 0.85)
        # a sloped canvas: a thin box tipped down toward the street
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        L, T = abs(t1 - t0) - 0.3, 0.85
        tilt = 0.32 * face.n
        if face.ax == "x":
            sh.box(aw, L, 0.04, T, cx, 2.58, cz, rx=tilt)
        else:
            sh.box(aw, T, 0.04, L, cx, 2.58, cz, rz=-tilt)


def upper_floors(sh, ne, P, face, t0, t1, y0, top, mat_wall, rng, windows="punched"):
    """Floors from y0 up to top: floor ledges, windows (some lit), AC units,
    balconies now and then."""
    w = t1 - t0
    y = y0
    floors = 0
    while y + 2.6 <= top:
        floors += 1
        face.box(sh, P["sill"], t0, t1, y, 0.14, 0.0, 0.1)                 # floor ledge
        if windows == "band":
            face.quad(sh, P["glass"], t0 + 0.4, t1 - 0.4, y + 0.85, 1.35, 0.012)
            if rng.random() < 0.45 and t1 - t0 > 3.2:
                k0 = rng.uniform(t0 + 0.4, t1 - 2.4)
                face.quad(ne, P[rng.choice(["lit", "lit", "lit_cool"])], k0, min(t1 - 0.4, k0 + rng.uniform(1.2, 3.0)), y + 0.9, 1.25, 0.02)
            face.box(sh, P["frame"], t0 + 0.4, t1 - 0.4, y + 2.2, 0.05, 0.0, 0.05)
        else:
            n = max(1, int(w / 2.0))
            for k in range(n):
                cx = t0 + (k + 0.5) * w / n
                lit = rng.random() < 0.38
                face.quad(sh, P["frame"], cx - 0.62, cx + 0.62, y + 0.8, 1.55, 0.008)
                face.quad(ne if lit else sh, P[rng.choice(["lit", "lit", "lit_cool"])] if lit else P["glass"],
                          cx - 0.55, cx + 0.55, y + 0.86, 1.43, 0.016)
                face.box(sh, P["sill"], cx - 0.65, cx + 0.65, y + 0.74, 0.06, 0.0, 0.08)
                r = rng.random()
                if r < 0.18:
                    # an AC unit under the window
                    face.box(sh, P["ac"], cx - 0.38, cx + 0.38, y + 0.15, 0.55, 0.02, 0.3)
                    face.cyl_out(sh, P["ac_dk"], 0.2, cx + 0.08, y + 0.42, 0.3, 0.31, seg=12)
                elif r < 0.26 and floors > 1:
                    # a small balcony
                    face.box(sh, P["sill"], cx - 0.8, cx + 0.8, y + 0.1, 0.1, 0.0, 0.7)
                    face.box(sh, P["frame_lt"], cx - 0.8, cx + 0.8, y + 0.2, 0.9, 0.66, 0.7)
        y += STOREY
    # the top: a parapet cap
    face.box(sh, P["sill"], t0, t1, top - 0.12, 0.12, 0.0, 0.12)
    return floors


def building(sh, ne, P, face, t0, t1, base_y, top, depth, rng, street, style=None):
    """One building on a face: wall slab, shopfront (if at the street),
    floors above, a kanban sign maybe, rooftop clutter."""
    wall = P[style or rng.choice(STYLES)]
    y = base_y
    if street and base_y < 0.1:
        # the shop is set 10 cm into the wall: its glass and shutter sit in
        # the recess, the pilasters and fascia frame it
        face.box(sh, wall, t0, t1, GROUND_FLOOR, top - GROUND_FLOOR, -depth, 0.0)
        face.box(sh, P["slab"], t0, t1, 0, GROUND_FLOOR, -depth, -SHOP_RECESS)
        face.box(sh, wall, t0, t1, 2.75, GROUND_FLOOR - 2.75, -SHOP_RECESS, 0.0)
        shopfront(sh, ne, P, face, t0, t1, rng.choice(SHOPS), rng)
        y = GROUND_FLOOR
    else:
        face.box(sh, wall, t0, t1, base_y, top - base_y, -depth, 0.0)
    if top - y > 2.6:
        upper_floors(sh, ne, P, face, t0, t1, y, top, wall, rng, "band" if rng.random() < 0.3 else "punched")
    if street and top > 7 and rng.random() < 0.62 and t1 - t0 > 2.0:
        side = rng.choice([t0 + 0.35, t1 - 0.35])
        sy = rng.uniform(3.6, 4.4)
        kanban(sh, ne, P, face, side, sy, min(top - sy - 0.5, rng.uniform(3.2, 7.5)), rng, out=rng.uniform(0.75, 1.15))
    # rooftop: a water tank or a billboard frame now and then
    if top > 9 and rng.random() < 0.35:
        tm = (t0 + t1) / 2
        face.cyl_up(sh, P["tank"], 0.7, tm, -1.6, top, top + 1.6, seg=12)
        for dt in (-0.5, 0.5):
            face.box(sh, P["steel_dk"], tm + dt - 0.05, tm + dt + 0.05, top, 0.2, -2.3, -0.9)
    elif top > 9 and rng.random() < 0.3 and t1 - t0 > 4:
        face.box(sh, P["steel_dk"], t0 + 0.6, t0 + 0.7, top, 2.6, -1.0, -0.9)
        face.box(sh, P["steel_dk"], t1 - 0.7, t1 - 0.6, top, 2.6, -1.0, -0.9)
        face.box(ne, P[rng.choice(["screen", "screen_p", "lightbox_r", "lightbox_y"])], t0 + 0.5, t1 - 0.5, top + 0.8, 2.0, -0.92, -0.86)
        glyphs_on_board(sh, P["sign_back"], face, t0 + 0.9, t1 - 0.9, top + 0.9, top + 2.7, -0.86, rng)


def split_widths(L, rng, lo=4.0, hi=8.0):
    out = []
    left = L
    while left > hi:
        w = rng.uniform(lo, hi)
        if left - w < lo * 0.6:
            break
        out.append(w)
        left -= w
    out.append(left)
    return out


def tunnel_lining(sh, ne, P, face, t0, t1, ceil, kind, rng):
    """Inside the Sewers or the Vents: lining, pipes, strip lights."""
    wall = P["slab"] if kind == "sewer" else P["conc"]
    face.box(sh, wall, t0, t1, 0, ceil, -0.2, 0.0)
    face.box(sh, P["hazard_y"], t0, t1, 0, 0.18, 0.0, 0.02)
    if kind == "sewer":
        face.cyl_along(sh, P["pipe_rust"], 0.14, t0, t1, ceil - 0.45, 0.2)
        face.cyl_along(sh, P["pipe"], 0.08, t0, t1, ceil - 0.18, 0.12)
        k = t0 + 1.0
        while k < t1 - 0.5:
            face.box(sh, P["steel_dk"], k - 0.04, k + 0.04, ceil - 0.62, 0.62, 0.0, 0.36)   # pipe hangers
            k += 2.0
    else:
        k = t0 + 0.6
        while k < t1:
            face.box(sh, P["steel_dk"], k - 0.03, k + 0.03, 0.18, ceil - 0.18, 0.0, 0.05)  # duct ribs
            k += 1.2
        face.cyl_along(sh, P["cable"], 0.04, t0, t1, ceil - 0.25, 0.06)
    k = t0 + 1.5
    while k < t1 - 0.7:
        face.box(ne, P["strip"], k - 0.5, k + 0.5, ceil - 0.12, 0.06, 0.0, 0.08)
        k += 3.5 if kind == "sewer" else 2.5


def mail_inside(sh, ne, P, face, t0, t1, rng):
    # (the walls themselves are drawn plaster through: post_office)
    face.box(sh, P["wood"], t0, t1, 0, 0.9, 0.0, 0.03)            # wainscot
    face.box(sh, P["mailred"], t0, t1, 0.9, 0.06, 0.0, 0.035)
    k = t0 + 1.2
    while k < t1 - 1.2:
        if rng.random() < 0.5:
            face.box(sh, P["cardboard"], k - 0.5, k + 0.5, 1.5, 0.7, 0.0, 0.025)   # notice boards
            face.box(sh, P["white"], k - 0.4, k - 0.05, 1.6, 0.45, 0.025, 0.03)
            face.box(sh, P["white"], k + 0.05, k + 0.4, 1.7, 0.4, 0.025, 0.03)
        k += 2.6


def shaft_lining(sh, ne, P, face, t0, t1, top, rng):
    face.box(sh, P["slab"], t0, t1, 0, top, -0.15, 0.0)
    face.cyl_along(sh, P["pipe"], 0.06, t0, t1, 0.9, 0.12)
    face.cyl_along(sh, P["pipe_rust"], 0.09, t0, t1, 2.2, 0.15)
    face.box(sh, P["hazard_y"], t0, t1, 0, 0.15, 0.0, 0.02)


# ------------------------------------------------------------- shell

def facades(sh, ne, P):
    rng = random.Random(1873)
    for s in SOLIDS:
        k = s["k"]
        if k not in ("block", "_edge", "terrace", "heavenwall", "sewer", "vent", "mailwall", "_lintel"):
            continue
        for face, t0, t1, ctx, lvl in exposed_runs(s):
            if ctx in ("sewer", "vent"):
                tunnel_lining(sh, ne, P, face, t0, t1, GJ[ctx]["ceil"], ctx, rng)
                continue
            if ctx == "_mailroof":
                mail_inside(sh, ne, P, face, t0, t1, rng)
                continue
            if ctx == "shaft":
                shaft_lining(sh, ne, P, face, t0, t1, s["y"] + s["h"], rng)
                continue
            base = s["y"] if lvl == 0 else HV
            if k in ("mailwall", "_lintel"):
                post_office_face(sh, ne, P, face, t0, t1, base, rng)
                continue
            if k == "terrace":
                # one storey: shops along the street, a cornice at the terrace
                r0, r1 = t0, t1
                for w in split_widths(t1 - t0, rng, 3.5, 7.0):
                    shopfront(sh, ne, P, face, t0, t0 + w, rng.choice(SHOPS), rng)
                    t0 += w
                face.box(sh, P["slab"], r0, r1, 2.75, HV - 2.75, -SHOP_RECESS, 0.0)
                face.box(sh, P["sill"], r0, r1, HV - 0.2, 0.2, 0.0, 0.12)
                continue
            if k == "heavenwall":
                # the Heaven building rising over its terrace: on the mid side a
                # facade; on the terrace side a plain back wall with a door.
                # Each takes half the wall's 0.3 m, so they never share a face.
                street = abs(face.at) < abs(s["x"])
                top = 11.5
                if street:
                    building(sh, ne, P, face, t0, t1, base, top, 0.15, rng, False, "tilewall")
                    kanban(sh, ne, P, face, (t0 + t1) / 2, base + 0.8, 6.5, rng, out=1.2)
                else:
                    face.box(sh, P["conc"], t0, t1, base, top - base, -0.15, 0.0)
                    dm = t0 + (t1 - t0) * 0.62
                    face.box(sh, P["steel_dk"], dm - 0.5, dm + 0.5, base, 2.1, 0.0, 0.04)
                    face.box(ne, P["lamp"], dm - 0.15, dm + 0.15, base + 2.3, 0.1, 0.0, 0.12)
                    face.cyl_up(sh, P["pipe"], 0.06, t0 + 1.0, 0.1, base, top)
                    face.cyl_up(sh, P["pipe_rust"], 0.08, t1 - 1.6, 0.12, base, top)
                    for yy in (base + 3.0, base + 5.8):
                        face.box(sh, P["ac"], t0 + 2.0, t0 + 2.8, yy, 0.6, 0.0, 0.32)
                continue
            # the city blocks and the edge of the map
            street = base < 0.1
            depth = 6.0 if k == "_edge" else 4.0
            under_viaduct = k == "_edge" and abs(s["z"]) > 40
            for w in split_widths(t1 - t0, rng):
                tt1 = t0 + w
                if under_viaduct:
                    top = 7.6
                elif base > 0.1:
                    top = rng.uniform(10, 16)
                else:
                    top = rng.uniform(10.5, 21) if k == "block" else rng.uniform(13, 26)
                building(sh, ne, P, face, t0, tt1, base, top, depth, rng, street,
                         "brick" if under_viaduct else None)
                t0 = tt1


def post_office_face(sh, ne, P, face, t0, t1, base, rng):
    top = GJ["mail"]["top"]
    face.box(sh, P["brick"], t0, t1, base, top - base, 0.0, 0.02)       # a skin over the plaster wall
    if base < 0.1:
        face.box(sh, P["frame"], t0, t1, 0, 0.5, 0.0, 0.04)
    if base < 3.2 <= top:
        face.box(sh, P["white"], t0, t1, 3.2, 0.5, 0.0, 0.12)
        face.box(sh, P["mailred"], t0, t1, 3.32, 0.12, 0.12, 0.14)
    y = 4.1
    n = max(1, int((t1 - t0) / 2.2))
    for k in range(n):
        cx = t0 + (k + 0.5) * (t1 - t0) / n
        lit = rng.random() < 0.6
        face.box(ne if lit else sh, P["lit_cool"] if lit else P["glass"], cx - 0.7, cx + 0.7, y + 0.3, 1.5, 0.0, 0.03)
        face.box(sh, P["sill"], cx - 0.75, cx + 0.75, y + 0.22, 0.08, 0.0, 0.08)
    face.box(sh, P["sill"], t0, t1, top - 0.15, 0.15, 0.0, 0.12)


def post_office(sh, ne, P):
    """The post office's own parts: walls (plaster through), ceiling with
    light panels, floor tiles, the sign on its roof."""
    m = GJ["mail"]
    for s in kinds("mailwall", "_lintel"):
        sbox(sh, P["plaster"], s)
    rf = kinds("_mailroof")[0]
    sh.box(P["plaster"], rf["w"] - 2 * m["wall"], 0.06, rf["d"] - 2 * m["wall"], rf["x"], m["ceil"] - 0.03, rf["z"])
    sh.box(P["slab"], rf["w"], 0.3, rf["d"], rf["x"], m["top"] - 0.3, rf["z"])
    for x in (-3.6, 3.6):
        for z in (-5.0, -1.0, 2.4):
            ne.box(P["strip"], 1.2, 0.04, 0.3, x, m["ceil"] - 0.07, z)
    sh.box(P["tilewall"], rf["w"] - 0.8, 0.012, rf["d"] - 0.8, rf["x"], 0.0, rf["z"])
    # the roof sign: the post mark and a glyph row, lit
    ne.box(P["lightbox_r"], 6.0, 1.2, 0.3, 0, m["top"], m["z0"] + 0.6)
    glyphs_on_board(sh, P["white"], Face("x", m["z0"] + 0.45, 0.0, -1), -2.6, 2.6, m["top"] + 0.1, m["top"] + 1.1, 0.0, random.Random(7))
    for x in (-2.8, 2.8):
        sh.box(P["steel_dk"], 0.1, 1.0, 0.1, x, m["top"] - 0.1, m["z0"] + 0.8)


def sbox(b, m, s, inset=0.0, h=None, y=None):
    b.box(m, s["w"] - inset, h if h is not None else s["h"], s["d"] - inset, s["x"], s["y"] if y is None else y, s["z"])


def heavens(sh, ne, P):
    """Terrace blocks, their decks, parapets and rails, and the tunnel and
    shaft ceilings."""
    for s in kinds("terrace"):
        # 10 cm in from the collider: the depth of a shop recess (facades)
        sbox(sh, P["slab"], s, inset=2 * SHOP_RECESS)
        sh.box(P["pavers"], s["w"] - 0.04, 0.02, s["d"] - 0.04, s["x"], s["y"] + s["h"], s["z"])
    for s in kinds("parapet"):
        sbox(sh, P["conc"], s)
        sh.box(P["sill"], s["w"] + 0.06, 0.06, s["d"] + 0.06, s["x"], s["y"] + s["h"], s["z"])
    for s in kinds("_rail"):
        # a steel railing (the collider is the full 1 m: posts and rails)
        f = Frame(s)
        n = max(2, int(f.w / 1.0) + 1)
        for k in range(n):
            lx = -f.w / 2 + 0.05 + k * (f.w - 0.1) / (n - 1)
            f.box(sh, P["steel"], 0.05, s["h"], 0.05, lx, 0, 0)
        for yy in (0.45, s["h"] - 0.05):
            f.box(sh, P["steel"], f.w, 0.05, 0.05, 0, yy, 0)
    for s in kinds("sewer", "vent"):
        # 5 cm short at each end: the facade over the portal owns that face
        sh.box(P["slab"], s["w"] - 0.1, s["h"], s["d"], s["x"], s["y"], s["z"])
        # the floor: a channel of black water down the Sewers, grates in the Vents
        z0, z1 = s["z"] - s["d"] / 2, s["z"] + s["d"] / 2
        if s["k"] == "sewer":
            sh.box(P["water"], s["w"], 0.012, 0.9, s["x"], 0.0, s["z"])
            for zz in (s["z"] - 0.55, s["z"] + 0.55):
                sh.box(P["steel_dk"], s["w"], 0.016, 0.12, s["x"], 0.0, zz)
        else:
            k = s["x"] - s["w"] / 2 + 0.6
            while k < s["x"] + s["w"] / 2:
                sh.box(P["grate"], 1.0, 0.014, s["d"] - 0.2, k, 0.0, s["z"])
                k += 1.2
        # portals: a hazard-striped frame where the tunnel meets the street
        for x in (s["x"] - s["w"] / 2, s["x"] + s["w"] / 2):
            sh.box(P["hazard_y"], 0.12, 0.3, s["d"], x, s["y"] - 0.3, s["z"])
            for zz in (z0, z1):
                sh.box(P["hazard_k"], 0.12, s["y"], 0.12, x, 0, zz)


def stairs_geo(sh, P):
    for st in STAIRS:
        along = "x" if st["dir"][1] == "x" else "z"
        sign = 1 if st["dir"][0] == "+" else -1
        for i in range(st["steps"]):
            h = st["rise"] * (i + 1)
            off = sign * (st["run"] * (i + 0.5))
            px = st["x"] + off if along == "x" else st["x"]
            pz = st["z"] + off if along == "z" else st["z"]
            w = st["run"] if along == "x" else st["width"]
            d = st["width"] if along == "x" else st["run"]
            sh.box(P["slab"], w, h, d, px, 0, pz)
            # a yellow nosing on each tread's front edge
            nx = px - sign * (st["run"] / 2 - 0.03) if along == "x" else px
            nz = pz - sign * (st["run"] / 2 - 0.03) if along == "z" else pz
            sh.box(P["hazard_y"], 0.06 if along == "x" else w, 0.012, d if along == "x" else 0.06, nx, h, nz)
        if st["steps"] >= 6:
            # handrails on both sides, posts at the bottom and the top
            L = st["run"] * st["steps"]
            for side in (-1, 1):
                for k in range(0, st["steps"] + 1, 3):
                    t = min(k, st["steps"] - 1)
                    off = sign * st["run"] * (t + 0.5)
                    y = st["rise"] * (t + 1)
                    if along == "z":
                        sh.box(P["steel"], 0.05, 0.95, 0.05, st["x"] + side * (st["width"] / 2 - 0.06), y, st["z"] + off)
                    else:
                        sh.box(P["steel"], 0.05, 0.95, 0.05, st["x"] + off, y, st["z"] + side * (st["width"] / 2 - 0.06))
                a = (st["x"] + (sign * 0.3 if along == "x" else side * (st["width"] / 2 - 0.06)),
                     st["rise"] + 0.95,
                     st["z"] + (sign * 0.3 if along == "z" else side * (st["width"] / 2 - 0.06)))
                c = (st["x"] + (sign * (L - 0.3) if along == "x" else side * (st["width"] / 2 - 0.06)),
                     st["rise"] * st["steps"] + 0.95,
                     st["z"] + (sign * (L - 0.3) if along == "z" else side * (st["width"] / 2 - 0.06)))
                sh.cyl(P["steel"], 0.03, a, c, seg=6)


def ground_paint(sh, P):
    """Sidewalks at the foot of every street face, crossings and lane lines."""
    for s in kinds("block", "_edge", "terrace", "mailwall"):
        if s["y"] > 0.1:
            continue
        for face, t0, t1, ctx, lvl in exposed_runs(s):
            if ctx is not None or lvl != 0:
                continue
            face.box(sh, P["pavers"], t0, t1, 0.0, 0.014, 0.0, 1.5)
            face.box(sh, P["sill"], t0, t1, 0.0, 0.02, 1.45, 1.6)    # kerb line
    # zebra crossings across the lane mouths
    def zebra(x0, x1, z0, z1, along):
        if along == "x":
            k = x0 + 0.25
            while k < x1 - 0.3:
                sh.box(P["line"], 0.45, 0.01, z1 - z0, k + 0.225, 0.0, (z0 + z1) / 2)
                k += 0.9
        else:
            k = z0 + 0.25
            while k < z1 - 0.3:
                sh.box(P["line"], x1 - x0, 0.01, 0.45, (x0 + x1) / 2, 0.0, k + 0.225)
                k += 0.9
    for sx in (-1, 1):
        zebra(*sorted((sx * 31.0, sx * 24.0)), -30.4, -28.0, "x")     # A/B Main mouths
        zebra(*sorted((sx * 31.0, sx * 24.0)), 25.0, 27.4, "x")       # the backs
    zebra(-5.6, 5.6, -30.4, -28.0, "x")                                # Mid Top
    zebra(-5.0, 5.0, 25.2, 27.6, "x")                                  # Mid Bottom
    # dashed centre lines down the lanes, and the stop lines
    for sx in (-1, 1):
        x = sx * 27.35
        z = -26.0
        while z < 2.0:
            sh.box(P["line"], 0.14, 0.01, 1.8, x, 0.0, z)
            z += 3.6
    for z in (-26.0, -20.0, -14.0):
        sh.box(P["line_y"], 0.14, 0.01, 1.8, 0, 0.0, z)
    # the site plazas: pale paving over the asphalt
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 31.7, sx * 14.0))
        sh.box(P["plaza"], x1 - x0, 0.006, 20.0, (x0 + x1) / 2, 0.0, 14.0)
    sh.box(P["plaza"], 12.0, 0.006, 20.0, 0.0, 0.0, 14.0)


def build_shell(P):
    sh, ne = Builder(), NEONB
    facades(sh, ne, P)
    post_office(sh, ne, P)
    heavens(sh, ne, P)
    stairs_geo(sh, P)
    ground_paint(sh, P)
    sh.finish("gj-shell.glb")


# ------------------------------------------------------------- props

def p_deck(b, ne, P, s):
    sbox(b, P["slab"], s)
    b.box(P["sill"], s["w"] + 0.04, 0.04, s["d"] + 0.04, s["x"], s["y"] + s["h"] - 0.02, s["z"])
    # hazard stripes on the open faces (south, and the east end)
    f = Frame(s)
    k = -f.w / 2
    i = 0
    while k < f.w / 2 - 0.2:
        f.box(b, P["hazard_y" if i % 2 == 0 else "hazard_k"], 0.3, 0.16, 0.02, k + 0.15, s["h"] - 0.2, f.d / 2 + 0.01)
        k += 0.3
        i += 1
    for lx in (-f.w / 2 + 1.0, 0.0, f.w / 2 - 1.0):
        f.box(b, P["bumper"], 0.35, 0.45, 0.05, lx, 0.25, f.d / 2 + 0.025)


def p_stall(b, ne, P, s):
    f = Frame(s)
    w, d = f.w, f.d
    f.box(b, P["wood"], w, 0.9, d, 0, 0, 0)
    f.box(b, P["steel"], w + 0.04, 0.06, d + 0.04, 0, 0.9, 0)
    f.box(b, P["noren_red"], w - 0.1, 0.3, 0.02, 0, 0.5, d / 2 + 0.01)
    # the takoyaki plate and its balls
    f.box(b, P["black"], w * 0.6, 0.08, d * 0.5, 0, 0.96, 0)
    for i in range(5):
        for j in range(3):
            X, Y, Z = f.p(-w * 0.25 + i * w * 0.125, 1.04, -d * 0.18 + j * d * 0.18)
            b.lump(P["cardboard"], 0.12, 0.08, 0.12, X, Y, Z, seed=i * 3 + j, rnd=0.9)
    f.box(b, P["glass"], w - 0.1, 0.25, 0.02, 0, 1.04, d / 2 - 0.05)
    # posts and the striped roof, all inside the footprint
    for lx in (-w / 2 + 0.05, w / 2 - 0.05):
        for lz in (-d / 2 + 0.05, d / 2 - 0.05):
            f.box(b, P["wood"], 0.08, 1.0, 0.08, lx, 1.3, lz)
    for k in range(6):
        f.box(b, P["awning_red" if k % 2 == 0 else "awning_white"], w / 6, 0.08, d, -w / 2 + (k + 0.5) * w / 6, 2.3, 0)
    for lx in (-w / 2 + 0.25, w / 2 - 0.25):
        X, Y, Z = f.p(lx, 2.25, d / 2 - 0.2)
        ne.cyl(P["lantern"], 0.15, (X, Y - 0.38, Z), (X, Y, Z), seg=10)
    X, Y, Z = f.p(0, 2.38, d / 2 - 0.02)
    ne.box(P["lightbox"], w - 0.4, 0.4, 0.06, X, Y, Z, ry=f.f)


def p_kiosk(b, ne, P, s):
    f = Frame(s)
    w, d = f.w, f.d
    f.box(b, P["green"], w, s["h"] - 0.3, d, 0, 0, 0)
    f.box(b, P["shutter"], w - 0.3, 1.7, 0.03, 0, 0.3, d / 2 + 0.015)
    for k in range(13):
        f.box(b, P["shutter_dk"], w - 0.3, 0.02, 0.02, 0, 0.35 + k * 0.125, d / 2 + 0.035)
    f.box(b, P["white"], w + 0.1, 0.3, d + 0.1, 0, s["h"] - 0.3, 0)
    X, Y, Z = f.p(0, s["h"] - 0.27, d / 2 + 0.07)
    ne.box(P["lightbox_y"], w - 0.3, 0.24, 0.02, X, Y, Z, ry=f.f)
    for side in (-1, 1):
        X, Y, Z = f.p(side * (w / 2 + 0.02), 0.6, 0)
        b.box(P["white"], 0.02, 1.0, 0.7, X, Y, Z, ry=f.f)     # poster on each end


def p_vending(b, ne, P, s):
    f = Frame(s)
    n = max(1, round(f.w / 1.0))
    mw = f.w / n
    rng = random.Random(int(s["x"] * 13 + s["z"] * 7))
    for i in range(n):
        lx = -f.w / 2 + (i + 0.5) * mw
        body = P[rng.choice(["white", "red", "blue", "white"])]
        f.box(b, body, mw - 0.04, s["h"], f.d, lx, 0, 0)
        # the lit display: rows of cans
        X, Y, Z = f.p(lx, 0.95, f.d / 2 + 0.01)
        ne.box(P["vend"], mw - 0.2, 0.8, 0.02, X, Y, Z, ry=f.f)
        for row in range(3):
            for k in range(5):
                cx = lx - (mw - 0.3) / 2 + k * (mw - 0.3) / 4
                f.box(b, P[rng.choice(["red", "blue", "yellow", "green", "orange", "white"])], 0.07, 0.14, 0.02,
                      cx, 1.0 + row * 0.26, f.d / 2 + 0.025)
        f.box(b, P["black"], mw - 0.3, 0.2, 0.02, lx, 0.25, f.d / 2 + 0.01)       # the slot
        f.box(b, P["frame"], 0.18, 0.4, 0.02, lx + mw / 2 - 0.2, 0.55, f.d / 2 + 0.01)


def p_crates(b, ne, P, s):
    f = Frame(s)
    rng = random.Random(int(s["x"] * 17 + s["z"] * 3))
    cw, cd, ch = 0.45, 0.33, 0.3
    nx, nz = max(1, int(f.w / cw)), max(1, int(f.d / cd))
    for i in range(nx):
        for j in range(nz):
            stack = rng.randint(max(1, int(s["h"] / ch) - 1), int(s["h"] / ch))
            col = P[rng.choice(["crate_y", "crate_r", "crate_b", "crate_y"])]
            for k in range(stack):
                lx = -f.w / 2 + (i + 0.5) * f.w / nx
                lz = -f.d / 2 + (j + 0.5) * f.d / nz
                f.box(b, col, f.w / nx - 0.03, ch - 0.02, f.d / nz - 0.03, lx, k * ch, lz, ry=rng.uniform(-0.05, 0.05))
                f.box(b, P["black"], f.w / nx - 0.08, 0.02, f.d / nz - 0.08, lx, k * ch + ch - 0.03, lz)
    if rng.random() < 0.7:
        f.box(b, P["cardboard"], 0.5, 0.35, 0.4, f.w / 2 - 0.3, s["h"] - 0.05, 0, ry=0.2)


def bicycle(b, P, f, lx, rng):
    col = P[rng.choice(["red", "blue", "white", "green", "black"])]
    for lz in (-0.5, 0.5):
        f.cyl(b, P["tyre"], 0.32, (lx - 0.02, 0.32, lz), (lx + 0.02, 0.32, lz), seg=14)
    f.bar(b, col, (lx, 0.35, -0.5), (lx, 0.75, 0.05), 0.04)
    f.bar(b, col, (lx, 0.75, 0.05), (lx, 0.82, 0.42), 0.04)
    f.bar(b, col, (lx, 0.35, -0.5), (lx, 0.35, 0.1), 0.035)
    f.bar(b, col, (lx, 0.35, 0.1), (lx, 0.75, 0.05), 0.035)
    f.box(b, P["seat"], 0.1, 0.05, 0.22, lx, 0.82, -0.05)
    f.bar(b, P["steel"], (lx - 0.25, 0.98, 0.42), (lx + 0.25, 0.98, 0.42), 0.03)
    f.box(b, P["steel"], 0.3, 0.2, 0.25, lx, 0.78, 0.58)            # the basket


def p_bikes(b, ne, P, s):
    f = Frame(s)
    rng = random.Random(int(s["z"] * 11))
    n = int(f.w / 0.7)
    for k in range(n):
        bicycle(b, P, f, -f.w / 2 + (k + 0.5) * f.w / n, rng)
    f.box(b, P["steel"], f.w, 0.04, 0.04, 0, 0.6, -0.3)


def p_truck(b, ne, P, s):
    """A white kei truck, cab toward +z."""
    f = Frame(s)
    w, d = f.w - 0.1, f.d - 0.1
    f.box(b, P["truck"], w, 1.15, 1.4, 0, 0.35, d / 2 - 0.7, bevel=0.05)              # cab
    f.box(b, P["glass"], w - 0.2, 0.5, 0.04, 0, 0.95, d / 2 + 0.01)                  # windscreen
    for side in (-1, 1):
        f.box(b, P["glass"], 0.04, 0.42, 0.9, side * w / 2, 0.98, d / 2 - 0.75)
    f.box(b, P["truck"], w, 0.25, d - 1.4, 0, 0.45, -0.7)                              # bed
    for side in (-1, 1):
        f.box(b, P["truck"], 0.05, 0.3, d - 1.45, side * (w / 2 - 0.03), 0.7, -0.7)
    f.box(b, P["truck"], w, 0.3, 0.05, 0, 0.7, -d / 2 + 0.03)
    f.box(b, P["frame"], w + 0.04, 0.12, 0.08, 0, 0.32, d / 2)                         # bumper
    for side in (-1, 1):
        X, Y, Z = f.p(side * (w / 2 - 0.2), 0.62, d / 2 + 0.02)
        ne.box(P["lamp"], 0.25, 0.12, 0.02, X, Y, Z, ry=f.f)
        for lz in (d / 2 - 0.75, -d / 2 + 0.6):
            f.cyl(b, P["tyre"], 0.26, (side * w / 2 - 0.1, 0.26, lz), (side * w / 2 + 0.02, 0.26, lz), seg=14)
    # crates and a tarp in the bed
    for i, lz in enumerate((-1.2, -0.5)):
        f.box(b, P["crate_y" if i else "crate_b"], 0.9, 0.35, 0.6, -0.3, 0.7, lz)
    X, Y, Z = f.p(0.4, 0.7, -0.9)
    b.lump(P["awning_blue"], 0.7, 0.4, 1.1, X, Y, Z, seed=4)


def p_planter(b, ne, P, s):
    f = Frame(s)
    sbox(b, P["conc"], s, h=0.8)
    b.box(P["soil"], s["w"] - 0.16, 0.02, s["d"] - 0.16, s["x"], 0.8, s["z"])
    for k in range(3):
        lz = -f.d / 2 + (k + 0.5) * f.d / 3
        X, Y, Z = f.p(0, 0.75, lz)
        b.lump(P["leaf" if k % 2 else "leaf_dk"], f.w * 0.8, 0.4, f.d / 3, X, Y, Z, seed=k + int(s["z"]))
    # a sakura tree: trunk and two limbs up through the middle, small
    # clusters of blossom well over heads
    X, _, Z = f.p(0, 0, 0)
    b.cyl(P["bark"], 0.12, (X, 0.8, Z), (X, 2.5, Z), seg=8, r2=0.09)
    for dx, dz in ((0.7, 0.5), (-0.6, -0.6)):
        b.cyl(P["bark"], 0.07, (X, 2.3, Z), (X + dx, 3.1, Z + dz), seg=6, r2=0.04)
    rng = random.Random(int(s["z"] * 31))
    for i in range(9):
        a = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(0.2, 1.1)
        r = rng.uniform(0.45, 0.75)
        b.lump(P["sakura" if i % 2 == 0 else "sakura_dk"], r * 1.3, r * 0.75, r * 1.3,
               X + math.cos(a) * rr, rng.uniform(2.8, 3.5), Z + math.sin(a) * rr, seed=30 + i, rnd=0.7, jitter=0.15)


def p_torii(b, ne, P, s):
    # the kasagi (top beam) is this solid; the pillars are the _torii solids
    x, y, z = s["x"], s["y"], s["z"]
    w = s["w"]
    b.box(P["black"], w + 0.6, 0.28, 0.75, x, y + 0.32, z)
    b.box(P["vermilion"], w + 0.2, 0.3, 0.55, x, y + 0.02, z)
    for side in (-1, 1):   # the upturned ends
        b.box(P["black"], 0.6, 0.22, 0.75, x + side * (w / 2 + 0.45), y + 0.42, z, rz=side * 0.18)
    b.box(P["vermilion"], w - 0.6, 0.3, 0.3, x, y - 0.6, z)                # the nuki tie beam
    b.box(P["black"], 0.5, 0.7, 0.12, x, y - 0.45, z - 0.2)                 # the gakuzuka plaque
    ne.box(P["lightbox"], 0.36, 0.56, 0.02, x, y - 0.38, z - 0.27)


def p__torii(b, ne, P, s):
    b.cyl(P["vermilion"], 0.28, (s["x"], 0.3, s["z"]), (s["x"], s["h"], s["z"]), seg=14, r2=0.25)
    b.cyl(P["black"], 0.34, (s["x"], 0, s["z"]), (s["x"], 0.3, s["z"]), seg=14)


def p_tank(b, ne, P, s):
    f = Frame(s)
    r = min(f.w, s["h"]) / 2 - 0.05
    b.cyl(P["tank"], r, f.p(0, r + 0.1, -f.d / 2 + 0.1), f.p(0, r + 0.1, f.d / 2 - 0.1), seg=16)
    for lz in (-f.d / 3, f.d / 3):
        f.box(b, P["steel_dk"], f.w - 0.1, 0.35, 0.15, 0, 0, lz)
    f.box(b, P["steel_dk"], 0.05, 0.05, f.d - 0.3, 0, 2 * r + 0.12, 0)


def p_acunit(b, ne, P, s):
    f = Frame(s)
    n = max(1, int(f.w / 0.75))
    for k in range(n):
        lx = -f.w / 2 + (k + 0.5) * f.w / n
        f.box(b, P["ac"], f.w / n - 0.06, s["h"], f.d - 0.05, lx, 0, 0)
        f.cyl(b, P["ac_dk"], 0.22, (lx, s["h"] * 0.5, f.d / 2 - 0.02), (lx, s["h"] * 0.5, f.d / 2), seg=14)
    f.cyl(b, P["pipe"], 0.03, (-f.w / 2, 0.2, -f.d / 2), (-f.w / 2, 0.2, -f.d / 2 - 0.0), seg=6)


def p_konbini(b, ne, P, s):
    f = Frame(s)
    w, d, h = f.w, f.d, s["h"]
    f.box(b, P["white"], w, h, d, 0, 0, 0)
    X, Y, Z = f.p(0, 0.35, d / 2 + 0.01)
    ne.box(P["lit_shop"], w - 0.6, 1.9, 0.02, X, Y, Z, ry=f.f)
    for k in range(5):
        f.box(b, P["frame"], 0.05, 1.9, 0.03, -w / 2 + 0.3 + k * (w - 0.6) / 4, 0.35, d / 2 + 0.02)
    for i, m in enumerate(["green", "white", "blue"]):
        f.box(b, P[m], w + 0.02, 0.18, d + 0.02, 0, 2.35 + i * 0.18, 0)
    X, Y, Z = f.p(0, 2.42, d / 2 + 0.03)
    ne.box(P["lightbox"], w * 0.5, 0.4, 0.02, X, Y, Z, ry=f.f)
    # the shop's name (konbini face +z in the layout: f = 0)
    glyphs_on_board(b, P["green"], Face("x", Z, 0.0, 1), X - w * 0.22, X + w * 0.22, 2.44, 2.8, 0.02, random.Random(5))
    # its back: AC units and crates against the wall
    for lx in (-w / 3, w / 3):
        f.box(b, P["ac"], 0.7, 0.5, 0.05, lx, 1.8, -d / 2 - 0.025)


def p_koban(b, ne, P, s):
    f = Frame(s)
    w, d, h = f.w, f.d, s["h"]
    f.box(b, P["white"], w, h - 0.2, d, 0, 0, 0)
    f.box(b, P["frame"], w + 0.2, 0.2, d + 0.2, 0, h - 0.2, 0)
    f.box(b, P["glass"], 1.2, 1.8, 0.02, 0, 0.1, d / 2 + 0.01)
    X, Y, Z = f.p(0, h - 0.6, d / 2 + 0.05)
    ne.cyl(P["redlamp"], 0.14, (X, Y, Z), (X, Y + 0.3, Z), seg=10)
    X, Y, Z = f.p(0, h - 0.12, d / 2 + 0.02)
    ne.box(P["lightbox"], 1.6, 0.25, 0.02, X, Y - 0.3, Z, ry=f.f)


def p_shelter(b, ne, P, s):
    f = Frame(s)
    w, d, h = f.w, f.d, s["h"]
    for lx in (-w / 2 + 0.1, w / 2 - 0.1):
        f.box(b, P["frame"], 0.1, h, 0.1, lx, 0, -d / 2 + 0.1)
    f.box(b, P["frame_lt"], w, 0.1, d, 0, h - 0.1, 0)
    f.box(b, P["glass"], w - 0.3, 1.6, 0.03, 0, 0.5, -d / 2 + 0.1)
    f.box(b, P["wood"], w * 0.6, 0.06, 0.35, 0, 0.45, -d / 2 + 0.35)
    X, Y, Z = f.p(w / 2 - 0.1, 0.4, 0)
    ne.box(P["screen_p"], 0.06, 1.6, d - 0.25, X, Y, Z, ry=f.f)


def p_counter(b, ne, P, s):
    f = Frame(s)
    f.box(b, P["wood"], f.w, s["h"] - 0.05, f.d, 0, 0, 0)
    f.box(b, P["white"], f.w + 0.06, 0.05, f.d + 0.06, 0, s["h"] - 0.05, 0)
    f.box(b, P["glass"], f.w, 0.6, 0.02, 0, s["h"], 0)
    for k in range(3):
        f.box(b, P["frame"], 0.04, 0.6, 0.04, -f.w / 2 + 0.05 + k * (f.w - 0.1) / 2, s["h"], 0)
    f.box(b, P["mailred"], f.w, 0.1, 0.02, 0, 0.8, f.d / 2 + 0.01)


def p_sorting(b, ne, P, s):
    f = Frame(s)
    f.box(b, P["wood"], f.w, s["h"], f.d, 0, 0, 0)
    for i in range(1, 4):
        f.box(b, P["white"], f.w - 0.06, 0.02, 0.02, 0, i * s["h"] / 4, f.d / 2 + 0.01)
    for j in range(1, 6):
        f.box(b, P["white"], 0.02, s["h"] - 0.1, 0.02, -f.w / 2 + j * f.w / 6, 0.05, f.d / 2 + 0.01)
    for i in range(4):
        for j in range(6):
            if (i + j) % 3 == 0:
                f.box(b, P["cardboard"], f.w / 6 - 0.08, 0.12, 0.02, -f.w / 2 + (j + 0.5) * f.w / 6, i * s["h"] / 4 + 0.05, f.d / 2 + 0.015)


def p_parcels(b, ne, P, s):
    rng = random.Random(9)
    f = Frame(s)
    y = 0.0
    for k in range(3):
        bw = f.w * rng.uniform(0.6, 0.95)
        bd = f.d * rng.uniform(0.6, 0.95)
        bh = s["h"] / 3
        f.box(b, P["cardboard"], bw, bh - 0.01, bd, rng.uniform(-0.05, 0.05), y, rng.uniform(-0.05, 0.05), ry=rng.uniform(-0.15, 0.15))
        f.box(b, P["sill"], 0.06, 0.005, bd, 0, y + bh - 0.01, 0)
        y += bh


def p_pier(b, ne, P, s):
    sbox(b, P["conc"], s)
    b.box(P["slab"], s["w"] + 0.6, 0.6, s["d"] + 0.6, s["x"], s["h"] - 0.6, s["z"])
    b.box(P["hazard_y"], s["w"] + 0.02, 0.3, s["d"] + 0.02, s["x"], 0.2, s["z"])


PROPS = {
    "deck": p_deck, "stall": p_stall, "kiosk": p_kiosk, "vending": p_vending, "crates": p_crates,
    "bikes": p_bikes, "truck": p_truck, "planter": p_planter, "torii": p_torii, "_torii": p__torii,
    "tank": p_tank, "acunit": p_acunit, "konbini": p_konbini, "koban": p_koban, "shelter": p_shelter,
    "counter": p_counter, "sorting": p_sorting, "parcels": p_parcels, "pier": p_pier,
}


def ropes_geo(b, P):
    """Each rope hangs from a beam 1.6 m over the floor it climbs to: across
    the shaft for the mid ropes, on an arm over the parapet gap for the
    site ropes. Knotted every 40 cm."""
    for r in ROPES:
        dx = 1 if r["dir"] == "+x" else -1 if r["dir"] == "-x" else 0
        dz = 1 if r["dir"] == "+z" else -1 if r["dir"] == "-z" else 0
        top = r["y1"] + 2.0          # clear of a head stepping off at the top
        b.cyl(P["rope"], 0.035, (r["x"], r["y0"], r["z"]), (r["x"], top, r["z"]), seg=6)
        y = r["y0"] + 0.4
        while y < top - 0.3:
            b.cyl(P["rope_knot"], 0.055, (r["x"], y - 0.05, r["z"]), (r["x"], y + 0.05, r["z"]), seg=6)
            y += 0.4
        b.cyl(P["steel_dk"], 0.09, (r["x"] - 0.08, top - 0.05, r["z"]), (r["x"] + 0.08, top - 0.05, r["z"]), seg=10)   # pulley
        if dz:
            # mid rope: an I-beam across the shaft, from the Heaven building's
            # wall to a post on the shaft's rail
            sx = 1 if r["x"] > 0 else -1
            xa, xb = sorted((sx * -SHAFT["x0"], sx * -SHAFT["x1"]))
            b.box(P["steel_dk"], xb - xa, 0.25, 0.14, (xa + xb) / 2, top, r["z"])
            b.box(P["hazard_y"], xb - xa, 0.04, 0.16, (xa + xb) / 2, top + 0.25, r["z"])
            post_x = sx * (-SHAFT["x0"] + 0.15)
            b.box(P["steel_dk"], 0.14, top - (HV + 1.0), 0.14, post_x, HV + 1.0, r["z"])
        else:
            # site rope: posts on the parapet ends either side of the gap, a
            # beam between them and an arm out over the rope
            px = r["x"] + dx * 0.55
            for pz in (17.0 - 0.15, 19.0 + 0.15):
                b.box(P["steel_dk"], 0.14, top + 0.2 - (HV + 1.0), 0.14, px, HV + 1.0, pz)
            b.box(P["steel_dk"], 0.14, 0.22, 2.6, px, top, r["z"])
            b.box(P["steel_dk"], 0.7, 0.18, 0.14, r["x"] + dx * 0.25, top, r["z"])
            b.box(P["hazard_y"], 0.14, 0.04, 2.6, px, top + 0.22, r["z"])


def wires(b, ne, P):
    """Cables across the lanes, and festival lantern strings over mid."""
    rng = random.Random(77)

    def sag(a, c, drop, segs, mat, r=0.015):
        pts = []
        for i in range(segs + 1):
            t = i / segs
            pts.append((a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - drop * 4 * t * (1 - t), a[2] + (c[2] - a[2]) * t))
        for p, q in zip(pts, pts[1:]):
            b.cyl(mat, r, p, q, seg=4, caps=False)
        return pts

    for sx in (-1, 1):
        z = -29.0
        while z < 2.0:
            y = rng.uniform(6.0, 7.6)
            sag((sx * 31.6, y, z), (sx * 23.1, y + rng.uniform(-0.5, 0.5), z + rng.uniform(-1.5, 1.5)), 0.5, 6, P["cable"])
            z += rng.uniform(3.5, 6.0)
    z = -30.0
    while z < -9.0:
        y = rng.uniform(6.5, 8.0)
        sag((-6.9, y, z), (6.9, y + rng.uniform(-0.4, 0.4), z + rng.uniform(-1, 1)), 0.6, 8, P["cable"])
        z += rng.uniform(4.0, 6.0)
    # lantern strings (chochin) over Mid Top and Mid Bottom
    for (x0, x1, z, y) in [(-6.9, 6.9, -26.0, 4.8), (-6.9, 6.9, -19.5, 4.9), (-6.9, 6.9, -13.0, 4.8),
                           (-5.9, 5.9, 13.0, 5.4), (-5.9, 5.9, 19.0, 5.4)]:
        pts = sag((x0, y, z), (x1, y, z), 0.7, 14, P["cable"])
        for i, p in enumerate(pts[1:-1]):
            white = i % 3 == 1
            ne.cyl(P["lantern_w" if white else "lantern"], 0.16, (p[0], p[1] - 0.46, p[2]), (p[0], p[1] - 0.08, p[2]), seg=10)
            b.cyl(P["black"], 0.1, (p[0], p[1] - 0.08, p[2]), (p[0], p[1], p[2]), seg=8)


def build_props(P):
    b, ne = Builder(), NEONB
    for s in SOLIDS:
        fn = PROPS.get(s["k"])
        if fn:
            fn(b, ne, P, s)
    ropes_geo(b, P)
    wires(b, ne, P)
    b.finish("gj-props.glb")


# ------------------------------------------------------------- skyline

def build_skyline(P):
    """The city past the map's edge: towers, the two viaducts with trains,
    Grin Corp's tower over it all. No colliders, no shadows."""
    b = Builder()
    rng = random.Random(2049)
    # the viaducts along the north and south edges, over the shops under the arches
    for sz in (-1, 1):
        zc = sz * 43.2
        b.box(P["conc"], 260, 1.2, 7.6, 0, 8.0, zc)
        b.box(P["slab"], 260, 0.9, 0.3, 0, 9.2, zc - 3.65)
        b.box(P["slab"], 260, 0.9, 0.3, 0, 9.2, zc + 3.65)
        for x in range(-120, 121, 16):
            if abs(x) < 32:
                continue                          # inside the map the piers are solids (props)
            b.box(P["conc"], 1.6, 8.0, 1.6, x, 0, zc - 1.6)
            b.box(P["conc"], 1.6, 8.0, 1.6, x, 0, zc + 1.6)
        for x in range(-124, 125, 12):           # overhead line masts
            b.box(P["steel_dk"], 0.2, 4.0, 0.2, x, 9.2, zc + sz * 3.4)
            b.box(P["steel_dk"], 0.12, 0.12, 6.8, x, 13.0, zc)
        for zz in (zc - 1.2, zc + 1.2):
            b.box(P["steel"], 260, 0.12, 0.1, 0, 9.25, zz - 0.72)
            b.box(P["steel"], 260, 0.12, 0.1, 0, 9.25, zz + 0.72)
        # a commuter train standing on each: silver cars, a green stripe, lit windows
        x = -70 if sz < 0 else -20
        for car in range(6):
            cx = x + car * 20.4
            zz = zc - 1.2 if sz < 0 else zc + 1.2
            b.box(P["steel"], 20.0, 3.2, 2.9, cx, 9.4, zz, bevel=0.08)
            b.box(P["green"], 20.02, 0.22, 2.92, cx, 10.3, zz)
            for side in (-1, 1):
                for wk in range(7):
                    wx = cx - 8.6 + wk * 2.85
                    quad(NEONB, P["lit_cool"], "z", side, zz + side * 1.47, wx - 0.8, wx + 0.8, 11.0, 11.9)
                    if wk < 6:
                        b.box(P["frame"], 1.2, 1.9, 0.02, wx + 1.42, 9.7, zz + side * 1.46)   # doors
    # towers in rings outside the map
    def tower(x, z, w, d, h):
        m = P[rng.choice(["conc", "stuccoB", "stuccoE", "tilewall", "slab"])]
        b.box(m, w, h, d, x, 0, z)
        y = 4.0
        lit_mats = ["lit", "lit_cool", "lit"]
        while y < h - 2:
            for face in range(4):
                if rng.random() < 0.55:
                    continue
                mtl = P[rng.choice(lit_mats)]
                L = (w if face < 2 else d) * rng.uniform(0.3, 0.9)
                off = rng.uniform(-0.2, 0.2) * (w if face < 2 else d)
                if face < 2:
                    sgn = -1 if face == 0 else 1
                    quad(NEONB, mtl, "z", sgn, z + sgn * (d / 2 + 0.02), x + off - L / 2, x + off + L / 2, y, y + 1.1)
                else:
                    sgn = -1 if face == 2 else 1
                    quad(NEONB, mtl, "x", sgn, x + sgn * (w / 2 + 0.02), z + off - L / 2, z + off + L / 2, y, y + 1.1)
            y += 3.4
        if h > 40:
            NEONB.box(P["redlamp"], 0.5, 0.5, 0.5, x, h, z)
        if rng.random() < 0.35:
            # a billboard high on its face toward the map
            fx = -1 if x > 0 else 1
            bw = min(w, 14)
            bh = bw * 0.55
            by = rng.uniform(min(h - bh - 2, 12), max(h - bh - 2, 12.5))
            quad(NEONB, P[rng.choice(["screen", "screen_p", "lightbox_r", "lightbox_y", "lightbox_b"])],
                 "x", fx, x + fx * (w / 2 + 0.1), z - bw / 2, z + bw / 2, by, by + bh)

    taken = []
    for _ in range(140):
        ang = rng.uniform(0, 2 * math.pi)
        dist = rng.uniform(52, 150)
        x, z = math.cos(ang) * dist * 1.0, math.sin(ang) * dist * 1.15
        if abs(x) < 46 and abs(z) < 56:
            continue
        w, d = rng.uniform(10, 24), rng.uniform(10, 24)
        if any(abs(x - tx) < (w + tw) / 2 + 2 and abs(z - tz) < (d + td) / 2 + 2 for tx, tz, tw, td in taken):
            continue
        taken.append((x, z, w, d))
        h = rng.uniform(18, 70) * (1.3 if dist > 100 else 1.0)
        tower(x, z, w, d, h)
    # low blocks right behind the edge facades, so the gaps never show sky
    for sx in (-1, 1):
        for z in range(-36, 37, 12):
            tower(sx * 44, z, 12, 11.5, rng.uniform(16, 30))
    # Grin Corp: a dark glass monolith over the city to the north-east, lit crown
    gx, gz = 86, -120
    b.box(P["glass"], 34, 170, 30, gx, 0, gz)
    for k in range(0, 165, 6):
        NEONB.box(P["lit_cool"], 34.2, 0.25, 30.2, gx, k + 3, gz)
    NEONB.box(P["neon_violet"], 36, 3, 32, gx, 170, gz)
    NEONB.box(P["neon_violet"], 2, 40, 0.3, gx - 8, 120, gz + 15.2)
    NEONB.box(P["neon_cyan"], 2, 40, 0.3, gx + 8, 110, gz + 15.2)
    b.finish("gj-skyline.glb")


# ================================================================== main

NEONB = None

MODELS = {
    "shell": build_shell,
    "props": build_props,
    "skyline": build_skyline,
}


def main():
    global NEONB
    import time
    import quantize_glb
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    P = gj_palette()
    # everything that glows goes in one shadowless model, whichever part
    # of the map it belongs to: so gj-neon is rebuilt with any of them
    NEONB = Builder()
    for name, fn in MODELS.items():
        if ONLY and name not in ONLY:
            continue
        fn(P)
    if ONLY and set(MODELS) - ONLY:
        print("NOTE: gj-neon.glb left as it was: it holds the glow of every model, so build them all to change it")
    else:
        NEONB.finish("gj-neon.glb")
    fresh = [os.path.join(OUT_DIR, f) for f in sorted(os.listdir(OUT_DIR))
             if f.startswith("gj-") and f.endswith(".glb") and os.path.getmtime(os.path.join(OUT_DIR, f)) >= t0 - 1]
    quantize_glb.main(fresh)


if __name__ == "__main__":
    main()
