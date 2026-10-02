"""
Troll Forces — Hollowgrin's village buildings (map detail pass phase 6a).

Run with (no names = all):
  blender --background --python build_hollowgrin.blender.py -- mausoleum barn shop

Writes hg-mausoleum.glb, hg-barn.glb, hg-candyshop.glb in MAP coordinates
(placed at the origin), drawn over the colliders hollowgrin.js already
builds: change an opening there, change it here. The JS keeps everything
that glows, flickers or carries a canvas (candles, the stained glass, the
TROLL plaque, the shop sign, the jars, the awnings, the lamps' lights).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_kit import *  # noqa: E402,F401,F403
import math  # noqa: E402
import random  # noqa: E402

TEXTURED.update({"HG_Granite", "HG_GraniteDark", "HG_BarnRed", "HG_BarnWood", "HG_Clapboard",
                 "HG_Brick", "HG_Floorboards"})


def hg_palette():
    return {
        "granite": mat("HG_Granite", 0x8c8c94, 0.9),
        "granite_dk": mat("HG_GraniteDark", 0x5a5a62, 0.9),
        "joint": mat("HG_Joint", 0x2a2a30, 0.95),
        "bronze": mat("HG_Bronze", 0x3d6a58, 0.45, 0.3),
        "bronze_dk": mat("HG_BronzeDark", 0x26402f, 0.5, 0.3),
        "recess": mat("HG_Recess", 0x26262c, 0.95),
        "barn": mat("HG_BarnRed", 0xc8382c, 0.85),
        "barnwood": mat("HG_BarnWood", 0x8a6a48, 0.85),
        "trim": mat("HG_TrimWhite", 0xd9d2c2, 0.75),
        "roofmetal": mat("HG_RoofMetal", 0x4a524e, 0.5, 0.25),
        "roofrib": mat("HG_RoofRib", 0x5c6662, 0.45, 0.25),
        "iron": mat("HG_Iron", 0x1c1c22, 0.55, 0.3),
        "clap": mat("HG_Clapboard", 0x5b3a6e, 0.8),
        "shoptrim": mat("HG_ShopTrim", 0xe0762a, 0.65),
        "shopdark": mat("HG_ShopDark", 0x2a1832, 0.7),
        "brick": mat("HG_Brick", 0x8a4a3a, 0.9),
        "floor": mat("HG_Floorboards", 0x6a4a30, 0.8),
        "wainscot": mat("HG_Wainscot", 0x4a2e22, 0.6),
        "tin": mat("HG_Tin", 0xc8c0a8, 0.5, 0.2),
        "paper": mat("HG_Wallpaper", 0x2e5a50, 0.85),
        "tar": mat("HG_Tar", 0x1e1e22, 0.95),
        "brass": mat("HG_Brass", 0xc8a050, 0.35, 0.4),
        "glass": mat("HG_GlassDark", 0x1a2028, 0.1),
        "warm": mat("HG_WarmGlass", 0xffd08a, 0.3, 0.0, 0xffb860, 1.6),
        "lamp": mat("HG_Lamp", 0xfff0c8, 0.2, 0.0, 0xffd890, 3.0),
        "hay": mat("HG_Hay", 0xb89a50, 1.0),
        "tool": mat("HG_ToolSteel", 0x6a6e74, 0.5, 0.3),
        "handle": mat("HG_Handle", 0x8a6a40, 0.8),
        "rope": mat("HG_Rope", 0x9a8458, 1.0),
    }


# ------------------------------------------------------------ wall helpers

def spans_free(a, b_, holes, y):
    """Intervals along a wall [a, b_] at relative height y not inside a hole."""
    cuts = sorted((h["c"] - h["w"] / 2, h["c"] + h["w"] / 2) for h in holes
                  if any(lo - 1e-4 <= y <= hi + 1e-4 for lo, hi in h["spans"]))
    out, cur = [], a
    for s, e in cuts:
        if s > cur:
            out.append((cur, s))
        cur = max(cur, e)
    if cur < b_:
        out.append((cur, b_))
    return out


def heights_free(p, h, holes):
    """Vertical intervals [0, h] at position p along the wall not in a hole."""
    cuts = []
    for hole in holes:
        if hole["c"] - hole["w"] / 2 - 1e-4 <= p <= hole["c"] + hole["w"] / 2 + 1e-4:
            cuts += hole["spans"]
    out, cur = [], 0.0
    for lo, hi in sorted(cuts):
        if lo > cur:
            out.append((cur, lo))
        cur = max(cur, hi)
    if cur < h:
        out.append((cur, h))
    return out


class Wall:
    """Same wall as hollowgrin.js wall(): axis 'x' runs along x at z = at,
    'z' along z at x = at, from a to b_, thickness t, openings `holes`
    ({c, w, spans}) with heights relative to y. `out` = +1/-1: the side that
    is outdoors (on the across axis)."""

    def __init__(self, axis, at, a, b_, h, t, holes=(), y=0.0, out=1):
        self.axis, self.at, self.a, self.b, self.h, self.t = axis, at, a, b_, h, t
        self.holes, self.y, self.out = list(holes), y, out

    def pt(self, along, across):
        return (along, across) if self.axis == "x" else (across, along)

    def slab(self, b, m, along0, along1, lo, hi, across, depth):
        if along1 - along0 < 0.005 or hi - lo < 0.005:
            return
        x, z = self.pt((along0 + along1) / 2, across)
        w, d = (along1 - along0, depth) if self.axis == "x" else (depth, along1 - along0)
        b.box(m, w, hi - lo, d, x, self.y + lo, z)

    def solid(self, b, m, inner=None, split=0.5):
        """The wall itself, around its openings. With `inner`, the outer
        `split` of the thickness gets m and the rest gets inner."""
        layers = [(m, self.at, self.t)] if inner is None else [
            (m, self.at + self.out * self.t * (1 - split) / 2, self.t * split),
            (inner, self.at - self.out * self.t * split / 2, self.t * (1 - split))]
        for mm, across, depth in layers:
            cur = self.a
            for hole in sorted(self.holes, key=lambda q: q["c"]):
                s, e = hole["c"] - hole["w"] / 2, hole["c"] + hole["w"] / 2
                self.slab(b, mm, cur, s, 0, self.h, across, depth)
                lo = 0.0
                for sl, sh in sorted(hole["spans"]):
                    self.slab(b, mm, s, e, lo, sl, across, depth)
                    lo = sh
                self.slab(b, mm, s, e, lo, self.h, across, depth)
                cur = e
            self.slab(b, mm, cur, self.b, 0, self.h, across, depth)

    def face(self, off):
        """`across` coordinate just proud of the outer (off>0) or inner face."""
        return self.at + self.out * (self.t / 2 + off) if off > 0 else self.at - self.out * (self.t / 2 - off)

    def battens(self, b, m, every, w=0.07, proud=0.03, y0=0.0, y1=None, a=None, b_=None):
        a = self.a if a is None else a
        b_ = self.b if b_ is None else b_
        y1 = self.h if y1 is None else y1
        p = a + every / 2
        while p < b_:
            for lo, hi in heights_free(p, self.h, self.holes):
                lo, hi = max(lo, y0), min(hi, y1)
                if hi - lo > 0.05:
                    self.slab(b, m, p - w / 2, p + w / 2, lo, hi, self.face(proud / 2), proud)
            p += every

    def laps(self, b, m, every=0.2, proud=0.025, y0=0.0, y1=None, tilt=0.12):
        """Lap siding: overlapping horizontal boards, skipping openings."""
        y1 = self.h if y1 is None else y1
        y = y0
        while y < y1 - 0.01:
            top = min(y1, y + every + 0.02)
            for s, e in spans_free(self.a, self.b, self.holes, (y + top) / 2):
                x, z = self.pt((s + e) / 2, self.face(proud / 2))
                w, d = (e - s, proud) if self.axis == "x" else (proud, e - s)
                rx = -self.out * tilt if self.axis == "x" else 0.0
                rz = self.out * tilt if self.axis == "z" else 0.0
                b.box(m, w, top - y, d, x, self.y + y, z, rx=rx, rz=rz)
            y += every

    def courses(self, b, m, every=0.45, block=1.1, proud=0.006, y0=0.0, y1=None, line=0.025, side=1):
        """Ashlar joints: thin horizontal bed joints and staggered head joints."""
        y1 = self.h if y1 is None else y1
        across = self.face(proud / 2) if side > 0 else self.face(-proud / 2)
        k = 0
        y = y0 + every
        while y < y1 - 0.05:
            for s, e in spans_free(self.a, self.b, self.holes, y):
                self.slab(b, m, s, e, y - line / 2, y + line / 2, across, proud)
            # head joints in the course below this bed joint
            p = self.a + (block / 2 if k % 2 else block)
            while p < self.b - 0.1:
                mid = y - every / 2
                if any(lo <= mid <= hi for lo, hi in heights_free(p, self.h, self.holes)):
                    self.slab(b, m, p - line / 2, p + line / 2, y - every + line / 2, y - line / 2, across, proud)
                p += block
            y += every
            k += 1

    def casings(self, b, m, fw=0.12, proud=0.04, sill=True, side=1):
        """Frames round every opening (jambs, head, sill on windows)."""
        across = self.face(proud / 2) if side > 0 else self.face(-proud / 2)
        for hole in self.holes:
            s, e = hole["c"] - hole["w"] / 2, hole["c"] + hole["w"] / 2
            for lo, hi in hole["spans"]:
                self.slab(b, m, s - fw, s, lo, hi + fw, across, proud)
                self.slab(b, m, e, e + fw, lo, hi + fw, across, proud)
                self.slab(b, m, s - fw, e + fw, hi, hi + fw, across, proud * 1.3)
                if sill and lo > 0.05:
                    self.slab(b, m, s - fw - 0.05, e + fw + 0.05, lo - 0.06, lo, across, proud * 2.2)


def fluted_shaft(b, m, x, z, y0, y1, r0, r1, flutes=16, depth=0.018):
    """A fluted column shaft: a ring profile with scalloped flutes, tapered."""
    n = flutes * 4
    ring = []
    for i in range(n):
        a = 2 * math.pi * i / n
        dent = depth * (0.5 - 0.5 * math.cos(2 * math.pi * (i % 4) / 4))
        ring.append((a, dent))
    pts = []
    for y, r in ((y0, r0), (y1, r1)):
        for a, dent in ring:
            pts.append((x + (r - dent) * math.cos(a), y, z + (r - dent) * math.sin(a)))
    faces = [list(range(n - 1, -1, -1)), list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    fs = b.poly(m, pts, faces)
    for f in fs[2:]:
        f.smooth = True


def gable_prism(b, m, base, rise, y, a0, a1, axis="x", c=0.0):
    """Triangular gable: base width `base` centred on c (across), rising
    `rise` from y, extruded along `axis` from a0 to a1."""
    prof = [(c - base / 2, y), (c + base / 2, y), (c, y + rise)]
    b.prism(m, prof, a0, a1, axis=axis)


# ------------------------------------------------------------ mausoleum

def build_mausoleum(P):
    """Over: walls x -31..-25, z 8..14 (0.5 thick, 3.2 tall), door east
    (z 11, 1.8 wide, 2.5 tall); slab 6.8 x 6.8 x 0.35 at y 3.2; columns at
    (-24.55, 9.3 / 12.7); step (-24.4, 11) 1.2 x 4.2 x 0.18; sarcophagus
    (-28.4, 11) 1.1 x 2.3 x 0.95 + lid."""
    b = Builder()
    G, GD, J = P["granite"], P["granite_dk"], P["joint"]
    x0, x1, z0, z1, h, t = -31.0, -25.0, 8.0, 14.0, 3.2, 0.5
    door = {"c": 11.0, "w": 1.8, "spans": [(0, 2.5)]}
    walls = [Wall("x", z0 + t / 2, x0, x1, h, t, out=-1), Wall("x", z1 - t / 2, x0, x1, h, t, out=1),
             Wall("z", x0 + t / 2, z0 + t, z1 - t, h, t, out=-1),
             Wall("z", x1 - t / 2, z0 + t, z1 - t, h, t, holes=[door], out=1)]
    for w in walls:
        w.solid(b, G)
        w.courses(b, J, every=0.5, block=1.2, y0=0.4)
        w.courses(b, J, every=0.6, block=1.0, y0=0.0, side=-1)
    # plinth course round the outside, split at the door
    for (cx, cz, w_, d_) in ((-28, z0 - 0.05, 6.3, 0.2), (-28, z1 + 0.05, 6.3, 0.2), (x0 - 0.05, 11, 0.2, 6.3)):
        b.box(GD, w_, 0.4, d_, cx, 0, cz, bevel=0.02)
    for (za, zb) in ((z0 - 0.15, 10.1), (11.9, z1 + 0.15)):
        b.box(GD, 0.2, 0.4, zb - za, x1 + 0.05, 0, (za + zb) / 2, bevel=0.02)
    b.box(GD, 6.3, 0.05, 6.3, -28, 0.4, 11)          # (hidden under the walls' joint line)
    # corner antae
    for cx in (x0 + 0.25, x1 - 0.25):
        for cz in (z0 - 0.02, z1 + 0.02):
            b.box(G, 0.62, h - 0.4, 0.12, cx, 0.4, cz)
    for cz in (z0 + 0.25, z1 - 0.25):
        for cx in (x0 - 0.02, x1 + 0.02):
            b.box(G, 0.12, h - 0.4, 0.62, cx, 0.4, cz)
    # door surround: a stepped frame, a lintel with a keystone
    for side in (-1, 1):
        zz = 11 + side * 1.05
        b.box(GD, 0.14, 2.6, 0.3, x1 + 0.07, 0, zz)
    b.box(GD, 0.16, 0.36, 2.6, x1 + 0.08, 2.5, 11)
    b.box(G, 0.2, 0.42, 0.34, x1 + 0.1, 2.47, 11)
    # the bronze doors, open outward flat against the front wall
    for side in (-1, 1):
        z_in, z_out = 11 + side * 0.9, 11 + side * 1.8
        zc = (z_in + z_out) / 2
        b.box(P["bronze"], 0.05, 2.45, 0.86, x1 + 0.2, 0.02, zc)
        for (lo, hi) in ((0.15, 1.1), (1.3, 2.3)):
            b.box(P["bronze_dk"], 0.02, hi - lo, 0.62, x1 + 0.235, lo, zc)
            b.box(P["bronze"], 0.02, hi - lo - 0.16, 0.46, x1 + 0.25, lo + 0.08, zc)
        b.cyl(P["brass"], 0.04, (x1 + 0.26, 1.2, zc - side * 0.3), (x1 + 0.3, 1.2, zc - side * 0.3), seg=8)
    # the steps (collider: the 0.18 slab) and a lower lip
    b.box(GD, 1.2, 0.18, 4.2, -24.4, 0, 11, bevel=0.015)
    b.box(GD, 0.4, 0.09, 3.8, -23.6, 0, 11, bevel=0.015)
    # Doric columns in antis
    for cz in (9.3, 12.7):
        cx = -24.55
        b.cyl(GD, 0.3, (cx, 0.18, cz), (cx, 0.3, cz), seg=20)
        b.cyl(G, 0.27, (cx, 0.3, cz), (cx, 0.38, cz), seg=20)
        fluted_shaft(b, G, cx, cz, 0.38, 2.92, 0.235, 0.2)
        b.cyl(G, 0.2, (cx, 2.92, cz), (cx, 3.04, cz), seg=20, r2=0.29)
        b.box(G, 0.62, 0.12, 0.62, cx, 3.04, cz, bevel=0.01)
        b.box(G, 0.64, 0.04, 0.64, cx, 3.16, cz)
    # entablature: architrave, frieze with triglyphs, cornice
    ex0, ex1, ez0, ez1 = -31.4, -24.2, 7.6, 14.4
    W, D = ex1 - ex0, ez1 - ez0
    cx, cz = (ex0 + ex1) / 2, (ez0 + ez1) / 2
    b.box(G, W, 0.14, D, cx, 3.2, cz)
    b.box(GD, W - 0.04, 0.17, D - 0.04, cx, 3.34, cz)
    b.box(G, W + 0.36, 0.1, D + 0.36, cx, 3.51, cz, bevel=0.02)
    b.box(G, W + 0.24, 0.04, D + 0.24, cx, 3.47, cz)
    for zz in [ez0 + 0.3 + i * 0.75 for i in range(9)]:
        for xx in (ex1 + 0.01, ex0 - 0.01):
            b.box(G, 0.06, 0.17, 0.32, xx, 3.34, zz)
    for xx in [ex0 + 0.35 + i * 0.75 for i in range(10)]:
        for zz in (ez0 - 0.01, ez1 + 0.01):
            b.box(G, 0.32, 0.17, 0.06, xx, 3.34, zz)
    # pediments + roof: ridge along x, gables east and west
    rise = 1.3
    base = D + 0.36
    gable_prism(b, G, base - 0.3, rise - 0.2, 3.61, ex1 - 0.15, ex1 + 0.04, axis="x", c=cz)
    gable_prism(b, G, base - 0.3, rise - 0.2, 3.61, ex0 - 0.04, ex0 + 0.15, axis="x", c=cz)
    # tympanum recess (east) for the relief the JS hangs there
    gable_prism(b, P["recess"], base - 1.4, rise - 0.75, 3.75, ex1 + 0.03, ex1 + 0.05, axis="x", c=cz)
    slope = math.atan2(rise, base / 2)
    L = math.hypot(base / 2, rise) + 0.1
    for s in (-1, 1):
        zc = cz + s * base / 4
        b.box(GD, W + 0.5, 0.16, L, cx, 3.61 + rise / 2 - 0.08, zc, rx=s * slope)
        # raking cornices on both gables
        for xx in (ex1 + 0.2, ex0 - 0.2):
            b.box(G, 0.2, 0.14, L, xx, 3.61 + rise / 2, zc, rx=s * slope)
    # roll-top ridge, acroteria at the apex and the eaves
    b.cyl(G, 0.11, (ex0 - 0.25, 3.61 + rise + 0.02, cz), (ex1 + 0.25, 3.61 + rise + 0.02, cz), seg=10)
    for xx in (ex1 + 0.2, ex0 - 0.2):
        b.box(G, 0.22, 0.42, 0.42, xx, 3.61 + rise - 0.05, cz, bevel=0.03)
        b.cyl(GD, 0.14, (xx, 3.61 + rise + 0.37, cz), (xx, 3.61 + rise + 0.55, cz), seg=12, r2=0.02)
        for s in (-1, 1):
            b.box(G, 0.22, 0.3, 0.3, xx, 3.61, cz + s * (base / 2 - 0.1))
    # inside: polished floor, coffered ceiling, niches, the stained window
    b.box(GD, 5.0, 0.02, 5.0, -28, 0, 11)
    for i in range(1, 4):
        b.box(J, 5.0, 0.012, 0.03, -28, 0.02, 8.5 + i * 1.25)
        b.box(J, 0.03, 0.012, 5.0, -30.5 + i * 1.25, 0.02, 11)
    for i in range(5):
        b.box(G, 5.0, 0.14, 0.1, -28, 3.06, 8.5 + i * 1.25)
        b.box(G, 0.1, 0.14, 5.0, -30.5 + i * 1.25, 3.06, 11)
    for zz, s in ((z0 + t, 1), (z1 - t, -1)):
        for xx in (-29.6, -27.6, -26.2):
            for lv in (0.6, 1.75):
                b.box(G, 0.95, 0.85, 0.06, xx, lv, zz + s * 0.03)
                b.box(P["recess"], 0.75, 0.65, 0.02, xx, lv + 0.1, zz + s * 0.065)
                b.box(P["brass"], 0.4, 0.16, 0.02, xx, lv + 0.35, zz + s * 0.08)
            b.box(GD, 1.0, 0.06, 0.18, xx, 0.55, zz + s * 0.09)
        # an urn on the ledge of each wall
        b.cyl(P["bronze"], 0.1, (-28.6, 0.6, zz + s * 0.12), (-28.6, 0.92, zz + s * 0.12), seg=12, r2=0.06)
    # stained window on the west wall: arched stone frame both faces
    for face, xx in ((1, x0 + t + 0.02), (-1, x0 - 0.02)):
        for side in (-1, 1):
            b.box(GD, 0.06, 1.3, 0.14, xx, 1.2, 11 + side * 0.62)
        b.box(GD, 0.06, 0.1, 1.4, xx, 1.1, 11)
        arch(b, GD, xx, 11, 1.1, 0.06, 2.5, along="z", thick=0.12, seg=9)
    # the sarcophagus: plinth, panelled chest, gabled lid, lion feet
    sx, sz = -28.4, 11.0
    b.box(GD, 1.3, 0.12, 2.5, sx, 0, sz, bevel=0.02)
    b.box(G, 1.1, 0.83, 2.3, sx, 0.12, sz, bevel=0.015)
    for s in (-1, 1):
        b.box(GD, 0.02, 0.5, 1.8, sx + s * 0.56, 0.3, sz)
        b.box(G, 0.02, 0.38, 1.66, sx + s * 0.575, 0.36, sz)
        b.box(GD, 0.8, 0.5, 0.02, sx, 0.3, sz + s * 1.16)
    b.box(GD, 1.24, 0.08, 2.44, sx, 0.95, sz, bevel=0.02)
    gable_prism(b, G, 1.2, 0.18, 1.03, sz - 1.2, sz + 1.2, axis="z", c=sx)
    for (ox, oz) in ((-0.5, -1.1), (0.5, -1.1), (-0.5, 1.1), (0.5, 1.1)):
        b.lump(GD, 0.22, 0.16, 0.22, sx + ox, 0, sz + oz, seed=int(ox * 10 + oz * 7), rnd=0.6, jitter=0.02)
    b.finish("hg-mausoleum.glb")


# ------------------------------------------------------------------ barn

def build_barn(P):
    """Over: walls x 17..29, z 20..29 (0.35 thick, 4.4 tall); ceiling slab
    12.4 x 9.4 x 0.3 at y 4.4; the loft deck x 17.35..20.4, z 20.35..28.65
    at 2.4 and its stair (x 20.9, z 21 -> 24.36, 8 x 0.3); openings as in
    hollowgrin.js (north door 4 x 3.6, west door 3 x 2.2 + loft window)."""
    b = Builder()
    rng = random.Random(23)
    R, Wd, T = P["barn"], P["barnwood"], P["trim"]
    x0, x1, z0, z1, h, t = 17.0, 29.0, 20.0, 29.0, 4.4, 0.35
    walls = [
        Wall("x", z0 + t / 2, x0, x1, h, t, out=-1, holes=[{"c": 23, "w": 4, "spans": [(0, 3.6)]}]),
        Wall("x", z1 - t / 2, x0, x1, h, t, out=1, holes=[{"c": 20, "w": 1.2, "spans": [(1.8, 2.8)]},
                                                          {"c": 26, "w": 1.2, "spans": [(1.8, 2.8)]}]),
        Wall("z", x0 + t / 2, z0 + t, z1 - t, h, t, out=-1, holes=[{"c": 24.5, "w": 3, "spans": [(0, 2.2)]},
                                                                  {"c": 22.0, "w": 1.4, "spans": [(3.0, 4.25)]}]),
        Wall("z", x1 - t / 2, z0 + t, z1 - t, h, t, out=1, holes=[{"c": 26, "w": 1.6, "spans": [(0, 2.4)]},
                                                                 {"c": 22.5, "w": 1.2, "spans": [(1.8, 2.8)]}]),
    ]
    for w in walls:
        w.solid(b, R, inner=Wd, split=0.45)
        w.battens(b, R, 0.42, y0=0.3)
        w.casings(b, T, fw=0.12)
        w.casings(b, Wd, fw=0.08, sill=False, side=-1)
    # the corners the walls leave open on the long sides
    for cx in (x0 + t / 2, x1 - t / 2):
        for cz in (z0 + t / 2, z1 - t / 2):
            b.box(R, t, h, t, cx, 0, cz)
    # foundation course, corner boards, a sill board
    for (cx, cz, w_, d_) in ((23, z0 - 0.03, 12.2, 0.12), (23, z1 + 0.03, 12.2, 0.12),
                             (x0 - 0.03, 24.5, 0.12, 9.2), (x1 + 0.03, 24.5, 0.12, 9.2)):
        b.box(P["granite_dk"], w_, 0.3, d_, cx, 0, cz)
    for cx, sx in ((x0, -1), (x1, 1)):
        for cz, sz in ((z0, -1), (z1, 1)):
            b.box(T, 0.16, h - 0.3, 0.05, cx - sx * 0.08 + sx * 0.0, 0.3, cz + sz * 0.03)
            b.box(T, 0.05, h - 0.3, 0.16, cx + sx * 0.03, 0.3, cz - sz * 0.08)
    # gambrel roof along x: eaves z 19.6 / 29.4 at 4.4, breaks z 21.5 / 27.5
    # at 6.4, ridge z 24.5 at 7.7
    ridge = 24.5
    rx0, rx1 = x0 - 0.35, x1 + 0.35
    RL = rx1 - rx0
    rcx = (rx0 + rx1) / 2
    planes = []
    for s in (-1, 1):
        planes.append(((ridge + s * 4.9, 4.4), (ridge + s * 3.0, 6.4)))
        planes.append(((ridge + s * 3.0, 6.4), (ridge, 7.7)))
    for (za, ya), (zb, yb) in planes:
        L = math.hypot(zb - za, yb - ya) + 0.06
        ang = math.atan2(yb - ya, zb - za)
        zc, yc = (za + zb) / 2, (ya + yb) / 2
        b.box(P["roofmetal"], RL, 0.08, L, rcx, yc - 0.04 + 0.05, zc, rx=-ang)
        xx = rx0 + 0.25
        while xx < rx1:
            b.box(P["roofrib"], 0.035, 0.05, L, xx, yc + 0.06, zc, rx=-ang)
            xx += 0.48
    b.box(P["roofrib"], RL + 0.04, 0.12, 0.34, rcx, 7.68, ridge)
    # gable ends: siding pentagons, rake boards, fascia
    gable = [(z0 - 0.0 + 0.0, 4.4), (z1, 4.4), (ridge + 3.0, 6.4 - 0.0), (ridge, 7.7), (ridge - 3.0, 6.4)]
    gprof = [(z0 + 0.0, 0), (z1, 0), (ridge + 3.0 - 0.1, 2.0 - 0.1), (ridge, 3.3 - 0.08), (ridge - 3.0 + 0.1, 2.0 - 0.1)]
    for gx in (x0, x1):
        b.prism(R, [(zz, 4.4 + yy) for zz, yy in gprof], gx - 0.02 if gx == x0 else gx - t + 0.02,
                gx + t - 0.02 if gx == x0 else gx + 0.02, axis="x")
        out = -1 if gx == x0 else 1
        zz = z0 + 0.3
        while zz < z1 - 0.1:
            top = 4.4 + (2.0 * max(0.0, min(1.0, (zz - z0 + 0.4) / 1.9)) if zz < ridge - 3.0 else
                         2.0 + 1.3 * (zz - (ridge - 3.0)) / 3.0 if zz < ridge else
                         2.0 + 1.3 * ((ridge + 3.0) - zz) / 3.0 if zz < ridge + 3.0 else
                         2.0 * max(0.0, min(1.0, (z1 + 0.4 - zz) / 1.9)))
            if top - 4.4 > 0.2:
                b.box(R, 0.03, top - 4.4 - 0.12, 0.07, gx + out * 0.015, 4.4, zz)
            zz += 0.42
        for (za, ya), (zb, yb) in planes:
            L = math.hypot(zb - za, yb - ya) + 0.04
            ang = math.atan2(yb - ya, zb - za)
            b.box(T, 0.06, 0.2, L, gx + out * 0.4, (ya + yb) / 2 - 0.08, (za + zb) / 2, rx=-ang)
        b.box(T, 0.04, 0.14, z1 - z0 + 0.1, gx + out * 0.03, 4.3, (z0 + z1) / 2)
    for s in (-1, 1):
        b.box(T, RL + 0.04, 0.22, 0.05, rcx, 4.22, ridge + s * 4.92)
        b.box(T, RL, 0.06, 0.38, rcx, 4.38, ridge + s * 4.75)
    # cupola + weathervane on the ridge
    cx = 23.0
    b.box(T, 1.2, 0.5, 1.2, cx, 7.4, ridge)
    b.box(R, 1.0, 0.75, 1.0, cx, 7.9, ridge)
    for side in range(4):
        a = side * math.pi / 2
        for k in range(5):
            yy = 7.98 + k * 0.12
            ox, oz = math.cos(a) * 0.51, math.sin(a) * 0.51
            b.box(T, 0.62 if side % 2 == 1 else 0.03, 0.025, 0.03 if side % 2 == 1 else 0.62,
                  cx + ox, yy, ridge + oz, rx=0.4 if side % 2 == 1 else 0.0, rz=0.4 if side % 2 == 0 else 0.0)
    b.box(T, 1.15, 0.06, 1.15, cx, 8.65, ridge)
    b.poly(P["roofmetal"], [(cx - 0.65, 8.71, ridge - 0.65), (cx + 0.65, 8.71, ridge - 0.65), (cx + 0.65, 8.71, ridge + 0.65),
                           (cx - 0.65, 8.71, ridge + 0.65), (cx, 9.3, ridge)],
           [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [3, 2, 1, 0]])
    I = P["iron"]
    b.cyl(I, 0.02, (cx, 9.3, ridge), (cx, 10.3, ridge), seg=6)
    b.cyl(I, 0.05, (cx, 9.55, ridge), (cx, 9.6, ridge), seg=10)
    for (dx, dz) in ((0.32, 0), (-0.32, 0), (0, 0.32), (0, -0.32)):
        b.bar(I, (cx, 9.7, ridge), (cx + dx, 9.7, ridge + dz), 0.015)
    b.bar(I, (cx - 0.45, 10.05, ridge), (cx + 0.45, 10.05, ridge), 0.02)
    b.poly(I, [(cx + 0.45, 9.97, ridge), (cx + 0.62, 10.05, ridge), (cx + 0.45, 10.13, ridge)], [[0, 1, 2]])
    b.box(I, 0.2, 0.2, 0.012, cx - 0.4, 9.98, ridge)
    # (the little troll head on the vane: a flat disc, the JS paints the face)
    b.cyl(I, 0.12, (cx - 0.05, 10.25, ridge - 0.006), (cx - 0.05, 10.25, ridge + 0.006), seg=14)
    # hay-loft door + hoist beam high on the east gable
    gx = x1 + 0.04
    b.box(R, 0.06, 1.5, 1.4, gx, 4.75, ridge)
    b.box(T, 0.07, 0.1, 1.5, gx + 0.01, 4.7, ridge)
    b.box(T, 0.07, 0.1, 1.5, gx + 0.01, 6.2, ridge)
    for s in (-1, 1):
        b.box(T, 0.07, 1.6, 0.1, gx + 0.01, 4.7, ridge + s * 0.7)
    for r in (0.82, -0.82):
        b.box(T, 0.075, 1.75, 0.09, gx + 0.012, 4.6, ridge, rx=r)
    b.box(Wd, 1.6, 0.18, 0.18, x1 + 0.6, 7.05, ridge)
    b.cyl(I, 0.09, (x1 + 1.25, 6.86, ridge - 0.03), (x1 + 1.25, 6.86, ridge + 0.03), seg=12)
    b.cyl(P["rope"], 0.015, (x1 + 1.34, 6.86, ridge), (x1 + 1.34, 4.4, ridge), seg=5)
    b.lump(P["hay"], 0.55, 0.4, 0.45, x1 + 1.34, 4.0, ridge, seed=3, rnd=0.3, jitter=0.03, flat_base=False)
    # sliding doors hung off a track over the north opening, slid aside
    b.box(I, 8.4, 0.12, 0.08, 23, 3.72, z0 - 0.08)
    b.box(T, 8.6, 0.2, 0.04, 23, 3.84, z0 - 0.05)
    for cxd in (20.0, 26.0):
        zf = z0 - 0.17
        b.box(R, 2.0, 3.55, 0.07, cxd, 0.08, zf)
        b.box(T, 2.04, 0.13, 0.05, cxd, 0.08, zf - 0.05)
        b.box(T, 2.04, 0.13, 0.05, cxd, 3.5, zf - 0.05)
        b.box(T, 2.04, 0.12, 0.05, cxd, 1.8, zf - 0.05)
        for s in (-1, 1):
            b.box(T, 0.13, 3.55, 0.05, cxd + s * 0.955, 0.08, zf - 0.05)
        for (ylo, yhi) in ((0.21, 1.8), (1.92, 3.5)):
            L = math.hypot(1.78, yhi - ylo)
            ang = math.atan2(yhi - ylo, 1.78)
            for s in (-1, 1):
                b.box(T, L, 0.1, 0.045, cxd, (ylo + yhi) / 2 - 0.05, zf - 0.07, rz=s * ang)
        for s in (-1, 1):
            b.cyl(I, 0.07, (cxd + s * 0.6, 3.78, zf), (cxd + s * 0.6, 3.78, zf - 0.08), seg=10)
        b.box(I, 0.04, 0.3, 0.06, cxd + 0.85, 1.2, zf - 0.08)
    # the west door: a smaller pair of hinged doors swung flat
    for s in (-1, 1):
        zc = 24.5 + s * 2.25
        xf = x0 - 0.08
        b.box(R, 0.06, 2.15, 1.45, xf, 0.05, zc)
        b.box(T, 0.04, 0.1, 1.45, xf - 0.04, 1.05, zc)
        for r in (0.98, -0.98):
            b.box(T, 0.04, 2.3, 0.09, xf - 0.045, 0.0, zc, rx=r * 0.55)
    # windows: muntins in the open frames (no glass: an old barn)
    for w in walls:
        for hole in w.holes:
            for lo, hi in hole["spans"]:
                if lo < 0.05:
                    continue
                c = hole["c"]
                w.slab(b, T, c - 0.025, c + 0.025, lo, hi, w.at, 0.05)
                w.slab(b, T, c - hole["w"] / 2, c + hole["w"] / 2, (lo + hi) / 2 - 0.025, (lo + hi) / 2 + 0.025, w.at, 0.05)
    # inside: ceiling boards on joists, posts and beams, the loft
    b.box(Wd, x1 - x0 - 2 * t, 0.04, z1 - z0 - 2 * t, 23, 4.36, 24.5)
    xx = x0 + 0.9
    while xx < x1 - 0.5:
        b.box(Wd, 0.14, 0.22, z1 - z0 - 2 * t, xx, 4.14, 24.5)
        xx += 1.2
    lx0, lx1, lz0, lz1, ly = x0 + t, 20.4, z0 + t, z1 - t, 2.4
    b.box(Wd, lx1 - lx0, 0.06, lz1 - lz0, (lx0 + lx1) / 2, ly - 0.06, (lz0 + lz1) / 2)
    zz = lz0 + 0.5
    while zz < lz1:
        b.box(Wd, lx1 - lx0, 0.18, 0.1, (lx0 + lx1) / 2, ly - 0.24, zz)
        zz += 0.8
    b.box(Wd, 0.2, 0.25, lz1 - lz0, lx1 - 0.1, ly - 0.31, (lz0 + lz1) / 2)
    for pz in (lz0 + 0.12, lz1 - 0.12):
        b.box(Wd, 0.2, ly - 0.06, 0.2, lx1 - 0.1, 0, pz)
    # loft rail (the JS collider is a railing along x 20.4 with a gap at the stair)
    for (za, zb) in ((lz0, 27.1),):
        n = max(2, int((zb - za) / 1.2) + 1)
        for i in range(n):
            pz = za + 0.05 + (zb - za - 0.1) * i / (n - 1)
            b.box(Wd, 0.08, 1.0, 0.08, lx1 - 0.04, ly, pz)
        b.box(Wd, 0.09, 0.08, zb - za, lx1 - 0.04, ly + 0.95, (za + zb) / 2)
        b.box(Wd, 0.06, 0.07, zb - za, lx1 - 0.04, ly + 0.5, (za + zb) / 2)
    # the stair: climbs west along the south wall straight onto the loft;
    # plank treads + risers, boxed in underneath (its collider is solid to
    # the floor), a short landing, a handrail on the open (north) side
    sz = 27.7
    for k in range(8):
        top = 0.3 * (k + 1)
        xc = 24.4 - 0.42 * (k + 0.5)
        b.box(Wd, 0.4, 0.05, 1.0, xc, top - 0.05, sz)
        b.box(Wd, 0.03, 0.26, 0.98, xc + 0.2, top - 0.3, sz)
    for zz in (sz - 0.48, sz + 0.48):
        b.poly(Wd, [(24.4, 0, zz), (21.04, 0, zz), (21.04, 2.38, zz), (24.4, 0.28, zz)], [[0, 1, 2, 3]])
        b.poly(Wd, [(24.4, 0, zz), (24.4, 0.28, zz), (21.04, 2.38, zz), (21.04, 0, zz)], [[0, 1, 2, 3]])
    b.box(Wd, 0.64, 0.06, 1.0, 20.72, 2.34, sz)
    b.box(Wd, 0.64, 2.34, 0.04, 20.72, 0, sz - 0.48)
    b.bar(Wd, (24.3, 1.25, sz - 0.48), (21.1, 3.35, sz - 0.48), 0.06)
    for k in (0, 3, 6):
        b.box(Wd, 0.06, 0.95, 0.06, 24.4 - 0.42 * (k + 0.5), 0.3 * (k + 1), sz - 0.48)
    # stalls along the east wall: low plank partitions (decor: under 1.1 m)
    for pz in (23.3, 24.9):
        b.box(Wd, 2.0, 1.05, 0.08, 27.75, 0, pz)
        b.box(Wd, 0.12, 1.25, 0.12, 26.8, 0, pz)
    # tools hung on the north wall, a lantern hook, a saddle on a rail
    for i, (tx, kind) in enumerate(((18.0, "fork"), (18.5, "rake"), (19.0, "shovel"), (27.2, "fork"), (28.0, "scythe"))):
        zz = z0 + t + 0.06
        b.cyl(P["handle"], 0.025, (tx, 0.5, zz), (tx + 0.08, 2.1, zz), seg=6)
        if kind == "fork":
            for d in (-0.08, 0, 0.08):
                b.cyl(P["tool"], 0.008, (tx + d, 0.18, zz), (tx + d, 0.5, zz), seg=4)
            b.box(P["tool"], 0.2, 0.03, 0.02, tx, 0.48, zz)
        elif kind == "rake":
            b.box(P["tool"], 0.4, 0.04, 0.03, tx, 0.48, zz)
            for d in range(-4, 5):
                b.box(P["tool"], 0.01, 0.07, 0.01, tx + d * 0.045, 0.41, zz)
        elif kind == "shovel":
            b.box(P["tool"], 0.24, 0.32, 0.02, tx, 0.18, zz)
        else:
            b.bar(P["tool"], (tx + 0.08, 2.1, zz), (tx + 0.62, 1.95, zz), 0.03, 0.12)
    b.box(Wd, 0.1, 0.1, 1.4, x1 - t - 0.06, 1.2, 27.0)
    b.lump(P["wainscot"], 0.5, 0.35, 0.6, x1 - t - 0.25, 1.25, 27.0, seed=9, rnd=0.5, jitter=0.03)
    b.finish("hg-barn.glb")


# ------------------------------------------------------------- candy shop

def build_shop(P):
    """Over: walls x -11..-1, z 21..27.5 (0.4 thick, 3.4 tall); roof slab
    10.6 x 7.1 x 0.3 at 3.4; false front 10.2 x 1.8 x 0.3 at z 21.1;
    counter (-8.4, 25.1) 2.8 x 0.8 x 1.05; shelves (-7.6, 27.0) 4.6 x 0.5 x 2.2;
    bay knee wall (-9, 20.72) 2.0 x 0.55 x 0.9."""
    b = Builder()
    rng = random.Random(41)
    C, OT, D, BR = P["clap"], P["shoptrim"], P["shopdark"], P["brick"]
    x0, x1, z0, z1, h, t = -11.0, -1.0, 21.0, 27.5, 3.4, 0.4
    front = Wall("x", z0 + 0.2, x0, x1, h, t, out=-1, holes=[
        {"c": -6, "w": 1.8, "spans": [(0, 2.5)]}, {"c": -9, "w": 2.2, "spans": [(0.9, 2.3)]},
        {"c": -2.9, "w": 1.8, "spans": [(0.9, 2.3)]}])
    back = Wall("x", z1 - 0.2, x0, x1, h, t, out=1, holes=[
        {"c": -3.5, "w": 1.6, "spans": [(0, 2.4)]}, {"c": -8.5, "w": 1.4, "spans": [(1.0, 2.2)]}])
    west = Wall("z", x0 + 0.2, z0 + 0.4, z1 - 0.4, h, t, out=-1, holes=[{"c": 24.2, "w": 1.6, "spans": [(1.0, 2.3)]}])
    east = Wall("z", x1 - 0.2, z0 + 0.4, z1 - 0.4, h, t, out=1, holes=[{"c": 24.2, "w": 1.4, "spans": [(1.0, 2.3)]}])
    front.solid(b, D, inner=P["wainscot"], split=0.3)
    front.laps(b, C, every=0.19, y0=0.85)
    for w in (back, west, east):
        w.solid(b, BR, inner=P["paper"], split=0.6)
    # brick: soldier-course heads + stone sills on the brick walls' windows
    for w in (back, west, east):
        for hole in w.holes:
            for lo, hi in hole["spans"]:
                c = hole["c"]
                k = -hole["w"] / 2 - 0.06
                while k < hole["w"] / 2 + 0.06:
                    w.slab(b, BR, c + k, c + k + 0.075, hi, hi + 0.24, w.face(0.012), 0.025)
                    k += 0.085
                if lo > 0.05:
                    w.slab(b, P["granite"], c - hole["w"] / 2 - 0.1, c + hole["w"] / 2 + 0.1, lo - 0.08, lo, w.face(0.05), 0.1)
        w.casings(b, D, fw=0.07, proud=0.03, sill=False)
    # parapet + coping on the sides and back, tar roof, chimney
    for (cx, cz, w_, d_) in ((-6, z1 - 0.2, 10.0, 0.4), (x0 + 0.2, 24.25, 0.4, 6.5), (x1 - 0.2, 24.25, 0.4, 6.5)):
        b.box(BR, w_, 0.5, d_, cx, 3.7, cz)
        b.box(P["granite"], w_ + 0.1, 0.07, d_ + 0.1, cx, 4.2, cz)
    b.box(P["tar"], 9.6, 0.02, 6.0, -6, 3.7, 24.3)
    b.box(BR, 0.7, 1.6, 0.6, -9.6, 3.7, 26.6)
    b.box(P["granite"], 0.8, 0.08, 0.7, -9.6, 5.3, 26.6)
    b.cyl(P["iron"], 0.12, (-3.0, 3.72, 25.0), (-3.0, 4.3, 25.0), seg=10)
    b.cyl(P["iron"], 0.2, (-3.0, 4.3, 25.0), (-3.0, 4.42, 25.0), seg=10, r2=0.05)
    # the storefront: pilasters, kick panels, door + transom, cornice band
    zf = z0 - 0.0
    for px in (-10.82, -7.4, -4.65, -1.18):
        b.box(OT, 0.34, 3.0, 0.12, px, 0, zf - 0.04)
        b.box(OT, 0.42, 0.14, 0.16, px, 0, zf - 0.06)
        b.box(OT, 0.42, 0.16, 0.16, px, 2.9, zf - 0.06)
    for (c, w_) in ((-2.9, 1.8),):
        b.box(D, w_ + 0.2, 0.85, 0.06, c, 0, zf - 0.03)
        b.box(OT, w_ - 0.2, 0.5, 0.03, c, 0.18, zf - 0.07)
    front.casings(b, OT, fw=0.1, proud=0.05)
    b.box(P["warm"], 1.6, 0.48, 0.03, -6, 2.62, zf - 0.0)
    b.box(OT, 1.8, 0.06, 0.06, -6, 2.58, zf - 0.04)
    b.box(OT, 1.8, 0.06, 0.06, -6, 3.1, zf - 0.04)
    for k in (-0.4, 0.0, 0.4):
        b.box(OT, 0.04, 0.48, 0.05, -6 + k, 2.62, zf - 0.03)
    # display-window muntins (no glass: open, as before)
    for c, w_ in ((-2.9, 1.8),):
        b.box(OT, 0.04, 1.4, 0.04, c - w_ / 6, 0.9, zf + 0.0)
        b.box(OT, 0.04, 1.4, 0.04, c + w_ / 6, 0.9, zf + 0.0)
        b.box(OT, w_, 0.04, 0.04, c, 1.95, zf + 0.0)
    # the door leaf, swung in against the wall
    b.box(D, 0.9, 2.4, 0.05, -6.45 - 0.45 + 0.45, 0.02, zf + 0.62)
    b.box(P["warm"], 0.6, 0.9, 0.06, -6.45, 1.2, zf + 0.62)
    b.box(OT, 0.04, 0.04, 0.12, -6.05, 1.1, zf + 0.62)
    # the bay window: knee wall, angled sides, mullions, a copper cap
    bz = z0 - 0.55
    pts = [(-10.1, z0), (-9.65, bz), (-8.35, bz), (-7.9, z0)]
    prof = [(p[0], p[1]) for p in pts]
    for (yy0, yy1, m) in ((0.0, 0.88, C), (0.88, 0.95, OT), (2.3, 2.38, OT)):
        vs = [(x, yy0, z) for x, z in prof] + [(x, yy1, z) for x, z in prof]
        b.poly(m, vs, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3]])
    for (xa, za) in pts:
        b.box(OT, 0.07, 1.36, 0.07, xa, 0.95, za)
    for xa in (-9.22, -8.78):
        b.box(OT, 0.04, 1.36, 0.04, xa, 0.95, bz)
    capv = [(-10.25, 2.38, z0), (-9.72, 2.38, bz - 0.12), (-8.28, 2.38, bz - 0.12), (-7.75, 2.38, z0),
            (-9.6, 2.62, z0), (-8.4, 2.62, z0)]
    b.poly(P["bronze"], capv, [[0, 1, 4], [1, 2, 5, 4], [2, 3, 5]])
    # candy jars stacked in the bay (painted: bright lids, coloured fills)
    for i, xj in enumerate((-9.55, -9.2, -8.85, -8.5)):
        for row, (yj, zj) in enumerate(((0.95, bz + 0.18), (1.25, bz + 0.38))):
            col = [0xff4a7a, 0x5ad0ff, 0xffd23a, 0x8aff6a, 0xc07aff, 0xff8a3a][(i * 2 + row) % 6]
            jar = mat("HG_Jar%d" % ((i * 2 + row) % 6), col, 0.3, 0.0, col, 0.25)
            b.cyl(jar, 0.11, (xj, yj, zj), (xj, yj + 0.24, zj), seg=10)
            b.cyl(P["brass"], 0.08, (xj, yj + 0.24, zj), (xj, yj + 0.29, zj), seg=10)
    b.box(P["wainscot"], 1.3, 0.04, 0.5, -9, 0.95, bz + 0.27)
    # false front: lap boards, a sign frame, brackets, a heavy cornice
    ffz = z0 + 0.1
    for k in range(9):
        yy = h + k * 0.2
        b.box(C, 10.2, 0.22, 0.3, -6, yy, ffz, rx=0.0)
        b.box(C, 10.22, 0.03, 0.32, -6, yy + 0.19, ffz)
    b.box(D, 7.8, 1.65, 0.06, -6, h + 0.08, ffz - 0.16)
    for yy in (h + 0.04, h + 1.7):
        b.box(OT, 8.1, 0.12, 0.1, -6, yy, ffz - 0.18)
    for xx in (-9.98, -2.02):
        b.box(OT, 0.12, 1.78, 0.1, xx, h + 0.04, ffz - 0.18)
    b.box(OT, 10.6, 0.16, 0.5, -6, h + 1.8, ffz)
    b.box(OT, 10.8, 0.1, 0.62, -6, h + 1.96, ffz)
    b.box(D, 10.3, 0.22, 0.12, -6, h + 1.55, ffz - 0.2)
    xx = -10.8
    while xx <= -1.15:
        b.prism(OT, [(ffz - 0.15, h + 1.55), (ffz - 0.45, h + 1.8), (ffz - 0.15, h + 1.8)], xx - 0.05, xx + 0.05, axis="x")
        xx += 0.6
    for xx in (-10.6, -1.4):
        b.cyl(OT, 0.09, (xx, h + 2.06, ffz), (xx, h + 2.4, ffz), seg=10, r2=0.02)
    # the storefront cornice band over the shopfront (the roof slab's edge)
    b.box(D, 10.6, 0.3, 0.12, -6, 3.4, z0 - 0.05)
    b.box(OT, 10.7, 0.06, 0.2, -6, 3.37, z0 - 0.08)
    # inside: floorboards, wainscot + chair rail, pressed-tin ceiling
    b.box(P["floor"], 9.2, 0.02, 5.7, -6, 0, 24.25)
    for (cx, cz, w_, d_) in ((-6, z1 - t - 0.02, 9.2, 0.04), (x0 + t + 0.02, 24.25, 0.04, 5.7), (x1 - t - 0.02, 24.25, 0.04, 5.7)):
        b.box(P["wainscot"], w_, 1.0, d_, cx, 0, cz)
        b.box(OT, w_ + (0.04 if w_ > 1 else 0.02), 0.06, d_ + (0.02 if w_ > 1 else 0.04), cx, 1.0, cz)
    b.box(P["tin"], 9.2, 0.02, 5.7, -6, 3.37, 24.25)
    for i in range(10):
        b.box(P["brass"], 0.04, 0.02, 5.7, -10.6 + i * 1.0 + 0.5, 3.35, 24.25)
    for i in range(6):
        b.box(P["brass"], 9.2, 0.02, 0.04, -6, 3.35, z0 + t + 0.5 + i * 1.0)
    # the glass counter: wood plinth, dark glass, a brass rail, scale + till
    cx, cz = -8.4, 25.1
    b.box(P["wainscot"], 2.8, 0.4, 0.8, cx, 0, cz, bevel=0.01)
    b.box(P["glass"], 2.7, 0.55, 0.72, cx, 0.4, cz)
    b.box(P["warm"], 2.6, 0.03, 0.6, cx, 0.62, cz)
    b.box(P["wainscot"], 2.9, 0.08, 0.86, cx, 0.95, cz, bevel=0.01)
    b.box(P["brass"], 2.8, 0.03, 0.03, cx, 0.6, cz - 0.38)
    b.cyl(P["brass"], 0.14, (cx - 0.8, 1.03, cz), (cx - 0.8, 1.06, cz), seg=14)
    b.cyl(P["brass"], 0.03, (cx - 0.8, 1.06, cz), (cx - 0.8, 1.35, cz), seg=6)
    b.cyl(P["brass"], 0.16, (cx - 0.8, 1.35, cz), (cx - 0.8, 1.4, cz), seg=14, r2=0.2)
    b.box(P["brass"], 0.4, 0.3, 0.35, cx + 0.7, 1.03, cz)
    b.box(P["brass"], 0.42, 0.05, 0.25, cx + 0.7, 1.33, cz - 0.05, rx=0.4)
    # shelving behind (JS jars sit on these boards)
    sx, sz = -7.6, 27.0
    for s in (-1, 1):
        b.box(P["wainscot"], 0.06, 2.2, 0.5, sx + s * 2.27, 0, sz)
    for k in range(4):
        b.box(P["wainscot"], 4.6, 0.04, 0.42, sx, 0.41 + k * 0.62, sz - 0.04)
    b.box(OT, 4.7, 0.12, 0.52, sx, 2.2, sz)
    # the pendant lamp
    b.cyl(P["iron"], 0.008, (-6, 3.37, 24.3), (-6, 2.85, 24.3), seg=4)
    b.cyl(P["bronze_dk"], 0.06, (-6, 2.85, 24.3), (-6, 2.6, 24.3), seg=12, r2=0.3)
    b.cyl(P["lamp"], 0.09, (-6, 2.55, 24.3), (-6, 2.68, 24.3), seg=10)
    b.finish("hg-candyshop.glb")


BUILDS = {"mausoleum": build_mausoleum, "barn": build_barn, "shop": build_shop}
FILES = {"mausoleum": "hg-mausoleum.glb", "barn": "hg-barn.glb", "shop": "hg-candyshop.glb"}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    names = argv or list(BUILDS)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    P = palette()
    P.update(hg_palette())
    import quantize_glb
    for n in names:
        BUILDS[n](P)
        quantize_glb.main([os.path.join(OUT_DIR, FILES[n])])


if __name__ == "__main__":
    main()
